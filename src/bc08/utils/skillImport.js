import { validateSkillCode } from './skillValidator.js';

const STORAGE_KEY = 'bc08_skills_imported';

// Preview rules for imported skills
export const PREVIEW_RULES = {
  MAX_WIDTH: 360,
  MAX_HEIGHT: 360,
  MAX_SIZE_BYTES: 50 * 1024, // 50 KB
  RECOMMENDED_FORMATS: ['image/png'],
};

function getImageDimensions(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = dataUrl;
  });
}

function checkPreviewRules(file, dataUrl, dimensions) {
  const warnings = [];
  if (file.size > PREVIEW_RULES.MAX_SIZE_BYTES) {
    warnings.push(`Preview size ${(file.size / 1024).toFixed(1)}KB exceeds limit ${PREVIEW_RULES.MAX_SIZE_BYTES / 1024}KB`);
  }
  if (dimensions.width > PREVIEW_RULES.MAX_WIDTH || dimensions.height > PREVIEW_RULES.MAX_HEIGHT) {
    warnings.push(`Preview dimensions ${dimensions.width}x${dimensions.height} exceed recommended ${PREVIEW_RULES.MAX_WIDTH}x${PREVIEW_RULES.MAX_HEIGHT}`);
  }
  if (!PREVIEW_RULES.RECOMMENDED_FORMATS.includes(file.type)) {
    warnings.push(`Preview format "${file.type}" is not recommended, use PNG`);
  }
  return warnings;
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function parseSkillMd(text) {
  if (!text || !text.trimStart().startsWith('---')) return null;
  const end = text.indexOf('---', 3);
  if (end === -1) return null;
  const json = text.slice(3, end).trim();
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getFolderName(path) {
  const parts = path.split('/').filter(Boolean);
  return parts[0] || 'imported';
}

function findFile(files, predicate) {
  return Array.from(files).find(predicate) || null;
}

export function getImportedSkills() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveImportedSkills(skills) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(skills));
}

export function saveImportedSkill(skill) {
  const skills = getImportedSkills();
  const idx = skills.findIndex((s) => s.id === skill.id);
  if (idx >= 0) {
    skills[idx] = skill;
  } else {
    skills.push(skill);
  }
  saveImportedSkills(skills);
}

export function deleteImportedSkill(id) {
  const skills = getImportedSkills().filter((s) => s.id !== id);
  saveImportedSkills(skills);
}

export async function openLocalSkillDirectory() {
  if (!window.showDirectoryPicker) {
    return null;
  }
  const dirHandle = await window.showDirectoryPicker();
  const rootName = dirHandle.name;
  const entries = [];

  async function collect(handle, path) {
    for await (const [name, child] of handle.entries()) {
      const childPath = path ? `${path}/${name}` : name;
      if (child.kind === 'directory') {
        await collect(child, childPath);
      } else {
        const file = await child.getFile();
        entries.push({ file, relativePath: `${rootName}/${childPath}` });
      }
    }
  }

  await collect(dirHandle, '');
  return entries;
}

export async function parseSkillFromFiles(items) {
  const entries = items.map((item) => {
    if (item && typeof item === 'object' && item.file instanceof File) {
      return { file: item.file, relativePath: item.relativePath || item.file.webkitRelativePath || item.file.name };
    }
    return { file: item, relativePath: item.webkitRelativePath || item.name };
  });

  const byFolder = new Map();
  for (const entry of entries) {
    const folder = getFolderName(entry.relativePath || entry.file.name);
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    byFolder.get(folder).push(entry);
  }

  const imported = [];
  for (const [folder, folderEntries] of byFolder) {
    const mdEntry = findFile(folderEntries, (e) => {
      const name = (e.relativePath || e.file.name).toLowerCase();
      return name.endsWith('/skill.md') || name === 'skill.md';
    });

    const luaEntries = folderEntries.filter((e) => e.file.name.toLowerCase().endsWith('.lua'));
    const imageEntries = folderEntries.filter((e) => /\.(png|jpe?g|webp|gif)$/i.test(e.file.name));

    if (luaEntries.length === 0) continue;

    const meta = mdEntry ? parseSkillMd(await readFileAsText(mdEntry.file)) : null;

    const scriptEntry = luaEntries.find((e) => (e.relativePath || e.file.name).includes('/scripts/')) || luaEntries[0];
    const previewEntry =
      imageEntries.find((e) => /preview/i.test(e.file.name)) ||
      imageEntries.find((e) => (e.relativePath || e.file.name).includes('/assets/')) ||
      imageEntries[0];

    const imageMap = {};
    const imageDataUrls = await Promise.all(
      imageEntries.map((e) => readFileAsDataUrl(e.file).then((url) => ({ entry: e, url })))
    );
    for (const { entry, url } of imageDataUrls) {
      const parts = (entry.relativePath || entry.file.webkitRelativePath || entry.file.name).split('/').filter(Boolean);
      const relPath = parts.slice(1).join('/');
      if (!relPath) continue;
      imageMap[`skills/${folder}/${relPath}`] = url;
    }

    const [code, preview] = await Promise.all([
      readFileAsText(scriptEntry.file),
      previewEntry ? readFileAsDataUrl(previewEntry.file) : Promise.resolve(null),
    ]);

    const warnings = [];
    if (previewEntry && preview) {
      const dims = await getImageDimensions(preview);
      warnings.push(...checkPreviewRules(previewEntry.file, preview, dims));
    }

    const validation = validateSkillCode(code);
    if (!validation.ok) {
      warnings.push(...validation.errors);
    }
    warnings.push(...validation.warnings.map((w) => `[${w.level.toUpperCase()}] ${w.message}`));

    imported.push({
      id: `imported-${folder}-${Date.now()}`,
      source: 'imported',
      title: meta?.name || folder,
      description: meta?.description || '',
      author: meta?.author || 'Local',
      categories: meta?.metadata?.category || meta?.metadata?.tags || [],
      preview_url: preview,
      code,
      imageMap,
      warnings,
      importedAt: Date.now(),
    });
  }

  return imported;
}

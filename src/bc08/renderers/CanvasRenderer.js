export const SCR_W = 720;
export const SCR_H = 1180;
export const CANVAS_H = 1280;
export const NAV_H = 100;
const NAV_COLOR = '#00FFFF';

export function colorToCss(color) {
  const c = Number(color) || 0;
  const r = (c >> 16) & 0xff;
  const g = (c >> 8) & 0xff;
  const b = c & 0xff;
  return `rgb(${r},${g},${b})`;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawContainer(ctx, c) {
  ctx.fillStyle = colorToCss(c.color);
  if (c.radius > 0) {
    roundRect(ctx, c.x, c.y, c.w, c.h, c.radius);
    ctx.fill();
  } else {
    ctx.fillRect(c.x, c.y, c.w, c.h);
  }
}

function drawButton(ctx, c) {
  ctx.fillStyle = colorToCss(c.color);
  roundRect(ctx, c.x, c.y, c.w, c.h, 8);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(c.text, c.x + c.w / 2, c.y + c.h / 2);
}

function drawLabel(ctx, c) {
  ctx.fillStyle = colorToCss(c.color);
  ctx.font = `${c.font_size || 24}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(c.text, c.x, c.y);
}

let requestImageRedraw = null;
export function setImageRedrawCallback(fn) {
  requestImageRedraw = fn || null;
}

const imageCache = new Map();
let importedImageMap = {};

export function registerImportedImages(map) {
  importedImageMap = map || {};
}

function resolveImagePath(path) {
  if (!path) return '';
  let p = String(path).replace(/\\/g, '/');
  // Strip drive-style prefixes like F:
  if (/^[A-Za-z]:/.test(p)) {
    p = p.substring(2);
  }
  // Device flash root (/fatfs) maps to the simulator public root, so
  // "/fatfs/skills/<id>/assets/x.png" resolves like "skills/<id>/assets/x.png".
  if (p === '/fatfs') {
    p = '/';
  } else if (p.startsWith('/fatfs/')) {
    p = p.substring('/fatfs'.length);
  }
  if (p.startsWith('/')) {
    p = p.substring(1);
  }
  // Imported skills may provide a data URL for this exact normalized path
  if (p.startsWith('skills/') && importedImageMap[p]) {
    return importedImageMap[p];
  }
  // Built-in skills live under /skills/hammer-claw-skills-lab/
  if (p.startsWith('skills/')) {
    return `/skills/hammer-claw-skills-lab/${p}`;
  }
  return `/${p}`;
}

function getImage(path) {
  const url = resolveImagePath(path);
  if (!url) return null;
  if (imageCache.has(url)) return imageCache.get(url);
  const img = new Image();
  img.src = url;
  img.onload = () => {
    if (requestImageRedraw) requestImageRedraw();
  };
  imageCache.set(url, img);
  return img;
}

function drawImage(ctx, c) {
  const img = getImage(c.path);
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, c.x, c.y, c.w, c.h);
    return;
  }
  ctx.strokeStyle = '#888888';
  ctx.lineWidth = 2;
  ctx.strokeRect(c.x, c.y, c.w, c.h);
  ctx.fillStyle = '#888888';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(c.path ? c.path.split('/').pop() : 'IMG', c.x + 8, c.y + 8);
}

function drawControl(ctx, c) {
  switch (c.type) {
    case 'container':
      drawContainer(ctx, c);
      break;
    case 'button':
      drawButton(ctx, c);
      break;
    case 'label':
      drawLabel(ctx, c);
      break;
    case 'image':
      drawImage(ctx, c);
      break;
    default:
      break;
  }
}

const ICON_PATHS = [
  '/raw/bc08-simulator-icons/nav-home.png',
  '/raw/bc08-simulator-icons/nav-globe.png',
  '/raw/bc08-simulator-icons/nav-database.png',
  '/raw/bc08-simulator-icons/nav-skills.png',
];

const navIcons = ICON_PATHS.map((src) => {
  const img = new Image();
  img.src = src;
  img.crossOrigin = 'anonymous';
  return img;
});

function navIconsReady() {
  return navIcons.every((img) => img.complete && img.naturalWidth > 0);
}

function drawNavBar(ctx) {
  const y = SCR_H;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, y, SCR_W, NAV_H);

  ctx.strokeStyle = '#222222';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(SCR_W, y);
  ctx.stroke();

  const iconSize = 56;
  const spacing = SCR_W / 4;
  const drawY = y + (NAV_H - iconSize) / 2;

  for (let i = 0; i < 4; i++) {
    const cx = spacing * i + spacing / 2;
    const drawX = cx - iconSize / 2;
    ctx.save();
    ctx.globalAlpha = i === 3 ? 1 : 0.5;
    if (i === 3) {
      ctx.shadowColor = NAV_COLOR;
      ctx.shadowBlur = 12;
    }
    if (navIconsReady()) {
      ctx.drawImage(navIcons[i], drawX, drawY, iconSize, iconSize);
    }
    ctx.restore();
  }
}

export function renderScreen(ctx, state) {
  ctx.clearRect(0, 0, SCR_W, CANVAS_H);
  const pages = state?.pages || [];
  for (const page of pages) {
    if (page.controls) {
      for (const c of page.controls) {
        drawControl(ctx, c);
      }
    }
  }
  drawNavBar(ctx);
}

export function findControlAt(state, x, y) {
  const pages = state?.pages || [];
  for (let i = pages.length - 1; i >= 0; i--) {
    const page = pages[i];
    const controls = page.controls || [];
    for (let j = controls.length - 1; j >= 0; j--) {
      const c = controls[j];
      // images are decorative; only buttons are clickable controls
      if (c.type === 'button') {
        if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
          return { pageId: page.id, objId: c.id };
        }
      }
    }
  }
  return null;
}

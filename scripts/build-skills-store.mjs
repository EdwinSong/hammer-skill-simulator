import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SIM_DIR = path.resolve(__dirname, '..')

const LAB_DIR = path.join(SIM_DIR, 'public', 'skills', 'hammer-claw-skills-lab')
const SOURCE_SKILLS_DIR = path.join(LAB_DIR, 'skills')
const SOURCE_CATALOG = path.join(LAB_DIR, 'dist', 'skills-catalog.json')
const STORE_DIR = path.join(SIM_DIR, 'public', 'skills')
const STORE_CATALOG = path.join(STORE_DIR, 'skills-catalog.json')

function regenerateCatalog() {
  const script = path.join(LAB_DIR, 'scripts', 'generate_catalog.py')
  if (!fs.existsSync(script)) return
  // Regenerate dist/skills-catalog.json so the store always reflects the
  // current skills/ directory (new previews, renamed files, new skills).
  const res = spawnSync('python', [script], { stdio: 'inherit' })
  if (res.error || res.status !== 0) {
    console.warn('WARNING: generate_catalog.py did not run (python missing or failed); using existing dist/skills-catalog.json')
  }
}

function main() {
  regenerateCatalog()

  if (!fs.existsSync(SOURCE_CATALOG)) {
    console.error(`Catalog not found: ${SOURCE_CATALOG}. Run "python scripts/generate_catalog.py" in hammer-claw-skills-lab first.`)
    process.exit(1)
  }

  if (!fs.existsSync(SOURCE_SKILLS_DIR)) {
    console.error(`Skills directory not found: ${SOURCE_SKILLS_DIR}`)
    process.exit(1)
  }

  // Build a dev catalog with local paths that the simulator can fetch.
  const catalog = JSON.parse(fs.readFileSync(SOURCE_CATALOG, 'utf-8'))
  const devCatalog = {
    generated_at: catalog.generated_at,
    total: catalog.total,
    skills: catalog.skills.map((skill) => {
      // skill.id comes from SKILL.md frontmatter and may differ from the
      // on-disk directory name (e.g. id "hydro_light_control" lives in
      // skills/watercooling_light_timer/). Always use the real directory.
      const skillDir = skill.dir || skill.id
      const localBase = `/skills/hammer-claw-skills-lab/skills/${skillDir}`
      const luaFile = skill.files.find((f) => f.toLowerCase().endsWith('.lua') && f.includes('scripts'))
        || skill.files.find((f) => f.toLowerCase().endsWith('.lua'))
        || `${skill.id}.lua`
      const mainScript = `${localBase}/${luaFile.replace(/\\/g, '/')}`
      const previewPath = path.join(SOURCE_SKILLS_DIR, skillDir, 'preview.png')
      return {
        ...skill,
        preview_url: fs.existsSync(previewPath) ? `${localBase}/preview.png` : null,
        main_script: mainScript,
        path: localBase,
      }
    }),
  }

  fs.mkdirSync(STORE_DIR, { recursive: true })
  fs.writeFileSync(STORE_CATALOG, JSON.stringify(devCatalog, null, 2) + '\n', 'utf-8')

  console.log(`Built simulator skills store at ${STORE_DIR}`)
  console.log(`  skills: ${SOURCE_SKILLS_DIR}`)
  console.log(`  catalog: ${STORE_CATALOG}`)
}

main()

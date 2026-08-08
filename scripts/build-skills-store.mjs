import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..', '..')
const SIM_DIR = path.resolve(__dirname, '..')

const SOURCE_SKILLS_DIR = path.join(ROOT_DIR, 'skills')
const SOURCE_CATALOG = path.join(ROOT_DIR, 'dist', 'skills-catalog.json')
const STORE_DIR = path.join(SIM_DIR, 'public', 'skills')
const STORE_SKILLS_DIR = path.join(STORE_DIR, 'hammer-claw-skills-lab', 'skills')
const STORE_CATALOG = path.join(STORE_DIR, 'skills-catalog.json')

function main() {
  if (!fs.existsSync(SOURCE_CATALOG)) {
    console.error(`Catalog not found: ${SOURCE_CATALOG}. Run "python scripts/generate_catalog.py" first.`)
    process.exit(1)
  }

  if (!fs.existsSync(SOURCE_SKILLS_DIR)) {
    console.error(`Skills directory not found: ${SOURCE_SKILLS_DIR}`)
    process.exit(1)
  }

  // Copy skills into the simulator public folder so Vite serves them.
  fs.rmSync(STORE_SKILLS_DIR, { recursive: true, force: true })
  fs.cpSync(SOURCE_SKILLS_DIR, STORE_SKILLS_DIR, { recursive: true, dereference: true })

  // Build a dev catalog with local paths that the simulator can fetch.
  const catalog = JSON.parse(fs.readFileSync(SOURCE_CATALOG, 'utf-8'))
  const devCatalog = {
    generated_at: catalog.generated_at,
    total: catalog.total,
    skills: catalog.skills.map((skill) => {
      const localBase = `/skills/hammer-claw-skills-lab/skills/${skill.id}`
      const luaFile = skill.files.find((f) => f.toLowerCase().endsWith('.lua') && f.includes('scripts'))
        || skill.files.find((f) => f.toLowerCase().endsWith('.lua'))
        || `${skill.id}.lua`
      const mainScript = `${localBase}/${luaFile.replace(/\\/g, '/')}`
      return {
        ...skill,
        preview_url: `${localBase}/preview.png`,
        main_script: mainScript,
        path: localBase,
      }
    }),
  }

  fs.mkdirSync(STORE_DIR, { recursive: true })
  fs.writeFileSync(STORE_CATALOG, JSON.stringify(devCatalog, null, 2) + '\n', 'utf-8')

  console.log(`Built simulator skills store at ${STORE_DIR}`)
  console.log(`  skills: ${STORE_SKILLS_DIR}`)
  console.log(`  catalog: ${STORE_CATALOG}`)
}

main()

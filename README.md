# BC08 Skill Simulator

An open-source simulator for developing and testing BC08 skills written in Lua.

It provides a browser-based BC08 device emulator with an LCD screen, RGB panel, and a Lua runtime so you can build and debug skills without flashing real hardware.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173 and click **Skills** to load a skill from the built-in store.

## Skill Store

Skills are stored in the separate repository [`hammer-claw-skills-lab`](https://github.com/EdwinSong/hammer-claw-skills-lab) and included here as a Git submodule at:

```text
public/skills/hammer-claw-skills-lab
```

The simulator reads `public/skills/skills-catalog.json`, which is generated from the submodule's `dist/skills-catalog.json` with local fetch paths added.

`npm run build` automatically regenerates this catalog before building the production bundle. During development you can also regenerate it manually:

```bash
node scripts/build-skills-store.mjs
```

## Use Your Own Fork

You can replace the submodule with your own fork of `hammer-claw-skills-lab` to develop and test your own skills before submitting a pull request.

```bash
# 1. Point the submodule to your fork
git submodule set-url public/skills/hammer-claw-skills-lab \
  https://github.com/<your-username>/hammer-claw-skills-lab.git

# 2. Sync and update
git submodule sync
git submodule update --init --recursive

# 3. Regenerate the simulator catalog
node scripts/build-skills-store.mjs
```

Then run the simulator, load your skill, and iterate.

## Submitting a Skill PR

1. Fork [`EdwinSong/hammer-claw-skills-lab`](https://github.com/EdwinSong/hammer-claw-skills-lab).
2. Replace the submodule in this simulator with your fork (see above).
3. Add or edit skills under `public/skills/hammer-claw-skills-lab/skills/`.
4. Regenerate the catalog inside the submodule:

   ```bash
   cd public/skills/hammer-claw-skills-lab
   python scripts/generate_catalog.py
   cd ../../..
   node scripts/build-skills-store.mjs
   ```

5. Test your skill in the simulator.
6. Commit your skill changes in the fork and open a pull request to the `test` branch of `EdwinSong/hammer-claw-skills-lab`.

## Project Structure

```text
public/skills/
  hammer-claw-skills-lab/   # Git submodule: skill store
    dist/skills-catalog.json
    skills/
    scripts/
    tools/
  skills-catalog.json       # Generated dev catalog with local paths
src/bc08/
  components/               # Simulator UI components
  core/                     # Lua runtime and API registry
  apis/                     # Lua APIs: display, net, sys, storage, etc.
  renderers/                # Screen and RGB renderers
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Generate `public/skills/skills-catalog.json` and build for production |
| `npm run preview` | Preview the production build |
| `node scripts/build-skills-store.mjs` | Manually generate `public/skills/skills-catalog.json` from the submodule |

## License

MIT

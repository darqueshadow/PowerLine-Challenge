# PowerLine Challenge (PLC) — Training Console

A retro-computer-styled arcade / "training console" (Commodore-PET, cassette-load
aesthetic) that hosts several self-contained game **cartridges**. The `index.html`
in this folder is the main-menu **hub** that launches each cartridge.

*(Heads up: the folder is named `(PCL)`, but the project is **PowerLine Challenge / PLC**.)*

## Tech
- Plain browser **HTML / CSS / JS** — Canvas, SVG, Web Audio. **No build system, no frameworks.**
- Each cartridge is a self-contained mini-game under `cartridges/`.
- Shared hub code/art lives in `assets/`, `core/`, `datasets/`, `styles/`.
- Run locally via a web server (`Start Dev Server.bat`) — CSV loading needs `http://`, not `file://`.

## Cartridges (`cartridges/`)
- **Asteroid Command** — the original: an EMS-dispatcher training / typing-defense game.
- **The Aquanaut** — a deep-sea re-theme forked from Asteroid Command. 🟢 **ACTIVE** (its own `AQUANAUT_DESIGN.md` holds the design).
- **blank** — empty cartridge template for starting a new game.

## Working here
- Stay within the PLC arcade. Do **not** borrow themes from one cartridge for another
  (e.g. the Aquanaut's deep-sea theme) unless I explicitly say I'm working on that cartridge.

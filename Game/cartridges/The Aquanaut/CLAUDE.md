# The Aquanaut — 🟢 ACTIVE

A deep-sea typing-defense game forked from Asteroid Command (the "Below the Black"
build). **In active development** (resumed 2026-06-10). The full design and changelog
live in [`AQUANAUT_DESIGN.md`](AQUANAUT_DESIGN.md).

## Structure
- Live entry is `The Aquanaut.html` at the project root, which redirects to
  `files/index.html`. **All game code lives under `files/`** — `files/script.js`,
  `files/core/config.js`, `files/core/audio.js`, `files/style.css`.
- There is **no `v2/` folder** — the former v2 build was flattened into `files/`.
  Edit the `files/` tree, not a v2 folder.
- Run locally via a web server (`Start Dev Server.bat`) — CSV loading needs
  `http://`, not `file://`.

## Working here
- The `files/datasets/*.csv` are the **source of truth** for game content: mirror
  them into the game exactly, drop anything removed from a CSV, and verify a save
  actually landed before trusting it.
- This is its own cartridge — don't bleed the Aquanaut's deep-sea theme into other
  PLC cartridges, or borrow theirs into it.

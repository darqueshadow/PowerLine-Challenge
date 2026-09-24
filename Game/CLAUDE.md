# PowerLine Challenge (PLC) — Training Console

A retro arcade / "training console" that hosts several self-contained game
**cartridges**. The `index.html` in this folder is the main-menu **hub** that
launches each cartridge.

*(Heads up: the folder is named `(PCL)`, but the project is **PowerLine Challenge / PLC**.)*

## Two visual eras — don't conflate them

The in-universe machine is the **CAT Computer**, a 1970s box that loads 1980s games.
That split governs the styling:

- **Shell / boot layer = 1970s Commodore-PET.** The hub, the cassette-load sequence,
  and the login terminal. Green phosphor, block cursor, chunky serif-less caps.
- **Inside a cartridge = 1980s.** Once a game launches it gets its own look — think
  C64, NES, Sega Genesis, 1980s arcade cabinet. Bold, saturated, high-contrast; hard
  edges and hard offset shadows rather than soft glows.

So a cartridge's own menus and HUD are **not** bound to PET green. Contrast and
legibility beat palette fidelity — especially over photoreal background art, where a
translucent plate lets the artwork bleed through the text.

## Tech
- Plain browser **HTML / CSS / JS** — Canvas, SVG, Web Audio. **No build system, no frameworks.**
- Each cartridge is a self-contained mini-game under `cartridges/`.
- Shared hub code/art lives in `assets/`, `core/`, `datasets/`, `styles/`.
- Run locally via a web server (`Start Dev Server.bat`) — CSV loading needs `http://`, not `file://`.

## Cartridges (`cartridges/`)
- **Asteroid Command** — the original: an EMS-dispatcher training / typing-defense game.
- **The Aquanaut** — a deep-sea re-theme forked from Asteroid Command. 🟢 **ACTIVE** (its own `AQUANAUT_DESIGN.md` holds the design).
- **Egg Timer** *(formerly Whack A CAV)* — a whack-a-mole drill on the real CAV workflow (`CAV #### TYPE` / `RCAV ####`). 🟢 **LIVE** — launched in the hub on 2026-09-17 and public since 2026-09-19; art, audio, the title/end screens and an instruction screen are still placeholder or absent, and Developer Mode denies every entry until its phrase digest is set. It is a **Standalone Cartridge**: exempt from the Target / Impact Zone model and not copied from `blank`. Its own `CLAUDE.md` and `EGG_TIMER_CONTEXT_PACKET.md` hold the rules and design. **All Egg Timer work happens in its own session** (desktop shortcut *Egg Timer (Claude Code)*, resume word `continue_et`), not from the PLC root or another cartridge's session.
- **blank** — empty cartridge template for starting a new game.

## Working here
- Stay within the PLC arcade. Do **not** borrow themes from one cartridge for another
  (e.g. the Aquanaut's deep-sea theme) unless I explicitly say I'm working on that cartridge.
- The two-era rule above frees the **era/styling** of a cartridge, not its **subject
  matter** — an 80s-arcade treatment is always fair game; another cartridge's theme is not.

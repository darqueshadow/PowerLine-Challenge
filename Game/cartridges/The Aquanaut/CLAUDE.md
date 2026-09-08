# The Aquanaut — 🟢 ACTIVE

A deep-sea typing-defense game forked from Asteroid Command (the "Below the Black"
build). **In active development.** The full design and changelog live in
[`AQUANAUT_DESIGN.md`](AQUANAUT_DESIGN.md) — that file is the history; this one is
only the rules a session must not re-derive or violate.

## Structure
- Canonical entry is `The Aquanaut.html` at the cartridge root: it plays the sonar
  power-on intro, then redirects to `files/index.html`. **All game code lives under
  `files/`** — `files/script.js`, `files/core/{config,data,audio}.js`, `files/style.css`.
- There is **no `v2/` folder** — the former v2 build was flattened into `files/`.
- Run locally via a web server (`Start Dev Server.bat`, or `Play The Aquanaut.bat` for
  the fullscreen kiosk). CSV loading and all audio use `fetch`, which `file://` blocks.

## Standing rules — don't undo these
- **Both hubs route through `The Aquanaut.html` on purpose** (`Game/cat/disks.js`,
  `Game/core/submenu.js`). Pointing them back at `files/index.html` skips the intro and
  drops the game onto a redundant PRESS ENTER gate.
- **The launcher must not wipe `localStorage`.** It used to, which destroyed the Dive Log
  and — because storage is origin-scoped and the whole arcade shares one origin — also
  wiped Asteroid Command's saves. `launch-aquanaut.ps1` likewise must not delete the
  Chrome profile.
- **`config.js` `TIERS` is not authoritative.** It is deleted and rebuilt from CSV on
  every load; edits there are silently discarded. Depth/cone live in `TIER_DEPTH_BY_KEY`
  in `core/data.js`, keyed by tier slug — never by CSV row index.
- **Never animate `transform` in the `.sonar-spawn-in` keyframes.** CSS animations outrank
  the inline transform that positions the overlay each frame. The individual `scale:`
  property is *not* a substitute (it multiplies the inline translate — measured). The pop
  is driven from JS by appending `scale()` to the inline transform.
- **`_holoLcarsButton` is shared** — `heartbeat` routes through it. Don't "tidy" it.
- **`getCreatureType()` can return `null`** (holodeck filter fails closed). Guard callers.
- **Check line endings before a full-file rewrite; don't assume.** Measured 2026-09-08:
  every `.js`/`.html`/`.css` under `files/` is **LF** on disk, and so is `AQUANAUT_DESIGN.md`.
  The CRLF files are this one, and six `datasets/*.csv`. (`core.autocrlf=true` is set, so a
  *fresh clone* would check them out CRLF — which is why the old rule here said CRLF. It was
  wrong about this working tree.) `tr -dc '\r' < file | wc -c` settles it in one command.

## Working here
- The `files/datasets/*.csv` are the **source of truth** for game content: mirror them
  into the game exactly, drop anything removed from a CSV, and verify a save actually
  landed before trusting it. The `file://` fallback in `data.js` is a hand-mirrored copy —
  keep it in sync.
- This is its own cartridge — don't bleed the Aquanaut's deep-sea theme into other PLC
  cartridges, or borrow theirs into it.
- 🚫 **`Game/` is published to a public GitHub Pages site.** Never write memory files,
  handoffs, audit reports or scratch notes anywhere under this folder.

## Session memory
Not stored here (see above). The cartridge's memory store is
`~/.claude/projects/C--Users-darqu-OneDrive--PCL--Game-cartridges-The-Aquanaut/memory/`.
Resume the track by typing **`Continue_Aquanaut`**.

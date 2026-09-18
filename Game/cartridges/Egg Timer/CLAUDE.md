# Egg Timer *(formerly Whack A CAV)* — 🟢 LAUNCHED IN THE ARCADE 2026-09-17 (placeholder art, no instructions or audio yet)

A whack-a-mole typing game built on the real Niagara EMS **CAV (Conditional Availability)**
workflow. Each unit has a **nest** with a digital readout below it. The player places a CAV with
`CAV #### TYPE` and clears it with `RCAV ####` before the alien egg in that nest hatches. A clear
smooshes the egg. A hatch is a final escape that drains the **pool**, and an empty pool ends the
game. The styled "E" and "T" read as "ET", tying the name to the alien eggs.

**The design lives in [`EGG_TIMER_CONTEXT_PACKET.md`](EGG_TIMER_CONTEXT_PACKET.md), the source of truth.**
It is v3 with Chat's 2026-09-15 Addendum merged in (each merged change tagged *(Addendum)*), then the
2026-09-17 Draft 9 rulings (tagged *(Rulings, draft 9)*), with filing notes on what was checked. The current
Addendum draft verbatim, older drafts, `EGG_TIMER_RULINGS_DRAFT9.md` and earlier packets are in
`Previous Versions/`; the `WHACK_A_CAV_` names there are deliberate. This file holds only the rules
a session must not re-derive or break. Decision history lives in the memory store (below).

## Status
- **Andrew authorized and confirmed the build on 2026-09-16.** The first playable build is in `files/`.
- **Andrew lifted the `coming-soon` hold on 2026-09-17** ("a normal, selectable cartridge in the Arcade
  for all players"), knowing the art, the instruction/title/end screens and audio are still placeholders
  or missing. The hub entry is live in `Game/cat/disks.js`, and players get it on the next push to main.
- **The build questions D1, D2, D4, D5, D6 and C15 are settled** (Draft 9, 2026-09-17). Each switch in
  `files/core/config.js` is set to its ruling and the rigs assert it; the reasoning, the traps and the
  checks that pin them are in `docs/decisions.md` at the repo root.
- **Still open (packet §11):** only **D3**, the Developer Mode phrase (`devModePasswordHash`, ⏳, null
  denies every entry). Andrew gives Code the digest from `ET.plcDigest('PHRASE')`, never the phrase.
  When it arrives, set the hash, strike D3 in the packet, and change the rig checks labelled ⏳ D3.
- **A new build question** gets the same treatment: one ⏳ PENDING switch with a provisional value
  (never copied into the packet as a ruling), flagged to Chat, and then on the ruling: the switch, the
  packet item **and** the rig checks that assert the old value.
- **Design calls go through Chat, one at a time.** Code investigates, flags each finding in plain words
  ready to paste, and merges what comes back. Don't settle a design call in Code's pick-an-answer
  question box, and don't resolve an ambiguity in code: build it as a switch and flag it.
- **Investigate first** before touching anything shared (Fang Rock, the hub, other cartridges,
  conventions): read what's actually there.

## The build (`files/`)
- `index.html`, `style.css`, `script.js` (boot, screens, loop, keyboard), `favicon.svg`.
- `core/`: `config.js` (every number with its packet section, plus the build-question switches), `rules.js` (pure
  curves), `commands.js` (PowerLine parsing), `data.js`, `game.js` (the whole mechanic, **no DOM**: keep
  it that way), `art.js` (placeholder SVG), `mess.js`, `view.js`, `boxes.js` (Command Boxes + switcher),
  `devmode.js`.
- `datasets/cav_types.csv` is Andrew's table, kept as data; `cav_types_blank.csv` is the Blank Dataset
  Module, a Developer-Mode-only copy of the same seven types (D1). **Edit both** if the real table changes:
  the logic rig fails when they differ. Units come from the shared Data Sheet, `../../../datasets/AP_ENP_BSE/2. Units_Transports.csv`.
- **Rigs** (in this folder; `verify-*.mjs` never publishes):
  - `node verify-egg-timer-logic.mjs`: no server. Checks the curves against the packet's numbers and
    drives the game's states.
  - `node verify-egg-timer.mjs [shotsDir]`: headless Chrome via NB's `cdp.mjs`. Serve with
    `python -m http.server 8898` from the (PCL) root; `window.__et` drives the clock. Screenshots go
    to the scratchpad, never under `Game/`. Look at them, too: they caught layout bugs the checks missed.
- `?seed=N` replays a game exactly.
- **Developer Mode:** Ctrl+Shift+B (lowercase `b` too), then a timed password prompt, as in the other
  cartridges. On unlock, the next game uses the Blank Dataset Module (so far it plays like a normal game,
  since D1 made it a copy of the real types).
- ⚠️ **Esc in browser fullscreen:** the browser keeps Esc, so reclaim it with Keyboard Lock as The
  Aquanaut does (`lockEscapeKey` in its `files/script.js`). That only works in Chrome and Edge, and
  pausing on fullscreen exit would make Esc pause instead of closing an open switcher. Keys sent over
  the debugging connection may skip browser shortcuts, so a passing check isn't a real keypress.

## Launch (done 2026-09-17)
- `status: "coming-soon"` is gone from the `eggtimer` entry in `Game/cat/disks.js`. `verify-cat.mjs` has
  `"eggtimer"` in `CARTRIDGES` (§B), a `?cart=eggtimer` cabinet case (§K) and eggtimer in both
  "no cartridge in the DOM" selectors (§L cracked mode, §M inside Fang Rock). Run that rig (serve on 8899) after any hub change.
- `Game/` publishes to the public site on push to main. The deploy strips `*.md`, `*.cmd` and `verify-*.mjs`,
  so this file, the packet and `Previous Versions/` stay out of the site (the repo itself is public).
- ⚠️ Rigs that start browsers fail with "Chrome never opened a debug port" while another session's rig
  keeps the CPU at 100% (seen 2026-09-17 with `verify-c64.mjs`). It's load, not a failing check: wait and re-run.
- Not wired: the old cassette menu in `Game/index.html` (`Game/core/submenu.js`) doesn't list Egg Timer,
  which is Andrew's call; the Fang Rock room cabinet is the separate Rec-Bay 4 handoff.

## Locked design (summary; the packet has the detail)
- **Modes:** Clear CAVs Only (nests open one at a time), Follow Progression (one-phase for waves 1–2,
  then a placement chance of 0% at wave 3, +10% a wave), and Both. The mode buttons are the difficulty
  menu, and there's no dataset menu.
- **CAV data:** Andrew's durations for VS, STR, SS, EOS, MB and AD, plus VF's random 10–30 min.
  **1 real minute = 2 game-seconds**, one ratio, exact, never jittered. Transport units only. Readouts
  show the literal type code. The optional `, comment` is accepted. Every new CAV draws a **new random
  unit**, never one already showing on the board (D2).
- **Egg lifecycle:** the egg appears when a CAV starts and grows, for information only. **`RCAV` does
  nothing until the CAV's real duration has passed.** That floor stops place-then-instantly-clear, so
  don't loosen it. At that moment the readout goes bold, `RCAV` becomes valid and the egg starts
  cracking, as one event. A 5 s overtime window follows (jitter ±10% in wave 1, +5% a wave, cap ±35%),
  then the hatch. A hatch is final and the nest resets itself. **VF shows no egg and no timer**
  until "Clear Fuel" at the trigger. Its unit and "VF" stay visible (C15b).
- **Placement:** 10 points, with no penalty for waiting, but **an ignored trigger auto-opens** after
  20 s (−1 s a wave, floor 8 s) and starts its timer normally. A wrong code is rejected silently, whether
  nonsense or a real code that doesn't match the nest, and a rejected Enter leaves the text in the box (D6).
- **The timer** counts **up** in **game seconds** (VS bold at 00:20, EOS and MB at 01:00; D5) and keeps
  counting through overtime. The older "countdown" wording is retired.
- **Waves and pool:** 5 nests, +1 every 2 waves, cap 12. Adjacency is up/down/left/right on a
  **logical** grid under an organic on-screen layout (Code and Gemini pick the grid's size). A wave
  ends after a quota of resolved CAVs, cleared or hatched: 8, +2 a wave, and spawning stops once the
  quota has spawned (D4). The spawn gap is random, 5–7 s
  in wave 1, both ends −0.5 s a wave, floor 1 s, the same in every mode. A spawn due on a full board is
  skipped, not queued. The cleanup window is 5–10 s, −0.5 s a wave, floor 3 s. The pool starts at 3,
  loses 1 per escape only, gains 1 per zero-escape wave, cap 3; placeholder key `POOL`. **Only an empty
  pool ends the game.**
- **Scoring:** a clear is 100 at the trigger, falling linearly to 25 at the hatch; perfect-wave bonus
  50 × the wave number; no penalty for an escape or for mid-wave wiping.
- **Mess:** a smoosh dirties its own nest and its direct neighbours only, with no cap. Mess belongs to
  the nest. Wiping is click-and-drag.
- **Command Boxes:** 1–4, picked on the mode-selection screen, in all three modes, inside one page.
  Each box has its own colour. Staged text in an inactive box clears when a new wave starts. **F12**
  keeps its arcade-wide meaning: clear the active box, no penalty.
- **Keys:** **Tab** opens the switcher (no-op with 1 box). The boxes are its only entries, with
  previews. Tab/Shift+Tab or the arrows move, Enter confirms, Escape closes without switching. The
  game keeps running meanwhile. Tab's different job in The Aquanaut was ruled fine, and there's no
  suggestion list for v1. **Esc, and only Esc, pauses** (after closing an open switcher), the
  arcade-wide pause key. Other cartridges' alignment is their own sessions' work.
- **Platform:** must run in a plain browser tab as well as in Fang Rock (an Arcade cabinet,
  `fangrock://arcade/eggtimer`).
- **Deferred, not blocking:** creatures and splat/escape art (Gemini), VF's cue, the instruction, title
  and end screens (still required), the switcher's and boxes' look, and the pool's display name.

## Standing rules
- **It is a Standalone Cartridge** (Laws v2.0 amendment A1): **don't** copy `Game/blank/`, and **don't**
  use Target / Challenge / Impact Zone / Resource / TFS vocabulary or the falling-Target lifecycle.
  **Still binding:** Data Sheet integrity, Developer Mode on Ctrl+Shift+B, Demo/Publish modes, modular
  files, all repo work through Claude Code, and the PET Terminal belonging to the hub.
- 🚫 **Never invent CAV timings or type codes.** Anything not in the packet or the real Data Sheet
  comes from Andrew, never a guess.
- **Use the packet's own vocabulary:** nests, eggs, hatching, escape, the pool.
- **The hub id is `eggtimer`, letters only:** Fang Rock drops any cabinet token that isn't `^[a-z]+$`.
  The `Game/index.html` menu is Andrew's call. The room's cabinet is a separate Rec-Bay 4 handoff.
- It is its own cartridge: don't borrow another cartridge's theme, and don't push its conventions onto others.
- Folder names are Title Case with spaces, and GitHub Pages is case-sensitive: `Egg Timer` ≠ `egg-timer`.

## Working here
- Governance is on disk, outside `Game/`: `Documents/Core Documents/` (Laws → Overview → Build
  Procedure). Load it before implementing. 🚫 Don't quote Law/Overview §-numbers at Andrew.
- 🚫 **`Game/` is a public GitHub Pages site** and the repo is public. Never write memory files,
  handoffs, audit reports, decision logs or scratch notes anywhere under this folder.
- Run the game over `http://` (`Game/Start Dev Server.bat`, then `/cartridges/Egg%20Timer/files/index.html`).

## Session memory
Not stored here. The store is `~/.claude/projects/C--Users-darqu-OneDrive--PCL--Game-cartridges-Egg-Timer/memory/`.
Open it via the **Egg Timer (Claude Code)** desktop shortcut (`claude-et.cmd`) and resume with
**`continue_et`** (`continue_wac` still works). All Egg Timer work happens in that session.
⚠️ Auto-memory keys to the git root, so this session auto-loads the **PLC root** index. `continue_et`
means: read the store's `MEMORY.md` first (and any ⏸ one-shot handoff it lists), then `et-track.md`,
and read and write Egg Timer memories **there**.

## State 2026-09-17
Launched in the hub on Andrew's word, committed, **not pushed**, so players don't have it yet. Waiting on
Andrew for the D3 digest (until then Developer Mode denies every entry, on the live site too). Next, each a
design call through Chat: an instruction screen (players get none today), art direction, the title/end
screens, and audio.

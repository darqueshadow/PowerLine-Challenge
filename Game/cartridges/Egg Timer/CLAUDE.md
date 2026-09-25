# Egg Timer *(formerly Whack A CAV)* — 🟢 LIVE since 2026-09-19; every green build goes live

A whack-a-mole typing game built on the real Niagara EMS **CAV (Conditional Availability)**
workflow. Each unit has a **nest** with a digital readout below it. The player places a CAV with
`CAV #### TYPE` and clears it with `RCAV ####` before the alien egg in that nest hatches. A clear
smashes the egg. A hatch is a final escape that drains the **pool**, and an empty pool ends the
game. The styled "E" and "T" read as "ET", tying the name to the alien eggs.

**The design lives in [`EGG_TIMER_CONTEXT_PACKET.md`](EGG_TIMER_CONTEXT_PACKET.md), the source of truth.**
Every merged change is tagged by its source, with filing notes on top; Chat's handoffs verbatim and each earlier
packet are in `Previous Versions/` (the `WHACK_A_CAV_` names are deliberate). This file holds only the rules a
session must not re-derive or break. History: `docs/decisions.md` at the repo root, and the memory store (below).

## Status
- **Live since 2026-09-19** (hub entry in `Game/cat/disks.js`; NB's Rec-Bay 4 table fires).
- 🚀 **STANDING RULE (Andrew, 2026-09-23):** Andrew playtests through **Nerva Beacon (Rec-Bay 4)**, not localhost.
  After building anything for Egg Timer: **if BOTH rigs pass, commit and push to the live site right away. Never
  push with a failing rig.** Keep each change in its own commit(s) so any one can be reverted alone. **After each
  push, tell Andrew in one line what went live.** A push also publishes other sessions' commits on `main`: check
  `git log origin/main..main` and say so if anything besides Egg Timer is going out.
- **Open, all Andrew's:** **D3**, the Developer Mode phrase (`devModePasswordHash`, null denies every entry): Andrew
  gives Code the digest, never the phrase; then set the hash, strike D3 in the packet, and change the rig checks
  labelled ⏳ D3. **Walk him through it step by step in plain language** (Andrew, 2026-09-23): he types the phrase
  himself in his own terminal (`node make-dev-hash.mjs`, echo off, asked twice); Code only ever receives the code.
  Andrew will review the shared transport unit list himself: change nothing else in it.
- 🔒 **E17: no RCAV/syntax line in the how-to panel is Andrew's deliberate override of E10.** Don't "fix" it. (The
  RCAV hints E28 added live in the Command Lines, the tags and the comic strip, never in the panel.)
- **A new build question:** one ⏳ PENDING switch in `config.js`, flagged to Chat as the next E-number (**E42**; none open);
  on the ruling, change the switch, the packet item **and** the rig checks that assert the old value.
- **Design calls go through Chat, one at a time**, flagged in plain words ready to paste. Never settle one in a
  pick-an-answer box or silently in code: build it as a switch and flag it. If a pasted ruling arrives cut off,
  build what's whole and ask for the rest.
- **Investigate first** before touching anything shared (Fang Rock, the hub, other cartridges, conventions).

## The build (`files/`)
- `index.html`, `theme.css`, `style.css`, `script.js` (boot, screens, loop, keyboard, how-to panel, comic strip), `favicon.svg`.
- 🎨 **`theme.css` holds every colour**, the font stacks and the `@font-face`s; `style.css` holds none (rig section T
  fails on one). **Change a colour in `theme.css`.** NB's Egg Timer cabinet may read these tokens, so don't rename or
  drop one lightly. Section T resolves every rule against `verify-egg-timer-theme-baseline.mjs`: after a DELIBERATE
  style change, re-run with `--write-theme-baseline`, review which rules changed, and commit the baseline with it.
- `core/`: `config.js` (every number with its source, [T] = tunable, plus the build-question switches), `rules.js`
  (pure curves), `commands.js`, `data.js`, `game.js` (the whole mechanic, **no DOM**: keep it that way), `art.js`
  (placeholder SVG: nest, dishes, doodles, the clock), `audio.js`, `title.js`, `lights.js` (bulbs and the signs),
  `mess.js`, `view.js` (board, pan, hose, cord, lightning, Time Warp's sign and hands, the tags), `boxes.js`, `devmode.js`.
- **Two clocks in `game.js`:** `time` is the player's seconds (spawns, timeouts, overtime, cleanup);
  `clock` is displayed time at the wave's shared speed. Bold is decided on `clock`, overtime on `time`.
- **`snapshot().nests` lists only the nests in play**: find a nest by `id`, never by index.
- `datasets/cav_types.csv` is Andrew's table; `cav_types_blank.csv` is the Blank Dataset Module, a Developer-Mode-only
  copy of the same seven types (D1). **Edit both** if the real table changes: the logic rig fails when they differ.
  Units come from `../../../datasets/AP_ENP_BSE/2. Units_Transports.csv` (shared), read by its "Units" header; fewer
  than 12 different units refuses to start, saying why.
- **Rigs** (in this folder; `verify-*.mjs` never publishes):
  - `node verify-egg-timer-logic.mjs`: no server. Checks the curves and drives the game's states.
  - `node verify-egg-timer.mjs [shotsDir]`: headless Chrome via NB's `cdp.mjs` (`OneDrive/+Nerva Beacon/…/tools/`).
    Serve with `python -m http.server 8898` from the (PCL) root; `window.__et` drives the clock. Screenshots go to
    the scratchpad, never under `Game/`. **Look at them too**: they catch what the checks miss. Section L and
    `menuFit` measure every screen at 1920×1080, 1440×900, 1280×720, 1024×640.
  - 🚨 **Gate on both rigs' EXIT CODES** before a commit or push. `node rig | grep …` exits 0 on a FAIL.
  - The live page keeps stepping (and drawing, even paused) between checks: do a timed thing inside one `ev()`,
    pause it (Esc, or an Escape keydown dispatched in the same `ev()`), poll, or record at the event. Never a fixed
    `wait()` before a timed check. `__et.start(mode, boxes, { wallStart, types, rng })` plays one exact case.
  - CDP keys skip browser shortcuts: such cases are dispatched in-page; real keypresses are Andrew's to test.
- `?seed=N&clock=HH:MM` replays a game exactly (the wall clock otherwise starts at the player's time of day).
- **Developer Mode:** Ctrl+Shift+B (lowercase `b` too), then a timed password prompt; on unlock the next game uses the
  Blank Dataset Module. `node make-dev-hash.mjs` makes the digest (echo off; `make-*.mjs` never deploys).
- ⚠️ **Class names already taken:** never `error` (the title's `.error` caps width at 640px) and never `bubble` (VF's
  "Clear Fueling" bubble, hidden until shown; the strip uses `say`).
- Hub changes: run `verify-cat.mjs` (serve on 8899). "Chrome never opened a debug port" is CPU load: re-run.

## Locked design (summary; the packet has the detail)
- **Art direction: "juxtaposition":** a friendly family cartoon with a dark, twisted undertone. **Alien art:** scary
  alien, nothing human, **no red liquid** (blood, splatter, drips, pools) except the cord; red eyes and veins are fine.
- **Modes:** Clear CAVs Only, Follow Progression (one-phase for waves 1–2, then a placement chance of 0% at wave 3,
  +10% a wave), and Both. The mode buttons are the difficulty menu.
- **CAV data:** Andrew's durations (VS, STR, SS, EOS, MB, AD; VF random 10–30 min). **Say "displayed time" and
  "the player's seconds"** (E3). Clocks show displayed time, sped up, **one speed shared by every clock**; the real
  (Data Sheet) duration sets the bold mark exactly: never jitter it. Readouts show the literal type code. Transport
  units only, never one already on the board, no repeat in a wave until the pool is used; types from a **shuffle
  bag**, fresh each wave (E19, E20). The numbers and curves live in `config.js` with their sources.
- **Slot 0 art (pilot, 2026-09-25; ⏳ on branch `et-pilot-art-hold` until Andrew approves the screenshots):** the nest
  and egg are picture layers in `files/art/` (404 × 374, full viewBox; `make-pilot-art.py` rebuilds them from Andrew's
  `files/assets/imgages/`), the cracks vector. Each egg is mirrored 50/50 and ~1 in 6 has the eye (`rollEgg()` as it's
  laid); hints show from `eggHintsAt` (40 / eye 50 / 60 / 80%). Rig section Z checks the layers' pixel bounds and every
  state at the smallest and largest nests.
- **Egg lifecycle:** `laying` (the cord lowers the egg; **the clock starts at the pop**; no cord for VF, E16), then
  running. **`RCAV` does nothing until the CAV's real duration has passed**: that floor stops place-then-instantly-
  clear, so don't loosen it. Then bold, `RCAV` valid and the crack are one event; overtime (the player's seconds),
  then the hatch, final. **VF** hides egg and timer until "Clear Fueling". **Every AD shows a post-it**: "20 min", or
  "Clear @ HH:MM" against the wall clock, the next whole minute after start + draw (E1). The wall clock is **neon
  green** (`#39ff14`, no glow) in the bundled **DSEG7** face; fonts are OFL in `files/fonts/` with their licences.
- **Timer and Time Warp:** timers count **up** in displayed time, MM:SS, through overtime; the 24-hour wall clock is at
  the top centre. Once the wave's last CAV has *started* and no egg is bold, every clock runs 5× [T] until an egg goes
  bold (the step splits there; E18); overtime never warps. **E39:** it also runs while 2+ running eggs are each over 8:00 from bold (`warpFar`), never with an
  egg bold; the rigs run most scenes with that rule off. **Time Warp** (that name, E28) is a **grandfather clock** in
  the centre of the board, 17% of its height (about 27% is free between nests), hands spinning while it runs ("5×" on
  the face under reduced motion), over a "TIME WARP" sign and a caption. 🚨 The sign flashes 3 times as it kicks in,
  at most 2 a second (`setSign()`'s 0.25 s guard), then stays lit while its **letters wobble** (E31: a transform only,
  never a brightness change; no fast blink, the flash rule forbids it). Running nests glow green (E22) and green
  **lightning** chains to them under every readout; 🚨 it re-jags 2/s [T], guard-capped at 2.5 (`rejag()`).
- **Board lights (Chat, 2026-09-25):** one backmost layer (`#backdrop`, behind the cord, the bolts and the board) holds
  the board's faint tint (**lilac**, E32; mint and cream remain only as `?tint=` previews), white lights on the gameplay
  track's BPM (a placeholder until the music is in; the player's seconds: mute doesn't stop them, pause freezes them),
  and Time Warp's dark veil, a 0.5 s fade that can't touch anything in front of it. 🚨 Lights rise and fall once over
  8 beats, one start a beat at most, 3 at once, **5% white at most** (7% dropped the dim caption under 4.5:1); the veil
  changes at most once in 0.5 s. Reduced motion: no lights, the veil still fades.
- **Placement:** 10 points, no penalty for waiting, but **an ignored trigger auto-opens** after 20 s (−1 s a wave,
  floor 8 s). **Any rejected Enter** clears the line, shows a red ERROR under it for ~1 s and buzzes, with no score
  or pool penalty. An empty Enter does nothing (E6).
- **Waves and pool:** nests in play grow 5 → 12; **all 12 are on screen all game**, activating in a fixed spread-out
  order. A wave ends after its quota resolves; spawning stops once the quota has spawned (D4); a spawn due on a full
  board is skipped. Pool 3 (key `POOL`), −1 per escape, +1 for a wave with no escape (never above 3). **Only an empty
  pool ends the game.**
- **Scoring (E26):** a clear scores by **tier**, a fifth of that egg's own overtime window each: 100 / 75 / 50 / 35 / 25
  (`clearScoring: "tiers"`), plus a perfect-wave bonus; no penalty for an escape or wiping. **Never set tiers in
  displayed time** (they become unreachable). The tier also picks the clear's **break stage** and the waiting egg
  shows **alien hints** at 40/60/80% (both art, not built yet). The **egg ladder** is cosmetic (tier 1–2 clears).
  The frying pan is pure CSS and must never hold the keyboard.
- **Mess and hose:** a clear leaves a small splat on its own nest and drops the rest evenly over the board (E15); mess
  **covers readouts and post-its** (E14). Wiping is click-and-drag; **in-game the cursor is always the hose nozzle**.
  The hose draws above the board, below the Command Lines and the HUD bar. A **sink** by the tap carries the hose's
  words (E28). Cleanup banner: "CLEAN-UP TIME! <countdown>" / "Hose down the mess before the next wave." 🚨 It
  flashes at most 2 a second [T], guard-capped at 2.5 (`cleanupFlashSeconds()`).
- **Wave-1 tags (E28):** once a game: "Pink = ready! Type RCAV <unit>" (first bold egg) and "◀ Check the wall clock"
  (first "Clear @" note), either side of the wall clock with a dashed leader line under every readout; no flashing.
- **Readouts:** three cartoon boxes (unit, type, timer); at the limit all three go bold at once, timer white on the **ready pink** `#d1006a` (E33). 🎨 Every "ready / act now"
  pink uses `--readout-bold-timer-bg` (tag, strip chip, panel 2 badge); `--hot` and `--pink` are decoration only.
  Each fits its widest reading (rig section L). A nest in play with no CAV has its boxes darkened.
- **Command Lines** (players never see "Command Box", E7): 1–4, **2 by default**, picked with "How Many Command Lines?"
  (One–Four, each in its line's colour, the one picked lit; E29). An empty line says "RCAV + unit", or "CAV + unit +
  type" while a nest waits to be placed (E30), in grey at 0.8 size. Tab / F12 / Esc hints sit under the lines.
  **Tab / Shift+Tab** next / previous, text kept; **F12** next and clears the line it lands on (E13); with 1 line F12
  just clears it. The game pauses itself when the window loses focus. **Esc, and only Esc, pauses.**
- **How To Play:** a **five-panel comic strip** (E29) on the title card and the options screen (under HOW / TO / PLAY
  signs that light in turn, 🚨 at most 2 changes a second, all lit under reduced motion): number badges, no headings,
  the words in `TITLE_STEPS` as ruled. **The side panel is never in play** (E30); on the game-over screen it shows
  Goal and Esc. Panels are ringed by **arcade lights**: 🚨 every bulb change goes through `set()`'s 0.2 s guard
  (`lightsMinToggle`, never below 1/6 s); bulbs and doodles never over a word. The panel **never lists CAV durations**.
- **Title and options screens:** a singing mommy alien and babies, an ORIGINAL chiptune on both screens (E21), and a
  three-headed singing blob whose eyes follow the cursor on the options screen.
- **Horror beats:** the hatchling is horrific; a **scary mom face** pops in at most once a wave, under 1 s, over the HUD
  bar only (`momFaceZones: ["top"]` since E30), never over a nest, readout or Command Line, never taking input or flashing.
- **Reduced motion** stills the CSS loops, lights, lightning, place-me cue (steady cyan), overtime wobble, cord twitch,
  hatchling's legs, the signs, Time Warp's hands, flashes and wobble. **New motion must join that list** (rig section R).
- **Sound (E24/E25):** a mute button top left on every screen, and M (remembered per browser); in play M types, so the
  button and **Ctrl+M** mute. Every sound goes through `audio.js`'s one master chain: connect new sounds to `bus()`,
  never to the speakers directly (rig section A2). A background tab stops the title tune and holds every sound.
  **E35:** the sound context is made at boot, so the title track plays as the title appears where autoplay is allowed
  (Fang Rock); in a browser the first Enter or click on the title only starts it (E40, ruled), and until then the title's prompt
  reads PRESS ANY KEY (never in Fang Rock: it waits 0.3 s for autoplay behind LOADING…).
  **Music (Chat, 2026-09-25):** `files/audio/` (from `make-music.py`; Andrew's sources in the git-ignored `files/assets/`):
  the title track on the menus (shared), the gameplay loop in play, the game-over track once. 0.5 s fades on every
  change; Esc pauses and resumes; the loops are sample-exact (loop points in `config.js` = `music.json`). **E36:** every
  track plays at −19.8 LUFS (the other cartridges' median; `lufs` + `level` in `config.js`) and dips to 40% under
  THONG, the buzz and the hiss (`musicDuck`); small sounds ride under it. Re-measure with ebur128 if a file changes. Game over: TITLE SCREEN / PLAY AGAIN (TITLE SCREEN
  lit first, E34; Enter does nothing for 1 s [T] or on auto-repeat), and at the track's end it returns to the title.
  Laying an egg: a squeeze on the cord's last stretch, then a pop (Chat, 2026-09-25; synthesized, ±8% pitch, at most 2
  of each at once, kept under THONG, the buzz and the hiss: rig section S measures them offline).
- **Platform:** a plain browser tab, and Fang Rock (`fangrock://arcade/eggtimer`), which serves the arcade from the
  **local** `(PCL)/Game` folder, not GitHub Pages.
- **Deferred:** all final art (Gemini: brief slots 0–8, 13, 14, 16–20; Code restyles slots 9–12 and 15), final sounds,
  the end screen, the pool's display name.

## Standing rules
- 🚫 **Never send real keystrokes or mouse input to the desktop, and never open browser windows outside a sandboxed
  test harness, without Andrew's explicit go-ahead for that specific test** (Andrew, 2026-09-22). Hand tests go to
  Andrew as step-by-step instructions. The headless rigs are the sandboxed harness.
- **It is a Standalone Cartridge** (Laws v2.0 amendment A1): **don't** copy `Game/blank/`, and **don't** use Target /
  Challenge / Impact Zone / Resource / TFS vocabulary or the falling-Target lifecycle. **Still binding:** Data Sheet
  integrity, Developer Mode on Ctrl+Shift+B, Demo/Publish modes, modular files, all repo work through Claude Code,
  and the PET Terminal belonging to the hub.
- 🚫 **Never invent CAV timings or type codes.** Anything not in the packet or the real Data Sheet comes from Andrew.
- **Use the packet's own vocabulary:** nests, eggs, hatching, escape, the pool, Command Lines.
- **The hub id is `eggtimer`, letters only:** Fang Rock drops any cabinet token that isn't `^[a-z]+$`. The old
  cassette menu (`Game/index.html`, `Game/core/submenu.js`) doesn't list Egg Timer: Andrew's call.
- Its own cartridge: no other cartridge's theme. Folder names are Title Case with spaces, and GitHub Pages is
  case-sensitive: `Egg Timer` ≠ `egg-timer`.

## Working here
- Governance is on disk, outside `Game/`: `Documents/Core Documents/` (Laws → Overview → Build Procedure). Load it
  before implementing. 🚫 Don't quote Law/Overview §-numbers at Andrew.
- 🚫 **`Game/` is a public GitHub Pages site** and the repo is public; the deploy strips `*.md`, `*.cmd`,
  `verify-*.mjs` and `make-*.mjs`. Never write memory files, handoffs, audit reports, decision logs or scratch notes
  anywhere under this folder.
- Run the game over `http://` (`Game/Start Dev Server.bat`, then `/cartridges/Egg%20Timer/files/index.html`).

## Session memory
Not here: `~/.claude/projects/C--Users-darqu-OneDrive--PCL--Game-cartridges-Egg-Timer/memory/`, via the **Egg Timer
(Claude Code)** shortcut (`claude-et.cmd`). **`continue_et`** (or `continue_wac`) means: read that store's `MEMORY.md`
(and any ⏸ one-shot handoff it lists), then `et-track.md`, and write Egg Timer memories **there**. Auto-memory loads
the PLC root index instead, because it keys to the git root.

## State 2026-09-25
Everything is live on `main` through E32–E34 (Chat, 2026-09-25): board lights, lay sound, music, the legs' shuffle, the
ready pink, the game-over Enter guard. No E-item is open. The brief (`docs/Egg Timer art brief for Gemini.md`) is
**Code's build spec**: its 🔒 sections are Code/Andrew only, and Chat writes Gemini's prompts. Andrew's own
`files/assets/` (images, music sources) is git-ignored: not Code's to commit or rename.
**Held:** the Gemini pilot art (nest + egg, hints, the cord egg) and its art README are on branch `et-pilot-art-hold`,
waiting for Andrew's OK of `~/Downloads/Egg Timer pilot art - every state (updated).png`. On his OK: set that day as the
approval date in `files/art/README.md`, merge the branch into `main`, run both rigs, push (see the ⏸ handoff).
**Chat's E35–E40 (Andrew's playtest):** E35, E36, E37 built and live. E39 and E40 live too; the pilot art is live. **E38** (shell pieces, alien parts,
hose physics, trough; `core/pieces.js`) is **built and held** on `et-e38-hold`, waiting for Andrew's OK of
`~/Downloads/Egg Timer E38 - pieces, hose and trough.png`; on his OK merge it onto main, rigs, push.
**Next:** the art-slot batch. Left from the audit, by Andrew's choice: moving the JavaScript colours into `theme.css`,
dead code, and the other test gaps.

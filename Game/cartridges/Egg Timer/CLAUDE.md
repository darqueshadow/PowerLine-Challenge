# Egg Timer *(formerly Whack A CAV)* — 🟢 LIVE since 2026-09-19; every green build goes live

A whack-a-mole typing game built on the real Niagara EMS **CAV (Conditional Availability)**
workflow. Each unit has a **nest** with a digital readout below it. The player places a CAV with
`CAV #### TYPE` and clears it with `RCAV ####` before the alien egg in that nest hatches. A clear
smashes the egg. A hatch is a final escape that drains the **pool**, and an empty pool ends the
game. The styled "E" and "T" read as "ET", tying the name to the alien eggs.

**The design lives in [`EGG_TIMER_CONTEXT_PACKET.md`](EGG_TIMER_CONTEXT_PACKET.md), the source of truth.**
Every merged change is tagged by its source, with filing notes on top; Chat's rulings verbatim and each earlier
packet are in `Previous Versions/` (the `WHACK_A_CAV_` names are deliberate). This file holds only the rules a
session must not re-derive or break. History: `docs/decisions.md` at the repo root, and the memory store (below).

## Status
- **Live since 2026-09-19** (hub entry in `Game/cat/disks.js`; NB's Rec-Bay 4 table fires).
- 🚀 **STANDING RULE (Andrew, 2026-09-23):** Andrew playtests through **Nerva Beacon (Rec-Bay 4)**, not localhost.
  After building anything for Egg Timer: **if BOTH rigs pass, commit and push to the live site right away. Never
  push with a failing rig.** Keep each change in its own commit(s) so any one can be reverted alone. **After each
  push, tell Andrew in one line what went live.** A push also publishes other sessions' commits on `main`: check
  `git log origin/main..main` and say so if anything besides Egg Timer is going out. Work Andrew must see first
  (a screenshot sheet) waits on its own branch until he OKs it, then merges onto main.
- **Open, all Andrew's:** **D3**, the Developer Mode phrase (`devModePasswordHash`, null denies every entry): Andrew
  gives Code the digest, never the phrase; then set the hash, strike D3 in the packet, and change the rig checks
  labelled ⏳ D3. **Walk him through it step by step in plain language** (Andrew, 2026-09-23): he types the phrase
  himself in his own terminal (`node make-dev-hash.mjs`, echo off, asked twice); Code only ever receives the code.
  Andrew will review the shared transport unit list himself: change nothing else in it.
- 🔒 **E17: no RCAV/syntax line in the how-to panel is Andrew's deliberate override of E10.** Don't "fix" it. (The
  RCAV hints E28 added live in the Command Lines, the tags and the comic strip, never in the panel.)
- **A new build question:** one ⏳ PENDING switch in `config.js`, flagged to Chat as the next E-number (**E45**; none open);
  on the ruling, change the switch, the packet item **and** the rig checks that assert the old value.
- **Design calls go through Chat, one at a time**, flagged in plain words ready to paste. Never settle one in a
  pick-an-answer box or silently in code: build it as a switch and flag it. If a pasted ruling arrives cut off,
  build what's whole, file the partial block verbatim and ask for the rest.
- **Investigate first** before touching anything shared (Fang Rock, the hub, other cartridges, conventions).

## The build (`files/`)
- `index.html`, `theme.css`, `style.css`, `script.js` (boot, screens, loop, keyboard, how-to panel, comic strip), `favicon.svg`.
- 🎨 **`theme.css` holds every colour**, the font stacks and the `@font-face`s; `style.css` holds none (rig section T
  fails on one). **Change a colour in `theme.css`.** NB's Egg Timer cabinet copies some values by hand, so don't
  rename or drop one lightly. Section T resolves every rule against `verify-egg-timer-theme-baseline.mjs`: after a
  DELIBERATE style change, re-run with `--write-theme-baseline`, review which rules changed, and commit the baseline.
- `core/`: `config.js` (every number with its source, [T] = tunable, plus the build-question switches), `rules.js`
  (pure curves), `commands.js`, `data.js`, `game.js` (the whole mechanic, **no DOM**: keep it that way), `art.js`
  (placeholder SVG), `audio.js`, `title.js`, `lights.js`, `mess.js` (liquid), `pieces.js` (E38: pieces, push, drips,
  trough), `view.js` (board, pan, hose, cord, lightning, Time Warp, tags), `boxes.js`, `devmode.js`.
  `files/art/` holds the approved pilot layers (`make-pilot-art.py` rebuilds them; provenance in its README).
- **Two clocks in `game.js`:** `time` is the player's seconds (spawns, timeouts, overtime, cleanup);
  `clock` is displayed time at the wave's shared speed. Bold is decided on `clock`, overtime on `time`.
- **`snapshot().nests` lists only the nests in play**: find a nest by `id`, never by index.
- `datasets/cav_types.csv` is Andrew's table; `cav_types_blank.csv` is the Blank Dataset Module, a Developer-Mode-only
  copy of the same seven types (D1). **Edit both** if the real table changes: the logic rig fails when they differ.
  Units come from `../../../datasets/AP_ENP_BSE/2. Units_Transports.csv` (shared), read by its "Units" header.
- **Rigs** (in this folder; `verify-*.mjs` never publishes):
  - `node verify-egg-timer-logic.mjs`: no server. Checks the curves and drives the game's states.
  - `node verify-egg-timer.mjs [shotsDir]`: headless Chrome via NB's `cdp.mjs` (`OneDrive/+Nerva Beacon/…/tools/`).
    Serve with `python -m http.server 8898` from the (PCL) root; `window.__et` drives the clock. Screenshots go to
    the scratchpad, never under `Game/`. **Look at them too**: they catch what the checks miss. Every screen is
    measured at 1920×1080, 1440×900, 1280×720, 1024×640. A first-load timeout ("__et is not defined") is CPU load: re-run.
  - 🚨 **Gate on both rigs' EXIT CODES** before a commit or push. `node rig | grep …` exits 0 on a FAIL.
  - The live page keeps stepping (and drawing, even paused) between checks: do a timed thing inside one `ev()`,
    pause it (Esc, or an Escape keydown dispatched in the same `ev()`), poll, or record at the event. Never a fixed
    `wait()` before a timed check. `__et.start(mode, boxes, { wallStart, types, rng })` plays one exact case.
  - Most scenes run with E39's early warp off (`withoutFarWarp()` / `farWarpOff()`): long eggs would warp them.
  - CDP keys skip browser shortcuts: such cases are dispatched in-page; real keypresses are Andrew's to test.
  - ⚠️ `getBoundingClientRect()` includes each nest's 0.4 s unlock scale: size nothing from it mid-unlock
    (`boardBox()` in `pieces.js` undoes it).
- `?seed=N&clock=HH:MM` replays a game exactly; `?tint=` previews the unused board tints.
- **Developer Mode:** Ctrl+Shift+B (lowercase `b` too), then a timed password prompt; on unlock the next game uses the
  Blank Dataset Module. `node make-dev-hash.mjs` makes the digest (echo off; `make-*.mjs` never deploys).
- ⚠️ **Class names already taken:** never `error` (the title's `.error` caps width at 640px) and never `bubble` (VF's).
- Hub changes: run `verify-cat.mjs` (serve on 8899). "Chrome never opened a debug port" is CPU load: re-run.

## Locked design (summary; the packet has the detail and the numbers)
- **Art direction: "juxtaposition":** a friendly family cartoon with a dark, twisted undertone. **Alien art:** scary
  alien, nothing human, **no red liquid** (blood, splatter, drips, pools) except the cord; red eyes and veins are fine.
  Slot 0 (nest + egg) is Gemini's approved pilot art (live 2026-09-25): each egg mirrored 50/50, ~1 in 6 with the eye,
  alien hints from 40 / 50 / 60 / 80%; the cord's egg is the nest's own egg. The rest of the art is still placeholder.
- **Modes:** Clear CAVs Only, Follow Progression (one-phase for waves 1–2, then a placement chance of 0% at wave 3,
  +10% a wave), and Both. The mode buttons are the difficulty menu.
- **CAV data:** Andrew's durations (VS, STR, SS, EOS, MB, AD; VF random 10–30 min). **Say "displayed time" and
  "the player's seconds"** (E3). Clocks show displayed time, **one speed shared by every clock**; the real (Data Sheet)
  duration sets the bold mark exactly: never jitter it. Readouts show the literal type code. Transport units only,
  never one already on the board, no repeat in a wave until the pool is used; types from a **shuffle bag** (E19, E20).
- **Egg lifecycle:** `laying` (the cord lowers the egg; **the clock starts at the pop**; no cord for VF, E16), then
  running. **`RCAV` does nothing until the CAV's real duration has passed**: don't loosen that floor. Then bold,
  `RCAV` valid and the crack are one event; overtime (the player's seconds), then the hatch, final: **no pan, no
  THONG on a hatch** (E37). **VF** hides egg and timer until "Clear Fueling". **Every AD shows a post-it** ("20 min" or
  "Clear @ HH:MM" against the wall clock, E1). The wall clock is **neon green** `#39ff14`, no glow, in **DSEG7**.
- **Time Warp:** every clock runs 5× [T] once the wave's last CAV has *started* and no egg is bold (E18), and also
  while 2+ running eggs are each over 8:00 from bold (E39, `warpFar`; allowed while a placement waits); never with an
  egg bold; the step splits exactly where it ends; overtime never warps. A **grandfather clock** in the board's centre
  over a "TIME WARP" sign and caption (E27, E28). 🚨 The sign flashes 3 times at most 2 a second (`setSign()`'s 0.25 s
  guard), then stays lit while its **letters wobble** (E31: a transform, never a brightness change). Running nests glow
  (E22) and green **lightning** chains to them; 🚨 it re-jags 2/s, guard-capped at 2.5 (`rejag()`). **E43:** a rising
  zap as it starts, a falling one as it ends, nothing while it runs (`ET.audio.warp()`, fired from `paintSign()`).
- **Board lights:** `#backdrop`, behind everything on the board: the **lilac** tint (E32), white lights on the gameplay
  track's BPM (🚨 5% white at most, one start a beat, 3 at once) and Time Warp's dark veil (a 0.5 s fade).
- **Placement:** 10 points, no penalty for waiting, but **an ignored trigger auto-opens** after 20 s (−1 s a wave,
  floor 8 s). **Any rejected Enter** clears the line, shows a red ERROR for ~1 s and buzzes, no penalty (E6).
- **Waves and pool:** nests in play grow 5 → 12; **all 12 are on screen all game**. A wave ends after its quota
  resolves; spawning stops once the quota has spawned (D4); a spawn due on a full board is skipped. Pool 3 (key
  `POOL`), −1 per escape, +1 for a wave with no escape (max 3). **Only an empty pool ends the game.**
- **Scoring (E26):** a clear scores by **tier**, a fifth of that egg's own overtime window each: 100 / 75 / 50 / 35 / 25,
  plus a perfect-wave bonus; no penalty for an escape or wiping. **Never set tiers in displayed time.** The tier is the
  clear's **break stage** (E38's alien parts at 3–5). The **egg ladder** is cosmetic (tier 1–2 clears).
- **Mess, pieces, hose and trough:** a clear leaves a small splat on its own nest and drops the rest over the board
  (E15); liquid **covers readouts and post-its** (E14). Every clear also throws **shell pieces** cut from the egg
  picture, plus alien parts at break stages 3–5 (E38): they sit behind the nests, pile round the readouts, never fade
  and carry into the next wave. **In-game the cursor is always the hose nozzle** (E44: drawn by view.js, the system cursor
  hidden, turned about its tip to point where the jet goes: a swing, a wobble ignored, up-left at each game's start). A drag **pushes pieces** the way it
  goes (they slide, tumble, settle) and **streaks and thins liquid** (E42: a blast, not a trickle: a thick jet with a burst, mist and a
  splash, pushing what it reaches; one sweep carries a piece into the trough; ~2 passes wash liquid; a pressure-washer
  sound under the music); liquid pushed to the top drips back down, and a
  piece in it rides the drip. A thin **trough** on the left, right and bottom edges (none on top) runs to the drain
  under the sink; a piece in it squelches and drains (an eye "bloops"). Resting pieces are baked (a pile costs nothing).
  Cleanup is a timed window with a countdown; nothing is counted (E41). 🚨 The cleanup banner flashes at most 2 a
  second, guard-capped at 2.5 (`cleanupFlashSeconds()`). The hose tag sits just above the trough, by the sink (E28).
- **Wave-1 tags (E28):** once a game: "Pink = ready! Type RCAV <unit>" and "◀ Check the wall clock"; no flashing.
- **Readouts:** three cartoon boxes (unit, type, timer); at the limit all three go bold at once, the timer white on the
  **ready pink** `#d1006a` (E33). 🎨 Every "ready / act now" pink uses `--readout-bold-timer-bg`; `--hot` and `--pink`
  are decoration only. Each box fits its widest reading. A nest in play with no CAV has its boxes darkened.
- **Command Lines** (players never see "Command Box", E7): 1–4, **2 by default** (E29). An empty line says "RCAV +
  unit", or "CAV + unit + type" while a nest waits (E30). **Tab / Shift+Tab** next / previous, text kept; **F12** next
  and clears the line it lands on (E13). The game pauses when the window loses focus. **Esc, and only Esc, pauses.**
- **How To Play:** a **five-panel comic strip** (E29) on the title card and the options screen; **the side panel is
  never in play** (E30). 🚨 The HOW / TO / PLAY signs change at most 2 times a second; every arcade bulb change goes
  through `set()`'s 0.2 s guard (`lightsMinToggle`, never below 1/6 s); bulbs and doodles never over a word; it never
  lists CAV durations.
- **Screens:** title (singing mommy alien and babies; the prompt reads PRESS ANY KEY until a browser's first press, E40),
  options (a three-headed singing blob), game over (TITLE SCREEN lit first; Enter ignored for 1 s and on auto-repeat,
  E34; the track's end returns to the title). **Horror beats:** a horrific hatchling; a **scary mom face** at most once
  a wave, under 1 s, over the HUD bar only, never taking input or flashing.
- **Reduced motion** stills the CSS loops, lights, lightning, place-me cue, overtime wobble, cord twitch, hatchling's
  legs, signs, Time Warp's hands and wobble, the pieces' tumble and the trough's water. **New motion must join it** (rig R).
- **Sound (E24/E25):** a mute button top left on every screen, and M (remembered); in play the button and **Ctrl+M**.
  Every sound goes through `audio.js`'s one master chain: connect new sounds to `bus()` (rig A2). A background tab
  holds every sound. The sound context is made at boot (E35): Fang Rock plays the title music at once, a browser on the
  first press. **Music** (`files/audio/`, from `make-music.py`): title track on the menus, gameplay loop in play, the
  game-over track once; 0.5 s fades; sample-exact loops. **E36:** every track at −19.8 LUFS (`lufs` + `level`; re-measure
  with ebur128 if a file changes), dipping to 40% under THONG, the buzz and the hiss. The lay squeeze and pop, the
  trough's squelch and bloop share one overlap cap and sit under those cues (rig S).
- **Platform:** a plain browser tab, and Fang Rock (`fangrock://arcade/eggtimer`), which serves the arcade from the
  **local** `(PCL)/Game` folder, not GitHub Pages.
- **Deferred:** the rest of the art (Gemini: brief slots 1–8, 13, 14, 16–20; Code restyles 9–12 and 15), final
  sounds, the end screen, the pool's display name.

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
  case-sensitive: `Egg Timer` ≠ `egg-timer`. Nerva Beacon's repo is never pushed (commit only there).

## Working here
- Governance is on disk, outside `Game/`: `Documents/Core Documents/` (Laws → Overview → Build Procedure). Load it
  before implementing. 🚫 Don't quote Law/Overview §-numbers at Andrew.
- 🚫 **`Game/` is a public GitHub Pages site** and the repo is public; the deploy strips `*.md`, `*.cmd`,
  `verify-*.mjs` and `make-*.mjs`. Never write memory files, handoffs, audit reports, decision logs or scratch notes
  anywhere under this folder. Andrew's `files/assets/` (source images, music) is git-ignored: not Code's to commit.
- Run the game over `http://` (`Game/Start Dev Server.bat`, then `/cartridges/Egg%20Timer/files/index.html`).
- Patch scripts: files come back CRLF after a git checkout, so match line endings per file.

## Session memory
Not here: `~/.claude/projects/C--Users-darqu-OneDrive--PCL--Game-cartridges-Egg-Timer/memory/`, via the **Egg Timer
(Claude Code)** shortcut (`claude-et.cmd`). **`continue_et`** (or `continue_wac`) means: read that store's `MEMORY.md`
(and any ⏸ one-shot handoff it lists), then `et-track.md`, and write Egg Timer memories **there**. Auto-memory loads
the PLC root index instead, because it keys to the git root.

## State 2026-09-25 (parked)
Everything is live on `main` through E41 (`1e9ce84`): E32–E41, the pilot art, E38's pieces and trough. Nothing is held,
no E-item is open. Andrew owes two hand tests (Fang Rock's title music, and holding Enter at Game Over). **Next:** the
art-slot batch as Gemini's art arrives (the brief, `docs/Egg Timer art brief for Gemini.md`, is Code's build spec: its
🔒 sections are Code/Andrew only; Chat writes Gemini's prompts). Left from the audit, by Andrew's choice: moving the
JavaScript colours into `theme.css`, dead code, and the other test gaps.

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
- 🚀 **STANDING RULE (Andrew, 2026-09-23; replaces every earlier "no push until Andrew approves" line):**
  Andrew playtests Egg Timer through **Nerva Beacon (Rec-Bay 4)**, not localhost. After building anything for
  Egg Timer: **if BOTH rigs pass, commit and push to the live site right away. Never push with a failing rig.**
  Keep each change in its own commit(s) so any one can be reverted alone. **After each push, tell Andrew in one
  line what went live.** A push also publishes other sessions' commits on `main`: check `git log origin/main..main`
  and say so if anything besides Egg Timer is going out.
- **Open, all Andrew's:** **D3**, the Developer Mode phrase (`devModePasswordHash`, null denies every entry): Andrew gives Code the
  digest, never the phrase; then set the hash, strike D3 in the packet, and change the rig checks labelled ⏳ D3.
  **When he does it, walk him through it step by step in plain language** (Andrew, 2026-09-23): he types the phrase
  himself in his own terminal (`node make-dev-hash.mjs`, echo off, asked twice); Code only ever receives the code.
  Andrew will review the shared transport unit list himself: change nothing else in it.
- 🔒 **E17: no RCAV/syntax line in the how-to panel is Andrew's deliberate override of E10** (the Goal line is
  enough for dispatchers). Don't "fix" it.
- **A new build question:** one ⏳ PENDING switch in `config.js`, flagged to Chat as the next E-number (**E28**);
  on the ruling, change the switch, the packet item **and** the rig checks that assert the old value.
- **Design calls go through Chat, one at a time**, flagged in plain words ready to paste. Never settle one in a
  pick-an-answer box or silently in code: build it as a switch and flag it.
- **Investigate first** before touching anything shared (Fang Rock, the hub, other cartridges, conventions).

## The build (`files/`)
- `index.html`, `theme.css`, `style.css`, `script.js` (boot, screens, loop, keyboard, how-to panel), `favicon.svg`.
- 🎨 **`theme.css` holds every colour** (108 named tokens), the font stacks and the `@font-face`s; `style.css` holds
  none (rig section T fails on one). **Change a colour in `theme.css`.** NB's Egg Timer cabinet may read these tokens,
  so don't rename or drop one lightly. Section T also resolves every rule against `verify-egg-timer-theme-baseline.mjs`:
  after a DELIBERATE style change, re-run with `--write-theme-baseline` and commit the new baseline with the change.
- `core/`: `config.js` (every number with its source, [T] = tunable, plus the build-question switches),
  `rules.js` (pure curves), `commands.js` (PowerLine parsing), `data.js`, `game.js` (the whole mechanic,
  **no DOM**: keep it that way), `art.js` (placeholder SVG, the ladder's dishes), `audio.js` (placeholder
  Web Audio, the title tune), `title.js` (title scene), `mess.js`, `view.js` (board, pan, hose, cord),
  `boxes.js` (the Command Lines), `devmode.js`.
- **Two clocks in `game.js`:** `time` is the player's seconds (spawns, timeouts, overtime, cleanup);
  `clock` is displayed time at the wave's shared speed. Bold is decided on `clock`, overtime on `time`.
- `datasets/cav_types.csv` is Andrew's table; `cav_types_blank.csv` is the Blank Dataset Module, a
  Developer-Mode-only copy of the same seven types (D1). **Edit both** if the real table changes: the logic
  rig fails when they differ. Units come from `../../../datasets/AP_ENP_BSE/2. Units_Transports.csv` (shared). It is read by its
  "Units" header; a sheet with fewer than 12 different units (one per nest) refuses to start, saying why.
- **Rigs** (in this folder; `verify-*.mjs` never publishes):
  - `node verify-egg-timer-logic.mjs`: no server. Checks the curves and drives the game's states.
  - `node verify-egg-timer.mjs [shotsDir]`: headless Chrome via NB's `cdp.mjs`. Serve with
    `python -m http.server 8898` from the (PCL) root; `window.__et` drives the clock. Screenshots go to the
    scratchpad, never under `Game/`. **Look at them too**: they have caught layout bugs the checks missed.
    Section L measures the layout and the readouts' widest readings at 1920×1080, 1440×900, 1280×720, 1024×640.
  - 🚨 **Gate on both rigs' EXIT CODES** before a commit or push. `node rig | grep …` exits 0 on a FAIL.
  - The live page keeps stepping in real time between checks: pause it (Esc), poll for anything timed, do the
    whole thing inside one `ev()` (nothing runs in between), or record the moment at its event by wrapping
    `ET.view.handle`. Never a fixed `wait()` before a timed check. `__et.start(mode, boxes, { wallStart, types, rng })`
    plays out one exact case (rig-only).
  - CDP keys skip browser shortcuts: such cases are dispatched in-page; real keypresses are Andrew's to test.
- `?seed=N&clock=HH:MM` replays a game exactly (the wall clock otherwise starts at the player's time of day).
- **Developer Mode:** Ctrl+Shift+B (lowercase `b` too), then a timed password prompt. On unlock the next game
  uses the Blank Dataset Module. `node make-dev-hash.mjs` makes the digest in a terminal (echo off, prints
  only the digest; `make-*.mjs` is excluded from the deploy).
- ⚠️ **Never name a game element's class `error`:** the title screen's `.error` rule caps width at 640px.
- Hub changes: run `verify-cat.mjs` (serve on 8899). "Chrome never opened a debug port" is CPU load: re-run.

## Locked design (summary; the packet has the detail)
- **Art direction: "juxtaposition":** a friendly family cartoon with a dark, twisted undertone.
- **Modes:** Clear CAVs Only (nests open one at a time), Follow Progression (one-phase for waves 1–2, then a
  placement chance of 0% at wave 3, +10% a wave), and Both. The mode buttons are the difficulty menu.
- **CAV data:** Andrew's durations (VS, STR, SS, EOS, MB, AD; VF random 10–30 min). **Say "displayed time" and
  "the player's seconds"** (E3). Clocks show displayed time, sped up, **one speed shared by every clock**; the
  real (Data Sheet) duration sets the bold mark exactly: never jitter it. Readouts show the literal type code.
  Transport units only, never one already on the board, no repeat in a wave until the pool is used; types from
  a **shuffle bag**, fresh each wave (E19, E20). The numbers and curves live in `config.js` with their sources.
- **Egg lifecycle:** `laying` (the cord lowers the egg; **the clock starts at the pop**; no cord for VF, E16),
  then running. **`RCAV` does nothing until the CAV's real duration has passed**: that floor stops
  place-then-instantly-clear, so don't loosen it. Then bold, `RCAV` valid and the crack are one event; overtime
  (the player's seconds) then the hatch, final. **VF** hides egg and timer until "Clear Fueling". **Every AD shows a post-it**: "20 min", or
  "Clear @ HH:MM" against the wall clock, the next whole minute after start + draw (E1). The wall clock is
  **neon green** (`#39ff14`, no glow; not Time Warp's mint) in the bundled **DSEG7** LED face; the clock note's HH:MM
  mirrors it exactly, its "Clear @" is cream **Fredoka** on dark charcoal; the "N min" note is a yellow post-it in
  Patrick Hand. All fonts OFL, in `files/fonts/` with their licence `.txt` (the deploy publishes those).
- **Timer:** counts **up** in displayed time, MM:SS, through overtime. The 24-hour **wall clock** is at the top
  centre; the **Time Accelerator** (E27: players never see "Time Warp"; the code says `warp`) is a **grandfather clock**
  in the **centre of the board** (the middle row sits two a side for it), its hands spinning while it runs ("5×" on the
  face under reduced motion), sized 23% of the board's height so it clears every nest. Once
  the wave's last CAV has *started* and no egg is bold, every clock runs 5× [T] until an egg goes bold (the step
  splits there; E18); overtime never warps. Meanwhile only nests with a running clock glow green (E22) and green
  **lightning** chains to them under every readout. 🚨 It re-jags 2/s [T], guard-capped at 2.5 (`rejag()`), still
  under reduced motion; keep rig section P's flicker checks passing.
- **Placement:** 10 points, no penalty for waiting, but **an ignored trigger auto-opens** after 20 s (−1 s a
  wave, floor 8 s). **Any rejected Enter** clears the Command Line, shows a red ERROR under it for ~1 s and
  buzzes, with no score or pool penalty. An empty Enter does nothing (E6).
- **Waves and pool:** nests in play grow 5 → 12; **all 12 are on screen all game**, activating in a fixed
  spread-out order on a logical 4 × 3 grid. A wave ends after its quota resolves; spawning stops once the quota
  has spawned (D4); a spawn due on a full board is skipped; the shrinking spawn gap stacks with the clock
  speed-up. Pool 3 (key `POOL`), −1 per escape, +1 for a wave with no escape (never above 3). **Only an empty pool ends the game.**
- **Scoring (E26):** a clear scores by **tier**, each a fifth of that egg's own overtime window: 100 / 75 / 50 / 35 / 25
  (`clearScoring: "tiers"`), plus a perfect-wave bonus; no penalty for an escape or wiping. **Never set tiers in
  displayed time**: at 30–60 displayed s a player second they become unreachable. The tier also picks the clear's
  **break stage** (1 elegant … 5 alien), and the waiting egg shows **alien hints** at tiers 3–5 (art, not built yet).
  **Alien art:** scary alien, nothing human, no red except the cord.
  The frying pan is pure CSS and must never hold the keyboard. The **egg ladder** is cosmetic (tier 1–2 clears serve fancier dishes; a slower clear, any ERROR or a hatch resets it).
- **Mess and hose:** a clear leaves a small splat on its own nest and drops the rest evenly over the whole board
  (on whichever nest or floor it lands); no neighbour targeting (E15), no cap; mess belongs to the nest and
  **covers its readout and post-it** (E14). Wiping is click-and-drag. **In-game the cursor is always the hose
  nozzle** (menus keep the pointer). The hose and its water draw **above the whole board**, below the how-to
  panel, the Command Lines and the HUD bar. Water only while dragging; a tag labels the tap.
- **Readouts:** three cartoon boxes (unit white/blue, type grey/black, timer yellow/purple); at the limit all three
  go bold at once, unit dark green, timer hot pink/white. Each fits its widest reading (rig section L). A nest in
  play with no CAV has its boxes darkened ("not in play").
- **How-to panel** **is** the instruction screen (E10) and **never lists CAV durations**. Lines: Goal, Switch,
  F12, Esc, Cleanup, plus Place in Both and Follow Progression (E8); no syntax line (E17, 🔒). It shows on
  **every screen but the title** (`placeHowTo()` moves the one element), with turning doodles that never touch
  a word, ringed by **arcade attract lights** (`core/lights.js`): lively on menus, a dim twinkle in play.
  🚨 **No light or group over 3 flashes a second:** every bulb change goes through `set()`'s 0.2 s guard
  (`lightsMinToggle`, never below 1/6 s); keep the rig's flash checks passing. Bulbs never behind a word.
  🚨 The **cleanup banner** flashes at most 2 a second [T], guard-capped at 2.5 (`cleanupFlashSeconds()` in `view.js`).
  **Reduced motion** stills the CSS loops, the lights, the lightning, the place-me cue (steady cyan), the overtime
  wobble, the cord twitch and the hatchling's legs (rig section R), the HOW / TO / PLAY signs and the Accelerator
  clock's hands (E27); new motion must join that list.
- **Command Lines** (players never see "Command Box", E7; the code says boxes): 1–4, picked on the
  mode-selection screen, each its own colour; staged text in an inactive line clears when a wave starts.
  **Tab / Shift+Tab** next / previous line, text kept; **F12** next line and clears the line it lands on (E13);
  with 1 line, F12 just clears it. The active line pulses; the game pauses itself when the window loses focus.
  **Esc, and only Esc, pauses.**
- **Title screen:** its own **How To Play card** (five numbered steps, `TITLE_STEPS`, step 5 the Time Accelerator, E27;
  Andrew may reword), a
  singing mommy alien and babies, and an ORIGINAL chiptune (`titleTune`) on the title and mode-selection
  screens (E21). The **mode-selection screen** has a three-headed singing blob whose eyes follow the cursor, and
  a bigger how-to panel under **HOW / TO / PLAY signs** (E27): one word at a time, then all three; 🚨 at most 2 changes a
  second (`ET.lights.signs`' 0.5 s guard), all lit under reduced motion.
- **Horror beats (Refinement 5):** the hatchling is horrific; a **scary mom face** pops in at most once a wave,
  under 1 s, only inside a clipping box over the HUD bar or the how-to panel (covering either briefly is fine,
  E23), so it can never reach a nest, readout or Command Line (rig section Q). Never let it take input or flash.
- **Sound (E24):** a mute button top left on every screen, and M, remembered per browser. **E25 (ruled):** while a
  Command Line has the keys M types (MB); there the button and **Ctrl+M** mute (`muteKeyInPlay: "ctrl-m"`). Every sound goes through `audio.js`'s one master chain (a level, then a
  soft ceiling under full scale, so nothing clips): make any new sound connect to `bus()`, never to the speakers
  directly (rig section A2 fails on a second route). A background tab stops the title tune and holds every sound.
- **Platform:** a plain browser tab, and Fang Rock (`fangrock://arcade/eggtimer`, in the hub's frame), which
  serves the arcade from the **local** `(PCL)/Game` folder, not GitHub Pages.
- **Deferred:** creature, splat, dish and escape art, and every final look and sound (Gemini); the end screen
  and the rest of the title screen; the pool's display name.

## Standing rules
- 🚫 **Never send real keystrokes or mouse input to the desktop, and never open browser windows outside a
  sandboxed test harness, without Andrew's explicit go-ahead for that specific test** (Andrew, 2026-09-22).
  Hand tests go to Andrew as step-by-step instructions instead. The headless rigs are the sandboxed harness.
- **It is a Standalone Cartridge** (Laws v2.0 amendment A1): **don't** copy `Game/blank/`, and **don't** use
  Target / Challenge / Impact Zone / Resource / TFS vocabulary or the falling-Target lifecycle. **Still
  binding:** Data Sheet integrity, Developer Mode on Ctrl+Shift+B, Demo/Publish modes, modular files, all
  repo work through Claude Code, and the PET Terminal belonging to the hub.
- 🚫 **Never invent CAV timings or type codes.** Anything not in the packet or the real Data Sheet comes
  from Andrew.
- **Use the packet's own vocabulary:** nests, eggs, hatching, escape, the pool, Command Lines.
- **The hub id is `eggtimer`, letters only:** Fang Rock drops any cabinet token that isn't `^[a-z]+$`.
  The old cassette menu (`Game/index.html`, `Game/core/submenu.js`) doesn't list Egg Timer: Andrew's call.
- Its own cartridge: no other cartridge's theme, and its conventions aren't pushed onto others. Folder names are
  Title Case with spaces, and GitHub Pages is case-sensitive: `Egg Timer` ≠ `egg-timer`.

## Working here
- Governance is on disk, outside `Game/`: `Documents/Core Documents/` (Laws → Overview → Build Procedure).
  Load it before implementing. 🚫 Don't quote Law/Overview §-numbers at Andrew.
- 🚫 **`Game/` is a public GitHub Pages site** and the repo is public; the deploy strips `*.md`, `*.cmd`,
  `verify-*.mjs` and `make-*.mjs`. Never write memory files, handoffs, audit reports, decision logs or
  scratch notes anywhere under this folder.
- Run the game over `http://` (`Game/Start Dev Server.bat`, then `/cartridges/Egg%20Timer/files/index.html`).

## Session memory
Not here: `~/.claude/projects/C--Users-darqu-OneDrive--PCL--Game-cartridges-Egg-Timer/memory/`, via the **Egg
Timer (Claude Code)** shortcut (`claude-et.cmd`). **`continue_et`** (or `continue_wac`) means: read that store's
`MEMORY.md` (and any ⏸ one-shot handoff it lists), then `et-track.md`, and write Egg Timer memories **there**.
Auto-memory loads the PLC root index instead, because it keys to the git root.

## State 2026-09-24
**Next:** Andrew takes the art brief (`docs/Egg Timer art brief for Gemini.md` at the repo root) to Chat for review,
then the Gemini pilot (nest + egg, now with E26's three alien hints); the art-slot layer that hooks the files up is the
code batch after that, and it also shows E26's break stages (the `cleared` event's `tier`) and the hints (at 40/60/80% of
the window). **Open for Chat:** do the hatchling's red eyes and the mom face's red veins break "no red except the cord"?
Left from the audit, by Andrew's choice: the art-slot layer, moving the JavaScript colours into `theme.css`, dead code,
and the other test gaps.

# Egg Timer *(formerly Whack A CAV)* — 🟢 LIVE since 2026-09-19; every green build goes live

A whack-a-mole typing game built on the real Niagara EMS **CAV (Conditional Availability)**
workflow. Each unit has a **nest** with a digital readout below it. The player places a CAV with
`CAV #### TYPE` and clears it with `RCAV ####` before the alien egg in that nest hatches. A clear
smashes the egg. A hatch is a final escape that drains the **pool**, and an empty pool ends the
game. The styled "E" and "T" read as "ET", tying the name to the alien eggs.

**The design lives in [`EGG_TIMER_CONTEXT_PACKET.md`](EGG_TIMER_CONTEXT_PACKET.md), the source of truth.**
Every merged change is tagged by its source (*(Addendum)*, *(Rulings, draft 9)*, *(Timer Refinement)*,
*(Refinement 2/3/4)* and their *(… rulings)*), with filing notes on top. Chat's handoffs verbatim and each
earlier packet are in `Previous Versions/`; the `WHACK_A_CAV_` names there are deliberate. This file holds
only the rules a session must not re-derive or break. History: `docs/decisions.md` at the repo root, and
the memory store (below).

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
  **The shared transport sheet lists 2133–2136 and 2139 twice** (59 rows, 54 units): his call; the game dedupes.
- 🔒 **E17: no RCAV/syntax line in the how-to panel is Andrew's deliberate override of E10** (the Goal line is
  enough for dispatchers). Don't "fix" it.
- **A new build question:** one ⏳ PENDING switch in `config.js`, flagged to Chat as the next E-number (**E24**);
  on the ruling, change the switch, the packet item **and** the rig checks that assert the old value.
- **Design calls go through Chat, one at a time**, flagged in plain words ready to paste. Never settle one in a
  pick-an-answer box or silently in code: build it as a switch and flag it.
- **Investigate first** before touching anything shared (Fang Rock, the hub, other cartridges, conventions).

## The build (`files/`)
- `index.html`, `style.css`, `script.js` (boot, screens, loop, keyboard, how-to panel), `favicon.svg`.
- `core/`: `config.js` (every number with its source, [T] = tunable, plus the build-question switches),
  `rules.js` (pure curves), `commands.js` (PowerLine parsing), `data.js`, `game.js` (the whole mechanic,
  **no DOM**: keep it that way), `art.js` (placeholder SVG, the ladder's dishes), `audio.js` (placeholder
  Web Audio, the title tune), `title.js` (title scene), `mess.js`, `view.js` (board, pan, hose, cord),
  `boxes.js` (the Command Lines), `devmode.js`.
- **Two clocks in `game.js`:** `time` is the player's seconds (spawns, timeouts, overtime, cleanup);
  `clock` is displayed time at the wave's shared speed. Bold is decided on `clock`, overtime on `time`.
- `datasets/cav_types.csv` is Andrew's table; `cav_types_blank.csv` is the Blank Dataset Module, a
  Developer-Mode-only copy of the same seven types (D1). **Edit both** if the real table changes: the logic
  rig fails when they differ. Units come from `../../../datasets/AP_ENP_BSE/2. Units_Transports.csv` (shared).
- **Rigs** (in this folder; `verify-*.mjs` never publishes):
  - `node verify-egg-timer-logic.mjs`: no server. Checks the curves and drives the game's states.
  - `node verify-egg-timer.mjs [shotsDir]`: headless Chrome via NB's `cdp.mjs`. Serve with
    `python -m http.server 8898` from the (PCL) root; `window.__et` drives the clock. Screenshots go to the
    scratchpad, never under `Game/`. **Look at them too**: they have caught layout bugs the checks missed.
    Section L measures the layout and the readouts' widest readings at 1920×1080, 1440×900, 1280×720, 1024×640.
  - 🚨 **Gate on both rigs' EXIT CODES** before a commit or push. `node rig | grep …` exits 0 on a FAIL.
  - The live page keeps stepping in real time between checks: pause it (Esc) or poll for anything timed.
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
- **CAV data:** Andrew's durations for VS, STR, SS, EOS, MB, and AD (whole minutes, 10–30), plus VF's random
  10–30 min. **Two kinds of time: say "displayed time" and "the player's seconds"** (E3). The clocks show
  displayed time and run sped up: 1 displayed minute = 2 of the player's seconds at base speed, **one speed
  shared by every clock**, +10% on even waves, cap 2×. The real (Data Sheet) duration sets the bold mark
  exactly, in displayed time; never jitter it. Readouts show the literal type code; the optional `, comment`
  is accepted. Transport units only: never one already on the board, and no repeat within a wave until the
  whole (54) pool is used. Types come from a **shuffle bag**, each once, fresh each wave; a VF waits in it for
  a placement spawn and is left out where none can happen (E19, E20).
- **Egg lifecycle:** a CAV starts in a `laying` state: a cord drops from the top of the screen (1.0 s), a bulge
  (the egg) travels down it, and it squelches out into the nest (0.4 s); **the clock starts at the pop**, and
  the cord snakes back up (1.5 s), under all text. A VF gets no cord (E16). The egg grows, for information only.
  **`RCAV` does nothing until the CAV's real duration has passed**: that floor stops place-then-instantly-clear,
  so don't loosen it. Then bold, `RCAV` valid and the crack are one event. Overtime is in **the player's
  seconds**: 6 s, −0.25 s every 2 waves, floor 4.5 s, fixed ±10%. Then the hatch, final. **VF** shows no egg
  and no timer until the trigger, when a "Clear Fueling" bubble pops. **Every AD shows a post-it**: "20 min", or
  "Clear @ HH:MM" against the wall clock, the next whole minute after start + draw (E1).
- **Timer:** counts **up** in displayed time, MM:SS, through overtime. A larger 24-hour **wall clock** sits at
  the top centre of the playing field; the **Time Warp** panel sits in the **centre of the board** (Refinement 6;
  the middle row of nests sits two a side to leave it room): once the wave's last CAV has *started* and no egg is
  bold, every clock runs 5× [T] until an egg goes bold (the step splits there; E18). Overtime never warps.
  While it runs, only nests whose clock is running glow Time Warp green (E22), and green **lightning** chains
  from the panel to them, under every readout. 🚨 Lightning re-jags ≤ 3 a second (guard in `rejag()`), still
  under reduced motion; keep rig section P's flicker checks passing.
- **Placement:** 10 points, no penalty for waiting, but **an ignored trigger auto-opens** after 20 s (−1 s a
  wave, floor 8 s). **Any rejected Enter** clears the Command Line, shows a red ERROR under it for ~1 s and
  buzzes, with no score or pool penalty. An empty Enter does nothing (E6).
- **Waves and pool:** 5 active nests, +1 every 2 waves, cap 12; **all 12 are on screen all game** (inactive
  ones plain), activating in a fixed order spread across a logical 4 × 3 grid. A wave ends after a quota of
  resolved CAVs (8, +2 a wave); spawning stops once the quota has spawned (D4). Spawn gap 5–7 s in wave 1,
  −0.5 s a wave, floor 1 s; a spawn due on a full board is skipped. Cleanup 5–10 s, −0.5 s a wave, floor 3 s,
  called by a flashing banner over the HUD bar. Pool 3, −1 per escape only, +1 per zero-escape wave, cap 3;
  placeholder key `POOL`. **Only an empty pool ends the game.**
- **Scoring:** a clear is 100 at the trigger, falling linearly to 25 at the hatch; perfect-wave bonus 50 ×
  the wave; no penalty for an escape or for wiping. A frying pan slams on every clear (under 0.5 s, pure CSS:
  it must never hold the keyboard), and late on the empty nest after a hatch. The **egg ladder** is cosmetic: a fast clear (first third
  of overtime [T]) serves the next dish, Scrambled → … → Steak, Eggs & Brew!; a slow clear, any ERROR or a
  hatch resets it; it carries across waves.
- **Spawn rate (closed 2026-09-23):** the spawn-gap shrink stays **stacked** with the clock-speed escalation.
  The skipped-spawns line on the game-over screen stays as a debug aid.
- **Mess and hose:** a clear leaves a small splat on its own nest and drops the rest evenly over the whole board
  (on whichever nest or floor it lands); no neighbour targeting (E15), no cap; mess belongs to the nest and
  **covers its readout and post-it** (E14). Wiping is click-and-drag. **In-game the cursor is always the hose
  nozzle** (menus keep the pointer). The hose and its water draw **above the whole board** and below the how-to
  panel, the Command Lines and the HUD bar (Refinement 4, superseding E12). Water only while dragging.
  A tag on the tap: "CLEANING HOSE: click & drag to spray" (Refinement 5).
- **Readouts:** three cartoon boxes: unit white/blue, type grey/black, timer yellow/purple; at the limit all
  three go bold on the same instant, the unit's type dark green and the timer hot pink/white (Refinement 5). Each sized for its widest reading; a readout may run wider than its nest. Keep rig section L passing.
- **How-to panel** beside play **is** the instruction screen (E10). It **never lists CAV durations**. Lines:
  Goal, Switch, F12, Esc, Cleanup ("Click & drag the hose to clean up the mess."), plus Place in Both and
  Follow Progression (E8); no syntax line (E17, 🔒). Cartoon card with turning alien doodles that never touch
  a word (Refinement 5; the rig checks at the full turn). **It shows on EVERY screen** (one element that
  `placeHowTo()` moves; menu screens keep their content left of it, sized in `cqw`), ringed by **arcade
  attract lights** (`core/lights.js`): lively on the menus, a dim slow twinkle in play and cleanup.
  🚨 **Safety: no light or group over 3 flashes a second.** Every bulb change goes through `set()`'s 0.2 s
  guard (`lightsMinToggle`, never below 1/6 s); keep the rig's flash checks passing. Bulbs never behind a word.
- **Command Lines** (players never see "Command Box", E7; the code says boxes): 1–4, picked on the
  mode-selection screen, each its own colour; staged text in an inactive line clears when a wave starts.
  **Tab / Shift+Tab** next / previous line, text kept; **F12** next line and clears the line it lands on (E13);
  with 1 line, F12 just clears it. The active line pulses; the game pauses itself when the window loses focus.
  **Esc, and only Esc, pauses.** (The switcher, Ctrl+Tab and Alt+1–4 are retired.)
- **Title screen:** its own **How To Play card** (four numbered steps, `TITLE_STEPS`; Andrew may reword) where
  the other screens have the panel. A singing mommy alien and babies (too-wide smile, too many teeth), CSS only, and an
  ORIGINAL chiptune (`audio.js` `titleTune`) on the title and mode-selection screens (E21). Fang Rock's
  Electron starts it unprompted (measured); a browser tab at the first key. The **mode-selection screen** has
  its own creature: a three-headed singing blob whose eyes follow the cursor (never listens for keys).
- **Horror beats (Refinement 5):** the hatchling is horrific; a **scary mom face** pops in at most once a wave,
  under 1 s, only inside a clipping box over the HUD bar or the how-to panel (covering either briefly is fine,
  E23), so it can never reach a nest, readout or Command Line (rig section Q). Never let it take input or flash.
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

## State 2026-09-23 (end)
The options creature, the spawn ruling, Refinement 5, the E22–E23 rulings and the panel-everywhere + attract
lights handoff and Refinement 6 are live (rigs logic 141/0, browser 337/0). No Chat question open. Waiting on Andrew: D3 and the doubled units (Status → Open).

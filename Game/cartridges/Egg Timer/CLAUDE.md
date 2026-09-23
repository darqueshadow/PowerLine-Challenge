# Egg Timer *(formerly Whack A CAV)* — 🟢 LIVE since 2026-09-19; every green build goes live

A whack-a-mole typing game built on the real Niagara EMS **CAV (Conditional Availability)**
workflow. Each unit has a **nest** with a digital readout below it. The player places a CAV with
`CAV #### TYPE` and clears it with `RCAV ####` before the alien egg in that nest hatches. A clear
fries the egg. A hatch is a final escape that drains the **pool**, and an empty pool ends the
game. The styled "E" and "T" read as "ET", tying the name to the alien eggs.

**The design lives in [`EGG_TIMER_CONTEXT_PACKET.md`](EGG_TIMER_CONTEXT_PACKET.md), the source of truth.**
Every merged change is tagged by its source: *(Addendum)*, *(Rulings, draft 9)*, *(Timer Refinement)*,
*(Refinement 2)*, *(Refinement 3)* and their *(… rulings)*, with filing notes on top. Chat's handoffs verbatim and each
earlier packet are in `Previous Versions/`; the `WHACK_A_CAV_` names there are deliberate. This file holds
only the rules a session must not re-derive or break. History: `docs/decisions.md` at the repo root, and
the memory store (below).

## Status
- **Live for players since 2026-09-19** (hub entry in `Game/cat/disks.js`; NB's Rec-Bay 4 table fires).
- 🚀 **STANDING RULE (Andrew, 2026-09-23; replaces every earlier "no push until Andrew approves" line):**
  Andrew playtests Egg Timer through **Nerva Beacon (Rec-Bay 4)**, not localhost. After building anything for
  Egg Timer: **if BOTH rigs pass, commit and push to the live site right away. Never push with a failing rig.**
  Keep each change in its own commit(s) so any one can be reverted alone. **After each push, tell Andrew in one
  line what went live.** A push also publishes other sessions' commits on `main`: check `git log origin/main..main`
  and say so if anything besides Egg Timer is going out.
- **Refinement 3 (2026-09-23) replaced every switching ruling:** Tab / Shift+Tab / F12 as in CAD5. The Alt+1–4
  ruling was never built and its hand test is cancelled; the switcher, MRU order, quick-tap flip and Ctrl+Tab
  are gone, and E9 with them. E14 and E15 are ruled and the **egg ladder** added (*Refinement 3 rulings*); E13, E16 as built, E18 changed
  (warp waits for the last CAV to start). 🔒 **E17: no RCAV/syntax line in the how-to panel is Andrew's deliberate
  override of E10** (the Goal line is enough): don't "fix" it.
- **Open:** the spawn-rate question (does clock speed replace or stack with the spawn-gap shrink?). It waits
  on the skipped-spawn log from Andrew's playtest, shown on the game-over screen and in the console. **D3**, the
  Developer Mode phrase (`devModePasswordHash`, null denies every entry): Andrew gives Code the digest,
  never the phrase; then set the hash, strike D3 in the packet, and change the rig checks labelled ⏳ D3.
- **A new build question:** one ⏳ PENDING switch in `files/core/config.js` with a provisional value (never
  copied into the packet as a ruling), flagged to Chat; on the ruling, change the switch, the packet item
  **and** the rig checks that assert the old value.
- **Design calls go through Chat, one at a time.** Code investigates, flags each finding in plain words
  ready to paste (E-numbered), and merges what comes back. Don't settle a design call in Code's
  pick-an-answer box, and don't resolve an ambiguity in code: build it as a switch and flag it.
- **Investigate first** before touching anything shared (Fang Rock, the hub, other cartridges, conventions).

## The build (`files/`)
- `index.html`, `style.css`, `script.js` (boot, screens, loop, keyboard, how-to panel), `favicon.svg`.
- `core/`: `config.js` (every number with its source, [T] = tunable, plus the build-question switches),
  `rules.js` (pure curves), `commands.js` (PowerLine parsing), `data.js`, `game.js` (the whole mechanic,
  **no DOM**: keep it that way), `art.js` (placeholder SVG), `audio.js` (placeholder Web Audio sounds),
  `mess.js`, `view.js` (board, pan, hose), `boxes.js` (the Command Lines), `devmode.js`.
- **Two clocks in `game.js`:** `time` is the player's seconds (spawns, timeouts, overtime, cleanup);
  `clock` is displayed time at the wave's shared speed. Bold is decided on `clock`, overtime on `time`.
- `datasets/cav_types.csv` is Andrew's table; `cav_types_blank.csv` is the Blank Dataset Module, a
  Developer-Mode-only copy of the same seven types (D1). **Edit both** if the real table changes: the logic
  rig fails when they differ. Units come from `../../../datasets/AP_ENP_BSE/2. Units_Transports.csv`.
- **Rigs** (in this folder; `verify-*.mjs` never publishes):
  - `node verify-egg-timer-logic.mjs`: no server. Checks the curves and drives the game's states.
  - `node verify-egg-timer.mjs [shotsDir]`: headless Chrome via NB's `cdp.mjs`. Serve with
    `python -m http.server 8898` from the (PCL) root; `window.__et` drives the clock. Screenshots go to the
    scratchpad, never under `Game/`. **Look at them too**: they have caught layout bugs the checks missed.
  - Keys sent over the debugging connection skip browser shortcuts (real Chrome swallows a CDP Ctrl+Tab),
    so a passing check isn't a real keypress. Such cases are dispatched in-page, and real keypresses are
    Andrew's to test.
- `?seed=N&clock=HH:MM` replays a game exactly (the wall clock otherwise starts at the player's time of day).
- **Developer Mode:** Ctrl+Shift+B (lowercase `b` too), then a timed password prompt. On unlock the next game
  uses the Blank Dataset Module. `node make-dev-hash.mjs` makes the digest in a terminal (echo off, prints
  only the digest; `make-*.mjs` is excluded from the deploy).
- ⚠️ **Never name a game element's class `error`:** the title screen's `.error` rule caps width at 640px.
- ⚠️ **Esc in browser fullscreen** belongs to the browser; reclaim it with Keyboard Lock as The Aquanaut
  does (`lockEscapeKey`), Chrome/Edge only.
- Hub changes: run `verify-cat.mjs` (serve on 8899). Rigs that start browsers fail with "Chrome never opened
  a debug port" while another session pins the CPU: that's load, so wait and re-run.

## Locked design (summary; the packet has the detail)
- **Modes:** Clear CAVs Only (nests open one at a time), Follow Progression (one-phase for waves 1–2, then a
  placement chance of 0% at wave 3, +10% a wave), and Both. The mode buttons are the difficulty menu.
- **CAV data:** Andrew's durations for VS, STR, SS, EOS, MB, and AD (whole minutes, 10–30), plus VF's random
  10–30 min. **Two kinds of time: say "displayed time" and "the player's seconds"** (E3). The clocks show
  displayed time and run sped up: 1 displayed minute = 2 of the player's seconds at base speed, **one speed
  shared by every clock**, +10% on even waves, cap 2×. The real (Data Sheet) duration sets the bold mark
  exactly, in displayed time; never jitter it. Transport units only; readouts show the literal type code;
  the optional `, comment` is accepted; every new CAV draws a **new random unit** not already showing (D2).
- **Egg lifecycle:** the egg appears when a CAV starts and grows, for information only. **`RCAV` does nothing
  until the CAV's real duration has passed.** That floor stops place-then-instantly-clear: don't loosen it.
  At that moment the readout goes bold, `RCAV` becomes valid and the egg cracks, as one event. Overtime is
  in **the player's seconds**: 6 s, −0.25 s every 2 waves, floor 4.5 s, fixed ±10%. Then the hatch, final.
  **VF** shows no egg and no timer until the trigger, when a "Clear Fueling" bubble pops (the only pop-up);
  its unit and "VF" stay visible. **Every AD shows a post-it**: "20 min", or "Clear @ HH:MM" against the
  wall clock, the next whole minute after start + draw (E1).
- **Timer:** counts **up** in displayed time, MM:SS (VS and STR bold at 10:00, SS 15:00, EOS and MB 30:00),
  and keeps counting through overtime. A larger 24-hour **wall clock** runs at the same speed.
- **Egg-laying (Refinement 3):** a CAV starts in a `laying` state: a cord drops from the top of the screen, lowers
  the egg in and pops off (0.3 + 0.3 s [T]); **the clock starts at the pop**. The cord draws under all text. A VF
  gets no cord (E16).
- **Time Warp (Refinement 3):** once the wave's quota has spawned and no egg is bold, every clock runs 5× [T];
  the warp stops on the exact instant an egg goes bold (the step is split there). Overtime never warps.
- **Placement:** 10 points, no penalty for waiting, but **an ignored trigger auto-opens** after 20 s (−1 s a
  wave, floor 8 s). **Any rejected Enter** clears the Command Line, shows a red ERROR under it for ~1 s and
  buzzes, with no score or pool penalty. An empty Enter does nothing (E6).
- **Waves and pool:** 5 active nests, +1 every 2 waves, cap 12; **all 12 are on screen all game** (inactive
  ones plain), activating in a fixed order spread across the board. Adjacency on a **logical** 4 × 3 grid under
  an organic layout. A wave ends after a quota of resolved CAVs (8, +2 a wave); spawning stops once the quota has
  spawned (D4). Spawn gap 5–7 s in wave 1, −0.5 s a wave, floor 1 s, every mode; a spawn due on a full board
  is skipped. Cleanup 5–10 s, −0.5 s a wave, floor 3 s. Pool 3, −1 per escape only, +1 per zero-escape
  wave, cap 3; placeholder key `POOL`. **Only an empty pool ends the game.**
- **Scoring:** a clear is 100 at the trigger, falling linearly to 25 at the hatch; perfect-wave bonus 50 ×
  the wave; no penalty for an escape or for wiping.
- **Clear and hatch:** a frying pan slams on a clear (under 0.5 s, pure CSS: it must never hold the keyboard).
  On a hatch the pan comes down late on the empty nest.
- **Mess and hose:** a clear leaves a small splat on its own nest and drops the rest evenly at random over the
  whole board (a blob on a nest goes on that nest's mess, anywhere else on a floor layer under the nests); no
  neighbour targeting (E15), no cap; mess belongs to the nest and **covers its readout and post-it** (E14).
  Wiping is click-and-drag. **In-game the cursor is always the hose nozzle** (menus keep the pointer); the hose
  body and the egg-laying cord draw **under** all text (nests, HUD, how-to panel, Command Lines); behind the nests
  and eggs is by design (E12). Water only while dragging. The cleanup call is a banner over the HUD bar.
- **Egg ladder:** a fast clear (first third of overtime [T]) serves the next dish over the nest for ~1 s: Scrambled
  → … → Steak, Eggs & Brew!, holding at the top. A slow clear, any ERROR or a hatch resets it; it carries across
  waves; **no score effect**. It replaced the fried eggs by overtime third.
- **How-to panel** beside play **is** the instruction screen (E10). It **never lists CAV durations**. Refinement 3
  set its lines (Goal, Switch, F12, Esc, Cleanup), with no RCAV, AD or VF line (E17 open); its Place line shows
  only in Both and Follow Progression (E8). The wall clock and the TIME WARP panel sit in a band above the board.
- **Command Lines** (players never see "Command Box", E7; the code says boxes): 1–4, picked on the
  mode-selection screen, each its own colour; staged text in an inactive line clears when a wave starts.
  **Tab / Shift+Tab** next / previous line, text kept; **F12** next line, cleared (which line: E13); with 1 line,
  F12 just clears it. The active line pulses; the game pauses itself when the window loses focus. **Esc, and only
  Esc, pauses.**
- **Platform:** a plain browser tab as well as Fang Rock (`fangrock://arcade/eggtimer`, inside the hub's frame).
- **Deferred:** creature, splat and escape art, and every final look and sound (Gemini); the title and end
  screens; the pool's display name.

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
- It is its own cartridge: don't borrow another cartridge's theme, and don't push its conventions onto others.
- Folder names are Title Case with spaces, and GitHub Pages is case-sensitive: `Egg Timer` ≠ `egg-timer`.

## Working here
- Governance is on disk, outside `Game/`: `Documents/Core Documents/` (Laws → Overview → Build Procedure).
  Load it before implementing. 🚫 Don't quote Law/Overview §-numbers at Andrew.
- 🚫 **`Game/` is a public GitHub Pages site** and the repo is public; the deploy strips `*.md`, `*.cmd`,
  `verify-*.mjs` and `make-*.mjs`. Never write memory files, handoffs, audit reports, decision logs or
  scratch notes anywhere under this folder.
- Run the game over `http://` (`Game/Start Dev Server.bat`, then `/cartridges/Egg%20Timer/files/index.html`).

## Session memory
Not stored here. The store is `~/.claude/projects/C--Users-darqu-OneDrive--PCL--Game-cartridges-Egg-Timer/memory/`.
Open it via the **Egg Timer (Claude Code)** desktop shortcut (`claude-et.cmd`) and resume with
**`continue_et`** (`continue_wac` still works). All Egg Timer work happens in that session.
⚠️ Auto-memory keys to the git root, so this session auto-loads the **PLC root** index. `continue_et`
means: read the store's `MEMORY.md` first (and any ⏸ one-shot handoff it lists), then `et-track.md`,
and read and write Egg Timer memories **there**.

## State 2026-09-23
Everything through the E13–E18 rulings is built and pushed live; rigs logic 131/0, browser 189/0. Waiting on
Andrew for: his playtest in Nerva Beacon (then the skipped-spawn log for Chat) and the D3 digest.

# Egg Timer *(formerly Whack A CAV)* — 🟢 LIVE since 2026-09-19

A whack-a-mole typing game on the real Niagara EMS **CAV (Conditional Availability)** workflow: each unit has a
**nest** with a readout; `CAV #### TYPE` places a CAV, `RCAV ####` clears it before the nest's alien egg hatches. A
hatch drains the **pool**; an empty pool ends the game. The styled "E" and "T" read as "ET".

**The design lives in [`EGG_TIMER_CONTEXT_PACKET.md`](EGG_TIMER_CONTEXT_PACKET.md), the source of truth** (§11 holds
every ruling with its measurements; Chat's messages verbatim and earlier packets are in `Previous Versions/`, the
`WHACK_A_CAV_` names deliberate). This file holds only the rules a session must not re-derive or break. History:
`docs/decisions.md` at the repo root, and the memory store (below).

## Status
- **Live since 2026-09-19** (hub entry in `Game/C64/disks.js`; NB's Rec-Bay 4 table fires).
- 🚀 Andrew playtests through **Nerva Beacon (Rec-Bay 4)**, which plays the **local** `Game/` folder (no push needed
  for his playtests). After building: **if BOTH rigs pass, commit; never commit with a failing rig.** Keep each change in
  its own commit(s) so any one can be reverted alone.
- 🚫 **Pushing** (root `CLAUDE.md`): never without Andrew's explicit OK for that push, and **only this session's own
  commits**, as a prefix (`git push origin <last-own>:main`); never reorder `main`. If another session's commit sits
  underneath ours, ours waits: tell Andrew. Before asking, list `git log origin/main..main`. After a push, tell Andrew in
  one line what went live. Work he must see first (a screenshot sheet) waits on its own branch until he OKs it.
- **Open, Andrew's:** **D3**, the Developer Mode phrase (`devModePasswordHash` null denies every entry). **Walk him
  through it in plain language**: he runs `node make-dev-hash.mjs` himself and gives Code only the digest; then set it,
  strike D3 and the rig checks labelled ⏳ D3. He reviews the shared transport unit list himself: change nothing in it.
- 🔒 **E17: no RCAV/syntax line in the how-to panel is Andrew's deliberate override of E10.** Don't "fix" it.
- **A new build question:** one ⏳ PENDING switch in `config.js`, flagged to Chat as the next E-number (**E62**); on the
  ruling, change the switch, the packet item **and** the rig checks that assert the old value.
- **Design calls go through Chat, one at a time**, flagged in plain words ready to paste. Never settle one in a
  pick-an-answer box or silently in code: build it as a switch and flag it. If a pasted ruling arrives cut off,
  build what's whole, file the partial block verbatim and ask for the rest. A batch that conflicts with a locked
  ruling: stop at that part and report.
- **Investigate first** before touching anything shared (Fang Rock, the hub, other cartridges, conventions). Hub
  changes: run `verify-cat.mjs` (serve on 8899; "Chrome never opened a debug port" is CPU load: re-run).

## The build (`files/`)
- `index.html`, `theme.css`, `style.css`, `script.js` (boot, screens, loop, keyboard, how-to panel), `favicon.svg`.
- 🎨 **`theme.css` holds every colour**, the font stacks and the `@font-face`s; `style.css` holds none (rig section T
  fails on one). NB's Egg Timer cabinet copies some values by hand, so don't rename or drop one lightly. Section T
  resolves every rule against `verify-egg-timer-theme-baseline.mjs`: after a DELIBERATE style change, re-run with
  `--write-theme-baseline`, review which rules changed, and commit the baseline.
- `core/`: `config.js` (every number with its source, [T] = tunable, plus the switches), `rules.js` (pure curves),
  `commands.js`, `data.js`, `game.js` (the whole mechanic, **no DOM**: keep it that way), `art.js` (code-drawn SVG: the
  H sign, bubble, hospital, house, pump, nest layers), `audio.js`, `title.js` (the title family; exports `mommy`/`baby`
  for How To Play), `howto.js` (E57's cartoon), `lights.js`, `mess.js`, `pieces.js`, `breaks.js`, `aliens.js` (+ generated
  `alien-parts.js`), `mom.js` (+ generated `mom-parts.js`), `view.js` (board, marks and their placement, hose, cord,
  lightning, Time Warp, slime, tags), `boxes.js`, `devmode.js`. `files/art/` holds the approved pilot layers.
- **Two clocks in `game.js`:** `time` is the player's seconds (spawns, timeouts, overtime, cleanup); `clock` is
  displayed time at the wave's shared speed. Bold is decided on `clock`, overtime on `time`.
- **`snapshot().nests` lists only the nests in play**: find a nest by `id`, never by index.
- `datasets/cav_types.csv` is Andrew's table; `cav_types_blank.csv` the Developer-Mode copy (D1). **Edit both** if the
  real table changes. Units come from `../../../datasets/AP_ENP_BSE/2. Units_Transports.csv` (shared), by its "Units" header.
- **Rigs** (in this folder; `verify-*.mjs` never publishes):
  - `node verify-egg-timer-logic.mjs`: no server. `node verify-egg-timer.mjs [shotsDir]`: headless Chrome via NB's
    `cdp.mjs`; serve with `python -m http.server 8898` from the (PCL) root. Screenshots go to the scratchpad, never
    under `Game/`; **look at them too**. Every screen is measured at 1920×1080, 1440×900, 1280×720, 1024×640. A
    first-load timeout is CPU load: re-run. Fetch big asset sets at game start, never at page load.
  - 🚨 **Gate on both rigs' EXIT CODES.** `node rig | grep …` exits 0 on a FAIL.
  - The live page keeps stepping and drawing between checks: do a timed thing inside one `ev()`, pause it (an Escape
    keydown in the same `ev()`), poll, or record at the event; never a fixed `wait()` before a timed check. A paused
    game blocks `submit`. `__et.start(boxes, { hospital, minutes, wallStart, rng, eggTypes })` plays one exact case
    (its scenes are all-VS unless `eggTypes: "bag"`). Scenes that fake state on every nest stub `ET.view.render` first.
  - Most scenes run with E39's early warp off (`farWarpOff()`). CDP keys skip browser shortcuts: real keypresses are Andrew's.
  - ⚠️ **`.nest.unlock` stays on after its 0.4 s pop**: test the running animation (`getAnimations()`), never the class.
    `getBoundingClientRect()` includes the pop's scale while it runs. A hidden element measures zero (lay it out
    unseen first). Hand-made `{left,…}` boxes have no `width`: filter on `right - left`. A readout's children include
    the tabs: its three boxes are `:scope > span`.
- `?seed=N&clock=HH:MM` replays a game exactly; `?tint=` previews the unused board tints.
- **Developer Mode:** Ctrl+Shift+B (lowercase `b` too), a timed password prompt, then the Blank Dataset Module.
- ⚠️ **Class names taken:** never `error` (the title's `.error`), never `drop` (the hose's mist). `refused` is the
  bubble, `#reject` the rejected-Enter plate, `.bld` a hospital/house, `.slime` the hatch slime.

## Locked design (summary; the packet has the detail and the numbers)
- **Art direction: "juxtaposition":** a friendly family cartoon with a dark, twisted undertone. **Alien art:** scary
  alien, nothing human, **no red liquid** except the cord; red eyes and veins are fine. Pilot nest + egg, break stages,
  the six hatchling puppets and both Moms are approved art; the rest is placeholder or code-drawn.
- **Eggs (E54 one mode; E59 the bag):** each wave a shuffled bag of the table's types but the STR: **VS, SS, EOS, MB, AD**
  (`eggTypes`). **VF is out of play** (`vfInPlay: false`); its FUELING / DONE timer box and pump stay in the code.
  **AD** shows a tilted LED **"Clear @ HH:MM"** note beside its nest and bolds when the wall clock reads it (E1).
- **Hospital eggs:** only a VS, ~70% of them (`hospitalShare`, seeded roll). `RCAV` (valid at bold) **restarts the
  countdown at 12 s** (`hospitalResetSeconds`; Time Warp ignores the waiting egg; the type box spells CAV / STR, 0.75 s
  each), **then `CAV #### STR`**: window 1's tier is the RCAV's, paid at the STR; no pan/splat; **Mom repairs the egg**
  (sweet in wave 1, creepy after; from the nearest edge, E58 "nest" fallback; visit 2.2 s, the giggle-hold flash rules;
  creepy Mom's purple drool and tongue code-drawn). The STR runs 10:00, then an ordinary window and `RCAV`. STR before
  the RCAV: **"RCAV first!"**; STR on a refusal, a second RCAV or any other type: ERROR.
- **Marks:** the **H sign** (1.6×, blue, never a red cross) and the amber **"Patient Refused"** bubble (VS refusal eggs
  only) are **tabs on the timer box** (right of it, else below; the bubble falls back to the shoulder where neither
  fits). A code-drawn **hospital** / **house** stands **behind its nest** (z −1), skipped with no room. `placeMarks()`
  decides from layout boxes with every readout at its widest, keeping half a pixel clear and room for the bounce; the
  AD note keeps off every neighbour's marks exactly where they go (`markFootprint`). They **bounce** once a second, half
  a bounce apart, as a **dip below their resting place** (never higher).
- **CAV data:** Andrew's durations (VS 10, STR 10, SS 15, EOS 30, MB 30, AD 10–30 whole minutes; VF 10–30 when in
  play). **Say "displayed time" and "the player's seconds"** (E3). One clock speed for every clock; the real duration
  sets the bold mark exactly: never jitter it. Readouts show the literal type code. Transport units only, never one
  already on the board, no repeat in a wave until the pool is used.
- **Egg lifecycle:** `laying` (the cord lowers the egg; **the clock starts at the pop**), running. **`RCAV` does nothing
  until the CAV's real duration has passed** ("Too Early!"). Then bold, `RCAV` valid and the crack are one event;
  overtime (the player's seconds), then the hatch (**no pan, no THONG**, E37). An overrunning timer box **swaps its
  colours**, 2 s apart down to 0.5 s, restarting slow at a hospital RCAV (`overrunInvert`). **Hatchlings (E45):** wave 1
  cute, wave 2 mixed, wave 3+ horror; cute = a goofy hop, horror = freeze, stare, a **full-screen jump scare** (#scare,
  the only one), then **purple slime** at the clear spot nearest its nest, never over anything (`hatchSlime`). The cord
  draws on top of everything. The wall clock is **neon green** `#39ff14`, no glow, in **DSEG7**.
- **Time Warp:** 5× once the wave's last CAV has started and none is bold (E18), or while 2+ eggs are each over 8:00
  from bold (E39); never with an egg bold. 🚨 The sign flashes ≤ 2/s (`setSign()`), then wobbles (a transform);
  lightning re-jags ≤ 2.5/s. Sign, caption and lightning **hot red**; the grandfather clock's glow stays mint. E50: the
  clock is 1.5× and sits UNDER the nests.
- **Rejected Enter:** any clears the line and buzzes, no penalty (E6). The words (ERROR, "Too Early!", "RCAV first!")
  show on a **pinball plate in the clock's pendulum window** (E60), never over its face, sign or caption; a repeat
  restarts its time; bulbs swap every 0.6 s.
- **Board lights:** `#backdrop`: the **lilac** tint (E32), white lights on the track's BPM (🚨 5% white at most) and
  Time Warp's dark veil.
- **Waves and pool:** nests in play 5 → 12, **all 12 on screen all game**; spawning stops at the quota (D4); a spawn on
  a full board is skipped. Pool 3, −1 per escape, +1 per escape-free wave. **Only an empty pool ends the game.**
- **Scoring (E26):** by **tier**, fifths of the egg's own overtime window: 100 / 75 / 50 / 35 / 25, plus a perfect-wave
  bonus. **Never set tiers in displayed time.**
- **Mess and pieces:** splat on the cleared nest, the rest over the board (E15); liquid **covers readouts and marks**
  (E14). Shell pieces drain via the **trough** (left, right, bottom) to the sink. 🚨 The cleanup banner flashes ≤ 2/s.
- **The hose:** in play the cursor is **always the drawn nozzle** (yellow head, green hose), turned with the jet; a drag
  **blasts** (E42) and **the water pushes** whatever it touches (Andrew, 2026-09-30).
- **Readouts:** unit, type, timer; all bold at once at the limit, the timer on **ready pink** `#d1006a` (E33).
- **Command Lines** (never "Command Box", E7): 1–4, **2 by default**. **Tab / Shift+Tab**; **F12** next, clearing it
  (E13). Losing focus pauses; otherwise **Esc, and only Esc, pauses.**
- **How To Play (E57):** a six-step cartoon on the title and options screens, **Andrew's six captions** (⚑ step 6 says
  "the baby", Chat 2026-10-03: revert if Andrew objects). Its Mom and hatchling are the **title's code-drawn replicas**,
  the nest and egg real art. **No side panel in play** (E30), none on game over. Its caption bubble is on hold.
- **Screens:** title (PRESS ANY KEY until the first press, E40), options, game over (Enter ignored for 1 s, E34). The
  **HUD mom face** (≤ once a wave, < 1 s, HUD bar only) is the Mom kit's head, pose A.
- **Reduced motion** stills every loop, light, sign, bounce and wobble (the jump scare: E49 "still"). **New motion must
  join it** (rig R). 🚨 Nothing anywhere flashes more than 2 times a second.
- **Sound:** mute button + M (Ctrl+M in play, E25); every sound through `audio.js`'s `bus()`; music at −19.8 LUFS (E36),
  dipping under THONG, the buzz and the hiss.
- **Platform:** a browser tab, and Fang Rock (`fangrock://arcade/eggtimer`), which serves the **local** `(PCL)/Game`.
- **Deferred:** the rest of the art, final sounds, the end screen, the pool's display name.

## Standing rules
- 🚫 **Never send real keystrokes or mouse input to the desktop, and never open browser windows outside a sandboxed
  test harness, without Andrew's explicit go-ahead for that specific test** (2026-09-22). Hand tests go to Andrew as
  step-by-step instructions. The headless rigs are the sandboxed harness.
- **It is a Standalone Cartridge** (Laws v2.0 amendment A1): **don't** copy `Game/blank/`, and **don't** use Target /
  Challenge / Impact Zone / Resource / TFS vocabulary. **Still binding:** Data Sheet integrity, Developer Mode on
  Ctrl+Shift+B, Demo/Publish modes, modular files, all repo work through Claude Code, the PET Terminal belonging to the hub.
- 🚫 **Never invent CAV timings or type codes.** Anything not in the packet or the real Data Sheet comes from Andrew.
- **Use the packet's own vocabulary:** nests, eggs, hatching, escape, the pool, Command Lines.
- **The hub id is `eggtimer`, letters only** (Fang Rock drops tokens not `^[a-z]+$`). The old cassette menu doesn't
  list Egg Timer: Andrew's call. No other cartridge's theme. Pages is case-sensitive. Nerva Beacon's repo is never pushed.

## Working here
- Governance is on disk, outside `Game/`: `Documents/Core Documents/` (Laws → Overview → Build Procedure). Load it
  before implementing. 🚫 Don't quote Law/Overview §-numbers at Andrew.
- 🚫 **`Game/` is a public GitHub Pages site** and the repo is public; the deploy strips `*.md`, `*.cmd`, `verify-*.mjs`
  and `make-*.mjs`. Never write memory files, handoffs, audit reports or scratch notes anywhere under this folder.
  Andrew's `files/assets/` is git-ignored: not Code's to commit.
- Run the game over `http://` (`Game/Start Dev Server.bat`, then `/cartridges/Egg%20Timer/files/index.html`).
- Patch scripts: most files are CRLF; match line endings per file, and never `sed -i` in Git Bash (it strips every CR).

## Session memory
Not here: `~/.claude/projects/C--Users-darqu-OneDrive--PCL--Game-cartridges-Egg-Timer/memory/` (shortcut `claude-et.cmd`).
**`continue_et`** (or `continue_wac`): read that store's `MEMORY.md` and any ⏸ handoff it lists, then `et-track.md`;
write Egg Timer memories there.

## State 2026-10-03 (parked)
Chat's playtest batches are **built and committed, not pushed** (`5267498`..`477f41e`); the push waits on PLC's
`28ca78d`, which sits underneath. **Held for Andrew:** the How To Play caption bubble, the types reference's place
(E61: three rows, wording ruled) and Part 4. **Since `06cc26f` live play really places the marks and notes** (before
it, never): Andrew's next Rec-Bay 4 look should cover them. Owed: the hospital window and spawn-rate playtests (E53,
E56); hand tests (Mom's visits, the cartoon, nozzle lag, held Enter at Game Over, the aliens, the hose, Q, real F3, the
jump scare). The ⏸ handoff in the memory store has the rest.

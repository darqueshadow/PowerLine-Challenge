# Decisions

## Resolved 2026-09-14 — the Arcade's cabinet links, the C64 cracked-only screen, and the exit buttons

**Solved:** The Nerva Beacon corridor's Arcade room drives the CAT hub (`Game/cat/`) through Fang Rock. Each
of the three cabinets launches its own PLC game straight away: no hub menu, but the crack intro still plays.
The corner C64 opens a hub with cracked disks only, and inside Fang Rock that is the only hub there is. A
PLC game's play-bar button is **Exit Game**, which closes Fang Rock's Arcade window and returns to the
Arcade room. A cracked disk's button is **Reset**, back to the disk screen, and that screen has **Power Off**
to leave. Andrew confirmed it in the installed app on 2026-09-14.

**Approach:** One opaque token, `?cart=<token>`, is read only by the inline script in `Game/cat/index.html`
`<head>` (`window.CAT_LINK`). That script also hides the menu before first paint (`html.cat-link #cat`)
whenever a token is present or the page is inside Fang Rock. `cat.js` interprets the token:
- `asteroid|aquanaut|pitstop` → select, insert, `introThenLaunch()`.
- `cracked` → cracked-only.
- anything else → the hub plus `?file not found`.

Inside Fang Rock (`window.fangRockShell`, from the shell's preload) the hub is always cracked-only. PLC
cartridges are removed from `DISKS` itself and `#crate-plc` from the DOM, after the cabinet's disk has been
resolved into `LINKED`. Every exit goes through `exitGame()`, and leaving the Arcade is a plain
`window.close()` in `leaveArcade()`.

**If you touch this again:**
- Links and cracked mode: `501eb27` (pushed, live on Pages). The Exit Game / Reset / Power Off changes and
  the always-cracked-only hub inside Fang Rock were still uncommitted when this was filed.
- Fang Rock must not interpret tokens (Andrew's guardrail). Adding a cabinet means a `disks.js` id plus a
  corridor row, never a shell change. Ids must match `^[a-z]+$`, and `cracked` is reserved.
  `asteroid-command` was never an id.
- `window.close()` closing the room window was measured under the shell's own Electron 32.3.3. The test
  used a scratch main mirroring the `arcade:` scheme, webPreferences and preload, and it held after a token
  reload (history length 2), so no shell IPC is needed. 🚫 Don't launch the real dev shell to re-test: it
  re-points the Windows `fangrock://` handler.
- Resolve a link against `visibleDisks()`, which keeps the Ctrl+Shift+B gate, so `?cart=blank` is refused.
  Cut the roster in `DISKS`, not at render: every selection path reads that array.
- The menu-hiding script must stay in `<head>`. Hiding the menu from `cat.js` alone let it show through
  the crack intro's 260 ms fade-out and before `cat.js` ran (watched red).
- Installed Fang Rock serves the arcade live from `(PCL)/Game` (its `config.json` rootPath), so hub changes
  can be tried there without a push. The shell reloads the Arcade window only when the token changes.
- `Game/cat/verify-cat.mjs` §K/§L/§M cover this (159/0). §M fakes the shell with
  `Page.addScriptToEvaluateOnNewDocument` and records `window.close` instead of calling it. Use a fresh
  browser per case: NB's `cdp.mjs` `goto()` returns early on a second navigation.

## Resolved 2026-09-17 — the C64 corner's book reader and its six manuals

**Solved:** The corner C64 now has a reader for six in-universe programming manuals. It floats over the
machine, drags by its title bar, resizes from its corner, turns pages and closes — and, the point of the
whole thing, a listing can be read off a page and typed straight into the running C64 without the reader
ever stealing the keyboard. Proven on the real core: a full listing typed off the page came back out of
`LIST` character for character, with the mouse's last touch on the reader, never on the machine.

**Approach:** Six books live in `Game/cat/books.js` as data, the way `disks.js` is the disk roster — cat.js
knows how to draw a book and turn a page and knows the name of none of them. Every word is original, which
is Andrew's ruling of 2026-09-16 (no external C64-era text, no copyright surface) and is also why it may
ship: `books.js` is runtime code, so the Pages deploy's `*.md` exclude list does not catch it. The reader is
a sibling of `#cat` and `#play` at `z-index: 60`, reached by a reserved `?cart=book<id>` token — one more
opaque string through Fang Rock, since the trigger is the shelf in the Nerva Beacon room, not a hub button.

**If you touch this again:**
- **Focus is the entire design, not a detail.** Every reader control refuses focus on `mousedown` and every
  click ends in `focusMachine()`; the reader takes **no keys of its own** — no arrow-key page turns, no
  Escape to close — because each of those is a key someone may be typing into BASIC. The one deliberate
  hole is `mousedown` inside a `<pre>`, so a listing stays selectable. `cat.js`, "THE READER".
- **Drag/resize use MOUSE events, not pointer events.** Measured 2026-09-17: the pointer-event version
  resized correctly in Chrome and did nothing at all under the Fang Rock shell's Electron (verify-c64 §L:
  560x560 in, 560x560 out). The shell *is* Electron, so that is the engine that counts.
- **`var` hoisting trap:** `BOOKS` must be declared above the book-token code that reads it. Declared below,
  it is `undefined.forEach`, which kills `cat.js` before `window.__cat` exists — a blank hub, not a missing
  reader.
- **The `book` prefix is reserved** in the `?cart=` namespace, so no cartridge may ever take an id starting
  with it. An unknown `book…` token is refused like any other and is never echoed back.
- **The corridor half is not built and is not ours:** a spine click in the NB room (`c64Shelf()`, ask
  `C64-BOOK-CLICK`) still has to reach the hub. `cat:book` is the door for opening a book in an
  already-running hub without the reload a token costs; it is gated on `window.fangRockShell`.
- **The 18 listings have never been RUN.** verify-c64 §L sweeps all 84 lines for typeability and types one
  listing end to end; the other seventeen are hand-checked only. A `<` in book 5 exposed a gap in the *rig's*
  key table, not the book — check that table before suspecting a page.
- Coverage: verify-c64 §L, verify-cat §N. Last full green: verify-c64 **100/0**, verify-cat **213/0**.
  Brief: `Game/cat/Brief_C64-Book-Reader_2026-09-16.md` (untracked, as all corridor briefs are).

## Resolved 2026-09-17 — Egg Timer's build questions (Draft 9 rulings: D1, D2, D4, D5, D6, C15)

**Solved:** The six questions the Egg Timer build raised are settled, so only D3 (Andrew's Developer Mode
phrase) is still open. The Blank Dataset Module holds a Developer-Mode-only copy of the seven real CAV
types. Every new CAV draws a new random unit, never one already showing on the board. A wave stops spawning
once its quota has spawned. The readout's timer counts up in game seconds (VS bold at 00:20, EOS and MB at
01:00), not a real-time equivalent. A rejected Enter leaves the text in the Command Box. An auto-opened
trigger starts its timer normally, counting up. A running VF hides its egg and its timer until "Clear Fuel",
while its unit number and "VF" stay visible.

**Approach:** Chat ruled each question from paste-ready write-ups after asking for the full question text,
and sent them as Draft 9. The rulings are filed verbatim under a filing note at `Game/cartridges/Egg Timer/
Previous Versions/EGG_TIMER_RULINGS_DRAFT9.md`; the eighth Addendum draft is still the current Addendum.
Each ruling changed three places: its switch in `files/core/config.js`, the packet's item (tagged
*(Rulings, draft 9)*), and the rig checks that asserted the stand-in. D5 and C15(b) flipped value; D2, D4 and
D6 already matched the build; D1 made `files/datasets/cav_types_blank.csv` a byte copy of `cav_types.csv`.

**If you touch this again:**
- Committed in `0519a17` (by the PLC root session, with the build). Rigs after the merge:
  `verify-egg-timer-logic.mjs` 74/0, `verify-egg-timer.mjs` 76/0 twice.
- The switches are one block, `Game/cartridges/Egg Timer/files/core/config.js:68`. Each switch's other value
  still runs but is NOT the design. 🚫 `stopSpawningAtQuota: false` is undesigned: CAVs left running at a
  wave's end count toward no wave if they resolve during cleanup, and toward the next wave if they outlive it.
- `cav_types_blank.csv` must stay identical to `cav_types.csv`: the D1 check in the logic rig (§C) compares
  them value for value, so a change to the real table without the copy goes red. Developer Mode therefore
  plays like a normal game apart from its badge — that is the ruling, not a bug.
- VF hides only while the CAV is running: `hidden` in `game.js`'s snapshot is true in the `active` state
  only, so a VF placement trigger shows its readout normally. The view toggles `hide-clock` (`view.js:143`).
- Checks that pin the rulings: logic §C (D1), §J (D2 — watched failing against two mutants built in the
  scratchpad, one ignoring the board, one re-using a nest's last unit), §L (every switch's value);
  browser §A (D1), §C (D5's exact clock text, D6), §H (VF's unit/code visible, timer hidden).
- D5's clock reads the duration exactly at the trigger because the rig samples every 0.25 game-seconds and
  the clock floors to whole game seconds. Don't loosen that to a range without a reason.
- D3 is the one left. It is not a design call: Andrew runs `ET.plcDigest('PHRASE')` in the page console and
  gives the digest, never the phrase. Until then `devModePasswordHash: null` refuses every entry.
- Draft 9 says the D1 values come from the "packet / Data Sheet". The CAV table is the cartridge's own
  `files/datasets/cav_types.csv`; the shared Data Sheet holds the units. The values match either way.

## Resolved 2026-09-18 — the C64 corner's audit, and the six defects it found in the ten-changes batch

**Solved:** The corner C64 is sound end to end. A full read-only audit of its interface, mechanics, core
and ROMs, disk images and art, and the six manuals found nothing wrong in anything already committed —
the real ROMs, the positional keymap, the drive contract, the crates, the books and the multi-disk swap all
came through clean. Six real defects, all of them in the uncommitted 2026-09-17 batch, are fixed, and F9
now does the same thing whichever side of the glass has focus. Both rigs green on a quiet machine:
verify-c64 **116/0**, verify-cat **214/0**, each control that must fail still failing.

**Approach:** Twelve read-only auditors, one per dimension, every finding then put to two or three
verifiers told to refute it; 87 survived. The four confirmed critical/high were fixed, and running the rig
after each fix exposed two more that no static read could have found. Committed as `a6bbf97` (the batch)
and `af767f0` (F9). The other ~83 findings are deliberately untouched; the full report and every finding is
archived outside the repo at `~/.claude/projects/C--Users-darqu-OneDrive--PCL-/memory/archive/audit-c64-corner-2026-09-17.md`.

**If you touch this again:**
- **`findScreen()` must hunt `**** COMMODORE 64`, not the word BASIC.** The boot screen carries "BASIC"
  TWICE — in the banner and in "38911 BASIC BYTES FREE" — so a hunt for it is always ambiguous and the
  "refuse rather than guess" test refused on every boot. The 17-code run occurs once. It returns the START
  OF THE GRID (`i - 44`), not the banner's address: `readState()` and `screenSig()` both index rows off it.
- **WHEN it is asked was half that bug.** It is hunted at boot from `EJS_onGameStart`, because the banner
  is the only landmark and the first thing anything does is clear it off the screen. First look at 2s, then
  every 800ms, max 25 — do NOT tighten it: a full wasm-heap scan on the machine's own thread five times a
  second starves the core to 20fps, and the rig then dies at its own control.
- **A WORKING DRIVE IS NEVER SETTLED.** A drive access paints `SEARCHING FOR *` and holds the screen
  perfectly still, which is indistinguishable from a game that painted and stopped. `readState()` reads the
  machine's own words (`BUSY_WORDS`) and returns `"busy"`, which holds the settle clock down. Without it the
  hub lets go mid-LOAD and types no RUN. Only reachable once findScreen worked — before, every Load sat out
  its full 120s backstop, which accidentally gave the drive all the time in the world.
- **Live typing is paced in EMULATED FRAMES, like `typeText`.** `relayKey()` first fired all four key events
  in one synchronous block: zero frames between press and release, which is the condition emu.js's own
  KEY_FRAMES banner calls fatal. Every moved character typed nothing.
- **ONE PATH, or typing scrambles.** While a relay is in flight EVERY core-bound key goes through the same
  queue. Mixing an immediate path with a queued one put keys out of order and let an un-translated key land
  while the relay held ShiftLeft (`LOAD"*",8,1` came back `LOAD"*,"(,1`). Shift itself is the one exception:
  the relay reads it. And if the handler takes a keydown it must take the matching keyup — an unclaimed
  release reaches the core out of order and merges a key struck twice into one (`HELLO` → `HELO`).
- **Physical Shift is tracked by CODE, not as a boolean.** Releasing ShiftLeft to type `*` and restoring
  ShiftLeft when ShiftRight was held sticks a shift down for the session. `blur` clears the record.
- **An author `display` beats `[hidden]`, so `[hidden]` must be restated.** `#reader-spines` and
  `#reader-foot` set `display:flex` and did not; clicking a book gave the shelf back with the page laid out
  below it and off the scroll. cat.css writes this rule out in full for `.crate__notice`.
- **The rig carries NO key map.** It hands Electron the character and lets the layout do the rest: a rig
  that presses C64 POSITIONS gets translated a second time by the page. `CAT_EMU.typing()` reports the relay
  queue depth so the rig waits on it instead of guessing a frame count. Do not reintroduce a table here to
  make a section pass — a second copy of the keymap is exactly the drift hazard.
- **`KEYCARD` in cat.js is the RAW POSITIONAL MATRIX, not player-facing advice.** Ten of its seventeen rows
  stopped being true as instructions the moment the translator landed.
- **F9 arrives by two routes and both go through `portKey()`.** A real key on the emulator's document when
  the glass has focus; a `cat:port` message from cat.js (HOTKEY_PORT) when the hub does. The ruling — F9
  puts you on the stick — had been written into the key handler only. Only the MACHINE-mode route was
  changed: the play overlay's Port button is a different listener and a plain flip is right there.
  🚫 A 2026-09-18 handoff asserted the opposite direction (that cat.js was compliant and emu.js should
  match it). It was wrong, and following it would have deleted the ruling's only implementation. Check which
  file carries the DATED ruling comment before believing a stated direction.
- **verify-c64 §G must assert joystick MODE, not that the port changed.** A port flip is precisely the
  pre-ruling behaviour, so the weaker assertion goes green on the bug.
- **`verify-c64.mjs` has ONE try/catch around every section**, so a single stale reference kills every later
  section and reports as one failure — a stale `SHIFTED` lookup cost §L, §K and §Z a whole run. Check the
  blast radius before removing anything a later section reads.
- **verify-cat failing in a DIFFERENT place on each run means orphaned browsers, not a regression.** A run
  that throws skips its cleanup and leaves ~5 `--headless=new` Chromes on `chromeprof-*` temp profiles.
  Killing only processes whose command line matches `chromeprof-` is safe; Andrew's own Chrome is neither
  headless nor on a temp profile.
- **The public Pages INSTALL screen is a presentation defect, not a leak** (triaged 2026-09-18, left in the
  backlog). `?cart=cracked`, `?cart=book<id>` or the emulator URL direct reaches it, because
  `emulator/emu.js` and `index.html` are published while `data/` is gitignored. Contents are a public
  upstream `git clone`, a public `npm install`, and repo-relative paths only — no tokens, no absolute
  paths, no unlock phrases. Do not re-triage it as a security item.

## Resolved 2026-09-22 — Egg Timer's launch, and its cabinet in Nerva Beacon's Arcade

**Solved:** Egg Timer is live for players on the public site, and its table in NB's Rec-Bay 4 now fires
like the three cabinets beside it. Two separate faults, three days apart, both reported as "it will not
launch" — and in neither case was the PLC hub at fault.

**Approach:** The first was simply that `main` had never been pushed: origin sat at `501eb27`, with no
`Egg Timer/` folder on the remote at all and no `eggtimer` in the live `disks.js`, so the hub could not
have shown a tile. Pushed `501eb27..fc05229` (14 commits) on 2026-09-19 after pre-flighting that every
file the game fetches is tracked and survives the deploy filter. The second was NB's Egg Timer table,
built as scenery on 2026-09-16 with no game token; its DEST kit row gained `tool`/`label`/`app`/`url`
like the other three (NB `4f8e940`).

**If you touch this again:**
- 🚫 **The PLC hub tile has been measured working twice and is not the place to look.** On the live site
  at five window sizes it is present, `pointer-events:auto`, `elementFromPoint` lands inside the button,
  its markup is structurally identical to Asteroid Command's, and click → Insert → Load reaches a playable
  game. The only console output is a `disks/` 404, which is the local-only disk library and expected.
- **Insert is not Load.** Selecting a disk and pressing Insert Disk only fills DRIVE 8 and prints
  `DISK INSERTED`; `#btn-load` ("Load \"*\",8,1") is what launches. A test that stops after Insert reports
  a false failure.
- **In NB, a cabinet is armed by its DEST kit row, nothing else** (`Nerva Beacon Main/app.js`): `roomKit()`
  hands `mq--hot mq--who-<who>` to the builder only when the row carries a `url` or `soon`, and
  `kitEggTable` already threads that modifier onto every box. Tokens are the hub's disk ids, never display
  names — a wrong one fails silently. Two rigs PIN the armed list and must move with any change:
  `tools/verify-arcade-links.mjs` (`WANT`, `CARTRIDGES`) and `tools/verify-room-tools.mjs` (`ARC_WHO`).
- **`make-*.mjs` is in the deploy excludes** (`.github/workflows/deploy-pages.yml`) beside `verify-*.mjs`.
  Without it `make-dev-hash.mjs` would publish; that workflow's own leak check does not inspect `.mjs`.
- ⚠️ **`verify-cat.mjs` crashes at random with `ReferenceError: __cat is not defined`** — `cat.js` is the
  last script on the hub page, so when cdp.mjs's `goto()` returns early it is the one thing undefined
  (~2 pages in 38). Not a hub bug. Re-run it; a clean run is 214/0. It also rewrites two tracked
  screenshots — restore them with `git checkout --` rather than committing them.
- Still open and deliberately untouched: the root cassette menu (`Game/core/submenu.js`) does not list Egg
  Timer, and NB's `EGG-TIMER-WALL` / `EGG-TIMER-HATCH` are Andrew's calls.

## Moved from Egg Timer's CLAUDE.md on parking, 2026-09-23

History lifted out of `Game/cartridges/Egg Timer/CLAUDE.md` so that file stays short. Still true, but not
needed every session.

- **Build and launch dates.** Andrew authorized and confirmed the build on 2026-09-16 (first playable build in
  `files/`). He lifted the `coming-soon` hold on 2026-09-17 ("a normal, selectable cartridge in the Arcade for
  all players"), knowing the art, the screens and audio were placeholders. Players got it on 2026-09-19 (see the
  resolved entry above).
- **The launch wiring in the hub rig.** `status: "coming-soon"` is gone from the `eggtimer` entry in
  `Game/cat/disks.js`. `verify-cat.mjs` has `"eggtimer"` in `CARTRIDGES` (§B), a `?cart=eggtimer` cabinet
  case (§K), and eggtimer in both "no cartridge in the DOM" selectors (§L cracked mode, §M inside Fang Rock).
- **`make-dev-hash.mjs` (the D3 tool).** It asks twice with the echo off, prints only the digest, and takes
  nothing from the command line, so the phrase stays out of shell history; Code never sees it. It calls the
  game's own `ET.plcDigest` (config.js loaded in a VM, as the logic rig does) rather than a copy, so it can't
  drift. `--self-test` re-checks four browser-measured vectors and the keystroke handling.
- **Esc in fullscreen, the old wrinkle.** Pausing on fullscreen exit (as The Aquanaut does outside Chrome/Edge)
  would have made Esc pause instead of closing an open switcher. That goes away with the switcher, when the
  Alt+1–4 ruling is built.
- **2026-09-22 in one line each** (all committed locally, unpushed; the packet has the detail):
  `46469a4` Timer Refinement (displayed-time clocks, wall clock, AD post-its, VF bubble, new overtime, clock
  speed) with its E1–E4 rulings; `aa5395b` Refinement 2 (how-to panel, hose, MRU Tab switcher, frying pan,
  ERROR, placeholder sounds) and `0c0f4b8` its E5–E11 rulings; `311fc3f` the Hose ruling (the nozzle is the
  in-game cursor); `31a0232` E12 (the hose stays behind the nests). The same day, an Alt+1–4 probe that sent
  real keystrokes landed keys in Andrew's own Edge window. That's why the no-desktop-input standing rule exists.

## Moved from Egg Timer's CLAUDE.md on parking, 2026-09-23 (evening)

History lifted out of `Game/cartridges/Egg Timer/CLAUDE.md` at the second park of the day. The packet
(`EGG_TIMER_CONTEXT_PACKET.md`) has the full rulings; this is the trail.

- **The 2026-09-22 commits listed above are now pushed** (with everything below), in `195d35c` (18 commits) and
  later pushes. The "unpushed, no push until Andrew approves" state ended on 2026-09-23 with Andrew's standing
  rule: a build that passes both rigs is pushed at once, and he playtests through Nerva Beacon.
- **Switching, start to finish.** Ctrl+Tab (Addendum) → Tab with a switcher (C7) → a most-recently-used switcher
  with a quick-tap flip and Ctrl+Tab inside Fang Rock (Refinement 2, E9 left open) → Alt+1–4 (ruled 2026-09-22,
  never built: a lone Alt tap blurred Chrome, and its hand test was cancelled) → **Refinement 3's CAD5 keys:
  Tab / Shift+Tab / F12**, with E9 retired. E13 settled that F12 clears the line it lands on.
- **Mess layering went both ways in one day.** Refinement 3 §5 put splatter under the readouts; the E14 ruling
  put it back over them, as in the original design (the legibility spiral stands). E15 dropped neighbour
  targeting for an even spread over the whole board, which made the logical grid's adjacency unused.
- **The hose moved on top.** E12 (2026-09-22) kept it behind the nests; Refinement 4 §2 put it above the whole
  board, below the how-to panel, the Command Lines and the HUD bar.
- **The fried eggs became the egg ladder** (Refinement 3 rulings): sunny/broken/burnt by overtime third, and the
  sparkle and smoke with them, were replaced by seven cosmetic dishes for consecutive fast clears.
- **The cord got slower.** Refinement 3 §7 laid eggs in 0.3 + 0.3 s with a 0.45 s retract; Refinement 4 §1 made
  it 1.0 + 0.4 s with a bulge, a squelch and a 1.5 s retract.
- **Time Warp** (Refinement 3 §4) first started once the quota had spawned, even with a trigger still waiting;
  E18 made it wait until the wave's last CAV had actually started.
- **E17** is logged in the packet as Andrew's deliberate override of E10: no syntax line in the how-to panel.
- **How the Rec-Bay 4 table reaches the game:** it fires `fangrock://arcade/eggtimer`, and Fang Rock's shell
  (`The Lantern Room/Morbius/shell/config.json`, room `arcade`, `served`) serves the LOCAL `(PCL)/Game` folder.
  `Nerva Beacon Main/` isn't deployed anywhere, and NB's local `main` has never been pushed, so nothing about
  NB needs a push for Egg Timer to reach Andrew there.
- **The title tune and autoplay (E21).** Measured with a hidden Electron 32.3.3 window, default webPreferences
  (as the shell runs): the AudioContext starts unprompted, so the tune plays on the title inside Fang Rock. In a
  browser it starts at the first key, and the ruling keeps it playing through mode selection.
- **A slip worth remembering:** the shuffle-bag commit (`eb6c06b`) went in on a flaky red browser run because
  the commit chain tested `grep`'s exit code, not the rig's. Fixed at once (`d016698`), before any push.
- **Dropped from CLAUDE.md as unused:** Esc in browser fullscreen belongs to the browser; reclaim it with Keyboard
  Lock as The Aquanaut does (`lockEscapeKey`, Chrome/Edge only), if Egg Timer ever goes fullscreen.

## Moved from Egg Timer's CLAUDE.md on parking, 2026-09-23 (late)
- **Spawn rate, closed 2026-09-23 (Chat, Andrew approved):** Andrew's playtest logged skipped spawns W1 1, W2 3,
  W3 3, W4 4, so the spawn-gap shrink stays **stacked** with the clock-speed escalation; the skipped-spawns line
  on the game-over screen stays as a debug aid. (Packet §11, *(Spawn ruling)*.)
- **Retired switching:** the switcher, its most-recently-used order, Ctrl+Tab and the Alt+1–4 ruling are all gone
  (Refinement 3); Tab / Shift+Tab / F12 is the whole scheme.
- **Title tune in Fang Rock:** measured 2026-09-23 in a hidden Electron 32.3.3 window with the shell's defaults, the
  AudioContext runs unprompted, so the tune plays on the title inside Fang Rock; a plain browser tab starts it at
  the first key (E21).
- **The hose's layer history:** it first ran under the nests (E12), then Refinement 4 put it above the whole board.
- **Refinement tags:** the packet's tags now run through *(Refinement 6)*, *(Lightning tweak)*, *(AD notes & blank
  boxes)*; the full list is the packet's filing notes, not CLAUDE.md.
- **Numbers dropped from CLAUDE.md's summary (they live in `config.js` with sources, and in the packet):** cord
  1.0 / 0.4 / 1.5 s; overtime 6 s, −0.25 s every 2 waves, floor 4.5 s, ±10%; speed +10% on even waves, cap 2×,
  1 displayed minute = 2 player seconds; nests +1 every 2 waves, quota 8 +2 a wave; spawn gap 5–7 s −0.5 a
  wave, floor 1 s; cleanup 5–10 s −0.5 a wave, floor 3 s; pool +1 per zero-escape wave, cap 3; perfect-wave
  bonus 50 × wave; egg ladder "fast" = first third of overtime, Scrambled → … → Steak, Eggs & Brew!.

## Resolved 2026-09-24 — Egg Timer: doubled units, blank boxes, font licences, clock and "Clear @" note look

**Solved:** The shared transport sheet lists each of its 54 units once. "Darker blank boxes" is confirmed to mean the
in-play empty nests' "----" / "--:--" boxes. Every bundled font's licence is served on the public site. The wall clock is
neon green, and the "Clear @" note has cream Fredoka wording on a charcoal fill, its time still in the clock's LED digits.
**Approach:** Removed the second copy of 2133–2136 and 2139 from `Game/datasets/AP_ENP_BSE/2. Units_Transports.csv`
(`ee16cd3`); only Egg Timer reads it. The Pages deploy gained rsync `--include` rules ahead of `*.txt`, for `OFL*.txt` and
`*LICEN[CS]E*.txt` directly in a `fonts/` folder (`c04c75e`). Clock `--led` became `#39ff14` (`f89565a`). The note uses
`--note-clock-bg` `#2b2a2e` and `--note-clock-label` `#fff3d1`, with `Fredoka-Bold.woff2` and `Fredoka-LICENSE.txt` bundled
(`eb9bbc5`). The blank-box reading is closed in the packet (`d3b6e3f`).
**If you touch this again:** Change nothing else in the unit sheet: Andrew reviews the full list himself. The game's
dedupe (`files/core/game.js:45`) stays as a guard, and both rigs assert 54. A licence file must sit directly in `fonts/`
with an `OFL`/`LICENSE` name, or the deploy drops it (it staged 224 files, only these three `.txt`). Patrick Hand's woff2
holds no licence text; DSEG's do. Time Warp keeps mint `#3dff9a`: the clock must stay clearly different and never glow
(glow is for lit bulbs). DSEG14 and `--font-led-text` are unused but kept because NB may read the tokens. NB's style doc
(`~/Downloads/Egg Timer look for the NB cabinet.md`) names `eb9bbc5` as the commit to copy from. A rig screenshot taken
during Time Warp must be taken inside the Esc pause, or the warp ends and the lightning checks fail.

## Built 2026-09-25 (held) — Egg Timer: E38, pieces, the hose's push, drips and the trough (Chat ruling)

**Solved:** Clears leave shell pieces (and alien parts at break stages 3–5) that pile up, get pushed by the hose, and
drain through a trough at the board's left, right and bottom edges. Held on `et-e38-hold` for Andrew's screenshot sheet.
**Approach:** `core/pieces.js` owns two canvases (baked still layer + live layer) inserted after the floor mess, so they
sit behind the nests. A uniform grid (64 px cells) finds resting pieces; waking one redraws only its patch of the still
layer. Positions are board px, speeds in board heights. Walls are the readouts, measured with the nest's unlock scale
undone about its centre (layout offsets miss the translate(-50%) on each nest and readout; drawn boxes mid-unlock are
20% size). Liquid: `ET.mess.streak()` replaces the eraser; the mess canvases are `willReadFrequently` (a GPU readback made
one streak take 2.4 s). Sounds `squelch`/`bloop` share `capped()`.
**If you touch this again:** rig section E38 steps the physics with `ET.pieces.frame()` while the game is paused; its
`__col`/`__row` helpers need a column/row clear of the readouts (none spans the whole board at every size). E41 (no
cleanup quota exists) is open with Chat.

## Resolved 2026-09-25 — Egg Timer: a clear's gunk blown up ~5× on a nest growing in (bug, found building E38)

**Solved:** A blob a clear flung onto a nest during its 0.4 s unlock (scaled from 20%) came out about 5× too big.
**Approach:** `fling()` placed and sized the blob by the canvas's drawn (transformed) box; it now sizes it by the canvas's
layout width (`offsetWidth`). Rig section D pins one blob onto an unlocking nest and measures it (10.5% before, 0.6% after).
**If you touch this again:** `getBoundingClientRect()` includes that unlock scale; anything sized from it must allow for it.

## Resolved 2026-09-25 — Egg Timer: E40, the first press and PRESS ANY KEY (Chat ruling)

**Solved:** `titleFirstPress` stays "sound"; the title prompt says PRESS ANY KEY until the first press, where needed.
**Approach:** `paintPrompt()` picks LOADING… / PRESS ANY KEY / PRESS ENTER; it's repainted on the first press, a mute
change, the context's `statechange` (`ET.audio.onState`) and after `wakePromptDelay`, until which LOADING… stays up.
**If you touch this again:** the prompt keeps its `.blink` (1 s, steps: one flash a second; stilled under reduced motion).

## Resolved 2026-09-25 — Egg Timer: E39, a second Time Warp trigger (Chat ruling)

**Solved:** Time Warp now also runs while 2+ running eggs are each over 8:00 (displayed) from their bold mark.
**Approach:** `warping()` = in a wave, no egg bold, and (the last-CAV rule OR `farEggs() >= warpFar.eggs`). `step()`
splits on each running egg's `boldClock - 480` as well as its `boldClock`, so the warp ends exactly on the mark
(`farEggs()` allows 1e-9 so a split step landing on the mark counts as there).
**If you touch this again:** most rig scenes run with the rule off (`withoutFarWarp()` in the logic rig; `farWarpOff()`
after every page load in the browser rig), because long eggs now warp early and those scenes test other things.

## Resolved 2026-09-25 — Egg Timer: E36, the music level and its dip (Chat ruling from Andrew's playtest)

**Solved:** Egg Timer's music was far quieter than the other cartridges' (gameplay −48.6 LUFS heard); now all three
tracks play at −19.8 LUFS, and dip under THONG, the buzz and the hiss.
**Approach:** Measured integrated loudness with ffmpeg ebur128 (`imageio-ffmpeg`'s binary). Asteroid Command and the
Aquanaut play music through an `<audio>` at volume 0.5 and nothing else, so heard = file LUFS − 6.02 dB; the median of
their nine tracks is −19.8. Egg Timer's heard = file LUFS + 20·log10(level × 0.8 master). Levels 0.762 / 0.826 / 0.762.
Tracks now connect to one music gain (`musicBus()`) whose `duck()` the three loud cues call; offline renders skip it.
**If you touch this again:** re-measure with ebur128 if a music file changes, and update `lufs` in `config.js`; the rig
checks the sum, not the files. Music peaks 0.41 against the ceiling's 0.75 knee: raising it past ~1.8× would start
rounding it off.

## Resolved 2026-09-25 — Egg Timer: E35, the title music starts on the title (Chat ruling from Andrew's playtest)

**Solved:** The title track began on the options screen; now it begins on the title.
**Cause:** `ET.audio.unlock()` made the AudioContext on the first keydown/pointerdown, and on the title that is Enter,
which also shows the options screen (the menus share the track, so it started there).
**Approach:** `ET.audio.autoplay()` makes the context at boot and queues the wanted track (on a suspended context it
waits at its start). Electron 32's default autoplay policy (Fang Rock's shell sets none) lets it run at once. In a
browser, every press while `ET.audio.locked()` calls `unlock()` (a resume); the first such Enter or click on the title
is let pass (`app.wakePress`, ⏳ E40 `titleFirstPress`). The unlock listener is registered BEFORE the keyboard handler
on purpose. Side fixes: the pop's click is 0.04 (0.06 could peak it 1% past its limit); rig S takes the loudest of 5
renders of each random sound, and rig A waits for the mute fade to finish, since music is now queued from the start.
**If you touch this again:** headless Chrome holds sound like a browser (probed: `suspended`), so the Fang Rock path
can't be seen in the rig; Andrew checks it by hand.

## Resolved 2026-09-25 — Egg Timer: E37, no pan on a hatch (Chat ruling from Andrew's playtest)

**Solved:** The frying pan came down (with a clunk) when an egg hatched; now it comes down only on a clear.
**Approach:** It was Refinement 2's "the pan comes down late on the empty nest" (0.35 s after the hatch). Removed the
`late` slam, `ET.audio.clunk` and `hatchPanDelay`; `slam()` has one kind now. Theme baseline: only `.pan.late` left.
**If you touch this again:** rig section E counts THONGs and pans through a whole hatch; both must stay 0.

## Resolved 2026-09-25 — Egg Timer: E32, the board tint (Chat ruling)

**Solved:** Lilac, as built. **Approach:** no change; the ⏳ marks came off `config.js` and `theme.css`. Mint and cream
stay as unused tokens behind `?tint=` (Chat said no change, so they weren't dropped).

## Resolved 2026-09-25 — Egg Timer: E34, the game-over default and its Enter guard (Chat ruling)

**Solved:** TITLE SCREEN stays the default; Enter on game over now waits 1 s, so a hammered Enter can't skip the result.
**Approach:** `show("over")` stamps `app.overAt`; the key handler ignores Enter while `overEnterIn()` > 0 and any
`ev.repeat` Enter (so after the second a fresh press is still needed). `overEnterDelay: 1` [T] in `config.js`.
**If you touch this again:** the rig dispatches its early Enter in the same `ev()` as `__et.show('over')`; keep it there.

## Resolved 2026-09-25 — Egg Timer: E33, the ready pink (Chat ruling)

**Solved:** The bold timer's white-on-pink was 3.5:1; the pink is now `#d1006a` (5.4:1) everywhere it means "ready".
**Approach:** One token, `--readout-bold-timer-bg`, already fed every "ready" use (nest timer, wave-1 tag, the strip's chip
and panel 2's badge), so the change is one value; the badge's digit went white (dark ink on the new pink is 3.4:1).
Decoration pinks (`--hot`, `--pink`) stay. Theme baseline rewritten: exactly those four rules and the badge ink changed.
**If you touch this again:** a new "ready" cue must use that token, never `--hot` (they look alike but aren't the same).
Nerva Beacon's cabinet art hard-codes the old `#ff2d8a` (`app.js`), NB's to update.

## Resolved 2026-09-25 — Egg Timer: the hatchling's legs (Chat ruling)

**Solved:** In a scurry the hatchling's legs shuffle (a slant back and forth) and never vanish; nothing flashes.
**Approach:** `@keyframes legs` is a `skewX(-14deg → 14deg)` swing about the legs' own centre, 0.3 s, alternating; it was
`scaleY(-1)` in `steps(2)`, a flip through zero height 8.3 times a second. Rigs: logic 159/0, browser 462/0 (new H3).
**If you touch this again:** keep any leg motion a transform that keeps their height (rig H3 fails below ×0.99).

## Resolved 2026-09-25 — Egg Timer: music (Chat ruling)

**Solved:** Andrew's three Suno tracks play: the title track on the menus, the gameplay loop in play, the game-over track
once, then back to the title. Loops are seamless; screens fade; Esc pauses; a background tab holds; mute covers it.
The game-over screen has TITLE SCREEN and PLAY AGAIN buttons (E34: which is the default).
**Approach:** No ffmpeg on the machine, so `pip install --user imageio-ffmpeg` (a self-contained ffmpeg) drives
`make-music.py`. Only MP3 sources exist; Chrome's `decodeAudioData` decodes the LAME-encoded files sample-exact (checked:
same length, zero offset), so MP3 is safe for in-file loop points. The player is one AudioBufferSource per track with
`loopStart`/`loopEnd`, through `bus()`. Rigs: logic 159/0, browser 460/0 (new section M).
**If you touch this again:**
- **Loop points:** my first beat-phase snap made the gameplay loop ~100 ms short; waveform matching at the join is what
  works. Keep Chat's start, match the end, move both onto the beat together.
- **An AudioParam's value reads back as the old value in the instant before a scheduled ramp starts:** a rig reading a
  fade must wait ~100 ms.
- **`files/assets/` is git-ignored** (the deploy publishes everything committed under `Game/` that isn't excluded).

## Built 2026-09-25 — Egg Timer: the pilot art, nest + egg (held for Andrew's approval)

**Solved:** Slot 0 is Andrew's Gemini pictures (cut out, split, laid on the 404 × 374 slot canvas) with vector cracks;
the egg's hints come out of its cracks; eggs are mirrored at random and ~1 in 6 has a rare eye.
**Approach:** `make-pilot-art.py` (beside the rigs; never deployed): the background is the near-white joined to the
picture's edge (a PIL flood fill; no scipy here), a 3 px band round it un-blended from white so the outlines stay
crisp; the nest split along its bowl's lower arc; slate copies by luminance. art.js puts each layer in as an `<image>`
over the whole viewBox inside the brief's class groups; view.js rolls the mirror and eye on "laying" (on "active" for
a VF) and shows the hints from `eggHintsAt`. Rigs on the branch: logic 159/0, browser 452/0 (new section Z).
**If you touch this again:**
- **Full-canvas layers overhang their box when the egg rocks**, so the rig checks bounds from the pictures' pixels,
  not from the elements' boxes.
- **Held on `et-pilot-art-hold`**, not `main`, until Andrew approves; after that, merge and push under the normal rule.

## Resolved 2026-09-25 — Egg Timer: the egg-laying sound (Chat ruling)

**Solved:** Laying an egg squeezes (a wet, rubbery squelch on the cord's last stretch) and then pops (the egg into the
nest), each at a slightly different pitch, never more than 2 of either at once, and well under the game's cue sounds.
**Approach:** `ET.audio.squeeze()` and `pop()` in audio.js through `bus()`; the squeeze is fired from view.js's render when
a laying nest passes `laySqueezeAt`, the pop on the "active" event. `ET.audio.measure()` renders one sound offline through
its own master chain for the rig (section S). Rigs: logic 159/0, browser 446/0.
**If you touch this again:** an OfflineAudioContext refuses `resume()`, so `ready()` swallows that promise's rejection
(uncaught, it showed as page errors in rig K).

## Resolved 2026-09-25 — Egg Timer: board lights and Time Warp dark (Chat ruling)

**Solved:** The board has a faint tint, white lights fade in and out on the gameplay track's beat behind everything, and
Time Warp fades the board and its lights to dark while leaving the eggs, nests, text boxes, clock, sign, caption and bolts
untouched. Reduced motion: no lights, the dark still fades.
**Approach:** A backmost `#backdrop` layer (z 0, under `#cords` z 1 and `#field` z 2), laid over the board's area by
`paintBackdrop()` in view.js each frame. Lights run on the player's seconds and a BPM from `gameplayTracks` (placeholder
100). The veil is a CSS opacity transition behind `setDark()`'s 0.5 s guard. Rigs: logic 159/0, browser 439/0 (new
section U; a new theme baseline with the four `#backdrop` rules).
**If you touch this again:**
- **Keep the lights at 5% or less**: at 7% the dim Time Warp caption fell to 4.41:1 over a light (rig section U checks
  4.5:1 under all three tints).
- **E32** (the tint) and **E33** (the bold timer's 3.5:1) are open.

## Pruned 2026-09-25 — Egg Timer's CLAUDE.md, on parking

The State and Locked-design sections were rewritten from the E26–E31 sessions' running notes into the current rules only.
Dropped as history (each is already in the entries below or in the packet): E27's "Time Accelerator" rename and its undoing
by E28; the how-to panel's line-by-line history (Switch, F12 and Cleanup moving out under E28, the panel leaving play under
E30); the four-step title card and the old hose step; the mom face's panel zone. Added as rules: find snapshot nests by id,
the taken class names (`error`, `bubble`), and the paused page still drawing.

## Resolved 2026-09-24 — Egg Timer: Time Warp's sign wobbles (E31)

**Solved:** Andrew wanted Time Warp's sign to blink very fast, which the flash rule forbids. The sign keeps its 3 flashes,
then its letters wobble and stretch while Time Warp runs; the sign stays lit and its brightness never changes.
**Approach:** `paintSign()` adds `.wobble` once the flashes are done (never under reduced motion); style.css animates the
`.letters` span's transform only. Rigs: logic 159/0, browser 426/0 (new theme baseline).
**If you touch this again:** the rig check holds a real Time Warp on pause with `warpSignFlashes` set to 0, samples every
colour of the sign for 2 s, and fails on any change. Keep the effect a transform.

## Resolved 2026-09-24 — Egg Timer: no side panel in play (E30), the comic strip (E29), red in the art

**Solved:** The side panel is gone from play and the board takes its width. Esc joined the hints under the Command Lines,
and an empty line says "CAV + unit + type" while a nest waits to be placed. How To Play is a five-panel comic strip on the
title card and the options screen, with number badges and Chat's words. Brief rule 6 now allows red eyes and veins and
bans only red liquid outside the cord.
**Approach:** The strip came back from the stash with the ruled changes. `placeHowTo()` never puts the panel in play; its
markup now starts in the options screen. `ET.boxes.hint()` sets the grey hint from each frame's snapshot. Rigs: logic
159/0, browser 423/0 (the panel checks that assumed play moved to the game-over screen; a new theme baseline).
**If you touch this again:**
- **The mom face has only its top zone** (`momFaceZones: ["top"]`): its panel zone needs the panel, which isn't in play.
- **The grey hint is 0.8 of the typed size**: at full size "CAV + unit + type" is cut off in four lines at 1024 px (rig
  section L measures it).
- **The rig's `menuFit` reads text only** (a tree walk over text nodes), because the strip has pictures inside its panels.

## Resolved 2026-09-24 — Egg Timer: the Command Line picker (E29, in part)

**Solved:** The options screen's picker asks "How Many Command Lines?" with One to Four, each in its Command Line's
in-game colour: the one picked lit, the rest dimmed, Two by default. The art brief has the comic panels as slots 16–20.
**Approach:** `--line-1…4` in `theme.css` match `boxes.js`'s COLORS; the rig checks each option's colour against COLORS.
Rigs: logic 159/0, browser 448/0.
**If you touch this again:**
- **The comic strip (E29 item 2) is held in `git stash`**: built, but over the room at 1280 and 1024 on the options
  screen, and Chat must pick a cut (packet §11, E29, has the measured options). Its speech bubble can't use the class
  `bubble`: that's the VF "Clear Fueling" bubble, hidden until shown. It uses `say`.

## Resolved 2026-09-24 — Egg Timer: instructions beside their objects (E28)

**Solved:** E27's "Time Accelerator" is Time Warp again, with a caption under its sign, which flashes 3 times as it kicks
in. A sink by the hose's tap carries the hose's instructions. The cleanup banner reads "CLEAN-UP TIME! Hose down the mess
before the next wave." An empty Command Line shows a grey "RCAV + unit", the Tab / F12 hints sit under the lines, and the
options screen starts on 2 lines. In wave 1 the first bold egg and the first "Clear @" note get a tag each, once a game.
The title card's step 2 is the pink cue. The side panel keeps only Goal, Esc and Place; E30 asks whether it's still needed.
**Approach:** The tags sit in the band above the board beside the wall clock, with leader lines in the cord's layer, so
they can never cover a nest or a readout. The sign's flash runs on the player's seconds behind `setSign()`'s guard. The
clock went from 23% to 17% of the board's height to fit the caption. Rigs: logic 159/0, browser 444/0 (new section W for
the tags; a new theme baseline).
**If you touch this again:**
- **Snapshot nests are the ones in play only**, so find a nest by `id`, never by index (the tags missed their nest at
  first).
- **The sign's flash test draws a steady Time Warp frame by frame**, since a real one can end before 3 flashes are done.
- **Title card:** 27% of the window wide now; at 20% the longer step 2 pushed its banner into the lights.

## Resolved 2026-09-24 — Egg Timer: the Time Accelerator and How To Play upgrades (E27)

**Solved:** "Time Warp" is now the "Time Accelerator" wherever players see it, and the centre panel is a placeholder
grandfather clock whose hands spin while it runs. Under reduced motion its hands stop and the face shows "5×". The
title's How To Play card has a fifth step about it. On the options screen the instructions are bigger, under HOW / TO /
PLAY signs that light in turn and then all together. The art brief has the clock as slot 14.
**Approach:** The code keeps "warp" (`#warp`, `snapshot().warp`, `--warp` tokens); only the words players see changed.
The clock is `ET.art.clockSvg()`, turned by `turnHands()` in `view.js` on the player's seconds, so a pause holds it. The
signs are `ET.lights.signs()`, with their own guard. Rigs: logic 159/0, browser 427/0, with a new theme baseline (only the
clock, the signs, the options panel and step 5's badge changed; the old panel's 3.3-a-second brightness flicker is gone).
**If you touch this again:**
- **Size:** the clock is `min(23cqh, 30cqw)` tall. The free space between the nests is about 27% of the board's height, so
  anything taller hits a nest's box (rig section L measures it at all four sizes).
- **The doodle beside the signs** needs its 12 px gap: turned its full 28°, it would otherwise touch PLAY, and rig
  `menuFit` fails at random.
- **NB:** the Rec-Bay 4 table's backboard label changes from TIME WARP to TIME ACCELERATOR in NB's style doc.

## Resolved 2026-09-24 — Egg Timer: tiered clear points (E26)

**Solved:** A clear now scores by tier: each egg's own overtime window (bold to hatch) splits into fifths, worth 100, 75,
50, 35 and 25 points. That replaces the 100 → 25 slide. The egg ladder climbs on tiers 1–2. The tier also picks the clear's
break stage (1 elegant … 5 alien), and the waiting egg shows alien hints from tier 3. Both are art, briefed to Gemini
(slots 13 and 0) and not in the game yet.
**Approach:** Andrew's first tiers were in displayed time (10 s / 30 s / 1 min / 2 min / 4 min after bold). Code measured
them: the clocks run 30 displayed seconds per player second at 1× and 60 at the 2× cap, so the 10 s tier lasted 0.17–0.33 s
(below reaction time, since an early RCAV is rejected) and 4 min couldn't be reached before about wave 8. Chat ruled fifths
of each egg's window, which the cracks already show. Built as `clearScoring: "tiers"` in `config.js` (`"slide"` keeps the
old scoring), with `ET.rules.clearTier()` and a `tier` on the `cleared` event. Rigs: logic 159/0, browser 415/0.
**If you touch this again:**
- **Never set tiers in displayed time.** The overtime window is in the player's seconds; the shortest fifth is 0.81 s (the
  4.5 s floor with −10% jitter), and the logic rig fails if a tier drops under 0.8 s.
- **The art-slot layer** shows the break stage from the event's `tier`, and the hints at 40/60/80% of the window, once each,
  with no flash (groups `hint-3` … `hint-5` in `egg.svg`).
- **Open:** whether the hatchling's red eyes and the mom face's red veins break the "no red except the cord" art rule.

## Resolved 2026-09-24 — Egg Timer: the full audit's batch A fixes, and the mute (E24, E25)

**Solved:** All of Egg Timer's audit batch A is live. The cleanup banner flashes at most 2 times a second (a guard caps it at
2.5). Reduced motion now stills the place-me cue, the overtime wobble, the cord twitch and the hatchling's legs. Enter on the
title waits for the data. A unit sheet the game can't use refuses to start with a clear message. The rig's timing-dependent
checks are steady, and the midnight "Clear @" value is checked. E24 added a mute button and the M key, remembered per browser,
with a master level so overlapping sounds can't clip and the title tune halted in a background tab. E25 ruled that Ctrl+M
mutes during play.
**Approach:** One commit per item, `c14b3e5`…`67e59c2`, each gated on both rigs (final: logic 152/0, browser 415/0), plus
`443ef11` for E25. A five-lens adversarial review before the push found four nits, fixed in `9e03ddf`, `d45faab` and
`67e59c2`. In the packet: an "Audit fixes A" filing note, §11 item 9 struck in favour of E15, and E24 and E25 filed. The
pre-batch packet is saved as `Previous Versions/EGG_TIMER_CONTEXT_PACKET_direct-rulings.md`.
**If you touch this again:**
- **Flash guard:** `cleanupFlashSeconds()` in `files/core/view.js` never lets a flash take under 0.4 s (config gives 0.5 s),
  and rig section O fails if a tuning gets past it.
- **Reduced motion:** one live query, `reducedMotion()` in view.js, plus the CSS list in style.css's
  `@media (prefers-reduced-motion)` block. The place-me cue holds a steady cyan border rather than disappearing. Rig section R
  reads every item without reduced motion first, so its checks can fail. Its egg search needs 150 s: an EOS or MB takes 60 s
  of play to go bold.
- **Units:** `parseUnits` (`files/core/data.js`) finds the "Units" header. Fewer than `nestsCap` (12) distinct units throws
  `sheetError("units")`; D2 needs one per nest. The title's "error" screen starts nothing, and Enter and the click both
  check `app.data`.
- **Sound:** every sound connects to `bus()` in `files/core/audio.js`: master level 0.8, then a WaveShaper soft ceiling (knee
  0.75, ceiling 0.95), then the speakers. Rig A2 fails on a second `.destination` anywhere in the page's scripts. The
  setting is stored in localStorage as `eggtimer.muted`. `muteKey()` ignores `ev.repeat`, and the tooltip names the key
  that works on each screen. `muteKeyInPlay: "ctrl-m"` (VisiCAD has no Ctrl+M); M must keep typing in play, because MB is a
  type code.
- **Rigs:** `reload()` carries earlier page errors into check K. Section V holds and fulfils CSVs with the CDP Fetch domain.
  `__et.start(mode, boxes, { wallStart, types, rng })` is a rig-only hook. A timed check never uses a fixed wait: poll, do it
  inside one `ev()`, or wrap `ET.view.handle` at the event, installed in the same `ev()` as any game start.

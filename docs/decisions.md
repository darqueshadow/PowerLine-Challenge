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

## Resolved 2026-09-25 — the C64 corner's Full Screen, Pause and eject lever

**Solved:** The corner C64 has a **Full Screen** mode and a **Pause** button, and its Eject is drawn as the
1541's door lever. Full Screen fills the window with the machine's screen and puts a breadbin strip under
it with Power, both ports, the keyboard, Eject, the side swap, Pause, Exit Full Screen and the hub's
one-line message. Pause freezes the machine with nothing typed getting in, and resumes it exactly where it
was with the keyboard back in BASIC. Chat's handoff, Andrew's rulings, and he ran the checklist on
2026-09-25. Built with it, on his approval: the Fast Load cartridge no longer covers the deck's note line,
and verify-c64's opening screen hunt waits 60s instead of 20s.

**Approach:** Full Screen is a LAYOUT, `#cat.is-full`, and never the browser's Fullscreen API (his ruling):
Fang Rock's Arcade window is already full screen, so Esc (RUN/STOP) is never at risk. The strip is
`#c64-side` itself, and `setFull()` MOVES Eject and `#side-swap` into it and back home to comment-node
markers in `#crates`. Pause is `cat:pause` / `cat:resume` in emu.js, which call EmulatorJS's own
`pause(true)` / `play(true)` (the core's main loop), and the hub paints from the machine's answer.
Measured on the real core in verify-c64 §P and §P2.

**If you touch this again:**
- **Never the Fullscreen API.** On Firefox and Safari Esc always leaves full screen and the page never sees
  it, so RUN/STOP would be lost; Chrome/Edge's `keyboard.lock` was never measured through the emulator's
  iframe. The layout mode sidesteps all of it, and it lets the book reader stay on top.
- **The strip is MOVED parts, never copies.** The rigs read these ids and `paintSide()` paints these exact
  nodes; a copy is a second panel that can disagree with the first. Eject in full screen leaves full screen
  first, so the disks show.
- **While paused, KEYDOWN is blocked on window capture in emu.js and KEYUP is let through.** A key held when
  Pause was clicked and released while paused would otherwise stay held in the core on resume — measured by
  the C64's own key scan, `$CB` 60 → 64. The hub blocks keys too, except Tab and Enter/Space on a button.
- **Pause is refused while `busy` and while emu.js's `relayBusy()`.** Typing and loading are paced in
  EMULATED frames, so a pause mid-command stalls it until it times out. Every `busy =` in cat.js now goes
  through `setBusy()`, which repaints the button, so a new busy path that writes `busy` directly will leave
  Pause looking available when it is not.
- **What a paused machine refuses is ONE list, `PAUSE_LOCKED`, in one capture click guard.** Load, Insert,
  Reset, Fast Load, the side swap, the ports and the keyboard (his approval covered the last four). Power,
  Eject and Full Screen still work. emu.js also fails insert/type/reset/swap/awaitready/warp at once while
  paused, as a second lock. Eject is not locked: it is one slot switch with no frames in it.
- **`#deck-note` is the strip's message line in full screen** — the same element, not a second spot.
- **The Fast Load fix is ROOM, not the cartridge.** Standing out it hangs below the panel on purpose (the
  travel into the slot is the on/off signal), so `#c64-side` keeps a 26px bottom margin while it is shown.
- **verify-c64's opening hunt takes 12–17s here** and failed 3 runs in 6 under load at 20s, the committed
  code the same as the new. On a failure the rig now shoots `%TEMP%/verify-c64-noram.png`. A run that starts
  at ~16 fps and sticks at `SEARCHING FOR *` cascades into a dozen failures: check the load before the code.
- 📌 Not done: the "PAUSED" sign is a plain placeholder he may restyle; the "CAT computer / Tommodore" name
  is still a placeholder.

## Resolved 2026-09-25 — the C64 corner's screen hunt never gives up, and auto-RUN never fails silently

**Solved:** On a slow boot the corner's own screen hunt used to give up (~22 s after the core started),
leaving the page blind for the whole session: auto-RUN could never see `READY.` and typed nothing, saying
nothing. Now the hunt keeps going until it finds the screen, costs the C64 no measurable speed while it
looks, and can find the screen long after the boot banner is gone. Every time auto-RUN does not type RUN,
the message line says why. verify-c64 now looks every 2 s instead of every 0.3 s and stops at its opening
control, with the real reason, if the corner has not found its own screen. Andrew's rulings of 2026-09-25.

**Approach:** `emu.js` hunts in SLICES — 2 MB of the wasm heap with native `indexOf`, one slice every
100 ms, until one full pass finds exactly one candidate. It hunts TWO landmarks: the boot banner, and the
BASIC + KERNAL RAM vectors at `$0300-$030B` and `$0314-$0333` taken together. `waitReady()` answers why
(`ready`, `started`, `error`, `noscreen`, `timeout`) and `cat.js` `loadThenRun()` says each one but
`ready`. Measured in verify-c64 §P3 and the new opening control; three rounds 155/0, the last at 97% CPU.

**If you touch this again:**
- **Never scan the whole heap in a JS loop on the machine's thread.** Measured: 736 ms per 128 MB pass,
  which starved the core to ~12 fps on a boot and pushed the banner past the old hunt's last look. Native
  `indexOf` does the same walk in ~84 ms; in 2 MB slices the worst slice measured 5–15 ms quiet, 31 ms at
  97% CPU, and the C64 held 50 fps while hunting.
- **The vector landmark is the PAIR, never either half.** Each half alone occurs 7 and 9 times in the heap
  (the ROM images carry the default tables); the two 0x14 bytes apart occur once, where the banner says.
  A game that rewrites the IRQ vector hides this landmark until a reset; the hunt just keeps looking.
- **`CAT_EMU.rehunt()` / `holdHunt()` are RIG-ONLY hooks.** Nothing in the hub calls them. With the hunt
  held, `waitReady()` answers `noscreen` at once so §P3 can prove the message without a 2-minute wait.
- **verify-cat cannot start its second browser above roughly 75% CPU** ("Chrome never opened a debug
  port", in §B3's `crateOn`), measured with 4 and 6 CPU burners. That is NB's `cdp.mjs` launch timeout, not
  the hub. The C64 rig, which runs under Electron, ran clean at 97%.

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

## Pruned 2026-09-26 — Egg Timer's CLAUDE.md, on parking (182 → ~150 lines)

**Condensed out (all still in the packet):** the pilot art's details (each egg mirrored 50/50, ~1 in 6 with the eye,
alien hints from 40 / 50 / 60 / 80%, the cord's egg is the nest's own egg); Follow Progression's ramp (one-phase for waves
1–2, then a placement chance of 0% at wave 3, +10% a wave); Time Warp's placement (the clock in the board's centre, the
caption), and that E39's warp is allowed while a placement waits; the title's singing mommy alien and babies and the
options screen's three-headed singing blob; the sound context's Fang Rock/browser behaviour (E35) and music's 0.5 s fades
and sample-exact loops. **Restructured:** the long "Mess, pieces, hose and trough" bullet split into "Mess and pieces" and
"The hose" (E42, E44), then tightened; also condensed out: the three modes' names, the wave-1 tags' wording, each readout
box fitting its widest reading and darkened boxes on an empty nest, the placement "no penalty for waiting", the Time Warp
step-split and glow (E22) notes, the full reduced-motion list, the sound context and background-tab notes, and the
brief's slot numbers. All are in the packet §§4–12. **Dropped (stale):** the E44 "open" note (ruled and live) and the 2026-09-25 park state.

## Resolved 2026-09-25 — Egg Timer: E44, the nozzle turns with the jet (Chat ruling)

**Solved:** The jet pointed the way of the drag while the nozzle cursor always pointed up-left. Now the nozzle picture
turns with the jet about its tip, swinging, ignoring wobbles, keeping its last direction, up-left at each game's start.
**Approach:** A CSS cursor image can't rotate, so in play `cursor: none` and view.js draws `#nozzle` (position fixed, top
z-index, transform-origin at the tip 3,3) from the document's capture pointermove. One `aim` state (`want`/`shown`) feeds
the nozzle, the jet (`placeJet`, `puff`), the hose's end (back offset 24,24 rotated) and the pieces' reach
(`ET.pieces.spray(x0,y0,x1,y1,jx,jy)` now tests the move and the jet as two segments). `steer()` takes a direction only
after 8 px; `swing()` is a rAF loop, time constant 0.07 s; reduced motion snaps.
**If you touch this again:** rig checks that asserted `cursor: url(` now assert `none` plus the drawn nozzle; a rig drag
done in one `ev()` never lets the swing run (no frames), so read the angle after a timeout.

## Resolved 2026-09-25 — Egg Timer: E43, Time Warp's sound (Chat ruling)

**Solved:** Time Warp starting and ending were silent. Now a rising zap as it starts and a falling one as it ends; nothing
sounds while it runs.
**Approach:** `ET.audio.warp(on)` in audio.js: a saw + square sweep (180 ↔ 1400 Hz, 0.55 s) with a 17 Hz warble through a
low-pass, level `warpZap.gain` 0.014 (0.02 measured over the buzz's loudness limit). Fired from `paintSign()` in view.js
on the change of `snap.warp`; `reset()` clears `sign.was` silently, so a new game never zaps down.
**If you touch this again:** rig section E43 renders fabricated snapshots to count the calls, and reads each sweep's
direction from zero crossings in the offline render (`measure()` now returns `span` and the `buffer`).

## Resolved 2026-09-25 — Egg Timer: E42, the hose blasts instead of trickling (Chat ruling)

**Solved:** The hose's water was three falling drops per move; Andrew's pushed pieces stopped ~80% of the way across.
Now a jet (burst, mist, splash) shows from press to release with a pressure-washer blast; one sweep carries a piece into
the far trough; liquid washes out in ~2 passes. E44 raised: which way the jet points (built: the drag's way).
**Approach:** Measured first: pieces hit `maxSpeed` (2.2 bh/s → slides 1.7 bh) and the board is 2.25–2.74 bh wide. Raised
`push` 0.9 → 1.6 and `maxSpeed` → 2.9 (slides 3.0 bh); `liquid.thin` 0.7 → 0.82. The jet is DOM in `#water` (`.jet`
with `.core`/`.burst`, `.drop` mist, `.splash`), placed by `sprayOn/sprayAim/sprayOff` in view.js; `ET.pieces.spray()`
takes a `reach` that extends its capsule along the jet. `ET.audio.blast(on)`: looped noise, high-pass + peak + a 26 Hz
chug, gain 0.032 (≈ −35 LUFS, K-weighted in the rig), on the `capped()` cap.
**If you touch this again:** a released blast's 0.12 s fade counts on the cap, and in headless Chrome the audio clock is
suspended so it never expires: a re-press must cut the fading tail (`fading` in audio.js) or quick taps go silent.
`ET.view.stopSpray()` ends it on pause (script.js), window blur and leaving play (`ET.view.hose()`). Rig section E42.

## 2026-09-25 — Egg Timer: CLAUDE.md pruned at park (204 → ~155 lines)

**Dropped (stale):** the pilot art "held on `et-pilot-art-hold`" note and the State paragraph about two hold branches
(both merged and live, branches deleted); "break stages and alien hints: art not built yet" (built: pilot hints, E38 parts).
**Condensed out (all still in the packet):** Time Warp's clock size (17% of the board's height, ~27% free between nests);
the board lights' 8-beat rise and fall and why 5% (7% dropped the dim caption under 4.5:1); the Command Lines' hint
styling (grey, 0.8 size) and the Tab / F12 / Esc hint row; the strip's signs all lit under reduced motion; the music
batch's file notes. **Added:** E38 (pieces, push, drips, trough), E41 (no cleanup quota), the unlock-scale and E39
rig traps, and the rule that sheet-gated work waits on its own branch until Andrew's OK.

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
`__col`/`__row` helpers need a column/row clear of the readouts (none spans the whole board at every size). E41 (Chat):
no cleanup quota, as built; cleanup is a timed window and nothing is counted.

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

## Resolved 2026-09-26 — Egg Timer: the break-stage art (E26, brief slot 13)

**Solved:** A cleared egg now leaves one of Andrew's five approved splats in its nest, neat to gross by the clear's tier
(E26), for the nest's "splat" state. All five show at the same size. Shell fragments from his second sheet are laid on
top at runtime: random pieces, shrunk, turned and flipped, 3-4 on stage 1 up to 6-8 on stage 5, every one inside the
splat's outline.
**Approach:** `make-break-art.py` cuts both sheets out of their grey (colour distance from the grey, flood-filled from the
crop's edge, the edge band un-blended) into `files/art/break-*`. `files/core/breaks.js` loads each splat's and fragment's
alpha once and places a fragment only if every solid sample of it lands on the splat's solid pixels. The handoff called
the stage trigger undecided, but E26 already rules it (the tier), so that is what's built. The layer lies over the nest's
front rim: behind it, as the egg is, the lower half of each splat was hidden.
**If you touch this again:**
- Numbers are `breakShells` in `files/core/config.js` [T]. `ET.breaks.check(g)` re-tests a drawn break; rig section BR runs
  750 fills and three real clears (0%, 50%, 90% of the way from bold to hatch give stages 1, 3, 5).
- `fill()` rounds each spot before testing it, so the rig's re-check tests exactly what's drawn.
- A paused game refuses commands: a rig clear must run unpaused, inside one `ev()`.
- E38's flung shell pieces are still cut from the egg picture; the new sprites are only on the splat.

## Resolved 2026-09-26 — Egg Timer: the splat rulings (keep-clear zones, flying shell sprites)

**Solved:** Andrew ruled on the break-stage follow-ups. E26's speed-based trigger stands. Shell fragments on a splat keep
clear of stage 3's antenna (tip included) and stage 4's and 5's eyes and face. The shell pieces a clear flings across the
board are now the same ten shell sprites, plain or mirrored, instead of polygons cut from the egg picture.
**Approach:** `ZONES` in `files/core/breaks.js`: circles in viewBox units measured on the splat PNGs (a chain along the
antenna). `fits()` rejects a fragment with any solid sample in a zone. Stages 4 and 5 then ran short (as few as 4 of 6-8),
so a crowded fragment now shrinks a step every quarter of its 240 tries, down to `breakShells.shrinkTo` (0.7). In
`files/core/pieces.js`, `shard()` picks from `art.shells` (ten sprites plus mirrored copies); the egg picture is still
loaded, only to aim the throw. The unused cut-edge outline colour went with the old `shard()`.
**If you touch this again:**
- The zones are tied to the art: if `make-break-art.py` or the source sheets change, re-measure them. Rig BR checks each
  zone's centre sits on its stage's art, and tests fragment centres against the zones independently of `fits()`. It was
  run against a zones-off build (169/363/356 centres in zones on stages 3/4/5) and caught it.
- `ET.pieces.list()` reports each piece's `sprite`; rig E38 asserts all ten sprites appear, some mirrored.
- Git Bash heredocs here collapse a doubled backslash to one: write a rig's in-template regex escapes with the editor, not a heredoc.

## Resolved 2026-09-26 — Egg Timer: break-stage splat art (closed)

**Solved:** All five break stages show Andrew's approved splats in the cleared nest, speed-based by tier (E26 stands, no
E45), each carrying shell fragments that stay inside the outline and off stage 3's antenna and stage 4's and 5's eyes and
face. The shell pieces flung across the board use the same ten shell sprites. Live on `main` (`77a6b4a`, `979fab8`,
`2be9e36`).
**Approach:** Sprites cut by `Game/cartridges/Egg Timer/make-break-art.py` into `files/art/break-*`; placement and
keep-clear zones in `files/core/breaks.js`; flung pieces in `files/core/pieces.js` `shard()`; numbers in `config.js`
`breakShells`. Details in the two entries above dated 2026-09-26.
**If you touch this again:** The zones are measured on the current PNGs: new art means re-measuring them (rig BR checks
that each zone sits on its art). Rig BR covers files, counts, outline, zones and real clears; rig E38 covers the sprites.
The Rec-Bay 4 table's eggs and splat are Nerva Beacon's (`kitEggTable()` in its `app.js`), not part of this work.

## Resolved 2026-09-26 — the C64 corner's Full Screen, Pause, eject lever and screen hunt

**Solved:** The corner C64 has a Full Screen layout with a breadbin strip, a mouse-only Pause, and Eject drawn as the
1541's door lever. Its own screen search never gives up and costs the C64 no measurable speed, and auto-RUN always says
why it did not type RUN. Andrew ran the checklist on 2026-09-25.
**Approach:** Full Screen/Pause/lever are `f50a662` (branch `c64-fullscreen-pause`, fast-forwarded into main 2026-09-25).
The screen hunt and auto-RUN messages are `71b4060` on branch `c64-screen-hunt`, merged into main as `eed926a`
on 2026-10-01 (Andrew's merge order; not pushed).
Each commit carries its own full entry in this file, placed after the 2026-09-18 C64 audit entry.
**If you touch this again:** Full Screen is a layout (`#cat.is-full`), never the Fullscreen API; the strip MOVES
`#c64-side`'s parts, never copies them. Paused: keydown blocked on window capture in `emu.js`, keyup let through
(measured `$CB` 60→64). Never scan the wasm heap in a JS loop on the machine's thread (736 ms per pass; native `indexOf`
84 ms, sliced 2 MB every 100 ms). The vector landmark is the `$0300`+`$0314` pair, never either half. verify-cat cannot
start its second browser above ~75% CPU (NB `cdp.mjs`), which is a harness limit, not a hub regression. Commit through a `git worktree`, because the Egg Timer
session commits to main in the same tree.

## 2026-10-01 — Egg Timer: CLAUDE.md prune at park (E45–E47, the aliens, the 2026-09-30 requests)

- Dropped from CLAUDE.md: the 2026-09-26 park state (E42–E44 live, "art-slot batch as Gemini's art arrives"), now
  superseded; and "Six Gemini sheets pending" (Andrew approved the six sheets as they are, 2026-09-27; built as puppets,
  `2ac644f`). The octopus and Grabber sheets in the folder were wrong retries; the concept crops stand in (Andrew).
- Kept and added: two rig lessons. The test server (`python -m http.server`) is single-threaded, so preloading the 42
  alien pictures at page load starved the CSV fetches and timed out the loading section; the pictures now preload at
  game start. The hose became per-frame (Andrew, 2026-09-30), so the rig's synchronous `__drag` steps 2 frames of play
  per pointer event through `ET.view.stream(dt)`, which also advances the nozzle's E44 turn.
- Open at park: E48, the exit to the Arcade room (the hub's Exit Game / F12 / `cat:exit` exist; F12 and Esc are taken in
  Egg Timer; Code proposed [Q] on the pause panel with a "Quit this game?" confirm). Next: F3 → COM (all-games rule).

## Resolved 2026-10-01 — Egg Timer: Andrew's 2026-10-01 batch (E48–E51, the jump-scare hatch, How To Play, the cord)

**Solved:** Everything in Andrew's batch and its rulings is live: F3 types `COM`; E48's way out (Q, CAT hub only, a Y/N
confirm mid-game); "Too Early!" for an early `RCAV`; the cord on top of everything; no How To Play on game over; How
To Play in Andrew's five lines with the crab in panel 5; the new hatch (cute: dance and a goofy hop; horror: dance,
freeze, stare and a full-screen jump scare) with its sound; E49 "still", E50 option A (Time Warp 1.5×, under the nests),
E51 (the jet snaps to the way the mouse is going); eight shaky rig checks steadied.
**Approach:** Each change in its own commit, pushed on green rigs (`97ad3f5` … `eb5ad03`; the handoff and rulings filed
verbatim in `Game/cartridges/Egg Timer/Previous Versions/EGG_TIMER_CHANGES_BATCH_2026-10-01.md` and
`EGG_TIMER_E49-E51_RULINGS_2026-10-01.md`). The packet's §11 holds E48–E51 struck. Items that clashed with an earlier
ruling (the bigger Time Warp vs Refinement 6 §2) or left a gap (the hose) were flagged to Chat before building.
**If you touch this again:** The hatch is one CSS timeline as long as `escapeSeconds` (3.2 s); view.js's `stepHatches()`
times the freeze (55%) and jump (78%) on a real-time clock that a pause stops (`body.paused`), because the game's own
clock stops at game over while the last hatch still plays. Those shares live in both `config.js` (`hatchScare`) and
style.css's keyframes: change both. The music hush blocks `duck()` so a THONG can't end the stare's silence. The cord
is in `#cord-top` (z 50); Time Warp's lightning stays in `#cords` under every readout; `#warp` is z-index 0 so the
nests paint over it. E48 posts the hub's own `cat:exit`; `__et.hub(true)` fakes the hub in the rigs. Rig traps: the
resource-timing buffer (250) filled up and broke the font check (the rig sets 5000); split mixed diffs with
`git diff -U1` + `git apply --cached --recount`; Git Bash `sed -i` strips CRs. Still waiting: the horror aliens'
close-up faces from Gemini (spec in the packet under E49), to swap in as the puppet fills the screen.

## Built 2026-10-02 — Egg Timer: one mode, hospital eggs (E52–E56); How To Play cartoon proposed (E57)

**Solved:** Andrew's hospital-eggs handoff, ruled the same way as Code's proposal: one mode, every egg a VS, ~70%
hospital eggs (a blue H road sign) needing `RCAV` then `CAV #### STR` in one hatch window; window 1 scores by tier at
the STR with no splat (Mom repairs the egg: sweet in wave 1, creepy after, each with a placeholder giggle); the STR
runs 10:00, then an ordinary window and RCAV. The three modes, placement triggers, AD's post-it, VF and the type bag
are gone. The How To Play cartoon (six steps, Andrew's captions) is proposed as E57, unbuilt.
**Approach:** Rulings filed verbatim (`Game/cartridges/Egg Timer/Previous Versions/EGG_TIMER_E52-E56_RULINGS_2026-10-02.md`);
§5 and §6 of the packet marked superseded, E52–E56 struck in §11. The game state stays in `game.js` (`hospital`,
`removed`, `repaired` per nest; `repair()` and `clear()`); `snapshot().code` is "" between the RCAV and the STR.
The rigs' mode scenes became `__et.start(boxes, { hospital, minutes })`; logic sections H and U and browser H and R
test the hospital step, every wrong order, the sign, Mom, her giggle and reduced motion.
**If you touch this again:** `hospitalWindowScale` (1) stretches only a hospital egg's first window, for E53's
"propose a longer window" after the playtest. Mom's visit runs on the game's seconds (`stepFixes`), her CSS on real
time, so a rig that drives the clock with `__et.advance` sees her CSS frozen near its start: screenshot her in real
time. The H sign's 0.45 s drop starts over whenever it's shown, so measure it with its animation off (layout rig L).
Sweet Mom is the how-to doodle, so its colour rules are `:is(.howto-panel, .momfix) .doodle …`. The theme baseline
was rewritten for these style changes.

## Built 2026-10-02 — Egg Timer: E57, How To Play as a six-step animated cartoon

**Solved:** Andrew approved E57 as proposed: the five-panel strip became a six-step cartoon (lay, crack, fast clear,
slow clear, hospital egg with sweet Mom, the crab's hatch), his captions word for word, the same on the title card and
the options panel, on one clock, silent; reduced motion shows a still strip of six key frames.
**Approach:** `core/howto.js` builds a stage from the game's own pieces (`ET.art.nestSvg`, the readout, the H sign,
the pan, `ET.breaks.fill`, the alien puppet, Mom's `.momfix`) and paints it from (step, seconds into it), so
`ET.howto.at(t)` holds any moment for the rig. The nest's state looks are shared through `:is(.nest, .toon)` selectors
and the cord's through `:is(#cord-top, .toon-cord)`; the cartoon's nest is `.toon`, never `.nest`, because the rigs
count `.nest` as the board's 12. Ruling filed in `Game/cartridges/Egg Timer/Previous Versions/EGG_TIMER_E57_RULING_2026-10-02.md`.
**If you touch this again:** only copies whose screen isn't hidden are painted (an attribute check, so play pays no
layout); the still strip paints once on screen (its cord is measured). The crab's scurry is cut short on the stage
(`--dir: 0.4` on `.toon`). Section P of the browser rig now holds the game (Esc) the moment Time Warp is found:
the live clock used to run the warp out between its checks under load.

## Resolved 2026-10-02 — Egg Timer: hospital eggs (one mode) and the How To Play cartoon (E52–E57)

**Solved:** Egg Timer has one mode: every egg a VS, ~70% hospital eggs needing `RCAV` then `CAV #### STR` in one
window, Mom repairing the egg at the STR; and How To Play is a six-step animated cartoon with Andrew's captions. Both
are ruled, built and live on `origin/main` (`2c4a80a`, `17a5485`; pushed through `5464b52`).
**Approach:** Built exactly as Code proposed and Andrew ruled (rulings verbatim in `Game/cartridges/Egg Timer/Previous
Versions/EGG_TIMER_E52-E56_RULINGS_2026-10-02.md` and `EGG_TIMER_E57_RULING_2026-10-02.md`; packet §11 E52–E57 struck).
Mechanic in `files/core/game.js` (`hospital` / `removed` / `repaired`, `repair()`, `clear()`); the cartoon in
`files/core/howto.js`; the earlier "Built 2026-10-02" entries above hold the implementation notes.
**If you touch this again:** `hospitalWindowScale` (1) is the only sanctioned lever if Andrew's playtest finds the
window tight, and a longer window goes to Chat as a proposal first; spawn rate is likewise tuned only after that
playtest. The H sign and both Moms are placeholders until Gemini's parts kits (spec under E55). The cartoon's nest is
`.toon`, never `.nest` (the rigs count `.nest` as the board's 12). The first push also published PLC's 9 commits on
Andrew's word, and the PLC session was told.

## Built 2026-10-02 — Egg Timer: the Mom kit (both Moms, edge entry, drool, splat, tongue); E58 open

**Solved:** Mom's repair uses Andrew's approved Gemini parts kits (sweet Mom: wave 1 and the How To Play cartoon;
creepy Mom: wave 2 on), with one animation for both. Chat's brief (filed verbatim in `Game/cartridges/Egg Timer/
Previous Versions/EGG_TIMER_MOM_KIT_RULINGS_2026-10-02.md`) rules: **she comes in from the play-field edge nearest the
egg** (replacing E55's over-the-nest visit), never covering a timer, nest, readout, Command Line, the trough or the sink;
**creepy Mom's drool, its splat and her tongue's wobble are drawn in code; sweet Mom never drools.** Six commits, one a
section: `3a9462a` cut-outs, `9dba590` the art in the visit, `d2e90c1` edge entry, `7e8dc0a` How To Play step 5,
`44a40cb` drool and splat, `2b44c16` tongue. Not pushed (push rule, root `CLAUDE.md`).
**Approach:** `make-mom-art.py` cuts the ten pictures (white joined to the edge goes, a band un-blended so the outline
stays crisp; one crop box per Mom's three heads; the creepy tentacle flipped, the creepy plaster turned and scaled to
the sweet one; the sweet plaster's speck painted over; warts drawn outside the creepy outline cut off) and writes
`core/mom-parts.js` (sizes, anchors). `core/mom.js` is the rig, painted from the game's seconds (`momTimeline`).
`view.js` places her: edges nearest first, her head swept along each and a little in, until head (upright and turned),
slide-in path and both tentacles (their whole S-curve band) clear every obstacle. Where none does (the board's middle
nests), **E58** (⏳ PENDING, `momNoEdge`: "nest", built, inside her own nest's box; or "over"). The drool's landing is
picked before she comes, on the floor canvas (so the hose washes the splat off like any goo), the splat and the drop's
fall clear of everything; with nowhere clear, the drop fades out and leaves nothing. The tongue: an SVG displacement
filter whose map is flat outside the tongue's oval (no seam).
**If you touch this again:** Pillow 12 won't flood-fill an image made straight from a numpy array (copy it first; it
cost an out-of-memory run). `.drop` is the hose's mist class (it animates to opacity 0): Mom's drop is `mom-drop`.
The visit stores her edge in `m.edge`; `m.from` is the egg's crack at the start (the mend). The egg's pictures are
full-slot layers, so its box comes from the nest's units through the egg's screen transform, never from the shell
image's rect. Rig L checks every nest, both Moms, all four sizes (H signs up); rig H drives a real visit with
`ET.view.momVisit(id, kind)`.

## Ruled and built 2026-10-02 — Egg Timer: Chat's Mom kit rulings (the giggle hold, E58 "nest", the purple drool)

**Solved:** Chat's four rulings on the Mom kit build (filed verbatim in `Game/cartridges/Egg Timer/Previous Versions/
EGG_TIMER_MOM_KIT_FOLLOWUP_RULINGS_2026-10-02.md`). **The giggle (flash safety):** pose C is held 0.6 s with a gentle
bob, one swap in and one out, never more than 2 pose changes in any second (it was C ↔ B twice, four swaps in 0.3 s);
reduced motion: no bob, and the tongue wobbles for the whole hold. That doesn't fit the old 1.5 s visit without
speeding something up (which the ruling forbids), so **the visit is 2.2 s** (`momRepairSeconds` [T], flagged to Chat);
How To Play's step 5 grew from 3.5 to 4.4 s to fit it. **E58: "nest"** (as built): with no clear edge she comes down
inside her own nest's box. Its conditions: (a) her head and tentacles never cover a readout, her own included, so the
unit number and timer stay in sight all visit; (b) her head is under about 60 px only in that fallback, on the three
smaller screens (as small as 34 × 39 px at 1024 × 640; the packet's E58 lists every nest). **The drool, the drop and the
splat are glowing purple** (were yolk yellow), outline and glossy streaks kept, with a steady soft halo that follows the
shapes; the halo widens the safe-landing check and washes off with the splat.
**Approach:** `momTimeline` and `momDrool` moved from shares of the visit to seconds, so lengthening the visit kept
everything up to pose B at its old moments; the crack's mend is `momTimeline.mend` (it was hard-coded twice). The halo:
a CSS `drop-shadow` on the drool's SVG (strand, drop) and a canvas shadow under the splat and its droplets on the floor
canvas. Colours: `--mom-drool*` in `theme.css` (theme baseline rewritten; 4 rules changed, all the drool's).
**If you touch this again:** `ET.mom.pose(u)` takes a share, but the timeline is in seconds; anything comparing
`momTimeline` to a share is a bug (the giggle sound's trigger was one, caught by rig H). Rig H counts every pose change
through a visit (5 ms steps) and scans the floor canvas for any halo pixel over an obstacle; rig L prints each size's
small heads as a note.

**Known facts (Chat, 2026-10-02, later):** Chat approved the **2.2 s visit** (the 2-pose-changes-a-second rig check
stays) and the **steady** glow (no pulse); the giggle sound stays where it is, as she turns to face the player (Andrew
judges it in Rec-Bay 4). **How To Play's step 5 is 4.4 s** (was 3.5) to hold the visit. **Small heads (E58's
"nest" fallback only; every edge entry is full size), no change yet:** 1920 × 1080 none (smallest 71 px); 1440 × 900
nests 9 and 10 (and 1, creepy) 55 × 63 px; 1280 × 720 nests 9 and 10 40 × 46 px, nests 5, 8 (and 6, 11, creepy) about
54 × 62 px; 1024 × 640 nests 9 and 10 34 × 39 px, nests 5, 8, 11 (and 6, creepy) about 47 × 53 px (nest numbers as rig L
counts them). Chat is checking with Andrew what screen sizes real stations use; if any run below 1920 × 1080, a ruling
for nests 9 and 10 follows.

## Resolved 2026-10-02 — Egg Timer: the Mom kit (both Moms, edge entry, E58, giggle hold, purple drool)

**Solved:** Mom's repair uses Andrew's two Gemini kits (sweet Mom wave 1 and How To Play, creepy Mom wave 2 on), comes
in from the nearest clear edge or, with none, inside her own nest's box (E58 "nest"), never over a readout; the visit
is 2.2 s with pose C held 0.6 s (at most 2 pose changes a second); creepy Mom's drool and splat glow steady purple.
All ruled by Chat and LIVE on 2026-10-02 (pushed `5464b52..8ecd2d9` on Andrew's OK).
**Approach:** `core/mom.js` paints the visit from the game's seconds (`momTimeline`, `momDrool`, in seconds);
`view.js` picks her edge and the drool's landing, glow included, before she comes; the splat and its halo are on the
floor canvas (`mess.js` `drool`), so the hose washes them off. Colours: `--mom-drool*` in `theme.css`.
**If you touch this again:** commits `bd14b3e` (giggle + E58), `fb79f95` (purple glow), `fb76814`/`8ecd2d9` (filing);
rulings verbatim in `Game/cartridges/Egg Timer/Previous Versions/EGG_TIMER_MOM_KIT_FOLLOWUP_RULINGS_2026-10-02.md`.
`ET.mom.pose(u)` takes a share of the visit but the timeline is in seconds: compare `u * momRepairSeconds`. Rig H's
2-changes-a-second check stays (Chat). Still open elsewhere: heads under 60 px in the "nest" fallback below
1920 × 1080 (nests 9 and 10 down to 34 × 39 px), waiting on Chat's check of real station screen sizes; Andrew judges
the giggle sound and the glow in Rec-Bay 4.

## Resolved 2026-10-02 — Egg Timer: the 20:05 push check (`5464b52..8ecd2d9`)

**Solved:** The 20:05:49 push of `main` (`5464b52..8ecd2d9`, 15 commits) went out on Andrew's own OK for that push.
It complied with the root `CLAUDE.md` rule.
**Approach:** Checked against the `origin/main` reflog and that Egg Timer session's transcript (`b18d46a9…`).
Chat's pasted ruling said "push now"; the session refused to treat that as an OK and listed all 15 commits, including
another session's `1e9f12f` and `b56bc0c` (`Game/fangrock-app.json`). Andrew replied "Push" (a typed message, not a
paste) at 20:05:40, and the push followed 9 s later.
**If you touch this again:** the commits pushed are exactly the 15 listed before asking. A pasted Chat line saying
"push" is not Andrew's OK; only his own word in the current conversation is. The transcript can't show who typed the
reply, only that it wasn't a paste. Left unpushed after it: `101b77e` (docs only).

## Resolved 2026-10-02 — the C64 corner: keyboard and joystick live together, Help, the deck's groups (merged into main)

**Solved (on branch `c64-both-live`, pending Andrew's hand-test and his approval of the Help wording):** Chat's
handoff "Keyboard and Joystick Live Together" and his rulings the same day, plus Chat's items 7 (Help) and 8 (groups).
The corner has no keyboard/joystick mode: every key types on the C64, Ctrl (either) is fire, the arrow keys drive the
stick by default or are the C64's cursor keys per title (side panel's Arrows switch, or F2), F9 and the ports only change
the port, Left Alt is C=, and VICE's Right Ctrl port-swap hotkey is off. Remembered input is `{port, arrows}` per title;
old one-string values migrate ("keyboard" → arrows on the cursor keys). Help is a breadbin-sticker label that pauses
the machine and resumes it on close only if Help paused it. The deck's Load + Run and Load "$" + List sit in etched
Start / Directory groups; in full screen the Start group moves into the strip whole.
**Approach:** Measured first, on the running core (BASIC loop printing `$DC00/$DC01/197/653`): `simulateInput` drives
the stick with `keyboardInput` on, so emu.js drives the stick itself; EmulatorJS's `keyChange()` is what made the old
modes exclusive. Double duty (an arrow as stick AND cursor key) was DROPPED: at READY a pushed port-2 stick hides the
row-0 cursor keys from the C64's scan (cursor never moves, even on a tap) and a port-1 stick types its own characters —
the machine's wiring, not a setting. Keys struck while firing go to the C64 as clean copies without the Ctrl flag.
**If you touch this again:** Left Ctrl was the C64's C= key and Tab is its CTRL (positional keymap, measured). A held
port-2 fire or stick masks the KERNAL keyboard scan, and port-1 stick/keys cross-talk: authentic, ruled no workaround.
Fang Rock's Ctrl+M (minimise) is taken by the shell before the page sees it, so fire + M minimises the arcade — out of
scope here, Andrew is raising it with the Nerva Beacon session. The ordinary hub's play overlay keeps the old F2/F9
input-mode behaviour (non-MACHINE paths in emu.js are unchanged).
**Public build (Andrew's ruling, `12a9669`):** with no emulator core (the Pages site), the machine shows one plain plate,
"Available in Fang Rock only", tells the hub `cat:nocore` (quiet, deck inert), and puts the install text in the console;
the ordinary hub's "not readable from this origin" line moved to the console too. Help wording approved by Andrew with
his four changes (`e5edf4a`). Merged into main on his go, 2026-10-02.
**Tests (2026-10-02, worktree served on :8897):** verify-cat **214/0**. verify-c64 **206/1**: the one red is the opening
`[control] the machine is running` (14 frames in its first second); a scratch probe measured main and the branch alike at
6–15 frames in the first second after boot on this loaded machine, so it is load, not this change. One earlier run
cascaded from a stray empty-drive `LOAD"*",8,1` stuck at SEARCHING after §F2 — the intermittent already logged on
main; it did not recur.

## OPEN 2026-10-02 — the C64 corner: an empty-drive LOAD can hang at SEARCHING (pre-existing)

**Symptom:** `LOAD"*",8,1` with the 1541 empty sometimes never comes back: the screen holds `SEARCHING FOR *` and the
drive stays busy. **Measured 2026-10-02** (scratch probe: machine page, up to 30 empty-drive loads per fresh boot, with
and without a tape loaded and ejected first): main hung on 6 of 10 boots (6 in 228 loads, 2.6%), the `c64-both-live`
branch on 7 of 10 (7 in 197, 3.6%) — the same rate, so it predates that branch. First hang anywhere from load 6 to 29.
**Players can reach it** (the Load button and a typed LOAD both work with an empty drive), but it is **recoverable**:
in all 13 hangs, Reset (F12) brought the drive back and the next load worked. Cause not yet found.
**It is what cascades verify-c64**: §F2 presses Load twelve times on an empty drive, and one hang there fails every
section after it. Treat that cascade as this known bug, not a blocker, and do not loop re-runs for it (Andrew).
**Fix for later (Andrew, 2026-10-02):** (1) disable Load, and show "No disk in drive", while the drive is empty;
(2) have verify-c64 §F2 reset the machine between its empty-drive loads, so this bug cannot cascade through the rest
of the rig. Root cause still wanted.

## Resolved 2026-10-02 — the C64 corner release (keyboard + joystick, Help, public build) is live

**Solved:** The C64 corner's keyboard-and-joystick input, Help sheet and deck groups are on `main` and the public Pages
site, pushed on Andrew's OK as `8ecd2d9..fabec48` (13 commits). The public build, which has no emulator core and no
disks, shows only "Available in Fang Rock only" and no install, error or internal text.
**Approach:** Built on branch `c64-both-live` in a worktree outside OneDrive, merged `main` into it four times (each a
`docs/decisions.md` end-of-file conflict, both sides kept), then fast-forwarded `main`. `12a9669` makes a missing core a
supported state (`noCore()` in `Game/C64/emulator/emu.js`, `cat:nocore` in `cat.js`). `fabec48` untracked
`Game/C64/verify-cat-*.png` and ignored them, because they show the Cracked crate's title list. History was not rewritten.
Fang Rock now reads the Arcade from `Game/fangrock-app.json` (`1e9f12f`, `b56bc0c`; minimise null, so Ctrl stays fire).
**If you touch this again:** The design and measurements are in the entry above ("keyboard and joystick live
together"); the empty-drive SEARCHING hang is the OPEN entry. An §F2 cascade in verify-c64 is that known bug, not a
blocker, and is not re-run for. `git commit -- <paths>` after `git rm --cached` re-adds the files from the working
tree: commit the staged removal without a pathspec. No session pushes without Andrew's OK (`CLAUDE.md` at the repo root).

## Built 2026-10-03 — Egg Timer: Chat's playtest rulings (six items); E59 and E60 open

**Solved:** Chat's playtest message of 2026-10-02 (the second, which replaced the first; both filed verbatim in
`Game/cartridges/Egg Timer/Previous Versions/EGG_TIMER_PLAYTEST_RULINGS_2026-10-02.md`), built one commit an item, both
rigs green after each (logic 206/0, browser 634/0 at the end), **not pushed**. **1** "every egg is a VS" was E54's own
ruling (`2c4a80a`), not a regression; the pre-E54 type bag is back as a switch, **E59** (`5267498`). **2** a hospital VS
egg's accepted RCAV restarts its countdown at 12 s, flat (`hospitalResetSeconds`); window 1's tier is taken at the RCAV
and paid at the STR; Time Warp ignores the waiting egg (`f45aaa0`). **3** a code-drawn "Patient Refused" bubble on VS
refusal eggs, above the timer until the RCAV; the H sign already sat above its timer (`8db0a0a`). **4** Time Warp's sign,
caption and lightning hot red, each darker than the mint it replaced (`44d5a0a`). **5** the HUD popup face is the Mom
kit's head, pose A, sweet then creepy; the old drawn face, its rules and its eight `--mom-*` colours are deleted
(`4e3c875`). **6** the rejected-Enter words show at Time Warp's clock on a dark plate with a light outline, over the
wave banner; a repeat restarts the time without going off and on (`6c44cfc`). Packet §11 "Raised by Chat's playtest"
has every number.
**Approach:** each item's switch or number sits in `config.js` (`eggTypes`, `hospitalResetSeconds`, `refusedBubble`,
`rejectPlace`); colours in `theme.css` (`--refused-*`, `--warp-red*`, `--reject-*`; theme baseline rewritten each time
for that item's rules only). The rig hook `__et.start` keeps its scenes all-VS (`{ eggTypes: "VS" }`) unless a scene asks
for the bag. The hospital egg's crack carries on from where it was through the restarted window (`crackAt`, `resetAt`).
`#reject` lives in `#field` (z 41, over the banner's 40), placed by `placeReject()` from the clock's measured box.
**If you touch this again:** **E59** (which types, MB, VF, AD's post-it, the hospital share now that only VS eggs
qualify) and **E60** (directly above the clock is where the top row's middle readouts sit at every size, so "drop" moves
the words onto the clock's top: 65/62/61/52 px of a 208/164/119/103 px clock) wait on Chat. Item 2's "starts when sweet
Mom's visit ends" line is withdrawn (Chat, 2026-10-03): Mom comes at the STR, after the 12 s, so the reset needs no
change. The bubble covers a word or two
of Time Warp's caption at 1440 × 900 and smaller (bottom row, second nest); not "crowded" by the rig's rules. Measure
anything over a nest after its 0.4 s unlock (`offsetWidth`, not the bounding box), and a rejected Enter needs the game
unpaused (a paused game blocks `submit`).

## Built 2026-10-03 — Egg Timer: Chat's E59/E60/bubble rulings, and the AD note back

**Solved:** Chat's rulings (filed verbatim in `Game/cartridges/Egg Timer/Previous Versions/
EGG_TIMER_E59_E60_RULINGS_AND_AD_NOTE_2026-10-03.md`): **E59** keep the bag, keep MB, keep 70%; VF stays out (open,
Andrew's). **The AD "Clear @ HH:MM" note is back** (`97a64c8`): E1's whole-minute bold on the wall clock, the 2026-09-23
LED look, in a new spot: stuck on beside its own nest at the egg's height, tilted, outer side, else inner, else up by
its own shoulder. **The bubble** that met Time Warp's caption (the bottom row's inner-left nest, 1440 × 900 and smaller)
flips to its nest's other shoulder (`bf1f33a`). **E60 "drop" approved**, but the dropped words cover the clock's face,
hands and centre (and the reduced-motion "5×") at every size; Code proposed the pendulum window (fits at all four sizes)
and changed nothing. Not pushed. Rigs at the end: logic 211/0, browser 642/0.
**Approach:** `placeBubble()` / `placeNote()` in `view.js` measure once the marker shows (never mid unlock pop) and again
after a resize; `ET.view.placeBubbles()` and `ET.view.fillNote(id, note)` let rig L place them as a frame would. The
note's keep-off list covers where every other nest's H sign and bubble can go (either shoulder), shown or not, so a
marker that appears later can't land on it; another note already up is avoided too.
**If you touch this again:** rig L measures the note in two worst cases (one at a time with every other nest's markers
up; all 12 at once), since a nest with a note never has a marker of its own. A rig check that sets `style.animation =
'none'` must put it back, or a later "it drops in" check fails. The AD-at-the-wall-clock test clears the rest of the
board as it goes, or the pool runs dry before the AD's minute.

## Built 2026-10-03 — Egg Timer: Chat's combined batch, Parts 0–2; stopped at Part 3 (E61)

**Solved:** Chat's combined batch (filed verbatim in `Game/cartridges/Egg Timer/Previous Versions/
EGG_TIMER_COMBINED_BATCH_2026-10-03.md`; it replaces every earlier queued message). **Part 0** answered from the code
(packet §11): the command table matches Chat's assumption; only the "Clear @" AD note exists; the hose cursor is a
yellow nozzle on a green stub; the title's mommy is a reusable code replica, How To Play uses the game's Gemini art;
the options screen has 736–1478 px of width beside its How To Play panel. **Part 1, E60** (`b28af64`): the error plate
sits in the grandfather clock's pendulum window (between face and sign), a pinball backglass sign with a bulb ring
(one flash each 1.2 s), its type shrinking to fit on small screens. **Part 2, VF** (`e35c68c`): back in the bag (one egg
in six); FUELING / DONE in its timer box; a code-drawn alien pump in the egg. **Stopped at Part 3** as the ground rules
say: its row 1 puts the "Patient Refused" bubble beside SS, EOS and MB eggs, which the 2026-10-02 ruling gives to VS
refusal eggs only; plus row 3's "how long" note that doesn't exist and where the options screen's How To Play panel goes
(**E61**). Parts 3, 4 and 5 not built. Not pushed. Rigs at the end: logic 212/0, browser 653/0.
**Approach:** `placeReject()` reads the face's and sign's boxes each time a message shows; the bulbs are a dotted
`::before` border swapping colour on a 1.2 s `steps(1)` cycle (rig: at most 2 swaps in any second, none under reduced
motion). VF's FUELING is the timer box's own text at 0.7 em with its line height and min-width scaled back up, so the box
keeps its MM:SS size; DONE reads the snapshot's new `sinceBold`. The pump is a `<g class="pump">` in the nest's SVG,
shown by `.nest.fueling` / `.nest.fueled`.
**If you touch this again:** a rig scene that fakes a state on every nest must stub `ET.view.render` first, or the next
frame repaints it away. The bulbs at a 1 s cycle (a swap every 0.5 s) sometimes measured 3 swaps in a second from frame
jitter; 1.2 s can't. The reduced-motion check on Mom's fade (rig R) once read 1.00 on a busy machine and passed on the
re-run.

## Built 2026-10-03 — Egg Timer: E61's wording ruled, How To Play's replicas (Part 5), a steady Mom-fade check

**Solved:** Chat's rulings (filed verbatim in `Game/cartridges/Egg Timer/Previous Versions/
EGG_TIMER_E61_PART5_RULINGS_2026-10-03.md`): **E61**'s rows are settled (row 1: a VS egg with its "Patient Refused" bubble
beside plain SS, EOS and MB eggs; row 3: "Clear it at the time on the note."; no length note), but **the reference's
place, the menu move and Part 4 wait on Andrew**; the How To Play panel stays. **Part 5** (`0157faf`): How To Play's
step 5 Mom and step 6 hatchling are the title screen's code-drawn mommy and two-antenna baby, animated as on the title;
the nest and egg stay the real art; the game's Gemini Mom and the crab are not drawn there. **The reduced-motion Mom
fade check** is deterministic (`eea0dc9`). **Push control (Chat):** on Andrew's "push", only through `625d7b4` plus
PLC's `28ca78d`, unless he names a later commit. Not pushed. Rigs at the end: logic 212/0, browser 653/0.
**Approach:** `core/title.js` exports `mommy()` and `baby()`; `howto.js` puts a baby (scaled 0.85) in each stage's
creature slot (`has-art`, so the crab never fills it) and builds step 5's Mom as a clipped SVG painted from the step's own
clock (in and out over 12% of her visit each, held still under reduced motion), with a CSS plaster shown from
`momTimeline.mend[0]`. The family's styles now read `:is(#title-scene, .replica)`, and the reduced-motion block stops
their loops by name, since those ID-weighted rules outranked the plain `* { animation: none }`.
**If you touch this again:** `.creature .eye` (the hatchling's red eye) would win over a `:where()`-weighted replica
rule, so keep the `:is(#title-scene, .replica)` weight. Andrew's step 6 caption still says "the crab": his to reword.

## Built 2026-10-03 — Egg Timer: H sign 1.4× + hospital, amber bubble + house, bounce, hatch slime, VF out

**Solved:** Chat's message (filed verbatim in `Game/cartridges/Egg Timer/Previous Versions/
EGG_TIMER_SIGNS_SLIME_VF_2026-10-03.md`), one commit an item, both rigs green each time (logic 213/0, browser 663/0 at the
end), not pushed. **A** (`4aab051`): 1.6× didn't fit (nest 6's sign meets a readout at 1440 × 900 and 1024 × 640), so the
H sign is **1.4×**, with a code-drawn hospital on the other side of the egg, skipped where there's no room (nests 6 and
9 at the two smaller sizes). **B** (`ab501ed`): the bubble about 1.27×, amber with dark lettering, and a code-drawn
house. **C** (`2c6d690`): one bounce a second, half a bounce apart, as a dip below the resting place. **D** (`23fc305`):
purple slime where a horror alien hits the screen, under Time Warp and every nest; the jump happens in one place only.
**E** (`ecfe1ef`): VF out of play behind `vfInPlay`, its code and art kept; the types reference is three rows. **F**
(`214c4b0`): step 6 says "the baby" (flagged; Andrew's wording); the How To Play bubble is on hold.
**Approach:** `placeMarks()` / `decideMarks()` in `view.js` place a sign or bubble and its building from layout boxes
(`offsetLeft/Top` added to the nest's box), so a drop-in or bounce under way can't move the answer; a building is laid
out unseen (`visibility: hidden`) while it's measured. `markFootprint()` gives the AD note each neighbour's marks exactly
where the game puts them. The bounce is one more animation after the drop / fade (`mark-bounce`, transform only). The
slime is a board layer inserted before `#warp`, removed on its fade's `animationend`.
**If you touch this again:** a hidden element measures as a zero box, which always "fits": lay it out unseen first. A
hand-made `{left, top, right, bottom}` box has no `width`, so filter keep-off lists on `right - left`, never `width`
(this silently dropped every nest body and neighbour zone from the AD note's checks until now). The bounce must never
rise above where a mark stands: at the two smaller sizes the readouts above leave no room.

## Built 2026-10-03 — Egg Timer: tabs on the timer (G), buildings behind (H), AD note (I), CAV/STR (J), inversion (K), slime near its nest (D2)

**Solved:** Chat's two messages (filed verbatim in `Game/cartridges/Egg Timer/Previous Versions/
EGG_TIMER_TABS_INVERT_SLIME2_2026-10-03.md`), one commit an item, both rigs green each time (logic 213/0, browser 673/0 at
the end), not pushed. **G** (`28f6f18`): the H sign (1.6×: it fits as a tab) and the bubble are tabs on the timer box;
the bubble falls back to the shoulder on a few nests at the smaller sizes. **H** (`488e023`): buildings behind the nest,
skipped on nest 6 (and 7 at 1024 × 640). **I** (`b203a07`): the AD note ×1.25 where it follows the nest's size (1.5×
doesn't fit: nest 4). **J** (`2e047e9`): CAV / STR in turn in a waiting hospital egg's type box. **K** (`8c15583`):
overrunning timer boxes swap colours, 2 s apart down to 0.5 s, restarting slow at a hospital RCAV. **D2** (`86f1a7a`):
the slime lands at the clear spot nearest its nest, never over anything; twice D's splat never fits with 12 nests live,
so it lands at about 0.4 of that. **Fix** (`06cc26f`): live play had never placed signs, bubbles, buildings or notes.
**Approach:** the tabs are children of `.readout` (position: relative), CSS places them (`.tab-b`; the right-hand tab is
the default); `decideMarks()` tries right, below, shoulder, measuring with `#board.widest` (every readout bold). Buildings
are `z-index: -1` inside the nest's stacking context. J/K are painted from the snapshot's `sinceRemoved`, `winStart` and
`winShare`, on the player's seconds. The slime's `slimeSpot()` grid-searches the floor inside the trough against
`slimeObstacles()`, largest scale first.
**If you touch this again:** `.nest.unlock` stays on after its 0.4 s pop: test the running animation
(`getAnimations()`), never the class (this hid every placement from live play since `bf1f33a`, while the rigs placed
through a hook). A readout's children now include the tabs: take `:scope > span` for its three boxes. Hand-made boxes
need `right - left`, not `width`. Measure tabs with readouts at their widest. Placement keeps half a pixel clear and leaves
room for the bounce's dip.

## 2026-10-03 — Egg Timer: CLAUDE.md prune at park (after the playtest batches)

Moved out of `Game/cartridges/Egg Timer/CLAUDE.md` (the detail is in the packet's §11 and the entries above): the long
hospital-egg / Mom-visit paragraph (the giggle hold, E58's fallback, the drool's halo, the edge entry) now one line;
the per-batch commit ranges and Chat's "push only through 625d7b4" (superseded by the root rule: a session pushes only
its own commits); the hose's E44/E51 aiming detail; the comic strip mention (E57 replaced it); per-file module notes.
Kept: every standing rule, the rig traps (now including the `.unlock` class that never leaves), and the locked design.


## Built 2026-10-04 — the C64 corner: the stuck drive is reset by itself (the OPEN 2026-10-02 hang)

**Solved:** The hang in the OPEN 2026-10-02 entry is recovered, not prevented. **Measured 2026-10-04** (a scratch probe
clicking the real hub, ~340 loads): about 1 LOAD in 40 that ends in "file not found" never comes back. That held on an
empty drive, a blank disk, and a REAL disk with a wrong name, tape or no tape; the traps lead was wrong (load timing
is identical after a tape and with the traps forced on). The C64 waits on drive 8 forever, RUN/STOP does nothing, a
reset recovers it. The fault is inside the emulator core's 1541 and cannot be fixed here; the core exposes no drive
option for it. Andrew's rulings the same day: (1) a stuck drive resets the C64 by itself, the disk stays in, and the
message line says why; (2) F12 works at all times; (3) Load with no disk says "no disk in the drive." and types nothing.
**Approach:** `emu.js` `watchDrive()` (machine page only) posts `cat:drivestuck` once when the last screen line starts
`SEARCHING FOR `, the screen has not changed for 1000 EMULATED frames (20 s), no tape is in and nothing is being typed.
`cat.js` resets through `machineReset("stuck")` unless a hub-started game is running or the machine is paused.
`machineReset` no longer waits for `busy`; a reset in flight is its own busy flag (`resetting`, `syncBusy()`), and
`resetSeq` lets `loadThenRun`/`pressDirectory` see their wait ended in a reset and stay quiet (no RUN, no LIST).
verify-c64 §F2 replaces its twelve empty-drive presses with: no disk, a real not-found at the 20 s wait, the stuck path
(`CAT_EMU.rigStuckAfter(10)` makes a real search count as stuck), and F12 mid-load. New rig disk `zz CAT rig gone`
(its manifest names a file it lacks) serves §F2, §Q's blink and §P3. verify-c64 235/0 twice, verify-cat 227/0.
**If you touch this again:** the real fault cannot be made on demand. An empty-DIRECTORY disk did NOT hang on
2026-10-04 (3 of 3 answered), contrary to the 2026-10-03 note. A typed LOAD with no disk still reaches the machine;
only the button stops. The watch ignores LOADING, FOUND and tapes by design (his ruling): a hang there is F12's.

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

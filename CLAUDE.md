# PowerLine Challenge — rules for every session in this repo

This file sits at the repo root, so every Claude session working anywhere under `(PCL)` loads it:
the root PLC session, every cartridge session (Egg Timer, Asteroid Command, The Aquanaut, Pitstop),
and anything else opened in a subfolder. Folder-specific rules live in `Game/CLAUDE.md` and each
cartridge's own `CLAUDE.md`.

## ⏸ Parked work — read `MEMORY.md` in this folder

The root PLC track (resume word **`Continue_PLC`**) keeps its one-shot handoffs in `(PCL)/MEMORY.md`
→ `(PCL)/memory/`. That file is not auto-loaded, so read it when `Continue_PLC` is typed.
- C64 corner (`Game/C64/`): Phases 0-5d built; live on Pages to `714adb5` (2026-10-07). Local, not pushed:
  `13bb666` (deep-red port header, superseded), `4ecfa62` (game list keyboard), `486ed05` (amber port header).
  ⏸ Open: "Cursor" (which element? ask Andrew); the Swap Disk flash report. History in `docs/decisions.md`.
  Double-sided rules (`library.js` mapSides): `- dN` is side N (d1/d2 = Disk 1, Side A/B); d0 is its own disk,
  numbered in order; Test Drive II, Ultima II, Ultima III are on NO_SIDES. Wording "Disk 1, Side A" / "Disk 3".
  The game list's keys: whoever has DOM focus has the keyboard (the list on first open and after a row click).
  Left for Andrew to judge live: the latch icon size, a full-screen swap status message.
- Adding a game to the C64 corner (Andrew): (1) copy the file(s) into `Game/C64/roms/`, sets named
  `Title - d1.D64`, `Title - d2.D64` … (marker at the END; tapes .t64/.tap group the same way); (2) reload the hub
  page, no restart or build; (3) optional: add the title to `roms/_library.json` BY HAND for Load choices or a
  starting port; (4) nothing to commit, roms/ is git-ignored. A title whose files are separate disks, not sides,
  goes on library.js's NO_SIDES list. Unmarked names = a single game; subfolders of roms/ are not read.
- Swap loses disk saves (a fresh image each time): parked, not fixed.
- Load on an empty-directory disk can hang the hub: not reproduced on 2026-10-04 (3 of 3 answered), probably gone.
- The stuck-drive Load hang (about 1 "file not found" load in 40, inside the emulator core): recovered, not prevented.
  The corner resets by itself with the disk in (`1c27d2b`, docs/decisions.md "Built 2026-10-04").
- verify-c64's Pause check "a key held when Pause was clicked … is not stuck down on resume" is flaky: about 1 run in 3
  on 2026-10-04 it reads `$CB 64 -> 64`, i.e. the held key never registered (a dropped keystroke, not a stuck key).
  Parked, not fixed (Andrew, 2026-10-04): re-run once; do not loop.

## 🚫 Never push `main` without Andrew's explicit OK

Standing rule, Andrew, 2026-10-02. **Do not `git push` `main` (or any branch to `origin`) unless Andrew
has said OK to that specific push in the current conversation.** Passing rigs are not an OK. A rule
written earlier in another file is not an OK.

- **This overrides Egg Timer's 2026-09-23 rule** ("if BOTH rigs pass, commit and push to the live site
  right away"). Egg Timer still commits as before; it asks before pushing.
- Why: every session commits to the same `main` in the same working tree, so one session's push
  publishes every other session's unpushed commits too — and `main` deploys `Game/` to a PUBLIC
  GitHub Pages site. On 2026-10-02 a push sent nine C64 corner commits live that their own session was
  still holding.
- Before asking, run `git log origin/main..main` and tell Andrew everything that would go out,
  including other sessions' commits.
- Committing locally is fine. Branches and worktrees are fine. Only the push needs his word.

## 🚫 A session pushes only its OWN commits

Standing rule, Andrew, 2026-10-03: "Only push things exclusive to each session. So do not push another
session's work." Even with his OK, a push carries only the commits this session made.

- Push a prefix of `main`, never the whole branch: `git push origin <last-own-commit>:main`, where every
  commit in `origin/main..<last-own-commit>` is this session's own.
- If another session's commit sits underneath yours, you cannot push yours yet. Don't cherry-pick, rebase
  or reorder `main` to get round it (the other sessions share this working tree). Tell Andrew it waits
  until the commits underneath go out.
- Prefixes in commit subjects (`Egg Timer:`, `C64 …`, `decisions.md: the C64 …`) are how you tell whose is whose.

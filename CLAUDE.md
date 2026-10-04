# PowerLine Challenge — rules for every session in this repo

This file sits at the repo root, so every Claude session working anywhere under `(PCL)` loads it:
the root PLC session, every cartridge session (Egg Timer, Asteroid Command, The Aquanaut, Pitstop),
and anything else opened in a subfolder. Folder-specific rules live in `Game/CLAUDE.md` and each
cartridge's own `CLAUDE.md`.

## ⏸ Parked work — read `MEMORY.md` in this folder

The root PLC track (resume word **`Continue_PLC`**) keeps its one-shot handoffs in `(PCL)/MEMORY.md`
→ `(PCL)/memory/`. That file is not auto-loaded, so read it when `Continue_PLC` is typed.
- C64 corner redesign in progress (Phases 0-5).
- Swap loses disk saves (a fresh image each time): parked, not fixed.
- Load on an empty-directory disk can hang the hub: logged, not fixed.
- The empty-drive Load hang (intermittent, verify-c64 §F2): logged, not fixed; its own root-cause pass comes AFTER Phase 5.

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

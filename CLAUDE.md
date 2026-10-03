# PowerLine Challenge — rules for every session in this repo

This file sits at the repo root, so every Claude session working anywhere under `(PCL)` loads it:
the root PLC session, every cartridge session (Egg Timer, Asteroid Command, The Aquanaut, Pitstop),
and anything else opened in a subfolder. Folder-specific rules live in `Game/CLAUDE.md` and each
cartridge's own `CLAUDE.md`.

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

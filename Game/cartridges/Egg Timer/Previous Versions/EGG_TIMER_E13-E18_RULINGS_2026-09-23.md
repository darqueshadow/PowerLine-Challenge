> **FILING NOTE — Claude Code, 2026-09-23.** Filed verbatim from Andrew's message in the Egg Timer session
> on 2026-09-23 (Chat's rulings, pasted). Everything below the rule is the message as written. It rules E13, E16,
> E17 and E18, approves Code's three small egg-ladder calls, and sets a **new standing rule** on playtesting and
> pushing, recorded in the cartridge's `CLAUDE.md`. Merged into the live packet tagged *(E13–E18 rulings)*.

---

Chat's rulings on E13, E16, E17, E18 (Andrew approved):
- E13: Keep as built. F12 clears the line it lands on.
- E16: Keep as built. VF gets no egg-laying cord.
- E17: Intended. Andrew's deliberate override of E10's "command reference": the Goal line is enough for dispatchers. Log it as such in the packet so nobody "fixes" it later.
- E18: CHANGE. Time Warp starts only after the wave's last CAV has actually started (placed or auto-opened), not while a placement trigger is still pending.
- Your three small changes (pan slams every clear, ding on fast clears, sparkle/smoke removed) are approved.

NEW STANDING RULE (add to CLAUDE.md; replaces every earlier "no push until Andrew approves" line):
- Andrew playtests Egg Timer through Nerva Beacon (Rec-Bay 4), not localhost.
- After building anything for Egg Timer: if BOTH test rigs pass, commit and push to the live site right away. Never push with a failing rig.
- Keep each change in its own commit(s) so any one can be reverted on its own.
- After each push, tell Andrew in one line what went live.

Do now:
1. Build E18, run both rigs, then push everything currently unpushed.
2. Make sure the Rec-Bay 4 table in the LIVE Nerva Beacon launches the live Egg Timer. If that needs the uncommitted NB table fix, commit and push ONLY that fix. Do not commit any of the other uncommitted NB files.
3. Confirm in one line when Andrew can open NB and play the latest build.

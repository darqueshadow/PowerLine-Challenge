> **FILING NOTE — Claude Code, 2026-09-17.** Filed verbatim from Andrew's
> `Downloads/EGG_TIMER_RULINGS_DRAFT9.md` (06:39 on 2026-09-17). Everything below the rule is the file as
> written. It is **Draft 9**: Chat's rulings on the build questions D1, D2, D4, D5 and D6 and on C15, worked
> through with Andrew one at a time from the paste blocks Code reprinted that morning. It is a rulings list,
> not a new Addendum draft, so the eighth draft (`EGG_TIMER_PACKET_ADDENDUM_2026-09-15.md`) stays the current
> Addendum, and this file sits beside it. D3 (the Developer Mode phrase) is Andrew's to give Code directly, so
> it isn't here.
>
> **Merged into the live `EGG_TIMER_CONTEXT_PACKET.md` 2026-09-17**, each change tagged *(Rulings, draft 9)*:
> - D1: the Blank Dataset Module holds a Developer-Mode-only copy of the seven real CAV types.
> - D2: a new random unit per CAV, never one already showing on the board (as built).
> - D4: spawning stops once the wave's quota has spawned (as built).
> - D5: the timer shows game seconds (switched from the real-time equivalent).
> - D6: a rejected Enter leaves the text in the box (as built).
> - C15(a): an auto-opened trigger "starts its timer normally (counting up)".
> - C15(b): VF hides only its timer until "Clear Fuel"; the unit and "VF" stay visible (switched from hiding
>   the whole readout).
>
> **Checked on filing:** D1's seven rows match the packet's §3 table and `files/datasets/cav_types.csv` value
> for value (the file says "packet / Data Sheet"; the CAV table is the cartridge's own CSV, not the shared
> Data Sheet, which holds the units). The Blank Dataset Module is now a byte-for-byte copy of that CSV. D2's
> "never duplicate a unit already showing" was already how units are drawn, and a new logic check now runs
> a long game to prove it. Nothing in this draft collides with locked text, so no new flags.

---

EGG TIMER — RULINGS, DRAFT 9 (Andrew, via Claude Chat)

D1 — Blank Dataset Module
Ruling: Not empty. Load the seven real CAV types as Developer-Mode-only rows,
using the exact values already on record in the packet / Data Sheet:
  VS   — 10 min, two-phase: no,  hidden-until-trigger: no
  STR  — 10 min, two-phase: no,  hidden-until-trigger: no
  SS   — 15 min, two-phase: no,  hidden-until-trigger: no
  EOS  — 30 min, two-phase: no,  hidden-until-trigger: no
  MB   — 30 min, two-phase: no,  hidden-until-trigger: no
  AD   — 10–30 min random, two-phase: no,  hidden-until-trigger: no
  VF   — 10–30 min random, two-phase: yes, hidden-until-trigger: yes
This is a testing copy of already-confirmed real values, not invented data.
Confirmed and unchanged: Andrew will verify further once gameplay is testable.

D2 — Nest/unit binding
Ruling: New unit per CAV, randomized each time a nest gets a new CAV. Must
never duplicate a unit already showing on the board. Stand-in as built — no
change needed.

D4 — Wave spawn cutoff
Ruling: Stop spawning once the wave's quota has spawned. Stand-in as built —
no change needed.

D5 — Timer display units
Ruling: Game seconds (not real-time equivalent). Switch the stand-in — the
clock should show the time that actually passes (VS bold at 00:20, hatch
~00:25; EOS/MB bold at 01:00), not a 30x-scaled real-time readout.

D6 — Rejected Enter, text handling
Ruling: Text stays in the box on a rejected Enter. Stand-in as built — no
change needed.

C15(a) — Trigger wording
Ruling: Confirmed. C13 bullet should read "starts its timer normally
(counting up)."

C15(b) — What VF hides
Ruling: Only the timer is hidden. Unit number and CAV type code ("VF") stay
visible throughout the fuelling phase — only the countdown/timer readout is
blanked until "Clear Fuel" fires. Switch the stand-in (currently hides all
three; should hide only the timer).

— End of Draft 9 —

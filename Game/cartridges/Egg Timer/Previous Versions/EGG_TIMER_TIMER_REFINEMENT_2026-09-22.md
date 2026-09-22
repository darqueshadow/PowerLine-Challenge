> **FILING NOTE — Claude Code, 2026-09-22.** Filed verbatim from Andrew's message in the Egg Timer session
> on 2026-09-22 (Chat's handoff, pasted). Everything below the rule is the handoff as written. It is the draft
> after Draft 9. The packet as it stood before this merge is `EGG_TIMER_CONTEXT_PACKET_draft9.md` beside it,
> so D5's removed text is kept there.
>
> **Merged into the live `EGG_TIMER_CONTEXT_PACKET.md` 2026-09-22**, each change tagged *(Timer Refinement)*,
> and built in `files/` for a local playtest. **Not pushed:** Andrew playtests it locally and approves first.
> The gaps Code found while building are **E1–E4** in the packet's §11, each built with a provisional value.

---

# HANDOFF — Egg Timer: Timer Refinement (Real Time / ET Time / Wall Clock)
From: Claude Chat (Senior Developer) → Claude Code
Status: Decided by Andrew, 2026-09-22. For playtest. All numbers marked [T] are tunables.
Merge into EGG_TIMER_CONTEXT_PACKET.md as the next draft. Flag any conflict with the packet before building.

## 1. Two kinds of time
- **Real time** = what is DISPLAYED. A VS goes bold when its clock reads 10:00.
- **ET time** = how fast clocks actually run. All clocks are sped up.
- Base speed [T]: 1 displayed minute = 2 real seconds (10:00 takes 20 real sec).
- **One shared speed** for every clock on screen at all times (nest clocks + wall clock). Required so wall-clock AD targets line up.
- **Supersedes ruling D5** (game-seconds display). Remove D5 from the packet; do not just add alongside it.

## 2. Nest clocks
- Display MM:SS, counting UP from 00:00 when the CAV starts.
- Keep counting past the bold mark through overtime (e.g., 10:00 → 11:40) until cleared or hatched.
- Seconds will spin too fast to read; that is expected, not a bug.
- Bold marks (real time):
  - VS 10:00 | STR 10:00 | SS 15:00 | EOS 30:00 | MB 30:00
  - AD: random, whole minutes, 10–30 (see §4)
  - VF: random, hidden (see §5)
- Existing bold/crack/overtime behavior at the mark is unchanged for now.

## 3. Wall clock (NEW)
- Time-of-day display, 24-hour.
- Format: large HH:MM, with seconds smaller and raised to the upper half (digital clock style).
- Starts at the player's actual current time of day [T].
- Runs at the same ET speed as the nest clocks.
- Freezes on pause like everything else.
- Placeholder visuals are fine; final look is Gemini's.

## 4. AD — post-it note (NEW)
Every AD nest shows a post-it note. Two versions, 50/50 split [T]:
- **Duration note:** reads e.g. "20 min". Goes bold when the NEST clock hits 20:00.
- **Clock-time note:** reads e.g. "Clear @ 14:35". Goes bold when the WALL clock hits 14:35, regardless of the nest clock. The target time is always 10–30 whole minutes after the CAV starts.
- Other CAV types get NO note. Players must know their durations.

## 5. VF — "Clear Fueling" bubble
- Before bold: unit number and CAV type visible; clock and egg hidden (per C15(b)).
- At bold: a cartoon speech bubble reading "Clear Fueling" appears briefly, then fades [T].
  At the same instant the clock appears (already showing elapsed time) and the egg appears already cracking.
- From there: normal overtime/RCAV rules.
- VF is the ONLY CAV type with a pop-up.

## 6. VS/STR early-clear surprise — REMOVED
- Dropped by Andrew. If built, remove it. If not built, do not build it.
- VS and STR always show their clock and always go bold at 10:00.

## 7. Overtime window (clear window after bold)
- Measured in REAL seconds, not ET time. Clock speed does not change it.
- Start: 6.0 sec [T] (replaces 5.0).
- Shrink: −0.25 sec every 2 waves [T]. Floor: 4.5 sec [T] (reached ~wave 13).
- Random variation: fixed ±10% [T]. REMOVES the old growing variation (±10% → ±35%).
- Scoring unchanged: 100 pts at bold, decaying linearly to 25 at hatch.

## 8. Clock speed escalation (NEW)
- Speed goes up on EVEN waves; nests are added on ODD waves (existing +1 nest every 2 waves).
  - W1: speed 1.0 / 5 nests. W2: 1.1 / 5. W3: 1.1 / 6. W4: 1.2 / 6. …
- Step: +10% of base speed [T]. Cap: 2.0× base [T] (10:00 in 10 real sec).
- Speed changes at wave start. Running CAVs switch to the new speed (all clocks share one speed).

## 9. Open: spawn-rate shrink
- Undecided whether clock speed REPLACES or STACKS with the existing spawn-rate shrink.
- For this playtest: leave spawn-rate shrink as currently built.
- Please LOG SKIPPED SPAWNS (spawn due, all nests busy) per wave, so we can see whether the spawn shrink is doing anything.

## 10. Also still open (do not resolve, just keep as-is)
- Whether the bold/crack cue should stay once players know durations: to be discussed with the egg visuals.
- D3 (Developer Mode phrase): still with Andrew.

## Report back
- What's built vs. stand-in for each section above.
- Any conflict with the current packet.
- Skipped-spawn log after first playtest.

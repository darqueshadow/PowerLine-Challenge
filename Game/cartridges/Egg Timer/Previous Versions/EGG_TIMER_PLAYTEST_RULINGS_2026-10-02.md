# Chat to Code: playtest findings and rulings, 2026-10-02 (filed verbatim)

Filed by Claude Code, 2026-10-03. Two messages arrived through Andrew; the second REPLACES the first ("This REPLACES
Chat's previous playtest-findings message"). Both are kept here word for word, the second first. Merged into the packet
(filing note and §11, "Raised by Chat's playtest") the same session.

## The message in force (second)

```
QUEUED: finish current batch first. This REPLACES Chat's previous playtest-findings message. Items marked CHANGED differ from it.

Andrew's corrections from playtest: there is now only ONE mode (Clear CAVs Only, Follow Progression and Both are gone). Only the VS CAV at the hospital has the extra step (RCAV then placement). Do item 1 first, report only. Items 2-6 are rulings: build after item 1 is understood, one revertable commit each, both rigs after each, then ask Andrew for the push word.

1. BUG, REPORT ONLY (CHANGED): every CAV that spawns is VS. No SS, EOS, AD or VF.
 - There is only one mode now. Does that mode's wave progression introduce the other types by design, or is this a regression? Check recent commits, including the Mom kit work and any config.js changes. Name the commit if one broke it.
 - Tell me the cause in plain English and the smallest fix, then fix it.

2. HOSPITAL VS EGG RESET (CHANGED: VS only): when RCAV is accepted on a hospital VS egg, restart its hatch countdown.
 - New window = config value, start at 12 s, flat across waves, no shrinking.
 - It starts when sweet Mom's visit ends, so her visit does not eat the player's time.
 - Scoring tiers still use the first window (the RCAV timing), not the reset window.
 - Time Warp must not count a reset egg as bold.
 - Report: what the countdown was before this change, what the player must type, and whether the placement step is scored.

3. HOSPITAL SIGN AND "PATIENT REFUSED" BUBBLE (CHANGED: VS only)
 - The H sign sits ABOVE the timer, never covering it.
 - Non-hospital VS eggs get a small comic-style bubble reading "Patient Refused", drawn in code, tail pointing at the egg, quieter than the H sign, above the timer. Other CAV types get neither the sign nor the bubble. Tell me if the game gives other types a hospital option.
 - Shown from egg placement until RCAV is accepted.
 - Never cover timers, readouts, Command Lines, nests, the trough or the sink, and never hide the unit number.
 - Report readability and crowding at 1920x1080, 1440x900, 1280x720 and 1024x640 with all 12 nests live. If crowded, show it in wave 1 only and tell me.

4. TIME WARP RED
 - Recolour the lightning bolts and the Time Warp sign to a hot red. Keep the wall clock mint #3dff9a.
 - Max 2 flashes per second. Sign wobble stays brightness-neutral. Nothing flickers. Reduce-motion unchanged. Nothing brighter or faster.

5. ALIEN HEAD POPUP (NEW): the occasional head that pops up over the top bar during play.
 - Replace its art with the new Mom head: sm_org in wave 1, hm_org from wave 2 on (same split as the Mom visit). Use pose A only. Use the cut-out PNGs from the Mom kit.
 - Behaviour unchanged: top bar only, under 1 s, with the hiss. Max 2 flashes per second. Reduce-motion keeps its existing fallback.
 - Delete the old scary HUD face art if nothing else uses it, and report.

6. ERROR MESSAGES MOVE (NEW): the rejected-Enter messages (bad typo, "too early", and any other red ERROR text).
 - Show them directly ABOVE the Time Warp image, where the player is looking. Keep the buzz and the line clearing as they are.
 - They need a solid dark backing and a light outline so they stay readable against the red Time Warp sign and bolts.
 - A repeat error must not flash faster than 2 per second: hold one message steady, and restart its timer instead of re-flashing.
 - Never cover timers, nests, readouts, Command Lines, the trough or the sink. During Time Warp, the message must still be clear against the wobbling sign.
 - Report at the same four screen sizes. If the message does not fit above the image anywhere, say where and propose a fallback.

File all of it in docs/decisions.md, the packet and CLAUDE.md. Update the art brief if the HUD face change affects it.
```

## The replaced message (first)

```
Chat to Code (Egg Timer). Playtest findings. Do item 1 first, report only. Items 2-4 are rulings: build them after item 1 is understood, one revertable commit each, both rigs after each, then ask Andrew for the push word.

1. BUG, REPORT ONLY: every CAV that spawns is VS. No SS, EOS, AD or VF.
 - Is it the shuffle bag, a mode or wave progression rule that only unlocks other types later, or a regression? Check recent commits, including today's Mom kit work and any config.js changes. Name the commit if one broke it.
 - Does it happen in Clear CAVs Only, Follow Progression and Both?
 - Tell me the cause in plain English and the smallest fix, then fix it.

2. HOSPITAL EGG RESET: when RCAV is accepted on a hospital egg, restart its hatch countdown.
 - New window = config value, start at 12 s, flat across waves, ±0%, no shrinking.
 - It starts when sweet Mom's visit ends, so her visit does not eat the player's time.
 - Scoring tiers still use the first window (the RCAV timing), not the reset window.
 - Time Warp must not count a reset egg as bold.
 - Report: what the countdown was before this change, what steps the player must type, and whether the placement step is scored.

3. HOSPITAL SIGN AND "PATIENT REFUSED" BUBBLE
 - The H sign sits ABOVE the timer, never covering it.
 - Non-hospital eggs get a small comic-style bubble reading "Patient Refused", drawn in code, tail pointing at the egg, quieter than the H sign. Same placement above the timer.
 - Shown from egg placement until RCAV is accepted.
 - It must never cover timers, readouts, Command Lines, nests, the trough or the sink, and must not hide the unit number.
 - Report readability and crowding at 1920x1080, 1440x900, 1280x720 and 1024x640 with all 12 nests live. If crowded, show it in wave 1 only and tell me.

4. TIME WARP RED
 - Recolour the lightning bolts and the Time Warp sign to a hot red. Keep the wall clock mint #3dff9a.
 - Flash rules unchanged: max 2 flashes per second, sign wobble stays brightness-neutral, nothing flickers. Reduce-motion unchanged.
 - Do not make anything brighter or faster.

File all four in docs/decisions.md, the packet and CLAUDE.md.
```

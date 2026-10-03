# Chat to Code: signs and buildings, bounce, hatch slime, VF out, How To Play (filed verbatim)

Filed by Claude Code, 2026-10-03. Merged into the packet (§11, "Raised by Chat's playtest") the same session.

```
INVESTIGATE FIRST, then build. One revertable commit per item. Both rigs after each. Do not push.

A. Hospital sign + hospital building (hospital VS eggs only)
- Enlarge the H sign about 1.6x. If that won't fit at all four sizes (1920x1080, 1440x900, 1280x720, 1024x640), report the largest size that does.
- Add a code-drawn, flat, cute hospital building on the opposite side of the egg from the sign.
- If the building doesn't fit, skip it. The sign stays.

B. Patient Refused bubble + house (non-hospital VS eggs only)
- Enlarge the bubble. Amber fill, dark lettering, no white fill. Not red, pink or green.
- Add a code-drawn, flat, cute house on the opposite side of the egg from the bubble. Same skip-if-no-room rule.

C. Bounce
- Sign, bubble, hospital and house bounce steadily, about one bounce per second. Small squash-and-stretch is fine.
- The sign/bubble and its building are offset by half a bounce.
- No music sync, no tempo setting, no beat detection.
- Reduce-motion: static.
- Never cover timers, nests, readouts, Command Lines, the trough or the sink.

D. Hatch slime (horror only)
- On hatch, the alien jumps at the screen and slips down out of frame (existing behaviour).
- Add a purple splat at the contact point and slime streaks that run down and fade after a few seconds. Same glowing purple as Mom's drool. Never red.
- Draw it under timers, readouts, nests and Command Lines.
- At most one quick impact flash. Max 2 flashes per second.
- Reduce-motion: static splat, short fading streaks.
- Report if the jump-at-screen happens in more than one place.

E. VF out of play
- Remove VF from the egg bag. The bag is VS, SS, EOS, MB, AD.
- Disable it with a flag. Keep the pump and timer-box code and art.
- Fix any text, rig checks or docs that mention VF in play.
- The types reference is three rows when built.

F. How To Play bubble: HOLD. Report only. Do not change anything until Andrew describes what's wrong.
- Separately: reword the step 6 caption to "the baby dances and does its goofy hop", flagged as Andrew's wording, to be reverted if he objects.

Parts 3 and 4 stay held until Andrew approves the layout beside the panel.
```

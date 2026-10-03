# Chat to Code: tabs, buildings behind the nest, AD note, CAV/STR prompt, overrun inversion; slime moved (filed verbatim)

Filed by Claude Code, 2026-10-03. Two messages; the second (D2) arrived while the first was being built. Merged into the
packet (§11, "Raised by Chat's playtest") the same session.

## G to K

```
INVESTIGATE FIRST, then build. One revertable commit per item. Both rigs after each. Do not push.

G. Sign and bubble attach to the timer display
- The H sign (hospital VS) and Patient Refused bubble (non-hospital VS) become a tab attached to the timer box.
- Only the tab bounces. The timer face does not move.
- Report whether 1.6x now fits at the four sizes (1920x1080, 1440x900, 1280x720, 1024x640). Build the largest that fits. Amber bubble unchanged.

H. Buildings behind the nest
- Hospital and house move above/behind the nest, nest drawn in front. Keep the bounce, offset half a bounce from the tab.
- Skip a building where it would touch a readout, timer, Command Line, trough or sink. Report which nests and sizes lose one.

I. AD note
- Enlarge the "Clear @ HH:MM" note about 1.5x. Larger lettering, strong contrast.
- Report the largest size that fits all four sizes without covering anything. Keep the neighbour-avoidance logic.
- If "AD clock" means something else on screen, report what and do not guess.

J. Hospital CAV/STR prompt
- Report first: where does the post-RCAV "new CAV (STR)" prompt currently show?
- During the 12 s wait, alternate CAV and STR about every 0.75 s. Max 2 changes per second.
- Reduce-motion: both words steady.

K. Overrun inversion
- When a timer runs over, invert its colours on the timer box only. Text readable in both states.
- Ramp: one swap every 2 s at the start, speeding up toward hatch, capped at 2 swaps per second. Never faster.
- On a hospital egg, the 12 s reset after RCAV restarts the ramp from slow.
- Reduce-motion: no flashing. Hold inverted and steady for the last third.
- Report how J and K behave together on a hospital egg, and confirm each stays within 2 flashes per second.

Hold: slime splat position, How To Play bubble, Parts 3 and 4.
```

## D2

```
D2. Hatch slime: move and enlarge
- Do not use screen centre. Pick the clearest open spot near the hatching egg's nest, using the same safe-landing check as Mom's drool. Never over the Time Warp clock, timers, readouts, unit numbers, nests, Command Lines, the trough or the sink.
- Splat about 2x bigger: thicker body, wider drips, a few extra droplets.
- Glow brighter and wider than Mom's drool. Steady, no pulse. No impact flash. Purple, never red.
- Timing: fully visible about 2 s, then drips and fades over about 4 s more.
- Drawn under timers, readouts, nests and Command Lines. Pause holds it.
- Reduce-motion: static splat, short drips, fade.
- If no clear spot exists: smaller splat at the nearest clear edge, and report it.
- Report the chosen spot at all four sizes with screenshots.
- One revertable commit. Both rigs. Do not push.
```

# Chat rulings E35–E39 (2026-09-25), verbatim, AS RECEIVED

Pasted to Code by Andrew. **It arrived cut off**: it stops mid-sentence in E38's quota section, and E39 is
missing. The rest goes in its own file when it comes.

```
Chat rulings E35–E39 (Egg Timer) — from Andrew's playtest. Replaces all earlier E35–E39 blocks.

E35 — Title music must start on the Start (title) screen, not the options screen.
- Investigate first: confirm the cause (likely browser autoplay block until first input).
- Inside Fang Rock (Electron): allow autoplay so the title track plays as soon as the title appears.
- In a normal browser: start the title track on the first key press or click on the title screen.
- Report the cause and what you changed.

E36 — Music level.
- Target: the same music loudness as the other PLC cartridges (measure Asteroid Command and any
  other cartridge with music; match Egg Timer's three tracks to it). Report the numbers before/after.
- Music is a feature of this game, not background. No clipping or distortion.
- Ducking: music dips briefly under THONG, the error buzz and the hiss, then returns.
  Small sounds (egg-laying, splashes, trough/drain sounds) ride under the music with no duck.
- Keep the gameplay track's ~3 dB down-ramp and all loop points unchanged.

E37 — Bug: the frying pan comes down when an egg hatches. It must not.
- Frying pan + THONG only on a successful RCAV clear.
- A hatch (overtime window missed) shows the hatch only. No pan, no THONG.

E38 — Shell pieces, alien parts, hose, trough.
Pieces left by a clear:
- Every clear leaves shell pieces cut from the approved egg picture.
- Break stages 3–5 also scatter the pilot alien parts (antenna, clawed leg, tentacle + goo, eye),
  more parts the slower the stage.
- Pieces never fade or vanish on their own. No cap on how many build up: let them pile.
- Pieces never sit on or cover a timer, unit box, readout, Command Line or the top bar/mom face.
  They pile around those.
Hose:
- The hose can wash everything away, including alien parts.
- Solids (shell, alien parts): spray pushes them in the spray direction; they slide and settle
  with friction, with a light tumble (legs flop, eyes roll). Push is strong: a decent sweep moves
  a piece most of the way to the edge. This is a fun, goofy feature, never a chore.
- Liquids (yolk, slime, goo): not pushed as solids. Spray streaks them in the spray direction
  and thins/fades them as they wash; the last of it trickles toward the trough.
Gravity and the top edge:
- No trough along the top. Yolk/slime pushed to the top slowly drips back down.
- Pieces stop at the top edge, except a piece sitting in yolk/slime slowly slides down with it.
- Drips and sliding pieces pass BEHIND nests and eggs and never run over a timer, unit box,
  readout or Command Line.
Trough:
- Thin trough along the left, right and bottom edges, sloping to the existing sink + drain.
  Anything that enters rides the flow to the sink and drains.
- Must not take width back from the board or crowd timers, nests, readouts or Command Lines.
  Investigate layout first; if a thin trough doesn't fit cleanly, report before building.
Sounds (goofy, cheap): a squelch when a piece drops into the trough, a "bloop" when an eyeball
  goes down the drain. They share the existing overlap cap and sit under THONG/buzz/hiss.
Quota:
- Cleanup quota size unchanged. A piece counts as cleaned when it enters the trough; liquid
  counts as it does today when washed out.
- Anything left at the end of cleanup carries into the next
```

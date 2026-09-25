# Pilot art, nest + egg: Chat's ruling, verbatim (2026-09-25)

Pasted to Code by Andrew. Filed unchanged; the packet merge is tagged *(Pilot art)*.

```
Egg Timer: pilot art, nest + egg (Chat ruling, 2026-09-25)

Andrew's approved pictures are in the Egg Timer asset folder: fresh_egg.jpg,
tendrils.jpg (3 tendrils), alien_bits.jpg (2x2: antenna, leg, tentacle + goo, eye)
and empty_nest.jpg. All are on white backgrounds. Slot 0 is now a HYBRID: pictures
for the look, vector for the cracks. Update the brief to match.

Preparing the pictures
- Cut each out of its white background (keep the dark outlines crisp), split the
  tendrils into 3 and alien_bits into its 4 parts, and save them in files/art/
  under rule 5 names, sized for the 404 x 374 layer canvas.
- Nest: split into a back rim (behind the egg) and a front rim that covers the
  egg's base at (0,20). Make a grey "not in play" version of both in the slate
  tone (--twig-inactive #3a3150), as the brief's raster route says.
- Tendrils sit in the ooze group behind the back rim (shown only while in play).
  Widen the puddle a little so a rim of it shows past the bigger nest.

The egg
- The shell is the picture, full size, base on (0,20), inside the brief's bounds.
- Cracks stay vector: three single unbranched lines, pathLength="1", bold (about
  3.5 units), in --crack, placed so each hint comes out of one crack.
- Hints are the pictures, inside the brief's bounds: hint-3 antenna out of the top
  crack, hint-4 leg, hint-5 tentacle + goo. Keep the leg mostly over the egg so it
  reads against the dark board.

Variety
- Mirror each egg left/right at random, 50/50, when it is laid. Cracks, hints and
  the eye mirror with it.
- NEW rare hint, the eye: its own group (e.g. hint-eye). About 1 egg in 6 (a
  config value, easy to tune) gets it; it appears at 50% of the way from bold to
  hatch, in addition to the other three hints, and stays until the egg is cleared
  or hatches. Still picture: no blink for now. Place it in a crack so it doesn't
  cover the other hints.

Also
- Strip or retune the placeholder CSS rules that would override the art's colours
  (the brief lists them), and re-run the theme baseline.
- Rigs: every state (fresh, 35%, 40/60/80%, eye, mirrored, not in play) renders
  at the smallest and largest nest sizes; parts stay inside their bounds.
- Record provenance in files/art/README.md: Gemini, date, the prompts (Andrew has
  them), Andrew's approval.
- Before pushing: send Andrew screenshots of those states at both sizes to approve.
  After his yes, the normal commit/push rule applies.
Bring anything that needs a design call back to Chat as an E-numbered item.
```

# The Mom kit: Chat's answers to Code's E55 report, and the build brief (filed verbatim, 2026-10-02)

## Chat's answers to Code's E55 report

Chat's answers to your E55 report:
1. YES, render the mommy doodle and the scary HUD Mom face to PNGs, outside Game/ (nothing published). Tell Andrew the folder.
2. Gemini pieces will be separate pictures on flat white, not sheets (our standing method). You cut them out.
3. Pending Andrew's yes: Mom enters from the play-field edge nearest the egg (top/left/right/bottom). A and the tentacle rotate toward the egg; B and C stay upright. She must never cover timers, nests, readouts or Command Lines, and must stay clear of the trough and sink. Report which edges, if any, are unsafe, and whether the tentacle needs stretching for far eggs.
Report only, don't build.

## The build brief

EGG TIMER: MOM KIT BUILD (sweet Mom + creepy Mom)
From Chat (design authority). Andrew has approved the art and these rulings. Work only inside the Egg Timer cartridge. Do not touch the Empty Cartridge, /core, or Nerva Beacon.

STEP 0: INVESTIGATE FIRST. Do all of this before building, then continue unless something conflicts with a locked ruling (if so, stop and report):
- List every file in Game\cartridges\Egg Timer\files\assets\imgages\alien_mom and map each to a piece below (match by looking at the picture, since filenames vary).
- Find every place Mom currently appears (in-game visit, How To Play panel 5, top-bar HUD face, game-over or options doodles, anywhere else) and what draws it now.
- Find how the existing goo is drawn and washed off.
- Check repo state is clean and both test rigs pass before you start.

THE PIECES (all on white backgrounds, JPG; sweet = sm_*, creepy = hm_*)
A. Head looking down at the egg (sm_org, hm_org). Eyes open (sweet) or heavy-lidded (creepy).
B. Head facing the player, mouth closed (sweet) or fangs (creepy) (sm_facingyou, hm_facingyou).
C. Head giggling, all three eyes squeezed shut (sm_giggling, hm_giggling).
D. One tentacle with curled tip and rounded stub at the base (sm_tentacle, hm_tentacle). Use one, mirrored for the second. The stub tucks under her chin. Mom has NO HANDS, only tentacles.
E. The plaster (sm_plaster, hm_plaster).
Reference only, do NOT use in game: hm_droolstrand and hm_splat. They show the intended look for the code-drawn drool and splat.

ART HANDLING
- Cut out the white backgrounds to transparent PNGs with clean edges (no white fringe, keep the thick dark aubergine outline #1a0d2e). Keep the originals. Save the PNGs beside them.
- Crop all heads (A, B, C) for each Mom with the SAME box, so the head sits in the same place when poses swap. No jumping.
- Creepy tentacle curls the opposite way from the sweet one. Flip horizontally so both Moms match the sweet orientation.
- Creepy plaster is longer and shallower than sweet. Scale and rotate to the sweet plaster's size and angle.
- Clean up the stray white speck in the middle of the sweet plaster pad, and the wart that pokes past the outline on creepy tentacle and head edges, if visible.

WHICH MOM WHEN
- Sweet Mom: wave 1 and the How To Play cartoon (panel 5).
- Creepy Mom: wave 2 onward.
- Same animation, same timings, same layout for both. One animation drives both.

THE VISIT (1.5 seconds)
1. Pops in from the play-field edge nearest the egg she is visiting (top, left, right or bottom). This REPLACES the old "top bar only" ruling.
2. Head only plus tentacles. No body. About three quarters of a nest's width, roughly 100-180 px depending on screen size.
3. Pose A, looking down at the egg: tentacle patches the egg with the plaster while the cracks close. Rotate A and the tentacle toward the egg. B and C stay upright.
4. Turns to the player: pose B.
5. Giggles: C alternating with B, twice.
6. Ducks back out the way she came in.
She must NEVER cover timers, nests, readouts, Command Lines, the trough or the sink. Work out safe positions per edge. If bottom-edge entry cannot be made safe, propose a fallback and report it. Existing Mom sounds and timing rules are unchanged.

CREEPY MOM ONLY: DRILL AND SPLAT (drawn in CODE, not images)
- Drool: during pose B only, a glossy strand stretches from her mouth, forms a drop at the bottom, and the drop falls. Sweet Mom never drools.
- Splat: where the drop lands, draw a flat, irregular splat. Randomise size, shape, edge ruggedness and number of flung droplets each time, so no two are the same. Do NOT make it round or ball-like.
- Splat is cosmetic only. It washes off exactly like the existing goo. Reuse the goo's colour and wash-off mechanism.
- Style: flat colours, thick dark outline #1a0d2e, a few small glossy highlight streaks. No red liquid.
- Splat must never cover timers, nests, readouts, Command Lines, the trough or the sink. Choose a safe landing zone and report it.

CREEPY MOM ONLY: TONGUE JIGGLE (pose C)
- Wobble just the tongue region in the bottom centre of the mouth using a small warp, clipped to the mouth, during the giggle only.
- Gentle. If it looks smeary or shows a seam, DO NOT ship it: report back and Chat will get a separate tongue piece from Gemini.

HARD RULES
- Max 2 flashes per second, anywhere. Under reduce-motion: no jiggle, no drool animation, no pop animation beyond a simple fade, and keep the final splat static.
- Nothing human: no hands, fingers or human teeth. Fangs are fine. No red liquid. Red veins in eyes are fine.
- Edit only Egg Timer files. No core engine changes. Keep modular files (separate HTML, CSS, JS, assets).
- If any piece conflicts with a locked ruling in docs/decisions.md, stop and report instead of working around it.

PROCESS
- One revertable commit per section: (1) asset cutouts and cropping, (2) swap Mom art into the visit, (3) edge-entry placement, (4) How To Play panel 5, (5) creepy drool and splat, (6) tongue jiggle.
- Run both test rigs after each section. Push once both pass.
- File the new rulings (edge entry replaces top-bar-only; drool, splat and tongue are code-drawn; sweet Mom never drools) in docs/decisions.md, the design packet and CLAUDE.md. Update the Gemini art brief to mark the Mom slots as done.
- Do not touch Nerva Beacon.

FINAL REPORT (short, plain English)
- What replaced what, with file names and commit hashes.
- Where each Mom appears and what you did with the old art.
- The safe landing zone for splats and which edges needed special handling.
- Anything that looked wrong, and anything you did not do.
- Exactly how Andrew can see sweet Mom and creepy Mom in Rec-Bay 4 (any dev shortcut to trigger them).

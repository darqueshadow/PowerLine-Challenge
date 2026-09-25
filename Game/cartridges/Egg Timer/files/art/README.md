# Egg Timer art: provenance

*Not published: the deploy drops `*.md`, but the repo is public, so keep this to credits and provenance.*

## Slot 0, the pilot: nest + egg (hybrid)

- **Made with:** Gemini, for Andrew.
- **Date:** 2026-09-25 (the pictures were approved and prepared that day).
- **Source pictures** (Andrew's, in `files/assets/imgages/`, not published): `fresh_egg.jpg`, `empty_nest.jpg`,
  `tendrils.jpg` (3 tendrils), `alien_bits.jpg` (2 × 2: antenna, leg, tentacle + goo, eye). All on white.
- **Prompts:** ⏳ *Andrew to add the Gemini prompts here.*
- **Approval:** Andrew approved the four source pictures (Chat ruling, 2026-09-25). ⏳ *His approval of the in-game
  look (the screenshots of every state) goes here too, with its date.*
- **Prepared by Claude Code** with `make-pilot-art.py` (next to the rigs; never published): each picture cut out of
  its white background (the background is the white joined to the picture's edge; a thin band round it is un-blended
  from white, so the dark outlines stay crisp), the tendrils and the bits split into their parts, and every part laid
  on the 404 × 374 slot canvas at its place in the viewBox. The nest was split along its bowl's front lip into a back
  rim and a front rim, and each rim got a slate copy (`--twig-inactive` #3a3150) for "not in play".
- **Still vector (drawn by the game):** the three cracks, the ooze puddle.

| File | What it is |
|---|---|
| `nest--twigs-back@2x.png`, `nest--twigs-front@2x.png` | the nest's back rim (behind the egg) and front rim (over its base) |
| `nest--twigs-back-inactive@2x.png`, `nest--twigs-front-inactive@2x.png` | the same in slate, for a nest not in play |
| `nest--tendril-1@2x.png` … `-3@2x.png` | the three tendrils, behind the back rim, shown while the nest is in play |
| `egg--shell@2x.png` | the egg, full size, base on (0, 20) |
| `egg--hint-3@2x.png`, `-4`, `-5` | the antenna, the leg, the tentacle and goo (at 40%, 60%, 80% from bold to hatch) |
| `egg--hint-eye@2x.png` | the rare eye (about 1 egg in 6, from 50%) |

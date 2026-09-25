# Egg Timer art: provenance

*Not published: the deploy drops `*.md`, but the repo is public, so keep this to credits and provenance.*

## Slot 0, the pilot: nest + egg (hybrid)

- **Made with:** Gemini (image generation), for Andrew. The prompts were written by Claude (Chat), 2026-09-25 (all below).
- **Date:** 2026-09-25 (the pictures were made, approved and prepared that day).
- **Source pictures** (Andrew's, in `files/assets/imgages/`, git-ignored, never published): `fresh_egg.jpg`,
  `tendrils.jpg` and `alien_bits.jpg` (from session 2 below) and `empty_nest.jpg` (from session 1). All on white.
- **Approval:** Andrew approved the four source pictures (Chat ruling, 2026-09-25). ⏳ **In-game look approved by Andrew
  on:** *(the day he OKs "Egg Timer pilot art - every state (updated).png")*.
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

## The Gemini prompts (from Andrew's record, `egg-timer-gemini-prompts.md`)

## Session 1: finding the look

### 1. First look prompt
```
Draw a cartoon alien egg sitting in a twig nest, as a sprite for a 1980s arcade game
(NES / Sega Genesis era). A friendly family cartoon with a creepy undertone.

Show two versions side by side:
1. The fresh egg: smooth, glossy alien green (#7dff6a) with electric-violet speckles
   (#7a2cff) and a thick dark aubergine outline (#1a0d2e).
2. The same egg about to hatch: three bold dark cracks. Poking out of them: the tip of
   an alien antenna at the top, a thin wiggly alien leg on one side, and a small purple
   tentacle (#7a2cc4) with lime-green goo (#b8ff5e) seeping out.

The nest: a ring of chunky brown twigs (#9b6532, darker #4a2b12) in a small puddle of
mint-green alien ooze (#3dff9a), with three violet tendrils (#b04dff) curling out.

Style: flat bold colour, thick outlines, hard edges, hard offset shadows. No soft glow,
no airbrushing, no text. Front view, centred, on a plain very dark purple background
(#0b0716). Bold enough to still read as an egg in a nest when shown tiny.
Cartoon alien only: nothing human, no hands, no blood.

Give me 3 different takes.
```

### 2. First tweak
```
Great, I like these. Go with the LEFT nest (the round woven basket) and the egg as drawn.
Make these changes and show me the fresh egg and the about-to-hatch egg in that nest:

1. The leg: make it clearly an alien leg, not a vine: thin, with one or two knobbly
   joints and a small three-toed claw at the end, in dark purple (#7a2cc4) so it stands
   out against the green shell.
2. The antenna: about half as tall, just the tip poking out of the top crack.
3. The tentacle and goo: move them up to the middle of the egg's side, so the front of
   the nest doesn't hide them.
4. The tendrils: smaller and tighter to the nest, curling close around it rather than
   reaching out wide. Give their tips small thorny hooks, like the right-hand nest's.
   Keep them behind the nest, never in front of it or the egg.

Keep everything else the same: style, colours, background, no text.
```

### 3. Second tweak (produced the approved look, egg_v2)
```
Closer! The LEFT picture (fresh egg in the woven nest) is exactly right. Keep that
nest and that egg.

Now redraw the pair so the NEST IS IDENTICAL in both pictures: the same woven nest,
the same ooze puddle, and the same three small thorn-tipped purple tendrils peeking
up from BEHIND the back rim of the nest. The tendrils are always behind the nest,
never in front of it or the egg, and they look the same in both pictures.

The ONLY difference between the two pictures is the egg. The about-to-hatch egg has:
- three bold dark cracks,
- the short tip of an antenna poking out of the top crack (small, not tall),
- one small purple alien leg with a knobbly joint and a little claw poking out of a
  crack on one side (no green vine),
- the small purple tentacle with lime-green goo at mid-height, as you have it now.
Nothing else: no eyeball, no extra tendrils, no extra creatures.

Keep the cracks the most obvious thing on the egg. Same style, colours and
background, no text.
```
(An earlier round of this chat also produced the picture with the alien eye, egg_v1.)

### 4. Separate pieces on white (empty_nest.jpg came from this step)
```
Using the approved picture, draw ONLY the empty woven nest: no egg, no tendrils, no
ooze. Same style and angle, centred, filling most of the picture, on a flat plain
pure white background.
```
The egg and tendril requests in this step came back brown and too dark, so they were redone in session 2.

---

## Session 2: the final pieces (new chat, egg_v2 and egg_v1 attached)

### 5. Opener and the egg (fresh_egg.jpg)
```
I'm making game art. I've attached two pictures:
- PICTURE A (two eggs in tidy woven nests) is the approved look. Copy it; don't redesign.
- PICTURE B (the egg with tendrils swarming the nest) matters ONLY for one thing: the
  alien eye peeking out of a crack. Ignore everything else in it.

Rules for every picture I ask for in this chat:
- ONE subject only, copied from the pictures, in exactly the same style and colours.
- Flat plain pure white background. No nest, no puddle, no shadow, no text, nothing
  else in the frame.
- Centred and filling most of the frame.

First: the plain egg on the LEFT of picture A, by itself. Same shape, same alien green
(#7dff6a), same electric-violet spots (#7a2cff), same glossy highlight, same purple
band, same thick dark aubergine outline (#1a0d2e). The nest hides the bottom of the
egg, so complete the bottom smoothly, with the purple band curving around it. No
cracks. It is NOT brown and NOT a chicken egg: it must look exactly like picture A's egg.
```

### 6. The tendrils (tendrils.jpg)
```
Next: the purple tendrils from the RIGHT of picture A (the ones rising behind the nest).
Draw THREE of them standing upright, side by side, with clear white space between them
so they don't touch. Same shape, same thorny hooked tips, same bright violet (#b04dff),
same thick dark aubergine outline (#1a0d2e). Cut the bottom of each one off flat
(that end hides behind the nest). White background, nothing else.
```

### 7. The four alien parts (alien_bits.jpg)
```
Next: four alien parts in a 2 x 2 grid, one in each quarter, not touching, with no
egg anywhere:
1. Top left: the antenna from picture A's right-hand egg, purple stalk (#7a2cc4)
   with the round lime-green tip (#b8ff5e).
2. Top right: the purple jointed leg with its little claw toes from picture A's
   right-hand egg (#7a2cc4).
3. Bottom left: the purple tentacle with dripping lime-green goo (#b8ff5e) from
   picture A's right-hand egg.
4. Bottom right: the alien eye from picture B: purple eyelid, slit pupil, sitting in
   its small jagged dark opening, with no egg shell around the opening.
For parts 1-3, cut the end that comes out of the egg off flat and straight: that end
disappears into a crack. Same style and outlines as picture A. White background.
```

---

## Tried and not used

- A code-only SVG rebuild of the nest and egg (Gemini writing the SVG by hand). It kept the structure but lost the look, so the pilot uses the pictures above, with the cracks as vector lines drawn by Code.

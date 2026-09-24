# Egg Timer: art brief for Gemini

*Written 2026-09-24 by Claude Code from the live game's code (everything below was read out of the code and measured
in the running game). Nothing in the game changes until the art comes back and a later coding session hooks it up.*

---

## For Andrew: how to use this brief

1. Give Gemini **"The game in one minute"**, **"Rules for every picture"** and **the pilot slot (nest and egg)** first.
   Review what comes back before asking for anything else.
2. After the pilot is right, hand over **one slot at a time**, each with the rules section again.
3. Bring the files to an Egg Timer Code session. Today every picture is drawn by code, and there are no image slots
   yet. Hooking the files up is the next code batch (the "art-slot layer" from the audit). That session will check
   every file against this brief and run both rigs before anything goes live.
4. Keep a short record of how each picture was made (the Gemini model, the date, the prompt, your approval). It goes
   in `files/art/README.md`, which isn't copied to the game site but can be read in the public repo (see "Getting
   the files onto the site").
5. **E26 (ruled 2026-09-24)** added the five break stages (slot 13) and three alien hints on the waiting egg (in the
   pilot, slot 0), and made **rule 6, "Aliens", apply to all alien art**. Hand the pilot over with its hints.
6. **Red in the art is settled (Chat, 2026-09-24):** red eyes and red veins are allowed as alien features, so the
   hatchling (slot 2) and the mom face (slot 5) keep their reds. The rule is **no red liquid** except the cord (rule 6).
7. **E27 (ruled 2026-09-24)** made the centre panel, Time Warp, a **grandfather clock**: slot 14. **No pocket watches
   for now.** (E27 also renamed it "Time Accelerator"; **E28 undid that: it's Time Warp**.)
8. **E28 (ruled 2026-09-24)** put a small **sink with a drain** beside the hose's tap, with the hose's instructions on
   it: slot 15.
9. **E29 (ruled 2026-09-24)** turned How To Play into a **five-panel comic strip**, the same on the title card and the
   options screen: slots 16–20, one picture a panel. The words are the game's (speech bubbles), not the art's.

---

## The game in one minute

Egg Timer is a typing game for EMS dispatchers. The board has 12 **nests**. When a unit goes on a CAV (Conditional
Availability), an **alien egg** is lowered into its nest on a fleshy cord. The egg grows while its timer runs. When
the CAV's real time is up, the nest goes **bold** (its readouts turn bold) and the egg, now full size, starts to
**crack** and rock. The player has a few seconds to type
`RCAV <unit>`, which slams a **frying pan** onto the egg and serves a breakfast dish if they were fast. If they're too
slow, the egg **hatches** and a horrible little creature escapes.

**Art direction: "juxtaposition".** A friendly family cartoon with a dark, twisted undertone: cute alien mums and
babies, but a smile that's a touch too wide, a baby with too many fangs, and hatchlings that are genuinely horrible.
Scary is fine, but always scary **alien** (rule 6).

**Era: 1980s arcade.** Inside the game the look is 1980s: think C64, NES, Sega Genesis and arcade cabinets. That means
bold, saturated, high-contrast colour, thick dark outlines, and hard edges with hard offset shadows, **not** soft glows
or airbrushing. The pictures sit on a very dark purple background (`--bg` #0b0716 and `--bg-2` #1b0f33).

**Originality.** The game is public. Every creature must be an original design, with **no likeness of Spielberg's E.T.**
or any other existing character.

---

## Rules for every picture

### 1. Format

- **SVG is preferred** for every slot. Use the slot's exact **viewBox** (given in each section) so the game's
  coordinates line up with your drawing.
- **Every part the game moves or checks must carry the class name given in the slot's table**, on a group
  (`<g class="…">`) unless the table says it must be a single path or shape (like the egg's cracks). Draw that part
  in its final position. **Don't put a `transform` on a moving group itself**, because the
  game writes its own transform there. If you need to position a group, wrap it in an outer group and place that
  instead.
- If a part can't be SVG, supply a **transparent PNG or WebP at 2× the largest on-screen size**, **one file per layer**.
  **Every layer file uses the whole slot canvas** (the same pixel size, and the same area as the viewBox), so the
  layers line up just by stacking them.
- **No text inside any picture.** Captions, labels, timers and unit numbers are live text drawn by the game, and
  their wording can change.

### 2. Colours

- Use the **named colours from the game's `theme.css`**, given by name and hex in each slot. Use the hex values
  exactly.
- If a picture really needs a new colour (a highlight, say), **name it and give its hex** in your notes. Code adds it
  to `theme.css` so the game has a single palette. Don't slip in unlisted colours.
- **Don't draw glows, lighting effects or shadows that the game adds itself.** Examples: Time Warp's green glow on
  running nests, the bold look on the readouts.

### 3. Animation limits (safety)

- **Nothing may flash more than 2 times a second.** A flash is any quick swap between light and dark, or between two
  strong colours. This covers any frame-by-frame art you supply, and it matters for players with photosensitive
  epilepsy.
- **Nothing may rely on motion to make sense.** Some players turn motion off (their system's "reduce motion"
  setting), and then the game stops the wobbles, bobs and flickers. **Every picture must read correctly as a single
  still frame.** For example, how close an egg is to hatching must show in its cracks, not only in its wobble.
- Don't design anything that needs to blink, strobe or pulse to be understood.

### 4. Size and readability

- Each slot gives its **largest** on-screen size. Many are also shown much smaller (a nest can be as small as 84 px
  wide), so **bold shapes and thick outlines** matter more than detail.

### 5. File names and where they go

- All art goes in one folder: **`Game/cartridges/Egg Timer/files/art/`**. The favicon is the one exception: it stays
  at `files/favicon.svg`.
- **Lowercase letters, digits and hyphens only, plus the `@2x` size suffix and the file extension (`.svg`, `.png`,
  `.webp`).** No spaces, no capitals, no underscores. The live site treats `Egg.svg` and `egg.svg` as different files.
- **SVG:** `<slot>.svg`, e.g. `nest.svg`, `egg.svg`, `dish-3-over-easy.svg`.
- **Raster, one picture (no layers):** `<slot>@2x.png` (or `.webp`), e.g. `dish-3-over-easy@2x.png`, `pan@2x.png`.
- **Raster layers:** `<slot>--<layer>@2x.png` (or `.webp`), e.g. `egg--shell@2x.png` or `nest--twigs-front@2x.png`.
  Use two hyphens before the layer name, and `@2x` for the double-size file. (The egg's cracks are never raster:
  they stay SVG.)
- **No version numbers** in names (git keeps the history). While Andrew is choosing between versions, add `-a`, `-b`
  to the end of the name, before any `@2x` and before the extension (e.g. `egg-a.svg`, `egg--shell-a@2x.png`), then
  drop it for the final file.
- Names the site's publishing step throws away: **never `verify-…png`**, never a name ending `-test.html` or `.bak`,
  and **never a folder called `screenshots`, `handoffs` or `design-system`**.

### 6. Aliens (every alien picture: eggs, hatchling, breaks, mom face, title family, doodles)

- **Clearly a cartoon alien.** Scary is fine, but scary **alien**: extra eyes, eyes on stalks, fangs, tentacles, slime.
- **Nothing human.** No hands or fingers, no human eyes, no human teeth, no human skin.
- **No red liquid** (no blood, splatter, drips or pools) anywhere except the egg-laying cord. **Red eyes and red veins
  are allowed** as alien features.
- **Gross and funny, family cartoon.** Think of a spilt slushie, not an injury. Never gory.

---

## The slots at a glance

| # | Slot | Shape (viewBox) | Largest on screen | Format | Moving parts |
|---|------|-----------------|-------------------|--------|--------------|
| **0** | **PILOT: nest + egg** | `-60 -62 120 110` | 200 × 183 px | SVG (or layered 400 × 367 PNG/WebP) | egg (grows, rocks), 3 cracks (drawn in), 3 alien hints (on/off), ooze (on/off), two twig looks |
| 1 | Broken shell halves | same as the nest | 74 × 40 px | SVG, same file canvas as the nest | none |
| 2 | Hatchling | same as the nest | 97 × 77 px at rest, **~580 × 460 px** in its lunge | **SVG only** | whole creature; legs |
| 3 | Egg-ladder dishes (7) | `-56 -38 112 76` | 150 × 102 px | SVG or 300 × 204 PNG/WebP | none (the whole dish pops) |
| 4 | Frying pan | `-60 -40 150 80` | 236 × 126 px (272 × 145 at the slam) | SVG or 544 × 290 PNG/WebP | none (the whole pan slams) |
| 5 | Scary mom face | `-100 -100 200 200` | 225 × 225 px | SVG or 450 × 450 PNG/WebP | none (the whole face slides) |
| 6 | Title scene | `0 0 420 210` | 560 × 280 px | SVG | mommy sway, 3 pupils, 3 babies, 3 mouths, 4 notes |
| 7 | Mode-selection creature | `0 0 300 200` | 300 × 200 px | SVG | whole body, 3 heads, 6 pupils, 3 mouths, 3 notes |
| 8 | How-to doodles (5) | `0 0 60 60` each | 64 × 64 px | SVG or 128 × 128 PNG/WebP | none (the whole doodle turns) |
| 9 | Hose-nozzle cursor | `0 0 32 32` | 32 × 32 px, fixed | SVG + 64 × 64 PNG | none |
| 10 | Hose tap | `0 0 28 22` | 28 × 22 px | SVG | none |
| 11 | Gunk splats and a water drop | `0 0 100 100` stamps | up to ~100 px across with droplets | SVG or 200 × 200 PNG/WebP | none |
| 12 | Small icons: mute, mouse, favicon | `0 0 24 24`, `0 0 20 28`, `0 0 32 32` | mute 22 × 22; mouse ~16 × 22; favicon 16 × 16 (up to 32) | SVG only | mute icon swaps parts |
| 13 | The five break stages (E26) | same as the nest | 200 × 183 px | SVG (or 400 × 367 PNG/WebP) | none (one stage shows, still) |
| 14 | Time Warp's grandfather clock (E27) | `0 0 80 170` | about 70 × 140 px | **SVG only** | hour hand and minute hand (turn) |
| 15 | The sink by the hose tap (E28) | `0 0 40 24` | about 42 × 25 px | SVG | none |
| 16–20 | How To Play comic panels (E29), one each | `0 0 120 90` (slot 18: two, `0 0 120 44` each) | about 110 × 83 px | SVG or 240 × 180 PNG/WebP | none |

Not image slots, so they stay drawn by code (see the end): the egg-laying cord, Time Warp's lightning and glow, the
hose line, the arcade lights, and all the text boxes, panels and clocks.

---

## Slot 0: THE PILOT, the nest and the egg (fully specified)

**Do this one first.** It is the picture players look at all game, and it sets the style for everything else.

### What it is and where it appears

- **12 nests** sit on the play screen all game, scattered across the board in 3 rows. The centre is left free for the
  Time Warp's grandfather clock (slot 14).
- A nest is either **not yet in play** (wave 1 opens 5; more open in later waves) or **in play**.
- An in-play nest gets an **egg** whenever its unit goes on a CAV.
- Under each nest the game draws three small text boxes (the unit, the CAV type and the timer). Those are the game's
  own text, not part of the art.

### Shape and size

- **viewBox `-60 -62 120 110`**: x runs −60 to 60, y runs −62 (top) to 48 (bottom). The point (0, 0) is near the
  middle of the nest.
- **Largest on screen: 200 × 183 px** (1 unit = 1.67 px). **Smallest: 84 px wide** (1 unit = 0.7 px).
- The game **tilts each nest by up to ±5°** around the point (0, −7) and never rotates it further. Leave a little
  margin at the edges.
- **Keep the important drawing inside x −48…48 and y −40…37.** The outer strip can be covered by a neighbouring
  nest's text boxes. The tendrils can reach the edges, as they do now.
- **Format:** two SVGs for this slot, on the same viewBox: **`nest.svg`** and **`egg.svg`**. If raster, every layer
  is a **400 × 367 px** transparent PNG/WebP covering the whole viewBox.

### How the space is laid out (viewBox units)

```
 x = -60                          0                          +60
y=-62 ┌──────────────────────────────────────────────────────────┐
      │                  crack 1 starts (-4,-36) ▼  egg top ~ -36 │
      │                        ╭───────╮                          │
      │  crack 3 starts ►    ╭─╯       ╰─╮ ◄ crack 2 starts       │
      │   (-20,-12)          │  (0,-8)   │   (16,-24)             │
      │                      │ egg centre│                        │
y= -7 │  · · · · · · · · · · · ·(0,-7)· · ·  ← the nest's tilt pivot │
y= -2 │   ~~~~ back twigs (behind the egg), y -2 … 18 ~~~~        │
y= 20 │ ══════════════ EGG BASE (0,20): the egg grows and rocks from here ══ │
y= 14…34 │ #### front twigs (in front of the egg's base) ####     │
y= 7…33 │ ░░░ ooze puddle (in-play only), centre (0,20) ░░░       │
y= 48 └──────────────────────────────────────────────────────────┘
        tendrils may reach the side edges (x ±60, at about y -14) and the bottom edge (y 48)
```

### Layers, back to front, with what the game does to each

| Order | Layer (class) | What it is | What the game does to it | Anchor point |
|---|---|---|---|---|
| 1 | `ooze` | A translucent alien ooze puddle (one shape of class `pool`; flat colour, no soft glow) and 3 violet tendrils (class `tendril`): the "alien nest" look | **Shown only while the nest is in play**, hidden while it isn't. Otherwise still. | none (still) |
| 2 | `twigs back` (two classes) | The far rim of the nest, **behind** the egg | Still. Needs a second, plain look (see "Two looks" below). | none |
| 3 | `egg` (in `egg.svg`) | The alien egg: `shell`, spots of class `speckle`, three `crack` lines and three alien hints (`hint-3`, `hint-4`, `hint-5`) | **Grows** from 35% to 100% size, then **rocks** side to side while cracking (details below) | **(0, 20)**, the bottom of the egg where it sits in the twigs |
| 4 | `twigs front` (two classes) | The near rim and sticks, **in front of** the egg's base, overlapping it | Still. Needs the plain look too. | none |

(Slots 1 and 2, the broken shell halves and the hatchling, sit in front of these on the same canvas.)

### The egg in detail (`egg.svg`)

- **Draw it full size and upright**, standing on the point **(0, 20)**. The current egg is an oval from x −22 to 22
  and y −36 to 20 (centre (0, −8)). You can change the silhouette, but **keep its base at (0, 20)** and keep it about
  this size.
- **Growing.** From the moment it's laid, the game scales the whole `egg` group from **35% to 100%** around (0, 20), so
  it grows upward out of the nest. It reaches full size exactly when the CAV's time is up. At 35% the egg is only
  about **26 × 33 px** on the largest nest and **11 × 14 px** on the smallest, **so it must still read as an egg when
  tiny**.
- **"Bold"** means the moment the CAV's time is up. The nest's readouts turn bold; **the egg itself needs no bold
  look**.
- **Rocking.** Once bold, the game rocks the egg side to side around (0, 20), about 6 full rocks (left, right and
  back) a second, getting wider (3° to 9° each way) as it nears hatching. **This stops for players with reduced
  motion**, so the cracks alone must show how close it is.
- **The three cracks** (class `crack`, 3 separate paths):
  - Each crack must be **one `<path>` with `pathLength="1"`**, a stroke, **no fill**, flat (butt) line ends, and a
    **single continuous line**: one `M`, no branches, no extra pieces. Draw it from its **starting point on the
    shell's edge** inward, because the game **draws each crack in from its first point** while the egg is bold:
    nothing at first, the whole crack at the moment it hatches. That takes about 4 to 6.6 seconds.
  - **Keep every crack inside the shell's outline.**
  - Current starting points and lengths: crack 1 from the top **(−4, −36)**, zigzagging down about 54 units;
    crack 2 in from the upper right **(16, −24)**, about 34 units; crack 3 in from the left **(−20, −12)**, about
    21 units. You may redraw them, but keep **three**, each starting at the edge.
  - Cracks are hidden until the egg is bold.
- **Three alien hints** (E26): as the egg nears hatching, bits of the alien start poking out through the cracks. Each
  is its own group inside `egg`, hidden until the game shows it:

| Group (class) | What pokes out | Shown from |
|---|---|---|
| `hint-3` | The **tip of an antenna**, poking out of the top crack | 40% of the way from bold to hatch |
| `hint-4` | A **wiggly leg** poking through a crack | 60% |
| `hint-5` | A **tentacle**, with **alien slurpy seeping out** of a crack | 80% |

  - Each appears **once**, at its moment, and stays until the egg is cleared or hatches (so at 80% all three show).
    It just appears: no fade, no blink, no flash.
  - Draw each hint **coming out of one of your cracks**, so it sits where the crack is. Keep every hint **inside
    about x −30…30, y −44…20**, so it rocks with the egg without leaving the nest.
  - They're the still-frame signal too: with motion turned off, the hints and the cracks together show how close the
    egg is to hatching.
  - They follow rule 6 (a cartoon alien, nothing human, no red liquid). The antenna, leg and tentacle should look like
    parts of the creature that breaks out in stages 3–5 of slot 13, not like the horrible hatchling.
  - **Colours:** use the egg's palette plus `--drool` #b8ff5e for the slurpy and `--cord-purple` #7a2cc4 for a
    purple part. Anything else is named with its hex in your notes.
- **Speckles** (each spot a shape of class `speckle`): spots on the shell. They move with the egg and are never
  animated on their own.
- **One special type, VF (vehicle fuelling), hides its egg until it's bold.** It then appears at full size, uncracked, and
  starts cracking at once. Nothing extra to draw; it's the same egg.
- **The egg vanishes** when the player clears it (the pan slams and gunk splashes; today there's no break picture,
  and slot 13 adds one, a still picture in five stages) or when it hatches (the shell halves and the hatchling take over).

### Two looks for the twigs

- **In play:** brown twigs, with the ooze and tendrils showing.
- **Not yet in play:** the **same twigs in plain slate grey** (`--twig-inactive` #3a3150), with no ooze and no
  tendrils.
- **Best:** draw every twig as a stroked `<path>` with no fill, in only the two brown colours listed below. The game
  then recolours them slate by itself.
- **Or, if the twigs are raster:** supply both versions of each twig layer (`nest--twigs-back@2x.png`,
  `nest--twigs-back-inactive@2x.png`, `nest--twigs-front@2x.png`, `nest--twigs-front-inactive@2x.png`).
- When a nest comes into play, the game pops the whole nest in (from 20% size to full, in 4 quick steps). Nothing
  extra to draw.

### Colours (from `theme.css`)

| Part | Colour name | Hex |
|---|---|---|
| Egg shell | `--shell` (alien egg green) | #7dff6a |
| Egg outline and cracks | `--crack` (dark aubergine) | #1a0d2e |
| Speckles | `--speckle` (electric violet) | #7a2cff |
| Near twigs (rim) | `--twig` (twig brown) | #9b6532 |
| Far twigs and stick details | `--twig-dark` (dark twig brown) | #4a2b12 |
| Twigs, not in play | `--twig-inactive` (slate) | #3a3150 |
| Ooze puddle | `--ooze` (ooze green), drawn **fully opaque** in the file (the game shows the puddle, edge included, at 28%) | #3dff9a |
| Ooze edge | `--ooze-edge` (dark ooze green) | #1a8f55 |
| Tendrils | `--violet` (bright violet) | #b04dff |
| General outline, if needed | `--outline` (near-black aubergine) | #1a0d2e |

### Animation limits for this slot

- Nothing in the nest or egg flashes.
- The rock is movement, not a flash, and it stops under reduced motion.
- The cracks are the still-frame signal for "about to hatch": make them **bold and easy to see**.
- Don't add any idle animation of your own. If you suggest one, it must not flash more than 2 times a second (see
  rule 3) and must still make sense frozen.

### What else sits on top of the nest (so you know, but don't draw it)

- The three text boxes just under the nest.
- An AD "post-it" note at the upper right.
- The frying pan (slot 4).
- Gunk splats (slot 11).
- A "Clear Fueling" speech bubble.
- A green glow around the whole nest while Time Warp runs.

### Files for the pilot

- `nest.svg`: groups `ooze` (holding the `pool` and the `tendril` lines), `twigs back` and `twigs front` (class names
  exactly as written, two classes each for the twigs).
- `egg.svg`: group `egg` holding the `shell`, spots of class `speckle`, three paths of class `crack`
  (each with `pathLength="1"`), and the three hint groups `hint-3`, `hint-4` and `hint-5`.
- Raster fallback: `nest--ooze@2x.png`, `nest--twigs-back@2x.png`, `nest--twigs-front@2x.png`, `egg--shell@2x.png`,
  and so on, each **400 × 367 px**. Cracks can't be raster: they must be SVG lines so the game can draw them in.

### Three things for the code session to handle (not Gemini's job)

- **The cord egg.** The egg on the laying cord is drawn by code as a plain oval in the egg's colours. It lands
  centred on (0, −8), but the nest egg appears centred on (0, 10.2), so the egg drops 18 viewBox units at that moment
  (about 30 px on the largest nest). The cord also ignores the nest's tilt. When the new egg goes in, the cord's egg
  should use the same picture and end at 35% size with its base on (0, 20), tilted with the nest.
- **Class names are code hooks.** The code writes the egg's `transform` itself and reads the `crack` paths by class;
  style.css, the inactive-twig recolour and the rigs select `.ooze`, `.twigs.back`, `.twigs.front`, `.egg`, `.crack`,
  `.speckle`, `.shells`, `.creature`, `.legs`, `.eye` and `.fangs`. Keep them as given.
- **The stylesheet will override the art.** style.css still styles the placeholder by those same class names
  (fills, strokes, stroke widths, and opacity 0.28 on `.ooze .pool`; style.css:495-529). When the new art goes in,
  strip or retune those rules so they don't replace the art's own colours and widths, then re-run the theme baseline
  (`--write-theme-baseline`).

---

## Slot 1: broken shell halves

- **What and where:** two broken lower pieces of shell left in the nest after a hatch, shown for 1.4 seconds. They
  are drawn in front of the front twigs, and the hatchling is drawn in front of them.
- **Shape:** the nest's viewBox `-60 -62 120 110`. Today's halves span x −22…22, y −18…6, with a small gap in the
  middle, and sit about 14 units above where the egg's base was. Draw them as the **broken bottom of your egg at full
  size**, and say in your notes whether they should rest on the egg's base (0, 20), partly covering the front rim, or
  float at today's height. **Expect the hatchling to cover the middle of the pair**, not to fit in the gap.
- **Largest on screen:** about 74 × 40 px for both halves together.
- **Layers:** one still group, `shells`. Nothing moves: the halves appear, then disappear 1.4 s later.
- **Match the egg:** same shell and outline colours as your egg, so they read as its pieces.
- **Colours:** `--shell` #7dff6a, `--crack` #1a0d2e.
- **Animation:** none. Must read as "it hatched" when still.
- **File:** `shells.svg`, same canvas as `nest.svg` (or `shells@2x.png` at 400 × 367).

---

## Slot 2: the hatchling

- **What and where:** the thing that hatches. It's **horrific on purpose**, the dark side of the cute family. It
  appears in the nest at the hatch and is on screen for 1.4 seconds; in the first 1.3 seconds it does one of two
  things:
  - it **scurries** off sideways, turning 90° as it goes; or
  - it **lunges** at the player, growing to **6×** its size and then fading while still growing.
- **Shape:** the nest's viewBox. Keep the creature inside about **x −29…29, y −24…22** (58 × 46 units). The game moves
  and scales it around the **centre of its own bounding box**, so anything sticking out (a tail, spikes) moves that
  centre and changes how far it travels.
- **Largest on screen:** 97 × 77 px at rest, but **about 580 × 460 px during the lunge**, visible up to about
  830 × 660 px as it fades. **It must be SVG**: a raster would need to be over 1100 px wide to stay sharp.
- **Layers:**

| Layer (class) | What it is | What the game does | Anchor |
|---|---|---|---|
| `creature` | The whole hatchling | Scurry: slides sideways 5× its width and turns 90°. Lunge: grows to 6× (then 9× while fading). | The centre of the creature's own box, currently about (0, −1) |
| `legs` (inside `creature`, drawn behind the body) | Eight jointed spider legs, four a side (at least **4 separate paths**) | During a scurry the game squashes them flat about the line y = 0 (see note) | The line y = 0 |
| `eye` (at least **4**, inside `creature`) | A cluster of odd-sized **red** eyes | Still | none |
| `fangs` (inside `creature`) | A row of needle fangs | Still | none |

  The body, ribs, maw, drool and pupils can all be in one still group inside `creature`.
- **Note on the legs:** today the code makes the legs vanish and reappear (squashed to zero height and back) about
  8 times a second during a scurry, which is over the 2-a-second limit. The code session will change that.
  **Design the legs to read as legs with no animation at all.**
- **Design for the close-up.** In the lunge every line is magnified 6×, so a 3-unit outline becomes 18 units.
- **Colours:**
  - body `--hatchling-body` #2a0d14;
  - ribs `--hatchling-ribs` #6b1f2e;
  - maw `--hatchling-maw` #7a0010;
  - fangs `--hatchling-fangs` #f4f0d8;
  - eyes `--hatchling-eye` #ff1a2e (the game checks the eyes are this exact red);
  - pupils `--hatchling-slit` #ffe14d;
  - legs `--hatchling-legs` #8a2a3e;
  - drool `--drool` #b8ff5e;
  - outlines `--shadow` #000.
- **Animation limits:** the scurry and lunge are movement, not flashing. Don't add any blinking. The escape must
  read as an escape in a still frame: the broken shells plus the creature.
- **File:** `hatchling.svg` (same viewBox as the nest).

---

## Slot 3: the egg-ladder dishes (7)

- **What and where:** a breakfast dish that pops up over a nest for 1 second after a **fast** clear. Each fast clear
  in a row climbs one rung, and the top dish repeats while the streak holds. The dish's name is shown under the plate
  as live text, so **don't write it on the picture**.
- **The seven dishes, bottom to top:**
  1. Scrambled
  2. Sunny-Side Up
  3. Over Easy
  4. Poached
  5. Eggs Benny
  6. Eggs Benny w/ Avocado
  7. Steak, Eggs & Brew!
- **Shape:** viewBox `-56 -38 112 76`. The plate is centred at **(0, 2)** (about 108 × 68 units). Keep the food
  inside −50…50 × −34…34.
- **Largest on screen:** 150 × 102 px.
- **Format:** SVG, or 300 × 204 PNG/WebP.
- **Layers:** **none needed.** Each dish can be one flat picture of plate and food. The game moves the whole dish:
  it pops in from 40% size, holds for 0.6 s, then rises and fades.
- **Colours:**
  - plate `--plate` #f4f4f8, rim `--plate-rim` #c9c9d6;
  - egg white `--egg-white` #fff6e0, yolk `--yolk` #ffc21a, pale yolk `--yolk-pale` #ffe08a;
  - muffin `--muffin` #c98a4b;
  - hollandaise `--sauce` #ffd84d with edge `--sauce-edge` #8a5a00;
  - avocado `--avocado` #8ccf4d with edge `--avocado-edge` #2e5a12;
  - steak `--steak` #7a3a1c, grill marks `--grill` #3a1507;
  - brew `--mug` #e0a018, foam `--foam` #fffbe8;
  - outlines `--shadow` #000.
- **Animation limits:** one pop per fast clear, no blinking. Each dish must read on its own as a still picture.
- **Files:** `dish-1-scrambled.svg`, `dish-2-sunny-side-up.svg`, `dish-3-over-easy.svg`, `dish-4-poached.svg`,
  `dish-5-eggs-benny.svg`, `dish-6-eggs-benny-avocado.svg`, `dish-7-steak-eggs-brew.svg`.

---

## Slot 4: the frying pan

- **What and where:** a frying pan that **slams down** onto the egg on every clear, and comes down late on the empty
  nest after a hatch. It's invisible except during its 0.32-second slam: it drops from high up, tilted, lands,
  bounces slightly, then lifts away and fades.
- **Shape:** viewBox `-60 -40 150 80`.
  - **The pan's bowl is centred at (0, 0)** (about 88 × 60 units).
  - **The handle points right**, from x 34 to x 84, at y −6…6.
  - The game's placement assumes the bowl at (0, 0) and the handle on the right, so keep both.
- **Largest on screen:** 236 × 126 px, briefly 272 × 145 px at the top of the slam.
- **Format:** SVG, or 544 × 290 PNG/WebP.
- **Layers:** none. One flat picture; the game moves, tilts and fades the whole pan around the point **(15, 0)**.
- **Colours:** rim `--pan-rim` #2b2b33, cooking surface `--pan-base` #43434f, glint `--pan-glint` #8c8ca0, handle
  `--pan-handle` #5a3418, outlines `--black` #000.
- **Animation limits:** one slam per event; it moves, it doesn't flash.
- **File:** `pan.svg`.

---

## Slot 5: the scary mom face

- **What and where:** a horror jump-scare. At most once a wave (and not every wave), a monstrous version of the
  title screen's mommy alien slides in for under a second. It comes either down from the top edge of the screen or
  up out of the how-to panel. It is **fully in view for only about 0.3 seconds**.
- **Shape:** viewBox `-100 -100 200 200` (square). The face is centred at about (0, 10). **Keep everything inside the
  square**, because it's cut off at the edges.
- **Largest on screen:** 225 × 225 px, often smaller (about 146 px when it comes from the top).
- **Format:** SVG, or 450 × 450 PNG/WebP.
- **Layers:** **none.** One flat picture: the game slides the whole face in and out.
- **What it shows now:** the mommy gone wrong. Three bloodshot eyes on stalks with pinprick pupils, angry brows, and
  the too-wide smile split open into a maw of jagged fangs, drooling. Scary, but scary alien (rule 6). **It must scare in a single still frame.**
- **Colours:**
  - skin `--mom-skin` #3f7a2c, shading `--mom-shade` #24501a, outline `--mom-outline` #0c1a08;
  - eyes `--mom-eye` #fff2d6, pupils `--mom-pupil` #0c0000, veins `--mom-vein` #d0102a;
  - maw `--mom-maw` #2a0008, teeth `--mom-teeth` #f4eccc;
  - drool `--drool` #b8ff5e.
- **Animation limits:** it slides; it must **never flash or blink**. Bold shapes that read at thumbnail size.
- **File:** `mom-face.svg`.

---

## Slot 6: the title scene

- **What and where:** on the title screen, under the logo. A cute **mommy alien** on the left, **three baby aliens**
  to her right, all singing, with music notes drifting up. The twists: mommy's smile is a touch too wide, and the
  middle baby has too many fangs. An original tune plays with it.
- **Shape:** viewBox `0 0 420 210` (2:1). The notes drift above the top edge, which is fine.
- **Largest on screen:** 560 × 280 px (1 unit = 1.33 px).
- **Format:** SVG (the layers below need it).
- **Layers** (every moving layer is its own group, **with no transform of its own**, placed by an outer group):

| Layer (class) | What it is | What the game does | Anchor (viewBox) |
|---|---|---|---|
| `mommy` > `sway` | Mommy's whole body: body, apron and heart, three eyes on stalks, the too-wide smile, cheeks | Leans left 4° and back, once every 1.56 s | **The bottom centre of everything inside `sway`**, measured by the game from your drawing. Keep her lowest point at y 200 and her drawing centred left-to-right on x 95, so the pivot stays at (95, 200). |
| `pupil wink` × 3 (inside `sway`; two classes) | Her three pupils, each **its own circle on its eye**. Only these blink. | Blinks: squashes to 15% height for 0.19 s every 3.1 s, the three a moment apart | Each pupil's own centre, now (72, 63), (96, 55), (120, 63) |
| `baby` > `bob` × 3 | Each baby's body, antennae, eyes and pupils (class `pupil` only: babies never blink) | Bobs up 8 units and back, once a second, out of step | A straight lift, no pivot. Bodies are centred at (205, 160), (270, 150), (335, 162), about 44 × 48 units each, so they stand at about y 184, 174 and 186. |
| `mouth` × 3 (inside each `bob`) | Each baby's singing mouth; **baby 2's has too many fangs** | Squashes toward the top lip and back, quickly | 20% down from the top of the mouth |
| `note` × 4 | Music notes (now ♪ ♫ ♪ ♬ in a font; drawn notes are welcome) | Each drifts up 80 units and right 14, fading in and out, every 2.2 s | none (they only slide) |

- **Keep the mouth interiors a dark tone** (`--mouth` #3b0a2a), not a bright colour. The mouths squash quickly (about
  15 small shape changes a second), so a bright mouth would read as a flicker.
- **Colours:**
  - skin `--alien-green` #7dff6a, outlines `--alien-outline` #14330f;
  - eye whites `--white` #fff, pupils `--alien-outline` #14330f;
  - apron and cheeks `--pink` #ff8fc7, apron heart and antenna tips `--hot` #ff3d7f;
  - smile and mouths `--mouth` #3b0a2a, gum `--smile-pink` #ff5c8a, teeth `--tooth` #fffbe8;
  - notes `--gold` #ffd23a with a `--shadow` #000 edge.
- **Animation limits:** nothing changes colour or flashes. With motion off, everything stands still (notes shown,
  mouths open), and it must still read as a family singing.
- **File:** `title-scene.svg`.

---

## Slot 7: the mode-selection creature

- **What and where:** at the top of the mode-selection screen, a different character from the title family. It's a
  **cuddly lilac blob with three baby heads on necks**, each singing slightly out of tune:
  - head 1 has two eyes;
  - head 2 has **one big eye**;
  - head 3 has **three eyes**, one too many.

  Crooked notes drift up, one of them a flat (♭). **The eyes follow the mouse.**
- **Shape:** viewBox `0 0 300 200` (3:2).
- **Largest on screen:** 300 × 200 px (1 unit = 1 px).
- **Format:** SVG.
- **Layers:**

| Layer (class) | What it is | What the game does | Anchor (viewBox) |
|---|---|---|---|
| `breathe` | The whole creature except the notes: blob, spots, hugging arms, cheeks, necks and heads | Breathes: 3.5% wider, 3% shorter and back, every 2.8 s | **The bottom centre of everything inside `breathe`**, measured from your drawing. Keep the creature centred on x ≈ 150 with its lowest point at y ≈ 192. |
| head groups × 3 > `bob` | Each head with its hair tuft | Bobs up and down, about every 1.2 s, out of step | Heads centred at (98, 84) tilted −8°, (150, 58) tilted 2°, (204, 86) tilted 9°, each **drawn at 1.2× scale** (1 head unit = 1.2 viewBox units). Head radii 24, 27 and 23 head units (about 29, 32 and 28 viewBox units). |
| `eye` × 6 (inside its head's `bob`) | Each eye white, a plain circle. The game measures it to aim its pupil. | Still | none |
| `pupil` × 6 (inside `bob`, each drawn right after its own `eye`, **with no transform of its own**) | Each pupil, **its own circle on its eye's centre** | **Follows the mouse**, sliding up to 0.46 × the eye's radius off centre | Its eye's centre |
| `mouth` × 3 (inside `bob`) | Each singing mouth | Squashes toward the top lip at slightly different speeds | 20% down from the top of the mouth |
| `note` × 3 | Crooked notes: ♪, ♫ and a ♭ | Rise 58 units, wobbling, fading in and out, every 2.4 s | Each note's own centre |

- **The eyes must be round whites with room to move.** Each pupil is about half the eye's width. Keep the eye whites
  at their current sizes, because the code's tracking uses them: head 1 radius 6.5, head 2 radius 11, head 3 radius 5,
  in head units (7.8, 13.2 and 6 viewBox units).
- **Colours:**
  - blob and heads `--lilac` #c79bff, outlines and pupils `--plum` #2a0f45;
  - spots `--alien-green` #7dff6a, cheeks `--pink` #ff8fc7;
  - eye whites `--white` #fff, mouths `--mouth` #3b0a2a;
  - notes `--gold` #ffd23a with a `--shadow` #000 edge.
- **Animation limits:** keep the mouths dark (as in the title scene). With motion off it must still read as one
  three-headed singing blob.
- **File:** `critter.svg`.

---

## Slot 8: the how-to doodles (5)

- **What and where:** goofy **"kid's drawing on the fridge"** doodles of the alien family, scattered in the empty
  space of the how-to panel (and three of them under the title screen's How To Play card). Every 2.5 seconds, one of
  them turns to a new angle.
- **The five, as now:**
  0. a grinning baby with antennae up;
  1. the mommy with three eyes on stalks and a too-wide smile;
  2. the three-headed blob;
  3. an egg peeking out through its own crack;
  4. a baby upside down, waving a tentacle.
- **Shape:** viewBox `0 0 60 60` each (square).
  - The game turns the whole doodle to a new angle of up to **28° either way around its centre (30, 30)**, with a
    springy overshoot of about 10° before it settles. In the panel, anything that sticks out is cut off.
  - **Keep each drawing inside a circle about 28 units from the centre** so it is never cut off.
- **Largest on screen:** 64 × 64 px (and 36 px when beside the panel's title).
- **Format:** SVG, or 128 × 128 PNG/WebP.
- **Layers:** none. One flat picture each, **pupils drawn in**.
- **Style:** **dark ink lines and one main flat colour** each (a small second accent, such as the mommy's pink apron,
  is fine), plus white eyes, like a crayon drawing.
- **Colours:** ink `--outline` #1a0d2e, green `--alien-green` #7dff6a, lilac `--lilac` #c79bff, pink `--pink` #ff8fc7,
  eye whites `--white` #fff.
- **Animation limits:** the turn is a gentle swing, not a flash. Each doodle must read still.
- **Files:** `doodle-0-baby.svg`, `doodle-1-mommy.svg`, `doodle-2-blob.svg`, `doodle-3-egg.svg`,
  `doodle-4-upside-down.svg`.

---

## Slot 9: the hose-nozzle cursor

- **What and where:** in the game, the mouse pointer is always a garden-hose spray nozzle. Players click and drag it
  to wash off the gunk.
- **Shape:** exactly **32 × 32 px** (viewBox `0 0 32 32`).
- **Hotspot:** the click point is **(3, 3)**, the nozzle's tip, **pointing up and to the left**.
- **The hose stub leaves toward the bottom right and must pass through (27, 27)**, where the game's live hose joins
  it. Draw the stub about 6 px wide with a 2 px edge each side (10 px overall), to match the live hose.
- **Format:** SVG, plus a 64 × 64 PNG.
- **Colours** (a cursor can't use the game's colour names, so write the hex values in): hose `--hose` #2fbf5a with
  edge `--hose-outline` #06280f, nozzle `--gold` #ffd23a, outline #000. (Today's cursor uses #22a34a with a black
  edge; this change makes it match the drawn hose.)
- **Animation:** none (cursors can't animate).
- **Files:** `cursor-nozzle.svg`, `cursor-nozzle@2x.png`.

---

## Slot 10: the hose tap

- **What and where:** a garden tap poking up from the middle of the board's bottom edge. The hose runs from it to
  the cursor. The hose itself is a **line drawn by the game** (6 px wide, `--hose` #2fbf5a with a `--hose-outline`
  #06280f edge), so only the tap is a picture.
- **Shape:** viewBox **`0 0 28 22`** (28 × 22 px, 1 unit = 1 px), anchored at its **bottom centre (14, 22)** on the
  board's edge. The hose (6 px, 10 px with its edge) comes out of the top of the pipe at **(14, 4)** and runs up; the
  tap draws over the hose's end, so draw the pipe's mouth there. **Keep it no wider than about 32 px**: the sink (slot 15) sits
  just to its right.
- **Format:** SVG.
- **Colours:** pipe `--tap-pipe` #9aa0a8, handle `--tap-valve` #d0342c, outlines `--black` #000.
- **Animation:** none.
- **File:** `hose-tap.svg`.

---

## Slot 11: gunk splats and a water drop

- **Gunk:** when an egg is smashed, gooey egg gunk splats onto its nest and flies across the board. The game **stamps**
  splats at random spots and sizes onto the board, and the player **wipes them off pixel by pixel** with the
  hose.
  - Supply **5 to 8 different splat shapes**: irregular blobs with a few flung droplets.
  - Each splat is a square stamp, viewBox **`0 0 100 100`**, with the blob centred at (50, 50). The blob body is
    shown about 16 to 48 px across; with its flung droplets the whole stamp is up to about 100 px across. **Keep the
    droplets inside the square.** Deliver SVG, or a 200 × 200 PNG/WebP.
  - Today the game draws the blobs itself; with your stamps it will place them at random spots and sizes (and can
    turn them), so no stamp should have an obvious "up".
  - Draw them **mostly opaque**, because a splat must hide the text boxes it lands on.
  - **Colours (not yet in `theme.css`; Code adds them):** yolk-yellow #ffd43a and #ffc21a, cream #fff4d6 and
    #f2e6c4, cooked brown #c98a2b, with a thin dark-brown edge (#3c2200 at about 55%).
  - **Animation:** none. Splats just appear.
  - **Files:** `gunk-1.svg` … `gunk-8.svg`.
- **Water drop (optional):** the little drops that spray from the nozzle while wiping. A tiny teardrop, **6 × 9 px**,
  in `--water` #6fd3ff with a `--water-edge` #0a4a7a rim. The game makes it fall and fade in half a second, but it
  must read as water when still. **File:** `water-drop.svg`.

---

## Slot 12: small icons (mute, mouse, favicon)

- **Mute button icon** (top left of every screen, drawn 22 × 22 px):
  - viewBox `0 0 24 24`, three separate groups: `speaker`, `waves` (shown when the sound is on) and `cross` (shown
    when muted).
  - Draw it in one colour using **`currentColor`**: `speaker` as a filled shape, `waves` and `cross` as stroked lines
    only (no fill, about 2.2-unit round-capped strokes). **Put no colour values in the file.** The game colours it
    cream when the sound is on and hot pink when muted.
  - **File:** `icon-mute.svg`.
- **Mouse icon** (on the hose's label, "click & drag to spray"; drawn only about 16 × 22 px):
  - viewBox `0 0 20 28`: a computer mouse with the **left button highlighted**.
  - Body `--white` #fff, left button `--hot` #ff3d7f, outline `--outline` #1a0d2e.
  - Bold and simple.
  - **File:** `icon-mouse.svg`.
- **Favicon** (the browser tab icon):
  - viewBox `0 0 32 32`: an alien egg with a crack. It must read at **16 × 16 px**.
  - A favicon can't use colour names, so write the hex values in: shell #7dff6a, outline and crack #1a0d2e,
    speckles #7a2cff.
  - **File:** `favicon.svg`, which replaces `files/favicon.svg`.

---

## Slot 13: the five break stages (E26)

- **What and where:** what's left in the nest after the frying pan smashes a cleared egg. **The faster the player
  cleared it, the cleaner the break. The slower the clear, the messier and more alien it gets.** There are five
  stages, and each clear shows exactly one of them: the time from bold to hatch is split into fifths, and a clear in
  the first fifth shows stage 1, in the last fifth stage 5. So stage 3 matches the egg that has just shown its
  antenna tip (`hint-3`), stage 4 its leg, and stage 5 its tentacle. The stage replaces the egg in the nest when the
  pan comes down, and it's there for about a second. The code session sets the exact timing.
- **Look only.** The amount of gunk thrown across the board (slot 11) is the same for every stage. The stage is only
  what's left in the nest.
- **The five stages:**

| # | File | The look |
|---|------|----------|
| 1 | `break-1-elegant.svg` | **Elegant.** A clean crack, two neat shell halves, a bright round yolk, and a small sparkle. |
| 2 | `break-2-messier.svg` | **Messier.** Jagged shell shards and a runny yolk spreading out. It's still just an egg. |
| 3 | `break-3-alien-signs.svg` | **First alien signs.** The yolk has a green tinge, and a tiny antenna sticks up out of the goo. |
| 4 | `break-4-half-formed.svg` | **Half-formed.** A wiggly leg, an eyeball on a stalk, and purple slime. |
| 5 | `break-5-leftovers.svg` | **Jokey leftovers.** A spill of alien slurpy, a tangle of legs, and a tentacle. |

- **Art rules:** rule 6, "Aliens", above. Each stage should look a little more alien than the one before, and stage 5
  is obviously not an egg any more. Eyes are cartoon eyeballs on stalks and legs are alien legs. No red liquid in
  this slot (rule 6): the goo is yolk-yellow, green and purple.
- **Shape:** the nest's viewBox `-60 -62 120 110`, drawn where the egg was: the break sits on the nest, around the
  egg's base at **(0, 20)**, and stays inside about **x −40…40, y −40…28** so the front twigs and the text boxes
  below the nest stay clear. The frying pan covers it at first, so every stage has to read once the pan lifts.
- **Largest on screen:** the whole nest canvas, 200 × 183 px. It's also shown on nests as small as 84 px wide, so
  **each stage must still be recognisable at that size.** Stage 1 and stage 5 should look different at a glance.
- **Layers:** one still group per file, class `break`. Nothing moves, and the game doesn't animate any part of it.
- **Colours (from `theme.css`):** shell `--shell` #7dff6a, outlines `--crack` #1a0d2e and `--shadow` #000, yolk
  `--yolk` #ffc21a and `--yolk-pale` #ffe08a, egg white `--egg-white` #fff6e0, green goo `--drool` #b8ff5e, purple
  `--cord-purple` #7a2cc4. Anything else, such as a slurpy colour or a sparkle white, is named with its hex in your
  notes, and Code adds it to `theme.css`.
- **Animation limits:** none are needed, because each stage is a still picture. **Stage 1's sparkle must not
  twinkle or flash**: draw it as a still star shape.
- **Files:** `break-1-elegant.svg` … `break-5-leftovers.svg` (or `break-1-elegant@2x.png` … at 400 × 367 px).

---

## Slot 14: Time Warp's grandfather clock (E27)

- **What and where:** the centre of the play board, between the nests. When all the wave's eggs are laid and none is
  ready, every clock in the game speeds up 5×: that's **Time Warp**. While it runs, **this clock's hands
  spin fast**, the clock gets a green halo, and green lightning runs from its face to the nests. The rest of the time
  it just stands there with its hands still.
- **Style:** a cartoon grandfather clock in the game's 1980s-arcade look (thick dark outlines, flat bold colour, hard
  offset shadows). Rule 6 applies: if you give it a creepy touch, make it an **alien** one (a slime drip, a tentacle
  for a pendulum, an extra eye in the hood), never anything human. **No pocket watches for now.**
- **Shape:** viewBox **`0 0 80 170`** (tall and narrow). Today's placeholder: a hood with a round face at the top,
  a trunk with a pendulum window, and a base with feet.
  - **The face is a circle centred on (40, 46), radius about 22.** Keep the face there: the hands turn about that
    point, and the lightning starts from the face.
  - **Keep the bottom 30 units (y 140…170) plain**: the game lays its "TIME WARP" sign (live text, which flashes 3 times
    and then stays lit as Time Warp starts, its letters wobbling while it runs) across the base, wider than the clock, and a short caption under it ("All
    clocks 5× fast. Get your next RCAV ready!"), so anything drawn there is hidden.
  - **Keep the lower third of the face (below y 54) free of detail**: with reduced motion the hands stop and the game
    writes **"5×"** there instead.
- **Largest on screen:** about **70 × 140 px** (1 unit = 0.82 px; E28 made room for the caption); the smallest is about
  36 × 72 px. It's scaled to fit
  the gap between the nests, so it must read as a clock when small: a **big face, bold hands**, few fine details.
- **Layers** (every moving layer is its own group, **with no transform of its own**):

| Layer (class) | What it is | What the game does | Pivot (viewBox) |
|---|---|---|---|
| `face` (a circle, or a group whose first shape is the face circle) | The clock face with its 12 hour marks. **No numbers** (no text in pictures). | Still. The game finds it to start the lightning from its centre. | none |
| `hour` | The **hour hand**, drawn **pointing straight up to 12**: from the centre out to about 12–16 units | Turns about the pivot: 1/12 of a turn a second while Time Warp runs, otherwise still | **(40, 46)** |
| `minute` | The **minute hand**, drawn **pointing straight up to 12**, longer and thinner: out to about 18–23 units | Turns about the pivot: **one full turn a second** while Time Warp runs, otherwise still | **(40, 46)** |
| (still, any classes) | The case (hood, trunk, base), the pendulum window, the pendulum, and a centre cap over the hands | Still | none |

  Put the hands **after** the face in the file so they draw on top of it, and the centre cap after the hands.
- **Colours** (from `theme.css`; placeholder palette, suggest better ones by name and hex):
  - case `--clock-case` #7a4a22, outlines `--outline` #1a0d2e;
  - face `--clock-face` #fff4d6 (the game turns it pale green, `--warp-halo` #d6ffe8, while Time Warp runs);
  - hands and centre cap `--clock-hands` #1a0d2e;
  - pendulum window `--clock-window` #24123f, pendulum `--clock-brass` #e0b040.
- **Animation limits:** the hands only **turn**, which is movement, not flashing. **Nothing on the clock may flicker
  or flash.** Don't draw motion blur on the hands: they must read as two plain hands at any angle, and when still.
- **File:** `grandfather-clock.svg`.

---

## Slot 15: the sink by the hose tap (E28)

- **What and where:** a small sink with a drain, just right of the hose tap (slot 10) on the board's bottom edge. The
  hose's instructions sit beside it as live text ("CLEANING HOSE: click & drag to spray. Use it any time!"), so the
  sink is the picture and the words are the game's.
- **Shape:** viewBox **`0 0 40 24`**: a basin seen from the front, a little lower at the bottom than at the rim, with a
  **drain** (a dark oval with a grate) in the middle. Today's placeholder: a rim along y 5, the basin down to y 22, the
  drain at (20, 14).
- **Largest on screen:** about **42 × 25 px**; the smallest about 26 × 16 px. Bold, simple shapes.
- **Style:** the game's 1980s-arcade look, a cartoon kitchen sink. Rule 6 applies if you add a touch of the aliens (say,
  a little green goo round the drain).
- **Colours:** steel `--sink-steel` #c3c9d1, inside the basin `--sink-basin` #6e7682, drain and outlines `--outline`
  #1a0d2e. Suggest others by name and hex.
- **Animation:** none.
- **File:** `sink.svg`.

---

## Slots 16–20: the How To Play comic strip (E29)

- **What and where:** How To Play is a strip of five comic panels, stacked down the How To Play card on the title
  screen and down the side panel on the options screen. Each panel has a small number badge (1–5) in its top-left corner and the
  step's words in a speech bubble (**both drawn by the game**, no headings), and **one picture, on the left of the
  bubble**. **Keep the picture's top-left corner (about 20 × 20 units) plain**: the badge sits over it. These slots
  are those pictures.
- **Shape:** viewBox **`0 0 120 90`** (4:3) for each, except slot 18, which is **two** pictures (fast and slow), each
  **`0 0 120 44`**, stacked.
- **Largest on screen:** about **110 × 83 px**; the smallest about **60 × 45 px**. Draw big, simple shapes with thick
  outlines: a picture must read at 60 px wide.
- **Style:** a Saturday-morning cartoon strip in the game's 1980s-arcade look. **Rule 6 applies to every panel**:
  cartoon aliens, scary only in an alien way, **nothing human** (no hands or fingers: aliens type and hold things with
  tentacles), no red liquid, gross-funny. Reuse the title family (slot 6) so the strip feels like the same cast.
- **No text in any picture** (rule 1), including no "RCAV" and no numbers on timers: the game writes those. Leave
  the spaces noted below clear for the game's labels.

| Slot | Panel | The picture |
|---|---|---|
| 16 | 1. Watch the nests | The mommy alien lowering an egg into a nest, with a blank yellow **timer box** under the nest (the game writes the time). |
| 17 | 2. Wait for pink | A nest whose **timer box is hot pink** (`--readout-bold-timer-bg` #ff2d8a, left blank), and a little alien beside it, mouth wide open, shouting. **Leave the top right corner (about 50 × 20 units) clear**: the game puts the shout "RCAV 2101!" there in its own bubble. |
| 18a | 3. Be quick: **fast** | The frying pan slamming down (slot 4's pan) and a fancy breakfast plate (like the top dishes of slot 3). **Leave the left 24 units clear** for the game's "Fast!" label. |
| 18b | 3. Be quick: **slow** | A cracked egg with an alien leg flailing out of the crack. **Leave the left 24 units clear** for "Slow…". |
| 19 | 4. Use your Command Lines | An alien typing on **two keyboards at once with its tentacles**, one keyboard per tentacle pair. Blank keys. |
| 20 | 5. Time Warp | The grandfather clock (slot 14) with its hands spinning (speed lines are fine: it's a still picture) and an alien beside it, dizzy (spiral eyes, stars). |

- **Colours:** the named colours already in this brief (the title family, the clock, the pan and dishes, the readouts).
  Anything new is named with its hex in your notes.
- **Animation:** none: each is a still picture. Nothing may rely on motion to make sense.
- **Files:** `comic-1-watch.svg`, `comic-2-pink.svg`, `comic-3-fast.svg`, `comic-3-slow.svg`, `comic-4-lines.svg`,
  `comic-5-warp.svg` (or `…@2x.png` at 240 × 180, and 240 × 88 for the two halves of panel 3).

---

## Stays drawn by code (not image slots)

These are live shapes the game draws each frame, or styled text and panels. Gemini can suggest a **look** (colours
from `theme.css`, a pattern), but not a picture:

- **The egg-laying cord.** A fleshy cord that drops from the top of the screen to a nest, carries the egg down as a
  bulge, pops it into the nest and snakes back up. It's a live bending line (10 px wide):
  - blood red `--cord-red` #9e0a1e;
  - creeping purple stripes `--cord-purple` #7a2cc4;
  - dark ribs `--cord-ribs` #2a0010;
  - outline `--cord-outline` #1a0008;
  - bulge `--cord-bulge` #8a2fd6 with edge `--cord-bulge-edge` #3b1060.

  The egg on its tip should end up using the same egg as slot 0 (a code job).
- **The Time Warp's lightning.** Jagged green bolts that chain from the grandfather clock's face to the nearest running nest, then
  on from nest to nest, in `--warp` #3dff9a with a `--bolt-core` #c8ffe2 centre. Its ends, lengths and number change
  constantly. **It reshapes 2 times a second, never more than 2.5 (a hard safety cap)**, and holds still under
  reduced motion. No fixed picture can fit.
- **The Time Warp's glow** on running nests (a green edge the game adds), and **the hose line** from the tap to the
  cursor (6 px, `--hose` #2fbf5a with a `--hose-outline` #06280f edge).
- **The arcade attract lights:** the bulbs round the how-to panels' borders (`--bulb-*` colours).
- **Text and panels:** the unit/type/timer boxes, the AD post-its, the "Clear Fueling" bubble, the wall clock, the
  "TIME WARP" sign across the clock's base and its caption, the HUD bar, the how-to panel card, the Command Lines, the title logo and all menus.

---

## Getting the files onto the site (checked 2026-09-24)

- **Yes, the deploy publishes images from the cartridge.** The live site already serves `.svg` files (as
  `image/svg+xml`) and `.png` files (as `image/png`) from the game folder, including Egg Timer's own `favicon.svg`.
  Checked by fetching them from the live site.
- **`.webp`** isn't blocked by any deploy rule and is a standard web format, and Fang Rock already serves it as
  `image/webp`. There's no `.webp` under `Game/` yet, so none is on the live site: check the first one there after
  it's pushed.
- **A new folder `files/art/` will publish as it is.** No change to the deploy is needed. The names above (lowercase,
  hyphens, `--`, `@2x`) are all safe: none of the deploy's patterns match them, and GitHub Pages serves `@` in a
  path. The deploy's exclude list removes, among others:
  - documents (`*.md`, `*.txt`, `*.docx`, `*.xlsx`);
  - rig and tool files (`verify-*.mjs`, `verify-*.png`, `make-*.mjs`, `bake-*.mjs`, `*-test.html`);
  - source and backup files (`*.py`, `*.ts`, `*.bak`);
  - any folder, at any depth, named `screenshots`, `handoffs`, `Help Files`, `design-system` or `.claude`.
- **Things that would stop a file going live:**
  1. **A name or folder on the list above**, such as `verify-<anything>.png` or a `screenshots` folder. It is thrown
     away.
  2. **Not committing and pushing it.** Fang Rock (which Nerva Beacon opens first) plays the game from the local
     folder, so a file that isn't committed and pushed to `main` works there but is missing on the live site.
  3. **Case mismatches.** The live site is case-sensitive, but Windows, Fang Rock, the dev server and the rigs aren't,
     so a mismatch only shows up once the file is live. That's why the names are all lowercase. If a file ever needs a
     case-only rename, use `git mv` (this machine's git ignores case changes).
- **A credit or licence note** saved as `.md` or `.txt` in `files/art/` isn't copied to the game site, but **the repo
  is public**, so it can still be read on github.com. That's right for a provenance record (`files/art/README.md`):
  keep it to credits and provenance, nothing private. If an artwork ever came with a licence that must travel with
  it, the deploy would need a new include for it and a matching change to its leak check, as the font licences have
  now (theirs only cover a `fonts/` folder). Gemini-made art needs no such file.
- **Keep files small:** aim for under about 100 KB per SVG and 300 KB per PNG/WebP, so the game loads fast in the
  browser and in Fang Rock.

# Pitstop — Car Sprite Prompts (Copilot)

Ready-to-paste **Copilot** prompts for all five hero cars. Companion to
`Pitstop_Car_Sprite_Brief.md` (the hard technical constraints). Each block is a
single self-contained prompt that produces **one image with all three steering poses**
of one car (straight + gentle-right + hard-right), matching how the 2107 sheet came out.

Gemini refused to generate these — use **Copilot** (which made the working 2107 sheet).

## How to use
Copy one block per unit into Copilot. It returns a single image containing the three
poses. Slice/centre that sheet into `{unit}_c.png`, `{unit}_r1.png`, `{unit}_r2.png`
→ drop into `cartridges/Pitstop/files/assets/cars/`. The engine auto-detects them.

## Lessons baked in (v2 — after the first full 5-unit run)
1. **Both leans go RIGHT** (gentle + hard), NOT opposite directions — the engine
   mirrors right-leans for left curves, so a left-leaning frame is wasted.
2. **Force the middle (gentle) turn to be UNMISTAKABLE** (~15°). At ~10° the model
   rendered it identical to the straight frame, so r1 was lost — every sheet came out
   straight/straight/hard. v2 pushes the middle car to an obvious ~15° with an explicit
   "must NOT look straight" instruction.
3. **Per-unit livery CHARACTER must be spelled out** (broad band / pinstripe / blade /
   arrow). The first run flattened all five to the same stripe+flame livery; v2 restores
   the handling-signalling stripe per unit.
4. **Style is locked to the glossy 3D-rendered look**, not flat pixel art, so all five
   read as one field.
5. **Reality check — Copilot does NOT output true transparency.** It paints a light-grey
   "transparency" checkerboard into an opaque RGB PNG. That's fine: the checkerboard is a
   flat light region and keys out cleanly with an edge-connected flood fill (see the
   `scratchpad/key.py` + `batch.py` pipeline) — do NOT global-colour-key, it eats the
   white stripe. "no drop shadow" in the prompt reduces leftover shadow specks.

## Livery → handling/speed cue (only the livery line changes per unit)
| Unit | Colour | Feel (speed/handling) | Stripe/accent character |
|---|---|---|---|
| 2107 | green `#39ff14` | All-Rounder 6/6 | plain centred white stripe — neutral baseline |
| 2138 | blue `#4db5ff` | Steady 4/8 | broad calm band, soft accents, low-contrast — planted |
| 2045 | amber `#ffb000` | Nimble 7/5 | thin sharp pinstripe, crisp flashes — alert, quick |
| 2523 | violet `#c77dff` | Sprinter 8/4 | long low blade stripe, glossy accents — slippery |
| 2396 | red `#ff3b30` | Flat-out 9/3 | sharp arrow tapering to nose, hot slashes — aggressive |

---

## Unit 2107 — green (All-Rounder)

```text
Create a single high-resolution square image on a transparent background showing one retro arcade racing-game car — a glossy, cleanly 3D-rendered open-wheel Formula 1 / IndyCar with bold saturated colour, smooth shading, bright specular highlights and crisp edges (a polished modern arcade / console racing-game look — NOT flat pixel art and NOT photoreal).

Camera: high rear three-quarter view — camera behind the car and about 18° above it, the car pointing away from the viewer up the track, so you see the rear wing, both rear tyres, the cockpit from behind, and the body tapering to the nose. Use this exact same camera for all three cars.

Show the SAME car three times in one image, laid out left-to-right, all exactly the same size and sitting on one shared horizontal ground line, evenly spaced with clear gaps so each can be cropped out separately. All three steer to the RIGHT only (never left), and they must be VISIBLY DIFFERENT from each other — each turning further right than the one before:
1. Left — straight: wheels pointed straight ahead, body square to the camera, no lean.
2. Middle — gentle right turn: clearly and noticeably turning right, front wheels steered right, the whole car yawed about 15 degrees to the right — obviously more turned than the straight car, roughly half as much as the hard one — with a slight body roll. Make this turn unmistakable; it must NOT look straight.
3. Right — hard right turn: front wheels at near full right-lock, car yawed about 28 degrees to the right, strong body roll, rear tyres sliding outward in a drift.
The three cars must be identical in body, livery and size; only the steering angle changes.

Livery: bright arcade green (#39ff14) bodywork with white and dark-charcoal accents and a single clean centered white stripe running straight front-to-back with balanced, even accents — a neutral, well-rounded all-rounder look.

The livery must be perfectly left-right symmetric — a single centered stripe, symmetric wing, sidepods and colour blocks. No numbers, no text, no letters, no logos and no sponsor decals anywhere on the car (the game adds the unit number later). Soft key light from the upper-left, identical on all three. Transparent background — no scenery, no ground, no drop shadow. If transparency is not available, use a plain flat pure-white background with no shadow.
```

---

## Unit 2138 — blue (Steady: slow, forgiving)

```text
Create a single high-resolution square image on a transparent background showing one retro arcade racing-game car — a glossy, cleanly 3D-rendered open-wheel Formula 1 / IndyCar with bold saturated colour, smooth shading, bright specular highlights and crisp edges (a polished modern arcade / console racing-game look — NOT flat pixel art and NOT photoreal).

Camera: high rear three-quarter view — camera behind the car and about 18° above it, the car pointing away from the viewer up the track, so you see the rear wing, both rear tyres, the cockpit from behind, and the body tapering to the nose. Use this exact same camera for all three cars.

Show the SAME car three times in one image, laid out left-to-right, all exactly the same size and sitting on one shared horizontal ground line, evenly spaced with clear gaps so each can be cropped out separately. All three steer to the RIGHT only (never left), and they must be VISIBLY DIFFERENT from each other — each turning further right than the one before:
1. Left — straight: wheels pointed straight ahead, body square to the camera, no lean.
2. Middle — gentle right turn: clearly and noticeably turning right, front wheels steered right, the whole car yawed about 15 degrees to the right — obviously more turned than the straight car, roughly half as much as the hard one — with a slight body roll. Make this turn unmistakable; it must NOT look straight.
3. Right — hard right turn: front wheels at near full right-lock, car yawed about 28 degrees to the right, strong body roll, rear tyres sliding outward in a drift.
The three cars must be identical in body, livery and size; only the steering angle changes.

Livery: cool arcade blue (#4db5ff) bodywork with white and dark-charcoal accents and a single centered white stripe drawn as a broad, calm band with soft rounded accent blocks and smooth, even low-contrast shading — the car should read as planted, heavy and unhurried, a steady workhorse.

The livery must be perfectly left-right symmetric — a single centered stripe, symmetric wing, sidepods and colour blocks. No numbers, no text, no letters, no logos and no sponsor decals anywhere on the car (the game adds the unit number later). Soft key light from the upper-left, identical on all three. Transparent background — no scenery, no ground, no drop shadow. If transparency is not available, use a plain flat pure-white background with no shadow.
```

---

## Unit 2045 — amber (Nimble: quick, twitchy)

```text
Create a single high-resolution square image on a transparent background showing one retro arcade racing-game car — a glossy, cleanly 3D-rendered open-wheel Formula 1 / IndyCar with bold saturated colour, smooth shading, bright specular highlights and crisp edges (a polished modern arcade / console racing-game look — NOT flat pixel art and NOT photoreal).

Camera: high rear three-quarter view — camera behind the car and about 18° above it, the car pointing away from the viewer up the track, so you see the rear wing, both rear tyres, the cockpit from behind, and the body tapering to the nose. Use this exact same camera for all three cars.

Show the SAME car three times in one image, laid out left-to-right, all exactly the same size and sitting on one shared horizontal ground line, evenly spaced with clear gaps so each can be cropped out separately. All three steer to the RIGHT only (never left), and they must be VISIBLY DIFFERENT from each other — each turning further right than the one before:
1. Left — straight: wheels pointed straight ahead, body square to the camera, no lean.
2. Middle — gentle right turn: clearly and noticeably turning right, front wheels steered right, the whole car yawed about 15 degrees to the right — obviously more turned than the straight car, roughly half as much as the hard one — with a slight body roll. Make this turn unmistakable; it must NOT look straight.
3. Right — hard right turn: front wheels at near full right-lock, car yawed about 28 degrees to the right, strong body roll, rear tyres sliding outward in a drift.
The three cars must be identical in body, livery and size; only the steering angle changes.

Livery: bright arcade amber-orange (#ffb000) bodywork with white and dark-charcoal accents and a single centered white stripe drawn as a thin, sharp pinstripe with small crisp accent flashes and bright, snappy highlights — the car should read as light, alert and quick-on-its-toes, a nimble machine.

The livery must be perfectly left-right symmetric — a single centered stripe, symmetric wing, sidepods and colour blocks. No numbers, no text, no letters, no logos and no sponsor decals anywhere on the car (the game adds the unit number later). Soft key light from the upper-left, identical on all three. Transparent background — no scenery, no ground, no drop shadow. If transparency is not available, use a plain flat pure-white background with no shadow.
```

---

## Unit 2523 — violet (Sprinter: fast, punishing)

```text
Create a single high-resolution square image on a transparent background showing one retro arcade racing-game car — a glossy, cleanly 3D-rendered open-wheel Formula 1 / IndyCar with bold saturated colour, smooth shading, bright specular highlights and crisp edges (a polished modern arcade / console racing-game look — NOT flat pixel art and NOT photoreal).

Camera: high rear three-quarter view — camera behind the car and about 18° above it, the car pointing away from the viewer up the track, so you see the rear wing, both rear tyres, the cockpit from behind, and the body tapering to the nose. Use this exact same camera for all three cars.

Show the SAME car three times in one image, laid out left-to-right, all exactly the same size and sitting on one shared horizontal ground line, evenly spaced with clear gaps so each can be cropped out separately. All three steer to the RIGHT only (never left), and they must be VISIBLY DIFFERENT from each other — each turning further right than the one before:
1. Left — straight: wheels pointed straight ahead, body square to the camera, no lean.
2. Middle — gentle right turn: clearly and noticeably turning right, front wheels steered right, the whole car yawed about 15 degrees to the right — obviously more turned than the straight car, roughly half as much as the hard one — with a slight body roll. Make this turn unmistakable; it must NOT look straight.
3. Right — hard right turn: front wheels at near full right-lock, car yawed about 28 degrees to the right, strong body roll, rear tyres sliding outward in a drift.
The three cars must be identical in body, livery and size; only the steering angle changes.

Livery: vivid arcade violet-purple (#c77dff) bodywork with white and dark-charcoal accents and a single centered white stripe drawn as a long, low, sleek blade running straight down the body, with glossy accents and sharp, cool highlights — the car should read as slippery, high-strung and fast, a sprinter.

The livery must be perfectly left-right symmetric — a single centered stripe, symmetric wing, sidepods and colour blocks. No numbers, no text, no letters, no logos and no sponsor decals anywhere on the car (the game adds the unit number later). Soft key light from the upper-left, identical on all three. Transparent background — no scenery, no ground, no drop shadow. If transparency is not available, use a plain flat pure-white background with no shadow.
```

---

## Unit 2396 — red (Flat-out: fastest, unforgiving)

```text
Create a single high-resolution square image on a transparent background showing one retro arcade racing-game car — a glossy, cleanly 3D-rendered open-wheel Formula 1 / IndyCar with bold saturated colour, smooth shading, bright specular highlights and crisp edges (a polished modern arcade / console racing-game look — NOT flat pixel art and NOT photoreal).

Camera: high rear three-quarter view — camera behind the car and about 18° above it, the car pointing away from the viewer up the track, so you see the rear wing, both rear tyres, the cockpit from behind, and the body tapering to the nose. Use this exact same camera for all three cars.

Show the SAME car three times in one image, laid out left-to-right, all exactly the same size and sitting on one shared horizontal ground line, evenly spaced with clear gaps so each can be cropped out separately. All three steer to the RIGHT only (never left), and they must be VISIBLY DIFFERENT from each other — each turning further right than the one before:
1. Left — straight: wheels pointed straight ahead, body square to the camera, no lean.
2. Middle — gentle right turn: clearly and noticeably turning right, front wheels steered right, the whole car yawed about 15 degrees to the right — obviously more turned than the straight car, roughly half as much as the hard one — with a slight body roll. Make this turn unmistakable; it must NOT look straight.
3. Right — hard right turn: front wheels at near full right-lock, car yawed about 28 degrees to the right, strong body roll, rear tyres sliding outward in a drift.
The three cars must be identical in body, livery and size; only the steering angle changes.

Livery: hot arcade red (#ff3b30) bodywork with white and dark-charcoal accents and a single centered white stripe drawn as a sharp arrow/spear that tapers to a point toward the nose, with hot, high-contrast accent slashes and intense highlights — the car should read as aggressive and razor-edged, flat-out on the limit, the fastest and least forgiving.

The livery must be perfectly left-right symmetric — a single centered stripe, symmetric wing, sidepods and colour blocks. No numbers, no text, no letters, no logos and no sponsor decals anywhere on the car (the game adds the unit number later). Soft key light from the upper-left, identical on all three. Transparent background — no scenery, no ground, no drop shadow. If transparency is not available, use a plain flat pure-white background with no shadow.
```

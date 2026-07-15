# Pitstop — Car Sprite Brief (Gemini)

**Priority art target.** OutRun-style banking cars for the road POV. Design writes the
creative/style direction; the specs below are the technical constraints so the frames drop
straight into the engine. Pairs with `Pitstop_Art_Brief.md` (map + hub tile).

---

## What we're making: 5 cars × 3 frames = **15 sprites**

One hero car per **selectable unit** (the five in `config.js → SELECTABLE_UNITS`). Each unit
already has a signature colour — the car's livery **is** that colour, so cars, picker chips,
and map markers all match.

| Unit (hotkey) | Livery colour | Feel (drives the handling stats) |
|---|---|---|
| 2138 (3) | blue `#4db5ff`   | Steady — slow, very forgiving |
| 2107 (1, default) | green `#39ff14` | All-Rounder — balanced |
| 2045 (5) | amber `#ffb000`  | Nimble — quick, a little twitchy |
| 2523 (9) | violet `#c77dff` | Sprinter — fast, punishing |
| 2396 (7) | red `#ff3b30`    | Flat-out — fastest, unforgiving |

**Three frames per car** (leans drawn to the RIGHT only — the engine mirrors them for left curves):

| File | Pose |
|---|---|
| `{unit}_c.png`  | Straight — car centred, going away from camera |
| `{unit}_r1.png` | Gentle right lean — yaw ~8–12°, front wheels steered right, slight body roll |
| `{unit}_r2.png` | Hard right lean — yaw ~20–28°, wheels full-lock, more roll, tail stepping out a touch (OutRun drift) |

Files land in `cartridges/Pitstop/files/assets/cars/`.

---

## Hard technical constraints (all 15 frames)

- **Canvas:** 512 × 512 px, **transparent** PNG. Same size for every frame.
- **Camera:** high rear 3/4 — behind and ~18° above the car, nose pointing away up-screen. This must
  match the road POV (car sits at screen-bottom-centre looking down the road). Same camera on all frames.
- **Consistent footprint:** rear-tyre ground-contact at the same baseline (~y = 430 of 512) and centred
  in the straight frame, so swapping frames makes the car *pivot*, never jump. Lean frames keep that
  same contact baseline.
- **No baked ground shadow** — the engine draws the contact shadow (`car-shadow`) and the unit number
  (`car-unit`) as separate layers on top. Leave a clean, neutral rear/engine-cover area; **do not draw
  any digits or unit numbers** on the car.
- **Symmetric livery** — centred stripe, symmetric wing / sidepods / colour blocks, no asymmetric decals
  or text. (Required so the horizontal mirror for left-hand curves looks correct.)
- **Consistent lighting** across all frames: soft key light from upper-left. Same on every frame.
- **Shared silhouette v1:** all five use the **same open-wheel F1/Indy chassis**, differing only by
  livery colour — they read as one racing field, keep the frames consistent, and are fast to produce.
  (We can give the fast/slow cars distinct body shapes in a later pass if you want silhouette to signal
  handling too.)

## Style note (Design's call)
For OutRun fidelity + crisp mirroring/scaling, **arcade sprite style** (limited palette, clean edges)
reads better here than photoreal — and matches the CRT/Press-Start aesthetic. Whatever style is chosen,
it must be **identical across all 15 frames**.

---

## How these get used (engine side — Code builds this)
1. **Road curves** — add a curve value to the road model so the perspective road bends L/R over a leg
   (later driven per-municipality). Car + camera stay screen-bottom-centre; the world curves.
2. **Steer state** → picks the frame (`c` / `r1` / `r2`) and a mirror flag from the current curve.
3. **Sprite layer** replaces the CSS div-car; swaps to `{unit}_{frame}` and applies `scaleX(-1)` for
   left curves. Number + shadow stay as DOM layers on top.
4. **Handling stats** — attach `speed` / `handling` per selectable unit (re-activates the gated
   `CAR_TYPES` idea, merged into the unit): `speed` → top speed / scroll rate; `handling` → how hard a
   typo bleeds speed.

Engine work 1–3 can be built against placeholder colour blocks **in parallel** with the art, then the
real sprites swap in as they arrive — so we're not blocked on Gemini.

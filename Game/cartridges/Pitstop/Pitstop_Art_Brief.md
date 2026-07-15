# Pitstop — Art Brief (Gemini image targets)

**Audience:** Claude Design (creative direction) + Gemini (generation), routed by Andrew.
**Author:** Claude Code (Systems Integrator) — the technical-constraints half of each prompt.
**Rule of thumb:** Design writes the *look* (mood, palette, composition); the specs below get
appended so Gemini's output can actually be wired into the code.

---

## Read this first — Pitstop's visuals are code, not images

The scene you're looking at (road, sun, clouds, car, cones, region map) is drawn **procedurally**:
CSS gradients + a layered CSS perspective road (`#roadView` in `files/index.html`) and inline SVG
(the minimap, built in `files/script.js`). There are **zero image files in the cartridge today**,
and only **two dormant image hooks** in `files/core/config.js` — `REGION_MAP.image` and
`ROAD_VIEW.image` — neither consumed by the live renderer yet.

So "get Gemini to make images" is **not** a PNG-for-PNG swap. Each raster we introduce is a
deliberate replacement with its own wiring. Targets below are ordered **easiest / lowest-risk →
hardest**.

## Where the files go
- **Cartridge game art** → `cartridges/Pitstop/files/assets/` (config paths are relative to `files/`).
- **Hub cassette tile** → `Game/assets/images/` (next to `asteroid-command.png`).
- Design reads these from GitHub **after Code commits + pushes** — that push is the only bridge
  into the repo.

---

## Target 1 — Hub cassette tile ✅ clean win, no code dependency

The key-art shown in the arcade hub when Pitstop is selected. Currently the placeholder
`Game/assets/images/coming-soon-placeholder.svg` (referenced as `screenshot:` for the `pitstop`
entry in `Game/core/submenu.js`).

- **File:** `Game/assets/images/pitstop.png`
- **Format / size:** PNG. **Match the existing `asteroid-command.png`** exactly for dimensions +
  aspect ratio (it's rendered as an `<img>` in the same info-panel slot). Same PET-terminal framing.
- **Content:** representative Pitstop key-art — checkered-flag arcade racing, "PITSTOP · NEMS 500",
  green-phosphor-on-dark, retro CRT feel. Legible at small size.
- **Wiring (Code):** point the `pitstop` `screenshot:` field at `assets/images/pitstop.png`.
- **Dependency:** none. Can be generated and dropped in immediately.

---

## Target 2 — Region map background ✅ good fit, one soft dependency

A painted top-down Niagara map that sits **behind** the bright-green SVG route + base nodes on the
minimap and the pre-race course preview.

- **File:** `cartridges/Pitstop/files/assets/region_map.png`
- **Content:** stylized top-down Niagara Region — land, water (Lake Ontario along the top, Niagara
  River along the east), major road hints. **Muted / desaturated** — it's a backdrop; the phosphor
  route lines and base dots must read clearly on top of it. North up.
- **Geographic bounds — Gemini must frame to EXACTLY this box:**
  `north 43.30 · south 42.84 · west −79.62 · east −78.94`
  (Code sets `REGION_MAP.bounds` to the same values, then geo-references each base onto the image.
  If the framing drifts even a little, every base node lands in the wrong place.)
- **Aspect ratio — critical:** at ~43° N this box is ≈ **55 km wide × 51 km tall → aspect ≈ 1.08:1
  (landscape, near-square)**, e.g. **1080 × 1000 px**. The image's pixel aspect must equal the
  geographic aspect or the map (and every node on it) stretches. **Do not crop to 16:9.**
- **Dependency (soft):** base coordinates in `datasets/Bases_Coordinates_PLACEHOLDER.csv` are still
  `APPROX-PLACEHOLDER`. That's fine for a game minimap **as long as they fall inside the fixed box
  above — they do.** Lock the bounds now, brief Gemini to that box; if coordinates are refined later
  the nodes just shift on the *same* map — no re-render needed.

---

## Target 3 — The road scene ⚠️ not one image — decide *with Design* first

`#roadView` is a **live CSS pseudo-3D perspective animation**: layered sky / sun / clouds / ground /
asphalt / rumble strips / centre line / chevrons, parallax roadside scenery flying toward the camera,
and a car built from ~15 `div`s — all scroll-reactive via the `--road-spd` custom property. A single
static PNG can't reproduce that motion, and `ROAD_VIEW.image` is described in code as a *future* swap
the renderer does not consume today.

So **do not ask Gemini for a single `road_loop.png`** — it won't drop into the animated scene. Pick a
direction with Design (who authored this layer structure, from "Pitstop Arcade.dc.html"):

- **A) Keep the animation, upgrade the textures** — *recommended if the goal is "less flat."*
  Gemini supplies small, **seamlessly tiling** fills + **transparent** sprites for individual layers:
  a tiling asphalt strip, a sky gradient, transparent tree/rock/bush sprites to replace the CSS
  scenery, and — highest impact and easiest of the set — a **car sprite** (3/4 view from behind,
  transparent PNG, white body / green + blue trim / unit number). Each is a small, targeted code swap.
- **B) Replace the whole POV** with a pre-rendered looping strip or sprite-sheet — much bigger job,
  usually not worth it versus A.

Recommendation: if you want a quick road upgrade, start with just the **car sprite** under option A.

---

## Handoff flow (recap)
1. **Design** writes the creative brief per target; the constraints above get appended.
2. **Gemini** generates.
3. Drop PNGs into the folders above, in your **local** PLC copy.
4. **Code** wires the hooks/paths (and `REGION_MAP.bounds`), commits + pushes → Design now sees them
   in the repo. Upload the finals into Design's chat too, so its canvas preview matches what ships.

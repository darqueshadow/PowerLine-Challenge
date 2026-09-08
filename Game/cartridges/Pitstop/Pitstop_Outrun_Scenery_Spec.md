# Pitstop — Outrun Scenery & Municipality Theming Spec

**Cartridge:** Pitstop
**Status:** Design capture / proposal. NOT yet governance. Brainstorm with Andrew
locked the shape below; config values and the items in §7 remain Andrew's calls.
**Author:** Claude Chat (Senior Dev) — design capture for Andrew
**For:** Claude Code (Systems Integrator) awareness + Gemini (UX/asset) awareness.
Do not implement until the movement/leg layer this depends on is un-gated (see §6).

---

## 0. The idea in one line

> **The roadside scenery is themed to the real municipality the car is driving
> through, and which side each feature (lake, river, escarpment, landmark) appears
> on is *derived from the direction of travel* — never hand-placed twice.**

Outrun-style layered parallax scenery, keyed to Niagara geography, so a leg into
Niagara-on-the-Lake grows vineyards and a leg up the Parkway puts the river and the
Falls on your right — and reverses correctly when the car goes the other way.

---

## 1. What was decided (this brainstorm — Andrew signed off on the shape)

| # | Decision | Note |
|---|---|---|
| S1 | **Theme by municipality, boundary-triggered ("Option C").** Each base sits in a municipality; the leg's scenery is keyed to it. The hard visual change fires **only when the municipality actually changes** (`destMuni !== currentMuni`) — same-muni legs continue the skin, no re-trigger. | Kills strobing; makes crossings meaningful. |
| S2 | **The seam lands on the base arrival (`BSE` beat).** Reuses the existing arrival moment (`arrivalGate` ~0.66, `race.arriving`). A "Now Entering \<Municipality\>" banner is just a track-positioned object, like the Type B gantries via `tfProject()`. | No new arrival concept needed. |
| S3 | **Scenery has handedness: independent left and right channels.** The roadside is not one layer — features are placed on the correct side for the current heading. | Two-sided legs (lake one side, escarpment the other) fall out for free. |
| S4 | **Handedness is DERIVED, not authored per direction.** No directed base-to-base matrix storing "A→B = river right / B→A = river left." Side is computed from the leg's bearing; reverse the leg and it flips automatically. | Single source of truth. See §3. |
| S5 | **Landmarks are placed once in space ("Way 1 / auto-placement").** Each landmark (Falls, Brock's Monument, a winery, the SkyWheel) gets a real position once; the engine works out per-leg whether you pass it, on which side, and when. Hand-authored per-leg overrides are an **exception shelf**, not the primary store. | Scales to the Random course with zero extra authoring. |
| S6 | **Foreshadowing is derived from the destination.** As the car nears the next base, that base's signature landmark rises on the far layer. A→B teases B; B→A teases A. | Free consequence of S4/S5. |

---

## 2. Why derive instead of enumerate — the Random course proves it

Code wired in a **Random course** that may run **clockwise** with its own base
picks, whereas every hand-authored circuit runs counter-clockwise. That is the
whole argument for S4/S5:

- A hand-authored directed matrix would need a cell for **every ordered pair** a
  route could use (~17 bases → up to 272 directed cells), and Random can connect
  pairs no designed course ever makes adjacent. Most cells would be dead weight,
  and each is a maintenance liability.
- Storing both `A→B` and `B→A` creates **two sources of truth for one stretch of
  road** — exactly the failure mode the Geography spec §4.2 warns about ("anything
  a human can hand-edit will decouple silently"). Edit one, forget the other, and
  reversing quietly stops flipping. No error fires.

Deriving side from geometry means **any** leg — clockwise, counter-clockwise, or a
Random pairing never seen before — renders correctly from data that already exists.

---

## 3. How handedness works (for Code)

**Side = which side of the travel line a feature sits on.** In projected map
coordinates (x = east, y = north — the projection §3 of the Geography spec already
produces these):

- Travel vector `t` = (B − A) for the current leg.
- Offset vector `r` = (feature position − A).
- **Cross-product sign** `z = t.x·r.y − t.y·r.x` → **z > 0 = left, z < 0 = right**
  (fix the convention once and keep it).

Reverse the leg → `t` negates → `z` flips → the feature swaps sides. That is the
entire "01→00 gets flipped" behaviour, with nothing stored per direction.

This gives two tiers, only one of which is a lookup at all:

**Tier 1 — Ambient features (no per-edge data).** Define each big feature's
geometry **once**:

- Lake Erie = southern edge
- Lake Ontario = northern edge
- Niagara River = eastern edge
- Niagara Escarpment / the Bench = an east–west line through the middle
- Welland Canal = a north–south line

For any leg, the bearing decides which ambient features flank it and on which side.
Covers the bulk of the look for almost no authoring.

**Tier 2 — Point landmarks (a small placed list).** Each landmark has a position
(a lat/lon, or "along segment X at 60%"). Per leg the engine asks: near this
stretch? which side (cross-product)? how far along? All derived, all reverse-correct.

**Exception shelf (optional).** A sparse per-leg override for the few stretches
where pure geometry picks the wrong thing or a curated framing is wanted. Geometry
is the default; overrides are deliberate, rare, and self-documenting.

---

## 4. Base → Municipality map (DRAFT — Andrew to confirm the starred border cases)

Read from `files/datasets/baselatlon.csv`. Which municipality a base sits in is a
**physical fact** and therefore shared-reference data (same class as lat/lon, per
Geography spec L1) — proposed as a new `municipality` column on `BaseGeo`, authored
in Excel at source, **not** patched into the CSV.

| Base | Municipality | | Base | Municipality |
|---|---|---|---|---|
| 72100 Niagara Falls | Niagara Falls | | 72111 Pelham | Pelham |
| 72101 Ontario St | St. Catharines | | 72113 Ridgeway | Fort Erie |
| 72102 Linwell | St. Catharines | | 72115 Glendale | Niagara-on-the-Lake \* |
| 72103 Thorold | Thorold | | 72116 St Paul | St. Catharines |
| 72104 NOTL | Niagara-on-the-Lake | | 72117 Fort Erie | Fort Erie |
| 72105 Grimsby | Grimsby | | 72118 Merrittville | Thorold \* |
| 72107 Port Colborne | Port Colborne | | 72125 Prince Charles | Welland |
| 72108 King St | Port Colborne \* | | WF-CRU Wainfleet | Wainfleet |
| 72109 Smithville | West Lincoln | | | |

\* Border cases — Glendale, Merrittville, King St straddle boundaries. Andrew's
call from local knowledge; the lat/lon can't settle them cleanly.

---

## 5. Per-course "camera" reads (illustrative — not authored data)

Because courses don't reverse mid-race (Andrew), each has a stable feel; only the
Random course flips direction, which S4 handles. A few to picture the payoff:

- **NEMS-01 River Run** (Fort Erie → Niagara Falls → … → NOTL): northbound Niagara
  Parkway. River + the Falls + tourist landmarks stacked on the **right**; quieter
  left. The right channel becomes a greatest-hits reel.
- **NEMS-02 North Shore** (NOTL → St. Catharines → Vineland → Grimsby): westbound
  wine route. Lake Ontario **right**, escarpment + vineyard rows **left** — the
  richest two-sided course.
- **NEMS-03 Erie Shore** (Wainfleet → Port Colborne → Ridgeway → Fort Erie):
  eastbound. Lake Erie **right** (Andrew's original instinct); marsh/beach easing
  into Fort Erie's town edge on the left.
- **NEMS-07 Grand Tour**: the showcase where the municipality skin and the handed
  features shift leg by leg across the whole region.

---

## 6. Dependencies & where this sits in the build

- **This is a visuals/theme layer.** Per the Laws, themes may change visuals,
  audio, fonts, animation — so scenery art and the muni→skin mapping live in the
  cartridge theme, **not** `/core`. It is **not** attack-model territory, so the
  §0.9 combat gate does not apply to it.
- **It does depend on Phase 1+ base-to-base leg movement existing** (the AP→ENP→BSE
  leg, arrival roll, `tfProject()` road projection). Per `cartridge.json`, Phase 1+
  leg mechanics are themselves gated pending an Overview clause. **Scenery should
  not be implemented ahead of the movement layer it decorates.**
- **Fits the existing renderer.** The Art Brief documents `#roadView` as a live
  layered CSS pseudo-3D scene with parallax roadside scenery already flying toward
  the camera (`--road-spd`), plus a dormant `ROAD_VIEW.image` hook. The left/right
  channels are an **extension of that existing roadside layer**, and the muni skins
  are Option A from the Art Brief (tiling fills + transparent sprites), not a
  full-POV replacement.

**What Code must NOT do here:** author handedness per direction; build a dense
directed matrix; persist derived side/foreshadow values; patch the CSV to add
`municipality`; pick any config value in §7; place scenery logic in `/core`.

---

## 7. OPEN — Andrew decisions (Code does not resolve these)

| # | Item | Blocks |
|---|---|---|
| O1 | **`municipality` values** for the three starred border bases (§4). | The muni map |
| O2 | **Feature geometry** — the actual lines/edges for lake shores, river, escarpment, canal (Tier 1). Approximate is fine; it only drives which side, not cartography. | §3 Tier 1 |
| O3 | **Landmark list + positions** (Tier 2): which landmarks exist, where, and each one's signature base for foreshadowing. | §3 Tier 2, §5 |
| O4 | **Left/right sign convention** ratified once (z>0 = left proposed). | §3 |
| O5 | **Municipality skin art** per municipality — palette + the 4 layer slots (sky / far / mid / roadside), authored by Design/Gemini. | Whole look |
| O6 | **Boundary banner treatment** — does "Now Entering \<Muni\>" reuse the Type B gantry style, or get its own look? | S2 |
| O7 | **Foreshadow trigger distance** — how early the destination landmark rises on the far layer. | S6 |

---

## 8. Handoff notes

- **To Code:** this defines *what* and *why*, not *where*. Module/file layout is
  yours. The load-bearing technical commitment is S4 — side is derived (cross-product
  on the leg vector), never stored per direction. Everything else can be tuned; that
  one is the invariant that makes the Random course work.
- **To Design/Gemini:** the deliverables are the municipality skins (O5) and the
  landmark sprites (O3) — transparent PNGs / tiling fills per the Art Brief's Option
  A. Compose to independent left and right channels; do not bake a feature onto a
  fixed side, because the engine chooses the side at runtime.
- **Governance:** proposes one new shared-reference field (`BaseGeo.municipality`,
  a physical fact). No new command syntax. No core changes. Confirm the Phase 1+
  dependency in §6 before scheduling.

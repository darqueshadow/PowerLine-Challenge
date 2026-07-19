# NEMS 500 / Pitstop — Geography, Course & Tire System Spec

**Handoff:** Claude Chat (Senior Developer) → Claude Code (Systems Integrator)
**Date:** 2026-07-16
**Written against:** Laws v1.6, Overview, Build Procedure (current authority)
**Status:** Design locked where marked LOCKED. Open items are NOT for Code to resolve.

---

## 0. READ THIS FIRST — Governance Constraints

**0.1 — There is a standing gate on this cartridge.**
The §0.9 attack-model Overview clause is an open governance gate blocking *"kill-screen logic implementation and any Phase 1+ divergent mechanics in NEMS 500."*

The tire damage system defined in §5 below is plausibly a Phase 1+ divergent mechanic. **Code must confirm with Andrew whether this gate applies before implementing §5.** Do not self-clear it. If it applies, §§1–4 (data + geometry) may still proceed — they are not combat mechanics.

**0.2 — Laws v2.0 is in flight.**
This spec is written against v1.6. The v2.0 drafts authored by Code remain classified as unauthorized raw material pending governance review. **Do not implement against v2.0 drafts.** If this spec appears to conflict with a v2.0 draft, v1.6 wins and the conflict gets raised, not resolved.

**0.3 — Open items are blocked, not inferred.**
Every item in §8 is an Andrew decision. Where this spec is silent, Code stops and asks. Filling a gap with a reasonable default is governance authorship and is out of lane.

**0.4 — No file placement is specified here.**
Directory structure, filenames, and module boundaries are Code's domain. This document defines *what*, not *where*.

---

## 1. Decision Log (LOCKED — Andrew signed off)

| # | Decision | Notes |
|---|---|---|
| L1 | `BaseGeo` is **shared reference data**, not cartridge-owned | Physical facts about real bases; no theme content |
| L2 | The **Course entity is Pitstop-local** | Racing vocabulary permitted; Rally Race is cancelled, so no cross-cartridge reuse case exists |
| L3 | **"Westwood as canonical fixed pit location" is SUPERSEDED** | Audit-locked item explicitly retired. Record it as superseded, not lapsed. |
| L4 | **72122 is a code, not a place** | It is the CAD code to enter the pit. The pit has no lat/lon. |
| L5 | The pit is **track furniture**, positioned adjacent to start/finish | Position is a rendering decision, not a geographic fact |
| L6 | **Tire damage = player enters the wrong command** | Genuinely Miss-driven |
| L7 | Each tire has the **same hit capacity `N`**; **which tire takes a hit is random (uniform)** | |
| L8 | Blowout does **not** force a pit | Player may continue on a blown tire |
| L9 | **All four tires blown = 0 kph = Terminal Failure State** | This satisfies §0.19 for NEMS 500 |
| L10 | **Each tire is worth exactly 50 kph** of a 200 kph top speed | Derived from L9 |
| L11 | Tires are swapped via a **`SWAP` command**, player-selected, any number per visit | Command not yet chosen — see §8 |
| L12 | Pit exit is **`AP` to the next base in the course sequence** | |
| L13 | **Shift Change is scheduled, not chosen**; race wall-clock continues throughout | Pre-existing locked mechanic, unchanged |

---

## 2. `BaseGeo` — Shared Reference Data

### 2.1 Schema

| Column | Type | Constraint |
|---|---|---|
| `bse_code` | integer | Primary key. Must match existing Data Sheet base codes exactly. |
| `base_name` | text | Must match existing Data Sheet base names exactly. |
| `lat` | decimal | Signed decimal degrees. |
| `lon` | decimal | Signed decimal degrees. **Negative for Niagara.** |

Four columns. No address column, no notes column — a second descriptive field becomes a second source of truth.

Authored in Excel, exported to CSV (existing Excel→CSV pipeline, Copilot's lane). **The Excel sheet is the source of truth. The CSV is a build artifact.**

### 2.2 Known defects in the current data

The file `Bases lat lon.csv` as supplied has three defects. **These are repaired at source in Excel by Andrew — Code must not patch the CSV**, or the CSV and the Excel sheet diverge permanently.

| # | Defect | Repair |
|---|---|---|
| D1 | **17 of 18 rows have positive longitude.** Only 72100 is correct. All others resolve to Kazakhstan. | Negate. |
| D2 | **72122 (Westwood) carries coordinates identical to 72115 (Glendale)** — `43.159931, -79.154590`, byte-for-byte. | **Delete the row.** Per L4, 72122 is a code with no location. Its presence in `BaseGeo` asserts a false geographic fact and would render two nodes on top of each other. |
| D3 | `Linwell ` has a trailing space. | Trim. Will otherwise fail the name join. |

### 2.3 Load-time validation (Code implements)

Code must **reject the dataset and surface an error** — not repair, not warn-and-continue — on any of:

| Rule | Detail |
|---|---|
| V1 | Bounds check: `lat` ∈ [42.8, 43.4], `lon` ∈ [-79.7, -78.8]. Anything outside is a sign or typo error. |
| V2 | No duplicate `bse_code`. |
| V3 | No two bases at identical coordinates (tolerance ~1e-6). |
| V4 | Every `bse_code` and `base_name` resolves against the existing Data Sheet. |
| V5 | No trailing/leading whitespace in `base_name`. |
| V6 | `72122` must **not** appear in `BaseGeo`. |

V1 is the important one. A sign error produces a dataset that parses cleanly, projects cleanly, and is silently wrong.

### 2.4 Reference values (verification only — NOT a data source)

Computed from the sign-repaired data, 72122 excluded. Code may use these to confirm a correct load:

- 17 bases
- Bounds: lat `42.8845 … 43.2532`, lon `-79.5477 … -78.9394`
- Median pairwise distance: **21.1 km**
- Furthest pair: Grimsby (72105) ↔ Fort Erie (72117) = **55.2 km**

If a load produces materially different figures, the data is wrong.

---

## 3. Projection

Equirectangular, scaled for latitude:

```
x ∝ (lon − lon_ref) × cos(lat_ref)
y ∝ (lat − lat_ref)
```

`lat_ref` = dataset mean latitude (≈43.07).

At Niagara's ~55 km extent, distortion is well below one rendered pixel. Do not introduce a heavier projection.

**Distance** is great-circle (haversine), R = 6371.0088 km. Straight-line only — **no road routing, no elevation, no map tiles.**

**Output is a schematic**, transit-map styled — not a cartographic map. No third-party map imagery at any point. The repo is public; tile licensing is not ours to assume, and a raster map cannot be themed.

---

## 4. Course Entity (Pitstop-local)

### 4.1 Authored fields

| Field | Type | Notes |
|---|---|---|
| `CourseID` | text | Stable key. Never reused, never renamed. |
| `CourseName` | text | Display only. |
| `Sequence` | ordered list of `bse_code` | The circuit, in order. |
| `Laps` | integer | |
| `Closure` | enum | `Circuit` \| `PointToPoint` |

### 4.2 Derived fields — computed at load, never authored, never persisted

| Field | Derivation |
|---|---|
| `Legs` | Consecutive pairs from `Sequence` |
| `LegDistance` | Haversine per leg |
| `TotalDistance` | Σ `LegDistance` × `Laps` |
| `Tier` | Banded from `TotalDistance` (bands: open, §8) |
| `NodeXY` | Projected canvas coordinates |
| `LapTime(v)` | `TotalDistance / Laps / v` |

**This split is the core invariant of the whole system.** Anything in the derived column that a human can hand-edit will decouple the difficulty axis from the map, silently. If a course "looks wrong," the fix is the coordinates or the sequence — never the rendered position.

### 4.3 Invariants

| # | Rule |
|---|---|
| C1 | Every `bse_code` in `Sequence` exists in `BaseGeo` |
| C2 | `Circuit`: `Sequence[0] == Sequence[-1]` |
| C3 | No repeated base within one lap, except the closing element of a `Circuit` |
| C4 | ≥ 3 distinct bases |
| C5 | Every leg ≥ `minLegDistanceKm` (**config value, not a constant**) — below it, two nodes render on top of each other |
| C6 | `72122` must not appear in `Sequence` |

### 4.4 Pit facility

- **Not a node in `Sequence`.** It is attached to the course, not part of it.
- Entry code `72122` — **cartridge constant**, not a Course field.
- Rendered adjacent to the start/finish node.
- Exit requires `AP` to `Sequence[i+1]`, so **the engine must track current position within `Sequence`** to validate the exit command.
- Pit cost = `pitFloor` (config) + player's own typing time for chosen swaps. The floor exists so that a zero-swap pit is not free.

---

## 5. Tire System (§0.19) — SUBJECT TO THE §0.9 GATE, SEE 0.1

### 5.1 Model

- 4 tires, each with capacity `N` hits.
- A **wrong command** deals 1 hit to a **uniformly random** tire.
- Non-blowing hit: top speed −`d`.
- `N`th hit to a tire: that tire blows, top speed −`B`.
- **Constraint:** `(N − 1) × d + B = 50`, so 4 destroyed tires = exactly −200 = 0 kph = terminal.

### 5.2 Recommended values (PROPOSAL — Andrew has not locked these)

`N = 4, d = 5, B = 35`

| State | Top speed | |
|---|---|---|
| Clean | 200 | 100% |
| 3 hits, no blowout | 185 | 93% |
| 1 tire blown | 150 | 75% |
| 2 tires blown | 100 | 50% |
| 3 tires blown | 50 | 25% |
| 4 tires blown | **0** | **Terminal** |

Each tire = one quarter of the car. Legible without a tutorial.

**All four values are config, per tier. None are constants.**

### 5.3 Why `N = 4` is a floor, not a preference

With uniform random assignment, the chance that the first `N` mistakes all land on one tire — a blowout at the earliest possible moment — is `4^(1−N)`:

| N | Chance of blowout on the Nth mistake |
|---|---|
| 2 | 25% |
| 3 | 6.25% |
| **4** | **1.6%** |
| 5 | 0.4% |

At N=3, one player in sixteen blows a tire on their third error and it will read as arbitrary. **`N` is a fairness floor, not just a difficulty knob.** If Andrew wants `N < 4`, damage assignment must be weighted toward the healthiest tire — which trades drama for predictability and is a design decision, not a tuning one.

Uniform randomness also removes the need for a non-linear damage curve: an unpredictable blowout point makes the pit call a risk read rather than an arithmetic one. Linear `d` is sufficient *because* assignment is random. If assignment ever becomes weighted, revisit this.

### 5.4 Pit / SWAP

- Player sees per-tire state and chooses which tires to swap. Any number, including zero.
- Swapping restores that tire to full capacity.
- Each swap costs one typed command; the race clock runs throughout.

**Per-tire damage state must be on the HUD.** This is a mechanical requirement, not a visual preference — a triage decision made blind is indistinguishable from the game cheating. This constrains Gemini's HUD design; it is not Gemini's call.

The genuine decision is not blown tires (always swap) but **near-blown** ones: an `N−1` tire is one mistake from −`B`. Spend a command now, or gamble. That tension is generated by the mechanic and requires no tuning.

---

## 6. Time Compression — REQUIRED, VALUE OPEN

Real geography at 200 kph produces real driving times, and Niagara is larger than an arcade round.

Measured from the repaired data:

| Sample course | Lap km | Lap @200 kph |
|---|---|---|
| Shortest viable 3-base circuit (72100→72116→72115) | 15.3 | **4m 35s** |
| 72118→72111→72103 | 23.2 | 6m 57s |
| 72105→72109→72110 | 35.0 | 10m 30s |
| 72107→72113→72117 | 50.5 | 15m 08s |
| 14-base grand tour | 155.7 | **46m 42s** |

The shortest possible lap is 4½ minutes. Three laps of it is a 14-minute round.

**Therefore:** a time compression factor `S` (game-seconds per real second) is required. 200 kph stays on the dial; the world moves faster beneath it.

### 6.1 Why `S` is the single most important config value

**Pit time is real typing time and does not scale. Race time does.** `S` therefore controls, alone, whether pitting is a decision or a formality.

Worked at `S = 3`, one tire blown:

| Course | Lost/lap (game s) | Lost/lap (real s) | Pit ≈60s real worth it? |
|---|---|---|---|
| 15.3 km | 92 | 31 | Only with 2+ laps left — **a decision** |
| 23.2 km | 139 | 46 | Marginal — **a decision** |
| 35.0 km | 210 | 70 | Usually |
| 50.5 km | 303 | 101 | Always |
| 155.7 km | 934 | 311 | Always, immediately |

One constant, a different pit strategy per course, derived from geography with zero per-course tuning.

**`S` cannot be set until Andrew specifies target round length.** Code must not pick it.

---

## 7. Data-Driven Requirement

Per project values, **none of the following may be hardcoded.** All are config, tier-modulated where applicable:

`topSpeed` · `N` · `d` · `B` · `S` · `pitFloor` · `minLegDistanceKm` · tier distance bands · pit entry code (`72122`) · tire identifiers

---

## 8. OPEN — Andrew decisions. Code does not resolve these.

| # | Item | Blocks |
|---|---|---|
| O1 | **Does the blowout hit also cost `d`, or does `B` replace it?** §5.2 assumes replace. If both, each tire = 55 kph and the 0 kph endpoint drifts off. | §5 — arithmetic |
| O2 | **Target round length** → sets `S` | §6 — everything time-based |
| O3 | **`SWAP` command selection** — see §9.1 | §5.4 |
| O4 | **Tire identifiers** (`LF/RF/LR/RR`, or numbered). This is a data pool and belongs in the Data Sheet. | §5.4 — command syntax |
| O5 | **Course definitions** — Andrew is authoring these separately | §4 — no courses exist yet |
| O6 | **Tier distance bands** | §4.2 `Tier` |
| O7 | **3-tires-blown crawl.** At 25% speed the player is dead but still on the clock — potentially minutes of unrecoverable limp. Leave it, or trigger something (black flag / forced retirement / EOS call)? | §5 — endgame |
| O8 | **Does `§0.9` gate this?** See 0.1 | §5 entirely |

---

## 9. Governance Flags Raised by This Spec

### 9.1 `SWAP` must not be invented syntax — HIGH

PLC's entire purpose is that real CAD syntax becomes second nature. A fabricated command builds muscle memory for something that does not exist, filed in the same mental drawer as `AP` and `BSE`.

Laws v1.6 permit themes to change visuals, audio, fonts and animation, and **forbid themes changing dataset logic**. A command invented to serve the racing theme is a theme leaking into the dataset.

**Two acceptable resolutions:**
1. `SWAP` maps to a **real PowerLine command** present in the Data Sheet, or
2. Tire swapping is made **obviously non-CAD** — a keypress or UI action the brain files as game furniture.

**Unacceptable:** a plausible-looking invented command. That is the one that teaches falsely.

### 9.2 Proposed new Law — MEDIUM

> *Cartridges may not introduce command syntax absent from the Data Sheet.*

Generalizes past Pitstop. Prevents every future cartridge from inventing thematically convenient commands. Requires Andrew's authorization; drafted here as a proposal only.

### 9.3 Audit record — L3 supersession — MEDIUM

The audit-locked *"Westwood as canonical pit location / pit-spur cost derives from geography"* item is retired by L4/L5. It should be recorded as **explicitly superseded with rationale**, not silently dropped.

Worth noting for the record: the geography-driven difficulty axis was **not** lost in the trade. It relocated twice — first to tire-damage cost (a longer course punishes lost top speed harder), then to pit break-even (§6.1). Both are stronger than the original, because they respond to player performance rather than to course selection alone.

### 9.4 §0.19 divergence from Aquanaut — LOW, for the record

Aquanaut's Miss-driven cumulative pool (dive-bell hull, 9 HP) is **non-terminal** — breach triggers ROV assist. NEMS 500's tire pool is **terminal** at 0 kph. This is a deliberate divergence, not an inconsistency, and belongs in the audit record so a future reviewer does not "correct" it.

---

## 10. Suggested Build Order

Phased, per the established NEMS 500 approach:

1. **`BaseGeo` load + validation (§2.3).** Reject-on-error. Independent of the §0.9 gate.
2. **Projection + distance (§3).** Verify against §2.4 reference values.
3. **Course entity + invariants (§4).** Blocked on O5 for real content; the entity and its validation can be built against a throwaway fixture.
4. **Schematic render.** Nodes from `NodeXY`, legs from `Legs`.
5. **Tire system (§5).** ⚠ **Blocked pending O8, O1.**
6. **Pit / SWAP (§5.4).** ⚠ **Blocked pending O3, O4.**
7. **Time compression (§6).** ⚠ **Blocked pending O2.**

Steps 1–4 are unblocked today. Everything after needs an Andrew decision first.

---

## 11. What Code Must Not Do

- Patch the CSV. Defects D1–D3 are repaired in Excel at source.
- Persist derived fields (§4.2), or allow hand-editing of `NodeXY`.
- Pick `S`, `N`, `d`, `B`, `pitFloor`, or tier bands. All are Andrew's.
- Choose or invent the `SWAP` command (§9.1).
- Hardcode any value listed in §7.
- Self-clear the §0.9 gate (§0.1).
- Implement against the unauthorized Laws v2.0 drafts (§0.2).
- Add a base to `BaseGeo` that is not a real physical base — including `72122`.

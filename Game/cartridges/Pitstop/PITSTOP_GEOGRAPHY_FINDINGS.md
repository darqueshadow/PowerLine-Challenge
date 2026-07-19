# NEMS 500 / Pitstop — Geography & Course: Build Report + Findings

**From:** Claude Code (Systems Integrator)
**Against:** *NEMS 500 / Pitstop — Geography, Course & Tire System Spec* (2026-07-16), Laws v1.6
**Date:** 2026-07-16

---

## 1. What was built

| Spec | Step (§10) | Status |
|---|---|---|
| §2 `BaseGeo` load + §2.3 validation (V1–V6), reject-on-error | 1 | **Done** — `core/basegeo.js` |
| §3 Projection + haversine distance | 2 | **Done** — `core/basegeo.js` |
| §4 Course entity + derived fields + invariants C1–C6 | 3 | **Done** — `core/course.js` |
| Schematic render | 4 | **Done & wired live** (Andrew: "load it all up", 2026-07-17) — see §8 |
| §5 Tire system | 5 | **Not started** — §0.9 gate (O8) + `N` unresolved; see §6 |
| §5.4 Pit / SWAP | 6 | **Not started** — O3, O4 |
| §6 Time compression | 7 | **Not started** — O2 |

> **2026-07-17 — loaded up.** The live game now draws its map from the VALIDATED
> BaseGeo authority (real precise lat/lon), not the old placeholder CSV. Data
> repaired at source: the **Excel sheet** (`Bases lat lon.xlsx`) and the **Data
> Sheet** (`bases.csv`) both carry the D1–D4 fixes. The **`Bases lat lon.csv`
> artifact is NOT yet written — the file is locked** (open in Excel); until it is
> freed the game boots on the embedded fallback (same 17 correct bases), logging
> the 23-defect rejection to the console. Close the file and I write the clean CSV.
> See §8.

New config lives in `core/config.js` → `GEO`. Per §7 nothing is hardcoded; per §11
every value that is Andrew's is `null`, not defaulted (`tierBands`,
`timeCompressionS`, `pitFloorSec`, `pitEntryCode`). A `null` means the dependent
feature stays inert — it does not mean "pick something sensible later".

**The live game is untouched.** The new modules load but nothing consumes them yet;
Pitstop still renders from `Bases_Coordinates_PLACEHOLDER.csv` exactly as before.
Nothing was patched in any CSV (§11).

### Verification
The modules were exercised against the real CSVs and against a repaired *scratchpad*
fixture (not the project file). Against the repaired fixture the load reproduces
§2.4 exactly: **17 bases**, lat `42.8845…43.2532`, lon `-79.5477…-78.9394`,
furthest pair **Grimsby ↔ Fort Erie = 55.2 km**. All four §6 sample laps reproduce
to the decimal (15.3 / 23.2 / 35.0 / 50.5 km), which confirms the haversine here
matches the spec author's. Projection is isotropic to <2% and north is up. Each of
C1–C6 was made to fire on a purpose-built fixture, and a hand-edited
`TotalDistance` / `NodeXY` column in a course row is provably ignored (§4.2).

---

## 2. Andrew's rulings — 2026-07-16

### F1 — RESOLVED: a fourth data defect (D4), three V4 name-join failures

The spec lists D1–D3. There is a **D4**: three rows fail V4 because `base_name`
does not match the Data Sheet. **Andrew's ruling: `Ontario St`, `King St`,
`Merrittville`.**

| `bse_code` | `BaseGeo` today | Data Sheet today | **Ruling** |
|---|---|---|---|
| 72101 | `Ontario` | `Ontario St` | **`Ontario St`** — BaseGeo changes |
| 72108 | `King` | `King St` | **`King St`** — BaseGeo changes |
| 72118 | `Merritville` | `Merittville` | **`Merrittville`** — ⚠ **both change** |

⚠ **72118 is the one that bites.** Neither file had it right: the real road in
Thorold is *Merrittville* (two `t`s, two `t`s). So this rename must land in **both**
the Excel sheet *and* the Data Sheet (`datasets/bases.csv` → `Merrittville Base`).
Repairing only one side leaves V4 failing from the other direction — verified: a
half-repair fixture is still rejected, with exactly that error.

Not patched here — repaired at source per §11. See §4 for the exact list.

### F2 — RESOLVED: §2.4's median anchor corrected to 21.3 km

Andrew: *"do what you think is correct."* Recorded: **the correct 17-base median is
21.3 km**; the spec's 21.1 is computed over all 18 rows **including 72122** — the
exact row §2.4's own base count excludes. Since §2.4 says *"if a load produces
materially different figures, the data is wrong,"* the published anchor would have
condemned a **correct** dataset.

| Base set | Median |
|---|---|
| 18 rows, 72122 **included** | 21.11 km ← the spec's figure |
| 17 rows, 72122 excluded (correct) | **21.32 km** |

Count, bounds and furthest pair are unaffected: 72122 sits exactly on 72115, an
interior point, never an extreme — only the all-pairs median moves. Nothing
hardcodes either number; `stats()` computes it.

### F3 — RESOLVED: the pit is **72123 / Fleet**, and spec L4 is factually wrong

Andrew: *"it is 72123. 2122 is Westwood, same location, but different base
technically speaking."* This confirms the pre-existing `PIT_BASE_ID = '72123'` and
the note beside it. `GEO.pitEntryCode` now **aliases** `PIT_BASE_ID` rather than
copying the code — two config keys independently holding the same base code is the
second-source-of-truth problem §2.1 warns about.

⚠ **This invalidates spec L4 and the stated reason for D2/V6 — but not the rule.**

- **L4 ("72122 is a code, not a place") is false.** 72122 is Westwood, a real base.
- **D2's diagnosis is false.** The spec reads 72122's coordinates matching 72115
  byte-for-byte as a copy-paste error asserting *"a false geographic fact."* It is
  the opposite: Westwood, Fleet (72123) **and** Glendale (72115) all sit at
  2 Westwood Ct. The identical coordinates are a **physical fact**.
- **The rule survives on different grounds.** 72122 stays out of `BaseGeo` because
  BaseGeo is the raceable **node set**, and a node sitting exactly on Glendale
  cannot be a distinct course node — the leg between them is 0 km and they render
  as one dot. Excluded for **geometry**, not because it isn't real. Recorded in
  `config.js GEO.excludedCode`.

⚠ **Landmine for later.** V3 (no two bases at identical coordinates) treats
co-location as an error. Glendale / Westwood / Fleet genuinely **are** co-located,
so if Fleet or Westwood ever get coordinates in the Excel sheet, V3 will reject the
**entire dataset** — with a message calling a true fact a defect. Fine today
(neither is in the file). If the roster ever needs co-located bases, V3 is the rule
to revisit, and C5's `minLegDistanceKm` is the better guard.

### F4 — §0.9 / O8 — ANSWERED (Andrew: *"not sure on your question"*)

Explained in full in §6 below, with a recommendation. Short version: the gate
targets an **attack model** this spec doesn't use, and the destination is already
pre-blessed — but there is a **real conflict on `N`** (the Overview roster says
3 hits per tire, the spec argues 4) that needs your call.

Still open and untouched: **O1** (does the blowout hit also cost `d`?), **O2**
(target round length → `S`), **O3** (`SWAP` command — §9.1), **O4** (tire
identifiers), **O6** (tier bands), **O7** (3-tires-blown crawl).

---

## 3. Findings recorded, no decision needed

### F5 — `minLegDistanceKm` set to 1.5 km by Code

Not in §8 and not in §11's forbidden list, and §4.3 calls it a rendering concern
("two nodes render on top of each other"), so I set it — as a **render-legibility
floor deliberately chosen to reject nothing in the current roster**. The closest
real pair is **King (72108) ↔ Prince Charles (72125) at 1.79 km**, so 1.5 catches
genuine coincidence only and changes no course's legality today.

⚠ Flagging the consequence: at 1.79 km on a ~55 km map those two nodes land about
**2.7 viewBox units apart** — visually near-touching. If you want near-neighbours
excluded on *gameplay* grounds rather than *drawing* grounds, raise it; that is a
design call and yours.

### F6 — The existing `courses.csv` is a pre-spec artifact  ·  relates to O5

`datasets/courses.csv` is authored against the old schema
(`CourseId,Name,Type,Laps,Bases`, `Type=loop`, sequences that do not close). The
§4.1 entity expects `CourseID,CourseName,Sequence,Laps,Closure` with `Closure ∈
{Circuit, PointToPoint}` and C2 requiring a Circuit to close on itself. Both
existing courses would be **rejected** by C2 as written. Left alone — O5 says you
are authoring courses separately. The new module reads none of them yet.

### F7 — The L3-superseded pit-spur logic is still live  ·  audit record (§9.3)

`core/data.js` `buildRoute()` still computes `pitJunction` / `pitSpurCost` from
`approx_dist_to_westwood_km` — i.e. *"pit-spur cost derives from geography"*, the
item L3/L4/L5 explicitly retire. It is dead weight now and should be removed when
the render switches over. Not touched yet, because it is still wired into the
running placeholder path. Recording it so it is **superseded, not silently
dropped** (§9.3).

### F8 — 5 Data Sheet bases have no coordinates

`BaseGeo` carries 17 bases; the Data Sheet carries 22. **72120 (HQ), 72121 (Fitch
St), 72123 (Fleet), 72124 (Fallsview)** have no lat/lon, plus 72122 which is
deleted by design. V4 is one-directional (BaseGeo ⊆ Data Sheet), so this is legal —
but those bases can never be course nodes. If any of them should be raceable, they
need coordinates in the Excel sheet.

---

## 4. The Excel repair list

Everything below is repaired **at source in Excel**, then re-exported (§11).
Nothing here is patched in the CSV.

**`Bases lat lon.csv` (from the Excel sheet) — 17 rows out, 72122 deleted:**

| # | Change |
|---|---|
| D1 | **Negate the longitude on all 17 rows except 72100.** Only 72100 is correct today; the rest resolve to Kazakhstan. |
| D2 | **Delete the 72122 (Westwood) row.** See F3 — right call, wrong reason in the spec. |
| D3 | **Trim the trailing space** from `Linwell `. |
| D4 | 72101 `Ontario` → **`Ontario St`** · 72108 `King` → **`King St`** · 72118 `Merritville` → **`Merrittville`** |

**`bases.csv` (the Data Sheet) — one change:**

| # | Change |
|---|---|
| D4 | `Merittville Base` → **`Merrittville Base`** (72118). Without this the join still fails — from the other side. |

### How to check your export

Serve Pitstop (`Start Dev Server.bat` — the CSV fetch needs `http://`), open the
browser console, and paste:

```js
PITSTOP_BASEGEO.loadBaseGeo().then(r =>
  r.ok ? console.log('CLEAN —', r.stats.count, 'bases', r.stats)
       : (console.warn(r.errors.length + ' problem(s):'), r.errors.forEach(e => console.warn('  ' + e))));
```

It prints the remaining repair list line by line, with the CSV line number on each.
A clean load reports **17 bases**, lat `42.8845…43.2532`, lon `-79.5477…-78.9394`,
furthest pair **Grimsby ↔ Fort Erie 55.2 km**, median **21.3 km** (not the spec's
21.1 — see F2). Today it prints **23 problems**, which is the validator working.

---

## 5. Still needed from you

1. **The Excel repair above.** Nothing downstream loads until then — that is the
   validator working as specified, not a bug.
2. **`N` — 3 hits per tire or 4?** See §6. This is a genuine conflict between the
   pre-blessed Overview roster and the spec, and it is the only thing in §5 that
   needs you before the tire system can be built.
3. **Confirm my §0.9 read** in §6 — that the gate does not reach §5 as specced.
   I am not self-clearing it (§0.1).

---

## 6. O8 explained — does the §0.9 gate block the tire system?

**What §0.9 is.** It is the **Impact Zone** law — the same gate that held Aquanaut.
Core Law 5 says the machinery that *reaches* a consequence (movement → evaluation →
escalation → damage) must be written down in the cartridge's §0.21 Context Packet
and authorized by you **before** Code builds it. The document that would clear it
for Pitstop already exists: **`Pitstop_Overview_Clause_PROPOSAL.md`**, still
**DRAFT — awaiting your authorization + ratification with Claude Chat**. That is
the gate the spec's §0.1 is pointing at.

**What the gate actually blocks — and why I think §5 slips past it.**

That proposal is explicit that the *destination* is already blessed: Overview v2.0's
Impact Zone roster carries a NEMS 500 row —
*"4 tires (grouped, 3 hits each) | Cumulative | terminal — all 4 blown → game
over."* In its own words: *"the destination (tire damage → game over) is
pre-blessed. What is not yet authorized is the **attack model that reaches it**"* —
the veer → wall → collision machinery, the deadzone, the escalation ladder.

**The new spec has no attack model.** L6 makes tire damage *"the player enters the
wrong command"* — a direct Miss → Resource mapping. No veer, no wall, no collision,
no lateral drift. That is §0.8 Miss resolution (already law) feeding a §0.22
Resource with a §0.19 terminal threshold — precisely the shape Aquanaut's dive-bell
hull already uses, which the spec itself notes at §9.4. The veer/collision proposal
and this spec are **two different designs for the same destination**, and this one
routes around the machinery §0.9 gates.

**My read: the gate does not reach §5 as specced.** But per §0.1 I am not
self-clearing it — I need you to confirm. If you'd rather ratify the Overview
clause first and build §5 under it, that also works; it just isn't required by
anything I can find in the text.

### ⚠ The real blocker isn't the gate — it's `N`

**The pre-blessed roster says 3 hits per tire. The spec argues for 4.** Those
contradict, and the roster is the thing already in the Overview.

- **Spec §5.3** calls `N = 4` a **fairness floor, not a preference**. With uniform
  random tire assignment the chance of a blowout at the earliest possible moment is
  `4^(1−N)`: **N=3 → 6.25%**, **N=4 → 1.6%**. At N=3, one player in sixteen blows a
  tire on their third mistake and it reads as the game cheating.
- **The arithmetic works either way** — the §5.1 constraint is `(N−1)×d + B = 50`
  so that four dead tires = −200 = 0 kph:
  - `N=4`: `3d + B = 50` → the spec's proposal `d=5, B=35`.
  - `N=3`: `2d + B = 50` → e.g. `d=5, B=40`.

**Three ways out, your call:**

1. **Amend the roster row to 4 hits.** Laws permit *append or clarify when
   instructed*. Takes the spec's fairness argument; costs one Overview edit.
2. **Keep 3 and accept the 6.25%.** Cheapest; the roster stands as written.
3. **Keep 3 and weight damage toward the healthiest tire.** Removes the early
   blowout without touching the roster — but §5.3 warns this trades drama for
   predictability, and it would undercut §5.2's linear `d` (which the spec says is
   *only* sufficient **because** assignment is random). A design change, not a knob.

I'd take **(1)**: the fairness argument is sound, the roster edit is small, and the
random-assignment/linear-damage pairing stays intact.

---

## 8. Loading it up — what changed in the live game (2026-07-17)

Andrew: *"Go ahead and load it all up."* Done. The base-coordinate source switched
from the placeholder to the validated BaseGeo pipeline.

**Data repaired at source (not patched blindly):**
- `Bases lat lon.xlsx` — the source of truth — D1–D4 applied via openpyxl (17 rows,
  72122 deleted, signs fixed, names corrected). Backed up first.
- `bases.csv` (Data Sheet) — `Merittville Base` → `Merrittville Base`.
- `Bases lat lon.csv` — **pending**: the file is locked (open in Excel). The
  repaired content is ready; it writes the moment the lock clears. The Excel sheet
  and CSV will then match, so a re-export cannot reintroduce the defects.

**Code:**
- `core/data.js` — the loader now pulls bases from `PITSTOP_BASEGEO.loadBaseGeo()`
  (validation runs in-game). A rejected dataset or a fetch failure both fall back
  to an embedded copy of the 17 repaired bases, so the game always boots; a
  rejection is logged loudly (defect list) rather than limping silently.
- **Pit as furniture (L5):** `injectPitFurniture()` adds Fleet (72123) at
  Glendale's (72115) position — they physically share 2 Westwood Ct — so the pit
  renders without being a BaseGeo node. It is filtered out of random courses.
- `config.js` — added `PIT_ANCHOR_ID = '72115'`; `GEO.pitEntryCode` aliases
  `PIT_BASE_ID`; the L4-based rationale comments corrected to Andrew's facts.

**Verified:** the full loader was exercised in Node (happy path, rejection
fallback, file:// fallback, pit co-location, random-excludes-pit) and **in the
browser** — the Pre-Race Grid draws the real Niagara layout (Linwell start/finish;
Ontario St / Thorold / Niagara Falls / St Paul stops; Fleet ⛽ PIT on its split-off
lane). Because the CSV is still locked, that live run is going through the
fallback path — which is itself the correct data, and proves the validator + the
fallback + the render all work together.

---

## 7. Why step 4 (schematic render) *was* held (now resolved — see §8)

It is unblocked in principle, but it has nothing to draw: the current CSV **fails
validation on 23 counts** (D1 ×17, D3, D4 ×3, D2/V6, V3), so `BaseGeo` yields zero
bases by design — there is no partial load. Switching the live map onto `BaseGeo`
today would take the cartridge from "runs fine on placeholder data" to "will not
boot", and the only way to un-break it would be to patch the CSV, which §11
forbids. So the placeholder path stays live and untouched until the repaired export
lands, at which point the render switches over and F7's dead code comes out with it.

Run the validator against a fresh export and it will print the exact remaining
repair list, line by line.

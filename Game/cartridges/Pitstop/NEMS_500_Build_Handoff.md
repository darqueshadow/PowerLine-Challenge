# NEMS 500 — Build Handoff Spec (Rough-In Pass)

**From:** Claude Chat (Senior Developer)
**To:** Claude Code (Systems Integrator)
**Authority order:** Laws > Overview > Build Procedure. This document is a spec and is subordinate to all three.
**Status:** Brainstorm → first scaffold. **Plan-first.** Scaffold Phase 0 only; do not build gated mechanics until the Overview clause lands (see §0).

---

## 0. Read-Me-First: Governance Gate

NEMS 500 is **not a pure theme.** It introduces mechanics that exceed Theme scope and diverge from the core engine:

- **Non-falling movement** — the unit traverses a regional route; it does not fall to a lower boundary. Conflicts with core movement/lifecycle (Laws 0.4, 0.9).
- **Multi-command-per-leg** — a leg requires a *sequence* (AP → ENP → BSE), not a single command that clears one Target (Laws 0.6, 0.7).
- **Tire / pit / fuel system** — a consequence layer with no equivalent in the base engine.

Per Laws 0.3, a Theme may not alter movement, lifecycle, scoring, or "any other core system." These mechanics therefore require authorization **before** implementation.

**Prerequisite:** An Overview clause authorizing (i) abstract/config-driven movement, (ii) multi-step challenge sequences, and (iii) the tire/pit/fuel consequence layer must be drafted by Andrew + Claude Chat before any Phase 1+ work. This is the **same shared state machine** The Aquanaut needs — solve once, config-driven, engine-level, theme-agnostic.

**Claude Code instructions:**
1. Plan first. Report current cartridge state before writing.
2. Build **Phase 0 (shell/scaffold) only.** It contains no Law conflict.
3. **Stop** before Phase 1 mechanics. Surface the plan and wait for the Overview clause.
4. This is a **new cartridge:** duplicate the Empty Cartridge per Laws. Do not modify the Empty Cartridge. Keep `/core` theme-agnostic. Theme only through injection points. You own exact file structure.

---

## 1. Concept

Top-down regional race. The player posts their assigned unit base-to-base around the Niagara Region using real PowerLine commands. Each leg is a three-beat post sequence (AP → ENP → BSE), position-gated along the route. Correct, fast typing acts as the throttle (impulse model). The **region map is the play surface**; a side **flyby window** shows POV scenery for the current leg — reward, atmosphere, and stealth geography training. An optional tire/pit/fuel layer adds Pitstop-style strategy: Westwood (72122) is the canonical pit, reached via the on-route base nearest to it. Race N laps; finish 1st.

---

## 2. Build Phases — what to rough in now vs. later

| Phase | Scope | Gate |
|---|---|---|
| **0 — Shell / Scaffold** | All screens, navigation, HUD layout, placeholder data/state, mode compliance | **Build now.** No Law conflict. |
| **1 — Core Leg Loop** | Single leg A→B: AP/ENP/BSE position-gated, impulse movement, command input + validation vs. sample data | Gated. **Prove this first** (Andrew's core principle). |
| **2 — Race Structure** | Multi-leg routes, laps, timer, opponents, placing, podium results | Gated. |
| **3 — Pit / Tire / Fuel (Advanced)** | Tire damage, pit junction logic, SWAP, fuel burn | Gated. Keep **strippable** via the No-Pit toggle — pits are an advanced layer, not core. |

---

## 3. Screens & Flow (Phase 0 scaffold)

Wire navigation and placeholder layout for each. No final art; placeholders only.

| Screen | Rough-in contents |
|---|---|
| **Boot / Load** | Animated loader; asset-load progress hook (stubbed) |
| **Title** | Game title, "Press Start," version stamp |
| **Main Menu** | Entry into NEMS 500 options; **Return to Arcade** option (back to hub) |
| **Instructions** *(was missing — required)* | How-to-play + PowerLine command reference (AP, ENP, BSE, LA, SWAP) |
| **Race Options** | See §4 |
| **Pre-Race Grid** | Course preview on map + 3-2-1-GO countdown |
| **Gameplay** | See §5 |
| **Pause** *(was missing)* | Resume / Restart / Quit to Menu overlay |
| **End / Podium** | 1st-2nd-3rd podium + results table (lap times, penalties, tire/fuel summary) |

Mode compliance: boot in **Demo Mode** (Holodeck disabled). Do not block the Developer-Mode hook (Ctrl+Shift+B) at the shell level.

---

## 4. Race Options

| Option | Values | Notes |
|---|---|---|
| Course type | Complete loop / Point-to-point (diff start & finish) | Andrew |
| Course select | Pick a course **or** Random (choose number of bases) | Andrew |
| Number of laps | Integer | Andrew |
| Car type | Selectable | Andrew. Stats config-driven (§6) |
| Time of day | Night / Day | Andrew. Affects lighting only |
| Race type | Computer (AI/ghost) / Other players | **See scope flag below** |
| **Pit / No-Pit** *(added)* | On / Off | Andrew's "no-pit races." No-Pit disables Phase 3 entirely |
| **Difficulty** *(added)* | Easy / Med / Hard | Tire-wear rate + opponent skill |
| **Opponents** *(added)* | Count | Only when Race type ≠ solo time-trial |

**Scope flag (Andrew to decide):** "Other players" implies real multiplayer netplay — a large, separate build. Spec assumes **AI/ghost opponents first**, true head-to-head **deferred**. Confirm.

---

## 5. Gameplay Screen / HUD

| Element | Notes |
|---|---|
| **Region map** | Bases plotted; main roadways between bases drawn. Selected course path highlighted. This is the play surface. |
| **Flyby / POV window** | Side panel showing current-leg scenery (placeholder until assets land). Also shows the pit-stop scene when pitting. |
| **Command Box** *(added — critical)* | Blue input field where the player types. The core interaction surface. |
| **Challenge prompt** *(added — critical)* | Plain-language challenge for the active gate (e.g., "Assign 2101 to Ontario St"). |
| **Active-command indicator** *(added)* | Which command is live now: AP / ENP / BSE, gated by track position. |
| **Tire damage** | 4 tires; damage applied to a **random** tire on mis-enter (Andrew). |
| **Fuel level** | Depletes over distance; pitable (Phase 3). |
| **Speed / throttle gauge** *(added)* | Reads current unit speed; impulse model needs a visible readout. |
| **Lap counter** *(added)* | Current lap / total. |
| **Timer** | Elapsed + (optional) best-lap. |
| **Place in race** | Current standing. |
| **Pit indicator** *(added)* | Pit junction marked on map; "pit available / approaching" state. |
| **Opponent markers** *(added)* | Other racers' positions on the map. |

**Movement model (Phase 1, for context only — do not implement until gated):** impulse / throttle-tap. Each correct command = an acceleration burst; the unit coasts and drags between gates (the coast is the natural pause). Mis-enter on *content* = sputter (momentum loss). Submit of a *position-gated* command before arrival = harmless no-op, not a penalty.

---

## 6. Data & Config to Scaffold (placeholders now; Andrew provides real values later)

Stub the loaders and structures so real data drops in cleanly. Keep all tunables **config-driven**, not hard-coded.

- **Base record:** `id` (721XX), `name`, map `coords (x,y)`, `distanceToWestwood`, leg-scenery ref.
- **Route record:** ordered base list, `loop | point-to-point`, **derived** `pitJunction` (on-route base nearest Westwood) and **derived** pit-spur cost.
- **Car config:** speed/handling/tire-durability/fuel-capacity stats per car type.
- **Tunables config (named keys, values TBD):** impulse boost strength, coast/drag rate, gate spacing, tire-damage threshold, pit time cost, fuel burn rate.
- **Region map coordinate system:** placeholder base positions until the real map asset arrives.

Pit logic note: with `distanceToWestwood` per base, both the pit junction and its cost compute automatically per route. A new route is just a base list — no per-route hand-authoring.

---

## 7. Provided Later / Deferred (do not block on these)

Datasets (bases, units, PowerLine commands) · scenery images or descriptions per leg · music · SFX · final region map art · real-multiplayer networking.

Stub: audio hooks, scenery slots in the flyby window, the data loader (reads sample data), and the command validator (validates against sample command set).

---

## 8. Open Decisions for Andrew (flag — do not assume)

1. **Opponents:** AI/ghost first with real multiplayer later — confirm?
2. **Scoring:** time + place only, or also a points score?
3. **`LA` role:** confirmed as the pit on/off-ramp command (peel to Westwood, SWAP, rejoin)?
4. **Far-western pit:** leave the long spur raw (expert risk) or grant a mercy (capped spur / slow limp)?
5. **Difficulty vs. Pit toggle:** keep both, or fold pit on/off into difficulty tiers?

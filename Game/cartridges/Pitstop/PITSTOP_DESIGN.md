# PITSTOP (NEMS 500) — Design & Build Log

**Cartridge:** Pitstop · **Canonical slot:** Head-to-Head → NEMS 500 · **Phase:** 0 (Shell/Scaffold) · **v0.1.0**
**Authority order:** Laws v1.6 > Overview v1.6 > Build Procedure v1.6 > this doc > the build handoff.
Source spec: `NEMS_500_Build_Handoff.md`. Governance docs live in `(PCL)/Documents/Core Documents/`.

---

## Concept

Top-down regional race. The player posts an assigned unit base-to-base around the Niagara Region using real PowerLine commands. Each leg is a three-beat sequence **AP → ENP → BSE**, position-gated along the route. Fast, correct typing = throttle (impulse model). The region map is the play surface; a flyby/POV window shows leg scenery. Optional tire/pit/fuel strategy layer; Westwood (72122) is the canonical pit. Race N laps, finish 1st.

## Decisions locked (2026-06-20)

1. **Name → "Pitstop"** (renaming the Overview's "NEMS 500" Head-to-Head slot). Requires an Overview append/clarify — drafted in `Pitstop_Name_Clause_PROPOSAL.md`, **pending Andrew's approval**. "NEMS 500" retained as event/codename.
2. **Structure → modular** `files/{index.html, style.css, script.js, core/{config,data,audio}.js, datasets/}` — satisfies the modular-development Law + Build Procedure §2/§3 and matches Asteroid Command / The Aquanaut. (A shared global `/core` engine was considered and deferred — it's a large refactor and itself aspirational.)

## Governance gate (why we stop after Phase 0)

NEMS 500's mechanics exceed Theme scope (Law §0.3) and conflict with the engine: **non-falling movement** (vs §0.4/§0.9 fall-to-boundary lifecycle), **multi-command-per-leg** (vs the Overview's single-shot `generateChallenge()`), and the **tire/pit/fuel** consequence layer (no engine equivalent). Per the precedent set by The Aquanaut's Impact Clause, these are *cartridge-layer logic* requiring **explicit Andrew authorization or an Overview append/clarify clause** before they may be built.

- **Phase 0 (this build) — authorized, no Law conflict.**
- **Phase 1+ — BLOCKED** pending the Overview clause.

## Phase 0 — what was built (shell only)

- **Files:** `files/index.html`, `style.css`, `script.js`, `core/config.js`, `core/data.js`, `core/audio.js`, `datasets/{commands,bases,units}.csv`, plus `cartridge.json`.
- **Screens (handoff §3):** Boot/Load (animated loader + stubbed progress) → Title → Main Menu (+ Return to Arcade) → Instructions (AP/ENP/BSE/LA reference from CSV; SWAP marked TBD) → Race Options → Pre-Race Grid (course preview + countdown placeholder) → Gameplay HUD → Pause overlay → End/Podium. Centralized `showScreen()` router.
- **Mode compliance:** boots in **Demo Mode** (`CONFIG.isHolodeck=false`); **Ctrl+Shift+B** Developer Mode hook with timed password prompt (`PIT LANE`) → unlocks a screen-jump dev panel + watermark (internal testing per Law §0.15). All other key handling ignores modifier combos so the hook is never swallowed. Holodeck deferred to Publish Mode.
- **Gameplay HUD (handoff §5):** region-map play surface (placeholder SVG: 21 real bases at placeholder coords + sample route + unit/opponent markers), flyby/POV window, blue Command Box (disabled), challenge prompt, active-command (AP/ENP/BSE) indicator, 4-tire/fuel/speed/lap/timer/place/pit/opponent placeholders.
- **Race Options (handoff §4):** all options rendered config-driven from `RACE_OPTIONS.schema`; selecting only writes to `state.raceOptions`. "Players" marked DEFERRED.
- **Data scaffolding (handoff §6/§7):** BOM-aware CSV loader (fetch + embedded fallback); Base record `{id,name,coords,distanceToWestwood,scenery}` with derived `distanceToWestwood`; Route record with derived `pitJunction`/`pitSpurCost`; placeholder tunables (named keys) and car configs. `generateChallenge()`/`validateCommand()` present as **gated stubs that throw** — never called.

## Explicitly NOT built (gated / out of scope)

Leg loop, impulse movement, command validation wired to play, laps/timer logic, opponents/AI, scoring/penalties, podium results, and the entire pit/tire/fuel system. **Hub registration** is intentionally omitted (Core Law: "insert cartridges into the Arcade hub only when instructed") — a ~2-line edit to `core/submenu.js` (`loadCartridges()` entry + `handleStart()` branch → `cartridges/Pitstop/files/index.html`) when you give the go.

## Reused real data vs. net-new placeholders

- **Reused:** 21 Niagara bases (721XX; Westwood = 72122), unit roster (string ids incl. FIT/MHRT/CARE*), AP/ENP/BSE/LA command vocabulary.
- **Net-new (placeholder until authored):** the **SWAP** command (absent from all datasets), base map `coords`, `distanceToWestwood` (currently derived from placeholder coords), route topology, car visual/physics configs, all non-weight tunables, leg scenery refs.

## Changelog — gameplay refinements

**v0.7.0 (2026-07-12) — Pit lane at start/finish, course/position fixes, map-as-
challenge, speed/WPM model.** All directly requested by Andrew.
- **Pit lane now branches around the START/FINISH base** (Linwell on Niagara Loop),
  not the nearest base to Fleet. (`renderMap` junction = `course.startId`.)
- **Niagara Loop reordered to 02 01 03 00 16** (order from Thorold = 03 00 16 02);
  swapped NOTL/04 out for Niagara Falls/00. **St Paul (72116) placeholder coords
  bumped** (lat 43.111→43.15, lon −79.11→−79.085) so it renders ABOVE Niagara Falls
  (00), not to its left. (courses.csv, Bases_Coordinates_PLACEHOLDER.csv, data.js
  fallback — coord marked APPROX-ADJUSTED.)
- **Challenge box REMOVED — the minimap is now the challenge.** The base you're at /
  just left glows amber (`from`), the base you're driving to glows cyan (`next`,
  pulsing), other bases are dim green; a `#mapTarget` caption reads "▸ <name> · <code>"
  so you know what to type. The unit marker is now white (was blue, clashed with the
  cyan next). Minimap enlarged (44%→52%). The old centered command box stays; a slim
  `#challengePrompt` status line now carries only transient cues (shift, BSEH hint).
  The "Active" strip shows Unit + AP/ENP/BSE.
- **Speed / WPM model (replaces the impulse model).** Gauge reads 0–50–100, driven by
  typing WPM. Base 25; a correct command boosts (+25 at optimal WPM, scaled down for
  slow typing), HOLDS ~1.2s, then decays gently (more allowance than before). Boosts
  stack 25→50→75→100; past 100 the value OVERFLOWS (buffer to 150) — the bar pins at
  100 but the hold extends (1.2→2.7s) so you stay at top speed longer. Config in
  `config.js SPEED`; WPM measured from keystroke timing on the command input; 0-50-100
  bar + WPM readout in the side gauges. Verified: 25→50→75→100→125(1.95s)→150(2.70s).
  ⚠ FIRST PASS — numbers are made up (Andrew's own examples were too) and his spec cut
  off at "…if I get enough"; the overflow payoff is inferred. Needs hands-on tuning.

**v0.6.0 (2026-07-12) — Full-course multi-leg race + laps (Slice 2), game-screen
layout rework, keyboard menus.** All three directly requested by Andrew.
- **THE BIG FIX — the race now drives the WHOLE course.** Before, the build was a
  single-leg slice: it drove `base[0] → base[1]` and then declared the race
  finished — so on Niagara Loop (start 02) reaching 01 ended it. Now `startRace()`
  builds a per-lap `stops` list (a LOOP re-appends the start so the last leg drives
  back to Start/Finish), and `legComplete()` advances leg → leg, then lap → lap,
  only calling `raceFinish()` after the final lap → Results screen. HUD shows real
  `Lap L/T` + `Leg n/N` and a cumulative race clock. Verified: 15 legs across 3
  laps (02→01→03→16→04→02 ×3) then finish. (`script.js`.)
- **Niagara Loop course added** (`courses.csv` had only Niagara Central 5): 
  `niagara-loop, loop, 3 laps, 72102|72101|72103|72116|72104` (02 start, then
  01 03 16 04). Set as `DEFAULT_COURSE_ID`; also in the data.js embedded fallback.
- **Game-screen layout reworked (Andrew's #1).** Challenge line is now a centered
  callout in the **top third** (`top:33%`) over the road; the **command box is
  centered and much bigger** (24px, min 560px). The old bottom bar is gone (grid is
  now `44px 1fr`). Both live in a `.play-overlay` on the road view. While the Shift
  Change board is open, a `.shift-active` class drops the command box to the bottom
  so the board (which fills the middle) doesn't cover it — the input stays live.
- **Keyboard-selectable menus (Andrew's #2).** Every screen auto-focuses its
  `data-primary` button on show; arrow keys move between buttons, Enter/Space
  activates (incl. PRESS START and the Pause overlay). Never hijacks a text field /
  `<select>` or the in-race command input. Audio now also unlocks on first keydown.
- Cache-bust: all `?v=` bumped 0.4.0 → 0.6.0; config version + visible stamps updated.

**v0.5.0 (2026-07-12) — Base-code rule + "Home Start/Stop" (BSEH) + pit lane.**
Both directly requested by Andrew.
- **Base code (base number) required only for AP and BSE.** `ENP` is now a plain
  radio call — `ENP <unit>` (no base code). Its beat is accepted with or without a
  trailing base number. (`buildLeg`/`validateBeat` in `core/data.js`.)
- **Arrival twist/cheat — BSEH ("Home Start/Stop").** On the arrival (BSE) beat
  *only*, typing `BSEH <unit>` posts the arrival with **no base code required**,
  just like the real world. Normal `BSE <unit> <code>` still needs the code. BSEH
  is rejected on the AP/ENP beats. Validator is now beat-aware (per-beat `unit`,
  `baseNum`, `requiresBaseCode`, and `homeCode:'BSEH'` on the BSE beat). The
  arrival prompt surfaces both forms; the command reference lists a BSEH row.
  (Consistent with the existing Shift-Change chain, which already uses `BSEH`.)
- **Fleet = pit LANE, not a dead-end spur.** The map/minimap now draws Fleet as a
  lane that *splits off the main course and rejoins* — a dashed cubic bypass whose
  midpoint passes through the Fleet ⛽ marker (control points at k=4/3 so the apex
  lands on Fleet). Branch/merge points sit on the route segments either side of the
  pit junction (nearest on-route base). (`renderMap` in `script.js`; legend text
  updated to "Pit lane — Fleet (splits & rejoins)".)
- Verified: 17/17 headless validator cases + live browser click-through
  (AP/ENP/BSE/BSEH hits & misses, leg completes on BSEH, pit-lane path renders
  through Fleet, no console errors).

## Open decisions for Andrew (handoff §8 — do not assume)

1. **Name clause** — approve `Pitstop_Name_Clause_PROPOSAL.md` (Form A rename vs Form B clarify-only)?
2. **Opponents** — AI/ghost first, real multiplayer later (confirm)?
3. **Scoring** — time + place only, or also a points score?
4. **`LA` role** — confirmed as the pit on/off-ramp command (peel to Westwood, SWAP, rejoin)?
5. **Far-western pit** — leave the long spur raw (expert risk) or grant a mercy (capped spur / slow limp)?
6. **Difficulty vs. Pit toggle** — keep both, or fold pit on/off into difficulty tiers?
7. **The Overview clause itself** — Phase 1 cannot start until the clause authorizing (i) config-driven movement, (ii) multi-step challenge sequences, and (iii) the tire/pit/fuel layer is drafted with Andrew + Claude Chat.

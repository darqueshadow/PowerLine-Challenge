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

> ⚠ **This is a Phase-0 snapshot — the changelog below supersedes it.** Much of the
> list has since been authorized and built (leg loop, laps/timer, podium results,
> opponent cars, tire *damage*). Read the changelog for what's actually live; what
> remains gated today is the **tire/pit/fuel consequence layer** (the speed governor
> + pit repair loop) and the veer→collision model in `Pitstop_Design_Note.md` §10.

Leg loop, impulse movement, command validation wired to play, laps/timer logic, opponents/AI, scoring/penalties, podium results, and the entire pit/tire/fuel system. **Hub registration** is intentionally omitted (Core Law: "insert cartridges into the Arcade hub only when instructed") — a ~2-line edit to `core/submenu.js` (`loadCartridges()` entry + `handleStart()` branch → `cartridges/Pitstop/files/index.html`) when you give the go.

## Reused real data vs. net-new placeholders

- **Reused:** 21 Niagara bases (721XX; Westwood = 72122), unit roster (string ids incl. FIT/MHRT/CARE*), AP/ENP/BSE/LA command vocabulary.
- **Net-new (placeholder until authored):** the **SWAP** command (absent from all datasets), base map `coords`, `distanceToWestwood` (currently derived from placeholder coords), route topology, car visual/physics configs, all non-weight tunables, leg scenery refs.

## Changelog — gameplay refinements

**v0.9.6 (2026-07-16) — Real km/h + roll-to-stop, opponent cars, damage on a miss, brake light.**
All four directly requested by Andrew.
- **The gauge is now REAL KM/H and the car rolls to a stop.** Top speed **200**
  (was a unitless 100); the whole `SPEED` block rescaled with it (boost 25→**50**,
  decay 12→**24**, overflow buffer 150→**250**, side bar relabelled 0-**100**-**200**).
  The **idle floor is gone** (`base: 25` → **0**) — typing is the only throttle, so
  stop typing and the car genuinely coasts to a dead stop. Below **25 km/h**
  (`rollThreshold`) the burn-off eases from 24 to **8 km/h/s** (`rollDecay`) so the
  last stretch is a long roll, not a hard stop. Measured: **200→0 in 10.4s**, of
  which the final 25 km/h alone takes **3.1s** (vs ~1s at the fast rate).
  `applyRoadSpeed()` also freezes the scrolling layers outright at a stop
  (`.road-view.stopped`) — `--road-spd` can only ever *slow* an animation, never
  reach zero, so the world used to creep past a parked car.
  ⚠ **`base` is legitimately 0 now.** Every read goes through `spCfg(key, dflt)`
  (`!= null`, not `||`) — `SP.base || 25` would silently resurrect the idle floor.
- **Brake light + backspace is the brake pedal.** Two rear lamps on the car
  (`.car-brake`, kept alive in sprite-mode) light red while braking. Each Backspace
  re-arms the brake for `brakeHold` **0.3s** and scrubs at `brakeDecay` **90 km/h/s**,
  killing the boost hold; a correct command releases it. Not `preventDefault`'d —
  the key still deletes the character it was always deleting.
- **Opponent cars — you pass them or they pass you.** New `TRAFFIC` config +
  engine (`script.js`, "TRAFFIC" section). A field of **5** other roster trucks
  circulates around the player; each car's whole position is one number,
  `z` = metres ahead, and **dz/dt is just the speed difference** — so passing falls
  out of the existing speed model for free. Every car re-rolls its own pace on
  recycle, uniform across **125 ± 50** clamped to **[70, 175]**: the field averages
  **125** and **nothing ever exceeds 175** (verified: 6000 re-rolls → max 174.97,
  avg 124.7). Since the player tops out at 200, out-typing the field always beats
  it. Verified across the range: parked → 46 go by / you pass 0; at 90 → 10 go by;
  at the 125 field average → **5 passes vs 2 passed** (genuinely two-way); flat out
  at 200 → 23 passes, **never** passed. Cars are drawn rear-view only (correct in
  both directions) and `tfProject()` reproduces the CSS road trapezoid *including*
  the `--road-curve` skew, so they sit on the tarmac through a bend.
  A `#passFlash` callout reports each pass — deliberately **not** the radio bubble,
  which belongs to the Shift Change and must not get clobbered by traffic.
- **A wrong command now SHOWS damage** (Andrew: "the unit is not showing damage
  when there is a wrong input"). **Root cause: nothing ever decremented
  `tire_health`** — `renderTireGauges()` only ever ran once, at `startRace`, so the
  gauge sat on OK all race. Mistakes are now the wear **source** (`damageTires()`):
  every miss costs `TIRE.missDamage` **1**, and a miss taken wheel-to-wheel with a
  car you're passing (`|z| <= passZ` 12m) is a **BUMP** — `TIRE.bumpDamage` **2** on
  top, ×0.6 extra speed loss, the rival shoved off its line, and the whole view
  jolts. Damage reads on **three** channels now: the side gauge, the **rubber on the
  car itself** (`[data-tire]`, greys black→white per the config's stage table), and
  a flash on both.
  - Two related gauge fixes: the wear fill now tracks health **continuously**
    (`--wear`) instead of snapping only at stage boundaries — the first two misses
    of a race moved nothing before; and **WORN used to fall through to "OK"**, so
    the gauge claimed healthy rubber at half health. Full map now renders:
    OK → WORN → WARN → LOW → OUT.
- **Still gated** (`Pitstop_Design_Note.md` §10): the *consequence* of worn tires —
  the speed governor and the pit-stop repair loop. Damage accrues and SHOWS; nothing
  punishes it yet beyond the look.
- New `PITSTOP_DEBUG` hooks: `step(dt)` advances the sim by a **fixed dt with no
  rAF** (rAF is throttled to a dead stop in a background tab, which makes the speed
  curve otherwise unobservable/untunable headless), plus `setSpeed`, `tapBrake`,
  `pullAlongside(i)`, `bump`, `damageTires`, `traffic`.
- Cache-bust `?v=` 0.9.5 → 0.9.6; config version + stamps updated (stamps had
  drifted to 0.9.4).

**v0.9.4 (2026-07-15) — Gear-shifter box: next-gear shimmer + LA is grey-until-available.**
Directly requested by Andrew.
- **Next-gear shimmer** — the gear you should type next now gets a **cyan shimmer ring**
  (echoes the minimap's cyan "next base" cue), while the current status stays the solid
  green `.live`. `nextGearCode()` (`script.js`) picks it: normally the active beat; LA when
  a Shift Change is armed after ENP; BSE while the board is open. Rendered as a `.next`
  class toggled in `updateRaceHUD` (every frame). The shimmer rides a `::after`
  pseudo-element so it never fights the `.flash` wrong-command flicker (`.gear.flash::after`
  is hidden). Shimmer walks AP→ENP→BSE as each beat is cleared (AP shimmers at leg start).
- **LA is grey, not white** — LA left the "always white outline" idle look; it now sits
  **grey** (out of the normal AP→ENP→BSE rotation) and only lights up when it becomes
  available: it **shimmers** as the next gear when a Shift Change makes LA the required
  command, then glows **amber** (`.gear.la.live`) while the unit is actually in LA.
- Cache-bust `?v=` 0.9.3 → 0.9.4; config version + stamps updated.

**v0.9.3 (2026-07-15) — Curve-engine fix: the road surface now turns with its lines.**
Andrew: the car + red/white rumble lines were leaning into the bend but the grey road
surface stayed a straight trapezoid, so the edges detached from the tarmac.
- **Root cause:** the `--road-curve` skew was applied to `.rv-rumble` + `.rv-center` but
  NOT `.rv-road`. The tarmac and its rumble/centre lines are ONE trapezoid — they must
  share the skew or they separate.
- **Fix (`style.css`):** added `.rv-road` to the skew rule (same `transform-origin`), so
  the whole road assembly banks together. Skew + the `background-position` scroll don't
  conflict. Applies to BOTH looks (dark + OutRun). Cache-bust `?v=` 0.9.2 → 0.9.3.

**v0.9.2 (2026-07-15) — Selectable RACE LOOK: sunny "OutRun" road skin (design §1a).**
Implemented from Andrew's Claude Design file *"Pitstop Arcade.dc.html"* (§1a, re-imported
via the claude_design MCP). Adds the design's bright OutRun *exploration* as an **alternate,
non-destructive race look** — the dark green-phosphor CRT road stays the DEFAULT. Directly
scoped with Andrew (add-as-skin, generic sprite set).
- **New Race Option `Race Look` (`raceLook`: `dark` | `outrun`)** — `config.js`
  (`RACE_OPTIONS.defaults` + schema). Renders as a DARK/OUTRUN dropdown via the generic
  options path; default `dark`.
- **`applyRaceLook()` (`script.js`)** toggles `.look-outrun` on `#roadView` at game-screen
  show, reading `raceOptions.raceLook`. Purely a class flip.
- **OutRun skin (`style.css` · `.road-view.look-outrun`)** re-skins the road scene's PALETTE
  only: bright sky warming to a hazy horizon, **banded OutRun sun**, a Niagara **escarpment**
  silhouette on the horizon, alternating light/dark **grass + tarmac scanline bands** (new
  `ps-orsun`/`ps-orgrass`/`ps-orroad` keyframes), the passing sign restyled as an OutRun
  **billboard**, brightened flying scenery, and a **soft vignette** in place of the heavy CRT
  scanlines. The **curve engine** (`--road-curve`) and **speed reactivity** (`--road-spd`)
  are palette-independent, so road bending + car banking keep working under both looks.
- **Scope (this pass):** GENERIC OutRun sprite set — **per-municipality scenery swaps** (NOTL
  vineyards / St Catharines skyline / West Lincoln farmland) DEFERRED. The top HUD strip +
  side column stay dark under both looks (the skin is the road view).
- Cache-bust `?v=` 0.9.1 → 0.9.2; config version + visible stamps updated. Verified live in
  browser: DARK/OUTRUN dropdown → `raceLook` stored → `#roadView.look-outrun` toggles; both
  looks render; curve/car/HUD/side-column intact; no console errors.

**v0.9.1 (2026-07-14) — Gear-shifter box: status semantics + wrong-command flash.**
Directly requested by Andrew (correction to the v0.9.0 gear box).
- **The gear box now lights the CURRENT status = the last command entered
  CORRECTLY** (like the gear a car is in), not the pending/next beat. At the
  start of a leg **nothing is lit**; AP lights once AP posts correctly, ENP once
  en route, LA during a Shift Change, BSE on arrival. Only one gear at a time
  (`race.gear`, set on a validated `hit`; reset to `null` each leg).
- **Wrong-command cue:** entering the wrong next command (e.g. wrong unit on the
  AP beat, wrong unit/base on ENP) **flickers that gear red↔green 3× quickly**
  (`flashGear()` + `@keyframes gearFlash`). The command box still flashes red too;
  the lit status gear is unaffected by the flicker.
- Cache-bust `?v=` 0.9.0 → 0.9.1; config version + stamps updated. Verified
  end-to-end headless: start=none-lit, correct AP → AP lit only, wrong ENP →
  ENP flickers while AP stays lit.

**v0.9.0 (2026-07-14) — Arcade reskin (design "Pitstop Arcade.dc.html").**
Implemented from Andrew's Claude Design mock (project *Pitstop PLC fine tuning*,
imported via the claude_design MCP). **Theme layer only** — no gated gameplay
(the veer→collision→damage combat model in `Pitstop_Design_Note.md` stays gated
pending its Overview clause; opponents/pit-wear remain unwired).
- **Type:** added `Press Start 2P` (pixel) + `Share Tech Mono` (Google Fonts,
  Courier fallback). New `--font-pixel` / `--font-mono` vars; `--font` → mono.
- **Title (§01):** animated checkered flag bands, glowing pixel `PITSTOP`,
  `NEMS 500`, chevron backdrop, CRT scanlines — and the **locked tagline**
  *"Type fast and risk the wall. Type clean and bleed the speed."*
  (`Pitstop_Design_Note.md` §0, must-have).
- **Race HUD (§02) — the hero.** Retired the procedural **SVG** road for a
  **CSS perspective road**: sky/sun/clouds/green land, asphalt trapezoid,
  red-white rumble strips, dashed centre line, side chevrons, flying roadside
  scenery, a passing road sign (points at the next base), and a detailed CSS
  **car** (white body, blue + green trim, unit number, tinted per selected unit).
  Scroll speed reacts to `race.speed` via the `--road-spd` custom property
  (`updateRoad`). Dashboard is now pixel **HUD pods** (LAP green · TIME blue ·
  LEG amber · SPEED **KM/H** red-orange with WPM sublabel) + checkered accent +
  racing PAUSE. New left **gear-shifter box** — `AP / ENP / LA / BSE` light by
  unit status (LA glows during a Shift Change; BSE dark until it clears). Side
  column keeps the minimap-as-challenge + 0-50-100 speed bar + tire grid + fuel +
  pit indicator, restyled. Per-view CRT scanline/vignette overlay.
- **Finish (§04):** checkered banner, `FINISH!`, real stats line + result chips
  (legs from the race; place/penalties/pit-stops placeholder), podium with
  **YOU = 1st**, `↻ RACE AGAIN` / `MAIN MENU` wired.
- **Pit Stop (§03):** new **preview** screen (`#pitScreen`, reachable via the Dev
  screen-jump) — caution stripes, car-in-box with pulsing damaged tires + spark
  FX, PIT CLOCK, DAMAGE REPORT, `SWAP FL` box, "then LA to rejoin". **Not wired**
  into the live race (pit/tire/fuel consequence layer authorized separately).
- **Tire-damage (§05):** render-only. One integer `tire_health` (0–10) maps via
  `CFG.TIRE` → `deriveTire()` to the in-race tire grid (Fresh/Worn/Warning/
  Critical/Burst). No wear is computed or stored (gated); defaults fresh.
  `PITSTOP_DEBUG.setTire(0..10)` previews the stages.
- Cache-bust `?v=` 0.8.0 → 0.9.0; config version + visible stamps updated. All
  script-referenced ids preserved; the race loop / Shift Change engine untouched.

**v0.8.0 (2026-07-14) — Player-selectable Unit (replaces the Car option).**
Directly requested by Andrew.
- **You now PICK which unit you drive.** The old inert **Car** option
  (rookie/balanced/sprinter) is retired from Race Options and replaced by a **Unit**
  picker: 5 real roster units to start ("off the top of my head"). The chosen unit
  drives the race (`pickUnit()` now reads `state.raceOptions.unit`; it was hardcoded
  to `2101`). Config: `SELECTABLE_UNITS` in `config.js`.
- **Number-key hotkeys, balanced across the top row (Andrew's "divide the keyboard
  up" call).** Each unit maps to a top-row number key, spread **1 · 3 · 5 · 7 · 9**
  (not 1-2-3-4-5) so the reach is even. Press the key on Race Options (or click the
  chip) to select; hotkeys are ignored while typing in a field. The 5 ids
  (`2107 2138 2045 2396 2523`) also happen to exercise every digit 0-9 when typed,
  which matters since you type the unit constantly in-race.
- **Groundwork for "a different looking race car."** Each unit carries a placeholder
  `tint`; today it colours the picker chip's car swatch + the in-race map marker so
  units already look distinct. The real per-unit sprites drop in later
  (`SELECTABLE_UNITS[].tint → sprite`) — NOT built yet, per "when we get there."
- `CAR_TYPES` kept in `config.js` as a gated placeholder (a possible future
  stats axis) but no longer surfaced. Cache-bust `?v=` 0.7.1 → 0.8.0; stamps + config
  version updated.

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

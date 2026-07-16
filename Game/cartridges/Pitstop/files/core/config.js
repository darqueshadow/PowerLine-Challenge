/* ============================================================================
 * PITSTOP (NEMS 500) — core/config.js
 * PowerLine Challenge cartridge · Phase 0 Scaffold · v0.1.0
 * ----------------------------------------------------------------------------
 * THEME-AGNOSTIC CONFIG. Per Build Procedure §3.1: shared constants + tunables,
 * structured so the cartridge can override a safe subset.
 *
 * GOVERNANCE: This file holds CONFIG (mode flags), placeholder TUNABLES, CAR
 * configs, and RACE_OPTION definitions. It contains NO gameplay logic.
 *
 *   ⚠ PHASE GATE — Per the NEMS 500 build handoff §0 and the PLC Laws/Overview:
 *   the racing MECHANICS (non-falling movement, multi-beat AP→ENP→BSE legs,
 *   tire/pit/fuel) EXCEED Theme scope and are BLOCKED until an Overview append/
 *   clarify clause is authorized by Andrew. Every value below tagged
 *   [PHASE 1+ — GATED] is a placeholder that is NOT yet consumed by any logic.
 * ========================================================================= */

(function (global) {
  'use strict';

  /* ---- MODE COMPLIANCE (Laws "Modes" + §0.15 + Build Procedure §6/§10) ---- */
  const CONFIG = {
    // Boot default = DEMO MODE. Holodeck stays disabled until Publish Mode
    // (engaged only when Andrew explicitly instructs). Do not flip these here.
    isHolodeck: false,        // Holodeck/sandbox — disabled in Demo builds
    isBeta: false,            // Developer/Beta overlay — off by default

    // Developer Mode — Law §0.15: activated via Ctrl+Shift+B, timed password.
    devModePassword: 'PIT LANE',
    devModeTimeout: 10000,    // ms the password prompt stays live

    // Holodeck — reserved (Publish Mode only); hook present, UI deferred.
    holodeckPassword: 'GREEN FLAG',
    holodeckTimeout: 15000,

    version: '0.9.6',
    versionLabel: 'PHASE 1 · ARCADE RESKIN'
  };

  /* ---- TUNABLES — config-driven (handoff §6) -------------------------------
   * Phase 1 route-traversal impulse model is ACTIVE (authorized 2026-06-20).
   * Pit/tire/fuel keys remain placeholders until Phase 3. */
  const TUNABLES = {
    // Impulse / throttle model (active). pos runs 0→1 across a leg; vel is
    // pos-units per second.
    impulseBoost: 0.70,          // velocity added per correct beat (throttle tap)
    dragRate: 0.30,              // linear velocity decay /sec (coast + drag)
    idleCreep: 0.05,             // min forward crawl so a leg never fully stalls
    sputterFactor: 0.45,         // velocity multiplier on a content mis-enter
    // Position gates within a leg (0=base A, 1=base B): when each beat activates.
    gateAP: 0.0, gateENP: 0.5, gateBSE: 0.85,
    speedDisplayScale: 120,      // vel → HUD speed readout
    // Phase 3 (pit/tire/fuel) — still placeholders.
    tireDamageThreshold: 0,
    pitTimeCost: 0,
    fuelBurnRate: 0.0
  };

  /* ---- SPEED / WPM MODEL (Andrew, 2026-07-12 · rescaled to km/h 2026-07-16) --
   * The gauge reads REAL KM/H (0–100–200) and is DRIVEN by typing speed (WPM of
   * the command you're entering). A correct command "boosts" the gauge; it HOLDS
   * briefly, then runs down. Boosts stack toward the 200 km/h top end. At/above
   * 200 the hold lasts longer and the value can OVERFLOW past it (a buffer) so
   * you stay at top speed longer.
   *
   * ROLL-TO-STOP (Andrew, 2026-07-16): typing is the ONLY throttle, so there is
   * no idle floor any more — `base: 0`. Stop typing and the car coasts down and
   * genuinely stops. Below `rollThreshold` the burn-off eases to `rollDecay` so
   * the last stretch is a long roll rather than a hard stop.
   *   ⚠ base is legitimately 0 — read these with a `!= null` check, never
   *   `SP.base || 25`, or the old idle floor comes back from the dead.
   * Backspace is the BRAKE: it kills the hold and scrubs at `brakeDecay` for
   * `brakeHold` seconds per tap (see script.js tapBrake / updateSpeed).
   * These numbers are meant to be tuned by feel. */
  const SPEED = {
    base: 0,             // floor — the car rolls to a genuine stop when you stop typing
    max: 200,            // TOP SPEED (km/h) — the effective/display cap that drives motion
    overflowMax: 250,    // accumulator ceiling (the buffer lives between 200 and here)
    boost: 50,           // km/h added by an optimally-typed correct command
    optimalWpm: 45,      // type at/above this WPM to earn the full boost
    minBoostFactor: 0.4, // boost multiplier when typing very slowly
    holdBase: 1.2,       // seconds the gauge holds after a boost before it decays
    holdOverflowPer: 0.015, // extra hold seconds per accumulator point above max
    decay: 24,           // km/h per sec shed once the hold expires (above rollThreshold)
    rollThreshold: 25,   // km/h under which the burn-off eases off — the long roll home
    rollDecay: 8,        // km/h per sec shed below rollThreshold (gentle)
    brakeDecay: 90,      // km/h per sec shed while the brake (backspace) is on
    brakeHold: 0.3,      // seconds the brake light + scrub stay live per backspace tap
    legRate: 0.6         // pos-units/sec at top speed — sets how long a leg takes
  };

  /* ---- TIRE-DAMAGE MODEL (design "Pitstop Arcade.dc.html" §05) ---------------
   * A single integer tire_health (0–10, 0 = burst) maps to BOTH visual channels —
   * the rubber (greys black→white + growing wear spot) AND the side-panel gauge
   * (fill drops + hue green→red). This block is the state table; script.js
   * deriveTire() reads it. Redundant cues (fill level AND hue) survive
   * colourblindness.
   *
   * WEAR SOURCE (Andrew, 2026-07-16): mistakes are now what wears the rubber —
   * "the unit is not showing damage when there is a wrong input". Every miss costs
   * `missDamage`; a miss taken wheel-to-wheel with a car you're passing is a BUMP
   * and costs `bumpDamage` on top (see script.js damageTires / bumpNearbyCar).
   *   ⚠ Still GATED (Pitstop_Design_Note.md §10): the CONSEQUENCE of worn tires —
   *   the speed governor and the pit-stop repair loop. Damage accrues and SHOWS;
   *   nothing punishes it yet beyond the look.
   *
   * Stage map: Fresh 10–8 · Worn 7–5 · Warning 4–2 · Critical 1 · Burst 0. */
  const TIRE = {
    max: 10,
    demoHealth: 10,   // tire health every race starts on
    missDamage: 1,    // health lost per wrong command
    bumpDamage: 2,    // EXTRA health lost when that wrong command bumps a car you're passing
    // Ordered high→low; the first entry whose `min` the health meets wins.
    stages: [
      { min: 8, stage: 'FRESH',    stageColor: '#2ECC40', rubber: '#1A1A1A', spot: '18%', spotColor: '#333333', sheen: '0 0 18px rgba(255,255,255,.12)', panel: '#2ECC40', panel2: '#23a233', governor: '100%',                     govColor: '#2ECC40' },
      { min: 5, stage: 'WORN',     stageColor: '#FFDC00', rubber: '#595959', spot: '34%', spotColor: '#8F8F8F', sheen: 'none',                            panel: '#FFDC00', panel2: '#c9af00', governor: 'easing down',              govColor: '#FFDC00' },
      { min: 2, stage: 'WARNING',  stageColor: '#FF851B', rubber: '#A6A6A6', spot: '52%', spotColor: '#D4D4D4', sheen: 'none',                            panel: '#FF851B', panel2: '#d9660f', governor: '~90%',                     govColor: '#FF851B' },
      { min: 1, stage: 'CRITICAL', stageColor: '#FF4136', rubber: '#ECECEC', spot: '70%', spotColor: '#FFFFFF', sheen: 'none',                            panel: '#FF4136', panel2: '#c22219', governor: '~80% · one bump from burst', govColor: '#FF4136' }
    ],
    burst: { stage: 'BURST', stageColor: '#FF4136', rubber: '#161616', spot: '0%', spotColor: 'transparent', sheen: 'none', panel: '#FF4136', panel2: '#c22219', governor: '~40% (governor)', govColor: '#FF4136' }
  };

  /* ---- CAR CONFIG — [PHASE 1+ — GATED] placeholder stat blocks (handoff §6)
   * "speed/handling/tire-durability/fuel-capacity stats per car type."
   * ⚠ NO LONGER SURFACED IN RACE OPTIONS (2026-07-14): the Car option was
   * replaced by the Unit picker (SELECTABLE_UNITS below). Kept here as a gated
   * placeholder in case a separate performance/stats axis returns later. */
  const CAR_TYPES = [
    { id: 'rookie',  name: 'Rookie Runner', speed: 5, handling: 7, tireDurability: 8, fuelCapacity: 8 },
    { id: 'balanced', name: 'All-Rounder',  speed: 6, handling: 6, tireDurability: 6, fuelCapacity: 6 },
    { id: 'sprinter', name: 'Sprinter',     speed: 8, handling: 5, tireDurability: 4, fuelCapacity: 5 }
  ];

  /* ---- SELECTABLE UNITS (Andrew, 2026-07-14) --------------------------------
   * The player PICKS which unit (truck) they drive. This REPLACES the old Car
   * (rookie/balanced/sprinter) option in Race Options. Five to start ("off the
   * top of my head") — each is a REAL roster unit from datasets/units.csv.
   *
   * `hotkey` = the top-row number key that selects it on the Race Options screen.
   * They're spread 1 · 3 · 5 · 7 · 9 (NOT 1-2-3-4-5) so the reach is BALANCED
   * across the number row — Andrew's "divide the keyboard up" call. The chosen
   * ids also exercise every digit 0-9 when typed, which matters because you type
   * the unit constantly in-race (AP 2107, ENP 2107, …).
   *
   * `tint` is a PLACEHOLDER for the distinct race-car sprite each unit will get
   * later ("when we get there, the unit number will be a different looking race
   * car"). No car-visual system is built yet — today the tint only colours the
   * picker chip + the map marker so the units already LOOK distinct.
   *
   * To retune the roster: edit the five ids (keep them real units); if you add or
   * remove entries, keep the hotkeys on spread-out number-row keys. */
  const SELECTABLE_UNITS = [
    // stats (Andrew, 2026-07-15): speed = how fast the gauge climbs; handling =
    // how much speed a miss KEEPS. Picking the unit picks the car's feel — this
    // re-activates the gated CAR_TYPES idea, merged into the unit. Wired in
    // script.js; toggle with CARS.handlingEnabled.
    //
    // cls/blurb/pros/cons drive the Race Options UNIT DETAIL CARD (script.js
    // renderUnitDetail): the car art (assets/cars/{id}_c.png), a class + one-line
    // pitch, SPEED/CONTROL meters, a telemetry performance curve, and strengths/
    // weaknesses — so the player can see WHY to pick each unit. Content only.
    { id: '2107', hotkey: '1', tint: '#39ff14', stats: { speed: 6, handling: 6 },   // green
      cls: 'All-Rounder',
      blurb: 'Balanced speed and grip — no weakness, no standout. The dependable pick for learning a course.',
      pros: ['Even speed & control', 'Forgives most mistakes', 'Great all-round starter'],
      cons: ['Out-dragged by the sprinters', 'Out-lasted by the heavies'] },
    { id: '2138', hotkey: '3', tint: '#4db5ff', stats: { speed: 4, handling: 8 },   // blue
      cls: 'Steady',
      blurb: 'Slow to wind up, but shrugs off mistakes. Wins by never losing time.',
      pros: ['Typos barely cost speed', 'Rock-steady and forgiving', 'Ideal for new drivers'],
      cons: ['Lowest top speed', 'Sluggish to build pace'] },
    { id: '2045', hotkey: '5', tint: '#ffb000', stats: { speed: 7, handling: 5 },   // amber
      cls: 'Nimble',
      blurb: 'Quick to build pace and agile — but a touch twitchy when you slip.',
      pros: ['Fast to get up to speed', 'Agile and responsive'],
      cons: ['Mistakes bite', 'Needs a steady hand'] },
    { id: '2396', hotkey: '7', tint: '#ff3b30', stats: { speed: 9, handling: 3 },   // red
      cls: 'Flat-out',
      blurb: 'The fastest thing on the grid — and the most unforgiving. Experts only.',
      pros: ['Blistering top speed', 'Fastest acceleration'],
      cons: ['One typo tanks your speed', 'Brutal to control'] },
    { id: '2523', hotkey: '9', tint: '#c77dff', stats: { speed: 8, handling: 4 },   // violet
      cls: 'Sprinter',
      blurb: 'Explosive pace for drivers who rarely miss. Punishing when you do.',
      pros: ['Near-top acceleration', 'Big top speed'],
      cons: ['Low forgiveness', 'Errors cost you dearly'] }
  ];
  const DEFAULT_UNIT_ID = SELECTABLE_UNITS[0].id;

  /* ---- RACE OPTIONS (handoff §4) — definitions + defaults --------------------
   * Drives the Race Options screen controls. Selecting an option only writes to
   * raceOptions state; NO race logic is wired in Phase 0. */
  const RACE_OPTIONS = {
    defaults: {
      courseType: 'loop',       // 'loop' | 'point-to-point'
      courseSelect: 'random',   // a course id | 'random'
      randomBaseCount: 6,       // # bases when courseSelect === 'random'
      laps: 3,
      unit: DEFAULT_UNIT_ID,    // which truck you drive (was carType) — see SELECTABLE_UNITS
      timeOfDay: 'day',         // 'day' | 'night' (lighting only)
      raceLook: 'dark',         // 'dark' (green-phosphor CRT road, default) | 'outrun' (sunny OutRun skin) — see style.css .road-view.look-outrun
      startTime: 'NONE',        // shift-change schedule slot to begin at; 'NONE' = no Shift Changes (default while in dev)
      raceType: 'computer',     // 'computer' (AI/ghost) | 'players' (DEFERRED)
      pit: 'on',                // 'on' | 'off' — 'off' disables the Phase 3 layer
      difficulty: 'med',        // 'easy' | 'med' | 'hard'
      opponents: 3              // only when raceType !== solo time-trial
    },
    // Option metadata for rendering the controls generically.
    schema: [
      // Trimmed to essentials (Andrew, 2026-07-15): Time of Day, Race Look, Race
      // Type, Pit/No-Pit, Difficulty and Opponents were removed from the UI. Their
      // defaults above are kept so any game logic that reads them still works.
      { key: 'courseType',  label: 'Course Type',  values: ['loop', 'point-to-point'] },
      { key: 'courseSelect',label: 'Course',       values: ['random'] /* + course ids when authored */ },
      { key: 'laps',        label: 'Laps',         type: 'int', min: 1, max: 20 },
      { key: 'unit',        label: 'Unit',         control: 'unitpick' },  // number-key picker (1·3·5·7·9)
      { key: 'startTime',   label: 'Shift Change', dev: true, values: ['NONE', '0530', '0600', '0630', '0700', '0730', '0800', '0900', '1000', '1100', '1200', '1400', '1730', '1800', '1830', '1900', '1930'] }
    ]
  };

  /* The canonical pit base (handoff §1/§6): FLEET = 72123.
   * Note: Fleet (72123) and Westwood (72122) are the SAME building (same address
   * / coords). Westwood is the MIH / Community-Paramedic area — NOT the pit. The
   * pit lane is Fleet. People may say "Westwood" but mean Fleet. */
  const PIT_BASE_ID = '72123';

  /* Course rules. A course is a short ordered base list; only its bases render. */
  const COURSE_MAX_BASES = 5;      // hard cap per Andrew (2026-06-20)
  const DEFAULT_COURSE_ID = 'niagara-loop';

  /* ---- Region map image hook (handoff §6) ---------------------------------
   * When the real (Gemini) map art arrives, drop it in here. Set `image` to its
   * path and `bounds` to the lat/lon the image edges cover; data.js will then
   * geo-reference base positions onto the image instead of auto-fitting them.
   * Left null in Phase 0 — the map renders as a vector placeholder until then. */
  const REGION_MAP = {
    image: null,                   // e.g. 'assets/region_map.png'
    bounds: null                   // e.g. { north: 43.30, south: 42.85, east: -78.95, west: -79.60 }
  };

  /* ---- Road view (main play surface) art hook ------------------------------
   * The road we're driving is the primary surface. Until real road art lands,
   * script.js renders a procedural vector road that scrolls with speed. Drop a
   * looping road image / sprite path here later and the renderer will use it. */
  const ROAD_VIEW = {
    image: null                    // e.g. 'assets/road_loop.png' (null = procedural)
  };

  /* ---- OUTRUN CURVE ENGINE (Andrew, 2026-07-15) ----------------------------
   * The road bends as you drive and the car banks into it. This is a CSS-scene
   * approximation: script.js writes --road-curve (-1..1) each frame; the CSS
   * skews the road's vanishing point + parallax-shifts the sun/clouds/scenery,
   * and the car frame/lean follows. `rate` = how fast the bend evolves with
   * travel; `ease` = how quickly the live curve settles toward target; amp/freq
   * shape the (summed-sine) road. frameThresholds = |steer| cutoffs choosing the
   * c / r1 / r2 car frame. placeholderLeanDeg = the div-car's fake lean until
   * real sprites load. */
  const ROAD_CURVE = {
    rate: 6, ease: 3,
    amp1: 0.7, freq1: 0.9, amp2: 0.3, freq2: 2.3,
    frameThresholds: [0.18, 0.5],
    placeholderLeanDeg: 8
  };

  /* ---- CAR SPRITES (OutRun banking cars) — see Pitstop_Car_Sprite_Brief.md ---
   * Per-unit race-car sprites live in assets/cars/{unit}_{c|r1|r2}.png (straight
   * + two RIGHT leans; the engine mirrors them for left curves). Auto-detected:
   * if a unit's three frames load, the car renders as those sprites; otherwise
   * the procedural div-car stays and fake-leans. Drop 2107_c/r1/r2.png in to test
   * — no flag to flip. handlingEnabled gates the per-unit speed/handling stats. */
  const CARS = {
    enabled: true,
    path: 'assets/cars/',
    handlingEnabled: true
  };

  /* ---- TRAFFIC — opponent cars on the track (Andrew, 2026-07-16) ------------
   * A field of other roster units circulates around the player on the same
   * pseudo-3D road as the scenery, and you either pass them or they pass you.
   *
   * Every car holds its OWN pace, sampled uniformly across avgKph ± spreadKph and
   * then clamped to [minKph, maxKph] — so the field averages `avgKph` and NOTHING
   * ever exceeds `maxKph` (Andrew: "they should not go any faster then 175. That
   * is the max"). Since the player's top end is 200, out-typing the field always
   * beats it; stop typing and the whole field files past you.
   *
   * Geometry note: camDepth/zFar/lanes describe the projection and MUST stay in
   * step with the CSS road trapezoid (style.css .rv-road) — script.js tfProject()
   * reproduces that shape, including the --road-curve skew, so the cars sit on the
   * tarmac through a bend. Distances are metres; z = metres ahead of the player. */
  const TRAFFIC = {
    enabled: true,
    count: 5,             // cars circulating in the draw range at once
    avgKph: 125,          // the field's average pace
    spreadKph: 50,        // ± sampled per car (re-rolled each time one recycles)
    minKph: 70,
    maxKph: 175,          // HARD ceiling — no opponent ever exceeds this
    camDepth: 24,         // pseudo-3D camera depth: on-screen scale = camDepth / (camDepth + z)
    zFar: 260,            // metres ahead: cars fade in / recycle out here
    zBehind: -40,         // metres behind: cars recycle back to the horizon here
    zHide: -6,            // stop drawing once a car is this far past the camera
    passZ: 12,            // |z| under this = wheel-to-wheel; a typo in here BUMPS
    lanes: [-0.58, -0.34, 0.34, 0.58],  // lateral slots as a fraction of the road half-width
    bumpSpeedKeep: 0.6    // speed kept after a bump, on TOP of the normal miss bleed
  };

  /* ---- SHIFT CHANGE (NEMS500_ShiftChange_DesignNote.md) --------------------
   * Mid-race OVERLAY challenge: at real shift-change clock times the player is
   * telegraphed one leg early, types LA after ENP to stay mobile, then clears a
   * box of units through their command chain before finishing BSE. The car never
   * stops. This block is CONFIG ONLY — the box engine is in core/shiftchange.js.
   *
   * Time-of-day drives everything (Andrew, 2026-07-12):
   *   • 24h units (two 12h shifts) change at pre-dawn / evening slots. They sit in
   *     EOS and need the FULL chain RCAV→OD→SS→BSEH→CAV SS. More units. HARDER.
   *   • 12h units start mid-day. Fewer units, no RCAV→OD — they appear as SP
   *     (Shift Pending) and the player begins at SS. The natural ON-RAMP.
   * The game never waits real minutes; it jumps to the next slot as changes fire.
   *
   *   AM + mid-day unit-counts below are the REAL Break Log numbers (Andrew,
   *   "Shift Change Numbers.txt", 2026-07-12). 24h trucks run a 5/4/5 rotation;
   *   12h trucks are "Continental". Evening (1730+) counts are NOT in that log —
   *   they mirror the morning (same 24h trucks changing back) and want the real
   *   evening numbers. Specific unit IDs are intentionally random: units get
   *   shuffled for maintenance / base wear-balancing, so the roster is not fixed.
   *
   *   ⚠ OPEN (design note §6, need Andrew's CAD knowledge): full critical-vs-
   *   fixable error table; the miss CONSEQUENCE (own damage track vs tires) — for
   *   now a passed deadline is a SOFT flag only, not wired to any penalty; and
   *   RCAV/OD/BSEH batchability. */
  const SHIFT_CHANGE = {
    enabled: true,
    // Chain step CODES the player types as "<CODE> <UNIT>" (e.g. "RCAV 2101",
    // "CAV SS 2101"). Order is strict; NOTE is legal any time after SS is done.
    chains: {
      '24h': ['RCAV', 'OD', 'SS', 'BSEH', 'CAV SS'],   // EOS units — full chain
      '12h': ['SS', 'BSEH', 'CAV SS']                  // SP units — start at SS
    },
    startStatus: { '24h': 'EOS', '12h': 'SP' },        // status label a unit shows on entry
    noteAfter: 'SS',                                   // NOTE unlocks once this step is done
    // Simulated wall-clock. It starts at the slot time and runs fast so the
    // per-unit roster deadline bites within real typing time.
    clockScale: 18,           // sim-seconds elapsed per real second (tunable)
    unitDeadlineBase: 120,    // sim-sec after slot time the 1st unit is due
    unitDeadlineStagger: 60,  // extra sim-sec per subsequent unit in the list
    // Schedule of shift-change slots. `kind` selects the chain; `units` = how many
    // appear in the box. Pre-dawn/evening 24h = the hard end; mid-day 12h = on-ramp.
    schedule: [
      // ---- Morning 24h changeover (5/4/5 units) — REAL Break Log counts ----
      { time: '0530', kind: '24h', units: 7 },
      { time: '0600', kind: '24h', units: 5 },
      { time: '0630', kind: '24h', units: 4 },
      { time: '0700', kind: '24h', units: 5 },
      { time: '0730', kind: '24h', units: 6 },
      // ---- Mid-day 12h "Continental" starts — REAL Break Log counts --------
      { time: '0800', kind: '12h', units: 1 },
      { time: '0900', kind: '12h', units: 2 },
      { time: '1000', kind: '12h', units: 3 },
      { time: '1100', kind: '12h', units: 2 },   // seasonal 1–2; using 2
      { time: '1200', kind: '12h', units: 4 },
      { time: '1400', kind: '12h', units: 2 },
      // ---- Evening 24h changeover — ESTIMATE (mirrors morning; confirm) ----
      { time: '1730', kind: '24h', units: 7 },
      { time: '1800', kind: '24h', units: 5 },
      { time: '1830', kind: '24h', units: 4 },
      { time: '1900', kind: '24h', units: 5 },
      { time: '1930', kind: '24h', units: 6 }
    ]
  };

  global.PITSTOP_CONFIG = {
    CONFIG: CONFIG,
    TUNABLES: TUNABLES,
    SPEED: SPEED,
    TIRE: TIRE,
    CAR_TYPES: CAR_TYPES,
    SELECTABLE_UNITS: SELECTABLE_UNITS,
    DEFAULT_UNIT_ID: DEFAULT_UNIT_ID,
    RACE_OPTIONS: RACE_OPTIONS,
    PIT_BASE_ID: PIT_BASE_ID,
    COURSE_MAX_BASES: COURSE_MAX_BASES,
    DEFAULT_COURSE_ID: DEFAULT_COURSE_ID,
    REGION_MAP: REGION_MAP,
    ROAD_VIEW: ROAD_VIEW,
    ROAD_CURVE: ROAD_CURVE,
    CARS: CARS,
    TRAFFIC: TRAFFIC,
    SHIFT_CHANGE: SHIFT_CHANGE
  };
})(window);

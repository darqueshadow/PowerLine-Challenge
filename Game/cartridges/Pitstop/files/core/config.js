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
    // ONLY used by Race Type B ('timed'); Type A ('sequence') ignores them and
    // gates on order alone. Placed on THIRDS (was .5/.85) so a single ~52 km/h
    // boost — which coasts the car ~0.43 of a leg — actually reaches the next
    // gate. At .5/.85 the car stalled short of ENP (the yellow-flash lock).
    // Retune together with SPEED.boost/decay if the leg feel changes.
    gateAP: 0.0, gateENP: 0.33, gateBSE: 0.66,
    // Type A (HYBRID) arrival gate: AP & ENP are order-gated only, but the final
    // BSE (arrival) beat won't post until the car is THIS far into the leg — you
    // must drive up to the base to finish. Reachable by design: after ENP the car
    // auto-rolls in (race.arriving), so it always reaches this mark. Type B ignores
    // it (it position-gates every beat). Lower = you can "arrive" sooner.
    arrivalGate: 0.66,
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
    // DIFFICULTY RAMP (Andrew, 2026-07-17): the unit NUMBERS were chosen by how
    // hard the number is to TYPE, and the roster is ordered easiest→hardest. The
    // stats now track that ramp — EASIER number = SLOWER + more forgiving, HARDER
    // number = FASTER + less forgiving — so the reward for taking on a tougher
    // number to type is more speed. speed climbs 4→9 and handling falls 8→3 down
    // the list (each pair sums to 12: a straight speed↔control trade). Keep this
    // monotonic if you retune, and keep the ids real roster units.
    //
    // cls/blurb/pros/cons drive the Race Options UNIT DETAIL CARD (script.js
    // renderUnitDetail): the car art (assets/cars/{id}_c.png), a class + one-line
    // pitch, SPEED/CONTROL meters, a telemetry performance curve, and strengths/
    // weaknesses — so the player can see WHY to pick each unit. Content only.
    { id: '2107', hotkey: '1', tint: '#39ff14', stats: { speed: 4, handling: 8 },   // green
      cls: 'Steady',
      blurb: 'The simplest number to hammer out — and the most forgiving car. Slow to wind up, but a typo barely dents your pace. The natural first pick.',
      pros: ['Easiest unit number to type', 'Typos barely cost speed', 'Rock-steady and forgiving'],
      cons: ['Lowest top speed', 'Slow to build pace'] },
    { id: '2138', hotkey: '3', tint: '#4db5ff', stats: { speed: 5, handling: 7 },   // blue
      cls: 'Cruiser',
      blurb: 'An easy number to type and an easy car to drive. A relaxed pace with plenty of forgiveness for the odd slip.',
      pros: ['Straightforward number to enter', 'Very forgiving of mistakes'],
      cons: ['Still short on top speed', 'Sluggish off the line'] },
    { id: '2045', hotkey: '5', tint: '#ffb000', stats: { speed: 6, handling: 6 },   // amber
      cls: 'All-Rounder',
      blurb: 'Balanced speed and grip — no weakness, no standout. A middling number to type and the dependable pick for learning a course.',
      pros: ['Even speed & control', 'Forgives most mistakes', 'Great all-round pick'],
      cons: ['Out-dragged by the sprinters', 'Out-lasted by the steady cars'] },
    { id: '2396', hotkey: '7', tint: '#ff3b30', stats: { speed: 8, handling: 4 },   // red
      cls: 'Sprinter',
      blurb: 'Explosive pace for drivers who rarely miss — and a trickier number to keep nailing at speed. Punishing when you slip.',
      pros: ['Big top speed', 'Fast to get up to pace'],
      cons: ['Mistakes bite hard', 'A demanding number to type clean'] },
    { id: '2523', hotkey: '9', tint: '#c77dff', stats: { speed: 9, handling: 3 },   // violet
      cls: 'Flat-out',
      blurb: 'The fastest thing on the grid — and the most unforgiving, with the toughest number to hammer out under pressure. Experts only.',
      pros: ['Blistering top speed', 'Fastest acceleration'],
      cons: ['One typo tanks your speed', 'The hardest number to type clean'] }
  ];
  const DEFAULT_UNIT_ID = SELECTABLE_UNITS[0].id;

  /* ---- RACE OPTIONS (handoff §4) — definitions + defaults --------------------
   * Drives the Race Options screen controls. Selecting an option only writes to
   * raceOptions state; NO race logic is wired in Phase 0. */
  const RACE_OPTIONS = {
    defaults: {
      // Race Type (Andrew, 2026-07-17 → hybrid chosen 2026-07-17). Governs how the
      // AP→ENP→BSE beats are gated. (see PITSTOP_RACE_TYPE_AB.md)
      //   'sequence' (Type A · HYBRID) — AP & ENP are order-gated only (type them
      //     any time); the final BSE ARRIVAL needs the car near the base
      //     (TUNABLES.arrivalGate). After ENP the car auto-rolls in, so you just
      //     drive up and confirm arrival. Keeps the drive-to-base moment, no
      //     mid-leg walls, can't soft-lock.
      //   'timed'    (Type B) — every beat unlocks at a point on the leg
      //     (gateAP/ENP/BSE); calling it early is a no-op with a "too early" cue.
      legMode: 'sequence',
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
      { key: 'legMode',     label: 'Race Type',    values: ['sequence', 'timed'] },  // A/B toggle — custom row
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

  /* The pit is track furniture with no coordinates of its own (spec L5). It is
   * rendered at the position of PIT_ANCHOR_ID — Glendale (72115), with which
   * Fleet physically shares a building (2 Westwood Ct). data.js injectPitFurniture
   * places the pit marker there.
   *   ⚠ The MAP no longer uses that position (Andrew, 2026-07-19: "ignore the
   *   lat/lon for Fleet, put it beside the Start/Stop base"). script.js renderMap
   *   pins the pit tire next to the start/finish node instead, which is where the
   *   pit lane physically branches. The anchor still gives Fleet a coordinate for
   *   any non-map consumer. */
  const PIT_ANCHOR_ID = '72115';

  /* THE FULL RACE (Andrew, 2026-07-19) — the Grand Tour. Its map shows the WHOLE
   * of Niagara: every municipality is drawn, including the ones it has no stop
   * in (Wainfleet and Thorold). Every other course lights up only the
   * municipalities it actually touches. See core/region.js municipalitiesFor(). */
  const FULL_COURSE_ID = 'NEMS-07';

  /* Course rules. A course is a short ordered base list; only its bases render. */
  const COURSE_MAX_BASES = 5;      // hard cap per Andrew (2026-06-20)
  const DEFAULT_COURSE_ID = 'niagara-loop';

  /* ---- GEO — BaseGeo / Course geometry config -------------------------------
   * Backs core/basegeo.js (spec §2–§3) and core/course.js (spec §4). Per spec §7
   * NONE of these may be hardcoded in the modules that consume them.
   *
   * ⚠ The `null`s below are BLOCKED, not forgotten. Each is an Andrew decision
   * (spec §8) and Code is explicitly barred from defaulting them (spec §11).
   * A null here means the dependent feature stays inert — it does NOT mean
   * "pick something sensible". See PITSTOP_GEOGRAPHY_FINDINGS.md. */
  const GEO = {
    // Validation bounds (spec §2.3 V1). Anything outside is a sign or typo
    // error. This is the rule that catches defect D1 — 17 of 18 rows carrying a
    // positive longitude, which parses and projects cleanly while sitting in
    // Kazakhstan. Widen these only if the real roster leaves Niagara.
    bounds: { latMin: 42.8, latMax: 43.4, lonMin: -79.7, lonMax: -78.8 },

    // Spec §2.3 V6 — 72122 stays out of BaseGeo and out of any course Sequence.
    //
    //   ⚠ The spec's stated REASON for this is wrong; the rule survives anyway.
    //   Spec L4 claims "72122 is a code, not a place" and that the pit is 72122.
    //   Andrew corrected both (2026-07-16): the pit is 72123/Fleet, and 72122 is
    //   Westwood — a REAL base, technically distinct, that happens to share an
    //   address (2 Westwood Ct) with Fleet AND with Glendale (72115). So its
    //   coordinates matching 72115 byte-for-byte is a PHYSICAL FACT, not the
    //   copy-paste error spec D2 diagnosed.
    //
    //   It is excluded because BaseGeo is the raceable NODE SET: a node sitting
    //   exactly on Glendale cannot be a distinct course node (the leg between
    //   them is 0 km) and would render as one dot. Excluded for geometry, not
    //   because it isn't real. If Westwood ever needs to be raceable, Glendale
    //   is the conflict to resolve — not this line.
    excludedCode: '72122',

    // Spec §4.3 C5 — below this, two course nodes render on top of each other.
    // Set by Code as a RENDER-LEGIBILITY floor, deliberately chosen to reject
    // nothing in the current roster: the closest real pair is King (72108) <->
    // Prince Charles (72125) at 1.79 km, so 1.5 catches genuine coincidence
    // only and changes no course's legality today. Andrew's to raise if he wants
    // near-neighbours excluded on gameplay grounds rather than drawing grounds.
    minLegDistanceKm: 1.5,

    // Spec §4.2 Tier — banded from TotalDistance.
    //   ⚠ BLOCKED on O6. Until Andrew authors the bands, tier resolves to null
    //   and nothing may branch on it. Shape when it lands:
    //     [{ tier: 'short', maxKm: 60 }, ..., { tier: 'grand', maxKm: null }]
    tierBands: null,

    // Spec §6 — time compression S (game-seconds per real second).
    //   ⚠ BLOCKED on O2 (target round length). S alone decides whether pitting
    //   is a decision or a formality: pit time is real typing time and does not
    //   scale, race time does. Code must not pick it (spec §11).
    timeCompressionS: null,

    // Spec §4.4 — pit floor, so a zero-swap pit is not free.
    //   ⚠ BLOCKED — Andrew's (spec §11).
    pitFloorSec: null,

    // Spec §4.4 — the code typed to enter the pit. RESOLVED (Andrew, 2026-07-16):
    // it is 72123/Fleet, NOT the 72122/Westwood the spec's L4 asserts. Westwood
    // is the same location but technically a different base — see excludedCode.
    //
    // Deliberately an alias, not a copy: PIT_BASE_ID is the existing source of
    // truth and the racing layer already reads it. Two config keys holding the
    // same base code independently is exactly the second-source-of-truth problem
    // spec §2.1 warns about — one of them would eventually be edited alone.
    pitEntryCode: PIT_BASE_ID
  };

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
   * + two RIGHT leans; the engine mirrors them for left curves). Auto-detected
   * and PARTIAL-FRIENDLY: the straight frame alone is enough to put the picked
   * unit's car on the road (it then fake-leans like the placeholder did); add
   * _r1/_r2 and it banks on real art. Only a missing _c falls back to the
   * procedural div-car. Drop PNGs in to test — no flag to flip.
   * handlingEnabled gates the per-unit speed/handling stats. */
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

  /* ---- BANNER WINDOW — Race Type B "typing window" (PITSTOP_RACE_TYPE_AB.md
   * §"Type B — Banner-Window mechanic", Andrew 2026-07-17) -------------------
   * FIRST SLICE: the ENP beat only. In Race Type B ('timed') the ENP gate stops
   * being an invisible position wall and becomes a VISIBLE typing window bracketed
   * by two road gantries:
   *   • OPEN  banner (filled)  — passes ⇒ start typing ENP now.
   *   • CLOSE banner (outline) — Enter must be in before it passes.
   * Type a LETTER before OPEN = too-early stumble (auto-brake scrub, NO tire
   * damage — damage still means "wrong content"). Finish after CLOSE = a miss:
   * speed bleed + the beat RE-ARMS (the window comes round again) — lose time,
   * not the race. Steering keys are free (there's no steering layer in this slice).
   *
   * FIXED-DISTANCE window (the doc's recommended call): the two banners are real
   * objects at leg positions; the car's `handling` stat sets the OPEN→CLOSE gap
   * (better handling = wider = more grace). Your SPEED then sets how tight it FEELS
   * — carry speed to win and the window shrinks; slow to the crawl floor and it's
   * roomy but you lose pace. Speed is the risk dial.
   *
   *   ⚠ REACHABILITY (`gateCrawl`): typing is the only throttle, so a car that
   *   coasts to a stop SHORT of a gated beat has no command left to type (the next
   *   beat is gated) → soft-lock. A gentle crawl floor, live only in 'timed' mode
   *   once AP is posted and while a gated beat is still ahead, always carries the
   *   car up to the next banner. This is Type B's price for position-gating (the
   *   doc's "gate placement is chained to speed tuning forever"); the crawl breaks
   *   that chain. Type A never reads any of this. Only ENP is bannered in Slice 1;
   *   AP (gate 0) and BSE (gateBSE) keep their plain 'timed' position gates. */
  const BANNER = {
    enabled: true,
    // How far ahead (in leg-fraction) a banner first fades in at the horizon. z is
    // derived as ((bannerPos - pos) / rangeFrac) * TRAFFIC.zFar, so a banner sits at
    // the horizon when it's `rangeFrac` of a leg ahead and reaches the camera at 0.
    rangeFrac: 0.34,
    // OPEN→CLOSE gap (leg-fraction), mapped across the handling stat: worse handling
    // (handMin) → gapMin (tight), better handling (handMax) → gapMax (roomy).
    //   ⚠ TUNING FLOOR (review 2026-07-17): the gap must be wide enough that the
    //   gateCrawl floor CATCHES the car inside the window — a fast unit enters OPEN
    //   hot (~40 km/h) and only slows to the crawl ~0.15 of a leg in, so a gap below
    //   ~0.16 leaves it crossing at speed with < the ~2.1s needed to type "ENP ####"
    //   → a guaranteed first-pass miss. In THIS roster handling anti-correlates with
    //   speed (speed+handling=12), so the FAST units (low handling) both arrive
    //   hottest AND — under "better handling = wider" — get the narrowest window; the
    //   floor below keeps that from being a hard wall. Retune against carried-speed
    //   cross-TIME, not raw pos. This is the doc's "gate placement chained to speed
    //   tuning" coupling made concrete — the headline knob to feel-test.
    gapMin: 0.18, gapMax: 0.26,
    handMin: 3, handMax: 8,   // SELECTABLE_UNITS handling range this maps across
    // Reachability crawl floor (km/h) — see the soft-lock note above. Keep it below
    // rollThreshold (25) so it reads as a slow roll, not a boost, and retune WITH
    // SPEED if the leg feel changes.
    gateCrawl: 14,
    // On a missed window, place the fresh OPEN this far (leg-fraction) ahead of the
    // car so the window is re-approached (and, since a miss bled the speed, hit slow
    // and easy). If a fresh window won't fit before `safeMaxClose`, the car instead
    // HOLDS at the current CLOSE banner until ENP is called — the last-ditch, only
    // place a banner acts as a wall, so a leg can never soft-lock on a missed window.
    rearmLead: 0.12,
    safeMaxClose: 0.90,

    /* ---- PACING CAPS (Andrew, 2026-07-19: "the time between banners is too long,
     * lets cap it at 15 seconds for now") ------------------------------------
     * Both windows below are wall-clock, NOT leg-fraction, because leg-fraction
     * is meaningless as a wait: the same 0.33 of a leg is 2 seconds at 200 km/h
     * and half a minute at a crawl. The car's speed is the player's own doing, so
     * a slow lap must not also mean a boring one.
     *   maxLeadSec  — hard cap on DEAD TIME: if the car has been driving this long
     *     with a window armed but not yet reached, the OPEN gantry is re-seated
     *     just ahead (`leadFrac`) so a banner always arrives inside 15s.
     *   maxWindowSec — cap on the OPEN→CLOSE window itself. Rarely binds at pace
     *     (the fixed-distance gap is a couple of seconds at speed); it's the
     *     backstop for a car crawling through its own window. */
    maxLeadSec: 15,
    maxWindowSec: 15,
    // Where a re-seated OPEN lands relative to the car (leg-fraction). Must be
    // under rangeFrac (0.34) so the gantry fades in from the horizon rather than
    // materialising on top of the player.
    leadFrac: 0.16,

    /* ---- HIT ZONE — the painted accuracy strip (Andrew, 2026-07-19) ---------
     * A band painted across the tarmac inside the OPEN→CLOSE window. Land Enter
     * with the car ON it and the boost runs at full duration; the further off, the
     * shorter it runs (script.js gradeCheckpoint / BOOST.tiers).
     *
     *   ⚠ WHY THIS ISN'T A LITERAL CAR LENGTH. Andrew asked for "a section of
     *   track that is a car length". Taken literally that is unplayable: one car
     *   (~5 m) is ~0.008 of a leg, which at 100 km/h the car crosses in about 25
     *   MILLISECONDS — under two frames, so no human input could ever land on it.
     *   The band is therefore sized as a FRACTION OF THE WINDOW and tuned by feel;
     *   it reads as a short painted section on screen (a few car lengths at the
     *   camera) while staying hittable. Tune `len` for difficulty: smaller = a
     *   tighter, more demanding zone.
     *
     * All three are fractions of the OPEN→CLOSE span:
     *   len       — how long the painted band is
     *   endMargin — gap left between the band and the CLOSE gantry, so nailing the
     *               zone never risks over-running CLOSE on the same keystroke
     * The band therefore sits LATE in the window: hanging on for it is the risky
     * play, which is the cartridge's whole "risk the wall" premise. */
    zone: { len: 0.24, endMargin: 0.07 }
  };

  /* ---- BOOST — typing speed and Enter accuracy, split (Andrew, 2026-07-19) ---
   * "depending on how quickly the player types, should equal how fast the car will
   * go for that command … depending on how accurate their enter is, will determine
   * how long the boost lasts for."
   *
   * Two independent dials, deliberately:
   *   HOW HARD  — WPM. Already the speed model's job (SPEED.boost × wpm factor):
   *     type it clean and fast and the gauge jumps further. Also drives the engine
   *     rev's pitch/length (audio.js _rev), so the car SOUNDS like it pulled.
   *   HOW LONG  — Enter accuracy against the painted hit zone. Sets the seconds the
   *     boost holds before the normal decay resumes, and how far the car's own
   *     speed is allowed to overshoot while it runs.
   *
   * Keeping them separate means a fast typist who mistimes Enter gets a big but
   * brief shove, and a metronomic typist who nails the zone gets a long, gentler
   * one — two different ways to be good at the game rather than one.
   *
   * `tiers` is ordered BEST→WORST and read as: the first tier whose `within` the
   * grade meets wins. `within` is distance from the zone centre measured in zone
   * HALF-LENGTHS, so `within: 1` is literally "on the paint". */
  const BOOST = {
    enabled: true,
    tiers: [
      { key: 'perfect', within: 1.0,      label: 'PERFECT',  hold: 3.2, mult: 1.30, cls: 'perfect' },
      { key: 'good',    within: 2.0,      label: 'GOOD',     hold: 2.2, mult: 1.15, cls: 'good' },
      { key: 'ok',      within: 3.5,      label: 'OK',       hold: 1.4, mult: 1.00, cls: 'ok' },
      { key: 'loose',   within: Infinity, label: 'SLOPPY',   hold: 0.8, mult: 0.88, cls: 'loose' }
    ],
    // Extra --road-spd multiplier while a boost runs — the visual "pull".
    roadRush: 1.35,
    // Type A has no banners, so it has no zone to grade against. It keeps the plain
    // SPEED.holdBase hold; this flag is what stops the indicator appearing there.
    bannerModeOnly: true
  };

  /* ---- STEERING — swerve through the field (Andrew, 2026-07-19) --------------
   * "the arrow keys engage, and the player has to swerve past other cars."
   * Until now the car's lateral position was purely the road's doing (the OutRun
   * bend banked it); the player had no lane control at all, which is why the arrow
   * keys did nothing in-race. Left/Right now move the car across the tarmac and the
   * field becomes something you have to physically miss.
   *
   * `lane` matches the TRAFFIC lane scale: 0 = centre line, ±1 = the rumble strip.
   * The steering is deliberately loose (rate/return) rather than instant — this is
   * an arcade racer, not a shooter, and a twitch-perfect dodge would make the
   * traffic free. Contact costs the boost, some speed and some rubber. */
  const STEER = {
    enabled: true,
    rate: 1.7,         // lane-units per second while a key is held
    returnRate: 0.9,   // lane-units per second the car drifts back to centre when it isn't
    max: 0.76,         // furthest off centre you can get (TRAFFIC lanes top out at 0.58)
    // Contact box. Two cars occupy the same slice of road when they're within
    // `collideZ` metres of each other AND overlap laterally by `collideLane`.
    collideZ: 8,
    collideLane: 0.30,
    // Speed kept after swerving into someone (on top of the tire cost).
    hitSpeedKeep: 0.55,
    hitDamage: 2,
    // Seconds of immunity after a contact, so one clumsy moment can't chain into
    // three collisions on the same car while you're still overlapping it.
    hitCooldown: 0.9
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
    PIT_ANCHOR_ID: PIT_ANCHOR_ID,
    FULL_COURSE_ID: FULL_COURSE_ID,
    COURSE_MAX_BASES: COURSE_MAX_BASES,
    DEFAULT_COURSE_ID: DEFAULT_COURSE_ID,
    GEO: GEO,
    REGION_MAP: REGION_MAP,
    ROAD_VIEW: ROAD_VIEW,
    ROAD_CURVE: ROAD_CURVE,
    CARS: CARS,
    TRAFFIC: TRAFFIC,
    BANNER: BANNER,
    BOOST: BOOST,
    STEER: STEER,
    SHIFT_CHANGE: SHIFT_CHANGE
  };
})(window);

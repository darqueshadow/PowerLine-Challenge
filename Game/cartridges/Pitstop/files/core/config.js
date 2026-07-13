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

    version: '0.7.1',
    versionLabel: 'PHASE 1 · MAP-CHALLENGE + SPEED/WPM'
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

  /* ---- SPEED / WPM MODEL (Andrew, 2026-07-12) ------------------------------
   * The gauge reads 0–50–100 and is DRIVEN by typing speed (WPM of the command
   * you're entering). A correct command "boosts" the gauge; it HOLDS briefly, then
   * slowly runs down — with more allowance between commands than the old impulse
   * model. Boosts stack toward 100. At/above 100 the hold lasts longer and the
   * value can OVERFLOW past 100 (a buffer) so you stay at top speed longer.
   * These numbers are a FIRST PASS — meant to be tuned by feel.
   * ⚠ Andrew's spec cut off ("…if I get enough") — the overflow-buffer payoff is
   * inferred; confirm/adjust. */
  const SPEED = {
    base: 25,            // idle floor — the car never fully stops
    max: 100,            // effective/display cap that drives motion
    overflowMax: 150,    // accumulator ceiling (the buffer lives between 100 and here)
    boost: 25,           // gauge points added by an optimally-typed correct command
    optimalWpm: 45,      // type at/above this WPM to earn the full boost
    minBoostFactor: 0.4, // boost multiplier when typing very slowly
    holdBase: 1.2,       // seconds the gauge holds after a boost before it decays
    holdOverflowPer: 0.03, // extra hold seconds per accumulator point above 100
    decay: 12,           // gauge points/sec lost once the hold expires (gentle)
    legRate: 0.6         // pos-units/sec at full (100) speed — sets how long a leg takes
  };

  /* ---- CAR CONFIG — [PHASE 1+ — GATED] placeholder stat blocks (handoff §6)
   * "speed/handling/tire-durability/fuel-capacity stats per car type." */
  const CAR_TYPES = [
    { id: 'rookie',  name: 'Rookie Runner', speed: 5, handling: 7, tireDurability: 8, fuelCapacity: 8 },
    { id: 'balanced', name: 'All-Rounder',  speed: 6, handling: 6, tireDurability: 6, fuelCapacity: 6 },
    { id: 'sprinter', name: 'Sprinter',     speed: 8, handling: 5, tireDurability: 4, fuelCapacity: 5 }
  ];

  /* ---- RACE OPTIONS (handoff §4) — definitions + defaults --------------------
   * Drives the Race Options screen controls. Selecting an option only writes to
   * raceOptions state; NO race logic is wired in Phase 0. */
  const RACE_OPTIONS = {
    defaults: {
      courseType: 'loop',       // 'loop' | 'point-to-point'
      courseSelect: 'random',   // a course id | 'random'
      randomBaseCount: 6,       // # bases when courseSelect === 'random'
      laps: 3,
      carType: 'balanced',
      timeOfDay: 'day',         // 'day' | 'night' (lighting only)
      startTime: 'NONE',        // shift-change schedule slot to begin at; 'NONE' = no Shift Changes (default while in dev)
      raceType: 'computer',     // 'computer' (AI/ghost) | 'players' (DEFERRED)
      pit: 'on',                // 'on' | 'off' — 'off' disables the Phase 3 layer
      difficulty: 'med',        // 'easy' | 'med' | 'hard'
      opponents: 3              // only when raceType !== solo time-trial
    },
    // Option metadata for rendering the controls generically.
    schema: [
      { key: 'courseType',  label: 'Course Type',  values: ['loop', 'point-to-point'] },
      { key: 'courseSelect',label: 'Course',       values: ['random'] /* + course ids when authored */ },
      { key: 'laps',        label: 'Laps',         type: 'int', min: 1, max: 20 },
      { key: 'carType',     label: 'Car',          values: CAR_TYPES.map(c => c.id) },
      { key: 'timeOfDay',   label: 'Time of Day',  values: ['day', 'night'] },
      { key: 'startTime',   label: 'Shift Change', dev: true, values: ['NONE', '0530', '0600', '0630', '0700', '0730', '0800', '0900', '1000', '1100', '1200', '1400', '1730', '1800', '1830', '1900', '1930'] },
      { key: 'raceType',    label: 'Race Type',    values: ['computer', 'players'] /* players = DEFERRED */ },
      { key: 'pit',         label: 'Pit / No-Pit', values: ['on', 'off'] },
      { key: 'difficulty',  label: 'Difficulty',   values: ['easy', 'med', 'hard'] },
      { key: 'opponents',   label: 'Opponents',    type: 'int', min: 0, max: 7 }
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
    CAR_TYPES: CAR_TYPES,
    RACE_OPTIONS: RACE_OPTIONS,
    PIT_BASE_ID: PIT_BASE_ID,
    COURSE_MAX_BASES: COURSE_MAX_BASES,
    DEFAULT_COURSE_ID: DEFAULT_COURSE_ID,
    REGION_MAP: REGION_MAP,
    ROAD_VIEW: ROAD_VIEW,
    SHIFT_CHANGE: SHIFT_CHANGE
  };
})(window);

/* ========================================================
   ASTEROID COMMAND — CONFIG MODULE
   Extracted from script.js per Build Procedure v1.6
   ======================================================== */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    maxShieldStrength: 9,
    hpPerShieldLayer: 3,
    misfireDamage: 1,
    impactDamage: 3,
    asteroidRadius: 20,
    zoneHeight: 50,
    projectileSpeed: 800,
    ambulanceSpeed: 400,
    beamDuration: 2000,
    shieldRegenStreak: 5,
    altitudeThreshold: 0.25,
    isHolodeck: false,
    isBeta: false,
    devModePassword: "DISPATCH",
    devModeTimeout: 10000,
    holodeckPassword: "RED RABBIT",
    holodeckTimeout: 15000
};

// ============================================
// SCORING MULTIPLIERS (loaded from scoring.csv)
// All bonuses/penalties are multipliers of the current rank's Base Hit value.
// ============================================

const SCORING = {
    // ── Base Scoring Multipliers ──
    perfectMult: 0.25,      // Perfect Shot: 25% of Base Hit (0 backspaces)
    earlyMult: 0.5,         // Early Intercept: 50% of Base Hit (top 25% of screen)
    speedDemonMult: 0.15,   // Speed Demon: 15% of Base Hit (cleared < 1.5s after spawn)
    speedDemonTime: 1500,   // Speed Demon window in ms

    // ── Typing Penalties (tiered, only highest tier applies) ──
    keyDustMult: 0.1,       // Key Dust: -10% of Base Hit (1–2 backspaces)
    signalNoiseMult: 0.2,   // Signal Noise: -20% of Base Hit (3–4 backspaces)
    commsDriftFlat: -30,    // Comms Drift: flat -30 (5–6 backspaces)
    staticJamFlat: -50,     // Static Jam: flat -50 (7+ backspaces)

    // ── Perfect Shot Streak Milestones ──
    streakMilestones: [
        { threshold: 5,  bonus: 75,   text: 'LOCKED IN' },
        { threshold: 8,  bonus: 150,  text: 'EXCELLENT' },
        { threshold: 15, bonus: 400,  text: 'UNSTOPPABLE' },
        { threshold: 25, bonus: 1000, text: 'LEGEND' }
    ],

    // ── Kill-Streak Multiplier Steps ──
    killStreakSteps: [
        { min: 0,  max: 2,        mult: 1.0,  text: '' },
        { min: 3,  max: 4,        mult: 1.1,  text: '' },
        { min: 5,  max: 7,        mult: 1.2,  text: 'WARMING UP' },
        { min: 8,  max: 14,       mult: 1.35, text: 'ON FIRE' },
        { min: 15, max: 24,       mult: 1.5,  text: 'UNSTOPPABLE' },
        { min: 25, max: Infinity,  mult: 1.75, text: 'LEGEND MODE' }
    ],

    // ── Micro-Rewards ──
    calibrationInterval: 500,  // Calibration Bonus every 500 pts within a rank
    calibrationFlat: 50,       // Flat +50 on calibration
    comebackTarget: 3,         // Destroy 3 asteroids after base loss for Comeback
    comebackFlat: 25,          // Flat +25 Comeback Bonus
    firstBloodFlat: 25,        // First asteroid destroyed in session
    rankUpMult: 2,             // Rank-Up Bonus: 2x new rank's Base Hit
    nearMissFlat: 15,          // Near-Miss Save: target in bottom 10% of screen
    nearMissThreshold: 0.90,   // Bottom 10% = y > 90% of screen height

    // ── Debris Strike ──
    // A target that lands on a zone already reduced to rubble. There's nothing
    // left to destroy, so it never counts as a base loss — but the call still
    // got through, and a call that gets through costs points.
    debrisStrikeMult: 0.25,     // -25% of Base Hit, clamped by maxPenalty

    // ── Penalty Caps ──
    maxPenalty: -300,           // No single event deducts more than -300
    penaltyCap: -300            // Consecutive base destruction cap
};

// ============================================
// SATELLITE BANNER BONUS
// A satellite tows a beach-plane style banner across the sky. The banner shows
// the long form of a CAD shorthand ("Police Department Notified"); the player
// scores by typing the shorthand itself ("/PDN") before it leaves the screen.
// Phrases + point values come from datasets/shorthand.csv.
// ============================================

const SATELLITE = {
    enabled: true,

    // ── Spawn cadence (random timer, ms) ──
    // Measured spawn-to-spawn, not clear-to-spawn — see maintainSatellite().
    spawnMinMs: 25000,
    spawnMaxMs: 40000,
    firstSpawnMinMs: 10000,     // first flyby of a run comes sooner
    firstSpawnMaxMs: 18000,

    // ── Flight ──
    // Crosses the top of the sky, entering off-screen from the right. Speed
    // rides the same per-rank multiplier as the asteroids (progression.csv), so
    // the flyby tightens as the game gets faster. Rough screen times, tail in:
    //   TRAINEE ~16-24 s   SIGNED OFF ~11-16 s   FULL TIME ~6-8 s   O.A.S ~3-5 s
    entrySide: 'right',         // 'right' | 'left' | 'random' — edge it flies in from
    speed: 170,                 // virtual units/sec at 1.0x rank speed
    speedScaling: 1.0,          // 0 = ignore rank entirely, 1 = full rank multiplier
    maxSpeed: 700,              // safety rail only — lower it to ease off the top ranks
    altitudeMin: 100,           // top band of the sky, well clear of the defense zones
    altitudeMax: 200,
    driftAmplitude: 6,          // gentle vertical bob of the satellite itself
    driftSpeed: 0.9,

    // ── Scoring ──
    defaultPoints: 250,         // used when shorthand.csv omits the Points column
    streakCap: 5,               // max multiplier — catch 5 in a row for 5x
    resetStreakOnMisfire: true, // a wrong /shorthand also drops the multiplier

    // ── Sprite orientation ──
    // The source art draws the dish pointing up, so flipping on the x axis aims
    // it at the earth; the tilt then angles it into the direction of travel.
    flipY: true,
    rotationDeg: 45,            // clockwise; negate to tilt the other way

    // Sprite-local anchors, in the SVG's own 128x96 viewBox coordinates.
    // Retarget these if the sprite art is ever swapped out.
    dishX: 64, dishY: 15,       // mouth of the dish — radio signal emits from here
    lampX: 56, lampY: 36,       // red warning light on the hull

    // ── Dish radio signal ──
    signalArcs: 3,              // concurrent expanding arcs
    signalPeriod: 1.6,          // seconds for one arc to travel out and fade
    signalInner: 7,             // starting radius, game units
    signalReach: 26,            // how far an arc travels before it dies
    signalSpread: 0.62,         // half-angle of the cone, radians
    signalColor: '120, 220, 255',

    // ── Beacon blink ──
    blinkPeriod: 1.1,           // seconds per on/off cycle
    blinkDuty: 0.32,            // fraction of the cycle the lamp is lit
    blinkRadius: 4.5,

    // ── Banner burn-up (a claimed banner detaches and falls) ──
    debrisGravity: 150,         // units/sec^2
    debrisTerminal: 125,        // fall speed cap — keeps it floating, not plummeting
    debrisDrag: 0.8,            // horizontal bleed-off per second
    debrisSpin: 2.4,            // max tumble, rad/sec
    debrisBurnMin: 2.2,         // seconds for one strip to char away
    debrisBurnMax: 4.0,
    debrisIgniteSpread: 0.7,    // stagger, so the fire runs along the banner
    debrisSwayAmp: 30,          // paper-like flutter, units/sec
    debrisSwaySpeed: 2.6,
    debrisFlakeRate: 7,         // average embers shed per strip per second

    // ── Banner geometry ──
    spriteW: 96,
    spriteH: 72,
    towLineLength: 70,
    bannerHeight: 38,
    charSpacing: 21,
    bannerPadding: 14,
    waveAmplitude: 8,           // ribbon ripple, in virtual units
    waveLength: 110,
    waveSpeed: 3.0
};

// ============================================
// CARD SHORTHAND — the paid lifeline
// Typing "CARD SHORTHAND" mid-flight reveals the code the banner is asking for.
// Play does not pause, the card only clears when that code is typed, and asking
// always costs the streak. Clear it in time and the banner dies for zero points;
// let it escape and the tower takes a hit plus a rank-scaled points penalty.
// See handleCardHelp() / resolveCardHelp() in script.js.
// ============================================

const CARD_HELP = {
    enabled: true,

    // Every accepted phrasing must be prefixed with CARD, so a panicking player
    // has several ways in but can't trip it by accident. Matched after the input
    // is trimmed + upper-cased; punctuation and extra spaces are stripped first.
    triggers: [
        'CARD SHORTHAND',
        'CARD SHORTHAND COMMENT',
        'CARD SHORTHANDS',
        'CARD SHORT HAND',
        'CARD SHORT HAND COMMENT',
        'CARD SH',
        'CARD HELP',
        'CARD'
    ],

    // ── Cost ──
    resetStreak: true,          // asking always zeroes the streak, win or lose
    scoreOnRescue: 0,           // points for a card-assisted kill — the whole point is zero
    // Failure penalty = tier impactPenalty × this. -50 at Trainee → -600 at O.A.S
    // becomes -100 → -1200. Raise it to make a failed lifeline hurt more.
    failPenaltyMultiplier: 2,
    failDamage: 1,              // tower hit when the banner escapes with a card open

    // ── Presentation ──
    flashMs: 450                // success/failure flash on the card before it clears
};

// ============================================
// SATELLITE LASER
// The radio tower's answer to a banner. Typing the shorthand snaps a hitscan
// beam onto it; a bad /shorthand fires the same gun badly. Cosmetic only — the
// catch, the score and the misfire penalty are all settled before the beam
// exists, so a downed tower never costs the player a bonus.
// ============================================

const LASER = {
    enabled: true,

    // ── Clean shot ──
    duration: 0.28,             // seconds the beam stays lit
    coreWidth: 3.2,             // hot inner filament, virtual units
    glowWidth: 15,              // outer bloom
    color: '125, 212, 255',     // bonus blue — matches the catch explosion
    flicker: 0.22,              // brightness jitter per frame, 0 = rock steady
    muzzleFlash: 26,            // bloom radius at the tower
    impactFlash: 34,            // bloom radius at the banner

    // ── Misfire ──
    // The gun still goes off, it just goes off badly: the beam leaves the muzzle
    // off axis, breaks up, and dies short of whatever it was pointed at.
    misfireDuration: 0.42,
    misfireColor: '255, 96, 60',
    misfireSkewMin: 0.10,       // angular error, radians
    misfireSkewMax: 0.30,
    misfireReachMin: 0.25,      // fraction of the way to the target it manages
    misfireReachMax: 0.55,
    misfireSegments: 7,         // beam is chopped into this many pieces...
    misfireGapChance: 0.45,     // ...each with this chance of being blanked out
    misfireStutter: 26,         // times/sec the break pattern is re-rolled
    misfireWander: 7,           // how far the far end of the beam thrashes

    // ── Sparks (misfire only) ──
    sparkCount: 16,             // shed at the muzzle and again where it breaks
    sparkSpread: 0.5,           // half-angle of the spray cone, radians
    sparkSpeed: 210,            // units/sec
    sparkGravity: 340,
    sparkLifeMin: 0.35,
    sparkLifeMax: 0.85,

    // ── Empty sky ──
    // A /shorthand typed with no banner up still pulls the trigger; with nothing
    // to aim at the shot just goes wide of vertical.
    straySpread: 0.5,           // radians either side of straight up
    strayReach: 320
};

const godMode = {
    clickToDestroy: true,   // Left-click asteroid to fire / destroy
    godModeKill: true,      // Kill asteroids even when tower is down
    destroyZones: true,     // Double-click to destroy zones/tower
    redirectAsteroid: true, // Right-click to redirect asteroids
    // Active data pools (initialized when God Mode menu is built)
    activeCommands: null,   // Set of command codes: 'AP','ENP','BSE','LA'
    activeUnits: null,      // Set of unit IDs
    activeBases: null,      // Set of base codes
    targetableZones: null,  // Set of defense zone IDs that asteroids can target
    overrideTier: null      // When set, locks the rank — bypasses score-based promotion
};

const LAYOUT = {
    gorgeY: 85,
    plateauY: 110,
    towerY: 140
};

// Virtual coordinate system — all game logic runs in this space.
// JS scales canvas pixels to match on every resize.
const COORD_SYSTEM = { width: 1600, height: 900 };
let canvasScaleX = 1, canvasScaleY = 1;

const TIERS = {
    trainee:        { label: "TRAINEE",          min: 0,     max: 2000,     speedMin: 0.6, speedMax: 0.8, spawnMin: 5000, spawnMax: 6500, maxTargets: 6,  baseHit: 100,  impactPenalty: -50,  asteroidRadius: 20, projectileSpeed: 800 },
    mentoring:      { label: "MENTORING",        min: 2001,  max: 5000,     speedMin: 0.8, speedMax: 1.0, spawnMin: 4500, spawnMax: 5500, maxTargets: 8,  baseHit: 125,  impactPenalty: -60,  asteroidRadius: 19, projectileSpeed: 850 },
    signedoff:      { label: "SIGNED OFF",       min: 5001,  max: 10000,    speedMin: 1.0, speedMax: 1.2, spawnMin: 4000, spawnMax: 5000, maxTargets: 10, baseHit: 200,  impactPenalty: -100, asteroidRadius: 18, projectileSpeed: 900 },
    outofprobation: { label: "OUT OF PROBATION", min: 10001, max: 20000,    speedMin: 1.2, speedMax: 1.4, spawnMin: 3500, spawnMax: 4000, maxTargets: 12, baseHit: 300,  impactPenalty: -150, asteroidRadius: 17, projectileSpeed: 1000 },
    "2yearsin":     { label: "2 YEARS IN",       min: 20001, max: 35000,    speedMin: 1.5, speedMax: 1.8, spawnMin: 3000, spawnMax: 3500, maxTargets: 14, baseHit: 450,  impactPenalty: -225, asteroidRadius: 16, projectileSpeed: 1100 },
    fulltime:       { label: "FULL TIME",        min: 35001, max: 55000,    speedMin: 1.8, speedMax: 2.2, spawnMin: 2500, spawnMax: 3000, maxTargets: 16, baseHit: 600,  impactPenalty: -300, asteroidRadius: 15, projectileSpeed: 1200 },
    veteran:        { label: "VETERAN",          min: 55001, max: 80000,    speedMin: 2.5, speedMax: 3.0, spawnMin: 1500, spawnMax: 2000, maxTargets: 20, baseHit: 850,  impactPenalty: -500, asteroidRadius: 14, projectileSpeed: 1300 },
    oas:            { label: "O.A.S",            min: 80001, max: Infinity, speedMin: 3.0, speedMax: 4.0, spawnMin: 800,  spawnMax: 1200, maxTargets: 25, baseHit: 1200, impactPenalty: -600, asteroidRadius: 13, projectileSpeed: 1400 }
};

// ============================================
// TETHER PHYSICS (Tractor Beam System)
// ============================================

const TETHER = {
    springConstant: 0.55,   // Cranked from 0.15. Creates an aggressive, immediate snap-back.
    repulsionForce: 0.25,   // Dropped from 2.4. Converts the violent collision wall into a soft, overlapping nudge.
    tetherVisibleDistance: 45,
    friction: 0.50,         // Dropped from 0.74. Heavy inertial dampening kills the wobbly pendulum effect.
    hoverOffset: 40,
    energyFlowSpeed: 80
};

// ============================================
// ASTEROID COLOR PALETTE (CAD-Safe: No Blue)
// Blue = "Unit Attached" in CAD — cannot use for threats
// ============================================

const ASTEROID_COLORS = {
    // 6 distinctly different green shades — no two alike
    0: { accent: '#00ff66', glow: '#00cc44', bg: 'rgba(0, 200, 80, 0.12)' },   // emerald green
    1: { accent: '#7fff00', glow: '#66cc00', bg: 'rgba(100, 220, 0, 0.12)' },   // chartreuse
    2: { accent: '#00ffaa', glow: '#00cc88', bg: 'rgba(0, 200, 140, 0.12)' },   // seafoam / aqua-green
    3: { accent: '#39ff14', glow: '#2bcc10', bg: 'rgba(50, 255, 20, 0.12)' },   // neon green
    4: { accent: '#88ff44', glow: '#66cc22', bg: 'rgba(120, 230, 50, 0.12)' },  // yellow-green / lime
    5: { accent: '#00e5a0', glow: '#00b87d', bg: 'rgba(0, 190, 130, 0.12)' },   // jade / teal-green
};

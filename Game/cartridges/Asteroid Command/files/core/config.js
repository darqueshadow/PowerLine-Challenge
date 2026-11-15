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
    // Target pick weights (spawnAsteroid): live zone 1.0, tower 1.0, a zone already
    // reduced to rubble this much. Lower = fewer calls aimed at dead zones.
    deadZoneWeight: 0.5,
    asteroidRadius: 20,
    zoneHeight: 50,
    projectileSpeed: 800,
    ambulanceSpeed: 400,
    beamDuration: 2000,
    shieldRegenStreak: 5,
    altitudeThreshold: 0.25,
    isHolodeck: false,
    isBeta: false,
    // Dev gates are stored as digests, never as the phrases themselves — this
    // file is downloaded by every visitor to the public Pages site, so a
    // cleartext phrase here is a phrase published to the web. See plcDigest().
    devModePasswordHash: "f3db31a4bace08cd193b3e72d0477fcb",
    devModeTimeout: 10000,
    holodeckPasswordHash: "8355ec7fb3deaa068839b665fcbe747c",
    holodeckTimeout: 15000
};

// ── Dev-gate digest ───────────────────────────────────────────────────────────
// Salted, iterated FNV-1a. Deliberately synchronous: the cartridge must run from
// a double-clicked file:// page, where crypto.subtle cannot be relied on.
//
// ⚠️ This is obfuscation, NOT security, and it is not trying to be. The whole
// check runs in the browser, so anyone reading the source can skip it and set
// CONFIG.isBeta directly. The only thing it buys — and the only thing it needs
// to buy — is that the unlock phrases are no longer sitting in cleartext in a
// file served to the public internet. Do not treat this as protecting anything
// of value, and never reuse this helper for a real secret.
//
// To change a phrase: run plcDigest('YOUR NEW PHRASE') in the browser console
// and paste the result above. Input is trimmed and upper-cased before hashing,
// so the comparison matches the old behaviour exactly.
function plcDigest(s) {
    let out = '';
    for (let round = 0; round < 4; round++) {
        let h = 0x811c9dc5;
        const src = 'plc:' + round + ':' + String(s).trim().toUpperCase();
        for (let i = 0; i < src.length; i++) {
            h ^= src.charCodeAt(i);
            h = Math.imul(h, 0x01000193) >>> 0;
        }
        out += ('0000000' + h.toString(16)).slice(-8);
    }
    return out;
}

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
    calibrationInterval: 500,  // Calibration Bonus each time the run's score first reaches a new multiple of 500
    calibrationFlat: 50,       // Flat +50 on calibration
    comebackTarget: 3,         // Destroy 3 asteroids after base loss for Comeback
    comebackFlat: 25,          // Flat +25 Comeback Bonus
    firstBloodFlat: 25,        // First asteroid destroyed in session
    rankUpMult: 2,             // Rank-Up Bonus: 2x new rank's Base Hit, first time each rank is reached in a run
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
// RANK MOVEMENT
// Rank follows performance, not score. The per-rank numbers (fall time, spawn
// interval, target cap, satellite speed) live in datasets/progression.csv;
// these four decide when the player moves between those rows.
//   Promote one rank when EITHER
//     PACE     — the average gap between the last `paceWindow` clears is at or
//                under the NEXT rank's average spawn interval, with at least
//                `paceMinClears` clears since the last rank change; or
//     PRESSURE — `pressureSeconds` at the current rank with no target landing.
//   Demote one rank every time a target lands (never below the first rank).
//   A rank change resets the pace history and the pressure timer. Neither
//   clock runs while the game is paused or the tower cannot fire.
// ============================================

const RANKING = {
    paceWindow: 6,              // clears averaged for the pace check
    paceMinClears: 4,           // clears needed at a rank before pace can promote (the window resets on
                                // rank change, so with paceWindow 6 it takes 6 fresh clears either way)
    pressureSeconds: 60,        // seconds without a landing that promotes
    emptySkyDelaySec: 1.0       // empty sky: next target after this, or the rank's interval if shorter
};

// ============================================
// MENUS — mute, attract mode, high score board, Trainer
// Cartridge menu standard: the main menu is BEGIN MISSION + TRAINER only.
// ============================================

const MENU = {
    // One mute key (music + sound effects together). Works on the title screen,
    // in menus and in the pause menu; never during play, where every key types
    // into the Command Box. Saved in localStorage under muteStorageKey.
    muteKey: 'm',
    muteStorageKey: 'ac_muted',

    // Attract mode: the title screen sits idle for titleIdleMs, then shows the
    // high score board for boardMs, then a short how-to card for howtoMs, then
    // returns to the title and repeats. Any key goes back to the title screen.
    attract: {
        titleIdleMs: 10000,
        boardMs: 8000,
        howtoMs: 8000
    },

    // High score board: entries shown (and needed to qualify), call sign length.
    boardSize: 10,
    callSignMax: 10,
    scoresStorageKey: 'asteroid-command-scores',

    // Trainer → DRILL: the items on offer (one per drill, never combined).
    // AP/ENP/BSE/LA are commands.csv codes; SHORTHAND is the satellite banners.
    drillItems: ['AP', 'ENP', 'BSE', 'LA', 'SHORTHAND'],
    // On any miss the correct command is shown this long.
    drillShowCommandMs: 2000,
    drillMostMissedShown: 5,          // rows on the end-of-drill summary card
    drillBannerGapMs: 800             // SHORTHAND drill: pause before the next banner
};

// ============================================
// DEBRIS STRIKE IMPACT — a target landing on a zone that is already rubble
// Visual + feel only; the penalty lives in SCORING.debrisStrikeMult.
// Everything here runs on elapsed time (seconds), never per-frame counts.
// ============================================

const DEBRIS_STRIKE = {
    maxParticles: 160,          // hard cap across every burst on screen
    dustCount: 34,              // dust puffs per strike
    dustSpeedMin: 40,           // units/s, outward
    dustSpeedMax: 170,
    dustLifeMin: 0.7,           // seconds
    dustLifeMax: 1.3,
    dustRadiusMin: 5,
    dustRadiusMax: 12,
    dustGrowth: 22,             // radius growth, units/s, as the cloud spreads
    dustDrag: 1.8,              // velocity lost per second (fraction)
    chunkCount: 7,              // rubble chunks thrown up
    chunkSpeedMin: 200,         // units/s, upward
    chunkSpeedMax: 340,
    chunkSpread: 140,           // units/s, sideways either way
    chunkGravity: 760,          // units/s^2, so they fall back down
    chunkLife: 1.6,             // seconds
    chunkSizeMin: 3,
    chunkSizeMax: 7,
    ringRadius: 95,             // dust shock ring, final radius
    ringLife: 0.45,             // seconds
    shakeSec: 0.3,              // screen shake length (none under reduced motion)
    shakeAmp: 6,                // virtual units at the start, easing to 0
    sound: 'towerDown'          // reuses the 40 Hz boom: the heaviest thud in the set
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
    // Crosses the top of the sky, entering off-screen from the right. Speed is
    // `speed` x the rank's own Satellite Speed column in progression.csv
    // (0.70x at Trainee up to 1.60x at O.A.S), so the flyby tightens as the
    // player ranks up. It no longer shares a multiplier with the asteroids,
    // whose fall time is set in plain seconds per rank.
    entrySide: 'right',         // 'right' | 'left' | 'random' — edge it flies in from
    speed: 170,                 // virtual units/sec at a 1.00x Satellite Speed
    speedScaling: 1.0,          // 0 = ignore the rank's Satellite Speed, 1 = apply it in full
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
    overrideTier: null      // When set, locks the rank — bypasses pace/pressure promotion and impact demotion
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
    trainee:        { label: "TRAINEE",          order: 0, fallMin: 30, fallMax: 34, spawnMin: 12500, spawnMax: 14500, maxTargets: 4, satelliteMult: 0.7, baseHit: 100, impactPenalty: -50, asteroidRadius: 20, projectileSpeed: 800 },
    mentoring:      { label: "MENTORING",        order: 1, fallMin: 26, fallMax: 30, spawnMin: 9800, spawnMax: 11200, maxTargets: 4, satelliteMult: 0.8, baseHit: 125, impactPenalty: -60, asteroidRadius: 19, projectileSpeed: 850 },
    signedoff:      { label: "SIGNED OFF",       order: 2, fallMin: 22, fallMax: 26, spawnMin: 7800, spawnMax: 8800, maxTargets: 5, satelliteMult: 0.9, baseHit: 200, impactPenalty: -100, asteroidRadius: 18, projectileSpeed: 900 },
    outofprobation: { label: "OUT OF PROBATION", order: 3, fallMin: 19, fallMax: 22, spawnMin: 6200, spawnMax: 7000, maxTargets: 5, satelliteMult: 1.0, baseHit: 300, impactPenalty: -150, asteroidRadius: 17, projectileSpeed: 1000 },
    "2yearsin":     { label: "2 YEARS IN",       order: 4, fallMin: 16, fallMax: 18.5, spawnMin: 4900, spawnMax: 5600, maxTargets: 6, satelliteMult: 1.15, baseHit: 450, impactPenalty: -225, asteroidRadius: 16, projectileSpeed: 1100 },
    fulltime:       { label: "FULL TIME",        order: 5, fallMin: 13.5, fallMax: 15.5, spawnMin: 3900, spawnMax: 4500, maxTargets: 6, satelliteMult: 1.3, baseHit: 600, impactPenalty: -300, asteroidRadius: 15, projectileSpeed: 1200 },
    veteran:        { label: "VETERAN",          order: 6, fallMin: 11.5, fallMax: 13, spawnMin: 3100, spawnMax: 3600, maxTargets: 7, satelliteMult: 1.45, baseHit: 850, impactPenalty: -500, asteroidRadius: 14, projectileSpeed: 1300 },
    oas:            { label: "O.A.S",            order: 7, fallMin: 9.5, fallMax: 11, spawnMin: 2500, spawnMax: 2900, maxTargets: 7, satelliteMult: 1.6, baseHit: 1200, impactPenalty: -600, asteroidRadius: 13, projectileSpeed: 1400 }
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

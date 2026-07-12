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

    // ── Penalty Caps ──
    maxPenalty: -300,           // No single event deducts more than -300
    penaltyCap: -300            // Consecutive base destruction cap
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

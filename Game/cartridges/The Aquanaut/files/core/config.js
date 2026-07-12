/* ========================================================
   THE AQUANAUT — BELOW THE BLACK — CONFIG MODULE
   Deep-sea saturation diver typing defense game
   ======================================================== */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    // Dive Bell (replaces shield/tower)
    maxHullIntegrity: 9,
    hpPerHullLayer: 3,
    misfireDamage: 1,        // Pressure spike on mistype
    impactDamage: 3,         // Creature reaches hose
    creatureRadius: 22,
    hoseHeight: 50,
    sonarPulseSpeed: 700,    // Slower than space projectiles — water resistance
    rovSpeed: 300,           // ROV is slower than ambulance was
    sonarDuration: 2000,
    hullRegenStreak: 5,      // Streak to trigger hull self-repair
    altitudeThreshold: 0.25, // "Depth threshold" for early intercept bonus
    isHolodeck: false,
    isBeta: false,
    // Multi-part creature rigs (Option B). When true, missing rig art is replaced
    // by procedural placeholder parts so articulation is visible before the Gemini
    // creature art lands. Leave false in normal play — creatures without loaded rig
    // art fall back to the existing single-sprite render (no visual change).
    devRigPlaceholders: false,
    devModePassword: "ABYSS",
    devModeTimeout: 10000,
    holodeckPassword: "RED RABBIT",
    holodeckTimeout: 15000,
    // Visibility cone
    baseConeAngle: 55,       // Degrees — full cone width at Tier 1
    minConeAngle: 20,        // Degrees — smallest cone at deepest tier
    coneRange: 450,          // Virtual units — how far the headlamp reaches
    // Creature latching
    latchDamageInterval: 2000, // ms between latch damage ticks
    latchDamageAmount: 1,      // HP per tick while latched
    // After a non-latcher (shark/moray) strikes a hose it peels away and bolts
    // off the nearer side edge instead of vanishing on contact.
    fleeSpeedMult: 2.6         // flee speed ÷ its approach speed
};

// ============================================
// TOC GATE — offload timing FALLBACK (the per-tier CSV columns "TOC Offload (Min/Max sec)"
// override this). A TOC target's box flips White → Pink/Blue on random timing and is only
// clearable (the two-step TOC→AVA) once Blue. This is the delay PER colour flip, so the
// time for a unit to become active is ~one flip (direct → Blue) to two flips (via Pink).
// ============================================
const TOC_GATE = {
    minMs: 40000,   // shortest delay before the box flips to its next gate colour (40 s)
    maxMs: 120000   // longest delay (2 min)
};

// ============================================
// TOC DRIFT — once a TOC unit goes live (Blue/offloaded) it leaves its seabed patrol
// and slowly creeps toward the Aquanaut, then holds just outside the diver. A single
// non-tiered cartridge KNOB (TOC_GATE-style) — the creep reads the same at every depth.
// pxPerSec is deliberately SLOWER than the slowest normal attacker (~11–17 px/s at the
// surface tier) so it always reads as a lazy drift, never an attack run.
// ============================================
const TOC_DRIFT = {
    pxPerSec: 14,   // constant approach speed of a live TOC unit charging the diver (virtual px/s)
    edgeGap: 16     // (legacy) clear space once held at standoff — live units now press to contact
};

// ============================================
// TOC ROAM — a NOT-yet-live TOC unit free-roams the bottom zone (Q4) like a fish:
// it wanders to random points across the FULL width of the band (all the way to both
// edges) at a gentle speed, picking a fresh destination on arrival. Replaces the old
// fixed back-and-forth patrol lane. Band = percent-down-screen (overridable per-tier by
// the "TOC Band Top/Bottom Y%" CSV columns); stays below the diver and on-screen so the
// 360° sonar sweep can still detect it.
// ============================================
const TOC_ROAM = {
    speedMin: 45,    // virtual px/s — slowest wander
    speedMax: 95,    // virtual px/s — fastest wander
    edgeMargin: 40,  // keep destinations this far from the L/R screen edges
    arriveDist: 30,  // px from a destination at which a new one is rolled
    repathMs: 4500,  // also re-roll a destination at least this often (anti-stall)
    // Mutual clearance: gap (virtual px) held between two TOC units ON TOP OF the
    // sum of their challenge-box half-widths, so the boxes themselves never touch.
    // When two roamers breach this, both peel away from each other (see 'tocRoam').
    clearPad: 44
};

// ============================================
// TOC ACTIVATION ZONES — where a TOC unit is allowed to go LIVE (Blue/offloaded)
// within Q4. Q4 is sliced into 8 equal horizontal columns: Q4-1 (left edge) … Q4-8
// (right edge). A unit may only commit while sitting in one of its allowed columns;
// until then it holds at the ready edge and swims toward the nearest allowed column.
// Each tier weights the four symmetric column PAIRS — [ {1,8}, {2,7}, {3,6}, {4,5} ],
// edge → centre. Surface units commit at the edges; as the dive deepens the weight
// shifts inward so deeper units can go live nearer the centre (Q4-4/Q4-5). Weights are
// relative (need not sum to 100); a 0 forbids that pair at that tier.
// ============================================
const TOC_ACTIVATION_ZONES = {
    bubblehopper:       [70, 30,  0,  0],   // edges only (Q4-1/8 70%, Q4-2/7 30%)
    rigwalker:          [40, 35, 25,  0],   // reaches Q4-3/6
    crushdepthoperator: [15, 30, 35, 20],   // reaches the centre, still outward-biased
    theaquanaut:        [10, 20, 30, 40]    // favours the centre (Q4-4/5)
};
// The column pairs the weights above map to, edge → centre (1-based Q4 column numbers).
const TOC_ZONE_PAIRS = [[1, 8], [2, 7], [3, 6], [4, 5]];

// ============================================
// COM RADIO CALL — the F3/"COM" comment bonus. At random idle intervals a single
// diving bell floats up from the bottom carrying a crew radio call (a statement with
// KEYWORDS). The player logs a comment with `COM <unit#> <comment>` (F3 inserts "COM ");
// the comment just has to contain every keyword (loose, case-insensitive, any order).
// PURE BONUS — answering scores; ignoring it (the bell drifts off the top) or fumbling
// it costs nothing. One bell at a time. Content lives in
// datasets/Gameplay/com_radio_calls.csv (columns: Statement, Trigger Words — pipe-separated).
// ============================================
const COM_CALL = {
    enabled: true,
    spawnMinMs: 18000,    // shortest idle gap before the next bell rises (no bell active)
    spawnMaxMs: 38000,    // longest idle gap
    riseSpeed: 40,        // virtual px/s the bell floats upward
    bobAmp: 9,            // px of gentle horizontal/vertical bob as it rises
    bobHz: 0.55,          // bob cycles per second
    bonus: 150,           // flat score awarded for a logged comment
    startXMin: 0.22,      // bell spawn column as a fraction of screen width …
    startXMax: 0.78,      // … kept off the very edges (clear of the canyon gutters)
    spriteSize: { w: 124, h: 172 },  // bell draw size in virtual px (aspect-matched to diving_bell.png, 1332×1855 ≈ 0.72 w/h)
    bubbleMaxWidth: 300,  // px wrap width for the radio-call statement bubble
    highlightKeywords: true,  // colour the keyword words inside the bubble (teaches what to type)
    // Drop a diving-bell PNG here and it's used automatically; until then a retro
    // procedural bell is drawn. (Like the pufferfish swim-sprite flow.)
    sprite: 'assets/diving_bell.png'
};

// ============================================
// ATTACKER LANES — spawn geometry + anti-jumble spacing (Q1–Q3 × Left/Right).
// The umbilical (3 hoses + diver) runs up the screen centre; attackers enter from a
// side edge and swim inward along their row to strike it. Six lanes total — three
// equal-quarter rows on each side (Q4, the bottom quarter, is NOT an attacker row —
// it belongs to the TOC patrol band, a separate system). Two spacing rules ride on this:
//   • Hard one-attacker-per-lane (a lane holds at most one target).
//   • Same-side adjacency stagger: a freshly-spawned target blocks its vertical
//     neighbours (row ±1, same side) from spawning until it crosses from the OUTER
//     half (edge side) into the INNER half (centre side) of its lane — a dynamic,
//     self-releasing gate that staggers adjacent entries in time. The other side is
//     unaffected. Q4 (TOC) is exempt from all of it.
// ============================================
const LANES = {
    rows: 3,            // attacker rows Q1–Q3 (Q4 = TOC band, excluded)
    rowBandFrac: 0.25,  // each row spans this fraction of screen height (equal quarters)
    rowOverlap: 15,     // px of spawn-Y bleed past a row line, so the grid doesn't read stiff
    outerFrac: 0.5,     // outer/inner split at this fraction of each side's half-width
                        //   → left boundary x = W·0.25 (400), right boundary x = W·0.75 (1200)
    // Per-row target preference (lifeline id → weight). Each lane heads for the lifeline
    // at its height; the aquanaut is the shared "either" pick for Q2/Q3, kept a low weight
    // so the Q2→diver dive (a steeper diagonal) stays occasional. Falls back to any live
    // target if the preferred ones are dead/filtered. Tunable.
    //   ids: gas=REGULATOR(Q1), liquid=HOT WATER(Q2), electrical=COMMS(Q2/Q3), aquanaut=diver
    rowTargets: {
        1: [['gas', 1]],
        2: [['liquid', 3], ['electrical', 3], ['aquanaut', 1]],
        3: [['electrical', 2], ['aquanaut', 3]]
    }
};

// ============================================
// SCORING MULTIPLIERS (loaded from scoring.csv)
// All bonuses/penalties are multipliers of the current depth's Base Hit value.
// ============================================

const SCORING = {
    // ── Base Scoring Multipliers ──
    perfectMult: 0.25,        // Clean Pulse: 25% of Base Hit (0 backspaces)
    earlyMult: 0.5,           // Deep Intercept: 50% of Base Hit (top 25% of screen)
    speedDemonMult: 0.15,     // Reflex Save: 15% of Base Hit (cleared < 1.5s after spawn)
    speedDemonTime: 1500,

    // ── Typing Penalties (tiered, only highest tier applies) ──
    keyDustMult: 0.1,         // Finger Slip: -10% of Base Hit (1–2 backspaces)
    signalNoiseMult: 0.2,     // Signal Garble: -20% of Base Hit (3–4 backspaces)
    commsDriftFlat: -30,      // Pressure Fog: flat -30 (5–6 backspaces)
    staticJamFlat: -50,       // Nitrogen Narcosis: flat -50 (7+ backspaces)

    // ── Clean Pulse Streak Milestones ──
    streakMilestones: [
        { threshold: 5,  bonus: 75,   text: 'DIALED IN' },
        { threshold: 8,  bonus: 150,  text: 'RAZOR SHARP' },
        { threshold: 15, bonus: 400,  text: 'UNSTOPPABLE' },
        { threshold: 25, bonus: 1000, text: 'ABYSSAL LEGEND' }
    ],

    // ── Kill-Streak Multiplier Steps ──
    killStreakSteps: [
        { min: 0,  max: 2,        mult: 1.0,  text: '' },
        { min: 3,  max: 4,        mult: 1.1,  text: '' },
        { min: 5,  max: 7,        mult: 1.2,  text: 'WARMING UP' },
        { min: 8,  max: 14,       mult: 1.35, text: 'FEEDING FRENZY' },
        { min: 15, max: 24,       mult: 1.5,  text: 'APEX PREDATOR' },
        { min: 25, max: Infinity,  mult: 1.75, text: 'LEVIATHAN MODE' }
    ],

    // ── Micro-Rewards ──
    calibrationInterval: 500,
    calibrationFlat: 50,
    comebackTarget: 3,
    comebackFlat: 25,
    firstBloodFlat: 25,
    rankUpMult: 2,
    nearMissFlat: 15,
    nearMissThreshold: 0.90,

    // ── Penalty Caps ──
    missPenalty: -50,    // flat score hit for a miss (command matched no creature); clamped to maxPenalty
    maxPenalty: -300,
    penaltyCap: -300
};

const godMode = {
    clickToDestroy: true,
    godModeKill: true,
    destroyZones: true,
    redirectCreature: true,
    activeCommands: null,
    activeUnits: null,
    targetableZones: null,
    overrideTier: null      // When set, locks the rank/depth — bypasses score-based promotion
};

const LAYOUT = {
    // Hose bundle runs vertically — these are Y positions in virtual coords
    hoseTopY: 60,       // Where hoses connect to dive bell
    hoseBundleY: 120,   // Center of hose bundle
    diveBellY: 40,      // Dive bell position (top of screen)
    aquanautY: 160      // Diver position (below bell)
};

// Virtual coordinate system — all game logic runs in this space.
// JS scales canvas pixels to match on every resize.
const COORD_SYSTEM = { width: 1600, height: 900 };
let canvasScaleX = 1, canvasScaleY = 1;

// ============================================
// DEPTH TIERS (4 dive career ranks)
// ============================================

const TIERS = {
    bubblehopper:         { label: "BUBBLE HOPPER",         min: 0,     max: 5000,     speedMin: 0.5, speedMax: 0.8, spawnMin: 7500, spawnMax: 10500, maxTargets: 3,  baseHit: 100,  impactPenalty: -50,  creatureRadius: 22, sonarSpeed: 700,  depth: 30,   depthMin: 0,    depthMax: 100,  coneAngle: 55 },
    rigwalker:            { label: "RIG WALKER",             min: 5001,  max: 20000,    speedMin: 0.9, speedMax: 1.3, spawnMin: 5400, spawnMax: 7500, maxTargets: 4,  baseHit: 250,  impactPenalty: -125, creatureRadius: 20, sonarSpeed: 850,  depth: 150,  depthMin: 100,  depthMax: 400,  coneAngle: 42 },
    crushdepthoperator:   { label: "CRUSH DEPTH OPERATOR",   min: 20001, max: 50000,    speedMin: 1.4, speedMax: 2.0, spawnMin: 3750, spawnMax: 5250, maxTargets: 3,  baseHit: 500,  impactPenalty: -275, creatureRadius: 17, sonarSpeed: 1000, depth: 500,  depthMin: 400,  depthMax: 1000, coneAngle: 30 },
    theaquanaut:          { label: "THE AQUANAUT",            min: 50001, max: Infinity, speedMin: 2.2, speedMax: 3.5, spawnMin: 1200, spawnMax: 2700, maxTargets: 4,  baseHit: 1000, impactPenalty: -550, creatureRadius: 15, sonarSpeed: 1200, depth: 1000, depthMin: 1000, depthMax: 4000, coneAngle: 20 }
};

// ============================================
// SONAR TETHER PHYSICS (heavier water feel)
// ============================================

const TETHER = {
    springConstant: 0.35,       // Slower snap-back — water resistance
    repulsionForce: 0.18,       // Softer collision — fluid dynamics
    tetherVisibleDistance: 50,
    friction: 0.65,             // Higher friction — heavy water dampening
    hoverOffset: 45,
    energyFlowSpeed: 50         // Slower energy pulse — travels through water
};

// ============================================
// CREATURE TYPES & COLORS
// Deep-sea bioluminescent palette
// ============================================

const CREATURE_TYPES = {
    greatWhite: {
        name: 'Great White',
        archetype: 'drift',
        color: { accent: '#8899aa', glow: '#667788', bg: 'rgba(100, 120, 140, 0.15)' },
        bodyStyle: 'greenscreen',
        spriteType: 'greatWhite',
        spriteSize: { w: 270, h: 181 },   // apex predator — largest target (aspect-correct for the 2528×1696 profile)
        swimAnim: 'shark',
        animFps: 3,          // flipbook speed when multi-frame art is present (else single frame holds)
        speedMult: 1.0,
        canLatch: false,
        spawnWeight: 50,
        minTier: 0,
        killCamId: 'greatWhite'
    },
    moray: {
        name: 'Moray',
        archetype: 'lunge',
        color: { accent: '#aab87f', glow: '#88996b', bg: 'rgba(110, 130, 90, 0.15)' },
        bodyStyle: 'greenscreen',
        spriteType: 'moray',
        spriteSize: { w: 164, h: 110 },   // smaller than the great white (aspect-correct for the 2528×1696 profile)
        swimAnim: 'moray',
        animFps: 5,          // flipbook speed when multi-frame art is present (else single frame holds)
        speedMult: 1.2,
        canLatch: false,
        spawnWeight: 30,
        minTier: 0,
        killCamId: 'moray'
    },
    boxJellyfish: {
        name: 'Box Jellyfish',
        archetype: 'drift',
        color: { accent: '#88ccdd', glow: '#66aacc', bg: 'rgba(80, 160, 200, 0.15)' },
        bodyStyle: 'greenscreen',
        spriteType: 'boxJellyfish',
        spriteSize: { w: 150, h: 201 },   // aspect-correct (portrait) for the 1792×2400 drift
        swimAnim: 'jellyfish',
        speedMult: 0.8,
        canLatch: true,
        spawnWeight: 20,
        // Tier 1 (Bubble Hopper) roster: Great White, Moray, Jellyfish (+ Pufferfish
        // for the TOC). The jellyfish spawns on Tier 1 for now. The former §8
        // depth-zone gating (minTier 1, "surface = pure predators") is shelved while
        // we finish Tier 1; the Box Jellyfish will likely return around level 3 — TBD.
        minTier: 0,
        killCamId: 'boxJellyfish'
    },
    // Tier 1 TOC signature. NOT part of the cross-screen roster — `spawnTocCreature`
    // references it directly, and spawnWeight 0 / minTier 99 keep getCreatureType()
    // from ever rolling it for a normal target. Two STATE frames (deflated / inflated),
    // not a flipbook — see `stateFrames` handling in drawGreenscreenCreature.
    pufferfish: {
        name: 'Pufferfish',
        archetype: 'drift',              // overridden to 'patrol' for TOC units in spawnTocCreature
        color: { accent: '#e8c46a', glow: '#caa24a', bg: 'rgba(220, 190, 110, 0.15)' },
        bodyStyle: 'greenscreen',
        spriteType: 'pufferfish',
        spriteSize: { w: 150, h: 82 },   // aspect-correct for the 2816×1536 source (1.833)
        stateFrames: true,               // frame 0 = deflated (default), 1 = inflated (offloaded/live)
        swimAnim: 'default',             // gentle bob + sway
        speedMult: 1.0,
        canLatch: false,
        spawnWeight: 0,                  // never selected by getCreatureType — TOC-only
        minTier: 99,                     // excluded from the regular per-tier roster
        killCamId: 'pufferfish'
    }
};

// ============================================
// CREATURE RIGS — Multi-part canvas composites (Option B)
// DATA ONLY — the swim/pivot logic lives in the theme layer (script.js).
// Each part is authored on the creature's full bounding box (spriteSize); the
// engine draws every part at the same origin and rotates/scales it about its
// normalized pivot. See files/assets/Aquanaut_Creature_Asset_Contract.md.
//   pivot: [px, py]  normalized 0..1 over the bounding box (the joint)
//   anim:  which engine motion the part rides (tailBeat / jawSnap / bellPulse / …)
//   required: parts that must load for the rig to activate (else single-sprite fallback)
// ============================================

const CREATURE_RIGS = {
    greatWhite: {
        spriteSize: { w: 200, h: 112 },
        nativeFacing: 'left',
        required: ['body', 'tail'],
        zOrder: ['pectoral', 'body', 'tail', 'jaw'],
        parts: {
            pectoral: { src: 'assets/Tier 1/Targets/rig/greatwhite_pectoral.png', pivot: [0.55, 0.60], anim: 'finTilt',  amp: 0.10, freq: 1.6 },
            body:     { src: 'assets/Tier 1/Targets/rig/greatwhite_body.png' },
            tail:     { src: 'assets/Tier 1/Targets/rig/greatwhite_tail.png',     pivot: [0.30, 0.50], anim: 'tailBeat', amp: 0.26, freq: 1.6 },
            jaw:      { src: 'assets/Tier 1/Targets/rig/greatwhite_jaw.png',       pivot: [0.16, 0.52], anim: 'jawSnap',  amp: 0.20 }
        }
    },
    moray: {
        spriteSize: { w: 210, h: 141 },
        nativeFacing: 'left',
        required: ['body', 'tail'],
        zOrder: ['body', 'tail', 'jaw'],
        parts: {
            body: { src: 'assets/Tier 1/Targets/rig/moray_body.png' },
            tail: { src: 'assets/Tier 1/Targets/rig/moray_tail.png', pivot: [0.28, 0.50], anim: 'tailBeat', amp: 0.20, freq: 3.0 },
            jaw:  { src: 'assets/Tier 1/Targets/rig/moray_jaw.png',  pivot: [0.12, 0.52], anim: 'jawSnap',  amp: 0.28 }
        }
    },
    boxJellyfish: {
        spriteSize: { w: 160, h: 160 },
        nativeFacing: 'left',
        required: ['bell'],
        zOrder: ['tentacles', 'bell'],
        parts: {
            tentacles: { src: 'assets/Tier 1/Targets/rig/boxjelly_tentacles.png', pivot: [0.50, 0.40], anim: 'tentacleTrail', amp: 0.13, freq: 1.2 },
            bell:      { src: 'assets/Tier 1/Targets/rig/boxjelly_bell.png',      pivot: [0.50, 0.22], anim: 'bellPulse',     amp: 0.10, freq: 1.2 }
        }
    }
};

// ============================================
// HOSE DEFINITIONS (3 hoses + aquanaut)
// ============================================

const HOSE_TYPES = {
    gas: {
        id: 'gas',
        label: 'REGULATOR',
        color: '#33ff66',
        damageColor: '#66ffaa',
        description: 'Breathing gas supply',
        damageEffect: 'bubbles',       // Bubbles streaming out
        severedEffect: 'suffocation',   // Screen fogs, suffocation timer
        hpMax: 1
    },
    liquid: {
        id: 'liquid',
        label: 'HOT WATER',
        color: '#ff8833',
        damageColor: '#ffaa55',
        description: 'Heated water supply',
        damageEffect: 'steamPlume',     // Steam/hot water plume leaking
        severedEffect: 'hypothermia',   // Frost/blue filter, diver shakes
        hpMax: 1
    },
    electrical: {
        id: 'electrical',
        label: 'COMMS LINE',
        color: '#ffdd33',
        damageColor: '#ffee88',
        description: 'Communications & power',
        damageEffect: 'sparks',         // Sparks/static arcing
        severedEffect: 'blind',         // No sonar feedback (type blind)
        hpMax: 1
    }
};

// Aquanaut — suit integrity (5 blocks = 5 seconds total, cumulative across all grapples)
const AQUANAUT = {
    id: 'aquanaut',
    label: 'THE AQUANAUT',
    color: '#ffffff',
    hpMax: 5,
    suitDrainInterval: 1000,  // ms between integrity block drops during grapple
    description: 'You. Suit integrity is your last defense — 5 seconds, no refills.'
};

// ============================================
// AMBIENT SEA LIFE — friendly background fish
// ============================================

const AMBIENT_FISH = [
    // 0–50m: Surface / Sunlit zone
    { name: 'Sardine',        maxDepth: 80,   minDepth: 0,   size: [6, 10],  speed: [40, 70],  color: '#8899aa', schoolSize: [4, 8],  bodyStyle: 'slim' },
    { name: 'Mackerel',       maxDepth: 100,  minDepth: 0,   size: [10, 16], speed: [50, 80],  color: '#6688aa', schoolSize: [3, 6],  bodyStyle: 'slim' },
    { name: 'Sea Turtle',     maxDepth: 120,  minDepth: 0,   size: [20, 30], speed: [15, 25],  color: '#558844', schoolSize: [1, 1],  bodyStyle: 'turtle' },
    { name: 'Manta Ray',      maxDepth: 150,  minDepth: 10,  size: [30, 45], speed: [20, 35],  color: '#445566', schoolSize: [1, 2],  bodyStyle: 'ray' },

    // 50–300m: Twilight zone
    { name: 'Lanternfish',    maxDepth: 400,  minDepth: 50,  size: [5, 8],   speed: [20, 40],  color: '#4477aa', schoolSize: [5, 12], bodyStyle: 'slim',  glow: '#66aaff' },
    { name: 'Hatchetfish',    maxDepth: 500,  minDepth: 100, size: [6, 10],  speed: [15, 30],  color: '#556677', schoolSize: [3, 6],  bodyStyle: 'round', glow: '#88bbcc' },
    { name: 'Squid',          maxDepth: 600,  minDepth: 80,  size: [12, 20], speed: [30, 55],  color: '#886666', schoolSize: [1, 3],  bodyStyle: 'squid' },
    { name: 'Swordfish',      maxDepth: 500,  minDepth: 50,  size: [22, 35], speed: [60, 90],  color: '#556688', schoolSize: [1, 1],  bodyStyle: 'slim' },

    // 300–1000m: Midnight zone
    { name: 'Bristlemouth',   maxDepth: 1500, minDepth: 200, size: [4, 7],   speed: [10, 20],  color: '#334455', schoolSize: [6, 15], bodyStyle: 'slim',  glow: '#4466aa' },
    { name: 'Vampire Squid',  maxDepth: 1500, minDepth: 500, size: [14, 22], speed: [8, 15],   color: '#552233', schoolSize: [1, 1],  bodyStyle: 'squid', glow: '#ff4466' },
    { name: 'Dumbo Octopus',  maxDepth: 4000, minDepth: 1000,size: [10, 18], speed: [5, 12],   color: '#885566', schoolSize: [1, 1],  bodyStyle: 'round', glow: '#cc88aa' },

    // 1000m+: Abyss
    { name: 'Giant Isopod',   maxDepth: 4000, minDepth: 700, size: [12, 18], speed: [3, 8],    color: '#555544', schoolSize: [1, 2],  bodyStyle: 'round' },
    { name: 'Snailfish',      maxDepth: 4000, minDepth: 1500,size: [8, 14],  speed: [5, 10],   color: '#aabbcc', schoolSize: [1, 2],  bodyStyle: 'slim',  glow: '#ddeeff' },
    { name: 'Comb Jelly',     maxDepth: 4000, minDepth: 500, size: [8, 14],  speed: [3, 8],    color: '#446688', schoolSize: [2, 5],  bodyStyle: 'round', glow: '#66ccff' }
];

// ============================================
// DEPTH BACKGROUND CONFIG
// ============================================

const DEPTH_COLORS = {
    surface:   { top: '#5bb8e8', bottom: '#2a7ab5' },    // 0-100m: bright sunlit water
    shallow:   { top: '#2a6a9a', bottom: '#143d5e' },     // 100-200m: fading daylight
    twilight:  { top: '#0c3050', bottom: '#061828' },     // 200-500m: twilight zone
    midnight:  { top: '#040e1a', bottom: '#01060c' },     // 500-700m: midnight
    abyss:     { top: '#010306', bottom: '#000000' }      // 700m+: the black
};

// ============================================
// CONSTANT-DESCENT ILLUSION (theme layer — see Aquanaut_Depth_Descent_Spec.md)
// Everything keys off a normalized depthRatio ∈ [0,1] derived from score/tier.
// Purely visual: nothing here touches scoring, spawning, or core logic.
// ============================================

const DESCENT = {
    // §1 depthRatio anchors = value at the START of each tier. Each tier eases
    // toward the next tier's anchor; the top tier ramps to 1.0 by topCeilingScore,
    // so the full abyss / wall-out is the deep-Aquanaut payoff (§4, §10).
    anchors: { bubblehopper: 0.00, rigwalker: 0.30, crushdepthoperator: 0.60, theaquanaut: 0.90 },
    topCeilingScore: 80000,

    // §3 parallax water column (upward scroll, speed scales with depth)
    baseSpeed: 90,            // virtual px/s the near layer scrolls up at the surface (master "descent speed" knob)
    speedDepthGain: 1.7,     // near-layer speed multiplier at full depth (faster = deeper)
    breatheAmt: 0.12,        // gentle ± speed variation so the winch isn't mechanical
    creepMetersPerSec: 0.8,  // depth gauge self-creep between scoring hits
    layers: [
        { mult: 0.30, count: 42, rMin: 0.4, rMax: 1.0, aMin: 0.05, aMax: 0.12, color: '150,180,205' }, // L1 far haze
        { mult: 1.35, count: 26, rMin: 0.5, rMax: 1.2, aMin: 0.10, aMax: 0.22, color: '205,225,240', streak: true }, // L2 near streaks
        { mult: 1.95, count: 12, rMin: 0.6, rMax: 1.5, aMin: 0.12, aMax: 0.24, color: '215,235,248', streak: true } // L3 very-near fast streaks (foreground parallax)
    ],
    bubbleCount: 14,         // sparse rising bubbles

    // §6 overhead god-rays — shrink + fade with depth, gone by the abyss
    rays: { count: 5, baseAlpha: 0.16, fadeByRatio: 1.15 },

    // §5 cold colour wash that deepens with depth (warm tones absorb first)
    tintColor: '6,16,30',
    tintMaxAlpha: 0.22,

    // §4 canyon walls in the screen-edge gutters
    walls: {
        gutter: 150,         // base inner-edge distance from each screen edge (VCS px)
        narrowGain: 70,      // extra inward squeeze at full depth (claustrophobia)
        scrollMult: 0.85,    // wall scroll speed relative to the near layer
        cellSize: 70,        // rock-jag cell height
        sampleStep: 26,      // vertical sampling resolution of the rock edge
        outStart: 0.82       // depthRatio where walls begin falling away into the void
    },

    // §9 vignette tightens with depth
    vignetteBaseAlpha: 0.16,
    vignetteDepthAlpha: 0.46,

    // §10 threshold transitions — a short scripted beat when a new zone is reached
    transitionDuration: 1.6,   // seconds the zone card holds on screen
    creakMinGap: 4.0,          // shortest gap (s) between hull creaks at full depth
    creakMaxGap: 13.0          // longest gap (s) between hull creaks, shallow
};

// §10 zone cards keyed by the tier being entered (depth = that tier's depthMin).
const ZONE_CARDS = {
    rigwalker:          { title: 'THE RIG',       sub: 'UPPER-MID WATER · 100 m',     accent: '#7fd4ff' },
    crushdepthoperator: { title: 'TWILIGHT ZONE', sub: 'THE SUNLIGHT FADES · 400 m',  accent: '#4fa8d8' },
    theaquanaut:        { title: 'THE ABYSS',     sub: 'NO WALLS · NO BOTTOM · 1000 m', accent: '#9a7fff' }
};

// ============================================
// HELMET INTERIOR SHELL — constructed (SVG/CSS) overlay, NOT an AI image.
// Armed at key moments only (deep-zone entry, hose damage); depth-reactive.
// Distinct from the kill-cam helmet POV (which is its own full-screen scene).
// ============================================

const HELMET = {
    defaultMs: 2600,     // how long the shell stays armed per moment
    zoneMs: 3000,        // zone-entry beat (slightly longer)
    damageMs: 2400,      // hose-damage beat
    fadeSpeed: 0.12,     // per-frame ease toward target intensity (0..1)
    vigBase: 0.30,       // edge vignette darkness at the surface
    vigDepth: 0.40,      // additional vignette at full depth (depthRatio = 1)
    fogBase: 0.05,       // interior fog/condensation at the surface
    fogDepth: 0.28       // additional fog at full depth
};

// ============================================
// KILL CAM CONFIG
// ============================================

const KILL_CAM = {
    fadeInDuration: 1500,     // ms — transition from gameplay to helmet view
    attackDuration: 4000,     // ms — the creature attack animation
    fadeOutDuration: 1000,    // ms — fade to black before game over screen
    helmetCrackStages: 3,    // Number of crack stages before breach
    visorTint: 'rgba(20, 60, 80, 0.3)'  // Slight green tint for dive helmet glass
};

// ============================================
// KILL SCREEN — one constructed helmet-POV plate, two death cinematics.
// Andrew's impact reframing (2026-06-19, cartridge-layer authorized): hoses = Zone
// Impact (3 zones; all 3 lost → CRUSH), the diver = Player Impact (3-second
// type-to-survive window → CREATURE). Regions are config over the swappable plate
// so the art can change without code edits. Measured on the 2752×1536 plate; the
// rounded faceplate mask + angled ports are pixel-tuned at render.
// ============================================

const KILL_SCREEN = {
    plate: 'assets/Kill Screen/kill_screen_POV.png',
    plateSize: { w: 2752, h: 1536 },

    // MASK MODE. 'procedural' = draw the diver helmet in canvas around a CLEAN visor, so the
    // cinematic fits the glass by construction (no spill onto the frame; visor shaped to suit
    // the portrait creature art). 'plate' = the legacy photographic kill_screen_POV.png.
    maskMode: 'procedural',
    // Procedural-mask geometry + look (all tunable; eyeball in-game and adjust).
    mask: {
        visorAspect: 0.92,   // visor width ÷ height (<1 = taller than wide → fits portrait creatures)
        visorScale: 0.76,    // visor height as a fraction of the helmet height reference
        visorMaxWFrac: 0.44, // hard cap: visor width ≤ this fraction of the canvas width
        centerYFrac: 0.50,   // visor centre Y as a fraction of canvas height
        round: 0.16,         // corner radius as a fraction of the visor's smaller side
        bezel: 0.085,        // metal bezel-ring thickness as a fraction of the visor's smaller side
        bolts: 16,           // rivets around the visor bezel (side ports get fewer)
        portScale: 0.34,     // side-port width as a fraction of visor width
        portHFrac: 0.66,     // side-port height as a fraction of visor height
        portGapFrac: 0.16,   // gap between visor edge and side-port inner edge (× visor width)
        metalDark: '#10161c', metalMid: '#222d35', metalLite: '#3c4c57'
    },

    // FACEPLATE FIT-ZONE — where the creature attack frame is composited.
    // If the plate art (kill_screen_POV.png) contains a pure chroma-green (#00FF00)
    // region painted over the glass opening, the engine auto-detects its bounding
    // box, uses it as the faceplate, and keys the green out to black. Paint a solid
    // green fill exactly where the creature should sit, then this just works. With
    // no green present, it falls back to regions.FACEPLATE_MASK below.
    faceplateChromaKey: true,

    // How the attack frame sits in the glass. The base fit on APPROACH:
    //   'contain' — the whole creature fits inside the glass (mostly visible)
    //   'cover'   — the creature fills the glass even while approaching
    // On the STRIKE it always surges past the glass (creatureStrikeFill) so the
    // body outside the faceplate is clipped away — a realistic lunge into the visor.
    faceplateFit: 'contain',
    creatureInset: 0.92,      // how much of the glass the creature fills at the END of its approach
    creatureStrikeFill: 2.1,  // size multiplier at full lunge — >1/inset so it overflows & clips

    // Regions as fractions of the plate (x, y, w, h)
    regions: {
        // Fallback fit-zone: the real glass is a wide landscape rounded window
        // (measured on the 2752×1536 plate). Overridden by a green region if present.
        FACEPLATE_MASK:   { x: 0.26, y: 0.25, w: 0.475, h: 0.44, round: 0.16 }, // primary kill canvas
        SIDE_PORT_MASK_L: { x: 0.01, y: 0.20, w: 0.13, h: 0.46, skew: -12 },   // peripheral glimpse
        SIDE_PORT_MASK_R: { x: 0.86, y: 0.20, w: 0.13, h: 0.46, skew: 12 },
        PANEL_SCREEN_RECTS: {
            left:  { x: 0.205, y: 0.10, w: 0.10, h: 0.135 },
            right: { x: 0.62,  y: 0.10, w: 0.13, h: 0.14  }
        }
    },

    // Engine repaints the panels (baked DEPTH/O2/TEMP + BATTERY/PRESS/COMMS/GPS ignored).
    // POWER and RADIO are two readouts of the one electrical line (Andrew: same thing).
    panels: {
        order: ['DEPTH', 'O2', 'POWER', 'WATER', 'RADIO'],
        hoseFor: { O2: 'gas', WATER: 'liquid', RADIO: 'electrical', POWER: 'electrical' } // DEPTH = info
    },

    // Terminal word per death (by creature, or crush). Locked set §0.9 (ratified 2026-06-21):
    // CRUNCH = ENGULFED · SNAP = BREACHED · STUNG = SHROUDED · FUGU = POISONED.
    terminalWords: { greatwhite: 'CRUNCH', moray: 'SNAP', jellyfish: 'STUNG', pufferfish: 'FUGU', crush: 'CRUSHED' },

    // Head-on attack frames for the CREATURE cinematic (true-alpha, composited in
    // the faceplate: front_closed lurks, front_open strikes). Keyed by death-event
    // creature id. Stable runtime home; the full swim-sprite migration is separate.
    creatures: {
        greatwhite: { closed: 'assets/Kill Screen/Tier 1/greatwhite_front_closed.png', open: 'assets/Kill Screen/Tier 1/greatwhite_front_open.png' },
        moray:      { closed: 'assets/Kill Screen/Tier 1/moray_front_closed.png',      open: 'assets/Kill Screen/Tier 1/moray_front_open.png' },
        jellyfish:  { closed: 'assets/Kill Screen/Tier 1/jellyfish_front_closed.png',  open: 'assets/Kill Screen/Tier 1/jellyfish_front_open.png' }
        // pufferfish uses the `poison` body path (KILL_SCREEN.pufferBody), not these front frames.
    },

    // ── Per-creature VIOLENT death behaviour for the kill cam ──
    // mode selects the render branch in script.js; the rest are tunables.
    //   devour   — ENGULFED: surges in, keeps pushing (down the throat) → held black-throat beat → word
    //   gnaw     — BREACHED: one puncture, then gnashes INSIDE the helmet; blood on the near side
    //   strangle — SHROUDED: multi-point oral-arm creep + heartbeat-ramp sting flashes → final whiteout
    //   poison   — POISONED: chuckle → puff-goes-wrong → radial-puncture cracks → toxin vision-corruption (double vision, desat, tunnel-in); no gore, no blackout (pufferfish/TOC)
    // strikeFill overrides the global creatureStrikeFill for that creature.
    behaviors: {
        greatwhite: { mode: 'devour',   strikeFill: 4.6, devourPush: 1.8, blood: 0.45 },
        moray:      { mode: 'gnaw',     strikeFill: 1.12, gnawHz: 5.5, blood: 1.0 },
        jellyfish:  { mode: 'strangle', strikeFill: 1.05, flashHz: 2.8, constrictRate: 0.55 },
        pufferfish: { mode: 'poison',   strikeFill: 1.35, toxRate: 0.5, blood: 0 }   // POISONED: cracks + vision corruption, no gore (§0.9)
    },

    // Pufferfish POISONED art (§0.9). `puncture` is a multi-point radial-puncture CRACK overlay
    // (screen-blended over the faceplate so its dark field drops out and only the cracks show;
    // stretched to the faceplate rect, so it auto-covers the green fit-zone). `pufferBody` is the
    // head-on puffer: deflated (the chuckle) → inflated (the puff-goes-wrong).
    puncture: 'assets/Kill Screen/Tier 1/pufferfish_radialpuncture.png',
    pufferBody: {
        deflated: 'assets/Kill Screen/Tier 1/pufferfish_front_deflated.png',
        inflated: 'assets/Kill Screen/Tier 1/pufferfish_front_inflated.png'
    },

    diverWindowMs: 3000,   // diver type-to-survive window (replaces the old 5-block suit drain)
    timings: { pushInMs: 1200, holdMs: 1600, fadeOutMs: 1000 }
};

// ============================================
// MUSIC SOUNDTRACK
// Drop matching MP3s into files/music/. Any missing file fails silently
// (playback just stays quiet for that slot), so partial sets are fine.
// One source of truth for filenames — wiring in script.js references these.
// ============================================

const MUSIC = {
    titleScreen: 'music/Aquanaut - Title Screen.mp3',  // boot / title screen — loops
    menu:        'music/Aquanaut - Menus.mp3',          // main + sub menus — loops
    gameplay: [                                         // in-dive shuffle (non-holodeck)
        'music/Jelly Fish Bop (Remastered).mp3'
    ],
    gameOver:    'music/Aquanaut - Game Over.mp3',      // game-over screen — loops
    volume: 0.5                                         // default music level (0–1)
};

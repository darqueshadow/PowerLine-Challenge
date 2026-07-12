/* ============================================
   ASTEROID COMMAND — SCRIPT.JS
   Scoring Engine / Precision Logic / Career Progression
   ============================================ */

// --- Visual Assets (Regional Landmarks) ---
const ASSETS = {
    radio_tower: new Image(),   // Central weapon
    skylon: new Image(),        // Niagara Falls landmark
    sab_plant: new Image(),     // NOTL - Sir Adam Beck Plant
    canal_bridge: new Image(),  // Thorold - Welland Canal Lift Bridge
    robin_hood_mill: new Image(), // Port Colborne - Robin Hood Flour Mill
    loaded: false
};

// Asset paths - Niagara Region landmarks
ASSETS.radio_tower.src = 'assets/radio_tower.png';
ASSETS.skylon.src = 'assets/skylon_tower.png';
ASSETS.sab_plant.src = 'assets/sab_plant.png';
ASSETS.canal_bridge.src = 'assets/canal_bridge.png';
ASSETS.robin_hood_mill.src = 'assets/robin_hood_mill.png';

// Track asset loading
let assetsToLoad = 5;
let assetsLoaded = 0;

function onAssetLoad() {
    assetsLoaded++;
    if (assetsLoaded >= assetsToLoad) {
        ASSETS.loaded = true;
        console.log('All regional landmark assets loaded.');
    }
}

ASSETS.radio_tower.onload = onAssetLoad;
ASSETS.skylon.onload = onAssetLoad;
ASSETS.sab_plant.onload = onAssetLoad;
ASSETS.canal_bridge.onload = onAssetLoad;
ASSETS.robin_hood_mill.onload = onAssetLoad;

// Handle load errors gracefully (fallback to primitives)
ASSETS.radio_tower.onerror = () => { console.warn('Failed to load radio_tower.png'); onAssetLoad(); };
ASSETS.skylon.onerror = () => { console.warn('Failed to load skylon_tower.png'); onAssetLoad(); };
ASSETS.sab_plant.onerror = () => { console.warn('Failed to load sab_plant.png'); onAssetLoad(); };
ASSETS.canal_bridge.onerror = () => { console.warn('Failed to load canal_bridge.png'); onAssetLoad(); };
ASSETS.robin_hood_mill.onerror = () => { console.warn('Failed to load robin_hood_mill.png'); onAssetLoad(); };

// --- Score-Based Difficulty Tiers ---
const SCORE_TIERS = {
    trainee:        { min: 0,     max: 2000,  maxAsteroids: 1, speedMult: 0.6,  spawnInterval: 5000 },
    mentoring:      { min: 2001,  max: 5000,  maxAsteroids: 2, speedMult: 0.7,  spawnInterval: 4000 },
    signedoff:      { min: 5001,  max: 10000, maxAsteroids: 3, speedMult: 0.85, spawnInterval: 3000 },
    outofprobation: { min: 10001, max: 20000, maxAsteroids: 5, speedMult: 1.0,  spawnInterval: 2500 },
    senior:         { min: 20001, max: Infinity, maxAsteroids: 8, speedMult: 1.3, spawnInterval: 1800 }
};

// --- Escalating Backspace Penalty Names ---
const PENALTY_NAMES = [
    { threshold: 1, penalty: 5, name: "KEY DUST" },
    { threshold: 2, penalty: 10, name: "SIGNAL NOISE" },
    { threshold: 3, penalty: 15, name: "INPUT LAG" },
    { threshold: 4, penalty: 20, name: "COMMS DRIFT" },
    { threshold: 5, penalty: 25, name: "STATIC JAM" }
];

// --- Game Configuration ---
const CONFIG = {
    baseSpawnInterval: 2500,
    minSpawnInterval: 800,
    baseMaxAsteroids: 1,
    maxMaxAsteroids: 10,
    baseTimeToImpact: 25000,
    minTimeToImpact: 2500,
    difficultyIncrease: 0.05,
    spawnReduction: 0.04,
    startingShields: 10,
    towerShieldMax: 3,
    shieldRegenStreak: 5,
    asteroidRadius: 20,
    zoneHeight: 50,
    projectileSpeed: 800,
    ambulanceSpeed: 400,
    beamDuration: 2000,
    // Scoring
    basePoints: 100,
    backspacePenalty: 5,
    maxBackspacePenalty: 25,
    perfectShotBonus: 20,
    altitudeBonus: 50,
    altitudeThreshold: 0.25,
    streakMultiplierInterval: 5,
    commendationThreshold: 10,
    commendationBonus: 500,
    // Tower Shield
    towerShieldRadius: 65
};

// --- Dataset Arrays (1-2-3 Rule) ---
const DATA_ACTIONS = [
    { c: "Assign", m: "AP", isHomeBase: false },
    { c: "Enroute", m: "ENP", isHomeBase: false },
    { c: "Arrive", m: "BSEH", isHomeBase: true },
    { c: "Local Area", m: "LA", isHomeBase: false }
];

const DATA_UNITS = [
    "2040", "2041", "2042", "2043", "2044", "2045", "2046",
    "2095", "2096", "2097", "2098", "2099", "2100", "2101",
    "2102", "2103", "2104", "2105", "2106", "2107", "2108",
    "2109", "2110", "2111", "2112", "2113", "2114", "2115",
    "2116", "2117", "2118", "2119", "2120", "2121", "2122",
    "2123", "2124", "2125", "2126", "2130", "2133", "2134",
    "2135", "2136", "2137", "2138", "2139", "2150", "2200",
    "2201", "2202", "2203", "2205", "2208"
];

const DATA_LOCATIONS = [
    { c: "Niagara Falls", m: "72100" },
    { c: "Ontario St", m: "72101" },
    { c: "Linwell", m: "72102" },
    { c: "Thorold", m: "72103" },
    { c: "NOTL", m: "72104" },
    { c: "Grimsby", m: "72105" },
    { c: "Port Colborne", m: "72107" },
    { c: "King St", m: "72108" },
    { c: "Smithville", m: "72109" },
    { c: "Vineland", m: "72110" },
    { c: "Pelham", m: "72111" },
    { c: "Ridgeway", m: "72113" },
    { c: "Glendale", m: "72115" },
    { c: "St Paul", m: "72116" },
    { c: "Fort Erie", m: "72117" },
    { c: "Merittville", m: "72118" },
    { c: "HQ", m: "72120" },
    { c: "Fitch St", m: "72121" },
    { c: "Westwood", m: "72122" },
    { c: "Fleet", m: "72123" },
    { c: "Fallsview", m: "72124" }
];

// --- Game State ---
const state = {
    running: false,
    score: 0,
    shields: CONFIG.startingShields,
    towerShields: CONFIG.towerShieldMax,
    streak: 0,
    streakSinceLastTowerHit: 0,
    currentTier: 'trainee',
    speedMultiplier: 0.6,
    currentSpawnInterval: CONFIG.baseSpawnInterval,
    currentMaxAsteroids: CONFIG.baseMaxAsteroids,
    asteroids: [],
    projectiles: [],
    explosions: [],
    defenses: [],
    towerDisabled: false,
    rebuilding: false,
    ambulance: null,
    beamActive: false,
    beamTimer: 0,
    lastSpawnTime: 0,
    usedChallenges: new Set(),
    // Precision tracking
    currentEntryBackspaces: 0,
    consecutiveCleanHits: 0,
    totalCleanHits: 0,
    // Difficulty progression
    difficultyLevel: 0
};

// --- DOM Elements ---
const DOM = {
    canvas: null,
    ctx: null,
    commandInput: null,
    scoreValue: null,
    shieldsValue: null,
    streakValue: null,
    statusMessage: null,
    startOverlay: null,
    gameOverOverlay: null,
    finalScore: null,
    tierDisplay: null,
    multiplierDisplay: null
};

// --- Initialize 5 Defenses (Regional Landmarks - Left to Right) ---
function initializeDefenses() {
    const w = DOM.canvas.width;
    const h = DOM.canvas.height;
    const y = h - CONFIG.zoneHeight;
    const spacing = w / 5;

    state.defenses = [
        { 
            id: 1, 
            type: 'zone', 
            name: "NOTL", 
            x: spacing * 0.5, 
            y: y, 
            width: 90, 
            height: 85,
            health: 1,
            asset: ASSETS.sab_plant  // Sir Adam Beck Hydroelectric Plant
        },
        { 
            id: 2, 
            type: 'zone', 
            name: "NIAGARA FALLS", 
            x: spacing * 1.5, 
            y: y, 
            width: 85, 
            height: 100,
            health: 1,
            asset: ASSETS.skylon  // Skylon Tower
        },
        { 
            id: 'tower', 
            type: 'tower', 
            name: "RADIO TOWER", 
            x: spacing * 2.5, 
            y: y, 
            width: 80, 
            height: 110,
            health: 1,
            asset: ASSETS.radio_tower  // The Weapon - Central Command
        },
        { 
            id: 3, 
            type: 'zone', 
            name: "THOROLD", 
            x: spacing * 3.5, 
            y: y, 
            width: 90, 
            height: 85,
            health: 1,
            asset: ASSETS.canal_bridge  // Welland Canal Lift Bridge
        },
        { 
            id: 4, 
            type: 'zone', 
            name: "PORT COLBORNE", 
            x: spacing * 4.5, 
            y: y, 
            width: 90, 
            height: 90,
            health: 1,
            asset: ASSETS.robin_hood_mill  // Robin Hood Flour Mill
        }
    ];
}

function getTower() {
    return state.defenses.find(d => d.type === 'tower');
}

// --- Challenge Generation (with BSEH Home Base Logic) ---
function generateChallenge() {
    const action = DATA_ACTIONS[Math.floor(Math.random() * DATA_ACTIONS.length)];
    const unit = DATA_UNITS[Math.floor(Math.random() * DATA_UNITS.length)];
    
    let challenge, command, key;
    
    // Handle Home Base commands (BSEH) differently
    if (action.isHomeBase) {
        // "Arrive [Unit] home bse" → "BSEH [Unit]"
        challenge = `${action.c} ${unit} home bse`;
        command = `${action.m} ${unit}`;
        key = `${action.m}-${unit}-HOME`;
    } else {
        // Standard command with location
        const location = DATA_LOCATIONS[Math.floor(Math.random() * DATA_LOCATIONS.length)];
        challenge = `${action.c} ${unit} ${location.c}`;
        command = `${action.m} ${unit} ${location.m}`;
        key = `${action.m}-${unit}-${location.m}`;
    }

    if (state.usedChallenges.has(key)) {
        const maxChallenges = DATA_ACTIONS.length * DATA_UNITS.length * DATA_LOCATIONS.length * 0.5;
        if (state.usedChallenges.size < maxChallenges) {
            return generateChallenge();
        }
        state.usedChallenges.clear();
    }
    state.usedChallenges.add(key);

    return { challenge, command };
}

// --- Asteroid Spawning ---
function spawnAsteroid() {
    if (state.asteroids.length >= state.currentMaxAsteroids) return;

    const target = state.defenses[Math.floor(Math.random() * state.defenses.length)];

    const spawnX = Math.random() * DOM.canvas.width;
    const spawnY = -CONFIG.asteroidRadius;

    const dx = target.x - spawnX;
    const dy = target.y - spawnY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    const timeToImpact = Math.max(CONFIG.minTimeToImpact, CONFIG.baseTimeToImpact / state.speedMultiplier);
    const baseSpeed = distance / (timeToImpact / 1000);
    const speed = baseSpeed * state.speedMultiplier;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    const rotationSpeed = (Math.random() - 0.5) * 4;
    const challengeData = generateChallenge();

    state.asteroids.push({
        id: Date.now() + Math.random(),
        x: spawnX,
        y: spawnY,
        vx: vx,
        vy: vy,
        radius: CONFIG.asteroidRadius,
        rotation: 0,
        rotationSpeed: rotationSpeed,
        target: target,
        challenge: challengeData.challenge,
        command: challengeData.command,
        spawnTime: Date.now(),
        glowIntensity: 0.5 + Math.random() * 0.5
    });
}

// --- Projectile System ---
function fireProjectile(targetAsteroid) {
    const tower = getTower();
    if (state.towerDisabled || state.rebuilding || tower.health <= 0) return false;

    const proj = {
        id: Date.now(),
        x: tower.x,
        y: tower.y - 20,
        targetId: targetAsteroid.id,
        targetY: targetAsteroid.y,
        speed: CONFIG.projectileSpeed,
        trail: []
    };

    const dx = targetAsteroid.x - proj.x;
    const dy = targetAsteroid.y - proj.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    proj.vx = (dx / dist) * proj.speed;
    proj.vy = (dy / dist) * proj.speed;

    state.projectiles.push(proj);
    return true;
}

// --- Explosion System ---
function createExplosion(x, y, type = 'asteroid') {
    state.explosions.push({
        x: x,
        y: y,
        radius: type === 'asteroid' ? 30 : 50,
        maxRadius: type === 'asteroid' ? 60 : 100,
        alpha: 1,
        type: type,
        color: type === 'asteroid' ? '#ff6600' : '#ff3366'
    });
}

// --- Get Penalty Info Based on Backspace Count ---
function getPenaltyInfo(backspaceCount) {
    if (backspaceCount === 0) return null;
    
    for (let i = PENALTY_NAMES.length - 1; i >= 0; i--) {
        if (backspaceCount >= PENALTY_NAMES[i].threshold) {
            return PENALTY_NAMES[i];
        }
    }
    return PENALTY_NAMES[0];
}

// --- Calculate Score for a Hit ---
function calculateHitScore(asteroid) {
    let points = CONFIG.basePoints;
    let breakdown = [];

    // Escalating Delete Tax based on backspace count
    const penaltyInfo = getPenaltyInfo(state.currentEntryBackspaces);
    if (penaltyInfo) {
        points -= penaltyInfo.penalty;
        breakdown.push(`-${penaltyInfo.penalty} ${penaltyInfo.name}`);
    }

    // PERFECT SHOT Bonus: +20 if no backspaces
    const isClean = state.currentEntryBackspaces === 0;
    if (isClean) {
        points += CONFIG.perfectShotBonus;
        breakdown.push(`+${CONFIG.perfectShotBonus} PERFECT SHOT`);
    }

    // Altitude Bonus: +50 if in top 25% of screen
    const screenHeight = DOM.canvas.height;
    const altitudeThresholdY = screenHeight * CONFIG.altitudeThreshold;
    if (asteroid.y < altitudeThresholdY) {
        points += CONFIG.altitudeBonus;
        breakdown.push(`+${CONFIG.altitudeBonus} EARLY`);
    }

    // Streak Multiplier: x1.5 at 5, x2.0 at 10, etc.
    const streakLevel = Math.floor(state.streak / CONFIG.streakMultiplierInterval);
    const multiplier = 1 + (streakLevel * 0.5);
    if (multiplier > 1) {
        points = Math.floor(points * multiplier);
        breakdown.push(`x${multiplier.toFixed(1)}`);
    }

    return { points, breakdown, isClean, multiplier };
}

// --- Input Handling (Global Match) ---
function handleCommand(inputValue) {
    const input = inputValue.trim().toUpperCase();
    DOM.commandInput.value = '';

    // Reset backspace counter after processing
    const backspacesUsed = state.currentEntryBackspaces;
    state.currentEntryBackspaces = 0;

    if (state.rebuilding) {
        showStatus("TOWER REBUILDING - STAND BY", "miss");
        return;
    }

    if (input === '') {
        if (state.asteroids.length > 0) {
            const oldest = state.asteroids[0];
            if (fireProjectile(oldest)) {
                showStatus("TARGETING OLDEST THREAT", "hit");
            } else {
                showStatus("TOWER OFFLINE", "miss");
            }
        }
        return;
    }

    // Global match: check ALL asteroids
    let matchedAsteroid = null;
    for (let i = 0; i < state.asteroids.length; i++) {
        if (state.asteroids[i].command.toUpperCase() === input) {
            matchedAsteroid = state.asteroids[i];
            break;
        }
    }

    if (matchedAsteroid) {
        if (fireProjectile(matchedAsteroid)) {
            state.streak++;
            state.streakSinceLastTowerHit++;

            // Restore backspaces for calculation
            state.currentEntryBackspaces = backspacesUsed;
            const scoreData = calculateHitScore(matchedAsteroid);
            state.currentEntryBackspaces = 0;

            state.score += scoreData.points;

            // Track clean hits
            if (scoreData.isClean) {
                state.consecutiveCleanHits++;
                state.totalCleanHits++;

                // Commendation check
                if (state.consecutiveCleanHits >= CONFIG.commendationThreshold) {
                    state.score += CONFIG.commendationBonus;
                    state.consecutiveCleanHits = 0;
                    showCommendation();
                    updateHUD();
                    checkScoreTier();
                    checkShieldRegen();
                    return;
                }
            } else {
                state.consecutiveCleanHits = 0;
            }

            // Build status message
            let statusMsg = `+${scoreData.points}`;
            if (scoreData.breakdown.length > 0) {
                statusMsg += ` (${scoreData.breakdown.join(' ')})`;
            }
            showStatus(statusMsg, "hit");

            DOM.commandInput.classList.add('success');
            setTimeout(() => DOM.commandInput.classList.remove('success'), 200);

            checkScoreTier();
            checkShieldRegen();
        } else {
            showStatus("TOWER OFFLINE - CANNOT FIRE", "miss");
        }
    } else {
        state.streak = 0;
        state.consecutiveCleanHits = 0;
        state.shields--;
        showStatus("INVALID COMMAND - SHIELD LOST", "miss");
        DOM.commandInput.classList.add('error');
        setTimeout(() => DOM.commandInput.classList.remove('error'), 300);

        if (state.shields <= 0) {
            damageTowerShield();
        }
    }

    updateHUD();
}

// --- Commendation Display ---
function showCommendation() {
    DOM.statusMessage.textContent = `★ EXCELLENT DISPATCH ★ +${CONFIG.commendationBonus}`;
    DOM.statusMessage.className = 'commendation';

    clearTimeout(state.statusTimer);
    state.statusTimer = setTimeout(() => {
        DOM.statusMessage.textContent = '';
        DOM.statusMessage.className = '';
    }, 3000);
}

// --- Shield Regeneration ---
function checkShieldRegen() {
    if (state.streakSinceLastTowerHit >= CONFIG.shieldRegenStreak) {
        if (state.towerShields < CONFIG.towerShieldMax) {
            state.towerShields++;
            state.streakSinceLastTowerHit = 0;
            showStatus("TOWER SHIELD RESTORED!", "hit");
        }
    }
}

// --- Tower Shield Damage ---
function damageTowerShield() {
    state.towerShields--;
    state.streakSinceLastTowerHit = 0;
    state.shields = CONFIG.startingShields;

    if (state.towerShields <= 0) {
        state.towerShields = 0;
        // Immediately trigger ambulance sequence
        startAmbulanceSequence();
    } else {
        showStatus(`TOWER HIT! SHIELDS: ${state.towerShields}/${CONFIG.towerShieldMax}`, "impact");
    }
    updateHUD();
}

// --- Ambulance Sequence (Bulletproof) ---
function startAmbulanceSequence() {
    // Ensure this only runs once and immediately
    if (state.ambulance !== null) return;
    
    state.towerDisabled = true;
    state.rebuilding = true;

    const tower = getTower();
    state.ambulance = {
        x: -60,
        y: tower.y - 100,
        targetX: tower.x,
        phase: 'incoming',
        arrived: false
    };

    const towerLabel = document.querySelector('.zone-label[data-zone="tower"]');
    if (towerLabel) towerLabel.classList.add('disabled');

    showStatus("EMERGENCY REPAIR UNIT DISPATCHED", "impact");
}

function updateAmbulance(deltaTime) {
    if (!state.ambulance) return;

    const amb = state.ambulance;
    const tower = getTower();

    if (amb.phase === 'incoming') {
        amb.x += CONFIG.ambulanceSpeed * deltaTime;
        if (amb.x >= amb.targetX) {
            amb.x = amb.targetX;
            amb.phase = 'repairing';
            state.beamActive = true;
            state.beamTimer = 0;
        }
    } else if (amb.phase === 'repairing') {
        state.beamTimer += deltaTime * 1000;
        if (state.beamTimer >= CONFIG.beamDuration) {
            state.beamActive = false;
            amb.phase = 'departing';
            rebuildTower();
        }
    } else if (amb.phase === 'departing') {
        amb.x += CONFIG.ambulanceSpeed * deltaTime;
        if (amb.x > DOM.canvas.width + 60) {
            state.ambulance = null;
            state.rebuilding = false;
            showStatus("TOWER ONLINE - ALL SYSTEMS GO", "hit");
        }
    }
}

// --- Score-Based Difficulty Progression ---
function checkScoreTier() {
    let newTier = 'trainee';

    for (const [tier, data] of Object.entries(SCORE_TIERS)) {
        if (state.score >= data.min && state.score <= data.max) {
            newTier = tier;
            break;
        }
    }

    if (newTier !== state.currentTier) {
        state.currentTier = newTier;
        const tierData = SCORE_TIERS[newTier];

        state.currentMaxAsteroids = tierData.maxAsteroids;
        state.speedMultiplier = tierData.speedMult;
        state.currentSpawnInterval = tierData.spawnInterval;

        const tierNames = {
            trainee: 'TRAINEE',
            mentoring: 'MENTORING',
            signedoff: 'SIGNED OFF',
            outofprobation: 'OUT OF PROBATION',
            senior: 'SENIOR DISPATCHER'
        };
        showStatus(`PROMOTED: ${tierNames[newTier]}`, "impact");
        updateHUD();
    }
}

// --- Tower Rebuild (called by ambulance) ---
function rebuildTower() {
    state.towerDisabled = false;
    state.towerShields = CONFIG.towerShieldMax;
    state.shields = CONFIG.startingShields;

    const towerLabel = document.querySelector('.zone-label[data-zone="tower"]');
    if (towerLabel) towerLabel.classList.remove('disabled');

    updateHUD();
}

// --- Defense Destruction ---
function damageDefense(defense) {
    if (defense.health <= 0) {
        createExplosion(defense.x, defense.y, 'zone');
        return;
    }

    defense.health = 0;

    const labelZone = defense.type === 'tower' ? 'tower' : defense.id;
    const label = document.querySelector(`.zone-label[data-zone="${labelZone}"]`);
    if (label) label.classList.add('destroyed');

    createExplosion(defense.x, defense.y, 'zone');
    showStatus(`${defense.name} DESTROYED!`, "impact");

    const aliveZones = state.defenses.filter(d => d.type === 'zone' && d.health > 0);
    if (aliveZones.length === 0) {
        gameOver();
    }
}

// --- Status Display ---
function showStatus(message, type = '') {
    DOM.statusMessage.textContent = message;
    DOM.statusMessage.className = type;

    clearTimeout(state.statusTimer);
    state.statusTimer = setTimeout(() => {
        DOM.statusMessage.textContent = '';
        DOM.statusMessage.className = '';
    }, 2000);
}

// --- HUD Update ---
function updateHUD() {
    DOM.scoreValue.textContent = state.score;
    DOM.streakValue.textContent = state.streak;

    const shieldBlocks = '█'.repeat(Math.max(0, state.shields));
    const emptyBlocks = '░'.repeat(Math.max(0, CONFIG.startingShields - state.shields));
    DOM.shieldsValue.textContent = shieldBlocks + emptyBlocks;

    DOM.shieldsValue.classList.remove('warning', 'critical');
    if (state.shields <= 3 && state.shields > 1) {
        DOM.shieldsValue.classList.add('warning');
    } else if (state.shields <= 1) {
        DOM.shieldsValue.classList.add('critical');
    }

    // Tower shield indicator
    const towerShieldEl = document.getElementById('tower-shield-value');
    if (towerShieldEl) {
        towerShieldEl.textContent = '◆'.repeat(state.towerShields) + '◇'.repeat(CONFIG.towerShieldMax - state.towerShields);
    }

    // Tier display
    if (DOM.tierDisplay) {
        const tierNames = {
            trainee: 'TRAINEE',
            mentoring: 'MENTORING',
            signedoff: 'SIGNED OFF',
            outofprobation: 'OUT OF PROB',
            senior: 'SENIOR'
        };
        DOM.tierDisplay.textContent = tierNames[state.currentTier];
    }

    // Multiplier display
    if (DOM.multiplierDisplay) {
        const streakLevel = Math.floor(state.streak / CONFIG.streakMultiplierInterval);
        const mult = 1 + (streakLevel * 0.5);
        DOM.multiplierDisplay.textContent = mult > 1 ? `x${mult.toFixed(1)}` : '';
    }
}

// --- Game Loop ---
function update(deltaTime) {
    if (!state.running) return;

    if (state.ambulance) {
        updateAmbulance(deltaTime);
    }

    const now = Date.now();

    if (!state.rebuilding && now - state.lastSpawnTime > state.currentSpawnInterval) {
        spawnAsteroid();
        state.lastSpawnTime = now;
    }

    // Asteroid movement and collision detection (tuned boundaries)
    for (let i = state.asteroids.length - 1; i >= 0; i--) {
        const a = state.asteroids[i];
        a.x += a.vx * deltaTime;
        a.y += a.vy * deltaTime;
        a.rotation += a.rotationSpeed * deltaTime;

        // Collision check: asteroid center reaches target zone Y coordinate
        // Tuned to register hits promptly when asteroids reach target
        const collisionThreshold = a.target.y - (a.radius * 0.5);
        if (a.y >= collisionThreshold) {
            damageDefense(a.target);
            state.asteroids.splice(i, 1);
        }
    }

    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        const p = state.projectiles[i];

        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 10) p.trail.shift();

        p.x += p.vx * deltaTime;
        p.y += p.vy * deltaTime;

        const targetAsteroid = state.asteroids.find(a => a.id === p.targetId);
        if (targetAsteroid) {
            const dx = p.x - targetAsteroid.x;
            const dy = p.y - targetAsteroid.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < targetAsteroid.radius + 5) {
                createExplosion(targetAsteroid.x, targetAsteroid.y, 'asteroid');
                const idx = state.asteroids.indexOf(targetAsteroid);
                if (idx !== -1) state.asteroids.splice(idx, 1);
                state.projectiles.splice(i, 1);
                continue;
            }
        } else {
            state.projectiles.splice(i, 1);
            continue;
        }

        if (p.y < -50 || p.y > DOM.canvas.height + 50) {
            state.projectiles.splice(i, 1);
        }
    }

    for (let i = state.explosions.length - 1; i >= 0; i--) {
        const e = state.explosions[i];
        e.radius += 150 * deltaTime;
        e.alpha -= 2 * deltaTime;

        if (e.alpha <= 0 || e.radius >= e.maxRadius) {
            state.explosions.splice(i, 1);
        }
    }
}

// --- Rendering ---
function render() {
    const ctx = DOM.ctx;
    const width = DOM.canvas.width;
    const height = DOM.canvas.height;

    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, width, height);

    drawStarfield(ctx, width, height);

    // Altitude threshold line (top 25%)
    const thresholdY = height * CONFIG.altitudeThreshold;
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.15)';
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(0, thresholdY);
    ctx.lineTo(width, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]);

    state.defenses.forEach(d => {
        if (d.type === 'tower') {
            drawTower(ctx, d);
        } else {
            drawZone(ctx, d);
        }
    });

    if (state.ambulance) {
        drawAmbulance(ctx);
    }

    state.projectiles.forEach(p => drawProjectile(ctx, p));
    state.asteroids.forEach(a => drawAsteroid(ctx, a));
    state.explosions.forEach(e => drawExplosion(ctx, e));
}

function drawStarfield(ctx, width, height) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for (let i = 0; i < 50; i++) {
        const x = (i * 37) % width;
        const y = (i * 59) % height;
        const size = (i % 3) + 1;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawZone(ctx, zone) {
    const alive = zone.health > 0;
    const asset = zone.asset;
    const assetReady = asset && asset.complete && asset.naturalWidth > 0;
    
    // Calculate draw position (centered on zone.x, sitting on zone.y)
    const drawWidth = zone.width;
    const drawHeight = zone.height || 80;
    const drawX = zone.x - drawWidth / 2;
    const drawY = zone.y - drawHeight + CONFIG.zoneHeight;
    
    ctx.save();
    
    if (assetReady) {
        // Apply destroyed state: grayscale + reduced alpha (landmark "lost")
        if (!alive) {
            ctx.globalAlpha = 0.2;
            ctx.filter = 'grayscale(100%)';
        }
        
        // Draw the regional landmark image asset
        ctx.drawImage(asset, drawX, drawY, drawWidth, drawHeight);
        
        // Reset filter
        ctx.filter = 'none';
        ctx.globalAlpha = 1;
        
        // Add glow effect for alive zones
        if (alive) {
            ctx.shadowColor = '#00aaff';
            ctx.shadowBlur = 15;
            ctx.strokeStyle = 'rgba(0, 170, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.strokeRect(drawX, drawY, drawWidth, drawHeight);
            ctx.shadowBlur = 0;
        }
    } else {
        // Fallback to primitive rendering if asset not loaded
        ctx.fillStyle = alive ? 'rgba(0, 170, 255, 0.3)' : 'rgba(255, 51, 102, 0.15)';
        ctx.fillRect(zone.x - zone.width / 2, zone.y, zone.width, CONFIG.zoneHeight);

        ctx.strokeStyle = alive ? '#00aaff' : '#ff3366';
        ctx.lineWidth = 2;
        ctx.shadowColor = alive ? '#00aaff' : '#ff3366';
        ctx.shadowBlur = alive ? 10 : 5;
        ctx.strokeRect(zone.x - zone.width / 2, zone.y, zone.width, CONFIG.zoneHeight);
        ctx.shadowBlur = 0;

        if (alive) {
            ctx.fillStyle = '#00aaff';
            const iconWidth = 20;
            const iconHeight = 25;
            ctx.fillRect(zone.x - iconWidth / 2, zone.y - iconHeight, iconWidth, iconHeight);
        }
    }
    
    ctx.restore();
}

function drawTower(ctx, tower) {
    const x = tower.x;
    const y = tower.y;
    const alive = tower.health > 0;
    const disabled = state.towerDisabled || state.rebuilding;
    const asset = tower.asset;
    const assetReady = asset && asset.complete && asset.naturalWidth > 0;
    
    // Calculate draw dimensions (Skylon Tower)
    const drawWidth = tower.width || 80;
    const drawHeight = tower.height || 110;
    const drawX = x - drawWidth / 2;
    const drawY = y - drawHeight + CONFIG.zoneHeight;
    
    ctx.save();
    
    if (assetReady) {
        // Apply destroyed state: grayscale + reduced alpha (landmark "lost")
        if (!alive) {
            ctx.globalAlpha = 0.2;
            ctx.filter = 'grayscale(100%)';
        } else if (disabled) {
            // Disabled state: orange tint effect (rebuilding)
            ctx.globalAlpha = 0.6;
            ctx.filter = 'sepia(100%) saturate(300%) hue-rotate(-30deg)';
        }
        
        // Draw the Skylon Tower image asset
        ctx.drawImage(asset, drawX, drawY, drawWidth, drawHeight);
        
        // Reset filter
        ctx.filter = 'none';
        ctx.globalAlpha = 1;
        
        // Add glow effect based on state
        if (alive && !disabled) {
            // Golden glow for active tower
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 20;
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
            ctx.lineWidth = 2;
            ctx.strokeRect(drawX, drawY, drawWidth, drawHeight);
            ctx.shadowBlur = 0;
            
            // Pulsing beacon at the top
            const pulse = 0.5 + Math.sin(Date.now() / 200) * 0.5;
            ctx.fillStyle = `rgba(255, 215, 0, ${pulse})`;
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(x, drawY + 5, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        } else if (disabled) {
            // Orange warning glow for disabled tower
            ctx.strokeStyle = 'rgba(255, 102, 0, 0.5)';
            ctx.lineWidth = 2;
            ctx.strokeRect(drawX, drawY, drawWidth, drawHeight);
        }
    } else {
        // Fallback to primitive rendering if asset not loaded
        ctx.fillStyle = disabled ? 'rgba(255, 102, 0, 0.3)' : (alive ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 51, 102, 0.15)');
        ctx.fillRect(x - 30, y, 60, CONFIG.zoneHeight);

        ctx.strokeStyle = disabled ? '#ff6600' : (alive ? '#ffd700' : '#ff3366');
        ctx.lineWidth = 3;
        ctx.shadowColor = disabled ? '#ff6600' : (alive ? '#ffd700' : '#ff3366');
        ctx.shadowBlur = 15;

        ctx.beginPath();
        ctx.moveTo(x - 15, y);
        ctx.lineTo(x - 8, y - 50);
        ctx.lineTo(x + 8, y - 50);
        ctx.lineTo(x + 15, y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x, y - 50);
        ctx.lineTo(x, y - 70);
        ctx.stroke();

        if (alive && !disabled) {
            const pulse = 0.5 + Math.sin(Date.now() / 200) * 0.5;
            ctx.fillStyle = `rgba(255, 215, 0, ${pulse})`;
            ctx.beginPath();
            ctx.arc(x, y - 70, 5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.shadowBlur = 0;
    }
    
    ctx.restore();

    // Draw tower shield (outside save/restore to maintain proper layering)
    if (!disabled && state.towerShields > 0) {
        drawTowerShield(ctx, x, y);
    }
}

// --- 360° Tower Shield with Pulsing Effect ---
function drawTowerShield(ctx, x, y) {
    const shieldRadius = CONFIG.towerShieldRadius;
    const shieldCenterY = y - 35;

    const healthRatio = state.towerShields / CONFIG.towerShieldMax;
    
    // Pulsing effect based on health ratio
    const basePulse = 0.3 + healthRatio * 0.4;
    const pulseSpeed = 150 + (1 - healthRatio) * 100; // Faster pulse when damaged
    const pulse = basePulse + Math.sin(Date.now() / pulseSpeed) * 0.15;

    // Shield color based on health
    let shieldColor, shieldRGB;
    if (state.towerShields === 3) {
        shieldColor = `rgba(0, 255, 255, ${pulse})`;
        shieldRGB = '0, 255, 255';
    } else if (state.towerShields === 2) {
        shieldColor = `rgba(255, 255, 0, ${pulse})`;
        shieldRGB = '255, 255, 0';
    } else {
        shieldColor = `rgba(255, 102, 0, ${pulse})`;
        shieldRGB = '255, 102, 0';
    }

    // Draw full 360° circular force field
    ctx.save();
    
    // Outer glow
    ctx.strokeStyle = shieldColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = `rgb(${shieldRGB})`;
    ctx.shadowBlur = 25 * healthRatio;
    
    ctx.beginPath();
    ctx.arc(x, shieldCenterY, shieldRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner glow layer
    ctx.globalAlpha = pulse * 0.5;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(x, shieldCenterY, shieldRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Innermost bright ring
    ctx.globalAlpha = pulse * 0.8;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, shieldCenterY, shieldRadius - 5, 0, Math.PI * 2);
    ctx.stroke();

    // Shield fill (very translucent)
    ctx.globalAlpha = pulse * 0.1;
    ctx.fillStyle = `rgb(${shieldRGB})`;
    ctx.beginPath();
    ctx.arc(x, shieldCenterY, shieldRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;

    // Damage cracks (if damaged)
    if (state.towerShields < CONFIG.towerShieldMax) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;

        const cracks = CONFIG.towerShieldMax - state.towerShields;
        for (let i = 0; i < cracks * 3; i++) {
            const crackAngle = (Math.PI * 2 / (cracks * 3)) * i + (Date.now() / 5000);
            const crackX = x + Math.cos(crackAngle) * shieldRadius;
            const crackY = shieldCenterY + Math.sin(crackAngle) * shieldRadius;

            ctx.beginPath();
            ctx.moveTo(crackX, crackY);
            ctx.lineTo(
                crackX + Math.cos(crackAngle) * (10 + Math.random() * 10),
                crackY + Math.sin(crackAngle) * (10 + Math.random() * 10)
            );
            ctx.stroke();
        }
    }

    ctx.restore();
}

function drawAmbulance(ctx) {
    const amb = state.ambulance;
    const tower = getTower();

    if (state.beamActive) {
        const beamPulse = 0.5 + Math.sin(Date.now() / 50) * 0.5;

        ctx.strokeStyle = `rgba(0, 255, 136, ${beamPulse})`;
        ctx.lineWidth = 8;
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 25;

        ctx.beginPath();
        ctx.moveTo(amb.x, amb.y + 20);
        ctx.lineTo(tower.x, tower.y - 50);
        ctx.stroke();

        ctx.strokeStyle = `rgba(255, 255, 255, ${beamPulse * 0.8})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(amb.x, amb.y + 20);
        ctx.lineTo(tower.x, tower.y - 50);
        ctx.stroke();

        ctx.shadowBlur = 0;
    }

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ff3366';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff3366';
    ctx.shadowBlur = 15;

    ctx.beginPath();
    ctx.moveTo(amb.x + 30, amb.y);
    ctx.lineTo(amb.x - 20, amb.y - 15);
    ctx.lineTo(amb.x - 30, amb.y);
    ctx.lineTo(amb.x - 20, amb.y + 15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ff3366';
    ctx.fillRect(amb.x - 5, amb.y - 10, 10, 20);
    ctx.fillRect(amb.x - 10, amb.y - 5, 20, 10);

    const flash = Math.sin(Date.now() / 100) > 0;
    ctx.fillStyle = flash ? '#ff0000' : '#0000ff';
    ctx.beginPath();
    ctx.arc(amb.x - 20, amb.y - 12, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = flash ? '#0000ff' : '#ff0000';
    ctx.beginPath();
    ctx.arc(amb.x - 20, amb.y + 12, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
}

function drawAsteroid(ctx, asteroid) {
    ctx.save();
    ctx.translate(asteroid.x, asteroid.y);
    ctx.rotate(asteroid.rotation);

    const gradient = ctx.createRadialGradient(0, 0, asteroid.radius * 0.5, 0, 0, asteroid.radius * 1.5);
    gradient.addColorStop(0, `rgba(255, 68, 0, ${asteroid.glowIntensity})`);
    gradient.addColorStop(0.5, 'rgba(255, 68, 0, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 68, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, asteroid.radius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#8b4513';
    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff4400';
    ctx.shadowBlur = 10;

    ctx.beginPath();
    const points = 8;
    for (let i = 0; i < points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const variance = 0.7 + Math.sin(i * 1.5) * 0.3;
        const r = asteroid.radius * variance;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.restore();

    drawChallengeLabel(ctx, asteroid);
}

// --- Challenge Label (Reduced Font Size for Legibility) ---
function drawChallengeLabel(ctx, asteroid) {
    const text = asteroid.challenge;
    ctx.font = "bold 14px 'Courier New'";
    const metrics = ctx.measureText(text);
    const padding = 8;
    const bubbleWidth = metrics.width + padding * 2;
    const bubbleHeight = 22;

    let bubbleX = asteroid.x - bubbleWidth / 2;
    const canvasWidth = DOM.canvas.width;
    if (bubbleX < 4) bubbleX = 4;
    if (bubbleX + bubbleWidth > canvasWidth - 4) bubbleX = canvasWidth - bubbleWidth - 4;

    const bubbleY = asteroid.y - asteroid.radius - bubbleHeight - 8;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight);

    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.strokeRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight);

    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, bubbleX + bubbleWidth / 2, bubbleY + bubbleHeight / 2);
}

function drawProjectile(ctx, proj) {
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    proj.trail.forEach((point, i) => {
        ctx.globalAlpha = i / proj.trail.length * 0.5;
        if (i === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawExplosion(ctx, exp) {
    const gradient = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, exp.radius);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${exp.alpha})`);
    gradient.addColorStop(0.3, `${exp.color}${Math.floor(exp.alpha * 255).toString(16).padStart(2, '0')}`);
    gradient.addColorStop(1, 'rgba(255, 68, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
    ctx.fill();
}

// --- Game Loop Runner ---
let lastTime = 0;
function gameLoop(timestamp) {
    const deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    update(deltaTime);
    render();

    if (state.running) {
        requestAnimationFrame(gameLoop);
    }
}

// --- Game Control ---
function startGame() {
    state.running = true;
    state.score = 0;
    state.shields = CONFIG.startingShields;
    state.towerShields = CONFIG.towerShieldMax;
    state.streak = 0;
    state.streakSinceLastTowerHit = 0;
    state.currentTier = 'trainee';
    state.speedMultiplier = SCORE_TIERS.trainee.speedMult;
    state.currentSpawnInterval = SCORE_TIERS.trainee.spawnInterval;
    state.currentMaxAsteroids = SCORE_TIERS.trainee.maxAsteroids;
    state.asteroids = [];
    state.projectiles = [];
    state.explosions = [];
    state.towerDisabled = false;
    state.rebuilding = false;
    state.ambulance = null;
    state.beamActive = false;
    state.usedChallenges.clear();
    state.lastSpawnTime = Date.now();
    state.currentEntryBackspaces = 0;
    state.consecutiveCleanHits = 0;
    state.totalCleanHits = 0;
    state.difficultyLevel = 0;

    initializeDefenses();

    document.querySelectorAll('.zone-label').forEach(label => {
        label.classList.remove('destroyed', 'disabled');
    });

    updateHUD();
    DOM.startOverlay.classList.add('hidden');
    DOM.gameOverOverlay.classList.add('hidden');
    DOM.commandInput.focus();

    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function gameOver() {
    state.running = false;
    DOM.finalScore.textContent = state.score;

    const statsEl = document.getElementById('final-stats');
    if (statsEl) {
        statsEl.innerHTML = `
            <div>TIER: ${state.currentTier.toUpperCase()}</div>
            <div>PERFECT SHOTS: ${state.totalCleanHits}</div>
        `;
    }

    DOM.gameOverOverlay.classList.remove('hidden');
}

function ejectToArcade() {
    window.location.href = '../arcade.html';
}

// --- Initialization ---
function init() {
    DOM.canvas = document.getElementById('game-canvas');
    DOM.ctx = DOM.canvas.getContext('2d');
    DOM.commandInput = document.getElementById('command-input');
    DOM.scoreValue = document.getElementById('score-value');
    DOM.shieldsValue = document.getElementById('shields-value');
    DOM.streakValue = document.getElementById('streak-value');
    DOM.statusMessage = document.getElementById('status-message');
    DOM.startOverlay = document.getElementById('start-overlay');
    DOM.gameOverOverlay = document.getElementById('game-over-overlay');
    DOM.finalScore = document.getElementById('final-score');
    DOM.tierDisplay = document.getElementById('tier-value');
    DOM.multiplierDisplay = document.getElementById('multiplier-value');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    initializeDefenses();

    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', startGame);
    document.getElementById('eject-btn').addEventListener('click', ejectToArcade);

    // Backspace tracker
    DOM.commandInput.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
            state.currentEntryBackspaces++;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            if (state.running) {
                handleCommand(DOM.commandInput.value);
            }
        }
    });

    DOM.canvas.addEventListener('click', () => {
        if (state.running) DOM.commandInput.focus();
    });

    render();
}

function resizeCanvas() {
    const container = document.getElementById('play-area');
    DOM.canvas.width = container.clientWidth;
    DOM.canvas.height = container.clientHeight;

    if (state.defenses.length > 0) {
        initializeDefenses();
    }
}

document.addEventListener('DOMContentLoaded', init);

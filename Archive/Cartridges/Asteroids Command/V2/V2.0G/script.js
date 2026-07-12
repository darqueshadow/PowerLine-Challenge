/* ========================================================
   ASTEROID COMMAND v2.0.K — PROCEDURAL WATER EDITION
   ADDS: Cyan water channels under Welland Canal & Port Colborne coastline
   ======================================================== */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    maxShieldStrength: 12,
    hpPerShieldLayer: 4,
    misfireDamage: 1,
    impactDamage: 4,
    spawnLimit: 4,
    baseSpawnInterval: 2000,
    asteroidRadius: 20,
    zoneHeight: 50,
    projectileSpeed: 800,
    ambulanceSpeed: 400,
    beamDuration: 2000,
    shieldRegenStreak: 5,
    basePoints: 100,
    perfectBonus: 20,
    altitudeBonus: 50,
    altitudeThreshold: 0.25,
    streakInterval: 5,
    commendationThreshold: 10,
    commendationBonus: 500,
    isHolodeck: false,
    isBeta: false,
    devModePassword: "DISPATCH",
    devModeTimeout: 10000
};

const LAYOUT = {
    gorgeY: 85,
    plateauY: 110,
    towerY: 140
};

const TIERS = {
    trainee:   { min: 0,     max: 2000,  speed: 0.6,  spawn: 2000 },
    mentoring: { min: 2001,  max: 5000,  speed: 0.7,  spawn: 1800 },
    signedoff: { min: 5001,  max: 10000, speed: 0.85, spawn: 1500 },
    outofprob: { min: 10001, max: 20000, speed: 1.0,  spawn: 1200 },
    senior:    { min: 20001, max: Infinity, speed: 1.3, spawn: 1000 }
};

const PENALTIES = [
    { threshold: 1, amount: 5, name: "KEY DUST" },
    { threshold: 2, amount: 10, name: "SIGNAL NOISE" },
    { threshold: 3, amount: 15, name: "INPUT LAG" },
    { threshold: 4, amount: 20, name: "COMMS DRIFT" },
    { threshold: 5, amount: 25, name: "STATIC JAM" }
];

// ============================================
// TETHER PHYSICS (Tractor Beam System)
// ============================================

const TETHER = {
    springConstant: 0.05,
    repulsionForce: 0.8,
    tetherVisibleDistance: 45,
    friction: 0.70,
    hoverOffset: 40
};

// ============================================
// DATASETS
// ============================================

const DATA_ACTIONS = [
    { c: "Post to", m: "AP", type: "direction" },
    { c: "Assign to", m: "AP", type: "direction" },
    { c: "Required at", m: "AP", type: "direction" },
    { c: "Needed at", m: "AP", type: "direction" },
    { c: "Enroute to", m: "ENP", type: "radio" },
    { c: "Mobile to", m: "ENP", type: "radio" },
    { c: "On our way to", m: "ENP", type: "radio" },
    { c: "Heading to", m: "ENP", type: "radio" },
    { c: "Arriving", m: "BSE", type: "radio" },
    { c: "Arriving at", m: "BSE", type: "radio" },
    { c: "Made it to", m: "BSE", type: "radio" },
    { c: "At", m: "BSE", type: "radio" },
    { c: "Mobile around", m: "LA", type: "radio" },
    { c: "On the air by", m: "LA", type: "radio" },
    { c: "Area of", m: "LA", type: "radio" },
    { c: "Staying local at", m: "LA", type: "radio" }
];

const DATA_UNITS_FULL = [
    "2040", "2041", "2042", "2043", "2044", "2045", "2046",
    "2095", "2096", "2097", "2098", "2099", "2100", "2101",
    "2102", "2103", "2104", "2105", "2106", "2107", "2108",
    "2115", "2118", "2120", "2121", "2122", "2201", "2208"
];

const DATA_LOCATIONS_FULL = [
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

const DATA_UNITS_SAMPLE = ["2101", "2105", "2115", "2120", "2202", "CARE1"];
const DATA_LOCATIONS_SAMPLE = DATA_LOCATIONS_FULL.slice(0, 5);

// ============================================
// ASSETS
// ============================================

const ASSETS = {};

const ZONE_ASSET_LIST = [
    'Tower_INTACT', 'Tower_DESTROYED',
    'Skylon_INTACXT', 'Skylon_DESTROYED',
    'Sir_Adam_Beck_INTACT', 'Sir_Adam_Beck_DESTROYED',
    'Welland_Canal_INTACT', 'Welland_Canal_DESTROYED',
    'Robin_Hood_INTACT', 'Robin_Hood_DESTROYED'
];

const BG_ASSET_LIST = [
    'master_background_land', 'master_background_sky'
];

const ASTEROID_SPRITES = [];
const ASTEROID_SPRITE_PATHS = [
    'assets/Asteroids/asteroid_01.png',
    'assets/Asteroids/asteroid_02.png',
    'assets/Asteroids/asteroid_03.png',
    'assets/Asteroids/asteroid_04.png',
    'assets/Asteroids/asteroid_05.png',
    'assets/Asteroids/asteroid_06.png'
];

let assetsLoaded = 0;
const totalAssets = ZONE_ASSET_LIST.length + BG_ASSET_LIST.length + ASTEROID_SPRITE_PATHS.length;

ZONE_ASSET_LIST.forEach(name => {
    ASSETS[name] = new Image();
    ASSETS[name].src = `assets/Zones/${name}.png`;
    ASSETS[name].onload = () => { assetsLoaded++; };
    ASSETS[name].onerror = () => { console.warn(`Missing: assets/Zones/${name}.png`); assetsLoaded++; };
});

BG_ASSET_LIST.forEach(name => {
    ASSETS[name] = new Image();
    ASSETS[name].src = `assets/${name}.png`;
    ASSETS[name].onload = () => { assetsLoaded++; };
    ASSETS[name].onerror = () => { console.warn(`Missing: assets/${name}.png`); assetsLoaded++; };
});

ASTEROID_SPRITE_PATHS.forEach((path, index) => {
    const img = new Image();
    img.src = path;
    img.onload = () => { assetsLoaded++; };
    img.onerror = () => { console.warn(`Missing asteroid sprite: ${path}`); assetsLoaded++; };
    ASTEROID_SPRITES[index] = img;
});

// ============================================
// STATE
// ============================================

const state = {
    running: false,
    score: 0,
    shieldHP: 12,
    towerExposed: false,
    repairCount: 0,
    cracks: [],
    ricochetProjectiles: [],
    streak: 0,
    streakSinceShieldHit: 0,
    tier: 'trainee',
    speedMult: 0.6,
    spawnInterval: 2000,
    asteroids: [],
    projectiles: [],
    brokenProjectiles: [],
    explosions: [],
    defenses: [],
    towerDisabled: false,
    rebuilding: false,
    ambulance: null,
    beamActive: false,
    beamTimer: 0,
    usedChallenges: new Set(),
    backspaces: 0,
    cleanHits: 0,
    cleanStreak: 0,
    timers: {},
    devModeUnlocked: false,
    devPromptActive: false,
    environmentalParticles: []  // Aftermath VFX particle array
};

const DOM = {};

// ============================================
// INITIALIZATION
// ============================================

function init() {
    DOM.canvas = document.getElementById('game-canvas');
    DOM.ctx = DOM.canvas.getContext('2d');
    DOM.input = document.getElementById('command-input');
    DOM.score = document.getElementById('score-value');
    DOM.shields = document.getElementById('shields-value');
    DOM.streak = document.getElementById('streak-value');
    DOM.status = document.getElementById('status-message');
    DOM.vds = document.getElementById('vds-container');
    DOM.startOverlay = document.getElementById('start-overlay');
    DOM.gameOverOverlay = document.getElementById('game-over-overlay');
    DOM.finalScore = document.getElementById('final-score');
    DOM.tier = document.getElementById('tier-value');
    DOM.mult = document.getElementById('multiplier-value');
    DOM.devPrompt = document.getElementById('dev-mode-prompt');
    DOM.devInput = document.getElementById('dev-password-input');
    DOM.devTimer = document.getElementById('dev-timer');
    DOM.tetherLayer = document.getElementById('tether-layer');

    resize();
    window.addEventListener('resize', resize);

    document.getElementById('start-btn').addEventListener('click', () => startGame(false));
    document.getElementById('restart-btn').addEventListener('click', () => startGame(CONFIG.isHolodeck));
    document.getElementById('eject-btn').addEventListener('click', () => window.location.href = '../arcade.html');
    document.getElementById('holodeck-btn')?.addEventListener('click', () => startGame(true));

    document.addEventListener('keydown', e => {
        if (e.ctrlKey && e.shiftKey && e.key === 'B') {
            e.preventDefault();
            if (!state.devPromptActive) {
                showDevModePrompt();
            }
        }
    });

    DOM.input.addEventListener('keydown', e => {
        if (e.key === 'Backspace') state.backspaces++;
        if (e.key === 'Enter') {
            e.preventDefault();
            if (state.running) handleCommand(DOM.input.value);
        }
    });

    DOM.canvas.addEventListener('click', () => state.running && DOM.input.focus());
    render();
}

function resize() {
    const area = document.getElementById('play-area');
    DOM.canvas.width = area.clientWidth;
    DOM.canvas.height = area.clientHeight;
    if (state.defenses.length) initDefenses();
}

// ============================================
// DEV MODE SECURITY
// ============================================

function showDevModePrompt() {
    state.devPromptActive = true;
    DOM.devPrompt.classList.remove('hidden');
    DOM.devInput.value = '';
    DOM.devInput.focus();

    let timeLeft = CONFIG.devModeTimeout / 1000;
    DOM.devTimer.textContent = timeLeft;

    const timerInterval = setInterval(() => {
        timeLeft--;
        DOM.devTimer.textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            hideDevModePrompt();
            showStatus("ACCESS TIMEOUT", "miss");
        }
    }, 1000);

    const submitHandler = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            clearInterval(timerInterval);
            const inputPassword = DOM.devInput.value.trim().toUpperCase();
            
            if (inputPassword === CONFIG.devModePassword) {
                state.devModeUnlocked = true;
                CONFIG.isBeta = !CONFIG.isBeta;
                CONFIG.isBeta ? showBeta() : hideBeta();
                showStatus(CONFIG.isBeta ? "DEV MODE ACTIVATED" : "DEV MODE DEACTIVATED", "bonus");
                if (CONFIG.isHolodeck) triggerHolodeck(CONFIG.isBeta);
            } else {
                showStatus("ACCESS DENIED", "miss");
            }
            
            hideDevModePrompt();
            DOM.devInput.removeEventListener('keydown', submitHandler);
        } else if (e.key === 'Escape') {
            clearInterval(timerInterval);
            hideDevModePrompt();
            DOM.devInput.removeEventListener('keydown', submitHandler);
        }
    };

    DOM.devInput.addEventListener('keydown', submitHandler);

    state.timers.devTimeout = setTimeout(() => {
        if (state.devPromptActive) {
            clearInterval(timerInterval);
            hideDevModePrompt();
            DOM.devInput.removeEventListener('keydown', submitHandler);
        }
    }, CONFIG.devModeTimeout);
}

function hideDevModePrompt() {
    state.devPromptActive = false;
    DOM.devPrompt.classList.add('hidden');
    DOM.devInput.value = '';
    clearTimeout(state.timers.devTimeout);
    
    if (state.running) DOM.input.focus();
}

// ============================================
// DEFENSES (Scaled -12.5% & Repositioned)
// ============================================

function initDefenses() {
    const w = DOM.canvas.width;
    const h = DOM.canvas.height;
    const y = h - CONFIG.zoneHeight;
    const s = w / 5;

    state.defenses = [
        // Sir Adam Beck: Sunk 35px deeper into the cyan water layer
        { id: 1, type: 'zone', name: "NOTL", x: s * 0.4, y: h + 35, w: 236, h: 223, hp: 100, 
          fileIntact: 'Sir_Adam_Beck_INTACT', fileDestroyed: 'Sir_Adam_Beck_DESTROYED', destroyed: false },
          
        // Skylon: Scaled down from 127x150 to 111x131
        { id: 2, type: 'zone', name: "NIAGARA FALLS", x: s * 1.5, y: y + 20, w: 111, h: 131, hp: 100, 
          fileIntact: 'Skylon_INTACXT', fileDestroyed: 'Skylon_DESTROYED', destroyed: false },
          
        // Radio Tower: Scaled down from 120x165 to 105x144
        { id: 'tower', type: 'tower', name: "RADIO TOWER", x: s * 2.5, y: y + 20, w: 105, h: 144, hp: 100, 
          fileIntact: 'Tower_INTACT', fileDestroyed: 'Tower_DESTROYED', destroyed: false },
          
        // Welland Canal: Scaled down from 135x127 to 118x111
        { id: 3, type: 'zone', name: "THOROLD", x: s * 3.5, y: y + 20, w: 118, h: 111, hp: 100, 
          fileIntact: 'Welland_Canal_INTACT', fileDestroyed: 'Welland_Canal_DESTROYED', destroyed: false },
          
        // Robin Hood: Scaled down from 135x135 to 118x118
        { id: 4, type: 'zone', name: "PORT COLBORNE", x: s * 4.6, y: y + 20, w: 118, h: 118, hp: 100, 
          fileIntact: 'Robin_Hood_INTACT', fileDestroyed: 'Robin_Hood_DESTROYED', destroyed: false }
    ];
}

function getTower() { return state.defenses.find(d => d.type === 'tower'); }

// ============================================
// CHALLENGE GENERATION (Non-Recursive)
// ============================================

function getTargetSpecs() {
    const units = CONFIG.isHolodeck ? DATA_UNITS_SAMPLE : DATA_UNITS_FULL;
    const locs = CONFIG.isHolodeck ? DATA_LOCATIONS_SAMPLE : DATA_LOCATIONS_FULL;
    
    let action, unit, loc, key;
    let attempts = 0;
    
    do {
        action = DATA_ACTIONS[Math.floor(Math.random() * DATA_ACTIONS.length)];
        unit = units[Math.floor(Math.random() * units.length)];
        loc = locs[Math.floor(Math.random() * locs.length)];
        key = `${action.m}-${unit}-${loc.m}`;
        attempts++;
    } while (state.usedChallenges.has(key) && attempts < 25);

    if (attempts >= 25 || state.usedChallenges.size >= 400) {
        state.usedChallenges.clear();
    }
    
    state.usedChallenges.add(key);

    return {
        unitID: unit,
        challenge: `${action.c} ${loc.c}`,
        command: `${action.m} ${unit} ${loc.m}`,
        type: action.type
    };
}

// ============================================
// GLASS DOME SHIELD
// ============================================

function drawShield(ctx, tower) {
    if (state.shieldHP <= 0) return;

    const cx = tower.x;
    const by = tower.y - 20;
    const hw = 90, ht = 150;

    const color = state.shieldHP > 8 ? '#00ff88' : state.shieldHP > 4 ? '#ff6600' : '#9d00ff';

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - hw, by);
    ctx.bezierCurveTo(cx - hw, by - ht, cx + hw, by - ht, cx + hw, by);

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 15 + Math.sin(Date.now() / 200) * 5;
    ctx.globalAlpha = 0.4 + Math.sin(Date.now() / 300) * 0.1;
    ctx.stroke();

    const grad = ctx.createLinearGradient(cx, by, cx, by - ht);
    grad.addColorStop(0, color + '22');
    grad.addColorStop(1, color + '08');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    drawCracks(ctx, tower);
}

function addCrack() {
    const tower = getTower();
    if (!tower) return;

    const cx = tower.x, by = tower.y - 20;
    const x = cx + (Math.random() - 0.5) * 150;
    const y = by - Math.random() * 120;

    const crack = { x, y, branches: [], alpha: 1 };
    const num = 2 + Math.floor(Math.random() * 3);

    for (let i = 0; i < num; i++) {
        const angle = (Math.PI * 2 / num) * i + (Math.random() - 0.5) * 0.5;
        const segs = [];
        let px = x, py = y;
        for (let j = 0; j < 4; j++) {
            const a = angle + (Math.random() - 0.5) * 0.8;
            const len = 8 + Math.random() * 10;
            const nx = px + Math.cos(a) * len;
            const ny = py + Math.sin(a) * len;
            segs.push({ x1: px, y1: py, x2: nx, y2: ny });
            px = nx; py = ny;
        }
        crack.branches.push(segs);
    }

    state.cracks.push(crack);
    if (state.cracks.length > 12) state.cracks.shift();
}

function drawCracks(ctx, tower) {
    if (!state.cracks.length) return;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    for (const c of state.cracks) {
        ctx.globalAlpha = c.alpha * 0.6;
        for (const branch of c.branches) {
            ctx.beginPath();
            for (const s of branch) { ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); }
            ctx.stroke();
        }
    }
    ctx.globalAlpha = 1;
}

// ============================================
// DAMAGE SYSTEM
// ============================================

function applyDamage(amount, type) {
    if (state.shieldHP > 0) {
        state.shieldHP -= amount;
        if (state.shieldHP < 0) state.shieldHP = 0;

        if (type === 'misfire') { triggerRicochet(); addCrack(); }
        else if (type === 'impact') { addCrack(); addCrack(); state.streakSinceShieldHit = 0; }

        if (state.shieldHP === 0) {
            state.towerExposed = true;
            showStatus("SHIELDS DOWN — TOWER EXPOSED", "impact");
        }
    } else if (type === 'impact') {
        destroyTower();
    }
    updateHUD();
}

function destroyTower() {
    state.towerDisabled = true;
    const tower = getTower();
    if (tower) tower.destroyed = true;

    showStatus("TARGET IMPACT — IMPACT RADIO TOWER", "impact");
    startAmbulance();
}

// ============================================
// RICOCHET PROJECTILES
// ============================================

function triggerRicochet() {
    const tower = getTower();
    if (!tower || state.shieldHP <= 0) return;

    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
    state.ricochetProjectiles.push({
        x: tower.x, y: tower.y - 40,
        vx: Math.cos(angle) * 300,
        vy: Math.sin(angle) * 300,
        bounces: 2 + Math.floor(Math.random() * 3),
        life: 1, trail: []
    });
}

function updateRicochets(dt) {
    const tower = getTower();
    if (!tower) return;

    for (let i = state.ricochetProjectiles.length - 1; i >= 0; i--) {
        const r = state.ricochetProjectiles[i];
        
        if (state.shieldHP <= 0) {
            r.y -= 10 * dt * 60;
            r.x += r.vx * dt;
            r.life -= 0.04;
            if (r.life <= 0 || r.y < -50 || r.y > DOM.canvas.height + 50 || r.x < -50 || r.x > DOM.canvas.width + 50) {
                state.ricochetProjectiles.splice(i, 1);
            }
            continue;
        }
        
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.trail.push({ x: r.x, y: r.y });
        if (r.trail.length > 8) r.trail.shift();

        const cx = tower.x, by = tower.y - 20, hw = 90, ht = 150;
        const rx = r.x - cx, ry = by - r.y;
        const nx = rx / hw;
        
        const nxClamped = Math.max(-1, Math.min(1, nx));
        const ey = ht * (1 - nxClamped * nxClamped);

        if ((ry > ey || Math.abs(rx) > hw) && r.bounces > 0) {
            if (Math.abs(rx) > hw * 0.9) r.vx *= -1;
            if (ry > ey * 0.9) r.vy *= -1;
            r.vx *= 0.7; r.vy *= 0.7;
            r.bounces--;
            state.explosions.push({ x: r.x, y: r.y, radius: 3, max: 10, alpha: 0.6, color: '#ff3366' });
        }

        r.life -= 0.02;
        if (r.life <= 0 || (r.bounces <= 0 && (r.y > DOM.canvas.height || r.y < -50))) {
            state.ricochetProjectiles.splice(i, 1);
        }
    }
}

// ============================================
// ASTEROIDS
// ============================================

function spawnAsteroid() {
    if (state.asteroids.length >= CONFIG.spawnLimit || state.rebuilding) return;

    const target = state.defenses[Math.floor(Math.random() * state.defenses.length)];
    const sx = Math.random() * DOM.canvas.width;
    const sy = -CONFIG.asteroidRadius;

    const dx = target.x - sx, dy = target.y - sy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const time = Math.max(2500, 25000 / state.speedMult);
    const speed = (dist / (time / 1000)) * state.speedMult;

    const specs = getTargetSpecs();
    
    const spriteIndex = Math.floor(Math.random() * ASTEROID_SPRITES.length);

    state.asteroids.push({
        id: Date.now() + Math.random(),
        x: sx, y: sy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: CONFIG.asteroidRadius,
        rotation: 0,
        rotSpeed: (Math.random() - 0.5) * 4,
        target,
        unitID: specs.unitID,
        challenge: specs.challenge,
        command: specs.command,
        type: specs.type,
        glow: 0.5 + Math.random() * 0.5,
        spriteIndex: spriteIndex,
        challengeBox: {
            x: sx,
            y: sy - TETHER.hoverOffset,
            vx: 0,
            vy: 0,
            width: 0,
            height: 26
        }
    });
}

function maintainAsteroids() {
    while (state.asteroids.length < CONFIG.spawnLimit && !state.rebuilding) spawnAsteroid();
}

// ============================================
// PROJECTILES
// ============================================

function fireProjectile(target) {
    const tower = getTower();
    if (state.towerDisabled || state.rebuilding || !tower) return false;

    const proj = { id: Date.now(), x: tower.x, y: tower.y - 20, targetId: target.id, speed: CONFIG.projectileSpeed, trail: [] };
    const dx = target.x - proj.x, dy = target.y - proj.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    proj.vx = (dx / d) * proj.speed;
    proj.vy = (dy / d) * proj.speed;

    state.projectiles.push(proj);
    return true;
}

function fireBroken() {
    const tower = getTower();
    if (!tower) return;

    const arc = state.towerExposed ? -8 : -2;
    const drift = state.towerExposed ? (Math.random() - 0.5) * 12 : (Math.random() - 0.5) * 5;

    state.brokenProjectiles.push({ x: tower.x, y: tower.y - 40, vx: drift, vy: arc, g: 0.15, smoke: [], life: 1 });
}

function createExplosion(x, y, color = '#ff6600', size = 30) {
    state.explosions.push({ x, y, radius: size, max: size * 2, alpha: 1, color });
}

function createShatter(x, y, spriteIndex) {
    let container = document.getElementById('particle-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'particle-container';
        container.className = 'particle-container';
        document.getElementById('game-container').appendChild(container);
    }
    
    const textureUrl = ASTEROID_SPRITE_PATHS[spriteIndex] || ASTEROID_SPRITE_PATHS[0];
    const shardCount = 10;
    const shapes = ['shape-a', 'shape-b', 'shape-c'];

    for (let i = 0; i < shardCount; i++) {
        const shard = document.createElement('div');
        const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
        
        shard.className = `shard ${randomShape}`;
        shard.style.backgroundImage = `url(${textureUrl})`;
        shard.style.left = `${x}px`;
        shard.style.top = `${y}px`;
        
        shard.style.backgroundPosition = `${Math.random() * 100}% ${Math.random() * 100}%`;

        container.appendChild(shard);

        const angle = Math.random() * Math.PI * 2;
        const velocity = 3 + Math.random() * 8;
        const vx = Math.cos(angle) * velocity;
        const vy = Math.sin(angle) * velocity;
        const rotation = (Math.random() - 0.5) * 500;

        shard.animate([
            { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
            { transform: `translate(${vx * 20}px, ${vy * 20}px) rotate(${rotation}deg)`, opacity: 0 }
        ], {
            duration: 800 + Math.random() * 400,
            easing: 'ease-out',
            fill: 'forwards'
        }).onfinish = () => shard.remove();
    }
}

// ============================================
// INPUT HANDLING
// ============================================

function handleCommand(value) {
    const input = value.trim().toUpperCase();
    DOM.input.value = '';

    const bs = state.backspaces;
    state.backspaces = 0;

    if (state.rebuilding) {
        showStatus("TOWER REBUILDING — STAND BY", "miss");
        return;
    }

    if (CONFIG.isBeta && state.asteroids.length > 0) {
        const oldest = state.asteroids[0];
        if (fireProjectile(oldest)) {
            state.streak++;
            state.score += 100;
            showStatus("BETA HIT +100", "hit");
            updateHUD();
            checkTier();
        }
        return;
    }

    if (input === '') {
        if (state.asteroids.length > 0) {
            fireProjectile(state.asteroids[0]) ? showStatus("TARGETING OLDEST", "hit") : showStatus("TOWER OFFLINE", "miss");
        }
        return;
    }

    const match = state.asteroids.find(a => a.command.toUpperCase() === input);

    if (match) {
        if (fireProjectile(match)) {
            state.streak++;
            state.streakSinceShieldHit++;

            const pts = calcScore(match, bs);
            state.score += pts.total;

            if (pts.clean) {
                state.cleanStreak++;
                state.cleanHits++;
                if (state.cleanStreak >= CONFIG.commendationThreshold) {
                    state.score += CONFIG.commendationBonus;
                    state.cleanStreak = 0;
                    showStatus(`★ EXCELLENT +${CONFIG.commendationBonus} ★`, "bonus");
                    updateHUD(); checkTier(); checkRegen();
                    return;
                }
            } else {
                state.cleanStreak = 0;
            }

            let msg = `+${pts.total}`;
            if (pts.notes.length) msg += ` (${pts.notes.join(' ')})`;
            showStatus(msg, "hit");

            DOM.input.classList.add('success');
            setTimeout(() => DOM.input.classList.remove('success'), 200);

            checkTier();
            checkRegen();
        }
    } else {
        state.streak = 0;
        state.cleanStreak = 0;

        if (state.shieldHP > 0) {
            applyDamage(CONFIG.misfireDamage, 'misfire');
            showStatus("MISFIRE — SHIELD ABSORBS", "miss");
        } else {
            fireBroken();
            showStatus("SYSTEM FAILURE", "miss");
        }

        DOM.input.classList.add('error');
        setTimeout(() => DOM.input.classList.remove('error'), 300);
    }

    updateHUD();
}

// ============================================
// SCORING
// ============================================

function calcScore(asteroid, backspaces) {
    let total = CONFIG.basePoints;
    const notes = [];

    if (backspaces > 0) {
        const p = PENALTIES.find((_, i) => backspaces <= PENALTIES[i].threshold) || PENALTIES[PENALTIES.length - 1];
        total -= p.amount;
        notes.push(`-${p.amount}`);
    }

    const clean = backspaces === 0;
    if (clean) { total += CONFIG.perfectBonus; notes.push(`+${CONFIG.perfectBonus} PERFECT`); }

    if (asteroid.y < DOM.canvas.height * CONFIG.altitudeThreshold) {
        total += CONFIG.altitudeBonus;
        notes.push(`+${CONFIG.altitudeBonus} EARLY`);
    }

    const mult = 1 + Math.floor(state.streak / CONFIG.streakInterval) * 0.5;
    if (mult > 1) { total = Math.floor(total * mult); notes.push(`x${mult.toFixed(1)}`); }

    return { total, notes, clean, mult };
}

// ============================================
// HUD & STATUS
// ============================================

function showStatus(msg, type = '') {
    DOM.status.textContent = msg;
    DOM.status.className = type;

    if (DOM.vds) {
        clearTimeout(state.timers.vds);
        DOM.vds.className = '';
        DOM.vds.classList.add(`flash-${type || 'hit'}`);
        state.timers.vds = setTimeout(() => DOM.vds.className = '', 150);
    }

    clearTimeout(state.timers.status);
    state.timers.status = setTimeout(() => { DOM.status.textContent = ''; DOM.status.className = ''; }, 2500);
}

function updateHUD() {
    DOM.score.textContent = state.score;
    DOM.streak.textContent = state.streak;

    const filled = Math.max(0, state.shieldHP);
    DOM.shields.textContent = '█'.repeat(filled) + '░'.repeat(12 - filled);

    DOM.shields.className = '';
    if (state.shieldHP > 8) DOM.shields.classList.add('shield-100');
    else if (state.shieldHP > 4) DOM.shields.classList.add('shield-50');
    else if (state.shieldHP > 0) DOM.shields.classList.add('shield-25');
    else DOM.shields.classList.add('critical');

    const names = { trainee: 'TRAINEE', mentoring: 'MENTORING', signedoff: 'SIGNED OFF', outofprob: 'OUT OF PROB', senior: 'SENIOR' };
    if (DOM.tier) DOM.tier.textContent = names[state.tier];

    const mult = 1 + Math.floor(state.streak / CONFIG.streakInterval) * 0.5;
    if (DOM.mult) DOM.mult.textContent = mult > 1 ? `x${mult.toFixed(1)}` : '';
}

function checkRegen() {
    if (state.streakSinceShieldHit >= CONFIG.shieldRegenStreak && state.shieldHP < CONFIG.maxShieldStrength) {
        state.shieldHP++;
        state.streakSinceShieldHit = 0;
        if (state.towerExposed && state.shieldHP > 0) state.towerExposed = false;
        if (state.cracks.length) state.cracks.shift();
        showStatus("SHIELD +1", "bonus");
        updateHUD();
    }
}

function checkTier() {
    for (const [name, data] of Object.entries(TIERS)) {
        if (state.score >= data.min && state.score <= data.max && name !== state.tier) {
            state.tier = name;
            state.speedMult = data.speed;
            state.spawnInterval = data.spawn;
            const names = { trainee: 'TRAINEE', mentoring: 'MENTORING', signedoff: 'SIGNED OFF', outofprob: 'OUT OF PROBATION', senior: 'SENIOR' };
            showStatus(`PROMOTED: ${names[name]}`, "bonus");
            updateHUD();
            break;
        }
    }
}

// ============================================
// AMBULANCE
// ============================================

function startAmbulance() {
    if (state.ambulance) return;
    state.towerDisabled = true;
    state.rebuilding = true;
    state.repairCount++;

    const tower = getTower();
    state.ambulance = { x: -60, y: tower.y - 100, targetX: tower.x, phase: 'incoming' };
    showStatus("REPAIR UNIT DISPATCHED", "impact");
}

function updateAmbulance(dt) {
    if (!state.ambulance) return;

    const amb = state.ambulance;
    const tower = getTower();
    const penalty = 1 + (state.repairCount - 1) * 0.5;
    const beamTime = CONFIG.beamDuration * penalty;

    if (amb.phase === 'incoming') {
        amb.x += CONFIG.ambulanceSpeed * dt;
        if (amb.x >= amb.targetX) { amb.x = amb.targetX; amb.phase = 'repairing'; state.beamActive = true; state.beamTimer = 0; }
    } else if (amb.phase === 'repairing') {
        state.beamTimer += dt * 1000;
        if (state.beamTimer >= beamTime) { state.beamActive = false; amb.phase = 'departing'; rebuildTower(); }
    } else if (amb.phase === 'departing') {
        amb.x += CONFIG.ambulanceSpeed * dt;
        if (amb.x > DOM.canvas.width + 60) {
            state.ambulance = null;
            state.rebuilding = false;
            showStatus("TOWER ONLINE — SHIELDS OFFLINE", "hit");
        }
    }
}

function rebuildTower() {
    state.towerDisabled = false;
    const tower = getTower();
    if (tower) { tower.hp = 100; tower.destroyed = false; }
    updateHUD();
}

// ============================================
// HOLODECK
// ============================================

function triggerHolodeck(isBeta = false) {
    CONFIG.isHolodeck = true;
    CONFIG.isBeta = isBeta;

    const grid = document.getElementById('holodeck-grid');
    const status = document.getElementById('simulation-status');

    if (grid) { grid.classList.remove('grid-watermark'); grid.classList.add('grid-active'); }
    if (status) { status.textContent = isBeta ? "MODE: [ HOLODECK BETA ]" : "MODE: [ HOLODECK ALPHA ]"; status.classList.add('visible'); }

    isBeta ? showBeta() : hideBeta();

    clearTimeout(state.timers.grid);
    state.timers.grid = setTimeout(() => {
        if (grid) { grid.classList.remove('grid-active'); grid.classList.add('grid-watermark'); }
    }, 5000);

    showStatus(isBeta ? "BETA MODE ACTIVE" : "HOLODECK ACTIVE", "bonus");
}

function clearHolodeck() {
    const grid = document.getElementById('holodeck-grid');
    const status = document.getElementById('simulation-status');
    if (grid) grid.classList.remove('grid-active', 'grid-watermark');
    if (status) { status.classList.remove('visible'); status.textContent = ''; }
    clearTimeout(state.timers.grid);
}

function showBeta() {
    if (document.getElementById('beta-indicator')) return;
    const el = document.createElement('div');
    el.id = 'beta-indicator';
    el.textContent = 'BETA MODE';
    document.getElementById('play-area').appendChild(el);
}

function hideBeta() {
    document.getElementById('beta-indicator')?.remove();
}

// ============================================
// TETHER PHYSICS (Spatial UI Solver)
// ============================================

function updateUIPhysics() {
    const svgLayer = document.getElementById('tether-layer');
    if (!svgLayer) return;
    
    svgLayer.innerHTML = '';

    const asteroids = state.asteroids;
    if (!asteroids.length) return;

    asteroids.forEach(asteroid => {
        const box = asteroid.challengeBox;
        if (!box) return;
        
        const targetX = asteroid.x;
        const targetY = asteroid.y - asteroid.radius - TETHER.hoverOffset;
        
        box.vx += (targetX - box.x) * TETHER.springConstant;
        box.vy += (targetY - box.y) * TETHER.springConstant;
    });

    const pad = 10;
    
    for (let i = 0; i < asteroids.length; i++) {
        for (let j = i + 1; j < asteroids.length; j++) {
            const boxA = asteroids[i].challengeBox;
            const boxB = asteroids[j].challengeBox;
            
            if (!boxA || !boxB || !boxA.width || !boxB.width) continue;
            
            const centerAy = boxA.y + (boxA.height / 2);
            const centerBy = boxB.y + (boxB.height / 2);
            
            const dx = boxA.x - boxB.x;
            const dy = centerAy - centerBy;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);
            
            const minDx = (boxA.width / 2) + (boxB.width / 2) + pad;
            const minDy = (boxA.height / 2) + (boxB.height / 2) + pad;
            
            if (absDx < minDx && absDy < minDy) {
                const overlapX = minDx - absDx;
                const overlapY = minDy - absDy;
                
                if (overlapX < overlapY) {
                    const dir = dx > 0 ? 1 : -1;
                    boxA.vx += overlapX * TETHER.repulsionForce * dir;
                    boxB.vx -= overlapX * TETHER.repulsionForce * dir;
                } else {
                    const dir = dy > 0 ? 1 : -1;
                    boxA.vy += overlapY * TETHER.repulsionForce * dir;
                    boxB.vy -= overlapY * TETHER.repulsionForce * dir;
                }
            }
        }
    }

    asteroids.forEach(asteroid => {
        const box = asteroid.challengeBox;
        if (!box) return;
        
        box.vx *= TETHER.friction;
        box.vy *= TETHER.friction;
        box.x += box.vx;
        box.y += box.vy;
        
        if (box.x < 10) box.x = 10;
        if (box.x > DOM.canvas.width - 10) box.x = DOM.canvas.width - 10;
        if (box.y < 10) box.y = 10;
        
        const targetX = asteroid.x;
        const stretchDist = Math.sqrt(
            Math.pow(targetX - box.x, 2) + 
            Math.pow((asteroid.y - asteroid.radius) - box.y, 2)
        );
        
        if (stretchDist > TETHER.tetherVisibleDistance) {
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", targetX);
            line.setAttribute("y1", asteroid.y - asteroid.radius);
            line.setAttribute("x2", box.x);
            line.setAttribute("y2", box.y + box.height / 2);
            line.setAttribute("class", "tether-line");
            svgLayer.appendChild(line);
        }
    });
}

// ============================================
// AFTERMATH VFX ENGINE
// ============================================

function updateAftermathVFX() {
    // Strict combustion palette (No more green/white confetti)
    const fireColors = [
        'rgba(255, 30, 0, 0.7)',   // Deep Red
        'rgba(255, 120, 0, 0.8)',  // Core Orange
        'rgba(255, 220, 0, 0.9)'   // Hot Yellow
    ];

    // 1. Generate Particles for Destroyed Zones
    state.defenses.forEach(zone => {
        if (!zone.destroyed && zone.type !== 'tower') return;
        if (zone.type === 'tower' && state.towerDisabled === false) return;

        // Skylon (Fire) & Welland Canal (Fire/Smoke)
        if (zone.id === 2 || zone.id === 3) {
            // Lower spawn rate, but larger overlapping particles to build a flame column
            if (Math.random() < 0.6) {
                const numParticles = 2;
                for (let k = 0; k < numParticles; k++) {
                    const isSmoke = zone.id === 3 && Math.random() > 0.7;
                    const fColor = isSmoke ? `rgba(40,40,40,0.6)` : fireColors[Math.floor(Math.random() * fireColors.length)];
                    state.environmentalParticles.push({
                        // Tighter horizontal clustering (0.3 instead of 0.6)
                        x: zone.x + (Math.random() - 0.5) * (zone.w * 0.3),
                        // Spawn deeper inside the ruins
                        y: zone.y - 10 - Math.random() * 15,
                        vx: (Math.random() - 0.5) * 0.5, // Less sideways drift
                        vy: -1.5 - Math.random() * 2,    // Faster vertical rise
                        radius: 8 + Math.random() * 12,  // Larger, overlapping blooms
                        color: fColor,
                        life: 1.0, decay: 0.03 + Math.random() * 0.02, type: 'fire'
                    });
                }
            }
        }
        
        // Robin Hood Flour (Remains tightly controlled)
        if (zone.id === 4 && Math.random() < 0.15) { 
            state.environmentalParticles.push({
                x: zone.x + (Math.random() - 0.5) * (zone.w * 0.6),
                y: zone.y - Math.random() * (zone.h * 0.4),
                vx: -1 + Math.random() * 2,
                vy: -0.2 - Math.random() * 1.0,
                radius: 5 + Math.random() * 12, 
                color: `rgba(255,255,255,0.6)`,
                life: 1.0, decay: 0.02 + Math.random() * 0.02, type: 'flour'
            });
        }
    });

    // 2. Update Particles
    for (let i = state.environmentalParticles.length - 1; i >= 0; i--) {
        const p = state.environmentalParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.radius += (p.type === 'flour') ? 0.2 : -0.1; // Fire particles shrink as they burn out
        p.life -= p.decay;
        if (p.life <= 0) state.environmentalParticles.splice(i, 1);
    }
}

function drawAftermathVFX(ctx) {
    // Draw Particles (Smoke, Fire, Flour)
    state.environmentalParticles.forEach(p => {
        ctx.fillStyle = p.color.replace(/[\d.]+\)$/g, `${p.life})`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw Hard-Coded Effects (Electricity & Elevators)
    const time = Date.now();
    state.defenses.forEach(zone => {
        if (!zone.destroyed && zone.type !== 'tower') return;
        if (zone.type === 'tower' && state.towerDisabled === false) return;

        // Sir Adam Beck (Electrical Arcs)
        if (zone.id === 1 && Math.random() < 0.15) {
            ctx.strokeStyle = Math.random() > 0.5 ? '#00ffff' : '#ffff00';
            ctx.lineWidth = 2;
            ctx.shadowColor = ctx.strokeStyle;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            let ex = zone.x - zone.w/2 + Math.random() * zone.w;
            let ey = zone.y - Math.random() * (zone.h * 0.5);
            ctx.moveTo(ex, ey);
            for(let j=0; j<4; j++) {
                ex += (Math.random() - 0.5) * 30;
                ey -= Math.random() * 30;
                ctx.lineTo(ex, ey);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Skylon Tower (Struggling Elevator)
        if (zone.id === 2) {
            const cycle = (time % 3000) / 3000; 
            const elevatorYOffset = (cycle < 0.7) ? Math.sin((cycle / 0.7) * Math.PI) * 80 : 0; 
            
            if (cycle < 0.7) {
                ctx.fillStyle = '#FFD700';
                ctx.shadowColor = '#FF6600';
                ctx.shadowBlur = 10;
                ctx.fillRect(zone.x - 15, (zone.y - 20) - elevatorYOffset, 8, 12);
                ctx.shadowBlur = 0;
            }
        }

        // Radio Tower (Tesla Coil Bolt)
        if (zone.id === 'tower' && Math.random() < 0.3) {
            ctx.strokeStyle = '#00aaff';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#00aaff';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            let tx = zone.x;
            let ty = zone.y;
            ctx.moveTo(tx, ty);
            for(let j=0; j<6; j++) {
                tx = zone.x + (Math.random() - 0.5) * 15;
                ty -= 20 + Math.random() * 10;
                ctx.lineTo(tx, ty);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    });
}

// ============================================
// GAME LOOP
// ============================================

let lastTime = 0;

function gameLoop(ts) {
    const dt = (ts - lastTime) / 1000;
    lastTime = ts;
    update(dt);
    render();
    if (state.running) requestAnimationFrame(gameLoop);
}

function update(dt) {
    if (!state.running) return;

    try {
        if (state.ambulance) updateAmbulance(dt);
        maintainAsteroids();
        updateRicochets(dt);
        updateAftermathVFX();  // Aftermath VFX update
    } catch (e) {
        console.error('Update helper failed:', e);
    }

    for (let i = state.asteroids.length - 1; i >= 0; i--) {
        try {
            const a = state.asteroids[i];
            if (!a || !a.target) {
                state.asteroids.splice(i, 1);
                continue;
            }
            
            a.x += a.vx * dt;
            a.y += a.vy * dt;
            a.rotation += a.rotSpeed * dt;

            if (a.y >= a.target.y - a.radius * 0.5) {
                createShatter(a.x, a.y, a.spriteIndex);
                damageDefense(a.target);
                state.asteroids.splice(i, 1);
            }
        } catch (e) {
            console.error('Asteroid update failed:', e);
            state.asteroids.splice(i, 1);
        }
    }

    try {
        updateUIPhysics();
    } catch (e) {
        console.error('UI Physics update failed:', e);
    }

    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        try {
            const p = state.projectiles[i];
            if (!p) {
                state.projectiles.splice(i, 1);
                continue;
            }
            
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.trail = p.trail || [];
            p.trail.push({ x: p.x, y: p.y });
            if (p.trail.length > 10) p.trail.shift();

            const target = state.asteroids.find(a => a && a.id === p.targetId);
            if (target) {
                const d = Math.sqrt((p.x - target.x) ** 2 + (p.y - target.y) ** 2);
                if (d < target.radius + 5) {
                    createExplosion(target.x, target.y);
                    createShatter(target.x, target.y, target.spriteIndex);
                    state.asteroids = state.asteroids.filter(a => a && a.id !== target.id);
                    state.projectiles.splice(i, 1);
                }
            } else if (p.y < -50 || p.y > DOM.canvas.height + 50) {
                state.projectiles.splice(i, 1);
            }
        } catch (e) {
            console.error('Projectile update failed:', e);
            state.projectiles.splice(i, 1);
        }
    }

    for (let i = state.brokenProjectiles.length - 1; i >= 0; i--) {
        try {
            const b = state.brokenProjectiles[i];
            if (!b) {
                state.brokenProjectiles.splice(i, 1);
                continue;
            }
            
            b.vy += b.g;
            b.x += b.vx;
            b.y += b.vy;
            b.smoke = b.smoke || [];
            if (Math.random() > 0.5) b.smoke.push({ x: b.x, y: b.y, life: 1 });
            for (let j = b.smoke.length - 1; j >= 0; j--) {
                b.smoke[j].life -= 0.05;
                if (b.smoke[j].life <= 0) b.smoke.splice(j, 1);
            }
            b.life -= 0.02;
            if (b.life <= 0 || b.y > DOM.canvas.height + 50) state.brokenProjectiles.splice(i, 1);
        } catch (e) {
            console.error('Broken projectile update failed:', e);
            state.brokenProjectiles.splice(i, 1);
        }
    }

    for (let i = state.explosions.length - 1; i >= 0; i--) {
        try {
            const e = state.explosions[i];
            if (!e) {
                state.explosions.splice(i, 1);
                continue;
            }
            e.radius += 2;
            e.alpha -= 0.03;
            if (e.alpha <= 0) state.explosions.splice(i, 1);
        } catch (err) {
            console.error('Explosion update failed:', err);
            state.explosions.splice(i, 1);
        }
    }
}

function damageDefense(def) {
    if (def.hp <= 0 && def.type !== 'tower') return;

    if (def.type === 'tower') {
        applyDamage(CONFIG.impactDamage, 'impact');
        return;
    }

    def.hp = 0;
    def.destroyed = true;
    createExplosion(def.x, def.y, '#ff3366', 50);
    
    showStatus(`TARGET IMPACT — IMPACT ${def.name.toUpperCase()}`, "impact");

    if (state.defenses.filter(d => d.type === 'zone' && d.hp > 0).length === 0) gameOver();
}

// ============================================
// RENDER
// ============================================

function render() {
    const ctx = DOM.ctx;
    ctx.clearRect(0, 0, DOM.canvas.width, DOM.canvas.height);

    try {
        const land = ASSETS.master_background_land;
        if (land?.complete && land.naturalWidth > 0) {
            const w = DOM.canvas.width;
            const h = (land.height / land.width) * w;
            ctx.drawImage(land, 0, DOM.canvas.height - h, w, h);
        }
    } catch (e) {
        console.error('Background render failed:', e);
    }

    // ==========================================
    // PROCEDURAL WATER INJECTION (V2.0 Update)
    // ==========================================
    const w = DOM.canvas.width;
    const s = w / 5;
    ctx.fillStyle = '#00ffff'; // Pure cyan to match the left reservoir

    // 1. Welland Canal Trench (Under the bridge deck)
    // Centers the water at s * 3.5, makes it 70px wide to fit between the towers
    ctx.fillRect((s * 3.5) - 35, DOM.canvas.height - 50, 70, 50);

    // 2. Port Colborne Coastline (Right of Robin Hood Flour)
    // Starts past the mill (s * 4.8) and fills to the right edge of the screen
    ctx.fillRect(s * 4.8, DOM.canvas.height - 40, w - (s * 4.8), 40);
    // ==========================================

    for (const d of state.defenses) {
        try {
            if (d.hp <= 0 && d.type !== 'tower') {
                const img = ASSETS[d.fileDestroyed];
                if (img?.complete && img.naturalWidth > 0) {
                    ctx.globalAlpha = 0.5;
                    ctx.drawImage(img, d.x - d.w / 2, d.y - d.h, d.w, d.h);
                    ctx.globalAlpha = 1;
                }
                continue;
            }

            ctx.save();
            if (d.type === 'tower' && state.shieldHP > 0) {
                try {
                    drawShield(ctx, d);
                } catch (shieldErr) {
                    console.error('Shield render failed:', shieldErr);
                }
            }
            if (state.towerDisabled && d.type === 'tower') ctx.globalAlpha = 0.4;

            const img = d.destroyed ? ASSETS[d.fileDestroyed] : ASSETS[d.fileIntact];
            if (img?.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, d.x - d.w / 2, d.y - d.h, d.w, d.h);
            } else {
                ctx.fillStyle = d.type === 'tower' ? '#ffd700' : '#00aaff';
                ctx.fillRect(d.x - 30, d.y - 60, 60, 60);
            }
            ctx.restore();
        } catch (e) {
            console.error(`Render failed for defense ${d.id}:`, e);
            ctx.restore();
        }
    }

    // Draw Aftermath VFX (fire, smoke, flour, electricity) — BEFORE projectiles
    try {
        drawAftermathVFX(ctx);
    } catch (e) {
        console.error('Aftermath VFX render failed:', e);
    }

    try {
        if (state.beamActive && state.ambulance) {
            const tower = getTower();
            if (tower) {
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 4;
                ctx.shadowColor = '#00ff00';
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.moveTo(state.ambulance.x, state.ambulance.y + 20);
                ctx.lineTo(tower.x, tower.y - 40);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
        }
    } catch (e) {
        console.error('Beam render failed:', e);
    }

    if (state.ambulance) {
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(state.ambulance.x - 25, state.ambulance.y, 50, 25);
        ctx.fillStyle = '#fff';
        ctx.fillRect(state.ambulance.x - 8, state.ambulance.y + 5, 16, 15);
        ctx.fillRect(state.ambulance.x - 3, state.ambulance.y + 2, 6, 21);
    }

    [...state.asteroids].forEach(a => {
        try { drawAsteroid(ctx, a); } catch (e) { console.error('Asteroid render failed:', e); }
    });

    [...state.projectiles].forEach(p => {
        try { drawProjectile(ctx, p); } catch (e) { console.error('Projectile render failed:', e); }
    });
    
    [...state.ricochetProjectiles].forEach(r => {
        try { drawRicochet(ctx, r); } catch (e) { console.error('Ricochet render failed:', e); }
    });
    
    [...state.brokenProjectiles].forEach(b => {
        try { drawBroken(ctx, b); } catch (e) { console.error('Broken projectile render failed:', e); }
    });
    
    [...state.explosions].forEach(e => {
        try { drawExplosion(ctx, e); } catch (err) { console.error('Explosion render failed:', err); }
    });
}

function drawAsteroid(ctx, a) {
    ctx.save();
    ctx.translate(a.x, a.y);

    const sprite = ASTEROID_SPRITES[a.spriteIndex];
    const size = a.radius * 4;
    
    ctx.save();
    ctx.rotate(a.rotation);
    
    if (sprite?.complete && sprite.naturalWidth > 0) {
        const glowColor = a.type === 'direction' ? '#00ff88' : '#ff6600';
        const glowIntensity = 10 + Math.sin(Date.now() / 200) * 5;
        ctx.filter = `drop-shadow(0 0 ${glowIntensity * a.glow}px ${glowColor})`;
        
        ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
        ctx.filter = 'none';
    } else {
        ctx.shadowColor = '#ff6600';
        ctx.shadowBlur = 15 * a.glow;
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.arc(0, 0, a.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5D3A1A';
        ctx.beginPath(); ctx.arc(-5, -5, a.radius * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(7, 3, a.radius * 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
    }
    ctx.restore();

    ctx.fillStyle = '#fff';
    ctx.font = "bold 16px 'Courier New'";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 5;
    ctx.fillText(a.unitID, 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();

    drawBubble(ctx, a);
}

function drawBubble(ctx, a) {
    const text = a.challenge;
    ctx.font = "bold 14px 'Courier New'";
    const tw = ctx.measureText(text).width;
    const pad = 10, w = tw + pad * 2, h = 26;

    if (a.challengeBox) {
        a.challengeBox.width = w;
        a.challengeBox.height = h;
    }

    let x, y;
    if (a.challengeBox && a.challengeBox.x !== undefined) {
        x = a.challengeBox.x - w / 2;
        y = a.challengeBox.y;
    } else {
        x = a.x - w / 2;
        y = a.y - a.radius - h - 12;
    }
    
    if (x < 4) x = 4;
    if (x + w > DOM.canvas.width - 4) x = DOM.canvas.width - w - 4;

    ctx.fillStyle = 'rgba(0,50,20,0.85)';
    ctx.fillRect(x, y, w, h);

    if (a.type === 'direction') {
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 8;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = '#00ff88';
    } else {
        drawJagged(ctx, x, y, w, h);
        ctx.fillStyle = '#ffd700';
    }

    ctx.shadowBlur = 0;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);
}

function drawJagged(ctx, x, y, w, h) {
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 8; i < w; i += 8) ctx.lineTo(x + i, y + (Math.random() - 0.5) * 3);
    ctx.lineTo(x + w, y);
    for (let i = 8; i < h; i += 8) ctx.lineTo(x + w + (Math.random() - 0.5) * 3, y + i);
    ctx.lineTo(x + w, y + h);
    for (let i = 8; i < w; i += 8) ctx.lineTo(x + w - i, y + h + (Math.random() - 0.5) * 3);
    ctx.lineTo(x, y + h);
    for (let i = 8; i < h; i += 8) ctx.lineTo(x + (Math.random() - 0.5) * 3, y + h - i);
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;
}

function drawProjectile(ctx, p) {
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    p.trail.forEach((pt, i) => { ctx.globalAlpha = i / p.trail.length * 0.5; i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y); });
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawRicochet(ctx, r) {
    ctx.strokeStyle = '#ff3366';
    ctx.lineWidth = 2;
    ctx.beginPath();
    r.trail.forEach((pt, i) => { ctx.globalAlpha = (i / r.trail.length) * 0.5 * r.life; i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y); });
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ff3366';
    ctx.shadowColor = '#ff3366';
    ctx.shadowBlur = 10 * r.life;
    ctx.beginPath();
    ctx.arc(r.x, r.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawBroken(ctx, b) {
    for (const s of b.smoke) {
        ctx.fillStyle = `rgba(100,100,100,${s.life * 0.4})`;
        ctx.beginPath();
        ctx.arc(s.x + (Math.random() - 0.5) * 5, s.y + (Math.random() - 0.5) * 5, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.fillStyle = Math.random() > 0.5 ? '#ff3366' : '#666';
    ctx.shadowColor = '#ff3366';
    ctx.shadowBlur = 8 * b.life;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawExplosion(ctx, e) {
    const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.radius);
    grad.addColorStop(0, `rgba(255,255,255,${e.alpha})`);
    grad.addColorStop(0.3, e.color + Math.floor(e.alpha * 255).toString(16).padStart(2, '0'));
    grad.addColorStop(1, 'rgba(255,68,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();
}

// ============================================
// GAME CONTROL
// ============================================

function startGame(holodeck = false) {
    Object.assign(state, {
        running: true, score: 0, shieldHP: 12, towerExposed: false, repairCount: 0,
        cracks: [], ricochetProjectiles: [], streak: 0, streakSinceShieldHit: 0,
        tier: 'trainee', speedMult: 0.6, spawnInterval: 2000,
        asteroids: [], projectiles: [], brokenProjectiles: [], explosions: [],
        towerDisabled: false, rebuilding: false, ambulance: null, beamActive: false,
        backspaces: 0, cleanHits: 0, cleanStreak: 0, environmentalParticles: []
    });
    state.usedChallenges.clear();

    CONFIG.isHolodeck = holodeck;

    initDefenses();
    clearHolodeck();
    hideBeta();

    updateHUD();
    DOM.startOverlay.classList.add('hidden');
    DOM.gameOverOverlay.classList.add('hidden');
    DOM.input.focus();

    if (holodeck) triggerHolodeck(CONFIG.isBeta);
    if (CONFIG.isBeta) showBeta();

    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function gameOver() {
    state.running = false;
    DOM.finalScore.textContent = state.score;

    const stats = document.getElementById('final-stats');
    if (stats) {
        stats.innerHTML = `
            <div>TIER: ${state.tier.toUpperCase()}</div>
            <div>PERFECT SHOTS: ${state.cleanHits}</div>
            <div>REPAIRS: ${state.repairCount}</div>
            ${CONFIG.isHolodeck ? '<div>MODE: HOLODECK</div>' : ''}
            ${CONFIG.isBeta ? '<div>MODE: BETA</div>' : ''}
        `;
    }

    clearHolodeck();
    hideBeta();
    DOM.gameOverOverlay.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', init);

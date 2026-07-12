/* ========================================================
   ASTEROID COMMAND — DATA MODULE
   CSV-driven data pipeline (replaces hardcoded arrays)
   ======================================================== */

// ============================================
// DATASETS (populated by loadGameData)
// ============================================

let DATA_ACTIONS = [];
let DATA_UNITS_FULL = [];
let DATA_LOCATIONS_FULL = [];
let BASE_LOOKUP = {};
let DATA_UNITS_SAMPLE = [
    { id: "2100", weight: 10 }, { id: "2101", weight: 10 }, { id: "2105", weight: 10 },
    { id: "2115", weight: 10 }, { id: "2120", weight: 10 }, { id: "2202", weight: 10 }
];
let DATA_LOCATIONS_SAMPLE = [];

// ============================================
// CSV PARSER (manual — no external libraries)
// ============================================

function parseCSV(text) {
    const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
    if (lines.length === 0) return [];

    const headers = parseCSVLine(lines[0]);
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const vals = parseCSVLine(lines[i]);
        const row = {};
        headers.forEach((h, j) => { row[h.trim()] = (vals[j] || '').trim(); });
        rows.push(row);
    }
    return rows;
}

function parseCSVLine(line) {
    const vals = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            vals.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    vals.push(current);
    return vals;
}

// ============================================
// ASYNC DATA LOADER
// ============================================

async function loadGameData() {
    const base = 'datasets/';
    const files = ['bases.csv', 'commands.csv', 'units.csv', 'progression.csv', 'scoring.csv'];

    let results;
    try {
        results = await Promise.all(files.map(f => fetch(base + f).then(r => {
            if (!r.ok) throw new Error(`Failed to fetch ${f}: ${r.status}`);
            return r.text();
        })));
    } catch (e) {
        console.warn('CSV fetch failed, using embedded fallback data. (' + e.message + ')');
        loadFallbackData();
        return;
    }

    const [basesText, commandsText, unitsText, progressionText, scoringText] = results;

    // --- Units ---
    const unitRows = parseCSV(unitsText);
    const unitHeader = Object.keys(unitRows[0] || {})[0] || 'Units';
    const hasUnitWeight = unitRows.length > 0 && ('Weight' in unitRows[0]);
    DATA_UNITS_FULL = unitRows.map(r => {
        const obj = { id: r[unitHeader] };
        obj.weight = hasUnitWeight ? (parseInt(r['Weight'], 10) || 5) : 5;
        return obj;
    }).filter(u => u.id);

    // --- Bases ---
    const basesRows = parseCSV(basesText);
    const hasBaseWeight = basesRows.length > 0 && ('Weight' in basesRows[0]);
    DATA_LOCATIONS_FULL = basesRows.map(r => ({
        c: r['Challenge Base'].replace(/ Base$/, ''),
        m: r['Command Base'],
        weight: hasBaseWeight ? (parseInt(r['Weight'], 10) || 5) : 5
    }));

    // --- BASE_LOOKUP: Challenge Name → Command Code ---
    Object.keys(BASE_LOOKUP).forEach(k => delete BASE_LOOKUP[k]);
    DATA_LOCATIONS_FULL.forEach(loc => { BASE_LOOKUP[loc.c] = loc.m; });

    // --- Commands ---
    const cmdRows = parseCSV(commandsText);
    const hasCmdWeight = cmdRows.length > 0 && ('Weight' in cmdRows[0]);
    DATA_ACTIONS = cmdRows.map(r => ({
        c: r['Challenge'],
        m: r['Command'],
        type: r['Type'],
        weight: hasCmdWeight ? (parseInt(r['Weight'], 10) || 5) : 5
    }));

    // --- Holodeck samples (first 6 units from the loaded dataset) ---
    DATA_UNITS_SAMPLE = DATA_UNITS_FULL.slice(0, 6);
    DATA_LOCATIONS_SAMPLE = DATA_LOCATIONS_FULL.slice(0, 5);

    // --- Progression → rebuild TIERS ---
    const progRows = parseCSV(progressionText);
    const tierKeys = [];

    // Clear existing TIERS
    Object.keys(TIERS).forEach(k => delete TIERS[k]);

    progRows.forEach(r => {
        const name = r['Rank / Tier'];
        const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        tierKeys.push(key);

        const points = parseInt(r['Points Required'].replace(/,/g, ''), 10) || 0;
        const speedMin = parseFloat((r['Speed (Min)'] || r['Speed (Max)']).replace('x', ''));
        const speedMax = parseFloat(r['Speed (Max)'].replace('x', ''));
        const spawnMinSec = parseFloat(r['Spawn (Min sec)'] || r['Spawn Time (Min sec)']);
        const spawnMaxSec = parseFloat(r['Spawn (Max sec)'] || r['Spawn (Min sec)'] || r['Spawn Time (Min sec)']);
        const maxTargets = parseInt(r['Max Targets'] || r['Max Asteroids on Screen'], 10);
        const baseHit = parseInt(r['Base Hit (Clear)'], 10) || 100;
        const impactPenalty = parseInt(r['Target Impact (Penalty)'], 10) || -50;
        const asteroidRadius = parseInt(r['Asteroid Radius'], 10) || CONFIG.asteroidRadius;
        const projectileSpeed = parseInt(r['Projectile Speed'], 10) || CONFIG.projectileSpeed;

        TIERS[key] = {
            label: name.toUpperCase(),
            min: points,
            max: Infinity,
            speedMin: speedMin,
            speedMax: speedMax,
            spawnMin: spawnMinSec * 1000,
            spawnMax: spawnMaxSec * 1000,
            maxTargets: maxTargets,
            baseHit: baseHit,
            impactPenalty: impactPenalty,
            asteroidRadius: asteroidRadius,
            projectileSpeed: projectileSpeed
        };
    });

    // Set max for each tier = next tier's min - 1
    for (let i = 0; i < tierKeys.length - 1; i++) {
        TIERS[tierKeys[i]].max = TIERS[tierKeys[i + 1]].min - 1;
    }

    // --- Scoring → update SCORING multipliers from scoring.csv v2 ---
    const scoreRows = parseCSV(scoringText);
    scoreRows.forEach(r => {
        const event = (r['Scoring Event'] || '').trim();
        const rawVal = (r['Value / Multiplier'] || '').trim();
        if (!event || event.startsWith('──') || event.startsWith('??')) return; // Skip headers

        // Multiplier bonuses (values ending in 'x')
        if (event.includes('Perfect Shot') && rawVal.endsWith('x')) {
            const v = parseFloat(rawVal.replace('x', ''));
            if (!isNaN(v)) SCORING.perfectMult = v;
        } else if (event.includes('Early Intercept') && rawVal.endsWith('x')) {
            const v = parseFloat(rawVal.replace('x', ''));
            if (!isNaN(v)) SCORING.earlyMult = v;
        } else if (event.includes('Speed Demon') && rawVal.endsWith('x')) {
            const v = parseFloat(rawVal.replace('x', ''));
            if (!isNaN(v)) SCORING.speedDemonMult = v;
        }
        // Typing penalties — tiered
        else if (event.includes('Key Dust') && rawVal.endsWith('x')) {
            const v = Math.abs(parseFloat(rawVal.replace('x', '').replace('-', '')));
            if (!isNaN(v)) SCORING.keyDustMult = v;
        } else if (event.includes('3-4 Backspaces') && rawVal.endsWith('x')) {
            const v = Math.abs(parseFloat(rawVal.replace('x', '').replace('-', '')));
            if (!isNaN(v)) SCORING.signalNoiseMult = v;
        } else if (event.includes('Comms Drift')) {
            const v = parseInt(rawVal, 10);
            if (!isNaN(v)) SCORING.commsDriftFlat = v;
        } else if (event.includes('7+ Backspaces') || (event.includes('Static Jam') && !rawVal.endsWith('x'))) {
            const v = parseInt(rawVal, 10);
            if (!isNaN(v)) SCORING.staticJamFlat = v;
        }
        // Streak milestones
        else if (event.includes('5x Perfect')) {
            const v = parseInt(rawVal, 10);
            if (!isNaN(v)) { const ms = SCORING.streakMilestones.find(m => m.threshold === 5); if (ms) ms.bonus = v; }
        } else if (event.includes('8x Perfect')) {
            const v = parseInt(rawVal, 10);
            if (!isNaN(v)) { const ms = SCORING.streakMilestones.find(m => m.threshold === 8); if (ms) ms.bonus = v; }
        } else if (event.includes('15x Perfect')) {
            const v = parseInt(rawVal, 10);
            if (!isNaN(v)) { const ms = SCORING.streakMilestones.find(m => m.threshold === 15); if (ms) ms.bonus = v; }
        } else if (event.includes('25x Perfect')) {
            const v = parseInt(rawVal, 10);
            if (!isNaN(v)) { const ms = SCORING.streakMilestones.find(m => m.threshold === 25); if (ms) ms.bonus = v; }
        }
        // Micro-rewards
        else if (event.includes('Calibration')) {
            const v = parseInt(rawVal, 10);
            if (!isNaN(v)) SCORING.calibrationFlat = v;
        } else if (event.includes('Comeback')) {
            const v = parseInt(rawVal, 10);
            if (!isNaN(v)) SCORING.comebackFlat = v;
        } else if (event.includes('First Blood')) {
            const v = parseInt(rawVal, 10);
            if (!isNaN(v)) SCORING.firstBloodFlat = v;
        } else if (event.includes('Near-Miss')) {
            const v = parseInt(rawVal, 10);
            if (!isNaN(v)) SCORING.nearMissFlat = v;
        }
    });
}

// ============================================
// FALLBACK DATA (used when CSV fetch fails, e.g. file:// protocol)
// ============================================

function loadFallbackData() {
    DATA_ACTIONS = [
        { c: "Post to", m: "AP", type: "direction", weight: 5 },
        { c: "Assign to", m: "AP", type: "direction", weight: 5 },
        { c: "Required at", m: "AP", type: "direction", weight: 5 },
        { c: "Needed at", m: "AP", type: "direction", weight: 5 },
        { c: "Enroute to", m: "ENP", type: "radio", weight: 5 },
        { c: "Mobile to", m: "ENP", type: "radio", weight: 5 },
        { c: "On our way to", m: "ENP", type: "radio", weight: 5 },
        { c: "Heading to", m: "ENP", type: "radio", weight: 5 },
        { c: "Arriving", m: "BSE", type: "radio", weight: 5 },
        { c: "Arriving at", m: "BSE", type: "radio", weight: 5 },
        { c: "Made it to", m: "BSE", type: "radio", weight: 5 },
        { c: "At", m: "BSE", type: "radio", weight: 5 },
        { c: "Mobile around", m: "LA", type: "radio", weight: 5 },
        { c: "On the air by", m: "LA", type: "radio", weight: 5 },
        { c: "Area of", m: "LA", type: "radio", weight: 5 },
        { c: "Staying local at", m: "LA", type: "radio", weight: 5 }
    ];

    // Synced with units.csv — full roster including 23xx, CARE, FIT, MHRT, bikes
    const fullUnitIds = [
        "2100","2101","2102","2103","2104","2105","2106","2107","2108","2109",
        "2110","2111","2112","2113","2114","2115","2116","2117","2118","2119",
        "2120","2121","2122","2123","2124","2125","2126","2040","2041","2042",
        "2043","2044","2045","2046","2095","2096","2097","2098","2099","2133",
        "2134","2135","2136","2130","2137","2138","2139","2150","2200","2201",
        "2202","2203","2205","2208"
    ];
    const specialUnitIds = [
        "2302","2321","2335","2336","2337","2338","2339","2345","2346",
        "2360","2361","2362","2363","2364","2365","2366","2367","2368","2369",
        "2391","2392","2393","2394","2395","2396","2397","2398",
        "2520","2521","2522","2523","2720","2721","2722","2723","2724","2725",
        "2B01","2B02"
    ];
    const namedUnits = ["FIT","MHRT","CARE1","CARE2","CARE3","CARE4","CARE5","CARE6","CARE7","CARE8"];
    DATA_UNITS_FULL = [
        ...fullUnitIds.map(id => ({ id, weight: 10 })),
        ...specialUnitIds.map(id => ({ id, weight: 2 })),
        ...namedUnits.map(id => ({ id, weight: 4 }))
    ];

    // Synced with bases.csv — includes custom weights
    DATA_LOCATIONS_FULL = [
        { c: "Niagara Falls", m: "72100", weight: 10 },
        { c: "Ontario St", m: "72101", weight: 10 },
        { c: "Linwell", m: "72102", weight: 10 },
        { c: "Thorold", m: "72103", weight: 10 },
        { c: "NOTL", m: "72104", weight: 10 },
        { c: "Grimsby", m: "72105", weight: 10 },
        { c: "Port Colborne", m: "72107", weight: 10 },
        { c: "King St", m: "72108", weight: 10 },
        { c: "Smithville", m: "72109", weight: 10 },
        { c: "Vineland", m: "72110", weight: 8 },
        { c: "Pelham", m: "72111", weight: 10 },
        { c: "Ridgeway", m: "72113", weight: 8 },
        { c: "Glendale", m: "72115", weight: 10 },
        { c: "St Paul", m: "72116", weight: 8 },
        { c: "Fort Erie", m: "72117", weight: 10 },
        { c: "Merittville", m: "72118", weight: 8 },
        { c: "HQ", m: "72120", weight: 5 },
        { c: "Fitch St", m: "72121", weight: 3 },
        { c: "Westwood", m: "72122", weight: 5 },
        { c: "Fleet", m: "72123", weight: 5 },
        { c: "Fallsview", m: "72124", weight: 2 }
    ];

    DATA_LOCATIONS_SAMPLE = DATA_LOCATIONS_FULL.slice(0, 5);

    // --- BASE_LOOKUP: Challenge Name → Command Code ---
    Object.keys(BASE_LOOKUP).forEach(k => delete BASE_LOOKUP[k]);
    DATA_LOCATIONS_FULL.forEach(loc => { BASE_LOOKUP[loc.c] = loc.m; });

    // Rebuild TIERS from fallback progression data (synced with progression.csv)
    Object.keys(TIERS).forEach(k => delete TIERS[k]);
    Object.assign(TIERS, {
        trainee:        { label: "TRAINEE",          min: 0,     max: 2000,     speedMin: 0.6, speedMax: 0.8, spawnMin: 5000, spawnMax: 6500, maxTargets: 6,  baseHit: 100,  impactPenalty: -50,  asteroidRadius: 20, projectileSpeed: 800 },
        mentoring:      { label: "MENTORING",        min: 2001,  max: 5000,     speedMin: 0.8, speedMax: 1.0, spawnMin: 4500, spawnMax: 5500, maxTargets: 8,  baseHit: 125,  impactPenalty: -60,  asteroidRadius: 19, projectileSpeed: 850 },
        signedoff:      { label: "SIGNED OFF",       min: 5001,  max: 10000,    speedMin: 1.0, speedMax: 1.2, spawnMin: 4000, spawnMax: 5000, maxTargets: 10, baseHit: 200,  impactPenalty: -100, asteroidRadius: 18, projectileSpeed: 900 },
        outofprobation: { label: "OUT OF PROBATION", min: 10001, max: 20000,    speedMin: 1.2, speedMax: 1.4, spawnMin: 3500, spawnMax: 4000, maxTargets: 12, baseHit: 300,  impactPenalty: -150, asteroidRadius: 17, projectileSpeed: 1000 },
        "2yearsin":     { label: "2 YEARS IN",       min: 20001, max: 35000,    speedMin: 1.5, speedMax: 1.8, spawnMin: 3000, spawnMax: 3500, maxTargets: 14, baseHit: 450,  impactPenalty: -225, asteroidRadius: 16, projectileSpeed: 1100 },
        fulltime:       { label: "FULL TIME",        min: 35001, max: 55000,    speedMin: 1.8, speedMax: 2.2, spawnMin: 2500, spawnMax: 3000, maxTargets: 16, baseHit: 600,  impactPenalty: -300, asteroidRadius: 15, projectileSpeed: 1200 },
        veteran:        { label: "VETERAN",          min: 55001, max: 80000,    speedMin: 2.5, speedMax: 3.0, spawnMin: 1500, spawnMax: 2000, maxTargets: 20, baseHit: 850,  impactPenalty: -500, asteroidRadius: 14, projectileSpeed: 1300 },
        oas:            { label: "O.A.S",            min: 80001, max: Infinity, speedMin: 3.0, speedMax: 4.0, spawnMin: 800,  spawnMax: 1200, maxTargets: 25, baseHit: 1200, impactPenalty: -600, asteroidRadius: 13, projectileSpeed: 1400 }
    });
}

// ============================================
// LIVE DATASET RELOAD (called from Holodeck)
// ============================================

async function reloadAllCSVs() {
    const statusEl = document.getElementById('dataset-status');
    const btn = document.getElementById('update-datasets-btn');

    if (statusEl) { statusEl.textContent = 'LOADING...'; statusEl.className = 'dataset-status loading'; }
    if (btn) btn.disabled = true;

    // Try fetch first (works when served via HTTP). Fall back to file picker (for file:// protocol).
    let results;
    try {
        const base = 'datasets/';
        const files = ['bases.csv', 'commands.csv', 'units.csv', 'progression.csv', 'scoring.csv'];
        results = await Promise.all(files.map(f =>
            fetch(base + f, { cache: 'no-store' }).then(r => {
                if (!r.ok) throw new Error(`${f}: ${r.status}`);
                return r.text();
            })
        ));
    } catch (fetchErr) {
        // Fetch failed (likely file:// protocol) — use file picker
        console.warn('[UPDATE DATASETS] Fetch failed, opening file picker...', fetchErr.message);
        if (statusEl) { statusEl.textContent = 'SELECT YOUR 5 CSV FILES...'; statusEl.className = 'dataset-status loading'; }
        try {
            results = await pickCSVFiles();
        } catch (pickErr) {
            console.error('[UPDATE DATASETS] File picker failed:', pickErr);
            if (statusEl) { statusEl.textContent = '✗ ' + pickErr.message; statusEl.className = 'dataset-status error'; }
            if (btn) btn.disabled = false;
            return;
        }
    }

    try {
        applyCSVData(results);
    } catch (e) {
        console.error('[UPDATE DATASETS] Parse error:', e);
        if (statusEl) { statusEl.textContent = '✗ Parse error: ' + e.message; statusEl.className = 'dataset-status error'; }
    } finally {
        if (btn) btn.disabled = false;
    }
}

// File picker fallback — opens a multi-file dialog for the 5 CSVs
function pickCSVFiles() {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '.csv';

        input.addEventListener('change', () => {
            const fileMap = {};
            for (const file of input.files) {
                const name = file.name.toLowerCase();
                if (name.includes('bases'))       fileMap.bases = file;
                else if (name.includes('command')) fileMap.commands = file;
                else if (name.includes('unit'))    fileMap.units = file;
                else if (name.includes('progress'))fileMap.progression = file;
                else if (name.includes('scor'))    fileMap.scoring = file;
            }

            const required = ['bases', 'commands', 'units', 'progression', 'scoring'];
            const missing = required.filter(k => !fileMap[k]);
            if (missing.length > 0) {
                reject(new Error('Missing: ' + missing.join(', ') + '.csv'));
                return;
            }

            Promise.all(required.map(k => fileMap[k].text()))
                .then(resolve)
                .catch(reject);
        });

        input.addEventListener('cancel', () => {
            reject(new Error('Cancelled'));
        });

        input.click();
    });
}

// Shared parsing logic — takes [basesText, commandsText, unitsText, progressionText, scoringText]
function applyCSVData(results) {
    const statusEl = document.getElementById('dataset-status');
    const [basesText, commandsText, unitsText, progressionText, scoringText] = results;

    // --- Re-parse Units ---
    const unitRows = parseCSV(unitsText);
    const unitHeader = Object.keys(unitRows[0] || {})[0] || 'Units';
    const hasUnitWeight = unitRows.length > 0 && ('Weight' in unitRows[0]);
    DATA_UNITS_FULL = unitRows.map(r => {
        const obj = { id: r[unitHeader] };
        obj.weight = hasUnitWeight ? (parseInt(r['Weight'], 10) || 5) : 5;
        return obj;
    }).filter(u => u.id);

    // --- Re-parse Bases ---
    const basesRows = parseCSV(basesText);
    const hasBaseWeight = basesRows.length > 0 && ('Weight' in basesRows[0]);
    DATA_LOCATIONS_FULL = basesRows.map(r => ({
        c: r['Challenge Base'].replace(/ Base$/, ''),
        m: r['Command Base'],
        weight: hasBaseWeight ? (parseInt(r['Weight'], 10) || 5) : 5
    }));

    // --- BASE_LOOKUP: Challenge Name → Command Code ---
    Object.keys(BASE_LOOKUP).forEach(k => delete BASE_LOOKUP[k]);
    DATA_LOCATIONS_FULL.forEach(loc => { BASE_LOOKUP[loc.c] = loc.m; });

    // --- Re-parse Commands ---
    const cmdRows = parseCSV(commandsText);
    const hasCmdWeight = cmdRows.length > 0 && ('Weight' in cmdRows[0]);
    DATA_ACTIONS = cmdRows.map(r => ({
        c: r['Challenge'],
        m: r['Command'],
        type: r['Type'],
        weight: hasCmdWeight ? (parseInt(r['Weight'], 10) || 5) : 5
    }));

    // --- Re-compute holodeck samples ---
    DATA_UNITS_SAMPLE = DATA_UNITS_FULL.slice(0, 6);
    DATA_LOCATIONS_SAMPLE = DATA_LOCATIONS_FULL.slice(0, 5);

    // --- Re-parse Progression ---
    const progRows = parseCSV(progressionText);
    const tierKeys = [];
    Object.keys(TIERS).forEach(k => delete TIERS[k]);
    progRows.forEach(r => {
        const name = r['Rank / Tier'];
        const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        tierKeys.push(key);
        const points = parseInt(r['Points Required'].replace(/,/g, ''), 10) || 0;
        const speedMin = parseFloat((r['Speed (Min)'] || r['Speed (Max)']).replace('x', ''));
        const speedMax = parseFloat(r['Speed (Max)'].replace('x', ''));
        const spawnMinSec = parseFloat(r['Spawn (Min sec)'] || r['Spawn Time (Min sec)']);
        const spawnMaxSec = parseFloat(r['Spawn (Max sec)'] || r['Spawn (Min sec)'] || r['Spawn Time (Min sec)']);
        const maxTargets = parseInt(r['Max Targets'] || r['Max Asteroids on Screen'], 10);
        const baseHit = parseInt(r['Base Hit (Clear)'], 10) || 100;
        const impactPenalty = parseInt(r['Target Impact (Penalty)'], 10) || -50;
        const asteroidRadius = parseInt(r['Asteroid Radius'], 10) || CONFIG.asteroidRadius;
        const projectileSpeed = parseInt(r['Projectile Speed'], 10) || CONFIG.projectileSpeed;
        TIERS[key] = {
            label: name.toUpperCase(), min: points, max: Infinity,
            speedMin, speedMax, spawnMin: spawnMinSec * 1000, spawnMax: spawnMaxSec * 1000,
            maxTargets, baseHit, impactPenalty, asteroidRadius, projectileSpeed
        };
    });
    for (let i = 0; i < tierKeys.length - 1; i++) {
        TIERS[tierKeys[i]].max = TIERS[tierKeys[i + 1]].min - 1;
    }

    // --- Re-parse Scoring ---
    const scoreRows = parseCSV(scoringText);
    scoreRows.forEach(r => {
        const event = (r['Scoring Event'] || '').trim();
        const rawVal = (r['Value / Multiplier'] || '').trim();
        if (!event || event.startsWith('──') || event.startsWith('??')) return;
        if (event.includes('Perfect Shot') && rawVal.endsWith('x')) { const v = parseFloat(rawVal.replace('x', '')); if (!isNaN(v)) SCORING.perfectMult = v; }
        else if (event.includes('Early Intercept') && rawVal.endsWith('x')) { const v = parseFloat(rawVal.replace('x', '')); if (!isNaN(v)) SCORING.earlyMult = v; }
        else if (event.includes('Speed Demon') && rawVal.endsWith('x')) { const v = parseFloat(rawVal.replace('x', '')); if (!isNaN(v)) SCORING.speedDemonMult = v; }
        else if (event.includes('Key Dust') && rawVal.endsWith('x')) { const v = Math.abs(parseFloat(rawVal.replace('x', '').replace('-', ''))); if (!isNaN(v)) SCORING.keyDustMult = v; }
        else if (event.includes('3-4 Backspaces') && rawVal.endsWith('x')) { const v = Math.abs(parseFloat(rawVal.replace('x', '').replace('-', ''))); if (!isNaN(v)) SCORING.signalNoiseMult = v; }
        else if (event.includes('Comms Drift')) { const v = parseInt(rawVal, 10); if (!isNaN(v)) SCORING.commsDriftFlat = v; }
        else if (event.includes('7+ Backspaces') || (event.includes('Static Jam') && !rawVal.endsWith('x'))) { const v = parseInt(rawVal, 10); if (!isNaN(v)) SCORING.staticJamFlat = v; }
        else if (event.includes('5x Perfect')) { const v = parseInt(rawVal, 10); if (!isNaN(v)) { const ms = SCORING.streakMilestones.find(m => m.threshold === 5); if (ms) ms.bonus = v; } }
        else if (event.includes('8x Perfect')) { const v = parseInt(rawVal, 10); if (!isNaN(v)) { const ms = SCORING.streakMilestones.find(m => m.threshold === 8); if (ms) ms.bonus = v; } }
        else if (event.includes('15x Perfect')) { const v = parseInt(rawVal, 10); if (!isNaN(v)) { const ms = SCORING.streakMilestones.find(m => m.threshold === 15); if (ms) ms.bonus = v; } }
        else if (event.includes('25x Perfect')) { const v = parseInt(rawVal, 10); if (!isNaN(v)) { const ms = SCORING.streakMilestones.find(m => m.threshold === 25); if (ms) ms.bonus = v; } }
        else if (event.includes('Calibration')) { const v = parseInt(rawVal, 10); if (!isNaN(v)) SCORING.calibrationFlat = v; }
        else if (event.includes('Comeback')) { const v = parseInt(rawVal, 10); if (!isNaN(v)) SCORING.comebackFlat = v; }
        else if (event.includes('First Blood')) { const v = parseInt(rawVal, 10); if (!isNaN(v)) SCORING.firstBloodFlat = v; }
        else if (event.includes('Near-Miss')) { const v = parseInt(rawVal, 10); if (!isNaN(v)) SCORING.nearMissFlat = v; }
    });

    // --- Rebuild God Mode menu if open ---
    if (typeof buildGodModeMenu === 'function') buildGodModeMenu();

    // --- Show success ---
    const summary = `LOADED: ${DATA_UNITS_FULL.length} units, ${DATA_LOCATIONS_FULL.length} bases, ${DATA_ACTIONS.length} commands, ${Object.keys(TIERS).length} ranks`;
    console.log('[UPDATE DATASETS] ' + summary);
    if (statusEl) { statusEl.textContent = '✓ ' + summary; statusEl.className = 'dataset-status success'; }
    if (typeof showStatus === 'function') showStatus('DATASETS UPDATED', 'bonus');

    // Clear status after 8 seconds
    setTimeout(() => { if (statusEl) { statusEl.textContent = ''; statusEl.className = 'dataset-status'; } }, 8000);
}

// ============================================
// WEIGHTED RANDOM SELECTION
// ============================================

function weightedRandom(items) {
    const totalWeight = items.reduce((sum, item) => sum + (item.weight || 5), 0);
    let roll = Math.random() * totalWeight;
    for (let i = 0; i < items.length; i++) {
        roll -= (items[i].weight || 5);
        if (roll <= 0) return items[i];
    }
    return items[items.length - 1]; // safety fallback
}

// ============================================
// TIERED DIFFICULTY — setTier()
// Dynamically scales fallSpeed, spawnRate, maxTargets
// based on the 8 dispatcher ranks (Trainee → O.A.S)
// ============================================

function setTier(tierKey) {
    const data = TIERS[tierKey];
    if (!data) {
        console.warn('[setTier] Unknown tier:', tierKey);
        return false;
    }
    state.tier = tierKey;
    state.speedMult = data.speedMax;
    state.spawnInterval = data.spawnMin;
    state.maxTargets = data.maxTargets;
    CONFIG.asteroidRadius = data.asteroidRadius;
    CONFIG.projectileSpeed = data.projectileSpeed;
    return true;
}

function getTierForScore(score) {
    for (const [key, data] of Object.entries(TIERS)) {
        if (score >= data.min && score <= data.max) return key;
    }
    return 'trainee';
}

// ============================================
// CHALLENGE GENERATION (Non-Recursive)
// ============================================

function getTargetSpecs() {
    let baseUnits = CONFIG.isHolodeck ? DATA_UNITS_SAMPLE : DATA_UNITS_FULL;
    let baseLocs  = CONFIG.isHolodeck ? DATA_LOCATIONS_SAMPLE : DATA_LOCATIONS_FULL;
    let baseActions = DATA_ACTIONS;

    // God Mode filters (holodeck only)
    if (CONFIG.isHolodeck) {
        if (godMode.activeCommands && godMode.activeCommands.size > 0) {
            baseActions = DATA_ACTIONS.filter(a => godMode.activeCommands.has(a.m));
        }
        if (godMode.activeUnits && godMode.activeUnits.size > 0) {
            baseUnits = baseUnits.filter(u => godMode.activeUnits.has(u.id));
        }
        if (godMode.activeBases && godMode.activeBases.size > 0) {
            baseLocs = baseLocs.filter(l => godMode.activeBases.has(l.m));
        }
        // Fallback if user deselected everything
        if (baseActions.length === 0) baseActions = DATA_ACTIONS;
        if (baseUnits.length === 0) baseUnits = CONFIG.isHolodeck ? DATA_UNITS_SAMPLE : DATA_UNITS_FULL;
        if (baseLocs.length === 0) baseLocs = CONFIG.isHolodeck ? DATA_LOCATIONS_SAMPLE : DATA_LOCATIONS_FULL;
    }

    const units = baseUnits;
    const locs = baseLocs;

    let action, unit, loc, unitID, key;
    let attempts = 0;

    do {
        action = weightedRandom(baseActions);
        unit = weightedRandom(units);
        loc = weightedRandom(locs);
        unitID = typeof unit === 'string' ? unit : unit.id;
        key = `${action.m}-${unitID}-${loc.m}`;
        attempts++;
    } while (state.usedChallenges.has(key) && attempts < 25);

    if (attempts >= 25 || state.usedChallenges.size >= 400) {
        state.usedChallenges.clear();
    }

    state.usedChallenges.add(key);

    return {
        unitID: unitID,
        challenge: `${action.c} ${loc.c}`,
        command: `${action.m} ${unitID} ${loc.m}`,
        type: action.type
    };
}

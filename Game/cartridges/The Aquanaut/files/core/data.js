/* ========================================================
   THE AQUANAUT — BELOW THE BLACK — DATA MODULE
   CSV-driven data pipeline (replaces hardcoded arrays)
   ======================================================== */

// ============================================
// DATASETS (populated by loadGameData)
// ============================================

let DATA_UNITS_FULL = [];
let DATA_LOCATIONS_FULL = [];
let BASE_LOOKUP = {};
let DATA_POOLS = {};          // Token pools: { 'Incidents': ['001','002',...], 'Hospitals': [{name,cmd1,cmd2},...] }
let DATA_HOSPITALS = [];      // Parsed hospitals with dual commands
let HOSPITAL_ALIAS_LOOKUP = []; // Flat list for autocomplete: [{alias, canonical, hospitalName}]
let DATA_POWERLINE = {};      // PowerLine prompts keyed by command code: { NTF: { segments: [...], description: '...' } }
let DATA_COM_CALLS = [];      // COM radio-call bonus pool: [{ statement, keywords: ['stopped','train'] }]
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

    const allHeaders = parseCSVLine(lines[0]);
    // Deduplicate headers — only use the first occurrence of each column name
    // (Excel exports may repeat the header block across thousands of columns)
    const seen = new Set();
    const uniqueCount = allHeaders.findIndex((h, i) => {
        const key = h.trim();
        if (seen.has(key)) return true;
        seen.add(key);
        return false;
    });
    const headerCount = uniqueCount > 0 ? uniqueCount : allHeaders.length;
    const headers = allHeaders.slice(0, headerCount);

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
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';   // escaped "" → literal "
                    i++;              // skip next quote
                } else {
                    inQuotes = false; // closing quote
                }
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;      // opening quote
            } else if (ch === ',') {
                vals.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
    }
    vals.push(current);
    return vals;
}

// ============================================
// AUXILIARY POOL PARSER (Incident #s, Hospitals)
// ============================================

function parseAuxiliaryPools(auxResults) {
    const [incidentsText, hospitalsText] = auxResults;

    // --- Incident Numbers ---
    // Store under both 'Incidents' (legacy) and 'Incident #s' (CSV token name)
    DATA_POOLS['Incidents'] = [];
    if (incidentsText) {
        const incRows = parseCSV(incidentsText);
        const incHeader = Object.keys(incRows[0] || {})[0] || 'INC#s';
        DATA_POOLS['Incidents'] = incRows.map(r => r[incHeader]).filter(v => v);
    }
    if (DATA_POOLS['Incidents'].length === 0) {
        for (let i = 1; i <= 999; i++) DATA_POOLS['Incidents'].push(String(i).padStart(3, '0'));
    }
    DATA_POOLS['Incident #s'] = DATA_POOLS['Incidents'];

    // --- Hospitals (dual command codes) ---
    DATA_HOSPITALS = [];
    HOSPITAL_ALIAS_LOOKUP = [];
    if (hospitalsText) {
        const hospRows = parseCSV(hospitalsText);
        DATA_HOSPITALS = hospRows.map(r => {
            // hospitals.csv columns: "Challenge - Full Name", Command1, Command2.
            // (The old spoken-abbreviation columns "Challenge V1–V3" no longer exist
            // in the CSV, so they are not read.)
            const fullName = (r['Challenge - Full Name'] || r['Challenge'] || '').trim();
            return {
                name: fullName,
                variants: fullName ? [fullName] : [],
                cmd1: (r['Command1'] || '').trim(),
                cmd2: (r['Command2'] || '').trim()
            };
        }).filter(h => h.variants.length > 0 && (h.cmd1 || h.cmd2));

        // Build flat alias lookup for autocomplete
        DATA_HOSPITALS.forEach(h => {
            if (h.cmd1) HOSPITAL_ALIAS_LOOKUP.push({ alias: h.cmd1, canonical: h.cmd1, alt: h.cmd2, hospitalName: h.name });
            if (h.cmd2) HOSPITAL_ALIAS_LOOKUP.push({ alias: h.cmd2, canonical: h.cmd1, alt: h.cmd2, hospitalName: h.name });
        });
    }
    if (DATA_HOSPITALS.length === 0) {
        // Fallback hospitals
        DATA_HOSPITALS = [
            { name: 'SCS', variants: ['SCS', 'St Catharines'], cmd1: '/23000', cmd2: 'NHS-SCS' },
            { name: 'WCGH', variants: ['WCGH', 'Welland', 'The County'], cmd1: '/4227', cmd2: 'NHS-WCH' },
            { name: 'GNGH', variants: ['GNGH', 'GNG'], cmd1: '/4213', cmd2: 'NHS-GNG' },
            { name: 'WLMH', variants: ['WLMH', 'West Lincoln', 'WL Memorial'], cmd1: '/1538', cmd2: 'HHS-WLMH' }
        ];
        DATA_HOSPITALS.forEach(h => {
            if (h.cmd1) HOSPITAL_ALIAS_LOOKUP.push({ alias: h.cmd1, canonical: h.cmd1, alt: h.cmd2, hospitalName: h.name });
            if (h.cmd2) HOSPITAL_ALIAS_LOOKUP.push({ alias: h.cmd2, canonical: h.cmd1, alt: h.cmd2, hospitalName: h.name });
        });
    }

    // Store hospitals pool with all variants for ! token resolution
    DATA_POOLS['Hospitals'] = DATA_HOSPITALS.flatMap(h => h.variants);
}

// Resolve a !Token — returns a rolled value from the named pool
function resolveToken(token) {
    if (!token || !token.startsWith('!')) return null;
    const poolName = token.substring(1);
    const pool = DATA_POOLS[poolName];
    if (!pool || pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
}

// Parse pipe-delimited color string: "Hex1 | Hex2" → { bg, fg }
function parsePipeColor(raw) {
    if (!raw) return null;
    // Format: "Name / Name (#HEX1 / #HEX2)" — extract the hex codes
    const hexMatch = raw.match(/#([0-9A-Fa-f]{3,8})\s*\/\s*#([0-9A-Fa-f]{3,8})/);
    if (hexMatch) return { bg: '#' + hexMatch[1], fg: '#' + hexMatch[2] };
    // Legacy pipe-separated format: "bg | fg"
    if (raw.includes('|')) {
        const parts = raw.split('|');
        return { bg: parts[0].trim(), fg: parts[1].trim() };
    }
    return null;
}

// ============================================
// ASYNC DATA LOADER
// ============================================

async function loadGameData() {
    const base = 'datasets/';
    // Reorganized 2026-06-20: the challenge package lives in Gameplay/, engine mechanics
    // in Game_mechanics/. The flat challenges_commands.csv is fully retired (2026-06-20):
    // spawns come from the Gameplay/ package (generateStageSpec) and command validation /
    // the God-Mode menu read the lifecycle stages (LIFECYCLE_STAGES) directly.
    const coreFiles = ['Gameplay/units.csv', 'Game_mechanics/game_difficulty_progression.csv', 'Game_mechanics/scoring.csv'];
    const auxFiles = ['Gameplay/inc_numbers.csv', 'Gameplay/hospitals.csv'];

    let results;
    try {
        results = await Promise.all(coreFiles.map(f => fetch(base + f, { cache: 'no-store' }).then(r => {
            if (!r.ok) throw new Error(`Failed to fetch ${f}: ${r.status}`);
            return r.text();
        })));
    } catch (e) {
        console.warn('CSV fetch failed, using embedded fallback data. (' + e.message + ')');
        loadFallbackData();
        return;
    }

    // Load auxiliary CSVs (non-fatal if missing)
    const auxResults = await Promise.all(auxFiles.map(f =>
        fetch(base + f, { cache: 'no-store' }).then(r => r.ok ? r.text() : null).catch(() => null)
    ));
    parseAuxiliaryPools(auxResults);

    // bases.csv is retired (an Asteroid Command concept — Aquanaut has no bases).
    const basesText = null;

    // Load PowerLine prompts (non-fatal)
    const powerlineText = await fetch(base + 'Game_mechanics/powerline_prompts.csv', { cache: 'no-store' }).then(r => r.ok ? r.text() : null).catch(() => null);
    if (powerlineText) parsePowerlinePrompts(powerlineText);

    // Load COM radio-call bonus pool (non-fatal)
    const comCallsText = await fetch(base + 'Gameplay/com_radio_calls.csv', { cache: 'no-store' }).then(r => r.ok ? r.text() : null).catch(() => null);
    parseComRadioCalls(comCallsText);

    const [unitsText, progressionText, scoringText] = results;

    // The parsing below runs OUTSIDE the fetch try/catch above. Guard it so a core CSV
    // that fetches 200 but is structurally malformed degrades to the embedded fallback,
    // instead of throwing past loadGameData() and leaving TIERS/SCORING half-built.
    try {

    // --- Units ---
    const unitRows = parseCSV(unitsText);
    const unitHeader = Object.keys(unitRows[0] || {})[0] || 'Units';
    const hasUnitWeight = unitRows.length > 0 && ('Weight' in unitRows[0]);
    DATA_UNITS_FULL = unitRows.map(r => {
        const obj = { id: r[unitHeader] };
        obj.weight = hasUnitWeight ? (parseInt(r['Weight'], 10) || 5) : 5;
        return obj;
    }).filter(u => u.id);

    // --- Bases (optional — uses fallback if bases.csv is missing) ---
    if (basesText) {
        const basesRows = parseCSV(basesText);
        const hasBaseWeight = basesRows.length > 0 && ('Weight' in basesRows[0]);
        DATA_LOCATIONS_FULL = basesRows.map(r => ({
            c: r['Challenge Base'].replace(/ Base$/, ''),
            m: r['Command Base'],
            weight: hasBaseWeight ? (parseInt(r['Weight'], 10) || 5) : 5
        }));
    }

    // --- BASE_LOOKUP: Challenge Name → Command Code ---
    Object.keys(BASE_LOOKUP).forEach(k => delete BASE_LOOKUP[k]);
    DATA_LOCATIONS_FULL.forEach(loc => { BASE_LOOKUP[loc.c] = loc.m; });

    // --- Holodeck samples (first 6 units from the loaded dataset) ---
    DATA_UNITS_SAMPLE = DATA_UNITS_FULL.slice(0, 6);
    DATA_LOCATIONS_SAMPLE = DATA_LOCATIONS_FULL.slice(0, 5);

    // --- Progression → rebuild TIERS ---
    const progRows = parseCSV(progressionText);
    const tierKeys = [];

    // Clear existing TIERS
    Object.keys(TIERS).forEach(k => delete TIERS[k]);

    progRows.forEach(r => {
        const name = (r['Rank / Tier'] || '').trim();
        if (!name) return;   // skip blank/malformed rows rather than throwing on a missing required column
        const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        tierKeys.push(key);

        const points = parseInt((r['Points Required'] || '0').replace(/,/g, ''), 10) || 0;
        const speedMin = parseFloat((r['Speed (Min)'] || r['Speed (Max)'] || '1x').replace('x', ''));
        const speedMax = parseFloat((r['Speed (Max)'] || r['Speed (Min)'] || '1x').replace('x', ''));
        const spawnMinSec = parseFloat(r['Spawn (Min sec)'] || r['Spawn Time (Min sec)']);
        const spawnMaxSec = parseFloat(r['Spawn (Max sec)'] || r['Spawn (Min sec)'] || r['Spawn Time (Min sec)']);
        const maxTargets = parseInt(r['Max Targets'] || r['Max Asteroids on Screen'], 10);
        const baseHit = parseInt(r['Base Hit (Clear)'], 10) || 100;
        const impactPenalty = parseInt(r['Target Impact (Penalty)'], 10) || -50;
        const creatureRadius = parseInt(r['Asteroid Radius'] || r['Creature Radius'], 10) || CONFIG.creatureRadius;
        const sonarSpeed = parseInt(r['Projectile Speed'] || r['Sonar Speed'], 10) || CONFIG.sonarPulseSpeed;

        // TOC Monitor columns — separate spawn/advance/despawn cadence for the
        // circle-beneath-the-Aquanaut units. CSV is seconds; stored as ms (matching
        // the other timers). Bed Assign % is stored as a 0–1 fraction.
        const tocSpawnMinSec = parseFloat(r['TOC Spawn (Min sec)'] || '8');
        const tocSpawnMaxSec = parseFloat(r['TOC Spawn (Max sec)'] || '12');
        const tocActiveMin = parseInt(r['TOC Active (Min)'] || '1', 10);
        const tocActiveMax = parseInt(r['TOC Active (Max)'] || '2', 10);
        // Time for a TOC unit to become ACTIVE (the White→Pink→Blue offload flip delay).
        // CSV is seconds; stored as ms. Default 40–120 s (min 40 s before it can happen).
        const tocOffloadMinSec = parseFloat(r['TOC Offload (Min sec)'] || '40');
        const tocOffloadMaxSec = parseFloat(r['TOC Offload (Max sec)'] || '120');
        const tocDespawnMinSec = parseFloat(r['TOC Despawn (Min sec)'] || '15');
        const tocDespawnMaxSec = parseFloat(r['TOC Despawn (Max sec)'] || '25');
        const bedAssignPercent = parseInt(r['Bed Assign %'] || '40', 10);

        // TOC patrol movement knobs (the seabed back-and-forth). All optional — defaults
        // match the embedded fallback so an older CSV without these columns is unchanged.
        // The band is given as percent-down-screen (68 = 68%); stored as 0–1 fractions.
        const tocBandTopPct = parseFloat(r['TOC Band Top Y%'] || '68') / 100;
        const tocBandBotPct = parseFloat(r['TOC Band Bottom Y%'] || '95') / 100;
        const tocPatrolAmpMin = parseFloat(r['TOC Patrol Amp Min'] || '90');
        const tocPatrolAmpMax = parseFloat(r['TOC Patrol Amp Max'] || '160');
        const tocPatrolSpeedMin = parseFloat(r['TOC Patrol Speed Min'] || '0.45');
        const tocPatrolSpeedMax = parseFloat(r['TOC Patrol Speed Max'] || '0.85');
        const tocBobAmp = parseFloat(r['TOC Bob Amp'] || '14');

        // Sonar sweep reveal — the screen-wide sweep arm is a clock; these are
        // positions in DEGREES past each target's own 12 o'clock (where the arm
        // first crosses it). Sweep Period turns those angles into real reading
        // time (the per-level difficulty dial). See drawBubble in script.js.
        const sweep = {
            periodSec:   parseFloat(r['Sweep Period (sec)'] || '6'),
            unitAppear:  parseFloat(r['Unit Appear (deg)']  || '0'),
            unitFade:    parseFloat(r['Unit Fade (deg)']    || '180'),
            unitClear:   parseFloat(r['Unit Clear (deg)']   || '270'),
            chalWipeEnd: parseFloat(r['Chal Wipe End (deg)']|| '180'),
            chalFade:    parseFloat(r['Chal Fade (deg)']    || '270'),
            chalClear:   parseFloat(r['Chal Clear (deg)']   || '330'),
            chalMode:   (r['Chal Reveal Mode'] || 'cumulative').trim().toLowerCase(),
            chalFrac:    parseFloat(r['Chal Reveal Frac']   || '1')
        };

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
            creatureRadius: creatureRadius,
            sonarSpeed: sonarSpeed,
            tocSpawnMin: tocSpawnMinSec * 1000,
            tocSpawnMax: tocSpawnMaxSec * 1000,
            tocActiveMin: tocActiveMin,
            tocActiveMax: tocActiveMax,
            tocOffloadMin: tocOffloadMinSec * 1000,
            tocOffloadMax: tocOffloadMaxSec * 1000,
            tocDespawnMin: tocDespawnMinSec * 1000,
            tocDespawnMax: tocDespawnMaxSec * 1000,
            bedAssignChance: bedAssignPercent / 100,
            tocBandTopPct: tocBandTopPct,
            tocBandBotPct: tocBandBotPct,
            tocPatrolAmpMin: tocPatrolAmpMin,
            tocPatrolAmpMax: tocPatrolAmpMax,
            tocPatrolSpeedMin: tocPatrolSpeedMin,
            tocPatrolSpeedMax: tocPatrolSpeedMax,
            tocBobAmp: tocBobAmp,
            sweep: sweep
        };
    });

    // Assign depth & cone data (not in CSV — derived from tier index)
    const DEPTH_MAP = [
        { depth: 30,   depthMin: 0,    depthMax: 100,  coneAngle: 55 },
        { depth: 150,  depthMin: 100,  depthMax: 400,  coneAngle: 42 },
        { depth: 500,  depthMin: 400,  depthMax: 1000, coneAngle: 30 },
        { depth: 1000, depthMin: 1000, depthMax: 4000, coneAngle: 20 }
    ];
    tierKeys.forEach((k, i) => {
        const dm = DEPTH_MAP[i] || DEPTH_MAP[DEPTH_MAP.length - 1];
        Object.assign(TIERS[k], dm);
    });

    // Set max for each tier = next tier's min - 1
    for (let i = 0; i < tierKeys.length - 1; i++) {
        TIERS[tierKeys[i]].max = TIERS[tierKeys[i + 1]].min - 1;
    }

    // --- Scoring → update SCORING multipliers from scoring.csv v2 ---
    // scoring.csv carries two banner rows ("SCORING SYSTEM" + a blank line) BEFORE its
    // real header, so parseCSV's line-0 header detection would mis-read it and silently
    // skip every row (the whole file was effectively dead). Trim to the real header
    // ("Scoring Event,...") first so the CSV actually drives SCORING.
    const scoringLines = scoringText.replace(/\r/g, '').split('\n');
    const scoringHeaderIdx = scoringLines.findIndex(l => l.startsWith('Scoring Event'));
    const scoringForParse = scoringHeaderIdx > 0 ? scoringLines.slice(scoringHeaderIdx).join('\n') : scoringText;
    const scoreRows = parseCSV(scoringForParse);
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
        // Streak milestones — match the LONGEST token first: '15x Perfect' and
        // '25x Perfect' both CONTAIN the substring '5x Perfect', so 5x must be tested
        // LAST or it would swallow the 15x/25x rows (and inflate the 5x bonus).
        else if (event.includes('25x Perfect')) {
            const v = parseInt(rawVal, 10);
            if (!isNaN(v)) { const ms = SCORING.streakMilestones.find(m => m.threshold === 25); if (ms) ms.bonus = v; }
        } else if (event.includes('15x Perfect')) {
            const v = parseInt(rawVal, 10);
            if (!isNaN(v)) { const ms = SCORING.streakMilestones.find(m => m.threshold === 15); if (ms) ms.bonus = v; }
        } else if (event.includes('8x Perfect')) {
            const v = parseInt(rawVal, 10);
            if (!isNaN(v)) { const ms = SCORING.streakMilestones.find(m => m.threshold === 8); if (ms) ms.bonus = v; }
        } else if (event.includes('5x Perfect')) {
            const v = parseInt(rawVal, 10);
            if (!isNaN(v)) { const ms = SCORING.streakMilestones.find(m => m.threshold === 5); if (ms) ms.bonus = v; }
        }
        // Kill-streak multiplier steps (e.g. "8-14 kills" → 1.35x). Map by the step's
        // starting count. Only the multiplier is CSV-driven; the on-screen labels stay
        // owned by config.js (the deep-sea re-theme), so the generic CSV flavor text
        // does not override them.
        else if (/^\d+\s*[-+]/.test(event) && /kills?/i.test(event) && rawVal.endsWith('x')) {
            const min = parseInt(event, 10);
            const mult = parseFloat(rawVal.replace('x', ''));
            if (!isNaN(min) && !isNaN(mult)) {
                const step = SCORING.killStreakSteps.find(s => s.min === min);
                if (step) step.mult = mult;
            }
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

    } catch (e) {
        console.warn('CSV parse failed, using embedded fallback data. (' + e.message + ')');
        loadFallbackData();
        return;
    }

    // --- Call-Lifecycle package (non-fatal, additive data layer) ---
    // Loads the normalized progression CSVs. Missing files degrade gracefully
    // (LIFECYCLE_READY stays false; the live spawn path is unaffected). See the
    // "CALL-LIFECYCLE DATA LAYER" section at the bottom of this file.
    const lifecycleFiles = ['Gameplay/call_lifecycle.csv', 'Gameplay/lifecycle_transitions.csv', 'Gameplay/status_colors.csv', 'Gameplay/ctas.csv', 'Gameplay/priority.csv', 'Gameplay/TOC.csv', 'Gameplay/toc_colors.csv', 'Gameplay/challenge_phrases.csv', 'Gameplay/toc_chevrons.csv'];
    const lifecycleResults = await Promise.all(lifecycleFiles.map(f =>
        fetch(base + f, { cache: 'no-store' }).then(r => r.ok ? r.text() : null).catch(() => null)
    ));
    parseLifecyclePackage(lifecycleResults);
}

// ============================================
// FALLBACK DATA (used when CSV fetch fails, e.g. file:// protocol)
// ============================================

function loadFallbackData() {
    // Mirrors units.csv exactly (54 standard units, weight 10). The master
    // xlsx carries extra special units (CARE1-8, FIT, MHRT, bikes 2B01/02,
    // and the 23xx/25xx/27xx blocks) that the user does NOT want in-game —
    // do not add them back. This fallback is used only on file:// loads.
    const fullUnitIds = [
        "2040","2041","2042","2043","2044","2045","2046","2095","2096","2097",
        "2098","2099","2100","2101","2102","2103","2104","2105","2106","2107",
        "2108","2109","2110","2111","2112","2113","2114","2115","2116","2117",
        "2118","2119","2120","2121","2122","2123","2124","2125","2126","2130",
        "2133","2134","2135","2136","2137","2138","2139","2150","2200","2201",
        "2202","2203","2205","2208"
    ];
    DATA_UNITS_FULL = fullUnitIds.map(id => ({ id, weight: 10 }));

    // Synced with bases.csv — stations + hospitals with custom weights
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
        { c: "Fallsview", m: "72124", weight: 2 },
        { c: "St Catharines", m: "/23000", weight: 8 },
        { c: "Welland County", m: "/4227", weight: 8 },
        { c: "GNG", m: "/4213", weight: 8 },
        { c: "West Lincoln", m: "/1538", weight: 6 },
        { c: "Hamilton General", m: "/1982", weight: 6 },
        { c: "Stemi Bypass", m: "/1982ST", weight: 3 }
    ];

    DATA_LOCATIONS_SAMPLE = DATA_LOCATIONS_FULL.slice(0, 5);

    // --- BASE_LOOKUP: Challenge Name → Command Code ---
    Object.keys(BASE_LOOKUP).forEach(k => delete BASE_LOOKUP[k]);
    DATA_LOCATIONS_FULL.forEach(loc => { BASE_LOOKUP[loc.c] = loc.m; });

    // --- Auxiliary pools (fallback) ---
    parseAuxiliaryPools([null, null]);

    // Rebuild TIERS from fallback progression data (synced with progression.csv)
    Object.keys(TIERS).forEach(k => delete TIERS[k]);
    Object.assign(TIERS, {
        bubblehopper:         { label: "BUBBLE HOPPER",         min: 0,     max: 5000,     speedMin: 0.5, speedMax: 0.8, spawnMin: 7500, spawnMax: 10500, maxTargets: 3,  baseHit: 100,  impactPenalty: -50,  creatureRadius: 22, sonarSpeed: 700,  depth: 30,   depthMin: 0,    depthMax: 100,  coneAngle: 55, tocSpawnMin: 8000, tocSpawnMax: 12000, tocActiveMin: 1, tocActiveMax: 2, tocOffloadMin: 40000, tocOffloadMax: 120000, tocDespawnMin: 15000, tocDespawnMax: 25000, bedAssignChance: 0.40, tocBandTopPct: 0.68, tocBandBotPct: 0.95, tocPatrolAmpMin: 90, tocPatrolAmpMax: 160, tocPatrolSpeedMin: 0.45, tocPatrolSpeedMax: 0.85, tocBobAmp: 14 },
        rigwalker:            { label: "RIG WALKER",             min: 5001,  max: 20000,    speedMin: 0.9, speedMax: 1.3, spawnMin: 5400, spawnMax: 7500, maxTargets: 4,  baseHit: 250,  impactPenalty: -125, creatureRadius: 20, sonarSpeed: 850,  depth: 150,  depthMin: 100,  depthMax: 400,  coneAngle: 42, tocSpawnMin: 6000, tocSpawnMax: 9000, tocActiveMin: 1, tocActiveMax: 2, tocOffloadMin: 40000, tocOffloadMax: 120000, tocDespawnMin: 12000, tocDespawnMax: 18000, bedAssignChance: 0.45, tocBandTopPct: 0.68, tocBandBotPct: 0.95, tocPatrolAmpMin: 90, tocPatrolAmpMax: 160, tocPatrolSpeedMin: 0.45, tocPatrolSpeedMax: 0.85, tocBobAmp: 14 },
        crushdepthoperator:   { label: "CRUSH DEPTH OPERATOR",   min: 20001, max: 50000,    speedMin: 1.4, speedMax: 2.0, spawnMin: 3750, spawnMax: 5250, maxTargets: 3,  baseHit: 500,  impactPenalty: -275, creatureRadius: 17, sonarSpeed: 1000, depth: 500,  depthMin: 400,  depthMax: 1000, coneAngle: 30, tocSpawnMin: 4000, tocSpawnMax: 6000, tocActiveMin: 1, tocActiveMax: 2, tocOffloadMin: 40000, tocOffloadMax: 120000, tocDespawnMin: 8000, tocDespawnMax: 12000, bedAssignChance: 0.50, tocBandTopPct: 0.68, tocBandBotPct: 0.95, tocPatrolAmpMin: 90, tocPatrolAmpMax: 160, tocPatrolSpeedMin: 0.45, tocPatrolSpeedMax: 0.85, tocBobAmp: 14 },
        theaquanaut:          { label: "THE AQUANAUT",            min: 50001, max: Infinity, speedMin: 2.2, speedMax: 3.5, spawnMin: 1200, spawnMax: 2700, maxTargets: 4,  baseHit: 1000, impactPenalty: -550, creatureRadius: 15, sonarSpeed: 1200, depth: 1000, depthMin: 1000, depthMax: 4000, coneAngle: 20, tocSpawnMin: 2500, tocSpawnMax: 4000, tocActiveMin: 1, tocActiveMax: 2, tocOffloadMin: 40000, tocOffloadMax: 120000, tocDespawnMin: 5000, tocDespawnMax: 8000, bedAssignChance: 0.60, tocBandTopPct: 0.68, tocBandBotPct: 0.95, tocPatrolAmpMin: 90, tocPatrolAmpMax: 160, tocPatrolSpeedMin: 0.45, tocPatrolSpeedMax: 0.85, tocBobAmp: 14 }
    });

    // Fallback PowerLine prompts
    const plFallback = [
        ['NTF', 'NTF <Unit List> Incident, [Comment]', 'Notify. Assign a Unit to an incident'],
        ['ENR', 'ENR <Unit List> [Comment]', 'Unit Enroute to Scene'],
        ['ARR', 'ARR <Unit List> [Comment]', 'Place Unit in the At Scene status'],
        ['PTC', 'PTC <Unit List> [Comment]', 'Place vehicle in Patient Contact status'],
        ['DPT', 'DPT <Unit> [Location], Incident ID, [# persons seen], [persons tx], [protocol code], [tx priority code], [Comment]', 'Unit: Depart Scene (Transporting)'],
        ['ARD', 'ARD <Unit List> [Comment]', 'Unit arrived at Destination'],
        ['TOC', 'TOC <Unit List> [Comment]', 'Transfer of PT Care to Hospital'],
        ['AVA', 'AVA <Unit List> [Disposition Code], [Exception Reason Code], [Comment]', 'Place Unit in the Available status'],
        ['CAV', 'CAV <Unit> [OOS Reason], [Comment]', 'Put Unit Conditional Available']
    ];
    const fakeCsv = 'Command,Required Code,Description\n' + plFallback.map(r => `${r[0]},"${r[1]}",${r[2]}`).join('\n');
    parsePowerlinePrompts(fakeCsv);

    // --- Embedded Call-Lifecycle package (file:// fallback) ---
    // Mirrors files/datasets/{call_lifecycle,lifecycle_transitions,status_colors,
    // ctas,priority,TOC,toc_colors}.csv EXACTLY — keep in sync when those change.
    // Lets generateCall() + validateLifecyclePackage() work on a plain double-click
    // (file://), where fetch() is blocked. (http via Start Dev Server.bat uses the
    // real CSVs.) See the CALL-LIFECYCLE DATA LAYER section below.
    parseLifecyclePackage([
        `stage_id,stage_name,command_template,unit_color,challenge_color,variable,stage_type
NTF,Notified,NTF {units} {inc_numbers},AVA,Black / Sonar Green (#000000 / #00FF41),inc_numbers,normal
ENR,En Route,ENR {units},NTF,Black / Sonar Green (#000000 / #00FF41),none,normal
ARR,Arrived,ARR {units},ENR,Black / Sonar Green (#000000 / #00FF41),none,normal
PTC,Patient Contact,PTC {units},ARR,Black / Sonar Green (#000000 / #00FF41),none,normal
DPT,Depart,"DPT {units} {hospitals},,,,{ctas},{ctas}",ARR,{ctas},hospital+ctas,normal
ARD,Arrived Destination,ARD {units},DPT,Black / Sonar Green (#000000 / #00FF41),none,normal
TOC,Transfer of Care,TOC {units},ARD,gated,none,gated
AVA,Available,AVA {units} CC,ARD,,none,terminal`,
        `from_stage,to_stage,weight
NTF,ENR,1
ENR,ARR,1
ARR,DPT,0.95
ARR,PTC,0.05
PTC,DPT,1
DPT,ARD,1
ARD,TOC,1
TOC,AVA,1`,
        `status,color
AVA,Lime Green / Cream (#2DB704 / #FFFFCE)
NTF,Blue / White (#0000FF / #FFFFFF)
ENR,Blue / White (#0000FF / #FFFFFF)
ARR,Blue / Light Blue (#0000FF / #ADD8E6)
PTC,Blue / Light Blue (#0000FF / #ADD8E6)
DPT,Blue / Pink (#0000FF / #D86DCD)
ARD,Blue / Orange (#0000FF / #FF8000)
TOC,Muted Plum / Dark Purple (#995B87 / #3E2778)`,
        `ctas,color
1,Purple / White (#7030A0 / #FFFFFF)
2,Coral Orange / Black (#FF854A / #000000)
3,Yellow / Black (#FFFF00 / #000000)
4,Cyan / Black (#00FFFF / #000000)
5,Neon Green / Black (#41FA45 / #000000)`,
        `priority,color
1,Purple / White (#7030A0 / #FFFFFF)
2H,Red / White (#FF0000 / #FFFFFF)
2,Coral Orange / Black (#FF854A / #000000)
3,Yellow / Black (#FFFF00 / #000000)
4,Cyan / Black (#00FFFF / #000000)
5,Neon Green / Black (#41FA45 / #000000)`,
        `from_color,to_color
White,Pink
White,Blue
Pink,Blue`,
        `state,color,hittable
White,White / Black (#FFFFFF / #000000),FALSE
Pink,Pink / Black (#F1B0B7 / #000000),FALSE
Blue,Blue / Black (#2E90FF / #000000),TRUE`,
        `stage_id,voice,phrase
NTF,cad,New Call {inc_numbers}
ENR,radio,En Route
ENR,radio,Switching to OPS2
ENR,radio,On OPS2
ENR,radio,Mobile to call
ARR,radio,Arriving Scene
ARR,radio,Switching to OPS3
ARR,radio,On OPS3
ARR,radio,On scene
PTC,radio,Patient Contact
DPT,radio,Departing {hospitals}
ARD,radio,Arriving {hospitals}
TOC,cad,TOC Completed`,
        `seq,key,label
1,ARR_DEST,Arrived at Destination
2,ARR_ED,Arrived in ED
3,TRIAGED,Triaged
4,TOC_REQ,TOC Requested
5,TOC_CMP,TOC Completed`
    ]);

    // COM radio-call bonus pool (mirrors com_radio_calls.csv for file:// double-click play).
    parseComRadioCalls(
        `Statement,Trigger Words
Stopped by a train,train|stopped
Truck broke down,truck|broke
Requesting a supervisor,supervisor|requesting
Patient refusing transport,patient|refusing
Struck a deer,deer|struck
Tire blew out,tire|blew
Caught in traffic,traffic|caught
Bridge is closed,bridge|closed
Road is flooded,road|flooded
Engine is overheating,engine|overheating
Hit a pole,pole|hit
Crew needs relief,crew|needs
Radio is broken,radio|broken
Found the patient,patient|found`
    );
}

// ============================================
// LIVE DATASET RELOAD (called from Holodeck)
// ============================================

async function reloadAllCSVs() {
    const statusEl = document.getElementById('dataset-status');
    const btn = document.getElementById('update-datasets-btn');

    if (statusEl) { statusEl.textContent = 'LOADING...'; statusEl.className = 'dataset-status loading'; }
    if (btn) btn.disabled = true;

    // Rebuilt for the Aquanaut: re-run the live loader so EVERY current dataset is
    // re-fetched (cache: 'no-store') and rebuilt — core + aux pools + powerline + the
    // call-lifecycle package — with no hardcoded file list. Live reload needs http
    // (the dev server); on file:// loadGameData falls back to embedded data.
    try {
        await loadGameData();
        if (typeof buildGodModeMenu === 'function') buildGodModeMenu();

        const lc = (typeof LIFECYCLE_READY !== 'undefined' && LIFECYCLE_READY)
            ? `, ${LIFECYCLE_ORDER.length} lifecycle stages` : '';
        const summary = `RELOADED: ${DATA_UNITS_FULL.length} units, ${Object.keys(TIERS).length} ranks${lc}`;
        console.log('[UPDATE DATASETS] ' + summary);
        // Feedback goes to the God Mode panel's own status line (#dataset-status).
        // (No showStatus() toast — that targets the in-game HUD, which isn't mounted
        // in the menu context where UPDATE DATASETS runs.)
        if (statusEl) { statusEl.textContent = '✓ ' + summary; statusEl.className = 'dataset-status success'; }
        setTimeout(() => { if (statusEl) { statusEl.textContent = ''; statusEl.className = 'dataset-status'; } }, 8000);
    } catch (e) {
        console.error('[UPDATE DATASETS] Reload failed:', e);
        if (statusEl) { statusEl.textContent = '✗ ' + e.message; statusEl.className = 'dataset-status error'; }
    } finally {
        if (btn) btn.disabled = false;
    }
}

// The Asteroid-era reloader internals (pickCSVFiles + applyCSVData — which required
// bases.csv and the 'Challenge Base'/'Command Base' columns, and only re-parsed 5
// files) were removed 2026-06-19. reloadAllCSVs above now re-runs loadGameData(),
// which already rebuilds every current Aquanaut dataset. Live reload is http-only;
// file:// uses embedded data.

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
// based on the 8 depth ranks (Surface Tender → Life Support Tech)
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
    CONFIG.creatureRadius = data.creatureRadius;
    CONFIG.sonarPulseSpeed = data.sonarSpeed;
    return true;
}

function getTierForScore(score) {
    for (const [key, data] of Object.entries(TIERS)) {
        if (score >= data.min && score <= data.max) return key;
    }
    return 'bubblehopper';
}

// ============================================
// POWERLINE PROMPT PARSING
// Parses Required Code format into segments for real-time highlight tracking
// ============================================

// ============================================
// COM RADIO CALL PARSING
// com_radio_calls.csv → DATA_COM_CALLS. Columns: Statement, Keywords (pipe-separated).
// Keywords are matched loosely (case-insensitive substring) against the player's typed
// comment, so a statement may use any distinctive words as its required keywords.
// ============================================
function parseComRadioCalls(csvText) {
    DATA_COM_CALLS = [];
    if (!csvText) return;
    const rows = parseCSV(csvText);
    rows.forEach(r => {
        const statement = (r['Statement'] || '').trim();
        // Accept either header — "Trigger Words" (the editable CSV) or legacy "Keywords".
        const kwRaw = (r['Trigger Words'] || r['Keywords'] || '').trim();
        if (!statement || !kwRaw) return;
        const keywords = kwRaw.split('|').map(k => k.trim()).filter(Boolean);
        if (!keywords.length) return;
        DATA_COM_CALLS.push({ statement, keywords });
    });
}

function parsePowerlinePrompts(csvText) {
    const rows = parseCSV(csvText);
    DATA_POWERLINE = {};
    rows.forEach(r => {
        const cmd = (r['Command'] || '').trim().toUpperCase();
        const code = r['Required Code'] || '';
        const desc = r['Description'] || '';
        if (!cmd) return;

        // Parse required code into segments
        // Split on comma boundaries first, then split each part by spaces
        // Segment types: command, required (<>), optional ([]), required-bare (plain text)
        const segments = [];
        const commaParts = code.split(',');

        commaParts.forEach((part, commaIdx) => {
            const tokens = part.trim().split(/\s+/);
            tokens.forEach(token => {
                if (!token) return;
                let type = 'required-bare';
                if (token === cmd && segments.length === 0) type = 'command';
                else if (/^<.*>$/.test(token) || /^</.test(token)) type = 'required-chevron';
                else if (/^\[.*\]$/.test(token) || /^\[/.test(token)) type = 'optional-bracket';

                // Handle multi-word bracket/chevron tokens (e.g., "<Unit List>", "[Exception Reason Code]")
                // Check if this token opens a bracket/chevron but doesn't close it
                const opensChevron = token.startsWith('<') && !token.endsWith('>');
                const opensBracket = token.startsWith('[') && !token.endsWith(']');

                segments.push({
                    text: token,
                    type: type,
                    commaGroup: commaIdx,
                    opensGroup: opensChevron || opensBracket
                });
            });
        });

        // Merge multi-word bracket/chevron groups (e.g., "<Unit" + "List>" → "<Unit List>")
        const merged = [];
        let i = 0;
        while (i < segments.length) {
            if (segments[i].opensGroup) {
                let combined = segments[i].text;
                const startType = segments[i].type;
                const commaGroup = segments[i].commaGroup;
                i++;
                while (i < segments.length) {
                    combined += ' ' + segments[i].text;
                    const closes = segments[i].text.endsWith('>') || segments[i].text.endsWith(']');
                    i++;
                    if (closes) break;
                }
                merged.push({ text: combined, type: startType, commaGroup });
            } else {
                merged.push({ text: segments[i].text, type: segments[i].type, commaGroup: segments[i].commaGroup });
                i++;
            }
        }

        DATA_POWERLINE[cmd] = { segments: merged, description: desc };
    });
}

// ============================================
// CHALLENGE GENERATION (Non-Recursive)
// Supports: inline !Tokens, !Hospitals with matched commands,
// chained commands (row_N_finish), !Units in sonar/command columns
// ============================================

// Resolve inline !TokenName patterns in a string
// resolvedMap allows pre-resolved values (e.g., a hospital already rolled)
//
// Two forms are supported:
//   !"Token Name"  — quoted (what the CSV exports produce)
//   !TokenName     — bare (used by the embedded fallback data)
// The bare form is matched against KNOWN pool names (longest first), so a
// template like "!Hospitals on a 3" resolves the token without swallowing
// the trailing words — the old greedy regex turned that whole phrase into
// one unknown token and left "!Hospitals on a 3" on screen.
function resolveInlineTokens(template, resolvedMap, storeResults) {
    if (!template) return '';

    const lookup = (name) => {
        if (resolvedMap && resolvedMap[name] !== undefined) return resolvedMap[name];
        const pool = DATA_POOLS[name];
        if (pool && pool.length > 0) {
            const val = pool[Math.floor(Math.random() * pool.length)];
            if (storeResults && resolvedMap) resolvedMap[name] = val;
            return val;
        }
        return null;
    };

    // Quoted form first: !"Token Name"
    let out = template.replace(/!"([^"]+)"/g, (match, name) => {
        const v = lookup(name.trim());
        return v !== null ? v : match;
    });

    // Bare form: try known pool names, longest first
    const names = Object.keys(DATA_POOLS).sort((a, b) => b.length - a.length);
    for (const name of names) {
        let idx;
        while ((idx = out.indexOf('!' + name)) !== -1) {
            const v = lookup(name);
            if (v === null) break;
            out = out.slice(0, idx) + v + out.slice(idx + name.length + 1);
        }
    }
    return out;
}

// Sonar bubble styling is theme/CSS now (the old per-row Sonar Background/Text is
// retired) — every target uses the default black-box / sonar-green readout.
const SONAR_DEFAULT_COLOR = { bg: '#000000', fg: '#00FF41' };

// Live spawn spec for the engine. Single-stage / one-and-done, sourced from the
// Gameplay/ package via generateStageSpec(). The flat challenges_commands.csv is
// fully retired (2026-06-20): command validation and the God-Mode menu now read the
// lifecycle stages (LIFECYCLE_STAGES) directly, and the file is no longer loaded.
function getTargetSpecs() {
    // God Mode: restrict spawns to the chosen stages (command codes == stage_ids,
    // never AVA, which is only step 2 of the TOC finale).
    let stage = null;
    if (CONFIG.isHolodeck && godMode.activeCommands && godMode.activeCommands.size > 0) {
        const allowed = Array.from(godMode.activeCommands).filter(c => LIFECYCLE_STAGES[c] && c !== 'AVA');
        if (allowed.length) stage = allowed[Math.floor(Math.random() * allowed.length)];
    }

    const spec = generateStageSpec(stage ? { stage } : {});
    if (!spec) return null;

    // TOC's blue-gated two-step (TOC {u} → AVA {u} CC) maps onto the engine's
    // existing chainNext mechanism: clearing step 1 transitions the target to step 2.
    const chainNext = (spec.steps && spec.steps.length > 1) ? {
        challenge: spec.challenge,                  // box keeps the "TOC Completed" readout
        command: spec.steps[1].command,             // AVA {u} CC
        altCommand: spec.steps[1].altCommand || null,
        colorChallenge: spec.challengeColor,
        colorSonar: SONAR_DEFAULT_COLOR,
        // Entering step 2 (the TOC command was typed) moves the unit INTO the TOC status,
        // so the unit tag now reads the TOC colour (was wrongly kept on the ARD predecessor).
        colorUnit: parsePipeColor(STATUS_COLORS_RAW[spec.stageId]),             // TOC status → unit tag
        colorUnitNext: parsePipeColor(STATUS_COLORS_RAW[spec.steps[1].stage])   // AVA status — the final zap flash
    } : null;

    // The unit tag shows the unit's CURRENT status colour (status_colors[unit_color],
    // the stage's predecessor); on a successful zap it flashes to this stage's OWN
    // status colour (the status the unit just moved INTO) before vanishing.
    return {
        unitID: spec.unitID,
        challenge: spec.challenge,
        command: spec.command,
        altCommand: spec.altCommand || null,
        type: spec.stageId,
        voice: spec.voice,                  // 'cad' (CAD readout) | 'radio' (speech bubble)
        colorChallenge: spec.challengeColor,
        colorSonar: SONAR_DEFAULT_COLOR,
        colorUnit: spec.unitColor,                                       // predecessor status → unit tag
        colorUnitNext: parsePipeColor(STATUS_COLORS_RAW[spec.stageId]),  // this stage's status → zap flash
        chainNext: chainNext,
        gated: spec.gated || false,         // TOC blue-gate target
        gate: spec.gate || null             // gate data (colors, hittable, transitions, chevrons)
    };
}

/* ========================================================
   CALL-LIFECYCLE DATA LAYER  (added 2026-06-19)
   --------------------------------------------------------
   Normalized progression model that consumes the CSV package:
     call_lifecycle.csv        — stage nodes
     lifecycle_transitions.csv — weighted edges (the progression graph)
     status_colors.csv         — status -> unit_color
     ctas.csv / priority.csv   — value + color pools
     TOC.csv / toc_colors.csv  — gated TOC sub-machine (palette/edges only here)

   SCOPE (per the 2026-06-19 handoff): DATA LAYER ONLY. This module loads,
   validates, and exposes the model through generateCall(). The engine-side
   consumption of the full N-step call — movement, the gated-TOC sub-machine,
   radar-reveal — is a SEPARATE handoff and is intentionally NOT wired here.
   The live spawn path (getTargetSpecs) is unchanged; the engine still advances
   one Target+Challenge at a time. generateCall() is the seam the movement/
   combat handoff will consume.

   GOVERNANCE: the multi-stage call progression is cartridge-layer logic (it
   lives here in data.js + the future script.js consumer), not core engine and
   not theme. Authorized by Andrew 2026-06-19 ("treat as authorized").

   TOKEN CONTRACT:
     {units}        units.csv / Units        — weighted roll, the unit id
     {inc_numbers}  inc_numbers.csv / INC#s  — text, leading zeros preserved
     {hospitals}    hospitals.csv            — Command1 primary / Command2 alt
     {ctas}         ctas.csv                 — value typed in command + colors challenge
     {priority}     priority.csv             — colour-only, never typed
   Pools are rolled ONCE at spawn and frozen for the call's whole life.
   ======================================================== */

let LIFECYCLE_STAGES = {};       // stage_id -> stage record
let LIFECYCLE_ORDER = [];        // stage_ids in CSV order
let LIFECYCLE_TRANSITIONS = {};  // from_stage -> [{ to, weight }]
let STATUS_COLORS_RAW = {};      // status   -> raw "Name / Name (#hex / #hex)"
let CTAS_COLORS_RAW = {};        // ctas val -> raw colour string
let PRIORITY_COLORS_RAW = {};    // prio val -> raw colour string
let TOC_COLORS_RAW = {};         // toc state-> raw colour string
let TOC_HITTABLE = {};           // toc state-> bool (clearable only when true; Blue=true)
let TOC_TRANSITIONS = {};        // from_color -> [to_color, ...]
let TOC_CHEVRONS = [];           // [{ seq, key, label }] — cosmetic TOC progress labels
let CHALLENGE_PHRASES = {};      // stage_id -> [{ voice, phrase }] (voice: cad | radio)
let CTAS_VALUES = [];            // ['1'..'5']     — typed in command + colour
let PRIORITY_VALUES = [];        // ['1','2H'..'5']— colour-only, never typed
let LIFECYCLE_READY = false;

const LIFECYCLE_START = 'NTF';   // a call enters when an Available unit is Notified

function parseLifecycleStages(text) {
    LIFECYCLE_STAGES = {}; LIFECYCLE_ORDER = [];
    if (!text) return;
    parseCSV(text).forEach(r => {
        const id = (r['stage_id'] || '').trim();
        if (!id) return;
        LIFECYCLE_STAGES[id] = {
            stageId: id,
            stageName: (r['stage_name'] || '').trim(),
            commandTemplate: (r['command_template'] || '').trim(),
            unitColorStatus: (r['unit_color'] || '').trim(),       // a STATUS code -> status_colors
            challengeColorSpec: (r['challenge_color'] || '').trim(),// token, 'gated', or '' (terminal)
            variable: (r['variable'] || '').trim(),                 // inc_numbers / hospital+ctas / none
            stageType: (r['stage_type'] || 'normal').trim()
        };
        LIFECYCLE_ORDER.push(id);
    });
}

function parseLifecycleTransitions(text) {
    LIFECYCLE_TRANSITIONS = {};
    if (!text) return;
    parseCSV(text).forEach(r => {
        const from = (r['from_stage'] || r['from'] || '').trim();
        const to   = (r['to_stage']   || r['to']   || '').trim();
        if (!from || !to) return;
        // Blank weight = 1 (Andrew 2026-06-19): single-successor edges are 1.0;
        // only the ARR branch carries a fractional split (DPT .95 / PTC .05).
        const wRaw = (r['weight'] || '').trim();
        const w = wRaw === '' ? 1 : (parseFloat(wRaw) || 0);
        (LIFECYCLE_TRANSITIONS[from] = LIFECYCLE_TRANSITIONS[from] || []).push({ to, weight: w });
    });
}

function parseStatusColors(text) {
    STATUS_COLORS_RAW = {};
    if (!text) return;
    parseCSV(text).forEach(r => {
        const s = (r['status'] || '').trim();
        if (s) STATUS_COLORS_RAW[s] = (r['color'] || '').trim();
    });
}

// ctas.csv / priority.csv share the shape: <keyCol>,color
function parseValueColorPool(text, keyCol) {
    const map = {}, values = [];
    if (text) parseCSV(text).forEach(r => {
        const v = (r[keyCol] || '').trim();
        if (v) { map[v] = (r['color'] || '').trim(); values.push(v); }
    });
    return { map, values };
}

function parseTocColors(text) {
    TOC_COLORS_RAW = {}; TOC_HITTABLE = {};
    if (!text) return;
    parseCSV(text).forEach(r => {
        const s = (r['state'] || '').trim();
        if (!s) return;
        TOC_COLORS_RAW[s] = (r['color'] || '').trim();
        // hittable: only TRUE states are clearable (Blue). Drives the gate, not chevrons.
        TOC_HITTABLE[s] = /^true$/i.test((r['hittable'] || '').trim());
    });
}

function parseTocTransitions(text) {
    TOC_TRANSITIONS = {};
    if (!text) return;
    parseCSV(text).forEach(r => {
        const from = (r['from_color'] || '').trim();
        const to   = (r['to_color']   || '').trim();
        if (from && to) (TOC_TRANSITIONS[from] = TOC_TRANSITIONS[from] || []).push(to);
    });
}

// toc_chevrons.csv: seq,key,label — cosmetic TOC monitor progress (does NOT gate).
function parseTocChevrons(text) {
    TOC_CHEVRONS = [];
    if (!text) return;
    parseCSV(text).forEach(r => {
        const key = (r['key'] || '').trim();
        if (!key) return;
        TOC_CHEVRONS.push({
            seq:   parseInt(r['seq'], 10) || (TOC_CHEVRONS.length + 1),
            key:   key,
            label: (r['label'] || '').trim()
        });
    });
    TOC_CHEVRONS.sort((a, b) => a.seq - b.seq);
}

// challenge_phrases.csv: stage_id,voice,phrase — the display/voice layer.
// Multiple rows per stage (ENR, ARR) → roll one per spawn and freeze it.
function parseChallengePhrases(text) {
    CHALLENGE_PHRASES = {};
    if (!text) return;
    parseCSV(text).forEach(r => {
        const id     = (r['stage_id'] || '').trim();
        const phrase = (r['phrase']   || '').trim();
        if (!id || !phrase) return;
        (CHALLENGE_PHRASES[id] = CHALLENGE_PHRASES[id] || []).push({
            voice:  (r['voice'] || '').trim(),   // 'cad' = CAD readout | 'radio' = speech bubble
            phrase: phrase
        });
    });
}

// Master parser — called from loadGameData with the 9 fetched texts (any null).
function parseLifecyclePackage(results) {
    const [lifecycleText, transitionsText, statusColorsText, ctasText, priorityText,
           tocText, tocColorsText, phrasesText, chevronsText] = results;
    parseLifecycleStages(lifecycleText);
    parseLifecycleTransitions(transitionsText);
    parseStatusColors(statusColorsText);
    const ctas = parseValueColorPool(ctasText, 'ctas');
    CTAS_COLORS_RAW = ctas.map; CTAS_VALUES = ctas.values;
    const prio = parseValueColorPool(priorityText, 'priority');
    PRIORITY_COLORS_RAW = prio.map; PRIORITY_VALUES = prio.values;
    parseTocTransitions(tocText);
    parseTocColors(tocColorsText);
    parseChallengePhrases(phrasesText);
    parseTocChevrons(chevronsText);

    LIFECYCLE_READY = LIFECYCLE_ORDER.length > 0 && Object.keys(LIFECYCLE_TRANSITIONS).length > 0;

    const report = validateLifecyclePackage();
    if (typeof console !== 'undefined') {
        if (!LIFECYCLE_READY) {
            console.warn('[LIFECYCLE] package not loaded (CSVs missing — http:// required)');
        } else if (report.ok) {
            console.log(`[LIFECYCLE] validated OK — ${LIFECYCLE_ORDER.length} stages, ${Object.keys(CHALLENGE_PHRASES).length} phrase-stages`);
        } else {
            console.warn('[LIFECYCLE] validation issues:\n  - ' + report.issues.join('\n  - '));
        }
    }
    return report;
}

// ----- Resolution -----------------------------------------------------------

// Roll one weighted out-edge for a stage; null if terminal / no edges.
function rollTransition(fromStage) {
    const edges = LIFECYCLE_TRANSITIONS[fromStage];
    if (!edges || edges.length === 0) return null;
    if (edges.length === 1) return edges[0].to;
    const total = edges.reduce((s, e) => s + (e.weight || 0), 0);
    let roll = Math.random() * (total || 1);
    for (const e of edges) { roll -= (e.weight || 0); if (roll <= 0) return e.to; }
    return edges[edges.length - 1].to;
}

// Resolve {curly} tokens against a frozen roll. hospitalCmd picks Command1/2.
function resolveCurlyTokens(template, frozen, hospitalCmd) {
    if (!template) return '';
    return template
        .replace(/\{units\}/g, frozen.unit)
        .replace(/\{inc_numbers\}/g, frozen.incNumber || '')
        .replace(/\{hospitals\}/g, hospitalCmd || (frozen.hospital ? frozen.hospital.cmd1 : ''))
        .replace(/\{ctas\}/g, frozen.ctas || '')
        .replace(/\{priority\}/g, frozen.priority || '');
}

// Resolve a stage's challenge_color spec -> {bg,fg} | {gated:true} | null.
function resolveChallengeColor(spec, frozen) {
    if (!spec) return null;                        // blank -> terminal (AVA), no challenge colour
    if (spec === 'gated') return { gated: true };  // TOC sub-machine drives it (separate handoff)
    if (spec === '{priority}') return parsePipeColor(PRIORITY_COLORS_RAW[frozen.priority]);
    if (spec === '{ctas}')     return parsePipeColor(CTAS_COLORS_RAW[frozen.ctas]);
    return parsePipeColor(spec);  // literal "Name / Name (#bg / #fg)" — e.g. fixed Black / Sonar Green
}

// Phrases carry only {inc_numbers} and {hospitals}; in a PHRASE {hospitals} is the
// readable NAME (§2). (In a command_template it is the code — see resolveCurlyTokens.)
function resolvePhraseTokens(phrase, frozen) {
    if (!phrase) return '';
    return phrase
        .replace(/\{inc_numbers\}/g, frozen.incNumber || '')
        .replace(/\{hospitals\}/g, frozen.hospital ? frozen.hospital.name : '');
}

// Roll one phrase for a stage (multiple phrases → one per spawn, then frozen).
function rollPhrase(stageId) {
    const list = CHALLENGE_PHRASES[stageId];
    if (!list || !list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
}

// Freeze the token pools once at spawn — rolled together, stable for the target's life.
function rollFrozenPools() {
    const unitsPool = (CONFIG.isHolodeck ? DATA_UNITS_SAMPLE : DATA_UNITS_FULL);
    const unitObj = weightedRandom((unitsPool && unitsPool.length) ? unitsPool : DATA_UNITS_FULL);
    const incPool = DATA_POOLS['Incident #s'] || DATA_POOLS['Incidents'] || [];
    return {
        unit:      typeof unitObj === 'string' ? unitObj : (unitObj ? unitObj.id : ''),
        incNumber: incPool.length ? incPool[Math.floor(Math.random() * incPool.length)] : '',
        hospital:  DATA_HOSPITALS.length ? DATA_HOSPITALS[Math.floor(Math.random() * DATA_HOSPITALS.length)] : null,
        ctas:      CTAS_VALUES.length ? CTAS_VALUES[Math.floor(Math.random() * CTAS_VALUES.length)] : '',
        priority:  PRIORITY_VALUES.length ? PRIORITY_VALUES[Math.floor(Math.random() * PRIORITY_VALUES.length)] : ''
    };
}

// Pick which stage a spawning target shows (single-stage / one-and-done model).
// Realize a call down the weighted DAG and pick one stage from the realized path,
// so the mix follows the lifecycle (PTC stays ~5%). AVA is excluded — it is never a
// standalone spawn (it is step 2 of the TOC finale).
function rollSpawnStage() {
    const path = [];
    let cur = LIFECYCLE_START, guard = 0;
    while (cur && LIFECYCLE_STAGES[cur] && guard++ < LIFECYCLE_ORDER.length + 2) {
        if (cur !== 'AVA') path.push(cur);
        if (LIFECYCLE_STAGES[cur].stageType === 'terminal') break;
        cur = rollTransition(cur);
    }
    return path.length ? path[Math.floor(Math.random() * path.length)] : LIFECYCLE_START;
}

// Build the spawn spec for ONE stage — the object the engine consumes per target.
//   .challenge      resolved phrase (what the target shows)   .voice  cad | radio
//   .command/.altCommand  the clear command (step 1 for TOC)
//   .steps          null, or the TOC two-step finale [{TOC…},{AVA…}]
//   .unitColor      {bg,fg} from status_colors[unit_color]
//   .challengeColor {bg,fg} (the gate starts White when gated)
//   .gated/.gate    TOC gate data (colors, hittable, transitions, chevrons, initial)
function buildStageSpec(stageId, frozen) {
    const stage = LIFECYCLE_STAGES[stageId];
    if (!stage) return null;

    const ph = rollPhrase(stageId);
    let challenge = ph ? resolvePhraseTokens(ph.phrase, frozen) : (stage.stageName || stageId);
    const voice = ph ? ph.voice : '';

    // Departing crews (DPT) surface their CTAS level as a trailing [C#] tag — the DPT
    // command needs the ctas value but the phrase ("Departing <hospital>") never spells it
    // out, so this hints the CTAS colour/level. Eg. CTAS 1 → "Departing … [C1]".
    if (stageId === 'DPT' && frozen.ctas) {
        challenge += ` [C${frozen.ctas}]`;
    }

    const hasHospital = /\{hospitals\}/.test(stage.commandTemplate);
    const command = resolveCurlyTokens(stage.commandTemplate, frozen, frozen.hospital ? frozen.hospital.cmd1 : '');
    const altCommand = (hasHospital && frozen.hospital && frozen.hospital.cmd2)
        ? resolveCurlyTokens(stage.commandTemplate, frozen, frozen.hospital.cmd2) : null;

    const unitColor = parsePipeColor(STATUS_COLORS_RAW[stage.unitColorStatus]);
    const isGated = stage.challengeColorSpec === 'gated';
    const challengeColor = isGated
        ? parsePipeColor(TOC_COLORS_RAW['White'])   // gate starts White; engine drives the timer
        : resolveChallengeColor(stage.challengeColorSpec, frozen);

    // TOC = blue-gated two-step finale: TOC {unit} then AVA {unit} CC (the AVA stage row).
    let steps = null, gate = null;
    if (isGated) {
        const ava = LIFECYCLE_STAGES['AVA'];
        const avaCmd = ava ? resolveCurlyTokens(ava.commandTemplate, frozen) : `AVA ${frozen.unit}`;
        steps = [
            { stage: stageId, command: command, altCommand: altCommand },
            { stage: 'AVA',   command: avaCmd,  altCommand: null }
        ];
        gate = {
            colors:      TOC_COLORS_RAW,    // state -> raw colour
            hittable:    TOC_HITTABLE,      // state -> bool (clearable only when true)
            transitions: TOC_TRANSITIONS,   // White→Pink, White→Blue, Pink→Blue
            chevrons:    TOC_CHEVRONS,      // cosmetic progress labels
            initial:     'White'            // box starts White; flips on random timing
        };
    }

    return {
        unitID: frozen.unit,
        stageId: stageId,
        voice: voice,
        challenge: challenge,
        command: command,
        altCommand: altCommand,
        steps: steps,
        unitColor: unitColor,
        challengeColor: challengeColor,
        gated: isGated,
        gate: gate,
        frozen: frozen
    };
}

// Roll a single spawnable target from the package (single-stage / one-and-done).
//   opts.stage — force a specific stage (else sampled from the weighted DAG).
// Returns the spawn spec, or null if the package isn't loaded.
function generateStageSpec(opts) {
    if (!LIFECYCLE_READY) return null;
    opts = opts || {};
    const frozen = rollFrozenPools();
    const stageId = opts.stage || rollSpawnStage();
    return buildStageSpec(stageId, frozen);
}

// ----- Validation (the 2026-06-19 handoff checklist) ------------------------
// Runs at load and is callable from the console (window.validateLifecyclePackage).
function validateLifecyclePackage() {
    const issues = [];
    const stageIds = new Set(LIFECYCLE_ORDER);

    // (1) transitions present; every `to` is a real stage_id; weights per `from`
    //     sum to 1.0 (terminal stages excluded — they have no out-edges).
    if (Object.keys(LIFECYCLE_TRANSITIONS).length === 0) {
        issues.push('no transitions loaded (lifecycle_transitions.csv missing/empty)');
    }
    Object.entries(LIFECYCLE_TRANSITIONS).forEach(([from, edges]) => {
        if (!stageIds.has(from)) issues.push(`transition from unknown stage "${from}"`);
        edges.forEach(e => {
            if (!stageIds.has(e.to)) issues.push(`transition ${from}->${e.to}: "${e.to}" is not a stage_id`);
        });
        const sum = edges.reduce((s, e) => s + (e.weight || 0), 0);
        if (Math.abs(sum - 1) > 1e-6) issues.push(`weights for "${from}" sum to ${sum} (expected 1.0)`);
    });
    LIFECYCLE_ORDER.forEach(id => {
        if (LIFECYCLE_STAGES[id].stageType === 'terminal' && (LIFECYCLE_TRANSITIONS[id] || []).length) {
            issues.push(`terminal stage "${id}" has out-edges`);
        }
    });

    // (2) every unit_color exists in status_colors.
    LIFECYCLE_ORDER.forEach(id => {
        const s = LIFECYCLE_STAGES[id].unitColorStatus;
        if (s && !(s in STATUS_COLORS_RAW)) issues.push(`stage "${id}" unit_color "${s}" not in status_colors`);
    });

    // (3) every challenge_color token resolves, or = gated (blank only on terminal).
    LIFECYCLE_ORDER.forEach(id => {
        const spec = LIFECYCLE_STAGES[id].challengeColorSpec;
        const type = LIFECYCLE_STAGES[id].stageType;
        if (spec === '') { if (type !== 'terminal') issues.push(`stage "${id}" has blank challenge_color but is not terminal`); return; }
        if (spec === 'gated') return;
        if (spec === '{priority}' && PRIORITY_VALUES.length) return;
        if (spec === '{ctas}' && CTAS_VALUES.length) return;
        if (parsePipeColor(spec)) return;   // literal "Name / Name (#bg / #fg)" color spec
        issues.push(`stage "${id}" challenge_color "${spec}" does not resolve`);
    });

    // (4) TOC.csv states ⊆ toc_colors states; both read Pink (not Red); no "Blak".
    if (Object.keys(TOC_COLORS_RAW).length) {
        const tocStateSet = new Set(Object.keys(TOC_COLORS_RAW));
        const tocUsed = new Set();
        Object.entries(TOC_TRANSITIONS).forEach(([f, tos]) => { tocUsed.add(f); tos.forEach(t => tocUsed.add(t)); });
        tocUsed.forEach(s => { if (!tocStateSet.has(s)) issues.push(`TOC.csv state "${s}" not in toc_colors`); });
        if (tocUsed.has('Red') || tocStateSet.has('Red')) issues.push('TOC palette still uses "Red" (should be "Pink")');
        Object.values(TOC_COLORS_RAW).forEach(c => { if (/Blak/.test(c)) issues.push('toc_colors still contains "Blak" (should be "Black")'); });
    }

    // (5) DPT row comma-quoting intact — the quoted command template kept its commas.
    const dpt = LIFECYCLE_STAGES['DPT'];
    if (dpt && (dpt.commandTemplate.match(/,/g) || []).length < 5) {
        issues.push('DPT command_template lost its commas (CSV quoting broken)');
    }

    // (6) challenge_phrases: every spawnable stage (all but terminal AVA) needs a phrase;
    //     phrases may only carry {inc_numbers} / {hospitals} tokens (§7 — reject typos).
    if (Object.keys(CHALLENGE_PHRASES).length) {
        LIFECYCLE_ORDER.forEach(id => {
            if (LIFECYCLE_STAGES[id].stageType === 'terminal') return;  // AVA: no phrase by design
            if (!(CHALLENGE_PHRASES[id] && CHALLENGE_PHRASES[id].length)) issues.push(`stage "${id}" has no challenge phrase`);
        });
        Object.entries(CHALLENGE_PHRASES).forEach(([id, list]) => list.forEach(p => {
            const bad = (p.phrase.match(/\{[^}]+\}/g) || []).filter(t => t !== '{inc_numbers}' && t !== '{hospitals}');
            if (bad.length) issues.push(`phrase for "${id}" has unexpected token(s): ${bad.join(', ')}`);
        }));
    }

    // (7) toc_chevrons keys must stay distinct from lifecycle stage_ids (§6/§7).
    TOC_CHEVRONS.forEach(c => { if (stageIds.has(c.key)) issues.push(`toc_chevron key "${c.key}" collides with a stage_id`); });

    // (8) toc_colors.hittable: Blue must be the clearable state.
    if (Object.keys(TOC_COLORS_RAW).length && !TOC_HITTABLE['Blue']) {
        issues.push('toc_colors: Blue must be hittable=TRUE');
    }

    return { ok: issues.length === 0, issues };
}

// Expose for in-browser inspection / the future combat handoff.
if (typeof window !== 'undefined') {
    window.generateStageSpec = generateStageSpec;
    window.validateLifecyclePackage = validateLifecyclePackage;
}

/* ========================================================
   ASTEROID COMMAND v2.0.M — CAD-SAFE COLOR EDITION
   CHANGES: Green/Brown palette (no blue), flush topography,
            box-to-asteroid repulsion physics
   NOTE: CONFIG in core/config.js, CSV loader + getTargetSpecs() in
         core/data.js. Data loaded async from datasets/ before init()
   ======================================================== */

// ============================================
// ASSETS
// ============================================

const ASSETS = {};

const ZONE_ASSET_LIST = [
    'Tower_INTACT', 'Tower_DESTROYED',
    'Skylon_INTACT', 'Skylon_DESTROYED',
    'Sir_Adam_Beck_INTACT', 'Sir_Adam_Beck_DESTROYED',
    'Welland_Canal_INTACT', 'Welland_Canal_DESTROYED',
    'Welland_Canal_Towers_INTACT', 'Welland_Canal_Deck_INTACT',
    'Robin_Hood_INTACT', 'Robin_Hood_DESTROYED'
];

const BG_ASSET_LIST = [
    'master_background_sky'
];

const UI_ASSET_LIST = ['NanoMedic']; // Space Ambulance 2.5D Sprite

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
const ZONE_OBJ_ASSET_LIST = ['Yellow_Bug']; // Zone Object sprites (Skylon elevator bug)

const totalAssets = ZONE_ASSET_LIST.length + BG_ASSET_LIST.length + UI_ASSET_LIST.length + ZONE_OBJ_ASSET_LIST.length + ASTEROID_SPRITE_PATHS.length + 13; // +13 freighter sprites

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

UI_ASSET_LIST.forEach(name => {
    ASSETS[name] = new Image();
    ASSETS[name].src = `assets/Space Ships/${name}.png`;
    ASSETS[name].onload = () => { assetsLoaded++; };
    ASSETS[name].onerror = () => { console.warn(`Missing: assets/Space Ships/${name}.png`); assetsLoaded++; };
});

ZONE_OBJ_ASSET_LIST.forEach(name => {
    ASSETS[name] = new Image();
    ASSETS[name].src = `assets/Zone Objects/${name}.png`;
    ASSETS[name].onload = () => { assetsLoaded++; };
    ASSETS[name].onerror = () => { console.warn(`Missing: assets/Zone Objects/${name}.png`); assetsLoaded++; };
});

ASTEROID_SPRITE_PATHS.forEach((path, index) => {
    const img = new Image();
    img.src = path;
    img.onload = () => { assetsLoaded++; };
    img.onerror = () => { console.warn(`Missing asteroid sprite: ${path}`); assetsLoaded++; };
    ASTEROID_SPRITES[index] = img;
});

// ============================================
// FREIGHTER FLEET (Welland Canal Ship Sprites)
// ============================================

const FREIGHTER_FLEET = {
    standard: {
        files: ['Freighter_1', 'Freighter_2', 'Freighter_3', 'Freighter_4', 'Freighter_5'],
        w: 97, h: 116, hitboxElevation: (y, h) => y - h + 27
    },
    heavyBallast: {
        files: ['Freighter_6', 'Freighter_7'],
        w: 103, h: 143, hitboxElevation: (y, h) => y - h + 21
    },
    modern: {
        files: ['Freighter_8', 'Freighter_9', 'Freighter_10'],
        w: 111, h: 151, hitboxElevation: (y, h) => y - h + 17
    },
    stealth: {
        files: ['Freighter_SB1', 'Freighter_SB2'],
        w: 80, h: 160, hitboxElevation: (y, h, sailH) => y - (sailH || h * 0.7)
    }
};

const FREIGHTER_SPRITES = {};
const FREIGHTER_ALL_KEYS = [];

// Build flat list and load all freighter images
Object.values(FREIGHTER_FLEET).forEach(group => {
    group.files.forEach(name => {
        FREIGHTER_ALL_KEYS.push(name);
        const img = new Image();
        img.src = `assets/Zone Objects/${name}.png`;
        img.onload = () => { assetsLoaded++; };
        img.onerror = () => { console.warn(`Missing freighter: assets/Zone Objects/${name}.png`); assetsLoaded++; };
        FREIGHTER_SPRITES[name] = img;
    });
});

// ============================================
// STATE
// ============================================

// ============================================
// PLAYER IDENTITY (set by CAT login)
// ============================================
const player = { name: '', oasis: '' };

const state = {
    running: false,
    paused: false,
    score: 0,
    shieldHP: 9,
    towerExposed: false,
    repairCount: 0,
    cracks: [],
    ricochetProjectiles: [],
    streak: 0,                      // Kill streak (asteroid kills without a base destroyed)
    streakSinceShieldHit: 0,
    perfectStreak: 0,                // Consecutive Perfect Shots (0 or 1 backspace forgiveness)
    perfectMilestonesHit: [],        // Which milestones (5,8,15,25) were awarded this streak
    consecutiveBasesDestroyed: 0,    // Consecutive base destructions counter
    comebackCounter: 0,             // Asteroids killed since last base loss
    comebackAwarded: false,          // Whether comeback bonus was given for current base loss
    firstBloodAwarded: false,        // Whether First Blood was given this session
    rankScoreAccum: 0,               // Points earned within current rank for Calibration
    lastCalibrationAt: 0,            // Score at last calibration bonus
    tier: 'trainee',
    speedMult: 0.6,
    spawnInterval: 6000,
    maxTargets: 2,
    asteroids: [],
    projectiles: [],
    brokenProjectiles: [],
    explosions: [],
    defenses: [],
    towerDisabled: false,
    rebuilding: false,
    ambulance: null,
    ambulanceDestroyCount: 0,
    ambulancePendingTimer: null,
    beamActive: false,
    beamTimer: 0,
    gameOverPending: false,
    usedChallenges: new Set(),
    backspaces: 0,
    cleanHits: 0,
    cleanStreak: 0,
    timers: {},
    devModeUnlocked: false,
    devPromptActive: false,
    holodeckUnlocked: false,
    holodeckPromptActive: false,
    environmentalParticles: [],
    skylonBugs: [],
    canalCrew: [],
    beckWorkers: [],
    flourWorkers: [],
    flourGround: [],
    flourIce: { active: false, progress: 0, patches: [] },
    bridgeStartTime: 0,
    canal: {
        bridgePhase: 'idle',   // idle, raising, raised, lowering
        timer: 0,
        deckRaise: 0,
        shipPhase: 'hidden',   // hidden, emerging, approaching
        shipY: 0,
        shipScale: 0.2,
        shipType: null,        // current freighter key (e.g. 'Freighter_3')
        // Crash sequence (triggered on canal destruction)
        crashPhase: 'none',    // none, approaching, crashed
        crashShipType: null,
        crashShipY: 0,
        crashShipScale: 0.2,
        crashShipTilt: 0
    }
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
    DOM.status2 = document.getElementById('status-message-2');
    DOM.vds2 = document.getElementById('vds2-container');
    DOM.startOverlay = document.getElementById('start-overlay');
    DOM.gameOverOverlay = document.getElementById('game-over-overlay');
    DOM.finalScore = document.getElementById('final-score');
    DOM.tier = document.getElementById('tier-value');
    DOM.mult = document.getElementById('multiplier-value');
    DOM.devPrompt = document.getElementById('dev-mode-prompt');
    DOM.devInput = document.getElementById('dev-password-input');
    DOM.devTimer = document.getElementById('dev-timer');
    DOM.holodeckPrompt = document.getElementById('holodeck-prompt');
    DOM.holodeckInput = document.getElementById('holodeck-password-input');
    DOM.tetherLayer = document.getElementById('tether-layer');

    resize();
    window.addEventListener('resize', resize);

    DOM.pauseOverlay = document.getElementById('pause-overlay');
    DOM.blockCursor = document.getElementById('block-cursor');

    // Commodore PET block cursor — position after typed text
    function updateBlockCursor() {
        if (!DOM.blockCursor || !DOM.input) return;
        // Measure text width to position cursor
        const canvas = document.createElement('canvas');
        const mCtx = canvas.getContext('2d');
        const style = getComputedStyle(DOM.input);
        mCtx.font = style.fontSize + ' ' + style.fontFamily;
        const textW = mCtx.measureText(DOM.input.value).width;
        // Account for letter-spacing
        const spacing = parseFloat(style.letterSpacing) || 0;
        const totalW = textW + (DOM.input.value.length * spacing);
        // Position relative to input's left edge
        const inputRect = DOM.input.getBoundingClientRect();
        const boxRect = DOM.input.parentElement.getBoundingClientRect();
        DOM.blockCursor.style.left = (inputRect.left - boxRect.left + totalW) + 'px';
        DOM.blockCursor.style.top = ((boxRect.height - 18) / 2) + 'px';
    }
    DOM.input.addEventListener('input', updateBlockCursor);
    DOM.input.addEventListener('focus', () => { DOM.blockCursor.style.display = 'inline-block'; updateBlockCursor(); });
    DOM.input.addEventListener('blur', () => { DOM.blockCursor.style.display = 'none'; });
    // Initial position
    setTimeout(updateBlockCursor, 100);

    document.getElementById('start-btn').addEventListener('click', () => startGame(false));
    document.getElementById('restart-btn').addEventListener('click', () => startGame(CONFIG.isHolodeck));
    document.getElementById('holodeck-btn')?.addEventListener('click', (e) => {
        // Guard: ignore clicks that fire within 300ms of the menu appearing
        // (prevents Enter keyup from password submission activating this button)
        if (state._holodeckMenuShownAt && Date.now() - state._holodeckMenuShownAt < 300) return;
        AudioManager.play('lcarsButton');
        startGame(true);
    });
    document.getElementById('exit-holodeck-btn')?.addEventListener('click', () => {
        AudioManager.play('lcarsButton');
        exitHolodeckMenu();
    });
    document.getElementById('update-datasets-btn')?.addEventListener('click', () => {
        AudioManager.play('lcarsButton');
        reloadAllCSVs();
    });

    // Pause menu buttons
    document.getElementById('resume-btn').addEventListener('click', () => resumeGame());
    document.getElementById('restart-pause-btn').addEventListener('click', () => {
        resumeGame();
        startGame(CONFIG.isHolodeck);
    });
    document.getElementById('quit-btn').addEventListener('click', () => {
        state.paused = false;
        state.running = false;
        DOM.pauseOverlay.classList.add('hidden');
        clearHolodeck();
        hideBeta();
        DOM.startOverlay.classList.remove('hidden');
        // Return to main menu (not title screen) — no background image
        titleDismissed = true;
        if (titlePrompt) titlePrompt.classList.add('hidden');
        if (normalMenuBtns) normalMenuBtns.classList.remove('hidden');
        startMenuMusic();
    });

    // ── Title Screen → Main Menu transition ──
    // On first load, menu buttons are hidden. Press any key / click to reveal them.
    const titlePrompt = document.getElementById('title-press-prompt');
    const normalMenuBtns = document.getElementById('normal-menu-buttons');
    let titleDismissed = false;

    function dismissTitleScreen(e) {
        if (titleDismissed) return;
        // Don't dismiss if a button was clicked (shouldn't happen since they're hidden)
        if (e && e.target && e.target.closest('button')) return;
        // Don't dismiss on modifier key combos (Ctrl+Shift+H for holodeck, etc.)
        if (e && e.type === 'keydown' && (e.ctrlKey || e.metaKey || e.altKey)) return;
        // Don't dismiss if the event came from an input (e.g. holodeck password)
        if (e && e.target && e.target.tagName === 'INPUT') return;
        titleDismissed = true;
        window._dismissTitleScreen = null;  // clean up global ref
        // Don't stop title music here — let it play through CAT login.
        // It will be replaced when startMenuMusic() is called from showMainMenu().
        AudioManager.init();
        state._titleDismissedAt = Date.now();
        document.removeEventListener('keydown', dismissTitleScreen);
        DOM.startOverlay.removeEventListener('click', dismissTitleScreen);

        // CAT login (dispatcher info) removed for now — go straight to the main menu.
        // Default the dispatcher identity so scoring/leaderboard still work.
        if (!player.name) player.name = 'DISPATCHER';
        showMainMenu();
    }

    // Expose dismissTitleScreen so the boot-level onEnded callback can reach it
    window._dismissTitleScreen = dismissTitleScreen;

    // If title music is already playing (started at boot completion), wire up the onEnded→dismiss
    if (AudioManager._musicEl && !AudioManager._musicOnEnded) {
        const onEnded = () => dismissTitleScreen();
        AudioManager._musicOnEnded = onEnded;
        AudioManager._musicEl.addEventListener('ended', onEnded);
    }

    function startMenuMusic() {
        if (CONFIG.isHolodeck) return;  // No music in holodeck mode
        AudioManager.playMusic('music/Asteroid Command - Menus.mp3', {
            loop: true,
            volume: 0.5,
            startTime: 5
        });
    }

    function showMainMenu() {
        titlePrompt.classList.add('hidden');
        DOM.startOverlay.classList.remove('hidden', 'title-screen-bg');
        DOM.startOverlay.classList.add('main-menu-bg');
        const titleCredits = document.getElementById('title-credits');
        if (titleCredits) titleCredits.classList.add('hidden');
        // Show the correct menu buttons depending on holodeck state
        if (DOM.startOverlay.classList.contains('holodeck-menu-active')) {
            document.getElementById('holodeck-menu-buttons').classList.remove('hidden');
        } else {
            normalMenuBtns.classList.remove('hidden');
        }
        startMenuMusic();
    }

    document.addEventListener('keydown', dismissTitleScreen);
    DOM.startOverlay.addEventListener('click', dismissTitleScreen);

    // ============================================
    // CAT LOGIN TERMINAL
    // ============================================

    const catOverlay = document.getElementById('cat-login-overlay');
    const catOutput = document.getElementById('cat-output');
    const catInput = document.getElementById('cat-input');
    const catPrompt = document.getElementById('cat-prompt');
    const catLeaderboard = document.getElementById('cat-leaderboard');
    let catStep = 'name'; // 'name' → 'oasis' → done

    function showCATLogin() {
        catOverlay.classList.remove('hidden');
        catOutput.textContent = '';
        catStep = 'name';
        catInput.value = '';
        catInput.type = 'text';
        catAppend('NIAGARA REGION EMS');
        catAppend('DISPATCH TRAINING SYSTEM v2.0');
        catAppend('');
        catAppend('READY.');
        catAppend('');
        catPrompt.textContent = 'ENTER NAME: ';
        // Defer focus so the click that triggered dismissTitleScreen doesn't steal it
        setTimeout(() => catInput.focus(), 0);
        renderLeaderboard();
        catLeaderboard.classList.remove('hidden');
    }

    // Clicking anywhere on the CAT overlay refocuses the input
    catOverlay.addEventListener('click', () => {
        if (!catOverlay.classList.contains('hidden')) catInput.focus();
    });

    function catAppend(text) {
        catOutput.textContent += text + '\n';
        // Auto-scroll
        const screen = document.getElementById('cat-screen');
        if (screen) screen.scrollTop = screen.scrollHeight;
    }

    catInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = catInput.value.trim();
            if (!val) return;

            if (catStep === 'name') {
                player.name = val.toUpperCase();
                catAppend('ENTER NAME: ' + player.name);
                catAppend('');
                catPrompt.textContent = 'OASIS #: ';
                catInput.value = '';
                catStep = 'oasis';
            } else if (catStep === 'oasis') {
                player.oasis = val;
                catAppend('OASIS #: ' + val);
                catAppend('');
                catAppend('WELCOME, ' + player.name + '.');
                catAppend('LOADING DISPATCH CONSOLE...');
                catInput.value = '';
                catStep = 'done';
                // Brief delay then show main menu
                setTimeout(() => {
                    catOverlay.classList.add('hidden');
                    showMainMenu();
                }, 1200);
            }
        }
    });

    // ============================================
    // LEADERBOARD (localStorage-backed)
    // ============================================

    function getScores() {
        try {
            const raw = localStorage.getItem('asteroid-command-scores');
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    }

    function saveScore(name, oasis, score, tier) {
        const scores = getScores();
        scores.push({
            name: name,
            oasis: oasis,
            score: score,
            tier: tier,
            date: new Date().toISOString().split('T')[0]
        });
        // Keep top 100 all-time (sorted descending)
        scores.sort((a, b) => b.score - a.score);
        if (scores.length > 100) scores.length = 100;
        localStorage.setItem('asteroid-command-scores', JSON.stringify(scores));
        return scores;
    }

    function getTop10() {
        return getScores().slice(0, 10);
    }

    function renderLeaderboard() {
        const list = document.getElementById('cat-lb-list');
        if (!list) return;
        const top10 = getTop10();
        if (top10.length === 0) {
            list.innerHTML = '<div class="cat-lb-empty">NO SCORES RECORDED</div>';
            return;
        }
        let html = '<div class="cat-lb-row header">' +
            '<span class="cat-lb-rank">#</span>' +
            '<span class="cat-lb-name">NAME</span>' +
            '<span class="cat-lb-score">SCORE</span>' +
            '<span class="cat-lb-tier">RANK</span></div>';
        top10.forEach((s, i) => {
            html += '<div class="cat-lb-row">' +
                '<span class="cat-lb-rank">' + (i + 1) + '</span>' +
                '<span class="cat-lb-name">' + (s.name || 'UNKNOWN') + '</span>' +
                '<span class="cat-lb-score">' + (s.score || 0).toLocaleString() + '</span>' +
                '<span class="cat-lb-tier">' + (s.tier || '') + '</span></div>';
        });
        list.innerHTML = html;
    }

    // Submit Score button on game over
    document.getElementById('submit-score-btn').addEventListener('click', () => {
        const statusEl = document.getElementById('score-submit-status');
        if (!player.name) {
            if (statusEl) { statusEl.textContent = 'NO PLAYER LOGGED IN'; statusEl.className = 'dataset-status error'; }
            return;
        }
        const tierLabel = TIERS[state.tier] ? TIERS[state.tier].label : state.tier.toUpperCase();
        saveScore(player.name, player.oasis, state.score, tierLabel);
        if (statusEl) {
            statusEl.textContent = '✓ SCORE SUBMITTED: ' + state.score.toLocaleString();
            statusEl.className = 'dataset-status success';
        }
        // Disable button after submission
        document.getElementById('submit-score-btn').disabled = true;
    });

    // When returning to menu from game-over or pause, skip the title phase
    document.getElementById('main-menu-btn').addEventListener('click', () => {
        DOM.gameOverOverlay.classList.add('hidden');
        DOM.gameOverOverlay.classList.remove('game-over-bg');
        DOM.startOverlay.classList.remove('hidden');
        DOM.startOverlay.classList.add('main-menu-bg');
        // Return to main menu (not title screen)
        titleDismissed = true;
        titlePrompt.classList.add('hidden');
        normalMenuBtns.classList.remove('hidden');
        startMenuMusic();
    });

    // Main menu ↔ Scoring submenu navigation
    const scoringBgLayer = document.getElementById('scoring-bg-layer');
    document.getElementById('scoring-btn').addEventListener('click', () => {
        document.getElementById('start-content').classList.add('hidden');
        document.getElementById('scoring-page').classList.remove('hidden');
        DOM.startOverlay.classList.remove('main-menu-bg');
        DOM.startOverlay.classList.add('scoring-menu-bg');
        scoringBgLayer.classList.remove('hidden');
    });
    document.getElementById('back-to-menu-btn').addEventListener('click', () => {
        document.getElementById('scoring-page').classList.add('hidden');
        document.getElementById('start-content').classList.remove('hidden');
        DOM.startOverlay.classList.remove('scoring-menu-bg');
        DOM.startOverlay.classList.add('main-menu-bg');
        scoringBgLayer.classList.add('hidden');
    });

    // Main menu ↔ Settings submenu navigation
    const settingsBgLayer = document.getElementById('settings-bg-layer');
    let musicEnabled = true;
    let sfxEnabled = true;
    const musicToggleBtn = document.getElementById('music-toggle-btn');
    const sfxToggleBtn = document.getElementById('sfx-toggle-btn');

    document.getElementById('settings-btn').addEventListener('click', () => {
        document.getElementById('start-content').classList.add('hidden');
        document.getElementById('settings-page').classList.remove('hidden');
        DOM.startOverlay.classList.remove('main-menu-bg');
        DOM.startOverlay.classList.add('settings-menu-bg');
        settingsBgLayer.classList.remove('hidden');
    });
    document.getElementById('settings-back-btn').addEventListener('click', () => {
        document.getElementById('settings-page').classList.add('hidden');
        document.getElementById('start-content').classList.remove('hidden');
        DOM.startOverlay.classList.remove('settings-menu-bg');
        DOM.startOverlay.classList.add('main-menu-bg');
        settingsBgLayer.classList.add('hidden');
    });

    musicToggleBtn.addEventListener('click', () => {
        musicEnabled = !musicEnabled;
        musicToggleBtn.textContent = musicEnabled ? 'ON' : 'OFF';
        musicToggleBtn.classList.toggle('on', musicEnabled);
        musicToggleBtn.classList.toggle('off', !musicEnabled);
        if (musicEnabled) {
            // Restore music volume
            if (AudioManager._musicEl) AudioManager._musicEl.volume = 0.5;
        } else {
            // Mute music
            if (AudioManager._musicEl) AudioManager._musicEl.volume = 0;
        }
        AudioManager._musicMuted = !musicEnabled;
    });

    sfxToggleBtn.addEventListener('click', () => {
        sfxEnabled = !sfxEnabled;
        sfxToggleBtn.textContent = sfxEnabled ? 'ON' : 'OFF';
        sfxToggleBtn.classList.toggle('on', sfxEnabled);
        sfxToggleBtn.classList.toggle('off', !sfxEnabled);
        AudioManager._sfxMuted = !sfxEnabled;
        if (sfxEnabled) {
            if (AudioManager.masterGain) AudioManager.masterGain.gain.value = 0.35;
        } else {
            if (AudioManager.masterGain) AudioManager.masterGain.gain.value = 0;
        }
    });

    // Main menu ↔ High Scores submenu navigation
    const highscoresBgLayer = document.getElementById('highscores-bg-layer');

    function renderHighScoresPage() {
        const list = document.getElementById('highscores-list');
        if (!list) return;
        const top10 = getTop10();
        if (top10.length === 0) {
            list.innerHTML = '<div class="hs-empty">NO SCORES RECORDED</div>';
            return;
        }
        let html = '<div class="hs-row header">' +
            '<span class="hs-rank">#</span>' +
            '<span class="hs-name">DISPATCHER</span></div>';
        top10.forEach((s, i) => {
            html += '<div class="hs-row">' +
                '<span class="hs-rank">' + (i + 1) + '</span>' +
                '<span class="hs-name">' + (s.name || 'UNKNOWN') + '</span></div>';
        });
        list.innerHTML = html;
    }

    document.getElementById('highscores-btn').addEventListener('click', () => {
        renderHighScoresPage();
        document.getElementById('start-content').classList.add('hidden');
        document.getElementById('highscores-page').classList.remove('hidden');
        DOM.startOverlay.classList.remove('main-menu-bg');
        DOM.startOverlay.classList.add('highscores-menu-bg');
        highscoresBgLayer.classList.remove('hidden');
    });
    document.getElementById('highscores-back-btn').addEventListener('click', () => {
        document.getElementById('highscores-page').classList.add('hidden');
        document.getElementById('start-content').classList.remove('hidden');
        DOM.startOverlay.classList.remove('highscores-menu-bg');
        DOM.startOverlay.classList.add('main-menu-bg');
        highscoresBgLayer.classList.add('hidden');
    });

    // ── Change Dispatcher (re-login as different player) ──
    document.getElementById('change-player-btn').addEventListener('click', () => {
        normalMenuBtns.classList.add('hidden');
        player.name = '';
        player.oasis = '';
        showCATLogin();
    });

    // ── Menu Keyboard Navigation (Arrow keys + Enter) ──
    let menuSelectedIndex = 0;

    function getVisibleMenuButtons() {
        // Determine which overlay is active and return its visible buttons
        const startOverlay = document.getElementById('start-overlay');
        const gameOverOverlay = document.getElementById('game-over-overlay');
        const pauseOverlay = document.getElementById('pause-overlay');

        let container = null;
        if (startOverlay && !startOverlay.classList.contains('hidden')) {
            // Check which page is visible: main menu, scoring, settings, or high scores
            const startContent = document.getElementById('start-content');
            const scoringPage = document.getElementById('scoring-page');
            const settingsPage = document.getElementById('settings-page');
            const highscoresPage = document.getElementById('highscores-page');
            if (scoringPage && !scoringPage.classList.contains('hidden')) {
                container = scoringPage;
            } else if (settingsPage && !settingsPage.classList.contains('hidden')) {
                container = settingsPage;
            } else if (highscoresPage && !highscoresPage.classList.contains('hidden')) {
                container = highscoresPage;
            } else if (startContent && !startContent.classList.contains('hidden')) {
                container = startContent;
            }
        } else if (gameOverOverlay && !gameOverOverlay.classList.contains('hidden')) {
            container = gameOverOverlay;
        } else if (pauseOverlay && !pauseOverlay.classList.contains('hidden')) {
            container = pauseOverlay;
        }

        if (!container) return [];
        // Get all visible, non-hidden buttons
        return Array.from(container.querySelectorAll('button')).filter(btn => {
            if (btn.offsetParent === null) return false; // hidden via CSS
            const parent = btn.closest('.hidden');
            return !parent;
        });
    }

    function updateMenuHighlight(buttons) {
        // Remove highlight from all menu buttons
        document.querySelectorAll('button.menu-kb-selected').forEach(b => b.classList.remove('menu-kb-selected'));
        if (buttons.length > 0 && menuSelectedIndex >= 0 && menuSelectedIndex < buttons.length) {
            buttons[menuSelectedIndex].classList.add('menu-kb-selected');
        }
    }

    // Sync mouse hover with keyboard selection — hovering a menu button highlights it
    document.addEventListener('mouseover', e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const menuButtons = getVisibleMenuButtons();
        const idx = menuButtons.indexOf(btn);
        if (idx >= 0) {
            menuSelectedIndex = idx;
            updateMenuHighlight(menuButtons);
        }
    });

    document.addEventListener('keydown', e => {
        // Menu navigation — only when a menu overlay is visible and game is NOT running
        // Skip menu nav while any prompt/input is active, or event came from an input element
        const skipMenuNav = state.holodeckPromptActive || state.devPromptActive
                         || (e.target && e.target.tagName === 'INPUT');
        const menuButtons = skipMenuNav ? [] : getVisibleMenuButtons();
        if (menuButtons.length > 0 && (!state.running || state.paused)) {
            // Clamp index if menu changed
            if (menuSelectedIndex >= menuButtons.length) menuSelectedIndex = 0;

            // Auto-highlight first button if none selected yet
            if (!document.querySelector('button.menu-kb-selected')) {
                menuSelectedIndex = 0;
                updateMenuHighlight(menuButtons);
            }

            if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault();
                menuSelectedIndex = (menuSelectedIndex - 1 + menuButtons.length) % menuButtons.length;
                updateMenuHighlight(menuButtons);
                return;
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault();
                menuSelectedIndex = (menuSelectedIndex + 1) % menuButtons.length;
                updateMenuHighlight(menuButtons);
                return;
            }
            // Any non-navigation key activates the highlighted button
            const isNavKey = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Escape','Tab',
                              'Shift','Control','Alt','Meta','CapsLock','NumLock','ScrollLock',
                              'F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'].includes(e.key);
            // Don't intercept Ctrl/Meta combos — they're intentional shortcuts (e.g. Ctrl+Shift+H)
            if (!isNavKey && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                // Guard: don't activate a button on the same keypress that dismissed the title screen
                if (state._titleDismissedAt && Date.now() - state._titleDismissedAt < 300) return;
                if (menuButtons[menuSelectedIndex]) {
                    menuButtons[menuSelectedIndex].click();
                    menuSelectedIndex = 0; // reset for next menu
                    // Update highlight for the new menu that may appear
                    setTimeout(() => {
                        const newButtons = getVisibleMenuButtons();
                        if (newButtons.length > 0) updateMenuHighlight(newButtons);
                    }, 50);
                }
                return;
            }
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            if (state.paused) {
                resumeGame();
            } else if (state.running && !state.devPromptActive && !state.holodeckPromptActive) {
                pauseGame();
            }
            return;
        }
        if (e.ctrlKey && e.shiftKey && e.key === 'B') {
            e.preventDefault();
            if (!state.devPromptActive) {
                showDevModePrompt();
            }
        }
        if (e.ctrlKey && e.shiftKey && e.key === 'H') {
            e.preventDefault();
            if (!state.holodeckPromptActive && !state.holodeckUnlocked) {
                showHolodeckPrompt();
            }
        }
    });

    DOM.input.addEventListener('keydown', e => {
        if (e.key === 'F12') {
            // Refresh the command box — wipe it to a clean slate
            e.preventDefault();
            DOM.input.value = '';
            if (DOM.blockCursor) {
                const inputRect = DOM.input.getBoundingClientRect();
                const boxRect = DOM.input.parentElement.getBoundingClientRect();
                DOM.blockCursor.style.left = (inputRect.left - boxRect.left) + 'px';
            }
            return;
        }
        if (e.key === 'Backspace') state.backspaces++;
        if (state.running) AudioManager.play('typing');
        if (e.key === 'Enter') {
            e.preventDefault();
            if (state.running) handleCommand(DOM.input.value);
        }
    });

    // Keep command input focused whenever anything in the game area is clicked
    document.getElementById('game-container').addEventListener('mouseup', () => {
        if (state.running && !state.devPromptActive) DOM.input.focus();
    });

    // Default click: focus input
    DOM.canvas.addEventListener('click', (e) => {
        if (!state.running) return;
        if (CONFIG.isHolodeck) {
            const rect = DOM.canvas.getBoundingClientRect();
            const vx = (e.clientX - rect.left) / canvasScaleX;
            const vy = (e.clientY - rect.top) / canvasScaleY;
            const hit = state.asteroids.find(a => {
                const dx = a.x - vx, dy = a.y - vy;
                return Math.sqrt(dx * dx + dy * dy) < a.radius * 2.5;
            });
            if (hit && godMode.clickToDestroy) {
                const bh = (TIERS[state.tier] || {}).baseHit || 100;
                if (fireProjectile(hit)) {
                    state.streak++;
                    state.consecutiveBasesDestroyed = 0;
                    applyScore(bh);
                    showStatus(`HIT +${bh}`, "hit");
                    updateHUD();
                    checkTier();
                } else if (godMode.godModeKill && (state.towerDisabled || state.rebuilding)) {
                    // God Mode: destroy asteroid directly when tower is down
                    createExplosion(hit.x, hit.y, '#00ffcc', hit.radius * 2);
                    const idx = state.asteroids.indexOf(hit);
                    if (idx !== -1) state.asteroids.splice(idx, 1);
                    state.streak++;
                    state.consecutiveBasesDestroyed = 0;
                    applyScore(bh);
                    showStatus(`HIT +${bh}`, "hit");
                    updateHUD();
                    checkTier();
                }
                return;
            }
        }
        DOM.input.focus();
    });

    // Double-click: holodeck zone/tower destroy
    DOM.canvas.addEventListener('dblclick', (e) => {
        if (!state.running || !CONFIG.isHolodeck || !godMode.destroyZones) return;
        const rect = DOM.canvas.getBoundingClientRect();
        const vx = (e.clientX - rect.left) / canvasScaleX;
        const vy = (e.clientY - rect.top) / canvasScaleY;

        // Find the closest defense to the click
        const hit = state.defenses.reduce((best, d) => {
            const L = d.x - d.w / 2, T = d.y - d.h;
            // Check if click is inside the sprite bounding box (with some padding)
            if (vx >= L - 20 && vx <= L + d.w + 20 && vy >= T - 20 && vy <= d.y + 20) {
                const dx = d.x - vx, dy = (d.y - d.h / 2) - vy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                return (!best || dist < best.dist) ? { def: d, dist } : best;
            }
            return best;
        }, null);

        if (hit) {
            const d = hit.def;
            if (d.type === 'tower') {
                if (state.shieldHP > 0) {
                    // Destroy shields first
                    state.shieldHP = 0;
                    state.towerExposed = true;
                    state.streakSinceShieldHit = 0;
                    showStatus("SHIELDS DESTROYED", "impact");
                } else if (!state.towerDisabled) {
                    // Then destroy the tower
                    destroyTower();
                    showStatus("TOWER DESTROYED", "impact");
                }
            } else if (d.hp > 0) {
                d.hp = 0;
                d.destroyed = true;
                d.destroyedAt = Date.now();
                createExplosion(d.x, d.y, '#ff3366', 50);
                showStatus(`${d.name} DESTROYED`, "impact");
                if (state.defenses.filter(z => z.type === 'zone' && z.hp > 0).length === 0) scheduleGameOver();
            }
            updateHUD();
        }
    });

    // Right-click: holodeck asteroid redirect system
    DOM.canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!state.running || !CONFIG.isHolodeck || !godMode.redirectAsteroid) return;

        const rect = DOM.canvas.getBoundingClientRect();
        const vx = (e.clientX - rect.left) / canvasScaleX;
        const vy = (e.clientY - rect.top) / canvasScaleY;

        // If an asteroid is already selected, try to pick a zone target
        if (state.holodeckSelectedAsteroid) {
            const selId = state.holodeckSelectedAsteroid;
            const asteroid = state.asteroids.find(a => a.id === selId);
            if (!asteroid) { state.holodeckSelectedAsteroid = null; return; }

            // Find the defense closest to where the player right-clicked
            const zone = state.defenses
                .reduce((best, d) => {
                    const dx = d.x - vx, dy = (d.y - d.h / 2) - vy;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    return (!best || dist < best.dist) ? { def: d, dist } : best;
                }, null);

            if (zone && zone.dist < 300) {
                // Redirect asteroid toward the new zone
                const newTarget = zone.def;
                asteroid.target = newTarget;
                const targetY = getImpactAltitude(newTarget);
                const dx = newTarget.x - asteroid.x;
                const dy = targetY - asteroid.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const currentSpeed = Math.sqrt(asteroid.vx * asteroid.vx + asteroid.vy * asteroid.vy);
                asteroid.vx = (dx / dist) * currentSpeed;
                asteroid.vy = (dy / dist) * currentSpeed;
                showStatus(`REDIRECTED → ${newTarget.name}`, "bonus");
            }
            state.holodeckSelectedAsteroid = null;
            return;
        }

        // First right-click: try to select an asteroid
        const hit = state.asteroids.find(a => {
            const dx = a.x - vx, dy = a.y - vy;
            return Math.sqrt(dx * dx + dy * dy) < a.radius * 2.5;
        });
        if (hit) {
            state.holodeckSelectedAsteroid = hit.id;
            showStatus(`SELECTED — RIGHT-CLICK A ZONE TO REDIRECT`, "bonus");
        }
    });

    render();
}

function resize() {
    const area = document.getElementById('play-area');
    const wrapper = document.getElementById('canvas-wrapper');

    // Calculate the largest 16:9 rectangle that fits in the play-area
    const areaW = area.clientWidth;
    const areaH = area.clientHeight;
    let pxW = areaW;
    let pxH = Math.round(pxW * (9 / 16));
    if (pxH > areaH) {
        pxH = areaH;
        pxW = Math.round(pxH * (16 / 9));
    }

    // Size the wrapper — canvas fills it via CSS (width/height: 100%)
    wrapper.style.width  = `${pxW}px`;
    wrapper.style.height = `${pxH}px`;

    // Set canvas buffer to match display size (no blurry scaling)
    DOM.canvas.width  = pxW;
    DOM.canvas.height = pxH;

    // Scale factors: virtual → pixel
    canvasScaleX = pxW / COORD_SYSTEM.width;
    canvasScaleY = pxH / COORD_SYSTEM.height;

    // SVG tether layer uses a viewBox matching virtual space
    if (DOM.tetherLayer) {
        DOM.tetherLayer.setAttribute('viewBox', `0 0 ${COORD_SYSTEM.width} ${COORD_SYSTEM.height}`);
    }

    // Sync terrain wings with canvas dimensions
    // Ground zone occupies ~80/900 of the virtual canvas height
    // Terrain starts at 90px from bottom of the 900px virtual canvas
    const groundHeight = Math.round(pxH * 90 / COORD_SYSTEM.height);
    const mainArea = document.getElementById('main-area');
    const leftPanel = document.getElementById('left-panel');
    const canvasLeft = leftPanel.offsetWidth + (areaW - pxW) / 2;
    const root = document.documentElement;
    root.style.setProperty('--ground-height', groundHeight + 'px');
    root.style.setProperty('--canvas-left', canvasLeft + 'px');
    root.style.setProperty('--canvas-width', pxW + 'px');
    root.style.setProperty('--canvas-height', pxH + 'px');

    // NOTE: Do NOT call initDefenses() here. Defense positions are in fixed
    // virtual coords (COORD_SYSTEM is constant), so resize never changes them —
    // re-running initDefenses would only wipe hp/destroyed state. That caused
    // destroyed zones (e.g. Skylon) to rebuild when toggling fullscreen (F11).
    updateLightPositions();

    // Show a prompt if window is significantly smaller than screen
    const sizePrompt = document.getElementById('size-prompt');
    if (sizePrompt) {
        const usableRatio = (window.innerWidth * window.innerHeight) / (screen.width * screen.height);
        if (usableRatio < 0.75) {
            sizePrompt.classList.remove('hidden');
        } else {
            sizePrompt.classList.add('hidden');
        }
    }
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

// Flash the holodeck grid — bold, unmistakable pulses
function flashGrid(count, cssClass) {
    const grid = document.getElementById('holodeck-grid');
    if (!grid) return;
    let i = 0;
    const flashOn = 250;   // ms each flash holds — long enough to sear into your retina
    const flashOff = 150;  // ms dark gap — just enough to make the next hit harder
    function step() {
        if (i >= count) return;
        grid.style.transition = 'none';
        grid.classList.remove('grid-flash', 'grid-watermark'); // clear any existing state
        grid.classList.add(cssClass);
        grid.offsetHeight; // force reflow
        setTimeout(() => {
            grid.classList.remove(cssClass);
            grid.offsetHeight;
            i++;
            if (i < count) setTimeout(step, flashOff);
        }, flashOn);
    }
    step();
}

// Holodeck password prompt — 15-second timed access gate
function showHolodeckPrompt() {
    state.holodeckPromptActive = true;
    DOM.holodeckPrompt.classList.remove('hidden');
    DOM.holodeckPrompt.classList.add('active');
    DOM.holodeckInput.value = '';
    DOM.holodeckInput.focus();

    // Signal: 2 rapid yellow flashes = password box is open
    flashGrid(2, 'grid-signal-yellow');

    let timeLeft = CONFIG.holodeckTimeout / 1000;
    const timerEl = document.getElementById('holodeck-timer');
    if (timerEl) timerEl.textContent = timeLeft;

    const timerInterval = setInterval(() => {
        timeLeft--;
        if (timerEl) timerEl.textContent = Math.max(0, timeLeft);
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            flashGrid(3, 'grid-signal-red');
            hideHolodeckPrompt();
            showStatus("ACCESS TIMEOUT", "miss");
        }
    }, 1000);

    const cleanup = () => {
        DOM.holodeckInput.removeEventListener('keydown', submitHandler);
        if (state._holodeckRefocusHandler) {
            document.removeEventListener('mouseup', state._holodeckRefocusHandler);
            state._holodeckRefocusHandler = null;
        }
    };

    const submitHandler = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopImmediatePropagation();   // Don't let Enter bubble to document
            clearInterval(timerInterval);
            const input = DOM.holodeckInput.value.trim().toUpperCase();

            // Blur BEFORE hiding so the browser doesn't auto-focus the next element
            DOM.holodeckInput.blur();

            if (input === CONFIG.holodeckPassword) {
                state.holodeckUnlocked = true;
                enterHolodeckMenu();
                showStatus("AUTHORIZED", "bonus");
            } else {
                flashGrid(3, 'grid-signal-red');
            }

            // Defer prompt deactivation so holodeckPromptActive stays true
            // through the rest of this event's propagation (prevents menu nav
            // from clicking the holodeck button on the same Enter keydown)
            setTimeout(() => {
                hideHolodeckPrompt();
                cleanup();
            }, 0);
        } else if (e.key === 'Escape') {
            clearInterval(timerInterval);
            flashGrid(3, 'grid-signal-red');
            hideHolodeckPrompt();
            cleanup();
        }
    };

    DOM.holodeckInput.addEventListener('keydown', submitHandler);

    // Re-focus if user clicks elsewhere while prompt is active
    const refocusHandler = () => {
        if (state.holodeckPromptActive) DOM.holodeckInput.focus();
    };
    document.addEventListener('mouseup', refocusHandler);
    state._holodeckRefocusHandler = refocusHandler;

    state.timers.holodeckTimeout = setTimeout(() => {
        if (state.holodeckPromptActive) {
            clearInterval(timerInterval);
            flashGrid(3, 'grid-signal-red');
            hideHolodeckPrompt();
            cleanup();
        }
    }, CONFIG.holodeckTimeout);
}

function hideHolodeckPrompt() {
    state.holodeckPromptActive = false;
    DOM.holodeckPrompt.classList.remove('active');
    DOM.holodeckPrompt.classList.add('hidden');
    DOM.holodeckInput.value = '';
    clearTimeout(state.timers.holodeckTimeout);
    if (state._holodeckRefocusHandler) {
        document.removeEventListener('mouseup', state._holodeckRefocusHandler);
        state._holodeckRefocusHandler = null;
    }
}

// ============================================
// DEFENSES (Fine-Tuned Topography Alignment)
// ============================================

function initDefenses() {
    const w = COORD_SYSTEM.width;
    const h = COORD_SYSTEM.height;
    const s = w / 5;

    // Compensating for transparent padding in the image files.
    // y = sprite bottom; higher value = lower on screen. Values beyond h clip transparent bottom padding.
    const yAdamBeck = h + 40;  // Sunk into water — transparent bottom padding absorbs the overshoot
    const ySkylon   = h - 80;  // Lowered a smidge so base rests on terrain
    const yTower    = h - 80;  // Lowered a smidge so base rests on terrain
    const yCanal    = h - 70;  // Sits on trench edge
    const yRobin    = h - 70;  // Sits on grass

    state.defenses = [
        { id: 1, type: 'zone', name: "NOTL", x: s * 0.4, y: yAdamBeck, w: 315, h: 297, hp: 100,
          fileIntact: 'Sir_Adam_Beck_INTACT', fileDestroyed: 'Sir_Adam_Beck_DESTROYED', destroyed: false },
          
        { id: 2, type: 'zone', name: "NIAGARA FALLS", x: s * 1.5, y: ySkylon, w: 111, h: 131, hp: 100, 
          fileIntact: 'Skylon_INTACT', fileDestroyed: 'Skylon_DESTROYED', destroyed: false },
          
        { id: 'tower', type: 'tower', name: "RADIO TOWER", x: s * 2.5, y: yTower, w: 105, h: 180, hp: 100,
          fileIntact: 'Tower_INTACT', fileDestroyed: 'Tower_DESTROYED', destroyed: false },
          
        { id: 3, type: 'zone', name: "THOROLD", x: s * 3.5, y: yCanal, w: 118, h: 111, hp: 100,
          fileIntact: 'Welland_Canal_INTACT', fileDestroyed: 'Welland_Canal_DESTROYED',
          fileTowers: 'Welland_Canal_Towers_INTACT', fileDeck: 'Welland_Canal_Deck_INTACT',
          isLiftBridge: true, destroyed: false },
          
        { id: 4, type: 'zone', name: "PORT COLBORNE", x: s * 4.6, y: yRobin, w: 157, h: 157, hp: 100,
          fileIntact: 'Robin_Hood_INTACT', fileDestroyed: 'Robin_Hood_DESTROYED', destroyed: false }
    ];
}

function getTower() { return state.defenses.find(d => d.type === 'tower'); }

// ============================================
// GLASS DOME SHIELD
// ============================================

function drawShield(ctx, tower) {
    if (state.shieldHP <= 0) return;

    const cx = tower.x;
    const by = tower.y;       // flush with ground level
    const hw = 105, ht = 195;

    const color = state.shieldHP > 6 ? '#00ff88' : state.shieldHP > 3 ? '#ff6600' : '#9d00ff';

    const pulse = Math.sin(Date.now() / 300);

    ctx.save();

    // Clip to a rectangle so the dome bottom is a flat horizontal line at ground level
    ctx.beginPath();
    ctx.rect(cx - hw - 10, by - ht - 10, (hw + 10) * 2, ht + 10);
    ctx.clip();

    // — Dome fill (hemisphere clipped flat at bottom) —
    ctx.beginPath();
    ctx.ellipse(cx, by, hw, ht, 0, Math.PI, 0, false);
    const grad = ctx.createLinearGradient(cx, by, cx, by - ht);
    grad.addColorStop(0, color + '22');
    grad.addColorStop(1, color + '08');
    ctx.fillStyle = grad;
    ctx.globalAlpha = 0.4 + pulse * 0.1;
    ctx.fill();

    // — Dome arc (hemisphere outline) —
    ctx.beginPath();
    ctx.ellipse(cx, by, hw, ht, 0, Math.PI, 0, false);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 15 + Math.sin(Date.now() / 200) * 5;
    ctx.globalAlpha = 0.4 + pulse * 0.1;
    ctx.stroke();

    // — Flat base line — straight horizontal where dome meets ground
    ctx.beginPath();
    ctx.moveTo(cx - hw, by);
    ctx.lineTo(cx + hw, by);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8;
    ctx.globalAlpha = 0.35 + pulse * 0.08;
    ctx.stroke();

    ctx.restore();

    drawCracks(ctx, tower);
}

function addCrack() {
    const tower = getTower();
    if (!tower) return;

    const cx = tower.x, by = tower.y;
    const hw = 105, ht = 195;

    // Clamp a point to stay inside the dome (hemisphere above ground)
    function clampToEllipse(px, py) {
        const nxRaw = (px - cx) / hw;
        const nxClamped = Math.max(-1, Math.min(1, nxRaw));
        const maxRy = ht * (1 - nxClamped * nxClamped);
        const ry = by - py;
        const ryClamped = Math.max(0, Math.min(maxRy, ry));
        return { x: cx + nxClamped * hw, y: by - ryClamped };
    }

    const origin = clampToEllipse(
        cx + (Math.random() - 0.5) * 150,
        by - Math.random() * 120
    );

    const crack = { x: origin.x, y: origin.y, branches: [], alpha: 1 };
    const num = 2 + Math.floor(Math.random() * 3);

    for (let i = 0; i < num; i++) {
        const angle = (Math.PI * 2 / num) * i + (Math.random() - 0.5) * 0.5;
        const segs = [];
        let px = origin.x, py = origin.y;
        for (let j = 0; j < 4; j++) {
            const a = angle + (Math.random() - 0.5) * 0.8;
            const len = 8 + Math.random() * 10;
            const clamped = clampToEllipse(px + Math.cos(a) * len, py + Math.sin(a) * len);
            segs.push({ x1: px, y1: py, x2: clamped.x, y2: clamped.y });
            px = clamped.x; py = clamped.y;
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

        if (type === 'misfire') { AudioManager.play('misfire'); triggerRicochet(); addCrack(); }
        else if (type === 'impact') { AudioManager.play('shieldHit'); addCrack(); addCrack(); state.streakSinceShieldHit = 0; }

        if (state.shieldHP === 0) {
            AudioManager.play('shieldDown');
            state.towerExposed = true;
            showStatus("SHIELDS DOWN — TOWER EXPOSED", "impact");
        }
    } else if (type === 'impact') {
        destroyTower();
    }
    updateHUD();
}

function destroyTower() {
    AudioManager.play('towerDown');
    state.towerDisabled = true;
    const tower = getTower();
    if (tower) tower.destroyed = true;
    // Radio tower down — music degrades to broken static
    AudioManager.enableMusicStatic();

    state.ambulanceDestroyCount++;
    const delaySec = 4 * Math.pow(2, state.ambulanceDestroyCount - 1);
    // Constitutional: Target Impact (Initiator) → Impact Zone (Receiver: RADIO TOWER)
    showStatus(`TARGET IMPACT → RADIO TOWER — REPAIR UNIT ETA ${delaySec}s`, "impact");

    if (state.ambulancePendingTimer) clearTimeout(state.ambulancePendingTimer);
    state.ambulancePendingTimer = setTimeout(() => {
        state.ambulancePendingTimer = null;
        startAmbulance();
    }, delaySec * 1000);
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
            if (r.life <= 0 || r.y < -50 || r.y > COORD_SYSTEM.height + 50 || r.x < -50 || r.x > COORD_SYSTEM.width + 50) {
                state.ricochetProjectiles.splice(i, 1);
            }
            continue;
        }
        
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.trail.push({ x: r.x, y: r.y });
        if (r.trail.length > 8) r.trail.shift();

        const cx = tower.x, by = tower.y, hw = 105, ht = 195;
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
        if (r.life <= 0 || (r.bounces <= 0 && (r.y > COORD_SYSTEM.height || r.y < -50))) {
            state.ricochetProjectiles.splice(i, 1);
        }
    }
}

// ============================================
// ASTEROIDS & DYNAMIC TELEMETRY
// ============================================

// Centralized Impact Altitude Calculator — Returns the Y coordinate of the "roof"
function getImpactAltitude(target) {
    if (target.type === 'tower') {
        // Tower: hits the energy dome apex if shields are up, otherwise the physical chassis top
        // Shield up: apex of dome is at tower.y - ht = tower.y - 195
        return state.shieldHP > 0 ? target.y - 195 : target.y - target.h + 20;
    }
    // Sir Adam Beck (id 1): large transparent area at top of sprite — lower the impact zone
    // so asteroids hit the visible building, not the empty space above it
    if (target.id === 1) return target.y - target.h * 0.45;
    // Zone buildings: roof is at y - height, we sink 15px into the building before impact triggers
    return target.y - target.h + 15;
}

// ============================================
// SPAWN ZONE SYSTEM — 16-zone spread logic
// ============================================
// The 1600-unit sky is split into 16 × 100-unit columns (zones 0-15).
// Rule 1 : The zone used by this spawn is blocked for the next 3 spawns.
// Rule 2 : The zones immediately left and right of the most-recent spawn
//          are also blocked for the very next spawn.
// Both rules together prevent visual clustering while preserving randomness.
function getSpawnZone() {
    const NUM_ZONES = 16;
    if (!state.spawnHistory) state.spawnHistory = [];
    const history  = state.spawnHistory;
    const lastZone = history.length > 0 ? history[history.length - 1] : -99;

    // Build the forbidden set
    const forbidden = new Set(history);                 // last-3 block (rule 1)
    if (lastZone >= 0) {
        if (lastZone > 0)            forbidden.add(lastZone - 1); // adjacent-left  (rule 2)
        if (lastZone < NUM_ZONES-1)  forbidden.add(lastZone + 1); // adjacent-right (rule 2)
    }

    const allowed = [];
    for (let z = 0; z < NUM_ZONES; z++) {
        if (!forbidden.has(z)) allowed.push(z);
    }

    // Safety fallback: if somehow all zones are blocked, ignore history
    const zone = allowed.length > 0
        ? allowed[Math.floor(Math.random() * allowed.length)]
        : Math.floor(Math.random() * NUM_ZONES);

    state.spawnHistory = [...history, zone].slice(-3); // keep last 3
    return zone;
}

// ============================================
// ASTEROID COLLISION PHYSICS — Elastic Bumps
// ============================================
// Equal-mass elastic 2D collision: swaps velocity components along the
// collision normal, then pushes centres apart so they no longer overlap.
// Asteroids cannot damage each other.
function resolveAsteroidCollisions() {
    const rocks = state.asteroids;
    for (let i = 0; i < rocks.length; i++) {
        for (let j = i + 1; j < rocks.length; j++) {
            const a = rocks[i];
            const b = rocks[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const distSq = dx * dx + dy * dy;
            const minDist = a.radius + b.radius;
            if (distSq >= minDist * minDist || distSq === 0) continue;

            const dist = Math.sqrt(distSq);
            const nx = dx / dist;  // collision normal (unit vector)
            const ny = dy / dist;

            // Relative velocity along the normal
            const dot = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
            if (dot <= 0) continue; // already separating — nothing to resolve

            // Equal-mass elastic: exchange normal velocity components
            a.vx -= dot * nx;
            a.vy -= dot * ny;
            b.vx += dot * nx;
            b.vy += dot * ny;

            // Asteroids only fall — clamp upward vy
            if (a.vy < 0) a.vy = 0;
            if (b.vy < 0) b.vy = 0;

            // Positional correction: push centres apart so overlap is zero
            const push = (minDist - dist) * 0.5;
            a.x -= push * nx;
            a.y -= push * ny;
            b.x += push * nx;
            b.y += push * ny;
        }
    }
}

function spawnAsteroid() {
    if (state.asteroids.length >= state.maxTargets || state.rebuilding) return;

    // In holodeck, filter by targetable zones (if configured)
    let availableTargets = state.defenses;
    if (CONFIG.isHolodeck && godMode.targetableZones && godMode.targetableZones.size > 0) {
        const filtered = state.defenses.filter(d => godMode.targetableZones.has(d.id));
        if (filtered.length > 0) availableTargets = filtered;
    }
    const target = availableTargets[Math.floor(Math.random() * availableTargets.length)];
    const zone      = getSpawnZone();
    const zoneWidth = COORD_SYSTEM.width / 16;                   // 100 virtual units per zone
    const sx = zone * zoneWidth + Math.random() * zoneWidth;    // random within chosen zone
    const sy = -CONFIG.asteroidRadius;

    // AIM AT THE ROOF, not the basement
    const targetY = getImpactAltitude(target);
    const dx = target.x - sx;
    const dy = targetY - sy;
    
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    // Speed variance: randomize between tier's speedMin and speedMax
    const tierData = TIERS[state.tier];
    const effectiveSpeed = tierData
        ? tierData.speedMin + Math.random() * (tierData.speedMax - tierData.speedMin)
        : state.speedMult;
    const time = Math.max(2500, 25000 / effectiveSpeed);
    const baseSpeed = (dist / (time / 1000)) * effectiveSpeed * 2;
    // Introduce mechanical friction: +/- 15% random variance per target
    const variance = 0.85 + (Math.random() * 0.30);
    const speed = baseSpeed * variance;

    const specs = getTargetSpecs();
    const spriteIndex = Math.floor(Math.random() * ASTEROID_SPRITES.length);

    AudioManager.play('spawn');
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
        spawnTime: Date.now(),           // Speed Demon tracking
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

function maintainAsteroids(dt) {
    if (state.rebuilding) return;

    // Initialize spawn timer if it doesn't exist
    if (state.timers.spawnTimer === undefined) {
        state.timers.spawnTimer = state.spawnInterval; // Start ready to spawn
    }

    // Accumulate time
    state.timers.spawnTimer += dt * 1000;

    // Randomize spawn interval between tier's min and max each cycle
    const tierData = TIERS[state.tier];
    const spawnMin = tierData ? tierData.spawnMin : state.spawnInterval;
    const spawnMax = tierData ? tierData.spawnMax : state.spawnInterval;
    const baseInterval = spawnMin + Math.random() * (spawnMax - spawnMin);

    // Effective interval: -0.5 s when the screen is fully cleared
    const effectiveInterval = state.asteroids.length === 0
        ? baseInterval - 500
        : baseInterval;

    // Only spawn when timer exceeds interval AND we're under max targets
    if (state.asteroids.length < state.maxTargets && state.timers.spawnTimer >= effectiveInterval) {
        spawnAsteroid();
        state.timers.spawnTimer = 0;
    }
}

// ============================================
// PROJECTILES
// ============================================

function fireProjectile(target) {
    const tower = getTower();
    if (state.towerDisabled || state.rebuilding || !tower) return false;

    const proj = { id: Date.now(), x: tower.x, y: tower.y - tower.h * 0.93, targetId: target.id, speed: CONFIG.projectileSpeed, trail: [] };
    const dx = target.x - proj.x, dy = target.y - proj.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    proj.vx = (dx / d) * proj.speed;
    proj.vy = (dy / d) * proj.speed;

    AudioManager.play('fire');
    state.projectiles.push(proj);
    return true;
}

function fireBroken() {
    const tower = getTower();
    if (!tower) return;

    const arc = state.towerExposed ? -8 : -2;
    const drift = state.towerExposed ? (Math.random() - 0.5) * 12 : (Math.random() - 0.5) * 5;

    state.brokenProjectiles.push({ x: tower.x, y: tower.y - tower.h * 0.93, vx: drift, vy: arc, g: 0.15, smoke: [], life: 1 });
}

function createExplosion(x, y, color = '#ff6600', size = 30) {
    state.explosions.push({ x, y, radius: size, max: size * 2, alpha: 1, color });
}

// ============================================
// PURIFIED SHATTER VFX (Canvas Only)
// ============================================

function createShatter(x, y, spriteIndex) {
    // Generate 10-15 pieces of canvas-rendered shrapnel
    const shardCount = 10 + Math.floor(Math.random() * 5);
    
    for (let i = 0; i < shardCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const velocity = 2 + Math.random() * 6;
        
        state.environmentalParticles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * velocity,
            vy: Math.sin(angle) * velocity - 2, // Slight upward burst
            radius: 2 + Math.random() * 4,
            color: 'rgba(180, 180, 180, 1)', // Dust/Rock color
            life: 1.0, 
            decay: 0.02 + Math.random() * 0.02, 
            type: 'shrapnel'
        });
    }
}

// ============================================
// INPUT HANDLING
// ============================================

function handleCommand(value) {
    const input = value.trim().toUpperCase();
    DOM.input.value = '';
    if (DOM.blockCursor) {
        const inputRect = DOM.input.getBoundingClientRect();
        const boxRect = DOM.input.parentElement.getBoundingClientRect();
        DOM.blockCursor.style.left = (inputRect.left - boxRect.left) + 'px';
    }

    const bs = state.backspaces;
    state.backspaces = 0;

    if (state.rebuilding) {
        showStatus("TOWER REBUILDING — STAND BY", "miss");
        return;
    }

    if (CONFIG.isBeta && state.asteroids.length > 0) {
        const oldest = state.asteroids[0];
        if (fireProjectile(oldest)) {
            const bh = (TIERS[state.tier] || {}).baseHit || 100;
            state.streak++;
            state.consecutiveBasesDestroyed = 0;  // any kill resets base counter
            applyScore(bh);
            showStatus(`BETA HIT +${bh}`, "hit");
            updateHUD();
            checkTier();
        }
        return;
    }

    if (input === '') {
        if (CONFIG.isHolodeck && state.asteroids.length > 0) {
            fireProjectile(state.asteroids[0]) ? showStatus("TARGETING OLDEST", "hit") : showStatus("TOWER OFFLINE", "miss");
        } else if (state.asteroids.length > 0) {
            // Misfire: reset kill streak, break perfect streak
            state.streak = 0;
            state.perfectStreak = 0;
            state.perfectMilestonesHit = [];
            const penalty = Math.max(SCORING.maxPenalty, -50);
            applyScore(penalty);
            if (state.shieldHP > 0) {
                applyDamage(CONFIG.misfireDamage, 'misfire');
                showStatus(`MISFIRE ${penalty} — NO COMMAND`, "miss");
            } else {
                fireBroken();
                showStatus(`SYSTEM FAILURE ${penalty}`, "miss");
            }
            DOM.input.classList.add('error');
            setTimeout(() => DOM.input.classList.remove('error'), 300);
            flashScorePenalty();
            updateHUD();
            checkTier();
        }
        return;
    }

    const match = state.asteroids.find(a => a.command.toUpperCase() === input);

    if (match) {
        if (fireProjectile(match)) {
            state.streak++;
            state.streakSinceShieldHit++;
            state.consecutiveBasesDestroyed = 0;  // any asteroid kill resets base counter
            state.comebackCounter++;

            // ── Run scoring pipeline ──
            const pts = calcScore(match, bs);
            applyScore(pts.total);

            // Track clean hits
            if (pts.isPerfect) {
                state.cleanHits++;
            }

            // Comeback Bonus: 3 kills after losing a base
            if (!state.comebackAwarded && state.comebackCounter >= SCORING.comebackTarget) {
                state.comebackAwarded = true;
                applyScore(SCORING.comebackFlat);
                showStatus(`BACK ONLINE +${SCORING.comebackFlat}`, "bonus");
                updateHUD(); checkTier(); checkCalibration(); checkRegen();
                return;
            }

            // Show base points first
            showStatus(`+${pts.total}`, "hit");

            // Then show bonuses/penalties as separate queued messages
            const penaltyPrefixes = ['KEY DUST','SIGNAL NOISE','COMMS DRIFT','STATIC JAM'];
            const isPenalty = n => penaltyPrefixes.some(p => n.startsWith(p));
            const bonusNotes = pts.notes.filter(n => !isPenalty(n));
            const penaltyNotes = pts.notes.filter(n => isPenalty(n));

            for (const note of bonusNotes) {
                showStatus(note, "bonus");
            }
            for (const note of penaltyNotes) {
                showStatus(note, "miss");
            }

            // Show kill-streak text on milestone transitions
            const streakText = getKillStreakText(state.streak);
            if (streakText && state.streak === SCORING.killStreakSteps.find(s => s.text === streakText)?.min) {
                showStatus(`${streakText}`, "bonus");
            }

            DOM.input.classList.add('success');
            setTimeout(() => DOM.input.classList.remove('success'), 200);

            checkTier();
            checkCalibration();
            checkRegen();
        }
    } else {
        // Misfire: reset kill streak, break perfect streak
        state.streak = 0;
        state.perfectStreak = 0;
        state.perfectMilestonesHit = [];

        const penalty = Math.max(SCORING.maxPenalty, -50);
        applyScore(penalty);

        if (state.shieldHP > 0) {
            applyDamage(CONFIG.misfireDamage, 'misfire');
            showStatus(`MISFIRE ${penalty} — SHIELD ABSORBS`, "miss");
        } else {
            fireBroken();
            showStatus(`SYSTEM FAILURE ${penalty}`, "miss");
        }

        DOM.input.classList.add('error');
        setTimeout(() => DOM.input.classList.remove('error'), 300);
        flashScorePenalty();
    }

    updateHUD();
    checkTier();
}

// ============================================
// SCORING
// ============================================

// ── Scoring Pipeline (scoring.csv v2) ──────────────────────────────────────────
// Order: Base Hit → multiplier bonuses (Perfect, Early, Speed) → streak mult
//        → flat bonuses (milestones, micro-rewards) → penalties → score floor
function calcScore(asteroid, backspaces) {
    const tierData = TIERS[state.tier];
    const baseHit = tierData ? tierData.baseHit : 100;
    const notes = [];
    let bonusMult = 0;   // additive multiplier bonuses (applied to baseHit)
    let flatBonus = 0;   // flat point bonuses added after streak mult
    let penalty = 0;     // flat penalties subtracted at the end

    // ── Step 1: Multiplier bonuses (additive on baseHit) ──

    // Perfect Shot: 0 backspaces
    const isPerfect = backspaces === 0;
    if (isPerfect) {
        bonusMult += SCORING.perfectMult;
        notes.push('PERFECT');
    }

    // Early Intercept: top 25% of screen
    if (asteroid.y < COORD_SYSTEM.height * CONFIG.altitudeThreshold) {
        bonusMult += SCORING.earlyMult;
        notes.push('EARLY INTERCEPT');
    }

    // Speed Demon: cleared within 1.5s of spawn
    if (asteroid.spawnTime && (Date.now() - asteroid.spawnTime) < SCORING.speedDemonTime) {
        bonusMult += SCORING.speedDemonMult;
        notes.push('SPEED DEMON');
    }

    // Near-Miss Save: bottom 10% of screen
    if (asteroid.y > COORD_SYSTEM.height * SCORING.nearMissThreshold) {
        flatBonus += SCORING.nearMissFlat;
        notes.push('CLOSE CALL!');
    }

    // ── Step 2: Calculate base + multiplier bonuses ──
    let total = baseHit + Math.floor(baseHit * bonusMult);

    // ── Step 3: Apply kill-streak multiplier ──
    const streakMult = getKillStreakMultiplier(state.streak);
    if (streakMult > 1) {
        total = Math.floor(total * streakMult);
    }

    // ── Step 4: Perfect Shot streak milestones (flat bonuses) ──
    // Streak forgiveness: 1 backspace keeps the streak alive, 2+ breaks it
    const keepsPerfectStreak = backspaces <= 1;
    if (keepsPerfectStreak) {
        // Only count as "perfect" for streak if 0 backspaces
        if (isPerfect) {
            state.perfectStreak++;
        }
        // Check milestones
        for (const ms of SCORING.streakMilestones) {
            if (state.perfectStreak >= ms.threshold && !state.perfectMilestonesHit.includes(ms.threshold)) {
                state.perfectMilestonesHit.push(ms.threshold);
                flatBonus += ms.bonus;
                notes.push(`${ms.text} +${ms.bonus}`);
            }
        }
    } else {
        // 2+ backspaces breaks the perfect streak
        state.perfectStreak = 0;
        state.perfectMilestonesHit = [];
    }

    // ── Step 5: Micro-rewards ──

    // First Blood: first asteroid destroyed in session
    if (!state.firstBloodAwarded) {
        state.firstBloodAwarded = true;
        flatBonus += SCORING.firstBloodFlat;
        notes.push('ONLINE');
    }

    // Comeback Bonus: 3 kills after losing a base
    if (!state.comebackAwarded && state.comebackCounter >= SCORING.comebackTarget - 1) {
        // -1 because counter will be incremented in handleCommand after calcScore
        // Actually, streak is already incremented before calcScore is called,
        // but comebackCounter hasn't been incremented yet. Let's check +1
        // We'll handle this in handleCommand instead for accurate timing.
    }

    // Add flat bonuses to total
    total += flatBonus;

    // ── Step 6: Typing penalties (highest tier only) ──
    if (backspaces >= 7) {
        penalty = SCORING.staticJamFlat;      // -50 flat
        notes.push(`STATIC JAM ${penalty}`);
    } else if (backspaces >= 5) {
        penalty = SCORING.commsDriftFlat;     // -30 flat
        notes.push(`COMMS DRIFT ${penalty}`);
    } else if (backspaces >= 3) {
        penalty = -Math.floor(baseHit * SCORING.signalNoiseMult);  // -20% of base
        notes.push(`SIGNAL NOISE ${penalty}`);
    } else if (backspaces >= 1) {
        penalty = -Math.floor(baseHit * SCORING.keyDustMult);      // -10% of base
        notes.push(`KEY DUST ${penalty}`);
    }
    total += penalty;  // penalty is already negative

    return { total, notes, isPerfect, streakMult, baseHit };
}

// Look up kill-streak multiplier from the steps table
function getKillStreakMultiplier(streak) {
    for (const step of SCORING.killStreakSteps) {
        if (streak >= step.min && streak <= step.max) return step.mult;
    }
    return 1.0;
}

// Look up kill-streak UI text
function getKillStreakText(streak) {
    for (const step of SCORING.killStreakSteps) {
        if (streak >= step.min && streak <= step.max) return step.text;
    }
    return '';
}

// Apply score, enforce floor at 0
function applyScore(delta) {
    state.score = Math.max(0, state.score + delta);
}

// Check Calibration Bonus: every 500 pts within a rank
function checkCalibration() {
    const tierData = TIERS[state.tier];
    if (!tierData) return;
    const scoreInRank = state.score - tierData.min;
    const calibrationsSoFar = Math.floor(scoreInRank / SCORING.calibrationInterval);
    const lastCount = Math.floor((state.lastCalibrationAt - tierData.min) / SCORING.calibrationInterval);
    if (calibrationsSoFar > lastCount && state.score > state.lastCalibrationAt) {
        state.lastCalibrationAt = state.score;
        applyScore(SCORING.calibrationFlat);
        showStatus(`DISPATCH HANDS +${SCORING.calibrationFlat}`, "bonus");
    }
}

// ============================================
// HUD & STATUS
// ============================================

// ── VDS Dual-Screen Typewriter System ──
// VDS1: numerical values (+points / -penalty)
// VDS2: text descriptions (PERFECT, STREAK, MISFIRE, etc.)
const vds1Queue = [];
const vds2Queue = [];
let vds1Typing = false;
let vds2Typing = false;

function showStatus(msg, type = '') {
    // Extract numerical portion (+/-number) for VDS1, text for VDS2
    const numMatch = msg.match(/([+-]\d[\d,]*)/);
    if (numMatch) {
        // Send the number to VDS1
        vds1Queue.push({ msg: numMatch[1], type });
        if (!vds1Typing) processVds1Queue();
        // Send the text (without the number) to VDS2 if there's meaningful text left
        const textPart = msg.replace(numMatch[1], '').replace(/^\s*—?\s*/, '').replace(/\s*—?\s*$/, '').trim();
        if (textPart) {
            vds2Queue.push({ msg: textPart, type });
            if (!vds2Typing) processVds2Queue();
        }
    } else {
        // Pure text with no number — send to VDS2 only
        vds2Queue.push({ msg, type });
        if (!vds2Typing) processVds2Queue();
    }
}

// ── VDS1: Points display ──
function processVds1Queue() {
    if (vds1Queue.length === 0) {
        vds1Typing = false;
        const cursor = document.getElementById('vds-cursor');
        if (cursor) cursor.classList.add('hidden');
        return;
    }
    vds1Typing = true;
    const { msg, type } = vds1Queue.shift();
    typeOnVds(DOM.status, DOM.vds, document.getElementById('vds-cursor'), msg, type, 'status', () => {
        clearTimeout(state.timers.status);
        state.timers.status = setTimeout(() => {
            DOM.status.textContent = '';
            DOM.status.className = '';
            DOM.status.style.color = '';
            const cursor = document.getElementById('vds-cursor');
            if (cursor) cursor.classList.add('hidden');
            processVds1Queue();
        }, vds1Queue.length > 0 ? 800 : 2000);
    });
}

// ── VDS2: Text descriptions ──
function processVds2Queue() {
    if (vds2Queue.length === 0) {
        vds2Typing = false;
        const cursor = document.getElementById('vds2-cursor');
        if (cursor) cursor.classList.add('hidden');
        return;
    }
    vds2Typing = true;
    const { msg, type } = vds2Queue.shift();
    typeOnVds(DOM.status2, DOM.vds2, document.getElementById('vds2-cursor'), msg, type, 'status2', () => {
        clearTimeout(state.timers.status2);
        state.timers.status2 = setTimeout(() => {
            DOM.status2.textContent = '';
            DOM.status2.className = '';
            DOM.status2.style.color = '';
            const cursor = document.getElementById('vds2-cursor');
            if (cursor) cursor.classList.add('hidden');
            processVds2Queue();
        }, vds2Queue.length > 0 ? 800 : 2000);
    });
}

// ── Shared typewriter for either VDS screen ──
function typeOnVds(statusEl, containerEl, cursor, msg, type, timerKey, onComplete) {
    // Flash the container border
    if (containerEl) {
        containerEl.className = '';
        containerEl.classList.add(`flash-${type || 'hit'}`);
        setTimeout(() => containerEl.className = '', 150);
    }

    // Set colour: green for +value, red for -value, else type-based
    statusEl.textContent = '';
    statusEl.style.color = '';
    if (/\+\d/.test(msg)) {
        statusEl.className = '';
        statusEl.style.color = '#33ff33';
    } else if (/-\d/.test(msg)) {
        statusEl.className = '';
        statusEl.style.color = '#ff4444';
    } else {
        statusEl.className = type;
    }
    if (cursor) {
        cursor.classList.remove('hidden');
        if (type === 'miss' || type === 'misfire' || type === 'impact') {
            cursor.style.background = 'var(--color-danger, #ff4444)';
        } else if (type === 'bonus' || type === 'commendation') {
            cursor.style.background = 'var(--color-accent, #ffcc00)';
        } else {
            cursor.style.background = '#33ff33';
        }
    }

    let charIdx = 0;
    const speed = Math.max(15, Math.min(40, 600 / msg.length));

    function typeChar() {
        if (charIdx < msg.length) {
            statusEl.textContent = msg.substring(0, charIdx + 1);
            charIdx++;
            setTimeout(typeChar, speed);
        } else {
            if (cursor) {
                setTimeout(() => cursor.classList.add('hidden'), 300);
            }
            if (onComplete) onComplete();
        }
    }
    typeChar();
}

// Flash score red briefly on any penalty (even if total is still positive)
function flashScorePenalty() {
    DOM.score.classList.add('score-penalty-flash');
    clearTimeout(state.timers.penaltyFlash);
    state.timers.penaltyFlash = setTimeout(() => {
        DOM.score.classList.remove('score-penalty-flash');
    }, 600);
}

function updateHUD() {
    DOM.score.textContent = state.score.toLocaleString();
    DOM.streak.textContent = state.streak;

    // Score can never go below 0 (score floor rule)
    DOM.score.classList.remove('score-negative');

    const filled = Math.max(0, state.shieldHP);
    DOM.shields.textContent = '█'.repeat(filled) + '░'.repeat(9 - filled);

    DOM.shields.className = '';
    if (state.shieldHP > 6) DOM.shields.classList.add('shield-100');
    else if (state.shieldHP > 3) DOM.shields.classList.add('shield-50');
    else if (state.shieldHP > 0) DOM.shields.classList.add('shield-25');
    else DOM.shields.classList.add('critical');

    updateDiamonds();

    const tierData = TIERS[state.tier];
    if (DOM.tier) DOM.tier.textContent = tierData ? tierData.label : state.tier.toUpperCase();

    // Multiplier is tracked internally but NOT displayed in the score VDS
    // (score already reflects bonuses; showing multiplier is redundant)
}

// ── Diamond hit indicators ────────────────────────────────────────────────────
// 3 diamonds = 3 shield layers (3 HP each, 9-max).
// Top diamond (3) = HP 7-9, Middle (2) = HP 4-6, Bottom (1) = HP 1-3.
function updateDiamonds() {
    const d1 = document.getElementById('diamond-1');
    const d2 = document.getElementById('diamond-2');
    const d3 = document.getElementById('diamond-3');
    if (!d1 || !d2 || !d3) return;

    const colorClass = state.shieldHP > 6 ? 'shield-100'
                     : state.shieldHP > 3 ? 'shield-50'
                     : state.shieldHP > 0 ? 'shield-25'
                     :                      'critical';

    [d1, d2, d3].forEach(d => { d.className = 'diamond ' + colorClass; });
    if (state.shieldHP <= 6) d3.classList.add('diamond-dim');
    if (state.shieldHP <= 3) d2.classList.add('diamond-dim');
    if (state.shieldHP <= 0) d1.classList.add('diamond-dim');
}

// ── Aircraft warning light positioning ───────────────────────────────────────
// Convert fixed virtual coords to pixel offsets inside #canvas-wrapper.
function updateLightPositions() {
    const skylonLight = document.getElementById('skylon-light');
    const canalLight  = document.getElementById('canal-light');

    const s = COORD_SYSTEM.width / 5;   // 320
    const h = COORD_SYSTEM.height;      // 900

    // Skylon: x = s*1.5 + 2% width nudge right for asymmetrical antenna
    if (skylonLight) {
        skylonLight.style.left = ((s * 1.5 + (111 * 0.02)) * canvasScaleX) + 'px';
        skylonLight.style.top  = (((h - 80) - 131 + 131 * 0.04) * canvasScaleY) + 'px';
    }

    // Canal: bind to sprite rendering geometry — right tower roof peak
    if (canalLight) {
        const canalW  = 118;
        const canalH  = 111;
        const canalSx = (s * 3.5) - (canalW / 2); // Left edge of sprite
        const canalSy = (h - 70) - canalH;         // Top edge of sprite

        // X = 86% of width (center of right tower roof)
        // Y = 2% of height (apex of the roof)
        canalLight.style.left = ((canalSx + canalW * 0.86) * canvasScaleX) + 'px';
        canalLight.style.top  = ((canalSy + canalH * 0.02) * canvasScaleY) + 'px';
    }
}

function checkRegen() {
    // Shield never regenerates — only the tower can be repaired (by ambulance)
}

function checkTier() {
    // If holodeck tier override is active, lock to that tier
    if (godMode.overrideTier && TIERS[godMode.overrideTier]) {
        if (state.tier !== godMode.overrideTier) {
            setTier(godMode.overrideTier);
            updateHUD();
        }
        return;
    }
    const newTierKey = getTierForScore(state.score);
    if (!newTierKey || newTierKey === state.tier) return;

    const oldTier = state.tier;
    const data = TIERS[newTierKey];

    // Apply tier settings via setTier() (bridges config.js ↔ progression.csv)
    setTier(newTierKey);

    // Reset calibration accumulator for new rank
    state.lastCalibrationAt = state.score;

    // Determine if promotion or demotion
    const oldData = TIERS[oldTier];
    if (oldData && data.min < oldData.min) {
        showStatus(`DEMOTED: ${data.label || newTierKey.toUpperCase()}`, "impact");
    } else {
        // Rank-Up Bonus: 2× new rank's Base Hit (promotion only)
        const rankUpBonus = data.baseHit * SCORING.rankUpMult;
        applyScore(rankUpBonus);
        showStatus(`RANK UP! +${rankUpBonus} — ${data.label || newTierKey.toUpperCase()}`, "bonus");
    }
    updateHUD();
}

// ============================================
// AMBULANCE
// ============================================

function startAmbulance() {
    // If a previous ambulance is still on screen (departing), remove it
    if (state.ambulance) {
        state.ambulance = null;
        state.rebuilding = false;
        state.beamActive = false;
    }
    state.towerDisabled = true;
    state.rebuilding = true;
    state.repairCount++;

    const tower = getTower();
    const hoverY = tower.y - 200;
    state.ambulance = {
        x: -100, y: 350,
        vx: 0, vy: 0,
        targetX: tower.x, targetY: hoverY,
        phase: 'incoming',
        phaseStartTime: Date.now()
    };
    showStatus("REPAIR UNIT DISPATCHED", "impact");
}

function updateAmbulance(dt) {
    if (!state.ambulance) return;

    const amb = state.ambulance;
    const tower = getTower();
    const penalty = 1 + (state.repairCount - 1) * 0.5;
    const beamTime = CONFIG.beamDuration * penalty;

    // --- Steering constants ---
    const maxSpeed = 500;
    const seekForce = 3.5;      // how hard it steers toward target
    const damping = 0.92;       // velocity damping per frame
    const arrivalRadius = 12;   // snap-to-target distance

    if (amb.phase === 'incoming') {
        // Seek toward hover point above tower
        const dx = amb.targetX - amb.x;
        const dy = amb.targetY - amb.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        amb.vx += (dx / (dist || 1)) * seekForce * maxSpeed * dt;
        amb.vy += (dy / (dist || 1)) * seekForce * maxSpeed * dt;

        // Asteroid evasion
        applyAsteroidRepulsion(amb, dt);

        // Damping
        amb.vx *= damping;
        amb.vy *= damping;

        // Clamp speed
        const spd = Math.sqrt(amb.vx * amb.vx + amb.vy * amb.vy);
        if (spd > maxSpeed) { amb.vx = (amb.vx / spd) * maxSpeed; amb.vy = (amb.vy / spd) * maxSpeed; }

        amb.x += amb.vx * dt;
        amb.y += amb.vy * dt;

        if (dist < arrivalRadius) {
            amb.x = amb.targetX;
            amb.y = amb.targetY;
            amb.vx = 0; amb.vy = 0;
            amb.phase = 'repairing';
            amb.phaseStartTime = Date.now();
            state.beamActive = true;
            state.beamTimer = 0;
        }
    } else if (amb.phase === 'repairing') {
        // Hold position
        amb.vx = 0; amb.vy = 0;
        state.beamTimer += dt * 1000;
        if (state.beamTimer >= beamTime) {
            state.beamActive = false;
            amb.phase = 'departing';
            amb.phaseStartTime = Date.now();
            amb.targetX = COORD_SYSTEM.width + 150;
            amb.targetY = 350;
            rebuildTower();
        }
    } else if (amb.phase === 'departing') {
        // Seek toward exit point
        const dx = amb.targetX - amb.x;
        const dy = amb.targetY - amb.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        amb.vx += (dx / (dist || 1)) * seekForce * maxSpeed * dt;
        amb.vy += (dy / (dist || 1)) * seekForce * maxSpeed * dt;

        // Asteroid evasion
        applyAsteroidRepulsion(amb, dt);

        // Damping
        amb.vx *= damping;
        amb.vy *= damping;

        // Clamp speed
        const spd = Math.sqrt(amb.vx * amb.vx + amb.vy * amb.vy);
        if (spd > maxSpeed) { amb.vx = (amb.vx / spd) * maxSpeed; amb.vy = (amb.vy / spd) * maxSpeed; }

        amb.x += amb.vx * dt;
        amb.y += amb.vy * dt;

        if (amb.x > COORD_SYSTEM.width + 100) {
            state.ambulance = null;
            state.rebuilding = false;
            showStatus("TOWER ONLINE — SHIELDS OFFLINE", "hit");
        }
    }
}

// --- Asteroid Repulsion (Evasive Maneuvers) ---
function applyAsteroidRepulsion(amb, dt) {
    const repulsionRadius = 180;
    const repulsionStrength = 800;

    for (const asteroid of state.asteroids) {
        const dx = amb.x - asteroid.x;
        const dy = amb.y - asteroid.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < repulsionRadius && dist > 0) {
            const force = repulsionStrength * (1 - dist / repulsionRadius);
            amb.vx += (dx / dist) * force * dt * 0.3;
            amb.vy += (dy / dist) * force * dt;
        }
    }
}

function rebuildTower() {
    state.towerDisabled = false;
    const tower = getTower();
    if (tower) { tower.hp = 100; tower.destroyed = false; }
    // Radio tower restored — music comes through loud and clear
    AudioManager.disableMusicStatic();
    updateHUD();
}

// ============================================
// HOLODECK (Permanent Grid with Flash)
// ============================================

function triggerHolodeck(isBeta = false) {
    CONFIG.isHolodeck = true;
    CONFIG.isBeta = isBeta;
    AudioManager.setMode('holodeck');

    const grid = document.getElementById('holodeck-grid');
    const status = document.getElementById('simulation-status');

    if (grid) { 
        // Phase 1: Bright striking yellow flash (instant on)
        grid.style.transition = 'none';
        grid.classList.remove('grid-watermark');
        grid.classList.add('grid-flash');
        
        // Force reflow to ensure the flash is visible
        grid.offsetHeight;
        
        // Phase 2: Hold the bright yellow for 3 seconds, then slow dissolve to dull grey
        setTimeout(() => {
            // Set up the slow 5-second dissolve transition
            grid.style.transition = 'opacity 5s cubic-bezier(0.4, 0, 0.2, 1), filter 4s ease-out, background-image 5s ease-out';
            grid.classList.remove('grid-flash');
            grid.classList.add('grid-watermark');
        }, 3000); // Hold bright yellow for 3 seconds
    }
    
    if (status) {
        status.textContent = "MODE: HOLODECK";
        status.classList.add('visible');
    }

    isBeta ? showBeta() : hideBeta();
}

function clearHolodeck() {
    AudioManager.setMode('standard');
    const grid = document.getElementById('holodeck-grid');
    const status = document.getElementById('simulation-status');
    if (grid) {
        grid.style.transition = 'opacity 0.5s ease';
        grid.classList.remove('grid-flash', 'grid-watermark');
    }
    if (status) { status.classList.remove('visible'); status.textContent = ''; }
}

function enterHolodeckMenu() {
    // Ensure title prompt is hidden and menu is in "dismissed" state
    const titlePrompt = document.getElementById('title-press-prompt');
    if (titlePrompt) titlePrompt.classList.add('hidden');

    document.getElementById('normal-menu-buttons').classList.add('hidden');
    DOM.startOverlay.classList.remove('main-menu-bg');
    DOM.startOverlay.classList.add('holodeck-menu-active');

    // Timestamp so holodeck-btn ignores clicks within 300ms (Enter keyup guard)
    state._holodeckMenuShownAt = Date.now();

    // Delay showing holodeck buttons until next frame so the Enter keyup
    // from password submission doesn't immediately activate ENTER HOLODECK
    requestAnimationFrame(() => {
        document.getElementById('holodeck-menu-buttons').classList.remove('hidden');
        buildGodModeMenu();
    });
}

function exitHolodeckMenu() {
    state.holodeckUnlocked = false;
    document.getElementById('holodeck-menu-buttons').classList.add('hidden');
    document.getElementById('normal-menu-buttons').classList.remove('hidden');
    document.getElementById('god-mode-menu').classList.add('hidden');
    DOM.startOverlay.classList.remove('holodeck-menu-active');
    DOM.startOverlay.classList.add('main-menu-bg');
    // Clear dynamic content from god mode menu
    const colToggles = document.getElementById('gm-col-toggles');
    const colData = document.getElementById('gm-col-data');
    if (colToggles) colToggles.innerHTML = '';
    if (colData) colData.innerHTML = '';
}

function buildGodModeMenu() {
    const menu = document.getElementById('god-mode-menu');
    if (!menu) return;

    // Clear previous dynamic content from both columns
    const colToggles = document.getElementById('gm-col-toggles');
    const colData = document.getElementById('gm-col-data');
    if (!colToggles || !colData) return;
    colToggles.innerHTML = '';
    colData.innerHTML = '';

    // Initialize active pools from defaults if not yet set
    const COMMAND_CODES = ['AP', 'ENP', 'BSE', 'LA'];
    if (!godMode.activeCommands) godMode.activeCommands = new Set(COMMAND_CODES);
    if (!godMode.activeUnits) godMode.activeUnits = new Set(DATA_UNITS_SAMPLE.map(u => u.id));
    if (!godMode.activeBases) godMode.activeBases = new Set(DATA_LOCATIONS_SAMPLE.map(l => l.m));
    // All defense zones targetable by default (ids: 1, 2, 'tower', 3, 4)
    const ALL_ZONE_IDS = [1, 2, 'tower', 3, 4];
    if (!godMode.targetableZones) godMode.targetableZones = new Set(ALL_ZONE_IDS);

    // ── Toggle rows ──
    const toggles = [
        { key: 'clickToDestroy',  label: 'TARGETED ASTEROID FIRE', hint: 'Left Click on Asteroid' },
        { key: 'godModeKill',     label: 'TOWER DESTROYED OVERRIDE', hint: 'Left Click on Asteroid' },
        { key: 'destroyZones',    label: 'DESTROY BASE', hint: 'Double Left Click on Base' },
        { key: 'redirectAsteroid', label: 'REDIRECT ASTEROID', hint: 'Right Click Asteroid, Right Click Target Zone' },
        { key: null, label: 'MANUAL COMMAND ENTRY', hint: 'Type command and press Enter' }
    ];

    toggles.forEach(t => {
        const row = document.createElement('div');
        row.className = 'gm-row';

        const textCol = document.createElement('div');
        textCol.className = 'gm-text';

        const label = document.createElement('div');
        label.className = 'gm-label';
        label.textContent = t.label;
        textCol.appendChild(label);

        if (t.hint) {
            const hint = document.createElement('div');
            hint.className = 'gm-hint';
            hint.textContent = t.hint;
            textCol.appendChild(hint);
        }

        row.appendChild(textCol);

        // Info-only rows (no toggle key) show an "ALWAYS ON" badge
        if (t.key === null) {
            const badge = document.createElement('span');
            badge.className = 'gm-badge-always';
            badge.textContent = 'ALWAYS ON';
            row.appendChild(badge);
        } else {
            const btn = document.createElement('button');
            btn.className = 'gm-toggle' + (godMode[t.key] ? ' gm-on' : ' gm-off');
            btn.textContent = godMode[t.key] ? 'ON' : 'OFF';
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                godMode[t.key] = !godMode[t.key];
                btn.textContent = godMode[t.key] ? 'ON' : 'OFF';
                btn.className = 'gm-toggle' + (godMode[t.key] ? ' gm-on' : ' gm-off');
            });
            row.appendChild(btn);
        }

        colToggles.appendChild(row);
    });

    // ── Rank Override Selector ──
    const tierRow = document.createElement('div');
    tierRow.className = 'gm-row';
    const tierText = document.createElement('div');
    tierText.className = 'gm-text';
    const tierLabel = document.createElement('div');
    tierLabel.className = 'gm-label';
    tierLabel.textContent = 'RANK OVERRIDE';
    tierText.appendChild(tierLabel);
    const tierHint = document.createElement('div');
    tierHint.className = 'gm-hint';
    tierHint.textContent = 'Lock rank — bypasses score progression';
    tierText.appendChild(tierHint);
    tierRow.appendChild(tierText);

    const tierSelect = document.createElement('select');
    tierSelect.className = 'gm-select';
    const autoOpt = document.createElement('option');
    autoOpt.value = '';
    autoOpt.textContent = 'AUTO';
    if (!godMode.overrideTier) autoOpt.selected = true;
    tierSelect.appendChild(autoOpt);
    Object.entries(TIERS).forEach(([key, data]) => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = data.label;
        if (godMode.overrideTier === key) opt.selected = true;
        tierSelect.appendChild(opt);
    });
    tierSelect.addEventListener('change', () => {
        godMode.overrideTier = tierSelect.value || null;
        if (state.running && godMode.overrideTier) {
            setTier(godMode.overrideTier);
            state.tier = godMode.overrideTier;
            updateHUD();
        }
    });
    tierRow.appendChild(tierSelect);
    colToggles.appendChild(tierRow);

    // ── Helper: build an expandable checklist section ──
    function buildExpandableSection(title, allItems, activeSet, getKey, getLabel) {
        const section = document.createElement('div');
        section.className = 'gm-section';

        // Header row with expand/collapse toggle
        const headerRow = document.createElement('div');
        headerRow.className = 'gm-section-header';

        const countSpan = document.createElement('span');
        countSpan.className = 'gm-section-count';
        const updateCount = () => {
            countSpan.textContent = `${activeSet.size} / ${allItems.length}`;
        };
        updateCount();

        const titleSpan = document.createElement('span');
        titleSpan.className = 'gm-section-title';
        titleSpan.textContent = title;

        const arrow = document.createElement('span');
        arrow.className = 'gm-section-arrow';
        arrow.textContent = '\u25B6'; // ▶

        headerRow.appendChild(arrow);
        headerRow.appendChild(titleSpan);
        headerRow.appendChild(countSpan);

        const body = document.createElement('div');
        body.className = 'gm-section-body collapsed';

        headerRow.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = !body.classList.contains('collapsed');
            body.classList.toggle('collapsed');
            arrow.textContent = isOpen ? '\u25B6' : '\u25BC'; // ▶ or ▼
        });

        // Build checklist items
        allItems.forEach(item => {
            const key = getKey(item);
            const label = getLabel(item);

            const itemRow = document.createElement('div');
            itemRow.className = 'gm-check-row';

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'gm-checkbox';
            cb.checked = activeSet.has(key);

            const itemLabel = document.createElement('span');
            itemLabel.className = 'gm-check-label';
            itemLabel.textContent = label;

            cb.addEventListener('change', (e) => {
                e.stopPropagation();
                if (cb.checked) {
                    activeSet.add(key);
                } else {
                    activeSet.delete(key);
                }
                updateCount();
            });

            itemRow.appendChild(cb);
            itemRow.appendChild(itemLabel);
            body.appendChild(itemRow);
        });

        section.appendChild(headerRow);
        section.appendChild(body);
        return section;
    }

    // ── 1. Commands Section ──
    const commandItems = COMMAND_CODES.map(code => ({
        code,
        label: code === 'AP' ? 'AP — Assign/Post' :
               code === 'ENP' ? 'ENP — Enroute' :
               code === 'BSE' ? 'BSE — Base/Arriving' :
               'LA — Local Area'
    }));
    colData.appendChild(buildExpandableSection(
        'COMMANDS', commandItems, godMode.activeCommands,
        item => item.code, item => item.label
    ));

    // ── 2. Units Section ──
    const unitItems = DATA_UNITS_FULL.map(u => ({ id: u.id }));
    colData.appendChild(buildExpandableSection(
        'UNITS', unitItems, godMode.activeUnits,
        item => item.id, item => item.id
    ));

    // ── 3. Bases Section ──
    const baseItems = DATA_LOCATIONS_FULL.map(l => ({ code: l.m, name: l.c }));
    colData.appendChild(buildExpandableSection(
        'BASES', baseItems, godMode.activeBases,
        item => item.code, item => `${item.code} — ${item.name}`
    ));

    // ── 4. Targetable Zones Section ──
    const ZONE_NAMES = { 1: 'NOTL — Sir Adam Beck', 2: 'NIAGARA FALLS — Skylon Tower', 'tower': 'RADIO TOWER', 3: 'THOROLD — Welland Canal', 4: 'PORT COLBORNE — Robin Hood' };
    const zoneItems = ALL_ZONE_IDS.map(id => ({ id, name: ZONE_NAMES[id] }));
    colData.appendChild(buildExpandableSection(
        'TARGETABLE BASES', zoneItems, godMode.targetableZones,
        item => item.id, item => item.name
    ));

    // Show the menu
    menu.classList.remove('hidden');
}

function showBeta() {
    if (document.getElementById('beta-indicator')) return;
    const el = document.createElement('div');
    el.id = 'beta-indicator';
    el.textContent = 'BETA MODE';
    document.getElementById('canvas-wrapper').appendChild(el);
}

function hideBeta() {
    document.getElementById('beta-indicator')?.remove();
}

// ============================================
// ASTEROID COLOR HELPER
// ============================================

function getAsteroidColors(asteroid) {
    // Get colors based on sprite index, with fallback
    return ASTEROID_COLORS[asteroid.spriteIndex] || ASTEROID_COLORS[0];
}

// ============================================
// TETHER PHYSICS (Energy Flow System)
// ============================================

function updateUIPhysics() {
    const svgLayer = document.getElementById('tether-layer');
    if (!svgLayer) return;
    
    svgLayer.innerHTML = '';
    
    // Use Date.now() for smooth, frame-rate-independent energy flow
    const time = Date.now() / TETHER.energyFlowSpeed;

    const asteroids = state.asteroids;
    if (!asteroids.length) return;

    // Spring physics: pull boxes toward their asteroids
    asteroids.forEach(asteroid => {
        const box = asteroid.challengeBox;
        if (!box) return;
        
        const targetX = asteroid.x;
        const targetY = asteroid.y - asteroid.radius - TETHER.hoverOffset;
        
        box.vx += (targetX - box.x) * TETHER.springConstant;
        box.vy += (targetY - box.y) * TETHER.springConstant;
    });

    // Box-to-box repulsion (prevent overlap — 20px clearance so labels never touch)
    const pad = 20;
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
                    boxA.vx += (overlapX * 0.5) * TETHER.repulsionForce * dir;
                    boxB.vx -= (overlapX * 0.5) * TETHER.repulsionForce * dir;
                } else {
                    const dir = dy > 0 ? 1 : -1;
                    boxA.vy += (overlapY * 0.5) * TETHER.repulsionForce * dir;
                    boxB.vy -= (overlapY * 0.5) * TETHER.repulsionForce * dir;
                }
            }
        }
    }

    // Box-to-Asteroid repulsion (prevent boxes from overlapping ANY asteroid including own parent)
    for (let i = 0; i < asteroids.length; i++) {
        const box = asteroids[i].challengeBox;
        if (!box || !box.width) continue;

        for (let j = 0; j < asteroids.length; j++) {
            const rock = asteroids[j];
            const rockR = rock.radius + 8; // Padding to clear the glow edge

            const boxCenterY = box.y + (box.height / 2);

            const dx = box.x - rock.x;
            const dy = boxCenterY - rock.y;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            const minDx = (box.width / 2) + rockR;
            const minDy = (box.height / 2) + rockR;

            if (absDx < minDx && absDy < minDy) {
                const overlapX = minDx - absDx;
                const overlapY = minDy - absDy;
                // Stronger repulsion for own parent to prevent overlap
                const force = (i === j) ? TETHER.repulsionForce * 2 : TETHER.repulsionForce;

                if (overlapX < overlapY) {
                    const dir = dx > 0 ? 1 : -1;
                    box.vx += (overlapX * 0.5) * force * dir;
                } else {
                    const dir = dy > 0 ? 1 : -1;
                    box.vy += (overlapY * 0.5) * force * dir;
                }
            }
        }
    }

    // Apply velocity and clamp to bounds
    asteroids.forEach(asteroid => {
        const box = asteroid.challengeBox;
        if (!box) return;
        
        box.vx *= TETHER.friction;
        box.vy *= TETHER.friction;
        box.x += box.vx;
        box.y += box.vy;
        
        if (box.x < 10) box.x = 10;
        if (box.x > COORD_SYSTEM.width - 10) box.x = COORD_SYSTEM.width - 10;
        if (box.y < 10) box.y = 10;
        
        // Calculate stretch distance for tether visibility
        const targetX = asteroid.x;
        const stretchDist = Math.sqrt(
            Math.pow(targetX - box.x, 2) + 
            Math.pow((asteroid.y - asteroid.radius) - box.y, 2)
        );
        
        // Draw energy tether if stretched beyond threshold
        if (stretchDist > TETHER.tetherVisibleDistance) {
            const colors = getAsteroidColors(asteroid);
            
            // Create SVG gradient for energy flow effect
            const gradientId = `tether-grad-${asteroid.id}`;
            const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
            const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
            gradient.setAttribute("id", gradientId);
            gradient.setAttribute("x1", "0%");
            gradient.setAttribute("y1", "0%");
            gradient.setAttribute("x2", "100%");
            gradient.setAttribute("y2", "100%");
            
            const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
            stop1.setAttribute("offset", "0%");
            stop1.setAttribute("stop-color", colors.glow);
            stop1.setAttribute("stop-opacity", "0.9");
            
            const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
            stop2.setAttribute("offset", "100%");
            stop2.setAttribute("stop-color", colors.accent);
            stop2.setAttribute("stop-opacity", "0.6");
            
            gradient.appendChild(stop1);
            gradient.appendChild(stop2);
            defs.appendChild(gradient);
            svgLayer.appendChild(defs);
            
            // Energy beam line with animated dash (flowing energy effect)
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", targetX);
            line.setAttribute("y1", asteroid.y - asteroid.radius);
            line.setAttribute("x2", box.x);
            line.setAttribute("y2", box.y + box.height / 2);
            line.setAttribute("stroke", `url(#${gradientId})`);
            line.setAttribute("stroke-width", "2.5");
            line.setAttribute("stroke-dasharray", "8, 6");
            // Animate the dash offset to create flowing energy effect
            line.setAttribute("stroke-dashoffset", time % 14);
            line.setAttribute("filter", `drop-shadow(0 0 4px ${colors.glow})`);
            line.classList.add('tether-line');
            svgLayer.appendChild(line);
            
            // Secondary glow line (wider, more transparent)
            const glowLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            glowLine.setAttribute("x1", targetX);
            glowLine.setAttribute("y1", asteroid.y - asteroid.radius);
            glowLine.setAttribute("x2", box.x);
            glowLine.setAttribute("y2", box.y + box.height / 2);
            glowLine.setAttribute("stroke", colors.glow);
            glowLine.setAttribute("stroke-width", "6");
            glowLine.setAttribute("stroke-opacity", "0.15");
            glowLine.setAttribute("stroke-linecap", "round");
            svgLayer.insertBefore(glowLine, svgLayer.firstChild);
        }
    });
}

// ============================================
// AFTERMATH VFX ENGINE
// ============================================

function updateAftermathVFX(dt) {
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

        // Skylon (Fire) & Welland Canal (Fire/Smoke) — fire shrinks over 30 seconds, then smolders
        if (zone.id === 2 || zone.id === 3) {
            const FIRE_FADE_DURATION = 30000; // 30 seconds (slower fade)
            const elapsed = zone.destroyedAt ? Date.now() - zone.destroyedAt : 0;
            const fireScale = Math.max(0, 1 - elapsed / FIRE_FADE_DURATION);

            if (fireScale > 0 && Math.random() < 0.6 * fireScale) {
                const numParticles = Math.max(1, Math.round(2 * fireScale));
                for (let k = 0; k < numParticles; k++) {
                    const isSmoke = zone.id === 3 && Math.random() > 0.7;
                    const fColor = isSmoke ? `rgba(40,40,40,0.6)` : fireColors[Math.floor(Math.random() * fireColors.length)];
                    state.environmentalParticles.push({
                        x: zone.x + (Math.random() - 0.5) * (zone.w * 0.3 * fireScale),
                        y: zone.y - (10 + Math.random() * 15) * fireScale,
                        vx: (Math.random() - 0.5) * 0.5 * fireScale,
                        vy: (-1.5 - Math.random() * 2) * fireScale,
                        radius: (8 + Math.random() * 12) * fireScale,
                        color: fColor,
                        life: 1.0 * fireScale, decay: 0.015 + Math.random() * 0.010, type: 'fire'
                    });
                }
            }

            // Persistent smoldering effect after main fire dies down
            if (fireScale <= 0 && Math.random() < 0.08) {
                const isEmber = Math.random() > 0.4;
                state.environmentalParticles.push({
                    x: zone.x + (Math.random() - 0.5) * (zone.w * 0.15),
                    y: zone.y - (5 + Math.random() * 8),
                    vx: (Math.random() - 0.5) * 0.2,
                    vy: -0.3 - Math.random() * 0.6,
                    radius: isEmber ? (2 + Math.random() * 4) : (4 + Math.random() * 8),
                    color: isEmber ? 'rgba(255, 80, 0, 0.6)' : 'rgba(60, 60, 60, 0.4)',
                    life: 0.8, decay: 0.012 + Math.random() * 0.008, type: 'fire'
                });
            }
        }
        
        // Sir Adam Beck (id === 1) — Zapped Hydro Workers
        if (zone.id === 1 && zone.destroyed) {
            // Spawn up to 2 workers, low rate (~0.5% per frame)
            // Stagger spawns: 0.3% per frame + minimum 3s gap between workers
            const lastSpawn = state.beckWorkers.length > 0
                ? Math.max(...state.beckWorkers.map(w => w.spawnTime || 0)) : 0;
            if (state.beckWorkers.length < 5 && Math.random() < 0.003
                && Date.now() - lastSpawn > 3000) {
                const beckZone = zone;
                // Tower zone X range (where sparks are)
                const towerMidX = beckZone.x + beckZone.w * 0.37;
                // Spawn off to the right, walking left toward towers
                const spawnX = beckZone.x + beckZone.w * 0.55 + Math.random() * 30;
                const floorY = COORD_SYSTEM.height - 75;
                state.beckWorkers.push({
                    x: spawnX,
                    y: floorY,
                    vx: 0,
                    vy: 0,
                    phase: 'walking',     // walking → zapped → flying → landed → recovering → returning → zapped...
                    timer: 0,
                    targetX: towerMidX,   // walk toward tower zone
                    startX: spawnX,       // remember spawn point
                    direction: -1,        // walking left toward plant
                    zapFlash: 0,
                    floorY: floorY,
                    spawnTime: Date.now()
                });
            }
        }

        // Skylon Tower (id === 2) — Malfunctioning Bug Ejector
        if (zone.id === 2 && zone.destroyed) {
            // 2% chance per frame to pop a bug (~1 per second)
            if (Math.random() < 0.02) {
                state.skylonBugs.push({
                    x: zone.x + (Math.random() - 0.5) * 40,
                    y: zone.y - 20,
                    vx: -3 + Math.random() * 6,
                    vy: -5 - Math.random() * 6,
                    rotation: Math.random() * Math.PI * 2,
                    rotSpeed: -0.2 + Math.random() * 0.4,
                    settled: false
                });
            }
        }

        // Welland Canal (id === 3) — Abandon Ship! Crash freighter + life rafts
        if (zone.id === 3 && zone.destroyed) {
            const c = state.canal;
            const elapsed = zone.destroyedAt ? Date.now() - zone.destroyedAt : 0;
            // Wait for fire to burn out (30s) before crash freighter approaches
            if (c.crashPhase === 'none' && elapsed >= 15000) {
                c.crashPhase = 'approaching';
                c.crashShipType = FREIGHTER_ALL_KEYS[Math.floor(Math.random() * FREIGHTER_ALL_KEYS.length)];
                const horizonY = (zone.y - zone.h) + (zone.h * 0.554);
                c.crashShipY = horizonY;
                c.crashShipScale = 1.0;
                c.crashShipTilt = 0;
            }
            // Fire sparks around crashed freighter — structural fire effect
            if (c.crashPhase === 'crashed' && Math.random() < 0.15) {
                const deckY = (zone.y - zone.h) + (zone.h * 0.554);
                state.environmentalParticles.push({
                    x: zone.x + (Math.random() - 0.5) * 180,
                    y: deckY + (Math.random() - 0.5) * 90 - 40,
                    vx: (Math.random() - 0.5) * 2,
                    vy: -1 - Math.random() * 3,
                    radius: 2 + Math.random() * 6,
                    color: Math.random() > 0.5
                        ? `rgba(255, 69, 0, ${0.6 + Math.random() * 0.4})`
                        : `rgba(255, 255, 0, ${0.5 + Math.random() * 0.5})`,
                    life: 1.0, decay: 0.04 + Math.random() * 0.04, type: 'fire'
                });
            }
            // Life rafts spawn AFTER crash — below bridge, drift DOWN the canal
            if (c.crashPhase === 'crashed' && Math.random() < 0.02) {
                // Spawn just below the bridge structure
                const spawnY = zone.y + 5;
                // Stay within canal water width (~30 units either side of center)
                const spawnX = zone.x + (Math.random() - 0.5) * 50;
                state.canalCrew.push({
                    x: spawnX,
                    baseX: spawnX,
                    y: spawnY,
                    vy: 8 + Math.random() * 6,         // drift downward (toward camera)
                    bobPhase: Math.random() * Math.PI * 2,
                    bobSpeed: 2 + Math.random() * 2,
                    flail: Math.random()
                });
            }
        }

        // Robin Hood Flour (Remains tightly controlled)
        if (zone.id === 4 && Math.random() < 0.12) {
            state.environmentalParticles.push({
                x: zone.x + (Math.random() - 0.5) * (zone.w * 0.6),
                y: zone.y - zone.h * 0.5 - Math.random() * (zone.h * 0.3),
                vx: -1 + Math.random() * 2,
                vy: -0.5 - Math.random() * 1.5,
                radius: 4 + Math.random() * 8,
                color: `rgba(255,255,255,0.4)`,
                life: 1.0, decay: 0.015 + Math.random() * 0.02, type: 'flour'
            });
        }

        // Robin Hood Flour (id === 4) — Scurrying Employees + Flour Snow
        if (zone.id === 4 && zone.destroyed) {
            // Stagger employee spawns: max 6, 0.3% per frame, 4s gap
            const lastFlourSpawn = state.flourWorkers.length > 0
                ? Math.max(...state.flourWorkers.map(fw => fw.spawnTime || 0)) : 0;
            if (state.flourWorkers.length < 6 && Math.random() < 0.003
                && Date.now() - lastFlourSpawn > 4000) {
                const floorY = COORD_SYSTEM.height - 78;
                const plantLeft = zone.x - zone.w / 2;
                const plantRight = zone.x + zone.w / 2;
                // Spawn inside the zone — workers stay within the mill area
                const spawnX = plantLeft + Math.random() * (plantRight - plantLeft);
                const targetX = plantLeft + Math.random() * (plantRight - plantLeft);
                state.flourWorkers.push({
                    x: spawnX, y: floorY, vx: 0,
                    phase: 'scurrying', timer: 0,
                    targetX: targetX,
                    plantLeft: plantLeft, plantRight: plantRight,
                    direction: targetX > spawnX ? 1 : -1,
                    flourCover: 0, floorY: floorY,
                    spawnTime: Date.now()
                });
            }

            // Flour ground snow patches — accumulate continuously, no cap
            if (Math.random() < 0.06) {
                // Regular flour dusting
                state.flourGround.push({
                    x: zone.x + (Math.random() - 0.5) * (zone.w * 1.1),
                    y: COORD_SYSTEM.height - 75 + Math.random() * 8,
                    radius: 3 + Math.random() * 5,
                    opacity: 0,
                    isBank: false
                });
            }
            // Snowbank buildup — larger mounds that grow over time at the base
            if (Math.random() < 0.015) {
                state.flourGround.push({
                    x: zone.x + (Math.random() - 0.5) * (zone.w * 0.8),
                    y: COORD_SYSTEM.height - 76 + Math.random() * 4,
                    radius: 8 + Math.random() * 12,
                    opacity: 0,
                    isBank: true
                });
            }

            // Water icing over — flour freezes the water surface
            const ice = state.flourIce;
            if (!ice.active) {
                ice.active = true;
                ice.progress = 0;
            }
            // Gradually increase ice coverage (0 → 1 over ~20 seconds)
            ice.progress = Math.min(1.0, ice.progress + 0.0008);

            // Spawn ice patches spreading outward from Robin Hood zone
            if (ice.patches.length < 200 && Math.random() < 0.03 + ice.progress * 0.05) {
                // Ice spreads along the water line, expanding outward from the zone
                const spread = ice.progress * 400; // how far the ice reaches from center
                const iceX = zone.x + (Math.random() - 0.5) * (zone.w + spread);
                const waterY = COORD_SYSTEM.height - 72;
                ice.patches.push({
                    x: iceX,
                    y: waterY + (Math.random() - 0.5) * 12,
                    w: 6 + Math.random() * 18,
                    h: 2 + Math.random() * 5,
                    opacity: 0,
                    maxOpacity: 0.3 + Math.random() * 0.4,
                    shimmer: Math.random() * Math.PI * 2
                });
            }

            // Fade in ice patches
            ice.patches.forEach(p => {
                p.opacity = Math.min(p.maxOpacity, p.opacity + 0.005);
            });

        }
    });

    // 2. Ambient Always-On Particles (Dam water discharge & flour mill smoke)
    state.defenses.forEach(zone => {
        // Robin Hood Flour (id: 4) — Single thin smoke line from mill chimney
        if (zone.id === 4 && !zone.destroyed && Math.random() < 0.08) {
            state.environmentalParticles.push({
                x: zone.x - zone.w * 0.15 + (Math.random() - 0.5) * 3,
                y: zone.y - zone.h,
                vx: (Math.random() - 0.5) * 0.15,
                vy: -0.5 - Math.random() * 0.5,
                radius: 3 + Math.random() * 3,
                color: `rgba(140,140,140,0.25)`,
                life: 1.0, decay: 0.015 + Math.random() * 0.01, type: 'smoke'
            });
        }
    });

    // 3. Update Particles (Crash Fix Applied)
    for (let i = state.environmentalParticles.length - 1; i >= 0; i--) {
        const p = state.environmentalParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        
        // Particles shrink as they cool down
        p.radius += (p.type === 'flour') ? 0.2 : -0.1; 
        p.life -= p.decay;
        
        // CRITICAL FIX: Destroy the particle before its radius goes negative and crashes the Canvas
        if (p.life <= 0 || p.radius <= 0) {
            state.environmentalParticles.splice(i, 1);
        }
    }

    // 4. Skylon Bug Physics (gravity + floor collision → permanent debris or float in gorge)
    const gorgeLeft = 440 - 50 * 0.8;  // fallsX - fallsWidth*0.8
    const gorgeRight = 440 + 50 * 0.8; // fallsX + fallsWidth*0.8
    const gorgeWaterY = COORD_SYSTEM.height - 20;
    for (let i = state.skylonBugs.length - 1; i >= 0; i--) {
        const bug = state.skylonBugs[i];
        if (bug.floating) {
            // Bug is floating on gorge water — drift left off-screen
            bug.x -= 15 * dt;
            bug.y = gorgeWaterY + Math.sin(Date.now() * 0.003 + bug.rotation) * 1.5; // gentle bob
            bug.rotation = Math.sin(Date.now() * 0.002 + i) * 0.15; // slight rock
            if (bug.x < -20) {
                state.skylonBugs.splice(i, 1); // remove when off-screen
            }
        } else if (!bug.settled) {
            bug.vy += 0.4; // Gravity
            bug.x += bug.vx;
            bug.y += bug.vy;
            bug.rotation += bug.rotSpeed;

            const floorY = COORD_SYSTEM.height - 80 + (Math.random() * 10);
            if (bug.y > floorY) {
                // Check if landing in the gorge water
                if (bug.x > gorgeLeft && bug.x < gorgeRight) {
                    bug.floating = true;
                    bug.y = gorgeWaterY;
                    bug.vy = 0;
                    bug.vx = 0;
                } else {
                    bug.y = floorY;
                    bug.settled = true;
                }
            }
        }
    }

    // 5. Canal Life Raft Physics (vertical drift down canal + horizontal bob)
    for (let i = state.canalCrew.length - 1; i >= 0; i--) {
        const raft = state.canalCrew[i];
        raft.y += raft.vy * dt;                                         // drift downward
        raft.bobPhase += raft.bobSpeed * dt;
        raft.x = raft.baseX + Math.sin(raft.bobPhase) * 3;            // gentle side-to-side bob

        // Remove when drifted off bottom of screen
        if (raft.y > COORD_SYSTEM.height + 30) {
            state.canalCrew.splice(i, 1);
        }
    }

    // 6. Beck Hydro Worker Physics (walk → zap → fly → land → rest → return → repeat)
    const walkSpeed = 18;
    for (let i = 0; i < state.beckWorkers.length; i++) {
        const w = state.beckWorkers[i];
        w.timer += dt;

        switch (w.phase) {
            case 'walking':
                w.x += walkSpeed * w.direction * dt;
                // Reached tower zone → get zapped
                if (Math.abs(w.x - w.targetX) < 5) {
                    w.phase = 'zapped';
                    w.timer = 0;
                    w.zapFlash = 1.0;
                }
                break;

            case 'zapped':
                // Freeze + shock effect for 0.3s
                w.zapFlash = 1.0;
                if (w.timer >= 0.3) {
                    w.phase = 'flying';
                    w.timer = 0;
                    // Tossed to the right only
                    w.vx = 2 + Math.random() * 5;
                    w.vy = -4 - Math.random() * 2;
                }
                break;

            case 'flying':
                w.vy += 0.4;  // gravity (same as Skylon bugs)
                w.x += w.vx;
                w.y += w.vy;
                w.zapFlash = Math.max(0, w.zapFlash - dt * 2); // fade shock effect

                if (w.y >= w.floorY) {
                    w.y = w.floorY;
                    w.phase = 'landed';
                    w.timer = 0;
                    w.vx = 0;
                    w.vy = 0;
                    w.startX = w.x; // remember landing spot
                    w.zapFlash = 0;
                }
                break;

            case 'landed':
                // Lie motionless for 3-4 seconds
                if (w.timer >= 3 + Math.random()) {
                    w.phase = 'recovering';
                    w.timer = 0;
                }
                break;

            case 'recovering':
                // Stand up over 0.5s
                if (w.timer >= 0.5) {
                    w.phase = 'returning';
                    w.timer = 0;
                    w.direction = w.targetX < w.x ? -1 : 1; // face the plant
                }
                break;

            case 'returning':
                w.x += walkSpeed * w.direction * dt;
                // Reached tower zone again → zapped again!
                if (Math.abs(w.x - w.targetX) < 5) {
                    w.phase = 'zapped';
                    w.timer = 0;
                    w.zapFlash = 1.0;
                }
                break;
        }
    }

    // 7. Flour Worker Physics (scurry back and forth, slowly turn white)
    const scurrySpeed = 12;
    for (let i = 0; i < state.flourWorkers.length; i++) {
        const fw = state.flourWorkers[i];
        fw.timer += dt;
        // Coat with flour over ~12 seconds (green → white → snowman)
        fw.flourCover = Math.min(1.0, fw.flourCover + 0.030 * dt);

        switch (fw.phase) {
            case 'scurrying':
                fw.x += scurrySpeed * fw.direction * dt;
                // Reached target → pause
                if (Math.abs(fw.x - fw.targetX) < 4) {
                    fw.phase = 'pausing';
                    fw.timer = 0;
                }
                break;

            case 'pausing':
                // Stand still 1-2 seconds, then pick new target
                if (fw.timer >= 1 + Math.random()) {
                    fw.phase = 'scurrying';
                    fw.timer = 0;
                    fw.targetX = fw.plantLeft + Math.random() * (fw.plantRight - fw.plantLeft);
                    fw.direction = fw.targetX > fw.x ? 1 : -1;
                }
                break;

        }

        // Clamp workers that aren't wandering to zone boundaries
        if (fw && fw.phase === 'scurrying') {
            fw.x = Math.max(fw.plantLeft, Math.min(fw.plantRight, fw.x));
        }
    }

    // 8. Flour Ground Snow — fade patches in, snowbanks build higher
    for (let i = 0; i < state.flourGround.length; i++) {
        const patch = state.flourGround[i];
        const maxOpacity = patch.isBank ? 0.85 : 0.65;
        if (patch.opacity < maxOpacity) {
            patch.opacity = Math.min(maxOpacity, patch.opacity + 0.02 * dt);
        }
        // Snowbanks slowly grow in size
        if (patch.isBank && patch.radius < 25) {
            patch.radius += 0.003 * dt;
        }
    }
}

function drawAftermathVFX(ctx) {
    // Draw ejected Skylon Bugs (behind smoke/fire, on top of ruins)
    const bugImg = ASSETS['Yellow_Bug'];
    if (bugImg?.complete && bugImg.naturalWidth > 0) {
        state.skylonBugs.forEach(bug => {
            ctx.save();
            ctx.translate(bug.x, bug.y);
            ctx.rotate(bug.rotation);
            ctx.drawImage(bugImg, -4.5, -9, 9, 18);
            ctx.restore();
        });
    }

    // Draw crash freighter (approaching or lodged in wreckage)
    const cc = state.canal;
    if (cc.crashPhase !== 'none' && cc.crashShipType) {
        const fleetGroup = Object.values(FREIGHTER_FLEET).find(g => g.files.includes(cc.crashShipType));
        const baseW = fleetGroup ? fleetGroup.w : 55;
        const baseH = fleetGroup ? fleetGroup.h : 65;
        const sizeMultiplier = 0.5;
        const shipW = baseW * cc.crashShipScale * sizeMultiplier;
        const shipH = baseH * cc.crashShipScale * sizeMultiplier;
        const bridge = state.defenses.find(d => d.isLiftBridge);
        const shipX = bridge ? bridge.x : COORD_SYSTEM.width * 0.7;

        const shipImg = FREIGHTER_SPRITES[cc.crashShipType];
        ctx.save();

        // Anchor at bottom (crashShipY) — expand upward and outward, not downward
        ctx.translate(shipX, cc.crashShipY);
        ctx.rotate(cc.crashShipTilt);

        // Hull glow — fire-orange when crashed, blue when approaching
        if (cc.crashPhase === 'crashed') {
            const pulse = (Math.sin(Date.now() / 150) + 1) / 2;
            ctx.shadowColor = `rgba(255, ${Math.round(69 + pulse * 186)}, 0, 0.7)`;
            ctx.shadowBlur = 15 + pulse * 10;
        } else {
            ctx.shadowColor = 'rgba(180, 220, 255, 0.6)';
            ctx.shadowBlur = 10 * cc.crashShipScale;
        }

        // Draw anchored at bottom — full height extends upward
        if (shipImg?.complete && shipImg.naturalWidth > 0) {
            ctx.drawImage(shipImg, -shipW / 2, -shipH, shipW, shipH);
        } else {
            ctx.fillStyle = '#881111';
            ctx.fillRect(-shipW / 2, -shipH, shipW, shipH);
        }

        ctx.restore();
    }

    // Draw canal life rafts drifting on water
    state.canalCrew.forEach(raft => {
        ctx.save();
        ctx.translate(raft.x, raft.y);

        // Slight tilt from bob motion
        const tilt = Math.sin(raft.bobPhase) * 0.08;
        ctx.rotate(tilt);

        // Raft body (orange/yellow inflatable)
        ctx.fillStyle = '#FF8800';
        const raftW = 12, raftH = 5;
        ctx.beginPath();
        ctx.ellipse(0, 0, raftW / 2, raftH / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Raft rim highlight
        ctx.strokeStyle = '#FFAA33';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(0, 0, raftW / 2, raftH / 2, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Crew figure 1 (sitting)
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-3, -5, 2.5, 3);        // torso
        ctx.beginPath();
        ctx.arc(-1.75, -6.5, 1.3, 0, Math.PI * 2); // head
        ctx.fill();

        // Crew figure 2 (waving for help)
        ctx.fillRect(1, -5, 2.5, 3);         // torso
        ctx.beginPath();
        ctx.arc(2.25, -6.5, 1.3, 0, Math.PI * 2); // head
        ctx.fill();

        // Waving arm on figure 2
        const armWave = Math.sin(Date.now() / 150 + raft.flail * 100) * 0.6;
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(3.5, -4.5);
        ctx.lineTo(5.5, -7.5 + armWave * 3);
        ctx.stroke();

        ctx.restore();
    });

    // Draw Beck hydro workers (walk, zap, fly, lie down, repeat)
    state.beckWorkers.forEach(w => {
        ctx.save();
        ctx.translate(w.x, w.y);

        const isLying = (w.phase === 'landed');
        const isFlying = (w.phase === 'flying');

        // Shock star effect when zapped/flying — flickering 6-pointed star
        const shocked = w.zapFlash > 0;
        // Flicker between two modes rapidly (~100ms toggle)
        const flickerMode = Math.floor(Date.now() / 100) % 2 === 0;

        if (shocked) {
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 12 * w.zapFlash;

            // Draw randomized 6-pointed star (large enough to contain worker)
            const starCenterY = -8; // center on worker torso
            const outerR = 22 + Math.random() * 4;  // outer spike tips
            const innerR = 10 + Math.random() * 2;   // inner notches
            const points = 6;
            const rotOffset = Math.random() * 0.3;    // slight random rotation each frame

            // Mode A: yellow border, black fill | Mode B: black border, yellow fill
            ctx.fillStyle = flickerMode ? '#000000' : '#FFE800';
            ctx.strokeStyle = flickerMode ? '#FFE800' : '#000000';
            ctx.lineWidth = 2.5;

            ctx.beginPath();
            for (let i = 0; i < points * 2; i++) {
                const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2 + rotOffset;
                const r = (i % 2 === 0) ? outerR : innerR;
                const px = Math.cos(angle) * r;
                const py = Math.sin(angle) * r + starCenterY;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        if (isLying) {
            // Lying on ground — draw horizontally
            ctx.rotate(Math.PI / 2);
        }

        // Flip direction
        if (w.direction > 0 && !isLying) {
            ctx.scale(-1, 1);
        }

        // Worker colors change with shock flicker
        const hatColor = shocked ? (flickerMode ? '#FFE800' : '#000000') : '#FFD700';
        const headColor = shocked ? (flickerMode ? '#FFE800' : '#000000') : '#D2946B';
        const vestColor = shocked ? (flickerMode ? '#FFE800' : '#000000') : '#FF6600';
        const pantsColor = shocked ? (flickerMode ? '#FFE800' : '#000000') : '#333';

        // Hard hat (yellow) — wide brim visible
        ctx.fillStyle = hatColor;
        ctx.beginPath();
        ctx.arc(0, -18, 4, 0, Math.PI * 2);
        ctx.fill();
        // Hat brim
        ctx.fillRect(-4.5, -17, 9, 1.5);

        // Head
        ctx.fillStyle = headColor;
        ctx.beginPath();
        ctx.arc(0, -14, 3, 0, Math.PI * 2);
        ctx.fill();

        // Orange vest torso
        ctx.fillStyle = vestColor;
        ctx.fillRect(-3, -11, 6, 7);

        // Dark pants/legs
        ctx.fillStyle = pantsColor;
        if (!isLying && (w.phase === 'walking' || w.phase === 'returning')) {
            // Simple walking leg animation
            const legSwing = Math.sin(Date.now() / 120) * 1.5;
            ctx.fillRect(-3, -4, 2.5, 5 + legSwing * 0.5);
            ctx.fillRect(0.5, -4, 2.5, 5 - legSwing * 0.5);
        } else {
            ctx.fillRect(-3, -4, 2.5, 5);
            ctx.fillRect(0.5, -4, 2.5, 5);
        }

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.restore();
    });

    // Draw flour ice on water surface
    if (state.flourIce.active) {
        const ice = state.flourIce;
        ctx.save();
        ice.patches.forEach(p => {
            if (p.opacity <= 0) return;
            // Ice color: white-blue with subtle shimmer
            const shimmer = Math.sin(Date.now() / 2000 + p.shimmer) * 0.05;
            const alpha = Math.min(1, p.opacity + shimmer);
            // Icy white-blue layer
            ctx.fillStyle = `rgba(200, 220, 255, ${alpha})`;
            ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
            // Frost highlight on top
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.4})`;
            ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h * 0.4);
        });

        // Thin ice edge line spreading outward
        if (ice.progress > 0.1) {
            const zone4 = state.defenses.find(d => d.id === 4);
            if (zone4) {
                const spread = ice.progress * 400;
                const waterY = COORD_SYSTEM.height - 72;
                ctx.strokeStyle = `rgba(180, 210, 255, ${ice.progress * 0.3})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(zone4.x - zone4.w / 2 - spread / 2, waterY);
                ctx.lineTo(zone4.x + zone4.w / 2 + spread / 2, waterY);
                ctx.stroke();
            }
        }
        ctx.restore();
    }


    // Draw flour ground snow patches and snowbanks (before employees so they walk on top)
    state.flourGround.forEach(patch => {
        if (patch.opacity <= 0) return;
        if (patch.isBank) {
            // Snowbank — flat-bottomed mound shape
            ctx.fillStyle = `rgba(245, 245, 255, ${patch.opacity})`;
            ctx.beginPath();
            ctx.ellipse(patch.x, patch.y, patch.radius, patch.radius * 0.5, 0, Math.PI, 0, false);
            ctx.lineTo(patch.x + patch.radius, patch.y);
            ctx.lineTo(patch.x - patch.radius, patch.y);
            ctx.closePath();
            ctx.fill();
            // Snow highlight on top
            ctx.fillStyle = `rgba(255, 255, 255, ${patch.opacity * 0.5})`;
            ctx.beginPath();
            ctx.ellipse(patch.x, patch.y - patch.radius * 0.15, patch.radius * 0.6, patch.radius * 0.2, 0, Math.PI, 0, false);
            ctx.fill();
        } else {
            // Regular flour dusting — circular patches
            ctx.fillStyle = `rgba(255, 255, 255, ${patch.opacity})`;
            ctx.beginPath();
            ctx.arc(patch.x, patch.y, patch.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    // Draw Robin Hood flour employees (Robin Hood → white → snowman)
    state.flourWorkers.forEach(fw => {
        ctx.save();
        ctx.translate(fw.x, fw.y);

        if (fw.direction < 0) ctx.scale(-1, 1);

        const fc = fw.flourCover;
        const lerp = (base, target) => Math.round(base + (target - base) * Math.min(fc / 0.7, 1));

        // Snowman morph factor: 0 at fc<=0.7, 1 at fc=1.0
        const snowMorph = Math.max(0, (fc - 0.7) / 0.3);

        if (snowMorph < 1) {
            // ── Robin Hood phase (fading out as snowMorph rises) ──
            ctx.globalAlpha = 1 - snowMorph;

            const gnR = lerp(30, 255), gnG = lerp(220, 255), gnB = lerp(30, 255);   // bright Lincoln green tunic
            const dkR = lerp(20, 255), dkG = lerp(160, 255), dkB = lerp(20, 255);   // darker green pants
            const brR = lerp(139, 255), brG = lerp(90, 255), brB = lerp(43, 255);    // brown belt/shoes
            const ftR = lerp(220, 255), ftG = lerp(20, 255), ftB = lerp(20, 255);    // bright red feather
            const skR = lerp(210, 255), skG = lerp(170, 255), skB = lerp(130, 255);  // skin

            // Pointed hat
            ctx.fillStyle = `rgb(${gnR}, ${gnG}, ${gnB})`;
            ctx.beginPath();
            ctx.moveTo(-3.5, -16); ctx.lineTo(0, -22); ctx.lineTo(3.5, -16);
            ctx.closePath(); ctx.fill();
            ctx.fillRect(-4, -16, 8, 1.5);

            // Bright red feather — tall and visible
            ctx.strokeStyle = `rgb(${ftR}, ${ftG}, ${ftB})`;
            ctx.lineWidth = 1.8;
            ctx.beginPath(); ctx.moveTo(2, -17); ctx.quadraticCurveTo(8, -24, 5, -28); ctx.stroke();
            // Feather plume (filled shape)
            ctx.fillStyle = `rgb(${ftR}, ${ftG}, ${ftB})`;
            ctx.beginPath();
            ctx.moveTo(5, -28);
            ctx.quadraticCurveTo(9, -26, 6, -22);
            ctx.quadraticCurveTo(4, -25, 5, -28);
            ctx.closePath(); ctx.fill();
            // Feather tip
            ctx.beginPath(); ctx.arc(5, -28.5, 1.2, 0, Math.PI * 2); ctx.fill();

            // Head
            ctx.fillStyle = `rgb(${skR}, ${skG}, ${skB})`;
            ctx.beginPath(); ctx.arc(0, -14, 2.8, 0, Math.PI * 2); ctx.fill();

            // Tunic + belt
            ctx.fillStyle = `rgb(${gnR}, ${gnG}, ${gnB})`;
            ctx.fillRect(-3, -11, 6, 5);
            ctx.fillStyle = `rgb(${brR}, ${brG}, ${brB})`;
            ctx.fillRect(-3, -6.5, 6, 1.2);

            // Pants + legs
            ctx.fillStyle = `rgb(${dkR}, ${dkG}, ${dkB})`;
            const isWalking = (fw.phase === 'scurrying');
            const legSwing = isWalking ? Math.sin(Date.now() / 130 + fw.spawnTime) * 1.5 : 0;
            ctx.fillRect(-2.8, -5.3, 2.3, 3 + legSwing * 0.3);
            ctx.fillRect(0.5, -5.3, 2.3, 3 - legSwing * 0.3);
            ctx.fillStyle = `rgb(${skR}, ${skG}, ${skB})`;
            ctx.fillRect(-2.2, -2.3, 1.8, 2 + legSwing * 0.2);
            ctx.fillRect(0.8, -2.3, 1.8, 2 - legSwing * 0.2);

            // Elf shoes
            ctx.fillStyle = `rgb(${brR}, ${brG}, ${brB})`;
            ctx.beginPath();
            ctx.moveTo(-3, -0.3); ctx.lineTo(-3, 0.8); ctx.lineTo(1, 0.8);
            ctx.quadraticCurveTo(2.5, 0.8, 2, -0.5); ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(0, -0.3); ctx.lineTo(0, 0.8); ctx.lineTo(4, 0.8);
            ctx.quadraticCurveTo(5.5, 0.8, 5, -0.5); ctx.closePath(); ctx.fill();

            ctx.globalAlpha = 1;
        }

        if (snowMorph > 0) {
            // ── Snowman phase (fading in) ──
            ctx.globalAlpha = snowMorph;

            // Bottom ball (body)
            ctx.fillStyle = '#f0f0ff';
            ctx.beginPath();
            ctx.arc(0, -4, 6, 0, Math.PI * 2);
            ctx.fill();
            // Subtle shadow on bottom ball
            ctx.fillStyle = 'rgba(180, 190, 210, 0.3)';
            ctx.beginPath();
            ctx.arc(0, -2, 5, 0.2, Math.PI - 0.2);
            ctx.fill();

            // Middle ball (torso)
            ctx.fillStyle = '#f4f4ff';
            ctx.beginPath();
            ctx.arc(0, -12, 5, 0, Math.PI * 2);
            ctx.fill();

            // Top ball (head)
            ctx.fillStyle = '#f8f8ff';
            ctx.beginPath();
            ctx.arc(0, -19, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // ── Black Top Hat ──
            ctx.fillStyle = '#111111';
            // Hat brim
            ctx.fillRect(-5, -22.5, 10, 1.5);
            // Hat body
            ctx.fillRect(-3.5, -28, 7, 6);
            // Hat band (dark red)
            ctx.fillStyle = '#660000';
            ctx.fillRect(-3.5, -23.5, 7, 1);

            // ── Coal eyes ──
            ctx.fillStyle = '#111111';
            ctx.beginPath(); ctx.arc(-1.5, -20, 0.8, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(1.5, -20, 0.8, 0, Math.PI * 2); ctx.fill();

            // ── Coal smile ──
            for (let i = 0; i < 5; i++) {
                const angle = (Math.PI * 0.15) + (Math.PI * 0.7 / 4) * i;
                const sx = Math.cos(angle) * 2.5;
                const sy = Math.sin(angle) * 1.5 - 17;
                ctx.beginPath(); ctx.arc(sx, sy, 0.5, 0, Math.PI * 2); ctx.fill();
            }

            // ── Carrot nose ──
            ctx.fillStyle = '#FF6600';
            ctx.beginPath();
            ctx.moveTo(0, -19);
            ctx.lineTo(5, -18.5);
            ctx.lineTo(0, -18);
            ctx.closePath();
            ctx.fill();

            // ── Corn cob pipe ──
            ctx.strokeStyle = '#8B6914';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(2.5, -17.5);
            ctx.lineTo(7, -16);
            ctx.stroke();
            // Pipe bowl
            ctx.fillStyle = '#8B6914';
            ctx.fillRect(6, -17.5, 2.5, 3);
            // Pipe smoke
            if (Math.random() > 0.3) {
                ctx.fillStyle = `rgba(200, 200, 200, ${0.15 + Math.random() * 0.15})`;
                ctx.beginPath();
                ctx.arc(7.2 + Math.random() * 2, -19 - Math.random() * 4, 1 + Math.random() * 1.5, 0, Math.PI * 2);
                ctx.fill();
            }

            // ── Coal buttons (3 on middle ball) ──
            ctx.fillStyle = '#111111';
            ctx.beginPath(); ctx.arc(0, -14, 0.8, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(0, -12, 0.8, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(0, -10, 0.8, 0, Math.PI * 2); ctx.fill();

            // ── Stick arms ──
            ctx.strokeStyle = '#5C3A1E';
            ctx.lineWidth = 1;
            // Left arm
            ctx.beginPath(); ctx.moveTo(-5, -13); ctx.lineTo(-10, -16); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-8, -15); ctx.lineTo(-9, -18); ctx.stroke();
            // Right arm
            ctx.beginPath(); ctx.moveTo(5, -13); ctx.lineTo(10, -16); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(8, -15); ctx.lineTo(9, -18); ctx.stroke();

            ctx.globalAlpha = 1;
        }

        // Flour dust cloud (during transition)
        if (fc > 0.3 && fc < 0.9) {
            ctx.fillStyle = `rgba(255, 255, 255, ${(1 - snowMorph) * fc * 0.15})`;
            ctx.beginPath();
            ctx.arc(0, -10, 8 + fc * 4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    });

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

        // Sir Adam Beck (Electrical Arcs) — bright, frequent sparking
        if (zone.id === 1 && Math.random() < 0.3) {
            const arcColor = Math.random() > 0.5 ? '#44ffff' : '#ffff44';
            ctx.strokeStyle = arcColor;
            ctx.lineWidth = 3;
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 25;
            ctx.beginPath();
            let ex = zone.x - zone.w/2 + Math.random() * zone.w;
            let ey = zone.y - Math.random() * (zone.h * 0.5);
            ctx.moveTo(ex, ey);
            for(let j=0; j<5; j++) {
                ex += (Math.random() - 0.5) * 35;
                ey -= Math.random() * 30;
                ctx.lineTo(ex, ey);
            }
            ctx.stroke();
            // Second thinner bright core line for intensity
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.shadowBlur = 15;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Radio Tower (Tesla Coil Bolt)
        if (zone.id === 'tower' && Math.random() < 0.3 && !state.beamActive) {
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

    // ── Sir Adam Beck Reservoir Purge (destroyed state) ──
    state.defenses.forEach(zone => {
        if (zone.id !== 1 || !zone.destroyed) return;
        ctx.save();
        const time = Date.now();
        // Slower, heavy cycle for the water pour (3-second cycle)
        const surgeCycle = (time % 3000) / 3000;

        // The main heavy pour
        if (surgeCycle < 0.6) {
            const alpha = 1 - (surgeCycle / 0.6);
            ctx.fillStyle = `rgba(0, 200, 255, ${alpha * 0.7})`;

            ctx.beginPath();
            // Spilling from the center of the ruin down into the gorge
            ctx.moveTo(zone.x - 40, zone.y - 40);
            ctx.quadraticCurveTo(zone.x, zone.y - 10 + (surgeCycle * 40), zone.x + 40, zone.y - 40);
            ctx.lineTo(zone.x + 60, zone.y + 20);
            ctx.lineTo(zone.x - 60, zone.y + 20);
            ctx.fill();
        }

        // The pathetic trickles running down the cracked concrete
        ctx.strokeStyle = '#00ccff';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 15]);
        ctx.lineDashOffset = -(time / 20); // Animate the trickles downward

        // Left trickle
        ctx.beginPath();
        ctx.moveTo(zone.x - 50, zone.y - 30);
        ctx.lineTo(zone.x - 50, zone.y + 15);
        ctx.stroke();

        // Right trickle
        ctx.beginPath();
        ctx.moveTo(zone.x + 45, zone.y - 25);
        ctx.lineTo(zone.x + 45, zone.y + 15);
        ctx.stroke();

        ctx.restore();
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

// ============================================
// CANAL STATE MACHINE
// ============================================
function updateCanal(dt) {
    const c = state.canal;
    // Find the lift bridge defense for reference dimensions
    const bridge = state.defenses.find(d => d.isLiftBridge);
    if (!bridge) return;

    const maxRaise = bridge.h * 0.50;            // ~55 virtual-unit travel
    const horizonY = (bridge.y - bridge.h) + (bridge.h * 0.554); // canal waterline
    const foregroundExitY = COORD_SYSTEM.height + 100;   // off-screen bottom
    const midPathY = horizonY + (foregroundExitY - horizonY) / 2; // halfway down foreground run

    const raiseSpeed   = 10;   // Reduced from 40 for massive mechanical weight
    const lowerSpeed   = 10;   // Reduced from 40
    const shipRiseSpeed = 10;      // Reduced by 1/3 (was 15)
    const shipApproachSpeed = 11.5;  // Halved from 23 — slower vertical travel
    const shipScaleRate = 0.05;    // Halved to match slower travel

    // ── Bridge phases ──
    switch (c.bridgePhase) {
        case 'idle':
            c.timer += dt;
            c.deckRaise = Math.max(0, c.deckRaise - lowerSpeed * dt); // ensure fully lowered
            if (c.timer >= 8) {  // Shortened from 15s for faster freighter spawns
                c.bridgePhase = 'raising';
                c.timer = 0;
            }
            break;

        case 'raising':
            c.deckRaise = Math.min(maxRaise, c.deckRaise + raiseSpeed * dt);
            if (c.deckRaise >= maxRaise) {
                c.bridgePhase = 'raised';
                c.shipPhase = 'approaching';   // skip 'emerging' — ship visible immediately
                c.shipY = horizonY;             // start AT the waterline, not below it
                c.shipScale = 0.2;
                c.shipType = FREIGHTER_ALL_KEYS[Math.floor(Math.random() * FREIGHTER_ALL_KEYS.length)];
                c.timer = 0;
            }
            break;

        case 'raised':
            c.deckRaise = maxRaise; // hold at max
            // Position-based: lower when freighter reaches 50% of its journey
            if (c.shipPhase === 'approaching' && c.shipY >= midPathY) {
                c.bridgePhase = 'lowering';
            }
            break;

        case 'lowering':
            c.deckRaise = Math.max(0, c.deckRaise - lowerSpeed * dt);
            if (c.deckRaise <= 0) {
                c.deckRaise = 0;
                c.bridgePhase = 'idle';
                c.timer = 0;
            }
            break;
    }

    // ── Ship phases ──
    switch (c.shipPhase) {
        case 'emerging':
            // Ship rises UP toward the horizon line
            c.shipY -= shipRiseSpeed * dt;
            if (c.shipY <= horizonY) {
                c.shipY = horizonY;
                c.shipPhase = 'approaching';
            }
            break;

        case 'approaching':
            // Ship moves DOWN the screen, scaling up (looming toward camera)
            c.shipY += shipApproachSpeed * dt;
            c.shipScale = Math.min(1.0, c.shipScale + shipScaleRate * dt);

            // Ship exits bottom of canvas → full reset
            if (c.shipY >= foregroundExitY) {
                c.shipPhase = 'hidden';
                c.shipScale = 0.2;
                c.shipY = 0;
                c.shipType = null;
            }
            break;
    }

    // ── Crash freighter sequence (post-destruction) ──
    if (c.crashPhase === 'approaching') {
        c.crashShipY += shipApproachSpeed * dt;
        c.crashShipScale = Math.min(2.0, c.crashShipScale + 0.5 * dt);

        // Crash at static deck coordinate (bridge deck surface when lowered)
        const bridge = state.defenses.find(d => d.isLiftBridge);
        if (bridge) {
            // Static Y: deck surface = top of sprite + 55.4% of height
            const deckSurfaceY = (bridge.y - bridge.h) + (bridge.h * 0.554);
            if (c.crashShipY >= deckSurfaceY) {
                c.crashPhase = 'crashed';
                c.crashShipY = deckSurfaceY + 40; // Shifted down into the Danger Zone
                c.crashShipScale = Math.max(c.crashShipScale, 1.2); // Ensure visible on impact
                c.crashShipTilt = 0.26; // ~15 degrees tilt
                // Impact explosion
                createExplosion(bridge.x, deckSurfaceY, '#ff6600', 40);
                // Splash + fire particles
                for (let i = 0; i < 12; i++) {
                    state.environmentalParticles.push({
                        x: bridge.x + (Math.random() - 0.5) * 80,
                        y: deckSurfaceY,
                        vx: (Math.random() - 0.5) * 5,
                        vy: -2 - Math.random() * 4,
                        radius: 2 + Math.random() * 4,
                        color: Math.random() > 0.5
                            ? 'rgba(255,255,255,0.6)'
                            : 'rgba(255,140,0,0.6)',
                        life: 1.0, decay: 0.02 + Math.random() * 0.02, type: 'wake'
                    });
                }
            }
        }
    }
}

function update(dt) {
    if (!state.running) return;

    try {
        if (state.ambulance) updateAmbulance(dt);
        maintainAsteroids(dt);  // Pass delta-time for spawn timer
        updateRicochets(dt);
        updateAftermathVFX(dt);
        updateCanal(dt);
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

            // DUAL NAMING: Target Impact (Initiator = asteroid) → Impact Zone (Receiver = defense)
            const impactAltitude = getImpactAltitude(a.target);

            // Did the Target (Initiator) breach the Impact Zone (Receiver)?
            if (a.y + a.radius >= impactAltitude) {
                const initiator = { type: 'asteroid', id: a.id, unitID: a.unitID, x: a.x, y: a.y };
                const receiver = { type: a.target.type, id: a.target.id, name: a.target.name, x: a.target.x, y: a.target.y };
                createShatter(a.x, a.y, a.spriteIndex);
                createExplosion(a.x, a.y, '#ff3366', 35);
                damageDefense(a.target, initiator, receiver);
                state.asteroids.splice(i, 1);
            }
        } catch (e) {
            console.error('Asteroid update failed:', e);
            state.asteroids.splice(i, 1);
        }
    }

    try {
        resolveAsteroidCollisions(); // Elastic bumps — must run after positions update, before UI physics
    } catch (e) {
        console.error('Asteroid collision failed:', e);
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
            
            const target = state.asteroids.find(a => a && a.id === p.targetId);

            // Re-aim toward the target each frame (homing projectile)
            if (target) {
                const dx = target.x - p.x;
                const dy = target.y - p.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d > 0) {
                    p.vx = (dx / d) * p.speed;
                    p.vy = (dy / d) * p.speed;
                }
            }

            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.trail = p.trail || [];
            p.trail.push({ x: p.x, y: p.y });
            if (p.trail.length > 10) p.trail.shift();

            if (target) {
                const d = Math.sqrt((p.x - target.x) ** 2 + (p.y - target.y) ** 2);
                if (d < target.radius + 5) {
                    AudioManager.play('hit');
                    createExplosion(target.x, target.y);
                    createShatter(target.x, target.y, target.spriteIndex);
                    state.asteroids = state.asteroids.filter(a => a && a.id !== target.id);
                    state.timers.spawnTimer = 0; // Enforce full 3-second delay before next spawn
                    state.projectiles.splice(i, 1);
                }
            } else if (p.y < -50 || p.y > COORD_SYSTEM.height + 50) {
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
            if (b.life <= 0 || b.y > COORD_SYSTEM.height + 50) state.brokenProjectiles.splice(i, 1);
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

function damageDefense(def, initiator, receiver) {
    if (def.hp <= 0 && def.type !== 'tower') return;

    // Dual Naming: initiator = Target Impact (asteroid), receiver = Impact Zone (defense)
    const initiatorLabel = initiator ? `[${initiator.unitID || 'UNKNOWN'}]` : '';
    const receiverLabel = receiver ? receiver.name : def.name;

    if (def.type === 'tower') {
        AudioManager.play('targetImpact');
        applyDamage(CONFIG.impactDamage, 'impact');
        return;
    }

    AudioManager.play('targetImpact');
    def.hp = 0;
    def.destroyed = true;
    def.destroyedAt = Date.now();
    createExplosion(def.x, def.y, '#ff3366', 50);

    // ── Consecutive Base Destruction penalty (scoring.csv v2) ──
    state.consecutiveBasesDestroyed++;
    state.streak = 0;              // Base destroyed resets kill streak
    state.perfectStreak = 0;       // Also breaks perfect streak
    state.perfectMilestonesHit = [];
    state.comebackCounter = 0;     // Reset comeback counter
    state.comebackAwarded = false;  // Allow new comeback opportunity

    const count = state.consecutiveBasesDestroyed;
    const penalty = count <= 1 ? 0 : Math.max(SCORING.penaltyCap, (count - 1) * -100);
    if (penalty < 0) applyScore(penalty);

    // Constitutional Impact: Target Impact (Initiator) → Impact Zone (Receiver)
    const labels = ['BASE LOST', 'SECTOR BREACH', 'CRITICAL FAILURE', 'SYSTEM COLLAPSE'];
    const label = labels[Math.min(count - 1, labels.length - 1)];
    const penaltyText = penalty < 0 ? ` ${penalty}` : '';
    showStatus(`${label}${penaltyText} — ${initiatorLabel} → ${receiverLabel.toUpperCase()}`, "impact");
    if (penalty < 0) flashScorePenalty();
    updateHUD();

    if (state.defenses.filter(d => d.type === 'zone' && d.hp > 0).length === 0) scheduleGameOver();
}

// ============================================
// DEFENSE ZONE INDICATORS
// ============================================

// Draws a crawling dashed outline around the collision boundary of every defense.
// For the tower:  uses the shield dome path when shields are up, chassis rect when down.
// For all others: uses the sprite bounding rect, capped at the canvas bottom so
//                 buildings that sink below the horizon don't bleed off-screen.
function drawDefenseZones(ctx) {
    const time = Date.now();
    ctx.save();
    // Animated dash crawl — gives the boundary a subtle "active scan" feel
    ctx.setLineDash([8, 5]);
    ctx.lineDashOffset = -((time / 55) % 13);
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 7;

    // Helper: stroke a closed polygon from array of [x, y] pairs
    function poly(pts) {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.stroke();
    }

    for (const d of state.defenses) {
        // Zone colour: reflect health / shield state
        let color;
        if (d.type === 'tower') {
            color = state.towerDisabled ? '#ff3366'
                  : state.shieldHP > 6  ? '#00ff88'
                  : state.shieldHP > 3  ? '#ff6600'
                  :                       '#9d00ff';
        } else {
            color = d.hp > 0 ? '#00ffcc' : '#ff3366';
        }
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.globalAlpha = 0.38 + Math.sin(time / 1100 + d.x * 0.008) * 0.10;

        const L = d.x - d.w / 2;   // sprite left edge in virtual coords
        const T = d.y - d.h;        // sprite top edge in virtual coords

        if (d.type === 'tower') {
            if (state.shieldHP > 0 && !state.towerDisabled) {
                // Dome: identical hemisphere to drawShield — flat base at ground
                const cx = d.x, by = d.y, hw = 105, ht = 195;
                ctx.beginPath();
                ctx.ellipse(cx, by, hw, ht, 0, Math.PI, 0, false);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(cx - hw, by); ctx.lineTo(cx + hw, by);
                ctx.stroke();
            } else {
                // Bare tower: pointed-top pentagon matching broadcast tower silhouette
                // Content measured at 45–55% of sprite width, 7–93% height.
                // Zone reference shows ~35–65% width with triangular spire top.
                poly([
                    [d.x,            T + d.h * 0.04],   // spire tip (antenna)
                    [L + d.w * 0.35, T + d.h * 0.18],   // left shoulder
                    [L + d.w * 0.35, T + d.h * 0.95],   // bottom-left
                    [L + d.w * 0.65, T + d.h * 0.95],   // bottom-right
                    [L + d.w * 0.65, T + d.h * 0.18],   // right shoulder
                ]);
            }

        } else if (d.id === 1) {
            // ── Sir Adam Beck — powerhouse body + twin transmission pylons ──
            // Content: top 8.9%, left 7.1%, right 91.9%, bottom 82.4%
            // Fractions pushed down hard to hug visible rooflines.
            // Sprite 1536×493 px, content rows 44–406 (8.9–82.4%), anchored y=940.
            poly([
                [L + d.w * 0.07, T + d.h * 0.34],  // left office building top-left
                [L + d.w * 0.22, T + d.h * 0.34],  // left building top-right
                [L + d.w * 0.22, T + d.h * 0.40],  // step down to main powerhouse
                [L + d.w * 0.64, T + d.h * 0.40],  // powerhouse right edge
                [L + d.w * 0.64, T + d.h * 0.30],  // step up for right section
                [L + d.w * 0.70, T + d.h * 0.30],  // substation base
                [L + d.w * 0.70, T + d.h * 0.24],  // rise to pylon area
                [L + d.w * 0.76, T + d.h * 0.20],  // left pylon peak
                [L + d.w * 0.82, T + d.h * 0.24],  // valley between pylons
                [L + d.w * 0.87, T + d.h * 0.20],  // right pylon peak
                [L + d.w * 0.93, T + d.h * 0.24],  // right side of pylon
                [L + d.w * 0.93, T + d.h * 0.83],  // bottom-right
                [L + d.w * 0.07, T + d.h * 0.83],  // bottom-left
            ]);

        } else if (d.id === 2) {
            // ── Skylon Tower — spire → pod disc → tapered shaft → base platform ──
            // Content: top 3.5%, left 24.7%, right 82.2%, bottom 98.5%
            poly([
                [d.x,            T + d.h * 0.03],  // antenna tip
                [L + d.w * 0.20, T + d.h * 0.23],  // pod top-left
                [L + d.w * 0.18, T + d.h * 0.34],  // pod bottom-left
                [L + d.w * 0.40, T + d.h * 0.42],  // shaft left (above base)
                [L + d.w * 0.22, T + d.h * 0.87],  // base left
                [L + d.w * 0.22, T + d.h * 0.97],  // base bottom-left
                [L + d.w * 0.78, T + d.h * 0.97],  // base bottom-right
                [L + d.w * 0.78, T + d.h * 0.87],  // base right
                [L + d.w * 0.60, T + d.h * 0.42],  // shaft right (above base)
                [L + d.w * 0.82, T + d.h * 0.34],  // pod bottom-right
                [L + d.w * 0.80, T + d.h * 0.23],  // pod top-right
            ]);

        } else if (d.id === 3) {
            // ── Welland Canal Lift Bridge — three linked zones (2 towers + deck) ──
            // Re-derive deckRaise using same formula as render() so zones track the animation
            const raw    = (Math.sin(time / 7000 - Math.PI / 2) + 1) / 2;
            const deckT  = raw * raw * (3 - 2 * raw);   // smoothstep
            const deckRaise = d.h * 0.50 * deckT;

            // Left tower: cols 1–26%, rows 17–85%
            ctx.beginPath();
            ctx.strokeRect(L + d.w * 0.01, T + d.h * 0.17, d.w * 0.25, d.h * 0.68);
            ctx.stroke();

            // Right tower: cols 74–99%, rows 17–85%
            ctx.beginPath();
            ctx.strokeRect(L + d.w * 0.74, T + d.h * 0.17, d.w * 0.25, d.h * 0.68);
            ctx.stroke();

            // Deck: arch silhouette that rides up/down with the animation
            // Content: cols 20.7–77.1%, rows 55.4–78.1% of deck sprite
            const dT = T - deckRaise;   // deck sprite top after raise offset
            poly([
                [L + d.w * 0.21, dT + d.h * 0.78],  // bottom-left
                [L + d.w * 0.80, dT + d.h * 0.78],  // bottom-right (incl. right pipe)
                [L + d.w * 0.80, dT + d.h * 0.65],  // pipe top
                [L + d.w * 0.77, dT + d.h * 0.59],  // arch descends right
                [L + d.w * 0.64, dT + d.h * 0.53],  // control house right shoulder
                [L + d.w * 0.57, dT + d.h * 0.50],  // control house peak-right
                [L + d.w * 0.43, dT + d.h * 0.50],  // control house peak-left
                [L + d.w * 0.36, dT + d.h * 0.53],  // control house left shoulder
                [L + d.w * 0.23, dT + d.h * 0.59],  // arch descends left
                [L + d.w * 0.21, dT + d.h * 0.65],  // arch base left
            ]);

        } else if (d.id === 4) {
            // ── Robin Hood Flour — grain elevator stepped silhouette ──
            // Content: top 14.3%, left 6.2%, right 94.4%, bottom 85%
            // Tall left silo-tower with penthouse cap; main silo body; shorter right industrial section
            poly([
                [L + d.w * 0.04, T + d.h * 0.03],  // penthouse cap top-left
                [L + d.w * 0.18, T + d.h * 0.03],  // penthouse cap top-right
                [L + d.w * 0.18, T + d.h * 0.17],  // step down to main silo roof
                [L + d.w * 0.72, T + d.h * 0.17],  // main silo top-right
                [L + d.w * 0.72, T + d.h * 0.27],  // step down for right section
                [L + d.w * 0.94, T + d.h * 0.27],  // right section top-right
                [L + d.w * 0.94, T + d.h * 0.85],  // bottom-right
                [L + d.w * 0.06, T + d.h * 0.85],  // bottom-left (main body left edge)
                [L + d.w * 0.06, T + d.h * 0.14],  // up the left side of silo tower
                [L + d.w * 0.04, T + d.h * 0.14],  // step left for penthouse overhang
            ]);
        }
    }

    ctx.setLineDash([]);
    ctx.restore();
}

// ============================================
// RENDER
// ============================================

// Returns { w, h } for a destroyed image scaled to the same pixel-per-unit
// ratio as the corresponding intact image. This guarantees both sprites occupy
// an identical virtual footprint regardless of their native canvas dimensions.
function matchedDrawSize(destroyedImg, intactImg, defW, defH) {
    if (intactImg?.complete && intactImg.naturalWidth > 0 &&
        destroyedImg?.complete && destroyedImg.naturalWidth > 0) {
        const pixelScale = defW / intactImg.naturalWidth;
        return {
            w: destroyedImg.naturalWidth  * pixelScale,
            h: destroyedImg.naturalHeight * pixelScale
        };
    }
    // Intact image not loaded yet — fall back to the hardcoded dimensions
    return { w: defW, h: defH };
}

function render() {
    const ctx = DOM.ctx;
    // Clear in pixel space before applying the virtual-coordinate scale
    ctx.clearRect(0, 0, DOM.canvas.width, DOM.canvas.height);

    // All draw calls below operate in COORD_SYSTEM (1600×900) virtual space
    ctx.save();
    ctx.scale(canvasScaleX, canvasScaleY);


    // ── Niagara Falls — animated waterfall at the gorge ──
    const fallsX = 440;                                // left of Skylon (x=480) so falls are visible
    const fallsCrestY = COORD_SYSTEM.height - 90;   // top of cliff / crest where water spills (raised to cover gorge wall)
    const fallsBaseY = COORD_SYSTEM.height - 15;    // water level at bottom
    const fallsWidth = 50;                           // wide enough to be a prominent feature
    const sectorW = COORD_SYSTEM.width / 5;          // 320px per sector

    // Key x-positions for terrain zones
    const gorgeEnd = fallsX + fallsWidth / 2;              // ~465: right edge of falls
    const canalX = sectorW * 3.5;                           // 1120: Welland Canal center
    const canalHalfW = 35;                                  // canal channel half-width (under deck only, pylons on land)
    const canalLeft = canalX - canalHalfW;                  // ~1055
    const canalRight = canalX + canalHalfW;                 // ~1185
    const lakeStart = sectorW * 4.6 + 157 / 2;             // ~1550: right edge of Robin Hood → Lake Ontario

    // ── Green terrain — from right of falls to Robin Hood, with canal cutout ──
    ctx.fillStyle = '#1b4d1b';
    ctx.fillRect(gorgeEnd, fallsCrestY, canalLeft - gorgeEnd, COORD_SYSTEM.height - fallsCrestY);
    ctx.fillRect(canalRight, fallsCrestY, lakeStart - canalRight, COORD_SYSTEM.height - fallsCrestY);
    // Extend green up to lake height at the Robin Hood boundary to prevent water sliver
    const lakeTop = COORD_SYSTEM.height - 90;
    ctx.fillRect(canalRight, lakeTop, lakeStart - canalRight, fallsCrestY - lakeTop);

    // ── Water zones — all use same color for a uniform look ──
    ctx.fillStyle = '#00FFFF';
    // Gorge water: x=0 to falls right edge, solid block from crest to bottom
    ctx.fillRect(0, fallsCrestY, gorgeEnd, COORD_SYSTEM.height - fallsCrestY);
    // Welland Canal water: full-height channel through the terrain
    ctx.fillRect(canalLeft, fallsCrestY, canalRight - canalLeft, COORD_SYSTEM.height - fallsCrestY);
    // Lake Ontario: from Robin Hood right edge to canvas right edge, flush with CSS wing (90px from bottom)
    ctx.fillRect(lakeStart, lakeTop, COORD_SYSTEM.width - lakeStart, COORD_SYSTEM.height - lakeTop);

    // ── Brown gorge wall — extends from x=0 to the falls (NOT over the falls) ──
    const gorgeWallRight = fallsX - fallsWidth / 2;
    ctx.fillStyle = '#6B4226';
    ctx.fillRect(0, fallsCrestY, gorgeWallRight, fallsBaseY - fallsCrestY - 5);
    // Darker rock layers for depth (visible on both sides of Sir Adam Beck)
    ctx.fillStyle = '#4A2E18';
    for (let ly = 0; ly < 4; ly++) {
        const layerY = fallsCrestY + 8 + ly * 15;
        const layerH = 5 + (ly % 2) * 3;
        ctx.fillRect(0, layerY, gorgeWallRight, layerH);
    }

    // ── Niagara Gorge Category 6 Rapids (white, green, aqua green) ──
    const t = Date.now() * 0.003;
    const flowT = Date.now() * 0.002;
    ctx.save();
    const gorgeWaterTop = fallsBaseY - 5;
    const gorgeWaterH = COORD_SYSTEM.height - gorgeWaterTop;
    const gW = gorgeEnd; // gorge width

    // --- Layer 1: Dark teal depth shadows (wave troughs) ---
    for (let i = 0; i < 8; i++) {
        const troughX = ((gW - ((flowT * 30 + i * 58) % gW)) + gW) % gW;
        const troughY = gorgeWaterTop + (i % 4) * (gorgeWaterH / 4);
        const troughW = 20 + (i % 3) * 15;
        const alpha = 0.25 + Math.sin(flowT + i) * 0.1;
        ctx.fillStyle = `rgba(10, 63, 63, ${alpha})`;
        ctx.fillRect(troughX, troughY, troughW, gorgeWaterH / 4);
    }

    // --- Layer 2: Standing waves (haystacks) — stationary oscillating crests ---
    for (let sw = 0; sw < 5; sw++) {
        const waveX = 60 + sw * 85; // evenly spaced standing waves
        if (waveX > gW) break;
        const waveH = 6 - sw * 0.8; // decreasing downstream (left)
        const phase = t * 3 + sw * 1.5;
        const crestH = waveH + Math.sin(phase) * 2;

        // Dark base of standing wave
        ctx.fillStyle = `rgba(13, 79, 79, 0.4)`;
        ctx.beginPath();
        ctx.ellipse(waveX, gorgeWaterTop + gorgeWaterH / 2, 12, crestH + 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // White crest foam on top
        ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + Math.sin(phase * 1.5) * 0.2})`;
        ctx.beginPath();
        ctx.ellipse(waveX, gorgeWaterTop + gorgeWaterH / 2 - crestH, 10, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Foam shedding from crests (particles moving left)
        for (let p = 0; p < 3; p++) {
            const px = waveX - ((flowT * 60 + p * 15) % 40);
            const py = gorgeWaterTop + gorgeWaterH / 2 - crestH + Math.sin(flowT * 4 + p) * 2;
            ctx.fillStyle = `rgba(255, 255, 255, ${0.3 - p * 0.08})`;
            ctx.fillRect(px, py, 4 + p * 2, 1.5);
        }
    }

    // --- Layer 3: Chaotic multi-directional turbulence waves ---
    for (let wy = 0; wy < 7; wy++) {
        const waveY = gorgeWaterTop + 1 + wy * (gorgeWaterH / 7);
        const speed = 3 + (wy % 3) * 0.8;
        const amp = 2 + Math.sin(flowT * 0.5 + wy) * 1.5;

        // Alternating white / aqua green / teal wave lines
        const colIdx = wy % 3;
        const col = colIdx === 0 ? '255, 255, 255' : colIdx === 1 ? '30, 200, 140' : '106, 235, 180';
        const alpha = 0.3 + wy * 0.04;
        ctx.strokeStyle = `rgba(${col}, ${alpha})`;
        ctx.lineWidth = 1.5 + (wy % 2);
        ctx.beginPath();
        for (let wx = 0; wx < gW; wx += 2) {
            // Multi-frequency turbulence — chaotic, not smooth
            const y = waveY
                + Math.sin(wx * 0.05 + flowT * speed) * amp
                + Math.sin(wx * 0.12 + flowT * (speed * 1.7) + wy) * (amp * 0.6)
                + Math.sin(wx * 0.03 + flowT * 0.8 + wy * 2) * (amp * 0.4);
            if (wx === 0) ctx.moveTo(wx, y); else ctx.lineTo(wx, y);
        }
        ctx.stroke();
    }

    // --- Layer 4: Dense white foam streaks rushing left (30mph current) ---
    for (let i = 0; i < 24; i++) {
        const streakX = ((gW - ((flowT * 55 + i * 20) % gW)) + gW) % gW;
        const streakY = gorgeWaterTop + 1 + (i % 6) * (gorgeWaterH / 6)
            + Math.sin(flowT * 2 + i * 0.9) * 2;
        const streakLen = 15 + (i % 5) * 8;
        const streakW = 1.5 + (i % 3) * 0.5;
        const alpha = 0.35 + Math.sin(flowT * 2 + i) * 0.15;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(streakX, streakY, streakLen, streakW);
    }

    // --- Layer 5: Aqua green foam ribbons (aerated water) ---
    for (let i = 0; i < 18; i++) {
        const streakX = ((gW - ((flowT * 40 + i * 27) % gW)) + gW) % gW;
        const streakY = gorgeWaterTop + 2 + (i % 5) * (gorgeWaterH / 5)
            + Math.sin(flowT * 1.8 + i * 1.2) * 2;
        const streakLen = 20 + (i % 4) * 10;
        const alpha = 0.25 + Math.sin(flowT * 1.5 + i * 0.8) * 0.1;
        ctx.fillStyle = `rgba(106, 235, 180, ${alpha})`;
        ctx.fillRect(streakX, streakY, streakLen, 2);
    }

    // --- Layer 6: Sea-foam green aerated patches ---
    for (let i = 0; i < 14; i++) {
        const px = ((gW - ((flowT * 48 + i * 35) % gW)) + gW) % gW;
        const py = gorgeWaterTop + (i % 5) * (gorgeWaterH / 5)
            + Math.sin(flowT * 2.5 + i) * 3;
        const pw = 8 + (i % 3) * 6;
        const ph = 3 + (i % 2) * 2;
        const alpha = 0.2 + Math.sin(flowT * 1.8 + i * 0.6) * 0.08;
        ctx.fillStyle = `rgba(178, 255, 222, ${alpha})`;
        ctx.fillRect(px, py, pw, ph);
    }

    // --- Layer 7: Boils — circular upwellings from below ---
    for (let i = 0; i < 6; i++) {
        const boilX = 30 + ((flowT * 10 + i * 75) % (gW - 60));
        const boilY = gorgeWaterTop + gorgeWaterH * 0.3 + (i % 3) * (gorgeWaterH * 0.25);
        const boilR = 4 + Math.sin(flowT * 1.5 + i * 2) * 2;
        const alpha = 0.15 + Math.sin(flowT * 2 + i) * 0.08;
        // Expanding ring
        ctx.strokeStyle = `rgba(106, 235, 180, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(boilX, boilY, boilR, 0, Math.PI * 2);
        ctx.stroke();
        // Bright center
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha + 0.1})`;
        ctx.beginPath();
        ctx.arc(boilX, boilY, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- Layer 8: Large white foam clumps (persistent whitewater) ---
    for (let i = 0; i < 12; i++) {
        const cx = ((gW - ((flowT * 42 + i * 40) % gW)) + gW) % gW;
        const cy = gorgeWaterTop + 2 + (i % 5) * (gorgeWaterH / 5)
            + Math.sin(flowT * 3 + i * 1.3) * 2;
        const r = 2.5 + Math.sin(flowT * 2 + i) * 1.5;
        const alpha = 0.35 + Math.sin(flowT * 2.5 + i * 1.1) * 0.15;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- Layer 9: Spray particles above water surface ---
    for (let i = 0; i < 10; i++) {
        const sprayX = ((gW - ((flowT * 60 + i * 45) % gW)) + gW) % gW;
        const sprayY = gorgeWaterTop - 1 - Math.abs(Math.sin(flowT * 4 + i * 1.7)) * 4;
        const r = 1 + Math.sin(flowT * 3 + i) * 0.5;
        const alpha = 0.2 + Math.sin(flowT * 3 + i * 2) * 0.1;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(sprayX, sprayY, r, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- Layer 10: Green undertone ribbons (limestone teal) ---
    for (let i = 0; i < 8; i++) {
        const rx = ((gW - ((flowT * 32 + i * 55) % gW)) + gW) % gW;
        const ry = gorgeWaterTop + 3 + (i % 4) * (gorgeWaterH / 4);
        const rw = 25 + (i % 3) * 15;
        const alpha = 0.15 + Math.sin(flowT + i * 0.9) * 0.07;
        ctx.fillStyle = `rgba(30, 200, 140, ${alpha})`;
        ctx.fillRect(rx, ry, rw, 2.5);
    }
    ctx.restore();

    // ── Welland Canal slow flow animation (vertical, downward) ──
    ctx.save();
    const canalFlowT = Date.now() * 0.001; // slow flow
    const canalWaterTop = fallsCrestY;
    const canalWaterH = COORD_SYSTEM.height - canalWaterTop;
    // Gentle vertical wave lines
    for (let wx = 0; wx < 3; wx++) {
        const waveX = canalLeft + 8 + wx * 20;
        const alpha = 0.15 + wx * 0.05;
        ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let wy = 0; wy < canalWaterH; wy += 2) {
            const x = waveX + Math.sin(wy * 0.06 + canalFlowT * (1.5 + wx * 0.3)) * 2;
            if (wy === 0) ctx.moveTo(x, canalWaterTop + wy); else ctx.lineTo(x, canalWaterTop + wy);
        }
        ctx.stroke();
    }
    // Slow downward streaks
    for (let i = 0; i < 6; i++) {
        const streakY = ((canalFlowT * 15 + i * 14) % canalWaterH) + canalWaterTop;
        const streakX = canalLeft + 5 + (i % 3) * 22;
        const streakLen = 8 + (i % 3) * 5;
        const alpha = 0.15 + Math.sin(canalFlowT + i) * 0.08;
        ctx.fillStyle = `rgba(100, 255, 255, ${alpha})`;
        ctx.fillRect(streakX, streakY, 1.5, streakLen);
    }
    ctx.restore();

    const fallsHeight = fallsBaseY - fallsCrestY;

    // ── Niagara Falls — pronounced rushing water (dark blue, water green, aqua, white) ──
    ctx.save();
    // Clip falls to only render within the falls area (nothing above crest)
    ctx.beginPath();
    ctx.rect(fallsX - fallsWidth / 2 - 5, fallsCrestY, fallsWidth + 10, fallsHeight + 15);
    ctx.clip();

    // Color palette
    const FALLS_DARK_BLUE  = [20, 60, 140];
    const FALLS_WATER_GREEN = [30, 160, 120];
    const FALLS_AQUA       = [0, 220, 240];
    const FALLS_WHITE      = [240, 255, 255];

    // Solid dark blue base curtain — pronounced backdrop
    ctx.fillStyle = 'rgba(20, 60, 140, 0.85)';
    ctx.fillRect(fallsX - fallsWidth / 2 - 2, fallsCrestY, fallsWidth + 4, fallsHeight);

    // ── Dense rushing streams — cycling through the color palette ──
    const colors = [FALLS_DARK_BLUE, FALLS_WATER_GREEN, FALLS_AQUA, FALLS_WHITE, FALLS_AQUA, FALLS_WATER_GREEN];
    for (let stream = 0; stream < 6; stream++) {
        const col = colors[stream % colors.length];
        const streamOffX = (stream - 2.5) * 7;
        const streamW = fallsWidth * (stream <= 3 ? 0.9 : 0.6);
        for (let fy = 0; fy < fallsHeight; fy += 1) {
            const progress = fy / fallsHeight;
            const speed = 0.7 + progress * 0.5;
            const wobble = Math.sin(t * 3.5 - fy * 0.3 + stream * 1.7) * (1.5 + progress * 4)
                         + Math.sin(t * 5 - fy * 0.5 + stream) * progress * 2;
            const curW = streamW * (0.5 + progress * 0.6);
            // Blend color toward white as it falls (spray effect)
            const r = col[0] + (255 - col[0]) * progress * 0.3;
            const g = col[1] + (255 - col[1]) * progress * 0.2;
            const b = col[2] + (255 - col[2]) * progress * 0.15;
            const alpha = (stream <= 2 ? 0.55 : 0.35) * (0.6 + 0.4 * Math.sin(t * 4 - fy * 0.6 + stream));
            ctx.fillStyle = `rgba(${r|0}, ${g|0}, ${b|0}, ${alpha * speed})`;
            ctx.fillRect(fallsX + streamOffX - curW / 2 + wobble, fallsCrestY + fy, curW, 1.5);
        }
    }

    // ── Water green ribbons weaving through ──
    for (let i = 0; i < 6; i++) {
        const ribbonX = fallsX + Math.sin(t * 1.5 + i * 1.1) * (fallsWidth * 0.35);
        for (let fy = 0; fy < fallsHeight; fy += 2) {
            const progress = fy / fallsHeight;
            const wx = ribbonX + Math.sin(t * 2.5 - fy * 0.15 + i) * 3;
            const alpha = 0.3 + 0.15 * Math.sin(t * 3 + fy * 0.1 + i);
            ctx.fillStyle = `rgba(30, 180, 130, ${alpha})`;
            ctx.fillRect(wx - 1, fallsCrestY + fy, 2.5, 2);
        }
    }

    // ── Fast white streaks — bright rushing highlights ──
    for (let i = 0; i < 22; i++) {
        const speed = 90 + i * 14;
        const fy = ((t * speed + i * 17) % fallsHeight);
        const progress = fy / fallsHeight;
        const wx = fallsX + Math.sin(t * 2 + i * 1.3) * (5 + progress * 10);
        const streakLen = 10 + progress * 16;
        const streakW = 2 + progress * 2;
        const alpha = 0.6 + 0.35 * Math.sin(t * 4 + i * 1.8);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(wx - streakW / 2, fallsCrestY + fy, streakW, streakLen);
    }

    // ── Aqua bursts — bright aqua flashes ──
    for (let i = 0; i < 12; i++) {
        const burstT = t * 3 + i * 2.1;
        const fy = ((burstT * 30 + i * 25) % fallsHeight);
        const progress = fy / fallsHeight;
        const bx = fallsX + Math.sin(burstT * 1.5 + i) * (fallsWidth * 0.4);
        const bw = 3 + Math.sin(burstT * 2) * 2;
        const bh = 5 + progress * 7;
        const alpha = 0.4 + 0.2 * Math.sin(burstT * 3);
        ctx.fillStyle = `rgba(0, 240, 255, ${alpha})`;
        ctx.fillRect(bx - bw / 2, fallsCrestY + fy, bw, bh);
    }

    // ── Dark blue depth shadows — add depth to the curtain ──
    for (let i = 0; i < 4; i++) {
        const sx = fallsX + (i - 1.5) * 12;
        const alpha = 0.2 + 0.1 * Math.sin(t * 1.5 + i);
        ctx.fillStyle = `rgba(10, 40, 100, ${alpha})`;
        ctx.fillRect(sx - 3, fallsCrestY + 5, 6, fallsHeight - 10);
    }

    // ── Crest foam — white and aqua churning at the lip ──
    for (let i = 0; i < 20; i++) {
        const cx = fallsX + (Math.sin(t * 1.2 + i * 0.32) * fallsWidth * 0.6);
        const cy = fallsCrestY + Math.sin(t * 3 + i * 0.8) * 3;
        const r = 2.5 + Math.sin(t * 4 + i * 1.2) * 2;
        const isWhite = i % 3 === 0;
        const col = isWhite ? '255, 255, 255' : '0, 230, 200';
        ctx.fillStyle = `rgba(${col}, ${0.45 + Math.sin(t * 3 + i) * 0.15})`;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
    }
    // Crest rushing line — white foam
    ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + Math.sin(t * 2) * 0.1})`;
    ctx.fillRect(fallsX - fallsWidth / 2 - 4, fallsCrestY - 1, fallsWidth + 8, 3);

    // ── Massive splash / churn pool at base — multi-color ──
    for (let i = 0; i < 24; i++) {
        const angle = t * 3.0 + i * 0.27;
        const spread = 20 + Math.sin(angle * 2) * 12;
        const sx = fallsX + Math.cos(angle) * spread;
        const sy = fallsBaseY + Math.sin(angle * 2.5) * 5 - 4;
        const r = 3.5 + Math.sin(angle * 3) * 2.5;
        const colIdx = i % 4;
        const splashCol = colIdx === 0 ? '255,255,255' : colIdx === 1 ? '0,220,240' : colIdx === 2 ? '30,160,120' : '20,60,140';
        const alpha = 0.4 + Math.sin(angle * 1.5) * 0.2;
        ctx.fillStyle = `rgba(${splashCol}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
    }
    // Wide white foam band at base
    const foamAlpha = 0.35 + Math.sin(t * 2) * 0.12;
    ctx.fillStyle = `rgba(255, 255, 255, ${foamAlpha})`;
    ctx.fillRect(fallsX - 34, fallsBaseY - 5, 68, 10);
    // Secondary foam ripples — aqua and white
    for (let i = 0; i < 6; i++) {
        const rx = fallsX - 28 + i * 10 + Math.sin(t * 2.5 + i) * 3;
        const ry = fallsBaseY + 2 + Math.sin(t * 3 + i * 1.5) * 2;
        ctx.fillStyle = `rgba(180, 255, 255, ${0.2 + Math.sin(t * 2 + i) * 0.1})`;
        ctx.fillRect(rx, ry, 6, 2);
    }
    ctx.restore();

    // ── Light mist rising above the waterfall ──
    if (!state._waterfallMist) state._waterfallMist = [];
    if (Math.random() < 0.15) {
        state._waterfallMist.push({
            x: fallsX + (Math.random() - 0.5) * 30,
            y: fallsCrestY - 10 - Math.random() * 15,
            vx: (Math.random() - 0.5) * 0.3,
            vy: -0.4 - Math.random() * 0.5,
            radius: 5 + Math.random() * 8,
            life: 1.0,
            decay: 0.01 + Math.random() * 0.008
        });
    }
    for (let i = state._waterfallMist.length - 1; i >= 0; i--) {
        const m = state._waterfallMist[i];
        m.x += m.vx;
        m.y += m.vy;
        m.radius += 0.2;
        m.life -= m.decay;
        if (m.life <= 0 || m.radius <= 0) {
            state._waterfallMist.splice(i, 1);
            continue;
        }
        ctx.fillStyle = `rgba(200, 230, 255, ${m.life * 0.18})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    for (const d of state.defenses) {
        try {
            if (d.hp <= 0 && d.type !== 'tower') {
                const img = ASSETS[d.fileDestroyed];
                if (img?.complete && img.naturalWidth > 0) {
                    // Sir Adam Beck destroyed: full opacity, scale 1.25x, sunk into gorge
                    if (d.id === 1) {
                        ctx.globalAlpha = 1.0;
                        const ruinScale = 1.25;
                        const gorgeOffset = 20;
                        const dw = d.w * ruinScale;
                        const dh = d.h * ruinScale;
                        ctx.drawImage(img, d.x - dw / 2, d.y - dh + gorgeOffset, dw, dh);
                    } else {
                        ctx.globalAlpha = 0.5;
                        ctx.drawImage(img, d.x - d.w / 2, d.y - d.h, d.w, d.h);
                    }
                    ctx.globalAlpha = 1;
                }
                continue;
            }

            // ── Welland Canal Lift Bridge — state-machine driven composite ──
            if (d.isLiftBridge && d.hp > 0) {
                const c = state.canal;
                const deckRaise = c.deckRaise;
                const maxRaise = d.h * 0.50;
                const deckT = maxRaise > 0 ? deckRaise / maxRaise : 0;

                // ── Canal warning light: orange strobe = raising/raised, red blink = fully seated ──
                const canalLight = document.getElementById('canal-light');
                if (canalLight) {
                    canalLight.className = 'aircraft-light ' +
                        (deckT < 0.08 ? 'canal-light-red' : 'canal-light-orange');
                }

                const towersImg = ASSETS[d.fileTowers];
                const deckImg   = ASSETS[d.fileDeck];
                const sx = d.x - d.w / 2;
                const sy = d.y - d.h;

                // 1. Draw deck FIRST (behind towers)
                if (deckImg?.complete && deckImg.naturalWidth > 0) {
                    ctx.drawImage(deckImg, sx, sy - deckRaise, d.w, d.h);
                }

                // 2. Draw vertical lift cables
                const cableAlpha = (1 - deckT) * 0.85;
                if (cableAlpha > 0.02) {
                    ctx.save();
                    ctx.globalAlpha = cableAlpha;
                    ctx.strokeStyle = '#1a1a1a';
                    ctx.lineWidth = 1.2;
                    const leftPulleyX  = sx + d.w * 0.24;
                    const leftPulleyY  = sy + d.h * 0.19;
                    const leftAttachY  = sy + d.h * 0.554 - deckRaise;
                    const rightPulleyX = sx + d.w * 0.76;
                    const rightPulleyY = sy + d.h * 0.19;
                    const rightAttachY = sy + d.h * 0.554 - deckRaise;
                    ctx.beginPath();
                    ctx.moveTo(leftPulleyX,  leftPulleyY);
                    ctx.lineTo(leftPulleyX,  leftAttachY);
                    ctx.moveTo(rightPulleyX, rightPulleyY);
                    ctx.lineTo(rightPulleyX, rightAttachY);
                    ctx.stroke();
                    ctx.restore();
                }

                // 3. Draw freighter ship sprite
                if (c.shipPhase !== 'hidden' && c.shipType) {
                    const horizonY = (d.y - d.h) + (d.h * 0.554);
                    // Look up fleet group dimensions for this ship
                    const fleetGroup = Object.values(FREIGHTER_FLEET).find(g => g.files.includes(c.shipType));
                    const baseW = fleetGroup ? fleetGroup.w : 55;
                    const baseH = fleetGroup ? fleetGroup.h : 65;
                    const shipW = baseW * c.shipScale;
                    const shipH = baseH * c.shipScale;
                    const shipX = d.x - (shipW / 2);
                    const shipImg = FREIGHTER_SPRITES[c.shipType];

                    ctx.save();
                    try {
                        if (c.shipPhase === 'emerging') {
                            ctx.beginPath();
                            ctx.rect(0, 0, COORD_SYSTEM.width, horizonY);
                            ctx.clip();
                        }

                        // Hull silhouette glow (drop-shadow effect)
                        ctx.shadowColor = 'rgba(180, 220, 255, 0.6)';
                        ctx.shadowBlur = 10 * c.shipScale;
                        ctx.shadowOffsetX = 0;
                        ctx.shadowOffsetY = 0;

                        if (shipImg?.complete && shipImg.naturalWidth > 0) {
                            ctx.drawImage(shipImg, shipX, c.shipY, shipW, shipH);
                        } else {
                            // Fallback: simple hull shape if image not loaded
                            ctx.fillStyle = '#881111';
                            ctx.fillRect(shipX, c.shipY, shipW, shipH);
                        }

                        // Water displacement wake (bow spray during approaching phase)
                        if (c.shipPhase === 'approaching') {
                            ctx.shadowColor = 'transparent';
                            ctx.shadowBlur = 0;
                            const bowY = c.shipY + shipH;
                            const bowX = d.x;
                            for (let wp = 0; wp < 3; wp++) {
                                const spread = (Math.random() - 0.5) * shipW * 0.8;
                                const wakeAlpha = 0.3 + Math.random() * 0.3;
                                const wakeR = 2 + Math.random() * 3 * c.shipScale;
                                ctx.fillStyle = Math.random() > 0.4
                                    ? `rgba(255, 255, 255, ${wakeAlpha})`
                                    : `rgba(140, 180, 255, ${wakeAlpha})`;
                                ctx.beginPath();
                                ctx.arc(bowX + spread, bowY + Math.random() * 6, wakeR, 0, Math.PI * 2);
                                ctx.fill();
                            }
                            // Push persistent wake particles into environmentalParticles
                            if (Math.random() < 0.5) {
                                state.environmentalParticles.push({
                                    x: bowX + (Math.random() - 0.5) * shipW * 0.6,
                                    y: bowY,
                                    vx: (Math.random() - 0.5) * 1.5,
                                    vy: 0.5 + Math.random() * 1.0,
                                    radius: 2 + Math.random() * 3,
                                    color: Math.random() > 0.4
                                        ? 'rgba(255,255,255,0.5)'
                                        : 'rgba(140,180,255,0.4)',
                                    life: 1.0, decay: 0.03 + Math.random() * 0.02, type: 'wake'
                                });
                            }
                        }
                    } finally {
                        ctx.restore();
                    }
                }

                // 4. Draw towers on top (stationary foreground layer)
                if (towersImg?.complete && towersImg.naturalWidth > 0) {
                    ctx.drawImage(towersImg, sx, sy, d.w, d.h);
                }

                // 5. Idle crew member on bridge deck (rides with lift, waves at ships)
                if (!d.destroyed) {
                    ctx.save();
                    const deckY = sy + d.h * 0.554 - c.deckRaise;
                    const crewX = d.x + 8;

                    // Tiny figure in orange vest standing on deck
                    ctx.fillStyle = '#FF6600';
                    ctx.fillRect(crewX - 1.5, deckY - 7, 3, 4); // torso
                    ctx.fillStyle = '#1a1a1a';
                    ctx.beginPath();
                    ctx.arc(crewX, deckY - 9, 1.5, 0, Math.PI * 2); // head
                    ctx.fill();
                    ctx.fillStyle = '#333';
                    ctx.fillRect(crewX - 1.5, deckY - 3, 1.5, 3); // left leg
                    ctx.fillRect(crewX, deckY - 3, 1.5, 3);        // right leg

                    // Waving arm (3s cycle)
                    const wave = Math.sin(Date.now() / 500) * 0.5;
                    ctx.strokeStyle = '#1a1a1a';
                    ctx.lineWidth = 0.7;
                    ctx.beginPath();
                    ctx.moveTo(crewX + 1.5, deckY - 6);
                    ctx.lineTo(crewX + 4, deckY - 9 + wave * 3);
                    ctx.stroke();

                    ctx.restore();
                }

                continue;   // skip the generic intact draw below
            }

            if (d.type === 'tower') {
                const tower = d;
                const towerImg = state.towerDisabled ? ASSETS[tower.fileDestroyed] : ASSETS[tower.fileIntact];
                if (towerImg?.complete && towerImg.naturalWidth > 0) {
                    // Use matched sizing so destroyed sprite aligns bottom with intact
                    const drawSize = state.towerDisabled
                        ? matchedDrawSize(ASSETS[tower.fileDestroyed], ASSETS[tower.fileIntact], tower.w, tower.h)
                        : { w: tower.w, h: tower.h };
                    ctx.drawImage(towerImg, tower.x - drawSize.w / 2, tower.y - drawSize.h, drawSize.w, drawSize.h);
                } else {
                    ctx.fillStyle = state.towerDisabled ? '#333' : '#ffd700';
                    ctx.fillRect(tower.x - 15, tower.y - 80, 30, 80);
                }

                // Aviation beacons — apex and midway, strobe via sin wave
                if (!state.towerDisabled) {
                    const beaconAlpha = 0.55 + Math.sin(Date.now() / 200) * 0.45;
                    ctx.save();
                    ctx.globalAlpha = beaconAlpha;
                    ctx.fillStyle = '#ff2200';
                    ctx.shadowColor = '#ff2200';
                    ctx.shadowBlur = 12;
                    // Apex beacon
                    ctx.beginPath();
                    ctx.arc(tower.x, tower.y - tower.h, 4, 0, Math.PI * 2);
                    ctx.fill();
                    // Midway beacon
                    ctx.beginPath();
                    ctx.arc(tower.x, tower.y - tower.h / 2, 4, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }

                if (!state.towerDisabled) drawShield(ctx, tower);
                continue;
            }

            const img = ASSETS[d.fileIntact];
            if (img?.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, d.x - d.w / 2, d.y - d.h, d.w, d.h);

                // Sir Adam Beck intact: High-voltage transformer yard thrum
                // Sir Adam Beck — Twin yellow electrical sparks between tower structures
                if (d.id === 1 && !d.destroyed) {
                    ctx.save();
                    const time = Date.now();

                    // Tower positions — centered on the dark tower structures
                    const leftTowerX  = d.x + d.w * 0.30;
                    const rightTowerX = d.x + d.w * 0.44;
                    const towerTopY   = d.y - d.h * 0.62;
                    const towerMidX   = (leftTowerX + rightTowerX) / 2;
                    const span = rightTowerX - leftTowerX;

                    // Helper: draw one jagged bolt between two X points
                    function drawBolt(seedOffset, flickerSpeed1, flickerSpeed2, blackoutSpeed) {
                        const flicker = (Math.sin(time / flickerSpeed1) + Math.cos(time / flickerSpeed2) + 2) / 4;
                        const visible = Math.sin(time / blackoutSpeed) > -0.3;
                        if (!visible || flicker < 0.15) return;

                        ctx.shadowColor = '#FFD700';
                        ctx.shadowBlur = 12 + flicker * 8;

                        // Gold bolt path
                        ctx.strokeStyle = `rgba(255, 215, 0, ${0.6 + flicker * 0.4})`;
                        ctx.lineWidth = 1.5 + flicker;
                        ctx.beginPath();
                        ctx.moveTo(leftTowerX, towerTopY);

                        const seed = Math.floor(time / 200) + seedOffset;
                        const segments = 5;
                        for (let i = 1; i < segments; i++) {
                            const t = i / segments;
                            const jx = leftTowerX + span * t + (((seed * i * 7) % 11) - 5) * 1.2;
                            const jy = towerTopY + (((seed * i * 13) % 15) - 7) * 1.5;
                            ctx.lineTo(jx, jy);
                        }
                        ctx.lineTo(rightTowerX, towerTopY);
                        ctx.stroke();

                        // White-hot core
                        ctx.strokeStyle = `rgba(255, 255, 255, ${flicker * 0.7})`;
                        ctx.lineWidth = 0.8;
                        ctx.stroke();

                        // Occasional downward fork
                        if (((seed * 3) % 7) < 2) {
                            ctx.strokeStyle = `rgba(255, 215, 0, ${0.4 + flicker * 0.3})`;
                            ctx.lineWidth = 1.0;
                            ctx.beginPath();
                            ctx.moveTo(towerMidX, towerTopY);
                            ctx.lineTo(towerMidX + (((seed * 11) % 13) - 6) * 1.5,
                                       towerTopY + 8 + (((seed * 17) % 7) * 2));
                            ctx.stroke();
                        }
                    }

                    // Bolt 1: faster flicker
                    drawBolt(0, 25, 14, 65);
                    // Bolt 2: slower flicker, offset timing
                    drawBolt(9999, 40, 23, 90);

                    ctx.restore();
                }

                // Yellow Bug elevator on Skylon Tower (d.id === 2)
                if (d.id === 2) {
                    const bugImg = ASSETS['Yellow_Bug'];
                    if (bugImg?.complete && bugImg.naturalWidth > 0) {
                        ctx.save();

                        const bugW = 9;
                        const bugH = 18;

                        // Clipping boundaries (under dome to above base platform)
                        const topOrangeY = d.y - d.h * 0.66;
                        const bottomOrangeY = d.y - d.h * 0.11;

                        // Clip so bug disappears into dome and base
                        ctx.beginPath();
                        ctx.rect(d.x - d.w / 2, topOrangeY, d.w, bottomOrangeY - topOrangeY);
                        ctx.clip();

                        // Smooth sine-wave travel: 8s full round trip
                        const cycle = (Date.now() % 8000) / 8000;
                        const travelPhase = (Math.cos(cycle * Math.PI * 2) + 1) / 2;

                        // Push limits past clip edges so it fully disappears
                        const highestPoint = topOrangeY - bugH;
                        const lowestPoint = bottomOrangeY + bugH;
                        const currentY = highestPoint + (lowestPoint - highestPoint) * travelPhase;

                        ctx.drawImage(bugImg, d.x - (bugW / 2), currentY, bugW, bugH);
                        ctx.restore();
                    }
                }
            } else {
                ctx.fillStyle = '#4488cc';
                ctx.fillRect(d.x - 30, d.y - 60, 60, 60);
            }
        } catch (e) {
            console.error('Defense render failed:', e);
        }
    }

    // Hide aircraft warning lights when their zone is destroyed
    const skylonZone = state.defenses.find(d => d.id === 2);
    const canalZone  = state.defenses.find(d => d.id === 3);
    const skylonLight = document.getElementById('skylon-light');
    const canalLight  = document.getElementById('canal-light');
    if (skylonLight) skylonLight.style.display = (skylonZone && skylonZone.destroyed) ? 'none' : '';
    if (canalLight)  canalLight.style.display  = (canalZone && canalZone.destroyed)  ? 'none' : '';

    // Draw Aftermath VFX (fire, smoke, electricity)
    drawAftermathVFX(ctx);

    // ==========================================
    // DRAW AMBULANCE (NanoMedic 2.5D Integration)
    // ==========================================
    if (state.ambulance) {
        const ambImg = ASSETS['NanoMedic'];
        const amb = state.ambulance;
        const now = Date.now();

        if (ambImg?.complete && ambImg.naturalWidth > 0) {
            ctx.save();

            const w = 100;
            const h = Math.floor(w * (ambImg.naturalHeight / ambImg.naturalWidth));

            ctx.translate(amb.x, amb.y + 10);

            // --- 1. THRUSTER (left/rear edge, phase-driven) — drawn first (behind hull) ---
            if (amb.phase !== 'repairing') {
                let thrustMultiplier = 1.0;
                if (amb.phase === 'departing') {
                    const elapsed = now - amb.phaseStartTime;
                    thrustMultiplier = elapsed < 500 ? 2.5 : Math.max(1.0, 2.5 - (elapsed - 500) / 400);
                }

                const thrusterX = -w / 2;
                const thrusterY = 0;
                const layerCount = 6;
                for (let i = 0; i < layerCount; i++) {
                    const seed = now / 60 + i * 1.3;
                    const flicker = 0.6 + 0.4 * Math.sin(seed);
                    const radius = (18 + i * 7) * flicker * thrustMultiplier;
                    const alpha = (0.55 - i * 0.07) * flicker * Math.min(thrustMultiplier, 1.5);
                    const colors = ['#fff9c4','#ffdd00','#ff8800','#ff4400','#cc2200','#440000'];
                    const grad = ctx.createRadialGradient(thrusterX, thrusterY, 0, thrusterX, thrusterY, radius);
                    grad.addColorStop(0, `rgba(255,255,220,${alpha})`);
                    grad.addColorStop(0.4, `${colors[i]}${Math.floor(alpha * 180).toString(16).padStart(2,'0')}`);
                    grad.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.ellipse(thrusterX - i * 4, thrusterY, radius * 0.55, radius * 0.28, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // --- 2. SHIP SPRITE (clean cropped PNG — standard compositing) ---
            ctx.drawImage(ambImg, -w/2, -h/2, w, h);

            // --- 3. Z-AXIS EMERGENCY LIGHTS (on top of hull) ---
            const lightFlash = Math.floor(now / 250) % 2;
            // Red dome light — top of ship
            const redOn = (lightFlash === 0);
            ctx.shadowColor = '#ff2222';
            ctx.shadowBlur = redOn ? 28 : 6;
            ctx.fillStyle = redOn ? '#ff2222' : '#550000';
            ctx.beginPath();
            ctx.arc(0, -h / 2 + 2, redOn ? 6 : 4, 0, Math.PI * 2);
            ctx.fill();

            // Blue engine glow — bottom of ship
            const blueOn = (lightFlash === 1);
            ctx.shadowColor = '#2266ff';
            ctx.shadowBlur = blueOn ? 28 : 6;
            ctx.fillStyle = blueOn ? '#2266ff' : '#000033';
            ctx.beginPath();
            ctx.arc(0, h / 2 - 2, blueOn ? 6 : 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.restore();
        } else {
            ctx.fillStyle = '#ff3366';
            ctx.fillRect(amb.x - 20, amb.y, 40, 25);
            ctx.fillStyle = '#fff';
            ctx.fillRect(amb.x - 8, amb.y + 5, 16, 15);
            ctx.fillRect(amb.x - 3, amb.y + 2, 6, 21);
        }
    }

    // Draw repair beam — Ground-Contact Transporter Beam
    if (state.beamActive && state.ambulance) {
        const amb = state.ambulance;
        const now = Date.now();

        const beamTop = amb.y + 20;                    // Starts just below ship hull
        const beamBottom = COORD_SYSTEM.height - 40;   // Terminates at land baseline
        const beamWidth = 40;                          // Width at ground contact
        const flicker = Math.random() * 0.2 + 0.1;    // 80s "interference" flicker

        ctx.save();

        // 1. Base Layer: Tapered translucent cyan cone (narrow at ship, wide at ground)
        const beamGrad = ctx.createLinearGradient(0, beamTop, 0, beamBottom);
        beamGrad.addColorStop(0, `rgba(0, 255, 255, ${0.4 + flicker})`);   // Cyan glow at ship
        beamGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');                // Fade into ground

        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(amb.x - 5, beamTop);                // Narrow at ship
        ctx.lineTo(amb.x + 5, beamTop);
        ctx.lineTo(amb.x + beamWidth / 2, beamBottom); // Wide at ground
        ctx.lineTo(amb.x - beamWidth / 2, beamBottom);
        ctx.closePath();
        ctx.fill();

        // 2. Thin "laser" side-rails for extra 80s structural detail
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + flicker})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // 3. Swirl Layer: Animated green dashes flowing down the beam
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(0, 255, 68, ${0.4 + flicker})`;
        ctx.shadowColor = '#00ff44';
        ctx.shadowBlur = 8;
        ctx.setLineDash([12, 18]);
        ctx.lineDashOffset = -(now / 18) % 30; // Flow downward

        // Left rail
        ctx.beginPath();
        ctx.moveTo(amb.x - 5, beamTop);
        ctx.lineTo(amb.x - beamWidth / 2, beamBottom);
        ctx.stroke();

        // Center rail
        ctx.beginPath();
        ctx.moveTo(amb.x, beamTop);
        ctx.lineTo(amb.x, beamBottom);
        ctx.stroke();

        // Right rail
        ctx.beginPath();
        ctx.moveTo(amb.x + 5, beamTop);
        ctx.lineTo(amb.x + beamWidth / 2, beamBottom);
        ctx.stroke();

        ctx.restore();
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

    // Restore canvas transform (undo virtual-coordinate scale)
    ctx.restore();
}

function drawAsteroid(ctx, a) {
    ctx.save();
    ctx.translate(a.x, a.y);

    // Holodeck selection highlight ring
    if (CONFIG.isHolodeck && state.holodeckSelectedAsteroid === a.id) {
        const pulse = 0.6 + Math.sin(Date.now() / 150) * 0.4;
        ctx.strokeStyle = `rgba(255, 215, 0, ${pulse})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 20;
        ctx.setLineDash([6, 4]);
        ctx.lineDashOffset = -(Date.now() / 40) % 10;
        ctx.beginPath();
        ctx.arc(0, 0, a.radius * 2.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
    }

    const sprite = ASTEROID_SPRITES[a.spriteIndex];
    const size = a.radius * 4;
    const colors = getAsteroidColors(a);


    // ── Sprite + glow rotate; unit ID and challenge text stay upright ──
    ctx.save();
    ctx.rotate(a.rotation);

    // PNG silhouette glow: drop-shadow follows actual PNG shape, not bounding box
    if (sprite?.complete && sprite.naturalWidth > 0) {
        const glowIntensity = 15 + Math.sin(Date.now() / 200) * 8;
        ctx.filter = `drop-shadow(0 0 ${glowIntensity * a.glow}px ${colors.glow})`;

        ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
        ctx.filter = 'none';
    } else {
        ctx.shadowColor = colors.glow;
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
    ctx.restore(); // end rotation — text elements below stay upright

    // Unit ID label — stays upright (no rotation)
    ctx.fillStyle = '#fff';
    ctx.font = "bold 22px 'Courier New'";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 12 + Math.sin(Date.now() / 300) * 5;
    ctx.fillText(a.unitID, 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore(); // end translate

    // Challenge text — stays upright, positioned above asteroid via tether physics
    drawBubble(ctx, a);
}

function drawBubble(ctx, a) {
    const text = a.challenge;
    ctx.font = "bold 18px 'Courier New'";
    const tw = ctx.measureText(text).width;
    const pad = 10, w = tw + pad * 2, h = 32;

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
    if (x + w > COORD_SYSTEM.width - 4) x = COORD_SYSTEM.width - w - 4;

    // Get asteroid-specific colors
    const colors = getAsteroidColors(a);

    // Soft tactical green base (CAD-safe, no blue)
    ctx.fillStyle = 'rgba(15, 30, 15, 0.88)';
    ctx.fillRect(x, y, w, h);
    
    // Overlay asteroid's color tint
    ctx.fillStyle = colors.bg;
    ctx.fillRect(x, y, w, h);

    // Border style based on type (direction = solid, radio = jagged)
    if (a.type === 'direction') {
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 2;
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = 8;
        ctx.strokeRect(x, y, w, h);
    } else {
        drawJagged(ctx, x, y, w, h, colors.accent, colors.glow);
    }

    ctx.shadowBlur = 0;
    ctx.fillStyle = colors.accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);
}

function drawJagged(ctx, x, y, w, h, strokeColor, glowColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.shadowColor = glowColor;
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

function pauseGame() {
    if (!state.running || state.paused) return;
    state.paused = true;
    state.running = false;
    if (DOM.input) DOM.input.blur();
    DOM.pauseOverlay.classList.remove('hidden');
}

function resumeGame() {
    if (!state.paused) return;
    state.paused = false;
    state.running = true;
    DOM.pauseOverlay.classList.add('hidden');
    DOM.input.focus();
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function startGame(holodeck = false) {
    // Block start if holodeck menu just appeared (prevents Enter from password
    // submission propagating through menu-nav and clicking ENTER HOLODECK)
    if (state._holodeckMenuShownAt && Date.now() - state._holodeckMenuShownAt < 400) return;
    if (state.ambulancePendingTimer) { clearTimeout(state.ambulancePendingTimer); state.ambulancePendingTimer = null; }
    clearTimeout(state.timers.gameOverDelay);
    Object.assign(state, {
        running: true, score: 0, shieldHP: 9, towerExposed: false, repairCount: 0,
        cracks: [], ricochetProjectiles: [], streak: 0, streakSinceShieldHit: 0,
        // ── New scoring state (scoring.csv v2) ──
        perfectStreak: 0, perfectMilestonesHit: [],
        consecutiveBasesDestroyed: 0,
        comebackCounter: 0, comebackAwarded: false,
        firstBloodAwarded: false,
        rankScoreAccum: 0, lastCalibrationAt: 0,
        // ── End new scoring state ──
        tier: 'trainee',
        speedMult: TIERS.trainee ? TIERS.trainee.speedMax : 0.8,
        spawnInterval: TIERS.trainee ? TIERS.trainee.spawnMin : 5000,
        maxTargets: TIERS.trainee ? TIERS.trainee.maxTargets : 6,
        asteroids: [], projectiles: [], brokenProjectiles: [], explosions: [],
        towerDisabled: false, rebuilding: false, ambulance: null, ambulanceDestroyCount: 0,
        beamActive: false, gameOverPending: false,
        backspaces: 0, cleanHits: 0, environmentalParticles: [],
        timers: { spawnTimer: TIERS.trainee ? TIERS.trainee.spawnMin : 5000 }, // Start ready to spawn first asteroid
        spawnHistory: [],                            // Zone spread tracking (16-zone system)
        bridgeStartTime: Date.now(),                 // Bridge starts lowered, raises after 10 s
        holodeckSelectedAsteroid: null,              // Right-click redirect selection
        skylonBugs: [],                              // Ejected Yellow Bugs (permanent debris)
        canalCrew: [],                               // Abandon Ship life rafts (drift off-screen)
        beckWorkers: [],                             // Hydro workers getting zapped (looping)
        flourWorkers: [],                            // Robin Hood flour employees (scurrying)
        flourGround: [],                             // Flour snow ground patches
        flourIce: { active: false, progress: 0, patches: [] },  // Ice-over effect on water
            canal: { bridgePhase: 'idle', timer: 0, deckRaise: 0, shipPhase: 'hidden', shipY: 0, shipScale: 0.2, shipType: null, crashPhase: 'none', crashShipType: null, crashShipY: 0, crashShipScale: 0.2, crashShipTilt: 0 }
    });
    state.usedChallenges.clear();

    // Apply initial tier settings via setTier (bridges config.js ↔ progression.csv)
    setTier('trainee');

    CONFIG.isHolodeck = holodeck;

    initDefenses();
    updateLightPositions();
    clearHolodeck();
    hideBeta();

    updateHUD();
    AudioManager.disableMusicStatic();
    AudioManager.stopMusic();
    if (!holodeck) {
        AudioManager.startPlaylist([
            'music/Asteroid Command - Game Play 1.mp3',
            'music/Asteroid Command - Game Play 2.mp3',
            'music/Asteroid Command - Game Play 3.mp3'
        ], 0.5);
    }
    DOM.startOverlay.classList.add('hidden');
    DOM.gameOverOverlay.classList.add('hidden');
    DOM.gameOverOverlay.classList.remove('game-over-bg');
    DOM.input.focus();

    if (holodeck) triggerHolodeck(CONFIG.isBeta);
    if (CONFIG.isBeta) showBeta();

    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

// Schedule game over with a 10-second delay so the player can watch the aftermath
function scheduleGameOver() {
    if (state.gameOverPending) return; // Don't schedule twice
    state.gameOverPending = true;
    showStatus("ALL ZONES LOST — REGION FALLING...", "impact");
    state.timers.gameOverDelay = setTimeout(() => {
        gameOver();
    }, 10000); // 10 seconds
}

function gameOver() {
    AudioManager.disableMusicStatic();
    AudioManager.stopMusic();
    AudioManager.play('gameOver');
    state.running = false;
    state.gameOverPending = false;
    clearTimeout(state.timers.gameOverDelay);
    DOM.finalScore.textContent = state.score;

    // Check if the player's score qualifies for the top 10
    let existingScores = [];
    try {
        const raw = localStorage.getItem('asteroid-command-scores');
        existingScores = raw ? JSON.parse(raw).slice(0, 10) : [];
    } catch { /* empty */ }
    const isTop10 = existingScores.length < 10 || state.score > (existingScores[existingScores.length - 1]?.score || 0);
    if (isTop10 && state.score > 0) {
        AudioManager.playMusic('music/Asteroid Command - High Score.mp3', {
            loop: true,
            volume: 0.5
        });
    } else {
        AudioManager.playMusic('music/Asteroid Command - Region Lost.mp3', {
            loop: true,
            volume: 0.5
        });
    }

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
    // Reset submit score button for this game
    const submitBtn = document.getElementById('submit-score-btn');
    const submitStatus = document.getElementById('score-submit-status');
    if (submitBtn) submitBtn.disabled = false;
    if (submitStatus) { submitStatus.textContent = ''; submitStatus.className = 'dataset-status'; }
    // Blur command input so arrow keys work for menu navigation
    if (DOM.input) DOM.input.blur();
    DOM.gameOverOverlay.classList.add('game-over-bg');
    DOM.gameOverOverlay.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
    // Boot sequence uses its own full-screen canvas overlay
    const bootOverlay = document.getElementById('boot-overlay');
    const canvas = document.getElementById('boot-canvas');
    const powerSwitch = document.getElementById('power-switch');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // Immediately paint black so nothing else shows through
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ── Title screen music — starts when the title screen PNG is revealed ──
    function startTitleScreenMusic() {
        AudioManager.playMusic('music/Asteroid Command - Title Screen.mp3', {
            loop: false,
            volume: 0.5,
            onEnded() {
                if (typeof window._dismissTitleScreen === 'function') {
                    window._dismissTitleScreen();
                }
            }
        });
    }

    // ── Commodore PET Boot Sequence ──
    // Phase 1: Clean green PET text prints line by line
    // Phase 2: Full-screen multicolored chaos/corruption flood
    // Phase 3: Flash → Title screen
    const BOOT_LINES = [
        '*** NIAGARA DEFENSE SYSTEM V2.0 ***',
        '',
        '64K RAM SYSTEM  38911 BASIC BYTES FREE',
        '',
        'POWERLINE TELEMETRY LINK . . . OK',
        'SYS 49152: LOADING DISPATCH MATRIX',
        'SYS 49408: UNIT ROSTER . . . 54 UNITS LOADED',
        'SYS 49664: BASE CODES . . . 21 LOCATIONS MAPPED',
        'SYS 49920: ACTION TABLE . . . 4 COMMAND TYPES',
        'INIT ASTEROID TRACKING ARRAY . . . OK',
        'CALIBRATING SHIELD GENERATOR [9/9 HP] . . . OK',
        'DEFENSE GRID ONLINE: 4 ZONES + COMMAND TOWER',
        'LINKING COMMAND FREQUENCIES . . . OK',
        'SCORING ENGINE V2 LOADED FROM TELEMETRY',
        'RANK PROGRESSION: 8 TIERS [TRAINEE -> O.A.S]',
        'SPAWN CONTROLLER INITIALIZED',
        'TETHER PHYSICS ENGINE . . . NOMINAL',
        'NANOMEDIC REPAIR PROTOCOL . . . STANDING BY',
        'WELLAND CANAL BRIDGE CONTROLLER . . . OK',
        'FREIGHTER FLEET: 13 SPRITES / 5 CLASSES',
    ];
    const FONT_SIZE = Math.max(12, Math.min(16, Math.floor(canvas.height / 45)));
    const LINE_HEIGHT = FONT_SIZE + 4;
    const LEFT_PAD = 20;
    const START_Y = 20;
    const GREEN = '#33ff33';
    const DIM_GREEN = '#22cc22';
    // Shapes and special characters for chaos flood (matching the reference image)
    const CORRUPT_CHARS = '░▒▓█▀▄▌▐■□▪▫▬▲►▼◄◊○●◘◙♠♣♥♦☼☺☻♪♫≡±≥≤¬½¼«»┤╣║╗╝┐└┴┬├─┼╚╔╩╦╠═╬┘┌';
    const CORRUPT_COLORS = [
        '#ff0000', '#ff3300', '#ff6600', '#ff9900', '#ffcc00', '#ffff00',
        '#00ff00', '#33ff33', '#00ff66', '#00ffcc', '#66ff66',
        '#00ccff', '#0088ff', '#3333ff', '#6600ff', '#0044cc',
        '#ff00ff', '#ff33cc', '#cc00ff', '#ff66ff',
        '#ffffff', '#cccccc', '#ff4444', '#44ff44', '#4444ff',
        '#ff8800', '#88ff00', '#00ffaa', '#aa00ff', '#ffaacc',
        '#884400', '#448844', '#444488', '#cc8800',
    ];

    let bootLines = [];
    let bootIndex = 0;
    let corruptPhase = false;
    let corruptFrame = 0;
    let dataReady = false;
    let bootDone = false;
    let crtFlicker = false;   // subtle CRT flicker while the boot text loads

    // ── Gesture-First Architecture ──
    // Browsers block audio autoplay without a user gesture. We collect the gesture
    // BEFORE the boot sequence starts, so AudioContext is unlocked for the entire
    // session. When corruption ends, title screen + music fire simultaneously.
    let audioGestureCollected = false;

    // The load screen's opening lines — shown "paused" during warm-up, then the
    // rest of BOOT_LINES prints on top of them.
    const HEADER_LINES = [
        BOOT_LINES[0],  // *** NIAGARA DEFENSE SYSTEM V2.0 ***
        BOOT_LINES[1],  // (blank)
        BOOT_LINES[2],  // 64K RAM SYSTEM  38911 BASIC BYTES FREE
        BOOT_LINES[3],  // (blank)
    ];

    // Pre-power-on: the screen is black and only the POWER switch is shown.
    function showInitPrompt() {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        powerSwitch.classList.remove('hidden');

        function onInitGesture(e) {
            if (audioGestureCollected) return;
            // Don't consume modifier combos (Ctrl+Shift+B for dev mode, etc.)
            if (e && e.type === 'keydown' && (e.ctrlKey || e.metaKey || e.altKey)) return;
            audioGestureCollected = true;
            document.removeEventListener('keydown', onInitGesture);
            document.removeEventListener('click', onInitGesture);
            document.removeEventListener('touchstart', onInitGesture);

            // Flip the switch off-screen and unlock AudioContext for the session.
            powerSwitch.classList.add('hidden');
            AudioManager.init();

            // The tube slowly flickers to light (warm-up) revealing the paused load
            // screen; once it's fully on, the load runs with the screen flickering.
            powerOnWarmup(() => {
                crtFlicker = true;
                bootRenderLoop();
                typeNextLine();
            });
        }

        document.addEventListener('keydown', onInitGesture);
        document.addEventListener('click', onInitGesture);
        document.addEventListener('touchstart', onInitGesture);
    }

    // ── CRT warm-up / flicker helpers ──

    // Random static "fuzz" specks scattered across the screen (0 = none).
    function drawStatic(amount) {
        if (amount <= 0) return;
        const count = Math.floor(amount * canvas.width * canvas.height / 1000);
        for (let i = 0; i < count; i++) {
            const g = 40 + Math.floor(Math.random() * 180);
            ctx.fillStyle = `rgba(${g},${g},${g},${(Math.random() * amount).toFixed(3)})`;
            ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height,
                         Math.random() < 0.85 ? 1 : 2, 1);
        }
    }

    // Darken the whole screen to simulate reduced brightness (1 = full brightness).
    function applyBrightness(level) {
        if (level >= 1) return;
        ctx.fillStyle = `rgba(0,0,0,${Math.max(0, 1 - level).toFixed(3)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Subtle ongoing CRT flicker used while the boot text is loading.
    function applyCrtFlicker() {
        const r = Math.random();
        let dip = 0;
        if (r < 0.06) dip = 0.22 + Math.random() * 0.38;   // stronger, more frequent hard flicker
        else if (r < 0.45) dip = Math.random() * 0.16;      // frequent brightness shimmer
        if (dip > 0) applyBrightness(1 - dip);
        drawStatic(0.07);
    }

    // Old-CRT power-on: brightness slowly blooms in with heavy flicker + static,
    // revealing the paused load screen, then holds a beat before onDone() runs it.
    function powerOnWarmup(onDone) {
        // Load screen is present but paused — its opening lines sit frozen while the
        // tube warms up. Pre-populate them so the type-out continues from here.
        bootLines = HEADER_LINES.slice();
        bootIndex = HEADER_LINES.length;

        const DURATION = 3500;   // slow, moody 60s-style tube warm-up
        let startT = null;

        function drawFrozen() {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.font = `bold ${FONT_SIZE}px Consolas, "Courier New", monospace`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            for (let i = 0; i < bootLines.length; i++) {
                ctx.fillStyle = (i === bootLines.length - 1) ? GREEN : DIM_GREEN;
                ctx.fillText(bootLines[i], LEFT_PAD, START_Y + i * LINE_HEIGHT);
            }
            ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
            for (let sy = 0; sy < canvas.height; sy += 3) ctx.fillRect(0, sy, canvas.width, 1);
        }

        function tick(now) {
            if (startT === null) startT = now;
            const t = Math.min(1, (now - startT) / DURATION);

            drawFrozen();

            // A faint glow appears fast, the tube struggles with hard flickers and
            // stutter-blackouts, then the picture blooms up late — a moody slow strike.
            const glow = 0.08 * Math.min(1, t * 6);                // faint early glow
            let bright = glow + Math.pow(t, 2.4);                   // lingering, late bloom
            bright += (Math.random() - 0.5) * (1 - t) * 1.2;        // heavy flicker, fades out
            if (t < 0.7 && Math.random() < 0.14) bright += 0.55;    // tube "strike" flashes
            if (t < 0.5 && Math.random() < 0.08) bright -= 0.45;    // stutter-blackouts
            applyBrightness(Math.max(0, Math.min(1, bright)));

            // Static fuzz — dense at first, thinning as the screen settles.
            drawStatic((1 - t) * 0.9 + 0.05);

            if (t < 1) {
                requestAnimationFrame(tick);
            } else {
                setTimeout(onDone, 500);   // hold a beat, "waiting", then load
            }
        }
        requestAnimationFrame(tick);
    }

    // Seamless reveal — called at end of corruption. No prompts, no delay.
    function revealTitleScreen() {
        startTitleScreenMusic();
        bootOverlay.style.transition = 'opacity 0.4s ease-out';
        bootOverlay.style.opacity = '0';
        setTimeout(() => {
            bootOverlay.classList.add('hidden');
            bootOverlay.style.opacity = '';
            bootOverlay.style.transition = '';
            bootDone = true;
            if (dataReady) init();
        }, 400);
    }

    // Draw clean PET boot screen
    function drawBoot() {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = `bold ${FONT_SIZE}px Consolas, "Courier New", monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        for (let i = 0; i < bootLines.length; i++) {
            const line = bootLines[i];
            ctx.fillStyle = (i === bootLines.length - 1) ? GREEN : DIM_GREEN;
            ctx.fillText(line, LEFT_PAD, START_Y + i * LINE_HEIGHT);
        }

        // Blinking cursor
        if (bootLines.length > 0) {
            const lastLine = bootLines[bootLines.length - 1];
            const cursorX = LEFT_PAD + ctx.measureText(lastLine).width + 4;
            const cursorY = START_Y + (bootLines.length - 1) * LINE_HEIGHT;
            if (Math.floor(Date.now() / 400) % 2 === 0) {
                ctx.fillStyle = GREEN;
                ctx.fillRect(cursorX, cursorY, FONT_SIZE * 0.6, FONT_SIZE);
            }
        }

        // CRT scanlines
        ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
        for (let sy = 0; sy < canvas.height; sy += 3) {
            ctx.fillRect(0, sy, canvas.width, 1);
        }

        // CRT instability — screen flickers while the characters load
        if (crtFlicker) applyCrtFlicker();
    }

    // Persistent chaos elements — accumulate over frames
    let chaosElements = [];
    let jitterPhase = false;
    let jitterFrame = 0;

    // Draw the PET text with jitter applied to later lines
    function drawBootWithJitter() {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = `bold ${FONT_SIZE}px Consolas, "Courier New", monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        for (let i = 0; i < bootLines.length; i++) {
            let line = bootLines[i];
            let x = LEFT_PAD;
            let y = START_Y + i * LINE_HEIGHT;
            ctx.fillStyle = GREEN;

            // Jitter intensity increases for lines near the end
            if (jitterPhase && i >= 14) {
                const intensity = Math.min(1.0, (jitterFrame / 80) * ((i - 13) / 7));
                x += (Math.random() - 0.5) * intensity * 20;
                y += (Math.random() - 0.5) * intensity * 6;
                // Scramble some characters in the line
                if (intensity > 0.3) {
                    const chars = line.split('');
                    const scrambleCount = Math.floor(chars.length * intensity * 0.4);
                    for (let s = 0; s < scrambleCount; s++) {
                        const pos = Math.floor(Math.random() * chars.length);
                        chars[pos] = CORRUPT_CHARS[Math.floor(Math.random() * CORRUPT_CHARS.length)];
                    }
                    line = chars.join('');
                    ctx.fillStyle = CORRUPT_COLORS[Math.floor(Math.random() * CORRUPT_COLORS.length)];
                }
            }
            ctx.fillText(line, x, y);
        }

        // CRT scanlines
        ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
        for (let sy = 0; sy < canvas.height; sy += 3) {
            ctx.fillRect(0, sy, canvas.width, 1);
        }
    }

    // Draw chaos elements ON TOP of the jittering PET text
    function drawCorruption() {
        // First draw the jittering boot text as the base
        drawBootWithJitter();

        const progress = corruptFrame / 240;

        // Add new chaos elements each frame — small shapes like the reference
        const newPerFrame = Math.floor(5 + progress * 25);
        for (let i = 0; i < newPerFrame; i++) {
            const color = CORRUPT_COLORS[Math.floor(Math.random() * CORRUPT_COLORS.length)];
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const type = Math.random();

            if (type < 0.4) {
                // Block character — small
                const size = 6 + Math.random() * 14;
                chaosElements.push({ kind: 'char', x, y, color, size,
                    ch: CORRUPT_CHARS[Math.floor(Math.random() * CORRUPT_CHARS.length)] });
            } else if (type < 0.7) {
                // Small rectangle
                const w = 3 + Math.random() * 30;
                const h = 3 + Math.random() * 20;
                chaosElements.push({ kind: 'rect', x, y, w, h, color });
            } else if (type < 0.85) {
                // Small triangle / arrow
                const size = 4 + Math.random() * 12;
                chaosElements.push({ kind: 'tri', x, y, size, color,
                    dir: Math.floor(Math.random() * 4) });
            } else if (type < 0.93) {
                // Small circle / dot
                const r = 2 + Math.random() * 8;
                chaosElements.push({ kind: 'circle', x, y, r, color,
                    filled: Math.random() > 0.3 });
            } else {
                // Small smiley face
                const size = 6 + Math.random() * 12;
                chaosElements.push({ kind: 'smiley', x, y, size, color });
            }
        }

        // Draw all accumulated chaos elements on top
        for (const el of chaosElements) {
            ctx.fillStyle = el.color;
            ctx.strokeStyle = el.color;
            ctx.lineWidth = 1.5;

            if (el.kind === 'char') {
                ctx.font = `bold ${el.size}px Consolas, "Courier New", monospace`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText(el.ch, el.x, el.y);
            } else if (el.kind === 'rect') {
                if (Math.random() > 0.3) {
                    ctx.fillRect(el.x, el.y, el.w, el.h);
                } else {
                    ctx.strokeRect(el.x, el.y, el.w, el.h);
                }
            } else if (el.kind === 'tri') {
                ctx.beginPath();
                const s = el.size;
                if (el.dir === 0) {
                    ctx.moveTo(el.x, el.y - s); ctx.lineTo(el.x - s*0.7, el.y + s*0.5); ctx.lineTo(el.x + s*0.7, el.y + s*0.5);
                } else if (el.dir === 1) {
                    ctx.moveTo(el.x, el.y + s); ctx.lineTo(el.x - s*0.7, el.y - s*0.5); ctx.lineTo(el.x + s*0.7, el.y - s*0.5);
                } else if (el.dir === 2) {
                    ctx.moveTo(el.x + s, el.y); ctx.lineTo(el.x - s*0.5, el.y - s*0.7); ctx.lineTo(el.x - s*0.5, el.y + s*0.7);
                } else {
                    ctx.moveTo(el.x - s, el.y); ctx.lineTo(el.x + s*0.5, el.y - s*0.7); ctx.lineTo(el.x + s*0.5, el.y + s*0.7);
                }
                ctx.closePath();
                ctx.fill();
            } else if (el.kind === 'circle') {
                ctx.beginPath();
                ctx.arc(el.x, el.y, el.r, 0, Math.PI * 2);
                el.filled ? ctx.fill() : ctx.stroke();
            } else if (el.kind === 'smiley') {
                const s = el.size;
                ctx.beginPath();
                ctx.arc(el.x, el.y, s, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillRect(el.x - s*0.35, el.y - s*0.3, s*0.15, s*0.2);
                ctx.fillRect(el.x + s*0.2, el.y - s*0.3, s*0.15, s*0.2);
                ctx.beginPath();
                ctx.arc(el.x, el.y + s*0.1, s*0.4, 0.1 * Math.PI, 0.9 * Math.PI);
                ctx.stroke();
            }
        }

        // Screen shake intensifies
        if (corruptFrame > 20) {
            const shake = (corruptFrame - 20) * 0.4;
            canvas.style.transform = `translate(${(Math.random()-0.5)*shake}px, ${(Math.random()-0.5)*shake}px)`;
        }

        // Border flash — rapid color cycling on the boot overlay
        if (corruptFrame % 3 === 0) {
            const flashColor = CORRUPT_COLORS[Math.floor(Math.random() * CORRUPT_COLORS.length)];
            bootOverlay.style.borderColor = flashColor;
            bootOverlay.style.border = `${3 + Math.floor(progress * 6)}px solid ${flashColor}`;
            bootOverlay.style.boxShadow = `inset 0 0 ${20 + progress * 40}px ${flashColor}, 0 0 ${10 + progress * 20}px ${flashColor}`;
        }
    }

    // Type out the next boot line
    function typeNextLine() {
        if (bootIndex >= BOOT_LINES.length) {
            // All lines printed — start jitter phase, then chaos
            startJitter();
            return;
        }
        bootLines.push(BOOT_LINES[bootIndex]);
        bootIndex++;

        // Pacing: start slow, speed up
        let baseDelay;
        if (bootIndex <= 4) baseDelay = 220;
        else if (bootIndex <= 10) baseDelay = 150;
        else baseDelay = 110;

        setTimeout(typeNextLine, baseDelay + Math.random() * 60);
    }

    // Jitter phase — text starts glitching before chaos
    function startJitter() {
        jitterPhase = true;
        jitterFrame = 0;

        function jitterTick() {
            jitterFrame++;
            drawBootWithJitter();

            if (jitterFrame < 120) {
                requestAnimationFrame(jitterTick);
            } else {
                // Jitter done — start chaos overlay
                startCorruption();
            }
        }
        jitterTick();
    }

    // Corruption phase — multicolored shapes flood the screen
    function startCorruption() {
        corruptPhase = true;
        corruptFrame = 0;
        chaosElements = [];

        function corruptTick() {
            corruptFrame++;
            drawCorruption();

            if (corruptFrame < 240) {
                requestAnimationFrame(corruptTick);
            } else {
                // Hold the full chaos screen briefly
                setTimeout(() => {
                    // White flash
                    canvas.style.transform = '';
                    bootOverlay.style.border = '';
                    bootOverlay.style.boxShadow = '';
                    ctx.fillStyle = '#ffffff';
                    ctx.globalAlpha = 0.7;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.globalAlpha = 1.0;
                    setTimeout(() => {
                        // Corruption done — seamless reveal: title screen + music
                        canvas.style.transform = '';
                        revealTitleScreen();
                    }, 250);
                }, 500);
            }
        }
        corruptTick();
    }

    // Render loop for boot screen (cursor blink during typing phase)
    function bootRenderLoop() {
        if (bootDone || corruptPhase || jitterPhase) return;
        drawBoot();
        requestAnimationFrame(bootRenderLoop);
    }

    // Check if we arrived from the launcher (which already ran the boot sequence)
    // If opened directly (e.g. via preview server), run the boot; otherwise skip it
    const cameFromLauncher = document.referrer.includes('Asteroid Command') ||
                              window.location.search.includes('launched=1') ||
                              sessionStorage.getItem('bootDone') === '1';

    if (cameFromLauncher) {
        // Skip boot — gesture was collected on the launcher page (same origin).
        // AudioContext should be autoplay-allowed via Media Engagement Index.
        // Reveal title screen + music immediately.
        sessionStorage.removeItem('bootDone');
        audioGestureCollected = true;
        AudioManager.init();
        revealTitleScreen();
    } else {
        // No launcher — show "PRESS ANY KEY" to collect gesture, then run boot
        showInitPrompt();
    }

    // Load data in parallel
    loadGameData().then(() => {
        dataReady = true;
        if (bootDone) init();
    }).catch(err => {
        console.error('Data load failed:', err);
    });
});

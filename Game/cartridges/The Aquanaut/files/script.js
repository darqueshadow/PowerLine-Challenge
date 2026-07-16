/* ========================================================
   THE AQUANAUT — BELOW THE BLACK v2.0
   Deep-sea saturation diver typing defense game
   Engine: plain HTML/CSS/JS, Canvas, Web Audio API
   Virtual coordinate system: 1600×900

   v2 changes:
   - Sprite facing derived from _ht/_th filename suffix +
     actual swim direction (with hysteresis) — heads always
     lead, no more backwards spawns
   - Livelier swim animation: pitch into travel, banking,
     bubble wakes
   - Per-creature kill cams behind the brass helmet porthole
     (great white jaws, barracuda strikes, jellyfish wrap)
   - Abyss death cinematic: hoses severed → diver sinks →
     in-helmet crack stages → implosion
   - Hose-severed effects upgraded (bubbles / steam / sparks)
   ======================================================== */

// ============================================
// STATE
// ============================================

const player = { name: '', oasis: '' };

// Chromakey helper — shared by ship + diver sprite loaders
// Falls back to raw image if getImageData fails (e.g. file:// protocol CORS)
function chromakeyLoad(src, callback) {
    const raw = new Image();
    raw.onload = () => {
        try {
            const c = document.createElement('canvas');
            c.width = raw.naturalWidth;
            c.height = raw.naturalHeight;
            const ctx = c.getContext('2d');
            ctx.drawImage(raw, 0, 0);
            const id = ctx.getImageData(0, 0, c.width, c.height);
            const d = id.data;
            for (let i = 0; i < d.length; i += 4) {
                const r = d[i], g = d[i + 1], b = d[i + 2];
                if (g > 180 && r < 120 && b < 120) {
                    d[i + 3] = 0;
                } else if (g > 140 && g > r * 1.3 && g > b * 1.3) {
                    const greenness = (g - Math.max(r, b)) / g;
                    d[i + 3] = Math.round(255 * (1 - greenness));
                }
            }
            ctx.putImageData(id, 0, 0);
            const finalImg = new Image();
            finalImg.onload = () => callback(finalImg);
            finalImg.src = c.toDataURL('image/png');
        } catch (e) {
            console.warn(`Chromakey failed for ${src} (${e.message}) — using raw image`);
            callback(raw);
        }
    };
    raw.src = src;
}

// Ship sprite (dive tender — sits at surface)
const shipSprite = new Image();
let shipSpriteLoaded = false;
// Flag only once the assigned data-URL has actually DECODED — setting .src is async, so
// flipping the flag on the next line would leave naturalWidth/Height at 0 for a frame or
// two and yield NaN sizing (blank flicker) in the dive-entry / abyss cutscenes.
shipSprite.onload = () => { shipSpriteLoaded = true; };
chromakeyLoad('assets/Aquanaut/ship.png', (img) => {
    shipSprite.src = img.src;
});

// Diver sprite (the aquanaut — used in boot sequence, gameplay, kill cam)
const aquanautSprite = new Image();
let aquanautSpriteLoaded = false;
aquanautSprite.onload = () => { aquanautSpriteLoaded = true; };
chromakeyLoad('assets/Aquanaut/Aquanaut.png', (img) => {
    aquanautSprite.src = img.src;
});


// ============================================
// GREEN-SCREEN SPRITE LOADER — Static creature images with #00FF00 bg
// Chromakeyed at load time into transparent PNGs cached as offscreen canvases
// ============================================

// Facing is derived from the filename suffix — single source of truth:
//   _ht = Head→Tail reading left-to-right → head on the LEFT  → sprite faces LEFT
//   _th = Tail→Head reading left-to-right → head on the RIGHT → sprite faces RIGHT
// Head always leads: the renderer flips the sprite whenever its native facing
// disagrees with the direction the creature is actually swimming.
function facingFromSrc(src) {
    return /_th\.[a-z0-9]+$/i.test(src) ? 'right' : 'left';
}

function spriteSet(srcs) {
    return srcs.map(src => ({ src, facing: facingFromSrc(src) }));
}

const CREATURE_SPRITES = {
    greatWhite: spriteSet([
        'assets/Tier 1/Targets/target_greatwhite_profile_ht.png'
    ]),
    moray: spriteSet([
        'assets/Tier 1/Targets/target_moray_profile_ht.png'
    ]),
    boxJellyfish: spriteSet([
        'assets/Tier 1/Targets/target_boxjellyfish_drift.png'
    ]),
    // Tier 1 TOC signature — two STATE frames (not a flipbook): 0 = deflated (default),
    // 1 = inflated (shown once the unit offloads / goes live). Both _ht → native facing left.
    pufferfish: spriteSet([
        'assets/Tier 1/Targets/toctarget_pufferfish_deflated_ht.png',
        'assets/Tier 1/Targets/toctarget_pufferfish_inflated_ht.png'
    ]),
    // Friendly fish sprites (smaller, ambient)
    clownfish: spriteSet([
        'assets/Tier 1/Friendly/friendly_clown_1_ht.png',
        'assets/Tier 1/Friendly/friendly_clown_2_th.png',
        'assets/Tier 1/Friendly/friendly_clown_3_th.png',
        'assets/Tier 1/Friendly/friendly_clown_4_ht.png'
    ]),
    moorishIdol: spriteSet([
        'assets/Tier 1/Friendly/friendly_moorish_1_th.png',
        'assets/Tier 1/Friendly/friendly_moorish_2_ht.png',
        'assets/Tier 1/Friendly/friendly_moorish_3_ht.png',
        'assets/Tier 1/Friendly/friendly_moorish_4_ht.png',
        'assets/Tier 1/Friendly/friendly_moorish_5_ht.png'
    ]),
    regalTang: spriteSet([
        'assets/Tier 1/Friendly/friendly_regal_1_th.png',
        'assets/Tier 1/Friendly/friendly_regal_2_ht.png',
        'assets/Tier 1/Friendly/friendly_regal_3_th.png',
        'assets/Tier 1/Friendly/friendly_regal_4_ht.png'
    ])
};

// Sprite cache — pre-transparent PNGs, no runtime processing needed
const SPRITE_ASSETS = {};
const SPRITE_READY = {};
const SPRITE_BBOX = {};   // [key] = opaque bounding box {cx,cy,w,h} (fractions) — flipbook centroid-align

function loadCreatureSprite(key, src) {
    const img = new Image();
    SPRITE_READY[key] = false;
    img.onload = () => {
        try {
            // Chromakey: remove #00FF00 green background → transparent
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const d = imageData.data;
            // Skip chromakey on sources that are ALREADY transparent (clear corners) — a
            // pre-cut PNG has no green screen to remove, and keying it would only risk
            // nibbling greenish pixels off the art. A green-screen export has fully-opaque
            // corners; a transparent one has alpha 0 there.
            const cw = canvas.width, chh = canvas.height;
            const cornerA = (x, y) => d[(y * cw + x) * 4 + 3];
            const alreadyTransparent =
                (cornerA(0, 0) + cornerA(cw - 1, 0) + cornerA(0, chh - 1) + cornerA(cw - 1, chh - 1)) < 256;
            if (!alreadyTransparent) {
                for (let i = 0; i < d.length; i += 4) {
                    const r = d[i], g = d[i + 1], b = d[i + 2];
                    // Green screen: high green, low red and blue
                    if (g > 180 && r < 120 && b < 120) {
                        d[i + 3] = 0; // Fully transparent
                    }
                    // Edge softening: semi-green pixels get partial transparency
                    else if (g > 140 && g > r * 1.3 && g > b * 1.3) {
                        const greenness = (g - Math.max(r, b)) / g;
                        d[i + 3] = Math.round(255 * (1 - greenness));
                    }
                }
            }

            // Opaque bounding box (sampled) — lets the flipbook centre each frame on
            // the creature's body so AI-pose frames don't jump around as they cycle.
            let bxMin = canvas.width, byMin = canvas.height, bxMax = 0, byMax = 0, bxFound = false;
            for (let y = 0; y < canvas.height; y += 3) {
                for (let x = 0; x < canvas.width; x += 3) {
                    if (d[(y * canvas.width + x) * 4 + 3] > 24) {
                        bxFound = true;
                        if (x < bxMin) bxMin = x; if (x > bxMax) bxMax = x;
                        if (y < byMin) byMin = y; if (y > byMax) byMax = y;
                    }
                }
            }
            SPRITE_BBOX[key] = bxFound
                ? { cx: ((bxMin + bxMax) / 2) / canvas.width, cy: ((byMin + byMax) / 2) / canvas.height,
                    w: (bxMax - bxMin) / canvas.width, h: (byMax - byMin) / canvas.height }
                : { cx: 0.5, cy: 0.5, w: 1, h: 1 };

            ctx.putImageData(imageData, 0, 0);

            // Convert canvas to Image for reliable cross-canvas drawImage()
            const finalImg = new Image();
            finalImg.onload = () => {
                SPRITE_ASSETS[key] = finalImg;
                SPRITE_READY[key] = true;
                console.log(`Sprite ready: ${key} (${finalImg.width}x${finalImg.height})`);
            };
            finalImg.src = canvas.toDataURL('image/png');
        } catch (e) {
            // Chromakey failed (likely file:// CORS) — use raw image with green bg
            console.warn(`Chromakey failed for ${src} (${e.message}) — using raw image`);
            SPRITE_ASSETS[key] = img;
            SPRITE_READY[key] = true;
        }
    };
    img.onerror = () => {
        console.error(`Failed to load sprite: ${src}`);
    };
    img.src = src;
}

// Preload all green-screen sprites
(function preloadCreatureSprites() {
    for (const [type, variants] of Object.entries(CREATURE_SPRITES)) {
        variants.forEach((v, i) => {
            loadCreatureSprite(`${type}_${i}`, v.src);
        });
    }
})();

// ============================================
// MULTI-PART CREATURE RIGS (Option B) — separable parts on engine-driven pivots
// Loads each part of CREATURE_RIGS (config) into a transparent raster, keyed the
// same way as whole sprites. A rig activates for a creature only once its required
// parts are loaded; until then the creature uses the existing single-sprite render,
// so the live game is unchanged until rig art exists. With CONFIG.devRigPlaceholders
// on, missing parts are synthesized procedurally so articulation is visible now.
// ============================================

const RIG_ASSETS = {};   // RIG_ASSETS[type][part] = Image (chromakeyed)
const RIG_READY = {};    // RIG_READY[type][part]  = bool

// A creature's rig is usable once every required part has loaded.
function rigReady(type) {
    const rig = (typeof CREATURE_RIGS !== 'undefined') ? CREATURE_RIGS[type] : null;
    if (!rig) return false;
    const ready = RIG_READY[type];
    if (!ready) return false;
    const required = rig.required || Object.keys(rig.parts);
    return required.every(p => ready[p]);
}

// Synthesize a simple colour-coded placeholder for one part on the creature's
// full bounding box, so each part sits where it belongs and overlays into a
// whole creature. Lets the pivot/articulation be seen before real art lands.
function makePlaceholderPart(type, partName) {
    const rig = CREATURE_RIGS[type];
    const w = rig.spriteSize.w, h = rig.spriteSize.h;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    const facingLeft = (rig.nativeFacing || 'left') === 'left';
    const headX = facingLeft ? w * 0.14 : w * 0.86;
    const tailX = facingLeft ? w * 0.30 : w * 0.70;
    const colors = { body: '#5b7488', tail: '#46606f', jaw: '#9aa9b8', pectoral: '#6b8497', bell: '#7fb6c8', tentacles: '#5a93a6' };
    g.fillStyle = colors[partName] || '#688';
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.lineWidth = 2; g.lineJoin = 'round';
    switch (partName) {
        case 'body':
            g.beginPath(); g.ellipse(w * 0.5, h * 0.5, w * 0.34, h * 0.26, 0, 0, Math.PI * 2); g.fill(); g.stroke(); break;
        case 'tail': {
            const ty = h * 0.5, dir = facingLeft ? 1 : -1;
            g.beginPath(); g.moveTo(tailX, ty);
            g.lineTo(tailX + dir * w * 0.18, ty - h * 0.22);
            g.lineTo(tailX + dir * w * 0.18, ty + h * 0.22);
            g.closePath(); g.fill(); g.stroke(); break;
        }
        case 'jaw':
            g.beginPath(); g.ellipse(headX, h * 0.56, w * 0.10, h * 0.12, 0, 0, Math.PI * 2); g.fill(); g.stroke(); break;
        case 'pectoral':
            g.beginPath(); g.ellipse(w * 0.52, h * 0.66, w * 0.11, h * 0.06, 0.4, 0, Math.PI * 2); g.fill(); break;
        case 'bell':
            g.beginPath(); g.ellipse(w * 0.5, h * 0.40, w * 0.32, h * 0.26, 0, Math.PI, 0); g.fill(); g.stroke(); break;
        case 'tentacles':
            g.lineWidth = 3; g.strokeStyle = colors.tentacles;
            for (let i = 0; i < 5; i++) {
                const x = w * (0.32 + i * 0.09);
                g.beginPath(); g.moveTo(x, h * 0.44); g.quadraticCurveTo(x + 8, h * 0.72, x, h * 0.94); g.stroke();
            }
            break;
        default:
            g.fillRect(w * 0.4, h * 0.4, w * 0.2, h * 0.2);
    }
    const img = new Image();
    img.src = cv.toDataURL('image/png');
    return img;
}

function loadRigPart(type, partName, src) {
    RIG_READY[type] = RIG_READY[type] || {};
    RIG_ASSETS[type] = RIG_ASSETS[type] || {};
    RIG_READY[type][partName] = false;
    const finalize = (img) => { RIG_ASSETS[type][partName] = img; RIG_READY[type][partName] = true; };

    // Dev mode: synthesize a placeholder instead of fetching art
    if (typeof CONFIG !== 'undefined' && CONFIG.devRigPlaceholders) {
        const ph = makePlaceholderPart(type, partName);
        if (ph.complete) finalize(ph); else ph.onload = () => finalize(ph);
        return;
    }

    const img = new Image();
    img.onload = () => {
        try {
            // Same chromakey as whole sprites: strip #00FF00, soften green edges
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
            const c = canvas.getContext('2d');
            c.drawImage(img, 0, 0);
            const id = c.getImageData(0, 0, canvas.width, canvas.height);
            const d = id.data;
            for (let i = 0; i < d.length; i += 4) {
                const r = d[i], gg = d[i + 1], b = d[i + 2];
                if (gg > 180 && r < 120 && b < 120) d[i + 3] = 0;
                else if (gg > 140 && gg > r * 1.3 && gg > b * 1.3) {
                    const greenness = (gg - Math.max(r, b)) / gg;
                    d[i + 3] = Math.round(255 * (1 - greenness));
                }
            }
            c.putImageData(id, 0, 0);
            const fin = new Image();
            fin.onload = () => finalize(fin);
            fin.src = canvas.toDataURL('image/png');
        } catch (e) {
            finalize(img); // CORS (file://) — use raw
        }
    };
    // Missing rig art is expected pre-delivery — stay not-ready → single-sprite fallback
    img.onerror = () => {};
    img.src = src;
}

(function preloadCreatureRigs() {
    if (typeof CREATURE_RIGS === 'undefined') return;
    for (const [type, rig] of Object.entries(CREATURE_RIGS)) {
        for (const [partName, def] of Object.entries(rig.parts)) {
            loadRigPart(type, partName, def.src);
        }
    }
})();

const state = {
    running: false,
    paused: false,
    score: 0,
    hullHP: 9,
    bellBreached: false,
    repairCount: 0,
    cracks: [],
    streak: 0,
    streakSinceHullHit: 0,
    perfectStreak: 0,
    perfectMilestonesHit: [],
    consecutiveHosesDestroyed: 0,
    comebackCounter: 0,
    comebackAwarded: false,
    firstBloodAwarded: false,
    rankScoreAccum: 0,
    lastCalibrationAt: 0,
    tier: 'bubblehopper',
    speedMult: 0.6,
    spawnInterval: 6000,
    maxTargets: 2,
    creatures: [],
    projectiles: [],
    brokenProjectiles: [],
    explosions: [],
    statusFlashes: [],
    hoses: [],
    rov: null,
    rovDestroyCount: 0,
    rovPendingTimer: null,
    beamActive: false,
    beamTimer: 0,
    gameOverPending: false,
    usedChallenges: new Set(),
    backspaces: 0,
    cleanHits: 0,
    timers: {},
    devModeUnlocked: false,
    devPromptActive: false,
    holodeckUnlocked: false,
    holodeckPromptActive: false,
    environmentalParticles: [],
    marineSnow: [],
    // Constant-descent illusion (parallax water column + ticking depth gauge)
    descent: { phase: 0, displayDepth: 0, motes: [], bubbles: [], wallScroll: 0 },
    // COM radio call (the F3/"COM" comment bonus) — at most one diving bell at a time
    comCall: null,
    comCallInterval: 0,
    // Salvage economy
    salvagePoints: 0,
    repairTokens: 0,
    miniSub: null,
    miniSubTimer: 0,
    // Latched creatures & grapple state
    latchedCreatures: [],
    isGrappling: false,
    // Hose severed effects
    gasSevered: false,
    liquidSevered: false,
    electricalSevered: false,
    suffocationTimer: 0,
    // Kill cam
    killCamActive: false,
    abyssDeathActive: false,
    killCamPhase: 'none',
    killCamTimer: 0,
    killCamCreatureType: null,
    killCamProgress: 0,
    // Death-event payload (Core → Theme interface for the kill screen)
    deathEvent: null,
    // Visibility cone
    coneAngle: 55,
    // Screen-wide sonar sweep (degrees CW from 12 o'clock)
    sweepAngle: 0,
    _lastSweepAngle: 0,
    // Rebuilding state
    rebuilding: false
};

const DOM = {};

// ============================================
// TITLE SCREEN SONAR PING (Web Audio synthesis)
// ============================================

function initTitleSonarPing() {
    let pingActive = true;
    let audioUnlocked = false;
    const ROTATION_MS = 4000; // must match CSS animation duration
    const animStartTime = performance.now(); // sync with CSS animation start

    const titleBtn = document.getElementById('title-press-prompt');

    // Bearing (deg, 0 = up / 12 o'clock, clockwise) of the BENEATH THE BLACK
    // button from the sweep centre (start-overlay centre). The sweep arm reveals
    // the button as its bright edge crosses this bearing.
    let btnBearing = null;
    function computeBtnBearing() {
        const overlay = document.getElementById('start-overlay');
        if (!overlay || !titleBtn) { btnBearing = null; return; }
        const o = overlay.getBoundingClientRect();
        const b = titleBtn.getBoundingClientRect();
        if (!b.width && !b.height) { btnBearing = null; return; } // not laid out yet
        const dx = (b.left + b.width / 2) - (o.left + o.width / 2);
        const dy = (b.top + b.height / 2) - (o.top + o.height / 2);
        btnBearing = ((Math.atan2(dx, -dy) * 180 / Math.PI) + 360) % 360;
    }
    computeBtnBearing();
    window.addEventListener('resize', computeBtnBearing);

    // Preload ping.mp3
    const pingAudio = new Audio('sfx/ping.mp3');
    pingAudio.preload = 'auto';

    function playSonarPing() {
        if (!audioUnlocked) return;
        pingAudio.currentTime = 0;
        pingAudio.play().catch(() => {});
    }

    let flareTimeout = null;

    function triggerPingFlare() {
        const arm = document.querySelector('.title-sweep-arm');
        if (!arm) return;
        arm.classList.add('ping-active');
        if (flareTimeout) clearTimeout(flareTimeout);
        flareTimeout = setTimeout(() => {
            arm.classList.remove('ping-active');
            flareTimeout = null;
        }, 900);
    }

    // Button opacity vs the sweep-relative angle phi (0 = arm bright edge over the
    // button): full on the cross, then fades out immediately, reaching dark at
    // 270 deg past, and stays dark until the next pass.
    function blipOpacity(phi) {
        if (phi >= 270) return 0;
        return 1 - phi / 270;
    }

    // The button alternates its label on every contact (contact 0 = first label).
    const TITLE_LABELS = ['BENEATH THE BLACK', 'PRESS ANY KEY TO ENTER...'];
    let contactCount = 0;

    let prevPhi = null;
    // Stay fully dark until the sweep's bright edge has crossed the button at least once.
    // Without this latch the button would load already part-lit (blipOpacity of whatever
    // angle the arm happens to start at) before the tracer ever reaches it.
    let swept = false;
    function tick() {
        if (!pingActive) return;
        if (btnBearing === null) computeBtnBearing();

        if (btnBearing !== null && titleBtn) {
            const elapsed = performance.now() - animStartTime;
            const armDeg = (elapsed / ROTATION_MS * 360) % 360;
            const phi = ((armDeg - btnBearing) % 360 + 360) % 360;
            titleBtn.style.opacity = swept ? blipOpacity(phi).toFixed(3) : '0';

            // Bright edge just crossed the button bearing (phi wrapped 360 -> 0):
            // the instant the sweep "hits" the button.
            if (prevPhi !== null && phi < prevPhi) {
                swept = true;   // first contact — the button may now reveal/fade with the sweep
                playSonarPing();
                triggerPingFlare();
                // Quick over-bright flicker, then the opacity fade takes over.
                titleBtn.classList.remove('contact-flash');
                void titleBtn.offsetWidth;            // restart the CSS flicker
                titleBtn.classList.add('contact-flash');
                // Alternate the label on each contact.
                titleBtn.textContent = TITLE_LABELS[contactCount % TITLE_LABELS.length];
                contactCount++;
                computeBtnBearing();                  // re-align bearing to the new text width
                prevPhi = null;                       // re-seed after the bearing change
            } else {
                prevPhi = phi;
            }
        }
        requestAnimationFrame(tick);
    }

    // Unlock audio WITHOUT an off-beat ping — every audible ping comes from a
    // button crossing in tick().
    function unlockSilently() {
        audioUnlocked = true;
        try {
            pingAudio.play().then(() => { pingAudio.pause(); pingAudio.currentTime = 0; }).catch(() => {});
        } catch (_) { /* ignore */ }
    }
    if (AudioManager.initialized) {
        // Boot sequence already collected a gesture — audio is good to go.
        audioUnlocked = true;
    } else {
        // Try a silent autoplay-unlock (may work if a gesture happened earlier).
        pingAudio.play().then(() => {
            audioUnlocked = true;
            pingAudio.pause();
            pingAudio.currentTime = 0;
        }).catch(() => {});
    }

    // Fallback: unlock audio on first user gesture (no immediate ping).
    function activateAudio() {
        document.removeEventListener('keydown', activateAudio);
        document.removeEventListener('click', activateAudio);
        if (!audioUnlocked) unlockSilently();
    }
    document.addEventListener('keydown', activateAudio);
    document.addEventListener('click', activateAudio);

    // Clean up when leaving title screen
    const observer = new MutationObserver(() => {
        const overlay = document.getElementById('start-overlay');
        if (overlay && !overlay.classList.contains('title-screen-bg')) {
            pingActive = false;
            if (flareTimeout) { clearTimeout(flareTimeout); flareTimeout = null; }
            pingAudio.pause();
            pingAudio.src = '';
            observer.disconnect();
            window.removeEventListener('resize', computeBtnBearing);
            document.removeEventListener('keydown', activateAudio);
            document.removeEventListener('click', activateAudio);
            if (titleBtn) titleBtn.style.opacity = '';
        }
    });
    const overlay = document.getElementById('start-overlay');
    if (overlay) observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });

    requestAnimationFrame(tick);
}

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
    // Inject title screen sonar sweep overlay
    if (DOM.startOverlay && !document.getElementById('title-sonar-sweep')) {
        const sweep = document.createElement('div');
        sweep.id = 'title-sonar-sweep';
        sweep.innerHTML = '<div class="title-sweep-arm"></div>';
        DOM.startOverlay.insertBefore(sweep, DOM.startOverlay.firstChild);
        initTitleSonarPing();
    }
    DOM.gameOverOverlay = document.getElementById('game-over-overlay');
    DOM.finalScore = document.getElementById('final-score');
    DOM.tier = document.getElementById('tier-value');
    DOM.devPrompt = document.getElementById('dev-mode-prompt');
    DOM.devInput = document.getElementById('dev-password-input');
    DOM.devTimer = document.getElementById('dev-timer');
    DOM.holodeckPrompt = document.getElementById('holodeck-prompt');
    DOM.holodeckInput = document.getElementById('holodeck-password-input');
    DOM.tetherLayer = document.getElementById('tether-layer');
    DOM.salvage = document.getElementById('salvage-value');
    DOM.depthValue = document.getElementById('depth-value');
    DOM.pressureFill = document.getElementById('pressure-fill');
    DOM.powerline = document.getElementById('powerline-prompt');
    DOM.powerlineRequired = document.getElementById('powerline-required');
    DOM.powerlineDesc = document.getElementById('powerline-description');
    DOM.cmdRefOverlay = document.getElementById('cmd-ref-overlay');
    DOM.cmdRefRequired = document.getElementById('cmd-ref-required');
    DOM.cmdRefDesc = document.getElementById('cmd-ref-description');
    DOM.cmdRefToggle = document.getElementById('cmd-ref-toggle');

    // Command Reference toggle + drag + close
    initCommandReference();

    resize();
    window.addEventListener('resize', resize);

    DOM.pauseOverlay = document.getElementById('pause-overlay');
    DOM.blockCursor = document.getElementById('block-cursor');

    // Block cursor positioning
    function updateBlockCursor() {
        if (!DOM.blockCursor || !DOM.input) return;
        const canvas = document.createElement('canvas');
        const mCtx = canvas.getContext('2d');
        const style = getComputedStyle(DOM.input);
        mCtx.font = style.fontSize + ' ' + style.fontFamily;
        const textW = mCtx.measureText(DOM.input.value).width;
        const spacing = parseFloat(style.letterSpacing) || 0;
        const totalW = textW + (DOM.input.value.length * spacing);
        const inputRect = DOM.input.getBoundingClientRect();
        const boxRect = DOM.input.parentElement.getBoundingClientRect();
        DOM.blockCursor.style.left = (inputRect.left - boxRect.left + totalW) + 'px';
        DOM.blockCursor.style.top = ((boxRect.height - 18) / 2) + 'px';
    }
    DOM.input.addEventListener('input', (e) => {
        updateBlockCursor();
        if (state.running && !state.paused) {
            // Per-keystroke sonar-console feedback (deletes get a lower blip).
            const deleting = e && typeof e.inputType === 'string' && e.inputType.indexOf('delete') === 0;
            AudioManager.play(deleting ? 'typingDelete' : 'typing');
            updateAutocomplete(DOM.input.value);
            updatePowerlinePrompt(DOM.input.value);
        }
    });
    DOM.input.addEventListener('focus', () => { DOM.blockCursor.style.display = 'inline-block'; updateBlockCursor(); });
    DOM.input.addEventListener('blur', () => { DOM.blockCursor.style.display = 'none'; });
    setTimeout(updateBlockCursor, 100);

    // Holodeck click-to-destroy — left click on creature fires a sonar pulse at it
    DOM.canvas.addEventListener('click', (e) => {
        if (!state.running) return;
        if (CONFIG.isHolodeck) {
            const rect = DOM.canvas.getBoundingClientRect();
            const vx = (e.clientX - rect.left) / canvasScaleX;
            const vy = (e.clientY - rect.top) / canvasScaleY;
            const hit = state.creatures.find(c => {
                const dx = c.x - vx, dy = c.y - vy;
                return Math.sqrt(dx * dx + dy * dy) < c.radius * 2.5;
            });
            if (hit && godMode.clickToDestroy) {
                const bh = (TIERS[state.tier] || {}).baseHit || 100;
                if (fireProjectile(hit)) {
                    state.streak++;
                    state.consecutiveHosesDestroyed = 0;
                    applyScore(bh);
                    showStatus(`HIT +${bh}`, "hit");
                    updateHUD();
                    checkTier();
                } else if (godMode.godModeKill && (state.bellBreached || state.rebuilding)) {
                    // God Mode: destroy creature directly when bell is breached
                    createExplosion(hit.x, hit.y, '#00ffcc', hit.radius * 2);
                    const idx = state.creatures.indexOf(hit);
                    if (idx !== -1) removeCreatureAt(idx);
                    state.streak++;
                    state.consecutiveHosesDestroyed = 0;
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

    document.getElementById('start-btn').addEventListener('click', () => startGame(false));
    document.getElementById('restart-btn').addEventListener('click', () => startGame(CONFIG.isHolodeck));
    document.getElementById('quit-game-btn')?.addEventListener('click', quitGame);
    document.getElementById('fullscreen-toggle')?.addEventListener('click', (e) => {
        e.preventDefault();
        toggleFullscreen();
        if (DOM.input && state.running && !state.paused) DOM.input.focus();
    });

    // The browser reserves Esc for exiting fullscreen and eats the keypress before our
    // keydown handler sees it — so hitting Esc mid-dive used to just collapse the window
    // (showing the browser chrome) instead of pausing. Catch the fullscreen-exit itself and
    // raise the Pause screen, unless the exit came from the HUD's own fullscreen toggle.
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && state.running && !state.paused && !state._intentionalFsExit) {
            hideAutocomplete();
            pauseGame();
        }
        state._intentionalFsExit = false;
    });
    document.getElementById('holodeck-btn')?.addEventListener('click', (e) => {
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
        titleDismissed = true;
        if (titlePrompt) titlePrompt.classList.add('hidden');
        if (normalMenuBtns) normalMenuBtns.classList.remove('hidden');
        startMenuMusic();
        selectDefaultMenuButton('start-btn');
    });

    // Title Screen -> Main Menu transition
    const titlePrompt = document.getElementById('title-press-prompt');
    const normalMenuBtns = document.getElementById('normal-menu-buttons');
    let titleDismissed = false;

    // Advance from the title screen to the main menu. Triggered by the BENEATH
    // THE BLACK button (click, or Enter via menu-nav) and by clicking the backdrop.
    function enterMainMenu() {
        if (titleDismissed) return;
        titleDismissed = true;
        window._dismissTitleScreen = null;
        AudioManager.init();
        state._titleDismissedAt = Date.now();
        DOM.startOverlay.removeEventListener('click', dismissTitleScreen);

        // Credential login removed — no forced callsign / dive-cert entry.
        // Assign a default diver identity (used only for leaderboard scores) and
        // go straight to the main menu. A name can still be set via "Change Diver".
        if (!player.name) {
            player.name = 'DIVER';
            player.oasis = '';
        }
        showMainMenu();
    }

    function dismissTitleScreen(e) {
        if (titleDismissed) return;
        // The title button has its own handler; ignore button/input events here.
        if (e && e.target && e.target.closest('button')) return;
        if (e && e.target && e.target.tagName === 'INPUT') return;
        if (e) e.stopImmediatePropagation();
        enterMainMenu();
    }

    window._dismissTitleScreen = dismissTitleScreen;

    const titleEnterBtn = document.getElementById('title-press-prompt');
    if (titleEnterBtn) titleEnterBtn.addEventListener('click', enterMainMenu);

    // Music auto-advance disabled — music system not yet replaced
    // if (AudioManager._musicEl && !AudioManager._musicOnEnded) {
    //     const onEnded = () => dismissTitleScreen();
    //     AudioManager._musicOnEnded = onEnded;
    //     AudioManager._musicEl.addEventListener('ended', onEnded);
    // }

    function startMenuMusic() {
        // Layered menu soundscape (bed + beep overlay + sparse deep-sea textures)
        // assembled from the assets/SFX library. playScene is idempotent, so menu
        // navigation re-triggering this won't restart the bed.
        AudioManager.playScene('main');
    }

    function showMainMenu() {
        titlePrompt.classList.add('hidden');
        DOM.startOverlay.classList.remove('hidden', 'title-screen-bg');
        DOM.startOverlay.classList.add('main-menu-bg');
        if (DOM.startOverlay.classList.contains('holodeck-menu-active')) {
            document.getElementById('holodeck-menu-buttons').classList.remove('hidden');
        } else {
            normalMenuBtns.classList.remove('hidden');
        }
        startMenuMusic();
        selectDefaultMenuButton('start-btn');
    }

    // Title screen advances on ANY key (see the keydown handler) or by clicking
    // the button / title backdrop. One key = one advance, so a single Enter can't
    // chain straight through into BEGIN DESCENT.
    DOM.startOverlay.addEventListener('click', dismissTitleScreen);

    // ============================================
    // CAT LOGIN TERMINAL (Dive Computer)
    // ============================================

    const catOverlay = document.getElementById('cat-login-overlay');
    const catOutput = document.getElementById('cat-output');
    const catInput = document.getElementById('cat-input');
    const catPrompt = document.getElementById('cat-prompt');
    const catLeaderboard = document.getElementById('cat-leaderboard');
    let catStep = 'name';

    function showCATLogin() {
        catOverlay.classList.remove('hidden');
        catOutput.textContent = '';
        catStep = 'name';
        catInput.value = '';
        catInput.type = 'text';
        catAppend('DEEP OCEAN OPERATIONS');
        catAppend('SATURATION DIVE SYSTEM v1.0');
        catAppend('');
        catAppend('READY.');
        catAppend('');
        catPrompt.textContent = 'ENTER DIVER CALLSIGN: ';
        setTimeout(() => catInput.focus(), 0);
        renderLeaderboard();
        catLeaderboard.classList.remove('hidden');
    }

    catOverlay.addEventListener('click', () => {
        if (!catOverlay.classList.contains('hidden')) catInput.focus();
    });

    function catAppend(text) {
        catOutput.textContent += text + '\n';
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
                catAppend('ENTER DIVER CALLSIGN: ' + player.name);
                catAppend('');
                catPrompt.textContent = 'DIVE CERT #: ';
                catInput.value = '';
                catStep = 'oasis';
            } else if (catStep === 'oasis') {
                player.oasis = val;
                catAppend('DIVE CERT #: ' + val);
                catAppend('');
                catAppend('WELCOME, ' + player.name + '.');
                catAppend('LOADING DIVE COMPUTER...');
                catInput.value = '';
                catStep = 'done';
                setTimeout(() => {
                    catOverlay.classList.add('hidden');
                    showMainMenu();
                }, 1200);
            }
        }
    });

    // ============================================
    // LEADERBOARD (localStorage)
    // ============================================

    function getScores() {
        try {
            const raw = localStorage.getItem('aquanaut-scores');
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
        scores.sort((a, b) => b.score - a.score);
        if (scores.length > 100) scores.length = 100;
        localStorage.setItem('aquanaut-scores', JSON.stringify(scores));
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
            list.innerHTML = '<div class="cat-lb-empty">NO DIVE RECORDS</div>';
            return;
        }
        let html = '<div class="cat-lb-row header">' +
            '<span class="cat-lb-rank">#</span>' +
            '<span class="cat-lb-name">DIVER</span>' +
            '<span class="cat-lb-score">SCORE</span>' +
            '<span class="cat-lb-tier">DEPTH</span></div>';
        top10.forEach((s, i) => {
            html += '<div class="cat-lb-row">' +
                '<span class="cat-lb-rank">' + (i + 1) + '</span>' +
                '<span class="cat-lb-name">' + (s.name || 'UNKNOWN') + '</span>' +
                '<span class="cat-lb-score">' + (s.score || 0).toLocaleString() + '</span>' +
                '<span class="cat-lb-tier">' + (s.tier || '') + '</span></div>';
        });
        list.innerHTML = html;
    }

    // Submit Score button
    document.getElementById('submit-score-btn').addEventListener('click', () => {
        const statusEl = document.getElementById('score-submit-status');
        if (!player.name) {
            if (statusEl) { statusEl.textContent = 'NO DIVER LOGGED IN'; statusEl.className = 'dataset-status error'; }
            return;
        }
        const tierLabel = TIERS[state.tier] ? TIERS[state.tier].label : state.tier.toUpperCase();
        saveScore(player.name, player.oasis, state.score, tierLabel);
        if (statusEl) {
            statusEl.textContent = 'DIVE RECORDED: ' + state.score.toLocaleString();
            statusEl.className = 'dataset-status success';
        }
        document.getElementById('submit-score-btn').disabled = true;
    });

    document.getElementById('main-menu-btn').addEventListener('click', () => {
        DOM.gameOverOverlay.classList.add('hidden');
        DOM.gameOverOverlay.classList.remove('game-over-bg');
        DOM.startOverlay.classList.remove('hidden');
        DOM.startOverlay.classList.add('main-menu-bg');
        titleDismissed = true;
        titlePrompt.classList.add('hidden');
        normalMenuBtns.classList.remove('hidden');
        startMenuMusic();
        selectDefaultMenuButton('start-btn');
    });

    // Main menu submenu navigation
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

    // Settings submenu
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
            if (AudioManager._musicEl) AudioManager._musicEl.volume = MUSIC.volume;
        } else {
            if (AudioManager._musicEl) AudioManager._musicEl.volume = 0;
        }
        AudioManager._musicMuted = !musicEnabled;
        AudioManager.refreshSceneVolume();   // the menu/game-over soundscape follows the MUSIC toggle
    });

    sfxToggleBtn.addEventListener('click', () => {
        sfxEnabled = !sfxEnabled;
        sfxToggleBtn.textContent = sfxEnabled ? 'ON' : 'OFF';
        sfxToggleBtn.classList.toggle('on', sfxEnabled);
        sfxToggleBtn.classList.toggle('off', !sfxEnabled);
        AudioManager._sfxMuted = !sfxEnabled;
        if (sfxEnabled) {
            if (AudioManager.masterGain) AudioManager.masterGain.gain.value = 0.35;
            if (state.running) { try { AudioManager.startAmbient(); } catch (e) {} }  // resume pressure bed
        } else {
            if (AudioManager.masterGain) AudioManager.masterGain.gain.value = 0;
            try { AudioManager.stopAmbient(); } catch (e) {}
        }
    });

    // High Scores submenu
    const highscoresBgLayer = document.getElementById('highscores-bg-layer');

    function renderHighScoresPage() {
        const list = document.getElementById('highscores-list');
        if (!list) return;
        const top10 = getTop10();
        if (top10.length === 0) {
            list.innerHTML = '<div class="hs-empty">NO DIVE RECORDS</div>';
            return;
        }
        let html = '<div class="hs-row header">' +
            '<span class="hs-rank">#</span>' +
            '<span class="hs-name">DIVER</span></div>';
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

    // Change diver
    document.getElementById('change-player-btn').addEventListener('click', () => {
        normalMenuBtns.classList.add('hidden');
        player.name = '';
        player.oasis = '';
        showCATLogin();
    });

    // ============================================
    // MENU KEYBOARD NAVIGATION
    // ============================================

    let menuSelectedIndex = 0;

    function getVisibleMenuButtons() {
        const startOverlay = document.getElementById('start-overlay');
        const gameOverOverlay = document.getElementById('game-over-overlay');
        const pauseOverlay = document.getElementById('pause-overlay');

        let container = null;
        if (startOverlay && !startOverlay.classList.contains('hidden')) {
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
        return Array.from(container.querySelectorAll('button')).filter(btn => {
            if (btn.offsetParent === null) return false;
            const parent = btn.closest('.hidden');
            return !parent;
        });
    }

    function updateMenuHighlight(buttons) {
        document.querySelectorAll('button.menu-kb-selected').forEach(b => b.classList.remove('menu-kb-selected'));
        if (buttons.length > 0 && menuSelectedIndex >= 0 && menuSelectedIndex < buttons.length) {
            buttons[menuSelectedIndex].classList.add('menu-kb-selected');
        }
    }

    // Pre-highlight a sensible default option when a menu opens, so there's
    // always one selected button (with its tracer running). preferId picks a
    // specific button if it's visible; otherwise we fall back to the first.
    // Exposed on `state` so top-level code (e.g. gameOver) can call it too.
    function selectDefaultMenuButton(preferId) {
        const buttons = getVisibleMenuButtons();
        if (!buttons.length) return;
        let idx = 0;
        if (preferId) {
            const p = buttons.findIndex(b => b.id === preferId);
            if (p >= 0) idx = p;
        }
        menuSelectedIndex = idx;
        updateMenuHighlight(buttons);
    }
    state.selectDefaultMenuButton = selectDefaultMenuButton;

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
        // During a dive, kill every function key except F3 (COM radio bonus) and
        // F12 (command-input reset). F1/F2/F4–F11 do nothing — no browser help,
        // no accidental F11 fullscreen toggle, etc. Out of gameplay they pass through.
        if (state.running && /^F([1-9]|1[01])$/.test(e.key) && e.key !== 'F3') {
            e.preventDefault();
            return;
        }

        // F12 — (re)activate the PowerLine command input. Works regardless of focus,
        // so the player can click out of the box and tap F12 to return.
        if (e.key === 'F12') {
            e.preventDefault();
            if (state.running && !state.paused && DOM.input && !DOM.input.disabled) {
                DOM.input.focus();
            }
            // Clear whatever was entered — F12 is the no-penalty bail/reset (like CAD's
            // PowerLine reset). No score change: penalties only happen on a SUBMIT miss,
            // so resetting with F12 instead of hitting Enter on a bad command costs nothing.
            if (DOM.input) {
                DOM.input.value = '';
                hideAutocomplete();
                hidePowerlinePrompt();
                if (DOM.blockCursor && DOM.input.parentElement) {
                    const inputRect = DOM.input.getBoundingClientRect();
                    const boxRect = DOM.input.parentElement.getBoundingClientRect();
                    DOM.blockCursor.style.left = (inputRect.left - boxRect.left) + 'px';
                }
            }
            return;
        }

        // F3 — insert the "COM " prefix into the command box to log a radio-call comment
        // (mirrors the real CAD F3). Then type `<unit#> <comment>` and Enter. In-game only.
        if (e.key === 'F3') {
            e.preventDefault();
            if (state.running && !state.paused && DOM.input && !DOM.input.disabled) {
                DOM.input.focus();
                const cur = DOM.input.value;
                if (!/^COM\b/i.test(cur.trim())) {
                    DOM.input.value = 'COM ' + cur.replace(/^\s+/, '');
                }
                const len = DOM.input.value.length;
                try { DOM.input.setSelectionRange(len, len); } catch (e2) {}
                DOM.input.dispatchEvent(new Event('input'));   // refresh block cursor + autocomplete + powerline
            }
            return;
        }

        // ── DEBUG (temporary — REMOVE before commit): fire a creature's kill cam to eyeball
        // the §0.9 cinematics. In a dive, click off the command box, then press
        // 7 / 8 / 9 / 0 = Great White / Moray / Box Jelly / Pufferfish. ──
        if (state.running && !state.killCamActive && !state.abyssDeathActive
            && !(e.target && e.target.tagName === 'INPUT') && '7890'.includes(e.key)) {
            const dbg = { '7': 'greatWhite', '8': 'moray', '9': 'boxJellyfish', '0': 'pufferfish' }[e.key];
            if (dbg && typeof CREATURE_TYPES !== 'undefined' && CREATURE_TYPES[dbg]) {
                e.preventDefault();
                triggerKillCam({ creatureType: CREATURE_TYPES[dbg] });
                return;
            }
        }

        // ── Title screen: ANY key advances to the main menu (mirrors the
        // click-anywhere dismiss). Excludes modifier combos / bare modifier keys
        // so Ctrl+Shift+D / Ctrl+Shift+H and the F-key hotkeys above still reach
        // their own handlers. One key = one advance, so a single Enter can't chain
        // straight through into BEGIN DESCENT.
        if (titlePrompt && !titleDismissed
            && !titlePrompt.classList.contains('hidden')
            && titlePrompt.offsetParent !== null
            && !e.ctrlKey && !e.metaKey && !e.altKey
            && !['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)
            && !(e.target && e.target.tagName === 'INPUT')) {
            e.preventDefault();
            enterMainMenu();
            return;
        }

        const skipMenuNav = state.holodeckPromptActive || state.devPromptActive
                         || (e.target && e.target.tagName === 'INPUT');
        const menuButtons = skipMenuNav ? [] : getVisibleMenuButtons();
        if (menuButtons.length > 0 && (!state.running || state.paused)) {
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
            if (e.key === 'Enter') {
                e.preventDefault();
                if (menuButtons[menuSelectedIndex]) {
                    menuButtons[menuSelectedIndex].click();
                }
                return;
            }
        }

        // Game controls
        if (state.running && !state.paused) {
            if (e.key === 'Escape') { hideAutocomplete(); pauseGame(); return; }
            // P also pauses (so you never need Esc, which the browser reserves for exiting
            // fullscreen). Gated to when you're NOT typing in the command box, since the
            // letter P appears in commands (DPT / PTC).
            if ((e.key === 'p' || e.key === 'P') && e.target !== DOM.input) {
                e.preventDefault(); hideAutocomplete(); pauseGame(); return;
            }

            // Autocomplete navigation
            if (autocompleteVisible) {
                if (e.key === 'ArrowDown') { e.preventDefault(); navigateAutocomplete(1); return; }
                if (e.key === 'ArrowUp') { e.preventDefault(); navigateAutocomplete(-1); return; }
                if (e.key === 'Tab') {
                    e.preventDefault();
                    const dropdown = document.getElementById('autocomplete-dropdown');
                    const selected = dropdown ? dropdown.querySelector('.ac-selected') : null;
                    if (selected) {
                        const alias = selected.textContent.split('  —')[0].trim();
                        selectAutocomplete(alias);
                    }
                    return;
                }
                if (e.key === 'Escape') { e.preventDefault(); hideAutocomplete(); return; }
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                // If autocomplete has a selection, fill it first
                if (autocompleteVisible && autocompleteIndex >= 0) {
                    const dropdown = document.getElementById('autocomplete-dropdown');
                    const selected = dropdown ? dropdown.querySelector('.ac-selected') : null;
                    if (selected) {
                        const alias = selected.textContent.split('  —')[0].trim();
                        selectAutocomplete(alias);
                        return; // Don't submit yet — let them review
                    }
                }
                handleCommand(DOM.input.value);
                return;
            }
            if (e.key === 'Backspace') { state.backspaces++; }
            // Repair token hotkeys: 1, 2, 3
            if (e.key === '1' || e.key === '2' || e.key === '3') {
                const hoseIdx = parseInt(e.key) - 1;
                if (state.repairTokens > 0 && state.hoses[hoseIdx] && state.hoses[hoseIdx].hp <= 0) {
                    e.preventDefault();
                    spendRepairToken(hoseIdx);
                    return;
                }
            }
        }

        if (state.paused && (e.key === 'Escape' || e.key === 'p' || e.key === 'P')) { resumeGame(); return; }

        // Dev mode (Ctrl+Shift+D)
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            if (!state.devModeUnlocked) showDevPrompt();
            return;
        }

        // Holodeck (Ctrl+Shift+H)
        if (e.ctrlKey && e.shiftKey && e.key === 'H') {
            e.preventDefault();
            if (!state.holodeckUnlocked) showHolodeckPrompt();
            return;
        }
    });

    // ============================================
    // DEV MODE & HOLODECK PROMPTS
    // ============================================

    function showDevPrompt() {
        if (state.devPromptActive) return;
        state.devPromptActive = true;
        DOM.devPrompt.classList.remove('hidden');
        DOM.devInput.value = '';
        DOM.devInput.focus();
        let timer = CONFIG.devModeTimeout / 1000;
        DOM.devTimer.textContent = timer;
        state._devTimerInterval = setInterval(() => {
            timer--;
            DOM.devTimer.textContent = timer;
            if (timer <= 0) { cancelDevPrompt(); }
        }, 1000);
    }

    function cancelDevPrompt() {
        state.devPromptActive = false;
        DOM.devPrompt.classList.add('hidden');
        clearInterval(state._devTimerInterval);
    }

    DOM.devInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            if (DOM.devInput.value.toUpperCase() === CONFIG.devModePassword) {
                state.devModeUnlocked = true;
                cancelDevPrompt();
                showStatus('DEV MODE ACTIVE', 'bonus');
            } else {
                cancelDevPrompt();
            }
        }
        if (e.key === 'Escape') cancelDevPrompt();
    });

    function showHolodeckPrompt() {
        if (state.holodeckPromptActive) return;
        state.holodeckPromptActive = true;
        DOM.holodeckPrompt.classList.remove('hidden');
        DOM.holodeckInput.value = '';
        DOM.holodeckInput.focus();
        // Yellow grid flash — signal that holodeck access is available
        flashGrid(2, 'grid-signal-yellow');
        let timer = CONFIG.holodeckTimeout / 1000;
        const timerEl = document.getElementById('holodeck-timer');
        if (timerEl) timerEl.textContent = timer;
        state._holoTimerInterval = setInterval(() => {
            timer--;
            if (timerEl) timerEl.textContent = timer;
            if (timer <= 0) {
                flashGrid(3, 'grid-signal-red');
                cancelHolodeckPrompt();
            }
        }, 1000);
    }

    function cancelHolodeckPrompt() {
        state.holodeckPromptActive = false;
        DOM.holodeckPrompt.classList.add('hidden');
        clearInterval(state._holoTimerInterval);
    }

    DOM.holodeckInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            if (DOM.holodeckInput.value.toUpperCase() === CONFIG.holodeckPassword) {
                state.holodeckUnlocked = true;
                cancelHolodeckPrompt();
                enterHolodeckMenu();
            } else {
                // Wrong password — red grid flash
                flashGrid(3, 'grid-signal-red');
                cancelHolodeckPrompt();
            }
        }
        if (e.key === 'Escape') cancelHolodeckPrompt();
    });

    // Holodeck click-to-refocus handler
    state._holodeckRefocusHandler = null;

    // Keep the BENEATH THE BLACK button keyboard-selected so Enter descends; its
    // visibility is driven by the sonar sweep (initTitleSonarPing), not selection.
    selectDefaultMenuButton('title-press-prompt');
}

// ============================================
// RESIZE / SCALING
// ============================================

function resize() {
    const area = document.getElementById('play-area');
    const wrapper = document.getElementById('canvas-wrapper');

    const areaW = area.clientWidth;
    const areaH = area.clientHeight;
    let pxW = areaW;
    let pxH = Math.round(pxW * (9 / 16));
    if (pxH > areaH) {
        pxH = areaH;
        pxW = Math.round(pxH * (16 / 9));
    }

    wrapper.style.width  = `${pxW}px`;
    wrapper.style.height = `${pxH}px`;

    DOM.canvas.width  = pxW;
    DOM.canvas.height = pxH;

    canvasScaleX = pxW / COORD_SYSTEM.width;
    canvasScaleY = pxH / COORD_SYSTEM.height;

    if (DOM.tetherLayer) {
        DOM.tetherLayer.setAttribute('viewBox', `0 0 ${COORD_SYSTEM.width} ${COORD_SYSTEM.height}`);
    }

    const root = document.documentElement;
    root.style.setProperty('--canvas-width', pxW + 'px');
    root.style.setProperty('--canvas-height', pxH + 'px');

    // NOTE (v2): hoses/aquanaut live in virtual coords and never move with
    // the canvas, so no re-init on resize. (v1 re-ran initHoses() here, which
    // silently restored all hose + suit HP — a free heal on every window
    // resize.)

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
// HOSE BUNDLE + AQUANAUT (Defense System)
// ============================================

function initHoses() {
    const w = COORD_SYSTEM.width;
    const h = COORD_SYSTEM.height;
    const cx = w / 2;
    const cy = h * 0.65; // Aquanaut below center (585 in 900h)

    // Hose targets spaced along the vertical umbilical bundle above aquanaut
    const bundleTop = 20;
    const bundleBot = cy - 40; // Bundle runs from top to just above aquanaut
    const bundleLen = bundleBot - bundleTop;

    state.hoses = [
        {
            id: 'gas', type: 'hose', name: 'REGULATOR',
            x: cx, y: bundleTop + bundleLen * 0.25, w: 40, h: 60,
            hp: HOSE_TYPES.gas.hpMax, maxHp: HOSE_TYPES.gas.hpMax,
            color: HOSE_TYPES.gas.color, destroyed: false,
            hoseType: HOSE_TYPES.gas
        },
        {
            id: 'liquid', type: 'hose', name: 'HOT WATER',
            x: cx, y: bundleTop + bundleLen * 0.50, w: 40, h: 60,
            hp: HOSE_TYPES.liquid.hpMax, maxHp: HOSE_TYPES.liquid.hpMax,
            color: HOSE_TYPES.liquid.color, destroyed: false,
            hoseType: HOSE_TYPES.liquid
        },
        {
            id: 'electrical', type: 'hose', name: 'COMMS LINE',
            x: cx, y: bundleTop + bundleLen * 0.75, w: 40, h: 60,
            hp: HOSE_TYPES.electrical.hpMax, maxHp: HOSE_TYPES.electrical.hpMax,
            color: HOSE_TYPES.electrical.color, destroyed: false,
            hoseType: HOSE_TYPES.electrical
        },
        {
            id: 'aquanaut', type: 'aquanaut', name: 'THE AQUANAUT',
            x: cx, y: cy, w: 40, h: 60,
            hp: AQUANAUT.hpMax, maxHp: AQUANAUT.hpMax,
            color: AQUANAUT.color, destroyed: false
        }
    ];
}

function getAquanaut() { return state.hoses.find(h => h.type === 'aquanaut'); }

function getAliveHoses() { return state.hoses.filter(h => h.type === 'hose' && h.hp > 0); }

function getImpactAltitude(target) {
    return target.y - target.h + 10;
}

// ============================================
// HULL INTEGRITY (Shield replacement)
// ============================================

function drawHullIntegrity(ctx) {
    // Hull integrity is now shown via the aquanaut's helmet glow and cracks
    // No separate dive bell drawing — the hose bundle connects directly to the diver
    if (state.hullHP <= 0) return;

    const aq = getAquanaut();
    if (!aq) return;

    const cx = aq.x;
    const cy = aq.y - 75; // Helmet position (top of 90-unit sprite)

    const color = state.hullHP > 6 ? '#00ff88' : state.hullHP > 3 ? '#ff6600' : '#9d00ff';
    const pulse = Math.sin(Date.now() / 300);

    ctx.save();

    // Hull integrity aura around helmet
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8 + pulse * 4;
    ctx.globalAlpha = 0.3 + pulse * 0.1;
    ctx.stroke();

    ctx.restore();

    drawHullCracks(ctx);
}

function addHullCrack() {
    const aq = getAquanaut();
    const cx = aq ? aq.x : COORD_SYSTEM.width / 2;
    const cy = aq ? aq.y - 75 : COORD_SYSTEM.height - 55;

    const origin = {
        x: cx + (Math.random() - 0.5) * 30,
        y: cy + (Math.random() - 0.5) * 20
    };

    const crack = { x: origin.x, y: origin.y, branches: [], alpha: 1 };
    const num = 2 + Math.floor(Math.random() * 3);

    for (let i = 0; i < num; i++) {
        const angle = (Math.PI * 2 / num) * i + (Math.random() - 0.5) * 0.5;
        const segs = [];
        let px = origin.x, py = origin.y;
        for (let j = 0; j < 4; j++) {
            const a = angle + (Math.random() - 0.5) * 0.8;
            const len = 6 + Math.random() * 8;
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

function drawHullCracks(ctx) {
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

function applyHullDamage(amount, type) {
    if (state.hullHP > 0) {
        state.hullHP -= amount;
        if (state.hullHP < 0) state.hullHP = 0;

        if (type === 'misfire') {
            AudioManager.play('misfire');
            addHullCrack();
        } else if (type === 'impact') {
            AudioManager.play('shieldHit');
            addHullCrack();
            addHullCrack();
            state.streakSinceHullHit = 0;
        }

        if (state.hullHP === 0) {
            AudioManager.play('shieldDown');
            state.bellBreached = true;
            showStatus("HULL BREACH — DIVE BELL COMPROMISED", "impact");
            triggerROV();
        }
    }
    updateHUD();
}

function damageHose(hose, initiator) {
    if (hose.hp <= 0 && hose.type !== 'aquanaut') return;

    AudioManager.play('targetImpact');

    if (hose.type === 'aquanaut') {
        // Aquanaut attacks are handled via suit latch system — not instant damage
        // The creature latches and drains suit integrity over time
        latchCreatureToSuit(initiator);
        return;
    }

    // Flicker the associated diamond red
    flickerDiamond(hose.id);

    hose.hp -= 1;
    if (hose.hp <= 0) {
        hose.destroyed = true;
        hose.destroyedAt = Date.now();
        createExplosion(hose.x, hose.y, '#ff3366', 30);
        AudioManager.play('hoseDown');
        activateHoseFailure(hose);

        state.consecutiveHosesDestroyed++;
        state.streak = 0;
        state.perfectStreak = 0;
        state.perfectMilestonesHit = [];
        state.comebackCounter = 0;
        state.comebackAwarded = false;

        const count = state.consecutiveHosesDestroyed;
        const penalty = count <= 1 ? 0 : Math.max(SCORING.penaltyCap, (count - 1) * -100);
        if (penalty < 0) applyScore(penalty);

        const labels = ['HOSE SEVERED', 'SYSTEM BREACH', 'CRITICAL FAILURE', 'CASCADE FAILURE'];
        const label = labels[Math.min(count - 1, labels.length - 1)];
        const penaltyText = penalty < 0 ? ` ${penalty}` : '';
        showStatus(`${label}${penaltyText} — ${hose.name}`, "impact");
        if (penalty < 0) flashScorePenalty();
    }

    updateHUD();

    // Check if all hoses are destroyed — aquanaut sinks to the abyss
    const aliveHoses = getAliveHoses();
    if (aliveHoses.length === 0) {
        triggerAbyssDeath();
    }
}

function activateHoseFailure(hose) {
    Helmet.arm('damage', (typeof HELMET !== 'undefined') ? HELMET.damageMs : 2400);
    switch (hose.hoseType.id) {
        case 'gas':
            state.gasSevered = true;
            state.suffocationTimer = Date.now();
            showStatus("GAS SUPPLY SEVERED — SUFFOCATION WARNING", "impact");
            break;
        case 'liquid':
            state.liquidSevered = true;
            showStatus("HOT WATER SEVERED — HYPOTHERMIA ONSET", "impact");
            break;
        case 'electrical':
            state.electricalSevered = true;
            AudioManager.enableMusicStatic();
            showStatus("COMMS SEVERED — SONAR GARBLED", "impact");
            break;
    }
}

// ============================================
// CREATURE TYPES & SPAWNING
// ============================================

function getCreatureType() {
    const tierKeys = Object.keys(TIERS);
    const currentTierIdx = tierKeys.indexOf(state.tier);

    let available = Object.entries(CREATURE_TYPES).filter(([key, ct]) => {
        return currentTierIdx >= ct.minTier;
    });

    // Holodeck: filter by active creature types
    if (CONFIG.isHolodeck && godMode.activeCreatureTypes && godMode.activeCreatureTypes.size > 0) {
        const filtered = available.filter(([key]) => godMode.activeCreatureTypes.has(key));
        if (filtered.length > 0) available = filtered;
    }

    const totalWeight = available.reduce((sum, [k, ct]) => sum + ct.spawnWeight, 0);
    let roll = Math.random() * totalWeight;
    for (const [key, ct] of available) {
        roll -= ct.spawnWeight;
        if (roll <= 0) return { key, ...ct };
    }
    // Fallback to first available creature type
    const fallbackKey = Object.keys(CREATURE_TYPES)[0];
    return { key: fallbackKey, ...CREATURE_TYPES[fallbackKey] };
}

// ============================================
// ATTACKER LANE SYSTEM (6 lanes: Q1–Q3 × Left/Right)
// Replaces the old 8-zone vertical spread. The umbilical runs up the screen centre,
// so a lane's OUTER half is the edge side and its INNER half the centre side. Spacing
// rules (config LANES): hard one-attacker-per-lane + a same-side adjacency stagger
// (a target still in its outer half blocks its row±1 neighbours from spawning until it
// crosses inward). See config.js LANES for the geometry/tuning knobs.
// ============================================

// A lane's outer/inner boundary x. Left outer = x < boundary; right outer = x > boundary.
function laneOuterBoundary(side) {
    const half = COORD_SYSTEM.width * 0.5;
    return side === 'L' ? half * LANES.outerFrac : COORD_SYSTEM.width - half * LANES.outerFrac;
}

// Is this attacker still in the OUTER (edge) half of its lane? (TOC/laneless → false.)
function isLaneOuter(c) {
    if (!c || !c.lane || c.isToc) return false;
    const b = laneOuterBoundary(c.lane.side);
    return c.lane.side === 'L' ? c.x < b : c.x > b;
}

// Eligible attacker lanes right now: empty (one-per-lane) AND no same-side vertical
// neighbour still in its outer half (the adjacency stagger). Left/right independent.
function getEligibleLanes() {
    const occupied = { L: {}, R: {} };   // lane currently holds a target
    const outerOcc = { L: {}, R: {} };   // that target is still in its outer half
    for (const c of state.creatures) {
        if (!c.lane || c.isToc) continue;
        occupied[c.lane.side][c.lane.row] = true;
        if (isLaneOuter(c)) outerOcc[c.lane.side][c.lane.row] = true;
    }
    const eligible = [];
    for (const side of ['L', 'R']) {
        for (let row = 1; row <= LANES.rows; row++) {
            if (occupied[side][row]) continue;          // one-per-lane
            if (outerOcc[side][row - 1]) continue;      // upper neighbour still outer → blocked
            if (outerOcc[side][row + 1]) continue;      // lower neighbour still outer → blocked
            eligible.push({ side, row });
        }
    }
    return eligible;
}

// Spawn-Y for a row: within the equal-quarter band, with a little bleed past each line
// (rowOverlap) so the rows don't read as a stiff grid. Clamped on-screen and to the
// attacker region (Q1–Q3; Q4 belongs to the TOC band).
function laneSpawnY(row) {
    const H = COORD_SYSTEM.height;
    const band = H * LANES.rowBandFrac;
    const attackerFloor = H * LANES.rows * LANES.rowBandFrac;   // bottom of Q3 (e.g. 675)
    const lo = Math.max(CONFIG.creatureRadius, (row - 1) * band - LANES.rowOverlap);
    const hi = Math.min(attackerFloor - CONFIG.creatureRadius, row * band + LANES.rowOverlap);
    return lo + Math.random() * Math.max(1, hi - lo);
}

// Weighted target pick for a lane row (LANES.rowTargets), restricted to the live pool;
// falls back to any live target if none of the preferred lifelines are available.
function pickLaneTarget(row, pool) {
    const prefs = (LANES.rowTargets && LANES.rowTargets[row]) || [];
    const weighted = [];
    for (const [id, w] of prefs) {
        const t = pool.find(d => d.id === id);
        if (t) for (let i = 0; i < w; i++) weighted.push(t);
    }
    const src = weighted.length ? weighted : pool;
    return src[Math.floor(Math.random() * src.length)];
}

// ============================================
// CREATURE MOVEMENT ARCHETYPES
// ============================================

function getCreatureMovement(creatureType, sx, sy, target, effectiveSpeed) {
    const dx = target.x - sx;
    const dy = getImpactAltitude(target) - sy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const time = Math.max(2500, 25000 / effectiveSpeed);
    const baseSpeed = (dist / (time / 1000)) * effectiveSpeed * 2;
    const variance = 0.85 + (Math.random() * 0.30);
    const speed = baseSpeed * variance * (creatureType.speedMult || 1);

    return {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        baseSpeed: speed,
        archetype: creatureType.archetype,
        // Archetype-specific params
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleFreq: 1.5 + Math.random() * 1.5,
        wobbleAmp: 30 + Math.random() * 20,
        prevWobble: 0,           // Previous frame wobble offset (for delta-based smooth motion)
        zigzagTimer: 0,
        zigzagDir: Math.random() > 0.5 ? 1 : -1,
        zigzagThreshold: 0.5 + Math.random() * 0.3,  // Roll once, not every frame
        lungeTimer: 0,
        lungePhase: 'approach',
        lungeThreshold: 2.5 + Math.random() * 1.5,   // Roll once, not every frame
        sweepDir: sx < COORD_SYSTEM.width / 2 ? 1 : -1,
        sweepPhase: 0,
        prevSweep: 0
    };
}

function updateCreatureMovement(creature, dt) {
    const mv = creature.movement;
    if (!mv) return;

    // Fled after striking a hose — swim straight off the nearer side edge,
    // ignoring archetype/target. The off-screen cull then removes it.
    if (creature._attacked) {
        creature.x += (creature._fleeVX || 0) * dt;
        creature.y += (creature._fleeVY || 0) * dt;
        return;
    }

    // Base heading toward target (vx, vy already point at target)
    const heading = Math.atan2(mv.vy, mv.vx);
    const perpX = Math.cos(heading + Math.PI / 2);
    const perpY = Math.sin(heading + Math.PI / 2);

    switch (mv.archetype) {
        case 'drift': {
            // Gentle swim with sinusoidal wobble perpendicular to heading
            // Sharks: no wobble — steady, deliberate approach toward target
            const ct = creature.creatureType;
            if (ct && ct.swimAnim === 'shark') {
                creature.x += mv.vx * dt;
                creature.y += mv.vy * dt;
            } else {
                // Non-sharks: wobble perpendicular to heading (jellyfish, etc.)
                mv.wobblePhase += mv.wobbleFreq * dt;
                const wobble = Math.sin(mv.wobblePhase) * mv.wobbleAmp;
                const wobbleDelta = wobble - mv.prevWobble;
                mv.prevWobble = wobble;
                creature.x += mv.vx * dt + perpX * wobbleDelta;
                creature.y += mv.vy * dt + perpY * wobbleDelta;
            }
            break;
        }

        case 'zigzag': {
            // Alternating diagonal cuts while swimming toward target
            mv.zigzagTimer += dt;
            if (mv.zigzagTimer > mv.zigzagThreshold) {
                mv.zigzagTimer = 0;
                mv.zigzagDir *= -1;
                mv.zigzagThreshold = 0.5 + Math.random() * 0.3; // Roll new threshold on flip
            }
            const zzPerp = mv.zigzagDir * mv.baseSpeed * 0.5 * dt;
            creature.x += mv.vx * dt + perpX * zzPerp;
            creature.y += mv.vy * dt + perpY * zzPerp;
            break;
        }

        case 'lunge':
            // Slow approach then sudden fast burst toward target
            if (mv.lungePhase === 'approach') {
                creature.x += mv.vx * 0.3 * dt;
                creature.y += mv.vy * 0.3 * dt;
                mv.lungeTimer += dt;
                if (mv.lungeTimer > mv.lungeThreshold) {
                    mv.lungePhase = 'lunge';
                    mv.lungeTimer = 0;
                }
            } else {
                creature.x += mv.vx * 2.5 * dt;
                creature.y += mv.vy * 2.5 * dt;
                mv.lungeTimer += dt;
                if (mv.lungeTimer > 0.4) {
                    mv.lungePhase = 'approach';
                    mv.lungeTimer = 0;
                    mv.lungeThreshold = 2.5 + Math.random() * 1.5; // Roll new threshold on reset
                }
            }
            break;

        case 'sweep': {
            // Sweep in an arc toward target with smooth undulation
            mv.sweepPhase += dt;
            const sweep = Math.sin(mv.sweepPhase * 2) * 30;
            const sweepDelta = sweep - mv.prevSweep;
            mv.prevSweep = sweep;
            creature.x += mv.vx * 0.8 * dt + perpX * sweepDelta;
            creature.y += mv.vy * 0.8 * dt + perpY * sweepDelta;
            break;
        }

        case 'stealth': {
            // Slow swim toward target, subtle wobble
            mv.wobblePhase += mv.wobbleFreq * dt;
            const stWobble = Math.sin(mv.wobblePhase) * mv.wobbleAmp * 0.3;
            const stDelta = stWobble - mv.prevWobble;
            mv.prevWobble = stWobble;
            creature.x += mv.vx * dt + perpX * stDelta;
            creature.y += mv.vy * dt + perpY * stDelta;
            break;
        }

        case 'tocApproach': {
            // Live (Blue/offloaded) TOC unit: it has left its roam and now CHARGES the
            // diver to attack. It presses straight to contact at a constant slow px/s; the
            // impact check (which now lets live TOC units through) opens the 3-second
            // suit-latch survival window on contact — type the command to repel it, or it
            // takes you (the POISONED kill, §0.9). vx/vy are recomputed from the position
            // delta (reusing the patrol prev-position bookkeeping) so facing (_faceAccum)
            // and pitch read correctly — the head leads into the run.
            const aqA = getAquanaut();
            if (!aqA) { mv.vx = 0; mv.vy = 0; break; }
            const drift = (typeof TOC_DRIFT !== 'undefined') ? TOC_DRIFT.pxPerSec : 14;
            const txA = aqA.x, tyA = getImpactAltitude(aqA);
            const ppxA = (creature._patrolPrevX !== undefined) ? creature._patrolPrevX : creature.x;
            const ppyA = (creature._patrolPrevY !== undefined) ? creature._patrolPrevY : creature.y;
            const dxA = txA - creature.x, dyA = tyA - creature.y;
            const distA = Math.hypot(dxA, dyA);
            const stepA = Math.min(drift * dt, distA);     // constant px/s, never overshoot
            const nxA = distA > 0.01 ? creature.x + (dxA / distA) * stepA : creature.x;
            const nyA = distA > 0.01 ? creature.y + (dyA / distA) * stepA : creature.y;
            mv.vx = dt > 0 ? (nxA - ppxA) / dt : 0;
            mv.vy = dt > 0 ? (nyA - ppyA) / dt : 0;
            creature.x = nxA;
            creature.y = nyA;
            creature._patrolPrevX = nxA;
            creature._patrolPrevY = nyA;
            break;
        }

        case 'tocRoam': {
            // Not-yet-live TOC unit free-roaming Q4: swim toward a random destination
            // spanning the full band width; on arrival (or after repathMs) roll a new
            // one, so the unit cruises the whole horizon like a fish. Constant px/s (reads
            // as a cruise, not an attack). vx/vy from the position delta so facing/pitch
            // lead into the turns. Reuses the _patrolPrev* bookkeeping.
            const aqR = getAquanaut();
            const rspd = mv.roamSpeed || 60;
            const arrive = (typeof TOC_ROAM !== 'undefined') ? TOC_ROAM.arriveDist : 30;
            const repath = (typeof TOC_ROAM !== 'undefined') ? TOC_ROAM.repathMs : 4500;
            mv.roamTimer = (mv.roamTimer || 0) + dt * 1000;
            let dxR = (mv.roamDestX != null ? mv.roamDestX : creature.x) - creature.x;
            let dyR = (mv.roamDestY != null ? mv.roamDestY : creature.y) - creature.y;
            let distR = Math.hypot(dxR, dyR);
            if (distR < arrive || mv.roamTimer > repath) {
                const d = pickTocRoamDest(aqR, creature.x, creature.y);
                mv.roamDestX = d.x; mv.roamDestY = d.y; mv.roamTimer = 0;
                dxR = d.x - creature.x; dyR = d.y - creature.y; distR = Math.hypot(dxR, dyR);
            }

            // ── Mutual clearance — keep TOC challenge boxes from ever bumping ──
            // Each roamer holds a no-go radius equal to the two units' challenge-box
            // half-widths plus clearPad. Any other roamer inside it contributes a
            // push-away vector; if crowded, we abandon the current destination and
            // re-aim to a point AWAY from the crowd (clamped into the band). Because
            // both units run this independently, a head-on pair sees each other and
            // both reverse — they swim apart, then resume random wandering. Entering
            // units (still swimming in off-screen) are exempt so their entry reads clean.
            if (!creature._tocEntering) {
                const clearPad = (typeof TOC_ROAM !== 'undefined' && TOC_ROAM.clearPad != null)
                    ? TOC_ROAM.clearPad : 44;
                const myHalf = (creature.challengeBox && creature.challengeBox.width)
                    ? creature.challengeBox.width / 2 : 60;
                let sepX = 0, sepY = 0, crowded = false;
                for (const other of state.creatures) {
                    if (other === creature || other._tocEntering) continue;
                    if (!other.movement || other.movement.archetype !== 'tocRoam') continue;
                    const oHalf = (other.challengeBox && other.challengeBox.width)
                        ? other.challengeBox.width / 2 : 60;
                    const clearance = myHalf + oHalf + clearPad;
                    const ox = creature.x - other.x, oy = creature.y - other.y;
                    const od = Math.hypot(ox, oy);
                    if (od > 0.01 && od < clearance) {
                        const w = (clearance - od) / clearance;   // closer → stronger push
                        sepX += (ox / od) * w; sepY += (oy / od) * w;
                        crowded = true;
                    }
                }
                if (crowded) {
                    const sLen = Math.hypot(sepX, sepY) || 1;
                    const band = tocRoamBand(aqR);
                    // Retreat target, clamped into the band so the peel-away never
                    // shoves a unit off-screen or up out of Q4.
                    mv.roamDestX = Math.max(band.left, Math.min(band.right, creature.x + (sepX / sLen) * 220));
                    mv.roamDestY = Math.max(band.top,  Math.min(band.bottom, creature.y + (sepY / sLen) * 220));
                    mv.roamTimer = 0;
                    dxR = mv.roamDestX - creature.x; dyR = mv.roamDestY - creature.y;
                    distR = Math.hypot(dxR, dyR);
                }
            }

            const stepR = Math.min(rspd * dt, distR);
            const nxR = distR > 0.01 ? creature.x + (dxR / distR) * stepR : creature.x;
            const nyR = distR > 0.01 ? creature.y + (dyR / distR) * stepR : creature.y;
            const ppxR = (creature._patrolPrevX !== undefined) ? creature._patrolPrevX : creature.x;
            const ppyR = (creature._patrolPrevY !== undefined) ? creature._patrolPrevY : creature.y;
            mv.vx = dt > 0 ? (nxR - ppxR) / dt : 0;
            mv.vy = dt > 0 ? (nyR - ppyR) / dt : 0;
            creature.x = nxR; creature.y = nyR;
            creature._patrolPrevX = nxR; creature._patrolPrevY = nyR;
            break;
        }

        case 'patrol': {
            // TOC units patrol the seabed: a horizontal back-and-forth sweep around
            // their spawn lane (world-anchored — the lane does NOT track the diver)
            // with a gentle vertical bob. vx/vy are recomputed from the position
            // delta so facing/pitch still read correctly (heads lead into the turn).
            mv.patrolPhase += (mv.patrolSpeed || 0.6) * dt;
            mv.bobPhase += (mv.patrolSpeed || 0.6) * 0.5 * dt;
            const baseX = (mv.patrolCenterX != null) ? mv.patrolCenterX : creature.x;
            const baseY = (mv.patrolBaseY != null) ? mv.patrolBaseY : creature.y;
            const nx = baseX + Math.sin(mv.patrolPhase) * (mv.patrolAmp || 120);
            const ny = baseY + Math.sin(mv.bobPhase) * (mv.bobAmp || 14);
            const ppx = creature._patrolPrevX !== undefined ? creature._patrolPrevX : nx;
            const ppy = creature._patrolPrevY !== undefined ? creature._patrolPrevY : ny;
            mv.vx = dt > 0 ? (nx - ppx) / dt : 0;
            mv.vy = dt > 0 ? (ny - ppy) / dt : 0;
            creature.x = nx;
            creature.y = ny;
            creature._patrolPrevX = nx;
            creature._patrolPrevY = ny;
            break;
        }

        default:
            creature.x += mv.vx * dt;
            creature.y += mv.vy * dt;
    }

    // ── FACING — follow the motion that actually happened this frame ──
    // Leaky accumulator with hysteresis: sustained travel flips the sprite,
    // wobble/zigzag jitter (which alternates sign frame to frame) does not.
    // Heads always lead.
    const px = creature._prevX !== undefined ? creature._prevX : creature.x;
    const dxFrame = creature.x - px;
    creature._prevX = creature.x;
    creature._faceAccum = (creature._faceAccum || 0) * 0.88 + dxFrame;
    if (creature._facing === undefined) {
        creature._facing = (mv.vx >= 0) ? 'right' : 'left';
    }
    if (creature._faceAccum > 2.0) creature._facing = 'right';
    else if (creature._faceAccum < -2.0) creature._facing = 'left';

    // ── PITCH — angle the body into the direction of travel ──
    // Computed in "head forward = +x" space; the renderer applies it after
    // any mirror flip so the nose always tilts toward where it is going.
    const spd = Math.hypot(mv.vx, mv.vy);
    let targetPitch = 0;
    if (spd > 1) {
        targetPitch = Math.atan2(mv.vy, Math.abs(mv.vx)) * 0.45;
        targetPitch = Math.max(-0.5, Math.min(0.5, targetPitch));
    }
    // Jellyfish drift upright — they don't pitch like fish do
    if (creature.creatureType && creature.creatureType.swimAnim === 'jellyfish') targetPitch = 0;
    creature._pitch = (creature._pitch || 0) + (targetPitch - (creature._pitch || 0)) * Math.min(1, dt * 3);

    // ── BUBBLE WAKE — faint trail shed behind a moving creature ──
    if (creature._sweepDetected && spd > 30 && Math.random() < 0.12) {
        const back = creature._facing === 'right' ? -1 : 1;
        state.environmentalParticles.push({
            x: creature.x + back * creature.radius * 1.6,
            y: creature.y + (Math.random() - 0.5) * creature.radius,
            vx: back * (0.2 + Math.random() * 0.4),
            vy: -0.3 - Math.random() * 0.5,
            radius: 1 + Math.random() * 1.8,
            color: 'rgba(170, 215, 255, 0.30)',
            life: 0.7, decay: 0.018 + Math.random() * 0.015,
            type: 'wake'
        });
    }
}

// ============================================
// CREATURE SPAWNING
// ============================================

function spawnCreature() {
    // TOC monitor units have their own cadence/cap (maintainTocUnits) and don't count
    // against the normal cross-screen creature cap. Returns true iff a creature spawned —
    // maintainCreatures resets the spawn interval only on a real spawn, so a tick where
    // every lane is blocked simply retries next frame (no dead gap).
    if (state.creatures.filter(c => !c.isToc && !c._attacked).length >= state.maxTargets || state.rebuilding) return false;

    // Pick an eligible lane (one-per-lane + same-side adjacency stagger). If every lane
    // is blocked right now, bail without spawning and let the next frame retry.
    const lanes = getEligibleLanes();
    if (!lanes.length) return false;
    const lane = lanes[Math.floor(Math.random() * lanes.length)];

    // Determine target — hoses and aquanaut are all targetable; the lane row biases which.
    let availableTargets = [];
    const aliveHoses = getAliveHoses();
    const aquanaut = getAquanaut();
    const aquanautTargetable = aquanaut && !aquanaut.destroyed && aquanaut.hp > 0;

    if (aliveHoses.length > 0 && aquanautTargetable) {
        availableTargets = [...aliveHoses, aquanaut];
    } else if (aliveHoses.length > 0) {
        availableTargets = aliveHoses;
    } else if (aquanautTargetable) {
        availableTargets = [aquanaut];
    } else {
        return false;
    }

    // In holodeck, filter by targetable zones
    if (CONFIG.isHolodeck && godMode.targetableZones && godMode.targetableZones.size > 0) {
        const filtered = availableTargets.filter(d => godMode.targetableZones.has(d.id));
        if (filtered.length > 0) availableTargets = filtered;
    }

    const target = pickLaneTarget(lane.row, availableTargets);

    // Enter from the lane's side edge, at the lane row's height (inner-bound from there).
    const fromLeft = lane.side === 'L';
    const sx = fromLeft ? -CONFIG.creatureRadius : COORD_SYSTEM.width + CONFIG.creatureRadius;
    const sy = laneSpawnY(lane.row);

    const creatureType = getCreatureType();

    const tierData = TIERS[state.tier];
    const effectiveSpeed = tierData
        ? tierData.speedMin + Math.random() * (tierData.speedMax - tierData.speedMin)
        : state.speedMult;

    const movement = getCreatureMovement(creatureType, sx, sy, target, effectiveSpeed);
    // Cross-screen creatures never carry the TOC challenge — TOC units spawn only via
    // the circle-beneath-the-Aquanaut monitor (spawnTocCreature). Re-roll past any TOC.
    let specs = getTargetSpecs();
    for (let i = 0; i < 40 && specs && specs.gated; i++) specs = getTargetSpecs();

    AudioManager.play('spawn');

    state.creatures.push({
        id: Date.now() + Math.random(),
        x: sx, y: sy,
        vx: movement.vx,
        vy: movement.vy,
        fromLeft: fromLeft,  // spawn side — used for sprite facing
        lane: lane,          // { side:'L'|'R', row:1..3 } — drives one-per-lane + adjacency spacing
        radius: CONFIG.creatureRadius,
        target,
        unitID: specs.unitID,
        challenge: specs.challenge,
        command: specs.command,
        altCommand: specs.altCommand || null,
        type: specs.type,
        colorChallenge: specs.colorChallenge,
        colorSonar: specs.colorSonar,
        colorUnit: specs.colorUnit || null,          // unit tag: current (predecessor) status colour
        colorUnitNext: specs.colorUnitNext || null,  // unit tag: status to flash to on a successful zap
        chainNext: specs.chainNext || null,
        voice: specs.voice || '',                       // 'cad' = CAD readout | 'radio' = speech bubble
        gated: specs.gated || false,                    // TOC blue-gate target
        gate: specs.gate || null,                       // { colors, hittable, transitions, chevrons, initial }
        gateState: specs.gated ? ((specs.gate && specs.gate.initial) || 'White') : null,
        _gateTimer: specs.gated ? tocOffloadDelay() : 0,
        creatureType: creatureType,
        movement: movement,
        glow: 0.5 + Math.random() * 0.5,
        spawnTime: Date.now(),
        animPhase: Math.random() * Math.PI * 2,
        latched: false,
        latchTimer: 0,
        sonarAngle: Math.random() * Math.PI * 2,
        // Screen-wide sweep detection — creature stays hidden until sweep first crosses it.
        // _chalSweepDetected is the independent latch for the challenge box (its own bearing).
        _sweepDetected: false,
        _chalSweepDetected: false,
        _detectionTime: 0,
        challengeBox: {
            x: sx,
            y: sy,
            vx: 0, vy: 0,
            width: 0, height: 26
        }
    });
    return true;
}

// Per-tier delay (ms) before a TOC unit's box flips to its next offload colour — i.e. how
// long until it goes Blue/active. Driven by the "TOC Offload (Min/Max sec)" CSV columns
// (game_difficulty_progression.csv); falls back to TOC_GATE (40–120 s). Re-rolled per flip,
// so direct White→Blue ≈ one delay, White→Pink→Blue ≈ two.
function tocOffloadDelay() {
    const td = TIERS[state.tier] || {};
    const lo = (td.tocOffloadMin != null) ? td.tocOffloadMin : TOC_GATE.minMs;
    const hi = (td.tocOffloadMax != null) ? td.tocOffloadMax : TOC_GATE.maxMs;
    return lo + Math.random() * Math.max(0, hi - lo);
}

// ── TOC Monitor units ──
// A gated TOC target that free-roams the bottom zone (Q4) below the diver (its own
// cadence/cap, separate from cross-screen creatures). One axis advances on a timer: the
// offload colour (White → Pink → Blue). It becomes LIVE only when it turns Blue
// (offloaded) — the single hittable state; once live it charges the diver to attack.
// Premature typing = a plain "Improper Call Close" miss.

// The Q4 free-roam band for TOC units — full screen width, the bottom zone below the
// diver. Vertical extent from the per-tier "TOC Band Top/Bottom Y%" CSV knobs (defaults
// 0.68 / 0.95), clamped below the diver and on-screen so the 360° sonar sweep can always
// detect a unit.
function tocRoamBand(aq) {
    const W = COORD_SYSTEM.width, H = COORD_SYSTEM.height;
    const td = TIERS[state.tier] || {};
    const topPct = (td.tocBandTopPct != null) ? td.tocBandTopPct : 0.68;
    const botPct = (td.tocBandBotPct != null) ? td.tocBandBotPct : 0.95;
    const aqY = (aq && aq.y) ? aq.y : H * 0.4;
    const top = Math.max(H * Math.min(topPct, botPct), aqY + 35);
    const bottom = Math.min(H * Math.max(topPct, botPct), H - 30);
    const m = (typeof TOC_ROAM !== 'undefined') ? TOC_ROAM.edgeMargin : 40;
    return { left: m, right: W - m, top: top, bottom: Math.max(top + 10, bottom) };
}

// Pick a fresh roam destination across the FULL width of the band, biased to be a real
// trip (not a tiny hop) so units actually sweep the whole horizon.
function pickTocRoamDest(aq, fromX, fromY) {
    const band = tocRoamBand(aq);
    const span = band.right - band.left;
    let bx = band.left + Math.random() * span;
    if (fromX != null && Math.abs(bx - fromX) < span * 0.33) {
        bx = (fromX < (band.left + band.right) / 2)
            ? band.left + span * (0.55 + Math.random() * 0.45)
            : band.left + span * (Math.random() * 0.45);
    }
    const by = band.top + Math.random() * (band.bottom - band.top);
    return { x: bx, y: by };
}

// Q4 (the TOC roam band) is sliced into 8 equal horizontal zones — Q4-1 (leftmost)
// … Q4-8 (rightmost). Returns the 1-based zone index an x-coordinate falls in.
function tocZoneIndex(x, aq) {
    const band = tocRoamBand(aq);
    const span = band.right - band.left;
    if (span <= 0) return 1;
    const i = Math.floor(((x - band.left) / span) * 8) + 1;
    return Math.max(1, Math.min(8, i));
}

// Centre x of a given 1-based Q4 zone — used to steer a unit toward a legal
// activation zone before it is allowed to go live.
function tocZoneCenterX(zone, aq) {
    const band = tocRoamBand(aq);
    const span = band.right - band.left;
    return band.left + span * ((zone - 0.5) / 8);
}

// Roll this unit's allowed activation columns from the CURRENT tier's weighted pairs
// (TOC_ACTIVATION_ZONES). Edge-biased at the surface, centre-biased in the deep.
function pickTocActivationZones() {
    const pairs = (typeof TOC_ZONE_PAIRS !== 'undefined')
        ? TOC_ZONE_PAIRS : [[1, 8], [2, 7], [3, 6], [4, 5]];
    const table = (typeof TOC_ACTIVATION_ZONES !== 'undefined') ? TOC_ACTIVATION_ZONES : null;
    const weights = (table && table[state.tier]) ? table[state.tier] : [70, 30, 0, 0];
    let total = 0;
    for (const w of weights) total += Math.max(0, w || 0);
    if (total <= 0) return pairs[0].slice();
    let r = Math.random() * total;
    for (let i = 0; i < pairs.length; i++) {
        r -= Math.max(0, weights[i] || 0);
        if (r < 0) return pairs[i].slice();
    }
    return pairs[pairs.length - 1].slice();
}

function spawnTocCreature() {
    if (state.rebuilding) return;
    const aq = getAquanaut();
    if (!aq || aq.destroyed || aq.hp <= 0) return;

    // Force a gated (TOC) spec — re-roll getTargetSpecs() until it yields one.
    let specs = null;
    for (let i = 0; i < 80; i++) { const s = getTargetSpecs(); if (s && s.gated) { specs = s; break; } }
    if (!specs) return;

    const tierData = TIERS[state.tier] || {};
    // TOC units are the Tier 1 signature Pufferfish (not a random creature). Falls back to
    // a rolled type only if the puffer type is somehow missing.
    const creatureType = CREATURE_TYPES.pufferfish
        ? { key: 'pufferfish', ...CREATURE_TYPES.pufferfish }
        : getCreatureType();

    // Free-roam the bottom zone (Q4). TOC units are no longer locked to a fixed
    // back-and-forth lane — they wander to random destinations across the FULL width
    // of the band (all the way to both edges) like free fish, rolling a fresh target on
    // arrival (the 'tocRoam' archetype). The band is percent-down-screen, per-tier
    // CSV-tunable ("TOC Band Top/Bottom Y%"), clamped below the diver and on-screen so
    // the 360° sonar sweep can still detect a unit.
    const band = tocRoamBand(aq);
    // Spawn OFF-SCREEN on a random side and swim IN to the band (rather than popping into
    // existence). The 'tocRoam' archetype already steers toward roamDest, so the first
    // destination inside the band pulls the unit on-screen from the edge it entered.
    const spriteW = (creatureType.spriteSize && creatureType.spriteSize.w) ? creatureType.spriteSize.w : CONFIG.creatureRadius * 2;
    const offMargin = spriteW + 60;
    const enterFromLeft = Math.random() < 0.5;
    const sx = enterFromLeft ? -offMargin : COORD_SYSTEM.width + offMargin;
    const sy = band.top + Math.random() * (band.bottom - band.top);

    const movement = getCreatureMovement(creatureType, sx, sy, aq, tierData.speedMin || 1);
    movement.archetype = 'tocRoam';
    movement.roamSpeed = (typeof TOC_ROAM !== 'undefined')
        ? TOC_ROAM.speedMin + Math.random() * Math.max(0, TOC_ROAM.speedMax - TOC_ROAM.speedMin)
        : 60;
    const dest0 = pickTocRoamDest(aq, sx, sy);
    movement.roamDestX = dest0.x;
    movement.roamDestY = dest0.y;
    movement.roamTimer = 0;

    // Total time until this unit goes Blue/active (the per-tier TOC Offload range, 40–120 s).
    // A coin-flip decides the route: via Pink (the >60 m "still waiting" tint → "TOC Completed")
    // or straight White→Blue ("Patient Left for other reason"). Both go live at the SAME bounded
    // time, so activation never exceeds the configured max regardless of route.
    const activateMs = tocOffloadDelay();
    const viaPink = Math.random() < 0.5;

    // Activation-zone rule: a TOC unit may only go LIVE while it sits in one of its
    // allowed Q4 columns, rolled per unit from the current tier's weighted pairs
    // (TOC_ACTIVATION_ZONES). Surface (bubblehopper) commits at the edges — Q4-1/Q4-8
    // 70%, Q4-2/Q4-7 30% — and the allowed columns shift toward the centre (Q4-4/Q4-5)
    // as the dive deepens. Enforced in advanceTocGates.
    const activateZones = pickTocActivationZones();

    AudioManager.play('spawn');

    state.creatures.push({
        id: Date.now() + Math.random(),
        x: sx, y: sy,
        vx: 0, vy: 0,
        fromLeft: dest0.x >= sx,                 // initial swim direction (heading right = "from left")
        radius: CONFIG.creatureRadius,
        target: aq,                                  // the diver — impact is off until the unit goes live, then it attacks
        unitID: specs.unitID,
        challenge: specs.challenge,
        command: specs.command,
        altCommand: specs.altCommand || null,
        type: specs.type,
        colorChallenge: specs.colorChallenge,
        colorSonar: specs.colorSonar,
        colorUnit: specs.colorUnit || null,
        colorUnitNext: specs.colorUnitNext || null,
        chainNext: specs.chainNext || null,
        voice: specs.voice || '',
        gated: true,
        gate: specs.gate || null,
        gateState: 'White',                          // offload colour axis: White → Pink → Blue.
                                                     // Always starts White (not hittable) so a unit
                                                     // never spawns available; Blue = the only hittable state.
        _gateTimer: activateMs,                      // counts down to the Blue/active commit
        _tocActivateMs: activateMs,                  // the full budget (for the half-way Pink flip)
        _tocViaPink: viaPink,                        // true → show Pink en route → "TOC Completed"
        _tocActivateZones: activateZones,            // Q4 zones this unit may go live in (Tier-1 rule)
        creatureType: creatureType,
        movement: movement,
        glow: 0.5 + Math.random() * 0.5,
        spawnTime: Date.now(),
        animPhase: Math.random() * Math.PI * 2,
        latched: false,
        latchTimer: 0,
        sonarAngle: Math.random() * Math.PI * 2,
        _sweepDetected: false,
        _detectionTime: 0,
        // ── TOC Monitor state (offload-colour axis only; chevron ladder retired) ──
        isToc: true,
        tocIsLive: false,                            // true once Blue (offloaded) — the hittable commit
        _tocDespawnTimer: Infinity,                  // never auto-despawn: every unit activates within
                                                     // its bounded budget, then waits to be typed
                                                     // (offload now takes 40–120 s, far longer than
                                                     //  the old recycle window, so culling is retired)
        _tocBedAssigned: Math.random() < (tierData.bedAssignChance || 0),
        _tocPatientLeft: false,                      // reached Blue directly from White (left early)
        _tocImproperFlashUntil: 0,
        _tocEntering: true,                          // spawned off-screen, swimming in — exempt
                                                     // from the off-screen cull until it arrives
        _patrolPrevX: sx,
        _patrolPrevY: sy,
        challengeBox: { x: sx, y: sy, vx: 0, vy: 0, width: 0, height: 26 }
    });
}

// TOC gate timing — a single BOUNDED countdown per gated target (the chevron ladder was
// retired). `_gateTimer` counts down from the unit's total offload budget (tocOffloadDelay,
// the per-tier "TOC Offload" CSV range, 40–120 s) to the Blue/active commit. Units flagged
// `_tocViaPink` flip to Pink at the half-way mark (the >60 m "still waiting" tint → reads as
// "TOC Completed"); the rest stay White then go straight to Blue ("Patient Left for other
// reason"). EITHER route goes live at the same bounded time, so activation never exceeds the
// configured max. gateState stays the single hittable source — until Blue a typed command
// won't match (premature = a plain "Improper Call Close" miss, handled in handleCommand).
function advanceTocGates(dt) {
    for (const c of state.creatures) {
        if (!c.gated || c._chainPhase2 || !c.gate) continue;

        // ── Offload colour axis (the only TOC axis) ──
        if (c.gate.hittable && c.gate.hittable[c.gateState]) continue;  // already Blue/live
        c._gateTimer -= dt * 1000;

        // Cosmetic Pink intermediate once past the half-way point (via-Pink units only).
        if (c._tocViaPink && c.gateState === 'White'
            && c._gateTimer <= (c._tocActivateMs || 0) * 0.5) {
            c.gateState = 'Pink';
            const pcol = c.gate.colors && c.gate.colors['Pink'];
            if (pcol && typeof parsePipeColor === 'function') c.colorChallenge = parsePipeColor(pcol);
        }

        if (c._gateTimer > 0) continue;

        // ── Activation-zone gate ──
        // A TOC unit may only COMMIT (go Blue/live) while it sits in one of its allowed
        // Q4 columns (rolled at spawn from the tier's TOC_ACTIVATION_ZONES — edges at the
        // surface, drifting toward the centre Q4-4/Q4-5 as the dive deepens). If the
        // budget has elapsed but the unit is still in a disallowed column, hold at the
        // ready edge (timer pinned to 0) and steer its roam toward the nearest allowed
        // column, so it commits the instant it arrives.
        if (c.isToc && Array.isArray(c._tocActivateZones)) {
            const aqZ = getAquanaut();
            if (c._tocActivateZones.indexOf(tocZoneIndex(c.x, aqZ)) === -1) {
                c._gateTimer = 0;                        // stay ready — commit on arrival
                let bestZ = c._tocActivateZones[0], bestD = Infinity;
                for (const z of c._tocActivateZones) {
                    const d = Math.abs(tocZoneCenterX(z, aqZ) - c.x);
                    if (d < bestD) { bestD = d; bestZ = z; }
                }
                if (c.movement) {
                    const band = tocRoamBand(aqZ);
                    c.movement.roamDestX = tocZoneCenterX(bestZ, aqZ);
                    c.movement.roamDestY = Math.max(band.top, Math.min(band.bottom, c.y));
                    c.movement.roamTimer = 0;
                }
                continue;                                // not live yet
            }
        }

        // Budget elapsed → OFFLOAD / go Blue (live). via Pink = "TOC Completed"; direct = "Patient Left".
        c.gateState = 'Blue';
        const bcol = c.gate.colors && c.gate.colors['Blue'];
        if (bcol && typeof parsePipeColor === 'function') c.colorChallenge = parsePipeColor(bcol);

        {
            if (c.isToc) {
                c._tocPatientLeft = !c._tocViaPink;
                c.tocIsLive = true;
                c._tocDespawnTimer = Infinity;            // live units stay until zapped
                // Going live: leave the seabed patrol and start a slow creep toward the
                // diver (the 'tocApproach' archetype). Pick a hold angle near the unit's
                // actual approach bearing but nudged to the EMPTIEST arc, so several live
                // units fan out around the diver instead of stacking into one blob (TOC
                // skips collisions and the puffer sprite is wide). Mirrors the patrol-lane
                // de-cluster bestGap loop; offsets stay modest so a unit never has to cross
                // over the diver to reach its hold point.
                const aqLive = getAquanaut();
                if (c.movement) c.movement.archetype = 'tocApproach';
                const baseBearing = aqLive
                    ? Math.atan2(c.y - getImpactAltitude(aqLive), c.x - aqLive.x)
                    : Math.random() * Math.PI * 2;
                const liveAngles = state.creatures
                    .filter(o => o !== c && o.isToc && o.tocIsLive && o._tocStandoffAngle !== undefined)
                    .map(o => o._tocStandoffAngle);
                const ANGLE_OFFSETS = [0, 0.6, -0.6, 1.2, -1.2];
                let bestAng = baseBearing, bestSep = -1;
                for (let k = 0; k < ANGLE_OFFSETS.length; k++) {
                    const cand = baseBearing + ANGLE_OFFSETS[k];
                    let sep = Math.PI;
                    for (let m = 0; m < liveAngles.length; m++) {
                        const d = Math.abs(Math.atan2(Math.sin(cand - liveAngles[m]), Math.cos(cand - liveAngles[m])));
                        if (d < sep) sep = d;
                    }
                    if (sep > bestSep) { bestSep = sep; bestAng = cand; }
                }
                c._tocStandoffAngle = bestAng;
            }
        }
    }
}

// TOC monitor: maintain [tocActiveMin, tocActiveMax] patrolling units on a separate cadence.
// Units are no longer auto-despawned: every unit activates within its bounded offload budget,
// then holds until typed (the old short recycle window would cull units before they could go
// live now that offload takes 40–120 s).
function maintainTocUnits(dt) {
    const aq = getAquanaut();
    if (!aq || aq.destroyed || aq.hp <= 0) return;
    const tierData = TIERS[state.tier] || {};
    const activeMin = tierData.tocActiveMin || 0;
    const activeMax = tierData.tocActiveMax || 0;
    if (activeMax <= 0) return;

    const tocCount = state.creatures.filter(c => c.isToc).length;
    if (state.timers.tocSpawnTimer === undefined) state.timers.tocSpawnTimer = 0;
    state.timers.tocSpawnTimer += dt * 1000;

    if (tocCount < activeMin) {                  // below the floor → spawn immediately
        spawnTocCreature();
        state.timers.tocSpawnTimer = 0;
        return;
    }
    if (tocCount >= activeMax) return;
    const interval = (tierData.tocSpawnMin || 8000) +
        Math.random() * ((tierData.tocSpawnMax || 12000) - (tierData.tocSpawnMin || 8000));
    if (state.timers.tocSpawnTimer >= interval) {
        spawnTocCreature();
        state.timers.tocSpawnTimer = 0;
    }
}

// ============================================
// COM RADIO CALL — the F3/"COM" comment bonus.
// At random idle intervals a single diving bell floats up from the bottom of the screen
// carrying a crew radio call (a statement + KEYWORDS, from com_radio_calls.csv). The
// player logs a comment with `COM <unit#> <comment>` (F3 inserts "COM "); the comment
// just has to contain every keyword (loose, case-insensitive, any order). PURE BONUS:
// answering scores COM_CALL.bonus; ignoring it (the bell drifts off the top) or fumbling
// it costs nothing — no penalty, no streak break. One bell at a time. See COM_CALL config.
// ============================================

// Optional bell sprite — used automatically once the PNG is dropped at COM_CALL.sprite;
// until then drawComCall renders a procedural retro diving bell. A 404 here is expected
// (no art yet) and handled silently.
let comBellImg = null, comBellReady = false;
(function loadComBell() {
    if (typeof COM_CALL === 'undefined' || !COM_CALL.sprite) return;
    const img = new Image();
    img.onload = () => { comBellImg = img; comBellReady = true; };
    img.onerror = () => { comBellReady = false; };   // stay on the procedural placeholder
    img.src = COM_CALL.sprite;
})();

function rollComInterval() {
    return COM_CALL.spawnMinMs + Math.random() * Math.max(0, COM_CALL.spawnMaxMs - COM_CALL.spawnMinMs);
}

function spawnComCall() {
    if (!DATA_COM_CALLS || !DATA_COM_CALLS.length) return;
    const call = DATA_COM_CALLS[Math.floor(Math.random() * DATA_COM_CALLS.length)];
    // Roll a real responding unit (same weighted pool as cross-screen targets).
    const unit = (typeof weightedRandom === 'function' && DATA_UNITS_FULL && DATA_UNITS_FULL.length)
        ? (weightedRandom(DATA_UNITS_FULL).id || '2042')
        : '2042';
    const W = COORD_SYSTEM.width, H = COORD_SYSTEM.height;
    const fx = COM_CALL.startXMin + Math.random() * Math.max(0, COM_CALL.startXMax - COM_CALL.startXMin);
    state.comCall = {
        unitID: String(unit),
        statement: call.statement,
        keywords: call.keywords.slice(),
        x: W * fx,
        y: H + COM_CALL.spriteSize.h,   // start fully below the bottom edge
        riseSpeed: COM_CALL.riseSpeed,
        bobPhase: Math.random() * Math.PI * 2,
        spawnTime: Date.now(),
        flash: 0
    };
    AudioManager.play('spawn');   // placeholder incoming-radio cue (dedicated SFX TBD)
}

function updateComCall(dt) {
    const b = state.comCall;
    if (!b) return;
    // Answered → play the brief confirm flash, then retire the bell and arm the next interval.
    if (b.answered) {
        b.flash = Math.max(0, b.flash - dt * 2.2);
        b.y -= b.riseSpeed * 0.4 * dt;
        if (b.flash <= 0) { state.comCall = null; state.timers.comCallTimer = 0; state.comCallInterval = rollComInterval(); }
        return;
    }
    b.y -= b.riseSpeed * dt;
    b.bobPhase += dt * COM_CALL.bobHz * Math.PI * 2;
    // Drifted off the top, unanswered → just gone. Pure bonus: no penalty, no streak break.
    if (b.y < -COM_CALL.spriteSize.h) {
        state.comCall = null;
        state.timers.comCallTimer = 0;
        state.comCallInterval = rollComInterval();
    }
}

// Spawn cadence: only one bell at a time. When none is active, count idle time toward the
// next rolled interval, then float a fresh bell up.
function maintainComCall(dt) {
    if (typeof COM_CALL === 'undefined' || !COM_CALL.enabled) return;
    if (state.rebuilding) return;
    if (state.comCall) { updateComCall(dt); return; }
    if (state.timers.comCallTimer === undefined) state.timers.comCallTimer = 0;
    if (!state.comCallInterval) state.comCallInterval = rollComInterval();
    state.timers.comCallTimer += dt * 1000;
    if (state.timers.comCallTimer >= state.comCallInterval) {
        spawnComCall();
        state.timers.comCallTimer = 0;
        state.comCallInterval = rollComInterval();
    }
}

function maintainCreatures(dt) {
    if (state.rebuilding) return;

    advanceTocGates(dt);  // TOC gate timing (offload colour: White → Pink → Blue)
    maintainTocUnits(dt); // TOC monitor spawn cadence + despawn

    if (state.timers.spawnTimer === undefined) {
        state.timers.spawnTimer = state.spawnInterval;
    }

    state.timers.spawnTimer += dt * 1000;

    const tierData = TIERS[state.tier];
    const spawnMin = tierData ? tierData.spawnMin : state.spawnInterval;
    const spawnMax = tierData ? tierData.spawnMax : state.spawnInterval;
    const baseInterval = spawnMin + Math.random() * (spawnMax - spawnMin);

    // TOC units don't count against the normal cross-screen cap.
    // Fleeing creatures (struck their target, bolting off-screen) no longer count
    // as live targets — they must not block or throttle new spawns.
    const nonTocCount = state.creatures.filter(c => !c.isToc && !c._attacked).length;
    const effectiveInterval = nonTocCount === 0
        ? baseInterval - 500
        : baseInterval;

    if (nonTocCount < state.maxTargets && state.timers.spawnTimer >= effectiveInterval) {
        // Reset the interval only on a real spawn — if every lane is blocked, hold the
        // timer hot so the next frame retries and a freed lane fills promptly.
        if (spawnCreature()) state.timers.spawnTimer = 0;
    }
}

// ============================================
// CREATURE COLLISION PHYSICS
// ============================================

function resolveCreatureCollisions() {
    const creatures = state.creatures;

    for (let i = 0; i < creatures.length; i++) {
        for (let j = i + 1; j < creatures.length; j++) {
            const a = creatures[i];
            const b = creatures[j];
            if (a.latched || b.latched) continue;
            if (a._attacked || b._attacked) continue;   // fleeing creatures swim straight out — no shove
            if (a.isToc || b.isToc) continue;   // TOC units hold their patrol lane — no push-apart
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const distSq = dx * dx + dy * dy;
            const minDist = a.radius + b.radius;
            if (distSq >= minDist * minDist || distSq === 0) continue;

            const dist = Math.sqrt(distSq);
            const nx = dx / dist;
            const ny = dy / dist;

            // Push apart so they don't overlap
            const push = (minDist - dist) * 0.5;
            a.x -= push * nx;
            a.y -= push * ny;
            b.x += push * nx;
            b.y += push * ny;
        }
    }
}

// ============================================
// PROJECTILES (Sonar Pulses)
// ============================================

function fireProjectile(target) {
    if (state.bellBreached || state.rebuilding) return false;

    const aq = getAquanaut();
    const origin = aq ? { x: aq.x, y: aq.y - 75 } : { x: COORD_SYSTEM.width / 2, y: COORD_SYSTEM.height / 2 };
    const proj = {
        id: Date.now(), x: origin.x, y: origin.y,
        targetId: target.id, speed: CONFIG.sonarPulseSpeed, trail: []
    };
    const dx = target.x - proj.x, dy = target.y - proj.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    proj.vx = (dx / d) * proj.speed;
    proj.vy = (dy / d) * proj.speed;

    AudioManager.play('fire');
    state.projectiles.push(proj);
    return true;
}

function fireBroken() {
    const aq = getAquanaut();
    const origin = aq ? { x: aq.x, y: aq.y - 75 } : { x: COORD_SYSTEM.width / 2, y: COORD_SYSTEM.height / 2 };
    const drift = (Math.random() - 0.5) * 8;
    state.brokenProjectiles.push({
        x: origin.x, y: origin.y,
        vx: drift, vy: -4, g: 0.15, smoke: [], life: 1
    });
}

function createExplosion(x, y, color = '#ff6600', size = 30) {
    state.explosions.push({ x, y, radius: size, max: size * 2, alpha: 1, color });
}

// ============================================
// CREATURE SHATTER VFX
// ============================================

function createShatter(x, y) {
    const shardCount = 10 + Math.floor(Math.random() * 5);
    for (let i = 0; i < shardCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const velocity = 2 + Math.random() * 6;
        state.environmentalParticles.push({
            x, y,
            vx: Math.cos(angle) * velocity,
            vy: Math.sin(angle) * velocity - 2,
            radius: 2 + Math.random() * 4,
            color: 'rgba(100, 200, 255, 0.8)',
            life: 1.0, decay: 0.02 + Math.random() * 0.02,
            type: 'shrapnel'
        });
    }
}

// ============================================
// INPUT HANDLING
// ============================================

// ============================================
// LCARS CAD AUTOCOMPLETE
// ============================================

let autocompleteIndex = -1;
let autocompleteVisible = false;

function updateAutocomplete(inputValue) {
    const dropdown = document.getElementById('autocomplete-dropdown');
    if (!dropdown) return;

    const val = inputValue.trim().toUpperCase();
    // Only show autocomplete when typing a location part (after command + unit)
    const parts = val.split(/\s+/);
    const locPart = parts.length >= 3 ? parts.slice(2).join(' ') : '';

    if (!locPart || locPart.length < 1 || HOSPITAL_ALIAS_LOOKUP.length === 0) {
        hideAutocomplete();
        return;
    }

    // Filter hospital aliases that start with what the user typed
    const matches = HOSPITAL_ALIAS_LOOKUP.filter(h =>
        h.alias.toUpperCase().startsWith(locPart)
    ).slice(0, 6);

    if (matches.length === 0) {
        hideAutocomplete();
        return;
    }

    dropdown.innerHTML = '';
    matches.forEach((m, i) => {
        const item = document.createElement('div');
        item.className = 'ac-item' + (i === autocompleteIndex ? ' ac-selected' : '');
        item.textContent = `${m.alias}  —  ${m.hospitalName}`;
        item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            selectAutocomplete(m.alias);
        });
        dropdown.appendChild(item);
    });

    dropdown.classList.remove('hidden');
    autocompleteVisible = true;
}

function selectAutocomplete(alias) {
    const val = DOM.input.value.trim();
    const parts = val.split(/\s+/);
    // Replace the location part with the selected alias
    if (parts.length >= 3) {
        parts.splice(2, parts.length - 2, alias);
    } else if (parts.length === 2) {
        parts.push(alias);
    }
    DOM.input.value = parts.join(' ');
    hideAutocomplete();
    updatePowerlinePrompt(DOM.input.value);
    DOM.input.focus();
}

function hideAutocomplete() {
    const dropdown = document.getElementById('autocomplete-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
    autocompleteIndex = -1;
    autocompleteVisible = false;
}

// ============================================
// POWERLINE PROMPT (Required Code display)
// ============================================

function updatePowerlinePrompt(inputValue) {
    if (!DOM.powerline || !DOM.powerlineRequired) return;
    const raw = inputValue.toUpperCase();
    const val = raw.trimStart(); // preserve trailing space/comma for segment tracking

    // No input — hide
    if (!val.trim()) { hidePowerlinePrompt(); return; }

    // Extract command code (first token)
    const cmdCode = val.trim().split(/[\s,]+/)[0];
    const pl = DATA_POWERLINE[cmdCode];
    if (!pl || !pl.segments || pl.segments.length === 0) { hidePowerlinePrompt(); return; }

    // Determine which segment is active based on typed input (with trailing delimiters intact)
    const activeIdx = getPowerlineActiveSegment(val, pl.segments);

    // Build HTML
    let html = '';
    let prevCommaGroup = 0;
    pl.segments.forEach((seg, i) => {
        // Add comma separator between comma groups
        if (seg.commaGroup > prevCommaGroup) {
            html += '<span class="pl-comma">,</span> ';
            prevCommaGroup = seg.commaGroup;
        } else if (i > 0) {
            html += ' ';
        }

        let cls = '';
        if (i < activeIdx) cls = 'pl-done';
        else if (i === activeIdx) cls = 'pl-active';
        else if (seg.type === 'command') cls = 'pl-command';
        else if (seg.type === 'optional-bracket') cls = 'pl-optional';
        else cls = 'pl-required';

        html += `<span class="${cls}">${escapeHtml(seg.text)}</span>`;
    });

    DOM.powerlineRequired.innerHTML = html;
    if (DOM.powerlineDesc) DOM.powerlineDesc.textContent = pl.description || '';
    DOM.powerline.classList.remove('hidden');

    // Sync floating Command Reference overlay
    updateCommandReference(html, pl.description || '');
}

function getPowerlineActiveSegment(input, segments) {
    // Count typed tokens (space-separated) and comma groups
    // The command itself is segment 0 (auto-matched once typed)
    const hasTrailingSpace = input.endsWith(' ');
    const hasTrailingComma = input.endsWith(',');

    // Split by commas first, then spaces within each group
    const commaGroups = input.split(',');
    const currentCommaGroup = commaGroups.length - 1;

    // Tokens in the current comma group
    const currentGroupText = commaGroups[currentCommaGroup].trim();
    const allTokens = input.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
    const tokenCount = allTokens.length;

    // Find the first segment in the current comma group
    let segmentsInPriorGroups = 0;
    for (let i = 0; i < segments.length; i++) {
        if (segments[i].commaGroup >= currentCommaGroup) break;
        segmentsInPriorGroups++;
    }

    // If trailing comma, jump to first segment of next comma group
    if (hasTrailingComma) {
        for (let i = 0; i < segments.length; i++) {
            if (segments[i].commaGroup === currentCommaGroup) return i;
        }
        return segments.length - 1;
    }

    // Count tokens in prior comma groups
    let tokensInPriorGroups = 0;
    for (let g = 0; g < currentCommaGroup; g++) {
        tokensInPriorGroups += commaGroups[g].trim().split(/\s+/).filter(Boolean).length;
    }

    // Tokens typed in current comma group
    const tokensInGroup = currentGroupText ? currentGroupText.split(/\s+/).filter(Boolean).length : 0;

    // Map token position to segment
    // Segment 0 = command (token 0)
    // After that, each typed token (with trailing space) advances one segment
    // Unless the segment spans multiple tokens (e.g., <Unit List> could be multiple units)

    if (tokenCount === 0) return 0; // typing command

    // If only command typed and no space yet, still on command segment
    if (tokenCount === 1 && !hasTrailingSpace) return 0;

    // After command + space, on segment 1
    // Each additional space-terminated token advances one segment
    // within the current comma group
    const segmentsInCurrentGroup = segments.filter(s => s.commaGroup === currentCommaGroup).length;
    const firstSegInGroup = segments.findIndex(s => s.commaGroup === currentCommaGroup);
    if (firstSegInGroup === -1) return segments.length - 1;

    // For comma group 0: token positions map 1:1 to segments after command
    // Token 0 = command (seg 0), Token 1 = seg 1, etc.
    // But we cap at the last segment in this group
    let segIdx;
    if (currentCommaGroup === 0) {
        segIdx = hasTrailingSpace ? tokenCount : tokenCount - 1;
    } else {
        segIdx = firstSegInGroup + (hasTrailingSpace ? tokensInGroup : Math.max(0, tokensInGroup - 1));
    }

    // Clamp to valid range
    return Math.min(segIdx, segments.length - 1);
}

function hidePowerlinePrompt() {
    if (DOM.powerline) DOM.powerline.classList.add('hidden');
    // Also clear the floating overlay content (but don't hide it — it stays visible as reference)
    if (DOM.cmdRefRequired && DOM.cmdRefOverlay && !DOM.cmdRefOverlay.classList.contains('hidden')) {
        DOM.cmdRefRequired.innerHTML = '<span style="color:#3a5a6a;">Type a command to see reference...</span>';
        if (DOM.cmdRefDesc) DOM.cmdRefDesc.textContent = '';
    }
}

function updateCommandReference(html, description) {
    if (!DOM.cmdRefOverlay || DOM.cmdRefOverlay.classList.contains('hidden')) return;
    if (DOM.cmdRefRequired) DOM.cmdRefRequired.innerHTML = html || '';
    if (DOM.cmdRefDesc) DOM.cmdRefDesc.textContent = description || '';
}

function initCommandReference() {
    const toggle = DOM.cmdRefToggle;
    const overlay = DOM.cmdRefOverlay;
    const titlebar = document.getElementById('cmd-ref-titlebar');
    const closeBtn = document.getElementById('cmd-ref-close');
    if (!toggle || !overlay) return;

    // Default position + size
    let posX = 100, posY = 100;
    let overlayW = 420, overlayH = 100;

    // Try to restore saved position
    try {
        const saved = JSON.parse(localStorage.getItem('cmdRefPos'));
        if (saved) { posX = saved.x; posY = saved.y; overlayW = saved.w || 420; overlayH = saved.h || 100; }
    } catch(e) {}

    function applyPosition() {
        overlay.style.left = posX + 'px';
        overlay.style.top = posY + 'px';
        overlay.style.width = overlayW + 'px';
        overlay.style.height = overlayH + 'px';
    }

    function savePosition() {
        try { localStorage.setItem('cmdRefPos', JSON.stringify({ x: posX, y: posY, w: overlay.offsetWidth, h: overlay.offsetHeight })); } catch(e) {}
    }

    // Toggle button
    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = overlay.classList.contains('hidden');
        if (isHidden) {
            overlay.classList.remove('hidden');
            toggle.classList.add('active');
            applyPosition();
            // Set initial font size based on overlay width
            updateCmdRefFontSize();
            // Populate with current input
            if (DOM.input && DOM.input.value.trim()) {
                updatePowerlinePrompt(DOM.input.value);
            } else {
                DOM.cmdRefRequired.innerHTML = '<span style="color:#3a5a6a;">Type a command to see reference...</span>';
            }
        } else {
            overlay.classList.add('hidden');
            toggle.classList.remove('active');
        }
        // Refocus the input
        if (DOM.input) DOM.input.focus();
    });

    // Close button
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            overlay.classList.add('hidden');
            toggle.classList.remove('active');
            if (DOM.input) DOM.input.focus();
        });
    }

    // Drag by titlebar
    if (titlebar) {
        let dragging = false, dragOffsetX = 0, dragOffsetY = 0;

        titlebar.addEventListener('mousedown', (e) => {
            if (e.target === closeBtn) return;
            dragging = true;
            dragOffsetX = e.clientX - overlay.offsetLeft;
            dragOffsetY = e.clientY - overlay.offsetTop;
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            posX = Math.max(0, e.clientX - dragOffsetX);
            posY = Math.max(0, e.clientY - dragOffsetY);
            overlay.style.left = posX + 'px';
            overlay.style.top = posY + 'px';
        });

        window.addEventListener('mouseup', () => {
            if (dragging) { dragging = false; savePosition(); }
        });
    }

    // Track resize via ResizeObserver to save and scale font
    const ro = new ResizeObserver(() => {
        savePosition();
        updateCmdRefFontSize();
    });
    ro.observe(overlay);

    function updateCmdRefFontSize() {
        // Scale font between 16px (small) and 28px (wide) based on overlay width
        const w = overlay.offsetWidth;
        const fontSize = Math.max(16, Math.min(28, 14 + (w - 260) * 0.04));
        const body = document.getElementById('cmd-ref-body');
        if (body) body.style.fontSize = fontSize.toFixed(1) + 'px';
    }
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function navigateAutocomplete(direction) {
    const dropdown = document.getElementById('autocomplete-dropdown');
    if (!dropdown) return;
    const items = dropdown.querySelectorAll('.ac-item');
    if (items.length === 0) return;

    autocompleteIndex += direction;
    if (autocompleteIndex < 0) autocompleteIndex = items.length - 1;
    if (autocompleteIndex >= items.length) autocompleteIndex = 0;

    items.forEach((el, i) => {
        el.classList.toggle('ac-selected', i === autocompleteIndex);
    });
}

function classifyInputError(input) {
    // Parse input into parts: COMMAND UNIT LOCATION
    const parts = input.split(/\s+/);
    if (parts.length === 0) return { type: 'ERR_EMPTY', message: 'EMPTY TRANSMISSION' };

    const cmdPart = parts[0];
    const unitPart = parts[1] || '';
    const locPart = parts.slice(2).join(' ');

    // Check if command code is valid. The lifecycle stage_ids ARE the command codes
    // (NTF/ENR/ARR/PTC/DPT/ARD/TOC/AVA) — AVA is included so the TOC follow-up isn't
    // flagged "UNKNOWN COMMAND" on a near-miss.
    const knownCommands = new Set(Object.keys(LIFECYCLE_STAGES).map(s => s.toUpperCase()));
    if (knownCommands.size && !knownCommands.has(cmdPart)) {
        return { type: 'ERR_STATUS_MISMATCH', message: `UNKNOWN COMMAND: ${cmdPart}` };
    }

    // Check if unit is valid
    if (unitPart) {
        const knownUnits = new Set(DATA_UNITS_FULL.map(u => u.id.toUpperCase()));
        if (!knownUnits.has(unitPart.toUpperCase())) {
            return { type: 'ERR_UNKNOWN_UNIT', message: `UNKNOWN UNIT: ${unitPart}` };
        }
    }

    // Check if location/alias is valid
    if (locPart) {
        const knownLocs = new Set(DATA_LOCATIONS_FULL.map(l => l.m.toUpperCase()));
        const knownHospAliases = new Set(HOSPITAL_ALIAS_LOOKUP.map(h => h.alias.toUpperCase()));
        const knownIncidents = new Set((DATA_POOLS['Incidents'] || []).map(i => i.toUpperCase()));
        if (!knownLocs.has(locPart.toUpperCase()) && !knownHospAliases.has(locPart.toUpperCase()) && !knownIncidents.has(locPart.toUpperCase())) {
            return { type: 'ERR_BAD_ALIAS', message: `UNRECOGNIZED CODE: ${locPart}` };
        }
    }

    // Generic mismatch — command was valid syntax but didn't match any active target
    return { type: 'ERR_NO_TARGET', message: 'NO MATCHING TARGET' };
}

function normalizeCmd(s) { return s.replace(/\s*,\s*/g, ','); }

// A gated TOC target (step 1) is only clearable once its box reaches a hittable
// gate state (Blue). Premature typing therefore won't match → a plain miss.
function creatureClearable(a) {
    if (a._struck) return false;     // a sonar pulse is already homing in — don't let the same command re-fire/re-score
    if (a._attacked) return false;   // already struck a hose and is fleeing — no longer typeable
    if (a.gated && !a._chainPhase2 && a.gate && a.gate.hittable) {
        return a.gate.hittable[a.gateState] === true;
    }
    return true;
}

function handleCommand(value) {
    // ── COM radio-call comment (the F3/"COM" bonus) ── intercept BEFORE the normal
    // command pipeline so a free-text comment never trips the miss / penalty / jam path.
    // Pure bonus: a non-match here just clears the box with no score change.
    const rawTrim = value.trim();
    if (/^COM\b/i.test(rawTrim)) {
        DOM.input.value = '';
        hideAutocomplete();
        hidePowerlinePrompt();
        if (DOM.blockCursor && DOM.input.parentElement) {
            const inputRect = DOM.input.getBoundingClientRect();
            const boxRect = DOM.input.parentElement.getBoundingClientRect();
            DOM.blockCursor.style.left = (inputRect.left - boxRect.left) + 'px';
        }
        state.backspaces = 0;
        if (!state.rebuilding && !state.killCamActive) handleComCall(rawTrim);
        return;
    }

    const input = normalizeCmd(value.trim().toUpperCase());
    DOM.input.value = '';
    hideAutocomplete();
    hidePowerlinePrompt();
    if (DOM.blockCursor) {
        const inputRect = DOM.input.getBoundingClientRect();
        const boxRect = DOM.input.parentElement.getBoundingClientRect();
        DOM.blockCursor.style.left = (inputRect.left - boxRect.left) + 'px';
    }

    const bs = state.backspaces;
    state.backspaces = 0;

    if (state.rebuilding) {
        showStatus("DIVE BELL REPAIRING — STAND BY", "miss");
        return;
    }

    if (state.killCamActive) return;

    // Check for latched creature commands first (supports altCommand)
    const latchMatch = state.latchedCreatures.find(lc =>
        normalizeCmd(lc.command.toUpperCase()) === input ||
        (lc.altCommand && normalizeCmd(lc.altCommand.toUpperCase()) === input)
    );
    if (latchMatch) {
        if (latchMatch.isSuitLatch) {
            clearSuitLatch(latchMatch);
        } else {
            clearLatchedCreature(latchMatch);
        }
        return;
    }

    // DEV MODE: Empty Enter = auto-hit oldest creature (holodeck only)
    if (input === '' && state.creatures.length > 0 && CONFIG.isHolodeck) {
        const oldest = state.creatures[0];
        if (fireProjectile(oldest)) {
            state.streak++;
            state.streakSinceHullHit++;
            state.consecutiveHosesDestroyed = 0;
            state.comebackCounter++;
            const bh = (TIERS[state.tier] || {}).baseHit || 100;
            state.cleanHits++;
            applyScore(bh);
            showStatus(`SONAR HIT +${bh}`, "hit");
            if (!state.firstBloodAwarded) { state.firstBloodAwarded = true; applyScore(SCORING.firstBloodFlat); }
            updateHUD(); checkTier();
        }
        return;
    } else if (input === '') {
        return;
    }

    // Check mini-sub command (supports altCommand)
    if (state.miniSub && (
        normalizeCmd(state.miniSub.command.toUpperCase()) === input ||
        (state.miniSub.altCommand && normalizeCmd(state.miniSub.altCommand.toUpperCase()) === input)
    )) {
        handleMiniSubHit();
        return;
    }

    // Premature TOC: typing a TOC unit's command before it is Blue/live is a plain miss
    // — status reads "Improper Call Close", state unchanged, NO hull damage, NO score
    // penalty, NO rebreather jam (the attack reaction is the gated combat model).
    // Intercept BEFORE the normal miss path so it never triggers that punishment.
    const prematureToc = state.creatures.find(a =>
        a.isToc && !a.tocIsLive && (
            normalizeCmd(a.command.toUpperCase()) === input ||
            (a.altCommand && normalizeCmd(a.altCommand.toUpperCase()) === input)
        )
    );
    if (prematureToc) {
        prematureToc._tocImproperFlashUntil = Date.now() + 1200;
        showStatus('IMPROPER CALL CLOSE', 'miss');
        state.streak = 0;   // a miss breaks the streak, but costs nothing else
        updateHUD();
        return;
    }

    // Match against active creatures (primary OR alt command). A gated TOC target
    // is skipped until its box is Blue (creatureClearable) → premature typing misses.
    const match = state.creatures.find(a =>
        creatureClearable(a) && (
            normalizeCmd(a.command.toUpperCase()) === input ||
            (a.altCommand && normalizeCmd(a.altCommand.toUpperCase()) === input)
        )
    );

    if (match) {
        if (fireProjectile(match)) {
            match._struck = true;   // lock immediately so a repeated/duplicate command can't re-fire & double-score before the pulse lands
            state.streak++;
            state.streakSinceHullHit++;
            state.consecutiveHosesDestroyed = 0;
            state.comebackCounter++;

            const pts = calcScore(match, bs);
            applyScore(pts.total);

            if (pts.isPerfect) {
                state.cleanHits++;
            }

            if (!state.comebackAwarded && state.comebackCounter >= SCORING.comebackTarget) {
                state.comebackAwarded = true;
                applyScore(SCORING.comebackFlat);
                showStatus(`BACK ONLINE +${SCORING.comebackFlat}`, "bonus");
                updateHUD(); checkTier(); checkCalibration(); checkRegen();
                return;
            }

            showStatus(`+${pts.total}`, "hit");

            const penaltyPrefixes = ['FINGER SLIP','SIGNAL GARBLE','PRESSURE FOG','NITROGEN NARCOSIS'];
            const isPenalty = n => penaltyPrefixes.some(p => n.startsWith(p));
            const bonusNotes = pts.notes.filter(n => !isPenalty(n));
            const penaltyNotes = pts.notes.filter(n => isPenalty(n));

            for (const note of bonusNotes) showStatus(note, "bonus");
            for (const note of penaltyNotes) showStatus(note, "miss");

            const streakText = getKillStreakText(state.streak);
            if (streakText && state.streak === SCORING.killStreakSteps.find(s => s.text === streakText)?.min) {
                showStatus(`${streakText}`, "bonus");
            }

            DOM.input.classList.add('success');
            setTimeout(() => DOM.input.classList.remove('success'), 200);

            checkTier();
            checkCalibration();
            checkRegen();
        } else {
            // Command matched but bell is breached — can't fire
            showStatus("HULL BREACH — SONAR OFFLINE", "miss");
            fireBroken();
        }
    } else {
        // ── MISS: Classify the error and trigger Jammed Rebreather ──
        state.streak = 0;
        state.perfectStreak = 0;
        state.perfectMilestonesHit = [];
        const penalty = Math.max(SCORING.maxPenalty, SCORING.missPenalty);
        applyScore(penalty);

        const errorInfo = classifyInputError(input);

        if (state.hullHP > 0) {
            applyHullDamage(CONFIG.misfireDamage, 'misfire');
        } else {
            fireBroken();
        }

        // Miss feedback: brief status line + error flash (no locking alarm window).
        showStatus(`${errorInfo.type} ${penalty}`, "miss");

        DOM.input.classList.add('error');
        setTimeout(() => DOM.input.classList.remove('error'), 300);
        flashScorePenalty();
    }

    updateHUD();
    checkTier();
}

// Resolve a typed COM comment against the active diving bell. Form: `COM <unit#> <comment>`.
// The comment must contain EVERY keyword (loose, case-insensitive substring, any order).
// PURE BONUS — every failure path here is harmless (no score loss, no streak break, no jam):
//   no active bell → "NO RADIO CALL"; wrong/blank unit → bell stays; missing keywords → retry.
function handleComCall(raw) {
    const b = state.comCall;
    const tokens = raw.split(/\s+/);
    const unit = tokens[1] || '';
    const comment = tokens.slice(2).join(' ');

    if (!b || b.answered) { showStatus('NO RADIO CALL', 'miss'); return; }
    if (unit.toUpperCase() !== String(b.unitID).toUpperCase()) {
        showStatus('CHECK UNIT NUMBER', 'miss'); return;   // bell stays — try again, costs nothing
    }
    const hay = comment.toLowerCase();
    const complete = comment && b.keywords.every(k => hay.includes(k.toLowerCase()));
    if (!complete) { showStatus('COMMENT INCOMPLETE', 'miss'); return; }   // retry, costs nothing

    // Logged — award the bonus and fire the confirm flash (bell retires after it fades).
    applyScore(COM_CALL.bonus);
    showStatus(`COM LOGGED +${COM_CALL.bonus}`, 'bonus');
    AudioManager.play('salvage');   // placeholder positive cue (dedicated COM SFX TBD)
    b.answered = true;
    b.flash = 1;
    state.timers.comCallTimer = 0;
    updateHUD();
}

// ============================================
// SCORING PIPELINE
// ============================================

function calcScore(creature, backspaces) {
    const tierData = TIERS[state.tier];
    const baseHit = tierData ? tierData.baseHit : 100;
    const notes = [];
    let bonusMult = 0;
    let flatBonus = 0;
    let penalty = 0;

    // Perfect (Clean Pulse)
    const isPerfect = backspaces === 0;
    if (isPerfect) {
        bonusMult += SCORING.perfectMult;
        notes.push('CLEAN PULSE');
    }

    // Deep Intercept — creature is far from its target (killed early)
    const distToTarget = creature.target ? Math.sqrt(
        Math.pow(creature.x - creature.target.x, 2) +
        Math.pow(creature.y - creature.target.y, 2)
    ) : 999;
    const maxDist = Math.sqrt(Math.pow(COORD_SYSTEM.width, 2) + Math.pow(COORD_SYSTEM.height, 2));
    if (distToTarget > maxDist * CONFIG.altitudeThreshold) {
        bonusMult += SCORING.earlyMult;
        notes.push('DEEP INTERCEPT');
    }

    // Reflex Save
    if (creature.spawnTime && (Date.now() - creature.spawnTime) < SCORING.speedDemonTime) {
        bonusMult += SCORING.speedDemonMult;
        notes.push('REFLEX SAVE');
    }

    // Close call — creature is very near its target
    if (distToTarget < maxDist * (1 - SCORING.nearMissThreshold)) {
        flatBonus += SCORING.nearMissFlat;
        notes.push('CLOSE CALL!');
    }

    let total = baseHit + Math.floor(baseHit * bonusMult);

    // Kill-streak multiplier
    const streakMult = getKillStreakMultiplier(state.streak);
    if (streakMult > 1) {
        total = Math.floor(total * streakMult);
    }

    // Perfect streak milestones
    const keepsPerfectStreak = backspaces <= 1;
    if (keepsPerfectStreak) {
        if (isPerfect) state.perfectStreak++;
        for (const ms of SCORING.streakMilestones) {
            if (state.perfectStreak >= ms.threshold && !state.perfectMilestonesHit.includes(ms.threshold)) {
                state.perfectMilestonesHit.push(ms.threshold);
                flatBonus += ms.bonus;
                notes.push(`${ms.text} +${ms.bonus}`);
            }
        }
    } else {
        state.perfectStreak = 0;
        state.perfectMilestonesHit = [];
    }

    // First Blood
    if (!state.firstBloodAwarded) {
        state.firstBloodAwarded = true;
        flatBonus += SCORING.firstBloodFlat;
        notes.push('ONLINE');
    }

    total += flatBonus;

    // Typing penalties (re-themed names)
    if (backspaces >= 7) {
        penalty = SCORING.staticJamFlat;
        notes.push(`NITROGEN NARCOSIS ${penalty}`);
    } else if (backspaces >= 5) {
        penalty = SCORING.commsDriftFlat;
        notes.push(`PRESSURE FOG ${penalty}`);
    } else if (backspaces >= 3) {
        penalty = -Math.floor(baseHit * SCORING.signalNoiseMult);
        notes.push(`SIGNAL GARBLE ${penalty}`);
    } else if (backspaces >= 1) {
        penalty = -Math.floor(baseHit * SCORING.keyDustMult);
        notes.push(`FINGER SLIP ${penalty}`);
    }
    total += penalty;

    return { total, notes, isPerfect, streakMult, baseHit };
}

function getKillStreakMultiplier(streak) {
    for (const step of SCORING.killStreakSteps) {
        if (streak >= step.min && streak <= step.max) return step.mult;
    }
    return 1.0;
}

function getKillStreakText(streak) {
    for (const step of SCORING.killStreakSteps) {
        if (streak >= step.min && streak <= step.max) return step.text;
    }
    return '';
}

function applyScore(delta) {
    state.score = Math.max(0, state.score + delta);
}

function checkCalibration() {
    const tierData = TIERS[state.tier];
    if (!tierData) return;
    const scoreInRank = state.score - tierData.min;
    const calibrationsSoFar = Math.floor(scoreInRank / SCORING.calibrationInterval);
    const lastCount = Math.floor((state.lastCalibrationAt - tierData.min) / SCORING.calibrationInterval);
    if (calibrationsSoFar > lastCount && state.score > state.lastCalibrationAt) {
        state.lastCalibrationAt = state.score;
        applyScore(SCORING.calibrationFlat);
        showStatus(`STEADY HANDS +${SCORING.calibrationFlat}`, "bonus");
    }
}

function checkRegen() {
    // Hull doesn't self-regen — only ROV repairs
}

function checkTier() {
    // If holodeck tier override is active, lock to that tier
    if (godMode.overrideTier && TIERS[godMode.overrideTier]) {
        if (state.tier !== godMode.overrideTier) {
            setTier(godMode.overrideTier);
            state.coneAngle = TIERS[godMode.overrideTier].coneAngle || CONFIG.baseConeAngle;
            updateHUD();
        }
        return;
    }
    const newTierKey = getTierForScore(state.score);
    if (!newTierKey || newTierKey === state.tier) return;

    const oldTier = state.tier;
    const data = TIERS[newTierKey];

    setTier(newTierKey);
    state.lastCalibrationAt = state.score;

    // Update cone angle for new depth
    state.coneAngle = data.coneAngle || CONFIG.baseConeAngle;

    const oldData = TIERS[oldTier];
    if (oldData && data.min < oldData.min) {
        showStatus(`ASCENDING: ${data.label || newTierKey.toUpperCase()}`, "impact");
    } else {
        const rankUpBonus = data.baseHit * SCORING.rankUpMult;
        applyScore(rankUpBonus);
        showStatus(`DEEPER! +${rankUpBonus} — ${data.label || newTierKey.toUpperCase()}`, "bonus");
        startZoneTransition(newTierKey);   // §10 zone-entry beat
        Helmet.arm('zone', (typeof HELMET !== 'undefined') ? HELMET.zoneMs : 3000);
    }
    updateHUD();
}

// ============================================
// HUD & STATUS
// ============================================

const vds1Queue = [];
const vds2Queue = [];
let vds1Typing = false;
let vds2Typing = false;

function showStatus(msg, type = '') {
    const numMatch = msg.match(/([+-]\d[\d,]*)/);
    if (numMatch) {
        vds1Queue.push({ msg: numMatch[1], type });
        if (!vds1Typing) processVds1Queue();
        const textPart = msg.replace(numMatch[1], '').replace(/^\s*—?\s*/, '').replace(/\s*—?\s*$/, '').trim();
        if (textPart) {
            vds2Queue.push({ msg: textPart, type });
            if (!vds2Typing) processVds2Queue();
        }
    } else {
        vds2Queue.push({ msg, type });
        if (!vds2Typing) processVds2Queue();
    }
}

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

function typeOnVds(statusEl, containerEl, cursor, msg, type, timerKey, onComplete) {
    if (containerEl) {
        containerEl.className = '';
        containerEl.classList.add(`flash-${type || 'hit'}`);
        setTimeout(() => containerEl.className = '', 150);
    }

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
            if (cursor) setTimeout(() => cursor.classList.add('hidden'), 300);
            if (onComplete) onComplete();
        }
    }
    typeChar();
}

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
    DOM.score.classList.remove('score-negative');

    updateDiamonds();

    const tierData = TIERS[state.tier];
    if (DOM.tier) DOM.tier.textContent = tierData ? tierData.label : state.tier.toUpperCase();

    if (DOM.salvage) DOM.salvage.textContent = state.salvagePoints + (state.repairTokens > 0 ? ` [${state.repairTokens}R]` : '');

    if (DOM.depthValue) {
        const dd = state.descent ? state.descent.displayDepth : getCurrentDepth();
        DOM.depthValue.textContent = Math.floor(dd) + 'm';
    }

    // Update hose status indicators
    updateHoseIndicators();
}

function updateHoseIndicators() {
    state.hoses.forEach(h => {
        if (h.type !== 'hose') return;
        const el = document.getElementById('hose-' + h.hoseType.id);
        if (el) {
            const dot = el.querySelector('.hose-dot');
            if (dot) {
                dot.style.backgroundColor = h.hp > 0 ? h.color : '#333';
                dot.style.boxShadow = h.hp > 0 ? `0 0 10px ${h.color}, 0 0 22px ${h.color}44` : 'none';
            }
        }
    });
}

function updateDiamonds() {
    // Suit integrity bar — reflects aquanaut HP
    updateSuitIntegrityBar();
}

function flickerDiamond(hoseId) {
    // Visual feedback on hose damage — flash the suit bar briefly
    const bar = document.getElementById('suit-bar');
    if (!bar) return;
    bar.style.borderColor = '#ff4444';
    setTimeout(() => { bar.style.borderColor = ''; }, 400);
}

// ============================================
// ROV SYSTEM (replaces Ambulance)
// ============================================

function triggerROV() {
    state.rovDestroyCount++;
    const delaySec = 4 * Math.pow(2, state.rovDestroyCount - 1);
    showStatus(`HULL BREACH — ROV ETA ${delaySec}s`, "impact");

    if (state.rovPendingTimer) clearTimeout(state.rovPendingTimer);
    state.rovPendingTimer = setTimeout(() => {
        state.rovPendingTimer = null;
        startROV();
    }, delaySec * 1000);
}

function startROV() {
    if (state.rov) {
        state.rov = null;
        state.rebuilding = false;
        state.beamActive = false;
    }
    state.bellBreached = true;
    state.rebuilding = true;
    state.repairCount++;

    const aq = getAquanaut();
    const hoverX = aq ? aq.x : COORD_SYSTEM.width / 2;
    const hoverY = aq ? aq.y - 80 : COORD_SYSTEM.height - 100;
    state.rov = {
        x: -100, y: 350,
        vx: 0, vy: 0,
        targetX: hoverX, targetY: hoverY,
        phase: 'incoming',
        phaseStartTime: Date.now(),
        hp: 3
    };
    showStatus("ROV DISPATCHED", "impact");
}

function updateROV(dt) {
    if (!state.rov) return;

    const rov = state.rov;
    const beamTime = CONFIG.sonarDuration * (1 + (state.repairCount - 1) * 0.5);

    const maxSpeed = CONFIG.rovSpeed;
    const seekForce = 3.0;
    const damping = 0.92;
    const arrivalRadius = 15;

    if (rov.phase === 'incoming') {
        const dx = rov.targetX - rov.x;
        const dy = rov.targetY - rov.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        rov.vx += (dx / (dist || 1)) * seekForce * maxSpeed * dt;
        rov.vy += (dy / (dist || 1)) * seekForce * maxSpeed * dt;

        // Creature evasion
        applyCreatureRepulsion(rov, dt);

        rov.vx *= damping;
        rov.vy *= damping;

        const spd = Math.sqrt(rov.vx * rov.vx + rov.vy * rov.vy);
        if (spd > maxSpeed) { rov.vx = (rov.vx / spd) * maxSpeed; rov.vy = (rov.vy / spd) * maxSpeed; }

        rov.x += rov.vx * dt;
        rov.y += rov.vy * dt;

        // Check if creature hit the ROV
        checkROVCreatureCollision();

        if (dist < arrivalRadius) {
            rov.x = rov.targetX;
            rov.y = rov.targetY;
            rov.vx = 0; rov.vy = 0;
            rov.phase = 'repairing';
            rov.phaseStartTime = Date.now();
            state.beamActive = true;
            state.beamTimer = 0;
        }
    } else if (rov.phase === 'repairing') {
        rov.vx = 0; rov.vy = 0;
        state.beamTimer += dt * 1000;
        if (state.beamTimer >= beamTime) {
            state.beamActive = false;
            rov.phase = 'departing';
            rov.phaseStartTime = Date.now();
            rov.targetX = COORD_SYSTEM.width + 150;
            rov.targetY = 350;
            rebuildBell();
        }
    } else if (rov.phase === 'departing') {
        const dx = rov.targetX - rov.x;
        const dy = rov.targetY - rov.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        rov.vx += (dx / (dist || 1)) * seekForce * maxSpeed * dt;
        rov.vy += (dy / (dist || 1)) * seekForce * maxSpeed * dt;

        applyCreatureRepulsion(rov, dt);

        rov.vx *= damping;
        rov.vy *= damping;

        const spd = Math.sqrt(rov.vx * rov.vx + rov.vy * rov.vy);
        if (spd > maxSpeed) { rov.vx = (rov.vx / spd) * maxSpeed; rov.vy = (rov.vy / spd) * maxSpeed; }

        rov.x += rov.vx * dt;
        rov.y += rov.vy * dt;

        if (rov.x > COORD_SYSTEM.width + 100) {
            state.rov = null;
            state.rebuilding = false;
            showStatus("DIVE BELL SEALED — HULL RESTORED", "hit");
        }
    }
}

function applyCreatureRepulsion(rov, dt) {
    const repulsionRadius = 150;
    const repulsionStrength = 600;

    for (const creature of state.creatures) {
        const dx = rov.x - creature.x;
        const dy = rov.y - creature.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < repulsionRadius && dist > 0) {
            const force = repulsionStrength * (1 - dist / repulsionRadius);
            rov.vx += (dx / dist) * force * dt * 0.3;
            rov.vy += (dy / dist) * force * dt;
        }
    }
}

function checkROVCreatureCollision() {
    if (!state.rov || state.rov.phase !== 'incoming') return;
    for (let i = state.creatures.length - 1; i >= 0; i--) {
        const c = state.creatures[i];
        const dx = state.rov.x - c.x;
        const dy = state.rov.y - c.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < c.radius + 25) {
            state.rov.hp--;
            createExplosion(c.x, c.y, '#ff3366', 20);
            removeCreatureAt(i);
            if (state.rov.hp <= 0) {
                showStatus("ROV DESTROYED — REPAIR FAILED", "impact");
                state.rov = null;
                state.rebuilding = false;
                // Trigger another ROV after delay
                triggerROV();
                return;
            }
        }
    }
}

function rebuildBell() {
    state.bellBreached = false;
    state.hullHP = CONFIG.maxHullIntegrity;
    state.cracks = [];
    state.salvagePoints = 0; // Salvage resets on ROV use
    AudioManager.disableMusicStatic();
    updateHUD();
}

// ============================================
// MINI-SUB / SALVAGE ECONOMY
// ============================================

function updateMiniSub(dt) {
    state.miniSubTimer += dt * 1000;

    // Spawn every 30 seconds
    if (!state.miniSub && state.miniSubTimer > 30000) {
        state.miniSubTimer = 0;
        const specs = getTargetSpecs();
        state.miniSub = {
            x: -60,
            y: 80 + Math.random() * 60,
            speed: 80 + Math.random() * 40,
            challenge: specs.challenge,
            command: specs.command,
            altCommand: specs.altCommand || null,
            unitID: specs.unitID
        };
    }

    if (state.miniSub) {
        state.miniSub.x += state.miniSub.speed * dt;
        if (state.miniSub.x > COORD_SYSTEM.width + 80) {
            state.miniSub = null;
        }
    }
}

function handleMiniSubHit() {
    if (!state.miniSub) return;
    state.salvagePoints++;
    const pts = 50;
    applyScore(pts);
    showStatus(`SALVAGE +${pts}`, "bonus");
    createExplosion(state.miniSub.x, state.miniSub.y, '#00ff88', 20);
    state.miniSub = null;

    // Every 3 salvage = 1 repair token
    if (state.salvagePoints >= 3) {
        state.salvagePoints -= 3;
        state.repairTokens++;
        showStatus("REPAIR TOKEN EARNED [1/2/3 TO USE]", "bonus");
    }
    updateHUD();
}

function spendRepairToken(hoseIdx) {
    if (state.repairTokens <= 0) return;
    const hose = state.hoses[hoseIdx];
    if (!hose || hose.type !== 'hose' || hose.hp > 0) return;

    state.repairTokens--;
    hose.hp = hose.maxHp;
    hose.destroyed = false;

    // Undo severed effect
    switch (hose.hoseType.id) {
        case 'gas':
            state.gasSevered = false;
            break;
        case 'liquid':
            state.liquidSevered = false;
            break;
        case 'electrical':
            state.electricalSevered = false;
            AudioManager.disableMusicStatic();
            break;
    }

    showStatus(`${hose.name} REPAIRED`, "bonus");
    createExplosion(hose.x, hose.y, '#00ff88', 25);
    updateHUD();
}

// ============================================
// CREATURE LATCHING
// ============================================

function latchCreature(creature, target) {
    if (!creature.creatureType.canLatch) return false;

    const specs = getTargetSpecs();
    const latched = {
        id: Date.now() + Math.random(),
        x: target.x,
        y: target.y,
        target: target,
        creatureType: creature.creatureType,
        command: specs.command,
        altCommand: specs.altCommand || null,
        challenge: specs.challenge,
        unitID: specs.unitID,
        latchTime: Date.now(),
        animPhase: Math.random() * Math.PI * 2,
        pulsePhase: 0,
        // Keep the live creature object so it can be released back into the swim
        // (same sprite) and bolt away when the hose is severed (see detachLatchAndFlee).
        _origCreature: creature
    };

    state.latchedCreatures.push(latched);
    return true;
}

// A non-latcher that reached a hose strikes it, then peels away: its typing UI
// (unit-ID tag + challenge box) vanishes immediately and it bolts fast off the
// nearer side edge, where the normal off-screen cull removes it. No longer a
// valid target (see creatureClearable), so it can't be typed mid-flight.
function beginFlee(creature) {
    if (creature._attacked) return;
    creature._attacked = true;
    creature.latched = false;
    // Bow out of the live-target economy: free its spawn lane, drop its challenge
    // box out of the repulsion physics, and lock to full size so a still-growing
    // baby doesn't shrink/grow mid-bolt. (Spawn-cap + collision skips are applied
    // at those loops — a fleeing creature must not occupy a slot or be shoved.)
    creature.lane = null;
    creature.growTimer = 1;
    creature._pitch = 0;   // level out — the flee bypass skips the pitch tracker
    if (creature.challengeBox) creature.challengeBox.width = 0;
    // Drop the typing UI now.
    if (creature._sonarEl) creature._sonarEl.style.display = 'none';
    // Flee fast — back the way it came when the entry side is known, else toward
    // the nearer edge (hoses sit dead-centre, so x alone is a coin-flip there).
    const spd = Math.max(Math.hypot(creature.vx || 0, creature.vy || 0), 180);
    const mult = (typeof CONFIG !== 'undefined' && CONFIG.fleeSpeedMult) || 2.6;
    const dir = (creature.fromLeft !== undefined)
        ? (creature.fromLeft ? -1 : 1)
        : (creature.x < COORD_SYSTEM.width / 2 ? -1 : 1);
    creature._fleeVX = dir * spd * mult;
    creature._fleeVY = -spd * 0.12;            // a slight upward bolt as it retreats
    creature._facing = dir < 0 ? 'left' : 'right';
}

// A hose-latched creature releases its grip and swims off once the hose is
// SEVERED (not when the player clears it by typing — that destroys it). Re-uses
// the original creature object stashed at latch time, so it renders as the same
// jellyfish the player saw; beginFlee marks it _attacked + sets the flee velocity,
// and the creature update loop's off-screen cull removes it. Caller must guarantee
// the game isn't ending (no abyss/kill-cam) before invoking.
function detachLatchAndFlee(lc) {
    const c = lc && lc._origCreature;
    if (!c || c._attacked) return false;
    c.x = lc.x;   // resume from the grip point, not its stale pre-latch position
    c.y = lc.y;
    beginFlee(c);
    state.creatures.push(c);
    return true;
}

function clearLatchedCreature(latchedCreature) {
    const idx = state.latchedCreatures.indexOf(latchedCreature);
    if (idx >= 0) {
        state.latchedCreatures.splice(idx, 1);
        createExplosion(latchedCreature.x, latchedCreature.y, '#00ffff', 25);
        createShatter(latchedCreature.x, latchedCreature.y);
        AudioManager.play('hit');
        const pts = 75;
        applyScore(pts);
        showStatus(`CREATURE CLEARED +${pts}`, "hit");
        updateHUD();
    }
}

function updateLatchedCreatures(dt) {
    for (let i = state.latchedCreatures.length - 1; i >= 0; i--) {
        const lc = state.latchedCreatures[i];
        lc.pulsePhase += dt * 3;

        // Suit latches are handled by updateSuitLatchedCreatures — skip here
        if (lc.isSuitLatch) continue;

        // Periodic damage (hose latches only)
        if (Date.now() - lc.latchTime > CONFIG.latchDamageInterval) {
            lc.latchTime = Date.now();
            if (lc.target && lc.target.hp > 0) {
                lc.target.hp -= CONFIG.latchDamageAmount;
                if (lc.target.hp <= 0) {
                    lc.target.hp = 0;
                    lc.target.destroyed = true;
                    createExplosion(lc.target.x, lc.target.y, '#ff3366', 30);
                    AudioManager.play('hoseDown');
                    if (lc.target.hoseType) activateHoseFailure(lc.target);
                    state.latchedCreatures.splice(i, 1);
                    updateHUD();
                    // A latched creature can take the LAST hose — same rule
                    // as a direct strike: all three severed → the long fall.
                    // (Bail BEFORE any flee so nothing is pushed into the death cam.)
                    if (getAliveHoses().length === 0) {
                        triggerAbyssDeath();
                        return;
                    }
                    // Hose cut, dive continues → release the grip and bolt off-screen.
                    if (!state.abyssDeathActive && !state.killCamActive) detachLatchAndFlee(lc);
                    continue;
                }
            }
        }

        // Target destroyed by something else (another attacker took this hose):
        // release and flee too — unless that sever ended the game — then drop the latch.
        if (lc.target && lc.target.destroyed) {
            if (getAliveHoses().length > 0 && !state.abyssDeathActive && !state.killCamActive) {
                detachLatchAndFlee(lc);
            }
            state.latchedCreatures.splice(i, 1);
        }
    }

    // --- Suit latch drain ---
    updateSuitLatchedCreatures(dt);
}

// ============================================
// SUIT LATCH SYSTEM — creature attacks the diver
// ============================================

function latchCreatureToSuit(creature) {
    const aquanaut = getAquanaut();
    if (!aquanaut || aquanaut.destroyed) return;

    // Prefer the attacker's OWN command/challenge so the survival window shows the command
    // the player was already tracking (TOC unit or cross-screen attacker). Fall back to a
    // fresh roll only if the creature carries no command.
    const specs = (creature && creature.command) ? creature : getTargetSpecs();
    const DIVER_WINDOW = (typeof KILL_SCREEN !== 'undefined' && KILL_SCREEN.diverWindowMs) ? KILL_SCREEN.diverWindowMs : 3000;
    const suitLatched = {
        id: Date.now() + Math.random(),
        x: aquanaut.x,
        y: aquanaut.y,
        target: aquanaut,
        creatureType: creature.creatureType,
        command: specs.command,
        altCommand: specs.altCommand || null,
        challenge: specs.challenge,
        unitID: specs.unitID,
        latchTime: Date.now(),
        deadline: Date.now() + DIVER_WINDOW,   // single nerve-racking survival window
        windowMs: DIVER_WINDOW,
        animPhase: Math.random() * Math.PI * 2,
        pulsePhase: 0,
        isSuitLatch: true,  // flag to distinguish from hose latches
        fromLeft: creature.fromLeft
    };

    // Each grab is a fresh window, not a cumulative drain — refill the suit
    aquanaut.hp = AQUANAUT.hpMax;

    state.latchedCreatures.push(suitLatched);
    showStatus("CREATURE ON YOU — TYPE THE COMMAND", "impact");
    AudioManager.play('diverAlarm');
    updateSuitIntegrityBar();
    enterGrappleState(suitLatched);
}

function updateSuitLatchedCreatures(dt) {
    const aquanaut = getAquanaut();
    if (!aquanaut) return;

    const suitLatches = state.latchedCreatures.filter(lc => lc.isSuitLatch);
    if (suitLatches.length === 0) return;

    // Single survival window (Andrew's reframing — replaces the cumulative 5-block
    // suit drain). The most-urgent latch drives the countdown UI.
    const now = Date.now();
    let mostUrgent = null, minRemain = Infinity;
    for (const lc of suitLatches) {
        lc.pulsePhase += dt * 5;  // faster pulse for urgency
        const remaining = lc.deadline - now;
        if (remaining < minRemain) { minRemain = remaining; mostUrgent = lc; }
    }

    // Window expired → the creature takes the diver (Player Impact → creature kill screen)
    if (minRemain <= 0 && mostUrgent) {
        if (mostUrgent._grappleOverlay) { mostUrgent._grappleOverlay.remove(); mostUrgent._grappleOverlay = null; }
        const idx = state.latchedCreatures.indexOf(mostUrgent);
        if (idx >= 0) state.latchedCreatures.splice(idx, 1);
        aquanaut.hp = 0;
        aquanaut.destroyed = true;
        exitGrappleState();
        triggerKillCam(mostUrgent);
        return;
    }

    // Drive the suit bar + popup blocks down over the window as a visible countdown
    const frac = clamp01(minRemain / (mostUrgent.windowMs || 3000));
    aquanaut.hp = Math.max(1, Math.ceil(frac * AQUANAUT.hpMax));
    updateSuitIntegrityBar();
    updateGrapplePopup();
}

function clearSuitLatch(latchedCreature) {
    const idx = state.latchedCreatures.indexOf(latchedCreature);
    if (idx >= 0) {
        const aq = getAquanaut();
        if (aq) aq.hp = AQUANAUT.hpMax;   // non-cumulative — surviving refills the suit
        // Clean up grapple overlay
        if (latchedCreature._grappleOverlay) {
            latchedCreature._grappleOverlay.remove();
            latchedCreature._grappleOverlay = null;
        }
        state.latchedCreatures.splice(idx, 1);
        createExplosion(latchedCreature.x, latchedCreature.y, '#00ffff', 25);
        createShatter(latchedCreature.x, latchedCreature.y);
        AudioManager.play('hit');
        const pts = 150;  // Higher reward for saving yourself
        applyScore(pts);
        showStatus(`CREATURE REPELLED +${pts}`, "hit");
        updateSuitIntegrityBar();
        updateHUD();
        exitGrappleState();  // Checks if any suit latches remain
    }
}

function updateSuitIntegrityBar() {
    const aquanaut = getAquanaut();
    if (!aquanaut) return;
    const segments = document.querySelectorAll('#suit-bar .suit-segment');
    segments.forEach(seg => {
        const level = parseInt(seg.dataset.level);
        if (level > aquanaut.hp) {
            if (!seg.classList.contains('depleted')) {
                seg.classList.add('draining');
                setTimeout(() => seg.classList.remove('draining'), 400);
            }
            seg.classList.add('depleted');
        } else {
            seg.classList.remove('depleted', 'draining');
        }
    });
}

// ============================================
// GRAPPLE STATE — Adrenaline Focus + Center Popup
// ============================================

function enterGrappleState(suitLatch) {
    state.isGrappling = true;

    // Screen shake
    const wrapper = document.getElementById('canvas-wrapper');
    if (wrapper) wrapper.classList.add('grapple-shake');

    // Show center-screen alarm + the exact command to type
    const popup = document.getElementById('grapple-popup');
    if (popup) popup.classList.remove('hidden');
    const cmdEl = document.getElementById('grapple-command');
    if (cmdEl) cmdEl.textContent = (suitLatch && suitLatch.command) ? suitLatch.command : '';
    updateGrapplePopup();

    // Create adrenaline-focus sonar overlay for the grappled creature
    createGrappleSonarOverlay(suitLatch);
}

function exitGrappleState() {
    // Check if any suit latches remain
    const suitLatches = state.latchedCreatures.filter(lc => lc.isSuitLatch);
    if (suitLatches.length > 0) return;  // Still grappling

    state.isGrappling = false;

    // Remove screen shake
    const wrapper = document.getElementById('canvas-wrapper');
    if (wrapper) wrapper.classList.remove('grapple-shake');

    // Hide center-screen popup
    const popup = document.getElementById('grapple-popup');
    if (popup) popup.classList.add('hidden');
    const cmdEl = document.getElementById('grapple-command');
    if (cmdEl) cmdEl.textContent = '';

    // Remove adrenaline focus from all overlays
    document.querySelectorAll('.sonar-challenge-overlay.adrenaline-focus').forEach(el => el.remove());
}

function updateGrapplePopup() {
    const aquanaut = getAquanaut();
    if (!aquanaut) return;
    const blocks = document.querySelectorAll('#grapple-blocks .grapple-block');
    blocks.forEach(block => {
        const level = parseInt(block.dataset.level);
        if (level > aquanaut.hp) {
            if (!block.classList.contains('depleted')) {
                block.classList.add('draining');
                setTimeout(() => block.classList.remove('draining'), 400);
            }
            block.classList.add('depleted');
        } else {
            block.classList.remove('depleted', 'draining');
        }
    });

    // Update warning text urgency based on HP
    const warning = document.getElementById('grapple-warning');
    if (warning) {
        if (aquanaut.hp <= 1) {
            warning.textContent = 'CRITICAL — TYPE NOW';
            warning.style.color = '#ff3333';
        } else if (aquanaut.hp <= 2) {
            warning.textContent = 'SUIT FAILING — TYPE FAST';
            warning.style.color = '#ff6633';
        } else {
            warning.textContent = 'TYPE COMMAND TO REPEL';
            warning.style.color = '#ff8866';
        }
    }
}

function createGrappleSonarOverlay(suitLatch) {
    const wrapper = document.getElementById('canvas-wrapper');
    if (!wrapper) return;

    // Adrenaline-focus overlay — no separate probe, unit ID is in the challenge box
    const el = document.createElement('div');
    el.className = 'sonar-challenge-overlay adrenaline-focus';
    el.id = `grapple-overlay-${suitLatch.id}`;

    // Challenge text box with unit ID prefix
    const textEl = document.createElement('div');
    textEl.className = 'sonar-challenge-text challenge-visible';

    const unitPrefix = suitLatch.unitID ? `[${suitLatch.unitID}] ` : '';
    const textContent = document.createElement('span');
    textContent.className = 'sonar-challenge-content';
    textContent.textContent = unitPrefix + suitLatch.challenge;
    textEl.appendChild(textContent);

    el.appendChild(textEl);

    // Position near the aquanaut
    const aquanaut = getAquanaut();
    if (aquanaut) {
        suitLatch._grappleOverlay = el;
    }

    wrapper.appendChild(el);
}

function updateGrappleSonarPosition() {
    const aquanaut = getAquanaut();
    if (!aquanaut) return;

    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const wrapper = document.getElementById('canvas-wrapper');
    const wrapperRect = wrapper ? wrapper.getBoundingClientRect() : rect;
    const offsetX = rect.left - wrapperRect.left;
    const offsetY = rect.top - wrapperRect.top;

    // Position grapple overlays beneath the diver
    state.latchedCreatures.forEach(lc => {
        if (!lc.isSuitLatch || !lc._grappleOverlay) return;
        const screenX = offsetX + (aquanaut.x / COORD_SYSTEM.width) * rect.width;
        const screenY = offsetY + ((aquanaut.y + 100) / COORD_SYSTEM.height) * rect.height;
        lc._grappleOverlay.style.transform = `translate3d(${screenX}px, ${screenY}px, 0) translate(-50%, 0)`;
        lc._grappleOverlay.style.setProperty('--creature-gap', '10px');
    });

    // Position grapple popup beneath the diver (below the overlay)
    const popup = document.getElementById('grapple-popup');
    if (popup && !popup.classList.contains('hidden')) {
        const screenX = rect.left + (aquanaut.x / COORD_SYSTEM.width) * rect.width;
        const screenY = rect.top + ((aquanaut.y + 180) / COORD_SYSTEM.height) * rect.height;
        popup.style.left = `${screenX}px`;
        popup.style.top = `${screenY}px`;
        popup.style.transform = 'translateX(-50%)';
    }
}

// ============================================
// VISIBILITY CONE
// ============================================

function isInLightCone(x, y) {
    const aq = getAquanaut();
    const coneOriginX = aq ? aq.x : COORD_SYSTEM.width / 2;
    const coneOriginY = aq ? aq.y : COORD_SYSTEM.height / 2;
    const halfAngle = (state.coneAngle / 2) * (Math.PI / 180);

    const dx = x - coneOriginX;
    const dy = coneOriginY - y; // Y inverted (up is positive)
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return true;
    if (dist > CONFIG.coneRange) return false;

    const angleToCreature = Math.atan2(dx, dy); // angle from vertical
    return Math.abs(angleToCreature) <= halfAngle;
}

// Returns 1 (Surface), 2 (Mid-depth), or 3 (Abyss) for tiered visibility
function getVisibilityTier() {
    const tierKeys = Object.keys(TIERS);
    const idx = tierKeys.indexOf(state.tier);
    if (idx <= 0) return 1;  // bubbleHopper
    if (idx <= 1) return 2;  // rigWalker
    return 3;                // crushDepthOp, theAquanaut
}

// Returns 0..1 representing how far a creature has traveled toward its target zone
function getCreatureProgress(creature) {
    if (!creature.target) return 0;
    const spawnY = 0; // creatures spawn near top
    const targetY = creature.target.y;
    const totalDist = Math.max(targetY - spawnY, 1);
    return Math.min(1, Math.max(0, (creature.y - spawnY) / totalDist));
}

// Horizontal proximity to center Y-axis (where hoses/aquanaut are).
// Returns 0 at the wings (spawn edge), 1 at the center line (impact zone).
function getHorizontalProgress(creature) {
    const centerX = COORD_SYSTEM.width / 2;
    const distFromCenter = Math.abs(creature.x - centerX);
    return Math.min(1, Math.max(0, 1 - distFromCenter / centerX));
}

// Returns true once the screen-wide sonar sweep has crossed the creature
// (sonar blip transitions to visible creature sprite). Pre-detection,
// the creature has no visible sprite and no challenge bubble.
function shouldMorphCreature(creature) {
    return creature && creature._sweepDetected === true;
}

// Level 1 (bubbleHopper): the target SPRITE is fully visible from spawn — the screen
// sweep only gates the box TEXT (unit number + challenge), never the creature itself.
// Deeper tiers stay sonar-gated (a bare blip until the arm crosses them).
function spriteVisibleBeforeSweep() {
    return getVisibilityTier() === 1;
}

function drawVisibilityCone(ctx) {
    const aq = getAquanaut();
    const cx = aq ? aq.x : COORD_SYSTEM.width / 2;
    const cy = aq ? aq.y : COORD_SYSTEM.height / 2;
    const halfAngle = (state.coneAngle / 2) * (Math.PI / 180);
    const range = CONFIG.coneRange;

    ctx.save();

    // Draw cone as a gradient triangle
    const leftX = cx - Math.sin(halfAngle) * range;
    const leftY = cy - Math.cos(halfAngle) * range;
    const rightX = cx + Math.sin(halfAngle) * range;
    const rightY = cy - Math.cos(halfAngle) * range;

    // Create gradient from source to edge
    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, range);
    grad.addColorStop(0, 'rgba(180, 220, 255, 0.12)');
    grad.addColorStop(0.5, 'rgba(120, 160, 200, 0.06)');
    grad.addColorStop(1, 'rgba(60, 80, 100, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(leftX, leftY);
    // Arc at the top
    ctx.arc(cx, cy, range, -Math.PI/2 - halfAngle, -Math.PI/2 + halfAngle);
    ctx.closePath();
    ctx.fill();

    // Cone edge lines
    ctx.strokeStyle = 'rgba(100, 180, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(leftX, leftY);
    ctx.moveTo(cx, cy);
    ctx.lineTo(rightX, rightY);
    ctx.stroke();

    ctx.restore();
}

// ============================================
// DEPTH BACKGROUND
// ============================================

function getDepthColors() {
    const depth = getCurrentDepth();

    // Smooth interpolation between depth color bands
    const bands = [
        { maxDepth: 100,  colors: DEPTH_COLORS.surface },
        { maxDepth: 200,  colors: DEPTH_COLORS.shallow },
        { maxDepth: 500,  colors: DEPTH_COLORS.twilight },
        { maxDepth: 700,  colors: DEPTH_COLORS.midnight },
        { maxDepth: 1500, colors: DEPTH_COLORS.abyss }
    ];

    // Find which two bands we're between
    let lower = bands[0], upper = bands[0];
    let t = 0;
    for (let i = 0; i < bands.length - 1; i++) {
        const prevMax = i === 0 ? 0 : bands[i - 1].maxDepth;
        if (depth <= bands[i].maxDepth) {
            lower = i === 0 ? bands[0] : bands[i - 1];
            upper = bands[i];
            const rangeStart = i === 0 ? 0 : bands[i - 1].maxDepth;
            t = (depth - rangeStart) / (bands[i].maxDepth - rangeStart);
            break;
        }
        if (i === bands.length - 2) {
            lower = bands[i];
            upper = bands[i + 1];
            t = Math.min(1, (depth - bands[i].maxDepth) / (bands[i + 1].maxDepth - bands[i].maxDepth));
        }
    }

    return {
        top: lerpColor(lower.colors.top, upper.colors.top, t),
        bottom: lerpColor(lower.colors.bottom, upper.colors.bottom, t)
    };
}

function lerpColor(hex1, hex2, t) {
    t = Math.max(0, Math.min(1, t || 0)); // Clamp and guard NaN
    const r1 = parseInt(hex1.slice(1, 3), 16), g1 = parseInt(hex1.slice(3, 5), 16), b1 = parseInt(hex1.slice(5, 7), 16);
    const r2 = parseInt(hex2.slice(1, 3), 16), g2 = parseInt(hex2.slice(3, 5), 16), b2 = parseInt(hex2.slice(5, 7), 16);
    const r = Math.round(r1 + (r2 - r1) * t), g = Math.round(g1 + (g2 - g1) * t), b = Math.round(b1 + (b2 - b1) * t);
    return '#' + [r, g, b].map(c => Math.max(0, Math.min(255, c || 0)).toString(16).padStart(2, '0')).join('');
}

function drawDepthBackground(ctx) {
    const colors = getDepthColors();
    const grad = ctx.createLinearGradient(0, 0, 0, COORD_SYSTEM.height);
    grad.addColorStop(0, colors.top);
    grad.addColorStop(1, colors.bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, COORD_SYSTEM.width, COORD_SYSTEM.height);
}

// ============================================
// MARINE SNOW PARTICLES
// ============================================

function updateMarineSnow(dt) {
    // Apparent upward scroll of the water column — the diver is being lowered, so
    // suspended particulate streams up past the (fixed) viewport. Marine snow is
    // the nearest, brightest parallax layer; it gets the full descent speed.
    const dv = getDescentSpeed();

    // Seed a full drifting field once (also re-seeds after a reset clears the array).
    // Particles wrap instead of despawning, so the population stays constant.
    let snowCount = 0;
    for (const p of state.marineSnow) if (!p.isBioluminescent) snowCount++;
    while (snowCount < 85) {
        state.marineSnow.push({
            x: Math.random() * COORD_SYSTEM.width,
            y: Math.random() * COORD_SYSTEM.height,
            vx: (Math.random() - 0.5) * 6,
            vy: 3 + Math.random() * 9,          // slight own sink; descent dominates → net upward
            radius: 0.5 + Math.random() * 1.5,
            alpha: 0.12 + Math.random() * 0.30,
            wobblePhase: Math.random() * Math.PI * 2
        });
        snowCount++;
    }

    // Occasional bioluminescence flash
    if (Math.random() < 0.005) {
        state.marineSnow.push({
            x: Math.random() * COORD_SYSTEM.width,
            y: Math.random() * COORD_SYSTEM.height * 0.7,
            vx: 0, vy: 0,
            radius: 2 + Math.random() * 4,
            alpha: 0.4 + Math.random() * 0.4,
            wobblePhase: 0,
            isBioluminescent: true,
            life: 1.0
        });
    }

    for (let i = state.marineSnow.length - 1; i >= 0; i--) {
        const p = state.marineSnow[i];
        if (p.isBioluminescent) {
            p.life -= dt * 0.5;
            p.alpha = p.life * 0.5;
            if (p.life <= 0) { state.marineSnow.splice(i, 1); continue; }
        } else {
            p.wobblePhase += dt * 2;
            p.x += p.vx * dt + Math.sin(p.wobblePhase) * 3 * dt;
            p.y += (p.vy - dv) * dt;            // descent carries it upward
            // Wrap vertically (and horizontally for slow drift) so the field never thins
            if (p.y < -8) { p.y = COORD_SYSTEM.height + 8; p.x = Math.random() * COORD_SYSTEM.width; }
            else if (p.y > COORD_SYSTEM.height + 8) { p.y = -8; p.x = Math.random() * COORD_SYSTEM.width; }
            if (p.x < -8) p.x = COORD_SYSTEM.width + 8;
            else if (p.x > COORD_SYSTEM.width + 8) p.x = -8;
        }
    }
}

function drawMarineSnow(ctx) {
    // The faster we sink, the longer each mote smears into a vertical streak — the
    // trail points DOWN because the particle is racing up past the fixed viewport.
    const streak = Math.min(16, getDescentSpeed() * 0.09);
    ctx.lineCap = 'round';
    for (const p of state.marineSnow) {
        if (p.isBioluminescent) {
            ctx.fillStyle = `rgba(100, 200, 255, ${p.alpha})`;
            ctx.shadowColor = '#66ccff';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.strokeStyle = `rgba(180, 200, 220, ${p.alpha})`;
            ctx.shadowBlur = 0;
            ctx.lineWidth = p.radius * 1.6;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x, p.y + streak);
            ctx.stroke();
        }
    }
    ctx.shadowBlur = 0;
}

// ============================================
// CONSTANT-DESCENT ILLUSION (see Aquanaut_Depth_Descent_Spec.md)
// The aquanaut is being lowered the whole dive. Everything keys off depthRatio
// (§1): a parallax water column streams upward past the fixed viewport, canyon
// walls scroll past in the gutters, the light dies overhead, the colour cools,
// the vignette tightens, and the depth gauge keeps ticking deeper. All driven
// off score → depthRatio; nothing here touches scoring or spawn logic.
// ============================================

// §1 — normalized descent driver [0..1]: 0 = surface, 1 = abyss. Per-tier anchors,
// eased within each tier so descent reads continuous rather than stepping at rank-up.
function getDepthRatio() {
    if (!state || !state.tier) return 0;
    const order = ['bubblehopper', 'rigwalker', 'crushdepthoperator', 'theaquanaut'];
    const idx = order.indexOf(state.tier);
    if (idx < 0) return 0;
    const tierData = TIERS[state.tier];
    const a0 = (DESCENT.anchors[state.tier] !== undefined) ? DESCENT.anchors[state.tier] : (idx / (order.length - 1));
    let a1, start, end;
    if (idx < order.length - 1) {
        const nextKey = order[idx + 1];
        a1 = (DESCENT.anchors[nextKey] !== undefined) ? DESCENT.anchors[nextKey] : 1;
        start = tierData.min; end = TIERS[nextKey].min;
    } else {
        a1 = 1.0;                       // top tier ramps to the abyss by the soft ceiling
        start = tierData.min; end = DESCENT.topCeilingScore;
    }
    const tp = clamp01((state.score - start) / Math.max(1, end - start));
    const eased = tp * tp * (3 - 2 * tp);   // smoothstep — ease-in/out within the band
    return clamp01(a0 + (a1 - a0) * eased);
}

// Apparent upward scroll of the water column (virtual px/s): faster as we sink,
// with a slow breath so the winch never feels mechanical.
function getDescentSpeed() {
    const phase = state.descent ? state.descent.phase : 0;
    const dr = getDepthRatio();
    const breathe = 1 + Math.sin(phase * 0.6) * DESCENT.breatheAmt;
    return DESCENT.baseSpeed * (1 + (DESCENT.speedDepthGain - 1) * dr) * breathe;
}

function seedDescentField() {
    const motes = [];
    DESCENT.layers.forEach((L, li) => {
        for (let i = 0; i < L.count; i++) {
            motes.push({
                layer: li,
                x: Math.random() * COORD_SYSTEM.width,
                y: Math.random() * COORD_SYSTEM.height,
                r: L.rMin + Math.random() * (L.rMax - L.rMin),
                a: L.aMin + Math.random() * (L.aMax - L.aMin),
                drift: (Math.random() - 0.5) * 6   // slow lateral wander
            });
        }
    });
    state.descent.motes = motes;
    // Sparse rising bubbles — a mid/near accent that reinforces "up = the way out".
    const bubbles = [];
    for (let i = 0; i < DESCENT.bubbleCount; i++) {
        bubbles.push({
            x: Math.random() * COORD_SYSTEM.width,
            y: Math.random() * COORD_SYSTEM.height,
            r: 1.2 + Math.random() * 2.6,
            mult: 0.8 + Math.random() * 0.5,
            wob: Math.random() * Math.PI * 2,
            a: 0.10 + Math.random() * 0.18
        });
    }
    state.descent.bubbles = bubbles;
}

function updateDescent(dt) {
    const d = state.descent;
    if (!d) return;
    d.phase += dt;

    // §7 depth gauge — creeps deeper every frame but stays within this rank's
    // metric band; score-driven depth (base) floors it and jumps it on rank-up.
    const base = getCurrentDepth();
    const tierData = TIERS[state.tier];
    const cap = (tierData && tierData.depthMax !== undefined) ? tierData.depthMax : base + 200;
    const tr = d.transition;
    if (tr) {
        // §10 — the gauge spins up to the new zone's depth during the entry beat.
        tr.timer += dt;
        const p = clamp01(tr.timer / tr.duration);
        const ease = 1 - Math.pow(1 - p, 3);            // easeOutCubic
        const target = Math.max(tr.targetDepth, base);
        d.displayDepth = tr.fromDepth + (target - tr.fromDepth) * ease;
        if (p >= 1) d.transition = null;
    } else {
        d.displayDepth = Math.min(cap, Math.max(d.displayDepth + DESCENT.creepMetersPerSec * dt, base));
    }
    // updateHUD() only fires on scoring events, so refresh the readout here to keep
    // the gauge ticking smoothly between hits.
    if (typeof DOM !== 'undefined' && DOM.depthValue) {
        DOM.depthValue.textContent = Math.floor(d.displayDepth) + 'm';
    }

    // §7 pressure bar + §9 pressure ambience track depthRatio
    const dr = getDepthRatio();
    _updatePressureBar(dr);
    _updateDescentAudio(dt, dr);

    if (!d.motes || d.motes.length === 0) seedDescentField();
    const dv = getDescentSpeed();

    // Canyon walls scroll with the near layer so scenery and particulate sink together.
    d.wallScroll = (d.wallScroll || 0) + dv * DESCENT.walls.scrollMult * dt;

    for (const m of d.motes) {
        m.y -= dv * DESCENT.layers[m.layer].mult * dt;
        m.x += m.drift * dt;
        if (m.y < -8) { m.y = COORD_SYSTEM.height + 8; m.x = Math.random() * COORD_SYSTEM.width; }
        if (m.x < -6) m.x = COORD_SYSTEM.width + 6;
        else if (m.x > COORD_SYSTEM.width + 6) m.x = -6;
    }
    if (d.bubbles) {
        for (const b of d.bubbles) {
            b.wob += dt * 2;
            b.y -= dv * b.mult * dt;
            b.x += Math.sin(b.wob) * 8 * dt;
            if (b.y < -10) { b.y = COORD_SYSTEM.height + 10; b.x = Math.random() * COORD_SYSTEM.width; }
        }
    }
}

function drawDescentField(ctx) {
    const d = state.descent;
    if (!d || !d.motes) return;
    const dv = getDescentSpeed();
    for (const m of d.motes) {
        const L = DESCENT.layers[m.layer];
        ctx.fillStyle = `rgba(${L.color}, ${m.a})`;
        if (L.streak) {
            // Near fast motes blur into short vertical streaks — sells the speed.
            const len = Math.min(34, 4 + dv * L.mult * 0.07);
            ctx.fillRect(m.x - m.r * 0.5, m.y, Math.max(0.6, m.r), len);
        } else {
            ctx.beginPath();
            ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    if (d.bubbles) {
        ctx.lineWidth = 0.8;
        for (const b of d.bubbles) {
            ctx.strokeStyle = `rgba(205,230,240, ${b.a})`;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

// §5 — cold colour wash that strengthens with depth (warm tones absorb first).
// Drawn behind the creatures so their bioluminescent glows still pop at depth.
function drawColdTint(ctx) {
    // TEMP: paused alongside the depth vignette (see drawVignette) — the cold tint was
    // part of the screen creeping darker with depth. Re-enable via `getDepthRatio()`.
    const a = 0 * DESCENT.tintMaxAlpha;   // was getDepthRatio() * DESCENT.tintMaxAlpha
    if (a < 0.005) return;
    ctx.fillStyle = `rgba(${DESCENT.tintColor}, ${a})`;
    ctx.fillRect(0, 0, COORD_SYSTEM.width, COORD_SYSTEM.height);
}

// §6 — overhead god-rays anchored to the top of the screen. As we descend they
// narrow and dim; because the light source stays up there, the brain reads it as
// the diver moving away from the surface.
function drawGodRays(ctx) {
    const dr = getDepthRatio();
    const alpha = DESCENT.rays.baseAlpha * Math.max(0, 1 - dr * DESCENT.rays.fadeByRatio);
    if (alpha < 0.008) return;
    const W = COORD_SYSTEM.width, H = COORD_SYSTEM.height;
    const t = state.descent ? state.descent.phase : 0;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rays = DESCENT.rays.count;
    for (let i = 0; i < rays; i++) {
        const bx = (i + 0.5) / rays * W + Math.sin(t * 0.5 + i) * 30;
        const topW = 40 + i * 8;
        const spread = (120 + i * 30) * (1 - dr * 0.5);
        const len = H * (0.62 - dr * 0.48);
        const g = ctx.createLinearGradient(bx, 0, bx, len);
        g.addColorStop(0, `rgba(150, 210, 225, ${alpha})`);
        g.addColorStop(1, 'rgba(150, 210, 225, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(bx - topW / 2, 0);
        ctx.lineTo(bx + topW / 2, 0);
        ctx.lineTo(bx + spread / 2, len);
        ctx.lineTo(bx - spread / 2, len);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();
}

// §4 — procedural canyon walls in the screen-edge gutters. Deterministic value
// noise gives a jagged rock edge that scrolls seamlessly (no tiling seam); the
// canyon narrows with depth and the walls fall away into the void at the abyss.
function _wallNoise(n) {
    const s = Math.sin(n * 12.9898) * 43758.5453;
    return s - Math.floor(s);                       // 0..1
}
function _rockEdge(worldY, cell) {
    const c = worldY / cell;
    const i = Math.floor(c);
    const f = c - i;
    const fe = f * f * (3 - 2 * f);                  // smooth between cells
    const a = _wallNoise(i), b = _wallNoise(i + 1);
    const jag = a + (b - a) * fe;                    // 0..1
    const undulate = Math.sin(worldY * 0.012);       // large slow sway -1..1
    return jag * 34 + undulate * 18;                 // inward px variation
}
function drawCanyonWalls(ctx) {
    const dr = getDepthRatio();
    const cfg = DESCENT.walls;
    // Walls fall away into the void as we cross into the abyss (the §4 wall-out).
    const wallAlpha = clamp01(1 - Math.max(0, (dr - cfg.outStart) / (1 - cfg.outStart)));
    if (wallAlpha < 0.02) return;

    const W = COORD_SYSTEM.width, H = COORD_SYSTEM.height;
    const scroll = state.descent ? (state.descent.wallScroll || 0) : 0;
    const gutter = cfg.gutter + cfg.narrowGain * dr * dr;   // narrowing canyon (ease-in)
    const step = cfg.sampleStep;
    const zoneT = clamp01(dr / 0.9);
    const rockTop = lerpColor('#6b7b6a', '#0c1014', zoneT);  // pale rock → dark canyon
    const rockBot = lerpColor('#3c4a48', '#05080a', zoneT);

    for (const side of [-1, 1]) {                    // -1 = left gutter, +1 = right
        ctx.save();
        ctx.globalAlpha = wallAlpha;
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, rockTop);
        grad.addColorStop(1, rockBot);
        ctx.fillStyle = grad;
        ctx.beginPath();
        if (side < 0) {
            ctx.moveTo(0, -2);
            for (let y = -2; y <= H + step; y += step) ctx.lineTo(gutter + _rockEdge(y + scroll, cfg.cellSize), y);
            ctx.lineTo(0, H + 2);
        } else {
            ctx.moveTo(W, -2);
            for (let y = -2; y <= H + step; y += step) ctx.lineTo(W - gutter - _rockEdge(y + scroll, cfg.cellSize), y);
            ctx.lineTo(W, H + 2);
        }
        ctx.closePath();
        ctx.fill();

        // Rim light on the inner face so the wall reads 3-D, not a flat block.
        ctx.strokeStyle = `rgba(${dr > 0.5 ? '90,140,170' : '170,200,180'}, ${0.16 * wallAlpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        _drawWallAccents(ctx, side, gutter, scroll, dr, wallAlpha);
        ctx.restore();
    }
}
// Zone flora: kelp fronds in the sunlit shallows, bioluminescent specks in the deep.
function _drawWallAccents(ctx, side, gutter, scroll, dr, wallAlpha) {
    const W = COORD_SYSTEM.width, H = COORD_SYSTEM.height;
    const wrap = (v, span) => ((v % span) + span) % span;

    const kelpA = Math.max(0, 1 - dr / 0.4) * wallAlpha;
    if (kelpA > 0.03) {
        ctx.strokeStyle = `rgba(70,150,90,${0.5 * kelpA})`;
        ctx.lineWidth = 2.5;
        for (let k = 0; k < 5; k++) {
            const yBase = wrap(k * 230 - scroll, H + 260) - 130;
            const xBase = side < 0 ? gutter - 4 : W - gutter + 4;
            ctx.beginPath();
            ctx.moveTo(xBase, yBase);
            for (let s = 1; s <= 6; s++) {
                const yy = yBase - s * 24;
                const xx = xBase + side * (Math.sin(s * 0.7 + yBase * 0.02) * 14 + s * 2);
                ctx.lineTo(xx, yy);
            }
            ctx.stroke();
        }
    }

    const bioA = clamp01((dr - 0.5) / 0.4) * wallAlpha;
    if (bioA > 0.03) {
        const phase = state.descent ? state.descent.phase : 0;
        ctx.shadowColor = '#66ccff';
        ctx.shadowBlur = 6;
        for (let k = 0; k < 9; k++) {
            const yy = wrap(k * 150 + (side < 0 ? 40 : 95) - scroll, H + 60) - 30;
            const xx = side < 0 ? gutter - 8 - (k % 3) * 9 : W - gutter + 8 + (k % 3) * 9;
            const pulse = 0.5 + 0.5 * Math.sin(phase * 2 + k);
            ctx.fillStyle = `rgba(90,200,255,${(0.3 + 0.5 * pulse) * bioA})`;
            ctx.beginPath();
            ctx.arc(xx, yy, 2.2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
    }
}

// §9 — vignette that tightens and darkens with depth (pressure closing in).
// TEMP: depth-driven darkening is paused until levels land — the screen was creeping
// darker as score (→ depthRatio) climbed. Re-enable by restoring `getDepthRatio()`.
function drawVignette(ctx) {
    const dr = 0;   // was getDepthRatio();
    const a = DESCENT.vignetteBaseAlpha + DESCENT.vignetteDepthAlpha * dr;
    const W = COORD_SYSTEM.width, H = COORD_SYSTEM.height;
    const cx = W / 2, cy = H / 2;
    const maxR = Math.max(W, H);
    const inner = maxR * 0.42 * (1 - dr * 0.35);     // closes in with depth
    const outer = maxR * 0.74;
    const g = ctx.createRadialGradient(cx, cy, Math.max(1, inner), cx, cy, outer);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
}

// §10 — kick off a zone-entry beat when a new (deeper) tier is reached.
function startZoneTransition(tierKey) {
    const z = (typeof ZONE_CARDS !== 'undefined') ? ZONE_CARDS[tierKey] : null;
    if (!z || !state.descent) return;
    const td = TIERS[tierKey];
    state.descent.transition = {
        timer: 0,
        duration: DESCENT.transitionDuration,
        fromDepth: state.descent.displayDepth,
        targetDepth: (td && td.depthMin !== undefined) ? td.depthMin : state.descent.displayDepth,
        zone: z
    };
    if (typeof AudioManager !== 'undefined') { try { AudioManager.play('metalGroan'); } catch (e) {} }
}

// §10 — thermocline shimmer wipe + zone card. Drawn in screen space (over the world).
function drawZoneTransition(ctx, W, H) {
    const tr = state.descent && state.descent.transition;
    if (!tr) return;
    const p = clamp01(tr.timer / tr.duration);
    const wipe = clamp01(tr.timer / 0.6);

    ctx.save();
    // Thermocline shimmer: a luminous horizontal band sweeping downward once.
    if (wipe < 1) {
        const bandY = wipe * (H + 200) - 100;
        const bandH = 120;
        const g = ctx.createLinearGradient(0, bandY - bandH, 0, bandY + bandH);
        g.addColorStop(0, 'rgba(130,205,235,0)');
        g.addColorStop(0.5, 'rgba(165,225,245,0.30)');
        g.addColorStop(1, 'rgba(130,205,235,0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = g;
        ctx.fillRect(0, bandY - bandH, W, bandH * 2);
        ctx.globalCompositeOperation = 'source-over';
    }

    // Zone card: fade in, hold, fade out.
    let alpha;
    if (p < 0.18) alpha = p / 0.18;
    else if (p > 0.74) alpha = Math.max(0, (1 - p) / 0.26);
    else alpha = 1;

    const cx = W / 2, cy = H * 0.40;
    const cardW = Math.min(W * 0.62, 700), cardH = Math.max(118, H * 0.18);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.strokeStyle = tr.zone.accent;
    ctx.lineWidth = 2;
    ctx.shadowColor = tr.zone.accent;
    ctx.shadowBlur = 16;
    ctx.strokeRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH);
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(200,230,240,0.92)';
    ctx.font = `${Math.round(H * 0.022)}px "Courier New", monospace`;
    ctx.fillText('▼   ENTERING   ▼', cx, cy - cardH / 2 - 16);

    ctx.fillStyle = tr.zone.accent;
    ctx.font = `bold ${Math.round(H * 0.054)}px "Courier New", monospace`;
    ctx.shadowColor = tr.zone.accent;
    ctx.shadowBlur = 12;
    ctx.fillText(tr.zone.title, cx, cy - 12);
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(190,220,235,0.85)';
    ctx.font = `${Math.round(H * 0.026)}px "Courier New", monospace`;
    ctx.fillText(tr.zone.sub, cx, cy + cardH * 0.26);
    ctx.restore();
}

// §7 — pressure bar HUD creeps green → red with depth.
function _updatePressureBar(dr) {
    if (typeof DOM === 'undefined' || !DOM.pressureFill) return;
    DOM.pressureFill.style.width = Math.round(clamp01(dr) * 100) + '%';
    const hue = 140 - 140 * clamp01(dr);            // 140 green → 0 red
    DOM.pressureFill.style.background = `hsl(${hue}, 85%, 52%)`;
    DOM.pressureFill.style.boxShadow = `0 0 8px hsl(${hue}, 90%, 55%)`;
}

// §9 — depth-scaled ambience: a continuous pressure bed + intermittent hull creaks.
// Audio I can't audition headless — tune DESCENT.creak* / AudioManager.setAmbientDepth to taste.
function _updateDescentAudio(dt, dr) {
    if (typeof AudioManager === 'undefined') return;
    const d = state.descent;
    d._audioThrottle = (d._audioThrottle || 0) - dt;
    if (d._audioThrottle <= 0) {
        try { AudioManager.setAmbientDepth(dr); } catch (e) {}
        d._audioThrottle = 0.25;
    }
    if (d.creakTimer === undefined) d.creakTimer = DESCENT.creakMaxGap;
    d.creakTimer -= dt;
    if (d.creakTimer <= 0) {
        if (dr > 0.12) { try { AudioManager.play('hullCreak'); } catch (e) {} }
        const gap = DESCENT.creakMinGap + (DESCENT.creakMaxGap - DESCENT.creakMinGap) * (1 - clamp01(dr));
        d.creakTimer = gap * (0.6 + Math.random() * 0.8);
    }
}

// ============================================
// AMBIENT SEA LIFE — friendly background fish
// ============================================

function getCurrentDepth() {
    if (!state || !state.tier) return 30;
    const tierData = TIERS[state.tier];
    if (!tierData) return 30;
    // Use depthMin/depthMax if available, otherwise fall back to depth
    const dMin = tierData.depthMin !== undefined ? tierData.depthMin : (tierData.depth || 30);
    const dMax = tierData.depthMax !== undefined ? tierData.depthMax : dMin + 50;
    // Interpolate depth within the tier based on score progress
    const range = (tierData.max === Infinity || !isFinite(tierData.max)) ? 50000 : Math.max(1, tierData.max - tierData.min);
    const tierProgress = Math.min(1, Math.max(0, (state.score - tierData.min) / range));
    const result = dMin + (dMax - dMin) * tierProgress;
    return isNaN(result) ? (tierData.depth || 30) : result;
}

function updateAmbientFish(dt) {
    if (!state.ambientFish) state.ambientFish = [];
    const depth = getCurrentDepth();

    // Spawn ambient fish — enough to feel alive, not overwhelming
    const maxFish = 25;
    const spawnChance = 0.04;
    if (state.ambientFish.length < maxFish && Math.random() < spawnChance) {
        // Find fish species that live at this depth
        const candidates = AMBIENT_FISH.filter(f => depth >= f.minDepth && depth <= f.maxDepth);
        if (candidates.length > 0) {
            const species = candidates[Math.floor(Math.random() * candidates.length)];
            const schoolCount = species.schoolSize[0] + Math.floor(Math.random() * (species.schoolSize[1] - species.schoolSize[0] + 1));
            const fromLeft = Math.random() < 0.5;
            const baseX = fromLeft ? -40 : COORD_SYSTEM.width + 40;
            const baseY = Math.random() * COORD_SYSTEM.height; // Full Y range
            const speed = species.speed[0] + Math.random() * (species.speed[1] - species.speed[0]);
            const dir = fromLeft ? 1 : -1;

            for (let i = 0; i < schoolCount; i++) {
                const size = species.size[0] + Math.random() * (species.size[1] - species.size[0]);
                // Assign sprite type for Tier 1 friendly fish (shallow depths)
                const friendlySpriteTypes = ['clownfish', 'moorishIdol', 'regalTang'];
                let spriteType = null;
                let spriteKey = null;
                if (depth <= 150) {
                    spriteType = friendlySpriteTypes[Math.floor(Math.random() * friendlySpriteTypes.length)];
                    const pool = CREATURE_SPRITES[spriteType];
                    if (pool && pool.length > 0) {
                        const idx = Math.floor(Math.random() * pool.length);
                        spriteKey = `${spriteType}_${idx}`;
                    }
                }

                state.ambientFish.push({
                    x: baseX + (Math.random() - 0.5) * 30 * i,
                    y: baseY + (Math.random() - 0.5) * 40,
                    // Jitter the speed, never the sign — a fish must always
                    // swim the way it faces (head leads)
                    vx: dir * Math.max(species.speed[0] * 0.5, speed + (Math.random() - 0.5) * 8),
                    vy: (Math.random() - 0.5) * 5,
                    size: size,
                    color: species.color,
                    glow: species.glow || null,
                    bodyStyle: species.bodyStyle,
                    phase: Math.random() * Math.PI * 2,
                    dir: dir,
                    alpha: 0.25 + Math.random() * 0.35,
                    spriteType: spriteType,
                    spriteKey: spriteKey,
                    spriteFacing: spriteType && spriteKey ? CREATURE_SPRITES[spriteType][parseInt(spriteKey.split('_').pop())].facing : null,
                    bobPhase: Math.random() * Math.PI * 2
                });
            }
        }
    }

    // Update positions
    for (let i = state.ambientFish.length - 1; i >= 0; i--) {
        const f = state.ambientFish[i];
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.phase += dt * 3;
        if (f.bobPhase !== undefined) f.bobPhase += dt * 2.5;
        // Gentle vertical undulation
        f.y += Math.sin(f.phase) * 5 * dt;

        // Remove when off-screen
        if ((f.dir > 0 && f.x > COORD_SYSTEM.width + 60) ||
            (f.dir < 0 && f.x < -60)) {
            state.ambientFish.splice(i, 1);
        }
    }
}

function drawAmbientFish(ctx) {
    if (!state.ambientFish) return;

    for (const f of state.ambientFish) {
        ctx.save();
        ctx.globalAlpha = f.alpha;
        ctx.translate(f.x, f.y);

        // Sprite-based friendly fish (Tier 1 shallow water)
        if (f.spriteKey && SPRITE_ASSETS[f.spriteKey] && SPRITE_READY[f.spriteKey]) {
            const sprite = SPRITE_ASSETS[f.spriteKey];
            // Friendlies are small — about 60x34 virtual units
            const w = 60;
            const h = 34;

            // Gentle bob animation
            const bob = Math.sin(f.bobPhase) * 3;
            ctx.translate(0, bob);

            // Subtle sway rotation
            const sway = Math.sin(f.bobPhase * 0.7) * 0.05;
            ctx.rotate(sway);

            // Facing logic — from the velocity the fish actually has,
            // matched against the sprite's filename-derived native facing
            const spriteFacesLeft = f.spriteFacing === 'left';  // _ht = head on left
            const needsFaceRight = f.vx >= 0;                   // actual travel direction
            if (spriteFacesLeft === needsFaceRight) {
                ctx.scale(-1, 1);  // native facing disagrees with travel — flip
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
            ctx.restore();
            continue;
        }

        // Flip horizontally based on actual swim direction (procedural fish
        // are drawn nose-right natively)
        if (f.vx < 0) ctx.scale(-1, 1);

        const s = f.size;

        // Bioluminescent glow for deep creatures
        if (f.glow) {
            ctx.shadowColor = f.glow;
            ctx.shadowBlur = 6;
        }

        ctx.fillStyle = f.color;
        ctx.strokeStyle = f.color;

        switch (f.bodyStyle) {
            case 'slim': {
                // Typical fish shape
                const tailWag = Math.sin(f.phase * 2) * 3;
                ctx.beginPath();
                ctx.moveTo(s, 0);                  // Nose
                ctx.quadraticCurveTo(s * 0.5, -s * 0.35, -s * 0.3, -s * 0.15);
                ctx.lineTo(-s, tailWag - s * 0.3); // Tail top
                ctx.lineTo(-s * 0.5, tailWag);     // Tail fork
                ctx.lineTo(-s, tailWag + s * 0.3); // Tail bottom
                ctx.lineTo(-s * 0.3, s * 0.15);
                ctx.quadraticCurveTo(s * 0.5, s * 0.35, s, 0);
                ctx.fill();

                // Eye
                ctx.fillStyle = '#ddd';
                ctx.beginPath();
                ctx.arc(s * 0.6, -s * 0.08, s * 0.08, 0, Math.PI * 2);
                ctx.fill();
                break;
            }

            case 'round': {
                // Rounder body (hatchetfish, isopod, etc.)
                ctx.beginPath();
                ctx.ellipse(0, 0, s * 0.6, s * 0.45, 0, 0, Math.PI * 2);
                ctx.fill();

                // Small tail
                const tw = Math.sin(f.phase * 2) * 2;
                ctx.beginPath();
                ctx.moveTo(-s * 0.5, 0);
                ctx.lineTo(-s * 0.8, tw - s * 0.2);
                ctx.lineTo(-s * 0.8, tw + s * 0.2);
                ctx.closePath();
                ctx.fill();
                break;
            }

            case 'turtle': {
                // Shell
                ctx.beginPath();
                ctx.ellipse(0, -s * 0.05, s * 0.5, s * 0.35, 0, 0, Math.PI * 2);
                ctx.fill();

                // Head
                ctx.fillStyle = '#446633';
                ctx.beginPath();
                ctx.ellipse(s * 0.5, -s * 0.1, s * 0.15, s * 0.1, 0, 0, Math.PI * 2);
                ctx.fill();

                // Flippers paddling
                const paddle = Math.sin(f.phase * 1.5) * 0.4;
                ctx.fillStyle = '#446633';
                ctx.save();
                ctx.rotate(paddle);
                ctx.fillRect(s * 0.1, s * 0.25, s * 0.4, s * 0.08);
                ctx.restore();
                ctx.save();
                ctx.rotate(-paddle);
                ctx.fillRect(s * 0.1, -s * 0.33, s * 0.4, s * 0.08);
                ctx.restore();
                break;
            }

            case 'ray': {
                // Manta ray — wide wings
                const wingFlap = Math.sin(f.phase * 1.2) * 0.15;
                ctx.beginPath();
                ctx.moveTo(s * 0.5, 0);            // Nose
                ctx.quadraticCurveTo(s * 0.2, -s * 0.6 - wingFlap * s, -s * 0.5, -s * 0.4 - wingFlap * s * 1.5);
                ctx.lineTo(-s * 0.4, 0);
                ctx.lineTo(-s * 0.5, s * 0.4 + wingFlap * s * 1.5);
                ctx.quadraticCurveTo(s * 0.2, s * 0.6 + wingFlap * s, s * 0.5, 0);
                ctx.fill();

                // Tail
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-s * 0.4, 0);
                ctx.lineTo(-s, Math.sin(f.phase) * s * 0.1);
                ctx.stroke();
                break;
            }

            case 'squid': {
                // Mantle
                ctx.beginPath();
                ctx.ellipse(s * 0.1, 0, s * 0.35, s * 0.25, 0, 0, Math.PI * 2);
                ctx.fill();

                // Tentacles trailing behind
                ctx.lineWidth = 1.5;
                for (let t = 0; t < 4; t++) {
                    const tentOffset = (t - 1.5) * s * 0.1;
                    const wave = Math.sin(f.phase * 2 + t * 0.8) * 5;
                    ctx.beginPath();
                    ctx.moveTo(-s * 0.2, tentOffset);
                    ctx.quadraticCurveTo(-s * 0.5, tentOffset + wave, -s * 0.8, tentOffset + wave * 1.5);
                    ctx.stroke();
                }

                // Eye
                ctx.fillStyle = '#ddd';
                ctx.beginPath();
                ctx.arc(s * 0.25, -s * 0.05, s * 0.06, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
        }

        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

// ============================================
// HOSE SEVERED EFFECTS
// ============================================

function drawSeveredEffects(ctx) {
    const W = COORD_SYSTEM.width, H = COORD_SYSTEM.height;
    const now = Date.now();

    // Gas severed: fog thickens + breath-starved vignette pulsing with the
    // diver's struggling lungs
    if (state.gasSevered) {
        const elapsed = (now - state.suffocationTimer) / 1000;
        const fogAlpha = Math.min(0.5, elapsed * 0.01);
        ctx.fillStyle = `rgba(100, 100, 100, ${fogAlpha})`;
        ctx.fillRect(0, 0, W, H);

        // Labored-breathing vignette — slow squeeze in and out
        const breath = (Math.sin(now * 0.0018) + 1) / 2;   // 0..1, ~3.5s cycle
        const vin = ctx.createRadialGradient(W / 2, H / 2, H * (0.55 - breath * 0.08), W / 2, H / 2, H * 0.95);
        vin.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vin.addColorStop(1, `rgba(4, 14, 18, ${0.25 + breath * 0.20 + Math.min(0.25, elapsed * 0.005)})`);
        ctx.fillStyle = vin;
        ctx.fillRect(0, 0, W, H);
    }

    // Liquid (hot water) severed: blue frost creeping in from the edges
    if (state.liquidSevered) {
        ctx.fillStyle = 'rgba(80, 120, 200, 0.06)';
        ctx.fillRect(0, 0, W, H);
        const frostGrad = ctx.createRadialGradient(
            W / 2, H / 2, W * 0.3,
            W / 2, H / 2, W * 0.7
        );
        frostGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        frostGrad.addColorStop(1, 'rgba(100, 150, 255, 0.14)');
        ctx.fillStyle = frostGrad;
        ctx.fillRect(0, 0, W, H);

        // Cold shiver — the whole view trembles faintly
        const shiver = Math.sin(now * 0.045) * 1.2;
        ctx.fillStyle = 'rgba(160, 200, 255, 0.025)';
        ctx.fillRect(shiver, 0, W, H);
    }

    // Electrical severed: display interference — scan bands + dropout flicker
    if (state.electricalSevered) {
        if (Math.random() < 0.06) {
            const bandY = Math.random() * H;
            const bandH = 6 + Math.random() * 30;
            ctx.fillStyle = `rgba(255, 255, 255, ${0.04 + Math.random() * 0.07})`;
            ctx.fillRect(0, bandY, W, bandH);
        }
        if (Math.random() < 0.018) {
            // Full-frame dropout blink
            ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
            ctx.fillRect(0, 0, W, H);
        }
    }
}

// ============================================
// CREATURE PROCEDURAL DRAWING
// ============================================

// Pre-detection sonar contact. Before the screen sweep arm has crossed a creature it
// shows NO sprite / unit / challenge — but it DOES read as a faint pulsing sonar blip,
// so the radar gate is unmistakable: a raw contact that only resolves into the full
// target (sprite + Unit + Challenge) once the tracer passes over it.
function drawSonarContactBlip(ctx, creature) {
    if (creature._attacked) return;
    const cs = creature.colorSonar;
    const col = (cs && cs.fg) || '#00FF41';
    const t = Date.now() / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3 + (creature.animPhase || 0));
    ctx.save();
    ctx.translate(creature.x, creature.y);
    ctx.globalAlpha = 0.35 + 0.30 * pulse;            // soft glow dot
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;                                // expanding ping ring
    ctx.globalAlpha = 0.30 * (1 - pulse);
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 6 + pulse * 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

function drawCreatureBody(ctx, creature, time) {
    const ct = creature.creatureType;
    const phase = creature.animPhase + time * 0.003;
    const r = creature.radius;
    const inCone = isInLightCone(creature.x, creature.y);

    // ── Sonar-to-Creature Morph ──
    // The full-screen radar sweep gates visibility: until the arm has crossed
    // this creature's bearing at least once, it stays a bare sonar contact (blip).
    // After the sweep passes, the sprite fades in over SCREEN_SWEEP.morphFadeMs.
    const spriteEarly = spriteVisibleBeforeSweep();
    if (!shouldMorphCreature(creature) && !spriteEarly) {
        creature._morphAlpha = 0;
        drawSonarContactBlip(ctx, creature);
        return;
    }
    const fadeMs = (typeof SCREEN_SWEEP !== 'undefined') ? SCREEN_SWEEP.morphFadeMs : 350;
    let morphProgress;
    if (creature._sweepDetected && !spriteEarly) {
        const elapsedMs = Date.now() - (creature._detectionTime || Date.now());
        morphProgress = Math.max(0, Math.min(1, elapsedMs / fadeMs));
    } else {
        // Level 1 (spriteEarly): the sprite is fully present from spawn, so detection
        // must NOT replay the blip→sprite morph — that briefly collapsed the unit box
        // back into the circular sonar probe as the arm crossed (the "flash into a small
        // sonar bubble" bug). Hold morph at 1 so only the box TEXT obeys the sweep.
        morphProgress = 1;
    }
    creature._morphAlpha = morphProgress;

    // --- Tiered Visibility ---
    const visTier = getVisibilityTier();
    const progress = getCreatureProgress(creature);
    const age = (Date.now() - creature.spawnTime) / 1000; // seconds since spawn

    let creatureAlpha = 1;
    let creatureBlur = 0;

    if (visTier === 2) {
        // Mid-depth: heavy blur that resolves as creature falls
        // Starts at ~8px blur, fully resolved by 70% progress
        creatureBlur = Math.max(0, 8 * (1 - progress / 0.7));
    } else if (visTier === 3) {
        // Abyss: invisible at spawn, fades in as it approaches the zone
        // Fully invisible until 20% progress, fully visible by 80%
        creatureAlpha = Math.min(1, Math.max(0, (progress - 0.2) / 0.6));
    }

    // Combine morph fade-in with tier visibility
    creatureAlpha *= morphProgress;

    // Apply tier visibility filters
    const savedFilter = ctx.filter;
    const savedAlpha = ctx.globalAlpha;

    if (creatureBlur > 0.5) {
        ctx.filter = `blur(${creatureBlur.toFixed(1)}px)`;
    }
    if (creatureAlpha < 1) {
        ctx.globalAlpha = creatureAlpha;
    }

    // Green-screen sprite rendering (chromakeyed PNGs)
    // Prefer the multi-part rig once its art has loaded; otherwise fall back to
    // the single flattened sprite (Option C) — no visual change until rig art exists.
    if (ct.bodyStyle === 'greenscreen' && ct.spriteType) {
        if (rigReady(ct.spriteType)) {
            drawRiggedCreature(ctx, creature, ct, CREATURE_RIGS[ct.spriteType]);
        } else {
            drawGreenscreenCreature(ctx, creature, ct);
        }
        ctx.filter = savedFilter;
        ctx.globalAlpha = savedAlpha;
        return;
    }

    ctx.save();
    ctx.translate(creature.x, creature.y);

    // Growing animation for baby creatures
    if (creature.growTimer !== undefined && creature.growTimer < 1) {
        const s = 0.3 + creature.growTimer * 0.7;
        ctx.scale(s, s);
    }

    // Full creature drawing based on body style
    const accentColor = ct.color.accent;
    const glowColor = ct.color.glow;

    // Bioluminescent glow aura
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 12 + Math.sin(phase) * 5;

    switch (ct.bodyStyle) {
        case 'bell': drawJellyfish(ctx, r, phase, accentColor, glowColor); break;
        case 'spider': drawSeaSpider(ctx, r, phase, accentColor, glowColor); break;
        case 'eel': drawGulperEel(ctx, r, phase, accentColor, glowColor, creature.movement); break;
        case 'tentacle': drawKrakenTentacle(ctx, r, phase, accentColor, glowColor); break;
        case 'angler': drawAnglerfish(ctx, r, phase, accentColor, glowColor); break;
        case 'shark': drawGreatWhite(ctx, r, phase, accentColor, glowColor, creature); break;
        case 'barracuda': drawBarracuda(ctx, r, phase, accentColor, glowColor, creature); break;
        case 'boxjelly': drawBoxJellyfish(ctx, r, phase, accentColor, glowColor, creature); break;
    }

    ctx.shadowBlur = 0;
    ctx.restore();

    // Restore tier visibility filters
    ctx.filter = savedFilter;
    ctx.globalAlpha = savedAlpha;
}

// ── Baseline composite swim (item 1: the always-on motion the parts ride on) ──
// Applies the whole-creature bob/sway/surge/drift for the archetype, in the
// already-facing-mirrored, head-forward space. When `rigged` is true the
// articulation that the rig parts now own (shark tail-drive squash, jelly bell
// squash) is skipped so it isn't doubled; the translational/rotational baseline
// stays. Flat single-sprite output is identical to before (rigged = false).
function applyCreatureSwim(ctx, creature, ct, swimPhase, rigged) {
    const anim = ct.swimAnim || 'default';
    if (anim === 'shark') {
        const sway = Math.sin(swimPhase * 0.6) * 0.02;
        const surge = Math.sin(swimPhase * 1.6 + Math.PI / 3) * 1.2; // forward pulse per tail beat
        ctx.translate(surge, 0);
        ctx.rotate(sway);
        if (!rigged) {
            const tailDrive = 1 + Math.sin(swimPhase * 1.6) * 0.015;
            ctx.scale(tailDrive, 1 / tailDrive);
        }
    } else if (anim === 'moray' || anim === 'barracuda') {
        // Eel weave — sinuous roll + gentle undulation, with a strike twitch
        const bob = Math.sin(swimPhase * 1.6) * 1.4;
        const weave = Math.sin(swimPhase * 1.8) * 0.06;
        const twitch = Math.sin(swimPhase * 5) * Math.max(0, Math.sin(swimPhase * 0.35)) * 1.6;
        ctx.translate(twitch, bob);
        ctx.rotate(weave);
    } else if (anim === 'jellyfish') {
        const bob = Math.sin(swimPhase * 0.5) * 6;
        const drift = Math.sin(swimPhase * 0.3) * 0.03;
        ctx.translate(0, bob);
        ctx.rotate(drift);
        if (!rigged) {
            const pulse = Math.sin(swimPhase * 1.2);
            ctx.scale(1 - pulse * 0.09, 1 + pulse * 0.07);
        }
    } else {
        const bob = Math.sin(swimPhase) * 3;
        const sway = Math.sin(swimPhase * 0.7) * 0.04;
        ctx.translate(0, bob);
        ctx.rotate(sway);
    }
}

// ── Multi-part rig render (Option B) ──
// Same facing/baseline/pitch setup as the single-sprite path, then each part is
// drawn in z-order and articulated about its own pivot. Creatures keep living in
// the canvas, so the light cone, depth-fog, sonar morph, parallax z-order and
// kill-cam compositing all keep working unchanged.
function drawRiggedCreature(ctx, creature, ct, rig) {
    const w = rig.spriteSize.w, h = rig.spriteSize.h;

    ctx.save();
    ctx.translate(creature.x, creature.y);

    // Facing — mirror so the head leads (matches the single-sprite path)
    const headingRight = creature._facing ? creature._facing === 'right' : creature.vx > 0;
    const spriteFacesLeft = (rig.nativeFacing || 'left') === 'left';
    if (spriteFacesLeft === headingRight) ctx.scale(-1, 1);

    const swimPhase = creature.animPhase + Date.now() * 0.002;
    applyCreatureSwim(ctx, creature, ct, swimPhase, true);

    // Pitch into travel (after any mirror flip, like the single-sprite path)
    if (creature._pitch) {
        const pitchSign = spriteFacesLeft ? -1 : 1;
        ctx.rotate(creature._pitch * pitchSign);
    }
    // Grow-in for baby creatures
    if (creature.growTimer !== undefined && creature.growTimer < 1) {
        const s = 0.3 + creature.growTimer * 0.7;
        ctx.scale(s, s);
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const assets = RIG_ASSETS[ct.spriteType] || {};
    for (const partName of rig.zOrder) {
        const def = rig.parts[partName];
        const img = assets[partName];
        if (!def || !img) continue;   // optional/unloaded part — skip
        ctx.save();
        animateRigPart(ctx, def, creature, swimPhase, w, h);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
    }

    ctx.restore();
}

// Articulate one part about its normalized pivot. The part raster spans the full
// bounding box, so the transform is applied about the joint and the part swings.
function animateRigPart(ctx, def, creature, swimPhase, w, h) {
    if (!def.pivot) return; // static part (e.g. body)
    const px = w * (def.pivot[0] - 0.5);
    const py = h * (def.pivot[1] - 0.5);
    const amp = (def.amp !== undefined) ? def.amp : 0.2;
    const freq = (def.freq !== undefined) ? def.freq : 1.5;
    ctx.translate(px, py);
    switch (def.anim) {
        case 'tailBeat':
            ctx.rotate(Math.sin(swimPhase * freq) * amp);
            break;
        case 'finTilt':
            ctx.rotate(Math.sin(swimPhase * freq + 1.0) * amp);
            break;
        case 'jawSnap': {
            const lunging = creature.movement && creature.movement.lungePhase === 'lunge';
            const target = lunging ? amp : 0.02;
            creature._jawOpen = (creature._jawOpen || 0) + (target - (creature._jawOpen || 0)) * 0.25;
            ctx.rotate(creature._jawOpen);
            break;
        }
        case 'bellPulse': {
            const pulse = Math.sin(swimPhase * freq);
            ctx.scale(1 - pulse * amp, 1 + pulse * amp * 0.7);
            break;
        }
        case 'tentacleTrail':
            ctx.rotate(Math.sin(swimPhase * freq - 0.8) * amp); // lag behind the bell
            break;
        default:
            break;
    }
    ctx.translate(-px, -py);
}

// Draw a video-based creature
// ── Flipbook frame cycler (generic / theme-agnostic) ──
// Ping-pong through a sprite pool over time so a few AI-drawn poses read as one
// undulating creature (0 → n-1 → 1 → …). A single-frame pool just holds frame 0.
// Per-creature speed via ct.animFps; per-creature phase via animPhase so a school
// of the same creature doesn't animate in lockstep. No creature-specific logic here.
const SPRITE_ANIM_FPS = 5;
function spriteFrameIndex(creature, frameCount, fps) {
    if (frameCount <= 1) return 0;
    const period = 2 * (frameCount - 1);
    const tick = Math.floor(Date.now() * 0.001 * (fps || SPRITE_ANIM_FPS) + (creature.animPhase || 0));
    const pos = ((tick % period) + period) % period;
    return pos <= frameCount - 1 ? pos : period - pos;
}

function drawGreenscreenCreature(ctx, creature, ct) {
    // Flipbook: cycle the sprite pool over time when a creature ships several pose
    // frames; a single frame just holds. (Generic cycler — no creature logic here.)
    const pool = CREATURE_SPRITES[ct.spriteType] || [];
    const frameCount = pool.length;
    creature._spriteIdx = spriteFrameIndex(creature, frameCount, ct.animFps);
    // Pufferfish (TOC): the two frames are STATES, not a flipbook — deflated (0) until the
    // unit offloads/goes live (Blue), then inflated (1). Telegraphs that it's now actionable.
    if (ct.stateFrames && frameCount > 1) {
        creature._spriteIdx = creature.tocIsLive ? 1 : 0;
    }
    creature._spriteKey = `${ct.spriteType}_${creature._spriteIdx}`;

    const sprite = SPRITE_ASSETS[creature._spriteKey];
    if (!sprite || !SPRITE_READY[creature._spriteKey]) {
        // Sprite not loaded yet — sonar ring still marks the creature position
        return;
    }

    const w = ct.spriteSize ? ct.spriteSize.w : creature.radius * 5;
    const h = ct.spriteSize ? ct.spriteSize.h : creature.radius * 3;

    ctx.save();
    ctx.translate(creature.x, creature.y);

    // ── FACING FIRST — mirror the canvas so "head forward" is +x ──
    // Sprite native facing comes from the _ht/_th filename; the creature's
    // heading comes from the motion tracker in updateCreatureMovement.
    // Everything drawn after this point lives in head-forward space, so the
    // swim animation and pitch automatically mirror with the body.
    const spriteVariants = CREATURE_SPRITES[ct.spriteType];
    const spriteFacing = spriteVariants && spriteVariants[creature._spriteIdx]
        ? spriteVariants[creature._spriteIdx].facing
        : 'left';
    const headingRight = creature._facing
        ? creature._facing === 'right'
        : creature.vx > 0;
    const spriteFacesLeft = spriteFacing === 'left';
    if (spriteFacesLeft === headingRight) {
        ctx.scale(-1, 1);  // native facing disagrees with heading — flip
    }

    // --- Creature-specific swim animation (in head-forward space) ---
    // Baseline composite motion (item 1) — shared with the multi-part rig path.
    const swimPhase = creature.animPhase + Date.now() * 0.002;
    applyCreatureSwim(ctx, creature, ct, swimPhase, false);

    // ── PITCH into the travel direction (nose tilts toward target) ──
    // The head sits at -x in _ht images and +x in _th images, so the
    // rotation sign follows the sprite's native facing: positive canvas
    // rotation moves the +x side down, and any mirror flip cancels out
    // of the vertical component.
    if (creature._pitch) {
        const pitchSign = spriteFacesLeft ? -1 : 1;
        ctx.rotate(creature._pitch * pitchSign);
    }

    // Growing animation for baby creatures
    if (creature.growTimer !== undefined && creature.growTimer < 1) {
        const s = 0.3 + creature.growTimer * 0.7;
        ctx.scale(s, s);
    }

    // Draw the chromakeyed sprite — crisp rendering. For multi-frame creatures,
    // centre each frame on its opaque body so AI-pose frames don't jump as they cycle.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    let alignX = 0, alignY = 0;
    if (frameCount > 1) {
        const bb = SPRITE_BBOX[creature._spriteKey];
        if (bb) { alignX = -(bb.cx - 0.5) * w; alignY = -(bb.cy - 0.5) * h; }
    }
    ctx.drawImage(sprite, -w / 2 + alignX, -h / 2 + alignY, w, h);

    ctx.restore();
}

function drawCreatureSilhouette(ctx, ct, r, phase) {
    ctx.fillStyle = 'rgba(10, 10, 20, 0.7)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
    ctx.fill();
}

// --- JELLYFISH ---
function drawJellyfish(ctx, r, phase, accent, glow) {
    // Bell body
    ctx.beginPath();
    ctx.moveTo(-r * 1.2, r * 0.3);
    ctx.quadraticCurveTo(-r * 1.3, -r * 0.8, 0, -r * 1.4);
    ctx.quadraticCurveTo(r * 1.3, -r * 0.8, r * 1.2, r * 0.3);
    ctx.quadraticCurveTo(r * 0.5, r * 0.5, 0, r * 0.3);
    ctx.quadraticCurveTo(-r * 0.5, r * 0.5, -r * 1.2, r * 0.3);

    const bellGrad = ctx.createRadialGradient(0, -r * 0.3, 0, 0, -r * 0.3, r * 1.5);
    bellGrad.addColorStop(0, accent + 'aa');
    bellGrad.addColorStop(0.6, accent + '44');
    bellGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = bellGrad;
    ctx.fill();

    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Tentacles (8)
    for (let i = 0; i < 8; i++) {
        const baseX = (i - 3.5) * (r * 0.3);
        const tentLen = r * 2.5 + Math.sin(phase + i * 0.8) * r * 0.4;

        ctx.strokeStyle = accent + '88';
        ctx.lineWidth = 1 + Math.sin(phase + i) * 0.3;
        ctx.beginPath();
        ctx.moveTo(baseX, r * 0.3);
        for (let t = 0; t < tentLen; t += 4) {
            const wobble = Math.sin(phase * 2 + t * 0.1 + i * 0.5) * (3 + t * 0.03);
            ctx.lineTo(baseX + wobble, r * 0.3 + t);
        }
        ctx.stroke();
    }

    // Inner glow
    ctx.fillStyle = glow + '22';
    ctx.beginPath();
    ctx.arc(0, -r * 0.3, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
}

// --- SEA SPIDER ---
function drawSeaSpider(ctx, r, phase, accent, glow) {
    // Central body
    ctx.fillStyle = accent + 'cc';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.6, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 8 legs (alternating pairs)
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const legPhase = phase * 3 + i * Math.PI / 4;
        const jointBend = Math.sin(legPhase) * 0.4;
        const legLen = r * 2;

        const startX = Math.cos(angle) * r * 0.5;
        const startY = Math.sin(angle) * r * 0.3;
        const midX = startX + Math.cos(angle + jointBend) * legLen * 0.5;
        const midY = startY + Math.sin(angle + jointBend) * legLen * 0.5;
        const endX = midX + Math.cos(angle - jointBend * 0.5) * legLen * 0.5;
        const endY = midY + Math.sin(angle - jointBend * 0.5) * legLen * 0.5;

        ctx.strokeStyle = accent + 'aa';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(midX, midY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Joint dots
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(midX, midY, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Eyes
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(-r * 0.2, -r * 0.15, 2, 0, Math.PI * 2);
    ctx.arc(r * 0.2, -r * 0.15, 2, 0, Math.PI * 2);
    ctx.fill();
}

// --- GULPER EEL ---
function drawGulperEel(ctx, r, phase, accent, glow, movement) {
    const isLunging = movement && movement.lungePhase === 'lunge';
    const jawOpen = isLunging ? 0.8 : 0.2 + Math.sin(phase * 2) * 0.15;

    // Body segments (serpentine)
    const segments = 12;
    ctx.strokeStyle = accent + 'cc';
    ctx.lineWidth = r * 0.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -r);
    for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const wobble = Math.sin(phase * 3 + t * 6) * r * 0.4 * t;
        ctx.lineTo(wobble, -r + t * r * 3);
    }
    ctx.stroke();

    // Body fill (darker center)
    ctx.strokeStyle = accent + '44';
    ctx.lineWidth = r * 0.3;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const wobble = Math.sin(phase * 3 + t * 6) * r * 0.4 * t;
        ctx.lineTo(wobble, -r + t * r * 3);
    }
    ctx.stroke();

    // Massive jaw
    ctx.fillStyle = accent + 'cc';
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r);
    ctx.lineTo(-r * (0.8 + jawOpen), -r * 0.3);
    ctx.lineTo(0, -r * 0.8);
    ctx.lineTo(r * (0.8 + jawOpen), -r * 0.3);
    ctx.lineTo(r * 0.3, -r);
    ctx.closePath();
    ctx.fill();

    // Teeth
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 5; i++) {
        const tx = -r * 0.6 + i * r * 0.3;
        ctx.beginPath();
        ctx.moveTo(tx, -r * (0.6 + jawOpen * 0.3));
        ctx.lineTo(tx + 2, -r * 0.85);
        ctx.lineTo(tx - 2, -r * 0.85);
        ctx.closePath();
        ctx.fill();
    }

    // Eye
    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.arc(-r * 0.15, -r * 1.1, 2.5, 0, Math.PI * 2);
    ctx.fill();
}

// --- KRAKEN TENTACLE ---
function drawKrakenTentacle(ctx, r, phase, accent, glow) {
    // Single massive tentacle curling
    const tentLen = r * 5;
    const segments = 20;

    ctx.strokeStyle = accent + 'cc';
    ctx.lineWidth = r * 0.6;
    ctx.lineCap = 'round';
    ctx.beginPath();

    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const curl = Math.sin(phase * 1.5 + t * 4) * r * 1.5 * t;
        const taper = 1 - t * 0.7;
        const x = curl;
        const y = -r * 2 + t * tentLen;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        ctx.lineWidth = r * 0.6 * taper;
    }
    ctx.stroke();

    // Suckers along the tentacle
    for (let i = 2; i < segments - 2; i += 2) {
        const t = i / segments;
        const curl = Math.sin(phase * 1.5 + t * 4) * r * 1.5 * t;
        const x = curl;
        const y = -r * 2 + t * tentLen;
        const suckerSize = r * 0.25 * (1 - t * 0.5);

        ctx.fillStyle = accent + '66';
        ctx.beginPath();
        ctx.arc(x - r * 0.2 * (1 - t), y, suckerSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = accent + 'aa';
        ctx.lineWidth = 0.8;
        ctx.stroke();
    }
}

// --- ANGLERFISH ---
function drawAnglerfish(ctx, r, phase, accent, glow) {
    // Bulbous body
    ctx.fillStyle = accent + '88';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.3, r * 1.3, r * 1.0, 0, 0, Math.PI * 2);
    ctx.fill();

    // Darker belly
    ctx.fillStyle = accent + '33';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.6, r * 1.0, r * 0.6, 0, 0, Math.PI);
    ctx.fill();

    // Fins (flutter)
    const finPhase = Math.sin(phase * 4);
    ctx.fillStyle = accent + '66';
    // Left fin
    ctx.beginPath();
    ctx.moveTo(-r * 1.1, r * 0.2);
    ctx.quadraticCurveTo(-r * 2, r * 0.3 + finPhase * r * 0.3, -r * 1.5, r * 0.8);
    ctx.quadraticCurveTo(-r * 1.0, r * 0.6, -r * 1.1, r * 0.2);
    ctx.fill();
    // Right fin
    ctx.beginPath();
    ctx.moveTo(r * 1.1, r * 0.2);
    ctx.quadraticCurveTo(r * 2, r * 0.3 - finPhase * r * 0.3, r * 1.5, r * 0.8);
    ctx.quadraticCurveTo(r * 1.0, r * 0.6, r * 1.1, r * 0.2);
    ctx.fill();

    // Huge mouth with teeth
    ctx.fillStyle = '#1a0a0a';
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.2, r * 0.9, r * 0.5, 0, Math.PI, 0);
    ctx.fill();

    // Teeth (top row)
    ctx.fillStyle = '#dddddd';
    for (let i = 0; i < 7; i++) {
        const tx = -r * 0.7 + i * r * 0.23;
        const tLen = 3 + Math.random() * 4;
        ctx.beginPath();
        ctx.moveTo(tx - 1.5, -r * 0.2);
        ctx.lineTo(tx, -r * 0.2 + tLen);
        ctx.lineTo(tx + 1.5, -r * 0.2);
        ctx.closePath();
        ctx.fill();
    }

    // Dangling light lure
    const lureX = Math.sin(phase * 1.5) * r * 0.3;
    const lureY = -r * 2 - Math.sin(phase) * r * 0.3;

    // Lure stalk
    ctx.strokeStyle = accent + '66';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.7);
    ctx.quadraticCurveTo(lureX * 0.5, -r * 1.5, lureX, lureY);
    ctx.stroke();

    // Lure light
    const lurePulse = Math.sin(phase * 3) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(150, 220, 255, ${lurePulse})`;
    ctx.shadowColor = '#aaddff';
    ctx.shadowBlur = 15 * lurePulse;
    ctx.beginPath();
    ctx.arc(lureX, lureY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(r * 0.4, -r * 0.1, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(r * 0.4, -r * 0.1, 1.5, 0, Math.PI * 2);
    ctx.fill();
}

// --- GREAT WHITE SHARK (procedural) ---
function drawGreatWhite(ctx, r, phase, accent, glow, creature) {
    // Horizontal swimmer — face direction of travel
    const facingRight = creature && creature.fromLeft;
    if (facingRight) ctx.scale(-1, 1);

    const len = r * 4.5;   // nose to tail
    const bodyH = r * 1.4;

    // Tail oscillation — sinusoidal, drives the whole body wave
    const tailFreq = 3.5;
    const tailAmp = r * 0.6;
    const bodyWave = (t) => Math.sin(phase * tailFreq + t * 3) * tailAmp * t * t;

    // --- Main body (fusiform shape) ---
    ctx.beginPath();
    // Top contour (nose → dorsal → tail)
    ctx.moveTo(len * 0.5, 0);                                          // nose tip
    ctx.quadraticCurveTo(len * 0.3, -bodyH * 0.5, len * 0.1, -bodyH * 0.7);  // forehead rise
    ctx.quadraticCurveTo(-len * 0.1, -bodyH * 0.6, -len * 0.25, -bodyH * 0.35 + bodyWave(0.5)); // mid-back
    ctx.quadraticCurveTo(-len * 0.4, -bodyH * 0.15 + bodyWave(0.75), -len * 0.5, bodyWave(1) * 0.8); // tail root
    // Bottom contour (tail → belly → nose)
    ctx.quadraticCurveTo(-len * 0.4, bodyH * 0.15 + bodyWave(0.75), -len * 0.25, bodyH * 0.3 + bodyWave(0.5));
    ctx.quadraticCurveTo(-len * 0.05, bodyH * 0.65, len * 0.15, bodyH * 0.45);   // belly peak
    ctx.quadraticCurveTo(len * 0.35, bodyH * 0.25, len * 0.5, 0);                 // chin to nose
    ctx.closePath();

    // Body gradient — dark grey dorsal, lighter belly
    const bodyGrad = ctx.createLinearGradient(0, -bodyH * 0.7, 0, bodyH * 0.5);
    bodyGrad.addColorStop(0, '#556677');
    bodyGrad.addColorStop(0.45, accent);
    bodyGrad.addColorStop(0.55, '#bcc8d0');
    bodyGrad.addColorStop(1, '#dde4e8');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Subtle outline
    ctx.strokeStyle = accent + '66';
    ctx.lineWidth = 1;
    ctx.stroke();

    // --- Dorsal fin ---
    const dorsalSway = bodyWave(0.3) * 0.3;
    ctx.fillStyle = '#667788';
    ctx.beginPath();
    ctx.moveTo(len * 0.05, -bodyH * 0.65);
    ctx.lineTo(-len * 0.02 + dorsalSway, -bodyH * 1.5);
    ctx.quadraticCurveTo(-len * 0.08 + dorsalSway, -bodyH * 1.1, -len * 0.15, -bodyH * 0.45 + bodyWave(0.4) * 0.3);
    ctx.closePath();
    ctx.fill();

    // --- Pectoral fins ---
    const pectPhase = Math.sin(phase * 1.5) * 0.15;
    ctx.fillStyle = '#778899';
    // Left pectoral
    ctx.beginPath();
    ctx.moveTo(len * 0.1, bodyH * 0.35);
    ctx.quadraticCurveTo(len * 0.0, bodyH * 1.0 + pectPhase * r, -len * 0.12, bodyH * 0.8 + pectPhase * r);
    ctx.quadraticCurveTo(-len * 0.05, bodyH * 0.4, len * 0.1, bodyH * 0.35);
    ctx.fill();

    // --- Tail (caudal fin) ---
    const tailX = -len * 0.5;
    const tailOff = bodyWave(1);
    ctx.fillStyle = '#667788';
    ctx.beginPath();
    ctx.moveTo(tailX, tailOff * 0.8);
    // Upper lobe (larger)
    ctx.quadraticCurveTo(tailX - r * 0.6, tailOff - bodyH * 0.5, tailX - r * 1.2, tailOff - bodyH * 1.1);
    ctx.quadraticCurveTo(tailX - r * 0.4, tailOff - bodyH * 0.2, tailX, tailOff * 0.8);
    // Lower lobe (smaller — asymmetric like a real shark)
    ctx.quadraticCurveTo(tailX - r * 0.4, tailOff + bodyH * 0.15, tailX - r * 0.9, tailOff + bodyH * 0.7);
    ctx.quadraticCurveTo(tailX - r * 0.3, tailOff + bodyH * 0.2, tailX, tailOff * 0.8);
    ctx.closePath();
    ctx.fill();

    // --- Gill slits ---
    ctx.strokeStyle = '#44556688';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
        const gx = len * 0.22 - i * r * 0.22;
        ctx.beginPath();
        ctx.moveTo(gx, -bodyH * 0.15);
        ctx.lineTo(gx - 1, bodyH * 0.15);
        ctx.stroke();
    }

    // --- Eye ---
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(len * 0.35, -bodyH * 0.15, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
    // Eye shine
    ctx.fillStyle = '#ffffff44';
    ctx.beginPath();
    ctx.arc(len * 0.36, -bodyH * 0.18, r * 0.07, 0, Math.PI * 2);
    ctx.fill();

    // --- Mouth line ---
    ctx.strokeStyle = '#44556699';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(len * 0.48, bodyH * 0.05);
    ctx.quadraticCurveTo(len * 0.35, bodyH * 0.2, len * 0.2, bodyH * 0.15);
    ctx.stroke();
}

// --- BARRACUDA (procedural) ---
function drawBarracuda(ctx, r, phase, accent, glow, creature) {
    const facingRight = creature && creature.fromLeft;
    if (facingRight) ctx.scale(-1, 1);

    const len = r * 5;     // long and sleek
    const bodyH = r * 0.65;

    // Fast tail oscillation — barracuda tail-beat is rapid and tight
    const tailFreq = 5;
    const tailAmp = r * 0.4;
    const bodyWave = (t) => Math.sin(phase * tailFreq + t * 4) * tailAmp * t * t;

    // --- Sleek torpedo body ---
    ctx.beginPath();
    ctx.moveTo(len * 0.5, 0);
    // Top
    ctx.quadraticCurveTo(len * 0.3, -bodyH * 0.6, len * 0.05, -bodyH * 0.7);
    ctx.quadraticCurveTo(-len * 0.15, -bodyH * 0.55 + bodyWave(0.5) * 0.3, -len * 0.35, -bodyH * 0.25 + bodyWave(0.8) * 0.5);
    ctx.lineTo(-len * 0.5, bodyWave(1) * 0.6);
    // Bottom
    ctx.quadraticCurveTo(-len * 0.35, bodyH * 0.25 + bodyWave(0.8) * 0.5, -len * 0.15, bodyH * 0.5 + bodyWave(0.5) * 0.3);
    ctx.quadraticCurveTo(len * 0.05, bodyH * 0.65, len * 0.25, bodyH * 0.35);
    ctx.quadraticCurveTo(len * 0.4, bodyH * 0.15, len * 0.5, 0);
    ctx.closePath();

    // Metallic silver gradient
    const bodyGrad = ctx.createLinearGradient(0, -bodyH, 0, bodyH);
    bodyGrad.addColorStop(0, '#667799');
    bodyGrad.addColorStop(0.35, '#aabbcc');
    bodyGrad.addColorStop(0.5, '#d0dae0');
    bodyGrad.addColorStop(0.65, '#aabbcc');
    bodyGrad.addColorStop(1, '#8899aa');
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = accent + '44';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // --- Dark lateral stripe ---
    ctx.strokeStyle = '#556677aa';
    ctx.lineWidth = bodyH * 0.3;
    ctx.beginPath();
    ctx.moveTo(len * 0.4, 0);
    ctx.quadraticCurveTo(len * 0.1, -bodyH * 0.05, -len * 0.2, bodyWave(0.6) * 0.3);
    ctx.lineTo(-len * 0.45, bodyWave(0.9) * 0.5);
    ctx.stroke();

    // --- Dorsal fin (small, set far back) ---
    ctx.fillStyle = '#778899';
    ctx.beginPath();
    ctx.moveTo(-len * 0.2, -bodyH * 0.5 + bodyWave(0.55) * 0.3);
    ctx.lineTo(-len * 0.25, -bodyH * 1.1 + bodyWave(0.55) * 0.4);
    ctx.lineTo(-len * 0.32, -bodyH * 0.4 + bodyWave(0.65) * 0.3);
    ctx.closePath();
    ctx.fill();

    // --- Tail fork ---
    const tailX = -len * 0.5;
    const tailOff = bodyWave(1);
    ctx.fillStyle = '#778899';
    ctx.beginPath();
    ctx.moveTo(tailX, tailOff * 0.6);
    ctx.lineTo(tailX - r * 0.9, tailOff - bodyH * 1.0);
    ctx.quadraticCurveTo(tailX - r * 0.3, tailOff - bodyH * 0.2, tailX, tailOff * 0.6);
    ctx.moveTo(tailX, tailOff * 0.6);
    ctx.lineTo(tailX - r * 0.9, tailOff + bodyH * 1.0);
    ctx.quadraticCurveTo(tailX - r * 0.3, tailOff + bodyH * 0.2, tailX, tailOff * 0.6);
    ctx.closePath();
    ctx.fill();

    // --- Jaw (underbite, slightly open) ---
    const jawOpen = 0.1 + Math.sin(phase * 2) * 0.05;
    ctx.fillStyle = '#44556688';
    ctx.beginPath();
    ctx.moveTo(len * 0.5, bodyH * 0.05);
    ctx.quadraticCurveTo(len * 0.42, bodyH * (0.3 + jawOpen), len * 0.3, bodyH * (0.25 + jawOpen * 0.5));
    ctx.lineTo(len * 0.3, bodyH * 0.2);
    ctx.quadraticCurveTo(len * 0.42, bodyH * 0.15, len * 0.5, bodyH * 0.05);
    ctx.fill();

    // Teeth — visible in gap
    ctx.fillStyle = '#eeeeff';
    for (let i = 0; i < 4; i++) {
        const tx = len * 0.48 - i * r * 0.18;
        ctx.beginPath();
        ctx.moveTo(tx, bodyH * 0.05);
        ctx.lineTo(tx - 1, bodyH * (0.15 + jawOpen * 0.3));
        ctx.lineTo(tx + 1, bodyH * 0.05);
        ctx.closePath();
        ctx.fill();
    }

    // --- Eye (large, predatory) ---
    ctx.fillStyle = '#ffee44';
    ctx.beginPath();
    ctx.arc(len * 0.36, -bodyH * 0.1, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(len * 0.36, -bodyH * 0.1, r * 0.1, 0, Math.PI * 2);
    ctx.fill();

    // --- Silver shimmer (moving highlight) ---
    const shimmerX = Math.sin(phase * 2) * len * 0.2;
    const shimmerGrad = ctx.createRadialGradient(shimmerX, 0, 0, shimmerX, 0, r * 1.5);
    shimmerGrad.addColorStop(0, 'rgba(255,255,255,0.12)');
    shimmerGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shimmerGrad;
    ctx.fillRect(-len * 0.5, -bodyH, len, bodyH * 2);
}

// --- BOX JELLYFISH (procedural) ---
function drawBoxJellyfish(ctx, r, phase, accent, glow, creature) {
    const bellR = r * 1.6;
    const bellH = r * 2.0;

    // Pulsing contraction — bell squeezes and relaxes
    const pulseRate = 1.8;
    const pulse = Math.sin(phase * pulseRate);
    const squeeze = 1 - pulse * 0.12;        // width contracts
    const stretch = 1 + pulse * 0.08;        // height stretches slightly on contraction

    // Color cycling — subtle bioluminescent shifts
    const hueShift = Math.sin(phase * 0.7) * 20;
    const baseR = 100 + hueShift;
    const baseG = 180 + Math.sin(phase * 0.5) * 30;
    const baseB = 220 - hueShift * 0.5;

    // --- Bell (box-shaped, translucent) ---
    ctx.save();
    ctx.scale(squeeze, stretch);

    // Outer bell
    ctx.beginPath();
    const bw = bellR;  // half-width
    const bt = -bellH * 0.5; // top
    const bb = bellH * 0.3;  // bottom
    const cornerR = bellR * 0.35; // rounded corners for "box" shape

    // Rounded rectangle bell shape
    ctx.moveTo(-bw + cornerR, bt);
    ctx.lineTo(bw - cornerR, bt);
    ctx.quadraticCurveTo(bw, bt, bw, bt + cornerR);
    ctx.lineTo(bw, bb - cornerR * 0.5);
    ctx.quadraticCurveTo(bw, bb, bw * 0.7, bb + cornerR * 0.3);
    // Bottom curves inward
    ctx.quadraticCurveTo(0, bb + cornerR * 0.8, -bw * 0.7, bb + cornerR * 0.3);
    ctx.quadraticCurveTo(-bw, bb, -bw, bb - cornerR * 0.5);
    ctx.lineTo(-bw, bt + cornerR);
    ctx.quadraticCurveTo(-bw, bt, -bw + cornerR, bt);
    ctx.closePath();

    // Translucent gradient fill
    const bellGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, bellR * 1.5);
    bellGrad.addColorStop(0, `rgba(${baseR + 40}, ${baseG + 30}, ${baseB}, 0.5)`);
    bellGrad.addColorStop(0.5, `rgba(${baseR}, ${baseG}, ${baseB}, 0.3)`);
    bellGrad.addColorStop(1, `rgba(${baseR - 20}, ${baseG - 20}, ${baseB - 10}, 0.15)`);
    ctx.fillStyle = bellGrad;
    ctx.fill();

    // Bell edge highlight
    ctx.strokeStyle = `rgba(${baseR + 60}, ${baseG + 40}, ${baseB + 20}, 0.5)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner organs (visible through translucent bell)
    ctx.fillStyle = `rgba(${baseR + 80}, ${baseG - 40}, ${baseB - 80}, 0.25)`;
    ctx.beginPath();
    ctx.ellipse(0, -bellH * 0.05, bellR * 0.35, bellH * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cross-shaped internal structure
    ctx.strokeStyle = `rgba(${baseR + 60}, ${baseG}, ${baseB - 40}, 0.2)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, bt + cornerR);
    ctx.lineTo(0, bb);
    ctx.moveTo(-bellR * 0.5, 0);
    ctx.lineTo(bellR * 0.5, 0);
    ctx.stroke();

    ctx.restore();  // undo squeeze/stretch for tentacles

    // --- Tentacles (4 clusters from corners) ---
    const tentacleOrigins = [
        { x: -bellR * 0.6 * squeeze, y: bellH * 0.35 * stretch },
        { x: -bellR * 0.2 * squeeze, y: bellH * 0.4 * stretch },
        { x:  bellR * 0.2 * squeeze, y: bellH * 0.4 * stretch },
        { x:  bellR * 0.6 * squeeze, y: bellH * 0.35 * stretch }
    ];

    for (let c = 0; c < tentacleOrigins.length; c++) {
        const origin = tentacleOrigins[c];
        // Each corner has 3 tentacle strands
        for (let t = 0; t < 3; t++) {
            const tentLen = r * 3.5 + Math.sin(phase * 1.2 + c + t) * r * 0.8;
            const drift = (t - 1) * r * 0.15;

            // Tentacle color shifts along length
            ctx.lineWidth = 1.2 - t * 0.2;
            ctx.beginPath();
            ctx.moveTo(origin.x + drift, origin.y);

            for (let s = 0; s < tentLen; s += 3) {
                const frac = s / tentLen;
                const wobble = Math.sin(phase * 2.5 + s * 0.08 + c * 1.5 + t * 0.7) * (4 + frac * 8);
                const drag = Math.sin(phase * 0.8 + c) * frac * 6; // slow current drift
                ctx.lineTo(origin.x + drift + wobble + drag, origin.y + s);
            }

            // Color fades along tentacle
            const alpha = 0.5 - t * 0.1;
            ctx.strokeStyle = `rgba(${baseR + 40}, ${baseG + 20}, ${baseB}, ${alpha})`;
            ctx.stroke();

            // Nematocyst clusters (bright dots along tentacles)
            if (t === 0) {
                for (let s = r * 0.8; s < tentLen; s += r * 0.9) {
                    const frac = s / tentLen;
                    const wx = origin.x + drift + Math.sin(phase * 2.5 + s * 0.08 + c * 1.5) * (4 + frac * 8);
                    const wy = origin.y + s;
                    const nPulse = Math.sin(phase * 3 + s * 0.2 + c) * 0.3 + 0.7;
                    ctx.fillStyle = `rgba(255, 180, 200, ${nPulse * 0.6})`;
                    ctx.beginPath();
                    ctx.arc(wx, wy, 1.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }

    // --- Bioluminescent glow pulse ---
    const glowPulse = Math.sin(phase * pulseRate) * 0.15 + 0.2;
    ctx.fillStyle = `rgba(${baseR + 60}, ${baseG + 40}, ${baseB + 30}, ${glowPulse})`;
    ctx.beginPath();
    ctx.ellipse(0, -bellH * 0.1, bellR * 0.8 * squeeze, bellH * 0.4 * stretch, 0, 0, Math.PI * 2);
    ctx.fill();
}

// ============================================
// DEATH SEQUENCES v2
// Two cinematic enders, both staged behind the brass helmet porthole:
//   ABYSS DEATH — all three hoses cut: the long fall, then the squeeze
//   KILL CAM    — a creature got the diver: per-species attack on the visor
// ============================================

function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function easeOutCubic(v) { v = clamp01(v); return 1 - Math.pow(1 - v, 3); }
function easeInCubic(v) { v = clamp01(v); return v * v * v; }

// ── Helmet porthole geometry ──
// Legacy helmet-frame compositing (assets/Kill Screen/helmet.png) is RETIRED. The kill
// screen now uses KILL_SCREEN.maskMode 'procedural' (config.js), and helmet.png was removed
// from the repo — so we no longer load it (that just 404'd on every page load). The
// porthole geometry stays for the procedural surround; drawHelmetFrameOverlay() below is
// the procedural fallback and renders correctly with helmetFrameCanvas left null.
const HELMET_PORTHOLE = { imgW: 1456, imgH: 816, fx: 0.538, fy: 0.512, fr: 0.40 };

let helmetFrameCanvas = null;

// Where the porthole lands on a canvas of w×h when the helmet frame is
// drawn cover-fit (same math as CSS object-fit: cover).
function getPortholeRect(w, h) {
    const scale = Math.max(w / HELMET_PORTHOLE.imgW, h / HELMET_PORTHOLE.imgH);
    const dw = HELMET_PORTHOLE.imgW * scale;
    const dh = HELMET_PORTHOLE.imgH * scale;
    const ox = (w - dw) / 2;
    const oy = (h - dh) / 2;
    return {
        cx: ox + dw * HELMET_PORTHOLE.fx,
        cy: oy + dh * HELMET_PORTHOLE.fy,
        r: dh * HELMET_PORTHOLE.fr,
        scale, ox, oy, dw, dh
    };
}

function sizeKillCanvas() {
    const killCanvas = document.getElementById('kill-cam-canvas');
    if (!killCanvas) return null;
    const w = window.innerWidth, h = window.innerHeight;
    if (killCanvas.width !== w) killCanvas.width = w;
    if (killCanvas.height !== h) killCanvas.height = h;
    return killCanvas;
}

function drawHelmetFrameOverlay(kctx, w, h) {
    if (helmetFrameCanvas) {
        const scale = Math.max(w / helmetFrameCanvas.width, h / helmetFrameCanvas.height);
        const dw = helmetFrameCanvas.width * scale;
        const dh = helmetFrameCanvas.height * scale;
        kctx.drawImage(helmetFrameCanvas, (w - dw) / 2, (h - dh) / 2, dw, dh);
        return;
    }
    // Fallback frame if the PNG failed to load — black surround + brass ring
    const P = getPortholeRect(w, h);
    kctx.save();
    kctx.beginPath();
    kctx.rect(0, 0, w, h);
    kctx.arc(P.cx, P.cy, P.r, 0, Math.PI * 2, true);
    kctx.fillStyle = '#05070a';
    kctx.fill();
    kctx.lineWidth = P.r * 0.14;
    kctx.strokeStyle = '#7a5c1c';
    kctx.beginPath();
    kctx.arc(P.cx, P.cy, P.r * 1.04, 0, Math.PI * 2);
    kctx.stroke();
    kctx.restore();
}

// ============================================
// KILL SCREEN PLATE (one constructed POV plate, two cinematics — see KILL_SCREEN)
// The plate's central faceplate is opaque black, so the void / cracks / creature
// are composited OVER it, clipped to the faceplate mask. Helpers are reusable by
// both the crush and (later) creature cinematics.
// ============================================
let killScreenPlate = null, killScreenPlateReady = false;
// When the plate art marks glass openings with pure chroma-green (#00FF00) fills,
// these hold the detected regions in plate fractions {x,y,w,h}. The green can mark
// the central faceplate alone, or all three windows (faceplate + both side ports) —
// the detector separates them into distinct regions by horizontal position. Empty
// = fall back to the config KILL_SCREEN.regions.
let killScreenRegionsDetected = {};
(function loadKillScreenPlate() {
    const img = new Image();
    img.onload = () => {
        // Detect + key out chroma-green fit-zones painted on the plate. Green marks
        // exactly where the creature/glimpse should sit; we snap the regions to the
        // painted shapes and repaint the green to black (the void the creature
        // emerges from). Falls back to the raw plate if keying isn't possible (CORS).
        const useKey = (typeof KILL_SCREEN === 'undefined') || KILL_SCREEN.faceplateChromaKey !== false;
        if (useKey) {
            try {
                const c = document.createElement('canvas');
                c.width = img.naturalWidth; c.height = img.naturalHeight;
                const g = c.getContext('2d');
                g.drawImage(img, 0, 0);
                const id = g.getImageData(0, 0, c.width, c.height);
                const d = id.data;
                // Per-column green stats so separate windows split into distinct bands.
                const colCount = new Array(c.width).fill(0);
                const colYMin = new Array(c.width).fill(c.height);
                const colYMax = new Array(c.width).fill(-1);
                let total = 0;
                for (let y = 0; y < c.height; y++) {
                    for (let x = 0; x < c.width; x++) {
                        const i = (y * c.width + x) * 4;
                        const r = d[i], gr = d[i + 1], b = d[i + 2];
                        // PURE chroma green only (#00FF00-ish). Strict so the plate's
                        // teal/cyan rim glow and UI accents (high blue) don't register.
                        if (gr > 180 && r < 100 && b < 100 && (gr - r) > 120 && (gr - b) > 120) {
                            total++;
                            colCount[x]++;
                            if (y < colYMin[x]) colYMin[x] = y;
                            if (y > colYMax[x]) colYMax[x] = y;
                            d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; d[i + 3] = 255; // → black void
                        }
                    }
                }
                const minArea = c.width * c.height * 0.002; // ignore stray specks
                if (total >= minArea) {
                    // Mark columns that hold green, then bridge small anti-alias gaps
                    // so one window stays one band; real frame gaps split the bands.
                    const colThresh = 2;
                    const gapTol = Math.max(6, Math.round(c.width * 0.02));
                    const on = colCount.map(n => n > colThresh);
                    for (let x = 0; x < c.width;) {
                        if (!on[x]) {
                            let j = x; while (j < c.width && !on[j]) j++;
                            if (x > 0 && j < c.width && (j - x) <= gapTol) { for (let k = x; k < j; k++) on[k] = true; }
                            x = j;
                        } else x++;
                    }
                    const minW = c.width * 0.04, minH = c.height * 0.04;
                    const bands = [];
                    for (let x = 0; x < c.width;) {
                        if (on[x]) {
                            let j = x; while (j < c.width && on[j]) j++;
                            let ylo = c.height, yhi = -1;
                            for (let cx = x; cx < j; cx++) { if (colYMax[cx] >= 0) { if (colYMin[cx] < ylo) ylo = colYMin[cx]; if (colYMax[cx] > yhi) yhi = colYMax[cx]; } }
                            if ((j - 1 - x) >= minW && (yhi - ylo) >= minH) {
                                bands.push({ x: x / c.width, y: ylo / c.height, w: (j - 1 - x) / c.width, h: (yhi - ylo) / c.height, cx: ((x + j - 1) / 2) / c.width });
                            }
                            x = j;
                        } else x++;
                    }
                    if (bands.length) {
                        // Faceplate = the band straddling the plate centre; else nearest.
                        let face = bands.find(r => r.x <= 0.5 && (r.x + r.w) >= 0.5)
                            || bands.slice().sort((a, b) => Math.abs(a.cx - 0.5) - Math.abs(b.cx - 0.5))[0];
                        const strip = ({ x, y, w, h }) => ({ x, y, w, h });
                        killScreenRegionsDetected.FACEPLATE_MASK = strip(face);
                        const lefts = bands.filter(r => r !== face && r.cx < face.cx).sort((a, b) => b.cx - a.cx);
                        const rights = bands.filter(r => r !== face && r.cx > face.cx).sort((a, b) => a.cx - b.cx);
                        if (lefts[0]) killScreenRegionsDetected.SIDE_PORT_MASK_L = strip(lefts[0]);
                        if (rights[0]) killScreenRegionsDetected.SIDE_PORT_MASK_R = strip(rights[0]);
                        console.log('Kill-screen chroma regions:', killScreenRegionsDetected);
                    }
                    // Commit the keyed plate (green removed) whenever green was present.
                    g.putImageData(id, 0, 0);
                    const keyed = new Image();
                    keyed.onload = () => { killScreenPlate = keyed; killScreenPlateReady = true; };
                    keyed.src = c.toDataURL('image/png');
                    return;
                }
            } catch (e) {
                console.warn('Kill-screen chroma-key skipped:', e.message);
            }
        }
        killScreenPlate = img; killScreenPlateReady = true;
    };
    img.onerror = () => console.warn('Kill-screen plate failed to load');
    img.src = (typeof KILL_SCREEN !== 'undefined') ? KILL_SCREEN.plate : 'assets/Kill Screen/kill_screen_POV.png';
})();

// Head-on creature frames for the CREATURE cinematic (true-alpha — no chromakey).
const KILLSCREEN_FRAMES = {};   // [creature] = { closed: Image, open: Image }
const KILLSCREEN_BBOX = {};     // [creature][which] = opaque box {cx,cy,w,h} fractions

// Opaque (alpha) bounding box of a true-alpha image, as fractions of the canvas,
// so transparent padding doesn't make the composited creature look small/offset.
function computeOpaqueBBox(img) {
    try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let xMin = c.width, yMin = c.height, xMax = 0, yMax = 0, found = false;
        for (let y = 0; y < c.height; y += 3) {
            for (let x = 0; x < c.width; x += 3) {
                if (d[(y * c.width + x) * 4 + 3] > 24) {
                    found = true;
                    if (x < xMin) xMin = x; if (x > xMax) xMax = x;
                    if (y < yMin) yMin = y; if (y > yMax) yMax = y;
                }
            }
        }
        if (!found) return null;
        return { cx: ((xMin + xMax) / 2) / c.width, cy: ((yMin + yMax) / 2) / c.height,
                 w: (xMax - xMin) / c.width, h: (yMax - yMin) / c.height };
    } catch (e) { return null; }
}

(function loadKillScreenCreatures() {
    if (typeof KILL_SCREEN === 'undefined' || !KILL_SCREEN.creatures) return;
    for (const [key, paths] of Object.entries(KILL_SCREEN.creatures)) {
        KILLSCREEN_FRAMES[key] = {};
        KILLSCREEN_BBOX[key] = {};
        for (const which of ['closed', 'open']) {
            if (!paths[which]) continue;
            const im = new Image();
            im.onload = () => { KILLSCREEN_BBOX[key][which] = computeOpaqueBBox(im); };
            im.onerror = () => console.warn('Kill-screen frame missing:', paths[which]);
            im.src = paths[which];
            KILLSCREEN_FRAMES[key][which] = im;
        }
    }
})();

// Pufferfish POISONED art (§0.9): the radial-puncture CRACK overlay + body stand-ins.
const KILLSCREEN_PUNCTURE = new Image();
const KILLSCREEN_PUFFER = {};        // { deflated: Image, inflated: Image }
const KILLSCREEN_PUFFER_BBOX = {};   // { deflated: {cx,cy,w,h}, inflated: {...} } opaque content box
(function loadKillScreenPuffer() {
    if (typeof KILL_SCREEN === 'undefined') return;
    if (KILL_SCREEN.puncture) {
        KILLSCREEN_PUNCTURE.onerror = () => console.warn('Kill-screen puncture overlay missing:', KILL_SCREEN.puncture);
        KILLSCREEN_PUNCTURE.src = KILL_SCREEN.puncture;
    }
    if (KILL_SCREEN.pufferBody) {
        for (const k of ['deflated', 'inflated']) {
            if (!KILL_SCREEN.pufferBody[k]) continue;
            const im = new Image();
            im.onload = () => { KILLSCREEN_PUFFER_BBOX[k] = computeOpaqueBBox(im); };
            im.onerror = () => console.warn('Kill-screen puffer body missing:', KILL_SCREEN.pufferBody[k]);
            im.src = KILL_SCREEN.pufferBody[k];
            KILLSCREEN_PUFFER[k] = im;
        }
    }
})();

// Cover-fit transform of the plate onto a w×h canvas (CSS object-fit: cover).
function killScreenCoverFit(w, h) {
    const PW = KILL_SCREEN.plateSize.w, PH = KILL_SCREEN.plateSize.h;
    const scale = Math.max(w / PW, h / PH);
    const dw = PW * scale, dh = PH * scale;
    return { scale, dw, dh, ox: (w - dw) / 2, oy: (h - dh) / 2 };
}

// A region ({x,y,w,h} in plate fractions) → canvas pixels.
function killScreenRegionRect(region, w, h) {
    const C = killScreenCoverFit(w, h);
    return { x: C.ox + region.x * C.dw, y: C.oy + region.y * C.dh, w: region.w * C.dw, h: region.h * C.dh };
}

// The faceplate window in canvas pixels (+ a circular equivalent for the reused
// porthole-space crack/spray/breath helpers).
function getFaceplateRect(w, h) {
    // Procedural mask: the visor is a clean rect we generate, so the cinematic fits by construction.
    if (typeof KILL_SCREEN !== 'undefined' && KILL_SCREEN.maskMode === 'procedural') {
        return killScreenMaskGeom(w, h).visor;
    }
    // Plate mode: prefer the chroma-green fit-zone detected on the plate; else the config region.
    const f = killScreenRegionsDetected.FACEPLATE_MASK || KILL_SCREEN.regions.FACEPLATE_MASK;
    const r = killScreenRegionRect(f, w, h);
    return {
        x: r.x, y: r.y, w: r.w, h: r.h,
        cx: r.x + r.w / 2, cy: r.y + r.h / 2,
        r: Math.min(r.w, r.h) * 0.5 * 1.05,
        round: (f.round || 0.1) * Math.min(r.w, r.h)
    };
}

function _ksRoundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function drawKillScreenPlate(kctx, w, h) {
    if (!killScreenPlateReady || !killScreenPlate) return false;
    const C = killScreenCoverFit(w, h);
    kctx.drawImage(killScreenPlate, C.ox, C.oy, C.dw, C.dh);
    return true;
}

// ── Procedural diver-helmet mask (KILL_SCREEN.maskMode === 'procedural') ──
// The mask is generated around defined rects, so the cinematic fits the glass exactly. One
// source of truth for both the creature cam and the crush cinematic.

// Mask geometry in canvas pixels: central visor (clean rounded-rect shaped to suit the portrait
// creature frames) + two side ports (for the §0.9 glimpse) + two panel housings.
function killScreenMaskGeom(w, h) {
    const m = (typeof KILL_SCREEN !== 'undefined' && KILL_SCREEN.mask) || {};
    const aspect = m.visorAspect || 0.92;
    const refH = Math.min(h, w * 0.62);           // helmet "height" reference
    let visorH = refH * (m.visorScale || 0.76);
    let visorW = visorH * aspect;
    const maxW = w * (m.visorMaxWFrac || 0.44);    // keep room for ports + frame
    if (visorW > maxW) { visorW = maxW; visorH = visorW / aspect; }
    const cx = w / 2, cy = h * (m.centerYFrac || 0.50);
    const minSide = Math.min(visorW, visorH);
    const visor = {
        x: cx - visorW / 2, y: cy - visorH / 2, w: visorW, h: visorH, cx, cy,
        r: minSide * 0.5 * 1.05,                   // circular equiv for porthole-space helpers
        round: (m.round || 0.16) * minSide,
        bezel: (m.bezel || 0.085) * minSide
    };
    // Side ports flank the visor, tall and narrow, vertically centred.
    const portW = visorW * (m.portScale || 0.34);
    const portH = visorH * (m.portHFrac || 0.66);
    const gap = visorW * (m.portGapFrac || 0.16);
    const portY = cy - portH / 2 + visorH * 0.03;
    const portMin = Math.min(portW, portH);
    const mkPort = (pcx) => ({
        x: pcx - portW / 2, y: portY, w: portW, h: portH,
        cx: pcx, cy: portY + portH / 2,
        round: portMin * 0.18, bezel: (m.bezel || 0.085) * portMin
    });
    const edge = w * 0.02 + portW / 2;             // clamp ports inside the canvas
    const portL = mkPort(Math.max(edge, visor.x - gap - portW / 2));
    const portR = mkPort(Math.min(w - edge, visor.x + visorW + gap + portW / 2));
    const panelL = { x: w * 0.06, y: h * 0.10, w: w * 0.13, h: h * 0.135 };
    const panelR = { x: w * 0.81, y: h * 0.10, w: w * 0.13, h: h * 0.135 };
    return { visor, portL, portR, panelL, panelR };
}

// One framed window: metal bezel ring + black glass void + glass rim + bolts.
function drawKillScreenHelmetWindow(kctx, win, bolts) {
    const m = (typeof KILL_SCREEN !== 'undefined' && KILL_SCREEN.mask) || {};
    const bz = win.bezel || Math.min(win.w, win.h) * 0.08;
    const ox = win.x - bz, oy = win.y - bz, ow = win.w + bz * 2, oh = win.h + bz * 2;
    kctx.save();
    // Bezel face (brushed-metal gradient) with a dark separation line from the helmet.
    const bg = kctx.createLinearGradient(ox, oy, ox, oy + oh);
    bg.addColorStop(0, m.metalLite || '#3c4c57');
    bg.addColorStop(0.5, m.metalMid || '#222d35');
    bg.addColorStop(1, m.metalDark || '#10161c');
    _ksRoundRect(kctx, ox, oy, ow, oh, win.round + bz);
    kctx.fillStyle = bg; kctx.fill();
    kctx.lineWidth = Math.max(1, bz * 0.12); kctx.strokeStyle = 'rgba(0,0,0,0.6)'; kctx.stroke();
    // The glass void (the cinematic / glimpse draws over this).
    _ksRoundRect(kctx, win.x, win.y, win.w, win.h, win.round);
    kctx.fillStyle = '#02040a'; kctx.fill();
    // Glass rim: light top, dark bottom (seats the glass in the bezel).
    kctx.save();
    _ksRoundRect(kctx, win.x, win.y, win.w, win.h, win.round); kctx.clip();
    const rim = kctx.createLinearGradient(win.x, win.y, win.x, win.y + win.h);
    rim.addColorStop(0, 'rgba(150,170,185,0.5)');
    rim.addColorStop(0.5, 'rgba(40,55,65,0.22)');
    rim.addColorStop(1, 'rgba(10,16,22,0.6)');
    kctx.lineWidth = Math.max(2, bz * 0.5); kctx.strokeStyle = rim;
    _ksRoundRect(kctx, win.x, win.y, win.w, win.h, win.round); kctx.stroke();
    kctx.restore();
    // Rivets around the bezel ring.
    if (bolts) {
        const rx = ow * 0.5 - bz * 0.5, ry = oh * 0.5 - bz * 0.5;
        for (let i = 0; i < bolts; i++) {
            const a = (i / bolts) * Math.PI * 2 - Math.PI / 2;
            const bxx = win.cx + Math.cos(a) * rx, byy = win.cy + Math.sin(a) * ry;
            kctx.fillStyle = m.metalDark || '#10161c';
            kctx.beginPath(); kctx.arc(bxx, byy, Math.max(1.5, bz * 0.18), 0, Math.PI * 2); kctx.fill();
            kctx.fillStyle = 'rgba(180,195,205,0.5)';
            kctx.beginPath(); kctx.arc(bxx - bz * 0.05, byy - bz * 0.05, Math.max(0.8, bz * 0.07), 0, Math.PI * 2); kctx.fill();
        }
    }
    kctx.restore();
}

// The whole helmet interior: metal fill + vignette + panel housings + side ports + central visor.
function drawProceduralHelmetMask(kctx, w, h, M) {
    const m = (typeof KILL_SCREEN !== 'undefined' && KILL_SCREEN.mask) || {};
    // Helmet metal fills the frame.
    const bg = kctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, m.metalMid || '#222d35');
    bg.addColorStop(0.5, m.metalDark || '#10161c');
    bg.addColorStop(1, '#080c11');
    kctx.fillStyle = bg; kctx.fillRect(0, 0, w, h);
    // Top light + edge vignette for cavity depth.
    const vg = kctx.createRadialGradient(w / 2, h * 0.42, Math.min(w, h) * 0.2, w / 2, h * 0.5, Math.max(w, h) * 0.72);
    vg.addColorStop(0, 'rgba(70,90,105,0.12)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    kctx.fillStyle = vg; kctx.fillRect(0, 0, w, h);
    // Panel housings (recessed; text drawn later by drawKillScreenPanels).
    for (const pr of [M.panelL, M.panelR]) {
        kctx.save();
        _ksRoundRect(kctx, pr.x, pr.y, pr.w, pr.h, Math.min(pr.w, pr.h) * 0.12);
        kctx.fillStyle = '#070b0e'; kctx.fill();
        kctx.lineWidth = Math.max(1, pr.h * 0.04); kctx.strokeStyle = 'rgba(120,140,150,0.35)'; kctx.stroke();
        kctx.restore();
    }
    drawKillScreenHelmetWindow(kctx, M.portL, 8);
    drawKillScreenHelmetWindow(kctx, M.portR, 8);
    drawKillScreenHelmetWindow(kctx, M.visor, m.bolts || 16);
}

// Surround used by BOTH cinematics — procedural mask or legacy plate.
function drawKillScreenSurround(kctx, w, h) {
    if (typeof KILL_SCREEN !== 'undefined' && KILL_SCREEN.maskMode === 'procedural') {
        drawProceduralHelmetMask(kctx, w, h, killScreenMaskGeom(w, h));
        return true;
    }
    const plateOk = drawKillScreenPlate(kctx, w, h);
    if (!plateOk) drawHelmetFrameOverlay(kctx, w, h);
    return plateOk;
}

// Repaint the helmet readout panels (baked plate labels are ignored).
// opts: { depth, allSevered, hosesLost:[], t }
function drawKillScreenPanels(kctx, w, h, opts) {
    if (typeof KILL_SCREEN === 'undefined') return;
    const proc = KILL_SCREEN.maskMode === 'procedural';
    const M = proc ? killScreenMaskGeom(w, h) : null;
    const R = proc ? null : KILL_SCREEN.regions.PANEL_SCREEN_RECTS;
    const strobe = Math.sin((opts.t || 0) * 12) > 0;
    const sev = (k) => opts.allSevered || (opts.hosesLost && opts.hosesLost.includes(k));
    const redCol = strobe ? '#ff5050' : '#7a1d1d';
    function panel(rect, lines) {
        const r = proc ? rect : killScreenRegionRect(rect, w, h);
        const lh = r.h / Math.max(lines.length, 1);
        kctx.textAlign = 'left';
        kctx.textBaseline = 'middle';
        kctx.font = `bold ${Math.max(8, Math.round(lh * 0.6))}px 'Courier New'`;
        lines.forEach((ln, i) => {
            kctx.fillStyle = ln.red ? redCol : '#46d6ff';
            kctx.fillText(ln.text, r.x + r.w * 0.08, r.y + lh * (i + 0.5));
        });
    }
    panel(proc ? M.panelL : R.left, [
        { text: `DEPTH ${opts.depth}m`, red: true },
        { text: `O2  ${sev('o2') ? 'FAIL' : 'OK'}`, red: sev('o2') },
        { text: `PWR ${sev('radio') ? 'FAIL' : 'OK'}`, red: sev('radio') }
    ]);
    panel(proc ? M.panelR : R.right, [
        { text: `WATER ${sev('water') ? 'SEV' : 'OK'}`, red: sev('water') },
        { text: `RADIO ${sev('radio') ? 'SEV' : 'OK'}`, red: sev('radio') },
        { text: strobe ? '! CRUSH !' : '', red: true }
    ]);
}

function drawTerminalWord(kctx, w, h, word, since) {
    const p = clamp01(since / 0.5);
    kctx.save();
    kctx.globalAlpha = p;
    kctx.translate(w / 2, h * 0.5);
    kctx.scale(0.7 + p * 0.3, 0.7 + p * 0.3);
    kctx.textAlign = 'center';
    kctx.textBaseline = 'middle';
    kctx.font = `bold ${Math.round(h * 0.12)}px 'Courier New'`;
    kctx.shadowColor = 'rgba(255,40,40,0.9)';
    kctx.shadowBlur = 30;
    kctx.fillStyle = '#ff2a2a';
    kctx.fillText(word, 0, 0);
    kctx.restore();
}

// ── Glass cracks, stored in normalized porthole space (center 0,0 radius 1) ──
function addPortholeCracks(list, burstCount, origin) {
    for (let b = 0; b < burstCount; b++) {
        const o = origin || {
            u: (Math.random() - 0.5) * 1.1,
            v: (Math.random() - 0.5) * 1.1
        };
        const branches = [];
        const num = 4 + Math.floor(Math.random() * 4);
        for (let i = 0; i < num; i++) {
            const baseAng = (Math.PI * 2 / num) * i + (Math.random() - 0.5) * 0.7;
            const pts = [{ u: o.u, v: o.v }];
            let pu = o.u, pv = o.v, a = baseAng;
            const segs = 3 + Math.floor(Math.random() * 4);
            for (let s2 = 0; s2 < segs; s2++) {
                a += (Math.random() - 0.5) * 0.9;
                const len = 0.10 + Math.random() * 0.22;
                pu += Math.cos(a) * len;
                pv += Math.sin(a) * len;
                pts.push({ u: pu, v: pv });
            }
            branches.push(pts);
        }
        list.push({ origin: o, branches, born: performance.now(), width: 1.2 + Math.random() * 1.6 });
    }
}

function drawPortholeCracks(kctx, P, cracks) {
    if (!cracks || !cracks.length) return;
    kctx.save();
    kctx.beginPath();
    kctx.arc(P.cx, P.cy, P.r, 0, Math.PI * 2);
    kctx.clip();
    for (const c of cracks) {
        const age = (performance.now() - c.born) / 1000;
        const grow = clamp01(age * 3.5);   // branches race outward over ~0.3s
        kctx.strokeStyle = 'rgba(215, 235, 255, 0.85)';
        kctx.shadowColor = 'rgba(170, 215, 255, 0.8)';
        kctx.shadowBlur = 5;
        kctx.lineWidth = c.width;
        for (const pts of c.branches) {
            const n = Math.max(2, Math.ceil(pts.length * grow));
            kctx.beginPath();
            for (let i = 0; i < n; i++) {
                const x = P.cx + pts[i].u * P.r;
                const y = P.cy + pts[i].v * P.r;
                if (i === 0) kctx.moveTo(x, y); else kctx.lineTo(x, y);
            }
            kctx.stroke();
        }
        // Bright impact point
        kctx.shadowBlur = 10;
        kctx.fillStyle = 'rgba(240, 250, 255, 0.7)';
        kctx.beginPath();
        kctx.arc(P.cx + c.origin.u * P.r, P.cy + c.origin.v * P.r, c.width * 1.6, 0, Math.PI * 2);
        kctx.fill();
    }
    kctx.shadowBlur = 0;
    kctx.restore();
}

// ── Dark water behind the glass: gradient, drifting motes, dying light ──
function drawHelmetWater(kctx, P, opts = {}) {
    const sinkSpeed = opts.sinkSpeed || 0;   // >0 makes motes stream upward (we are falling)
    const t = performance.now();
    const grad = kctx.createRadialGradient(P.cx, P.cy - P.r * 0.3, P.r * 0.1, P.cx, P.cy, P.r * 1.2);
    grad.addColorStop(0, opts.topColor || 'rgba(10, 34, 44, 1)');
    grad.addColorStop(0.6, 'rgba(4, 14, 22, 1)');
    grad.addColorStop(1, 'rgba(0, 2, 5, 1)');
    kctx.fillStyle = grad;
    kctx.fillRect(P.cx - P.r, P.cy - P.r, P.r * 2, P.r * 2);

    // Drifting marine motes (deterministic from index, no per-frame allocs)
    for (let i = 0; i < 36; i++) {
        const seed = i * 127.3;
        const driftY = sinkSpeed > 0
            ? (1 - (((t * 0.00006 * sinkSpeed) + i * 0.061) % 1))      // streaming up
            : ((t * 0.000012 + i * 0.061) % 1);                        // gentle fall
        const px = P.cx + (((seed % 17) / 17) - 0.5) * 2 * P.r * 0.95
            + Math.sin(t * 0.0004 + i) * 6;
        const py = P.cy - P.r + driftY * P.r * 2;
        const alpha = 0.05 + ((seed % 7) / 7) * 0.16;
        const len = sinkSpeed > 1.5 ? 6 + sinkSpeed * 2 : 0;
        kctx.fillStyle = `rgba(185, 215, 230, ${alpha})`;
        if (len > 0) {
            kctx.fillRect(px, py, 1.4, len);   // streaks when falling fast
        } else {
            kctx.beginPath();
            kctx.arc(px, py, 0.8 + (seed % 3) * 0.6, 0, Math.PI * 2);
            kctx.fill();
        }
    }
}

// ── Breath bubbles inside the helmet glass ──
function updateAndDrawBreathBubbles(kctx, P, store, dt, rate = 0.5) {
    if (Math.random() < rate * dt * 3) {
        store.push({
            x: P.cx + (Math.random() - 0.5) * P.r * 0.7,
            y: P.cy + P.r * 0.85,
            vy: -(30 + Math.random() * 50),
            r: 1.5 + Math.random() * 4,
            life: 1
        });
    }
    for (let i = store.length - 1; i >= 0; i--) {
        const b = store[i];
        b.y += b.vy * dt;
        b.x += Math.sin(performance.now() * 0.004 + b.r * 9) * 0.5;
        b.life -= dt * 0.5;
        if (b.life <= 0 || b.y < P.cy - P.r) { store.splice(i, 1); continue; }
        kctx.strokeStyle = `rgba(190, 230, 255, ${0.35 * b.life})`;
        kctx.lineWidth = 1;
        kctx.beginPath();
        kctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        kctx.stroke();
    }
}

// ── Glass shards (normalized) for implosion / shatter moments ──
function spawnShards(list, inward) {
    for (let i = 0; i < 34; i++) {
        const ang = Math.random() * Math.PI * 2;
        const speed = (0.8 + Math.random() * 2.2) * (inward ? -1 : 1);
        list.push({
            u: Math.cos(ang) * (inward ? 1.0 : 0.15),
            v: Math.sin(ang) * (inward ? 1.0 : 0.15),
            vu: Math.cos(ang) * speed,
            vv: Math.sin(ang) * speed + (inward ? 0.25 : 0),
            rot: Math.random() * Math.PI * 2,
            rotV: (Math.random() - 0.5) * 12,
            w: 0.04 + Math.random() * 0.10,
            h: 0.02 + Math.random() * 0.05,
            alpha: 1
        });
    }
}

function updateAndDrawShards(kctx, P, list, dt) {
    kctx.save();
    kctx.beginPath();
    kctx.arc(P.cx, P.cy, P.r, 0, Math.PI * 2);
    kctx.clip();
    for (const sh of list) {
        sh.u += sh.vu * dt;
        sh.v += sh.vv * dt;
        sh.rot += sh.rotV * dt;
        sh.alpha = Math.max(0, sh.alpha - dt * 0.9);
        if (sh.alpha <= 0) continue;
        kctx.save();
        kctx.translate(P.cx + sh.u * P.r, P.cy + sh.v * P.r);
        kctx.rotate(sh.rot);
        kctx.fillStyle = `rgba(195, 225, 245, ${sh.alpha * 0.75})`;
        kctx.fillRect(-sh.w * P.r / 2, -sh.h * P.r / 2, sh.w * P.r, sh.h * P.r);
        kctx.fillStyle = `rgba(255, 255, 255, ${sh.alpha * 0.35})`;
        kctx.fillRect(-sh.w * P.r / 2, -sh.h * P.r / 2, sh.w * P.r * 0.35, sh.h * P.r * 0.45);
        kctx.restore();
    }
    kctx.restore();
}

// ============================================
// ABYSS DEATH v2 — all hoses severed
//   Act 1  third person: the lines whip away and the diver drops into the dark
//   Act 2  inside the helmet: depth runs away, the hull groans, the glass
//          cracks in stages — then the implosion
// ============================================

// ── Death-event payload — Core → Theme interface for the kill screen ──
// Andrew's reframing (cartridge-layer authorized 2026-06-19): hoses = Zone Impact
// (3 zones; all 3 lost → 'crush'), the diver = Player Impact (type-to-survive fail
// → 'creature'). The engine reports WHAT killed the diver; the cartridge plays the
// matching cinematic. Core stays theme-agnostic. See KILL_SCREEN in config.js.
function buildDeathEvent(cause, killerCreature) {
    const hoses_lost = [];
    if (state.gasSevered) hoses_lost.push('o2');
    if (state.liquidSevered) hoses_lost.push('water');
    if (state.electricalSevered) hoses_lost.push('radio');
    const creatureMap = { greatWhite: 'greatwhite', moray: 'moray', boxJellyfish: 'jellyfish', pufferfish: 'pufferfish' };
    let creature = null;
    if (killerCreature && killerCreature.creatureType) {
        const id = killerCreature.creatureType.killCamId || killerCreature.creatureType.spriteType;
        creature = creatureMap[id] || null;
    }
    // §0.9 §D: the pufferfish death arrives via the TOC sub-machine; side targets via 'side'.
    const via = creature ? (creature === 'pufferfish' ? 'toc' : 'side') : null;
    state.deathEvent = { cause, creature, via, hoses_lost };
    return state.deathEvent;
}

function triggerAbyssDeath() {
    if (state.abyssDeathActive || state.killCamActive) return;
    Helmet.reset();
    state.abyssDeathActive = true;
    buildDeathEvent('crush', null);
    state.running = false;

    // Strip the tactical layer — sonar overlays, sweep arm, grapple UI all
    // vanish; the screen belongs to the cinematic now
    cleanupAllSonarOverlays();
    document.querySelectorAll('.adrenaline-focus').forEach(el => el.remove());
    const grapplePopupEl = document.getElementById('grapple-popup');
    if (grapplePopupEl) grapplePopupEl.classList.add('hidden');
    const wrapperEl = document.getElementById('canvas-wrapper');
    if (wrapperEl) wrapperEl.classList.remove('grapple-shake');
    const tetherSvg = document.getElementById('tether-layer');
    if (tetherSvg) tetherSvg.innerHTML = '';
    if (DOM.input) DOM.input.blur();

    showStatus("ALL HOSES SEVERED — SINKING INTO THE ABYSS", "impact");
    AudioManager.stopMusic();
    AudioManager.play('killCamStart');

    const ctx = DOM.ctx;
    const W = COORD_SYSTEM.width;
    const H = COORD_SYSTEM.height;
    const aq = getAquanaut();
    if (!aq) { gameOver('abyss'); return; }

    const startY = aq.y;
    const hoseColors = ['#33ff66', '#ff8833', '#ffdd33'];

    // Timeline (seconds)
    const T_HELMET = 3.45;     // cut from third person to inside the helmet
    const T_IMPLODE = 8.6;
    const T_END = 11.5;        // extra hold so the CRUSHED card reads before blackout

    const seq = {
        t: 0,
        bubbles: [],
        breath: [],
        cracks: [],
        shards: [],
        sprayEmitters: [],
        sprayParts: [],
        shake: 0,
        flash: 0,
        imploded: false,
        eventIdx: 0,
        events: [
            { t: 0.05, fn: () => AudioManager.play('hoseDown') },
            { t: 0.9,  fn: () => AudioManager.play('metalGroan') },
            { t: 2.2,  fn: () => AudioManager.play('heartbeat') },
            { t: 3.0,  fn: () => AudioManager.play('heartbeat') },
            { t: 3.6,  fn: () => AudioManager.play('metalGroan') },
            { t: 4.6,  fn: () => abyssCrackStage(seq, false) },
            { t: 5.5,  fn: () => AudioManager.play('heartbeat') },
            { t: 6.2,  fn: () => abyssCrackStage(seq, false) },
            { t: 6.9,  fn: () => AudioManager.play('metalGroan') },
            { t: 7.5,  fn: () => abyssCrackStage(seq, true) },
            { t: 8.1,  fn: () => AudioManager.play('heartbeat') },
            { t: T_IMPLODE, fn: () => abyssImplode(seq) }
        ]
    };

    function abyssCrackStage(s, big) {
        AudioManager.play('glassCrack');
        addPortholeCracks(s.cracks, big ? 2 : 1);
        s.shake = big ? 14 : 9;
        s.flash = 0.35;
        // Spray jet from the newest crack
        const c = s.cracks[s.cracks.length - 1];
        s.sprayEmitters.push({ u: c.origin.u, v: c.origin.v });
    }

    function abyssImplode(s) {
        AudioManager.play('implosion');
        AudioManager.play('glassCrack');
        s.imploded = true;
        s.implodedAt = s.t;
        s.shake = 26;
        s.flash = 1;
        addPortholeCracks(s.cracks, 4);   // glass spiderwebs all at once
        spawnShards(s.shards, true);
    }

    let lastFrame = performance.now();

    function frame(ts) {
        const dt = Math.min((ts - lastFrame) / 1000, 0.05);
        lastFrame = ts;
        seq.t += dt;
        const t = seq.t;

        // Fire timed events
        while (seq.eventIdx < seq.events.length && seq.events[seq.eventIdx].t <= t) {
            try { seq.events[seq.eventIdx].fn(); } catch (e) { console.error(e); }
            seq.eventIdx++;
        }
        seq.shake = Math.max(0, seq.shake - dt * 22);
        seq.flash = Math.max(0, seq.flash - dt * 1.8);

        if (t < T_HELMET) {
            drawAbyssThirdPerson(t, dt);
        } else {
            if (t - dt < T_HELMET) {
                // First helmet frame — bring up the overlay
                const overlay = document.getElementById('kill-cam-overlay');
                if (overlay) overlay.classList.remove('hidden');
            }
            drawAbyssHelmet(t - T_HELMET, dt);
        }

        if (t < T_END) {
            if (document.visibilityState === 'hidden') {
                setTimeout(() => frame(performance.now()), 16);
            } else {
                requestAnimationFrame(frame);
            }
        } else {
            const overlay = document.getElementById('kill-cam-overlay');
            if (overlay) overlay.classList.add('hidden');
            state.abyssDeathActive = false;
            gameOver('abyss');
        }
    }

    // ── Act 1: third person — the diver drops away ──
    function drawAbyssThirdPerson(t, dt) {
        ctx.resetTransform();
        ctx.clearRect(0, 0, DOM.canvas.width, DOM.canvas.height);
        ctx.save();
        ctx.scale(canvasScaleX, canvasScaleY);

        const sinkP = easeInCubic(clamp01((t - 0.25) / 2.6));

        // Water swallowing the light
        const dark = sinkP * sinkP;
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, lerpColor('#0c3050', '#000000', dark));
        grad.addColorStop(1, lerpColor('#061828', '#000000', Math.min(1, dark * 1.4)));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Severed hose ends whipping toward the surface
        if (t < 1.6) {
            hoseColors.forEach((color, i) => {
                const wob = Math.sin(t * 9 + i * 2.5) * 28;
                ctx.strokeStyle = color + 'aa';
                ctx.lineWidth = 3.5;
                ctx.beginPath();
                ctx.moveTo(aq.x + (i - 1) * 7, startY - 60 - t * 140);
                ctx.quadraticCurveTo(
                    aq.x + wob + (i - 1) * 12, startY - 120 - t * 200,
                    aq.x + wob * 0.5 + (i - 1) * 18, startY - 190 - t * 260
                );
                ctx.stroke();
            });
        }

        // The diver, dwindling toward a vanishing point — they stay in frame
        // the whole act, shrinking and dimming as the dark takes them
        const diverY = startY + (H * 0.88 - startY) * sinkP;
        {
            const scale = Math.max(0.07, 1 - sinkP * 0.95);
            const diverAlpha = Math.max(0, 1 - sinkP * sinkP * 1.05);
            const sprH = 90;
            const sprW = aquanautSpriteLoaded
                ? sprH * (aquanautSprite.naturalWidth / aquanautSprite.naturalHeight)
                : 30;

            // Bubble trail rising off the suit
            if (Math.random() < 0.75 && diverAlpha > 0.05) {
                seq.bubbles.push({
                    x: aq.x + (Math.random() - 0.5) * 26 * scale,
                    y: diverY - 30 * scale,
                    vy: -(40 + Math.random() * 90),
                    r: (1 + Math.random() * 3) * Math.max(0.4, scale),
                    life: 1
                });
            }

            if (diverAlpha > 0.01) {
                ctx.save();
                ctx.globalAlpha = diverAlpha;
                ctx.translate(aq.x, diverY);
                ctx.scale(scale, scale);
                ctx.rotate(Math.sin(t * 2.2) * 0.6 * sinkP);
                if (aquanautSpriteLoaded) {
                    ctx.drawImage(aquanautSprite, -sprW / 2, -sprH, sprW, sprH);
                }
                // Headlamp guttering out
                if (Math.random() > sinkP * 0.85) {
                    ctx.fillStyle = 'rgba(255, 255, 215, 0.8)';
                    ctx.shadowColor = '#ffffcc';
                    ctx.shadowBlur = 12;
                    ctx.beginPath();
                    ctx.arc(1, -sprH * 0.92, 3.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
                ctx.restore();
            }
        }

        // Rising bubbles
        for (let i = seq.bubbles.length - 1; i >= 0; i--) {
            const b = seq.bubbles[i];
            b.y += b.vy * dt;
            b.x += Math.sin(performance.now() * 0.005 + b.x) * 0.4;
            b.life -= dt * 0.8;
            if (b.life <= 0) { seq.bubbles.splice(i, 1); continue; }
            ctx.fillStyle = `rgba(120, 200, 255, ${b.life * 0.35})`;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.fill();
        }

        // Depth readout running away
        const depth = Math.floor(getCurrentDepth() + sinkP * sinkP * 2600);
        ctx.fillStyle = `rgba(120, 210, 255, ${0.75 - dark * 0.4})`;
        ctx.font = "bold 26px 'Courier New'";
        ctx.textAlign = 'center';
        ctx.fillText(`DEPTH ${depth}m — NO TETHER`, W / 2, H * 0.10);
        if (sinkP > 0.35) {
            ctx.fillStyle = `rgba(255, 60, 60, ${0.35 + Math.sin(t * 9) * 0.3})`;
            ctx.font = "bold 30px 'Courier New'";
            ctx.fillText('⚠ PRESSURE CRITICAL ⚠', W / 2, H * 0.175);
        }

        // Cut to black just before the helmet act
        if (t > T_HELMET - 0.45) {
            ctx.fillStyle = `rgba(0, 0, 0, ${clamp01((t - (T_HELMET - 0.45)) / 0.45)})`;
            ctx.fillRect(0, 0, W, H);
        }

        ctx.restore();
    }

    // ── Act 2: inside the helmet — crush depth ──
    function drawAbyssHelmet(ht, dt) {
        const killCanvas = sizeKillCanvas();
        if (!killCanvas) return;
        const kctx = killCanvas.getContext('2d');
        const w = killCanvas.width, h = killCanvas.height;
        const F = getFaceplateRect(w, h);
        const P = { cx: F.cx, cy: F.cy, r: F.r };   // porthole-space for the reused helpers

        kctx.setTransform(1, 0, 0, 1, 0, 0);
        kctx.clearRect(0, 0, w, h);
        kctx.fillStyle = '#000';
        kctx.fillRect(0, 0, w, h);

        kctx.save();
        if (seq.shake > 0.2) {
            kctx.translate((Math.random() - 0.5) * seq.shake, (Math.random() - 0.5) * seq.shake);
        }

        // ── Helmet surround (its black faceplate = the void the diver sinks into) ──
        drawKillScreenSurround(kctx, w, h);

        // ── Scene through the faceplate window ──
        kctx.save();
        _ksRoundRect(kctx, F.x, F.y, F.w, F.h, F.round);
        kctx.clip();

        // The void the diver is sinking into (faceplate is already black)
        kctx.fillStyle = '#01040a';
        kctx.fillRect(F.x, F.y, F.w, F.h);
        const sinkSpeed = 2.5 + ht * 0.4;
        drawHelmetWater(kctx, P, { sinkSpeed });

        // Breath bubbles — panicked breathing climbs with time
        updateAndDrawBreathBubbles(kctx, P, seq.breath, dt, 0.5 + ht * 0.18);

        // Spray jets from cracked glass
        for (const em of seq.sprayEmitters) {
            for (let i = 0; i < 2; i++) {
                if (Math.random() < 0.8) {
                    const towardC = Math.atan2(-em.v, -em.u);
                    const a = towardC + (Math.random() - 0.5) * 0.8;
                    const sp = 1.2 + Math.random() * 2.0;
                    seq.sprayParts.push({
                        u: em.u, v: em.v,
                        vu: Math.cos(a) * sp,
                        vv: Math.sin(a) * sp,
                        life: 0.5 + Math.random() * 0.4
                    });
                }
            }
        }
        for (let i = seq.sprayParts.length - 1; i >= 0; i--) {
            const p = seq.sprayParts[i];
            p.u += p.vu * dt;
            p.v += p.vv * dt;
            p.life -= dt * 1.6;
            if (p.life <= 0) { seq.sprayParts.splice(i, 1); continue; }
            kctx.fillStyle = `rgba(220, 240, 255, ${p.life * 0.7})`;
            kctx.fillRect(P.cx + p.u * P.r, P.cy + p.v * P.r, 2, 2 + Math.abs(p.vv) * 3);
        }

        // The cracks — spiderwebbing the faceplate
        drawPortholeCracks(kctx, P, seq.cracks);

        // Implosion: shards blast inward, water floods up the window
        if (seq.imploded) {
            const since = seq.t - seq.implodedAt;
            updateAndDrawShards(kctx, P, seq.shards, dt);
            const flood = clamp01(since / 0.7);
            kctx.fillStyle = `rgba(8, 30, 45, ${flood * 0.85})`;
            kctx.fillRect(F.x, F.y + F.h - flood * F.h * 1.1, F.w, F.h * 1.2);
        }

        // Crack-stage flash
        if (seq.flash > 0.01) {
            kctx.fillStyle = `rgba(225, 240, 255, ${seq.flash * 0.55})`;
            kctx.fillRect(F.x, F.y, F.w, F.h);
        }

        // Faceplate pressure warning
        const depth = Math.floor(1500 + ht * 420);
        if (Math.sin(performance.now() * 0.012) > -0.2 && !seq.imploded) {
            kctx.fillStyle = 'rgba(255, 70, 70, 0.9)';
            kctx.textAlign = 'center';
            kctx.font = `bold ${Math.round(F.h * 0.055)}px 'Courier New'`;
            kctx.fillText('⚠ HULL STRESS CRITICAL ⚠', F.cx, F.y + F.h * 0.30);
        }

        kctx.restore();   // unclip

        // ── Live panel readouts (DEPTH running away; all hoses severed = red strobe) ──
        drawKillScreenPanels(kctx, w, h, { depth, allSevered: true, t: seq.t });

        kctx.restore();   // unshake

        // Terminal word once the glass gives
        if (seq.imploded) {
            const word = (typeof KILL_SCREEN !== 'undefined' && KILL_SCREEN.terminalWords.crush) || 'CRUSHED';
            drawTerminalWord(kctx, w, h, word, seq.t - seq.implodedAt);
        }

        // Cut-in fade at the start of the act, blackout at the very end
        if (ht < 0.5) {
            kctx.fillStyle = `rgba(0, 0, 0, ${1 - ht / 0.5})`;
            kctx.fillRect(0, 0, w, h);
        }
        const blackoutStart = T_IMPLODE - T_HELMET + 2.2;
        if (ht > blackoutStart) {
            kctx.fillStyle = `rgba(0, 0, 0, ${clamp01((ht - blackoutStart) / 0.8)})`;
            kctx.fillRect(0, 0, w, h);
        }
    }

    if (document.visibilityState === 'hidden') {
        setTimeout(() => frame(performance.now()), 16);
    } else {
        requestAnimationFrame(frame);
    }
}

// ============================================
// KILL CAM — a creature got the diver
// One generic plate-based cinematic (front_closed lurks → front_open strikes →
// cracks/slime → terminal word), driven by the death-event payload. See KILL_SCREEN.
// ============================================

const KILLCAM_FADEOUT = 0.9;   // seconds of fade-out at the end of the cinematic

function triggerKillCam(killerCreature) {
    if (state.killCamActive || state.abyssDeathActive) return;
    Helmet.reset();
    state.killCamActive = true;
    buildDeathEvent('creature', killerCreature);

    const ct = (killerCreature && killerCreature.creatureType) || CREATURE_TYPES.greatWhite;
    const key = ct.killCamId || 'greatWhite';                 // for DEATH_SCREENS / gameOver
    const creature = (state.deathEvent && state.deathEvent.creature) || 'greatwhite';
    const isJelly = creature === 'jellyfish';
    const behavior = (typeof KILL_SCREEN !== 'undefined' && KILL_SCREEN.behaviors && KILL_SCREEN.behaviors[creature]) || {};
    const mode = behavior.mode || (isJelly ? 'strangle' : 'devour');
    const T_STRIKE = 3.4;                                     // lurk → strike

    // One cinematic skeleton (front_closed lurks → front_open strikes → aftermath →
    // terminal word), with a per-creature VIOLENT behaviour layered on (see
    // KILL_SCREEN.behaviors): shark devours (ENGULFED), moray breaches+gnaws (BREACHED), jelly
    // shrouds with ramping sting-flashes (SHROUDED), pufferfish poisons — vision corruption (POISONED).
    const s = {
        t: 0, _dt: 0.016,
        key, ct, creature, isJelly, behavior, mode,
        // Devour holds a total-black-throat beat; poison lets the toxin corruption set in — both
        // delay the terminal word so it lands after the held beat (§0.9 §C).
        wordDelay: ({ devour: 1.25, poison: 1.7 })[mode] || 0,
        goKey: { greatwhite: 'greatWhite', moray: 'moray', jellyfish: 'boxJellyfish' }[creature] || key,
        hosesLost: (state.deathEvent && state.deathEvent.hoses_lost) || [],
        cracks: [], shards: [], breath: [],
        shake: 0, flash: 0,
        struck: false, struckAt: 0, slime: 0,
        blood: 0, constrict: 0, nextJolt: 0, tox: 0,   // gnaw/devour blood · strangle vignette+jolts · poison corruption
        T_STRIKE, glimpseAt: 1.8,
        attackDur: T_STRIKE + 2.2 + (({ devour: 1.0, poison: 2.0 })[mode] || 0),   // extra hold for black-throat / toxin onset
        eventIdx: 0,
        events: [
            { t: 0.2, fn: () => AudioManager.play('metalGroan') },
            { t: 1.0, fn: () => AudioManager.play('heartbeat') },
            { t: 2.2, fn: () => AudioManager.play('heartbeat') },
            { t: 3.0, fn: () => AudioManager.play('heartbeat') },
            { t: T_STRIKE, fn: () => {
                s.struck = true; s.struckAt = s.t;
                s.shake = 24; s.flash = 0.95;
                if (mode === 'strangle')   { AudioManager.play('tentacle'); s.nextJolt = s.t + 0.25; }
                else if (mode === 'gnaw')  {                                   // BREACHED: one puncture, then it's INSIDE the helmet (§0.9 §C)
                    AudioManager.play('glassCrack'); AudioManager.play('jawSnap');
                    addPortholeCracks(s.cracks, 1, { u: 0, v: 0 });             // single central puncture, not a scatter
                }
                else if (mode === 'poison'){ AudioManager.play('glassCrack'); }   // radial-puncture overlay supplies the cracks
                else /* devour */          { AudioManager.play('jawSnap'); AudioManager.play('glassCrack'); addPortholeCracks(s.cracks, 4); }
            } },
            { t: T_STRIKE + 0.55, fn: () => { if (mode === 'devour') addPortholeCracks(s.cracks, 2); } }
        ]
    };

    s.total = s.attackDur + KILLCAM_FADEOUT;
    s.events.sort((a, b) => a.t - b.t);
    state.killCam = s;

    AudioManager.play('killCamStart');
    const overlay = document.getElementById('kill-cam-overlay');
    if (overlay) overlay.classList.remove('hidden');
    if (DOM.input) DOM.input.blur();
}

function updateKillCam(dt) {
    const s = state.killCam;
    if (!s) return;
    s.t += dt;
    s._dt = dt;
    s.shake = Math.max(0, s.shake - dt * 22);
    s.flash = Math.max(0, s.flash - dt * 2.2);

    while (s.eventIdx < s.events.length && s.events[s.eventIdx].t <= s.t) {
        try { s.events[s.eventIdx].fn(); } catch (e) { console.error(e); }
        s.eventIdx++;
    }

    // Per-creature aftermath once the attack lands
    if (s.struck) {
        const beh = s.behavior || {};
        switch (s.mode) {
            case 'gnaw': {
                // Blood blooms and thickens; each chew snap nudges the shake.
                s.blood = Math.min(1, s.blood + dt * 0.55 * (beh.blood || 1));
                const bite = Math.sin((s.t - s.struckAt) * Math.PI * 2 * (beh.gnawHz || 5.5));
                if (bite > 0.85) s.shake = Math.max(s.shake, 6);
                break;
            }
            case 'devour':
                s.blood = Math.min(1, s.blood + dt * 0.35 * (beh.blood || 0.45));
                break;
            case 'poison':
                // POISONED (§0.9): toxin vision-corruption is the kill — NO blood, NO blackout-smash.
                s.tox = Math.min(1, s.tox + dt * (beh.toxRate || 0.5));
                break;
            case 'strangle': {
                // SHROUDED (§0.9): oral-arms creep in from multiple points + sting flashes that
                // WHITE OUT the view, RAMPING in frequency like a rising heartbeat into a final
                // whiteout (escalation, not a flat strobe).
                s.slime = Math.min(1, s.slime + dt * 0.8);
                s.constrict = Math.min(1, s.constrict + dt * (beh.constrictRate || 0.55));
                if (s.t >= s.nextJolt) {
                    s.flash = Math.max(s.flash, 0.95);   // sting flash — white blow-out
                    s.shake = Math.max(s.shake, 12);
                    AudioManager.play('tentacle');
                    const since = s.t - s.struckAt;
                    const hz = (beh.flashHz || 2.8) * (1 + since * 0.9);   // heartbeat accelerates
                    s.nextJolt = s.t + 1 / hz;
                }
                break;
            }
        }
    }

    if (s.t >= s.total) {
        state.killCamActive = false;
        state.killCam = null;
        const overlay = document.getElementById('kill-cam-overlay');
        if (overlay) overlay.classList.add('hidden');
        gameOver(s.goKey || s.key);
    }
}

function drawKillCam() {
    const s = state.killCam;
    if (!state.killCamActive || !s) return;
    const killCanvas = sizeKillCanvas();
    if (!killCanvas) return;
    const kctx = killCanvas.getContext('2d');
    const w = killCanvas.width, h = killCanvas.height;
    const F = getFaceplateRect(w, h);
    const P = { cx: F.cx, cy: F.cy, r: F.r };   // porthole-space for the reused helpers
    const dt = s._dt || 0.016;

    kctx.setTransform(1, 0, 0, 1, 0, 0);
    kctx.clearRect(0, 0, w, h);
    kctx.fillStyle = '#000';
    kctx.fillRect(0, 0, w, h);

    kctx.save();
    if (s.shake > 0.2) {
        kctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);
    }

    // Helmet surround (its black faceplate = the void the creature emerges from)
    drawKillScreenSurround(kctx, w, h);

    // Side-port glimpse as the creature circles before the strike (canon, all creatures)
    if (!s.struck && Math.abs(s.t - s.glimpseAt) < 0.45) {
        drawKillScreenGlimpse(kctx, w, h, s);
    }

    // ── Scene through the faceplate window ──
    kctx.save();
    _ksRoundRect(kctx, F.x, F.y, F.w, F.h, F.round);
    kctx.clip();

    kctx.fillStyle = '#01040a';
    kctx.fillRect(F.x, F.y, F.w, F.h);
    drawHelmetWater(kctx, P, {});

    // The attacker — front_closed lurks, front_open surges on the strike
    drawKillScreenCreature(kctx, F, s);

    // Breathing quickens as the attack builds
    updateAndDrawBreathBubbles(kctx, P, s.breath, dt, 0.4 + clamp01(s.t / s.total) * 0.9);

    // Per-creature gore/aftermath, over the attacker.
    //   gnaw → BREACHED: blood on the PLAYER'S side of the glass (in here with you)
    //   devour → swirls of blood out in the water · strangle → wrap + constriction
    //   poison → no blood (the kill is vision-corruption; handled in its own block)
    if (s.blood > 0.01) {
        if (s.mode === 'gnaw') drawNearSideBlood(kctx, F, s.blood, s.t);
        else drawBloodSwirl(kctx, F, s.blood, s.t);
    }
    if (s.mode === 'strangle') {
        if (s.slime > 0.01) drawTentacleCreep(kctx, F, s.slime, s.t);          // multi-point oral-arm creep
        if (s.constrict > 0.01) drawShroudVignette(kctx, F, s.constrict, s.t); // pale shroud cinching to whiteout
    }
    drawPortholeCracks(kctx, P, s.cracks);
    if (s.shards.length) updateAndDrawShards(kctx, P, s.shards, dt);

    // Great White ENGULFED: the jaws surge in until the open throat blacks out the
    // faceplate edge-to-edge — one held beat of total black before the word (§0.9 §C).
    if (s.mode === 'devour' && s.struck) {
        const throat = clamp01((s.t - s.struckAt - 0.45) / 0.45);
        if (throat > 0.01) {
            kctx.fillStyle = `rgba(0, 0, 0, ${throat})`;
            kctx.fillRect(F.x, F.y, F.w, F.h);
        }
    }

    // Pufferfish POISONED: spines punch through (radial-puncture crack overlay), then the toxin
    // corrupts the view — double vision, desaturation, tunnel-in. No blood, no blackout (§0.9 §C).
    if (s.mode === 'poison' && s.struck) {
        drawPoisonPuncture(kctx, F, s);
        drawPoisonCorruption(kctx, F, s);
    }

    // Flash: white visor blow-out. Strangle jolts blow harder (electric pain).
    if (s.flash > 0.01) {
        const fa = (s.mode === 'strangle') ? s.flash * 0.92 : s.flash * 0.6;
        kctx.fillStyle = `rgba(235, 245, 255, ${fa})`;
        kctx.fillRect(F.x, F.y, F.w, F.h);
    }

    kctx.restore();   // unclip

    // Live panel readouts (hoses lost this run; DEPTH ticking)
    drawKillScreenPanels(kctx, w, h, { depth: 1500 + Math.floor(s.t * 40), hosesLost: s.hosesLost, t: s.t });

    kctx.restore();   // unshake

    // Terminal word once the creature strikes (devour delays it past the black-throat beat)
    if (s.struck && (s.t - s.struckAt) >= (s.wordDelay || 0)) {
        const word = (typeof KILL_SCREEN !== 'undefined' && KILL_SCREEN.terminalWords[s.creature]) || 'LOST';
        drawTerminalWord(kctx, w, h, word, s.t - s.struckAt - (s.wordDelay || 0));
    }

    // Iris-in / fade-out
    if (s.t < 0.5) {
        kctx.fillStyle = `rgba(0, 0, 0, ${1 - s.t / 0.5})`;
        kctx.fillRect(0, 0, w, h);
    }
    const foStart = s.attackDur;
    if (s.t > foStart) {
        kctx.fillStyle = `rgba(0, 0, 0, ${clamp01((s.t - foStart) / KILLCAM_FADEOUT)})`;
        kctx.fillRect(0, 0, w, h);
    }
}

// Front frame in the faceplate: closed lurks/approaches, open surges on the strike.
// Sized to the glass by the creature's OPAQUE content box (transparent padding
// ignored), so it fills the window without spilling onto the mask frame.
function drawKillScreenCreature(kctx, F, s) {
    if (s.mode === 'poison') { drawPufferBody(kctx, F, s); return; }   // POISONED uses its own body path
    const frames = KILLSCREEN_FRAMES[s.creature];
    if (!frames) return;
    const beh = s.behavior || {};

    // Frame select. Gnaw chews: after the strike it snaps between open and closed.
    let which;
    if (!s.struck) {
        which = frames.closed ? 'closed' : 'open';
    } else if (s.mode === 'gnaw') {
        const bite = Math.sin((s.t - s.struckAt) * Math.PI * 2 * (beh.gnawHz || 5.5));
        which = (bite < -0.1 && frames.closed) ? 'closed' : (frames.open || 'closed');
    } else {
        which = frames.open ? 'open' : 'closed';
    }
    const img = frames[which];
    if (!img || !img.complete || !img.naturalWidth) return;

    // Opaque content box (fractions) — fall back to the full canvas if not measured.
    const bb = (KILLSCREEN_BBOX[s.creature] && KILLSCREEN_BBOX[s.creature][which])
        || { cx: 0.5, cy: 0.5, w: 1, h: 1 };
    const contentW = img.naturalWidth * bb.w;
    const contentH = img.naturalHeight * bb.h;

    const inset = (KILL_SCREEN.creatureInset != null) ? KILL_SCREEN.creatureInset : 0.9;
    // Per-creature lunge intensity overrides the global default.
    const strikeFill = (beh.strikeFill != null) ? beh.strikeFill
        : (KILL_SCREEN.creatureStrikeFill != null ? KILL_SCREEN.creatureStrikeFill : 1.15);
    const fitMode = KILL_SCREEN.faceplateFit || 'contain';
    // contain → whole creature fits in the glass; cover → creature fills it (clipped).
    const baseFit = (fitMode === 'cover')
        ? Math.max(F.w / contentW, F.h / contentH)
        : Math.min(F.w / contentW, F.h / contentH);

    let growth, alpha;
    if (!s.struck) {
        // Approach: swims up from far → nearly filling the window, still mostly visible.
        const p = clamp01((s.t - 0.5) / (s.T_STRIKE - 0.5));
        const eased = p * p * (3 - 2 * p);          // smoothstep
        growth = 0.55 + eased * 0.45;               // 0.55 → 1.0 of the inset fit
        alpha = 0.55 + p * 0.4;
    } else {
        // Lunge: surges past the window so the body outside the glass is clipped away.
        const ps = clamp01((s.t - s.struckAt) / 0.4);
        const eased = 1 - (1 - ps) * (1 - ps);      // ease-out
        growth = 1 + eased * (strikeFill - 1);      // 1.0 → strikeFill (overflows & clips)
        // Devour: keep pushing in after the lunge — dragged down the throat.
        if (s.mode === 'devour' && beh.devourPush) {
            growth += Math.max(0, s.t - s.struckAt - 0.4) * beh.devourPush;
        }
        // Gnaw: small in/out chew pulse so the bite has weight.
        if (s.mode === 'gnaw') {
            growth *= 1 + 0.05 * Math.sin((s.t - s.struckAt) * Math.PI * 2 * (beh.gnawHz || 5.5));
        }
        alpha = 1;
    }
    const scale = baseFit * inset * growth;
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    // Gnaw jitters side to side as it worries the glass; others wobble only on approach.
    const wob = (s.mode === 'gnaw' && s.struck)
        ? Math.sin(s.t * 33) * F.w * 0.015
        : (s.struck ? 0 : Math.sin(s.t * 2.4) * F.w * 0.02);

    // Anchor the opaque content centre on the glass centre.
    kctx.save();
    kctx.globalAlpha = alpha;
    kctx.imageSmoothingEnabled = true;
    kctx.drawImage(img, F.cx - bb.cx * dw + wob, F.cy - bb.cy * dh, dw, dh);
    kctx.restore();
}

// Pufferfish POISONED body (§0.9, beats 1–2): drifts in deflated (the chuckle, bumps the glass —
// nothing happens), then inflates past cute (the puff-goes-wrong); after the strike it hangs there
// slowly deflating, smug. Uses the TOC swim sprites as a stand-in until a head-on puffer is authored.
function drawPufferBody(kctx, F, s) {
    const p = clamp01((s.t - 0.4) / (s.T_STRIKE - 0.4));   // approach progress 0→1
    const puffing = p > 0.55 || s.struck;                  // Beat 2 onset
    const which = puffing ? 'inflated' : 'deflated';
    const img = KILLSCREEN_PUFFER[which];
    if (!img || !img.complete || !img.naturalWidth) return;
    // Fit by the OPAQUE content box so transparent padding doesn't shrink/offset the puffer.
    const bb = KILLSCREEN_PUFFER_BBOX[which] || { cx: 0.5, cy: 0.5, w: 1, h: 1 };
    const contentW = img.naturalWidth * bb.w, contentH = img.naturalHeight * bb.h;

    let fill;
    if (!s.struck) {
        fill = puffing ? (0.5 + (p - 0.55) / 0.45 * 0.5) : (0.32 + p * 0.2);   // 0.32 → ~1.0 of the glass
    } else {
        fill = 0.95 - clamp01((s.t - s.struckAt) / 2.5) * 0.22;                // hangs, slowly deflating
    }
    const base = Math.min(F.w / contentW, F.h / contentH);   // contain the content in the glass
    const scale = base * fill;
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;

    // Idle wobble on approach; a quick bump toward the glass at ~t=1.4 (the chuckle — nothing happens).
    const wob = s.struck ? 0 : Math.sin(s.t * 3) * F.w * 0.02;
    let bump = 0;
    if (!s.struck) { const b = 1 - Math.min(1, Math.abs(s.t - 1.4) / 0.3); bump = b * b * F.h * 0.045; }

    kctx.save();
    kctx.globalAlpha = s.struck ? 1 : (0.6 + p * 0.4);
    kctx.imageSmoothingEnabled = true;
    // Anchor the opaque content centre on the glass centre.
    kctx.drawImage(img, F.cx - bb.cx * dw + wob, F.cy - bb.cy * dh + bump, dw, dh);
    kctx.restore();
}

// POISONED Beat 3 (§0.9): the radial-puncture crack overlay slams onto the faceplate. Screen-blended
// so the art's dark glass field drops out and only the cracks add; stretched to the faceplate rect
// (auto-covers the green fit-zone).
function drawPoisonPuncture(kctx, F, s) {
    const img = KILLSCREEN_PUNCTURE;
    if (!img || !img.complete || !img.naturalWidth) return;
    const slam = clamp01((s.t - s.struckAt) / 0.12);   // hits hard and fast
    kctx.save();
    kctx.globalCompositeOperation = 'screen';
    kctx.globalAlpha = 0.9 * slam;
    kctx.drawImage(img, F.x, F.y, F.w, F.h);
    kctx.restore();
}

// POISONED Beat 4 — the differentiator (§0.9): sight survives but CORRUPTS. Double vision
// (chromatic split on the cracks), color draining to grey-green, tunnel-vision creeping in
// (paralysis onset). No blood flood, no blackout-smash — helpless lucidity. amt = s.tox 0→1.
function drawPoisonCorruption(kctx, F, s) {
    const a = clamp01(s.tox);
    if (a < 0.01) return;
    const t = s.t;
    kctx.save();
    // Color drains out — desaturate the view (where the blend mode is supported) + a sickly tint.
    kctx.globalCompositeOperation = 'saturation';
    kctx.fillStyle = `rgba(128, 128, 128, ${a})`;
    kctx.fillRect(F.x, F.y, F.w, F.h);
    kctx.globalCompositeOperation = 'source-over';
    kctx.fillStyle = `rgba(120, 150, 110, ${a * 0.18})`;
    kctx.fillRect(F.x, F.y, F.w, F.h);
    // Double vision — offset chromatic ghosts of the cracks, swimming as the toxin takes hold.
    if (KILLSCREEN_PUNCTURE.complete && KILLSCREEN_PUNCTURE.naturalWidth) {
        const off = a * F.w * 0.012 * (1 + 0.3 * Math.sin(t * 3));
        kctx.globalCompositeOperation = 'screen';
        kctx.globalAlpha = a * 0.3;
        kctx.drawImage(KILLSCREEN_PUNCTURE, F.x - off, F.y, F.w, F.h);
        kctx.drawImage(KILLSCREEN_PUNCTURE, F.x + off, F.y, F.w, F.h);
        kctx.globalAlpha = 1;
        kctx.globalCompositeOperation = 'source-over';
    }
    // Tunnel-vision: edges creep inward (paralysis), slow — not a smash to black.
    const inner = F.r * (1.15 - a * 0.82);
    const g = kctx.createRadialGradient(F.cx, F.cy, Math.max(1, inner), F.cx, F.cy, F.r * 1.3);
    g.addColorStop(0, 'rgba(3, 7, 5, 0)');
    g.addColorStop(1, `rgba(2, 6, 4, ${a * 0.9})`);
    kctx.fillStyle = g;
    kctx.fillRect(F.x, F.y, F.w, F.h);
    kctx.restore();
}

// A quick glimpse of the attacker crossing a side port as it circles.
function drawKillScreenGlimpse(kctx, w, h, s) {
    const frames = KILLSCREEN_FRAMES[s.creature];
    const img = frames && (frames.closed || frames.open);
    if (!img || !img.complete || !img.naturalWidth) return;
    let port;
    if (KILL_SCREEN.maskMode === 'procedural') {
        port = killScreenMaskGeom(w, h).portL;
    } else {
        const portRegion = killScreenRegionsDetected.SIDE_PORT_MASK_L || KILL_SCREEN.regions.SIDE_PORT_MASK_L;
        port = killScreenRegionRect(portRegion, w, h);
    }
    const a = clamp01(1 - Math.abs(s.t - s.glimpseAt) / 0.45) * 0.7;
    kctx.save();
    _ksRoundRect(kctx, port.x, port.y, port.w, port.h, port.round || port.w * 0.2);
    kctx.clip();
    kctx.globalAlpha = a;
    const fit = Math.max(port.w / img.naturalWidth, port.h / img.naturalHeight) * 1.1;
    const dw = img.naturalWidth * fit, dh = img.naturalHeight * fit;
    kctx.drawImage(img, port.x + port.w / 2 - dw / 2, port.y + port.h / 2 - dh / 2, dw, dh);
    kctx.restore();
}

// SHROUDED (§0.9 jelly): translucent oral-arms creeping over the visor from MULTIPLE edge
// points toward centre, smothering it from outside. amt 0→1.
function drawTentacleCreep(kctx, F, amt, t) {
    const a = clamp01(amt);
    kctx.save();
    // Pale jelly film thickening across the glass.
    const film = kctx.createRadialGradient(F.cx, F.cy, F.r * 0.1, F.cx, F.cy, F.r * 1.1);
    film.addColorStop(0, `rgba(175, 230, 225, ${a * 0.12})`);
    film.addColorStop(1, `rgba(120, 200, 205, ${a * 0.32})`);
    kctx.fillStyle = film;
    kctx.fillRect(F.x, F.y, F.w, F.h);
    // Oral-arms reaching in from anchor points around the rim toward centre.
    const arms = 6;
    const aspect = F.h / F.w;
    kctx.lineCap = 'round';
    for (let i = 0; i < arms; i++) {
        const base = (i / arms) * Math.PI * 2 + 0.4;
        const ax = F.cx + Math.cos(base) * F.r * 1.05;
        const ay = F.cy + Math.sin(base) * F.r * 1.05 * aspect;
        const reach = a * (0.7 + 0.3 * Math.sin(t * 1.3 + i));   // creeps inward, undulating
        const tx = F.cx + (ax - F.cx) * (1 - reach);
        const ty = F.cy + (ay - F.cy) * (1 - reach);
        const midx = (ax + tx) / 2 + Math.sin(t * 2 + i) * F.w * 0.03;
        const midy = (ay + ty) / 2 + Math.cos(t * 1.7 + i) * F.h * 0.03;
        kctx.strokeStyle = `rgba(190, 240, 235, ${a * 0.5})`;
        kctx.lineWidth = Math.max(2, F.w * 0.012 * (0.6 + a));
        kctx.beginPath();
        kctx.moveTo(ax, ay);
        kctx.quadraticCurveTo(midx, midy, tx, ty);
        kctx.stroke();
        kctx.fillStyle = `rgba(235, 255, 250, ${a * 0.6})`;   // sting tip
        kctx.beginPath(); kctx.arc(tx, ty, Math.max(1.5, F.w * 0.008), 0, Math.PI * 2); kctx.fill();
    }
    kctx.restore();
}

// BREACHED (§0.9 moray): blood on the PLAYER'S side of the glass — a film and runs on the
// INNER surface, sourced at the central puncture, reading "in here with you" rather than a
// cloud out in the water. amt 0→1.
function drawNearSideBlood(kctx, F, amt, t) {
    const a = clamp01(amt);
    kctx.save();
    // Red film creeping over the inner glass from the puncture at centre.
    const film = kctx.createRadialGradient(F.cx, F.cy, F.w * 0.02, F.cx, F.cy, F.w * 0.72);
    film.addColorStop(0, `rgba(140, 4, 8, ${a * 0.62})`);
    film.addColorStop(0.55, `rgba(92, 2, 6, ${a * 0.34})`);
    film.addColorStop(1, 'rgba(60, 0, 4, 0)');
    kctx.fillStyle = film;
    kctx.fillRect(F.x, F.y, F.w, F.h);
    // Drips running DOWN the inner glass from the breach — gravity on the near surface.
    const drips = 7;
    for (let i = 0; i < drips; i++) {
        const seed = (i * 0.61803) % 1;
        const x = F.x + F.w * (0.18 + 0.64 * seed);
        const startY = F.cy + (seed - 0.5) * F.h * 0.22;
        const len = F.h * (0.12 + 0.5 * a) * (0.55 + seed * 0.7);
        const wob = Math.sin(t * 1.4 + i) * F.w * 0.004;
        const wdt = F.w * (0.006 + 0.011 * seed);
        const g = kctx.createLinearGradient(x, startY, x, startY + len);
        g.addColorStop(0, `rgba(172, 10, 14, ${a * 0.85})`);
        g.addColorStop(1, 'rgba(110, 2, 8, 0)');
        kctx.fillStyle = g;
        kctx.beginPath();
        kctx.moveTo(x - wdt, startY);
        kctx.quadraticCurveTo(x + wob, startY + len * 0.5, x, startY + len);
        kctx.quadraticCurveTo(x - wob, startY + len * 0.5, x + wdt, startY);
        kctx.fill();
        kctx.fillStyle = `rgba(150, 6, 10, ${a * 0.7})`;   // bead at the leading edge
        kctx.beginPath(); kctx.arc(x, startY + len, wdt * 1.15, 0, Math.PI * 2); kctx.fill();
    }
    // Wet specular sheen so it reads as on-surface, not suspended in water.
    kctx.globalCompositeOperation = 'screen';
    const sheen = kctx.createRadialGradient(F.cx - F.w * 0.1, F.cy - F.h * 0.12, 0, F.cx, F.cy, F.w * 0.5);
    sheen.addColorStop(0, `rgba(255, 120, 120, ${a * 0.12})`);
    sheen.addColorStop(1, 'rgba(255, 120, 120, 0)');
    kctx.fillStyle = sheen;
    kctx.fillRect(F.x, F.y, F.w, F.h);
    kctx.restore();
}

// Swirls of blood clouding the visor — devour gore out in the water. amt 0→1.
function drawBloodSwirl(kctx, F, amt, t) {
    const a = clamp01(amt);
    kctx.save();
    // Diffuse blood cloud blooming from the bite at the glass centre.
    const cloud = kctx.createRadialGradient(F.cx, F.cy, F.w * 0.02, F.cx, F.cy, F.w * 0.62);
    cloud.addColorStop(0, `rgba(150, 6, 10, ${a * 0.55})`);
    cloud.addColorStop(0.5, `rgba(105, 3, 8, ${a * 0.34})`);
    cloud.addColorStop(1, 'rgba(55, 0, 4, 0)');
    kctx.fillStyle = cloud;
    kctx.fillRect(F.x, F.y, F.w, F.h);
    // Drifting swirl tendrils, rotating opposite ways so it churns.
    const n = 8;
    for (let i = 0; i < n; i++) {
        const dir = (i % 2) ? 1 : -1;
        const ang = (i / n) * Math.PI * 2 + t * 0.7 * dir;
        const rad = F.w * (0.06 + 0.34 * ((i * 0.37 + a * 0.8) % 1));
        const cx = F.cx + Math.cos(ang) * rad;
        const cy = F.cy + Math.sin(ang) * rad * 0.72;
        const r = F.w * 0.06 * (0.5 + a);
        const g = kctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(185, 14, 18, ${a * 0.5})`);
        g.addColorStop(1, 'rgba(120, 0, 8, 0)');
        kctx.fillStyle = g;
        kctx.beginPath(); kctx.arc(cx, cy, r, 0, Math.PI * 2); kctx.fill();
    }
    kctx.restore();
}

// SHROUDED (§0.9 jelly): a pale shroud cinching in from the visor edges — vision smothered
// to WHITE (not a dark tunnel), throbbing, closing into a final whiteout. amt 0→1 closes it.
function drawShroudVignette(kctx, F, amt, t) {
    const a = clamp01(amt);
    const pulse = 0.9 + 0.1 * Math.sin(t * 7);            // throbbing grip
    const inner = F.r * (1.1 - a * 0.92) * pulse;         // aperture closes as a→1
    const outer = F.r * 1.32;
    const g = kctx.createRadialGradient(F.cx, F.cy, Math.max(1, inner), F.cx, F.cy, outer);
    g.addColorStop(0, 'rgba(230, 245, 255, 0)');
    g.addColorStop(0.55, `rgba(225, 240, 255, ${a * 0.5})`);
    g.addColorStop(1, `rgba(245, 250, 255, ${Math.min(1, a * 1.05)})`);
    kctx.save();
    kctx.fillStyle = g;
    kctx.fillRect(F.x, F.y, F.w, F.h);
    kctx.restore();
}

// ============================================
// TETHER PHYSICS (Sonar Tether)
// ============================================

function updateUIPhysics() {
    const svgLayer = document.getElementById('tether-layer');
    if (!svgLayer) return;
    svgLayer.innerHTML = '';

    const time = Date.now() / TETHER.energyFlowSpeed;
    const creatures = state.creatures;
    if (!creatures.length) return;

    const nowSec = Date.now() / 1000;
    creatures.forEach(creature => {
        const box = creature.challengeBox;
        if (!box) return;
        // First time we see a box, give it its own soft, under-damped spring +
        // idle sway — the same fluid float the unit tag rides on, but with its
        // own stiffness and phase so it drifts a little differently and never
        // mirrors the unit tag (or a neighbour) in lockstep.
        if (box.springK === undefined) {
            box.springK    = 0.16 + Math.random() * 0.06;   // softer than a rigid tether → laggy float
            box.floatDrag  = 0.86 + Math.random() * 0.05;   // under-damped (like the unit tag), with variance
            box.swayPhaseX = Math.random() * Math.PI * 2;
            box.swayPhaseY = Math.random() * Math.PI * 2;
            box.swayRateX  = 0.5 + Math.random() * 0.5;
            box.swayRateY  = 0.4 + Math.random() * 0.45;
            box.swayAmpX   = 6 + Math.random() * 6;          // gentle idle drift (virtual px)
            box.swayAmpY   = 3 + Math.random() * 4;
        }
        // Idle sway orbits the rest position around the creature so the box
        // floats on its own rhythm instead of sitting stapled beneath it.
        const targetX = creature.x + Math.sin(nowSec * box.swayRateX + box.swayPhaseX) * box.swayAmpX;
        const targetY = creature.y + Math.sin(nowSec * box.swayRateY + box.swayPhaseY) * box.swayAmpY;
        box.vx += (targetX - box.x) * box.springK;
        box.vy += (targetY - box.y) * box.springK;
    });

    // Box-to-box repulsion — prevent any overlap of full vertical stacks
    const pad = 30;  // generous margin between overlays
    const repulse = TETHER.repulsionForce * 2.5;  // stronger push to enforce no-overlap
    for (let i = 0; i < creatures.length; i++) {
        for (let j = i + 1; j < creatures.length; j++) {
            const boxA = creatures[i].challengeBox;
            const boxB = creatures[j].challengeBox;
            if (!boxA || !boxB || !boxA.width || !boxB.width) continue;

            const dx = boxA.x - boxB.x;
            const dy = boxA.y - boxB.y;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);
            const minDx = (boxA.width / 2) + (boxB.width / 2) + pad;
            const minDy = (boxA.height / 2) + (boxB.height / 2) + pad;

            if (absDx < minDx && absDy < minDy) {
                const overlapX = minDx - absDx;
                const overlapY = minDy - absDy;
                // Prefer horizontal separation (push sideways) to keep vertical stacks clear
                if (overlapX < overlapY * 1.5) {
                    const dir = dx > 0 ? 1 : -1;
                    boxA.vx += (overlapX * 0.5) * repulse * dir;
                    boxB.vx -= (overlapX * 0.5) * repulse * dir;
                } else {
                    const dir = dy > 0 ? 1 : -1;
                    boxA.vy += (overlapY * 0.5) * repulse * dir;
                    boxB.vy -= (overlapY * 0.5) * repulse * dir;
                }
            }
        }
    }

    // Box-to-creature repulsion
    for (let i = 0; i < creatures.length; i++) {
        const box = creatures[i].challengeBox;
        if (!box || !box.width) continue;
        for (let j = 0; j < creatures.length; j++) {
            const rock = creatures[j];
            if (rock._attacked) continue;   // a fleeing creature isn't an obstacle — it's leaving
            const rockR = rock.radius + 8;
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

    // Apply velocity
    creatures.forEach(creature => {
        const box = creature.challengeBox;
        if (!box) return;
        box.vx *= (box.floatDrag || TETHER.friction);
        box.vy *= (box.floatDrag || TETHER.friction);
        box.x += box.vx;
        box.y += box.vy;
        // Only clamp to screen bounds once the creature itself is on-screen
        const creatureOnScreen = creature.x > 0 && creature.x < COORD_SYSTEM.width;
        if (creatureOnScreen) {
            if (box.x < 10) box.x = 10;
            if (box.x > COORD_SYSTEM.width - 10) box.x = COORD_SYSTEM.width - 10;
        }
        if (box.y < 10) box.y = 10;

        const targetX = creature.x;
        const stretchDist = Math.sqrt(
            Math.pow(targetX - box.x, 2) +
            Math.pow((creature.y - creature.radius) - box.y, 2)
        );

        // TOC units never show the stretch tether — when two of their challenge
        // boxes are pushed apart (repulsion / clearance peel-away) the dashed line
        // would otherwise snap on. Their box just floats free off the fish.
        if (stretchDist > TETHER.tetherVisibleDistance && !creature.isToc) {
            const ct = creature.creatureType;
            const colors = ct.color;

            const gradientId = `tether-grad-${creature.id}`;
            const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
            const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
            gradient.setAttribute("id", gradientId);
            gradient.setAttribute("x1", "0%"); gradient.setAttribute("y1", "0%");
            gradient.setAttribute("x2", "100%"); gradient.setAttribute("y2", "100%");

            const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
            stop1.setAttribute("offset", "0%");
            stop1.setAttribute("stop-color", colors.glow);
            stop1.setAttribute("stop-opacity", "0.7");

            const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
            stop2.setAttribute("offset", "100%");
            stop2.setAttribute("stop-color", colors.accent);
            stop2.setAttribute("stop-opacity", "0.4");

            gradient.appendChild(stop1);
            gradient.appendChild(stop2);
            defs.appendChild(gradient);
            svgLayer.appendChild(defs);

            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", targetX);
            line.setAttribute("y1", creature.y - creature.radius);
            line.setAttribute("x2", box.x);
            line.setAttribute("y2", box.y + box.height / 2);
            line.setAttribute("stroke", `url(#${gradientId})`);
            line.setAttribute("stroke-width", "2");
            line.setAttribute("stroke-dasharray", "6, 5");
            line.setAttribute("stroke-dashoffset", time % 11);
            line.setAttribute("filter", `drop-shadow(0 0 3px ${colors.glow})`);
            line.classList.add('tether-line');
            svgLayer.appendChild(line);
        }
    });
}

// ============================================
// GRID FLASH — rapid strobe for holodeck signals
// ============================================

function flashGrid(count, cssClass) {
    const grid = document.getElementById('holodeck-grid');
    if (!grid) return;
    let i = 0;
    const flashOn = 250;
    const flashOff = 150;
    function step() {
        if (i >= count) return;
        grid.style.transition = 'none';
        grid.classList.remove('grid-flash', 'grid-watermark');
        grid.classList.add(cssClass);
        grid.offsetHeight;
        setTimeout(() => {
            grid.classList.remove(cssClass);
            grid.offsetHeight;
            i++;
            if (i < count) setTimeout(step, flashOff);
        }, flashOn);
    }
    step();
}

// ============================================
// HOLODECK
// ============================================

function triggerHolodeck(isBeta = false) {
    CONFIG.isHolodeck = true;
    CONFIG.isBeta = isBeta;
    AudioManager.setMode('holodeck');

    const grid = document.getElementById('holodeck-grid');
    const status = document.getElementById('simulation-status');

    if (grid) {
        grid.style.transition = 'none';
        grid.classList.remove('grid-watermark');
        grid.classList.add('grid-flash');
        grid.offsetHeight;
        setTimeout(() => {
            grid.style.transition = 'opacity 5s cubic-bezier(0.4, 0, 0.2, 1), filter 4s ease-out, background-image 5s ease-out';
            grid.classList.remove('grid-flash');
            grid.classList.add('grid-watermark');
        }, 3000);
    }

    if (status) {
        status.textContent = "MODE: SIMULATION";
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
    const titlePrompt = document.getElementById('title-press-prompt');
    if (titlePrompt) titlePrompt.classList.add('hidden');

    document.getElementById('normal-menu-buttons').classList.add('hidden');
    DOM.startOverlay.classList.remove('main-menu-bg');
    DOM.startOverlay.classList.add('holodeck-menu-active');

    state._holodeckMenuShownAt = Date.now();

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
    const colToggles = document.getElementById('gm-col-toggles');
    const colChallenges = document.getElementById('gm-col-challenges');
    const colData = document.getElementById('gm-col-data');
    if (colToggles) colToggles.innerHTML = '';
    if (colChallenges) colChallenges.innerHTML = '';
    if (colData) colData.innerHTML = '';
}

function buildGodModeMenu() {
    const menu = document.getElementById('god-mode-menu');
    if (!menu) return;

    const colToggles = document.getElementById('gm-col-toggles');
    const colChallenges = document.getElementById('gm-col-challenges');
    const colData = document.getElementById('gm-col-data');
    if (!colToggles || !colChallenges || !colData) return;
    colToggles.innerHTML = '';
    colChallenges.innerHTML = '';
    colData.innerHTML = '';

    // Default the active-command set to the spawnable (non-terminal) lifecycle stages,
    // derived from LIFECYCLE_STAGES so it can't drift from the CSV. (The old hard-coded
    // list carried AVA — terminal/chain-only — and CAV, which isn't a lifecycle stage at
    // all; both were silently dropped by the spawn filter, i.e. inert phantom entries.)
    const spawnableCmds = Object.keys(LIFECYCLE_STAGES || {})
        .filter(id => { const st = LIFECYCLE_STAGES[id]; return st && st.stageType !== 'terminal'; });
    if (!godMode.activeCommands) {
        godMode.activeCommands = new Set(spawnableCmds.length ? spawnableCmds : ['NTF', 'ENR', 'ARR', 'PTC', 'DPT', 'ARD', 'TOC']);
    }
    if (!godMode.activeUnits) godMode.activeUnits = new Set(DATA_UNITS_SAMPLE.map(u => u.id));
    const ALL_ZONE_IDS = ['gas', 'liquid', 'electrical', 'aquanaut'];
    if (!godMode.targetableZones) godMode.targetableZones = new Set(ALL_ZONE_IDS);

    // ═══════════════════════════════════════
    // COLUMN 1: Simulation Controls
    // ═══════════════════════════════════════

    const toggles = [
        { key: 'clickToDestroy', label: 'TARGETED SONAR FIRE', hint: 'Left Click on Creature' },
        { key: 'godModeKill', label: 'BELL BREACH OVERRIDE', hint: 'Left Click on Creature' },
        { key: 'destroyZones', label: 'DESTROY HOSE', hint: 'Double Left Click on Hose' },
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

    // ── Rank / Depth Override Selector ──
    const tierRow = document.createElement('div');
    tierRow.className = 'gm-row';
    const tierText = document.createElement('div');
    tierText.className = 'gm-text';
    const tierLabel = document.createElement('div');
    tierLabel.className = 'gm-label';
    tierLabel.textContent = 'RANK / DEPTH OVERRIDE';
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
        const depthLabel = data.depthMin !== undefined ? ` (${data.depthMin}–${data.depthMax}m)` : '';
        opt.textContent = data.label + depthLabel;
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

    // ═══════════════════════════════════════
    // COLUMN 2: Target & Challenge Filters
    // ═══════════════════════════════════════

    // ── Target Spawn Filter (creature types) ──
    const creatureHeader = document.createElement('div');
    creatureHeader.className = 'gm-row gm-section-header';
    const creatureHeaderText = document.createElement('div');
    creatureHeaderText.className = 'gm-text';
    const creatureHeaderLabel = document.createElement('div');
    creatureHeaderLabel.className = 'gm-label';
    creatureHeaderLabel.textContent = 'TARGET SPAWN FILTER';
    creatureHeaderText.appendChild(creatureHeaderLabel);
    const creatureHeaderHint = document.createElement('div');
    creatureHeaderHint.className = 'gm-hint';
    creatureHeaderHint.textContent = 'Which creature types can spawn';
    creatureHeaderText.appendChild(creatureHeaderHint);
    creatureHeader.appendChild(creatureHeaderText);
    colChallenges.appendChild(creatureHeader);

    if (!godMode.activeCreatureTypes) {
        godMode.activeCreatureTypes = new Set(Object.keys(CREATURE_TYPES));
    }

    Object.entries(CREATURE_TYPES).forEach(([key, ct]) => {
        const row = document.createElement('div');
        row.className = 'gm-row';
        const textCol = document.createElement('div');
        textCol.className = 'gm-text';
        const label = document.createElement('div');
        label.className = 'gm-label';
        label.textContent = ct.name.toUpperCase();
        textCol.appendChild(label);
        const hint = document.createElement('div');
        hint.className = 'gm-hint';
        hint.textContent = `${ct.archetype} · ${ct.speedMult}x · wt ${ct.spawnWeight}`;
        textCol.appendChild(hint);
        row.appendChild(textCol);

        const isOn = godMode.activeCreatureTypes.has(key);
        const btn = document.createElement('button');
        btn.className = 'gm-toggle' + (isOn ? ' gm-on' : ' gm-off');
        btn.textContent = isOn ? 'ON' : 'OFF';
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (godMode.activeCreatureTypes.has(key)) {
                if (godMode.activeCreatureTypes.size > 1) {
                    godMode.activeCreatureTypes.delete(key);
                }
            } else {
                godMode.activeCreatureTypes.add(key);
            }
            const on = godMode.activeCreatureTypes.has(key);
            btn.textContent = on ? 'ON' : 'OFF';
            btn.className = 'gm-toggle' + (on ? ' gm-on' : ' gm-off');
        });
        row.appendChild(btn);
        colChallenges.appendChild(row);
    });

    // ── Challenge Command Filter (column 3) ──
    const cmdHeader = document.createElement('div');
    cmdHeader.className = 'gm-row gm-section-header';
    const cmdHeaderText = document.createElement('div');
    cmdHeaderText.className = 'gm-text';
    const cmdHeaderLabel = document.createElement('div');
    cmdHeaderLabel.className = 'gm-label';
    cmdHeaderLabel.textContent = 'CHALLENGE FILTER';
    cmdHeaderText.appendChild(cmdHeaderLabel);
    const cmdHeaderHint = document.createElement('div');
    cmdHeaderHint.className = 'gm-hint';
    cmdHeaderHint.textContent = 'Which commands appear in challenges';
    cmdHeaderText.appendChild(cmdHeaderHint);
    cmdHeader.appendChild(cmdHeaderText);
    colData.appendChild(cmdHeader);

    // Build the command list from the call-lifecycle stages (single-stage model —
    // one record per stage). AVA is the TOC follow-up and never spawns standalone,
    // so terminal stages are excluded.
    const cmdLabels = {};
    Object.keys(LIFECYCLE_STAGES).forEach(id => {
        const st = LIFECYCLE_STAGES[id];
        if (!st || st.stageType === 'terminal') return;   // drop AVA (chain-only)
        cmdLabels[id] = st.stageName || id;               // stage name as the label
    });
    // CAD call lifecycle order (not alphabetical)
    const CMD_ORDER = ['NTF','ENR','ARR','PTC','DPT','ARD','TOC'];
    const sortedCmds = CMD_ORDER.filter(c => cmdLabels[c])
        .concat(Object.keys(cmdLabels).filter(c => !CMD_ORDER.includes(c)).sort());

    sortedCmds.forEach(cmd => {
        const row = document.createElement('div');
        row.className = 'gm-row';
        const textCol = document.createElement('div');
        textCol.className = 'gm-text';
        const label = document.createElement('div');
        label.className = 'gm-label';
        label.textContent = cmd;
        textCol.appendChild(label);
        const hint = document.createElement('div');
        hint.className = 'gm-hint';
        hint.textContent = cmdLabels[cmd];
        textCol.appendChild(hint);
        row.appendChild(textCol);

        const isOn = godMode.activeCommands.has(cmd);
        const btn = document.createElement('button');
        btn.className = 'gm-toggle' + (isOn ? ' gm-on' : ' gm-off');
        btn.textContent = isOn ? 'ON' : 'OFF';
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (godMode.activeCommands.has(cmd)) {
                if (godMode.activeCommands.size > 1) {
                    godMode.activeCommands.delete(cmd);
                }
            } else {
                godMode.activeCommands.add(cmd);
            }
            const on = godMode.activeCommands.has(cmd);
            btn.textContent = on ? 'ON' : 'OFF';
            btn.className = 'gm-toggle' + (on ? ' gm-on' : ' gm-off');
        });
        row.appendChild(btn);
        colData.appendChild(row);
    });

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
// HELMET INTERIOR SHELL controller (theme layer)
// Constructed overlay, armed at key moments only; vignette + fog scale with
// depthRatio. Lazy-inits its DOM refs on first use. See HELMET in config.js.
// ============================================
const Helmet = {
    el: null, vig: null, fog: null, armed: false, armUntil: 0, intensity: 0, _init: false,
    init() {
        this.el = document.getElementById('helmet-overlay');
        this.fog = document.getElementById('helmet-fog');
        this.vig = document.getElementById('helmet-vignette');
        this._init = true;
    },
    arm(reason, ms) {
        if (!this._init) this.init();
        if (!this.el) return;
        const dur = ms || (typeof HELMET !== 'undefined' ? HELMET.defaultMs : 2600);
        this.armed = true;
        this.armUntil = Date.now() + dur;
        this.el.classList.remove('hidden');
    },
    // Hard reset — for when the game loop stops (new dive, kill cam, abyss death)
    reset() {
        if (!this._init) this.init();
        this.armed = false; this.intensity = 0; this.armUntil = 0;
        if (this.el) { this.el.style.setProperty('--helmet-op', '0'); this.el.classList.add('hidden'); }
    },
    update() {
        if (!this._init) this.init();
        if (!this.el) return;
        if (this.armed && Date.now() > this.armUntil) this.armed = false;
        const cfg = (typeof HELMET !== 'undefined') ? HELMET
            : { fadeSpeed: 0.12, vigBase: 0.3, vigDepth: 0.4, fogBase: 0.05, fogDepth: 0.28 };
        const target = this.armed ? 1 : 0;
        this.intensity += (target - this.intensity) * cfg.fadeSpeed;
        if (this.intensity < 0.012 && !this.armed) {
            this.intensity = 0;
            this.el.style.setProperty('--helmet-op', '0');
            this.el.classList.add('hidden');
            return;
        }
        this.el.classList.remove('hidden');
        const dr = (typeof getDepthRatio === 'function') ? getDepthRatio() : 0;
        this.el.style.setProperty('--helmet-op', this.intensity.toFixed(3));
        this.el.style.setProperty('--helmet-vig', (cfg.vigBase + dr * cfg.vigDepth).toFixed(3));
        this.el.style.setProperty('--helmet-fog', ((cfg.fogBase + dr * cfg.fogDepth) * this.intensity).toFixed(3));
    }
};

// ============================================
// GAME LOOP
// ============================================

let lastTime = 0;

function gameLoop(ts) {
    const dt = Math.min((ts - lastTime) / 1000, 0.05); // Cap dt to prevent spiral
    lastTime = ts;
    try {
        update(dt);
    } catch (e) {
        console.error('[GAME LOOP] update() crashed:', e);
    }
    try {
        render();
    } catch (e) {
        console.error('[GAME LOOP] render() crashed:', e);
    }
    if (state.running) requestAnimationFrame(gameLoop);
}

function update(dt) {
    if (!state.running) return;

    // Kill cam takes priority
    if (state.killCamActive) {
        updateKillCam(dt);
        return;
    }

    try {
        updateGameSonarSweep(dt);
        if (state.rov) updateROV(dt);
        maintainCreatures(dt);
        maintainComCall(dt);   // COM radio-call bonus (diving bell)
        // updateMiniSub(dt);  // Mini-sub disabled — salvage feature not yet themed
        updateLatchedCreatures(dt);
        if (state.isGrappling) updateGrappleSonarPosition();
        updateDescent(dt);
        Helmet.update();
        updateMarineSnow(dt);
        updateAmbientFish(dt);
    } catch (e) {
        console.error('Update helper failed:', e);
    }

    // Update creature positions
    for (let i = state.creatures.length - 1; i >= 0; i--) {
        try {
            const c = state.creatures[i];
            if (!c || !c.target) {
                removeCreatureAt(i);
                continue;
            }

            if (c.latched) continue; // Latched creatures don't move

            // Apply movement archetype
            updateCreatureMovement(c, dt);
            c.animPhase += dt * 2;

            // Unit tag spring — the ID rides on the fish but isn't stapled
            // to it: a soft spring lets it fall toward the tail when the
            // creature darts, then float back into place.
            if (c._sweepDetected || spriteVisibleBeforeSweep()) {
                if (!c._tag) c._tag = { x: c.x, y: c.y, vx: 0, vy: 0 };
                // Tag rests right on the body (sprite center); the spring below
                // still lets it drift toward the tail on darts, then float back.
                const tagTargetY = c.y;
                const TAG_K = 30;       // spring stiffness
                const TAG_DRAG = 5.5;   // under-damped — a little bounce on settle
                c._tag.vx += (c.x - c._tag.x) * TAG_K * dt;
                c._tag.vy += (tagTargetY - c._tag.y) * TAG_K * dt;
                const tagDrag = Math.max(0, 1 - TAG_DRAG * dt);
                c._tag.vx *= tagDrag;
                c._tag.vy *= tagDrag;
                c._tag.x += c._tag.vx * dt;
                c._tag.y += c._tag.vy * dt;
            }

            // Baby creature growth
            if (c.growTimer !== undefined && c.growTimer < 1) {
                c.growTimer = Math.min(1, c.growTimer + dt * 0.8); // Grows to full size in ~1.25 seconds
            }

            // Impact check — distance-based for side-spawning creatures
            const distToTarget = Math.sqrt(
                Math.pow(c.x - c.target.x, 2) +
                Math.pow(c.y - c.target.y, 2)
            );
            const impactDist = c.radius + (c.target.w || 20);
            // TOC units roam the bottom zone harmlessly UNTIL they go live (Blue/offloaded):
            // a live TOC unit charges the diver and, on contact, opens the suit-latch
            // survival window (its POISONED attack — §0.9). Non-live TOC units still pass
            // through without damage (they're cleared only by being typed).
            const tocCanAttack = c.isToc && c.tocIsLive;
            if ((!c.isToc || tocCanAttack) && !c._attacked && distToTarget <= impactDist) {
                // Creature reached target
                if (c.target.type === 'aquanaut') {
                    // All creatures latch to the aquanaut (suit drain mechanic)
                    damageHose(c.target, c);
                    removeCreatureAt(i);
                } else if (c.creatureType.canLatch && c.target.type === 'hose' && c.target.hp > 0) {
                    // Latch onto hose
                    latchCreature(c, c.target);
                    removeCreatureAt(i);
                } else {
                    // Non-latcher strikes the hose, then peels away: its typing UI
                    // vanishes on the hit and it bolts off-screen (culled there).
                    // No shatter/explosion on the creature — that read as the
                    // creature dying; the hose's own sever FX carry the impact.
                    // But if that strike severed the LAST hose the dive is over —
                    // remove it cleanly rather than leave a frozen creature behind
                    // the abyss cinematic (mirrors the latch-sever path's guard).
                    damageHose(c.target, c);
                    if (getAliveHoses().length > 0 && !state.abyssDeathActive && !state.killCamActive) {
                        beginFlee(c);
                    } else {
                        removeCreatureAt(i);
                    }
                }
            }

            // A TOC unit that spawned off-screen is swimming in — clear the entering flag
            // once it has crossed onto the screen so the off-screen cull applies normally after.
            if (c._tocEntering && c.x >= 0 && c.x <= COORD_SYSTEM.width) c._tocEntering = false;

            // Off-screen cleanup — but a live TOC unit stays until zapped (never culled), and an
            // entering TOC unit is exempt until it has swum on-screen for the first time.
            if ((c.x < -100 || c.x > COORD_SYSTEM.width + 100 || c.y < -100 || c.y > COORD_SYSTEM.height + 100)
                && !(c.isToc && (c.tocIsLive || c._tocEntering))) {
                removeCreatureAt(i);
            }
        } catch (e) {
            console.error('Creature update failed:', e);
            removeCreatureAt(i);
        }
    }

    try {
        resolveCreatureCollisions();
    } catch (e) {
        console.error('Creature collision failed:', e);
    }

    try {
        updateUIPhysics();
    } catch (e) {
        console.error('UI Physics update failed:', e);
    }

    // Update projectiles
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        try {
            const p = state.projectiles[i];
            if (!p) { state.projectiles.splice(i, 1); continue; }

            const target = state.creatures.find(c => c && c.id === p.targetId);

            // Homing
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
                    // Check for chained command — transition instead of destroy
                    if (target.chainNext && !target._chainPhase2) {
                        // Phase 1 cleared — transition to phase 2
                        AudioManager.play('hit');
                        createExplosion(target.x, target.y, '#ffaa00', 15); // smaller, different color
                        const cn = target.chainNext;
                        target.challenge = cn.challenge;
                        target.command = cn.command;
                        target.altCommand = cn.altCommand;
                        if (cn.colorChallenge) target.colorChallenge = cn.colorChallenge;
                        if (cn.colorSonar) target.colorSonar = cn.colorSonar;
                        if (cn.colorUnit) target.colorUnit = cn.colorUnit;             // unit tag → TOC status colour
                        if (cn.colorUnitNext) target.colorUnitNext = cn.colorUnitNext;  // AVA flash on the final zap
                        target._chainPhase2 = true;
                        target.chainNext = null;
                        target._struck = false;   // re-open the target so the phase-2 follow-up command can match
                        // Update the DOM overlay text
                        if (target._sonarTextContent) target._sonarTextContent.textContent = cn.challenge;
                        else if (target._sonarTextEl) target._sonarTextEl.textContent = cn.challenge;
                        showStatus('PHASE 2 — ENTER FOLLOW-UP COMMAND', 'bonus');
                    } else {
                        // Normal destroy (or phase 2 cleared)
                        AudioManager.play('hit');
                        createExplosion(target.x, target.y, '#00ffff', 25);
                        createShatter(target.x, target.y);
                        spawnStatusFlash(target);   // unit flashes to its NEW status colour, then vanishes
                        const targetIdx = state.creatures.findIndex(c => c && c.id === target.id);
                        if (targetIdx >= 0) removeCreatureAt(targetIdx);
                        else state.creatures = state.creatures.filter(c => c && c.id !== target.id);
                    }
                    state.timers.spawnTimer = 0;
                    state.projectiles.splice(i, 1);
                }
            } else if (p.x < -50 || p.x > COORD_SYSTEM.width + 50 || p.y < -50 || p.y > COORD_SYSTEM.height + 50) {
                // Target vanished mid-flight: reap on ANY edge (incl. x / top) so a
                // near-horizontal pulse can't linger forever with no y-bound to catch it.
                state.projectiles.splice(i, 1);
            }
        } catch (e) {
            console.error('Projectile update failed:', e);
            state.projectiles.splice(i, 1);
        }
    }

    // Broken projectiles
    for (let i = state.brokenProjectiles.length - 1; i >= 0; i--) {
        try {
            const b = state.brokenProjectiles[i];
            if (!b) { state.brokenProjectiles.splice(i, 1); continue; }
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
            state.brokenProjectiles.splice(i, 1);
        }
    }

    // Explosions
    for (let i = state.explosions.length - 1; i >= 0; i--) {
        try {
            const e = state.explosions[i];
            if (!e) { state.explosions.splice(i, 1); continue; }
            e.radius += 2;
            e.alpha -= 0.03;
            if (e.alpha <= 0) state.explosions.splice(i, 1);
        } catch (err) {
            state.explosions.splice(i, 1);
        }
    }

    // Unit status flashes (zap → new-status pop)
    if (state.statusFlashes) {
        for (let i = state.statusFlashes.length - 1; i >= 0; i--) {
            const f = state.statusFlashes[i];
            if (!f) { state.statusFlashes.splice(i, 1); continue; }
            f.p += 0.05;
            if (f.p >= 1) state.statusFlashes.splice(i, 1);
        }
    }

    // Environmental particles
    for (let i = state.environmentalParticles.length - 1; i >= 0; i--) {
        const p = state.environmentalParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.radius -= 0.05;
        p.life -= p.decay;
        if (p.life <= 0 || p.radius <= 0) {
            state.environmentalParticles.splice(i, 1);
        }
    }

    // Hose damage particles
    state.hoses.forEach(h => {
        if (h.type !== 'hose' || h.hp >= h.maxHp) return;
        if (h.hp <= 0) {
            // Severed hose particles
            if (Math.random() < 0.1) {
                const pColor = h.hoseType.id === 'gas' ? 'rgba(100, 255, 150, 0.6)'
                             : h.hoseType.id === 'liquid' ? 'rgba(255, 80, 80, 0.6)'
                             : 'rgba(255, 255, 80, 0.6)';
                state.environmentalParticles.push({
                    x: h.x + (Math.random() - 0.5) * 20,
                    y: h.y - Math.random() * 40,
                    vx: (Math.random() - 0.5) * 2,
                    vy: -1 - Math.random() * 2,
                    radius: 2 + Math.random() * 3,
                    color: pColor,
                    life: 1.0, decay: 0.02 + Math.random() * 0.02,
                    type: 'hose-damage'
                });
            }
        }
    });
}

// ============================================
// RENDER
// ============================================

function render() {
    const ctx = DOM.ctx;
    ctx.resetTransform(); // Prevent transform leak if previous render() threw
    ctx.clearRect(0, 0, DOM.canvas.width, DOM.canvas.height);

    ctx.save();
    try {
    ctx.scale(canvasScaleX, canvasScaleY);

    const time = Date.now();

    // ── Descent illusion: far → near layers behind the diver ──
    drawDepthBackground(ctx);   // L0 depth-tinted gradient
    drawColdTint(ctx);          // §5 cold wash that deepens with depth
    drawGodRays(ctx);           // §6 overhead light, shrinks as we sink
    drawCanyonWalls(ctx);       // §4 canyon walls scrolling past in the gutters

    // Marine snow (mid particulate) then the parallax field (far haze + near streaks)
    drawMarineSnow(ctx);
    drawDescentField(ctx);

    // Ambient sea life (background)
    drawAmbientFish(ctx);

    // Visibility cone
    drawVisibilityCone(ctx);

    // Draw hose bundles
    drawHoses(ctx, time);

    // Draw hull integrity aura around aquanaut helmet
    drawHullIntegrity(ctx);

    // Draw aquanaut
    drawAquanaut(ctx, time);

    // Draw latched creatures
    drawLatchedCreatures(ctx, time);

    // Draw creatures
    [...state.creatures].forEach(c => {
        try { drawCreatureWithLabel(ctx, c, time); } catch (e) { console.error('Creature render failed:', e); }
    });

    // COM radio-call diving bell + bubble
    try { drawComCall(ctx, time); } catch (e) { console.error('COM call render failed:', e); }

    // Draw mini-sub
    // drawMiniSub(ctx, time);  // Mini-sub disabled — salvage feature not yet themed

    // Draw ROV
    drawROV(ctx, time);

    // Draw projectiles
    [...state.projectiles].forEach(p => {
        try { drawProjectile(ctx, p); } catch (e) { console.error('Projectile render failed:', e); }
    });

    [...state.brokenProjectiles].forEach(b => {
        try { drawBroken(ctx, b); } catch (e) {} }
    );

    [...state.explosions].forEach(e => {
        try { drawExplosion(ctx, e); } catch (err) {} }
    );

    if (state.statusFlashes) [...state.statusFlashes].forEach(f => {
        try { drawStatusFlash(ctx, f); } catch (err) {} }
    );

    // Environmental particles
    state.environmentalParticles.forEach(p => {
        ctx.fillStyle = p.color.replace(/[\d.]+\)$/g, `${p.life})`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.1, p.radius), 0, Math.PI * 2);
        ctx.fill();
    });

    // Hose failure overlays
    drawSeveredEffects(ctx);

    // §9 — pressure vignette over the whole field, tightening with depth
    drawVignette(ctx);

    } finally {
    ctx.restore();
    }

    // Kill cam (drawn in screen space, not virtual coords)
    if (state.killCamActive) {
        drawKillCam(ctx, DOM.canvas.width, DOM.canvas.height);
    }

    // §10 zone-entry card / thermocline wipe (screen space, over the world)
    if (state.descent && state.descent.transition) {
        drawZoneTransition(ctx, DOM.canvas.width, DOM.canvas.height);
    }
}

// ============================================
// HOSE RENDERING
// ============================================

function drawHoses(ctx, time) {
    const cx = COORD_SYSTEM.width / 2;
    const aq = getAquanaut();
    if (!aq) return;

    const bundleTop = 0;
    const bundleBot = aq.y - 90; // Connect to top of aquanaut sprite
    const segments = 80;
    const spiralRadius = 6;      // Tight wrap — hoses bundled close together
    const spiralFreq = 0.05;     // More turns for tighter coil

    // Draw each hose as a helix strand offset by 120 degrees
    const hoseEntries = state.hoses.filter(h => h.type === 'hose');
    const phaseOffsets = [0, (Math.PI * 2) / 3, (Math.PI * 2 * 2) / 3];

    // Outer bundle sheath (subtle dark outline)
    ctx.save();
    ctx.strokeStyle = 'rgba(40, 60, 80, 0.4)';
    ctx.lineWidth = spiralRadius * 2 + 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, bundleTop);
    ctx.lineTo(cx, bundleBot);
    ctx.stroke();
    ctx.restore();

    // Draw each hose strand as a spiral
    hoseEntries.forEach((h, idx) => {
        const phaseOff = phaseOffsets[idx];
        const severed = h.hp <= 0;
        const hoseColor = h.color; // Always use original color

        if (severed) {
            // --- BROKEN HOSE: original color, break point, wild flailing ends ---
            const breakT = 0.50 + idx * 0.1;
            const breakY = bundleTop + breakT * (bundleBot - bundleTop);

            // Upper portion — intact spiral up to break point (original color, dimmed)
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.strokeStyle = hoseColor;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const y = bundleTop + t * (bundleBot - bundleTop);
                if (y > breakY) break;
                const angle = y * spiralFreq + phaseOff + time * 0.002;
                const x = cx + Math.sin(angle) * spiralRadius;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.restore();

            // Break point position
            const breakAngle = breakY * spiralFreq + phaseOff + time * 0.002;
            const breakX = cx + Math.sin(breakAngle) * spiralRadius;

            // Flailing broken ends — wild whipping in original color
            ctx.save();
            ctx.strokeStyle = hoseColor;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.globalAlpha = 0.7;
            // Multiple flailing strands from the break point
            for (let strand = 0; strand < 4; strand++) {
                const speed = 0.005 + strand * 0.002;
                const amp = 20 + strand * 8;
                const len = 25 + strand * 10;
                const wx = Math.sin(time * speed + idx * 2.5 + strand * 1.7) * amp;
                const wy = Math.cos(time * (speed * 0.7) + strand * 3.1) * (amp * 0.6);
                ctx.beginPath();
                ctx.moveTo(breakX, breakY);
                ctx.quadraticCurveTo(
                    breakX + wx * 0.6, breakY + len * 0.4 + wy * 0.3,
                    breakX + wx, breakY + len + wy
                );
                ctx.stroke();
            }
            // Upward flailing from the surface-side break
            for (let strand = 0; strand < 2; strand++) {
                const speed = 0.006 + strand * 0.003;
                const amp = 15 + strand * 10;
                const wx = Math.sin(time * speed + idx * 1.3 + strand * 2.9) * amp;
                ctx.beginPath();
                ctx.moveTo(breakX, breakY);
                ctx.quadraticCurveTo(breakX + wx * 0.5, breakY - 15, breakX + wx, breakY - 25 - strand * 8);
                ctx.stroke();
            }
            ctx.restore();

            // Lower portion — hanging limp toward aquanaut (dimmer)
            ctx.save();
            ctx.globalAlpha = 0.2;
            ctx.strokeStyle = hoseColor;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            const hangSag = 12 + Math.sin(time * 0.003 + idx) * 6;
            ctx.moveTo(breakX, breakY + 30);
            ctx.quadraticCurveTo(breakX + hangSag, (breakY + bundleBot) / 2, cx, bundleBot);
            ctx.stroke();
            ctx.restore();

            // === SEVERED EFFECTS — persistent particle streams ===
            ctx.save();
            switch (h.hoseType.id) {
                case 'gas': {
                    // O2 BUBBLES — stream of rising bubbles from break point
                    for (let b = 0; b < 5; b++) {
                        const age = ((time * 0.003 + b * 1.3 + idx) % 3.0) / 3.0;
                        const bx = breakX + Math.sin(time * 0.005 + b * 2.1) * (6 + age * 10);
                        const by = breakY - age * 80;
                        const bRadius = 1.5 + age * 3.5;
                        const bAlpha = (1 - age) * 0.55;
                        ctx.strokeStyle = `rgba(100, 255, 150, ${bAlpha})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.arc(bx, by, bRadius, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.fillStyle = `rgba(180, 255, 200, ${bAlpha * 0.4})`;
                        ctx.beginPath();
                        ctx.arc(bx - bRadius * 0.25, by - bRadius * 0.25, bRadius * 0.35, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    for (let b = 0; b < 3; b++) {
                        if (Math.random() < 0.5) {
                            ctx.fillStyle = `rgba(120, 255, 160, ${0.2 + Math.random() * 0.3})`;
                            ctx.beginPath();
                            ctx.arc(breakX + (Math.random() - 0.5) * 20, breakY - Math.random() * 40, 1 + Math.random() * 1.5, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                    break;
                }
                case 'liquid': {
                    // HOT WATER GUSH — stream pouring down from break point
                    const gushWobble = Math.sin(time * 0.007 + idx) * 6;
                    ctx.strokeStyle = 'rgba(255, 140, 60, 0.5)';
                    ctx.lineWidth = 5;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(breakX, breakY);
                    ctx.quadraticCurveTo(breakX + gushWobble, breakY + 35, breakX + gushWobble * 1.5, breakY + 70);
                    ctx.stroke();
                    ctx.strokeStyle = 'rgba(255, 180, 100, 0.4)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(breakX + 1, breakY + 2);
                    ctx.quadraticCurveTo(breakX + gushWobble * 0.8, breakY + 30, breakX + gushWobble * 1.2 + 3, breakY + 65);
                    ctx.stroke();
                    for (let d = 0; d < 6; d++) {
                        const age = ((time * 0.004 + d * 0.9) % 2.0) / 2.0;
                        const dx = breakX + gushWobble * age + (Math.sin(d * 3.7 + time * 0.005) * 15 * age);
                        const dy = breakY + age * 80;
                        ctx.fillStyle = `rgba(255, 150, 80, ${(1 - age) * 0.5})`;
                        ctx.beginPath();
                        ctx.arc(dx, dy, 1.5 + (1 - age) * 2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    for (let s = 0; s < 2; s++) {
                        const sAge = ((time * 0.002 + s * 1.5) % 2.5) / 2.5;
                        ctx.fillStyle = `rgba(255, 200, 150, ${(1 - sAge) * 0.15})`;
                        ctx.beginPath();
                        ctx.arc(breakX + Math.sin(time * 0.003 + s * 4) * 12, breakY - sAge * 30, 3 + sAge * 6, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    break;
                }
                case 'electrical': {
                    // ELECTRICAL SPARKS — arcing lightning from break point
                    if (Math.random() < 0.6) {
                        ctx.strokeStyle = `rgba(255, 255, 100, ${0.6 + Math.random() * 0.4})`;
                        ctx.lineWidth = 1.5;
                        ctx.shadowColor = '#ffff44';
                        ctx.shadowBlur = 10;
                        ctx.beginPath();
                        let sx = breakX, sy = breakY;
                        ctx.moveTo(sx, sy);
                        for (let j = 0; j < 3 + Math.floor(Math.random() * 4); j++) {
                            sx += (Math.random() - 0.5) * 25;
                            sy += (Math.random() - 0.5) * 18;
                            ctx.lineTo(sx, sy);
                        }
                        ctx.stroke();
                        ctx.shadowBlur = 0;
                    }
                    if (Math.random() < 0.4) {
                        ctx.strokeStyle = `rgba(255, 220, 50, ${0.4 + Math.random() * 0.3})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        let sx2 = breakX + (Math.random() - 0.5) * 8;
                        let sy2 = breakY + (Math.random() - 0.5) * 6;
                        ctx.moveTo(sx2, sy2);
                        for (let j = 0; j < 2; j++) {
                            sx2 += (Math.random() - 0.5) * 18;
                            sy2 += (Math.random() - 0.5) * 12;
                            ctx.lineTo(sx2, sy2);
                        }
                        ctx.stroke();
                    }
                    for (let sp = 0; sp < 3; sp++) {
                        const spAge = ((time * 0.006 + sp * 1.1) % 1.0);
                        const spAngle = (time * 0.01 + sp * 2.1) % (Math.PI * 2);
                        const spDist = spAge * 25;
                        ctx.fillStyle = `rgba(255, 255, 150, ${(1 - spAge) * 0.8})`;
                        ctx.beginPath();
                        ctx.arc(breakX + Math.cos(spAngle) * spDist, breakY + Math.sin(spAngle) * spDist, 1 + (1 - spAge) * 1.5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.fillStyle = `rgba(255, 255, 100, ${0.05 + Math.random() * 0.1})`;
                    ctx.beginPath();
                    ctx.arc(breakX, breakY, 15 + Math.random() * 5, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                }
            }
            ctx.restore();

        } else {
            // --- INTACT HOSE: tight spiral in original color ---
            ctx.save();
            ctx.globalAlpha = 0.9;
            ctx.strokeStyle = hoseColor;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.shadowColor = hoseColor;
            ctx.shadowBlur = 6;

            ctx.beginPath();
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const y = bundleTop + t * (bundleBot - bundleTop);
                const angle = y * spiralFreq + phaseOff + time * 0.002;
                const x = cx + Math.sin(angle) * spiralRadius;

                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.restore();
        }
    });
}

// ============================================
// AQUANAUT RENDERING
// ============================================

function drawAquanaut(ctx, time) {
    const aq = getAquanaut();
    if (!aq || aq.destroyed) return;

    // Ship is only visible during the dive entry cutscene, not during gameplay.

    // --- Draw the DIVER at the aquanaut position (below dive bell) ---
    const diverH = 90;
    const diverAspect = aquanautSpriteLoaded && aquanautSprite.naturalHeight
        ? aquanautSprite.naturalWidth / aquanautSprite.naturalHeight
        : 0.5;
    const diverW = diverH * diverAspect;

    ctx.save();
    ctx.translate(aq.x, aq.y);

    // Cosmetic tether sway — the diver rides on a line being slowly paid out, so
    // it bobs and drifts a touch. Purely visual; the logical position is unchanged.
    const bobP = state.descent ? state.descent.phase : 0;
    ctx.translate(Math.sin(bobP * 0.5 + 1.3) * 2.5, Math.sin(bobP * 1.1) * 1.8);

    if (aquanautSpriteLoaded) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
            aquanautSprite,
            -diverW / 2,
            -diverH,      // sprite bottom at diver's y position
            diverW,
            diverH
        );
    } else {
        // Fallback — simple diver silhouette
        ctx.fillStyle = '#c87830';
        ctx.beginPath();
        ctx.ellipse(0, -diverH / 2, 12, diverH / 2, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Suit integrity pips beside the diver (5 levels, colored)
    const suitColors = ['#cc44ff', '#ff8833', '#ffdd33', '#3399ff', '#00ff88']; // 1-5
    for (let i = 0; i < aq.maxHp; i++) {
        const level = aq.maxHp - i; // top pip = highest level
        ctx.fillStyle = level <= aq.hp ? suitColors[level - 1] : '#222';
        ctx.beginPath();
        ctx.arc(-diverW / 2 - 8, -diverH * 0.7 + i * 10, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

// ============================================
// LATCHED CREATURE RENDERING
// ============================================

function drawLatchedCreatures(ctx, time) {
    state.latchedCreatures.forEach(lc => {
        const ct = lc.creatureType;
        const pulse = Math.sin(lc.pulsePhase) * 0.3 + 0.7;

        if (lc.isSuitLatch) {
            // --- Suit latch: creature shudders violently against the diver ---
            const aquanaut = getAquanaut();
            if (!aquanaut) return;

            const shudderX = (Math.random() - 0.5) * 8;
            const shudderY = (Math.random() - 0.5) * 6;
            // The creature latches on the side it attacked from:
            // came from the left → clamps onto the diver's LEFT flank
            const attackSide = lc.fromLeft ? -1 : 1;

            ctx.save();
            ctx.translate(aquanaut.x + attackSide * 30 + shudderX, aquanaut.y - 30 + shudderY);

            // Use the creature's greenscreen sprite if available
            const spriteType = ct.spriteType;
            if (spriteType && CREATURE_SPRITES[spriteType]) {
                if (lc._spriteKey === undefined) {
                    const pool = CREATURE_SPRITES[spriteType];
                    const idx = Math.floor(Math.random() * pool.length);
                    lc._spriteKey = `${spriteType}_${idx}`;
                    lc._spriteIdx = idx;
                }
                const sprite = SPRITE_ASSETS[lc._spriteKey];
                if (sprite && SPRITE_READY[lc._spriteKey]) {
                    const w = ct.spriteSize ? ct.spriteSize.w * 0.6 : 80;
                    const h = ct.spriteSize ? ct.spriteSize.h * 0.6 : 50;
                    // Bite lunge — quick push into the diver with each pulse
                    // (applied in screen space, before any mirror flip)
                    const lunge = Math.max(0, Math.sin(lc.pulsePhase * 3)) * 6;
                    ctx.translate(-attackSide * lunge, 0);
                    // Head bites toward the diver: on the left flank the head
                    // must point right, on the right flank it points left.
                    // Match against the sprite's filename-derived facing.
                    const pool = CREATURE_SPRITES[spriteType];
                    const nativeFacing = (pool[lc._spriteIdx] || pool[0]).facing;
                    const wantRight = attackSide < 0;
                    if ((nativeFacing === 'left') === wantRight) ctx.scale(-1, 1);
                    ctx.globalAlpha = 0.85 + Math.sin(lc.pulsePhase * 3) * 0.15;
                    ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
                }
            } else {
                // Fallback: simple pulsing shape
                ctx.globalAlpha = pulse;
                const accent = ct.color.accent;
                ctx.fillStyle = accent + 'aa';
                ctx.beginPath();
                ctx.ellipse(0, 0, 20, 15, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            // Danger glow around the attack
            ctx.globalAlpha = 0.2 + Math.sin(lc.pulsePhase * 2) * 0.15;
            ctx.fillStyle = '#ff000044';
            ctx.beginPath();
            ctx.arc(0, 0, 35, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        } else {
            // --- Hose latch: the creature CLAMPS onto the hose. Draw its real
            // sprite (the jellyfish bitmap includes its tentacles) so the grip
            // reads as the same animal that bolts away once the hose is severed.
            // Falls back to the old pulsing blob if the art hasn't loaded.
            ctx.save();
            ctx.translate(lc.x, lc.y - 12);

            const spriteType = ct.spriteType;
            let drewSprite = false;
            if (spriteType && CREATURE_SPRITES[spriteType]) {
                // Match the sprite the player saw swimming (stashed on the original
                // creature); fall back to frame 0 — never a fresh random roll.
                if (lc._spriteKey === undefined) {
                    const idx = (lc._origCreature && typeof lc._origCreature._spriteIdx === 'number')
                        ? lc._origCreature._spriteIdx : 0;
                    lc._spriteIdx = idx;
                    lc._spriteKey = `${spriteType}_${idx}`;
                }
                const sprite = SPRITE_ASSETS[lc._spriteKey];
                if (sprite && SPRITE_READY[lc._spriteKey]) {
                    const w = ct.spriteSize ? ct.spriteSize.w * 0.7 : 90;
                    const h = ct.spriteSize ? ct.spriteSize.h * 0.7 : 60;
                    const clench = 1 + Math.max(0, Math.sin(lc.pulsePhase * 2)) * 0.06; // grip on each drain beat
                    ctx.globalAlpha = 0.92 + Math.sin(lc.pulsePhase * 3) * 0.08;
                    ctx.scale(clench, clench);
                    ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
                    drewSprite = true;
                }
            }
            if (!drewSprite) {
                ctx.globalAlpha = pulse;
                ctx.fillStyle = ct.color.accent + '88';
                ctx.beginPath();
                ctx.ellipse(0, 0, 15, 12, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();

            // Clamp ring on the hose — marks the grip point over the sprite and
            // pulses with the drain beat.
            ctx.save();
            ctx.translate(lc.x, lc.y);
            ctx.globalAlpha = 0.5 + Math.sin(lc.pulsePhase * 2) * 0.2;
            ctx.strokeStyle = ct.color.accent;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(0, 0, 18 + Math.sin(lc.pulsePhase * 2) * 3, 14, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // Challenge text for latched creature
        drawLatchedLabel(ctx, lc);
    });
}

function drawLatchedLabel(ctx, lc) {
    const text = lc.challenge;
    ctx.font = "bold 16px 'Courier New'";
    const tw = ctx.measureText(text).width;
    const pad = 8, w = tw + pad * 2, h = 28;
    const x = lc.x - w / 2;
    const y = lc.y - 60;

    ctx.fillStyle = 'rgba(60, 10, 10, 0.9)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#ff6666';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);
}

// ============================================
// MINI-SUB RENDERING
// ============================================

function drawMiniSub(ctx, time) {
    if (!state.miniSub) return;
    const sub = state.miniSub;

    ctx.save();
    ctx.translate(sub.x, sub.y);

    // Sub hull
    ctx.fillStyle = '#334455';
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Conning tower
    ctx.fillStyle = '#445566';
    ctx.fillRect(-5, -15, 10, 8);

    // Propeller
    const propPhase = time * 0.02;
    ctx.strokeStyle = '#667788';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-30, -3 + Math.sin(propPhase) * 3);
    ctx.lineTo(-35, 0);
    ctx.lineTo(-30, 3 + Math.sin(propPhase + Math.PI) * 3);
    ctx.stroke();

    // Running lights
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(-28, 0, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(28, 0, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Challenge text above sub
    ctx.font = "bold 16px 'Courier New'";
    const text = sub.challenge;
    const tw = ctx.measureText(text).width;
    const pad = 8, w = tw + pad * 2, h = 26;
    const x = sub.x - w / 2;
    const y = sub.y - 35;

    ctx.fillStyle = 'rgba(10, 30, 10, 0.85)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#00ff88';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);
}

// ============================================
// ROV RENDERING
// ============================================

function drawROV(ctx, time) {
    if (!state.rov) return;
    const rov = state.rov;

    ctx.save();
    ctx.translate(rov.x, rov.y);

    // ROV hull
    ctx.fillStyle = '#556677';
    ctx.beginPath();
    ctx.roundRect(-20, -12, 40, 24, 5);
    ctx.fill();

    // Camera eye
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(15, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    const ledPulse = Math.sin(time * 0.01) > 0;
    ctx.fillStyle = ledPulse ? '#ff0000' : '#440000';
    ctx.beginPath();
    ctx.arc(15, 0, 2, 0, Math.PI * 2);
    ctx.fill();

    // Propeller wash
    if (rov.phase !== 'repairing') {
        ctx.fillStyle = `rgba(100, 200, 255, ${0.2 + Math.random() * 0.1})`;
        ctx.beginPath();
        ctx.ellipse(-25, 0, 8 + Math.random() * 4, 6, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Manipulator arms
    const armPhase = Math.sin(time * 0.005);
    ctx.strokeStyle = '#889999';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, 12);
    ctx.lineTo(-15, 18 + armPhase * 3);
    ctx.lineTo(-10, 22 + armPhase * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10, 12);
    ctx.lineTo(15, 18 - armPhase * 3);
    ctx.lineTo(10, 22 - armPhase * 2);
    ctx.stroke();

    ctx.restore();

    // Repair beam — targets the aquanaut
    if (state.beamActive && state.rov) {
        const aq = getAquanaut();
        const targetX = aq ? aq.x : COORD_SYSTEM.width / 2;
        const targetY = aq ? aq.y - 20 : COORD_SYSTEM.height - 40;
        const beamStart = rov.y + 12;

        ctx.save();
        const beamGrad = ctx.createLinearGradient(0, beamStart, 0, targetY);
        beamGrad.addColorStop(0, 'rgba(0, 255, 200, 0.3)');
        beamGrad.addColorStop(1, 'rgba(0, 100, 255, 0)');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(rov.x - 5, beamStart);
        ctx.lineTo(rov.x + 5, beamStart);
        ctx.lineTo(targetX + 20, targetY);
        ctx.lineTo(targetX - 20, targetY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

// ============================================
// CREATURE + LABEL RENDERING
// ============================================

function drawCreatureWithLabel(ctx, creature, time) {
    // Draw sonar tether — green line from creature to overlay
    drawSonarTether(ctx, creature);

    // Draw creature body — unobstructed, no overlay
    drawCreatureBody(ctx, creature, time);

    // Unit number tag — rides on the fish (spring-lagged)
    drawUnitTag(ctx, creature);

    // Leading Probe + Challenge box — DOM-based compound element
    drawBubble(ctx, creature);
}

// Relative luminance (0..1) of a #hex colour — used to tell light fills (white status
// boxes) from dark ones so their glow/opacity can be tuned for crisp readability.
function hexLuminance(hex) {
    if (!hex) return 0;
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

// ── Unit tag: the unit number floats ON the creature itself ──
// Position comes from the spring tracker in update(): darts and lunges
// leave it trailing toward the tail before it eases back on top.
// ============================================
// COM RADIO CALL — rendering (diving bell + speech bubble)
// Drawn in virtual coords alongside the creatures.
// ============================================

function comWordIsKeyword(word, keywords) {
    const w = word.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!w) return false;
    return keywords.some(k => { const kk = k.toLowerCase(); return w.includes(kk) || kk.includes(w); });
}

function drawComBellPlaceholder(ctx, cx, cy, sw, sh, time) {
    const halfW = sw / 2;
    const top = cy - sh / 2, bot = cy + sh / 2;
    const rimW = halfW, shoulderW = halfW * 0.78, domeH = sh * 0.34;
    ctx.save();
    ctx.lineJoin = 'round';
    // Bell body (dome + flaring sides + open rim)
    ctx.beginPath();
    ctx.moveTo(cx - shoulderW, top + domeH);
    ctx.quadraticCurveTo(cx - shoulderW, top, cx, top);
    ctx.quadraticCurveTo(cx + shoulderW, top, cx + shoulderW, top + domeH);
    ctx.lineTo(cx + rimW, bot - sh * 0.10);
    ctx.lineTo(cx + rimW, bot);
    ctx.lineTo(cx - rimW, bot);
    ctx.lineTo(cx - rimW, bot - sh * 0.10);
    ctx.closePath();
    const g = ctx.createLinearGradient(cx - halfW, 0, cx + halfW, 0);
    g.addColorStop(0, '#15222b'); g.addColorStop(0.5, '#33454f'); g.addColorStop(1, '#101c25');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#00FF41'; ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(0,255,65,0.5)'; ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Bottom rim band
    ctx.fillStyle = '#0c161c';
    ctx.fillRect(cx - rimW, bot - sh * 0.10, rimW * 2, sh * 0.10);
    ctx.strokeStyle = 'rgba(0,255,65,0.6)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - rimW, bot - sh * 0.10, rimW * 2, sh * 0.10);
    // Porthole with a blinking COM light
    const pr = sw * 0.20, py = cy - sh * 0.04;
    ctx.beginPath(); ctx.arc(cx, py, pr, 0, Math.PI * 2);
    ctx.fillStyle = '#04221a'; ctx.fill();
    const blink = 0.5 + 0.5 * Math.sin(time / 220);
    ctx.strokeStyle = '#00FF41'; ctx.lineWidth = 3;
    ctx.shadowColor = '#00FF41'; ctx.shadowBlur = 6 + blink * 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(cx, py, pr * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(120,255,180,${0.35 + blink * 0.5})`; ctx.fill();
    ctx.restore();
}

function drawComBubble(ctx, cx, anchorY, b) {
    const maxW = COM_CALL.bubbleMaxWidth;
    const bodyFont = "bold 19px 'Courier New', monospace";
    ctx.save();
    // Word-wrap the statement
    ctx.font = bodyFont;
    const spaceW = ctx.measureText(' ').width;
    const words = b.statement.split(/\s+/);
    const lines = [[]];
    let lineW = 0;
    for (const w of words) {
        const ww = ctx.measureText(w).width;
        if (lineW > 0 && lineW + spaceW + ww > maxW - 28) { lines.push([w]); lineW = ww; }
        else { lines[lines.length - 1].push(w); lineW += (lineW > 0 ? spaceW : 0) + ww; }
    }
    const lineH = 24, padX = 16, headH = 44, padBot = 12;
    // Header — just the BIG unit number (the dominant element).
    const unitFont = "bold 32px 'Courier New', monospace";
    const unitText = String(b.unitID);
    ctx.font = unitFont; const unitW = ctx.measureText(unitText).width;
    ctx.font = bodyFont;
    let contentW = unitW;
    for (const ln of lines) contentW = Math.max(contentW, ctx.measureText(ln.join(' ')).width);
    const boxW = Math.min(maxW, Math.max(contentW + padX * 2, 150));
    const boxH = headH + lines.length * lineH + padBot;
    const boxX = cx - boxW / 2;
    const boxY = anchorY - 12 - boxH;
    // Panel
    ctx.beginPath(); ctx.roundRect(boxX, boxY, boxW, boxH, 10);
    ctx.fillStyle = 'rgba(2,12,8,0.9)';
    ctx.strokeStyle = '#00FF41'; ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(0,255,65,0.45)'; ctx.shadowBlur = 10;
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    // Tail pointing down to the bell
    ctx.beginPath();
    ctx.moveTo(cx - 10, boxY + boxH - 1);
    ctx.lineTo(cx, boxY + boxH + 12);
    ctx.lineTo(cx + 10, boxY + boxH - 1);
    ctx.closePath();
    ctx.fillStyle = 'rgba(2,12,8,0.9)'; ctx.fill();
    ctx.strokeStyle = '#00FF41'; ctx.lineWidth = 2; ctx.stroke();
    // Header — big white unit number, centered
    const headBaseY = boxY + 33;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = unitFont; ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,255,65,0.6)'; ctx.shadowBlur = 7;
    ctx.fillText(unitText, cx, headBaseY);
    ctx.shadowBlur = 0;
    // Divider under header
    ctx.strokeStyle = 'rgba(0,255,65,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(boxX + 10, boxY + headH - 6); ctx.lineTo(boxX + boxW - 10, boxY + headH - 6); ctx.stroke();
    // Statement (centered lines; keyword words highlighted)
    ctx.font = bodyFont; ctx.textAlign = 'left';
    let ty = boxY + headH + 16;
    for (const ln of lines) {
        const tw = ctx.measureText(ln.join(' ')).width;
        let tx = cx - tw / 2;
        for (let i = 0; i < ln.length; i++) {
            const word = ln[i];
            const isKw = COM_CALL.highlightKeywords && comWordIsKeyword(word, b.keywords);
            ctx.fillStyle = isKw ? '#ffd23f' : '#cdfbe0';
            if (isKw) { ctx.shadowColor = 'rgba(255,210,63,0.7)'; ctx.shadowBlur = 6; }
            ctx.fillText(word, tx, ty);
            ctx.shadowBlur = 0;
            tx += ctx.measureText(word).width + (i < ln.length - 1 ? spaceW : 0);
        }
        ty += lineH;
    }
    ctx.restore();
}

function drawComCall(ctx, time) {
    const b = state.comCall;
    if (!b) return;
    const bob = Math.sin(b.bobPhase) * COM_CALL.bobAmp;
    const cx = b.x, cy = b.y + bob;
    const sw = COM_CALL.spriteSize.w, sh = COM_CALL.spriteSize.h;
    ctx.save();
    // Lift cable up to the surface winch
    ctx.strokeStyle = 'rgba(150,170,160,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - sh / 2);
    ctx.lineTo(cx + Math.sin(time / 600) * 4, 0);
    ctx.stroke();
    if (comBellReady && comBellImg) {
        ctx.drawImage(comBellImg, cx - sw / 2, cy - sh / 2, sw, sh);
    } else {
        drawComBellPlaceholder(ctx, cx, cy, sw, sh, time);
    }
    // Brief confirm flash on a logged comment
    if (b.flash > 0) {
        ctx.globalAlpha = b.flash;
        ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 4;
        ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(cx, cy, sw * 0.7, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }
    drawComBubble(ctx, cx, cy - sh / 2 - 14, b);
    ctx.restore();
}

function drawUnitTag(ctx, creature) {
    if (creature._attacked || !creature._tag || !creature.unitID) return;
    // Pre-morph the sonar probe blip carries the ID — tag takes over once
    // the sprite is fully revealed
    if ((creature._morphAlpha || 0) < 1) return;
    // The empty unit box (fill + outline) shows as soon as the sprite is present; the
    // unit NUMBER stays blank until the screen sweep arm crosses this target, then fades
    // with the arm's angle (getUnitRevealAlpha). On deeper tiers the creature is a blip
    // until swept, so this frame only ever appears pre-sweep on level 1.

    // Unit tag shows the unit's CURRENT status colour (status_colors[unit_color] —
    // the status the unit is in while you're being asked to advance it), NOT the
    // challenge/priority colour. On a successful zap it flashes to the next status
    // colour (see spawnStatusFlash). Falls back to the challenge colour, then green.
    const uc = creature.colorUnit || creature.colorChallenge;
    const fg = (uc && uc.fg) || '#00FF41';
    const bg = (uc && uc.bg) || '#000000';
    // Every lifecycle status ships a REAL (non-black) unit fill — all blue statuses share one
    // blue fill (#0000FF): NTF/ENR/ARR/PTC/ARD/DPT; TOC plum (#995B87), AVA lime (#2DB704). Those render
    // the badge at FULL opacity with a clean same-colour halo, so the fill stays crisp: no
    // 0.92 haze letting the creature bleed through, and no white/text-colour glow tinging it.
    // Only the black-fill fallback (non-lifecycle spawns with no colorUnit → challenge
    // black/green) keeps the 0.92 coloured-text-glow terminal look that gives it its identity.
    // (The old `> 0.6` "light fill" gate never caught the blue/navy/plum fills — luminance
    // ~0.07–0.47 — so every coloured badge wrongly took the hazy dark path.)
    const solidFill = hexLuminance(bg) > 0.05;
    const glowColor = solidFill ? bg : fg;

    ctx.save();
    ctx.font = "bold 20px 'Courier New', monospace";
    const tw = ctx.measureText(creature.unitID).width;
    const padX = 8, h = 26;
    const w = tw + padX * 2;
    const x = creature._tag.x - w / 2;
    const y = creature._tag.y - h / 2;

    // Box fill + outline stay steady (the "blank box" frame). Coloured (solid) fills are
    // fully opaque so the fill reads crisp; only the black fallback keeps a hair of haze.
    ctx.globalAlpha = solidFill ? 1 : 0.92;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = fg;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = solidFill ? 4 : 7;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ...but the unit NUMBER stays blank until swept, then fades with the sweep arm's
    // angle past this target. Coloured fills show the number at full opacity; only the
    // black fallback keeps the 0.92 haze.
    ctx.globalAlpha = (solidFill ? 1 : 0.92) * (creature._sweepDetected ? getUnitRevealAlpha(creature) : 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tx = creature._tag.x, ty = creature._tag.y + 1;
    // Crisp text: a tight dark halo pins the glyph edges so the solid fill can't bleed
    // into the number. White-on-blue (NTF/ENR) anti-aliasing otherwise blends the thin
    // strokes toward the blue fill and the digits read blue-tinged. Drawn as a dark
    // under-copy + small blur, then the solid fg on top — mirrors the sonar probe's
    // dark-halo ID so the tag reads identically across the probe→tag morph handoff.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 2;
    ctx.fillText(creature.unitID, tx, ty);
    ctx.shadowBlur = 0;
    ctx.fillStyle = fg;
    ctx.fillText(creature.unitID, tx, ty);
    ctx.restore();
}

// ── Unit status flash ──
// On a successful zap the unit tag pops to the NEW status colour (the status the
// unit just moved into — colorUnitNext) and quickly scales up + fades. It's a
// short-lived effect (not tied to the creature, which is removed on the same frame),
// drawn/aged like explosions.
function spawnStatusFlash(creature) {
    const col = creature && creature.colorUnitNext;
    if (!col) return;   // non-lifecycle spawns carry no status colour — nothing to flash
    const tag = creature._tag;
    state.statusFlashes.push({
        x: tag ? tag.x : creature.x,
        y: tag ? tag.y : creature.y,
        text: creature.unitID || '',
        bg: col.bg || '#000000',
        fg: col.fg || '#00FF41',
        p: 0   // 0 → 1 progress
    });
}

function drawStatusFlash(ctx, f) {
    const ease = 1 - Math.pow(1 - f.p, 2);          // ease-out
    const scale = 1 + ease * 0.7;
    const alpha = f.p < 0.15 ? 1 : 1 - (f.p - 0.15) / 0.85;   // hold bright, then fade
    if (alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(f.x, f.y);
    ctx.scale(scale, scale);
    ctx.font = "bold 20px 'Courier New', monospace";
    const tw = ctx.measureText(f.text).width;
    const padX = 8, h = 26;
    const w = tw + padX * 2;

    ctx.fillStyle = f.bg;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = f.fg;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = f.fg;
    ctx.shadowBlur = 10 + (1 - f.p) * 14;           // bright glow that calms as it fades
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = f.fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(f.text, 0, 1);
    ctx.restore();
}

function drawSonarTether(ctx, creature) {
    if (creature.isToc) return;       // no dotted tether on TOC units (Asteroid Command carry-over)
    if (creature._attacked) return;   // fled — no tag to tether to
    const box = creature.challengeBox;
    if (!box || !box.x) return;

    // Use cached tether endpoints (set during drawBubble positioning)
    const probeY = creature._tetherProbeY;
    const chalY = creature._tetherChalY;
    const tetherX = box.x;  // overlay center X in virtual coords

    if (probeY == null && chalY == null) return;

    const now = Date.now() / 1000;
    const pulse = 0.5 + Math.sin(now * 3 + creature.animPhase) * 0.2;
    const cs = creature.colorSonar;
    const tetherColor = (cs && cs.fg) || '#00FF41';

    ctx.save();
    ctx.strokeStyle = tetherColor + Math.round(pulse * 255).toString(16).padStart(2, '0');
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.lineDashOffset = -now * 40;  // animated dash flow

    // Tether from creature to sonar probe (above)
    if (probeY != null) {
        const dx = tetherX - creature.x;
        const dy = probeY - creature.y;
        if (dx * dx + dy * dy > 100) {
            ctx.beginPath();
            ctx.moveTo(creature.x, creature.y);
            ctx.lineTo(tetherX, probeY);
            ctx.stroke();
        }
    }

    // Tether from creature to challenge box (below)
    if (chalY != null) {
        const dx = tetherX - creature.x;
        const dy = chalY - creature.y;
        if (dx * dx + dy * dy > 100) {
            ctx.beginPath();
            ctx.moveTo(creature.x, creature.y);
            ctx.lineTo(tetherX, chalY);
            ctx.stroke();
        }
    }

    ctx.setLineDash([]);
    ctx.restore();
}

// ============================================
// SONAR RING — Submarine radar overlay on creature body
// Modular: wraps unit ID, sits on any creature sprite.
// ============================================

const SONAR = {
    sweepSpeed: 2.2,        // radians per second — arm rotation rate
    pulseSpeed: 3.0,        // border pulse frequency (Hz-ish)
    borderBase: 0.45,       // minimum border alpha
    borderPulse: 0.55,      // pulse amplitude on top of base
    sweepWidth: 0.6,        // angular width (radians) of brightness boost on unit ID chars
    charBrightBase: 0.55,   // base character brightness
    charBrightPeak: 1.0,    // peak brightness when arm passes over character
    armAlpha: 0.7,          // sweep arm opacity
    trailAngle: 0.8,        // radians of fading trail behind arm
    radiusScale: 1.35,      // ring radius = creature.radius * this
    minRadius: 22,          // minimum ring radius in virtual coords
    ringColor: '#00FF41',   // default sonar green (overridden per-creature by colorSonar)
    bgColor: 'rgba(0, 0, 0, 0.75)',
    // Rule of Thirds — background color reveal durations (ms) per tier bracket
    // As sweep passes over each third of the rotation, the bg color is revealed
    // Higher tiers = shorter reveal window
    ruleOfThirds: {
        // bgFadeDuration: how long (ms) the background stays at full color after sweep leaves
        // textBoldDuration: how long (ms) text stays bold after sweep passes
        tier0: { bgFadeDuration: 1200, textBoldDuration: 1800 },  // Tiers 0-1: long reveal
        tier2: { bgFadeDuration: 800,  textBoldDuration: 1200 },  // Tiers 2-3
        tier4: { bgFadeDuration: 400,  textBoldDuration: 600 },   // Tiers 4-5
        tier6: { bgFadeDuration: 200,  textBoldDuration: 300 }    // Tiers 6-7: barely visible
    },
    // Challenge box horizontal sweep speed (pixels per second in screen space)
    challengeSweepSpeed: 120,

    // ── Sonar-to-Creature Morph ──
    // horizontalProgress threshold at which sonar blip transitions to creature sprite.
    // Higher tier = creature stays abstract longer.
    morphThreshold: {
        bubblehopper: 0.45,
        rigwalker: 0.55,
        crushdepthoperator: 0.70,
        theaquanaut: 0.82
    }
};

// ============================================
// SCREEN-WIDE SONAR SWEEP
// One rotating radar arm covers the entire play area.
// Creatures stay invisible until the arm passes over them (sweep detection),
// at which point they morph from sonar contact to visible sprite.
// ============================================

const SCREEN_SWEEP = {
    periodSec: 3.0,        // seconds per full rotation
    morphFadeMs: 350       // sprite fade-in duration after detection
};

// Sweep-reveal config for the current tier (from game_difficulty_progression.csv).
// Falls back to a level-1-ish default so the file:// embedded-data path still works.
const DEFAULT_SWEEP_CFG = {
    periodSec: 6, unitAppear: 0, unitFade: 180, unitClear: 270,
    chalWipeEnd: 180, chalFade: 270, chalClear: 330, chalMode: 'cumulative', chalFrac: 1
};
function getSweepConfig() {
    const t = (typeof TIERS !== 'undefined' && state && state.tier) ? TIERS[state.tier] : null;
    return (t && t.sweep) ? t.sweep : DEFAULT_SWEEP_CFG;
}

// Bearing of a creature from the sweep origin, in degrees CW from 12 o'clock —
// the same convention as state.sweepAngle. (atan2 is CW from 3 o'clock; +90 → 12.)
function getCreatureBearing(creature, origin) {
    const o = origin || getSweepOrigin();
    const dx = creature.x - o.x;
    const dy = creature.y - o.y;
    return ((Math.atan2(dy, dx) * 180 / Math.PI) + 90 + 360) % 360;
}

// How far (degrees, 0–360) the sweep arm has travelled PAST this creature's own
// 12 o'clock — i.e. since it last crossed the creature's bearing. This clock
// position drives the box's appear → fade → clear cycle each rotation.
function getCreatureSweepPhase(creature, origin) {
    const bearing = getCreatureBearing(creature, origin);
    return (((state.sweepAngle || 0) - bearing) % 360 + 360) % 360;
}

// Bearing (deg CW from 12) of an arbitrary screen-coord POINT from the sweep origin.
// Used to gate the unit box and the challenge box independently: each sits at its own
// position, so the rotating arm crosses them at different angles and reveals each on
// its own 12 o'clock — rather than both firing off the creature's single bearing.
function getBearingAt(x, y, origin) {
    const o = origin || getSweepOrigin();
    return ((Math.atan2(y - o.y, x - o.x) * 180 / Math.PI) + 90 + 360) % 360;
}

// Sweep phase (deg the arm has travelled past this point's own 12 o'clock).
function getSweepPhaseAt(x, y, origin) {
    const bearing = getBearingAt(x, y, origin);
    return (((state.sweepAngle || 0) - bearing) % 360 + 360) % 360;
}

// Did the arm sweep from `prev` to `curr` (deg) cross `bearing` this frame? Handles the
// wrap through 0°. Shared by the per-target unit/challenge detection latches.
function sweepCrossed(bearing, prev, curr) {
    if (curr >= prev) return bearing > prev && bearing <= curr;
    return bearing > prev || bearing <= curr; // wrapped through 0°
}

// Opacity of the unit NUMBER from the sweep arm's angle past this target: appears at
// unitAppear (its own 12 o'clock), holds, fades unitFade→unitClear, then dark until
// the arm comes back around. Box fill + outline stay steady — only the number obeys
// this. Shared by the DOM probe (pre-morph) and the on-fish canvas tag (post-morph),
// so both fade identically wherever the unit number is shown.
function revealAlphaFromPhase(phase) {
    const cfg = getSweepConfig();
    if (phase < cfg.unitAppear) return 0;
    if (phase < cfg.unitFade) return 1;
    if (phase < cfg.unitClear) {
        const span = Math.max(1, cfg.unitClear - cfg.unitFade);
        return Math.max(0, 1 - (phase - cfg.unitFade) / span);
    }
    return 0;
}

function getUnitRevealAlpha(creature) {
    return revealAlphaFromPhase(getCreatureSweepPhase(creature));
}

function getSweepOrigin() {
    // Pivot the sweep around the aquanaut's helmet — the operator's POV.
    const aq = (typeof getAquanaut === 'function') ? getAquanaut() : null;
    if (aq) return { x: aq.x, y: aq.y - 75 };
    return { x: COORD_SYSTEM.width / 2, y: COORD_SYSTEM.height * 0.567 };
}

function ensureGameSonarSweep() {
    let el = document.getElementById('game-sonar-sweep');
    if (el) return el;
    const wrapper = document.getElementById('canvas-wrapper');
    if (!wrapper) return null;
    el = document.createElement('div');
    el.id = 'game-sonar-sweep';
    const arm = document.createElement('div');
    arm.className = 'game-sweep-arm';
    el.appendChild(arm);
    wrapper.appendChild(el);
    return el;
}

function cleanupGameSonarSweep() {
    const el = document.getElementById('game-sonar-sweep');
    if (el) el.remove();
}

function updateGameSonarSweep(dt) {
    const sweepEl = ensureGameSonarSweep();
    if (!sweepEl) return;
    if (!state.running) {
        sweepEl.classList.remove('active');
        return;
    }
    sweepEl.classList.add('active');

    // Advance angle (degrees CW from 12 o'clock)
    state._lastSweepAngle = state.sweepAngle || 0;
    const degPerSec = 360 / (getSweepConfig().periodSec || SCREEN_SWEEP.periodSec);
    state.sweepAngle = (state._lastSweepAngle + degPerSec * dt) % 360;

    // Position arm at aquanaut origin (in % of wrapper) and apply rotation.
    const origin = getSweepOrigin();
    const arm = sweepEl.firstElementChild;
    if (arm) {
        arm.style.top = (origin.y / COORD_SYSTEM.height * 100).toFixed(2) + '%';
        arm.style.left = (origin.x / COORD_SYSTEM.width * 100).toFixed(2) + '%';
        arm.style.setProperty('--sweep-angle', state.sweepAngle.toFixed(1) + 'deg');
    }

    // Detect creatures whose bearing the arm just crossed this frame. The unit box (on the
    // fish) and the challenge box (parked off it) latch INDEPENDENTLY off their own bearings,
    // so the arm reveals each as it passes over THAT box — not both off the creature center.
    const prev = state._lastSweepAngle;
    const curr = state.sweepAngle;
    const creatures = state.creatures;
    for (let i = 0; i < creatures.length; i++) {
        const c = creatures[i];
        if (!c) continue;
        // Unit box: latch on the creature's own bearing (the on-fish tag rides there).
        if (!c._sweepDetected
            && c.x >= 0 && c.x <= COORD_SYSTEM.width
            && c.y >= 0 && c.y <= COORD_SYSTEM.height
            && sweepCrossed(getBearingAt(c.x, c.y, origin), prev, curr)) {
            c._sweepDetected = true;
            c._detectionTime = Date.now();
        }
        // Challenge box: latch on its OWN rendered position (cached by drawBubble in
        // _chalAnchor). Until that anchor exists (first frame / off-screen) it can't latch.
        if (!c._chalSweepDetected && c._chalAnchor
            && sweepCrossed(getBearingAt(c._chalAnchor.x, c._chalAnchor.y, origin), prev, curr)) {
            c._chalSweepDetected = true;
        }
    }
}

// ============================================
// CHALLENGE BUBBLE — Rectangular command box (tethered above creature)
// ============================================

// ── Sonar Overlay DOM Management ──
// DOM-based circular challenge display with radar sweep highlight
// Replaces Canvas-drawn rectangular challenge boxes

function ensureSonarOverlay(creature) {
    if (creature._sonarEl) return creature._sonarEl;

    const wrapper = document.getElementById('canvas-wrapper');
    if (!wrapper) return null;

    const el = document.createElement('div');
    el.className = 'sonar-challenge-overlay sonar-spawn-in';

    // Leading Probe — circular sonar bubble with unit ID
    const probe = document.createElement('div');
    probe.className = 'sonar-probe';

    // Background color reveal layer — sits behind everything, clipped to circle
    const bgReveal = document.createElement('div');
    bgReveal.className = 'sonar-bg-reveal';
    probe.appendChild(bgReveal);

    const probeRing = document.createElement('div');
    probeRing.className = 'sonar-probe-ring';
    probe.appendChild(probeRing);

    const sweepEl = document.createElement('div');
    sweepEl.className = 'sonar-sweep-arm';
    probe.appendChild(sweepEl);

    const sweepTrail = document.createElement('div');
    sweepTrail.className = 'sonar-sweep-trail';
    probe.appendChild(sweepTrail);

    const unitIdEl = document.createElement('div');
    unitIdEl.className = 'sonar-unit-id';
    probe.appendChild(unitIdEl);

    // Crosshairs (purely decorative)
    const crosshair = document.createElement('div');
    crosshair.className = 'sonar-crosshair';
    probe.appendChild(crosshair);

    // Center dot
    const centerDot = document.createElement('div');
    centerDot.className = 'sonar-center-dot';
    probe.appendChild(centerDot);

    el.appendChild(probe);

    // Challenge text box — starts off-screen, slides in
    const textEl = document.createElement('div');
    textEl.className = 'sonar-challenge-text';

    // Background color reveal layer — CSV colors pulse through on sweep
    const chalBgReveal = document.createElement('div');
    chalBgReveal.className = 'challenge-bg-reveal';
    textEl.appendChild(chalBgReveal);

    // Horizontal sweep arm inside challenge box
    const chalSweep = document.createElement('div');
    chalSweep.className = 'challenge-sweep-arm';
    textEl.appendChild(chalSweep);

    // Text content span (sits above sweep arm)
    const textContent = document.createElement('span');
    textContent.className = 'sonar-challenge-content';
    textEl.appendChild(textContent);

    el.appendChild(textEl);

    // ── TOC status panel (Current Status label + offload tint + bed icon) ──
    // Single-line text readout: "Awaiting TOC" → "TOC Completed" / "Patient Left…" (the
    // chevron stage ladder was retired; the offload colour is the only axis).
    if (creature.isToc) {
        el.classList.add('toc-unit');   // scopes the larger TOC challenge-box sizing (see style.css)
        const tocPanel = document.createElement('div');
        tocPanel.className = 'toc-status-panel';

        // Blank-box frame (black fill, green trim) — the steady "undetected contact" look
        // that shows BEFORE the screen sweep crosses this TOC unit. The offload-colour fill
        // (tintBox) sits on top and fades in/out with the sweep arm's angle.
        const blankFrame = document.createElement('div');
        blankFrame.className = 'toc-blank-frame';
        tocPanel.appendChild(blankFrame);

        const tintBox = document.createElement('div');
        tintBox.className = 'toc-tint-box';
        tocPanel.appendChild(tintBox);

        const statusLabel = document.createElement('span');
        statusLabel.className = 'toc-status-label';
        tocPanel.appendChild(statusLabel);

        const bedIcon = document.createElement('div');
        bedIcon.className = 'toc-bed-icon';
        bedIcon.setAttribute('title', 'Bed Assignment');
        tocPanel.appendChild(bedIcon);

        el.appendChild(tocPanel);
        creature._tocStatusPanel = tocPanel;
        creature._tocStatusBox = tintBox;
        creature._tocStatusLabel = statusLabel;
        creature._tocBedIcon = bedIcon;
    }

    wrapper.appendChild(el);
    creature._sonarEl = el;
    creature._sonarTextEl = textEl;
    creature._sonarTextContent = textContent;
    creature._sonarProbe = probe;
    creature._sonarBgReveal = bgReveal;
    creature._sonarUnitIdEl = unitIdEl;
    creature._sonarSweepArm = sweepEl;
    creature._sonarSweepTrail = sweepTrail;
    creature._chalSweepArm = chalSweep;
    creature._chalBgReveal = chalBgReveal;
    creature._unitIdChars = []; // Per-character spans for sweep brightness
    creature._lastUnitId = '';  // Track changes
    creature._bgRevealPhase = 0;    // Tracks rule-of-thirds reveal progress
    creature._lastSweepThird = -1;  // Which third was the sweep arm in last frame
    creature._thirdRevealTimes = [0, 0, 0]; // When each third was last swept (timestamp)
    creature._lastChalThird = -1;   // Challenge box horizontal thirds tracking
    creature._chalThirdRevealTimes = [0, 0, 0];
    creature._chalSweepPos = 0;     // Challenge box sweep position (0-1)
    creature._spawnAnimDone = false;

    // Remove spawn animation class after it completes
    setTimeout(() => {
        el.classList.remove('sonar-spawn-in');
        creature._spawnAnimDone = true;
    }, 600);

    return el;
}

function removeSonarOverlay(creature) {
    if (creature._sonarEl) {
        creature._sonarEl.remove();
        creature._sonarEl = null;
        creature._sonarTextEl = null;
        creature._sonarTextContent = null;
        creature._sonarProbe = null;
        creature._sonarBgReveal = null;
        creature._sonarUnitIdEl = null;
        creature._sonarSweepArm = null;
        creature._sonarSweepTrail = null;
        creature._chalSweepArm = null;
        creature._chalBgReveal = null;
        creature._unitIdChars = null;
        creature._lastUnitId = '';
        creature._tocStatusPanel = null;
        creature._tocStatusBox = null;
        creature._tocStatusLabel = null;
        creature._tocBedIcon = null;
    }
}

function cleanupAllSonarOverlays() {
    document.querySelectorAll('.sonar-challenge-overlay').forEach(el => el.remove());
    cleanupGameSonarSweep();
}

// Safely remove a creature and its DOM overlay
function removeCreatureAt(index) {
    const creature = state.creatures[index];
    if (creature) removeSonarOverlay(creature);
    state.creatures.splice(index, 1);
}

// Get rule-of-thirds timing config for current tier
function getSonarThirdsTiming() {
    const tierKeys = Object.keys(TIERS);
    const tierIdx = tierKeys.indexOf(state.tier);
    if (tierIdx <= 0) return SONAR.ruleOfThirds.tier0;
    if (tierIdx <= 1) return SONAR.ruleOfThirds.tier2;
    if (tierIdx <= 2) return SONAR.ruleOfThirds.tier4;
    return SONAR.ruleOfThirds.tier6;
}

function drawBubble(ctx, creature) {
    // The empty box frame (steady fill + outline) shows as soon as the target is a contact;
    // the TEXT — unit number AND challenge — stays blank until the screen sweep arm actually
    // passes over the target (gated by `swept` below). So targets spawn with empty boxes and
    // the tracer writes the text in. Fled (struck a hose): the box vanishes for good.
    if (creature._attacked) {
        if (creature._sonarEl) creature._sonarEl.style.display = 'none';
        return;
    }
    const swept = creature._sweepDetected === true;
    // Ensure DOM overlay exists
    const el = ensureSonarOverlay(creature);
    if (!el) return;
    el.style.display = '';

    const now = Date.now();
    const nowSec = now / 1000;

    // --- Direction: probe trails on the opposite side of travel ---
    const movingRight = creature.fromLeft !== undefined ? creature.fromLeft : (creature.vx > 0);
    el.classList.toggle('leading-right', !movingRight);
    el.classList.toggle('leading-left', movingRight);

    // Voice: cad = CAD readout (NTF/TOC), radio = crew speech bubble (the rest).
    el.classList.toggle('voice-cad', creature.voice === 'cad');
    el.classList.toggle('voice-radio', creature.voice === 'radio');

    // --- Challenge text (unit number is only in the sonar bubble) ---
    let text = creature.challenge;
    if (state.electricalSevered) {
        text = garbleText(text);
    }
    const textContent = creature._sonarTextContent;
    if (textContent && textContent.textContent !== text) {
        textContent.textContent = text;
    }

    // --- Challenge box slide-in from side ---
    // Box slides in from the opposite side of creature travel
    const textEl = creature._sonarTextEl;
    const clearMargin = creature.radius + 10;
    const clearedEdge = creature.fromLeft
        ? creature.x > clearMargin
        : creature.x < COORD_SYSTEM.width - clearMargin;

    if (textEl) {
        // TOC units carry no challenge box — the TOC status panel (Current Status label)
        // is their sole readout, so the static phrase box stays hidden.
        if (creature.isToc) {
            textEl.classList.add('challenge-hidden');
            textEl.classList.remove('challenge-visible');
        } else if (clearedEdge) {
            textEl.classList.add('challenge-visible');
            textEl.classList.remove('challenge-hidden');
        } else {
            textEl.classList.add('challenge-hidden');
            textEl.classList.remove('challenge-visible');
        }
    }

    // --- Unit ID with per-character spans ---
    const unitIdEl = creature._sonarUnitIdEl;
    if (unitIdEl && creature.unitID !== creature._lastUnitId) {
        creature._lastUnitId = creature.unitID;
        unitIdEl.innerHTML = '';
        creature._unitIdChars = [];
        for (let i = 0; i < creature.unitID.length; i++) {
            const span = document.createElement('span');
            span.className = 'sonar-char';
            span.textContent = creature.unitID[i];
            unitIdEl.appendChild(span);
            creature._unitIdChars.push(span);
        }
    }

    // --- Sweep arm angle (continuous rotation synced to creature seed) ---
    const armAngle = (creature.sonarAngle + nowSec * SONAR.sweepSpeed) % (Math.PI * 2);
    const armDeg = (armAngle * 180 / Math.PI);

    if (creature._sonarSweepArm) {
        creature._sonarSweepArm.style.transform = `rotate(${armDeg}deg)`;
    }
    if (creature._sonarSweepTrail) {
        creature._sonarSweepTrail.style.transform = `rotate(${armDeg}deg)`;
    }

    // --- Tier-based ghost opacity for unit ID characters ---
    const tierKeys = Object.keys(TIERS);
    const tierIdx = tierKeys.indexOf(state.tier);
    let ghostAlpha;
    if (tierIdx <= 1) ghostAlpha = 1.0;
    else if (tierIdx <= 3) ghostAlpha = 0.50;
    else if (tierIdx <= 5) ghostAlpha = 0.10;
    else ghostAlpha = 0.0;

    // ═══ UNIT PROBE FILL — steady ═══
    // The probe's background is a steady black fill from the moment it's detected
    // (the "blank box has fill + outline" frame). Only the unit NUMBER cycles with
    // the sweep arm (handled just below); the fill no longer pulses in thirds.
    const bgReveal = creature._sonarBgReveal;
    if (bgReveal) {
        bgReveal.style.background = '#000';
        bgReveal.style.backgroundColor = '#000';
        bgReveal.style.mask = 'none';
        bgReveal.style.webkitMask = 'none';
        bgReveal.style.opacity = '1';
    }

    // ═══ UNIT NUMBER — sweep-arm clock reveal ═══
    // The big sweep arm is a clock. The unit ID appears when the arm crosses this
    // target (phase = unitAppear / its own 12 o'clock), holds, then fades between
    // unitFade and unitClear, and stays dark until the arm comes back around. The
    // box fill + outline are steady; only the NUMBER cycles. Per-level angles live
    // in game_difficulty_progression.csv (Unit Appear/Fade/Clear deg).
    const sweepCfg = getSweepConfig();

    // Morph state (probe → sprite) — consumed by the probe-scale block further down.
    const morphAlpha = creature._morphAlpha !== undefined ? creature._morphAlpha : 1;

    // Unit-number opacity — shared with the on-fish canvas tag (drawUnitTag) so the
    // pre-morph probe ID and post-morph tag ID fade identically. Blank until the sweep
    // arm has crossed this target since it spawned (geometric phase alone isn't enough —
    // a fresh target can sit at a "past 12 o'clock" angle without having been swept yet).
    const unitAlpha = swept ? getUnitRevealAlpha(creature) : 0;

    if (creature._sonarUnitIdEl) {
        creature._sonarUnitIdEl.style.opacity = unitAlpha.toFixed(2);
    }
    if (creature._unitIdChars) {
        // Container opacity drives the fade; keep per-char opacity flat so no stale
        // per-character fade lingers, and glow the chars only while they're readable.
        for (let i = 0; i < creature._unitIdChars.length; i++) {
            const span = creature._unitIdChars[i];
            span.style.opacity = '1';
            span.classList.toggle('sonar-char-lit', unitAlpha > 0.3);
        }
    }

    // ═══ CHALLENGE BOX — sweep-arm clock reveal ═══
    // A vertical "challenge tracer" wipes the text in left→right as the sweep arm
    // travels from this target's 12 o'clock to chalWipeEnd; passed letters STAY lit
    // (cumulative — level 1). The text then holds and is wiped away left→right
    // between chalFade and chalClear. Box fill + outline (the "blank box" frame)
    // show their CSV colours immediately. Per-level angles in the progression CSV.
    // chalMode: 'cumulative' (level 1) lights letters as the tracer passes and holds
    // them; 'sliver' instead shows only a chalFrac-wide moving window trailing the tracer
    // head (a harder, deeper-level read). Both honor the same chalFade→chalClear erase.
    if (creature._chalSweepArm && clearedEdge) {
        const cc = creature.colorChallenge;

        // The challenge box rides its OWN sweep clock — gated by the arm crossing the box's
        // rendered position (_chalSweepDetected) and timed off the box's own bearing
        // (_chalAnchor), independent of the unit box above. So the arm can write the command
        // in while the unit number is still dark (or vice versa), each on its own 12 o'clock.
        const chalSwept = creature._chalSweepDetected === true;
        const chalPhase = creature._chalAnchor
            ? getSweepPhaseAt(creature._chalAnchor.x, creature._chalAnchor.y)
            : getCreatureSweepPhase(creature);

        // Left→right reveal head: 0 at 12 o'clock, 1 at chalWipeEnd, then held at 1.
        const wipeSpan = Math.max(1, sweepCfg.chalWipeEnd - sweepCfg.unitAppear);
        let revealPos = (chalPhase - sweepCfg.unitAppear) / wipeSpan;
        revealPos = Math.max(0, Math.min(1, revealPos));

        // Left→right clear head: erases the lit text between chalFade and chalClear.
        let clearPos = 0;
        if (chalPhase >= sweepCfg.chalFade) {
            const fadeSpan = Math.max(1, sweepCfg.chalClear - sweepCfg.chalFade);
            clearPos = Math.min(1, (chalPhase - sweepCfg.chalFade) / fadeSpan);
        }

        // Visible band = [clearPos, revealPos]. Appearance (the right/reveal edge) is
        // IMMEDIATE — a hard edge as the tracer crosses. The fade-out (the left/dissolve
        // edge) is a SLOW dissolve: a soft gradient trailing the dissolve front as it
        // sweeps left→right, so letters dim gradually instead of snapping off. The soft
        // ramp is applied ONLY while actually fading (clearPos > 0), so the wipe-in stays
        // crisp.
        if (textContent) {
            // Effective LEFT edge of the lit band. Cumulative (level 1): 0 until the
            // chalFade erase begins (clearPos). Sliver (deeper levels): a chalFrac-wide
            // window trails the reveal head so only part of the command is readable at
            // once. The fade-out erase (clearPos) still applies on top of either.
            let leftEdge = clearPos;
            let feather = clearPos > 0;        // soft dissolve once fading out
            if (sweepCfg.chalMode === 'sliver') {
                const frac = Math.max(0.08, Math.min(1, sweepCfg.chalFrac || 1));
                const sliverLeft = Math.max(0, revealPos - frac);
                if (sliverLeft > leftEdge) { leftEdge = sliverLeft; feather = true; }   // soft trailing edge behind the moving window
            }

            if (!chalSwept || revealPos <= leftEdge) {
                // Not yet swept (or fully cleared) → text fully masked: the empty box frame
                // is all that shows until the tracer writes the command in.
                textContent.style.mask = 'linear-gradient(90deg, transparent 0%, transparent 100%)';
            } else {
                const bP = (revealPos * 100).toFixed(1);
                let maskStr;
                if (!feather) {
                    // Wipe-in / hold: sharp left edge, sharp reveal front.
                    maskStr = `linear-gradient(90deg, white 0%, white ${bP}%, transparent ${bP}%, transparent 100%)`;
                } else {
                    // Soft trailing edge — the fade-out dissolve, or the sliver window's tail.
                    const DISSOLVE_FEATHER = 0.4; // width of the soft dissolve zone (fraction of box)
                    const aP = (leftEdge * 100).toFixed(1);
                    const rampEnd = Math.min(leftEdge + DISSOLVE_FEATHER, revealPos);
                    const rP = (rampEnd * 100).toFixed(1);
                    maskStr = `linear-gradient(90deg, transparent 0%, transparent ${aP}%, white ${rP}%, white ${bP}%, transparent ${bP}%, transparent 100%)`;
                }
                textContent.style.mask = maskStr;
            }
            textContent.style.webkitMask = textContent.style.mask;
        }

        // The challenge tracer (vertical scan line) rides the active head — shown only
        // while it's actually writing (wiping in) or erasing (fading out).
        const writing = chalSwept && chalPhase >= sweepCfg.unitAppear && chalPhase < sweepCfg.chalWipeEnd;
        const erasing = chalSwept && chalPhase >= sweepCfg.chalFade && chalPhase < sweepCfg.chalClear;
        if (writing) {
            creature._chalSweepArm.style.left = `${(revealPos * 100).toFixed(1)}%`;
            creature._chalSweepArm.style.opacity = '1';
        } else if (erasing) {
            creature._chalSweepArm.style.left = `${(clearPos * 100).toFixed(1)}%`;
            creature._chalSweepArm.style.opacity = '1';
        } else {
            creature._chalSweepArm.style.opacity = '0';
        }

        // ── Background + border: show CSV colours immediately (the blank-box frame) ──
        if (cc && textEl) {
            textEl.style.borderColor = cc.fg;
            textEl.style.boxShadow = `0 0 8px ${cc.fg}66, inset 0 0 4px ${cc.fg}22`;
            textEl.style.setProperty('--chal-fg', cc.fg);
        }
        if (cc && creature._chalBgReveal) {
            creature._chalBgReveal.style.background = cc.bg;
            creature._chalBgReveal.style.mask = 'none';
            creature._chalBgReveal.style.webkitMask = 'none';
            creature._chalBgReveal.style.opacity = '1';
        }

        // Challenge tracer colour matches the outline.
        if (cc) {
            creature._chalSweepArm.style.background = `linear-gradient(180deg, transparent, ${cc.fg}bb, transparent)`;
            creature._chalSweepArm.style.boxShadow = `0 0 8px ${cc.fg}66, 0 0 16px ${cc.fg}33`;
        }
    }

    // --- Position in screen space (centered on creature for vertical stack) ---
    let vx, vy;
    if (creature.challengeBox && creature.challengeBox.x !== undefined) {
        vx = creature.challengeBox.x;
        vy = creature.challengeBox.y;
    } else {
        vx = creature.x;
        vy = creature.y;
    }

    const creatureOnScreen = creature.x > 0 && creature.x < COORD_SYSTEM.width;
    if (creatureOnScreen) {
        if (vx < 60) vx = 60;
        if (vx > COORD_SYSTEM.width - 60) vx = COORD_SYSTEM.width - 60;
    }

    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const wrapper = document.getElementById('canvas-wrapper');
    const wrapperRect = wrapper ? wrapper.getBoundingClientRect() : rect;
    const offsetX = rect.left - wrapperRect.left;
    const offsetY = rect.top - wrapperRect.top;
    const scaleY = rect.height / COORD_SYSTEM.height;
    const screenX = offsetX + (vx / COORD_SYSTEM.width) * rect.width;
    const screenY = offsetY + (vy / COORD_SYSTEM.height) * rect.height;

    // Dynamic gap between probe and challenge — sized to creature sprite in screen pixels
    const ct = creature.creatureType;
    let spriteH = creature.radius * 2;
    if (ct && ct.spriteSize) spriteH = ct.spriteSize.h;
    // Park the challenge box close under the sprite — tucked near the target it belongs to.
    // (Lower the 0.20 factor to sit even tighter; raise it to float further below.)
    const gapScreen = (spriteH * 0.20 + 2) * scaleY;
    el.style.setProperty('--creature-gap', `${gapScreen.toFixed(1)}px`);

    el.style.transform = `translate3d(${screenX}px, ${screenY}px, 0) translate(-50%, -50%)`;

    // Keep the bubble on-screen: when a target is near the BOTTOM, parking the bubble below
    // it would run off the screen edge (the issue with low TOC units). Flip the stack so the
    // bubble sits ABOVE the target instead — still hugging it, just on the other side. A 40px
    // hysteresis band keeps the patrol bob from flickering the flip on/off at the threshold.
    const canvasBottomScreen = offsetY + rect.height;
    const boxDropScreen = 21 + gapScreen + 36;   // ≈ probe-slot half + gap + box height (screen px)
    const dropBottom = screenY + boxDropScreen;
    if (creature.isToc) {
        // TOC challenge/status reads best ABOVE the target (Andrew) — always flip up,
        // regardless of the bottom-edge test, so every TOC bubble sits over its fish.
        creature._bubbleFlipUp = true;
    } else if (creature._bubbleFlipUp === undefined) creature._bubbleFlipUp = dropBottom > (canvasBottomScreen - 6);
    else if (dropBottom > (canvasBottomScreen - 6)) creature._bubbleFlipUp = true;
    else if (dropBottom < (canvasBottomScreen - 46)) creature._bubbleFlipUp = false;
    el.classList.toggle('flip-up', creature._bubbleFlipUp);

    // Visibility based on light cone — shallow tiers are always fully bright
    const shallowTier = tierIdx <= 1;
    const inCone = shallowTier || isInLightCone(creature.x, creature.y);
    el.classList.toggle('in-cone', inCone);
    el.classList.toggle('out-cone', !inCone);

    // Base colors — CSV colorSonar for probe, colorChallenge for challenge box.
    const sonarGreen = '#00FF41';
    const cs = creature.colorSonar;
    const sonarFg = (cs && cs.fg) || sonarGreen;
    const sonarBg = (cs && cs.bg) || '#000000';
    const cc = creature.colorChallenge;
    if (textEl) {
        if (cc) {
            textEl.style.setProperty('--chal-bg', cc.bg);
            textEl.style.setProperty('--chal-fg', cc.fg);
            textEl.style.borderColor = cc.fg;
            textEl.style.boxShadow = `0 0 8px ${cc.fg}66, inset 0 0 4px ${cc.fg}22`;
        } else {
            textEl.style.setProperty('--chal-bg', '#000000');
            textEl.style.setProperty('--chal-fg', sonarGreen);
            textEl.style.borderColor = sonarGreen;
            textEl.style.boxShadow = `0 0 8px rgba(0, 255, 65, 0.4), inset 0 0 4px rgba(0, 255, 65, 0.15)`;
        }
    }

    // ── TOC status panel update ──
    if (creature.isToc && creature._tocStatusPanel) {
        // Sonar-sweep gate (same clock as the other boxes): before the arm crosses this
        // unit the panel shows the blank frame (black fill + green trim). As the arm passes
        // (its 12 o'clock) the offload colour appears — white (not active) / blue (active) —
        // holds, then fades back to the blank frame between 180° and 270° (getUnitRevealAlpha).
        const tocReveal = swept ? getUnitRevealAlpha(creature) : 0;
        // Offload tint reads off the colour axis (gateState). "Available" = a hittable
        // state (Blue): fill the box with the solid CSV colour (#4F9BE0) + black CSV text
        // so it's visually distinct from the dim White/Pink waiting states.
        const tintBox = creature._tocStatusBox;
        const stateRaw = creature.gate && creature.gate.colors && creature.gate.colors[creature.gateState];
        const stateCol = (stateRaw && typeof parsePipeColor === 'function') ? parsePipeColor(stateRaw) : null;
        const isAvailable = !!(creature.gate && creature.gate.hittable && creature.gate.hittable[creature.gateState]);
        if (tintBox) {
            tintBox.classList.toggle('toc-color-pink', creature.gateState === 'Pink' && !isAvailable);
            tintBox.classList.toggle('toc-color-blue', isAvailable);
            // Available: solid CSV blue fill (precise inline override of the .toc-color-blue
            // class default; hard fallback if the colour didn't resolve). Border + glow come
            // from the class, which also guarantees a blue box even if this inline path fails.
            tintBox.style.background = isAvailable ? ((stateCol && stateCol.bg) || '#2E90FF') : '';
            tintBox.style.borderColor = '';
            // Fade the colour fill in/out with the sweep arm — blank frame shows through at 0.
            tintBox.style.opacity = tocReveal.toFixed(2);
        }
        // Current Status label (no timestamp). Waiting (White/Pink) reads "Awaiting TOC";
        // once available (Blue) it reads "TOC Completed" (reached via Pink) or "Patient Left
        // for other reason" (reached directly from White). Improper-call flash overrides.
        const label = creature._tocStatusLabel;
        if (label) {
            const improper = Date.now() < (creature._tocImproperFlashUntil || 0);
            label.classList.toggle('toc-status-improper-call', improper);
            if (improper) {
                label.textContent = 'Improper Call Close';
            } else if (isAvailable) {
                label.textContent = creature._tocPatientLeft ? 'Patient Left for other reason' : 'TOC Completed';
            } else {
                label.textContent = 'Awaiting TOC';
            }
            // Available → black CSV text on the light-blue fill; waiting → light label.
            // (Skip while the improper-call flash owns the colour via its class.)
            if (isAvailable && stateCol && !improper) {
                label.style.color = stateCol.fg;           // #000000
                label.style.textShadow = 'none';
            } else {
                label.style.color = '';
                label.style.textShadow = '';
            }
            // Label text follows the sweep too — hidden on the blank frame, readable while
            // the colour fill is lit. The improper-call flash always shows (it's feedback on
            // the player's own mis-fire, not a sonar contact).
            label.style.opacity = improper ? '1' : tocReveal.toFixed(2);
        }
        // Bed Assign icon: cosmetic — shown on an available unit if the bed was rolled,
        // and only while the sweep has the panel lit.
        if (creature._tocBedIcon) {
            creature._tocBedIcon.classList.toggle('toc-bed-icon-visible',
                isAvailable && creature._tocBedAssigned && tocReveal > 0.3);
        }
    }

    // ── Sonar probe morph state ──
    // Pre-morph: probe is the primary contact — scales up to 1.6x, full glow.
    // Post-morph: probe shrinks to normal as creature sprite fades in.
    // (morphAlpha already declared above in unit ID sweep section)
    const preMorph = morphAlpha < 1;
    const probeScale = preMorph ? 1.0 + (1 - morphAlpha) * 0.6 : 1.0;
    // When pre-morph, collapse the creature gap (no sprite visible)
    if (preMorph) {
        el.style.setProperty('--creature-gap', '4px');
    }

    // ── Detection→Action transition ──
    // When fully morphed, fade out sonar display and swap unit ID to challenge box colors.
    const fullyRevealed = morphAlpha >= 1;

    if (creature._sonarProbe) {
        if (fullyRevealed) {
            // Action phase: probe hands the unit ID off to the on-fish tag.
            // visibility (not display) keeps its layout slot so the challenge
            // box stays parked below the creature.
            creature._sonarProbe.classList.add('sonar-revealed', 'probe-hidden');
            const revealBg = (cc && cc.bg) || sonarBg;
            const revealFg = (cc && cc.fg) || sonarFg;
            creature._sonarProbe.style.transform = `scale(${probeScale.toFixed(2)})`;
            creature._sonarProbe.style.background = revealBg;
            creature._sonarProbe.style.borderColor = revealFg + 'b3';
            creature._sonarProbe.style.boxShadow = `0 0 10px ${revealFg}88, 0 0 20px ${revealFg}44`;
            creature._sonarProbe.style.setProperty('--probe-glow', revealFg);
            if (creature._sonarUnitIdEl) {
                creature._sonarUnitIdEl.style.color = revealFg;
            }
            if (creature._unitIdChars) {
                creature._unitIdChars.forEach(span => {
                    span.style.color = revealFg;
                    // Crisp: tight dark halo pins the edges (no fill-bleed haze), small
                    // same-colour bloom for shine — matches the challenge box treatment.
                    span.style.textShadow = `0 0 1px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.7), 0 0 4px ${revealFg}`;
                });
            }
        } else {
            // Detection phase: sonar display active with sonar colors
            creature._sonarProbe.classList.remove('sonar-revealed', 'probe-hidden');
            creature._sonarProbe.style.transform = `scale(${probeScale.toFixed(2)})`;
            creature._sonarProbe.style.background = sonarBg;
            const probeGlow = preMorph
                ? `0 0 ${(14 + (1 - morphAlpha) * 12).toFixed(0)}px ${sonarFg}aa, 0 0 ${(24 + (1 - morphAlpha) * 16).toFixed(0)}px ${sonarFg}55`
                : `0 0 10px ${sonarFg}88, 0 0 20px ${sonarFg}44`;
            creature._sonarProbe.style.borderColor = sonarFg + 'b3';
            creature._sonarProbe.style.boxShadow = probeGlow;
            creature._sonarProbe.style.setProperty('--probe-glow', sonarFg);
            if (creature._sonarUnitIdEl) {
                creature._sonarUnitIdEl.style.color = sonarFg;
            }
            if (creature._unitIdChars) {
                creature._unitIdChars.forEach(span => { span.style.color = sonarFg; });
            }
            // Sweep arm + trail use sonar fg color
            if (creature._sonarSweepArm) {
                creature._sonarSweepArm.style.background = `linear-gradient(90deg, ${sonarFg}26, ${sonarFg}cc)`;
            }
            if (creature._sonarSweepTrail) {
                creature._sonarSweepTrail.style.background = `conic-gradient(from 0deg, ${sonarFg}1f 0deg, ${sonarFg}0f 20deg, ${sonarFg}05 40deg, transparent 50deg)`;
            }
        }
    }

    // Track challenge box dimensions for tether physics + cache tether endpoints
    if (creature.challengeBox) {
        const elRect = el.getBoundingClientRect();
        creature.challengeBox.width = (elRect.width / canvasScaleX) || 120;
        creature.challengeBox.height = (elRect.height / canvasScaleY) || 26;

        // Cache tether endpoints in virtual coords using overlay height geometry
        // Overlay is a vertical flex column: [probe] -- gap -- [challenge]
        // The overlay center is at box.y; probe is above, challenge is below
        const halfH = creature.challengeBox.height / 2;
        creature._tetherProbeY = creature.challengeBox.y - halfH;
        creature._tetherChalY = creature.challengeBox.y + halfH;
    }

    // Cache the challenge box's RENDERED centre in virtual coords so the sweep arm can gate
    // it on its own bearing (the box is parked off the fish by CSS flex, not by challengeBox.y
    // — which springs to the creature centre — so we read the real DOM rect). TOC units carry
    // no challenge box (their readout is the status panel, gated by the unit sweep), so skip
    // them. Detection + reveal both consume this, one frame behind — imperceptible.
    if (!creature.isToc && creature._sonarTextEl) {
        const tr = creature._sonarTextEl.getBoundingClientRect();
        if (tr.width > 0 && rect.width > 0) {
            const cxV = ((tr.left + tr.width / 2) - rect.left) / rect.width * COORD_SYSTEM.width;
            const cyV = ((tr.top + tr.height / 2) - rect.top) / rect.height * COORD_SYSTEM.height;
            creature._chalAnchor = { x: cxV, y: cyV };
        }
    }
}

function garbleText(text) {
    const garbleChars = '!@#$%^&*~?/\\|<>';
    const chars = text.split('');
    for (let i = 0; i < chars.length; i++) {
        if (Math.random() < 0.2) {
            chars[i] = garbleChars[Math.floor(Math.random() * garbleChars.length)];
        }
    }
    return chars.join('');
}

// ============================================
// PROJECTILE RENDERING
// ============================================

function drawProjectile(ctx, p) {
    // Green tracer line — dissipates toward the tail
    if (p.trail && p.trail.length > 1) {
        for (let i = 1; i < p.trail.length; i++) {
            const t = i / p.trail.length;
            const alpha = t * 0.5; // Fades toward tail
            const width = 1 + t * 2; // Thickens toward head
            ctx.strokeStyle = `rgba(0, 255, 100, ${alpha})`;
            ctx.lineWidth = width;
            ctx.beginPath();
            ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
            ctx.lineTo(p.trail[i].x, p.trail[i].y);
            ctx.stroke();
        }
    }

    // Sonar sphere head — green glowing ball
    ctx.shadowColor = '#00ff66';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright core
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#aaffcc';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();

    // Expanding sonar ring pulse
    const ringPhase = (Date.now() % 500) / 500;
    ctx.strokeStyle = `rgba(0, 255, 100, ${(1 - ringPhase) * 0.6})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5 + ringPhase * 12, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 0;
}

function drawBroken(ctx, b) {
    for (const s of b.smoke) {
        ctx.fillStyle = `rgba(60,80,100,${s.life * 0.4})`;
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
    grad.addColorStop(1, 'rgba(0,100,150,0)');
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
    try { AudioManager.stopAmbient(); } catch (e) {}
    scatterPawPrints();
    DOM.pauseOverlay.classList.remove('hidden');
}

// Lay down a fresh random trail of cat paw prints over the pause freeze-frame —
// a cat walking across the glass, left/right feet alternating along the path,
// each print turned to face the direction of travel. Re-rolled every pause.
function scatterPawPrints() {
    const container = document.getElementById('pause-paws');
    if (!container) return;
    container.innerHTML = '';
    const W = window.innerWidth, H = window.innerHeight;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const clampY = (y) => Math.max(0.05 * H, Math.min(0.95 * H, y));

    const trailCount = Math.random() < 0.30 ? 2 : 1;   // usually one path, sometimes two
    for (let t = 0; t < trailCount; t++) {
        // Start just off one side and walk to just off the far side, with a
        // random vertical drift so the path slopes a little.
        const leftToRight = Math.random() < 0.5;
        const startX = (leftToRight ? -0.06 : 1.06) * W;
        const endX   = (leftToRight ?  1.06 : -0.06) * W;
        const startY = rnd(0.12, 0.88) * H;
        const endY   = clampY(startY + rnd(-0.35, 0.35) * H);

        const dx = endX - startX, dy = endY - startY;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;            // forward unit vector
        const nx = -uy, ny = ux;                       // left-perpendicular unit vector
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;

        const stride = rnd(72, 96);                    // px along the path between steps
        const gait   = rnd(20, 32);                    // px lateral foot offset from centreline
        const steps  = Math.max(4, Math.floor(len / stride));
        for (let i = 0; i < steps; i++) {
            const along = i * stride + rnd(-6, 6);
            const side  = (i % 2 === 0) ? 1 : -1;      // alternate left / right feet
            const lat   = side * gait + rnd(-5, 5);
            const cx = startX + ux * along + nx * lat;
            const cy = startY + uy * along + ny * lat;
            if (cx < -90 || cx > W + 90 || cy < -90 || cy > H + 90) continue;
            const size = rnd(46, 76);
            const paw = document.createElement('i');
            paw.className = 'otter-paw';
            paw.style.left = cx + 'px';
            paw.style.top = cy + 'px';
            paw.style.width = size + 'px';
            paw.style.height = (size * 1.10) + 'px';
            paw.style.opacity = rnd(0.45, 0.72).toFixed(2);
            // Paw art points "up" at 0°, so +90° aligns the toes with travel.
            paw.style.transform =
                `translate(-50%, -50%) rotate(${(angle + 90 + rnd(-12, 12)).toFixed(1)}deg)`;
            container.appendChild(paw);
        }
    }
}

function resumeGame() {
    if (!state.paused) return;
    state.paused = false;
    state.running = true;
    DOM.pauseOverlay.classList.add('hidden');
    requestGameFullscreen();   // re-enter fullscreen if Esc dropped us out of it (no-op if still in)
    try { AudioManager.startAmbient(); } catch (e) {}
    DOM.input.focus();
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

// ============================================
// DIVE ENTRY ANIMATION
// ============================================

function playDiveEntry(onComplete) {
    const ctx = DOM.ctx;
    const W = COORD_SYSTEM.width;
    const H = COORD_SYSTEM.height;
    const cx = W / 2; // Head at center X

    // Animation state
    const anim = {
        phase: 'jump',     // 'jump' -> 'splash' -> 'sink' -> 'done'
        timer: 0,
        diverX: cx + 180,  // Start on ship deck, right of center
        diverY: 48,        // Ship deck height (relative to larger ship)
        diverVx: 0,
        diverVy: 0,
        splashParticles: [],
        bubbles: [],
        waterLineY: 140,   // Water surface line
        shipRocking: 0
    };

    // Jump: diver steps off ship, arcs into water
    // Splash: impact with water surface, particles
    // Sink: diver descends to play position

    const startTime = performance.now();
    let lastFrameTime = startTime;

    function drawShip(ctx, time) {
        const rock = Math.sin(time * 0.002) * 2;
        ctx.save();
        // Position ship so hull sits IN the water (waterline at y=140)
        // Pushed from 125 down to 155 so the hull actually drafts underwater
        ctx.translate(cx + 200, 155 + rock);
        ctx.rotate(Math.sin(time * 0.001) * 0.02);

        if (shipSpriteLoaded) {
            // We're going to need a bigger boat (Increased from 100)
            const h = 160;
            const w = h * (shipSprite.naturalWidth / shipSprite.naturalHeight);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(shipSprite, -w / 2, -h, w, h);
        } else {
            // Fallback procedural ship
            ctx.fillStyle = '#2a2a2a';
            ctx.beginPath();
            ctx.moveTo(-180, -20);
            ctx.lineTo(-200, 40);
            ctx.lineTo(200, 40);
            ctx.lineTo(180, -20);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#3a3a3a';
            ctx.fillRect(-160, -30, 320, 12);
        }

        ctx.restore();
    }

    function drawDiver(ctx, x, y, inWater) {
        const spriteH = 70; // Slightly smaller during dive entry
        const spriteW = aquanautSpriteLoaded
            ? spriteH * (aquanautSprite.naturalWidth / aquanautSprite.naturalHeight)
            : 30;

        ctx.save();
        ctx.translate(x, y);

        if (aquanautSpriteLoaded) {
            ctx.drawImage(
                aquanautSprite,
                -spriteW / 2,
                -spriteH / 2,
                spriteW,
                spriteH
            );
        } else {
            // Fallback silhouette
            ctx.fillStyle = '#c87830';
            ctx.beginPath();
            ctx.ellipse(0, 0, 12, spriteH / 2, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Headlamp glow
        ctx.fillStyle = 'rgba(255, 255, 220, 0.9)';
        ctx.shadowColor = '#ffffcc';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(1, -spriteH * 0.42, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.restore();
    }

    function drawWaterSurface(ctx, y, time) {
        // Undulating water surface
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= W; x += 8) {
            const wave = Math.sin(x * 0.02 + time * 0.003) * 3 + Math.sin(x * 0.008 + time * 0.001) * 5;
            ctx.lineTo(x, y + wave);
        }
        ctx.lineTo(W, H);
        ctx.lineTo(0, H);
        ctx.closePath();

        // Water fill with depth gradient
        const waterGrad = ctx.createLinearGradient(0, y, 0, H);
        waterGrad.addColorStop(0, 'rgba(60, 160, 220, 0.3)');
        waterGrad.addColorStop(0.3, 'rgba(40, 120, 180, 0.2)');
        waterGrad.addColorStop(1, 'rgba(20, 60, 100, 0.1)');
        ctx.fillStyle = waterGrad;
        ctx.fill();

        // Surface highlight line
        ctx.strokeStyle = 'rgba(150, 220, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 8) {
            const wave = Math.sin(x * 0.02 + time * 0.003) * 3 + Math.sin(x * 0.008 + time * 0.001) * 5;
            x === 0 ? ctx.moveTo(x, y + wave) : ctx.lineTo(x, y + wave);
        }
        ctx.stroke();
        ctx.restore();
    }

    function animFrame(ts) {
        const dt = Math.min((ts - lastFrameTime) / 1000, 0.05);
        lastFrameTime = ts;
        const elapsed = (ts - startTime) / 1000;
        const time = ts;

        ctx.clearRect(0, 0, DOM.canvas.width, DOM.canvas.height);
        ctx.save();
        ctx.scale(canvasScaleX, canvasScaleY);

        // Sky/water background
        const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
        skyGrad.addColorStop(0, '#1a3050');
        skyGrad.addColorStop(anim.waterLineY / H, '#2a5a8a');
        skyGrad.addColorStop(anim.waterLineY / H + 0.01, '#4a90c0');
        skyGrad.addColorStop(1, '#2a7ab5');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, H);

        // Stars in sky
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        for (let i = 0; i < 20; i++) {
            const sx = (i * 73 + 50) % W;
            const sy = (i * 37 + 10) % (anim.waterLineY - 20);
            ctx.beginPath();
            ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Ship
        drawShip(ctx, time);

        // Water surface (behind diver when above water)
        if (anim.diverY < anim.waterLineY) {
            drawWaterSurface(ctx, anim.waterLineY, time);
        }

        switch (anim.phase) {
            case 'jump':
                // Diver walks to edge then steps off
                if (elapsed < 0.8) {
                    // Walk toward edge — deck level relative to ship
                    anim.diverX = cx + 180 - elapsed * 200;
                    anim.diverY = 48;
                } else if (elapsed < 1.0) {
                    // Step off — brief pause at edge
                    anim.diverX = cx + 20;
                    anim.diverY = 48;
                } else {
                    // Free fall with slight arc toward center
                    const fallT = elapsed - 1.0;
                    anim.diverX = cx + 20 - fallT * 25;
                    anim.diverY = 48 + fallT * 200 + fallT * fallT * 300;

                    if (anim.diverY >= anim.waterLineY) {
                        anim.diverY = anim.waterLineY;
                        anim.phase = 'splash';
                        anim.timer = 0;
                        // Generate splash particles
                        for (let i = 0; i < 25; i++) {
                            anim.splashParticles.push({
                                x: anim.diverX + (Math.random() - 0.5) * 30,
                                y: anim.waterLineY,
                                vx: (Math.random() - 0.5) * 8,
                                vy: -3 - Math.random() * 8,
                                life: 1.0,
                                radius: 2 + Math.random() * 4
                            });
                        }
                        AudioManager.play('shieldHit'); // Splash sound
                    }
                }
                drawDiver(ctx, anim.diverX, anim.diverY, false);
                break;

            case 'splash':
                anim.timer += dt;
                // Splash particles
                anim.splashParticles.forEach(p => {
                    p.x += p.vx;
                    p.vy += 0.3; // gravity
                    p.y += p.vy;
                    p.life -= 0.025;
                    if (p.life > 0) {
                        ctx.fillStyle = `rgba(150, 210, 255, ${p.life * 0.7})`;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2);
                        ctx.fill();
                    }
                });

                // Diver submerges
                anim.diverY = anim.waterLineY + anim.timer * 60;
                drawDiver(ctx, anim.diverX, anim.diverY, true);

                if (anim.timer > 1.2) {
                    anim.phase = 'sink';
                    anim.timer = 0;
                }
                break;

            case 'sink': {
                anim.timer += dt;
                const sinkDuration = 2.5;
                const sinkProgress = Math.min(1, anim.timer / sinkDuration);
                // Ease out
                const eased = 1 - Math.pow(1 - sinkProgress, 3);

                const startSinkY = anim.waterLineY + 70;
                const endSinkY = H * 0.65; // Final aquanaut position (below center)
                anim.diverY = startSinkY + (endSinkY - startSinkY) * eased;
                anim.diverX = anim.diverX + (cx - anim.diverX) * eased;

                // Darken background as diver sinks (transition to game background)
                const darkFactor = eased;
                const colors = getDepthColors();
                const sinkGrad = ctx.createLinearGradient(0, 0, 0, H);
                sinkGrad.addColorStop(0, lerpColor('#2a5a8a', colors.top, darkFactor));
                sinkGrad.addColorStop(1, lerpColor('#2a7ab5', colors.bottom, darkFactor));
                ctx.fillStyle = sinkGrad;
                ctx.fillRect(0, 0, W, H);

                // Fading water surface
                if (darkFactor < 0.8) {
                    ctx.globalAlpha = 1 - darkFactor * 1.25;
                    drawWaterSurface(ctx, anim.waterLineY - eased * 200, time);
                    ctx.globalAlpha = 1;
                }

                // Rising bubbles
                if (Math.random() < 0.4) {
                    anim.bubbles.push({
                        x: anim.diverX + (Math.random() - 0.5) * 20,
                        y: anim.diverY - 20,
                        vy: -1.5 - Math.random() * 2,
                        radius: 1 + Math.random() * 3,
                        life: 1.0
                    });
                }
                anim.bubbles.forEach(b => {
                    b.y += b.vy;
                    b.x += Math.sin(Date.now() * 0.005 + b.x) * 0.3;
                    b.life -= 0.015;
                    if (b.life > 0) {
                        ctx.fillStyle = `rgba(150, 210, 255, ${b.life * 0.4})`;
                        ctx.beginPath();
                        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
                        ctx.fill();
                    }
                });
                anim.bubbles = anim.bubbles.filter(b => b.life > 0);

                drawDiver(ctx, anim.diverX, anim.diverY, true);

                // Depth text
                const depthNow = Math.floor(sinkProgress * 30);
                ctx.fillStyle = `rgba(100, 200, 255, ${0.5 + sinkProgress * 0.3})`;
                ctx.font = "bold 20px 'Courier New'";
                ctx.textAlign = 'center';
                ctx.fillText(`DESCENDING — ${depthNow}m`, cx, H * 0.15);

                if (sinkProgress >= 1) {
                    anim.phase = 'done';
                }
                break;
            }
        }

        // Water surface in front of diver when submerged
        if (anim.phase !== 'jump' && anim.diverY > anim.waterLineY && anim.phase === 'splash') {
            drawWaterSurface(ctx, anim.waterLineY, time);
        }

        ctx.restore();

        if (anim.phase === 'done') {
            onComplete();
        } else {
            // Use setTimeout fallback when page is hidden (rAF pauses in background tabs)
            if (document.visibilityState === 'hidden') {
                setTimeout(() => safeAnimFrame(performance.now()), 16);
            } else {
                requestAnimationFrame(safeAnimFrame);
            }
        }
    }

    function safeAnimFrame(ts) {
        try {
            animFrame(ts);
        } catch (e) {
            console.error('[DIVE ANIM] Error:', e);
            onComplete();
        }
    }

    // Use setTimeout if page is hidden (rAF won't fire in background tabs)
    if (document.visibilityState === 'hidden') {
        setTimeout(() => safeAnimFrame(performance.now()), 16);
    } else {
        requestAnimationFrame(safeAnimFrame);
    }
}

// ── Fullscreen ──
// Run the dive in the browser's own fullscreen so an accidental F11 (and the Esc that
// exits it) stops mattering. Requested on dive start (within the start-button click, a
// valid user gesture) and toggleable from the HUD button. Pause has a P alias too, since
// the browser reserves Esc for exiting fullscreen.
// Keyboard Lock (Chromium): while fullscreen, capture Esc so a single press reaches our
// keydown handler (→ pause) instead of dropping the dive out of fullscreen. The browser
// still lets the player HOLD Esc to force-exit as a safety hatch, and the lock auto-releases
// whenever the document leaves fullscreen. No-op in browsers without the API.
function lockEscapeKey() {
    try {
        if (navigator.keyboard && navigator.keyboard.lock) {
            const p = navigator.keyboard.lock(['Escape']);
            if (p && p.catch) p.catch(() => {});
        }
    } catch (e) {}
}
function unlockEscapeKey() {
    try {
        if (navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock();
    } catch (e) {}
}
function requestGameFullscreen() {
    try {
        const el = document.documentElement;
        if (!document.fullscreenElement && el.requestFullscreen) {
            const p = el.requestFullscreen();
            // Grab the Esc key once we're actually fullscreen (lock() requires it).
            if (p && p.then) p.then(lockEscapeKey).catch(() => {});
            else lockEscapeKey();
        } else if (document.fullscreenElement) {
            lockEscapeKey();   // already fullscreen — (re)assert the lock
        }
    } catch (e) {}
}

// Quit the game entirely. Browsers only allow window.close() to shut a window
// the script itself opened, so this is best-effort: try to close, and if we're
// still here a moment later (close was blocked), drop to a "powered down"
// sign-off screen the player can close manually or click to restart.
function quitGame() {
    try { AudioManager.play('lcarsButton'); } catch (e) {}
    // Drop out of fullscreen on power-down (mirrors toggleFullscreen's exit path).
    try {
        if (document.fullscreenElement) {
            state._intentionalFsExit = true;   // deliberate exit — don't auto-pause on it
            unlockEscapeKey();
            if (document.exitFullscreen) { const p = document.exitFullscreen(); if (p && p.catch) p.catch(() => {}); }
        }
    } catch (e) {}
    try { window.close(); } catch (e) {}
    setTimeout(showPoweredDownScreen, 200);
}

function showPoweredDownScreen() {
    if (document.getElementById('powered-down-overlay')) return;
    // Halt the game/audio so nothing keeps running behind the sign-off.
    try { state.running = false; state.paused = false; } catch (e) {}
    try { AudioManager.stopMusic && AudioManager.stopMusic(); } catch (e) {}
    const ov = document.createElement('div');
    ov.id = 'powered-down-overlay';
    ov.innerHTML =
        '<div class="pd-text">SYSTEM POWERED DOWN</div>' +
        '<div class="pd-sub">You may now close this window.</div>' +
        '<div class="pd-hint">(click anywhere to re-initialize)</div>';
    ov.addEventListener('click', () => location.reload());
    document.body.appendChild(ov);
}
function toggleFullscreen() {
    try {
        if (document.fullscreenElement) {
            state._intentionalFsExit = true;   // HUD toggle-off — don't auto-pause on this exit
            unlockEscapeKey();
            if (document.exitFullscreen) { const p = document.exitFullscreen(); if (p && p.catch) p.catch(() => {}); }
        } else {
            requestGameFullscreen();
        }
    } catch (e) {}
}

function startGame(holodeck = false) {
    requestGameFullscreen();   // dive runs fullscreen (avoids the accidental-F11 / Esc dance)
    if (state._holodeckMenuShownAt && Date.now() - state._holodeckMenuShownAt < 400) return;
    if (state.rovPendingTimer) { clearTimeout(state.rovPendingTimer); state.rovPendingTimer = null; }
    clearTimeout(state.timers.gameOverDelay);
    // Clear any pending HUD timeouts before state.timers is replaced below, so a quick
    // restart can't let the prior dive's callbacks fire against the fresh run's HUD.
    clearTimeout(state.timers.status);
    clearTimeout(state.timers.status2);
    clearTimeout(state.timers.penaltyFlash);
    Helmet.reset();   // clean helmet shell at the start of each dive

    const firstTierKey = Object.keys(TIERS)[0] || 'bubblehopper';
    const firstTier = TIERS[firstTierKey];

    Object.assign(state, {
        running: false, score: 0,
        hullHP: CONFIG.maxHullIntegrity,
        bellBreached: false, repairCount: 0,
        cracks: [], streak: 0, streakSinceHullHit: 0,
        perfectStreak: 0, perfectMilestonesHit: [],
        consecutiveHosesDestroyed: 0,
        comebackCounter: 0, comebackAwarded: false,
        firstBloodAwarded: false,
        rankScoreAccum: 0, lastCalibrationAt: 0,
        tier: firstTierKey,
        speedMult: firstTier ? firstTier.speedMax : 0.7,
        spawnInterval: firstTier ? firstTier.spawnMin : 5500,
        maxTargets: firstTier ? firstTier.maxTargets : 5,
        creatures: [], projectiles: [], brokenProjectiles: [], explosions: [], statusFlashes: [],
        rov: null, rovDestroyCount: 0,
        beamActive: false, gameOverPending: false, _gameEnded: false,
        backspaces: 0, cleanHits: 0,
        environmentalParticles: [], marineSnow: [], ambientFish: [],
        descent: { phase: 0, displayDepth: 0, motes: [], bubbles: [], wallScroll: 0 },
        comCall: null, comCallInterval: 0,
        timers: { spawnTimer: firstTier ? firstTier.spawnMin : 5500 },
        salvagePoints: 0, repairTokens: 0,
        miniSub: null, miniSubTimer: 0,
        latchedCreatures: [], isGrappling: false,
        gasSevered: false, liquidSevered: false, electricalSevered: false,
        suffocationTimer: 0,
        killCamActive: false, killCamPhase: 'none',
        killCamTimer: 0, killCamCreatureType: null, killCamProgress: 0,
        killCam: null,
        abyssDeathActive: false,
        coneAngle: firstTier ? (firstTier.coneAngle || CONFIG.baseConeAngle) : CONFIG.baseConeAngle,
        sweepAngle: 0,
        _lastSweepAngle: 0,
        rebuilding: false
    });
    state.usedChallenges.clear();
    cleanupAllSonarOverlays();
    // Clean up grapple state
    document.querySelectorAll('.adrenaline-focus').forEach(el => el.remove());
    const grapplePopup = document.getElementById('grapple-popup');
    if (grapplePopup) grapplePopup.classList.add('hidden');
    const wrapperEl = document.getElementById('canvas-wrapper');
    if (wrapperEl) wrapperEl.classList.remove('grapple-shake');

    setTier(firstTierKey);

    // Holodeck: start at selected depth if overrideTier is set
    if (holodeck && godMode.overrideTier && TIERS[godMode.overrideTier]) {
        const overrideTierData = TIERS[godMode.overrideTier];
        state.score = overrideTierData.min;
        state.tier = godMode.overrideTier;
        state.coneAngle = overrideTierData.coneAngle || CONFIG.baseConeAngle;
        setTier(godMode.overrideTier);
    }

    CONFIG.isHolodeck = holodeck;

    initHoses();
    clearHolodeck();
    hideBeta();

    updateHUD();
    AudioManager.disableMusicStatic();
    AudioManager.stopMusic();
    AudioManager.stopScene();   // tear down the menu/game-over soundscape on dive start

    DOM.startOverlay.classList.add('hidden');
    DOM.gameOverOverlay.classList.add('hidden');
    DOM.gameOverOverlay.classList.remove('game-over-bg');

    // Hide kill cam overlay
    const killOverlay = document.getElementById('kill-cam-overlay');
    if (killOverlay) killOverlay.classList.add('hidden');

    if (holodeck) {
        // Skip dive animation for holodeck
        triggerHolodeck(CONFIG.isBeta);
        if (CONFIG.isBeta) showBeta();
        _beginGameplay(holodeck);
    } else {
        // Scene 3 — fixed dive-launch sequence (hiss → airlock → air ejection →
        // bubbling drop-in), timed to run alongside the dive-entry animation.
        AudioManager.playLaunchSequence();
        // Play dive entry animation, then start gameplay
        playDiveEntry(() => {
            _beginGameplay(holodeck);
        });
    }
}

function _beginGameplay(holodeck) {
    if (state.running) return;   // idempotent — never start a second gameLoop chain (would run update/render at double rate)
    state.running = true;
    if (!holodeck) {
        AudioManager.startPlaylist(MUSIC.gameplay, MUSIC.volume);
    }
    try { AudioManager.startAmbient(); } catch (e) {}   // §9 depth pressure bed
    DOM.input.focus();
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function scheduleGameOver() {
    if (state.gameOverPending) return;
    state.gameOverPending = true;
    showStatus("ALL SYSTEMS FAILING — DIVER IN PERIL...", "impact");
    state.timers.gameOverDelay = setTimeout(() => {
        // This path is for when all hoses die but aquanaut hasn't been killed yet
        // The actual game over comes from the kill cam
        const aquanaut = getAquanaut();
        if (aquanaut && !aquanaut.destroyed) {
            // Force creatures to target aquanaut (handled in spawning logic)
        }
    }, 5000);
}

// How the dive ended — the game over screen tells the story
const DEATH_SCREENS = {
    abyss:        { title: 'CRUSHED BY THE DEEP',      sub: 'All three umbilicals severed. The helmet imploded on the way down.' },
    greatWhite:   { title: 'TAKEN BY THE GREAT WHITE', sub: 'It circled twice to be sure. The third pass was for keeps.' },
    moray:        { title: 'TAKEN BY THE MORAY',       sub: 'It struck from its crevice and clamped down. The glass gave way.' },
    boxJellyfish: { title: 'THE LONG EMBRACE',         sub: 'The tentacles wrapped the visor until the glass gave way.' },
    pufferfish:   { title: "THE FUGU'S GIFT",          sub: 'A dozen spines breached the glass. The toxin did the rest — you felt it take you, wide awake.' },
    default:      { title: 'DIVER LOST',               sub: 'All systems severed. No life signs detected.' }
};

function gameOver(reason) {
    if (state._gameEnded) return;   // idempotent — repeated calls must not rebuild/restart the game-over screen + audio
    state._gameEnded = true;
    AudioManager.disableMusicStatic();
    AudioManager.stopMusic();
    try { AudioManager.stopAmbient(); } catch (e) {}
    if (CONFIG.isHolodeck) {
        AudioManager.play('gameOver');        // holodeck is the digital theme — keep the synth voice
    } else {
        AudioManager.playScene('gameOver');   // layered WAV cue: sting → ominous bed + sparse groans
    }
    state.running = false;
    state.gameOverPending = false;
    clearTimeout(state.timers.gameOverDelay);
    DOM.finalScore.textContent = state.score;

    const death = DEATH_SCREENS[reason] || DEATH_SCREENS.default;
    const titleEl = document.getElementById('game-over-title');
    const subEl = document.getElementById('game-over-sub');
    if (titleEl) titleEl.textContent = death.title;
    if (subEl) subEl.textContent = death.sub;

    let existingScores = [];
    try {
        const raw = localStorage.getItem('aquanaut-scores');
        existingScores = raw ? JSON.parse(raw).slice(0, 10) : [];
    } catch { /* empty */ }
    const isTop10 = existingScores.length < 10 || state.score > (existingScores[existingScores.length - 1]?.score || 0);

    const stats = document.getElementById('final-stats');
    if (stats) {
        const tierData = TIERS[state.tier];
        stats.innerHTML = `
            <div>DEPTH: ${tierData ? tierData.label : state.tier.toUpperCase()}</div>
            <div>DEPTH REACHED: ${tierData ? tierData.depth + 'm' : 'UNKNOWN'}</div>
            <div>CLEAN PULSES: ${state.cleanHits}</div>
            <div>REPAIRS: ${state.repairCount}</div>
            ${CONFIG.isHolodeck ? '<div>MODE: SIMULATION</div>' : ''}
        `;
    }

    clearHolodeck();
    hideBeta();

    if (CONFIG.isHolodeck) {
        // Holodeck mode: show game over briefly, then return to holodeck menu
        if (DOM.input) DOM.input.blur();
        DOM.gameOverOverlay.classList.add('game-over-bg');
        DOM.gameOverOverlay.classList.remove('hidden');
        setTimeout(() => {
            DOM.gameOverOverlay.classList.add('hidden');
            DOM.gameOverOverlay.classList.remove('game-over-bg');
            DOM.startOverlay.classList.remove('hidden');
            DOM.startOverlay.classList.add('holodeck-menu-active');
            DOM.startOverlay.classList.remove('main-menu-bg');
            document.getElementById('normal-menu-buttons').classList.add('hidden');
            document.getElementById('holodeck-menu-buttons').classList.remove('hidden');
            document.getElementById('god-mode-menu').classList.remove('hidden');
            buildGodModeMenu();
        }, 4000);
        return;
    }

    const submitBtn = document.getElementById('submit-score-btn');
    const submitStatus = document.getElementById('score-submit-status');
    if (submitBtn) submitBtn.disabled = false;
    if (submitStatus) { submitStatus.textContent = ''; submitStatus.className = 'dataset-status'; }
    if (DOM.input) DOM.input.blur();
    DOM.gameOverOverlay.classList.add('game-over-bg');
    DOM.gameOverOverlay.classList.remove('hidden');
    // Default-highlight NEW DIVE so the menu opens with one option selected.
    // rAF lets the overlay become visible first (selection skips hidden buttons).
    if (state.selectDefaultMenuButton) {
        requestAnimationFrame(() => state.selectDefaultMenuButton('restart-btn'));
    }
    // (Game-over soundscape already started above via AudioManager.playScene('gameOver').)
}

// ============================================
// BOOT SEQUENCE (Dive Computer)
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const bootOverlay = document.getElementById('boot-overlay');
    const canvas = document.getElementById('boot-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    function startTitleScreenMusic() {
        AudioManager.playMusic(MUSIC.titleScreen, { loop: true, volume: MUSIC.volume });
    }

    const BOOT_LINES = [
        '*** KIRBY MORGAN DIVE COMPUTER v3.7 ***',
        '',
        '128K SYSTEM  CORE MEMORY CHECK . . . OK',
        '',
        'INITIALIZING LIFE SUPPORT...',
        'REGULATOR CHECK . . . OK',
        'COMMS LINE CHECK . . . OK',
        'HOT WATER SUPPLY . . . OK',
        'PNEUMO LINE . . . OK',
        'DEPTH SENSORS . . . CALIBRATING',
        'SONAR ARRAY . . . ONLINE',
        'HULL INTEGRITY . . . 100%',
        'CREATURE DETECTION GRID . . . ARMED',
        'HELMET CAM . . . ONLINE',
        'SALVAGE TELEMETRY LINK . . . OK',
        'ROV REPAIR PROTOCOL . . . STANDING BY',
        'BIOLUMINESCENT FILTER . . . CALIBRATED',
        'TETHER PHYSICS ENGINE . . . NOMINAL',
        'ALL SYSTEMS NOMINAL',
        'BEGINNING DESCENT...',
    ];
    const FONT_SIZE = Math.max(12, Math.min(16, Math.floor(canvas.height / 45)));
    const LINE_HEIGHT = FONT_SIZE + 4;
    const LEFT_PAD = 20;
    const START_Y = 20;
    const GREEN = '#33ff33';
    const DIM_GREEN = '#22cc22';
    const CORRUPT_CHARS = '\u2591\u2592\u2593\u2588\u2580\u2584\u258C\u2590\u25A0\u25A1\u25AA\u25AB\u25AC\u25B2\u25BA\u25BC\u25C4\u25CA\u25CB\u25CF\u25D8\u25D9\u2660\u2663\u2665\u2666\u263C\u263A\u263B\u266A\u266B\u2261\u00B1\u2265\u2264\u00AC\u00BD\u00BC\u00AB\u00BB';
    // Dark sonar palette — deep greens, blues and teals (no bright rainbow)
    const CORRUPT_COLORS = [
        '#0a3d2a', '#0d5c3a', '#127a4a', '#1a9c5e', '#23c46f',
        '#0a2a4d', '#0d3d6b', '#10568f', '#1a72b5', '#2390d6',
        '#0e6b5c', '#118f7a', '#14b39a', '#1ad1b0',
        '#08304a', '#0c4a3a', '#106b50'
    ];

    let bootLines = [];
    let bootIndex = 0;
    let descentPhase = false;
    let dataReady = false;
    let bootDone = false;

    let audioGestureCollected = false;

    function showInitPrompt() {
        const HEADER_LINES = [BOOT_LINES[0], BOOT_LINES[1], BOOT_LINES[2], BOOT_LINES[3]];
        const PROMPT_TEXT = 'PRESS ENTER TO INITIALIZE';
        let typedChars = 0;
        let typingDone = false;
        let blinkOn = true;
        let blinkInterval = null;

        function drawPrompt() {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.font = `bold ${FONT_SIZE}px Consolas, "Courier New", monospace`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';

            for (let i = 0; i < HEADER_LINES.length; i++) {
                ctx.fillStyle = GREEN;
                ctx.fillText(HEADER_LINES[i], LEFT_PAD, START_Y + i * LINE_HEIGHT);
            }

            ctx.fillStyle = GREEN;
            ctx.fillText('READY.', LEFT_PAD, START_Y + HEADER_LINES.length * LINE_HEIGHT);

            const promptY = START_Y + (HEADER_LINES.length + 1) * LINE_HEIGHT;
            const visibleText = PROMPT_TEXT.substring(0, typedChars);
            const showLine = typingDone ? blinkOn : true;
            if (showLine) {
                if (visibleText) {
                    ctx.fillStyle = GREEN;
                    ctx.fillText(visibleText, LEFT_PAD, promptY);
                }
                const cursorX = LEFT_PAD + ctx.measureText(visibleText).width + 2;
                ctx.fillStyle = GREEN;
                ctx.fillRect(cursorX, promptY, FONT_SIZE * 0.6, FONT_SIZE);
            }

            // Build stamp — confirms you are loading the current file (cinematic descent build)
            ctx.fillStyle = 'rgba(40, 200, 140, 0.85)';
            ctx.font = `bold ${Math.round(FONT_SIZE * 0.9)}px Consolas, "Courier New", monospace`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.fillText('BUILD 2026-06-10 — V2 ABYSSAL CUT', LEFT_PAD, canvas.height - 14);
            ctx.textBaseline = 'top';

            ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
            for (let sy = 0; sy < canvas.height; sy += 3) {
                ctx.fillRect(0, sy, canvas.width, 1);
            }
        }

        const typeInterval = setInterval(() => {
            if (typedChars < PROMPT_TEXT.length) {
                typedChars++;
                drawPrompt();
            } else {
                clearInterval(typeInterval);
                typingDone = true;
                blinkInterval = setInterval(() => { blinkOn = !blinkOn; drawPrompt(); }, 500);
            }
        }, 60);
        drawPrompt();

        function onInitGesture(e) {
            if (audioGestureCollected) return;
            if (e && e.type === 'keydown' && (e.ctrlKey || e.metaKey || e.altKey)) return;
            audioGestureCollected = true;
            clearInterval(typeInterval);
            clearInterval(blinkInterval);
            document.removeEventListener('keydown', onInitGesture);
            document.removeEventListener('click', onInitGesture);
            document.removeEventListener('touchstart', onInitGesture);

            AudioManager.init();

            bootLines = HEADER_LINES.slice();
            bootIndex = HEADER_LINES.length;

            bootRenderLoop();
            setTimeout(typeNextLine, 300);
        }

        document.addEventListener('keydown', onInitGesture);
        document.addEventListener('click', onInitGesture);
        document.addEventListener('touchstart', onInitGesture);
    }

    function revealTitleScreen() {
        startTitleScreenMusic();
        bootOverlay.style.transition = 'opacity 0.3s ease-out';
        bootOverlay.style.opacity = '0';
        setTimeout(() => {
            bootOverlay.classList.add('hidden');
            bootOverlay.style.opacity = '';
            bootOverlay.style.transition = '';
            bootDone = true;
            if (dataReady) init();
        }, 300);
    }

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

        if (bootLines.length > 0) {
            const lastLine = bootLines[bootLines.length - 1];
            const cursorX = LEFT_PAD + ctx.measureText(lastLine).width + 4;
            const cursorY = START_Y + (bootLines.length - 1) * LINE_HEIGHT;
            if (Math.floor(Date.now() / 400) % 2 === 0) {
                ctx.fillStyle = GREEN;
                ctx.fillRect(cursorX, cursorY, FONT_SIZE * 0.6, FONT_SIZE);
            }
        }

        ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
        for (let sy = 0; sy < canvas.height; sy += 3) {
            ctx.fillRect(0, sy, canvas.width, 1);
        }
    }

    // ============================================
    // DESCENT SEQUENCE STATE (cinematic dive)
    // ============================================
    let descentFrame = 0;
    const DESCENT_FRAMES = 120;   // ~2.0s at 60fps
    const TARGET_DEPTH = 312;     // metres shown on the depth gauge
    let marineSnow = [];          // particles that stream upward as we sink
    let sonarPings = [];          // expanding sonar ping rings (frame each was born)
    let descentSnowSeeded = false;

    // ============================================
    // CINEMATIC DESCENT — surface light fades, depth climbs, marine snow
    // streams upward and soft sonar pings expand as we sink to the abyss.
    // ============================================
    function drawDescent() {
        const p = descentFrame / DESCENT_FRAMES;             // 0 -> 1 overall
        const ease = 1 - Math.pow(1 - Math.min(1, p), 2);     // decelerate near the bottom
        const surf = 1 - ease;                                // 1 at surface, 0 in the deep
        const W = canvas.width, H = canvas.height;

        // Seed drifting marine snow once
        if (!descentSnowSeeded) {
            descentSnowSeeded = true;
            marineSnow = [];
            for (let i = 0; i < 90; i++) {
                marineSnow.push({
                    x: Math.random() * W,
                    y: Math.random() * H,
                    r: 0.4 + Math.random() * 1.8,
                    spd: 0.4 + Math.random() * 1.4,
                    a: 0.15 + Math.random() * 0.45
                });
            }
        }

        // --- Background: surface-blue at the top sinking to abyssal black ---
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, `rgb(${Math.round(10 + 24 * surf)}, ${Math.round(40 + 70 * surf)}, ${Math.round(60 + 80 * surf)})`);
        grad.addColorStop(0.5, `rgb(${Math.round(5 + 10 * surf)}, ${Math.round(20 + 34 * surf)}, ${Math.round(38 + 34 * surf)})`);
        grad.addColorStop(1, `rgb(1, ${Math.round(5 + 7 * surf)}, ${Math.round(10 + 10 * surf)})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // --- Surface light rays from above, shrinking and fading as we go deeper ---
        const rayAlpha = Math.max(0, 0.16 * (1 - ease * 1.25));
        if (rayAlpha > 0.005) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const rays = 5;
            for (let i = 0; i < rays; i++) {
                const bx = (i + 0.5) / rays * W + Math.sin(descentFrame * 0.012 + i) * 18;
                const topW = 26 + i * 5;
                const spread = 80 + i * 24;
                const len = H * (0.6 - ease * 0.45);
                const g2 = ctx.createLinearGradient(bx, 0, bx, len);
                g2.addColorStop(0, `rgba(120, 200, 220, ${rayAlpha})`);
                g2.addColorStop(1, 'rgba(120, 200, 220, 0)');
                ctx.fillStyle = g2;
                ctx.beginPath();
                ctx.moveTo(bx - topW / 2, 0);
                ctx.lineTo(bx + topW / 2, 0);
                ctx.lineTo(bx + spread / 2, len);
                ctx.lineTo(bx - spread / 2, len);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        }

        // --- Marine snow streaming upward (we are sinking past it) ---
        const flow = 1 + ease * 3;
        for (const s of marineSnow) {
            s.y -= s.spd * flow;
            if (s.y < -4) { s.y = H + 4; s.x = Math.random() * W; }
            ctx.fillStyle = `rgba(205, 230, 235, ${s.a * (0.45 + 0.55 * surf)})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Soft sonar pings: emitted periodically, expanding and fading ---
        if (descentFrame % 30 === 1) sonarPings.push(descentFrame);
        const cx = W / 2, cy = H / 2;
        for (const born of sonarPings) {
            const age = (descentFrame - born) / 58;
            if (age < 0 || age > 1) continue;
            ctx.strokeStyle = `rgba(0, 255, 65, ${(1 - age) * 0.22})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(cx, cy, age * Math.min(W, H) * 0.55, 0, Math.PI * 2);
            ctx.stroke();
        }
        sonarPings = sonarPings.filter(born => (descentFrame - born) / 58 <= 1);

        // --- HUD: DESCENDING + depth gauge climbing to the target ---
        const fin = Math.min(1, descentFrame / 8);
        const fout = p > 0.82 ? Math.max(0, 1 - (p - 0.82) / 0.18) : 1;
        const hud = fin * fout;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.globalAlpha = hud * 0.85;
        ctx.fillStyle = 'rgba(110, 255, 140, 1)';
        ctx.font = `bold ${Math.round(FONT_SIZE * 1.1)}px Consolas, "Courier New", monospace`;
        ctx.fillText('D E S C E N D I N G', cx, cy - FONT_SIZE * 2.6);

        ctx.globalAlpha = hud;
        ctx.fillStyle = 'rgba(140, 255, 160, 1)';
        ctx.font = `bold ${Math.round(FONT_SIZE * 2.6)}px Consolas, "Courier New", monospace`;
        ctx.fillText(`${Math.round(ease * TARGET_DEPTH)} m`, cx, cy);

        const barW = Math.min(W * 0.5, 360), barH = 6;
        const barX = cx - barW / 2, barY = cy + FONT_SIZE * 2.6;
        ctx.globalAlpha = hud * 0.4;
        ctx.fillStyle = 'rgba(25, 120, 55, 1)';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.globalAlpha = hud;
        ctx.fillStyle = 'rgba(70, 255, 110, 1)';
        ctx.fillRect(barX, barY, barW * ease, barH);
        ctx.globalAlpha = 1;

        // --- Brief dissolve from the loading text into the water ---
        if (descentFrame <= 10) {
            ctx.save();
            ctx.globalAlpha = (1 - descentFrame / 10) * 0.85;
            ctx.font = `bold ${FONT_SIZE}px Consolas, "Courier New", monospace`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillStyle = GREEN;
            for (let i = 0; i < bootLines.length; i++) {
                ctx.fillText(bootLines[i], LEFT_PAD, START_Y + i * LINE_HEIGHT);
            }
            ctx.restore();
        }

        // --- Final fade to abyssal black ---
        if (p > 0.82) {
            const f = (p - 0.82) / 0.18;
            ctx.fillStyle = `rgba(0, 1, 4, ${f * f})`;
            ctx.fillRect(0, 0, W, H);
        }

        // Faint CRT scanlines
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        for (let sy = 0; sy < H; sy += 3) ctx.fillRect(0, sy, W, 1);
    }

    // Short electronic blip as each boot line is printed (terminal teletype feel).
    // Routed through masterGain so the SFX mute + volume slider apply.
    function bootBlip() {
        const ac = AudioManager.ctx;
        if (!ac || AudioManager._sfxMuted) return;
        try {
            if (ac.state === 'suspended') ac.resume();
            const t = ac.currentTime;
            const g = ac.createGain();
            g.connect(AudioManager.masterGain || ac.destination);
            const o = ac.createOscillator();
            o.type = 'square';
            o.frequency.setValueAtTime(1250 + Math.random() * 350, t);
            o.connect(g);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(0.05, t + 0.004);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
            o.start(t);
            o.stop(t + 0.04);
        } catch (e) { /* ignore */ }
    }

    function typeNextLine() {
        if (bootIndex >= BOOT_LINES.length) {
            startDescent();
            return;
        }
        bootLines.push(BOOT_LINES[bootIndex]);
        bootIndex++;
        if (BOOT_LINES[bootIndex - 1] !== '') bootBlip();   // blip on each non-blank line

        let baseDelay;
        if (bootIndex <= 4) baseDelay = 220;
        else if (bootIndex <= 10) baseDelay = 150;
        else baseDelay = 110;

        setTimeout(typeNextLine, baseDelay + Math.random() * 60);
    }

    function startDescent() {
        descentPhase = true;
        descentFrame = 0;
        descentSnowSeeded = false;
        sonarPings = [];

        function descentTick() {
            descentFrame++;
            drawDescent();
            if (descentFrame < DESCENT_FRAMES) {
                // setTimeout fallback so the dive still completes in a background tab
                if (document.hidden) setTimeout(() => descentTick(), 16);
                else requestAnimationFrame(descentTick);
            } else {
                revealTitleScreen();
            }
        }
        descentTick();
    }

    function bootRenderLoop() {
        if (bootDone || descentPhase) return;
        drawBoot();
        requestAnimationFrame(bootRenderLoop);
    }

    // === DEV TESTING: skip boot + login, go straight to main menu ===
    const DEV_SKIP_BOOT = false; // ← Set to true to skip boot sequence for dev testing
    // ================================================================

    const cameFromLauncher = document.referrer.includes('Asteroid Command') ||
                              document.referrer.includes('Aquanaut') ||
                              window.location.search.includes('launched=1') ||
                              sessionStorage.getItem('bootDone') === '1';

    if (DEV_SKIP_BOOT) {
        // Skip boot sequence but show title screen
        audioGestureCollected = true;
        AudioManager.init();
        bootOverlay.classList.add('hidden');
        bootDone = true;
        revealTitleScreen();
    } else if (cameFromLauncher) {
        // The sonar-intro launcher already collected the audio gesture —
        // play the C64-style boot (typed system check + cinematic descent),
        // skipping only the PRESS ENTER gate.
        sessionStorage.removeItem('bootDone');
        audioGestureCollected = true;
        AudioManager.init();
        bootLines = [BOOT_LINES[0], BOOT_LINES[1], BOOT_LINES[2], BOOT_LINES[3]];
        bootIndex = 4;
        bootRenderLoop();
        setTimeout(typeNextLine, 300);
    } else {
        showInitPrompt();
    }

    loadGameData().then(() => {
        dataReady = true;
        if (bootDone && DEV_SKIP_BOOT) {
            // Skip boot but wait on title screen — init() runs, title screen stays
            init();
            return;
        }
        if (bootDone) init();
    }).catch(err => {
        console.error('Data load failed:', err);
        // Still proceed to menu even if CSVs fail (fallback data will be used)
        dataReady = true;
        if (bootDone && DEV_SKIP_BOOT) {
            init();
        } else if (bootDone) {
            init();
        }
    });
});


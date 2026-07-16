/* ============================================================================
 * PITSTOP (NEMS 500) — script.js  (cartridge integration / theme layer)
 * PowerLine Challenge cartridge · Phase 0 Scaffold · v0.1.0
 * ----------------------------------------------------------------------------
 * Phase 0 = SHELL ONLY. This wires: the screen state machine, the boot loader,
 * mode compliance (Demo default + Ctrl+Shift+B Developer Mode per Law §0.15),
 * navigation, and the placeholder renderers (region map, command reference,
 * race-options controls).
 *
 *   ⚠ NO GAMEPLAY. There is deliberately no leg loop, no impulse movement, no
 *   command validation wired to play, and no scoring. Those are [PHASE 1+ —
 *   GATED] pending the Overview clause (handoff §0). The command input stays
 *   disabled; data.js generate/validate stubs are never called.
 * ========================================================================= */

(function () {
  'use strict';

  const CFG  = window.PITSTOP_CONFIG || {};
  const CONFIG = CFG.CONFIG || {};
  const DATAMOD = window.PITSTOP_DATA || {};
  const AUDIO = window.AudioManager || { play: function () {}, init: function () {}, resume: function () {} };

  const SCREENS = ['bootScreen','titleScreen','menuScreen','instructionsScreen',
                   'optionsScreen','gridScreen','gameScreen','pitScreen','endScreen'];

  // ---- de-facto state (mode flags + nav), mirrors the PLC convention --------
  const state = {
    currentScreen: 'bootScreen',
    paused: false,
    devPromptActive: false,
    devUnlocked: false,
    selectedCourseId: CFG.DEFAULT_COURSE_ID || null,
    raceOptions: Object.assign({}, (CFG.RACE_OPTIONS && CFG.RACE_OPTIONS.defaults) || {})
  };

  // Phase 1 leg-loop state (route-traversal impulse model, authorized 2026-06-20).
  const T = CFG.TUNABLES || {};
  const SP = CFG.SPEED || {};                      // speed / WPM gauge model
  // WPM tracker for the command currently being typed (drives the boost size).
  const typing = { start: 0, lastWpm: 0 };
  const SHIFT = window.PITSTOP_SHIFT || null;      // Shift Change engine (core/shiftchange.js)
  const SC = CFG.SHIFT_CHANGE || {};
  let raceCoords = null;   // last gameplay-map coord map (set by renderMap('regionMap'))
  // Config readers. Written as functions with an explicit `!= null` check rather
  // than `SP.base || 25` because several of these values are legitimately ZERO —
  // SPEED.base is 0 now that the car rolls to a full stop, and `0 || 25` would
  // silently resurrect the old idle floor.
  function spCfg(key, dflt)   { return SP[key] != null ? SP[key] : dflt; }
  function tfCfg(key, dflt)   { const C = CFG.TRAFFIC || {}; return C[key] != null ? C[key] : dflt; }
  function tireCfg(key, dflt) { const C = CFG.TIRE || {};    return C[key] != null ? C[key] : dflt; }

  const race = { on: false, paused: false, leg: null, pos: 0, vel: 0,
                 last: 0, t0: 0, startTs: 0, raf: 0, unitId: null, fromId: null, toId: null,
                 // Multi-leg route traversal (Slice 2): drive every base of the course
                 // for `laps` laps, finishing at Start/Finish. `stops` = the ordered
                 // base ids of ONE lap (loops re-append the start); `legIndex` = which
                 // segment of that list we're driving; `lap` = 1..laps.
                 stops: [], legIndex: 0, lap: 1, laps: 1, shiftFired: false,
                 speed: 0, hold: 0, wpm: 0,   // speed/WPM gauge (km/h, 0..overflowMax); hold = decay-freeze secs
                 braking: false, brakeUntil: 0,   // backspace = brake pedal; brakeUntil is a nowMs() stamp
                 tireHealth: 10,                  // 0–10; mistakes wear it down (see damageTires)
                 hitBases: {},   // base ids reached this lap (light up on the minimap)
                 // Shift Change overlay state (design note §2/§3). armed = a change is
                 // due this leg; open = the box is up; cleared = it's been resolved.
                 shift: { armed: false, slot: null, box: null, open: false, cleared: false } };
  let shiftClockTimer = 0, shiftClockLast = 0;
  const road = { phase: 0, spd: -1, curve: 0, dist: 0, stopped: false };   // spd = --road-spd; curve = live bend (-1..1); dist = curve-gen travel
  const carSprite = { unitId: null, ready: false, frame: null, base: null };  // OutRun per-unit sprite state
  const traffic = { cars: [] };   // opponent cars circulating around the player (see TRAFFIC section)

  /* ---- Screen router ------------------------------------------------------ */
  function showScreen(id) {
    SCREENS.forEach(function (s) {
      const el = document.getElementById(s);
      if (el) el.classList.toggle('active', s === id);
    });
    state.currentScreen = id;
    if (id !== 'gameScreen') stopRace();
    if (id === 'gridScreen') renderMap('gridMap');
    if (id === 'gameScreen') { applyRaceLook(); renderRoad(); renderMap('regionMap'); startRace(); requestAnimationFrame(focusCommand); }
    focusPrimary(id);
  }

  // Keyboard support: land focus on the screen's primary button so Enter/Space
  // acts immediately and arrow keys have a starting point. The game screen focuses
  // the command input instead (handled in startLeg).
  function focusPrimary(id) {
    if (id === 'gameScreen') return;
    const screen = document.getElementById(id);
    if (!screen) return;
    const primary = screen.querySelector('.btn[data-primary]') ||
                    screen.querySelector('.btn:not(.danger):not(:disabled)') ||
                    screen.querySelector('.btn');
    if (primary) setTimeout(function () { primary.focus(); }, 40);
  }

  // Put the caret in the command box so the player can type the moment a race
  // begins — the cursor "defaults" into it. Also used to return focus there if the
  // player clicks the road/HUD mid-race. No-ops unless the game screen is live,
  // the input is enabled, and nothing is paused or overlaid.
  function focusCommand() {
    if (state.currentScreen !== 'gameScreen' || state.paused) return;
    if (document.querySelector('.overlay.active')) return;
    const input = document.getElementById('commandInput');
    if (input && !input.disabled) input.focus();
  }

  /* ---- Boot loader (animated; asset-load progress hook is stubbed) -------- */
  function runBoot() {
    const fill = document.getElementById('loaderFill');
    const pct  = document.getElementById('loaderPct');
    const status = document.getElementById('bootStatus');
    const msgs = ['SEARCHING FOR CASSETTE...', 'FOUND PITSTOP', 'LOADING TRACK DATA...', 'READY.'];
    let p = 0;
    AUDIO.play('boot');
    const t = setInterval(function () {
      p = Math.min(100, p + 4 + Math.random() * 6);
      if (fill) fill.style.width = p + '%';
      if (pct) pct.textContent = Math.floor(p) + '%';
      if (status) status.textContent = msgs[Math.min(msgs.length - 1, Math.floor(p / 26))];
      if (p >= 100) {
        clearInterval(t);
        setTimeout(function () { showScreen('titleScreen'); }, 450);
      }
    }, 90);
  }

  /* ---- Renderers (placeholder data → DOM) -------------------------------- */
  function renderCommandReference() {
    const body = document.getElementById('cmdRefBody');
    if (!body) return;
    const cmds = (DATAMOD.DATA && DATAMOD.DATA.commands) || [];
    // Group phrasings by command code.
    const byCode = {};
    cmds.forEach(function (c) {
      if (!byCode[c.command]) byCode[c.command] = { type: c.type, phrases: [] };
      byCode[c.command].phrases.push(c.challenge);
    });
    const meanings = { AP: 'Assign / Post to a base · needs the base code', ENP: 'Enroute — unit is mobile · no base code',
                       BSE: 'Based — unit has arrived · needs the base code', LA: 'Local area — operating nearby' };
    const order = ['AP','ENP','BSE','LA'];
    body.innerHTML = '';
    order.forEach(function (code) {
      if (!byCode[code]) return;
      const tr = document.createElement('tr');
      tr.innerHTML = '<td class="cmd-code">' + code + '</td>' +
        '<td>' + (meanings[code] || '') + '</td>' +
        '<td>' + byCode[code].type + '</td>' +
        '<td>' + byCode[code].phrases.join(', ') + '</td>';
      body.appendChild(tr);
      // BSEH — the "Home Start/Stop" arrival shortcut. Not a dataset phrasing;
      // it's the arrival cheat, so slot it in right after BSE.
      if (code === 'BSE') {
        const h = document.createElement('tr');
        h.innerHTML = '<td class="cmd-code">BSEH</td>' +
          '<td>Based Home — arrival shortcut, no base code needed</td>' +
          '<td>radio</td>' +
          '<td>Home Start/Stop</td>';
        body.appendChild(h);
      }
    });
  }

  function renderOptions() {
    const grid = document.getElementById('optionsGrid');
    if (!grid || !CFG.RACE_OPTIONS) return;
    grid.innerHTML = '';
    CFG.RACE_OPTIONS.schema.forEach(function (opt) {
      const row = document.createElement('div');
      row.className = 'opt-row' + (opt.dev ? ' opt-dev' : '');   // dev-flagged options render purple
      const label = document.createElement('label');
      label.textContent = opt.label;
      row.appendChild(label);

      // Unit picker — replaces the old Car dropdown. A row of chips, one per
      // SELECTABLE_UNIT, each tagged with its top-row number-key hotkey
      // (spread 1·3·5·7·9). Click a chip or press its number to pick. Each
      // chip's tint is a placeholder for the unit's future distinct car sprite.
      if (opt.control === 'unitpick') {
        row.classList.add('unit-row');
        const hint = document.createElement('div');
        hint.className = 'unit-hint';
        hint.textContent = 'press  1 · 3 · 5 · 7 · 9  (or click) — each unit is a different car';
        const pick = document.createElement('div');
        pick.className = 'unit-pick';
        (CFG.SELECTABLE_UNITS || []).forEach(function (u) {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'unit-chip' + (state.raceOptions.unit === u.id ? ' sel' : '');
          chip.setAttribute('data-unit', u.id);
          chip.setAttribute('data-hotkey', u.hotkey);
          chip.innerHTML =
            '<span class="chip-key">' + u.hotkey + '</span>' +
            '<span class="chip-car" style="--tint:' + u.tint + '"></span>' +
            '<span class="chip-id">' + u.id + '</span>';
          chip.addEventListener('click', function () { selectUnit(u.id); });
          pick.appendChild(chip);
        });
        const detail = document.createElement('div');
        detail.className = 'unit-detail';
        detail.id = 'unitDetail';
        row.appendChild(hint);
        row.appendChild(pick);
        row.appendChild(detail);
        grid.appendChild(row);
        renderUnitDetail(state.raceOptions.unit);   // fill the card for the current pick
        return;   // skip the generic <select>/<input> path
      }

      let ctrl;
      if (opt.type === 'int') {
        ctrl = document.createElement('input');
        ctrl.type = 'number';
        if (opt.min != null) ctrl.min = opt.min;
        if (opt.max != null) ctrl.max = opt.max;
        ctrl.value = state.raceOptions[opt.key];
      } else if (opt.key === 'courseSelect') {
        // Course list comes from the loaded courses + a Random option.
        ctrl = document.createElement('select');
        const courses = (DATAMOD.DATA && DATAMOD.DATA.courses) || [];
        courses.forEach(function (c) {
          const o = document.createElement('option');
          o.value = c.id; o.textContent = c.name + ' (' + c.baseIds.length + ')';
          ctrl.appendChild(o);
        });
        const rnd = document.createElement('option');
        rnd.value = 'random'; rnd.textContent = 'RANDOM (' + (CFG.COURSE_MAX_BASES || 5) + ')';
        ctrl.appendChild(rnd);
        ctrl.value = state.selectedCourseId || (courses[0] && courses[0].id) || 'random';
      } else {
        ctrl = document.createElement('select');
        (opt.values || []).forEach(function (v) {
          const o = document.createElement('option');
          o.value = v; o.textContent = String(v).toUpperCase();
          if (v === 'players') o.textContent = 'PLAYERS (DEFERRED)';
          ctrl.appendChild(o);
        });
        ctrl.value = state.raceOptions[opt.key];
      }
      // Selecting only stores to state — no race logic (Phase 0).
      ctrl.addEventListener('change', function () {
        if (opt.key === 'courseSelect') {
          state.selectedCourseId = ctrl.value;
          state.raceOptions.courseSelect = ctrl.value;
          renderMap('gridMap'); renderMap('regionMap'); renderLegends();
        } else {
          state.raceOptions[opt.key] = (opt.type === 'int') ? Number(ctrl.value) : ctrl.value;
        }
        AUDIO.play('select');
      });
      row.appendChild(ctrl);
      grid.appendChild(row);
    });
  }

  // Player picks which unit (truck) they drive — replaces the old Car option.
  // Called by a chip click and by the number-key hotkeys (1·3·5·7·9). Only
  // updates state + the chip highlight here; pickUnit() reads
  // state.raceOptions.unit when the race actually starts.
  function selectUnit(id) {
    const units = (CFG.SELECTABLE_UNITS || []);
    if (!units.some(function (u) { return u.id === id; })) return;
    state.raceOptions.unit = id;
    const chips = document.querySelectorAll('#optionsGrid .unit-chip');
    Array.prototype.forEach.call(chips, function (c) {
      c.classList.toggle('sel', c.getAttribute('data-unit') === id);
    });
    renderUnitDetail(id);            // refresh the car / stats / pros-cons card
    AUDIO.play('select');
  }

  // ---- Unit detail card (Race Options) --------------------------------------
  // Shows the picked unit's car art, class, one-line blurb, SPEED/CONTROL meters,
  // a telemetry-style performance curve and pros/cons, so a player can see WHY to
  // choose each unit. Rebuilt on every selectUnit() (chip click or number hotkey).
  function unitById(id) {
    const units = (CFG.SELECTABLE_UNITS || []);
    for (let i = 0; i < units.length; i++) if (units[i].id === id) return units[i];
    return units[0] || null;
  }

  // A technical "speed vs control" performance curve as inline SVG. The trace
  // RISES like an acceleration curve — steeper + higher = more SPEED — then takes
  // a recovery DIP partway: the deeper the dip, the LESS handling (a miss costs
  // more speed). So the shape encodes both stats AND the real miss mechanic.
  function telemetrySVG(u, tint) {
    const s = (u.stats && u.stats.speed) || 5, h = (u.stats && u.stats.handling) || 5;
    const sp = s / 10, hp = h / 10;
    const W = 300, H = 132, ML = 30, MR = 12, MT = 12, MB = 24;
    const pw = W - ML - MR, ph = H - MT - MB, base = MT + ph;
    const ceiling = 0.30 + 0.62 * sp;                 // top-speed plateau (fraction of ph)
    const riseK = 3 + 6 * sp;                          // how fast the trace climbs
    const x0 = 0.42, dw = 0.11, depth = ceiling * (1 - hp) * 0.72;  // the miss dip
    const N = 48, pts = [];
    let dipPx = ML, dipPy = base;
    for (let i = 0; i <= N; i++) {
      const x = i / N;
      const accel = ceiling * (1 - Math.exp(-riseK * x));
      const dip = depth * Math.exp(-Math.pow((x - x0) / dw, 2));
      const y = Math.max(0, accel - dip);
      const px = ML + x * pw, py = base - y * ph;
      pts.push(px.toFixed(1) + ' ' + py.toFixed(1));
      if (Math.abs(x - x0) <= 0.5 / N) { dipPx = px; dipPy = py; }
    }
    const line = 'M' + pts.join(' L');
    const area = line + ' L' + (ML + pw).toFixed(1) + ' ' + base + ' L' + ML + ' ' + base + ' Z';
    const ceilY = (base - ceiling * ph).toFixed(1);
    let grid = '';
    for (let g = 1; g < 4; g++) { const gx = (ML + g / 4 * pw).toFixed(1); grid += '<line x1="' + gx + '" y1="' + MT + '" x2="' + gx + '" y2="' + base + '" class="g-grid"/>'; }
    for (let g = 1; g < 3; g++) { const gy = (MT + g / 3 * ph).toFixed(1); grid += '<line x1="' + ML + '" y1="' + gy + '" x2="' + (ML + pw) + '" y2="' + gy + '" class="g-grid"/>'; }
    return '' +
      '<svg class="ud-graph" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + u.id + ' performance curve">' +
      '<rect x="' + ML + '" y="' + MT + '" width="' + pw + '" height="' + ph + '" class="g-frame"/>' + grid +
      '<line x1="' + ML + '" y1="' + ceilY + '" x2="' + (ML + pw) + '" y2="' + ceilY + '" class="g-ceil"/>' +
      '<path d="' + area + '" class="g-area" style="fill:' + tint + '"/>' +
      '<path d="' + line + '" class="g-line" style="stroke:' + tint + ';color:' + tint + '"/>' +
      '<circle cx="' + dipPx.toFixed(1) + '" cy="' + dipPy.toFixed(1) + '" r="3" class="g-dip"/>' +
      '<text x="' + ML + '" y="' + (MT - 3) + '" class="g-lab">SPEED</text>' +
      '<text x="' + (ML + pw) + '" y="' + (H - 6) + '" class="g-lab" text-anchor="end">LEG DISTANCE ▸</text>' +
      '<text x="' + Math.min(ML + pw - 2, dipPx + 5).toFixed(1) + '" y="' + (dipPy - 6).toFixed(1) + '" class="g-lab g-miss">MISS</text>' +
      '</svg>';
  }

  function meterHTML(label, val) {
    const pct = Math.max(0, Math.min(10, val)) * 10;
    return '<div class="ud-meter"><span class="m-lab">' + label + '</span>' +
      '<span class="m-bar"><span class="m-fill" style="width:' + pct + '%"></span></span>' +
      '<span class="m-val">' + val + '<i>/10</i></span></div>';
  }
  function listHTML(items, cls) {
    return '<ul class="' + cls + '">' + (items || []).map(function (t) {
      return '<li><span class="mk"></span>' + t + '</li>';
    }).join('') + '</ul>';
  }

  function renderUnitDetail(id) {
    const box = document.getElementById('unitDetail');
    if (!box) return;
    const u = unitById(id);
    if (!u) { box.innerHTML = ''; return; }
    const tint = u.tint || '#39ff14';
    const s = (u.stats && u.stats.speed) || 5, h = (u.stats && u.stats.handling) || 5;
    const carSrc = (CFG.CARS && CFG.CARS.path ? CFG.CARS.path : 'assets/cars/') + u.id + '_c.png';
    box.style.setProperty('--tint', tint);
    box.innerHTML = '' +
      '<div class="ud-left">' +
        '<div class="ud-car">' +
          '<span class="ud-badge">' + u.id + '</span>' +
          '<img class="ud-img" src="' + carSrc + '" alt="Unit ' + u.id + ' car" ' +
               'onerror="this.remove();this.closest(\'.ud-car\').classList.add(\'no-art\');">' +
        '</div>' +
        '<div class="ud-meters">' + meterHTML('SPEED', s) + meterHTML('CONTROL', h) + '</div>' +
      '</div>' +
      '<div class="ud-right">' +
        '<div class="ud-head"><span class="ud-id">UNIT ' + u.id + '</span>' +
          '<span class="ud-cls">' + (u.cls || '') + '</span></div>' +
        '<p class="ud-blurb">' + (u.blurb || '') + '</p>' +
        telemetrySVG(u, tint) +
        '<div class="ud-lists">' +
          '<div class="ud-col"><h4 class="ud-h ok">STRENGTHS</h4>' + listHTML(u.pros, 'ud-pros') + '</div>' +
          '<div class="ud-col"><h4 class="ud-h no">WEAKNESSES</h4>' + listHTML(u.cons, 'ud-cons') + '</div>' +
        '</div>' +
      '</div>';
  }

  // Draw the active COURSE into an <svg>: only the course's bases (≤5), the
  // route line in drive order, a hard START/FINISH (checkered), and numbered
  // stops. Bases not on the course are NOT shown. Static — no gameplay.
  function activeCourse() {
    return DATAMOD.getActiveCourse ? DATAMOD.getActiveCourse(state.selectedCourseId) : null;
  }

  // Fit a course's bases (by lat/lon) to FILL the W×H box on both axes so the
  // route uses the whole field, regardless of area. Cosine-corrected (real
  // proportions), north-up. Each axis stretches to fill, but the stretch is
  // capped (DISTORT_CAP) so an elongated course never gets grotesquely warped —
  // beyond the cap that axis just centers with a margin. Returns { id:{x,y} }.
  const DISTORT_CAP = 1.6;
  function fitCourseToBox(bases, W, H, pad) {
    const out = {};
    const geo = bases.filter(function (b) { return b.lat != null && b.lon != null; });
    if (!geo.length) return out;
    const meanLat = geo.reduce(function (s, b) { return s + b.lat; }, 0) / geo.length;
    const k = Math.cos(meanLat * Math.PI / 180);
    const px = function (b) { return b.lon * k; }, py = function (b) { return b.lat; };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    geo.forEach(function (b) {
      minX = Math.min(minX, px(b)); maxX = Math.max(maxX, px(b));
      minY = Math.min(minY, py(b)); maxY = Math.max(maxY, py(b));
    });
    const spanX = maxX - minX, spanY = maxY - minY, eps = 1e-9;
    const availW = W - 2 * pad, availH = H - 2 * pad;
    let sX = spanX > eps ? availW / spanX : null;   // px per unit to fill X
    let sY = spanY > eps ? availH / spanY : null;   // px per unit to fill Y
    if (sX != null && sY != null) {                 // cap relative distortion
      if (sX > sY * DISTORT_CAP) sX = sY * DISTORT_CAP;
      if (sY > sX * DISTORT_CAP) sY = sX * DISTORT_CAP;
    } else if (sX == null && sY != null) { sX = sY; }
    else if (sY == null && sX != null) { sY = sX; }
    const drawW = sX != null ? spanX * sX : 0, drawH = sY != null ? spanY * sY : 0;
    const offX = pad + (availW - drawW) / 2, offY = pad + (availH - drawH) / 2;
    const seen = {};
    geo.forEach(function (b) {
      let x = sX == null ? W / 2 : offX + (px(b) - minX) * sX;
      let y = sY == null ? H / 2 : offY + (maxY - py(b)) * sY;       // flip (north up)
      const key = Math.round(x) + ',' + Math.round(y);
      const n = seen[key] || 0; seen[key] = n + 1;
      if (n > 0) { const a = n * 1.7, d = Math.min(W, H) * 0.03; x += Math.cos(a) * d; y += Math.sin(a) * d; }
      out[b.id] = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    });
    return out;
  }

  function renderMap(svgId) {
    const svg = document.getElementById(svgId);
    if (!svg) return;
    const D = DATAMOD.DATA;
    const course = activeCourse();
    if (!D || !course) { svg.innerHTML = ''; return; }
    const bases = course.baseIds.map(function (id) { return D.baseById[id]; }).filter(Boolean);
    if (!bases.length) { svg.innerHTML = ''; return; }
    const pitId = CFG.PIT_BASE_ID || '72123';
    const pit = D.baseById[pitId];
    const pitOnCourse = course.baseIds.indexOf(pitId) !== -1;

    // viewBox = the container's real pixel size, so the SVG fills the field
    // with no letterboxing. Re-measured every render (handles resize).
    const W = Math.round(svg.clientWidth) || 100;
    const H = Math.round(svg.clientHeight) || 80;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    const unit = Math.min(W, H);
    const pad = unit * 0.12;

    // Fit the course PLUS the off-route pit (so the pit is placed correctly) to
    // fill the field, regardless of area. When a real geo-referenced map image
    // lands (REGION_MAP.image+bounds) we'd align dots to the art instead.
    const fitBases = bases.slice();
    if (pit && !pitOnCourse) fitBases.push(pit);
    const C = fitCourseToBox(fitBases, W, H, pad);

    const nodeR = unit * 0.022, ringR = unit * 0.040, sfR = unit * 0.028, pitR = unit * 0.028;
    const font = unit * 0.032, stroke = Math.max(1, unit * 0.006), chk = unit * 0.018;
    const pid = 'sfChecker_' + svgId;

    let html = '<defs><pattern id="' + pid + '" width="' + (chk * 2) + '" height="' + (chk * 2) +
      '" patternUnits="userSpaceOnUse">' +
      '<rect width="' + (chk * 2) + '" height="' + (chk * 2) + '" fill="#f4fff0"/>' +
      '<rect width="' + chk + '" height="' + chk + '" fill="#0a0a0a"/>' +
      '<rect x="' + chk + '" y="' + chk + '" width="' + chk + '" height="' + chk + '" fill="#0a0a0a"/></pattern></defs>';

    // pit LANE: Fleet reads as a lane that SPLITS off the main course and
    // REJOINS it (a bypass bowing out to the pit), not a dead-end spur. Branch
    // + merge points sit on the route segments either side of the junction (the
    // nearest on-route base to the pit); the lane's midpoint passes through
    // Fleet so the ⛽ box sits right on the lane.
    let junction = null;
    if (pit && !pitOnCourse && C[pitId]) {
      // The pit lane branches off around the START/FINISH base (Andrew's call) —
      // the pit sits by the start line, splitting off and rejoining there.
      junction = D.baseById[course.startId] || bases[0];
      if (junction && C[junction.id]) {
        const J = C[junction.id], F = C[pitId];
        const order = course.baseIds, n = order.length, idx = order.indexOf(junction.id);
        const isLoop = course.type === 'loop' && n > 2;
        const prev = (idx > 0) ? C[order[idx - 1]] : (isLoop ? C[order[n - 1]] : null);
        const next = (idx < n - 1) ? C[order[idx + 1]] : (isLoop ? C[order[0]] : null);
        const lerp = function (a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; };
        // Split just before the junction, merge just after it. When a neighbour
        // is missing (a point-to-point endpoint), fall back to a short offset
        // toward the pit so the lane still leaves and returns near the junction.
        const split = prev ? lerp(prev, J, 0.6) : lerp(J, F, 0.18);
        const merge = next ? lerp(J, next, 0.4) : lerp(J, F, 0.32);
        const segMid = { x: (split.x + merge.x) / 2, y: (split.y + merge.y) / 2 };
        // Both control points sit beyond Fleet (k = 4/3) so the cubic's midpoint
        // lands exactly on F — the lane visibly wraps out to the pit and back.
        const cx = segMid.x + (F.x - segMid.x) * (4 / 3);
        const cy = segMid.y + (F.y - segMid.y) * (4 / 3);
        const d = 'M ' + split.x.toFixed(1) + ' ' + split.y.toFixed(1) +
                  ' C ' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + cx.toFixed(1) + ' ' + cy.toFixed(1) +
                  ' ' + merge.x.toFixed(1) + ' ' + merge.y.toFixed(1);
        html += '<path class="map-spur" d="' + d + '" style="stroke-width:' + (stroke * 0.9) + '"/>';
      }
    }

    // route line (drive order); closed for a loop, open for point-to-point
    const coords = course.baseIds.map(function (id) { return C[id] ? (C[id].x + ',' + C[id].y) : null; }).filter(Boolean);
    if (course.type === 'loop' && coords.length > 2) {
      html += '<polygon class="map-route" points="' + coords.join(' ') + '" style="stroke-width:' + stroke + '" />';
    } else {
      html += '<polyline class="map-route" points="' + coords.join(' ') + '" style="stroke-width:' + stroke + '" />';
    }

    // nodes: start = checkered flag; other stops numbered in drive order. On the
    // gameplay minimap (compact) the MAP IS THE CHALLENGE: the base we're at / just
    // left glows one colour (from), the base we're driving to glows another (next),
    // and the rest share a dim colour. Full grid map keeps labels + numbers.
    const compact = (svgId === 'regionMap');
    const liveFrom = compact && race.on ? race.fromId : null;
    const liveTo   = compact && race.on ? race.toId   : null;
    let stop = 0;
    bases.forEach(function (b) {
      const p = C[b.id]; if (!p) return;
      const isStart = b.id === course.startId;
      const isPit = b.id === pitId;
      const live = (b.id === liveTo) ? 'next' : (b.id === liveFrom) ? 'from'
                 : (compact && race.hitBases && race.hitBases[b.id]) ? 'hit' : '';
      const big = (live === 'next' || live === 'from');
      if (isStart) {
        html += '<circle class="sf-ring' + (live ? ' ' + live : '') + '" cx="' + p.x + '" cy="' + p.y + '" r="' + (big ? ringR * 1.15 : ringR) + '" style="stroke-width:' + stroke + '"/>';
        html += '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + sfR + '" fill="url(#' + pid + ')" stroke="#f4fff0" stroke-width="' + (stroke * 0.6) + '"/>';
      } else {
        stop += 1;
        html += '<circle class="map-node' + (isPit ? ' pit' : '') + (live ? ' ' + live : '') + '" cx="' + p.x + '" cy="' + p.y + '" r="' + (big ? nodeR * 1.3 : nodeR) + '" style="stroke-width:' + (stroke * 0.5) + '"/>';
        if (!compact) html += '<text class="node-num" x="' + p.x + '" y="' + (p.y + font * 0.35) + '" text-anchor="middle" style="font-size:' + font + 'px">' + stop + '</text>';
      }
      if (!compact) {
        const tag = isStart ? ' — START / FINISH' : '';
        html += '<text class="map-base-label" x="' + (p.x + nodeR + font * 0.3) + '" y="' + (p.y + font * 0.35) + '" style="font-size:' + font + 'px">' +
                b.name + (isPit ? ' ⛽ PIT' : '') + tag + '</text>';
      }
    });

    // off-route pit marker (Fleet) — always shown even though it's not a stop
    if (pit && !pitOnCourse && C[pitId]) {
      const pp = C[pitId];
      html += '<circle class="map-pit" cx="' + pp.x + '" cy="' + pp.y + '" r="' + pitR + '" style="stroke-width:' + (stroke * 0.6) + '"/>';
      if (!compact) html += '<text class="map-base-label pit-label" x="' + (pp.x + pitR + font * 0.3) + '" y="' + (pp.y + font * 0.35) + '" style="font-size:' + font + 'px">' +
              pit.name + ' ⛽ PIT</text>';
    }

    // Gameplay map: stash coords + drop the player's unit marker at the start.
    if (svgId === 'regionMap') {
      raceCoords = C;
      const s0 = C[course.startId];
      if (s0) html += '<circle class="map-unit" id="unitMarker" cx="' + s0.x + '" cy="' + s0.y + '" r="' + (nodeR * 1.15) + '" />';
    }

    svg.innerHTML = html;
  }

  // Legend so every symbol on the map has a meaning.
  function renderLegends() {
    const D = DATAMOD.DATA;
    const hasPit = !!(D && D.baseById && D.baseById[CFG.PIT_BASE_ID || '72123']);
    const html =
      '<span class="lg"><span class="sw sw-sf"></span>Start / Finish</span>' +
      '<span class="lg"><span class="sw sw-node">1</span>Course stop (drive order)</span>' +
      '<span class="lg"><span class="sw sw-route"></span>Race route</span>' +
      (hasPit ? '<span class="lg"><span class="sw sw-pit">⛽</span>Pit lane — Fleet (splits &amp; rejoins)</span>' : '');
    ['gridLegend', 'gameLegend'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    });
  }

  /* ---- Road POV (main play surface) — CSS perspective road ----------------
   * The design (Pitstop Arcade.dc.html §02) renders the road as CSS layers
   * (sky / sun / clouds / asphalt trapezoid / rumble strips / centre line /
   * chevrons / flying scenery / passing sign / the car), animated via keyframes
   * in style.css. Their scroll speed is scaled by the --road-spd custom property
   * on #roadView, which we set from race.speed so the world flows faster the
   * faster you're going. The old procedural SVG road is retired (#roadSvg gone).
   * A future looping road IMAGE can still swap in via CFG.ROAD_VIEW.image. */
  function setRoadSign(text) {
    const el = document.getElementById('roadSignText');
    if (el) el.textContent = text || '';
  }
  function setCarUnit(id) {
    const el = document.getElementById('carUnit');
    if (el) el.textContent = id || '—';
  }
  // Speed → animation-duration multiplier: faster speed → smaller multiplier →
  // quicker scroll. Quantized to 0.05 so we only poke the CSS var when it
  // meaningfully changes (updating animation-duration every frame would churn).
  function roadSpeedMult() {
    const max = spCfg('max', 200);
    const eff = Math.max(0, Math.min(max, race.speed));
    const m = Math.max(0.45, Math.min(1.5, 1.5 - (eff / max) * 1.05));   // 1.5 crawling → 0.45 flat out
    return Math.round(m * 20) / 20;
  }
  function applyRoadSpeed() {
    const rv = document.getElementById('roadView');
    if (!rv) return;
    const m = roadSpeedMult();
    if (m !== road.spd) { road.spd = m; rv.style.setProperty('--road-spd', String(m)); }
    // Rolled to a stop: freeze the scroll outright. --road-spd can only ever SLOW
    // the animations down — it can't reach zero — so the world would keep creeping
    // past a parked car without this.
    const stopped = race.speed < 1;
    if (stopped !== road.stopped) { road.stopped = stopped; rv.classList.toggle('stopped', stopped); }
  }

  /* ---- OutRun curve engine (Andrew, 2026-07-15) ---------------------------
   * The road bends as you travel and the car banks into it. curveAt() shapes a
   * smooth summed-sine bend from cumulative travel; updateRoad eases the live
   * curve toward it, pushes it to CSS (--road-curve), and steers the car. The
   * car uses real PNG frames when a unit's sprites load, else the div-car
   * fake-leans (Pitstop_Car_Sprite_Brief.md). */
  function curveAt(d) {
    const A = CFG.ROAD_CURVE || {};
    const a1 = A.amp1 != null ? A.amp1 : 0.7, f1 = A.freq1 != null ? A.freq1 : 0.9;
    const a2 = A.amp2 != null ? A.amp2 : 0.3, f2 = A.freq2 != null ? A.freq2 : 2.3;
    const v = a1 * Math.sin(d * f1) + a2 * Math.sin(d * f2 + 1.3);
    return Math.max(-1, Math.min(1, v));
  }
  // Try to load a unit's 3 sprite frames; if all resolve, switch the car to
  // sprite mode. On any 404 we stay in placeholder mode (div-car). No flag flip.
  function ensureCarSprites(unitId) {
    const CARS = CFG.CARS || {};
    if (!CARS.enabled || !unitId || carSprite.unitId === unitId) return;
    carSprite.unitId = unitId; carSprite.ready = false; carSprite.frame = null;
    const car = document.getElementById('raceCar');
    if (car) car.classList.remove('sprite-mode');
    const base = (CARS.path || 'assets/cars/') + unitId + '_';
    const frames = ['c', 'r1', 'r2'];
    let loaded = 0, failed = false;
    frames.forEach(function (f) {
      const img = new Image();
      img.onload = function () {
        if (failed || carSprite.unitId !== unitId) return;
        if (++loaded === frames.length) { carSprite.ready = true; carSprite.base = base; enterSpriteMode(); }
      };
      img.onerror = function () { failed = true; };   // unit has no art yet → placeholder stays
      img.src = base + f + '.png';
    });
  }
  function enterSpriteMode() {
    const car = document.getElementById('raceCar');
    if (!car) return;
    car.classList.add('sprite-mode');
    setCarFrame('c', 1);
  }
  function setCarFrame(frame, dir) {
    const car = document.getElementById('raceCar');
    if (!car || !carSprite.ready) return;
    if (carSprite.frame !== frame) {
      carSprite.frame = frame;
      car.style.setProperty('--car-frame', 'url("' + carSprite.base + frame + '.png")');
    }
    car.style.setProperty('--car-mirror', String(dir));
  }
  // Steer the car from the live curve: sprite mode picks a frame + mirror (the
  // frame carries the lean); placeholder mode fakes the lean with a rotation.
  function applyCarSteer(curve) {
    const car = document.getElementById('raceCar');
    if (!car) return;
    const A = CFG.ROAD_CURVE || {};
    const steer = Math.max(-1, Math.min(1, curve || 0));
    car.style.setProperty('--car-steer', steer.toFixed(3));
    if (carSprite.ready) {
      const mag = Math.abs(steer), th = A.frameThresholds || [0.18, 0.5];
      setCarFrame(mag < th[0] ? 'c' : (mag < th[1] ? 'r1' : 'r2'), steer < 0 ? -1 : 1);
      car.style.setProperty('--car-lean', '0');
    } else {
      car.style.setProperty('--car-mirror', '1');
      car.style.setProperty('--car-lean', (steer * (A.placeholderLeanDeg != null ? A.placeholderLeanDeg : 8)).toFixed(2));
    }
  }
  function renderRoad() { setCarUnit(race.unitId); ensureCarSprites(race.unitId); applyRoadSpeed(); applyCarSteer(road.curve); }
  // RACE LOOK skin — swap the road scene between the dark green-phosphor CRT
  // (default) and the sunny OutRun palette (design §1a). Purely a class toggle on
  // #roadView; the curve engine (--road-curve) and speed reactivity (--road-spd)
  // are palette-independent, so bending + car banking keep working under both.
  function applyRaceLook() {
    const rv = document.getElementById('roadView');
    if (!rv) return;
    const look = (state.raceOptions && state.raceOptions.raceLook) || 'dark';
    rv.classList.toggle('look-outrun', look === 'outrun');
  }
  function updateRoad(dt, v) {
    applyRoadSpeed();
    const A = CFG.ROAD_CURVE || {};
    road.dist += (v || 0) * dt * (A.rate != null ? A.rate : 6);
    const target = curveAt(road.dist);
    road.curve += (target - road.curve) * Math.min(1, dt * (A.ease != null ? A.ease : 3));
    const rv = document.getElementById('roadView');
    if (rv) rv.style.setProperty('--road-curve', road.curve.toFixed(3));
    applyCarSteer(road.curve);
  }

  /* ===================== TRAFFIC — opponent cars (Andrew, 2026-07-16) ========
   * A field of other roster units circulates around the player on the same
   * pseudo-3D road as the scenery, and you either pass them or they pass you.
   *
   * Each car's whole position is ONE number: z = metres ahead of the player. Its
   * rate of change is just the speed DIFFERENCE, so passing falls out of the
   * existing speed model for free — out-type the field and you carve through it;
   * stop typing and the field files past you. Every car holds its own pace,
   * sampled per car and clamped to TRAFFIC.maxKph, so they never all run together.
   * Cars are only ever drawn from BEHIND, which is correct in both directions: one
   * you're catching grows from the horizon, one catching YOU swells up from the
   * bottom edge and shrinks away toward it.
   *
   * tfProject() must stay in step with the CSS road (style.css .rv-road): the
   * trapezoid spans 44%..56% of the width at the horizon (44% down the view) and
   * 18%..82% at the camera, and the whole thing is skewX'd about its bottom centre
   * by --road-curve * -9deg. Reproducing that skew here is what keeps the cars on
   * the tarmac through a bend instead of floating off the outside of it. */
  const OPP_W = 104, OPP_H = 70;   // opponent element box (px at scale 1 ≈ the player car's on-screen size)
  const OPP_SKEW_DEG = 9;          // MUST match the skewX factor on .rv-road
  const OPP_TINTS = ['#ff6b3d', '#4dd2ff', '#f7e14a', '#b06bff', '#5cff9d', '#ff5c8a', '#8fa4b8'];

  // The field = other real roster trucks, never the unit you're driving.
  function opponentIds() {
    const all = (DATAMOD.DATA && DATAMOD.DATA.units) || [];
    const mine = race.unitId;
    const trucks = all.filter(function (id) { return /^\d+$/.test(id) && id !== mine; });
    if (trucks.length) return shuffled(trucks);
    return (CFG.SELECTABLE_UNITS || []).map(function (u) { return u.id; })
      .filter(function (id) { return id !== mine; });
  }
  function shuffled(a) {
    const out = a.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1)), t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }
  // A rival keeps a selectable unit's tint if it has one, else takes a stable
  // colour off the palette so the same truck is the same colour all race.
  function oppTint(id) {
    const t = unitTint(id);
    if (t) return t;
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return OPP_TINTS[h % OPP_TINTS.length];
  }

  function makeOppEl(car) {
    const el = document.createElement('div');
    el.className = 'opp-car';
    el.style.width = OPP_W + 'px';
    el.style.height = OPP_H + 'px';
    el.style.setProperty('--opp-tint', oppTint(car.id));
    el.innerHTML =
      '<div class="oc-shadow"></div>' +
      '<div class="oc-tire left"></div><div class="oc-tire right"></div>' +
      '<div class="oc-body"></div><div class="oc-roof"></div>' +
      '<div class="oc-lamp left"></div><div class="oc-lamp right"></div>' +
      '<div class="oc-wing"></div>' +
      '<div class="oc-num">' + car.id + '</div>';
    return el;
  }

  // Re-roll a car's pace + lane and drop it back into the field at `z`. Sampling
  // uniformly across avg ± spread and clamping to [min, max] is what makes the
  // field average avgKph while guaranteeing nobody ever tops maxKph.
  function respawnOpp(car, z) {
    car.z = z;
    car.near = false;
    const avg = tfCfg('avgKph', 125), spread = tfCfg('spreadKph', 50);
    car.kph = Math.max(tfCfg('minKph', 70),
              Math.min(tfCfg('maxKph', 175), avg + (Math.random() * 2 - 1) * spread));
    const lanes = tfCfg('lanes', [-0.58, -0.34, 0.34, 0.58]);
    car.lane = lanes[Math.floor(Math.random() * lanes.length)];
    if (car.el) car.el.classList.remove('near', 'bumped');
  }

  function clearTraffic() {
    traffic.cars.forEach(function (c) { if (c.el && c.el.parentNode) c.el.parentNode.removeChild(c.el); });
    traffic.cars.length = 0;
  }

  function buildTraffic() {
    clearTraffic();
    const wrap = document.getElementById('rvTraffic');
    if (!wrap || !tfCfg('enabled', true)) return;
    wrap.innerHTML = '';
    const pool = opponentIds();
    if (!pool.length) return;
    const n = Math.min(tfCfg('count', 5), pool.length);
    const zFar = tfCfg('zFar', 260), first = tfCfg('passZ', 12) * 2;
    for (let i = 0; i < n; i++) {
      const car = { id: pool[i], z: 0, lane: 0, kph: 0, near: false, el: null };
      car.el = makeOppEl(car);
      wrap.appendChild(car.el);
      // Everyone starts AHEAD of the standing start, spread up the road. They're
      // all quicker than a parked car, so the field pulls away, recycles behind and
      // comes back past you — which is also why nothing starts inside the pass
      // window and fires a phantom "PASSED" on lap one.
      respawnOpp(car, first + (i + 0.5) / n * (zFar - first));
      traffic.cars.push(car);
    }
  }

  // Project a car's z onto the CSS road. Returns null when it's out of the draw
  // range. `shift` is tan(curve * 9°) — the road's skew, precomputed per frame.
  function tfProject(z, lane, W, H, shift) {
    if (z > tfCfg('zFar', 260) || z < tfCfg('zHide', -6)) return null;
    const cam = tfCfg('camDepth', 24);
    const k = cam / (cam + z);                       // on-screen scale; 1 = level with the player
    const y = H * (0.44 + 0.56 * k);                 // ground contact — matches .rv-road's trapezoid
    const halfW = (0.06 + 0.26 * k) * W;             // road half-width at this depth
    const x = W * 0.5 + lane * halfW + (H - y) * shift;
    return { k: k, x: x, y: y };
  }

  function drawOpp(car, W, H, shift) {
    const p = tfProject(car.z, car.lane, W, H, shift);
    if (!p) { car.el.style.display = 'none'; return; }
    car.el.style.display = '';
    car.el.style.transform = 'translate(' + (p.x - OPP_W / 2).toFixed(1) + 'px,' +
      (p.y - OPP_H).toFixed(1) + 'px) scale(' + p.k.toFixed(4) + ')';
    car.el.style.opacity = p.k < 0.14 ? (p.k / 0.14).toFixed(2) : '1';   // fade in at the horizon
    car.el.style.zIndex = String(Math.round(Math.min(p.k, 1) * 100));    // nearer cars draw over farther ones
  }

  function updateTraffic(dt, playerKph) {
    if (!traffic.cars.length) return;
    const rv = document.getElementById('roadView');
    if (!rv) return;
    const W = rv.clientWidth, H = rv.clientHeight;
    if (!W || !H) return;
    const zFar = tfCfg('zFar', 260), zBehind = tfCfg('zBehind', -40), passZ = tfCfg('passZ', 12);
    const shift = Math.tan(road.curve * OPP_SKEW_DEG * Math.PI / 180);
    traffic.cars.forEach(function (car) {
      car.z += (car.kph - playerKph) / 3.6 * dt;          // dz/dt IS the speed difference (m/s)
      if (car.z > zFar) respawnOpp(car, zBehind);         // it out-ran the draw range
      else if (car.z < zBehind) respawnOpp(car, zFar);    // you dropped it
      const near = Math.abs(car.z) <= passZ;
      // Leaving the pass window is the moment a pass COMPLETES: z<0 means the car
      // is behind you now (you got by), z>0 means it's ahead (it got by you).
      if (car.near && !near) flashPass(car.z < 0 ? '▸ PASSED ' + car.id : '◂ ' + car.id + ' WENT BY', 'pass');
      car.near = near;
      car.el.classList.toggle('near', near);
      drawOpp(car, W, H, shift);
    });
  }

  // A typo taken wheel-to-wheel = contact. The closest car in the pass window gets
  // clouted: the whole view jolts, it gets shoved off its line, and the rubber pays
  // for it (bumpDamage, on top of the miss's own missDamage).
  function bumpNearbyCar() {
    let hit = null;
    traffic.cars.forEach(function (c) {
      if (c.near && (!hit || Math.abs(c.z) < Math.abs(hit.z))) hit = c;
    });
    if (!hit) return false;
    damageTires(tireCfg('bumpDamage', 2));
    race.speed = Math.max(spCfg('base', 0), race.speed * tfCfg('bumpSpeedKeep', 0.6));
    hit.lane = Math.max(-0.8, Math.min(0.8, hit.lane + (hit.lane < 0 ? -0.14 : 0.14)));
    replay(hit.el, 'bumped');
    replay(document.getElementById('roadView'), 'jolt');
    flashPass('✸ CONTACT · ' + hit.id, 'bump');
    return true;
  }

  // Restart a one-shot CSS animation class that may already be on the element.
  function replay(el, cls) {
    if (!el) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  }

  // Transient pass / contact callout on the road view. Deliberately NOT the radio
  // bubble — that belongs to the Shift Change and must not get clobbered by traffic.
  let passT = 0;
  function flashPass(text, cls) {
    const el = document.getElementById('passFlash');
    if (!el) return;
    el.textContent = text;
    el.className = 'pass-flash show' + (cls ? ' ' + cls : '');
    clearTimeout(passT);
    passT = setTimeout(function () { el.className = 'pass-flash'; }, 1100);
  }

  /* ===================== PHASE 1 — single-leg race loop ====================
   * Route-traversal impulse model (authorized 2026-06-20). SLICE 1: prove ONE
   * leg A→B with position-gated AP→ENP→BSE beats. Correct beat at its gate =
   * throttle burst; the unit coasts/drags between gates; a content error
   * sputters (momentum loss); a beat typed before its gate is a harmless no-op.
   * No laps / opponents / pit yet (those are Slices 2–3). */
  function pickUnit() {
    const sel = state.raceOptions && state.raceOptions.unit;
    if (sel) return sel;                                       // player's Race Options pick wins
    const u = (DATAMOD.DATA && DATAMOD.DATA.units) || [];
    return u.indexOf('2101') >= 0 ? '2101' : (u[0] || '2101');
  }

  // Placeholder for the future distinct car sprites: tint the map marker with the
  // selected unit's colour so each unit already LOOKS different today. The real
  // per-unit race-car art drops in later (config SELECTABLE_UNITS[].tint → sprite).
  function unitTint(id) {
    const units = (CFG.SELECTABLE_UNITS || []);
    for (let i = 0; i < units.length; i++) if (units[i].id === id) return units[i].tint;
    return null;
  }
  function applyUnitTint() {
    const t = unitTint(race.unitId);
    const m = document.getElementById('unitMarker');
    if (m && t) { m.style.fill = t; m.style.stroke = t; }
    // The car's green stripe + rear wing take the unit's tint so each unit's
    // race car already looks distinct (placeholder for full per-unit sprites).
    const car = document.getElementById('raceCar');
    if (car && t) car.style.setProperty('--car-tint', t);
  }

  /* ---- Tire-damage model (design §05) -------------------------------------
   * Maps one integer tire_health (0–10) to a visual stage via the config table
   * (CFG.TIRE), and renders that stage to the 2×2 side gauge AND to the rubber on
   * the car itself. Mistakes are the wear SOURCE — see damageTires().
   * ⚠ Still gated (Pitstop_Design_Note.md §10): the CONSEQUENCE of worn tires —
   * the speed governor and the pit-stop repair loop. Damage accrues and SHOWS;
   * nothing punishes it yet beyond the look. */
  function deriveTire(h) {
    const T = CFG.TIRE || {};
    if (h <= 0) return T.burst || { stage: 'BURST' };
    const stages = T.stages || [];
    for (let i = 0; i < stages.length; i++) if (h >= stages[i].min) return stages[i];
    return stages[stages.length - 1] || { stage: 'FRESH' };
  }
  // Render the four side-column tire cells from a single tire_health. Redundant
  // cue: the wear TEXT and the cell colour class both track the stage.
  function renderTireGauges(h) {
    const cells = document.querySelectorAll('#hudTires .tire-cell');
    if (!cells.length) return;
    const stage = deriveTire(h).stage;
    let cls = '', text = 'OK';
    // Full stage map (config.js TIRE.stages): Fresh 10–8 · Worn 7–5 · Warning 4–2 ·
    // Critical 1 · Burst 0. WORN used to fall through to "OK" — it now has its own
    // rung, so the gauge stops claiming healthy rubber at half health.
    if (stage === 'WORN')         { cls = 'worn'; text = 'WORN'; }
    else if (stage === 'WARNING') { cls = 'warn'; text = 'WARN'; }
    else if (stage === 'CRITICAL'){ cls = 'low';  text = 'LOW'; }
    else if (stage === 'BURST')   { cls = 'low';  text = 'OUT'; }
    // The fill tracks health point-by-point so EVERY miss moves the gauge; the
    // class (hue) still steps at the stage boundaries.
    const wear = Math.max(0, Math.min(100, (1 - h / tireCfg('max', 10)) * 100));
    Array.prototype.forEach.call(cells, function (c) {
      c.classList.remove('worn', 'warn', 'low');
      if (cls) c.classList.add(cls);
      c.style.setProperty('--wear', wear.toFixed(0) + '%');
      const w = c.querySelector('.tc-wear');
      if (w) w.textContent = text;
    });
    // The rubber on the car tracks the same stage (config greys black→white), so
    // damage reads on the thing you're actually looking at, not just the gauge.
    const car = document.getElementById('raceCar');
    if (car) car.setAttribute('data-tire', stage);
  }

  /* ---- Tire WEAR SOURCE (Andrew, 2026-07-16) ------------------------------
   * Until now nothing ever decremented tire_health, so a wrong command never
   * showed damage — the gauge sat on OK all race. Mistakes are the source: every
   * miss scrubs the rubber by TIRE.missDamage, and a miss taken wheel-to-wheel
   * costs TIRE.bumpDamage on top (bumpNearbyCar). Both visual channels — the side
   * gauge and the car's own tires — flash and re-render on every hit. */
  function damageTires(n) {
    if (!n || race.tireHealth == null) return;
    const before = race.tireHealth;
    race.tireHealth = Math.max(0, race.tireHealth - n);
    if (race.tireHealth === before) return;         // already burst — nothing left to lose
    renderTireGauges(race.tireHealth);
    replay(document.getElementById('raceCar'), 'hurt');
    replay(document.getElementById('hudTires'), 'hurt');
  }

  function nowMs() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  // WPM for the command just submitted: (chars/5) / minutes since the first keystroke.
  function computeTypingWpm(text) {
    const chars = String(text || '').trim().length;
    if (!chars || !typing.start) return spCfg('optimalWpm', 45);   // no timing captured → assume optimal
    const mins = Math.max(0.0001, (nowMs() - typing.start) / 60000);
    return (chars / 5) / mins;
  }

  // One lap = the course's bases in drive order; a LOOP re-appends the start so
  // the last leg drives back to Start/Finish. Point-to-point ends at the last base.
  function buildStops(course) {
    const ids = (course.baseIds || []).slice();
    if (course.type === 'loop' && ids.length > 1) ids.push(ids[0]);
    return ids;
  }

  // Set up a full race: every base, every lap, finishing at Start/Finish.
  function startRace() {
    const course = activeCourse();
    if (!course || !DATAMOD.buildLeg || course.baseIds.length < 2) return;
    cancelAnimationFrame(race.raf);
    race.unitId = pickUnit();
    applyUnitTint();                 // placeholder: colour the marker per selected unit
    race.stops = buildStops(course);
    // Laps: the player's Race Options control wins; fall back to the course's Laps.
    // Point-to-point is a single pass.
    const optLaps = Number(state.raceOptions.laps) || 0;
    race.laps = course.type === 'point-to-point' ? 1 : Math.max(1, optLaps || course.laps || 1);
    race.lap = 1;
    race.legIndex = 0;
    race.startTs = 0;
    race.shiftFired = false;
    race.hitBases = {};
    race.speed = spCfg('base', 0);                  // standing start — typing is the throttle
    race.hold = 0; race.wpm = 0; race.elapsed = 0; race.gear = null;   // no gear lit at the start
    race.brakeUntil = 0; race.braking = false; setBrakeLight(false);
    road.dist = 0; road.curve = 0;                  // fresh OutRun curve for this race
    // Tire health (design §05). Starts fresh; mistakes wear it down (damageTires).
    race.tireHealth = tireCfg('demoHealth', 10);
    renderTireGauges(race.tireHealth);
    buildTraffic();                                 // put the field on the road
    startLeg();
  }

  // Drive ONE leg: stops[legIndex] -> stops[legIndex+1]. Called by startRace and
  // by legComplete as it advances through the route.
  function startLeg() {
    const stops = race.stops;
    if (!stops || stops.length < 2 || race.legIndex >= stops.length - 1) return;
    cancelAnimationFrame(race.raf);
    race.fromId = stops[race.legIndex];
    race.toId = stops[race.legIndex + 1];
    race.leg = DATAMOD.buildLeg(race.unitId, race.fromId, race.toId);
    if (!race.leg) return;
    race.pos = 0; race.last = 0; race.on = true; race.paused = false;   // speed carries between legs
    race.gear = null;                                                   // each leg starts with no gear lit
    road.phase = 0;
    race.hitBases[race.fromId] = true;                      // start of this leg counts as hit
    const legLabel = document.getElementById('roadLegLabel');
    if (legLabel) legLabel.textContent = (race.leg.toName || race.toId);
    // The passing road sign points at where this leg is headed.
    setRoadSign(((race.leg.toName || race.toId) + '').toUpperCase() + '\n' + race.toId);
    renderRoad();
    renderMap('regionMap');                                 // light up the current dot
    const input = document.getElementById('commandInput');
    if (input) { input.disabled = false; input.value = ''; }
    setTimeout(focusCommand, 60);   // land the caret in the command box for this leg
    resetShift();
    // Arm the Shift Change ONCE, on the opening leg only, so it doesn't re-fire
    // every leg of a multi-leg race.
    if (!race.shiftFired && race.lap === 1 && race.legIndex === 0) {
      armShift();
      if (race.shift.armed) race.shiftFired = true;
    }
    updateRaceHUD(0);
    race.raf = requestAnimationFrame(loop);
  }

  function activeBeat() {
    return race.leg ? (race.leg.beats.find(function (b) { return !b.done; }) || null) : null;
  }

  // The gear to type NEXT — telegraphed with a shimmer ring in the SHIFT box.
  // Normally the active beat; but when a Shift Change is armed after ENP, LA is
  // required before BSE (so grey LA lights up), and while the board is open BSE
  // is what follows once it's cleared.
  function nextGearCode() {
    if (!race.on) return null;
    if (race.shift.open) return 'BSE';
    const beat = activeBeat();
    if (!beat) return null;
    if (beat.code === 'BSE' && race.shift.armed && !race.shift.cleared) return 'LA';
    return beat.code;
  }

  /* ---- Speed model (Andrew, 2026-07-16) -----------------------------------
   * Typing is the ONLY throttle — nothing else pushes the car — so stop typing and
   * it coasts down to a genuine stop. The burn-off is brisk at pace, then eases to
   * `rollDecay` below `rollThreshold` (25 km/h) so the last stretch is a long roll
   * rather than a hard stop. Backspace is the brake pedal (tapBrake): it kills the
   * hold and scrubs hard for as long as the player keeps tapping it. */
  function updateSpeed(dt, ts) {
    const braking = race.brakeUntil > ts;
    if (braking) {
      race.hold = 0;
      race.speed = Math.max(spCfg('base', 0), race.speed - spCfg('brakeDecay', 90) * dt);
    } else if (race.hold > 0) {
      race.hold = Math.max(0, race.hold - dt);           // boost buffer: freeze the decay
    } else {
      const rate = race.speed <= spCfg('rollThreshold', 25)
        ? spCfg('rollDecay', 8) : spCfg('decay', 24);
      race.speed = Math.max(spCfg('base', 0), race.speed - rate * dt);
    }
    if (braking !== race.braking) { race.braking = braking; setBrakeLight(braking); }
  }

  function setBrakeLight(on) {
    const car = document.getElementById('raceCar');
    if (car) car.classList.toggle('braking', !!on);
  }

  // Backspace = the brake pedal (Andrew, 2026-07-16). Each tap re-arms the brake
  // for brakeHold seconds, so holding it down (key repeat) keeps the light lit and
  // keeps scrubbing speed. The light is set here as well as in updateSpeed so it
  // fires on the keystroke rather than on the next frame.
  function tapBrake() {
    if (!race.on || race.paused) return;
    race.brakeUntil = nowMs() + spCfg('brakeHold', 0.3) * 1000;
    race.hold = 0;
    race.braking = true;
    setBrakeLight(true);
  }

  function loop(ts) {
    if (!race.on || race.paused) return;
    if (!race.last) race.last = ts;
    if (!race.startTs) race.startTs = ts;               // race clock starts once, spans all legs/laps
    let dt = (ts - race.last) / 1000; race.last = ts;
    if (dt > 0.1) dt = 0.1;                                   // clamp tab-switch jumps
    updateSpeed(dt, ts);
    const max = spCfg('max', 200);
    const eff = Math.min(max, race.speed);                    // motion/display cap at top speed
    const v = (eff / max) * spCfg('legRate', 0.6);            // pos-units/sec
    race.pos = Math.min(1, race.pos + v * dt);
    updateRoad(dt, v);
    updateTraffic(dt, eff);
    updateUnitMarker();
    updateRaceHUD(ts);
    if (race.pos >= 1 && race.leg.beats.every(function (b) { return b.done; })) { legComplete(); return; }
    race.raf = requestAnimationFrame(loop);
  }

  function updateUnitMarker() {
    const m = document.getElementById('unitMarker');
    if (!m || !raceCoords) return;
    const a = raceCoords[race.fromId], b = raceCoords[race.toId];
    if (!a || !b) return;
    m.setAttribute('cx', (a.x + (b.x - a.x) * race.pos).toFixed(1));
    m.setAttribute('cy', (a.y + (b.y - a.y) * race.pos).toFixed(1));
  }

  // Race clock: seconds under a minute, m:ss.s above (design shows "1:24.6").
  function fmtRaceTime(sec) {
    if (sec < 60) return sec.toFixed(1);
    const m = Math.floor(sec / 60), s = sec - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
  }

  function updateRaceHUD(ts) {
    const beat = activeBeat();
    // Gear-shifter box: lights the unit's CURRENT status = the last command
    // entered CORRECTLY (race.gear), like the gear a car is in. Nothing is lit
    // at the start of a leg; AP lights once posted, ENP once en route, LA during
    // a Shift Change, BSE on arrival. Only one gear is illuminated at a time.
    const gear = function (id, on) { const el = document.getElementById(id); if (el) el.classList.toggle('live', !!on); };
    gear('cmdAP',  race.gear === 'AP');
    gear('cmdENP', race.gear === 'ENP');
    gear('cmdLA',  race.gear === 'LA');
    gear('cmdBSE', race.gear === 'BSE');
    // Shimmer the NEXT gear to type (grey LA lights up here once a Shift Change
    // makes it available). The current status above stays solid .live.
    const next = nextGearCode();
    const gearNext = function (id, on) { const el = document.getElementById(id); if (el) el.classList.toggle('next', !!on); };
    gearNext('cmdAP',  next === 'AP');
    gearNext('cmdENP', next === 'ENP');
    gearNext('cmdLA',  next === 'LA');
    gearNext('cmdBSE', next === 'BSE');

    const unitEl = document.getElementById('hudUnit');
    if (unitEl) unitEl.textContent = race.unitId || '—';
    setCarUnit(race.unitId);

    // Map-as-challenge caption: the NEXT base — its name + the full code to type.
    const tgt = document.getElementById('mapTarget');
    if (tgt) {
      if (race.on && race.toId) {
        const to = DATAMOD.DATA && DATAMOD.DATA.baseById[race.toId];
        tgt.textContent = '▸ ' + (to ? to.name : race.toId) + '  ·  ' + race.toId;
      } else tgt.textContent = '';
    }

    // Slim status line — transient cues only (the map + Active strip carry the command).
    const cp = document.getElementById('challengePrompt');
    if (cp && race.on) {
      if (race.shift.open) cp.textContent = '⇄ SHIFT CHANGE — clear the board, then BSE';
      else if (beat && beat.code === 'BSE' && race.shift.armed && !race.shift.cleared) cp.textContent = 'Shift Change pending → type LA ' + race.unitId;
      else if (beat && beat.code === 'BSE' && race.pos >= beat.gate) cp.textContent = 'Home base? type BSEH ' + race.unitId + ' (no base code)';
      else cp.textContent = '';
    }

    // Speed: the top pod shows real KM/H, the side bar shows the 0–100–200 gauge.
    // Overflow past the 200 top end glows (the buffer that holds you flat out).
    const max = spCfg('max', 200);
    const over = race.speed > max + 0.5;
    const eff = Math.min(max, race.speed);
    const spEl = document.getElementById('hudSpeed');
    if (spEl) {
      spEl.textContent = Math.round(eff);
      spEl.style.color = over ? 'var(--amber)' : (eff > max * 0.7 ? 'var(--phosphor)' : 'var(--phosphor-soft)');
    }
    const fill = document.getElementById('speedFill');
    if (fill) {
      fill.style.width = Math.max(0, Math.min(100, eff / max * 100)) + '%';
      if (fill.parentNode) fill.parentNode.classList.toggle('overflow', over);
    }
    // WPM readouts (top speed pod + side gauge share the .js-wpm class).
    const wtxt = (race.wpm ? race.wpm : '—') + ' WPM';
    const wEls = document.querySelectorAll('.js-wpm');
    Array.prototype.forEach.call(wEls, function (el) { el.textContent = wtxt; });

    const lap = document.getElementById('hudLap');
    if (lap) lap.textContent = race.lap + '/' + race.laps;
    const legsPerLap = Math.max(1, (race.stops.length || 2) - 1);
    const pl = document.getElementById('hudPlace');
    if (pl) pl.textContent = Math.min(race.legIndex + 1, legsPerLap) + '/' + legsPerLap;
    if (ts && race.startTs) {
      race.elapsed = (ts - race.startTs) / 1000;
      const tEl = document.getElementById('hudTime');
      if (tEl) tEl.textContent = fmtRaceTime(race.elapsed);
    }
  }

  function flashBox(cls) {
    const box = document.querySelector('#gameScreen .command-box');
    if (!box) return;
    box.classList.remove('hit', 'miss', 'early'); void box.offsetWidth; box.classList.add(cls);
    setTimeout(function () { box.classList.remove(cls); }, 320);
  }

  // Flicker a specific gear in the shifter box red↔green 3× — the "wrong next
  // command" cue (e.g. wrong unit/base for the beat you're on). `code` = the
  // command you were SUPPOSED to enter (the active beat, or LA when it's pending).
  const GEAR_ID = { AP: 'cmdAP', ENP: 'cmdENP', LA: 'cmdLA', BSE: 'cmdBSE' };
  function flashGear(code) {
    const el = document.getElementById(GEAR_ID[code]);
    if (!el) return;
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    setTimeout(function () { el.classList.remove('flash'); }, 620);
  }

  function handleRaceCommand(value, wpm) {
    const input = document.getElementById('commandInput');
    // While the Shift Change box is open, ALL input goes to it (checked before the
    // race-on guard so the debug opener is usable outside a live leg).
    if (race.shift.open) { if (input) input.value = ''; handleShiftCommand(value); return; }
    if (!race.on || race.paused) return;
    if (input) input.value = '';
    const beat = activeBeat();
    if (!beat) return;

    // Shift Change intercept: once ENP is done (active beat = BSE) with a change
    // armed but unresolved, you type LA to stay mobile and open the box — BSE is
    // blocked until the board is cleared (design note §2).
    if (beat.code === 'BSE' && race.shift.armed && !race.shift.cleared) {
      if (firstToken(value) === 'LA') { openShiftBox(race.shift.slot); return; }
      // Wrong entry while LA is the required next command → flicker the LA gear.
      flashBox('early'); flashGear('LA'); AUDIO.play('back');
      showRadio('Shift Change pending — type LA to handle it before BSE.', '');
      return;
    }

    if (race.pos < beat.gate) { flashBox('early'); AUDIO.play('menu'); return; }   // no-op: too early
    if (DATAMOD.validateBeat(value, beat) === 'hit') {
      beat.done = true;
      race.gear = beat.code;                                                        // shift into this gear (status lights)
      applySpeedBoost(wpm);                                                         // gauge jump + hold
      AUDIO.play('select'); flashBox('hit');
    } else {
      // Wrong content (wrong unit/base for this beat) → flicker the gear you were
      // trying to complete red↔green; bleed speed, don't stall.
      flashGear(beat.code);
      race.speed = Math.max(spCfg('base', 0), race.speed * missKeepFraction());      // bleed speed (per-unit handling)
      race.hold = 0;                                                                // and kill the hold
      damageTires(tireCfg('missDamage', 1));                                        // a typo scrubs the rubber
      bumpNearbyCar();                                                              // ...and clouts anyone you're alongside
      AUDIO.play('back'); flashBox('miss');
    }
    updateRaceHUD();
  }

  /* ---- Per-unit handling (Andrew, 2026-07-15) -----------------------------
   * Re-activates the gated CAR_TYPES idea, merged into the selected unit:
   * `speed` → how fast the gauge climbs on a good beat; `handling` → what
   * fraction of speed a miss KEEPS. Gate with CFG.CARS.handlingEnabled. */
  function unitStats(id) {
    const units = CFG.SELECTABLE_UNITS || [];
    for (let i = 0; i < units.length; i++) if (units[i].id === id && units[i].stats) return units[i].stats;
    return { speed: 6, handling: 6 };   // balanced fallback
  }
  function speedBoostFactor() {
    if (!(CFG.CARS && CFG.CARS.handlingEnabled)) return 1;
    return 0.78 + (unitStats(race.unitId).speed / 10) * 0.44;         // spd4 → ~0.96 · spd9 → ~1.18
  }
  function missKeepFraction() {
    const base = (T.sputterFactor != null ? T.sputterFactor : 0.45);
    if (!(CFG.CARS && CFG.CARS.handlingEnabled)) return base;
    const f = base + (unitStats(race.unitId).handling - 5) * 0.05;    // h8 → .60 (forgiving) · h3 → .30 (harsh)
    return Math.max(0.2, Math.min(0.85, f));
  }

  // A correct command boosts the gauge (scaled by how fast it was typed), then it
  // HOLDS before decaying. Above 100 the hold lasts longer and the value overflows
  // (a buffer) so you stay at top speed longer — the reward for chaining fast.
  function applySpeedBoost(wpm) {
    const opt = spCfg('optimalWpm', 45);
    const minF = spCfg('minBoostFactor', 0.4);
    const factor = wpm ? Math.max(minF, Math.min(1, wpm / opt)) : 1;   // slow typing → smaller boost
    race.wpm = Math.round(wpm || 0);
    race.speed = Math.min(spCfg('overflowMax', 250),
                          race.speed + spCfg('boost', 50) * factor * speedBoostFactor());
    const over = Math.max(0, race.speed - spCfg('max', 200));
    race.hold = spCfg('holdBase', 1.2) + over * spCfg('holdOverflowPer', 0.015);
    race.brakeUntil = 0;                     // back on the throttle — off the brake
    if (race.braking) { race.braking = false; setBrakeLight(false); }
  }

  function legComplete() {
    race.on = false;
    cancelAnimationFrame(race.raf);
    race.hitBases[race.toId] = true;                     // light up the arrival dot
    renderMap('regionMap');
    race.legIndex += 1;
    const legsPerLap = race.stops.length - 1;
    if (race.legIndex < legsPerLap) {                    // more legs this lap → drive on
      AUDIO.play('select');
      startLeg();
      return;
    }
    if (race.lap < race.laps) {                          // lap done, more laps → next lap
      race.lap += 1;
      race.legIndex = 0;
      race.hitBases = {};                                // fresh lap progress on the minimap
      AUDIO.play('select');
      startLeg();
      showRadio('▶ LAP ' + race.lap + ' OF ' + race.laps, 'cleared');
      return;
    }
    raceFinish();                                        // final lap done → the race is over
  }

  // Fill the podium / result chips (design §04) from the finished race. Place +
  // penalties + pit stops are placeholders (opponents/pit consequence not wired).
  function populateFinish() {
    const legsPerLap = Math.max(1, (race.stops.length || 2) - 1);
    const totalLegs = legsPerLap * race.laps;
    const fs = document.getElementById('finishStats');
    if (fs) fs.textContent = 'P1 · ' + fmtRaceTime(race.elapsed || 0) + ' · UNIT ' + (race.unitId || '—');
    const cl = document.getElementById('chipLegs'); if (cl) cl.textContent = totalLegs + '/' + totalLegs;
    const cp = document.getElementById('chipPen');  if (cp) cp.textContent = '0';
    const cpit = document.getElementById('chipPits'); if (cpit) cpit.textContent = '0';
    // Two other roster units flank the podium (placeholder AI field).
    const others = (CFG.SELECTABLE_UNITS || []).map(function (u) { return u.id; })
      .filter(function (id) { return id !== race.unitId; });
    const p2 = document.getElementById('podName2'); if (p2) p2.textContent = others[0] || '2104';
    const p3 = document.getElementById('podName3'); if (p3) p3.textContent = others[1] || '2101';
  }

  function raceFinish() {
    race.on = false;
    cancelAnimationFrame(race.raf);
    const input = document.getElementById('commandInput');
    if (input) input.disabled = true;
    hideRadio();
    const cp = document.getElementById('challengePrompt');
    if (cp) cp.textContent = '🏁 RACE COMPLETE — ' + race.unitId + ' finished ' +
      race.laps + (race.laps > 1 ? ' laps' : ' lap');
    populateFinish();
    AUDIO.play('select');
    setTimeout(function () { if (state.currentScreen === 'gameScreen') showScreen('endScreen'); }, 1800);
  }

  function stopRace() {
    race.on = false; race.paused = false;
    cancelAnimationFrame(race.raf);
    race.brakeUntil = 0; race.braking = false; setBrakeLight(false);
    clearTraffic();
    resetShift();
  }

  /* ===================== SHIFT CHANGE (overlay) ============================
   * design: NEMS500_ShiftChange_DesignNote.md. A time-of-day-triggered box of
   * units cleared through their command chains while the car keeps moving. This
   * single-leg build fires it via LA-after-ENP; the pure model lives in
   * core/shiftchange.js so a future multi-leg loop can reuse openShiftBox() for
   * the real one-leg-early telegraph. Car never stops.
   * ==================================================================== */
  function firstToken(v) { return String(v || '').trim().toUpperCase().split(/\s+/)[0] || ''; }

  function fmtSlot(slot) {
    const t = String(slot.time);
    return t.slice(0, 2) + ':' + t.slice(2) + ' · ' + String(slot.kind).toUpperCase();
  }

  // Toggle the layout mode that drops the centered command box to the bottom while
  // the Shift Change board (which fills the middle) is up.
  function setShiftActive(on) {
    const gw = document.querySelector('#gameScreen .game-wrap');
    if (gw) gw.classList.toggle('shift-active', !!on);
  }

  function resetShift() {
    stopShiftClock();
    race.shift.armed = false; race.shift.slot = null; race.shift.box = null;
    race.shift.open = false; race.shift.cleared = false;
    const el = document.getElementById('shiftChangeBox');
    if (el) el.classList.remove('active');
    setShiftActive(false);
    hideRadio();
  }

  // Arm a change for this leg from the chosen Start Time (single-leg stand-in for
  // the one-leg-early telegraph). NONE / disabled = no change this leg.
  function armShift() {
    if (!SHIFT || SC.enabled === false) return;
    const t = state.raceOptions.startTime;
    if (!t || t === 'NONE') return;
    const slot = SHIFT.findSlot(t);
    if (!slot) return;
    race.shift.armed = true;
    race.shift.slot = slot;
    const kind = slot.kind === '12h' ? '12-hour starts' : '24-hour units';
    showRadio('Shift Change coming up after this base (' + fmtSlot(slot) + ', ' + kind +
              ') — type LA after ENP.', '');
  }

  function openShiftBox(slotOrTime) {
    if (!SHIFT) return;
    const allUnits = (DATAMOD.DATA && DATAMOD.DATA.units) || [];
    // "Trucks" only — shift changes are the 24h/12h truck rotation; the specialty
    // units (FIT/MHRT/CARE) aren't on it. Fall back to all if none are numeric.
    const trucks = allUnits.filter(function (id) { return /^\d+$/.test(id); });
    const pool = trucks.length ? trucks : allUnits;
    const box = SHIFT.buildShiftBox(slotOrTime || race.shift.slot, pool, [race.unitId]);
    if (!box) return;
    race.shift.armed = true; race.shift.slot = box.slot; race.shift.box = box;
    race.shift.open = true; race.shift.cleared = false;
    race.gear = 'LA';                                   // stay-mobile: LA gear lights
    const el = document.getElementById('shiftChangeBox');
    if (el) el.classList.add('active');
    setShiftActive(true);
    const slotEl = document.getElementById('shiftSlot');
    if (slotEl) slotEl.textContent = fmtSlot(box.slot);
    renderShiftBox();
    updateShiftClock();
    startShiftClock();
    showRadio('Shift Change — clear the board, then BSE to finish.', '');
    AUDIO.play('select');
    const input = document.getElementById('commandInput');
    if (input) { input.disabled = false; setTimeout(function () { input.focus(); }, 40); }
    updateRaceHUD();
  }

  function handleShiftCommand(value) {
    const box = race.shift.box;
    if (!box || !SHIFT) return;
    const res = SHIFT.validateShiftCommand(value, box);
    switch (res.result) {
      case 'advance':
      case 'note':
        AUDIO.play('select'); flashBox('hit'); renderShiftBox(); break;
      case 'complete':
        AUDIO.play('select'); flashBox('hit'); renderShiftBox();
        if (SHIFT.allDone(box)) closeShiftBox(true);
        break;
      case 'wrong':
        AUDIO.play('back'); flashBox('miss'); showRadio(shiftMissMsg(res), ''); break;
      case 'unknown':
        AUDIO.play('back'); flashBox('miss'); showRadio('No such unit in this Shift Change.', ''); break;
      case 'already-done':
        AUDIO.play('menu'); flashBox('early'); break;
      default:
        AUDIO.play('back'); flashBox('miss'); break;
    }
  }

  function shiftMissMsg(res) {
    const u = res.unit ? res.unit.id : '?';
    if (res.why === 'note-early')   return 'NOTE for ' + u + ' not yet — it opens after SS.';
    if (res.why === 'note-already') return u + ' already has its NOTE.';
    if (res.expected)               return 'Wrong step for ' + u + ' — next is ' + res.expected + '.';
    return 'Not a valid command for ' + u + '.';
  }

  function closeShiftBox(cleared) {
    stopShiftClock();
    race.shift.open = false;
    race.shift.cleared = !!cleared;
    const el = document.getElementById('shiftChangeBox');
    if (el) el.classList.remove('active');
    setShiftActive(false);
    if (cleared) {
      const late = race.shift.box ? race.shift.box.lateCount : 0;
      showRadio('Shift Change cleared' + (late ? ' (' + late + ' late)' : '') + ' — BSE to finish the leg.', 'cleared');
      AUDIO.play('select');
    }
    const input = document.getElementById('commandInput');
    if (input) setTimeout(function () { input.focus(); }, 40);
    updateRaceHUD();
  }

  function renderShiftBox() {
    const wrap = document.getElementById('shiftUnits');
    const box = race.shift.box;
    if (!wrap || !box || !SHIFT) return;
    wrap.innerHTML = box.units.map(function (u) {
      const rowCls = u.status === 'done' ? 'done' : (u.late ? 'late' : (u.status === 'working' ? 'active' : ''));
      const statusCls = u.status === 'done' ? 'done' : (u.kind === '12h' ? 'sp' : 'eos');
      const statusText = u.status === 'done' ? 'DONE'
        : (u.status === 'working' ? (u.steps[u.stepIndex] ? u.steps[u.stepIndex].code : 'DONE')
        : ((SC.startStatus && SC.startStatus[u.kind]) || (u.kind === '12h' ? 'SP' : 'EOS')));
      const chips = u.steps.map(function (st, i) {
        const cls = st.done ? 'done' : (i === u.stepIndex && u.status !== 'done' ? 'next' : '');
        return '<span class="step-chip ' + cls + '">' + st.code + '</span>';
      }).join('');
      const noteCls = 'step-chip note' + (u.noteDone ? ' done'
        : (SHIFT.noteAllowed(u) && u.status !== 'done' ? ' next' : ''));
      const note = '<span class="' + noteCls + '">NOTE</span>';
      const late = (u.late && u.status !== 'done') ? '<span class="su-late">LATE</span>' : '';
      return '<div class="su-row ' + rowCls + '">' +
        '<span class="su-id">' + u.id + '</span>' +
        '<span class="su-status ' + statusCls + '">' + statusText + '</span>' +
        '<span class="su-steps">' + chips + note + '</span>' + late + '</div>';
    }).join('');
  }

  function updateShiftClock() {
    const el = document.getElementById('shiftClock');
    const box = race.shift.box;
    if (el && box && SHIFT) el.textContent = SHIFT.formatClock(box.sim);
  }

  // Clock runs on its own interval (independent of the rAF race loop, which the
  // preview sandbox throttles) so the sim wall-clock ticks reliably.
  function startShiftClock() {
    stopShiftClock();
    shiftClockLast = (window.performance && performance.now) ? performance.now() : Date.now();
    shiftClockTimer = setInterval(function () {
      const box = race.shift.box;
      if (!box || !race.shift.open) return;
      const now = (window.performance && performance.now) ? performance.now() : Date.now();
      const dt = (now - shiftClockLast) / 1000; shiftClockLast = now;
      const before = box.lateCount;
      SHIFT.tickClock(box, dt);
      updateShiftClock();
      if (box.lateCount !== before) renderShiftBox();
    }, 250);
  }
  function stopShiftClock() { if (shiftClockTimer) { clearInterval(shiftClockTimer); shiftClockTimer = 0; } }

  function showRadio(msg, cls) {
    const el = document.getElementById('radioBubble');
    if (!el) return;
    el.textContent = msg;
    el.className = 'radio-bubble show' + (cls ? ' ' + cls : '');
  }
  function hideRadio() {
    const el = document.getElementById('radioBubble');
    if (el) el.className = 'radio-bubble';
  }

  /* ---- Return to Arcade (cassette eject) — depth 3 → ../../../index.html -- */
  function eject() {
    AUDIO.play('back');
    const exit = document.getElementById('cassetteExit');
    if (exit) exit.classList.add('active');
    setTimeout(function () { window.location.href = '../../../index.html'; }, 3000);
  }

  function pauseGame()  {
    state.paused = true; document.getElementById('pauseOverlay').classList.add('active');
    if (race.on) { race.paused = true; cancelAnimationFrame(race.raf); }
    if (race.shift.open) stopShiftClock();          // freeze the sim clock while paused
  }
  function resumeGame() {
    state.paused = false; document.getElementById('pauseOverlay').classList.remove('active');
    if (race.on && race.paused) { race.paused = false; race.last = 0; race.raf = requestAnimationFrame(loop); }
    if (race.shift.open) startShiftClock();
  }

  /* ---- Navigation wiring (event delegation on [data-action]) ------------- */
  function wireNav() {
    document.body.addEventListener('click', function (e) {
      const t = e.target.closest('[data-action]');
      if (!t) return;
      const action = t.getAttribute('data-action');
      switch (action) {
        case 'title-start': AUDIO.play('select'); showScreen('menuScreen'); break;
        case 'goto':        AUDIO.play('menu'); resumeGame(); showScreen(t.getAttribute('data-target')); break;
        case 'eject':       eject(); break;
        case 'pause':       pauseGame(); break;
        case 'resume':      resumeGame(); break;
        default: break;
      }
    });
  }

  /* ---- Keyboard menu navigation ------------------------------------------
   * Menus are fully keyboard-operable: arrows move between buttons, Enter/Space
   * activates. Skips the live game screen (the command input owns the keyboard)
   * and never hijacks typing in a text field or a <select>. Works for the active
   * overlay (e.g. Pause) too. */
  function wireKeyboardNav() {
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;         // keep dev hook + native shortcuts
      const overlay = document.querySelector('.overlay.active');
      const container = overlay || document.querySelector('.screen.active');
      if (!container) return;
      if (!overlay && container.id === 'gameScreen') return;   // command input owns the keyboard
      const ae = document.activeElement;
      const tag = (ae && ae.tagName) || '';
      const inField = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
      const inChip = !!(ae && ae.classList && ae.classList.contains('unit-chip'));

      // Unit picker hotkeys — top-row number keys pick your car on Race Options.
      // Keys are spread 1·3·5·7·9 (balanced reach); ignored while typing a field.
      if (!overlay && container.id === 'optionsScreen' && !inField) {
        const units = (CFG.SELECTABLE_UNITS || []);
        for (let i = 0; i < units.length; i++) {
          if (String(units[i].hotkey) === e.key) { e.preventDefault(); selectUnit(units[i].id); return; }
        }
      }

      const btns = Array.prototype.slice.call(container.querySelectorAll('.btn'))
        .filter(function (b) { return !b.disabled && b.offsetParent !== null; });
      if (!btns.length) return;
      const idx = btns.indexOf(ae);

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        if (inField) return;                                   // let the control use arrows
        e.preventDefault(); btns[(idx + 1 + btns.length) % btns.length].focus(); AUDIO.play('menu');
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        if (inField) return;
        e.preventDefault(); btns[(idx - 1 + btns.length) % btns.length].focus(); AUDIO.play('menu');
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (inField || inChip) return;                         // field / unit chip does its own thing
        if (idx >= 0) return;                                  // a focused button → native click handles it
        e.preventDefault(); btns[0].click();
      }
    });
  }

  /* ========================================================================
   * MODE COMPLIANCE — Demo default + Developer Mode (Law §0.15, Ctrl+Shift+B)
   * The handoff requires NOT blocking Ctrl+Shift+B at the shell level. All
   * other key handling MUST ignore modifier combos so the hook always lands.
   * ===================================================================== */
  function wireModeCompliance() {
    document.addEventListener('keydown', function (e) {
      // Developer Mode hook — highest priority, never swallowed.
      if (e.ctrlKey && e.shiftKey && (e.key === 'B' || e.key === 'b')) {
        e.preventDefault();
        if (!state.devPromptActive) showDevPrompt();
        return;
      }
      // Everything below ignores modifier combos (keeps Ctrl+Shift+B reachable).
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'Escape') {
        if (state.currentScreen === 'gameScreen') { state.paused ? resumeGame() : pauseGame(); }
      }
    });
  }

  function showDevPrompt() {
    const prompt = document.getElementById('devPrompt');
    const input  = document.getElementById('devPassword');
    const timerEl = document.getElementById('devTimer');
    if (!prompt) return;
    state.devPromptActive = true;
    prompt.classList.add('active');
    if (input) { input.value = ''; input.focus(); }

    let remaining = Math.ceil((CONFIG.devModeTimeout || 10000) / 1000);
    if (timerEl) timerEl.textContent = remaining;
    const countdown = setInterval(function () {
      remaining -= 1;
      if (timerEl) timerEl.textContent = remaining;
      if (remaining <= 0) { closeDev(); }
    }, 1000);

    function closeDev() {
      clearInterval(countdown);
      prompt.classList.remove('active');
      state.devPromptActive = false;
      input.removeEventListener('keydown', onKey);
    }
    function onKey(ev) {
      if (ev.key === 'Enter') {
        if ((input.value || '').trim().toUpperCase() === String(CONFIG.devModePassword).toUpperCase()) {
          toggleDevMode(true);
        }
        closeDev();
      } else if (ev.key === 'Escape') {
        closeDev();
      }
    }
    input.addEventListener('keydown', onKey);
  }

  function toggleDevMode(on) {
    state.devUnlocked = !!on;
    CONFIG.isBeta = !!on;
    const panel = document.getElementById('devPanel');
    const wm = document.getElementById('devWatermark');
    if (panel) panel.classList.toggle('active', state.devUnlocked);
    if (wm) wm.classList.toggle('active', state.devUnlocked);
    if (state.devUnlocked) buildDevPanel();
  }

  // Dev panel = internal testing aid: jump to any screen (Law §0.15 "internal testing").
  function buildDevPanel() {
    const jump = document.getElementById('devJump');
    if (!jump) return;
    jump.innerHTML = '';
    SCREENS.forEach(function (s) {
      const b = document.createElement('button');
      b.className = 'btn small';
      b.textContent = s.replace('Screen', '');
      b.addEventListener('click', function () { resumeGame(); showScreen(s); });
      jump.appendChild(b);
    });
  }

  /* ---- Boot/init: load data, then wire everything ------------------------ */
  function init() {
    wireNav();
    wireModeCompliance();
    wireKeyboardNav();
    const cmdInput = document.getElementById('commandInput');
    if (cmdInput) cmdInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleRaceCommand(cmdInput.value, computeTypingWpm(cmdInput.value));
        typing.start = 0;                                   // reset stopwatch for the next command
        return;
      }
      if (e.key === 'Escape') return;
      // Backspace = the brake. Not preventDefault'd — it still deletes the
      // character; it just lights the brake light and scrubs speed while it does.
      if (e.key === 'Backspace') { tapBrake(); return; }
      if (!typing.start && e.key.length === 1) typing.start = nowMs();   // stopwatch starts on 1st keystroke
      AUDIO.play('typing');
    });
    renderOptions();
    // Unlock audio on first gesture — pointer OR key (menus are keyboard-first).
    function unlockAudio() {
      AUDIO.init(); AUDIO.resume();
      document.removeEventListener('pointerdown', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
    }
    document.addEventListener('pointerdown', unlockAudio);
    document.addEventListener('keydown', unlockAudio);

    // Keep the command box focused during a race: clicking the road / HUD (anything
    // that isn't itself an interactive control) returns the caret to the box, so the
    // player never has to click it to resume typing.
    document.addEventListener('pointerdown', function (e) {
      if (state.currentScreen !== 'gameScreen') return;
      if (e.target.closest('button, a, input, select, textarea, [data-action]')) return;
      setTimeout(focusCommand, 0);   // after the browser's own focus handling
    });

    // Re-fit the active map when the window resizes (keeps it filling the field).
    let resizeT = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeT);
      resizeT = setTimeout(function () {
        if (state.currentScreen === 'gridScreen') renderMap('gridMap');
        if (state.currentScreen === 'gameScreen') renderMap('regionMap');
      }, 120);
    });

    const load = DATAMOD.loadGameData ? DATAMOD.loadGameData() : Promise.resolve();
    load.then(function () {
      const D = DATAMOD.DATA;
      if (D && D.courses && D.courses.length) {
        const def = CFG.DEFAULT_COURSE_ID && D.courses.find(c => c.id === CFG.DEFAULT_COURSE_ID);
        state.selectedCourseId = (def && def.id) || D.courses[0].id;
        state.raceOptions.courseSelect = state.selectedCourseId;
      }
      renderOptions();          // re-render now that courses are loaded
      renderCommandReference();
      renderLegends();
      renderMap('gridMap');
      renderMap('regionMap');
    });

    runBoot();   // boot animation runs in parallel with data load
  }

  // Debug hook (Demo/dev build) — inspect/drive the leg loop from the console.
  // openShiftChange('0600') pops the box for any schedule slot; best run while on
  // the game screen mid-leg. closeShiftChange() tears it down.
  window.PITSTOP_DEBUG = {
    race: race, activeBeat: activeBeat, startRace: startRace, startLeg: startLeg, state: state, loop: loop,
    openShiftChange: function (t) {
      openShiftBox(t || (state.raceOptions.startTime !== 'NONE' ? state.raceOptions.startTime : '0600'));
      return race.shift.box;
    },
    closeShiftChange: function () { closeShiftBox(true); },
    shift: race.shift,
    // Preview the tire-damage stages (design §05): setTire(0..10).
    setTire: function (h) { race.tireHealth = h; renderTireGauges(h); return deriveTire(h).stage; },
    deriveTire: deriveTire,
    damageTires: damageTires,
    // Traffic: inspect the live field, or force a car alongside you to test the bump.
    traffic: traffic,
    pullAlongside: function (i) {
      const c = traffic.cars[i || 0];
      if (!c) return null;
      c.z = 0; c.kph = race.speed; c.near = true;
      return c;
    },
    bump: bumpNearbyCar,
    setSpeed: function (kph) { race.speed = kph; race.hold = 0; return race.speed; },
    tapBrake: tapBrake,
    // Step the sim by a FIXED dt without rAF. The speed/traffic model is otherwise
    // only observable at 60fps in a focused tab — rAF is throttled to a dead stop
    // in a background one — so this makes the curve verifiable and tunable
    // deterministically: PITSTOP_DEBUG.step(1) advances exactly one second.
    step: function (dt) {
      const d = dt || 1 / 60;
      updateSpeed(d, nowMs());
      const eff = Math.min(spCfg('max', 200), race.speed);
      updateRoad(d, (eff / spCfg('max', 200)) * spCfg('legRate', 0.6));
      updateTraffic(d, eff);
      updateRaceHUD();
      return { speed: +race.speed.toFixed(2), braking: race.braking, tire: race.tireHealth };
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

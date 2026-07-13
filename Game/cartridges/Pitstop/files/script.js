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
                   'optionsScreen','gridScreen','gameScreen','endScreen'];

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
  const race = { on: false, paused: false, leg: null, pos: 0, vel: 0,
                 last: 0, t0: 0, startTs: 0, raf: 0, unitId: null, fromId: null, toId: null,
                 // Multi-leg route traversal (Slice 2): drive every base of the course
                 // for `laps` laps, finishing at Start/Finish. `stops` = the ordered
                 // base ids of ONE lap (loops re-append the start); `legIndex` = which
                 // segment of that list we're driving; `lap` = 1..laps.
                 stops: [], legIndex: 0, lap: 1, laps: 1, shiftFired: false,
                 speed: 0, hold: 0, wpm: 0,   // speed/WPM gauge (base..overflowMax); hold = decay-freeze secs
                 hitBases: {},   // base ids reached this lap (light up on the minimap)
                 // Shift Change overlay state (design note §2/§3). armed = a change is
                 // due this leg; open = the box is up; cleared = it's been resolved.
                 shift: { armed: false, slot: null, box: null, open: false, cleared: false } };
  let shiftClockTimer = 0, shiftClockLast = 0;
  const road = { phase: 0 };   // scroll phase for the procedural road POV

  /* ---- Screen router ------------------------------------------------------ */
  function showScreen(id) {
    SCREENS.forEach(function (s) {
      const el = document.getElementById(s);
      if (el) el.classList.toggle('active', s === id);
    });
    state.currentScreen = id;
    if (id !== 'gameScreen') stopRace();
    if (id === 'gridScreen') renderMap('gridMap');
    if (id === 'gameScreen') { renderRoad(); renderMap('regionMap'); startRace(); }
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

  /* ---- Road POV (main play surface) --------------------------------------
   * A procedural vector road that scrolls with speed — the primary surface now
   * that the map is a side minimap. Drop real art into CFG.ROAD_VIEW.image and
   * this uses it instead. The car never fully stops, so the road always drifts. */
  const ROAD = { HZ: 38, apex: 50, apexHalf: 1.6, baseHalf: 62, rungs: 14, speedK: 6 };

  function drawRoad() {
    const svg = document.getElementById('roadSvg');
    if (!svg) return;
    const art = (CFG.ROAD_VIEW || {}).image;
    if (art) { svg.innerHTML = '<image href="' + art + '" x="0" y="0" width="100" height="100" preserveAspectRatio="none"/>'; return; }
    const R = ROAD, ph = road.phase;
    let h = '<rect class="road-ground" x="0" y="' + R.HZ + '" width="100" height="' + (100 - R.HZ) + '"/>';
    // road surface trapezoid (narrow at horizon, wide at the bottom)
    h += '<polygon class="road-surface" points="' +
         (R.apex - R.apexHalf) + ',' + R.HZ + ' ' + (R.apex + R.apexHalf) + ',' + R.HZ + ' ' +
         (R.apex + R.baseHalf) + ',100 ' + (R.apex - R.baseHalf) + ',100"/>';
    // perspective rungs flowing toward the viewer + centre dashes
    for (let i = 0; i < R.rungs; i++) {
      const d = ((i + ph) % R.rungs) / R.rungs;       // 0 (far) .. 1 (near)
      const dd = d * d;                                // bunch detail near the horizon
      const y = R.HZ + (100 - R.HZ) * dd;
      const half = R.apexHalf + (R.baseHalf - R.apexHalf) * dd;
      const cls = (Math.floor(i + ph) % 2 === 0) ? 'road-rung a' : 'road-rung b';
      h += '<rect class="' + cls + '" x="' + (R.apex - half).toFixed(1) + '" y="' + y.toFixed(1) +
           '" width="' + (half * 2).toFixed(1) + '" height="' + Math.max(0.5, y * 0.02).toFixed(1) + '"/>';
      const cw = 0.4 + dd * 2.4;
      h += '<rect class="road-center" x="' + (R.apex - cw / 2).toFixed(1) + '" y="' + y.toFixed(1) +
           '" width="' + cw.toFixed(1) + '" height="' + Math.max(0.7, y * 0.03).toFixed(1) + '"/>';
    }
    // edges + horizon
    h += '<line class="road-edge" x1="' + (R.apex - R.apexHalf) + '" y1="' + R.HZ + '" x2="' + (R.apex - R.baseHalf) + '" y2="100"/>';
    h += '<line class="road-edge" x1="' + (R.apex + R.apexHalf) + '" y1="' + R.HZ + '" x2="' + (R.apex + R.baseHalf) + '" y2="100"/>';
    h += '<line class="road-horizon" x1="0" y1="' + R.HZ + '" x2="100" y2="' + R.HZ + '"/>';
    svg.innerHTML = h;
  }

  function renderRoad() { drawRoad(); }
  function updateRoad(dt, v) {
    road.phase = (road.phase + (v || 0) * dt * ROAD.speedK) % (ROAD.rungs * 2);
    drawRoad();
  }

  /* ===================== PHASE 1 — single-leg race loop ====================
   * Route-traversal impulse model (authorized 2026-06-20). SLICE 1: prove ONE
   * leg A→B with position-gated AP→ENP→BSE beats. Correct beat at its gate =
   * throttle burst; the unit coasts/drags between gates; a content error
   * sputters (momentum loss); a beat typed before its gate is a harmless no-op.
   * No laps / opponents / pit yet (those are Slices 2–3). */
  function pickUnit() {
    const u = (DATAMOD.DATA && DATAMOD.DATA.units) || [];
    return u.indexOf('2101') >= 0 ? '2101' : (u[0] || '2101');
  }

  function nowMs() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  // WPM for the command just submitted: (chars/5) / minutes since the first keystroke.
  function computeTypingWpm(text) {
    const chars = String(text || '').trim().length;
    if (!chars || !typing.start) return SP.optimalWpm || 45;   // no timing captured → assume optimal
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
    race.speed = SP.base != null ? SP.base : 25;   // gauge starts at idle base
    race.hold = 0; race.wpm = 0;
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
    road.phase = 0;
    race.hitBases[race.fromId] = true;                      // start of this leg counts as hit
    const legLabel = document.getElementById('roadLegLabel');
    if (legLabel) legLabel.textContent = (race.leg.toName || race.toId);
    renderRoad();
    renderMap('regionMap');                                 // light up the current dot
    const input = document.getElementById('commandInput');
    if (input) { input.disabled = false; input.value = ''; setTimeout(function () { input.focus(); }, 60); }
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

  function loop(ts) {
    if (!race.on || race.paused) return;
    if (!race.last) race.last = ts;
    if (!race.startTs) race.startTs = ts;               // race clock starts once, spans all legs/laps
    let dt = (ts - race.last) / 1000; race.last = ts;
    if (dt > 0.1) dt = 0.1;                                   // clamp tab-switch jumps
    // Speed gauge: hold after a boost, then decay gently toward the idle base.
    if (race.hold > 0) race.hold = Math.max(0, race.hold - dt);
    else race.speed = Math.max(SP.base || 25, race.speed - (SP.decay || 12) * dt);
    const eff = Math.min(SP.max || 100, race.speed);          // motion/display cap at 100
    const v = (eff / (SP.max || 100)) * (SP.legRate || 0.6);  // pos-units/sec
    race.pos = Math.min(1, race.pos + v * dt);
    updateRoad(dt, v);
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

  function updateRaceHUD(ts) {
    const beat = activeBeat();
    [['AP', 'cmdAP'], ['ENP', 'cmdENP'], ['BSE', 'cmdBSE']].forEach(function (pair) {
      const el = document.getElementById(pair[1]);
      if (el) el.classList.toggle('live', !!beat && beat.code === pair[0]);
    });
    const unitEl = document.getElementById('hudUnit');
    if (unitEl) unitEl.textContent = race.unitId || '—';

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

    // Speed gauge (0–50–100), driven by WPM. Overflow past 100 glows.
    const eff = Math.min(SP.max || 100, race.speed);
    const sp = document.getElementById('hudSpeed');
    if (sp) sp.textContent = Math.round(eff);
    const fill = document.getElementById('speedFill');
    if (fill) {
      fill.style.width = Math.max(0, Math.min(100, eff)) + '%';
      if (fill.parentNode) fill.parentNode.classList.toggle('overflow', race.speed > (SP.max || 100) + 0.5);
    }
    const wEl = document.getElementById('hudWpm');
    if (wEl) wEl.textContent = (race.wpm ? race.wpm : '—') + ' wpm';

    const lap = document.getElementById('hudLap');
    if (lap) lap.textContent = race.lap + '/' + race.laps;
    const legsPerLap = Math.max(1, (race.stops.length || 2) - 1);
    const pl = document.getElementById('hudPlace');
    if (pl) pl.textContent = Math.min(race.legIndex + 1, legsPerLap) + '/' + legsPerLap;
    if (ts && race.startTs) {
      const tEl = document.getElementById('hudTime');
      if (tEl) tEl.textContent = ((ts - race.startTs) / 1000).toFixed(1) + 's';
    }
  }

  function flashBox(cls) {
    const box = document.querySelector('#gameScreen .command-box');
    if (!box) return;
    box.classList.remove('hit', 'miss', 'early'); void box.offsetWidth; box.classList.add(cls);
    setTimeout(function () { box.classList.remove(cls); }, 320);
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
      flashBox('early'); AUDIO.play('back');
      showRadio('Shift Change pending — type LA to handle it before BSE.', '');
      return;
    }

    if (race.pos < beat.gate) { flashBox('early'); AUDIO.play('menu'); return; }   // no-op: too early
    if (DATAMOD.validateBeat(value, beat) === 'hit') {
      beat.done = true;
      applySpeedBoost(wpm);                                                         // gauge jump + hold
      AUDIO.play('select'); flashBox('hit');
    } else {
      race.speed = Math.max(SP.base || 25, race.speed * (T.sputterFactor || 0.45)); // bleed speed, no stall
      race.hold = 0;                                                                // and kill the hold
      AUDIO.play('back'); flashBox('miss');
    }
    updateRaceHUD();
  }

  // A correct command boosts the gauge (scaled by how fast it was typed), then it
  // HOLDS before decaying. Above 100 the hold lasts longer and the value overflows
  // (a buffer) so you stay at top speed longer — the reward for chaining fast.
  function applySpeedBoost(wpm) {
    const opt = SP.optimalWpm || 45;
    const minF = SP.minBoostFactor != null ? SP.minBoostFactor : 0.4;
    const factor = wpm ? Math.max(minF, Math.min(1, wpm / opt)) : 1;   // slow typing → smaller boost
    race.wpm = Math.round(wpm || 0);
    race.speed = Math.min(SP.overflowMax || 150, race.speed + (SP.boost || 25) * factor);
    const over = Math.max(0, race.speed - (SP.max || 100));
    race.hold = (SP.holdBase || 1.2) + over * (SP.holdOverflowPer || 0.03);
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

  function raceFinish() {
    race.on = false;
    cancelAnimationFrame(race.raf);
    const input = document.getElementById('commandInput');
    if (input) input.disabled = true;
    hideRadio();
    const cp = document.getElementById('challengePrompt');
    if (cp) cp.textContent = '🏁 RACE COMPLETE — ' + race.unitId + ' finished ' +
      race.laps + (race.laps > 1 ? ' laps' : ' lap');
    AUDIO.play('select');
    setTimeout(function () { if (state.currentScreen === 'gameScreen') showScreen('endScreen'); }, 1800);
  }

  function stopRace() { race.on = false; race.paused = false; cancelAnimationFrame(race.raf); resetShift(); }

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
        if (inField) return;                                   // Enter/Space in a field does its own thing
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
    shift: race.shift
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

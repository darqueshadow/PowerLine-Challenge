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
                   'optionsScreen','unitScreen','gridScreen','gameScreen','pitScreen','endScreen'];

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
  function bnCfg(key, dflt)   { const C = CFG.BANNER || {};  return C[key] != null ? C[key] : dflt; }

  const race = { on: false, paused: false, leg: null, pos: 0, vel: 0,
                 last: 0, t0: 0, startTs: 0, raf: 0, unitId: null, fromId: null, toId: null,
                 // Multi-leg route traversal (Slice 2): drive every base of the course
                 // for `laps` laps, finishing at Start/Finish. `stops` = the ordered
                 // base ids of ONE lap (loops re-append the start); `legIndex` = which
                 // segment of that list we're driving; `lap` = 1..laps.
                 stops: [], legIndex: 0, lap: 1, laps: 1, shiftFired: false,
                 legMode: 'sequence',   // 'sequence' (Type A) | 'timed' (Type B) — see PITSTOP_RACE_TYPE_AB.md
                 arriving: false,        // sequence done → car rolls the rest of the way into the base
                 // Race Type B banner window (ENP beat, 'timed' only). openPos/closePos
                 // are the two gantry positions (leg-fraction); `armed` latches so a
                 // missed window fires ONCE; `hold` caps pos at the final CLOSE banner
                 // (soft-lock backstop). Rebuilt per leg in startLeg / resetBanner.
                 // waitT = seconds spent approaching this window, for the 15s dead-time
                 // cap (BANNER.maxLeadSec). zoneA/zoneB bracket the painted hit zone.
                 banner: { active: false, openPos: 0.33, closePos: 0.5, armed: false, hold: false, stumbled: false,
                           els: null, waitT: 0, zoneA: 0, zoneB: 0 },
                 // CHECKPOINT boost (config BOOST). `until` is a nowMs() stamp; `dur` is
                 // what it started at, so the meter can draw a fraction remaining.
                 boost: { tier: null, until: 0, dur: 0 },
                 // Player steering (config STEER). `lane` is the car's line across the
                 // road on the same scale as the traffic lanes: 0 = centre, ±1 = rumble
                 // strip. `steer` is the raw key input (-1/0/+1). `hitUntil` is the
                 // post-contact immunity stamp.
                 lane: 0, steer: 0, hitUntil: 0,
                 speed: 0, hold: 0, wpm: 0,   // speed/WPM gauge (km/h, 0..overflowMax); hold = decay-freeze secs
                 braking: false, brakeUntil: 0,   // backspace = brake pedal; brakeUntil is a nowMs() stamp
                 tireHealth: 10,                  // 0–10; mistakes wear it down (see damageTires)
                 hitBases: {},   // base ids reached this lap (light up on the minimap)
                 // Shift Change overlay state (design note §2/§3). armed = a change is
                 // due this leg; open = the box is up; cleared = it's been resolved.
                 shift: { armed: false, slot: null, box: null, open: false, cleared: false } };
  let shiftClockTimer = 0, shiftClockLast = 0;
  const road = { phase: 0, spd: -1, curve: 0, dist: 0, stopped: false };   // spd = --road-spd; curve = live bend (-1..1); dist = curve-gen travel
  const carSprite = { unitId: null, ready: false, frame: null, base: null, lean: false };  // OutRun per-unit sprite state (lean = the r1/r2 bank frames exist)
  const traffic = { cars: [] };   // opponent cars circulating around the player (see TRAFFIC section)

  /* ---- Screen auto-fit (Andrew, 2026-07-19) -------------------------------
   * "The buttons are cropped out at the bottom. Is it possible for the entire
   * screen to be displayed, so it fits based on the player's resolution?"
   *
   * Every menu screen is measured against the viewport and scaled DOWN until it
   * fits. Nothing is ever below the fold, on any monitor, at any window size.
   *
   * The screens were authored with vh-based type and fixed-height cards, which is
   * fine until the two disagree — a short window shrinks the type but not the
   * unit card, and the buttons walk off the bottom. Rather than chase that with
   * more breakpoints, we scale the composed result: one number, one behaviour,
   * every screen, and the design's proportions survive.
   *
   * `zoom` is deliberate over `transform: scale()`. Zoom shrinks the layout box
   * itself, so the scaled content re-centres and the parent's overflow genuinely
   * resolves. A transform paints smaller but reserves the original space, so the
   * screen would still think it overflowed and still clip.
   *
   * Excluded from the wrapper (so they keep hugging the true screen edges at full
   * size): the CRT scanline, flag bands, chevron backdrop and version stamp —
   * furniture that is *about* the bezel, not content inside it.
   *
   * The game screen is NOT fitted. It is built to FILL (flex column, road view
   * takes the slack) — scaling it would letterbox the road, which is the one
   * thing that should always own the whole panel. */
  const FIT_SCREENS = ['titleScreen','menuScreen','instructionsScreen',
                       'optionsScreen','unitScreen','gridScreen','endScreen'];
  // Furniture that must stay outside the scaled wrapper (see above).
  const FIT_EXCLUDE = '.crt-scan, .version-stamp, .title-chevrons, .flag-band';
  // Don't shrink past this. Below it the type stops being readable, and an
  // unreadable menu that technically fits is worse than one you can scroll.
  const FIT_MIN = 0.55;

  // Move each fitted screen's flow content into a .screen-inner wrapper. Runs
  // once at init; renderers that rebuild content write INTO the wrapper because
  // they target ids/classes that moved with it.
  function wrapScreens() {
    FIT_SCREENS.forEach(function (id) {
      const el = document.getElementById(id);
      if (!el || el.querySelector(':scope > .screen-inner')) return;
      const inner = document.createElement('div');
      inner.className = 'screen-inner';
      // Snapshot first: appending to `inner` mutates el.childNodes as we walk it.
      Array.prototype.slice.call(el.childNodes).forEach(function (n) {
        if (n.nodeType === 1 && n.matches(FIT_EXCLUDE)) return;   // furniture stays put
        inner.appendChild(n);
      });
      el.insertBefore(inner, el.firstChild);
      el.classList.add('fitted');
    });
  }

  // Measure one screen and write its scale. Must reset --fit to 1 before
  // measuring: scrollHeight is reported in ZOOMED pixels, so measuring while a
  // previous scale is applied would compound it and the screen would shrink a
  // little more on every call.
  function fitScreen(id) {
    const el = document.getElementById(id || state.currentScreen);
    if (!el || !el.classList.contains('fitted')) return;
    const inner = el.querySelector(':scope > .screen-inner');
    if (!inner) return;
    const wasHidden = !el.classList.contains('active');
    if (wasHidden) { el.style.visibility = 'hidden'; el.classList.add('active'); }
    inner.style.setProperty('--fit', '1');
    // Read the padding box: .screen carries 4vh/4vw of padding that the content
    // must live inside, so the available box is the client box less that padding.
    const cs = getComputedStyle(el);
    const availH = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const availW = el.clientWidth  - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const needH = inner.scrollHeight, needW = inner.scrollWidth;
    let fit = 1;
    if (needH > availH) fit = Math.min(fit, availH / needH);
    if (needW > availW) fit = Math.min(fit, availW / needW);
    fit = Math.max(FIT_MIN, Math.min(1, fit));
    inner.style.setProperty('--fit', fit.toFixed(4));
    if (wasHidden) { el.classList.remove('active'); el.style.visibility = ''; }
  }

  // Re-fit after anything that changes a screen's height. Measured TWICE on
  // purpose: once now, so the screen is never shown unscaled even for a frame, and
  // once on the next frame, to catch content whose layout wasn't final yet (a map
  // SVG that sizes itself, a web font swapping in). The second pass is also the
  // safety net for a throttled rAF — if it runs late, the synchronous pass has
  // already produced a usable scale rather than leaving the screen unfitted.
  function refit(id) {
    const target = id || state.currentScreen;
    fitScreen(target);
    requestAnimationFrame(function () { fitScreen(target); });
  }

  /* ---- Screen router ------------------------------------------------------ */
  function showScreen(id) {
    SCREENS.forEach(function (s) {
      const el = document.getElementById(s);
      if (el) el.classList.toggle('active', s === id);
    });
    state.currentScreen = id;
    if (id !== 'gameScreen') stopRace();
    if (id === 'optionsScreen') renderCoursePreview();   // (re)measure the preview map now it's visible
    if (id === 'unitScreen') renderUnitScreen();
    if (id === 'gridScreen') renderMap('gridMap');
    if (id === 'gameScreen') { applyRaceLook(); renderRoad(); renderMap('regionMap'); startRace(); requestAnimationFrame(focusCommand); }
    // Pit-box preview (design §② inPit) — rebuilt each time it's shown; torn down
    // on the way out. Sandbox only — see PitBox (touches no race state).
    if (id === 'pitScreen') PitBox.open(); else PitBox.close();
    // A screen that scrolls (Options / Unit) keeps its old scroll offset when you
    // return to it, so it can open mid-page. Always start freshly-shown screens
    // at the top — the focusPrimary() below uses preventScroll to keep it there.
    const shown = document.getElementById(id);
    if (shown) { shown.scrollTop = 0; markNavTargets(shown); }
    refit(id);            // scale this screen to the window before focusing into it
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
    if (primary) setTimeout(function () { primary.focus({ preventScroll: true }); }, 40);
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
    // The four PowerLine challenges (Andrew, 2026-07-17): AP + base number; ENP
    // (no base number); LA + base number (local-area calls); BSE + base number.
    const meanings = { AP: 'Assign / Post to a base · AP + unit + base number', ENP: 'Enroute — unit is mobile · ENP + unit (no base number)',
                       BSE: 'Based — unit has arrived · BSE + unit + base number', LA: 'Local area · LA + unit + base number' };
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
      // The Unit picker moved to its own screen (unitScreen) — skip it here.
      if (opt.control === 'unitpick') return;
      // Race Type is a Type A ⇄ Type B slide toggle (sequence vs timed legs).
      if (opt.key === 'legMode')      { grid.appendChild(buildLegModeRow()); return; }
      // Course Type is a Circuit ⇄ Point 2 Point toggle, not a <select>.
      if (opt.key === 'courseType')   { grid.appendChild(buildCourseTypeRow()); return; }
      // Course is a preview carousel (route map + base list), not a <select>.
      if (opt.key === 'courseSelect') { grid.appendChild(buildCourseCarouselRow()); renderCoursePreview(); return; }

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
        state.raceOptions[opt.key] = (opt.type === 'int') ? Number(ctrl.value) : ctrl.value;
        AUDIO.play('select');
      });
      row.appendChild(ctrl);
      grid.appendChild(row);
    });
    markNavTargets(document.getElementById('optionsScreen'));
    refit('optionsScreen');
  }

  /* ---- Race Type toggle (Type A ⇄ Type B) ----------------------------------
   * Resolved to the HYBRID (Andrew, 2026-07-17): Type A now gates AP & ENP on
   * SEQUENCE ORDER only, but the final BSE ARRIVAL on TRACK POSITION (drive up to
   * the base to finish). Type B stays fully position-gated. Reuses the ctype
   * slide-toggle styling. Left = A (hybrid), right = B (timed). See
   * PITSTOP_RACE_TYPE_AB.md. */
  // ⚠ The internal key stays 'timed' (it is written into saved race options and
  // read all through the leg loop); only the PLAYER-FACING name changed. Andrew,
  // 2026-07-19: "Timed … comes across like the player will be racing against the
  // clock" — which is exactly backwards, since Type B is about hitting points on
  // the track, not beating a stopwatch. CHECKPOINT names the gantries you drive
  // through. Rename the key too if it ever stops being load-bearing.
  const LEGMODE_META = {
    sequence: { tag: 'Type A', sub: 'Sprint' },       // left  · commands order-gated, BSE needs the base (hybrid)
    timed:    { tag: 'Type B', sub: 'Checkpoint' }    // right · every beat gated at a point on the track
  };

  function buildLegModeRow() {
    const mode = state.raceOptions.legMode === 'timed' ? 'timed' : 'sequence';
    const row = document.createElement('div');
    row.className = 'opt-row legmode-row';
    const label = document.createElement('label');
    label.textContent = 'Race Type';
    const toggle = document.createElement('div');
    // is-circuit → knob left (A) · is-p2p → knob right (B): reuse ctype knob slide.
    toggle.className = 'ctype-toggle legmode-toggle ' + (mode === 'timed' ? 'is-p2p' : 'is-circuit');
    toggle.innerHTML =
      '<button type="button" class="ctype-side left" data-mode="sequence">' +
        LEGMODE_META.sequence.tag + '<small>' + LEGMODE_META.sequence.sub + '</small></button>' +
      '<button type="button" class="ctype-switch" role="switch" aria-checked="' + (mode === 'timed') +
        '"><i class="knob"></i></button>' +
      '<button type="button" class="ctype-side right" data-mode="timed">' +
        LEGMODE_META.timed.tag + '<small>' + LEGMODE_META.timed.sub + '</small></button>';
    toggle.querySelector('.ctype-switch').addEventListener('click', function () {
      setLegMode(mode === 'timed' ? 'sequence' : 'timed');
    });
    Array.prototype.forEach.call(toggle.querySelectorAll('.ctype-side'), function (b) {
      b.addEventListener('click', function () { setLegMode(b.getAttribute('data-mode')); });
    });
    row.appendChild(label);
    row.appendChild(toggle);
    return row;
  }

  function setLegMode(mode) {
    if (mode !== 'sequence' && mode !== 'timed') return;
    if (state.raceOptions.legMode === mode) return;
    state.raceOptions.legMode = mode;
    AUDIO.play('select');
    renderOptions();                 // rebuild the toggle in its new position
  }

  /* ---- Course Type toggle (Circuit ⇄ Point 2 Point) ------------------------
   * Andrew's call (2026-07-17): the Course Type dropdown becomes a physical
   * toggle with the two closures named on either side. Flipping it re-filters
   * the course carousel below; if the current pick no longer fits the new
   * closure, it snaps to the first course of that type. 'loop' reads "Circuit";
   * 'point-to-point' reads "Point 2 Point" (placeholder name). */
  const CTYPE_LABEL = { 'loop': 'Circuit', 'point-to-point': 'Point 2 Point' };

  function buildCourseTypeRow() {
    const type = state.raceOptions.courseType || 'loop';
    const row = document.createElement('div');
    row.className = 'opt-row course-type-row';
    const label = document.createElement('label');
    label.textContent = 'Course Type';
    const toggle = document.createElement('div');
    toggle.className = 'ctype-toggle ' + (type === 'point-to-point' ? 'is-p2p' : 'is-circuit');
    toggle.innerHTML =
      '<button type="button" class="ctype-side left" data-type="loop">' + CTYPE_LABEL.loop + '</button>' +
      '<button type="button" class="ctype-switch" role="switch" aria-checked="' + (type === 'point-to-point') +
        '"><i class="knob"></i></button>' +
      '<button type="button" class="ctype-side right" data-type="point-to-point">' + CTYPE_LABEL['point-to-point'] + '</button>';
    toggle.querySelector('.ctype-switch').addEventListener('click', function () {
      setCourseType(type === 'point-to-point' ? 'loop' : 'point-to-point');
    });
    Array.prototype.forEach.call(toggle.querySelectorAll('.ctype-side'), function (b) {
      b.addEventListener('click', function () { setCourseType(b.getAttribute('data-type')); });
    });
    row.appendChild(label);
    row.appendChild(toggle);
    return row;
  }

  function setCourseType(type) {
    if (type !== 'loop' && type !== 'point-to-point') return;
    if (state.raceOptions.courseType === type) return;
    state.raceOptions.courseType = type;
    // Keep the course pick valid for the new closure; else snap to its first course.
    const list = coursesForType(type);
    if (!list.some(function (c) { return c.id === state.selectedCourseId; })) {
      state.selectedCourseId = list[0] ? list[0].id : 'random';
      state.raceOptions.courseSelect = state.selectedCourseId;
    }
    AUDIO.play('select');
    renderOptions();                 // rebuild toggle + carousel for the new type
    renderMap('gridMap'); renderLegends();
  }

  /* ---- Course carousel (route preview + base list) -------------------------
   * Replaces the Course <select>: a preview card paged with ◀ / ▶ (or Left/Right
   * on the Options screen). Each real course shows its route map plus the stops
   * listed BY NAME; a synthetic RANDOM card always trails the real ones and
   * follows the selected closure. */
  function coursesForType(type) {
    const t = (type === 'point-to-point') ? 'point-to-point' : 'loop';
    const courses = (DATAMOD.DATA && DATAMOD.DATA.courses) || [];
    const list = courses
      .filter(function (c) { return (c.type || 'loop') === t; })
      .map(function (c) { return { id: c.id, name: c.name, type: t, baseIds: c.baseIds }; });
    list.push({ id: 'random', name: 'Random Draw', type: t, random: true });
    return list;
  }

  function buildCourseCarouselRow() {
    const row = document.createElement('div');
    row.className = 'opt-row course-carousel-row';
    const label = document.createElement('label');
    label.textContent = 'Course';
    const carousel = document.createElement('div');
    carousel.className = 'course-carousel';
    carousel.innerHTML =
      '<button type="button" class="cc-arrow prev" aria-label="Previous course">◀</button>' +
      '<div class="cc-stage" id="coursePreview"></div>' +
      '<button type="button" class="cc-arrow next" aria-label="Next course">▶</button>';
    carousel.querySelector('.cc-arrow.prev').addEventListener('click', function () { moveCourse(-1); });
    carousel.querySelector('.cc-arrow.next').addEventListener('click', function () { moveCourse(1); });
    row.appendChild(label);
    row.appendChild(carousel);
    return row;
  }

  // Page the carousel by `dir` (+1 next / -1 prev), wrapping. Sets the course and
  // refreshes the preview + the grid map that reads state.selectedCourseId.
  function moveCourse(dir) {
    const list = coursesForType(state.raceOptions.courseType || 'loop');
    if (!list.length) return;
    let idx = list.findIndex(function (c) { return c.id === state.selectedCourseId; });
    if (idx < 0) idx = 0;
    idx = (idx + dir + list.length) % list.length;
    state.selectedCourseId = list[idx].id;
    state.raceOptions.courseSelect = state.selectedCourseId;
    AUDIO.play('select');
    renderCoursePreview();
    renderMap('gridMap'); renderLegends();
    refit('optionsScreen');   // a longer stop list makes the card taller
  }

  function renderCoursePreview() {
    const stage = document.getElementById('coursePreview');
    if (!stage) return;
    const type = state.raceOptions.courseType || 'loop';
    const list = coursesForType(type);
    let idx = list.findIndex(function (c) { return c.id === state.selectedCourseId; });
    if (idx < 0) {
      idx = 0;
      state.selectedCourseId = list[0] ? list[0].id : 'random';
      state.raceOptions.courseSelect = state.selectedCourseId;
    }
    const entry = list[idx];
    const counter = '<div class="cc-index">' + (idx + 1) + ' / ' + list.length + '</div>';
    const typeName = CTYPE_LABEL[type] || type;

    if (!entry) { stage.innerHTML = '<div class="cc-card empty">No courses</div>'; return; }

    // RANDOM has no fixed route to draw — it's sampled at the line — so it gets a
    // "surprise" card instead of a map.
    if (entry.random) {
      stage.innerHTML =
        '<div class="cc-card cc-random">' +
          '<div class="cc-head"><span class="cc-name">Random Draw</span>' +
            '<span class="cc-count">' + typeName + '</span></div>' +
          '<div class="cc-random-body"><span class="cc-die">🎲</span>' +
            '<p>A fresh course of ' + (CFG.COURSE_MAX_BASES || 5) + ' bases, drawn at the start line.</p></div>' +
          counter +
        '</div>';
      return;
    }

    // Real course: the route map + the stops listed by NAME (drive order).
    const D = DATAMOD.DATA;
    const course = DATAMOD.getActiveCourse ? DATAMOD.getActiveCourse(entry.id) : null;
    const ids = (course ? course.baseIds : entry.baseIds) || [];
    const startId = course ? course.startId : ids[0];
    const stops = ids.map(function (id, i) {
      const b = D && D.baseById[id];
      const nm = (b && b.name) ? b.name : id;
      // The ordinal is safe HERE — in a vertical list, position already reads as
      // order, so a number beside a name can't be mistaken for the base's own
      // identity the way it could on a map dot. The code is shown alongside so
      // both numbers are visible and obviously different things.
      const tag = (id === startId) ? '<span class="cc-flag">⚑</span>'
                                   : '<span class="cc-n">' + i + '</span>';
      return '<li>' + tag + '<span class="cc-stop-name">' + nm +
             '</span><span class="cc-stop-code">' + id + '</span></li>';
    }).join('');
    stage.innerHTML =
      '<div class="cc-card">' +
        '<div class="cc-head"><span class="cc-name">' + (entry.name || entry.id) + '</span>' +
          '<span class="cc-count">' + ids.length + ' stops · ' + typeName + '</span></div>' +
        '<div class="cc-body">' +
          '<div class="cc-map"><svg id="coursePreviewMap" preserveAspectRatio="xMidYMid meet"></svg></div>' +
          '<ol class="cc-stops">' + stops + '</ol>' +
        '</div>' +
        counter +
      '</div>';
    renderMap('coursePreviewMap');   // reads state.selectedCourseId = entry.id
  }

  /* ---- Unit selection screen (own screen after Course) ---------------------
   * The chip row (one per SELECTABLE_UNIT, hotkeys spread 1·3·5·7·9) over the
   * full detail card. Each chip's text box now carries the unit NUMBER and its
   * CLASS (e.g. "Unit 2107 · All-Rounder"). Chip tint is a placeholder for the
   * unit's future distinct car sprite. Built on show (showScreen). */
  function renderUnitScreen() {
    const body = document.getElementById('unitScreenBody');
    if (!body) return;
    body.innerHTML = '';
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
        '<span class="chip-id">Unit ' + u.id + '</span>' +
        '<span class="chip-cls">' + (u.cls || '') + '</span>';
      chip.addEventListener('click', function () { selectUnit(u.id); });
      pick.appendChild(chip);
    });
    const detail = document.createElement('div');
    detail.className = 'unit-detail';
    detail.id = 'unitDetail';
    body.appendChild(hint);
    body.appendChild(pick);
    body.appendChild(detail);
    renderUnitDetail(state.raceOptions.unit);   // fill the card for the current pick
    markNavTargets(document.getElementById('unitScreen'));
    refit('unitScreen');
  }

  // Player picks which unit (truck) they drive — replaces the old Car option.
  // Called by a chip click and by the number-key hotkeys (1·3·5·7·9). Only
  // updates state + the chip highlight here; pickUnit() reads
  // state.raceOptions.unit when the race actually starts.
  function selectUnit(id) {
    const units = (CFG.SELECTABLE_UNITS || []);
    if (!units.some(function (u) { return u.id === id; })) return;
    state.raceOptions.unit = id;
    const chips = document.querySelectorAll('.unit-chip');
    Array.prototype.forEach.call(chips, function (c) {
      c.classList.toggle('sel', c.getAttribute('data-unit') === id);
    });
    renderUnitDetail(id);            // refresh the car / stats / pros-cons card
    refit('unitScreen');             // pros/cons lists differ in length between units
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
    return DATAMOD.getActiveCourse
      ? DATAMOD.getActiveCourse(state.selectedCourseId, state.raceOptions.courseType)
      : null;
  }

  // Fit a course's bases (by lat/lon) to FILL the W×H box on both axes so the
  // route uses the whole field, regardless of area. Cosine-corrected (real
  // proportions), north-up. Each axis stretches to fill, but the stretch is
  // capped (DISTORT_CAP) so an elongated course never gets grotesquely warped —
  // beyond the cap that axis just centers with a margin. Returns { id:{x,y} }.
  //
  // Returns { at: { id:{x,y} }, project: fn(lat,lon)->{x,y} }. `project` applies
  // the SAME transform to any lat/lon, so the municipality backdrop
  // (core/region.js) lands in register with the base dots.
  //
  // `frame` (optional) is an extra list of {lat,lon} the fit must also contain —
  // the corners of the municipality patchwork, so the region is never cropped by
  // the tighter box the course bases alone would produce.
  const DISTORT_CAP = 1.6;
  function fitCourseToBox(bases, W, H, pad, frame) {
    const out = {};
    const geo = bases.filter(function (b) { return b.lat != null && b.lon != null; });
    if (!geo.length) return { at: out, project: function () { return { x: W / 2, y: H / 2 }; } };
    const meanLat = geo.reduce(function (s, b) { return s + b.lat; }, 0) / geo.length;
    const k = Math.cos(meanLat * Math.PI / 180);
    const px = function (b) { return b.lon * k; }, py = function (b) { return b.lat; };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    // The extent covers the bases PLUS the optional frame, so the patchwork fits.
    geo.concat(frame || []).forEach(function (b) {
      minX = Math.min(minX, px(b)); maxX = Math.max(maxX, px(b));
      minY = Math.min(minY, py(b)); maxY = Math.max(maxY, py(b));
    });
    const spanX = maxX - minX, spanY = maxY - minY, eps = 1e-9;
    const availW = W - 2 * pad, availH = H - 2 * pad;
    let sX = spanX > eps ? availW / spanX : null;   // px per unit to fill X
    let sY = spanY > eps ? availH / spanY : null;   // px per unit to fill Y
    if (sX != null && sY != null) {
      // With a frame (the municipality patchwork) the map is drawing a REAL
      // PLACE, so scale uniformly — stretching an axis to fill the box would
      // squash Niagara into a shape that is no longer Niagara. Bases-only fits
      // keep the old behaviour: stretch each axis to fill, capped so a long
      // thin course never gets grotesque.
      const cap = (frame && frame.length) ? 1 : DISTORT_CAP;
      if (sX > sY * cap) sX = sY * cap;
      if (sY > sX * cap) sY = sX * cap;
    } else if (sX == null && sY != null) { sX = sY; }
    else if (sY == null && sX != null) { sY = sX; }
    const drawW = sX != null ? spanX * sX : 0, drawH = sY != null ? spanY * sY : 0;
    const offX = pad + (availW - drawW) / 2, offY = pad + (availH - drawH) / 2;
    const project = function (lat, lon) {
      return {
        x: sX == null ? W / 2 : offX + (lon * k - minX) * sX,
        y: sY == null ? H / 2 : offY + (maxY - lat) * sY               // flip (north up)
      };
    };
    const seen = {};
    geo.forEach(function (b) {
      const p = project(b.lat, b.lon);
      let x = p.x, y = p.y;
      const key = Math.round(x) + ',' + Math.round(y);
      const n = seen[key] || 0; seen[key] = n + 1;
      if (n > 0) { const a = n * 1.7, d = Math.min(W, H) * 0.03; x += Math.cos(a) * d; y += Math.sin(a) * d; }
      out[b.id] = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    });
    return { at: out, project: project };
  }

  /* ---- Tire marker helper (Andrew, 2026-07-17) ----------------------------
   * The off-route pit is drawn as a racecar TIRE. Pure SVG, so nothing external
   * is fetched (geo spec §3: schematic, no map tiles). The region backdrop that
   * used to live here — a smoothed convex hull of the course bases — was
   * replaced on 2026-07-19 by the municipality patchwork in core/region.js. */
  // A small racecar tire (black slick + silver rim + spokes), centred at (cx,cy).
  function tireSVG(cx, cy, r) {
    const rim = r * 0.60, hub = r * 0.20, sw = Math.max(0.3, r * 0.09);
    let g = '<g class="map-tire" transform="translate(' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ')">';
    g += '<circle r="' + r.toFixed(2) + '" fill="#141414" stroke="#000" stroke-width="' + (r * 0.12).toFixed(2) + '"/>';
    g += '<circle r="' + (r * 0.82).toFixed(2) + '" fill="none" stroke="#2b2b2b" stroke-width="' + (r * 0.07).toFixed(2) + '"/>';
    g += '<circle r="' + rim.toFixed(2) + '" fill="#cfd3d8" stroke="#83888f" stroke-width="' + sw.toFixed(2) + '"/>';
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2 - Math.PI / 2;
      const x1 = (Math.cos(a) * hub).toFixed(2), y1 = (Math.sin(a) * hub).toFixed(2);
      const x2 = (Math.cos(a) * rim * 0.9).toFixed(2), y2 = (Math.sin(a) * rim * 0.9).toFixed(2);
      g += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#9aa0a6" stroke-width="' + sw.toFixed(2) + '" stroke-linecap="round"/>';
    }
    g += '<circle r="' + hub.toFixed(2) + '" fill="#6b6e73" stroke="#3a3c40" stroke-width="' + (r * 0.05).toFixed(2) + '"/>';
    g += '</g>';
    return g;
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
    // Fleet is OFF a Point 2 Point course (Andrew, 2026-07-19): the pit lane is a
    // bypass that splits off the route and rejoins it, which only reads on a
    // circuit you come back around. A point-to-point run never returns to the
    // start, so Fleet is dropped entirely — no lane, no tire, and it is excluded
    // from the map fit so the course still fills the field.
    const showPit = !!(pit && !pitOnCourse && course.type !== 'point-to-point');

    // viewBox = the container's real pixel size, so the SVG fills the field
    // with no letterboxing. Re-measured every render (handles resize).
    const W = Math.round(svg.clientWidth) || 100;
    const H = Math.round(svg.clientHeight) || 80;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    const unit = Math.min(W, H);

    // The gameplay minimap (regionMap) is the CHALLENGE and is small: it gets
    // bigger dots that can each carry a drive-order digit, and no name labels
    // (the two base boxes above it carry the names). The grid preview keeps the
    // small dots + full labels. The Race-Options course-carousel preview
    // (coursePreviewMap) is likewise compact — the stops list beside it carries
    // the names, so labels on the little map would just clutter it.
    const compact = (svgId === 'regionMap' || svgId === 'coursePreviewMap');

    // Fit the COURSE BASES to fill the field, regardless of area. When a real
    // geo-referenced map image lands (REGION_MAP.image+bounds) we'd align dots
    // to the art instead.
    //
    // Fleet is NOT in the fit (Andrew, 2026-07-19): "ignore the lat/lon for
    // Fleet — put it beside the Start/Stop base". The pit is track furniture,
    // not a place you navigate to, and its real address (2 Westwood Ct, shared
    // with Glendale) can sit far off the course — which dragged the whole fit
    // sideways and stranded the tire nowhere near the start line. It is now
    // PLACED, not projected: pinned just outside the start/finish node (see
    // pitPos below), which is where the pit lane physically is anyway.
    //
    // MUNICIPALITY BACKDROP (core/region.js): the cells this course touches — or
    // all twelve on the full race. Built BEFORE the fit so their corners can go
    // to fitCourseToBox as the frame it must contain; sized to the bases alone,
    // the box would crop the patchwork.
    const REGION = window.PITSTOP_REGION || null;
    let cells = [];
    if (REGION) {
      // baseById gives municipalitiesFor the coordinates it needs to work out
      // which municipalities the route DRIVES ACROSS, not just stops in.
      const want = REGION.municipalitiesFor(course, D.baseById);
      cells = REGION.buildCells(D.baseById).filter(function (c) { return want[c.id]; });
    }
    const frame = [];
    cells.forEach(function (c) { c.rings.forEach(function (r) { r.forEach(function (p) { frame.push(p); }); }); });

    // The patchwork already carries its own margin (region.js expands the
    // silhouette past the outermost bases), so stacking the full base-map pad on
    // top of it just shrinks the region inside the frame. Bases-only fits keep
    // the roomier pad — there, the dots ARE the edge and need the breathing room.
    const pad = unit * (cells.length ? 0.04 : 0.12);

    const FIT = fitCourseToBox(bases, W, H, pad, frame);
    const C = FIT.at;

    const nodeR = (compact ? unit * 0.034 : unit * 0.022), ringR = unit * 0.040, sfR = unit * 0.028, pitR = unit * 0.028;
    const font = unit * 0.032, stroke = Math.max(1, unit * 0.006), chk = unit * 0.018;
    const pid = 'sfChecker_' + svgId;

    let html = '<defs><pattern id="' + pid + '" width="' + (chk * 2) + '" height="' + (chk * 2) +
      '" patternUnits="userSpaceOnUse">' +
      '<rect width="' + (chk * 2) + '" height="' + (chk * 2) + '" fill="#f4fff0"/>' +
      '<rect width="' + chk + '" height="' + chk + '" fill="#0a0a0a"/>' +
      '<rect x="' + chk + '" y="' + chk + '" width="' + chk + '" height="' + chk + '" fill="#0a0a0a"/></pattern></defs>';

    // REGION BACKDROP (Andrew, 2026-07-19): a cartoon PATCHWORK of Niagara's
    // municipalities — the ones this course touches, or all twelve on the full
    // race. Replaces the old smoothed hull, which hugged whatever bases the
    // course used and so read as a green smear rather than as anywhere. Drawn
    // FIRST, so the kerb, the nodes and the pit all sit on top of it. Cell
    // geometry + palette live in core/region.js.
    if (cells.length) {
      const cellStroke = Math.max(0.6, stroke * 0.8);
      html += '<g class="map-muni">';
      cells.forEach(function (c) {
        // One polygon per ring — a municipality can be more than one land mass.
        c.rings.forEach(function (ring) {
          const pts = ring.map(function (p) {
            const q = FIT.project(p.lat, p.lon);
            return q.x.toFixed(1) + ',' + q.y.toFixed(1);
          }).join(' ');
          html += '<polygon class="muni-cell" points="' + pts + '" fill="' + c.fill +
                  '" stroke="' + c.stroke + '" style="stroke-width:' + cellStroke.toFixed(2) + '"/>';
        });
      });
      html += '</g>';
      // Deliberately NO municipality name labels. The maps that have room for
      // them (the grid preview) already carry a name on every base, and twelve
      // more strings collided with those into an unreadable mess; the maps that
      // have no base labels (the minimap, the course carousel) are far too small
      // to set type on. Colour and shape carry the region on their own.
    }

    // pit LANE: Fleet reads as a lane that SPLITS off the main course and
    // REJOINS it (a bypass bowing out to the pit), not a dead-end spur. Branch
    // + merge points sit on the route segments either side of the junction (the
    // nearest on-route base to the pit); the lane's midpoint passes through
    // Fleet so the ⛽ box sits right on the lane.
    // FLEET PLACEMENT — geometry, not geography (see the fit note above). The
    // tire is pinned just OUTSIDE the start/finish node, pushed straight away
    // from the course's centre so it clears the route and leaves room for its
    // own lane to bow out. Clamped to the viewBox so a start node near an edge
    // can't push the tire off-screen. A degenerate course whose centre lands on
    // the start node falls back to "due left of start".
    let pitPos = null;
    const startPt = C[course.startId] || (bases[0] && C[bases[0].id]);
    if (showPit && startPt) {
      const hp = bases.map(function (b) { return C[b.id]; }).filter(Boolean);
      const gx = hp.reduce(function (s, p) { return s + p.x; }, 0) / hp.length;
      const gy = hp.reduce(function (s, p) { return s + p.y; }, 0) / hp.length;
      let dx = startPt.x - gx, dy = startPt.y - gy;
      const len = Math.hypot(dx, dy);
      if (len < 1e-3) { dx = -1; dy = 0; } else { dx /= len; dy /= len; }
      const m = unit * 0.07;
      pitPos = {
        x: Math.max(m, Math.min(W - m, startPt.x + dx * unit * 0.14)),
        y: Math.max(m, Math.min(H - m, startPt.y + dy * unit * 0.14))
      };
    }

    let junction = null;
    if (showPit && pitPos) {
      // The pit lane branches off around the START/FINISH base (Andrew's call) —
      // the pit sits by the start line, splitting off and rejoining there.
      junction = D.baseById[course.startId] || bases[0];
      if (junction && C[junction.id]) {
        const J = C[junction.id], F = pitPos;
        const order = course.baseIds, n = order.length, idx = order.indexOf(junction.id);
        const isLoop = course.type === 'loop' && n > 2;
        const prev = (idx > 0) ? C[order[idx - 1]] : (isLoop ? C[order[n - 1]] : null);
        const next = (idx < n - 1) ? C[order[idx + 1]] : (isLoop ? C[order[0]] : null);
        const lerp = function (a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; };
        // Split just before the junction, merge just after it. When a neighbour
        // is missing (a degenerate 2-stop loop — point-to-point no longer reaches
        // here), fall back to a short offset toward the pit so the lane still
        // leaves and returns near the junction.
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
        html += '<path class="map-spur" d="' + d + '" style="stroke-width:' + (stroke * 1.6).toFixed(2) + '"/>';
      }
    }

    // ROUTE LINE (drive order); closed for a loop, open for point-to-point.
    // Drawn as a KERB (Andrew, 2026-07-19) — red/white blocks like the side of
    // the track: a solid WHITE stroke with a dashed RED stroke laid over it, so
    // the red's gaps show the white through. Both are the same width; only the
    // red carries the dash. Pitch scales with the line so the blocks stay
    // readable from the tiny in-race minimap up to the full grid preview.
    const coords = course.baseIds.map(function (id) { return C[id] ? (C[id].x + ',' + C[id].y) : null; }).filter(Boolean);
    const kerbW = stroke * 2.4;                       // "thicker" — was `stroke`
    const kerbDash = (kerbW * 1.6).toFixed(2);        // block length == gap length
    const routeTag = (course.type === 'loop' && coords.length > 2) ? 'polygon' : 'polyline';
    html += '<' + routeTag + ' class="map-route-base" points="' + coords.join(' ') +
            '" style="stroke-width:' + kerbW.toFixed(2) + '" />';
    html += '<' + routeTag + ' class="map-route" points="' + coords.join(' ') +
            '" style="stroke-width:' + kerbW.toFixed(2) + ';stroke-dasharray:' + kerbDash + ' ' + kerbDash + '" />';

    /* DIRECTION ARROWS (Andrew, 2026-07-19) — one per leg, at its midpoint,
     * pointing the way you drive.
     *
     * These REPLACE the drive-order digits that used to sit inside each node.
     * Andrew: "Linwell is the fourth stop so it is indicated by the number 4, but
     * my brain is thinking 2, because it is base number 72102." The dot was
     * carrying two competing numeric identities, and the ordinal was the one with
     * no other job in the game — you never type it, the radio never says it, the
     * road sign never shows it. The only thing it genuinely told you that the
     * route line didn't was WHICH WAY ROUND, and an arrow says that without
     * putting a rival number on a base. The base code now appears on the label
     * instead, so every number on the map is one you'd actually type.
     *
     * White fill + dark edge is chosen to survive the kerb underneath it: on a red
     * block the white reads, on a white block the dark edge defines it. Amber and
     * red stay reserved for the pit lane and the route. */
    const legPts = course.baseIds.map(function (id) { return C[id] || null; });
    const arrowLegs = [];
    for (let i = 0; i < legPts.length - 1; i++) {
      if (legPts[i] && legPts[i + 1]) arrowLegs.push([legPts[i], legPts[i + 1]]);
    }
    if (course.type === 'loop' && legPts.length > 2 && legPts[legPts.length - 1] && legPts[0]) {
      arrowLegs.push([legPts[legPts.length - 1], legPts[0]]);   // the leg home closes the circuit
    }
    const arrowR = Math.max(2.2, unit * (compact ? 0.026 : 0.019));
    arrowLegs.forEach(function (leg) {
      const a = leg[0], b = leg[1];
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.hypot(dx, dy) < arrowR * 2.2) return;    // too short to hold a legible head
      const deg = Math.atan2(dy, dx) * 180 / Math.PI;
      html += '<polygon class="map-arrow" points="' +
              (arrowR * 1.25).toFixed(2) + ',0 ' +
              (-arrowR * 0.8).toFixed(2) + ',' + (arrowR * 0.85).toFixed(2) + ' ' +
              (-arrowR * 0.8).toFixed(2) + ',' + (-arrowR * 0.85).toFixed(2) +
              '" transform="translate(' + ((a.x + b.x) / 2).toFixed(1) + ' ' + ((a.y + b.y) / 2).toFixed(1) +
              ') rotate(' + deg.toFixed(1) + ')" style="stroke-width:' + (stroke * 0.5).toFixed(2) + '"/>';
    });

    // NODES (Andrew's colour scheme, 2026-07-17; digits removed 2026-07-19):
    // Start/Finish = checkered flag; the base we're currently at (occupied) =
    // green; the base we're driving to (next) = light-green and pulsing; every
    // other course base = grey. The dots are now PLAIN — no drive-order digit —
    // because that digit collided with the base code the player actually types
    // (see the direction-arrow note above). Colour still carries current/next,
    // and on the labelled maps the base code rides the label.
    const liveFrom = race.on ? race.fromId : null;   // occupied — the base we're at / just left
    const liveTo   = race.on ? race.toId   : null;   // next — the base we're driving to
    bases.forEach(function (b) {
      const p = C[b.id]; if (!p) return;
      const isStart = b.id === course.startId;
      const live = (b.id === liveTo) ? 'next' : (b.id === liveFrom) ? 'from' : '';
      const big = (live === 'next' || live === 'from');
      if (isStart) {
        html += '<circle class="sf-ring' + (live ? ' ' + live : '') + '" cx="' + p.x + '" cy="' + p.y + '" r="' + (big ? ringR * 1.15 : ringR) + '" style="stroke-width:' + stroke + '"/>';
        html += '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + sfR + '" fill="url(#' + pid + ')" stroke="#f4fff0" stroke-width="' + (stroke * 0.6) + '"/>';
      } else {
        const r = big ? nodeR * 1.32 : nodeR;
        html += '<circle class="map-node' + (live ? ' ' + live : '') + '" cx="' + p.x + '" cy="' + p.y + '" r="' + r + '" style="stroke-width:' + (stroke * 0.5) + '"/>';
      }
      if (!compact) {
        // Name on the first line, BASE CODE on a second beneath it — the code is
        // what the player types (AP 2107 72102), so the map should reinforce it
        // rather than compete with it. Stacked rather than trailing on purpose:
        // "Merrittville · 72118" as one string is nearly twice the width of the
        // name alone, and at this density the extra length collides with the
        // route line and with neighbouring labels.
        const tag = isStart ? ' — START / FINISH' : '';
        // Labels sit to the RIGHT of their dot, except on the right-hand side of
        // the field, where they'd run past the edge and get clipped — those flip
        // to the left of the dot instead. The start label is the long one, so it
        // flips earliest.
        const wide = isStart ? 0.42 : 0.62;
        const flip = p.x > W * wide;
        const lx = (flip ? (p.x - nodeR - font * 0.3) : (p.x + nodeR + font * 0.3)).toFixed(1);
        html += '<text class="map-base-label" text-anchor="' + (flip ? 'end' : 'start') + '" x="' + lx +
                '" y="' + (p.y - font * 0.12).toFixed(1) + '" style="font-size:' + font + 'px">' +
                '<tspan x="' + lx + '">' + b.name + tag + '</tspan>' +
                '<tspan class="map-base-code" x="' + lx + '" dy="1.02em">' + b.id + '</tspan></text>';
      }
    });

    // FLEET / PIT (Andrew, 2026-07-17; re-placed 2026-07-19): the off-route pit
    // reads as a RACECAR TIRE — the spot you swap rubber. It no longer sits at
    // Fleet's real address; it is pinned beside the start/finish line (pitPos).
    if (showPit && pitPos) {
      const pp = pitPos;
      const tireR = Math.max(pitR * 1.5, unit * 0.05);
      html += tireSVG(pp.x, pp.y, tireR);
      // Label sits ABOVE the tire, centred: the pit is pinned right next to the
      // start/finish node, so a label to the SIDE collides with the start label.
      // Clamped off both edges so the centred label can't run out of the field.
      if (!compact) html += '<text class="map-base-label pit-label" x="' +
        Math.max(font * 2.6, Math.min(W - font * 2.6, pp.x)).toFixed(1) + '" y="' +
        (pp.y - tireR - font * 0.45).toFixed(1) + '" text-anchor="middle" style="font-size:' + font + 'px">Fleet · PIT</text>';
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
    // Mirrors renderMap's showPit: no tire swatch on a Point 2 Point course, where
    // Fleet is not drawn at all. Re-run on every course change alongside renderMap.
    const lcourse = activeCourse();
    const hasPit = !!(D && D.baseById && D.baseById[CFG.PIT_BASE_ID || '72123']) &&
                   !!lcourse && lcourse.type !== 'point-to-point';
    const html =
      '<span class="lg"><span class="sw sw-sf"></span>Start / Finish</span>' +
      '<span class="lg"><span class="sw sw-cur"></span>Current base (occupied)</span>' +
      '<span class="lg"><span class="sw sw-next"></span>Next base</span>' +
      '<span class="lg"><span class="sw sw-node"></span>Course base</span>' +
      '<span class="lg"><span class="sw sw-route"></span>Race route</span>' +
      // Drive order used to be a digit on each dot; it's an arrow on each leg now.
      '<span class="lg"><span class="sw sw-arrow">▶</span>Drive direction</span>' +
      (hasPit ? '<span class="lg"><span class="sw sw-pitlane"></span>Pit lane</span>' +
                '<span class="lg"><span class="sw sw-tire">◉</span>Fleet · pit (tire swap)</span>' : '');
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
    let m = Math.max(0.45, Math.min(1.5, 1.5 - (eff / max) * 1.05));     // 1.5 crawling → 0.45 flat out
    // While a boost runs, rush the world past a little harder than the raw speed
    // asks for. The gauge alone doesn't SELL a boost; the scenery does.
    if (race.boost.tier) m = m / boCfg('roadRush', 1.35);
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
  // Try to load a unit's sprite frames. The STRAIGHT frame (_c) is all it takes
  // to switch to sprite mode — the car you picked is the car you drive, even
  // before its bank art exists. The two lean frames (_r1/_r2) are a bonus: with
  // them the sprite banks through bends; without them we keep the placeholder
  // fake-lean rotation (see applyCarSteer). Only a missing _c leaves the
  // procedural div-car in place. No flag to flip — just drop art in.
  function ensureCarSprites(unitId) {
    const CARS = CFG.CARS || {};
    if (!CARS.enabled || !unitId || carSprite.unitId === unitId) return;
    carSprite.unitId = unitId; carSprite.ready = false; carSprite.frame = null; carSprite.lean = false;
    const car = document.getElementById('raceCar');
    if (car) car.classList.remove('sprite-mode');
    const base = (CARS.path || 'assets/cars/') + unitId + '_';
    const frames = ['c', 'r1', 'r2'];
    const have = {};
    let settled = 0;
    frames.forEach(function (f) {
      const img = new Image();
      const done = function (ok) {
        if (carSprite.unitId !== unitId) return;      // a newer unit took over mid-load
        have[f] = ok;
        if (++settled < frames.length) return;
        if (!have.c) return;                          // unit has no art at all → placeholder stays
        carSprite.ready = true; carSprite.base = base;
        carSprite.lean = !!(have.r1 && have.r2);
        enterSpriteMode();
        restyleTraffic();      // the field wears the same art, recoloured — see styleOppLivery
      };
      img.onload  = function () { done(true); };
      img.onerror = function () { done(false); };
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
    if (carSprite.ready && carSprite.lean) {
      const mag = Math.abs(steer), th = A.frameThresholds || [0.18, 0.5];
      setCarFrame(mag < th[0] ? 'c' : (mag < th[1] ? 'r1' : 'r2'), steer < 0 ? -1 : 1);
      car.style.setProperty('--car-lean', '0');
    } else if (carSprite.ready) {
      // Straight frame only — never mirror it (that would flip the livery), so
      // borrow the placeholder's rotation to sell the bank.
      setCarFrame('c', 1);
      car.style.setProperty('--car-lean', (steer * (A.placeholderLeanDeg != null ? A.placeholderLeanDeg : 8)).toFixed(2));
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

  /* LIVERIES (Andrew, 2026-07-19: "make the other cars look like the unit the
   * player's car. Every color but the one that was selected.")
   *
   * The field paints the PLAYER'S OWN car art, hue-rotated per rival. Recolouring
   * one sprite beats shipping a sprite per unit: it works the moment any unit has
   * art, it keeps working for units whose art lands later, and it guarantees the
   * grid reads as one class of machine — which is the point, since they're all
   * the same kind of truck.
   *
   * Hues are spread around the wheel and deliberately START WELL AWAY FROM 0 —
   * a rival at 0° would come out in the player's exact colour, and "every colour
   * but the one that was selected" is the requirement. 30° is about the closest
   * that still reads as a different car at speed. */
  const OPP_HUES = [38, 72, 112, 152, 192, 232, 268, 305, 335];

  function oppHue(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return OPP_HUES[h % OPP_HUES.length];
  }

  // Put the player's car art (or take it away) on one rival. Split out from
  // makeOppEl because the art usually finishes loading AFTER the field is built —
  // ensureCarSprites is async — so existing cars have to be restyled in place.
  function styleOppLivery(car) {
    if (!car.el) return;
    if (carSprite.ready && carSprite.base) {
      car.el.classList.add('sprite-mode');
      car.el.style.setProperty('--opp-frame', 'url("' + carSprite.base + 'c.png")');
      car.el.style.setProperty('--opp-hue', oppHue(car.id) + 'deg');
      car.el.style.setProperty('--opp-sat', '1.15');   // the rotate washes it slightly; put the punch back
    } else {
      // No art for the driven unit → keep the procedural car, tinted as before.
      car.el.classList.remove('sprite-mode');
      car.el.style.setProperty('--opp-tint', oppTint(car.id));
    }
  }

  // Re-livery the whole field. Called when the player's sprite finishes loading.
  function restyleTraffic() { traffic.cars.forEach(styleOppLivery); }

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
    car.el = el;
    styleOppLivery(car);
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

  /* ===================== RACE TYPE B — BANNER WINDOW (ENP beat) ==============
   * The ENP gate rendered as a VISIBLE typing window: two gantries (OPEN filled,
   * CLOSE outline) at leg positions, projected onto the same road as the traffic
   * via tfProject(). Live ONLY when legMode==='timed' and ENP is the active beat.
   * gapForHandling() sizes the OPEN→CLOSE window from the driven unit's handling;
   * resetBanner() re-seats it each leg; updateBanners() projects the gantries and
   * catches the "car crossed CLOSE with ENP still un-typed" miss.
   * See PITSTOP_RACE_TYPE_AB.md §"Banner-Window mechanic" + config BANNER. */
  const BANNER_H = 96;   // gantry height at scale 1 (px): the beam + posts to the ground

  // OPEN→CLOSE gap (leg-fraction) for a unit's handling — better handling = wider =
  // more grace. Clamped to the configured band so an off-range stat is still safe.
  function gapForHandling(unitId) {
    const h = unitStats(unitId).handling;
    const hMin = bnCfg('handMin', 3), hMax = bnCfg('handMax', 8);
    const gMin = bnCfg('gapMin', 0.10), gMax = bnCfg('gapMax', 0.22);
    const t = hMax > hMin ? (Math.max(hMin, Math.min(hMax, h)) - hMin) / (hMax - hMin) : 0.5;
    return gMin + t * (gMax - gMin);
  }

  // Build the two gantry elements ONCE and cache them on race.banner.els (reused
  // across legs, hidden between windows) — mirrors buildTraffic()'s DOM-once pattern.
  function buildBanners() {
    const wrap = document.getElementById('rvBanners');
    if (!wrap) return null;
    if (race.banner.els) return race.banner.els;
    wrap.innerHTML = '';
    const make = function (kind) {
      const el = document.createElement('div');
      el.className = 'rv-banner ' + kind;
      el.innerHTML =
        '<div class="bn-beam"><div class="bn-fill"></div><div class="bn-label">ENP</div></div>' +
        '<div class="bn-post left"></div><div class="bn-post right"></div>';
      el.style.display = 'none';
      wrap.appendChild(el);
      return el;
    };
    race.banner.els = { open: make('open'), close: make('close') };
    return race.banner.els;
  }

  function hideBanners() {
    if (!race.banner.els) return;
    race.banner.els.open.style.display = 'none';
    race.banner.els.close.style.display = 'none';
    race.banner.active = false;
  }

  /* How much leg-fraction the car covers in `sec` seconds at its CURRENT pace.
   * This is the bridge between the two units the banner system has to reconcile:
   * banners live at leg POSITIONS, but Andrew's pacing cap is in SECONDS ("cap it
   * at 15 seconds"), and the conversion between them is the player's own speed.
   * Speed is floored at the crawl so a stationary car still yields a finite
   * distance — otherwise the cap would compute an infinite window and never bind,
   * which is exactly the case (a slow car) it exists to catch. */
  function fracPerSec() {
    const max = spCfg('max', 200);
    const v = Math.max(bnCfg('gateCrawl', 14), Math.min(max, race.speed));
    return (v / max) * spCfg('legRate', 0.6);
  }

  // Place the painted hit zone inside the current OPEN→CLOSE window. It sits LATE
  // (endMargin back from CLOSE), so holding on for it is the risky, higher-paying
  // line — which is the cartridge's whole premise. See config BANNER.zone.
  function seatZone() {
    const b = race.banner;
    const Z = (CFG.BANNER && CFG.BANNER.zone) || { len: 0.24, endMargin: 0.07 };
    const span = Math.max(1e-6, b.closePos - b.openPos);
    b.zoneB = b.closePos - span * Z.endMargin;
    b.zoneA = b.zoneB - span * Z.len;
  }

  // Clamp the OPEN→CLOSE window so it can never take longer than maxWindowSec to
  // drive through at the current pace (Andrew: cap it at 15s). At racing speed the
  // fixed-distance gap is already a couple of seconds and this never binds; it is
  // the backstop for a car crawling through its own window.
  function capWindow() {
    const b = race.banner;
    const maxFrac = bnCfg('maxWindowSec', 15) * fracPerSec();
    if (b.closePos - b.openPos > maxFrac) b.closePos = b.openPos + maxFrac;
    b.closePos = Math.min(0.97, b.closePos);
    seatZone();
  }

  // Seat the ENP window for the current leg: OPEN at gateENP, CLOSE a handling-set
  // gap beyond it. armed = the window is live and awaiting its outcome.
  function resetBanner() {
    const b = race.banner;
    b.hold = false;
    b.stumbled = false;
    b.waitT = 0;
    const t = CFG.TUNABLES || {};
    const open = t.gateENP != null ? t.gateENP : 0.33;
    b.openPos = open;
    b.closePos = Math.min(0.97, open + gapForHandling(race.unitId));
    b.armed = true;
    b.active = false;
    capWindow();
    hideBanners();
  }

  /* DEAD-TIME CAP (Andrew, 2026-07-19: "the time between banners is too long,
   * lets cap it at 15 seconds for now").
   *
   * gateENP is a fixed 0.33 of the leg, which is fine as geometry and bad as
   * pacing: the same third of a leg is a couple of seconds at 200 km/h and most of
   * a minute at a crawl, and the crawl is exactly where a player who's struggling
   * ends up. Punishing a slow lap with a BORING one as well is the wrong feedback.
   *
   * So the wait is measured in real seconds, and once it runs out the OPEN gantry
   * is simply re-seated just ahead of the car (leadFrac — under rangeFrac, so it
   * still fades in from the horizon rather than appearing on top of you). A banner
   * therefore always arrives inside maxLeadSec, whatever the car is doing. */
  function tickBannerWait(dt) {
    const b = race.banner;
    if (!b.armed || b.hold || race.pos >= b.openPos) { b.waitT = 0; return; }
    b.waitT += dt;
    if (b.waitT < bnCfg('maxLeadSec', 15)) return;
    b.waitT = 0;
    const gap = b.closePos - b.openPos;
    b.openPos = race.pos + bnCfg('leadFrac', 0.16);
    b.closePos = Math.min(0.97, b.openPos + gap);
    capWindow();
    showRadio('ENP checkpoint ahead — get ready.', '');
  }

  // Is the ENP banner window the thing currently gating the player? Only in timed
  // mode, banners enabled, with ENP the active (undone) beat.
  function bannerLive() {
    if (race.legMode !== 'timed' || !bnCfg('enabled', true)) return false;
    const beat = activeBeat();
    return !!(beat && beat.code === 'ENP');
  }

  // The letter-before-OPEN "too early" state — used by the command keydown hook.
  function bannerTooEarly() {
    return race.on && !race.paused && bannerLive() && !race.banner.hold &&
           race.pos < race.banner.openPos;
  }

  // Project one gantry at leg-fraction bannerPos onto the road, size it to the road
  // width at that depth, fade it in at the horizon. Returns false when off-range.
  function drawBanner(el, bannerPos, W, H, shift) {
    const range = bnCfg('rangeFrac', 0.34) || 0.34;
    const z = ((bannerPos - race.pos) / range) * tfCfg('zFar', 260);
    const p = tfProject(z, 0, W, H, shift);
    if (!p) { el.style.display = 'none'; return false; }
    const halfW = (0.06 + 0.26 * p.k) * W;     // road half-width at this depth (matches tfProject)
    const bw = halfW * 2 * 1.18;               // gantry spans a touch wider than the tarmac
    const bh = BANNER_H * p.k;
    el.style.display = '';
    el.style.width = bw.toFixed(1) + 'px';
    el.style.height = bh.toFixed(1) + 'px';
    el.style.fontSize = Math.max(6, bh * 0.17).toFixed(1) + 'px';   // label rides the gantry's depth scale
    el.style.transform = 'translate(' + (p.x - bw / 2).toFixed(1) + 'px,' + (p.y - bh).toFixed(1) + 'px)';
    el.style.opacity = p.k < 0.14 ? (p.k / 0.14).toFixed(2) : '1';
    el.style.zIndex = String(Math.round(Math.min(p.k, 1) * 100));
    return true;
  }

  /* Paint the hit zone on the tarmac. Drawn as a TRAPEZOID (via clip-path) rather
   * than a rectangle: its near edge is the road width at zoneB and its far edge
   * the width at zoneA, which is what makes it sit ON the road surface instead of
   * hovering above it. Sized from the same tfProject() the traffic and gantries
   * use, so all three agree about where the road is through a bend. */
  function drawHitZone() {
    const el = document.getElementById('rvZone');
    if (!el) return;
    const b = race.banner;
    const rv = document.getElementById('roadView');
    if (!rv) { el.style.display = 'none'; return; }
    const W = rv.clientWidth, H = rv.clientHeight;
    const range = bnCfg('rangeFrac', 0.34) || 0.34;
    const shift = Math.tan(road.curve * OPP_SKEW_DEG * Math.PI / 180);
    const zFar = tfCfg('zFar', 260);
    // zoneA is the LOWER leg-position, so it is the edge nearest the camera and
    // zoneB the one toward the horizon. Getting these the wrong way round inverts
    // the trapezoid and the band collapses into a sliver at the vanishing point.
    const near = tfProject(((b.zoneA - race.pos) / range) * zFar, 0, W, H, shift);   // closer edge
    const far  = tfProject(((b.zoneB - race.pos) / range) * zFar, 0, W, H, shift);   // horizon edge
    if (!near || !far) { el.style.display = 'none'; return; }
    const halfN = (0.06 + 0.26 * near.k) * W, halfF = (0.06 + 0.26 * far.k) * W;
    // Bounding box of the whole trapezoid, then clip the shape inside it.
    const left = Math.min(near.x - halfN, far.x - halfF);
    const right = Math.max(near.x + halfN, far.x + halfF);
    const top = Math.min(near.y, far.y), bottom = Math.max(near.y, far.y);
    const bw = Math.max(1, right - left), bh = Math.max(1, bottom - top);
    const pct = function (v) { return (100 * v / bw).toFixed(2) + '%'; };
    // Explicitly 'block', not '': the stylesheet default for .rv-zone is
    // display:none (so it stays hidden before the first frame ever runs), so
    // clearing the inline value would fall back to that and never show the band.
    el.style.display = 'block';
    el.style.width = bw.toFixed(1) + 'px';
    el.style.height = bh.toFixed(1) + 'px';
    el.style.transform = 'translate(' + left.toFixed(1) + 'px,' + top.toFixed(1) + 'px)';
    el.style.fontSize = Math.max(6, 34 * near.k).toFixed(1) + 'px';
    el.style.opacity = near.k < 0.14 ? (near.k / 0.14).toFixed(2) : '1';
    const band = el.querySelector('.zn-band');
    if (band) {
      band.style.clipPath = 'polygon(' +
        pct(far.x - halfF - left) + ' 0,' + pct(far.x + halfF - left) + ' 0,' +
        pct(near.x + halfN - left) + ' 100%,' + pct(near.x - halfN - left) + ' 100%)';
    }
    // .live = the car is ON the paint right now: hit Enter.
    el.classList.toggle('live', race.pos >= b.zoneA && race.pos <= b.zoneB);
  }

  function hideHitZone() {
    const el = document.getElementById('rvZone');
    if (el) { el.style.display = 'none'; el.classList.remove('live'); }
  }

  function updateBanners() {
    const els = race.banner.els;
    if (!els) return;
    const b = race.banner;
    if (!bannerLive()) { hideBanners(); hideHitZone(); return; }
    b.active = true;
    const rv = document.getElementById('roadView');
    if (!rv) return;
    const W = rv.clientWidth, H = rv.clientHeight;
    if (!W || !H) return;
    const shift = Math.tan(road.curve * OPP_SKEW_DEG * Math.PI / 180);
    drawHitZone();
    // Live timer: how far the car has crept between OPEN and CLOSE (0→1). The OPEN
    // gantry's beam depletes with it and flushes urgent past two-thirds.
    const span = Math.max(0.0001, b.closePos - b.openPos);
    const frac = Math.max(0, Math.min(1, (race.pos - b.openPos) / span));
    const fill = els.open.querySelector('.bn-fill');
    if (fill) fill.style.width = ((1 - frac) * 100).toFixed(0) + '%';
    els.open.classList.toggle('urgent', frac > 0.66);
    drawBanner(els.open, b.openPos, W, H, shift);
    drawBanner(els.close, b.closePos, W, H, shift);
    // MISS: the car rolled past CLOSE with ENP still un-typed. Fire once (armed
    // latch); missEnpWindow bleeds speed and re-arms (or holds).
    if (b.armed && race.pos > b.closePos) missEnpWindow();
  }

  // The ENP window went by un-answered (car crossed CLOSE, or Enter landed after
  // CLOSE). NOT a content error → NO tire damage; a timing miss: bleed speed and
  // bring the window round again. If a fresh window won't fit ahead (past
  // safeMaxClose), HOLD at this CLOSE banner until ENP is called — the leg can then
  // never soft-lock on a blown window (the one place a banner walls the car).
  function missEnpWindow() {
    const b = race.banner;
    b.armed = false;
    b.stumbled = false;                        // fresh approach → allow one new too-early stumble
    typing.start = 0;                          // don't score the recovery ENP against a stale stopwatch
    race.speed = Math.max(spCfg('base', 0), race.speed * 0.6);   // timing-miss bleed
    race.hold = 0;
    b.waitT = 0;                               // the re-approach gets its own 15s clock
    endBoost(true);
    const gap = b.closePos - b.openPos;
    const newOpen = race.pos + bnCfg('rearmLead', 0.12);
    if (newOpen + gap <= bnCfg('safeMaxClose', 0.90)) {
      b.openPos = newOpen;
      b.closePos = newOpen + gap;
      b.armed = true;                          // re-approach a fresh window ahead
      b.hold = false;
      showRadio('Missed the checkpoint — it comes round again.', '');
    } else {
      b.hold = true;                           // nose up to CLOSE and wait for ENP
      showRadio('Call ENP ' + (race.unitId || '') + ' at the checkpoint.', '');
    }
    capWindow();                               // re-clamp + re-seat the paint for the new window
    flashBox('miss'); AUDIO.play('back');
  }

  // The too-early stumble: a letter typed before the OPEN banner. Auto-brake scrub,
  // NOT tire damage (timing errors never wear the rubber — damage means bad content).
  function enpTooEarly() {
    tapBrake();                      // brief auto-brake blip + scrub
    race.speed = Math.max(spCfg('base', 0), race.speed * 0.8);
    flashBox('early');
    showRadio('Too early — wait for the OPEN banner to call ENP ' + (race.unitId || '') + '.', '');
    AUDIO.play('back');
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

  /* ============ PIT BOX — in-race garage PREVIEW (design §② inPit) ==========
   * A self-contained look-and-feel preview of the pit stop: the car pulls in,
   * the crew jump the corners, fresh rubber goes on, then it drives away.
   * Reached via the Dev screen-jump — showScreen('pitScreen') calls PitBox.open().
   *
   * ⚠ DELIBERATELY UNWIRED. Runs on its OWN sandbox tire state; never reads or
   * writes race speed / race.tireHealth / fuel; its SWAP handler is LOCAL to this
   * screen and is NOT added to the race command parser. The pit/tire consequence
   * layer and the SWAP command are gated (NEMS500 spec §0.9 / §9.1) — this shows
   * the target without clearing the gate. Tyre COLOURS come from the shared
   * deriveTire()/CFG.TIRE table, so the preview and the race never disagree. */
  const PitBox = (function () {
    const CORNERS = ['FL', 'FR', 'RL', 'RR'];
    const each = function (list, fn) { Array.prototype.forEach.call(list, fn); };
    const el = function (id) { return document.getElementById(id); };
    const freshMin = function () { const s = (CFG.TIRE && CFG.TIRE.stages) || []; return (s[0] && s[0].min) || 8; };
    // Demo health per corner (0–max), chosen to show all four stages at a glance.
    function demoState() { const mx = tireCfg('max', 10); return { FL: 1, FR: mx - 1, RL: 6, RR: 3 }; }
    const box = { health: demoState(), clock: 0, leaving: false, clockT: null, swapT: null };

    const needsSwap = function (h) { return h < freshMin(); };
    const allFresh = function () { return CORNERS.every(function (k) { return !needsSwap(box.health[k]); }); };
    const pct = function (h) { return Math.max(0, Math.min(100, h / tireCfg('max', 10) * 100)) + '%'; };

    function renderTire(k) {
      const tire = document.querySelector('#pbxCar .pbx-tire.' + k.toLowerCase());
      if (!tire) return;
      const s = deriveTire(box.health[k]);
      const fill = tire.querySelector('.fill');
      if (fill) { fill.style.height = pct(box.health[k]); fill.style.background = s.panel || 'var(--phosphor)'; }
      tire.style.borderColor = s.stageColor || 'var(--phosphor-dim)';
      tire.classList.toggle('low', s.stage === 'CRITICAL' || s.stage === 'BURST');
    }

    function renderRows() {
      const wrap = el('pbxSelect');
      if (!wrap) return;
      wrap.innerHTML = '';
      CORNERS.forEach(function (k) {
        const s = deriveTire(box.health[k]);
        const row = document.createElement('div');
        row.className = 'pbx-row';
        row.style.borderColor = s.stageColor || 'var(--phosphor-dim)';
        row.innerHTML = '<span class="r-lab">' + k + '</span>' +
          '<span class="r-bar"><i></i></span><span class="r-stat">' + (s.stage || '') + '</span>';
        const bar = row.querySelector('.r-bar i');
        bar.style.width = pct(box.health[k]); bar.style.background = s.panel || 'var(--phosphor)';
        row.querySelector('.r-stat').style.color = s.stageColor || 'var(--phosphor)';
        row.addEventListener('click', function () { swap(k); });
        wrap.appendChild(row);
      });
    }

    function renderClock() {
      const v = el('pbxClock'), t = el('pbxTimer');
      if (v) v.innerHTML = (box.clock / 10).toFixed(1) + '<span>s</span>';
      if (t) {
        const green = 'var(--phosphor)';
        const c = allFresh() ? green : (box.clock > 90 ? 'var(--flag-red)' : (box.clock > 50 ? 'var(--amber)' : green));
        t.style.borderColor = c;
        const val = t.querySelector('.t-val'); if (val) val.style.color = c;
      }
    }

    function setStatus(msg, color) { const s = el('pbxStatus'); if (s) { s.textContent = msg; s.style.color = color || 'var(--text-dim)'; } }
    function defaultStatus() {
      if (allFresh()) setStatus('✓ ALL FRESH — REJOIN COURSE', 'var(--phosphor)');
      else setStatus('TYPE  SWAP <FL·FR·RL·RR>  or  SWAP ALL', 'var(--text-dim)');
    }
    function renderAll() { CORNERS.forEach(renderTire); renderRows(); renderClock(); }

    function swap(which) {
      const targets = which === 'ALL' ? CORNERS.slice() : [which];
      const mx = tireCfg('max', 10);
      targets.forEach(function (k) {
        box.health[k] = mx;
        const flash = document.querySelector('#pbxCar .pbx-swapflash.' + k.toLowerCase());
        const crew = document.querySelector('#pbxCar .pbx-crew.' + k.toLowerCase());
        if (flash) replay(flash, 'go');
        if (crew) replay(crew, 'go');
      });
      AUDIO.play('typing');
      clearTimeout(box.swapT);
      box.swapT = setTimeout(function () {
        each(document.querySelectorAll('#pbxCar .pbx-swapflash.go'), function (n) { n.classList.remove('go'); });
        each(document.querySelectorAll('#pbxCar .pbx-crew.go'), function (n) { n.classList.remove('go'); });
      }, 660);
      renderAll();
      setStatus('✓ FRESH RUBBER ON ' + which, 'var(--phosphor)');
      if (allFresh()) { stopClock(); defaultStatus(); }
    }

    function onKey(e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const inp = el('pbxInput');
      const raw = (inp ? inp.value : '').trim().toUpperCase().replace(/\s+/g, ' ');
      if (inp) inp.value = '';
      if (!raw) return;
      const m = raw.match(/^SWAP (FL|FR|RL|RR|ALL)$/);
      if (!m) { setStatus('✗ UNKNOWN — try  SWAP FL', 'var(--flag-red)'); return; }
      swap(m[1]);
    }

    function startClock() {
      if (box.clockT) return;
      box.clockT = setInterval(function () {
        if (allFresh()) { stopClock(); return; }
        box.clock += 1; renderClock();
      }, 100);
    }
    function stopClock() { if (box.clockT) { clearInterval(box.clockT); box.clockT = null; } }

    function open() {
      stopClock(); clearTimeout(box.swapT);
      box.health = demoState(); box.clock = 0; box.leaving = false;
      const unit = el('pbxUnit');
      if (unit) unit.textContent = (state.raceOptions && state.raceOptions.unit) || '2101';
      const inp = el('pbxInput'); if (inp) inp.value = '';
      const car = el('pbxCar'), lolli = el('pbxLollipop'), dust = el('pbxDust');
      if (car) car.classList.remove('leaving');
      if (lolli) lolli.classList.remove('lift');
      if (car) replay(car, 'enter');
      if (dust) replay(dust, 'puff');
      renderAll(); defaultStatus(); startClock();
      setTimeout(function () { const i = el('pbxInput'); if (i) i.focus(); }, 60);
    }

    function close() { stopClock(); clearTimeout(box.swapT); }

    function rejoin() {
      if (box.leaving) return;
      box.leaving = true; stopClock();
      const car = el('pbxCar'), lolli = el('pbxLollipop');
      if (lolli) replay(lolli, 'lift');
      if (car) { car.classList.remove('enter'); replay(car, 'leaving'); }
      AUDIO.play('menu');
      setTimeout(function () { showScreen('gameScreen'); }, 820);
    }

    return { open: open, close: close, rejoin: rejoin, swap: swap, onKey: onKey };
  })();

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

  /* ---- Race start "Christmas Tree" (Andrew, 2026-07-17) -------------------
   * Point-to-point is a sprint → a drag-strip tree: pre-stage bulb, three
   * ambers top→bottom, then GREEN. Circuit/loop is a Grand Prix → an F1 gantry:
   * five reds light one-by-one, hold for a random beat you can't time, then all
   * OUT = go. Command input is dead until the flag drops (no jumping the start).
   * Runs ONCE at the head of a race; later legs start straight into the drive. */
  function clearStartLights() {
    if (race._startTimers) { race._startTimers.forEach(clearTimeout); race._startTimers = null; }
    race.staging = false;
    const gs = document.getElementById('gameScreen');
    if (gs) gs.classList.remove('staging');           // un-hide the command box
    const host = document.getElementById('startLights');
    if (host) { host.hidden = true; host.className = 'start-lights'; host.innerHTML = ''; }
  }

  function runStartSequence(courseType, onGo) {
    const host = document.getElementById('startLights');
    if (!host) { onGo(); return; }                       // no overlay in the DOM → just drive
    clearStartLights();
    const isCircuit = courseType !== 'point-to-point';   // loop / circuit → F1; else drag tree
    race.startStyle = isCircuit ? 'f1' : 'drag';
    race.staging = true;
    const gs = document.getElementById('gameScreen');
    if (gs) gs.classList.add('staging');                 // hide the command box while the lights run
    const timers = []; race._startTimers = timers;
    const at = function (ms, fn) { timers.push(setTimeout(fn, ms)); };
    const go = function () {
      race.staging = false;
      host.classList.add('go');
      AUDIO.play('select');
      at(isCircuit ? 120 : 520, function () {            // F1: away the instant they go out; drag: hold the green a beat
        const gs2 = document.getElementById('gameScreen');
        if (gs2) gs2.classList.remove('staging');        // command box back the moment the drive starts
        host.hidden = true; host.className = 'start-lights'; host.innerHTML = '';
        onGo();
      });
    };

    host.className = 'start-lights ' + race.startStyle;
    host.hidden = false;

    if (isCircuit) {
      host.innerHTML = '<div class="sl-gantry"><i></i><i></i><i></i><i></i><i></i></div>' +
                       '<div class="sl-label">LIGHTS OUT AND AWAY WE GO</div>';
      const bulbs = host.querySelectorAll('.sl-gantry i');
      for (let k = 0; k < 5; k++) {
        at(500 + k * 850, (function (i) {
          return function () { if (bulbs[i]) bulbs[i].classList.add('on'); AUDIO.play('menu'); };
        })(k));
      }
      const hold = 900 + Math.random() * 1300;           // the F1 signature — you can't pre-load the throttle
      at(500 + 5 * 850 + hold, function () {
        Array.prototype.forEach.call(bulbs, function (b) { b.classList.remove('on'); });
        go();
      });
    } else {
      host.innerHTML = '<div class="sl-tree"><i class="pre"></i><i class="a a1"></i>' +
                       '<i class="a a2"></i><i class="a a3"></i><i class="g"></i></div>' +
                       '<div class="sl-label">STAGE · READY</div>';
      const q = function (s) { return host.querySelector(s); };
      const lite = function (s) { const el = q(s); if (el) el.classList.add('on'); AUDIO.play('menu'); };
      at(250,  function () { lite('.pre'); });
      at(750,  function () { lite('.a1'); });
      at(1250, function () { lite('.a2'); });
      at(1750, function () { lite('.a3'); });
      at(2250, function () {
        ['.pre', '.a1', '.a2', '.a3'].forEach(function (s) { const el = q(s); if (el) el.classList.remove('on'); });
        const g = q('.g'); if (g) g.classList.add('on');
        const lbl = q('.sl-label'); if (lbl) lbl.textContent = 'GO!';
        go();
      });
    }
  }

  // Set up a full race: every base, every lap, finishing at Start/Finish.
  function startRace() {
    const course = activeCourse();
    if (!course || !DATAMOD.buildLeg || course.baseIds.length < 2) return;
    cancelAnimationFrame(race.raf);
    race.unitId = pickUnit();
    applyUnitTint();                 // placeholder: colour the marker per selected unit
    race.legMode = state.raceOptions.legMode === 'timed' ? 'timed' : 'sequence';   // A/B mode locks in at race start
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
    // Christmas Tree: drag-strip tree for a sprint, F1 gantry for a circuit.
    // Gates input until GO, then hands off to the first leg.
    runStartSequence(course.type, startLeg);
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
    race.arriving = false;                                              // not yet posted — no arrival roll
    race.gear = null;                                                   // each leg starts with no gear lit
    buildBanners();                                                     // create the gantry DOM once (idempotent)
    resetBanner();                                                      // seat this leg's checkpoint window + hit zone
    endBoost(true);                                                     // no boost carries across a leg boundary
    race.lane = 0; race.steer = 0; race.hitUntil = 0;                   // straighten up for the new leg
    applyCarLane();
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
    // Posted (all beats done) but not yet at the base → keep a steady roll so the
    // car always drives in. Without this a finished sequence could coast to a dead
    // stop short of pos 1 and never complete the leg (soft-lock) — the risk that
    // freed Type A from the position gate. The player can still brake it down.
    if (race.arriving && !braking) {
      race.speed = Math.max(race.speed, spCfg('arrivalRoll', spCfg('max', 200) * 0.7));
    }
    // Race Type B reachability crawl: once AP is posted and a gated beat is still
    // ahead, never fully stall — the only command left is position-gated, so a car
    // that coasts to a dead stop short of a gate would soft-lock (no throttle left).
    // A gentle crawl always carries it up to the next banner. Braking still lets the
    // player scrub/stop by hand; `arriving` owns the final roll-in; Type A never
    // enters here. See config BANNER.gateCrawl.
    if (race.legMode === 'timed' && race.on && !braking && !race.arriving && race.leg &&
        race.leg.beats[0] && race.leg.beats[0].done &&
        !race.leg.beats.every(function (b) { return b.done; })) {
      race.speed = Math.max(race.speed, bnCfg('gateCrawl', 14));
    }
    if (braking !== race.braking) { race.braking = braking; setBrakeLight(braking); }
  }

  /* ===================== STEERING — swerve through the field =================
   * (Andrew, 2026-07-19: "the arrow keys are not working properly … the arrow
   * keys engage, and the player has to swerve past other cars.")
   *
   * There was no player steering at all before this. The car's only lateral
   * movement was the OutRun bend leaning it into a curve (--car-steer), which is
   * scenery, not control — so Left/Right genuinely did nothing in a race, and
   * inside the focused command box they were just moving the text caret.
   *
   * `race.lane` is the driver's line, on the SAME scale the traffic already uses
   * (0 = centre line, ±1 = rumble strip), which is what makes collision a plain
   * comparison of two lane numbers rather than a second coordinate system.
   *
   * The car eases toward the held direction and drifts back to centre when the
   * keys are released, rather than snapping. That is deliberate: an instant dodge
   * would make the traffic free, and the whole point of the boost is that going
   * fast should cost you something to control.
   * ------------------------------------------------------------------------- */
  function stCfg(key, dflt) { const C = CFG.STEER || {}; return C[key] != null ? C[key] : dflt; }

  // Steering is live for the whole leg, not only during a boost. The boost is when
  // it MATTERS (you're carrying speed into traffic and the meter says SWERVE), but
  // a car you can't steer between boosts would read as broken controls.
  function steerLive() {
    return !!(stCfg('enabled', true) && race.on && !race.paused && !race.staging);
  }

  // Arrow keys are captured at the document level rather than on the command input,
  // because focus legitimately sits in that input for the whole race (typing is the
  // throttle). preventDefault stops them doubling as caret movement.
  function wireSteering() {
    const dirOf = function (k) { return k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0; };
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (state.currentScreen !== 'gameScreen') return;
      const d = dirOf(e.key);
      if (!d || !steerLive()) return;
      e.preventDefault();
      race.steer = d;
    });
    document.addEventListener('keyup', function (e) {
      const d = dirOf(e.key);
      if (!d) return;
      if (race.steer === d) race.steer = 0;     // ignore the release of the key you're no longer holding
    });
    // Losing the window mid-swerve would otherwise leave the car locked over.
    window.addEventListener('blur', function () { race.steer = 0; });
  }

  function updateSteer(dt) {
    if (!steerLive()) { race.steer = 0; return; }
    const max = stCfg('max', 0.76);
    if (race.steer) {
      race.lane += race.steer * stCfg('rate', 1.7) * dt;
    } else if (race.lane !== 0) {
      // Drift back to the centre line, without overshooting through it.
      const back = stCfg('returnRate', 0.9) * dt;
      race.lane = race.lane > 0 ? Math.max(0, race.lane - back) : Math.min(0, race.lane + back);
    }
    race.lane = Math.max(-max, Math.min(max, race.lane));
    applyCarLane();
  }

  // Push the lane onto the car in PIXELS. tfProject puts a car at lane L at
  // x = W/2 + L * halfW, and at the camera (k = 1) halfW is 0.32 * W — so the
  // player's own offset has to be computed against the live road width here,
  // since the CSS keyframe that consumes it can't measure the road.
  function applyCarLane() {
    const car = document.getElementById('raceCar');
    const rv = document.getElementById('roadView');
    if (!car || !rv) return;
    const px = race.lane * 0.32 * (rv.clientWidth || 0);
    car.style.setProperty('--car-lane-px', px.toFixed(1) + 'px');
  }

  /* Contact: you tried to occupy road that already had a car in it. Costs the
   * boost, some speed and some rubber — the same currency a typo costs, because
   * both are "you were going too fast for what you could handle".
   * Distinct from bumpNearbyCar(), which is a TYPO taken wheel-to-wheel; this one
   * is a STEERING error and can happen with a clean command history. */
  function checkSwerveCollisions(ts) {
    if (!steerLive() || ts < race.hitUntil) return;
    const cz = stCfg('collideZ', 8), cl = stCfg('collideLane', 0.30);
    for (let i = 0; i < traffic.cars.length; i++) {
      const c = traffic.cars[i];
      if (Math.abs(c.z) > cz) continue;
      if (Math.abs(c.lane - race.lane) > cl) continue;
      race.hitUntil = ts + stCfg('hitCooldown', 0.9) * 1000;
      endBoost(true);
      race.speed = Math.max(spCfg('base', 0), race.speed * stCfg('hitSpeedKeep', 0.55));
      race.hold = 0;
      damageTires(stCfg('hitDamage', 2));
      // Shove both cars off the line — you bounce out, they get knocked wide.
      const away = (race.lane <= c.lane) ? -1 : 1;
      race.lane = Math.max(-stCfg('max', 0.76), Math.min(stCfg('max', 0.76), race.lane + away * 0.2));
      c.lane = Math.max(-0.8, Math.min(0.8, c.lane - away * 0.16));
      applyCarLane();
      replay(c.el, 'bumped');
      replay(document.getElementById('roadView'), 'jolt');
      flashPass('✸ CONTACT · ' + c.id, 'bump');
      AUDIO.play('back');
      return;                                  // one contact per cooldown, never a pile-up
    }
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
    // Type B backstop: while the ENP window is HOLDING (no room left to re-arm), the
    // car noses up to the CLOSE banner and waits there until ENP is called, so a leg
    // can never coast to the finish line with a mandatory beat undone.
    if (race.banner.hold && bannerLive()) race.pos = Math.min(race.pos, race.banner.closePos);
    updateRoad(dt, v);
    updateSteer(dt);                                          // player's line across the road
    updateTraffic(dt, eff);
    checkSwerveCollisions(ts);                                // ...did that line hit anyone
    tickBannerWait(dt);                                       // 15s dead-time cap on the next banner
    updateBanners();
    updateBoost(ts);
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

    // The two base boxes above the minimap: CURRENT base (occupied — where the
    // unit is / just left) and NEXT base (where it's driving to), both by name.
    const Dbb = DATAMOD.DATA;
    const nameOf = function (id) { const b = Dbb && Dbb.baseById[id]; return b ? b.name : (id || '—'); };
    const curEl = document.getElementById('curBaseName');
    const nextEl = document.getElementById('nextBaseName');
    if (curEl)  curEl.textContent  = (race.on && race.fromId) ? nameOf(race.fromId) : '—';
    if (nextEl) nextEl.textContent = (race.on && race.toId)   ? nameOf(race.toId)   : '—';

    // Slim status line — transient cues only (the map + Active strip carry the command).
    const cp = document.getElementById('challengePrompt');
    if (cp && race.on) {
      if (race.shift.open) cp.textContent = '⇄ SHIFT CHANGE — clear the board, then BSE';
      else if (beat && beat.code === 'BSE' && race.shift.armed && !race.shift.cleared) cp.textContent = 'Shift Change pending → type LA ' + race.unitId + ' ' + beat.baseNum;
      else if (beat && beat.code === 'BSE' && (race.legMode === 'timed' ? race.pos >= beat.gate : race.pos >= arrivalGatePos())) cp.textContent = 'Home base? type BSEH ' + race.unitId + ' (no base code)';
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

  // Type A (hybrid) arrival gate position — how far into a leg the car must be
  // before the BSE arrival beat will post. Config-driven; default 0.85 (near base).
  function arrivalGatePos() {
    const t = CFG.TUNABLES || {};
    return t.arrivalGate != null ? t.arrivalGate : 0.85;
  }

  // Type B "too early" radio line — names where the beat unlocks so the gate
  // reads as a rule, not a glitch (the silent yellow flash felt broken).
  function tooEarlyMsg(beat) {
    if (!beat) return 'Too early.';
    const where = beat.code === 'ENP' ? 'the halfway mark'
                : beat.code === 'BSE' ? 'the base'
                : 'the gate';
    return 'Too early — reach ' + where + ' before you call ' + beat.code + ' ' + (race.unitId || '') + '.';
  }

  function handleRaceCommand(value, wpm) {
    const input = document.getElementById('commandInput');
    // While the Shift Change box is open, ALL input goes to it (checked before the
    // race-on guard so the debug opener is usable outside a live leg).
    if (race.shift.open) { if (input) input.value = ''; handleShiftCommand(value); return; }
    // No jumping the start — input is dead while the tree/gantry counts down.
    if (race.staging) {
      if (input) input.value = '';
      flashBox('early'); AUDIO.play('back');
      showRadio(race.startStyle === 'f1' ? 'Wait for lights out!' : 'Wait for the green!', '');
      return;
    }
    if (!race.on || race.paused) return;
    if (input) input.value = '';
    const beat = activeBeat();
    if (!beat) return;

    // Shift Change intercept: once ENP is done (active beat = BSE) with a change
    // armed but unresolved, you type LA + the base to stay mobile and open the box
    // — BSE is blocked until the board is cleared (design note §2). LA carries the
    // base code (Andrew, 2026-07-17): "LA <unit> <base>", same base as the pending
    // BSE. Validated as a synthetic LA beat so the unit + base must both match.
    if (beat.code === 'BSE' && race.shift.armed && !race.shift.cleared) {
      const laBeat = { code: 'LA', unit: beat.unit, baseNum: beat.baseNum, requiresBaseCode: true };
      if (DATAMOD.validateBeat(value, laBeat) === 'hit') { openShiftBox(race.shift.slot); return; }
      // Wrong entry while LA is the required next command → flicker the LA gear.
      flashBox('early'); flashGear('LA'); AUDIO.play('back');
      showRadio('Shift Change pending — type LA ' + beat.unit + ' ' + beat.baseNum + ' before BSE.', '');
      return;
    }

    // Command gating by Race Type:
    //   Type B (timed)  — EVERY beat unlocks at a point on the leg (gateAP/ENP/BSE).
    //   Type A (hybrid) — AP & ENP are order-gated only (type them any time); only
    //     the final BSE ARRIVAL needs the car near the base (arrivalGatePos). The
    //     car auto-rolls in after ENP, so the gate is always reachable — it just
    //     makes you drive up to the base to finish. BSEH (home arrival) is gated
    //     the same way, since the active beat is still BSE.
    if (race.legMode === 'timed') {
      if (beat.code === 'ENP' && bnCfg('enabled', true)) {
        // Banner window (Slice 1): ENP is only postable between OPEN and CLOSE. The
        // keydown hook normally blocks pre-OPEN typing, so the pos<open path is a
        // guard; an Enter that lands after CLOSE is a timing miss (bleed + re-arm).
        const bw = race.banner;
        if (race.pos < bw.openPos) {
          flashBox('early'); AUDIO.play('menu'); showRadio(tooEarlyMsg(beat), ''); return;
        }
        if (race.pos > bw.closePos) { missEnpWindow(); return; }
        // else: inside the window → fall through to content validation below.
      } else if (race.pos < beat.gate) {
        flashBox('early'); AUDIO.play('menu'); showRadio(tooEarlyMsg(beat), ''); return;
      }
    } else if (beat.code === 'BSE' && race.pos < arrivalGatePos()) {
      flashBox('early'); AUDIO.play('menu'); showRadio(tooEarlyMsg(beat), ''); return;
    }
    // Grade the Enter against the painted hit zone BEFORE marking the beat done —
    // bannerLive() keys off ENP still being the ACTIVE beat, so grading after
    // `beat.done = true` would always come back null.
    const grade = gradeCheckpoint();
    if (DATAMOD.validateBeat(value, beat) === 'hit') {
      beat.done = true;
      // Disarm ONLY on the bannered beat. Disarming on any hit (as a first cut did)
      // means posting AP silently kills the ENP window's miss latch AND its
      // dead-time clock, so the checkpoint can never fire or be missed.
      if (beat.code === 'ENP') race.banner.armed = false;                           // window answered — don't also fire a miss
      race.gear = beat.code;                                                        // shift into this gear (status lights)
      applySpeedBoost(wpm, grade);                                                  // gauge jump; accuracy owns the hold
      if (race.leg.beats.every(function (b) { return b.done; })) {
        race.arriving = true;                                                       // leg posted → roll into the base
      } else if (race.legMode !== 'timed' && beat.code === 'ENP') {
        race.arriving = true;                                                       // Type A hybrid: after ENP, roll to the base so BSE's arrival gate is reachable
      }
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

  /* ---- BOOST (Andrew, 2026-07-19) ------------------------------------------
   * Two dials, deliberately independent (see config BOOST):
   *   HOW HARD the car pulls  ← WPM. How fast you typed the command.
   *   HOW LONG the pull lasts ← the CHECKPOINT grade. How accurately you landed
   *                             Enter on the painted hit zone.
   * So a quick typist who mistimes Enter gets a big brief shove, and a metronomic
   * one who nails the zone gets a long steady one — two routes to a fast lap
   * rather than a single "type faster" axis.
   * ------------------------------------------------------------------------- */
  function boCfg(key, dflt) { const C = CFG.BOOST || {}; return C[key] != null ? C[key] : dflt; }

  // Which tier a grade falls into. `d` is distance from the zone centre in zone
  // HALF-lengths, so d <= 1 means the car was literally on the paint. The tier
  // table is ordered best→worst; first match wins.
  function boostTier(d) {
    const tiers = boCfg('tiers', []);
    for (let i = 0; i < tiers.length; i++) if (d <= tiers[i].within) return tiers[i];
    return tiers[tiers.length - 1] || { key: 'ok', label: 'OK', hold: 1.4, mult: 1, cls: 'ok' };
  }

  // Grade the Enter that just landed against this leg's hit zone. Returns null in
  // Type A (no banners → nothing to be accurate against), which is what keeps the
  // whole indicator out of Sprint mode.
  function gradeCheckpoint() {
    if (!boCfg('enabled', true)) return null;
    if (boCfg('bannerModeOnly', true) && !bannerLive()) return null;
    const b = race.banner;
    const half = Math.max(1e-6, (b.zoneB - b.zoneA) / 2);
    const centre = (b.zoneA + b.zoneB) / 2;
    return boostTier(Math.abs(race.pos - centre) / half);
  }

  // A correct command boosts the gauge (scaled by how fast it was typed), then it
  // HOLDS before decaying. Above 100 the hold lasts longer and the value overflows
  // (a buffer) so you stay at top speed longer — the reward for chaining fast.
  // `tier` (may be null) is the checkpoint grade and owns the hold DURATION.
  function applySpeedBoost(wpm, tier) {
    const opt = spCfg('optimalWpm', 45);
    const minF = spCfg('minBoostFactor', 0.4);
    const factor = wpm ? Math.max(minF, Math.min(1, wpm / opt)) : 1;   // slow typing → smaller boost
    race.wpm = Math.round(wpm || 0);
    const mult = tier ? tier.mult : 1;
    race.speed = Math.min(spCfg('overflowMax', 250),
                          race.speed + spCfg('boost', 50) * factor * speedBoostFactor() * mult);
    const over = Math.max(0, race.speed - spCfg('max', 200));
    // Accuracy sets the hold; without a grade (Type A) it's the plain config base.
    const base = tier ? tier.hold : spCfg('holdBase', 1.2);
    race.hold = base + over * spCfg('holdOverflowPer', 0.015);
    race.brakeUntil = 0;                     // back on the throttle — off the brake
    if (race.braking) { race.braking = false; setBrakeLight(false); }
    // The engine rev — pitch and length track how hard the car actually pulled.
    AUDIO.play('throttle', factor);
    if (tier) startBoost(tier, race.hold);
  }

  function startBoost(tier, secs) {
    race.boost.tier = tier;
    race.boost.dur = secs;
    race.boost.until = nowMs() + secs * 1000;
    const el = document.getElementById('boostMeter');
    const tierEl = document.getElementById('boostTier');
    if (tierEl) tierEl.textContent = tier.label;
    if (el) el.className = 'boost-meter show ' + (tier.cls || '');
    const rv = document.getElementById('roadView');
    if (rv) rv.classList.add('boosting');
    flashPass('⏵ ' + tier.label + ' · +' + secs.toFixed(1) + 's', 'pass');
  }

  // `hard` = ended by a collision rather than by running out — kill the speed hold
  // too, so a contact genuinely costs the rest of the boost.
  function endBoost(hard) {
    if (!race.boost.tier) return;
    race.boost.tier = null; race.boost.until = 0; race.boost.dur = 0;
    if (hard) race.hold = 0;
    const el = document.getElementById('boostMeter');
    if (el) el.className = 'boost-meter';
    const rv = document.getElementById('roadView');
    if (rv) rv.classList.remove('boosting');
  }

  function updateBoost(ts) {
    if (!race.boost.tier) return;
    const left = race.boost.until - ts;
    if (left <= 0) { endBoost(false); return; }
    const fill = document.getElementById('boostFill');
    if (fill) fill.style.width = (100 * left / Math.max(1, race.boost.dur * 1000)).toFixed(1) + '%';
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
    clearStartLights();                             // kill any in-flight start countdown
    race.brakeUntil = 0; race.braking = false; setBrakeLight(false);
    clearTraffic();
    hideBanners();
    hideHitZone();
    endBoost(true);
    race.lane = 0; race.steer = 0;
    applyCarLane();
    resetShift();
  }

  /* ===================== SHIFT CHANGE (overlay) ============================
   * design: NEMS500_ShiftChange_DesignNote.md. A time-of-day-triggered box of
   * units cleared through their command chains while the car keeps moving. This
   * single-leg build fires it via LA-after-ENP; the pure model lives in
   * core/shiftchange.js so a future multi-leg loop can reuse openShiftBox() for
   * the real one-leg-early telegraph. Car never stops.
   * ==================================================================== */
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
              ') — type LA + base after ENP.', '');
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
        case 'pitbox-rejoin': PitBox.rejoin(); break;   // pit preview → drive away → race
        default: break;
      }
    });
  }

  /* ---- Keyboard menu navigation ------------------------------------------
   * (Andrew, 2026-07-19: "is it possible to use the arrow keys and the enter
   * button to select options — still be able to use the numbers to select the
   * unit".)
   *
   * The old version only cycled `.btn`s, which meant the Race Options screen was
   * keyboard-DEAD where it mattered: the Race Type toggle, Course Type toggle,
   * course carousel, Laps and Shift Change could only be reached with a mouse.
   * That is what "the arrow keys are not working properly" was.
   *
   * The model now is a proper two-axis menu, the arcade convention:
   *   UP / DOWN    — move between ROWS (every control, not just the buttons)
   *   LEFT / RIGHT — CHANGE THE VALUE of the focused row (flip the toggle, page
   *                  the carousel, step Laps, cycle a dropdown). On a plain
   *                  button, where there is no value to change, they fall back to
   *                  moving focus, so nothing ever feels stuck.
   *   ENTER / SPACE— activate the focused control
   *   1·3·5·7·9    — pick your unit directly (unchanged, per Andrew)
   *
   * Everything navigable is tagged `data-nav="<kind>"` by markNavTargets(); the
   * ring is read in DOM order, so it always matches what the player sees. */

  // What LEFT/RIGHT does on each kind of row. Returning false means "no value to
  // change here" and the caller moves focus instead.
  const NAV_ADJUST = {
    legmode:  function (dir) { setLegMode(dir > 0 ? 'timed' : 'sequence'); return true; },
    ctype:    function (dir) { setCourseType(dir > 0 ? 'point-to-point' : 'loop'); return true; },
    carousel: function (dir) { moveCourse(dir); return true; },
    int: function (dir, el) {
      const min = el.min !== '' ? Number(el.min) : -Infinity;
      const max = el.max !== '' ? Number(el.max) : Infinity;
      const next = Math.max(min, Math.min(max, (Number(el.value) || 0) + dir));
      if (next === Number(el.value)) return true;              // already at the end of the range
      el.value = next;
      el.dispatchEvent(new Event('change'));                   // reuse the row's own change handler
      return true;
    },
    select: function (dir, el) {
      const n = el.options.length;
      if (!n) return true;
      el.selectedIndex = (el.selectedIndex + dir + n) % n;
      el.dispatchEvent(new Event('change'));
      return true;
    },
    chip: function (dir) {
      // Left/Right walks the unit row; the number hotkeys still jump straight to one.
      const units = (CFG.SELECTABLE_UNITS || []);
      if (!units.length) return true;
      let i = units.findIndex(function (u) { return u.id === state.raceOptions.unit; });
      if (i < 0) i = 0;
      selectUnit(units[(i + dir + units.length) % units.length].id);
      return true;
    },
    btn: function () { return false; }                          // nothing to adjust → move focus
  };

  // Tag a screen's navigable controls. Re-run after any render that rebuilds them
  // (renderOptions / renderUnitScreen), because the old elements are gone.
  function markNavTargets(screen) {
    if (!screen) return;
    Array.prototype.forEach.call(screen.querySelectorAll('[data-nav]'), function (el) {
      el.removeAttribute('data-nav');
    });
    const add = function (el, kind) {
      if (!el) return;
      el.setAttribute('data-nav', kind);
      // Anything that isn't natively focusable needs a tabindex or it can't hold
      // the focus ring (the carousel stage is a plain <div>).
      if (!el.hasAttribute('tabindex') &&
          !/^(BUTTON|INPUT|SELECT|TEXTAREA|A)$/.test(el.tagName)) el.setAttribute('tabindex', '0');
    };
    const all = function (sel, kind) {
      Array.prototype.forEach.call(screen.querySelectorAll(sel), function (el) { add(el, kind); });
    };
    add(screen.querySelector('.legmode-toggle .ctype-switch'), 'legmode');
    add(screen.querySelector('.course-type-row .ctype-switch'), 'ctype');
    add(screen.querySelector('.course-carousel .cc-stage'), 'carousel');
    all('.opt-row input[type="number"]', 'int');
    all('.opt-row select', 'select');
    all('.unit-chip', 'chip');
    all('.btn', 'btn');
  }

  // The live focus ring for a container: navigable, enabled, actually on screen.
  function navRing(container) {
    return Array.prototype.slice.call(container.querySelectorAll('[data-nav]'))
      .filter(function (el) { return !el.disabled && el.offsetParent !== null; });
  }

  // Several adjustments (both toggles) re-render the whole options grid, which
  // destroys the element the player was standing on. Put them back on the
  // equivalent row afterwards so the focus doesn't jump to the top of the screen.
  function restoreNavFocus(screenId, kind) {
    requestAnimationFrame(function () {
      const sc = document.getElementById(screenId);
      if (!sc || !sc.classList.contains('active')) return;
      markNavTargets(sc);
      // Unit chips all share a kind, so aim for the SELECTED one, not the first.
      const el = kind === 'chip'
        ? (sc.querySelector('.unit-chip.sel') || sc.querySelector('[data-nav="chip"]'))
        : sc.querySelector('[data-nav="' + kind + '"]');
      if (el) el.focus({ preventScroll: true });
    });
  }

  function wireKeyboardNav() {
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;         // keep dev hook + native shortcuts
      const overlay = document.querySelector('.overlay.active');
      const container = overlay || document.querySelector('.screen.active');
      if (!container) return;
      if (!overlay && container.id === 'gameScreen') return;   // command input owns the keyboard
      const ae = document.activeElement;
      const tag = (ae && ae.tagName) || '';

      // Unit picker hotkeys — top-row number keys pick your car on the Unit
      // screen. Keys are spread 1·3·5·7·9 (balanced reach); ignored in a field.
      if (!overlay && container.id === 'unitScreen' && tag !== 'INPUT') {
        const units = (CFG.SELECTABLE_UNITS || []);
        for (let i = 0; i < units.length; i++) {
          if (String(units[i].hotkey) === e.key) {
            e.preventDefault(); selectUnit(units[i].id);
            restoreNavFocus(container.id, 'chip');
            return;
          }
        }
      }

      const isUp    = e.key === 'ArrowUp',    isDown  = e.key === 'ArrowDown';
      const isLeft  = e.key === 'ArrowLeft',  isRight = e.key === 'ArrowRight';
      const isEnter = e.key === 'Enter' || e.key === ' ';
      if (!isUp && !isDown && !isLeft && !isRight && !isEnter) return;

      // A free-text field owns its own arrows (caret movement). Number inputs are
      // an exception: stepping them IS the nav gesture, so they stay in the ring.
      if (tag === 'INPUT' && ae.type !== 'number') return;
      if (tag === 'TEXTAREA') return;

      const ring = navRing(container);
      if (!ring.length) return;
      let idx = ring.indexOf(ae);
      const kind = ae && ae.getAttribute ? ae.getAttribute('data-nav') : null;

      if (isEnter) {
        if (idx < 0) { e.preventDefault(); ring[0].focus(); return; }
        if (kind === 'btn') return;              // focused button → let the native click fire
        e.preventDefault();
        if (typeof ae.click === 'function') ae.click();
        return;
      }

      if (isLeft || isRight) {
        const dir = isRight ? 1 : -1;
        const adjust = kind && NAV_ADJUST[kind];
        if (adjust && adjust(dir, ae) !== false) {
          e.preventDefault(); AUDIO.play('menu');
          restoreNavFocus(container.id, kind);
          return;
        }
        // Nothing to adjust (a plain button) → fall through and move focus.
      }

      e.preventDefault();
      const step = (isDown || isRight) ? 1 : -1;
      if (idx < 0) idx = step > 0 ? -1 : 0;                     // nothing focused → enter the ring at the end we came from
      ring[(idx + step + ring.length) % ring.length].focus();
      AUDIO.play('menu');
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
    wrapScreens();          // must run before any renderer, so content lands inside the fit wrapper
    markNavTargets(document.getElementById('pauseOverlay'));   // overlays never pass through showScreen
    wireNav();
    wireModeCompliance();
    wireKeyboardNav();
    wireSteering();
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
      // Race Type B: a printable key before the OPEN banner is "too early" — a
      // stumble, not a command. Block the keystroke so ENP can't be pre-buffered
      // (Enter/Escape/Backspace and steering keys already returned / aren't length-1).
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && bannerTooEarly()) {
        e.preventDefault();
        cmdInput.value = '';
        typing.start = 0;                  // don't carry a stale stopwatch into the real window
        if (!race.banner.stumbled) {       // ONE stumble per approach — a burst of keys / key-repeat
          race.banner.stumbled = true;     // shouldn't compound the scrub or spam the radio
          enpTooEarly();
        }
        return;
      }
      if (!typing.start && e.key.length === 1) typing.start = nowMs();   // stopwatch starts on 1st keystroke
      AUDIO.play('typing');
    });
    // Pit-box SWAP input — LOCAL to the pit-stop preview, deliberately NOT the
    // race command parser (SWAP stays out of the CAD command set; spec §9.1).
    const pbxInput = document.getElementById('pbxInput');
    if (pbxInput) pbxInput.addEventListener('keydown', PitBox.onKey);
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

    // Re-fit the active map + rescale the active screen when the window resizes,
    // so the layout tracks the monitor it actually ends up on.
    let resizeT = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeT);
      resizeT = setTimeout(function () {
        if (state.currentScreen === 'gridScreen') renderMap('gridMap');
        if (state.currentScreen === 'gameScreen') renderMap('regionMap');
        fitScreen(state.currentScreen);
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
      refit();                  // content just grew — rescale whatever is on screen
    });

    runBoot();   // boot animation runs in parallel with data load
  }

  // Debug hook (Demo/dev build) — inspect/drive the leg loop from the console.
  // openShiftChange('0600') pops the box for any schedule slot; best run while on
  // the game screen mid-leg. closeShiftChange() tears it down.
  window.PITSTOP_DEBUG = {
    race: race, activeBeat: activeBeat, startRace: startRace, startLeg: startLeg, state: state, loop: loop,
    showScreen: showScreen, pitBox: PitBox,   // jump screens / drive the pit-box preview from the console
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
      const ts = nowMs();
      updateSpeed(d, ts);
      const eff = Math.min(spCfg('max', 200), race.speed);
      const v = (eff / spCfg('max', 200)) * spCfg('legRate', 0.6);
      race.pos = Math.min(1, race.pos + v * d);     // advance the leg too, or the banners never arrive
      updateRoad(d, v);
      updateSteer(d);
      updateTraffic(d, eff);
      checkSwerveCollisions(ts);
      tickBannerWait(d);
      updateBanners();
      updateBoost(ts);
      updateRaceHUD();
      return { pos: +race.pos.toFixed(3), speed: +race.speed.toFixed(2), lane: +race.lane.toFixed(2),
               braking: race.braking, tire: race.tireHealth,
               boost: race.boost.tier ? race.boost.tier.key : null };
    },
    // Steering + checkpoint helpers, so the new mechanics are drivable from the
    // console without 60fps hand-timing.
    steer: function (d) { race.steer = d; return race.lane; },
    boost: race.boost,
    banner: race.banner,
    grade: function () { const t = gradeCheckpoint(); return t ? t.key : null; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

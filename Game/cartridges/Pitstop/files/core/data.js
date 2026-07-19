/* ============================================================================
 * PITSTOP (NEMS 500) — core/data.js
 * PowerLine Challenge cartridge · Phase 0 Scaffold · v0.1.2
 * ----------------------------------------------------------------------------
 * THEME-AGNOSTIC DATA LAYER. Per Build Procedure §3.2 + handoff §6/§7.
 *
 * UPDATED v0.1.2: base records now load from Bases_Coordinates_PLACEHOLDER.csv
 * (real-world lat/lon + approx_dist_to_westwood_km). Map coords are PROJECTED
 * from lat/lon (cos-corrected, aspect-preserving) so the region map is
 * geographically faithful. distanceToWestwood now uses the real km values.
 *
 *   ⚠ generateChallenge() / validateCommand() remain [PHASE 1 — GATED] stubs.
 *   Map geometry (projection, loop order, road links) is placeholder RENDERING
 *   data only — no movement, validation, or scoring logic exists here.
 * ========================================================================= */

(function (global) {
  'use strict';

  const CFG = (global.PITSTOP_CONFIG || {});
  const PIT_BASE_ID = CFG.PIT_BASE_ID || '72122';

  // Map viewBox the projection targets (matches the <svg> viewBox in index.html).
  const VIEW = { w: 100, h: 80, pad: 9 };

  const DATA = {
    ready: false,
    commands: [],   // { challenge, command, type }
    bases: [],      // { id, name, weight, lat, lon, distanceToWestwood, coords:{x,y}, scenery }
    units: [],      // string ids
    courses: [],    // { id, name, type, laps, baseIds[] }
    baseById: {},
  };

  /* ---- CSV parsing (BOM-aware, CRLF-safe) --------------------------------- */
  function parseCSV(text) {
    if (!text) return [];
    text = text.replace(/^﻿/, '');
    const lines = text.split(/\r?\n/).filter(l => l.trim().length);
    if (!lines.length) return [];
    const headers = splitLine(lines[0]).map(h => h.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = splitLine(lines[i]);
      const row = {};
      headers.forEach((h, j) => { row[h] = (cells[j] || '').trim(); });
      rows.push(row);
    }
    return rows;
  }
  function splitLine(line) {
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { q = !q; }
      else if (c === ',' && !q) { out.push(cur); cur = ''; }
      else { cur += c; }
    }
    out.push(cur);
    return out;
  }

  /* ---- CSV text source ------------------------------------------------------
   * Baked text (datasets/embedded.js) wins. Anything not in the bake falls back
   * to fetch, which succeeds only over http:// — that keeps the OPTIONAL,
   * currently-absent datasets (commands.csv, units.csv, bases.csv) working the
   * way they always did. Resolves null when neither source has the file. */
  function csvText(path) {
    const baked = (global.PITSTOP_CSV || {})[path];
    if (typeof baked === 'string') return Promise.resolve(baked);
    return fetch(path + '?t=' + Date.now())
      .then(r => (r.ok ? r.text() : null))
      .catch(() => null);
  }

  /* ---- Loader (baked CSV text, so the cartridge runs from file://) ----------
   * Bases now come from the VALIDATED BaseGeo authority (core/basegeo.js): real
   * lat/lon, load-time validation, 72122 excluded. The old placeholder CSV is
   * retired. A BaseGeo rejection (bad export) still drops to the embedded
   * fallback so the game boots — logged loudly so the data gets fixed at source
   * rather than silently limping on stale numbers.
   *
   * CSV TEXT comes from datasets/embedded.js (window.PITSTOP_CSV), baked from the
   * CSVs by `node bake-data.mjs`. Browsers block fetch() of local files under
   * file://, so a double-clicked index.html could never read the real datasets —
   * it silently raced to the hand-authored FALLBACK courses below. The CSVs are
   * still the source of truth; the bake just carries their text across.
   *
   *   ⚠ Re-bake after ANY CSV edit or the game keeps serving the last bake. */
  function loadGameData() {
    const BASEGEO = (global.PITSTOP_BASEGEO || {});
    const fetchText = f => csvText(f).then(t => {
      if (t == null) throw new Error('no baked or served copy of ' + f);
      return t;
    });
    const geoLoad = BASEGEO.loadBaseGeo
      ? BASEGEO.loadBaseGeo({ view: VIEW }).catch(err => ({ ok: false, bases: [],
          errors: ['BaseGeo load failed: ' + err.message] }))
      : Promise.resolve({ ok: false, bases: [], errors: ['PITSTOP_BASEGEO unavailable'] });

    // Courses are now TWO normalized files (Andrew, 2026-07-17): Courses.csv holds
    // metadata (CourseID,CourseName,Closure) and CourseStops.csv the ordered stops.
    // fetchOpt lets a missing course file drop to the embedded fallback instead of
    // nuking the whole load. (Courses.csv == the retired wide courses.csv on
    // case-insensitive Windows — same path, new schema.)
    // Per-file resilience: a single missing/renamed CSV must NOT blank the whole
    // game. Each source falls back to its embedded copy independently, so the rest
    // of the datasets still load. (Only a total failure hits the outer catch.)
    const fetchOpt = f => fetchText(f).catch(() => null);
    return Promise.all([
      fetchOpt('datasets/commands.csv'),
      fetchOpt('datasets/units.csv'),
      fetchOpt('datasets/courses.csv'),
      geoLoad,
      fetchOpt('datasets/coursestops.csv')
    ]).then(function (res) {
      const geo = res[3];
      if (!geo.ok) {
        console.error('[Pitstop] BaseGeo REJECTED the dataset (' + geo.errors.length +
                      ' problem(s)) — falling back to embedded bases. Repair at source in Excel:');
        geo.errors.forEach(e => console.error('  • ' + e));
      }
      if (!res[0]) console.warn('[Pitstop] datasets/commands.csv missing — using the embedded command set.');
      if (!res[1]) console.warn('[Pitstop] datasets/units.csv missing — using the embedded unit roster.');
      const commands = res[0] ? parseCSV(res[0]) : FALLBACK.commands;
      const units    = res[1] ? parseCSV(res[1]) : FALLBACK.units;
      const meta  = res[2] ? parseCSV(res[2]) : null;
      const stops = res[4] ? parseCourseStops(res[4]) : null;
      // No SILENT fall-through to the hand-authored FALLBACK courses: that is what
      // made a double-clicked index.html quietly serve the original stub courses.
      let courseObjs = joinCourses(meta, stops);
      if (!courseObjs) {
        console.error('[Pitstop] courses.csv / coursestops.csv did not load — showing the ' +
                      'hand-authored STUB courses, NOT your dataset. Fix: run `node bake-data.mjs` ' +
                      'in the Pitstop folder, then reload.');
        courseObjs = buildCourses(FALLBACK.courses);
      }
      applyData(commands, units, courseObjs, geo.ok ? geo.bases : null);
      // Bake stamp: the one cheap way to spot "I edited a CSV but forgot to re-bake".
      console.log('[Pitstop] datasets baked ' + (global.PITSTOP_CSV_BAKED || '(not baked)') +
                  ' — ' + DATA.courses.length + ' courses, ' + DATA.bases.length + ' bases.');
      DATA.ready = true;
      return DATA;
    }).catch(function (err) {
      console.error('[Pitstop] data load failed (' + err.message + ') — using the hand-authored ' +
                    'STUB data, NOT your dataset. Check that datasets/embedded.js loaded; ' +
                    're-bake with `node bake-data.mjs` if it is missing.');
      applyData(FALLBACK.commands, FALLBACK.units, buildCourses(FALLBACK.courses), null);
      DATA.ready = true;
      return DATA;
    });
  }

  // geoBases = validated BaseGeo records ({code,name,lat,lon,xy}), or null to use
  // the embedded fallback base set. courseObjs = already-built course objects
  // ({id,name,type,laps,baseIds}) from joinCourses() or buildCourses().
  function applyData(commandRows, unitRows, courseObjs, geoBases) {
    DATA.commands = commandRows.map(function (r) {
      return { challenge: r.Challenge, command: r.Command, type: r.Type };
    }).filter(c => c.command);
    DATA.units = unitRows.map(r => String(r.Units || r.Unit || '').trim()).filter(Boolean);
    DATA.bases = buildBaseRecords(geoBases || FALLBACK.bases);
    injectPitFurniture(DATA.bases);
    projectBases(DATA.bases);
    DATA.baseById = {};
    DATA.bases.forEach(b => { DATA.baseById[b.id] = b; });
    DATA.courses = courseObjs || [];
  }

  /* ---- coursestops.csv → ordered stop rows --------------------------------
   * Canonical schema: CourseID,StopOrder,bse_code (UTF-8 no BOM, LF).
   *
   * Header-keyed when the canonical header is present, POSITIONAL otherwise
   * (col0=CourseID, col1=StopOrder, col2=bse_code). The positional path is kept
   * because an Excel re-export has historically mangled the header — cramming
   * "StopOrder, bse_code" into one quoted cell — which would silently yield zero
   * stops under header-keyed parsing. CourseIDs and bse_codes never contain
   * commas, so a plain split is safe on either path.
   *
   *   ⚠ bse_code is a STRING key: values are mixed (numeric "72117", alpha
   *   "WF-CRU"). Never numeric-parse it — "WF-CRU" would become NaN and its
   *   BaseGeo join would fail silently. */
  function parseCourseStops(text) {
    const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return [];
    const head = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    const iId = head.indexOf('courseid'), iOrd = head.indexOf('stoporder'), iCode = head.indexOf('bse_code');
    const canonical = iId !== -1 && iOrd !== -1 && iCode !== -1;
    if (!canonical) {
      console.warn('[Pitstop] coursestops.csv header is not canonical ' +
                   '(CourseID,StopOrder,bse_code) — falling back to positional columns. ' +
                   'Repair the header at source; a re-export likely merged two labels into one cell.');
    }
    const cId = canonical ? iId : 0, cOrd = canonical ? iOrd : 1, cCode = canonical ? iCode : 2;
    const out = [];
    for (let i = 1; i < lines.length; i++) {            // row 0 is the header on both paths
      const c = lines[i].split(',');
      const id = (c[cId] || '').trim();
      const code = (c[cCode] || '').trim();             // string key — no numeric parse
      if (!id || !code) continue;
      out.push({ courseId: id, order: parseInt(c[cOrd], 10), code: code });
    }
    return out;
  }

  /* ---- Join Courses (metadata) ⋈ CourseStops (ordered stops) ----------------
   * metaRows: CourseID,CourseName,Closure (tolerates the "CouseID" export typo).
   * Closure → type: Circuit = loop, PointToPoint = point-to-point. Circuit closure
   * is IMPLIED — buildStops() re-appends the start, so the authored sequence is the
   * DISTINCT stops with no repeated start. laps is 1 here (player picks 3/6/9/12 at
   * race time). Returns null when either file is missing/empty so the caller can
   * fall back to the embedded courses. */
  function joinCourses(metaRows, stopRows) {
    if (!metaRows || !metaRows.length || !stopRows || !stopRows.length) return null;
    const byCourse = {};
    stopRows.forEach(function (s) {
      (byCourse[s.courseId] = byCourse[s.courseId] || []).push(s);
    });
    Object.keys(byCourse).forEach(function (id) {
      byCourse[id].sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    });
    const out = [];
    metaRows.forEach(function (m) {
      const id = String(m.CourseID || m.CouseID || m.CourseId || m.id || '').trim();
      const stops = id && byCourse[id];
      if (!stops || !stops.length) return;
      const closure = String(m.Closure || '').trim().toLowerCase();
      const type = (closure === 'pointtopoint' || closure === 'point-to-point') ? 'point-to-point' : 'loop';
      out.push({
        id: id,
        name: String(m.CourseName || m['Course Name'] || m.Name || id).trim(),
        type: type,
        laps: 1,                                        // player-selected at race time
        baseIds: stops.map(function (s) { return s.code; })
      });
    });
    return out.length ? out : null;
  }

  // Course rows: CourseId,Name,Type,Laps,Bases  (Bases = pipe/space-separated codes)
  // Retained for the embedded FALLBACK courses (wide format).
  function buildCourses(rows) {
    return rows.map(function (r) {
      const ids = String(r.Bases || r.bases || '').split(/[|;,\s]+/).map(s => s.trim()).filter(Boolean);
      return {
        id: String(r.CourseId || r.id || '').trim(),
        name: String(r.Name || r.name || '').trim(),
        type: (String(r.Type || r.type || 'loop').trim().toLowerCase() === 'point-to-point') ? 'point-to-point' : 'loop',
        laps: parseInt(r.Laps || r.laps, 10) || 1,
        baseIds: ids
      };
    }).filter(c => c.id && c.baseIds.length);
  }

  /* ---- Base records --------------------------------------------------------
   * Accepts either validated BaseGeo records ({code,name,lat,lon,xy}) or the
   * embedded FALLBACK rows (same {code,name,lat,lon,weight} shape). The map only
   * needs id/name/lat/lon; weight is carried for any future weighted feature and
   * is joined from the embedded Data Sheet weights when the source omits it. */
  function buildBaseRecords(rows) {
    return rows.map(function (r) {
      const id = String(r.code != null ? r.code : (r.id != null ? r.id : '')).trim();
      const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
      return {
        id: id,
        name: String(r.name || '').trim(),
        weight: (r.weight != null ? r.weight : weightFor(id)),
        lat: isFinite(lat) ? lat : null,
        lon: isFinite(lon) ? lon : null,
        coords: (r.xy && isFinite(r.xy.x)) ? { x: r.xy.x, y: r.xy.y }
                                           : { x: 50, y: 40 },     // set by projectBases()
        scenery: null,                                            // [DEFERRED] per-leg asset ref
        isPit: false
      };
    }).filter(b => b.id);
  }

  // Authored base weights, keyed by code — the embedded copy of the Data Sheet
  // weight column, so a BaseGeo record (which carries no weight) still gets one.
  function weightFor(code) {
    const row = FALLBACK.bases.find(b => String(b.code) === String(code));
    return row && row.weight != null ? row.weight : 1;
  }

  /* ---- Pit facility (spec §4.4 / L5) --------------------------------------
   * The pit (Fleet, PIT_BASE_ID) is TRACK FURNITURE, not a BaseGeo node — it has
   * no lat/lon of its own. Physically it shares a building with Glendale (72115)
   * at 2 Westwood Ct, so it inherits Glendale's real position; the map draws the
   * pit lane from the start/finish node out to here. Injected after the base set
   * is built so it is never a raceable node (it is filtered from random courses)
   * yet is present in baseById for the renderer. */
  function injectPitFurniture(bases) {
    const pitId = CFG.PIT_BASE_ID || '72123';
    if (bases.some(b => b.id === pitId)) return;
    const anchorId = CFG.PIT_ANCHOR_ID || '72115';               // Glendale — co-located
    const anchor = bases.find(b => b.id === anchorId);
    if (!anchor || anchor.lat == null) return;                   // no anchor → skip silently
    bases.push({
      id: pitId, name: 'Fleet',
      weight: weightFor(pitId),
      lat: anchor.lat, lon: anchor.lon,
      coords: { x: 50, y: 40 },
      scenery: null, isPit: true
    });
  }

  /* ---- Projection: real lat/lon -> map viewBox coords ---------------------
   * Equirectangular with cosine-of-latitude correction so east-west distance
   * isn't stretched. Aspect-preserving, centered, y-flipped (north = top).
   * Co-located bases (e.g. Westwood/Fleet/Glendale share an address) get a tiny
   * deterministic spiral nudge so every dot is visible. */
  function projectBases(bases) {
    const geo = bases.filter(b => b.lat != null && b.lon != null);
    if (!geo.length) return;

    // If a geo-referenced map image is configured, place bases by the image's
    // lat/lon bounds so dots align to the art. Otherwise auto-fit to the bases.
    const rm = (CFG.REGION_MAP || {});
    if (rm.bounds && rm.bounds.north != null) {
      const bd = rm.bounds;
      const availW = VIEW.w - 2 * VIEW.pad, availH = VIEW.h - 2 * VIEW.pad;
      geo.forEach(function (b) {
        const x = VIEW.pad + ((b.lon - bd.west) / (bd.east - bd.west)) * availW;
        const y = VIEW.pad + ((bd.north - b.lat) / (bd.north - bd.south)) * availH;
        b.coords = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
      });
      return;
    }

    const meanLat = geo.reduce((s, b) => s + b.lat, 0) / geo.length;
    const k = Math.cos(meanLat * Math.PI / 180);

    const px = b => b.lon * k, py = b => b.lat;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    geo.forEach(function (b) {
      minX = Math.min(minX, px(b)); maxX = Math.max(maxX, px(b));
      minY = Math.min(minY, py(b)); maxY = Math.max(maxY, py(b));
    });
    const spanX = (maxX - minX) || 1, spanY = (maxY - minY) || 1;
    const availW = VIEW.w - 2 * VIEW.pad, availH = VIEW.h - 2 * VIEW.pad;
    const scale = Math.min(availW / spanX, availH / spanY);
    const offX = VIEW.pad + (availW - spanX * scale) / 2;
    const offY = VIEW.pad + (availH - spanY * scale) / 2;

    const seen = {};
    geo.forEach(function (b) {
      let x = offX + (px(b) - minX) * scale;
      let y = offY + (maxY - py(b)) * scale;        // flip
      const key = Math.round(x) + ',' + Math.round(y);
      const n = seen[key] || 0; seen[key] = n + 1;
      if (n > 0) {                                    // nudge duplicates onto a small ring
        const ang = n * 1.7;
        x += Math.cos(ang) * 1.6; y += Math.sin(ang) * 1.6;
      }
      b.coords = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    });
  }

  /* ---- Map geometry helpers (placeholder rendering — not gameplay) -------- */
  // Closed loop order: sort bases by polar angle around their centroid so the
  // course reads as a non-tangled ring. Returns ordered array of base ids.
  function loopOrder(bases) {
    const pts = (bases || DATA.bases).filter(b => b.coords);
    if (pts.length < 3) return pts.map(b => b.id);
    const cx = pts.reduce((s, b) => s + b.coords.x, 0) / pts.length;
    const cy = pts.reduce((s, b) => s + b.coords.y, 0) / pts.length;
    return pts.slice().sort(function (a, b) {
      return Math.atan2(a.coords.y - cy, a.coords.x - cx) -
             Math.atan2(b.coords.y - cy, b.coords.x - cx);
    }).map(b => b.id);
  }

  // Sparse road network: link each base to its nearest neighbour (deduped).
  function roadLinks(bases) {
    const pts = (bases || DATA.bases).filter(b => b.coords);
    const links = {}; const out = [];
    pts.forEach(function (a) {
      let best = null, bd = Infinity;
      pts.forEach(function (b) {
        if (a === b) return;
        const dx = a.coords.x - b.coords.x, dy = a.coords.y - b.coords.y;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = b; }
      });
      if (best) {
        const key = [a.id, best.id].sort().join('|');
        if (!links[key]) { links[key] = 1; out.push([a, best]); }
      }
    });
    return out;
  }

  /* ---- Route record (handoff §6) — pure data, no race logic --------------- */
  function buildRoute(baseIds, type) {
    type = type || 'loop';
    let pitJunction = null, best = Infinity;
    (baseIds || []).forEach(function (id) {
      const b = DATA.baseById[id];
      if (b && b.distanceToPit != null && b.distanceToPit < best) {
        best = b.distanceToPit; pitJunction = id;
      }
    });
    return {
      bases: (baseIds || []).slice(),
      type: type,
      pitJunction: pitJunction,
      pitSpurCost: pitJunction != null ? best : null
    };
  }

  /* ---- Active course resolver (handoff §4 course select) ------------------
   * Resolves a course id to a renderable course capped at COURSE_MAX_BASES.
   * 'random' samples N bases and angle-orders them into a clean loop. Named
   * courses keep their authored order. Pure data — no race logic. */
  function getActiveCourse(courseId, typeHint) {
    const MAX = CFG.COURSE_MAX_BASES || 5;
    if (courseId === 'random') {
      // A Random draw takes the closure the player picked in Race Options (the
      // course-type toggle), so a Point 2 Point random is actually open-ended.
      const type = (typeHint === 'point-to-point') ? 'point-to-point' : 'loop';
      const pool = DATA.bases.filter(b => !b.isPit);   // the pit is furniture, never a stop
      const pick = [];
      while (pick.length < MAX && pool.length) {
        pick.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      }
      const ordered = loopOrder(pick);
      return { id: 'random', name: 'Random ' + ordered.length, type: type, laps: 3,
               baseIds: ordered, startId: ordered[0] };
    }
    let c = DATA.courses.find(x => x.id === courseId) || DATA.courses[0];
    if (!c) return null;
    // Authored courses keep their FULL sequence — the NEMS courses run 4–15 stops.
    // COURSE_MAX_BASES (Andrew's 5) now caps the RANDOM draw only, not authored
    // courses. Bases missing from BaseGeo are dropped — that's a data gap to
    // surface, not silent truncation. As of the 2026-07-18 dataset repair all 47
    // stops across the 7 NEMS courses resolve, so this should never fire; if it
    // does, the CSVs have drifted apart again (check bse_code spelling first —
    // WF-CRU vs WF_CRU has bitten this join before).
    const ids = c.baseIds.filter(id => DATA.baseById[id]);
    const dropped = c.baseIds.length - ids.length;
    if (dropped) {
      console.warn('[Pitstop] course "' + c.id + '": ' + dropped + ' base(s) not in ' +
                   'BaseGeo, dropped — coursestops.csv and baselatlon.csv disagree.');
    }
    return { id: c.id, name: c.name, type: c.type, laps: c.laps, baseIds: ids, startId: ids[0] };
  }

  /* ===== PHASE 1 — Leg / Challenge model (authorized 2026-06-20) ===========
   * A LEG = the 3-beat post sequence AP→ENP→BSE posting a unit from base A to
   * base B, each beat position-gated. Per the Overview Universal Formula, each
   * beat's Command is "[CODE] [UNIT] [BASE NUMBER]". Pure data — the leg-loop
   * physics/state machine lives in the cartridge layer (script.js). */
  function buildLeg(unitId, fromId, toId) {
    const to = DATA.baseById[toId];
    if (!to) return null;
    const T = (CFG.TUNABLES || {});
    const num = to.id, name = to.name;
    // The base CODE (base number) is required ONLY for AP and BSE. ENP is a
    // radio "I'm mobile" call and doesn't restate the base, so its base code is
    // optional. ARRIVAL twist/cheat: on the BSE beat the player may post
    // "Home Start/Stop" — BSEH <unit> — which needs NO base code, just like the
    // real world. That alternate is carried on the BSE beat as `homeCode`.
    return {
      unit: unitId, fromId: fromId, toId: toId, toName: name,
      beats: [
        { code: 'AP',  gate: T.gateAP != null ? T.gateAP : 0.0, unit: unitId, baseNum: num, requiresBaseCode: true,
          challenge: 'Assign ' + unitId + ' to ' + name,  command: 'AP ' + unitId + ' ' + num,  done: false },
        { code: 'ENP', gate: T.gateENP != null ? T.gateENP : 0.5, unit: unitId, baseNum: num, requiresBaseCode: false,
          challenge: unitId + ' enroute to ' + name,       command: 'ENP ' + unitId,             done: false },
        { code: 'BSE', gate: T.gateBSE != null ? T.gateBSE : 0.85, unit: unitId, baseNum: num, requiresBaseCode: true,
          homeCode: 'BSEH',
          challenge: unitId + ' based at ' + name,          command: 'BSE ' + unitId + ' ' + num, done: false }
      ]
    };
  }

  // Lenient tokeniser: uppercase, drop commas + filler words (TO/AT/THE).
  function tokenizeCmd(s) {
    return String(s || '').toUpperCase().replace(/,/g, ' ')
      .split(/\s+/).filter(function (t) { return t && t !== 'TO' && t !== 'AT' && t !== 'THE'; });
  }

  // Beat-aware validator (Andrew, 2026-07-12). Returns 'hit' | 'miss':
  //  • Base code (base number) is required ONLY for AP and BSE. ENP is accepted
  //    with OR without a trailing base number.
  //  • ARRIVAL cheat — on the BSE beat only, "BSEH <unit>" ("Home Start/Stop")
  //    posts the arrival with NO base code required.
  function validateBeat(input, beat) {
    if (!beat) return 'miss';
    const toks = tokenizeCmd(input);
    if (toks.length < 2) return 'miss';
    const code = toks[0];
    const unit = String(beat.unit != null ? beat.unit : '').toUpperCase();
    const num  = String(beat.baseNum != null ? beat.baseNum : '').toUpperCase();

    // "Home Start/Stop": BSEH skips the base code (arrival beat only).
    if (beat.homeCode && code === String(beat.homeCode).toUpperCase()) {
      return toks[1] === unit ? 'hit' : 'miss';
    }
    if (code !== String(beat.code).toUpperCase()) return 'miss';
    if (toks[1] !== unit) return 'miss';

    if (beat.requiresBaseCode) {
      return toks[2] === num ? 'hit' : 'miss';        // AP / BSE — base code required
    }
    // ENP — base code optional: tolerate a trailing base number, else accept.
    if (toks.length >= 3) return toks[2] === num ? 'hit' : 'miss';
    return 'hit';
  }

  /* ---- Embedded fallback (file:// or a rejected dataset) -------------------
   * The 17 raceable bases, mirroring the repaired datasets/Bases lat lon.csv
   * (real signed lat/lon, Data Sheet names, 72122 excluded). Same
   * {code,name,lat,lon,weight} shape buildBaseRecords reads from BaseGeo, so both
   * paths share one builder. The pit (Fleet 72123) is NOT here — injectPitFurniture
   * adds it from Glendale's position. Keep this in sync if the CSV changes. */
  const FALLBACK = {
    commands: [
      { Challenge: 'Post to',    Command: 'AP',  Type: 'direction' },
      { Challenge: 'Enroute to', Command: 'ENP', Type: 'radio' },
      { Challenge: 'Arriving',   Command: 'BSE', Type: 'radio' },
      { Challenge: 'Area of',    Command: 'LA',  Type: 'radio' }
    ],
    bases: [
      { code: '72100', name: 'Niagara Falls', lat: 43.112649, lon: -79.088989, weight: 10 },
      { code: '72101', name: 'Ontario St',    lat: 43.158174, lon: -79.252737, weight: 10 },
      { code: '72102', name: 'Linwell',       lat: 43.197654, lon: -79.232361, weight: 10 },
      { code: '72103', name: 'Thorold',       lat: 43.088509, lon: -79.199505, weight: 10 },
      { code: '72104', name: 'NOTL',          lat: 43.253247, lon: -79.066338, weight: 10 },
      { code: '72105', name: 'Grimsby',       lat: 43.186578, lon: -79.513405, weight: 10 },
      { code: '72107', name: 'Port Colborne', lat: 42.901783, lon: -79.242849, weight: 10 },
      { code: '72108', name: 'King St',       lat: 42.977938, lon: -79.250540, weight: 10 },
      { code: '72109', name: 'Smithville',    lat: 43.099502, lon: -79.547651, weight: 10 },
      { code: '72110', name: 'Vineland',      lat: 43.152023, lon: -79.389173, weight: 8  },
      { code: '72111', name: 'Pelham',        lat: 43.044691, lon: -79.298811, weight: 10 },
      { code: '72113', name: 'Ridgeway',      lat: 42.884529, lon: -79.059275, weight: 8  },
      { code: '72115', name: 'Glendale',      lat: 43.159931, lon: -79.154590, weight: 10 },
      { code: '72116', name: 'St Paul',       lat: 43.132890, lon: -79.099461, weight: 8  },
      { code: '72117', name: 'Fort Erie',     lat: 42.921095, lon: -78.939352, weight: 10 },
      { code: '72118', name: 'Merrittville',  lat: 43.115569, lon: -79.242849, weight: 8  },
      { code: '72125', name: 'Prince Charles',lat: 42.992128, lon: -79.261011, weight: 10 }
    ],
    units: [{ Units: '2100' }, { Units: '2101' }, { Units: '2102' }, { Units: 'FIT' }, { Units: 'CARE1' }],
    courses: [{ CourseId: 'niagara-loop', Name: 'Niagara Loop', Type: 'loop', Laps: '3',
                Bases: '72102|72101|72103|72100|72116' },
              { CourseId: 'central-5', Name: 'Niagara Central 5', Type: 'loop', Laps: '3',
                Bases: '72102|72101|72103|72116|72100' }]
  };

  global.PITSTOP_DATA = {
    DATA: DATA,
    loadGameData: loadGameData,
    parseCSV: parseCSV,
    buildRoute: buildRoute,
    loopOrder: loopOrder,
    roadLinks: roadLinks,
    getActiveCourse: getActiveCourse,
    buildLeg: buildLeg,                       // PHASE 1 — leg model
    validateBeat: validateBeat                // PHASE 1 — beat validation
  };
})(window);

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

  /* ---- Loader (fetch over http://, embedded fallback for file://) ---------- */
  function loadGameData() {
    const files = ['datasets/commands.csv',
                   'datasets/Bases_Coordinates_PLACEHOLDER.csv',
                   'datasets/units.csv',
                   'datasets/courses.csv'];
    return Promise.all(files.map(f =>
      fetch(f + '?t=' + Date.now()).then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + f);
        return r.text();
      })
    )).then(function (texts) {
      applyData(parseCSV(texts[0]), parseCSV(texts[1]), parseCSV(texts[2]), parseCSV(texts[3]));
      DATA.ready = true;
      return DATA;
    }).catch(function (err) {
      console.warn('[Pitstop] CSV load failed (' + err.message + ') — using embedded fallback. ' +
                   'Serve over http:// (Start Dev Server.bat) for live datasets.');
      applyData(FALLBACK.commands, FALLBACK.bases, FALLBACK.units, FALLBACK.courses);
      DATA.ready = true;
      return DATA;
    });
  }

  function applyData(commandRows, baseRows, unitRows, courseRows) {
    DATA.commands = commandRows.map(function (r) {
      return { challenge: r.Challenge, command: r.Command, type: r.Type };
    }).filter(c => c.command);
    DATA.units = unitRows.map(r => String(r.Units || r.Unit || '').trim()).filter(Boolean);
    DATA.bases = buildBaseRecords(baseRows);
    projectBases(DATA.bases);
    DATA.baseById = {};
    DATA.bases.forEach(b => { DATA.baseById[b.id] = b; });
    DATA.courses = buildCourses(courseRows || []);
  }

  // Course rows: CourseId,Name,Type,Laps,Bases  (Bases = pipe/space-separated codes)
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

  /* ---- Base records (handoff §6) ------------------------------------------ */
  // Accepts rows from Bases_Coordinates_PLACEHOLDER.csv:
  // Base,Code,City,Address,Weight,approx_lat,approx_lon,approx_dist_to_westwood_km,coord_status
  function buildBaseRecords(rows) {
    return rows.map(function (r) {
      const id = String(r.Code || r['Command Base'] || '').trim();
      const name = String(r.Base || r['Challenge Base'] || '').trim().replace(/\s+Base$/i, '');
      const lat = parseFloat(r.approx_lat);
      const lon = parseFloat(r.approx_lon);
      const distKm = parseFloat(r.approx_dist_to_westwood_km);
      return {
        id: id,
        name: name,
        weight: parseFloat(r.Weight) || 1,
        city: r.City || '',
        lat: isFinite(lat) ? lat : null,
        lon: isFinite(lon) ? lon : null,
        // Distance to the PIT (Fleet 72123). The CSV column is named
        // approx_dist_to_westwood_km, but Fleet & Westwood are co-located, so
        // the values equal distance-to-Fleet/pit.
        distanceToPit: isFinite(distKm) ? distKm : null,
        coords: { x: 50, y: 40 },                                // set by projectBases()
        scenery: null                                            // [DEFERRED] per-leg asset ref
      };
    }).filter(b => b.id);
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
  function getActiveCourse(courseId) {
    const MAX = CFG.COURSE_MAX_BASES || 5;
    if (courseId === 'random') {
      const pool = DATA.bases.slice();
      const pick = [];
      while (pick.length < MAX && pool.length) {
        pick.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      }
      const ordered = loopOrder(pick);
      return { id: 'random', name: 'Random ' + ordered.length, type: 'loop', laps: 3,
               baseIds: ordered, startId: ordered[0] };
    }
    let c = DATA.courses.find(x => x.id === courseId) || DATA.courses[0];
    if (!c) return null;
    const ids = c.baseIds.filter(id => DATA.baseById[id]).slice(0, MAX);
    if (c.baseIds.length > MAX) {
      console.warn('[Pitstop] course "' + c.id + '" has ' + c.baseIds.length +
                   ' bases; capped to ' + MAX + '.');
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

  /* ---- Embedded fallback (full 21 bases so the map works on file:// too) -- */
  const FALLBACK = {
    commands: [
      { Challenge: 'Post to',    Command: 'AP',  Type: 'direction' },
      { Challenge: 'Enroute to', Command: 'ENP', Type: 'radio' },
      { Challenge: 'Arriving',   Command: 'BSE', Type: 'radio' },
      { Challenge: 'Area of',    Command: 'LA',  Type: 'radio' }
    ],
    bases: [
      { Base: 'Niagara Falls', Code: '72100', Weight: 10, approx_lat: 43.108, approx_lon: -79.083, approx_dist_to_westwood_km: 11.73 },
      { Base: 'Ontario St',    Code: '72101', Weight: 10, approx_lat: 43.171, approx_lon: -79.245, approx_dist_to_westwood_km: 3.65 },
      { Base: 'Linwell',       Code: '72102', Weight: 10, approx_lat: 43.196, approx_lon: -79.247, approx_dist_to_westwood_km: 4.78 },
      { Base: 'Thorold',       Code: '72103', Weight: 10, approx_lat: 43.135, approx_lon: -79.215, approx_dist_to_westwood_km: 4.08 },
      { Base: 'NOTL',          Code: '72104', Weight: 10, approx_lat: 43.255, approx_lon: -79.071, approx_dist_to_westwood_km: 14.09 },
      { Base: 'Grimsby',       Code: '72105', Weight: 10, approx_lat: 43.2,   approx_lon: -79.565, approx_dist_to_westwood_km: 29.78 },
      { Base: 'Port Colborne', Code: '72107', Weight: 10, approx_lat: 42.886, approx_lon: -79.25,  approx_dist_to_westwood_km: 31.84 },
      { Base: 'King St',       Code: '72108', Weight: 10, approx_lat: 43.0,   approx_lon: -79.248, approx_dist_to_westwood_km: 19.3 },
      { Base: 'Smithville',    Code: '72109', Weight: 10, approx_lat: 43.092, approx_lon: -79.553, approx_dist_to_westwood_km: 29.93 },
      { Base: 'Vineland',      Code: '72110', Weight: 8,  approx_lat: 43.155, approx_lon: -79.398, approx_dist_to_westwood_km: 16.15 },
      { Base: 'Pelham',        Code: '72111', Weight: 10, approx_lat: 43.038, approx_lon: -79.293, approx_dist_to_westwood_km: 16.51 },
      { Base: 'Ridgeway',      Code: '72113', Weight: 8,  approx_lat: 42.884, approx_lon: -79.052, approx_dist_to_westwood_km: 34.0 },
      { Base: 'Glendale',      Code: '72115', Weight: 10, approx_lat: 43.17,  approx_lon: -79.2,   approx_dist_to_westwood_km: 0 },
      { Base: 'St Paul',       Code: '72116', Weight: 8,  approx_lat: 43.111, approx_lon: -79.11,  approx_dist_to_westwood_km: 9.82 },
      { Base: 'Fort Erie',     Code: '72117', Weight: 10, approx_lat: 42.91,  approx_lon: -78.99,  approx_dist_to_westwood_km: 33.57 },
      { Base: 'Merritville',   Code: '72118', Weight: 8,  approx_lat: 43.06,  approx_lon: -79.23,  approx_dist_to_westwood_km: 12.47 },
      { Base: 'HQ',            Code: '72120', Weight: 5,  approx_lat: 43.168, approx_lon: -79.205, approx_dist_to_westwood_km: 0.46 },
      { Base: 'Fitch St',      Code: '72121', Weight: 3,  approx_lat: 42.998, approx_lon: -79.262, approx_dist_to_westwood_km: 19.78 },
      { Base: 'Westwood',      Code: '72122', Weight: 5,  approx_lat: 43.17,  approx_lon: -79.2,   approx_dist_to_westwood_km: 0 },
      { Base: 'Fleet',         Code: '72123', Weight: 5,  approx_lat: 43.17,  approx_lon: -79.2,   approx_dist_to_westwood_km: 0 },
      { Base: 'Fallsview',     Code: '72124', Weight: 2,  approx_lat: 43.082, approx_lon: -79.08,  approx_dist_to_westwood_km: 13.81 }
    ],
    units: [{ Units: '2100' }, { Units: '2101' }, { Units: '2102' }, { Units: 'FIT' }, { Units: 'CARE1' }],
    courses: [{ CourseId: 'central-5', Name: 'Niagara Central 5', Type: 'loop', Laps: '3',
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

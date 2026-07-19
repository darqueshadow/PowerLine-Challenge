/* ============================================================================
 * PITSTOP (NEMS 500) — core/basegeo.js
 * PowerLine Challenge · BaseGeo reference data + projection + distance
 * ----------------------------------------------------------------------------
 * Implements the Geography/Course/Tire spec §2 (BaseGeo), §2.3 (validation) and
 * §3 (projection + distance). Steps 1–2 of the §10 build order.
 *
 * GOVERNANCE (spec §L1): BaseGeo is SHARED REFERENCE DATA — physical facts about
 * real bases. No theme content, no racing vocabulary, no gameplay logic lives in
 * this file. The Course entity (Pitstop-local, §L2) is core/course.js.
 *
 * SOURCE OF TRUTH (Andrew, 2026-07-18 — SUPERSEDES spec §2.1): `baselatlon.csv`
 * is the authority. The .xlsx workbook is now a DOWNSTREAM COPY, not the source.
 *
 *   Spec §2.1 had this the other way round (Excel authoritative, CSV a build
 *   artifact). That inversion is what broke the course join: the workbooks drifted
 *   from the CSVs — BaseLatLon.xlsx still holds `WF_CRU`/`Wainfleete` where the CSV
 *   has `WF-CRU`/`Wainfleet`, and Courses.xlsx still has the `CouseID` header typo.
 *   Re-exporting CSV from those workbooks reintroduces every defect. If the two
 *   disagree, the CSV wins; regenerate the workbook from it, never the reverse.
 *
 * This module NEVER repairs the CSV. On any validation failure we REJECT the whole
 * dataset and surface the error (spec §2.3): not repair, not warn-and-continue.
 *
 *   ⚠ The validator deliberately reads RAW cells — untrimmed, signs intact. If
 *   you "helpfully" trim base_name or Math.abs() the longitude anywhere above
 *   validate(), V5 and V1 can never fail and the defects they exist to catch go
 *   silent. Parse raw, validate, THEN use. Order matters.
 * ========================================================================= */

(function (global) {
  'use strict';

  const CFG = (global.PITSTOP_CONFIG || {});
  const GEO = (CFG.GEO || {});

  // Spec §2.3 V1 — a sign error parses cleanly, projects cleanly, and is
  // silently wrong. These bounds are the only thing that catches it.
  const BOUNDS = GEO.bounds || { latMin: 42.8, latMax: 43.4, lonMin: -79.7, lonMax: -78.8 };
  // Spec §2.3 V6 — see config.js GEO.excludedCode for why (the spec's own L4
  // rationale for this rule is factually wrong; the rule stands on geometry).
  const EXCLUDED_CODE = GEO.excludedCode || '72122';
  const COORD_TOLERANCE = 1e-6;             // spec §2.3 V3

  const EARTH_R_KM = 6371.0088;             // spec §3

  /* ---- Raw CSV parse — preserves whitespace so V5 can see it --------------
   * core/data.js parseCSV() trims every cell, which would mask defect D3
   * (`Linwell ` with a trailing space). This parser does not trim. */
  function parseRawCSV(text) {
    if (!text) return [];
    text = text.replace(/^﻿/, '');
    const lines = text.split(/\r?\n/).filter(l => l.trim().length);
    if (!lines.length) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(function (line) {
      const cells = line.split(',');
      const row = {};
      headers.forEach((h, j) => { row[h] = cells[j] != null ? cells[j] : ''; });
      return row;
    });
  }

  /* ---- Validation (spec §2.3) --------------------------------------------
   * Returns an array of human-readable error strings. Empty array = the dataset
   * is loadable. Every rule reports EVERY offending row rather than bailing on
   * the first, so one run gives Andrew the complete Excel repair list. */
  function validate(rawRows, dataSheetByCode) {
    const errors = [];
    const seenCodes = {};

    rawRows.forEach(function (r, i) {
      const line = i + 2;                                  // +1 header, +1 to 1-index
      const rawCode = r.bse_code != null ? r.bse_code : '';
      const rawName = r.base_name != null ? r.base_name : '';
      const code = String(rawCode).trim();
      const lat = parseFloat(r.lat);
      const lon = parseFloat(r.lon);

      if (!code) { errors.push('line ' + line + ': missing bse_code'); return; }

      // V6 — 72122/Westwood must not be in BaseGeo. It is a real base, but it
      // shares coordinates with 72115/Glendale, so it cannot be a distinct
      // course node. See config.js GEO.excludedCode.
      if (code === EXCLUDED_CODE) {
        errors.push('V6 line ' + line + ': ' + code + ' (Westwood) must not appear in BaseGeo — ' +
                    'it shares a location with 72115 (Glendale), so it cannot be a distinct ' +
                    'course node. Delete the row in Excel.');
      }

      // V2 — duplicate primary key.
      if (seenCodes[code]) {
        errors.push('V2 line ' + line + ': duplicate bse_code ' + code +
                    ' (first seen line ' + seenCodes[code] + ')');
      } else {
        seenCodes[code] = line;
      }

      // V5 — whitespace in base_name (defect D3). Checked on the RAW cell.
      if (rawName !== String(rawName).trim()) {
        errors.push('V5 line ' + line + ': base_name ' + JSON.stringify(rawName) +
                    ' has leading/trailing whitespace — trim at source in Excel.');
      }

      // V1 — bounds. Catches defect D1 (unsigned longitude → Kazakhstan).
      if (!isFinite(lat) || !isFinite(lon)) {
        errors.push('V1 line ' + line + ' (' + code + '): lat/lon not numeric ' +
                    '(' + JSON.stringify(r.lat) + ', ' + JSON.stringify(r.lon) + ')');
      } else {
        if (lat < BOUNDS.latMin || lat > BOUNDS.latMax) {
          errors.push('V1 line ' + line + ' (' + code + '): lat ' + lat + ' outside [' +
                      BOUNDS.latMin + ', ' + BOUNDS.latMax + '] — sign or typo error.');
        }
        if (lon < BOUNDS.lonMin || lon > BOUNDS.lonMax) {
          errors.push('V1 line ' + line + ' (' + code + '): lon ' + lon + ' outside [' +
                      BOUNDS.lonMin + ', ' + BOUNDS.lonMax + '] — sign or typo error' +
                      (lon > 0 ? ' (positive longitude resolves to Kazakhstan — defect D1).' : '.'));
        }
      }

      // V4 — must resolve against the Data Sheet (bases.csv), by code AND name.
      if (dataSheetByCode) {
        const sheetName = dataSheetByCode[code];
        if (sheetName === undefined) {
          errors.push('V4 line ' + line + ': bse_code ' + code + ' does not resolve ' +
                      'against the Data Sheet (datasets/bases.csv).');
        } else if (sheetName !== String(rawName).trim()) {
          errors.push('V4 line ' + line + ' (' + code + '): base_name ' +
                      JSON.stringify(String(rawName).trim()) + ' does not match the Data Sheet ' +
                      JSON.stringify(sheetName) + ' — the name join will fail.');
        }
      }
    });

    // V3 — no two bases at identical coordinates (spec tolerance ~1e-6).
    for (let i = 0; i < rawRows.length; i++) {
      for (let j = i + 1; j < rawRows.length; j++) {
        const a = rawRows[i], b = rawRows[j];
        const aLat = parseFloat(a.lat), aLon = parseFloat(a.lon);
        const bLat = parseFloat(b.lat), bLon = parseFloat(b.lon);
        if (!isFinite(aLat) || !isFinite(aLon) || !isFinite(bLat) || !isFinite(bLon)) continue;
        if (Math.abs(aLat - bLat) < COORD_TOLERANCE && Math.abs(aLon - bLon) < COORD_TOLERANCE) {
          errors.push('V3: ' + String(a.bse_code).trim() + ' and ' + String(b.bse_code).trim() +
                      ' share identical coordinates (' + aLat + ', ' + aLon + ') — ' +
                      'two nodes would render on top of each other.');
        }
      }
    }

    return errors;
  }

  /* ---- Record build — only ever runs on a dataset that passed validate() --- */
  function buildRecords(rawRows) {
    return rawRows.map(function (r) {
      return {
        code: String(r.bse_code).trim(),
        name: String(r.base_name).trim(),
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
        xy: null                                  // set by project(); never authored (spec §4.2)
      };
    });
  }

  /* ---- Distance (spec §3) — great-circle haversine, straight-line only.
   * No road routing, no elevation. R = 6371.0088 km. */
  function haversineKm(a, b) {
    const rad = d => d * Math.PI / 180;
    const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * EARTH_R_KM * Math.asin(Math.sqrt(h));
  }

  /* ---- Projection (spec §3) — equirectangular, scaled for latitude:
   *     x ∝ (lon − lon_ref) × cos(lat_ref)
   *     y ∝ (lat − lat_ref)
   * lat_ref = dataset mean latitude (≈43.07). At Niagara's ~55 km extent the
   * distortion is well under one rendered pixel — do not introduce a heavier
   * projection. Output is a SCHEMATIC (transit-map styled), not a map: no tiles,
   * no third-party imagery, ever (spec §3).
   *
   * Aspect-preserving and centred in `view`, y flipped so north is up. Writes
   * b.xy. There is NO duplicate-node nudge here: identical coordinates are a
   * DATA defect that V3 rejects, and nudging would hide it (spec §2.3). */
  function project(bases, view) {
    const v = view || { w: 100, h: 80, pad: 9 };
    const pts = bases.filter(b => isFinite(b.lat) && isFinite(b.lon));
    if (!pts.length) return bases;

    const latRef = pts.reduce((s, b) => s + b.lat, 0) / pts.length;
    const lonRef = pts.reduce((s, b) => s + b.lon, 0) / pts.length;
    const k = Math.cos(latRef * Math.PI / 180);

    const px = b => (b.lon - lonRef) * k;
    const py = b => (b.lat - latRef);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach(function (b) {
      minX = Math.min(minX, px(b)); maxX = Math.max(maxX, px(b));
      minY = Math.min(minY, py(b)); maxY = Math.max(maxY, py(b));
    });
    const spanX = (maxX - minX) || 1, spanY = (maxY - minY) || 1;
    const availW = v.w - 2 * v.pad, availH = v.h - 2 * v.pad;
    const scale = Math.min(availW / spanX, availH / spanY);   // uniform → aspect preserved
    const offX = v.pad + (availW - spanX * scale) / 2;
    const offY = v.pad + (availH - spanY * scale) / 2;

    pts.forEach(function (b) {
      b.xy = {
        x: Math.round((offX + (px(b) - minX) * scale) * 100) / 100,
        y: Math.round((offY + (maxY - py(b)) * scale) * 100) / 100   // flip: north = top
      };
    });
    return bases;
  }

  /* ---- Dataset stats — for verifying a load against spec §2.4 -------------
   * §2.4 is VERIFICATION ONLY and is NOT a data source: nothing here feeds
   * gameplay. See PITSTOP_GEOGRAPHY_FINDINGS.md — the spec's quoted median of
   * 21.1 km is computed with 72122 still in the set; the correct 17-base figure
   * is 21.3 km. Do not hardcode either: compute and compare. */
  function stats(bases) {
    const pts = bases.filter(b => isFinite(b.lat) && isFinite(b.lon));
    if (pts.length < 2) return null;
    const ds = [];
    let furthest = null;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = haversineKm(pts[i], pts[j]);
        ds.push(d);
        if (!furthest || d > furthest.km) furthest = { km: d, a: pts[i], b: pts[j] };
      }
    }
    ds.sort((a, b) => a - b);
    const mid = ds.length % 2 ? ds[(ds.length - 1) / 2]
                              : (ds[ds.length / 2 - 1] + ds[ds.length / 2]) / 2;
    return {
      count: pts.length,
      latMin: Math.min.apply(null, pts.map(b => b.lat)),
      latMax: Math.max.apply(null, pts.map(b => b.lat)),
      lonMin: Math.min.apply(null, pts.map(b => b.lon)),
      lonMax: Math.max.apply(null, pts.map(b => b.lon)),
      medianPairwiseKm: mid,
      minPairwiseKm: ds[0],
      furthestPair: furthest
    };
  }

  /* ---- Data Sheet index (for V4) ------------------------------------------
   * bases.csv is the Data Sheet: "Challenge Base,Command Base,Weight" where
   * Challenge Base carries a " Base" suffix ("Ontario St Base") that BaseGeo's
   * base_name does not. Strip the suffix for the join — that is a Data Sheet
   * naming convention, not a repair of BaseGeo. */
  function indexDataSheet(rows) {
    const byCode = {};
    rows.forEach(function (r) {
      const code = String(r['Command Base'] || '').trim();
      const name = String(r['Challenge Base'] || '').trim().replace(/\s+Base$/i, '');
      if (code) byCode[code] = name;
    });
    return byCode;
  }

  /* ---- CSV text source ------------------------------------------------------
   * Baked text (datasets/embedded.js, via `node bake-data.mjs`) wins, so the
   * cartridge runs from a double-clicked index.html — file:// blocks fetch() of
   * local files. Anything not baked falls back to fetch, which succeeds only over
   * http://; that keeps the OPTIONAL Data Sheet (bases.csv) working as before.
   * Resolves null when neither source has the file. */
  function csvText(path) {
    const baked = (global.PITSTOP_CSV || {})[path];
    if (typeof baked === 'string') return Promise.resolve(baked);
    return fetch(path + '?t=' + Date.now())
      .then(r => (r.ok ? r.text() : null))
      .catch(() => null);
  }

  /* ---- Load (spec §2 + §2.3) ---------------------------------------------
   * Resolves { ok, bases, stats } on a clean dataset; resolves { ok:false,
   * errors } when validation rejects. Never throws for DATA reasons — the
   * caller decides how to surface a rejection. A rejected dataset yields NO
   * bases: there is no partial load. */
  function loadBaseGeo(opts) {
    opts = opts || {};
    // The geo file is the coordinate source of truth (bse_code,base_name,lat,lon).
    // Renamed to baselatlon.csv when the dataset was consolidated (2026-07-17).
    const geoFile = opts.geoFile || 'datasets/baselatlon.csv';
    const sheetFile = opts.sheetFile || 'datasets/bases.csv';

    return Promise.all([
      csvText(geoFile).then(t => {
        if (t == null) throw new Error('no baked or served copy of ' + geoFile);
        return t;
      }),
      // Data Sheet (bases.csv) is now an OPTIONAL cross-check — it was retired from
      // the consolidated dataset. When it's absent this resolves to null and V4
      // (code/name resolves against the sheet) is skipped rather than failing the
      // whole load; the geo file stands on its own as the authority.
      csvText(sheetFile)
    ]).then(function (texts) {
      const rawRows = parseRawCSV(texts[0]);
      const sheet = texts[1] != null ? indexDataSheet(parseRawCSV(texts[1])) : null;
      const errors = validate(rawRows, sheet);
      if (errors.length) return { ok: false, errors: errors, bases: [], stats: null };
      const bases = buildRecords(rawRows);
      project(bases, opts.view);
      return { ok: true, errors: [], bases: bases, stats: stats(bases) };
    });
  }

  global.PITSTOP_BASEGEO = {
    loadBaseGeo: loadBaseGeo,
    parseRawCSV: parseRawCSV,
    indexDataSheet: indexDataSheet,
    validate: validate,
    buildRecords: buildRecords,
    project: project,
    haversineKm: haversineKm,
    stats: stats,
    EARTH_R_KM: EARTH_R_KM,
    EXCLUDED_CODE: EXCLUDED_CODE
  };
})(window);

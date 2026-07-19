/* =============================================================================
 * Pitstop — core/region.js
 * MUNICIPALITY BACKDROP for the course map (Andrew, 2026-07-19)
 *
 * Replaces the old `.map-region` blob (a padded convex hull of whichever bases
 * the course happened to use), which read as a green smear rather than as
 * anywhere. The map now sits on a CARTOON PATCHWORK of Niagara's twelve lower-
 * tier municipalities, each in its own colour, so the region is recognisable
 * and the course is drawn ON a place instead of inside an outline.
 *
 * WHICH MUNICIPALITIES SHOW (Andrew's call): the ones the course actually
 * touches — EXCEPT the full race (the Grand Tour, CFG.FULL_COURSE_ID), which
 * shows the ENTIRE region, including municipalities it has no stop in. Wainfleet
 * is the reason that rule exists: only Erie Shore (NEMS-03) stops there, yet the
 * Grand Tour should still look like all of Niagara.
 *
 * ---------------------------------------------------------------------------
 * THE SHAPES ARE REAL. core/region-boundaries.js carries Niagara Region's
 * published municipal boundaries (Niagara Open Data, OGL 2.0), reprojected to
 * lat/lon and decimated for this scale. This module only colours them, decides
 * which ones to show, and hands the renderer lat/lon rings.
 *
 * It did NOT start there. The first cut derived the cells from base coordinates
 * — a Voronoi partition inside the convex hull of the roster — and Andrew called
 * it: the arrangement was roughly right but the AREAS were wrong, because
 * nearest-base cells can't know that Grimsby and St. Catharines are small and
 * dense while West Lincoln and Wainfleet are big rural townships. Don't
 * reintroduce a derived fallback; if the boundary module fails to load the
 * backdrop is simply skipped, which is the honest failure.
 *
 * Every one of the twelve municipalities holds at least one base, so the
 * patchwork is complete and the base→municipality map below has no gaps.
 * ========================================================================== */
(function (global) {
  'use strict';

  const CFG = (global.PITSTOP_CONFIG || {});

  /* Niagara Region's twelve lower-tier municipalities, each with the roster
   * bases that sit inside it.
   *
   * COLOURS COME FROM THE CAD (Andrew, 2026-07-19). He supplied a screenshot of
   * the dispatch map — assets/region_munis.png — so the training console shows
   * the same colour per municipality that medics see at work. That image was
   * georeferenced against the real boundaries and each municipality's fill read
   * off it directly (its own CAD hex is noted at the end of each line); nothing
   * here was picked by eye.
   *
   * The CAD hexes are near-white pastels meant for a white background, so they
   * are not used raw — they would blow out the dark phosphor field and bury the
   * route. Each one keeps its HUE exactly and is mapped into a dark band, with
   * the CAD's own tint strength preserved as the ordering: the more colour a
   * municipality carries in the CAD, the more saturated and darker it is here.
   * That matters because the CAD distinguishes several NEIGHBOURS by tint alone
   * within one hue family — Lincoln/West Lincoln (cyan), Pelham/Welland
   * (orange), Port Colborne/Fort Erie (magenta). Flattening lightness would
   * merge each of those pairs into one colour.
   *
   * Every adjacent pair is separated by at least dE 8.5 in CIELAB, checked
   * against real polygon adjacency (25 shared borders). If you retune, re-check
   * NEIGHBOURS specifically — two look-alike municipalities on opposite sides of
   * the region are harmless, two touching ones are not.
   *
   * Note the CAD screenshot also carries municipalities OUTSIDE Niagara
   * (Hamilton, Haldimand along the west edge). Andrew: do not draw those. They
   * are absent from this table and from the boundary data, so they can't leak in.
   *
   * Keep RED and YELLOW out of this table regardless of what the CAD does — the
   * route kerb (red/white) and the pit lane (yellow) own those, and a
   * municipality wearing either would fight the line you actually need to read.
   * The dark treatment is what keeps CAD-yellow Thorold and CAD-red NOTL clear
   * of the bright #e8352a kerb and #ffd400 pit lane. */
  const MUNICIPALITIES = [
    { id: 'grimsby',       name: 'Grimsby',               bases: ['72105'],                         fill: '#527a7a', stroke: '#253636' },   // CAD #edfafa
    { id: 'lincoln',       name: 'Lincoln',               bases: ['72110'],                         fill: '#205050', stroke: '#0f2323' },   // CAD #c1fafa
    { id: 'west-lincoln',  name: 'West Lincoln',          bases: ['72109'],                         fill: '#356367', stroke: '#182c2e' },   // CAD #d6f7fa
    { id: 'st-catharines', name: 'St. Catharines',        bases: ['72101', '72102', '72115'],       fill: '#6a6538', stroke: '#2f2d1a' },   // CAD #faf7d9
    { id: 'notl',          name: 'Niagara-on-the-Lake',   bases: ['72104'],                         fill: '#673535', stroke: '#2e1818' },   // CAD #fad6d6
    { id: 'thorold',       name: 'Thorold',               bases: ['72103', '72118'],                fill: '#413d16', stroke: '#1d1b0a' },   // CAD #faf3b5
    { id: 'niagara-falls', name: 'Niagara Falls',         bases: ['72100', '72116'],                fill: '#3a612f', stroke: '#1a2b16' },   // CAD #cceac3
    { id: 'pelham',        name: 'Pelham',                bases: ['72111'],                         fill: '#61452e', stroke: '#2b1f15' },   // CAD #fae3d0
    { id: 'welland',       name: 'Welland',               bases: ['72108', '72125'],                fill: '#4a311b', stroke: '#21160d' },   // CAD #fad9bc
    { id: 'wainfleet',     name: 'Wainfleet',             bases: ['WF-CRU'],                        fill: '#375624', stroke: '#192611' },   // CAD #cceab9
    { id: 'port-colborne', name: 'Port Colborne',         bases: ['72107'],                         fill: '#784d78', stroke: '#362336' },   // CAD #faeafa
    { id: 'fort-erie',     name: 'Fort Erie',             bases: ['72113', '72117'],                fill: '#6b396b', stroke: '#301a30' }    // CAD #fadafa
  ];

  /* Build the drawable cells from the baked boundary module. Returns
   * [{ id, name, fill, stroke, rings:[[{lat,lon},...], ...] }] — one ring per
   * outer polygon, so a municipality split across land masses (Niagara Falls
   * carries a second ring in the river) still draws whole.
   *
   * `baseById` is accepted but no longer read: the shapes are published data
   * now, not something derived from where the bases happen to sit. It stays in
   * the signature because the renderer passes it and a future caller may want
   * to filter by which municipalities actually hold a base.
   *
   * A municipality named in MUNICIPALITIES but absent from the boundary data is
   * dropped rather than approximated — see the header. */
  function buildCells(baseById) {                                  // eslint-disable-line no-unused-vars
    const SRC = global.PITSTOP_REGION_BOUNDARIES;
    if (!SRC || !SRC.length) return [];                            // module missing → no backdrop
    const byName = {};
    SRC.forEach(function (b) { byName[b.name] = b; });
    return MUNICIPALITIES.map(function (m) {
      const b = byName[m.name];
      if (!b || !b.rings || !b.rings.length) return null;
      return {
        id: m.id, name: m.name, fill: m.fill, stroke: m.stroke,
        rings: b.rings.map(function (ring) {
          return ring.map(function (p) { return { lat: p[0], lon: p[1] }; });
        })
      };
    }).filter(Boolean);
  }

  // Which municipality holds a given base — used to work out what a course touches.
  const OWNER = {};
  MUNICIPALITIES.forEach(function (m) {
    m.bases.forEach(function (id) { OWNER[id] = m.id; });
  });

  /* ---- Which municipalities a ROUTE PASSES THROUGH (Andrew, 2026-07-19) ------
   * "If a course crosses an adjacent muni, then show that muni too."
   *
   * Stopping somewhere is not the only way a course is *in* a place. A leg from
   * Grimsby to Smithville drives across West Lincoln whether or not it stops
   * there, and a backdrop that omits it draws the route running through empty
   * space — which is exactly what the patchwork exists to stop.
   *
   * The test is run against the STRAIGHT SEGMENT between two stops, which is
   * precisely what renderMap draws. That is deliberate: the lit municipalities
   * and the visible line then agree by construction. It is a schematic route,
   * not a road network, so "crosses" means "the drawn line passes over it".
   * ------------------------------------------------------------------------- */

  // Rings keyed by municipality id, built once from the boundary module.
  let RINGS = null;
  function ringsById() {
    if (RINGS) return RINGS;
    const SRC = global.PITSTOP_REGION_BOUNDARIES;
    if (!SRC || !SRC.length) return null;              // module missing → caller falls back to stops-only
    const byName = {};
    SRC.forEach(function (b) { byName[b.name] = b; });
    RINGS = {};
    MUNICIPALITIES.forEach(function (m) {
      const b = byName[m.name];
      if (b && b.rings && b.rings.length) RINGS[m.id] = b.rings;   // rings are [[lat,lon], ...]
    });
    return RINGS;
  }

  // Standard ray-cast point-in-polygon, in lat/lon. Ring points are [lat, lon],
  // so latitude is the "y" axis and longitude the "x".
  function pointInRing(lat, lon, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const yi = ring[i][0], xi = ring[i][1];
      const yj = ring[j][0], xj = ring[j][1];
      if ((yi > lat) !== (yj > lat) &&
          lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  // Sample spacing along a leg, in degrees (~0.004° ≈ 400 m here). Niagara's
  // municipalities are kilometres across, so this cannot step over one; the cap
  // keeps the longest Grand-Tour leg from turning into thousands of tests.
  const SAMPLE_DEG = 0.004, MAX_SAMPLES = 260;

  function markCrossed(a, b, rings, out) {
    const dLat = b.lat - a.lat, dLon = b.lon - a.lon;
    const steps = Math.max(8, Math.min(MAX_SAMPLES, Math.ceil(Math.hypot(dLat, dLon) / SAMPLE_DEG)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const lat = a.lat + dLat * t, lon = a.lon + dLon * t;
      for (const id in rings) {
        if (out[id]) continue;                          // already lit — nothing to learn
        const list = rings[id];
        for (let r = 0; r < list.length; r++) {
          if (pointInRing(lat, lon, list[r])) { out[id] = true; break; }
        }
      }
    }
  }

  /* The set of municipality ids a course should light up: the ones its stops sit
   * in, PLUS any it drives across between stops, or EVERY one when it is the full
   * race (CFG.FULL_COURSE_ID — the Grand Tour, which skips Wainfleet and Thorold
   * yet should still show all of Niagara). Returns a plain lookup { id: true }.
   *
   * `baseById` supplies the coordinates for the crossing test. It is OPTIONAL:
   * without it (or without the boundary module) this degrades to the original
   * stops-only behaviour rather than failing. */
  function municipalitiesFor(course, baseById) {
    const out = {};
    if (!course) return out;
    const fullId = CFG.FULL_COURSE_ID || 'NEMS-07';
    if (course.id === fullId) {
      MUNICIPALITIES.forEach(function (m) { out[m.id] = true; });
      return out;
    }
    const ids = course.baseIds || [];
    ids.forEach(function (id) { if (OWNER[id]) out[OWNER[id]] = true; });

    const rings = ringsById();
    if (!rings || !baseById) return out;                // no geometry → stops only

    // Walk the drive order, including the closing leg of a circuit — the route is
    // drawn closed there, so it can cross a municipality on the way home too.
    const pts = ids.map(function (id) {
      const b = baseById[id];
      return (b && b.lat != null && b.lon != null) ? { lat: b.lat, lon: b.lon } : null;
    });
    for (let i = 0; i < pts.length - 1; i++) {
      if (pts[i] && pts[i + 1]) markCrossed(pts[i], pts[i + 1], rings, out);
    }
    if (course.type === 'loop' && pts.length > 2 && pts[pts.length - 1] && pts[0]) {
      markCrossed(pts[pts.length - 1], pts[0], rings, out);
    }
    return out;
  }

  global.PITSTOP_REGION = {
    MUNICIPALITIES: MUNICIPALITIES,
    buildCells: buildCells,
    municipalitiesFor: municipalitiesFor,
    ownerOf: function (baseId) { return OWNER[baseId] || null; }
  };
})(window);

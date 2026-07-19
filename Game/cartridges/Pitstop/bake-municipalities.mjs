/* Bake Niagara Region's Municipal Boundaries GeoJSON into a compact JS module.
 *
 *   in   files/datasets/niagara_municipalities.geojson  (as published:
 *        NAD83 CSRS / UTM Zone 17N, ~36k vertices, ~900 KB)
 *   out  files/core/region-boundaries.js  (WGS84 lat/lon, decimated)
 *
 * Run from this folder:  node bake-municipalities.mjs [toleranceMetres]
 * Default tolerance is 150 m. Higher = chunkier and smaller; 400 m still reads
 * as Niagara, 120 m is about as fine as the grid map can show.
 *
 * Re-download the source from:
 *   https://niagaraopendata.ca/dataset/municipal-boundaries
 * Licence: Open Government Licence 2.0 (Niagara Region).
 *
 * The script prints a containment check — every base must land inside its own
 * municipality after reprojection. If any line reads FAIL, the projection is
 * wrong and the output must not be shipped.
 */
import fs from 'fs';

const TOLERANCE = Number(process.argv[2] || 150);   // metres, Douglas–Peucker
const OUT = 'files/core/region-boundaries.js';

/* ---- inverse UTM (GRS80) -> lat/lon ------------------------------------- */
const a = 6378137, f = 1 / 298.257222101;
const e2 = 2 * f - f * f, ep2 = e2 / (1 - e2), k0 = 0.9996, lon0 = -81 * Math.PI / 180;
const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));

function utmToLatLon(E, N) {
  const x = E - 500000, M = N / k0;
  const mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256));
  const p1 = mu
    + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
    + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
  const s = Math.sin(p1), c = Math.cos(p1), t = Math.tan(p1);
  const C1 = ep2 * c * c, T1 = t * t;
  const N1 = a / Math.sqrt(1 - e2 * s * s);
  const R1 = a * (1 - e2) / Math.pow(1 - e2 * s * s, 1.5);
  const D = x / (N1 * k0);
  const lat = p1 - (N1 * t / R1) * (D * D / 2
    - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6 / 720);
  const lon = lon0 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5 / 120) / c;
  return [lat * 180 / Math.PI, lon * 180 / Math.PI];
}

/* ---- Douglas–Peucker, run in UTM metres so the tolerance is real -------- */
function dp(pts, tol) {
  if (pts.length < 3) return pts;
  let maxD = -1, idx = 0;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    let d;
    if (len2 === 0) d = Math.hypot(px - ax, py - ay);
    else {
      let t = ((px - ax) * dx + (py - ay) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    }
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= tol) return [pts[0], pts[pts.length - 1]];
  return dp(pts.slice(0, idx + 1), tol).slice(0, -1).concat(dp(pts.slice(idx), tol));
}

// A closed ring can't be simplified as one open line (the endpoints are pinned
// together), so split it at its two most distant-in-index points and do halves.
function simplifyRing(ring, tol) {
  const r = ring.slice(0, -1);                       // drop the repeated closer
  if (r.length < 8) return ring;
  const h = Math.floor(r.length / 2);
  const out = dp(r.slice(0, h + 1), tol).slice(0, -1).concat(dp(r.slice(h).concat([r[0]]), tol));
  out.pop();
  return out;
}

/* ---- run --------------------------------------------------------------- */
const gj = JSON.parse(fs.readFileSync('files/datasets/niagara_municipalities.geojson', 'utf8'));
let before = 0, after = 0;

const out = gj.features.map(ft => {
  // outer rings only — holes are noise at this scale
  const polys = ft.geometry.type === 'Polygon' ? [ft.geometry.coordinates] : ft.geometry.coordinates;
  const rings = polys.map(p => p[0]).filter(Boolean);
  const kept = rings.map(r => {
    before += r.length;
    const s = simplifyRing(r, TOLERANCE);
    after += s.length;
    return s.map(([E, N]) => utmToLatLon(E, N).map(v => Math.round(v * 1e5) / 1e5));
  })
  // Drop slivers: tiny islands add points and read as dirt on a 180px minimap.
  .filter(r => r.length >= 4)
  .sort((x, y) => y.length - x.length);
  return { name: ft.properties.Name, rings: kept };
});

console.log(`tolerance ${TOLERANCE}m  |  ${before} -> ${after} vertices`);
out.forEach(m => console.log('  ' + m.name.padEnd(22) + m.rings.map(r => r.length).join('+')));

// sanity: every base must fall inside its municipality
const bases = { 'Grimsby': [43.186578, -79.513405], 'Niagara Falls': [43.112649, -79.088989],
  'Fort Erie': [42.921095, -78.939352], 'Wainfleet': [42.9221256, -79.375838],
  'West Lincoln': [43.099502, -79.547651], 'Port Colborne': [42.901783, -79.242849] };
const inRing = ([lat, lon], ring) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i], [yj, xj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
console.log('\ncontainment check:');
let ok = true;
Object.entries(bases).forEach(([muni, pt]) => {
  const m = out.find(o => o.name === muni);
  const hit = m && m.rings.some(r => inRing(pt, r));
  if (!hit) ok = false;
  console.log('  ' + muni.padEnd(16) + (hit ? 'OK' : 'FAIL'));
});
if (!ok) { console.error('\nABORTED — a base fell outside its municipality; the projection is wrong.'); process.exit(1); }

const header = `/* =============================================================================
 * Pitstop — core/region-boundaries.js   [GENERATED — do not hand-edit]
 *
 * The REAL municipal boundaries of Niagara Region, twelve lower-tier
 * municipalities, as [lat, lon] rings ready for the map projection.
 *
 * SOURCE   Municipal Boundaries — Niagara Open Data
 *          https://niagaraopendata.ca/dataset/municipal-boundaries
 * LICENCE  Open Government Licence 2.0 (Niagara Region). Contains information
 *          licensed under the Open Government Licence – Niagara Region.
 * VINTAGE  Boundaries revised Q4 2017 to match the legal descriptions in the
 *          Municipal Act, plus the Port Colborne shoreline change.
 *
 * PIPELINE the raw download sits at datasets/niagara_municipalities.geojson in
 *          its published projection (NAD83 CSRS / UTM Zone 17N). It was
 *          reprojected to WGS84 lat/lon and decimated with Douglas–Peucker at a
 *          ${TOLERANCE} m tolerance — ${before} vertices down to ${after} — which is all the
 *          detail a 180 px minimap can show, and gives the chunky edge a
 *          cartoon map wants. Interior holes and sub-4-point slivers are
 *          dropped. Every base was verified to fall inside its own
 *          municipality after reprojection.
 *
 *          Regenerate with:  node bake-municipalities.mjs [toleranceMetres]
 *          Do not edit the numbers below by hand.
 * ========================================================================== */
(function (global) {
  'use strict';
  global.PITSTOP_REGION_BOUNDARIES = [
`;
const body = out.map(m =>
  '    { name: ' + JSON.stringify(m.name) + ', rings: [' +
  m.rings.map(r => '\n      [' + r.map(p => '[' + p[0] + ',' + p[1] + ']').join(',') + ']').join(',') +
  '\n    ] }').join(',\n') + '\n  ];\n})(window);\n';

fs.writeFileSync(OUT, header + body);
console.log('\n' + OUT + '  ' + (fs.statSync(OUT).size / 1024).toFixed(1) + ' KB');

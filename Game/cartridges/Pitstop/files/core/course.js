/* ============================================================================
 * PITSTOP (NEMS 500) — core/course.js
 * PowerLine Challenge · Course entity + invariants
 * ----------------------------------------------------------------------------
 * Implements the Geography/Course/Tire spec §4. Step 3 of the §10 build order.
 *
 * GOVERNANCE (spec §L2): the Course entity is PITSTOP-LOCAL. Racing vocabulary
 * is permitted here and nowhere else in core/. Rally Race is cancelled, so no
 * cross-cartridge reuse case exists. Shared physical facts about bases live in
 * core/basegeo.js (§L1) — keep the boundary.
 *
 * THE CORE INVARIANT (spec §4.2) — AUTHORED vs DERIVED:
 *   AUTHORED (from datasets/courses.csv): CourseID, CourseName, Sequence, Laps,
 *     Closure.
 *   DERIVED (computed here at load, NEVER authored, NEVER persisted): Legs,
 *     LegDistance, TotalDistance, Tier, NodeXY, LapTime(v).
 *
 *   ⚠ Anything in the derived column that a human can hand-edit will decouple
 *   the difficulty axis from the map, SILENTLY. If a course "looks wrong", the
 *   fix is the coordinates or the sequence — never the rendered position. Do not
 *   add a NodeXY / TotalDistance column to courses.csv, and do not cache these
 *   to storage. Recompute from BaseGeo every load.
 *
 *   ⚠ Pit facility (spec §4.4) is NOT built here — it is blocked pending O3/O4
 *   (SWAP command + tire identifiers) and the §0.9 gate. The pit is 72123/Fleet
 *   (config PIT_BASE_ID), not the 72122 the spec's L4 asserts — Andrew,
 *   2026-07-16. See PITSTOP_GEOGRAPHY_FINDINGS.md.
 * ========================================================================= */

(function (global) {
  'use strict';

  const CFG = (global.PITSTOP_CONFIG || {});
  const GEO = (CFG.GEO || {});
  const BASEGEO = (global.PITSTOP_BASEGEO || {});

  const CLOSURE = { CIRCUIT: 'Circuit', POINT_TO_POINT: 'PointToPoint' };

  /* ---- Authored parse — the RETIRED wide courses.csv ----------------------
   * Columns: CourseID,CourseName,Sequence,Laps,Closure
   *   Sequence = pipe-separated bse_codes, in order.
   *   Closure  = Circuit | PointToPoint  (spec §4.1 enum)
   * Nothing derived is read from the CSV. If a derived column ever appears in
   * the file it is ignored on purpose — see the core-invariant note above.
   *
   *   ⚠ STALE SCHEMA — this reads the OLD wide format. The dataset was split in
   *   two on 2026-07-17: courses.csv is now CourseID,CourseName,Closure and the
   *   ordered stops live in coursestops.csv (CourseID,StopOrder,bse_code). There
   *   is no Sequence or Laps column any more, so pointing this at the current
   *   courses.csv yields sequence:[] and laps:NaN — silently, since validate()
   *   would then fire C4 rather than a schema error. Nothing calls PITSTOP_COURSE
   *   today (core/data.js joinCourses() does the join instead); before wiring this
   *   up, port it to the two-file schema. */
  function parseCourseRows(rows) {
    return rows.map(function (r) {
      const seq = String(r.Sequence || '').split(/[|;]/).map(s => s.trim()).filter(Boolean);
      const closureRaw = String(r.Closure || '').trim();
      return {
        courseId: String(r.CourseID || '').trim(),
        courseName: String(r.CourseName || '').trim(),
        sequence: seq,
        laps: parseInt(r.Laps, 10),
        closure: closureRaw === CLOSURE.CIRCUIT ? CLOSURE.CIRCUIT
               : closureRaw === CLOSURE.POINT_TO_POINT ? CLOSURE.POINT_TO_POINT
               : closureRaw            // kept as-authored so validate() can reject it by name
      };
    });
  }

  /* ---- Invariants (spec §4.3) --------------------------------------------
   * Returns an array of error strings; empty = valid. Like BaseGeo's validator
   * this reports every violation rather than bailing on the first. */
  function validateCourse(course, baseByCode) {
    const errors = [];
    const id = course.courseId || '(no CourseID)';
    const seq = course.sequence || [];

    if (!course.courseId) errors.push('course: missing CourseID');
    if (!(course.laps > 0)) errors.push(id + ': Laps must be a positive integer (got ' + course.laps + ')');

    // C2/C3/C4 all depend on knowing whether the course is meant to close, so an
    // unrecognised Closure makes them unanswerable rather than failing. Report
    // the enum and skip them — cascading guesses would bury the real error.
    const closureKnown = course.closure === CLOSURE.CIRCUIT || course.closure === CLOSURE.POINT_TO_POINT;
    if (!closureKnown) {
      errors.push(id + ': Closure must be "' + CLOSURE.CIRCUIT + '" or "' +
                  CLOSURE.POINT_TO_POINT + '" (got ' + JSON.stringify(course.closure) + ')');
    }

    // C1 — every bse_code in Sequence exists in BaseGeo.
    seq.forEach(function (code) {
      if (!baseByCode[code]) {
        errors.push('C1 ' + id + ': base ' + code + ' is not in BaseGeo');
      }
    });

    // C6 — 72122/Westwood must never be a course node (it sits on top of
    // 72115/Glendale). Note this is NOT the pit: the pit is 72123/Fleet
    // (config PIT_BASE_ID), which is track furniture and has no BaseGeo entry at
    // all, so it can never reach a Sequence in the first place.
    const excluded = BASEGEO.EXCLUDED_CODE || '72122';
    if (seq.indexOf(excluded) !== -1) {
      errors.push('C6 ' + id + ': ' + excluded + ' (Westwood) must not appear in Sequence — ' +
                  'it shares a location with 72115 (Glendale)');
    }

    // C2 — a Circuit closes on itself.
    const closes = course.closure === CLOSURE.CIRCUIT && seq.length > 1 &&
                   seq[0] === seq[seq.length - 1];
    if (course.closure === CLOSURE.CIRCUIT && seq.length && !closes) {
      errors.push('C2 ' + id + ': Circuit must close — Sequence[0] (' + seq[0] +
                  ') !== Sequence[-1] (' + seq[seq.length - 1] + ')');
    }

    if (closureKnown) {
      // C3 — no repeated base within one lap, except a Circuit's closing element.
      // Drop the closing element only when it ACTUALLY closes: slicing it off an
      // unclosed Circuit would under-count and fire a bogus C4 on top of the C2.
      const body = closes ? seq.slice(0, -1) : seq.slice();
      const seen = {};
      body.forEach(function (code) {
        if (seen[code]) errors.push('C3 ' + id + ': base ' + code + ' repeats within a lap');
        seen[code] = true;
      });

      // C4 — at least 3 distinct bases.
      const distinct = Object.keys(seen).length;
      if (distinct < 3) errors.push('C4 ' + id + ': needs >= 3 distinct bases (got ' + distinct + ')');
    }

    // C5 — every leg clears minLegDistanceKm, or two nodes render on top of each
    // other. The threshold is config (spec §4.3/§7), never a constant here.
    const minLeg = GEO.minLegDistanceKm;
    if (minLeg != null && BASEGEO.haversineKm) {
      legsOf(seq).forEach(function (leg) {
        const a = baseByCode[leg[0]], b = baseByCode[leg[1]];
        if (!a || !b) return;                      // already reported by C1
        const d = BASEGEO.haversineKm(a, b);
        if (d < minLeg) {
          errors.push('C5 ' + id + ': leg ' + leg[0] + '→' + leg[1] + ' is ' +
                      d.toFixed(2) + ' km, under minLegDistanceKm (' + minLeg + ')');
        }
      });
    }

    return errors;
  }

  function legsOf(seq) {
    const out = [];
    for (let i = 0; i < seq.length - 1; i++) out.push([seq[i], seq[i + 1]]);
    return out;
  }

  /* ---- Derived fields (spec §4.2) — computed at load, never persisted ------ */
  function derive(course, baseByCode) {
    const seq = course.sequence;
    const legs = legsOf(seq).map(function (leg) {
      const a = baseByCode[leg[0]], b = baseByCode[leg[1]];
      return {
        fromCode: leg[0],
        toCode: leg[1],
        distanceKm: (a && b) ? BASEGEO.haversineKm(a, b) : null   // LegDistance
      };
    });

    const lapKm = legs.reduce((s, l) => s + (l.distanceKm || 0), 0);
    const totalDistanceKm = lapKm * course.laps;                  // TotalDistance

    // NodeXY — projected canvas coords, read straight off BaseGeo. Derived from
    // the coordinates; never hand-edited (see the core-invariant note).
    const nodeXY = {};
    seq.forEach(function (code) {
      const b = baseByCode[code];
      if (b && b.xy) nodeXY[code] = b.xy;
    });

    return {
      courseId: course.courseId,
      courseName: course.courseName,
      sequence: seq.slice(),
      laps: course.laps,
      closure: course.closure,

      // ---- derived ----
      legs: legs,
      lapDistanceKm: lapKm,
      totalDistanceKm: totalDistanceKm,
      tier: tierFor(totalDistanceKm),
      nodeXY: nodeXY,
      // LapTime(v): TotalDistance / Laps / v — km / (km/h) = hours; ×3600 = sec.
      // This is GAME time. The real-seconds conversion needs the §6 compression
      // factor S, which is BLOCKED on O2 (target round length) — not applied here.
      lapTimeSec: function (kph) {
        if (!(kph > 0)) return Infinity;
        return (totalDistanceKm / course.laps) / kph * 3600;
      }
    };
  }

  /* ---- Tier (spec §4.2) — banded from TotalDistance -----------------------
   * ⚠ BLOCKED on O6: the distance bands are Andrew's to set and are NOT ours to
   * default (spec §11). Until GEO.tierBands is authored this returns null and
   * nothing downstream may branch on tier. Bands, when they land, are expected
   * as [{ tier: 'x', maxKm: n }, ...] ordered ascending, last entry maxKm null. */
  function tierFor(totalKm) {
    const bands = GEO.tierBands;
    if (!bands || !bands.length) return null;
    for (let i = 0; i < bands.length; i++) {
      if (bands[i].maxKm == null || totalKm <= bands[i].maxKm) return bands[i].tier;
    }
    return null;
  }

  /* ---- Build (spec §4) ----------------------------------------------------
   * Takes authored rows + validated BaseGeo records. Returns
   * { ok, courses, errors }. A course that violates an invariant is REJECTED,
   * not repaired — same posture as BaseGeo (spec §2.3). */
  function buildCourses(authoredRows, bases) {
    const baseByCode = {};
    (bases || []).forEach(b => { baseByCode[b.code] = b; });

    const errors = [];
    const courses = [];
    const seenIds = {};

    authoredRows.forEach(function (c) {
      if (c.courseId && seenIds[c.courseId]) {
        errors.push(c.courseId + ': duplicate CourseID — CourseIDs are stable keys, ' +
                    'never reused (spec §4.1)');
        return;
      }
      if (c.courseId) seenIds[c.courseId] = true;

      const errs = validateCourse(c, baseByCode);
      if (errs.length) { errors.push.apply(errors, errs); return; }
      courses.push(derive(c, baseByCode));
    });

    return { ok: errors.length === 0, courses: courses, errors: errors };
  }

  global.PITSTOP_COURSE = {
    CLOSURE: CLOSURE,
    parseCourseRows: parseCourseRows,
    validateCourse: validateCourse,
    buildCourses: buildCourses,
    derive: derive,
    tierFor: tierFor,
    legsOf: legsOf
  };
})(window);

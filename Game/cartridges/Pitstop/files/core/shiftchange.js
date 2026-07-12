/* ============================================================================
 * PITSTOP (NEMS 500) — core/shiftchange.js
 * PowerLine Challenge cartridge · Phase 1 · Shift Change · v0.3.0
 * ----------------------------------------------------------------------------
 * PURE, DECOUPLED ENGINE for the Shift Change overlay
 * (design: NEMS500_ShiftChange_DesignNote.md). NO DOM, NO rendering, NO race
 * coupling — script.js owns the overlay + wiring and calls into here.
 *
 * A "box" = one shift-change event: a list of units, each sitting in EOS (24h)
 * or SP (12h) status, that the player clears by typing their command chain
 * ("<CODE> <UNIT>", e.g. "RCAV 2101" / "CAV SS 2101" / "NOTE 2101"). A scaled
 * sim wall-clock ticks toward each unit's roster deadline.
 *
 * Deliberately kept as a self-contained module so it is STRIPPABLE and so the
 * (not-yet-built) multi-leg loop can reuse the same opener for the real
 * one-leg-early telegraph — this single-leg build wires it via LA-after-ENP.
 *
 *   ⚠ OPEN (design note §6): a passed deadline is a SOFT flag (unit.late) only,
 *   never a hard fail and not wired to any penalty — the miss-consequence model
 *   (own damage track vs tires) is Andrew's call and not yet decided. Strict
 *   step order is enforced; the "CAV-before-BSEH" fixable-but-punishing nuance
 *   waits until out-of-order entry is allowed.
 * ========================================================================= */

(function (global) {
  'use strict';

  function CFG() { return (global.PITSTOP_CONFIG && global.PITSTOP_CONFIG.SHIFT_CHANGE) || {}; }

  /* ---- Time helpers ------------------------------------------------------- */
  // 'HHMM' (e.g. '0530') -> seconds since midnight.
  function parseSlotTime(hhmm) {
    const s = String(hhmm || '').trim();
    const h = parseInt(s.slice(0, 2), 10) || 0;
    const m = parseInt(s.slice(2, 4), 10) || 0;
    return h * 3600 + m * 60;
  }
  // seconds since midnight -> 'HH:MM:SS' (wraps at 24h).
  function formatClock(sec) {
    let s = Math.floor(((sec % 86400) + 86400) % 86400);
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60);   s -= m * 60;
    const p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(h) + ':' + p(m) + ':' + p(s);
  }

  /* ---- Schedule lookup ---------------------------------------------------- */
  function schedule() { return CFG().schedule || []; }
  function findSlot(time) {
    if (time && typeof time === 'object') return time;           // already a slot
    return schedule().find(function (s) { return s.time === String(time); }) || null;
  }
  function slotIndex(time) {
    return schedule().findIndex(function (s) { return s.time === String(time); });
  }
  // The "game jumps to the next slot as changes fire" rule: advance by index,
  // wrapping around the schedule. Returns the next slot object.
  function nextSlot(time) {
    const sch = schedule();
    if (!sch.length) return null;
    const i = slotIndex(time);
    return sch[(i + 1 + sch.length) % sch.length];
  }

  /* ---- Chain helpers ------------------------------------------------------ */
  function chainFor(kind) {
    const c = (CFG().chains || {})[kind];
    return Array.isArray(c) ? c.slice() : [];
  }
  // NOTE is legal once the `noteAfter` step (default SS) has been completed.
  function noteAllowed(unit) {
    const after = CFG().noteAfter || 'SS';
    const k = unit.steps.findIndex(function (st) { return st.code === after; });
    if (k < 0) return unit.stepIndex > 0;         // no such step -> allow after 1st
    return unit.stepIndex > k;                     // that step is done
  }
  // Next command code the unit is waiting on (null when the chain is complete).
  function expectedFor(unit) {
    const st = unit.steps[unit.stepIndex];
    return st ? st.code : null;
  }

  /* ---- Box construction --------------------------------------------------- */
  // slotOrTime: a slot object or an 'HHMM' string. unitPool: array of unit id
  // strings. excludeIds: ids to keep OUT of the box (e.g. the race unit).
  function buildShiftBox(slotOrTime, unitPool, excludeIds) {
    const slot = findSlot(slotOrTime);
    if (!slot) return null;
    const cfg = CFG();
    const exclude = {};
    (excludeIds || []).forEach(function (id) { exclude[String(id)] = true; });

    const pool = (unitPool || []).map(String).filter(function (id) { return id && !exclude[id]; });
    const want = Math.max(1, slot.units || 1);
    const picks = [];
    const bag = pool.slice();
    while (picks.length < want && bag.length) {
      picks.push(bag.splice(Math.floor(Math.random() * bag.length), 1)[0]);
    }
    if (!picks.length) picks.push('2101');        // never render an empty box

    const startSim = parseSlotTime(slot.time);
    const base = cfg.unitDeadlineBase != null ? cfg.unitDeadlineBase : 120;
    const stagger = cfg.unitDeadlineStagger != null ? cfg.unitDeadlineStagger : 60;
    const startStatus = (cfg.startStatus || {})[slot.kind] || 'EOS';

    const units = picks.map(function (id, i) {
      return {
        id: id,
        kind: slot.kind,
        status: startStatus,                       // 'EOS' | 'SP' (display), -> 'working' -> 'done'
        steps: chainFor(slot.kind).map(function (code) { return { code: code, done: false }; }),
        stepIndex: 0,
        noteDone: false,
        deadlineSim: startSim + base + i * stagger,
        late: false
      };
    });

    return {
      slot: slot,
      clockScale: cfg.clockScale != null ? cfg.clockScale : 18,
      startSim: startSim,
      sim: startSim,
      units: units,
      done: false,
      lateCount: 0
    };
  }

  /* ---- Command validation ------------------------------------------------- */
  function normTokens(s) {
    return String(s || '').toUpperCase().replace(/,/g, ' ')
      .split(/\s+/).filter(function (t) { return t && t !== 'TO' && t !== 'AT' && t !== 'THE'; });
  }
  // Parse "<CODE...> <UNIT>" against a box. The unit is whichever token matches a
  // unit id in the box; the CODE is the remaining tokens joined (order-forgiving).
  // Returns { result, unit, code } where result is one of:
  //   'advance' | 'complete' | 'note' | 'wrong' | 'already-done' | 'unknown' | 'empty'
  function validateShiftCommand(input, box) {
    if (!box) return { result: 'empty' };
    const toks = normTokens(input);
    if (!toks.length) return { result: 'empty' };

    const byId = {}; box.units.forEach(function (u) { byId[u.id.toUpperCase()] = u; });
    let unitTok = null;
    for (let i = toks.length - 1; i >= 0; i--) { if (byId[toks[i]]) { unitTok = toks[i]; break; } }
    if (!unitTok) return { result: 'unknown', code: toks.join(' ') };

    const unit = byId[unitTok];
    const code = toks.filter(function (t) { return t !== unitTok; }).join(' ');
    if (!code) return { result: 'unknown', unit: unit };

    if (unit.status === 'done') return { result: 'already-done', unit: unit, code: code };

    if (code === 'NOTE') {
      if (unit.noteDone) return { result: 'wrong', unit: unit, code: code, why: 'note-already' };
      if (!noteAllowed(unit)) return { result: 'wrong', unit: unit, code: code, why: 'note-early' };
      unit.noteDone = true;
      return { result: 'note', unit: unit, code: code };
    }

    const expected = expectedFor(unit);
    if (code !== expected) {
      return { result: 'wrong', unit: unit, code: code, expected: expected, why: 'order' };
    }
    // Correct next step — advance.
    unit.steps[unit.stepIndex].done = true;
    unit.stepIndex += 1;
    unit.status = 'working';
    if (unit.stepIndex >= unit.steps.length) {
      unit.status = 'done';
      recomputeDone(box);
      return { result: 'complete', unit: unit, code: code };
    }
    return { result: 'advance', unit: unit, code: code };
  }

  /* ---- Clock / state ------------------------------------------------------ */
  // Advance the sim clock by realDt seconds. Flags any past-deadline unit as
  // late (SOFT — the unit is still completable; no penalty is applied here).
  function tickClock(box, realDt) {
    if (!box || box.done) return box;
    box.sim += Math.max(0, realDt || 0) * (box.clockScale || 18);
    box.units.forEach(function (u) {
      if (u.status !== 'done' && !u.late && box.sim >= u.deadlineSim) {
        u.late = true; box.lateCount += 1;
      }
    });
    return box;
  }
  function recomputeDone(box) {
    box.done = box.units.every(function (u) { return u.status === 'done'; });
    return box.done;
  }
  function allDone(box) { return !!(box && box.units.every(function (u) { return u.status === 'done'; })); }

  global.PITSTOP_SHIFT = {
    parseSlotTime: parseSlotTime,
    formatClock: formatClock,
    findSlot: findSlot,
    nextSlot: nextSlot,
    buildShiftBox: buildShiftBox,
    validateShiftCommand: validateShiftCommand,
    tickClock: tickClock,
    noteAllowed: noteAllowed,
    expectedFor: expectedFor,
    allDone: allDone
  };
})(window);

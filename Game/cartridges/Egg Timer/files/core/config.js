/* ===========================================================================
   EGG TIMER — CONFIG
   Every number here comes from EGG_TIMER_CONTEXT_PACKET.md (merged through the
   Addendum's eighth draft and the Draft 9 rulings). The section each one comes
   from is noted beside it.
   🚫 Never invent a CAV timing or type code here: durations and codes live in
   datasets/cav_types.csv, which is Andrew's table.

   ⏳ PENDING values are marked. They are unsettled design questions, built as
   one switch each so a ruling from Chat is a one-line change. They are not
   decisions, and must not be copied into the packet as if they were.
   ========================================================================= */
(function (root) {
  var ET = (root.ET = root.ET || {});

  ET.CONFIG = {
    // ── Time (packet §3, §7) ─────────────────────────────────────────────────
    timeScale: 2,            // game-seconds per real minute. Exact, never jittered.
    overtimeBase: 5,         // game-seconds after the bold trigger, before jitter
    jitterStart: 0.10,       // ±10% in wave 1
    jitterPerWave: 0.05,     // +5% per wave
    jitterCap: 0.35,         // capped at ±35%

    // ── Nests and waves (packet §4) ──────────────────────────────────────────
    nestsStart: 5,
    nestsEveryWaves: 2,      // +1 nest every 2 waves
    nestsCap: 12,
    quotaStart: 8,
    quotaPerWave: 2,
    spawnGapStart: [5, 7],   // random range, wave 1 (seconds)
    spawnGapShrink: 0.5,     // both ends, per wave
    spawnGapFloor: 1,
    cleanupStart: [5, 10],   // between-wave cleanup window (seconds)
    cleanupShrink: 0.5,
    cleanupFloor: 3,

    // ── Placement (packet §6) ────────────────────────────────────────────────
    placementTimeoutStart: 20, // an ignored trigger auto-opens after this…
    placementTimeoutShrink: 1, // …minus 1 s per wave…
    placementTimeoutFloor: 8,  // …floored at 8 s

    // ── Follow Progression (packet §5) ───────────────────────────────────────
    progressionOnePhaseWaves: 2, // waves 1–2 are pure one-phase
    progressionChanceStep: 0.10, // 0% at wave 3, +10% per wave

    // ── Pool (packet §9) ─────────────────────────────────────────────────────
    poolKey: "POOL",         // placeholder key; no display name until Andrew's roundtable
    poolStart: 3,
    poolCap: 3,

    // ── Scoring (packet §10) ─────────────────────────────────────────────────
    clearPointsMax: 100,     // cleared right as it goes bold…
    clearPointsMin: 25,      // …decaying linearly to this at the hatch
    placementPoints: 10,
    perfectWavePerWave: 50,  // 50 × wave number

    // ── Command Boxes (packet §12) ───────────────────────────────────────────
    boxesMin: 1,
    boxesMax: 4,

    // ── Presentation (not rules; placeholders until art direction) ──────────
    eggMinScale: 0.35,       // egg size when a CAV starts; grows to 1.0 at the trigger
    splatSeconds: 1.1,       // how long a smooshed nest stays busy before idling
    escapeSeconds: 1.4,      // how long an escape flourish keeps the nest busy
    messBlobsOwn: 5,         // gunk added to the smooshed nest (item 9: look, still open)
    messBlobsNeighbor: 2,    // gunk added to each direct neighbour
    wipeRadius: 22,          // px, click-and-drag eraser

    // ── Build questions, ruled 2026-09-17 (Draft 9, packet §11) ─────────────
    // The other value of each switch still works, but it isn't the design.
    // D2: a new unit per CAV, never one already showing on the board.
    unitAssignment: "per-spawn",   // "per-spawn" | "per-nest"
    // D5: the timer counts up (C12) in game seconds: VS goes bold at 00:20.
    timerDisplay: "game",          // "game" = game seconds | "real" = real-time mm:ss (10:00 at VS's bold)
    // C15(b): VF hides only its timer until "Clear Fuel"; the unit and "VF" stay.
    vfHides: "timer",              // "timer" | "readout"
    // D4: a wave stops spawning once its quota has spawned.
    // (false keeps spawning, but what happens to CAVs left running at the wave's end was never designed.)
    stopSpawningAtQuota: true,
    // D6: a rejected Enter leaves the text in the box (F12 clears it).
    keepTextOnReject: true,

    // ── Developer Mode (Laws: Ctrl+Shift+B → timed password prompt) ─────────
    // ⏳ PENDING (D3): Andrew's phrase for this cartridge. Null denies every entry.
    devModePasswordHash: null,
    devModeTimeout: 10000
  };

  /* Dev-gate digest. The same salted, iterated FNV-1a the other cartridges use,
     so a phrase hashed in either console matches here.
     ⚠️ Obfuscation, not security: it only keeps the phrase out of cleartext in a
     file served to the public web. */
  ET.plcDigest = function (s) {
    var out = "";
    for (var round = 0; round < 4; round++) {
      var h = 0x811c9dc5;
      var src = "plc:" + round + ":" + String(s).trim().toUpperCase();
      for (var i = 0; i < src.length; i++) {
        h ^= src.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
      }
      out += ("0000000" + h.toString(16)).slice(-8);
    }
    return out;
  };
})(typeof window !== "undefined" ? window : globalThis);

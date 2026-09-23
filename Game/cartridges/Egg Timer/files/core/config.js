/* ===========================================================================
   EGG TIMER — CONFIG
   Every number here comes from EGG_TIMER_CONTEXT_PACKET.md (merged through the
   Addendum's eighth draft, the Draft 9 rulings and the 2026-09-22 Timer
   Refinement). The section each one comes from is noted beside it. [T] marks a
   tunable the Refinement set for playtesting.
   🚫 Never invent a CAV timing or type code here: durations and codes live in
   datasets/cav_types.csv, which is Andrew's table.

   ⏳ PENDING values are marked. They are unsettled design questions, built as
   one switch each so a ruling from Chat is a one-line change. They are not
   decisions, and must not be copied into the packet as if they were.
   ========================================================================= */
(function (root) {
  var ET = (root.ET = root.ET || {});

  ET.CONFIG = {
    // ── Time (packet §3, §7; Timer Refinement 2026-09-22) ───────────────────
    // Two kinds of time (E3). The clocks show DISPLAYED time (a VS goes bold at 10:00);
    // they run sped up, and every clock on screen shares one speed at all times.
    // Everything else here (spawns, timeouts, overtime, cleanup) is THE PLAYER'S SECONDS.
    secondsPerMinute: 2,     // [T] player seconds per displayed minute at base speed (10:00 takes 20 s)
    speedStep: 0.10,         // [T] +10% of base speed…
    speedEveryWaves: 2,      //     …on every even wave (W2 1.1, W4 1.2, …)
    speedCap: 2.0,           // [T] capped at 2× (10:00 in 10 s)
    overtimeStart: 6.0,      // [T] player seconds after the bold trigger, before jitter
    overtimeShrink: 0.25,    // [T] −0.25 s…
    overtimeEveryWaves: 2,   //     …every 2 waves, on the odd waves the nests grow (W3, W5, …)
    overtimeFloor: 4.5,      // [T] reached at wave 13
    overtimeJitter: 0.10,    // [T] fixed ±10%, every wave

    // ── Wall clock and the AD post-it (Timer Refinement §3–§4) ──────────────
    postItCodes: ["AD"],     // the only type with a note; it draws whole minutes
    postItClockChance: 0.5,  // [T] 50/50: "Clear @ 14:35" vs "20 min"
    vfBubbleSeconds: 1.6,    // [T] how long "Clear Fueling" stays before it has faded

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
    messBlobsOwn: 6,         // [T] gunk added to the smooshed nest (item 9: look, still open; Refinement 3 §5: 5 → 6)
    messBlobsNeighbor: 3,    // [T] gunk added to each direct neighbour (Refinement 3 §5: 2 → 3)
    messBlobsField: 4,       // [T] Refinement 3 §5: and this many more anywhere on the board, floor included
    wipeRadius: 22,          // px, click-and-drag eraser

    // ── Build questions, ruled 2026-09-17 (Draft 9, packet §11) ─────────────
    // The other value of each switch still works, but it isn't the design.
    // D2: a new unit per CAV, never one already showing on the board.
    unitAssignment: "per-spawn",   // "per-spawn" | "per-nest"
    // (D5's game-seconds timer is superseded by the Timer Refinement: the clocks show displayed time.)
    // C15(b): VF hides only its timer until "Clear Fuel"; the unit and "VF" stay.
    vfHides: "timer",              // "timer" | "readout"
    // D4: a wave stops spawning once its quota has spawned.
    // (false keeps spawning, but what happens to CAVs left running at the wave's end was never designed.)
    stopSpawningAtQuota: true,
    // D6 is superseded by Refinement 2 §6: ANY rejected Enter clears the box and shows ERROR.
    keepTextOnReject: false,

    // ── Timer Refinement gaps, ruled 2026-09-22 (E1–E4) ──────────────────────
    // E1: "Clear @" is the next whole minute after start + draw, so it never bolds before
    //   the draw has passed (14:15:40 + 20 → "Clear @ 14:36"). The other value still works:
    //   "shown-minute" = the minute on the wall clock at the start + the draw (can be shorter).
    adClockTarget: "full-minutes",   // "full-minutes" | "shown-minute"
    // E2: an AD placement trigger shows its note when the CAV starts, not at the trigger.
    //   Only "start" is built.
    adNoteFrom: "start",

    // ── Refinement 2 (2026-09-22): pan, ERROR, hose (its switcher is retired by Refinement 3)
    panSeconds: 0.32,        // [T] the frying pan's slam, well under 0.5 s; never holds the keyboard
    friedSplits: [1 / 3, 2 / 3], // [T] overtime in thirds: sunny-side-up, broken yolk, burnt
    hatchPanDelay: 0.35,     // [T] on a hatch the pan comes down this late, on the empty nest
    thongPitchJitter: 0.06,  // [T] ±6% pitch on each THONG so repeats don't grate
    errorSeconds: 1.0,       // [T] how long the red ERROR shows under the Command Line
    sound: true,            // ⏳ placeholder sounds, synthesised; the real ones are Gemini's

    // ── Refinement 2 gaps, ruled 2026-09-22 (E5–E11) ─────────────────────────
    // Hose ruling (2026-09-22, replaces E5): in-game the cursor is ALWAYS the hose nozzle, with a
    // hose body curving down to a spigot at the bottom edge of the board. Water only while dragging.
    hoseWhen: "always",            // "always" | "wiping" | "cleanup" (the older rulings, kept as switch values)
    hoseWidth: 6,                  // [T] px, kept thin: it runs under the nests and every piece of text
    hoseSpigotX: 0.5,              // [T] where the spigot sits along the board's bottom edge (0 left … 1 right)
    // E6: an Enter on an EMPTY Command Line does nothing (no ERROR, no buzz).
    errorOnEmpty: false,

    // ── Refinement 3 (2026-09-23) ────────────────────────────────────────────
    // §1: Tab / Shift+Tab next / previous Command Line, F12 next and cleared.
    // ⏳ PENDING (E13): "F12: move to the NEXT Command Line and CLEAR that line." Built as the line
    //   it lands on ("next"); "left" clears the line being left instead. With 1 line F12 just clears it.
    f12Clears: "next",             // "next" | "left"
    switchFlashSeconds: 0.18,      // [T] the one quick bright flash on the line switched to
    pulseSeconds: 2.4,             // [T] the active line's slow neon pulse, one breath
    // §3: the cleanup banner across the top flashes this many times as cleanup starts, then holds steady.
    cleanupFlashes: 3,             // [T]
    cleanupFlashSeconds: 0.3,      // [T] one flash, on and off
    // §4 "Time Warp": once the wave has spawned its last egg and no egg is bold, every clock (nests and the
    // wall clock) runs this many times the wave's speed, until an egg goes bold. Overtime is untouched.
    warpFactor: 5,                 // [T]
    // §7 egg-laying: when a CAV starts, a cord drops from the top of the screen (layDrop), lowers the egg
    // in and pops off (layPop). The CAV's clock starts at the pop; the cord snakes back up (layRetract)
    // while the clock runs. All in the player's seconds.
    layDrop: 0.3,                  // [T]
    layPop: 0.3,                   // [T]
    layRetract: 0.45,              // [T]

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

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
    spawnGapShrink: 0.5,     // both ends, per wave; stacks with the clock-speed escalation (Spawn ruling, 2026-09-23)
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
    // E26 (ruled 2026-09-24): a clear scores by TIER, each a fifth of that egg's own overtime window, so all five
    //   can be reached at every clock speed. The cracks draw in over the same window, so the egg shows the tier.
    //   "slide" is the old scoring: 100 at the bold, sliding linearly to 25 at the hatch.
    clearScoring: "tiers",   // "tiers" | "slide"
    clearTierEnds: [0.2, 0.4, 0.6, 0.8, 1],    // where each tier ends, as a share of the overtime window
    clearTierPoints: [100, 75, 50, 35, 25],    // tier 1 … tier 5
    clearPointsMax: 100,     // "slide": cleared right as it goes bold…
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
    // Refinement 3 rulings (E15): a clear leaves a small splat on its own nest, and the rest of its gunk
    // lands evenly at random over the whole board; neighbours are no longer targeted.
    messBlobsOwn: 2,         // [T] the small splat on the cleared nest…
    messOwnSize: 0.6,        // [T] …at this size of an ordinary blob
    messBlobsField: 10,      // [T] the rest, evenly across the board (on whichever nest or floor it lands)
    messBlobPx: [8, 20],     // [T] an ordinary blob's radius on screen, px
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
    // (Refinement 2's fried eggs by overtime third are replaced by the egg ladder, Refinement 3 rulings, below.)
    hatchPanDelay: 0.35,     // [T] on a hatch the pan comes down this late, on the empty nest
    thongPitchJitter: 0.06,  // [T] ±6% pitch on each THONG so repeats don't grate
    errorSeconds: 1.0,       // [T] how long the red ERROR shows under the Command Line
    sound: true,            // ⏳ placeholder sounds, synthesised; the real ones are Gemini's

    // ── E24 (Andrew, 2026-09-24): sound on and off ──────────────────────────
    // A mute button on every screen and the M key, remembered per browser. The title tune pauses in a background tab,
    // and every sound goes through one master level with a soft ceiling (audio.js), so overlaps can't clip.
    // E25 (ruled by Andrew, 2026-09-24): during play the Command Line has the keys, and M is a letter players type (MB),
    //   so M types there. M mutes on the title, mode-selection and game-over screens and while paused; in play the
    //   button does, and so does Ctrl+M (it does nothing in VisiCAD, so it teaches no wrong habit). "none" drops Ctrl+M.
    muteKeyInPlay: "ctrl-m",       // "ctrl-m" | "none"

    // ── Refinement 2 gaps, ruled 2026-09-22 (E5–E11) ─────────────────────────
    // Hose ruling (2026-09-22, replaces E5): in-game the cursor is ALWAYS the hose nozzle, with a
    // hose body curving down to a spigot at the bottom edge of the board. Water only while dragging.
    hoseWhen: "always",            // "always" | "wiping" | "cleanup" (the older rulings, kept as switch values)
    hoseWidth: 6,                  // [T] px, kept thin: it draws above the whole board (Refinement 4 §2), across nests and readouts
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
    // 🚨 SAFETY (Andrew, 2026-09-24): at most 2 flashes a second, and never more than 2.5 whatever this is set to
    //   (a guard in view.js holds one flash to 0.4 s or longer). It was 0.3 s, 3.3 a second.
    cleanupFlashes: 3,             // [T]
    cleanupFlashSeconds: 0.5,      // [T] one flash, on and off: 2 a second
    // §4 "Time Warp": once the wave has spawned its last egg and no egg is bold, every clock (nests and the
    // wall clock) runs this many times the wave's speed, until an egg goes bold. Overtime is untouched.
    warpFactor: 5,                 // [T]
    // E27 (ruled 2026-09-24): players see it as the "Time Accelerator" (the code keeps "warp"). The centre panel is a
    // grandfather clock whose hands spin while it runs; with reduced motion they hold still and the face reads "5×".
    accelMinuteTurns: 1,           // [T] the minute hand's turns a player second while it runs (the hour hand: 1/12 of that)
    accelHandsAt: [305, 60],       // [T] where the hour and minute hands start, in degrees from 12 (about 10:10)
    // §7 egg-laying: when a CAV starts, a cord drops from the top of the screen (layDrop), lowers the egg
    // in and pops off (layPop). The CAV's clock starts at the pop; the cord snakes back up (layRetract)
    // while the clock runs. All in the player's seconds.
    // Refinement 4 §1: slower and creepier.
    layDrop: 1.0,                  // [T] (was 0.3)
    layPop: 0.4,                   // [T] (was 0.3)
    layRetract: 1.5,               // [T] a slow snaking retract (was 0.45)
    cordDropShare: 0.45,           // [T] of the drop, the empty cord coming down; the rest, the bulge travelling down it
    cordWidth: 10,                 // [T] Refinement 6 §4: thicker (was 4 px), striped blood red and purple, deeply ribbed

    // ── Refinement 3 rulings (2026-09-23): the egg ladder ───────────────────
    // A "fast clear" lands in the first part of the overtime window: E26 (ruled 2026-09-24), a tier 1 or tier 2
    // clear (ladderTiers); with the old "slide" scoring, the first third (fastClearShare). Consecutive fast clears climb the
    // ladder, one dish a rung, and stay at the top while the streak holds. A slow clear, any ERROR or a
    // hatch drops the streak to the bottom. It carries across waves, resets at game over, and is
    // cosmetic only: no score effect.
    ladderTiers: 2,                // E26: tiers 1–2 climb the ladder
    fastClearShare: 1 / 3,         // [T] "slide" scoring only: the first third of the overtime window
    ladder: ["Scrambled", "Sunny-Side Up", "Over Easy", "Poached", "Eggs Benny",
             "Eggs Benny w/ Avocado", "Steak, Eggs & Brew!"],   // [T] wording and steps
    dishSeconds: 1.0,              // [T] how long a fast clear's dish and caption show over the nest

    // ── Refinement 5 (2026-09-23) ────────────────────────────────────────────
    // §1: while Time Warp runs, "all ACTIVE nests" glow Time Warp green.
    // E22 (ruled 2026-09-23): ONLY the nests whose clock is running glow, not empty nests in play (and not
    //   an egg still being laid: its clock starts at the pop). "unlocked" (every nest in play) still works.
    warpGlow: "running",           // "running" | "unlocked"
    // Refinement 6 §2: while Time Warp runs, jagged lightning in the Time Warp green reaches out from the panel
    // to every nest whose clock is running, daisy-chained nest to nest (each link to the nearest nest not yet
    // reached, starting from the panel). It draws under every readout, like the cord.
    // 🚨 SAFETY: the bolts re-jag (flicker) at most lightningFlickerHz, and never more than 2.5 times a second
    //   whatever that is set to (a guard in view.js); with reduced motion they hold still.
    lightningChain: "nearest",     // [T] the only chain built
    lightningFlickerHz: 2,         // [T] re-jags a second (tweak 2026-09-23: 2, the arcade lights' headroom under the 3 limit); capped at 2.5
    lightningJag: 12,              // [T] px, how far a bolt's kinks stray from the straight line
    lightningKinks: 7,             // [T] kinks per link
    // §3: the how-to panel's doodles. Every so often one of them turns to a new angle.
    doodleTurnEvery: 2.5,          // [T] seconds between turns (one doodle at a time)
    doodleTurnMax: 28,             // [T] degrees either way
    // §5: the scary mom face. At most once a wave, sometimes not at all; under a second; from the top screen
    // edge (over the HUD bar and the band above the board) or up out of the how-to panel. Never over a nest,
    // a readout or a Command Line, never takes input, no flashing.
    // E23 (ruled 2026-09-23): keep both. For its 0.85 s it may cover the HUD bar ("top") or some of the
    //   how-to text ("panel"). Dropping one here keeps it to the other.
    momFaceZones: ["top", "panel"],
    momFaceChance: 0.6,            // [T] the chance a wave gets one
    momFaceWindow: [4, 30],        // [T] when, in the player's seconds after the wave starts (a wave that ends first gets none)
    momFaceSeconds: 0.85,          // [T] in, a beat, out
    momFaceVolume: 0.12,           // [T] the hiss and gurgle, low-ish

    // ── Arcade attract lights (Andrew approved, 2026-09-23) ─────────────────
    // Bulbs along the how-to panel's outline. Lively on the menu screens, a slow dim twinkle in play.
    // 🚨 SAFETY: no light may flash more than 3 times a second in any mode. Every change is refused within
    //   lightsMinToggle of that bulb's last, so the most any bulb can do is 1 / (2 × 0.2) = 2.5 flashes a
    //   second. Never set it below 1/6 s; the browser rig checks the log and the guard itself.
    lightsMinToggle: 0.2,
    lightsSpacing: 24,             // [T] px between bulbs
    lightsAttractRate: 0.9,        // [T] menus: tries per bulb per second at a random change
    lightsChaseEvery: [2.5, 5],    // [T] menus: seconds between chases round the panel
    lightsChaseSpeed: 12,          // [T] bulbs a second (a bulb stays lit length / speed = 0.25 s)
    lightsChaseLength: 3,          // [T]
    lightsCalmRate: 0.12,          // [T] play and cleanup: tries per bulb per second…
    lightsCalmMinToggle: 1.5,      // [T] …and never sooner than this after that bulb's last change

    // ── E27 (ruled 2026-09-24): the options screen's HOW / TO / PLAY signs ─────
    // They light one word at a time, then all three for a beat, and repeat.
    // 🚨 SAFETY: at most 2 changes a second. Every change goes through the signs' own guard (lights.js), which refuses
    //   one within signsMinChange of the last, and that is never below 0.5 s whatever it is set to. Under reduced
    //   motion all three stay lit.
    signsStepSeconds: 0.6,         // [T] each single word
    signsAllSeconds: 1.2,          // [T] all three together
    signsMinChange: 0.5,           // the guard (never below 0.5 s: 2 changes a second)

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

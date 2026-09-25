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
    boxesDefault: 2,         // E28 (ruled 2026-09-24): the options screen starts on 2 lines (1–4 still selectable)

    // ── Presentation (not rules; placeholders until art direction) ──────────
    eggMinScale: 0.35,       // egg size when a CAV starts; grows to 1.0 at the trigger
    // Pilot art (Chat ruling, 2026-09-25): the waiting egg's hints (E26) show at these shares of the way from bold to
    // hatch, and each stays until the egg is cleared or hatches. The eye is a rare extra: about 1 egg in 6 [T] gets it.
    eggHintsAt: { "hint-3": 0.4, "hint-eye": 0.5, "hint-4": 0.6, "hint-5": 0.8 },
    eggEyeChance: 1 / 6,     // [T]
    eggMirrorChance: 0.5,    // each egg is mirrored left/right at random when it's laid
    splatSeconds: 1.1,       // how long a smooshed nest stays busy before idling
    escapeSeconds: 1.4,      // how long an escape flourish keeps the nest busy
    // Refinement 3 rulings (E15): a clear leaves a small splat on its own nest, and the rest of its gunk
    // lands evenly at random over the whole board; neighbours are no longer targeted.
    messBlobsOwn: 2,         // [T] the small splat on the cleared nest…
    messOwnSize: 0.6,        // [T] …at this size of an ordinary blob
    messBlobsField: 10,      // [T] the rest, evenly across the board (on whichever nest or floor it lands)
    messBlobPx: [8, 20],     // [T] an ordinary blob's radius on screen, px
    wipeRadius: 22,          // px, click-and-drag eraser
    // E38 (Chat, 2026-09-25): the spray on liquid. It isn't pushed like a solid: each pass thins the patch under it to
    // (1 - thin) and lays `keep` of it down further along the spray's way (up to `carry` × the move), so it streaks and
    // washes out. Liquid pushed up to the board's top edge drips back down, and the last of a wash trickles toward the trough.
    // E42 (Chat, 2026-09-25): the blast washes liquid out faster, in about 2 passes, not 3 (thin was 0.7: 30%, 9%, 3%;
    // now 18%, then 3%).
    liquid: { thin: 0.82, keep: 0.4, carry: 0.9, dripAlpha: 0.7, minAlpha: 40 },   // [T]
    // E38: the pieces a clear leaves (core/pieces.js). Sizes and speeds are in board heights (bh), so every window size
    // plays the same. `parts`: alien parts by break stage (the clear's tier, E26), more the slower.
    pieces: {
      shards: [6, 8],              // [T] shell pieces from every clear
      parts: { 3: 1, 4: 2, 5: 3 }, // [T] alien parts at break stages 3, 4 and 5
      fling: [0.25, 0.6],          // [T] bh/s: how hard a clear throws them
      friction: 1.4,               // [T] bh/s²: how fast they slow down
      // E42 (Chat, 2026-09-25): one good sweep carries a piece all the way into the trough. At 0.9 and 2.2 it went ~80%
      // of the way (measured: a piece at top speed slid 1.7 bh, and the board is 2.25-2.74 bh wide); at top speed one
      // now slides maxSpeed² / (2 × friction) = 3.0 bh, past the widest board, and two spray events reach it.
      push: 1.6,                   // [T] bh/s a spray event adds (was 0.9)
      maxSpeed: 2.9,               // [T] bh/s (was 2.2)
      sprayRadius: 0.045,          // [T] bh: how wide the spray catches pieces
      wallPad: 0.004,              // [T] bh: the gap pieces keep round a readout
      flow: 0.28,                  // [T] bh/s: the trough's flow to the drain
      troughShrink: 0.8,           // [T] a piece in the trough is drawn this size (it's down in the channel)
      fadeSeconds: 0.6,            // [T] reduced motion: a piece in the trough fades out instead of riding the flow
      topBand: 0.06,               // [T] bh: "at the top edge"
      drip: 0.035,                 // [T] bh/s: a drip's slow run back down
      dripLength: [0.08, 0.22],    // [T] bh
      dripGap: 0.03,               // [T] bh: no two drips start closer than this
      trickleChance: 0.25          // [T] per washed spray event
    },

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
    thongPitchJitter: 0.06,  // [T] ±6% pitch on each THONG so repeats don't grate
    errorSeconds: 1.0,       // [T] how long the red ERROR shows under the Command Line
    sound: true,            // ⏳ placeholder sounds, synthesised; the real ones are Gemini's

    // ── Music (Chat ruling, 2026-09-25) ──────────────────────────────────────
    // Andrew's three Suno tracks, prepared by make-music.py from files/assets/music/ (never published): each loop file is
    // the track up to its loop's end, with an 80 ms equal-power crossfade baked in at the join, and the gameplay loop also
    // has its volume ramp baked in. loop = [start, end] in seconds inside the file; the file plays from 0 once, then loops.
    // The tempo is exact: each loop is a whole number of bars (Chat's "about 144" and "about 129" measure 141.02 and
    // 131.15). The numbers are make-music.py's files/audio/music.json, repeated here.
    // E36 (Chat, 2026-09-25): the music is a feature, as loud as the other PLC cartridges' music. Measured with ffmpeg's
    // ebur128 (integrated loudness) and each cartridge's own playback volume: Asteroid Command's seven tracks (volume 0.5)
    // play at -16.0 to -20.1 LUFS, the Aquanaut's two (0.5) at -20.9 and -22.3; the median of the nine, -19.8 LUFS, is
    // the target. `lufs` is each file's own loudness; its level = 10^((musicLufs - lufs + 1.94) / 20), 1.94 dB being the
    // master level's 0.8. Before E36 they played at -31.4 (title, game over) and -48.6 LUFS (gameplay). The files peak at
    // about -4 dBFS, so at these levels music alone stays well under the master ceiling's knee: never rounded off.
    musicLufs: -19.8,
    music: {
      title: { file: "audio/title-screens-loop.mp3", loop: [34.668005, 92.531995], bpm: 141.02, lufs: -15.5, level: 0.762 },   // title, mode selection, options
      gameplay: { file: "audio/ticking-clock-loop.mp3", loop: [9.198005, 151.940431], bpm: 131.15, lufs: -16.2, level: 0.826 }, // first wave to game over
      over: { file: "audio/game-over.mp3", loop: null, bpm: 113.45, lufs: -15.5, level: 0.762, seconds: 121.4 }                 // plays once
    },
    // [T] levels before the master: the menus have no sound effects to protect; in play the music sits at least 6 dB
    // under the quietest effect (the egg-laying squeeze), which rig section M measures.
    musicFade: 0.5,                // [T] seconds: every change of screen fades out and in; so does leaving game over
    // E36: the music dips under THONG, the error buzz and the hiss, then comes back; every other sound (the egg-laying
    // squeeze and pop, the ding) rides under it with no dip.
    musicDuck: { depth: 0.4, attack: 0.015, release: 0.3 },   // [T] to 40% (-8 dB) in 15 ms, back over 0.3 s once it ends
    musicPauseFade: 0.05,          // [T] seconds: Esc pauses and resumes the gameplay music where it stopped, without a click
    // E34 (ruled 2026-09-25): TITLE SCREEN is picked first ("again" would pick PLAY AGAIN, what Enter did before).
    overDefault: "title",
    // E34: game over ignores Enter for this long after it appears, and a held Enter (auto-repeat) at any time, so a
    // player still hammering Enter at the end of a game sees the result first. ← →, mute and clicks are unaffected.
    overEnterDelay: 1,             // [T] seconds

    // ── E24 (Andrew, 2026-09-24): sound on and off ──────────────────────────
    // A mute button on every screen and the M key, remembered per browser. The title tune pauses in a background tab,
    // and every sound goes through one master level with a soft ceiling (audio.js), so overlaps can't clip.
    // E25 (ruled by Andrew, 2026-09-24): during play the Command Line has the keys, and M is a letter players type (MB),
    //   so M types there. M mutes on the title, mode-selection and game-over screens and while paused; in play the
    //   button does, and so does Ctrl+M (it does nothing in VisiCAD, so it teaches no wrong habit). "none" drops Ctrl+M.
    muteKeyInPlay: "ctrl-m",       // "ctrl-m" | "none"
    // E35 (Chat, 2026-09-25): the title music starts on the title screen. Where the browser allows it (Fang Rock) it
    //   plays as soon as the title appears; a browser that holds sound until the first key or click starts it on that
    //   press. E40 (ruled 2026-09-25): "sound", as built: that first press only starts the music (the next Enter or click
    //   goes on); "go" would also leave the title, so the music would start as the options screen appears. Until that
    //   press the title's prompt reads "PRESS ANY KEY" (blinking, as the prompt always has), then "PRESS ENTER".
    wakePromptDelay: 0.3,          // [T] seconds: E40's prompt waits this long for autoplay (Fang Rock) before showing
    titleFirstPress: "sound",      // "sound" | "go"

    // ── Refinement 2 gaps, ruled 2026-09-22 (E5–E11) ─────────────────────────
    // Hose ruling (2026-09-22, replaces E5): in-game the cursor is ALWAYS the hose nozzle, with a
    // hose body curving down to a spigot at the bottom edge of the board. Water only while dragging.
    hoseWhen: "always",            // "always" | "wiping" | "cleanup" (the older rulings, kept as switch values)
    hoseWidth: 6,                  // [T] px, kept thin: it draws above the whole board (Refinement 4 §2), across nests and readouts
    hoseSpigotX: 0.5,              // [T] where the spigot sits along the board's bottom edge (0 left … 1 right)
    // E42 (Chat, 2026-09-25): a blast, not a trickle. While a drag sprays, a thick, fast jet leaves the nozzle's tip with
    // a burst there, mist along it and a splash where it hits; the pieces the jet reaches are pushed (it catches them
    // along its length, not only under the nozzle). Liquid still washes where the nozzle passes. Reduced motion: the jet
    // only, standing still (no burst, mist or splash). Sizes in board heights (bh).
    // E44 (Chat, 2026-09-25): the jet points the way the drag goes, and the nozzle picture turns with it (about its tip,
    // the cleaning point), so the two always agree. It swings rather than snaps: the drag must move turnMinMove px before
    // its direction counts (a small wobble turns nothing), and the picture closes on the new direction with a time
    // constant of turnSeconds. Still, it keeps its last direction; before a game's first drag it points up-left.
    // Reduced motion: it snaps to the new direction.
    hoseJet: { length: 0.14, width: 0.018, minWidth: 7, mist: 4, splashEvery: 0.07, turnMinMove: 8, turnSeconds: 0.07 },   // [T]
    // E42: the pressure-washer blast while spraying (audio.js): under the music, with no dip, under THONG, the buzz and
    // the hiss, on the egg-laying sounds' overlap cap. `gain` is its level into the master chain.
    hoseBlastGain: 0.032,          // [T]
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
    // E39 (Chat, 2026-09-25): Time Warp ALSO runs while at least `eggs` eggs are each more than `seconds` of displayed
    // time from their bold mark (both as ruled), whether or not the wave's last CAV has started. Never while an egg is bold.
    warpFar: { eggs: 2, seconds: 480 },   // 2 eggs, 8:00
    // E27 (ruled 2026-09-24): the centre panel is a grandfather clock whose hands spin while it runs; with reduced motion
    // they hold still and the face reads "5×". E28 (ruled 2026-09-24) keeps the name "Time Warp" (E27's rename is undone)
    // and puts a caption under its sign. When it kicks in, the sign flashes warpSignFlashes times, then stays lit.
    // 🚨 SAFETY: at most 2 flashes a second: every change of the sign goes through view.js's guard, which refuses one
    //   within warpSignMinChange of the last (never below 0.25 s). Under reduced motion it lights at once, no flash.
    warpSignFlashes: 3,            // [T]
    warpSignFlashSeconds: 0.6,     // [T] one flash, on and off
    warpSignMinChange: 0.25,       // the guard (never below 0.25 s: 2 flashes a second)
    // E43 (Chat, 2026-09-25): a rising zap as Time Warp starts, a falling one as it ends, nothing while it runs (audio.js).
    // Under THONG, the buzz and the hiss, no dip. Hz, seconds, and its level into the master chain.
    warpZap: { low: 180, high: 1400, seconds: 0.55, gain: 0.014 },   // [T]
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
    // Egg-laying sound (Chat ruling, 2026-09-25): a squeeze while the bulge travels the cord's last stretch, then a pop as
    // the egg drops into the nest. Synthesized for now (audio.js). Mixed clearly under THONG, the buzz and the hiss.
    laySqueezeAt: 0.55,            // [T] the share of the lay (drop + pop) where the squeeze starts: the bulge's last stretch
    layPitchJitter: 0.08,          // [T] ±8% pitch on each lay, so repeats don't sound identical
    layMaxOverlap: 2,              // [T] at most this many squeezes (and pops) sounding at once
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
    // E30 (ruled 2026-09-24) took the side panel out of play, so only "top" is left (E23: dropping one keeps it to the other).
    momFaceZones: ["top"],
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

    // ── Board lights and Time Warp dark (Chat ruling, 2026-09-25) ────────────
    // A faint, pale tint on the board (it stays dark), white lights that fade in and out on the music's beat behind
    // everything, and, while Time Warp runs, the board and its lights fade to dark. All in view.js's backdrop layer,
    // which sits behind the cord, the bolts and the whole board, so nothing in front of it is ever darkened.
    // E32 (ruled 2026-09-25): lilac, as built. The other two swatches (theme.css --board-tint-*) stay, unused: `?tint=`
    //   in the address still previews one without changing this.
    boardTint: "lilac",            // "lilac" | "mint" | "cream"
    // The beat clock reads the gameplay track's BPM (music.gameplay.bpm, below). It runs on the player's seconds: mute
    // doesn't stop the lights, pause freezes them.
    // 🚨 SAFETY: each light fades in and out over lightsBeats beats (never snaps); at most one new light a beat; at most
    //   lightsMax at once; faint (lightsPeak). None flashes: one slow rise and fall each, seconds long.
    lightsBeatChance: 0.5,         // [T] the chance a beat starts a new light
    lightsMax: 3,                  // [T]
    lightsBeats: 8,                // [T] one light's whole life, in beats (4.8 s at 100 BPM)
    lightsPeak: 0.05,              // [T] its brightest: white at 5% (at 7% the dim Time Warp caption fell under 4.5:1)
    lightsSize: [0.12, 0.34],      // [T] its diameter, as a share of the board's height
    // Time Warp dark: a fade, not a flash. 🚨 The veil changes at most once in warpDarkMinChange (never below 0.5 s).
    warpDarkSeconds: 0.5,          // [T] the fade
    warpDarkOpacity: 0.8,          // [T] how dark the veil gets over the tint and the lights
    warpDarkMinChange: 0.5,

    // ── E28 (ruled 2026-09-24): first-game tags ─────────────────────────────
    // In wave 1 only, and then never again that game: a tag for the first egg to go bold ("Pink = ready! Type RCAV
    // <unit>"), and one for the first "Clear @" note ("Check the wall clock"). They sit in the band above the board, so
    // they never cover a nest or a readout, with a thin leader line (under every readout) to what they point at.
    // Neither flashes.
    tipsWave: 1,

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

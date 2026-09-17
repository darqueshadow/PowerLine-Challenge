/* ===========================================================================
   EGG TIMER — RULES
   Pure functions of the wave number (and a random source). No DOM, no state.
   Every curve is the packet's, read from ET.CONFIG.
   ========================================================================= */
(function (root) {
  var ET = (root.ET = root.ET || {});
  var C = function () { return ET.CONFIG; };

  function range(start, shrink, floor, wave) {
    var d = shrink * (wave - 1);
    return [Math.max(floor, start[0] - d), Math.max(floor, start[1] - d)];
  }

  ET.rules = {
    nestsForWave: function (wave) {
      var c = C();
      return Math.min(c.nestsCap, c.nestsStart + Math.floor((wave - 1) / c.nestsEveryWaves));
    },

    quotaForWave: function (wave) {
      var c = C();
      return c.quotaStart + c.quotaPerWave * (wave - 1);
    },

    spawnGapRange: function (wave) {
      var c = C();
      return range(c.spawnGapStart, c.spawnGapShrink, c.spawnGapFloor, wave);
    },

    cleanupRange: function (wave) {
      var c = C();
      return range(c.cleanupStart, c.cleanupShrink, c.cleanupFloor, wave);
    },

    placementTimeout: function (wave) {
      var c = C();
      return Math.max(c.placementTimeoutFloor, c.placementTimeoutStart - c.placementTimeoutShrink * (wave - 1));
    },

    jitterForWave: function (wave) {
      var c = C();
      return Math.min(c.jitterCap, c.jitterStart + c.jitterPerWave * (wave - 1));
    },

    /* Follow Progression: 0 for waves 1–2, then 0% at wave 3, +10% per wave. */
    placementChance: function (wave) {
      var c = C();
      if (wave <= c.progressionOnePhaseWaves) return 0;
      return Math.min(1, c.progressionChanceStep * (wave - (c.progressionOnePhaseWaves + 1)));
    },

    /* Does this spawn need the player to place it? */
    needsPlacement: function (mode, wave, rng) {
      if (mode === "clear") return false;
      if (mode === "both") return true;
      var p = ET.rules.placementChance(wave);
      return p > 0 && rng() < p;
    },

    /* Overtime length for one CAV: 5 s, jittered by ±(wave's jitter). */
    overtimeFor: function (wave, rng) {
      var j = ET.rules.jitterForWave(wave);
      return C().overtimeBase * (1 + (rng() * 2 - 1) * j);
    },

    /* A CAV type's base duration in game-seconds: its real minutes × the scale.
       A fixed type has min === max. A ranged type (AD, VF) draws uniformly. */
    baseDurationFor: function (type, rng) {
      var minutes = type.min === type.max ? type.min : type.min + rng() * (type.max - type.min);
      return minutes * C().timeScale;
    },

    /* 100 right as it goes bold, linearly down to 25 at the moment it would hatch. */
    clearPoints: function (intoOvertime, overtimeLength) {
      var c = C();
      var t = overtimeLength > 0 ? intoOvertime / overtimeLength : 1;
      t = Math.max(0, Math.min(1, t));
      return Math.round(c.clearPointsMax - (c.clearPointsMax - c.clearPointsMin) * t);
    },

    perfectWaveBonus: function (wave) {
      return C().perfectWavePerWave * wave;
    },

    randIn: function (pair, rng) {
      return pair[0] + rng() * (pair[1] - pair[0]);
    }
  };

  /* A small seeded generator, so a rig can replay a game exactly (?seed=). */
  ET.seededRandom = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
})(typeof window !== "undefined" ? window : globalThis);

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

    /* Clock speed, a multiple of base: up on even waves (W1 1.0, W2 1.1, W3 1.1, W4 1.2), cap 2×. */
    clockSpeed: function (wave) {
      var c = C();
      return Math.min(c.speedCap, 1 + c.speedStep * Math.floor(wave / c.speedEveryWaves));
    },

    /* Displayed seconds that pass per player second at this wave's speed. */
    clockRate: function (wave) {
      return (60 / C().secondsPerMinute) * ET.rules.clockSpeed(wave);
    },

    /* The overtime window before jitter: 6 s, −0.25 s on odd waves from 3, floor 4.5 s at wave 13. */
    overtimeBaseFor: function (wave) {
      var c = C();
      return Math.max(c.overtimeFloor, c.overtimeStart - c.overtimeShrink * Math.floor((wave - 1) / c.overtimeEveryWaves));
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

    /* Overtime length for one CAV, in player seconds (clock speed doesn't touch it), fixed ±10%. */
    overtimeFor: function (wave, rng) {
      return ET.rules.overtimeBaseFor(wave) * (1 + (rng() * 2 - 1) * C().overtimeJitter);
    },

    /* A CAV type's duration in real minutes, which is where its clock goes bold.
       A fixed type has min === max. A post-it type (AD) draws whole minutes, since
       its note reads them; other ranged types (VF) draw uniformly. */
    minutesFor: function (type, rng) {
      if (type.min === type.max) return type.min;
      if (C().postItCodes.indexOf(type.code) >= 0) return type.min + Math.floor(rng() * (type.max - type.min + 1));
      return type.min + rng() * (type.max - type.min);
    },

    /* E26: which tier (1–5) a clear lands in, by its share of that egg's own overtime window. */
    clearTier: function (intoOvertime, overtimeLength) {
      var ends = C().clearTierEnds;
      var t = overtimeLength > 0 ? intoOvertime / overtimeLength : 1;
      for (var i = 0; i < ends.length - 1; i++) if (t < ends[i]) return i + 1;
      return ends.length;
    },

    /* E26 "tiers": the tier's points. "slide": 100 right as it goes bold, linearly down to 25 at the hatch. */
    clearPoints: function (intoOvertime, overtimeLength) {
      var c = C();
      if (c.clearScoring === "tiers") return c.clearTierPoints[ET.rules.clearTier(intoOvertime, overtimeLength) - 1];
      var t = overtimeLength > 0 ? intoOvertime / overtimeLength : 1;
      t = Math.max(0, Math.min(1, t));
      return Math.round(c.clearPointsMax - (c.clearPointsMax - c.clearPointsMin) * t);
    },

    /* A fast clear climbs the egg ladder (Refinement 3 rulings): E26, a tier 1–2 clear; "slide", the first third. */
    isFastClear: function (intoOvertime, overtimeLength) {
      var c = C();
      if (c.clearScoring === "tiers") return ET.rules.clearTier(intoOvertime, overtimeLength) <= c.ladderTiers;
      var t = overtimeLength > 0 ? intoOvertime / overtimeLength : 1;
      return t < c.fastClearShare;
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

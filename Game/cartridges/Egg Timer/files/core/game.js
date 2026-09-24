/* ===========================================================================
   EGG TIMER — GAME
   The whole mechanic, with no DOM: nests, eggs, hatching, escapes, the pool,
   waves. The view reads snapshots and drains `events`; a rig can drive it by
   calling step() directly.

   Two clocks (Timer Refinement, 2026-09-22):
     time   the player's seconds. Spawns, timeouts, overtime, cleanup and scoring run on it.
     clock  the displayed seconds every clock on screen shows. It runs sped up, at one
            shared rate that steps up on even waves, and a CAV goes bold on it.
   The wall clock is wallStart + clock, wrapped at midnight.
   Time Warp (Refinement 3 §4, E18): once the wave's last CAV has started (none
   still waiting to be placed) and no egg is bold, `clock` runs warpFactor times as fast, until the next egg goes bold.
   `time` never warps, so the overtime window is never shortened.

   A nest's life (packet §6–§7):
     idle ─spawn─▶ trigger (two-phase: waits for CAV #### TYPE, auto-opens on timeout)
          └───────▶ laying  (Refinement 3 §7: the cord lowers the egg in; no clock yet)
                    ─the pop─▶ active  (timer counts up from here, egg grows; RCAV does nothing yet)
                    ─real duration on the clock─▶ overtime (bold + RCAV valid + egg cracks, one event)
                    ─RCAV─▶ splat ─▶ idle          (cleared: points; a small splat on the nest, the rest over the board, E15)
                    ─overtime runs out─▶ escape ─▶ idle   (hatched: pool −1)
   ========================================================================= */
(function (root) {
  var ET = (root.ET = root.ET || {});

  /* A logical 4 × 3 grid (packet §4) under an organic on-screen layout; it holds
     the cap of 12. It used to decide which neighbours a clear dirtied; since the
     Refinement 3 rulings (E15) a clear's gunk lands evenly over the whole board, so
     it only places the nests now. Refinement 3 §8: all 12 are on screen all game, and
     they activate in a fixed order spread across the board, not clustered [T]:
     the four corners and a centre nest first, then the other centre, then the
     edges, alternating sides.
         0  1  2  3
         4  5  6  7
         8  9 10 11                                                          */
  var COLS = 4, ROWS = 3;
  var UNLOCK_ORDER = [0, 3, 8, 11, 5, 6, 1, 10, 2, 9, 4, 7];

  function Game(opts) {
    var C = ET.CONFIG;
    this.mode = opts.mode;                 // "clear" | "progression" | "both"
    this.boxes = opts.boxes || 1;
    this.types = opts.types || [];
    // the pool is the distinct unit numbers (Refinement 4 §3); the sheet's five doubles were removed 2026-09-23, this stays as a guard
    this.units = (opts.units || []).filter(function (u, i, all) { return all.indexOf(u) === i; });
    this.rng = opts.rng || Math.random;
    this.time = 0;
    this.clock = 0;
    this.wallStart = opts.wallStart || 0;  // seconds past midnight when the game starts
    this.speed = 1;
    this.rate = 0;
    this.wave = 0;
    this.phase = "ready";                  // ready | wave | cleanup | over
    this.pool = C.poolStart;
    this.score = 0;
    this.quota = 0;
    this.resolved = 0;
    this.spawned = 0;
    this.escapes = 0;
    this.streak = 0;                       // consecutive fast clears: the egg ladder (cosmetic, carries across waves)
    this.unitsUsed = {};                   // units drawn this wave (Refinement 4 §3)
    this.typeBag = [];                     // the wave's shuffle bag of CAV types (Refinement 4 §4)
    this.nextSpawnAt = 0;
    this.cleanupEndsAt = 0;
    this.events = [];
    this.stats = { placed: 0, autoOpened: 0, cleared: 0, hatched: 0, skipped: 0, rejected: 0, perfectWaves: 0, skippedByWave: {} };
    this.nests = [];
    for (var i = 0; i < COLS * ROWS; i++) {
      this.nests.push({ id: i, col: i % COLS, row: Math.floor(i / COLS), unlocked: false, fixedUnit: null });
      this.resetNest(this.nests[i]);
    }
  }

  Game.COLS = COLS;
  Game.ROWS = ROWS;
  Game.UNLOCK_ORDER = UNLOCK_ORDER;

  Game.prototype.emit = function (type, data) {
    var e = data || {};
    e.type = type;
    e.time = this.time;
    this.events.push(e);
  };

  Game.prototype.resetNest = function (n) {
    n.state = "idle";
    n.unit = ET.CONFIG.unitAssignment === "per-nest" ? n.fixedUnit : null;
    n.type = null;
    n.placement = false;
    n.timeoutAt = 0;
    n.startedAt = 0;
    n.startedClock = 0;
    n.boldClock = 0;
    n.note = null;
    n.boldAt = 0;
    n.hatchAt = 0;
    n.busyUntil = 0;
    n.layAt = 0;
    n.layUntil = 0;
    n.how = null;
  };

  Game.prototype.start = function () {
    this.startWave(1);
  };

  Game.prototype.startWave = function (wave) {
    this.wave = wave;
    this.unlockTo(ET.rules.nestsForWave(wave));
    this.quota = ET.rules.quotaForWave(wave);
    this.resolved = 0;
    this.spawned = 0;
    this.escapes = 0;
    this.speed = ET.rules.clockSpeed(wave);   // every clock shares one speed (a wave starts on an empty board, D4)
    this.rate = ET.rules.clockRate(wave);
    this.stats.skippedByWave[wave] = 0;
    this.unitsUsed = {};                   // a fresh unit pool each wave
    this.typeBag = [];                     // …and a fresh bag of CAV types (⏳ E20)
    this.phase = "wave";
    this.nextSpawnAt = this.time;
    this.emit("wave-start", { wave: wave, quota: this.quota, speed: this.speed });
  };

  Game.prototype.unlockTo = function (count) {
    for (var k = 0; k < count; k++) {
      var n = this.nests[UNLOCK_ORDER[k]];
      if (n.unlocked) continue;
      n.unlocked = true;
      if (ET.CONFIG.unitAssignment === "per-nest") {
        n.fixedUnit = this.freeUnit();
        n.unit = n.fixedUnit;
      }
      this.emit("nest-unlocked", { nest: n.id });
    }
  };

  Game.prototype.unlocked = function () {
    return this.nests.filter(function (n) { return n.unlocked; });
  };

  /* A unit not currently on the board, so no two nests ever share a number (a trigger waiting to be
     placed counts as on the board). Refinement 4 §3: within a wave no unit repeats until the whole unit
     pool has been used; then the pool refills, still never giving out one that's on the board. */
  Game.prototype.freeUnit = function () {
    var perNest = ET.CONFIG.unitAssignment === "per-nest";
    var onBoard = {}, usedThisWave = this.unitsUsed;
    this.nests.forEach(function (n) {
      if (perNest ? n.fixedUnit : n.state !== "idle" && n.unit) onBoard[perNest ? n.fixedUnit : n.unit] = true;
    });
    var free = this.units.filter(function (u) { return !onBoard[u]; });
    var fresh = perNest ? free : free.filter(function (u) { return !usedThisWave[u]; });
    if (!fresh.length && !perNest) {
      this.unitsUsed = {};                   // the whole pool has been used this wave: refill it
      fresh = free;
    }
    var pool = fresh.length ? fresh : this.units;
    var unit = pool.length ? pool[Math.floor(this.rng() * pool.length)] : "0000";
    if (!perNest) this.unitsUsed[unit] = true;
    return unit;
  };

  /* Refinement 4 §4: CAV types come out of a shuffle bag holding each type once; when it empties it is
     refilled and reshuffled, so the mix stays even (the old draw was uniform at random, with no weights).
     A two-phase-only type (VF) can only be drawn for a spawn that needs placing: where none can (Clear CAVs
     Only, and Follow Progression's waves with a 0% placement chance) the bag leaves it out; otherwise a VF
     the spawn can't take waits in the bag for the next placement spawn, and isn't added again while it
     waits (⏳ E19). */
  Game.prototype.pickType = function (placement) {
    var self = this;
    var noPlacing = this.mode === "clear" || (this.mode === "progression" && ET.rules.placementChance(this.wave) <= 0);
    var fits = function (t) { return placement || !t.twoPhaseOnly; };
    var i = this.typeBag.findIndex(fits);
    if (i < 0) {
      var fresh = this.types.filter(function (t) { return !(noPlacing && t.twoPhaseOnly) && self.typeBag.indexOf(t) < 0; });
      for (var k = fresh.length - 1; k > 0; k--) {        // Fisher–Yates, on the game's own random source
        var j = Math.floor(this.rng() * (k + 1)), tmp = fresh[k];
        fresh[k] = fresh[j];
        fresh[j] = tmp;
      }
      this.typeBag = this.typeBag.concat(fresh);
      i = this.typeBag.findIndex(fits);
    }
    return i < 0 ? null : this.typeBag.splice(i, 1)[0];
  };

  Game.prototype.spawn = function () {
    var idle = this.unlocked().filter(function (n) { return n.state === "idle"; });
    if (!idle.length) {
      this.stats.skipped++;
      this.stats.skippedByWave[this.wave]++;
      this.emit("spawn-skipped");   // packet §4: a full board loses the spawn, no queueing
      return false;
    }
    var placement = ET.rules.needsPlacement(this.mode, this.wave, this.rng);
    var type = this.pickType(placement);
    if (!type) {
      this.emit("no-types");
      return false;
    }
    var n = idle[Math.floor(this.rng() * idle.length)];
    n.unit = ET.CONFIG.unitAssignment === "per-nest" ? n.fixedUnit : this.freeUnit();
    n.type = type;
    n.placement = placement;
    this.spawned++;
    if (placement) {
      n.state = "trigger";
      n.timeoutAt = this.time + ET.rules.placementTimeout(this.wave);
      this.emit("trigger", { nest: n.id });
    } else {
      this.activate(n, "auto");
    }
    return true;
  };

  /* A CAV starts (spawned, placed or auto-opened): Refinement 3 §7's cord lays the egg first, and its
     clock starts at the pop (step()). */
  Game.prototype.activate = function (n, how) {
    var C = ET.CONFIG;
    n.state = "laying";
    n.how = how;
    n.layAt = this.time;
    n.layUntil = this.time + C.layDrop + C.layPop;
    this.emit("laying", { nest: n.id, how: how });
  };

  /* The pop: the egg is in and the CAV's clock starts. `late` is how far past the pop this step ran, in
     player seconds, at `rate`, so the clock starts on the exact instant. */
  Game.prototype.pop = function (n, late, rate) {
    var C = ET.CONFIG;
    late = late || 0;
    var minutes = ET.rules.minutesFor(n.type, this.rng);
    n.state = "active";
    n.startedAt = this.time - late;
    n.startedClock = this.clock - late * (rate === undefined ? this.rate : rate);
    n.boldClock = n.startedClock + minutes * 60;
    n.note = null;
    if (C.postItCodes.indexOf(n.type.code) >= 0) {
      if (this.rng() < C.postItClockChance) {
        // "Clear @ 14:35": bold when the WALL clock reads it, whatever the nest clock says (E1: the next whole minute after start + draw)
        var wall = this.wallStart + n.startedClock;
        var minute = C.adClockTarget === "full-minutes" ? Math.ceil(wall / 60) : Math.floor(wall / 60);
        var target = (minute + minutes) * 60;
        n.boldClock = target - this.wallStart;
        n.note = { kind: "clock", minutes: minutes, at: ((target % 86400) + 86400) % 86400 };
      } else {
        n.note = { kind: "duration", minutes: minutes };   // "20 min": bold at 20:00 on the nest clock
      }
    }
    this.emit("active", { nest: n.id, how: n.how });
  };

  Game.prototype.wall = function () {
    return (((this.wallStart + this.clock) % 86400) + 86400) % 86400;
  };

  /* Time Warp is on once the wave's last CAV has spawned AND started, and no egg is bold (checked every
     step, so it re-checks after each clear and hatch). */
  Game.prototype.warping = function () {
    if (this.phase !== "wave" || this.spawned < this.quota) return false;
    // E18 (ruled): not while a placement trigger is still waiting; the last CAV must have started
    // (placed or auto-opened), and no egg may be bold
    return !this.nests.some(function (n) { return n.unlocked && (n.state === "overtime" || n.state === "trigger"); });
  };

  Game.prototype.step = function (dt) {
    if (this.phase !== "wave" && this.phase !== "cleanup") return;
    var C = ET.CONFIG;
    var rate = this.warping() ? this.rate * C.warpFactor : this.rate;
    if (rate !== this.rate) {
      // stop the warp on the exact instant the next egg goes bold: split the step there
      var next = Infinity;
      this.nests.forEach(function (n) { if (n.unlocked && n.state === "active") next = Math.min(next, n.boldClock); });
      var until = (next - this.clock) / rate;
      if (until > 1e-9 && until < dt) {
        this.step(until);
        if (this.phase === "wave" || this.phase === "cleanup") this.step(dt - until);
        return;
      }
    }
    this.time += dt;
    this.clock += dt * rate;

    var nests = this.unlocked();
    for (var i = 0; i < nests.length; i++) {
      var n = nests[i];
      if (n.state === "trigger" && this.time >= n.timeoutAt) {
        this.stats.autoOpened++;
        this.activate(n, "auto-open");
      }
      if (n.state === "laying" && this.time >= n.layUntil) this.pop(n, this.time - n.layUntil, rate);
      if (n.state === "active" && this.clock >= n.boldClock) {
        // overtime is player seconds from the moment the clock crossed the mark, not from this step
        n.boldAt = this.time - (this.clock - n.boldClock) / rate;
        n.hatchAt = n.boldAt + ET.rules.overtimeFor(this.wave, this.rng);
        n.state = "overtime";
        this.emit("bold", { nest: n.id });
      }
      if (n.state === "overtime" && this.time >= n.hatchAt) {
        this.hatch(n);
        if (this.phase === "over") return;
      }
      if ((n.state === "splat" || n.state === "escape") && this.time >= n.busyUntil) {
        this.resetNest(n);
        this.emit("idle", { nest: n.id });
      }
    }

    if (this.phase === "wave") {
      if (this.resolved >= this.quota) {
        this.endWave();
      } else if ((!C.stopSpawningAtQuota || this.spawned < this.quota) && this.time >= this.nextSpawnAt) {
        this.spawn();
        this.nextSpawnAt = this.time + ET.rules.randIn(ET.rules.spawnGapRange(this.wave), this.rng);
      }
    } else if (this.phase === "cleanup" && this.time >= this.cleanupEndsAt) {
      this.startWave(this.wave + 1);
    }
  };

  Game.prototype.hatch = function (n) {
    n.state = "escape";
    n.busyUntil = this.time + ET.CONFIG.escapeSeconds;
    this.pool = Math.max(0, this.pool - 1);
    this.escapes++;
    this.resolved++;
    this.stats.hatched++;
    this.streak = 0;                 // a hatch drops the egg ladder to the bottom
    this.emit("hatch", { nest: n.id, pool: this.pool });
    if (this.pool <= 0) {
      this.phase = "over";           // packet §9: an empty pool is the only game over
      this.emit("game-over", { score: this.score, wave: this.wave });
    }
  };

  Game.prototype.endWave = function () {
    var C = ET.CONFIG;
    var perfect = this.escapes === 0;
    var bonus = 0, poolGained = false;
    if (perfect) {
      bonus = ET.rules.perfectWaveBonus(this.wave);
      this.score += bonus;
      this.stats.perfectWaves++;
      if (this.pool < C.poolCap) {
        this.pool++;
        poolGained = true;
      }
    }
    this.phase = "cleanup";
    this.cleanupEndsAt = this.time + ET.rules.randIn(ET.rules.cleanupRange(this.wave), this.rng);
    this.emit("wave-end", {
      wave: this.wave, perfect: perfect, bonus: bonus, poolGained: poolGained, cleanupEndsAt: this.cleanupEndsAt,
      skipped: this.stats.skippedByWave[this.wave]
    });
  };

  /* One Enter from the active Command Box. Returns what happened; anything that
     doesn't act on the board is rejected silently (no pool damage, no penalty). */
  Game.prototype.submit = function (text) {
    var cmd = ET.commands.parse(text);
    var nests = this.unlocked();
    var live = this.phase === "wave" || this.phase === "cleanup";
    var hit = null;

    if (live && cmd && cmd.kind === "cav") {
      hit = nests.filter(function (n) { return n.state === "trigger" && n.unit === cmd.unit; })[0];
      if (hit && hit.type.code === cmd.type) {
        this.activate(hit, "placed");
        this.score += ET.CONFIG.placementPoints;
        this.stats.placed++;
        this.emit("placed", { nest: hit.id, points: ET.CONFIG.placementPoints });
        return { ok: true, kind: "cav", nest: hit.id, points: ET.CONFIG.placementPoints };
      }
    }

    if (live && cmd && cmd.kind === "rcav") {
      hit = nests.filter(function (n) { return n.state === "overtime" && n.unit === cmd.unit; })[0];
      if (hit) {
        var into = this.time - hit.boldAt, span = hit.hatchAt - hit.boldAt;
        var points = ET.rules.clearPoints(into, span);
        this.score += points;
        hit.state = "splat";
        hit.busyUntil = this.time + ET.CONFIG.splatSeconds;
        this.resolved++;
        this.stats.cleared++;
        // the egg ladder: a fast clear climbs a rung (and stays at the top); a slow one drops to the bottom
        var fast = ET.rules.isFastClear(into, span);
        this.streak = fast ? this.streak + 1 : 0;
        this.emit("cleared", {
          nest: hit.id,
          points: points,
          tier: ET.rules.clearTier(into, span),   // E26: 1 (fast, elegant) … 5 (slow, alien); the break stage it will show
          fast: fast,
          rung: fast ? Math.min(this.streak, ET.CONFIG.ladder.length) - 1 : -1,   // which dish, or none
          streak: this.streak
        });
        return { ok: true, kind: "rcav", nest: hit.id, points: points };
      }
    }

    this.stats.rejected++;
    this.streak = 0;                 // any ERROR drops the egg ladder to the bottom
    this.emit("rejected", { text: text });
    return { ok: false };
  };

  Game.prototype.drain = function () {
    var e = this.events;
    this.events = [];
    return e;
  };

  Game.prototype.snapshot = function () {
    var t = this.time, self = this;
    return {
      time: t,
      clock: this.clock,
      wall: this.wall(),
      speed: this.speed,
      warp: this.warping(),
      mode: this.mode,
      wave: this.wave,
      phase: this.phase,
      pool: this.pool,
      score: this.score,
      quota: this.quota,
      resolved: this.resolved,
      spawned: this.spawned,
      escapes: this.escapes,
      streak: this.streak,
      cleanupLeft: this.phase === "cleanup" ? Math.max(0, this.cleanupEndsAt - t) : 0,
      stats: JSON.parse(JSON.stringify(this.stats)),
      nests: this.unlocked().map(function (n) {
        var running = n.state === "active" || n.state === "overtime";
        var C = ET.CONFIG;
        return {
          id: n.id, col: n.col, row: n.row, state: n.state, unit: n.unit,
          code: n.type ? n.type.code : null,
          hidden: !!(n.type && n.type.hiddenUntilTrigger && (n.state === "active" || n.state === "laying")),
          // the cord (Refinement 3 §7): 0–1 through the lay, then 0–1 through the retract after the pop
          lay: n.state === "laying" ? Math.min(1, (t - n.layAt) / Math.max(0.001, C.layDrop + C.layPop)) : null,
          retract: running && t - n.startedAt < C.layRetract ? (t - n.startedAt) / C.layRetract : null,
          elapsed: running ? self.clock - n.startedClock : 0,   // displayed seconds, still counting through overtime
          grow: running ? Math.min(1, (self.clock - n.startedClock) / Math.max(0.001, n.boldClock - n.startedClock)) : 0,
          note: running && n.note ? { kind: n.note.kind, minutes: n.note.minutes, at: n.note.at } : null,
          crack: n.state === "overtime" ? Math.min(1, (t - n.boldAt) / Math.max(0.001, n.hatchAt - n.boldAt)) : 0
        };
      })
    };
  };

  ET.Game = Game;
})(typeof window !== "undefined" ? window : globalThis);

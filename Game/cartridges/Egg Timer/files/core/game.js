/* ===========================================================================
   EGG TIMER — GAME
   The whole mechanic, with no DOM: nests, eggs, hatching, escapes, the pool,
   waves. The view reads snapshots and drains `events`; a rig can drive it by
   calling step() directly.

   A nest's life (packet §6–§7):
     idle ─spawn─▶ trigger (two-phase: waits for CAV #### TYPE, auto-opens on timeout)
          └───────▶ active  (timer counts up, egg grows; RCAV does nothing yet)
                    ─real duration─▶ overtime (bold + RCAV valid + egg cracks, one event)
                    ─RCAV─▶ splat ─▶ idle          (cleared: points, mess on nest + neighbours)
                    ─overtime runs out─▶ escape ─▶ idle   (hatched: pool −1)
   ========================================================================= */
(function (root) {
  var ET = (root.ET = root.ET || {});

  /* A logical grid for adjacency only (packet §4: up/down/left/right on a grid
     underneath an organic on-screen layout; the grid's size is Code's call).
     4 × 3 holds the cap of 12. Nests unlock centre-out so every count from 5 to
     12 stays one compact cluster. */
  var COLS = 4, ROWS = 3;
  var UNLOCK_ORDER = [5, 6, 1, 2, 9, 10, 4, 7, 0, 3, 8, 11];

  function Game(opts) {
    var C = ET.CONFIG;
    this.mode = opts.mode;                 // "clear" | "progression" | "both"
    this.boxes = opts.boxes || 1;
    this.types = opts.types || [];
    this.units = opts.units || [];
    this.rng = opts.rng || Math.random;
    this.time = 0;
    this.wave = 0;
    this.phase = "ready";                  // ready | wave | cleanup | over
    this.pool = C.poolStart;
    this.score = 0;
    this.quota = 0;
    this.resolved = 0;
    this.spawned = 0;
    this.escapes = 0;
    this.nextSpawnAt = 0;
    this.cleanupEndsAt = 0;
    this.events = [];
    this.stats = { placed: 0, autoOpened: 0, cleared: 0, hatched: 0, skipped: 0, rejected: 0, perfectWaves: 0 };
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
    n.boldAt = 0;
    n.hatchAt = 0;
    n.busyUntil = 0;
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
    this.phase = "wave";
    this.nextSpawnAt = this.time;
    this.emit("wave-start", { wave: wave, quota: this.quota });
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

  Game.prototype.neighborsOf = function (nest) {
    var self = this;
    return [[0, -1], [0, 1], [-1, 0], [1, 0]]
      .map(function (d) {
        var c = nest.col + d[0], r = nest.row + d[1];
        if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return null;
        return self.nests[r * COLS + c];
      })
      .filter(function (n) { return n && n.unlocked; });
  };

  /* A unit not currently on the board, so no two nests ever share a number. */
  Game.prototype.freeUnit = function () {
    var perNest = ET.CONFIG.unitAssignment === "per-nest";
    var used = {};
    this.nests.forEach(function (n) {
      if (perNest ? n.fixedUnit : n.state !== "idle" && n.unit) used[perNest ? n.fixedUnit : n.unit] = true;
    });
    var free = this.units.filter(function (u) { return !used[u]; });
    var pool = free.length ? free : this.units;
    return pool.length ? pool[Math.floor(this.rng() * pool.length)] : "0000";
  };

  Game.prototype.pickType = function (placement) {
    var pool = placement ? this.types : this.types.filter(function (t) { return !t.twoPhaseOnly; });
    return pool.length ? pool[Math.floor(this.rng() * pool.length)] : null;
  };

  Game.prototype.spawn = function () {
    var idle = this.unlocked().filter(function (n) { return n.state === "idle"; });
    if (!idle.length) {
      this.stats.skipped++;
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

  Game.prototype.activate = function (n, how) {
    n.state = "active";
    n.startedAt = this.time;
    n.boldAt = this.time + ET.rules.baseDurationFor(n.type, this.rng);
    n.hatchAt = n.boldAt + ET.rules.overtimeFor(this.wave, this.rng);
    this.emit("active", { nest: n.id, how: how });
  };

  Game.prototype.step = function (dt) {
    if (this.phase !== "wave" && this.phase !== "cleanup") return;
    this.time += dt;
    var C = ET.CONFIG;

    var nests = this.unlocked();
    for (var i = 0; i < nests.length; i++) {
      var n = nests[i];
      if (n.state === "trigger" && this.time >= n.timeoutAt) {
        this.stats.autoOpened++;
        this.activate(n, "auto-open");
      }
      if (n.state === "active" && this.time >= n.boldAt) {
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
    this.emit("wave-end", { wave: this.wave, perfect: perfect, bonus: bonus, poolGained: poolGained, cleanupEndsAt: this.cleanupEndsAt });
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
        var points = ET.rules.clearPoints(this.time - hit.boldAt, hit.hatchAt - hit.boldAt);
        this.score += points;
        hit.state = "splat";
        hit.busyUntil = this.time + ET.CONFIG.splatSeconds;
        this.resolved++;
        this.stats.cleared++;
        this.emit("cleared", {
          nest: hit.id,
          points: points,
          neighbors: this.neighborsOf(hit).map(function (x) { return x.id; })
        });
        return { ok: true, kind: "rcav", nest: hit.id, points: points };
      }
    }

    this.stats.rejected++;
    this.emit("rejected", { text: text });
    return { ok: false };
  };

  Game.prototype.drain = function () {
    var e = this.events;
    this.events = [];
    return e;
  };

  Game.prototype.snapshot = function () {
    var t = this.time;
    return {
      time: t,
      mode: this.mode,
      wave: this.wave,
      phase: this.phase,
      pool: this.pool,
      score: this.score,
      quota: this.quota,
      resolved: this.resolved,
      spawned: this.spawned,
      escapes: this.escapes,
      cleanupLeft: this.phase === "cleanup" ? Math.max(0, this.cleanupEndsAt - t) : 0,
      stats: JSON.parse(JSON.stringify(this.stats)),
      nests: this.unlocked().map(function (n) {
        var running = n.state === "active" || n.state === "overtime";
        return {
          id: n.id, col: n.col, row: n.row, state: n.state, unit: n.unit,
          code: n.type ? n.type.code : null,
          hidden: !!(n.type && n.type.hiddenUntilTrigger && n.state === "active"),
          elapsed: running ? t - n.startedAt : 0,
          grow: running ? Math.min(1, (t - n.startedAt) / Math.max(0.001, n.boldAt - n.startedAt)) : 0,
          crack: n.state === "overtime" ? Math.min(1, (t - n.boldAt) / Math.max(0.001, n.hatchAt - n.boldAt)) : 0
        };
      })
    };
  };

  ET.Game = Game;
})(typeof window !== "undefined" ? window : globalThis);

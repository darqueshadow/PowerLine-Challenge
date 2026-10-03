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
   Time Warp (Refinement 3 §4, E18): once the wave's last CAV has started and no egg is bold, `clock` runs warpFactor
   times as fast, until the next egg goes bold.
   E39: it also runs while 2 or more eggs are each over 8:00 (displayed) from their bold mark, again never while an
   egg is bold.
   `time` never warps, so the overtime window is never shortened.

   One mode (Andrew's hospital eggs handoff, 2026-10-01; E52–E56 ruled 2026-10-02): every egg is laid with a VS, and
   about 70% (hospitalShare) are HOSPITAL eggs, with an H sign on the nest. A refusal egg is cleared with one RCAV as
   always. A hospital egg needs RCAV and then CAV #### STR inside the same hatch window; the STR is window 1's clear
   (E52: its tier's points, no splat: Mom repairs the egg), its clock starts at once, and when the STR runs out the
   egg cracks again for an ordinary last window and an ordinary RCAV.

   A nest's life (packet §6–§7):
     idle ─spawn─▶ laying  (Refinement 3 §7: the cord lowers the egg in; no clock yet)
                   ─the pop─▶ active  (timer counts up from here, egg grows; RCAV does nothing yet)
                   ─real duration on the clock─▶ overtime (bold + RCAV valid + egg cracks, one event)
                   ─RCAV─▶ splat ─▶ idle          (cleared: points; a small splat on the nest, the rest over the board, E15)
                   ─overtime runs out─▶ escape ─▶ idle   (hatched: pool −1)
     a hospital egg's first window (still "overtime"):
                   ─RCAV─▶ (removed: the VS is off, the STR not yet on; it keeps cracking)
                   ─CAV #### STR─▶ active again on the STR (repaired), then on as above
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

  function byCode(types, code) {
    return (types || []).filter(function (t) { return t.code === code; })[0] || null;
  }

  function Game(opts) {
    var C = ET.CONFIG;
    this.boxes = opts.boxes || 1;
    this.types = opts.types || [];
    // E54: every egg is laid with a VS; a hospital egg's second CAV is the STR. Both from the table as it is.
    this.first = byCode(this.types, C.eggType);
    this.second = byCode(this.types, C.hospitalType);
    // E59 (ruled): which types eggs are laid with ("bag": every row of the table but the STR, the hospital step; VF back
    // in since Chat's combined batch, 2026-10-03, then out again by vfInPlay, item E; "VS": E54)
    var self = this;
    this.eggTypes = (opts.eggTypes || C.eggTypes) === "VS" ? (this.first ? [this.first] : [])
      : this.types.filter(function (t) { return t !== self.second && (C.vfInPlay || t.code !== C.fuelType); });   // E: VF off
    this.typeBag = [];
    this.hospitalShare = opts.hospitalShare !== undefined ? opts.hospitalShare : C.hospitalShare;
    // the pool is the distinct unit numbers (Refinement 4 §3); the sheet's five doubles were removed 2026-09-23, this stays as a guard
    this.units = (opts.units || []).filter(function (u, i, all) { return all.indexOf(u) === i; });
    this.rng = opts.rng || Math.random;
    // E45: the hatchlings draw from their own source, so a seeded replay's spawns don't shift with them
    this.hatchRng = opts.hatchRng || Math.random;
    this.hatchBags = { cute: [], horror: [] };
    this.lastAlien = null;
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
    this.nextSpawnAt = 0;
    this.cleanupEndsAt = 0;
    this.events = [];
    this.stats = { hospital: 0, removed: 0, repaired: 0, cleared: 0, hatched: 0, skipped: 0, rejected: 0, perfectWaves: 0, skippedByWave: {} };
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
    n.hospital = false;    // the H sign: this egg needs RCAV, then CAV #### STR
    n.removed = false;     // a hospital egg's VS is off and its STR not yet on
    n.repaired = false;    // a hospital egg on its STR (Mom has repaired it)
    n.resetAt = 0;         // Chat (2026-10-02): when the RCAV restarted a hospital egg's countdown…
    n.crackAt = 0;         // …how far it had cracked then…
    n.note = null;         // an AD's "Clear @ HH:MM" (Chat, 2026-10-03)
    n.rcavTier = 0;        // …and window 1's tier and points, taken at the RCAV
    n.rcavPoints = 0;
    n.startedAt = 0;
    n.startedClock = 0;
    n.boldClock = 0;
    n.boldAt = 0;
    n.hatchAt = 0;
    n.busyUntil = 0;
    n.layAt = 0;
    n.layUntil = 0;
    n.how = null;
    n.hatchling = null;
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
    this.typeBag = [];                     // ⏳ E59: and a fresh bag of CAV types (E20)
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

  /* A unit not currently on the board, so no two nests ever share a number. Refinement 4 §3: within a wave no unit
     repeats until the whole unit pool has been used; then the pool refills, still never giving out one that's on the board. */
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

  Game.prototype.spawn = function () {
    var idle = this.unlocked().filter(function (n) { return n.state === "idle"; });
    if (!idle.length) {
      this.stats.skipped++;
      this.stats.skippedByWave[this.wave]++;
      this.emit("spawn-skipped");   // packet §4: a full board loses the spawn, no queueing
      return false;
    }
    if (!this.eggTypes.length) {
      this.emit("no-types");
      return false;
    }
    var n = idle[Math.floor(this.rng() * idle.length)];
    n.unit = ET.CONFIG.unitAssignment === "per-nest" ? n.fixedUnit : this.freeUnit();
    n.type = this.pickType();
    // E56 (ruled): a plain random roll per egg, on the game's own source (so ?seed= replays it); only a VS can be a
    // hospital egg (Chat, 2026-10-02)
    n.hospital = !!this.second && n.type === this.first && this.rng() < this.hospitalShare;
    if (n.hospital) this.stats.hospital++;
    this.spawned++;
    this.activate(n, "auto");
    return true;
  };

  /* ⏳ E59: the CAV type comes out of a shuffle bag holding each type once; when it empties it is refilled and
     reshuffled on the game's own source, so the mix stays even (Refinement 4 §4, E19, E20; restored 2026-10-02). */
  Game.prototype.pickType = function () {
    if (!this.typeBag.length) {
      var fresh = this.eggTypes.slice();
      for (var k = fresh.length - 1; k > 0; k--) {        // Fisher–Yates
        var j = Math.floor(this.rng() * (k + 1)), tmp = fresh[k];
        fresh[k] = fresh[j];
        fresh[j] = tmp;
      }
      this.typeBag = fresh;
    }
    return this.typeBag.shift();
  };

  /* A CAV starts: Refinement 3 §7's cord lays the egg first, and its clock starts at the pop (step()). */
  Game.prototype.activate = function (n, how) {
    var C = ET.CONFIG;
    n.state = "laying";
    n.how = how;
    n.layAt = this.time;
    n.layUntil = this.time + C.layDrop + C.layPop;
    this.emit("laying", { nest: n.id, how: how, hospital: n.hospital });
  };

  /* The pop: the egg is in and the CAV's clock starts. `late` is how far past the pop this step ran, in
     player seconds, at `rate`, so the clock starts on the exact instant. */
  Game.prototype.pop = function (n, late, rate) {
    late = late || 0;
    n.state = "active";
    n.startedAt = this.time - late;
    n.startedClock = this.clock - late * (rate === undefined ? this.rate : rate);
    var minutes = ET.rules.minutesFor(n.type, this.rng);
    n.boldClock = n.startedClock + minutes * 60;
    n.note = null;
    // Chat (2026-10-03), as Timer Refinement §4 and E1: an AD says "Clear @ HH:MM" and goes bold when the WALL clock reads
    // it, the next whole minute after its start plus the draw ("shown-minute": the minute showing at the start, plus it)
    if (ET.CONFIG.postItCodes.indexOf(n.type.code) >= 0) {
      var wall = this.wallStart + n.startedClock;
      var minute = ET.CONFIG.adClockTarget === "full-minutes" ? Math.ceil(wall / 60) : Math.floor(wall / 60);
      var target = (minute + minutes) * 60;
      n.boldClock = target - this.wallStart;
      n.note = { kind: "clock", minutes: minutes, at: ((target % 86400) + 86400) % 86400 };
    }
    this.emit("active", { nest: n.id, how: n.how, hospital: n.hospital });
  };

  Game.prototype.wall = function () {
    return (((this.wallStart + this.clock) % 86400) + 86400) % 86400;
  };

  /* Time Warp is on once the wave's last CAV has spawned (it starts at once: nothing waits to be placed now, E54), and
     no egg is bold; or (E39) while 2 or more eggs are each over 8:00 from their bold mark, again with no egg bold
     (checked every step, so it re-checks after each clear, hatch and pop). A hospital egg waiting for its STR is still
     bold (overtime) but doesn't hold the warp off (Chat's playtest rulings, 2026-10-02). */
  Game.prototype.warping = function () {
    if (this.phase !== "wave") return false;
    var live = this.nests.filter(function (n) { return n.unlocked; });
    // never while an egg is bold; a hospital egg waiting for its STR after the RCAV doesn't count (Chat, 2026-10-02)
    if (live.some(function (n) { return n.state === "overtime" && !n.removed; })) return false;
    if (this.spawned >= this.quota) return true;
    return this.farEggs() >= ET.CONFIG.warpFar.eggs;
  };
  /* E39: how many running eggs are more than warpFar.seconds (displayed) from their bold mark. */
  Game.prototype.farEggs = function () {
    var clock = this.clock, far = ET.CONFIG.warpFar.seconds;
    return this.nests.filter(function (n) { return n.unlocked && n.state === "active" && n.boldClock - clock > far + 1e-9; }).length;   // (a split step lands on the mark itself)
  };

  Game.prototype.step = function (dt) {
    if (this.phase !== "wave" && this.phase !== "cleanup") return;
    var C = ET.CONFIG;
    var rate = this.warping() ? this.rate * C.warpFactor : this.rate;
    if (rate !== this.rate) {
      // stop the warp on the exact instant the next egg goes bold, or (E39) an egg comes within 8:00 of its bold mark:
      // split the step there, and warping() decides again
      var next = Infinity, far = C.warpFar.seconds, clock = this.clock;
      this.nests.forEach(function (n) {
        if (!n.unlocked || n.state !== "active") return;
        next = Math.min(next, n.boldClock);
        if (n.boldClock - far > clock) next = Math.min(next, n.boldClock - far);
      });
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
      if (n.state === "laying" && this.time >= n.layUntil) this.pop(n, this.time - n.layUntil, rate);
      if (n.state === "active" && this.clock >= n.boldClock) {
        // overtime is player seconds from the moment the clock crossed the mark, not from this step
        n.boldAt = this.time - (this.clock - n.boldClock) / rate;
        // E53: a hospital egg's first window can be tuned on its own (hospitalWindowScale, 1 = the same as every egg)
        var scale = n.hospital && !n.repaired ? C.hospitalWindowScale : 1;
        n.hatchAt = n.boldAt + ET.rules.overtimeFor(this.wave, this.rng) * scale;
        n.state = "overtime";
        this.emit("bold", { nest: n.id, hospital: n.hospital, repaired: n.repaired });
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

  /* E45: the alien comes out of its set's shuffle bag, never the one that came out last (not even across a refill). */
  Game.prototype.pickAlien = function (set) {
    var bag = this.hatchBags[set], all = ET.CONFIG.hatchAliens[set];
    if (!bag.length) {
      bag.push.apply(bag, all);
      for (var k = bag.length - 1; k > 0; k--) {        // Fisher–Yates
        var j = Math.floor(this.hatchRng() * (k + 1)), tmp = bag[k];
        bag[k] = bag[j];
        bag[j] = tmp;
      }
      if (bag.length > 1 && bag[0] === this.lastAlien) bag.push(bag.shift());
    }
    return (this.lastAlien = bag.shift());
  };

  Game.prototype.hatch = function (n) {
    var C = ET.CONFIG;
    var set = ET.rules.hatchSet(this.wave, this.escapes === 0, this.resolved / Math.max(1, this.quota), this.hatchRng);
    var exits = C.hatchExits[set];
    n.state = "escape";
    n.busyUntil = this.time + C.escapeSeconds;
    n.hatchling = { set: set, alien: this.pickAlien(set), exit: exits[Math.floor(this.hatchRng() * exits.length)] };
    this.pool = Math.max(0, this.pool - 1);
    this.escapes++;
    this.resolved++;
    this.stats.hatched++;
    this.streak = 0;                 // a hatch drops the egg ladder to the bottom
    this.emit("hatch", { nest: n.id, pool: this.pool, set: n.hatchling.set, alien: n.hatchling.alien, exit: n.hatchling.exit });
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

  /* E52 (ruled 2026-10-02): CAV #### STR on a hospital egg whose VS is off. Window 1 scores here (the egg is saved), by
     the same tiers as any clear, the tier taken at the RCAV (Chat's playtest rulings, 2026-10-02; E52 took it here). No pan, no THONG, no splat, mess or pieces: Mom repairs the egg. The
     egg ladder follows the final clear only, so the streak stays where it is. The STR's clock starts now. */
  Game.prototype.repair = function (n) {
    var C = ET.CONFIG;
    // Chat (2026-10-02): the tier was taken at the RCAV, in window 1; it's paid now, as the egg is saved
    var points = n.rcavPoints, tier = n.rcavTier;
    this.score += points;
    this.stats.repaired++;
    n.removed = false;
    n.repaired = true;
    n.type = this.second;
    n.state = "active";
    n.startedAt = this.time;
    n.startedClock = this.clock;
    n.boldClock = this.clock + ET.rules.minutesFor(n.type, this.rng) * 60;
    n.boldAt = 0;
    n.hatchAt = 0;
    // E55 (ruled): sweet Mom in the first wave(s), creepy Mom after (matching the scary HUD face)
    var mom = this.wave <= C.momSweetUntilWave ? "sweet" : "creepy";
    this.emit("repaired", { nest: n.id, points: points, tier: tier, mom: mom });
    return { ok: true, kind: "cav", nest: n.id, points: points, repaired: true };
  };

  /* One Enter from the active Command Line. Returns what happened. Anything that doesn't act on the board is a rejected
     Enter (E6: the line clears, ERROR and a buzz, no pool damage); some say why instead of ERROR (`why`). */
  Game.prototype.submit = function (text) {
    var cmd = ET.commands.parse(text);
    var nests = this.unlocked();
    var live = this.phase === "wave" || this.phase === "cleanup";
    var hit = null, why = null;
    var onUnit = function (unit) { return nests.filter(function (n) { return n.state !== "idle" && n.unit === unit; })[0] || null; };

    if (live && cmd && cmd.kind === "rcav") {
      hit = onUnit(cmd.unit);
      if (hit && hit.state === "overtime" && !hit.removed) {
        // E53: a hospital egg's first RCAV takes the VS off; the egg keeps cracking until the STR is on
        if (hit.hospital && !hit.repaired) {
          // Chat's playtest rulings (2026-10-02): window 1's tier is taken here, and the countdown restarts for the STR
          var into = this.time - hit.boldAt, span = hit.hatchAt - hit.boldAt;
          hit.rcavTier = ET.rules.clearTier(into, span);
          hit.rcavPoints = ET.rules.clearPoints(into, span);
          hit.crackAt = Math.min(1, into / Math.max(0.001, span));
          hit.resetAt = this.time;
          hit.hatchAt = this.time + ET.CONFIG.hospitalResetSeconds;
          hit.removed = true;
          this.stats.removed++;
          this.emit("removed", { nest: hit.id });
          return { ok: true, kind: "rcav", nest: hit.id, points: 0, removed: true };
        }
        return this.clear(hit);
      }
      // Andrew, 2026-10-01: an RCAV for a CAV whose real duration hasn't passed yet (its egg still laying or running,
      // the STR's included) is "Too Early!", not ERROR. E53: a second RCAV on a removed VS is ERROR (nothing to remove).
      if (hit && (hit.state === "laying" || hit.state === "active")) why = "early";
    }

    if (live && cmd && cmd.kind === "cav") {
      hit = onUnit(cmd.unit);
      var str = this.second && cmd.type === this.second.code;
      if (hit && str && hit.hospital && !hit.repaired && hit.state === "overtime" && hit.removed) return this.repair(hit);
      // E53: the STR before the VS is off (laying, running, or cracking with the VS still on) is "RCAV first!"; the STR on
      // a refusal egg, on one already on its STR, or any other type is ERROR
      if (hit && str && hit.hospital && !hit.repaired && !hit.removed &&
          (hit.state === "laying" || hit.state === "active" || hit.state === "overtime")) why = "rcav-first";
    }

    this.stats.rejected++;
    this.streak = 0;                 // any rejected Enter drops the egg ladder to the bottom (E6)
    this.emit("rejected", { text: text, why: why, early: why === "early" });
    return { ok: false, why: why, early: why === "early" };
  };

  /* The final clear of any egg: a refusal egg's only RCAV, or a hospital egg's RCAV on its STR. */
  Game.prototype.clear = function (hit) {
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
      streak: this.streak,
      hospital: hit.hospital
    });
    return { ok: true, kind: "rcav", nest: hit.id, points: points };
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
          // E53: between the RCAV and the STR the type box is empty, asking for the STR
          code: n.type && !n.removed ? n.type.code : n.removed ? "" : null,
          hospital: n.hospital,
          note: running && n.note ? { kind: n.note.kind, minutes: n.note.minutes, at: n.note.at } : null,
          removed: n.removed,
          repaired: n.repaired,
          // the cord (Refinement 3 §7): 0–1 through the lay, then 0–1 through the retract after the pop (not the STR's start)
          lay: n.state === "laying" ? Math.min(1, (t - n.layAt) / Math.max(0.001, C.layDrop + C.layPop)) : null,
          retract: running && !n.repaired && t - n.startedAt < C.layRetract ? (t - n.startedAt) / C.layRetract : null,
          elapsed: running ? self.clock - n.startedClock : 0,   // displayed seconds, still counting through overtime
          // a repaired egg is already full grown: the STR's clock doesn't shrink it
          grow: running ? (n.repaired ? 1 : Math.min(1, (self.clock - n.startedClock) / Math.max(0.001, n.boldClock - n.startedClock))) : 0,
          // after a hospital egg's RCAV its cracks go on from where they were through the restarted countdown
          sinceBold: n.state === "overtime" ? t - n.boldAt : null,   // the player's seconds since it went bold (VF's DONE)
          sinceRemoved: n.removed ? t - n.resetAt : null,             // J: the player's seconds since a hospital egg's RCAV
          crack: n.state !== "overtime" ? 0 : n.removed ? Math.min(1, n.crackAt + (1 - n.crackAt) * (t - n.resetAt) / Math.max(0.001, n.hatchAt - n.resetAt))
            : Math.min(1, (t - n.boldAt) / Math.max(0.001, n.hatchAt - n.boldAt))
        };
      })
    };
  };

  ET.Game = Game;
})(typeof window !== "undefined" ? window : globalThis);

/* ===========================================================================
   EGG TIMER — VIEW
   Draws the playfield from game snapshots and reacts to game events.
   Owns nothing about the rules: if a number matters, it came from ET.Game.

   Layout (packet §4): nests sit on a LOGICAL 4 × 3 grid, which is what decides
   neighbours, but they are drawn scattered — each cell gets a fixed, organic
   offset, so the board never reads as a visible checkerboard.
   ========================================================================= */
(function (root) {
  var ET = (root.ET = root.ET || {});

  var field, hud, banner, popups, wall;
  var nests = [];          // index = logical cell id
  var bannerTimer = null;
  var noTypesShown = false;

  function $(sel) { return document.querySelector(sel); }

  /* Fixed organic offsets per cell, from a constant seed: the same board every game. */
  function offsets() {
    var r = ET.seededRandom(1979);
    var out = [];
    for (var i = 0; i < ET.Game.COLS * ET.Game.ROWS; i++) {
      out.push({ dx: (r() * 2 - 1) * 0.14, dy: (r() * 2 - 1) * 0.07, tilt: (r() * 2 - 1) * 5 });
    }
    return out;
  }

  function two(x) { return (x < 10 ? "0" : "") + x; }

  /* A nest clock: displayed time, MM:SS since the CAV started (Timer Refinement §2). */
  function clockText(seconds) {
    var total = Math.max(0, Math.floor(seconds));
    return two(Math.floor(total / 60)) + ":" + two(total % 60);
  }

  /* Seconds past midnight → 24-hour "HH:MM", and the seconds on their own. */
  function hhmm(sec) {
    var t = Math.floor(sec);
    return two(Math.floor(t / 3600) % 24) + ":" + two(Math.floor(t / 60) % 60);
  }

  function noteText(note) {
    return note.kind === "clock" ? "Clear @ " + hhmm(note.at) : note.minutes + " min";
  }

  function popup(nestEl, text, cls) {
    var p = document.createElement("div");
    p.className = "popup " + (cls || "");
    p.textContent = text;
    var r = nestEl.getBoundingClientRect(), f = field.getBoundingClientRect();
    p.style.left = (r.left - f.left + r.width / 2) + "px";
    p.style.top = (r.top - f.top + r.height * 0.3) + "px";
    popups.appendChild(p);
    setTimeout(function () { p.remove(); }, 1100);
  }

  function showBanner(lines, ms) {
    banner.innerHTML = "";
    lines.forEach(function (l) {
      var d = document.createElement("div");
      d.className = l.cls || "";
      d.textContent = l.text;
      banner.appendChild(d);
    });
    banner.hidden = false;
    clearTimeout(bannerTimer);
    if (ms) bannerTimer = setTimeout(function () { banner.hidden = true; }, ms);
  }

  /* Restart a CSS animation on an element by swapping its class. */
  function replay(elm, base, cls) {
    elm.className = base;
    void elm.offsetWidth;
    if (cls) elm.className = base + " " + cls;
  }

  function slam(v, how) {
    v.pan.style.setProperty("--pan", ET.CONFIG.panSeconds + "s");
    v.pan.style.setProperty("--pan-delay", (how === "late" ? ET.CONFIG.hatchPanDelay : 0) + "s");
    replay(v.pan, "pan", how);
  }

  function flash(v, kind) { replay(v.fx, "fx", kind); }

  /* ⏳ placeholder: water from the hose while a drag is wiping. */
  function spray(x, y) {
    var f = field.getBoundingClientRect();
    for (var i = 0; i < 3; i++) {
      var d = document.createElement("i");
      d.className = "drop";
      d.style.left = (x - f.left + (Math.random() * 16 - 8)) + "px";
      d.style.top = (y - f.top + (Math.random() * 10 - 5)) + "px";
      d.style.setProperty("--dx", (Math.random() * 30 - 15) + "px");
      popups.appendChild(d);
      setTimeout(function (el) { el.remove(); }.bind(null, d), 450);
    }
  }

  ET.view = {
    build: function () {
      field = $("#field");
      hud = {
        wave: $("#hud-wave"), cavs: $("#hud-cavs"), pool: $("#hud-pool"),
        poolLabel: $("#hud-pool-label"), score: $("#hud-score"), mode: $("#hud-mode")
      };
      banner = $("#banner");
      popups = $("#popups");
      hud.poolLabel.textContent = ET.CONFIG.poolKey;
      wall = { hm: $("#wall-hm"), ss: $("#wall-ss") };

      var offs = offsets();
      for (var i = 0; i < ET.Game.COLS * ET.Game.ROWS; i++) {
        var col = i % ET.Game.COLS, row = Math.floor(i / ET.Game.COLS);
        var n = document.createElement("div");
        n.className = "nest";
        n.dataset.id = i;
        n.dataset.state = "idle";
        n.hidden = true;
        // padded inside the field, so an edge nest's readout never runs under the HUD or the Command Boxes
        n.style.left = (6 + (col + 0.5 + offs[i].dx) / ET.Game.COLS * 88) + "%";
        n.style.top = (7 + (row + 0.5 + offs[i].dy) / ET.Game.ROWS * 84) + "%";
        n.style.setProperty("--tilt", offs[i].tilt + "deg");

        var svg = ET.art.nestSvg();
        n.appendChild(svg);

        var ro = document.createElement("div");
        ro.className = "readout";
        ro.innerHTML = '<span class="unit">----</span><span class="code"></span><span class="clock">--:--</span>';
        n.appendChild(ro);

        // ⏳ placeholder look: the AD post-it (Timer Refinement §4)
        var note = document.createElement("div");
        note.className = "postit";
        note.hidden = true;
        n.appendChild(note);

        // ⏳ placeholder look: VF's "Clear Fueling" bubble (Timer Refinement §5)
        var bubble = document.createElement("div");
        bubble.className = "bubble";
        bubble.textContent = "Clear Fueling";
        bubble.hidden = true;
        n.appendChild(bubble);

        // ⏳ placeholder: the frying pan, and a slot for the sparkle or smoke after it (Refinement 2 §5)
        var pan = ET.art.panEl();
        n.appendChild(pan);
        var fx = document.createElement("div");
        fx.className = "fx";
        n.appendChild(fx);

        var mess = ET.mess.create();
        n.appendChild(mess);

        field.appendChild(n);
        nests.push({
          el: n, svg: svg, readout: ro, mess: mess, note: note, bubble: bubble, pan: pan, fx: fx,
          unit: ro.querySelector(".unit"), code: ro.querySelector(".code"), clock: ro.querySelector(".clock"),
          egg: svg.querySelector(".egg"), cracks: svg.querySelectorAll(".crack")
        });
      }
      ET.view.bindWipe();
    },

    reset: function () {
      nests.forEach(function (v) {
        v.el.hidden = true;
        v.el.dataset.state = "idle";
        v.el.classList.remove("bold", "hide-readout", "hide-clock", "hide-egg", "scurry", "lunge");
        ET.mess.clear(v.mess);
        ET.art.clearSplat(v.svg);
        v.note.hidden = true;
        v.bubble.hidden = true;
        v.pan.className = "pan";
        v.fx.className = "fx";
      });
      field.classList.remove("hose");
      banner.hidden = true;
      popups.innerHTML = "";
      noTypesShown = false;
    },

    render: function (snap) {
      var C = ET.CONFIG;
      hud.wave.textContent = snap.wave;
      hud.cavs.textContent = snap.resolved + "/" + snap.quota;
      hud.score.textContent = snap.score;
      var pips = "";
      for (var p = 0; p < C.poolCap; p++) pips += p < snap.pool ? "●" : "○";
      hud.pool.textContent = pips;
      wall.hm.textContent = hhmm(snap.wall);
      wall.ss.textContent = two(Math.floor(snap.wall) % 60);

      snap.nests.forEach(function (s) {
        var v = nests[s.id];
        var el = v.el;
        el.hidden = false;
        if (el.dataset.state !== s.state) el.dataset.state = s.state;

        var shows = s.state === "trigger" || s.state === "active" || s.state === "overtime";
        v.unit.textContent = shows ? s.unit : (C.unitAssignment === "per-nest" && s.unit ? s.unit : "----");
        v.code.textContent = shows ? s.code : "";
        v.clock.textContent = s.state === "active" || s.state === "overtime" ? clockText(s.elapsed) : "--:--";

        el.classList.toggle("bold", s.state === "overtime");
        // C15(b) (ruled): a running VF hides its egg and its timer until "Clear Fuel"; the unit and "VF" stay
        el.classList.toggle("hide-egg", s.hidden);
        el.classList.toggle("hide-readout", s.hidden && C.vfHides === "readout");
        el.classList.toggle("hide-clock", s.hidden && C.vfHides === "timer");

        v.note.hidden = !s.note;
        if (s.note) {
          var nt = noteText(s.note);
          if (v.note.textContent !== nt) v.note.textContent = nt;
        }

        var scale = C.eggMinScale + (1 - C.eggMinScale) * s.grow;
        var wobble = s.state === "overtime" ? Math.sin(snap.time * 38) * (3 + 6 * s.crack) : 0;
        v.egg.setAttribute("transform", "translate(0 20) rotate(" + wobble.toFixed(2) + ") scale(" + scale.toFixed(3) + ") translate(0 -20)");
        var off = String(1 - s.crack);
        for (var k = 0; k < v.cracks.length; k++) v.cracks[k].style.strokeDashoffset = off;
      });

      // ⏳ E5: the hose is the cursor during cleanup (the wipe underneath is unchanged)
      field.classList.toggle("hose", ET.CONFIG.hoseWhen === "always" || snap.phase === "cleanup");

      if (snap.phase === "cleanup") {
        var left = banner.querySelector(".left");
        if (left) left.textContent = "CLEAN UP  " + Math.ceil(snap.cleanupLeft);
      }
    },

    handle: function (events, game) {
      events.forEach(function (e) {
        var v = e.nest !== undefined ? nests[e.nest] : null;
        switch (e.type) {
          case "nest-unlocked":
            v.el.hidden = false;
            v.el.classList.remove("unlock");
            void v.el.offsetWidth;
            v.el.classList.add("unlock");
            break;
          case "wave-start":
            showBanner([{ text: "WAVE " + e.wave, cls: "big" }, { text: e.quota + " CAVs" }], 1600);
            break;
          case "wave-end":
            var lines = [{ text: "WAVE " + e.wave + " CLEAR", cls: "big" }];
            if (e.perfect) lines.push({ text: "PERFECT WAVE +" + e.bonus, cls: "good" });
            if (e.poolGained) lines.push({ text: ET.CONFIG.poolKey + " +1", cls: "good" });
            lines.push({ text: "CLEAN UP", cls: "left" });
            showBanner(lines, 0);
            break;
          case "trigger":
          case "active":
            ET.art.clearSplat(v.svg);
            v.el.classList.remove("scurry", "lunge");
            break;
          case "bold":
            // VF is the only type with a pop-up: "Clear Fueling" as its clock and cracking egg appear
            var nest = game && game.nests[e.nest];
            if (nest && nest.type && nest.type.hiddenUntilTrigger) {
              v.bubble.hidden = false;
              v.bubble.classList.remove("show");
              void v.bubble.offsetWidth;
              v.bubble.style.animationDuration = ET.CONFIG.vfBubbleSeconds + "s";
              v.bubble.classList.add("show");
            }
            break;
          case "placed":
            popup(v.el, "+" + e.points, "good");
            break;
          case "cleared":
            // the pan slams, and the egg is fried by how late the clear came (Refinement 2 §5)
            slam(v, "hit");
            ET.art.showSplat(v.svg, ET.art.FRIED[e.third] || "sunny");
            v.el.dataset.fried = ET.art.FRIED[e.third] || "sunny";
            flash(v, e.third === 0 ? "sparkle" : e.third === 2 ? "smoke" : "");
            if (ET.audio) { ET.audio.thong(); if (e.third === 0) ET.audio.ding(); }
            ET.mess.splatter(v.mess, ET.CONFIG.messBlobsOwn);
            e.neighbors.forEach(function (id) { ET.mess.splatter(nests[id].mess, ET.CONFIG.messBlobsNeighbor); });
            popup(v.el, "+" + e.points, "good");
            break;
          case "hatch":
            v.el.classList.remove("scurry", "lunge");
            void v.el.offsetWidth;
            v.el.style.setProperty("--dir", Math.random() < 0.5 ? -1 : 1);
            v.el.classList.add(ET.art.FLOURISHES[Math.floor(Math.random() * ET.art.FLOURISHES.length)]);
            // the pan comes down late, on the empty nest: look only, the hatch is already final
            slam(v, "late");
            if (ET.audio) ET.audio.clunk(ET.CONFIG.hatchPanDelay);
            hud.pool.classList.remove("hit");
            void hud.pool.offsetWidth;
            hud.pool.classList.add("hit");
            break;
          case "idle":
            v.bubble.hidden = true;
            ET.art.clearSplat(v.svg);
            v.el.classList.remove("scurry", "lunge");
            break;
          case "no-types":
            if (!noTypesShown) {
              noTypesShown = true;
              showBanner([{ text: "BLANK DATASET", cls: "big" }, { text: "NO CAV TYPES LOADED" }], 0);
            }
            break;
          case "game-over":
            banner.hidden = true;
            break;
        }
      });
    },

    hideBanner: function () { banner.hidden = true; },

    /* Click-and-drag wiping, across any nests the drag passes over. */
    bindWipe: function () {
      var last = null;
      function at(ev) {
        var hits = [];
        nests.forEach(function (v) {
          if (v.el.hidden) return;
          var r = v.mess.getBoundingClientRect();
          if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
            hits.push({ v: v, x: (ev.clientX - r.left) / r.width * ET.mess.W, y: (ev.clientY - r.top) / r.height * ET.mess.H, sx: ET.mess.W / r.width });
          }
        });
        return hits;
      }
      function wipe(ev) {
        if (field.classList.contains("hose")) spray(ev.clientX, ev.clientY);
        at(ev).forEach(function (h) {
          var from = last && last.id === h.v.el.dataset.id ? last : { x: h.x, y: h.y };
          ET.mess.wipe(h.v.mess, from.x, from.y, h.x, h.y, ET.CONFIG.wipeRadius * h.sx);
          last = { id: h.v.el.dataset.id, x: h.x, y: h.y };
        });
      }
      field.addEventListener("pointerdown", function (ev) {
        if (!ET.view.canWipe()) return;
        try { field.setPointerCapture(ev.pointerId); } catch (e) { /* synthetic pointers have no capture */ }
        field.classList.add("wiping");
        last = null;
        wipe(ev);
        ev.preventDefault();
      });
      field.addEventListener("pointermove", function (ev) {
        if (!field.classList.contains("wiping")) return;
        wipe(ev);
      });
      function end(ev) {
        if (!field.classList.contains("wiping")) return;
        field.classList.remove("wiping");
        last = null;
        if (ET.boxes) ET.boxes.focus();
      }
      field.addEventListener("pointerup", end);
      field.addEventListener("pointercancel", end);
    },

    canWipe: function () { return true; },

    /* For rigs: a nest's view pieces. */
    nest: function (id) { return nests[id]; }
  };
})(window);

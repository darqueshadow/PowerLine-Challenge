/* ===========================================================================
   driveinsert.js — A DISK GOES INTO THE DRIVE.

   🆕 2026-09-16, his addendum (plc_c64_ui_addendum.md, pasted into
   Brief_Real-C64-Typing_2026-09-16.md): on the real C64 corner, Insert Disk no
   longer plays the NOAH COLLECTIVE crack intro. It plays "an animation of a
   physical C64 disk sliding into a C64 disk drive — a mechanical load
   animation rather than the branded crack-intro screen".
   ⚠️ The crack intro was HIS ruling (every load, not flag-gated), and the
   addendum replaces it for THIS CORNER ONLY: a cabinet's launch still plays it
   (cat.js, introThenLaunch), and so does the ordinary hub's load theatre.

   ⭐ A TAPE GETS A TAPE. 63 of the 108 images are .T64 tapes, and a floppy
   sliding into a disk drive in front of a tape load would be the one lie on a
   screen that is otherwise the real machine. So the same beat plays with a
   cassette dropping into a datasette.
   🔄 2026-10-04 — and since Phase 4 that is the REAL Datasette in the corner's
   bay (CAT_DRIVE.tape, at the end of this file), not a drawn scene over the
   screen: play() no longer draws anything for a tape.

   🚫 No literal Commodore branding (core spec): the datasette says DATASETTE.
   🔄 2026-10-03 — the drive is now the 1541 artwork, with the C= logo and the
   wordmark PAINTED OUT; the rainbow stripes and "1541" stay "for now" (his ruling).

   Same contract as crackintro.js, deliberately, because cat.js chains the
   insert off it: play() NEVER rejects, always removes itself, and any key or
   click skips it (the fiftieth insert must cost one keypress).
   ========================================================================= */
(function () {
  "use strict";

  var REDUCED = window.matchMedia &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  /* the whole beat: slide in, latch, the drive light comes on */
  var HOLD_MS = REDUCED ? 450 : 1900;
  var NS = "http://www.w3.org/2000/svg";

  function svg(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(n);
    return n;
  }
  function label(name) {
    var s = String(name || "").toUpperCase();
    return s.length > 16 ? s.slice(0, 15) + "…" : s;
  }

  /* 🔄 2026-10-03 — THE 1541 ARTWORK (Chat's brief, his rulings of the same day).
     ONE set of art for the drive bay in the detail panel AND this scene, so the
     two can never drift: drive/drive-body.png, drive-latch.png and drive-cover.png,
     three layers on one 800 x 367 canvas, made from the two Gemini images (latch
     up = master, latch down = the latch box only). Built by
     Documents/Asset Packs/1541 drive/build.py, which also paints the logo and the
     wordmark out (🚫 never commit art that still carries them: Game/ is public).
     ⭐ Every colour, timing and measured position lives HERE, in DRIVE_ART, and
     reaches the CSS as custom properties — cat.css and cat.js hold no copies. */
  var DRIVE_ART = {
    /* measured off the art, in its own 800 x 367 pixels */
    art: { width: 800, height: 367, travel: 40.79,
           leds: { power: { x: 63.22, y: 275.77, r: 13.25 }, activity: { x: 202.62, y: 274.75, r: 11.24 } } },
    /* 🚫 The latch SLIDES, straight up and down. No rotation, no tilt (his ruling). */
    latch: { dropMs: 340, liftMs: 280, settle: 0.08, swapPauseMs: 380, coverMs: 120, coverInDelayMs: 170 },
    /* green = power, steady; red = activity, solid; red blinking = a DOS error */
    leds: { powerOn: "#3fbf5f", powerOff: "#1d2e21", activityOn: "#ff4a3a", activityOff: "#35140f", blinkMs: 1000 }
  };
  (function applyArt() {
    var A = DRIVE_ART.art, r = document.documentElement.style;
    var pct = function (v, of) { return (v / of * 100) + "%"; };
    r.setProperty("--drive-travel", pct(A.travel, A.height));
    r.setProperty("--drive-travel-u", String(A.travel));
    [["power", A.leds.power], ["act", A.leds.activity]].forEach(function (p) {
      r.setProperty("--drive-led-" + p[0] + "-x", pct(p[1].x, A.width));
      r.setProperty("--drive-led-" + p[0] + "-y", pct(p[1].y, A.height));
      /* a little wider than the hole, so the ring overlaps the lamp's edge */
      r.setProperty("--drive-led-" + p[0] + "-d", pct(2 * p[1].r + 3, A.width));
    });
    var L = DRIVE_ART.latch;
    r.setProperty("--latch-drop-ms", L.dropMs + "ms");
    r.setProperty("--latch-lift-ms", L.liftMs + "ms");
    r.setProperty("--latch-settle", String(L.settle));
    r.setProperty("--latch-cover-ms", L.coverMs + "ms");
    r.setProperty("--latch-cover-delay", L.coverInDelayMs + "ms");
    var C = DRIVE_ART.leds;
    r.setProperty("--led-power-on", C.powerOn);
    r.setProperty("--led-power-off", C.powerOff);
    r.setProperty("--led-act-on", C.activityOn);
    r.setProperty("--led-act-off", C.activityOff);
    r.setProperty("--led-blink-ms", C.blinkMs + "ms");
  })();

  /* The drive, and a 5¼" disk above its slot. The disk is clipped at the slot
     line, so it vanishes INTO the slot rather than behind the drive; then the
     latch slides down across it and the red light comes on. */
  var TOP = 340;                        /* room above the drive for the disk */
  var SLOT = TOP + 211;                 /* the middle of the slot, in the art */
  function diskScene(name) {
    var A = DRIVE_ART.art;
    var s = svg("svg", { viewBox: "0 0 " + A.width + " " + (TOP + A.height), class: "drive-scene drive-scene--1541", role: "img", "aria-hidden": "true" });
    var defs = svg("defs", {}, s);
    var clip = svg("clipPath", { id: "drive-slot-clip" }, defs);
    svg("rect", { x: "0", y: "-400", width: String(A.width), height: String(SLOT + 400) }, clip);   /* everything above the slot */

    /* the lamps sit BEHIND the body, showing through its two holes */
    svg("circle", { cx: String(A.leds.power.x), cy: String(TOP + A.leds.power.y), r: String(A.leds.power.r + 1.5), class: "drive-led drive-led--power" }, s);
    svg("circle", { cx: String(A.leds.activity.x), cy: String(TOP + A.leds.activity.y), r: String(A.leds.activity.r + 1.5), class: "drive-led" }, s);
    var art = function (file, cls) {
      return svg("image", { href: "drive/" + file, x: "0", y: String(TOP), width: String(A.width), height: String(A.height), class: cls || "" }, s);
    };
    art("drive-body.png");

    var D = SLOT - 330;                 /* the disk hovers 30 above the slot */
    var disk = svg("g", { class: "drive-disk", "clip-path": "url(#drive-slot-clip)" }, s);
    var body = svg("g", { class: "drive-disk__body" }, disk);
    svg("rect", { x: "250", y: String(D), width: "300", height: "300", rx: "10", fill: "#15131d" }, body);
    svg("rect", { x: "288", y: String(D + 33), width: "224", height: "70", rx: "4", fill: "#f4eedb" }, body);
    svg("rect", { x: "288", y: String(D + 33), width: "224", height: "12", fill: "#d9534f" }, body);
    var t = svg("text", { x: "400", y: String(D + 87), "text-anchor": "middle", class: "drive-label" }, body);
    t.textContent = label(name);
    svg("circle", { cx: "400", cy: String(D + 170), r: "36", fill: "#3a344c" }, body);
    svg("circle", { cx: "400", cy: String(D + 170), r: "16", fill: "#0a0910" }, body);
    svg("rect", { x: "386", y: String(D + 216), width: "28", height: "66", rx: "14", fill: "#0a0910" }, body);

    art("drive-cover.png", "drive-cover");
    art("drive-latch.png", "drive-latch");
    return s;
  }

  /* -----------------------------------------------------------------------
     🔄 2026-10-05 — NOTHING CALLS play() NOW. A disk plays the real 1541 in the
     corner (CAT_DRIVE.disk, below) and a tape the real Datasette; this scene
     over the screen, and its CSS (.drive-insert, .drive-scene), are left for a
     separate clean-up rather than removed in the redesign's change.
     play(disk, { medium, host }) — resolves "played" or "skipped", NEVER rejects,
     and never leaves itself on screen. `host` is where it sits: cat.js puts it
     over the C64's screen, so the rest of the room stays in view.
     --------------------------------------------------------------------- */
  function play(disk, opts) {
    opts = opts || {};
    var medium = opts.medium === "tape" ? "tape" : "disk";
    var host = opts.host || document.body;
    /* 🔄 2026-10-04 — a TAPE no longer gets a scene over the screen: the real
       Datasette in the bay plays it (CAT_DRIVE.tape.insert, below). */
    if (medium === "tape") return Promise.resolve("skipped");
    return new Promise(function (resolve) {
      var root = document.createElement("div");
      root.id = "drive-insert";
      root.className = "drive-insert drive-insert--" + medium;
      root.setAttribute("aria-hidden", "true");
      root.appendChild(diskScene(disk && disk.displayName));
      host.appendChild(root);

      var done = false, timer = 0;
      function finish(how) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        document.removeEventListener("keydown", onKey, true);
        root.removeEventListener("click", onClick, true);
        root.classList.add("out");
        setTimeout(function () {
          if (root.parentNode) root.parentNode.removeChild(root);
          resolve(how);
        }, REDUCED ? 0 : 220);
      }
      /* 🚨 Capture phase, for the reason crackintro.js gives: otherwise the
         skip key also reaches the hub's own handler behind the overlay. */
      function onKey(e) {
        if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") return;
        e.preventDefault();
        e.stopPropagation();
        finish("skipped");
      }
      function onClick(e) { e.preventDefault(); e.stopPropagation(); finish("skipped"); }
      document.addEventListener("keydown", onKey, true);
      root.addEventListener("click", onClick, true);
      timer = setTimeout(function () { finish("played"); }, HOLD_MS);
    });
  }

  /* =======================================================================
     🆕 2026-10-04 — THE DATASETTE (his rulings, Phase 4 Step 2). The real one in
     the corner's bay, not a scene over the screen.
       Insert Tape: the EJECT key goes down, the lid lifts TOWARD THE VIEWER
         (hinged along its top edge, the bottom edge coming forward and up to
         ~45°, BASE's well showing below it), the cassette RISES FROM BELOW into
         the bay, the lid closes, the key comes back up.
       Eject (ends game): the lid lifts, the tape leaves DOWNWARD, the lid closes.
         A disk inserted over a tape plays this first (his rulings, 2026-10-04).
       While a tape LOAD runs (emu.js says so: cat:tapemotor), PLAY goes down
         (playLeadMs before anything turns) and stays down; the hubs turn
         (the cassette's white toothed hubs, and the black spindles seen through
         them) and the counter's three wheels count up. It is TIME-BASED: the
         core tells JS nothing about the tape itself (measured 2026-10-04). It
         stops at the end of the load or on eject, keeps its value, wraps 999 to
         000, and only its small button sets it back to 000.
     ⭐ Every measured position, timing and rate lives HERE and reaches the CSS
     as custom properties, like DRIVE_ART. Positions are fractions of the
     Datasette's box, from Documents/Asset Packs/Datasette/build.py (meta.json). */
  var DATASETTE = {
    art: {
      aspect: 1.83333,
      cassette: { left: 0.15038, top: 0.11433, width: 0.48349, height: 0.48349 },
      hubs: [[0.2898, 0.4974], [0.7092, 0.4974]],     /* in the cassette's box */
      hubD: 0.17756,                                   /* of the cassette's width */
      spindles: [[0.29048, 0.35482], [0.49325, 0.35482]],
      spindleD: 0.06392,
      lamp: [0.74503, 0.68294, 0.7745, 0.73763],
      wheels: [0.69957, 0.49609, 0.77379, 0.54818],
      reset: [0.79865, 0.49414, 0.82564, 0.55078],
      hingeY: 0.09505
    },
    timing: { keyMs: 140, lidOpenMs: 420, riseMs: 460, lowerMs: 400, lidCloseMs: 360, gapMs: 90, resetPressMs: 140,
              /* 🆕 PLAY goes down this long BEFORE the counter and the hubs start */
              playLeadMs: 240 },
    keyTravel: 0.014,          /* the EJECT key goes down this much of the box's height */
    lidDeg: 45,
    hubTurnMs: 1600,           /* one turn of the hubs while a load runs */
    countsPerSec: 2.2          /* the counter while a load runs */
  };
  (function applyDatasette() {
    var A = DATASETTE.art, T = DATASETTE.timing, r = document.documentElement.style;
    var p = function (v) { return (v * 100) + "%"; };
    var c = A.cassette;
    r.setProperty("--ds-aspect", String(A.aspect));
    r.setProperty("--ds-cass-l", p(c.left)); r.setProperty("--ds-cass-t", p(c.top));
    r.setProperty("--ds-cass-w", p(c.width)); r.setProperty("--ds-cass-h", p(c.height));
    /* the cassette starts (and leaves) clear BELOW the box: from its top to the box's bottom */
    r.setProperty("--ds-cass-below", p((1 - c.top) / c.height + 0.05));
    r.setProperty("--ds-hub-d", p(A.hubD));
    A.hubs.forEach(function (h, i) { r.setProperty("--ds-hub" + i + "-x", p(h[0])); r.setProperty("--ds-hub" + i + "-y", p(h[1])); });
    r.setProperty("--ds-spin-d", p(A.spindleD));
    A.spindles.forEach(function (s, i) { r.setProperty("--ds-spin" + i + "-x", p(s[0])); r.setProperty("--ds-spin" + i + "-y", p(s[1])); });
    [["lamp", A.lamp], ["wheels", A.wheels], ["reset", A.reset]].forEach(function (b) {
      r.setProperty("--ds-" + b[0] + "-l", p(b[1][0])); r.setProperty("--ds-" + b[0] + "-t", p(b[1][1]));
      r.setProperty("--ds-" + b[0] + "-w", p(b[1][2] - b[1][0])); r.setProperty("--ds-" + b[0] + "-h", p(b[1][3] - b[1][1]));
    });
    r.setProperty("--ds-hinge-y", p(A.hingeY));
    /* 🔄 2026-10-04 — POSITIVE: rotateX(+a) brings the bottom edge TOWARD the
       viewer (it went away, into the machine, at -45°: his correction) */
    r.setProperty("--ds-lid-deg", DATASETTE.lidDeg + "deg");
    r.setProperty("--ds-key-travel", p(DATASETTE.keyTravel));
    var ms = function (v) { return (REDUCED ? 0 : v) + "ms"; };
    r.setProperty("--ds-key-ms", ms(T.keyMs));
    r.setProperty("--ds-lid-open-ms", ms(T.lidOpenMs));
    r.setProperty("--ds-lid-close-ms", ms(T.lidCloseMs));
    r.setProperty("--ds-rise-ms", ms(T.riseMs));
    r.setProperty("--ds-lower-ms", ms(T.lowerMs));
    r.setProperty("--ds-hub-turn-ms", DATASETTE.hubTurnMs + "ms");
  })();

  var tape = (function () {
    var el = function (id) { return document.getElementById(id); };
    var box = el("datasette"), cass = el("datasette-tape"), label = el("datasette-label");
    var wheels = box ? box.querySelectorAll(".datasette__wheel-strip") : [];
    var LABEL_PX = { max: 13, min: 5 };
    var st = { busy: false, motor: false, play: false, count: 0, trace: [], lid: "closed", key: false, skip: null };
    var playTimer = 0;
    var T = DATASETTE.timing;
    var wait = function (msv) {
      return new Promise(function (res) {
        if (REDUCED || st.skip) { res(); return; }
        var t = setTimeout(res, msv);
        st.onSkip = function () { clearTimeout(t); res(); };
      });
    };
    var mark = function (what) { st.trace.push(what); };
    var shown = function () { return !!(box && box.getBoundingClientRect().width > 0); };

    /* the largest size that fits the label's box both ways; measured, not guessed */
    function fitLabel() {
      if (!label || !label.clientWidth) return;
      var px = LABEL_PX.max;
      label.style.fontSize = px + "px";
      while (px > LABEL_PX.min && (label.scrollHeight > label.clientHeight + 1 || label.scrollWidth > label.clientWidth + 1)) {
        px -= 0.5;
        label.style.fontSize = px + "px";
      }
    }
    if (label && window.ResizeObserver) new ResizeObserver(function () { if (!cass.hidden) fitLabel(); }).observe(label);

    function setLabel(name) {
      if (label.textContent !== name) label.textContent = name;
      if (!cass.hidden) fitLabel();
    }
    function lid(open) { st.lid = open ? "open" : "closed"; box.classList.toggle("is-open", open); }
    function keyDown(on) { st.key = on; box.classList.toggle("is-key", on); }
    function below(on) { cass.classList.toggle("is-below", on); }

    /* no animation: the state the hub's paint asks for (insert done, power off …) */
    function present(on, name) {
      if (!box || st.busy) return;
      cass.hidden = !on;
      below(false);
      setLabel(on ? String(name || "") : "");
      if (!on) motor(false);
    }

    /* a key or a click during a sequence jumps it to its end, as play() always allowed */
    function skippable() {
      st.skip = null;
      var go = function () { st.skip = true; box.classList.add("is-snap"); if (st.onSkip) st.onSkip(); };
      var onKey = function (e) { if (/^(Shift|Control|Alt|Meta)$/.test(e.key)) return; go(); };
      document.addEventListener("keydown", onKey, true);
      box.addEventListener("click", go, true);
      return function () {
        document.removeEventListener("keydown", onKey, true);
        box.removeEventListener("click", go, true);
        st.skip = null; st.onSkip = null;
        setTimeout(function () { box.classList.remove("is-snap"); }, 30);
      };
    }

    /* the tape goes DOWN, out of the bottom of the box */
    function leave() {
      mark("out");
      cass.classList.add("is-lowering");
      below(true);
      return wait(T.lowerMs).then(function () { cass.hidden = true; cass.classList.remove("is-lowering"); below(false); setLabel(""); });
    }

    function insert(name) {
      if (!box || !shown() || st.busy) { present(true, name); return Promise.resolve("skipped"); }
      st.busy = true; st.trace = [];
      motor(false);
      var done = skippable();
      var hadTape = !cass.hidden;
      mark("key"); keyDown(true);
      return wait(T.keyMs)
        .then(function () { mark("open"); lid(true); return wait(T.lidOpenMs); })
        .then(function () { return hadTape ? leave().then(function () { return wait(T.gapMs); }) : null; })
        .then(function () {
          mark("in");
          /* placed below the box with no transition, then risen into the bay */
          box.classList.add("is-snap");
          below(true); cass.hidden = false; setLabel(String(name || ""));
          void cass.offsetWidth;
          box.classList.remove("is-snap");
          void cass.offsetWidth;
          below(false);
          return wait(T.riseMs);
        })
        .then(function () { return wait(T.gapMs); })
        .then(function () { mark("close"); lid(false); return wait(T.lidCloseMs); })
        .then(function () { mark("keyup"); keyDown(false); return wait(T.keyMs); })
        .then(function () { done(); st.busy = false; return "played"; },
              function () { done(); st.busy = false; return "played"; });
    }

    function eject() {
      if (!box || cass.hidden) { present(false); return Promise.resolve("skipped"); }
      motor(false);
      if (!shown() || st.busy) { st.busy = false; present(false); return Promise.resolve("skipped"); }
      st.busy = true; st.trace = [];
      var done = skippable();
      mark("open"); lid(true);
      return wait(T.lidOpenMs)
        .then(function () { return leave(); })
        .then(function () { return wait(T.gapMs); })
        .then(function () { mark("close"); lid(false); return wait(T.lidCloseMs); })
        .then(function () { done(); st.busy = false; return "played"; },
              function () { done(); st.busy = false; return "played"; });
    }

    /* ---- the hubs and the counter ------------------------------------------ */
    var raf = 0, last = 0;
    function paintCounter() {
      var v = st.count;
      var u = v % 10, t = Math.floor(v / 10) % 10, h = Math.floor(v / 100) % 10;
      /* an odometer: a wheel rolls on only while the one to its right goes 9 -> 0 */
      var carryT = u > 9 ? u - 9 : 0, carryH = (v % 100) > 99 ? (v % 100) - 99 : 0;
      [h + carryH, t + carryT, u].forEach(function (pos, i) {
        if (wheels[i]) wheels[i].style.transform = "translateY(" + (-pos * 100 / 11) + "%)";
      });
      box.dataset.count = String(Math.floor(v) % 1000).padStart(3, "0");
    }
    function tick(now) {
      if (!st.motor) { raf = 0; return; }
      var dt = last ? Math.min(0.25, (now - last) / 1000) : 0;
      last = now;
      st.count = (st.count + dt * DATASETTE.countsPerSec) % 1000;
      paintCounter();
      raf = requestAnimationFrame(tick);
    }
    /* 🆕 PLAY: down first, then (playLeadMs later) the hubs and the counter; up
       again the moment the load stops, or when Eject lifts the lid */
    function playKey(on) { st.play = on; box.classList.toggle("is-play", on); }
    function motor(on) {
      on = !!on && !!box && !cass.hidden;
      if (on === st.motor) return;
      st.motor = on;
      clearTimeout(playTimer);
      if (on) {
        playKey(true);
        playTimer = setTimeout(function () {
          if (!st.motor) return;
          box.classList.add("is-spinning");
          last = 0; if (!raf) raf = requestAnimationFrame(tick);
        }, REDUCED ? 0 : T.playLeadMs);
      } else {
        box.classList.remove("is-spinning");
        playKey(false);
        /* the wheels come to rest on a whole number, as real ones do */
        st.count = Math.floor(st.count) % 1000;
        paintCounter();
      }
    }
    function resetCounter() {
      if (!box) return;
      st.count = 0;
      paintCounter();
      box.classList.add("is-reset");
      setTimeout(function () { box.classList.remove("is-reset"); }, T.resetPressMs);
    }
    if (box) {
      var btn = el("datasette-reset");
      /* the deck's rule: a button must not take focus on mousedown, or Space presses it again */
      btn.addEventListener("mousedown", function (e) { e.preventDefault(); });
      btn.addEventListener("click", function () { resetCounter(); });
      paintCounter();
    }

    return {
      present: present, insert: insert, eject: eject, motor: motor, resetCounter: resetCounter,
      busy: function () { return st.busy; }, fit: fitLabel,
      /* RIG-ONLY: verify-c64 sets the counter near 999 to see it wrap to 000.
         🚫 Nothing in the hub calls it. */
      rigCount: function (n) { st.count = (Number(n) || 0) % 1000; paintCounter(); },
      state: function () {
        return { tape: !!(cass && !cass.hidden), name: label ? label.textContent : "", lid: st.lid, key: st.key, play: st.play, busy: st.busy,
                 spinning: st.motor && box.classList.contains("is-spinning"), count: Math.floor(st.count) % 1000, shown: box ? box.dataset.count : "", trace: st.trace.slice() };
      }
    };
  })();

  /* =======================================================================
     🆕 2026-10-05 — THE DISK, AS AN ANIMATION ONLY (his redesign, Phase 4b).
     No disk rests on the page: it is drawn only while it moves, in the corner's
     real 1541 (index.html #drive-diskwin), never over the screen.
       Insert Disk: it RISES FROM BELOW the drive, oval read/write end first, to
         the slot, then SLIDES IN; cat.js then drops the latch.
       Eject (ends game): cat.js lifts the latch, then it SLIDES OUT downward
         and is gone.
       A swap plays the outgoing item's eject first (cat.js orders it).
     ⭐ The sprite is the art turned 180° (cat.css .disk-sprite) with the label's
     printed name and "Disk 1 of 2" / "Side A" INSIDE it, so they turn together:
     the label sits bottom-left, upside down. The name is printed in code and
     fitted (shrinks, then wraps, never clips), like the cassette's.
     ⭐ Measured positions, sizes and timings live HERE and reach the CSS as custom
     properties, like DATASETTE. Where a cassette timing fits, it is reused. */
  var DISK = {
    aspect: 0.94394,                                  /* the art's width / height (meta.json) */
    label: [0.35153, 0.03888, 0.9272, 0.29295],       /* the cream sticker, in the UNturned art */
    inset: [0.03, 0.026],                             /* in from its rounded corners and edges */
    /* the name's size range. 📏 The library's longest name (42 characters) with
       "Disk 1 of 2" fits at ~6 px on the rig's disk; the floor only stops the loop.
       "Never clip" wins over legible: the line under the 1541 has the name whole. */
    px: { max: 13, min: 2 },
    /* on the 1541's 800 x 367 art: the slot's middle row, and its middle column
       (the slit runs ~16%-84% of the width) */
    slot: { y: 211 / 367, x: 0.5 },
    width: 0.6,                /* of the 1541's width: a 5¼" disk just inside the slit */
    timing: {
      riseMs: DATASETTE.timing.riseMs,     /* up from below to the slot: the cassette's rise */
      gapMs: DATASETTE.timing.gapMs,       /* the pause at the slot, both ways */
      lowerMs: DATASETTE.timing.lowerMs,   /* out of sight downward: the cassette's leaving */
      slideMs: 360,                        /* 🆕 into the slot, pushed */
      pullMs: 320                          /* 🆕 out of the slot, pulled */
    }
  };
  (function applyDisk() {
    var r = document.documentElement.style, L = DISK.label, I = DISK.inset, T = DISK.timing;
    var ms = function (v) { return (REDUCED ? 0 : v) + "ms"; };
    r.setProperty("--fl-aspect", String(DISK.aspect));
    r.setProperty("--fl-label-l", String(L[0] + I[0]));
    r.setProperty("--fl-label-t", String(L[1] + I[1]));
    r.setProperty("--fl-label-w", String(L[2] - L[0] - 2 * I[0]));
    r.setProperty("--fl-label-h", String(L[3] - L[1] - 2 * I[1]));
    r.setProperty("--dk-slot-y", (DISK.slot.y * 100) + "%");
    r.setProperty("--dk-slot-x", (DISK.slot.x * 100) + "%");
    r.setProperty("--dk-w", (DISK.width * 100) + "%");
    r.setProperty("--dk-rise-ms", ms(T.riseMs));
    r.setProperty("--dk-slide-ms", ms(T.slideMs));
    r.setProperty("--dk-pull-ms", ms(T.pullMs));
    r.setProperty("--dk-lower-ms", ms(T.lowerMs));
  })();

  var disk = (function () {
    var el = function (id) { return document.getElementById(id); };
    var win = el("drive-diskwin"), sprite = el("drive-disk"), label = el("disk-label"),
        nameEl = el("disk-name"), sideEl = el("disk-side"), drive = el("drive-1541");
    var T = DISK.timing;
    var st = { busy: false, phase: "gone", trace: [], skip: null, onSkip: null, room: null };
    var mark = function (what) { st.trace.push(what); };
    var wait = function (msv) {
      return new Promise(function (res) {
        if (REDUCED || st.skip) { res(); return; }
        var t = setTimeout(res, msv);
        st.onSkip = function () { clearTimeout(t); res(); };
      });
    };
    var shown = function () { return !!(drive && drive.getBoundingClientRect().width > 0); };

    /* the largest size at which the name AND the side line fit the sticker both
       ways; measured, not guessed. A rotation does not change clientWidth, so
       the turned label measures as the unturned one. */
    function fit() {
      if (!label || !label.clientWidth) return;
      var px = DISK.px.max;
      label.style.fontSize = px + "px";
      while (px > DISK.px.min && (label.scrollHeight > label.clientHeight + 1 || label.scrollWidth > label.clientWidth + 1)) {
        px -= 0.25;
        label.style.fontSize = px + "px";
      }
    }
    function setLabel(name, side) {
      nameEl.textContent = String(name || "");
      sideEl.textContent = String(side || "");
    }
    /* 📏 THE ROOM: from the slot's line down to the bottom of the left column
       (or of the window, if that is higher). Measured on every sequence. */
    function measure() {
      var d = drive.getBoundingClientRect();
      var col = drive.closest("#crates") || document.body;
      var bottom = Math.min(col.getBoundingClientRect().bottom, document.documentElement.clientHeight);
      var slotY = d.top + d.height * DISK.slot.y;
      var h = Math.max(0, Math.round(bottom - slotY));
      win.style.setProperty("--dk-win-h", h + "px");
      var diskH = d.width * DISK.width / DISK.aspect;
      st.room = { below: h, disk: Math.round(diskH), short: Math.max(0, Math.round(diskH - h)) };
    }
    function at(phase, how) {
      sprite.classList.remove("is-ready", "is-below", "is-rising", "is-pulling", "is-lowering");
      if (how) sprite.classList.add(how);
      if (phase === "ready") sprite.classList.add("is-ready");
      if (phase === "below") sprite.classList.add("is-below");
      st.phase = phase;
    }
    function snapTo(phase) {
      sprite.classList.add("is-snap");
      at(phase);
      void sprite.offsetWidth;
      sprite.classList.remove("is-snap");
      void sprite.offsetWidth;
    }
    /* a key or a click during a sequence jumps it to its end, as play() always allowed */
    function skippable() {
      st.skip = null;
      var go = function () { st.skip = true; sprite.classList.add("is-snap"); if (st.onSkip) st.onSkip(); };
      var onKey = function (e) { if (/^(Shift|Control|Alt|Meta)$/.test(e.key)) return; go(); };
      document.addEventListener("keydown", onKey, true);
      drive.addEventListener("click", go, true);
      return function () {
        document.removeEventListener("keydown", onKey, true);
        drive.removeEventListener("click", go, true);
        st.skip = null; st.onSkip = null;
        sprite.classList.remove("is-snap");
      };
    }
    function finish(done) {
      return function () { win.hidden = true; at("gone"); done(); st.busy = false; return "played"; };
    }

    /* below -> ready (rises) -> in (slides up into the slot) -> gone */
    function insert(name, side) {
      if (!win || !shown() || st.busy) return Promise.resolve("skipped");
      st.busy = true; st.trace = [];
      setLabel(name, side);
      measure();
      win.hidden = false;
      fit();
      snapTo("below");
      var done = skippable();
      mark("rise"); at("ready", "is-rising");
      return wait(T.riseMs)
        .then(function () { return wait(T.gapMs); })
        .then(function () { mark("in"); at("in"); return wait(T.slideMs); })
        .then(finish(done), finish(done));
    }
    /* in -> ready (slides out of the slot) -> below (leaves downward) -> gone */
    function eject(name, side) {
      if (!win || !shown() || st.busy) return Promise.resolve("skipped");
      st.busy = true; st.trace = [];
      setLabel(name, side);
      measure();
      win.hidden = false;
      fit();
      snapTo("in");
      var done = skippable();
      mark("out"); at("ready", "is-pulling");
      return wait(T.pullMs)
        .then(function () { return wait(T.gapMs); })
        .then(function () { mark("down"); at("below", "is-lowering"); return wait(T.lowerMs); })
        .then(finish(done), finish(done));
    }

    function state() {
      var turn = sprite && sprite.firstElementChild ? getComputedStyle(sprite.firstElementChild).rotate : "";
      return { shown: !!(win && !win.hidden), phase: st.phase, busy: st.busy, trace: st.trace.slice(),
               name: nameEl ? nameEl.textContent : "", side: sideEl ? sideEl.textContent : "",
               px: label ? parseFloat(label.style.fontSize) || 0 : 0, turn: turn,
               clipped: !!(label && label.clientWidth && (label.scrollHeight > label.clientHeight + 1 || label.scrollWidth > label.clientWidth + 1)),
               room: st.room };
    }
    return {
      insert: insert, eject: eject, fit: fit, state: state,
      busy: function () { return st.busy; },
      /* RIG-ONLY: print a label without a sequence, to measure its fitting; the
         sprite is shown only for the measuring. 🚫 Nothing in the hub calls it. */
      rigLabel: function (name, side) {
        if (st.busy) return null;
        win.hidden = false; measure(); setLabel(name, side); fit();
        var s = state(); win.hidden = true; return s;
      }
    };
  })();

  window.CAT_DRIVE = { play: play, holdMs: HOLD_MS, art: DRIVE_ART, tape: tape, datasette: DATASETTE, disk: disk, diskArt: DISK };
})();

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

  /* A datasette from the front: the cassette drops into the open door, the
     door shuts, and PLAY goes down. */
  function tapeScene(name) {
    var s = svg("svg", { viewBox: "0 0 400 250", class: "drive-scene", role: "img", "aria-hidden": "true" });
    var defs = svg("defs", {}, s);
    var g = svg("linearGradient", { id: "tape-case", x1: "0", y1: "0", x2: "0", y2: "1" }, defs);
    svg("stop", { offset: "0", "stop-color": "#efe6c6" }, g);
    svg("stop", { offset: "1", "stop-color": "#c9bd92" }, g);
    var clip = svg("clipPath", { id: "tape-door-clip" }, defs);
    svg("rect", { x: "0", y: "-200", width: "400", height: "374" }, clip);

    svg("rect", { x: "40", y: "96", width: "320", height: "142", rx: "10", fill: "url(#tape-case)" }, s);
    svg("rect", { x: "92", y: "110", width: "216", height: "72", rx: "5", fill: "#2b2433" }, s);

    var cass = svg("g", { class: "drive-disk", "clip-path": "url(#tape-door-clip)" }, s);
    var body = svg("g", { class: "drive-disk__body" }, cass);
    svg("rect", { x: "112", y: "40", width: "176", height: "112", rx: "6", fill: "#1b1924" }, body);
    svg("rect", { x: "124", y: "50", width: "152", height: "30", rx: "2", fill: "#f4eedb" }, body);
    var t = svg("text", { x: "200", y: "70", "text-anchor": "middle", class: "drive-label" }, body);
    t.textContent = label(name);
    svg("rect", { x: "140", y: "92", width: "120", height: "34", rx: "8", fill: "#0a0910" }, body);
    svg("circle", { cx: "163", cy: "109", r: "10", fill: "#e8e2cf" }, body);
    svg("circle", { cx: "237", cy: "109", r: "10", fill: "#e8e2cf" }, body);

    svg("rect", { x: "92", y: "110", width: "216", height: "72", rx: "5", class: "drive-door" }, s);

    var keys = ["REC", "PLAY", "REW", "FF", "STOP"];
    keys.forEach(function (k, i) {
      var key = svg("g", { class: "drive-key" + (k === "PLAY" ? " drive-key--play" : "") }, s);
      svg("rect", { x: String(92 + i * 44), y: "194", width: "40", height: "24", rx: "3", fill: "#3a3226" }, key);
      var kt = svg("text", { x: String(112 + i * 44), y: "210", "text-anchor": "middle", class: "drive-keylabel" }, key);
      kt.textContent = k;
    });
    var name1 = svg("text", { x: "56", y: "232", class: "drive-model" }, s);
    name1.textContent = "DATASETTE";
    return s;
  }

  /* -----------------------------------------------------------------------
     play(disk, { medium, host }) — resolves "played" or "skipped", NEVER rejects,
     and never leaves itself on screen. `host` is where it sits: cat.js puts it
     over the C64's screen, so the rest of the room stays in view.
     --------------------------------------------------------------------- */
  function play(disk, opts) {
    opts = opts || {};
    var medium = opts.medium === "tape" ? "tape" : "disk";
    var host = opts.host || document.body;
    return new Promise(function (resolve) {
      var root = document.createElement("div");
      root.id = "drive-insert";
      root.className = "drive-insert drive-insert--" + medium;
      root.setAttribute("aria-hidden", "true");
      root.appendChild(medium === "tape" ? tapeScene(disk && disk.displayName) : diskScene(disk && disk.displayName));
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

  window.CAT_DRIVE = { play: play, holdMs: HOLD_MS, art: DRIVE_ART };
})();

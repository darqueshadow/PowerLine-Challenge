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

   🚫 No literal Commodore branding (core spec): the drive says DISK DRIVE, the
   datasette says DATASETTE, and neither carries a maker's name.

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

  /* A 1541-shaped drive seen from the front, and a 5¼" disk above its slot.
     The disk is clipped at the slot line, so it vanishes INTO the slot rather
     than behind the drive; then the latch turns down and the light comes on. */
  function diskScene(name) {
    var s = svg("svg", { viewBox: "0 0 400 250", class: "drive-scene", role: "img", "aria-hidden": "true" });
    var defs = svg("defs", {}, s);
    var g = svg("linearGradient", { id: "drive-case", x1: "0", y1: "0", x2: "0", y2: "1" }, defs);
    svg("stop", { offset: "0", "stop-color": "#efe6c6" }, g);
    svg("stop", { offset: "1", "stop-color": "#c9bd92" }, g);
    var clip = svg("clipPath", { id: "drive-slot-clip" }, defs);
    svg("rect", { x: "0", y: "-200", width: "400", height: "366" }, clip);   /* everything above the slot */

    svg("rect", { x: "18", y: "112", width: "364", height: "126", rx: "10", fill: "url(#drive-case)" }, s);
    svg("rect", { x: "18", y: "112", width: "364", height: "8", rx: "4", fill: "#fff7dc", opacity: ".7" }, s);
    svg("rect", { x: "38", y: "136", width: "324", height: "58", rx: "6", fill: "#4d4230" }, s);
    svg("rect", { x: "112", y: "160", width: "176", height: "12", rx: "4", fill: "#0c0a12" }, s);

    var disk = svg("g", { class: "drive-disk", "clip-path": "url(#drive-slot-clip)" }, s);
    var body = svg("g", { class: "drive-disk__body" }, disk);
    svg("rect", { x: "128", y: "-6", width: "144", height: "144", rx: "5", fill: "#15131d" }, body);
    svg("rect", { x: "146", y: "10", width: "108", height: "34", rx: "2", fill: "#f4eedb" }, body);
    svg("rect", { x: "146", y: "10", width: "108", height: "6", fill: "#d9534f" }, body);
    var t = svg("text", { x: "200", y: "35", "text-anchor": "middle", class: "drive-label" }, body);
    t.textContent = label(name);
    svg("circle", { cx: "200", cy: "80", r: "17", fill: "#3a344c" }, body);
    svg("circle", { cx: "200", cy: "80", r: "8", fill: "#0a0910" }, body);
    svg("rect", { x: "193", y: "102", width: "14", height: "32", rx: "7", fill: "#0a0910" }, body);
    svg("rect", { x: "268", y: "20", width: "4", height: "12", fill: "#0a0910" }, body);

    var latch = svg("g", { class: "drive-latch" }, s);
    svg("rect", { x: "298", y: "159", width: "46", height: "14", rx: "5", fill: "#2a241a" }, latch);
    svg("rect", { x: "302", y: "162", width: "38", height: "8", rx: "3", fill: "#6b5c40" }, latch);

    svg("circle", { cx: "336", cy: "214", r: "6", class: "drive-led" }, s);
    svg("circle", { cx: "318", cy: "214", r: "6", fill: "#3fbf5f" }, s);
    var name1 = svg("text", { x: "48", y: "220", class: "drive-model" }, s);
    name1.textContent = "DISK DRIVE";
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

  window.CAT_DRIVE = { play: play, holdMs: HOLD_MS };
})();

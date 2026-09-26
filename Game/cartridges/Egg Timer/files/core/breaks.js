/* ===========================================================================
   EGG TIMER — THE BREAK STAGES (E26, brief slot 13; Andrew's approved sheets, 2026-09-26)
   What's left in the nest when the pan comes down on a cleared egg: one of five
   splats, neat to gross, picked by the clear's tier (E26: the fastest fifth shows
   stage 1, the slowest stage 5). All five show at the same size; only the
   grossness changes. Shell fragments are laid on top at runtime, never baked in:
   picked at random, scaled down to fragments, turned and flipped at random, a
   few on stage 1 and the most on stage 5, and every one kept inside (or on) the
   splat's outline. It shows for the nest's "splat" state and holds still, so
   reduced motion has nothing to stop. No DOM in game.js: this file is the view's.
   ========================================================================= */
(function (root) {
  var ET = (root.ET = root.ET || {});

  var NAMES = ["elegant", "messier", "alien-signs", "half-formed", "leftovers"];
  var SHELLS = 10;
  var X0 = -60, Y0 = -62, VW = 120, VH = 110;   // the nest's viewBox; the splats are full-slot canvases on it
  var SVGNS = "http://www.w3.org/2000/svg";
  var splats = [], shells = [], ready = false;

  function splatSrc(stage) { return "art/break-" + stage + "-" + NAMES[stage - 1] + "@2x.png"; }
  function shellSrc(i) { return "art/break--shell-" + (i < 9 ? "0" : "") + (i + 1) + "@2x.png"; }

  // a picture and its alpha, to test where a fragment may go
  function mask(src) {
    return new Promise(function (ok) {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        var g = c.getContext("2d");
        g.drawImage(img, 0, 0);
        var d = g.getImageData(0, 0, c.width, c.height).data, a = new Uint8Array(c.width * c.height);
        for (var i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
        ok({ src: src, w: c.width, h: c.height, a: a });
      };
      img.onerror = function () { ok(null); };
      img.src = src;
    });
  }
  function alphaAt(m, x, y) {
    x = Math.floor(x); y = Math.floor(y);
    return x < 0 || y < 0 || x >= m.w || y >= m.h ? 0 : m.a[y * m.w + x];
  }
  // a splat's opaque box, in viewBox units
  function boxOf(m) {
    var x0 = m.w, y0 = m.h, x1 = -1, y1 = -1;
    for (var y = 0; y < m.h; y++) for (var x = 0; x < m.w; x++) {
      if (m.a[y * m.w + x] > 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    var kx = VW / m.w, ky = VH / m.h;
    return { x0: X0 + x0 * kx, y0: Y0 + y0 * ky, x1: X0 + (x1 + 1) * kx, y1: Y0 + (y1 + 1) * ky };
  }
  // a fragment's own solid pixels, as points about its centre in [-0.5, 0.5] of its width and height
  function solidPoints(m) {
    var pts = [], step = Math.max(1, Math.floor(Math.min(m.w, m.h) / 12));
    for (var y = 0; y < m.h; y += step) for (var x = 0; x < m.w; x += step) {
      if (m.a[y * m.w + x] > 128) pts.push([(x + 0.5) / m.w - 0.5, (y + 0.5) / m.h - 0.5]);
    }
    return pts;
  }

  function load() {
    var jobs = [];
    for (var s = 1; s <= NAMES.length; s++) jobs.push(mask(splatSrc(s)));
    for (var i = 0; i < SHELLS; i++) jobs.push(mask(shellSrc(i)));
    return Promise.all(jobs).then(function (ms) {
      splats = ms.slice(0, NAMES.length).map(function (m) { return m && { m: m, box: boxOf(m) }; });
      shells = ms.slice(NAMES.length).filter(Boolean).map(function (m) { return { m: m, pts: solidPoints(m) }; });
      ready = true;
    });
  }

  // does a fragment (sprite `sh`, centre cx/cy, w × h units, turned `rot` radians, flipped `flip`) lie inside the splat?
  function fits(sp, sh, cx, cy, w, h, rot, flip) {
    var c = Math.cos(rot), s = Math.sin(rot), kx = sp.m.w / VW, ky = sp.m.h / VH;
    for (var i = 0; i < sh.pts.length; i++) {
      var px = sh.pts[i][0] * w * flip, py = sh.pts[i][1] * h;
      var x = cx + px * c - py * s, y = cy + px * s + py * c;
      if (alphaAt(sp.m, (x - X0) * kx, (y - Y0) * ky) <= 128) return false;
    }
    return true;
  }

  function node(tag, attrs, parent) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  ET.breaks = {
    load: load,
    isReady: function () { return ready; },

    /* Fill the nest's `g.break` for a clear at break stage `stage` (1–5, the clear's tier). Returns the fragments laid. */
    fill: function (g, stage, rnd) {
      if (!g) return 0;
      rnd = rnd || Math.random;
      stage = Math.max(1, Math.min(NAMES.length, stage | 0 || 1));
      while (g.firstChild) g.removeChild(g.firstChild);
      g.setAttribute("data-stage", stage);
      node("image", { class: "splat", href: splatSrc(stage), x: X0, y: Y0, width: VW, height: VH, preserveAspectRatio: "none" }, g);
      var sp = splats[stage - 1];
      if (!ready || !sp || !shells.length) return 0;

      var C = ET.CONFIG.breakShells, range = C.count[stage] || C.count[1];
      var want = range[0] + Math.floor(rnd() * (range[1] - range[0] + 1));
      // a shuffle of the ten fragments, so one splat doesn't repeat a piece until it has shown them all
      var order = shells.map(function (_, i) { return i; });
      for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = order[i]; order[i] = order[j]; order[j] = t; }
      var laid = [], b = sp.box;
      for (var n = 0; n < want; n++) {
        var sh = shells[order[n % order.length]];
        var size = C.size * (C.jitter[0] + rnd() * (C.jitter[1] - C.jitter[0]));
        var k = size / Math.max(sh.m.w, sh.m.h), w = sh.m.w * k, h = sh.m.h * k;
        for (var tries = 0; tries < C.tries; tries++) {
          // rounded as they're written, so check() re-tests exactly what's drawn
          var cx = +(b.x0 + rnd() * (b.x1 - b.x0)).toFixed(2), cy = +(b.y0 + rnd() * (b.y1 - b.y0)).toFixed(2);
          var deg = +(rnd() * 360).toFixed(1), rot = deg * Math.PI / 180, flip = rnd() < 0.5 ? -1 : 1;
          var apart = laid.every(function (p) { return Math.hypot(p.cx - cx, p.cy - cy) >= C.spacing * (p.size + size) / 2; });
          if (!apart || !fits(sp, sh, cx, cy, w, h, rot, flip)) continue;
          laid.push({ cx: cx, cy: cy, size: size });
          node("image", {
            class: "piece", href: sh.m.src, x: -w / 2, y: -h / 2, width: w, height: h,
            transform: "translate(" + cx + " " + cy + ") rotate(" + deg + ") scale(" + flip + " 1)"
          }, g);
          break;
        }
      }
      return laid.length;
    },

    /* For rigs: is every fragment in `g` inside its splat? (the same test fill() used, re-run from the drawn transforms) */
    check: function (g) {
      var stage = +g.getAttribute("data-stage"), sp = splats[stage - 1], bad = 0, count = 0;
      [].forEach.call(g.querySelectorAll(".piece"), function (im) {
        count++;
        var sh = shells.filter(function (s) { return s.m.src === im.getAttribute("href"); })[0];
        var tf = /translate\(([-\d.]+) ([-\d.]+)\) rotate\(([-\d.]+)\) scale\((-?1) 1\)/.exec(im.getAttribute("transform"));
        var w = +im.getAttribute("width"), h = +im.getAttribute("height");
        if (!sh || !tf || !fits(sp, sh, +tf[1], +tf[2], w, h, +tf[3] * Math.PI / 180, +tf[4])) bad++;
      });
      return { stage: stage, count: count, outside: bad };
    }
  };
})(window);

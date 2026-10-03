/* ===========================================================================
   EGG TIMER — MESS (packet §8)
   Each nest owns one mess canvas laid over its egg AND its readout, so gunk
   really hides the unit, code and timer. Mess belongs to the nest, never to a
   screen position, and it never caps: it piles up wave over wave until wiped.
   Wiping is click-and-drag. It costs typing time and nothing else.

   The canvas has a fixed internal size and is scaled by CSS, so resizing the
   window never erases the mess.

   Refinement 3 rulings (E14, E15): a clear leaves a small splat on its own nest,
   and the rest of its gunk lands evenly at random over the whole board. A blob
   that lands on a nest goes on that nest's canvas, which sits OVER its readout
   and post-it again (as in the original design); anywhere else it goes on one
   board-wide "floor" canvas under the nests.
   ========================================================================= */
(function (root) {
  var ET = (root.ET = root.ET || {});

  var W = 240, H = 280;
  var FW = 1600, FH = 1000;   // the floor canvas, stretched over the whole board
  var COLORS = ["#ffd43a", "#ffc21a", "#fff4d6", "#f2e6c4", "#c98a2b"];
  var tmp = null;   // E38: scratch canvas for a streak

  /* One irregular splotch: uneven radii joined with curves (a blob, not a star), squashed a little
     flat, with a few flung droplets around it. */
  function blob(canvas, x, y, r) {
    var g = canvas.getContext("2d");
    var color = COLORS[Math.floor(Math.random() * COLORS.length)];
    var lobes = 9, pts = [];
    for (var k = 0; k < lobes; k++) {
      var a = (k / lobes) * Math.PI * 2;
      var rr = r * (0.7 + Math.random() * 0.5);
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.75]);
    }
    g.lineJoin = "round";
    g.beginPath();
    var mid = function (p, q) { return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; };
    var start = mid(pts[lobes - 1], pts[0]);
    g.moveTo(start[0], start[1]);
    for (var m = 0; m < lobes; m++) {
      var next = mid(pts[m], pts[(m + 1) % lobes]);
      g.quadraticCurveTo(pts[m][0], pts[m][1], next[0], next[1]);
    }
    g.closePath();
    g.globalAlpha = 0.92;
    g.fillStyle = color;
    g.fill();
    g.globalAlpha = 1;
    g.lineWidth = 2;
    g.strokeStyle = "rgba(60, 34, 0, 0.55)";
    g.stroke();

    var drops = 2 + Math.floor(Math.random() * 4), dr = r / 21;
    for (var d = 0; d < drops; d++) {
      var da = Math.random() * Math.PI * 2, dist = r * (1.3 + Math.random() * 0.9);
      g.beginPath();
      g.arc(x + Math.cos(da) * dist, y + Math.sin(da) * dist * 0.75, (2 + Math.random() * 3.5) * dr, 0, Math.PI * 2);
      g.fillStyle = color;
      g.fill();
    }
  }

  ET.mess = {
    W: W,
    H: H,

    create: function () {
      var c = document.createElement("canvas");
      c.className = "mess";
      c.width = W;
      c.height = H;
      c.getContext("2d", { willReadFrequently: true });   // E38: the spray reads it back; a GPU canvas makes that slow
      return c;
    },

    /* The board-wide floor canvas (Refinement 3 §5). */
    createFloor: function () {
      var c = document.createElement("canvas");
      c.className = "floor-mess";
      c.width = FW;
      c.height = FH;
      c.getContext("2d", { willReadFrequently: true });   // E38: as above (a readback from the GPU took seconds)
      return c;
    },

    /* A clear's own small splat (Refinement 3 rulings, E15): `count` blobs on its nest, biased toward the
       bottom where the readout is, at `size` × the usual blob. */
    splatter: function (canvas, count, size) {
      var cw = canvas.width, ch = canvas.height, k = size || 1;
      for (var i = 0; i < count; i++) {
        blob(canvas, 24 + Math.random() * (cw - 48), ch * (0.3 + Math.random() * 0.62), (12 + Math.random() * 18) * k);
      }
    },

    /* One blob at (x, y) in the canvas's own units, `r` its radius in those units. The view uses it to
       spread a clear's splatter evenly over the whole board (E15). */
    blob: function (canvas, x, y, r) { blob(canvas, x, y, r); },

    /* Erase along a drag from (x0,y0) to (x1,y1), in canvas coordinates. */
    wipe: function (canvas, x0, y0, x1, y1, radius) {
      var g = canvas.getContext("2d");
      g.save();
      g.globalCompositeOperation = "destination-out";
      // an opaque stroke erases fully: splatter leaves a half-clear outline colour on the context
      g.strokeStyle = "#000";
      g.globalAlpha = 1;
      g.lineCap = "round";
      g.lineWidth = radius * 2;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
      g.restore();
    },

    /* E38: the spray on liquid (yolk, slime, goo). It isn't pushed like a solid: the patch under the spray is thinned
       where it was and a fainter copy is laid down further along the spray's direction, so repeated passes streak it
       that way and wash it out. (x0,y0) → (x1,y1) is the spray's move since the last event, in canvas units; `r` the
       spray's radius. Returns what was there before (alpha 0–255 and its colour), so the view can start a drip or a
       trickle from it. */
    /* Andrew, 2026-09-30: the water stream over one canvas for `dt` seconds, from the nozzle (x0,y0) to where it lands
       (x1,y1), canvas units, `r` its half-width. Along its length it thins what's there (most at the nozzle, falling off
       like the push on pieces) and carries a fainter copy a little way on, the way the water flows. Returns what was
       under the nozzle before (as streak does), for a drip or a trickle. */
    flow: function (canvas, x0, y0, x1, y1, r, dt) {
      var g = canvas.getContext("2d"), C = ET.CONFIG.liquid, P = ET.CONFIG.pieces;
      var dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
      if (!(dt > 0) || len < 0.5) return null;
      var px = Math.max(0, Math.min(canvas.width - 1, Math.round(x0))), py = Math.max(0, Math.min(canvas.height - 1, Math.round(y0)));
      var d = g.getImageData(px, py, 1, 1).data, before = { alpha: d[3], color: "rgb(" + d[0] + "," + d[1] + "," + d[2] + ")" };
      var ux = dx / len, uy = dy / len, size = Math.ceil(2 * r), shift = Math.min(r, C.drift * 2 * r * dt);
      if (!tmp) { tmp = document.createElement("canvas"); tmp.getContext("2d", { willReadFrequently: true }); }
      if (tmp.width < size || tmp.height < size) { tmp.width = Math.max(tmp.width, size); tmp.height = Math.max(tmp.height, size); }
      var t = tmp.getContext("2d");
      // three stretches, nozzle to far end: each thins what's under it and carries a copy of it on downstream
      for (var k = 0; k < 3; k++) {
        var a = k / 3, b = (k + 1) / 3, mid = (a + b) / 2;
        var sx = x0 + dx * a, sy = y0 + dy * a, ex = x0 + dx * b, ey = y0 + dy * b;
        var gone = 1 - Math.exp(-C.wash * dt * (1 - P.jetFalloff * mid));
        t.clearRect(0, 0, size, size);
        t.drawImage(canvas, ex - r, ey - r, size, size, 0, 0, size, size);
        g.save();
        g.globalCompositeOperation = "destination-out";
        g.globalAlpha = gone;
        g.strokeStyle = "#000";
        g.lineCap = "round";
        g.lineWidth = 2 * r;
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex + 0.01, ey); g.stroke();
        g.restore();
        if (shift > 0.05) {
          g.save();
          g.beginPath(); g.arc(ex + ux * shift, ey + uy * shift, r, 0, Math.PI * 2); g.clip();
          g.globalAlpha = gone * C.keep;
          g.drawImage(tmp, 0, 0, size, size, ex - r + ux * shift, ey - r + uy * shift, size, size);
          g.restore();
        }
      }
      return before;
    },

    streak: function (canvas, x0, y0, x1, y1, r) {
      var g = canvas.getContext("2d"), C = ET.CONFIG.liquid;
      var px = Math.max(0, Math.min(canvas.width - 1, Math.round(x1))), py = Math.max(0, Math.min(canvas.height - 1, Math.round(y1)));
      var d = g.getImageData(px, py, 1, 1).data, before = { alpha: d[3], color: "rgb(" + d[0] + "," + d[1] + "," + d[2] + ")" };
      var dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), size = Math.ceil(2 * r);
      if (!tmp) { tmp = document.createElement("canvas"); tmp.getContext("2d", { willReadFrequently: true }); }   // in memory, like the mess
      if (tmp.width < size || tmp.height < size) { tmp.width = Math.max(tmp.width, size); tmp.height = Math.max(tmp.height, size); }
      var t = tmp.getContext("2d");
      t.clearRect(0, 0, size, size);
      t.drawImage(canvas, x1 - r, y1 - r, size, size, 0, 0, size, size);   // what's under the spray, before it washes
      // thin it where it was (along the whole move, so a fast drag leaves no gaps)
      g.save();
      g.globalCompositeOperation = "destination-out";
      g.globalAlpha = C.thin;
      g.strokeStyle = "#000";
      g.lineCap = "round";
      g.lineWidth = 2 * r;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1 + 0.01, y1); g.stroke();
      g.restore();
      // and lay a fainter copy of it down the spray's direction, as a round streak
      if (len > 0.5) {
        var push = Math.min(len * C.carry, r), ux = dx / len, uy = dy / len;
        g.save();
        g.beginPath(); g.arc(x1 + ux * push, y1 + uy * push, r, 0, Math.PI * 2); g.clip();
        g.globalAlpha = C.keep;
        g.drawImage(tmp, 0, 0, size, size, x1 - r + ux * push, y1 - r + uy * push, size, size);
        g.restore();
      }
      return before;
    },

    /* E38: a thin run of liquid from (x0,y0) to (x1,y1) in canvas units (a drip, running back down). */
    run: function (canvas, x0, y0, x1, y1, width, color) {
      var g = canvas.getContext("2d");
      g.save();
      g.strokeStyle = color;
      g.globalAlpha = ET.CONFIG.liquid.dripAlpha;
      g.lineCap = "round";
      g.lineWidth = width;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1 + 0.01); g.stroke();
      g.restore();
    },

    /* The liquid at one point, in canvas units: its alpha (0–255) and colour. */
    sample: function (canvas, x, y) {
      var px = Math.max(0, Math.min(canvas.width - 1, Math.round(x))), py = Math.max(0, Math.min(canvas.height - 1, Math.round(y)));
      var d = canvas.getContext("2d").getImageData(px, py, 1, 1).data;
      return { alpha: d[3], color: "rgb(" + d[0] + "," + d[1] + "," + d[2] + ")" };
    },

    /* Share of the canvas covered, 0–1, sampled on a coarse grid (for rigs). */
    coverage: function (canvas) {
      var cw = canvas.width, ch = canvas.height;
      var d = canvas.getContext("2d").getImageData(0, 0, cw, ch).data;
      var hit = 0, n = 0;
      for (var y = 2; y < ch; y += 8) {
        for (var x = 2; x < cw; x += 8) {
          n++;
          if (d[(y * cw + x) * 4 + 3] > 40) hit++;
        }
      }
      return hit / n;
    },

    clear: function (canvas) {
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    },

    /* Mom kit (Chat's brief, 2026-10-02): where creepy Mom's drool drop lands, a flat, irregular splat, on this canvas
       (the floor), so it washes off like any goo. (x, y) and r are in screen px; kx, ky the canvas's own px per screen
       px, so it isn't stretched with the canvas. Every one is different: its size, its shape (lobes, flatness, a few
       long runs), how rugged its edge is and how many droplets it flings. Flat colours (the goo's, theme.css), the
       thick cartoon outline and a few glossy streaks; never round, never a ball, never red. Glowing purple (Chat,
       2026-10-02): `glow` (screen px) is a steady halo round the splat and its droplets, drawn on this canvas under
       them, so it follows their shapes and washes off with them. `rnd` is the random source (cosmetic: Math.random).
       Returns the box it covers, halo and all, in screen px. */
    drool: function (canvas, x, y, r, kx, ky, glow, rnd) {
      rnd = rnd || Math.random;
      var css = getComputedStyle(document.documentElement);
      var col = function (n, d) { return (css.getPropertyValue(n) || d).trim() || d; };
      var fill = col("--mom-drool", "#b04dff"), deep = col("--mom-drool-deep", "#6a1fb0");
      var shine = col("--mom-drool-shine", "#f3dcff"), ink = col("--outline", "#1a0d2e"), halo = col("--mom-drool-glow", "#c77dff");
      glow = glow || 0;
      var g = canvas.getContext("2d");
      g.save();
      g.setTransform(kx, 0, 0, ky, x * kx, y * ky);
      r *= 0.75 + rnd() * 0.25;                      // never bigger than r: view.js keeps 2.4 r clear round it
      var flat = 0.42 + rnd() * 0.2;                 // squashed flat on the floor
      var rugged = 0.25 + rnd() * 0.45;              // how uneven its edge is
      var lobes = 7 + Math.floor(rnd() * 7), turn = rnd() * Math.PI * 2, pts = [];
      var runs = 1 + Math.floor(rnd() * 3), runAt = [];
      for (var q = 0; q < runs; q++) runAt.push(Math.floor(rnd() * lobes));
      for (var k = 0; k < lobes; k++) {
        var a = turn + (k + (rnd() - 0.5) * 0.5) / lobes * Math.PI * 2;
        var rr = r * (1 - rugged / 2 + rnd() * rugged);
        if (runAt.indexOf(k) >= 0) rr *= 1.3 + rnd() * 0.3;   // a run, flung out further
        pts.push([Math.cos(a) * rr, Math.sin(a) * rr * flat]);
      }
      var mid = function (p, q) { return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; };
      var shape = function (list, scale) {
        g.beginPath();
        var s0 = mid(list[list.length - 1], list[0]);
        g.moveTo(s0[0] * scale, s0[1] * scale);
        for (var m = 0; m < list.length; m++) {
          var n = mid(list[m], list[(m + 1) % list.length]);
          g.quadraticCurveTo(list[m][0] * scale, list[m][1] * scale, n[0] * scale, n[1] * scale);
        }
        g.closePath();
      };
      var line = Math.max(2, r * 0.11);
      g.lineJoin = "round";
      g.lineCap = "round";
      // the splat: the darker shade (casting the glow), then the goo's colour lifted a little inside it (a darker rim
      // along its lower edge, so it reads as a puddle, not a ball), then the thick outline
      shape(pts, 1);
      g.fillStyle = deep;
      if (glow) { g.shadowColor = halo; g.shadowBlur = glow * kx; }
      g.fill();
      g.shadowBlur = 0;
      g.save();
      g.clip();
      g.fillStyle = fill;
      shape(pts.map(function (p) { return [p[0] * 0.95, p[1] * 0.9 - r * flat * 0.14]; }), 1);
      g.fill();
      g.restore();
      shape(pts, 1);
      g.strokeStyle = ink;
      g.lineWidth = line;
      g.stroke();
      // a few glossy streaks
      g.strokeStyle = shine;
      var streaks = 2 + Math.floor(rnd() * 2);
      for (var h = 0; h < streaks; h++) {
        var sx = (rnd() - 0.6) * r * 0.9, sy = (rnd() - 0.7) * r * flat * 0.8, sl = r * (0.18 + rnd() * 0.22);
        g.lineWidth = Math.max(1.2, line * (0.55 - h * 0.12));
        g.beginPath();
        g.moveTo(sx, sy);
        g.quadraticCurveTo(sx + sl * 0.5, sy - sl * 0.18, sx + sl, sy);
        g.stroke();
      }
      // the flung droplets: small, outlined, a few drawn out the way they flew
      var drops = 1 + Math.floor(rnd() * 6), reach = 1;
      for (var d = 0; d < drops; d++) {
        var da = rnd() * Math.PI * 2, dist = r * (1.2 + rnd() * 0.75), dr = r * (0.06 + rnd() * 0.1);
        var cx = Math.cos(da) * dist, cy = Math.sin(da) * dist * flat, stretch = 1 + rnd() * 1.3;
        reach = Math.max(reach, dist / r + 0.2);
        g.save();
        g.translate(cx, cy);
        g.rotate(da);
        g.scale(stretch, 1 / Math.sqrt(stretch));
        g.beginPath();
        g.arc(0, 0, dr, 0, Math.PI * 2);
        g.restore();
        g.fillStyle = fill;
        if (glow) { g.shadowColor = halo; g.shadowBlur = glow * kx * 0.6; }
        g.fill();
        g.shadowBlur = 0;
        g.strokeStyle = ink;
        g.lineWidth = Math.max(1.2, line * 0.5);
        g.stroke();
      }
      g.restore();
      var w = r * Math.max(reach, 2.1) + line + glow;
      return { l: x - w, r: x + w, t: y - w * flat - line - glow, b: y + w * flat + line + glow };
    }
  };
})(window);

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
    }
  };
})(window);

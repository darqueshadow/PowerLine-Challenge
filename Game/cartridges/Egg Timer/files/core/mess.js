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
      return c;
    },

    /* The board-wide floor canvas (Refinement 3 §5). */
    createFloor: function () {
      var c = document.createElement("canvas");
      c.className = "floor-mess";
      c.width = FW;
      c.height = FH;
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

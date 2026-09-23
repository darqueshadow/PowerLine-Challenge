/* ===========================================================================
   EGG TIMER — ART (placeholders)
   ⏳ Every shape here is a stand-in. The creature family, the egg ladder's
   dishes and the escape flourishes are Gemini's once art direction starts
   (packet §11 item 6). Keep them original — no likeness of Spielberg's E.T.
   Built as inline SVG so the placeholders scale with the nest and need no files.
   ========================================================================= */
(function (root) {
  var ET = (root.ET = root.ET || {});

  var NS = "http://www.w3.org/2000/svg";

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /* ⏳ placeholder dishes for the egg ladder (Refinement 3 rulings), one a rung, bottom to top. They
     replace Refinement 2's fried eggs by overtime third. Final art is Gemini's. Drawn on a plate
     centred at 0,0 in a -50..50 × -34..34 box. */
  function sunny(g, x, y, k) {
    el("path", { class: "white", transform: "translate(" + x + " " + y + ") scale(" + k + ")", d: "M-18 2 C-20 -9 -8 -13 0 -11 C10 -15 20 -7 18 2 C20 12 7 15 -1 13 C-11 16 -21 10 -18 2Z" }, g);
    el("circle", { class: "yolk", cx: x + k, cy: y, r: 6 * k }, g);
  }
  var DISHES = [
    function (g) {   // Scrambled
      [[-14, -2, 8], [-2, -7, 9], [11, -1, 8], [-6, 7, 8], [8, 8, 7], [0, 1, 7]].forEach(function (b) {
        el("circle", { class: "yolk", cx: b[0], cy: b[1], r: b[2] }, g);
      });
    },
    function (g) { sunny(g, 0, 0, 1.3); },   // Sunny-Side Up
    function (g) {   // Over Easy: folded, the yolk showing through
      el("path", { class: "white", d: "M-24 4 C-22 -12 22 -12 24 4 C14 12 -14 12 -24 4Z" }, g);
      el("ellipse", { class: "yolk pale", cx: 0, cy: -1, rx: 9, ry: 5 }, g);
    },
    function (g) {   // Poached
      el("ellipse", { class: "white", cx: 0, cy: 0, rx: 17, ry: 14 }, g);
      el("ellipse", { class: "yolk pale", cx: 2, cy: -2, rx: 6, ry: 5 }, g);
    },
    function (g) {   // Eggs Benny: a muffin, a poached egg, hollandaise
      el("ellipse", { class: "muffin", cx: 0, cy: 6, rx: 22, ry: 10 }, g);
      el("ellipse", { class: "white", cx: 0, cy: -1, rx: 17, ry: 11 }, g);
      el("path", { class: "sauce", d: "M-15 -4 C-8 -12 8 -12 15 -4 C12 2 10 8 6 4 C2 10 -3 6 -5 3 C-9 8 -13 3 -15 -4Z" }, g);
    },
    function (g) {   // Eggs Benny w/ Avocado
      el("ellipse", { class: "muffin", cx: -4, cy: 6, rx: 20, ry: 10 }, g);
      el("ellipse", { class: "white", cx: -4, cy: -1, rx: 15, ry: 10 }, g);
      el("path", { class: "sauce", d: "M-17 -4 C-10 -11 4 -11 11 -4 C8 2 6 7 2 4 C-2 9 -7 5 -9 2 C-12 7 -15 2 -17 -4Z" }, g);
      [[20, -6], [24, 2], [20, 10]].forEach(function (a) {
        el("ellipse", { class: "avocado", cx: a[0], cy: a[1], rx: 9, ry: 4, transform: "rotate(-20 " + a[0] + " " + a[1] + ")" }, g);
      });
    },
    function (g) {   // Steak, Eggs & Brew!
      el("path", { class: "steak", d: "M-38 -8 C-30 -18 -8 -16 -4 -6 C0 4 -8 14 -22 13 C-36 12 -44 2 -38 -8Z" }, g);
      el("path", { class: "grill", d: "M-32 -8 L-14 6 M-26 -12 L-8 2" }, g);
      sunny(g, 6, -4, 0.8);
      sunny(g, 12, 10, 0.8);
      el("rect", { class: "mug", x: 30, y: -20, width: 16, height: 26, rx: 2 }, g);
      el("rect", { class: "foam", x: 29, y: -24, width: 18, height: 7, rx: 3 }, g);
      el("path", { class: "handle", d: "M46 -14 C54 -14 54 0 46 0" }, g);
    }
  ];

  ET.art = {
    DISHES: DISHES.length,

    /* The egg ladder's dish for rung `i` (0 = bottom), with its caption (Refinement 3 rulings). */
    dishEl: function (i, caption) {
      var d = document.createElement("div");
      d.className = "dish";
      d.dataset.rung = i;
      var svg = el("svg", { viewBox: "-56 -38 112 76", "aria-hidden": "true" }, d);
      el("ellipse", { class: "plate", cx: 0, cy: 2, rx: 54, ry: 34 }, svg);
      el("ellipse", { class: "plate-rim", cx: 0, cy: 2, rx: 44, ry: 26 }, svg);
      var food = el("g", {}, svg);
      DISHES[Math.max(0, Math.min(DISHES.length - 1, i))](food);
      var c = document.createElement("div");
      c.className = "caption";
      c.textContent = caption;
      d.appendChild(c);
      return d;
    },

    /* ⏳ placeholder: the frying pan that slams down on a clear (and late, on a hatch). */
    panEl: function () {
      var d = document.createElement("div");
      d.className = "pan";
      var svg = el("svg", { viewBox: "-60 -40 150 80", "aria-hidden": "true" }, d);
      el("rect", { class: "handle", x: 34, y: -6, width: 50, height: 12, rx: 3 }, svg);
      el("ellipse", { class: "rim", cx: 0, cy: 0, rx: 44, ry: 30 }, svg);
      el("ellipse", { class: "base", cx: 0, cy: 0, rx: 36, ry: 23 }, svg);
      el("ellipse", { class: "glint", cx: -14, cy: -10, rx: 10, ry: 4 }, svg);
      return d;
    },
    FLOURISHES: ["scurry", "lunge"],

    /* One nest's picture: twigs, the egg (grows, then cracks), a splat slot,
       broken shell halves and a creature for the escape. */
    nestSvg: function () {
      var svg = el("svg", { class: "nest-art", viewBox: "-60 -62 120 110", "aria-hidden": "true" });

      // ⏳ placeholder: the "alien nest" touch an ACTIVE nest gets (Refinement 3 §8): a glowing ooze pool
      // and a few tendrils. An inactive nest shows plain twigs only.
      var ooze = el("g", { class: "ooze" }, svg);
      el("ellipse", { class: "pool", cx: 0, cy: 20, rx: 50, ry: 13 }, ooze);
      el("path", { class: "tendril", d: "M-46 16 C-56 6 -52 -8 -60 -14 M46 16 C58 8 52 -6 60 -12 M-30 28 C-34 38 -26 42 -32 48" }, ooze);

      var twigsBack = el("g", { class: "twigs back" }, svg);
      el("path", { d: "M-46 18 C-40 4 -20 -2 0 -2 C20 -2 40 4 46 18" }, twigsBack);

      var egg = el("g", { class: "egg" }, svg);
      el("ellipse", { class: "shell", cx: 0, cy: -8, rx: 22, ry: 28 }, egg);
      [[-9, -20, 3], [7, -26, 2.2], [10, -8, 3.2], [-6, 2, 2.4], [2, -14, 1.8], [-13, -6, 1.6]].forEach(function (s) {
        el("circle", { class: "speckle", cx: s[0], cy: s[1], r: s[2] }, egg);
      });
      el("path", { class: "crack", pathLength: 1, d: "M-4 -36 L2 -24 L-6 -14 L4 -4 L-2 8" }, egg);
      el("path", { class: "crack", pathLength: 1, d: "M16 -24 L8 -16 L14 -6 L6 2" }, egg);
      el("path", { class: "crack", pathLength: 1, d: "M-20 -12 L-11 -8 L-15 2" }, egg);

      var twigsFront = el("g", { class: "twigs front" }, svg);
      el("path", { d: "M-50 16 C-38 34 38 34 50 16" }, twigsFront);
      el("path", { d: "M-44 22 L-30 14 M-20 30 L-8 18 M4 32 L16 20 M26 28 L40 18 M-36 28 L-24 34 M30 32 L44 24" }, twigsFront);

      var shells = el("g", { class: "shells" }, svg);
      el("path", { class: "shell half", d: "M-22 6 C-24 -8 -16 -18 -6 -18 L-10 -10 L-4 -4 L-12 4 Z" }, shells);
      el("path", { class: "shell half", d: "M22 6 C24 -8 16 -18 6 -18 L10 -10 L4 -4 L12 4 Z" }, shells);

      var bug = el("g", { class: "creature" }, svg);
      var legs = el("g", { class: "legs" }, bug);
      [-8, 0, 8].forEach(function (y) {
        el("path", { d: "M-10 " + y + " L-22 " + (y - 6) + " M10 " + y + " L22 " + (y - 6) }, legs);
      });
      el("ellipse", { class: "body", cx: 0, cy: 0, rx: 12, ry: 16 }, bug);
      el("circle", { class: "eye", cx: -5, cy: -9, r: 3.4 }, bug);
      el("circle", { class: "eye", cx: 5, cy: -9, r: 3.4 }, bug);
      el("path", { class: "antenna", d: "M-4 -15 L-10 -26 M4 -15 L10 -26" }, bug);

      return svg;
    }
  };
})(window);

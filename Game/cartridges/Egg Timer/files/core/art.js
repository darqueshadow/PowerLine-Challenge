/* ===========================================================================
   EGG TIMER — ART (placeholders)
   ⏳ Every shape here is a stand-in. The creature family, the cooked-egg splat
   variants and the escape flourishes are Gemini's once art direction starts
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

  /* The fried eggs, picked by timing (Refinement 2 §5). The random pool of
     poached, deviled and scrambled is retired (E11). */
  var SPLATS = {
    sunny: function (g) {
      el("path", { class: "white", d: "M-30 4 C-34 -14 -14 -22 0 -18 C16 -26 34 -12 30 4 C34 20 12 26 -2 22 C-18 28 -36 18 -30 4Z" }, g);
      el("circle", { class: "yolk", cx: 2, cy: 0, r: 10 }, g);
      el("circle", { class: "shine", cx: -1, cy: -4, r: 3 }, g);
    },
    // middle third: the yolk has run
    broken: function (g) {
      el("path", { class: "white", d: "M-30 4 C-34 -14 -14 -22 0 -18 C16 -26 34 -12 30 4 C34 20 12 26 -2 22 C-18 28 -36 18 -30 4Z" }, g);
      el("path", { class: "yolk", d: "M-8 -6 C-2 -12 10 -8 10 -1 C16 4 22 8 14 12 C8 14 4 8 0 10 C-6 14 -16 12 -12 4 C-14 0 -12 -4 -8 -6Z" }, g);
    },
    // last third: scrambled and burnt at the edges
    burnt: function (g) {
      el("path", { class: "white burnt", d: "M-30 4 C-34 -14 -14 -22 0 -18 C16 -26 34 -12 30 4 C34 20 12 26 -2 22 C-18 28 -36 18 -30 4Z" }, g);
      [[-12, -4, 7], [2, -8, 8], [13, -1, 7], [-5, 8, 7], [9, 9, 6]].forEach(function (b) {
        el("circle", { class: "yolk scorched", cx: b[0], cy: b[1], r: b[2] }, g);
      });
    }
  };

  ET.art = {
    SPLATS: Object.keys(SPLATS),
    FRIED: ["sunny", "broken", "burnt"],   // by the third of overtime the clear landed in

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

      el("g", { class: "splat" }, svg);

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
    },

    showSplat: function (svg, variant) {
      var g = svg.querySelector(".splat");
      while (g.firstChild) g.removeChild(g.firstChild);
      (SPLATS[variant] || SPLATS.sunny)(g);
    },

    clearSplat: function (svg) {
      var g = svg.querySelector(".splat");
      while (g.firstChild) g.removeChild(g.firstChild);
    }
  };
})(window);

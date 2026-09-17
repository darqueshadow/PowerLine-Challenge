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

  /* The four cooked-egg splats the packet names as examples (§7). */
  var SPLATS = {
    sunny: function (g) {
      el("path", { class: "white", d: "M-30 4 C-34 -14 -14 -22 0 -18 C16 -26 34 -12 30 4 C34 20 12 26 -2 22 C-18 28 -36 18 -30 4Z" }, g);
      el("circle", { class: "yolk", cx: 2, cy: 0, r: 10 }, g);
      el("circle", { class: "shine", cx: -1, cy: -4, r: 3 }, g);
    },
    scrambled: function (g) {
      [[-16, -6, 9], [0, -10, 10], [15, -3, 9], [-8, 9, 10], [10, 11, 9], [-22, 8, 6], [24, 10, 6]].forEach(function (b) {
        el("circle", { class: "yolk", cx: b[0], cy: b[1], r: b[2] }, g);
      });
      el("circle", { class: "shine", cx: -2, cy: -12, r: 3 }, g);
    },
    poached: function (g) {
      el("ellipse", { class: "white", cx: 0, cy: 2, rx: 27, ry: 21 }, g);
      el("ellipse", { class: "yolk pale", cx: 0, cy: 0, rx: 13, ry: 11 }, g);
      el("ellipse", { class: "shine", cx: -6, cy: -5, rx: 5, ry: 3 }, g);
    },
    deviled: function (g) {
      [-15, 15].forEach(function (x) {
        el("ellipse", { class: "white", cx: x, cy: 4, rx: 14, ry: 19 }, g);
        el("ellipse", { class: "yolk", cx: x, cy: 3, rx: 8, ry: 10 }, g);
        el("circle", { class: "paprika", cx: x - 2, cy: 1, r: 1.8 }, g);
        el("circle", { class: "paprika", cx: x + 3, cy: 6, r: 1.8 }, g);
      });
    }
  };

  ET.art = {
    SPLATS: Object.keys(SPLATS),
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

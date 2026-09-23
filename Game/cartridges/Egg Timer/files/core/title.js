/* ===========================================================================
   EGG TIMER — TITLE SCENE (Refinement 4 §6)
   ⏳ Placeholder art, until Gemini's: a cute mommy alien and her happy baby
   aliens, singing on a loop. The juxtaposition twist (Refinement 4 §0): mommy's
   smile runs a touch too wide, and one baby has slightly too many teeth.
   Pure inline SVG with CSS animation: it is built once at boot, draws nothing
   per frame from script, and never holds up the keyboard or the game's start.
   The tune is audio.js's titleTune(), an original melody.
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

  /* One baby alien at (x, y), singing. `teeth` gives it the row of too many teeth. */
  function baby(svg, x, y, delay, teeth) {
    var g = el("g", { class: "baby", transform: "translate(" + x + " " + y + ")" }, svg);
    var bob = el("g", { class: "bob", style: "animation-delay:" + delay + "s" }, g);
    el("ellipse", { class: "alien-skin", cx: 0, cy: 0, rx: 22, ry: 24 }, bob);
    el("path", { class: "antenna", d: "M-8 -22 L-14 -38 M8 -22 L14 -38" }, bob);
    el("circle", { class: "antenna-tip", cx: -14, cy: -40, r: 4 }, bob);
    el("circle", { class: "antenna-tip", cx: 14, cy: -40, r: 4 }, bob);
    el("ellipse", { class: "eye", cx: -8, cy: -6, rx: 6, ry: 7 }, bob);
    el("ellipse", { class: "eye", cx: 8, cy: -6, rx: 6, ry: 7 }, bob);
    el("circle", { class: "pupil", cx: -7, cy: -5, r: 3 }, bob);
    el("circle", { class: "pupil", cx: 9, cy: -5, r: 3 }, bob);
    var mouth = el("g", { class: "mouth", style: "animation-delay:" + delay + "s" }, bob);
    el("ellipse", { class: "mouth-hole", cx: 0, cy: 10, rx: 7, ry: 6 }, mouth);
    if (teeth) {
      // a few too many, and a little too sharp
      el("path", { class: "teeth", d: "M-7 6 L-5.5 10 L-4 6 L-2.5 10 L-1 6 L0.5 10 L2 6 L3.5 10 L5 6 L6.5 10 L7 6Z" }, mouth);
      el("path", { class: "teeth", d: "M-6 15 L-4.5 11.5 L-3 15 L-1.5 11.5 L0 15 L1.5 11.5 L3 15 L4.5 11.5 L6 15Z" }, mouth);
    }
    return g;
  }

  ET.title = {
    build: function (host) {
      var svg = el("svg", { viewBox: "0 0 420 210", role: "img", "aria-label": "A mommy alien and her baby aliens, singing" });

      // the notes they sing, drifting up
      ["♪", "♫", "♪", "♬"].forEach(function (n, i) {
        var t = el("text", { class: "note", x: 150 + i * 62, y: 70, style: "animation-delay:" + (i * 0.55) + "s" }, svg);
        t.textContent = n;
      });

      // mommy
      var mom = el("g", { class: "mommy", transform: "translate(95 120)" }, svg);
      var sway = el("g", { class: "sway" }, mom);
      el("ellipse", { class: "alien-skin", cx: 0, cy: 18, rx: 52, ry: 62 }, sway);
      el("path", { class: "apron", d: "M-30 28 C-30 70 30 70 30 28 Z" }, sway);
      el("path", { class: "apron-heart", d: "M0 52 C-10 42 -8 34 0 40 C8 34 10 42 0 52Z" }, sway);
      [[-24, -58], [0, -66], [24, -58]].forEach(function (p, i) {
        el("path", { class: "stalk", d: "M" + (p[0] * 0.5) + " -30 Q" + (p[0] * 0.8) + " " + (p[1] + 20) + " " + p[0] + " " + p[1] }, sway);
        el("circle", { class: "eye", cx: p[0], cy: p[1], r: 9 }, sway);
        el("circle", { class: "pupil wink", cx: p[0] + 1, cy: p[1] + 1, r: 4, style: "animation-delay:" + (i * 0.2) + "s" }, sway);
      });
      // the smile, a touch too wide: nearly ear to ear
      el("path", { class: "smile", d: "M-44 -4 Q0 36 44 -4" }, sway);
      el("path", { class: "smile-line", d: "M-44 -4 Q0 22 44 -4" }, sway);
      el("ellipse", { class: "cheek", cx: -34, cy: 4, rx: 7, ry: 4 }, sway);
      el("ellipse", { class: "cheek", cx: 34, cy: 4, rx: 7, ry: 4 }, sway);

      // her babies
      baby(svg, 205, 160, 0, false);
      baby(svg, 270, 150, 0.35, true);
      baby(svg, 335, 162, 0.7, false);

      host.appendChild(svg);
      return svg;
    }
  };
})(window);

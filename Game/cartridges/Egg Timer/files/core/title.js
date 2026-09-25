/* ===========================================================================
   EGG TIMER — TITLE SCENE (Refinement 4 §6)
   ⏳ Placeholder art, until Gemini's: a cute mommy alien and her happy baby
   aliens, singing on a loop. The juxtaposition twist (Refinement 4 §0): mommy's
   smile runs a touch too wide, and one baby has slightly too many teeth.
   Pure inline SVG with CSS animation: it is built once at boot, draws nothing
   per frame from script, and never holds up the keyboard or the game's start.
   The music is Andrew's title track (audio.js's music("title"), Chat ruling 2026-09-25).
   The mode-selection screen gets its own creature (buildCritter, below).
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
    },

    /* Options creature (Andrew approved, 2026-09-23): on the mode-selection screen, a different picture from
       the title family. ⏳ Placeholder until Gemini's: one cuddly blob with three baby heads, each singing a
       little out of tune (mouths out of step, notes drifting crooked, one of them flat). Juxtaposition:
       adorable, slightly wrong, so one head has a single big eye and another has three.
       The eyes follow the cursor. It is CSS animation plus one transform per eye on a pointer move, throttled
       to a frame; it never listens for keys and never cancels an event, so it can't block or delay menu input. */
    buildCritter: function (host) {
      var svg = el("svg", { viewBox: "0 0 300 200", role: "img", "aria-label": "A cuddly alien blob with three singing baby heads" });
      var eyes = [];

      [["♪", 70, 44, 0], ["♫", 232, 40, 0.7], ["♭", 150, 12, 1.3]].forEach(function (n) {
        var t = el("text", { class: "note", x: n[1], y: n[2], style: "animation-delay:" + n[3] + "s" }, svg);
        t.textContent = n[0];
      });

      var body = el("g", { class: "breathe" }, svg);
      // three necks, drawn first so the heads and the blob sit over their ends
      [[-62, 98, 84], [0, 150, 58], [62, 204, 86]].forEach(function (p) {
        var d = "M" + (150 + p[0] * 0.45) + " 150 Q" + (150 + p[0] * 0.8) + " 118 " + p[1] + " " + (p[2] + 14);
        el("path", { class: "neck", d: d }, body);
        el("path", { class: "neck-fill", d: d }, body);
      });
      el("path", { class: "blob", d: "M60 178 C44 136 82 112 118 118 C140 104 168 104 186 118 C224 110 258 136 240 178 C226 196 74 196 60 178Z" }, body);
      [[104, 150, 7], [182, 142, 5], [150, 172, 6], [214, 166, 4], [88, 172, 4]].forEach(function (s) {
        el("circle", { class: "spot", cx: s[0], cy: s[1], r: s[2] }, body);
      });
      el("path", { class: "arm", d: "M84 158 Q106 172 122 160" }, body);   // stubby arms, hugging itself
      el("path", { class: "arm", d: "M216 158 Q194 172 178 160" }, body);
      el("ellipse", { class: "cheek", cx: 128, cy: 160, rx: 8, ry: 4 }, body);
      el("ellipse", { class: "cheek", cx: 172, cy: 160, rx: 8, ry: 4 }, body);

      /* One head at (x, y): `eyeAt` lists its eyes as [dx, dy, r]. The mouths sing at slightly different
         speeds (`beat`), so the three never quite land together. */
      function head(x, y, r, eyeAt, beat, delay, tilt) {
        var g = el("g", { transform: "translate(" + x + " " + y + ") rotate(" + tilt + ") scale(1.2)" }, body);
        var bob = el("g", { class: "bob", style: "animation-delay:" + delay + "s" }, g);
        el("circle", { class: "head", cx: 0, cy: 0, r: r }, bob);
        el("path", { class: "tuft", d: "M-3 " + (-r + 1) + " Q0 " + (-r - 12) + " 6 " + (-r - 8) }, bob);
        eyeAt.forEach(function (e) {
          var white = el("circle", { class: "eye", cx: e[0], cy: e[1], r: e[2] }, bob);
          var pupil = el("circle", { class: "pupil", cx: e[0], cy: e[1], r: e[2] * 0.48 }, bob);
          eyes.push({ white: white, pupil: pupil, r: e[2], max: e[2] * 0.46 });
        });
        var mouth = el("g", { class: "mouth", style: "animation-duration:" + beat + "s;animation-delay:" + delay + "s" }, bob);
        el("ellipse", { class: "mouth-hole", cx: 0, cy: r * 0.45, rx: r * 0.28, ry: r * 0.24 }, mouth);
        return g;
      }
      head(98, 84, 24, [[-9, -4, 6.5], [9, -4, 6.5]], 0.26, 0, -8);
      head(150, 58, 27, [[0, -6, 11]], 0.31, 0.2, 2);                      // one big eye
      head(204, 86, 23, [[-11, -3, 5], [0, -10, 5], [11, -3, 5]], 0.37, 0.45, 9);   // one eye too many

      host.appendChild(svg);

      // the eyes follow the pointer, at most one update a frame
      var pending = null;
      function look() {
        var p = pending;
        pending = null;
        if (!p || host.closest(".screen").hidden) return;
        eyes.forEach(function (e) {
          var b = e.white.getBoundingClientRect();
          if (!b.width) return;
          var px = b.width / (2 * e.r);                                   // screen px per SVG unit
          var dx = p.x - (b.left + b.width / 2), dy = p.y - (b.top + b.height / 2);
          var d = Math.hypot(dx, dy) || 1;
          var k = Math.min(e.max, d / px / 6) / d;                          // eases in as the pointer nears
          e.pupil.setAttribute("transform", "translate(" + (dx * k).toFixed(2) + " " + (dy * k).toFixed(2) + ")");
        });
      }
      document.addEventListener("pointermove", function (ev) {
        if (!pending) requestAnimationFrame(look);
        pending = { x: ev.clientX, y: ev.clientY };
      }, { passive: true });

      return svg;
    }
  };
})(window);

/* ===========================================================================
   EGG TIMER — HOW TO PLAY, the cartoon (E57, ruled 2026-10-02: approved as proposed)
   One stage in place of E29's five panels, on the title's How To Play card and the options panel: a big nest (the
   game's own nest and egg art) with its readout, a mini Command Line, the step's caption in a speech bubble, and six
   step dots. Six steps, one at a time, then round again (CONFIG.howtoStepSeconds [T]):
     1 the Queen lays an egg · 2 the CAV runs out, the egg cracks · 3 a fast clear · 4 a slow clear
     5 a hospital egg: the H sign, RCAV, CAV STR, sweet Mom patches it · 6 too slow: the crab hatches and hops
   Every copy runs on one clock, so both screens show the same step. The clock runs on real time, only while a copy
   is on screen and the tab is showing; nothing here takes a key or a click. No sound: the title music plays on.
   Reduced motion: the still strip instead, six panels, each its step's key frame, with the same captions.
   The steps are painted from (step, seconds into it), so a rig can set any moment with ET.howto.at(t).
   ========================================================================= */
(function (root) {
  var ET = (root.ET = root.ET || {});
  var NS = "http://www.w3.org/2000/svg";
  var UNIT = "2101";

  // Andrew's captions (2026-10-02), word for word; step 5's is his "Caption:" line
  var CAPTIONS = [
    "The Queen lays an egg",
    "The CAV runs out, the egg starts to crack",
    "Fast clear: pan, neat splat, big points",
    "Slow clear: messier splat, fewer points",
    "Hospital egg? Get the STR on, and Mom patches it up",
    "Too slow: the egg hatches, the crab dances and does its goofy hop"
  ];
  // the still strip's key frame for each step (seconds into it)
  var KEY = [1.25, 2.2, 1.6, 1.8, 2.6, 1.2];

  var live = [];          // the animated copies
  var stills = [];        // the reduced-motion strips' panels
  var clock = { t: 0, at: 0, frozen: false };
  var dataIn = false;     // the crab and the splat pictures wait for the data

  function C() { return ET.CONFIG; }
  function lens() { return C().howtoStepSeconds; }
  function loop() { return lens().reduce(function (a, b) { return a + b; }, 0); }
  function clamp(x) { return Math.max(0, Math.min(1, x)); }
  function two(x) { return (x < 10 ? "0" : "") + x; }
  function mmss(s) { s = Math.max(0, Math.floor(s)); return two(Math.floor(s / 60) % 100) + ":" + two(s % 60); }
  function div(cls) { var d = document.createElement("div"); d.className = cls; return d; }
  var motion = root.matchMedia ? root.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function reduced() { return !!(motion && motion.matches); }

  /* Which step a moment of the loop falls in, and how far into it. */
  function locate(t) {
    var L = loop(), s = lens();
    t = ((t % L) + L) % L;
    for (var k = 0; k < s.length; k++) { if (t < s[k]) return { k: k, u: t }; t -= s[k]; }
    return { k: s.length - 1, u: s[s.length - 1] };
  }

  /* One stage: the cord, the nest with its readout, the H sign, the pan, and a layer for the points, dish, goo and Mom. */
  function buildStage() {
    var stage = div("toon-stage");
    var cord = document.createElementNS(NS, "svg");
    cord.setAttribute("class", "toon-cord");
    cord.setAttribute("aria-hidden", "true");
    var g = document.createElementNS(NS, "g");
    var lines = ["cord-outline", "cord-line", "cord-stripes", "cord-ribs"].map(function (c) {
      var p = document.createElementNS(NS, "path"); p.setAttribute("class", c); g.appendChild(p); return p;
    });
    var bulge = document.createElementNS(NS, "ellipse");
    bulge.setAttribute("class", "cord-bulge");
    g.appendChild(bulge);
    cord.appendChild(g);
    var toon = div("toon");
    toon.dataset.state = "idle";
    var svg = ET.art.nestSvg();
    toon.appendChild(svg);
    var ro = div("readout");
    ro.innerHTML = '<span class="unit">' + UNIT + '</span><span class="code"></span><span class="clock">--:--</span>';
    toon.appendChild(ro);
    var sign = ET.art.hSignEl();
    sign.hidden = true;
    toon.appendChild(sign);
    var pan = ET.art.panEl();
    toon.appendChild(pan);
    var fx = div("toon-fx");
    toon.appendChild(fx);
    stage.appendChild(cord);
    stage.appendChild(toon);
    return {
      stage: stage, toon: toon, svg: svg, cord: g, lines: lines, bulge: bulge, sign: sign, pan: pan, fx: fx,
      egg: svg.querySelector(".egg"), cracks: svg.querySelectorAll(".crack"), brk: svg.querySelector(".break"),
      creature: svg.querySelector(".creature"), code: ro.querySelector(".code"), clockEl: ro.querySelector(".clock"),
      k: -1, fired: {}, mend: null
    };
  }

  function miniLine() {
    var m = div("toon-mini");
    m.setAttribute("aria-hidden", "true");
    m.innerHTML = '<span class="num">1</span><span class="typed"></span>';
    return m;
  }

  /* The animated cartoon: the stage, the mini Command Line, the caption, the dots; and, for reduced motion, the still
     strip. Both are in the card; style.css shows one. */
  function build() {
    var box = div("cartoon");
    var anim = div("toon-anim");
    anim.setAttribute("aria-hidden", "true");
    var st = buildStage(), mini = miniLine();
    var say = document.createElement("p");
    say.className = "say";
    var dots = document.createElement("ol");
    dots.className = "dots";
    CAPTIONS.forEach(function () { dots.appendChild(document.createElement("li")); });
    anim.appendChild(st.stage);
    anim.appendChild(mini);
    anim.appendChild(say);
    anim.appendChild(dots);
    box.appendChild(anim);
    st.typed = mini.querySelector(".typed");
    st.say = say;
    st.dots = dots.children;
    st.anim = anim;
    live.push(st);

    // the still strip (reduced motion), which also carries every caption for a screen reader
    var strip = document.createElement("ol");
    strip.className = "strip toon-still";
    CAPTIONS.forEach(function (text, k) {
      var li = document.createElement("li");
      li.className = "cell";
      li.dataset.step = k + 1;
      var num = document.createElement("span");
      num.className = "num";
      num.setAttribute("aria-hidden", "true");
      num.textContent = String(k + 1);
      li.appendChild(num);
      var p = buildStage();
      p.stage.setAttribute("aria-hidden", "true");
      p.still = true;
      li.appendChild(p.stage);
      var b = document.createElement("p");
      b.className = "say";
      b.textContent = text;
      li.appendChild(b);
      strip.appendChild(li);
      p.key = k;
      stills.push(p);
    });
    box.appendChild(strip);
    paint(st, locate(clock.t));
    return box;
  }

  /* ------------------------------------------------------------- painting */
  function setState(s, state) { if (s.toon.dataset.state !== state) s.toon.dataset.state = state; }
  function cls(s, name, on) { if (s.toon.classList.contains(name) !== !!on) s.toon.classList.toggle(name, !!on); }
  function readout(s, code, secs, bold) {
    if (s.code.textContent !== code) s.code.textContent = code;
    var c = secs === null ? "--:--" : mmss(secs);
    if (s.clockEl.textContent !== c) s.clockEl.textContent = c;
    cls(s, "bold", bold);
  }
  /* the egg: its size (0.35 laid → 1 at the bold), its cracks and hints, the wobble while bold, and the drop at the pop */
  function egg(s, scale, crack, wobble, drop) {
    var w = wobble && !s.still && !reduced() ? Math.sin(performance.now() / 1000 * 38) * (3 + 6 * crack) : 0;
    s.egg.setAttribute("transform", "translate(0 " + (20 + (drop || 0)).toFixed(2) + ") rotate(" + w.toFixed(2) + ") scale(" + scale.toFixed(3) + ") translate(0 -20)");
    var off = String(1 - crack);
    for (var i = 0; i < s.cracks.length; i++) s.cracks[i].style.strokeDashoffset = off;
    var at = C().eggHintsAt;
    for (var h in at) cls(s, "show-" + h, crack >= at[h] && h !== "hint-eye");
  }
  /* the cord from the stage's top to just over the egg: `tip` 0–1 of the way down, the bulge at `bulge` (0–1), or none */
  function cord(s, tip, bulge) {
    var show = tip > 0.001;
    s.cord.style.display = show ? "" : "none";
    if (!show) return;
    var w = s.toon.offsetWidth, x = s.toon.offsetLeft + w / 2;
    var eggY = s.toon.offsetTop + (w * 110 / 120) * (54 / 110);
    var end = eggY - 2.2 * 28 * C().eggMinScale * w / 120, y = end * tip;
    var d = "M" + x.toFixed(1) + " 0 L" + x.toFixed(1) + " " + Math.max(0, y).toFixed(1);
    s.lines.forEach(function (l) { l.setAttribute("d", d); });
    s.bulge.style.display = bulge === null ? "none" : "";
    if (bulge !== null) {
      var ry = 28 * C().eggMinScale * w / 120 * 1.3;
      s.bulge.setAttribute("cx", x.toFixed(1)); s.bulge.setAttribute("cy", (end * bulge).toFixed(1));
      s.bulge.setAttribute("rx", (ry * 0.85).toFixed(1)); s.bulge.setAttribute("ry", ry.toFixed(1));
    }
  }
  function type(s, text, u, u0, u1) {
    if (!s.typed) return;
    var n = u < u0 ? 0 : Math.round(clamp((u - u0) / (u1 - u0)) * text.length);
    var t = text.slice(0, n);
    if (s.typed.textContent !== t) s.typed.textContent = t;
  }
  function once(s, name, when, u, fn) { if (u >= when && !s.fired[name]) { s.fired[name] = true; fn(); } }
  function points(s, n) {
    var p = div("popup good" + (s.still ? " held" : ""));
    p.textContent = "+" + n;
    s.fx.appendChild(p);
  }
  function slam(s) {
    if (s.still) return;   // the still strip shows what's left, not the swing
    s.pan.className = "pan";
    void s.pan.offsetWidth;
    s.pan.style.setProperty("--pan", C().panSeconds + "s");
    s.pan.className = "pan hit";
  }
  function goo(s) {
    [[8, 58, 1], [80, 50, 0.8], [18, 22, 0.7], [70, 18, 0.9], [44, 70, 0.6]].forEach(function (b) {
      var g = div("goo");
      g.style.left = b[0] + "%"; g.style.top = b[1] + "%"; g.style.transform = "scale(" + b[2] + ")";
      s.fx.appendChild(g);
    });
  }
  /* Sweet Mom in step 5 (Mom kit, 2026-10-02): the game's own visit (core/mom.js), in the stage's fx layer. She comes
     down from the top of the stage, which clips her (the stage is her play field), her head about three quarters of
     the nest's width, smaller if the stage is short, never lower than the top of the egg. */
  function momLayout(s) {
    var P = ET.MOM_PARTS.sweet, f = s.fx.getBoundingClientRect(), st = s.stage.getBoundingClientRect();
    var g = s.egg.querySelector(".mirror") || s.egg, m = g.getScreenCTM();
    var at = function (x, y) { return { x: m.a * x + m.c * y + m.e - f.left, y: m.b * x + m.d * y + m.f - f.top }; };
    var mid = at(0, -9), top = at(0, -38), ew = 44 * Math.hypot(m.a, m.b);
    var clip = { l: st.left - f.left, t: st.top - f.top, r: st.right - f.left, b: st.bottom - f.top };
    var hw = s.toon.offsetWidth * C().momHeadShare, hh = hw * P.head[1] / P.head[0];
    var room = top.y - clip.t - 2;
    if (hh > room && room > 10) { hh = room; hw = hh * P.head[0] / P.head[1]; }
    return { kind: "sweet", headW: hw, head: { x: mid.x, y: clip.t + 1 + hh / 2 }, egg: { x: mid.x, y: mid.y, w: ew, top: top.y },
      from: "top", tilt: 0, clip: clip };
  }
  /* a new step: everything back to an empty nest */
  function reset(s, k) {
    s.k = k;
    s.fired = {};
    s.mend = null;
    s.mom = null;
    s.fx.innerHTML = "";
    s.pan.className = "pan";
    s.sign.hidden = true;
    s.toon.classList.remove("bold", "asks", "hop", "popping");
    delete s.toon.dataset.hatch;
    setState(s, "idle");
    readout(s, "", null, false);
    egg(s, C().eggMinScale, 0, false, 0);
    cord(s, 0, null);
    type(s, "", 0, 1, 2);
    if (s.say) { s.say.textContent = CAPTIONS[k]; for (var i = 0; i < s.dots.length; i++) s.dots[i].classList.toggle("on", i === k); }
  }

  var MIN = function () { return C().eggMinScale; };
  var STEPS = [
    // 1. The Queen lays an egg: the cord drops (0–0.45), the bulge travels down it (to 1.0), the egg pops out into
    //    the nest (to 1.4), and the cord goes back up while the clock runs toward 10:00
    function (s, u) {
      readout(s, "VS", u >= 1.4 ? (u - 1.4) / 1.1 * 570 : null, false);
      if (u < 1.0) {
        setState(s, "laying");
        cls(s, "popping", false);
        cord(s, u < 0.45 ? u / 0.45 : 1, u >= 0.45 ? (u - 0.45) / 0.55 : null);
      } else if (u < 1.4) {
        setState(s, "laying");
        cls(s, "popping", true);
        var half = 28 * MIN(), tip = -8 - 2.2 * half, start = tip + 2 * half - 20;
        egg(s, MIN() * (0.7 + 0.3 * (u - 1.0) / 0.4), 0, false, start * (1 - (u - 1.0) / 0.4));
        cord(s, 1, null);
      } else {
        setState(s, "active");
        cls(s, "popping", false);
        egg(s, MIN() + (1 - MIN()) * 0.95 * (u - 1.4) / 1.1, 0, false, 0);
        cord(s, 1 - (u - 1.4) / 1.1, null);
      }
    },
    // 2. The CAV runs out: 10:00 at 0.4, the boxes go bold, the timer pink, the cracks draw in and the egg wobbles
    function (s, u) {
      var bold = u >= 0.4;
      setState(s, bold ? "overtime" : "active");
      readout(s, "VS", bold ? 600 + (u - 0.4) * 20 : 570 + u * 75, bold);
      egg(s, bold ? 1 : MIN() + (1 - MIN()) * (0.95 + 0.05 * u / 0.4), bold ? clamp((u - 0.4) / 2.1) * 0.7 : 0, bold, 0);
    },
    // 3. A fast clear: RCAV types itself, the pan, break stage 1, +100 and a fancy dish
    function (s, u) {
      type(s, u < 0.9 ? "RCAV " + UNIT : "", u, 0.1, 0.8);
      if (u < 0.9) {
        setState(s, "overtime");
        readout(s, "VS", 601 + u * 5, true);
        egg(s, 1, 0.1, true, 0);
      }
      once(s, "clear", 0.9, u, function () {
        slam(s);
        setState(s, "splat");
        readout(s, "VS", 606, false);
        ET.breaks.fill(s.brk, 1);
        points(s, C().clearTierPoints[0]);
        var d = ET.art.dishEl(4, "");
        d.removeChild(d.querySelector(".caption"));
        if (s.still) d.classList.add("held");
        s.fx.appendChild(d);
      });
    },
    // 4. A slow clear: an egg already well cracked, RCAV, the pan, break stage 4, gunk round it, +35
    function (s, u) {
      type(s, u < 0.95 ? "RCAV " + UNIT : "", u, 0.15, 0.85);
      if (u < 0.95) {
        setState(s, "overtime");
        readout(s, "VS", 612 + u * 4, true);
        egg(s, 1, 0.8 + 0.05 * u, true, 0);
      }
      once(s, "clear", 0.95, u, function () {
        slam(s);
        setState(s, "splat");
        readout(s, "VS", 616, false);
        ET.breaks.fill(s.brk, 4);
        goo(s);
        points(s, C().clearTierPoints[3]);
      });
    },
    // 5. A hospital egg: the H sign drops in; at the crack RCAV empties the type box (its cyan pulse), then CAV STR;
    //    sweet Mom pops in, patches the cracks closed and giggles (silent here), and the box reads STR
    function (s, u) {
      s.sign.hidden = false;
      var removed = u >= 1.1, repaired = u >= 2.05, bold = u >= 0.35 && !repaired;
      setState(s, bold ? "overtime" : "active");
      cls(s, "asks", removed && !repaired);
      readout(s, removed && !repaired ? "" : repaired ? "STR" : "VS", repaired ? (u - 2.05) * 30 : u < 0.35 ? 590 + u * 28 : 600 + (u - 0.35) * 20, bold);
      var crack = bold ? clamp((u - 0.35) / 1.7) * 0.4 : 0;
      if (repaired) crack = 0.4 * clamp(1 - (u - 2.05 - 0.375) / 0.375);   // closing as she patches (0.25–0.5 of her visit)
      egg(s, 1, crack, bold, 0);
      type(s, u < 1.1 ? "RCAV " + UNIT : u < 2.05 ? "CAV " + UNIT + " " + C().hospitalType : "", u, u < 1.1 ? 0.45 : 1.2, u < 1.1 ? 1.05 : 2.0);
      once(s, "mom", 2.05, u, function () {
        s.mom = ET.mom.visit(s.fx, momLayout(s));
        points(s, C().clearTierPoints[1]);
      });
      // her visit, painted from this step's own clock (the still strip: its key frame, pose A with the plaster on)
      if (s.mom) {
        var mu = (u - 2.05) / C().momRepairSeconds;
        if (mu < 1) s.mom.paint(Math.max(0, mu), s.still || reduced());
        else { s.mom.el.remove(); s.mom = null; }
      }
    },
    // 6. Too slow: the egg cracks through and the crab comes out, scurries, dances and hops at the viewer (the cute
    //    hatch from play; never a horror alien, never the jump scare)
    function (s, u) {
      if (u < 0.4) {
        setState(s, "overtime");
        readout(s, "VS", 618 + u * 10, true);
        egg(s, 1, 0.9 + 0.1 * u / 0.4, true, 0);
      }
      once(s, "hatch", 0.4, u, function () {
        setState(s, "escape");
        readout(s, "VS", 622, false);
        s.toon.dataset.hatch = "cute";
        s.toon.style.setProperty("--hatch", (lens()[5] - 0.4) + "s");
        if (!s.creature.classList.contains("has-art")) ET.aliens.fill(s.creature, C().howtoAlien);
        s.toon.classList.add("hop");
      });
    }
  ];

  function paint(s, at) {
    if (s.k !== at.k) reset(s, at.k);
    STEPS[at.k](s, at.u);
  }
  /* a moment painted from scratch: the step restarted, and its events run in order up to it */
  function paintFresh(s, k, u) {
    reset(s, k);
    for (var x = 0; x < u; x += 0.05) STEPS[k](s, x);
    STEPS[k](s, u);
  }
  /* a still panel paints its key frame once it's on screen, and again if its size changes (the cord is measured) */
  function paintStills() {
    stills.forEach(function (s) {
      var w = s.stage.offsetWidth;
      if (!w || w === s.pw) return;
      s.pw = w;
      paintFresh(s, s.key, KEY[s.key]);
    });
  }

  /* The clock: real time, while a copy is on screen and the tab shows; frozen by a rig's at(). */
  function frame(now) {
    var dt = clock.at ? Math.min(0.1, (now - clock.at) / 1000) : 0;
    clock.at = now;
    // which copies are on screen: their screen isn't hidden (an attribute read, so play never pays for a layout here)
    var shown = live.filter(function (s) { var sc = s.anim.closest(".screen"); return !!sc && !sc.hidden; });
    if (dataIn && shown.length && reduced()) paintStills();
    if (shown.length && !document.hidden && !reduced()) {
      if (!clock.frozen) clock.t += dt;
      var at = locate(clock.t);
      shown.forEach(function (s) { paint(s, at); });
    }
    root.requestAnimationFrame(frame);
  }

  ET.howto = {
    CAPTIONS: CAPTIONS,
    build: build,
    /* once the data is in: the crab goes into every copy, and the still strip paints its key frames (their splat
       pictures load then, never holding the data back) */
    ready: function () {
      dataIn = true;
      ET.mom.preload("sweet");   // step 5's sweet Mom, now the data is in
      live.concat(stills).forEach(function (s) { if (!s.creature.classList.contains("has-art")) ET.aliens.fill(s.creature, C().howtoAlien); });
      stills.forEach(function (s) { s.pw = 0; });
    },
    start: function () { root.requestAnimationFrame(frame); },
    /* For rigs: hold the cartoon at `t` seconds into its loop (painted at once), or let it run again (null). */
    at: function (t) {
      if (t === null) { clock.frozen = false; return null; }
      clock.frozen = true;
      clock.t = t;
      var at = locate(t);
      live.forEach(function (s) { paintFresh(s, at.k, at.u); });
      return at;
    },
    /* For rigs: paint the still strips' key frames now (as a frame under reduced motion would). */
    stills: function () { stills.forEach(function (s) { s.pw = 0; }); paintStills(); return stills.length; },
    state: function () { var at = locate(clock.t); return { t: clock.t, step: at.k + 1, u: at.u, frozen: clock.frozen, loop: loop() }; }
  };
})(window);

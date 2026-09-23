/* ===========================================================================
   EGG TIMER — ARCADE ATTRACT LIGHTS (Andrew approved, 2026-09-23)
   ⏳ Placeholder look until Gemini's: a string of bulbs along a panel's
   outline, blinking at random like an arcade machine calling players. One
   string rings the how-to panel, another the title screen's How To Play card
   (Refinement 6 §1); only the strings on screen run.
     attract   the title, options and game-over screens: lively random blinking,
               with a chase running round the panel now and then
     calm      play and cleanup: a slow, dim twinkle that never pulls the eye
               from the nests (only the how-to panel is ever calm)
   🚨 SAFETY: every bulb change goes through set(), which refuses a change less
   than lightsMinToggle (0.2 s) after that bulb's last one, in every mode. So no
   bulb can flash more than 2.5 times a second, and the only group pattern (the
   chase) moves a lit patch along; it never flashes a panel as a whole.
   The bulbs sit on the panel's border line, clear of its padding, so they are
   never behind a word. Nothing here takes a key or a click.
   ========================================================================= */
(function (root) {
  var ET = (root.ET = root.ET || {});
  var C = function () { return ET.CONFIG; };

  var strings = [], timer = null, last = 0, log = [], gen = 0;

  function now() { return performance.now() / 1000; }
  function shown(s) { return s.host.offsetParent !== null; }
  function calm(s) { return s.host.classList.contains("calm"); }

  /* Change one bulb, unless it changed too recently: the one place a bulb ever changes. */
  function set(s, b, on, t) {
    if (!b || b.on === on) return false;
    if (t - b.last < C().lightsMinToggle) return false;          // 🚨 the flash-rate guard
    if (calm(s) && t - b.last < C().lightsCalmMinToggle) return false;
    b.on = on;
    b.last = t;
    b.el.classList.toggle("on", on);
    log.push({ id: b.id, on: on, t: t });
    if (log.length > 6000) log.splice(0, 2000);
    return true;
  }

  /* Lay a string's bulbs along its panel's border, evenly on each straight edge, clear of the rounded corners. */
  function layout(s) {
    var W = s.host.offsetWidth, H = s.host.offsetHeight, sp = C().lightsSpacing, inset = 18, edge = 2;
    if (!W || !H) return;
    var spots = [];
    function run(x0, y0, x1, y1) {
      var len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(len / sp));
      for (var i = 0; i <= n; i++) spots.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]);
    }
    run(inset, edge, W - inset, edge);                    // top, left to right
    run(W - edge, inset + sp, W - edge, H - inset - sp);  // right, down
    run(W - inset, H - edge, inset, H - edge);            // bottom, right to left
    run(edge, H - inset - sp, edge, inset + sp);          // left, up (so a chase goes round)
    var t = now();
    s.layer.innerHTML = "";
    gen++;
    s.bulbs = spots.map(function (p, i) {
      var el = document.createElement("i");
      el.className = "bulb";
      el.style.left = p[0].toFixed(1) + "px";
      el.style.top = p[1].toFixed(1) + "px";
      s.layer.appendChild(el);
      return { id: gen + ":" + i, el: el, on: false, last: t };   // new bulbs start off and wait out the guard
    });
    s.chase = null;
  }

  function tickString(s, t, dt) {
    var K = C(), bulbs = s.bulbs;
    if (!bulbs.length) return;
    if (!calm(s)) {
      bulbs.forEach(function (b) { if (Math.random() < K.lightsAttractRate * dt) set(s, b, !b.on, t); });
      if (!s.chase && t >= s.nextChase) s.chase = { at: t, from: Math.floor(Math.random() * bulbs.length) };
      if (s.chase) {
        // a lit patch of lightsChaseLength bulbs running once round the panel
        var head = Math.floor((t - s.chase.at) * K.lightsChaseSpeed);
        if (head > bulbs.length + K.lightsChaseLength) {
          s.chase = null;
          s.nextChase = t + K.lightsChaseEvery[0] + Math.random() * (K.lightsChaseEvery[1] - K.lightsChaseEvery[0]);
        } else {
          set(s, bulbs[(s.chase.from + head) % bulbs.length], true, t);
          if (head >= K.lightsChaseLength) set(s, bulbs[(s.chase.from + head - K.lightsChaseLength) % bulbs.length], false, t);
        }
      }
    } else {
      bulbs.forEach(function (b) { if (Math.random() < K.lightsCalmRate * dt) set(s, b, !b.on, t); });
    }
  }

  function tick() {
    var t = now(), dt = Math.min(0.2, t - last);
    last = t;
    strings.forEach(function (s) { if (shown(s)) tickString(s, t, dt); });
  }

  function visible() { return strings.filter(shown); }

  ET.lights = {
    /* Ring a panel with a string of bulbs. */
    build: function (panel) {
      var s = { host: panel, layer: document.createElement("div"), bulbs: [], chase: null, nextChase: now() + 1 };
      s.layer.className = "bulbs";
      s.layer.setAttribute("aria-hidden", "true");
      panel.appendChild(s.layer);
      strings.push(s);
      if (root.ResizeObserver) new ResizeObserver(function () { layout(s); }).observe(panel);
      layout(s);
      if (!timer) {
        last = now();
        if (!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches)) timer = setInterval(tick, 50);
      }
    },

    /* "attract" on the menu screens, "calm" in play and cleanup: it is the how-to panel (the first string) that calms. */
    mode: function (m) {
      if (!strings.length) return;
      strings[0].host.classList.toggle("calm", m === "calm");
      strings[0].chase = null;
    },

    /* For rigs: the change log (bulb id, on/off, seconds), the mode and bulbs of the strings on screen, and a
       direct try at a change, which goes through the same guard as everything else. */
    log: function () { return log.slice(); },
    clearLog: function () { log = []; },
    state: function () {
      var v = visible(), all = [].concat.apply([], v.map(function (s) { return s.bulbs; }));
      return { mode: v.some(calm) ? "calm" : "attract", bulbs: all.length, lit: all.filter(function (b) { return b.on; }).length };
    },
    tryToggle: function (i) { var s = visible()[0], b = s && s.bulbs[i]; return !!b && set(s, b, !b.on, now()); }
  };
})(window);

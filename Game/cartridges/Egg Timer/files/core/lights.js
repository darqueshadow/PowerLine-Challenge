/* ===========================================================================
   EGG TIMER — ARCADE ATTRACT LIGHTS (Andrew approved, 2026-09-23)
   ⏳ Placeholder look until Gemini's: a string of bulbs along the how-to
   panel's outline, blinking at random like an arcade machine calling players.
     attract   the title, options and game-over screens: lively random blinking,
               with a chase running round the panel now and then
     calm      play and cleanup: a slow, dim twinkle that never pulls the eye
               from the nests
   🚨 SAFETY: every bulb change goes through set(), which refuses a change less
   than lightsMinToggle (0.2 s) after that bulb's last one, in every mode. So no
   bulb can flash more than 2.5 times a second, and the only group pattern (the
   chase) moves a lit patch along; it never flashes the panel as a whole.
   The bulbs sit on the panel's border line, clear of its padding, so they are
   never behind a word. Nothing here takes a key or a click.
   ========================================================================= */
(function (root) {
  var ET = (root.ET = root.ET || {});
  var C = function () { return ET.CONFIG; };

  var host = null, layer = null, bulbs = [], mode = "attract", timer = null, last = 0;
  var chase = null, nextChase = 0, log = [];

  function now() { return performance.now() / 1000; }

  /* Change one bulb, unless it changed too recently: the one place a bulb ever changes. */
  function set(b, on, t) {
    if (!b || b.on === on) return false;
    if (t - b.last < C().lightsMinToggle) return false;          // 🚨 the flash-rate guard
    if (mode === "calm" && t - b.last < C().lightsCalmMinToggle) return false;
    b.on = on;
    b.last = t;
    b.el.classList.toggle("on", on);
    log.push({ id: b.id, on: on, t: t });
    if (log.length > 6000) log.splice(0, 2000);
    return true;
  }

  /* Lay the bulbs along the panel's border, evenly on each straight edge, clear of the rounded corners. */
  var gen = 0;
  function layout() {
    if (!host) return;
    var W = host.offsetWidth, H = host.offsetHeight, s = C().lightsSpacing, inset = 18, edge = 2;
    var spots = [];
    function run(x0, y0, x1, y1) {
      var len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(len / s));
      for (var i = 0; i <= n; i++) spots.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]);
    }
    run(inset, edge, W - inset, edge);                  // top, left to right
    run(W - edge, inset + s, W - edge, H - inset - s);  // right, down
    run(W - inset, H - edge, inset, H - edge);          // bottom, right to left
    run(edge, H - inset - s, edge, inset + s);          // left, up (so a chase goes round)
    var t = now();
    layer.innerHTML = "";
    gen++;
    bulbs = spots.map(function (p, i) {
      var el = document.createElement("i");
      el.className = "bulb";
      el.style.left = p[0].toFixed(1) + "px";
      el.style.top = p[1].toFixed(1) + "px";
      layer.appendChild(el);
      return { id: gen + ":" + i, el: el, on: false, last: t };   // new bulbs start off and wait out the guard
    });
    chase = null;
  }

  function tick() {
    var t = now(), dt = Math.min(0.2, t - last);
    last = t;
    if (!bulbs.length) return;
    var K = C();
    if (mode === "attract") {
      bulbs.forEach(function (b) { if (Math.random() < K.lightsAttractRate * dt) set(b, !b.on, t); });
      if (!chase && t >= nextChase) chase = { at: t, from: Math.floor(Math.random() * bulbs.length) };
      if (chase) {
        // a lit patch of lightsChaseLength bulbs running once round the panel
        var head = Math.floor((t - chase.at) * K.lightsChaseSpeed);
        if (head > bulbs.length + K.lightsChaseLength) {
          chase = null;
          nextChase = t + K.lightsChaseEvery[0] + Math.random() * (K.lightsChaseEvery[1] - K.lightsChaseEvery[0]);
        } else {
          set(bulbs[(chase.from + head) % bulbs.length], true, t);
          if (head >= K.lightsChaseLength) set(bulbs[(chase.from + head - K.lightsChaseLength) % bulbs.length], false, t);
        }
      }
    } else {
      bulbs.forEach(function (b) { if (Math.random() < K.lightsCalmRate * dt) set(b, !b.on, t); });
    }
  }

  ET.lights = {
    build: function (panel) {
      host = panel;
      layer = document.createElement("div");
      layer.className = "bulbs";
      layer.setAttribute("aria-hidden", "true");
      host.appendChild(layer);
      if (root.ResizeObserver) new ResizeObserver(layout).observe(host);
      layout();
      last = now();
      nextChase = last + 1;
      if (!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches)) timer = setInterval(tick, 50);
    },

    /* "attract" on the menu screens, "calm" in play and cleanup. */
    mode: function (m) {
      if (m === mode) return;
      mode = m;
      chase = null;
      host.classList.toggle("calm", m === "calm");
    },

    /* For rigs: the change log (bulb id, on/off, seconds), the mode, the bulbs, and a direct try at a change,
       which goes through the same guard as everything else. */
    log: function () { return log.slice(); },
    clearLog: function () { log = []; },
    state: function () { return { mode: mode, bulbs: bulbs.length, lit: bulbs.filter(function (b) { return b.on; }).length }; },
    tryToggle: function (i) { var b = bulbs[i]; return set(b, !b.on, now()); }
  };
})(window);

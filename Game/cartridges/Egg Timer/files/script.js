/* ===========================================================================
   EGG TIMER — MAIN
   Boot, screens, the frame loop and the keyboard. The mechanic is in
   core/game.js; this file only wires it to the page.

   Screens: title → setup (mode buttons + Command Box count, one combined step)
            → play → over → setup.
   ⏳ The title and end screens here are functional placeholders: their design
   is deferred (packet §11 items 14–15). There is no instruction screen yet.
   ========================================================================= */
(function () {
  var ET = window.ET;
  var C = ET.CONFIG;

  var MODES = [
    { id: "clear", label: "CLEAR CAVs ONLY" },
    { id: "progression", label: "FOLLOW PROGRESSION" },
    { id: "both", label: "BOTH" }
  ];

  var app = {
    screen: "boot",
    data: null,
    game: null,
    modeIndex: 0,
    boxes: 1,
    paused: false,
    overTimer: null,
    last: 0
  };

  var params = new URLSearchParams(location.search);
  var SEED = params.has("seed") ? Number(params.get("seed")) : null;

  function $(sel) { return document.querySelector(sel); }

  function show(name) {
    app.screen = name;
    document.querySelectorAll(".screen").forEach(function (s) { s.hidden = s.id !== "screen-" + name; });
    if (name === "setup") paintSetup();
    if (name === "play") ET.boxes.focus();
  }

  /* ---------------------------------------------------------------- setup */
  function paintSetup() {
    document.querySelectorAll("[data-mode]").forEach(function (b) {
      b.classList.toggle("selected", b.dataset.mode === MODES[app.modeIndex].id);
    });
    document.querySelectorAll("[data-boxes]").forEach(function (b) {
      b.classList.toggle("selected", Number(b.dataset.boxes) === app.boxes);
    });
  }

  function setupKey(ev) {
    var k = ev.key;
    if (k === "ArrowLeft" || k === "ArrowRight") {
      ev.preventDefault();
      app.modeIndex = (app.modeIndex + (k === "ArrowRight" ? 1 : -1) + MODES.length) % MODES.length;
      paintSetup();
    } else if (k === "ArrowUp" || k === "ArrowDown") {
      ev.preventDefault();
      app.boxes = Math.max(C.boxesMin, Math.min(C.boxesMax, app.boxes + (k === "ArrowUp" ? 1 : -1)));
      paintSetup();
    } else if (/^[1-4]$/.test(k)) {
      ev.preventDefault();
      app.boxes = Number(k);
      paintSetup();
    } else if (k === "Enter") {
      ev.preventDefault();
      startGame(MODES[app.modeIndex].id, app.boxes);
    }
  }

  /* ----------------------------------------------------------------- play */
  function startGame(mode, boxes) {
    clearTimeout(app.overTimer);
    var types = ET.devmode.on ? app.data.blankTypes : app.data.types;
    app.game = new ET.Game({
      mode: mode,
      boxes: boxes,
      types: types,
      units: app.data.units,
      rng: SEED === null ? Math.random : ET.seededRandom(SEED)
    });
    app.paused = false;
    $("#pause").hidden = true;
    $("#hud-mode").textContent = MODES.filter(function (m) { return m.id === mode; })[0].label;
    ET.view.reset();
    ET.boxes.setup(boxes);
    show("play");
    app.game.start();
    flush();
    ET.view.render(app.game.snapshot());
  }

  function flush() {
    var events = app.game.drain();
    events.forEach(function (e) {
      if (e.type === "wave-start") ET.boxes.clearInactive();
      if (e.type === "game-over") {
        ET.boxes.close();
        app.overTimer = setTimeout(gameOver, (C.escapeSeconds + 0.5) * 1000);
      }
    });
    ET.view.handle(events, app.game);
  }

  function stepGame(seconds) {
    var g = app.game;
    while (seconds > 1e-9 && (g.phase === "wave" || g.phase === "cleanup")) {
      var s = Math.min(seconds, 0.05);
      g.step(s);
      seconds -= s;
      flush();
    }
  }

  function gameOver() {
    var s = app.game.snapshot();
    $("#over-score").textContent = s.score;
    $("#over-wave").textContent = s.wave;
    $("#over-mode").textContent = $("#hud-mode").textContent;
    show("over");
  }

  function setPaused(on) {
    app.paused = on;
    $("#pause").hidden = !on;
    if (!on) ET.boxes.focus();
  }

  function submit(text) {
    if (!app.game || app.paused) return { ok: false };
    var r = app.game.submit(text);
    flush();
    return r;
  }

  /* ----------------------------------------------------------------- loop */
  function frame(now) {
    var dt = app.last ? Math.min(0.1, (now - app.last) / 1000) : 0;   // a hidden tab gets no frames, so no time passes
    app.last = now;
    if (app.screen === "play" && app.game) {
      if (!app.paused && !ET.devmode.isOpen()) stepGame(dt);
      ET.view.render(app.game.snapshot());
    }
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------- keyboard */
  document.addEventListener("keydown", function (ev) {
    if (ET.devmode.key(ev)) return;              // Ctrl+Shift+B, from any screen
    if (ET.devmode.isOpen()) return;             // the prompt's own input has the keys
    switch (app.screen) {
      case "title":
      case "over":
        if (ev.key === "Enter") { ev.preventDefault(); show("setup"); }
        return;
      case "setup":
        setupKey(ev);
        return;
      case "play":
        if (!app.game || app.game.phase === "over") { if (ev.key !== "F5") ev.preventDefault(); return; }
        if (app.paused) {
          if (ev.key === "Escape") { ev.preventDefault(); setPaused(false); }
          else if (!(ev.ctrlKey || ev.metaKey)) ev.preventDefault();
          return;
        }
        if (ET.boxes.key(ev)) return;
        if (ev.key === "Escape") { ev.preventDefault(); setPaused(true); }
        return;
    }
  }, true);

  /* the active box keeps the keyboard during play */
  document.addEventListener("focusout", function () {
    setTimeout(function () {
      if (app.screen === "play" && !ET.devmode.isOpen() && !app.paused) ET.boxes.focus();
    }, 0);
  });

  /* ---------------------------------------------------------------- boot */
  function wire() {
    ET.view.build();
    ET.boxes.build({ submit: submit });
    ET.devmode.build({
      toggled: function (on) {
        $("#setup-dev").hidden = !on;
      },
      closed: function () { if (app.screen === "play") ET.boxes.focus(); }
    });

    $("#screen-title").addEventListener("click", function () { if (app.data) show("setup"); });
    $("#screen-over").addEventListener("click", function () { show("setup"); });
    document.querySelectorAll("[data-mode]").forEach(function (b) {
      b.addEventListener("click", function () {
        app.modeIndex = MODES.map(function (m) { return m.id; }).indexOf(b.dataset.mode);
        paintSetup();
      });
    });
    document.querySelectorAll("[data-boxes]").forEach(function (b) {
      b.addEventListener("click", function () { app.boxes = Number(b.dataset.boxes); paintSetup(); });
    });
    $("#start").addEventListener("click", function () { startGame(MODES[app.modeIndex].id, app.boxes); });
  }

  wire();
  show("title");
  $("#title-prompt").textContent = "LOADING…";
  ET.data.load().then(function (data) {
    app.data = data;
    $("#title-prompt").textContent = "PRESS ENTER";
  }).catch(function (err) {
    app.screen = "error";
    $("#title-prompt").textContent = "COULDN'T LOAD THE CAV DATA";
    $("#title-error").hidden = false;
    $("#title-error").textContent = String(err && err.message || err) +
      " — run it over http:// (Game/Start Dev Server.bat), not by opening the file.";
  });
  requestAnimationFrame(frame);

  /* Rig hooks: read state, and drive the clock without waiting in real time. */
  window.__et = {
    screen: function () { return app.screen; },
    ready: function () { return !!app.data; },
    data: function () { return app.data; },
    start: function (mode, boxes) { startGame(mode, boxes || 1); return true; },
    snapshot: function () { return app.game ? app.game.snapshot() : null; },
    advance: function (seconds) { stepGame(seconds); ET.view.render(app.game.snapshot()); return app.game.snapshot().time; },
    submit: submit,
    boxes: function () { return ET.boxes.state(); },
    paused: function () { return app.paused; },
    mess: function (id) { return ET.mess.coverage(ET.view.nest(id).mess); },
    nestClass: function (id) { var v = ET.view.nest(id); return v.el.className + " state=" + v.el.dataset.state; }
  };
})();

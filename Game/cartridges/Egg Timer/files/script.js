/* ===========================================================================
   EGG TIMER — MAIN
   Boot, screens, the frame loop and the keyboard. The mechanic is in
   core/game.js; this file only wires it to the page.

   Screens: title → setup (mode buttons + Command Line count, one combined step)
            → play → over → setup.
   ⏳ The title and end screens here are functional placeholders: their design
   is deferred (packet §11 item 15). The how-to panel down one side of play
   (Refinement 2 §1) IS the instruction screen and command reference (E10).
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
  // ?clock=HH:MM starts the wall clock there, so ?seed=N&clock=14:00 replays a game exactly
  var CLOCK = /^(\d{1,2}):(\d{2})$/.exec(params.get("clock") || "");

  /* Where the wall clock starts: the player's own time of day (Timer Refinement §3). */
  function wallStart() {
    if (CLOCK) return (Number(CLOCK[1]) % 24) * 3600 + Number(CLOCK[2]) * 60;
    var d = new Date();
    return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  }

  function $(sel) { return document.querySelector(sel); }

  function show(name) {
    app.screen = name;
    document.querySelectorAll(".screen").forEach(function (s) { s.hidden = s.id !== "screen-" + name; });
    if (name === "setup") paintSetup();
    // Refinement 4 §6 and E21 (ruled): the title tune plays on the title AND mode-selection screens, so it's
    // heard once the first key or click has unlocked sound; it stops when a game starts
    ET.audio.titleTune(name === "title" || name === "setup");
    if (name === "play") ET.boxes.focus();
    ET.view.hose();   // the hose shows on the play screen only
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
      wallStart: wallStart(),
      rng: SEED === null ? Math.random : ET.seededRandom(SEED)
    });
    app.paused = false;
    $("#pause").hidden = true;
    $("#hud-mode").textContent = MODES.filter(function (m) { return m.id === mode; })[0].label;
    ET.view.reset();
    ET.boxes.setup(boxes);
    paintHowTo(mode);
    show("play");
    app.game.start();
    flush();
    ET.view.render(app.game.snapshot());
  }

  function flush() {
    var events = app.game.drain();
    events.forEach(function (e) {
      if (e.type === "wave-start") ET.boxes.clearInactive();
      // playtest log (Timer Refinement §9): spawns that came due with every nest busy
      if (e.type === "wave-end") console.info("[Egg Timer] wave " + e.wave + ": " + e.skipped + " skipped spawn(s)");
      if (e.type === "game-over") {
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
    var byWave = s.stats.skippedByWave;
    $("#over-skipped").textContent = "SKIPPED SPAWNS  " + Object.keys(byWave).map(function (w) {
      return "W" + w + " " + byWave[w];
    }).join(" · ");
    show("over");
  }

  function setPaused(on) {
    app.paused = on;
    $("#pause").hidden = !on;
    if (!on) ET.boxes.focus();
  }

  function submit(text) {
    if (!app.game || app.paused) return { ok: false, blocked: true };
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

  /* Refinement 3 §1: the game pauses itself when the window loses focus (a reflex Alt+Tab, a click
     elsewhere, another tab); Esc resumes it as from any pause. */
  function pauseOnFocusLoss() {
    if (app.screen === "play" && app.game && app.game.phase !== "over" && !app.paused) setPaused(true);
  }
  window.addEventListener("blur", pauseOnFocusLoss);
  document.addEventListener("visibilitychange", function () { if (document.hidden) pauseOnFocusLoss(); });

  /* Browsers hold audio until the player presses or clicks something. */
  ["keydown", "pointerdown"].forEach(function (t) {
    document.addEventListener(t, function () { ET.audio.unlock(); }, { capture: true, once: true });
  });

  /* the active box keeps the keyboard during play */
  document.addEventListener("focusout", function () {
    setTimeout(function () {
      if (app.screen === "play" && !ET.devmode.isOpen() && !app.paused) ET.boxes.focus();
    }, 0);
  });

  /* ---------------------------------------------------------------- boot */
  /* Refinement 2 §1: the how-to panel. Simple how-to only; it NEVER lists CAV durations. */
  function paintHowTo(mode) {
    // Refinement 3 §2: these lines, in this order; no RCAV syntax, AD or VF lines
    var lines = [["GOAL", "Clear the CAVs as soon as they're done, as quick as you can."]];
    // E8 (ruled, kept as is by Refinement 3 until Andrew rewords it): the placement line only in the
    // modes that place, hidden in Clear CAVs Only
    if (mode === "both" || mode === "progression") lines.push(["PLACE", "CAV <unit> <type>, e.g. CAV 2101 VS"]);
    lines = lines.concat([
      ["SWITCH", "Tab / Shift+Tab: next / previous Command Line (keeps what you typed)."],
      ["F12", "Next Command Line, cleared."],
      ["ESC", "Pause."],
      ["CLEANUP", "Click & drag the hose to clean up the mess."]   // Refinement 5 §6
    ]);
    var ul = $("#howto ul");
    ul.innerHTML = "";
    lines.forEach(function (l) {
      var li = document.createElement("li");
      var b = document.createElement("b");
      b.textContent = l[0];
      li.appendChild(b);
      li.appendChild(document.createTextNode(" " + l[1]));
      ul.appendChild(li);
    });
  }

  /* Refinement 5 §3: the how-to panel's alien-family doodles. One sits beside the title and the rest in the
     space under the text, so they never cover a word; every doodleTurnEvery [T] one of them turns to a new
     angle (a CSS transition, so nothing here runs per frame), and only while the play screen shows. */
  function buildDoodles() {
    var title = $("#howto .title"), meadow = $("#howto .doodles");
    var list = [ET.art.doodleEl(0)];
    title.appendChild(list[0]);
    [[4, 4], [54, 0], [26, 50], [64, 52]].forEach(function (p, i) {
      var d = ET.art.doodleEl(i + 1);
      d.style.left = p[0] + "%";
      d.style.top = p[1] + "%";
      meadow.appendChild(d);
      list.push(d);
    });
    list.forEach(function (d) { d.style.setProperty("--turn", ((Math.random() * 2 - 1) * C.doodleTurnMax).toFixed(0) + "deg"); });
    setInterval(function () {
      if (app.screen !== "play" || app.paused) return;
      var d = list[Math.floor(Math.random() * list.length)];
      d.style.setProperty("--turn", ((Math.random() * 2 - 1) * C.doodleTurnMax).toFixed(0) + "deg");
    }, C.doodleTurnEvery * 1000);
  }

  function wire() {
    ET.view.build();
    ET.title.build($("#title-scene"));
    ET.title.buildCritter($("#setup-critter"));
    ET.boxes.build({ submit: submit });
    paintHowTo("clear");
    buildDoodles();
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
    floor: function () { return ET.mess.coverage(ET.view.floor()); },
    tune: function () { return ET.audio.tunePlaying(); },
    nestClass: function (id) { var v = ET.view.nest(id); return v.el.className + " state=" + v.el.dataset.state; }
  };
})();

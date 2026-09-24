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

  /* How-to panel everywhere (Andrew approved, 2026-09-23): the ONE panel moves to whichever screen shows, on the
     right as in play. In play it sits in the play row, between the HUD bar and the Command Lines; on the title,
     mode-selection and game-over screens it hangs down the right edge and the screen's content keeps clear of it. */
  function placeHowTo(name) {
    var panel = $("#howto");
    var host = name === "play" ? $("#screen-play .playrow") : $("#screen-" + name);
    if (!host) return;
    // Refinement 6 §1: the title screen has its own How To Play card instead
    if (name !== "title" && panel.parentNode !== host) host.appendChild(panel);
    document.querySelectorAll(".screen").forEach(function (s) { s.classList.toggle("with-howto", s === host); });
  }

  function show(name) {
    app.screen = name;
    document.querySelectorAll(".screen").forEach(function (s) { s.hidden = s.id !== "screen-" + name; });
    document.body.classList.toggle("playing", name === "play");   // in play the mute button takes the hose cursor too
    placeHowTo(name);
    ET.lights.mode(name === "play" ? "calm" : "attract");   // arcade attract lights: lively on menus, calm in play
    if (name === "setup") paintSetup();
    // Refinement 4 §6 and E21 (ruled): the title tune plays on the title AND mode-selection screens, so it's
    // heard once the first key or click has unlocked sound; it stops when a game starts
    ET.audio.titleTune(name === "title" || name === "setup");
    if (name === "play") ET.boxes.focus();
    ET.view.hose();   // the hose shows on the play screen only
    paintMute(ET.audio.muted());   // the mute button's tooltip names the key that works on this screen
  }

  /* ---------------------------------------------------------------- setup */
  function paintSetup() {
    paintHowTo(MODES[app.modeIndex].id);   // the panel on the options screen shows the lines of the mode picked
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
  /* `rig` is for the rigs only (__et.start): a wall-clock start, a list of type codes and a random source, so one exact
     case (an AD across midnight, say) can be played out in the real page. Players never pass it. */
  function startGame(mode, boxes, rig) {
    if (!app.data) return;   // no game without the data (the title's guards keep the player from getting here first)
    rig = rig || {};
    clearTimeout(app.overTimer);
    var types = ET.devmode.on ? app.data.blankTypes : app.data.types;
    app.game = new ET.Game({
      mode: mode,
      boxes: boxes,
      types: rig.types ? types.filter(function (t) { return rig.types.indexOf(t.code) >= 0; }) : types,
      units: app.data.units,
      wallStart: rig.wallStart !== undefined ? rig.wallStart : wallStart(),
      rng: rig.rng || (SEED === null ? Math.random : ET.seededRandom(SEED))
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
    paintMute(ET.audio.muted());   // paused, M mutes again
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

  /* ----------------------------------------------------------------- mute */
  /* E24 (Andrew, 2026-09-24): the mute button, top left on every screen, and the M key; remembered per browser. */
  /* ⏳ E25: M is a letter players type (MB), so while a Command Line has the keys it types; there the button mutes,
     and the "ctrl-m" value lets Ctrl+M too. Everywhere else (menus, the pause, the end of a game) M mutes. */
  function typing() { return app.screen === "play" && !!app.game && app.game.phase !== "over" && !app.paused; }
  /* The button's tooltip names the key that works right now, if any (in play, as built, none: the button does it). */
  function paintMute(m) {
    var b = $("#mute"), key = !typing() ? "M" : C.muteKeyInPlay === "ctrl-m" ? "Ctrl+M" : "";
    b.setAttribute("aria-pressed", String(m));
    b.title = (m ? "Sound off" : "Sound on") + (key ? " (" + key + ")" : "");
  }
  function setMuted(on) { paintMute(ET.audio.setMuted(on)); }
  function muteKey(ev) {
    if (ev.key !== "m" && ev.key !== "M") return false;
    if (typing() ? !(C.muteKeyInPlay === "ctrl-m" && ev.ctrlKey && !ev.altKey && !ev.metaKey && !ev.shiftKey)
                 : (ev.ctrlKey || ev.altKey || ev.metaKey)) return false;
    ev.preventDefault();
    if (!ev.repeat) setMuted(!ET.audio.muted());   // a held key mutes once, not on every auto-repeat
    return true;
  }

  /* ------------------------------------------------------------- keyboard */
  document.addEventListener("keydown", function (ev) {
    if (ET.devmode.key(ev)) return;              // Ctrl+Shift+B, from any screen
    if (ET.devmode.isOpen()) return;             // the prompt's own input has the keys
    if (muteKey(ev)) return;                     // E24
    switch (app.screen) {
      case "title":
        // like a click on the title: nothing goes on until the data has loaded (Andrew, 2026-09-24)
        if (ev.key === "Enter") { ev.preventDefault(); if (app.data) show("setup"); }
        return;
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
     angle (a CSS transition, so nothing here runs per frame), on every screen. */
  var doodleList = [];   // every doodle that turns now and then: the panel's and the title card's
  function buildDoodles() {
    var title = $("#howto .title"), meadow = $("#howto .doodles");
    var list = doodleList;
    list.push(ET.art.doodleEl(0));
    title.appendChild(list[0]);
    [[4, 12], [54, 9], [26, 56], [64, 58]].forEach(function (p, i) {
      var d = ET.art.doodleEl(i + 1);
      d.style.left = p[0] + "%";
      d.style.top = p[1] + "%";
      meadow.appendChild(d);
      list.push(d);
    });
    list.forEach(function (d) { d.style.setProperty("--turn", ((Math.random() * 2 - 1) * C.doodleTurnMax).toFixed(0) + "deg"); });
    setInterval(function () {
      if (app.paused) return;   // on every screen now the panel is (a paused game holds them)
      var seen = list.filter(function (x) { return x.getBoundingClientRect().width > 0; });   // only doodles on screen
      if (!seen.length) return;
      var d = seen[Math.floor(Math.random() * seen.length)];
      d.style.setProperty("--turn", ((Math.random() * 2 - 1) * C.doodleTurnMax).toFixed(0) + "deg");
    }, C.doodleTurnEvery * 1000);
  }

  /* Refinement 6 §1: the title screen's How To Play card. Andrew may reword these; keep them to four short steps. */
  var TITLE_STEPS = [
    "The aliens are laying eggs in your CAVs.",
    "Clear each CAV the moment it's done, before the egg hatches.",
    "Clear fast, and breakfast gets fancier.",
    "Hose off the mess between waves."
  ];
  function buildTitleCard() {
    var ol = $("#howto-title ol");
    TITLE_STEPS.forEach(function (text, i) {
      var li = document.createElement("li");
      var n = document.createElement("span");
      n.className = "num";
      n.textContent = String(i + 1);
      var t = document.createElement("span");
      t.className = "step";
      t.textContent = text;
      li.appendChild(n);
      li.appendChild(t);
      ol.appendChild(li);
    });
    // a row of alien-family doodles under the steps, turning with the panel's
    var row = document.createElement("div");
    row.className = "doodle-row";
    [3, 2, 1].forEach(function (i) {
      var d = ET.art.doodleEl(i);
      d.style.setProperty("--turn", ((Math.random() * 2 - 1) * C.doodleTurnMax).toFixed(0) + "deg");
      row.appendChild(d);
      doodleList.push(d);
    });
    $("#howto-title").appendChild(row);
    ET.lights.build($("#howto-title"));   // it keeps the arcade lights
  }

  function wire() {
    ET.view.build();
    ET.title.build($("#title-scene"));
    ET.title.buildCritter($("#setup-critter"));
    ET.boxes.build({ submit: submit });
    paintHowTo("clear");
    buildDoodles();
    ET.lights.build($("#howto"));
    buildTitleCard();
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

    // E24: the mute button. Pressing it never takes the keyboard from a Command Line (or anything else).
    var mute = $("#mute");
    mute.hidden = !C.sound;
    mute.addEventListener("mousedown", function (ev) { ev.preventDefault(); });
    mute.addEventListener("click", function () { setMuted(!ET.audio.muted()); });
    paintMute(ET.audio.muted());   // show the remembered setting
  }

  wire();
  show("title");
  $("#title-prompt").textContent = "LOADING…";
  ET.data.load().then(function (data) {
    app.data = data;
    $("#title-prompt").textContent = "PRESS ENTER";
  }).catch(function (err) {
    app.screen = "error";   // nothing on this screen starts a game (Andrew, 2026-09-24)
    var sheet = err && err.sheet;
    $("#title-error").hidden = false;
    if (sheet) {
      // the sheet arrived but the game can't use it: say which sheet and why (a server hint wouldn't help)
      $("#title-prompt").textContent = sheet === "units" ? "CAN'T START: NO USABLE UNIT LIST" : "CAN'T START: NO USABLE CAV TYPE TABLE";
      $("#title-error").textContent = err.message + " (" + ET.data.PATHS[sheet].replace(/^(\.\.\/)+/, "Game/") + ")";
    } else {
      $("#title-prompt").textContent = "COULDN'T LOAD THE CAV DATA";
      $("#title-error").textContent = String(err && err.message || err) +
        " — run it over http:// (Game/Start Dev Server.bat), not by opening the file.";
    }
  });
  requestAnimationFrame(frame);

  /* Rig hooks: read state, and drive the clock without waiting in real time. */
  window.__et = {
    screen: function () { return app.screen; },
    ready: function () { return !!app.data; },
    data: function () { return app.data; },
    start: function (mode, boxes, rig) { startGame(mode, boxes || 1, rig); return true; },
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

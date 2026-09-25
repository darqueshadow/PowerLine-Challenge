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
    boxes: C.boxesDefault,   // E28: 2
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
    // E30 (ruled 2026-09-24): no side panel in play: the board takes its width. The menus keep it.
    var host = name === "play" ? null : $("#screen-" + name);
    if (!host) { document.querySelectorAll(".screen").forEach(function (s) { s.classList.remove("with-howto"); }); return; }
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
    // Music (Chat ruling, 2026-09-25): the menu screens share the title track (E21: heard once the first key or click
    // has unlocked sound), play has the gameplay track, game over its own, played once. A change fades out and in.
    ET.audio.music(name === "play" ? "gameplay" : name === "over" ? "over" : "title");
    if (name === "over") { paintOver(C.overDefault === "again" ? "again" : "title"); app.overAt = performance.now(); }
    // with no sound at all the game-over track can't end, so its length stands in for it
    clearTimeout(app.overAuto);
    if (name === "over" && ET.audio.state() === "none") app.overAuto = setTimeout(function () { if (app.screen === "over") show("title"); }, C.music.over.seconds * 1000);
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
    // E28: the switching hints under the Command Lines (with one line there's nothing to switch to: F12 just clears it)
    // E30: Esc joins them, now the side panel is gone from play
    $("#line-hints").innerHTML = (boxes > 1
      ? "<b>TAB</b> / <b>SHIFT+TAB</b> next / previous line (keeps what you typed) &nbsp;·&nbsp; <b>F12</b> next line, cleared"
      : "<b>F12</b> clears the line") + " &nbsp;·&nbsp; <b>ESC</b> pause";
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

  /* The game-over screen's two buttons (Chat ruling, 2026-09-25): TITLE SCREEN and PLAY AGAIN (to the mode selection,
     where Enter used to go). Leaving fades the game-over music out on the way (show() changes the track). If the player
     does nothing, the game-over track plays to its end and the game goes back to the title screen by itself. */
  function paintOver(which) {
    app.over = which;
    document.querySelectorAll("#over-buttons [data-go]").forEach(function (b) { b.classList.toggle("selected", b.dataset.go === which); });
  }
  function leaveOver(which) { show(which === "again" ? "setup" : "title"); }
  // E34: seconds until game over takes Enter
  function overEnterIn() { return Math.max(0, C.overEnterDelay - (performance.now() - (app.overAt || 0)) / 1000); }

  function setPaused(on) {
    app.paused = on;
    $("#pause").hidden = !on;
    ET.audio.musicPause(on);   // the gameplay music pauses and resumes where it stopped
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
  /* E25 (ruled): M is a letter players type (MB), so while a Command Line has the keys it types; there the button and
     Ctrl+M mute (muteKeyInPlay "ctrl-m"). Everywhere else (menus, the pause, the end of a game) M mutes. */
  function typing() { return app.screen === "play" && !!app.game && app.game.phase !== "over" && !app.paused; }
  /* The button's tooltip names the key that works right now: M, or Ctrl+M in play (none there under "none"). */
  function paintMute(m) {
    var b = $("#mute"), key = !typing() ? "M" : C.muteKeyInPlay === "ctrl-m" ? "Ctrl+M" : "";
    b.setAttribute("aria-pressed", String(m));
    b.title = (m ? "Sound off" : "Sound on") + (key ? " (" + key + ")" : "");
  }
  function setMuted(on) { paintMute(ET.audio.setMuted(on)); paintPrompt(); }   // muted, there's no music to wake
  function muteKey(ev) {
    if (ev.key !== "m" && ev.key !== "M") return false;
    if (typing() ? !(C.muteKeyInPlay === "ctrl-m" && ev.ctrlKey && !ev.altKey && !ev.metaKey && !ev.shiftKey)
                 : (ev.ctrlKey || ev.altKey || ev.metaKey)) return false;
    ev.preventDefault();
    if (!ev.repeat) setMuted(!ET.audio.muted());   // a held key mutes once, not on every auto-repeat
    return true;
  }

  /* Browsers hold audio until the player presses or clicks something. E35: the first press or click is heard as
     "sound on". If it lands on the title while sound is still held back, it only starts the title music there
     (titleFirstPress "sound", ⏳ E40), and the title's Enter and click handlers let it pass. Registered before the
     keyboard handler, so it runs first. */
  ["keydown", "pointerdown"].forEach(function (t) {
    document.addEventListener(t, function (ev) {
      app.woken = true;   // E40: the first press ends "PRESS ANY KEY", whatever it was
      paintPrompt();
      if (!C.sound || !ET.audio.locked()) return;   // every press until the browser lets sound run
      app.wakePress = app.screen === "title" && C.titleFirstPress === "sound" && C.sound && !ET.audio.muted() && ET.audio.locked()
        && !(t === "keydown" && ev.key !== "Enter")   // another key (M, Ctrl+Shift+B) also wakes sound, but has nothing to let pass
        && !(t === "pointerdown" && ev.target.closest && !ev.target.closest("#screen-title"))   // e.g. the mute button
        ? t : false;
      ET.audio.unlock();
    }, { capture: true });
  });
  // a waking click has passed once its click is done (a click follows its pointerup in the same task)
  document.addEventListener("pointerup", function () { if (app.wakePress === "pointerdown") setTimeout(function () { app.wakePress = false; }, 0); }, true);

  /* ------------------------------------------------------------- keyboard */
  document.addEventListener("keydown", function (ev) {
    if (ET.devmode.key(ev)) return;              // Ctrl+Shift+B, from any screen
    if (ET.devmode.isOpen()) return;             // the prompt's own input has the keys
    if (muteKey(ev)) return;                     // E24
    switch (app.screen) {
      case "title":
        // like a click on the title: nothing goes on until the data has loaded (Andrew, 2026-09-24)
        if (ev.key === "Enter") {
          ev.preventDefault();
          if (app.wakePress === "keydown") { app.wakePress = false; return; }   // E35: this press starts the music
          if (app.data) show("setup");
        }
        return;
      case "over":
        // two buttons (Chat ruling, 2026-09-25): ← → pick, Enter presses the lit one (the default: E34)
        if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") { ev.preventDefault(); paintOver(app.over === "title" ? "again" : "title"); }
        // E34: not in the screen's first second, and never on a held key's auto-repeat: a fresh press is needed
        if (ev.key === "Enter") { ev.preventDefault(); if (!ev.repeat && overEnterIn() === 0) leaveOver(app.over); }
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
    // E28 (ruled 2026-09-24): the instructions moved beside their objects: Switch and F12 under the Command Lines, and
    // Cleanup onto the hose's sink. What's left here is only what has no object of its own.
    lines = lines.concat([
      ["ESC", "Pause."]
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

  /* E29 (ruled 2026-09-24): How To Play is a five-panel comic strip, one design on the title card and on the options
     screen's panel (under its signs). One panel a step: a heading, a picture (⏳ enlarged how-to doodles for now; the art
     is Gemini's, brief slots 16–20) and the step's words in a speech bubble. Panel 3 is split, fast and slow.
     E29's rulings: no panel headings, only a number badge in each panel's corner (the heading stays as the panel's
     accessible name); the words are TITLE_STEPS, as ruled; the old hose step is gone (the sink says it). */
  var STRIP = [
    { head: "Watch the nests", pics: [[1], [3, "small"]], chip: ["04:21", "timer"] },
    { head: "Wait for pink", pics: [[0]], chip: ["10:00", "timer bold"], shout: "RCAV 2101!" },
    { head: "Be quick", split: true },
    { head: "Use your Command Lines", pics: [[2]], keys: true },
    { head: "Time Warp", pics: [["clock"], [4, "small"]] }
  ];
  function buildStrip() {
    var ol = document.createElement("ol");
    ol.className = "strip";
    STRIP.forEach(function (p, i) {
      var li = document.createElement("li");
      li.className = "cell";
      li.dataset.step = i + 1;
      li.setAttribute("aria-label", (i + 1) + ". " + p.head);
      var num = document.createElement("span");
      num.className = "num";
      num.setAttribute("aria-hidden", "true");
      num.textContent = String(i + 1);
      li.appendChild(num);
      var scene = document.createElement("div");
      scene.className = "scene" + (p.split ? " split" : "");
      function pic(spec) {
        var el = spec[0] === "clock" ? ET.art.clockSvg(C.warpFactor) : ET.art.doodleEl(spec[0]);
        el.setAttribute("class", (spec[0] === "clock" ? "clock-art" : "doodle") + " pic" + (spec[1] ? " " + spec[1] : ""));
        return el;
      }
      if (p.split) {
        // fast: the pan and a fancy plate; slow: a cracked egg with a leg flailing out
        [["Fast!", "fast"], ["Slow…", "slow"]].forEach(function (h) {
          var half = document.createElement("div");
          half.className = "half " + h[1];
          var lab = document.createElement("span");
          lab.className = "tag";
          lab.textContent = h[0];
          half.appendChild(lab);
          if (h[1] === "fast") {
            var d = ET.art.dishEl(5, "");   // a fancy plate (the ladder's sixth dish), held still
            d.className = "dish pic";
            d.removeChild(d.querySelector(".caption"));
            half.appendChild(d);
          } else {
            half.appendChild(pic([3]));
          }
          scene.appendChild(half);
        });
      } else {
        (p.pics || []).forEach(function (s) { scene.appendChild(pic(s)); });
        if (p.chip) {
          var chip = document.createElement("span");
          chip.className = "chip " + p.chip[1];
          chip.textContent = p.chip[0];
          scene.appendChild(chip);
        }
        if (p.shout) {
          var sh = document.createElement("span");
          sh.className = "shout";
          sh.textContent = p.shout;
          scene.appendChild(sh);
        }
        if (p.keys) {
          var k = document.createElement("span");
          k.className = "keys";
          k.setAttribute("aria-hidden", "true");
          k.innerHTML = "<i></i><i></i>";
          scene.appendChild(k);
        }
      }
      li.appendChild(scene);
      var bubble = document.createElement("p");
      bubble.className = "say";
      bubble.textContent = TITLE_STEPS[i];
      li.appendChild(bubble);
      ol.appendChild(li);
    });
    return ol;
  }

  /* Refinement 6 §1: the title screen's How To Play card. Andrew may reword these; keep them short.
     E27 (ruled 2026-09-24) adds step 5, Time Warp (E28 keeps that name); its speed-up is read from the config, so it
     stays true. E28 rewords step 2 around the colour cue: the timer turns pink when RCAV works. */
  var TITLE_STEPS = [
    "The aliens are laying eggs in your CAVs.",
    "When the timer turns pink and bold, type RCAV + the unit. Too early won't work.",
    "Clear fast, and breakfast gets fancier.",
    "Two lines! Tab to switch. Type the next RCAV while you wait.",
    "Every clock speeds up " + C.warpFactor + "× till an egg is ready. Get your next RCAV ready!"
  ];
  function buildTitleCard() {
    $("#howto-title").appendChild(buildStrip());   // E29: the comic strip
    // E29: the same strip on the options screen, under the HOW / TO / PLAY signs (CSS shows it only there)
    $("#howto").insertBefore(buildStrip(), $("#howto ul"));
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
    ET.lights.signs($("#howto .title"), $("#screen-setup"));   // E27: the options screen's HOW / TO / PLAY signs
    buildTitleCard();
    ET.devmode.build({
      toggled: function (on) {
        $("#setup-dev").hidden = !on;
      },
      closed: function () { if (app.screen === "play") ET.boxes.focus(); }
    });

    $("#screen-title").addEventListener("click", function () {
      if (app.wakePress === "pointerdown") { app.wakePress = false; return; }   // E35: this click starts the music
      if (app.data) show("setup");
    });
    document.querySelectorAll("#over-buttons [data-go]").forEach(function (b) {
      b.addEventListener("click", function () { leaveOver(b.dataset.go); });
    });
    ET.audio.onMusicEnd(function (k) { if (k === "over" && app.screen === "over") show("title"); });
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

  /* The title's prompt: LOADING… until the data is in, then PRESS ENTER; but E40: while a browser still holds sound
     back and no key or click has come, PRESS ANY KEY (that first press only starts the music). It waits
     wakePromptDelay first, so where autoplay runs (Fang Rock) it never shows. It blinks as the prompt always has. */
  function paintPrompt() {
    if (app.screen === "error" || !app.data || !app.wakeGrace) return;   // LOADING… covers the wait, so it never jumps
    var wait = app.wakeGrace && !app.woken && C.titleFirstPress === "sound" && C.sound && !ET.audio.muted() && ET.audio.locked();
    $("#title-prompt").textContent = wait ? "PRESS ANY KEY" : "PRESS ENTER";
  }

  wire();
  show("title");
  ET.audio.autoplay();   // E35: the title music plays at once where autoplay is allowed
  ET.audio.onState(paintPrompt);
  setTimeout(function () { app.wakeGrace = true; paintPrompt(); }, C.wakePromptDelay * 1000);
  $("#title-prompt").textContent = "LOADING…";
  ET.data.load().then(function (data) {
    app.data = data;
    paintPrompt();
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
    // rig-only: the music now, a screen change as a button would make it, and a track's end as if it had played out
    music: function () { return ET.audio.musicState(); },
    show: function (name) { show(name); return name; },
    overEnterIn: function () { return overEnterIn(); },
    prompt: function () { paintPrompt(); return $("#title-prompt").textContent; },   // rig-only: repaint the title's prompt now
    endMusic: function () { return ET.audio.endMusicForRig(); },
    nestClass: function (id) { var v = ET.view.nest(id); return v.el.className + " state=" + v.el.dataset.state; }
  };
})();

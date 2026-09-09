/* ===========================================================================
   emu.js — driving EmulatorJS + the vice_x64sc libretro core, self-hosted.

   THE DECISION, so nobody re-litigates it from inside this file:
   vice_x64sc is full VICE, the reference C64 implementation, and its 1541
   emulation is why a folder of cracked .d64 images actually runs. The core
   carries the KERNAL/BASIC/CHARGEN ROMs itself, so there is no ROM-supply
   step. Autostart is the core's own default: hand it a disk and it performs
   LOAD"*",8,1:RUN without being asked. Fallback if EmulatorJS chrome ever
   spoils the Tommodore look is vc64web. Native VICE.exe is rejected — a
   second OS window exits to the desktop, not to the hub.

   ===========================================================================
   🚨 WHAT IS AND IS NOT VERIFIED IN THIS FILE

   The control mapping, the option names and the disk-swap calls below are
   written against EmulatorJS's documented surface. They have NOT been watched
   working, because ./data/ is gitignored and was not present when this was
   written — there was no core to run and no disk to run in it.

   ⭐ So every one of those three is written to FAIL LOUDLY AND SAY WHICH,
   never to fall back silently. `swapDisk()` in particular refuses rather than
   guessing: see its comment. When you first run this with a real core, the
   things to check in order are (1) the core loads at all, (2) Ctrl fires,
   (3) a two-disk game swaps without resetting. `./README.md` carries that as
   a checklist.
   ========================================================================= */
(function () {
  "use strict";

  var say = document.getElementById("say");
  var sayBody = document.getElementById("say-body");

  /* -----------------------------------------------------------------------
     The honest-failure surface. Nothing in this file ever fails quietly; if
     a game is not running, this says what stopped it and what to do.
     --------------------------------------------------------------------- */
  function tell(title, lines) {
    sayBody.textContent = "";
    var h = document.createElement("h1");
    h.textContent = title;
    sayBody.appendChild(h);
    lines.forEach(function (l) {
      var p = document.createElement("p");
      if (l && l.code) {
        var pre = document.createElement("pre");
        pre.textContent = l.code;
        sayBody.appendChild(pre);
        return;
      }
      if (l && l.text !== undefined) { p.className = l.cls || ""; p.textContent = l.text; }
      else { p.textContent = String(l); }
      sayBody.appendChild(p);
    });
    say.hidden = false;
  }

  /* -----------------------------------------------------------------------
     WHAT THE HUB SENT US. Repeated `d` params, one per side, already in
     order. `title` is only ever displayed.
     --------------------------------------------------------------------- */
  var params = new URLSearchParams(location.search);
  var TITLE = params.get("title") || "DISK";
  var DISKS = params.getAll("d").filter(Boolean);
  var current = 0;

  /* -----------------------------------------------------------------------
     CONTROLS. His ruling: arrows = joystick, Ctrl = fire, and Space/Shift
     stay free as real keyboard keys, addable per-game later.

     ⭐ WHY SPACE IS NOT FIRE, recorded so it is not "fixed" later: a great
     many C64 titles use SPACE as a real keyboard key — start, pause,
     continue, dismiss. Bound to fire, those games become unstartable, and the
     failure looks like a broken emulator rather than a bound key. Ctrl is
     free on essentially all of them and sits under the hand that is already
     on the arrows.

     RetroPad index map (EmulatorJS `EJS_defaultControls`, player 0):
       0 = B (fire)   4 = Up   5 = Down   6 = Left   7 = Right
     🚨 The C64 joystick has ONE button. Mapping a second key to a second
     RetroPad button would do nothing on this core; it is not an oversight.

     🚨🚨 THE `value` STRINGS ARE NOT FREE TEXT. EmulatorJS resolves each one
     through keyLookup(), a REVERSE lookup over its own keyMap, and stores the
     numeric keyCode. A name that is not in that map resolves to -1 and the key
     is then dead — silently, because the emulator loads and runs perfectly and
     only the input is gone. The arrows shipped as "up"/"down"/"left"/"right",
     which are NOT keyMap names; the map calls them "up arrow" and so on
     (37-40). Measured 2026-09-08: player 0 read {0:17, 4:-1, 5:-1, 6:-1, 7:-1}
     and gameManager.simulateInput fired for Ctrl and for nothing else.
     🚫 Do not shorten these back. If a binding ever appears dead, read
     EJS_emulator.controls[0] first — a -1 there names the fault immediately.
     --------------------------------------------------------------------- */
  window.EJS_defaultControls = {
    0: {
      0: { value: "ctrl" },
      4: { value: "up arrow" },
      5: { value: "down arrow" },
      6: { value: "left arrow" },
      7: { value: "right arrow" }
    }
  };

  /* Port 2 is the common case for C64 titles; a real minority want Port 1,
     which is why the hub offers a flip rather than this being decided once
     here. ⚠️ Option KEY and VALUE strings are core-specific — if the flip
     appears to do nothing, this pair is the first thing to check against the
     core's own option list, not the hub's button.

     ✅ 2026-09-09 — THAT CHECK WAS DONE, AGAINST THE RUNNING CORE, and the pair
     is RIGHT. `gameManager.getCoreOptions()` on vice_x64sc publishes 113
     options and this is one of them, verbatim:

         vice_joyport|2; 1|2

     so the key is real, Port 2 is the core's own default, and "1"/"2" are
     exactly the two legal values. 🚫 Do not "fix" this pair; it is measured.

     ⚠️ AND READ THE WHOLE LIST IF YOU RE-CHECK IT. A capped filter over the
     option NAMES very nearly retired this as a dead option: `vice_joyport`
     sorts after 25 other joy-ish names (`vice_joyport_pointer_color`,
     `vice_mapper_joyport_switch`, and every `vice_mapper_*`), so a filter with
     a `.slice(0, 25)` on it shows you everything EXCEPT the one you asked
     about — and the absence reads as proof.
     📌 `getCoreOptions()` traps with "memory access out of bounds" now and
     again once the game is running, so retry it a few times rather than
     concluding the core has no options. `getCoreOptionsJSON()` returns null
     here; this core predates that export. */
  var PORT_OPTION = "vice_joyport";
  var PORT_DEFAULT = params.get("port") === "1" ? "1" : "2";
  window.EJS_defaultOptions = {};
  window.EJS_defaultOptions[PORT_OPTION] = PORT_DEFAULT;

  /* 🚫 Chrome off. The hub IS the frontend — a second set of menus inside the
     Tommodore case is the thing that would send us to vc64web instead. */
  window.EJS_Buttons = {
    playPause: false, restart: false, mute: false, settings: true,
    fullscreen: false, saveState: false, loadState: false,
    screenRecord: false, gamepad: true, cheat: false,
    volume: false, saveSavFiles: false, loadSavFiles: false,
    quickSave: false, quickLoad: false, screenshot: false, cacheManager: false
  };

  window.EJS_player = "#game";
  window.EJS_core = "c64";
  window.EJS_pathtodata = "data/";
  window.EJS_startOnLoaded = true;
  window.EJS_gameName = TITLE;
  window.EJS_color = "#7a6ec8";

  /* -----------------------------------------------------------------------
     TALKING TO THE HUB. Same-origin in every real deployment, but on file://
     the origin is the string "null" and a targetOrigin of anything else is
     silently dropped — so posts go to "*" and RECEIPTS are validated by
     shape instead. Nothing here acts on data from a message; the only inbound
     commands are "swap to index N" and "which disks are there", both of which
     are bounded by DISKS.length.
     --------------------------------------------------------------------- */
  function toHub(msg) {
    try { parent.postMessage(msg, "*"); } catch (e) { /* not framed; fine */ }
  }

  /* The hub owns the way out, but it cannot see a keypress that lands in this
     iframe — a document-level listener in the parent never fires for a key
     the child consumed. So the exit chord is forwarded rather than handled.
     🚨 Capture phase, ahead of the emulator's own key handling, or the core
     eats it as a C64 keystroke and the player is stuck inside the game. */
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && (e.shiftKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      toHub({ type: "cat:exit" });
      return;
    }
    /* KNOWN LIMITATION, parked 2026-09-08 and deliberately not fixed: this
       swallows Shift+Escape, which at the hub terminal means Shift+RUN/STOP -
       so that chord cannot be sent to a running game. Plain Escape is
       untouched and does reach the core in keyboard mode. His call is that
       this waits for a concrete case where Shift+RUN/STOP matters before
       choosing between moving the exit chord and adding a pass-through.
       Do not move the exit chord unilaterally: it is the one key that
       guarantees a way out. See ./README.md. */
    /* 🚨 F2 MUST BE CAUGHT HERE, IN CAPTURE, FOR THE SAME REASON THE EXIT
       CHORD IS. In keyboard mode every keystroke is being handed to the C64,
       so a bubble-phase handler would be racing the machine for its own mode
       switch — and losing it strands the player in the mode they are trying to
       leave, with no key that works to get out. 🚫 Never move this to bubble.
       ⭐ A function key is deliberate: it is the one class of key a C64 has no
       use for, so it cannot collide with anything the game wants. */
    if (e.key === "F2") {
      e.preventDefault();
      e.stopPropagation();
      setInputMode(!kbdMode);
      return;
    }
    /* 🆕 F9 — JOYSTICK PORT, his ask 2026-09-09. Same capture-phase reasoning as
       F2 above and for the same reason: in keyboard mode every keystroke is
       being handed to the C64, so a bubble handler would be racing the machine.
       ⭐ F9 is deliberate and it is NOT free of meaning to a C64 — F1..F8 are
       real keys the machine has, and games use them. F9 is not one of them, so
       like F2 it cannot collide with anything a game wants.
       🚨 IT MUST WORK IN JOYSTICK MODE, which is the whole point: the port is
       the thing you flip when the stick is dead, and in that state the keyboard
       is disabled. That is exactly why it is caught HERE, in this document, and
       not left to the core's own `vice_mapper_joyport_switch` hotkey (which is
       RETROK_RCTRL and needs the keyboard to reach the core to fire at all). */
    if (e.key === "F9") {
      e.preventDefault();
      e.stopPropagation();
      setPort(port === "1" ? "2" : "1");
    }
  }, true);

  /* -----------------------------------------------------------------------
     INPUT MODE — joystick or keyboard, and never both at once.

     🚨 THAT EXCLUSIVITY IS EmulatorJS'S, NOT A CHOICE MADE HERE. keyChange()
     returns early while its "keyboardInput" setting is "enabled", so the
     RetroPad mapping above (Ctrl + arrows) is bypassed wholesale the moment
     free keyboard input is on. A C64 needs both — the keyboard for a loader
     menu or a Y/N prompt, the stick for the game itself.

     ⭐ HIS RULING, 2026-09-08: a HUB-LEVEL TOGGLE, not a per-title default and
     not left to EmulatorJS's own settings menu. The reasoning is worth keeping
     because it is about how these are actually played: most disks hit a menu
     or a prompt before the game starts, and a real session flips between the
     two constantly. Pre-classifying a disk as "keyboard" or "joystick" would
     describe a session that does not happen.

     🚨 THE LIVE MODE MUST BE VISIBLE, and that is the whole reason this
     reports rather than just acts. A player who cannot see the mode reads a
     dead joystick as a broken game, or a dead keyboard as a dead key — the
     exact confusion this switch exists to end. The hub owns the label; this
     file owns the truth and re-reports it after every change rather than
     letting the hub assume its request landed.
     --------------------------------------------------------------------- */
  var kbdMode = false;

  function reportInputMode() {
    var e = window.EJS_emulator;
    if (e && typeof e.getSettingValue === "function") {
      kbdMode = (e.getSettingValue("keyboardInput") === "enabled");
    }
    toHub({ type: "cat:inputmode", keyboard: kbdMode });
  }

  function setInputMode(on) {
    var e = window.EJS_emulator;
    /* 🚫 Do not call gameManager.setKeyboardEnabled() directly. That tells the
       CORE about the keyboard but leaves the SETTING untouched, so keyChange()
       keeps mapping the RetroPad as well and both inputs go live together -
       which is the one state this is supposed to make impossible.
       changeSettingOption() writes the setting AND fires the change handler
       that reaches setKeyboardEnabled, so the two can never disagree. */
    if (!e || typeof e.changeSettingOption !== "function") {
      toHub({ type: "cat:inputfailed", reason: "this build exposes no settings interface" });
      return;
    }
    e.changeSettingOption("keyboardInput", on ? "enabled" : "disabled");
    reportInputMode();
  }

  /* -----------------------------------------------------------------------
     JOYSTICK PORT — his ask, 2026-09-09: *"Make F9 to switch ports. Give a
     toggle button beside the keyboard/joystick toggle."*

     ⭐ WHY A LIVE FLIP AND NOT A PER-DISK SETTING. A C64 has two joystick ports
     and the disk does not say which one it reads; Port 2 is the common choice
     and a real minority use Port 1. There is no way to know from the outside
     which a given cracked disk wants, and no list to consult. So the honest
     control is the one you can reach WHILE the game is in front of you and the
     stick is dead — press F9, try again. That is a diagnosis the player can
     perform in a second, and it is why this is not a hidden default.

     🚨 THE SAME REPORTING RULE AS THE INPUT MODE, AND FOR THE SAME REASON. This
     file owns the truth and re-reports it after every change; the hub paints
     the label and never assumes its request landed. A port label that disagrees
     with the machine is worse than no label — it turns "the stick is dead" into
     "the stick is dead AND the thing that says why is lying".

     ⚠️ `port` IS SEEDED FROM WHAT WE ASKED FOR, then corrected from the machine
     the moment there is a machine to ask. `EJS_defaultOptions` is applied during
     setup, so before the emulator exists there is nothing to read back and the
     requested value is the only truth there is.
     --------------------------------------------------------------------- */
  var port = PORT_DEFAULT;

  function reportPort() {
    var e = window.EJS_emulator;
    /* ⚠️ Read it back from the SETTINGS store, not from our own variable — that
       is what makes this a report rather than an echo. */
    if (e && e.allSettings && e.allSettings[PORT_OPTION]) {
      port = String(e.allSettings[PORT_OPTION]);
    }
    toHub({ type: "cat:portmode", port: port });
  }

  function setPort(next) {
    var e = window.EJS_emulator;
    next = (String(next) === "1") ? "1" : "2";
    /* 🚫 Same rule as setInputMode: go through changeSettingOption, never
       straight to gameManager.setVariable(). changeSettingOption writes the
       SETTING and fires the handler that reaches setVariable, so the store the
       label is read from and the value the core is running can never disagree.
       Calling setVariable alone would move the core and leave the label — and
       therefore the player's whole mental model — one flip behind. */
    if (!e || typeof e.changeSettingOption !== "function") {
      toHub({ type: "cat:portfailed", reason: "this build exposes no settings interface" });
      return;
    }
    e.changeSettingOption(PORT_OPTION, next);
    reportPort();
  }

  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m || typeof m !== "object") return;
    if (m.type === "cat:swap") swapDisk(Number(m.index));
    /* The hub asks for a FLIP, not for a specific state - it has no business
       holding the authoritative value. This answers with what actually took. */
    if (m.type === "cat:input") setInputMode(!kbdMode);
    /* Same shape as the input flip: the hub asks for the OTHER port, not for a
       specific one, and is told what actually took. */
    if (m.type === "cat:port") setPort(port === "1" ? "2" : "1");
  });

  /* -----------------------------------------------------------------------
     DISK SWAPPING — ruling 4, built now rather than deferred.

     🚨 THE HARD PART, AND WHY THIS REFUSES INSTEAD OF GUESSING. A real
     multi-disk C64 game asks you to swap while it is RUNNING and then reads
     the drive again; the machine is never reset. Reloading the emulator with
     the other image would look like a swap and would actually be a restart —
     the game would lose everything and land back at its title screen, and the
     player would blame the game.

     So: try the core's real disk-control interface, and if no shape of it is
     present, SAY SO and offer a restart the player chooses explicitly. 🚫 Do
     not make the restart automatic. A silent restart dressed as a swap is the
     silent-wrong-destination failure the hub refuses one layer up.

     ⚠️ Three shapes are tried because EmulatorJS's disk-control surface has
     moved between versions and none of them was available to test against
     when this was written. Whichever one answers on the real core, keep them
     all — a version bump is exactly when this quietly stops working.
     --------------------------------------------------------------------- */
  function swapDisk(index) {
    if (!(index >= 0 && index < DISKS.length)) return;
    if (index === current) return;

    var gm = window.EJS_emulator && window.EJS_emulator.gameManager;
    var tried = [];

    function attempt(label, fn) {
      if (tried.indexOf(true) > -1) return;
      try {
        if (fn()) {
          current = index;
          toHub({ type: "cat:swapped", index: index, how: label });
          tried.push(true);
        }
      } catch (err) {
        toHub({ type: "cat:swapnote", note: label + " threw: " + err.message });
      }
    }

    attempt("setCurrentDiskIndex", function () {
      if (!gm || typeof gm.setCurrentDiskIndex !== "function") return false;
      gm.setCurrentDiskIndex(index);
      return true;
    });
    attempt("functions.setDisk", function () {
      if (!gm || !gm.functions || typeof gm.functions.setDisk !== "function") return false;
      gm.functions.setDisk(index);
      return true;
    });
    attempt("diskControl", function () {
      if (!gm || typeof gm.setDisk !== "function") return false;
      gm.setDisk(index);
      return true;
    });

    if (tried.indexOf(true) === -1) {
      /* 🚫 Deliberately not a restart. The hub renders this as a choice. */
      toHub({
        type: "cat:swapfailed",
        index: index,
        reason: "this core exposes no live disk-control interface"
      });
    }
  }

  /* -----------------------------------------------------------------------
     BOOT. Everything that can be checked before loading a multi-megabyte core
     is checked before loading it, so a failure costs a sentence rather than a
     download and a shrug.
     --------------------------------------------------------------------- */
  function boot() {
    if (!DISKS.length) {
      tell("no disk was handed over", [
        "The hub launched the drive without naming an image. Nothing was loaded.",
        { text: "This is a hub bug, not a missing file — runGame() should never reach here with an empty file list.", cls: "dim" }
      ]);
      return;
    }

    /* 🚨 The file:// check, first, because its native failure message is
       "Failed to fetch" and that sends people looking for a missing file. */
    if (location.protocol === "file:") {
      tell("this origin cannot run the emulator", [
        "WebAssembly is instantiated through fetch, and fetch refuses the file: scheme. Nothing is missing — the page is simply being served from the wrong kind of origin.",
        { text: "Two ways to fix it:", cls: "dim" },
        { code: "1.  In the Fang Rock shell: apply arcade-origin.patch.md\n    (filed to the shell track) so the arcade is served from a\n    real origin instead of file://.\n\n2.  For dev, from the (PCL) repo root:\n        python -m http.server 8899\n    then open  http://localhost:8899/Game/cat/index.html" },
        { text: "The PLC cartridges are unaffected and keep working from file:// exactly as before.", cls: "dim" }
      ]);
      return;
    }

    /* -------------------------------------------------------------------
       IS THE CORE ACTUALLY HERE?

       🚨 THE LOADER AND THE CORE ARE TWO SEPARATE INSTALLS, AND THIS USED TO
       CHECK ONLY THE FIRST. The git clone in the README brings `data/loader.js`
       and an EMPTY `data/cores/`. The core is a different download entirely.
       Because this HEAD-checked `data/loader.js`, it could never fail once
       `data/` existed at all — so "no emulator core on this machine" was
       unreachable on precisely the machines that had no core.

       🔴 What happens when it is missing is worse than a plain failure:
       EmulatorJS's own fallback is to SILENTLY FETCH THE CORE FROM
       cdn.emulatorjs.org at runtime. That breaks the no-runtime-CDN rule, and
       it hides the real state behind an emulator that looks like it works —
       which is exactly how a disk-path 404 got read as a core problem on
       2026-09-08. 🚫 Never let this check pass on the loader alone again.
       ------------------------------------------------------------------- */
    var CORE = "vice_x64sc";              /* what EJS_core "c64" resolves to */
    /* ⭐ ANY variant is enough. EmulatorJS chooses between the plain and
       -legacy builds at runtime from what the browser supports, so demanding a
       specific one would refuse to start on a machine that would have run. */
    var CORE_FILES = [
      "data/cores/" + CORE + "-wasm.data",
      "data/cores/" + CORE + "-legacy-wasm.data"
    ];

    var INSTALL = "# 1. the loader\n"
      + "git clone --depth 1 https://github.com/EmulatorJS/EmulatorJS.git _ejs\n"
      + "mv _ejs/data data\n"
      + "rm -rf _ejs\n\n"
      + "# 2. the CORE — the clone does NOT include this\n"
      + "#    match the version in data/version.json\n"
      + "npm install @emulatorjs/core-vice_x64sc@4.2.3\n"
      + "mkdir -p data/cores/reports\n"
      + "cp node_modules/@emulatorjs/core-vice_x64sc/vice_x64sc-*.data data/cores/\n"
      + "cp node_modules/@emulatorjs/core-vice_x64sc/reports/vice_x64sc.json data/cores/reports/\n"
      + "rm -rf node_modules package.json package-lock.json";

    function head(u) {
      return fetch(u, { method: "HEAD" }).then(
        function (r) { return r.ok; },
        function () { return false; }
      );
    }


  /* -----------------------------------------------------------------------
     REPAIRING A CACHED CONTROL TABLE - a one-time migration, and the reason
     the arrow fix did not take on a machine that had already played.

     EmulatorJS SAVES the resolved control table to localStorage on the very
     first run of every title, keyed per game (ejs-1-<core>-<title>-settings).
     loadSettings() then does `this.controls = coreSpecific.controlSettings`,
     replacing EJS_defaultControls wholesale. So once a table has been saved,
     THIS FILE'S BINDINGS ARE NEVER READ AGAIN for that title.

     During the era when the arrows were bound to "up"/"down"/"left"/"right" -
     names absent from EmulatorJS's keyMap - setupKeys() resolved them to -1
     and that -1 was saved. Fire survived because "ctrl" IS a keyMap name and
     resolved to 17 correctly. The result on an already-played machine is
     exactly the reported fault: fire works, arrows do nothing, in confirmed
     joystick mode, with the corrected file loaded.
     Reproduced deliberately 2026-09-08 by poisoning a clean profile:
       clean  {0:17, 4:38, 5:40, 6:37, 7:39}   Up -> simulateInput [[0,4,1],..]
       cached {0:17, 4:-1, 5:-1, 6:-1, 7:-1}   Up -> simulateInput []

     WHAT THIS DOES, and the narrowness is the point: it drops a saved blob
     ONLY when that blob contains a control resolved to -1. A -1 can only come
     from a name that is not in the keyMap, which is this bug and nothing else;
     a deliberate custom binding always resolves to a real keyCode and is left
     untouched. EmulatorJS then rebuilds from the corrected defaults and saves a
     good table, so this runs at most once per title.

     🚫 Do not widen it to "clear saved settings on version change" - that
     throws away bindings people set on purpose, to fix a fault they may not
     even have.
     --------------------------------------------------------------------- */
  function repairCachedControls() {
    var repaired = [];
    try {
      if (!window.localStorage) return repaired;
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        if (!k || k.indexOf("ejs-") !== 0 || k.slice(-9) !== "-settings") continue;
        var blob;
        try { blob = JSON.parse(localStorage.getItem(k)); } catch (e) { continue; }
        var cs = blob && blob.controlSettings;
        if (!cs || typeof cs !== "object") continue;
        var bad = false;
        for (var p in cs) {
          for (var b in cs[p]) {
            if (cs[p][b] && cs[p][b].value === -1) { bad = true; break; }
          }
          if (bad) break;
        }
        if (bad) { localStorage.removeItem(k); repaired.push(k); }
      }
    } catch (e) { /* a profile we cannot read is not a reason to refuse to boot */ }
    return repaired;
  }

    head("data/loader.js").then(function (loaderOk) {
      if (!loaderOk) {
        tell("no emulator core on this machine", [
          "EmulatorJS is not installed here. It is a third-party GPL build of roughly 10-15MB, gitignored on purpose because this repo is public — so it is fetched per machine rather than committed.",
          { text: "From Game/cat/emulator/ — BOTH steps, the second is not optional:", cls: "dim" },
          { code: INSTALL },
          { text: "Then reload. Nothing else needs configuring — this page already points at data/ and asks for the c64 core.", cls: "dim" },
          { text: "The PLC cartridges do not use any of this and are unaffected.", cls: "dim" }
        ]);
        return;
      }
      return Promise.all(CORE_FILES.map(head)).then(function (found) {
        if (found.indexOf(true) === -1) {
          tell("the loader is installed, but the core is not", [
            { text: "data/loader.js is here, and data/cores/ has no " + CORE + " build in it. These are two separate downloads and the git clone only provides the first.", cls: "err" },
            "🚨 Left alone, EmulatorJS would quietly fetch the core from cdn.emulatorjs.org instead of saying anything. This page refuses that on purpose: the arcade is not allowed to depend on the internet at runtime, and a core arriving over the network hides whatever else is actually wrong.",
            { text: "From Game/cat/emulator/ :", cls: "dim" },
            { code: INSTALL.split("\n\n")[1] },
            { text: "Then reload.", cls: "dim" }
          ]);
          return;
        }
        /* BEFORE the loader runs, or loadSettings() reads the poisoned table
           first and the repair is a frame too late. */
        var repaired = repairCachedControls();
        if (repaired.length) {
          console.log("[cat] cleared " + repaired.length +
            " cached control table(s) holding an unresolvable key: " + repaired.join(", "));
        }
        var s = document.createElement("script");
        s.src = "data/loader.js";
        s.onerror = function () {
          tell("the core is there but would not load", [
            { text: "data/loader.js answered a HEAD request and then failed to execute.", cls: "err" },
            "That usually means a partial or corrupt download. Delete Game/cat/emulator/data/ and fetch it again."
          ]);
        };
        document.body.appendChild(s);
      });
    });
  }

  window.EJS_onGameStart = function () {
    say.hidden = true;
    toHub({ type: "cat:running", title: TITLE, disks: DISKS.length });
    /* Report the mode the moment there is a game to have one. The hub paints a
       label from this and never assumes a default of its own. */
    reportInputMode();
    /* ...and the port, for the same reason and at the same moment. Until this
       fires the hub shows no port control at all — a plain cartridge has no
       joystick port to have, exactly as it has no input mode. */
    reportPort();
  };

  window.CAT_EMU = {
    title: function () { return TITLE; },
    disks: function () { return DISKS.slice(); },
    current: function () { return current; },
    swap: swapDisk
  };

  window.EJS_gameUrl = DISKS[0];
  boot();
})();

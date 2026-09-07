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
     --------------------------------------------------------------------- */
  window.EJS_defaultControls = {
    0: {
      0: { value: "ctrl" },
      4: { value: "up" },
      5: { value: "down" },
      6: { value: "left" },
      7: { value: "right" }
    }
  };

  /* Port 2 is the common case for C64 titles; a real minority want Port 1,
     which is why the hub offers a flip rather than this being decided once
     here. ⚠️ Option KEY and VALUE strings are core-specific — if the flip
     appears to do nothing, this pair is the first thing to check against the
     core's own option list, not the hub's button. */
  var PORT_OPTION = "vice_joyport";
  window.EJS_defaultOptions = {};
  window.EJS_defaultOptions[PORT_OPTION] = params.get("port") === "1" ? "1" : "2";

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
    }
  }, true);

  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m || typeof m !== "object") return;
    if (m.type === "cat:swap") swapDisk(Number(m.index));
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

    /* Is the core actually on this machine? A HEAD is enough and costs
       nothing next to the core itself. */
    fetch("data/loader.js", { method: "HEAD" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      var s = document.createElement("script");
      s.src = "data/loader.js";
      s.onerror = function () {
        tell("the core is there but would not load", [
          { text: "data/loader.js answered a HEAD request and then failed to execute.", cls: "err" },
          "That usually means a partial or corrupt download. Delete Game/cat/emulator/data/ and fetch it again."
        ]);
      };
      document.body.appendChild(s);
    }).catch(function () {
      tell("no emulator core on this machine", [
        "The vice_x64sc core is not installed here. It is a third-party GPL build of roughly 10-15MB, gitignored on purpose because this repo is public — so it is fetched per machine rather than committed.",
        { text: "From Game/cat/emulator/ :", cls: "dim" },
        { code: "git clone --depth 1 https://github.com/EmulatorJS/EmulatorJS.git _ejs\nmv _ejs/data data\nrm -rf _ejs" },
        { text: "Then reload. Nothing else needs configuring — this page already points at data/ and asks for the c64 core.", cls: "dim" },
        { text: "The PLC cartridges do not use any of this and are unaffected.", cls: "dim" }
      ]);
    });
  }

  window.EJS_onGameStart = function () {
    say.hidden = true;
    toHub({ type: "cat:running", title: TITLE, disks: DISKS.length });
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

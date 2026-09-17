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
    /* the machine's hub has buttons that would otherwise wait on a machine that
       is never coming; this lets them say why instead. `machine` is declared
       further down, and every call to tell() happens after it exists. */
    if (MACHINE) {
      machine.failed = title;
      toHub({ type: "cat:machinefailed", reason: title });
    }
  }

  /* -----------------------------------------------------------------------
     WHAT THE HUB SENT US. Repeated `d` params, one per side, already in
     order. `title` is only ever displayed.
     --------------------------------------------------------------------- */
  var params = new URLSearchParams(location.search);
  var TITLE = params.get("title") || "DISK";
  var DISKS = params.getAll("d").filter(Boolean);
  var current = 0;

  /* 🆕 2026-09-16 — `?machine=1`: THE MACHINE ITSELF, not a game. A real C64
     sitting at READY. with nothing in the drive, which the hub puts on the CAT
     computer's screen in cracked mode (his locked ask: "booting through FR must
     show the real emulator home/boot screen", and typing into it must be real).
     Disks go in and out of the RUNNING machine, and the hub's buttons type into
     it through the same element the keyboard does. See "THE MACHINE" below. */
  var MACHINE = params.get("machine") === "1";

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

  /* THE MACHINE'S SETTINGS. Every one of these was measured against the running
     core on 2026-09-16 (scratch Electron 32.3.3), not read off a list.
     - vice_autostart disabled: a disk goes in and the machine waits for LOAD,
       instead of typing LOAD"*",8,1:RUN by itself.
     - vice_keyboard_keymap symbolic: the PC key's LABEL is what arrives, so
       Shift+' is a quote. The default (positional) wants Shift+2 for a quote,
       which nobody reading a C64 manual on a PC keyboard will guess.
     - vice_virtual_device_traps: WITHOUT IT A .T64 NEVER LOADS. A T64 holds
       files, not tape pulses, so only the KERNAL traps can read it; with them
       off a typed LOAD blanks the screen forever.
       🔄 BUT ONLY WHILE A TAPE IS IN (putIn/ejectMedia switch it). It boots OFF.
       📌 Measured the same day: with the traps on, disk loads ran nearly TWICE
       as slow (median 1.7s vs 0.9s over 25 directory loads each), so they sit
       in the disk path too, and verify-c64 saw a disk LOAD hang at "LOADING"
       in three runs out of eight with them always on. A disk has true drive
       emulation and needs no trap at all.
     - keyboardInput enabled: his call, the machine opens ready to type. F2
       still flips to the joystick.
     🚨🚨 EJS_disableLocalStorage IS WHAT MAKES ANY OF THE ABOVE TAKE EFFECT
     AT BOOT. With local storage on and no saved settings (every fresh profile),
     EmulatorJS's getCoreSettings() writes an EMPTY pre-boot option file and only
     applies these after the machine has started — by which time autostart has
     already typed LOAD"*",8,1. Measured: the setting read "disabled" and the
     screen showed the autostart anyway. It also means nothing a previous session
     saved can change how the machine boots. */
  if (MACHINE) {
    window.EJS_disableLocalStorage = true;
    window.EJS_gameName = "CAT";
    window.EJS_defaultOptions.vice_autostart = "disabled";
    window.EJS_defaultOptions.vice_keyboard_keymap = "symbolic";
    window.EJS_defaultOptions.vice_virtual_device_traps = "disabled";   /* on only while a tape is in */
    window.EJS_defaultOptions.keyboardInput = "enabled";
  }

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
     the child consumed. So the exit key is forwarded rather than handled.
     🚨 Capture phase, ahead of the emulator's own key handling, or the core
     eats it as a C64 keystroke and the player is stuck inside the game.

     🔄 2026-09-16 — THE EXIT KEY IS F10, NO LONGER SHIFT/CTRL+ESCAPE. His call.
     The concrete case the old limitation was waiting for arrived with the real
     C64 screen: 63 of the 108 disks are tapes, and Shift+RUN/STOP (Shift+Esc)
     is how a tape is loaded. So Escape and Shift+Escape now reach the core as
     RUN/STOP and Shift+RUN/STOP. ⭐ F10, like F2 and F9 below, is not a key a
     C64 has, so it cannot collide with anything a game or BASIC wants.
     ⚠️ The hub (cat.js, HOTKEY_EXIT) catches the same key when it has focus.
     Two renderings of one fact; verify-c64.mjs presses it here. */
  var HOTKEY_EXIT = "F10";
  document.addEventListener("keydown", function (e) {
    if (e.key === HOTKEY_EXIT) {
      e.preventDefault();
      e.stopPropagation();
      toHub({ type: "cat:exit" });
      return;
    }
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
    if (MACHINE) {
      /* only the page this machine is sitting in gets to drive it */
      if (e.source !== window.parent) return;
      machineCommand(m);
      return;
    }
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

  /* =======================================================================
     🆕 2026-09-16 — THE MACHINE (`?machine=1`).

     His locked requirements: the screen is the REAL C64 boot screen; Insert
     Disk puts a disk into that running machine; typing LOAD"*",8,1 and pressing
     Load Game give identical machine state, with "no parallel fake logic path";
     and arbitrary BASIC works because it is BASIC.

     HOW, and every step below was watched working on the real core first:
     1. EmulatorJS will not start without a game (startGameFromDownload reads
        romData.files), so the machine boots on a PLAYLIST: an .m3u plus five
        slot files, zipped here in memory. Nothing is fetched and nothing is
        sourced — the blank disk and tape are built byte by byte below.
     2. Slot 0 is a ZERO-BYTE disk, which the drive treats as no disk at all:
        LOAD"$",8 answers ?FILE NOT FOUND, as an empty 1541 does. It is also
        what Eject puts back.
     3. INSERT = write the image over a slot in the core's own filesystem, then
        switch the drive to that slot. The machine is NOT reset — a BASIC line
        typed before the insert is still there after it (measured).
        ⚠️ Two slots per medium, used alternately, because switching to the
        slot that is already current is not guaranteed to re-read it.
        ⚠️ A tape detaches the disk and a disk detaches the tape — one thing in
        the machine at a time, which is also what the hub's drive slot shows.
     4. TYPING = KeyboardEvents dispatched on EJS_emulator.elements.parent, the
        element real key presses land on. 🚨 Not window, not document: events
        sent there never reach the core (measured — of four targets, only the
        parent and its canvas typed anything).
     🚫 No hub string is ever parsed or acted on here beyond a bounded set of
     commands, and nothing is fetched from another origin.
     ===================================================================== */
  var SLOTS = ["empty.d64", "disk-a.d64", "disk-b.d64", "tape-a.t64", "tape-b.t64"];
  var SLOT_PAIR = { disk: [1, 2], tape: [3, 4] };

  /* 🚨🚨 KEY TIMING IS COUNTED IN EMULATED FRAMES, NOT MILLISECONDS.
     The core reads the keyboard once per frame. A key pressed and released
     between two reads was never pressed at all, as far as the C64 knows.
     📌 MEASURED TWICE OVER, 2026-09-16:
       - with wall-clock gaps the typing worked on a bare test page and then
         dropped `LO` from `LOAD"$",8` in the real hub (?SYNTAX ERROR), where
         repainting the crate and decoding cover art right after an insert
         stalled the page for longer than a key was held;
       - with 30ms between releasing Shift and the next key, `10 PRINT "ANDREW"`
         + RETURN showed on screen and was NOT stored: Shift was still down when
         RETURN was read, and SHIFT+RETURN on a C64 is a newline that does not
         enter the line.
     So every step waits for the machine to have actually run that many frames.
     A stalled page then only makes typing slower, never wrong.
     `settle` is the same idea for the moment after keyboard mode comes on or a
     drive switches: keys sent in that window were dropped (`LOAD` arrived as
     `D`). 🚫 Do not tighten any of these without re-checking with LIST. */
  var KEY_FRAMES = { lead: 3, hold: 3, after: 3, trail: 4, settle: 60 };

  /* 🚨🚨 A BUTTON TYPES ON THE C64's OWN KEY POSITIONS, NOT THE PC's LABELS.
     People type with the SYMBOLIC keymap (Shift+' is a quote), but symbolic has
     a race built into VICE for any character that is shifted on a PC and NOT
     shifted on a C64 — `*` `+` `:` `@`. VICE holds the C64's SHIFT for the PC
     Shift, then has to take it away again for that key, and now and then the
     machine reads the key first.
     📌 MEASURED 2026-09-16, frame-timed, read back from screen memory:
       symbolic, Shift+8 for `*`:   36/40 lines right; every miss was `*`
                                    arriving as SHIFT+* (a line graphic), so the
                                    Load button gave ?SYNTAX ERROR ~1 press in 10
       symbolic, longer Shift hold: no better (30/40 on `*+:` lines)
       numpad `*` and `+`:          typed nothing at all
       POSITIONAL, `*` on `]`:      40/40
     So a button switches the core to POSITIONAL while it types, and back. That
     is a real core option on the same machine; the keys still go in through
     the element the keyboard uses. 🚫 Do not "simplify" this table back to PC
     labels.
     [code, keyCode, shift] as the POSITIONAL keymap reads them (each measured
     by typing it and reading the screen). A character not in here is refused. */
  var KEYS = {
    " ": ["Space", 32, 0], "\n": ["Enter", 13, 0],
    '"': ["Digit2", 50, 1], "$": ["Digit4", 52, 1], "(": ["Digit8", 56, 1], ")": ["Digit9", 57, 1],
    "*": ["BracketRight", 221, 0], "+": ["Minus", 189, 0], "-": ["Equal", 187, 0],
    ":": ["Semicolon", 186, 0], ";": ["Quote", 222, 0], "=": ["Backslash", 220, 0],
    ",": ["Comma", 188, 0], ".": ["Period", 190, 0], "/": ["Slash", 191, 0]
  };
  var KEYMAP_OPTION = "vice_keyboard_keymap";
  /* frames for a keymap switch to be in force before the first key */
  var KEYMAP_FRAMES = 10;
  function keyFor(ch) {
    if (/[A-Z]/.test(ch)) return ["Key" + ch, ch.charCodeAt(0), 0];
    if (/[0-9]/.test(ch)) return ["Digit" + ch, ch.charCodeAt(0), 0];
    return KEYS[ch] || null;
  }

  /* A formatted, empty 35-track 1541 disk: the BAM on 18/0 and an empty
     directory on 18/1. Written from the disk layout, not copied from an image. */
  function blankD64(name) {
    var spt = function (t) { return t <= 17 ? 21 : t <= 24 ? 19 : t <= 30 ? 18 : 17; };
    var img = new Uint8Array(174848), bam = 0, t, i;
    for (t = 1; t < 18; t++) bam += spt(t) * 256;
    img[bam] = 18; img[bam + 1] = 1; img[bam + 2] = 0x41;
    for (t = 1; t <= 35; t++) {
      var n = spt(t), o = bam + 4 * t, bits = (1 << n) - 1;
      if (t === 18) { bits &= ~3; n -= 2; }
      img[o] = n; img[o + 1] = bits & 255; img[o + 2] = (bits >> 8) & 255; img[o + 3] = (bits >> 16) & 255;
    }
    for (i = 0x90; i <= 0xAA; i++) img[bam + i] = 0xA0;
    for (i = 0; i < name.length && i < 16; i++) img[bam + 0x90 + i] = name.charCodeAt(i);
    img[bam + 0xA2] = 0x43; img[bam + 0xA3] = 0x41; img[bam + 0xA5] = 0x32; img[bam + 0xA6] = 0x41;
    img[bam + 256 + 1] = 0xFF;
    return img;
  }
  /* An empty T64 container: the header and one free directory entry. */
  function blankT64(name) {
    var img = new Uint8Array(96), sig = "C64S tape image file", i;
    for (i = 0; i < sig.length; i++) img[i] = sig.charCodeAt(i);
    img[0x20] = 1; img[0x21] = 1; img[0x22] = 1;
    for (i = 0; i < 24; i++) img[0x28 + i] = i < name.length ? name.charCodeAt(i) : 0x20;
    return img;
  }
  /* A "stored" (uncompressed) zip. EmulatorJS extracts it into the core's
     filesystem root and, finding an .m3u, boots on the playlist. */
  function zipStore(files) {
    var table = [], n, k, c;
    for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
    var crc32 = function (d) { var x = 0xFFFFFFFF; for (var i = 0; i < d.length; i++) x = table[(x ^ d[i]) & 255] ^ (x >>> 8); return (x ^ 0xFFFFFFFF) >>> 0; };
    var u16 = function (v) { return [v & 255, (v >> 8) & 255]; };
    var u32 = function (v) { return [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]; };
    var parts = [], central = [], off = 0;
    files.forEach(function (f) {
      var name = new TextEncoder().encode(f.name), sum = crc32(f.data), len = f.data.length;
      var head = [].concat(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0x21), u32(sum), u32(len), u32(len), u16(name.length), u16(0));
      parts.push(new Uint8Array(head), name, f.data);
      central.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0x21),
        u32(sum), u32(len), u32(len), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off))), name);
      off += head.length + name.length + len;
    });
    var size = central.reduce(function (s, x) { return s + x.length; }, 0);
    var end = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(size), u32(off), u16(0)));
    return new Blob(parts.concat(central, [end]));
  }
  function machineMedia() {
    var files = [{ name: "cat.m3u", data: new TextEncoder().encode(SLOTS.join("\n") + "\n") }];
    SLOTS.forEach(function (s, i) {
      var label = s.replace(/\..*$/, "").toUpperCase();
      files.push({ name: s, data: i === 0 ? new Uint8Array(0) : /\.t64$/.test(s) ? blankT64(label) : blankD64(label) });
    });
    return new File([zipStore(files)], "cat.zip");
  }

  /* ---- the machine's state, and the one queue every command goes through.
     ⭐ One queue so an Insert and the Load that follows it can never interleave:
     the Load waits for the disk to be in, then for the drive to settle. */
  var machine = { started: false, failed: null, slot: 0, medium: null, sides: [], side: 0, settleAt: 0 };
  var startedResolve;
  var startedOnce = new Promise(function (r) { startedResolve = r; });
  var queue = Promise.resolve();
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function frameNow() {
    try { return gm().getFrameNum(); } catch (e) { return 0; }
  }
  /* Resolves once the machine has run `n` more frames. ⚠️ Capped in wall-clock
     time, so a paused or stopped core slows typing down instead of hanging
     the queue behind it forever. */
  function frames(n) {
    var until = frameNow() + n, deadline = Date.now() + 250 + n * 100;
    return new Promise(function (resolve) {
      (function poll() {
        if (frameNow() >= until || Date.now() > deadline) { resolve(); return; }
        setTimeout(poll, 8);
      })();
    });
  }
  function settle() { machine.settleAt = frameNow() + KEY_FRAMES.settle; }
  function settled() { return frames(Math.max(0, machine.settleAt - frameNow())); }
  function enqueue(fn) {
    var run = queue.then(function () { return startedOnce; }).then(fn);
    queue = run.catch(function () { /* each command reports its own failure */ });
    return run;
  }
  function gm() { return window.EJS_emulator && window.EJS_emulator.gameManager; }
  function keyTarget() {
    var e = window.EJS_emulator;
    return e && e.elements && e.elements.parent;
  }

  function mediumOf(url) {
    var path = decodeURIComponent(String(url).split(/[?#]/)[0]);
    if (/\.d64$/i.test(path)) return "disk";
    if (/\.t64$/i.test(path)) return "tape";
    return null;
  }
  /* 🚫 Same origin as this page, or it is not fetched. The hub only ever sends
     its own library's files; anything else arriving here is not the hub. */
  function sameOriginUrl(u) {
    try {
      var url = new URL(String(u), location.href);
      return url.origin === location.origin ? url.href : null;
    } catch (e) { return null; }
  }

  /* The KERNAL traps a .T64 needs, on for a tape and off for anything else
     (see "THE MACHINE'S SETTINGS" above for why they must not stay on). */
  var TRAPS_OPTION = "vice_virtual_device_traps";
  function setTraps(on) {
    var e = window.EJS_emulator, want = on ? "enabled" : "disabled";
    if (e && e.allSettings && e.allSettings[TRAPS_OPTION] === want) return;
    if (e && typeof e.changeSettingOption === "function") e.changeSettingOption(TRAPS_OPTION, want);
  }

  function putIn(url, medium) {
    return fetch(url)
      .then(function (r) { if (!r.ok) throw new Error("the image did not load (HTTP " + r.status + ")"); return r.arrayBuffer(); })
      .then(function (buf) {
        var g = gm(), pair = SLOT_PAIR[medium];
        var idx = machine.slot === pair[0] ? pair[1] : pair[0];
        setTraps(medium === "tape");
        g.FS.writeFile("/" + SLOTS[idx], new Uint8Array(buf));
        g.setCurrentDisk(idx);
        machine.slot = idx;
        machine.medium = medium;
        settle();
        return idx;
      });
  }

  function insertMedia(files) {
    var urls = (Array.isArray(files) ? files : []).slice(0, 8).map(sameOriginUrl);
    if (!urls.length || urls.indexOf(null) !== -1) return Promise.reject(new Error("no readable image was named"));
    var medium = mediumOf(urls[0]);
    if (!medium) return Promise.reject(new Error("this format cannot go into the running machine (only .d64 disks and .t64 tapes)"));
    return putIn(urls[0], medium).then(function () {
      machine.sides = urls;
      machine.side = 0;
      return medium;
    });
  }

  /* Another side of the disk in the drive — a real swap, into the running game. */
  function swapSide(index) {
    if (!(index >= 0 && index < machine.sides.length)) return Promise.reject(new Error("no such side"));
    var medium = mediumOf(machine.sides[index]);
    if (!medium) return Promise.reject(new Error("that side is not a disk or a tape"));
    return putIn(machine.sides[index], medium).then(function () { machine.side = index; });
  }

  function ejectMedia() {
    setTraps(false);
    gm().setCurrentDisk(0);
    machine.slot = 0;
    machine.medium = null;
    machine.sides = [];
    machine.side = 0;
    settle();
  }

  /* RESET — his word for the way back to READY. 📌 MEASURED: restart() puts the
     core back on slot 0, so the drive comes back EMPTY. A real C64's reset does
     not take the disk out, so the slot is switched back in afterwards. Keyboard
     mode comes back too: after a reset the machine is at READY., waiting to be
     typed at, whatever mode the game was played in. */
  function resetMachine() {
    var keep = machine.slot;
    gm().restart();
    return frames(75).then(function () {
      if (keep) gm().setCurrentDisk(keep);
      if (!kbdMode) setInputMode(true);
      settle();
    });
  }

  function typeText(text) {
    var s = String(text).toUpperCase();
    for (var i = 0; i < s.length; i++) {
      if (!keyFor(s[i])) return Promise.reject(new Error("no key types " + JSON.stringify(s[i])));
    }
    /* a button types into BASIC, which needs keyboard mode; switching it on is
       reported like any other flip, so the label shows it happened */
    if (!kbdMode) { setInputMode(true); settle(); }
    var e = window.EJS_emulator;
    var was = (e.allSettings && e.allSettings[KEYMAP_OPTION]) || e.getSettingValue(KEYMAP_OPTION) || "positional";
    var switched = was !== "positional";
    var restore = function () { if (switched) e.changeSettingOption(KEYMAP_OPTION, was); };
    return settled().then(function () {
      if (!switched) return null;
      e.changeSettingOption(KEYMAP_OPTION, "positional");
      return frames(KEYMAP_FRAMES);
    }).then(function () {
      var el = keyTarget();
      var fire = function (type, code, key, kc, shift) {
        el.dispatchEvent(new KeyboardEvent(type, { code: code, key: key, keyCode: kc, which: kc, shiftKey: shift, bubbles: true, cancelable: true }));
      };
      var chain = Promise.resolve();
      s.split("").forEach(function (ch) {
        chain = chain.then(function () {
          var k = keyFor(ch), shift = !!k[2];
          var key = ch === "\n" ? "Enter" : ch.toLowerCase();
          if (shift) fire("keydown", "ShiftLeft", "Shift", 16, true);
          return frames(shift ? KEY_FRAMES.lead : 0).then(function () {
            fire("keydown", k[0], key, k[1], shift);
            return frames(KEY_FRAMES.hold);
          }).then(function () {
            fire("keyup", k[0], key, k[1], shift);
            return frames(KEY_FRAMES.after);
          }).then(function () {
            if (!shift) return null;
            fire("keyup", "ShiftLeft", "Shift", 16, false);
            return frames(KEY_FRAMES.trail);
          });
        });
      });
      return chain;
    }).then(function () { restore(); }, function (err) { restore(); throw err; });
  }

  function machineCommand(m) {
    var fail = function (type) {
      return function (err) { toHub({ type: type, reason: String((err && err.message) || err) }); };
    };
    if (machine.failed && /^cat:(insert|type|eject|reset|swap)$/.test(m.type)) {
      toHub({ type: "cat:machinefailed", reason: machine.failed });
      return;
    }
    switch (m.type) {
      case "cat:insert":
        enqueue(function () { return insertMedia(m.files); })
          .then(function (medium) { toHub({ type: "cat:inserted", medium: medium, sides: machine.sides.length }); }, fail("cat:insertfailed"));
        break;
      case "cat:swap":
        enqueue(function () { return swapSide(Number(m.index)); })
          .then(function () { toHub({ type: "cat:swapped", index: machine.side }); },
                function (err) { toHub({ type: "cat:swapnote", note: "could not swap: " + String((err && err.message) || err) }); });
        break;
      case "cat:eject":
        enqueue(function () { ejectMedia(); })
          .then(function () { toHub({ type: "cat:ejected" }); }, fail("cat:ejectfailed"));
        break;
      case "cat:type":
        if (typeof m.text !== "string" || m.text.length > 120) { toHub({ type: "cat:typefailed", reason: "nothing typeable was sent" }); break; }
        enqueue(function () { return typeText(m.text); })
          .then(function () { toHub({ type: "cat:typed" }); }, fail("cat:typefailed"));
        break;
      case "cat:reset":
        enqueue(function () { return resetMachine(); })
          .then(function () { toHub({ type: "cat:resetdone" }); }, fail("cat:resetfailed"));
        break;
      /* a key the HUB received while it had focus, passed on so it is not lost */
      case "cat:key":
        if ((m.phase === "keydown" || m.phase === "keyup") && keyTarget() && typeof m.code === "string") {
          keyTarget().dispatchEvent(new KeyboardEvent(m.phase, {
            code: m.code, key: String(m.key || ""), keyCode: Number(m.keyCode) || 0, which: Number(m.keyCode) || 0,
            shiftKey: !!m.shift, ctrlKey: !!m.ctrl, altKey: !!m.alt, bubbles: true, cancelable: true
          }));
        }
        break;
      case "cat:focus":
        if (keyTarget()) keyTarget().focus();
        break;
      case "cat:input": setInputMode(!kbdMode); break;
      case "cat:port":  setPort(port === "1" ? "2" : "1"); break;
      /* 🆕 the side panel's ports and keyboard ask for a STATE, not a flip: a
         click on port 1 means "the stick, in port 1". Still answered with what
         actually took — both reports go back either way. */
      case "cat:joystick":
        if (String(m.port) === "1" || String(m.port) === "2") { if (port !== String(m.port)) setPort(String(m.port)); else reportPort(); }
        if (kbdMode) setInputMode(false); else reportInputMode();
        break;
      case "cat:keyboard":
        if (!kbdMode) setInputMode(true); else reportInputMode();
        break;
    }
  }

  /* 🚨 EVERY KEY IN THIS PAGE GOES TO THE C64, wherever focus happens to be in
     it. The core only listens on its own element, so a key that lands on this
     document's body — the hub moved focus into the frame, and the element
     inside has not taken it yet — would be lost, or worse: a keydown that
     reached the core with its keyup landing here leaves the key HELD, and the
     machine repeats it forever. So such keys are passed on, and the element
     takes focus. ⚠️ Keys the capture handler above already used (F2, F9, F10)
     are marked defaultPrevented and are left alone. */
  if (MACHINE) {
    ["keydown", "keyup"].forEach(function (type) {
      document.addEventListener(type, function (e) {
        var el = keyTarget();
        if (!el || e.defaultPrevented || el.contains(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        el.dispatchEvent(new KeyboardEvent(type, {
          code: e.code, key: e.key, keyCode: e.keyCode, which: e.which,
          shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, bubbles: true, cancelable: true
        }));
        if (type === "keydown") el.focus();
      }, true);
    });
  }

  /* -----------------------------------------------------------------------
     BOOT. Everything that can be checked before loading a multi-megabyte core
     is checked before loading it, so a failure costs a sentence rather than a
     download and a shrug.
     --------------------------------------------------------------------- */
  function boot() {
    /* the machine boots with nothing in the drive on purpose */
    if (!MACHINE && !DISKS.length) {
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
    if (MACHINE) {
      /* nothing is typed until keyboard mode has had its settling time */
      machine.started = true;
      settle();
      startedResolve();
      toHub({ type: "cat:machine", state: "ready" });
    } else {
      toHub({ type: "cat:running", title: TITLE, disks: DISKS.length });
    }
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
    swap: swapDisk,
    /* the machine's own view of itself, for the rig. 🚫 read-only */
    machine: function () {
      return { on: MACHINE, started: machine.started, failed: machine.failed, slot: machine.slot,
               medium: machine.medium, side: machine.side, keyboard: kbdMode, port: port };
    }
  };

  window.EJS_gameUrl = MACHINE ? machineMedia() : DISKS[0];
  boot();
})();

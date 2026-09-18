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
   🔄 All three have since been watched on the real core: (1) and (2) on
   2026-09-08/09, and (3) on 2026-09-17, when the swap was rebuilt on the
   machine's measured call (see DISK SWAPPING) — verify-c64.mjs §I and §J.
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
     - vice_keyboard_keymap POSITIONAL: a key types what sits in THAT PLACE on a
       real C64, not what its PC label says. `"` is Shift+2, `*` is `]`, `:` is
       `;`, `+` is `-`, `=` is `\`.
       🔄 HIS RULING, 2026-09-17: "favor correctness over label-matching". The
       first cut was SYMBOLIC (PC labels: Shift+' is a quote), and symbolic has a
       race built into VICE on `*` `+` `:` `@` — about one `*` in 10–40 arrived as
       a SHIFT+* graphic (measured; see KEYS below). Positional was 40/40, and the
       buttons already typed on it. So people now type exactly as the buttons do.
       🚫 Do not switch this back to symbolic for friendlier labels: that trades
       a label mismatch a player can learn for a fault they can't.
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
    window.EJS_defaultOptions.vice_keyboard_keymap = "positional";
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

     🔄 2026-09-16 — THE EXIT KEY LEFT SHIFT/CTRL+ESCAPE. His call. (It was F10
     that day; 2026-09-17 moved it again, to F12 — see HOTKEY_EXIT below.)
     The concrete case the old limitation was waiting for arrived with the real
     C64 screen: 63 of the 108 disks are tapes, and Shift+RUN/STOP (Shift+Esc)
     is how a tape is loaded. So Escape and Shift+Escape now reach the core as
     RUN/STOP and Shift+RUN/STOP. ⭐ F12, like F2 and F9 below, is not a key a
     C64 has, so it cannot collide with anything a game or BASIC wants.
     ⚠️ The hub (cat.js, HOTKEY_EXIT) catches the same key when it has focus.
     Two renderings of one fact; verify-c64.mjs presses it here. */
  /* 🔄 2026-09-17 — F10 -> F12 (his call). Reset sat one key away from the
     port key and was too easy to hit by accident. 🚫 Not F4, and not any of
     F1..F8: those are REAL C64 keys that games read. See cat.js HOTKEY_EXIT. */
  var HOTKEY_EXIT = "F12";
  document.addEventListener("keydown", function (e) {
    /* 🆕 2026-09-17 — remember the player's own Shift, by code. It is NOT claimed
       here: it has to reach the core, because Shift is a real C64 key. relayKey
       needs to know which one is down (see heldShift). */
    if (e.key === "Shift") heldShift[e.code] = true;
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
    /* 🔄 2026-09-17, his call: F2 SELECTS the keyboard, it does not toggle.
       Someone pressing F2 is reaching for the keyboard in order to type; a
       toggle could take them the other way, which is the one thing they did
       not want. Pressing it when the keyboard is already live does nothing. */
    if (e.key === "F2") {
      e.preventDefault();
      e.stopPropagation();
      if (!kbdMode) setInputMode(true);
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
    /* 🔄 2026-09-17, his call: F9 FROM THE KEYBOARD PUTS YOU ON THE STICK.
       It used to swap ports silently while the keyboard stayed live, so the
       player pressed it, saw a port light change, and still had no joystick —
       the control appeared broken. Reaching for the port key means reaching for
       the stick, so the first press selects joystick mode and each one after
       that swaps the port, which is what the key was always for. */
    if (e.key === "F9") {
      e.preventDefault();
      e.stopPropagation();
      if (kbdMode) setInputMode(false);
      else setPort(port === "1" ? "2" : "1");
      return;
    }

    /* 🆕 2026-09-17 — WHAT IS ON YOUR PC KEY IS WHAT THE C64 PRINTS.
       His ask: "have the special characters on the PC keyboard be the same on
       the C64 — us humans need that visual reference."

       🚨 THE OBVIOUS WAY TO DO THAT IS THE ONE THAT WAS ALREADY MEASURED AND
       REJECTED. Switching the core to the SYMBOLIC keymap makes PC labels line
       up, and it races: about 1 `*` in 10 arrived as SHIFT+*, and `+`, `:` and
       `@` did the same. POSITIONAL measured 40/40, which is why the machine runs
       on it and why this file carries a 🚫 against going back.
       ⭐ So the keymap does NOT change. Instead the character you asked for is
       translated to the C64 KEY POSITION that produces it, and that position is
       pressed. You get label-matching AND the reliable keymap — the same trick
       typeText() already uses for the deck's buttons, applied to live typing.
       📌 The table is KEYS, the same MEASURED one the buttons type through, so
       the two can never drift apart. Anything not in it is already correct on
       both keyboards and is left alone.
       ⚠️ RE-ENTRANCY: the synthetic key we send arrives at this very handler, so
       `relaying` guards it. Without that it recurses until the stack blows.
       ⚠️ Only in KEYBOARD mode, and never with Ctrl/Alt/Meta held — those are
       the browser's and the shell's, not the machine's. */
    if (kbdMode && !relaying && !e.ctrlKey && !e.altKey && !e.metaKey && e.key !== "Shift") {
      var pos = null;
      if (typeof e.key === "string" && e.key.length === 1) {
        var found = KEYS[e.key.toUpperCase()];
        if (found && !sameKey(e, found)) pos = found;
      }
      /* ⚠️ AUTO-REPEAT, THROTTLED AT THE SOURCE. A held key repeats far faster
         than a relay takes, so a repeat is dropped once the queue is already
         carrying one — but a FRESH press never is. It is swallowed rather than
         let through, because letting it through is how it types the wrong
         character. */
      if (e.repeat && relayPending > 1) { e.preventDefault(); e.stopPropagation(); return; }
      if (pos) {
        e.preventDefault();
        e.stopPropagation();
        claimed[e.code] = true;
        relayKey(pos, e.key);
        return;
      }
      /* 🚨🚨 ORDER. ONE PATH, OR NONE OF THIS WORKS.
         A key that needs no translation — a letter, a digit, RETURN, and every
         character that already sits in the same place on both keyboards — would
         otherwise go STRAIGHT to the core while a translated one was still
         working its way through the queue, and land in front of it.
         📌 MEASURED 2026-09-17 by verify-c64 §D: `LOAD"*",8,1` typed by hand came
         back as `LOAD"*,"(,1`. The comma overtook the closing quote, and the 8
         landed while the relay was holding ShiftLeft down for that quote, so it
         came out as `(` — Shift+8 on a C64. Two paths, two defects, one cause.
         ⭐ So while anything is in flight, EVERY core-bound key goes through the
         same queue, in the order it was struck. With nothing in flight the key
         takes the direct path as before and this costs nothing.
         🚫 Never give a key a way past this queue. Shift is the one exception,
         in the test above: it is a modifier the relay itself reads, so it must
         not be held back behind the key it modifies. */
      if (relayBusy()) {
        e.preventDefault();
        e.stopPropagation();
        claimed[e.code] = true;
        relayKey([e.code, e.keyCode, e.shiftKey ? 1 : 0], e.key);
        return;
      }
    }
  }, true);

  /* true when the key the player actually pressed IS already the position we
     would send — nothing to translate, let it through untouched */
  function sameKey(e, pos) {
    return e.code === pos[0] && !!e.shiftKey === !!pos[2];
  }
  var relaying = false;
  /* WHICH PHYSICAL SHIFT KEYS THE PLAYER IS ACTUALLY HOLDING.
     🚨 The player's own Shift is never intercepted — the translate test above
     only claims single characters, and "Shift" is five — so it reaches the core
     and the C64's shift really is down. That is the state relayKey has to bend
     to the position it wants, and then put back exactly as it found it.
     📌 Tracked by CODE, not as a boolean: releasing ShiftLeft to type `*` and
     then restoring ShiftLeft when the player was holding ShiftRight would leave
     a shift stuck down in the core for the rest of the session. */
  var heldShift = {};
  /* 🚨 IF WE TOOK THE KEYDOWN WE MUST TAKE THE KEYUP. The release was never
     claimed, so it went STRAIGHT to the core while the keydown was still waiting
     its turn in the queue — and for a key struck twice in a row that stray release
     lands between our own press and release and merges the two into one.
     📌 MEASURED 2026-09-17 by verify-c64 §L: a listing typed off a book page came
     back as `10 PRINT "HELO, REC-BAY 4"`. One L of the two, every run.
     ⭐ Our own synthetic release is what the core gets instead, in its turn. */
  var claimed = {};
  /* a window that loses focus never delivers the keyup, so the record would
     stay stuck down; alt-tab away holding Shift and back proves it */
  window.addEventListener("blur", function () { heldShift = {}; claimed = {}; });
  document.addEventListener("keyup", function (e) {
    if (e.key === "Shift") delete heldShift[e.code];
    if (relaying) return;                  /* our own release, on its way to the core */
    if (claimed[e.code]) {
      delete claimed[e.code];
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  var relayQueue = Promise.resolve(), relayPending = 0, relayIdleAt = -1;
  /* 🚨 THE QUEUE DOES NOT REOPEN THE INSTANT IT EMPTIES. If the direct path came
     back the moment relayPending hit 0, a key struck in that gap would reach the
     core while the last relayed key was still being RELEASED — and two presses of
     the SAME key overlapping read as one.
     📌 MEASURED 2026-09-17 by verify-c64 §L: a listing typed off a book page came
     back as `10 PRINT "HELO, REC-BAY 4"`. One L of the two. So the queue stays
     the only path for a short tail after it drains, and a burst of typing is
     carried by one mechanism from its first key to its last. */
  function relayBusy() { return relayPending > 0 || frameNow() < relayIdleAt; }
  function relayKey(pos, ch) {
    var t = keyTarget();
    if (!t) return;
    /* ⚠️ NOTHING IS DROPPED HERE. A fresh keystroke always joins the queue and
       is always typed, in the order it was struck; the only key that is ever
       refused is an auto-REPEAT, and that is refused at the handler above, where
       it can still be swallowed instead of reaching the core untranslated. */
    relayPending++;
    var run = relayQueue.then(function () { return relayOnce(t, pos, ch); });
    relayQueue = run.catch(function () { /* one lost key must not stop the next */ })
                    .then(function () { relayPending--; relayIdleAt = frameNow() + KEY_FRAMES.hold + KEY_FRAMES.after; });
    return run;
  }
  /* 🚨 PACED IN EMULATED FRAMES, exactly as typeText() paces the deck's buttons.
     The first cut fired all four events in one synchronous block, so ZERO frames
     passed between the keydown and the keyup — which is the condition the banner
     above KEY_FRAMES calls fatal: "A key pressed and released between two reads
     was never pressed at all." 📌 MEASURED 2026-09-17: every moved character
     typed NOTHING. verify-c64 §B read `PRINT 45-3` back as `PRINT 453` and §J
     typed 5 of its 17 rows. 🚫 Never collapse these steps back together. */
  function relayOnce(t, pos, ch) {
    /* ⚠️ GUARD PER EVENT, NEVER ACROSS A WAIT. Holding `relaying` true for the
       whole ~13 frames would swallow every real key the player struck inside the
       window. dispatchEvent is synchronous, so the handler runs and returns
       inside this try. */
    var send = function (type, code, key, keyCode, shift) {
      relaying = true;
      try {
        t.dispatchEvent(new KeyboardEvent(type, {
          code: code, key: key, keyCode: keyCode, which: keyCode,
          shiftKey: !!shift, bubbles: true, cancelable: true
        }));
      } finally { relaying = false; }
    };
    var want = !!pos[2], lifted = [], added = false;
    return Promise.resolve().then(function () {
      var held = Object.keys(heldShift);
      /* the position is UNSHIFTED on a C64 but the player is holding Shift to
         reach the character on their PC — `*` `+` `:` `@`, the four this whole
         feature exists for. Take the shift away for the keystroke. */
      if (!want && held.length) {
        lifted = held;
        lifted.forEach(function (code) { send("keyup", code, "Shift", 16, false); });
        return frames(KEY_FRAMES.lead);
      }
      /* the position NEEDS a shift and the player is not holding one */
      if (want && !held.length) {
        added = true;
        send("keydown", "ShiftLeft", "Shift", 16, true);
        return frames(KEY_FRAMES.lead);
      }
      return null;
    }).then(function () {
      send("keydown", pos[0], ch, pos[1], want);
      return frames(KEY_FRAMES.hold);
    }).then(function () {
      send("keyup", pos[0], ch, pos[1], want);
      return frames(KEY_FRAMES.after);
    }).then(function () {
      if (added) { send("keyup", "ShiftLeft", "Shift", 16, false); return frames(KEY_FRAMES.trail); }
      /* put back only a shift the player is STILL holding: those frames are long
         enough for them to have let go, and pressing it again here would leave
         the core holding a key the keyboard is not */
      var back = lifted.filter(function (code) { return heldShift[code]; });
      if (back.length) {
        back.forEach(function (code) { send("keydown", code, "Shift", 16, true); });
        return frames(KEY_FRAMES.trail);
      }
      return null;
    });
  }

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
    /* the hub's play-bar buttons take the keyboard with the click. Focusing this
       iframe from outside only lands keys on its <body>, which the core does
       not listen to (measured 2026-09-17: after a disk button, typed keys went
       nowhere) — so the hub asks, and the core's own element takes focus, as
       the machine's cat:focus does. */
    if (m.type === "cat:focus" && keyTarget()) keyTarget().focus();
    /* The hub asks for a FLIP, not for a specific state - it has no business
       holding the authoritative value. This answers with what actually took. */
    if (m.type === "cat:input") setInputMode(!kbdMode);
    /* Same shape as the input flip: the hub asks for the OTHER port, not for a
       specific one, and is told what actually took. */
    if (m.type === "cat:port") setPort(port === "1" ? "2" : "1");
  });

  /* -----------------------------------------------------------------------
     DISK SWAPPING — ruling 4, built now rather than deferred.

     🔄 2026-09-17 — FIXED, IN LINE WITH THE MACHINE'S SWAP (his ruling: "bring it
     in line with the corner's working swap"). It never worked: it tried three
     method names EmulatorJS 4.2.3 does not have (setCurrentDiskIndex,
     functions.setDisk, setDisk), and the core was only ever handed side 1, so
     it had no other side to swap to. Now:
     1. a game with more than one side BOOTS ON A PLAYLIST of all of them
        (playlistMedia(), in boot) — the same in-memory .m3u zip the machine
        boots on — so the core's own disk control holds every side from the start;
     2. a swap is gameManager.setCurrentDisk(index), the call the machine makes,
        measured live on the running core: the game is NOT reset.
     A one-sided game still boots on its image directly, exactly as before.

     🚨 THE HARD PART, AND WHY THIS REFUSES INSTEAD OF GUESSING. A real
     multi-disk C64 game asks you to swap while it is RUNNING and then reads
     the drive again; the machine is never reset. Reloading the emulator with
     the other image would look like a swap and would actually be a restart —
     the game would lose everything and land back at its title screen, and the
     player would blame the game.

     So: use the core's real disk-control interface, and if it is not there,
     SAY SO and offer a restart the player chooses explicitly. 🚫 Do not make
     the restart automatic. A silent restart dressed as a swap is the
     silent-wrong-destination failure the hub refuses one layer up.
     ⚠️ If an EmulatorJS upgrade renames setCurrentDisk, this refuses (and
     verify-c64.mjs §J goes red); it never falls back to reloading the page. */
  var playlist = false;   /* true once this game booted on every side at once */
  function swapDisk(index) {
    if (!(index >= 0 && index < DISKS.length)) return;
    if (index === current) return;

    var g = gm();
    /* 🚫 Deliberately not a restart. The hub renders a refusal as a choice. */
    var refuse = function (reason) { toHub({ type: "cat:swapfailed", index: index, reason: reason }); };
    if (!playlist) { refuse("this game did not boot with its other sides in the drive's list"); return; }
    if (!g || typeof g.setCurrentDisk !== "function") { refuse("this core exposes no live disk-control interface"); return; }
    try {
      g.setCurrentDisk(index);
    } catch (err) {
      toHub({ type: "cat:swapnote", note: "setCurrentDisk threw: " + err.message });
      refuse("the core refused the swap");
      return;
    }
    current = index;
    toHub({ type: "cat:swapped", index: index, how: "setCurrentDisk" });
  }

  /* THE PLAYLIST a game with more than one side boots on: every side fetched,
     then an .m3u naming them in order, zipped with them in memory (zipStore,
     below). Side 1 is first, so the drive and autostart begin there as they
     always did. 🚫 Same origin only, like the machine's inserts. */
  function playlistMedia() {
    var urls = DISKS.map(sameOriginUrl);
    var bad = urls.indexOf(null);
    if (bad !== -1) return Promise.reject(new Error("side " + (bad + 1) + " is not a file from this arcade"));
    return Promise.all(urls.map(function (u, i) {
      return fetch(u).then(function (r) {
        if (!r.ok) throw new Error("side " + (i + 1) + " did not load (HTTP " + r.status + ")");
        return r.arrayBuffer();
      });
    })).then(function (bufs) {
      var names = urls.map(function (u, i) {
        var ext = (decodeURIComponent(u.split(/[?#]/)[0]).match(/\.[a-z0-9]{1,4}$/i) || [".d64"])[0].toLowerCase();
        return "side-" + (i + 1) + ext;
      });
      var files = [{ name: "cat.m3u", data: new TextEncoder().encode(names.join("\n") + "\n") }];
      bufs.forEach(function (b, i) { files.push({ name: names[i], data: new Uint8Array(b) }); });
      return new File([zipStore(files)], "cat.zip");
    });
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
     🔄 Since his ruling of 2026-09-17 people do too: the machine boots on the
     positional keymap (see THE MACHINE'S SETTINGS), so the switch in typeText()
     below finds it already there and costs nothing. It stays as a guard, in case
     anything ever changes the option while the machine runs.
     WHY POSITIONAL. The SYMBOLIC keymap (Shift+' is a quote) has
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
    ",": ["Comma", 188, 0], ".": ["Period", 190, 0], "/": ["Slash", 191, 0],
    /* 🆕 2026-09-17 — the last five moved characters. They were missing here
       because no deck button ever typed one; the live translation above needs
       them, and having two different ideas of where `@` lives is exactly the
       drift this file warns about everywhere else. 📌 Every one is a MEASURED
       position, taken from the same key-card table cat.js still carries
       (__cat.keycard()) — not derived, not guessed. */
    "@": ["BracketLeft", 219, 0], "&": ["Digit6", 54, 1], "'": ["Digit7", 55, 1],
    "[": ["Semicolon", 186, 1], "]": ["Quote", 222, 1]
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

  /* =======================================================================
     🆕 2026-09-17 — THE FAST LOADER (his question: "Is there a way to have a
     Fast Loader?"). Yes, and it was already inside the core you ship.

     `vice_autoloadwarp` is one of VICE's own options — decoded out of
     data/cores/vice_x64sc-wasm.data, default "disabled", values disabled /
     enabled / mute / disk / disk_mute / tape / tape_mute. It puts the machine
     into warp while the drive or datasette is being accessed and takes it out
     again when the access ends. ⭐ THE CORE OWNS BOTH EDGES, which is the whole
     reason to prefer it: nothing here has to work out when a load finished.

     🚫 REJECTED, and why, so nobody re-opens them:
       · turning OFF vice_drive_true_emulation would make loads near-instant by
         destroying the cycle-exact 1541 this corner exists for (README: full
         VICE's drive emulation "is the reason a folder of cracked .d64 images
         actually runs"). It also silently kills drive sound.
       · virtual device traps are NOT a speed lever here: with true drive
         emulation on they do not serve drive 8 at all, and the core's own note
         for the option is "causes loading issues on rare cases" — which
         corroborates the ~2% LOADING hang this project measured.
       · JiffyDOS exists as an option and the core names the five ROMs it wants,
         but they are licensed, absent, and Game/ is a public Pages root — and a
         KERNAL replacement does nothing for a cracked disk carrying its own
         fastloader, which is most of this library.

     ⚠️ DEFAULT "disk", AND ONLY WHEN THE HUB ASKS. Tapes are left on the slow
     path deliberately: they ride the KERNAL traps that are already blamed for a
     hang, and putting a fast clock on that path is exactly the wrong experiment.
     🚨 NEVER WARP WHILE TYPING. KEY_FRAMES is counted in EMULATED frames and was
     tuned at 1x; warp stretches a three-frame hold into something much longer,
     and this file already records two measured typing failures from timing.
     The hub only asks for warp around a LOAD, never around a keystroke. */
  var WARP_OPTION = "vice_autoloadwarp";
  function setWarp(on) {
    var e = window.EJS_emulator, want = on ? "disk" : "disabled";
    if (!e || typeof e.changeSettingOption !== "function") return null;
    e.changeSettingOption(WARP_OPTION, want);
    /* 🚨 READ IT BACK. changeSettingOption only reaches the core for ids that
       came from getCoreOptions(), and getCoreOptions() is already known to trap
       with "memory access out of bounds" on some builds — so a write can land in
       allSettings and reach nothing at all. Reporting what actually took is the
       same contract setPort and setInputMode keep: this panel never claims a
       state the machine did not confirm. */
    return (e.allSettings && e.allSettings[WARP_OPTION]) || null;
  }

  /* =======================================================================
     🆕 2026-09-17 — IS THE MACHINE BACK AT `READY.`?

     His ask: after the Load button, type RUN automatically. The trap is that a
     great many cracked releases AUTO-START the moment the load ends — on those,
     a RUN typed afterwards lands inside the running game, and on a pure
     machine-code load it prints ?SYNTAX ERROR. So the answer cannot be a timer;
     the hub has to know the machine is genuinely sitting at a BASIC prompt.

     📌 THIS IS THE ONE PLACE THAT READS THE C64's MEMORY, and it is deliberate.
     The HUB still never does — cat.js only types. This is the machine's own
     page reading its own machine, which is a different thing, and the technique
     is not new: verify-c64.mjs has read screen RAM this way since 2026-09-16.
     EmulatorJS exports no memory accessor, so the screen is found by hunting the
     boot banner's screen codes in the WASM heap once, then read at $0400.
     ⚠️ Re-read HEAPU8 every time: the heap can grow and the old view detaches. */
  var screenAt = -1;
  function heap() {
    try { return window.EJS_emulator.gameManager.Module.HEAPU8; } catch (e) { return null; }
  }
  /* "READY." in screen codes: R=18 E=5 A=1 D=4 Y=25 .=46 */
  var READY_CODES = [18, 5, 1, 4, 25, 46];
  /* `**** COMMODORE 64` off the boot banner, in screen codes. It sits at row 1,
     column 4 of the 40x25 grid, so the grid itself starts BANNER_AT bytes before
     the first star.

     🚨 HUNT THIS, NOT THE WORD "BASIC". The boot screen carries "BASIC" TWICE —
     once in `**** COMMODORE 64 BASIC V2 ****` and again in `38911 BASIC BYTES
     FREE` — so a five-code hunt for it is ALWAYS ambiguous, and the "refuse
     rather than guess" test on the hit count therefore refused on EVERY boot.
     📌 MEASURED 2026-09-17: the screen was never found once, so waitReady()
     could never answer early and every press of Load held the whole deck busy
     for its full two-minute backstop before reporting that the game had started
     itself. This 17-code run occurs exactly once on that screen, which is why
     verify-c64.mjs's locateRam() has always hunted it instead.
     🚫 Do not shorten it back to a word the banner repeats. */
  var BANNER_CODES = [42, 42, 42, 42, 32, 3, 15, 13, 13, 15, 4, 15, 18, 5, 32, 54, 52];
  var BANNER_AT = 40 + 4;                   /* row 1, column 4 of the grid */
  function findScreen() {
    var H = heap();
    if (!H) return -1;
    var hits = 0, at = -1;
    outer: for (var i = BANNER_AT; i < H.length - 0x800; i++) {
      if (H[i] !== BANNER_CODES[0]) continue;
      for (var k = 1; k < BANNER_CODES.length; k++) if (H[i + k] !== BANNER_CODES[k]) continue outer;
      hits++;
      if (hits > 1) return -1;              /* ambiguous: refuse rather than guess */
      /* ⭐ THE START OF THE GRID, not the start of the banner. readState() and
         screenSig() both treat this as $0400 and index rows off it, so returning
         the banner's own address would aim every read 44 bytes into row 1. */
      at = i - BANNER_AT;
    }
    return hits === 1 ? at : -1;
  }
  /* What is the machine doing? Three outcomes have to be told apart, and only
     the first may be typed into:
       "ready"   a good load: "READY." with the LOAD's own lines above it
       "error"   a FAILED load: "?FILE NOT FOUND ERROR" and THEN "READY."
       "other"   a game is on screen — it started itself
     🚨 THE ERROR CASE IS THE ONE THAT IS EASY TO MISS. A failed LOAD still
     leaves a READY. prompt, so "is it at READY.?" on its own would cheerfully
     type RUN after a disk that did not load. A leading "?" is BASIC's own error
     marker, and screen code 63 is "?". */
  /* the machine's own words for "I am still working". A drive access paints one
     of these and then holds the screen PERFECTLY STILL for seconds at a time,
     which is exactly what a settled picture looks like from out here.
     🚨 THIS IS WHY THE WORDS ARE READ. Without it the settle below fires DURING a
     load, the hub concludes the game started itself, and it lets go of a machine
     that is mid-LOAD. 📌 MEASURED 2026-09-17, and it only became reachable once
     findScreen() was fixed: before that nothing ever got this far, and every Load
     sat out its full backstop instead — which accidentally gave the drive all the
     time in the world. Fixing the screen hunt is what exposed this. */
  var BUSY_WORDS = /^(SEARCHING|LOADING|FOUND |PRESS PLAY|SAVING|VERIFYING)/;
  function rowText(H, base, row) {
    var out = "", start = base + row * 40, v, c;
    for (c = 0; c < 40; c++) {
      v = H[start + c] & 127;
      out += v === 32 ? " " : v === 0 ? "@" : v < 27 ? String.fromCharCode(v + 64) : v < 64 ? String.fromCharCode(v) : "#";
    }
    return out;
  }
  function readState() {
    var H = heap();
    if (!H || screenAt < 0) return "other";
    var base = screenAt, seen = 0;
    for (var row = 24; row >= 0; row--) {
      var blank = true, start = base + row * 40;
      for (var c = 0; c < 40; c++) if ((H[start + c] & 127) !== 32) { blank = false; break; }
      if (blank) continue;
      if (seen === 0) {
        /* the drive is still going: not ready, not finished, and NOT settled */
        if (BUSY_WORDS.test(rowText(H, base, row))) return "busy";
        for (var k = 0; k < READY_CODES.length; k++) {
          if ((H[start + k] & 127) !== READY_CODES[k]) return "other";
        }
        seen = 1;
        continue;             /* now look at the line the prompt answered */
      }
      return (H[start] & 127) === 63 ? "error" : "ready";
    }
    return "other";
  }
  /* 🚨 HUNT THE SCREEN AT BOOT, WHILE THE BANNER IS STILL UP. It is the only
     landmark this heap has, and the very first thing a button or a player does
     is clear it off the screen. Looking lazily on the first Load meant looking
     at a screen something had already wiped — so the grid was never found, and
     the deck sat busy for the whole backstop with no RUN at the end of it.
     📌 MEASURED 2026-09-17 by verify-c64 §D2, which does exactly that: reset,
     clear, then Load. Fixing findScreen() alone was not enough; WHEN it is asked
     is half the bug.
     📌 The core prints the banner a second or two after it starts, so this polls
     instead of asking once — the same 20 seconds the rig's own locateRam() gives
     it. Once found the address never moves: a wasm heap only ever grows, and the
     KERNAL keeps the screen at $0400 for the life of the machine. */
  function locateScreenAtBoot() {
    /* ⚠️ A SCAN IS NOT FREE, AND THIS ONE RUNS ON THE MACHINE'S OWN THREAD. It
       walks the whole wasm heap, so asking five times a second from the instant
       the core starts — before the KERNAL has even printed the banner — starves
       the emulator. MEASURED 2026-09-17: 20 frames a second, slow enough that the
       rig could not find the screen either and the run died at its own control.
       ⭐ So the FIRST look waits for the banner to exist, and the rest are spaced
       out. It normally lands on that first try.
       🚫 Do not tighten this to make it feel quicker. Nothing is waiting on it —
       the deck's first Load is many seconds away. */
    var tries = 0;
    var look = function () {
      if (screenAt >= 0) return;
      screenAt = findScreen();
      if (screenAt >= 0 || ++tries > 25) return;
      setTimeout(look, 800);
    };
    setTimeout(look, 2000);
  }

  /* a cheap signature of the screen, to notice when it has stopped changing */
  function screenSig() {
    var H = heap();
    if (!H || screenAt < 0) return -1;
    var h = 0;
    for (var i = 0; i < 1000; i += 7) h = (h * 31 + H[screenAt + i]) & 0x7fffffff;
    return h;
  }
  /* Wait until the machine has SETTLED, and say whether there is a BASIC prompt
     worth typing RUN at. "No" is a perfectly good answer — it is what a
     self-starting crack and a failed disk both look like from out here.

     🚨 IT MUST BE ABLE TO CONCLUDE FROM ALL THREE OUTCOMES, NOT JUST SUCCESS.
     The first cut only resolved early on a good READY. and otherwise polled to
     its timeout — so a FAILED load sat here for the full two minutes with the
     hub held busy, and twelve failed loads in a row (which verify-c64 §F2 does
     deliberately) would have taken twenty-four minutes. Measured the hard way:
     it stalled the rig.
       · "error"  -> answer NO at once. The disk did not load.
       · "ready"  -> answer YES, once the drive has had a moment to stop.
       · "other"  -> a game is painting. Wait for the picture to STOP CHANGING
                    for ~2s, then answer NO: it started itself.
     ⚠️ The timeout is the backstop, not the mechanism. If it is ever the thing
     that answers, something is wrong — a game animating forever with no settle,
     or a screen that was never found. */
  var SETTLE_MS = 2000;
  function waitReady(ms) {
    return new Promise(function (resolve) {
      var t0 = frameNow(), gaveUp = Date.now() + (Number(ms) || 90000);
      var lastSig = -2, stillSince = 0, lastHunt = 0;
      /* 🔄 2026-09-17 — the duplicate hunt that stood here is gone: tick() runs
         immediately below and hunts on its own first line. While the screen was
         never found, this scanned the whole wasm heap once up front and then
         four more times a second for two minutes. */
      var tick = function () {
        /* a backstop only: locateScreenAtBoot() owns finding this, and a full
           heap scan four times a second is what made the machine crawl. */
        if (screenAt < 0 && Date.now() - lastHunt > 2000) { lastHunt = Date.now(); screenAt = findScreen(); }
        if (screenAt >= 0) {
          var st = readState();
          if (st === "error") { resolve(false); return; }
          if (st === "ready" && frameNow() > t0 + 30) { resolve(true); return; }
          /* ⭐ A WORKING DRIVE IS NEVER SETTLED, however still the screen is. The
             settle clock is held down rather than allowed to run out. */
          if (st === "busy") { lastSig = -2; stillSince = 0; }
          else {
            var sig = screenSig();
            if (sig !== lastSig) { lastSig = sig; stillSince = Date.now(); }
            else if (stillSince && Date.now() - stillSince > SETTLE_MS) { resolve(false); return; }
          }
        }
        if (Date.now() > gaveUp) { resolve(false); return; }
        setTimeout(tick, 250);
      };
      tick();
    });
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
      /* 🆕 2026-09-17 — "has the load finished, and is BASIC waiting?" The hub
         asks this before it types RUN for you. 🚫 NOT enqueued: it is a read, it
         must not take the machine's turn, and a LOAD the hub is waiting on has
         already left the queue. `ran: false` is a normal answer — it means the
         disk started itself, which is the case that must not be typed into. */
      case "cat:awaitready":
        waitReady(Number(m.ms) || 90000)
          .then(function (ok) { toHub({ type: "cat:atready", ready: !!ok }); });
        break;
      /* 🆕 2026-09-17 — the fast loader. Reports what the core actually took,
         never what it was asked for. */
      case "cat:warp":
        var took = setWarp(!!m.on);
        toHub({ type: took === null ? "cat:warpfailed" : "cat:warped",
                on: took === "disk", value: took,
                reason: took === null ? "this build exposes no settings interface" : "" });
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
     takes focus. ⚠️ Keys the capture handler above already used (F2, F9, F12)
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
        /* a game with more than one side boots on all of them (see DISK
           SWAPPING). BEFORE the loader, which reads EJS_gameUrl as it starts. */
        var media = !MACHINE && DISKS.length > 1
          ? playlistMedia().then(function (file) { window.EJS_gameUrl = file; playlist = true; })
          : Promise.resolve();
        return media.then(function () {
          var s = document.createElement("script");
          s.src = "data/loader.js";
          s.onerror = function () {
            tell("the core is there but would not load", [
              { text: "data/loader.js answered a HEAD request and then failed to execute.", cls: "err" },
              "That usually means a partial or corrupt download. Delete Game/cat/emulator/data/ and fetch it again."
            ]);
          };
          document.body.appendChild(s);
        }, function (err) {
          tell("a side of this disk would not load", [
            { text: String(err && err.message || err), cls: "err" },
            "Nothing was started: a game that asks for its other side and cannot have it would look broken halfway through.",
            { text: "Check that every side's file is still in Game/disks/, then load it again.", cls: "dim" }
          ]);
        });
      });
    });
  }

  window.EJS_onGameStart = function () {
    say.hidden = true;
    if (MACHINE) {
      /* nothing is typed until keyboard mode has had its settling time */
      machine.started = true;
      locateScreenAtBoot();
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
    },
    /* how many live keystrokes are still working their way through the
       translator's queue (see relayKey). 🚫 read-only, and rig-only: it exists
       so verify-c64 can WAIT FOR THE TYPING TO LAND instead of guessing a frame
       count. A guessed wait is exactly the kind of load-sensitive assertion that
       has already cost this rig whole runs. */
    typing: function () { return relayBusy() ? (relayPending || 1) : 0; }
  };

  window.EJS_gameUrl = MACHINE ? machineMedia() : DISKS[0];
  boot();
})();

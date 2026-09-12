/* ===========================================================================
   THE CAT COMPUTER TERMINAL — behaviour.

   A classic script in one IIFE. 🚫 No module, no bundler, no build step — it
   has to run from file:// inside the Fang Rock shell, and anything that needs
   a server or a toolchain is a thing that breaks on the machine this actually
   ships to.

   ⭐⭐ THE ONE RULE THIS FILE IS ORGANISED AROUND: SINGLE EXECUTION PATH.
   Clicking a button and typing its equivalent command must always produce the
   identical on-screen sequence and result. So the buttons do not "do" things —
   each one submits a command STRING through `execute()`, exactly as if it had
   been typed. There is one resolver, and two input surfaces feeding it.
   🚫 If you ever find yourself giving a button its own behaviour, that is the
   bug: it will drift from the typed form, and only one of the two will get
   tested.

   Nothing here knows the name of a single game. The roster is disks.js.
   ========================================================================= */
(function () {
  "use strict";

  var out    = document.getElementById("out");
  var line   = document.getElementById("line");
  var typedEl= document.getElementById("typed");
  var screen = document.getElementById("screen");
  var slot   = document.getElementById("drive-slot");
  var led    = document.getElementById("drive-led");
  var play   = document.getElementById("play");
  var frame  = document.getElementById("play-frame");
  var playTitle = document.getElementById("play-title");

  var btnInsert = document.getElementById("btn-insert");
  var btnEject  = document.getElementById("btn-eject");
  var btnExit   = document.getElementById("btn-exit");
  var btnInput  = document.getElementById("btn-input");
  var btnPort   = document.getElementById("btn-port");
  /* the label and the hotkey hint inside each. 🚨 The label is the live region,
     NOT the button — otherwise a screen reader re-reads "F2 to swap" on every
     single flip, which is noise exactly when the mode has changed. */
  var inputLabel = btnInput.querySelector(".btn__label");
  var inputHint  = btnInput.querySelector(".btn__hint");
  var portLabel  = btnPort.querySelector(".btn__label");
  var portHint   = btnPort.querySelector(".btn__hint");

  /* 🚨🚨 ONE CONSTANT PER HOTKEY, AND THE HINT IS RENDERED FROM IT.
     The hint here and the key handler in emu.js are TWO RENDERINGS OF ONE FACT.
     This repo family has paid for that shape before: NB's controls panel has
     THREE files drawing one key binding and needed verify-controls.mjs to stop
     them drifting. Hard-coding "F2" in the markup and again in emu.js, with
     nothing checking they match, is how a hint ends up naming a key that does
     nothing — and a wrong hint is worse than none, because it is believed.
     ⭐ `verify-cat.mjs` presses the key the hint NAMES and asserts the mode
     actually changed, so the two cannot come apart silently.
     📌 The port key is deliberately not settled — his words, "we'll figure out
     the hotkeys later". Changing it is one edit HERE, and the hint follows. */
  var HOTKEY_INPUT = "F2";
  var HOTKEY_PORT  = "F9";
  var swapBar   = document.getElementById("play-disks");

  /* the two crates and the detail panel, 2026-09-11 */
  var stackPlc  = document.querySelector("#crate-plc .crate__stack");
  var stackLib  = document.querySelector("#crate-lib .crate__stack");
  var tabsLib   = document.querySelector("#crate-lib .crate__tabs");
  var crateLib  = document.getElementById("crate-lib");
  var noteLib   = document.getElementById("crate-lib-notice");
  var dShot     = document.getElementById("detail-shot");
  var dTitle    = document.getElementById("detail-title");
  var dMeta     = document.getElementById("detail-meta");
  var dSyn      = document.getElementById("detail-synopsis");

  /* 🚫 `games.js` is OPTIONAL, like crackintro.js and library.js. A missing one
     means every disk reads as "no entry yet", which is already what 55 of the
     59 do — so the stand-in is the honest state rather than a degradation. */
  var GAMEINFO = window.CAT_GAMEINFO || { info: function () { return null; } };

  var DISKS = (window.CAT_DISKS || []).slice();

  /* ---- state ------------------------------------------------------------
     `selected` is the disk highlighted in the box. `inserted` is the disk in
     the drive. They are deliberately two different things: inserting is an
     explicit, separate action (core spec, Interaction Model 2), so that
     picking a disk up is never the same gesture as committing to it. */
  var selected = null;
  var inserted = null;
  var typed    = "";
  var busy     = false;   /* true while the load theatre is playing */
  var devUnlocked = false;
  var running  = null;    /* the disk currently up in the play overlay */

  /* The crack intro, with a no-op stand-in when crackintro.js is not on the
     page. 🚨 The stand-in is not politeness — `theatre()` chains the LAUNCH
     off this promise, so a missing file without it would leave every load
     hanging forever at "run" with no error anywhere. A hub that cannot start
     a game because a decoration is absent is the worse failure by far. */
  var CRACK = window.CAT_CRACK || { play: function () { return Promise.resolve("no-intro"); } };

  /* A per-disk tint for the sleeve stripe. Cosmetic only — derived from the
     id so a new cartridge gets a colour without anyone choosing one. */
  function tintFor(id) {
    var h = 0, i;
    for (i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
    return "hsl(" + h + " 62% 62%)";
  }

  /* ---- screen ----------------------------------------------------------- */
  function write(text, cls) {
    var d = document.createElement("div");
    if (cls) d.className = cls;
    d.textContent = text;
    out.appendChild(d);
    out.scrollTop = out.scrollHeight;
    return d;
  }
  function blank() { write(" "); }
  function ready() { write("ready."); renderLine(); }

  function renderLine() { typedEl.textContent = typed; }

  /* A short pause, used only by the load theatre. Wrapped so the whole file
     has exactly one timer idiom and reduced-motion can shorten it in one
     place rather than in five. */
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function wait(ms) {
    return new Promise(function (r) { setTimeout(r, REDUCED ? Math.min(ms, 40) : ms); });
  }

  /* ---- the disk box ------------------------------------------------------
     🚨 `coming-soon` disks are filtered out HERE, before render, and that is
     load-bearing rather than cosmetic. Because a disk that cannot be loaded
     never appears in the box, it can never be selected, never be inserted,
     and never reach Command Resolution — which is why the resolver below has
     no status check anywhere in it, and needs none. Every disk the rules can
     reach is loadable by construction.

     `dev` disks are held back the same way, but for a different reason: Laws
     0.15/0.16 make the Empty Cartridge Developer-Mode content behind
     Ctrl+Shift+B. The box's fixed roster is what enforces that — 🚫 never the
     broken path that used to hide it by accident. */
  function visibleDisks() {
    return DISKS.filter(function (d) {
      if (d.status === "coming-soon") return false;
      if (d.dev && !devUnlocked) return false;
      return true;
    });
  }

  /* 🔄 2026-09-11 — TWO CRATES, NOT ONE BOX.
     His ask: separate the CAD/PLC cartridges from the Cracked disks, lay them
     like records, flip the selected one forward.

     ⭐ The split costs almost nothing because the two groups were never really
     one thing: `runner:"plc"` entries are hand-written in disks.js, and
     `runner:"emulator"` entries are discovered at runtime by library.js off a
     directory listing. Two sources, now two crates.

     🚨 STILL ONE ROSTER. Both crates are filled from `visibleDisks()` and
     nothing else. That function is what enforces the Laws 0.15/0.16 dev gate
     and the `coming-soon` filter, and it is why the command resolver needs no
     status check anywhere. 🚫 A crate that renders from its own array re-opens
     both holes at once, silently — the dev disk would simply reappear.

     ⚠️ `--i` IS THE RECORD'S DEPTH IN THE PILE and it is set here rather than
     in CSS because only JS knows the order after filtering. It is an index into
     the RENDERED crate, not into DISKS — those two stopped being the same thing
     the moment `coming-soon` and `dev` were filtered out. */
  function renderBox() {
    var groups = [
      { el: stackPlc, tabs: null,     disks: [] },
      { el: stackLib, tabs: tabsLib,  disks: [] }
    ];
    visibleDisks().forEach(function (d) {
      (d.runner === "plc" ? groups[0] : groups[1]).disks.push(d);
    });

    groups.forEach(function (g) {
      g.el.textContent = "";
      /* 🚨 THE PILE IS A SEPARATE ELEMENT FROM THE SCROLLER, and it has to be.
         The records are absolutely positioned and contribute NO height, so a
         scroller holding them directly has nothing to scroll. Giving the
         SCROLLER the pile's height instead is the one repair that cannot work —
         a scroller as tall as its content never scrolls, and 55 records became
         950px of page that pushed the column off the bottom of the screen.
         So: `.crate__stack` is the window, `.crate__pile` is the depth. */
      var pile = document.createElement("div");
      pile.className = "crate__pile";
      g.disks.forEach(function (disk, i) {
        var b = renderDisk(disk);
        b.style.setProperty("--i", String(i));
        pile.appendChild(b);
      });
      /* ⚠️ Read the pitch back from CSS rather than repeating 17 here. The two
         numbers have to agree exactly or the last record is clipped or floats,
         and a literal in JS is how they drift apart silently. */
      var pitch = parseFloat(getComputedStyle(pile).getPropertyValue("--pitch")) || 17;
      pile.style.height = (g.disks.length * pitch) + "px";
      g.el.appendChild(pile);
      if (g.tabs) renderTabs(g.tabs, g.disks);
    });
  }

  /* The A-Z crate dividers. 🚫 Only letters that HAVE a disk — a dead tab
     teaches nothing and invites a click that does nothing. Clicking scrolls the
     first matching record into view and selects it, so the jump and the
     selection are one gesture rather than two. */
  function renderTabs(host, disks) {
    host.textContent = "";
    var seen = {};
    disks.forEach(function (d, i) {
      var ch = String(d.displayName).trim().charAt(0).toUpperCase();
      if (!/[A-Z]/.test(ch)) ch = "#";
      if (seen[ch] === undefined) seen[ch] = i;
    });
    Object.keys(seen).sort().forEach(function (ch) {
      var t = document.createElement("button");
      t.type = "button";
      t.className = "crate__tab";
      t.textContent = ch;
      t.title = "Jump to " + ch;
      t.addEventListener("click", function () {
        var d = disks[seen[ch]];
        if (!d) return;
        select(d);
        var el = host.parentNode.querySelector('.crate__pile .disk[data-id="' + cssEsc(d.id) + '"]');
        if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
      });
      host.appendChild(t);
    });
  }

  /* 🚨 `CSS.escape` IS NOT ON EVERY BUILD THIS SHIP RUNS ON, and an id here can
     carry characters a selector treats as syntax — library.js slugs a filename,
     so "M.U.L.E." becomes `lib-m-u-l-e` but a future one need not be so kind.
     Quote-safe fallback rather than assuming the global exists. */
  function cssEsc(s) {
    return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/["\\]/g, "\\$&");
  }

  function renderDisk(disk) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "disk";
      b.setAttribute("aria-pressed", String(selected === disk));
      b.dataset.id = disk.id;

      var sleeve = document.createElement("div");
      sleeve.className = "sleeve";
      sleeve.style.setProperty("--tint", tintFor(disk.id));

      var label = document.createElement("div");
      label.className = "label";
      label.textContent = disk.displayName;
      var stripe = document.createElement("span");
      stripe.className = "stripe";
      label.appendChild(stripe);
      sleeve.appendChild(label);

      var name = document.createElement("span");
      name.className = "name";
      name.textContent = disk.displayName;

      b.appendChild(sleeve);
      b.appendChild(name);

      if (disk.dev) {
        var dev = document.createElement("span");
        dev.className = "badge dev";
        dev.textContent = "dev";
        b.appendChild(dev);
      } else if (disk.status === "test") {
        var t = document.createElement("span");
        t.className = "badge";
        t.textContent = "test";
        b.appendChild(t);
      }

      b.addEventListener("click", function () { select(disk); });
      /* ⌨ Arrow keys flip through the pile, which is what a stack of records
         wants. 🚫 Not a global handler: the hub's terminal owns the keyboard
         (blind typing a LOAD command is a first-class surface), so this fires
         only while a record itself has focus. */
      b.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        var sibs = Array.prototype.slice.call(b.parentNode.querySelectorAll(".disk"));
        var next = sibs[sibs.indexOf(b) + (e.key === "ArrowDown" ? 1 : -1)];
        if (!next) return;
        next.focus();
        if (next.scrollIntoView) next.scrollIntoView({ block: "nearest" });
        var d = null;
        DISKS.forEach(function (x) { if (x.id === next.dataset.id) d = x; });
        if (d) select(d);
      });
    return b;
  }

  /* ---- the detail panel ---------------------------------------------------
     🚨 ITS COMMON STATE IS "NOTHING YET", AND THAT MUST READ AS DELIBERATE.
     55 of 59 disks have no screenshot and no synopsis; `games.js` carries the
     four that do, in his own words, and nothing is generated for the rest.
     🚫 Never render an empty image frame — it reads as a picture that failed to
     load, which is a bug report waiting to happen. The frame says, in words,
     that there is no shot yet. Same call `library.js` makes for an empty
     folder: information, not a fault. */
  function renderDetail(disk) {
    if (!disk) {
      dShot.className = "is-empty";
      dShot.style.backgroundImage = "";
      dTitle.textContent = "—";
      dMeta.textContent = "";
      dSyn.textContent = "Pick a disk to see what is on it.";
      dSyn.className = "is-empty";
      return;
    }
    var info = GAMEINFO.info(disk.id) || {};

    if (info.screenshot) {
      dShot.className = "";
      /* url() with quotes — these paths contain spaces ("Asteroid Command"). */
      dShot.style.backgroundImage = 'url("' + info.screenshot + '")';
    } else {
      dShot.className = "is-empty";
      dShot.style.backgroundImage = "";
    }

    dTitle.textContent = disk.displayName;

    /* what is genuinely known about every disk, invented for none of them:
       how many sides, and what the hub has flagged it as. */
    dMeta.textContent = "";
    var sides = (disk.files && disk.files.length) || 0;
    var bits = [];
    if (disk.runner === "plc") bits.push("cartridge");
    else bits.push(sides > 1 ? sides + " disk sides" : "single disk");
    dMeta.appendChild(document.createTextNode(bits.join(" · ")));
    if (disk.dev || disk.status === "test") {
      var badge = document.createElement("span");
      badge.className = "badge" + (disk.dev ? " dev" : "");
      badge.textContent = disk.dev ? "dev" : "test";
      dMeta.appendChild(badge);
    }

    if (info.synopsis) {
      dSyn.textContent = info.synopsis;
      dSyn.className = "";
    } else {
      dSyn.textContent = "No synopsis written for this disk yet.";
      dSyn.className = "is-empty";
    }
  }

  function select(disk) {
    selected = disk;
    btnInsert.disabled = !disk || disk === inserted;
    renderDetail(disk);
    renderBox();
    focusTerminal();
  }

  function setDrive(disk) {
    inserted = disk;
    slot.textContent = disk ? disk.displayName.toUpperCase() : "–– empty ––";
    slot.classList.toggle("loaded", !!disk);
    btnEject.disabled = !disk;
    btnInsert.disabled = !selected || selected === inserted;
  }

  function insertSelected() {
    if (!selected || selected === inserted) return;
    setDrive(selected);
    write("disk inserted: " + selected.displayName.toUpperCase(), "dim");
    ready();
    renderBox();
  }

  function ejectDisk() {
    if (!inserted) return;
    var was = inserted.displayName.toUpperCase();
    setDrive(null);
    write("disk removed: " + was, "dim");
    ready();
    renderBox();
  }

  /* =======================================================================
     COMMAND RESOLUTION — the single source of truth for load behaviour.
     Buttons and the keyboard both arrive here and nowhere else.

     A trailing `,1` is optional throughout and never changes behaviour, so it
     is absorbed by the pattern rather than branched on.
     ===================================================================== */
  var LOAD_RE = /^LOAD\s*"([^"]*)"\s*,\s*8\s*(?:,\s*1\s*)?$/i;
  var RUN_RE  = /^RUN$/i;

  function execute(raw) {
    var cmd = String(raw == null ? "" : raw).trim();
    if (!cmd) { ready(); return; }

    write("> " + cmd.toUpperCase(), "hi");

    var m = cmd.match(LOAD_RE);

    /* Rule 5 — a bare RUN is a no-op, and is checked BEFORE the drive.
       The load theatre prints RUN on screen as the next step after LOAD, so
       answering ?SYNTAX ERROR would punish a player for typing the exact
       thing just shown to them. Rules 3 and 4 already fused load-and-run;
       this only stops that self-inflicted trap from firing. It is deliberately
       not a ?DEVICE NOT PRESENT either — nothing was asked of the drive. */
    if (RUN_RE.test(cmd)) { ready(); return; }

    /* Rule 6 — anything that is not one of the implemented forms. Checked
       before the drive too: a string that never parsed as a load never
       reached the drive, so "device not present" would be answering a
       question nobody asked. */
    if (!m) { write("?syntax  error", "err"); ready(); return; }

    /* Rule 1 — a load form with an empty drive. */
    if (!inserted) { write("?device not present  error", "err"); ready(); return; }

    var arg = m[1];

    /* Rule 2 — LOAD"$",8 lists the directory. Not matched against entries. */
    if (arg === "$") { listDirectory(); return; }

    /* Rule 3 — LOAD"*",8 resolves directly to the disk's one game entry.
       Not matched by name: `*` is not a filename and is never compared to
       one. There is exactly one kind:"game" entry per disk, by construction. */
    if (arg === "*") {
      var game = gameEntry(inserted);
      if (!game) { write("?file not found  error", "err"); ready(); return; }
      loadEntry(inserted, game);
      return;
    }

    /* Rule 4 — any other quoted name: exact, case-insensitive match against
       the inserted disk's entry filenames. */
    var want = arg.trim().toUpperCase();
    var hit = null;
    (inserted.entries || []).forEach(function (e) {
      if (!hit && String(e.filename).toUpperCase() === want) hit = e;
    });

    if (!hit) {
      write("searching for " + want);
      write("?file not found  error", "err");
      ready();
      return;
    }
    loadEntry(inserted, hit);
  }

  function gameEntry(disk) {
    var found = null;
    (disk.entries || []).forEach(function (e) { if (!found && e.kind === "game") found = e; });
    return found;
  }

  function listDirectory() {
    var disk = inserted;
    write('0 "' + disk.displayName.toUpperCase() + '" 8a', "hi");
    (disk.entries || []).forEach(function (e) {
      /* filename is the loadable string; label rides alongside as the
         description, which is what makes blind typing discoverable. */
      var blocks = String(e.kind === "help" ? 4 : 32);
      write("  " + blocks + "  \"" + String(e.filename).toUpperCase() + "\"" +
            "   " + (e.kind === "help" ? "seq" : "prg") + "   " + e.label);
    });
    write("blocks free.", "dim");
    ready();
  }

  /* ---- loading ---------------------------------------------------------- */
  function loadEntry(disk, entry) {
    /* A help entry is displayed by the Hub itself and is NEVER passed to a
       runner. An emulator disk's help note must not try to boot anything. */
    if (entry.kind === "help") {
      showHelp(disk, entry);
      return;
    }
    runGame(disk, entry);
  }

  function showHelp(disk, entry) {
    var content = entry.content && (entry.content.text || entry.content.src);
    if (!content) {
      write("no help content on this disk.", "warn");
      ready();
      return;
    }
    if (entry.content.text) {
      String(entry.content.text).split("\n").forEach(function (l) { write(l); });
      ready();
      return;
    }
    /* A src is a file beside the cartridge. Read it with fetch when the origin
       allows; say so plainly when it does not, rather than showing a blank. */
    fetch(encodeURI(entry.content.src))
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (t) { t.split("\n").forEach(function (l) { write(l); }); ready(); })
      .catch(function (e) {
        write("could not read help file: " + e.message, "err");
        ready();
      });
  }

  /* 🚨 RUNNER DISPATCH. The `runner` field decides which system loads a disk.
     "plc" is a cartridge and loads its own page. "emulator" is a real C64
     image out of Game/disks/, scanned at runtime by library.js, and loads in
     emulator/index.html.
     🚫 Do NOT "fix" anything here by routing one runner to the other. A disk
     loaded by the wrong runner is exactly the silent-wrong-destination
     failure the shell routing above it was built to end.

     ⭐ THE HONEST REFUSAL THAT USED TO LIVE HERE MOVED; IT WAS NOT DELETED.
     It is emulator/emu.js's job now, because only that page can tell the
     three "no" cases apart — no core installed, an origin that cannot run
     WebAssembly, and a core that would not execute. One message here would
     have had to guess between them, and would have been wrong two times in
     three. 🚫 Do not reinstate a core check in this file; it cannot see any
     of the three things it would be claiming. */
  function runGame(disk, entry) {
    if (busy) return;

    if (disk.runner === "emulator") {
      if (!disk.files || !disk.files.length) {
        /* Only reachable if the scanner built a group with no sides in it.
           Reported as a hub fault rather than blamed on the drive. */
        write("?file not found  error", "err");
        write("this disk has no image behind it.", "warn");
        ready();
        return;
      }
      theatre(disk, entry);
      return;
    }
    if (disk.runner !== "plc") {
      write("?unknown runner: " + String(disk.runner).toUpperCase(), "err");
      ready();
      return;
    }
    if (!disk.launch) {
      write("?file not found  error", "err");
      ready();
      return;
    }
    theatre(disk, entry);
  }

  /* The load theatre. Deliberately the same on-screen sequence whether the
     command was typed or came off a button. */
  function theatre(disk, entry) {
    busy = true;
    line.classList.add("idle");
    led.classList.add("on");

    var name = String(entry.filename).toUpperCase();
    write("searching for " + name);

    wait(560)
      .then(function () { write("loading"); return wait(760); })
      .then(function () { write("ready."); return wait(260); })
      .then(function () { write("run", "hi"); return wait(340); })
      .then(function () {
        led.classList.remove("on");
        /* 🚨 THE CRACK INTRO SITS HERE, BETWEEN "RUN" AND THE LAUNCH, AND IT
           RUNS FOR EVERY DISK. His ruling: "not flag-gated, not a one-time
           hidden Easter egg". Spec: cat-computer-cracked-disk-easter-egg-spec.md.
           ⚠️ `busy` stays TRUE across it. The intro swallows keys in the
           capture phase, but the resolver must not be reachable by any other
           route either while a load is mid-flight. */
        return CRACK.play(disk).then(function () { launch(disk); });
      })
      .then(function () {
        busy = false;
        line.classList.remove("idle");
      });
  }

  /* The cartridge runs in an overlay, NOT a navigation. The hub stays alive
     underneath, so exit is a hide: no reload, no second boot sequence, and
     the disk is still in the drive where the player left it. */
  function launch(disk) {
    playTitle.textContent = disk.displayName;
    running = disk;
    frame.src = sourceFor(disk);
    renderSwap(disk);
    /* 🚨 Hidden, NOT set to a guess. Only a cartridge running EmulatorJS has an
       input mode at all - a plain cartridge has none - so this stays out of the
       bar until the frame reports one. Showing "Joystick" here would be the hub
       asserting something it has not been told and cannot see. */
    btnInput.hidden = true;
    inputLabel.textContent = "Input: —";
    inputHint.textContent = "";
    /* the joystick port is the same shape of fact and gets the same treatment:
       hidden until the cartridge says which one it is actually on. */
    btnPort.hidden = true;
    portLabel.textContent = "Port: —";
    portHint.textContent = "";
    play.hidden = false;
    frame.focus();
  }

  /* Where a disk's iframe actually points. A cartridge names its own entry
     point; a library disk is handed to the drive with every side listed in
     order, so the swap control has something to swap TO without the emulator
     page having to re-scan anything. */
  function sourceFor(disk) {
    if (disk.runner !== "emulator") return encodeURI(disk.launch);
    var q = "?title=" + encodeURIComponent(disk.displayName);
    /* 🚨 ABSOLUTE, NOT THE RELATIVE STRING library.js BUILT. `f.url` is
       "../disks/<name>", which is correct RELATIVE TO THIS PAGE (Game/cat/) —
       and this query is handed to Game/cat/emulator/index.html, one level
       deeper, where the same string resolves to Game/cat/disks/ and 404s.
       EmulatorJS reports that as a bare "Network Error" after the core has
       already loaded, which sends you looking at the core.
       ⭐ Resolving against location.href here fixes it from any depth and on
       any origin — arcade://, http://localhost, or file://.
       🚫 Do not "fix" this by adding a ../ to library.js's DIR: that string is
       also what the hub scans and displays from, and this is its only consumer
       that crosses into a different directory. */
    disk.files.forEach(function (f) {
      q += "&d=" + encodeURIComponent(new URL(f.url, location.href).href);
    });
    if (disk.port === 1) q += "&port=1";
    return "emulator/index.html" + q;
  }

  function exitToHub() {
    /* Blank the frame on the way out so the cartridge really stops rather
       than running on behind a hidden panel — audio included. */
    frame.src = "about:blank";
    play.hidden = true;
    running = null;
    renderSwap(null);
    blank();
    write("cartridge stopped.", "dim");
    ready();
    focusTerminal();
  }

  /* =======================================================================
     DISK SWAPPING — ruling 4, built now rather than deferred, because Andrew
     hand-picks the library and multi-disk titles are an ordinary near-term
     case rather than a someday one.

     The control lives in the PLAY BAR, next to Exit — the hub's own chrome,
     not the emulator's. The emulator page owns the actual swap; this owns
     saying which side is in and letting the player pick another.
     ===================================================================== */
  function renderSwap(disk) {
    swapBar.textContent = "";
    if (!disk || disk.runner !== "emulator" || !disk.files || disk.files.length < 2) {
      swapBar.hidden = true;
      return;
    }
    swapBar.hidden = false;

    var label = document.createElement("span");
    label.className = "swap-label";
    label.textContent = "Disk";
    swapBar.appendChild(label);

    disk.files.forEach(function (f, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn swap";
      b.textContent = String(i + 1);
      b.title = f.name;
      b.setAttribute("aria-pressed", String(i === (disk.side || 0)));
      b.addEventListener("click", function () {
        /* 🚫 The hub does NOT change `disk.side` here. It asks, and waits to
           be told. Marking the button as done before the emulator confirmed
           would make the UI claim a swap that may not have happened — the
           exact class of lie the swapfailed branch below exists to prevent. */
        frame.contentWindow.postMessage({ type: "cat:swap", index: i }, "*");
      });
      swapBar.appendChild(b);
    });
  }

  /* Messages from the emulator page. 🚨 Everything here is validated by SHAPE
     rather than by origin: on file:// the origin is the string "null", so an
     origin check would reject our own child frame. Nothing below acts on
     message content beyond a bounded index into a list the hub itself built,
     and no message can cause a navigation. */
  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m || typeof m !== "object" || !running) return;

    if (m.type === "cat:exit") { exitToHub(); return; }

    /* INPUT MODE. 🚨 The cartridge is the only thing that knows which mode is
       really live - EmulatorJS owns the setting - so the hub PAINTS this and
       never sets it. The button asks for a flip and waits to be told what
       happened; it does not toggle its own label optimistically, because a
       label that disagrees with the machine is worse than no label at all. */
    if (m.type === "cat:inputmode") {
      btnInput.hidden = false;
      inputLabel.textContent = m.keyboard ? "Input: Keyboard" : "Input: Joystick";
      inputHint.textContent = HOTKEY_INPUT + " to swap";
      return;
    }

    if (m.type === "cat:inputfailed") {
      write("cannot switch input mode on this build.", "warn");
      write("(" + String(m.reason || "no settings interface") + ")", "dim");
      return;
    }

    /* JOYSTICK PORT. Same contract as the input mode above, deliberately: the
       cartridge owns the value, the hub paints it, and the button asks for a
       flip rather than announcing one. 🚨 The number is CLAMPED to 1 or 2 on
       the way in - it is going straight into a label, and a hub that will print
       whatever a frame sends it is a hub that can be made to say anything. */
    if (m.type === "cat:portmode") {
      var p = (String(m.port) === "1") ? "1" : "2";
      btnPort.hidden = false;
      portLabel.textContent = "Port: " + p;
      portHint.textContent = HOTKEY_PORT + " to swap";
      return;
    }

    if (m.type === "cat:portfailed") {
      write("cannot switch joystick port on this build.", "warn");
      write("(" + String(m.reason || "no settings interface") + ")", "dim");
      return;
    }

    if (m.type === "cat:swapped") {
      running.side = Number(m.index) || 0;
      renderSwap(running);
      var f = running.files[running.side];
      write("disk " + (running.side + 1) + " in drive: " + (f ? f.name : ""), "dim");
      return;
    }

    if (m.type === "cat:swapfailed") {
      /* ⭐ THE REFUSAL, SURFACED RATHER THAN PAPERED OVER. Reloading the drive
         with the other image would look like a swap and would actually be a
         restart — the game loses everything and lands back on its title
         screen, and the player blames the game. So the restart is offered as
         a thing the player chooses, in words, and never done automatically. */
      write("cannot swap disks while this game is running.", "warn");
      write("(" + String(m.reason || "no disk-control interface") + ")", "dim");
      write("exit and load disk " + (Number(m.index) + 1) + " to start from that side.", "dim");
      return;
    }

    if (m.type === "cat:swapnote") { write(String(m.note), "dim"); return; }
  });

  /* =======================================================================
     THE DISK LIBRARY. Scanned once at boot, appended to the roster, and
     rendered by exactly the same code that renders a cartridge — his ruling
     was "One mixed box, all equal", so there is no separate shelf, no badge
     and no section header distinguishing the two.
     ⭐ THE EMPTY CASE IS THE NORMAL CASE. `Game/disks/*` is gitignored, so a
     fresh clone has none, and the hub says so as information rather than as
     a fault.
     ===================================================================== */
  /* 🆕 2026-09-12 — THE CRACKED CRATE WHEN THE LIST CANNOT BE READ.
     His ruling: Cracked disks are Fang Rock-only, permanently and by design.
     Everywhere else — file://, Pages, a dev server whose listing fails — the
     scan comes back `unlistable`, and the crate used to sit there EMPTY with one
     dim terminal line to explain it. That read as broken rather than as
     elsewhere. So the crate stays on screen, visibly switched off, and says so.

     🚨 INSIDE FANG ROCK THE SAME RESULT IS A FAULT, NOT "FANG ROCK ONLY". His
     answer when asked: "Say it's a fault." The shell can fail the scan too (the
     room's `listable` flag off, a wrong rootPath), and telling him to go where
     he already is would be the wrong message at the worst possible moment.
     ⭐ The two are told apart by ORIGIN: the shell serves this room on its own
     privileged scheme — Morbius/shell/main.js, `SERVED_SCHEME = "arcade"`,
     registered `standard: true` — and nothing else ever puts the hub there.
     📌 Measured 2026-09-12 under the shell's own Electron (32.3.3), not assumed:
     `location.protocol` reads "arcade:" on that origin. If the shell ever renames
     its scheme, this constant is the one line that has to follow it.

     🚫 Only the FAILED scan is touched. A dev server that can list stays exactly
     as it is, and `empty` (the folder answered and held nothing) is a different
     state with its own line. */
  var SHELL_PROTOCOL = "arcade:";

  function renderLibraryState(res) {
    var off   = !!res && res.state === "unlistable";
    var fault = off && location.protocol === SHELL_PROTOCOL;
    crateLib.classList.toggle("is-unavailable", off);
    crateLib.classList.toggle("is-fault", fault);
    noteLib.hidden = !off;
    if (!off) return;
    noteLib.querySelector(".crate__notice-title").textContent = fault
      ? "Fault: disk folder unreadable"
      : "Available in Fang Rock only";
    noteLib.querySelector(".crate__notice-body").textContent = fault
      ? "Fang Rock could not read the game/disks/ folder (" + String(res.detail || "no reason given") + ")."
      : "This crate fills when the arcade is opened from Fang Rock.";
  }

  function loadLibrary() {
    if (!window.CAT_LIBRARY) return Promise.resolve(null);
    return window.CAT_LIBRARY.scan().then(function (res) {
      renderLibraryState(res);
      if (res.state === "present") {
        /* Sorted as one list. A cartridge and a disk are peers here. */
        DISKS = res.disks.concat(DISKS).sort(function (a, b) {
          /* Favourites first, in the order _favourites.txt lists them; then
             everything else alphabetically, cartridges and disks together.
             ⚠️ `favRank` can be 0, so it is tested against undefined and
             never for truthiness — the first favourite in the file would
             otherwise sort as though it had none. */
          var ra = a.favRank, rb = b.favRank;
          if (ra !== undefined && rb !== undefined) return ra - rb;
          if (ra !== undefined) return -1;
          if (rb !== undefined) return 1;
          return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
        });
        renderBox();
        blank();
        write("disk library: " + res.disks.length +
              (res.disks.length === 1 ? " disk found." : " disks found."), "dim");
      } else if (res.state === "empty") {
        blank();
        write("disk library: empty. drop .d64 files into game/disks/.", "dim");
      } else if (location.protocol === SHELL_PROTOCOL) {
        /* inside the shell this is the fault the crate now names, so the
           terminal names it too — "not readable from this origin" would be
           blaming the one origin that is supposed to work. */
        blank();
        write("disk library: fault. the disk folder could not be read.", "err");
        write("(" + String(res.detail || "no reason given") + ")", "dim");
      } else {
        /* 🚨 NOT phrased as an error, and NOT the same line as "empty". This
           origin cannot list a directory — the ordinary state on file:// and
           on a fresh clone served from Pages. Saying "no disks found" here
           would send someone looking for files that are sitting right there.
           ⚠️ No longer the only signal: the Cracked crate says it too (above). */
        blank();
        write("disk library: not readable from this origin.", "dim");
        write("(cartridges are unaffected. see game/disks/readme.md)", "dim");
      }
      renderLine();
      return res;
    });
  }

  /* ---- input ------------------------------------------------------------ */
  function focusTerminal() {
    if (document.activeElement && document.activeElement.blur) {
      /* nothing to focus: the terminal is the document. Keeping the caret
         visible is the only affordance, and keydown is bound at document
         level so there is no input to focus in the first place. */
    }
  }

  function submit() {
    var cmd = typed;
    typed = "";
    renderLine();
    execute(cmd);
  }

  document.addEventListener("keydown", function (e) {
    /* While a cartridge is running the keyboard belongs to the cartridge.
       The only thing the hub keeps is the way out. */
    if (!play.hidden) {
      if (e.key === "Escape" && (e.ctrlKey || e.shiftKey)) { e.preventDefault(); exitToHub(); }
      return;
    }
    if (busy) return;

    /* Ctrl+Shift+B — the Developer Mode gate (Laws 0.15/0.16). This is the
       ONLY thing that puts the Empty Cartridge in the box. */
    if (e.ctrlKey && e.shiftKey && (e.key === "B" || e.key === "b")) {
      e.preventDefault();
      devUnlocked = !devUnlocked;
      renderBox();
      if (!devUnlocked && selected && selected.dev) select(null);
      blank();
      write(devUnlocked ? "developer mode on - empty cartridge available."
                        : "developer mode off.", "warn");
      ready();
      return;
    }

    /* Shift + Run/Stop — the authentic shortcut, mapped to Shift+Esc because
       a PC keyboard has no Run/Stop. Resolves through rule 3, exactly as if
       LOAD"*",8 had been typed: same path, same on-screen sequence. */
    if (e.key === "Escape" && e.shiftKey) {
      e.preventDefault();
      execute('LOAD"*",8');
      return;
    }
    /* Run/Stop alone clears the line. Real hardware means a soft stop; the
       core spec leaves it undecided for the Hub, so it does the least
       surprising local thing and does not pretend to be more. */
    if (e.key === "Escape") { e.preventDefault(); typed = ""; renderLine(); return; }

    if (e.ctrlKey || e.altKey || e.metaKey) return;

    if (e.key === "Enter")     { e.preventDefault(); submit(); return; }
    if (e.key === "Backspace") { e.preventDefault(); typed = typed.slice(0, -1); renderLine(); return; }
    if (e.key.length === 1) {
      e.preventDefault();
      if (typed.length < 80) { typed += e.key; renderLine(); }
    }
  });

  /* 🚨 Buttons submit COMMAND STRINGS, they do not call the loader. This is
     what keeps the two input surfaces honest — a button cannot drift from its
     typed equivalent, because it *is* its typed equivalent. */
  Array.prototype.forEach.call(document.querySelectorAll("[data-cmd]"), function (b) {
    b.addEventListener("click", function () { if (!busy) execute(b.dataset.cmd); });
  });
  btnInsert.addEventListener("click", function () { if (!busy) insertSelected(); });
  btnEject.addEventListener("click", function () { if (!busy) ejectDisk(); });
  btnExit.addEventListener("click", exitToHub);

  /* Ask the cartridge to FLIP; it answers with what actually took. 🚨 Focus
     goes straight back to the frame - a mode switch that leaves the caret on
     the hub's own button hands the next keystroke to the wrong document, which
     is precisely the confusion this control exists to remove. */
  btnInput.addEventListener("click", function () {
    if (!running) return;
    try { frame.contentWindow.postMessage({ type: "cat:input" }, "*"); } catch (e) {}
    frame.focus();
  });

  /* Same again for the port, focus included — and here the focus return matters
     MORE than it does for the input switch, not less. You press this because the
     stick is dead; leaving the caret on the hub's own button means your very
     next test press goes to the wrong document and the port you just switched to
     looks just as dead as the one you left. */
  btnPort.addEventListener("click", function () {
    if (!running) return;
    try { frame.contentWindow.postMessage({ type: "cat:port" }, "*"); } catch (e) {}
    frame.focus();
  });

  /* ---- boot -------------------------------------------------------------
     🚫 No literal Commodore banner text. Tommodore/CAT branding instead — the
     look is the tribute, the trademarked words are not reproduced. */
  function boot() {
    renderBox();
    setDrive(null);

    write("**** tommodore cat  basic ****", "hi");
    write("64k ram system   38911 basic bytes free", "dim");
    blank();
    write("powerline challenge  arcade terminal", "dim");
    blank();
    ready();

    setTimeout(function () { screen.classList.remove("booting"); }, 700);

    /* 🚨 The library scan is fired AFTER the machine says "ready.", never
       awaited before it. The boot banner is what tells a player the terminal
       is alive; holding it back behind a directory request would make a slow
       or absent disk folder look like a hub that failed to start. The disks
       arrive in the box a moment later, which is exactly what a real machine
       reading a drive looks like. */
    loadLibrary().catch(function (err) {
      /* scan() is documented never to reject, so reaching here means a fault
         in the hub rather than in the folder. Say which, rather than leaving
         a silent empty box that looks like an empty library. */
      blank();
      write("disk library: scan failed inside the hub.", "err");
      write("(" + String((err && err.message) || err) + ")", "dim");
      renderLine();
    });
  }

  boot();

  /* ---- tooling-only surface --------------------------------------------
     Same idea as NB's `__corr`: a rig can drive the resolver and read state
     without a human at the keyboard. The page itself never uses this.
     🚫 Nothing here may do anything the UI cannot also do. */
  window.__cat = {
    execute: execute,
    disks: function () { return DISKS.slice(); },
    visible: function () { return visibleDisks().map(function (d) { return d.id; }); },
    select: function (id) {
      var d = null;
      DISKS.forEach(function (x) { if (x.id === id) d = x; });
      select(d);
      return !!d;
    },
    insert: insertSelected,
    eject: ejectDisk,
    inserted: function () { return inserted ? inserted.id : null; },
    devUnlocked: function () { return devUnlocked; },
    setDev: function (v) { devUnlocked = !!v; renderBox(); },
    playing: function () { return !play.hidden; },
    playingSrc: function () { return play.hidden ? null : frame.getAttribute("src"); },
    exit: exitToHub,

    /* The library and the drive, for the rig. `library()` re-runs the real
       scan rather than returning a cache, so a test can drop a fixture in and
       watch the box change. 🚫 Nothing here does anything the UI cannot. */
    library: loadLibrary,
    running: function () { return running ? running.id : null; },
    sides: function () { return running && running.files ? running.files.length : 0; },
    side: function () { return running ? (running.side || 0) : -1; },
    swap: function (i) {
      if (!running || !running.files || !running.files[i]) return false;
      frame.contentWindow.postMessage({ type: "cat:swap", index: i }, "*");
      return true;
    },
    swapVisible: function () { return !swapBar.hidden; },
    crack: function () {
      return window.CAT_CRACK
        ? { group: window.CAT_CRACK.group, appliesTo: window.CAT_CRACK.appliesTo,
            greetz: window.CAT_CRACK.greetz, onScreen: !!document.getElementById("crack") }
        : null;
    },
    text: function () { return out.textContent; },
    lines: function () {
      return Array.prototype.map.call(out.children, function (c) { return c.textContent; });
    }
  };
})();

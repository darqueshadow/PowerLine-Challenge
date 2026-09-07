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
  var box    = document.getElementById("box");
  var slot   = document.getElementById("drive-slot");
  var led    = document.getElementById("drive-led");
  var play   = document.getElementById("play");
  var frame  = document.getElementById("play-frame");
  var playTitle = document.getElementById("play-title");

  var btnInsert = document.getElementById("btn-insert");
  var btnEject  = document.getElementById("btn-eject");
  var btnExit   = document.getElementById("btn-exit");

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

  function renderBox() {
    box.textContent = "";
    visibleDisks().forEach(function (disk) {
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
      box.appendChild(b);
    });
  }

  function select(disk) {
    selected = disk;
    btnInsert.disabled = !disk || disk === inserted;
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
     Only "plc" exists today. An "emulator" disk is a cracked disk from the
     separate Easter-egg spec and needs two things this repo does NOT contain:
     ROM images, and an emulator core. So this branch answers honestly.
     🚫 Do NOT "fix" that by routing emulator disks to the plc runner. A disk
     loaded by the wrong runner is exactly the silent-wrong-destination
     failure the shell routing above it was built to end. */
  function runGame(disk, entry) {
    if (busy) return;

    if (disk.runner === "emulator") {
      write("searching for " + String(entry.filename).toUpperCase());
      write("?device not present  error", "err");
      write("no emulator core is installed on this machine, and this disk", "warn");
      write("carries no rom image. cracked disks need both. nothing was", "warn");
      write("loaded - a plc cartridge was not substituted.", "warn");
      ready();
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
        launch(disk);
        busy = false;
        line.classList.remove("idle");
      });
  }

  /* The cartridge runs in an overlay, NOT a navigation. The hub stays alive
     underneath, so exit is a hide: no reload, no second boot sequence, and
     the disk is still in the drive where the player left it. */
  function launch(disk) {
    playTitle.textContent = disk.displayName;
    frame.src = encodeURI(disk.launch);
    play.hidden = false;
    frame.focus();
  }

  function exitToHub() {
    /* Blank the frame on the way out so the cartridge really stops rather
       than running on behind a hidden panel — audio included. */
    frame.src = "about:blank";
    play.hidden = true;
    blank();
    write("cartridge stopped.", "dim");
    ready();
    focusTerminal();
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
    text: function () { return out.textContent; },
    lines: function () {
      return Array.prototype.map.call(out.children, function (c) { return c.textContent; });
    }
  };
})();

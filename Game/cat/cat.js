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
  var btnPower  = document.getElementById("btn-power");
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
  /* 🆕 2026-09-16 — the way out of a game, and on the real C64 the way back to
     READY. It was Shift/Ctrl+Escape. His call moved it, because Shift+Escape is
     Shift+RUN/STOP, and on a real C64 that is how a tape loads. emu.js holds
     the same key (HOTKEY_EXIT there) for when the frame has focus. */
  /* 🔄 2026-09-17 — MOVED F10 -> F12, his call, and the reason is good:
     Reset sat one key from the joystick-port key, and a mis-hit wiped the
     machine. The DANGEROUS key is the one that moved, not the safe one.
     🚫 F4 was asked for first and refused, on a fact worth keeping: F1..F8
     are REAL C64 keys and games use them, so a hub hotkey there would fire
     while someone was playing. F2, F9 and F12 are not C64 keys at all, which
     is the whole reason those three were chosen. Keep any new hotkey off
     F1..F8. */
  var HOTKEY_EXIT  = "F12";
  var swapBar   = document.getElementById("play-disks");

  /* 🆕 2026-09-16 — the real C64 and the deck controls that go with it */
  var machineFrame = document.getElementById("machine-frame");
  var deckNote   = document.getElementById("deck-note");
  var deckTop    = document.getElementById("deck-top");
  var driveEl    = document.getElementById("drive");
  var driveLabel = document.getElementById("drive-label");
  var btnLoad    = document.getElementById("btn-load");
  var btnList    = document.getElementById("btn-list");
  var btnListing = document.getElementById("btn-listing");
  var btnRun     = document.getElementById("btn-run");
  var btnReset   = document.getElementById("btn-reset");
  /* 🆕 2026-09-16 — the C64 side panel (his addendum) */
  var screenShell = document.getElementById("screen-shell");
  var sidePanel  = document.getElementById("c64-side");
  var sidePower  = document.getElementById("c64-power");
  var sidePort1  = document.getElementById("c64-port1");
  var sidePort2  = document.getElementById("c64-port2");
  var sideKeys   = document.getElementById("c64-keys");
  var sideStatus = document.getElementById("c64-side-status");
  /* 🆕 2026-09-16 — the multi-disk side swap (his second addendum) */
  var sideSwap   = document.getElementById("side-swap");
  var driveSide  = document.getElementById("drive-side");
  /* 🆕 2026-09-17 — the corner's new hardware: the cartridge port, the joystick
     cable, and the 1541 front the disk artwork now sits in */
  var cartPort   = document.getElementById("c64-cart");
  var cartShell  = document.getElementById("c64-cart-shell");
  var cartName   = document.getElementById("c64-cart-name");
  var cartStatus = document.getElementById("c64-cart-status");
  var driveBay   = document.getElementById("drive-bay");
  var btnFast    = document.getElementById("btn-fastload");
  var fastLoad   = false;   /* what the MACHINE last confirmed, not what was asked */

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

  /* =======================================================================
     🆕 2026-09-13 — THE LINK TOKEN, AND WHERE THE HUB IS RUNNING. Read up here,
     before the first render, because both can change the ROSTER. (index.html
     reads the token; "THE LINK" further down acts on it.)

     `IN_SHELL` — inside Fang Rock. `window.fangRockShell` is the shell's own
     marker (its preload.js), the sanctioned way to tell the shell from a tab.

     ⭐ CRACKED ONLY: the corner C64's `cracked` token, AND ANYWHERE INSIDE FANG
     ROCK (his call, 2026-09-14: "that C64 main screen in FR, remove the PLC
     games" — in Fang Rock the cabinets are how a PLC game is played). The
     regular cartridges are HIDDEN ENTIRELY — "hidden" chosen over "disabled" —
     so they are not filtered at render, they are taken out of `DISKS` itself,
     and the CAD crate is removed from the page. Every path that could reach a
     cartridge — the crates, the A-Z tabs, arrow keys, the resolver,
     Ctrl+Shift+B, even `__cat.select` — reads this one array, so none of them
     has anything to find. 🚫 A CSS hide, or a check in `visibleDisks()`, would
     leave them in memory for the next path someone adds.
     ⚠️ `runner === "emulator"`, not `!== "plc"`: "cracked only" names what is
     KEPT, so a runner nobody has invented yet stays out too.

     🚨 A CABINET'S GAME IS RESOLVED FIRST, BEFORE THE CUT. Inside Fang Rock a
     cabinet link names a cartridge the menu must not show, so `LINKED` holds
     that one disk object from the full roster and nothing else does. It goes
     straight into the drive and the play overlay, and Exit Game closes the
     window (see `exitGame`) — so the menu it is missing from is never on screen
     while it is loaded. Resolved against `visibleDisks()`, NEVER `DISKS`: a
     link must not be a way round the Ctrl+Shift+B gate (Laws 0.15/0.16).
     ⚠️ `^[a-z]+$` ONLY, so a link can only ever name a hand-written cartridge —
     library.js ids all carry a hyphen (`lib-…`), and they have not been
     scanned yet at this point anyway.
     ===================================================================== */
  var LINK = window.CAT_LINK === undefined ? null : window.CAT_LINK;
  var IN_SHELL = window.fangRockShell === true;
  var CART_ID = /^[a-z]+$/;

  /* 🆕 2026-09-17 — the six books on the corner's shelf (books.js). An empty
     shelf is a SUPPORTED state, like a missing crackintro.js: the reader opens
     and says the shelf is empty, rather than the hub failing over a decoration.
     🚨 DECLARED HERE, NOT WITH CRACK AND DRIVE BELOW. The book token a few
     lines down reads it at IIFE time, and `var` hoisting made that an
     `undefined.forEach` that killed cat.js before `window.__cat` existed —
     i.e. a blank hub, not a missing reader. Keep it above its first reader. */
  var BOOKS = window.CAT_BOOKS || [];

  /* 🆕 2026-09-17 — A BOOK IS A TOKEN TOO, and `book` is a RESERVED PREFIX.
     His ruling: the reader opens from the SHELF IN THE ROOM, not from a hub
     button — so a spine click has to reach this page, and the only thing that
     reaches this page is the one opaque `?cart=` string (his guardrail: Fang
     Rock must not interpret it). `book` alone is the shelf; `book` + a books.js
     id is that one book, so the spine opens the book it shows.
     🚫 A cartridge may therefore never be given an id starting with "book" —
     it would be shadowed here and simply never launch. Nothing does today.
     🚨 An unknown `book…` token is NOT FOUND, exactly like an unknown cartridge,
     and never quietly falls back to the shelf: substituting something that
     works for something that does not is indistinguishable from success on the
     corridor's side, which is the same reasoning as `followLink` below. */
  var BOOK_PREFIX = "book";
  var BOOK_LINK = null;   /* null | "shelf" | "<books.js id>" | "none" */
  if (LINK !== null && CART_ID.test(LINK) && LINK.indexOf(BOOK_PREFIX) === 0) {
    if (LINK === BOOK_PREFIX) BOOK_LINK = "shelf";
    else {
      BOOKS.forEach(function (b) { if (!BOOK_LINK && BOOK_PREFIX + b.id === LINK) BOOK_LINK = b.id; });
      if (!BOOK_LINK) BOOK_LINK = "none";
    }
  }

  var LINKED = null;
  if (LINK !== "cracked" && !BOOK_LINK && CART_ID.test(LINK || "")) {
    visibleDisks().forEach(function (d) { if (!LINKED && d.id === LINK) LINKED = d; });
  }
  /* A book token is a CORNER token — the shelf it came from is in the corner —
     so it brings the real C64 with it, just as `cracked` does. */
  var CRACKED_ONLY = LINK === "cracked" || IN_SHELL || !!BOOK_LINK;
  if (CRACKED_ONLY) {
    DISKS = DISKS.filter(function (d) { return d.runner === "emulator"; });
    var cratePlc = document.getElementById("crate-plc");
    if (cratePlc) cratePlc.parentNode.removeChild(cratePlc);
    stackPlc = null;
  }

  /* 🆕 2026-09-16 — CRACKED MODE IS THE REAL C64. His locked ask: "Booting
     through FR must show the real emulator home/boot screen — not a
     placeholder", with typed LOAD"*",8,1 and the Load Game button giving the
     same machine state, and real BASIC. Cracked mode is exactly "inside Fang
     Rock" plus the corner C64's token, so the two are one switch.
     ⭐ Only cracked disks run on a C64 at all: a PLC cartridge is a web page, so
     the ordinary hub (cartridges and all) keeps its resolver unchanged, and a
     cabinet inside Fang Rock still opens its game in the play overlay.
     See "THE MACHINE" below. */
  var MACHINE = CRACKED_ONLY;

  /* The crack intro, with a no-op stand-in when crackintro.js is not on the
     page. 🚨 The stand-in is not politeness — `theatre()` chains the LAUNCH
     off this promise, so a missing file without it would leave every load
     hanging forever at "run" with no error anywhere. A hub that cannot start
     a game because a decoration is absent is the worse failure by far. */
  var CRACK = window.CAT_CRACK || { play: function () { return Promise.resolve("no-intro"); } };
  /* 🆕 2026-09-16 — the C64 corner's disk-into-drive animation, which replaces
     the crack intro THERE (his addendum). Same stand-in, same reason. */
  var DRIVE = window.CAT_DRIVE || { play: function () { return Promise.resolve("no-animation"); } };

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
    /* On the real C64 the transcript is off the glass, so the hub's latest
       words go on the deck's note line instead — the prompt itself belongs to
       the machine, so "ready." is never echoed there. */
    if (MACHINE && String(text).trim() && text !== "ready.") {
      deckNote.textContent = text;
      deckNote.className = cls === "warn" || cls === "err" ? cls : "";
    }
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
     🔄 2026-09-12 — the "flip forward" is gone: the selected record lights up
     in place (cat.css, "selected"), because opening it covered its neighbours.

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
      if (!g.el) return;   /* cracked-only: the CAD crate is not in the page at all */
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
        /* keep focus on the pile: on the real C64 selecting would otherwise
           hand the keyboard to the machine, and the next arrow would move the
           C64's cursor instead of the next record */
        if (d) select(d, true);
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
  /* =======================================================================
     🆕 2026-09-12 — DISK ART, looked up by NAME. His locked call: one image per
     disk in `assets/disk-art/`, named after the disk, hand-curated exactly like
     `Game/disks/` — no manifest, no metadata file.

     ⭐ SO IT IS FOUND THE WAY THE DISKS ARE FOUND: one listing of the folder,
     read once when the library is scanned. 🚫 NOT a blind <img> per selection.
     55 of 59 disks have no art, so guessing `<name>.png`, `.jpg`, `.webp` would
     put up to three red 404s in the console on nearly every click, and an error
     census that always carries expected failures is one nobody reads (the same
     reasoning library.js gives for `_favourites.txt`).
     ⚠️ ONLY WHERE THE DISK FOLDER COULD BE LISTED. On file:// and Pages that
     request already failed, so asking again for this folder would only add a
     second failure to the console. There the frame shows the screenshot or the
     blank sleeve — and those are the origins with no Cracked disks anyway.
     ⚠️ The listing parsers are library.js's own `_parse` helpers, borrowed
     rather than copied: the HTML-autoindex one carries two measured traps
     (DOMParser, the href ATTRIBUTE), and a second copy is how they drift.

     MATCHING: the art's name, minus its extension, case-insensitive, against
     the disk's displayName OR any of its side files' names. So "Paradroid.png"
     matches Paradroid.d64, and "Airborne Ranger.png" and "Airborne Ranger -
     d1.png" both match that two-sided title. A cartridge has no disk file, so
     it matches on its displayName ("Asteroid Command.png").
     ===================================================================== */
  var ART_DIR  = "assets/disk-art/";
  var ART_PREF = { png: 0, webp: 1, jpg: 2, jpeg: 3, gif: 4 };   /* two formats of one name: first wins */
  var artIndex = {};

  function loadArt(res) {
    var P = window.CAT_LIBRARY && window.CAT_LIBRARY._parse;
    if (!P || !res || res.state === "unlistable") return Promise.resolve(0);
    return fetch(ART_DIR)
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
      .then(function (body) {
        var files = null;
        try { files = P.parseJsonIndex(body); } catch (e) { /* not JSON; try HTML */ }
        if (!files) files = P.parseHtmlIndex(body);
        var idx = {};
        (files || []).forEach(function (name) {
          var m = String(name).match(/^(.*)\.(png|webp|jpe?g|gif)$/i);
          if (!m) return;                                   /* README.md, desktop.ini … */
          var key = m[1].trim().toLowerCase(), ext = m[2].toLowerCase();
          if (!idx[key] || ART_PREF[ext] < ART_PREF[idx[key].ext]) idx[key] = { file: name, ext: ext };
        });
        artIndex = idx;
        return Object.keys(idx).length;
      })
      /* 🚫 no art is the ordinary state, not an error — same as an empty library */
      .catch(function () { artIndex = {}; return 0; });
  }

  function artFor(disk) {
    var names = [disk.displayName];
    (disk.files || []).forEach(function (f) { names.push(String(f.name).replace(/\.[^.]+$/, "")); });
    for (var i = 0; i < names.length; i++) {
      var hit = artIndex[String(names[i]).trim().toLowerCase()];
      if (hit) return ART_DIR + encodeURIComponent(hit.file);
    }
    return null;
  }

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

    /* art first; then the games.js screenshot, as before; then the blank sleeve */
    var art = artFor(disk);
    var pic = art || info.screenshot || null;
    if (pic) {
      dShot.className = art ? "is-art" : "";
      /* url() with quotes — these paths contain spaces ("Asteroid Command"). */
      dShot.style.backgroundImage = 'url("' + pic + '")';
      /* 🚨 A FILE THAT IS THERE BUT WILL NOT DECODE paints NOTHING as a CSS
         background — no broken-image icon, just a dark frame, which is the one
         thing this frame must never be. A background has no onerror, so a
         throwaway Image asks the same question and puts the blank sleeve back.
         ⚠️ Only for the disk still selected: a slow failure must not blank the
         picture of a disk the player has since moved on to. */
      var probe = new Image();
      probe.onerror = function () {
        if (selected !== disk) return;
        dShot.className = "is-empty";
        dShot.style.backgroundImage = "";
      };
      probe.src = pic;
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

  function select(disk, keepFocus) {
    selected = disk;
    btnInsert.disabled = !disk || disk === inserted;
    /* on the real C64 a tape goes into a datasette, and the button says so */
    if (MACHINE) btnInsert.textContent = disk && disk.runner === "emulator" && mediumOfDisk(disk) === "tape" ? "Insert Tape" : "Insert Disk";
    renderDetail(disk);
    renderBox();
    if (!keepFocus) focusTerminal();
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
    /* a cracked disk on the real C64 goes into the RUNNING machine; a PLC
       cartridge (a cabinet link) never does, it is a web page */
    if (MACHINE && selected.runner === "emulator") { machineInsert(selected); return; }
    setDrive(selected);
    write("disk inserted: " + selected.displayName.toUpperCase(), "dim");
    ready();
    renderBox();
  }

  function ejectDisk() {
    if (!inserted) return;
    if (MACHINE && inserted.runner === "emulator") { machineEject(); return; }
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
        return introThenLaunch(disk);
      })
      .then(function () {
        busy = false;
        line.classList.remove("idle");
      });
  }

  /* The last step of every load: the crack intro, then the game. One function
     because a cabinet link (below) ends the same way without the theatre in
     front — and an intro that two callers each chained for themselves is how
     one of them ends up skipping it. */
  function introThenLaunch(disk) {
    return CRACK.play(disk).then(function () { launch(disk); });
  }

  /* The cartridge runs in an overlay, NOT a navigation. The hub stays alive
     underneath, so exit is a hide: no reload, no second boot sequence, and
     the disk is still in the drive where the player left it. */
  function launch(disk) {
    playTitle.textContent = disk.displayName;
    running = disk;
    /* 🆕 2026-09-14 — the way out says where it goes (his calls). A PLC game is
       "Exit Game": inside Fang Rock that closes the Arcade window, back to the
       Arcade room. A cracked disk is "Reset", the machine's own way out of a
       game: back to the disk screen, disk still in the drive. It used to say
       "Exit to CAT" for both. See `exitGame`. */
    var leaves = disk.runner === "plc";
    btnExit.textContent = leaves ? "Exit Game" : "Reset";
    btnExit.title = leaves
      ? (IN_SHELL ? "Stop the game and go back to the Arcade room" : "Stop the game")
      : "Stop the game and go back to the disk screen";
    frame.src = sourceFor(disk);
    /* a fresh boot always starts on the first side, whichever was in last time */
    if (disk.runner === "emulator") disk.side = 0;
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
    /* whatever is exiting to the hub (a cracked disk's Reset, or any game
       outside Fang Rock), the curtain that kept the menu off the glass during a
       cabinet launch comes down here */
    liftCurtain();
    running = null;
    renderSwap(null);
    blank();
    write("cartridge stopped.", "dim");
    ready();
    /* a cabinet's game inside cracked mode kept the machine switched off behind
       it; the hub is on the glass now, so the machine comes on */
    if (MACHINE) { startMachine(); renderSwap(inserted); }
    focusTerminal();
  }

  /* 🆕 2026-09-14 — THE PLAY BAR'S WAY OUT, and the one function the button,
     the exit key (F10 from 2026-09-16, F12 from 2026-09-17) and the emulator's own exit message all use, so the
     three cannot disagree about where a player lands.
     His call: a PLC game's Exit Game goes BACK TO THE ARCADE ROOM. Inside Fang
     Rock that means closing this window. A cracked disk's Reset goes back to the
     disk screen. Outside Fang Rock there is no Arcade room to return to and a
     tab cannot close itself, so every game comes back to the hub. */
  function exitGame() {
    if (running && running.runner === "plc" && IN_SHELL) { leaveArcade(); return; }
    /* 🆕 2026-09-16 — on the real C64 a cracked game is not in an overlay, it
       is running in the machine, so its way out is the machine's: Reset, back
       to READY. with the disk still in the drive. */
    if (!running && MACHINE) { machineReset(); return; }
    exitToHub();
  }

  /* Closes Fang Rock's Arcade window, back to the Arcade room: Exit Game on a
     PLC game, and Power Off on the disk screen.
     📌 MEASURED, NOT ASSUMED, 2026-09-14: under the shell's own Electron
     (32.3.3), with its arcade: scheme, webPreferences and preload mirrored in a
     scratch main, `window.close()` from this page closes the room window — on a
     first load AND after the shell has reloaded it with a different token
     (history.length 2), which is the case Chromium's "scripts may close only
     the windows they opened" rule would refuse in a browser. No shell change,
     no IPC. The real shell was not launched (it re-points fangrock:// in dev).
     ⚠️ If the window is somehow still here a moment later, say so on the
     terminal rather than leave a button that looks like it did nothing. */
  function leaveArcade() {
    frame.src = "about:blank";
    window.close();
    setTimeout(function () {
      if (running) exitToHub();
      /* the rocker went down on the way out; the machine is still on */
      if (MACHINE) paintPower(true);
      write("the arcade window did not close.", "err");
      ready();
    }, 1500);
  }

  /* =======================================================================
     🆕 2026-09-16 — THE MACHINE: a real C64 on the CAT computer's screen.

     His locked requirements (plc_c64_boot_and_typing_prompt.md, and the
     corridor's Brief_Real-C64-Typing_2026-09-16.md in this folder):
       1. booting shows the REAL emulator boot screen, not a placeholder;
       2. a disk inserted, then LOAD"*",8,1 typed or the Load Game button —
          identical machine state, "no parallel fake logic path";
       3. real typing: arbitrary BASIC works;
     and his answers the same day: the crack intro plays ON INSERT DISK, the
     machine opens in KEYBOARD mode, and the exit key is F12 (F10 until 2026-09-17).

     ⭐ THE ONE-PATH RULE STILL HOLDS; ITS PATH MOVED. In the resolver hub a
     button submits a string to execute(). Here a button TYPES its string into
     the machine, one key at a time, through the same element a real key press
     lands on (emu.js). The machine then does whatever a C64 does with it —
     including ?SYNTAX ERROR, ?FILE NOT FOUND and PRESS PLAY ON TAPE, which
     the hub no longer fakes and no longer needs to.
     🚫 So nothing in this section interprets a command. It moves disks, types
     keys, resets, and reports what the machine answered.

     The crack intro cannot sit between RUN and the game any more: RUN goes
     straight into the machine and the hub never sees it. His call: it plays
     when the disk goes in.
     🔄 SAME DAY, HIS ADDENDUM (plc_c64_ui_addendum.md): here, Insert plays a
     disk sliding into a drive (driveinsert.js) instead of the crack intro, and
     the deck's Input / Port / Power Off become a drawn C64 side panel. The
     crack intro still plays for a cabinet's launch.
     ===================================================================== */
  var machineStarted = false;
  var machineFailed  = null;
  var machineOff     = false;   /* the rocker, outside Fang Rock (see "power") */
  var medium   = null;      /* "disk" | "tape" | null — what the machine said went in */
  var waiters  = [];        /* commands waiting on the machine's answer */
  var forwarded = {};       /* keys the hub passed on, so their release follows them */

  function startMachine() {
    if (!MACHINE || machineStarted) return;
    machineStarted = true;
    screen.classList.add("is-machine");
    machineFrame.hidden = false;
    machineFrame.src = "emulator/index.html?machine=1&title=CAT";
  }

  /* 🚨 FOCUS GOES INTO THE MACHINE, ALL THE WAY. Focusing the iframe alone puts
     keys on the frame's body, which the core does not listen to; emu.js passes
     those on and takes focus itself, and cat:focus asks for it directly. */
  function focusMachine() {
    if (!MACHINE || !machineStarted || !play.hidden) return;
    try { machineFrame.focus(); } catch (e) { /* not focusable yet */ }
    postMachine({ type: "cat:focus" });
  }

  /* the crack intro takes its skip key in the hub's document, so the machine
     must not be holding the keyboard while it plays */
  function releaseMachineFocus() {
    if (document.activeElement === machineFrame) machineFrame.blur();
  }

  function postMachine(msg) {
    try { machineFrame.contentWindow.postMessage(msg, "*"); return true; }
    catch (e) { return false; }
  }

  /* Send a command and wait for the machine's answer. ⚠️ ALWAYS SETTLES: an
     answer, a machine that has said it cannot run, or a timeout that says so —
     never a button that silently stays busy. */
  function machineCall(msg, replies, ms) {
    return new Promise(function (resolve, reject) {
      if (machineOff) { reject(new Error("the c64 is switched off")); return; }
      if (machineFailed) { reject(new Error(machineFailed)); return; }
      var w = { replies: replies, resolve: resolve, reject: reject };
      w.timer = setTimeout(function () {
        var i = waiters.indexOf(w);
        if (i !== -1) waiters.splice(i, 1);
        reject(new Error("the machine did not answer"));
      }, ms);
      waiters.push(w);
      if (!postMachine(msg)) {
        clearTimeout(w.timer);
        waiters.splice(waiters.indexOf(w), 1);
        reject(new Error("the machine is not reachable"));
      }
    });
  }

  /* A message from the machine frame. Returns true when nothing else should
     look at it. */
  function machineMessage(m) {
    if (m.type === "cat:machinefailed") {
      machineFailed = String(m.reason || "the machine could not start");
      waiters.splice(0).forEach(function (w) { clearTimeout(w.timer); w.reject(new Error(machineFailed)); });
      write("the c64 could not start: " + machineFailed, "err");
      return true;
    }
    if (m.type === "cat:machine") return true;
    for (var i = 0; i < waiters.length; i++) {
      if (waiters[i].replies.indexOf(m.type) !== -1) {
        var w = waiters.splice(i, 1)[0];
        clearTimeout(w.timer);
        w.resolve(m);
        return true;
      }
    }
    return false;
  }

  /* The Load button types what loads the medium that is in: LOAD"*",8,1 for a
     disk, LOAD for a tape. It says exactly what it will type, so a player
     watching it learns what to type themselves. */
  function paintLoad() {
    var tape = MACHINE && medium === "tape";
    btnLoad.dataset.cmd = tape ? "LOAD" : 'LOAD"*",8,1';
    btnLoad.textContent = tape ? "Load" : "Load \"*\",8,1";
    driveLabel.textContent = tape ? "Tape" : "Drive 8";
  }

  function machineInsert(disk) {
    if (busy) return;
    if (machineOff) { write("the c64 is switched off. power it on first.", "warn"); return; }
    busy = true;
    led.classList.add("on");
    /* 🆕 2026-09-17 — the drive's red lamp comes on SOLID for the access, and a
       cartridge never lights it at all: a cart is read by the CPU on power-up,
       the drive is not touched, and lighting it would be the corner telling a
       lie about the machine. */
    if (!isCartridge(disk)) paintDrive("loading");
    releaseMachineFocus();
    var files = (disk.files || []).map(function (f) { return new URL(f.url, location.href).href; });
    DRIVE.play(disk, { medium: mediumOfDisk(disk), host: screenShell })
      .then(function () {
        return machineCall({ type: "cat:insert", files: files }, ["cat:inserted", "cat:insertfailed"], 60000);
      })
      .then(function (m) {
        if (m.type === "cat:inserted") {
          disk.side = 0;
          medium = m.medium === "tape" ? "tape" : "disk";
          setDrive(disk);
          paintLoad();
          paintCart(disk);
          renderSwap(disk);
          write((medium === "tape" ? "tape inserted: " : "disk inserted: ") + disk.displayName.toUpperCase(), "dim");
        } else {
          /* 🚨 THE BLINK IS SPENT HERE, and only here: on a real 1541 a blinking
             red light is the DOS error signal, so this is the one moment it is
             telling the truth. */
          paintDrive("failed");
          write("could not insert " + disk.displayName.toUpperCase() + ": " + String(m.reason || "no reason given"), "err");
        }
      })
      .catch(function (err) {
        paintDrive("failed");
        if (!err.byPowerOff) write("could not insert " + disk.displayName.toUpperCase() + ": " + err.message, "err");
      })
      .then(function () {
        led.classList.remove("on");
        if (!driveBay.classList.contains("is-failed")) paintDrive(null);
        busy = false;
        ready();
        renderBox();
        focusMachine();
      });
  }

  function machineEject() {
    if (busy) return;
    busy = true;
    var was = inserted.displayName.toUpperCase();
    machineCall({ type: "cat:eject" }, ["cat:ejected", "cat:ejectfailed"], 20000)
      .then(function (m) {
        if (m.type !== "cat:ejected") throw new Error(String(m.reason || "no reason given"));
        medium = null;
        setDrive(null);
        paintLoad();
        renderSwap(null);
        write("removed: " + was, "dim");
      })
      .catch(function (err) { if (!err.byPowerOff) write("could not eject: " + err.message, "err"); })
      .then(function () { busy = false; ready(); renderBox(); focusMachine(); });
  }

  /* A command button on the real C64: TYPE the string, then RETURN. */
  function machineType(cmd) {
    if (busy) return;
    busy = true;
    machineCall({ type: "cat:type", text: String(cmd) + "\n" }, ["cat:typed", "cat:typefailed"], 30000)
      .then(function (m) {
        if (m.type !== "cat:typed") throw new Error(String(m.reason || "no reason given"));
      })
      .catch(function (err) { if (!err.byPowerOff) write("could not type " + String(cmd) + ": " + err.message, "err"); })
      .then(function () { busy = false; focusMachine(); });
  }

  function machineReset() {
    if (busy || !machineStarted) return;
    busy = true;
    machineCall({ type: "cat:reset" }, ["cat:resetdone", "cat:resetfailed"], 20000)
      .then(function (m) {
        if (m.type !== "cat:resetdone") throw new Error(String(m.reason || "no reason given"));
        write("reset." + (inserted ? " " + inserted.displayName.toUpperCase() + " is still in." : ""), "dim");
      })
      .catch(function (err) { if (!err.byPowerOff) write("could not reset: " + err.message, "err"); })
      .then(function () { busy = false; ready(); focusMachine(); });
  }

  /* ---- the sides of a multi-disk game ------------------------------------
     His second addendum, written because swapping has gone wrong for him before:
     the player never picks a FILE, never needs a second drive, and never has to
     wonder which side is in.
       - The sides are ONE library entry already: library.js pairs "- d1 / d2",
         "(Disk 1)", "Side A / B" off the file names, and Insert puts side A in.
       - DRIVE 8 ONLY. A swap writes the other side over the drive's other slot
         in the running machine (emu.js putIn) — the same drive a game asks for.
       - ONE CONTROL, only while such a game is in: two sides get one button,
         "Swap to Side B"; more than two get one button per side, so any side is
         still a single click (cycling through the others to reach one would
         show the game sides it never asked for). The side that is in is lit,
         like the port the stick is in.
       - "Now playing: Side A" beside the drive, always, from the machine's answer.
     🚫 Out of scope, his words: noticing that a game wants the other side. */
  function sideName(i) { return "Side " + String.fromCharCode(65 + i); }

  function renderSides(disk) {
    sideSwap.textContent = "";
    var multi = !!(disk && disk.runner === "emulator" && disk.files && disk.files.length > 1 && disk === inserted);
    sideSwap.hidden = !multi;
    driveSide.hidden = !multi;
    if (!multi) { driveSide.textContent = ""; return; }
    var cur = disk.side || 0;
    driveSide.textContent = "Now playing: " + sideName(cur);
    var add = function (i, label, lit) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn side-btn" + (lit ? " is-lit" : "");
      b.textContent = label;
      b.dataset.side = String(i);
      b.setAttribute("aria-pressed", String(lit));
      b.disabled = lit;
      b.addEventListener("click", function () { machineSwap(i); });
      sideSwap.appendChild(b);
    };
    if (disk.files.length === 2) add(cur === 0 ? 1 : 0, "Swap to " + sideName(cur === 0 ? 1 : 0), false);
    else disk.files.forEach(function (f, i) { add(i, sideName(i), i === cur); });
  }

  function machineSwap(index) {
    var disk = inserted;
    if (busy || !disk || !disk.files || !disk.files[index] || index === (disk.side || 0)) return;
    busy = true;
    led.classList.add("on");
    machineCall({ type: "cat:swap", index: index }, ["cat:swapped", "cat:swapnote"], 60000)
      .then(function (m) {
        if (m.type !== "cat:swapped") throw new Error(String(m.note || "no reason given").replace(/^could not swap: /, ""));
        disk.side = Number(m.index) || 0;
        write(sideName(disk.side).toLowerCase() + " is in the drive.", "dim");
      })
      .catch(function (err) { if (!err.byPowerOff) write("could not swap sides: " + err.message, "err"); })
      .then(function () {
        led.classList.remove("on");
        busy = false;
        renderSides(inserted);
        focusMachine();
      });
  }

  /* 🆕 2026-09-17 — LOAD, AND THEN RUN IF THERE IS ANYTHING TO RUN.
     His ask, built the only way that is safe. The naive version — type RUN after
     a fixed wait — is wrong on a large slice of this library, because a great
     many cracked releases START THEMSELVES the instant the load finishes. On
     those, three keystrokes land inside the running game; on a pure machine-code
     load, RUN prints ?SYNTAX ERROR. So the machine is ASKED whether it is
     genuinely sitting at a BASIC prompt, and RUN is typed only if it says yes.
     ⭐ `ready: false` is a success, not a failure: it is what a self-starting
     crack looks like from out here, and the right response is to do nothing.
     🚫 It must also stay silent on a FAILED load — a failed LOAD"*",8,1 leaves
     READY. on screen, so the drive is asked too, via the lamp state. */
  function loadThenRun(cmd) {
    if (busy) return;
    busy = true;
    paintDrive("loading");
    machineCall({ type: "cat:type", text: String(cmd) + "\n" }, ["cat:typed", "cat:typefailed"], 30000)
      .then(function (m) {
        if (m.type !== "cat:typed") throw new Error(String(m.reason || "no reason given"));
        return machineCall({ type: "cat:awaitready", ms: 120000 }, ["cat:atready"], 130000);
      })
      .then(function (m) {
        if (!m.ready) { write("it started on its own.", "dim"); return null; }
        return machineCall({ type: "cat:type", text: "RUN\n" }, ["cat:typed", "cat:typefailed"], 30000);
      })
      .catch(function (err) { if (!err.byPowerOff) write("could not load: " + err.message, "err"); })
      .then(function () { paintDrive(null); busy = false; focusMachine(); });
  }

  /* One entry point for every command button and for the tooling surface. */
  function submitCommand(cmd) {
    if (MACHINE && machineStarted) machineType(cmd);
    else execute(cmd);
  }

  /* A key the HUB received while cracked mode was on — the player clicked a
     crate, then typed. Passed on rather than dropped, and focus follows it, so
     the rest of what they type goes straight in. */
  function forwardKey(phase, e) {
    postMachine({ type: "cat:key", phase: phase, code: e.code, key: e.key, keyCode: e.keyCode,
                  shift: e.shiftKey, ctrl: e.ctrlKey, alt: e.altKey });
  }

  /* What a library entry IS, from its first file's name — only so the Insert
     button and the drive animation can say "tape" for a tape. 🚫 Not what the
     machine is told: the machine works that out from the image itself, and
     `medium` above is set from its answer. */
  function mediumOfDisk(disk) {
    var f = disk && disk.files && disk.files[0];
    return f && /\.(t64|tap)$/i.test(String(f.name)) ? "tape" : "disk";
  }

  /* ---- the side panel -----------------------------------------------------
     His addendum: the power rocker with a red light, the two joystick ports,
     and a small keyboard. ONE THING LIT AT A TIME: the keyboard, or the port
     the stick is in; everything else greys.
     🚨 PAINTED FROM THE MACHINE'S REPORTS (cat:inputmode, cat:portmode), never
     from the click — the same rule the play bar's labels have followed since
     2026-09-08: a panel that lights a port the machine did not switch to is a
     panel that lies about why the stick is dead.
     📌 THE PORT SWAP IS REAL, measured 2026-09-16 on the running core: a BASIC
     loop printing PEEK(56320),PEEK(56321) read the stick on port 2 ($DC00 126),
     then after one live switch on port 1 ($DC01 254), then back. */
  var side = { keyboard: null, port: null };

  /* THE KEY POSITIONS — his ruling of 2026-09-17, and what is left of the key
     card. The machine types on a real C64's key POSITIONS (emu.js,
     vice_keyboard_keymap), so a PC key's label is not always what appears.

     🔄 RETITLED 2026-09-17, LATER THE SAME DAY, AND THE DIFFERENCE MATTERS. This
     was written as a card that TOLD THE PLAYER where a character had moved to —
     "`"` is Shift+2". It is not that any more. His second ask the same day ("us
     humans need that visual reference") put a translator in the page: emu.js's
     relayKey() reads the character off the PC key the player actually pressed
     and presses the C64 position below for them. So ten of these seventeen rows
     are no longer true as instructions — `"` is Shift+' on the C64 corner now,
     the same as everywhere else, because the page does the moving.
     ⭐ WHAT THE TABLE IS NOW: the RAW POSITIONAL MATRIX, the machine's own
     wiring, and the single source both emu.js's KEYS table and verify-c64 §J
     read so the two can never drift. Read the third column as "where the C64
     keeps this character", not as "what to press".
     📌 EVERY ROW WAS MEASURED on the running core the same day: each PC key
     pressed with real key events, with and without Shift, and the character read
     back out of the C64's screen memory. Anything not listed sits in the same
     place on both keyboards: letters, digits, space, ! # $ % , . / < > ?
     verify-c64 §J presses every row again, as a player would — it types the
     character and checks the machine stored that character.
     Column-first, three to a column: [C64 character, what the card showed, the key] */
  var KEYCARD = [
    ['"', "⇧2", "Shift+2"], ["(", "⇧8", "Shift+8"], [")", "⇧9", "Shift+9"],
    [":", ";", ";"],        [";", "'", "'"],        ["=", "\\", "\\"],
    ["*", "]", "]"],        ["+", "-", "-"],        ["-", "=", "="],
    ["@", "[", "["],        ["&", "⇧6", "Shift+6"], ["'", "⇧7", "Shift+7"],
    ["[", "⇧;", "Shift+;"], ["]", "⇧'", "Shift+'"], ["←", "`", "`"],
    ["£", "Ins", "Insert"], ["↑", "Del", "Delete"]
  ];
  /* 🗑 2026-09-17 — renderKeycard() WAS HERE. The card came off the panel on his
     word ("remove the C64 keys thing ... for now").
     🚨 THE TABLE ABOVE DID NOT GO WITH IT, and must not. Those 17 rows are not a
     design; they are MEASUREMENTS, each one taken off the running core with real
     key events and read back out of screen memory. verify-c64 §J still presses
     every one of them — it just reads them from `__cat.keycard()` now instead of
     off the DOM. Putting the card back is markup; re-measuring is a morning. */

  function paintSide() {
    var kbd = side.keyboard === true, joy = side.keyboard === false;
    var lit = function (el, on, grey) {
      el.classList.toggle("is-lit", on);
      el.classList.toggle("is-grey", grey);
      el.setAttribute("aria-pressed", String(on));
    };
    lit(sideKeys, kbd, joy);
    lit(sidePort1, joy && side.port === "1", kbd || (joy && side.port !== "1"));
    lit(sidePort2, joy && side.port === "2", kbd || (joy && side.port !== "2"));
    sidePanel.dataset.mode = kbd ? "keyboard" : joy ? "joystick" : "";
    sidePanel.dataset.port = side.port || "";
    sideStatus.textContent = kbd ? "Input: keyboard" : joy ? "Input: joystick in port " + side.port : "";
    paintCable(joy ? (side.port === "1" ? sidePort1 : sidePort2) : null);
  }

  /* 🔄 2026-09-17 — A JOYSTICK, NOT A CABLE. This drew a black cable running
     out of the live port and dropping off the bottom of the window; his call
     replaced it with the stick itself, which says the same thing in one glyph
     and costs no geometry at all. The cable had to be position:fixed and
     re-placed on every resize to escape its ancestors' clipping — all of that
     is gone with it.
     ⭐ STILL PAINTED FROM THE MACHINE'S REPORT, never from the click: his ruling
     froze the port labels black, so the stick is the only thing left that says
     which port is live, and it must not be able to disagree with the machine. */
  function paintCable(port) {
    [sidePort1, sidePort2].forEach(function (p) {
      p.classList.toggle("has-stick", p === port);
    });
  }

  /* 🆕 2026-09-17 — THE CARTRIDGE PORT.
     ⚠️ A cartridge is NOT a disk, and this is the one place the corner could
     easily lie about the machine. A real cart auto-starts at power-on: there is
     no LOAD, no drive access, no READY. to type RUN at — and you must switch the
     machine OFF to insert one. So the port fills ONLY for a genuine .CRT, and
     the drive lamps and the auto-RUN below must stay out of its way.
     📌 Empty is the normal state today: the library holds 112 titles and not one
     of them is a .CRT, so nothing has ever been in this slot. That is honest
     rather than broken — library.js already accepts the extension. */
  function isCartridge(disk) {
    if (!disk || disk.runner !== "emulator") return false;
    var f = (disk.files && disk.files[0] && disk.files[0].url) || "";
    return /\.crt$/i.test(String(f));
  }
  function paintCart(disk) {
    if (cartShell.hidden === undefined) return;
    var on = isCartridge(disk);
    cartShell.hidden = !on;
    cartName.textContent = on ? disk.displayName.toUpperCase() : "";
    cartStatus.textContent = on ? "Cartridge in: " + disk.displayName : "Cartridge port empty";
    /* the fast loader and a .CRT game cannot both be in the one port */
    paintFast();
  }

  /* 🆕 2026-09-17 — THE DRIVE'S TWO LAMPS, and what each one is allowed to say.
     🚨 Green is POWER and is steady; red is ACTIVITY and is SOLID for the length
     of an access; a BLINKING red is the 1541's DOS error signal and belongs to a
     disk that actually failed. The hub used to blink red on every successful
     insert, which to anyone who has used the machine reads as "that disk died".
     🚫 Never call this with "loading" for a cartridge — see paintCart. */
  /* 🔄 2026-09-17, his ask — THE DECK'S OWN LAMP IS THE SAME DRIVE'S LAMP. The
     little light beside "Drive 8" now follows exactly what the drive bay does,
     because there is only one drive: solid red for the length of an access, dark
     when idle, and the 1 Hz DOS error blink only on a real failure. It used to
     light on an insert and nothing else, so a LOAD — the longest the drive is
     ever busy — left it dark. */
  function paintDrive(state) {
    if (!driveBay) return;
    driveBay.classList.toggle("is-loading", state === "loading");
    driveBay.classList.toggle("is-failed", state === "failed");
    led.classList.toggle("is-loading", state === "loading");
    led.classList.toggle("is-failed", state === "failed");
  }

  /* 🔄 2026-09-17 — FAST LOAD IS A CARTRIDGE NOW, so "on" means SEATED IN THE
     PORT and "off" means standing below it. The position is the state; there is
     no label making a claim the machine has not confirmed.
     🚨 ONE EXPANSION PORT, ONE CARTRIDGE — the real constraint, not a drawing
     limitation. A .CRT game in the slot means the fast loader physically cannot
     be in it, so the button says so rather than overlapping two carts. */
  function paintFast() {
    var taken = !cartShell.hidden;
    btnFast.classList.toggle("is-seated", fastLoad && !taken);
    btnFast.setAttribute("aria-pressed", String(fastLoad));
    btnFast.disabled = taken;
    btnFast.title = taken
      ? "The cartridge port is taken by " + (cartName.textContent || "a game") + " — a C64 has one expansion port"
      : (fastLoad ? "Fast-load cartridge in. Click to take it out." : "A fast-load cartridge: click to plug it in, and the drive loads warped.");
  }
  function paintPower(on) {
    sidePower.setAttribute("aria-pressed", String(on));
    sidePower.title = IN_SHELL
      ? "Power off: close the Arcade and go back to the Arcade room"
      : (on ? "Switch the C64 off" : "Switch the C64 on");
  }

  /* THE ROCKER. Inside Fang Rock it is Power Off, his ruling of 2026-09-14:
     it closes the Arcade window, back to the Arcade room — the switch goes
     down and the light goes out first, so the click is seen to land. Outside
     Fang Rock a tab cannot close itself, so it switches the C64 itself off
     (the screen goes dark, the machine and its drive empty) and on again (a
     fresh boot). */
  function pressPower() {
    /* 🚫 NOT blocked while the hub is busy. It is a power switch, and inside
       Fang Rock it is the way out: a load or a reset in flight must never be
       what stops it. Switching off rejects whatever was waiting on the machine,
       and each of those clears `busy` as it settles. */
    if (IN_SHELL) {
      paintPower(false);
      setTimeout(leaveArcade, 320);
      return;
    }
    if (!machineOff) {
      machineOff = true;
      /* what was waiting is cancelled QUIETLY: the player switched it off, and
         "could not type …" landing on the note after "power off." reads as a
         fault (measured — it overwrote the note in verify-cat §L) */
      waiters.splice(0).forEach(function (w) {
        var err = new Error("the c64 is switched off");
        err.byPowerOff = true;
        clearTimeout(w.timer);
        w.reject(err);
      });
      machineFrame.src = "about:blank";
      if (inserted && inserted.runner === "emulator") setDrive(null);
      medium = null;
      paintLoad();
      renderSwap(null);
      side.keyboard = side.port = null;
      paintSide();
      paintPower(false);
      write("power off.", "dim");
    } else {
      machineOff = false;
      machineFailed = null;
      machineFrame.src = "emulator/index.html?machine=1&title=CAT";
      paintPower(true);
      write("power on.", "dim");
      focusMachine();
    }
    renderBox();
  }

  function setupMachineDeck() {
    /* the play bar's numbered disk buttons are not used here: the sides have
       their own control beside Insert Disk (renderSides) */
    /* his addendum: Input, Port and Power Off become the side panel. The play
       bar's Input/Port stay where they are, for a cabinet's game (they only
       ever show for an emulator, and none runs in that overlay here). */
    btnPower.hidden = true;
    sidePanel.hidden = false;
    /* his F-key addendum: [F2] at the keyboard, [F9] at the ports, [F12] at
       Reset — each rendered from its constant, like the play bar's hints.
       🔄 2026-09-17: Reset moved F10 -> F12, away from the port key. */
    document.getElementById("c64-keys-hint").textContent = HOTKEY_INPUT;
    document.getElementById("c64-port-hint").textContent = HOTKEY_PORT;
    document.getElementById("btn-reset-hint").textContent = HOTKEY_EXIT;
    sidePort1.title = "Joystick in port 1 (" + HOTKEY_PORT + " swaps ports)";
    sidePort2.title = "Joystick in port 2 (" + HOTKEY_PORT + " swaps ports)";
    sideKeys.title = "Type on the keyboard (" + HOTKEY_INPUT + ")";
    /* 🆕 2026-09-17 — the monitor bezel, and ONLY here. See the .is-monitor note
       in cat.css: the ordinary hub's screen is the 1970s PET-era terminal. */
    screenShell.classList.add("is-monitor");
    driveBay.classList.add("is-powered");
    paintPower(true);
    paintSide();
    sidePower.addEventListener("click", pressPower);
    sideKeys.addEventListener("click", function () { postMachine({ type: "cat:keyboard" }); focusMachine(); });
    [sidePort1, sidePort2].forEach(function (p) {
      p.addEventListener("click", function () { postMachine({ type: "cat:joystick", port: p.dataset.port }); focusMachine(); });
    });
    /* his addendum: Insert Disk goes where the disks are, and stands out there.
       🔄 2026-09-17, his ask: EJECT COMES WITH IT. The two are one decision —
       what is in the drive — and having them at opposite ends of the deck made
       you cross the hub to undo the thing you just did.
       🚨 INSERTED AS SIBLINGS, NOT WRAPPED IN A DIV. verify-c64 §A asserts
       btnInsert.parentNode.id === "crates"; a tidy .disk-buttons wrapper would
       fail it, and the fix would be to weaken the assertion, which is backwards. */
    btnInsert.classList.add("btn--insert");
    var cratesEl = document.getElementById("crates");
    cratesEl.insertBefore(btnInsert, sideSwap);   /* the side swap sits right under it */
    cratesEl.insertBefore(btnEject, sideSwap);    /* and Eject right beside it */
    /* 🚨 EJECT MUST BE IN THIS SELECTOR TOO. The #deck guard below does not reach
       it any more, and a button that keeps focus after a click sends the player's
       next keystroke into the button instead of into BASIC — measured in §G, and
       §F's hand-typed LOAD"$",8 is what catches it. Moving a button out of #deck
       without moving it into this list is the regression. */
    cratesEl.addEventListener("mousedown", function (e) {
      if (machineStarted && e.target.closest && e.target.closest("#btn-insert, #btn-eject, #side-swap button")) e.preventDefault();
    });
    btnListing.hidden = false;
    btnRun.hidden = false;
    btnReset.hidden = false;
    /* 🆕 2026-09-17 — the fast loader, off until asked for. It PAINTS FROM THE
       MACHINE'S ANSWER, never from the click: changeSettingOption can land in
       the settings object and reach nothing at all if the core's option table
       failed to build, and a button that says "On" while the core is still slow
       is worse than no button — the same contract the Input and Port controls
       keep. */
    btnFast.hidden = false;
    btnFast.addEventListener("click", function () {
      if (busy) return;
      machineCall({ type: "cat:warp", on: !fastLoad }, ["cat:warped", "cat:warpfailed"], 8000)
        .then(function (m) {
          if (m.type !== "cat:warped") throw new Error(String(m.reason || "no reason given"));
          fastLoad = !!m.on;
          paintFast();
          write(fastLoad ? "fast load cartridge in: the drive loads warped."
                         : "fast load cartridge out: the drive runs at its own speed.", "dim");
        })
        .catch(function (err) { write("could not change fast load: " + err.message, "warn"); })
        .then(function () { focusMachine(); });
    });
    paintFast();
    btnList.textContent = "Load \"$\",8";
    btnReset.title = "Reset the C64, back to READY. The disk stays in the drive (" + HOTKEY_EXIT + ")";
    deckNote.hidden = false;
    paintLoad();

    /* 🚨 A DECK BUTTON CLICKED WITH THE MOUSE MUST NOT TAKE THE KEYBOARD.
       Measured in verify-c64 §G: after clicking Load, the button kept focus, and
       the player's next Space or Enter pressed Load AGAIN — a second
       LOAD"*",8,1 typed into the machine in the middle of what they were
       typing. Refusing focus on mousedown keeps the keyboard in the C64 the whole
       time; the click still happens. ⭐ Tab + Enter/Space still work for anyone
       driving the deck from the keyboard. On the deck, so the disk-side buttons
       made later are covered too. */
    document.getElementById("deck").addEventListener("mousedown", function (e) {
      if (machineStarted && e.target.closest && e.target.closest("button")) e.preventDefault();
    });
  }

  /* =======================================================================
     THE READER — the six books from the shelf above the corner C64's bench.

     🆕 2026-09-17, his ruling of 2026-09-16 clarified the same week: the SHELF
     IN THE ROOM is the trigger, and the reader DISPLAYS HERE. His four asks
     were: on top always, reshape-able, page turns or scrolling, and a close
     control — plus the sentence the whole thing is really for: *"Player should
     be able to read the book while the C64 emulator is still active/visible, so
     they can read a page and type it into the emulator."*

     ⭐⭐ THAT SENTENCE IS THE DESIGN, AND FOCUS IS THE WHOLE DIFFICULTY. The
     player reads a line, then types it into the machine. EmulatorJS takes keys
     only while its frame has focus. A mouse click on "Next" that moves focus to
     this panel means the next thing they type goes nowhere — or worse, turns a
     page. So:
       1. every control REFUSES FOCUS on mousedown (the same fix the deck
          buttons needed — see setupMachineDeck, measured in verify-c64 §G), and
       2. every click ENDS IN focusMachine(), which posts cat:focus rather than
          trusting frame.focus() — focusing the iframe alone lands keys on its
          body, which the core does not listen to.
     🚫 AND THE READER TAKES NO KEYS OF ITS OWN. No arrow keys for page turns,
     no Escape to close, however natural they would feel: every one of those is
     a key the player might be typing into BASIC. Page turns are the mouse's
     job here. The ONE exception is the ordinary Tab/Enter path, which only
     reaches these buttons when someone has deliberately tabbed to them.
     📌 The listing block is the deliberate hole in rule 1: mousedown is allowed
     through inside a <pre> so the text can still be selected and copied.

     ⚠️ FULLSCREEN is the one place "on top always" cannot be honoured: only
     children of the fullscreen element paint over it, and that element lives in
     another document. The reader closes and says so — the brief predicted this
     and allowed it ("or say it closes in fullscreen"). A panel that is silently
     invisible would be the worse answer.

     Nothing here knows the title of a single book; books.js is the shelf.
     ===================================================================== */
  var readerEl    = document.getElementById("reader");
  var readerBar   = document.getElementById("reader-bar");
  var readerTitle = document.getElementById("reader-title");
  var readerSpines= document.getElementById("reader-spines");
  var readerBody  = document.getElementById("reader-body");
  var readerPage  = document.getElementById("reader-page");
  var readerFoot  = document.getElementById("reader-foot");
  var readerWhere = document.getElementById("reader-where");
  var readerPrev  = document.getElementById("reader-prev");
  var readerNext  = document.getElementById("reader-next");
  var readerShelfBtn = document.getElementById("reader-shelf");
  var readerCloseBtn = document.getElementById("reader-close");
  var readerResize   = document.getElementById("reader-resize");

  var readerBook = null;    /* the open book object, or null for the shelf */
  var readerPg   = 0;
  var readerPlaced = false; /* has it been given a position yet */

  function bookById(id) {
    var found = null;
    BOOKS.forEach(function (b) { if (!found && b.id === id) found = b; });
    return found;
  }

  /* ---- drawing ---------------------------------------------------------- */
  function renderSpines() {
    readerSpines.textContent = "";
    if (!BOOKS.length) {
      var none = document.createElement("p");
      none.id = "reader-empty";
      none.textContent = "the shelf is empty.";
      readerSpines.appendChild(none);
      return;
    }
    BOOKS.forEach(function (b) {
      var s = document.createElement("button");
      s.type = "button";
      s.className = "reader-spine";
      s.dataset.book = b.id;
      s.style.background = b.tint;
      s.style.color = b.ink;
      /* the spine's OWN lines, so what stands on this shelf reads exactly as
         what stands on the room's shelf (books.js warns about the pairing) */
      (b.spine || [b.title]).forEach(function (l) {
        var i = document.createElement("span");
        i.className = "reader-spine__line";
        i.textContent = l;
        s.appendChild(i);
      });
      s.title = b.title + (b.imprint ? " — " + b.imprint : "");
      s.setAttribute("aria-label", b.title);
      readerSpines.appendChild(s);
    });
  }

  function renderPage() {
    readerPage.textContent = "";
    var page = readerBook.pages[readerPg];
    var h = document.createElement("h3");
    h.textContent = page.title;
    readerPage.appendChild(h);
    (page.blocks || []).forEach(function (blk) {
      if (blk.code) {
        var pre = document.createElement("pre");
        /* joined here rather than stored joined, so a listing is a list of
           LINES in books.js — which is what the rig types, one at a time */
        pre.textContent = blk.code.join("\n");
        readerPage.appendChild(pre);
      } else if (blk.p) {
        var p = document.createElement("p");
        p.textContent = blk.p;
        readerPage.appendChild(p);
      }
    });
  }

  function renderReader() {
    var onShelf = !readerBook;
    readerSpines.hidden = !onShelf;
    readerPage.hidden = onShelf;
    readerFoot.hidden = onShelf;
    readerShelfBtn.hidden = onShelf;
    if (onShelf) {
      readerTitle.textContent = "The shelf";
      renderSpines();
      return;
    }
    readerTitle.textContent = readerBook.title;
    renderPage();
    readerWhere.textContent = "page " + (readerPg + 1) + " of " + readerBook.pages.length;
    readerPrev.disabled = readerPg === 0;
    readerNext.disabled = readerPg >= readerBook.pages.length - 1;
    /* a page turn starts at the top of the new page, not wherever the last
       one was scrolled to — the listing is usually what they came for */
    readerBody.scrollTop = 0;
  }

  /* ---- where it sits ---------------------------------------------------- */
  /* 🚨 CLAMPED TO THE WINDOW on every move, resize and window resize. A panel
     dragged off the edge cannot be dragged back, and there is no taskbar to
     recover it from — it would simply be gone for the rest of the session. */
  function placeReader(left, top) {
    var w = readerEl.offsetWidth, h = readerEl.offsetHeight;
    var maxL = Math.max(0, window.innerWidth - w);
    var maxT = Math.max(0, window.innerHeight - h);
    readerEl.style.left = Math.min(Math.max(0, left), maxL) + "px";
    readerEl.style.top  = Math.min(Math.max(0, top), maxT) + "px";
  }
  function clampReader() {
    if (readerEl.hidden) return;
    placeReader(readerEl.offsetLeft, readerEl.offsetTop);
  }
  window.addEventListener("resize", clampReader);

  /* ---- opening and closing ---------------------------------------------- */
  function openReader(id) {
    readerBook = id ? bookById(id) : null;
    readerPg = 0;
    readerEl.hidden = false;
    if (!readerPlaced) {
      readerPlaced = true;
      /* centred on first open, and never again: after that it is where the
         player last put it, which is the point of a reshape-able panel */
      placeReader((window.innerWidth - readerEl.offsetWidth) / 2,
                  (window.innerHeight - readerEl.offsetHeight) / 2);
    } else {
      clampReader();
    }
    renderReader();
    focusMachine();
  }
  function closeReader() {
    if (readerEl.hidden) return;
    readerEl.hidden = true;
    readerBook = null;
    focusMachine();
  }
  function openBook(id) {
    var b = bookById(id);
    if (!b) return false;
    readerBook = b;
    readerPg = 0;
    if (readerEl.hidden) { openReader(id); return true; }
    renderReader();
    return true;
  }
  function turnPage(delta) {
    if (!readerBook) return;
    var n = readerBook.pages.length;
    readerPg = Math.min(Math.max(0, readerPg + delta), n - 1);
    renderReader();
  }

  /* ---- the controls ----------------------------------------------------- */
  /* Rule 1: refuse focus, with the <pre> hole so a listing stays selectable. */
  readerEl.addEventListener("mousedown", function (e) {
    if (e.target.closest && e.target.closest("#reader-page pre")) return;
    e.preventDefault();
  });

  /* Rule 2: every click ends in the machine. One handler for the whole panel,
     so a control added later cannot forget to hand the keyboard back. */
  readerEl.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("button");
    if (!btn) return;
    if (btn === readerCloseBtn)      closeReader();
    else if (btn === readerShelfBtn) { readerBook = null; renderReader(); }
    else if (btn === readerPrev)     turnPage(-1);
    else if (btn === readerNext)     turnPage(1);
    else if (btn.dataset.book)       openBook(btn.dataset.book);
    focusMachine();
  });

  /* Dragging and resizing share one shape: remember where the handle went down
     and what the panel was, then track deltas until the button comes up.

     🚨 MOUSE EVENTS, NOT POINTER EVENTS, and that is a measurement rather than a
     preference. The first cut used pointerdown/pointermove with setPointerCapture.
     It works in Chrome — verify-cat drives it there and it resizes correctly —
     but under the Fang Rock shell's Electron the resize did not move at all
     (verify-c64 §L, 2026-09-17: 560x560 in, 560x560 out) while everything else
     on the panel behaved. ⚠️ The shell IS Electron, so that is the engine this
     actually ships to, and a control that only reshapes in a browser is a
     control Andrew cannot use in the room. Mouse events work in both.
     ⭐ The move and up listeners go on the DOCUMENT, not the handle, which is
     what pointer capture was buying: the drag survives the cursor leaving the
     panel, so a fast drag cannot strand it half-moved. */
  function grip(handle, onMove) {
    handle.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      if (e.target.closest && e.target.closest("button")) return;
      var x0 = e.clientX, y0 = e.clientY;
      var l0 = readerEl.offsetLeft, t0 = readerEl.offsetTop;
      var w0 = readerEl.offsetWidth, h0 = readerEl.offsetHeight;
      readerEl.classList.add("is-dragging");
      function move(ev) { onMove(ev.clientX - x0, ev.clientY - y0, l0, t0, w0, h0); }
      function up() {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        readerEl.classList.remove("is-dragging");
        focusMachine();
      }
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });
  }
  grip(readerBar, function (dx, dy, l0, t0) { placeReader(l0 + dx, t0 + dy); });
  grip(readerResize, function (dx, dy, l0, t0, w0, h0) {
    /* the minimums are in the stylesheet as well; these are what stops a drag
       from collapsing the panel to nothing before CSS gets a say */
    var w = Math.max(300, Math.min(w0 + dx, window.innerWidth - l0));
    var h = Math.max(220, Math.min(h0 + dy, window.innerHeight - t0));
    readerEl.style.width = w + "px";
    readerEl.style.height = h + "px";
  });

  /* ⚠️ Fullscreen: see the section note. Closed, and said out loud. */
  document.addEventListener("fullscreenchange", function () {
    if (document.fullscreenElement && !readerEl.hidden) {
      closeReader();
      write("the book closes while the screen is full.", "dim");
    }
  });

  /* =======================================================================
     DISK SWAPPING — ruling 4, built now rather than deferred, because Andrew
     hand-picks the library and multi-disk titles are an ordinary near-term
     case rather than a someday one.

     The control lives in the PLAY BAR, next to Exit — the hub's own chrome,
     not the emulator's. The emulator page owns the actual swap; this owns
     saying which side is in and letting the player pick another.
     ===================================================================== */
  function renderSwap(disk) {
    /* on the real C64 the sides have their own control beside Insert Disk */
    if (MACHINE && !running) { swapBar.hidden = true; renderSides(disk); return; }
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
        if (MACHINE && disk === inserted && !running) { postMachine({ type: "cat:swap", index: i }); focusMachine(); }
        else {
          frame.contentWindow.postMessage({ type: "cat:swap", index: i }, "*");
          /* the keyboard goes back to the game, as it does on the machine: a
             game that asked for the other side is waiting for a key next, and a
             focused button would take that key (Space would swap again).
             🚨 BOTH steps: frame.focus() alone puts keys on the frame's body,
             which the core ignores; cat:focus moves them onto the core. */
          frame.focus();
          frame.contentWindow.postMessage({ type: "cat:focus" }, "*");
        }
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
    if (!m || typeof m !== "object") return;

    /* 🆕 2026-09-17 — A BOOK OPENED FROM THE ROOM WITHOUT A RELOAD.
       ⚠️ THE HALF THAT IS NOT BUILT YET. A `?cart=book…` token works today, but
       it arrives on a NAVIGATION, and a navigation reboots the C64 — which is
       exactly what his use case cannot afford, because the player wants the book
       beside the machine they are already typing into. This is the door for the
       shell to deliver a spine click to an ALREADY-OPEN arcade window instead.
       🚫 Shell work is not a PLC session's to do (see the Morbius note); this
       side is ready, testable, and costs nothing until something calls it.
       🚨 GATED ON `IN_SHELL`, and it only ever opens a book that books.js
       already lists — so the worst a stray postMessage can do is open a page of
       the hub's own writing, and outside Fang Rock it cannot do even that. */
    if (m.type === "cat:book") {
      if (!IN_SHELL) return;
      if (m.id === null || m.id === undefined) { openReader(null); return; }
      if (!openBook(String(m.id))) write("shelf: no such book", "dim");
      return;
    }

    /* 🆕 2026-09-16 — two frames can talk now: the play overlay's cartridge,
       and the real C64 on the screen. Told apart by WHICH WINDOW sent it, not by
       what it says. `cur` is the disk the message is about. */
    var fromMachine = MACHINE && machineStarted && e.source === machineFrame.contentWindow;
    if (fromMachine) {
      if (machineMessage(m)) return;
    } else if (!running) {
      return;
    }
    var cur = fromMachine ? inserted : running;

    if (m.type === "cat:exit") { exitGame(); return; }

    /* INPUT MODE. 🚨 The cartridge is the only thing that knows which mode is
       really live - EmulatorJS owns the setting - so the hub PAINTS this and
       never sets it. The button asks for a flip and waits to be told what
       happened; it does not toggle its own label optimistically, because a
       label that disagrees with the machine is worse than no label at all. */
    if (m.type === "cat:inputmode" && fromMachine) {
      side.keyboard = !!m.keyboard;
      paintSide();
      return;
    }
    if (m.type === "cat:inputmode") {
      btnInput.hidden = false;
      inputLabel.textContent = m.keyboard ? "Input: Keyboard" : "Input: Joystick";
      inputHint.textContent = HOTKEY_INPUT;
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
    if (m.type === "cat:portmode" && fromMachine) {
      side.port = (String(m.port) === "1") ? "1" : "2";   /* clamped, as below */
      paintSide();
      return;
    }
    if (m.type === "cat:portmode") {
      var p = (String(m.port) === "1") ? "1" : "2";
      btnPort.hidden = false;
      portLabel.textContent = "Port: " + p;
      portHint.textContent = HOTKEY_PORT;
      return;
    }

    if (m.type === "cat:portfailed") {
      write("cannot switch joystick port on this build.", "warn");
      write("(" + String(m.reason || "no settings interface") + ")", "dim");
      return;
    }

    if (m.type === "cat:swapped") {
      if (!cur || !cur.files) return;
      cur.side = Number(m.index) || 0;
      renderSwap(cur);
      var f = cur.files[cur.side];
      write("disk " + (cur.side + 1) + " in drive: " + (f ? f.name : ""), "dim");
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
      /* the art folder is read only once the disk scan says this origin can list
         a directory; a disk already picked by then gets its picture as it lands */
      return loadArt(res).then(function (n) {
        if (n && selected) renderDetail(selected);
        return res;
      });
    });
  }

  /* ---- input ------------------------------------------------------------ */
  function focusTerminal() {
    /* on the real C64 the terminal IS the machine */
    if (MACHINE) { focusMachine(); return; }
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
       The only thing the hub keeps is the way out. 🔄 2026-09-16: F10, which
       was Shift/Ctrl+Escape — see HOTKEY_EXIT. */
    if (!play.hidden) {
      if (e.key === HOTKEY_EXIT) { e.preventDefault(); exitGame(); }
      return;
    }

    /* 🆕 2026-09-16 — THE REAL C64 OWNS THE KEYBOARD. The hub only sees a key
       when focus is on the hub's side (a crate was clicked); its own hotkeys
       act here exactly as they do inside the frame, and anything else is passed
       to the machine rather than lost. */
    if (MACHINE && machineStarted) {
      if (e.key === HOTKEY_EXIT)  { e.preventDefault(); exitGame(); return; }
      /* 🔄 2026-09-17, his call: F2 SELECTS THE KEYBOARD, it does not toggle.
         Toggling meant F2 could take you AWAY from the keyboard, which is the
         opposite of what someone reaching for it wants — they are reaching for
         it in order to type. Pressing it when the keyboard is already live is
         now a no-op instead of a trap. */
      if (e.key === HOTKEY_INPUT) { e.preventDefault(); postMachine({ type: "cat:keyboard" }); focusMachine(); return; }
      if (e.key === HOTKEY_PORT)  { e.preventDefault(); postMachine({ type: "cat:port" }); focusMachine(); return; }
    }
    if (busy) return;

    /* Ctrl+Shift+B — the Developer Mode gate (Laws 0.15/0.16). This is the
       ONLY thing that puts the Empty Cartridge in the box. */
    if (e.ctrlKey && e.shiftKey && (e.key === "B" || e.key === "b")) {
      e.preventDefault();
      /* the Empty Cartridge is a cartridge, and this mode has none — saying
         "empty cartridge available" here would be a line with nothing behind it */
      if (CRACKED_ONLY) {
        blank();
        write("cracked disks only - developer mode is not available here.", "warn");
        ready();
        return;
      }
      devUnlocked = !devUnlocked;
      renderBox();
      if (!devUnlocked && selected && selected.dev) select(null);
      blank();
      write(devUnlocked ? "developer mode on - empty cartridge available."
                        : "developer mode off.", "warn");
      ready();
      return;
    }

    if (MACHINE && machineStarted) {
      /* a record's own arrow keys already ran, and a focused button's Enter,
         Space or Tab is the button's, not the machine's */
      if (e.defaultPrevented || e.key === "Tab") return;
      if (e.target && e.target.tagName === "BUTTON" && (e.key === "Enter" || e.key === " ")) return;
      e.preventDefault();
      forwarded[e.code] = true;
      focusMachine();
      forwardKey("keydown", e);
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

  /* ...and its release follows it, if the hub still has focus to see one.
     ⚠️ Once focus has moved, the release lands in the frame instead, and
     emu.js hands it to the core there — either way the key comes back up. */
  document.addEventListener("keyup", function (e) {
    if (!MACHINE || !forwarded[e.code]) return;
    delete forwarded[e.code];
    forwardKey("keyup", e);
  });

  /* 🚨 Buttons submit COMMAND STRINGS, they do not call the loader. This is
     what keeps the two input surfaces honest — a button cannot drift from its
     typed equivalent, because it *is* its typed equivalent. On the real C64
     the string is typed into the machine instead (submitCommand). */
  Array.prototype.forEach.call(document.querySelectorAll("[data-cmd]"), function (b) {
    b.addEventListener("click", function () {
      if (busy) return;
      /* 🆕 2026-09-17, his ask: THE LOAD BUTTON RUNS WHAT IT LOADED.
         🚨 THE BUTTON STILL ONLY TYPES THINGS A PLAYER COULD TYPE — it now types
         two commands instead of one, which is exactly what a person does. That
         keeps the single-execution-path rule this file is built on intact; what
         it does NOT keep is parity with the hand-typed line, and verify-c64 §D
         exists to compare those two. The carve-out is Load, and only Load.
         🚫 data-cmd is NOT touched. Two rig assertions pin it to the exact string
         LOAD"*",8,1, and the button must go on saying what it types. */
      if (b === btnLoad && MACHINE && machineStarted) { loadThenRun(b.dataset.cmd); return; }
      submitCommand(b.dataset.cmd);
    });
  });
  btnInsert.addEventListener("click", function () { if (!busy) insertSelected(); });
  btnEject.addEventListener("click", function () { if (!busy) ejectDisk(); });
  btnExit.addEventListener("click", exitGame);
  btnReset.addEventListener("click", exitGame);
  /* Power Off, on the disk screen inside Fang Rock only: a browser tab cannot
     close itself, so outside the shell the button would do nothing. */
  btnPower.hidden = !IN_SHELL;
  btnPower.addEventListener("click", leaveArcade);

  /* Ask the cartridge to FLIP; it answers with what actually took. 🚨 Focus
     goes straight back to the frame - a mode switch that leaves the caret on
     the hub's own button hands the next keystroke to the wrong document, which
     is precisely the confusion this control exists to remove. */
  btnInput.addEventListener("click", function () {
    if (MACHINE && !running) { postMachine({ type: "cat:input" }); focusMachine(); return; }
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
    if (MACHINE && !running) { postMachine({ type: "cat:port" }); focusMachine(); return; }
    if (!running) return;
    try { frame.contentWindow.postMessage({ type: "cat:port" }, "*"); } catch (e) {}
    frame.focus();
  });

  /* =======================================================================
     🆕 2026-09-13 — THE LINK, `?cart=<token>`. How the Nerva Beacon corridor's
     Arcade room opens this page. His locked design:
       - a CABINET (Pitstop, Asteroid Command, Aquanaut) goes straight into its
         own game — no hub menu step. The crack intro still plays first (his
         call, 2026-09-13). 🔄 2026-09-14, having played it: Exit Game goes back
         to the Arcade room, not the hub — see `exitGame`.
       - the corner C64 opens the hub CRACKED DISKS ONLY (the roster filter near
         the top of this file does that part, and resolves a cabinet's disk
         before it; nothing further happens here).
     🚨 FANG ROCK KNOWS NONE OF THIS. It passes an opaque token and the meaning
     lives here only — so adding a cabinet is a disks.js entry and a corridor
     row, never a shell change. The corridor's browser fallback is the Pages hub
     with the same query, so nothing here depends on being inside Fang Rock.

     ⭐ The cabinet launch is the END of the ordinary load, not a second one: the
     disk is selected and inserted the ordinary way, then `introThenLaunch()` —
     the same function the load theatre finishes with. Only the menu and the
     theatre in front of it are skipped, because the curtain (index.html) keeps
     them off the glass.

     🚨 A TOKEN THAT MATCHES NOTHING OPENS NOTHING, and says so, on the ordinary
     hub. Substituting another game looks exactly like success from the corridor.
     `?cart=blank` gets the same answer as a name that was never a disk (`LINKED`
     is resolved against the dev-gated roster), so it reveals nothing either.
     Anything that is not `^[a-z]+$` is not echoed: a hub that prints whatever a
     URL says is a hub that can be made to say anything (same reasoning as the
     port clamp above).
     📌 Acted on at boot, synchronously, so the intro is on screen before the
     first paint and there is no window in which a player could start something
     else first. The ids live in disks.js; renaming one breaks that cabinet.
     ===================================================================== */
  var linkState = "none";   /* for the rig: none | launched | cracked | not found */

  function followLink(token) {
    if (!LINKED) liftCurtain();   /* the curtain stays up for a launch and nothing else */
    if (token === null) return "none";

    /* 🆕 2026-09-17 — a spine clicked on the room's shelf. Checked before the
       cracked token because a book token is its own thing; it has already
       brought cracked mode with it (see "THE LINK" above).
       🚫 The token is NOT echoed back, unlike a cartridge's: there is nothing
       useful to say beyond "no such book", and a hub that prints whatever the
       URL says is a hub that can be made to say anything. */
    if (BOOK_LINK) {
      if (BOOK_LINK === "none") {
        blank();
        write("shelf: no such book", "dim");
        write("?file not found  error", "err");
        ready();
        return "not found";
      }
      openReader(BOOK_LINK === "shelf" ? null : BOOK_LINK);
      return "book";
    }

    if (token === "cracked") return "cracked";
    var disk = LINKED;
    if (!disk) {
      blank();
      write("cartridge link: " + (CART_ID.test(token) ? token : "no readable name"), "dim");
      write("?file not found  error", "err");
      ready();
      return "not found";
    }
    blank();
    select(disk);
    insertSelected();
    busy = true;
    line.classList.add("idle");
    introThenLaunch(disk).then(function () {
      busy = false;
      line.classList.remove("idle");
    });
    return "launched";
  }

  function liftCurtain() { document.documentElement.classList.remove("cat-link"); }

  /* ---- boot -------------------------------------------------------------
     🚫 No literal Commodore banner text. Tommodore/CAT branding instead — the
     look is the tribute, the trademarked words are not reproduced. */
  function boot() {
    renderBox();
    setDrive(null);
    if (MACHINE) setupMachineDeck();

    write("**** tommodore cat  basic ****", "hi");
    write("64k ram system   38911 basic bytes free", "dim");
    blank();
    write("powerline challenge  arcade terminal", "dim");
    if (CRACKED_ONLY) write("cracked disks only.", "dim");
    blank();
    ready();

    linkState = followLink(LINK);

    /* 🆕 2026-09-16 — the real C64 comes on with the hub. ⚠️ NOT behind a
       cabinet's game: that launch covers the hub with the play overlay, and a
       whole C64 would otherwise boot and run unseen behind it. It comes on when
       that game exits to the hub instead (exitToHub). */
    if (MACHINE && !LINKED) startMachine();

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
    /* the same entry point as the buttons: on the real C64 this TYPES */
    execute: submitCommand,
    /* 🆕 2026-09-16 — the real C64, as the hub sees it */
    machine: function () {
      return { on: MACHINE, started: machineStarted, failed: machineFailed, medium: medium,
               busy: busy, src: machineStarted ? machineFrame.getAttribute("src") : null };
    },
    note: function () { return deckNote.hidden ? null : deckNote.textContent; },
    /* 🆕 2026-09-17 — the measured key map, which OUTLIVED the card that showed
       it. verify-c64 §J presses every one of these on the real core; it used to
       read them off the DOM, and reads them from here now. 🚫 Do not let this go
       when the card goes: re-measuring 17 key positions is not markup. */
    keycard: function () {
      return KEYCARD.map(function (k) { return { c64: k[0], shows: k[1], key: k[2] }; });
    },
    /* the corner's new hardware, as the panel is actually painting it */
    corner: function () {
      var lit = function (el) { return el.classList.contains("is-lit"); };
      return {
        monitor: screenShell.classList.contains("is-monitor"),
        keycard: !!document.getElementById("c64-keycard"),
        cartridge: cartShell.hidden ? null : cartName.textContent,
        cartPort: !cartPort.hidden,
        drivePort: !!document.getElementById("c64-iec"),
        /* 🔄 2026-09-17 — the drawn cable became a joystick glyph on the live
           port. The keys stay named `cable`/`cablePort` so the rigs that already
           read them keep working; what they report is now the stick. */
        cable: sidePort1.classList.contains("has-stick") || sidePort2.classList.contains("has-stick"),
        cablePort: sidePort1.classList.contains("has-stick") ? "1"
                 : sidePort2.classList.contains("has-stick") ? "2" : null,
        lamps: { power: driveBay.classList.contains("is-powered"),
                 loading: driveBay.classList.contains("is-loading"),
                 failed: driveBay.classList.contains("is-failed") },
        ejectBy: btnEject.parentNode ? btnEject.parentNode.id : null,
        insertBy: btnInsert.parentNode ? btnInsert.parentNode.id : null,
        /* fastLoad is what the MACHINE confirmed; fastSeated is where the
           cartridge is actually drawn. They must agree — if they ever do not,
           the panel is telling the player something the core did not say. */
        fastLoad: fastLoad,
        fastSeated: btnFast.classList.contains("is-seated"),
        fastBlocked: btnFast.disabled,
        keys: { keyboard: HOTKEY_INPUT, port: HOTKEY_PORT, reset: HOTKEY_EXIT }
      };
    },
    reset: machineReset,
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
    exit: exitGame,
    link: function () { return linkState; },

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
    /* 🆕 2026-09-17 — the reader. `listings()` is the one the rig leans on: it
       hands back the page's code as LINES, which is what gets typed into the
       real C64 one at a time — the use case his ruling is actually about. */
    books: function () { return BOOKS.map(function (b) { return b.id; }); },
    openBook: function (id) { return id === null ? (openReader(null), true) : openBook(id); },
    closeBook: closeReader,
    turnPage: turnPage,
    book: function () {
      if (readerEl.hidden) return null;
      var r = readerEl.getBoundingClientRect();
      return {
        shelf: !readerBook,
        id: readerBook ? readerBook.id : null,
        title: readerTitle.textContent,
        page: readerBook ? readerPg : -1,
        pages: readerBook ? readerBook.pages.length : 0,
        spines: Array.prototype.map.call(readerSpines.children, function (c) { return c.dataset.book || null; }),
        rect: { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) },
        atStart: readerPrev.disabled, atEnd: readerNext.disabled
      };
    },
    bookText: function () { return readerEl.hidden ? null : readerPage.textContent; },
    listings: function () {
      return Array.prototype.map.call(readerPage.querySelectorAll("pre"), function (pre) {
        return pre.textContent.split("\n");
      });
    },

    text: function () { return out.textContent; },
    lines: function () {
      return Array.prototype.map.call(out.children, function (c) { return c.textContent; });
    }
  };
})();

/* ===========================================================================
   library.js — THE RUNTIME DISK LIBRARY.

   Reads whatever is sitting in `Game/disks/` when the hub loads. There is no
   manifest, no generated index checked into the repo, and NO COUNT WRITTEN
   DOWN ANYWHERE. Andrew curates that folder by hand — three disks or eighty —
   and the box shows what is there. (His ruling: "Scanner/Disk Box UI reads
   whatever's in the folder at runtime — could be 3 disks or 80, no hardcoded
   count anywhere.")

   ⭐⭐ AN EMPTY LIBRARY IS THE NORMAL STATE, NOT A FALLBACK. A fresh clone has
   no disks, because `Game/disks/*` is gitignored — this repo is public and
   publishes to Pages. So "no disk library on this machine" is the DEFAULT
   path through this file, written first rather than bolted on at the end.
   🚫 Do not turn it into an error. Nothing is wrong when it happens.

   ===========================================================================
   HOW ENUMERATION ACTUALLY WORKS, AND WHY IT IS ONE REQUEST

   A static page cannot list a directory. So this asks the SERVER for the
   directory and adapts to whatever comes back:

     JSON  -> the Fang Rock shell's `protocol.handle()` returns a real listing
              for a directory request. (See arcade-origin.patch.md, filed to
              the shell track — that patch is also what makes WASM work here
              at all, because file:// blocks fetch outright.)
     HTML  -> `python -m http.server` returns its autoindex; the <a href>s are
              the filenames. This is the `Start Dev Server.bat` path.
     fail  -> file:// and GitHub Pages both land here. Empty library. Normal.

   ⭐ ONE request, sniffed two ways, rather than a chain of probes that each
   cost a round trip and a console error. 🚫 Do not add a HEAD probe in front
   of it "to check first" — a 404 on the directory IS the check.

   🚨 A REQUEST THAT FAILED IS NOT THE SAME AS A FOLDER THAT IS EMPTY, and the
   two must never print the same line. A folder that answered and held nothing
   means "put some disks in". A request that never resolved means "this origin
   cannot list directories" — expected on file://, a real fault on a dev
   server. Collapsing them would hide the second behind the first forever.
   ========================================================================= */
(function () {
  "use strict";

  var DIR = "../disks/";

  /* Formats the vice_x64sc core accepts. 🚫 Do not add `.zip` — the core can
     read one, but the grouping below reads SIDE MARKERS OFF THE FILENAME, and
     a zip hides them. A two-disk game in a zip would arrive silently as a
     one-disk game that cannot swap. Unpack it into the folder instead. */
  var EXT = /\.(d64|d71|d81|g64|nib|t64|tap|prg|p00|crt)$/i;

  /* Files that legitimately live in the folder but are not disks. */
  var SKIP = /^(README\.md|_favourites\.txt|\.gitignore|desktop\.ini|Thumbs\.db)$/i;

  var FAVOURITES = "_favourites.txt";

  /* -----------------------------------------------------------------------
     SIDE MARKERS. Three spellings, because all three are ordinary in a real
     collection and the stick Andrew is picking from uses the first:
       "Airborne Ranger - d1"      -> d1 / d2 ...
       "Maniac Mansion (Disk 1)"   -> also [Disk 1], bare "Disk 1"
       "Zak McKracken - Side A"    -> A / B ...
     Returns {title, side}, or null when the name carries no marker at all.
     ⚠️ Anchored at the END on purpose. A title with "Disk" inside it ("Disk
     Rider") must not be read as a side marker — and would be, if this matched
     anywhere in the string.
     --------------------------------------------------------------------- */
  var SIDE_PATTERNS = [
    { re: /^(.*?)[\s._-]*[-–]\s*d(\d{1,2})$/i,
      num: function (m) { return parseInt(m[2], 10); } },
    { re: /^(.*?)[\s._-]*[([]?\s*disk\s*(\d{1,2})\s*[)\]]?$/i,
      num: function (m) { return parseInt(m[2], 10); } },
    { re: /^(.*?)[\s._-]*[([]?\s*side\s*([a-h])\s*[)\]]?$/i,
      num: function (m) { return m[2].toUpperCase().charCodeAt(0) - 64; } }
  ];

  function splitSide(base) {
    for (var i = 0; i < SIDE_PATTERNS.length; i++) {
      var m = base.match(SIDE_PATTERNS[i].re);
      if (m && m[1] && m[1].trim()) {
        return { title: m[1].trim(), side: SIDE_PATTERNS[i].num(m) };
      }
    }
    return null;
  }

  function baseName(file) { return String(file).replace(EXT, ""); }

  /* -----------------------------------------------------------------------
     C64 FILENAMES ARE CAPPED AT 16 CHARACTERS, and the cap is not cosmetic:
     this is the string a player types at the LOAD prompt, and disks.js is
     emphatic that filenames are what the player types. A real 1541 directory
     truncated long names in exactly this way, so the cap is the authentic
     behaviour rather than a compromise forced on us.

     🚨 COLLISIONS ARE REAL once names are truncated — "The Great Giana Sist"
     and "The Great Giana Brot" both cut to the same sixteen characters. The
     de-duplicator is what stops two disks answering to one typed name. Without
     it the resolver would silently load whichever happened to be scanned
     first, which is the silent-wrong-destination failure this hub exists to
     refuse one layer up.
     --------------------------------------------------------------------- */
  function c64Name(title) {
    var s = String(title).toUpperCase()
      .replace(/[^A-Z0-9 .,:+\-/]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return s.slice(0, 16).trim() || "DISK";
  }

  function dedupe(names, want) {
    if (!names[want]) { names[want] = 1; return want; }
    var n = names[want];
    var out;
    do {
      n++;
      var suffix = String(n);
      out = want.slice(0, 16 - suffix.length).trim() + suffix;
    } while (names[out]);
    names[want] = n;
    names[out] = 1;
    return out;
  }

  /* -----------------------------------------------------------------------
     PARSING WHAT THE SERVER SENT BACK.
     --------------------------------------------------------------------- */
  function parseJsonIndex(body) {
    var data = JSON.parse(body);
    /* Three accepted shapes, so the shell patch can pick any of them without
       this file having to change in lockstep with it. */
    var list = Array.isArray(data) ? data
             : Array.isArray(data.files) ? data.files
             : Array.isArray(data.entries) ? data.entries
             : null;
    if (!list) return null;
    return list
      .map(function (e) { return typeof e === "string" ? e : (e && (e.name || e.file)); })
      .filter(Boolean);
  }

  function parseHtmlIndex(body) {
    /* 🚨 Parsed with DOMParser, never by assigning into a live element. An
       autoindex is server-controlled text; innerHTML would run what is in it.
       DOMParser builds an inert tree that executes nothing.
       ⚠️ Read the href ATTRIBUTE, not el.href. The property resolves against
       this document's base and hands back an absolute URL, which then fails
       the SKIP and EXT tests below — both of which expect a bare filename. */
    var doc = new DOMParser().parseFromString(body, "text/html");
    var out = [];
    Array.prototype.forEach.call(doc.querySelectorAll("a[href]"), function (a) {
      var href = a.getAttribute("href");
      if (!href || href.charAt(0) === "/" || href.indexOf("://") > -1) return;
      if (href === "../" || href.charAt(href.length - 1) === "/") return;
      try { href = decodeURIComponent(href); } catch (e) { /* leave as-is */ }
      out.push(href);
    });
    return out;
  }

  /* -----------------------------------------------------------------------
     BUILDING DISK OBJECTS. The shape is disks.js's shape exactly — id,
     displayName, runner, entries — because the box, the resolver and the
     directory listing must not be able to tell a library disk from a
     cartridge. His ruling: "One mixed box, all equal."
     --------------------------------------------------------------------- */
  function build(files) {
    var groups = {};
    var order = [];

    files.forEach(function (file) {
      if (SKIP.test(file) || !EXT.test(file)) return;
      var base = baseName(file);
      var split = splitSide(base);
      var title = split ? split.title : base;
      var key = title.toLowerCase();
      if (!groups[key]) { groups[key] = { title: title, files: [] }; order.push(key); }
      groups[key].files.push({
        name: file,
        url: DIR + encodeURIComponent(file),
        side: split ? split.side : 1
      });
    });

    var names = {};
    return order.map(function (key) {
      var g = groups[key];
      g.files.sort(function (a, b) { return a.side - b.side || a.name.localeCompare(b.name); });

      var filename = dedupe(names, c64Name(g.title));
      var multi = g.files.length > 1;

      return {
        id: "lib-" + key.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        displayName: g.title,
        runner: "emulator",
        library: true,
        files: g.files,
        blurb: multi
          ? g.files.length + " disks. Swap sides from the play bar while it runs."
          : "",
        entries: [{ filename: filename, label: g.title.toLowerCase(), kind: "game" }]
      };
    });
  }

  /* -----------------------------------------------------------------------
     FAVOURITES. Optional `_favourites.txt`, one filename per line. Naming ANY
     ONE SIDE of a multi-disk title lifts the whole group, so nobody has to
     remember whether they wrote down d1 or d2.
     🚨 A missing file is the ordinary case and must not log, throw or show.
     That fetch is expected to 404 on most machines.
     --------------------------------------------------------------------- */
  function applyFavourites(disks, body) {
    var wanted = String(body || "").split(/\r?\n/)
      .map(function (l) { return l.trim(); })
      .filter(function (l) { return l && l.charAt(0) !== "#"; })
      .map(function (l) { return l.toLowerCase(); });

    var rank = {};
    if (wanted.length) {
      disks.forEach(function (d) {
        d.files.forEach(function (f) {
          var i = wanted.indexOf(f.name.toLowerCase());
          if (i > -1 && (rank[d.id] === undefined || i < rank[d.id])) rank[d.id] = i;
        });
      });
    }

    /* 🚨 STAMP THE RANK ONTO THE DISK, do not just return a sorted array. The
       hub merges these with the PLC cartridges and sorts the combined list
       ONE more time — a sort order carried only by array position is
       destroyed by that merge, silently, and favourites would quietly stop
       working with nothing to show for it. The flag survives the merge. */
    disks.forEach(function (d) {
      d.favourite = rank[d.id] !== undefined;
      d.favRank = rank[d.id];
    });

    return disks.slice().sort(function (a, b) {
      var ra = rank[a.id], rb = rank[b.id];
      if (ra !== undefined && rb !== undefined) return ra - rb;
      if (ra !== undefined) return -1;
      if (rb !== undefined) return 1;
      return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
    });
  }

  function text(url) {
    return fetch(encodeURI(url)).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    });
  }

  /* -----------------------------------------------------------------------
     THE ONE ENTRY POINT. Never rejects — a library that cannot be read is a
     RESULT, not an exception, and every caller has to render it either way.
     --------------------------------------------------------------------- */
  function scan() {
    return text(DIR).then(function (body) {
      var files = null;
      try { files = parseJsonIndex(body); } catch (e) { /* not JSON; try HTML */ }
      if (!files) files = parseHtmlIndex(body);

      files = files || [];
      var disks = build(files);
      if (!disks.length) {
        return { state: "empty", disks: [], detail: "the folder is there and holds no disks" };
      }

      /* ⭐ ASK THE LISTING WE ALREADY HAVE whether the favourites file is
         there, rather than requesting it and treating a 404 as "no". Most
         machines will not have one, and a blind fetch put a red 404 in the
         console on EVERY boot — for a file whose absence is the normal case.
         🚨 That matters beyond tidiness: an error census that always carries
         two expected failures is one nobody reads, and the next real error
         lands in a list people have already learned to ignore. */
      var hasFav = files.some(function (f) { return f.toLowerCase() === FAVOURITES; });
      if (!hasFav) {
        return { state: "present", disks: applyFavourites(disks, ""), detail: null };
      }
      return text(DIR + FAVOURITES)
        .catch(function () { return ""; })
        .then(function (fav) {
          return { state: "present", disks: applyFavourites(disks, fav), detail: null };
        });
    }).catch(function (err) {
      /* 🚫 NOT an error path in the console sense. file:// cannot list a
         directory and never will; that is the shipped state of this hub
         outside the shell, and it is what a fresh clone does too. */
      return { state: "unlistable", disks: [], detail: String((err && err.message) || err) };
    });
  }

  window.CAT_LIBRARY = {
    scan: scan,
    dir: DIR,
    /* Pure helpers, exposed so the rig can test grouping, truncation and
       ordering against fixtures — without a server, and without one real disk
       image existing anywhere. 🚫 Nothing here touches the DOM or network. */
    _parse: {
      splitSide: splitSide,
      c64Name: c64Name,
      build: build,
      applyFavourites: applyFavourites,
      parseHtmlIndex: parseHtmlIndex,
      parseJsonIndex: parseJsonIndex
    }
  };
})();

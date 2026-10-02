/* ===========================================================================
   library.js — THE RUNTIME DISK LIBRARY.

   Reads whatever is sitting in `Game/C64/roms/` when the hub loads. There is no
   manifest, no generated index checked into the repo, and NO COUNT WRITTEN
   DOWN ANYWHERE. Andrew curates that folder by hand — three disks or eighty —
   and the box shows what is there. (His ruling: "Scanner/Disk Box UI reads
   whatever's in the folder at runtime — could be 3 disks or 80, no hardcoded
   count anywhere.")

   ⭐⭐ AN EMPTY LIBRARY IS THE NORMAL STATE, NOT A FALLBACK. A fresh clone has
   no disks, because `Game/C64/roms/*` is gitignored — this repo is public and
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

  var DIR = "roms/";

  /* Formats the vice_x64sc core accepts. 🚫 Do not add `.zip` — the core can
     read one, but the grouping below reads SIDE MARKERS OFF THE FILENAME, and
     a zip hides them. A two-disk game in a zip would arrive silently as a
     one-disk game that cannot swap. Unpack it into the folder instead. */
  var EXT = /\.(d64|d71|d81|g64|nib|t64|tap|prg|p00|crt)$/i;

  /* Files that legitimately live in the folder but are not disks. */
  var SKIP = /^(README\.md|_favourites\.txt|_library(\.[\w-]+)?\.json|\.gitignore|desktop\.ini|Thumbs\.db)$/i;

  var FAVOURITES = "_favourites.txt";

  /* 🆕 2026-10-01 — THE LIBRARY MANIFEST (Chat's handoff; Andrew's rulings).
     `_library.json` beside the disks, hand-curated, and GIT-IGNORED with them:
     its entries name real files on commercial disks, so it lives where nothing
     reaches the public repo (roms/* in .gitignore, checked with check-ignore).
     Every `_library*.json` in the listing is read and merged in name order, so
     a rig can lay `_library.zz-rig.json` beside his file and take it away again
     without ever touching his.
     ⭐ WHAT IT CAN SAY, per title (the key is the title as grouped below):
       entries  [{label, file} | {label, text}] — what Load offers. `file` is the
                real C64 name typed after LOAD"; `text` is shown by the hub.
                One entry loads straight away; two or more ask first.
       port     1 or 2 — the joystick port the title starts on (default 2).
       images   [filenames] — groups images the side markers cannot.
     🚫 Nothing here is guessed at runtime. A title it does not name keeps the
     old behaviour exactly: LOAD"*",8,1, the first file on the disk.
     🚨 A broken file is reported and ignored, never half-applied. */
  var MANIFEST = /^_library(\.[\w-]+)?\.json$/i;
  var MAX_FILE = 16;   /* a C64 filename, and so what is typed */

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
  /* 🆕 2026-10-01 — each marker also gives the PLAIN LABEL the corner's swap
     controls show (Chat's handoff, Andrew's rulings): the number or letter the
     file itself carries, so "- d0" says "Disk 0" rather than being renumbered
     into something the disk's own prompts would not match. */
  var SIDE_PATTERNS = [
    { re: /^(.*?)[\s._-]*[-–]\s*d(\d{1,2})$/i,
      num: function (m) { return parseInt(m[2], 10); },
      label: function (m) { return "Disk " + parseInt(m[2], 10); } },
    { re: /^(.*?)[\s._-]*[([]?\s*disk\s*(\d{1,2})\s*[)\]]?$/i,
      num: function (m) { return parseInt(m[2], 10); },
      label: function (m) { return "Disk " + parseInt(m[2], 10); } },
    { re: /^(.*?)[\s._-]*[([]?\s*side\s*([a-h])\s*[)\]]?$/i,
      num: function (m) { return m[2].toUpperCase().charCodeAt(0) - 64; },
      label: function (m) { return "Side " + m[2].toUpperCase(); } }
  ];

  function splitSide(base) {
    for (var i = 0; i < SIDE_PATTERNS.length; i++) {
      var m = base.match(SIDE_PATTERNS[i].re);
      if (m && m[1] && m[1].trim()) {
        return { title: m[1].trim(), side: SIDE_PATTERNS[i].num(m), label: SIDE_PATTERNS[i].label(m) };
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
  function build(files, manifest) {
    var groups = {};
    var order = [];

    /* the manifest's hand-made groups, filename -> [title, position] */
    var manual = {};
    Object.keys(manifest || {}).forEach(function (title) {
      var imgs = manifest[title] && manifest[title].images;
      if (!Array.isArray(imgs)) return;
      imgs.forEach(function (f, i) {
        if (typeof f === "string") manual[f.toLowerCase()] = [title.trim(), i + 1];
      });
    });

    files.forEach(function (file) {
      if (SKIP.test(file) || !EXT.test(file)) return;
      var base = baseName(file);
      var hand = manual[file.toLowerCase()];
      var split = hand ? null : splitSide(base);
      var title = hand ? hand[0] : split ? split.title : base;
      var key = title.trim().toLowerCase();
      if (!groups[key]) { groups[key] = { title: title, files: [] }; order.push(key); }
      groups[key].files.push({
        name: file,
        url: DIR + encodeURIComponent(file),
        side: hand ? hand[1] : split ? split.side : 1,
        label: split ? split.label : null
      });
    });

    var names = {};
    return order.map(function (key) {
      var g = groups[key];
      g.files.sort(function (a, b) { return a.side - b.side || a.name.localeCompare(b.name); });
      /* a file with no marker of its own (a hand-made group) is named by place */
      g.files.forEach(function (f, i) { if (!f.label) f.label = "Disk " + (i + 1); });

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
     THE MANIFEST, APPLIED. Reads only what it can check: a label, and either a
     C64 filename that fits the 16-character cap and holds no quote (it is about
     to be typed between two of them) or a piece of text. A title whose entry
     fails any check gets NO choices at all, and the problem is returned so the
     hub can say it — half a menu would be a guess dressed as a ruling.
     --------------------------------------------------------------------- */
  function cleanEntry(e) {
    if (!e || typeof e !== "object") return null;
    var label = typeof e.label === "string" ? e.label.trim() : "";
    if (!label || label.length > 40) return null;
    if (typeof e.file === "string") {
      var f = e.file;
      if (!f || f.length > MAX_FILE || /["\r\n]/.test(f)) return null;
      return { label: label, file: f };
    }
    if (typeof e.text === "string" && e.text.trim() && e.text.length <= 4000) {
      return { label: label, text: e.text };
    }
    return null;
  }

  function applyManifest(disks, manifest) {
    var byTitle = {};
    var problems = [];
    Object.keys(manifest || {}).forEach(function (k) {
      if (k.charAt(0) !== "_") byTitle[k.trim().toLowerCase()] = manifest[k];
    });
    disks.forEach(function (d) {
      var m = byTitle[d.displayName.trim().toLowerCase()];
      if (!m || typeof m !== "object") return;
      if (Array.isArray(m.entries) && m.entries.length) {
        var out = m.entries.map(cleanEntry);
        if (out.indexOf(null) > -1) problems.push(d.displayName);
        else d.choices = out;
      }
      /* the same field, and the same meaning, the overlay's emulator already
         reads (cat.js sourceFor: `disk.port === 1` starts it on port 1) */
      if (m.port === 1 || m.port === "1") d.port = 1;
    });
    return problems;
  }

  /* several manifest files, merged in name order: a later file's title wins */
  function mergeManifests(bodies) {
    var out = {}, bad = [];
    bodies.forEach(function (b) {
      var data;
      try { data = JSON.parse(b.body); } catch (e) { bad.push(b.name); return; }
      if (!data || typeof data !== "object" || Array.isArray(data)) { bad.push(b.name); return; }
      Object.keys(data).forEach(function (k) { out[k] = data[k]; });
    });
    return { manifest: out, bad: bad };
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
      /* the manifest, found the way the favourites are: from the listing we
         already have, never by a blind fetch that 404s on most machines */
      var mnames = files.filter(function (f) { return MANIFEST.test(f); }).sort();
      return Promise.all(mnames.map(function (n) {
        return text(DIR + n).then(function (body) { return { name: n, body: body }; },
                                  function () { return { name: n, body: "" }; });
      })).then(function (bodies) {
        return finish(files, mergeManifests(bodies));
      });
    }).catch(function (err) {
      /* 🚫 NOT an error path in the console sense. file:// cannot list a
         directory and never will; that is the shipped state of this hub
         outside the shell, and it is what a fresh clone does too. */
      return { state: "unlistable", disks: [], detail: String((err && err.message) || err) };
    });
  }

  function finish(files, merged) {
      var disks = build(files, merged.manifest);
      var problems = applyManifest(disks, merged.manifest);
      /* told to the hub, which says it once: a manifest that does not parse, or
         a title whose entries were refused, is a fault in HIS file to fix */
      var manifestNote = merged.bad.length || problems.length
        ? { unreadable: merged.bad, refused: problems } : null;
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
        return { state: "present", disks: applyFavourites(disks, ""), detail: null, manifest: manifestNote };
      }
      return text(DIR + FAVOURITES)
        .catch(function () { return ""; })
        .then(function (fav) {
          return { state: "present", disks: applyFavourites(disks, fav), detail: null, manifest: manifestNote };
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
      applyManifest: applyManifest,
      mergeManifests: mergeManifests,
      applyFavourites: applyFavourites,
      parseHtmlIndex: parseHtmlIndex,
      parseJsonIndex: parseJsonIndex
    }
  };
})();

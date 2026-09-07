/* ===========================================================================
   THE DISK MANIFEST — the CAT hub's single source of truth for what exists.

   ⭐ "Adding a cartridge means adding entries to the manifest, not touching
   Hub logic" (core spec, Available Cartridges). Nothing in cat.js knows the
   name of any game; it only knows the shape below. If you are editing cat.js
   to add a game, stop — the game goes here.

   VOCABULARY (core spec, Vocabulary Boundary): "disk" is presentation-layer
   flavour only. The underlying object is still a CARTRIDGE, exactly as Laws
   Section 0 defines it. The glossary term and all core logic keep that name.

   FIELDS
     id          stable slug, used for art and for nothing the player sees.
     displayName the real, already-displayed name. Never invent a shorthand.
     runner      which system loads this disk's game:
                   "plc"      an official cartridge — loads its own page.
                   "emulator" a cracked disk — see the note at the bottom.
     launch      the cartridge's real entry point, relative to this folder.
     status      optional. Absent means playable (the default). "test" shows a
                 badge and is still playable. "coming-soon" is filtered out of
                 the disk box entirely, before render — the box never shows a
                 disk it cannot load, so Command Resolution never needs a
                 status check.
     dev         optional. Developer-only: excluded from the player-facing box
                 and revealed only by the Ctrl+Shift+B gate (Laws 0.15/0.16).
     entries     what is ON the disk. Exactly one kind:"game". Optionally one
                 kind:"help", displayed as text and NEVER passed to a runner.

   🚨 FILENAMES ARE CAPPED AT 16 CHARACTERS and are what the player types.
   The game entries all fit as their real names — ASTEROID COMMAND (16),
   THE AQUANAUT (12), PITSTOP (7), BLANK CASSETTE (14). ⚠️ A help entry does
   NOT inherit that: appending " HELP" blows the cap on two of the three
   (ASTEROID COMMAND HELP is 21, THE AQUANAUT HELP is 17). Check each help
   filename against the cap individually — the rule is per-cartridge, not
   "only Asteroid is special".

   📌 No cartridge ships player-facing help content yet: Pitstop has no Help
   Files folder, Aquanaut's holds one empty subfolder, and Asteroid's is an
   authoring workspace (.docx + generate_manual.js) rather than in-product
   output. A disk shipping with only its game entry is the correct current
   state modelled honestly, not a gap being deferred.
   ========================================================================= */
window.CAT_DISKS = [
  {
    id: "asteroid",
    displayName: "Asteroid Command",
    runner: "plc",
    launch: "../cartridges/Asteroid Command/files/index.html",
    blurb:
      "Defend Niagara's three paramedic sectors from asteroid strikes. Master " +
      "PowerLine commands under pressure using the Command Tower.",
    entries: [
      { filename: "ASTEROID COMMAND", label: "asteroid command", kind: "game" }
    ]
  },
  {
    id: "aquanaut",
    displayName: "The Aquanaut",
    runner: "plc",
    /* 🚨 THIS DISK IS THE FIX FOR A REAL BUG, not a new addition. The Aquanaut
       is fully built — its own 11k-line script.js and design docs — but was
       absent from core/submenu.js's runtime registry, so it could not be
       launched from the old hub at all. The disk box cannot offer three player
       disks if one of the three is unreachable underneath. */
    launch: "../cartridges/The Aquanaut/files/index.html",
    blurb:
      "Below the black. Work the dive, read the water, and keep your air " +
      "honest — a slower cartridge that punishes rushing.",
    entries: [
      { filename: "THE AQUANAUT", label: "the aquanaut", kind: "game" }
    ]
  },
  {
    id: "pitstop",
    displayName: "Pitstop",
    runner: "plc",
    status: "test",
    launch: "../cartridges/Pitstop/files/index.html",
    blurb:
      "Top-down Niagara Region race: post your unit base-to-base with real " +
      "PowerLine commands — AP to ENP to BSE. Fast, accurate typing is your " +
      "throttle. (Early test build.)",
    entries: [
      { filename: "PITSTOP", label: "pitstop", kind: "game" }
    ]
  },
  {
    id: "blank",
    displayName: "Blank Cassette",
    runner: "plc",
    status: "test",
    /* 🚨 DEVELOPER-ONLY, AND THIS FLAG IS THE ONLY THING KEEPING IT THAT WAY.
       Laws 0.15/0.16 specify the Empty Cartridge as Developer Mode content
       behind Ctrl+Shift+B. No such gate existed anywhere in the hub — it sat
       in the ordinary player-facing row, fully playable.

       ⚠️ It ALSO looked unreachable for an unrelated reason, and that is a
       coincidence rather than a safeguard: core/submenu.js sent it to
       `cartridges/blank/index.html`, which does not exist (the real file is
       `Game/blank/index.html`). Anyone fixing that 404 as routine cleanup,
       without knowing about this exclusion, would have quietly handed every
       player a Developer-Mode cartridge. 🚫 Do not rely on a broken path to
       gate anything. The `dev` flag below is the gate; the path here is
       correct on purpose. */
    dev: true,
    launch: "../blank/index.html",
    blurb:
      "Empty cartridge. Core mechanics against the Blank dataset — a test " +
      "harness, not a game. Developer Mode only.",
    entries: [
      { filename: "BLANK CASSETTE", label: "blank cassette", kind: "game" }
    ]
  }
];

/* ===========================================================================
   🔄 `runner:"emulator"` IS LIVE AS OF 2026-09-07, AND NO ENTRY FOR ONE
   BELONGS IN THIS FILE.

   This note used to say no disk used that runner, that cracked disks needed
   ROM images and a core that did not exist here, and that cat.js answered
   honestly instead of pretending. All three have been overtaken:

     - The core is EmulatorJS + the vice_x64sc libretro core, self-hosted in
       `emulator/data/`. Gitignored — this repo is PUBLIC and publishes to
       Pages. `emulator/README.md` has the one command that installs it.
     - Disk images live in `../disks/`, also gitignored, for the same reason.
       ⭐ AN EMPTY LIBRARY IS THE NORMAL STATE, not a fault: a fresh clone has
       none, and the hub says so as information.
     - `library.js` SCANS that folder at runtime and builds emulator disks in
       exactly the shape above. There is no manifest and no count written down
       anywhere — his ruling. So a C64 disk never appears in this file.

   ⭐ WHAT THIS FILE IS NOW: the CARTRIDGE roster only. A hand-written entry
   here is a PLC cartridge; anything with `runner:"emulator"` arrived from the
   scanner. 🚫 Do not hand-add an emulator entry to "test something" — it
   would be the one disk in the box that a real folder scan cannot explain,
   and the next person to compare the two would be chasing a ghost.

   🚫 The original warning still stands and is not softened by any of this:
   never route a disk to the wrong runner. The box renders both kinds
   identically, on purpose ("one mixed box, all equal"), which is exactly why
   the `runner` field — not the look of the row — has to stay the only thing
   that decides where a disk loads.
   ========================================================================= */

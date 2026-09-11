/* ===========================================================================
   GAME INFO — the screenshot and the synopsis the detail panel shows.

   A classic script assigning `window.CAT_GAMEINFO`, loaded by a plain <script>
   exactly like `disks.js` and `library.js`. 🚫 NOT a .json: a JSON file needs a
   fetch, and this hub runs from a `file://` origin inside the Fang Rock shell
   where fetch is blocked outright. A `.js` that assigns a global works from
   file:// and needs no server, which is the whole reason the other two are
   shaped this way too.

   ⭐⭐ THE FIELD NAMES ARE NOT CHOSEN HERE — they are BORROWED, deliberately.
   `Game/core/submenu.js` (the PowerLine Training Console, the cassette front
   end at `Game/index.html`) has described a game as
     { id, displayName, status, screenshot, synopsis, cassetteImage }
   since long before this file existed. Two front ends in one repo describing a
   game two different ways is a rename waiting to happen, so this uses
   `screenshot`, `synopsis` and `status` verbatim.
   📌 If you add a field here, check whether submenu.js already has a name for
   it before inventing one.

   ===========================================================================
   🚨 WHAT IS IN HERE IS ONLY WHAT ALREADY EXISTED. NOTHING IS INVENTED.

   His ruling, 2026-09-10: *"Placeholders now, content later."* So:
     · the four PLC cartridges carry the synopses **he already wrote**, lifted
       verbatim from `Game/core/submenu.js` rather than re-worded;
     · Asteroid Command carries the one real screenshot that exists in this
       repo;
     · the 55 discovered C64 disks carry NOTHING, and the panel says so in
       words.

   🚫 DO NOT GENERATE A SYNOPSIS FROM A FILENAME. "Beach-Head" is a real game
   with a real description, and a sentence assembled from its filename would
   read exactly like one that had been researched. A disk with no entry here is
   an honest gap; a disk with an invented entry is a lie that looks finished.
   ⭐ A missing entry is a SUPPORTED state — `info()` returns null and the panel
   renders its "not written yet" copy. That is the same shape as `library.js`'s
   empty folder: information, not a fault.
   ========================================================================= */
(function () {
  "use strict";

  /* Paths are relative to THIS FOLDER (`Game/cat/`), not to `Game/`. The
     console's own manifest is one level up, so its paths lose a `../` — that
     is the only edit made to the values copied from it. */
  var INFO = {
    /* ---- the PLC cartridges: his own words, his own art ------------------ */
    asteroid: {
      screenshot: "../cartridges/Asteroid Command/files/assets/Menus/title_screen.png",
      synopsis:
        "Defend Niagara's three paramedic sectors from asteroid strikes. Master " +
        "PowerLine commands under pressure as you protect North, South, and East " +
        "zones using the Command Tower. Incorrect commands and sector losses " +
        "damage the tower. If the tower falls early, you'll watch the remaining " +
        "sectors get destroyed one by one."
    },
    aquanaut: {
      screenshot: null,
      synopsis:
        "Below the black. Work the dive, read the water, and keep your air " +
        "honest — a slower cartridge that punishes rushing."
    },
    pitstop: {
      screenshot: null,
      synopsis:
        "Top-down Niagara Region race: post your unit base-to-base with real " +
        "PowerLine commands — AP → ENP → BSE. Fast, accurate typing is your " +
        "throttle. Race the laps, work the pit lane, finish first. (Early test build.)"
    },
    /* dev-only; it never reaches the player-facing box, but the panel is also
       what a developer sees behind Ctrl+Shift+B, so it gets its line too. */
    blank: {
      screenshot: null,
      synopsis:
        "Blank cassette used to test core game mechanics with the Empty/Blank dataset."
    }

    /* ---- the 55 discovered C64 disks ------------------------------------
       Deliberately absent. Add entries keyed by the id `library.js` generates
       ("lib-" + slug, e.g. "lib-beach-head") as art and text become available.
       🚫 Do not bulk-generate this section. */
  };

  window.CAT_GAMEINFO = {
    /* null rather than {} for a miss — the panel has to be able to tell "no
       entry" from "an entry with empty fields", because the second one would
       mean somebody wrote a blank synopsis on purpose. */
    info: function (id) {
      return Object.prototype.hasOwnProperty.call(INFO, id) ? INFO[id] : null;
    },
    /* exposed for the rig, so coverage can be asserted without scraping the
       DOM, and so "how many games have art" is answerable in one call. */
    ids: function () { return Object.keys(INFO); }
  };
})();

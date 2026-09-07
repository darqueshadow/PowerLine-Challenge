/* ===========================================================================
   crackintro.js — THE NOAH COLLECTIVE CRACK INTRO.

   The splash that plays before a disk boots. Governed by
   `cat-computer-cracked-disk-easter-egg-spec.md`, in this folder — read that
   first; this file is the implementation, the spec is the ruling.

   ⭐ HIS RULING, AND IT IS THE OPPOSITE OF WHAT THE NAME SUGGESTS: this is
   "not flag-gated, not a one-time hidden Easter egg". It plays before EVERY
   disk load, automatically, every time. The file is still called an Easter
   egg because that is the name the citation in disks.js used; the behaviour
   is a standard part of the load sequence.

   🚫 NO REAL SCENE GROUPS AND NO COMMODORE BRANDING. Every name on screen is
   a Nerva Beacon mascot. The 1980s cracking scene is the FORM being paid
   tribute; the actual group names and trademarks are not reproduced, the same
   rule the Tommodore CAT machine name follows.

   ⚠️ THE GREETZ ARE MASCOT NAMES ONLY — no species, no descriptions, nothing
   about what any of them look like. `doors-and-tools.md` in the NB repo cost
   an afternoon to the assumption that a mascot's name tells you what it is
   ("who:'dex' had been drawing a red panda"), and the standing rule there is
   to check the art before believing the variable. A scroller needs the name
   and nothing else, so it asserts nothing it would have to check.
   ========================================================================= */
(function () {
  "use strict";

  /* -----------------------------------------------------------------------
     THE ONE SWITCH. His ruling is EVERY disk, so this is "all".
     Set to "library" to restrict the intro to C64 disks and let PLC
     cartridges boot straight into the load theatre. That is the only other
     value; there is deliberately no per-disk override, because a splash that
     appears for some disks and not others is exactly the flag-gating the
     ruling refused.
     --------------------------------------------------------------------- */
  var APPLIES_TO = "all";

  var GROUP = "NOAH COLLECTIVE";

  /* The greetz. Mascots of the Nerva Beacon estate, in the scene's own
     idiom. 📌 Order is fixed rather than shuffled — a scroller that reads
     differently every time reads as a bug before it reads as variety. */
  var GREETZ = ["PENN", "DEX", "FERGIE", "TRACE", "RUE", "BEV"];

  /* 🚨 THE GREETZ COME FIRST, AND THAT IS A FIX, NOT A PREFERENCE.
     They used to sit after a "PRESENTING ANOTHER 100% WORKING RELEASE"
     lead-in. Every assertion passed — the scroller element genuinely
     contained all six names — and a SCREENSHOT showed the player never sees
     one of them: at the old speed, with a full-viewport lead-in, the text had
     not travelled far enough to bring "PENN" on screen before the intro ended.
     The names were in the DOM and off the glass for the whole 2600 ms.
     ⭐ Naming the mascots is the entire point of the ruling, so they lead.
     🚫 Do not push anything in front of them, and if you change HOLD_MS or the
     scroll duration in cat.css, look at it rather than re-reading the string. */
  var SCROLL =
    "GREETINGS GO OUT TO " + GREETZ.join("  ") + " ... " +
    "ANOTHER 100% WORKING RELEASE ... " +
    "ALL TRAINERS INSTALLED AND VERIFIED ... " +
    "REMEMBER - THE DRIVE LIGHT NEVER LIES ... " +
    "PRESS ANY KEY TO SKIP ... " +
    "NOW WRAPPING TO THE START ...   ";

  var REDUCED = window.matchMedia &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Long enough to read the group name and catch the scroller starting;
     short enough that it does not become the thing between you and the game.
     Reduced motion collapses it to a beat rather than removing it — the spec
     wants the splash SEEN, and skipping it entirely would change what the
     machine does rather than how much it moves. */
  var HOLD_MS = REDUCED ? 700 : 2600;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* The title wobbles per character. Built as spans with a staggered delay,
     which is the cheapest honest way to get the sine-wave letters without a
     canvas or a frame loop. */
  function wobble(word) {
    var wrap = el("div", "crack-title");
    wrap.setAttribute("aria-label", word);
    word.split("").forEach(function (ch, i) {
      var s = el("span", null, ch === " " ? " " : ch);
      s.style.animationDelay = (i * 70) + "ms";
      s.setAttribute("aria-hidden", "true");
      wrap.appendChild(s);
    });
    return wrap;
  }

  /* -----------------------------------------------------------------------
     play() — resolves when the intro is finished or skipped. NEVER rejects,
     and never leaves the overlay on screen: the caller boots a game the
     moment this settles, so a stuck promise here is a hub that stops loading
     anything at all.
     --------------------------------------------------------------------- */
  function play(disk) {
    if (APPLIES_TO === "library" && !(disk && disk.library)) {
      return Promise.resolve("skipped-by-scope");
    }

    return new Promise(function (resolve) {
      var root = el("div", "crack");
      root.id = "crack";
      /* 🚨 aria-hidden, and focus is never moved here. This is decoration in
         front of a load that is already announced on the terminal by the load
         theatre. A screen reader that stopped to read a scroller would be
         held up by an animation for no information. */
      root.setAttribute("aria-hidden", "true");

      var bars = el("div", "crack-bars");
      var stage = el("div", "crack-stage");

      stage.appendChild(wobble(GROUP));
      stage.appendChild(el("div", "crack-sub", "PRESENTS"));
      stage.appendChild(el("div", "crack-game",
        String((disk && disk.displayName) || "A DISK").toUpperCase()));

      var scrollWrap = el("div", "crack-scroll");
      var scrollText = el("div", "crack-scroll-text", SCROLL);
      scrollWrap.appendChild(scrollText);

      root.appendChild(bars);
      root.appendChild(stage);
      root.appendChild(scrollWrap);
      document.body.appendChild(root);

      var done = false;
      var timer = 0;

      function finish(how) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        document.removeEventListener("keydown", onKey, true);
        root.removeEventListener("click", onClick, true);
        /* Fade out rather than vanish, then remove. The removal is on a
           timer AND guarded by `done`, so a double-finish cannot remove a
           node twice or leave one behind. */
        root.classList.add("out");
        setTimeout(function () {
          if (root.parentNode) root.parentNode.removeChild(root);
          resolve(how);
        }, REDUCED ? 0 : 260);
      }

      /* Skippable, which is authentic and also the mercy valve: this plays on
         every single load, so the fiftieth time must cost one keypress.
         🚨 Capture phase. The hub's own document-level keydown handler would
         otherwise see the key first and type it into the BASIC prompt behind
         the overlay — the player would skip the intro and find junk on the
         command line. */
      function onKey(e) {
        if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") return;
        e.preventDefault();
        e.stopPropagation();
        finish("skipped");
      }
      function onClick(e) { e.preventDefault(); e.stopPropagation(); finish("skipped"); }

      document.addEventListener("keydown", onKey, true);
      root.addEventListener("click", onClick, true);

      timer = setTimeout(function () { finish("played"); }, HOLD_MS);
    });
  }

  window.CAT_CRACK = {
    play: play,
    group: GROUP,
    greetz: GREETZ.slice(),
    appliesTo: APPLIES_TO,
    holdMs: HOLD_MS
  };
})();

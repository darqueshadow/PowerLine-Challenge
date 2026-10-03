/* ===========================================================================
   EGG TIMER — VIEW
   Draws the playfield from game snapshots and reacts to game events.
   Owns nothing about the rules: if a number matters, it came from ET.Game.

   Layout (packet §4): nests sit on a LOGICAL 4 × 3 grid, which fixes their places
   and the order they open in (a clear's gunk no longer picks neighbours, E15), but they are drawn scattered — each cell gets a fixed, organic
   offset, so the board never reads as a visible checkerboard. All 12 are on
   screen all game (Refinement 3 §8); the ones not yet active are plain.
   ========================================================================= */
(function (root) {
  var ET = (root.ET = root.ET || {});

  var field, board, floor, hud, banner, popups, wall, cleanup, warp, hands, sign, tips, back;
  var nests = [];          // index = logical cell id
  var bannerTimer = null;
  var noTypesShown = false;
  var piecesAt = null;     // E38: the player's seconds at the last frame, for the pieces' step

  function $(sel) { return document.querySelector(sel); }

  /* Fixed organic offsets per cell, from a constant seed: the same board every game. */
  function offsets() {
    var r = ET.seededRandom(1979);
    var out = [];
    for (var i = 0; i < ET.Game.COLS * ET.Game.ROWS; i++) {
      out.push({ dx: (r() * 2 - 1) * 0.14, dy: (r() * 2 - 1) * 0.07, tilt: (r() * 2 - 1) * 5 });
    }
    return out;
  }

  /* Refinement 6 §3: where the middle row's four nests sit across the board (%), clear of the centre. */
  var MIDDLE_ROW = [12, 31, 69, 88];

  function two(x) { return (x < 10 ? "0" : "") + x; }

  /* A nest clock: displayed time, MM:SS since the CAV started (Timer Refinement §2). */
  function clockText(seconds) {
    var total = Math.max(0, Math.floor(seconds));
    return two(Math.floor(total / 60)) + ":" + two(total % 60);
  }

  /* Seconds past midnight → 24-hour "HH:MM", and the seconds on their own. */
  function hhmm(sec) {
    var t = Math.floor(sec);
    return two(Math.floor(t / 3600) % 24) + ":" + two(Math.floor(t / 60) % 60);
  }

  function popup(nestEl, text, cls) {
    var p = document.createElement("div");
    p.className = "popup " + (cls || "");
    p.textContent = text;
    var r = nestEl.getBoundingClientRect(), f = field.getBoundingClientRect();
    p.style.left = (r.left - f.left + r.width / 2) + "px";
    p.style.top = (r.top - f.top + r.height * 0.3) + "px";
    popups.appendChild(p);
    setTimeout(function () { p.remove(); }, 1100);
  }

  function showBanner(lines, ms) {
    banner.innerHTML = "";
    lines.forEach(function (l) {
      var d = document.createElement("div");
      d.className = l.cls || "";
      d.textContent = l.text;
      banner.appendChild(d);
    });
    banner.hidden = false;
    clearTimeout(bannerTimer);
    if (ms) bannerTimer = setTimeout(function () { banner.hidden = true; }, ms);
  }

  /* 🚨 SAFETY (Andrew, 2026-09-24): the cleanup banner is the biggest thing on screen that flashes, so it gets a guard
     like the lights' and the lightning's: one flash never takes less than 0.4 s, so the banner can never flash more
     than 2.5 times a second, whatever cleanupFlashSeconds is tuned to. */
  function cleanupFlashSeconds() { return Math.max(1 / 2.5, ET.CONFIG.cleanupFlashSeconds); }

  /* Restart a CSS animation on an element by swapping its class. */
  function replay(elm, base, cls) {
    elm.className = base;
    void elm.offsetWidth;
    if (cls) elm.className = base + " " + cls;
  }

  // E37: the pan comes down on a clear only (it used to come down late on a hatch too)
  function slam(v) {
    v.pan.style.setProperty("--pan", ET.CONFIG.panSeconds + "s");
    replay(v.pan, "pan", "hit");
  }

  /* The egg ladder (Refinement 3 rulings): a fast clear's dish and caption over the nest for about a second.
     It lives in the popups layer, which takes no pointer or keyboard, so it never blocks typing. */
  function dish(nestEl, rung) {
    var d = ET.art.dishEl(rung, ET.CONFIG.ladder[rung]);
    var r = nestEl.getBoundingClientRect(), f = field.getBoundingClientRect();
    d.style.left = (r.left - f.left + r.width / 2) + "px";
    d.style.top = (r.top - f.top + r.height * 0.3) + "px";
    d.style.setProperty("--dish", ET.CONFIG.dishSeconds + "s");
    popups.appendChild(d);
    setTimeout(function () { d.remove(); }, ET.CONFIG.dishSeconds * 1000);
  }

  /* The hose ruling (2026-09-22, replacing E5): the hose shows all game (hoseWhen "always"). The older rulings are kept
     as switch values: "wiping" shows it through cleanup and while a drag wipes, "cleanup" through cleanup only. */
  var inCleanup = false;
  function paintHose() {
    var w = ET.CONFIG.hoseWhen;
    var on = w === "always" || inCleanup || (w === "wiping" && field.classList.contains("wiping"));
    field.classList.toggle("hose", on);
    return on;
  }

  /* ⏳ placeholder: the hose body (Hose ruling, 2026-09-22). The nozzle is drawn on the pointer (E44, below);
     this draws the hose from the back of the nozzle, sagging down to a fixed spigot on the board's
     bottom edge. Refinement 4 §2: it sits ABOVE the whole board (nests, gunk, readouts) and below the
     how-to panel, the Command Lines and the HUD bar with its cleanup banner. */
  var NS = "http://www.w3.org/2000/svg";
  var hose = null, lastPointer = null;
  function buildHose() {
    var screen = field.closest(".screen");
    var svg = document.createElementNS(NS, "svg");
    svg.id = "hose";
    svg.setAttribute("aria-hidden", "true");
    function mk(tag, cls) { var e = document.createElementNS(NS, tag); e.setAttribute("class", cls); svg.appendChild(e); return e; }
    hose = { svg: svg, outline: mk("path", "hose-outline"), body: mk("path", "hose-body"), spigot: mk("g", "spigot"), screen: screen };
    var pipe = document.createElementNS(NS, "rect"); pipe.setAttribute("class", "pipe");
    var valve = document.createElementNS(NS, "rect"); valve.setAttribute("class", "valve");
    hose.spigot.appendChild(pipe); hose.spigot.appendChild(valve);
    hose.pipe = pipe; hose.valve = valve;
    screen.insertBefore(svg, screen.firstChild);
    svg.hidden = true;
    buildNozzle();
    document.addEventListener("pointermove", function (ev) {
      lastPointer = { x: ev.clientX, y: ev.clientY };
      drawHose();
    }, true);
    document.documentElement.addEventListener("pointerleave", function () { svg.hidden = true; nozzle.hidden = true; });
    window.addEventListener("resize", drawHose);
  }
  function drawHose() {
    placeNozzle();
    if (!hose || !lastPointer || hose.screen.hidden) { if (hose) hose.svg.hidden = true; return; }
    var sr = hose.screen.getBoundingClientRect(), f = field.getBoundingClientRect();
    var w = ET.CONFIG.hoseWidth;
    // the spigot: fixed on the board's bottom edge, poking up from under the Command Lines
    var sx = f.left - sr.left + f.width * ET.CONFIG.hoseSpigotX, sy = f.bottom - sr.top;
    // the back of the nozzle (its tip is on the pointer; the picture's body runs down-right, turned with it, E44)
    var turn = aim.shown - NOZZLE_AIM, cs = Math.cos(turn), sn = Math.sin(turn);
    var ex = lastPointer.x - sr.left + 24 * cs - 24 * sn, ey = lastPointer.y - sr.top + 24 * sn + 24 * cs;
    var d = Math.hypot(ex - sx, ey - sy);
    var sag = Math.min(0.45 * d, 260);
    // leave the spigot upward, and come into the nozzle from below-right, drooping between
    var c1x = sx, c1y = sy - Math.min(0.35 * d, 140);
    var c2x = ex + 0.18 * d, c2y = Math.min(sy - 8, ey + sag);
    var path = "M" + sx + " " + (sy - 18) + " C" + c1x + " " + c1y + " " + c2x + " " + c2y + " " + ex + " " + ey;
    hose.body.setAttribute("d", path);
    hose.outline.setAttribute("d", path);
    hose.body.style.strokeWidth = w + "px";
    hose.outline.style.strokeWidth = (w + 4) + "px";
    hose.pipe.setAttribute("x", sx - w - 2); hose.pipe.setAttribute("y", sy - 22);
    hose.pipe.setAttribute("width", 2 * w + 4); hose.pipe.setAttribute("height", 22);
    hose.valve.setAttribute("x", sx - w - 8); hose.valve.setAttribute("y", sy - 12);
    hose.valve.setAttribute("width", 2 * w + 16); hose.valve.setAttribute("height", 6);
    hose.svg.hidden = false;
  }

  /* ⏳ placeholder: the egg-laying cord (Refinement 3 §7). It drops from the top of the screen straight
     down to the nest with the egg on its tip, lowers the egg in, pops off, and snakes back up out of view
     while the clock runs. Andrew, 2026-10-01: the cord draws ON TOP of everything else in the game (it was under
     every piece of text), in a layer of its own, #cord-top; only the pause panel and the drawn nozzle are above it.
     #cords keeps Time Warp's lightning and the tags' leaders, under every readout. It's drawn from the snapshot, so
     it freezes on pause. */
  var cords = null;
  function buildCords() {
    var screen = field.closest(".screen");
    var svg = document.createElementNS(NS, "svg");
    svg.id = "cords";
    svg.setAttribute("aria-hidden", "true");
    screen.insertBefore(svg, screen.firstChild);
    var top = document.createElementNS(NS, "svg");
    top.id = "cord-top";
    top.setAttribute("aria-hidden", "true");
    screen.appendChild(top);
    cords = { svg: svg, top: top, screen: screen, list: [] };
    top.style.setProperty("--cord", ET.CONFIG.cordWidth + "px");
    function mk(g, tag, cls) { var e = document.createElementNS(NS, tag); e.setAttribute("class", cls); g.appendChild(e); return e; }
    for (var i = 0; i < nests.length; i++) {
      var g = document.createElementNS(NS, "g");
      g.setAttribute("class", "cord");
      // Refinement 6 §4: a thick cord, striped blood red and purple and deeply ribbed: four strokes on one line
      // (a dark outline, the red, purple stripes, dark rib bands across it)
      var lines = [mk(g, "path", "cord-outline"), mk(g, "path", "cord-line"), mk(g, "path", "cord-stripes"), mk(g, "path", "cord-ribs")];
      var c = { g: g, path: lines[1], lines: lines, bulge: mk(g, "ellipse", "cord-bulge"), egg: mk(g, "ellipse", "cord-egg") };
      top.appendChild(g);
      g.style.display = "none";
      cords.list.push(c);
    }
  }
  function ell(e, x, y, rx, ry, on) {
    e.style.display = on ? "" : "none";
    if (!on) return;
    e.setAttribute("cx", x.toFixed(1)); e.setAttribute("cy", y.toFixed(1));
    e.setAttribute("rx", Math.max(0, rx).toFixed(1)); e.setAttribute("ry", Math.max(0, ry).toFixed(1));
  }
  /* Refinement 4 §1: slower and creepier. The cord drops (the first part of the drop), then a bulge, the
     egg, travels down inside it (a squeeze sounds on its last stretch); at the pop the egg squeezes out of the tip
     into the nest (the pop sounds on the "active" event); then the cord snakes slowly back up. It twitches the
     whole time. `now` is the game's own time, so all of it freezes on pause. */
  function drawCord(i, s, now) {
    var c = cords.list[i];
    var show = s.lay !== null || s.retract !== null;
    c.g.style.display = show ? "" : "none";
    if (!show) return;
    var C = ET.CONFIG;
    // reduced motion (Andrew, 2026-09-24): no twitch, and the retract keeps its snaking shape without writhing
    var still = reducedMotion();
    // from the layout, not the drawn box: a nest popping in (its unlock animation) mustn't shrink the egg
    var sr = cords.screen.getBoundingClientRect(), br = board.getBoundingClientRect(), el = nests[i].el;
    var w = el.offsetWidth, artH = w * 110 / 120;                  // the nest art's viewBox is 120 × 110
    var x = br.left - sr.left + el.offsetLeft;                     // nests are centred on their left/top
    var nestY = br.top - sr.top + el.offsetTop - el.offsetHeight / 2 + artH * (54 / 110);   // the egg's centre
    var eggRy = 28 * C.eggMinScale * w / 120, eggRx = 22 * C.eggMinScale * w / 120;
    var end = nestY - 2.2 * eggRy;                                 // where the cord's tip hangs over the nest
    var tip, wiggle = 0, bulgeY = null, eggY = null, eggK = 1;
    var twitch = still ? 0 : 2.2 * Math.sin(now * 23 + i * 1.7) * Math.sin(now * 3.1 + i);
    if (s.lay !== null) {
      var t = s.lay * (C.layDrop + C.layPop), dropShare = C.cordDropShare;
      if (t < C.layDrop * dropShare) {
        tip = end * (t / (C.layDrop * dropShare));                          // the cord comes down, empty
      } else if (t < C.layDrop) {
        tip = end;
        bulgeY = end * ((t - C.layDrop * dropShare) / (C.layDrop * (1 - dropShare)));   // the egg, inside it
      } else {
        var u = (t - C.layDrop) / C.layPop;                                  // the pop: squeezed out
        tip = end - Math.sin(u * Math.PI) * 6;
        eggY = end + (nestY - end) * u;
        eggK = 0.7 + 0.3 * u;
      }
    } else {
      tip = end * (1 - s.retract);                                          // snaking slowly back up
      wiggle = 18 * Math.sin(s.retract * Math.PI);
    }
    var d = "M" + (x + twitch * 0.3).toFixed(1) + " 0";
    for (var y = 18; y < tip; y += 18) {
      var sway = wiggle * Math.sin(y / 26 + (still ? 0 : now * 9)) + twitch * (y / Math.max(1, tip));
      d += " L" + (x + sway).toFixed(1) + " " + y;
    }
    d += " L" + (x + twitch).toFixed(1) + " " + Math.max(0, tip).toFixed(1);
    c.lines.forEach(function (l) { l.setAttribute("d", d); });
    ell(c.bulge, x + twitch * (bulgeY || 0) / Math.max(1, end), bulgeY || 0, Math.max(eggRx * 1.4, C.cordWidth * 0.85), eggRy * 1.3, bulgeY !== null);   // still a bulge on the thicker cord
    // Chat's answers (2026-09-25): the cord's egg is the nest's own egg picture (see eggDrop()): no oval here, so no swap
    ell(c.egg, x, 0, 0, 0, false);
  }

  /* Chat's answers (2026-09-25), the cord egg: at the pop, the egg that comes out of the cord's tip IS the nest's egg
     picture, at 35% (its size when its clock starts), with the mirror it was given as it was laid, tilted with the nest.
     It slides from the tip down to its base on (0, 20), in the nest's own units, so there's no swap and no drop when it
     lands. Returns how far above its resting place it is (viewBox units), or null outside the pop. */
  function eggDrop(s) {
    if (s.state !== "laying" || s.lay === null) return null;
    var C = ET.CONFIG, t = s.lay * (C.layDrop + C.layPop);
    if (t < C.layDrop) return null;
    var u = Math.min(1, (t - C.layDrop) / C.layPop);
    // the cord's tip hangs at y -8 - 2.2 × (the egg's half-height at 35%) (drawCord's `end`); the egg starts with its
    // top there, and its base ends on (0, 20)
    var half = 28 * C.eggMinScale, tip = -8 - 2.2 * half, start = tip + 2 * half - 20;
    return start * (1 - u);
  }

  /* Refinement 6 §2: the Time Warp lightning. While the warp runs, a jagged bolt runs from the centre panel to
     the nearest nest whose clock is running, then on from that nest to the nearest one not yet reached, and so
     on (a nearest-neighbour daisy chain [T]). It lives in the cord's layer, under the board, so it is under every
     readout and takes no input; it's drawn from the snapshot every frame, so it is off the instant the warp ends.
     🚨 Flicker: the kinks are re-drawn at most lightningFlickerHz (2 [T]) and never more than 2.5 times a second (the one
     guard, in rejag()); with reduced motion they hold still. The kinks are kept per link, so a nest joining or
     leaving the chain moves the bolts without an extra flicker. */
  var bolt = null;
  function buildLightning() {
    var g = document.createElementNS(NS, "g");
    g.setAttribute("class", "lightning");
    g.style.display = "none";
    function mk(cls) { var p = document.createElementNS(NS, "path"); p.setAttribute("class", cls); g.appendChild(p); return p; }
    bolt = { g: g, glow: mk("bolt-glow"), core: mk("bolt-core"), kinks: [], lastJag: -1, log: [], links: 0 };
    cords.svg.appendChild(g);
    // E28: the first-game tag's leader line, in the same layer: under every readout, taking no input
    var p = document.createElementNS(NS, "path");
    p.setAttribute("class", "leader");
    p.style.display = "none";
    cords.svg.appendChild(p);
    tips.ready.line = p;
  }

  /* Pilot art (Chat ruling, 2026-09-25): each egg is mirrored left/right at random, and about 1 in 6 gets the rare eye
     hint. Decided once per egg, as it's laid; the next egg on the nest rolls again. */
  function rollEgg(v) {
    var C = ET.CONFIG;
    v.el.classList.toggle("mirrored", Math.random() < C.eggMirrorChance);
    v.el.classList.toggle("has-eye", Math.random() < C.eggEyeChance);
    v.rolled = true;
  }
  /* The waiting egg's hints (E26, pilot art): each shows from its share of the way from bold to hatch and stays. */
  function paintHints(v, s, crack) {
    var at = ET.CONFIG.eggHintsAt, on = s.state === "overtime" || crack > 0;   // (crack > 0 while Mom mends a hospital egg)
    for (var h in at) {
      var show = on && crack >= at[h] && (h !== "hint-eye" || v.el.classList.contains("has-eye"));
      if (v.el.classList.contains("show-" + h) !== show) v.el.classList.toggle("show-" + h, show);
    }
  }

  /* Board lights and Time Warp dark (Chat ruling, 2026-09-25). One layer behind everything on the play screen (under
     the cord and the bolts too): the board's faint tint, white lights that fade in and out on the gameplay track's beat,
     and a veil that fades the board and its lights to dark while Time Warp runs. Nothing in front of it is touched.
     The beat clock runs on the player's seconds, so mute doesn't stop it and pause freezes it. 🚨 SAFETY: a light only
     ever rises and falls once, slowly, over several beats; at most one starts a beat; the veil's changes go through
     setDark()'s guard. Under reduced motion there are no lights, and the veil still fades. */
  function buildBackdrop() {
    var screen = field.closest(".screen");
    var el = document.createElement("div");
    el.id = "backdrop";
    el.setAttribute("aria-hidden", "true");
    var veil = document.createElement("div");
    veil.className = "veil";
    el.appendChild(veil);
    screen.insertBefore(el, screen.firstChild);
    var pick = (/[?&]tint=(lilac|mint|cream)\b/.exec(location.search) || [])[1] || ET.CONFIG.boardTint;
    el.style.setProperty("--board-tint", "var(--board-tint-" + pick + ")");
    el.style.setProperty("--dark", ET.CONFIG.warpDarkSeconds + "s");
    el.style.setProperty("--dark-opacity", ET.CONFIG.warpDarkOpacity);
    back = { el: el, veil: veil, tint: pick, lights: [], beat: null, dark: false, darkAt: -Infinity, darkLog: [], starts: [], ids: 0 };
  }
  function track() { return ET.CONFIG.music.gameplay; }   // the beat: the gameplay track's BPM
  function setDark(on, t) {
    if (back.dark === on) return false;
    if (t - back.darkAt < Math.max(0.5, ET.CONFIG.warpDarkMinChange)) return false;   // 🚨 the veil's guard
    back.dark = on;
    back.darkAt = t;
    back.veil.classList.toggle("dark", on);
    back.darkLog.push({ t: t, on: on });
    if (back.darkLog.length > 400) back.darkLog.splice(0, 200);
    return true;
  }
  function paintBackdrop(snap) {
    var C = ET.CONFIG, sr = back.el.parentNode.getBoundingClientRect(), f = field.getBoundingClientRect();
    back.el.style.left = (f.left - sr.left) + "px"; back.el.style.top = (f.top - sr.top) + "px";
    back.el.style.width = f.width + "px"; back.el.style.height = f.height + "px";
    setDark(!!snap.warp, snap.time);
    var still = reducedMotion(), beatLen = 60 / track().bpm, life = C.lightsBeats * beatLen, t = snap.time;
    if (still) { back.lights.forEach(function (l) { l.el.remove(); }); back.lights = []; back.beat = null; return; }
    // a new beat: maybe start a light (at most one a beat, at most lightsMax showing)
    var beat = Math.floor(t / beatLen);
    if (back.beat === null) back.beat = beat;
    if (beat !== back.beat) {
      back.beat = beat;
      if (back.lights.length < C.lightsMax && Math.random() < C.lightsBeatChance) {
        var d = f.height * (C.lightsSize[0] + Math.random() * (C.lightsSize[1] - C.lightsSize[0]));
        var el = document.createElement("i");
        el.className = "light";
        el.style.width = el.style.height = d.toFixed(0) + "px";
        el.style.left = (Math.random() * f.width - d / 2).toFixed(0) + "px";
        el.style.top = (Math.random() * f.height - d / 2).toFixed(0) + "px";
        back.el.insertBefore(el, back.veil);
        back.lights.push({ id: ++back.ids, el: el, born: beat * beatLen });
        back.starts.push(beat * beatLen);
        if (back.starts.length > 400) back.starts.splice(0, 200);
      }
    }
    // each light rises and falls once, smoothly, over its life
    back.lights = back.lights.filter(function (l) {
      var u = (t - l.born) / life;
      if (u >= 1 || u < 0) { l.el.remove(); return false; }
      l.el.style.opacity = (C.lightsPeak * Math.sin(Math.PI * u)).toFixed(4);
      return true;
    });
  }
  function resetBackdrop() {
    back.lights.forEach(function (l) { l.el.remove(); });
    back.lights = [];
    back.beat = null;
    back.starts = [];
    back.dark = false;
    back.darkAt = -Infinity;
    back.darkLog = [];
    back.veil.classList.remove("dark");
  }

  /* E28: Time Warp's sign. When it kicks in it flashes warpSignFlashes times, then stays lit; it goes dark when Time
     Warp ends. Timed by the player's seconds, so a pause holds it. 🚨 SAFETY: every change goes through setSign(),
     which refuses one within warpSignMinChange of the last (never below 0.25 s), so at most 2 flashes a second. Under
     reduced motion it lights at once, no flash. */
  function setSign(on, t) {
    if (sign.lit === on) return false;
    if (t - sign.last < Math.max(0.25, ET.CONFIG.warpSignMinChange)) return false;   // 🚨 the flash-rate guard
    sign.lit = on;
    sign.last = t;
    sign.el.classList.toggle("on", on);
    sign.log.push({ t: t, on: on });
    if (sign.log.length > 400) sign.log.splice(0, 200);
    return true;
  }
  function paintSign(snap) {
    var C = ET.CONFIG, on = !!snap.warp;
    if (on && !sign.was) sign.t0 = snap.time;   // it just kicked in
    if (on !== sign.was && ET.audio) ET.audio.warp(on);   // E43: a rising zap as it starts, a falling one as it ends
    sign.was = on;
    var want = on, wobble = false;
    if (on && !reducedMotion()) {
      var step = Math.max(0.25, C.warpSignFlashSeconds / 2), k = Math.floor((snap.time - sign.t0) / step);
      want = k >= 2 * C.warpSignFlashes || k % 2 === 0;
      // E31 (ruled 2026-09-24): once the flashes are done, the letters wobble and stretch while it runs. It's movement,
      // not flashing: the sign stays lit and its colours never change (style.css). Never under reduced motion.
      wobble = k >= 2 * C.warpSignFlashes;
    }
    setSign(want, snap.time);
    if (sign.el.classList.contains("wobble") !== wobble) sign.el.classList.toggle("wobble", wobble);
  }

  /* E28: wave 1's first-game tag. The first egg to go bold gets "Pink = ready! Type RCAV <unit>", once a game, for as
     long as it's bold; on a hospital egg, once its VS is off, it reads "Now type CAV <unit> STR" (E53). It sits left of
     the wall clock, in the band above the board, so it never covers a nest or a readout; a thin leader line (in the
     cord's layer, under every readout) runs to the egg. Nothing flashes. (E54 took the "Check the wall clock" tag.) */
  function paintTips(snap) {
    var wr = document.querySelector(".wallclock").getBoundingClientRect(), tr = field.querySelector("#fieldtop").getBoundingClientRect();
    var tip = tips.ready, s = tip.nest === null ? null : snap.nests.filter(function (x) { return x.id === tip.nest; })[0];   // the snapshot lists nests in play only
    if (!s || s.state !== "overtime") {
      tip.nest = null;
      tip.el.hidden = true;
      tip.line.style.display = "none";
      return;
    }
    var text = s.removed ? "Now type CAV " + s.unit + " " + ET.CONFIG.hospitalType : "Pink = ready! Type RCAV " + s.unit;
    if (tip.el.textContent !== text) tip.el.textContent = text;
    tip.el.hidden = false;
    placeTip(wr, tr);
    var sr = cords.screen.getBoundingClientRect(), a = tip.el.getBoundingClientRect();
    var target = nests[tip.nest].el.querySelector(".egg").getBoundingClientRect();
    var x0 = a.left + a.width * 0.3 - sr.left, y0 = a.bottom - sr.top;
    var x1 = target.left + target.width / 2 - sr.left, y1 = target.top + target.height / 2 - sr.top;
    tip.line.setAttribute("d", "M" + x0.toFixed(1) + " " + y0.toFixed(1) + " L" + x1.toFixed(1) + " " + y1.toFixed(1));
    tip.line.style.display = "";
  }
  /* The tag, left of the wall clock. */
  function placeTip(wr, tr) {
    var el = tips.ready.el;
    el.style.left = "";
    el.style.right = (tr.right - wr.left + 14).toFixed(1) + "px";
  }
  function resetTips() {
    tips.ready.nest = null;
    tips.ready.done = false;
    tips.ready.el.hidden = true;
    if (tips.ready.line) tips.ready.line.style.display = "none";
  }

  /* E55 (ruled 2026-10-02): Mom repairs a hospital egg as its STR goes on, with the two Gemini parts kits (Andrew
     approved the art, Chat's brief 2026-10-02; core/mom.js draws her). In the popups layer (no pointer, no keyboard),
     for momRepairSeconds: she comes in, looks down and patches the egg (its cracks close), turns to the player and
     giggles, and goes back out. She's painted from the game's own seconds every frame, so a pause holds her. */
  var fixes = [];
  /* The egg on screen, in px of the field: its middle, width and top. Its pictures are full-slot layers, so it's found
     in the nest's own units (the shell spans x -22..22, y -38..20; art.js) through the egg's screen transform, which
     carries its growth and the nest's tilt. */
  function eggBox(v) {
    var g = v.egg.querySelector(".mirror") || v.egg, m = g.getScreenCTM(), f = field.getBoundingClientRect();
    var at = function (x, y) { return { x: m.a * x + m.c * y + m.e - f.left, y: m.b * x + m.d * y + m.f - f.top }; };
    var mid = at(0, -9), top = at(0, -38);
    return { x: mid.x, y: mid.y, w: 44 * Math.hypot(m.a, m.b), top: top.y };
  }
  /* Where she goes (Chat's brief, 2026-10-02: she comes in from the play-field edge nearest the egg, and never covers
     a timer, a nest, a readout, a Command Line, the trough or the sink). The edges are tried nearest first; along each,
     her head slides from opposite the egg outward, a little in from the edge, until her head (upright and turned for
     A), the path she slides in on, and both tentacles (from her chin to the egg, no longer than momStretchMax) are clear
     of everything she mustn't cover. Her tentacles may cross only her own nest (not its readout). The Command Lines and
     the HUD are outside the field, and she's clipped to the field inside the trough. With no clear spot on any edge
     (the board's middle nests, mostly): momNoEdge (E58, ruled 2026-10-02: "nest"). Either way her head and tentacles
     never cover a readout, her own included, so the unit number and timer stay in sight all visit (E58's condition). */
  function fieldRect(e, f) {
    var r = e.getBoundingClientRect();
    return { l: r.left - f.left, t: r.top - f.top, r: r.right - f.left, b: r.bottom - f.top };
  }
  function overlaps(a, b) { return a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b; }
  function grownBy(r, m) { return { l: r.l - m, t: r.t - m, r: r.r + m, b: r.b + m }; }
  function momObstacles(v, f) {
    var out = [], own = [];
    nests.forEach(function (n) {
      var parts = [n.el, n.readout];
      if (!n.hsign.hidden) parts.push(n.hsign);
      if (!n.refused.hidden) parts.push(n.refused);
      if (n.hosp && !n.hosp.hidden) parts.push(n.hosp);
      if (n.house && !n.house.hidden) parts.push(n.house);
      parts.forEach(function (e) {
        var r = fieldRect(e, f);
        if (r.r - r.l < 1) return;
        (n === v && e !== n.readout ? own : out).push(r);
      });
    });
    ["#fieldtop .wallclock", "#tip-ready", "#warp", "#hose-tag", "#cleanup"].forEach(function (sel) {
      var e = field.querySelector(sel);
      if (!e || e.hidden) return;
      var r = fieldRect(e, f);
      if (r.r - r.l > 1 && r.b - r.t > 1) out.push(r);
    });
    return { all: out, own: own };   // own: her own nest (her tentacles may cross it, her head may not)
  }
  // the box she's drawn in: the field, inside the trough (left, right and bottom; none on top)
  function momClip(f) {
    var T = function (sel) { var e = field.querySelector(sel); return e ? fieldRect(e, f) : null; };
    var l = T("#trough .t-left"), r = T("#trough .t-right"), b = T("#trough .t-bl");
    return { l: l ? l.r : 0, t: 0, r: r ? r.l : f.width, b: b ? b.t : f.height };
  }
  function momClear(lay, ob, clip) {
    var C = ET.CONFIG, G = ET.mom.geometry(lay), m = 3;
    var hw = G.hw, hh = G.hh, h = lay.head;
    var box = { l: h.x - hw / 2, t: h.y - hh / 2, r: h.x + hw / 2, b: h.y + hh / 2 };
    if (box.l < clip.l || box.r > clip.r || box.t < clip.t || box.b > clip.b) return false;
    // A, turned about her chin
    var a = lay.tilt * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a), xs = [], ys = [];
    [[box.l, box.t], [box.r, box.t], [box.l, box.b], [box.r, box.b]].forEach(function (p) {
      var dx = p[0] - G.chin.x, dy = p[1] - G.chin.y;
      xs.push(G.chin.x + dx * cs - dy * sn); ys.push(G.chin.y + dx * sn + dy * cs);
    });
    var turned = { l: Math.min.apply(null, xs), t: Math.min.apply(null, ys), r: Math.max.apply(null, xs), b: Math.max.apply(null, ys) };
    if (turned.l < clip.l || turned.r > clip.r || turned.t < clip.t || turned.b > clip.b) return false;
    // the path she slides in on, from behind her edge
    var path = { l: box.l, t: box.t, r: box.r, b: box.b };
    if (lay.from === "top") path.t = clip.t; else if (lay.from === "bottom") path.b = clip.b;
    else if (lay.from === "left") path.l = clip.l; else path.r = clip.r;
    var heads = [grownBy(box, m), grownBy(turned, m), path];
    var all = ob.all.concat(ob.own);
    for (var i = 0; i < all.length; i++) {
      for (var j = 0; j < heads.length; j++) if (overlaps(heads[j], all[i])) return false;
    }
    // the tentacles: a tube from each stub to its tip
    var rad = G.tube / 2 + m;
    for (var k = 0; k < G.tents.length; k++) {
      var t = G.tents[k];
      if (t.stretch > C.momStretchMax) return false;
      var steps = Math.max(2, Math.ceil(t.dist / 8));
      for (var s = 0; s <= steps; s++) {
        var x = t.from.x + (t.to.x - t.from.x) * s / steps, y = t.from.y + (t.to.y - t.from.y) * s / steps;
        var dot = { l: x - rad, t: y - rad, r: x + rad, b: y + rad };
        if (dot.l < clip.l || dot.r > clip.r || dot.b > clip.b) return false;
        for (var n = 0; n < ob.all.length; n++) if (overlaps(dot, ob.all[n])) return false;
      }
    }
    return true;
  }
  function turnDeg(fx, fy, tx, ty) {
    var d = (Math.atan2(ty, tx) - Math.atan2(fy, fx)) * 180 / Math.PI;
    return d > 180 ? d - 360 : d < -180 ? d + 360 : d;
  }
  function momLayout(v, kind) {
    var C = ET.CONFIG, P = ET.MOM_PARTS[kind];
    var f = field.getBoundingClientRect(), egg = eggBox(v), clip = momClip(f), ob = momObstacles(v, f);
    var hw = v.el.offsetWidth * C.momHeadShare, hh = hw * P.head[1] / P.head[0];
    var base = { kind: kind, headW: hw, egg: egg, clip: clip };
    var edges = [
      { from: "top", d: egg.y - clip.t }, { from: "bottom", d: clip.b - egg.y },
      { from: "left", d: egg.x - clip.l }, { from: "right", d: clip.r - egg.x }
    ].sort(function (a, b) { return a.d - b.d; });
    var gap = 2, sweep = 3 * hw, step = 10;
    for (var e = 0; e < edges.length; e++) {
      var from = edges[e].from;
      for (var inset = 0; inset <= 1; inset += 0.25) {
        for (var s = 0; s <= sweep; s += step) {
          for (var sign = -1; sign <= 1; sign += 2) {
            if (s === 0 && sign > 0) continue;
            var o = s * sign, head;
            if (from === "top") head = { x: egg.x + o, y: clip.t + hh / 2 + gap + inset * hh };
            else if (from === "bottom") head = { x: egg.x + o, y: clip.b - hh / 2 - gap - inset * hh };
            else if (from === "left") head = { x: clip.l + hw / 2 + gap + inset * hw, y: egg.y + o };
            else head = { x: clip.r - hw / 2 - gap - inset * hw, y: egg.y + o };
            var lay = Object.assign({}, base, { head: head, from: from });
            var chinX = head.x + (P.chin[0] - 0.5) * hw, chinY = head.y + (P.chin[1] - 0.5) * hh;
            var full = Math.max(-C.momTiltMax, Math.min(C.momTiltMax, turnDeg(0, 1, egg.x - chinX, egg.y - chinY)));
            // A turns toward the egg as far as there's room: all the way, half, or not at all
            for (var k = 0; k < 3; k++) {
              lay.tilt = full * [1, 0.5, 0][k];
              if (momClear(lay, ob, clip)) return lay;
            }
          }
        }
      }
    }
    return momNoEdge(v, kind, base, f);
  }
  /* E58 (ruled 2026-10-02, Chat: "nest"): no edge has room. She comes down inside her own nest's box, above its
     readout, smaller if she must be (her head no lower than the egg's middle), so she covers nothing but her own nest.
     ("over", not ruled: the visit before the kit's edge rule, her full-size head just above the egg; it covers the
     readout of the nest above.) */
  function momNoEdge(v, kind, base, f) {
    var C = ET.CONFIG, P = ET.MOM_PARTS[kind], egg = base.egg;
    var hw = base.headW, hh = hw * P.head[1] / P.head[0];
    if (C.momNoEdge === "over") {
      return Object.assign({}, base, { head: { x: egg.x, y: egg.top - hh * 0.38 }, from: "top", tilt: 0, fallback: "over",
        clip: { l: 0, t: 0, r: f.width, b: f.height } });
    }
    var nb = fieldRect(v.el, f), ro = fieldRect(v.readout, f);
    var clip = { l: nb.l, t: nb.t, r: nb.r, b: ro.t };
    var room = egg.y - clip.t - 2;
    if (hh > room) { hh = room; hw = hh * P.head[0] / P.head[1]; }
    return Object.assign({}, base, { headW: hw, head: { x: egg.x, y: clip.t + 1 + hh / 2 }, from: "top", tilt: 0,
      fallback: "nest", clip: clip });
  }
  /* Creepy Mom's drool (Mom kit): where its drop lands. It falls from the end of the strand under her mouth (pose B,
     upright); the splat must land on the board's floor (where goo washes off) and, flung droplets and all, cover no
     nest, readout, sign, timer, the sink tag or the trough; the drop's own fall (a straight line, drifting a little to
     the side at most) must cross none of them either. So the spot is searched for: straight down first, then further
     to either side, nearest first. None clear: `stop`, how far straight down it can fall before it would touch
     anything; it fades out before then and leaves no splat. The glow (Chat, 2026-10-02: glowing purple) counts as part
     of it everywhere: the splat's clear zone and the drop's path are both widened by the halo's radius. */
  function momDroolPlan(lay, v, f, ob) {
    var C = ET.CONFIG, D = C.momDrool, P = ET.MOM_PARTS.creepy, G = ET.mom.geometry(lay);
    var mouth = { x: lay.head.x + (P.mouth[0] - 0.5) * G.hw, y: lay.head.y + (P.mouth[1] - 0.5) * G.hh };
    var len = G.hh * D.length, r = G.hw * D.splat, rb = Math.max(4, G.hw * D.drop_r), glow = Math.max(2, G.hw * D.glow);
    var fl = fieldRect(floor, f), clip = lay.clip;
    var area = { l: Math.max(fl.l, clip.l), t: Math.max(fl.t, clip.t), r: Math.min(fl.r, clip.r), b: Math.min(fl.b, clip.b) };
    var all = ob.all.concat(ob.own), reach = r * 2.4 + 4 + glow, flat = 0.65;
    var start = mouth.y + len + rb;
    var hits = function (box) { return all.some(function (o) { return overlaps(box, o); }); };
    var pathClear = function (x1, y1) {
      var n = Math.max(2, Math.ceil(Math.hypot(x1 - mouth.x, y1 - start) / 6));
      for (var i = 0; i <= n; i++) {
        var x = mouth.x + (x1 - mouth.x) * i / n, y = start + (y1 - start) * i / n, m = rb + 2 + glow;
        var d = { l: x - m, t: y - m, r: x + m, b: y + m };
        if (d.l < clip.l || d.r > clip.r || d.b > clip.b || hits(d)) return false;
      }
      return true;
    };
    var best = null;
    [0, -0.25, 0.25, -0.5, 0.5, -0.75, 0.75, -1, 1].some(function (dx) {
      var x = mouth.x + dx * G.hw;
      for (var y = Math.max(start + reach * flat, area.t + reach * flat); y < area.b; y += 6) {
        if (Math.abs(dx * G.hw) > (y - start) * 0.6) continue;           // it drifts, it isn't thrown
        var box = { l: x - reach, r: x + reach, t: y - reach * flat - glow, b: y + reach * flat + glow };
        if (box.l < area.l || box.r > area.r || box.t < area.t || box.b > area.b || hits(box)) continue;
        if (!pathClear(x, y)) break;                                      // anything further down this line is no better
        best = { x: x, y: y, dx: dx, r: r, glow: glow, box: box };
        return true;
      }
      return false;
    });
    var stop = start;
    if (!best) {
      for (var y = start; y < clip.b; y += 3) {
        var m = rb + 2 + glow;
        if (hits({ l: mouth.x - m, t: y - m, r: mouth.x + m, b: y + m })) break;
        stop = y;
      }
    }
    return { x: mouth.x, y: mouth.y, len: len, drop: rb, glow: glow, land: best, stop: stop };
  }
  // the splat, on the floor, where the drop landed (its glow on the floor too, so it washes off with it)
  function momSplat(at) {
    var fr = floor.getBoundingClientRect(), f = field.getBoundingClientRect();
    if (!fr.width || !fr.height) return null;
    return ET.mess.drool(floor, at.x - (fr.left - f.left), at.y - (fr.top - f.top), at.r, floor.width / fr.width, floor.height / fr.height, at.glow);
  }
  function momFix(v, kind, t) {
    var m = { v: v, kind: kind, t0: t, giggled: false, from: v.crackShown || 0 };
    var lay = momLayout(v, kind);
    m.edge = lay.from;
    m.fallback = lay.fallback;
    if (kind === "creepy") {   // sweet Mom never drools
      var f = field.getBoundingClientRect();
      lay.drool = momDroolPlan(lay, v, f, momObstacles(v, f));
      m.drool = lay.drool;
      if (lay.drool.land) lay.drool.onLand = function () { m.splat = momSplat(lay.drool.land); };
    }
    m.rig = ET.mom.visit(popups, lay);
    m.el = m.rig.el;
    fixes.push(m);
    v.mend = m;
  }
  // every frame: paint each visit at its moment; the giggle as she turns to the player; her exit
  var momNow = 0;   // the game's seconds at the last frame (for a rig's momVisit)
  function stepFixes(t) {
    momNow = t;
    var T = ET.CONFIG.momRepairSeconds;
    fixes = fixes.filter(function (m) {
      var u = (t - m.t0) / T;
      m.u = u;
      if (u >= 0 && u < 1) m.rig.paint(u, reducedMotion());
      if (!m.giggled && u * T >= ET.CONFIG.momTimeline.face) { m.giggled = true; if (ET.audio) ET.audio.giggle(m.kind); }
      if (u >= 1 || u < 0) { m.rig.remove(); if (m.v.mend === m) m.v.mend = null; return false; }
      return true;
    });
  }
  // the egg's cracks while Mom mends it: held as they were, then closing as she patches (momTimeline.mend)
  function mendedCrack(v, t) {
    var m = v.mend, M = ET.CONFIG.momTimeline.mend;
    return m.from * Math.max(0, Math.min(1, 1 - (t - m.t0 - M[0]) / (M[1] - M[0])));
  }
  /* Reduced motion: the lightning holds still, and (Andrew, 2026-09-24) the overtime egg stops wobbling and the cord
     stops twitching; style.css stops the CSS loops. One live query, read every frame, so a change applies at once. */
  var motionQuery = root.matchMedia ? root.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function reducedMotion() { return !!(motionQuery && motionQuery.matches); }
  /* E27: the grandfather clock's hands. They turn only while the Time Accelerator runs, by the player's seconds (so
     a pause holds them), and stop where they are when it ends. Under reduced motion they hold still and the face
     shows "5×" instead. */
  function resetHands() {
    hands.at = ET.CONFIG.accelHandsAt.slice();
    hands.t = null;
    drawHands();
  }
  function drawHands() {
    hands.hour.setAttribute("transform", "rotate(" + hands.at[0].toFixed(2) + " 40 46)");
    hands.minute.setAttribute("transform", "rotate(" + hands.at[1].toFixed(2) + " 40 46)");
  }
  function turnHands(snap) {
    var on = !!snap.warp, still = reducedMotion();
    var dt = hands.t === null || snap.time < hands.t ? 0 : snap.time - hands.t;
    hands.t = snap.time;
    warp.classList.toggle("still", on && still);
    if (!on || still || dt <= 0) return;
    var turn = 360 * ET.CONFIG.accelMinuteTurns * dt;
    hands.at = [(hands.at[0] + turn / 12) % 360, (hands.at[1] + turn) % 360];
    drawHands();
  }
  function rejag(t) {
    var gap = Math.max(1 / 2.5, 1 / ET.CONFIG.lightningFlickerHz);   // 🚨 never more than 2.5 a second, whatever the tunable says
    if (bolt.lastJag >= 0 && (t - bolt.lastJag < gap || reducedMotion())) return;
    bolt.lastJag = t;
    bolt.kinks = [];
    bolt.log.push(t);
    if (bolt.log.length > 400) bolt.log.splice(0, 200);
  }
  function kinksFor(k) {
    while (bolt.kinks.length <= k) {
      var ks = [];
      for (var i = 0; i < ET.CONFIG.lightningKinks; i++) ks.push(Math.random() * 2 - 1);
      bolt.kinks.push(ks);
    }
    return bolt.kinks[k];
  }
  function drawLightning(snap) {
    var on = !!snap.warp;
    bolt.g.style.display = on ? "" : "none";
    if (!on) { bolt.links = 0; bolt.lastJag = -1; return; }
    var sr = cords.screen.getBoundingClientRect(), br = board.getBoundingClientRect(), wr = hands.face.getBoundingClientRect();   // E27: from the clock face
    var from = { x: wr.left + wr.width / 2 - sr.left, y: wr.top + wr.height / 2 - sr.top };
    var left = snap.nests.filter(function (s) { return s.state === "active" || s.state === "overtime"; }).map(function (s) {
      var el = nests[s.id].el;
      return { x: br.left - sr.left + el.offsetLeft, y: br.top - sr.top + el.offsetTop - el.offsetHeight * 0.18 };
    });
    rejag(performance.now() / 1000);
    var d = "", k = 0, J = ET.CONFIG.lightningJag;
    while (left.length) {
      var best = 0;
      for (var i = 1; i < left.length; i++) {
        if (Math.hypot(left[i].x - from.x, left[i].y - from.y) < Math.hypot(left[best].x - from.x, left[best].y - from.y)) best = i;
      }
      var to = left.splice(best, 1)[0], ks = kinksFor(k++);
      var dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
      d += "M" + from.x.toFixed(1) + " " + from.y.toFixed(1);
      for (var j = 0; j < ks.length; j++) {
        var u = (j + 1) / (ks.length + 1), off = ks[j] * J;
        d += " L" + (from.x + dx * u + nx * off).toFixed(1) + " " + (from.y + dy * u + ny * off).toFixed(1);
      }
      d += " L" + to.x.toFixed(1) + " " + to.y.toFixed(1) + " ";
      from = to;
    }
    bolt.links = k;
    bolt.glow.setAttribute("d", d);
    bolt.core.setAttribute("d", d);
  }

  /* E15 (Refinement 3 rulings): `count` blobs dropped evenly at random over the whole board. One that
     lands on a nest goes on that nest's canvas (mess belongs to the nest, and covers its readout, E14);
     anywhere else it goes on the board-wide floor canvas under the nests. */
  function fling(count) {
    var br = board.getBoundingClientRect(), px = ET.CONFIG.messBlobPx;
    for (var i = 0; i < count; i++) {
      var x = br.left + Math.random() * br.width, y = br.top + Math.random() * br.height;
      var r = px[0] + Math.random() * (px[1] - px[0]);
      var into = floor, cr = floor.getBoundingClientRect();
      for (var k = 0; k < nests.length; k++) {
        var mr = nests[k].mess.getBoundingClientRect();
        if (x >= mr.left && x <= mr.right && y >= mr.top && y <= mr.bottom) { into = nests[k].mess; cr = mr; break; }
      }
      // a nest's canvas is drawn scaled while the nest grows in (its 0.4 s unlock): place the blob by the drawn box, but
      // size it by the canvas's own layout width, or a blob landing then comes out ~5× too big once the nest is full size
      ET.mess.blob(into, (x - cr.left) * into.width / cr.width, (y - cr.top) * into.height / cr.height, r * into.width / (into.offsetWidth || cr.width));
    }
  }

  /* E42 (Chat, 2026-09-25): the hose blasts, not trickles (⏳ placeholder look). From the press to the release, moving
     or not, a thick, fast jet leaves the nozzle's tip (the cursor's hotspot) and reaches hoseJet.length ahead, with a
     burst at the nozzle, mist thrown off along it and a splash where it hits; the blast sounds all that time. The jet
     points where the nozzle picture points: the way the drag goes (E44, below). Refinement 4 §2: the
     water draws with the hose, above the board. Reduced motion: the jet only, standing still. */
  var water = null, stopWipe = null;

  /* E44 (Chat, 2026-09-25): the nozzle turns to point where the jet goes, so the picture and the jet always agree. A
     cursor picture can't turn, so in play the system cursor is hidden (style.css) and the nozzle is drawn here, its tip
     on the pointer (the cleaning point, where it always was), turned about that tip. E51 (Andrew, 2026-10-01): it points
     the way the mouse is moving right now, taken from its last hoseJet.turnMinMove px of travel (a smaller wobble turns
     nothing), and snaps there with the jet: no swing (it was E44's). Still, it keeps its last direction; each game
     starts pointing up-left, as the cursor did. */
  var NOZZLE_AIM = -3 * Math.PI / 4;   // the picture's own aim: up-left
  var aim = { want: NOZZLE_AIM, shown: NOZZLE_AIM, from: null };
  /* The hatch (Andrew, 2026-10-01; replaces E46's "a cute alien only scurries"). Both sets come out of the nest, scurry
     a little way and dance on the spot (CSS, style.css: one timeline as long as the hatch). A horror alien then FREEZES
     and stares for a beat, and jumps at the player: the same puppet, full screen, in #scare, sudden and fast after the
     stillness, held a moment, then it drops away. A cute one does a goofy hop toward the player instead (CSS only). A
     pause holds all of it: the CSS timelines stop (body.paused) and so does this clock, which counts real time, not the
     game's (the last hatch plays out after the game itself has stopped). Nothing flashes or changes brightness: it moves.
     Reduced motion: the alien sits still in its nest; the jump is E49's "still" (CONFIG.hatchScareReduced). */
  var scare = null, hatching = [], hatchClock = { at: 0 };
  function buildScare() {
    var el = document.createElement("div");
    el.id = "scare";
    el.setAttribute("aria-hidden", "true");
    el.hidden = true;
    el.innerHTML = '<svg viewBox="-34 -36 68 60"><g class="creature"></g></svg>';
    field.closest(".screen").appendChild(el);
    scare = { el: el, slot: el.querySelector(".creature"), nest: null };
  }
  function endScare() {
    if (!scare) return;
    scare.el.hidden = true;
    scare.el.classList.remove("go", "still");
    ET.aliens.clear(scare.slot);
    scare.nest = null;
  }
  // a hatch starts its clock: a horror one's freeze and jump are timed here, and a cute one's boing (the hop)
  function startHatch(v, set) {
    hatching = hatching.filter(function (h) { return h.v !== v; });
    v.el.classList.remove("freeze", "leapt");
    hatching.push({ v: v, set: set, t: 0, frozen: false, leapt: false, boinged: false });
  }
  function stepHatches() {
    var now = performance.now(), dt = hatchClock.at ? Math.min(0.1, (now - hatchClock.at) / 1000) : 0;
    hatchClock.at = now;
    if (!hatching.length) return;
    if (document.body.classList.contains("paused")) return;   // a pause holds the hatch
    var C = ET.CONFIG, total = C.escapeSeconds;
    hatching.forEach(function (h) {
      h.t += dt;
      if (h.set === "cute") {
        // the hop starts as the dance ends (style.css: 55%); the boing goes with it
        if (!h.boinged && h.t >= C.hatchScare.freeze * total) { h.boinged = true; if (ET.audio) ET.audio.boing(); }
        return;
      }
      if (!h.frozen && h.t >= C.hatchScare.freeze * total) { h.frozen = true; h.v.el.classList.add("freeze"); if (ET.audio) ET.audio.stare(); }
      if (!h.leapt && h.t >= C.hatchScare.leap * total) { h.leapt = true; leap(h.v); }
    });
    hatching = hatching.filter(function (h) { return h.t < total; });
  }
  // the jump: the puppet leaves the nest and comes at the player, filling the screen
  function leap(v) {
    var still = reducedMotion();
    var alien = v.el.dataset.alien;
    if ((still && ET.CONFIG.hatchScareReduced === "none") || !alien || !scare) { if (ET.audio) ET.audio.unhush(0); return; }
    if (ET.audio) ET.audio.stinger();   // the stinger, and the music back after it
    ET.aliens.fill(scare.slot, alien);
    scare.nest = v;
    v.el.classList.add("leapt");
    // start where the alien is (its nest), as big as it is there
    var r = v.svg.getBoundingClientRect(), svg = scare.el.querySelector("svg");
    scare.el.hidden = false;
    var big = svg.getBoundingClientRect();
    scare.el.style.setProperty("--sx", (r.left + r.width / 2 - innerWidth / 2).toFixed(0) + "px");
    scare.el.style.setProperty("--sy", (r.top + r.height * 0.4 - innerHeight / 2).toFixed(0) + "px");
    scare.el.style.setProperty("--s0", Math.max(0.02, r.height / Math.max(1, big.height)).toFixed(3));
    scare.el.style.setProperty("--jump", (ET.CONFIG.escapeSeconds * (1 - ET.CONFIG.hatchScare.leap)).toFixed(2) + "s");
    scare.el.classList.toggle("still", still);
    scare.el.classList.remove("go");
    void scare.el.offsetWidth;
    scare.el.classList.add("go");
  }

  var nozzle = null;
  function buildNozzle() {
    nozzle = document.createElement("div");
    nozzle.id = "nozzle";
    nozzle.setAttribute("aria-hidden", "true");
    nozzle.innerHTML = '<svg viewBox="0 0 32 32" width="32" height="32"><path class="n-hose-edge" d="M30 30 L16 16"/>' +
      '<path class="n-hose" d="M30 30 L16 16"/><path class="n-head" d="M17 11 L11 17 L2 6 L6 2 Z"/></svg>';
    nozzle.hidden = true;
    document.body.appendChild(nozzle);
  }
  function placeNozzle() {
    if (!nozzle) return;
    var show = !!lastPointer && !!hose && !hose.screen.hidden;
    nozzle.hidden = !show;
    if (!show) return;
    nozzle.style.transform = "translate(" + (lastPointer.x - 3) + "px, " + (lastPointer.y - 3) + "px) rotate(" + (aim.shown - NOZZLE_AIM) + "rad)";
  }
  function turnBy(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }   // the short way round, -π…π
  // the drag is at (x, y), screen px: once it has moved far enough from where its direction was last taken, turn
  function steer(x, y) {
    if (!aim.from) { aim.from = { x: x, y: y }; return; }
    var dx = x - aim.from.x, dy = y - aim.from.y;
    if (Math.hypot(dx, dy) < ET.CONFIG.hoseJet.turnMinMove) return;
    aim.from = { x: x, y: y };
    aim.want = aim.shown = Math.atan2(dy, dx);   // E51: at once, the picture with the jet
    turned();
  }
  function turned() { drawHose(); if (water && water.on) placeJet(); }
  function resetAim() {
    aim.want = aim.shown = NOZZLE_AIM; aim.from = null;
    drawHose();
  }
  /* Andrew, 2026-09-30: the stream, for dt of the player's seconds (a pause gives 0): from the nozzle (the pointer) along
     the drawn jet, it pushes every piece it touches and washes the goo on every canvas it crosses, the way it flows. */
  function streamStep(dt) {
    if (!water || !water.on || !(dt > 0)) return;
    var br = board.getBoundingClientRect(), s = jetSize(), ux = Math.cos(aim.shown), uy = Math.sin(aim.shown);
    var x0 = water.x, y0 = water.y, x1 = x0 + ux * s.len, y1 = y0 + uy * s.len;
    ET.pieces.stream(x0 - br.left, y0 - br.top, ux * s.len, uy * s.len, dt);
    var canvases = nests.map(function (v) { return { id: v.el.dataset.id, c: v.mess }; }).concat([{ id: "floor", c: floor }]);
    canvases.forEach(function (h) {
      var r = h.c.getBoundingClientRect();
      if (Math.max(x0, x1) + s.w < r.left || Math.min(x0, x1) - s.w > r.right || Math.max(y0, y1) + s.w < r.top || Math.min(y0, y1) - s.w > r.bottom) return;
      var kx = h.c.width / r.width, ky = h.c.height / r.height;
      ET.mess.flow(h.c, (x0 - r.left) * kx, (y0 - r.top) * ky, (x1 - r.left) * kx, (y1 - r.top) * ky, ET.CONFIG.wipeRadius * kx, dt);
    });
  }
  function jetSize() {
    var J = ET.CONFIG.hoseJet, h = board.getBoundingClientRect().height;
    return { len: J.length * h, w: Math.max(J.minWidth, J.width * h) };
  }
  function buildWater() {
    var el = document.createElement("div");
    el.id = "water";
    var jet = document.createElement("div");
    jet.className = "jet";
    jet.hidden = true;
    ["core", "burst"].forEach(function (k) { var i = document.createElement("i"); i.className = k; jet.appendChild(i); });
    el.appendChild(jet);
    field.closest(".screen").appendChild(el);
    water = { el: el, jet: jet, on: false, x: 0, y: 0, splashAt: -Infinity, timer: null };
  }
  function placeJet() {
    var f = water.el.getBoundingClientRect(), s = jetSize(), j = water.jet;
    j.style.left = (water.x - f.left) + "px";
    j.style.top = (water.y - f.top - s.w / 2) + "px";
    j.style.width = s.len + "px";
    j.style.height = s.w + "px";
    j.style.transform = "rotate(" + aim.shown + "rad)";
    j.classList.toggle("still", reducedMotion());
  }
  function particle(cls, x, y, dx, dy, size, seconds) {
    var d = document.createElement("i");
    d.className = cls;
    d.style.left = x + "px";
    d.style.top = y + "px";
    if (size) { d.style.width = d.style.height = size + "px"; }
    d.style.setProperty("--dx", dx + "px");
    d.style.setProperty("--dy", dy + "px");
    water.el.appendChild(d);
    setTimeout(function () { d.remove(); }, seconds * 1000);
  }
  // mist off the jet, and (every splashEvery seconds) a splash where it hits; never under reduced motion
  function puff() {
    if (!water.on || reducedMotion()) return;
    var J = ET.CONFIG.hoseJet, s = jetSize(), f = water.el.getBoundingClientRect(), x = water.x - f.left, y = water.y - f.top;
    var ux = Math.cos(aim.shown), uy = Math.sin(aim.shown);
    for (var i = 0; i < J.mist; i++) {
      var k = 0.15 + Math.random() * 0.8, side = (Math.random() < 0.5 ? -1 : 1) * (s.w * 0.6 + Math.random() * s.w * 1.6);
      particle("drop", x + ux * s.len * k, y + uy * s.len * k, -uy * side + ux * s.w, ux * side + uy * s.w, 0, 0.35);
    }
    var now = performance.now() / 1000;
    if (now - water.splashAt < J.splashEvery) return;
    water.splashAt = now;
    var ex = x + ux * s.len, ey = y + uy * s.len;
    particle("splash", ex, ey, 0, 0, s.w * 2.8, 0.3);
    for (var n = 0; n < 3; n++) {
      var a = Math.atan2(uy, ux) + Math.PI + (Math.random() - 0.5) * 2.4, r = s.w * (1.5 + Math.random() * 1.5);
      particle("drop", ex, ey, Math.cos(a) * r, Math.sin(a) * r, 0, 0.35);
    }
  }
  function sprayOn(x, y) {
    if (!water) buildWater();
    water.x = x; water.y = y;
    if (!water.on) {
      water.on = true;
      water.jet.hidden = false;
      water.timer = setInterval(puff, 60);   // it keeps blasting while the pointer is held still
      if (ET.audio) ET.audio.blast(true);
    }
    placeJet();
    puff();
  }
  function sprayOff() {
    if (!water || !water.on) return;
    water.on = false;
    water.jet.hidden = true;
    clearInterval(water.timer);
    if (ET.audio) ET.audio.blast(false);
  }

  /* Refinement 5 §5: the scary mom face. Each wave draws once whether it gets one (momFaceChance) and when
     (momFaceWindow, the player's seconds after the wave starts, read off the game's own clock so a pause holds
     it). When it comes it pops in for momFaceSeconds, either down from the top screen edge into the space over
     the HUD bar and the band above the board, left of the wall clock (Refinement 6 §3), or up out of the
     how-to panel. It is drawn inside a clipping box that IS that zone, so it can't reach a nest, a readout or a
     Command Line whatever the window size; it takes no pointer or keyboard, and it slides rather than flashes. */
  var mom = null, momAt = null, momShown = 0;
  function buildMom() {
    var screen = field.closest(".screen");
    var box = document.createElement("div");
    box.id = "mom";
    box.hidden = true;
    box.setAttribute("aria-hidden", "true");
    var face = document.createElement("div");
    face.className = "face";
    // Chat's playtest rulings (2026-10-02): the Mom kit's head, pose A (the cut-out of sm_org / hm_org); showMom() picks
    // which Mom by the wave, as her visit does (momSweetUntilWave)
    var head = document.createElement("img");
    head.alt = "";
    head.draggable = false;
    face.appendChild(head);
    box.appendChild(face);
    screen.appendChild(box);
    mom = { box: box, face: face, head: head, timer: null, wave: 1 };
  }
  function momZone(which) {
    var sr = mom.box.parentNode.getBoundingClientRect(), br = board.getBoundingClientRect();
    if (which === "panel") {
      var h = document.querySelector("#howto").getBoundingClientRect();
      return { left: h.left - sr.left, top: h.top - sr.top, width: h.width, height: h.height, from: "bottom" };
    }
    // the top: from the screen's top edge down to the board, left of the wall clock (top centre, Refinement 6 §3)
    var f = field.getBoundingClientRect(), c = wall.hm.closest(".wallclock").getBoundingClientRect();
    return { left: f.left - sr.left + 8, top: 0, width: Math.max(0, c.left - f.left - 16), height: br.top - sr.top, from: "top" };
  }
  function showMom(which) {
    var C = ET.CONFIG;
    var zones = C.momFaceZones;   // E23
    which = which || zones[Math.floor(Math.random() * zones.length)];
    var z = momZone(which);
    var size = Math.min(z.width * 0.9, which === "panel" ? z.height * 0.45 : z.height * 0.98);
    if (size < 40) return null;                                   // no room at this window size: skip it
    var b = mom.box;
    b.style.left = z.left + "px"; b.style.top = z.top + "px";
    b.style.width = z.width + "px"; b.style.height = z.height + "px";
    mom.face.style.width = mom.face.style.height = size + "px";
    mom.face.style.left = (z.width - size) / 2 + "px";
    mom.face.style.top = z.from === "top" ? "0" : "";
    mom.face.style.bottom = z.from === "bottom" ? "0" : "";
    b.style.setProperty("--mom", C.momFaceSeconds + "s");
    mom.kind = mom.wave <= C.momSweetUntilWave ? "sweet" : "creepy";
    var src = ET.mom.sources(mom.kind).filter(function (s) { return /--down@/.test(s); })[0];
    if (mom.head.getAttribute("src") !== src) mom.head.src = src;
    b.hidden = false;
    replay(mom.face, "face", "from-" + z.from);
    momShown++;
    if (ET.audio) ET.audio.hiss(C.momFaceSeconds, C.momFaceVolume);
    clearTimeout(mom.timer);
    mom.timer = setTimeout(function () { b.hidden = true; }, C.momFaceSeconds * 1000 + 50);
    return which;
  }

  /* Chat's playtest rulings (2026-10-02): one message above Time Warp's clock for every Command Line. It shows for
     errorSeconds; a repeat while it shows changes the words (if they differ) and restarts its time, and is never taken
     away and put back, so a run of rejected Enters holds it steady instead of flashing it. */
  var reject = { el: null, timer: null, shows: 0, log: [] };
  /* Where the words go. E60 (Chat, 2026-10-03): "pendulum", in the clock's pendulum window, below its face and above its
     sign. (Earlier: "above", centred just above the clock; "drop", moved down onto the clock's top where a readout was in
     the way, which covered the face and hands.) */
  function placeReject() {
    var el = reject.el;
    var fr = field.getBoundingClientRect(), art = warp.querySelector(".clock-art").getBoundingClientRect();
    var gap = 4, w = el.offsetWidth, h = el.offsetHeight;
    var left = (art.left + art.right) / 2 - w / 2, top = art.top - gap - h;
    var r = { left: left, right: left + w };
    el.style.left = (left - fr.left) + "px";
    el.style.top = (top - fr.top) + "px";
    el.style.fontSize = "";
    if (ET.CONFIG.rejectPlace === "pendulum") {
      // E60 (Chat, 2026-10-03): centred in the pendulum window, between the face's bottom and the sign's top; on a small
      // screen where the plate is taller than that gap, its type shrinks until it fits (never under 10 px)
      var face = warp.querySelector(".face").getBoundingClientRect(), sign = warp.querySelector(".plaque").getBoundingClientRect();
      var room = sign.top - face.bottom - 2 * gap, fs = parseFloat(getComputedStyle(el).fontSize);
      if (h > room && room > 0) { fs = Math.max(10, fs * room / h); el.style.fontSize = fs + "px"; w = el.offsetWidth; h = el.offsetHeight; }
      left = (art.left + art.right) / 2 - w / 2;
      top = face.bottom + gap + Math.max(0, (room - h) / 2);
      el.style.left = (left - fr.left) + "px";
      el.style.top = (top - fr.top) + "px";
      return;
    }
    if (ET.CONFIG.rejectPlace !== "drop") return;
    var keep = [];
    nests.forEach(function (n) {
      // every nest, in play or not: one may come into play while the words show
      [].forEach.call(n.readout.children, function (e) { keep.push(e.getBoundingClientRect()); });
      var s = n.svg.getBoundingClientRect();   // the egg and twigs (the art's empty margins left out), as the layout rig
      keep.push({ left: s.left + s.width * 0.1, right: s.right - s.width * 0.1, top: s.top + s.height * 0.2, bottom: s.bottom - s.height * 0.1 });
    });
    for (var pass = 0; pass < 8; pass++) {
      var moved = false;
      keep.forEach(function (k) {
        if (k.left < r.right && r.left < k.right && k.top < top + h && top < k.bottom) { top = k.bottom + gap; moved = true; }
      });
      if (!moved) break;
    }
    // never down onto the TIME WARP sign (its wobble stays clear of the words)
    top = Math.min(top, warp.querySelector(".plaque").getBoundingClientRect().top - gap - h);
    el.style.top = (top - fr.top) + "px";
  }
  /* Chat's ruling (2026-10-03): a "Patient Refused" bubble whose place on the nest's right shoulder would reach into
     Time Warp's sign or caption (the bottom row's inner nests, at 1440 × 900 and smaller) flips to the nest's other
     shoulder, away from the centre, still above its readout (the layout rig checks every nest at every size). */
  function warpWords() {
    var out = [warp.querySelector(".plaque").getBoundingClientRect()];
    var cap = warp.querySelector(".caption");
    if (cap.textContent) { var rg = document.createRange(); rg.selectNodeContents(cap); out.push.apply(out, rg.getClientRects()); }
    return out;
  }
  /* Chat (2026-10-03, items A and B): the H sign (now 1.4×: 1.6× doesn't fit at every size) or the bubble on the nest's
     right shoulder, its building (the hospital, or the house) on the other side of the egg. Either may swap shoulders
     where the right one is in the way; the building is skipped where its side has no room. Measured from the layout
     boxes (offsetLeft/Top), so a drop-in or a bounce under way doesn't move the answer, against every readout, every
     other nest, this egg, Time Warp's sign and caption, the hose tag, the trough, the Command Lines and the board's
     edges; never against another nest's marks (the layout rig checks every mix of them at every size). */
  function restRect(v, e) {
    var n = v.el.getBoundingClientRect(), l = n.left + e.offsetLeft, t = n.top + e.offsetTop;
    return { left: l, top: t, right: l + e.offsetWidth, bottom: t + e.offsetHeight };
  }
  function markKeepOff(v) {
    var out = [];
    nests.forEach(function (n) {
      [].forEach.call(n.readout.children, function (e) { out.push(e.getBoundingClientRect()); });
      var s = n.svg.getBoundingClientRect();
      if (n !== v) out.push({ left: s.left + s.width * 0.1, right: s.right - s.width * 0.1, top: s.top + s.height * 0.2, bottom: s.bottom - s.height * 0.1 });
      else out.push({ left: s.left + s.width * 0.315, right: s.right - s.width * 0.315, top: s.top + s.height * 0.22, bottom: s.top + s.height * 0.745 });   // its own egg, full grown
    });
    out = out.concat(warpWords());
    [].forEach.call(document.querySelectorAll("#hose-tag, #trough > *, .wallclock, #console .box"), function (e) { out.push(e.getBoundingClientRect()); });
    return out.filter(function (r) { return r.right - r.left > 0; });   // (hand-made boxes have no width field)
  }
  /* Where a nest's marks go for `kind` ("h": the H sign and the hospital; "r": the bubble and the house): the mark's
     shoulder, and whether the building fits. Decided from the layout boxes, so it is the same however often it's asked. */
  function decideMarks(v, kind) {
    var mark = kind === "h" ? v.hsign : v.refused, bld = kind === "h" ? v.hosp : v.house || null;
    var keep = markKeepOff(v), b = board.getBoundingClientRect();
    var clear = function (e) {
      var r = restRect(v, e);
      if (r.left < b.left - 1 || r.right > b.right + 1 || r.top < b.top - 1) return false;
      return !keep.some(function (k) { return k.left < r.right - 0.5 && r.left < k.right - 0.5 && k.top < r.bottom - 0.5 && r.top < k.bottom - 0.5; });
    };
    mark.classList.remove("flip");
    var flip = false;
    if (!clear(mark)) { mark.classList.add("flip"); flip = clear(mark); if (!flip) mark.classList.remove("flip"); }
    var fits = false;
    if (bld) { bld.classList.toggle("flip", flip); fits = clear(bld); }
    return { mark: mark, bld: bld, flip: flip, fits: fits };
  }
  function placeMarks(v, kind) {
    [v.hosp, v.house].forEach(function (o) { if (o && !o.hidden) o.hidden = true; });
    var own = kind === "h" ? v.hosp : v.house;
    if (own) { own.hidden = false; own.style.visibility = "hidden"; }   // laid out (a hidden box measures nothing), unseen
    var d = decideMarks(v, kind);
    if (d.bld) { d.bld.style.visibility = ""; d.bld.hidden = !d.fits; }
    v.markAt = kind + innerWidth + "x" + innerHeight;
  }
  /* For the AD note (2026-10-03): every spot a nest's marks can take, the H sign with its hospital and the bubble with
     its house, as decideMarks places them, measured once per window size. The elements are shown unseen for the
     measuring and put back as they were. */
  function markFootprint(n) {
    var key = innerWidth + "x" + innerHeight;
    if (n.fpAt === key) return n.fp;
    var els = [n.hsign, n.hosp, n.refused, n.house].filter(Boolean);
    var saved = els.map(function (e) { return [e, e.hidden, e.className, e.style.visibility]; });
    els.forEach(function (e) { e.hidden = false; e.style.visibility = "hidden"; });
    var out = [];
    ["h", "r"].forEach(function (kind) {
      var d = decideMarks(n, kind);
      out.push(restRect(n, d.mark));
      if (d.bld && d.fits) out.push(restRect(n, d.bld));
    });
    saved.forEach(function (x) { x[0].hidden = x[1]; x[0].className = x[2]; x[0].style.visibility = x[3]; });
    n.fp = out;
    n.fpAt = key;
    return out;
  }
  /* Chat (2026-10-03): an AD's "Clear @ HH:MM" note, "Clear @" in chunky cream lettering and HH:MM in the wall clock's
     own 7-segment face (the look Andrew approved 2026-09-23). */
  function fillNote(el, note) {
    var nt = "Clear @ " + hhmm(note.at);
    if (el.textContent === nt) return;
    el.textContent = "";
    var lbl = document.createElement("span"), hm = document.createElement("span");
    lbl.className = "led-text";
    lbl.textContent = "Clear @ ";
    hm.className = "led-hm";
    hm.textContent = hhmm(note.at);
    el.appendChild(lbl);
    el.appendChild(hm);
  }
  /* Its spot: stuck on beside its own nest, at the egg's height, tilted. The side away from the board's centre first,
     else the other, whichever is clear of every nest, readout, H sign and bubble (shown or not: both shoulders of every
     other nest), any other AD note already up, Time Warp's words, the hose tag and the trough; failing both, up on its
     own shoulder (outer, then inner), where an AD has no H sign or bubble; failing all, the outer side. */
  function noteKeepOff(v) {
    var out = [], hit = [];
    nests.forEach(function (n) {
      [].forEach.call(n.readout.children, function (e) { out.push(e.getBoundingClientRect()); });
      var s = n.svg.getBoundingClientRect();
      out.push({ left: s.left + s.width * 0.1, right: s.right - s.width * 0.1, top: s.top + s.height * 0.2, bottom: s.bottom - s.height * 0.1 });
      if (n === v) return;
      if (!n.note.hidden && n.noteAt) out.push(n.note.getBoundingClientRect());   // another AD's note already up
      // where the other nest's H sign or bubble and its building go, shown or not, exactly as the game places them
      // (2026-10-03; it was a rough box, which the H sign at 1.4× and the buildings outgrew)
      out.push.apply(out, markFootprint(n));
    });
    out = out.concat(warpWords());
    var tag = document.querySelector("#hose-tag");
    if (tag) out.push(tag.getBoundingClientRect());
    [].forEach.call(document.querySelectorAll("#trough > *"), function (e) { out.push(e.getBoundingClientRect()); });
    return out.filter(function (r) { return r.right - r.left > 0; });   // (hand-made boxes have no width field)
  }
  /* With no clear spot (two ADs side by side, one boxed in at the board's edge), a neighbour's note already up may move
     to its own other clear spot to make room; if it can't, nothing moves and this note takes its outer side. */
  function placeNote(v) {
    if (tryNote(v)) return;
    var others = nests.filter(function (u) { return u !== v && !u.note.hidden && u.noteAt; });
    for (var i = 0; i < others.length; i++) {
      var u = others[i], was = u.note.className;
      u.note.hidden = true;
      var ok = tryNote(v);
      u.note.hidden = false;
      if (ok && tryNote(u)) return;
      u.note.className = was;
    }
    tryNote(v, true);
  }
  function tryNote(v, force) {
    var el = v.note, b = board.getBoundingClientRect(), r0 = v.el.getBoundingClientRect();
    var outer = (r0.left + r0.right) / 2 < (b.left + b.right) / 2 ? "side-left" : "side-right";
    var inner = outer === "side-left" ? "side-right" : "side-left";
    // beside the egg, outer side then inner; then up on its own shoulder (an AD never has an H sign or a bubble there)
    var sides = [outer, inner, outer + " high", inner + " high"], keep = noteKeepOff(v), pick = null;
    var room = function (r) {   // how far the note could slide sideways before it met something (or the board's edge)
      var gap = Math.min(r.left - b.left, b.right - r.right);
      keep.forEach(function (k) {
        if (k.top >= r.bottom || r.top >= k.bottom) return;
        if (k.left >= r.right) gap = Math.min(gap, k.left - r.right);
        else if (k.right <= r.left) gap = Math.min(gap, r.left - k.right);
      });
      return gap;
    };
    var best = -1;
    for (var i = 0; i < sides.length; i++) {
      el.classList.remove("side-left", "side-right", "high");
      sides[i].split(" ").forEach(function (c) { el.classList.add(c); });
      var r = el.getBoundingClientRect();
      var clear = r.left >= b.left && r.right <= b.right && !keep.some(function (k) { return k.left < r.right && r.left < k.right && k.top < r.bottom && r.top < k.bottom; });
      if (!clear) continue;
      // 2026-10-03: beside the egg, both sides clear: the one with more room, so a neighbour boxed in at the board's edge
      // still has the gap between them; up on a shoulder only when neither side beside the egg is clear
      var gap = room(r);
      if (i < 2 && gap > best) { best = gap; pick = sides[i]; }
      if (i >= 2 && pick === null) { pick = sides[i]; break; }
      if (i === 1 && pick !== null) break;
    }
    if (pick === null && !force) return false;
    if (pick === null) pick = outer;
    el.classList.remove("side-left", "side-right", "high");
    pick.split(" ").forEach(function (c) { el.classList.add(c); });
    v.noteAt = innerWidth + "x" + innerHeight;
    return true;
  }
  function showReject(text) {
    var el = reject.el;
    if (!el) return;
    if (el.textContent !== text) el.textContent = text;
    if (el.hidden) { el.hidden = false; reject.shows++; reject.log.push(performance.now() / 1000); if (reject.log.length > 200) reject.log.splice(0, 100); }
    placeReject();   // (new words are a new width; it never goes off and on again)
    clearTimeout(reject.timer);
    reject.timer = setTimeout(function () { el.hidden = true; }, ET.CONFIG.errorSeconds * 1000);
  }

  ET.view = {
    build: function () {
      field = $("#field");
      board = $("#board");
      floor = ET.mess.createFloor();   // Refinement 3 §5: the board-wide mess, under every nest
      board.insertBefore(floor, board.firstChild);   // first, so it is under everything on the board
      hud = {
        wave: $("#hud-wave"), cavs: $("#hud-cavs"), pool: $("#hud-pool"),
        poolLabel: $("#hud-pool-label"), score: $("#hud-score")
      };
      banner = $("#banner");
      cleanup = { el: $("#cleanup"), result: $("#cleanup .result"), left: $("#cleanup .left") };
      popups = $("#popups");
      hud.poolLabel.textContent = ET.CONFIG.poolKey;
      wall = { hm: $("#wall-hm"), ss: $("#wall-ss") };
      warp = $("#warp");
      // Chat's playtest rulings (2026-10-02): a rejected Enter's words (ERROR, "Too Early!", "RCAV first!") show just above
      // the grandfather clock, where the player is looking, on a solid dark plate with a light outline
      reject.el = document.createElement("div");
      reject.el.id = "reject";
      reject.el.setAttribute("aria-live", "assertive");
      reject.el.hidden = true;
      field.appendChild(reject.el);   // over the board and the wave banner; placed at the clock by placeReject()
      // E27: the Time Accelerator's grandfather clock (⏳ placeholder art), in front of its plaque
      warp.insertBefore(ET.art.clockSvg(ET.CONFIG.warpFactor), warp.firstChild);
      hands = { hour: warp.querySelector(".hour"), minute: warp.querySelector(".minute"), face: warp.querySelector(".face") };
      resetHands();
      // E28: the sign and the caption under it
      sign = { el: warp.querySelector(".plaque"), lit: false, last: -Infinity, t0: null, was: false, log: [] };
      warp.querySelector(".caption").textContent = "All clocks " + ET.CONFIG.warpFactor + "× fast. Get your next RCAV ready!";
      tips = { ready: { el: $("#tip-ready"), nest: null, done: false } };

      var offs = offsets();
      for (var i = 0; i < ET.Game.COLS * ET.Game.ROWS; i++) {
        var col = i % ET.Game.COLS, row = Math.floor(i / ET.Game.COLS);
        var n = document.createElement("div");
        n.className = "nest";
        n.dataset.id = i;
        n.dataset.state = "idle";
        n.classList.add("inactive");   // Refinement 3 §8: every nest is on screen; not yet active, it's plain
        // padded inside the board, so an edge nest's readout never runs under the HUD or the Command Lines
        // Refinement 6 §3: the middle row moves out to the sides, leaving the centre of the board to the Time
        // Warp panel: two nests each side, less jitter so they keep their spacing
        n.style.left = (row === 1 ? MIDDLE_ROW[col] + offs[i].dx * 8 : 6 + (col + 0.5 + offs[i].dx) / ET.Game.COLS * 88) + "%";
        n.style.top = (7 + (row + 0.5 + offs[i].dy) / ET.Game.ROWS * 84) + "%";
        n.style.setProperty("--tilt", offs[i].tilt + "deg");

        var svg = ET.art.nestSvg();
        n.appendChild(svg);

        var ro = document.createElement("div");
        ro.className = "readout";
        ro.innerHTML = '<span class="unit">----</span><span class="code"></span><span class="clock">--:--</span>';
        n.appendChild(ro);

        // E55 (ruled): the hospital road sign, a white H on a blue rounded square on a stake (⏳ placeholder art until
        // Gemini's), dropped into the nest as the egg pops, on its shoulder clear of the egg and the readout
        var hsign = ET.art.hSignEl();
        hsign.hidden = true;
        n.appendChild(hsign);
        // Chat (2026-10-03): its hospital, on the other side of the egg (placeMarks picks the sides, or skips it)
        var hosp = ET.art.hospitalEl();
        hosp.hidden = true;
        n.appendChild(hosp);
        // Chat (2026-10-02): a VS refusal egg's "Patient Refused" bubble, in the same place above the timer
        var refused = ET.art.refusedEl();
        refused.hidden = true;
        n.appendChild(refused);
        // Chat (2026-10-03): an AD's "Clear @ HH:MM" note, stuck on beside the nest (placeNote picks the side)
        var note = document.createElement("div");
        note.className = "postit side-left";
        note.hidden = true;
        n.appendChild(note);

        // ⏳ placeholder: the frying pan (Refinement 2 §5)
        var pan = ET.art.panEl();
        n.appendChild(pan);

        var mess = ET.mess.create();
        n.appendChild(mess);

        board.appendChild(n);
        nests.push({
          el: n, svg: svg, readout: ro, mess: mess, hsign: hsign, hosp: hosp, refused: refused, note: note, pan: pan,
          unit: ro.querySelector(".unit"), code: ro.querySelector(".code"), clock: ro.querySelector(".clock"),
          egg: svg.querySelector(".egg"), cracks: svg.querySelectorAll(".crack")
        });
      }
      ET.pieces.build(board, floor);   // E38: the trough and the pieces, over the floor mess and behind the nests
      if (!ET.breaks.isReady()) ET.breaks.load();   // E26: the break stages' outlines, for placing shell fragments
      ET.view.bindWipe();
      buildHose();
      buildBackdrop();
      buildCords();
      buildLightning();
      buildMom();
      buildScare();
    },

    reset: function () {
      nests.forEach(function (v) {
        v.el.classList.add("inactive");
        v.el.classList.remove("unlock");
        v.el.dataset.state = "idle";
        v.el.classList.remove("bold", "asks", "hospital", "scurry", "lunge", "scare", "hop", "freeze", "leapt");
        delete v.el.dataset.hatch;
        delete v.el.dataset.alien;
        ET.aliens.clear(v.svg.querySelector(".creature"));
        ET.mess.clear(v.mess);
        v.hsign.hidden = true;
        v.refused.hidden = true;
        v.hosp.hidden = true;
        v.markAt = null;
        v.note.hidden = true;
        v.noteAt = null;
        v.mend = null;
        v.crackShown = 0;
        v.pan.className = "pan";
      });
      ET.mess.clear(floor);
      ET.pieces.reset();   // E38: a new game starts clean (between waves nothing is removed)
      resetAim();          // E44: the nozzle starts each game pointing up-left
      piecesAt = null;
      inCleanup = false;
      field.classList.remove("hose");
      banner.hidden = true;
      cleanup.el.hidden = true;
      warp.classList.remove("lit", "still");
      board.classList.remove("warp");
      resetHands();
      resetBackdrop();
      sign.was = false;
      sign.t0 = null;
      sign.lit = false;
      sign.last = -Infinity;
      sign.log = [];
      sign.el.classList.remove("on");
      resetTips();
      cords.list.forEach(function (c) { c.g.style.display = "none"; });
      popups.innerHTML = "";
      fixes.forEach(function (m) { m.rig.remove(); });
      fixes = [];
      noTypesShown = false;
      momAt = null;
      momShown = 0;
      clearTimeout(mom.timer);
      mom.box.hidden = true;
      hatching = [];
      endScare();
      if (ET.audio) ET.audio.unhush(0);   // a new game never starts with the music held out
    },

    render: function (snap) {
      var C = ET.CONFIG;
      hud.wave.textContent = snap.wave;
      hud.cavs.textContent = snap.resolved + "/" + snap.quota;
      hud.score.textContent = snap.score;
      var pips = "";
      for (var p = 0; p < C.poolCap; p++) pips += p < snap.pool ? "●" : "○";
      hud.pool.textContent = pips;
      wall.hm.textContent = hhmm(snap.wall);
      wall.ss.textContent = two(Math.floor(snap.wall) % 60);
      warp.classList.toggle("lit", !!snap.warp);
      stepHatches();   // the hatch's freeze and jump (Andrew, 2026-10-01)
      stepFixes(snap.time);   // E55: Mom's repairs
      turnHands(snap);
      paintSign(snap);
      paintBackdrop(snap);
      // E38: the pieces and drips move on the player's seconds, so a pause holds them (and the stream with them)
      streamStep(piecesAt === null || snap.time < piecesAt ? 0 : snap.time - piecesAt);
      ET.pieces.frame(piecesAt === null || snap.time < piecesAt ? 0 : snap.time - piecesAt, reducedMotion());
      piecesAt = snap.time;
      board.classList.toggle("warp", !!snap.warp);   // Refinement 5 §1: the nests with a running clock glow (E22)

      snap.nests.forEach(function (s) {
        var v = nests[s.id];
        var el = v.el;
        if (el.dataset.state !== s.state) el.dataset.state = s.state;
        // egg-laying's squeeze (Chat, 2026-09-25): once, as the bulge reaches the cord's last stretch (the lay's own
        // progress, so a pause holds it)
        if (s.state === "laying") {
          if (!v.squeezed && s.lay >= C.laySqueezeAt) { v.squeezed = true; if (ET.audio) ET.audio.squeeze(); }
        } else if (v.squeezed) v.squeezed = false;

        var shows = s.state === "laying" || s.state === "active" || s.state === "overtime";
        v.unit.textContent = shows ? s.unit : (C.unitAssignment === "per-nest" && s.unit ? s.unit : "----");
        v.code.textContent = shows ? s.code : "";
        v.clock.textContent = s.state === "active" || s.state === "overtime" ? clockText(s.elapsed) : "--:--";
        // Chat (2026-10-03): a VF's timer box says FUELING while it fuels (its clock runs on, hidden), then DONE in green
        // for vfDoneSeconds from the moment it goes bold, then the ordinary bold timer; its pump stands in the egg till DONE
        var vf = s.code === C.fuelType, fueling = vf && s.state === "active", done = vf && s.state === "overtime" && s.sinceBold < C.vfDoneSeconds;
        if (fueling) v.clock.textContent = "FUELING";
        else if (done) v.clock.textContent = "DONE";
        if (v.clock.classList.contains("fueling") !== fueling) v.clock.classList.toggle("fueling", fueling);
        if (v.clock.classList.contains("done") !== done) v.clock.classList.toggle("done", done);
        if (el.classList.contains("fueling") !== fueling) el.classList.toggle("fueling", fueling);
        if (el.classList.contains("fueled") !== done) el.classList.toggle("fueled", done);

        el.classList.toggle("bold", s.state === "overtime");
        el.classList.toggle("glow", !!snap.warp && (C.warpGlow === "running" ? (s.state === "active" || s.state === "overtime") : !el.classList.contains("inactive")));
        // E53: between the RCAV and the STR the empty type box takes the cyan "place me" pulse: the nest asks for its STR
        el.classList.toggle("asks", !!s.removed);
        // E55: the H sign, from the pop until the egg is cleared or hatches (each time it's shown, its drop plays: style.css)
        var signed = !!s.hospital && (s.state === "active" || s.state === "overtime");
        if (v.hsign.hidden === signed) v.hsign.hidden = !signed;
        // Chat (2026-10-02): a VS refusal egg's "Patient Refused" bubble, from the pop until its RCAV is accepted (a
        // cleared egg is "splat", so it goes then; a hatch takes it too). Other types get neither it nor the H sign.
        var refusing = !s.hospital && s.code === C.eggType && (s.state === "active" || s.state === "overtime") &&
          C.refusedBubble.on && snap.wave <= C.refusedBubble.untilWave;
        if (v.refused.hidden === refusing) v.refused.hidden = !refusing;
        // Chat (2026-10-03): the H sign or the bubble, and its building, placed once they show (and again after a resize),
        // never mid unlock pop (the scale)
        var markKind = signed ? "h" : refusing ? "r" : null;
        if (!markKind) { if (!v.hosp.hidden) v.hosp.hidden = true; v.markAt = null; }
        else if (v.markAt !== markKind + innerWidth + "x" + innerHeight && !el.classList.contains("unlock")) placeMarks(v, markKind);
        // Chat (2026-10-03): an AD's "Clear @ HH:MM" note, from the pop until the egg is cleared or hatches
        if (v.note.hidden === !!s.note) v.note.hidden = !s.note;
        if (s.note) {
          fillNote(v.note, s.note);
          if (v.noteAt !== innerWidth + "x" + innerHeight && !el.classList.contains("unlock")) placeNote(v);
        }

        drawCord(s.id, s, snap.time);

        var scale = C.eggMinScale + (1 - C.eggMinScale) * s.grow;
        var wobble = s.state === "overtime" && !reducedMotion() ? Math.sin(snap.time * 38) * (3 + 6 * s.crack) : 0;   // still under reduced motion
        var drop = eggDrop(s);
        if (el.classList.contains("popping") !== (drop !== null)) el.classList.toggle("popping", drop !== null);
        v.egg.setAttribute("transform", "translate(0 " + (20 + (drop || 0)).toFixed(2) + ") rotate(" + wobble.toFixed(2) + ") scale(" + scale.toFixed(3) + ") translate(0 -20)");
        var crack = v.mend ? mendedCrack(v, snap.time) : s.crack;   // E55: Mom closes the cracks
        if (!v.mend) v.crackShown = s.crack;
        var off = String(1 - crack);
        for (var k = 0; k < v.cracks.length; k++) v.cracks[k].style.strokeDashoffset = off;
        paintHints(v, s, crack);
      });

      drawLightning(snap);   // Refinement 6 §2
      // E30: the Command Lines' grey hint; E53: "CAV + unit + type" while a hospital egg waits for its STR
      if (ET.boxes && ET.boxes.hint) ET.boxes.hint(snap.nests.some(function (s) { return s.removed; }) ? "CAV + unit + type" : "RCAV + unit");
      paintTips(snap);       // E28

      // Refinement 5 §5: the scary mom face, when this wave's moment comes (never in cleanup or on pause)
      if (mom) mom.wave = snap.wave;
      if (momAt !== null && snap.phase === "wave" && snap.time >= momAt) {
        momAt = null;
        showMom();
      }

      // E5: the hose whenever the player wipes (the wipe underneath is unchanged)
      inCleanup = snap.phase === "cleanup";
      paintHose();

      if (snap.phase === "cleanup") {
        var left = String(Math.ceil(snap.cleanupLeft));
        if (cleanup.left.textContent !== left) cleanup.left.textContent = left;
      }
    },

    handle: function (events, game) {
      events.forEach(function (e) {
        var v = e.nest !== undefined ? nests[e.nest] : null;
        switch (e.type) {
          case "nest-unlocked":
            v.el.classList.remove("inactive", "unlock");
            void v.el.offsetWidth;
            v.el.classList.add("unlock");
            break;
          case "wave-start":
            cleanup.el.hidden = true;
            ET.pieces.layout();   // E38: the readouts the pieces pile round
            // Refinement 5 §5: at most one scary mom face this wave, and sometimes none
            var mw = ET.CONFIG.momFaceWindow;
            momAt = Math.random() < ET.CONFIG.momFaceChance ? game.time + mw[0] + Math.random() * (mw[1] - mw[0]) : null;
            showBanner([{ text: "WAVE " + e.wave, cls: "big" }, { text: e.quota + " CAVs" }], 1600);
            break;
          case "wave-end":
            momAt = null;   // a wave that ends before its moment gets none
            // Refinement 3 §3: the whole cleanup prompt, with the wave's result, goes in the banner up top
            var result = ["WAVE " + e.wave + " CLEAR"];
            if (e.perfect) result.push("PERFECT +" + e.bonus);
            if (e.poolGained) result.push(ET.CONFIG.poolKey + " +1");
            banner.hidden = true;
            cleanup.result.textContent = result.join(" · ");
            cleanup.left.textContent = "";
            cleanup.el.style.setProperty("--flashes", ET.CONFIG.cleanupFlashes);
            cleanup.el.style.setProperty("--flash-each", cleanupFlashSeconds() + "s");   // 🚨 through the guard
            replay(cleanup.el, "", "flash");
            cleanup.el.hidden = false;
            break;
          case "laying":
            v.el.classList.remove("scurry", "lunge");
            rollEgg(v);   // pilot art: this egg's mirror and eye, decided as it's laid
            break;
          case "active":
            // the pop: the egg is in and the clock starts (Refinement 3 §7); egg-laying's pop (Chat, 2026-09-25)
            v.el.classList.remove("scurry", "lunge");
            if (!v.rolled) rollEgg(v);
            if (ET.audio) ET.audio.pop();
            break;
          case "bold":
            // E28: wave 1's first egg to go bold gets the "Pink = ready!" tag, once a game
            if (game && game.wave === ET.CONFIG.tipsWave && !tips.ready.done) { tips.ready.nest = e.nest; tips.ready.done = true; }
            break;
          case "repaired":
            // E52/E55: window 1's points; no pan, no THONG, no splat: Mom repairs the egg and giggles
            momFix(v, e.mom, game ? game.time : 0);
            popup(v.el, "+" + e.points, "good");
            break;
          case "cleared":
            // the pan slams; a fast clear serves the egg ladder's next dish, a slow one only leaves mess
            slam(v);
            if (e.fast) dish(v.el, e.rung);
            if (ET.audio) { ET.audio.thong(); if (e.fast) ET.audio.ding(); }
            // E15 (ruled): a small splat on its own nest, the rest evenly across the whole board
            ET.mess.splatter(v.mess, ET.CONFIG.messBlobsOwn, ET.CONFIG.messOwnSize);
            fling(ET.CONFIG.messBlobsField);
            ET.pieces.clear(v.svg, e.tier);   // E38: shell pieces, and at break stages 3–5 the alien's parts
            ET.breaks.fill(v.svg.querySelector(".break"), e.tier);   // E26: the break stage left in the nest
            popup(v.el, "+" + e.points, "good");
            break;
          case "hatch":
            v.el.classList.remove("scurry", "lunge", "scare", "hop", "freeze", "leapt");
            void v.el.offsetWidth;
            v.el.style.setProperty("--dir", Math.random() < 0.5 ? -1 : 1);
            v.el.style.setProperty("--hatch", ET.CONFIG.escapeSeconds + "s");
            // E45: the game picks the set (cute or horror), the alien and its exit (Andrew, 2026-10-01: cute hops, horror scares)
            v.el.dataset.hatch = e.set;
            v.el.dataset.alien = e.alien;
            ET.aliens.fill(v.svg.querySelector(".creature"), e.alien);   // the puppet (Andrew's six sheets)
            v.el.classList.add(e.exit);
            startHatch(v, e.exit === "scare" ? "horror" : "cute");
            // E37 (Chat, 2026-09-25): a hatch shows the hatch only: no pan, no THONG, no clunk
            hud.pool.classList.remove("hit");
            void hud.pool.offsetWidth;
            hud.pool.classList.add("hit");
            break;
          case "idle":
            v.rolled = false;
            if (scare && scare.nest === v) endScare();
            v.el.classList.remove("scare", "hop", "freeze", "leapt");
            delete v.el.dataset.hatch;
            delete v.el.dataset.alien;
            ET.aliens.clear(v.svg.querySelector(".creature"));
            v.el.classList.remove("scurry", "lunge");
            break;
          case "no-types":
            if (!noTypesShown) {
              noTypesShown = true;
              showBanner([{ text: "BLANK DATASET", cls: "big" }, { text: "NO CAV TYPES LOADED" }], 0);
            }
            break;
          case "game-over":
            banner.hidden = true;
            cleanup.el.hidden = true;
            break;
        }
      });
    },

    hideBanner: function () { banner.hidden = true; },

    /* Click-and-drag wiping, across any nests the drag passes over. */
    bindWipe: function () {
      var last = {};   // where the drag last was on each canvas, so a stroke stays joined on every one it crosses
      function at(ev) {
        var hits = [];
        nests.forEach(function (v) {
          var r = v.mess.getBoundingClientRect();
          if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
            hits.push({ id: v.el.dataset.id, mess: v.mess, x: (ev.clientX - r.left) / r.width * ET.mess.W, y: (ev.clientY - r.top) / r.height * ET.mess.H, sx: ET.mess.W / r.width });
          }
        });
        // the board-wide floor mess, under the nests
        var fr = floor.getBoundingClientRect();
        if (ev.clientX >= fr.left && ev.clientX <= fr.right && ev.clientY >= fr.top && ev.clientY <= fr.bottom) {
          hits.push({ id: "floor", mess: floor, x: (ev.clientX - fr.left) / fr.width * floor.width, y: (ev.clientY - fr.top) / fr.height * floor.height, sx: floor.width / fr.width });
        }
        return hits;
      }
      function wipe(ev) {
        var br = board.getBoundingClientRect(), bx = ev.clientX - br.left, by = ev.clientY - br.top, prev = last.board || { x: bx, y: by };
        var mv = Math.hypot(bx - prev.x, by - prev.y), ux = mv ? (bx - prev.x) / mv : 0, uy = mv ? (by - prev.y) / mv : 0;
        var jet = paintHose();
        if (jet) { steer(ev.clientX, ev.clientY); sprayOn(ev.clientX, ev.clientY); }
        last.board = { x: bx, y: by };
        // Andrew, 2026-09-30: with the jet on, the WATER pushes the pieces, every frame (streamStep, from render): any
        // piece any part of the stream touches goes the way the water flows. Without a jet (the older hose switch
        // values) the drag itself pushes them the way it's going, as before.
        if (!jet) ET.pieces.spray(prev.x, prev.y, bx, by, 0, 0);
        // …and streaks and thins the liquid under it (E14's gunk on a nest, and the floor's)
        at(ev).forEach(function (h) {
          var from = last[h.id] || h;
          var before = ET.mess.streak(h.mess, from.x, from.y, h.x, h.y, ET.CONFIG.wipeRadius * h.sx);
          if (h.id === "floor") ET.pieces.washed(bx, by, ux, uy, before);
          last[h.id] = { x: h.x, y: h.y };
        });
      }
      field.addEventListener("pointerdown", function (ev) {
        if (!ET.view.canWipe()) return;
        try { field.setPointerCapture(ev.pointerId); } catch (e) { /* synthetic pointers have no capture */ }
        field.classList.add("wiping");
        last = {};
        aim.from = null;   // E44: the drag's direction is taken from where it starts
        wipe(ev);
        ev.preventDefault();
      });
      field.addEventListener("pointermove", function (ev) {
        if (!field.classList.contains("wiping")) return;
        wipe(ev);
      });
      function end(ev) {
        if (!field.classList.contains("wiping")) return;
        field.classList.remove("wiping");
        sprayOff();
        paintHose();
        last = {};
        if (ET.boxes) ET.boxes.focus();
      }
      field.addEventListener("pointerup", end);
      field.addEventListener("pointercancel", end);
      window.addEventListener("blur", end);   // the window losing focus pauses the game: the blast stops with it
      stopWipe = end;
    },
    /* For rigs: run the stream for dt seconds now, as a frame of play would (a synthetic drag has no frames in it). */
    stream: function (dt) { streamStep(dt); return !!(water && water.on); },
    /* For rigs (E44): the nozzle's aim, radians: where the drag last pointed it, and where it's drawn now. */
    aim: function () { return { want: aim.want, shown: aim.shown, nozzle: !!nozzle && !nozzle.hidden }; },
    /* E42: stop spraying now (a pause, or the play screen closing): the jet and its blast end with it. */
    stopSpray: function () { if (stopWipe) stopWipe(); sprayOff(); },

    canWipe: function () { return true; },

    /* Redraw the hose where the pointer last was (a screen change may have moved the board). */
    hose: function () { if (hose && hose.screen.hidden) ET.view.stopSpray(); drawHose(); return hose && !hose.svg.hidden ? hose.body.getAttribute("d") : null; },

    /* For rigs: drop `count` blobs evenly over the board, as a clear does. */
    fling: function (count) { fling(count); },

    /* For rigs: the scary mom face. `mom(which)` shows it now ("top" or "panel") and returns where it went;
       `momState()` gives this game's count so far and the next scheduled time. */
    mom: function (which) { return showMom(which); },
    /* For rigs: place every bubble that shows now (as the frame would once it shows). */
    placeBubbles: function () { ET.view.placeMarks(); },
    placeMarks: function () { nests.forEach(function (v) { if (!v.refused.hidden) placeMarks(v, "r"); else if (!v.hsign.hidden) placeMarks(v, "h"); }); },
    /* For rigs: fill a nest's AD note and place it, as a frame does once it shows. */
    fillNote: function (id, note) { var v = nests[id]; v.note.hidden = false; fillNote(v.note, note); placeNote(v); return v.note.className; },
    /* A rejected Enter's words, above Time Warp's clock (boxes.js calls it). */
    reject: function (text) { showReject(text); },
    /* For rigs: the message, whether it shows, and how many times (and when) it has come on. */
    rejectState: function () { return { text: reject.el ? reject.el.textContent : "", shown: !!reject.el && !reject.el.hidden, shows: reject.shows, log: reject.log.slice() }; },
    momState: function () { return { shown: momShown, at: momAt, visible: !mom.box.hidden, kind: mom.kind || null, src: mom.head.getAttribute("src") }; },

    /* For rigs: the Time Warp lightning: shown, how many links, its path, and when it last re-jagged (seconds). */
    lightning: function () { return { on: bolt.g.style.display !== "none", links: bolt.links, d: bolt.core.getAttribute("d"), log: bolt.log.slice() }; },

    /* For rigs: the grandfather clock's hands (degrees from 12) and whether its face shows the "5×". */
    clockHands: function () {
      return { hour: hands.at[0], minute: hands.at[1], fivex: getComputedStyle(warp.querySelector(".fivex")).display !== "none" };
    },

    /* For rigs: roll a nest's egg again (mirror and eye), as laying does. */
    rollEgg: function (id) { rollEgg(nests[id]); return { mirrored: nests[id].el.classList.contains("mirrored"), eye: nests[id].el.classList.contains("has-eye") }; },

    /* For rigs: the backdrop: its tint, the lights showing (id and opacity), when each started, and the veil. */
    backdrop: function () {
      return { tint: back.tint, bpm: track().bpm, dark: back.dark, darkLog: back.darkLog.slice(), starts: back.starts.slice(),
               lights: back.lights.map(function (l) { return { id: l.id, o: Number(l.el.style.opacity) }; }) };
    },

    /* For rigs: place the tag beside the wall clock, if shown (the layout rig shows it at its longest to measure it). */
    placeTips: function () {
      var wr = document.querySelector(".wallclock").getBoundingClientRect(), tr = field.querySelector("#fieldtop").getBoundingClientRect();
      if (!tips.ready.el.hidden) placeTip(wr, tr);
    },
    /* For rigs: Time Warp's sign (lit now, and its change log) and the first-game tag. */
    warpSign: function () { return { lit: sign.lit, log: sign.log.slice() }; },
    tips: function () {
      var t = tips.ready;
      return [{ shown: !t.el.hidden, text: t.el.textContent.trim(), nest: t.nest, done: t.done, line: t.line.style.display !== "none" ? t.line.getAttribute("d") : null }];
    },
    /* For rigs (E55): Mom's repairs showing now: which nest, which Mom, and whether she has giggled yet. */
    momFixes: function () { return fixes.map(function (m) { return { nest: Number(m.v.el.dataset.id), kind: m.kind, giggled: m.giggled, u: m.u, from: m.edge, fallback: m.fallback || null, drool: m.drool ? { land: m.drool.land, splat: m.splat || null } : null }; }); },
    /* For rigs (Mom kit): bring Mom to nest `id` now, as the STR would (her visit, its drool and splat), on the game's
       seconds. Returns how many visits are showing. */
    momVisit: function (id, kind) { momFix(nests[id], kind || "creepy", momNow); return fixes.length; },
    /* For rigs (Mom kit): where she'd go for nest `id` now, without showing her: the edge (or the fallback), her
       head's box upright and turned, each tentacle's line, and everything she must stay clear of (field px). */
    momPlan: function (id, kind) {
      var v = nests[id], f = field.getBoundingClientRect(), lay = momLayout(v, kind || "sweet"), G = ET.mom.geometry(lay);
      return { lay: lay, from: lay.from, fallback: lay.fallback || null, tilt: lay.tilt, clip: lay.clip, headW: G.hw, headH: G.hh,
        head: { l: lay.head.x - G.hw / 2, t: lay.head.y - G.hh / 2, r: lay.head.x + G.hw / 2, b: lay.head.y + G.hh / 2 },
        chin: G.chin, tube: G.tube, tents: G.tents, obstacles: momObstacles(v, f), nest: fieldRect(v.el, f), readout: fieldRect(v.readout, f),
        drool: kind === "creepy" ? momDroolPlan(lay, v, f, momObstacles(v, f)) : null, floor: fieldRect(floor, f) };
    },

    /* For rigs: a nest's cord, if one is showing. */
    cord: function (id) {
      var c = cords.list[id];
      return c.g.style.display === "none" ? null : { d: c.path.getAttribute("d"), egg: c.egg.style.display !== "none", bulge: c.bulge.style.display !== "none" };
    },

    /* For rigs: a nest's view pieces, and the board-wide floor mess. */
    nest: function (id) { return nests[id]; },
    floor: function () { return floor; }
  };
})(window);

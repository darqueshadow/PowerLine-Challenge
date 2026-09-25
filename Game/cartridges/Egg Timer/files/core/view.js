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

  function noteText(note) {
    return note.kind === "clock" ? "Clear @ " + hhmm(note.at) : note.minutes + " min";
  }

  /* Fill an AD note. The clock kind is two spans: "Clear @ " in chunky rounded cream lettering and HH:MM in the
     wall clock's own 7-segment face; its text reads the same as noteText's. */
  function fillNote(el, note) {
    var nt = noteText(note);
    if (el.textContent === nt) return;
    if (note.kind !== "clock") { el.textContent = nt; return; }
    el.textContent = "";
    var lbl = document.createElement("span"), hm = document.createElement("span");
    lbl.className = "led-text";
    lbl.textContent = "Clear @ ";
    hm.className = "led-hm";
    hm.textContent = hhmm(note.at);
    el.appendChild(lbl);
    el.appendChild(hm);
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

  /* ⏳ placeholder: the hose body (Hose ruling, 2026-09-22). The nozzle is the cursor itself (CSS);
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
    document.addEventListener("pointermove", function (ev) {
      lastPointer = { x: ev.clientX, y: ev.clientY };
      drawHose();
    }, true);
    document.documentElement.addEventListener("pointerleave", function () { svg.hidden = true; });
    window.addEventListener("resize", drawHose);
  }
  function drawHose() {
    if (!hose || !lastPointer || hose.screen.hidden) { if (hose) hose.svg.hidden = true; return; }
    var sr = hose.screen.getBoundingClientRect(), f = field.getBoundingClientRect();
    var w = ET.CONFIG.hoseWidth;
    // the spigot: fixed on the board's bottom edge, poking up from under the Command Lines
    var sx = f.left - sr.left + f.width * ET.CONFIG.hoseSpigotX, sy = f.bottom - sr.top;
    // the back of the nozzle cursor (its tip is the hotspot, the body runs down-right)
    var ex = lastPointer.x - sr.left + 24, ey = lastPointer.y - sr.top + 24;
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
     while the clock runs. It lives in the hose's layer, UNDER the HUD, the nests and every piece of text,
     so it never hides another nest's readout; it's drawn from the snapshot, so it freezes on pause. */
  var cords = null;
  function buildCords() {
    var screen = field.closest(".screen");
    var svg = document.createElementNS(NS, "svg");
    svg.id = "cords";
    svg.setAttribute("aria-hidden", "true");
    screen.insertBefore(svg, screen.firstChild);
    cords = { svg: svg, screen: screen, list: [] };
    svg.style.setProperty("--cord", ET.CONFIG.cordWidth + "px");
    function mk(g, tag, cls) { var e = document.createElementNS(NS, tag); e.setAttribute("class", cls); g.appendChild(e); return e; }
    for (var i = 0; i < nests.length; i++) {
      var g = document.createElementNS(NS, "g");
      g.setAttribute("class", "cord");
      // Refinement 6 §4: a thick cord, striped blood red and purple and deeply ribbed: four strokes on one line
      // (a dark outline, the red, purple stripes, dark rib bands across it)
      var lines = [mk(g, "path", "cord-outline"), mk(g, "path", "cord-line"), mk(g, "path", "cord-stripes"), mk(g, "path", "cord-ribs")];
      var c = { g: g, path: lines[1], lines: lines, bulge: mk(g, "ellipse", "cord-bulge"), egg: mk(g, "ellipse", "cord-egg") };
      svg.appendChild(g);
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
    var show = !s.hidden && (s.lay !== null || s.retract !== null);   // E16 (ruled): VF has no egg to lay
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
    if (s.state !== "laying" || s.lay === null || s.hidden) return null;
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
    // E28: the first-game tags' leader lines, in the same layer: under every readout, taking no input
    ["ready", "clock"].forEach(function (k) {
      var p = document.createElementNS(NS, "path");
      p.setAttribute("class", "leader");
      p.style.display = "none";
      cords.svg.appendChild(p);
      tips[k].line = p;
    });
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
  function paintHints(v, s) {
    var at = ET.CONFIG.eggHintsAt, on = s.state === "overtime";
    for (var h in at) {
      var show = on && s.crack >= at[h] && (h !== "hint-eye" || v.el.classList.contains("has-eye"));
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

  /* E28: wave 1's first-game tags. The first egg to go bold gets "Pink = ready! Type RCAV <unit>" and the first
     "Clear @" note gets "Check the wall clock", each once a game, for as long as that CAV runs. They sit either side of
     the wall clock, in the band above the board, so they never cover a nest or a readout; a thin leader line (in the
     cord's layer, under every readout) runs to the egg or the note. Nothing flashes. */
  function paintTips(snap) {
    var C = ET.CONFIG;
    if (snap.wave === C.tipsWave && !tips.clock.done) {
      var noted = snap.nests.filter(function (s) { return s.note && s.note.kind === "clock" && (s.state === "active" || s.state === "overtime"); })[0];
      if (noted) { tips.clock.nest = noted.id; tips.clock.done = true; }
    }
    var wr = document.querySelector(".wallclock").getBoundingClientRect(), tr = field.querySelector("#fieldtop").getBoundingClientRect();
    ["ready", "clock"].forEach(function (k) {
      var tip = tips[k], s = tip.nest === null ? null : snap.nests.filter(function (x) { return x.id === tip.nest; })[0];   // the snapshot lists nests in play only
      var live = !!s && (k === "ready" ? s.state === "overtime" : !!s.note && (s.state === "active" || s.state === "overtime"));
      if (!live) {
        tip.nest = null;
        tip.el.hidden = true;
        tip.line.style.display = "none";
        return;
      }
      if (k === "ready") {
        var text = "Pink = ready! Type RCAV " + s.unit;
        if (tip.el.textContent !== text) tip.el.textContent = text;
      }
      tip.el.hidden = false;
      placeTip(k, wr, tr);
      var sr = cords.screen.getBoundingClientRect(), a = tip.el.getBoundingClientRect();
      var target = (k === "ready" ? nests[tip.nest].el.querySelector(".egg") : nests[tip.nest].note).getBoundingClientRect();
      var x0 = (k === "ready" ? a.left + a.width * 0.3 : a.left + a.width * 0.7) - sr.left, y0 = a.bottom - sr.top;
      var x1 = target.left + target.width / 2 - sr.left, y1 = target.top + target.height / 2 - sr.top;
      tip.line.setAttribute("d", "M" + x0.toFixed(1) + " " + y0.toFixed(1) + " L" + x1.toFixed(1) + " " + y1.toFixed(1));
      tip.line.style.display = "";
    });
  }
  /* A tag either side of the wall clock: "ready" on its left, "clock" on its right. */
  function placeTip(k, wr, tr) {
    var el = tips[k].el;
    if (k === "ready") { el.style.left = ""; el.style.right = (tr.right - wr.left + 14).toFixed(1) + "px"; }
    else { el.style.right = ""; el.style.left = (wr.right - tr.left + 14).toFixed(1) + "px"; }
  }
  function resetTips() {
    ["ready", "clock"].forEach(function (k) {
      tips[k].nest = null;
      tips[k].done = false;
      tips[k].el.hidden = true;
      if (tips[k].line) tips[k].line.style.display = "none";
    });
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

  /* ⏳ placeholder: water from the hose while a drag is wiping. */
  var water = null;
  function spray(x, y) {
    if (!water) {   // Refinement 4 §2: the water draws with the hose, above the board
      var screen = field.closest(".screen");
      water = document.createElement("div");
      water.id = "water";
      screen.appendChild(water);
    }
    var f = water.getBoundingClientRect();
    for (var i = 0; i < 3; i++) {
      var d = document.createElement("i");
      d.className = "drop";
      d.style.left = (x - f.left + (Math.random() * 16 - 8)) + "px";
      d.style.top = (y - f.top + (Math.random() * 10 - 5)) + "px";
      d.style.setProperty("--dx", (Math.random() * 30 - 15) + "px");
      water.appendChild(d);
      setTimeout(function (el) { el.remove(); }.bind(null, d), 450);
    }
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
    face.appendChild(ET.art.momFaceSvg());
    box.appendChild(face);
    screen.appendChild(box);
    mom = { box: box, face: face, timer: null };
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
    b.hidden = false;
    replay(mom.face, "face", "from-" + z.from);
    momShown++;
    if (ET.audio) ET.audio.hiss(C.momFaceSeconds, C.momFaceVolume);
    clearTimeout(mom.timer);
    mom.timer = setTimeout(function () { b.hidden = true; }, C.momFaceSeconds * 1000 + 50);
    return which;
  }

  ET.view = {
    fillNote: fillNote,   // the layout rig fills every note at its widest the same way
    build: function () {
      field = $("#field");
      board = $("#board");
      floor = ET.mess.createFloor();   // Refinement 3 §5: the board-wide mess, under every nest
      board.insertBefore(floor, board.firstChild);   // first, so it is under everything on the board
      hud = {
        wave: $("#hud-wave"), cavs: $("#hud-cavs"), pool: $("#hud-pool"),
        poolLabel: $("#hud-pool-label"), score: $("#hud-score"), mode: $("#hud-mode")
      };
      banner = $("#banner");
      cleanup = { el: $("#cleanup"), result: $("#cleanup .result"), left: $("#cleanup .left") };
      popups = $("#popups");
      hud.poolLabel.textContent = ET.CONFIG.poolKey;
      wall = { hm: $("#wall-hm"), ss: $("#wall-ss") };
      warp = $("#warp");
      // E27: the Time Accelerator's grandfather clock (⏳ placeholder art), in front of its plaque
      warp.insertBefore(ET.art.clockSvg(ET.CONFIG.warpFactor), warp.firstChild);
      hands = { hour: warp.querySelector(".hour"), minute: warp.querySelector(".minute"), face: warp.querySelector(".face") };
      resetHands();
      // E28: the sign and the caption under it
      sign = { el: warp.querySelector(".plaque"), lit: false, last: -Infinity, t0: null, was: false, log: [] };
      warp.querySelector(".caption").textContent = "All clocks " + ET.CONFIG.warpFactor + "× fast. Get your next RCAV ready!";
      tips = { ready: { el: $("#tip-ready"), nest: null, done: false }, clock: { el: $("#tip-clock"), nest: null, done: false } };

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

        // ⏳ placeholder look: the AD post-it (Timer Refinement §4)
        var note = document.createElement("div");
        note.className = "postit";
        note.hidden = true;
        n.appendChild(note);

        // ⏳ placeholder look: VF's "Clear Fueling" bubble (Timer Refinement §5)
        var bubble = document.createElement("div");
        bubble.className = "bubble";
        bubble.textContent = "Clear Fueling";
        bubble.hidden = true;
        n.appendChild(bubble);

        // ⏳ placeholder: the frying pan (Refinement 2 §5)
        var pan = ET.art.panEl();
        n.appendChild(pan);

        var mess = ET.mess.create();
        n.appendChild(mess);

        board.appendChild(n);
        nests.push({
          el: n, svg: svg, readout: ro, mess: mess, note: note, bubble: bubble, pan: pan,
          unit: ro.querySelector(".unit"), code: ro.querySelector(".code"), clock: ro.querySelector(".clock"),
          egg: svg.querySelector(".egg"), cracks: svg.querySelectorAll(".crack")
        });
      }
      ET.view.bindWipe();
      buildHose();
      buildBackdrop();
      buildCords();
      buildLightning();
      buildMom();
    },

    reset: function () {
      nests.forEach(function (v) {
        v.el.classList.add("inactive");
        v.el.classList.remove("unlock");
        v.el.dataset.state = "idle";
        v.el.classList.remove("bold", "hide-readout", "hide-clock", "hide-egg", "scurry", "lunge");
        ET.mess.clear(v.mess);
        v.note.hidden = true;
        v.bubble.hidden = true;
        v.pan.className = "pan";
      });
      ET.mess.clear(floor);
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
      noTypesShown = false;
      momAt = null;
      momShown = 0;
      clearTimeout(mom.timer);
      mom.box.hidden = true;
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
      turnHands(snap);
      paintSign(snap);
      paintBackdrop(snap);
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

        var shows = s.state === "trigger" || s.state === "laying" || s.state === "active" || s.state === "overtime";
        v.unit.textContent = shows ? s.unit : (C.unitAssignment === "per-nest" && s.unit ? s.unit : "----");
        v.code.textContent = shows ? s.code : "";
        v.clock.textContent = s.state === "active" || s.state === "overtime" ? clockText(s.elapsed) : "--:--";

        el.classList.toggle("bold", s.state === "overtime");
        el.classList.toggle("glow", !!snap.warp && (C.warpGlow === "running" ? (s.state === "active" || s.state === "overtime") : !el.classList.contains("inactive")));
        // C15(b) (ruled): a running VF hides its egg and its timer until "Clear Fuel"; the unit and "VF" stay
        el.classList.toggle("hide-egg", s.hidden);
        el.classList.toggle("hide-readout", s.hidden && C.vfHides === "readout");
        el.classList.toggle("hide-clock", s.hidden && C.vfHides === "timer");

        v.note.hidden = !s.note;
        if (s.note) {
          fillNote(v.note, s.note);
          // two looks (2026-09-23): the clock time as the wall clock, the minutes as a hand-lettered post-it
          v.note.classList.toggle("at-clock", s.note.kind === "clock");
          v.note.classList.toggle("minutes", s.note.kind !== "clock");
        }

        drawCord(s.id, s, snap.time);

        var scale = C.eggMinScale + (1 - C.eggMinScale) * s.grow;
        var wobble = s.state === "overtime" && !reducedMotion() ? Math.sin(snap.time * 38) * (3 + 6 * s.crack) : 0;   // still under reduced motion
        var drop = eggDrop(s);
        if (el.classList.contains("popping") !== (drop !== null)) el.classList.toggle("popping", drop !== null);
        v.egg.setAttribute("transform", "translate(0 " + (20 + (drop || 0)).toFixed(2) + ") rotate(" + wobble.toFixed(2) + ") scale(" + scale.toFixed(3) + ") translate(0 -20)");
        var off = String(1 - s.crack);
        for (var k = 0; k < v.cracks.length; k++) v.cracks[k].style.strokeDashoffset = off;
        paintHints(v, s);
      });

      drawLightning(snap);   // Refinement 6 §2
      // E30: the Command Lines' grey hint: placing while a nest waits, clearing otherwise
      if (ET.boxes && ET.boxes.hint) ET.boxes.hint(snap.nests.some(function (s) { return s.state === "trigger"; }) ? "CAV + unit + type" : "RCAV + unit");
      paintTips(snap);       // E28

      // Refinement 5 §5: the scary mom face, when this wave's moment comes (never in cleanup or on pause)
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
          case "trigger":
            v.el.classList.remove("scurry", "lunge");
            break;
          case "laying":
            v.el.classList.remove("scurry", "lunge");
            rollEgg(v);   // pilot art: this egg's mirror and eye, decided as it's laid
            break;
          case "active":
            // the pop: the egg is in and the clock starts (Refinement 3 §7); egg-laying's pop (Chat, 2026-09-25), not for VF
            v.el.classList.remove("scurry", "lunge");
            if (!v.rolled) rollEgg(v);   // a VF lays no egg on a cord (E16): its egg is decided here
            if (ET.audio && !(game && game.nests[e.nest].type && game.nests[e.nest].type.hiddenUntilTrigger)) ET.audio.pop();
            break;
          case "bold":
            // E28: wave 1's first egg to go bold gets the "Pink = ready!" tag, once a game
            if (game && game.wave === ET.CONFIG.tipsWave && !tips.ready.done) { tips.ready.nest = e.nest; tips.ready.done = true; }
            // VF is the only type with a pop-up: "Clear Fueling" as its clock and cracking egg appear
            var nest = game && game.nests[e.nest];
            if (nest && nest.type && nest.type.hiddenUntilTrigger) {
              v.bubble.hidden = false;
              v.bubble.classList.remove("show");
              void v.bubble.offsetWidth;
              v.bubble.style.animationDuration = ET.CONFIG.vfBubbleSeconds + "s";
              v.bubble.classList.add("show");
            }
            break;
          case "placed":
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
            popup(v.el, "+" + e.points, "good");
            break;
          case "hatch":
            v.el.classList.remove("scurry", "lunge");
            void v.el.offsetWidth;
            v.el.style.setProperty("--dir", Math.random() < 0.5 ? -1 : 1);
            v.el.classList.add(ET.art.FLOURISHES[Math.floor(Math.random() * ET.art.FLOURISHES.length)]);
            // E37 (Chat, 2026-09-25): a hatch shows the hatch only: no pan, no THONG, no clunk
            hud.pool.classList.remove("hit");
            void hud.pool.offsetWidth;
            hud.pool.classList.add("hit");
            break;
          case "idle":
            v.rolled = false;
            v.bubble.hidden = true;
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
        if (paintHose()) spray(ev.clientX, ev.clientY);
        at(ev).forEach(function (h) {
          var from = last[h.id] || h;
          ET.mess.wipe(h.mess, from.x, from.y, h.x, h.y, ET.CONFIG.wipeRadius * h.sx);
          last[h.id] = { x: h.x, y: h.y };
        });
      }
      field.addEventListener("pointerdown", function (ev) {
        if (!ET.view.canWipe()) return;
        try { field.setPointerCapture(ev.pointerId); } catch (e) { /* synthetic pointers have no capture */ }
        field.classList.add("wiping");
        last = {};
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
        paintHose();
        last = {};
        if (ET.boxes) ET.boxes.focus();
      }
      field.addEventListener("pointerup", end);
      field.addEventListener("pointercancel", end);
    },

    canWipe: function () { return true; },

    /* Redraw the hose where the pointer last was (a screen change may have moved the board). */
    hose: function () { drawHose(); return hose && !hose.svg.hidden ? hose.body.getAttribute("d") : null; },

    /* For rigs: drop `count` blobs evenly over the board, as a clear does. */
    fling: function (count) { fling(count); },

    /* For rigs: the scary mom face. `mom(which)` shows it now ("top" or "panel") and returns where it went;
       `momState()` gives this game's count so far and the next scheduled time. */
    mom: function (which) { return showMom(which); },
    momState: function () { return { shown: momShown, at: momAt, visible: !mom.box.hidden }; },

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

    /* For rigs: Time Warp's sign (lit now, and its change log) and the first-game tags. */
    /* For rigs: place any shown tag beside the wall clock (the layout rig shows both at their longest to measure them). */
    placeTips: function () {
      var wr = document.querySelector(".wallclock").getBoundingClientRect(), tr = field.querySelector("#fieldtop").getBoundingClientRect();
      ["ready", "clock"].forEach(function (k) { if (!tips[k].el.hidden) placeTip(k, wr, tr); });
    },
    warpSign: function () { return { lit: sign.lit, log: sign.log.slice() }; },
    tips: function () {
      return ["ready", "clock"].map(function (k) {
        var t = tips[k];
        return { shown: !t.el.hidden, text: t.el.textContent.trim(), nest: t.nest, done: t.done, line: t.line.style.display !== "none" ? t.line.getAttribute("d") : null };
      });
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

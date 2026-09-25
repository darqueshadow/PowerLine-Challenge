/* ===========================================================================
   EGG TIMER — PIECES, THE HOSE'S PUSH AND THE TROUGH (E38, Chat, 2026-09-25)
   Every clear leaves shell pieces cut from the approved egg picture; a slow
   clear (break stage 3–5) also scatters the pilot's alien parts (antenna,
   clawed leg, tentacle and goo, eye), more the slower it was. Pieces never fade
   or vanish on their own and never cap: they pile up, wave over wave, until the
   hose washes them into the trough, which carries them to the sink's drain.

   Where they live: two canvases on the board, behind the nests and eggs (so a
   piece passing a nest goes behind it) and over the floor mess. Resting pieces
   are baked into the lower canvas and cost nothing a frame; a piece the spray
   touches comes back to life on the upper one. The readouts are walls pieces
   pile around; the board's top edge stops them; the left, right and bottom
   edges are the trough.

   Positions are board pixels; every speed and size is in board heights, so a
   window resize keeps the same game. It all runs on the player's seconds, so a
   pause holds it. No DOM in game.js: this file is the view's.
   ========================================================================= */
(function (root) {
  var ET = (root.ET = root.ET || {});

  var board = null, rest = null, live = null, trough = null, floor = null;
  var W = 0, H = 0, T = 0, drainX = 0, dpr = 1;
  var walls = [];                 // the readouts, board px, padded
  var pieces = [];                // every piece on the board: resting, live or in the trough
  var drips = [], trickles = [];
  var grid = {}, CELL = 64;       // resting pieces by cell, to unbake one without redrawing them all
  var art = { ready: false, egg: null, eggBox: null, parts: {} };
  var outline = "#1a0d2e";
  var stats = { drained: 0, eyesDrained: 0, entered: 0 };
  var PARTS = { antenna: "art/egg--hint-3@2x.png", leg: "art/egg--hint-4@2x.png", tentacle: "art/egg--hint-5@2x.png", eye: "art/egg--hint-eye@2x.png" };
  var SLOT_W = 404;               // the pilot layers are full-slot canvases, 404 px across the nest's 120-unit viewBox

  /* ---------------------------------------------------------------- art */
  function load(src) {
    return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = src; });
  }
  // the box round a picture's opaque pixels, in its own pixels
  function opaqueBox(img) {
    var c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    var g = c.getContext("2d"); g.drawImage(img, 0, 0);
    var d = g.getImageData(0, 0, c.width, c.height).data, x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (var y = 0; y < c.height; y++) for (var x = 0; x < c.width; x++) {
      if (d[(y * c.width + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, data: d, cw: c.width };
  }
  function crop(img, b) {
    var c = document.createElement("canvas"); c.width = b.w; c.height = b.h;
    c.getContext("2d").drawImage(img, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
    return c;
  }
  function loadArt() {
    var keys = Object.keys(PARTS);
    Promise.all([load("art/egg--shell@2x.png")].concat(keys.map(function (k) { return load(PARTS[k]); }))).then(function (imgs) {
      if (!imgs[0]) return;
      art.egg = imgs[0];
      art.eggBox = opaqueBox(imgs[0]);
      keys.forEach(function (k, i) { if (imgs[i + 1]) art.parts[k] = crop(imgs[i + 1], opaqueBox(imgs[i + 1])); });
      art.ready = true;
    });
  }

  /* One shell piece: a jagged polygon cut out of the egg picture, its cut edges drawn in the cartoon outline. */
  function shard() {
    var b = art.eggBox, rnd = Math.random;
    var cx, cy, tries = 0;
    do { cx = b.x + rnd() * b.w; cy = b.y + rnd() * b.h; tries++; }
    while (tries < 30 && b.data[(Math.floor(cy) * b.cw + Math.floor(cx)) * 4 + 3] < 128);
    var n = 5 + Math.floor(rnd() * 3), rad = b.w * (0.16 + rnd() * 0.12), pts = [];
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.6, rr = rad * (0.55 + rnd() * 0.6);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    var x0 = Math.floor(Math.min.apply(null, pts.map(function (p) { return p[0]; }))) - 2;
    var y0 = Math.floor(Math.min.apply(null, pts.map(function (p) { return p[1]; }))) - 2;
    var x1 = Math.ceil(Math.max.apply(null, pts.map(function (p) { return p[0]; }))) + 2;
    var y1 = Math.ceil(Math.max.apply(null, pts.map(function (p) { return p[1]; }))) + 2;
    var c = document.createElement("canvas"); c.width = x1 - x0; c.height = y1 - y0;
    var g = c.getContext("2d");
    g.translate(-x0, -y0);
    g.beginPath(); pts.forEach(function (p, k) { if (k) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath();
    g.save(); g.clip(); g.drawImage(art.egg, 0, 0); g.restore();
    g.lineWidth = 5; g.strokeStyle = outline; g.lineJoin = "round"; g.stroke();
    g.globalCompositeOperation = "destination-in";   // keep only what was egg: the cut edges show, nothing outside it
    g.drawImage(art.egg, 0, 0);
    return c;
  }

  /* ---------------------------------------------------------------- layout */
  /* Where an element sits on the board, by layout, not by its drawn box: a nest scales in from 20% as it unlocks
     and tilts, and a measurement mid-animation would make every piece or wall tiny. */
  function boardBox(el) {
    var x = 0, y = 0, e = el;
    while (e && e !== board) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
    if (e !== board) { var r = el.getBoundingClientRect(), b = board.getBoundingClientRect(); return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height }; }
    return { x: x, y: y, w: el.offsetWidth, h: el.offsetHeight };
  }
  function sizeCanvas(c) {
    c.width = Math.max(1, Math.round(W * dpr)); c.height = Math.max(1, Math.round(H * dpr));
    c.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function layout() {
    if (!board) return;
    var r = board.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    var nw = r.width, nh = r.height, ndpr = root.devicePixelRatio || 1;
    if (W && H && (nw !== W || nh !== H)) {
      var fx = nw / W, fy = nh / H;
      pieces.forEach(function (p) { p.x *= fx; p.y *= fy; });
      drips.forEach(function (d) { d.x *= fx; d.y *= fy; d.end *= fy; });
    }
    var changed = nw !== W || nh !== H || ndpr !== dpr;
    W = nw; H = nh; dpr = ndpr;
    T = trough ? trough.bottom.getBoundingClientRect().height : 8;
    var sink = document.querySelector("#hose-tag .sink");
    var sr = sink ? sink.getBoundingClientRect() : null;
    drainX = sr && sr.width ? sr.left + sr.width / 2 - r.left : W * ET.CONFIG.hoseSpigotX;
    if (trough) trough.el.style.setProperty("--drain", drainX + "px");
    var pad = ET.CONFIG.pieces.wallPad * H;
    walls = Array.prototype.map.call(board.querySelectorAll(".nest .readout"), function (e) {
      var q = boardBox(e);
      return { x0: q.x - pad, y0: q.y - pad, x1: q.x + q.w + pad, y1: q.y + q.h + pad };
    }).filter(function (w) { return w.x1 > w.x0 && w.y1 > w.y0; });
    if (changed) { sizeCanvas(rest); sizeCanvas(live); rebake(); }
  }

  /* ---------------------------------------------------------------- baking */
  function box(p) { var s = p.scale * H, h = Math.max(p.img.width, p.img.height) * s * 0.75; return { x0: p.x - h, y0: p.y - h, x1: p.x + h, y1: p.y + h }; }
  function cells(b, fn) {
    for (var cy = Math.floor(b.y0 / CELL); cy <= Math.floor(b.y1 / CELL); cy++)
      for (var cx = Math.floor(b.x0 / CELL); cx <= Math.floor(b.x1 / CELL); cx++) fn(cx + "," + cy);
  }
  function draw(g, p) {
    var s = p.scale * H * (p.shrink || 1);
    g.save();
    g.globalAlpha = p.alpha === undefined ? 1 : p.alpha;
    g.translate(p.x, p.y); g.rotate(p.a);
    g.drawImage(p.img, -p.img.width * s / 2, -p.img.height * s / 2, p.img.width * s, p.img.height * s);
    g.restore();
  }
  function bake(p) {
    p.state = "rest"; p.vx = p.vy = p.va = 0;
    p.box = box(p);
    cells(p.box, function (k) { (grid[k] = grid[k] || []).push(p); });
    draw(rest.getContext("2d"), p);
  }
  function unbake(p) {
    var b = p.box;
    cells(b, function (k) { var l = grid[k]; if (l) { var i = l.indexOf(p); if (i >= 0) l.splice(i, 1); } });
    p.state = "live";
    // redraw just that patch of the still layer, without it
    var g = rest.getContext("2d"), seen = [];
    g.save();
    g.beginPath(); g.rect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); g.clip();
    g.clearRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    cells(b, function (k) { (grid[k] || []).forEach(function (q) { if (seen.indexOf(q) < 0) { seen.push(q); } }); });
    seen.sort(function (a, c) { return a.id - c.id; }).forEach(function (q) { draw(g, q); });
    g.restore();
  }
  function rebake() {
    grid = {};
    rest.getContext("2d").clearRect(0, 0, W, H);
    pieces.forEach(function (p) { if (p.state === "rest") bake(p); });
  }

  /* ---------------------------------------------------------------- physics */
  var nextId = 1;
  function add(kind, img, x, y, scale, vx, vy) {
    var p = { id: nextId++, kind: kind, img: img, x: x, y: y, scale: scale, vx: vx, vy: vy, a: Math.random() * Math.PI * 2, va: (Math.random() - 0.5) * 8, state: "live" };
    pieces.push(p);
    return p;
  }
  function radius(p) { return Math.max(p.img.width, p.img.height) * p.scale * H * 0.4; }
  function inTrough(p) { return p.x < T || p.x > W - T || p.y > H - T; }
  function enterTrough(p) {
    p.state = "trough"; p.vx = p.vy = 0; p.shrink = ET.CONFIG.pieces.troughShrink; p.alpha = 1;
    stats.entered++;
    if (ET.audio) ET.audio.squelch();
  }
  function drain(p) {
    p.state = "drained";
    stats.drained++;
    if (p.kind === "eye") { stats.eyesDrained++; if (ET.audio) ET.audio.bloop(); }
  }
  function push(p, ux, uy, amount) {
    var C = ET.CONFIG.pieces, max = C.maxSpeed * H;
    if (p.state === "rest") unbake(p);
    p.vx += ux * amount; p.vy += uy * amount;
    var sp = Math.hypot(p.vx, p.vy);
    if (sp > max) { p.vx *= max / sp; p.vy *= max / sp; }
    p.va = (Math.random() < 0.5 ? -1 : 1) * sp / Math.max(4, radius(p)) * 0.5;
    p.ride = null;
  }
  function hitWalls(p) {
    var r = radius(p) * 0.6;
    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      if (p.x > w.x0 - r && p.x < w.x1 + r && p.y > w.y0 - r && p.y < w.y1 + r) {
        var dl = p.x - (w.x0 - r), dr = (w.x1 + r) - p.x, dt = p.y - (w.y0 - r), db = (w.y1 + r) - p.y, m = Math.min(dl, dr, dt, db);
        if (m === dl) { p.x = w.x0 - r; p.vx = -Math.abs(p.vx) * 0.25; }
        else if (m === dr) { p.x = w.x1 + r; p.vx = Math.abs(p.vx) * 0.25; }
        else if (m === dt) { p.y = w.y0 - r; p.vy = -Math.abs(p.vy) * 0.25; }
        else { p.y = w.y1 + r; p.vy = Math.abs(p.vy) * 0.25; }
      }
    }
  }
  function step(dt, still) {
    var C = ET.CONFIG.pieces, mu = C.friction * H, flow = C.flow * H;
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      if (p.state === "live") {
        if (p.ride) {
          var d = p.ride;
          p.x = d.x; p.y = d.y - radius(p) * 0.3;
          if (d.done) { p.ride = null; }
          else continue;
        }
        p.x += p.vx * dt; p.y += p.vy * dt;
        var sp = Math.hypot(p.vx, p.vy), dec = mu * dt;
        if (sp <= dec) { p.vx = p.vy = 0; sp = 0; } else { p.vx *= (sp - dec) / sp; p.vy *= (sp - dec) / sp; }
        if (!still) {
          if (p.kind === "eye") p.a += (p.vx * dt) / Math.max(4, radius(p));   // an eye rolls
          else { p.a += p.va * dt; p.va *= Math.max(0, 1 - 3 * dt); }          // shell tumbles, a leg flops
        }
        var r = radius(p) * 0.6;
        if (p.y < r) { p.y = r; p.vy = 0; }                                   // the top edge stops it
        hitWalls(p);
        if (inTrough(p)) { enterTrough(p); continue; }
        if (sp === 0) { bake(p); topCheck(p); }
      } else if (p.state === "trough") {
        if (still) {
          // reduced motion: the trough's flow is a simple fade
          p.alpha -= dt / C.fadeSeconds;
          if (p.alpha <= 0) drain(p);
          continue;
        }
        var bottom = H - T / 2;
        if (p.y < bottom - 1 && (p.x < T || p.x > W - T)) { p.x = p.x < T ? T / 2 : W - T / 2; p.y = Math.min(bottom, p.y + flow * dt); }
        else {
          p.y = bottom;
          var to = drainX - p.x, move = flow * dt;
          if (Math.abs(to) <= move) drain(p); else p.x += Math.sign(to) * move;
        }
        p.a += 4 * dt;
      }
    }
    if (pieces.some(function (p) { return p.state === "drained"; })) pieces = pieces.filter(function (p) { return p.state !== "drained"; });
    stepDrips(dt, still);
    stepTrickles(dt, still);
  }

  /* ---------------------------------------------------------------- liquid: drips and trickles */
  function floorPt(x, y) { return [x / W * floor.width, y / H * floor.height]; }
  function topCheck(p) {
    // a piece resting at the top edge in yolk or slime slides back down with it
    if (p.y > ET.CONFIG.pieces.topBand * H || !floor) return;
    var f = floorPt(p.x, p.y), under = ET.mess.sample(floor, f[0], f[1]);
    if (under.alpha < ET.CONFIG.liquid.minAlpha) return;
    var d = startDrip(p.x, p.y, under.color, true);
    if (d) { unbake(p); p.ride = d; }
  }
  function startDrip(x, y, color, force) {
    var C = ET.CONFIG.pieces;
    if (!force && drips.some(function (d) { return !d.done && Math.abs(d.x - x) < C.dripGap * H; })) return null;
    var len = (C.dripLength[0] + Math.random() * (C.dripLength[1] - C.dripLength[0])) * H;
    var d = { x: x, y: y, end: Math.min(H - T, y + len), color: color, done: false };
    drips.push(d);
    return d;
  }
  function blocked(x, y) {
    for (var i = 0; i < walls.length; i++) { var w = walls[i]; if (x > w.x0 && x < w.x1 && y > w.y0 && y < w.y1) return w; }
    return null;
  }
  function stepDrips(dt, still) {
    var speed = ET.CONFIG.pieces.drip * H;
    drips.forEach(function (d) {
      if (d.done) return;
      var ny = d.y + speed * dt, nx = d.x;
      var w = blocked(nx, ny);
      if (w) nx = (nx - w.x0 < w.x1 - nx) ? w.x0 - 2 : w.x1 + 2;          // round a readout, never over it
      var a = floorPt(d.x, d.y), b = floorPt(nx, ny);
      ET.mess.run(floor, a[0], a[1], b[0], b[1], 3 * floor.width / W, d.color);
      d.x = nx; d.y = ny;
      if (d.y >= d.end) d.done = true;
    });
    drips = drips.filter(function (d) { return !d.done; });   // a rider sees its drip's `done` and settles
  }
  function stepTrickles(dt, still) {
    trickles.forEach(function (t) {
      t.life -= dt;
      if (!still) { t.x += t.vx * dt; t.y += t.vy * dt; }
    });
    trickles = trickles.filter(function (t) { return t.life > 0; });
  }
  // the last of a washed patch trickles off toward the nearest trough edge (a small fading run, drawn live)
  function trickle(x, y, color) {
    var dl = x, dr = W - x, db = H - y, m = Math.min(dl, dr, db), sp = ET.CONFIG.pieces.drip * 6 * H;
    trickles.push({ x: x, y: y, color: color, life: 0.8, vx: m === dl ? -sp : m === dr ? sp : 0, vy: m === db ? sp : sp * 0.3 });
  }

  /* ---------------------------------------------------------------- drawing */
  function paint() {
    var g = live.getContext("2d");
    g.clearRect(0, 0, W, H);
    pieces.forEach(function (p) { if (p.state === "live" || p.state === "trough") draw(g, p); });
    trickles.forEach(function (t) {
      g.save(); g.globalAlpha = Math.max(0, t.life / 0.8) * 0.8; g.fillStyle = t.color;
      g.beginPath(); g.arc(t.x, t.y, 2.5, 0, Math.PI * 2); g.fill(); g.restore();
    });
    drips.forEach(function (d) {
      if (d.done) return;
      g.save(); g.fillStyle = d.color; g.globalAlpha = 0.9;
      g.beginPath(); g.ellipse(d.x, d.y + 2, 3.2, 4.2, 0, 0, Math.PI * 2); g.fill(); g.restore();
    });
  }

  /* ---------------------------------------------------------------- the API */
  ET.pieces = {
    build: function (b, f) {
      board = b; floor = f;
      rest = document.createElement("canvas"); rest.className = "pieces rest";
      live = document.createElement("canvas"); live.className = "pieces live";
      var t = document.createElement("div"); t.id = "trough"; t.setAttribute("aria-hidden", "true");
      // left and right run down; the bottom is two halves, each running to the drain under the sink
      ["left", "right", "bl", "br"].forEach(function (k) { var e = document.createElement("i"); e.className = "t-" + k; t.appendChild(e); });
      trough = { el: t, bottom: t.querySelector(".t-bl") };
      // the floor mess, then the trough, then the still and live pieces, then everything else on the board
      f.after(t); t.after(rest); rest.after(live);
      outline = getComputedStyle(document.documentElement).getPropertyValue("--outline").trim() || outline;
      loadArt();
      root.addEventListener("resize", layout);
    },
    layout: layout,
    reset: function () {
      pieces = []; drips = []; trickles = []; grid = {};
      stats = { drained: 0, eyesDrained: 0, entered: 0 };
      layout();
      if (rest) { rest.getContext("2d").clearRect(0, 0, W, H); live.getContext("2d").clearRect(0, 0, W, H); }
    },

    /* A clear: shell pieces from the egg, and (break stage 3–5) the alien's parts. `svg` is the nest's art (it fills
       its nest's width, top-aligned). */
    clear: function (svg, tier) {
      if (!art.ready || !svg) return 0;
      layout();
      var C = ET.CONFIG.pieces, nb = boardBox(svg.parentNode);
      var k = nb.w / SLOT_W;                                     // the pilot's pixels to screen pixels
      var eb = art.eggBox, cx = nb.x + (eb.x + eb.w / 2) * k, cy = nb.y + (eb.y + eb.h / 2) * k;
      var scale = k / H, made = 0;
      function fling(kind, img) {
        var a = Math.random() * Math.PI * 2, sp = (C.fling[0] + Math.random() * (C.fling[1] - C.fling[0])) * H;
        add(kind, img, cx + Math.cos(a) * eb.w * k * 0.2, cy + Math.sin(a) * eb.h * k * 0.2, scale, Math.cos(a) * sp, Math.sin(a) * sp);
        made++;
      }
      var n = C.shards[0] + Math.floor(Math.random() * (C.shards[1] - C.shards[0] + 1));
      for (var i = 0; i < n; i++) fling("shell", shard());
      var kinds = Object.keys(art.parts), many = C.parts[tier] || 0;
      for (var j = 0; j < many && kinds.length; j++) { var kk = kinds[Math.floor(Math.random() * kinds.length)]; fling(kk, art.parts[kk]); }
      return made;
    },

    /* The spray's move from (x0,y0) to (x1,y1), board px: every piece it passes is pushed the way it's going. */
    spray: function (x0, y0, x1, y1) {
      var dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
      if (len < 1) return 0;
      var C = ET.CONFIG.pieces, ux = dx / len, uy = dy / len, R = C.sprayRadius * H, hit = 0;
      var near = [];
      cells({ x0: Math.min(x0, x1) - R, y0: Math.min(y0, y1) - R, x1: Math.max(x0, x1) + R, y1: Math.max(y0, y1) + R }, function (k) {
        (grid[k] || []).forEach(function (p) { if (near.indexOf(p) < 0) near.push(p); });
      });
      pieces.forEach(function (p) { if (p.state === "live" && near.indexOf(p) < 0) near.push(p); });
      near.forEach(function (p) {
        var t = Math.max(0, Math.min(1, ((p.x - x0) * dx + (p.y - y0) * dy) / (len * len)));
        var d = Math.hypot(p.x - (x0 + t * dx), p.y - (y0 + t * dy));
        if (d < R + radius(p) * 0.5) { push(p, ux, uy, C.push * H * (1 - 0.5 * d / (R + radius(p)))); hit++; }
      });
      return hit;
    },

    /* The spray washed liquid at board (x, y) moving (ux, uy): a drip if that's at the top, else sometimes a trickle. */
    washed: function (x, y, ux, uy, before) {
      if (!before || before.alpha < ET.CONFIG.liquid.minAlpha) return;
      var C = ET.CONFIG.pieces;
      if (y < C.topBand * H && uy < 0) startDrip(x, Math.max(2, y), before.color);
      else if (Math.random() < C.trickleChance) trickle(x, y, before.color);
    },

    /* Each frame, on the player's seconds (a pause gives dt 0). `still`: reduced motion. */
    frame: function (dt, still) {
      if (!board) return;
      if (!W) layout();
      if (!W) return;
      if (dt > 0) step(Math.min(dt, 0.05), still);
      paint();
    },

    /* For rigs. */
    state: function () {
      var by = { rest: 0, live: 0, trough: 0 };
      pieces.forEach(function (p) { by[p.state] = (by[p.state] || 0) + 1; });
      return {
        ready: art.ready, count: pieces.length, rest: by.rest, live: by.live, trough: by.trough, drained: stats.drained,
        eyesDrained: stats.eyesDrained, entered: stats.entered, drips: drips.filter(function (d) { return !d.done; }).length,
        riding: pieces.filter(function (p) { return !!p.ride; }).length, dripsAt: drips.filter(function (d) { return !d.done; }).map(function (d) { return [d.x, d.y]; }), W: W, H: H, T: T, drainX: drainX, walls: walls.slice(),
        kinds: pieces.reduce(function (o, p) { o[p.kind] = (o[p.kind] || 0) + 1; return o; }, {})
      };
    },
    list: function () { return pieces.map(function (p) { return { id: p.id, kind: p.kind, state: p.state, x: p.x, y: p.y, a: p.a, r: radius(p), riding: !!p.ride }; }); },
    /* For rigs: `n` resting shell pieces spread over the board (a big pile, wave after wave). */
    bench: function (n) {
      if (!art.ready) return 0;
      layout();
      var scale = (boardBox(board.querySelector(".nest")).w / SLOT_W) / H;
      for (var i = 0; i < n; i++) {
        var p = add("shell", shard(), T + 20 + Math.random() * (W - 2 * T - 40), 20 + Math.random() * (H - T - 40), scale, 0, 0);
        hitWalls(p);
        bake(p);
      }
      return n;
    },
    /* For rigs: a drip at board (x, y), as liquid pushed to the top makes. */
    drip: function (x, y, color) { layout(); return !!startDrip(x, y, color || "rgb(255, 200, 40)", true); },
    /* For rigs: a piece the given kind at (x, y), resting. */
    place: function (kind, x, y) {
      if (!art.ready) return null;
      layout();
      var img = kind === "shell" ? shard() : art.parts[kind];
      var scale = (boardBox(board.querySelector(".nest")).w / SLOT_W) / H;
      var p = add(kind, img, x, y, scale, 0, 0);
      bake(p); topCheck(p);
      return p.id;
    }
  };
})(window);

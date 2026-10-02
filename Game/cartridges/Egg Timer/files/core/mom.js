/* ===========================================================================
   EGG TIMER — MOM'S VISIT (E55; the two parts kits, Andrew approved the art, Chat's build brief 2026-10-02)
   Mom repairs a hospital egg as its STR goes on: sweet Mom (wave 1 and the How To Play cartoon), creepy Mom (wave 2
   on). One rig and one timeline drive both: head only plus two tentacles (one picture, mirrored), no body, no hands.
   Pieces: make-mom-art.py → files/art/mom-<kind>--<down|face|giggle|tentacle|plaster>@2x.png, sizes and anchor
   points in mom-parts.js.
   The caller lays her out in px of its own container (where her head rests, the egg, the edge she comes in from,
   the box she's clipped to) and paints her at a share u (0..1) of the visit, read off the game's own clock, so a
   pause holds her and a rig can set any moment. The visit, as shares (config momTimeline):
     in (slides in from her edge) · A, looking down: the tentacles reach the egg, the plaster goes on, the cracks
     close · B, facing the player · C ↔ B, giggling, twice · out (back the way she came).
   A and the tentacles turn toward the egg; B and C stay upright. Every move is a transform (never brightness).
   Reduced motion: she fades in and out, nothing slides, swings or bobs, and the giggle is held (no swapping).
   ========================================================================= */
(function (root) {
  var ET = (root.ET = root.ET || {});
  var POSES = ["down", "face", "giggle"];

  function src(kind, piece) { return "art/mom-" + kind + "--" + piece + "@2x.png"; }
  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ease(x) { x = clamp(x); return x * x * (3 - 2 * x); }
  function img(kind, piece, cls) {
    var i = document.createElement("img");
    i.className = cls;
    i.alt = "";
    i.draggable = false;
    i.src = src(kind, piece);
    return i;
  }
  // the angle, in degrees, that turns `from` onto `to` (screen y down, so clockwise is positive, as CSS rotate())
  function turn(fromX, fromY, toX, toY) {
    return (Math.atan2(toY, toX) - Math.atan2(fromY, fromX)) * 180 / Math.PI;
  }

  /* Which pose shows at share u. */
  function pose(u, reduced) {
    var T = ET.CONFIG.momTimeline;
    if (u < T.face) return "down";
    if (reduced) return u < T.giggle[0] ? "face" : "giggle";   // reduced motion: one giggle, held
    for (var i = 0; i < T.giggle.length; i += 2) {
      if (u >= T.giggle[i] && u < T.giggle[i + 1]) return "giggle";
    }
    return "face";
  }

  /* Build one visit. lay: { kind, headW, head: {x, y} (where her head's middle rests), egg: {x, y, w} (the egg's
     middle and width), from: "top" | "left" | "right" | "bottom", clip: {l, t, r, b} (she's drawn only inside it),
     tilt (deg, A's turn toward the egg, capped) }. Returns { el, paint(u, reduced) }. */
  function visit(host, lay) {
    var P = ET.MOM_PARTS[lay.kind];
    var hw = lay.headW, hh = hw * P.head[1] / P.head[0];
    var el = document.createElement("div");
    el.className = "mom-visit " + lay.kind;
    el.dataset.from = lay.from;
    var clip = document.createElement("div");
    clip.className = "mom-clip";
    var c = lay.clip;
    clip.style.left = c.l + "px"; clip.style.top = c.t + "px";
    clip.style.width = (c.r - c.l) + "px"; clip.style.height = (c.b - c.t) + "px";
    el.appendChild(clip);
    // everything inside the clip is placed in the host's px, offset by the clip's corner
    var ox = -c.l, oy = -c.t;

    // the plaster, on the egg (under the tentacle tips)
    var plaster = img(lay.kind, "plaster", "mom-plaster");
    var pw = lay.egg.w * ET.CONFIG.momPlasterShare;
    plaster.style.width = pw + "px";
    plaster.style.left = (lay.egg.x + ox - pw / 2) + "px";
    plaster.style.top = (lay.egg.y + oy - pw * P.plaster[1] / P.plaster[0] / 2) + "px";
    clip.appendChild(plaster);

    // the rig: her head and the tentacles' stubs ride on it as she slides in and out
    var rig = document.createElement("div");
    rig.className = "mom-rig";
    clip.appendChild(rig);
    var hx = lay.head.x + ox, hy = lay.head.y + oy;
    var chin = { x: hx + (P.chin[0] - 0.5) * hw, y: hy + (P.chin[1] - 0.5) * hh };

    // two tentacles, one mirrored, from either side of her chin to either end of the plaster
    var tw = hw * ET.CONFIG.momTentacleShare;            // the tentacle picture's width, before any stretch
    var th = tw * P.tentacle[1] / P.tentacle[0];
    var bx = P.tentacleBase[0] * tw, by = P.tentacleBase[1] * th;
    var ax = (P.tentacleTip[0] - P.tentacleBase[0]) * tw, ay = (P.tentacleTip[1] - P.tentacleBase[1]) * th;
    var natural = Math.hypot(ax, ay);
    var tents = [-1, 1].map(function (side) {
      var t = img(lay.kind, "tentacle", "mom-tentacle");
      t.style.width = tw + "px";
      t.style.height = th + "px";
      rig.appendChild(t);
      var spread = hw * 0.16 * side;                       // the stubs, either side of her chin
      var from = { x: chin.x + spread, y: chin.y };
      var reach = pw * 0.3 * side;                          // the tips, near either end of the plaster
      var to = { x: lay.egg.x + ox + reach * 0.7, y: lay.egg.y + oy - reach * 0.7 };
      var dx = to.x - from.x, dy = to.y - from.y;
      var dist = Math.hypot(dx, dy);
      // mirrored (side -1): the picture flips about its base, so its axis does too
      var axs = side < 0 ? -ax : ax;
      return {
        el: t, side: side, from: from, dist: dist,
        stretch: Math.max(0.5, Math.min(ET.CONFIG.momStretchMax, dist / natural)),
        aim: turn(axs, ay, dx, dy)                        // turns the picture's own axis onto the egg
      };
    });

    var head = document.createElement("div");
    head.className = "mom-head";
    head.style.width = hw + "px";
    head.style.height = hh + "px";
    head.style.left = (hx - hw / 2) + "px";
    head.style.top = (hy - hh / 2) + "px";
    // her head turns about her chin
    head.style.transformOrigin = (P.chin[0] * 100) + "% " + (P.chin[1] * 100) + "%";
    POSES.forEach(function (p) { head.appendChild(img(lay.kind, p, "mom-pose " + p)); });
    rig.appendChild(head);
    host.appendChild(el);

    // how far she starts outside her edge (so she slides in from behind it)
    var away = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] }[lay.from];
    var gone = (lay.from === "top" || lay.from === "bottom" ? hh : hw) * 1.25 +
      (lay.from === "top" ? hy : lay.from === "bottom" ? (c.b - c.t) - hy : lay.from === "left" ? hx : (c.r - c.l) - hx);

    var api = {
      el: el, head: head, rig: rig, chin: chin, clip: clip, offset: { x: ox, y: oy }, hw: hw, hh: hh,
      paint: function (u, reduced) {
        var T = ET.CONFIG.momTimeline;
        var p = pose(u, reduced);
        el.dataset.pose = p;
        // in and out: a slide from behind her edge, or (reduced motion) a fade
        var vis = u < T.in ? ease(u / T.in) : u > T.out ? 1 - ease((u - T.out) / (1 - T.out)) : 1;
        if (reduced) {
          rig.style.transform = "";
          el.style.opacity = vis;
        } else {
          var k = (1 - vis) * gone;
          rig.style.transform = "translate(" + (away[0] * k).toFixed(1) + "px, " + (away[1] * k).toFixed(1) + "px)";
          el.style.opacity = "";
        }
        // A turns toward the egg; B and C stand upright, C with a little bob (not under reduced motion)
        var tilt = p === "down" ? lay.tilt : 0;
        var bob = p === "giggle" && !reduced ? -0.04 * hh : 0;
        head.style.transform = "translateY(" + bob.toFixed(1) + "px) rotate(" + tilt.toFixed(1) + "deg)";
        // the tentacles reach out, hold the plaster on, and draw back as she turns to the player
        var reach = reduced ? (u >= T.reach[0] && u < T.reach[3] ? 1 : 0)
          : u < T.reach[0] ? 0 : u < T.reach[1] ? ease((u - T.reach[0]) / (T.reach[1] - T.reach[0]))
          : u < T.reach[2] ? 1 : u < T.reach[3] ? 1 - ease((u - T.reach[2]) / (T.reach[3] - T.reach[2])) : 0;
        tents.forEach(function (t) {
          t.el.style.visibility = reach > 0.02 ? "visible" : "hidden";
          var s = t.stretch * (0.25 + 0.75 * reach);
          var w = 1 + (s - 1) * 0.35;   // it thins a little as it stretches, thickens a little as it shortens
          t.el.style.transform = "translate(" + t.from.x.toFixed(1) + "px, " + t.from.y.toFixed(1) + "px) rotate(" +
            t.aim.toFixed(1) + "deg) " + stretchAlong(t, s, w) + " translate(" + (-bx).toFixed(1) + "px, " + (-by).toFixed(1) + "px)";
        });
        // the plaster: on as the tips arrive, held, gone as she leaves
        var pv = u < T.patch[0] ? 0 : u < T.patch[1] ? (u - T.patch[0]) / (T.patch[1] - T.patch[0]) : u < T.out ? 1 : vis;
        plaster.style.visibility = pv > 0.02 ? "visible" : "hidden";
        plaster.style.transform = reduced ? "" : "scale(" + (pv < 1 ? 0.3 + 0.85 * ease(pv) : 1).toFixed(3) + ")";
        if (reduced) plaster.style.opacity = pv;
      }
    };
    // stretch along the tentacle's own axis only (its width barely changes): in the picture's frame, the axis is
    // (ax, ay) from the base; turned back onto x, scaled, and turned again. Mirrored for side -1.
    function stretchAlong(t, s, w) {
      var axs = t.side < 0 ? -ax : ax;
      var phi = Math.atan2(ay, axs) * 180 / Math.PI;
      return "rotate(" + phi.toFixed(2) + "deg) scale(" + s.toFixed(3) + ", " + w.toFixed(3) + ") rotate(" + (-phi).toFixed(2) + "deg)" +
        (t.side < 0 ? " scale(-1, 1)" : "");
    }
    api.paint(0, false);
    return api;
  }

  ET.mom = {
    visit: visit,
    pose: pose,
    /* every picture's path (one kind, or both) */
    sources: function (kind) {
      var out = [];
      (kind ? [kind] : ["sweet", "creepy"]).forEach(function (k) {
        POSES.concat(["tentacle", "plaster"]).forEach(function (p) { out.push(src(k, p)); });
      });
      return out;
    },
    /* Fetch the pictures once, before she's first needed (never with the page: the data comes first), one after
       another, so they never add to the burst of requests a game's start makes (the test server is single-threaded). */
    preload: function (kind) {
      ET.mom.sources(kind).forEach(function (s) {
        if (preloaded[s]) return;
        preloaded[s] = true;
        queue.push(s);
      });
      next();
    }
  };
  var preloaded = {}, queue = [], busy = false;
  function next() {
    if (busy || !queue.length) return;
    busy = true;
    var i = new Image();
    i.onload = i.onerror = function () { busy = false; next(); };
    i.src = queue.shift();
  }
})(window);

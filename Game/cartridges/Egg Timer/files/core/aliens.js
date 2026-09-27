/* ===========================================================================
   EGG TIMER — THE HATCHLINGS (E45, Andrew's six sheets, approved as they are, 2026-09-27)
   Puppets: each alien is built from its cut pieces (make-alien-art.py → files/art/hatch-<alien>--<part>@2x.png,
   sizes in alien-parts.js) and each piece swings about its own attaching end, so legs scuttle and tentacles curl.
   Where a sheet had no usable separate pieces (the octopus, the Grabber, the Wriggler's see-through body) the body
   takes the fallback: a whole-body squash, stretch and bob, with loose limbs round it.
   Coordinates are the nest's viewBox units (the egg sits at 0,0 with its base at y 20). A part is placed by its
   pivot (the attaching end, as a share of its picture); its kids are placed at a share of its picture, and ride on it.
   Every swing is a rotation (never brightness), and reduced motion stills every one (style.css).
   ========================================================================= */
(function (root) {
  var ET = (root.ET = root.ET || {});
  var SVGNS = "http://www.w3.org/2000/svg";

  /* Part: [name, x, y, options]. Options: pivot [fx, fy] (default the middle); rot (deg); flip (mirrored); s (scale);
     at [fx, fy] (for a kid: where on its parent it attaches); a, d, dl (swing: degrees each way, seconds each way,
     delay); squish {s, b, d} (the fallback: squash/stretch share, bob in units, seconds); drip (a slow stretch);
     o (opacity); kids [parts...]. Earlier parts draw behind later ones. */
  function leg(name, x, y, o) { return [name, x, y, o]; }
  function tentacle(n, x, y, rot, left, o) {
    // a loose tentacle tucked under a fallback body: its stub hides beneath, its end curls
    return ["tentacle-" + n, x, y, { pivot: [0.06, 0.5], rot: left ? rot : -rot, flip: left, s: o.s, a: o.a, d: o.d, dl: o.dl }];
  }

  var RIGS = {
    // cute: a round crab, eyes on stalks behind its body, four legs a side (mirrored), scuttling
    crab: [
      ["stalk-1", -5, -14, { pivot: [0.9, 0.88], a: 7, d: 1.2 }],
      ["stalk-2", 2, -16, { pivot: [0.86, 0.9], a: 9, d: 1.0, dl: 0.3 }],
      ["stalk-3", 9, -15, { pivot: [0.45, 0.93], a: 8, d: 1.3, dl: 0.6 }],
      leg("leg-3", -13, 0, { pivot: [0.97, 0.22], rot: -8, a: 11, d: 0.34 }),
      leg("leg-1", -14, 4, { pivot: [0.95, 0.08], rot: 4, a: 12, d: 0.34, dl: 0.17 }),
      leg("leg-4", -12, 9, { pivot: [0.93, 0.14], rot: 8, a: 11, d: 0.34 }),
      leg("leg-2", -10, 12, { pivot: [0.88, 0.06], rot: 14, a: 12, d: 0.34, dl: 0.17 }),
      leg("leg-3", 13, 0, { pivot: [0.97, 0.22], rot: 8, flip: true, a: 11, d: 0.34, dl: 0.17 }),
      leg("leg-1", 14, 4, { pivot: [0.95, 0.08], rot: -4, flip: true, a: 12, d: 0.34 }),
      leg("leg-4", 12, 9, { pivot: [0.93, 0.14], rot: -8, flip: true, a: 11, d: 0.34, dl: 0.17 }),
      leg("leg-2", 10, 12, { pivot: [0.88, 0.06], rot: -14, flip: true, a: 12, d: 0.34 }),
      ["body", 0, 19, { pivot: [0.5, 0.97], s: 0.9, squish: { s: 0.03, b: 1.2, d: 0.34 } }]
    ],
    // horror: the hunched spider; its one whole jointed leg, four a side, over the stub and the claws underneath
    scuttler: [
      leg("leg", -5, -8, { pivot: [0.97, 0.86], rot: -25, s: 0.75, a: 10, d: 0.22 }),
      leg("leg", -5, -2, { pivot: [0.97, 0.86], rot: -8, s: 0.82, a: 10, d: 0.22, dl: 0.11 }),
      leg("leg", 6, -8, { pivot: [0.97, 0.86], rot: 25, s: 0.75, flip: true, a: 10, d: 0.22, dl: 0.11 }),
      leg("leg", 6, -2, { pivot: [0.97, 0.86], rot: 8, s: 0.82, flip: true, a: 10, d: 0.22 }),
      ["body", 0, 17, { pivot: [0.5, 0.92], squish: { s: 0.02, b: 0.8, d: 0.22 } }],
      // the front legs sit low, over the body's stubby leg and the small claws underneath (Andrew)
      leg("leg", -2, 12, { pivot: [0.97, 0.86], rot: -40, s: 0.7, a: 11, d: 0.22 }),
      leg("leg", -1, 18, { pivot: [0.97, 0.86], rot: -62, s: 0.64, a: 11, d: 0.22, dl: 0.11 }),
      leg("leg", 10, 11, { pivot: [0.97, 0.86], rot: 40, s: 0.7, flip: true, a: 11, d: 0.22, dl: 0.11 }),
      leg("leg", 6, 18, { pivot: [0.97, 0.86], rot: 62, s: 0.64, flip: true, a: 11, d: 0.22 }),
      ["mandible-l", 4, -7, { pivot: [0.8, 0.14], s: 0.8, a: 14, d: 0.3 }],
      ["mandible-r", 11, -7, { pivot: [0.2, 0.14], s: 0.8, a: -14, d: 0.3 }]
    ],
    // cute: the worm stood up in its body segment, head swaying, antenna bobbing, tail wagging (no legs: Andrew)
    worm: [
      ["segment", -3, 20, { pivot: [0.5, 0.9], squish: { s: 0.04, b: 1.5, d: 0.5 }, kids: [
        ["tail", 0, 0, { at: [0.92, 0.62], pivot: [0.1, 0.55], a: 14, d: 0.45 }],
        ["head", 0, 0, { at: [0.5, 0.2], pivot: [0.5, 0.94], a: 7, d: 0.9, kids: [
          ["antenna", 0, 0, { at: [0.6, 0.06], pivot: [0.45, 0.95], a: 15, d: 0.6, dl: 0.2 }]
        ] }]
      ] }]
    ],
    // horror: the see-through grub on the whole-body fallback; its glowing insides and ten feelers move on their own
    wriggler: (function () {
      var parts = [], n = 10;
      for (var i = 0; i < n; i++) {
        var ang = -165 + 150 * i / (n - 1);   // a crown, fanned from left to right over the mouth
        parts.push(["feeler-" + (i + 1), -2 + 5 * (i / (n - 1) - 0.5), -29, {
          pivot: [0.05, 0.5], rot: ang, s: 0.75, a: 16, d: 0.5 + 0.08 * (i % 3), dl: 0.07 * i
        }]);
      }
      parts.push(["body", 0, 20, { pivot: [0.5, 0.97], s: 0.9, squish: { s: 0.05, b: 1.5, d: 0.55 }, kids: [
        ["insides", 0, 0, { at: [0.44, 0.58], pivot: [0.5, 0.5], o: 0.85, a: 3, d: 1.4 }]
      ] }]);
      return parts;
    })(),
    // cute: the concept octopus whole (its tentacles are drawn on), on the fallback, with loose tentacles curling
    octopus: [
      tentacle(1, -12, 17, -5, true, { s: 0.8, a: 14, d: 0.7 }),
      tentacle(2, 12, 17, -5, false, { s: 0.8, a: 14, d: 0.7, dl: 0.35 }),
      tentacle(3, -10, 10, 20, true, { s: 0.75, a: 16, d: 0.8, dl: 0.2 }),
      tentacle(4, 10, 10, 20, false, { s: 0.75, a: 16, d: 0.8, dl: 0.55 }),
      ["body", 0, 21, { pivot: [0.5, 0.97], s: 0.95, squish: { s: 0.04, b: 1.5, d: 0.6 } }]
    ],
    // horror: the concept Grabber whole (puddle cut away), on the fallback, loose tentacles and dripping slime
    grabber: [
      tentacle(1, -11, 16, -5, true, { s: 0.85, a: 20, d: 0.5 }),
      tentacle(2, 11, 16, -5, false, { s: 0.85, a: 20, d: 0.5, dl: 0.25 }),
      tentacle(3, -9, 6, 25, true, { s: 0.8, a: 22, d: 0.45, dl: 0.12 }),
      tentacle(4, 9, 6, 25, false, { s: 0.8, a: 22, d: 0.45, dl: 0.37 }),
      ["body", 0, 21, { pivot: [0.5, 0.98], s: 1, squish: { s: 0.05, b: 1.2, d: 0.45 } }],
      ["drip-1", -11, 12, { pivot: [0.5, 0.05], s: 0.9, drip: 1.3 }],
      ["drip-3", 7, 14, { pivot: [0.5, 0.05], s: 0.9, drip: 1.7 }],
      ["drip-2", 15, 5, { pivot: [0.5, 0.05], drip: 1.1 }],
      ["drip-4", -17, 3, { pivot: [0.5, 0.05], drip: 1.5 }]
    ]
  };

  function node(tag, attrs, parent) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function src(alien, part) { return "art/hatch-" + alien + "--" + part + "@2x.png"; }

  /* One part: an outer group places it (at its pivot, turned, mirrored, scaled); an inner group moves it about the
     pivot (its local 0,0); the picture sits so its pivot is at 0,0; kids hang off the inner group. */
  function build(alien, spec, parent, parentSize) {
    var name = spec[0], o = spec[3] || {}, size = ET.ALIEN_PARTS[alien][name];
    if (!size) return;
    var w = size[0], h = size[1], pv = o.pivot || [0.5, 0.5];
    var x = spec[1], y = spec[2];
    if (o.at && parentSize) {   // a kid: placed on its parent's picture, relative to the parent's pivot
      x = o.at[0] * parentSize.w - parentSize.px;
      y = o.at[1] * parentSize.h - parentSize.py;
    }
    var s = o.s || 1;
    var place = node("g", {
      class: "part", "data-part": name,
      transform: "translate(" + x + " " + y + ") rotate(" + (o.rot || 0) + ") scale(" + (o.flip ? -s : s) + " " + s + ")"
    }, parent);
    var move = node("g", {}, place);
    if (o.squish) {
      move.setAttribute("class", "squish");
      move.style.setProperty("--s", o.squish.s);
      move.style.setProperty("--b", o.squish.b);
      move.style.setProperty("--d", o.squish.d + "s");
    } else if (o.drip) {
      move.setAttribute("class", "drip");
      move.style.setProperty("--d", o.drip + "s");
    } else if (o.a) {
      move.setAttribute("class", "wig");
      move.style.setProperty("--a", o.a);
      move.style.setProperty("--d", (o.d || 0.5) + "s");
    }
    if (o.dl) move.style.setProperty("--dl", o.dl + "s");
    node("image", {
      href: src(alien, name), x: -pv[0] * w, y: -pv[1] * h, width: w, height: h,
      preserveAspectRatio: "none", opacity: o.o === undefined ? 1 : o.o
    }, move);
    (o.kids || []).forEach(function (k) {
      build(alien, k, move, { w: w, h: h, px: pv[0] * w, py: pv[1] * h });
    });
  }

  var preloaded = false;

  ET.aliens = {
    RIGS: RIGS,
    has: function (alien) { return !!(RIGS[alien] && ET.ALIEN_PARTS && ET.ALIEN_PARTS[alien]); },
    /* Put `alien`'s puppet in a nest's creature slot (the placeholder bug steps aside while it's there). */
    fill: function (creature, alien) {
      ET.aliens.clear(creature);
      if (!ET.aliens.has(alien)) return false;
      var g = node("g", { class: "alien", "data-alien": alien }, creature);
      RIGS[alien].forEach(function (spec) { build(alien, spec, g, null); });
      creature.classList.add("has-art");
      return true;
    },
    clear: function (creature) {
      var old = creature.querySelector(".alien");
      if (old) old.remove();
      creature.classList.remove("has-art");
    },
    /* Fetch every picture once, when the first game starts (not with the page: the data comes first), so an alien's
       first hatch, at least half a minute later, doesn't draw a frame late. */
    preload: function () {
      if (preloaded) return;
      preloaded = true;
      ET.aliens.sources().forEach(function (s) { var i = new Image(); i.src = s; });
    },
    /* every picture's path */
    sources: function () {
      var out = [];
      Object.keys(RIGS).forEach(function (a) {
        Object.keys((ET.ALIEN_PARTS || {})[a] || {}).forEach(function (p) { out.push(src(a, p)); });
      });
      return out;
    }
  };
})(window);

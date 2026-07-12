# The Aquanaut — Layered Creature Asset Contract

**Type:** Asset-interface contract (boundary object between engine and art)
**Rendering model:** **B — multi-part canvas** (decided 2026-06-19). Creatures remain
canvas pixels drawn in `#game-canvas`; each creature is composed from separable parts,
each drawn with its own engine-driven pivot transform. This preserves the existing
light cone, depth-fog/visibility tiers, sonar-to-sprite morph, descent parallax
Z-order, and kill-cam compositing — all unchanged.

> This document is the target the creature art must hit. Write the Gemini (or any
> generator) prompt **against this contract** so output drops into the engine with no
> rework. Anything the engine already does (below) must **not** be baked into the art.

---

## 0. Division of responsibility

**The engine provides (do NOT bake into the art):**
- World position / translation across the playfield.
- Facing mirror — sprites authored in one native facing; the engine flips horizontally
  to keep the head leading (see §4).
- Pitch-into-travel (nose tilts toward target).
- Depth visibility — blur, fade-in, and sonar-morph fade as the creature is detected.
- Bioluminescent glow aura, bubble wake, spawn grow-in scale.
- All swim **motion** — bob, sway, tail-beat, bell-pulse, jaw-snap (engine drives the
  pivots; amplitude/frequency live in config and are tunable).

**The art provides:**
- The static part rasters (rest pose), one per named part (§2).
- A pivot point per moving part (§3).
- Back-to-front Z-order (§3).
- A clean neutral rest pose: with every part at rest the parts compose into a correct,
  whole creature (this is also the single-image fallback — see §6).

---

## 1. Canvas, format, transparency

- **Shared bounding box.** Every part of a creature is authored on the **same canvas
  size** = that creature's full bounding box (its `spriteSize`, §5). Each part PNG is
  fully transparent except for that one part, positioned where it sits on the whole
  creature. Overlaying all parts at the same origin reconstructs the creature at rest.
  *(This is what makes B cheap: each part is `drawImage`'d at the same `-w/2,-h/2` and
  only rotated/scaled about its own pivot — no per-part offset bookkeeping.)*
- **Transparency.** Two accepted delivery formats, in order of preference:
  1. **Pre-transparent PNG** (straight alpha) — preferred.
  2. **Green-screen PNG** on pure `#00FF00`, matching the existing chromakey
     (removes `g>180 && r<120 && b<120`; edge-softens `g>140 && g>r*1.3 && g>b*1.3`).
     The loader will key each part the same way it keys whole sprites today.
- **No baked drop-shadow / outer glow** — the engine adds the bioluminescent aura. A
  tight inner rim-light baked into the art is fine.
- **One native facing per creature**, declared via the `_ht`/`_th` filename suffix
  (§4). All parts of a creature share the same native facing.

---

## 2. Part taxonomy — which part moves encodes the behavior archetype

Motion is **behavioral, not cosmetic**: the moving part(s) express the creature's
existing movement archetype. Per the current Tier-1 roster:

| Creature | Archetype | Required parts (back→front) | Moving part → behavior |
|---|---|---|---|
| **Great White** | drift (steady, menacing) | `body`, `pectoral` (opt), `tail`, `jaw` (opt) | `tail` beats slow about its peduncle pivot → drives the forward **surge** that already exists; `pectoral` micro-tilt. |
| **Barracuda** | lunge | `body`, `tail`, `jaw` | `tail` fast twitchy beat; `jaw` **snaps** during the lunge burst (hooks `mv.lungePhase === 'lunge'`). |
| **Box Jellyfish** | drift / latch | `bell`, `tentacles` (1 group OK) | `bell` pulses (scaleY about a top pivot) → propulsion; `tentacles` **lag** behind the bell with delay; reach/extend on latch. |

Minimum viable: a `body` + one primary moving part (`tail` for fish, `bell`+`tentacles`
for jelly). Extra parts (`jaw`, `pectoral`, `eye-glow`) are optional enrichment and
degrade gracefully if absent.

---

## 3. Per-part manifest (what ships alongside the rasters)

For each creature, a manifest (the engine will hold this in `core/config.js` as data):

```js
greatWhite: {
  spriteSize: { w: 200, h: 112 },     // shared bounding box (px), matches config
  nativeFacing: 'left',               // from _ht; engine mirrors as needed
  zOrder: ['pectoral', 'body', 'tail', 'jaw'],   // back → front draw order
  parts: {
    body:     { src: '..._body.png' },                       // no pivot = static
    tail:     { src: '..._tail.png', pivot: [0.30, 0.50] },  // joint, normalized 0..1 over the box
    jaw:      { src: '..._jaw.png',  pivot: [0.12, 0.55] },
    pectoral: { src: '..._pec.png',  pivot: [0.55, 0.62] }
  }
}
```

- **`pivot: [px, py]`** — normalized coordinates **in the shared bounding box** of the
  joint the part rotates/scales about (e.g. the shark tail's caudal peduncle, the
  jellyfish bell's apex). Pixel-accurate placement here is what sells the articulation;
  get these right.
- A part with **no `pivot`** is static (drawn but not animated) — fine for `body`.
- **`zOrder`** is authored back→front; the engine draws in that order inside the
  creature's local space (after facing/pitch), so it mirrors correctly.

---

## 4. Facing (reuse the existing convention — unchanged)

- `_ht` = head-to-tail L→R → **head on the LEFT** → native facing `left`.
- `_th` = tail-to-head L→R → **head on the RIGHT** → native facing `right`.
- Author every part of a creature in **one** native facing. The engine mirrors the
  whole composite (and therefore every part + its pivot) when heading disagrees with
  native facing. Do not author left/right variants.

---

## 5. Dimensions (match config `spriteSize`)

| Creature | Bounding box (w×h) |
|---|---|
| Great White | 200 × 112 |
| Barracuda | 200 × 112 |
| Box Jellyfish | 160 × 160 |

New deep-roster creatures declare their own box; keep aspect ratios true to the
silhouette so the radius/spawn math reads correctly.

---

## 6. Single-image fallback (Option C, per-creature)

A creature that only ships as **one flat PNG** (no parts) still works: the engine
treats it as a `body`-only creature and applies today's whole-composite procedural
motion (bob/sway/squash). Acceptable for pure drifters; predators should ship a
`tail` so the swish is real. The rest pose in §0 guarantees the fallback looks correct.

---

## 7. Checklist for the generator prompt

- [ ] Parts on a **shared bounding box**, transparent (or `#00FF00` green-screen).
- [ ] Clean **rest pose** — parts compose into a correct whole creature.
- [ ] **Pivot** marked for every moving part (peduncle / bell apex / jaw hinge).
- [ ] **Z-order** back→front.
- [ ] **One native facing**, `_ht`/`_th` suffix.
- [ ] **No baked glow/shadow**; rim-light only.
- [ ] Dimensions match the creature's `spriteSize`.

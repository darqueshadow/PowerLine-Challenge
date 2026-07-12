# The Aquanaut — Depth & Descent System

**Type:** Cartridge spec / handoff for Claude Code
**Author:** Claude Chat (Senior Developer)
**Status:** Draft for implementation review
**Scope constraint:** Theme layer only. No `/core` engine changes. One item (§8) needs a Laws check before wiring — flagged inline.

---

## 0. Goal

Create the continuous illusion that the Aquanaut is being lowered deeper and deeper as play progresses. The diver stays near-stationary; the **world scrolls past him** and the **light dies** around him. Depth is not a separate system — it is driven directly off the existing score/tier progression. Score *is* depth.

All effects below live in the Aquanaut cartridge's theme files (`/cartridges/aquanaut/`). Nothing here changes scoring, challenge generation, or core engine behavior.

---

## 1. The `depthRatio` driver

Everything keys off one normalized value: **`depthRatio` ∈ [0.0, 1.0]**.

- `0.0` = surface (start of Bubble Hopper)
- `1.0` = abyss (deep into Aquanaut tier)

Drive it from **current score**, interpolating *within* each tier so descent feels smooth and continuous rather than snapping at tier-up. Proposed model:

```
Each tier has a depthRatio anchor:
  Bubble Hopper        -> 0.00
  Rig Walker           -> 0.33
  Crush Depth Operator -> 0.66
  The Aquanaut         -> 1.00

Within a tier, interpolate by score progress toward the next threshold:
  tierProgress = (score - tierStart) / (nextTierStart - tierStart)   // clamp 0..1
  depthRatio   = lerp(thisAnchor, nextAnchor, tierProgress)

Top tier (Aquanaut) has no next threshold:
  Pick a soft ceiling score (e.g. 80000) and let tierProgress run 50001 -> ceiling,
  then clamp at depthRatio = 1.0. Tunable.
```

Pseudocode only — Claude Code owns the actual implementation and the choice of easing. A slight ease-in/ease-out per tier band will feel better than pure linear.

---

## 2. Progression tiers (from `progression.csv`)

Source data, mapped to depth zones:

| Tier | Pts Req | Speed (min–max) | Spawn (min–max sec) | Max Targets | Hit | Impact | Radius | Sonar | depthRatio anchor | Depth zone |
|---|---|---|---|---|---|---|---|---|---|---|
| Bubble Hopper | 0 | 0.5–0.8× | 7.5–10.5 | 3 | +100 | −50 | 22 | 700 | 0.00 | Sunlight / surface |
| Rig Walker | 5001 | 0.9–1.3× | 5.4–7.5 | 4 | +250 | −125 | 20 | 850 | 0.33 | Upper-mid / rig |
| Crush Depth Operator | 20001 | 1.4–2.0× | 3.75–5.25 | 3 | +500 | −275 | 17 | 1000 | 0.66 | Twilight zone |
| The Aquanaut | 50001 | 2.2–3.5× | 1.2–2.7 | 4 | +1000 | −550 | 15 | 1200 | 1.00 | Abyss |

Notes for Claude Code:
- These values feed the **existing** difficulty/spawn/scoring systems already in core. The depth system only *reads* the resulting score → `depthRatio`. It does not write to any of these.
- `Max Targets` is non-monotonic (3/4/3/4) — preserved as authored. Andrew has flagged the CSV as "still needs tweaking," so treat numbers as tunable, not final.
- `Sonar Speed` is the player's sonar/projectile travel speed; it rises with depth (faster pulses at greater depth). Carried through for completeness — not a depth-visual driver.

---

## 3. Visual layer stack (parallax)

Render behind the diver, **all scrolling upward**, speeds scaled by `depthRatio` (faster apparent descent as you go deeper). Suggested layers, far → near:

| Layer | Content | Base scroll | Notes |
|---|---|---|---|
| L0 background | Solid depth-tinted gradient | none | Color from §5 |
| L1 far | Faint marine snow / suspended particulate | slow | Sparse, low opacity |
| L2 mid | Drifting silt, rising bubbles, debris | medium | Main body of motion |
| L3 side | **Cliffs / canyon walls** (see §4) | medium-fast | Edge gutters only |
| L4 near | Fast foreground motes streaking up | fast | Sells speed, low opacity |
| L5 overlay | God-ray / caustic light from top (see §6) | n/a | Shrinks with depth |

The **speed differential** between layers is what reads as motion — keep them clearly separated. The diver bobs gently in place; he never actually translates down-screen.

---

## 4. Side cliffs / canyon walls

Vertical scenery in the screen-edge gutters that scrolls upward — the strongest "I am sinking past this" cue.

**Placement**
- Confine to outer gutters (~120 VCS units each side in a 1000-wide field). Must not intrude on active spawn lanes.
- Treat as part of L3 in the parallax stack.

**Depth-zone appearance** (cross-fade as `depthRatio` crosses tier bands):
| Zone | Wall character |
|---|---|
| Sunlight (0.00–0.33) | Pale rock, kelp fronds, dappled light on stone |
| Rig (0.33–0.66) | Sheer rock face, rig struts / support beams, fewer plants |
| Twilight (0.66–0.90) | Jagged dark canyon, first bioluminescent growth |
| Abyss (0.90–1.00) | **Walls fall away** into void; only sparse bio-lit outcrops drift past |

**Two reinforcing tricks**
1. **Narrowing canyon:** angle walls slightly inward as `depthRatio` rises so the play column tightens with depth. Pairs with the vignette (§9) for a pressure/claustrophobia feel.
2. **Wall-out reveal:** the abyss "no walls, no bottom" state is a deliberate payoff for reaching Aquanaut rank — open it up suddenly at the final threshold transition (§10).

**Implementation watch-out (Claude Code):** continuous vertical scroll will expose seams if walls are static repeated images. Use a seamless vertical tiling strip or procedurally stacked segments with randomized rock chunks so no obvious repeat is visible.

---

## 5. Color grade (the strongest psychological cue)

Full-screen tint + background gradient lerped by `depthRatio`. Red absorbs first, then orange, then yellow — only cold blues survive at depth. People feel this even without naming it.

| depthRatio | Background | Tint character | Contrast |
|---|---|---|---|
| 0.00 | Bright cyan-green | Light, warm-ish | High |
| 0.33 | Teal | Cooling | Medium-high |
| 0.66 | Deep blue → indigo | Cold, desaturated | Flattening |
| 0.90 | Indigo → near-black | Very cold | Low |
| 1.00 | Near-black | Black; bioluminescence is the only color | Minimal |

Single continuous lerp across these keyframes. Bioluminescent enemy glows and HUD elements should pop *brighter* as the field darkens so readability holds at depth.

---

## 6. Overhead light

A soft caustic gradient / god-rays anchored to the **top** of the screen.

- Surface: broad, bright, dappled, animated shimmer.
- Mid: narrower, dimmer.
- Deep: a faint pale smudge overhead.
- Abyss: gone.

Because the light source stays up there and **shrinks**, the brain infers the diver is moving away from it — i.e. descending. Drive width + opacity off `depthRatio` (both → ~0 by 1.0).

---

## 7. Depth gauge + pressure HUD

A vertical HUD readout that anchors the whole illusion cognitively — once the number says "descending," every other cue is read as descent.

- **Depth gauge:** continuous readout, e.g. `DEPTH: 1,240 ft` (or metric — Andrew to confirm units). Maps off `depthRatio` to a max depth (e.g. 1.0 → 12,000 ft, tunable). Ticks up smoothly.
- **Pressure bar:** creeps toward red as depth increases. Cosmetic.
- Optional thermocline/temperature readout dropping with depth.

These are HUD overlays — no core HUD logic changes, just themed display bound to `depthRatio`.

---

## 8. Enemy depth-zone gating ⚠️ LAWS CHECK REQUIRED

Spawn shallow-zone creatures (sharks, barracudas) early; twilight creatures (jellyfish, squid) mid; deep roster (anglerfish, gulper eels, kraken tentacles) only in the dark. The **cast changing is itself a descent signal** — players learn "anglerfish = we're deep." This also extends the established variant-encodes-behavior principle to a depth dimension.

**Caution:** if depth-gating is a purely cosmetic *filter over the existing spawn output* (engine picks a target; theme chooses which sprite/creature skins it, restricted by current zone), it's a theme concern and fine. If it changes the **generation rules or spawn selection logic** in core, that crosses into core-logic territory and must go through Laws / Andrew before Claude Code wires it.

**Recommended framing:** keep core spawn logic untouched; the theme maintains a per-zone creature pool and assigns appearance + behavior archetype at render time based on current `depthRatio`. Confirm this reading with Andrew before build.

---

## 9. Audio & pressure ambience

Sound sells pressure better than visuals.

- Deepening ambient drone; high frequencies muffle as depth increases.
- Intermittent hull/structure creaks and groans at depth.
- Diver regulator bubbles rising up-screen (reinforces underwater + "up = the way out").
- A vignette that tightens with `depthRatio` (viewport closing in).

All cosmetic; lives in the cartridge audio + overlay layer.

---

## 10. Level threshold transitions

At each tier boundary (5001 / 20001 / 50001), punctuate the continuous drift with a short scripted beat so each zone feels *earned* and distinct:

- Brief light cut / thermocline shimmer wipe.
- Depth gauge spins/accelerates.
- Zone card: e.g. `ENTERING TWILIGHT ZONE — 600 FT`.
- At the **50001 → Aquanaut** transition, trigger the §4 wall-out reveal (canyon opens into the abyss).

Keep transitions short (≈1–1.5s) so flow isn't broken.

---

## 11. Laws compliance checklist (for Claude Code)

- [ ] All effects confined to `/cartridges/aquanaut/` theme files. No `/core` edits.
- [ ] Empty Cartridge / Blank untouched.
- [ ] No change to scoring, challenge generation, or dataset logic. Depth system only *reads* score.
- [ ] Separate HTML / CSS / JS / asset files maintained (modular structure).
- [ ] §8 enemy zone-gating confirmed as cosmetic filter (not core spawn-logic change) before wiring.
- [ ] Demo Mode behavior preserved; nothing here touches Publish/Holodeck.

---

## 12. Open questions for Andrew

1. Depth units — feet or metres? And max depth at `depthRatio = 1.0`?
2. Aquanaut-tier soft ceiling score for the `depthRatio` interpolation (proposed 80000).
3. Confirm §8 is a cosmetic creature-pool filter, not a spawn-logic change (Laws-relevant).
4. Fourth Level-1 enemy still TBD — does it belong to the sunlight zone, and what's its movement archetype?
5. CSV is provisional — lock tier values before Claude Code hard-wires the depth anchors, or keep them config-driven so re-tuning the CSV doesn't require a rebuild? (Recommend config-driven.)

# The Aquanaut — Tier 1 Creature Asset Pack

**Type:** Asset manifest + orientation convention (Part A deliverable)
**Status:** Re-export spec — the current `Tier 1 v2 Images/` renders have baked,
fully-opaque backgrounds (painted "transparency" checkerboard / dark bg) and **cannot
be used as-is**. Re-export each to the canonical name below **with true alpha**
(genuinely transparent background, real alpha = 0), then they wire in unchanged.

Related: [`Aquanaut_Creature_Asset_Contract.md`](Aquanaut_Creature_Asset_Contract.md) (multi-part rig contract).

---

## 1. Transparency requirement (the blocker)

- **True alpha only.** Background must be genuinely transparent (alpha = 0), not a
  painted checkerboard and not a flat colour. Verify: the four image corners must read
  alpha 0.
- **No baked drop-shadow / outer glow** — the engine adds the bioluminescent aura and
  silhouette glow (Laws §0.17: glow follows the PNG silhouette, not the bounding box).
- A tight inner rim-light baked into the creature is fine.

## 2. Orientation convention (documented per the handoff)

- **Suffix = which end sits at each image edge.** `_ht` = **h**ead-left / **t**ail-right
  → the sprite **faces left**. `_th` = tail-left / head-right → **faces right**.
- **Profiles ship as `_ht` only (facing left).** The right-facing version is produced
  at **runtime by horizontal mirror** — do **not** store a second file. (The engine
  already mirrors: it flips the sprite horizontally whenever the creature's travel
  direction disagrees with the sprite's native facing — heads always lead.)
- **Head-on `front_*` views and ALL jellyfish assets are symmetric** → **no `_ht`/`_th`
  suffix**, and they are **exempt from the mirror rule**.

## 3. Canonical manifest (re-export to these exact names)

Place final, true-alpha PNGs in `files/assets/Tier 1/Targets/`.

| Final filename | Role | Orientation | Wire when |
|---|---|---|---|
| `target_greatwhite_profile_ht.png` | Gameplay swim sprite | `_ht` (faces left, mirror at runtime) | Part A |
| `target_greatwhite_front_closed.png` | Head-on, mouth closed | symmetric, no suffix | **Part B (parked)** |
| `target_greatwhite_front_open.png` | Head-on, mouth open | symmetric, no suffix | **Part B (parked)** |
| `target_moray_profile_ht.png` | Gameplay swim sprite | `_ht` (faces left) | Part A |
| `target_moray_front_closed.png` | Head-on, mouth closed | symmetric, no suffix | **Part B (parked)** |
| `target_moray_front_open.png` | Head-on, mouth open | symmetric, no suffix | **Part B (parked)** |
| `target_boxjellyfish_drift.png` | Gameplay swim sprite | symmetric, no suffix | Part A |
| `target_boxjellyfish_tentacles.png` | Tentacle curtain (one layer) | symmetric, no suffix | Part A |
| `target_boxjellyfish_oralarms.png` | Oral-arm detail layer | symmetric, no suffix | Part A |
| `target_boxjellyfish_front_closed.png` | Head-on, closed | symmetric, no suffix | **Part B (parked)** |
| `target_boxjellyfish_front_open.png` | Head-on, open | symmetric, no suffix | **Part B (parked)** |

### Staging → final renames (typo fixes)
- `target_greatwhite_proflie_ht.png` → `target_greatwhite_profile_ht.png`
- `target_greatewhite_fromt_closed.png` → `target_greatwhite_front_closed.png`
- `target_boxjellyfish_tentacle_1_2_3.png` → `target_boxjellyfish_tentacles.png` (single curtain layer)
- (the remaining 8 are already correctly named)

## 4. Role split — why some assets wait

- **`*_profile_ht` / jelly `drift`** = side-on **swim sprites**, the gameplay creature.
  These integrate in **Part A** (single-sprite render + procedural swim motion).
- **`*_front_closed` / `*_front_open`** = **head-on attack/kill-screen frames** (mouth
  states). These serve the 1st-person helmet POV / diver-attack model, which is **Part B
  (combat model)** — gated behind the Overview Impact clause. **Staged but not wired**
  until that clause clears.
- The new set is *whole-creature views* (profile + front), not the body/tail/jaw parts
  of the rig contract — so the swim sprites use the single-sprite path; the multi-part
  rig stays in its fallback (no regression).

## 5. Retirement (executed at integration, not before)
- The entire **barracuda** set (`target_barracuda_1/2/3_ht.png`) is **RETIRED** — replaced
  by **moray**. Deleted only **after** the moray swim sprite is live, so the build is
  never left without working creature art.
- Any superseded `target_greatwhite_*` / `target_boxjellyfish_*` old singles
  (`_1/_2/_3_ht`) are replaced by the new `profile`/`drift` sprites and retired in the
  same pass.

## 6. Validation checklist (at integration)
- [ ] Corner alpha = 0 on every asset (true transparency).
- [ ] `_ht` profiles face left; runtime mirror produces clean right-facing.
- [ ] No fringing / haloing along creature edges.
- [ ] Dimensions sane for in-game scale (current renders are full-res ~1.7–2.5k px).
- [ ] Game renders creatures with no opaque background box.

## 7. Flipbook frames — animating a swim sprite (2026-06-20)

The engine cycles a creature's sprite frames over time (ping-pong: `1 → 2 → 3 → 2 → 1`)
on top of the procedural sway, so a few hand/AI-drawn poses read as one undulating
creature. **No engine change needed to add frames — just drop them in and list them.**

**Which creatures.** Use flipbook for **body-shape changers** — the **moray** (curled →
half → straight) and the **great white** (tail sweep). The **box jellyfish stays
procedural** (bell scale-pulse + bob, already in the engine) — don't flipbook it.

**Naming — frame number sits before the `_ht` suffix:**
```
target_moray_profile_1_ht.png     ← frame 1 (e.g. curled)
target_moray_profile_2_ht.png     ← frame 2 (half)
target_moray_profile_3_ht.png     ← frame 3 (straight)
```
Then list them in that creature's `CREATURE_SPRITES` array (in order). Speed is per
creature via `CREATURE_TYPES[...].animFps` (moray 5, great white 3 — tunable). The
runtime mirror (`_ht` → faces-left, flipped when swimming right) applies **per frame**.

**⚠️ Generate frames by EDITING the existing frame — not from scratch.** Use
img2img / "same creature, identical everything, new pose" / all frames in one shot.
Independent generations drift in colour, lighting, blotch pattern, and eye, and the
auto-align below can't fix that — the surface will *shimmer* even when centred. Keep
size, colour, and lighting identical; change **only** the pose.

**What the engine does for you.** At load it finds each frame's opaque bounding box and
**centres every frame on the creature's body**, so small position/scale drift between
frames doesn't make it jump. (It does **not** correct surface drift — see the warning.)

**Expectation for v1:** a stylized undulation, not rig-smooth swimming. That's correct.
For rig-smooth motion later, the separable multi-part rig (see the Creature Asset
Contract) is the upgrade path.

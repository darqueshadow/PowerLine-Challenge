# PROPOSED — Overview append: Movement Models & Multi-Step Challenges (Pitstop / NEMS 500)

**Status:** AUTHORIZED by Andrew 2026-06-20 ("Authorize now — build Slice 1"), per the Aquanaut precedent where Andrew authorizes cartridge-layer logic directly and the clause records it. **Async ratification with Claude Chat still pending** — append this text to the Overview when convened. Build of the single-leg slice proceeds under this authorization.
**Target:** `Documents/Core Documents/2. Overview.txt` — append a new subsection under *Gameplay Flow* / *Dynamic Dataset Logic*.
**Authority:** Laws permit *"append or clarify when instructed"* (never remove/rewrite). This clause **clarifies and extends** the Overview; it does **not** rewrite Laws §0.3 (theme scope), §0.4 (Target lifecycle), or §0.9 (Impact). It binds NEMS 500 (Pitstop) to engine-level, theme-agnostic models — the **same shared machinery The Aquanaut needs** (solve once).

---

## Why this clause exists

The Overview today describes exactly one movement/challenge model:
- **Movement/Impact (Laws §0.4, §0.9):** a Target *falls* and "Impact" = reaching the *lower boundary* uncleared.
- **Challenge (Overview "Dynamic Dataset Logic"):** a *single-shot* `generateChallenge()` → one Challenge, one Command, one clear.

NEMS 500 needs three things the base Overview doesn't cover. Rather than rewrite the Laws, this clause authorizes them as **engine-level, config-driven, theme-agnostic** capabilities the Overview blesses — following the precedent that "anything beyond single-shot challenge + fall-lifecycle is cartridge-layer logic requiring authorization."

## Proposed clause text (append to Overview)

**1. Movement Models (config-driven).** Engine movement is abstract and selected by configuration. The existing *fall-to-lower-boundary* behaviour is the **"descent"** model and remains the default (Laws §0.4/§0.9 unchanged). The engine additionally provides a **"route-traversal"** model: a unit advances along an ordered list of **position gates** (a route); there is no fall and no lower-boundary Impact. Movement is theme-agnostic — the engine moves an abstract unit along an abstract route; themes only skin it.
  - *NEMS 500 uses route-traversal with an **impulse** profile:* each correct Command is an acceleration burst; the unit coasts and drags between gates (the coast is the natural pause). A position-gated Command submitted before arrival is a harmless no-op (not a Miss). A content error is a "sputter" (momentum loss), not a fall.

**2. Multi-Step Challenges (Legs).** A Challenge may be an ordered **sequence** of position-gated sub-challenges — a **"leg"** — rather than a single Command clearing one Target. NEMS 500's leg is the three-beat **AP → ENP → BSE** post sequence, each beat gated by track position. The Overview's Universal Formula still governs **each beat** (`[PL] [Unit] [Verb] [Base]`); this clause only allows beats to be **chained** into a leg, advanced by validation. Hit/Miss semantics (Laws §0.7/§0.8) are unchanged per beat.

**3. Tire / Pit / Fuel consequence layer (optional, strippable).** An optional cartridge-layer consequence system: tire damage on mis-enter, fuel burn over distance, and a pit detour (Fleet/72123) reached via the on-route base nearest the pit. It is **disabled entirely by the No-Pit toggle** and is not part of core scoring. Advanced layer, not core.

**Authority note (verbatim suggested):** *"This is a clarification/append (Laws permit 'append or clarify when instructed'), not a rewrite of Laws §0.4/§0.9. It binds NEMS 500 to engine-provided, theme-agnostic movement/challenge models (route-traversal, multi-step legs) and an optional consequence layer. The descent model and single-shot challenge remain the defaults for other cartridges."*

## Core ↔ Cartridge interface (theme-agnostic, so Aquanaut can reuse)

So `/core` stays neutral and the cartridge only skins:
```
MovementModel: 'descent' | 'route'           // engine-level, config-selected
Route: ordered [gateId...]                    // abstract gates (NEMS: base ids)
Leg: ordered [step...]  step = { cmd, gate }  // NEMS: [AP,ENP,BSE] × position gate
Engine emits:  onArriveGate(gateId), onStepValidated(step), onLegComplete(legId)
Cartridge supplies: validate(input, activeStep) -> hit|miss|noop ; skins unit/route/gauges
```

## On ratification

Once authorized, Phase 1 build begins with the **single-leg "prove it first" slice** (one leg A→B: AP/ENP/BSE position-gated, impulse movement, live command input + validation vs. sample data) — Andrew's stated core principle — before any laps, opponents, or pit logic.

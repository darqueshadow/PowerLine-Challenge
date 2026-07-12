# Aquanaut — Creature System Update

**From:** Claude Chat (Senior Dev) · relayed by Andrew
**For:** Claude Code (Systems Integrator)
**Type:** Design update + status. **Not** a build order.
**Mandate:** Plan only. Report current cartridge state. Do **not** build creature combat, sweep modulation, or kill-screen code past the OPEN items below.

---

## 1. What changed
The Aquanaut moves from a uniform model (one sonar sweep + a flat creature roster) to a **per-tier signature creature system**. Each depth tier has one signature creature whose **biology drives a mechanic twist**. The reveal mechanic is no longer the same at every depth.

Organizing principle to encode: *creature biology → mechanic fusion.* The creature isn't decoration on top of a mechanic; the creature **is** the mechanic's delivery.

## 2. Confirmed tier → creature → mechanic

| Tier | Creature | Biology → Mechanic |
|---|---|---|
| L1 Bubble Hopper | **Pufferfish** | Inflation telegraphs the attack / premature-trigger state. Standard sonar sweep. Clearest water. |
| L2 Rig Walker | **Electric ray / eel** | Periodic discharge scrambles the HUD or freezes command input for a beat. |
| L3 Crush Depth Operator | **Octopus** | **Blue** ink cloud obscures a region of the field *and* misleads (see 3). Foreshadows a possible cephalopod escalation (giant squid). |
| L4 The Aquanaut | **Anglerfish** | Bioluminescent lure swing **replaces the sonar sweep**. Near-total darkness; the reveal light is also the bait. |

**Reveal axis (confirmed intent):** clear → flickering → blotted → dark. Each creature attacks the player's *ability to see* in a different way. This is the difficulty spine — diegetic, not arbitrary knobs.

## 3. Octopus ink — tuning note
The ink is **blue specifically** because blue is already a signal color (challenge box turns blue = hittable/hostile). The misdirection is that ink reads like the "go/hostile" signal. Implementation tension to flag: ink-blue and signal-blue must be **distinguishable enough to be fair, close enough to mislead.** Treat as a tunable, not a fixed hex.

## 4. OPEN — do not implement past these
1. **Roster scope (BLOCKING).** Replace the locked three (great white, moray eel, box jellyfish) with the per-tier signatures, **or** layer signatures on top of a base roster present at all depths? Undecided by Andrew. Gates asset scope and spawn logic. Do not assume either.
2. **Sonar sweep is no longer universal.** It is now tier-modulated (overridden at L4, modulated at L2/L3). This contradicts the current `Aquanaut_Depth_Descent_Spec.md`, which treats the sweep as fixed. Needs an Overview edit before build.
3. **TOC home.** The gated Transfer-of-Care mechanic previously rode on the pufferfish. Pufferfish is now the L1 signature. Where does TOC gating live now — pufferfish behavior, or a cross-cutting mechanic independent of the signature creatures? Undecided.
4. **Attack-based combat Overview clause** — still not drafted. Unchanged prerequisite: no combat / kill-screen code until it lands.

## 5. Governance note
These rules are **Overview-level** and are **design intent pending ratification into the Overview** — not canon yet. Laws > Overview > Build Procedure still governs. Treat this doc as direction to plan against, not as settled spec to build from.

## 6. Immediate action for Code
Plan only. Report current cartridge state and where it diverges from the above. Hold at items 1–4.

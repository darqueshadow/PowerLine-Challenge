# Pitstop — Core Mechanic Design Note

**Cartridge:** Pitstop (formerly "NEMS 500" — NEMS branding dropped)
**Status:** Design note / brainstorm capture. NOT yet governance. Combat/damage
mechanics below require a Pitstop Overview clause (attack-model equivalent to
Aquanaut §0.9) before Claude Code implements them.
**Author:** Claude Chat (Senior Dev) — design capture for Andrew
**For:** Claude Code awareness. Do not implement damage/collision logic until the
Overview clause exists.

---

## 0. Locked Title-Screen Tagline

> **"Type fast and risk the wall. Type clean and bleed the speed."**

This is a **must-have** on the title screen. Locked by Andrew. Do not reword.
It states the entire risk/reward loop in one line.

---

## 1. Concept

Top-down racing cartridge on the Niagara Region map (geography retained from the
prior build — Westwood pit anchor, base 72122). Correct CAD command sequences
(AP → ENP → BSE) deliver acceleration. The new layer: the **track has turns and
computer-controlled rival units**, and input accuracy is evaluated **live, per
keystroke** — not only on Enter.

The player's unit position and speed are driven by *how correctly they are typing
right now*. Enter is the **commit** — the moment any current error is locked in.

---

## 2. Live Evaluation Model

- Input is evaluated on **every keystroke**, not just on Enter.
- **"Wrong" = divergence from a valid prefix.** As long as the current buffer
  could still become a correct command, the unit tracks straight. The instant a
  character is typed that no valid command begins with, the buffer is "diverged."
  - Example: typing `EN` toward `ENP` is NOT an error (valid prefix).
  - Typing `EZ` (no valid command starts with it) IS divergence.
- This prefix rule is the **load-bearing spec decision**. Everything else hangs
  off it.

> Note: The project-wide "silently normalize Andrew's spelling" principle applies
> to CHAT ONLY. In-game, typing accuracy is the game — the player is never
> auto-corrected.

---

## 3. Escalation Ladder (error response)

Error consequences escalate in three stages:

1. **Minor / brief divergence → speed bleed only.**
   A tolerance "deadzone" — small or short-lived errors cost momentum but do NOT
   veer yet. Must be *more than a hiccup* before drift arms. (Config: error
   magnitude / duration before veer arms.)
2. **Sustained or larger divergence → veer begins.**
   Past the deadzone, the unit drifts laterally. Drift magnitude is a function of
   how far the buffer has diverged (error characters × config drift rate).
3. **Enter-dirty OR timeout → collision + damage.**
   Committing a diverged buffer with Enter locks in the crash. Sitting too long
   without an entry also resolves as a crash (prevents the "never press Enter"
   exploit). (Config: no-entry timeout window.)

---

## 4. Backspace = Correct + Brake

Backspace does double duty:

- Pulls the buffer back onto a valid prefix → unit steers back toward center.
- **Acts as a brake** → correcting costs speed.

Consequence: correction is never free. The whole game becomes a throttle
decision — **type fast and risk the wall, or type clean and bleed speed to stay
safe.** (This is the tagline, restated as the core loop.)

---

## 5. Track Economy — Turns vs. Straightaways

- Roughly **equal turns and straightaways.**
- **Turns = pressure moments.** Veer system is armed; the "wall" is the track edge.
- **Straightaways = recovery economy.** Rebuild speed, breathe, and bleed down the
  stress meter (see §7). Straights are not dead air — they are where you recover.
- (Proposed, Andrew's call: veer is *armed during turns and overtakes*; straights
  are breathers. Alternative is always-on veer.)

---

## 6. Overtaking Rival Units

- Same mechanic as a turn, different collision target.
- When overtaking a computer unit, divergence causes the player to **veer toward
  the rival's flank**. Enter-dirty → collision with the rival → damage.
- One system, two dressings: **turn wall = track edge; overtake wall = rival flank.**

---

## 7. Stress Meter — HYBRID (locked direction)

Andrew selected the **hybrid** model:

- Stress is **mechanical** — as it climbs it degrades performance (e.g., shrinks
  the deadzone, widens veer, and/or tightens the reaction window). Exact levers TBD
  and config-driven.
- Stress **bleeds off on clean straightaway typing** — reinforcing the turn/straight
  rhythm: turns build stress, straights calm it back down.
- This creates managed tension rather than an unrecoverable death spiral, because
  clean driving actively pays the meter down.

---

## 8. Open Decisions (Andrew's calls — not yet locked)

- **Stress source:** committed errors only, OR also near-misses / recovered veers?
  ("Recovered veers still stress you out" is more dramatic and punishing.)
- **Straightaway safety:** are straights fully safe, or do errors there still bleed
  speed (just without veer)?
- **Exact config values:** deadzone threshold, drift rate, correction/brake rate,
  no-entry timeout, stress climb/bleed rates, and which performance levers stress
  degrades.

---

## 9. Config Levers (all data-driven, never hardcoded)

- Deadzone: error magnitude / duration before veer arms
- Drift rate: lateral movement per error-character
- Backspace brake rate: speed cost per correction
- No-entry timeout: ms before an unsent buffer resolves as a crash
- Stress climb rate, stress bleed rate (clean-typing recovery)
- Stress → performance mapping (deadzone shrink / veer widen / window tighten)
- Turn/straight ratio and per-segment difficulty

---

## 10. Governance / Handoff Note

- Damage, collision, and crash consequences are **attack-model territory** — the
  same class of mechanic currently gating Aquanaut behind §0.9.
- **A Pitstop Overview clause must exist before Claude Code implements** any
  veer→collision→damage logic. This note is design capture only.
- Rename cleanup: pick a canonical `pitstop` cartridge id and sweep all "NEMS 500"
  references (folder id, asset names, config keys) from the Phase 0 rough-in.
- Naming-collision check: cartridge name "Pitstop" vs. in-game pit *mechanic* — keep
  distinct labels so specs/CSVs stay unambiguous.

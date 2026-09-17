> **FILING NOTE — Claude Code, 2026-09-15.** Filed here verbatim from Andrew's
> `Downloads/whack-a-cav-mini-game-context-packet.md`. Everything below the rule is the packet as
> written; nothing in it has been edited. What changed around it on 2026-09-15, on Andrew's
> instruction:
>
> - **The exemption it claims is now written into governance.** Laws v2.0 gained the
>   *Standalone Cartridge* definition and a matching Core Law (amendment A1), and Whack A CAV is
>   the first entry on that register. Overview and Build Procedure carry matching notes. The
>   packet's own framing (design-stage, nothing build-authorized) is exactly what the amendment
>   requires, so nothing below is contradicted.
> - **Andrew's rulings on 2026-09-15:** the name is **Whack A CAV** (folder `Game/cartridges/Whack A CAV`);
>   work on it happens in its **own Claude Code session**, resumed with **`continue_wac`**; and he
>   believes it is the Overview's earlier *"unnamed airport / CAV concept"* with a better mechanic,
>   so that roster line was renamed rather than a second one added.
> - ⚠️ **One conflict with system-wide governance is NOT resolved.** "Menu placement: Speed
>   Drills" below predates the Overview v2.0 flat roster, which retired every menu category
>   (Speed Drills included), and the live hub has no categories. A Mini-Game Packet may not
>   contradict system-wide menu structure, so this placement is **not adopted**. It sits with
>   the §10 open items for Andrew, and it matters only when the cartridge is inserted into the
>   Arcade hub, which happens only when he says so.
> - The packet cites "Technical Manual §J" and "Laws v1.6 / v2.0". The governance stack that
>   applies is the v2.0 set in `Documents/Core Documents/` (Laws → Overview → Build Procedure).

---

# Whack A CAV — Mini-Game Context Packet

**Status:** Concept / brainstorming draft — not yet reviewed by Andrew for build authorization.
**Document type:** Mini-Game Context Packet (per Technical Manual §J / §J "What are Context Packets?").
**Governance status:** Exempt from the Laws v1.6 / v2.0 Target→Zone→Impact rulebook by Andrew's explicit decision. This is a standalone cartridge design. It does not inherit Empty Cartridge lifecycle language, Impact naming convention, or the falling-Target model. Per the Technical Manual's own rule of thumb: a Mini-Game Packet must not contradict the System Packet on anything system-wide (menu structure, mode flags, dev-mode gating) — but its internal gameplay logic is its own.
**Menu placement:** Speed Drills.

---

## 1. Concept

A whack-a-mole variant built around the real Niagara EMS **CAV (Conditional Availability)** workflow. Instead of a mole, a creepy-crawly creature emerges from a unit's slot when that unit's CAV status is about to lapse unresolved. The player must react in real PowerLine syntax before it escapes.

This is a **two-phase mechanic per unit slot**, not a single pop-up/clear loop:

- **Phase A — Trigger/Place:** the system signals that a unit needs a CAV opened. The player must type `CAV #### TYPE` to place it.
- **Phase B — Countdown/Clear:** once placed, the CAV counts down its real-world duration (compressed). The player must type `RCAV ####` before time runs out.

> **OPEN DECISION (Andrew's call, drafted as my recommendation):** You said you were unsure whether to replace the pure-reactive loop or add a trigger — I've resolved this by making the trigger and the placement *the first phase*, so the game drills both `CAV` and `RCAV`, not just `RCAV`. If you actually want the simpler reactive-only version (CAVs already open when the round starts, player only ever clears), Phase A can be cut entirely and this becomes a one-phase game. Flag which you want before this goes to Code.

---

## 2. Command syntax (confirmed by Andrew)

| Action | Syntax | Example |
|---|---|---|
| Open/place a CAV | `CAV #### TYPE` | `CAV 2101 MB` |
| Clear/remove a CAV | `RCAV ####` | `RCAV 2101` |

`####` = unit number. `TYPE` = one of the CAV type codes below.

---

## 3. CAV type table

| Code | Meaning | Real-world duration | Notes |
|---|---|---|---|
| VS | Vehicle Service | **TBD — need real duration from Andrew** | |
| STR | Stretcher Clear | **TBD** | |
| SS | Start Shift | **TBD** | |
| EOS | End of Shift | **TBD** | |
| MB | Meal Break | **TBD** | Do not assume 30 min — confirm actual Niagara EMS value |

**INVESTIGATE-FIRST flag for Claude Code:** durations above are placeholders only. Do not fabricate real CAV timing values. This table must be filled in by Andrew (or sourced from the real Data Sheet / CSV) before any timer logic is built against it.

---

## 4. Playfield structure

- Fixed grid of **unit slots** ("holes") — count TBD, suggest 6–9 for a first pass, configurable.
- Each slot is a digital-display readout showing:
  - Unit number
  - Current phase state (idle / trigger pending / counting down / escaped)
  - A countdown timer once a CAV is placed
- Only a subset of the full unit roster is "in play" at once; slots can cycle to new units between rounds.

---

## 5. Phase A — Trigger/Place

- At intervals (random or scheduled — TBD), a slot signals that a CAV is due: some visible/audible cue (flash, chime) naming the unit and, optionally, the type.
- The player has a grace window to type `CAV #### TYPE` correctly.
- **Escalation if ignored (OPEN — needs Andrew's call):**
  - Option 1: after the grace window, the CAV auto-opens on the "wrong"/default type and Phase B begins anyway (keeps the round moving, but removes the player's chance to drill placement for that instance).
  - Option 2: an ignored trigger goes straight to a Phase-B-style escape/penalty without ever opening — harsher, treats a missed placement the same as a missed clear.
  - Drafted assumption for now: **Option 1**, since it keeps the game a continuous flow rather than a hard fail on the first phase. Flag if you want Option 2 instead.

---

## 6. Phase B — Countdown/Clear

- Once a CAV is placed (by the player in Phase A, or auto-opened per §5), the slot's timer starts counting down from that CAV type's real-world duration, compressed by a tunable ratio.
- **Recommended default ratio: 1 real minute = 1 game second.** Rationale:
  - Short CAV types (a few minutes) become a handful of seconds — appropriately urgent.
  - Long CAV types (a full shift-length one, if any) stay playable rather than dragging.
  - This is a single config value, not hardcoded — trivial to retune once it's actually playable.
- **Random start point (difficulty lever):** rather than every countdown starting fresh at its full duration, higher difficulty tiers can spawn a CAV already partway elapsed (e.g., a timer that would start at 10:00 instead starts at 07:34), giving the player less warning before the "bold font" urgency threshold. Lower tiers always spawn fresh.
- **"Bold" threshold:** as a countdown nears zero, the slot's font goes bold — this is the visual cue that the creature is about to emerge. Exact threshold (last X seconds, or last X% of duration) — TBD, suggest tuning by feel once playable.
- **Emergence:** at the bold threshold (or at zero — TBD which), the creepy-crawly creature appears in that slot.
- **Clear:** player types `RCAV ####` to whack it before it escapes. Successful clear despawns the creature, awards points, resets the slot to idle.
- **Escape (failure state):** if `RCAV ####` isn't entered before the timer expires, the creature crawls/slithers out of the hole. Slot enters an "overdue" visual state (comparable in spirit to the Aquanaut's Hailing Buoy wreck — a lingering visible consequence rather than a clean reset). Recovery from an escaped state — TBD (does it clear itself after a delay, does it require another `RCAV`, does it just sit as a visible penalty for the rest of the round?).

---

## 7. Scoring (draft — adjustable)

- Successful `CAV #### TYPE` placement within the trigger window: small points.
- Successful `RCAV ####` clear before escape: larger points, possibly scaled by how much time was left (faster clear = more points), mirroring the streak logic already used in Hailing Buoy.
- Escaped/unresolved CAV: no points, and (TBD) some penalty — point deduction, or purely a visual/pressure penalty with no score hit.

---

## 8. Difficulty tiers (draft shape)

Difficulty likely scales via combination of:
- Number of simultaneous active slots
- Frequency of new Phase-A triggers
- Random start-point compression (§6) on higher tiers
- Possibly a wider mix of CAV types introduced as tiers progress, if some types are considered "harder" (shorter fuse, less common)

---

## 9. Theme (not yet designed — Gemini's lane)

- "Creepy crawly" creature family: not yet chosen (roaches, spiders, snakes, rats, etc. all fit the whack-a-mole horror-adjacent tone). Possibly one creature type per CAV code, similar in spirit to the Aquanaut's per-tier creature roster — open idea, not decided.
- Visual theme of the slots themselves (digital display board, retro terminal, etc.) — open.

---

## 10. Open items requiring Andrew's decision before Code builds anything

1. One-phase (reactive-only) vs. two-phase (trigger+place, then clear) — packet currently drafted as two-phase.
2. Real CAV type durations (§3) — currently all placeholders.
3. Escalation behavior when a Phase-A trigger is ignored (§5) — auto-open vs. hard escape.
4. Bold-threshold timing and exact emergence trigger point (§6).
5. Escaped-state recovery behavior (§6).
6. Scoring penalty (if any) for an escaped/unresolved CAV (§7).
7. Slot count and difficulty-tier specifics (§4, §8).
8. Creature/theme direction (§9) — hand to Gemini once mechanics are locked.

---

## 11. Handoff note for Claude Code

This packet is design-stage only — nothing here is build-authorized yet. Once Andrew resolves the open items in §10, this document (or its revision) becomes the source spec for implementation. Because this cartridge is explicitly exempt from the Laws/Overview Target/Zone/Impact model, do not attempt to map its mechanics onto that system's terminology or reuse `/core` engine assumptions built for the falling-Target lifecycle — build it as its own self-contained mechanic, same as any other cartridge's independent script.js, just without inheriting that particular vocabulary.

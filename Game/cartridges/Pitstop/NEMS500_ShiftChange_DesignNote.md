# Mini-Game Context Packet (Draft) — NEMS 500: "Shift Change"

**Status:** Design locked as discussed with Andrew. Not yet buildable — depends on the shared multi-command-chain / non-falling-movement engine capability, which is gated behind the Overview §0.9 clause (shared with The Aquanaut). This document is a design record, not an implementation order.

**Scope note (per Technical Manual, Section J):** This is Cartridge-level detail specific to NEMS 500. It does not alter Laws, Overview, or core engine rules, and must not contradict the System/Canon documents. If anything here implies a core engine change, that belongs in the Overview §0.9 clause, not here.

---

## 1. Naming

- The event/mechanic is called **Shift Change**. Locked.
- Deliberately *not* called "Handoff" — that term is already real dispatch vocabulary for relieving the desk, and reusing it here would teach the wrong instinct.
- Deliberately *not* called a "Zone" — collides with Laws §0.9 (Impact/Zone terminology).
- "Shift Change" doubling as a real automotive/racing term (gearbox) is intentional flavor, not a conflict — consistent with how "Pitstop" already does double duty for this cartridge.
- No separate name is needed for *where* this happens — see Section 2. The concept of a fixed "flip area" location was explored and superseded by an event-based trigger instead.

---

## 2. Trigger Flow

Normal posting loop is unchanged: **AP → ENP → BSE.**

1. While driving a normal leg, a **Shift Change warning** may fire (randomly) as radio-chatter-style bubble: *"Shift Change coming up after next base."*
   - This is a **one-leg-early telegraph**, not an instant demand. It is issued *before* the player is mid-keystroke on their current BSE, specifically so it never interrupts an action already in progress.
2. Player finishes the **current** leg normally (AP → ENP → BSE, no interruption).
3. On the **next** leg, after ENP, instead of BSE the player types **LA** (Local Area) to acknowledge the Shift Change and stay mobile rather than committing to a base.
   - LA is a real PowerLine command (crew staying on the air / not yet committing to a base). This gives it genuine mechanical purpose in-game rather than being unused flavor.
4. Entering LA opens the **Shift Change box** (Section 3).
5. Once the box is cleared, the player returns to normal driving and completes **BSE** to finally commit to a base — closing out the leg they were mid-course on the whole time.

**Car never stops moving.** This is an overlay challenge layered on top of ongoing driving, not a detour/pull-off like the Westwood tire pit. Other single-command targets may still spawn and need clearing while the Shift Change box is open — the player is genuinely splitting attention between their own leg progress and the box.

**No forgiveness rule needed.** Because the warning is always given a full leg ahead of time, a miss during Shift Change is a real miss, not a blindside — there's no scenario where the player is caught off guard.

---

## 3. The Shift Change Box

- Contains a **short list of units**, all already sitting in **EOS** status (EOS itself is not part of the challenge — it's already done before the box appears).
- A **simulated wall-clock** ticks in the box, scaled to the deadline the list represents (e.g., a list of "1730 trucks" shows a clock reading something like 17:28:21, not real elapsed time). Clock speed is a config value — Claude Code can tune it relative to how much real typing time is needed.
- The clock represents the **real per-unit deadline problem**: if a unit isn't flipped before its threshold time, the CAD can't tell which of the two 12-hour-rostered trucks is meant (the outgoing shift's truck vs. the incoming shift's truck) and forces a disambiguation. This is **not** a single global "midnight" event — it's a per-unit deadline tied to that unit's own roster time.
- Player must run each unit in the list through its full chain before the box closes and BSE becomes available again.

---

## 4. The Real Chain (authoritative — corrects earlier draft)

For each unit in the box, the required sequence is:

```
RCAV
OD
SS
BSEH        ← must happen BEFORE CAV SS, not after or simultaneously
CAV SS
```

**NOTE** may be entered **any time after SS** — genuinely unconstrained, not paired with BSEH as previously assumed.

**Why BSEH must precede CAV SS (real CAD behavior):** Once SS'd, a dispatcher could technically CAV SS immediately (turns the truck grey). But BSEH is what turns the truck green — a CAD quirk, not logic. If CAV is done before BSEH, the truck *appears* green once BSEH lands, but the stale CAV is still attached underneath. The dispatcher cannot simply CAV SS again to clear it — they must **RCAV, then CAV again**. This is a real, no-added-drama example of a **fixable-but-punishing** error (not a hard critical fail) for the error-severity table below.

**Known real-world command batching quirk (context, not yet fully mapped to game rules):**
- EOS can be applied to a list of units at once.
- SS and CAV are strictly single-unit — no batching.
- RCAV, OD, BSEH batchability is not yet confirmed and remains open (see Section 6).

---

## 5. Deliberately Dropped / Rejected

Keeping these here so they don't get silently reintroduced later:

- **90-second BSEH response penalty** — dropped. This was context Andrew shared to explain a real CAD quirk, not a mechanic to implement. BSEH/NOTE are not a speed-vs-safety tradeoff; BSEH is simply a required step before CAV SS.
- **A "forgive the first miss" rule** — dropped. Made moot by the one-leg-early warning; a fair-warned miss doesn't need forgiveness.
- **Literal 30/45-minute real-time waits** — dropped early. The simulated wall-clock replaces this; the training value was never in the waiting itself.
- **A stopped/parked "harder pit stop" version** (as both Gemini and Copilot proposed) — considered and rejected. Andrew confirmed the scattered, car-keeps-moving version is the intended direction.
- **Fixed "flip area" road locations** — superseded by the random Shift Change trigger event. No location-based term needed unless this changes.

---

## 6. Open Questions (not yet locked)

- **Full critical-vs-fixable error table.** Only one entry is confirmed so far (CAV-before-BSEH = fixable-but-punishing, requires RCAV + redo). The rest of the chain's error severities still need Andrew's CAD knowledge.
- **Miss consequence system.** Does a Shift Change miss reuse Pitstop's tire-damage pool, or does it get its own separate damage/penalty track (e.g., a car-damage system distinct from tires)? Andrew's instinct leaned toward a separate consequence but this isn't finalized.
- **RCAV / OD / BSEH batchability.** Confirmed real-world: EOS batches, SS and CAV don't. Unconfirmed for the remaining three steps — affects whether the box ever lets a player clear a step across multiple units in one action.
- **Trigger conditions for Shift Change.** Currently described as a random leg-boundary event. Unconfirmed whether it should ever be tied to specific bases/locations rather than being purely random.
- **Terminology for "flipping trucks" as a player-facing term**, if one is still wanted beyond the "Shift Change" event name itself.

---

## 7. Engine Capability Implications (for eventual §0.9 drafting)

This mechanic needs more than a single ordered command chain. For accurate scoping when the Overview clause is drafted, it requires:

- **Partially-ordered multi-step chains** — not simple "any order" flexibility, but a specific structure: strict order (RCAV → OD → SS → BSEH → CAV SS) with one step (NOTE) insertable anywhere after a fixed point (after SS).
- **Multiple concurrent stateful targets** — several units' chains may be in-progress within one Shift Change box.
- **Non-blocking overlay state** — the box must be open and progressing while the main race loop (car movement, other single-command targets) continues unaffected.
- **Per-unit simulated timers**, config-driven speed, independent of the main race clock.
- **A telegraph/delay system** — events that announce themselves a fixed interval before becoming live, to avoid interrupting in-progress player actions.
- **Config-driven event triggering** — random Shift Change events at leg boundaries, tunable frequency.

This is a heavier ask than the original "one chain, one target" scope already flagged for NEMS 500 and Aquanaut, and should be written into the Overview clause explicitly rather than assumed to be covered by the simpler version.

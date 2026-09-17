> **SUPERSEDED 2026-09-16.** The current draft, the one merged into the live packet, is the unsuffixed
> `EGG_TIMER_PACKET_ADDENDUM_2026-09-15.md` beside this file. This copy is kept because its Downloads original is gone.
>
> **FILING NOTE — Claude Code, 2026-09-16.** Filed verbatim from Andrew's
> `Downloads/Egg_Timer_Packet_Addendum_2026-09-15_1.md` (10:58 on 2026-09-16). Everything below the rule is
> the Addendum as written. It was merged into the live `EGG_TIMER_CONTEXT_PACKET.md` the same day, and the
> packet as it stood before the merge is `EGG_TIMER_CONTEXT_PACKET_v3.md` beside this file.
>
> **This is Chat's second draft.** The first (`Downloads/Egg_Timer_Packet_Addendum_2026-09-15.md`, 10:45,
> not filed) had the egg appear the instant a CAV starts, with `RCAV` valid from that moment and the most
> points paid for an instant clear. That brought back the place-then-instantly-clear exploit v2 had closed.
> Code raised it, and this draft makes `RCAV` do nothing until the CAV's real duration has passed. The two
> drafts differ only in §1 (the egg-growth note and the three trigger bullets) and §6 (the clear score).
>
> **"Still open" item 1 is answered.** Andrew confirmed it directly in the Egg Timer session on 2026-09-16:
> only an empty pool ends the game, and waves never do.

---

# Egg Timer — Context Packet Addendum (2026-09-15)

**From:** Claude Chat (Senior Developer role) — design session with Andrew
**To:** Claude Code
**Purpose:** Merge these locked decisions into `EGG_TIMER_CONTEXT_PACKET.md`. This is a decisions log, not new governance — it does not touch Laws or Overview.

**BUILD GATE STATUS: STILL ACTIVE.** Two items below are unresolved. Do not begin gameplay implementation until both are closed and Andrew gives explicit go-ahead.

---

## 1. Timer & Egg Lifecycle

- Base time scale: **1 real minute = 2 game-seconds**. Applied to each CAV type's real duration to get its "bold trigger" point (e.g. VS = 10 real min → 20 game-sec elapsed; MB = 30 real min → 60 game-sec elapsed). This value is **exact, never jittered** — it's the one place real Data Sheet duration must stay untouched.
- Egg appears the instant a CAV starts, and **grows continuously** in size for the whole elapsed duration (visual read on "how close is this one" — no gameplay effect yet, purely informational).
- Readout font is **regular** while elapsed time < that type's base duration.
- **RCAV has no effect before the base duration has elapsed.** This is a hard gate — closes an instant-clear exploit Claude Code caught during review (placing a CAV and immediately RCAV-ing it for free max points). During this regular-font phase, typing RCAV does nothing.
- The moment elapsed time **reaches** the base duration: readout goes **bold**, RCAV becomes valid for the first time, and the egg simultaneously starts its **cracking** animation — bold, RCAV-validity, and crack-start are all the same event, no separate phase between them.
- That trigger moment also starts the **overtime window** — the only window in which the CAV can be cleared before it hatches.
- Overtime window: **flat 5 game-second base**, before jitter.
- Overtime jitter (per-instance randomness on top of the flat 5 sec): starts at **±10% at wave 1**, grows **+5% per wave**, caps at **±35%**. This is where per-instance unpredictability lives — never on the base duration itself.
- If not cleared by the end of the (jittered) overtime window → **hatch** (escape).

## 2. Nests

- Starting count: **5**
- Growth: **+1 nest every 2 waves**
- Cap: **12**

## 3. Waves

- A wave ends when a **quota of CAVs have been resolved** (cleared *or* hatched — either counts toward the quota).
- Quota: starts at **8** for wave 1, **+2 per wave** (wave 2 = 10, wave 3 = 12, etc.)
- Between-wave cleanup window: **5–10 seconds**.
- Waves never end the game on their own — see Section 6 (open item).

## 4. Mess

- Each smoosh **spreads mess to neighboring nests**, not just the smooshed one (already-locked: uncapped accumulation across waves, this addendum doesn't change that).
- Wipe gesture: **click-and-drag** (Andrew's own caveat: may need playtesting to confirm feel).
- Mid-wave wiping costs typing time only, no separate point penalty (already locked pre-existing).

## 5. Pool

- Starting size: **3**
- Damage: **-1 per escape** (existing locked mechanic — mistypes and wrong-type entries never touch it)
- Recovery: **+1 for every full wave completed with zero escapes**
- Recovery cap: **cannot exceed starting size (3)**
- **Name: still TBD** — Andrew is running an AI roundtable for naming candidates. Use placeholder key `POOL` in any config/schema for now; do not hardcode a display name yet.

## 6. Scoring

- Clean clear: RCAV is only ever valid during the overtime window (see Section 1 — no effect before bold). Score is **100 pts if cleared right as it goes bold, decaying linearly to 25 pts** by the moment it would hatch. No clears are possible outside this window, so there is no "instant clear" case.
- Escape: **no point penalty** — pool damage (Section 5) is the only cost.
- Perfect wave bonus (zero escapes that wave): **50 × wave number** (wave 1 = 50, wave 5 = 250, wave 10 = 500).

## 7. Follow Progression mode — ramp trigger

- Waves 1–2: pure one-phase (CAV already placed, as in Clear CAVs Only).
- Starting wave 3: each CAV spawn has a **rising chance of requiring placement first** before it can be cleared.
- Chance starts at **0% at wave 3**, **+10% per wave**, reaching **100% by roughly wave 13** (fully converged with "Both" mode behavior from that point on).

## 8. Wrong-type CAV entry (confirms existing item #11)

- Typing a valid CAV command with the wrong type code (e.g. `CAV 2101 XX`) is **rejected silently — no pool damage**. Confirmed as-is, no change from the packet's existing guess.

---

## Still open — not yet resolved

1. **Wave-ending semantics (item #12).** Andrew's intent appears to be: *waves never end the game by themselves — they're purely escalation/quota checkpoints. The only game-over condition is the pool hitting zero.* This has been stated as Claude Chat's read-back twice but **never explicitly confirmed word-for-word** by Andrew. Get an explicit yes/no before building any end-of-game logic around waves.
2. **Pool name.** Pending Andrew's AI roundtable. Use placeholder key, no display string yet.

## Deferred — not blocking a build, handle later

- Creature designs, cooked-egg splat variants, and escape-flourish animations (Gemini's domain — item #6)
- VF "Clear Fuel" pop-up look/sound (item #7 — timing itself, 10–30 min random, is confirmed fine)
- Instruction screen content (item #14)
- Title screen and end screen (item #15)

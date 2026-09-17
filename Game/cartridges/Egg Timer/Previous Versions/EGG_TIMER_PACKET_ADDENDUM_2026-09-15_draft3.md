> **SUPERSEDED 2026-09-16.** The current draft, the one merged into the live packet, is the unsuffixed
> `EGG_TIMER_PACKET_ADDENDUM_2026-09-15.md` beside this file. This copy is kept because its Downloads original is gone.
>
> **FILING NOTE — Claude Code, 2026-09-16.** Filed verbatim from Andrew's
> `Downloads/Egg_Timer_Packet_Addendum_2026-09-15.md` (13:10 on 2026-09-16). Everything below the rule is the
> Addendum as written. This is **Chat's third draft**, and it's the one merged into the live
> `EGG_TIMER_CONTEXT_PACKET.md`. The second draft, filed and merged earlier the same day, is
> `EGG_TIMER_PACKET_ADDENDUM_2026-09-15_draft2.md` beside this file. Its note covers the first draft, which
> wasn't filed.
>
> **What this draft changes against the second:** §3's wave line now records Andrew's confirmation that only an
> empty pool ends the game, so "Still open" drops that item and keeps only the pool's name. A new **§9, Command
> Box toggle**, answers Code's F12 finding: F12 keeps its arcade-wide meaning, Ctrl+Tab toggles the two boxes,
> both boxes exist in all three modes, and staged text clears when a new wave starts. A new **Handoff notes**
> section asks Code to register Egg Timer as a Fang Rock Arcade disk and drops the key-binding-interface idea.
>
> **⚠️ Checked against the shell and hub code on 2026-09-16, two corrections (packet §11 C7 and C8):** Ctrl+Tab
> reaches the page inside Fang Rock but not in an ordinary browser tab. And Fang Rock keeps no list of games to
> register with: the id is checked against the hub's own disk list, and it must be plain lowercase letters.

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
- **Confirmed 2026-09-16**: waves never end the game on their own. They only escalate difficulty and check the resolution quota. The sole game-over condition is the pool (Section 5) reaching zero.

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

1. **Pool name.** Pending Andrew's AI roundtable. Use placeholder key, no display string yet.

## 9. Command Box toggle (resolves C1 — Claude Code's F12 conflict finding)

- Egg Timer **is** an Arcade cabinet, launched through `fangrock://arcade/<disk-id>` the same way Asteroid Command and Aquanaut are — themed as hammer-and-nests rather than cab-and-joysticks, but the launch path is identical. **Not yet registered in Fang Rock — flagging as an implementation gap, not a design decision.**
- F12 keeps its existing arcade-wide meaning: **clear the active box, no penalty**. Egg Timer does not redefine it.
- The two Command Boxes are toggled with **Ctrl+Tab** instead.
- Both Command Boxes exist in **all three modes** (Clear CAVs Only, Follow Progression, Both).
- Text staged in the inactive box **clears when a new wave starts**.
- Still open: how the active box is visually indicated to the player (cosmetic, not blocking).

---

## Handoff notes for Claude Code

- Register Egg Timer as a Fang Rock Arcade room/disk-id — currently missing.
- The packet's old assumption that Egg Timer needed a Fang Rock key-binding config interface is incorrect and can be dropped; F12/Ctrl+Tab reach the page as plain keystrokes the same way they do for Asteroid Command and Aquanaut, per FR's per-window (not OS-global) key capture.

## Deferred — not blocking a build, handle later

- Creature designs, cooked-egg splat variants, and escape-flourish animations (Gemini's domain — item #6)
- VF "Clear Fuel" pop-up look/sound (item #7 — timing itself, 10–30 min random, is confirmed fine)
- Instruction screen content (item #14)
- Title screen and end screen (item #15)

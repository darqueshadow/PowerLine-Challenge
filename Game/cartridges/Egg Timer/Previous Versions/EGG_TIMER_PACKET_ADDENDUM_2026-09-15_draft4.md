> **SUPERSEDED 2026-09-16.** The current draft, the one merged into the live packet, is the unsuffixed
> `EGG_TIMER_PACKET_ADDENDUM_2026-09-15.md` beside this file. This copy is kept because its Downloads original is gone.
>
> **FILING NOTE — Claude Code, 2026-09-16.** Filed verbatim from Andrew's
> `Downloads/Egg_Timer_Packet_Addendum_2026-09-15.md` (17:07 on 2026-09-16). Everything below the rule is the
> Addendum as written. This is **Chat's fourth draft**, and it's the one merged into the live
> `EGG_TIMER_CONTEXT_PACKET.md`. Drafts 2 and 3 are beside this file (`..._draft2.md`, `..._draft3.md`), each
> with a note; the first draft wasn't filed.
>
> **What this draft changes against the third — only §9 and the handoff notes:** Egg Timer must also run in a
> plain browser tab (answers Code's C7). The Command Boxes stay inside one page, not separate windows, and
> the Fang Rock popout brief doesn't apply. The player picks **1–4** boxes at the start of a game. The toggle
> is **Tab**, not Ctrl+Tab, and it opens a **switcher menu** with previews of staged text; each box has its
> own color. The handoff proposes the disk id `eggtimer`, added when the build starts, pending Andrew's yes (C8).
>
> **Checked on filing, 2026-09-16.** The popout brief exists at
> `+Nerva Beacon/The Lantern Room/Fang Rock/Brief_Popout-Windows-Mechanic_2026-09-16.md`. The Ctrl+Tab search
> of Morbius that §9 credits to Code was done in that brief's session; this session checked the shell's
> `main.js`, and both found no Ctrl+Tab handler. `eggtimer` passes the shell's letters-only check.
> **⚠️ Two new flags (packet §11 C9, C10):** The Aquanaut already uses Tab (to accept an autocomplete
> suggestion), and how the switcher is *used* is not specified, which is more than cosmetic.

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

## 9. Command Boxes (resolves C1 — Claude Code's F12 conflict finding, and the box-count/architecture questions from 2026-09-16)

- Egg Timer **is** an Arcade cabinet, launched through `fangrock://arcade/<disk-id>` the same way Asteroid Command and Aquanaut are — themed as hammer-and-nests rather than cab-and-joysticks, but the launch path is identical.
- **Confirmed: Egg Timer must also run in a plain browser tab**, not just inside Fang Rock — same as Asteroid Command and Aquanaut today.
- F12 keeps its existing arcade-wide meaning: **clear the active box, no penalty**. Egg Timer does not redefine it.
- **Architecture: single window, in-page Command Boxes — not real separate OS windows.** Real separate windows (à la Morbius' popout system) were considered and rejected: they can't support the colored/preview switcher below, add a whole cross-window sync layer and its bug class (see the wrong-target trap in `Brief_Popout-Windows-Mechanic_2026-09-16.md`), and would behave inconsistently between Fang Rock and a plain browser tab due to popup-blocker friction there. **That brief does not apply to Egg Timer.**
- **Box count: player selects 1–4 Command Boxes at the start of the game** (not fixed at 2) — lets them pre-load commands across boxes.
- **Toggle key: Tab** (not Ctrl+Tab — Code confirmed neither Morbius nor Fang Rock currently binds Ctrl+Tab, and it's hard browser-reserved in a plain tab anyway, unlike Tab, which a page can override with `preventDefault()`). Works identically in Fang Rock and a plain browser tab.
- Each Command Box has **its own base color**, for quick identification.
- Pressing Tab shows a **switcher menu**; any text currently staged in a box is shown there as a preview.
- **Command Boxes are always the first entries** in that switcher menu.
- All active Command Boxes exist in **all three modes** (Clear CAVs Only, Follow Progression, Both).
- Text staged in an inactive box **clears when a new wave starts**.
- Still open: exact visual treatment of the switcher menu and box colors (cosmetic, not blocking).

---

## Handoff notes for Claude Code

- Register Egg Timer as a Fang Rock Arcade room/disk-id — currently missing. Proposed disk id: `eggtimer` (letters only, per the hub's requirement). Proposed timing: hold off adding the hub entry until the build actually starts. **Neither has been explicitly confirmed by Andrew yet — confirm before acting on it.**
- Correction to the packet's old key-handling assumptions: Egg Timer does not need a Fang Rock key-binding config interface. F12 and Tab both reach the page as plain keystrokes; Tab is bound entirely in-page by Egg Timer's own code, not by Fang Rock. Ctrl+Tab is not used anywhere in this project — Code's search of Morbius and the shell confirmed it's unbound; earlier packet language suggesting otherwise was incorrect.
- The popout-window mechanics brief does not apply to Egg Timer — it uses a single-window architecture, not real separate windows.

## Deferred — not blocking a build, handle later

- Creature designs, cooked-egg splat variants, and escape-flourish animations (Gemini's domain — item #6)
- VF "Clear Fuel" pop-up look/sound (item #7 — timing itself, 10–30 min random, is confirmed fine)
- Instruction screen content (item #14)
- Title screen and end screen (item #15)

> **FILING NOTE — Claude Code, 2026-09-16.** Filed verbatim from Andrew's
> `Downloads/Egg_Timer_Packet_Addendum_2026-09-15.md` (22:54 on 2026-09-16). Everything below the rule is the
> Addendum as written. This is **Chat's eighth draft**, and it's the one merged into the live
> `EGG_TIMER_CONTEXT_PACKET.md`. Drafts 2–7 are beside this file (`..._draft2.md` to `..._draft7.md`); the first
> draft wasn't filed.
>
> **What this draft changes against the seventh — one new section, §11 (answers Code's C12–C14):**
> - The timer counts **up**. The packet's older "countdown" wording gets corrected.
> - VF hides the egg and the numeric readout until "Clear Fuel".
> - An ignored placement trigger **auto-opens again**, after a timeout of 20 s, −1 s per wave, floored at 8 s.
> - The spawn timer runs the same in all three modes. A spawn that comes due when every nest is full is skipped.
> - Mess belongs to the nest. Adjacency sits on a logical grid under an organic, scattered visual layout, and
>   the grid's size is left to Code and Gemini.
>
> **Checked against the packet on filing, 2026-09-16 — two small things (packet §11 C15):** §11's C13 bullet
> says the auto-opened trigger "starts counting down", which is the wording its own C12 bullet just retired. And
> "hides … the numeric readout" doesn't say whether the unit number and the VF code are hidden too, or only
> the timer.

---

# Egg Timer — Context Packet Addendum (2026-09-15)

**From:** Claude Chat (Senior Developer role) — design session with Andrew
**To:** Claude Code
**Purpose:** Merge these locked decisions into `EGG_TIMER_CONTEXT_PACKET.md`. This is a decisions log, not new governance — it does not touch Laws or Overview.

**BUILD GATE STATUS: CLEARED.** Andrew authorized the build on 2026-09-16, with C8, item 17, and the pool name explicitly resolved as noted below. Claude Code may begin implementation.

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

## Confirmed deferred — not blocking, explicitly signed off 2026-09-16

1. **Pool name.** Still pending Andrew's AI roundtable. Use placeholder key, no display string yet — confirmed OK to build around.
2. **Item 17 — CAV suggestion list.** No autocomplete/suggestion list for v1. Simplest option, and avoids any internal Tab conflict since there's nothing to conflict with.

## 9. Command Boxes (resolves C1 — Claude Code's F12 conflict finding, and the box-count/architecture questions from 2026-09-16)

- Egg Timer **is** an Arcade cabinet, launched through `fangrock://arcade/<disk-id>` the same way Asteroid Command and Aquanaut are — themed as hammer-and-nests rather than cab-and-joysticks, but the launch path is identical.
- **Confirmed: Egg Timer must also run in a plain browser tab**, not just inside Fang Rock — same as Asteroid Command and Aquanaut today.
- F12 keeps its existing arcade-wide meaning: **clear the active box, no penalty**. Egg Timer does not redefine it.
- **Architecture: single window, in-page Command Boxes — not real separate OS windows.** Real separate windows (à la Morbius' popout system) were considered and rejected: they can't support the colored/preview switcher below, add a whole cross-window sync layer and its bug class (see the wrong-target trap in `Brief_Popout-Windows-Mechanic_2026-09-16.md`), and would behave inconsistently between Fang Rock and a plain browser tab due to popup-blocker friction there. **That brief does not apply to Egg Timer.**
- **Box count: player selects 1–4 Command Boxes at the start of the game** (not fixed at 2) — lets them pre-load commands across boxes.
- **Toggle key: Tab** (not Ctrl+Tab — Code confirmed neither Morbius nor Fang Rock currently binds Ctrl+Tab, and it's hard browser-reserved in a plain tab anyway, unlike Tab, which a page can override with `preventDefault()`). Works identically in Fang Rock and a plain browser tab.
- Each Command Box has **its own base color**, for quick identification.
- Pressing Tab shows a **switcher menu**; any text currently staged in a box is shown there as a preview.
- **Command Boxes are always the first entries** in that switcher menu — and for now, the **only** entries. Nothing else is planned there yet.
- **Switcher navigation**: Tab cycles forward through boxes, Shift+Tab cycles backward, arrow keys also move the highlight (player's choice of input). **Enter** confirms the highlighted box and closes the switcher. **Escape** closes the switcher without switching.
- **With only 1 box selected, Tab is a no-op** — no switcher opens, since there's nothing to switch to.
- **The game keeps running while the switcher is open** — no pause, consistent with nothing else in the design pausing for UI.
- **Pause: Esc, and only Esc.** Esc is context-sensitive: closes the switcher without switching when it's open; pauses/resumes the game when it's not. This is now the arcade-wide standard (see Handoff notes) — no secondary key.
- **Box count (1–4) is chosen on the same screen as mode selection** — one combined setup step at round start, not a separate screen.
- **Tab reuse confirmed fine** despite Aquanaut using Tab differently (autocomplete-select, only while a suggestion list is open there). That's a narrow, contextual behavior, not an arcade-wide convention like F12's — no true cross-cartridge collision, since a dispatcher is only ever in one cartridge at a time. Still open: whether Egg Timer needs its own autocomplete/suggestion list for CAV entry, which would determine if there's an *internal* Tab conflict to resolve later.
- All active Command Boxes exist in **all three modes** (Clear CAVs Only, Follow Progression, Both).
- Text staged in an inactive box **clears when a new wave starts**.
- Still open: exact visual treatment of the switcher menu and box colors (cosmetic, not blocking).

---

## Handoff notes for Claude Code

- Register Egg Timer as a Fang Rock Arcade room/disk-id — currently missing. **Confirmed 2026-09-16**: disk id is `eggtimer`; hold off adding the hub entry until the build actually starts (i.e., now).
- Correction to the packet's old key-handling assumptions: Egg Timer does not need a Fang Rock key-binding config interface. F12 and Tab both reach the page as plain keystrokes; Tab is bound entirely in-page by Egg Timer's own code, not by Fang Rock. Ctrl+Tab is not used anywhere in this project — Code's search of Morbius and the shell confirmed it's unbound; earlier packet language suggesting otherwise was incorrect.
- The popout-window mechanics brief does not apply to Egg Timer — it uses a single-window architecture, not real separate windows.
- **Out of scope for this packet**: Andrew has set Esc as the arcade-wide standard pause key going forward. Asteroid Command already matches (Esc-only, already in its own help screen — no change needed). **Only Aquanaut needs updating**: it also pauses on P, which gets dropped. This is a separate change to an already-shipped cartridge, belongs to Aquanaut's own session, and is not part of the Egg Timer build.

## 10. Overtime timer, VF, spawn mechanics, mess & layout (resolves C2–C6)

- **C2 — timer during overtime**: keeps counting up past the bold trigger, same behavior as before — no special display logic. This naturally hides the jittered hatch point; the cracking egg animation carries the "how urgent" signal, not the number.
- **C3 — VF and the growing egg**: VF nests show **no egg at all** during the regular phase — nothing grows, nothing visible. The egg appears already at bold/cracking, starting the overtime window, at the exact moment "Clear Fuel" fires. Preserves VF's "no visible countdown" intent.
- **C4 — CAV placement timing**: no time limit to place a CAV on a nest that's asking for one — player-paced, the nest just waits.
- **C4 — spawn rate (auto-spawn modes)**: starting interval is itself a random range, **5–7 sec at wave 1**. Both ends of that range shrink **0.5 sec per wave**, floored so neither goes below **1 sec** (range converges to a flat 1 sec by roughly wave 13). Starting point only — expect to tune after playtesting.
- **C4 — points for placing a CAV**: small flat bonus, **10 pts**, separate from and in addition to clear-scoring.
- **C4 — mess spread**: a smoosh dirties the smooshed nest plus its **direct neighbors only** — no wider splash, no board-wide spread.
- **C4 — nest adjacency**: nests are arranged in a **2D grid**; neighbors are up/down/left/right.
- **C5 — wrong-type CAV entry**: a real code that just doesn't match what the nest wants (e.g. typing VS when it wants MB) is rejected the same way as a nonsense code — silently, no pool damage. No distinction between "wrong but real" and "not real."
- **C6.1 — placement's first possible wave**: confirmed intended. 0% chance at wave 3 means it mathematically can't happen until wave 4 (10%) — not a bug.
- **C6.2 — nest count**: confirmed correct — 6 nests from wave 3, reaching the 12 cap at wave 15, per the already-locked formula.
- **C6.3 — cleanup window**: shrinks with wave number, same shape as everything else. Starts at 5–10 sec, both ends shrink **0.5 sec per wave**, floored at **3 sec** (low end floors around wave 5, full range converges to a flat 3 sec by roughly wave 15).

## 11. Timer direction, placement stall-guard, spawn/grid details (resolves C12–C14)

- **C12 — timer direction**: confirmed counting **up**, not down — this session's deliberate redesign (elapsed time reaching the real base duration triggers bold) supersedes the older "countdown" language in packet §4/§7, which predates this redesign. Those sections need their wording corrected, not treated as a live rule to reconcile against.
- **C12 — VF readout**: VF hides both the egg AND the numeric readout entirely until "Clear Fuel" fires, consistent with "no visible countdown" meaning nothing visible at all.
- **C13 — placement stall-guard restored**: an ignored placement trigger opens itself automatically after a timeout and starts counting down normally from there — this corrects the earlier "no time limit" answer, which wrongly dropped an already-locked pre-session rule. "No time limit" was meant as "no penalty for waiting," not "no backstop at all."
- **C13 — timeout escalation**: starts at **20 sec**, shrinks **-1 sec per wave**, floors at **8 sec**.
- **C14a — spawn rate applies uniformly across modes**: the same "how often does a new nest-cycle begin" timer runs in all three modes. What differs is only what that cycle *is* — auto-placed CAV (Clear CAVs Only), always a placement trigger (Both), or whichever the ramp roll decides (Follow Progression) — governed by the already-locked mode/ramp rules, not by the spawn timer itself.
- **C14b — board full when a new CAV is due**: **skip it** — that spawn is simply lost, play moves on. No queueing.
- **C14c — mess persistence**: mess belongs to the nest itself, not a grid position — unaffected when new nests unlock as the count grows.
- **C14c — grid shape**: nests sit on an underlying logical grid for adjacency purposes (clean, predictable neighbor rule for mess-spreading), but the **visual placement is organic/scattered**, not a rigid visible checkerboard. Exact grid dimensions and the visual dressing are deferred to Code/Gemini once there's a mockup — the constraint is just that adjacency must stay grid-based underneath.

## Deferred — not blocking a build, handle later

- Creature designs, cooked-egg splat variants, and escape-flourish animations (Gemini's domain — item #6)
- VF "Clear Fuel" pop-up look/sound (item #7 — timing itself, 10–30 min random, is confirmed fine)
- Instruction screen content (item #14)
- Title screen and end screen (item #15)

> **SUPERSEDED 2026-09-16.** The current draft, the one merged into the live packet, is the unsuffixed
> `EGG_TIMER_PACKET_ADDENDUM_2026-09-15.md` beside this file. This copy is kept because its Downloads original is gone.
>
> **FILING NOTE — Claude Code, 2026-09-16.** Filed verbatim from Andrew's
> `Downloads/Egg_Timer_Packet_Addendum_2026-09-15.md` (19:22 on 2026-09-16). Everything below the rule is the
> Addendum as written. This is **Chat's sixth draft**, and it's the one merged into the live
> `EGG_TIMER_CONTEXT_PACKET.md`. Drafts 2–5 are beside this file (`..._draft2.md` to `..._draft5.md`), each with
> its own note; the first draft wasn't filed.
>
> **What this draft changes against the fifth — two bullets:** §9 sets the pause as **Esc, and only Esc**:
> it closes the switcher when that's open, and pauses or resumes the game otherwise (answers Code's C11).
> The handoff notes add that Andrew has made Esc the arcade-wide pause key, so Asteroid Command and The
> Aquanaut "both need updating" and the Aquanaut drops P. That work is out of scope for this packet.
>
> **Checked on filing, 2026-09-16 — the out-of-scope note is only half right:** Asteroid Command already
> pauses on Esc alone (its help lists ESCAPE as Pause / Resume), so it needs no change. The Aquanaut does
> take P, and its `AQUANAUT_DESIGN.md` records P as Andrew's own earlier pick, added because browsers
> use Esc to leave fullscreen. Without P, Esc still pauses there: it captures Esc with Keyboard Lock in
> Chrome and Edge, and elsewhere it pauses when the browser leaves fullscreen. That change belongs to the
> Aquanaut's own session. No "project open-items list" on disk mentions it yet.

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

- Register Egg Timer as a Fang Rock Arcade room/disk-id — currently missing. Proposed disk id: `eggtimer` (letters only, per the hub's requirement). Proposed timing: hold off adding the hub entry until the build actually starts. **Neither has been explicitly confirmed by Andrew yet — confirm before acting on it.**
- Correction to the packet's old key-handling assumptions: Egg Timer does not need a Fang Rock key-binding config interface. F12 and Tab both reach the page as plain keystrokes; Tab is bound entirely in-page by Egg Timer's own code, not by Fang Rock. Ctrl+Tab is not used anywhere in this project — Code's search of Morbius and the shell confirmed it's unbound; earlier packet language suggesting otherwise was incorrect.
- The popout-window mechanics brief does not apply to Egg Timer — it uses a single-window architecture, not real separate windows.
- **Out of scope for this packet**: Andrew has set Esc as the arcade-wide standard pause key going forward. Asteroid Command and Aquanaut both need updating to match (Aquanaut currently also supports P — that gets dropped). This is a separate change to already-shipped cartridges, tracked on the project's own open-items list, not part of the Egg Timer build.

## Deferred — not blocking a build, handle later

- Creature designs, cooked-egg splat variants, and escape-flourish animations (Gemini's domain — item #6)
- VF "Clear Fuel" pop-up look/sound (item #7 — timing itself, 10–30 min random, is confirmed fine)
- Instruction screen content (item #14)
- Title screen and end screen (item #15)

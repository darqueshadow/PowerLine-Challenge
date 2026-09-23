> **FILING NOTE — Claude Code, 2026-09-22 (Timer Refinement).** Chat's Timer Refinement handoff (decided by
> Andrew 2026-09-22, for playtest) is merged, each change tagged *(Timer Refinement)*. The handoff is filed
> verbatim as `Previous Versions/EGG_TIMER_TIMER_REFINEMENT_2026-09-22.md`, and the packet as it stood before
> this merge as `Previous Versions/EGG_TIMER_CONTEXT_PACKET_draft9.md`. **D5 is removed** here, as the handoff
> asked, rather than struck through: its text survives only in that older copy. The Refinement's numbers marked
> [T] are tunables for the playtest. It is **built in `files/` but not pushed**: Andrew playtests locally and
> approves before anything reaches the live site. Checked on merging, with no hard conflict found: every packet
> rule it overrides (D5, §3's fixed ratio, §7's 5 s overtime and growing jitter, "Clear Fuel") it overrides on
> purpose. The gaps building it turned up are **E1–E4** (§11), each built with a provisional value.
> *(Later on 2026-09-22)* **Chat ruled E1–E4, Andrew approved**, merged as *(Timer Refinement rulings)*: E1
> rounds up, E2 and E4 stay as built, E3 settles the words (**displayed time** and **the player's seconds**,
> used throughout the Refinement's text below), and the §8 line "running CAVs switch to the new speed" is
> removed, since it can't happen. Still not pushed until Andrew has playtested and approved.
>
> **FILING NOTE — Claude Code, 2026-09-17 (Draft 9 rulings).** Chat's rulings on the build questions D1, D2
> and D4–D6, and on C15, are merged. The file is `Previous Versions/EGG_TIMER_RULINGS_DRAFT9.md`, verbatim under
> its own filing note, and each change is tagged *(Rulings, draft 9)*. **C1–C15 are all resolved now.** Of the
> build questions only **D3**, the Developer Mode phrase, is open, and that one is Andrew's to give Code
> directly, not a design call. The note below is from 2026-09-16 and is unchanged, apart from its C15 paragraph.
>
> **FILING NOTE — Claude Code, 2026-09-16.** This is **v3 with the 2026-09-15 Addendum merged in.** The
> Addendum is Claude Chat's decisions log from a design session with Andrew, and it asked Code to merge its
> locked decisions into this packet. So unlike earlier filings, this one edits the body. Every merged change
> is tagged *(Addendum)*. The rest of Chat's v3 text is unchanged, apart from status lines the merge made
> stale, and §12's F12 text, which is struck through where the Addendum replaced it.
>
> **Sources, all in `Previous Versions/`:** the Addendum verbatim (`EGG_TIMER_PACKET_ADDENDUM_2026-09-15.md`,
> Chat's eighth draft, from Andrew's `Downloads/Egg_Timer_Packet_Addendum_2026-09-15.md` at 22:54); its second
> to seventh drafts (`..._draft2.md` to `..._draft7.md`); v3 as it stood before any merge, with its own filing note and the F12 findings
> (`EGG_TIMER_CONTEXT_PACKET_v3.md`); and the earlier filings (`_v1`, `_v2-first-filing`, `_v2-revised`,
> `EGG_TIMER_CONTEXT_PACKET_v2-rename.md`).
>
> **The Addendum went through eight drafts on 2026-09-16, each answering something Code raised.** The first
> had the egg appear the instant a CAV starts, with `RCAV` valid from then on and the most points for an
> instant clear. That brought back the place-then-instantly-clear exploit v2 had closed. The second makes
> `RCAV` do nothing until the CAV's real duration has passed, and scores the clear across the overtime
> window; it was merged first. The third records Andrew's game-over answer (he gave it in Code's question
> box, and Chat then locked it) and adds §9, resolving C1: F12 keeps its arcade-wide meaning and Ctrl+Tab
> toggles the Command Boxes. The fourth answers C7 (Egg Timer must also run in a plain browser tab, where
> browsers keep Ctrl+Tab): the toggle becomes **Tab**, the player picks **1–4** boxes, a switcher menu shows
> previews of staged text, and the boxes stay inside one page. The fifth answers C9 (Tab's different job in
> The Aquanaut is fine) and C10 (how the switcher is used). The sixth answers C11: Esc, and only Esc, pauses
> the game, and closes the switcher when that's open. The seventh answers C2–C6 in a new §10, confirms the
> disk id `eggtimer` (C8), rules out a suggestion list for v1 (item 17), and marks the **build gate CLEARED**:
> "Andrew authorized the build on 2026-09-16". The eighth answers C12–C14 in a new §11: the timer counts up
> (the older "countdown" wording is corrected), VF hides its readout too, an ignored trigger auto-opens after
> a shrinking timeout, spawns run the same in every mode and are skipped when the board is full, and mess
> belongs to the nest. Design calls now go through Chat, one at a time; Code flags and merges.
>
> **What the merge settles:** the time scale, including the one-ratio-or-many question (item 1); nest count
> (item 2); the egg lifecycle and the bold cue (item 3); the pool's size and refill (item 4, not its name);
> clear scoring and the perfect-wave bonus (item 5, not placement points); the wipe gesture (item 8); wave
> structure (item 9, not mess amount); mid-wave cleaning cost (item 10); wrong-type entries (item 11);
> end conditions — only an empty pool ends the game (item 12); the Follow Progression ramp (item 13); VF's
> 10–30 min duration; the Command Boxes — count, key, architecture, modes and wave clearing (C1), Tab's
> reuse (C9) and the switcher's controls (C10); browser play (C7); the pause (C11); the overtime timer, VF's
> egg, placement timing and points, spawn rate, mess spread, adjacency, wrong real codes and the small
> readings (C2–C6); the disk id (C8); no suggestion list for v1 (item 17); and the timer's direction, the
> auto-open timeout, spawns across modes and on a full board, and grid and mess persistence (C12–C14). The creature roster, VF's cue,
> the instruction, title and end screens (items 6, 7, 14, 15), the look of the switcher menu and box colors,
> and the pool's display name are deferred, not blocking a build.
>
> **The build gate is CLEARED, and C1–C14 are resolved.** The seventh draft's two collisions with locked
> text are settled: the timer counts up (C12), and the auto-open backstop is restored (C13). ~~**One small
> item is open (C15):** the eighth draft's C13 bullet still says the auto-opened trigger "starts counting
> down", and "hides … the numeric readout" for VF may or may not cover the unit number and code.~~
> *(2026-09-17)* C15 is resolved by the Draft 9 rulings.
>
> **Outside this packet:** Andrew made Esc the arcade-wide pause key. The seventh draft now says so
> correctly: Asteroid Command already pauses on Esc alone, and only The Aquanaut changes, by dropping P.
> That's the Aquanaut session's work, not Egg Timer's.
>
> **Carried forward (still true):**
>
> - Developer Mode is Ctrl+Shift+B, then a 10-second password prompt in every built cartridge, not a bare
>   toggle. Swap in the Blank Dataset Module on unlock; this cartridge's will be the first one wired.
> - The transport units are `Game/datasets/AP_ENP_BSE/2. Units_Transports.csv` (59 units).
> - The Addendum defines a wave (§4). Older text that says "round" means the whole game where it's about
>   the mode buttons or game over, since Follow Progression ramps across waves inside one game.
> - Amendment A5 is still not on disk (Chat's lane), and `PLC_Project_Instructions.md` still names Whack A CAV.

---

# Egg Timer *(formerly Whack A CAV)* — Mini-Game Context Packet (v3 + 2026-09-15 Addendum)

**Status:** ~~Design stage.~~ *(Addendum, seventh draft)* **Build gate CLEARED — Andrew authorized the build on 2026-09-16.** Core mechanic, modes, CAV data, and the rename are all settled. *(Addendum)* So are the time scale, the egg lifecycle, nests, waves and spawn rate, the pool's size and refill, scoring, mess spread and wiping, the Follow Progression ramp, the Command Boxes, browser play, the pause, the disk id, and the rule that only an empty pool ends the game. The pool's display name is deferred (build around the placeholder key). *(Addendum, eighth draft)* The timer counts up, the auto-open backstop is restored, and spawns, the grid and mess persistence are settled. *(Claude Code)* **Build started 2026-09-16** under `files/` (not yet launched; the hub entry is `coming-soon`). ~~Open: C15's written ruling, and the questions raised during the build, D1–D6 (§11).~~ *(Rulings, draft 9)* C15 and the build questions D1, D2 and D4–D6 were ruled on 2026-09-17. Open: D3 only, the Developer Mode phrase (§11). *(Timer Refinement, 2026-09-22)* Clocks show displayed time and run sped up, with a new wall clock, AD post-it notes, VF's "Clear Fueling" bubble, a new overtime curve and clock-speed escalation. Built for a local playtest. E1–E4 are ruled; open: the spawn-rate question (§11).

**Document type:** Mini-Game Context Packet (Technical Manual §J).

**Governance status:** Registered **Standalone Cartridge** (Laws v2.0 §0.23, Core Law 15 — ratified 2026-09-15). Register renamed to **Egg Timer** via amendment A2 — complete. Not duplicated from the Empty Cartridge. Does not use Target / Challenge / Impact Zone vocabulary. Still bound by: Data Sheet integrity (no invented values), real PowerLine syntax, Developer Mode gating, Claude Code as sole point of merge, no cross-cartridge convention imposition, and the build gate below.

**Name & branding:** Renamed from Whack A CAV to **Egg Timer** — a happy accident: styling the "E" and "T" in a distinct font/weight makes the title read as "ET" from a distance, tying directly into the alien-egg creature theme. Rename fully executed on disk and in governance (amendments A2–A4). **Creature/art direction note for Gemini:** the ET wordplay is just typography on ordinary words — keep the actual creature designs clearly original, not a visual likeness of Spielberg's E.T. specifically.

**Menu placement:** Sits in the flat Main Menu roster (categories retired system-wide). Whether "Speed Drills" survives as a label anywhere is still Andrew's open call per Overview v2.0, and doesn't affect this cartridge either way.

**House-rule resolution (this round):** every Cartridge is required (Overview, Core Concepts) to have its own difficulty/dataset/instruction menus, title screen, and end screen. Standalone-Cartridge status (§0.23) lifts the Target/Impact model, not this. Resolved as follows:
- **Difficulty menu:** the three mode buttons (§5) satisfy this — a dedicated per-cartridge selection screen, just presented as physical-feeling buttons rather than a dropdown.
- **Dataset selection:** does not apply here — there's no Challenge Set to choose between, just one CAV table, so the rule has nothing to bind to.
- **Instruction screen w/ command list, title screen, end screen:** genuine gaps, not yet designed. Added to §11. *(Addendum)* Deferred: they don't block a build, but they're still required.
- **Developer Mode → Blank Dataset Module access:** no separate screen needed. Developer Mode is already hidden/keyboard-gated everywhere (Ctrl+Shift+B), not surfaced through any cartridge's own menu — the same toggle swaps Egg Timer's CAV-type table for the Blank Dataset Module when active. *(Rulings, draft 9, D1)* The Blank Dataset Module is **not empty**: it holds the seven real CAV types (§3) as Developer-Mode-only rows, with exactly the same values. It's a testing copy of confirmed real values, not invented data, and Andrew will check it further once gameplay is testable.

---

## 1. Concept

A whack-a-mole variant built on the real Niagara EMS CAV (Conditional Availability) workflow. A unit's CAV is placed and cleared using real PowerLine syntax. If a CAV isn't cleared in time, an alien egg in that unit's nest finishes hatching and the CAV is lost for that instance — final, no recovery.

---

## 2. Command syntax (confirmed)

| Action | Syntax | Example |
|---|---|---|
| Open/place a CAV | `CAV #### TYPE` (optional trailing comment accepted) | `CAV 2101 MB` or `CAV 2101 MB, fuel truck delay` |
| Clear/remove a CAV | `RCAV ####` | `RCAV 2101` |

`####` = unit number. `TYPE` = one of the CAV type codes below (confirmed as the real PowerLine "OOS Reason" field, unit-first order). An optional trailing comment, comma-separated, is accepted but not required. **All CAV types require a manual `RCAV` to clear — none self-clear.** (Confirmed real-workflow fact, not a game simplification.)

---

## 3. CAV type table (confirmed durations)

**This is the current list, not necessarily final — Andrew has said it's open to adding more real OOS reasons later.** Code should treat this as extensible data, not a hardcoded fixed set.

| Code | Meaning | Duration | In game, to the bold trigger *(Addendum scale; Timer Refinement: wave 1 only, as the clocks speed up)* | Notes |
|---|---|---|---|---|
| VS | Vehicle Service | 10 min | 20 s | |
| STR | Stretcher Clear | 10 min | 20 s | often follows a VS |
| SS | Start Shift | 15 min | 30 s | |
| EOS | End of Shift | 30 min | 60 s | |
| MB | Meal Break | 30 min | 60 s | |
| AD | Admin CAV | random, 10–30 min | random, 20–60 s | *(Timer Refinement)* **Whole minutes.** Every AD nest shows a **post-it note** (§4), the only type with one. |
| VF | Vehicle Fueling | no visible countdown | random, 20–60 s | **two-phase only** (requires placement); pops silently with "Clear Fuel," then same reaction window as every other type once it pops. No real-world "typical" time exists to be faithful to — recommended default: same 10–30 min random band as AD, treated as pure game-balance, not realism. ~~Not yet explicitly confirmed by Andrew.~~ *(Addendum)* **Confirmed.** *(Seventh draft)* **No egg during the regular phase** — the egg appears already cracking at the bold trigger, the moment "Clear Fuel" fires (§7). ~~*(Eighth draft)* The **numeric readout is hidden too** until "Clear Fuel" — "no visible countdown" means nothing visible at all. See §11 C15.~~ *(Rulings, draft 9, C15(b))* **Only the timer is hidden** until "Clear Fuel". The unit number and "VF" stay visible throughout fuelling. *(Timer Refinement)* The pop is now **"Clear Fueling"**, a speech bubble (§7). |

**Time scale** *(Addendum)*: **1 real minute = 2 game-seconds**, one ratio for every CAV type. It turns each type's real duration into its **bold trigger** point (§7), so VS's 10 min is 20 game-seconds and MB's 30 min is 60. The scale is **exact and never jittered** — the one place the real Data Sheet duration must stay untouched. Per-instance randomness lives only in the overtime window (§7). Kept as a single config value, not hardcoded. *(Replaces the earlier TBD default of 1 real minute = 1 game second, and settles the shared-or-per-type question: shared.)* The "In game" column is Claude Code's arithmetic from this scale.

**Two kinds of time** *(Timer Refinement)*: the **clocks show displayed time**. A VS goes bold when its clock reads **10:00**. They **run sped up**: at base speed **1 displayed minute = 2 of the player's seconds** [T], so 10:00 takes 20 s. That is the ratio above, now stated as a speed. **Every clock on screen shares one speed at all times** (the nest clocks and the wall clock, §4), so a wall-clock target lines up with the nest clocks. The speed **steps up on even waves**: +10% of base [T] (wave 1 1.0, wave 2 1.1, wave 3 1.1, wave 4 1.2, …), capped at **2×** [T] (10:00 in 10 s, from wave 20). It changes at wave start. So the ratio is still shared and never jittered, and the real duration still sets the bold mark exactly, in displayed time; only the "In game" column above is wave 1's. Everything else in the packet that is timed in seconds (spawn gaps, the auto-open timeout, the overtime window, the cleanup window) is the **player's own seconds**, untouched by the clock speed. *(Timer Refinement rulings, E3)* The two are always called **displayed time** and **the player's seconds**. The handoff's "real time" means displayed time, and its "real seconds" the player's seconds.

---

## 4. Playfield structure

- Fixed grid of **nests**. *(Addendum)* **5 nests at the start, +1 every 2 waves, capped at 12** — 6 nests from wave 3, the cap at wave 15 *(seventh draft: confirmed)*. Nests sit in a **2D grid**; a nest's neighbors are the ones directly **up, down, left and right** *(seventh draft)*. *(Eighth draft)* That grid is **logical**, for adjacency only — the **visual placement is organic/scattered**, not a visible checkerboard. The exact grid dimensions and the visual dressing are left to Code and Gemini once there's a mockup; the one constraint is that adjacency stays grid-based underneath.
- Each nest has a **separate digital readout below it** — unit number and **the literal CAV type code (MB, VS, etc. — confirmed, shown directly, not a plain-language cue requiring translation)**, plus the ~~countdown~~ timer *(eighth draft: it counts **up**)*. This is deliberately not on the egg itself, so the readout stays legible regardless of the egg's animation state. *(Addendum)* The readout is regular weight until the CAV's real duration has passed, then goes **bold** (§7). *(Seventh draft, answering C2)* The timer **keeps counting up past the bold trigger** — no special display logic. That hides the jittered hatch point; the cracking egg carries the urgency, not the number. *(Eighth draft, answering C12)* Counting **up** is confirmed — elapsed time reaching the real base duration is what triggers bold — and supersedes the older "countdown" wording, which predates that redesign. VF is the exception: its ~~readout~~ timer stays hidden until "Clear Fuel" (§3), *(Rulings, draft 9)* while its unit and "VF" stay visible. *(Timer Refinement, replacing D5)* The timer shows **displayed time as MM:SS**, counting up from 00:00 when the CAV starts. Bold marks: **VS 10:00, STR 10:00, SS 15:00, EOS 30:00, MB 30:00**; AD a random whole number of minutes, 10–30, shown on its post-it; VF random and hidden. It keeps counting through overtime until the CAV is cleared or hatches (e.g. **10:00 → ~13:00** for a VS in wave 1 *(Timer Refinement rulings, E3)*). The seconds spin too fast to read, which is expected, not a bug. The bold/crack/overtime behaviour at the mark is unchanged for now.
- The egg is purely the animated hazard object — no text, no UI role.
- *(Timer Refinement)* **Wall clock.** A time-of-day display, **24-hour**: large **HH:MM**, with the seconds smaller and raised to the upper half, like a digital clock. It **starts at the player's actual time of day** [T], runs at the same speed as the nest clocks (§3), and freezes on pause like everything else. Placeholder look for now; the final look is Gemini's. *(Code: it wraps past midnight; `?clock=HH:MM` starts it at a fixed time, so a `?seed=` game replays exactly.)*
- *(Timer Refinement)* **AD post-it note.** Every AD nest shows one, and **no other type does**: players must know the other durations. Two versions, **50/50** [T]:
  - **Duration note**, e.g. "20 min": goes bold when the **nest** clock reaches 20:00.
  - **Clock-time note**, e.g. "Clear @ 14:35": goes bold when the **wall** clock reaches 14:35, whatever the nest clock says. The target is always 10–30 whole minutes after the CAV starts. *(Timer Refinement rulings, E1)* **Rounded up:** "Clear @" is the **next whole minute after the start plus the draw**, so it is never shorter than the draw (a start at 14:15:40 with a draw of 20 reads "Clear @ 14:36"). *(E2)* A placement trigger's note appears **when the CAV starts**, not at the trigger.
  - The note goes bold at the same moment as the nest: for either kind, reaching the note's time **is** the bold trigger (§7).
- **Units drawn from transport units only** (confirmed) — not the full unit roster. *(Rulings, draft 9, D2)* Every new CAV brings a **new unit, drawn at random**, and never one already showing on the board. A nest doesn't keep a unit from one CAV to the next.

**Waves** *(Addendum)*
- A wave ends when a **quota of CAVs has been resolved** — cleared *or* hatched, both count toward it.
- Quota: **8** in wave 1, **+2 per wave** (wave 2 = 10, wave 3 = 12, and so on).
- *(Rulings, draft 9, D4)* **Spawning stops once the wave's quota has spawned**, so the wave ends with nothing left running and the cleanup window starts on a quiet board.
- Between-wave cleanup window: **5–10 seconds** (§8). *(Seventh draft)* It **shrinks with the wave**: both ends drop **0.5 s per wave**, floored at **3 s** (the low end hits the floor around wave 5; the whole range is a flat 3 s by about wave 15).
- *(Seventh draft)* **Spawn rate (auto-spawn modes):** the gap between new CAVs is a random range, **5–7 s in wave 1**. Both ends drop **0.5 s per wave**, floored at **1 s** (a flat 1 s by about wave 13). A starting point, to tune after playtesting. *(Eighth draft)* The same spawn timer runs in **all three modes** — only what each new cycle *is* differs: an auto-placed CAV (Clear CAVs Only), always a placement trigger (Both), or whichever the ramp roll decides (Follow Progression). **If every nest is busy when a spawn comes due, it's skipped** — that spawn is simply lost, with no queueing.
- **Waves never end the game.** *(Addendum, confirmed 2026-09-16)* They only escalate difficulty and check the resolution quota. The sole game-over condition is the pool (§9) reaching zero.

---

## 5. Modes (player-selected, three buttons at round start)

Presented as three physical-feeling buttons at the start of each game — not a CAD-style dropdown/setup menu. Fits the arcade-cabinet framing (real cabinets commonly have a mode-select button bank). *(Addendum)* The player also picks how many Command Boxes to use (1–4) on this same screen, as one combined setup step (§12).

1. **Clear CAVs Only** — one-phase. Nests activate **staggered, one at a time** (confirmed — not all at once), each opening with a CAV already placed. Player only ever types `RCAV ####`. Pure reflex drill on the clear command.
2. **Follow Progression** — starts one-phase, ramps into requiring `CAV #### TYPE` placement as difficulty/rounds progress. Teaching ramp: learn `RCAV` first, `CAV` added later. *(Addendum)* **Waves 1–2 are pure one-phase**, as in Clear CAVs Only. **From wave 3**, each CAV spawn has a rising chance of requiring placement first: **0% at wave 3, +10% per wave, 100% by about wave 13**, after which it plays the same as Both. *(Seventh draft)* So placement first becomes possible in wave 4 — confirmed intended, not a bug.
3. **Both** — two-phase throughout. Every CAV must be placed by the player before it can be cleared.

VF (§3) only appears in two-phase segments (Follow Progression once ramped, or Both throughout) — it has no meaning in a mode where the player never places anything.

---

## 6. Phase A — Trigger/Place (two-phase segments only)

- A nest signals a CAV is due (visual/audible cue — details TBD).
- Player has a grace window to type `CAV #### TYPE` correctly. ~~*(Seventh draft, answering C4)* **No time limit** to place a CAV on a nest that's asking for one — player-paced; the nest just waits.~~ *(Eighth draft, answering C13)* That "no time limit" meant **no penalty for waiting**, not no backstop at all. The grace window is a **timeout: 20 s in wave 1, −1 s per wave, floored at 8 s** (the floor arrives in wave 13).
- **Ignored trigger (resolved):** if a CAV trigger isn't placed in time, it auto-opens by itself and ~~starts counting down~~ **starts its timer normally (counting up)** *(Rulings, draft 9, C15(a))* — matches the original draft behavior. *(Eighth draft)* **Restored and confirmed:** when the timeout runs out, the trigger opens itself and its timer starts normally.
- **Wrong type code (resolved)** *(Addendum)*: a CAV command with the wrong type code (e.g. `CAV 2101 XX`) is **rejected silently, with no pool damage** — the packet's earlier guess, confirmed as-is. *(Seventh draft, answering C5)* A **real code that doesn't match** what the nest wants (e.g. `VS` when it wants `MB`) is rejected the same way — no distinction between "wrong but real" and "not real". *(Rulings, draft 9, D6)* A rejected Enter **leaves the text in the Command Box**, so the player can fix it, and F12 clears it (§12). Only an accepted command empties the box.

---

## 7. Phase B — ~~Countdown~~ Timer, egg, hatch

- Once a CAV is placed (or pre-opened, in one-phase mode), the nest's ~~countdown~~ timer starts *(eighth draft: counting up)*, compressed per the ratio in §3.
- **Valid clear window (resolved — closes an exploit):** *(Addendum)* `RCAV ####` has **no effect until the CAV's real duration has elapsed** — the bold trigger below — symmetric with the rule that it also has no effect after the egg fully hatches. Without this floor, "place then instantly clear" would be the optimal strategy under any speed-based scoring, which would let the player skip the reflex drill entirely — the whole point of the game. `RCAV` is only meaningful during the overtime window. *(The floor used to be the egg appearing. The Addendum moved the egg's appearance to the start of the CAV, so the floor moved to the trigger.)*
- *(Addendum)* **The egg appears the instant a CAV starts** and **grows continuously** for the whole of the CAV's real duration (compressed per §3). The growth is a read on "how close is this one" and nothing more — no gameplay effect. *(Seventh draft, answering C3)* **Except VF:** a VF nest shows **no egg at all** during the regular phase. Its egg appears already cracking at the bold trigger, starting the overtime window, at the exact moment "Clear Fuel" fires — so VF keeps its "no visible countdown". *(Timer Refinement)* At that moment a cartoon **speech bubble reading "Clear Fueling"** appears briefly, then fades [T], and at the same instant the clock appears, already showing the time elapsed, and the egg appears already cracking. From there, normal overtime and `RCAV` rules. **VF is the only CAV type with a pop-up.**
- *(Addendum)* While elapsed time is under the type's base duration, the readout stays **regular** weight and typing `RCAV` does nothing.
- *(Addendum)* **The bold trigger** is the moment elapsed time reaches the base duration. It is **one event**: the readout goes **bold**, `RCAV` becomes valid for the first time, and the egg starts its **cracking** animation, with no separate phase between them. This settles the old question of whether the egg replaces the font-bold cue: they coexist, as the same moment.
- *(Addendum)* The trigger starts the **overtime window**, the only time the CAV can be cleared before it hatches: ~~a **flat 5 game-seconds**, plus per-instance jitter of **±10% in wave 1, growing 5% per wave, capped at ±35%** (the cap arrives in wave 6)~~. Jitter never touches the base duration.
  *(Timer Refinement)* The window is measured in **the player's seconds**, so the clock speed doesn't change it: **6.0 s** [T] in wave 1, **−0.25 s every 2 waves** [T] (on the odd waves the nests grow: 5.75 s from wave 3), floored at **4.5 s** [T] from wave 13. Jitter is a **fixed ±10%** [T] every wave; the growing jitter is gone. Scoring is unchanged (§10).
- **Clear (success):** `RCAV ####` lands before the egg fully hatches → **egg gets smooshed**, turning into a randomly chosen cooked-egg splat (scrambled, deviled, poached, sunny-side-up, etc. — a variety pool, same pattern as the escape flourish below). Points awarded, nest resets to idle.
- **Escape (failure) — final and irreversible:** if the (jittered) overtime window runs out *(Addendum)*, the egg finishes hatching and the creature is loose. **`RCAV` no longer does anything to it at this point** — there is no post-hatch recovery via command. The creature performs a randomly chosen escape flourish — **scurries away, or lunges at the screen** (variety pool, mirrors the cooked-egg splat pattern) — and the nest then auto-resets to idle on its own. No lingering "overdue" state requiring further player action.
- *(Timer Refinement)* **No early-clear surprise for VS or STR.** Andrew dropped it; it was never built. VS and STR always show their clock and always go bold at 10:00.
- *(Timer Refinement, still open, kept as is)* Whether the bold/crack cue should stay once players know the durations: to be discussed with the egg visuals.

---

## 8. Mess accumulation & wipe mechanic

Each successful smoosh (§7) leaves a small amount of mess/gunk on the unit's panel — not a big splatter individually, but it **accumulates in real time during the wave**, visibly, immediately after each crack. *(Addendum)* Each smoosh also **spreads mess to neighboring nests**, not just its own. *(Seventh draft)* That means the smooshed nest plus its **direct neighbors only** (up, down, left, right, §4) — no wider splash. *(Eighth draft)* **Mess belongs to the nest itself**, not to a grid position, so it's unaffected when new nests unlock as the count grows. Over a wave, gunk gradually covers the digital readouts (unit/CAV/timer), making them progressively harder to read.

- **Cleaning is player-controlled, mouse-driven.** *(Addendum)* The gesture is **click-and-drag**. Andrew's caveat: it may need playtesting to confirm the feel.
- **Mid-wave cleaning is allowed** — the player can stop typing for a moment to wipe a panel, trading typing time for legibility. This is a real tradeoff, not a free action. *(Addendum)* The lost typing time is its only cost — no separate point penalty.
- **A dedicated cleanup window exists between waves** as well. *(Addendum)* It lasts **5–10 seconds**, *(seventh draft)* shrinking 0.5 s per wave at both ends to a 3 s floor (§4).
- **No cap — the spiral is intentional.** If mess isn't managed, it carries forward and compounds wave over wave, and a panel can become fully obscured if consistently ignored. This is deliberate difficulty tension, not an oversight.
- **Emergent link to the failure pool (§9):** this isn't a separate penalty system — it's a consequence chain. A harder-to-read display makes it more likely the player misjudges timing or misreads a unit, which increases the odds of an escape, which is what actually drains the pool. Falling behind on cleaning has a real cost even though cleaning itself never directly touches the pool.

---

## 9. Stakes / failure pool

- A depletable pool (name and flavor — **TBD**) takes damage **only when a CAV escapes** (fully hatches). Confirmed: mistyped or incorrect commands do **not** drain it — only a full escape does. (Obscured displays from unmanaged mess can indirectly increase escapes — see §8 — but nothing about the mess mechanic itself touches the pool directly.)
- *(Addendum)* **Size and recovery:** starts at **3**. **−1 per escape.** **+1 for every full wave completed with zero escapes**, never above the starting 3.
- *(Addendum)* **Name:** still TBD, pending Andrew's AI naming roundtable. Use the placeholder key **`POOL`** in any config or schema, and don't hardcode a display name yet. *(Seventh draft)* Confirmed OK to build around.
- Pool reaching zero **ends the round/game.** This is a deliberate choice, not a requirement — Egg Timer, as a Standalone Cartridge, is exempt from having to define a Terminal Failure State at all, but Andrew chose to give it real stakes anyway. *(Addendum, confirmed 2026-09-16)* It is the **only** way a game ends; waves never end it.
- Escape does **not** separately cost points — the pool damage is the entire consequence of an escape.

---

## 10. Scoring

- Successful `CAV #### TYPE` placement within the trigger window (two-phase only): small points. *(Seventh draft)* A flat **10 points**, separate from and on top of the clear score.
- *(Addendum)* **Successful `RCAV ####` clear:** `RCAV` only works during the overtime window (§7), so there is no instant-clear case. **100 points if cleared right as it goes bold, decaying linearly to 25 points** at the moment it would hatch.
- Escape: no points, and **no point penalty** — pool damage per §9 is the only cost.
- *(Addendum)* **Perfect wave bonus** (zero escapes that wave): **50 × the wave number** (wave 1 = 50, wave 5 = 250, wave 10 = 500).
- **Mid-wave cleaning (resolved)** *(Addendum)*: the lost typing time is the only cost, with no separate point penalty.

---

## 11. Open items requiring Andrew's decision before Code builds anything

*(Addendum)* Status after the merge. The numbering is unchanged; resolved items are struck through, with where they're now recorded.

1. ~~**Timer compression ratio**~~ — **Resolved** *(Addendum)*: 1 real minute = 2 game-seconds, one ratio for every CAV type, exact and never jittered. §3.
2. ~~**Slot/nest count**~~ — **Resolved** *(Addendum)*: 5 to start, +1 every 2 waves, capped at 12. §4.
3. ~~**Egg-crack timing curve**~~ — **Resolved** *(Addendum)*: the egg appears at the start and grows; bold, `RCAV` becoming valid, and the start of cracking are one event at the base duration; then a jittered 5-second overtime window. §7.
4. **Pool details** — size and refill **resolved** *(Addendum)*: 3, −1 per escape, +1 per zero-escape wave, capped at 3 (§9). The name and flavor are still pending Andrew's AI naming roundtable. **Deferred** *(seventh draft)*: build around the placeholder key `POOL`.
5. ~~**Scoring specifics**~~ — **Resolved** *(Addendum)*: clears, the perfect-wave bonus, and *(seventh draft)* 10 points per placement. §10.
6. **Creature/theme roster** — the "creepy crawly" family that hatches out (not yet chosen), plus the specific cooked-egg splat variants and escape-flourish variants (scurry vs. lunge) to hand to Gemini once mechanics are fully locked. **Deferred** *(Addendum)*: not blocking a build.
7. **VF's trigger cue** — "pops up and says 'Clear Fuel'" needs a concrete visual/audio spec once art direction starts. **Deferred** *(Addendum)*: not blocking a build. VF's 10–30 min duration is **confirmed** *(Addendum)*. *(Timer Refinement)* The cue is now a "Clear Fueling" speech bubble (§7); its final look and any sound are still art direction's.
8. ~~**Wipe input mechanism**~~ — **Resolved** *(Addendum)*: click-and-drag, pending a playtest of the feel. §8.
9. **Mess magnitude and wave structure** — wave structure **resolved** *(Addendum)*: a quota of 8, +2 per wave, with clears and hatches both counting, and a cleanup window between waves that *(seventh draft)* shrinks from 5–10 s to a 3 s floor (§4, §8). Mess spread **resolved** *(seventh draft)*: the smooshed nest plus its direct neighbors. Still open, as look rather than rules: how much gunk one smoosh adds, and how the cleanup window is presented.
10. ~~**Mid-wave clean cost**~~ — **Resolved** *(Addendum)*: lost typing time only, no point penalty. §8, §10.
11. ~~**Wrong-type CAV entry**~~ — **Resolved** *(Addendum)*: rejected silently, no pool damage. §6. See C5.
12. ~~**Ending conditions**~~ — **Resolved** *(Addendum, confirmed 2026-09-16)*: waves never end the game; they only escalate difficulty and check the quota, and the sole game over is the pool reaching zero. Andrew gave the yes in Code's question box, and Chat locked it in the Addendum's third draft. §4, §9.
13. ~~**Follow Progression ramp trigger**~~ — **Resolved** *(Addendum)*: one-phase for waves 1–2, then a placement chance of 0% at wave 3, +10% per wave, 100% by about wave 13. §5.
14. **Instruction screen** with a PowerLine command reference — not yet designed. Required per the house-rule resolution above. **Deferred** *(Addendum)*: not blocking a build.
15. **Title screen and end-of-game screen** — not yet designed. Required per the house-rule resolution above. **Deferred** *(Addendum)*: not blocking a build.
16. ~~Rename execution~~ — **Done.** Folder, packet filename, launcher, shortcut, resume word (`continue_et`), and memory all updated to Egg Timer. Laws §0.23 register, Overview roster, and Build Procedure on-disk paths updated via amendments A2–A4. Two loose ends remain: `PLC_Project_Instructions.md` (manual fix, Andrew's Project settings) and the Overview's Speed Drills note / Build Procedure's stale naming example (drafted as amendment A5, not yet applied).
17. ~~**Autocomplete for CAV entry**~~ — **Resolved** *(Addendum, seventh draft)*: **no autocomplete/suggestion list for v1.** Simplest option, and there's nothing for Tab to conflict with.

### Raised by Claude Code on merging the Addendum

~~C1–C14 are resolved. **C15 is open**: two small wording points in the eighth draft, for Chat.~~ *(Rulings, draft 9)* **C1–C15 are all resolved.**

- ~~**C1. §12's F12 toggle is still blocked.**~~ **Resolved** *(Addendum §9)*: F12 keeps its arcade-wide meaning (clear the active box, no penalty). The player picks **1–4** in-page Command Boxes and switches between them with **Tab**, through a switcher menu (§12). The boxes exist in all three modes, and staged text clears when a new wave starts. See C7–C11 for what checking §9 turned up. *(Original flag: F12 already clears the command box at no penalty in Asteroid Command and The Aquanaut, and §12's reasons for F12 being safe didn't hold. Full findings: the filing note in `Previous Versions/EGG_TIMER_CONTEXT_PACKET_v3.md`.)*
- ~~**C2. What the readout's timer shows during overtime.**~~ **Resolved** *(seventh draft)*: it keeps counting up past the trigger, with no special display logic (§4). But see C12. *(Original flag follows.)* §4 puts a countdown on each readout. Before the trigger it can count down to bold. After it, counting down to the hatch would show the per-instance jitter, which is meant to be unpredictable. Not specified.
- ~~**C3. VF and the growing egg.**~~ **Resolved** *(seventh draft)*: no egg at all during VF's regular phase; the egg appears already cracking at the trigger, when "Clear Fuel" fires (§7). *(Original flag follows.)* VF has "no visible countdown" (§3), but every CAV's egg now grows visibly from the start, which works as a countdown by another name. Does a VF nest show a growing egg at all? And is VF's "Clear Fuel" pop the bold trigger (bold, `RCAV` valid, crack)?
- ~~**C4. Numbers the build still needs.**~~ **Resolved** *(seventh draft)*: no penalty for waiting to place, with *(eighth draft)* a 20 s → 8 s auto-open timeout (C13); spawn gap 5–7 s in wave 1, shrinking to 1 s (§4); 10 points per placement (§10); mess goes to the smooshed nest and its direct neighbors (§8); neighbors are up/down/left/right in a 2D grid (§4, and see C14). *(Original flag follows.)* The placement grace window in two-phase play (§6); how often new CAVs start within a wave, including the one-at-a-time stagger in Clear CAVs Only (§5); points for a placement (§10's "small points"); how much mess a smoosh leaves and how much spreads to neighbors (item 9); and which nests count as neighbors as the grid grows from 5 to 12. Andrew may OK placeholder values for playtesting, but Code won't pick them.
- ~~**C5. The wrong-type example.**~~ **Resolved** *(seventh draft)*: a real but mismatched code is rejected silently too (§6). *(Original flag follows.)* The Addendum's `CAV 2101 XX` uses a code that doesn't exist. Item 11 was about a real code that doesn't match the nest, such as `CAV 2101 VS` when the nest is due an MB. Presumably that's rejected silently too. Confirm.
- ~~**C6. Small readings to confirm.**~~ **Resolved** *(seventh draft)*: placement first possible in wave 4 is intended; 6 nests from wave 3 and 12 at wave 15 is right; the cleanup window shrinks 0.5 s per wave to a 3 s floor. *(Original flag follows.)* Follow Progression's chance is 0% at wave 3, so wave 3 plays like waves 1–2 and placement can first appear in wave 4. "+1 nest every 2 waves" is read as 6 nests from wave 3, reaching 12 at wave 15. And is the 5–10 second cleanup window random each time, or does it change with the wave?
- ~~**C7. Ctrl+Tab works inside Fang Rock, but not in an ordinary browser tab.**~~ **Resolved** *(Addendum §9, fourth draft)*: Egg Timer **must also run in a plain browser tab**, so the toggle moved from Ctrl+Tab to **Tab**, which a page can take over with `preventDefault()`. *(Original flag: Fang Rock sets no app menu, so Ctrl+Tab reaches the page there, but Chrome, Edge and Firefox keep it for switching tabs, which covers the dev server and the public website.)*
- ~~**C8. "Register Egg Timer in Fang Rock" isn't a Fang Rock change.**~~ **Resolved** *(seventh draft)*: the disk id is **`eggtimer`**, and the hub entry goes in when the build starts. *(Original flag follows.)* Checked in the shell's `main.js` and the hub: Fang Rock keeps no list of games. It takes the word after `fangrock://arcade/`, checks it's **plain lowercase letters** (`^[a-z]+$`), and passes it to the arcade page as `?cart=<word>` without knowing what it means. The hub checks that word against its own disk list, `Game/cat/disks.js` (`asteroid`, `aquanaut`, `pitstop`). So "registering" means two things. First, a disk entry in the hub whose id is letters only: `eggtimer` would work, but `egg-timer` or `egg_timer` fails the shell's check, and the arcade opens without a game. Second, the room's cabinet firing that link, which the separate Rec-Bay 4 handoff already asks for. Code hasn't added the disk entry: there's no game to launch yet, this cartridge's rules say not to add it to either hub until Andrew says so, and `Game/` is the public website, so an entry now would publish a disk that points at nothing. Needed: the disk id, and the go-ahead for when the entry goes in. *(Addendum, fourth draft)* **Proposed:** disk id `eggtimer` (it passes the shell's letters-only check), with the hub entry added only when the build actually starts. **Not yet confirmed by Andrew** — the Addendum says to confirm before acting.
- ~~**C9. Tab already does something in The Aquanaut.**~~ **Resolved** *(Addendum §9, fifth draft)*: Tab's reuse is fine. The Aquanaut's use is narrow and contextual, not an arcade-wide convention like F12's, and a dispatcher is only ever in one cartridge at a time. Whether Egg Timer gets its own autocomplete, which could clash with Tab inside Egg Timer, is item 17. *(Original flag follows.)* Checked in its `files/script.js`: while the autocomplete list under its command box is showing, **Tab fills in the highlighted suggestion**. In Egg Timer, Tab would open the box switcher instead. It's the same kind of clash as F12, but narrower: the Aquanaut only uses Tab while that list is open, and its code doesn't handle Tab at any other time. Asteroid Command gives Tab no job, and the hub leaves every key to a running game except its own exit keys (Ctrl+Esc and Shift+Esc). Needed: is a different Tab meaning in Egg Timer OK, or should the switcher use another key?
- ~~**C10. How the switcher menu is used isn't specified, and that's more than cosmetic.**~~ **Resolved** *(Addendum §9, fifth draft)*: Command Boxes are the switcher's only entries for now. Tab and Shift+Tab cycle, and the arrow keys also move the highlight. Enter confirms and closes; Escape closes without switching. With 1 box, Tab does nothing. The game keeps running while the switcher is open. The 1–4 choice is made on the mode-selection screen. See §12. *(Original flag follows.)* The Addendum marks the switcher's look and the box colors as cosmetic, but the build also needs to know how it works: how the player picks a box once it's open (Tab again to cycle, arrow keys, number keys, Enter?); how to close it without switching; what the other entries are (Command Boxes are "always the first entries", so something comes after them); what Tab does if the player chose only 1 box; whether the game keeps running while the menu is open; and where the 1–4 choice is made (on the mode-button screen, or a screen of its own).
- ~~**C11. Egg Timer has no pause.**~~ **Resolved** *(Addendum §9, sixth draft)*: **Esc, and only Esc**, is the pause. It closes the switcher when that's open, and pauses or resumes the game when it isn't. Andrew has made Esc the arcade-wide pause key, with no second key. *(Original flag follows.)* Nothing in the packet pauses the game, and the Addendum confirms the switcher doesn't either. The other two cartridges both let the player pause mid-game: checked in their `files/script.js`, **Esc pauses and resumes** in Asteroid Command and The Aquanaut, and **P** does too in The Aquanaut. In Egg Timer, Esc now closes the switcher. Needed: does Egg Timer have a pause at all? If it does, which key, and what does Esc do when the switcher isn't open? *(Build note, not a design question: The Aquanaut goes browser-fullscreen, where browsers normally keep Esc for leaving fullscreen, and it claims Esc back with the Keyboard Lock API. Egg Timer can do the same if it goes fullscreen, so the Escape rule works in a plain tab. Keyboard Lock is Chrome/Edge only. Elsewhere, the first Esc in fullscreen just leaves fullscreen, and The Aquanaut pauses when that happens; if Egg Timer copies that, an Esc pressed while the switcher is open would pause instead of closing the switcher, in those browsers only.)*
- ~~**C12. Does the readout's timer count up or down?**~~ **Resolved** *(eighth draft)*: **up**. It's a deliberate redesign, and the older "countdown" wording in §4 and §7 has been corrected. VF hides the egg and the numeric readout until "Clear Fuel" *(Rulings, draft 9: of the readout, only the timer; see C15)*. *(Original flag follows.)* The seventh draft answers C2 with a timer that "keeps counting up past the bold trigger, same behavior as before". But the packet has always called it a **countdown**: §4 gives each readout "the countdown timer", and §7 says "the nest's countdown starts". No earlier text has it counting up. The choice changes what the player reads. Counting up shows time since the CAV started, like a real CAD status timer, and the bold font marks the trigger. Counting down shows time left to the trigger, and then needs something else once it reaches zero. Needed: which one? And if it counts up, does a VF readout show that timer before "Clear Fuel", given VF has no visible countdown?
- ~~**C13. "No time limit to place" collides with the locked auto-open rule.**~~ **Resolved** *(eighth draft)*: the auto-open backstop is restored. "No time limit" meant no penalty for waiting. The timeout is 20 s, −1 s per wave, floored at 8 s (§6). *(Original flag follows.)* The seventh draft answers C4 with "no time limit to place a CAV on a nest that's asking for one — player-paced, the nest just waits". But §6 has a locked rule, carried since v2: **an ignored trigger auto-opens** by itself and starts counting down. Both can't be true. It also matters for pressure: with no limit and no auto-open, a player in two-phase play could leave every trigger unplaced. Nothing would ever hatch, the pool would never drop, and a wave's quota, which counts resolved CAVs, would never fill. Meanwhile the spawn gap shrinks to 1 s. Needed: does an ignored trigger still auto-open (and if so, after how long), or is the auto-open rule dropped, and if so, what keeps waiting triggers from stalling a wave?
- ~~**C14. Small gaps.**~~ **Resolved** *(eighth draft)*: (a) the spawn timer runs the same in all three modes; (b) a spawn that comes due on a full board is skipped; (c) mess belongs to the nest, and adjacency uses a logical grid under an organic visual layout, with the grid's size left to Code and Gemini (§4, §8). *(Original flag follows.)* (a) The spawn rate is for "auto-spawn modes", a term the packet doesn't define. Is that every mode, or only the one-phase parts? (b) What happens when a spawn comes due and every nest is busy? Does it wait for a free nest, or is it skipped? (c) Neighbors are up/down/left/right in a 2D grid, but the grid's shape for each nest count from 5 to 12 isn't set. That shape decides who is whose neighbor, and when a nest is added between waves, does the mess already on a nest stay on it?
- ~~**C15. Two small wording points in the eighth draft.**~~ **Resolved** *(Rulings, draft 9)*: (a) confirmed: an auto-opened trigger "starts its timer normally (counting up)" (§6). (b) **Only the timer** is hidden until "Clear Fuel"; the unit number and "VF" stay visible throughout fuelling (§3, §4). *(Original flag follows.)* *(Relayed 2026-09-16 as closed, but no written ruling has reached this packet yet. Built provisionally as (a) the timer starts as normal, counting up, and (b) the whole readout hidden — `vfHides` in `files/core/config.js`.)* (a) Its C13 bullet says an auto-opened trigger "starts counting down normally", but its own C12 bullet just retired "countdown": the timer counts up. Presumably it means the timer starts as normal. Confirm. (b) For VF it "hides both the egg AND the numeric readout entirely". Is that only the timer, or the unit number and the "VF" code too? If it's all of them, a fueling nest looks empty until "Clear Fuel", even though it's occupied (a spawn skips it).

### Raised by Claude Code during the build (2026-09-16) — ruled in Draft 9 (2026-09-17), except D3; D5 removed by the Timer Refinement (2026-09-22)

The build started 2026-09-16 under `files/`. These questions came up while building. Each is built as **one switch** in `files/core/config.js` (marked ⏳ PENDING) with a provisional value so the game is playable, but none of them is decided. A ruling is a one-line change there. *(Rulings, draft 9)* D1, D2 and D4–D6 are now decided, and each switch is set to its ruling. D3 is still open.

- ~~**D1. What is Egg Timer's Blank Dataset Module?**~~ **Resolved** *(Rulings, draft 9)*: **not empty.** It holds the seven real CAV types as Developer-Mode-only rows, with exactly the values already on record (§3). It's a testing copy of confirmed real values, not invented data, and Andrew will check it further once gameplay is testable. *(Original question follows.)* Developer Mode swaps the CAV table for it. Built as an **empty** table (`files/datasets/cav_types_blank.csv`, header only), so in Developer Mode nothing spawns and a banner says so. The Empty Cartridge's blank data is "empty challenges and commands", a harness for testing mechanics. For Egg Timer, should it stay empty, or hold a test CAV type? A test type would need a code and a duration from Andrew, since timings are never invented.
- ~~**D2. Does a nest keep one unit all game, or does each new CAV bring a new unit?**~~ **Resolved** *(Rulings, draft 9)*: **a new unit per CAV**, drawn at random each time a nest gets a new CAV, and never one already showing on the board. As built (§4). *(Original question follows.)* The packet says units come from the transport list but not how they attach to nests. Built: **a new unit per spawn**, never two nests sharing one at a time (`unitAssignment`).
- **D3. Developer Mode phrase (for Andrew, not a design call).** Each built cartridge has its own phrase, stored only as a digest. Until one is set, the prompt denies every entry (`devModePasswordHash`).
- ~~**D4. When does a wave stop spawning?**~~ **Resolved** *(Rulings, draft 9)*: **spawning stops once the wave's quota has spawned.** As built (§4). *(Original question follows.)* "A wave ends when a quota of CAVs has been resolved" doesn't say whether spawning continues past the quota. Built: **spawning stops once the quota has spawned**, so the wave ends with nothing left running. The alternative leaves CAVs still running into the cleanup window, which then needs rules of its own (do they keep counting, can they hatch there, do they count toward the next wave?) (`stopSpawningAtQuota`).
- **D5** — *(Timer Refinement, 2026-09-22)* **removed**, as the handoff asked: its game-seconds ruling is superseded by the clocks showing displayed time (§3, §4). Its text is in `Previous Versions/EGG_TIMER_CONTEXT_PACKET_draft9.md`.
- ~~**D6. What does Enter on a rejected command do to the box?**~~ **Resolved** *(Rulings, draft 9)*: **the text stays** in the box on a rejected Enter. As built (§6). *(Original question follows.)* "Rejected silently" doesn't say. Built: **the text stays**, so the player can see it and use F12 to clear it. The alternative clears the box on every Enter (`keepTextOnReject`).

### Raised by Claude Code building the Timer Refinement (2026-09-22) — ruled the same day

~~Each gap is built with a provisional value (a switch in `files/core/config.js` where there's a choice), so the playtest can run. None is a decision.~~ *(Timer Refinement rulings)* Chat ruled E1–E4 on 2026-09-22 and Andrew approved. Each switch is set to its ruling and the logic rig asserts it.

- ~~**E1. A "Clear @" target and a start partway through a minute.**~~ **Resolved** *(Timer Refinement rulings)*: **round up.** "Clear @" is the next whole minute after the start plus the draw, never shorter than the draw (`adClockTarget: "full-minutes"`, switched from the provisional value). §4. *(Original question follows.)* A clock-time note names a whole minute, but a CAV starts partway through one: a start at 14:15:40 with a draw of 20 can't bold exactly 20 minutes later *and* land on a whole minute. Built (`adClockTarget: "shown-minute"`): **the minute showing on the wall clock at the start, plus the draw**, so "Clear @ 14:35", bolding 19:20 later. A draw of 10 can then bold after 9 minutes and a bit. The alternative (`"full-minutes"`) rounds the start up first, so it never bolds before the full draw has passed (20:20 here).
- ~~**E2. When a placement trigger's AD note appears.**~~ **Resolved** *(Timer Refinement rulings)*: **as built**, when the CAV starts. §4. *(Original question follows.)* In Both and in Follow Progression, an AD can arrive as a trigger waiting for `CAV #### AD`. Built (`adNoteFrom: "start"`): the note appears **when the CAV starts** (placed or auto-opened), since both kinds count from the start. Showing it at the trigger instead needs a rule for a "Clear @" time that falls before the player places it, so that option isn't built.
- ~~**E3. "Real" means two things in the handoff.**~~ **Resolved** *(Timer Refinement rulings)*: **displayed time** and **the player's seconds**, throughout, and the §2 example is **10:00 → ~13:00**. §3, §4. *(Original question follows.)* Its §1 defines **real time** as what's displayed (a VS bold at 10:00), but its §7 measures overtime in "REAL seconds, not ET time" and its §8 says "10:00 in 10 real sec", meaning the player's seconds. Built as the numbers require: the overtime window is the player's seconds. This packet says **displayed time** and **the player's seconds**. Needed: a settled pair of words for the packet. Related number check: its §2 example "10:00 → 11:40" is 3⅓ s of overtime at base speed, but the 6 s window reaches about **13:00** in wave 1 (13:18 at most with jitter).
- ~~**E4. VF's draw.**~~ **Resolved** *(Timer Refinement rulings)*: **as built**, anywhere across 10–30 min, not whole minutes. *(Original question follows.)* The handoff makes AD whole minutes and leaves VF "random, hidden". Built: VF still draws **anywhere across 10–30 min**, as before, so its clock appears at an odd time such as 17:23. Whole minutes would make it appear at 17:00 every time.
- **Spawn rate (the handoff's own open item).** Whether the clock speed replaces the spawn-gap shrink or stacks with it is undecided; the shrink is unchanged for the playtest. **Skipped spawns are logged per wave:** in the browser console at each wave's end, and on the game-over screen as "SKIPPED SPAWNS W1 n · W2 n …" (a playtest stand-in, not end-screen design).
- ~~*(Code, a consequence rather than a question)* **"Running CAVs switch to the new speed" never happens in practice.**~~ *(Timer Refinement rulings)* **Removed from the packet**: it can't happen. D4 stops spawning at the quota and a wave ends only once every spawned CAV has resolved, so each wave starts on an empty board. (The code shares one speed across every clock, so it needs nothing either way.)

**Code's own calls, listed so they can be overruled:** the logical grid is 4 × 3, with nests unlocking centre-out; the switcher opens with the next box highlighted (Shift+Tab: the previous one); a wave's first CAV spawns immediately; ranged durations (AD, VF) draw uniformly; clicking a box doesn't switch to it (the switcher is keyboard-only); the game holds while the Developer Mode prompt is open. Presentation placeholders, pending art direction: all creature, egg, splat and mess art, the colours, the trigger cue, the amount of mess per smoosh (item 9), the title and end screens (items 14–15), no instruction screen yet, and no audio.

---

## 12. Command Boxes (dual input, staging mechanic)

> *(Addendum)* Settled: **1–4 Command Boxes inside the page**, the number picked by the player on the mode-selection screen, switched with **Tab** through a switcher menu. F12 keeps its arcade-wide meaning. The struck text below is v3's, kept for the record. Esc closes the switcher, and otherwise pauses. *(Seventh draft)* No suggestion list for v1, and the disk id is `eggtimer`.

New mechanic, replicating a real CAD5 workflow: ~~two input boxes~~ *(Addendum)* **1–4 input boxes, the player's choice**, only one active at a time. **Uses "Command Box" — already-established project vocabulary from the Overview's Empty Cartridge description, not a new term.** ~~Egg Timer simply has two of them where other cartridges have one.~~ *(Addendum)* Egg Timer can have up to four where other cartridges have one.

The player can type/stage a command into the **inactive** box while actively working in the other, then press ~~**F12** to toggle which box is active~~ **Tab** to open the switcher menu and choose the active box *(Addendum)*, and hit Enter to submit whatever's in the now-active box.

- ~~**F12 confirmed as the toggle key.** Initially flagged as risky (F12 is normally a browser-reserved DevTools shortcut, unreliable to capture from page JS in a plain browser tab) — but Egg Timer runs through **Fang Rock**, the Electron shell that owns key handling; the game declares bindings to FR rather than capturing raw browser events, which is what makes F12 safe to use here. **Implementation note for Code:** register this through Fang Rock's existing key-binding interface, not a raw `keydown` listener — that's the part that actually matters for this to work.~~
- *(Addendum)* **F12 keeps its existing arcade-wide meaning: clear the active box, no penalty.** Egg Timer does not redefine it.
- *(Addendum)* **Architecture: single window, in-page Command Boxes — not real separate OS windows.** Real separate windows (like Morbius's pop-out system) were considered and rejected: they can't support the colored switcher with previews below, they add a whole cross-window sync layer and its class of bugs (see the wrong-target trap in `Brief_Popout-Windows-Mechanic_2026-09-16.md`), and pop-up blockers would make them behave differently in Fang Rock and a plain browser tab. **That brief does not apply to Egg Timer.**
- *(Addendum)* **Box count: the player selects 1–4 Command Boxes at the start of the game** (not fixed at 2), so they can pre-load commands across boxes.
- *(Addendum)* **Toggle key: Tab**, not Ctrl+Tab. Browsers keep Ctrl+Tab for themselves in a plain tab, while a page can take over Tab with `preventDefault()`. Tab works the same in Fang Rock and a plain browser tab, and it's bound entirely in-page by Egg Timer's own code, not by Fang Rock.
- *(Addendum, fifth draft)* **Tab reuse is fine**, even though The Aquanaut uses Tab differently (to select an autocomplete suggestion, only while its suggestion list is open). That's a narrow, contextual behavior, not an arcade-wide convention like F12's, so there's no true cross-cartridge collision: a dispatcher is only ever in one cartridge at a time. *(Seventh draft)* Egg Timer gets **no autocomplete for v1**, so there's no internal Tab conflict either (§11 item 17).
- *(Addendum)* Each Command Box has **its own base color**, for quick identification.
- *(Addendum)* Pressing Tab shows a **switcher menu**, where any text currently staged in a box appears as a preview. **Command Boxes are always the first entries** in that menu — *(fifth draft)* and for now the **only** entries; nothing else is planned there yet.
- *(Addendum, fifth draft)* **Switcher navigation:** Tab cycles forward through the boxes, Shift+Tab cycles backward, and the arrow keys also move the highlight (the player's choice of input). **Enter** confirms the highlighted box and closes the switcher. **Escape** closes the switcher without switching.
- *(Addendum, sixth draft)* **Pause: Esc, and only Esc.** Esc is context-sensitive: it closes the switcher without switching when that's open, and pauses/resumes the game when it's not. This is now the arcade-wide standard (§13 handoff notes) — no secondary key.
- *(Addendum, fifth draft)* **With only 1 box selected, Tab does nothing** — no switcher opens, since there's nothing to switch to.
- *(Addendum, fifth draft)* **The game keeps running while the switcher is open** — no pause, consistent with nothing else in the design pausing for UI.
- *(Addendum, fifth draft)* **The box count (1–4) is chosen on the same screen as mode selection** — one combined setup step at round start, not a separate screen (§5).
- *(Addendum)* **Egg Timer must also run in a plain browser tab**, not just inside Fang Rock — the same as Asteroid Command and The Aquanaut today.
- *(Addendum)* **Egg Timer is an Arcade cabinet**, launched through `fangrock://arcade/<disk-id>` the same way Asteroid Command and The Aquanaut are — themed as hammer-and-nests rather than cab-and-joysticks, but the launch path is identical. Its registration is in §13 and §11 C8.
- *(Addendum)* **No Fang Rock key-binding interface is needed** — that assumption is dropped. F12 and Tab reach the page as plain keystrokes. Ctrl+Tab isn't used anywhere in this project.
- **Applies across all three modes** (§5) — ~~recommended default, not yet explicitly confirmed~~ **confirmed** *(Addendum)*: all active Command Boxes exist in all three modes. Even in Clear CAVs Only, staging an `RCAV` for one nest while typing another has real value; this isn't a two-phase-only feature.
- **Staged/unsubmitted content clears at wave transitions** — ~~recommended default, not yet explicitly confirmed~~ **confirmed** *(Addendum)*: text staged in an inactive box clears when a new wave starts. Simplest behavior, avoids a stale command carrying into a new wave unexpectedly.
- **Needs a clear visual indicator of which box is active** — open art/UI item, not yet designed. Real CAD5 makes this obvious; the game needs to as well, or players will submit into the wrong box by accident. *(Addendum)* Still open: the exact look of the switcher menu and the box colors, cosmetic and not blocking a build.

---

## 13. Handoff note for Claude Code

~~Design-stage only — the build gate (Laws v2.0 Core Law 15) still applies: no gameplay code until §11 is resolved and Andrew explicitly authorizes the build.~~ *(Addendum, seventh draft)* **BUILD GATE STATUS: CLEARED.** Andrew authorized the build on 2026-09-16, with C8, item 17, and the pool name explicitly resolved. Claude Code may begin implementation. *(Claude Code: C12–C14 were answered in the eighth draft, and C15 and the build questions D1, D2 and D4–D6 in the Draft 9 rulings of 2026-09-17. Only D3, the Developer Mode phrase, is open — see §11.)* As a Standalone Cartridge, build fresh under `cartridges/Egg Timer/`, not from `blank/`; do not reuse the Impact Zone/Resource shapes or Target/Challenge lifecycle from other cartridges. Name things in this cartridge's own vocabulary — nests, eggs, hatching, escape, the pool — not the retired Target/Impact terms.

**Rename note:** complete — see §11 item 16. No further rename action needed except the two loose ends noted there.

**Handoff notes** *(Addendum)*:
- Register Egg Timer as a Fang Rock Arcade room/disk-id — currently missing. **Confirmed 2026-09-16** *(seventh draft)*: disk id is `eggtimer`; hold off adding the hub entry until the build actually starts (i.e., now). *(Claude Code: it's a disk entry in the hub's `Game/cat/disks.js`, not a Fang Rock change — §11 C8. ~~Not added yet.~~ Added 2026-09-16 when the build started, marked `coming-soon` until launch.)*
- Correction to the packet's old key-handling assumptions: Egg Timer does not need a Fang Rock key-binding config interface. F12 and Tab both reach the page as plain keystrokes; Tab is bound entirely in-page by Egg Timer's own code, not by Fang Rock. Ctrl+Tab is not used anywhere in this project — Code's search of Morbius and the shell confirmed it's unbound; earlier packet language suggesting otherwise was incorrect. *(Claude Code: the Morbius search was in the popout brief's session; this session checked the shell. Both found no Ctrl+Tab handler.)*
- The popout-window mechanics brief does not apply to Egg Timer — it uses a single-window architecture, not real separate windows.
- *(Seventh draft)* **Out of scope for this packet**: Andrew has set Esc as the arcade-wide standard pause key going forward. Asteroid Command already matches (Esc-only, already in its own help screen — no change needed). **Only Aquanaut needs updating**: it also pauses on P, which gets dropped. This is a separate change to an already-shipped cartridge, belongs to Aquanaut's own session, and is not part of the Egg Timer build. *(Claude Code: the Aquanaut's `AQUANAUT_DESIGN.md` records P as Andrew's earlier pick; without P, Esc still pauses there in every browser.)*

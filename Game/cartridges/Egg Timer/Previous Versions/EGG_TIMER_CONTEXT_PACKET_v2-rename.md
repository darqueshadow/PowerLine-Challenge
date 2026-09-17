> **FILING NOTE — Claude Code, 2026-09-15.** This is **v2, revised again: the Egg Timer rename**. Filed
> verbatim from Andrew's `Downloads/whack-a-cav-mini-game-context-packet.md` (14:44). Everything below
> the rule is the packet as written; nothing in it has been edited. Against the previous filing, the
> only changes are the rename: the title, the governance-status line, a new "Name & branding"
> paragraph, open item 16, and the handoff note. Earlier filings, each with its own filing note, are in
> `Previous Versions/`: `_v1`, `_v2-first-filing`, `_v2-revised`.
>
> **The rename, as of filing:**
>
> - **Governance is already done.** The packet expects Claude Chat to update the Laws register, the
>   Overview roster and the Build Procedure "separately". By filing time, amendment A2 (name only, Chat
>   drafted, Andrew directed) was already in all three, with `.md` and `.txt` identical. The Overview's
>   three older A1 notes still say "Whack A CAV": the Speed Drills OPEN note, the Gameplay Flow note and
>   the Impact-tables note. Those are left for Chat.
> - **Nothing on disk is renamed yet, on purpose.** The packet says Code updates on-disk items only once
>   Andrew gives the go-ahead. The folder, this file's name, `claude-wac.cmd`, the desktop shortcut
>   *Whack A CAV (Claude Code)*, the resume word `continue_wac` and the memory store all keep the old
>   name. The Build Procedure's A2 entry likewise keeps its paths as `Whack A CAV/` until the move.
>   - **Update, later 2026-09-15:** Andrew directed the on-disk rename (Build Procedure amendment A4,
>     resume word `continue_et`). **This file was renamed** from `WHACK_A_CAV_CONTEXT_PACKET.md` to
>     `EGG_TIMER_CONTEXT_PACKET.md`, and `claude-et.cmd` was staged. Andrew moves the folder himself,
>     with no session open inside it. A4 is applied only after the move is verified. The archived copies
>     in `Previous Versions/` keep their `WHACK_A_CAV_` names, because that's what they were called when filed.
>   - **Update, end of 2026-09-15: the on-disk rename is done.** Andrew moved the folder to `Egg Timer/`.
>     Claude Code then replaced the shortcut with *Egg Timer (Claude Code)* → `claude-et.cmd`, removed
>     `claude-wac.cmd`, moved the memory store to the `Egg Timer` path, and updated `Game/CLAUDE.md`,
>     `REPO_WIRING.md` and the memory routing. Open item 16 is closed. The packet body below is untouched.
> - **What a folder move touches** (inventoried at filing):
>   - The folder itself, and this packet's filename.
>   - `claude-wac.cmd` and the `.lnk` on the OneDrive Desktop that points at it.
>   - `Game/CLAUDE.md`, `PLC_Project_Instructions.md` and `REPO_WIRING.md`.
>   - The Build Procedure's on-disk paths (Chat's lane).
>   - The root memory index's resume-word routing line.
>   - The `/resume` history, which is keyed to the folder path, so past sessions stop showing under the new one.
>   - The memory store directory. Since Claude Code now keys auto-memory to the git root, the store is
>     reached by its explicit path and can keep its name.
>   - The folder is untracked in git, so there is no history to carry over. GitHub Pages is
>     case-sensitive, so the new path must be matched exactly everywhere.
> - The packet body still says "Whack A CAV" in two places (the Developer Mode line of the house-rule
>   resolution, and §9). That's harmless; it's the same cartridge.
> - The E.T. note is for Gemini: typography only, original creatures, no likeness.
>
> **Carried forward from the previous filing (still true):**
>
> - Developer Mode is Ctrl+Shift+B, then a 10-second password prompt in every built cartridge, not a
>   bare toggle. Swap in the Blank Dataset Module on unlock; this cartridge's will be the first one wired.
> - VF's 10–30 min duration is a recommendation that Andrew hasn't confirmed.
> - The egg-appearance timing (§11.3) sets every `RCAV` window, so it's a core difficulty dial.
> - The transport units are `Game/datasets/AP_ENP_BSE/2. Units_Transports.csv` (59 units).
> - "Round", "wave" and "game" are used loosely. Settle them with the wave structure.
> - Governance still lags the packet (Chat's lane):
>   - The Overview's flow note calls one-phase vs two-phase pending, and its OPEN note says Speed Drills.
>   - The Overview doesn't record the menu-rule resolution (mode buttons as the difficulty menu,
>     dataset menu moot).
>   - The Build Procedure's naming example still says "slots, triggers, countdowns, escapes".

---

# Egg Timer *(formerly Whack A CAV)* — Mini-Game Context Packet (v2)

**Status:** Design stage. Core mechanic, modes, and CAV data are locked. Several presentation-level items remain open (marked in §11). Not build-authorized until §11 is resolved and Andrew gives the go-ahead — per Laws v2.0 §0.23 / Core Law 15's build gate.

**Document type:** Mini-Game Context Packet (Technical Manual §J).

**Governance status:** Registered **Standalone Cartridge** (Laws v2.0 §0.23, Core Law 15 — ratified 2026-09-15) under the name **Whack A CAV**; renaming the register entry to **Egg Timer** is a governance update still pending (see below). Not duplicated from the Empty Cartridge. Does not use Target / Challenge / Impact Zone vocabulary. Still bound by: Data Sheet integrity (no invented values), real PowerLine syntax, Developer Mode gating, Claude Code as sole point of merge, no cross-cartridge convention imposition, and the build gate below.

**Name & branding (new):** Renamed from Whack A CAV to **Egg Timer** — a happy accident: styling the "E" and "T" in a distinct font/weight makes the title read as "ET" from a distance, tying directly into the alien-egg creature theme. Confirmed direction, not yet executed anywhere outside this document. **Creature/art direction note for Gemini:** the ET wordplay is just typography on ordinary words — keep the actual creature designs clearly original, not a visual likeness of Spielberg's E.T. specifically.

**Menu placement:** Sits in the flat Main Menu roster (categories retired system-wide). Whether "Speed Drills" survives as a label anywhere is still Andrew's open call per Overview v2.0, and doesn't affect this cartridge either way.

**House-rule resolution (this round):** every Cartridge is required (Overview, Core Concepts) to have its own difficulty/dataset/instruction menus, title screen, and end screen. Standalone-Cartridge status (§0.23) lifts the Target/Impact model, not this. Resolved as follows:
- **Difficulty menu:** the three mode buttons (§5) satisfy this — a dedicated per-cartridge selection screen, just presented as physical-feeling buttons rather than a dropdown.
- **Dataset selection:** does not apply here — there's no Challenge Set to choose between, just one CAV table, so the rule has nothing to bind to.
- **Instruction screen w/ command list, title screen, end screen:** genuine gaps, not yet designed. Added to §11.
- **Developer Mode → Blank Dataset Module access:** no separate screen needed. Developer Mode is already hidden/keyboard-gated everywhere (Ctrl+Shift+B), not surfaced through any cartridge's own menu — the same toggle swaps Whack A CAV's CAV-type table for the Blank Dataset Module when active.

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

| Code | Meaning | Duration | Notes |
|---|---|---|---|
| VS | Vehicle Service | 10 min | |
| STR | Stretcher Clear | 10 min | often follows a VS |
| SS | Start Shift | 15 min | |
| EOS | End of Shift | 30 min | |
| MB | Meal Break | 30 min | |
| AD | Admin CAV | random, 10–30 min | |
| VF | Vehicle Fueling | no visible countdown | **two-phase only** (requires placement); pops silently with "Clear Fuel," then same reaction window as every other type once it pops. No real-world "typical" time exists to be faithful to — recommended default: same 10–30 min random band as AD, treated as pure game-balance, not realism. **Not yet explicitly confirmed by Andrew.** |

Timer compression ratio (real time → game time): **TBD**, previously discussed default of 1 real minute = 1 game second, as a single tunable config value, not hardcoded. Not re-confirmed this session — revisit before build.

---

## 4. Playfield structure

- Fixed grid of **nests** (slot count — **TBD**, see §11).
- Each nest has a **separate digital readout below it** — unit number and **the literal CAV type code (MB, VS, etc. — confirmed, shown directly, not a plain-language cue requiring translation)**, plus the countdown timer. This is deliberately not on the egg itself, so the readout stays legible regardless of the egg's animation state.
- The egg is purely the animated hazard object — no text, no UI role.
- **Units drawn from transport units only** (confirmed) — not the full unit roster.

---

## 5. Modes (player-selected, three buttons at round start)

Presented as three physical-feeling buttons at the start of each game — not a CAD-style dropdown/setup menu. Fits the arcade-cabinet framing (real cabinets commonly have a mode-select button bank).

1. **Clear CAVs Only** — one-phase. Nests activate **staggered, one at a time** (confirmed — not all at once), each opening with a CAV already placed. Player only ever types `RCAV ####`. Pure reflex drill on the clear command.
2. **Follow Progression** — starts one-phase, ramps into requiring `CAV #### TYPE` placement as difficulty/rounds progress. Teaching ramp: learn `RCAV` first, `CAV` added later.
3. **Both** — two-phase throughout. Every CAV must be placed by the player before it can be cleared.

VF (§3) only appears in two-phase segments (Follow Progression once ramped, or Both throughout) — it has no meaning in a mode where the player never places anything.

---

## 6. Phase A — Trigger/Place (two-phase segments only)

- A nest signals a CAV is due (visual/audible cue — details TBD).
- Player has a grace window to type `CAV #### TYPE` correctly.
- **Ignored trigger (resolved):** if a CAV trigger isn't placed in time, it auto-opens by itself and starts counting down — matches the original draft behavior.
- **Open:** what happens if the player places the wrong type code (`CAV #### <wrong TYPE>`)? Not yet decided — presumably a rejected/no-op entry with no pool cost (consistent with how other mistypes work), but not explicitly confirmed.

---

## 7. Phase B — Countdown, egg, hatch

- Once a CAV is placed (or pre-opened, in one-phase mode), the nest's countdown starts, compressed per the ratio in §3.
- **Valid clear window (resolved — closes an exploit):** `RCAV ####` has **no effect until the egg has actually appeared** in the nest, symmetric with the rule that it also has no effect after the egg fully hatches. Without this floor, "place then instantly clear" would be the optimal strategy under any speed-based scoring, which would let the player skip the reflex drill entirely — the whole point of the game. `RCAV` is only meaningful during the appeared-but-not-yet-hatched window.
- As the timer runs low, an **alien egg appears in the nest and cracks progressively** — this is the escalating visual warning, replacing/augmenting a simple font-bold cue. Exact relationship between "font goes bold" (original idea) and "egg appears and cracks" (this session's addition) — **TBD**, likely the egg fully replaces the font-bold cue rather than both happening, but not explicitly confirmed.
- **Clear (success):** `RCAV ####` lands before the egg fully hatches → **egg gets smooshed**, turning into a randomly chosen cooked-egg splat (scrambled, deviled, poached, sunny-side-up, etc. — a variety pool, same pattern as the escape flourish below). Points awarded, nest resets to idle.
- **Escape (failure) — final and irreversible:** if the timer hits zero, the egg finishes hatching and the creature is loose. **`RCAV` no longer does anything to it at this point** — there is no post-hatch recovery via command. The creature performs a randomly chosen escape flourish — **scurries away, or lunges at the screen** (variety pool, mirrors the cooked-egg splat pattern) — and the nest then auto-resets to idle on its own. No lingering "overdue" state requiring further player action.

---

## 8. Mess accumulation & wipe mechanic

Each successful smoosh (§7) leaves a small amount of mess/gunk on the unit's panel — not a big splatter individually, but it **accumulates in real time during the wave**, visibly, immediately after each crack. Over a wave, gunk gradually covers the digital readouts (unit/CAV/timer), making them progressively harder to read.

- **Cleaning is player-controlled, mouse-driven** (exact input mechanism — click, drag/wipe gesture, or click-and-hold — **TBD**).
- **Mid-wave cleaning is allowed** — the player can stop typing for a moment to wipe a panel, trading typing time for legibility. This is a real tradeoff, not a free action.
- **A dedicated cleanup window exists between waves** as well.
- **No cap — the spiral is intentional.** If mess isn't managed, it carries forward and compounds wave over wave, and a panel can become fully obscured if consistently ignored. This is deliberate difficulty tension, not an oversight.
- **Emergent link to the failure pool (§9):** this isn't a separate penalty system — it's a consequence chain. A harder-to-read display makes it more likely the player misjudges timing or misreads a unit, which increases the odds of an escape, which is what actually drains the pool. Falling behind on cleaning has a real cost even though cleaning itself never directly touches the pool.

---

## 9. Stakes / failure pool

- A depletable pool (name, flavor, and starting size — **TBD**) takes damage **only when a CAV escapes** (fully hatches). Confirmed: mistyped or incorrect commands do **not** drain it — only a full escape does. (Obscured displays from unmanaged mess can indirectly increase escapes — see §8 — but nothing about the mess mechanic itself touches the pool directly.)
- Pool reaching zero **ends the round/game.** This is a deliberate choice, not a requirement — Whack A CAV, as a Standalone Cartridge, is exempt from having to define a Terminal Failure State at all, but Andrew chose to give it real stakes anyway.
- Escape does **not** separately cost points — the pool damage is the entire consequence of an escape.

---

## 10. Scoring (draft)

- Successful `CAV #### TYPE` placement within the trigger window (two-phase only): small points.
- Successful `RCAV ####` clear before hatch: larger points, possibly scaled by time remaining (faster clear = more points) — not confirmed this session, carried as an idea from v1.
- Escape: no points, pool damage per §9.
- **Open:** does mid-wave cleaning cost anything beyond the lost typing time itself (e.g. no separate point penalty), or is the opportunity cost the only cost? Leaning toward "the lost time is the only cost" as the simplest read, but not explicitly confirmed.

---

## 11. Open items requiring Andrew's decision before Code builds anything

1. **Timer compression ratio** — not re-confirmed this session; needs a final number (or confirmation of the earlier 1 real-min = 1 game-sec default) before any timer logic is built.
2. **Slot/nest count** and how it scales with difficulty (6–9 range floated, not locked).
3. **Egg-crack timing curve** — when the egg first appears relative to the countdown, and how its crack progress maps to time remaining. Also whether the egg replaces the earlier "font goes bold" cue entirely, or the two coexist.
4. **Pool details** — name/flavor, starting size, whether it can be replenished mid-round.
5. **Scoring specifics** — exact point values, whether clear speed affects score.
6. **Creature/theme roster** — the "creepy crawly" family that hatches out (not yet chosen), plus the specific cooked-egg splat variants and escape-flourish variants (scurry vs. lunge) to hand to Gemini once mechanics are fully locked.
7. **VF's trigger cue** — "pops up and says 'Clear Fuel'" needs a concrete visual/audio spec once art direction starts. VF's duration itself has a recommended default (§3) pending confirmation.
8. **Wipe input mechanism** — click, drag/wipe gesture, or click-and-hold not yet specified.
9. **Mess magnitude and wave structure** — how much gunk per smoosh, how many CAVs/how long a wave runs, and how the between-wave cleanup window is presented.
10. **Mid-wave clean cost** — confirm whether lost typing time is the only cost, or there's also a scoring penalty.
11. **Wrong-type CAV entry** — what happens if the player places the wrong type code (§6).
12. **Ending conditions** — can a game end any way other than the pool running out (e.g. after a set number of waves)?
13. **Follow Progression ramp trigger** — when exactly does the two-phase (placement) requirement start — after N waves, a score threshold, or something else?
14. **Instruction screen** with a PowerLine command reference — not yet designed. Required per the house-rule resolution above.
15. **Title screen and end-of-game screen** — not yet designed. Required per the house-rule resolution above.
16. **Rename execution** — the cartridge is renamed to Egg Timer in this document only. Still needed: Laws §0.23 register entry, Overview roster entry, Build Procedure folder note (all Claude Chat's lane), plus the on-disk folder name, desktop shortcut, resume word, and CLAUDE.md/memory (Claude Code's lane) — see handoff note below.

---

## 12. Handoff note for Claude Code

Design-stage only — the build gate (Laws v2.0 Core Law 15) still applies: no gameplay code until §11 is resolved and Andrew explicitly authorizes the build. As a Standalone Cartridge, build fresh under `cartridges/` (folder name pending rename, see §11 item 16), not from `blank/`; do not reuse the Impact Zone/Resource shapes or Target/Challenge lifecycle from other cartridges. Name things in this cartridge's own vocabulary — nests, eggs, hatching, escape, the pool — not the retired Target/Impact terms.

**Rename note:** the cartridge is now named **Egg Timer** (formerly Whack A CAV) per Andrew's decision. This document reflects the new name. The Laws §0.23 register, Overview roster, and Build Procedure folder note still say "Whack A CAV" — Claude Chat will issue that governance update separately. On-disk items (folder name, desktop shortcut, resume word, CLAUDE.md, memory) are Code's to update once Andrew gives the go-ahead — do not rename anything unprompted.

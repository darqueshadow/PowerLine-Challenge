> **FILING NOTE — Claude Code, 2026-09-15.** This is **v2** of the packet, filed here verbatim
> from Andrew's `Downloads/whack-a-cav-mini-game-context-packet_2.md`, the copy he named. (`_1`
> is byte-identical to it. A shorter v2 draft in the same folder, without the mess mechanic, is
> superseded by it.) Everything below the rule is the packet as written; nothing in it has been
> edited. v1, with its own filing note, is kept at
> `Previous Versions/WHACK_A_CAV_CONTEXT_PACKET_v1.md`.
>
> Checked on filing:
>
> - **The governance citations are correct.** The Standalone Cartridge definition and its Core Law
>   are where the packet says. Its "still bound by" list is shorter than the law's, and the law's
>   list is the one that governs. Modes (Demo/Publish), modular files, themes, the PET Terminal
>   and Developer Mode's test-only dataset all still bind.
> - **Stale cross-reference.** The Status line puts the open items, and the build gate, at "§10".
>   They are in **§11**; §10 is Scoring. The earlier draft numbered them §10 before the mess section
>   was inserted. Read the Status line's "§10" as §11.
> - **v1's "Speed Drills" conflict is resolved by the packet itself.** v2 places Whack A CAV in the
>   flat roster.
> - ⚠️ **Possible clash with system-wide menu structure, sent to Andrew.** The Overview gives every
>   cartridge its own difficulty / dataset / instruction menus, title and end screens, and an
>   instruction screen with a PowerLine command list. v2 says there is no difficulty/dataset
>   selection screen, only three mode buttons. Open: do the mode buttons count as the difficulty
>   menu, and where is Developer Mode's test-only dataset reached without a dataset menu? Until
>   Andrew rules, the system-wide rule stands.
> - **Gaps not listed in §11, raised with Andrew on filing:**
>   - VF's hidden time: how long after placement "Clear Fuel" pops. No value is given, so never invent one.
>   - Whether `RCAV` is accepted before the egg appears. If it is, and faster clears score more, the
>     best play is to clear straight after placing, which skips the drill.
>   - Whether a due-trigger names the type, and what a wrong-type placement does.
>   - How a game ends other than the pool emptying, and when Follow Progression switches placement on.
>   - Whether Clear CAVs Only opens every nest at once or one at a time. §5 gives both.
>   - Which real units fill the nests. The shared Data Sheet has `Game/datasets/AP_ENP_BSE/`
>     `2. Units_All.csv` and `2. Units_Transports.csv`.
> - **§3's durations are Andrew's**, so they are real values to build from. Store the type table as
>   extensible data, as §3 asks. Anything not in it (VF's hidden time, the compression ratio, new
>   codes) is still never invented.
> - **Governance now lags this packet.** That's Chat's lane, so it was not edited. The Overview's
>   flow note still calls one-phase vs two-phase pending, and its OPEN note still says the packet
>   places the game under Speed Drills. The Build Procedure's naming example still says "slots,
>   triggers, countdowns, escapes", where v2 says nests, eggs, hatching, escape and the pool, and its
>   on-disk listing predates `Previous Versions/`.

---

# Whack A CAV — Mini-Game Context Packet (v2)

**Status:** Design stage. Core mechanic, modes, and CAV data are locked. Several presentation-level items remain open (marked in §10). Not build-authorized until §10 is resolved and Andrew gives the go-ahead — per Laws v2.0 §0.23 / Core Law 15's build gate.

**Document type:** Mini-Game Context Packet (Technical Manual §J).

**Governance status:** Registered **Standalone Cartridge** (Laws v2.0 §0.23, Core Law 15 — ratified 2026-09-15). Not duplicated from the Empty Cartridge. Does not use Target / Challenge / Impact Zone vocabulary. Still bound by: Data Sheet integrity (no invented values), real PowerLine syntax, Developer Mode gating, Claude Code as sole point of merge, no cross-cartridge convention imposition, and the build gate below.

**Menu placement:** Sits in the flat Main Menu roster (categories retired system-wide). No internal difficulty/dataset selection screen in the CAD-menu sense — instead, the player picks one of three physical-feeling mode buttons at the start of a round (see §5). Whether "Speed Drills" survives as a label anywhere is still Andrew's open call per Overview v2.0, and doesn't affect this cartridge either way.

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
| VF | Vehicle Fueling | no visible countdown | **two-phase only** (requires placement); pops silently with "Clear Fuel," then same reaction window as every other type once it pops |

Timer compression ratio (real time → game time): **TBD**, previously discussed default of 1 real minute = 1 game second, as a single tunable config value, not hardcoded. Not re-confirmed this session — revisit before build.

---

## 4. Playfield structure

- Fixed grid of **nests** (slot count — **TBD**, see §10).
- Each nest has a **separate digital readout below it** — unit number, CAV type, countdown timer. This is deliberately not on the egg itself, so the readout stays legible regardless of the egg's animation state.
- The egg is purely the animated hazard object — no text, no UI role.

---

## 5. Modes (player-selected, three buttons at round start)

Presented as three physical-feeling buttons at the start of each game — not a CAD-style dropdown/setup menu. Fits the arcade-cabinet framing (real cabinets commonly have a mode-select button bank).

1. **Clear CAVs Only** — one-phase. Every nest's CAV is already open when a round of play begins (or opens automatically on a timer with no player action). Player only ever types `RCAV ####`. Pure reflex drill on the clear command.
2. **Follow Progression** — starts one-phase, ramps into requiring `CAV #### TYPE` placement as difficulty/rounds progress. Teaching ramp: learn `RCAV` first, `CAV` added later.
3. **Both** — two-phase throughout. Every CAV must be placed by the player before it can be cleared.

VF (§3) only appears in two-phase segments (Follow Progression once ramped, or Both throughout) — it has no meaning in a mode where the player never places anything.

---

## 6. Phase A — Trigger/Place (two-phase segments only)

- A nest signals a CAV is due (visual/audible cue — details TBD).
- Player has a grace window to type `CAV #### TYPE` correctly.
- **Ignored trigger (resolved):** if a CAV trigger isn't placed in time, it auto-opens by itself and starts counting down — matches the original draft behavior.

---

## 7. Phase B — Countdown, egg, hatch

- Once a CAV is placed (or pre-opened, in one-phase mode), the nest's countdown starts, compressed per the ratio in §3.
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
7. **VF's trigger cue** — "pops up and says 'Clear Fuel'" needs a concrete visual/audio spec once art direction starts.
8. **Wipe input mechanism** — click, drag/wipe gesture, or click-and-hold not yet specified.
9. **Mess magnitude and wave structure** — how much gunk per smoosh, how many CAVs/how long a wave runs, and how the between-wave cleanup window is presented.
10. **Mid-wave clean cost** — confirm whether lost typing time is the only cost, or there's also a scoring penalty.

---

## 12. Handoff note for Claude Code

Design-stage only — the build gate (Laws v2.0 Core Law 15) still applies: no gameplay code until §11 is resolved and Andrew explicitly authorizes the build. As a Standalone Cartridge, build fresh under `cartridges/Whack A CAV/`, not from `blank/`; do not reuse the Impact Zone/Resource shapes or Target/Challenge lifecycle from other cartridges. Name things in this cartridge's own vocabulary — nests, eggs, hatching, escape, the pool — not the retired Target/Impact terms.

# PROPOSED — Overview append: Pitstop Attack Model & Mini-Game Context Packet (§0.21)

**Status:** DRAFT — awaiting **Andrew's authorization** + **async ratification with Claude
Chat**. This is the clause the `Pitstop_Design_Note.md` requires to exist before Claude Code
implements any veer→collision→damage logic (note §0, §10). Until it is ratified, Phase 1+
stays **BLOCKED** and the gated stubs (`generateChallenge()`/`validateCommand()`) remain
un-wired.

**Lane note:** governance authorship is Claude Chat's lane with Andrew's sign-off (Core Law
13). This draft was produced by Claude Code at Andrew's direct instruction as a *starting
point for review* — it is a proposal, not ratified text, exactly like the sibling
`Pitstop_Movement_Clause_PROPOSAL.md` and `Aquanaut_Impact_Clause_PROPOSAL.md`.

**Target:** `Documents/Core Documents/2. Overview.txt` — append under **Impact Logic**
(the roster-mapping tables), and adopt as Pitstop's **Mini-Game Context Packet** per §0.21.

**Authority:** Laws permit *"append or clarify when instructed"* (never remove/rewrite). This
clause **binds Pitstop to primitives the Overview v2.0 already defines** — the Impact Zone
(§0.9), Resource (§0.22), Terminal Failure State (§0.19), and Context Packet (§0.21). It does
**not** rewrite any Law. It is the §0.21 documentation + Andrew authorization that Core Law 5
(the Impact-Zone / TFS authorization gate) requires before consequence logic may be built.

---

## Why this clause exists

Overview v2.0 already anticipates Pitstop in two places:
- The **roster** lists *"NEMS 500 (Pitstop) — time-trial pit/racing typing game."*
- The **Impact Zone roster table** already carries a row:
  *NEMS 500 | 4 tires (grouped, 3 hits each) | Cumulative | terminal — all 4 blown → game over.*

So the **destination** (tire damage → game over) is pre-blessed. What is **not** yet
authorized is the **attack model that reaches it** — how a Target/wall gets to that Zone, and
the live-typing machinery driving it. Per Law §0.9 and Core Law 5, that machinery
(movement, evaluation, escalation, consequence) must be documented in Pitstop's Context
Packet and authorized before Claude Code builds it. This clause supplies that.

It also **supersedes the framing** of `Pitstop_Movement_Clause_PROPOSAL.md` (2026-06-20),
which was written against the pre-v2.0 "descent vs route-traversal" model and the impulse
movement profile. The impulse profile was since replaced by a **WPM speed model** (build
v0.7.0), and the design note adds the **live-keystroke veer layer** on top. This clause
restates Pitstop's movement/challenge model under **current (v2.0) primitives**. Where the two
proposals overlap (route-traversal, multi-step legs, tire/pit/fuel), this one is authoritative.

---

## Proposed clause text (append to Overview — Impact Logic)

### Pitstop (NEMS 500) — Attack Model clarification

Pitstop inverts the usual Target→Zone approach: **the player's own unit is the moving object,
and the walls approach it as a function of live typing accuracy.** The four sub-sections below
declare its movement model, evaluation model, escalation ladder, and its §0.21 Impact-Zone /
Resource set. All behaviour is engine-governed and config-driven; the theme only skins it.

**A. Movement model — player-unit route traversal (config-driven).**
The engine additionally provides a **route-traversal** movement model: an abstract unit
advances along an ordered list of **position gates** (the course = base ids). There is no fall
and no lower-boundary. Two independent axes drive the unit:
- **Longitudinal (speed)** — driven by typing **WPM**. A correct command boosts speed; it
  holds, then decays. (Build v0.7.0 `SPEED` model — first-pass numbers, config-tunable.)
- **Lateral (position in lane)** — driven by **input accuracy right now** (§B). Clean input
  tracks the racing line; divergence pushes the unit toward a wall (§C).

This is theme-agnostic engine machinery — the same route-traversal the base Overview already
blesses as "one configuration, not the rule" (Gameplay Flow), here extended so the **player
unit**, not a Target, is the traversing object.

**B. Live evaluation model — per-keystroke prefix divergence.**
Pitstop evaluates input on **every keystroke**, not only on submit. "Wrong" = **divergence
from a valid prefix**: while the buffer could still become a valid command it is *on-line*
(e.g. `EN`→`ENP`); the instant a character is typed that no valid command begins with, the
buffer is **diverged** (e.g. `EZ`). **Enter is the commit** — the moment a diverged buffer is
locked in. This is a Cartridge-level evaluation *mode*; the Universal Formula (§ Dynamic
Dataset Logic) still governs what a *valid* command is, and the §0.8 Miss is still resolved at
commit. The pre-commit lateral veer is a new intermediate state that precedes Hit/Miss, not a
replacement for it. *(The project-wide "silently normalize Andrew's spelling" principle is
**chat-only**; in-game there is no auto-correct — typing accuracy is the game.)*

**C. Escalation ladder — mapped to the primitives.**
Error consequences escalate in three stages, mapping onto §0.9/§0.22 as:
1. **Minor / brief divergence → speed bleed only.** A tolerance **deadzone**: small or
   short-lived errors cost momentum but do **not** veer. No Zone is reached. (Config:
   error magnitude / duration before veer arms.)
2. **Sustained / larger divergence → veer.** Past the deadzone the unit drifts laterally
   toward the wall; drift magnitude = f(divergence depth × drift rate). Still no consequence
   *yet* — this is the approach, not the Impact.
3. **Enter-dirty OR no-entry timeout → the unit reaches the wall (Impact Zone).** Committing
   a diverged buffer, **or** sitting past the no-entry timeout, resolves the drift as a
   **collision** — the unit reaches the **Wall** Impact Zone and its consequence applies (§D).
   The timeout closes the "never press Enter" exploit; it is the *inverse* of a `saveWindow`
   (delay causes the crash rather than averting it).

**D. Impact Zones & Resources (Pitstop's §0.21 declaration).**

*Impact Zone — the Wall.* Pitstop's Impact Zone is the **wall the veering unit reaches**, worn
in two dressings but one state machine:
- **Turn wall** = the track edge (armed during turns).
- **Overtake wall** = a rival unit's flank (armed during an overtake).

| Impact Zone | consequenceType | saveWindow | terminal | consequence |
|---|---|---|---|---|
| Wall (track edge / rival flank) | **Critical** | none (the deadzone in §C.1–2 *is* the pre-Impact grace) | no (non-terminal per event) | one **tire hit** to the tire nearest the impact |

*Resources.*

| Resource | max | depleted by | onZero |
|---|---|---|---|
| **Tires** (4, grouped; 3 hits each) | 4 × 3 = 12 hits | Wall Impact events | **terminal** — all 4 tires blown → game over |
| **Stress** (inverted pool — see note) | config | *see §8 open decision* | **non-terminal** — modulates the attack model, never ends the game by itself |

> **Reconciliation with the v2.0 roster table.** The current Impact Zone table records the
> **tires** as the Impact Zone (Cumulative, grouped, terminal). This clause proposes the
> cleaner v2.0 mapping: the **Wall is the Impact Zone** (a *location the unit reaches*, per
> §0.9's literal definition), and the **tires are the grouped Resource** it depletes (per
> §0.22, which explicitly allows "grouped Cumulative Zones to share a Resource with a terminal
> threshold"). Net terminal behaviour is identical — *all 4 blown → game over* — so this is a
> classification refinement, not a rules change. **Andrew/Chat to confirm** which framing the
> canonical table should carry.

> **Stress as an inverted Resource.** §0.22 Resources as written *deplete toward zero*; Stress
> *accumulates toward a max* and **bleeds back down on clean straightaway typing**. It is a
> mechanical pressure pool: as it climbs it degrades performance (shrinks the deadzone, widens
> veer, and/or tightens the reaction window — exact levers config-driven). It is **never
> terminal on its own** — it makes the wall easier to hit, it does not end the race. This is a
> small generalization of §0.22 (accumulate-toward-max, non-terminal); flagged for Chat to
> confirm whether §0.22 should note the inverted-polarity case or whether Stress is better
> modelled as a distinct "modifier" primitive.

**E. Multi-step legs (AP → ENP → BSE).**
A Challenge may be an ordered **sequence** of position-gated sub-challenges — a **leg** —
rather than a single command clearing one Target. Pitstop's leg is the three-beat
**AP → ENP → BSE** post sequence, each beat gated by course position; `BSEH` is the
no-base-code arrival variant on the BSE beat (build v0.5.0). The Universal Formula still
governs **each beat**; this clause only allows beats to be **chained** into a leg, advanced by
per-beat validation. This is the same call-lifecycle question flagged **OPEN** in the
Overview's Dynamic Dataset Logic; Pitstop resolves it in-data via its three-beat template.

**F. Terminal Failure State (§0.19).**
Pitstop's TFS **emerges** from the tire Resource: **all 4 tires blown → game over**. It is not
written bespoke. The normal race end (crossing the finish line on the final lap → Results /
Podium) is a **non-failure** terminal state and is unrelated to the TFS.

**G. Optional consequence layer (strippable).** The tire / pit / fuel strategy layer is
Cartridge-level and **fully disabled by the No-Pit toggle**; it is not part of core scoring.
Westwood (72122) is the canonical pit; `LA` is the proposed pit on/off-ramp command (§8 open).

**Boundaries (unchanged, Laws §0.3).** Scoring, dataset/challenge generation, and difficulty
progression are untouched by this clause. All veer/collision/crash rendering, audio, camera,
and the stress/tire HUD live in the **cartridge theme layer**; the engine reports movement,
Impact, and death theme-agnostically.

---

## Core ↔ Cartridge interface (theme-agnostic, so it stays reusable)

```
MovementModel: 'descent' | 'route'                 // engine-level, config-selected
Route:  ordered [gateId...]                          // Pitstop: course = base ids
Leg:    ordered [beat...]  beat = { cmd, gate }      // Pitstop: [AP,ENP,BSE] × position gate
Input evaluation (route mode):
  onKeystroke(buffer)  -> 'on-line' | 'diverged'     // valid-prefix test
  lateral += f(divergenceDepth, driftRate)           // pre-commit veer
  onCommit(buffer, activeBeat) -> hit | miss          // Enter; §0.8 unchanged
Impact:  unit reaches Wall Zone -> onImpact()         // Critical: one tire hit
Resources: tires(grouped, terminal), stress(inverted, non-terminal)
Engine emits: onArriveGate, onBeatValidated, onLegComplete, onImpact(zone), onTFS
Death/end (Core -> Theme interface):
  { cause: 'tires' | 'finish', tiresLost: [...], place: n }
```

---

## Config levers (all data-driven, never hardcoded — from design note §9)

- Deadzone: error magnitude / duration before veer arms
- Drift rate: lateral movement per unit of divergence depth
- Backspace brake rate: speed cost per correction (backspace = steer-back **and** brake)
- No-entry timeout: ms before an unsent buffer resolves as a crash
- Stress climb rate, stress bleed rate (clean-typing recovery)
- Stress → performance mapping (deadzone shrink / veer widen / window tighten)
- Turn/straight ratio and per-segment difficulty (veer armed on turns/overtakes; straights = recovery)
- WPM → speed curve, boost/hold/decay, overflow payoff (build v0.7.0 `SPEED`)

---

## Open decisions that block full lock (design note §8 — Andrew's calls)

1. **Stress source** — committed errors only, or also near-misses / recovered veers?
2. **Straightaway safety** — are straights fully safe, or do errors there still bleed speed
   (without veer)? Determines whether veer is *always-on* or *armed on turns/overtakes only*.
3. **Impact-Zone framing** — adopt the Wall-as-Zone / tires-as-Resource refinement (§D), or
   keep the v2.0 table's tires-as-Zone wording?
4. **Stress primitive** — inverted §0.22 Resource, or a new "modifier" primitive?
5. **Exact config values** — every lever in §9 above (all first-pass / placeholder today).

---

## Reconciliation notes (housekeeping, not part of the clause text)

- **Naming.** Overview v2.0 already flattened the Main Menu (categories retired) and lists the
  cartridge as **"NEMS 500 (Pitstop)."** That **supersedes** the Head-to-Head-slot framing of
  `Pitstop_Name_Clause_PROPOSAL.md`, which is now largely **moot** — the slot it renamed no
  longer exists. Recommend marking that proposal *closed / overtaken by v2.0* and treating
  **"Pitstop"** as the player-facing title with **"NEMS 500"** as the in-fiction event name.
- **Tagline.** *"Type fast and risk the wall. Type clean and bleed the speed."* is a **locked
  title-screen must-have** (note §0). It is UI copy, not governance — captured here for
  traceability but **not** part of this clause; it can be wired into the title screen
  independently of ratification.
- **Rename sweep.** On ratification, pick a canonical `pitstop` cartridge id and sweep stale
  "NEMS 500" references (folder id, asset names, config keys) from the Phase 0 rough-in
  (design note §10). Keep the cartridge name "Pitstop" distinct from the in-game **pit
  mechanic** so specs/CSVs stay unambiguous.

---

## On ratification

Once Andrew authorizes and Chat ratifies (append this text to `2. Overview.txt`, append/clarify
only — no deletions), **Phase 1 unblocks** with the design note's stated core principle: the
**single-leg "prove it first" slice** — one leg (AP/ENP/BSE position-gated, WPM speed +
accuracy veer, live per-keystroke evaluation, backspace brake, one Wall Impact → one tire hit)
— **before** laps, opponents, stress tuning, or the pit layer. Claude Code implements only the
ratified `consequenceType`/`saveWindow`/terminality declared above (Core Law 5).

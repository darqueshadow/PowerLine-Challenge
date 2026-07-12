# PROPOSED — Overview append: Impact Logic (Aquanaut Cartridge)

Paste into `Documents/Core Documents/2. Overview` under **Impact Logic**. This is a
**clarification/append** (Laws permit "append or clarify when instructed"), not a
rewrite of Laws §0.9 — it binds the Aquanaut to Impact types the Overview already
defines (Zone Impact, Player Impact).

---

## Impact Logic — Aquanaut Cartridge clarification

The Aquanaut has no fall-to-lower-boundary Impact. It uses the existing Impact types,
re-bound to its theme:

- **Zone Impact → the 3 hoses (lifelines).** The diver's O2, Water, and Radio/Power
  hoses are 3 zones. A creature reaching a hose causes **Impact Hose** (breaks a
  random un-broken lifeline; that creature's Challenge+Unit boxes clear and it leaves).
  Losing 1–2 is survivable. **All 3 lost → game over (CRUSH death).**

- **Player Impact → the diver.** A creature reaching the diver causes **Impact Diver**:
  a prominent flashing alarm opens **displaying the exact required Command** and gives
  the player a **3-second survival window** to type it. Success repels the creature
  (no penalty); timeout → game over (CREATURE death). *(This 3-second
  type-to-survive window is the one new behavior beyond relabeling — authorized by
  Andrew 2026-06-19. It replaces the prior 5-block suit-integrity drain.)*

- **One attack state machine, two consequence branches** (hose break vs diver grab).

- **Death event (Core → Theme interface).** The engine reports the death
  theme-agnostically; the cartridge plays the matching kill-screen cinematic:
  ```
  { cause: 'creature' | 'crush',
    creature: 'greatwhite' | 'moray' | 'jellyfish',   // creature deaths only
    hoses_lost: ['o2' | 'water' | 'radio', ...] }
  ```

- **Edge rules.** If the 3rd hose break and a diver grab resolve on the same frame,
  `cause` is chosen **randomly**. The peripheral side-port glimpse (creature crossing
  a side window before striking) is canon for **all** creatures.

- **Boundaries.** Scoring, dataset/challenge generation, and difficulty progression
  are unchanged (Laws §0.3). All kill-screen rendering, audio, and overlays live in
  the cartridge theme layer; POWER and RADIO are two readouts of the one electrical
  line.

---

# §0.9 — Kill-Screen Cinematics & Target Architecture (Aquanaut Cartridge)

*Drafted 2026-06-21. Extends the Impact Logic clause above by specifying what the
"matching kill-screen cinematic" is for each death, and the per-level target
architecture that produces them.*

> **RATIFIED 2026-06-21 (Andrew).** The §0/§8.4 governance hold on kill-screen
> implementation is **lifted**. §0.9 is adopted as the Aquanaut's attack-model clause;
> conforming code may proceed. This append text is cleared to paste into the Overview
> Core Doc (`Documents/Core Documents/2. Overview`) for the canonical external record.

## A. Target architecture (per level)

Each level fields **four** targets in two roles:

- **3 main targets** — float in from the screen sides **already in attack mode**. They
  drive the Impact Logic above (Zone Impact → hose; Player Impact → diver) and, on a
  kill, play their side-approach kill cinematic. *Level 1: Great White, Moray, Box Jellyfish.*
- **1 TOC target** — **lingers at the bottom**, runs the gated-TOC sub-machine, and is
  **specific to each level**. Its death triggers off the **TOC resolution**, not a
  side-approach lunge. *Level 1: Puffer Fish.*

The roster is swapped wholesale as deeper levels are added; the Box Jellyfish is
expected to return ~Level 3 (TBD).

## B. Organizing principle — each kill attacks vision in a different category

The four deaths are deliberately distinct **modes of losing your sight**, so the set
reads as designed rather than four gore loops. No two share a vision-attack:

| Creature | Category | The attack on your vision |
|---|---|---|
| Great White | **ENGULFED** | the view is swallowed — you go *inside* the throat |
| Moray | **BREACHED** | it comes *inside the helmet* — one violent puncture |
| Box Jellyfish | **SHROUDED** | smothered from outside, multi-point, **whiteout** (not blackout) |
| Puffer Fish (TOC) | **POISONED** | sight survives but **corrupts** — helpless lucidity |

Shark and eel are intentional mirrors: **you enter it / it enters you.** Keep the contrast sharp.

## C. Per-creature beats

**Great White — ENGULFED.** Side-port glimpse → the lunge surges *past* the glass and
keeps pushing in; open jaws + dark throat fill the faceplate edge-to-edge. **One held
beat of total black throat** before the terminal word lands. Word: **CRUNCH**.

**Moray — BREACHED.** The opposite of the shark — a single violent **puncture** point,
then it gnashes **inside the helmet**. Blood swirls on the **player's side** of the
glass (reads "in here with you," not "out there"). The strike stays largely **within
the faceplate**. Word: **SNAP**.

**Box Jellyfish — SHROUDED.** Smothered from outside: tentacle/oral-arm creep over the
visor from **multiple points**, with sting flashes that **white out** the view. The
flashes **ramp in frequency** like a rising heartbeat into a final whiteout (escalation,
not a flat strobe). Word: **STUNG**.

**Puffer Fish — POISONED (TOC).** Comedic-horror, four beats:
1. **The chuckle.** Drifts in deflated, dopey, faintly ridiculous; bumps the faceplate —
   *nothing happens.* The player relaxes.
2. **The puff goes wrong.** It inflates past cute, spines ratcheting out ring by ring
   until it fills the faceplate — the balloon is now a sea-mine on the glass.
3. **The strike.** It rams; spines punch through at **a dozen points at once** (a radial
   constellation of punctures, glass crazing between), stopping an inch from the eyes — held.
4. **The kill (the differentiator).** **No blood flood, no blackout.** Toxin seeps
   through the holes and the view goes *wrong*: double vision, color draining to grey,
   faceplate edges creeping inward (tunnel-vision / paralysis onset), HUD text smearing.
   The puffer hangs there slowly deflating, smug, while you watch helplessly. Then the
   tunnel closes. Word: **FUGU** (owner's pick, 2026-06-21 — the fugu-sashimi in-joke;
   names the toxin, not the spines, so it doesn't undercut Beat 4 the way POP would).

## D. Death-event interface (extends the clause above)

Adds the TOC creature and its arrival path to the theme-agnostic death payload:

```
{ cause: 'creature' | 'crush',
  creature: 'greatwhite' | 'moray' | 'jellyfish' | 'pufferfish',
  via: 'side' | 'toc',          // pufferfish death arrives via the TOC sub-machine
  hoses_lost: ['o2' | 'water' | 'radio', ...] }
```

## E. Reconciliation with the provisional build (working tree, uncommitted)

Built ahead of ratification at the owner's direction; **flagged here, not yet conformed**
to this clause:

- **Shark** — devour/engulf built. *Add:* the held black-throat beat before the word.
- **Moray** — currently **gnaw within the mask**. *This clause reframes it to BREACHED*
  (single puncture + gnash *inside* the helmet + blood on the near side). **Resolved
  2026-06-21: MERGE** — a single violent puncture establishes the breach, then the
  existing gnaw plays *inside* the helmet with blood on the near side.
- **Jelly** — strangle built (single radial constriction + steady jolts). *Add:* multi-point
  creep + heartbeat-ramp flash frequency.
- **Puffer** — wired as `impale` (puncture + cracks). *This clause reframes the kill to
  POISONED* (vision corruption is the kill; the puncture is only delivery). Needs art:
  `pufferfish_front_closed/open`.
- **Terminal words** — config currently DEVOURED / SHREDDED / PARALYZED / IMPALED
  (provisional). Locked set (ratified 2026-06-21) is **CRUNCH / SNAP / STUNG / FUGU**
  (greatwhite / moray / jellyfish / pufferfish). Conform config to this set.

## F. Boundaries

Unchanged from the Impact Logic clause: scoring, dataset/challenge generation, and
difficulty progression are untouched (Laws §0.3); all kill-screen rendering, audio, and
overlays live in the cartridge theme layer.

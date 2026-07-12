# PLC Laws v2.0 Audit — Complete (Topics 1–8)

**Status:** Audit scope is complete. Everything below is **locked** unless marked otherwise. Still not yet canon — this is the compiled source material pending the actual Laws v2.0 / Overview v2.0 rewrite and Andrew's final authorization on the rewritten documents themselves. The audit's job was to establish *what* the new documents should say; the rewrite is the next step, not part of this document.

**Method note:** This audit was built topic-by-topic from Andrew's recollection, cross-checked against Claude's search of past conversations, rather than a blind AI-compiled draft. All eight topics are covered here, plus the §0.9/§0.19 restructuring that came out of Topic 3.

---

## Topic 1: Hub Identity & Naming — LOCKED

- **PET Terminal** is the Arcade hub's permanent visual/interaction identity: Commodore PET–style, monochrome, phosphor glow, "LOAD"/"INSERT CARTRIDGE"-style prompts. Exempt from Theme Injection Point restrictions — no cartridge theme can override it; cartridge theming rules don't apply to it. Belongs to the hub, not any individual cartridge.
- **Project name stays "PowerLine Challenge (PLC)."** Not renamed to "Arcade" — that term already names the internal hub within PLC's own governance; renaming would create a recursive collision.
- **Nerva Beacon relationship:** separate project, own governance (Doctor Who–themed operational platform for Niagara EMS LSA team). PLC's Arcade will eventually live as a section within Nerva Beacon's web version. Both projects share the term "Arcade" for that hub without either owning the other's concept of it.
- **External Staging Context clause:** anything depicting entry *into* the Arcade from outside PLC (corridor, posters, ambient music, walk-up sequence within Nerva Beacon) belongs to Nerva Beacon's governance, not PLC's. PLC's Laws/Overview must not describe or depend on that staging content existing. PLC must work fully standalone.
- **"Ironic reveal" framing** (design intent, not hard rule): Nerva Beacon's corridor to the Arcade is neon/arcade energy; walking in reveals a quiet, lone PET terminal.
- **PET Easter Egg** (Developer Note, not hard Law): optional green-phosphor line reading something like "POWERLINE COMMAND," referencing the pre-split original project name. Cosmetic only, not required for launch.
- **Placeholder Access Gate** (Build Procedure — interim, temporary, NOT canon): single login screen branded "Nerva Beacon — Under Construction" in front of `arcade.html` only. Client-side password, soft deterrent only. Explicitly removable once Nerva Beacon's real shell exists. Not connected to Developer Mode (Ctrl+Shift+B) — separate gate, separate purpose.

---

## Topic 2: Cartridge Roster & Main Menu — LOCKED

- **No fixed roadmap.** Andrew works non-linearly by design; governance should accommodate this rather than pretend otherwise.
- **Christmas Tree and Kobayashi Maru are the same cartridge concept**, not two. (Also stored in Claude's persistent memory.)
- **Christmas Tree easter egg is a locked must-include** for PLC. Reason not yet explained by Andrew — revisit when he's ready to share.
- **Old placeholder ideas kept on file, explicitly uncommitted:** Speed Drills (Space, Water, Land), Head-to-Head extras (Rally Race, Summer Games). Listed as a possibility pool, not roadmap.
- **Category system scrapped entirely.** Main Menu is a **flat list** of cartridges — no Speed Drills / Action Zone / Head-to-Head / Strategy buckets.
  - **"Action Zone" is retired as a defined term** (previously Laws/Overview vocabulary for a dynamic-games submenu) — drop from v2.0 glossary, no orphaned definition kept.
  - **Current real roster (flat):** Asteroid Command, The Aquanaut, NEMS 500 (Pitstop), Christmas Tree/Kobayashi Maru, unnamed airport/CAV concept — plus the uncommitted possibility list above.

---

## Topic 3: The Aquanaut Mechanics — LOCKED (one item open)

- **Core mechanic:** screen-wide sonar sweep reveals creatures/unit boxes/challenge boxes; depth tier controls fade speed (fog-of-war).
- **Creature roster:** Great White Shark (lunge), Moray Eel (ambush), Box Jellyfish (drift). Per-tier signatures: L1 Pufferfish (inflation telegraph), L2 Electric ray/eel (HUD scramble), L3 Octopus (ink cloud — deliberate blue-signal collision, intentional foreshadowing), L4 Anglerfish (bioluminescent lure replaces sonar sweep).
- **Combat / death model (fully designed):**
  - One shared attack state machine, two consequence branches.
  - **Hose attack:** instant break, no save window, random hose picked (O2/Water/Radio). 1st–2nd broken = keep playing; **3rd = crush kill screen.**
  - **Diver attack:** flashing alarm shows the exact required Command, 3-second save window to type it. Diver death is final — no accumulation, unlike hoses.
  - Kill screens are DOM/CSS overlays separate from the gameplay canvas, using "dolly-mask crossfade" (scale-toward-camera) motion grammar.
  - Kill screen terminal words: CRUNCH (shark), SNAP (eel), STUNG (jellyfish), POISONED (pufferfish).
  - Hose colors: Water = Blue, Radio = Yellow, O2 = lime Green (swappable).
- **TOC (Transfer of Care):** Box color (White → Pink → Blue) and chevrons are independent axes. Blue = hittable (TOC Completed). Premature TOC during White/Pink = critical error. Bed icon + "TOC Requested" chevron are deliberate false-go traps.
- **Color grammar:** Blue = hittable/hostile in Aquanaut specifically; L3 Octopus's blue ink is an intentional, designed collision with that signal.
- **Data package:** ten normalized CSVs in `dataset/Gameplay/`, validated. Includes `challenge_phrases.csv`, `toc_chevrons.csv`.
- **Audio:** two-layer — synthesized continuous ambient (Web Audio API) + discrete one-shot clips via ElevenLabs Sound Effects. WAV required (not MP3) to avoid loop seam artifacts.
- **Asset pipeline rule (Aquanaut-specific in origin, generalized project-wide under Topic 5):** creature art = photoreal raster PNG, transparent background (RGBA). SVG reserved strictly for HUD/UI/chrome/geometric elements. Animated creatures use discrete state renders, engine cross-fades between them. Gemini prompts must avoid SVG vocabulary entirely (mixing triggers contradictory cartoon-vector output).
- **Reframed under §0.9 (see below):** Aquanaut's hoses (3×) and diver (1×) are now formally **Zones** under the generalized Impact model, not a bespoke exception. Hoses = Cumulative consequence, no save window. Diver = Critical consequence, 3-second save window.

**Still OPEN:** Does Aquanaut's call-lifecycle command structure use the same Universal Formula as base-posting (`[Challenge PL] [Unit] [Verb] [Base Name]` / `[Command PL] [Unit] [Verb] [Base Number]`), or does it need a structurally different template? Unresolved — matters for dataset/template design.

---

## §0.9 / §0.19 Restructuring — LOCKED

Originating problem: Laws §0.9 ("Impact") was written narrowly for the fall-to-zone model and stated themes may never alter it — but Aquanaut, NEMS 500, and likely the airport concept and Christmas Tree/Kobayashi Maru don't use fall-to-zone at all. Rather than treat each as a one-off exception, §0.9 is generalized.

**§0.9 Impact (generalized):**
> A Cartridge defines one or more named **Zones** a Target can reach if not cleared, approached from any configured direction (falling, sideways, from below, etc.). Each Zone declares:
> - **Consequence type:** Cumulative (costs one shared resource, game continues) or Critical (single hit ends the game)
> - **Save window:** optional grace period with a countdown before the consequence applies; absent by default

**§0.19 Terminal Failure State (TFS) — new definition:**
> The condition under which a Cartridge's game ends in failure. Every Cartridge must define one. Under the generalized §0.9, TFS mostly *emerges* automatically from Zone configuration (a Cumulative resource hitting zero, or a Critical Zone triggering) rather than needing a separate bespoke writeup for most cartridges.

**New Core Law:**
> Claude must not implement any Terminal Failure State logic — combat, consequence, or game-over triggers — for any Cartridge until that Cartridge's Zones are documented in its Mini-Game Context Packet and authorized by Andrew.

**Roster mapping so far:**
- **Asteroid Command:** one Zone, falling, Cumulative, no save window (the original/simple case).
- **Aquanaut:** four Zones — 3 hoses (Cumulative, no save window, 3rd = crush) + diver (Critical, 3-second save window).
- **NEMS 500:** four tire-Zones (Cumulative, no save window, 4th = game over) — see Topic 4.
- **Christmas Tree/Kobayashi Maru, airport concept:** no Zones declared yet, too early.

This retires the informal "§0.9 attack-model clause" label — nothing was ever truly breaking §0.9, it just needed to be written generally enough to describe what it was already being asked to do.

---

## Topic 4: NEMS 500 / Pitstop Mechanics — MOSTLY LOCKED (one item open)

- **Genre/format:** Time-trial against the course/clock — **not** live player-vs-player. (Head-to-Head as a governance category no longer exists per Topic 2, so this doesn't contradict anything; it just states the format plainly.)
- **Core loop:** AP → ENP → BSE delivers acceleration bursts; typing speed/accuracy controls car speed. Side flyby window shows real Niagara Region scenery per leg (reward + stealth geography trainer).
- **Presentation:** camera behind the unit (ambulance shaped like a race car), C64 Pitstop / Atari Pole Position inspired. **No literal "arrive at base" destination** — flags/banners pass by to signal a base, rather than modeling actual arrival. Course is a generic representation of the region, not modeled real destinations.
- **Tire pit (Westwood):** Base 72122 is the real pit. Per route, the on-route base nearest Westwood is the pit junction — short spur off, `SWAP`, spur back, rejoin.
  - **Four tire-Zones** (corrected from an earlier draft of three — cars have four tires). Each tire takes **3 hits before blowing** (config value, tunable). Cumulative, no save window. **4th tire blown = game over** — NEMS 500's confirmed Terminal Failure State.
  - Miss damages one tire, rotating through all four (predictable damage pattern).
  - **Game clock runs at half speed while in the tire pit only** — recoverable deficit, not a hard cliff. Does **not** apply to Shift Change.
- **Wrong base code entered → "spin out" visual.** Distinct consequence from a generic miss.
  - **OPEN:** Does a bad base code cost a tire hit *and* trigger spin-out, or does spin-out *replace* the tire-hit consequence for that specific error type? Unresolved — circle back next session.
- **Shift Change mechanic** (full design already locked in a separate standalone note — `NEMS500_ShiftChange_DesignNote.md` — saved to the Pitstop folder):
  - One-leg-early radio-chatter warning before going live, so it never interrupts an in-progress BSE keystroke.
  - Player types **LA** instead of BSE on the flagged leg → opens a box: short list of units already in EOS, simulated wall-clock per unit (scaled speed, not real-time).
  - Real chain: RCAV → OD → SS → **BSEH (must precede CAV SS)** → CAV SS, with **NOTE** insertable any time after SS (genuinely unconstrained).
  - CAV-before-BSEH is a real, non-critical error: truck visually looks fixed once BSEH lands, but stale CAV is still attached — requires RCAV + redo. (One confirmed entry for the still-needed critical-vs-fixable error table.)
  - Car keeps driving throughout — overlay challenge, not a stop-the-world event. **No clock slowdown** during Shift Change (confirmed this session, contrasts with the tire pit).
  - **Miss consequence = tire damage**, shared pool with normal racing misses (resolves a previously open question).
  - **Frequency: automatic baseline (fixed ratio of bases-passed to Shift Changes), with a difficulty toggle to adjust frequency up/down.** Ensures a level playing field for time comparisons while keeping trigger *timing* unpredictable.
  - **STILL OPEN (from the standalone note, not yet resolved):** exact count granularity (per lap vs. per race), full critical-vs-fixable error table beyond the one CAV/BSEH entry, RCAV/OD/BSEH batchability across multiple units in the box.

---

## Topic 5: Shared Engine Capability Gaps — LOCKED

**Purpose:** Consolidate the technical requirements implied by Aquanaut and NEMS 500 into a single list of shared-engine work — capabilities that belong in `/core`, built once, rather than duplicated per cartridge.

### A. Generalized Zone/Impact system (from §0.9 rewrite)
- Engine needs a **Zone** primitive: `{id, consequenceType: Cumulative|Critical, saveWindow: null|seconds, sharedResourcePool?}`
- Cumulative Zones need a shared resource pool concept (Aquanaut's 3 hoses share one "hits before crush" counter split three ways; NEMS 500's 4 tires share a "4th blown = game over" threshold) — pool semantics need to support **both** "N independent trackers, Nth failure ends it" (tires) and "shared countdown across distinct sub-targets" (hoses) as the same underlying mechanism.
- Critical Zones need a save-window countdown UI pattern (Aquanaut diver: 3-second type-the-Command window) — this is reusable, not diver-specific.
- TFS should **emerge** from Zone state per §0.19, so the engine needs a generic "check all Zones, has any Critical fired or any Cumulative pool hit zero" evaluator rather than bespoke game-over logic per cartridge.

### B. Attack/consequence state machine (from Aquanaut)
- One shared state machine: idle → threat-telegraphed → resolved (save succeeded / consequence applied).
- Kill-screen presentation layer is explicitly **decoupled** from the gameplay canvas (DOM/CSS overlay, "dolly-mask crossfade"). This is a reusable UI component, not Aquanaut-only — worth building once.
- Random-target selection (Aquanaut picks a random hose) is a generic utility, not bespoke.

### C. Partially-ordered command chains + concurrency (from NEMS 500 Shift Change)
- Real chain: RCAV → OD → SS → BSEH (must precede CAV SS) → CAV SS, with NOTE insertable any time after SS. This needs a **partial-order validator**, not a strict sequence — some steps are order-locked relative to each other, others are free-floating.
- Needs to support **multiple units in flight concurrently** inside one Shift Change box (per the still-open "batchability" question) — engine should be built assuming concurrency is coming even before that question resolves, rather than needing a rewrite later.
- Needs a **critical vs. fixable error** distinction as a first-class concept: some wrong-order entries are silently-broken-but-recoverable (CAV-before-BSEH: looks fixed, isn't), others are hard failures. This is presentation-relevant (does the player get a visual "looks fine" state that's actually wrong?).

### D. Data-driven config, not hardcoded per cartridge
- Aquanaut already proves the pattern: ten normalized CSVs in `dataset/Gameplay/`. NEMS 500's tire config (3 hits, tunable), Shift Change frequency ratio, and the chain definitions above should follow the same pattern — config values live in data files, not code, so difficulty/tuning doesn't require a Claude Code round-trip.

### E. Asset pipeline — photoreal is the project-wide default
- **Photoreal raster PNG (transparent RGBA) is the default visual style for characters/creatures/units across PLC**, not an Aquanaut-specific workaround. Andrew confirmed this was never a fallback from a cartoon-style problem — photoreal was always the intended house style. SVG stays reserved for HUD/UI/chrome/geometric elements project-wide — same split, just confirmed as the general rule rather than a local fix.
- The Gemini-prompting caution (avoid SVG vocabulary in prompts, since mixing triggers contradictory cartoon-vector output) generalizes too — applies to NEMS 500's car/scenery art and any future cartridge, not just Aquanaut.
- This absorbs what would otherwise have been covered in Topic 8 (Asset pipeline rules) — that topic may end up short or redundant when reached.

---

## Topic 6: Multi-AI Team Roles & Handoff Protocol — LOCKED (one item open)

### Role boundaries

| AI | Role | Owns | Does NOT Do |
|---|---|---|---|
| **Claude Chat** | Senior Developer | Laws/Overview governance, design logic, mechanics brainstorming, spec/handoff documents | Write implementation-ready code intended for the repo, make file-placement decisions. **Soft rule, not hard:** may spin up quick throwaway prototypes/visualizations for illustration purposes (e.g., "here's what I mean") — anything destined for the actual game repo still routes through Claude Code. |
| **Claude Code** | Systems Integrator | File writes, implementation, testing, validation, CSV/asset verification, Build Procedure execution, SVG-to-PNG conversion, GitHub repo for PLC | Design decisions, creative direction, unauthorized deviation from handoff spec |
| **Gemini** | UX Director | Photoreal creature/unit art (RGBA PNG), SVG basemap and HUD authoring | Write engine code, modify `/core`, make governance decisions |
| **Copilot** | Logistics & Review | Excel-to-CSV pipeline, data sanity checks, independent pressure-testing of decisions | Write `/core` or engine logic, make governance decisions |
| **Claude Design** | *Pilot / Under Evaluation* | Layout/positioning iteration within Theme Injection Points, sketch-to-layout reference for HUD/UI fixes | Commit directly to repo; replace Gemini (photoreal art) or Copilot (data pipeline) roles; touch core engine, scoring, or dataset logic |
| **Andrew** | Project Owner | Final authority on everything | — |

### Handoff protocol (Chat → Code)
- Claude Chat produces spec/design documents; Claude Code implements. Handoffs are written **tool-agnostic** so they hold up under external review, not just as instructions to one specific AI instance.
- Claude Code must load the full governance stack — Laws → Overview → Build Procedure → relevant source files → the handoff spec itself — before implementation begins on anything.
- **Decision-gated handoffs:** Claude Chat confirms a design decision with Andrew first, *then* produces a targeted handoff prompt for Claude Code. Claude Code fixes only what's confirmed and reports back before touching anything ambiguous or adjacent.
- Per the Topic 5 rule already locked: no Terminal Failure State / combat / consequence logic gets implemented for any cartridge until its Zones are documented in that cartridge's Mini-Game Context Packet and Andrew has authorized it.
- **Claude Design workflow (pilot):** Claude Design attaches to the existing GitHub repo (directly, or via `/design-sync` from Claude Code) to iterate visually on layout/positioning within Theme Injection Points. Any resulting change is exported as a handoff bundle and merged into the repo **through Claude Code** — Claude Design does not commit directly. See new Core Law below.

### Multi-AI pressure testing
- Major architectural decisions get shared with Gemini and/or Copilot for independent evaluation *before* Claude Chat locks them with Andrew — this is already an established pattern (memory confirms it), just formalizing it as governance here.

### New Core Law — Claude Design Pilot Authorization
> Claude Design may be used on a **trial basis** to refine layout and positioning within existing Theme Injection Points (Target/Challenge appearance, Command UI styling, backgrounds, HUD/cosmetic elements) for any Cartridge already in development via Claude Code. This authorization is for **evaluation toward possible future deployment**, not a permanent role assignment. Claude Design must not be treated as a replacement for Gemini or Copilot in any capacity until Andrew confirms results and explicitly updates this Law. Any output from Claude Design must be routed through Claude Code as the point of merge into the repository — Claude Design does not commit directly.

**Still OPEN:** Whether Claude Design's success in the pilot changes Gemini's and/or Copilot's role scope at all (e.g., absorbing SVG/HUD/UI/chrome work from Gemini). Explicitly deferred until Andrew has run the pilot — not to be assumed or pre-decided.

---

## Topic 7: Hosting & Deployment — LOCKED

- **GitHub Pages**, vanilla HTML/CSS/JS, no build system — per existing Overview/Build Procedure, unchanged.
- **Public repo is acceptable** for PLC, including the Data Sheet (unit numbers, base names, base codes). Andrew has assessed this data as not sensitive, individually or as a full set, distinct from Nerva Beacon's actual policy/operational content — Nerva Beacon has its own separate governance and its own regional-privacy posture.
- **No approval gate required** between Claude Code pushing and GitHub Pages going live — matches Andrew's existing informal Netlify workflow on Nerva Beacon (Code pushes, Andrew checks after the fact).
- **GitHub's role, plainly stated for governance purposes:** version history / rollback safety net. Not a privacy boundary, not a review gate — just the "if something breaks, we can step back" mechanism.
- **Placeholder Access Gate** (from Topic 1, reconfirmed here): "Nerva Beacon — Under Construction" login in front of `arcade.html` remains a soft deterrent, not a privacy control — it doesn't change anything about the above, since it was never protecting data, just gatekeeping premature access before the real Nerva Beacon shell exists.
- **Revisit trigger:** if Andrew ever adds genuinely sensitive content to a PLC cartridge (real names, real incident data, anything beyond unit/base/command training data), this Law needs to be re-opened — the "not sensitive" determination applies to what's in the Data Sheet today, not as a blanket permanent ruling.

---

## Topic 8: Asset Pipeline Rules (mechanical conventions) — LOCKED

- **Style/tool rules are governed by Topic 5E** (photoreal PNG default, SVG reserved for HUD/UI/chrome, Gemini prompting discipline) — that's the system-level layer, already locked there.
- **Mechanical conventions — file naming, resolution/dimensions, folder structure, animation-state sequencing, audio file naming — are explicitly game-level, not system-level.** They get defined and refined per-cartridge as development requires, live in that cartridge's own documentation (Mini-Game Context Packet / Build Procedure notes), and are not elevated into Laws/Overview.
- **New Core Law (light-touch):** Claude must not impose a naming/structure convention from one cartridge onto another as if it were a system-wide rule, unless Andrew explicitly promotes it to Laws/Overview. Cross-cartridge consistency is a nice-to-have, not a requirement — precedent from one cartridge is a starting suggestion for the next, not a binding pattern.

---

## Audit Scope: Complete

Topics 1–8, plus the §0.9/§0.19 restructuring, represent the full scope of this audit as agreed with Andrew. Next step is the actual Laws v2.0 / Overview v2.0 rewrite drawing on everything locked above — a separate piece of work from this compilation.

## Open Items Carried Forward (not blocking, but unresolved)

1. Aquanaut: does call-lifecycle command structure match the Universal Formula, or need its own template?
2. NEMS 500: bad-base-code spin-out — additive to tire damage, or a replacement consequence?
3. NEMS 500: Shift Change count — per lap or per race?
4. NEMS 500: full critical-vs-fixable error table for the shift-flip chain (only CAV/BSEH ordering confirmed so far)
5. NEMS 500: RCAV/OD/BSEH batchability across multiple units in a Shift Change box

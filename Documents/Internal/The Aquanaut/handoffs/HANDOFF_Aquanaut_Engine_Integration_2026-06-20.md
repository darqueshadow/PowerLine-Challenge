# HANDOFF → Claude Code — Aquanaut: engine integration (playtest + finish)

**Continuation of** the data-layer + engine wiring. The data layer and a first engine pass are
**built and verified headlessly/in-browser**; the next session's job is to **playtest the live
round, fix what breaks, and finish the cleanup**. The fuller running record is
[`AQUANAUT_DESIGN.md`](AQUANAUT_DESIGN.md) (dated entries 2026-06-19 / 2026-06-20) — read its last
three sections first.

---

## 0. GOVERNANCE — READ FIRST

Authority order: **Laws > Overview > Build Procedure.** Load all three before building:
`C:\SharedOneDrive\(PCL)\Documents\Core Documents\` → `1. Laws.txt`, `2. Overview.txt`,
`3 .Build Procedure.txt` (v1.6 each). Load order: Laws → Overview → Build Procedure → current
Aquanaut source → the `Gameplay/` package.

**Combat is HALTED.** The Aquanaut replaces Laws §0.9 (fall-to-zone Impact) with an attack-based
combat model, but **the Overview clause that formalizes it does not exist** (confirmed by grep over
all Core Documents). So:
- The **kill screen is provisional / ungoverned** — do not extend it.
- **Do NOT build** attack/penalty resolution, hose/lifeline severance, kill-screen variants, or the
  **TOC premature-typing attack** (forced-active target + faster swim). Until the clause is drafted,
  premature TOC typing is just a **plain miss**.
- If an instruction pushes past this line, **flag it, don't build it.**

---

## 1. CURRENT STATE (done + verified)

**Model (confirmed with Andrew):** targets are **single-stage / one-and-done** — a spawn shows a unit
at ONE lifecycle stage; type the command → zapped. NOT a per-target walk. `unit_color` is the unit's
*current* status (so a unit in ARD status shows the TOC challenge). The DAG/weights drive the
**spawn-stage distribution**, not a walk.

**Data layer (`files/core/data.js`) — verified headless (both paths) + in-browser:**
- Loader pulls the **9** lifecycle files from `Gameplay/` + core/aux from `Game_mechanics/`+`Gameplay/`.
- `generateStageSpec()` = the single-stage builder (pick stage → freeze tokens → phrase + command +
  colors). `window.generateStageSpec` and `window.validateLifecyclePackage` exposed for the console.
- `validateLifecyclePackage()` runs at load; all checks green.

**Engine first pass (`files/script.js`, `core/config.js`, `style.css`) — logic verified, NOT yet
playtested live:**
- `getTargetSpecs()` (data.js) re-pointed to `generateStageSpec()` → the live spawn is package-sourced.
- TOC two-step via the existing `chainNext` mechanism (`TOC {u}` → `AVA {u},CC`).
- `advanceTocGates()` (script.js, per-frame in `maintainCreatures`) flips the gated box White→Pink/Blue
  on random timing; `creatureClearable()` blocks the command match until Blue (premature = miss).
- Voice render: `.voice-cad` / `.voice-radio` classes on the challenge overlay (style.css).

---

## 2. DATA LAYOUT & CONTRACT

`files/datasets/`:
- **`Gameplay/`** (the challenge package, 12 files): `call_lifecycle.csv`, `lifecycle_transitions.csv`,
  `challenge_phrases.csv`, `toc_chevrons.csv`, `status_colors.csv`, `ctas.csv`, `priority.csv`,
  `TOC.csv`, `toc_colors.csv`, `units.csv`, `inc_numbers.csv`, `hospitals.csv`.
- **`Game_mechanics/`**: `game_difficulty_progression.csv`, `powerline_prompts.csv`, `scoring.csv`,
  `scores.csv`.
- **flat root**: only the **retired** `challenges_commands.csv` (still LOADED as the validation /
  God-Mode reference — `DATA_ACTIONS` — pending purge; see §4).

**Tokens** (rolled once at spawn, frozen): `{units} {inc_numbers} {hospitals} {ctas} {priority}`.
- `{hospitals}`: **readable name** in the phrase, **code** in the command (`/23000` and `NHS-SCS`
  both valid inputs). `ARD` reuses the **frozen DPT** hospital.
- `{ctas}`/`{priority}`: **value** in the command, **colour** drives `challenge_color` — never printed.
- `inc_numbers` is **TEXT** (leading zeros 001–999).

**Voice** (`challenge_phrases.voice`): `cad` = CAD readout (NTF, TOC); `radio` = speech bubble
(ENR/ARR/PTC/DPT/ARD). ENR/ARR have 4 phrases → roll one per spawn, freeze.

**Lifecycle DAG:** `NTF→ENR→ARR→{DPT .95 | PTC .05}→…→ARD→TOC→AVA`. `unit_color` resolves via
`status_colors` (ARR == PTC, path-independence). **AVA never spawns standalone** — it's step 2 of TOC.

**TOC gate** (`toc_colors.hittable`): White FALSE / Pink FALSE / Blue TRUE. Box flips on **random**
timing (a config knob, NOT data). The 5 `toc_chevrons` are cosmetic only and don't gate. `,CC` is on
AVA: `AVA {u},CC` (restored in `call_lifecycle.csv` to match Andrew's spec — the prior prompt had
stripped it; **veto if hand-curating**).

---

## 3. KEY CODE (where things live now)

**`files/core/data.js`**
- `generateStageSpec(opts)` / `buildStageSpec` / `rollSpawnStage` / `rollFrozenPools` / `rollPhrase` /
  `resolvePhraseTokens` — the single-stage builder.
- `getTargetSpecs()` — the engine-facing spec (maps `generateStageSpec` → the legacy shape; TOC steps
  → `chainNext`). `SONAR_DEFAULT_COLOR` (sonar styling is CSS now, not per-row data).
- `parseLifecyclePackage(results)` — 9 files; `parseChallengePhrases` / `parseTocChevrons` /
  `parseTocColors` (now reads `hittable`). `validateLifecyclePackage()`.
- Embedded `loadFallbackData()` mirrors the package for `file://`.

**`files/script.js`**
- Spawn fields on the `state.creatures.push({...})` object: `voice`, `gated`, `gate`, `gateState`,
  `_gateTimer`.
- `advanceTocGates(dt)` — called at top of `maintainCreatures`.
- `creatureClearable(a)` — used in the `handleCommand` creature match (gate-blocks-clear).
- TOC two-step uses the **existing** `chainNext` handler (in the projectile-collision block).
- Voice classes toggled in `drawBubble`.

**`files/core/config.js`** — `TOC_GATE = { minMs, maxMs }` (gate timing knob).
**`files/style.css`** — `.voice-cad` / `.voice-radio` (first-pass visuals).

---

## 4. NEXT WORK

1. **Playtest + debug (the immediate task).** Run the dev server, play a round, fix runtime issues.
   Watch: phrases render on creatures; DPT command+alt clear; **TOC** box cycles White→Pink→Blue,
   premature `TOC` = miss, then `TOC {u}` + `AVA {u},CC` clears; cad/radio styling.
   (The harness can't cold-start past the menu, so this wasn't live-tested — expect shake-out.)
2. **Voice visuals** — `.voice-cad`/`.voice-radio` are placeholders; finalize the look with Andrew.
3. **Full `challenges_commands.csv` purge** — once spawns are solid: re-point command validation
   (`classifyInputError`'s `knownCommands`, ~script.js) and the God-Mode command menu
   (`buildGodModeMenu`, ~script.js) off `DATA_ACTIONS` to the lifecycle stage codes, then stop
   loading the flat file in `loadGameData`.
4. **Combat model — BLOCKED on the Overview attack-model clause** (§0): the attack/penalty, the TOC
   premature-attack, hose/lifeline severance, kill-screen reconciliation.
5. **Tuning knobs:** `TOC_GATE` (timing), the spawn-stage distribution (`rollSpawnStage` walks the
   weighted DAG and shows one stage; PTC ~5%).

---

## 5. HOW TO RUN / VERIFY

- **Play:** `Start Dev Server.bat` → opens `http://localhost:8000/files/index.html`. **CSV edits load
  only over http**; `file://` (double-click) uses the embedded fallback (kept in sync).
- **Inspect (console):** `validateLifecyclePackage()` → `{ok:true}`; `generateStageSpec()` or
  `generateStageSpec({stage:'TOC'})` → a single spec; `getTargetSpecs()` → the engine spec.
- **Headless test pattern** (what this session used): a Node `vm` sandbox loads `data.js`, feeds the
  CSVs (or calls `loadFallbackData()`), then exercises `generateStageSpec`. For live checks, a
  `python -m http.server` + the preview/DevTools console.

---

## 6. NOTES / CONVENTIONS

- Governance is **cartridge-level**: core engine stays theme-agnostic; the lifecycle/gate logic lives
  in the cartridge (`data.js` + `script.js`). No core-engine or theme-law changes.
- `AQUANAUT_DESIGN.md` is the running design log — **append a dated entry** for meaningful changes.
- Machine/env quirks (McAfee/junctions, `C:\SharedOneDrive` ↔ `C:\Users\darqu\OneDrive`, http-only CSV)
  are in the user's memory; the game lives at
  `C:\SharedOneDrive\(PCL)\Game\cartridges\The Aquanaut`.

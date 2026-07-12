# The Aquanaut — Below the Black — Design Notes

## v2 (2026-06-10) — `v2/` folder

A second build lives in `v2/` (entry: `v2/The Aquanaut v2.html`). v1 is untouched. What v2 adds:

- **Sprite facing fixed for good.** Facing is derived from the `_ht`/`_th` filename suffix
  (`_ht` = head on the left, `_th` = head on the right) and matched against the direction the
  creature is *actually* swimming each frame (leaky accumulator with hysteresis, so wobble
  doesn't cause flip-flapping). Heads always lead. Latched-creature and ambient-fish facing
  bugs also fixed.
- **Livelier animation.** Creatures pitch into their direction of travel, sharks surge with each
  tail beat, and moving targets shed a faint bubble wake.
- **Per-creature kill cams** (creature kills the diver): first-person view behind the brass
  porthole (`files/assets/Kill Screen/helmet.png`, glass hole punched at load).
  Great white = two circling passes then jaws snap shut over the camera; barracuda = four
  strafing strikes, a cold stare, then the lunge; box jellyfish = tentacles wrap the visor,
  glass shatters, tentacles smother the screen.
- **Abyss death** (all 3 hoses severed): third-person sink into the dark, then in-helmet POV —
  depth running away, hull groans, three crack stages with water spray, implosion, blackout.
- **Death-cause game over screens** (`DEATH_SCREENS` in script.js) — e.g. "TAKEN BY THE GREAT WHITE".
- **New synthesized SFX** in `core/audio.js`: `glassCrack`, `metalGroan`, `implosion`, `jawSnap`, `tentacle`.
- **Hose-severed effects upgraded**: O2 = bubbles + labored-breathing vignette, hot water =
  frost + shiver, comms = sparks + display static/dropout bands.
- **Bug fixed:** window resize no longer restores hose/suit HP (v1 re-ran `initHoses()` on resize).

**Where the "deeper = less reveal" tuning lives** (per-tier radar/reveal rules):
`files/script.js` → `SONAR.revealZones` + `SONAR.morphThreshold` (rule-of-#s text reveal and
sonar-blip→sprite morph per tier), `files/core/config.js` → `TIERS[].coneAngle` (headlamp cone)
and `CREATURE_TYPES[].minTier` / `spawnWeight` (which targets appear per depth).

**v2 second pass (same day):**
- **Unit number rides ON the creature** — canvas tag with soft spring physics: a dart leaves it
  trailing at the tail, then it floats back on top. The circular sonar probe still carries the ID
  pre-detection (radar-contact phase); it hands off once the sprite is revealed. The tag uses the
  same CSV color pair as that creature's challenge box (fill = box fill, border + number = box
  font color), so the unit tag and its target box read as a matched set.
- **Hospital token fix**: `resolveInlineTokens` now matches known pool names longest-first, so the
  embedded fallback data (used when the game is opened via `file://` — double-clicking the HTML)
  resolves `!Hospitals on a 3` correctly instead of leaving it on screen. Challenge shows the
  hospital name variant (e.g. GNG), the typed command takes `/4213` (alt: `NHS-GNG`).
  Note: CSV edits only load over http (`Start Dev Server.bat`); `file://` play uses embedded data.
- **C64 boot restored**: launching from the sonar-intro entry page now plays the typed
  system-check + cinematic descent (only the PRESS ENTER gate is skipped — the intro click
  already unlocked audio).
- **All sonar sweeps unified to #00FF41 green**: removed `mix-blend-mode: screen` on the in-game
  sweep (it shifted green→cyan over blue water), boosted title-sweep alphas, recolored the entry
  page intro from teal to sonar green.
- **Abyss death now triggers from latch kills too** — a jellyfish draining the last hose
  previously severed it silently; it now starts the fall like a direct strike.

Music is still disabled pending the new soundtrack (all `startMenuMusic`-type hooks return early).

**Constant-descent illusion (2026-06-17):** the aquanaut now reads as being *lowered the
whole dive*, not hovering — built out to the "core visual stack" of
`files/assets/Aquanaut_Depth_Descent_Spec.md` (the diver stays put; the world scrolls past and
the light dies). Decisions taken with Andrew: **metric** gauge reusing the existing per-tier
`depthMin/depthMax` bands. Tunables live in `DESCENT` / `ZONE_CARDS` in `core/config.js`;
rendering in `files/script.js`. No scoring/spawn-**logic**/core changes.
- **`getDepthRatio()` (§1)** — single normalized driver ∈ [0,1] off score/tier anchors
  (`bubblehopper 0 → rigwalker .30 → crushdepthoperator .60 → theaquanaut .90 → 1.0` at the
  `topCeilingScore`), smoothstep-eased within each band so descent is continuous, not stepped.
  Everything below scales off it.
- **Parallax water column (§3)** — `getDescentSpeed()` (faster as you sink, with a breath),
  far haze motes + fast **near streaks** + sparse **rising bubbles** (`seedDescentField` /
  `updateDescent` / `drawDescentField`), over the reworked **marine snow** mid layer that now
  streams upward and wraps (constant 60-particle population).
- **Procedural canyon walls (§4)** — `drawCanyonWalls` + `_rockEdge`/`_wallNoise` draw jagged
  rock in the screen-edge gutters with a *seamless* scroll (value noise, no tiling seam). The
  canyon **narrows with depth**, colour-fades pale rock → dark, grows kelp in the shallows and
  bioluminescent specks in the deep (`_drawWallAccents`), and **falls away into the void** at
  the abyss (`walls.outStart`).
- **Overhead god-rays (§6)** — `drawGodRays`, narrowing/dimming with depth, gone by the abyss.
- **Cold colour grade (§5)** — existing metric depth gradient + a `drawColdTint` wash that
  deepens with depth (drawn behind creatures so bioluminescent glows still pop).
- **Pressure vignette (§9)** — `drawVignette`, tightening and darkening with depth.
- **Depth gauge (§7)** — `state.descent.displayDepth` creeps deeper every frame (written to
  `#depth-value` in `updateDescent`, since `updateHUD()` only fires on scoring events), clamped
  to the rank's metric `depthMax` and floored by `getCurrentDepth()` so it jumps on rank-up;
  never decreases. Plus a subtle cosmetic tether bob/sway on the diver (`drawAquanaut`).
- **Threshold transitions (§10)** — `checkTier()`'s deepening branch fires `startZoneTransition`;
  `drawZoneTransition` (screen space) plays a thermocline shimmer wipe + a `ZONE_CARDS` entry
  card ("▼ ENTERING ▼ — THE RIG / TWILIGHT ZONE / THE ABYSS"), and the gauge **spins up** to the
  new zone depth (easeOutCubic) during the ~1.6 s beat. The abyss wall-out (§4) is the deep-
  Aquanaut payoff.
- **Pressure HUD + ambience (§9)** — `#pressure-meter` bar (`_updatePressureBar`) creeps green→red
  with depth; `_updateDescentAudio` drives a continuous depth-scaled **pressure bed** + intermittent
  **hull creaks** via new `AudioManager.startAmbient/setAmbientDepth/stopAmbient` + `hullCreak`
  voice (`core/audio.js`), wired to begin/resume/mute and stop on pause/game-over. ⚠️ The audio
  was built but **not auditioned** (headless) — tune `DESCENT.creak*` / `setAmbientDepth` gains if it's off.
- **Enemy depth-gating (§8)** — ~~implemented the spec's *cosmetic, data-only* framing: Box Jellyfish
  `minTier` 0 → **1** in `core/config.js`, so the surface (Bubble Hopper) is pure predators
  (Great White + Barracuda) and the drifting latcher fades in from Rig Walker down.~~ **Shelved
  while Tier 1 is finished.** Each tier will get its own target roster; the Tier 1 (Bubble Hopper)
  roster is **Great White, Moray, Jellyfish (+ Pufferfish for the TOC)**, so Box Jellyfish `minTier`
  is back to **0** for now. The Box Jellyfish is expected to return around **level 3** (TBD when we
  get there). Uses the engine's **existing** `minTier` gate in `getCreatureType()` — no spawn-logic
  change. The fuller "deep roster" reveal (wiring anglerfish / gulper eel / kraken-tentacle
  silhouettes as new depth-gated creature types — §12-Q4) is **content, not a descent cue, and left
  for an explicit go-ahead.**
All purely cosmetic/additive. Render order (far→near) sits in `render()`; verified end-to-end
(depthRatio curve, per-layer pixel probes, gauge spin-up trace, pressure-bar colour ramp,
audio graph build/teardown, clean multi-frame render).

## Creature rendering — multi-part composites (2026-06-19)

**Governance clause (ratified).** Creatures may render as **multi-part canvas
composites** with engine-driven pivots — extending the established "theme owns
creature appearance/motion" precedent (same as asteroid rotation/glow). Decided
**Option B** (canvas multi-part) over Option A (SVG/DOM over canvas) and Option C
(flat PNG, whole-body motion): B keeps creatures as canvas pixels, so the light
cone, depth-fog/visibility tiers, sonar-to-sprite morph, descent parallax z-order
and kill-cam compositing all keep working unchanged.

- **Boundary:** swim/pivot/glow **logic** lives in the theme layer (`files/script.js`);
  creature part/pivot **data** in `files/core/config.js` (`CREATURE_RIGS`). No
  creature-motion work may alter core spawn, scoring, collision, or the generic
  render-loop contract.
- **Asset interface contract** is the boundary object between engine and art:
  [`files/assets/Aquanaut_Creature_Asset_Contract.md`](files/assets/Aquanaut_Creature_Asset_Contract.md).
- **Fallback:** a creature with no loaded rig parts renders via the existing single
  sprite (Option C) — so the live game is unchanged until rig art lands. Dev flag
  `CONFIG.devRigPlaceholders` synthesizes placeholder parts to preview articulation.

**Phase 1 built (art-independent seams; final part-motion tuning waits on Gemini art):**
- `applyCreatureSwim()` — the always-on baseline composite motion the rig parts ride on
  (shared by the single-sprite and multi-part paths; single-sprite output unchanged).
- Multi-part rig loader (`CREATURE_RIGS` → chromakeyed part rasters, required-part
  gating via `rigReady()`) + `drawRiggedCreature()` / `animateRigPart()` (tailBeat,
  finTilt, jawSnap→`lungePhase`, bellPulse, tentacleTrail about normalized pivots).
- **Helmet interior shell** — constructed SVG/CSS vignette + HUD frame in
  `#canvas-wrapper`, **NOT** an AI image, distinct from the kill-cam helmet POV.
  Scope: **key moments only** (deep-zone entry, hose damage) via the `Helmet`
  controller; vignette + fog scale with `depthRatio`. Config in `HELMET`.

Verified: clean load (no console errors), single-sprite fallback intact (`rigReady`
false with no art), all five part-animations render without throwing, helmet
arm→depth-scaled fade→reset confirmed.

## Call-lifecycle data layer (2026-06-19)

Wired the cartridge's challenge/data layer to consume the normalized **call-lifecycle
CSV package** — a stage-graph progression model (a single "call" advances
`NTF→ENR→ARR→{DPT|PTC}→ARD→TOC→AVA`), replacing the implicit progression that the flat
`challenges_commands.csv` + single `chainNext` hack approximated.

**Scope — DATA LAYER ONLY.** This pass loads, validates, and exposes the model via a new
`generateCall()` in `files/core/data.js`. The engine-side consumption of the full N-step
call — movement, the **gated-TOC sub-machine**, radar-reveal — is a **separate handoff and
is intentionally NOT wired**. The live spawn path (`getTargetSpecs`) is unchanged; the
engine still advances one Target+Challenge at a time. `generateCall()` is the seam the
movement/combat handoff will consume.

**Governance.** The multi-stage call progression is **cartridge-layer logic** (it lives in
`data.js` + the future `script.js` consumer), not core engine and not theme — core stays
theme-agnostic, the state machine lives in the cartridge. The Laws/Overview/Build Procedure
describe only single-shot `generateChallenge()`; Andrew **authorized this as cartridge-layer
logic on 2026-06-19** ("treat as authorized") rather than amending the core docs first.

**The package (`files/datasets/`):**
- `call_lifecycle.csv` — stage nodes (`stage_id, stage_name, command_template, unit_color,
  challenge_color, variable, stage_type`).
- `lifecycle_transitions.csv` — **created this pass.** Weighted edges. Rule (Andrew): a blank/
  single-successor weight = `1`; only the `ARR` branch carries a split — `DPT 0.95 / PTC 0.05`
  (provisional, may be retuned).
- `status_colors.csv` — `unit_color` (the unit's prior status) → colour.
- `ctas.csv` / `priority.csv` — dual-use `{ctas}` (typed in command **and** colours the
  challenge) vs colour-only `{priority}` (never typed).
- `TOC.csv` / `toc_colors.csv` — gated TOC sub-machine palette + edges (loaded; the gated
  path itself is the separate handoff). **Aligned this pass:** state `Red`→`Pink` (the hex
  `#F1B0B7` was always pink), and the `Blak`→`Black` typo fixed.

**Token contract** (curly `{token}`, distinct from the legacy `!Token` flat table). Pools are
rolled **once at spawn and frozen** for the call's whole life: `{units}`, `{inc_numbers}`
(leading zeros kept), `{hospitals}` (Command1 primary / Command2 alt), `{ctas}`, `{priority}`.

**Also fixed — pre-existing loader drift that was silently disabling the *whole* CSV pipeline:**
`loadGameData()`'s core list fetched `progression.csv`, which doesn't exist (the file is
`game_difficulty_progression.csv`). One 404 rejected the core `Promise.all` → it bailed to
`loadFallbackData()` **before any CSV was parsed**, so even over **http the game ran on embedded
data and CSV edits never took effect**. Pointed it at the real filename — the tiers are byte-for-byte
identical to the embedded fallback, so **no difficulty change**, but the real challenges/units/
scoring/aux/lifecycle CSVs now actually load. The aux loader's stale `Incident #s.csv` →
`inc_numbers.csv` fix (above) only took effect once this 404 was cleared. *Note:* `bases.csv`
legitimately does **not** exist for Aquanaut — bases/locations are an **Asteroid Command** concept
the fork inherited as dead code (the `DATA_LOCATIONS_FULL` / `BASE_LOOKUP` pipeline + 27 vestigial
Niagara locations in the embedded fallback). No Aquanaut challenge uses location tokens, so the
empty pool over http is **correct, not a gap**. (The Holodeck "UPDATE DATASETS" reloader still
*requires* `bases.csv` and the wrong `progression.csv` filename, so it's separately broken — the
fix there is to **drop** the bases requirement, not add the file. Left for a follow-up.)

**`file://` fallback:** the embedded `loadFallbackData()` now also seeds the lifecycle package
(mirroring the CSVs exactly), so `generateCall()` / `validateLifecyclePackage()` work on a plain
double-click too, where `fetch` is blocked. (http via the dev server uses the real CSVs.)

**Validation** (the handoff checklist) is built into `data.js` as `validateLifecyclePackage()`,
runs at load (console), and is exposed alongside `window.generateCall`. Verified two ways:
- **Headless** (vm sandbox, 5,000 calls **per path**, http + file://): validation green on both;
  graph walks NTF→AVA every time; branch split 94.7%/5.3%; frozen pools constant; colours resolve
  (priority×4, ctas×2, TOC=gated, AVA=null); DPT emits the `,,,,{ctas},{ctas}` shape with
  Command1/Command2 primary+alt; the embedded fallback mirrors the CSVs with **zero drift**.
- **Live browser** (python http server + headless preview): after the loader fix the http path
  loads the real CSVs (no fallback warning; `DATA_LOCATIONS_FULL` empty — `bases.csv` absent —
  proving the real path, not the 27-entry embedded fallback); `[LIFECYCLE] validated OK — 8 stages`;
  `generateCall()` returns correct calls with real `hospitals.csv` data; clean init, no console errors.

## Holodeck dataset reloader rebuilt for the Aquanaut (2026-06-19)

The Holodeck God-Mode "UPDATE DATASETS" reloader was an **Asteroid Command port**: it fetched a
fixed 5-file shape `[bases, challenges_commands, units, progression, scoring]`, required `bases.csv`,
parsed `Challenge Base`/`Command Base` columns that don't exist in Aquanaut, used the wrong
`progression.csv` name, and **touched none** of the Aquanaut's real data (no inc_numbers/hospitals/
powerline, no lifecycle package). So it was doubly broken and couldn't refresh most of the game.

**Rebuilt (`data.js`):** `reloadAllCSVs()` now just **re-runs `loadGameData()`** — the live loader
already re-fetches every current dataset (`cache: 'no-store'`) and rebuilds it, including the
lifecycle package, with no hardcoded file list. Deleted the dead Asteroid internals `pickCSVFiles()`
+ `applyCSVData()` (the `bases.csv` / `Challenge Base` / `Command Base` cruft). Live reload is
http-only (the dev server); `file://` uses embedded data.

**Stripped orphaned bases cruft:** removed `godMode.activeBases` (config.js + the `buildGodModeMenu`
init that seeded it from locations) and the `baseLocs`/`activeBases` filter in `getTargetSpecs` —
there was no UI for it and it was never consumed in spawning. (Inert `DATA_LOCATIONS_FULL` /
write-only `BASE_LOOKUP` / the live loader's optional `bases.csv` fetch are left as a later sweep —
harmless, and `BASE_LOOKUP` is never read.) Also dropped the reloader's `showStatus()` toast, which
throws from the menu context (it targets the in-game HUD) — the `#dataset-status` panel line is the
correct feedback there; this latent bug only surfaced once the reloader actually completed.

Verified live (headless preview, http): "UPDATE DATASETS" → `✓ RELOADED: 54 units, 32 commands,
4 ranks, 8 lifecycle stages`, no error; data + lifecycle rebuilt; God Mode menu rebuilds;
`generateCall()` still correct; `'activeBases' in godMode` is now false.

## Kill-screen impact model (2026-06-19)

**Governance — resolved by reframing, not a core rewrite.** The Aquanaut has no
fall-to-zone Impact (Laws §0.9). Rather than amend §0.9, Andrew **bound the Aquanaut
to the Impact types the Overview already defines** (cartridge-layer authorized
2026-06-19, same precedent as the call-lifecycle layer):
- **Hoses = Zone Impact** — 3 lifelines (O2/gas, Water/liquid, Radio-Power/electrical)
  are 3 zones. **All 3 lost → `crush`** death.
- **Diver = Player Impact** — a creature reaching the diver opens a **3-second,
  type-the-shown-Command survival window**; fail → **`creature`** death.
- The only genuine *new* behavior (beyond relabeling) is that survival window; Andrew
  explicitly authorized it. POWER and RADIO are two readouts of the one electrical line.
- Proposed Overview append text for the canonical record:
  [`Aquanaut_Impact_Clause_PROPOSAL.md`](Aquanaut_Impact_Clause_PROPOSAL.md).

**Kill screens — one plate, two cinematics.** Both run on the constructed full-bleed
helmet-POV plate `files/assets/Kill Screen/kill_screen_POV.png` (2752×1536; Gemini
watermark inpainted out this pass) and end at the standard Game Over screen.
- **CRUSH** (3 hoses): faceplate stays black, panels strobe red, DEPTH runs away,
  pressure groan, full-crush spiderweb, word **CRUSHED**. *(No creature art needed.)*
- **CREATURE** (diver killed): the attacker fills the faceplate `front_closed → open`,
  glass cracks/slime, word **CRUNCH/SNAP/STUNG**. *(Needs the true-alpha `*_front_*`
  frames — see blocker.)*
- Region config over the swappable plate: `KILL_SCREEN.regions` (FACEPLATE_MASK,
  SIDE_PORT_MASK_L/R, PANEL_SCREEN_RECTS) in `core/config.js`. Side-port glimpse is
  canon for all creatures; crush-vs-creature simultaneity resolves **randomly**.

**Built this pass (foundation, non-breaking):** `KILL_SCREEN` config (regions,
panel mapping, terminal words, `diverWindowMs: 3000`); the **death-event payload**
`{cause, creature, hoses_lost}` via `buildDeathEvent()`, recorded at `triggerAbyssDeath`
(`crush`) and `triggerKillCam` (`creature`) — the Core→Theme interface. No cinematic
code changed yet; the existing abyss/creature cams still run.

**⚠️ Asset blocker (re-flagged):** the creature `*_front_closed/open` frames are
**still opaque-background** (not the true-alpha re-export agreed in the asset pass) —
`files/assets/Tier 1 v2 Images/`. The CREATURE cinematic's reveal is blocked until
they're re-exported with real alpha. CRUSH is unblocked. Also still TO-DO art:
cracks-overlay + jelly slime/smear (or build procedurally).

**CRUSH kill screen — BUILT (2026-06-19).** The all-3-hoses death (`triggerAbyssDeath`)
now plays on the new plate: reusable helpers `getFaceplateRect` / `drawKillScreenPlate`
/ `drawKillScreenPanels` / `drawTerminalWord` (+ `_ksRoundRect`, `killScreenCoverFit`)
composite the plate, then void + spiderweb cracks (full burst at implosion) clipped to
the faceplate, live red-strobing panels (DEPTH running away; all hoses FAIL/SEV), and
the **CRUSHED** card. Kept the third-person push-in + timeline + teardown; swapped only
the in-helmet render (circular `helmet.png` porthole → plate faceplate). Verified by
offscreen pixel-sampling (plate 58% non-black; 2003 crack px in faceplate; red panel +
CRUSHED-word px present; no throw, no console errors). *(Preview is headless/0×0, so an
on-overlay screenshot isn't meaningful — functional sampling is the proof.)* The helpers
are reusable by the creature cinematic.

**Diver-attack alarm — BUILT (2026-06-19).** The suit-latch is now a single 3-second
survival window (`KILL_SCREEN.diverWindowMs`), not the cumulative 5-block drain: a grab
refills the suit, shows the **exact command** in a flashing center alarm
(`#grapple-command`), and the suit bar/blocks deplete as a live countdown; typing the
command survives (refills), timeout → `triggerKillCam` (creature death). New placeholder
SFX `diverAlarm` (frantic rising klaxon) in `core/audio.js` + on the SFX bench
(`sfx-test.html`, DEATH/KILL-CAM). Verified: alarm shows the command, countdown drives
the suit down (hp 3 at half-window, 1 near end), cleans up on survive; no console errors.
*(Not yet watched in a live game to death — preview is headless.)*

**CREATURE kill screen — BUILT (2026-06-20).** The kill-screen system is now complete —
both deaths run on the plate. The bespoke per-creature cams (circling shark / strafing
barracuda / tentacle wrap) are replaced by **one generic cinematic** driven by the death
payload: `front_closed` lurks/approaches (+ a side-port glimpse, canon for all) →
`front_open` surges to fill the faceplate on the strike → bite cracks (shark/moray) or
`drawSlimeSmear` (jelly) → terminal word (CRUNCH/SNAP/STUNG). New helpers
`drawKillScreenCreature` / `drawKillScreenGlimpse` / `drawSlimeSmear`; frames loaded from
`KILL_SCREEN.creatures` (true-alpha, copied into `assets/Kill Screen/` with canonical
names — the `-1` etc. normalized at copy). `triggerKillCam`/`updateKillCam`/`drawKillCam`
rebuilt; ends via `gameOver(s.goKey)` (added a `moray` DEATH_SCREEN). Verified by offscreen
sampling: lurk 19% → strike 73% fill; CRUNCH/SNAP/STUNG render; jelly slime 63%; no errors.
*(Not yet watched in a live game to death — preview is headless.)*

**Cleanup pending:** the old `helmet.png`-era cam helpers (`drawKCShark` / `drawKCBarracuda`
/ `drawKCJelly` / `drawJaws` / `drawJellyScreenCover` / `killCamSpriteFor` / `drawKCSprite`
/ `jawCloseAmount`) are now **dead code** (no callers) — safe to delete in a follow-up sweep.

**Tier-1 swim-sprite migration — BUILT (2026-06-20).** Wired the new single swim sprites
(`target_greatwhite_profile_ht` / `target_moray_profile_ht` / `target_boxjellyfish_drift`)
into `CREATURE_SPRITES`; **barracuda → moray** across `CREATURE_TYPES` + `CREATURE_RIGS`
(name, spriteType, `killCamId: 'moray'`, `swimAnim: 'moray'` = a sinuous eel weave added to
`applyCreatureSwim`). Sprite sizes aspect-corrected (sharks/moray 210×141 from 2528×1696;
jelly portrait 150×201 from 1792×2400) — **first-pass sizes, may need in-game tuning.**
Retired the old 3-variant sets + the entire barracuda set (9 files deleted). Verified:
barracuda gone from the roster, moray renders its profile, all sprites chromakey-load,
clean reload (no 404s/errors). Moray now spawns in barracuda's slot, so it's a real enemy
whose kill screen (built earlier) finally matches the creature you fought.

**Dead-code sweep — DONE (2026-06-20).** Removed the orphaned old kill-cam helpers
(~345 lines): `drawKCShark` / `drawKCBarracuda` / `drawKCJelly` / `drawJellyScreenCover`
/ `drawJaws` / `drawKCSprite` / `killCamSpriteFor` / `jawCloseAmount` + the unused
`KILLCAM_IRIS` const (kept `KILLCAM_FADEOUT`); refreshed the stale "v2 bespoke attacks"
header. Verified: no dangling refs, syntax clean, kill screen still renders (moray strike
89% fill), no console errors. **Kept intentionally:** the procedural vector-creature
renderers (`drawGreatWhite` / `drawJellyfish` / `drawSeaSpider` / `drawGulperEel` /
`drawKrakenTentacle` / `drawAnglerfish` / `drawBarracuda` / `drawBoxJellyfish`) — still
wired via the `bodyStyle` switch in `drawCreatureBody` and a ready-made library for the
future deep-roster creatures (anglerfish / gulper eel / kraken). Purge on request.

**Flipbook animation engine — BUILT (2026-06-20).** Targets can now animate by cycling
several pose frames (ping-pong `1→2→3→2→1`) on top of the procedural sway. Generic
cycler `spriteFrameIndex()` (theme-agnostic — timing is data via `CREATURE_TYPES.animFps`,
per-creature phase off `animPhase` so schools don't sync); `drawGreenscreenCreature`
cycles the `CREATURE_SPRITES` pool instead of random-pick-once. **Centroid auto-align**:
`loadCreatureSprite` computes each frame's opaque bbox (`SPRITE_BBOX`) and the draw
centres multi-frame creatures on their body so AI-pose frames don't jump (absorbs
position/scale drift, not surface drift). Single-frame creatures are unchanged — **no
art needed to ship this; it activates per creature when frames are added**. Per Chat's
guidance: flipbook for the **moray** (`animFps 5`) + **great white** (`animFps 3`);
**jelly stays procedural** (bell pulse, untouched). Naming + img2img generation caveat
documented in the [Asset Pack §7](files/assets/Aquanaut_Tier1_AssetPack.md). Laws: the
cycler is generic/promotable, lives in the cartridge; Empty Cartridge untouched. Verified:
ping-pong shape correct, single-frame holds, bbox computed for all 3 sprites, simulated
3-frame moray cycles `[0,1,2]` + aligns + draws, no console errors.

**Next increments:** drop in the moray/great-white pose frames (art) to light up the
flipbook; kill-screen audio polish (placeholder `diverAlarm` + inside-suit ambience).
The engine work is otherwise complete.

**Asset note (2026-06-20):** the re-exported creature set is true-alpha and good to go
(the earlier "jelly opaque corner" was a false alarm — it's the tentacle reaching the
corner, not a remnant). The `front_*` frames the kill screen uses are copied into
`assets/Kill Screen/`; the swim profiles still await the full migration above.

## Dataset folder reorg + loader re-point (2026-06-20)

Andrew reorganized `files/datasets/` into subfolders: **`Gameplay/`** holds the challenge package
(`call_lifecycle`, `lifecycle_transitions`, `status_colors`, `ctas`, `priority`, `TOC`, `toc_colors`,
`units`, `inc_numbers`, `hospitals`); **`Game_mechanics/`** holds the engine data
(`game_difficulty_progression`, `powerline_prompts`, `scoring`, `scores`). The flat
`challenges_commands.csv` is **retired** and left at the root. (The move silently re-broke the loader —
it was still fetching flat `datasets/units.csv` etc. → 404 → embedded fallback.)

**`loadGameData()` re-pointed** to the new paths (`Gameplay/…`, `Game_mechanics/…`). `bases.csv`
dropped entirely (Asteroid-only; `basesText` is now hardcoded null). The Holodeck reloader inherits
the new paths for free (it just calls `loadGameData()`).

**`challenges_commands.csv` stays loaded from the flat root as the live spawn bridge** — it still
feeds `DATA_ACTIONS → getTargetSpecs()`, so the live game is byte-for-byte unchanged. The normalized
`Gameplay/` package is loaded, validated, and drivable via `generateCall()`, but the **spawn
cutover** (re-pointing `getTargetSpecs()` to the package and deleting the flat file) is deliberately
**deferred to the movement/combat handoff**: doing it cleanly forces gameplay-design calls (per-stage
spawn distribution, single-stage vs. progressing calls, the gated-TOC standalone colour, terminal-AVA
handling, the sonar→CSS styling move) that belong with the engine progression work — there the flat
file dies as a *progression* model, not an awkward single-stage interim. **Ratified display
convention** for the variable stages (for when the cutover lands): NTF → `"Notified {inc_numbers}"`,
DPT → `"Depart {hospitals} on a {ctas}"`, others → `stage_name`.

Verified live (http): the whole package loads from the new folders — units 54, ranks 4, inc 999,
hospitals SCS/WCGH/GNGH/WLMH, powerline 9, lifecycle validated, locations 0 (bases gone), bridge
`DATA_ACTIONS` 32 — no fallback warning, clean init.

## Single-stage data layer + voice/TOC-gate wiring (2026-06-20)

Per the authoritative handoff (`HANDOFF_ClaudeCode_Aquanaut_Wiring.md`), wired the cartridge to the
finalized 12-file `Gameplay/` package and corrected a core misread.

**Governance (handoff §0/§9).** Confirmed `Laws v1.6` + `Overview v1.6` + `Build Procedure v1.6` are
loaded; a grep of all Core Documents finds **no attack-model clause** (Overview's Impact Logic is
still the fall-to-zone §0.9 model). So the kill screen is **ungoverned/provisional** and **all
combat-model work is halted** (attack/penalty, kill-screen variants, hose/lifeline severance) until
that Overview clause is drafted.

**Corrected model.** Targets are **single-stage / one-and-done**, not a per-target progression. A
spawn shows a unit at one lifecycle stage; type the command → zapped. `unit_color` is the unit's
*current* status, so a unit in **ARD** status shows the **TOC** challenge (`TOC.unit_color = ARD`).
The DAG/weights drive the *spawn-stage distribution*, not a walk.

**Data layer built (`data.js`, foundation only — engine untouched this pass):**
- Loader now fetches all **9** lifecycle files from `Gameplay/` (added `challenge_phrases.csv` +
  `toc_chevrons.csv`); embedded `file://` fallback mirrors them.
- `challenge_phrases.csv` is the **display/voice layer** — replaces the convention I'd improvised.
  Roll one phrase per spawn and freeze (ENR/ARR have 4). `voice`: `cad` (CAD readout: NTF, TOC) vs
  `radio` (speech bubble: ENR/ARR/PTC/DPT/ARD). In a **phrase** `{hospitals}` = readable **name**;
  in a **command** it's the **code**. CTAS/priority are colour-only (no "on a N" in the prompt).
- Replaced the old full-call walker `generateCall()` with **`generateStageSpec()`** (single rolled
  stage → frozen tokens → phrase + command + colours). `window.generateStageSpec` exposed.
- **TOC = blue-gated two-step finale:** `buildStageSpec` emits `steps = [TOC {u}, AVA {u},CC]` and a
  `gate` blob (`colors`, `hittable` White/Pink F / Blue T, `transitions`, 5 `chevrons`, `initial:White`).
  Restored the **`,CC`** on AVA in `call_lifecycle.csv` (the premature prompt had stripped it; your
  clarification put it back) — flagged with Andrew.
- Validation extended: every spawnable stage has a phrase; phrases only carry `{inc_numbers}`/
  `{hospitals}`; chevron keys distinct from stage_ids; `Blue` is hittable. `inc_numbers` stays text.

**Verified** headlessly (CSV + embedded paths, 6000 spawns) and live in-browser: validation clean,
no console errors; AVA never spawns standalone; PTC ~0.65%; NTF `[cad] "New Call 088"`, DPT
`[radio] "Departing SCS" → DPT … /23000,,,,5,5` (alt `NHS-SCS`), TOC two-step `TOC {u}` / `AVA {u},CC`.

**Deferred (next, Andrew chose Option 1 — non-combat):** the **engine integration** — re-point the
live spawn off `challenges_commands.csv` to `generateStageSpec`, render the cad/radio voice
(CAD readout vs speech bubble), and drive the TOC gate timer (random White→Pink→Blue) + two-step
input, with **premature typing = a plain miss** (the forced-active/faster-swim attack stays behind
the Overview clause). `challenges_commands.csv` remains the live spawn bridge until that lands.

## Engine integration — single-stage spawn cutover + TOC gate (2026-06-20)

Wired the live engine to the package (handoff §8.2, Option 1 — **non-combat**). Still halted per
§0/§8.4: the attack/penalty model, kill-screen reconciliation, hose/lifeline severance.

- **Spawn cutover.** `getTargetSpecs()` (`data.js`) now sources from `generateStageSpec()` instead of
  the flat `DATA_ACTIONS`, mapping to the engine's existing spec shape (+ new `voice`/`gated`/`gate`).
  `challenges_commands.csv` is **retired as the spawn source**; it stays loaded only as the
  validation / God-Mode reference (`DATA_ACTIONS`) pending a later purge. Sonar box styling is now a
  CSS default (`SONAR_DEFAULT_COLOR`), not per-row data.
- **TOC two-step** reuses the engine's existing `chainNext` mechanism: clearing `TOC {u}` transitions
  the target to step 2 `AVA {u},CC`, then it clears. (Verified: `TOC 2042` → `AVA 2042,CC`.)
- **TOC blue-gate** (`advanceTocGates` in `script.js`, per-frame): a gated target's box flips
  White→Pink/Blue on random timing (`TOC_GATE.minMs/maxMs` in `config.js` — a config knob, not data),
  updating `colorChallenge`. `creatureClearable()` skips a gated target in the command match until
  its state is hittable (Blue) — so **premature typing simply misses** (the forced-active/faster-swim
  attack is the halted combat part). Verified: White → not clearable; advances to Blue → clearable.
- **Voice render** (`style.css`): challenge overlay gets `.voice-cad` (CAD readout — a leading `▎CAD`
  tick) or `.voice-radio` (crew speech bubble — a tail), toggled from `creature.voice`.

**Verified** in-browser: package loads clean (no console errors); `getTargetSpecs()` yields correct
single-stage specs (DPT alt commands, TOC gated spec with the `AVA …,CC` chainNext); the gate timer +
`creatureClearable` behave correctly. **Not yet eyeballed:** a full live playthrough (phrases/voice on
moving creatures, type→clear, the gate visibly cycling) — the harness can't cold-start past the menu,
so that's Andrew's playtest pass. The `voice` CSS is a first-pass visual; refine to taste.

## Headless playtest + legacy-CSV purge (2026-06-20)

**Playtest — the engine integration is verified working.** The prior note ("harness can't cold-start
past the menu") turned out to be an *environment* quirk, not a game bug: the preview tab runs **hidden**,
so the browser pauses `requestAnimationFrame` and the game loop never ticks (and canvas screenshots hang
waiting for a frame). Worked around it by pumping `gameLoop(ts)` manually with a fabricated timestamp,
which drove a full live round headlessly. Results (all ✅, zero console errors):
- Spawn-stage distribution healthy — NTF/ENR/ARR/DPT/ARD/TOC each ~16–17%, PTC rare ~0.55%.
- Phrases + voice correct on creatures (NTF/TOC `cad`, rest `radio`); box colour resolves from the
  rolled CTA/priority value (so e.g. ARD's colour varies spawn-to-spawn — expected, not a bug).
- Normal clear (`ENR …` → cleared, +215); **DPT dual input** — both the `/code` and `NHS-…` alt
  command clear the same target.
- **TOC** gate `White→Pink/Blue` (only Blue hittable); premature `TOC {u}` at White = plain miss
  (target stays); at Blue → phase-2 `AVA {u},CC` → cleared. Box keeps the "TOC Completed" readout
  through phase 2 (intentional — `data.js` getTargetSpecs sets `chainNext.challenge = spec.challenge`).

**Legacy `challenges_commands.csv` purge — DONE (handoff #3).** Now that spawns are proven solid, fully
retired the flat file as the validation / God-Mode reference:
- `classifyInputError` (`script.js`) `knownCommands` now reads `Object.keys(LIFECYCLE_STAGES)` (the
  stage_ids *are* the command codes; AVA included so the TOC follow-up isn't flagged "UNKNOWN COMMAND").
- `buildGodModeMenu` (`script.js`) builds its command list from `LIFECYCLE_STAGES` (stage name as the
  label, terminal AVA excluded) instead of grouping `DATA_ACTIONS` — the old per-row "· N variants"
  count is gone (single-stage model, one record per stage).
- `loadGameData` (`data.js`) no longer fetches `challenges_commands.csv`; removed `DATA_ACTIONS`
  (live + embedded-fallback arrays), the `buildChainLinks()` machinery, and the reload-summary count.
  `getTargetSpecs()`/`generateStageSpec()` were already the spawn source, so the live path is unchanged.
- **Verified** after reload (http): data loads clean (no fallback warning, lifecycle validated, no
  errors); `classifyInputError` classifies unknown/known/AVA correctly; `buildGodModeMenu()` renders
  NTF→TOC rows on the real DOM; the A/B/C clear tests above all still pass identically.
- The physical `files/datasets/challenges_commands.csv` is now **unreferenced by code** (only doc/comment
  mentions remain) — safe to delete whenever; left in place for now.

**Still first-pass / open:** the `.voice-cad`/`.voice-radio` visuals (finalize with Andrew); live
*visual* screenshots aren't capturable in this hidden-tab preview (open `localhost:8765/files/index.html`
in a real tab to eyeball). Combat model stays **halted** per §0 pending the Overview attack clause.

## Playtest polish round — voice, unit-status colour, comic radio box (2026-06-20)

Four issues from Andrew watching gameplay. #1/#2/#4 built + verified; #3 deferred to discussion.

- **#1 — CAD label removed.** The `.voice-cad` bubbles carried a leading `▎CAD` prefix
  (`style.css` `::before`). Removed entirely; cad is now a plain terminal readout, distinguished
  from radio purely by the new radio comic panel (#4).
- **#2 — Unit tag now shows the unit's STATUS colour, not the priority colour.** The visible "unit
  box" is the on-fish canvas tag (`drawUnitTag`, `script.js`), which was using `colorChallenge`
  (priority/ctas). It now uses the unit's **current (predecessor) status colour** —
  `status_colors[call_lifecycle.unit_color]`, plumbed through as `colorUnit` from `getTargetSpecs`.
  So for an ARR challenge the tag shows **ENR**'s blue, DPT→ARR, ARD→DPT, TOC→ARD, etc. (PTC's
  predecessor is **ARR** per the spawn graph ARR→PTC — Andrew confirmed ARR over the ENR his list
  had; no CSV change). **On a successful zap** the tag flashes to the status it just moved INTO
  (`colorUnitNext` = this stage's own status colour) via a short scale-up/fade effect
  (`spawnStatusFlash`/`drawStatusFlash`, aged like explosions in `state.statusFlashes`), then
  vanishes. The TOC two-step keeps ARD through both steps and flashes **AVA** (Available) on the
  final AVA clear. The challenge phrase box is untouched (still priority/ctas). Verified live: each
  stage's resting/flash colours match `status_colors.csv`; flash fires on destroy and ages out;
  TOC→AVA finale flashes AVA green; no console errors.
- **#4 — Radio box is a comic transmission panel.** `.voice-radio .sonar-challenge-text` now has a
  jagged torn-edge silhouette (`clip-path`) with an electric **lightning crackle** around it
  (animated `filter: drop-shadow`, two "strikes" per 2.4s — drop-shadow follows the clip shape and
  isn't clipped by the box's `overflow:hidden`, unlike box-shadow/outset pseudos). The drop-shadow
  picks up the box's live `--chal-fg`. Old speech-bubble tail dropped. Verified the rules parse/apply;
  **needs a live eyeball** for final taste (can't screenshot the hidden-tab preview).
- **#3 — "TOC Requested not listed properly" — OPEN (discuss).** The 5 `toc_chevrons`
  (Arrived at Destination → Arrived in ED → Triaged → TOC Requested → TOC Completed) are parsed into
  the gate blob but **never displayed** — a TOC target only ever shows the phrase "TOC Completed"
  while its box cycles White→Pink→Blue. Awaiting Andrew's call on how the chevron sequence should
  surface (progress ladder, gate-driven label swap, status line, …). Not built.

## TOC Monitor subsystem — circle-beneath units (2026-06-20)

Built the non-combat TOC Monitor from Andrew's spec (the real CAD offload monitor). Designed via a
vetted multi-agent blueprint (5 subsystem planners + an integration critic that caught two
governance-critical integration bugs). **The premature-typing ATTACK stays deferred** (gated combat) —
premature typing is a plain "Improper Call Close" miss for now. Verified headlessly end-to-end; the
panel visuals need a live eyeball (hidden-tab preview can't screenshot).

- **Two independent axes** per TOC unit (the monitor's two readouts):
  - **Chevron stage** 1→5 (Arrived at Destination … TOC Completed) — random start, advances on a
    random per-tier timer.
  - **Offload colour** White → Pink (>60m waiting) → Blue (offloaded). Random timing. `gateState`
    stays the single hittable source (critic Conflict 2). Pink/White not hittable; **Blue = live**.
- **Live = Blue**, gated by a per-tier **proximity barrier** (far at tier 1 → close at depth). Blue
  arrives via chevron-5 (normal) OR an early colour-flip → **"Patient Left for other reason"**
  (orange ✓ on the last-reached pip). Verified: commits only past the barrier; Patient-Left sets the
  flag + orange check.
- **Movement:** new `'orbit'` archetype — units circle beneath the diver (centre = aquanaut.y+150,
  radius 100–140). Non-live units **despawn** at a random window; **live units stay until zapped**
  (never culled). `getCreatureMovement`-based; `resolveCreatureCollisions` skips TOC.
- **Separate spawn:** `maintainTocUnits` keeps `[tocActiveMin, tocActiveMax]` orbiting on its own
  cadence; `tocActiveMin` is a forced-spawn floor. TOC units don't count against the normal cross-
  screen cap (and vice-versa); cross-screen spawns re-roll past any TOC stage.
- **Governance-critical guards (critic Conflicts 3 & 8):** TOC units are excluded from the impact-
  damage block (`!c.isToc` at the impact check) so they never damage the diver; premature typing is
  intercepted in `handleCommand` **before** the hull-damage/rebreather-jam path → "Improper Call
  Close", streak reset, **no hull / no score / no jam**. Verified: hull unchanged on premature.
- **Zap (live):** reuses the TOC→AVA chain → on the AVA clear, `spawnStatusFlash` flashes **AVA green**
  (the unit becomes Available). Verified.
- **Display:** a `.toc-status-panel` in the sonar overlay — 5 chevron pips (fill to current; orange ✓
  on Patient-Left), the Current Status label (no timestamp: chevron label / "Patient Left…" /
  "Improper Call Close"), a White/Pink/Blue tint, and a cosmetic Bed Assign icon (after Triage, rolled
  by `Bed Assign %`). The normal challenge box is hidden for TOC units (the panel is the sole readout).
  No hospital/Site shown (data roughed in).
- **Data:** 10 new per-tier columns in `game_difficulty_progression.csv` (+ parser + embedded
  fallback): `TOC Spawn Min/Max`, `TOC Active Min/Max`, `TOC Advance Min/Max`, `TOC Blue Barrier`,
  `TOC Despawn Min/Max`, `Bed Assign %`. Seconds in CSV → ms in TIERS. Barriers tuned to 200/150/95/55
  so they sit inside the orbit's reachable distance.
- **PTC** confirmed = ARR (Andrew's call), data-driven via `unit_color`; no CSV change.

**Open / next:** the panel look is a first-pass (eyeball + tune); TOC units currently reuse a random
creature sprite (no bespoke "crew" visual yet); and the **premature attack + the diver/hose Impact
model remain gated** on ratifying the Overview clause (`Aquanaut_Impact_Clause_PROPOSAL.md`).

## TOC Monitor — seabed patrol movement (2026-06-20)

Andrew: TOC fish should **swim closer to the bottom, not sit directly beneath the diver, and swim
back and forth from wherever they spawn.** Replaced the `'orbit'` archetype (units circled a centre
pinned to `aquanaut.x, aquanaut.y+150`) with a new **`'patrol'`** archetype in `script.js`:

- **Spawn (`spawnTocCreature`):** a **world-anchored** seabed lane — `patrolCenterX` spread across the
  field (NOT tracking the diver; verified spread ≈ x 360–1190), `patrolBaseY` in a low near-seabed
  band, plus a gentle vertical bob. Lane bounds keep each unit's centre on-screen `[0,1600]×[0,900]`
  (the 360° sweep needs that to detect it) and clear of the canyon-wall gutters.
- **Motion (`updateCreatureMovement` `'patrol'` case):** sinusoidal back-and-forth around the spawn
  lane + slow bob; `vx/vy` recomputed from the per-frame position delta so facing/pitch still lead
  into the turn.
- **Reachability guard (important):** the Blue-commit **proximity barrier** (`tocBlueBarrier`
  200/150/95/55, live from `game_difficulty_progression.csv`) requires a unit to be ≥ barrier px from
  the diver to offload/go live. The old 200/150/95/55 values were "tuned to sit inside the *orbit's*
  reachable distance"; that geometry is gone. The new lane floor is **barrier-aware**
  (`reachFloor = aq.y + barrier − bobAmp + 30`) so every unit clears offload distance for most of its
  cycle — **no permanently-unclearable TOC units.** *Side effect to note: because patrol units sit
  low/far, the barrier is now satisfied most of the time, so Blue-commit is effectively time-gated
  (chevron + `TOC_GATE` timer) rather than spatially gated. Re-tune or retire the barrier if the
  "wait for offload distance" feel matters.*
- **Designer-tunable (CSV).** 7 new per-tier columns in `game_difficulty_progression.csv` (parsed in
  `core/data.js`, embedded fallback mirrored): `TOC Seabed Y%` (percent-down-screen → stored as a
  0–1 fraction; the resting band), `TOC Band Height` (px of vertical spread), `TOC Patrol Amp Min/Max`
  (px swing half-width), `TOC Patrol Speed Min/Max` (rad/s), `TOC Bob Amp` (px). `spawnTocCreature`
  reads these (defaults match the old constants: 82 / 52 / 90 / 160 / 0.45 / 0.85 / 14 → behaviour
  unchanged). Hot-reload live via **God-Mode → UPDATE DATASETS** (`reloadAllCSVs` → `loadGameData`).
  **Seabed Y% vs. barrier:** whichever sits LOWER wins — at a shallow tier the big `tocBlueBarrier`
  can force units below the Seabed Y% setting (lower the barrier to raise them). `reachFloor` and the
  on-screen cap stay internal safeties, so even extreme CSV values can't make a unit unclearable or
  push it off-screen.
- **Verified:** node syntax check; a 3-lens adversarial review (reachability / bounds-detection /
  integration-regression — all pass); and a live headless run — at Tier 1 (tightest barrier, 200) and
  Tier 4 (55), 40 + 30 spawned units were **0 off-screen** and **0 never-past-barrier** over 3 s of
  pumped patrol, swinging back and forth (avg ≈150 px) in a low band (Tier 1 ≈ y 798–851). Re-verified
  after the CSV wiring: defaults reproduce the same band; a simulated edit (Seabed 93 %, amp 200–300,
  speed 1.5–2.0, bob 30) moved the units exactly as set, still 0 off-screen / 0 unreachable.

## TOC Monitor — retire the Blue barrier (2026-06-20)

Andrew's call: with patrol units satisfying the proximity barrier on their own, it had stopped earning
its keep — retire it. **Blue / offload commit is now purely time-gated** (the chevron + `TOC_GATE`
timer); a unit goes live wherever it is, even right next to the diver.

- Removed the proximity check in `advanceTocGates` (the `dist < tocBlueBarrier` "too close — wait" gate).
- Removed the now-dead `reachFloor` safety in `spawnTocCreature`. The seabed band is now driven
  **only** by `TOC Seabed Y%` + `TOC Band Height`; the sole vertical safety left is the on-screen cap
  (`H − 48 − bobAmp`) so the 360° sweep can always detect a unit. **Consequence:** all tiers now rest
  at the same Seabed-Y% band (default 82 % ≈ y 740–790). The shallow tiers no longer get pushed lower
  by a big barrier — raise `TOC Seabed Y%` for a tier if you want its fish closer to the bottom.
- Deleted the `TOC Blue Barrier (dist)` CSV column + its parser line, `TIERS` field, and embedded
  fallback (no dead knob left in the spreadsheet). Recoverable from git if ever wanted back.
- **Verified (headless):** CSV still parses aligned after the column removal (`tocBlueBarrier` absent;
  despawn/bed/patrol columns all correct); seabed band uniform across tiers (T1 741–790, T4 740–787);
  and a unit forced to **dist 0 from the diver now commits to Blue/live** (would have been blocked
  forever under the old barrier). No console errors.

## TOC Monitor — spread targets over the bottom third + full horizon (2026-06-20)

Andrew: targets were bunching up and hugging one thin strip. Fix: don't group them; let them live
anywhere in the **bottom third of the screen (below the Aquanaut)** with **full reign of the horizon**.

- **De-cluster (horizontal).** `spawnTocCreature` now picks the new lane centre by rejection sampling
  — of 6 random candidates it keeps the one *farthest* from existing TOC lane centres — so targets
  don't bunch. Lane centres span almost the whole width; each unit's swing is then clamped to the room
  left/right (with a `minSwing` floor) so it patrols widely yet never clips a screen edge. The old
  240 px wall-gutter inset is gone (Andrew: full horizon). Verified: 8 stacked units spanned lane
  centres x 105–1496, reached x 40–1509 in motion, min lane gap 80 px, 0 off-screen.
- **Bottom-third band (vertical).** Renamed the two vertical knobs to plain percent-down-screen and
  widened the default band: **`TOC Seabed Y%` → `TOC Band Top Y%`** (default **68** ≈ y 612, just below
  the diver) and **`TOC Band Height` → `TOC Band Bottom Y%`** (default **95** ≈ y 855, near the floor).
  A unit spawns uniformly between them, so they spread vertically instead of hugging one line. Clamps
  keep the band below the diver (`aq.y + 35`) and the centre+bob on-screen (`H − 30 − bobAmp`).
  Verified: spawn Y band 620–851 (231 px tall, was ~50), in-motion y 612–865, 0 off-screen.
- Parser (`core/data.js`) + embedded fallback updated for the renamed columns; `spawnTocCreature`
  reads `tocBandTopPct` / `tocBandBotPct`. `node --check` clean, no console errors.

## TOC Monitor — text-only status panel (2026-06-20)

Andrew: the chevron pips ate too much room — drop them, text only, smaller font.

- Removed the 5-pip `toc-chevron-row` from the panel (DOM build in `ensureSonarOverlay`, the pip-fill
  loop in the overlay update, the cleanup ref, and the `.toc-chevron-*` CSS). The **`tocChevron` stage
  counter stays** — it still drives the `toc-status-label` text (Arrived at Destination → Arrived in ED
  → Triaged → TOC Requested → TOC Completed; or "Patient Left…" / "Improper Call Close"), so the panel
  now conveys the stage as words only.
- `.toc-status-label` font 12 → **9 px** (letter-spacing 0.5 → 0.3); panel padding 6/10 → **3/7**,
  gap/margin tightened. Panel children are now just `[tint-box, status-label, bed-icon]`.
- Verified (headless): spawned-unit panel has no chevron row (`pipCount 0`), label reads the stage as
  text ("Arrived in ED"), computed font-size 9 px. No console errors.

## §0.9 attack-model clause — kill-set drafted (2026-06-21)

Drafted the **§0.9 kill-screen / attack-model clause** into
[`Aquanaut_Impact_Clause_PROPOSAL.md`](Aquanaut_Impact_Clause_PROPOSAL.md) (the staging
doc that gets pasted into the Overview). Source: a design pass from Claude Chat,
ratified-in-principle by Andrew. **Doc only — no code conformed yet; the §0/§8.4 hold
still stands** until the clause lands in the Overview.

- **Organizing principle:** each kill attacks vision in a *different* category, so the
  four read as a designed set — **Great White = ENGULFED** (you go inside the throat),
  **Moray = BREACHED** (it comes inside the helmet — one puncture), **Box Jelly =
  SHROUDED** (smothered + whiteout), **Puffer = POISONED** (sight survives but corrupts).
  Shark/eel are deliberate mirrors (*you enter it / it enters you*).
- **Target architecture (new):** each level = **3 main targets** (float in from the sides
  already in attack mode) + **1 TOC target** (bottom-lingering, level-specific). **Level 1
  TOC = Puffer Fish**; its death fires off the TOC sub-machine, not a side lunge.
- **Pufferfish = POISONED** (the comedic-horror creature): chuckle → puff-goes-wrong →
  multi-point spine puncture → toxin **vision corruption** (double vision, desaturation,
  tunnel-in, HUD smear, "helpless lucidity"). No blood flood / no blackout — that's its
  differentiator. Terminal word TBD (FUGU / PRICKED / POISONED / NUMB; not POP).
- **Reconciliation flagged** (clause §E): the provisional build in the working tree
  diverges — **Moray** is the real change (built as *gnaw-in-mask*, clause says *BREACHED*;
  open decision: keep / pivot / merge); Jelly needs multi-point + heartbeat-ramp; Shark
  needs the held black-throat beat; Puffer needs the POISONED reframe + art
  (`pufferfish_front_closed/open`); terminal words in config (DEVOURED/SHREDDED/…) revert
  to the locked CRUNCH/SNAP/STUNG set on ratification.

**Next:** ratify §0.9 into the Overview → then conform the provisional kill code to it
(starting with the Moray keep/pivot/merge call) and build the Puffer once art lands.

## §0.9 ratified — kill-screen hold lifted (2026-06-21)

**Andrew lifted the §0/§8.4 governance hold and ratified §0.9** as the Aquanaut's
attack-model clause. Rationale (owner's call): the hold was written ~6 months ago, long
before the §0.9 kill-set design existed, and was blocking work it was never scoped to
gate. The clause in [`Aquanaut_Impact_Clause_PROPOSAL.md`](Aquanaut_Impact_Clause_PROPOSAL.md)
is now **adopted**; its header carries the ratification stamp and is cleared to paste
into the external Overview Core Doc (owner's action — the Core Docs live outside this repo).

**Effect:** combat-model / kill-screen implementation is **no longer halted**. The
provisional build may now be conformed to §0.9 per the clause §E reconciliation list.
Still gated on two creative calls before conforming code: the **Moray** keep/pivot/merge
decision and the **Puffer** terminal word; Puffer also needs its head-on art
(`pufferfish_front_closed/open`).

## TOC Monitor — Pufferfish swim sprite wired in (2026-06-21)

Andrew dropped two green-screen swim sprites in `files/assets/Tier 1/Targets/`
(`toctarget_pufferfish_deflated_ht.png`, `toctarget_pufferfish_inflated_ht.png` — the
`target` → `toctarget` naming variant). Wired them in as the Tier 1 TOC signature, replacing
the random-creature placeholder. **Swim sprite only — the gated POISONED kill/attack model
(§0.9) is untouched; this is just the bottom-lingering target's body art.**

- New `pufferfish` entry in `CREATURE_TYPES` (`core/config.js`): `bodyStyle: greenscreen`,
  `spriteSize {150,82}` (aspect-correct for the 2816×1536 source), `stateFrames: true`,
  `spawnWeight 0` / `minTier 99` so `getCreatureType()` never rolls it for a cross-screen
  target. `CREATURE_SPRITES.pufferfish` = `[deflated, inflated]` (both `_ht` → face left).
- `spawnTocCreature` now assigns the Pufferfish type directly (was a random creature).
- The two frames are **states, not a flipbook**: `drawGreenscreenCreature` shows deflated
  (frame 0) by default and **inflated (frame 1) once the unit offloads / goes live (Blue)** —
  an interim telegraph that it's now actionable. (Final inflation semantics belong to the
  gated POISONED "puff-goes-wrong" attack; easy to re-point the trigger.) Same-size frames +
  the existing bbox centroid-align make the inflated body render larger from the centre — a
  real puff, no distortion.
- Verified (headless): both sprites load clean; TOC spawns as `pufferfish`; frame
  flips 0↔1 with `tocIsLive`; 0/80 regular rolls produced a puffer; no console errors.
  Visual size/centre is a first guess (`spriteSize`) — eyeball in-game and tune.
- **Transparent sources (resaved without a background).** `loadCreatureSprite` now auto-skips
  the green-screen chromakey when the source is already transparent (all four corners alpha 0),
  so a pre-cut PNG is used as-is and keying can't nibble greenish pixels off the art. Green-screen
  exports (opaque corners) still key as before — detection is per-image, no per-sprite flag.
  Verified: both puffer PNGs read corners α0 / centre α255 → chromakey skipped. (Note: after
  resaving art, hard-refresh the browser — soft reloads can serve the cached image.)

## Attacker spawn — lane grid + anti-jumble spacing (2026-06-21)

Reworked **how cross-screen attackers spawn** so the challenge is *reaction time*, not
screen clutter. The old 8-zone vertical spread (`getSpawnZone`) let everything converge on
the centre umbilical and pile up; replaced with a **6-lane grid** + two spacing rules.
Designed with Andrew over a back-and-forth. **Attacker spawn geometry only** — the TOC
subsystem, the two (already-separate) caps, and the halted §0.9 combat/penalty model are
all untouched. Re-biasing *which* lifeline a lane heads for is part of the already-live
movement system, not the gated combat clause.

- **The grid.** Screen split L/R down the centre (the umbilical line) × **equal-quarter
  rows Q1–Q3** = **6 attacker lanes** (L1–3, R1–3). **Q4 (bottom quarter) is exempt** —
  it's the TOC patrol band, its own beast (no L/R, no inner/outer). "L vs R" is just spawn
  side + inward travel (the existing `fromLeft`); there's no wall on the centreline.
- **Rule 1 — hard one-attacker-per-lane.** A lane holds at most one target → overlap on the
  approach is impossible (stronger than the old "avoid the last 3 zones" heuristic).
- **Rule 2 — same-side adjacency stagger (self-releasing).** Each lane splits into an
  **outer** half (edge side) and **inner** half (centre side) at x = 400 (L) / 1200 (R).
  A target *still in its outer half* blocks its **same-side vertical neighbours** (row ±1)
  from spawning; the instant it crosses inward, the neighbour frees. So adjacent same-side
  entries are staggered by "time to swim halfway in" — never shoulder-to-shoulder. The other
  side is independent. (Andrew's idea — the dynamic release is the clever part.)
- **Retry-next-frame.** `spawnCreature()` now returns a bool; `maintainCreatures` resets the
  spawn interval **only on a real spawn**, so a tick where every eligible lane is blocked just
  retries next frame instead of eating a dead gap.
- **"A little overlap."** Equal-quarter rows, but spawn-Y bleeds ±15 px past each row line
  (`rowOverlap`) so the grid doesn't read stiff; lane ownership stays discrete. And **Q2/Q3
  attack either a hose or the diver** — per-row weighted target preference (`LANES.rowTargets`):
  Q1→REGULATOR; Q2→HOT WATER/COMMS/diver (3:3:1); Q3→COMMS/diver (2:3). The aquanaut is the
  shared low-weight "either" pick so the Q2→diver dive (a steeper diagonal) stays occasional.
- **Where it lives.** New `LANES` block in `core/config.js` (rows/bands/overlap/outerFrac/
  rowTargets — all tunable, **no new CSV columns**; `Max Targets` keep ≤ 6 already governs the
  cap). `script.js`: `getSpawnZone` → `laneOuterBoundary` / `isLaneOuter` / `getEligibleLanes`
  / `laneSpawnY` / `pickLaneTarget`; attackers now carry `lane:{side,row}`. `state.spawnHistory`
  retired.
- **Verified** live against the real game functions (headless, no console errors): tight-loop
  fill stops at `[L1,L3,R1,R3]` (row 2 correctly blocked while 1&3 sit outer); self-release
  frees L2 when L1 crosses to inner; spawn-Y bands [25–240]/[212–464]/[436–653] with the
  overlap; target weights match 1.0 / 3:3:1 / 2:3; a 300-frame moving sim used **all 6 lanes**
  (no row-2 starvation), peaked at 6 concurrent, with **zero** one-per-lane or adjacency
  violations; TOC units carry no lane and are ignored by the lane logic.
- **Eyeball / tune in-game** (hidden-tab preview can't screenshot): the Q1→REGULATOR-only
  mapping means the top hose takes more heat — rebalance `rowTargets` weights if it dies
  disproportionately. Watch shallow tiers for sparseness (cap + stagger) and tune via approach
  speed / the outer/inner boundary if needed.

## §0.9 conformance pass — words + interface + shark/moray (2026-06-21)

First conformance work after the hold lifted. **Decisions resolved this session:** Moray =
**MERGE** (breach → gnaw inside); Puffer terminal word = **FUGU**.

Landed + syntax-verified (`node --check`); **visual eyeball still pending** (preview rAF is
paused here — can't screenshot the canvas; see [[headless-playtest-pump]]):
- **Terminal words** (`config.js`) → locked set **CRUNCH / SNAP / STUNG / FUGU** (+ CRUSHED).
- **Death-event interface** (`buildDeathEvent`) → added `pufferfish` to the creature map and a
  `via: 'side' | 'toc'` field (§0.9 §D); puffer resolves to `toc`.
- **Great White — black-throat beat** (`drawKillCam` + kill state): devour now surges in to a
  held **total-black throat** that blacks out the faceplate edge-to-edge, and the terminal word
  is **delayed ~1.25 s** (new `wordDelay`) so it lands *after* the held beat; `attackDur` +1 s
  for room.
- **Moray — BREACHED merge** (`triggerKillCam` strike event + `drawKillCam` + new
  `drawNearSideBlood`): strike now fires a **single central puncture** (`glassCrack` + 1 crack
  at u/v 0,0) then the existing gnaw continues; gnaw blood routed to a new **near-side** renderer
  (film + drips running down the *inner* glass + wet sheen) so it reads "in here with you," not a
  cloud out in the water.
- **Box Jellyfish — SHROUDED** (`updateKillCam` strangle branch + `drawKillCam` + the old
  `drawSlimeSmear`/`drawStrangleVignette` **replaced** by `drawTentacleCreep`/`drawShroudVignette`):
  oral-arms now creep in from **6 rim anchors**; sting flashes **ramp in frequency** like a rising
  heartbeat (`hz = flashHz·(1 + since·0.9)`); the dark vignette is gone — the shroud cinches to a
  pale **whiteout**, not a black tunnel.

## §0.9 conformance — Puffer POISONED built + faceplate-art path bug fixed (2026-06-21)

Completed the kill set; all four creatures now conformed (runtime-verified, visual eyeball
pending).

- **Puffer — POISONED** (new `poison` mode replacing the provisional `impale`): 4-beat sequence
  in `drawPufferBody` (chuckle/deflated → puff-goes-wrong/inflated → smug deflate) + the
  radial-puncture **crack overlay** (`drawPoisonPuncture`, screen-blended so the art's dark field
  drops out) + the differentiator **vision-corruption renderer** (`drawPoisonCorruption`:
  desaturation via `saturation` blend, sickly tint, chromatic double-vision ghosts of the cracks,
  tunnel-in — no blood, no blackout). New state field `tox`; FUGU delayed via `wordDelay`. New
  `pufferfish` `DEATH_SCREENS` entry ("THE FUGU'S GIFT").
- **Art:** the owner's `pufferfish_radialpuncture.png` is the multi-point cracked-glass overlay
  (Beat 3). Body uses the head-on `pufferfish_front_deflated/inflated.png` (found in
  `assets/Kill Screen/Tier 1/`, not the `front_closed/open` names the spec guessed).
- **Pre-existing bug caught + fixed:** `KILL_SCREEN.creatures` pointed at
  `assets/Kill Screen/<creature>_front_*.png`, but the frames live in the **`Tier 1/`** subfolder
  — so the three side-creature **bodies had been silently failing to load (404)** and the kill cams
  only ever showed effects. Added `Tier 1/` to the paths; bodies now load (bbox computed).
- **Debug hotkeys (TEMPORARY — remove before commit):** in a dive, click off the command box,
  press `7/8/9/0` = Great White / Moray / Box Jelly / Pufferfish to fire that kill cam.
- **Runtime-verified (headless pump):** all four cinematics run their full timelines with **no
  errors** and clean `gameOver` exits (devour 7.5s, gnaw/strangle 6.5s, poison 8.5s); all body +
  overlay art loads. **Visual look still unverified** — needs an in-browser eyeball (can't
  screenshot here; see [[headless-playtest-pump]]).

**Next:** in-browser eyeball all four → tune (puffer corruption intensity, near-side blood read,
whiteout balance, body fit/scale per creature) → mark the §E reconciliation items conformed →
remove debug hotkeys → commit.

## Procedural helmet mask — fit fixed by construction (2026-06-21)

The photographic plate (`kill_screen_POV.png`) never fit the cinematic: its visor is an irregular
landscape shape, the cinematic clipped to a rounded-rect bounding box (so creatures **spilled onto
the metal frame** at the corners), and the **portrait** creature frames can't fill a wide landscape
glass. Owner chose to rebuild the mask around the cinematic ("fit the mask to what you are creating").

- **New `KILL_SCREEN.maskMode: 'procedural'`** (config) draws the diver helmet in canvas around
  defined rects, so the cinematic fits the glass by construction. `'plate'` keeps the legacy photo.
- **`killScreenMaskGeom(w,h)`** is the single source of truth: a CLEAN central visor (rounded-rect,
  aspect 0.92 — taller than wide, to suit the portrait creature art) + two side ports (§0.9 glimpse)
  + two panel housings. `getFaceplateRect` returns this visor; `drawKillScreenPanels` + the glimpse
  read these ports/panels. Both the creature cam AND the crush/abyss cinematic now use the unified
  `drawKillScreenSurround` → `drawProceduralHelmetMask` (gunmetal fill + vignette + per-window
  `drawKillScreenHelmetWindow`: bezel ring + glass void + rim + rivets).
- All look/geometry knobs live in `KILL_SCREEN.mask` (visorAspect, visorScale, round, bezel, bolts,
  port sizes, metal colors) — tune in-game without code.
- **Verified (headless pixel sample, 1280×720):** green-leak = 0; the visor-centre-row brightness
  profile reads metal → port(void+bezel) → metal → visor(bezel·creature·bezel) → metal → port →
  metal, left/right symmetric; **creature content stays inside the visor bezel** (no spill onto the
  frame). All four cams still run full timelines with no errors through the new surround path.
  **Aesthetic still pending the owner's in-browser eyeball.**

## TOC status box — single line, CSV-blue when available, chevrons retired (2026-06-22)

Reworked the TOC status box (the readout under a TOC monitor unit) per Andrew. The **chevron
stage ladder was removed** ("not working") — the offload colour is now the only axis.

- **Single line.** The panel was a flex *column* and the bed icon reserved a row even when
  hidden, leaving a large empty gap under the status text. `.toc-status-panel` is now an
  `inline-flex` **row**, and `.toc-bed-icon` is `display:none` until assigned (then it sits
  inline on the same line) so it reserves no space. The box is a single line.
- **Chevron ladder removed.** The 5-stage `tocChevron` machine (Arrived at Destination → … →
  TOC Completed) that drove the label text is gone: dropped the chevron axis from
  `advanceTocGates`, the `tocChevron*` / `_tocChevronTimer` / `_tocWantsBlue` spawn fields, and
  the chevron-derived label/bed-icon triggers. The box now reads **"Awaiting TOC"** while waiting
  (White/Pink), and once Blue reads **"TOC Completed"** (reached via Pink) or **"Patient Left for
  other reason"** (reached directly White→Blue). Bed icon shows on an available unit if rolled.
  *(Orphaned but left loaded: `toc_chevrons.csv` + `parseTocChevrons` / `TOC_CHEVRONS` /
  `gate.chevrons` in `data.js` — purging them touches the positional loader + the `file://`
  embedded fallback, so it's a separate clean-up pass.)*
- **CSV blue when available.** "Available" = the *hittable* offload state (Blue). The panel fills
  the tint box with the **solid CSV colour** (`toc_colors.csv` Blue = `#BEE5EB`) + black CSV text
  inline, while White/Pink waiting states stay deliberately **subdued** (dim translucent) — so
  available is unmistakably distinct. `.toc-tint-box.toc-color-blue` now carries only the glow.
- **Never spawns active.** Units always start at `gateState 'White'` (not hittable), so a unit
  never spawns available — it must flip to Blue on its timer before going live.
- **Timing left to a separate tuning pass** (Andrew): the offload-colour flip delay lives in
  `TOC_GATE` (`core/config.js`). Existing minimums already prevent instant flips; the values
  are his to tune. (The per-tier `tocAdvance*` CSV columns drove the retired chevron timer and
  are now unused.)

## TOC live units drift toward the diver (2026-06-22)

When a TOC unit goes **live** (Blue/offloaded) it now leaves its seabed patrol and **slowly
creeps toward the Aquanaut**, then holds just outside the diver — a telegraph that it's
actionable. Designed + adversarially reviewed via two multi-agent workflows (map/speed-calibration
→ 3-approach judge panel → synthesis; then a 3-lens review that caught a sprite-overlap blocker).

- **New `tocApproach` movement archetype** (`updateCreatureMovement`, `script.js`). Flipped from
  `'patrol'` at the single go-live hook in `advanceTocGates` (where `tocIsLive` flips true). The
  case drives the unit by a **constant** unit-vector × px/s × dt step (not a lerp — a lerp would
  make speed distance-dependent and break the "slower than others" calibration), recomputing
  `vx/vy` from the position delta so facing/pitch read correctly. **No TOC combat guard was
  touched** — every guard keys on `isToc`/`tocIsLive`, never the archetype, so impact-off,
  no-cull, and no-collision are provably unchanged (verified by the review).
- **Speed:** `TOC_DRIFT.pxPerSec = 10` (global knob in `core/config.js`, TOC_GATE-style, non-tiered).
  Calibrated from the real attacker math: normal Tier-1 attackers run ~11–66 px/s (median ~29);
  10 px/s reads as a lazy creep and stays under the typical slow attacker at every tier. Tunable.
- **Standoff (no overlap):** the live pufferfish sprite is large (**150×82** virtual px), so a
  naïve point-distance standoff overlapped the diver from below. The hold distance is now sized
  **direction-aware** from both sprites' half-extents (unit half-extents read from `spriteSize`;
  diver envelope ≈45×90 with its bottom at `aq.y`), holding the sprite **edge** `TOC_DRIFT.edgeGap`
  (16px) clear of the diver body from any angle. Verified numerically: no overlap across 16
  approach angles incl. the idle hover.
- **De-stacking:** TOC skips push-apart collisions, so multiple live units would blob. At go-live
  each unit picks a hold **angle** near its real approach bearing but nudged to the *emptiest arc*
  (a bestGap loop mirroring the patrol-lane de-cluster), so up to `tocActiveMax` units fan out
  around the diver. Verified: even 3 units arriving from straight-below separate cleanly.
- **Idle hover:** once on station the hold point gets a gentle ±6px bob so a held unit reads as
  *hovering*, not parked.
- **Tunables:** `TOC_DRIFT = { pxPerSec, edgeGap }` in `core/config.js`. Open feel-tuning items
  for Andrew's eyeball: drift speed (10 — could drop to ~8 for a wider Tier-1 margin), hold gap
  (16), hover amplitude. Needs a live in-browser look (hidden-tab preview can't screenshot).

## TOC finale fixes — AVA command, two-step unit colour, box-blue (2026-06-22)

Three fixes from Andrew watching the TOC→AVA finale.

- **AVA command lost its comma.** The terminal stage's `command_template` was `"AVA {units},CC"`
  → "AVA 2101,CC". Corrected to `AVA {units} CC` (space, no comma) in `call_lifecycle.csv` **and**
  the embedded `file://` fallback in `data.js`. Matching is safe: `normalizeCmd` only collapses
  spaces *around commas*, so the comma-free form compares exactly.
- **Unit tag now moves into the TOC colour on the TOC command.** The two-step's `chainNext.colorUnit`
  was kept on the **ARD** predecessor through both steps, so the on-fish unit tag stayed ARD after
  "TOC {u}" was typed. It's now `STATUS_COLORS_RAW['TOC']` (Muted Plum `#995B87`/`#3E2778`), applied
  at the phase-2 transition (`script.js` chain handler). Full flow: spawn = **ARD** → type "TOC {u}"
  → tag changes to **TOC** plum (no flash, just settles) → type "AVA {u} CC" → `spawnStatusFlash`
  flashes **AVA** green (`#2DB704`) and the unit vanishes. `colorUnitNext` (AVA) was already correct.
- **Status box read transparent, not blue.** Two causes addressed: (1) the available fill now applies
  whenever the unit is hittable with a **hard fallback** to `#BEE5EB` (was gated on the parsed colour
  resolving, which—if ever null—dropped it back to the ~10%-opacity waiting base = see-through); and
  (2) `.toc-tint-box.toc-color-blue` dropped its **inset** glow (it washed the pale `#BEE5EB` centre
  into a haze) for a clean outer glow + a defined dark border, so it now reads as a solid chip.
  (`#BEE5EB` is the intended "Ice Blue" per the retired `challenges_commands.csv` too.) Needs Andrew's
  eyeball to confirm the look; if he wants a punchier blue that's a `toc_colors.csv` change.

## TOC tuning round — bubble gap, real blue, bounded timing + count cap (2026-06-22)

- **Challenge bubbles closer to the target.** The box gap dropped from `spriteH*0.55 + 4` to
  `spriteH*0.30 + 2` (`drawBubble`, `script.js`) — applies to all challenge bubbles. Tunable inline.
- **The box was technically `#BEE5EB` but that "Ice Blue" reads as near-white.** Root cause finally
  pinned: the code *was* applying the CSV colour; the value itself was too pale. Changed
  `toc_colors.csv` Blue → **`#4F9BE0`** (a real medium blue, black text still legible) in both the
  CSV and the `data.js` embedded fallback. Also made `.toc-tint-box.toc-color-blue` carry a **solid
  `#4F9BE0` background in CSS** so the box reads blue whenever the unit is available *independent of
  the inline path* (bulletproof); the inline still overrides with the exact CSV colour.
- **Offload timing moved to the CSV + made BOUNDED.** New per-tier columns **`TOC Offload (Min/Max
  sec)`** (repurposed the dead `TOC Advance` columns; default **40–120 s**) drive `tocOffloadDelay()`
  (`script.js`); `TOC_GATE` (`config.js`) is now just the fallback (40 000/120 000 ms). The gate was
  reworked from random per-flip transitions to a **single bounded countdown**: a unit rolls one total
  budget ∈ [40,120] s at spawn and a coin-flip route — `_tocViaPink` flips Pink at the half-way mark
  (→ "TOC Completed") else stays White (→ "Patient Left"). **Both routes go live at the same bounded
  time**, so activation never exceeds the configured max (verified: 100% within [40,120] s).
- **Concurrent cap.** `TOC Active (Min/Max)` set to **1 / 2** across all tiers (was 3–5).
- **Despawn retired (required).** With offload now 40–120 s, the old 15–25 s non-live recycle window
  would cull units *before* they could activate. Non-live units no longer auto-despawn
  (`_tocDespawnTimer: Infinity`; the despawn loop removed) — every unit activates within its budget,
  then holds until typed. The `TOC Despawn` CSV columns are now vestigial (left in place, like the
  retired `TOC Advance`/`toc_chevrons`).
- **Still needs a live eyeball:** the exact blue, the bubble gap, and the 40–120 s feel are all
  CSV/inline-tunable.

## Challenge bubble — flip above the target near the screen bottom (2026-06-22)

Low TOC units (the patrol band runs to 95% of screen height) had their challenge bubble parked
below them — off the bottom edge, invisible. The bubble is the bottom item of a flex column
centred on the target (`drawBubble`, `script.js`), so it always hangs below.

- **Flip-up:** when the estimated bubble bottom (`screenY + ~probe-half + gap + box`) would pass the
  canvas bottom, JS toggles a `flip-up` class → `.sonar-challenge-overlay.flip-up { flex-direction:
  column-reverse }` (`style.css`), moving the bubble ABOVE the target instead. A **40px hysteresis**
  band (`creature._bubbleFlipUp`) stops the patrol bob from flickering the flip at the threshold.
- **Gap tightened** again: `spriteH*0.30 → *0.20` so the bubble hugs the target closer.
- Applies to all challenge bubbles, but matters most for the low TOC patrol units. Needs an eyeball.

## Gameplay pass — TOC roam/attack, radar blip, fullscreen, F12 reset (2026-06-22)

Six gameplay fixes from Andrew watching a dive. All syntax-verified (`node --check`); **in-browser
eyeball + tuning still pending** (preview rAF is paused — see [[headless-playtest-pump]]).

- **TOC bubbles always ABOVE the target.** `drawBubble` (`script.js`) now forces
  `creature._bubbleFlipUp = true` for any `isToc` unit, so the TOC status box sits over the fish
  regardless of the bottom-edge flip test. Non-TOC bubbles keep the screen-bottom hysteresis flip.
- **TOC targets free-roam Q4 (not a fixed lane).** Replaced the back-and-forth `'patrol'` archetype
  with a new **`'tocRoam'`**: a not-yet-live TOC unit wanders to random destinations across the FULL
  width of the bottom band (both edges), rolling a fresh target on arrival or after `repathMs`, like a
  free fish. New helpers `tocRoamBand()` / `pickTocRoamDest()` (band = per-tier `TOC Band Top/Bottom Y%`
  CSV knobs, clamped below the diver + on-screen for the sweep). Knobs in **`TOC_ROAM`** (`config.js`:
  `speedMin/Max 45–95 px/s`, `edgeMargin`, `arriveDist`, `repathMs`). The old `'patrol'` case is left
  in the switch as dead code (no caller). `spawnTocCreature` rewritten; the patrol lane/amp/bob fields
  and the lane de-cluster loop are gone.
- **TOC targets ATTACK the diver.** When a unit goes live (Blue/offload) it flips to **`'tocApproach'`**
  which now CHARGES straight to the diver (was: creep to a standoff and hover). The impact check (was
  `!c.isToc`) now lets a **live** TOC unit through (`c.isToc && c.tocIsLive`) → `damageHose(aq)` →
  `latchCreatureToSuit` → the existing **3-second suit-latch survival window**; type the command to
  repel (+150), timeout → the Pufferfish **POISONED** kill cam (§0.9). Not-yet-live TOC units still pass
  through harmlessly. `latchCreatureToSuit` now shows the **attacker's own** command/challenge (TOC or
  cross-screen) instead of rolling a fresh one. `TOC_DRIFT.pxPerSec` 10 → 14 (charge, not a creep).
- **Radar sweep gate made VISIBLE.** The `_sweepDetected` gating was already correct (verified the
  detection math in isolation: contacts resolve 0.75–2.4 s after the arm passes, never instant) — but
  pre-detection there was *nothing* on screen, so the gate didn't read (edge-spawned attackers finish
  their hidden window while still at the rim). Added **`drawSonarContactBlip`**: an undetected creature
  now shows a faint pulsing sonar contact (dot + ping ring) that only resolves into the sprite + Unit +
  Challenge once the tracer crosses it. Scripts are loaded `?t=Date.now()` (no stale-cache risk).
- **Fullscreen + P pause** (Andrew's pick for the accidental-F11/Esc problem). `startGame` calls
  `requestGameFullscreen()` (within the start-button gesture); a HUD **`#fullscreen-toggle`** (⛶, next
  to the `?` button) calls `toggleFullscreen()`. **P** now pauses/resumes alongside Esc — gated to when
  the command box is NOT focused, since commands contain P (DPT/PTC); Esc stays the universal pause.
- **F12 = no-penalty reset** (like CAD's PowerLine clear). F12 now clears the command box (`value=''`,
  hide autocomplete/powerline, reset block cursor) as well as clearing a jam — penalties only fire on a
  SUBMIT miss, so bailing with F12 costs nothing. Jam panel re-worded: header **"SONAR PULSE JAM"**,
  hint **"HIT [F12] TO RESET SONAR PULSE"** (`index.html`).

**Follow-up (same day):**
- **Dropped the dotted sonar tether on TOC units** (an Asteroid Command carry-over). `drawSonarTether`
  early-returns for `isToc` — non-TOC creatures still tether to their challenge box (can be removed
  globally on request).
- **Pre-activation TOC status box = solid WHITE fill + BLACK font** (Andrew trying this vs the old
  transparent). `style.css`: `.toc-tint-box` white + dark border, `.toc-color-pink` light pink, both
  with black text via `.toc-status-label` (color `#000`, no glow). Live Blue (#4F9BE0) fill unchanged.
  The exact old transparent values are kept in a CSS revert-note comment for a one-line rollback.

## COM radio-call bonus — diving bell (2026-06-25)

New **F3 "COM" comment bonus**, modelled on the real CAD (log a comment with `COM <unit#>`,
or hit F3 to drop the word `COM` onto the PowerLine, then the unit # + comment). At random
idle intervals a single **diving bell** floats up from the bottom carrying a crew **radio
call** (a statement with keywords); the player logs `COM <unit#> <comment>` and the comment
just has to contain every keyword. Built to Andrew's four design calls:
- **Input:** `COM <unit#> <comment>`. **F3 inserts `COM `** into the command box (keydown
  handler, `script.js`) — type the unit # + comment, Enter. Manual `COM …` works identically.
- **Keywords:** ALL required, **loose** (case-insensitive substring, any order, extra words
  fine). Every CSV statement contains its own keywords, so retyping the call always works.
- **Stakes:** **PURE BONUS.** Logging = `COM_CALL.bonus` (+150). Ignoring it (the bell drifts
  off the top) or fumbling it (no bell / wrong unit / missing keywords) costs **nothing** — no
  score loss, no streak break, no rebreather jam. The COM input is intercepted at the TOP of
  `handleCommand` (regex `^COM\b`, which excludes `COMMS`/lifecycle codes) so it never reaches
  the miss/penalty path.
- **Concurrency:** **one bell at a time**, on its own idle-interval cadence (`maintainComCall`).

Content lives in **`files/datasets/Gameplay/com_radio_calls.csv`** (`Statement,Keywords`;
keywords pipe-separated). Loaded non-fatally by `loadGameData()` (+ embedded `file://`
fallback mirroring the CSV) and **hot-reloads via God-Mode → UPDATE DATASETS**. Tunables in
**`COM_CALL`** (`core/config.js`): spawn min/max, rise speed, bob, bonus, spawn column,
sprite size, bubble wrap width, `highlightKeywords` (keyword words drawn amber in the bubble).

- **Engine seams:** `state.comCall` (single bell) + `state.comCallInterval`; `maintainComCall`/
  `spawnComCall`/`updateComCall` (hooked in `update()`); `drawComCall`/`drawComBubble`/
  `drawComBellPlaceholder` (hooked in `render()`, drawn in virtual coords by the creatures);
  `handleComCall` (resolution); unit # rolled from the weighted `DATA_UNITS_FULL` pool.
- **Art:** placeholder is a **procedural** retro diving bell (dome + porthole + blinking COM
  light + lift cable). Drop a PNG at **`files/assets/diving_bell.png`** (the `COM_CALL.sprite`
  path) and it's used automatically — a 404 until then is expected and handled silently.
- **SFX placeholders:** incoming = `spawn`, logged = `salvage` (dedicated COM cues TBD).
- **Tuning (2026-06-27):** real bell art keyed in (`files/assets/diving_bell.png`, alpha-cut
  from Andrew's render; `spriteSize` aspect-matched). Statements **simplified** to terse calls
  with exactly **two required keywords = 1 noun + 1 verb** (e.g. "Stopped by a train" →
  `train|stopped`) so a two-word answer always clears; CSV + embedded fallback updated. Bubble
  reworked so the **unit number is the dominant element** (32 px white w/ green glow vs the small
  `COM` tag).
- **Verified:** `node --check` clean on all three files; standalone node test of the parse +
  match (14 calls parse with quoted/comma statements; loose any-order/case match; `COMMS`/`ENR`
  correctly excluded; 0 statements fail their own keywords). **Not yet eyeballed in-browser** —
  the rise/bob/bubble look + the 18–38 s cadence are first-pass and CSV/config-tunable (preview
  rAF is paused here; see [[headless-playtest-pump]] to drive it, or open it in a real tab).

> 📌 **Preserved game design.** These notes used to live in `CLAUDE.md`. They were
> moved here on 2026-06-03 so that, while the project is on hold, opening this folder
> in Claude Code no longer forces the deep-sea theme onto unrelated work.
> **To resume the game, just tell Claude: "read AQUANAUT_DESIGN.md, we're working on the Aquanaut again."**

## Project Overview
Deep-sea saturation diver typing defense game. Forked from "Asteroid Command" (EMS dispatcher training game). Same engine: plain HTML/CSS/JS, Canvas, SVG, Web Audio API. No build system.

## Architecture
- **Entry point:** `Asteroid Command.html` → boot sequence → redirects to `files/index.html`
- **Virtual coordinate system:** 1600×900, scaled to canvas
- **Core files:**
  - `files/script.js` — main game logic (~6,036 lines)
  - `files/style.css` — all styling (~1,901 lines)
  - `files/index.html` — HUD, overlays, menus (~306 lines)
  - `files/core/config.js` — game constants, scoring, tiers, tether physics (~142 lines)
  - `files/core/data.js` — CSV loading, challenge generation, tier management (~605 lines)
  - `files/core/audio.js` — Web Audio SFX + music playback (~645 lines)
- **Data (CSV-driven):**
  - `files/datasets/commands.csv` — challenge text templates
  - `files/datasets/progression.csv` — 8-tier difficulty curve
  - `files/datasets/scoring.csv` — scoring rules & multipliers
  - `files/datasets/bases.csv` — location names (to be re-themed)
  - `files/datasets/units.csv` — unit codes (to be re-themed)
  - `files/datasets/scores.csv` — leaderboard storage
- **Assets:** `files/assets/` — sprites for zones, asteroids, freighters, spaceships

## Tech Constraints
- No frameworks, no build system — plain browser JS
- Single-page cartridge (index.html entry point)
- Parent arcade at `../arcade.html`
- All game logic in virtual coordinate space (1600×900)
- Option D data: pluggable CSVs, engine-agnostic to challenge domain

## Re-theming: Space → Deep Ocean
| Asteroid Command | The Aquanaut |
|---|---|
| Asteroids | Sea creatures (jellyfish, sea spiders, gulper eels, kraken tentacles, anglerfish) |
| 4 defense zones (towers/dams) | 4 hose bundle segments (Regulator/Comms/Hot Water/Pneumo) |
| Shield dome | Dive bell hull integrity |
| Radio tower | Dive bell |
| Tractor beam/tether | Sonar tether (heavier physics) |
| Ambulance (NanoMedic) | Nanomedic ROV (attackable) |
| N/A | Rescue mini-sub (salvage point economy) |
| N/A | Bioluminescent visibility cone |
| N/A | Creature latching behavior |
| Straight-line asteroid fall | Creature movement archetypes (drift, zig-zag, lunge, sweep, stealth) |
| Space background | Depth-based darkening background |

## Key Systems in script.js (line ranges)
- Assets loading: 8-116
- State management: 127-199
- Initialization: 204-916
- Resize/scaling: 917-975
- Dev/Holodeck mode: 980-1164
- Defense system (zones, shield, cracks): 1169-1362
- Ricochet system: 1366-1424
- Asteroid system (spawn, physics, collision): 1429-1522
- Projectile system: 1620-1676
- Input/command handling: 1679-1819
- Scoring pipeline: 1825-1966
- HUD/status display: 1977-2207
- Ambulance system: 2210-2340
- Holodeck features: 2353-2632
- Visual systems (VFX, particles): 2634-3815
- Game loop & update: 3815-4138
- Rendering: 4139-5410
- Game flow (pause, start, game over): 5410-5559
- Boot sequence: 5560-6036

## Workflow
- Run locally by opening `Asteroid Command.html` in a browser (no server needed, but CSV loading needs http for fetch)
- God Mode / Holodeck accessible via password prompts in-game
- CSV live reload supported in God Mode

# HANDOFF → Claude Code (new session)
## The Aquanaut — creature/kill-screen work complete; next: better movement

**Read first:** [`AQUANAUT_DESIGN.md`](AQUANAUT_DESIGN.md) (full dated changelog — source of
truth). All code is in `files/` (`script.js`, `core/config.js`, `style.css`, `index.html`).
Run via `Start Dev Server.bat` (CSV loading needs `http://`, not `file://`).

---

### What got built last session (all verified — see caveat)

1. **Kill-screen system — one plate, two cinematics.** Both run on
   `assets/Kill Screen/kill_screen_POV.png` (Gemini watermark inpainted out). Region config =
   `KILL_SCREEN` in `config.js` (faceplate / side-ports / panel rects, all fractions of the
   plate). Core→Theme interface = `buildDeathEvent()` → `{cause, creature, hoses_lost}`.
   - **CRUSH** (all 3 hoses gone): plate void + spiderweb cracks + red-strobing panels +
     `CRUSHED`. Migrated from `triggerAbyssDeath`.
   - **CREATURE** (diver killed): generic `front_closed` lurk → side-port glimpse →
     `front_open` strike → cracks (shark/moray) or slime (jelly) → `CRUNCH/SNAP/STUNG`.
     Rebuilt `triggerKillCam`/`updateKillCam`/`drawKillCam`; helpers
     `drawKillScreenCreature` / `drawKillScreenGlimpse` / `drawSlimeSmear`. Front frames in
     `assets/Kill Screen/` keyed by `KILL_SCREEN.creatures`.

2. **Diver-attack alarm.** The suit-latch is now a single **3-second** flashing window showing
   the **exact command** (`#grapple-command`); type it = survive (suit refills), timeout =
   creature kill screen. Replaced the cumulative 5-block suit drain. Placeholder SFX
   `diverAlarm` added to `core/audio.js` + the SFX bench (`sfx-test.html`).

3. **Tier-1 swim-sprite migration.** New single profile sprites wired
   (`target_greatwhite_profile_ht` / `target_moray_profile_ht` / `target_boxjellyfish_drift`);
   **barracuda fully retired → moray** (real spawned enemy now, eel-weave `swimAnim`, own
   kill + game-over screen). 9 old PNGs deleted. `spriteSize` aspect-corrected —
   **first-pass values, eyeball in real play.**

4. **Dead-code sweep.** Removed ~345 lines of orphaned old kill-cam helpers (`drawKC*`,
   `drawJaws`, `drawKCSprite`, `killCamSpriteFor`, `jawCloseAmount`, `KILLCAM_IRIS`). **Kept**
   the procedural vector-creature library (`drawGreatWhite` / `drawJellyfish` /
   `drawAnglerfish` / `drawGulperEel` / `drawKrakenTentacle` / etc.) — still wired via the
   `bodyStyle` switch and ready-made for the future deep roster.

5. **Flipbook animation engine (built, dormant).** Generic ping-pong frame cycler
   `spriteFrameIndex()` (theme-agnostic; timing via `CREATURE_TYPES.animFps`, per-creature
   phase off `animPhase`) + **centroid auto-align** (`SPRITE_BBOX` computed at load so
   AI-pose frames don't jump). `drawGreenscreenCreature` now cycles the `CREATURE_SPRITES`
   pool instead of random-pick-once. Activates per creature when pose frames are added;
   flipbook for **moray** (`animFps 5`) / **great white** (`animFps 3`), **jelly stays
   procedural**. Spec: [`Aquanaut_Tier1_AssetPack.md`](files/assets/Aquanaut_Tier1_AssetPack.md) §7.

---

### ⚠️ Verification caveat (important)

Everything was verified by **offscreen pixel-sampling + `node --check` + clean-load checks**.
The Claude Code preview runs **headless with a 0×0 viewport** — so **nothing was watched in
motion, played to death, or screenshotted live.** A first real-play pass should confirm:
kill-screen + diver-alarm **timing/feel**, creature **on-screen sizes**, and that the
cinematics read right end to end.

---

### Governance status (not blocking)

The hose/diver attack model was resolved by Andrew's reframing — **hoses = Zone Impact, diver
= Player Impact** — recorded as **cartridge-layer authorized** in `AQUANAUT_DESIGN.md` (same
precedent as the call-lifecycle layer). A ready-to-paste Overview clause sits in
[`Aquanaut_Impact_Clause_PROPOSAL.md`](Aquanaut_Impact_Clause_PROPOSAL.md); **not yet pasted**
into the canonical `(PCL)/Documents/Core Documents/2. Overview`. The Laws / Overview / Build
Procedure docs live in `(PCL)/Documents/Core Documents/`.

---

### Open items (Andrew)

- **Art:** generate moray + great-white pose frames — **img2img / edit the existing frame**,
  don't regenerate from scratch (surface shimmer) — named `target_<creature>_profile_1/2/3_ht.png`
  in `Tier 1/Targets/`. Flipbook then lights up (list the frames in that creature's
  `CREATURE_SPRITES` array). See Asset Pack §7.
- **SFX pass:** swap the placeholder `diverAlarm`; add inside-suit ambience / breathing.
- **Eyeball pass:** creature display sizes + kill-screen/alarm timing in a real dive.
- Optionally paste the Impact clause into the canonical Overview.

---

### Next up: "better movement"

Where movement lives today, for the next session to build on:

- **`updateCreatureMovement(creature, dt)`** (`script.js`) — behavior archetypes
  (`drift / zigzag / lunge / sweep / stealth`), facing accumulator + hysteresis,
  pitch-into-travel, bubble wake. Driven by `CREATURE_TYPES[].archetype` + `speedMult` and
  `TIERS[].speedMin/Max`.
- **`applyCreatureSwim(...)`** — the visual swim flourish (shark surge, moray weave, jelly
  pulse), shared by the single-sprite and rig paths.
- **Dormant upgrade path:** the multi-part rig (`CREATURE_RIGS` / `drawRiggedCreature` /
  `animateRigPart`, "Option B") for separable tail/jaw/bell motion — built, needs parts art.
  Contract: [`Aquanaut_Creature_Asset_Contract.md`](files/assets/Aquanaut_Creature_Asset_Contract.md).
- **Just-built:** the flipbook cycler (pose-driven motion).

Likely threads: smarter per-archetype pathing/behavior, coupling animation to actual swim
speed (flipbook fps / tail-beat ↔ velocity), and depth/zone-aware movement. Keep movement
**cartridge-side; core stays theme-agnostic** (standing Laws constraint, Build Procedure §9).

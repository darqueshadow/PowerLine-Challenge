# Asteroid Command — Full Cartridge Audit

**Date:** 2026-09-11
**Run by:** Claude Code (Systems Integrator)
**Requested by:** Claude Chat (Senior Dev)
**Audited against:** Laws v1.6, Overview v1.6, Build Procedure v1.6, PCL Technical Manual §D/§E/§G/§H
**Status:** Investigation only. **No file in the cartridge was modified.** Nothing here is fixed;
nothing here is scheduled. Awaiting Andrew's sign-off before any implementation work.

---

## Before the findings: three facts that reframe them

**1. The canon being audited is about to be replaced.** The live `1. Laws.md` on disk is already
v2.0, marked *"Authored, decisions ratified — pending canon drop,"* and it states that v1.6 remains
in force until Andrew drops it into Project Knowledge. So auditing against v1.6 was correct. But
v2.0 explicitly **retires** the dual naming convention for impact logic, which is check item 3 of
the brief. Several findings below exist only because v1.6 still requires something v2.0 deletes.
Those are marked. **Do not spend effort conforming to a clause that is already scheduled to die.**

**2. There is no shared core engine, anywhere in the repo.** Build Procedure §3 specifies six
theme-agnostic core modules. `Game/core/` contains `main-menu.js` and `submenu.js` — hub menu code
only. `engine.js`, `hud.js` and `ui.js` **were never written**; that logic lives inside Asteroid's
7,267-line `files/script.js`. `config.js`, `data.js` and `audio.js` exist only as per-cartridge
copies. The Aquanaut has its own set. So "the cartridge duplicates core logic instead of importing
it" is a **system-wide architectural fact, not an Asteroid defect**, and it is the root cause of a
large share of what follows.

**3. The Empty Cartridge cannot serve as the baseline the Laws assume.** `Game/blank/` is a single
1,285-line `index.html` with everything inline and no dataset. "Asteroid was duplicated from the
Empty Cartridge with core logic preserved" is therefore not a checkable proposition. Any finding
of the form "this diverges from the Empty Cartridge" would be meaningless, so none were raised.

---

## How this was run

Thirteen parallel audit dimensions swept the cartridge read-only, each with the full canon text
supplied inline. **Every** finding was then put through three independent adversarial verifiers,
each instructed to knock it down from a different angle: *code truth* (re-read the cited lines —
is the evidence real?), *canon truth* (does the cited rule actually say that?), and *already
handled* (is there a guard, fallback or documented decision that neutralises it?). A finding
survived only if fewer than two of three verifiers refuted it. Three completeness critics then
named what the sweep had missed, and a second round chased each of those.

| | |
|---|---|
| Agents | 382 (377 completed, 5 failed) |
| Raw findings | 117 |
| Refuted and discarded | 13 |
| **Survived verification** | **104** — 66 broken, 38 decisions |
| Round 2 (critic-driven) | 15 gaps chased → 29 further findings |

**Confidence tiers.** `CONFIRMED` = all three verifiers independently confirmed it.
`PLAUSIBLE` = it survived, but not unanimously — usually the code is agreed and the *canon reading*
or *severity* is contested. Treat PLAUSIBLE as "real, but argue the framing before acting."

**Three findings I re-verified personally** before signing this report, because they are the most
consequential CONFIRMED claims: the launcher storage scrub, the discarded `scoring.csv`, and the
score-before-removal window. All three hold exactly as described.

### Coverage limits — read this before trusting the absence of a finding

- **Five verification agents died on API safeguard errors** (`verify:pairing:canon`,
  `core-leak:mitigated`, `hardcoded-data:canon`, `structure:canon`, `dead-code:mitigated`). Those
  findings were judged on two votes instead of three and **cannot reach CONFIRMED tier** regardless
  of merit. A `PLAUSIBLE` in those dimensions may be stronger than its label.
- **This is a static audit.** Nothing was run in a browser. Every runtime claim is derived from
  reading code, not from observing a play session. The frame-rate findings in particular deserve
  a real 144 Hz test before anyone acts on them.
- **Not checked at all:** the Holodeck's audio voice set in practice, the boot sequence beyond its
  timing constants, visual/art quality, difficulty balance, and whether the game is *fun*. None of
  that was in scope.

---

## The headline

If nothing else in this document gets read, read these. All are deduplicated across dimensions.

1. **A target can be scored twice, and a target you were already paid for can still destroy a
   base.** Points, streak and combo are awarded the instant Enter is pressed
   (`files/script.js:2008`), but the target is not removed until the cosmetic projectile physically
   reaches it (`files/script.js:4969`) — up to about a second later. Nothing marks it as already
   dealt with in between, so it remains a valid answer *and* a live threat. **This is the single
   most serious defect found.** `CONFIRMED`

2. **Launching the game deletes your high scores.** The launcher wipes local storage on every open
   and preserves a list of five key names — `highScore`, `bestScore`, `progression`, `careerRank`,
   `asteroidCommand_` — **not one of which this game has ever written**. The three keys it does
   write (the top-100 table, the saved difficulty, the manual-seen flag) all fail the match and are
   deleted every single launch. The comment above the list says "Preserves high scores and
   progression." It has never done so. It also erases the sibling cartridge's scores.
   `Asteroid Command.html:75` · `CONFIRMED`

3. **The entire scoring spreadsheet is read and thrown away.** `scoring.csv` line 1 is the
   decorative banner `SCORING SYSTEM,,,,,`, so the parser takes that as the header row; every real
   row then reads as nameless and hits the "skip headers" guard. All 57 rows are discarded and
   roughly sixty lines of scoring-override code are dead. Every number Andrew has tuned in that
   sheet — perfect-shot multiplier, early-intercept, speed-demon, key-dust penalties — has never
   once reached the game. `files/core/data.js:232` · `CONFIRMED`

4. **The SCORING & PROGRESSION menu page is stale for seven of the eight ranks.** It is a
   hand-typed table baked into the HTML; the real numbers moved to `progression.csv` and this page
   was never rewired. The DIFFICULTY screen beside it reads the live data, so the two pages
   contradict each other. `files/index.html:241` · `CONFIRMED`

5. **There is no player-facing dataset / Challenge Set menu** — a thing canon requires every
   cartridge to have. Difficulty selection is fully built; dataset selection exists only behind the
   Holodeck password, and the code honouring it is inside a Holodeck-only branch, so it does nothing
   in a normal game. `files/index.html:181` · `CONFIRMED`

6. **The tower repair lockout compounds without limit.** Every further rock landing on the already-
   destroyed tower re-enters the destroy routine: it doubles the repair delay *again* and discards
   the ambulance already inbound, restarting the countdown — 4, 8, 16, 32, 64, 128 seconds, no
   ceiling, no mid-run reset. Since the shield never regenerates, a long run reaches minutes with no
   gun. The ETA shown to the player becomes a lie. `files/script.js:1575` · This is the origin of
   the curve the Aquanaut inherited.

7. **During the repair wait, a correct command does nothing at all** — no points, no target
   removed, no message, no sound. A *wrong* command in the same window still deducts 50 and says so.
   The player is given no way to tell the difference between "right answer, ignored" and "nothing
   registered." `files/script.js:2007`

8. **Gameplay music dies permanently after the second track.** The routine that queues the next
   track erases the very list it reads from, so the third hand-off finds an empty list and stops.
   Menu, title, high-score and region-lost music are unaffected. `files/core/audio.js:583`

9. **Developer Mode is a scoring cheat, not a test harness.** The Ctrl+Shift+B / DISPATCH unlock
   installs a branch *before* command validation: while it is on, pressing Enter destroys the oldest
   target for full rank points no matter what is in the box — **including an empty box**. Canon says
   Developer Mode exists to expose the test-only Blank Dataset; that has no implementation here.
   Worse, those scores submit to the permanent top-100 table through the same door as honest runs,
   with nothing in the stored row marking them. `files/script.js:1980`, `:509`

10. **Two unbounded growth loops.** Destroyed Robin Hood Flour lays down ground patches at roughly
    4.5/second forever with an explicit "no cap" comment, and every patch is redrawn from scratch
    every frame. Destroyed Skylon ejects bugs forever; any that land outside the gorge are flagged
    settled and never removed. Both degrade a long run steadily and permanently.
    `files/script.js:3934`, `:3837`

11. **Every high score is recorded as "DISPATCHER".** The CAT login terminal that collects the
    player's name and OASIS number is complete in markup, styling and code — but the only button
    that opens it ships hard-hidden and nothing ever un-hides it. The name is hard-defaulted, so the
    leaderboard fills with identical rows. `files/script.js:341`

12. **Restarting from the pause menu runs two animation loops forever.** `resume()` and `start()`
    each kick off their own `requestAnimationFrame` loop and nothing cancels the first, so from that
    moment everything not scaled by elapsed time advances twice per frame. `files/script.js:299`

---

## Part 1 — Verified broken items

66 items survived verification as defects. They cluster into eight groups. Full itemisation with
evidence is in **Appendix A**; this section is the map.

### 1A. Target lifecycle and scoring (5 items)
The score-before-removal window (headline 1) is the core of it. Alongside it: clearing a target
zeroes the *global* spawn timer, so the better a player clears the more the game slows down and the
rank's promised target count is never reached; the comeback bonus swallows the rest of that kill's
readout, including one-time perfect-streak announcements; and the difficulty screen advertises a
per-rank IMPACT penalty that the scoring sheet marks retired and the impact path never applies.

### 1B. The repair / lockout system (6 items)
Headlines 6 and 7, plus: the repair unit's flight is stepped **per frame rather than per elapsed
time**, so the lockout is roughly 8s at 60 Hz but doubles at 144 Hz and triples at 240 Hz — the
faster the monitor, the longer the gun is down. The whole fly-in/fly-out animation gates spawning
and command acceptance, so a piece of scenery animation decides how long the round is frozen. The
pending repair timer survives game-over and quit, firing into a finished run.

### 1C. Exit paths that leak state (8 items)
The cartridge has four ways out of a run — quit, restart, game over, and the pause menu — and they
tear down different things. Quit from pause leaves the broken-radio static playing onto the main
menu permanently; leaves `CONFIG.isHolodeck` true, silencing main-menu music; and leaves the
10-second game-over timer armed, so the game-over screen erupts over the main menu. The two HUD
readout queues live outside game state and are never emptied, so one run's messages type into the
next run's HUD. God Mode's RANK OVERRIDE is never cleared and is read without a Holodeck guard, so
it hijacks every subsequent normal game for the rest of the page load.

### 1D. Config is not authoritative (7 items)
`core/config.js` presents itself as the tuning surface and largely is not. `ambulanceSpeed: 400` is
dead — the real value is `500`, typed inside `updateAmbulance()`; the generated manual then publishes
400 as the movement speed. Shield strength is the literal `9` in the engine with the 6/3/0 HUD
boundaries re-typed in four more places. Asteroid fall speed is three bare literals in
`spawnAsteroid`, and the rank speed multiplier is applied **twice**, so it acts squared. `zoneHeight`,
`shieldRegenStreak` and a whole `LAYOUT` block are read by nothing — and the dead LAYOUT slot was
inherited wholesale by the Aquanaut.

### 1E. The data pipeline (9 items)
Headline 3 is the worst of it. Also: the duplicate-suppression memory is wiped twice over — every
400 challenges, and again whenever 25 attempts fail to find something new, in which case it hands
back the repeat it just rejected. The pool is 23,584 combinations, so the 400 cap fires at under 2%
of it. The Holodeck's dataset-reload parser is a hand-copied duplicate that has **already** lost the
Difficulty column. A `Weight` of `0` silently becomes `5`, so no row can be switched off. Blank rows
in `commands.csv`/`bases.csv` produce commands with a stray space that can never be matched.
`BASE_LOOKUP` is rebuilt in three places and read nowhere.

### 1F. Frame-rate dependence (5 items)
A recurring shape: the main loop is `dt`-scaled, but five subsystems inside it step per frame —
the repair unit, the environmental particle system, the Challenge-label spring physics, and the boot
glitch tail (counted in frames but commented in milliseconds, so it runs 2.4× fast at 144 Hz).

### 1G. Dead and unreachable code (9 items)
The CAT login terminal (headline 11). `drawDefenseZones` — 152 lines of collision overlay, never
called. The asset-load counter is write-only and its hardcoded freighter count says 13 when 12 exist.
Four game-over stat counters are incremented all game and never displayed. `state.devModeUnlocked`
is written once and never read. The `lcarsButton` sound exists only in the holodeck voice set while
all three of its triggers run in standard mode, so it is silent 100% of the time. Eleven tracked
files are referenced by nothing.

### 1H. Menus, HUD and failure handling (7 items)
While paused, **any ordinary keystroke presses the highlighted pause button** — including RESTART
MISSION and QUIT TO MENU, with no confirmation — because pause drops focus out of the command box
and nothing filters what is left. The "nothing selected yet" check matches a stale highlight class on
a hidden main-menu button, so the menu can arm a button while showing no highlight at all. Accuracy %
— a HUD field the build spec names and the Empty Cartridge implements — is not merely unrendered but
**uncomputable**: no attempt or miss tally is kept anywhere. And if any of the five core CSVs fails
to parse, the promise rejects, the handler writes one console line, and the function registering every
listener never runs — leaving a normal-looking title screen where nothing responds.

---

## Part 2 — Decision items

38 items work as built but need Andrew's call. **I have not resolved any of them.** Full
itemisation in **Appendix B**; the ones that need a decision soonest:

**D1 — The command has no verb, and the canon's own example would be rejected.** Canon's formula is
`[Command PL] [Unit] [Verb] [Base Number]` with the worked example `AP 2101 to 72103`. The game
builds and accepts `AP 2101 72103`. Matching is exact, so the example printed in the governance
document would be scored as a miss. Related: the Challenge string never carries the unit either —
the phrase goes in the speech bubble and the bare unit number is stamped on the rock. Everything the
player needs is on screen and the pairing is correct, but neither string matches the written shape.
*Options: change the game to match the doc; change the doc to match eleven months of shipped
gameplay and muscle memory; or declare the formula a description of content, not of string layout.*

**D2 — Dual naming (v1.6 Core Law 6) is honoured in prose only, and v2.0 retires it anyway.** The
convention is followed carefully for the asteroid-hits-a-base case, but only in comments and
on-screen message text. There is no impact type in code — no enum, no event name, no field. Two
other impact relationships exist and are unnamed. The scoring page calls the zone-hit event "Zone
Impact," which under the rule means the zone *caused* it. *Since v2.0 deletes this clause, the real
question is whether to conform to a dying rule or wait for the drop.*

**D3 — Both developer passwords ship in cleartext on the public site.** They are plain strings in
`core/config.js`, which the browser must download to run the game. The deploy fix I shipped
separately strips docs and workbooks, but it **cannot** strip `config.js`. *Options: accept it (the
stakes are a demo cheat mode); move the gate somewhere unpublished; or drop the pretence and make
dev mode a URL flag.*

**D4 — The Excel master has drifted four months from the shipped CSVs.** The workbook still carries
37 retired units, is missing the Prince Charles base entirely, has twelve unit weights at different
values, lacks the three newest progression columns, and spells one unit `MHRT` where the CSV says
`MRHT`. **Re-exporting it would revert live data.** The CSVs have been the real source of truth since
roughly May. *Options: regenerate the workbook from the CSVs and keep it downstream; retire it; or
reconcile by hand.* This one has a deadline attached — it breaks the first time Andrew edits Excel.

**D5 — There is no way back to the Arcade hub from inside the cartridge.** QUIT TO MENU and MAIN
MENU both mean the cartridge's own menu. The only exit is the browser Back button.

**D6 — Cheat runs enter the permanent leaderboard unmarked.** The end screen shows `MODE: BETA` to
the player, but that fact is dropped when the row is written.

**D7 — No Demo/Publish mode exists at all.** Three governance clauses hang off that distinction. The
cartridge has no flag, no build switch; the word "publish" does not appear. The Holodeck password
string is the only gate.

**D8 — The theme has leaked into the files named "core."** `core/config.js` is mostly Asteroid theme
data — satellite geometry keyed to one specific SVG, a palette keyed to the six asteroid filenames by
their order on disk. The dataset's own column is literally named `Asteroid Radius` and `core/data.js`
hardwires that string, so **the target-size knob for every future cartridge is named after this
game's theme** — the Aquanaut already inherited it. Given fact 2 above, this is an architectural
decision, not a bug to fix in place.

**D9 — The silhouette glow has one implementation and no fallback.** Canon mandates contour-following
glow. It is produced by a single unguarded `ctx.filter` drop-shadow — the one canvas feature not
universally supported. On a browser that ignores it, the line still runs and the glow silently
vanishes.

---

## Part 3 — What was refuted

Thirteen findings were killed by verification and are recorded in **Appendix C** so nobody re-raises
them. Several are instructive: the claim that `F12` defeats typing-accuracy scoring died because
there is no accuracy scoring to defeat; the claim that the folder layout violates canon died because
canon offers two incompatible layouts and this matches neither exactly but violates neither; and two
separate claims that `howtoplay.js` is theme content misfiled in `core/` were refuted on the grounds
that the whole `core/` folder is cartridge-local anyway.

---

## Recommended order, if and when this is actioned

Not a schedule — a dependency order. Andrew's call whether any of it happens.

1. **Stop the data loss first.** The launcher scrub (headline 2) destroys player data on every
   launch and is a five-line fix.
2. **Then the scoring truth.** The discarded `scoring.csv` (3) and the score-before-removal window
   (1) mean the game is not scoring the way any document says it does.
3. **Then the lockout compounding** (6, 7) — it is the difference between a hard run and an
   unplayable one.
4. **Then the exit-path leaks as one pass** (1C) — they share a root cause: four teardown paths that
   were never reconciled. Fixing them individually will miss some.
5. **Decisions D1, D4 and D8 before any refactor**, because each changes what "correct" means for the
   work above.

---

# Appendices — itemised findings

Auto-generated from the audit run so every item carries its exact file, line and evidence.
Duplicates across dimensions are preserved deliberately: where two agents found the same
defect from different angles, both entries are kept so the independent corroboration is
visible. Sorted by severity, then confidence.

---

## Appendix A — Verified broken items (66)

Defects. Each survived three adversarial verifiers. No fix has been applied to any of them.

### A1. SCORING & PROGRESSION page hardcodes a rank table that is stale for 7 of the 8 ranks

`files/index.html:241` · **HIGH** · CONFIRMED · *Technical Manual sD ("The Data Sheet is the SINGLE SOURCE OF TRUTH"); Laws v1.6 Core Law 5 (maintain dataset integrity; all data pools must match Overview specs)*

**What:** The SCORING & PROGRESSION menu page is a hand-typed table baked into the HTML. Every rank except Trainee shows the wrong points-per-kill and the wrong impact penalty, because the real numbers moved into progression.csv and this page was never rewired to read them. The DIFFICULTY screen right next to it reads the live numbers, so the two menus disagree with each other.

**So what:** A player reading SCORING & PROGRESSION is told a Veteran clean kill is worth 1,000 when it is worth 850, and an O.A.S kill 1,000 when it is 1,200. Any future retune of progression.csv silently widens the gap, and the two menu screens will keep contradicting each other in front of the player.

<sub>Evidence: files/index.html:226,235,241-248 (static markup, never populated from data — script.js only toggles the page's visibility at 542/548): 226: <span>Base Hit:</span><span>Rank-based (100 — 1,000)</span> 235: <span>Zone Impact:</span><span>Rank penalty (-50 to -750)</span> 242: <span>2,001 — 5,000:</span><span>MENTORING (100 / -50)</span> 243: <span>5,001 — 10,000:</span><span>SIGNED OFF (250 / -150)</span> 244: <span>10…</sub>

### A2. A hit is paid at the keystroke but the target is only removed when the shot lands, and nothing marks it as already dealt with

`files/script.js:2008` · **HIGH** · CONFIRMED · *Laws v1.6 s0.7 Clear (Hit) — Target correctly removed due to valid Command input; s0.9 Impact; Technical Manual sE three outcomes*

**What:** Points are awarded the moment the player presses Enter, but the target is not taken off the board until the shot physically reaches it. In between, the target is still a valid answer, so the same target can be scored twice, and the same target can also still reach the ground and destroy the base after already being paid for. One target can therefore produce both a clean-kill payout and a base loss, or two clean-kill payouts.

**So what:** Score can be farmed by typing the same command twice quickly, and a target the player legitimately cleared can still cost them a base, their kill streak and a consecutive-base penalty. This is also why the top-rank shot-speed problem is so visible — the two faults compound. It happens naturally, not just under abuse: whenever two on-screen targets carry the same command (getTargetSpecs in core/data.js:718-724 only tracks session history and clears its set, it never checks what is currently on screen), typing that command twice pays the first target twice and never even aims at the second.

<sub>Evidence: script.js:2005-2016 (handleCommand) — score is applied at input time: 2005: const match = state.asteroids.find(a => a.command.toUpperCase() === input); 2007: if (match) { 2008: if (fireProjectile(match)) { 2009: state.streak++; ... 2015: const pts = calcScore(match, bs); 2016: applyScore(pts.total); The target is not removed here. Removal happens later, in update(), when the projectile arrives: 4969: state.asteroids …</sub>

### A3. No player-facing Challenge Set / dataset selection menu — the only one is behind the Holodeck password

`files/index.html:181` · **HIGH** · CONFIRMED · *Overview v1.6 Cartridge requirements + Technical Manual sH — a dedicated menu for difficulty AND dataset (Challenge Set) selection; Laws v1.6 0.11 Challenge Set loaded per user selection*

**What:** Difficulty selection is fully built, but dataset selection is not. Choosing which command types are in play exists only on the developer screen reached through the Holodeck password, and the code that honours that choice is wrapped in a Holodeck-only branch, so it does nothing in a normal game. A regular player has no way to drill only AP, or only the ENP/LA pair.

**So what:** The cartridge cannot be used for targeted training, which is the stated point of Challenge Sets — every run always draws from all four command types. It is also the one canon-required cartridge menu that is absent, so the cartridge is structurally incomplete rather than merely divergent.

<sub>Evidence: index.html:181-191 — the whole player main menu: BEGIN MISSION, HOW TO PLAY, DIFFICULTY, SCORING & PROGRESSION, SETTINGS, HIGH SCORES, CHANGE DISPATCHER. No dataset / Challenge Set entry. index.html:296-324 — `<div id="difficulty-page" class="menu-page hidden">` ... `<span class="diff-select-label">START AT</span>` — difficulty selection exists and is complete. The only Challenge Set picker is built inside God Mode: …</sub>

### A4. Repair-unit flight is frame-rate dependent: the tower lockout doubles on a 144 Hz display, triples at 240 Hz

`files/script.js:3132` · **HIGH** · CONFIRMED · *Build Procedure v1.6 s3.3 (core loop / difficulty timing must be engine behaviour, not display behaviour); Laws v1.6 0.9 Impact behaviour must follow engine rules*

**What:** The NanoMedic's flight speed is tied to how many frames per second the machine draws, not to elapsed time. The damping that slows it down is applied once per frame instead of being scaled by the time step, so the faster the monitor, the slower the ambulance flies. On a 60 Hz screen the tower is down for about 8 seconds; on a 144 Hz screen the same repair takes about 15.5 seconds; on a 240 Hz screen about 24 seconds. This is the same defect shape ruled on in the sibling cartridge, and this is where the code originates.

**So what:** A player on a modern high-refresh monitor is punished with roughly double to triple the intended tower-down penalty, during which no asteroids spawn and no commands can be fired. The 4s/8s/16s/32s ladder is only part of the wait — the flight time on top of it is silently a display-hardware setting. Two players on the same difficulty get materially different punishments, so leaderboard scores are not comparable across machines.

<sub>Evidence: files/script.js:3129-3156 (updateAmbulance): 3130 const maxSpeed = 500; 3131 const seekForce = 3.5; // how hard it steers toward target 3132 const damping = 0.92; // velocity damping per frame 3133 const arrivalRadius = 12; // snap-to-target distance ... 3141 amb.vx += (dx / (dist || 1)) * seekForce * maxSpeed * dt; 3148 amb.vx *= damping; 3155 amb.x += amb.vx * dt; The acceleration is dt-scaled but the damping is ap…</sub>

### A5. Flour ground snow grows without cap or removal at ~4.5 patches/second and every patch is redrawn every frame

`files/script.js:3934` · **HIGH** · CONFIRMED · *none - health issue*

**What:** When Robin Hood Flour is destroyed it starts laying down flour patches and snowbanks on the ground at a fixed chance every frame, and the code comment says explicitly that this accumulates with no cap. Nothing ever removes a patch, and every patch is redrawn from scratch every frame — a snowbank costs two shape outlines and two fills. The rate works out to about four and a half new patches a second on a 60 Hz display and nearly eleven a second on a 144 Hz one. The ice-over effect sitting five lines below it in the same block is capped at 200, so the difference is not a house style, it is an omission. This is the same class as the Skylon bug list but roughly four times the rate.

**So what:** Ten minutes of play after losing Robin Hood puts ~2,700 patches in the draw list at 60 Hz (~6,500 at 144 Hz), each one costing multiple canvas path operations every single frame. That is the dominant per-frame cost in the aftermath renderer and it will visibly drag frame time down on modest hardware — and because fire, smoke and ember motion is stepped per frame rather than per second (same function, line 4008), the degrading frame rate also makes the surviving zones' fire plumes slow down, so the symptom compounds instead of staying confined to one zone.

<sub>Evidence: Two uncapped per-frame spawners, with the comment stating the intent outright: 3933: // Flour ground snow patches — accumulate continuously, no cap 3934: if (Math.random() < 0.06) { 3936: state.flourGround.push({ ... isBank: false }); ... 3945: if (Math.random() < 0.015) { 3946: state.flourGround.push({ ... isBank: true }); Combined 7.5% per frame = ~4.5 patches/second at 60 Hz, ~10.8/s at 144 Hz, for as long as Robi…</sub>

### A6. The launcher's storage scrub keeps nothing the game actually saves — leaderboard, saved difficulty and the sibling cartridge's scores are all erased

`Asteroid Command.html:75` · **HIGH** · CONFIRMED · *none - health issue (silent data loss; the code does the opposite of what the comment directly above it promises)*

**What:** The launcher file wipes saved browser data on every launch and keeps a short list of keys it means to spare. Not one name on that list is a key this game ever writes — they are leftovers from an older build. So opening the game through that file deletes the high score table, the remembered difficulty rank, and the flag that stops HOW TO PLAY re-opening on its own. Saved data lives per website, not per folder, so it also deletes the Aquanaut's Dive Log, the Aquanaut's command-card position, and the emulator's settings at the same time. The comment right above the code says it preserves high scores and progression, so a reader would never suspect it. The Aquanaut's launcher had this same bug and it was fixed there — that fix note even lists Asteroid's two keys as casualties. Asteroid's copy was never fixed.

**So what:** A player who double-clicks "Asteroid Command.html" — the entry point the offline rebuild script tells them to use (Rebuild Offline Data.bat:15: 'Done. Double-click "Asteroid Command.html" to play.') — loses the entire top-100 leaderboard and is silently reset to TRAINEE, with no warning and no recovery. SUBMIT SCORE and the HIGH SCORES page therefore look like working features within a session and are provably never persistent across that entry point. It also destroys the Aquanaut's leaderboard, so a bug report will arrive against the wrong cartridge. A future edit that adds any new saved setting inherits the same deletion for free, because the keep-list can never match anything.

<sub>Evidence: 'Asteroid Command.html':73-86 — 73 // ── Clear browser cache on every launch ─────────────────────────── 74 // Carried over from the old launcher. Preserves high scores and progression. 75 var PRESERVE_KEYS = ['highScore', 'bestScore', 'progression', 'careerRank', 'asteroidCommand_']; 76 function shouldPreserve(key) { 77 return PRESERVE_KEYS.some(function (k) { return key.startsWith(k) || key.includes(k); }); 78 } ..…</sub>

### A7. Pause-menu QUIT never calls disableMusicStatic, so broken-radio static follows the player onto the main menu permanently

`files/script.js:303` · **HIGH** · CONFIRMED · *none - health issue (adjacent: Technical Manual sH / Overview v1.6 cartridge requirements, separate menu and gameplay music)*

**What:** If asteroids knock the shield out and destroy the radio tower, the music degrades to broken static. That effect is switched off in three places: when the repair unit rebuilds the tower, when a new game starts, and on game over. Quitting from the pause menu is the one exit that forgot. The looping static hiss keeps playing and the flicker loop keeps cutting the volume in and out — and because quitting swaps in the menu track without stopping the effect, it is now the main menu music being chopped up. Nothing on the menu can clear it, because the repair unit that would normally fix it can only arrive while the game loop is running, and quitting stops the loop.

**So what:** Player has the shield broken and the tower destroyed (routine mid-game state, and the repair ETA doubles to 8s, 16s, 32s so the window gets long), hits Escape then QUIT. The main menu comes up with hissing static over it and the menu music stuttering on and off forever — through DIFFICULTY, HOW TO PLAY, the high score table, everything. The only way out is to start another mission or die in one. It reads as the game being broken rather than the radio being broken.

<sub>Evidence: files/script.js:303-315 — the entire QUIT handler: 303 document.getElementById('quit-btn').addEventListener('click', () => { 304 state.paused = false; 305 state.running = false; 306 DOM.pauseOverlay.classList.add('hidden'); 307 clearHolodeck(); 308 hideBeta(); 309 DOM.startOverlay.classList.remove('hidden'); 311 titleDismissed = true; 312 if (titlePrompt) titlePrompt.classList.add('hidden'); 313 if (normalMenuBtns) n…</sub>

### A8. The repair-vehicle cutscene stops all target spawning and rejects every command, for as long as its flight animation takes

`files/script.js:3106` · **HIGH** · PLAUSIBLE · *Technical Manual sG (never changes with theme: how Targets spawn and fall; input handling) + Laws v1.6 s0.18 Theme Injection Points*

**What:** When the radio tower is repaired, the repair vehicle's fly-in/fly-out animation is what gates the game: nothing spawns and every typed command is refused until that sprite has flown off the right-hand edge. So a piece of scenery animation, not a configured number, decides how long the round is frozen — and because its steering damping is applied once per frame instead of per second, the same freeze lasts roughly twice as long on a 120 Hz monitor as on a 60 Hz one. Having more rocks on screen stretches it further still, because the vehicle detours around them.

**So what:** A player on a high-refresh display loses about twice as much playing time per tower repair as one on a 60 Hz display, with no spawns and no accepted input during the freeze. The freeze also grows every repair (the hover time multiplier is never reset), so late in a long run the game spends progressively longer doing nothing. Nothing in the difficulty data controls any of it.

<sub>Evidence: startAmbulance() 3105-3106: `state.towerDisabled = true;` `state.rebuilding = true;` maintainAsteroids() 1812-1813: `function maintainAsteroids(dt) {` / ` if (state.rebuilding) return;` spawnAsteroid() 1749: `if (state.asteroids.length >= state.maxTargets || state.rebuilding) return;` handleCommand() 1975-1977: `if (state.rebuilding) {` / `showStatus("TOWER REBUILDING — STAND BY", "miss");` / `return;` The flag is cl…</sub>

### A9. A Target is only cleared when the cosmetic projectile arrives, so an already-scored Target can still destroy a base

`files/script.js:4969` · **HIGH** · PLAUSIBLE · *Technical Manual sE (Clear: correct command → Target removed, points awarded) + Overview v1.6 Gameplay Flow*

**What:** Typing the right command awards the points straight away, but the rock itself is not taken off the board until the shot reaches it — up to about a second later. During that flight the rock is still a live Target, so it can reach the ground and take out a base after the player has already been paid for killing it, and the streak the player just earned is wiped by the very rock they cleared. Because nothing marks the rock as already shot, retyping the same command during the flight matches it again and pays out a second time. And if the tower happens to be down, the shot cannot leave at all: the correct command is swallowed with no points, no message and no error flash.

**So what:** The scoring pipeline explicitly rewards last-second clears ("CLOSE CALL!" fires for a Target below 90% screen height), which is exactly the case where the shot cannot arrive in time — so the player gets the bonus and loses the base for the same rock. With the tower destroyed, a player typing perfectly correct commands sees no feedback whatsoever and cannot tell the game from a frozen one.

<sub>Evidence: handleCommand() 2005-2016 scores immediately on a valid command but does not remove the Target: `const match = state.asteroids.find(a => a.command.toUpperCase() === input);` / `if (match) {` / `if (fireProjectile(match)) {` / `state.streak++;` ... `const pts = calcScore(match, bs);` / `applyScore(pts.total);` The actual removal happens inside the projectile's collision test — 4963-4970: `if (target) {` / `const d = M…</sub>

### A10. scoring.csv's base-destruction escalation and streak-multiplier ladder are hardcoded in JS and never parsed

`files/script.js:5067` · **HIGH** · PLAUSIBLE · *Laws v1.6 0.10 Data Sheet (parse and apply EXACTLY as defined); Technical Manual sD (the Data Sheet is the SINGLE SOURCE OF TRUTH); Build Procedure v1.6 s3.1*

**What:** The scoring spreadsheet lists the penalties for losing bases in a row (0, -100, -200, -300) and the six kill-streak multiplier steps (1.0x through 1.75x). The game does not read any of those rows. Those numbers are typed into the code instead — the base penalties inside the zone-destruction handler, the multiplier ladder inside the config file. The values happen to agree with the spreadsheet today, so nothing looks wrong.

**So what:** Change any of those eleven numbers in scoring.csv and the game keeps using the old ones, with no warning and no visible clue — the spreadsheet says one thing and play does another. The spreadsheet is the only place these rules are written down for a human, so it reads as authoritative while being inert.

<sub>Evidence: script.js:5066-5067 — the live zone-loss penalty: const count = state.consecutiveBasesDestroyed; const penalty = count <= 1 ? 0 : Math.max(SCORING.penaltyCap, (count - 1) * -100); Those same numbers exist as dataset rows, scoring.csv:24-27,30: 1st Base Destroyed (consecutive),0,... 2nd Base Destroyed (consecutive),-100,... 3rd Base Destroyed (consecutive),-200,... 4th+ Base Destroyed (consecutive),-300,... Penalty Fo…</sub>

### A11. While the tower is down waiting for the repair unit, a correct command produces absolutely nothing — no hit, no miss, no message

`files/script.js:2008` · **HIGH** · PLAUSIBLE · *Technical Manual sE — three outcomes only: Clear (Hit), Miss, Impact; Laws v1.6 s0.7/s0.8*

**What:** When the radio tower is knocked out there is a wait before the repair unit is even sent — four seconds the first time, doubling after that. During that whole wait, typing the correct command does nothing at all: no points, no target removed, and not one word on screen. Typing the WRONG command in the same window still tells the player they missed, and the later repair phase does say "stand by", which is what shows this is an oversight rather than a design choice. Targets keep spawning and keep landing throughout, and the player has no way to stop any of them.

**So what:** The player's correct answers vanish into a void for 4, 8, 16, 32+ seconds while bases are destroyed and the run can end. It reads as the game being frozen or the keyboard being broken. It is also a fourth outcome that canon does not have: not a clear, not a miss, not an impact.

<sub>Evidence: destroyTower() sets towerDisabled but NOT rebuilding, then waits out a timer before the repair unit is even dispatched (script.js:1567-1585): 1569: state.towerDisabled = true; 1576: const delaySec = 4 * Math.pow(2, state.ambulanceDestroyCount - 1); 1581: state.ambulancePendingTimer = setTimeout(() => { ... startAmbulance(); }, delaySec * 1000); `state.rebuilding = true` is only set later, inside startAmbulance() (scr…</sub>

### A12. Asteroid fall speed is set by three bare literals in spawnAsteroid, and the rank speed multiplier is applied twice so it acts squared

`files/script.js:1775` · **HIGH** · PLAUSIBLE · *Build Procedure v1.6 s3.1 (config.js holds shared tunables: fall duration, spawn delay, difficulty increase rate...) and s3.3 (difficulty scaling of fall speed lives in core, not the theme)*

**What:** How long an asteroid takes to reach its target is decided by three numbers typed directly into the spawn function — a 25-second baseline, a doubling factor and a plus/minus-15-percent wobble. None of them exist in the config file, so there is nowhere to go to make the game generally slower or faster. Worse, the rank speed number from the progression spreadsheet gets used twice in the same calculation, so it behaves as if squared: the ladder's 4.0x rank is actually sixteen times faster than 1.0x, not four times.

**So what:** A tuning pass that opens config.js looking for fall duration finds nothing, and editing progression.csv's Speed column moves the game far more than the number suggests — nudging a rank from 3.0x to 3.5x is a 36% speed jump, not 17%. At the top rank a target crosses the whole sky in about three quarters of a second, which is less time than typing 'AP 2101 to 72103' takes, so the last two ranks are effectively unclearable rather than merely hard.

<sub>Evidence: script.js:1770-1780 // Speed variance: randomize between tier's speedMin and speedMax const tierData = TIERS[state.tier]; const effectiveSpeed = tierData ? tierData.speedMin + Math.random() * (tierData.speedMax - tierData.speedMin) : state.speedMult; const time = Math.max(2500, 25000 / effectiveSpeed); const baseSpeed = (dist / (time / 1000)) * effectiveSpeed * 2; // Introduce mechanical friction: +/- 15% random vari…</sub>

### A13. Starting shield strength is the literal 9 in the engine; the two shield keys in config.js are read only by the instructions panel

`files/script.js:6615` · **HIGH** · PLAUSIBLE · *Build Procedure v1.6 s3.1 (config.js holds shields among the shared tunables)*

**What:** The config file declares a 9-point shield in 3-point layers, and the engine ignores both: the number 9 is typed into the game state and into the round setup, and the 6-and-3 layer boundaries are re-typed in four more places for the HUD bar, the diamond indicators and the dome colour. The only code that actually reads the config values is the HOW TO PLAY panel.

**So what:** Setting the shield to 6 in config.js changes only what the instructions screen claims — the player still gets 9 points, the HUD bar still draws 9 cells, and the layer colours still change at 6 and 3. The panel becomes a documented lie, which is the exact failure the config key was added to prevent.

<sub>Evidence: script.js:6615 (startGame) running: true, score: 0, shieldHP: 9, towerExposed: false, repairCount: 0, script.js:138 (initial state) shieldHP: 9, script.js:2361 (updateHUD) DOM.shields.textContent = '█'.repeat(filled) + '░'.repeat(9 - filled); script.js:2364-2366 if (state.shieldHP > 6) ... else if (state.shieldHP > 3) ... script.js:1439 (drawShield) const color = state.shieldHP > 6 ? '#00ff88' : state.shieldHP > 3 ? …</sub>

### A14. Gameplay music dies after the second track — the shuffle playlist erases itself

`files/core/audio.js:583` · **HIGH** · PLAUSIBLE · *Overview v1.6 Cartridge requirements + Technical Manual sH — separate music tracks for menus and gameplay, gameplay music LOOPS until the game ends*

**What:** In-game music plays two of the three gameplay tracks and then goes permanently silent for the rest of the run. The routine that queues the next track wipes the very list it reads from, so the third hand-off finds an empty list and quietly stops. Menu, title, high-score and region-lost music are unaffected because they use a real loop flag.

**So what:** A player who survives past roughly 8-9 minutes finishes the run in silence, and one of the three purchased gameplay tracks can never be heard at all. The same code has already been copied into The Aquanaut (its files/core/audio.js:1310-1400 is byte-identical in this area), so any fix has to be applied twice.

<sub>Evidence: audio.js:547-548 `playMusic(src, opts = {}) {` / ` this.stopMusic();` audio.js:574-584 `stopMusic() {\n if (!this._musicEl) return;\n this._musicEl.pause(); ...\n this._musicEl = null;\n this._playlist = null;\n this._playlistRemaining = null;\n },` audio.js:607-620 `_playNextFromPlaylist() {\n if (!this._playlist) return;\n ...\n this.playMusic(track, {\n loop: false,\n volume: this._playlistVolume,\n onEnded: () =>…</sub>

### A15. Every impact on an already-destroyed tower cancels the inbound repair unit and doubles the ETA again — uncapped, with no guard

`files/script.js:1575` · **HIGH** · PLAUSIBLE · *Overview v1.6 Impact Logic / Technical Manual sE (Impact = Target reached the Zone; impact behaviour follows engine rules)*

**What:** Nothing stops the tower from being 'destroyed' again while it is already rubble. Each extra rock that lands on the wreck bumps the repair counter, throws away the ambulance that was already on its way, and restarts the countdown at double the previous length — 4, 8, 16, 32, 64, 128 seconds with no ceiling and no reset in between. Destroyed zones have a deliberate DEBRIS STRIKE handler for exactly this case; the tower is written out of it, so a hit on the wreck is treated as a fresh loss. Letting a CARD lookup escape does the same thing.

**So what:** Past roughly a 25-second ETA the process runs away: rocks keep spawning at the tower (one in five picks it) while the player cannot fire at all, so each new landing restarts and doubles the wait faster than the wait can expire. The tower effectively never comes back and the run ends by the zones being ground down. It also means an asteroid that was merely already in the air when the tower fell can wipe out a repair that was seconds from finishing.

<sub>Evidence: files/script.js:1567-1585 destroyTower() has NO guard on state.towerDisabled: 1569 state.towerDisabled = true; 1575 state.ambulanceDestroyCount++; 1576 const delaySec = 4 * Math.pow(2, state.ambulanceDestroyCount - 1); 1580 if (state.ambulancePendingTimer) clearTimeout(state.ambulancePendingTimer); 1581 state.ambulancePendingTimer = setTimeout(() => { ... startAmbulance(); }, delaySec * 1000); It is reached unconditi…</sub>

### A16. A dataset parse error leaves the title screen alive and every listener unregistered — failure is console-only

`files/script.js:7264` · **HIGH** · PLAUSIBLE · *none - health issue (the recovery path loadFallbackData() already exists at files/core/data.js:298 and is wired for the sibling failure mode at files/core/data.js:129)*

**What:** The game only becomes interactive from the success branch of the data load. If any of the five core CSVs parses badly, the promise rejects, the handler just writes a line to the console, and the function that registers every listener never runs. The boot sequence, the title art and the title music are all independent of the data load, so the player gets a normal-looking title screen with PRESS ANY KEY, the music plays, and then no key and no click does anything — the BEGIN MISSION button is never even revealed, because the code that reveals it lives in the part that never ran. There is already a complete embedded fallback dataset in the file, and it is used when a CSV fails to download, but nothing calls it when a CSV downloads fine and then fails to parse. The trigger is narrower than a bad cell: a short row, a blank cell, a trailing line and the byte-order mark Excel writes are all handled safely. What breaks it is the shape of the header row — a renamed, deleted, misspelled or double-spaced column name in bases.csv or progression.csv, which is exactly what an innocent re-export or hand-edit of the master spreadsheet produces.

**So what:** One header-name change in bases.csv or progression.csv ships a build that boots perfectly and then ignores every input. The player reports 'it froze on the title screen', which points at the boot/title code, not at a spreadsheet column. The dev-only Holodeck reload path prints the real parse error on screen, so the one person who could diagnose it is the only one who never sees the silent version. Any fix has to be applied twice — the same unguarded column reads exist in loadGameData (files/core/data.js:157, 192-197) and in the duplicated applyCSVData (files/core/data.js:546, 579-583).

<sub>Evidence: files/script.js:7261-7266 — the only unconditional entry into the game: loadGameData().then(() => { dataReady = true; if (bootDone) init(); }).catch(err => { console.error('Data load failed:', err); }); The only other init() call site is files/script.js:6970-6971, inside revealTitleScreen, and it is gated the same way: bootDone = true; if (dataReady) init(); (grep for "init()" in files/script.js returns exactly these…</sub>

### A17. CONFIG.ambulanceSpeed is dead — the real speed is a literal inside script.js, and the generated manual publishes the dead number

`files/core/config.js:18` · **MEDIUM** · CONFIRMED · *Build Procedure v1.6 s3.1 (config.js holds the shared tunables; cartridges override a safe subset) — hardcoded-intercept pattern*

**What:** There is a repair-unit speed setting in the config file that no code ever reads. The speed the repair unit actually uses is typed directly into the game loop as 500, alongside two other steering constants. The manual generator then prints the config value as the ambulance movement speed, so the published document states 400 for a thing that moves at 500.

**So what:** Tuning the repair unit through the config file does nothing, and the tuner has no way to tell — the change is silently ignored. Anyone reading the generated manual to find the number gets the wrong one. The same steering block also hides seekForce and a damping factor from config entirely.

<sub>Evidence: files/core/config.js:18 ambulanceSpeed: 400, Grep across the whole cartridge (*.js, *.html, *.css, excluding node_modules) returns exactly two hits for "ambulanceSpeed" — that definition, and: Help Files/generate_manual.js:1246 new TableRow({ children: [bodyCell('ambulanceSpeed', 2600, { mono: true }), bodyCell('400', 1200), bodyCell('Ambulance movement speed', 5560)] }), The value the game actually flies at is a loc…</sub>

### A18. Game-over and repair timers are plain setTimeouts that ignore pause and quit, so Game Over can land on the pause overlay or the main menu

`files/script.js:6685` · **MEDIUM** · CONFIRMED · *Build Procedure v1.6 s3.5 (ui.js manages the screen states Start/Options/Game/Pause/Game Over)*

**What:** The ten-second "region falling" countdown and the repair-unit countdown are wall-clock timers that keep running no matter what screen you are on. Pause during the countdown and the Game Over screen appears on top of the pause menu; pressing Escape then resumes you into a finished run. Quit to the main menu during the countdown and the Game Over screen slams up over the menu ten seconds later. There is no single place that owns which screen the game is on, so each of these transitions fires independently.

**So what:** Two reproducible wrong-screen states: Game Over stacked on the pause overlay with Escape resuming a dead game, and Game Over appearing over the main menu (with the high-score music) after the player has already quit.

<sub>Evidence: files/script.js:6681-6688: 6681: function scheduleGameOver() { 6683: state.gameOverPending = true; 6684: showStatus("ALL ZONES LOST — REGION FALLING...", "impact"); 6685: state.timers.gameOverDelay = setTimeout(() => { 6686: gameOver(); 6687: }, 10000); gameOver() (6690-6738) checks nothing — not state.running, not state.paused — and force-shows its overlay: 6737: DOM.gameOverOverlay.classList.remove('hidden'); The t…</sub>

### A19. Duplicate-suppression history is wiped mid-session, so the same challenge-command pair can recur and two live targets can share one command

`files/core/data.js:720` · **MEDIUM** · CONFIRMED · *Overview v1.6 Dynamic Dataset Logic — Validation: "NO DUPLICATE Challenge-Command pairs"; Technical Manual sD ("NEVER generate duplicate Challenge-Command pairs in the same session")*

**What:** The game remembers which challenges it has already issued so it does not repeat them, but it throws that memory away twice over: once every 400 challenges, and again whenever it fails 25 times to find something new — and in that second case it hands back the repeat it just rejected. The memory also does not know which rocks are still on screen, so after a wipe a new rock can spawn carrying exactly the same command as one already falling. Type that command and only one of the two dies; the other looks like it ignored a correct answer. Narrowing the God Mode filters to a single unit and base triggers this on every single spawn.

**So what:** A long run repeats pairs the player has already drilled, and after a wipe there is a real chance of two identical rocks on screen — the player types the right command, watches one explode and the other keep falling, and has no way to tell that from a bug. In a narrowed God Mode session it happens continuously.

<sub>Evidence: core/data.js:711-724: do { action = weightedRandom(baseActions); unit = weightedRandom(units); loc = weightedRandom(locs); unitID = typeof unit === 'string' ? unit : unit.id; key = `${action.m}-${unitID}-${loc.m}`; attempts++; } while (state.usedChallenges.has(key) && attempts < 25); if (attempts >= 25 || state.usedChallenges.size >= 400) { state.usedChallenges.clear(); } state.usedChallenges.add(key); Two separate w…</sub>

### A20. God Mode unit and base pickers list the full roster but filter only the six-unit, five-base Holodeck sample, so most selections are silently discarded

`files/core/data.js:694` · **MEDIUM** · CONFIRMED · *none - health issue*

**What:** In the Holodeck dev menu the UNITS and BASES checklists show the entire roster — all 67 units and all 22 bases — but the generator only ever draws from the first six units and first five bases. Ticking anything outside that window has no effect: the pick is dropped, and if it is the only thing ticked the generator quietly falls back to the whole sample. There is no warning; the counter beside the section header cheerfully reports "1 / 67".

**So what:** Anyone using God Mode to reproduce a bug on a specific unit or base — say Westwood 72122 — never sees it. They get 2040-2045 against Niagara Falls, Ontario St, Linwell, Thorold and NOTL instead, and reasonably conclude the problem does not reproduce.

<sub>Evidence: core/data.js:684-685 narrows the pools before the filter runs: let baseUnits = CONFIG.isHolodeck ? DATA_UNITS_SAMPLE : DATA_UNITS_FULL; let baseLocs = CONFIG.isHolodeck ? DATA_LOCATIONS_SAMPLE : DATA_LOCATIONS_FULL; Those samples are the first six units and first five bases (data.js:180-181 `DATA_UNITS_SAMPLE = DATA_UNITS_FULL.slice(0, 6);` / `DATA_LOCATIONS_SAMPLE = DATA_LOCATIONS_FULL.slice(0, 5);`) — i.e. units 20…</sub>

### A21. Duplicate-pair guard forgets everything after 400 targets, so pairs repeat inside one run

`files/core/data.js:720` · **MEDIUM** · CONFIRMED · *Overview v1.6 Dynamic Dataset Logic (Validation: no duplicate Challenge-Command pairs); Technical Manual sD (never generate duplicate Challenge-Command pairs in the same session)*

**What:** The game remembers the last 400 unit/base/command combinations it has issued and then wipes the whole memory, even though there are over 23,000 possible combinations. After about 400 targets in a run - roughly seven minutes at the top rank - previously seen calls start coming back. The memory is also never compared against the targets currently on screen, so once it has been wiped a brand-new target can carry exactly the same command as a rock already falling; typing that command clears only one of them and leaves its twin in the air.

**So what:** A long run stops being all-new material partway through, and a player can see the same call twice on screen at once and have one ENTER only clear one of the two rocks.

<sub>Evidence: core/data.js:711-724 do { action = weightedRandom(baseActions); unit = weightedRandom(units); loc = weightedRandom(locs); unitID = typeof unit === 'string' ? unit : unit.id; key = `${action.m}-${unitID}-${loc.m}`; attempts++; } while (state.usedChallenges.has(key) && attempts < 25); if (attempts >= 25 || state.usedChallenges.size >= 400) { state.usedChallenges.clear(); } state.usedChallenges.add(key); The set is the …</sub>

### A22. The Holodeck dataset-reload parser is a hand-copied duplicate and has already lost the Difficulty column

`files/core/data.js:592` · **MEDIUM** · CONFIRMED · *Laws v1.6 0.10 Data Sheet (parse and apply EXACTLY as defined); Build Procedure v1.6 s3.2*

**What:** There are two copies of the dataset parser: one for the initial load, one for the Holodeck reload button. They were meant to be identical and are not — the reload copy forgot the Difficulty column. Reload the datasets in Holodeck and the difficulty picker stops showing NOVICE through EXPERT and starts showing the rank names instead. Every reader has a fallback so nothing crashes; the labels just quietly change.

**So what:** Anyone testing a dataset edit through the Holodeck reload button sees a different difficulty screen than a player who launched normally, which makes the reload button untrustworthy for verifying dataset work. And every future column added to a CSV has to be wired into two places by hand or it half-works the same way.

<sub>Evidence: Two parsers for the same CSVs. Initial load, core/data.js:206-223: TIERS[key] = { label: name.toUpperCase(), difficulty: (r['Difficulty'] || name).toUpperCase(), min: points, ... Holodeck 'UPDATE DATASETS' reload, core/data.js:591-595 — same object, no difficulty: TIERS[key] = { label: name.toUpperCase(), min: points, max: Infinity, speedMin, speedMax, spawnMin: spawnMinSec * 1000, spawnMax: spawnMaxSec * 1000, maxTa…</sub>

### A23. The no-repeat memory is thrown away every 400 spawns, so one game re-asks pairs it already used

`files/core/data.js:720` · **MEDIUM** · CONFIRMED · *Technical Manual sD Generation Rules ("NEVER generate duplicate Challenge-Command pairs in the same session"); Overview v1.6 Dynamic Dataset Logic - Validation ("NO DUPLICATE Challenge-Command pairs")*

**What:** The game does remember which unit/base/command combinations it has already used, but only the last 400 of them, and when it hits 400 it forgets all of them at once instead of dropping the oldest. The dataset holds 5,896 possible combinations, so there was no need to forget anything - the cap fires at under 7% of the pool.

**So what:** In a long or high-rank run the same asteroid instruction comes back a second time. Immediately after a wipe roughly 7% of each new spawn matches one of the 400 just-forgotten combinations, so the following stretch of 400 spawns carries on the order of 25-30 repeats. There is also a small window (about 4% per wipe event) where a repeat spawns while its twin is still falling: two asteroids then carry byte-identical command text, and script.js:2005 (`state.asteroids.find(a => a.command.toUpperCase() === input)`) clears only the first match, so the player has to type the same command twice to clear both.

<sub>Evidence: core/data.js:711-724 (the only place asteroid challenges are generated; called from script.js:1781 in spawnAsteroid): 711 do { 712 action = weightedRandom(baseActions); 713 unit = weightedRandom(units); 714 loc = weightedRandom(locs); 715 unitID = typeof unit === 'string' ? unit : unit.id; 716 key = `${action.m}-${unitID}-${loc.m}`; 717 attempts++; 718 } while (state.usedChallenges.has(key) && attempts < 25); 719 720…</sub>

### A24. The DIFFICULTY screen advertises IMPACT = the rank's impact penalty, but no impact ever applies it — the progression.csv column now only drives the CARD lifeline

`files/script.js:698` · **MEDIUM** · CONFIRMED · *Laws v1.6 0.10 / Technical Manual sD (the Data Sheet is the single source of truth); Overview v1.6 Impact Logic*

**What:** The difficulty screen lists an IMPACT cost per rank — minus 50 at the bottom, minus 600 at the top — taken from a spreadsheet column that the scoring sheet itself marks as retired. Nothing in the impact path uses that number any more: losing a zone actually costs nothing the first time and then 100, 200, 300 regardless of rank. The retired column's only live use is setting the penalty for a failed shorthand-card lifeline.

**So what:** The player is told the wrong price for a missed call at every rank, and it is wrong in both directions (0 instead of -50 at Trainee, -300 instead of -600 at the top). Anyone tuning progression.csv's Target Impact column to rebalance impacts will move only the card-lifeline penalty and see no change to impacts at all.

<sub>Evidence: script.js:696-699 (renderDifficultyReadout, 'SHIFT CONDITIONS' table) ['CLEAN KILL', '+' + t.baseHit], ['IMPACT', t.impactPenalty], ['CARD FAILURE', t.impactPenalty * CARD_HELP.failPenaltyMultiplier] Every read of impactPenalty in the cartridge (grep -rn impactPenalty over files/*.js files/core/*.js): script.js:698 — the DIFFICULTY readout label 'IMPACT' script.js:699 — the DIFFICULTY readout label 'CARD FAILURE' scr…</sub>

### A25. Zone sprite list requests Welland_Canal_INTACT.png, which does not exist

`files/script.js:19` · **MEDIUM** · CONFIRMED · *none - health issue*

**What:** The asset loader asks the browser for a Welland Canal intact sprite that was never shipped. The canal is actually drawn from two separate sprites (towers plus deck), so the missing name is a leftover from before the lift bridge became a two-piece composite. Nothing draws it, but the request still goes out.

**So what:** Every single page load fires a 404 for assets/Zones/Welland_Canal_INTACT.png and logs a red "Missing:" warning to the console. Anyone opening devtools on the published site sees a broken game before they see anything else, and the next person auditing load errors has to chase a phantom.

<sub>Evidence: script.js:15-21 ZONE_ASSET_LIST = [ ... line 19: ` 'Welland_Canal_INTACT', 'Welland_Canal_DESTROYED',` ] script.js:52-55 `ZONE_ASSET_LIST.forEach(name => { ASSETS[name] = new Image(); ASSETS[name].src = `assets/Zones/${name}.png`; ... onerror = () => { console.warn(`Missing: assets/Zones/${name}.png`); assetsLoaded++; };` `ls files/assets/Zones/` returns 11 files: Robin_Hood_{INTACT,DESTROYED}, Sir_Adam_Beck_{INTACT,…</sub>

### A26. RESTART from the pause menu leaves two animation-frame loops running; every non-time-scaled effect then runs twice per frame

`files/script.js:299` · **MEDIUM** · CONFIRMED · *Build Procedure v1.6 s3.3 core loop and Target lifecycle; s3.5 ui.js screen states Start/Options/Game/Pause/Game Over*

**What:** Restarting from the pause menu calls resume and then start, and each of those kicks off its own animation loop. Nothing ever cancels the old one, so from that moment the game draws and steps twice per frame forever. Anything measured in real seconds still behaves, but everything written per-frame — the ambulance's braking, explosion fade, debris arcs — runs at double rate. Each further pause-restart adds another loop on top.

**So what:** After one pause-restart the tower lockout roughly doubles again on top of the frame-rate defect: about 27 seconds of tower-down on a 144 Hz screen for a repair designed to take 8. Explosions and debris visibly flicker out early, and half the frame budget is spent drawing the same frame twice, which on a weak machine drops the frame rate and lengthens the lockout further.

<sub>Evidence: files/script.js:299-302: 299 document.getElementById('restart-pause-btn').addEventListener('click', () => { 300 resumeGame(); 301 startGame(CONFIG.isHolodeck); 302 }); resumeGame() schedules a loop (6591-6599): 'state.running = true; ... lastTime = performance.now(); requestAnimationFrame(gameLoop);' startGame() then schedules a SECOND one (6676-6677): 'lastTime = performance.now(); requestAnimationFrame(gameLoop);' …</sub>

### A27. The launcher's storage scrub preserves five keys the game never writes, and deletes all three it does — leaderboard, saved difficulty, and HOW TO PLAY seen flag

`Asteroid Command.html:75` · **MEDIUM** · CONFIRMED · *none - health issue*

**What:** The standalone launcher page wipes local storage on every open, keeping only a list of five key names that this cartridge stopped using (or never used). The three keys the game really writes — the top-100 high score table, the remembered difficulty choice, and the flag that says the player has already seen the HOW TO PLAY briefing — all fail the keep-test and get deleted. The comment directly above the list claims it preserves high scores and progression; it does not. Note the main-menu hub is not affected: the hub links straight to the game page and skips this file entirely. The damage is confined to players who open the cartridge by double-clicking its own launcher, which is exactly what the launcher's own error panel and Rebuild Offline Data.bat tell them to do.

**So what:** On the double-click/disk path, every launch starts from an empty leaderboard, so a score submitted and confirmed under HIGH SCORES is gone the next time the game is opened; the difficulty tier resets to the default instead of the last one chosen; and HOW TO PLAY opens on the first-time briefing every single time rather than on its menu. It also masks a related observation from elsewhere in the audit — there is little point investigating why every high score is recorded the same way when the table it is written to does not survive the next launch on this path. Forward hazard: the scrub sits above the file:// branch and runs unconditionally, so if anyone ever repoints the hub at "Asteroid Command.html" (the natural-looking fix, since that is the file named after the cartridge), the wipe silently starts hitting the hub path too.

<sub>Evidence: Asteroid Command.html:73-91 (the scrub, running unconditionally before the protocol branch at 103): 73 // ── Clear browser cache on every launch ─────────────────── 74 // Carried over from the old launcher. Preserves high scores and progression. 75 var PRESERVE_KEYS = ['highScore', 'bestScore', 'progression', 'careerRank', 'asteroidCommand_']; 76 function shouldPreserve(key) { 77 return PRESERVE_KEYS.some(function (k…</sub>

### A28. The paused menu can arm a button while showing no highlight at all, because the "nothing selected yet" check matches a stale class on a hidden main-menu button

`files/script.js:905` · **MEDIUM** · CONFIRMED · *none - UI state defect*

**What:** The menu keyboard layer decides "nothing is selected yet, so highlight the first button" by searching the entire page for a highlight class, and that search also finds buttons that are currently hidden. The highlight is never cleared when a menu disappears — starting a run hides the main menu while its START button still carries the highlight. When the pause overlay later opens, the check sees that leftover highlight, assumes a selection already exists, and leaves the pause menu with no visible highlight and a carried-over index. Combined with the any-key activation above, that means a keystroke can fire a pause button the player was given no visual indication was armed.

**So what:** The pause overlay can open with none of its three buttons highlighted, yet a keystroke still activates one of them, chosen by an index inherited from an earlier menu. The player has no on-screen cue about what a stray key will do. The same stale class also means the first arrow press after opening a menu can move the highlight from an unexpected starting point.

<sub>Evidence: The auto-highlight fallback asks the whole document, not the current menu, and querySelector matches hidden elements: script.js:904-908 // Auto-highlight first button if none selected yet if (!document.querySelector('button.menu-kb-selected')) { menuSelectedIndex = 0; updateMenuHighlight(menuButtons); } The class is only ever cleared inside updateMenuHighlight (script.js:875 `document.querySelectorAll('button.menu-kb…</sub>

### A29. The manual's shield figures are read from two config keys the engine never reads; the engine uses a literal 9 and hardcoded HUD thresholds

`files/core/howtoplay.js:209` · **MEDIUM** · CONFIRMED · *Build Procedure v1.6 s3.1*

**What:** The manual computes the shield total and the layer count from two settings in the config file. The game itself never reads either one — it uses a bare 9 in two places and bakes the 6/3/0 diamond boundaries into the HUD as literals. The two numbers happen to agree today, so nothing looks wrong. Change the config to 12, which the printed manual explicitly tells you to do, and the in-game manual starts saying twelve points in four layers while the game still gives nine and the HUD still draws three diamonds. The drift runs backwards from what you would expect: tuning the config moves the documentation and leaves the game alone. A third shield setting, the regen streak threshold, is referenced nowhere at all.

**So what:** The documented procedure for retuning shields silently does nothing to the game and quietly falsifies the manual instead. Anyone following the printed instructions will believe they changed the shield and then find the HUD unchanged. The header promise that the manual cannot drift out of sync is untrue for exactly the shield numbers, which undermines trust in every other figure on the panel.

<sub>Evidence: files/core/howtoplay.js:209 and :225-226: 209 const layers = Math.round(CONFIG.maxShieldStrength / CONFIG.hpPerShieldLayer); 225 + para(`Your tower carries <strong>${CONFIG.maxShieldStrength} shield points</strong> 226 &mdash; ${layers === 3 ? 'three' : layers} layers of ${CONFIG.hpPerShieldLayer}.`) Repo-wide grep for maxShieldStrength across the cartridge returns: files/core/config.js:11 (the definition), files/cor…</sub>

### A30. God Mode's RANK OVERRIDE is never cleared and checkTier reads it with no Holodeck guard, so it hijacks every normal game for the rest of the page load

`files/script.js:2445` · **MEDIUM** · CONFIRMED · *Laws v1.6 §0.15 Developer Mode (restricted testing mode, hidden from regular users); Build Procedure v1.6 s3.3 (difficulty scaling of spawn timing, fall speed and max targets is core engine behaviour)*

**What:** The RANK OVERRIDE dropdown in the Holodeck's God Mode menu writes a rank lock into a variable that nothing ever clears — not leaving the Holodeck, not starting a game, not quitting, not restarting. And the one place the engine reads that lock is the only God Mode read in the whole cartridge that does not first check whether the Holodeck is actually running. Every other God Mode switch is properly fenced off. So once the lock is set, it silently governs every ordinary game played until the browser tab is reloaded: the rank chosen on the DIFFICULTY screen is applied at start, then thrown away on the first point scored, and no promotion, demotion or rank-up bonus can ever fire again. Because the rank also drives fall speed, spawn rate, max asteroids on screen and points-per-hit, an ordinary run silently plays at, and scores at, the locked rank's values, while the end-of-game screen shows no sign the Holodeck was ever involved.

**So what:** Reachability is dev-gated (the timed Holodeck password prompt, script.js:1292-1337), so a regular player cannot trip it — the victim is whoever tests the game. Open God Mode once, set RANK OVERRIDE to anything, leave the Holodeck, and every normal game for the rest of that page load is mis-ranked and mis-scored with no visible cause: a TRAINEE run locked to O.A.S falls at 3.0-4.0x speed, spawns every 800-1200ms with 25 targets and pays 1200 a hit instead of 100, and that inflated score goes into the high-score table as a legitimate TRAINEE run. Rank progression is dead the whole time, so any bug report about "promotions stopped working" or "scoring is wrong" will be chased into the scoring code, which is innocent. The fix is one line either way — clear godMode.overrideTier on Holodeck exit, or gate the read at script.js:2445 behind CONFIG.isHolodeck the way lines 1042, 1088, 1753 and data.js:689 already do.

<sub>Evidence: files/core/config.js:259-270 — module-level object, default null: 259 const godMode = { ... 269 overrideTier: null // When set, locks the rank — bypasses score-based promotion 270 }; files/script.js:2443-2451 — the ONLY read of overrideTier in the engine, and it has no CONFIG.isHolodeck guard; it returns before every promotion/demotion path: 2443 function checkTier() { 2444 // If holodeck tier override is active, loc…</sub>

### A31. The two readout queues survive quit/restart/game-over, so the previous run's lines type into the next run's HUD

`files/script.js:2223` · **MEDIUM** · CONFIRMED · *none - health issue*

**What:** The two small readout screens share a message backlog that lives outside the game state. Ending a run — quitting from the pause menu, restarting, or dying — resets the score, the asteroids and the timers, but leaves that backlog and its "currently typing" flags untouched, and the typewriter that drains it has no stop switch at all. Whatever had not finished printing keeps printing, so a fresh game opens by typing out the last game's points, misfires and "all zones lost" line before it shows anything of its own. A single clear can queue several lines at once (points, then each bonus note, then the streak line), and each line holds the screen for about a second and a half, so a busy final few seconds can bleed ten seconds or more of stale text into the new run.

**So what:** A player who quits or restarts mid-action sees the new run's readout narrating the old run: "-60 MISFIRE", "+450", "ALL ZONES LOST — REGION FALLING..." typing over a game where nothing has happened yet, sometimes with a red penalty colour on a clean start. It also makes readout bugs run-dependent and hard to reproduce: because the backlog length at the moment of restart is arbitrary, the same scoring event appears to display correctly, late, or not at all depending on what the previous run left queued — so a reader chasing "the readout swallowed my bonus" is chasing a symptom whose real cause is in the previous game. For a future edit, any fix to run teardown that resets `state` will not help: the queues are outside `state`, and the orphaned advance timer means clearing them alone still lets one already-scheduled line through.

<sub>Evidence: 2223-2226: `const vds1Queue = [];` / `const vds2Queue = [];` / `let vds1Typing = false;` / `let vds2Typing = false;` — module-level, and a grep for all four names returns hits only at 2223-2290 (the push/shift sites). Nothing anywhere in the 7267-line file empties either array or resets either flag. 2257 / 2280: `const { msg, type } = vds1Queue.shift();` (and vds2) — the queue is drained only by its own self-scheduli…</sub>

### A32. CONFIG.isHolodeck is cleared only inside startGame, so QUIT and exitHolodeckMenu leave it true and the main menu goes silent

`files/script.js:307` · **MEDIUM** · CONFIRMED · *Technical Manual sH (separate music tracks for menus and gameplay); Laws v1.6 0.15 / Build Procedure v1.6 s6 (Developer Mode)*

**What:** The Holodeck flag is turned on when the Holodeck is entered, and turned off in exactly one place: the start of a new mission. Quitting from the pause menu, and backing out of the Holodeck menu, both leave it on. Since the menu music routine deliberately stays silent whenever that flag is on, the main menu comes up with no music at all after a Holodeck run is quit. The flag is also still live: entering the dev password from that menu re-triggers the Holodeck grid flash and the MODE: HOLODECK banner on top of the main menu.

**So what:** Enter the Holodeck, start a Holodeck game, Escape then QUIT. The main menu is dead silent — the Holodeck grid and banner are gone, so nothing on screen explains why. It only fixes itself when the player starts a normal mission (BEGIN MISSION calls startGame(false)). If they instead press Ctrl+Shift+B and enter the password, the yellow Holodeck grid flashes up over the main menu as if a simulation had started.

<sub>Evidence: Only two assignments exist in the whole 7267-line file (grep 'isHolodeck'): files/script.js:3242 — inside triggerHolodeck(): `CONFIG.isHolodeck = true;` files/script.js:6651 — inside startGame(holodeck = false): `CONFIG.isHolodeck = holodeck;` (files/core/config.js:22 `isHolodeck: false,` is the initial value only.) QUIT resets everything around the flag but not the flag — files/script.js:307-308: 307 clearHolodeck()…</sub>

### A33. QUIT leaves the 10-second game-over timer pending, so the game-over screen erupts over the main menu after quitting during the aftermath

`files/script.js:305` · **MEDIUM** · CONFIRMED · *none - health issue*

**What:** When the last zone falls the game waits ten seconds so the player can watch the aftermath, and the game is still pausable during that wait. If the player pauses and quits inside that window, the pending timer is never cancelled — the pause menu quit cancels nothing. Ten seconds later the game-over routine runs anyway: it kills the menu music, plays the game-over sting, starts the high-score or region-lost track on loop, and drops the full game-over screen on top of the main menu the player is already sitting on.

**So what:** Player loses their last zone, sees REGION FALLING, decides not to watch and hits Escape then QUIT. They are on the main menu, maybe already in DIFFICULTY or HOW TO PLAY, when the menu music cuts out and the game-over screen with score submission appears over top of it out of nowhere. Same handler also leaves the repair-unit timer pending, which is what keeps the static from ever self-healing in the finding above.

<sub>Evidence: files/script.js:6681-6688: 6681 function scheduleGameOver() { 6682 if (state.gameOverPending) return; 6683 state.gameOverPending = true; 6684 showStatus("ALL ZONES LOST — REGION FALLING...", "impact"); 6685 state.timers.gameOverDelay = setTimeout(() => { 6686 gameOver(); 6687 }, 10000); Nothing here sets state.running = false. grep 'state.running = ' returns only four sites: 305 (QUIT), 6586 (pauseGame), 6594 (resume…</sub>

### A34. The LAYOUT block in core/config.js has never been read by anything, and the dead slot was inherited by the sibling cartridge

`files/core/config.js:272` · **MEDIUM** · PLAUSIBLE · *none - health issue (dead code in a module Build Procedure v1.6 s3.1 defines as the tunables surface)*

**What:** A block of three terrain heights sits in the core config file and nothing in the game has ever read it. The names describe this game's landscape — gorge, plateau, tower. When the deep-sea cartridge was made, the block was renamed to hose and diver positions rather than deleted, and it is unread there too, with one of its own entries commented as unread.

**So what:** Someone tuning the terrain edits these three numbers and sees no change, then has to go find the real values inside script.js. Because the block survived the fork, the same wasted lookup is now waiting in two cartridges, and the pattern will copy forward again.

<sub>Evidence: files/core/config.js:272-276 272 const LAYOUT = { 273 gorgeY: 85, 274 plateauY: 110, 275 towerY: 140 276 }; Grep for "LAYOUT" across the cartridge (*.js, *.html, *.css, node_modules excluded) returns exactly two hits: that definition, and an unrelated section comment at Help Files/generate_manual.js:327 ("// HUD LAYOUT DIAGRAM"). Grep for "LAYOUT.", "gorgeY", "plateauY" and "towerY" each return only the config.js def…</sub>

### A35. The DIFFICULTY screen advertises a per-rank IMPACT penalty the scoring system explicitly retired and never applies

`files/script.js:698` · **MEDIUM** · PLAUSIBLE · *Technical Manual sD/sG (Data Sheet is the single source of truth; scoring rules are core and never theme-dependent)*

**What:** The difficulty screen shows an "IMPACT" figure for each rank, pulled from the progression sheet. That penalty was replaced by the consecutive-base-loss rule and the impact handler never applies it — the first zone you lose costs zero points, later ones cost a flat 100/200/300 regardless of rank, and a tower hit costs no points at all. The only thing still using that number is the CARD lifeline failure penalty.

**So what:** An O.A.S player is shown IMPACT -600 and then loses their first zone for zero points; a Trainee is shown -50 and loses their second zone for -100. The readout describes a rule that was deleted, so a player planning around it is planning around nothing.

<sub>Evidence: files/script.js:697-699 (renderDifficultyReadout — live "SHIFT CONDITIONS" panel): 697: ['CLEAN KILL', '+' + t.baseHit], 698: ['IMPACT', t.impactPenalty], 699: ['CARD FAILURE', t.impactPenalty * CARD_HELP.failPenaltyMultiplier] files/datasets/scoring.csv retires that value outright: "Legacy: Target Impact,REMOVED,Old per-base Rank Penalty from progression.csv.,REPLACED by the Consecutive Base Destruction system above…</sub>

### A36. A correct command typed during the repair-ETA window is silently swallowed — no score, no message, no error flash

`files/script.js:2007` · **MEDIUM** · PLAUSIBLE · *Technical Manual sE (Clear/Hit and Miss are the defined outcomes of a submitted Command; Overview v1.6 Gameplay Flow)*

**What:** After the tower is destroyed there is a wait before the repair unit is dispatched. During that wait, typing the correct command does absolutely nothing — the box clears and there is no message, no points and no error. Typing a wrong command in the same window still deducts 50 points and tells you so. Once the repair unit actually arrives the game does say "TOWER REBUILDING — STAND BY", so the silence only covers the earlier gap.

**So what:** On the fourth tower loss that is 32 seconds in which every correct answer vanishes without acknowledgement, while every wrong answer is punished and announced. The player cannot tell whether they typed it right, whether the game is frozen, or whether input is being read at all.

<sub>Evidence: files/script.js:1975-1978 guards only the rebuilding flag: 1975: if (state.rebuilding) { 1976: showStatus("TOWER REBUILDING — STAND BY", "miss"); 1977: return; files/script.js:2006-2062 — the hit path is gated on fireProjectile() succeeding, with no else: 2006: const match = state.asteroids.find(a => a.command.toUpperCase() === input); 2007: if (match) { 2008: if (fireProjectile(match)) { ... 2061: } else { 2062: app…</sub>

### A37. The config module is not authoritative: the monolith hardcodes values config already declares, and three config keys are dead

`files/script.js:2361` · **MEDIUM** · PLAUSIBLE · *Build Procedure v1.6 s3.1 (config.js holds the shared tunables — shields, scoring, spawn and difficulty rates — structured so cartridges override a safe subset)*

**What:** The tunables file declares the shield capacity, the repair-unit speed, a shield-regen threshold and a zone height. The game itself ignores all four: the HUD writes 9, 6 and 3 as literals in five places, the repair unit flies at a hardcoded 500 instead of the 400 in config, and the shield-regen threshold points at a function whose body was emptied out but which is still called after every kill. The only file that actually reads the shield numbers from config is HOW TO PLAY.

**So what:** Change the shield capacity in config and HOW TO PLAY will describe the new value while the HUD bar, the diamond thresholds, the shield colour bands and the run's starting HP all stay at 9 — the manual and the game disagree, in the one place a player goes to check. The dead keys and the empty checkRegen() also read as live features to the next person editing the file.

<sub>Evidence: Shield ceiling and layer thresholds are literals in the HUD (files/script.js:2360-2366, 2387-2395, 1440, 5112-5113, 6615): 2361: DOM.shields.textContent = '█'.repeat(filled) + '░'.repeat(9 - filled); 2364: if (state.shieldHP > 6) DOM.shields.classList.add('shield-100'); 2365: else if (state.shieldHP > 3) DOM.shields.classList.add('shield-50'); 6615: running: true, score: 0, shieldHP: 9, ... while files/core/config.js…</sub>

### A38. Gameplay motion in the monolith integrates per frame instead of per delta-time, so the repair lockout is shorter on a slow monitor

`files/script.js:3148` · **MEDIUM** · PLAUSIBLE · *Build Procedure v1.6 s3.3 (engine.js owns the core loop and Target lifecycle, including difficulty scaling of timing)*

**What:** The repair unit's flight to the tower and the spring that holds each Challenge label to its Target are stepped once per drawn frame rather than by elapsed time. The rest of the loop is time-based, so these two are the odd ones out: on a 144 Hz monitor the repair unit crawls and the tower stays offline noticeably longer, while on a 30 Hz machine it arrives sooner. The label spring tracks tightly at high refresh and lags at low refresh.

**So what:** How long the gun is offline after a tower loss — which is difficulty, not decoration — depends on the player's monitor refresh rate, so scores are not comparable across machines. The same class of bug was already ruled a defect in the sibling cartridge.

<sub>Evidence: files/script.js:3129-3149 — the seek force is dt-scaled but the damping is applied once per FRAME: 3129: const damping = 0.92; // velocity damping per frame 3143: amb.vx += (dx / (dist || 1)) * seekForce * maxSpeed * dt; 3147: // Damping 3148: amb.vx *= damping; 3149: amb.vy *= damping; 3157: amb.x += amb.vx * dt; Steady-state speed is therefore proportional to dt: v = a·dt·0.92/(1-0.92) ≈ 11.5·a·dt. With a = seekFor…</sub>

### A39. Holodeck unit/base pickers list the whole dataset but filter only the 6-unit / 5-base sample

`files/core/data.js:697` · **MEDIUM** · PLAUSIBLE · *Laws v1.6 Core Law 5 (dataset integrity; data pools must match spec); Laws v1.6 s0.14 Data Pool (values drawn exactly as defined)*

**What:** The developer panel shows all 67 units and all 22 bases with tick boxes, but the target generator only ever draws from the first 6 units and the first 5 bases while in the Holodeck. Ticking any base past the fifth one - Fort Erie, HQ, Westwood and thirteen others - changes nothing. Worse, if you untick the first five and tick only later ones, the filter matches nothing and the code silently falls back to the full five-base sample, so the panel reports your selection while the game generates the opposite of it.

**So what:** The one tool for testing a specific base or unit pairing quietly ignores most of the dataset and can hand back a pool that is the exact inverse of what the tick boxes show, so a pairing check done in the Holodeck proves nothing about those rows.

<sub>Evidence: core/data.js:684-702 let baseUnits = CONFIG.isHolodeck ? DATA_UNITS_SAMPLE : DATA_UNITS_FULL; let baseLocs = CONFIG.isHolodeck ? DATA_LOCATIONS_SAMPLE : DATA_LOCATIONS_FULL; ... if (godMode.activeUnits && godMode.activeUnits.size > 0) { baseUnits = baseUnits.filter(u => godMode.activeUnits.has(u.id)); } if (godMode.activeBases && godMode.activeBases.size > 0) { baseLocs = baseLocs.filter(l => godMode.activeBases.has(…</sub>

### A40. Difficulty screen advertises an impact penalty that no longer applies to losing a zone

`files/script.js:698` · **MEDIUM** · PLAUSIBLE · *Laws v1.6 0.9 Impact / 0.10 Data Sheet; Technical Manual sE (Impact -> player loses points); Overview v1.6 Dynamic Dataset Logic*

**What:** The difficulty screen shows an IMPACT figure that scales from -50 at Trainee to -600 at Expert. That number is read from the progression sheet, but the game stopped using it for zone impacts — losing a zone now costs 0, then -100, -200, -300 regardless of rank. The scoring sheet itself marks the old column as removed. The column still drives one thing: the CARD lifeline failure penalty, which is also on that same screen.

**So what:** A player reading the difficulty screen at Expert expects -600 per landmark lost and gets -300 at worst, or nothing at all for the first one. Anyone tuning the game will also edit the Target Impact column in progression.csv expecting to change impact scoring and will only move the CARD failure penalty.

<sub>Evidence: script.js:692-699, the SHIFT CONDITIONS readout on the DIFFICULTY page: ['IMPACT', t.impactPenalty], ['CARD FAILURE', t.impactPenalty * CARD_HELP.failPenaltyMultiplier] t.impactPenalty comes straight from progression.csv's 'Target Impact (Penalty)' column (core/data.js:202,220), i.e. -50 at Trainee through -600 at O.A.S. But the zone-loss path no longer uses it. script.js:5066-5067: const penalty = count <= 1 ? 0 : M…</sub>

### A41. The scoring page calls the zone-hit event "Zone Impact", which names the zone as the cause — the engine names the same event "Target Impact → Impact Zone"

`files/index.html:235` · **MEDIUM** · PLAUSIBLE · *Laws v1.6 Core Law 6; Overview v1.6 Impact Logic — Dual Naming Convention*

**What:** When an asteroid reaches a base, the engine consistently calls that "Target Impact" arriving at "Impact Zone" — the asteroid caused it, the zone received it. The scoring reference page calls the very same event "Zone Impact", which under the project's own naming rule means the zone caused the impact. The difficulty readout gives it a third name, plain "IMPACT". One event, three names, and the only one that uses a canonical impact-type word points at the wrong party. (Separately, the value on that row — a rank penalty of -50 to -750 — is not what the engine applies for a zone impact any more; damageDefense applies the consecutive-base formula at script.js:5066-5068 and scoring.csv line 31 marks the old rank penalty REMOVED. That part belongs to the scoring dimension; the naming is the claim here.)

**So what:** The one place the game shows a player a canonical impact-type name tells them the zone caused the impact. Worse for a future edit: the game does contain a genuinely zone-initiated impact — the tower's laser destroying the bonus satellite — so a developer grepping "Zone Impact" to find or extend it lands on the receiver event instead, and the name they would correctly reach for is already taken by its opposite.

<sub>Evidence: files/index.html:235: <div class="score-row penalty"><span>Zone Impact:</span><span>Rank penalty (-50 to -750)</span></div> The same event in the engine: files/script.js:4906: // DUAL NAMING: Target Impact (Initiator = asteroid) → Impact Zone (Receiver = defense) files/script.js:5025: // Dual Naming: initiator = Target Impact (asteroid), receiver = Impact Zone (defense) files/script.js:5074: showStatus(`${label}${pen…</sub>

### A42. Each tower impact during the blackout re-enters destroyTower, doubling the repair delay and restarting the countdown it already announced

`files/script.js:1575` · **MEDIUM** · PLAUSIBLE · *Laws v1.6 s0.9 Impact — Impact behaviour must follow engine rules; Overview v1.6 Impact Logic*

**What:** Every further target that lands on the already-downed tower runs the whole tower-destroyed routine again. That bumps the repair delay to the next doubling AND throws away the countdown already running, starting the longer one from scratch. So the repair-unit ETA the player was just shown is a lie, and the wait keeps getting pushed further out. Neither the doubling counter nor the repair counter that also stretches the repair beam is ever capped or reset during a run. The player cannot prevent any of it, because correct commands do nothing while the tower is down.

**So what:** The tower-down lockout can extend itself indefinitely — 4s becomes 8s becomes 16s becomes 32s and the clock restarts each time — with the announced ETA invalidated every time and no player action able to interrupt it. A run can be lost entirely inside a lockout the player cannot act on.

<sub>Evidence: damageDefense excludes the tower from the already-rubble early return, then damages it again (script.js:5030-5044): 5033: if (def.hp <= 0 && def.type !== 'tower') { ... 5045: if (def.type === 'tower') { 5046: AudioManager.play('targetImpact'); 5047: applyDamage(CONFIG.impactDamage, 'impact'); 5048: return; 5049: } applyDamage with shields already at 0 calls destroyTower() again (script.js:1561-1563): 1561: } else if …</sub>

### A43. The difficulty menu advertises a per-rank IMPACT penalty that the dataset itself marks removed and the impact path never applies

`files/script.js:698` · **MEDIUM** · PLAUSIBLE · *Laws v1.6 Core Law 5 — dataset integrity, all data pools must match spec; Technical Manual sD — the Data Sheet is the single source of truth*

**What:** Before the run, the shift-conditions panel tells the player an impact costs them a specific number of points that scales with rank — 50 at the bottom, 600 at the top. The scoring sheet marks that number as retired and replaced, and the code agrees with the sheet: the first base lost actually costs nothing, the second costs 100, and the amount is the same at every rank. The menu is quoting a number that no longer exists anywhere in play. The card-lifeline penalty shown right beneath it is still derived from the same retired number too.

**So what:** The one place the game explains the cost of failure to the player is wrong at every difficulty, and wrong in both directions: it overstates the first base loss (0, not -50) and understates a run of them at low ranks. Anyone tuning difficulty from that panel is tuning against a dead column.

<sub>Evidence: The pre-game readout shows it to the player (script.js:692-699): 697: ['CLEAN KILL', '+' + t.baseHit], 698: ['IMPACT', t.impactPenalty], 699: ['CARD FAILURE', t.impactPenalty * CARD_HELP.failPenaltyMultiplier] t.impactPenalty is the progression.csv "Target Impact (Penalty)" column, -50 at Trainee to -600 at O.A.S (core/config.js:284-291, parsed at core/data.js:202 and 588). But datasets/scoring.csv retires exactly th…</sub>

### A44. Repair-unit flight speed and beam-time escalation are literals in updateAmbulance, and CONFIG.ambulanceSpeed / zoneHeight / shieldRegenStreak are dead keys

`files/script.js:3130` · **MEDIUM** · PLAUSIBLE · *Build Procedure v1.6 s3.1 (config.js holds the shared tunables; cartridges override a safe subset) and s3.3 (core loop timings)*

**What:** The repair ship that brings the tower back has its speed typed into the update function as 500, while the config file declares a repair-unit speed of 400 that nothing reads. Its evasion radius and force, and the rate at which each successive repair takes longer, are literals in the same place. Two more config keys — zone height and the shield-regen streak — are read by nothing at all; the regen function they belonged to is now an empty stub.

**So what:** Setting ambulanceSpeed in config.js has no effect whatsoever, which is worse than the value being absent — it reads as the knob and silently is not. The same is true of the shield-regen streak, so a future editor may believe the shield can regenerate. And how much slower each repair gets — a real difficulty dial, since the tower is down that whole time — can only be changed inside the monolith.

<sub>Evidence: script.js:3126-3133 (updateAmbulance) const penalty = 1 + (state.repairCount - 1) * 0.5; const beamTime = CONFIG.beamDuration * penalty; // --- Steering constants --- const maxSpeed = 500; const seekForce = 3.5; // how hard it steers toward target const damping = 0.92; // velocity damping per frame const arrivalRadius = 12; // snap-to-target distance script.js:3211-3213 (applyAsteroidRepulsion) const repulsionRadius …</sub>

### A45. The whole CAT login terminal is unreachable — its only entry point is a permanently hidden button

`files/script.js:394` · **MEDIUM** · PLAUSIBLE · *none - health issue*

**What:** The 1970s Commodore terminal that asks the player for a name and OASIS number is fully built — markup, styling, typewriter output, its own leaderboard — but the only button that opens it is hard-hidden in the HTML and nothing ever un-hides it. The code path that sets a real player name cannot be reached.

**So what:** Every score saved to the leaderboard is named DISPATCHER with a blank OASIS number, so the high-score table can never distinguish two players on the same machine. Roughly 180 lines of JS plus a full overlay and its CSS ship on the public site as dead weight, and the boot-era login screen the shell aesthetic is built around is invisible.

<sub>Evidence: script.js:341-343 `// CAT login (dispatcher info) removed for now — go straight to the main menu.` / `// Default the dispatcher identity so scoring/leaderboard still work.` / `if (!player.name) player.name = 'DISPATCHER';` script.js:394 `function showCATLogin() {` ... the only call site is script.js:820-825 `document.getElementById('change-player-btn').addEventListener('click', () => { ... showCATLogin(); });` index.…</sub>

### A46. Four counters commented "for the game-over stats" are incremented and never displayed

`files/script.js:171` · **MEDIUM** · PLAUSIBLE · *none - health issue*

**What:** The satellite-banner bonus and the CARD SHORTHAND lifeline both keep running tallies whose own comments say they are for the game-over screen, but the game-over screen only prints tier, perfect shots and repairs. The numbers are collected all game and thrown away.

**So what:** A player who catches nine banners and burns three lifelines finishes the run with no record of either, so two of the cartridge's headline mechanics give no end-of-run feedback at all. The comments actively mislead: the data looks wired up when the display was never written.

<sub>Evidence: script.js:171-175 `satellitesCaught: 0, // Session total, for the game-over stats` / `satellitesMissed: 0,` / `cardHelp: null, ...` / `cardHelpUsed: 0, // Session total, for the game-over stats` / `cardHelpFailed: 0,` Writes only: script.js:2622 `state.satellitesCaught++;` 2587 `state.satellitesMissed++;` 2687 `state.cardHelpUsed++;` 2727 `state.cardHelpFailed++;` plus the resets at 6630-6631. The game-over panel, sc…</sub>

### A47. Typing the correct command while the repair unit is still en route does nothing at all — no hit, no miss, no message

`files/script.js:2007` · **MEDIUM** · PLAUSIBLE · *Laws v1.6 0.7/0.8 Clear (Hit) and Miss; Technical Manual sE three outcomes (Clear / Miss / Impact)*

**What:** There is a window between the tower being destroyed and the repair unit launching — 4 seconds the first time, then 8, 16, 32 — where the game accepts typing but has no handler for it. Type the right command and absolutely nothing happens: no points, no rejection, no status line, no sound, and the target stays on screen. Type the wrong command in the same window and you get a SYSTEM FAILURE message and a points penalty. So the game answers a wrong answer and ignores a right one.

**So what:** For up to half a minute the player cannot tell whether the console is broken, whether their command was wrong, or whether the game is still listening — and guessing is punished while being correct is not acknowledged. There is no third outcome in the rules for 'input accepted and discarded'.

<sub>Evidence: destroyTower() sets state.towerDisabled = true (files/script.js:1569) but state.rebuilding stays false until the ambulance actually launches (startAmbulance, 3106). handleCommand only guards on rebuilding: 1975 if (state.rebuilding) { 1976 showStatus("TOWER REBUILDING — STAND BY", "miss"); 1977 return; 1978 } So during the whole 4/8/16/32s ETA the command falls through to: 2005 const match = state.asteroids.find(a =>…</sub>

### A48. The lcarsButton sound has no standard-mode voice, and all three of its trigger points run in standard mode — so it never plays

`files/core/audio.js:304` · **MEDIUM** · PLAUSIBLE · *Build Procedure v1.6 s3.6 audio.js; Laws v1.6 0.3 Theme is a cosmetic layer (audio style) — parity between modes*

**What:** The menu button click sound only exists in the holodeck voice set. All three buttons that ask for it — ENTER HOLODECK, EXIT HOLODECK and UPDATE DATASETS — are on menu screens where the audio engine is always in standard mode, so the sound is silent 100% of the time and the holodeck version of it is unreachable code. Every other sound in the game has a voice in both modes; this is the only gap.

**So what:** Three buttons give no audio feedback, ever, and a written synth voice in audio.js can never be heard. Anyone adding a new sound to this cartridge has to remember to write it twice; this one is the standing proof that the requirement is easy to miss.

<sub>Evidence: files/core/audio.js dispatches on mode (60-70): 'if (this.mode === \'holodeck\') { this._playHolodeck(event); } else { this._playStandard(event); }'. _playStandard's switch (78-91) has cases: typing, fire, hit, misfire, laser, laserMisfire, targetImpact, shieldHit, shieldDown, towerDown, spawn, gameOver — there is NO 'lcarsButton' case and no _stdLcarsButton method anywhere in the file. _playHolodeck's switch (291-30…</sub>

### A49. SUBMIT SCORE has no mode guard, so a Beta/Holodeck score enters the same top-100 table unmarked

`files/script.js:509` · **MEDIUM** · PLAUSIBLE · *Laws v1.6 s0.15 (Developer Mode is a restricted testing mode), Core Law 8 (pre-Publish cartridges are demo cartridges); Technical Manual sG (scoring rules are core)*

**What:** The leaderboard accepts a score earned in the cheat mode, or in Holodeck god mode, exactly as if it were an honest run. The end screen shows a MODE: BETA line to the player, but that fact is dropped when the score is written — only name, base, score, rank and date are stored — so the saved row is indistinguishable from a legitimate one and sorts straight to the top.

**So what:** One Beta run permanently pushes real scores off the visible top ten, and there is no way afterward to tell which stored rows were cheated. Andrew loses the leaderboard as a training-progress signal.

<sub>Evidence: script.js:509-523, the submit handler — no check on CONFIG.isBeta or CONFIG.isHolodeck anywhere in it: 509 document.getElementById('submit-score-btn').addEventListener('click', () => { 511 if (!player.name) { ... 'NO PLAYER LOGGED IN' ... return; } 515 const tierLabel = TIERS[state.tier] ? TIERS[state.tier].label : state.tier.toUpperCase(); 516 saveScore(player.name, player.oasis, state.score, tierLabel); saveScore a…</sub>

### A50. Accuracy % is not just unrendered — no attempt or miss tally exists anywhere, so it is uncomputable

`files/script.js:2353` · **MEDIUM** · PLAUSIBLE · *Build Procedure v1.6 s3.4 (hud updates score, accuracy %, shields, streaks, bonus indicators); Laws v1.6 Core Law 4 (preserve all objects and mechanics unless a cartridge specifically overrides them) and 0.2 (a Cartridge must not modify or replace core gameplay logic)*

**What:** Accuracy percentage is one of the five HUD readouts the build spec names, and the Empty Cartridge computes and shows it in both its HUD and its end-of-game screen. Asteroid Command shows the other four (score, rank, streak, shields plus the breach diamonds) and has no accuracy anywhere — not in the HUD, not on the game-over screen, not in the saved high score. The reason it is missing is deeper than a forgotten label: the game never counts how many commands were submitted and never counts a miss. The misfire handler zeroes your streaks and docks points, but it does not tick any tally. The closest thing to a numerator, PERFECT SHOTS, only counts flawless clears, and there is no total to divide it by. So accuracy is not displayable even in principle — the numbers do not exist. This is different from the separately-reported counters that exist but are never shown; those four are real variables sitting unused, whereas these two were never created. The practical effect is that the fix is state plumbing in the run-state block and the command handler, not a one-line template edit — and it carries a design question with it, because someone has to decide what counts against the dispatcher: bad commands only, or bad commands plus asteroids that got through plus failed shorthand cards, each of which gives a materially different percentage.

**So what:** A dispatcher can finish a full session on a typing-accuracy trainer and never learn their error rate. The game-over screen tells them their rank, their flawless-clear count and how many times the tower was repaired, but not the one number that measures the thing being trained — what fraction of the commands they typed were correct. Two runs with identical scores, one typed cleanly and one brute-forced through dozens of misfires, are indistinguishable on the readout and in the saved high-score entry, so the leaderboard cannot separate a skilled operator from a fast guesser. For a future edit this is a trap: anyone asked to "add the accuracy field to the HUD" will open updateHUD, find no state to read, and have to go back and instrument the command handler and the run-state reset at script.js:6620-6646 as well — and if they pick an attempt definition without asking, they silently set the training standard for every trainee.

<sub>Evidence: The string "accuracy" appears ZERO times in files/script.js, files/index.html, files/core/*.js and files/style.css (case-insensitive grep, no hits in any of the four). The only percent formatting in the cartridge is score-multiplier display in files/core/howtoplay.js:29 `const pct = n => Math.round(n * 100) + '%';`. The HUD renderer, files/script.js:2353-2376, emits four of the five specified fields and no fifth: 235…</sub>

### A51. Environmental particles are stepped per frame inside a function that dt-scales everything else, so all fire/smoke/ember VFX are refresh-rate dependent

`files/script.js:4008` · **MEDIUM** · PLAUSIBLE · *none - health issue*

**What:** The aftermath update function receives a per-second time step and uses it correctly for the drifting bugs, the life rafts, the hydro workers and the flour fade-in. The particle system in the middle of that same function ignores it: position, shrink rate and lifetime all advance once per frame instead. So on a 144 Hz monitor every fire plume, smoke column and burning-banner ember rises about two and a half times faster and dies about two and a half times sooner than on 60 Hz, and on a throttled 30 fps machine they crawl and linger. The burning-banner embers are the clearest case, because the code that emits them deliberately limits itself to a fixed number per second and then hands each ember to a system that moves it per frame — the author left a comment at the emitter noting exactly that mismatch. This is the same failure axis as the already-confirmed repair-flight timing bug, in a block nobody had opened.

**So what:** The look of every destroyed-zone fire, the mill smoke, the crashed-freighter sparks and the burning satellite banner changes with the player's refresh rate: short sharp puffs on a high-Hz display, slow heavy plumes at 30 fps. Nothing is gameplay-affecting, but it means the aftermath scene can never be tuned once — and because the flour-ground and Skylon-bug arrays above degrade frame time over a long run, the particles visibly slow down as a side effect of the other two defects, which will read as the fire 'dying down' when it is really the frame rate falling.

<sub>Evidence: `dt` is the parameter of the function (3752: `function updateAftermathVFX(dt)`) and the call site supplies it (4888: `updateAftermathVFX(dt);` inside `function update(dt)` at 1881). Four of the five physics systems in the function use it. The particle step does not: 4006: for (let i = state.environmentalParticles.length - 1; i >= 0; i--) { 4007: const p = state.environmentalParticles[i]; 4008: p.x += p.vx; 4009: p.y …</sub>

### A52. Panel 4 tells the player the CARD lifeline is the only thing that works while the tower rebuilds; catching a banner also works, and pays, while CARD pays nothing

`files/core/howtoplay.js:243` · **MEDIUM** · PLAUSIBLE · *none - health issue*

**What:** The defense grid card says that while the tower is being rebuilt, the CARD lifeline is the only thing that still works. Typing a banner code directly also works during a rebuild — it is deliberately handled before the rebuild block, and the comment in the code says so. That route pays the banner's full points times the chain multiplier. The CARD route pays zero and wipes every streak. So the manual names the worse of the two available actions as the only one available.

**So what:** A player who is down a tower and has a banner in the sky follows the manual, burns a CARD, and gets nothing plus a dead chain, when typing the code straight would have paid full points with the chain intact. The sentence also teaches a false model of the rebuild window, which will mislead anyone reasoning about what else to change there later.

<sub>Evidence: files/core/howtoplay.js:242-243 (Panel 4, NANOMEDIC REPAIR UNIT): + callout('info', '', `The CARD Shorthand lifeline still works while the tower is rebuilding. It is the only thing that does.`) In handleCommand(), the /shorthand branch sits ABOVE the rebuild gate and says so in its own comment — files/script.js:1959-1978: 1959 // Handled before everything else: real CAD commands are "AP 2100 72100" and 1960 // never …</sub>

### A53. scoring.csv is loaded and parsed, but all 57 rows are discarded — the scoring override block is dead code

`files/core/data.js:232` · **MEDIUM** · PLAUSIBLE · *Laws v1.6 Core Law 5 (maintain dataset integrity) and Technical Manual sD (the Data Sheet is the single source of truth)*

**What:** The scoring spreadsheet is fetched, parsed and then thrown away. Its first line is the decorative 'SCORING SYSTEM' banner, so the parser treats that as the column-name row and the real column names end up as ordinary data. Every row then looks nameless and gets skipped by the 'skip headers' guard, so all sixty lines of code that copy multipliers, streak bonuses and micro-rewards out of the spreadsheet never execute. The numbers the game actually uses are the hardcoded ones in the config file. Right now those two sets of numbers agree, so the game plays correctly and the problem is invisible — it only shows up the first time someone tunes a value in the spreadsheet and nothing changes in the game. The same dead block exists a second time in the live dataset-reload path, so the developer reload button also reports success while applying no scoring change at all.

**So what:** The scoring spreadsheet is not actually the source of truth it is written as: tuning a multiplier, a streak bonus or a backspace penalty there has no effect on the game, and the reload button gives no hint of that. The two copies will silently drift apart from the config file over time, and whoever eventually notices will be debugging the scoring maths rather than the header row. Stripping the banner and blank line from the top of scoring.csv (or having the parser find the real header row) makes the whole block live at once — which is itself worth doing deliberately, since it would immediately start overwriting the config defaults.

<sub>Evidence: files/datasets/scoring.csv, first three lines: SCORING SYSTEM,,,,, ,,,,, Scoring Event,Value / Multiplier,Trigger / Condition,Description,UI Flavor Text,Stacks / Resets parseCSV (files/core/data.js:26-38) takes line 1 as the header row, so the column names become data. Running the shipped parser over the shipped file: headers seen by parser: ["SCORING SYSTEM",""] rows total: 57 rows with a usable Scoring Event: 0 ski…</sub>

### A54. A Weight of 0 in any dataset silently becomes 5, so a row cannot be switched off

`files/core/data.js:159` · **LOW** · CONFIRMED · *Laws v1.6 s0.14 Data Pool (values drawn exactly as defined); Laws v1.6 s0.10 Data Sheet (parse and apply exactly as defined)*

**What:** Every weight column is read with a fallback that treats zero as missing, so a base, unit, command or shorthand row given a weight of 0 comes back at 5 - mid-range - instead of being taken out of the draw. A blank cell and a deliberate 0 end up meaning the same thing, and the fallback is applied twice, once at parse time and again inside the random picker. No shipped row uses 0, so this is a trap rather than a live fault.

**So what:** The obvious way to retire a base or unit from the pairing pool - zero its weight in the spreadsheet - instead leaves it appearing at moderate frequency, with no warning anywhere.

<sub>Evidence: core/data.js:159 (bases) `weight: hasBaseWeight ? (parseInt(r['Weight'], 10) || 5) : 5` - and the same `|| 5` pattern for units at 149, commands at 173, shorthand at 84, repeated in the live reloader at 538/548/562. `parseInt('0', 10) || 5` evaluates to 5. The draw itself repeats the coercion: core/data.js:642 `const totalWeight = items.reduce((sum, item) => sum + (item.weight || 5), 0);` and 645 `roll -= (items[i].w…</sub>

### A55. drawDefenseZones — 152 lines of collision-boundary overlay, never called

`files/script.js:5089` · **LOW** · CONFIRMED · *none - health issue*

**What:** A debug visualisation that draws a crawling dashed outline around each structure's hitbox is fully written but never invoked from the draw loop or anywhere else. A screenshot of it survives in the manual pipeline, so it was live at some point and the call was removed without the code.

**So what:** 152 lines that look load-bearing sit in the middle of the render section of an already 7267-line file. The next person tuning hitboxes will either not know the tool exists or will waste time working out why it never appears.

<sub>Evidence: script.js:5084-5089 `// Draws a crawling dashed outline around the collision boundary of every defense.` / `// For the tower: uses the shield dome path when shields are up, chassis rect when down.` / `function drawDefenseZones(ctx) {` — body runs to line 5240 (the next declaration is `function matchedDrawSize(...)` at 5249). Repo-wide grep for the identifier: `./files/script.js:5089:function drawDefenseZones(ctx) {` …</sub>

### A56. The asset-load counter is write-only, and its hardcoded freighter count is off by one

`files/script.js:43` · **LOW** · CONFIRMED · *none - health issue*

**What:** The game counts every sprite as it finishes loading and computes a target total, but nothing ever compares the two — there is no loading gate at all. On top of that the hardcoded freighter count in the total says 13 when only 12 freighters exist, so the two numbers could never have met anyway.

**So what:** The counters read like a working preload gate, so anyone adding a "wait for assets" screen will wire it to totalAssets and get a progress bar that stops one short of the end and hangs forever. Meanwhile the game currently draws whatever has arrived, which is why sprites pop in during the first seconds of play.

<sub>Evidence: script.js:40 `let assetsLoaded = 0;` script.js:43 `const totalAssets = ZONE_ASSET_LIST.length + BG_ASSET_LIST.length + UI_ASSET_LIST.length + ZONE_OBJ_ASSET_LIST.length + ASTEROID_SPRITE_PATHS.length + 13 + 1; // +13 freighter sprites, +1 satellite` Grep for both identifiers across script.js, core/*.js, index.html, style.css and offline-data.js: `totalAssets` appears exactly once (line 43, its own declaration); `asse…</sub>

### A57. The Challenge label is a separate physics body with per-frame spring and friction, so it detaches from its Target and behaves differently by refresh rate

`files/script.js:3673` · **LOW** · PLAUSIBLE · *Build Procedure v1.6 s5 (each Target always has a Challenge attached; they move as a single composite object) + Laws v1.6 s0.4*

**What:** The challenge text is not carried by its rock — it is an independent object with its own velocity, spring pull, friction and screen clamps, plus repulsion from other labels and from every rock on screen. Because its motion is stepped once per frame with no time scaling (unlike everything else in the game), how far it lags behind its rock depends on the monitor's refresh rate: it tracks tightly at 120 Hz and trails visibly at 30 Hz. Near the screen edges it is clamped in place while its rock keeps moving, so the two separate.

**So what:** On a busy screen or a slow frame rate a challenge can sit closer to a neighbouring rock than to its own, and the player has to follow the tether line to work out which challenge belongs to which target — an accuracy penalty that varies by machine. It also means the two halves of a Target are not one object, so anything that repositions or removes a rock has to keep the label in step separately.

<sub>Evidence: updateUIPhysics() 3590-3592 gives each label its own velocity: `const targetY = asteroid.y - asteroid.radius - TETHER.hoverOffset;` / `box.vx += (targetX - box.x) * TETHER.springConstant;` / `box.vy += (targetY - box.y) * TETHER.springConstant;` Integration at 3673-3676 takes no dt at all: `box.vx *= TETHER.friction;` / `box.vy *= TETHER.friction;` / `box.x += box.vx;` / `box.y += box.vy;` (TETHER.springConstant 0.55…</sub>

### A58. Blank or partial rows in commands.csv or bases.csv build a command string with a stray space that the player can never match

`files/core/data.js:169` · **LOW** · PLAUSIBLE · *Laws v1.6 0.10 (Data Sheet parsed exactly as defined); Technical Manual sD (Data Sheet is the single source of truth)*

**What:** The unit list throws away empty rows; the command and base lists do not. One stray comma-only row left behind by a spreadsheet export becomes a real entry with an empty code, and the target it spawns has a command with a leading or trailing space. Since the player's typing is trimmed before comparison, that target cannot be cleared by any input at all — it just falls and takes a landmark. Nothing in the loader warns about it, and the same gap is in the live UPDATE DATASETS reload path.

**So what:** A single trailing blank row in an edited commands.csv or bases.csv ships an unclearable target that appears at random and destroys a landmark every time, with no error message pointing at the CSV. There is no such row today, so this is latent rather than live.

<sub>Evidence: Units are validated, commands and bases are not. data.js:147-151: DATA_UNITS_FULL = unitRows.map(r => { const obj = { id: r[unitHeader] }; obj.weight = hasUnitWeight ? (parseInt(r['Weight'], 10) || 5) : 5; return obj; }).filter(u => u.id); data.js:169-174 has no `.filter`: DATA_ACTIONS = cmdRows.map(r => ({ c: r['Challenge'], m: r['Command'], type: r['Type'], weight: hasCmdWeight ? (parseInt(r['Weight'], 10) || 5) : …</sub>

### A59. BASE_LOOKUP, the base name to base number map, is rebuilt three times and never read

`files/core/data.js:14` · **LOW** · PLAUSIBLE · *Overview v1.6 Dynamic Dataset Logic — Validation: "All Base Name -> Base Number mappings must be correct"; Laws v1.6 0.14 (Data Pool)*

**What:** There is a lookup table mapping each base's plain-English name to its dispatch number, maintained in all three data-loading paths, and nothing in the game ever reads it. The real mapping happens elsewhere: generation pulls the name and the number off the same base record, which is the safer way to do it and is why they never get swapped. The table is leftover scaffolding.

**So what:** Three copies of dead maintenance that read like the authoritative mapping table. The next person to add a base-name lookup will wire it to BASE_LOOKUP, which is correct today only by accident — nothing tests or uses it, so a future loader that forgets to rebuild it fails silently.

<sub>Evidence: Declared at data.js:14 `let BASE_LOOKUP = {};` and rebuilt in all three loader paths — data.js:162-164 (loadGameData), 418-420 (loadFallbackData), 551-553 (applyCSVData), each identical: Object.keys(BASE_LOOKUP).forEach(k => delete BASE_LOOKUP[k]); DATA_LOCATIONS_FULL.forEach(loc => { BASE_LOOKUP[loc.c] = loc.m; }); A repo-wide grep across the cartridge's .js, .html and .css (excluding node_modules) returns only thos…</sub>

### A60. The base name -> base number lookup table is built three times and never read anywhere

`files/core/data.js:164` · **LOW** · PLAUSIBLE · *Overview v1.6 Dynamic Dataset Logic (all Base Name -> Base Number mappings must be correct); Laws v1.6 s0.10 Data Sheet*

**What:** A base-name-to-base-number lookup table is cleared and rebuilt in three separate places in the data loader, and nothing in the whole arcade ever reads it. The real pairing is safe - the challenge text and the command number are pulled from the same row of the base list at the moment of the draw - but the table sitting beside it looks like the place where base numbers are resolved. Aquanaut's design notes already record this same table as dead in that cartridge; here it is unremarked.

**So what:** Anyone auditing or editing base numbering will reasonably edit that table and see no change in the game, and the mapping rule has no single place where it is actually enforced.

<sub>Evidence: core/data.js:14 `let BASE_LOOKUP = {};` then three identical rebuilds - core/data.js:163-164, 419-420 and 552-553, all of the form: Object.keys(BASE_LOOKUP).forEach(k => delete BASE_LOOKUP[k]); DATA_LOCATIONS_FULL.forEach(loc => { BASE_LOOKUP[loc.c] = loc.m; }); A repo-wide grep for BASE_LOOKUP across Game/ returns only those write sites (plus The Aquanaut's own copy and its design doc). Nothing reads it. The actual …</sub>

### A61. scoring.csv is a lossy export: nine replacement characters and every section marker mangled, with a parser workaround for it

`files/datasets/scoring.csv:4` · **LOW** · PLAUSIBLE · *Laws v1.6 0.10 Data Sheet; Build Procedure v1.6 s3.2 (loads CSVs generated from the Excel master)*

**What:** The scoring CSV was exported from Excel with the wrong encoding, so seven section headings lost their dividers and turned into question marks and nine em dashes became replacement characters. The loader has a line that specifically skips rows starting with question marks to cope. The generated offline pack copies the damage through.

**So what:** Every re-export from the workbook loses these characters again, and the parser depends on the damaged form — a clean UTF-8 export would restore the real markers, which the code happens to also handle, but a differently-mangled export would not. More practically, the descriptions in the sheet are the only written explanation of the scoring rules and they are already visibly corrupted for anyone reading them.

<sub>Evidence: The workbook's Scoring sheet uses proper markers — '── BASE SCORING ──', '── STREAK BONUSES ──', '── TYPING PENALTIES ──', '── BASE / ZONE DESTRUCTION PENALTIES ──', '── STREAK MULTIPLIER STEPS ──', '── MICRO-REWARDS & MILESTONES ──', '── RULES & CODE NOTES ──' (read directly out of the .xlsx). scoring.csv has all of them as '??': line 4 ?? BASE SCORING ??,,,,, line 9 ?? STREAK BONUSES ??,,,,, line 16 ?? TYPING PENAL…</sub>

### A62. The comeback bonus swallows the rest of that kill's readout — the player never sees the points or bonuses they just earned

`files/script.js:2029` · **LOW** · PLAUSIBLE · *Laws v1.6 s0.7 Clear (Hit) — Target removed, points awarded; Build Procedure v1.6 s3.4 hud.js reports score, streaks and bonus indicators*

**What:** On the third kill after losing a base, the comeback message takes over and the game returns early, so that kill's own score line and every bonus it earned go unreported. The points are still credited — only the feedback is lost — but if that kill happened to complete a perfect-streak milestone, the one-time announcement for it is thrown away and never shown again.

**So what:** A player recovering from a base loss gets "BACK ONLINE +25" instead of the much larger score they actually just banked, and a milestone like UNSTOPPABLE or LEGEND can be silently consumed by that one kill.

<sub>Evidence: script.js:2015-2033 — score and notes are computed, then the comeback branch returns before any of the notes are shown: 2015: const pts = calcScore(match, bs); 2016: applyScore(pts.total); ... 2024: if (!state.comebackAwarded && state.comebackCounter >= SCORING.comebackTarget) { 2025: state.comebackAwarded = true; 2026: applyScore(SCORING.comebackFlat); 2027: showStatus(`BACK ONLINE +${SCORING.comebackFlat}`, "bonus"…</sub>

### A63. Removed shield-regen mechanic left an empty function the hit path still calls, plus five dead tunables

`files/script.js:2427` · **LOW** · PLAUSIBLE · *Build Procedure v1.6 s3.1 (config.js holds shared tunables … structured so cartridges can override a safe subset)*

**What:** Shield regeneration was taken out but its scaffolding stayed: an empty function the scoring path still calls on every hit, a counter that is incremented and reset but never read, and the tunable that used to drive it. Four more knobs in the config file — zone height, ambulance speed, the card-assist reward, and a whole layout object — are declared and read by nothing.

**So what:** The config file reads as the tuning surface for the cartridge, so editing ambulanceSpeed or scoreOnRescue to rebalance the game changes nothing and the change looks like it silently failed. The empty checkRegen() call also implies a regen system exists, which contradicts the shield rules the manual states.

<sub>Evidence: script.js:2427-2429 `function checkRegen() {` / ` // Shield never regenerates — only the tower can be repaired (by ambulance)` / `}` — an empty body, still called twice: script.js:2028 `updateHUD(); checkTier(); checkCalibration(); checkRegen();` and script.js:2059 `checkRegen();` Its companion state, state.streakSinceShieldHit, is written three times (script.js:1066, 1554 `state.streakSinceShieldHit = 0;`, 2010 `sta…</sub>

### A64. Game over skips the teardown that only restart performs: the pending repair timer stays armed and an open CARD lookup is never cleared

`files/script.js:6690` · **LOW** · PLAUSIBLE · *Build Procedure v1.6 s3.5 ui.js manages screen states Start/Options/Game/Pause/Game Over + return to Arcade hub*

**What:** Ending a run — or quitting to the menu — while a repair is pending does not cancel the repair. The countdown keeps running and fires on the game-over screen, quietly bumping the repair counter and dispatching an ambulance into a game that is over. The same two exit paths also skip the routine that closes an open CARD SHORTHAND lookup, which the routine's own comment says is meant to run at game over. Only pressing START/RESTART actually cleans either of them up.

**So what:** Mostly invisible today because the next start resets all of it, but a timer and a UI lock outlive the run that owns them. Any future change that keeps the render loop alive behind the game-over screen, or that reads repairCount after the run, will surface it as a stray ambulance and a wrong repair count.

<sub>Evidence: startGame() does the teardown, files/script.js:6605-6607: 6605 if (state.ambulancePendingTimer) { clearTimeout(state.ambulancePendingTimer); state.ambulancePendingTimer = null; } 6606 clearTimeout(state.timers.gameOverDelay); 6607 clearCardHelp(); gameOver() (6690-6740) clears only state.timers.gameOverDelay (6696). It never touches state.ambulancePendingTimer and never calls clearCardHelp() — even though the functio…</sub>

### A65. state.devModeUnlocked is written once and never read — nothing can tell that a session entered Dev Mode

`files/script.js:1231` · **LOW** · PLAUSIBLE · *none - health issue*

**What:** Unlocking Dev Mode sets a flag recording that it happened, and no code anywhere ever looks at that flag. It is the only latch that marks a session as having been in the cheat mode, so the toggle-off path, the end screen and the score writer have nothing durable to check — the toggle itself is the only state that survives, and turning it back off erases the trace.

**So what:** There is no clean hook to gate score submission, mark a run as tainted, or skip the re-prompt, which is why the leaderboard has no way to know. Anyone reading the unlock assumes the latch works and builds on it.

<sub>Evidence: `grep -n devModeUnlocked script.js` returns exactly two lines, a declaration and a write, and no read anywhere in the 7267-line file: 188 devModeUnlocked: false, 1231 state.devModeUnlocked = true; Context at 1230-1235: 1230 if (inputPassword === CONFIG.devModePassword) { 1231 state.devModeUnlocked = true; 1232 CONFIG.isBeta = !CONFIG.isBeta; 1233 CONFIG.isBeta ? showBeta() : hideBeta(); By contrast the sibling flag s…</sub>

### A66. Boot glitch-tail durations are frame counts annotated as milliseconds, so the sequence runs 2.4x faster on a 144 Hz display

`files/script.js:6817` · **LOW** · PLAUSIBLE · *none - health issue*

**What:** The two phases that end the cassette-load sequence — the text scramble and the coloured flood — are counted in frames, but the comments next to them state durations in seconds and the block header budgets the whole tail at about 1.4 seconds. Because they advance on the browser's animation frame, the count only means 0.4s and 0.8s on a 60 Hz display. On a 144 Hz monitor the same 24 and 48 frames pass in 0.17s and 0.33s. The hold and the white flash immediately below them are specified in real milliseconds and do not shrink, so the phases also fall out of proportion with each other rather than just running fast uniformly.

**So what:** On a high-refresh monitor the boot's payoff — the deliberate scramble-into-chaos beat before the title screen — is roughly halved and reads as a flicker rather than a glitch, while the flash it hands off to stays full length, so the pacing inverts. On a throttled or busy machine the same phases stretch out instead. Any future attempt to retune the tail will hit a moving target, since the numbers only mean what the comments claim on one specific refresh rate.

<sub>Evidence: Declared as frames but documented, and budgeted, in seconds: 6813: // The scramble → flood → flash that ends the load. A short, sharp hit (~1.4s 6814: // all in) rather than something to sit through — the flood still builds to the 6815: // same density, it just gets there in fewer frames. 6816: 6817: const JITTER_FRAMES = 24; // text scrambles apart (~0.4s) 6818: const CORRUPT_FRAMES = 48; // multicoloured flood (~0.…</sub>

---

## Appendix B — Decision items (38)

These work as built. Each needs Andrew's call. **None has been resolved here.**

### B1. Generated command has no verb slot — the canon's own worked example would be scored as a miss

`files/core/data.js:729` · **HIGH** · CONFIRMED · *Overview v1.6 Dynamic Dataset Logic (Command = [Command PL] [Unit] [Verb] [Base Number]; example "AP 2101 to 72103"); Technical Manual sD*

**What:** The written formula for the answer string has four parts — code, unit, a verb, then the base number — and its own example is "AP 2101 to 72103". The game builds and accepts only three parts, "AP 2101 72103". Because the match is exact, the example printed in the governance doc would be rejected as a wrong command. The game, its HOW TO PLAY panel, the gameplay doc and the real CAD prompt sheet all agree on three parts, so the four-part spec is the odd one out — but the two are on record disagreeing about the single most load-bearing string in the cartridge.

**So what:** Nobody hits this while playing Asteroid Command, but anyone building the next cartridge from the written formula will generate a four-token command and the drill will teach dispatchers a syntax the real console does not use. It also means the spec cannot be used to verify this cartridge — the two can never both be right.

**Options (unresolved):** 1) Amend the formula so the verb slot is Challenge-side only, making the Command three parts (code, unit, base number) — matches the shipped game, the CAD prompt sheet and both existing player-facing docs; no code change. 2) Keep the four-part spec and add the verb to generation plus validation — changes every answer string in the game and invalidates the HOW TO PLAY panel, the gameplay manual and every existing high score. 3) Keep both, declaring the verb optional in the typed command — needs the matcher to accept two forms and needs a ruling on whether typing the verb costs the player anything.

<sub>Evidence: core/data.js:726-731 (the only command-generation site in the cartridge — grep for `command:` returns just this and the copy onto the target at script.js:1796): return { unitID: unitID, challenge: `${action.c} ${loc.c}`, command: `${action.m} ${unitID} ${loc.m}`, type: action.type }; With commands.csv row `Assign to,AP,direction`, units.csv `2101` and bases.csv `Thorold Base,72103,10` (base name stripped of " Base" a…</sub>

### B2. 64 MB of cartridge published to a public site, with 15 MB of PNGs requested before the boot screen and cache-busting on every file

`files/script.js:51` · **HIGH** · CONFIRMED · *none - health issue*

**What:** The cartridge folder is about 64 MB, and it is published to a public web site. Fifteen megabytes of sprites are requested the moment the script is parsed, before the player has even flipped the power switch, and six of the freighter sprites are over a megabyte each. The game-over screen pulls another six-megabyte image. Separately, every script and the stylesheet carry a timestamp on the URL, so the browser is forbidden from reusing any of them between visits.

**So what:** A first-time visitor on a normal connection waits through 15 MB before the boot text finishes, and hits a fresh 6 MB download at the exact moment they lose. Because of the timestamped URLs, a returning player re-downloads all the code every visit rather than any of it coming from cache. Options for Andrew: (a) leave it — it's a training tool on fast connections; (b) recompress the freighter and menu PNGs (they are photoreal art at PNG quality and would drop an order of magnitude as WebP or quantised PNG); (c) defer the freighter fleet and game_over.png until they are first needed instead of loading at parse; (d) keep the timestamp on script.js only during development and drop it for the published build.

<sub>Evidence: Measured with du -cb. files/ total: 64,369,902 bytes. Eagerly requested at script-parse time (all of script.js:45-125 is top level — `ZONE_ASSET_LIST.forEach(name => { ASSETS[name] = new Image(); ASSETS[name].src = ...` at line 52, the same shape for BG/UI/ZONE_OBJ/asteroid/freighter lists, ending at line 122): 15,342,130 bytes across 34 images. Largest single offenders: Freighter_10.png 1,821,588; Freighter_9.png 1,…</sub>

### B3. The dataset's own column names carry the Asteroid theme, and core/data.js is the reader that hardwires them

`files/core/data.js:203` · **HIGH** · PLAUSIBLE · *Build Procedure v1.6 s3 (core modules theme-agnostic) + s3.3 ("abstract Targets, not 'asteroids'"); Technical Manual sG (Data Sheet structure never changes with theme); Laws v1.6 Core Law 5 (dataset integrity)*

**What:** The spreadsheet column that sets how big a falling target is is literally called "Asteroid Radius", the loader in the core data module reads that exact string, and it stores the value under a field with the same name. So the target-size knob for every future game is named after this game's theme. A deep-sea cartridge already had to write code that reads "Asteroid Radius" and calls the answer a creature radius.

**So what:** Every cartridge built from these files must either keep a column named after asteroids in its own spreadsheet, or add another fallback chain like the Aquanaut's. The theme word becomes a permanent part of the shared dataset contract, and each new cartridge adds one more alias to the same two lines — which exist twice in data.js, so both copies have to be kept in step.

**Options (unresolved):** 1) Rename the column to "Target Radius" in the master spreadsheet and the CSVs, rename CONFIG.asteroidRadius to targetRadius, and keep the old names only as read-only fallbacks so existing sheets still load. 2) Declare "Asteroid Radius" / "Max Asteroids on Screen" the canonical schema names for all cartridges forever and drop the per-cartridge alias chains. 3) Leave as-is and accept a growing alias list per cartridge.

<sub>Evidence: files/core/data.js:200-204 (and the duplicate reloader at 586-590): 200 const maxTargets = parseInt(r['Max Targets'] || r['Max Asteroids on Screen'], 10); 203 const asteroidRadius = parseInt(r['Asteroid Radius'], 10) || CONFIG.asteroidRadius; 204 const projectileSpeed = parseInt(r['Projectile Speed'], 10) || CONFIG.projectileSpeed; 221 asteroidRadius: asteroidRadius, files/datasets/progression.csv:1 header row ends: …</sub>

### B4. core/config.js is mostly Asteroid theme data — sprite anchors keyed to one SVG, RGB colours, and a palette keyed to the asteroid art filenames

`files/core/config.js:95` · **HIGH** · PLAUSIBLE · *Build Procedure v1.6 s3 (core modules must not contain theme-specific images, colors or audio) + s3.1 (what config.js is for: fall duration, spawn delay, difficulty rates, max Targets, shields, scoring, streak thresholds); Laws v1.6 s0.18 / Technical Manual sG (theme injection points)*

**What:** The file named config.js in the core folder holds this game's satellite, its laser, its tractor beam and a six-shade green palette keyed to the six asteroid image files by their order on disk. Two of the satellite numbers are pixel coordinates measured inside one specific SVG, so swapping that art breaks them. None of that is a shared setting; it is this cartridge's look and its bonus feature, stored in the module that presents itself as core.

**So what:** Anyone duplicating the core folder to start a cartridge inherits a satellite, a laser, a tractor beam and a green asteroid palette they must delete — which is exactly what happened to the Aquanaut, whose config.js now shares almost nothing with this one. The two files can no longer be diffed or fixed together, so a genuine shared-tunable fix has to be made twice by hand.

**Options (unresolved):** 1) Split the file: keep the genuinely shared tunables (shield strength, damage, spawn/scoring/tier ladder, coordinate system) in core/config.js and move SATELLITE, LASER, CARD_HELP, TETHER and ASTEROID_COLORS into a cartridge-side theme file the game loads after it. 2) Accept that files/core/ means "this cartridge's modules" and rename it (e.g. files/modules/) so nothing reads as shared. 3) Leave as-is and treat every core file as forked per cartridge.

<sub>Evidence: files/core/config.js — of 320 lines, these blocks are theme, not shared tunables: 95 const SATELLITE = { // ...through 170 125 // The source art draws the dish pointing up, so flipping on the x axis aims 130 // Sprite-local anchors, in the SVG's own 128x96 viewBox coordinates. 131 // Retarget these if the sprite art is ever swapped out. 132 dishX: 64, dishY: 15, 133 lampX: 56, lampY: 36, 141 signalColor: '120, 220, 2…</sub>

### B5. The Excel master dataset has drifted badly from the shipped CSVs — re-exporting it would revert live data

`files/datasets/Asteroid Master Dataset.xlsx:0` · **HIGH** · PLAUSIBLE · *Build Procedure v1.6 s3.2 (loads CSVs generated from the Excel master); Technical Manual sD (the Data Sheet is the SINGLE SOURCE OF TRUTH); Laws v1.6 Core Law 5*

**What:** The Excel workbook that the CSVs are supposed to be generated from is four months behind them. It still carries 37 retired units, is missing the Prince Charles base entirely, has twelve unit weights at different values, is missing the three newest progression columns, and spells one unit MHRT where the CSV says MRHT. The CSVs have been hand-edited ahead of the workbook, so the nominal source of truth is now the stale copy.

**So what:** Anyone who follows the documented pipeline and re-exports the CSVs from the workbook silently undoes months of tuning in one step: 37 retired units come back, Prince Charles base vanishes (and any player who learned 72125 starts getting it wrong), twelve unit weights flip, and progression loses Difficulty / Asteroid Radius / Projectile Speed so the difficulty screen loses its skill labels and every rank falls back to the config default radius and projectile speed. Nothing in the folder says which artifact wins.

**Options (unresolved):** Either (a) declare the CSVs the source of truth and retire or clearly mark the workbook as a historical working file, or (b) declare the workbook authoritative and bring it forward — re-add Prince Charles, delete the retired unit blocks, fix the twelve weights, add the three progression columns, and settle MHRT vs MRHT — then re-export. A third option is to keep the workbook but move it out of datasets/ so it cannot be mistaken for a shipped dataset.

<sub>Evidence: Read the workbook's sheets directly (Units, Scoring, progression, Bases, Commands, PowerLine Prompts) and diffed them against the CSVs beside it. Workbook mtime 2026-03-27; units.csv 2026-08-10, bases.csv 2026-07-16, progression.csv 2026-07-27. Units sheet: 103 rows vs units.csv's 67. Only in the workbook (37): 2302 2321 2335 2336 2337 2338 2339 2345 2346 2360-2369 2391-2398 2720-2725 2B02 CARE7 CARE8 MHRT Only in un…</sub>

### B6. The misfire point penalty is the literal -50, written twice — once in the engine and once in the HOW TO PLAY panel

`files/script.js:1912` · **HIGH** · PLAUSIBLE · *Build Procedure v1.6 s3.1 (config.js holds scoring tunables) and s5 (themes must not change scoring logic — the cartridge is where this literal now lives)*

**What:** Every wrong command costs 50 points, but that 50 is typed straight into the code rather than kept with the rest of the scoring numbers, and it is typed a second time in the HOW TO PLAY panel with a hand-written comment pointing back at the engine. The scoring spreadsheet has no row for it at all. The clamp wrapped around it can never do anything, since 50 is nowhere near the 300-point cap.

**So what:** Changing the cost of a wrong command means editing two files and keeping them in sync by hand; miss one and the instructions panel confidently tells the player a penalty the game no longer applies. A tuner editing scoring.csv — the file the code's own comments call the source of truth for scoring — cannot touch this value at all.

<sub>Evidence: script.js:1912-1917 (applyMisfire) const penalty = Math.max(SCORING.maxPenalty, -50); applyScore(penalty); if (state.shieldHP > 0) { applyDamage(CONFIG.misfireDamage, 'misfire'); showStatus(`MISFIRE ${penalty} — ${reason}`, "miss"); core/howtoplay.js:252-254 function misfirePenalty() { return Math.max(SCORING.maxPenalty, -50); // applyMisfire() } SCORING in core/config.js:35-85 has no misfire entry; datasets/scoring.…</sub>

### B7. Dev Mode replaces command validation: any text — or an empty box — clears the oldest target for full rank points

`files/script.js:1980` · **HIGH** · PLAUSIBLE · *Laws v1.6 s0.15 (Developer Mode = restricted testing mode), s0.7/s0.8 (Clear requires a valid Command; a Miss leaves the Target active); Technical Manual sG (input handling and the Hit/Miss decision are core and never change); Overview v1.6 Gameplay Flow*

**What:** The hidden Ctrl+Shift+B / DISPATCH unlock does not open a testing dataset — it installs a branch in the command handler that fires before the game ever compares what was typed. While it is on, hitting Enter destroys the oldest target and pays the full rank hit value no matter what is in the box, including nothing at all. The line that actually checks the command sits below it and never runs, so a session in this mode can never register a wrong command, which is the one thing you would want a test mode for. The empty-Enter penalty is dead in this mode too.

**So what:** Anyone who knows the hotkey and the word DISPATCH (both plain text in the shipped files) can farm an unlimited score by holding Enter, and a tester who switches the mode on to check challenge/command generation gets a screen that says HIT for every keystroke — it cannot surface a bad Base-Name-to-Base-Number pairing or a malformed command, because nothing is compared. Any future change to validation at 2005 is also silently untested in this mode.

<sub>Evidence: script.js:1980-1992 (inside handleCommand, which starts at 1928): 1980 if (CONFIG.isBeta && state.asteroids.length > 0) { 1981 const oldest = state.asteroids[0]; 1982 if (fireProjectile(oldest)) { 1983 const bh = (TIERS[state.tier] || {}).baseHit || 100; 1984 state.streak++; 1985 state.consecutiveBasesDestroyed = 0; // any kill resets base counter 1986 applyScore(bh); 1987 showStatus(`BETA HIT +${bh}`, "hit"); 1988 u…</sub>

### B8. While paused, any ordinary keystroke clicks the highlighted pause button — RESTART MISSION or QUIT TO MENU, no confirmation

`files/script.js:927` · **HIGH** · PLAUSIBLE · *none - playability/input-handling defect; Technical Manual sG lists input handling as core (never theme-varied), and Overview v1.6 Gameplay Flow assumes a paused run is resumable*

**What:** Pausing the game hands the keyboard to the pause menu, and that menu treats every key except the arrows, Escape, Tab, modifiers and the F-keys as "press the button I'm pointing at". Pause deliberately drops focus out of the command box so the arrows can steer the menu, which also means there is no longer anything filtering ordinary letters out. Whichever pause button the mouse last passed over becomes the armed button and stays armed even after the pointer moves away, because hovering sets the selection and nothing ever un-sets it. So in a typing game, a player who hits Escape and then keeps typing — one letter, digit or space — can hit RESTART MISSION or QUIT TO MENU, and quitting throws the run away immediately with no "are you sure" and without ever offering the score for submission. The any-key-activates behaviour is written on purpose (it is what makes PRESS ANY KEY work on the title screen), but it was generalised to every overlay, and the pause overlay is the one where two of the three buttons are destructive. The game-over screen has the same wiring; there it only fires SUBMIT SCORE, which is harmless.

**So what:** A player pauses mid-run, leaves the pointer anywhere in the pause button column, and types one more character out of habit: the run and its score are gone with no confirmation step. Because the hovered selection persists after the pointer leaves the button, the armed destructive button can stay armed for the rest of the pause.

<sub>Evidence: The pause overlay is treated as a keyboard menu, and the keydown gate admits the paused state: script.js:858-862 } else if (gameOverOverlay && !gameOverOverlay.classList.contains('hidden')) { container = gameOverOverlay; } else if (pauseOverlay && !pauseOverlay.classList.contains('hidden')) { container = pauseOverlay; } script.js:900 if (menuButtons.length > 0 && (!state.running || state.paused)) { Any key that is no…</sub>

### B9. HOW TO PLAY states −300 is the hard floor on any single mistake; a failed CARD lifeline is unclamped and reaches −1200

`files/core/howtoplay.js:298` · **HIGH** · PLAUSIBLE · *none - health issue*

**What:** The scoring card tells the player that nothing they can do costs more than 300 points. Failing a CARD lifeline is the one penalty in the game that is never clamped to that limit — it is the rank's impact penalty doubled, so 600 points at Full Time and 1200 at O.A.S. Every other penalty (misfire, debris strike, zone loss) is clamped. The CARD card itself says the opposite of the scoring card: that at high rank a failed CARD is worse than losing a zone. Both statements ship, and only one of them is true.

**So what:** A high-rank player reads the scoring card, concludes a CARD is a bounded 300-point gamble, asks for one, and loses 1200 points — four times the advertised worst case. The two panels also disagree with each other in the same manual, so neither can be trusted as the reference. This needs a call on direction: clamp the CARD failure to maxPenalty like every other penalty, or reword Panel 5 to say the cap applies to everything except the lifeline.

<sub>Evidence: files/core/howtoplay.js:297-298 (Panel 5, SCORING): + para(`<strong>Your score can never drop below zero.</strong> No single mistake costs more than <strong>${num(SCORING.maxPenalty)}</strong>.`) SCORING.maxPenalty is -300 — files/core/config.js:83 `maxPenalty: -300, // No single event deducts more than -300`. Every other penalty path honours it: files/script.js:1912 `const penalty = Math.max(SCORING.maxPenalty, -50)…</sub>

### B10. Which shared-core responsibilities actually live in script.js, and the three that were never written at all

`files/script.js:0` · **MEDIUM** · CONFIRMED · *Build Procedure v1.6 s3.3/s3.4/s3.5 (engine.js, hud.js, ui.js as theme-agnostic core modules)*

**What:** Three of the six core modules were never created. The whole game loop, Target lifecycle, impact resolution, scoring pipeline, HUD and every screen transition sit in one 7,267-line file alongside the theme art and the Niagara set pieces. Two spec'd pieces are simply absent rather than relocated: the HUD has no accuracy percentage and never counts misses, and nothing in the cartridge navigates back to the arcade hub. The repair-delay doubling curve and the beam-time penalty are also written as bare numbers inside the damage handler rather than as tunables.

**So what:** Anyone forking this cartridge inherits the engine by copy, as The Aquanaut already did — which is why a defect fixed in one cartridge stays live in the other. Concretely: the frame-rate and pause-timer defects above are all in code that a shared engine would have held once.

**Options (unresolved):** Options for Andrew, stated neutrally: (a) accept the monolith as the shipped shape and close the shared-engine clauses as obsolete, treating each cartridge as independent; (b) extract only the pieces with a demonstrated cross-cartridge defect cost — the loop/lifecycle and the screen-state machine — and leave HUD and rendering per-cartridge; (c) hold the full s3 split as the target and schedule it. Separately and independently: decide whether accuracy percentage and a return-to-hub control are still wanted, and whether the repair-delay curve should move into config with a cap.

<sub>Evidence: Concrete map of the 7,267-line monolith against Build Procedure s3 (line numbers are function definitions in files/script.js): engine.js (s3.3 — loop, Target lifecycle, difficulty scaling): gameLoop 4743; update 4878 (fall integration, impact test, cleanup, projectile + debris + explosion lifecycles); getSpawnZone 1675; spawnAsteroid 1748; maintainAsteroids 1812; resolveAsteroidCollisions 1708; getImpactAltitude 1654…</sub>

### B11. Two unreachable in-code copies of the Data Sheet, one already missing a column

`files/core/config.js:283` · **MEDIUM** · CONFIRMED · *Laws v1.6 0.10 Data Sheet / Core Law 5; Technical Manual sD (single source of truth)*

**What:** The dataset is duplicated in code twice more, on top of the CSVs and the generated offline pack. The config file holds a full copy of the progression table that nothing ever reads, and it is already out of step with the sheet — it is missing the Difficulty column. The data module holds a hand-typed copy of five datasets, about 150 rows, which I verified is currently correct to the row but which only ever runs if the offline pack fails to load at all, and the page loads that pack every time. Neither copy is generated or checked by anything.

**So what:** Four places now hold the same numbers, two of them dead. Every dataset edit invites someone to update the wrong one, or to update the CSV and leave 150 stale rows sitting in JS that look authoritative to the next reader. The config copy also makes a load-race guard in the menu code permanently pass, so that guard is not actually guarding anything.

**Options (unresolved):** For the config copy: delete it (nothing reads it), or reduce it to an empty object so the load-race guard in restoreDifficulty works as written, or keep it and add the missing Difficulty entries so it at least matches the sheet. For the hand-typed fallback: delete it now that the offline pack covers file:// play, or keep it as a last-resort net and have Rebuild Offline Data.bat generate it too so it can never drift.

<sub>Evidence: Copy 1 — core/config.js:283-292: a complete 8-row duplicate of progression.csv as `const TIERS = {...}`, with every value (min/max, speedMin/Max, spawnMin/Max, maxTargets, baseHit, impactPenalty, asteroidRadius, projectileSpeed) but NO difficulty field, unlike both loaders. It is never read. Both loaders wipe and rebuild it (data.js:188 and data.js:423: `Object.keys(TIERS).forEach(k => delete TIERS[k])`), and init() …</sub>

### B12. Satellite bonus targets have no duplicate protection at all - banners repeat within about four minutes

`files/script.js:2499` · **MEDIUM** · CONFIRMED · *Technical Manual sD Generation Rules ("NEVER generate duplicate Challenge-Command pairs in the same session"); Laws v1.6 s0.4 (a Target must ALWAYS carry an attached Challenge)*

**What:** The asteroids remember what they have already asked; the satellite banners do not. With 35 shorthand codes and a flyby every half minute, the same banner comes round again about four minutes into a run, and can even appear twice in a row.

**So what:** The most visible duplication in the game is on the bonus target, and it is also the one place with zero protection. A player drilling shorthand sees the same code repeatedly instead of being pushed through the list. Note the pool genuinely cannot sustain a long run without repeats (35 codes vs ~37 flybys in 20 minutes), so this is not fixable by a seen-set alone.

**Options (unresolved):** 1) Leave it - repetition is arguably the point of a shorthand drill. 2) Add a short exclusion window (never repeat the last N banners, e.g. N=8), which kills back-to-back and near-repeats without needing a bigger pool. 3) Add a shuffle-bag: cycle all 35 codes in random order, then reshuffle - guarantees full coverage before any repeat. 4) Grow shorthand.csv so a session-long seen-set becomes viable.

<sub>Evidence: script.js:2496-2499: 2496 function spawnSatellite() { 2497 if (!SATELLITE.enabled || state.satellite || DATA_SHORTHAND.length === 0) return; 2498 2499 const pick = weightedRandom(DATA_SHORTHAND); That is the whole selection: one weighted draw, no seen-set, no exclusion list, no "not the same as last time" check (contrast the asteroid path at core/data.js:711-724, and contrast the spawn-zone picker at script.js:1679-1…</sub>

### B13. The dual naming convention covers only one of the three impact relationships the game actually has, and exists only as comments and display strings

`files/script.js:4906` · **MEDIUM** · CONFIRMED · *Laws v1.6 Core Law 6; Overview v1.6 Impact Logic — Impact Types*

**What:** The naming rule is followed carefully, but only for the asteroid-hits-a-base case, and only in prose: comments and the text of on-screen messages. There is no impact type in the code — no enum, no event name, no field on the damage call. The damage function takes just 'impact' or 'misfire'. The game contains two other impact relationships that the rule would also name: the tower's shell destroying an asteroid, and the tower's laser destroying the bonus satellite. Neither carries any impact naming; both are just 'hit' and 'laser'. So the answer to "is the convention implemented" is: partially — one relationship out of three, at the display layer only. Worth knowing that the clause requiring this is retired in the newer, not-yet-dropped rules, so this may be a thing to stop maintaining rather than a thing to finish.

**So what:** As it stands the convention is documentation, not structure: nothing enforces it, and the two impact events it does not cover are the ones a player triggers most often. A developer adding a new impact (a retaliating target, a boss) has one worked example in comments and no code-level slot to plug into, so the next impact is as likely to be named ad hoc as to follow the rule — which is how the inverted "Zone Impact" label already got in.

**Options (unresolved):** 1) Leave it. The convention is retired in the authored v2.0, the one case that is named is named correctly, and no player-visible behaviour depends on the rest. Cost: the inverted label and the ad-hoc naming stay. 2) Finish it at the display layer only — give the projectile kill and the laser kill their initiator→receiver names in status text, and fix the inverted label — matching how the existing case is done, no structural change. 3) Make it structural: one impact-type value threaded through applyDamage/damageDefense/AudioManager so every impact declares its initiator and receiver in code, and the display strings derive from it. Biggest change, and the only version that stops the next impact from being misnamed. 4) Decide the clause is obsolete now and say so explicitly, so this stops being audited.

<sub>Evidence: Named (asteroid → base/tower): files/script.js:1577, 4906, 4909, 5025, 5070 — comments; 5040, 5074, 1578 — status strings. Dataset column "Target Impact (Penalty)" in files/datasets/progression.csv:1 and parsed at files/core/data.js:202, 588. Unnamed (tower projectile → asteroid), the most frequent impact in the game: files/script.js:4970-4975: AudioManager.play('hit'); createExplosion(...); createShatter(...); state…</sub>

### B14. Every clear zeroes the global spawn timer, so a player who keeps clearing never sees the rank's target count

`files/script.js:4970` · **MEDIUM** · CONFIRMED · *Build Procedure v1.6 s3.1/s3.3 — difficulty scaling of spawn timing, fall speed and max simultaneous Targets*

**What:** Clearing a target resets the timer the spawner uses for the next one. That means the real gap between targets is however long the player took to clear, plus the full interval, so the screen only fills up while the player is losing. The maximum-targets figure the difficulty ladder promises — six at the bottom, twenty-five at the top — is unreachable by anyone who keeps up. The comment beside it describes a three-second breather that does not correspond to any configured value.

**So what:** Difficulty scaling largely stops working for a competent player: the pressure the ladder is meant to apply arrives only after they start missing. Either the breather is intended and the Max Targets column is decorative, or the ladder is intended and this reset should go.

**Options (unresolved):** Options: (a) keep the reset as an intended per-kill breather, and accept that Max Targets is a failure-state ceiling rather than a difficulty setting — then correct the misleading comment and the difficulty panel's expectations; (b) drop the reset so the spawner runs on its own rank clock and the target count actually climbs; (c) keep a breather but make it its own short, explicitly configured cooldown that does not rewind the rank spawn clock.

<sub>Evidence: On projectile arrival (script.js:4966-4971): 4967: AudioManager.play('hit'); 4968: createExplosion(target.x, target.y); 4969: state.asteroids = state.asteroids.filter(a => a && a.id !== target.id); 4970: state.timers.spawnTimer = 0; // Enforce full 3-second delay before next spawn 4971: state.projectiles.splice(i, 1); and the spawner only fires once that timer has accumulated past the rank's interval (script.js:1812-…</sub>

### B15. Holodeck unlock has no Demo/Publish mode gate — the password string is the only check

`files/script.js:971` · **MEDIUM** · CONFIRMED · *Laws v1.6 Core Laws 7, 8, 9 + Build Procedure v1.6 s10 (Law 15 / exit button is satisfied)*

**What:** Three governance clauses hang off a Demo-versus-Publish distinction — Holodeck stays off until you switch the build to Publish, everything before that is a demo cartridge, and you switch it only when you say so. The cartridge has no concept of either mode. There is no flag, no build switch, and the word "publish" does not appear anywhere in the cartridge's code or in the hub's. Holodeck is reachable right now in the shipped build: Ctrl+Shift+H opens a 15-second prompt and typing the right phrase lets you straight in. The only thing standing between a player and god mode is not knowing the keystroke and the phrase. The exit side of the rule is fine — the RETURN TO PROGRAM button is there and correctly labelled; this is only about the gate in front.

**So what:** A curious player who tries the obvious dev chord discovers a password box, and anyone who has seen the phrase (or read the source, see the companion finding) gets god mode, sample-only datasets and zone-destruction toggles in what is supposed to be a pre-publish demo build. For future edits there is no single place to turn Holodeck off: a developer asked to "put it back behind the demo gate" has nothing to set, because the gate was never built — the change would mean introducing a mode concept and threading it through the two unlock paths and the nine isHolodeck read sites.

**Options (unresolved):** Option A — treat "disabled until Publish Mode" literally: add one build flag (e.g. CONFIG.mode = 'demo'), have the Ctrl+Shift+H path at script.js:971 refuse to open the prompt while it is demo, and leave it demo until you say otherwise. Ctrl+Shift+H would then do nothing today. Option B — declare the timed password prompt sufficient and the Publish Mode clauses obsolete, and amend the Laws so the canon matches what ships. Option C — split the two: keep the password prompt as the everyday path but make the destructive god-mode toggles (zone destruction, asteroid redirect) the part that requires the flag. Not resolved here.

<sub>Evidence: script.js:963-974 — the shipped document keydown handler: 963 if (e.ctrlKey && e.shiftKey && e.key === 'B') { 964 e.preventDefault(); 965 if (!state.devPromptActive) { 966 showDevModePrompt(); 967 } 968 } 969 if (e.ctrlKey && e.shiftKey && e.key === 'H') { 970 e.preventDefault(); 971 if (!state.holodeckPromptActive && !state.holodeckUnlocked) { 972 showHolodeckPrompt(); 973 } 974 } No mode flag is consulted. script.j…</sub>

### B16. Asteroid's own launcher is unreachable from the hub and the CAT shell — both register files/index.html directly, unlike The Aquanaut

`Game/core/submenu.js:117` · **MEDIUM** · CONFIRMED · *Build Procedure v1.6 s5 (each cartridge includes index.html as its entry point) and Overview v1.6 Modular folder layout*

**What:** There are two ways into this cartridge and they do not behave the same. The launcher file in the cartridge root guards against a missing offline data pack and performs the per-launch storage scrub; the game page itself does neither. The hub menu and the CAT shell both point straight at the game page, so they skip both. Only a person double-clicking the launcher in Explorer ever goes through it. The Aquanaut is wired the opposite way — the hub points at its launcher. Canon names the cartridge's game page as its entry point and does not describe a second launcher at all, so which way Asteroid should be wired is not settled by the documents.

**So what:** Today the hub and CAT paths escape the data loss in the finding above purely by accident of routing, and the two paths disagree about whether saved data survives — which makes any bug report about lost scores irreproducible depending on how the reporter launched. It also means the missing-offline-pack warning, the thing the launcher exists for, never fires for a hub or CAT launch. Whoever later 'fixes the inconsistency' by pointing the hub at the launcher, to match The Aquanaut, would turn the silent wipe on for every hub launch and make the hypothesis that prompted this check literally true.

**Options (unresolved):** Three ways to settle it, stated neutrally. (a) Keep the launcher as the Explorer/offline-only door and leave the hub pointing at files/index.html — then the launcher's storage scrub still has to be fixed or deleted, and the offline-pack guard stays absent from hub launches. (b) Route the hub and CAT shell through "Asteroid Command.html" so both cartridges are wired alike and the offline-pack guard always runs — this MUST be paired with fixing the scrub first, or it enables the data loss on every launch. (c) Retire the separate launcher and fold the offline-pack probe into files/index.html, leaving one entry point per cartridge as canon describes — and revisit The Aquanaut's launcher the same way.

<sub>Evidence: Game/core/submenu.js:116-118 (the hub's cartridge registry): 116 id: "asteroid-command", 117 launch: "cartridges/Asteroid Command/files/index.html", 118 displayName: "Asteroid Command", and submenu.js:389-390 is the only consumer: 389 if (cartridge.launch) { 390 window.location.href = cartridge.launch; Game/cat/disks.js:47-49 (the CAT shell's disk list) does the same: 47 displayName: "Asteroid Command", 49 launch: ".…</sub>

### B17. Clearing a Target resets the spawn timer, so playing well pushes the next spawn back

`files/script.js:4970` · **MEDIUM** · PLAUSIBLE · *Technical Manual sG (never changes with theme: how Targets spawn and fall) + Build Procedure v1.6 s3.3*

**What:** The line that removes a destroyed rock also resets the spawn clock. That means the next rock is timed from the last kill rather than from the last spawn, so the faster a player clears the screen the longer they wait for the next Target — the game gets easier the better you play. The comment beside it claims a three-second delay, but no such value exists in the game; the real interval comes from the difficulty table.

**So what:** Actual spawn cadence does not match what the difficulty screen advertises, and a strong player can hold the spawn rate down indefinitely by clearing quickly. Because the reset lives in the shot-impact code rather than the spawn code, anyone tuning the difficulty table will not find the cause.

<sub>Evidence: Inside the projectile collision block, 4969-4970: `state.asteroids = state.asteroids.filter(a => a && a.id !== target.id);` / `state.timers.spawnTimer = 0; // Enforce full 3-second delay before next spawn` maintainAsteroids() 1819-1838 accumulates the same field and also zeroes it after a spawn: `state.timers.spawnTimer += dt * 1000;` ... `if (state.asteroids.length < state.maxTargets && state.timers.spawnTimer >= ef…</sub>

### B18. The Impact boundary is derived from the theme artwork's transparent padding, including a hardcoded per-sprite exception

`files/script.js:1654` · **MEDIUM** · PLAUSIBLE · *Laws v1.6 s0.9 Impact (impact behaviour must not be altered by themes) + Technical Manual sG*

**What:** Where a falling rock counts as having hit a base is calculated from the pixel dimensions and transparent margins of this cartridge's building artwork, with a named exception hardcoded for one specific building sprite and a fixed 195-pixel figure for the shield dome. The impact line is therefore a property of the pictures, not of the rules, and the same function is what the spawner aims at.

**So what:** Redrawing or replacing any building sprite silently moves the impact line and the spawn aim point, and a re-themed cartridge cannot reuse this logic without editing the impact function itself — which is exactly the code a theme is not supposed to touch. The 195 and the id-1 branch also carry no link back to the art they describe, so a future artwork change will not obviously flag them.

<sub>Evidence: getImpactAltitude() 1654-1665: `function getImpactAltitude(target) {` ` if (target.type === 'tower') {` ` // Shield up: apex of dome is at tower.y - ht = tower.y - 195` ` return state.shieldHP > 0 ? target.y - 195 : target.y - target.h + 20;` ` }` ` // Sir Adam Beck (id 1): large transparent area at top of sprite — lower the impact zone` ` // so asteroids hit the visible building, not the empty space above it` ` if (…</sub>

### B19. The Challenge string never carries the unit — it is a separate label on the rock, so no rendered challenge matches the formula shape

`files/core/data.js:728` · **MEDIUM** · PLAUSIBLE · *Overview v1.6 Dynamic Dataset Logic (Challenge = [Challenge PL] [Unit] [Verb] [Base Name]); Laws v1.6 0.5 / 0.12 (Challenge Template)*

**What:** The written challenge shape puts the unit inside the plain-language call — "Assign Unit 2101 to Thorold". The game splits it: the phrase "Assign to Thorold" goes in the speech bubble and the bare unit number is stamped on the rock underneath. Everything the player needs is on screen and the pairing is correct, but read as text the challenge is two parts, not four, and the phrase alone ("Assign to Thorold") is not a sentence. Whether the composite counts as satisfying the challenge shape is your call.

**So what:** A reviewer checking the cartridge against the formula will read the generated challenge as missing a slot, and the same split will be copied into every future cartridge that forks this generator. For the player, phrasings with no preposition read oddly on their own — the BSE row `Arriving` produces the bubble "Arriving Thorold".

**Options (unresolved):** 1) Rule the composite target (rock label + bubble) as satisfying the challenge shape and record that the unit is a rendered slot rather than a string slot — no code change. 2) Inline the unit in the challenge string so it reads "Assign Unit 2101 to Thorold" — needs the bubble to widen, and the unit label on the rock becomes duplicate information. 3) Keep the split but restate the formula as [Challenge PL] [Base Name] carried alongside [Unit], so the spec describes what is actually built.

<sub>Evidence: core/data.js:728 builds the challenge from only two of the four slots: `challenge: `${action.c} ${loc.c}`,` — the unit is returned as a sibling field (data.js:727 `unitID: unitID,`), not inside the string. Rendering keeps them apart: script.js:6441 `ctx.fillText(a.unitID, 0, 0);` prints the unit on the asteroid body, while script.js:6450 `const text = a.challenge;` prints the phrase in the tethered bubble above it (s…</sub>

### B20. God Mode's command filter hardcodes the four PowerLine codes, so a fifth code in commands.csv can never be generated in Holodeck

`files/script.js:3332` · **MEDIUM** · PLAUSIBLE · *Laws v1.6 0.10 Data Sheet / 0.6 Command; Technical Manual sD (pick one PowerLine Command type from the ACTIVE Challenge Set)*

**What:** The dev-tools command filter builds its list of PowerLine codes from a literal list typed into the code, while the unit and base filters right next to it read the real dataset. Because that literal list also seeds which command types are allowed to spawn in Holodeck, a new command type added to the command sheet would be filtered out of the game there and have no checkbox to re-enable it.

**So what:** Adding a fifth PowerLine code to commands.csv works in normal play but silently disappears in Holodeck — the exact mode used to test new dataset content. The tester sees the challenge type never spawn and no error explaining why.

<sub>Evidence: script.js:3332-3335, inside buildGodModeMenu(): const COMMAND_CODES = ['AP', 'ENP', 'BSE', 'LA']; if (!godMode.activeCommands) godMode.activeCommands = new Set(COMMAND_CODES); if (!godMode.activeUnits) godMode.activeUnits = new Set(DATA_UNITS_SAMPLE.map(u => u.id)); if (!godMode.activeBases) godMode.activeBases = new Set(DATA_LOCATIONS_SAMPLE.map(l => l.m)); The units and bases sets right beside it are derived from t…</sub>

### B21. A CARD SHORTHAND lifeline failure is announced to the player as "TARGET IMPACT → RADIO TOWER" when no target impacted anything

`files/script.js:2737` · **MEDIUM** · PLAUSIBLE · *Laws v1.6 Core Law 6; Overview v1.6 Impact Logic — Dual Naming Convention ("____ Impact" = the object INITIATING)*

**What:** The card-shorthand lifeline routes its failure penalty through the same damage channel a real asteroid strike uses. That is a deliberate design choice and the comment says so. But the channel is the one that, once shields are gone, prints "TARGET IMPACT → RADIO TOWER". So a player who buys the lifeline, lets the banner escape, and happens to have no shields left is told a target caused the tower's destruction — when the cause was their own expired lifeline. The naming rule the rest of the impact code follows carefully is broken here, by reusing the channel rather than by any wrong label being written on purpose.

**So what:** With shields already down, letting a card lifeline expire destroys the radio tower and blames it on a target that never arrived. The player learns the wrong lesson about what just killed their tower, and the repair-ETA doubling counter (state.ambulanceDestroyCount) advances under a false cause.

<sub>Evidence: files/script.js:2735-2737 (card lifeline expired, banner escaped): // 'impact' so it behaves like a real strike: crack, shield hit, and a // downed tower if the shields were already gone. applyDamage(CARD_HELP.failDamage, 'impact'); files/script.js:1561-1563: } else if (type === 'impact') { destroyTower(); } files/script.js:1577-1578 (inside destroyTower): // Constitutional: Target Impact (Initiator) → Impact Zone (R…</sub>

### B22. scoring.csv's base-destruction escalation and backspace tiers are never parsed — the -100 step and the 1/3/5/7 thresholds are literals in script.js

`files/script.js:5067` · **MEDIUM** · PLAUSIBLE · *Laws v1.6 Core Law 5 (maintain dataset integrity) and 0.10 / Technical Manual sD (the Data Sheet is the single source of truth); Build Procedure v1.6 s3.1 (scoring and streak thresholds in config)*

**What:** The scoring spreadsheet spells out the escalating cost of losing bases back to back, the kill-streak multiplier ladder and the backspace bands — and the loader reads none of those rows. The escalation step is typed into the code as -100, the multiplier ladder lives only in the config file, and the backspace boundaries are four bare comparisons. Only the point amounts come off the sheet; every threshold and the escalation rate do not.

**So what:** Editing the -100 / -200 / -300 rows in scoring.csv changes nothing in play, which is a silent no-op for anyone who trusts the sheet. Making a slip forgiving (say, penalties starting at 2 backspaces instead of 1) requires touching the monolith even though the sheet appears to state the rule.

<sub>Evidence: script.js:5066-5067 (damageDefense) const count = state.consecutiveBasesDestroyed; const penalty = count <= 1 ? 0 : Math.max(SCORING.penaltyCap, (count - 1) * -100); datasets/scoring.csv rows that describe exactly this and are never read: '2nd Base Destroyed (consecutive),-100', '3rd Base Destroyed (consecutive),-200', '4th+ Base Destroyed (consecutive),-300', 'Penalty Formula,n/a,"penalty = MAX(0, (consecutive_count…</sub>

### B23. Tower-down repair delay doubles forever from a hardcoded 4-second base with no config entry and no cap

`files/script.js:1576` · **MEDIUM** · PLAUSIBLE · *Build Procedure v1.6 s3.1 (config.js holds difficulty increase rate and the core timings a cartridge may override)*

**What:** When the radio tower goes down, the repair crew's arrival time doubles with every loss in the run — four seconds, then eight, sixteen, thirty-two — from a base value typed into the code. There is no ceiling and nothing resets it mid-run, and the two numbers that define the curve are not in the config file. The audit notes this same curve was ruled deliberate in the sibling cartridge but has never been ruled on here.

**So what:** A player who loses the tower four times waits over half a minute with no defence, unable to clear anything, while asteroids keep landing — the run is effectively over without a game-over screen. Either way, the curve cannot be softened, capped, or turned off from config.js.

**Options (unresolved):** 1) Ratify the curve as-is and move its two numbers (base seconds, doubling factor) into config.js so the shape is at least visible and tunable. 2) Add a cap in config (e.g. a maxRepairDelay) so it plateaus rather than growing without bound. 3) Reset or decay the counter on some recovery condition (a rank-up, a clear screen, a run of kills) so an early mistake does not tax the whole run. 4) Leave the code untouched and record the ruling, matching the sibling cartridge.

<sub>Evidence: script.js:1575-1584 (destroyTower) state.ambulanceDestroyCount++; const delaySec = 4 * Math.pow(2, state.ambulanceDestroyCount - 1); // Constitutional: Target Impact (Initiator) → Impact Zone (Receiver: RADIO TOWER) showStatus(`TARGET IMPACT → RADIO TOWER — REPAIR UNIT ETA ${delaySec}s`, "impact"); if (state.ambulancePendingTimer) clearTimeout(state.ambulancePendingTimer); state.ambulancePendingTimer = setTimeout(() …</sub>

### B24. No way back to the Arcade hub from anywhere inside the cartridge

`files/index.html:127` · **MEDIUM** · PLAUSIBLE · *Build Procedure v1.6 s3.5 — ui.js manages screen states Start/Options/Game/Pause/Game Over + return to Arcade hub*

**What:** Once the hub launches Asteroid Command there is no button, link or key anywhere in the game that goes back to the arcade. QUIT TO MENU and MAIN MENU both mean the cartridge's own menu. The player's only exit is the browser Back button or closing the tab.

**So what:** On a kiosk or full-screen browser with no visible Back button the player is stranded in the cartridge and cannot reach any other game. It also means the hub's cassette-eject fiction has no in-game counterpart.

<sub>Evidence: index.html:124-128 pause overlay — `<button id="resume-btn">RESUME MISSION</button>` / `<button id="restart-pause-btn">RESTART MISSION</button>` / `<button id="quit-btn">QUIT TO MENU</button>` index.html:162-163 game over — `<button id="restart-btn">RESTART MISSION</button>` / `<button id="main-menu-btn">MAIN MENU</button>` Both stay inside the cartridge: script.js:526-535 `document.getElementById('main-menu-btn').ad…</sub>

### B25. The CAT login terminal is unreachable dead UI, so every high score is recorded as DISPATCHER with a blank OASIS number

`files/script.js:341` · **MEDIUM** · PLAUSIBLE · *none - health issue*

**What:** The Commodore-style dispatcher login screen is complete in both markup and code but can never appear: the one button that opens it is shipped hidden and nothing un-hides it. The name is hard-defaulted instead, so the leaderboard fills up with identical DISPATCHER rows and the OASIS number is always empty. The high-scores screen already has a placeholder row hardcoded to that same name (script.js:618).

**So what:** High scores cannot distinguish two players on the same machine, which makes the TOP 10 DISPATCHERS board meaningless in the training-room setting it is built for. Meanwhile about 80 lines of markup and handler code sit in the shipping build with no reachable entry point, and a future edit to the menu could re-expose a half-finished screen by accident.

<sub>Evidence: script.js:340-343 `// CAT login (dispatcher info) removed for now — go straight to the main menu.\n // Default the dispatcher identity so scoring/leaderboard still work.\n if (!player.name) player.name = 'DISPATCHER';\n showMainMenu();` script.js:394 `function showCATLogin() {` — its only call site is script.js:820-825 `document.getElementById('change-player-btn').addEventListener('click', () => { ... showCATLogin();…</sub>

### B26. Both dev passwords ship in cleartext in a file the public Pages site serves

`files/core/config.js:26` · **MEDIUM** · PLAUSIBLE · *Laws v1.6 s0.15 (Developer Mode hidden from regular users in non-demo builds) + Build Procedure v1.6 s6 (timed password prompt); also a plain health issue*

**What:** The Holodeck phrase and the dev-mode phrase are written as plain strings in the config file, and that config file is one of the scripts the browser downloads to run the game. The deploy workflow carefully strips design docs, handoff notes, workbooks and screenshots before publishing, but it cannot strip config.js — the game needs it to boot. So on the live public site anyone can open that one file and read both phrases. The timed prompt is real and works, but as access control it protects nothing once someone views source; the secret and the lock ship in the same box.

**So what:** On the public site, the dev and god-mode gates are open to anyone who opens one URL and reads twenty lines. Combined with the missing mode gate, that means the entire Holodeck surface — zone destruction, asteroid redirect, sample datasets — is effectively public on a build that canon calls a demo. If either phrase is one you reuse elsewhere, it is now published. Moving the passwords out is also not a small local edit: any real fix has to live outside the served bundle, which on a static Pages host means changing the mechanism, not the string.

<sub>Evidence: config.js:24-27: 24 devModePassword: "[phrase removed]", 25 devModeTimeout: 10000, 26 holodeckPassword: "[phrase removed]", 27 holodeckTimeout: 15000 That file is fetched by the browser as a plain served script — index.html:375: `document.write('<script src="core/config.js?t=' + t + '"><\/script>');` It is published. The deploy workflow at C:/Users/darqu/OneDrive/(PCL)/.github/workflows/deploy-pages.yml rsyncs Game/ to the public …</sub>

### B27. Cheat-mode runs submit to the same permanent leaderboard as honest runs, with nothing in the record marking them

`files/script.js:509` · **MEDIUM** · PLAUSIBLE · *Laws v1.6 s0.15 (Developer Mode is a restricted testing mode, hidden from regular users in non-demo builds); Laws v1.6 Core Law 8 (pre-Publish builds are demo cartridges); Technical Manual sG (scoring rules are core and never change)*

**What:** Developer Mode and Holodeck both hand out real points — beta turns any keystroke into a full-value kill, and in Holodeck you can click asteroids dead for full value — yet the score they produce goes into the leaderboard through exactly the same door as a real run. The game-over screen does print MODE: BETA or MODE: HOLODECK, so the intent to mark a cheat run is clearly there, but that label is only text on the overlay. The saved record holds name, OASIS number, score, rank and date and nothing else, so the moment it is filed the run is indistinguishable from an honest one. The flags are still set when SUBMIT is clicked, so the information needed to either block or stamp the submission is sitting right there unused.

**So what:** A dispatcher who taps Ctrl+Shift+B, types DISPATCH and then holds Enter can post an arbitrarily large score that permanently tops the board and can never be identified as a test run. Every honest run below it is pushed down, and because the top-10 check reads the same rows, the High Score music then plays for real runs that no longer deserve it (or, once a padded score is at rank 10, stops playing for runs that do). It also silently corrupts the only leaderboard you have for judging whether the scoring curve is tuned right, and since the login terminal is dead every row reads DISPATCHER, so there is no name to tell the rows apart either.

<sub>Evidence: Submit handler — nothing between the click and the write tests a mode flag (script.js:509-523): 509 document.getElementById('submit-score-btn').addEventListener('click', () => { 510 const statusEl = document.getElementById('score-submit-status'); 511 if (!player.name) { 512 if (statusEl) { statusEl.textContent = 'NO PLAYER LOGGED IN'; ... } 513 return; 514 } 515 const tierLabel = TIERS[state.tier] ? TIERS[state.tier]…</sub>

### B28. Pausing the mission never pauses the music, and the shuffle playlist keeps advancing behind the MISSION PAUSED overlay

`files/script.js:6583` · **MEDIUM** · PLAUSIBLE · *Build Procedure v1.6 s3.6 (audio.js API: loadTrack / playMusic / pauseMusic / stopMusic / setVolume) and Overview v1.6 / Technical Manual sH (separate menu and gameplay tracks; gameplay music loops until the game ends)*

**What:** The audio module was specified to offer five music controls; the two that concern holding a track — a pause and a load — were never written, so nothing in the game can pause music without also throwing it away. Hitting Escape freezes the whole mission but the gameplay music plays straight on behind the MISSION PAUSED card, and because the three gameplay tracks are a shuffle that steps to the next one when a track finishes, a long pause can silently roll the player onto a different track. The stop call is not a workaround: it rewinds to zero and forgets the shuffle, so using it on pause would restart the track from the top and reshuffle on resume. What makes this clearly unfinished rather than a style choice is that the audio file already does the right thing for the other way of stepping away — when the browser tab is hidden it pauses the track in place and resumes it exactly where it stopped, keeping the shuffle intact. That same two-line pattern was simply never wired to the in-game pause.

**So what:** A player who pauses mid-mission to answer the door hears combat music over a frozen screen; come back a few minutes later and the soundtrack has quietly moved on, so resuming drops them into the middle of a different track than the one they paused on. The internal inconsistency is the bigger cost for future edits: anyone who later needs to duck or hold music for a cutscene, the high-score entry or a boss intro finds the intended API method missing, and either re-inlines the raw _musicEl.pause() a third time or reaches for stopMusic and silently destroys the shuffle playlist.

<sub>Evidence: files/script.js:6583-6598 — the entire pause/resume path, with no AudioManager reference anywhere in either function: 6583 function pauseGame() { 6584 if (!state.running || state.paused) return; 6585 state.paused = true; 6586 state.running = false; 6587 if (DOM.input) DOM.input.blur(); 6588 DOM.pauseOverlay.classList.remove('hidden'); 6589 } 6591 function resumeGame() { 6592 if (!state.paused) return; 6593 state.paus…</sub>

### B29. Skylon bug ejector: bugs that land outside the gorge are marked settled and never removed, with no spawn cap

`files/script.js:3837` · **MEDIUM** · PLAUSIBLE · *none - health issue*

**What:** Once Skylon is destroyed it starts ejecting bugs at a fixed chance every frame, forever, with no limit on how many can exist. A bug that lands in the gorge floats away and is cleaned up, but a bug that lands anywhere else is flagged as settled and is then never removed for the rest of the run — it just keeps getting drawn. Because of where Skylon sits relative to the gorge, most bugs land outside it. The nearby crowd systems (hydro workers, flour employees, ice) all have explicit limits; this one does not. The code comment also says the rate is about one bug per second, which is only true on a 60 Hz display — on a 144 Hz monitor it is nearly three per second.

**So what:** Lose Skylon early in a long session and the drawn-bug list climbs monotonically for the rest of that game (roughly 0.7 permanent bugs per second at 60 Hz, ~1.7/s at 144 Hz), each costing a save/translate/rotate/drawImage every frame. After fifteen minutes that is several hundred extra sprite draws per frame on top of everything else. It is cleared on the next game start (6638), so it is a within-run decay, not a leak across runs.

<sub>Evidence: Spawn — no length cap, per-frame probability: 3835: if (zone.id === 2 && zone.destroyed) { 3836: // 2% chance per frame to pop a bug (~1 per second) 3837: if (Math.random() < 0.02) { 3838: state.skylonBugs.push({ ... settled: false }); The only removal path in the whole file (grep for `skylonBugs` returns lines 193, 3838, 4025, 4026, 4033, 4199, 6638 — exactly one splice): 4032: if (bug.x < -20) { 4033: state.skylonB…</sub>

### B30. The manual prints the repair ladder as a closed four steps for a curve the engine never caps and never resets mid-run

`files/core/howtoplay.js:208` · **MEDIUM** · PLAUSIBLE · *none - health issue*

**What:** The defense grid card presents the repair delay as a four-rung ladder ending at 32 seconds. The engine's formula has no last rung and no mid-run reset, and because the shield never comes back, every tower hit after the shield is gone destroys the tower again — so a long run reaches 64, 128, 256 seconds of no gun while rocks keep falling. The printed numbers are also the ambulance's arrival delay, not the repair itself, which lengthens on a separate and different curve.

**So what:** A player in a long run hits a 64-second or longer blackout the manual says cannot happen, cannot fire for over a minute, and can only end the run by losing all four zones. The manual is also the third place this curve is typed out by hand, so a future tuning pass to the engine's formula leaves three stale copies behind. Whether the curve itself should be capped or reset is Andrew's existing open question; what is newly wrong here is that the shipped manual asserts a bound the engine does not have.

<sub>Evidence: files/core/howtoplay.js:207-208 and :241: 207 // Repair delay doubles with every tower loss — destroyTower(). 208 const repairs = [0, 1, 2, 3].map(i => (4 * Math.pow(2, i)) + 's').join(' &rarr; '); 241 + para(`<strong>Each repair takes twice as long as the last: ${repairs}.</strong>`) Renders: 'Each repair takes twice as long as the last: 4s -> 8s -> 16s -> 32s.' The engine's formula is the same but unbounded — files…</sub>

### B31. The canon-mandated silhouette glow on asteroids has exactly one implementation — an unguarded ctx.filter — and the branch holding the portable glow API can never act as its fallback

`files/script.js:6416` · **MEDIUM** · PLAUSIBLE · *Laws v1.6 s0.17 Glow Effect (must follow the PNG silhouette, rotate with the object, never default to bounding-box); Build Procedure v1.6 s9 (glow must follow the PNG silhouette, not the bounding box, and rotate with the object)*

**What:** The glowing outline around each asteroid is produced by one single canvas call — a drop-shadow filter — and that call is the only thing in the entire game that can produce it. Canvas drop-shadow filtering is the one drawing feature that is not universally supported; on a browser that quietly ignores it, the line still runs without error, the asteroid PNG still draws, and the glow simply is not there. Nothing detects that, nothing logs it, and nothing draws a substitute. The code does contain a second, old-fashioned glow that every browser supports, sitting a few lines below — but it is wired to the opposite case, the moment before the asteroid image has finished loading, when there is no shape to outline yet. So it can never stand in. The result is that a required look has no backup and no alarm. Separately, this is also the most expensive way to draw the most numerous thing on screen: at the top difficulty every one of up to 25 asteroids forces its own blurred off-screen redraw, every frame.

**So what:** On any engine that does not implement canvas drop-shadow filtering — notably older Safari/iOS builds, and embedded webviews — asteroids render as flat PNGs with no contour glow at all, and no fallback glow, so the required silhouette look is silently absent. Because the game is served from a public Pages site, that is a visitor-facing outcome nobody would be told about: no console warning fires, the frame draws successfully, and the only symptom is that the targets look wrong. A future maintainer reading lines 6421-6430 will also reasonably assume a fallback exists and that the glow is safe to rely on, when the gate above makes that branch unreachable for any loaded sprite. Performance-wise, the same line makes the glow scale with target count at the worst difficulty, when frames are already tightest.

<sub>Evidence: drawAsteroid, files/script.js:6413-6431 — 6413: // PNG silhouette glow: drop-shadow follows actual PNG shape, not bounding box 6414: if (sprite?.complete && sprite.naturalWidth > 0) { 6415: const glowIntensity = 15 + Math.sin(Date.now() / 200) * 8; 6416: ctx.filter = `drop-shadow(0 0 ${glowIntensity * a.glow}px ${colors.glow})`; 6417: 6418: ctx.drawImage(sprite, -size / 2, -size / 2, size, size); 6419: ctx.filter = '…</sub>

### B32. No cartridge.json — the metadata canon puts in it is hardcoded in the hub registries instead

`Game/core/submenu.js:117` · **LOW** · CONFIRMED · *Build Procedure v1.6 s5 — each cartridge must include index.html, style.css, script.js, optional cartridge.json (id, name, description, themeColors, configOverrides)*

**What:** The cartridge carries no manifest of its own. Its id, display name, blurb, screenshot and launch path are typed into the hub's cartridge list, and again into the CAT computer's disk list, so the same facts exist in two places with no shared source. Canon calls the manifest optional, so this is a judgement call rather than a violation.

**So what:** Renaming the cartridge, changing its blurb or moving its entry page means editing two hub files by hand, and the two lists can drift apart without anything noticing. Adding a cartridge stays a hub edit rather than dropping a folder in.

**Options (unresolved):** (a) Leave it — canon says optional, and with only three cartridges two registries are cheap to keep in sync. (b) Add cartridge.json per cartridge and have the hub and the CAT disk box read it, so the cartridge owns its own metadata. (c) Keep hardcoded registries but collapse Game/core/submenu.js and Game/cat/disks.js onto one shared list so the facts exist once.

<sub>Evidence: A recursive search for `cartridge.json` under Game/cartridges/Asteroid Command (excluding node_modules) returns nothing. The metadata canon assigns to that file lives in the hub instead — Game/core/submenu.js:116-122 `id: "asteroid-command",\n launch: "cartridges/Asteroid Command/files/index.html",\n displayName: "Asteroid Command",\n status: "available",\n screenshot: "cartridges/Asteroid Command/files/assets/Menus/…</sub>

### B33. The repair curve's numbers live in three hardcoded places while the config key meant for the repair unit is dead

`files/core/config.js:18` · **LOW** · CONFIRMED · *Build Procedure v1.6 s3.1 config.js holds shared tunables, structured so cartridges can override a safe subset*

**What:** The repair unit's tunables are split three ways. The config file has an ambulance speed of 400 that no code reads, while the flight hardcodes 500. The 4-second base and the doubling are hardcoded in the engine and then written out a second time in the manual, so changing one silently makes the other lie. The wait before dispatch doubles; the repair beam itself grows by half again each time; the flight time is a third figure nobody states. The manual's one sentence covers all three as 'twice as long as the last'.

**So what:** Any tuning of the repair penalty has to be made in two or three files that have no reference to each other, and the manual can drift out of true without anything failing. Right now a dead config key advertises a speed the game does not use.

**Options (unresolved):** Either (a) lift the repair numbers into CONFIG — base delay, doubling factor, a cap, the beam growth rate, and the flight speed/steering — and have both destroyTower() and the HOW TO PLAY panel read them from there, deleting or wiring up ambulanceSpeed; or (b) accept the hardcoding as deliberate, delete the dead ambulanceSpeed key so it stops advertising a value that has no effect, and leave the manual's derived copy as a known duplicate. A third question sits under both: whether the manual's 'twice as long' should describe the total tower-down time (dispatch wait + flight + beam) rather than only the dispatch wait.

<sub>Evidence: files/core/config.js:18-19: 18 ambulanceSpeed: 400, 19 beamDuration: 2000, Grep across the whole cartridge: 'ambulanceSpeed' appears ONLY at config.js:18 — it is never read. The flight hardcodes a different number, files/script.js:3130 'const maxSpeed = 500;' (plus seekForce 3.5, damping 0.92, arrivalRadius 12 at 3131-3133). The ETA ladder is hardcoded in the engine, files/script.js:1576 'const delaySec = 4 * Math.po…</sub>

### B34. The shorthand dataset exists three times in datasets/; edits to the master-named file do nothing

`files/datasets/shorthand.csv:0` · **LOW** · PLAUSIBLE · *Laws v1.6 0.10 Data Sheet / 0.14 Data Pool; Technical Manual sD (the Data Sheet is the SINGLE SOURCE OF TRUTH)*

**What:** The shorthand list is in the datasets folder four times: the file the game loads, a differently-named CSV that carries the CAD-export name and has a spreadsheet beside it, a backup of that spreadsheet, and an older revision full of typos. Nothing in the folder marks which one the game reads. The two current CSVs agree on all 35 codes; only the loaded one carries the weights.

**So what:** Someone adding a shorthand code opens the file that looks like the master — the one with the .xlsx next to it — edits it, and the game never changes. The stale -TR revision sitting alongside it with four misspelled expansions is another wrong file to pick up.

**Options (unresolved):** Either (a) keep shorthand.csv as the loaded dataset and move the Shorthand Comments files out of datasets/ (or into a working/ subfolder) so only loaded datasets live there, or (b) fold the shorthand sheet into Asteroid Master Dataset.xlsx alongside Units/Bases/Commands so all six loaded datasets have one export home, or (c) point the loader at the CAD-named file — the parser already accepts its header style — and delete the duplicate.

<sub>Evidence: datasets/ holds four shorthand artifacts: shorthand.csv (loaded — core/data.js:139, 458) Shorthand Comments.csv (not referenced anywhere; grep across *.js/*.html/*.py/*.bat returns nothing) Shorthand Comments.xlsx (+ .xlsx.bak) Shorthand Comments-MXl3514410-TR.csv (an older revision — 30 rows, with 'Akcnowledged', 'Allert', 'Reigstered', 'Nursnig') Content diff, Shorthand Comments.csv vs shorthand.csv: same 35 codes …</sub>

### B35. The no-repeat key ignores which of the four phrasings was chosen, cutting the usable pool from 23,584 to 5,896

`files/core/data.js:716` · **LOW** · PLAUSIBLE · *Overview v1.6 Dynamic Dataset Logic - Validation ("NO DUPLICATE Challenge-Command pairs"); Technical Manual sD Generation Rules*

**What:** Sixteen ways of wording an instruction collapse into four command codes, and the memory keys on the code. That makes the check stricter than the rule asks - once a unit and base have been paired with, say, an AP command, the other three AP wordings for that unit and base can never appear in the same game - and it shrinks the room the game has before it hits the 400 limit.

**So what:** Three quarters of the wording variety the dataset offers is unreachable for any given unit/base pairing within a game, and the pool that the 400-entry cap is measured against is a quarter of what the CSVs actually support. It is a conservative choice, not a hole: no duplicate typed command can slip through, only distinct sentences get suppressed.

**Options (unresolved):** 1) Keep the collapse - the player never has to type the same command string twice in a game, which is the stricter reading of the rule. 2) Key on the Challenge row instead (e.g. use action.c or the row index alongside unit and base) - all 16 phrasings become reachable per unit/base and the pool grows to 23,584, but the same command string can then be asked with two different wordings in one game. 3) Keep two sets: a hard one on the command string and a soft one on the phrasing.

<sub>Evidence: core/data.js:716: 716 key = `${action.m}-${unitID}-${loc.m}`; `action.m` is the Command code, not the Challenge phrasing (`action.c`). datasets/commands.csv carries 16 phrasings across only 4 codes - "Post to", "Assign to", "Required at" and "Needed at" all map to AP; "Enroute to", "Mobile to", "On our way to", "Heading to" all map to ENP; and so on (verified: 4 rows per code, no duplicate phrasings). So the key spac…</sub>

### B36. A non-fatal Target Impact on the radio tower reports no impact at all — the initiator/receiver labels built for it are discarded by an early return

`files/script.js:5046` · **LOW** · PLAUSIBLE · *Overview v1.6 Impact Logic — Dual Naming Convention; Technical Manual sE (Impact outcomes)*

**What:** Every impact builds a pair of labels naming who caused it and who received it. The zone-building branch uses them; the tower branch returns before either is read. So the tower — the most important thing an asteroid can hit — is the one receiver the dual naming never reports, except on the killing blow. A player who takes a tower hit sees no impact message at all, just cracks in the dome and a shield number ticking down.

**So what:** Impacts on the tower are silent in the status line, so the player cannot tell a tower strike from a misfire by reading the screen. For a future edit, damageDefense looks like it reports every impact when in fact one of its three branches drops the labels on the floor.

<sub>Evidence: files/script.js:5024-5027: function damageDefense(def, initiator, receiver) { // Dual Naming: initiator = Target Impact (asteroid), receiver = Impact Zone (defense) const initiatorLabel = initiator ? `[${initiator.unitID || 'UNKNOWN'}]` : ''; const receiverLabel = receiver ? receiver.name : def.name; files/script.js:5046-5050: if (def.type === 'tower') { AudioManager.play('targetImpact'); applyDamage(CONFIG.impactDam…</sub>

### B37. The cleared-screen spawn bonus (-500 ms) and the 16-column spawn spread are literals in maintainAsteroids / getSpawnZone

`files/script.js:1831` · **LOW** · PLAUSIBLE · *Build Procedure v1.6 s3.1 (config.js holds spawn delay and spawn reduction rate)*

**What:** Clearing the screen makes the next asteroid arrive half a second sooner — a real pressure valve, and the only spawn-timing number that is not taken from the progression sheet. The 16-column spread that stops asteroids clustering is written as 16 in one function and re-derived as a divide-by-16 in another, with the three-spawn cooldown as a third literal. A comment in the projectile hit path still claims a fixed three-second spawn delay that no rank actually uses.

**So what:** The one knob canon names for rewarding a clean screen cannot be found or changed in config, and if the column count is ever changed for the spread rule, the two places that encode 16 will disagree and asteroids will spawn outside their intended columns.

<sub>Evidence: script.js:1829-1832 (maintainAsteroids) // Effective interval: -0.5 s when the screen is fully cleared const effectiveInterval = state.asteroids.length === 0 ? baseInterval - 500 : baseInterval; The interval either side of it does come from data (script.js:1825-1827 reads tierData.spawnMin / spawnMax, loaded from progression.csv 'Spawn (Min sec)' / 'Spawn (Max sec)' via core/data.js:198-217) — only the reduction is a…</sub>

### B38. Eleven git-tracked files in the cartridge are referenced by nothing and ship to the public site

`files/style.css:333` · **LOW** · PLAUSIBLE · *Laws v1.6 Core Law 13 (modular development: separate files for HTML, CSS, JS, images and music)*

**What:** Eleven files that no code, stylesheet or markup ever touches are committed and therefore live on the public site: two work-in-progress terrain comps named CURRENT and WANT, a moon sprite, the retired land background, three alternate satellite SVGs and the standalone comparison page that was built to choose between them, an empty high-score CSV left from when scores were meant to live in a file, two source spreadsheets, and two prompt/comment CSVs superseded by the six the loader actually reads. One stylesheet comment still claims the retired land background is in use, which contradicts the comment 1500 lines above it that says it was removed.

**So what:** Anyone reading the folder cannot tell which terrain art is current, which satellite is shipping, or which shorthand CSV is authoritative — and the answer only comes from grepping the loader. The two spreadsheets are the dataset masters and are downloadable by anyone who guesses the path. Options for Andrew: (a) leave them as an art/source archive in place; (b) move the WIP art, the sprite-compare page and the alternate satellites into a non-published folder outside Game/; (c) delete the superseded CSVs and empty scores.csv, and fix the stale style.css:1890 comment.

<sub>Evidence: style.css:333 ` /* background_land.png removed — terrain is fully drawn on the canvas */` — the live rule at 334-336 loads only master_background_sky.png. style.css:1890 still claims otherwise: `Uses the actual background_land.png sized/positioned to match the canvas,` while the #main-area::before rule beneath it (1895-1915) uses only linear-gradients and a #00FFFF base colour. The file assets/background_land.png (32…</sub>

---

## Appendix C — Refuted findings (13)

Raised by a finder, killed by verification. Recorded so they are not re-raised.

**C1. core/audio.js names this cartridge's own objects in its event vocabulary, and carries the full themed sound-effect bank**

`files/core/audio.js:88` — Every line the finding cites is factually real — I read them all. It fails on canon: all three citations either don't reach this file or argue the opposite way. **1. The s3 "theme-agnostic core" clause does not govern this file.** s3 constrains the SHARED core modules defined by s2 (`/core` at project root, alongside `/cartridges`). `Asteroid Command/files/core/` is not that. The audit's own ground truth states no shared /core exists anywhere in the repo, and "files/core/*.js being cartridge-loc…

**C2. core/howtoplay.js is this cartridge's story and manual prose, loaded as a fourth core module**

`files/core/howtoplay.js:75` — The finding fails on the canon lens and, underneath that, on its own factual premise. CANON — none of the three cited clauses reaches this file. 1. Build Procedure v1.6 s3 ("core modules are THEME-AGNOSTIC and must not contain theme-specific images, colors or audio") governs the SHARED core engine that s2 places at repo-root /core. Per the audit's own structural ground truth, no such shared core exists anywhere in the repo, and Game/core/ holds only main-menu.js and submenu.js. `files/core/` is …

**C3. The shared difficulty dataset uses this cartridge's theme vocabulary for its column names**

`files/datasets/progression.csv:1` — The two directly-cited artifacts are quoted accurately and every line number is exact (progression.csv:1 does contain "Asteroid Radius"; data.js:200/203 and the offline twins at 586/589 match verbatim; Aquanaut data.js:284/287 match verbatim). But all four load-bearing premises of the finding are false, and each one is what supplies its severity, its canon hook, or its cost argument. (1) "The SHARED difficulty dataset" — it is not shared. `find` across C:/Users/darqu/OneDrive/(PCL)/Game returns …

**C4. The difficulty screen advertises an impact penalty the impact code never applies**

`files/script.js:698` — The finding's canon claim is backwards. It cites "the Data Sheet is the single source of truth" (Technical Manual sD/sG, Laws v1.6 s0.10) to argue the impact code must use progression.csv's "Target Impact (Penalty)" column. But the Data Sheet retires that column itself, in two rows of files/datasets/scoring.csv the finding did not read: - `Penalty Formula,n/a,"penalty = MAX(0, (consecutive_count - 1)) * -100","Capped at -300 per event. E.g.: count=1 ? 0, count=2 ? -100, count=3 ? -200, count=4+ …

**C5. F12 wipes the command box without counting the keystrokes, defeating the typing-accuracy scoring**

`files/script.js:978` — CODE-TRUTH CHECK — the quoted lines are real, but the defect claim is contradicted by nearby code in the same cartridge. 1) The primary citation is accurate. script.js:977-995 reads exactly as quoted: line 978 `if (e.key === 'F12') {`, comment 979 "Refresh the command box — wipe it to a clean slate", 980 preventDefault, 981 `DOM.input.value = '';`, cursor reset 982-986, `return;` at 987, and `if (e.key === 'Backspace') state.backspaces++;` at 989. So the mechanical claim — the early return sits …

**C6. The command the game accepts has no verb, while the canon formula and example do**

`files/core/data.js:729` — The finding's CODE facts are all accurate — I verified every one. What fails is its canon argument: the cited governance does not require the linking word, and the finding omits the clauses that resolve the conflict against it. CODE FACTS (all confirmed): - files/core/data.js:729 `command: \`${action.m} ${unitID} ${loc.m}\`` — no linking word. - files/script.js:1929 `const input = value.trim().toUpperCase();` and 2005 `state.asteroids.find(a => a.command.toUpperCase() === input)` — exact equalit…

**C7. A successful unique pick on the 25th try still wipes the whole no-repeat memory**

`files/core/data.js:718` — The MECHANICAL claim is true — I confirmed it — but the CANON claim it is built on does not hold, and the consequence analysis is quantitatively backwards. Under this lens the finding does not survive as a "broken" item. 1. Mechanics confirmed. files/core/data.js:711-724. `attempts++` (line 717) is the last statement of the do-block, so the 25th iteration always leaves attempts === 25, and line 718's condition `state.usedChallenges.has(key) && attempts < 25` is false on that iteration regardless…

**C8. The word "impact" does four unrelated jobs in the code, including labelling events that are not impacts**

`files/script.js:3118` — CANON LENS — the finding cites Law 6 and the Overview Dual Naming Convention, but neither clause reaches what it is complaining about, and two of its three headline examples are factually inside the impact chain. 1) WHAT THE CITED CANON ACTUALLY BINDS. Law 6 requires "dual naming convention for Impact logic (e.g. 'ZONE IMPACT' vs 'IMPACT ZONE')" and the Overview defines it as: "'____ Impact' = the object INITIATING", "'Impact ____' = the object RECEIVING" (sE repeats it: word before = caused, wo…

**C9. At the top rank a correct command can never clear an off-centre target — the shot is too slow to catch it**

`files/script.js:1849` — The finding's load-bearing claim is that the per-rank Projectile Speed column is never applied — "the tower's shot always travels at one fixed speed, no matter the rank" and "the fix is already sitting unused in progression.csv." That is false. The per-rank value IS wired through, via a write the auditor never looked for. WHAT IS CORRECT - script.js:1849 is quoted verbatim and the line number is right. `speed: CONFIG.projectileSpeed`, set once at fire time. - core/config.js:17 (`projectileSpeed:…

**C10. Cartridge folder layout does not match either canon layout — everything lives under files/, images under assets/**

`Asteroid Command.html:100` — The finding's tree facts are accurate — I re-verified them — but the canon it leans on does not say what the finding needs it to say, and the audit excerpt it was written against dropped the load-bearing word. 1. BOTH cited layout clauses are explicitly RECOMMENDATIONS, not requirements. The audit-context excerpt renders the Overview clause as "Modular folder layout", but the real document reads "Modular Structure / Recommended folder layout:" (Documents/Core Documents/Previous Versions/2. Overv…

**C11. Dev-mode prompt leaks its key handler when the countdown runs out, and the next Ctrl+Shift+B unlock then cancels itself out**

`files/script.js:1217` — The leak mechanism is real, but the finding's load-bearing consequence does not happen — the code contains a line the auditor did not account for, and I proved it by running the cited code path in Chrome. WHAT IS TRUE (read at C:/Users/darqu/OneDrive/(PCL)/Game/cartridges/Asteroid Command/files/script.js:1205-1267) - 1217-1221: the countdown branch does `clearInterval(timerInterval); hideDevModePrompt(); showStatus("ACCESS TIMEOUT","miss");` with no `removeEventListener`. Quoted accurately. - 12…

**C12. Developer Mode's canon job — exposing the test-only Blank Dataset — has no implementation in this cartridge; the hub already owns that same hotkey**

`files/script.js:963` — REFUTED on the canon lens: the finding's central premise — that exposing the test-only Blank Dataset is "Developer Mode's canon job" — is a requirement v1.6 does not make, and its supporting contrast with the hub is factually backwards. 1. The code facts in the finding are accurate. Ctrl+Shift+B at script.js:963-968 calls showDevModePrompt() (script.js:1205-1257), a 10s timed prompt gated on CONFIG.devModePassword "[phrase removed]" (core/config.js:24-25); on success it flips CONFIG.isBeta (script.js:12…

**C13. howtoplay.js is 704 lines of Asteroid Command lore filed inside files/core/ alongside the theme-agnostic modules**

`files/core/howtoplay.js:0` — CANON LENS — the cited clause does not cover this case, and the finding's factual premise is wrong. 1) Build Procedure v1.6 s3 does not govern this folder. s2 places the shared engine at a PROJECT-level /core ("/core shared engine"), and s3's "core modules are theme-agnostic" applies to those shared modules. `files/core/` inside a cartridge is not that folder — it is a directory v1.6 never names. Overview v1.6's modular folder layout for a cartridge is cartridges/<name>/{index.html, style.css, s…

---

## Appendix D — Gaps the completeness critics named

After round 1, three critics were asked what the sweep had missed. Each hypothesis below was
then chased by a dedicated agent; the confirmed results are folded into Appendices A and B.

- Developer Mode unlocks a typing cheat instead of the test dataset it is supposed to expose
- Accuracy % — a required HUD field — is not just unrendered, it is uncomputable because no miss or attempt total is ever kept
- There is no Publish Mode or Demo Mode flag anywhere, so the rule that keeps Holodeck disabled until publish has no implementation — only a plaintext password
- A cheated run's score can be filed to the permanent leaderboard with nothing recording that it was a cheat run
- Pausing the mission does not pause the music, and audio.js has no pauseMusic() to call
- Nobody opened the launcher's storage scrub — its preserve-list is stale, so launching from the hub deletes the leaderboard, the difficulty choice and the manual-seen flag
- The 990-line aftermath-VFX block (script.js 3752-4742) was never opened: settled Skylon bugs are never freed, and its particle pool integrates per frame while everything feeding it is dt-scaled
- The menu keyboard layer (script.js 828-1000) is uncited: any non-navigation key activates whichever button the mouse last hovered, including QUIT TO MENU while paused and SUBMIT SCORE on game over
- files/core/howtoplay.js (704 lines) has zero citations in all 13 dimensions, yet it is a second source of truth for the game's numbers and makes behavioural promises the engine may not keep
- The entire draw layer (script.js 5262-6580, ~1300 lines) is uncited, and the canon-mandated silhouette glow has exactly one implementation with no fallback: ctx.filter drop-shadow
- Launching from the hub deletes the high-score table and the saved difficulty every single time
- A rank lock set in the Holodeck's God Mode keeps overriding every normal game for the rest of the page load
- The VDS readout queues are module globals that no exit path empties, so one run's messages print over the next run's HUD
- Quitting from the pause menu skips the audio teardown, so the broken-radio static and the Holodeck flag follow the player onto the main menu
- A single bad cell in bases.csv leaves a normal-looking title screen where nothing responds, because init() only runs from the data promise's success path

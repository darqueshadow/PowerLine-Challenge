# Pitstop — Race Type A vs Race Type B

> ## ✅ DECISION (2026-07-17): the HYBRID (open question #4) was chosen and built.
> **Type A is now the hybrid:** `AP` & `ENP` are **order-gated only** (type them any
> time — no "too early" wall), but the final **`BSE` arrival is position-gated**
> at `TUNABLES.arrivalGate` (0.66 — about two-thirds into the leg). After `ENP` the car
> **auto-rolls into the base** (`race.arriving` now triggers a beat early in Type A),
> so the arrival gate is always reachable — you just drive up and confirm arrival.
> This keeps the drive-to-the-base moment without any mid-leg walls and can't
> soft-lock. **Type B (fully position-gated) stays behind the toggle** for
> comparison. Toggle label: **Type A · Sprint** ⇄ **Type B · Timed**.
> Code: `config.js` (`arrivalGate`, `legMode` doc), `script.js` (`arrivalGatePos()`,
> the gate branch + arrive-after-ENP in `handleRaceCommand`, mode-aware BSEH hint,
> `LEGMODE_META`). The analysis below is kept for the record.

**Status:** ~~live A/B experiment~~ → **hybrid shipped as Type A**; Type B kept behind the toggle.
**Date:** 2026-07-17 · **Owner:** Andrew
**Toggle:** Race Options → **Race Type** (`Type A · Sequence` ⇄ `Type B · Timed`)

> This doc is for the AI roundtable. It frames one design fork in Pitstop's core
> leg loop, describes both versions as they now play, and lists the open
> questions. Please argue for a winner (or a third option). Nothing here is
> locked — the toggle exists precisely so we can *feel* both before deciding.

---

## The question in one line

When the player posts a unit from base A to base B by typing the PowerLine
sequence **AP → ENP → BSE**, is each command gated by **sequence order** (type the
pattern, the engine drives — *Type A*) or by **track position** (each command
unlocks at a point along the leg — *Type B*)?

The trigger: entering `ENP 2107` flashed the command box **yellow** ("too early").
That amber flash is the position gate rejecting a *valid* command purely on
*timing*. It exposed the fork we'd never explicitly decided.

---

## What both types share (unchanged)

- A **leg** is a three-beat post: `AP <unit> <base>` → `ENP <unit>` → `BSE <unit> <base>`
  (with `BSEH <unit>` as the no-base-code "home" arrival shortcut).
- **Typing is the only throttle.** A correct beat boosts the km/h gauge (scaled by
  how fast you typed it — WPM); the gauge holds briefly, then decays. Stop typing
  and the car **rolls to a genuine stop** (`SPEED.base = 0`, no idle floor).
- A **typo** bleeds speed, scrubs a tire, and can clout a car you're alongside.
- The **driving layer** (opponent traffic, the backspace brake, tire wear, laps,
  place) runs the same in both types. Only the *command gating* differs.

Everything below is about that one difference.

---

## Type A — "Sequence" (type the pattern; the engine drives)

**Rule:** the beats are **order-gated only**. You may type `AP`, then `ENP`, then
`BSE` whenever you like — the game just enforces the correct order and content.
Track position is a **readout of progress, not a rule**. When you clear `BSE`, the
car rolls the rest of the way into the base and the leg completes.

**The player's skill is:** knowing the real PowerLine syntax + base codes, and
typing them *fast and clean*. Speed of the run = speed of your typing (throttle),
minus typos (speed bleed + tire wear), while dodging traffic with the brake.

**Feels like:** a dispatch/typing sprint on wheels — the lineage of this arcade
(Asteroid Command was a typing-defense game). The road, curves and traffic are the
*expression* of how well you're typing, not a separate timing puzzle.

| Pros | Cons |
|------|------|
| No "too early" wall — the reported bug simply can't happen. | Position becomes cosmetic; a fast typist can clear a leg having barely "driven" it. |
| Matches "fast correct typing is the throttle" and the arcade's DNA. | Less of a *driving* game; the map is backdrop. |
| Robust: can't soft-lock (arrival roll guarantees completion). | Depth rests on typing + traffic/tires; if those are thin, so is the game. |
| Trivial to teach: "type the sequence, in order." | The three beats fire in a burst at pace, then a coast — the leg's rhythm is front-loaded. |

---

## Type B — "Timed" (the command is a checkpoint)

**Rule:** each beat unlocks at a **position on the leg** (`gateAP 0.0`,
`gateENP 0.33`, `gateBSE 0.66` — see below). Call a beat before its gate and it's a
no-op with a **"Too early — reach the halfway mark before you call ENP"** radio
line (previously a silent yellow flash). You must *drive to the spot, then make the
call.*

**The player's skill is:** managing momentum so you arrive at each gate with speed
to spare, and timing the call as you roll through it — a rhythm/driving feel with
the commands as beats tied to the track.

**Feels like:** an arcade racer where the radio calls are checkpoints. The map
*matters* — where you are governs what you can do.

| Pros | Cons |
|------|------|
| Position is load-bearing — it's genuinely a *racer*. | Produced the yellow-flash confusion; the telegraph invited a command the gate then blocked. |
| Natural rhythm: call it as you pass the mark. | **Reachability is fragile** — see the finding below. Gates and boost must stay in lockstep or the car stalls short. |
| The three beats spread across the whole leg. | Higher teaching cost ("why won't it take my command?"). |
| Rewards keeping speed up between gates. | Fights "typing is the throttle" — now *place* also gates you. |

---

## The technical finding that shaped the build

Type B has a hidden coupling: **the three beats are also the three throttle taps,
so the gates must sit within a single boost's coasting reach — or the car can't get
to the next gate.**

Doing the arithmetic on the current SPEED model (`boost 50`, `hold 1.2s`,
`decay 24`, `rollDecay 8`, `legRate 0.6`, `base 0`): one optimally-typed boost from
a standing start carries the car to **pos ≈ 0.43** before it rolls to a full stop.

At the **old gates (ENP 0.50 / BSE 0.85)** the car stalled at ~0.43 — *just short of
the ENP gate* — with no command left to type for throttle. **That is the yellow
flash.** Type B wasn't merely annoying; it was a near-soft-lock.

**Fixes applied so Type B is actually playable for the comparison:**

1. **Gates moved to thirds** — `gateENP 0.33`, `gateBSE 0.66` (`core/config.js`
   TUNABLES). Each ~0.43 coast now clears the next gate even from a dead stop, so
   the leg can't lock. Only Type B reads these; Type A ignores them.
2. **Arrival roll** — once all three beats are posted, the car keeps a steady roll
   into the base (`race.arriving`, `updateSpeed`), so a finished sequence can never
   coast to a stop short of `pos 1`. Benefits both types; it's what makes Type A
   safe to un-gate.
3. **"Too early" radio line** replaces the silent amber flash in Type B, so the
   gate reads as a rule, not a glitch (`tooEarlyMsg`, `handleRaceCommand`).

> Note for reviewers: fix #1 is a *symptom* fix. The deeper point is that Type B
> permanently ties gate placement to boost/decay tuning. Every future speed-model
> tweak risks re-breaking Type B's reachability. Type A has no such coupling.

---

## What changed in the code (for reviewers)

| File | Change |
|------|--------|
| `core/config.js` | New `legMode` option (default `'sequence'`) + schema row; gates retuned to thirds. |
| `script.js` | `Race Type` toggle UI (`buildLegModeRow`/`setLegMode`); `race.legMode`/`race.arriving` state; position gate now Type-B-only; arrival roll; `tooEarlyMsg`; BSEH hint is mode-aware. |
| `style.css` | Race Type toggle styling (reuses the Course Type slide look). |

Default is **Type A**. Flip to **Type B** on the Race Options screen.

---

## How to try it

1. Start the dev server (`Start Dev Server.bat`) — the game needs `http://`.
2. Main Menu → Race Options → set **Race Type** (top of the options).
3. Pick a unit, start a race, and post a leg:
   - **Type A:** type `AP 2107 <base>`, `ENP 2107`, `BSE 2107 <base>` back-to-back
     as fast as you can — no waiting.
   - **Type B:** post `AP`, drive to the first third, call `ENP` as you pass it,
     drive on, call `BSE` past the two-thirds mark.

---

## Open questions for the roundtable

1. **Which is the game?** Is Pitstop a *typing/dispatch sprint* (A) or a *timing
   racer* (B)? Everything else (traffic, tires, pit) sits on top of whichever we
   pick.
2. **Does Type A make the map pointless?** If position is cosmetic, is the OutRun
   road/curve work under-used — and does that matter, or is the scenery reward
   enough?
3. **Is Type B's coupling acceptable?** Gate placement is chained to speed tuning
   forever. Worth it for the "call it at the mark" feel?
4. **Hybrid?** e.g. order-gated commands (A) but the *arrival* (`BSE`/`BSEH`) still
   needs the car near the base (a soft position gate on the last beat only). Keeps
   the drive-to-the-base moment without the mid-leg walls.
5. **Difficulty axis?** Could Type B be "hard mode" and Type A "normal" rather than
   an either/or?

---

## My recommendation (non-binding)

**Ship Type A as the default; keep Type B behind the toggle as an experiment.**
It resolves the reported bug outright, matches the arcade's typing-defense DNA and
the stated "typing is the throttle" principle, and it can't soft-lock. Let the
*driving* difficulty live in the parallel layers (traffic, brake, tires) rather than
in position-gating the commands. Revisit Type B (or the hybrid in Q4) if playtests
say the map feels wasted.

---

## Type B — Banner-Window mechanic  ⚠ DESIGN IN PROGRESS (Andrew, 2026-07-17)

> Andrew's direction for making Type B's gate **visible and fun** instead of an
> invisible wall. NOT built yet — this is the agreed shape + open decisions. It
> lives entirely under `legMode === 'timed'`; Type A is untouched.

**Core idea:** each command's gate becomes a *typing window* bracketed by **two
banners** on the road, with a three-stage telegraph:

1. **Shimmer** (heads-up) — SHIFT box lights the next command: "a banner is coming."
2. **OPEN banner** passes — start typing the command now.
3. **CLOSE banner** passes — Enter must be in by here.

Between beats the player **steers the car** (not idle). Type a letter before OPEN =
too-early penalty; finish after CLOSE = missed. **Car handling sets the window
width** (better handling = wider OPEN→CLOSE gap = more grace).

**The load-bearing decision — window = distance or time?**
- **Fixed-distance (RECOMMENDED):** both banners are real objects at track
  positions; car `handling` sets the gap between them. Your *speed* then sets how
  tight the window feels — go faster to win, but the typing window shrinks. Speed
  becomes the risk dial; banners are literally places.
- Fixed-time: CLOSE = X seconds after OPEN. Constant difficulty, but the 2nd banner
  is really a timer, not a place. Not chosen.

**Agreed calls (my recommendations, not locked):**
| Question | Direction |
|---|---|
| Too-early penalty (typed before OPEN) | Auto-brake / speed-scrub (a stumble) — NOT tire damage. Keep damage meaning "wrong content," which it already does. |
| Miss the CLOSE banner (too late) | Speed bleed + the beat **re-arms** so the window comes round again — lose time, not the race. |
| What is "typing too early"? | A **letter** key before OPEN. Steering (arrows/cursor) is free — that's how we separate driving from commanding. |
| Banner readability | Command **text** on both banners (colorblind-safe); color = which command; fill-inversion (OPEN filled / CLOSE outline) = start vs stop; a shrinking bar between them = live timer. |

**Two genuinely new systems this needs (each its own build):**
1. **Steering between beats** — car is auto-centered today; "stir with the cursor"
   means lateral control + a purpose for it (dodge traffic, stay on road).
2. **Banner/window system** — spawn OPEN/CLOSE pairs on the road at the gate
   positions (currently `gateENP 0.33` / `gateBSE 0.66`), plus the too-early and
   too-late checks and car-`handling` spacing.

**Suggested first slice (before the steering layer):** the OPEN/CLOSE banners +
car-type spacing on the **ENP beat only**, no steering yet, so the window feel can
be tested in isolation.

**Still open:** fixed-distance vs fixed-time not finally ratified; exact
handling→gap mapping; whether steering ships with the first slice or later.

---

## SLICE 1 — BUILT ✅ (Code, 2026-07-17) · ENP banners, no steering

The suggested first slice is now in the game (Race Type B → the ENP beat). **Fixed-distance**
as recommended; **no steering** (arrows are free / inert). Type A is untouched.

**What shipped:**
- **OPEN (filled) + CLOSE (outline) gantries** projected onto the road via the same
  `tfProject()` as the traffic (a banner is just a track-positioned object). Both carry the
  **`ENP` text** (colourblind-safe); the OPEN beam holds the **depleting timer bar**, which
  flushes red past two-thirds.
- **Too-early** (a printable key before OPEN) → auto-brake stumble, **no tire damage**, key
  blocked so ENP can't be pre-buffered. **One stumble per approach** (latched — a burst of keys
  won't compound the scrub).
- **Miss** (car crosses CLOSE, or Enter after CLOSE) → speed bleed + the window **re-arms ahead**;
  if there's no room before `safeMaxClose`, the car **holds at CLOSE** until ENP is called
  (soft-lock backstop — a leg can never strand).
- **Reachability crawl floor** (`BANNER.gateCrawl`, timed-mode only): a car can never coast to a
  dead stop short of a gated beat, so the window is always reachable. This is what breaks the
  doc's "gate placement chained to speed tuning" coupling.

**Config:** all knobs live in `core/config.js → BANNER {}`. Files touched: `config.js`, `script.js`,
`index.html`, `style.css`.

**Verified:** syntax + a live-DOM smoke test (AP posts, boost lands, too-early fires & blocks, no
console errors) + a 5-lens adversarial review. Review came back **clean on soft-lock and Type A
regression**; it fixed a stale-WPM-stopwatch double-penalty on the recovery ENP and the per-key
stumble stacking. Banner *rendering* wasn't observed (the automation tab backgrounds rAF) — **eyeball
it live**.

**⚠ Headline tuning knob to feel-test (`BANNER.gapMin/gapMax`):** because this roster's `handling`
anti-correlates with `speed` (they sum to 12), the FAST units (low handling) arrive at OPEN hottest
*and*, under "better handling = wider window," would get the narrowest gap. The gap was widened to
`0.18–0.26` so the crawl floor **catches** the car inside the window for every unit (below ~0.16 the
fast units couldn't type ENP in time — a guaranteed first-pass miss). This is exactly the
fixed-distance coupling to decide by feel — retune against carried-speed cross-*time*, not raw pos.

**Next slices (unchanged):** (2) OPEN/CLOSE on the **BSE** beat; (3) the **steering** layer between
beats. The fixed-distance-vs-fixed-time and final handling→gap calls are still Andrew's to ratify
after a playtest.

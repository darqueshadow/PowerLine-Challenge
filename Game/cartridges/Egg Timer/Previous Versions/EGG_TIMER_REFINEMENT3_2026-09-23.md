> **FILING NOTE — Claude Code, 2026-09-23.** Filed verbatim from Andrew's message in the Egg Timer session
> on 2026-09-23 (Chat's handoff, pasted). Everything below the rule is the handoff as written. Its title says it
> replaces "the earlier Refinement 3 draft if received": **no earlier Refinement 3 draft reached Code**, so there
> was nothing to replace. The packet as it stood before this merge is `EGG_TIMER_CONTEXT_PACKET_refinement2.md`
> beside it.
>
> **Merged into the live `EGG_TIMER_CONTEXT_PACKET.md` 2026-09-23**, each change tagged *(Refinement 3)*, and
> built in `files/` for a local playtest, one local commit per section group so each can be rolled back alone.
> **Not pushed.** It retires the Alt+1–4 ruling (never built) and its hand test, E9, the switcher, MRU order and
> Ctrl+Tab. The gaps found while building are **E13 onward** in the packet's §11.

---

# HANDOFF — Egg Timer: Refinement 3 (replaces the earlier Refinement 3 draft if received)
From: Claude Chat → Claude Code. Decided by Andrew, 2026-09-23. [T] = tunable.
Separate commit(s) so each can be undone. Placeholder art/sound fine; final look is Gemini's.

## 1. Command Line switching (matches real CAD5; replaces ALL earlier switching rulings)
- Tab: move to the NEXT Command Line. Text in both lines is kept.
- Shift+Tab: move to the PREVIOUS Command Line. Text kept.
- F12: move to the NEXT Command Line and CLEAR that line.
- No Shift+F12.
- All wrap at the ends. With 1 Command Line, Tab does nothing and F12 just clears it (matches the arcade-wide F12).
- RETIRE: Alt+1–4 (cancel the Alt hand test), Ctrl+Tab, the switcher pop-up, MRU order, and quick-tap flip.
- KEEP: neon pulse on the active line (own colour, flash on switch), and auto-pause on focus loss.
- Left/Right arrows keep normal text-cursor behavior.

## 2. How-to panel
- Lines, in order:
  - Goal: "Clear the CAVs as soon as they're done, as quick as you can."
  - Switch: "Tab / Shift+Tab: next / previous Command Line (keeps what you typed)."
  - F12: "Next Command Line, cleared."
  - Esc: "Pause."
  - Cleanup: "Hose off the mess between waves."
- Remove the RCAV syntax, AD and VF lines.
- Placement line (Both / Follow Progression only): keep as-is for now; Andrew will reword it later.

## 3. Cleanup banner
- Replace the current Cleanup prompt with a large banner across the TOP of the screen, not covering the playing field.
- Flashes a few times [T] when cleanup starts, then holds steady.

## 4. Fast-forward ("Time Warp")
- Condition: the wave has spawned its last egg AND no egg is currently bold.
- While true: ALL clocks (nests + wall clock) run at 5x [T] the current wave speed.
- When any egg goes bold: back to normal speed. Re-check after each clear/hatch.
- Overtime window stays in the player's seconds; fast-forward never shortens it.
- Indicator: a backlit alien-style panel on the playing field that lights up "TIME WARP" while active. Placeholder look; reserve a spot clear of all nests.

## 5. Splatter
- Slightly more splatter per clear [T].
- Random across the ENTIRE playing field (empty floor, inactive nests, anywhere).
- Layering: splatter draws UNDER all text/readouts (unit, timer, post-it, VF bubble, ERROR), same as the hose. Readouts always stay readable.
- Mess rules otherwise unchanged.

## 6. Wall clock
- Move to the top-right corner of the playing field (left of the how-to panel). Larger again.

## 7. Egg-laying (NEW)
- When a CAV starts (auto-spawn, placed, or auto-opened): a thin umbilical cord drops from the top of the screen straight down to the nest, lowers the egg in, pops off, and snakes back up out of view.
- Timing [T]: drop ~0.3 s, pop ~0.3 s. The CAV clock starts at the pop; the retract happens while the clock runs.
- Layering: the cord draws UNDER all text/readouts, so it never hides another nest's info.
- Pop sound cue. Never blocks typing.

## 8. All 12 nests visible (NEW)
- Always show all 12 nest positions, fixed for the whole game.
- Active this wave: alien-nest look. Inactive: plain/blank.
- Activation order fixed and spread across the field (not clustered) [T].
- Must still fit beside the how-to panel at all measured window sizes.

## Report back
- Built vs. stand-in per section; gaps as E-numbered items, one at a time.
Still no push until Andrew has playtested and approved.

> **FILING NOTE — Claude Code, 2026-09-22.** Filed verbatim from Andrew's message in the Egg Timer session
> on 2026-09-22 (Chat's handoff, pasted). Everything below the rule is the handoff as written. It is the draft
> after the Timer Refinement. The packet as it stood before this merge is
> `EGG_TIMER_CONTEXT_PACKET_timer-refinement.md` beside it, so D6's removed text is kept there.
>
> **Merged into the live `EGG_TIMER_CONTEXT_PACKET.md` 2026-09-22**, each change tagged *(Refinement 2)*, and
> built in `files/` for a local playtest as a change of its own, separate from the Timer Refinement (which is
> commit `46469a4`, so either can be rolled back alone). **Not pushed.** The gaps found while building are
> **E5–E11** in the packet's §11.

---

# HANDOFF — Egg Timer: Refinement 2 (Instructions, Hose, Clock, Switcher, Frying Pan, ERROR)
From: Claude Chat (Senior Developer) → Claude Code
Status: Decided by Andrew, 2026-09-22. For playtest. [T] = tunable.
Keep this as a SEPARATE change from the Timer Refinement, so each can be tested or rolled back on its own.
Merge into the packet as the next draft. Flag any conflict before building. Placeholder visuals/sounds are fine; final look and sound are Gemini's.
Do NOT push to the live site until Andrew has playtested and approved.

## 1. Instructions panel (NEW)
- A basic how-to panel down one side of the screen, visible during play.
- Simple how-to only. One short line each:
  - Goal: clear each egg with RCAV once its clock goes bold, before it hatches.
  - Syntax: `RCAV <unit>`, e.g. RCAV 2101.
  - AD: the post-it tells you when to clear.
  - VF: clear when "Clear Fueling" pops up.
  - Switch Command Lines: Tab (plus Ctrl+Tab when running in Fang Rock).
  - F12: clear the active Command Line.
  - Esc: pause.
  - Cleanup: drag the hose over messes.
- NEVER list CAV durations (VS 10:00 etc.), at any wave. Players must learn them.
- Must not crowd the nests at 12 nests. Flag if the layout can't fit it.

## 2. Hose (cleanup)
- During cleanup, the cursor becomes a hose nozzle; dragging sprays water.
- Look only. The wipe mechanic underneath (click-and-drag) is unchanged. No "grab the hose" step.

## 3. Wall clock
- Make it larger and more pronounced. No behavior change.

## 4. Command Line switcher
- Add Ctrl+Tab as a switch key when running inside Fang Rock only. Tab stays the switch key everywhere (plain browser tab can't capture Ctrl+Tab).
- Switcher list is now MOST-RECENTLY-USED order, not box 1/2/3/4.
- On open, the LAST-USED Command Line is highlighted. A quick tap-and-release flips between the two most recent boxes.
- Other switcher controls unchanged (Tab/Shift+Tab/arrows move, Enter confirms, Esc closes).
- No "ET"/game-board entry in the switcher. Command Lines only.
- F12 unchanged (clears the active box).

## 5. Frying pan (clear animation)
- On a successful RCAV: a frying pan slams down on the egg with a "THONG" sound. Egg becomes a fried egg in the nest.
- Must be fast (under 0.5 s [T]) and must NEVER block typing the next command.
- Fried egg shows timing (split overtime into thirds [T]):
  - Early third (near 100 pts): perfect sunny-side-up + small "ding"/sparkle.
  - Middle third: broken yolk.
  - Last third (near 25 pts): scrambled/burnt + puff of smoke.
- Yolk splatter onto neighbouring nests IS the look of the existing mess. No change to mess rules.
- Hatch: pan comes down late, hits the empty nest with a dull "clunk". Visual only; hatch rules unchanged.
- Rejected entry (see §6): pan does not come down.
- Vary the "THONG" pitch slightly each time [T] so repeats don't grate.

## 6. ERROR on rejected entries
- ANY rejected Enter (RCAV too early, typos, wrong unit, wrong or nonsense CAV code):
  - The Command Line clears.
  - Red "ERROR" shows directly under that Command Line for ~1 s [T].
  - Short buzz sound.
- No score or pool penalty. Retyping is the penalty.
- SUPERSEDES ruling D6 (text stays in box) and the silent rejection of wrong-type CAV codes. Remove/replace both in the packet.

## Still open (unchanged, don't resolve)
- Clock speed replaces vs. stacks with spawn-rate shrink (awaiting skipped-spawn data).
- D3 (Developer Mode phrase).

## Report back
- Built vs. stand-in per section.
- Any gaps found while building, written up for Chat one at a time (E-numbered, like last time).

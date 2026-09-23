> **FILING NOTE — Claude Code, 2026-09-23.** Filed verbatim from Andrew's message in the Egg Timer session
> on 2026-09-23 (Chat's handoff, pasted). Everything below the rule is the handoff as written. The packet as it
> stood before this merge is `EGG_TIMER_CONTEXT_PACKET_refinement3.md` beside it. Merged into the live packet
> tagged *(Refinement 4)*, built one commit per section, and pushed under the standing rule (both rigs green).

---

# HANDOFF — Egg Timer: Refinement 4
From: Claude Chat → Claude Code. Decided by Andrew, 2026-09-23. [T] = tunable.
Standing rule applies: both rigs pass → commit (separate commits per section) and push; one line to Andrew on what went live.
Placeholder art/sound fine; final look is Gemini's.

## 0. Art direction (log in packet, for Gemini and all future work)
- "Juxtaposition": a friendly, fun, family-style cartoon game with a dark, twisted undertone (e.g. the umbilical cord, the baby aliens).

## 1. Umbilical cord: slower, creepier
- Slower: drop ~1.0 s [T], pop ~0.4 s [T], slow snaking retract ~1.5 s [T].
- CAV clock still starts at the pop; the retract runs while the clock runs.
- Placeholder creepiness: a bulge (the egg) travels down inside the cord before it pops out; the cord pulses/twitches; wet "squelch" on the pop.
- Still draws under text; never blocks typing.

## 2. Hose on top
- The hose (body + nozzle + water) draws ABOVE everything on the board: nests, eggs, gunk, readouts. Replaces the earlier "under text / behind nests" rulings (incl. E12).
- It stays below the how-to panel, the Command Lines and the cleanup banner.

## 3. No duplicate unit numbers
- A unit number can never be on more than one nest at a time (placement triggers waiting to be placed count as on the board).
- Within a wave, no unit repeats until the whole unit pool has been used; then refill, still never duplicating one already on the board.

## 4. Even CAV-type mix (shuffle bag)
- Each wave draws CAV types from a shuffle bag holding each of the 7 types once. When the bag empties, refill and reshuffle.
- AD/VF durations stay random within their ranges.
- If the bag replaces existing type weights, flag it as an E-item.

## 5. Nest display boxes: cartoon restyle
- Unit number: white fill, blue font.
- CAV type: grey fill, black font.
- Timer: yellow fill, dark purple font. At bold: hot pink fill, white font.
- Cartoon style: rounded corners, thick dark outline [T].
- EVERYTHING must fit inside its box at all four test window sizes, sized for the widest possible reading (including overtime). Add a rig check for overflow.
- The post-it gets the same fit check.

## 6. Title screen animation (NEW)
- A cute mommy alien with her happy, singing baby aliens, looping on the title screen.
- Juxtaposition twist (placeholder): e.g. one baby with slightly too many teeth, or mommy's smile a touch too wide.
- Music must be an original or public-domain melody.
- Never delays starting the game.

## Report back
- Built vs. stand-in per section; gaps as E-numbered items, one at a time.

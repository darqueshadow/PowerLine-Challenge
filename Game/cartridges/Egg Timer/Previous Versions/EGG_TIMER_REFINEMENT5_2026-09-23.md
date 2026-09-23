> **FILING NOTE — Claude Code, 2026-09-23.** Two blocks from Chat, pasted by Andrew in one message, filed verbatim
> below in the order they arrived: (1) the options-menu creature and the close of the spawn-rate question,
> (2) Refinement 5. Merged into `EGG_TIMER_CONTEXT_PACKET.md` as *(Options creature)*, *(Spawn ruling)* and
> *(Refinement 5)*; the packet before this merge is `EGG_TIMER_CONTEXT_PACKET_refinement4.md`.

---

Egg Timer: options-menu creature (Andrew approved):
- On the mode-selection/options screen, show a different image from the title-screen family: a cute mutant alien family creature (juxtaposition: adorable, slightly wrong).
- Placeholder concept: one cuddly blob with three baby heads, each singing slightly out of tune; gentle idle animation.
- The heads' eyes follow the cursor around the menu.
- Must never block or delay menu input. Title tune keeps playing as now.
- Placeholder art fine; final is Gemini's.

Also closing the spawn question: skipped spawns were W1 1, W2 3, W3 3, W4 4. The spawn-rate shrink is doing real work, so KEEP it stacked with the clock-speed escalation, as built. Log this in the packet. The skipped-spawns line on the game-over screen can stay for now as a debug aid.

---

Egg Timer — Refinement 5 (Andrew approved). Standing rule applies. Placeholder art/sound fine; final is Gemini's.

1. Time Warp glow
- While Time Warp is active, all ACTIVE nests and their display box borders glow in the Time Warp green. Off the instant warp ends.
- Must stay visually distinct from the at-limit (bold) state.

2. Display boxes at the limit
- Unit #: before limit white fill + REGULAR blue font; at/after limit white fill + BOLD dark green font (dark enough to read on white).
- CAV type: grey fill + black font, REGULAR before limit, BOLD at/after limit.
- Timer: unchanged (current at-limit purple/pink fill is approved; Andrew likes it).
- All three change at the same instant. Re-run the fit check with bold text.

3. How-to panel: cartoon look
- Restyle the panel cartoonish, with goofy alien family doodles scattered around the text, rotating now and then [T].
- Text must stay fully readable.

4. Hatchlings (art direction, log in packet)
- When an egg hatches, the creature that escapes should be horrific (contrast with the cute family). Placeholder now; Gemini final.

5. Scary mom face (NEW)
- A scary alien-mom face pops in at random: at most once per wave [T], sometimes not at all.
- Under 1 s [T]. Enters from a screen edge or out of the side panel.
- NEVER covers nests, readouts or Command Lines. Never blocks input. No flashing.
- Sound: creepy hiss/gurgle, not a scream. Low-ish volume [T].

6. Hose label
- A small tag on the hose tap: "CLEANING HOSE: click & drag to spray", with a mouse icon.
- How-to panel Cleanup line: "Click & drag the hose to clean up the mess."

Also from last round: options-menu mutant family creature and closing the spawn question (see previous block), if not already built.

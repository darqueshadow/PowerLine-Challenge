> **FILING NOTE — Claude Code, 2026-09-23.** Chat's handoff (Andrew approved), pasted by Andrew, filed verbatim
> below. Merged into `EGG_TIMER_CONTEXT_PACKET.md` as *(Panel & lights)*; the packet before this merge is
> `EGG_TIMER_CONTEXT_PACKET_refinement5.md`.

---

Egg Timer — How-to panel everywhere + arcade lights (Andrew approved). Standing rule applies. Placeholder look fine; final is Gemini's.

1. How-to panel on every screen
- Show the how-to panel on ALL screens (title, mode selection/options, gameplay, cleanup, game over), same right-side placement as in-game.
- Must fit alongside the title family, the options creature and the setup controls at all four test window sizes. Flag as an E-item if any screen can't fit it.

2. Arcade attract lights (NEW)
- Bulb-style lights around/behind the panel's edges, blinking on and off at random, like an arcade machine drawing players over.
- Menu screens (title, options, game over): full attract mode, lively random blinking/chasing.
- During gameplay and cleanup: calm mode, a slow, dim twinkle only, so it never pulls attention from the nests.
- SAFETY: no light (or group) may flash more than 3 times per second, in any mode. Add a rig check.
- Text on the panel must stay fully readable; lights never sit behind words.

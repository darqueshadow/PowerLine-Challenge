# Handoff: Egg Timer Splat Art

Andrew has added two new approved art sheets to the asset folder. They show what a whacked egg looks like after the hammer hits: the egg is smooshed flat, and the grossness escalates across five stages.

## The two sheets

1. **Splat sheet:** five flat splats in a row on a dark grey background, left to right from neat to disgusting.
   1. Neat broken egg: pale egg white with a golden yolk and a sparkle
   2. Runny yellow yolk with drips
   3. Olive-green goo with a limp purple antenna
   4. Purple slime with a flattened purple spider-like alien, dizzy swirl eyes on stalks
   5. Purple goo with a flattened alien, tangled legs and tentacles, dizzy X and swirl eyes
2. **Shell sheet:** ten broken pieces of the green spotted eggshell in a 5×2 grid on a dark grey background.

## What's needed

- **Cut everything out** into separate sprites with transparent backgrounds: five splat sprites and ten shell sprites. The thick dark plum outlines should make the edges clean. There's a stray dark square in the splat sheet's background, above and between stages 1 and 2; it goes away with the cut-out.
- **Layer shell pieces on top of each splat at runtime.** Don't bake them in.
  - Scale them down so they read as fragments, not halves. They're drawn much larger than they should appear.
  - Pick pieces at random and apply random rotation and flipping, so no two splats look identical.
  - Keep every piece inside or on the edge of the splat's outline. Nothing flies outside it.
  - Stage 1 gets few pieces (about 3–4); stage 5 gets the most (about 6–8), with the stages in between scaling up.
- **All five splats display at the same size.** Only the grossness changes between stages, never the size.

## Not decided yet (Andrew's call, don't assume)

- What triggers each stage in gameplay, e.g. level, score, streak or random.
- Whether any of this art also replaces the table decor in the Arcade room (currently the cracked egg with red eyes). For now, treat it as game art only.

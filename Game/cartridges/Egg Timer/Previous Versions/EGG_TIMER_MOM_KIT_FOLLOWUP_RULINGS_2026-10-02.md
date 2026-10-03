# Egg Timer — Chat's rulings on the Mom kit build (2026-10-02), filed verbatim

Pasted by Andrew into the Egg Timer session, 2026-10-02 (evening). Filed by Claude Code, word for word.

---

Chat rulings on the Mom kit build (Egg Timer). Four items. Report only after each is done and both rigs pass; do not push until item 4.

1. GIGGLE (flash safety)
- Hold pose C for at least 0.5s with a gentle bob. One swap in, one swap out.
- Max 2 pose changes per second across the whole visit.
- If this does not fit the 1.5s visit, tell me what you need. Do not speed anything up.
- Under reduce-motion: no bob. The tongue wobble then runs for the whole hold.

2. E58: use "nest"
- Mom comes down inside her own nest's box, smaller if needed, covering only her own nest.
- Condition (a): her visit must not hide the unit number or timer of the egg she is visiting while the player could still need it. Confirm this.
- Condition (b): report every screen size where her head falls below about 60 px.

3. DROOL/SPLAT COLOUR: change to glowing PURPLE (it was yolk yellow)
- Purple matches her mouth, stands apart from the green aliens, and cannot be confused with the yolk-coloured goo.
- Keep the thick dark outline #1a0d2e and the glossy highlight streaks.
- Apply to the drool strand, the falling drop and the splat.
- GLOW: a soft halo that follows the actual shapes, not a bounding box. Steady, or a slow gentle pulse no faster than once per second. No flicker. Max 2 flashes per second applies.
- Reduce-motion: static glow, no pulse.
- The glow must stay clear of timers, nests, readouts, Command Lines, trough and sink, the same as the splat itself. Include the glow in the safe-landing check.
- Wash-off is unchanged, and the glow fades with the splat.

4. PUSH
- After items 1-3 pass both rigs, check whether the PLC session is mid-edit on docs/decisions.md. If it is, keep both sets of lines.
- Then push under the standing rule.

FILING
- File these rulings in docs/decisions.md, the design packet and CLAUDE.md.
- Update the art brief and art README if the colour change affects them.

FINAL REPORT (short, plain English)
- Commit hashes and rig results.
- Screen sizes where her head falls below about 60 px.
- Whether the unit number and timer stay visible during the visit.
- Anything that looked wrong or that you did not do.

---

## Chat's answers to Code's report (2026-10-02, later), filed verbatim

Chat rulings on the Mom kit report:
1. 2.2s visit approved. The 2-pose-changes-per-second rig check stays.
2. Purple glow approved as steady (no pulse).
3. Leave the giggle sound where it is (on turning to face the player). Andrew will judge it in Rec-Bay 4.
4. Push now under the standing rule, including the two commits from the other session. One-line report when done.
5. Small heads: no change yet. I'm confirming with Andrew what screen sizes real stations use. If any run below 1920x1080 I'll come back with a ruling for nests 9 and 10.
Add the 2.2s visit, the step-5 length (4.4s) and the small-screen head sizes to docs/decisions.md as known facts.

# Board lights and Time Warp dark: Chat's ruling, verbatim (2026-09-25)

Pasted to Code by Andrew. Filed unchanged; the packet merge is tagged *(Board lights)*.

```
Egg Timer: board lights and Time Warp dark (Chat ruling, 2026-09-25)

Board colour (during play)
- A faint, pale tint on a board that stays dark: just bright enough to notice,
  never distracting. The art has dark outlines drawn for a dark background, and
  the yellow/pink timers must keep their contrast.
- Offer Andrew 2-3 swatches to pick from in playtest; add the chosen one to theme.css.

Lights
- White circles of random sizes at random spots on the board, drawn behind
  everything (nests, eggs, text boxes, clock, Command Lines).
- Timed to the music's beat using a BPM value stored with each gameplay track
  (a simple beat clock, not beat detection). Until the music is in, use a
  placeholder BPM.
- Each light fades in and out slowly over several beats: no snapping on or off.
  Start at most one new light per beat, keep only a few showing at once, and
  keep them faint enough that they never wash out a timer, readout or caption.
  Nothing may flash more than 2 times a second.
- Mute doesn't stop the lights (they follow the beat clock). Pause freezes them.

Time Warp
- When Time Warp starts, the board and its lights fade to dark (about half a
  second, a fade, not a flash). Eggs, nests, their text boxes, the clock, the
  Time Warp sign, its caption and the bolts are NOT darkened.
- When Time Warp ends, the board and lights fade back.

Reduced motion
- No lights. The Time Warp dark still happens, as a fade.

Rigs must cover: no flash over 2/sec, readouts still legible over a light, and
the Time Warp dark leaving the listed parts untouched. Normal commit/push rule.
Bring anything that needs a design call back to Chat as an E-numbered item.
```

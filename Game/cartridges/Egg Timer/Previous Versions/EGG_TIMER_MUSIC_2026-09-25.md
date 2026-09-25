# Music: Chat's ruling, verbatim (2026-09-25)

Pasted to Code by Andrew. Filed unchanged; the packet merge is tagged *(Music)*.

```
Egg Timer: music (Chat ruling, 2026-09-25)

Three Suno tracks, in Game/cartridges/Egg Timer/files/assets/music/
(Andrew's path: C:\Users\darqu\OneDrive\(PCL)\Game\cartridges\Egg Timer\files\assets\music).
They replace the current title tune. The title scene's animation stays as it is.

1. "Egg Timer - Title Screens": title, mode selection and options screens.
   Loops 34.72 s -> 92.58 s (about 58 s, about 144 BPM). The track's own ending
   (a fade) is outside the loop.
2. "Egg Timer - Ticking Clcck (extended)": gameplay, first wave to game over.
   Loops 9.24 s -> 151.99 s (about 2:23, about 129 BPM). The track's last 10 s
   are an ending, outside the loop. The last minute of the loop is about 3 dB
   louder than its start: apply a gentle linear volume ramp over the loop's last
   60 s so the end matches the start (Chat tested a 2.9 dB ramp: the join then
   matches within 0.2 dB). Use the extended file, not the original 1-minute one.
3. "Egg Timer - Game Over": game over screen. Plays ONCE, no loop.
File names have a typo ("Clcck"); rename all three per rule 5 (lowercase, hyphens).

Loops
- Chat measured the loop points on the MP3s. Check them against the files you
  use (WAV if Andrew has them, which is preferred), and snap them to the beat.
- Suno's repeats aren't sample-identical, so bake a short equal-power crossfade
  (about 80 ms) into each loop file at the join: the loop's end blends into the
  audio just before the loop start. No gap and no click at the join.
- Bake the gameplay track's volume ramp into its loop file too.
- Only the trimmed loop files (and the game-over track) the game plays should go
  to the live site. The full-length source files in files/assets/music/ sit inside
  the published game folder: check whether they'd be deployed and keep them off
  the live site (they can stay in the repo). Keep files web-friendly in size.
  Tell Andrew what you decide.

Game over screen
- First, report the game-over screen's current buttons and keys.
- There must always be a clear way back to the title screen: a button, with Enter
  as its key if it's the default. Add one if it's missing. If there is also a
  Play Again, keep it.
- Pressing any button that leaves the game-over screen fades the game-over music
  out (about half a second) and goes where the button says.
- If the player does nothing, the game-over music plays to its end, then the game
  returns to the title screen by itself, and the title music starts there.

Behaviour
- Changing screens: fade out and in (about half a second), no hard cuts. The
  menu screens share one track, so moving between them doesn't restart it.
- Pause (Esc): gameplay music pauses and resumes where it stopped.
- Background tab: all music pauses (extend the existing title-tune rule).
- Mute (E24 button, M, Ctrl+M) covers all music. Master level only, no slider.
- Level: gameplay music sits clearly under the sound effects (THONG, error buzz,
  hiss, egg-laying sounds). The player must never miss a sound cue because of the
  music.
- Time Warp doesn't change the music.
- The board lights (separate ruling) time their fades to the gameplay track's
  BPM: about 129; confirm it from the file.

Record provenance (titles, Suno prompts, Max Mode used for the extension, date,
Andrew's approval) with the art README or a matching music note. Andrew has the
prompts. Normal rig/commit/push rule. Bring design calls back to Chat as
E-numbered items.
```

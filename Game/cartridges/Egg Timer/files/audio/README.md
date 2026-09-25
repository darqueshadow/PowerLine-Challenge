# Egg Timer music: provenance

*Not published: the deploy drops `*.md`, but the repo is public, so keep this to credits and provenance.*

- **Made with:** Suno (Custom mode, Instrumental on). The prompts were written by Claude (Chat) on 2026-09-25 and
  approved by Andrew the same day; the generated tracks were chosen by Andrew and ruled into the game by Chat on
  2026-09-25.
- **Settings, as Andrew remembers them:** the gameplay track's **extension** used **Max Mode**, **Weirdness 70%** and a
  **2:10** extension, with everything else left as it was. **Not recorded:** the settings of the original generations
  (Chat had suggested Style Influence about 70% and the Weirdness shown per track below; Andrew doesn't recall changing
  them), and **which of the two title prompts** (main or alternate) made the title track.
- **Sources:** Andrew's full-length MP3s in `files/assets/music/` (git-ignored: never committed, never published).
- **Prepared by Claude Code** with `make-music.py` (beside the rigs; never published). Each loop file is the track up
  to its loop's end with an 80 ms equal-power crossfade baked in at the join; the loop points are Chat's (measured on
  the same MP3s), checked against the audio, the join matched by waveform, then both points moved together onto the
  beat. The tempo comes from the loop: a whole number of bars. The gameplay loop also has a linear volume ramp over its
  last 60 s (−3.07 dB), so its end matches its start within 0.2 dB. Details in `music.json`.

| Game file | Source (Suno title) | Where it plays | Loop (s) | Tempo |
|---|---|---|---|---|
| `title-screens-loop.mp3` | "Egg Timer - Title Screens" | title, mode selection and options screens | 34.668 → 92.532 (34 bars) | 141.02 BPM |
| `ticking-clock-loop.mp3` | "Egg Timer Countdown" (file "Egg Timer - Ticking Clcck (extended)"), extended in Suno with **Max Mode** (Weirdness 70%, a 2:10 extension) from inside its steady section (about 1:05) to about 3:01 | play, first wave to game over | 9.198 → 151.940 (78 bars) | 131.15 BPM |
| `game-over.mp3` | "Egg Timer Nest Loop" (file "Egg Timer - Game Over") | the game-over screen, once | none (plays once) | 113.45 BPM |

## The prompts

**1. Title Screens.** Style: *Goofy 8-bit chiptune arcade attract-mode theme, 1980s sci-fi cartoon, bouncy square-wave
lead melody, wobbly theremin-style synth, cartoon boings and laser zaps, silly wordless alien vocal chops, punchy retro
drums, instant catchy hook from the very first beat, upbeat 140 BPM, major key, playful and mischievous, instrumental,
no fade-out.* Exclude: *slow intro, fade out, ballad, rap, spoken word, realistic vocals, lyrics, orchestral.* Weirdness
fairly high (60–70%). (Alternate, offered too; which of the two was used wasn't recorded: *Silly Sega Genesis FM synth arcade theme, 1980s alien cartoon, slap bass,
bright brassy synth stabs, a cute slightly off-key melody like baby aliens singing out of tune, bleeps and boings, fast
and bouncy 145 BPM, attention-grabbing, instrumental, no fade-out.*)

**2. Ticking Clock (gameplay).** Style: *Cute but suspenseful chiptune game music, 1980s NES arcade, steady ticking clock
percussion, nervous plucky staccato melody in a minor key, bouncy pulsing bass, playful sneaky tension like something is
about to hatch, anticipation that never lets up, driving 130 BPM, sparse lead so it stays out of the way, loopable,
instrumental, no fade-out.* Exclude: *vocals, big build-ups, drops, breakdowns, key changes, tempo changes, fade out,
long intro, horror, dark ambient.* Weirdness about 40%. **Extension (Max Mode, Weirdness 70%, 2:10):** *Cute but suspenseful chiptune game
music, 1980s NES arcade, steady ticking clock percussion, nervous plucky staccato melody in C minor, bouncy pulsing bass,
playful sneaky tension, same tempo 130 BPM, same instruments, a new variation of the melody, same energy throughout, no
ending, no fade-out, instrumental.* Structure box (if used): *[Instrumental] [Main Theme Variation] [Main Theme]*.

**3. Game Over.** Style: *Cute simple chiptune background loop, 1980s NES game music, light bouncy bass line, soft
pulse-wave melody, gentle bleeps, a little wobbly sci-fi synth, steady 115 BPM, major key, cheerful and playful,
uncluttered and calm enough to concentrate, repetitive, instrumental, no fade-out.* Exclude: *vocals, heavy drums,
build-ups, drops, key changes, tempo changes, fade out, long intro.* Weirdness low (25–35%). Written as a calm gameplay
track, then chosen for game over.

Not used: "Egg Timer Beat The Clock" (a game-show gameplay take).

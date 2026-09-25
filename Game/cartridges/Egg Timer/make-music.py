"""Egg Timer music (Chat ruling, 2026-09-25): turn Andrew's Suno tracks into the files the game plays.
    python make-music.py [--report]     (from this folder; needs numpy and imageio-ffmpeg: pip install --user imageio-ffmpeg)
Reads files/assets/music/*.mp3 (Andrew's full-length sources, never committed or published) and writes files/audio/:
  title-screens-loop.mp3   the title track up to its loop's end, with an equal-power crossfade baked in at the join
  ticking-clock-loop.mp3   the gameplay track, the same, plus a volume ramp over the loop's last minute
  game-over.mp3            the game-over track, whole (it plays once)
and files/audio/music.json (each file's loop points in seconds and its tempo), which config.js repeats.
Chat's loop points (measured on the MP3s) are checked here: the tempo is measured, the points are snapped to the beat,
and the loop is a whole number of bars. Never deployed (*.py)."""
import os, sys, json, subprocess
import numpy as np
import imageio_ffmpeg

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "files", "assets", "music")
OUT = os.path.join(HERE, "files", "audio")
FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 44100
XFADE = 0.080          # the join's equal-power crossfade, seconds
BITRATE = "128k"

TRACKS = {
    "title": dict(src="Egg Timer - Title Screens.mp3", out="title-screens-loop.mp3", loop=(34.72, 92.58), bpm=144, ramp=False, beat_ms=-52),
    "gameplay": dict(src="Egg Timer - Ticking Clcck (extended).mp3", out="ticking-clock-loop.mp3", loop=(9.24, 151.99), bpm=129, ramp=True, beat_ms=-42),
    "over": dict(src="Egg Timer - Game Over.mp3", out="game-over.mp3", loop=None, bpm=115, ramp=False),
}


def decode(path):
    raw = subprocess.run([FF, "-v", "error", "-i", path, "-f", "s16le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).reshape(-1, 2).astype(np.float32) / 32768


def encode(x, path):
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes()
    subprocess.run([FF, "-v", "error", "-y", "-f", "s16le", "-ac", "2", "-ar", str(SR), "-i", "-", "-c:a", "libmp3lame", "-b:a", BITRATE, path],
                   input=pcm, check=True)


def onsets(x, hop=441):
    """An onset envelope: the positive rise of short-time energy, one value every `hop` samples (10 ms)."""
    m = x.mean(axis=1)
    n = len(m) // hop
    e = np.sqrt((m[:n * hop].reshape(n, hop) ** 2).mean(axis=1) + 1e-12)
    le = np.log(e)
    d = np.diff(le, prepend=le[0])
    return np.maximum(d, 0), hop / SR


def tempo(env, dt, guess):
    """The BPM (to 0.01) whose beat grid best fits the onset envelope, within 4% of the guess, and the grid's phase."""
    best = None
    t = np.arange(len(env)) * dt
    for bpm in np.arange(guess * 0.96, guess * 1.04, 0.01):
        p = 60 / bpm
        # fold the envelope onto one beat and read how peaked it is
        ph = (t % p) / p
        bins = np.bincount((ph * 64).astype(int), weights=env, minlength=64)
        score = bins.max() / (bins.mean() + 1e-9)
        if best is None or score > best[0]:
            best = (score, bpm, (np.argmax(bins) + 0.5) / 64 * p)
    return float(best[1]), float(best[2])


def snap(t, bpm, phase):
    p = 60 / bpm
    return phase + round((t - phase) / p) * p


def rms_db(x):
    return 20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-12)


def build(name, spec, report):
    x = decode(os.path.join(SRC, spec["src"]))
    env, dt = onsets(x)
    bpm, phase = tempo(env, dt, spec["bpm"])
    info = {"file": spec["out"], "bpm": round(bpm, 2), "seconds": round(len(x) / SR, 3)}
    if spec["loop"] is None:
        encode(x, os.path.join(OUT, spec["out"]))
        return info, x
    a, b = spec["loop"]
    beat = 60 / bpm
    # the start is Chat's (measured on these files; it sits on a beat: see onset_ms). The end is where the audio best
    # matches what leads into the start, within 60 ms of Chat's end. The tempo is then exact: the loop is a whole
    # number of bars, so bpm = beats / seconds.
    sa = a
    k = int(round(a / dt))
    info["onset_ms"] = int(round((k - 5 + int(np.argmax(env[k - 5:k + 6])) - k) * dt * 1000))   # the strongest onset near the start
    m = x.mean(axis=1)
    i0 = int(round(sa * SR))
    w = int(1.5 * SR)
    ref = m[i0 - w:i0]
    guess = int(round(b * SR))
    best = None
    for off in range(-int(0.06 * SR), int(0.06 * SR) + 1):
        seg = m[guess - w + off:guess + off]
        c = float(np.dot(ref, seg) / (np.linalg.norm(ref) * np.linalg.norm(seg) + 1e-9))
        if best is None or c > best[0]:
            best = (c, off)
    i1 = guess + best[1]
    sb = i1 / SR
    bars = round(((i1 - i0) / SR) / (4 * beat))
    bpm = bars * 4 * 60 / ((i1 - i0) / SR)
    info["bpm"] = round(bpm, 2)
    info["join_match"] = round(best[0], 3)
    # snap to the beat: the beat falls just before Chat's points, the same distance before the start and the end (the
    # loop's length is right), so both move onto it together and the jump lands just before a beat's attack
    sh = int(round(spec["beat_ms"] / 1000 * SR))
    i0, i1 = i0 + sh, i1 + sh
    sa, sb = i0 / SR, i1 / SR
    y = x[:i1].copy()
    info.update(chat=[a, b], loop=[round(i0 / SR, 6), round(i1 / SR, 6)], bars=bars, moved_ms=[round((sa - a) * 1000), round((sb - b) * 1000)])
    if spec["ramp"]:
        # the loop's last minute drifts louder: measure the join's two sides and ramp the end down to match the start
        w = int(8 * SR)
        start_db, end_db = rms_db(y[i0:i0 + w]), rms_db(y[i1 - w:i1])
        drop = end_db - start_db
        r0 = i1 - int(60 * SR)
        g = np.ones(len(y), np.float32)
        g[r0:i1] = 10 ** (-drop * np.linspace(0, 1, i1 - r0) / 20)
        y *= g[:, None]
        info.update(ramp_db=round(float(drop), 2), join_db_after=round(float(rms_db(y[i1 - w:i1]) - rms_db(y[i0:i0 + w])), 2))
    # the join: over the loop's last XFADE, blend its end (fading out) with the audio just before the loop start
    # (fading in), equal power, so the jump back to the loop start carries straight on
    n = int(XFADE * SR)
    k = np.linspace(0, 1, n, dtype=np.float32)[:, None]
    y[i1 - n:i1] = y[i1 - n:i1] * np.cos(k * np.pi / 2) + x[i0 - n:i0] * (g[i0 - n:i0, None] if spec["ramp"] else 1) * np.sin(k * np.pi / 2)
    info["join_step"] = round(float(np.abs(y[i1 - 1] - y[i0]).max()), 4)   # the sample step at the jump
    encode(y, os.path.join(OUT, spec["out"]))
    return info, y


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    manifest = {}
    for name, spec in TRACKS.items():
        info, _ = build(name, spec, "--report" in sys.argv)
        manifest[name] = info
        print(name, json.dumps(info))
    with open(os.path.join(OUT, "music.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifest, f, indent=1)

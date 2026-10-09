"""Audio assets for the reel (all synthesized locally; nothing licensed).
  public/audio/vo.wav     VO normalised to -14 LUFS (also the .wav deliverable)
  public/audio/music.wav  60 s ambient pad, mixed ~22 LU under the VO
  public/audio/whoosh.wav / click.wav / chime.wav   subtle transition sfx
"""
import json, subprocess, numpy as np

SR = 48000
OUT = "public/audio"
rng = np.random.default_rng(7)


def write(path, x):
    x = np.atleast_2d(x)
    if x.shape[0] == 1:
        x = np.vstack([x, x])
    pcm = (np.clip(x.T, -1, 1) * 32767).astype("<i2").tobytes()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", "-", path], input=pcm, check=True)


def loudness(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "loudnorm=print_format=json", "-f", "null", "-"], capture_output=True, text=True)
    j = r.stderr[r.stderr.rindex("{"):]
    return json.loads(j)


def normalize(src, dst, target=-14.0, limit_db=-1.5):
    """Static gain to the target integrated loudness, with a transparent
    peak limiter so the true peak stays below limit_db. Iterates once to
    absorb the limiter's small loudness change."""
    gain = target - float(loudness(src)["input_i"])
    for _ in range(3):
        lim = 10 ** (limit_db / 20)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-af",
                        f"volume={gain:.3f}dB,alimiter=limit={lim:.4f}:attack=2:release=60:level=disabled",
                        "-ar", "48000", "-c:a", "pcm_s16le", dst], check=True)
        err = target - float(loudness(dst)["input_i"])
        if abs(err) < 0.15:
            break
        gain += err


def onepole_lp(x, fc):
    """Time-varying one-pole low-pass; fc may be an array (Hz)."""
    fc = np.broadcast_to(fc, x.shape)
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    s = 0.0
    for i in range(len(x)):
        s = (1 - a[i]) * x[i] + a[i] * s
        y[i] = s
    return y


def music(dur=60.0):
    """Slow, warm pad: Fmaj7 - Am7 - Cmaj7 - G6 (x2), soft attack/release."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros((2, n))
    midi = lambda m: 440 * 2 ** ((m - 69) / 12)
    chords = [[41, 53, 57, 60, 64], [45, 57, 60, 64, 67], [48, 55, 59, 64, 67], [43, 55, 59, 62, 64]]
    seg = dur / 8
    for k in range(8):
        notes = chords[k % 4]
        t0 = k * seg
        env = np.clip((t - t0 + 0.8) / 2.2, 0, 1) * np.clip((t0 + seg + 1.6 - t) / 2.2, 0, 1)
        env = np.sin(env * np.pi / 2) ** 2
        for j, m in enumerate(notes):
            for ch, det in enumerate((-0.12, 0.12)):  # gentle stereo detune
                f = midi(m) + det
                ph = rng.uniform(0, 2 * np.pi)
                tone = np.sin(2 * np.pi * f * t + ph) + 0.18 * np.sin(4 * np.pi * f * t + ph)
                out[ch] += tone * env * (0.5 if j == 0 else 0.22)
    # slow tremolo-free breathing + gentle fade-in / final fade-out
    out *= np.clip(t / 2.0, 0, 1) * np.clip((dur - t) / 1.5, 0, 1)
    for ch in range(2):
        out[ch] = onepole_lp(out[ch], 1800.0)
    return out / np.max(np.abs(out))


def whoosh(dur=0.8):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    shape = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    fc = 300 + 2600 * shape
    y = onepole_lp(x, fc) - onepole_lp(onepole_lp(x, fc), 120.0)
    y *= shape
    pan = np.clip(t / dur, 0, 1)
    st = np.vstack([y * np.cos(pan * np.pi / 2), y * np.sin(pan * np.pi / 2)])
    return st / np.max(np.abs(st))


def click():
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * 1850 * t) * np.exp(-t / 0.012) + 0.4 * np.sin(2 * np.pi * 920 * t) * np.exp(-t / 0.02)
    y += 0.15 * rng.standard_normal(n) * np.exp(-t / 0.002)
    return y / np.max(np.abs(y))


def chime():
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    y = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t / d) for f, a, d in [(784, 1, 0.5), (1175, 0.5, 0.35), (1568, 0.25, 0.25)])
    y *= np.clip(t / 0.005, 0, 1)
    return y / np.max(np.abs(y))


if __name__ == "__main__":
    normalize("build/vo_raw.wav", f"{OUT}/vo.wav", -14.0)
    vo = loudness(f"{OUT}/vo.wav")
    print("VO:", vo["input_i"], "LUFS, TP", vo["input_tp"])
    # music ~22 LU below the VO, sfx peaks well under the voice
    write("build/music_full.wav", music())
    normalize("build/music_full.wav", f"{OUT}/music.wav", -36.0)
    write(f"{OUT}/whoosh.wav", whoosh() * 10 ** (-24 / 20))
    write(f"{OUT}/click.wav", click() * 10 ** (-27 / 20))
    write(f"{OUT}/chime.wav", chime() * 10 ** (-22 / 20))
    print("music:", loudness(f"{OUT}/music.wav")["input_i"], "LUFS")

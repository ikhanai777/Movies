"""Synthesizes the score and sound effects for the Fastlane Ch.1 reel (64 s, 48 kHz stereo WAV).

Cues follow the timeline in reel.html:
  0 impact + groove | 15.3 record scratch, music stops | 16.6 groove back
  24.7-33.5 Slowlane: muffled groove, a clock tick per year, sad trombone on arrival
  35.9 camouflage reveal riser | 37.5-40.3 Fastlane engine zoom | 40.4 ka-ching
  45 magic sparkle + cash register | 50-55 muffled "waiting room" | 55.5 hit | 64 loops to 0
"""
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
DUR = 64.0
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(3)
BPM = 26 * 4 * 60 / DUR          # 26 bars exactly, so the loop point lands on a downbeat
BEAT = 60 / BPM


def note(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def lp(x, fc, o=2):
    b, a = signal.butter(o, fc / (SR / 2), 'low'); return signal.lfilter(b, a, x, axis=0)


def hp(x, fc, o=2):
    b, a = signal.butter(o, fc / (SR / 2), 'high'); return signal.lfilter(b, a, x, axis=0)


def bp(x, lo, hi, o=2):
    b, a = signal.butter(o, [lo / (SR / 2), hi / (SR / 2)], 'band'); return signal.lfilter(b, a, x, axis=0)


def place(dst, x, at, gain=1.0):
    i0 = int(at * SR)
    if i0 >= len(dst): return
    n = min(len(x), len(dst) - i0)
    dst[i0:i0 + n] += x[:n] * gain


def env(a, b, fi=.05, fo=.05):
    return np.clip(np.minimum((t - a) / fi, (b - t) / fo), 0, 1)


# ------------------------------------------------------------------ drum + bass + keys stem
def kick():
    n = int(.45 * SR); tt = np.arange(n) / SR
    f = 45 + 95 * np.exp(-tt * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 7)


def snare():
    n = int(.3 * SR); tt = np.arange(n) / SR
    nz = bp(rng.standard_normal(n), 1200, 7000) * np.exp(-tt * 16)
    return nz * .7 + np.sin(2 * np.pi * 190 * tt) * np.exp(-tt * 22) * .5


def hat(open_=False):
    n = int((.22 if open_ else .06) * SR); tt = np.arange(n) / SR
    return hp(rng.standard_normal(n), 7000) * np.exp(-tt * (12 if open_ else 70))


def clap():
    n = int(.25 * SR); tt = np.arange(n) / SR
    e = sum(np.exp(-np.clip(tt - d, 0, None) * 60) * (tt >= d) for d in (0, .011, .023))
    return bp(rng.standard_normal(n), 900, 4000) * (e + .5 * np.exp(-tt * 12))


drums = np.zeros(N); bass = np.zeros(N); keys = np.zeros((N, 2))
K, S, HC, HO, CL = kick(), snare(), hat(), hat(True), clap()
PROG = [(45, [57, 60, 64, 67]), (41, [57, 60, 64, 65]), (48, [55, 60, 64, 67]), (43, [55, 59, 62, 67])]  # Am7 Fmaj7 C G
nbeats = int(round(DUR / BEAT))
for b in range(nbeats):
    at = b * BEAT; bar = b // 4; pos = b % 4
    root, chord = PROG[bar % 4]
    if pos in (0, 2): place(drums, K, at, .9)
    if pos == 2 and bar % 2: place(drums, K, at + BEAT * .75, .55)
    if pos in (1, 3): place(drums, S, at, .5); place(drums, CL, at, .35)
    for h in range(2): place(drums, HO if (h == 1 and pos == 3) else HC, at + h * BEAT / 2, .16 if h else .1)
    # bass: root on the beat, octave pop on the "and"
    for off, m, ln in ((0, root, .42), (.5, root + 12, .2), (.75, root + 7, .2)):
        if off == .75 and pos % 2 == 0: continue
        n = int(ln * BEAT * 2 * SR); tt = np.arange(n) / SR
        x = signal.sawtooth(2 * np.pi * note(m - 12) * tt) * np.exp(-tt * 5) * np.minimum(1, tt * 400)
        place(bass, x, at + off * BEAT)
    # off-beat electric-piano stabs
    if pos in (1, 3) or (pos == 2 and bar % 2 == 0):
        n = int(.5 * SR); tt = np.arange(n) / SR
        y = sum(np.sin(2 * np.pi * note(m) * tt) + .3 * np.sin(4 * np.pi * note(m) * tt) for m in chord)
        y *= np.exp(-tt * 7) * np.minimum(1, tt * 300) * (1 + .3 * np.sin(2 * np.pi * 5 * tt))
        place(keys[:, 0], y, at + BEAT * .5, .05); place(keys[:, 1], y, at + BEAT * .5 + .008, .05)
bass = lp(bass, 700)
music = np.stack([drums, drums], 1) * .7 + np.stack([bass, bass], 1) * .35 + keys

raw = music.copy()
# Arrangement: level and "muffle" amount over time
lvl = np.ones(N) * .9
muff = np.zeros(N)
lvl *= 1 - env(15.3, 16.6, .01, .03)                       # silence after the scratch
lvl *= 1 - .45 * env(24.6, 34.6, .4, .4)                   # slowlane: quieter...
muff = np.maximum(muff, env(24.6, 34.6, .4, .4))           # ...and muffled
lvl *= 1 - .45 * env(50.3, 55.4, .4, .2)                   # waiting room: muffled "elevator"
muff = np.maximum(muff, env(50.3, 55.4, .4, .2))
dry = music * (1 - muff)[:, None]
wet = lp(music, 420, 4) * muff[:, None]
music = (dry + wet * 1.3) * lvl[:, None]

# Tape-stop on the record scratch: slow the read-head from 1x to 0 over 0.3 s
ts0, ts1 = 15.3, 15.6
i0, i1 = int(ts0 * SR), int(ts1 * SR)
rate = np.linspace(1, 0, i1 - i0) ** 1.5
pos = ts0 * SR + np.cumsum(rate)
for c in range(2):
    music[i0:i1, c] = np.interp(pos, np.arange(N), raw[:, c]) * .9 * .9 * np.linspace(1, .3, i1 - i0)

mix = music.copy()

# ------------------------------------------------------------------ sound effects
def boom(at, amp=.6, f0=50, decay=3.0):
    n = int(2.5 * SR); tt = np.arange(n) / SR
    f = f0 * (1 + 2 * np.exp(-tt * 12))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * decay)
    x += lp(rng.standard_normal(n), 2500) * np.exp(-tt * 9) * .5
    place(mix[:, 0], x, at, amp); place(mix[:, 1], x, at, amp)


def whoosh(at, ln=.7, amp=.18):
    n = int(ln * SR); tt = np.arange(n) / SR
    w = np.sin(np.pi * tt / ln) ** 2
    x = rng.standard_normal(n)
    out = np.zeros(n)
    for k in range(0, n, 2400):                       # sweeping band-pass
        fc = 400 + 3000 * (k / n)
        seg_ = bp(x[k:k + 2400], fc * .7, fc * 1.4, 1)
        out[k:k + len(seg_)] = seg_
    place(mix[:, 0], out * w, at - ln / 2, amp); place(mix[:, 1], out * w, at - ln / 2 + .01, amp)


def scratch(at):
    n = int(.6 * SR); tt = np.arange(n) / SR
    speed = np.sin(2 * np.pi * 7 * tt) * (1 - tt / .6) + .2         # back-and-forth hand motion
    f = 300 + 900 * np.abs(speed)
    x = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR) * .5 + bp(rng.standard_normal(n), 800, 4000) * np.abs(speed)
    x *= np.minimum(1, tt * 200) * np.exp(-tt * 2)
    place(mix[:, 0], x, at, .55); place(mix[:, 1], x, at, .55)


def ding(at, m, amp=.18, dec=2.5):
    n = int(1.6 * SR); tt = np.arange(n) / SR; f = note(m)
    y = sum(a * np.sin(2 * np.pi * f * r * tt) * np.exp(-tt * dec * d) for r, a, d in ((1, 1, 1), (2.76, .4, 2), (5.4, .2, 3)))
    place(mix[:, 0], y, at, amp); place(mix[:, 1], y, at, amp)


def kaching(at, amp=.3):
    n = int(.15 * SR); tt = np.arange(n) / SR
    place(mix[:, 0], hp(rng.standard_normal(n), 3000) * np.exp(-tt * 40), at, amp * .6)
    place(mix[:, 1], hp(rng.standard_normal(n), 3000) * np.exp(-tt * 40), at, amp * .6)
    ding(at + .06, 96, amp * .7, 1.2); ding(at + .14, 100, amp * .8, 1.0)


def tick(at, amp=.12, hi=True):
    n = int(.04 * SR); tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * (2400 if hi else 1700) * tt) * np.exp(-tt * 180)
    place(mix[:, 0], x, at, amp); place(mix[:, 1], x, at, amp)


def trombone(at):
    for i, (m, ln) in enumerate(((55, .32), (54, .32), (53, .32), (52, 1.1))):
        n = int(ln * SR); tt = np.arange(n) / SR
        vib = 1 + (.012 * np.sin(2 * np.pi * 6 * tt) if i == 3 else 0)
        x = signal.sawtooth(2 * np.pi * note(m) * np.cumsum(vib) / SR)
        x = lp(x, 900) * np.minimum(1, tt * 30) * np.minimum(1, (ln - tt) * 12)
        place(mix[:, 0], x, at + i * .34, .22); place(mix[:, 1], x, at + i * .34, .22)


def engine(t0, t1):
    n = int((t1 - t0 + .8) * SR); tt = np.arange(n) / SR
    k = np.clip(tt / (t1 - t0), 0, 1)
    f = 70 + 200 * k ** .7 + 20 * np.sin(2 * np.pi * 3 * tt)
    x = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR) + .5 * signal.square(2 * np.pi * np.cumsum(f * .5) / SR)
    x = lp(x, 1800) + bp(rng.standard_normal(n), 500, 3000) * .3
    a = np.minimum(1, tt * 3) * np.where(tt < t1 - t0, 1, np.exp(-(tt - (t1 - t0)) * 5))
    pan = np.clip(k, 0, 1)
    place(mix[:, 0], x * a * (1.2 - pan), t0, .2); place(mix[:, 1], x * a * (.2 + pan), t0, .2)


def riser(t0, t1, amp=.12):
    n = int((t1 - t0) * SR); tt = np.arange(n) / SR; k = tt / (t1 - t0)
    x = bp(rng.standard_normal(n), 500, 6000) * k ** 2
    x += np.sin(2 * np.pi * np.cumsum(200 + 1200 * k ** 2) / SR) * k ** 2 * .3
    place(mix[:, 0], x, t0, amp); place(mix[:, 1], x, t0, amp)


boom(0.0, .55)
for at in (4.5, 11.1, 20.6, 24.6, 34.0, 35.4, 44.8, 50.4, 59.4):
    whoosh(at)
for i, at in enumerate((5.2, 6.6, 8.0, 9.4)):                  # script signposts pop
    ding(at, (76, 79, 83, 88)[i], .07, 3)
for i in range(3): ding(11.7 + i * .35, 84 + i * 3, .06, 3)    # supercars appear
kaching(12.6, .25)                                              # $20M
scratch(15.3)
ding(15.95, 70, .1, 2); ding(16.15, 75, .1, 2)                  # "?" blip
boom(16.62, .35)                                                 # groove drops back in
for y in range(50):                                              # a tick per year on the Slowlane
    tick(24.7 + 8.8 * y / 50, .09, y % 2 == 0)   # the hero car moves linearly
trombone(33.55)
riser(34.6, 36.0, .14)
boom(36.0, .35, 70, 4)
engine(37.4, 40.3)
kaching(40.45, .32); boom(40.45, .3, 60)
ding(45.1, 88, .07); ding(45.25, 91, .07); ding(45.4, 95, .07); ding(45.55, 100, .07)   # magic sparkle
kaching(46.4, .2); kaching(48.0, .2)
for i in range(9): tick(50.6 + i * .5, .1, i % 2 == 0)          # waiting-room clock
boom(55.6, .5, 45)
for i in range(8): ding(60.1 + i * .12, (72, 76, 79, 84, 76, 79, 84, 88)[i], .045, 3)  # legend items

# ------------------------------------------------------------------ master
ir_len = int(1.4 * SR); it = np.arange(ir_len) / SR
ir = rng.standard_normal((ir_len, 2)) * np.exp(-it * 4)[:, None]; ir = lp(ir, 5000); ir /= np.sqrt((ir ** 2).sum(0))
wet = np.stack([signal.fftconvolve(mix[:, c], ir[:, c])[:N] for c in range(2)], 1)
out = mix + wet * .18
out *= np.clip((DUR - t) / .05, 0, 1)[:, None]
out = np.tanh(out / np.abs(out).max() * 1.6) / np.tanh(1.6) * .9
import os; os.makedirs('build', exist_ok=True)
wavfile.write('build/soundtrack.wav', SR, (out * 32767).astype(np.int16))
print('wrote build/soundtrack.wav')

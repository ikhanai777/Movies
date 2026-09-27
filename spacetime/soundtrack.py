"""Synthesizes the ambient score for the Spacetime film (70 s, 48 kHz stereo WAV).

Cues are aligned to the timeline in index.html:
  0-7 intro | 7-23 curvature + gravitational-wave chirp | 23-35 worldlines
  35-50 tesseract (a chime per added dimension) | 50-63 black hole | 63-70 outro
"""
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
DUR = 70.0
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)


def env(a, b, fade_in=2.0, fade_out=2.0):
    """Smooth window that is 1 between a and b with raised-cosine edges."""
    e = np.clip((t - a) / fade_in, 0, 1) * np.clip((b - t) / fade_out, 0, 1)
    return 0.5 - 0.5 * np.cos(np.pi * e)


def note(n):  # MIDI -> Hz
    return 440.0 * 2 ** ((n - 69) / 12)


def pad(midis, a, b, amp=0.08, bright=4):
    """Detuned additive pad; returns stereo."""
    out = np.zeros((N, 2))
    w = env(a, b, 3.0, 3.0)
    for m in midis:
        f = note(m)
        for k in range(1, bright + 1):
            for side, det in ((0, -0.18), (1, 0.21)):
                ph = rng.uniform(0, 2 * np.pi)
                lfo = 1 + 0.25 * np.sin(2 * np.pi * (0.07 + 0.03 * k) * t + ph)
                out[:, side] += np.sin(2 * np.pi * (f * k + det * k) * t + ph) * lfo / k ** 1.6
    return out * w[:, None] * amp


def lowpass(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), 'low')
    return signal.lfilter(b, a, x, axis=0)


def bandpass(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], 'band')
    return signal.lfilter(b, a, x, axis=0)


mix = np.zeros((N, 2))

# --- foundation drone on A, breathing slowly ------------------------------
drone = np.zeros(N)
for k, amp in enumerate([1, .5, .33, .2, .12, .08], start=1):
    drone += amp * np.sin(2 * np.pi * 55 * k * t + k)
drone *= 0.6 + 0.4 * np.sin(2 * np.pi * 0.05 * t) ** 2
drone = lowpass(drone, 380)
mix += np.stack([drone, np.roll(drone, 240)], 1) * 0.06 * env(0, 70, 4, 5)[:, None]

# --- harmonic pads per chapter ------------------------------------------
mix += pad([57, 64, 71, 76], 0, 8.5, 0.05)            # Am(add9)   intro
mix += pad([53, 60, 64, 69, 72], 6.5, 24, 0.045)      # Fmaj7      curvature
mix += pad([48, 55, 64, 67, 74], 22, 36, 0.045)       # Cadd9      worldlines
mix += pad([50, 57, 62, 65, 69, 76], 34, 51, 0.04)    # Dm9        tesseract
mix += pad([45, 52, 57, 60, 64], 49, 64.5, 0.05, 3)   # Am         black hole
mix += pad([45, 57, 61, 64, 69, 73], 62, 70, 0.05)    # A major    resolution

# --- star shimmer: sparse high sine grains --------------------------------
shimmer = np.zeros((N, 2))
scale = [81, 83, 84, 88, 91, 93, 95, 96, 100]
for _ in range(170):
    t0 = rng.uniform(0, DUR - 2)
    f = note(rng.choice(scale))
    i0, ln = int(t0 * SR), int(1.8 * SR)
    tt = np.arange(ln) / SR
    g = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 2.6) * (1 - np.exp(-tt * 60))
    pan = rng.uniform(0.1, 0.9)
    shimmer[i0:i0 + ln, 0] += g * (1 - pan)
    shimmer[i0:i0 + ln, 1] += g * pan
shimmer_w = 0.35 + 0.65 * (env(0, 8, 1, 2) + env(62, 70, 2, 3))
mix += shimmer * 0.018 * shimmer_w[:, None]

# --- gravitational-wave chirp (LIGO-style inspiral) -----------------------
tc = 22.6                        # coalescence time
tau = np.clip(tc - t, 1e-3, None)
fchirp = 38 * (tau / 12.0) ** (-3 / 8)
fchirp = np.clip(fchirp, 0, 520)
phase = 2 * np.pi * np.cumsum(fchirp) / SR
chirp_amp = np.clip((t - 13) / 9.6, 0, 1) ** 2 * (t < tc)
chirp = np.sin(phase) * chirp_amp * (fchirp / 520) ** 0.35
chirp = lowpass(chirp, 1400)
mix += np.stack([chirp, chirp], 1) * 0.08

# --- merger boom + ringdown at the end of the curvature chapter -----------
def boom(at, amp=0.35, f0=48, decay=1.6):
    x = np.zeros(N)
    i0 = int(at * SR)
    tt = np.arange(N - i0) / SR
    f = f0 * (1 + 1.5 * np.exp(-tt * 9))
    x[i0:] = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * decay)
    noise = lowpass(rng.standard_normal(N), 900) * 0
    noise[i0:] = lowpass(rng.standard_normal(N - i0), 700) * np.exp(-tt * 5) * 0.4
    return np.stack([x + noise, x + np.roll(noise, 300)], 1) * amp

mix += boom(tc, 0.32)
mix += boom(50.0, 0.22, 36, 0.9)     # entering the black hole chapter

# --- transition swells (filtered noise risers) ----------------------------
def swell(at, length=2.2, amp=0.05):
    x = bandpass(rng.standard_normal((N, 2)), 300, 5000)
    w = np.clip(1 - np.abs(t - at) / length, 0, 1) ** 2.5
    return x * w[:, None] * amp

for at in (7.0, 23.0, 35.0, 63.0):
    mix += swell(at)

# --- tesseract chimes: one bell per added dimension ------------------------
def bell(at, midi, amp=0.09):
    x = np.zeros((N, 2))
    i0 = int(at * SR)
    tt = np.arange(N - i0) / SR
    f = note(midi)
    y = sum(a * np.sin(2 * np.pi * f * r * tt) * np.exp(-tt * d)
            for r, a, d in ((1, 1, 1.1), (2.76, .45, 2.2), (5.4, .25, 3.5), (8.9, .12, 5)))
    x[i0:, 0] = y
    x[i0:, 1] = y
    return x * amp

for i, (at, m) in enumerate(((35.9, 69), (36.4, 72), (38.4, 76), (40.4, 79), (42.6, 84))):
    mix += bell(at, m, 0.08 if i else 0.06)

# --- black hole: sub rumble + slow dark noise ----------------------------
rum = lowpass(rng.standard_normal(N), 70, 4) * 4.0
rum += 0.6 * np.sin(2 * np.pi * 31 * t) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.23 * t))
mix += np.stack([rum, rum], 1) * 0.09 * env(50, 63.5, 2.5, 2.5)[:, None]

# --- reverb: convolution with a decaying stereo noise tail ----------------
ir_len = int(3.8 * SR)
it = np.arange(ir_len) / SR
ir = rng.standard_normal((ir_len, 2)) * np.exp(-it * 1.7)[:, None]
ir = lowpass(ir, 6000)
ir /= np.sqrt((ir ** 2).sum(0))
wet = np.stack([signal.fftconvolve(mix[:, c], ir[:, c])[:N] for c in range(2)], 1)
out = mix * 0.7 + wet * 0.55

# master fade + normalise
out *= env(0, 70, 0.8, 3.0)[:, None]
out /= np.abs(out).max() / 0.89
wavfile.write('build/soundtrack.wav', SR, (out * 32767).astype(np.int16))
print('wrote build/soundtrack.wav')

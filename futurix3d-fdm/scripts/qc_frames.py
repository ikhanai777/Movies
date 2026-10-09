"""Scan decoded frames of the final MP4: any non-background pixels in the
Instagram unsafe zones (top 250 px, bottom 400 px) or in a 24 px side margin
of the caption band are reported."""
import subprocess, sys, numpy as np
W, H, STEP = 1080, 1920, 3
bg = np.array([0xF5, 0xF3, 0xEE], np.int16)
p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", sys.argv[1], "-vf", f"select='not(mod(n\\,{STEP}))'", "-vsync", "0", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
bad = {"top": [], "bottom": [], "caption-edge": []}
n = 0
while True:
    buf = p.stdout.read(W * H * 3)
    if len(buf) < W * H * 3: break
    f = np.frombuffer(buf, np.uint8).reshape(H, W, 3).astype(np.int16)
    diff = np.abs(f - bg).max(axis=2) > 24  # tolerant of compression noise
    t = n * STEP / 30
    if diff[:250].any(): bad["top"].append(round(t, 2))
    if diff[1520:].any(): bad["bottom"].append(round(t, 2))
    band = diff[1250:1420]
    if band[:, :24].any() or band[:, -24:].any(): bad["caption-edge"].append(round(t, 2))
    n += 1
print("frames checked:", n)
for k, v in bad.items(): print(k, len(v), v[:12])

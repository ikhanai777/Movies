"""Transcribe an audio file with faster-whisper (word timestamps) for verification."""
import sys, subprocess, numpy as np
from faster_whisper import WhisperModel
pcm = subprocess.run(["ffmpeg","-v","error","-i",sys.argv[1],"-f","s16le","-ac","1","-ar","16000","-"],capture_output=True).stdout
audio = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
m = WhisperModel("small.en", device="cpu", compute_type="int8")
segs, _ = m.transcribe(audio, word_timestamps=True, initial_prompt=None)
for s in segs:
    print(f"[{s.start:6.2f}-{s.end:6.2f}] {s.text}")
    if len(sys.argv) > 2:
        for w in s.words: print(f"    {w.start:6.2f} {w.end:6.2f} {w.word}")

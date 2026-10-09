"""Generate the voiceover with edge-tts, one call per scene, and lay it out on
the 60 s timeline. Writes:
  vo/seg_*.mp3          raw TTS per scene
  build/vo_raw.wav      48 kHz mono, all segments placed at their start times
  src/timing.json       word-level timestamps (seconds, absolute) + scene bounds
Captions use DISPLAY text; TTS uses SPOKEN text (phonetic brand name, numbers)."""
import asyncio, certifi, json, subprocess, os, numpy as np
certifi.where = lambda: "/root/.ccr/ca-bundle.crt"  # proxy CA (edge-tts pins certifi)
import edge_tts

VOICE, RATE, SR = "en-US-AndrewNeural", "+0%", 48000
START, GAP, TOTAL = 0.30, 0.36, 60.0

# (scene id, spoken text, display words). Display words map 1:1 to spoken
# word-boundary events, in order.
SCENES = [
 ("hook", "Every 3D print starts as a single thread of plastic.", None),
 ("slicing", "First, software called a slicer cuts your 3D model into hundreds of thin layers, and turns each one into a path of coordinates called G-code.", None),
 ("extrusion", "The printer feeds filament into the hot end. Drive gears push it forward, a heater melts it at around two hundred degrees, and a nozzle about zero point four millimeters wide squeezes it out.", None),
 ("motion", "Motors move the nozzle across X and Y, tracing the outer walls first, then filling the inside with a pattern called infill.", None),
 ("layers", "When a layer is done, the bed drops, or the nozzle rises, by a fraction of a millimeter. The next layer is laid on top, and heat fuses it to the one below.", None),
 ("cooling", "A fan cools each line so it holds its shape. Steep overhangs need temporary supports, because plastic can't be printed on thin air.", None),
 ("outro", "Layer by layer, line by line, until a solid object appears. That's FDM. Follow Future-icks 3D for more.", None),
]

async def synth(text, path):
    c = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary")
    words, audio = [], b""
    async for ch in c.stream():
        if ch["type"] == "audio": audio += ch["data"]
        elif ch["type"] == "WordBoundary":
            words.append({"w": ch["text"], "s": ch["offset"] / 1e7, "e": (ch["offset"] + ch["duration"]) / 1e7})
    open(path, "wb").write(audio)
    return words

def decode(path):
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "s16le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(pcm, np.int16).astype(np.float32) / 32768

async def main():
    os.makedirs("vo", exist_ok=True); os.makedirs("build", exist_ok=True)
    track = np.zeros(int(TOTAL * SR), np.float32)
    t, out = START, {"voice": VOICE, "rate": RATE, "scenes": []}
    for sid, text, _ in SCENES:
        p = f"vo/seg_{sid}.mp3"
        words = await synth(text, p)
        a = decode(p)
        end_speech = words[-1]["e"]
        a = a[: int((end_speech + 0.08) * SR)]          # trim trailing silence
        i = int(t * SR); track[i : i + len(a)] += a
        out["scenes"].append({"id": sid, "text": text, "start": round(t, 3), "end": round(t + end_speech, 3),
                              "words": [{"w": w["w"], "s": round(t + w["s"], 3), "e": round(t + w["e"], 3)} for w in words]})
        assert len(text.split()) == len(words), (sid, len(words))
        print(f"{sid:10s} {t:6.2f} -> {t + end_speech:6.2f}  ({len(words)} words)")
        t += end_speech + GAP
    assert t - GAP < TOTAL - 0.5, "VO too long"
    pcm = (np.clip(track, -1, 1) * 32767).astype(np.int16).tobytes()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "-", "build/vo_raw.wav"], input=pcm, check=True)
    json.dump(out, open("src/timing.json", "w"), indent=1)

asyncio.run(main())

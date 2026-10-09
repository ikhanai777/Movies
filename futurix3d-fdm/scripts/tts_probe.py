import asyncio, certifi, sys, json
certifi.where = lambda: "/root/.ccr/ca-bundle.crt"
import edge_tts
SEG = {
 "s1": "Every 3D print starts as a single thread of plastic.",
 "s2": "First, software called a slicer cuts your 3D model into hundreds of thin layers, and turns each one into a path of coordinates called G-code.",
 "s3": "The printer feeds filament into the hot end. Drive gears push it forward, a heater melts it at around two hundred degrees, and a nozzle about zero point four millimeters wide squeezes it out.",
 "s4": "Motors move the nozzle across X and Y, tracing the outer walls first, then filling the inside with a pattern called infill.",
 "s5": "When a layer is done, the bed drops, or the nozzle rises, by a fraction of a millimeter. The next layer is laid on top, and heat fuses it to the one below.",
 "s6": "A fan cools each line so it holds its shape. Steep overhangs need temporary supports, because plastic can't be printed on thin air.",
 "s7": "Layer by layer, line by line, until a solid object appears. That's FDM. Follow Futurix3D for more.",
}
async def dur(voice, rate, text):
    c = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    last = 0
    async for ch in c.stream():
        if ch["type"] == "WordBoundary":
            last = (ch["offset"] + ch["duration"]) / 1e7
    return last
async def main():
    voice, rate = sys.argv[1], sys.argv[2]
    ds = {k: round(await dur(voice, rate, t), 2) for k, t in SEG.items()}
    print(voice, rate, ds, "total", round(sum(ds.values()), 2))
asyncio.run(main())

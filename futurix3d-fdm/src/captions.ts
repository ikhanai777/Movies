// Builds 2–4 word caption chunks from the VO word timestamps.
// Pure module (no React) so scripts/export_srt.mjs can reuse it.
import { scenes } from "./timing";

export type CapWord = { text: string; s: number; e: number; key: boolean };
export type Chunk = { words: CapWord[]; start: number; end: number };

// Spoken -> display merges (VO is phonetic/spelled-out; captions are not).
const MERGES: { spoken: string[]; display: string }[] = [
  { spoken: ["two", "hundred"], display: "200" },
  { spoken: ["zero", "point", "four"], display: "0.4" },
  { spoken: ["future-icks", "3d"], display: "Futurix3D" },
];

// Keywords shown bold in the accent colour (matched on lowercase display text).
const KEYWORDS = new Set([
  "thread", "slicer", "layers", "g-code", "filament", "hot", "end",
  "drive", "gears", "heater", "200", "degrees", "nozzle", "0.4",
  "millimeters", "x", "y", "outer", "walls", "infill", "bed", "rises",
  "fuses", "fan", "overhangs", "supports", "fdm", "futurix3d", "solid",
]);

const bare = (s: string) => s.toLowerCase().replace(/[^a-z0-9.\-']/g, "").replace(/\.$/, "");

// Authored phrase breaks ("|"). Timing still comes 100% from the VO; this
// only decides where lines break so each caption reads as a natural phrase.
const PHRASES: Record<string, string> = {
  hook: "Every 3D print | starts as a single | thread of plastic.",
  slicing: "First, software | called a slicer | cuts your 3D model | into hundreds | of thin layers, | and turns each one | into a path | of coordinates | called G-code.",
  extrusion: "The printer feeds filament | into the hot end. | Drive gears | push it forward, | a heater melts it | at around 200 degrees, | and a nozzle | about 0.4 millimeters wide | squeezes it out.",
  motion: "Motors move the nozzle | across X and Y, | tracing the outer walls | first, then filling | the inside | with a pattern | called infill.",
  layers: "When a layer | is done, | the bed drops, | or the nozzle rises, | by a fraction | of a millimeter. | The next layer | is laid on top, | and heat fuses it | to the one below.",
  cooling: "A fan cools | each line | so it holds | its shape. | Steep overhangs | need temporary supports, | because plastic | can't be printed | on thin air.",
  outro: "Layer by layer, | line by line, | until a solid | object appears. | That's FDM. | Follow Futurix3D | for more.",
};

export const buildChunks = (): Chunk[] => {
  const chunks: Chunk[] = [];
  for (const sc of scenes as any[]) {
    const toks: string[] = sc.text.split(/\s+/);
    // 1. display tokens with timing (merging spelled-out / phonetic words)
    const disp: CapWord[] = [];
    for (let i = 0; i < toks.length; ) {
      const m = MERGES.find((mm) =>
        mm.spoken.every((w, k) => bare(toks[i + k] ?? "") === w),
      );
      const n = m ? m.spoken.length : 1;
      const last = toks[i + n - 1];
      const text = m ? m.display + (/[,.]$/.test(last) ? last.slice(-1) : "") : toks[i];
      disp.push({ text, s: sc.words[i].s, e: sc.words[i + n - 1].e, key: KEYWORDS.has(bare(text)) });
      i += n;
    }
    // 2. split into the authored phrases, verifying they match the VO
    let k = 0;
    for (const ph of PHRASES[sc.id].split("|").map((x) => x.trim())) {
      const words = ph.split(/\s+/).map((txt) => {
        const d = disp[k++];
        if (!d || bare(d.text) !== bare(txt)) throw new Error(`caption mismatch in ${sc.id}: "${txt}" vs "${d?.text}"`);
        return d;
      });
      chunks.push({ words, start: words[0].s, end: words[words.length - 1].e });
    }
    if (k !== disp.length) throw new Error(`caption phrases for ${sc.id} do not cover the VO`);
  }
  // 4. on-screen window: tiny lead-in; hold until the next chunk unless a long pause
  return chunks.map((c, i) => {
    const next = chunks[i + 1];
    const start = Math.max(0, c.start - 0.08);
    const hold = c.end + 0.45;
    const end = next ? (next.start - 0.08 - hold < 0.5 ? next.start - 0.08 : hold) : Math.min(60, hold);
    return { ...c, start, end };
  });
};

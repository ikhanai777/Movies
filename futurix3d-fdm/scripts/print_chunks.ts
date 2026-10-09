import { buildChunks } from "../src/captions";
for (const c of buildChunks())
  console.log(c.start.toFixed(2).padStart(6), c.end.toFixed(2).padStart(6), c.words.map((w) => (w.key ? `*${w.text}*` : w.text)).join(" "));

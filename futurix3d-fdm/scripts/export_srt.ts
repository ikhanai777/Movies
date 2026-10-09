// Writes the .srt from the same caption chunks that are burned into the video.
import fs from "node:fs";
import { buildChunks } from "../src/captions";
const ts = (s: number) => {
  const ms = Math.round(s * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
const srt = buildChunks()
  .map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(Math.min(c.end, 60))}\n${c.words.map((w) => w.text).join(" ")}\n`)
  .join("\n");
fs.writeFileSync(process.argv[2], srt);
console.log("wrote", process.argv[2]);

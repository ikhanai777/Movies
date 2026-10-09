// Usage:
//   node scripts/render.mjs stills <outDir> <t1> <t2> ...   PNG stills of the Reel at times (s)
//   node scripts/render.mjs cover <out.png>
//   node scripts/render.mjs video <out.mp4>
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";

const browserExecutable = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const [mode, out, ...rest] = process.argv.slice(2);

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const common = { serveUrl, browserExecutable, chromiumOptions: { gl: "swangle" } };

if (mode === "stills") {
  fs.mkdirSync(out, { recursive: true });
  const comp = await selectComposition({ ...common, id: "Reel" });
  for (const ts of rest) {
    const [name, sec] = ts.includes("=") ? ts.split("=") : [`t${ts}`, ts];
    const frame = Math.round(parseFloat(sec) * comp.fps);
    await renderStill({ ...common, composition: comp, frame, output: path.join(out, `${name}.png`) });
    console.log("still", name, frame);
  }
} else if (mode === "cover") {
  const comp = await selectComposition({ ...common, id: "Cover" });
  await renderStill({ ...common, composition: comp, output: out });
} else if (mode === "video") {
  const comp = await selectComposition({ ...common, id: "Reel" });
  let last = -1;
  await renderMedia({
    ...common,
    composition: comp,
    codec: "h264",
    crf: 16,
    pixelFormat: "yuv420p",
    audioCodec: "aac",
    audioBitrate: "320k",
    concurrency: 4,
    outputLocation: out,
    onProgress: ({ progress }) => {
      const p = Math.floor(progress * 20);
      if (p !== last) { last = p; console.log(`render ${Math.round(progress * 100)}%`); }
    },
  });
}

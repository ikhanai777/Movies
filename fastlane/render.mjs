// Renders reel.html frame-by-frame in headless Chromium and pipes PNGs into ffmpeg.
// usage: node render.mjs [--page reel.html] --w 1920 --h 1080 --fps 30 [--spp 2] --out spacetime.mp4 [--from 0 --to 70] [--stills 5,12,30]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) =>
  (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const W = +(args.w || 1920), H = +(args.h || 1080), FPS = +(args.fps || 30);
const here = path.dirname(fileURLToPath(import.meta.url));
const ffmpeg = process.env.FFMPEG || 'ffmpeg';

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
         '--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.setDefaultTimeout(0);
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => { console.error('[pageerror]', e); process.exit(1); });
const pageFile = args.page || 'reel.html';
await page.goto(pathToFileURL(path.join(here, pageFile)).href + `?render&w=${W}&h=${H}&fps=${FPS}` + (args.spp ? `&spp=${args.spp}` : ''));
await page.evaluate(() => window.ready);

if (args.stills) {
  fs.mkdirSync(path.join(here, 'stills'), { recursive: true });
  for (const t of args.stills.split(',').map(Number)) {
    const t0 = Date.now();
    await page.evaluate(t => window.frame(t), t);
    await page.screenshot({ path: path.join(here, 'stills', `${args.prefix || 't'}${String(t).padStart(5, '0')}.png`) });
    console.log(`still t=${t}s  ${Date.now() - t0}ms`);
  }
  await browser.close();
  process.exit(0);
}

const duration = await page.evaluate(() => window.DURATION);
const from = +(args.from || 0), to = +(args.to || duration);
const n0 = Math.round(from * FPS), n1 = Math.round(to * FPS);
const out = args.out || 'video.mp4';
const ff = spawn(ffmpeg, ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });

const start = Date.now();
for (let n = n0; n < n1; n++) {
  await page.evaluate(t => window.frame(t), n / FPS);
  const buf = await page.screenshot({ type: 'png' });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if ((n - n0) % 30 === 0) {
    const el = (Date.now() - start) / 1000, done = n - n0 + 1;
    console.log(`frame ${n}/${n1}  ${(el / done).toFixed(2)}s/frame  eta ${((n1 - n) * el / done / 60).toFixed(1)}min`);
  }
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
console.log('done ->', out);

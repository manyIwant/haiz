// Render the film frame by frame (deterministic) with N parallel Chromium workers.
//   node render/render.cjs [workers=3] [startSec=0] [endSec=duration]
// Writes build/video/part_XX.mp4 (no audio). render/mux.sh joins them with the score.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path'); const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const cues = JSON.parse(fs.readFileSync(path.join(ROOT, 'film/cues.js'), 'utf8').split('window.CUES =').pop().trim().replace(/;\s*$/, ''));
const FPS = cues.fps;
const workers = parseInt(process.argv[2] || '3', 10);
const t0 = parseFloat(process.argv[3] || '0'), t1 = parseFloat(process.argv[4] || String(cues.duration));
const F0 = Math.round(t0 * FPS), F1 = Math.round(t1 * FPS); // frame range [F0, F1)
const out = process.env.OUTDIR ? path.resolve(process.env.OUTDIR) : path.join(ROOT, 'build/video'); fs.mkdirSync(out, { recursive: true });

async function worker(id, a, b) {
  const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-gpu-vsync'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log(`[w${id}] pageerror`, e.message));
  await page.goto('file://' + path.join(ROOT, 'film/index.html'));
  await page.evaluate(() => window.filmReady);
  const file = path.join(out, `part_${String(id).padStart(2, '0')}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-pix_fmt', 'yuv420p', '-tune', 'film', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const started = Date.now();
  for (let f = a; f < b; f++) {
    await page.evaluate(t => window.renderAt(t), f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 94 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - a) % 300 === 0) console.log(`[w${id}] ${f - a}/${b - a}  ${((Date.now() - started) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  await browser.close();
  return file;
}
(async () => {
  const n = F1 - F0, per = Math.ceil(n / workers), jobs = [];
  for (let i = 0; i < workers; i++) { const a = F0 + i * per, b = Math.min(F1, a + per); if (a < b) jobs.push(worker(i, a, b)); }
  const files = await Promise.all(jobs);
  fs.writeFileSync(path.join(out, 'parts.txt'), files.map(f => `file '${f}'`).join('\n') + '\n');
  console.log('done', files.length, 'parts');
})();

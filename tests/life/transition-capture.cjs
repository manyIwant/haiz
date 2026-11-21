// Record the whole 入画 transition, frame by frame at a fixed rate (simulation stepped, not real time).
//   node tests/life/transition-capture.cjs --page ruhua-alive.html --out DIR [--fps 12] [--size 960x540] [--weather drizzle] [--hour 15]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const page = arg('page', 'ruhua-alive.html'), out = arg('out', 'tr-out'), fps = Number(arg('fps', 12)), paintFps = Number(arg('paintfps', fps)), stepFps = Number(arg('stepfps', 30));
const [W, H] = arg('size', '960x540').split('x').map(Number);
const base = arg('base', 'http://127.0.0.1:8123');
(async () => {
  fs.mkdirSync(path.join(out, 'f'), { recursive: true });
  for (const f of fs.readdirSync(path.join(out, 'f'))) fs.unlinkSync(path.join(out, 'f', f));
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: W < H, hasTouch: W < H });
  p.on('pageerror', (e) => console.log('[err]', e.message));
  await p.route('**/api.open-meteo.com/**', (r) => r.abort());
  await p.goto(`${base}/${page}?quality=low&capture&scale=1`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__ruhua && window.__ruhua.stage === 'hold', null, { timeout: 240000 });
  if (arg('weather')) await p.evaluate(({ w, h }) => window.__ruhua.weather.setFree(w, h ? Number(h) : null), { w: arg('weather'), h: arg('hour') });
  let n = 0;
  const durs = [];
  const shot = async () => { durs.push(1 / cur); await p.screenshot({ path: path.join(out, 'f', String(n++).padStart(5, '0') + '.png') }); };
  // each recorded frame stands for 1/fps s of the film (painting is filmed more sparsely: it is long and slow to draw)
  let cur = fps;
  const run = async (sec) => { for (let i = 0; i < Math.max(1, Math.round(sec * cur)); i++) { await p.evaluate(({ d, sf }) => window.__ruhua.still(d, sf), { d: 1 / cur, sf: stepFps }); await shot(); } };
  const log = [];
  const mark = async (label) => { const s = await p.evaluate(() => window.__ruhua.info()); log.push({ frame: n, t: +(n / fps).toFixed(2), label, stage: s.stage, clock: s.clock }); console.log(n, label, s.stage, s.clock); };
  await p.evaluate(() => window.__ruhua.still(2));
  await mark('hold'); await run(2.5);
  await p.evaluate(() => { window.__ruhua.paint(); });
  // the turn to the tree (ruhua-alive) and the easel's setup happen in stepped time: keep filming
  for (let k = 0; k < 200; k++) { await run(1 / fps); await p.waitForTimeout(30); if ((await p.evaluate(() => window.__ruhua.stage)) === 'paint') break; }
  await mark('paint');
  // the player paints with the brush held down (space): the strokes go down in the painter's order
  if (process.argv.includes('--quick')) {
    // (review of the departure only: the painting is laid at once, unfilmed)
    await p.evaluate(() => { const R = window.__ruhua; R.paintAll(); R.tick(3, 10); });
    n = 0; durs.length = 0;
    for (const f of fs.readdirSync(path.join(out, 'f'))) fs.unlinkSync(path.join(out, 'f', f));
  }
  await p.evaluate(() => window.__ruhua.easel.hold(true));
  cur = paintFps;
  for (let k = 0; k < 80; k++) { await run(0.5); const st = await p.evaluate(() => window.__ruhua.stage); if (st !== 'paint') break; }
  await p.evaluate(() => window.__ruhua.easel.hold(false));
  cur = fps;
  await mark('spill');
  // past the frame: drag the brush out across the world
  const rect = await p.evaluate(() => window.__ruhua.easel.state.rect);
  for (let k = 0; k <= 24; k++) {
    const u = rect[2] + 0.02 + k * 0.008, v = rect[1] + 0.25 + Math.sin(k * 0.4) * 0.12;
    await p.evaluate(({ u, v }) => window.__ruhua.easel.pointer(u, v, true), { u, v });
    await run(1 / fps);
    if ((await p.evaluate(() => window.__ruhua.stage)) !== 'spill') break;
  }
  await p.evaluate(() => { const R = window.__ruhua; if (R.stage === 'spill') R.depart(); });
  await mark('depart');
  for (let k = 0; k < 60; k++) { await run(0.5); const st = await p.evaluate(() => window.__ruhua.stage); if (st === 'stroll') break; }
  await mark('stroll'); await run(2.5);
  fs.writeFileSync(path.join(out, 'marks.json'), JSON.stringify(log, null, 1));
  await b.close();
  const list = durs.map((d, i) => `file '${path.resolve(out, 'f', String(i).padStart(5, '0') + '.png')}'\nduration ${d.toFixed(4)}`).join('\n');
  fs.writeFileSync(path.join(out, 'frames.txt'), list + `\nfile '${path.resolve(out, 'f', String(n - 1).padStart(5, '0') + '.png')}'\n`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(out, 'frames.txt'), '-vf', 'fps=12,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-c:v', 'libx264', '-crf', '22', path.join(out, 'transition.mp4')]);
  console.log('frames', n);
})();

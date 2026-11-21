// Record the motion lab frame by frame (deterministic 30 fps steps) and write a video + contact sheet.
//   node tests/life/lab-capture.cjs --figure v1 --seq all --view quad --out /tmp/x [--frames N] [--every 1] [--size 1280x800]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const figure = arg('figure', 'new'), seq = arg('seq', 'all'), view = arg('view', 'quad'), out = arg('out', 'lab-out');
const base = arg('base', 'http://127.0.0.1:8123');
const [W, H] = arg('size', '1280x860').split('x').map(Number);
const every = Number(arg('every', 1));
(async () => {
  fs.mkdirSync(path.join(out, 'f'), { recursive: true });
  for (const f of fs.readdirSync(path.join(out, 'f'))) fs.unlinkSync(path.join(out, 'f', f));
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('[err]', e.message));
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[c]', m.text().slice(0, 200)); });
  await p.goto(`${base}/walker-lab.html?figure=${figure}&seq=${seq}&view=${view}&capture${process.argv.includes('--yaw') ? '&yaw=' + arg('yaw') : ''}${process.argv.includes('--hold') ? '&hold=' + arg('hold') : ''}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__lab, null, { timeout: 60000 });
  const total = await p.evaluate(() => window.__lab.total);
  const n = Number(arg('frames', Math.round(total * 30)));
  const shots = !process.argv.includes('--metrics');
  for (let i = 0; i < n; i += every) {
    await p.evaluate((k) => window.__lab.advance(k), every);
    if (shots) await p.screenshot({ path: path.join(out, 'f', String(i / every).padStart(5, '0') + '.png') });
  }
  const sum = await p.evaluate(() => window.__lab.summary());
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(sum, null, 2));
  console.log(JSON.stringify(sum));
  await b.close();
  if (shots) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(30 / every), '-i', path.join(out, 'f', '%05d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', path.join(out, `${figure}-${seq}-${view}.mp4`)]);
})();

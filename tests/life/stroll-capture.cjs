// Record the walk from the game's own camera with scripted keys (simulation stepped at a fixed rate).
//   node tests/life/stroll-capture.cjs --page ruhua-alive.html --figure new --out DIR [--fps 10] [--size 640x400] [--at x,z,yaw] [--hour 12.7]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const page = arg('page', 'ruhua-alive.html'), out = arg('out', 'st-out'), fps = Number(arg('fps', 10)), figure = arg('figure', 'new');
const [W, H] = arg('size', '640x400').split('x').map(Number);
const at = arg('at', '-12,-14,2.6').split(',').map(Number);
const SCRIPT = [[1.0, []], [2.6, ['KeyW']], [1.6, ['KeyW', 'KeyD']], [1.4, ['KeyW']], [2.4, ['KeyW', 'ShiftLeft']], [1.6, []], [1.2, ['KeyS']], [1.4, []]];
(async () => {
  fs.mkdirSync(path.join(out, 'f'), { recursive: true });
  for (const f of fs.readdirSync(path.join(out, 'f'))) fs.unlinkSync(path.join(out, 'f', f));
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('[err]', e.message));
  await p.route('**/api.open-meteo.com/**', (r) => r.abort());
  await p.goto(`http://127.0.0.1:8123/${page}?stage=stroll&quality=low&capture&scale=1&figure=${figure}&date=2026-11-17`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__ruhua && window.__ruhua.stage === 'stroll', null, { timeout: 240000 });
  await p.evaluate(({ at, h }) => { const R = window.__ruhua; if (h) R.weather.setFree('clear', Number(h)); R.player.place(at[0], at[1], at[2]); R.still(2.5); }, { at, h: arg('hour') });
  let n = 0;
  const held = new Set();
  for (const [sec, keys] of SCRIPT) {
    for (const k of [...held]) if (!keys.includes(k)) { await p.keyboard.up(k === 'ShiftLeft' ? 'Shift' : k.replace('Key', '')); held.delete(k); }
    for (const k of keys) if (!held.has(k)) { await p.keyboard.down(k === 'ShiftLeft' ? 'Shift' : k.replace('Key', '')); held.add(k); }
    for (let i = 0; i < Math.round(sec * fps); i++) {
      await p.evaluate((d) => window.__ruhua.still(d, 30), 1 / fps);
      await p.screenshot({ path: path.join(out, 'f', String(n++).padStart(5, '0') + '.png') });
    }
  }
  await b.close();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(out, 'f', '%05d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', path.join(out, `stroll-${figure}.mp4`)]);
  console.log('frames', n);
})();

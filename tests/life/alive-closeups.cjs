// Close-ups of the campus's people at moments of their day (review camera: __ruhua.look).
//   node tests/life/alive-closeups.cjs --out DIR
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const out = arg('out', 'closeups');
fs.mkdirSync(out, { recursive: true });
const SHOTS = [
  ['lin-sketch', 'lin', 13.05, 'clear', [2.6, 1.6], 1.25],
  ['lin-tree-break', 'lin', 15.18, 'clear', [-2.8, 2.2], 1.3],
  ['fu-folder', 'fu', 10.705, 'clear', [2.8, 2.6], 1.3],
  ['wang-reading', 'wang', 12.615, 'clear', [2.6, 2.4], 1.3],
  ['wu-sweep', 'wu', 6.9, 'clear', [2.6, 2.6], 1.3],
  ['chen-court', 'chen', 17.2, 'clear', [3.2, 2.4], 1.2],
  ['exercise', 'lin', 9.7, 'clear', [3.0, 3.6], 1.5],
  ['lin-rain', 'lin', 12.95, 'drizzle', [2.6, 2.2], 1.3],
];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('[err]', e.message));
  await p.route('**/api.open-meteo.com/**', (r) => r.abort());
  await p.goto('http://127.0.0.1:8123/ruhua-alive.html?stage=stroll&quality=low&capture&date=2026-11-17', { waitUntil: 'load' });
  await p.waitForFunction(() => window.__ruhua && window.__ruhua.stage === 'stroll', null, { timeout: 240000 });
  for (const [name, who, hour, wx, off, h] of SHOTS) {
    await p.evaluate(({ who, hour, wx }) => {
      const R = window.__ruhua; R.look(null); R.weather.setFree(wx, hour); R.still(0.5);
      const s = R.life.byId.get(who).state; R.player.place(s.x + 9, s.z + 9, 0);
    }, { who, hour, wx });
    for (let i = 0; i < 8; i++) { await p.evaluate(() => window.__ruhua.still(0.5, 15)); await p.waitForTimeout(120); }
    const info = await p.evaluate(({ who, off, h }) => {
      const R = window.__ruhua, b = R.people.bodies.get(who);
      if (!b || !b.active) return { none: true, st: R.life.byId.get(who).state.act };
      const q = b.fig.position, yaw = b.fig.heading;
      // in front of them and a little to the side, looking at the chest
      const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      R.look([q.x + fx * off[0] + rx * off[1], q.y + h + 0.25, q.z + fz * off[0] + rz * off[1]], [q.x, q.y + 1.0, q.z], 38);
      R.still(0.2, 15);
      return { st: R.life.byId.get(who).state.act, at: [q.x.toFixed(1), q.z.toFixed(1)], umb: +b.fig.G.umb.toFixed(2) };
    }, { who, off, h });
    await p.screenshot({ path: path.join(out, name + '.png'), timeout: 180000 });
    console.log(name, JSON.stringify(info));
  }
  await b.close();
})();

// Stills for docs/life: the map in different weather and hours, and the campus's people in 3D.
//   node tests/life/alive-shots.cjs --out DIR [--only map|people]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const out = arg('out', 'shots'), only = arg('only', null);
fs.mkdirSync(out, { recursive: true });
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
async function page(b, w, h, mobile = false) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  p.on('pageerror', (e) => console.log('[err]', e.message));
  await p.route('**/api.open-meteo.com/**', (r) => r.abort());
  await p.goto('http://127.0.0.1:8123/ruhua-alive.html?stage=stroll&quality=low&capture&date=2026-11-17', { waitUntil: 'load' });
  await p.waitForFunction(() => window.__ruhua && window.__ruhua.stage === 'stroll', null, { timeout: 240000 });
  return p;
}
const settle = async (p, sec, n = 5) => { for (let i = 0; i < n; i++) { await p.evaluate((s) => window.__ruhua.still(s), sec / n); await p.waitForTimeout(100); } };
async function mapShot(p, name, wx, hour, at, opts = {}) {
  await p.evaluate(({ wx, hour, at }) => { const R = window.__ruhua; R.closeMap(); R.weather.setFree(wx, hour); R.player.place(at[0], at[1], at[2]); }, { wx, hour, at });
  await settle(p, opts.warm ?? 8);
  // a little walk so the player leaves red steps
  await p.evaluate(() => { const R = window.__ruhua; dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })); R.still(3, 30); dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' })); });
  await p.evaluate(() => { const R = window.__ruhua; R.openMap(); });
  // the page's opening is CSS: let it run in real time, the reveal is stepped
  for (let i = 0; i < 12; i++) { await p.evaluate(() => window.__ruhua.still(0.15)); await p.waitForTimeout(120); }
  if (opts.zoom) await p.evaluate((z) => { const v = window.__ruhua.map.view; v.s *= z; }, opts.zoom);
  if (opts.select) await p.evaluate((id) => { const R = window.__ruhua; R.map.select(id); }, opts.select);
  if (opts.day) { await p.evaluate(() => window.__ruhua.map.toggleDay(true)); for (let i = 0; i < 90; i++) { await p.evaluate(() => window.__ruhua.still(0.03)); await p.waitForTimeout(20); } }
  await p.evaluate(() => window.__ruhua.still(0.2));
  await p.screenshot({ path: path.join(out, name + '.png'), timeout: 180000 });
  console.log('shot', name);
}
async function peopleShot(p, name, hour, who, offset, opts = {}) {
  await p.evaluate(({ hour, wx }) => { const R = window.__ruhua; R.closeMap(); R.weather.setFree(wx || 'clear', hour); }, { hour, wx: opts.wx });
  await settle(p, 2, 4);
  await p.evaluate(({ who, offset }) => {
    const R = window.__ruhua, s = R.life.byId.get(who).state;
    const yaw = Math.atan2(-offset[0], -offset[1]);
    R.player.place(s.x + offset[0], s.z + offset[1], yaw);
    R.player.state.camYaw = yaw + (offset[2] || 0);
  }, { who, offset });
  await settle(p, opts.warm ?? 4, 14);
  const info = await p.evaluate((who) => { const R = window.__ruhua; const b = R.people.bodies.get(who); return { st: R.life.byId.get(who).state.act, body: b ? b.active : false }; }, who);
  await p.screenshot({ path: path.join(out, name + '.png'), timeout: 180000 });
  console.log('shot', name, JSON.stringify(info));
}
(async () => {
  const b = await chromium.launch({ args: ARGS });
  const p = await page(b, 1200, 760);
  if (!only || only === 'map') {
    await mapShot(p, 'map-noon', 'clear', 12.74, [-8, -14, 0.5]);
    await mapShot(p, 'map-noon-card', 'clear', 12.74, [-8, -14, 0.5], { select: 'lin', warm: 1 });
    await mapShot(p, 'map-rain', 'storm', 12.9, [-8, -14, 0.5], { warm: 12 });
    await mapShot(p, 'map-night', 'clear', 20.6, [-8, -14, 0.5]);
    await mapShot(p, 'map-exercise', 'clear', 9.62, [-150, -20, -1.2], { zoom: 1.5 });
    await mapShot(p, 'map-day', 'clear', 18.45, [-8, -14, 0.5], { day: true, warm: 2 });
  }
  if (!only || only === 'people') {
    await peopleShot(p, 'people-chen-court', 17.2, 'chen', [6, 7]);
    await peopleShot(p, 'people-lin-garden', 13.05, 'lin', [3.5, 4.5]);
    await peopleShot(p, 'people-wu-sweep', 6.9, 'wu', [5, -5]);
    await peopleShot(p, 'people-exercise', 9.7, 'lin', [-8, -10]);
    await peopleShot(p, 'people-rain', 12.95, 'lin', [4, -5], { wx: 'drizzle', warm: 10 });
  }
  await p.close();
  if (!only || only === 'map') {
    const m = await page(b, 390, 844, true);
    await mapShot(m, 'map-phone', 'clear', 17.1, [-8, -14, 0.5]);
    await m.close();
  }
  await b.close();
})();

// 自由共游 on a phone, driven by real touch input (CDP touch events → pointer events with pointerType
// 'touch'), not by setting keys: the floating stick, the right thumb's buttons, getting on and off with the
// mode bar, the broom's 升/降, the sketch button, the sketchbook surviving a reload; plus the bike's roll
// cap on a hard turn and the route's dabs and beacon drawn on the desktop.
//   python3 -m http.server 8123 &   node tests/free/free-touch.cjs [--base http://127.0.0.1:8123] [--shots DIR]
// Software GL (SwiftShader) in an emulated 390×844 touch viewport: this checks behaviour, not a real phone.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('base', 'http://127.0.0.1:8123');
const SHOTS = arg('shots', null);
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); console.log(ok ? 'ok  ' : 'FAIL', name, detail === undefined ? '' : JSON.stringify(detail)); };
const URL = `${BASE}/ruhua-free.html?stage=stroll&quality=low&capture&date=2026-11-17`;

async function ready(p) {
  await p.waitForFunction(() => window.__ruhua && window.__ruhua.stage === 'stroll' && window.__ruhua.free, null, { timeout: 300000 });
  await p.evaluate(() => window.__ruhua.weather.setFree('clear', 16.5));
}

// a set of fingers on the glass: each one keeps its id while it is down
function fingers(cdp) {
  const down = new Map();
  const send = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...down.values()] });
  return {
    async start(id, x, y) { down.set(id, { x, y, id, radiusX: 4, radiusY: 4, force: 1 }); await send('touchStart'); },
    async move(id, x, y) { Object.assign(down.get(id), { x, y }); await send('touchMove'); },
    async end(id) { const t = down.get(id); down.delete(id); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [...down.values()] }); return t; },
  };
}
const centre = (p, sel) => p.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);

(async () => {
  const browser = await chromium.launch({ args: ARGS });
  // ================================================================ the phone
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.route('**/api.open-meteo.com/**', (r) => r.abort());
  await p.goto(URL, { waitUntil: 'load' });
  await ready(p);
  await p.evaluate(() => localStorage.removeItem('haiz-free-sketchbook-v1'));
  const cdp = await ctx.newCDPSession(p);
  const F = fingers(cdp);
  const still = (s) => p.evaluate((s) => window.__ruhua.still(s), s);
  const snap = () => p.evaluate(() => { const f = window.__ruhua.free, S = f.ride.state; return { mode: f.ride.mode, phase: f.ride.phase, v: S.speed, roll: S.roll, agl: S.agl, x: S.pos.x, z: S.pos.z }; });
  const tapSel = async (sel) => { const c = await centre(p, sel); await F.start(9, c.x, c.y); await F.end(9); };

  // ---- the bike, on the mode bar, ridden with the floating stick
  await p.evaluate(() => window.__ruhua.player.place(-30, -18, 0.6)); await still(0.5);
  await tapSel('#fr-modes [data-mode="bike"]'); await still(1.6);
  let s = await snap();
  check('phone: tapping 骑 on the mode bar mounts the bike', s.mode === 'bike' && s.phase === 'ride', { phase: s.phase });
  // the stick goes down beside the compass, where a left thumb rests (not on the compass, which opens 去哪儿)
  const S0 = await p.evaluate(() => { const r = document.querySelector('#fr-hud canvas').getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y - 70) }; });
  const hit = await p.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, S0);
  await F.start(1, S0.x, S0.y); await F.move(1, S0.x, S0.y - 30); await F.move(1, S0.x, S0.y - 44);
  await still(2.4);
  s = await snap();
  const stickShown = await p.evaluate(() => !document.querySelector('#rh-stick')?.hidden);
  check('phone: the stick (pushed up) pedals the bike forward', s.v > 3 && stickShown, { v: +s.v.toFixed(2), stickShown, at: S0, hit });
  // a hard turn at the rim (sprinting): the whole roll stays within ±0.5 rad
  await F.move(1, S0.x + 54, S0.y - 14);
  let maxRoll = 0;
  for (let i = 0; i < 16; i++) { await still(0.15); maxRoll = Math.max(maxRoll, Math.abs((await snap()).roll)); }
  check('bike: total roll stays within 0.5 rad (29°) on a hard sprinting turn', maxRoll <= 0.5 + 1e-6 && maxRoll > 0.3, { maxRoll: +maxRoll.toFixed(3) });
  await F.end(1); await still(1.5);
  // the bell button while riding: a press is read as a ring
  const bc = await centre(p, '[data-pad="bell"]');
  await p.evaluate(() => { window.__rang = 0; window.__ruhua.free.on((n) => { if (n === 'bell') window.__rang++; }); });
  await F.start(2, bc.x, bc.y); await still(0.1); await F.end(2); await still(0.2);
  const rang = await p.evaluate(() => window.__rang);
  check('phone: 铃 rings the bell', rang >= 1, { rang });
  // off again with 步
  await tapSel('#fr-modes [data-mode="walk"]'); await still(4.5);
  s = await snap();
  check('phone: tapping 步 gets off and walks', s.phase === 'free', { mode: s.mode, phase: s.phase });

  // ---- the broom: 升 and 降 held with the right thumb
  await tapSel('#fr-modes [data-mode="broom"]'); await still(1.6);
  s = await snap();
  check('phone: tapping 飞 mounts the broom', s.mode === 'broom' && s.phase === 'ride', { phase: s.phase });
  // ---- while riding, the readings beside the compass let a thumb through to the stick
  const through = await p.evaluate(() => { const r = document.querySelector('#fr-hud .fr-read').getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return e?.id || e?.tagName; });
  check('phone: the HUD readings do not block touches (only the compass takes a tap)', through === 'rh-canvas', { under: through });

  const up = await centre(p, '[data-pad="up"]'), dn = await centre(p, '[data-pad="down"]');
  const a0 = s.agl;
  await F.start(3, up.x, up.y); await still(2.5); await F.end(3); await still(0.3);
  const a1 = (await snap()).agl;
  await F.start(4, dn.x, dn.y); await still(2.0); await F.end(4); await still(0.3);
  const a2 = (await snap()).agl;
  check('phone: holding 升 climbs, holding 降 comes down', a1 > a0 + 3 && a2 < a1 - 2, { start: +a0.toFixed(1), afterUp: +a1.toFixed(1), afterDown: +a2.toFixed(1) });
  // stick and 升 at once (two fingers): flies forward while climbing
  await F.start(1, S0.x, S0.y); await F.move(1, S0.x, S0.y - 40); await still(0.3);
  await F.start(3, up.x, up.y);
  await still(1.5);
  const both = await snap();
  await F.end(3); await F.end(1); await still(0.5);
  check('phone: two fingers (stick + 升) fly forward and climb together', both.v > 3 && both.agl > a2, { v: +both.v.toFixed(2), agl: +both.agl.toFixed(1) });

  // ---- a sketch with the 画下来 button, kept across a reload
  await p.evaluate(() => { const S = window.__ruhua.free.ride.state; S.pos.set(-1.5, 10.2, -3.2); S.speed = 0; S.vy = 0; S.holdAgl = 11; });
  await still(1.2);
  const vista = await p.evaluate(() => ({ id: window.__ruhua.free.vistas.current?.id, shown: !document.querySelector('#fr-vista').hidden }));
  check('phone: 榄仁听风 opens in the crown and shows 画下来', vista.id === 'crown' && vista.shown, vista);
  if (vista.shown) { await tapSel('[data-vista="sketch"]'); await still(0.3); }
  const kept = await p.evaluate(() => { const b = JSON.parse(localStorage.getItem('haiz-free-sketchbook-v1') || '{}'); return b.crown ? b.crown.img.length : 0; });
  check('phone: tapping 画下来 keeps a sketch in this browser', kept > 8000, { bytes: kept });
  await p.reload({ waitUntil: 'load' });
  await ready(p);
  const after = await p.evaluate(() => { const b = JSON.parse(localStorage.getItem('haiz-free-sketchbook-v1') || '{}'); return { pages: Object.keys(b), bytes: b.crown ? b.crown.img.length : 0 }; });
  check('phone: the sketchbook is still there after a reload', after.bytes === kept && after.pages.includes('crown'), after);
  check('no page errors (phone, touch)', errors.length === 0, errors.slice(0, 3));
  await ctx.close();

  // ================================================================ the route, drawn (desktop)
  const dctx = await browser.newContext({ viewport: { width: 1000, height: 620 }, deviceScaleFactor: 1 });
  const d = await dctx.newPage();
  const derr = [];
  d.on('pageerror', (e) => derr.push(e.message));
  await d.route('**/api.open-meteo.com/**', (r) => r.abort());
  await d.goto(URL, { waitUntil: 'load' });
  await ready(d);
  const dstill = (s) => d.evaluate((s) => window.__ruhua.still(s), s);
  await d.evaluate(() => window.__ruhua.player.place(-8, -14, 1.2)); await dstill(0.4);
  await d.evaluate(() => window.__ruhua.free.hud.setDest('library'));
  await d.evaluate(() => window.__ruhua.free.input.keys.add('KeyW')); await dstill(1.4); await d.evaluate(() => window.__ruhua.free.input.keys.delete('KeyW'));
  await dstill(1.0);
  const drawn = await d.evaluate(() => {
    const g = window.__ruhua.free.route && window.__ruhua.world.group.getObjectByName('route');
    const dabs = g?.children.find((o) => o.isInstancedMesh), beacon = g?.children.find((o) => o.isMesh && !o.isInstancedMesh);
    return { dabs: dabs?.count ?? -1, beacon: !!beacon?.visible };
  });
  check('route: brush dabs are laid on the path and the beacon stands over the library', drawn.dabs > 5 && drawn.beacon, drawn);
  if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await d.screenshot({ path: path.join(SHOTS, 'route-dabs.png') }); }
  check('no page errors (desktop, route)', derr.length === 0, derr.slice(0, 3));
  await dctx.close();
  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'free-touch-results.json'), JSON.stringify({ date: new Date().toISOString(), renderer: 'Chromium + SwiftShader, emulated 390×844 touch', passed: results.filter((x) => x.ok).length, total: results.length, results }, null, 2));
  console.log(`${results.filter((x) => x.ok).length}/${results.length} passed`);
  process.exit(results.every((x) => x.ok) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });

// 自由共游 (ruhua-free.html) in Chromium: every way of moving, getting on and off, the body on the machine,
// walls, roofs and the sky's limit, the compass's route, a sketch kept in the book, the phone's buttons.
//   python3 -m http.server 8123 &   node tests/free/free-browser.cjs [--base http://127.0.0.1:8123]
// Software GL (SwiftShader): this checks behaviour, not frame rate.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('base', 'http://127.0.0.1:8123');
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); console.log(ok ? 'ok  ' : 'FAIL', name, detail === undefined ? '' : JSON.stringify(detail)); };

async function open(browser, viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: !!opts.mobile, hasTouch: !!opts.mobile });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.route('**/api.open-meteo.com/**', (r) => r.abort());
  await p.goto(`${BASE}/ruhua-free.html?stage=stroll&quality=low&capture&date=2026-11-17`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__ruhua && window.__ruhua.stage === 'stroll' && window.__ruhua.free, null, { timeout: 300000 });
  await p.evaluate(() => { const R = window.__ruhua; R.weather.setFree('clear', 16.5); localStorage.removeItem('haiz-free-sketchbook-v1'); });
  return { p, ctx, errors };
}
const still = (p, s) => p.evaluate((s) => window.__ruhua.still(s), s);
const keys = (p, on, off = []) => p.evaluate(({ on, off }) => { const k = window.__ruhua.free.input.keys; on.forEach((c) => k.add(c)); off.forEach((c) => k.delete(c)); }, { on, off });
const tap = (p, c) => p.evaluate((c) => { dispatchEvent(new KeyboardEvent('keydown', { code: c })); dispatchEvent(new KeyboardEvent('keyup', { code: c })); }, c);
const snap = (p) => p.evaluate(() => { const f = window.__ruhua.free, S = f.ride.state; return { mode: f.ride.mode, phase: f.ride.phase, x: S.pos.x, y: S.pos.y, z: S.pos.z, v: S.speed, yaw: S.yaw, roll: S.roll, agl: S.agl, lean: S.lean }; });
const clearance = (p) => p.evaluate(async () => { const R = window.__ruhua, f = R.free, pos = f.position; const { nearest } = await import('./lanren/world/collide.js'); return nearest(R.world.colliders, pos.x, pos.z).d; });

(async () => {
  const browser = await chromium.launch({ args: ARGS });
  const { p, errors } = await open(browser, { width: 1000, height: 620 });
  // ---- the readers of the wake were patched before they compiled
  const ws = await p.evaluate(() => window.__ruhua.wake.stats());
  check('wake readers patched (grass, lawn, crowns)', ws.grass > 0 && ws.lawn > 0 && ws.crowns > 0, ws);

  const place = (x, z, yaw) => p.evaluate(({ x, z, yaw }) => window.__ruhua.player.place(x, z, yaw), { x, z, yaw });
  // ---- each way of moving: on, along, turning, off
  const EXPECT = { bike: { key: 'Digit2', v: [4.3, 6.2] }, board: { key: 'Digit3', v: [2.0, 6.8] }, broom: { key: 'Digit4', v: [7.5, 11] } };
  for (const [mode, E] of Object.entries(EXPECT)) {
    await place(-60, -22, Math.PI / 2); await still(p, 0.5);
    await tap(p, E.key); await still(p, 1.4);
    let s = await snap(p);
    check(`${mode}: summoned and mounted`, s.mode === mode && s.phase === 'ride', { phase: s.phase });
    if (mode === 'bike') {
      // the body reaches the machine: ankles over the pedals, wrists at the grips
      const ik = await p.evaluate(() => {
        const f = window.__ruhua.free, b = f.ride.machines.bike, rig = f.rig;
        const d = (a, bb) => a.distanceTo(bb);
        const fl = rig.where('foot.L'), fr = rig.where('foot.R');
        const pl = b.pedals.L.getWorldPosition(new fl.constructor()), pr = b.pedals.R.getWorldPosition(new fl.constructor());
        const hl = rig.where('hand.L'), hr = rig.where('hand.R');
        b.body.updateMatrixWorld(true);
        const gl = b.grip('L', f.ride.state.steer).applyMatrix4(b.body.matrixWorld), gr = b.grip('R', f.ride.state.steer).applyMatrix4(b.body.matrixWorld);
        return { footL: +d(fl, pl).toFixed(3), footR: +d(fr, pr).toFixed(3), handL: +d(hl, gl).toFixed(3), handR: +d(hr, gr).toFixed(3) };
      });
      check('bike: ankles within 12 cm of the pedals, wrists within 12 cm of the grips', Math.max(ik.footL, ik.footR, ik.handL, ik.handR) < 0.12, ik);
    }
    await keys(p, mode === 'broom' ? ['KeyW', 'Space'] : ['KeyW']);
    await still(p, 1.0); await keys(p, [], ['Space']);
    await still(p, 2.2);
    s = await snap(p);
    check(`${mode}: cruising speed ${E.v[0]}–${E.v[1]} m/s`, s.v >= E.v[0] && s.v <= E.v[1], { v: +s.v.toFixed(2) });
    await keys(p, ['KeyD']); await still(p, 0.9);
    s = await snap(p);
    const leanRight = mode === 'board' ? await p.evaluate(() => window.__ruhua.free.ride.state.carve < -0.05) : s.roll > 0.05;
    check(`${mode}: a right turn leans right`, leanRight, { roll: +s.roll.toFixed(3) });
    await keys(p, [], ['KeyD', 'KeyW']);
    await tap(p, 'Digit1'); await still(p, 5);
    s = await snap(p);
    const d = await clearance(p);
    check(`${mode}: off again, walking, clear of every wall`, s.mode === 'walk' && s.phase === 'free' && d >= 0.25, { phase: s.phase, clearance: +d.toFixed(2) });
  }
  // ---- straight at a building on the bike: it never ends up inside
  await place(-20, -10, Math.PI); await still(p, 0.4);
  await tap(p, 'Digit2'); await still(p, 1.4);
  await keys(p, ['KeyW', 'ShiftLeft']);
  let minClear = 99;
  for (let i = 0; i < 12; i++) { await still(p, 0.5); minClear = Math.min(minClear, await clearance(p)); }
  await keys(p, [], ['KeyW', 'ShiftLeft']);
  check('bike against the walls: never inside a building', minClear > 0.3, { minClearance: +minClear.toFixed(2) });
  await tap(p, 'Digit1'); await still(p, 4);
  // ---- the broom: the sky has a limit, the campus has an edge, a roof is somewhere to land
  await place(-30, 10, 0); await still(p, 0.4);
  await tap(p, 'Digit4'); await still(p, 1.4);
  await keys(p, ['Space', 'KeyW', 'ShiftLeft']);
  let maxAgl = 0, out = 0;
  for (let i = 0; i < 16; i++) { await still(p, 1); const s = await snap(p); maxAgl = Math.max(maxAgl, s.agl); out = Math.max(out, s.x - 210, -340 - s.x, s.z - 345, -190 - s.z); }
  await keys(p, [], ['Space', 'ShiftLeft']);
  check('broom: below the ceiling (56 m) and within the campus', maxAgl < 58 && out <= 0, { maxAgl: +maxAgl.toFixed(1), outside: +out.toFixed(1) });
  // over 一号楼 (roof at ground + 19 m), descending: it settles on the roof
  await p.evaluate(() => { const S = window.__ruhua.free.ride.state; S.pos.set(-60, 30, 25); S.speed = 0; S.vy = 0; S.holdAgl = -1; });
  await keys(p, ['KeyC'], ['KeyW']); await still(p, 4); await keys(p, [], ['KeyC']); await still(p, 1);
  const roof = await p.evaluate(() => { const f = window.__ruhua.free, S = f.ride.state; return { y: S.pos.y, top: f.ride.solids.topAt(S.pos.x, S.pos.z) }; });
  check('broom: comes down onto a roof, not through it', roof.top > 0 && Math.abs(roof.y - roof.top - 0.95) < 0.4, { y: +roof.y.toFixed(2), roof: +roof.top.toFixed(2) });
  // ---- 海中八景: in the old tree's crown, hovering: the view opens, a sketch is kept
  await p.evaluate(() => { const S = window.__ruhua.free.ride.state; S.pos.set(-1.5, 10.2, -3.2); S.speed = 0; S.vy = 0; S.holdAgl = 11; });
  await still(p, 1);
  const v = await p.evaluate(() => window.__ruhua.free.vistas.current?.id);
  check('vista: 榄仁听风 opens inside the crown', v === 'crown', { vista: v });
  await tap(p, 'KeyF'); await still(p, 0.2);
  const kept = await p.evaluate(() => { const b = JSON.parse(localStorage.getItem('haiz-free-sketchbook-v1') || '{}'); return b.crown ? { bytes: b.crown.img.length, when: b.crown.when } : null; });
  check('vista: the sketch is drawn and kept in this browser', kept && kept.bytes > 8000, kept);
  await tap(p, 'Digit1'); await still(p, 6);
  // ---- the compass's route on the ground, from the tree to the library
  await place(-8, -14, 1.2); await still(p, 0.4);
  await p.evaluate(() => window.__ruhua.free.hud.setDest('library'));
  await keys(p, ['KeyW']); await still(p, 1.2); await keys(p, [], ['KeyW']);
  const r = await p.evaluate(() => { const h = window.__ruhua.free.hud; return h.route ? { n: h.route.points.length, air: h.route.air, dest: h.dest?.label, text: document.querySelector('[data-hud="dest"]').textContent } : null; });
  check('route: found on the campus paths and written in the margin', r && r.n >= 2 && !r.air && /图书馆/.test(r.text), r);
  check('no page errors (desktop)', errors.length === 0, errors.slice(0, 3));
  await p.context().close();

  // ---- the phone: the right thumb's buttons appear with the ride
  const m = await open(browser, { width: 390, height: 844 }, { mobile: true });
  await m.p.evaluate(() => window.__ruhua.player.place(-30, -18, 0.6));
  await m.p.tap('#fr-modes [data-mode="bike"]'); await still(m.p, 1.5);
  const pad = await m.p.evaluate(() => ({ mode: document.querySelector('#fr-pad').dataset.mode, shown: getComputedStyle(document.querySelector('#fr-pad')).display, bell: getComputedStyle(document.querySelector('[data-pad="bell"]')).display }));
  check('phone: on the bike the bell and 疾 buttons are shown', pad.mode === 'bike' && pad.shown !== 'none' && pad.bell !== 'none', pad);
  check('no page errors (phone)', m.errors.length === 0, m.errors.slice(0, 3));
  await m.ctx.close();
  await browser.close();
  const out2 = path.join(__dirname, 'free-browser-results.json');
  fs.writeFileSync(out2, JSON.stringify({ date: new Date().toISOString(), renderer: 'Chromium + SwiftShader', passed: results.filter((x) => x.ok).length, total: results.length, results }, null, 2));
  console.log(`${results.filter((x) => x.ok).length}/${results.length} passed`);
  process.exit(results.every((x) => x.ok) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });

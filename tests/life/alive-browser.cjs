// HAIZ · 校园活着 — browser acceptance for ruhua-alive.html (Chromium; software GL is fine).
//   node tests/life/alive-browser.cjs [--base http://127.0.0.1:8123] [--shots DIR]
// Checks: the page and the walk start; the people's bodies walk where their day says and where the map
// draws them; nobody (player or NPC) ends up inside a wall; rain reaches the people and the page; the
// map opens, reads and closes, on a desktop and on a phone held upright.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('base', 'http://127.0.0.1:8123');
const SHOTS = arg('shots', null);
const results = [];
const check = async (name, fn) => {
  try { const note = await fn(); results.push({ name, ok: true, note }); console.log('ok  ', name, note ? '— ' + note : ''); }
  catch (e) { results.push({ name, ok: false, error: e.message }); console.log('FAIL', name, '—', e.message); }
};
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

async function open(browser, viewport, opts = {}) {
  const p = await browser.newPage({ viewport, deviceScaleFactor: 1, isMobile: !!opts.mobile, hasTouch: !!opts.mobile });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.route('**/api.open-meteo.com/**', (r) => r.abort());     // offline: the climate-normal fallback
  await p.goto(`${BASE}/ruhua-alive.html?stage=stroll&quality=low&capture`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__ruhua && window.__ruhua.stage === 'stroll', null, { timeout: 240000 });
  return { p, errors };
}
// let async body loads resolve between deterministic steps
async function settle(p, seconds = 2, slices = 8) {
  for (let i = 0; i < slices; i++) { await p.evaluate((s) => window.__ruhua.still(s), seconds / slices); await p.waitForTimeout(120); }
}

(async () => {
  const browser = await chromium.launch({ args: ARGS });
  const { p, errors } = await open(browser, { width: 1100, height: 700 });

  await check('the walk starts with the new gait, the people and the map', async () => {
    const r = await p.evaluate(() => { const R = window.__ruhua; return { gait: !!R.student.human, people: R.life.agents.length, nav: R.nav.nx * R.nav.nz, map: !!R.map }; });
    if (!r.gait || r.people < 5 || !r.map) throw new Error(JSON.stringify(r));
    return `${r.people} people, ${r.nav} nav cells`;
  });

  await check('at 12:43 on a Tuesday the day is where it should be', async () => {
    const r = await p.evaluate(() => { const R = window.__ruhua; R.weather.setFree('clear', 12.72); R.still(1); return Object.fromEntries(R.life.agents.map((a) => [a.id, [a.state.act, a.state.place || a.state.to]])); });
    if (r.chen[0] !== 'play' && r.chen[0] !== 'walk') throw new Error('chen ' + r.chen);
    if (!(r.fu[1] === 'canteen1' || r.fu[0] === 'walk')) throw new Error('fu ' + r.fu);
    return Object.entries(r).map(([k, v]) => `${k}:${v[0]}`).join(' ');
  });

  await check('a body walks where the day says, and the map draws it there', async () => {
    await p.evaluate(() => { const R = window.__ruhua; const s = R.life.byId.get('chen').state; R.player.place(s.x + 4, s.z + 6, Math.PI); });
    await settle(p, 3);
    const samples = [];
    for (let i = 0; i < 6; i++) {
      await settle(p, 0.6, 3);
      samples.push(await p.evaluate(() => {
        const R = window.__ruhua, a = R.life.byId.get('chen'), b = R.people.bodies.get('chen');
        if (!b || !b.active) return null;
        R.openMap?.(); R.still(0.05);
        const item = R.map.items.find((it) => it.a.id === 'chen');
        R.closeMap?.();
        const pos = b.fig.position;
        return { body: [pos.x, pos.z], day: [a.state.x, a.state.z], map: item ? [item.x, item.z] : null };
      }));
    }
    const ok = samples.filter(Boolean);
    if (ok.length < 4) throw new Error('the body did not come: ' + JSON.stringify(samples));
    let maxDay = 0, maxMap = 0;
    for (const s of ok) {
      maxDay = Math.max(maxDay, Math.hypot(s.body[0] - s.day[0], s.body[1] - s.day[1]));
      if (!s.map) throw new Error('not on the map');
      maxMap = Math.max(maxMap, Math.hypot(s.body[0] - s.map[0], s.body[1] - s.map[1]));
    }
    if (maxDay > 3.5) throw new Error(`body ${maxDay.toFixed(2)} m from its day`);
    if (maxMap > 0.05) throw new Error(`map ${maxMap.toFixed(2)} m from the body`);
    return `body within ${maxDay.toFixed(2)} m of its day; map within ${maxMap.toFixed(3)} m of the body`;
  });

  await check('nobody stands inside a wall (player pushed into a building, people walking)', async () => {
    const r = await p.evaluate(async () => {
      const R = window.__ruhua;
      const { nearest } = await import('./lanren/world/collide.js');
      // the player walks straight at 一号教学楼's north face for four seconds
      R.player.place(-34.9, 0, 0);
      const keyDown = (code) => dispatchEvent(new KeyboardEvent('keydown', { code })), keyUp = (code) => dispatchEvent(new KeyboardEvent('keyup', { code }));
      R.player.state.camYaw = 0; keyDown('KeyW');
      let minP = 9;
      for (let i = 0; i < 120; i++) { R.player.state.lastLook = R.player.state.time; R.still(1 / 30); minP = Math.min(minP, nearest(R.world.colliders, R.player.state.pos.x, R.player.state.pos.z).d); }
      keyUp('KeyW');
      let minN = 9;
      for (const b of R.people.bodies.values()) if (b.active) minN = Math.min(minN, nearest(R.world.colliders, b.fig.position.x, b.fig.position.z).d);
      return { minP, minN, z: R.player.state.pos.z };
    });
    if (r.minP < 0.2) throw new Error(`player ${r.minP.toFixed(2)} m from a wall`);
    if (r.minN < 0.15) throw new Error(`a person ${r.minN.toFixed(2)} m from a wall`);
    return `player kept ${r.minP.toFixed(2)} m clear (stopped at z=${r.z.toFixed(1)}), people ${r.minN === 9 ? '—' : r.minN.toFixed(2) + ' m'}`;
  });

  await check('rain reaches the people (umbrellas, plans) and the page (drops, wet paths)', async () => {
    await p.evaluate(() => { const R = window.__ruhua; R.weather.setFree('storm', 15.25); const s = R.life.byId.get('wu').state; R.player.place(s.x + 5, s.z + 5, 0); });
    await settle(p, 10, 12);
    const r = await p.evaluate(() => {
      const R = window.__ruhua;
      const um = [...R.people.bodies.entries()].filter(([, b]) => b.active).map(([id, b]) => [id, +b.fig.G.umb.toFixed(2)]);
      return { wu: R.life.byId.get('wu').state.place, um, wet: R.weather.state.cur.wet };
    });
    if (!(r.wu === 'yanlin_ting' || r.wu === 'keji' || r.wu === null)) throw new Error('Wu in the storm at ' + r.wu);
    if (!r.um.length || !r.um.some(([, u]) => u > 0.5)) throw new Error('no umbrella up: ' + JSON.stringify(r.um));
    return `吴伯 → ${r.wu}; umbrellas ${JSON.stringify(r.um)}`;
  });

  await check('the map opens from the sketchbook, draws, answers a tap, and closes (M)', async () => {
    await p.evaluate(() => { const R = window.__ruhua; R.weather.setFree('clear', 12.72); R.resume(); });
    await p.keyboard.press('KeyM');
    await p.waitForTimeout(2600);
    const open = await p.evaluate(() => ({ open: window.__ruhua.map.isOpen, hidden: document.querySelector('#lf-map').hidden, items: window.__ruhua.map.items.map((i) => i.label) }));
    if (!open.open || open.hidden) throw new Error('map did not open');
    const ink = await p.evaluate(() => {
      const c = document.querySelector('#lf-map-canvas'), g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data; let dark = 0;
      for (let i = 0; i < d.length; i += 16) if (d[i] + d[i + 1] + d[i + 2] < 300) dark++;
      return dark / (d.length / 16);
    });
    if (ink < 0.01) throw new Error('the page is blank');
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'alive-map-desktop.png') });
    const tapped = await p.evaluate(() => {
      const it = window.__ruhua.map.items.find((i) => i.a.id !== 'you' && i.hit);
      if (!it) return null;
      const r = document.querySelector('#lf-map-canvas').getBoundingClientRect();
      return { x: r.left + it.hit.x + it.hit.w / 2, y: r.top + it.hit.y + it.hit.h / 2, name: it.label };
    });
    if (!tapped) throw new Error('nothing to tap');
    await p.mouse.click(tapped.x, tapped.y);
    await p.waitForTimeout(300);
    const card = await p.evaluate(() => ({ hidden: document.querySelector('#lf-card').hidden, text: document.querySelector('#lf-card').textContent }));
    if (card.hidden || !card.text.includes(tapped.name.slice(0, 2))) throw new Error('no card for ' + tapped.name + ': ' + card.text);
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'alive-map-card.png') });
    await p.keyboard.press('KeyM');
    await p.waitForTimeout(900);
    const closed = await p.evaluate(() => ({ open: window.__ruhua.map.isOpen, hidden: document.querySelector('#lf-map').hidden, enabled: window.__ruhua.player.state }));
    if (closed.open || !closed.hidden) throw new Error('map did not close');
    return `${open.items.length} names on the page, ink ${(ink * 100).toFixed(1)}%, card for ${tapped.name}`;
  });

  await check('no page errors (desktop)', async () => { if (errors.length) throw new Error(errors.join(' | ')); return 'none'; });
  await p.close();

  // 入画: the painter faces the tree before the easel rises; a resize mid-painting keeps the canvas whole
  {
    const t = await browser.newPage({ viewport: { width: 1100, height: 620 }, deviceScaleFactor: 1 });
    const errs = [];
    t.on('pageerror', (e) => errs.push(e.message));
    await t.route('**/api.open-meteo.com/**', (r) => r.abort());
    await t.goto(`${BASE}/ruhua-alive.html?quality=low&capture`, { waitUntil: 'load' });
    await t.waitForFunction(() => window.__ruhua && window.__ruhua.stage === 'hold', null, { timeout: 240000 });
    await check('支起画架: the view turns to the tree, and the blank canvas stands over its heart', async () => {
      await t.evaluate(() => { window.__ruhua.paint(); });
      for (let k = 0; k < 60; k++) { await t.evaluate(() => window.__ruhua.still(0.1, 10)); await t.waitForTimeout(40); if ((await t.evaluate(() => window.__ruhua.stage)) === 'paint') break; }
      const r = await t.evaluate(async () => {
        const R = window.__ruhua; const THREE = await import('three');
        const P = R.easel.state.P, rect = R.easel.state.rect;
        const crown = new THREE.Vector3(0.2, 7.0, 0.6).project(P), trunk = new THREE.Vector3(0, 1.5, 0).project(P);
        return { stage: R.stage, rect, crown: [(crown.x + 1) / 2, (crown.y + 1) / 2], trunk: [(trunk.x + 1) / 2, (trunk.y + 1) / 2] };
      });
      if (r.stage !== 'paint') throw new Error('stage ' + r.stage);
      const inR = ([u, v]) => u > r.rect[0] && u < r.rect[2] && v > r.rect[1] && v < r.rect[3];
      if (!inR(r.crown) || !inR(r.trunk)) throw new Error(`tree outside the canvas: crown ${r.crown.map((v) => v.toFixed(2))} trunk ${r.trunk.map((v) => v.toFixed(2))} rect ${r.rect}`);
      if (Math.abs(r.crown[0] - (r.rect[0] + r.rect[2]) / 2) > 0.08) throw new Error('crown off-centre ' + r.crown[0].toFixed(2));
      return `crown at (${r.crown.map((v) => v.toFixed(2))}), trunk at (${r.trunk.map((v) => v.toFixed(2))}) inside the canvas`;
    });
    await check('a window resized mid-painting keeps the whole canvas in view (same eye, wider lens)', async () => {
      await t.setViewportSize({ width: 620, height: 900 });
      await t.waitForTimeout(400);
      const r = await t.evaluate(async () => {
        const R = window.__ruhua; const THREE = await import('three');
        R.still(0.1, 10);
        const m = R.easel.canvasMesh; m.updateMatrixWorld();
        const cam = R.camera; cam.updateMatrixWorld();
        const out = [];
        for (const [x, y] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) { const v = new THREE.Vector3(x, y, 0).applyMatrix4(m.matrixWorld).project(cam); out.push([+v.x.toFixed(3), +v.y.toFixed(3)]); }
        const P = R.easel.state.P;
        return { corners: out, sameEye: cam.position.distanceTo(P.position) < 1e-4, fov: cam.fov };
      });
      if (!r.sameEye) throw new Error('the eye moved');
      if (r.corners.some(([x, y]) => Math.abs(x) > 1.001 || Math.abs(y) > 1.001)) throw new Error('canvas cut off: ' + JSON.stringify(r.corners));
      return `fov ${r.fov.toFixed(1)}°, corners ${JSON.stringify(r.corners)}`;
    });
    await check('no page errors (transition)', async () => { if (errs.length) throw new Error(errs.join(' | ')); return 'none'; });
    await t.close();
  }

  // a phone, upright, with touch
  const m = await open(browser, { width: 390, height: 844 }, { mobile: true });
  await check('phone portrait: the map opens from its button and closes', async () => {
    await m.p.evaluate(() => { const R = window.__ruhua; R.weather.setFree('clear', 17.1); R.resume(); });
    await m.p.waitForTimeout(1500);
    await m.p.tap('[data-life="map"]');
    await m.p.waitForTimeout(2600);
    const r = await m.p.evaluate(() => ({ open: window.__ruhua.map.isOpen, w: document.querySelector('#lf-map-canvas').clientWidth, h: document.querySelector('#lf-map-canvas').clientHeight, sw: document.documentElement.scrollWidth }));
    if (!r.open) throw new Error('did not open');
    if (r.sw > 391) throw new Error('page scrolls sideways: ' + r.sw);
    if (SHOTS) await m.p.screenshot({ path: path.join(SHOTS, 'alive-map-phone.png') });
    await m.p.tap('[data-life="close"]');
    await m.p.waitForTimeout(900);
    const closed = await m.p.evaluate(() => window.__ruhua.map.isOpen);
    if (closed) throw new Error('did not close');
    return `page ${r.w}×${r.h}`;
  });
  await check('no page errors (phone)', async () => { if (m.errors.length) throw new Error(m.errors.join(' | ')); return 'none'; });
  await browser.close();
  const ok = results.every((r) => r.ok);
  fs.writeFileSync(path.join(__dirname, 'alive-browser-results.json'), JSON.stringify({ date: new Date().toISOString(), ok, results }, null, 2));
  console.log(ok ? `\n${results.length}/${results.length} passed` : `\n${results.filter((r) => !r.ok).length} failed`);
  process.exit(ok ? 0 : 1);
})();

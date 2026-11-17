// 入画 · real-browser regression (Chromium; SwiftShader in CI). Most steps advance the simulation with
// __ruhua.tick() (no drawing), so the run is quick even without a GPU; a few frames are drawn to catch
// shader errors. Network: the Open-Meteo request is answered from tests/fixtures (and refused, for the
// fallback).
const assert = require('node:assert');
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(path.join(root, p), (err, buf) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(buf); });
});
const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const forecast = fs.readFileSync(path.join(__dirname, 'fixtures/ruhua-archive-20261103.json'), 'utf8');

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const results = [];
  const check = async (name, fn) => { try { await fn(); results.push(['ok', name]); } catch (e) { results.push(['FAIL', name, e.message.split('\n')[0]]); } };
  async function open(viewport, { touch = false, offline = false, query = '' } = {}) {
    const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/429|Failed to load resource/.test(t)) errors.push(t); });
    await page.route('**/api.open-meteo.com/**', (r) => (offline ? r.fulfill({ status: 429, body: '{"error":true}' }) : r.fulfill({ status: 200, contentType: 'application/json', body: forecast })));
    await page.goto(`${base}/ruhua.html?quality=low&scale=0.5${query}`);
    await page.waitForFunction(() => window.__ruhua || document.body.classList.contains('rh-failed'), null, { timeout: 600000 });
    return { ctx, page, errors };
  }

  // ---- desktop: the whole transition, the walk, the weather
  const { page, errors } = await open({ width: 1280, height: 720 });
  await check('loads into 06 · 回望 with the remembered world drawn', async () => {
    const r = await page.evaluate(() => { const R = window.__ruhua; R.still(0.2, 10); return { stage: R.stage, calls: R.info().calls }; });
    assert.strictEqual(r.stage, 'hold'); assert.ok(r.calls > 50, 'draw calls ' + r.calls);
  });
  await check('the forecast is read as 海口此刻 and cached', async () => {
    await page.waitForFunction(() => window.__ruhua.weather.caption().origin === 'live', null, { timeout: 30000 });
    assert.ok(await page.evaluate(() => !!localStorage.getItem('haiz.weather.v1')));
  });
  await check('the easel goes up and the strokes are planned from the painted world', async () => {
    const r = await page.evaluate(async () => { const R = window.__ruhua; await R.paint(); R.tick(1.2); return { stage: R.stage, layers: R.easel.state.layers.map((l) => l.length) }; });
    assert.strictEqual(r.stage, 'paint');
    assert.ok(r.layers[0] > 50 && r.layers[1] > 50 && r.layers[4] > 200, JSON.stringify(r.layers));
  });
  await check('dragging on the canvas lays strokes near the brush, stage by stage', async () => {
    const r = await page.evaluate(() => {
      const R = window.__ruhua, S = R.easel.state, [x0, y0, x1, y1] = S.rect;
      for (let i = 0; i < 120; i++) { const t = i / 120; R.easel.pointer(x0 + (x1 - x0) * (0.5 + 0.42 * Math.sin(t * 13)), y0 + (y1 - y0) * (0.5 + 0.42 * Math.cos(t * 7)), true); R.tick(1 / 30); }
      R.easel.pointer(0.5, 0.5, false);
      return { cur: S.cur, rev: S.revealed.slice(), progress: R.easel.progress };
    });
    assert.ok(r.cur >= 1 && r.progress > 0.15, JSON.stringify(r));
  });
  await check('a drag outside the canvas paints the world (projector map), then the painting leaves', async () => {
    const r = await page.evaluate(() => {
      const R = window.__ruhua; R.paintAll(); R.tick(2.3);
      const st0 = R.stage;
      for (let i = 0; i < 70; i++) { const t = i / 70; R.easel.pointer(0.05 + 0.2 * t, 0.3 + 0.5 * t, true); R.tick(1 / 30); }
      R.easel.pointer(0.5, 0.5, false);
      if (R.stage !== 'depart') R.depart();
      R.tick(0.2);
      R.still(0.03, 30);
      return { st0, spill: R.easel.spillAmount, stage: R.stage, projStart: R.PAINT.uProjStart.value };
    });
    assert.strictEqual(r.st0, 'spill'); assert.ok(r.spill > 5, 'spill strokes ' + r.spill); assert.ok(['depart', 'spread'].includes(r.stage)); assert.ok(r.projStart < 1e5);
  });
  await check('the painting spreads, the eye draws back, the walk begins in the painted world', async () => {
    const r = await page.evaluate(() => { const R = window.__ruhua; R.tick(8); const a = R.stage; R.tick(8); R.still(0.05, 20); return { a, b: R.stage, on: R.PAINT.uPaintOn.value, realVisible: R.real.group.visible, empty: R.easel.canvasMesh.material.uniforms.uEmpty.value }; });
    assert.ok(['spread', 'enter'].includes(r.a), r.a);
    assert.strictEqual(r.b, 'stroll'); assert.strictEqual(r.on, 0); assert.strictEqual(r.realVisible, false); assert.strictEqual(r.empty, 1);
  });
  await check('collision: walking into 一号教学楼 stops at its wall', async () => {
    const z = await page.evaluate(() => {
      const R = window.__ruhua; R.player.place(-40, 4, 0); R.tick(0.5);
      dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })); R.tick(4); dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
      return R.player.state.pos.z;
    });
    assert.ok(z < 11, 'walker z ' + z.toFixed(2) + ' (the wall is at z ≈ 11)');
    assert.ok(z > 6, 'walker did move ' + z.toFixed(2));
  });
  await check('free weather: rain wets the paving, opens the umbrella; back to 海口此刻', async () => {
    const r = await page.evaluate(() => {
      const R = window.__ruhua; R.weather.setFree('storm', 15); R.tick(20, 10);
      const wet = R.U.uWet.value, rain = R.U.uRain.value, umb = R.student.G?.umbWant;
      R.weather.setLive(); R.tick(1);
      return { wet, rain, umb, origin: R.weather.caption().origin };
    });
    assert.ok(r.wet > 0.8 && r.rain > 0.2, JSON.stringify(r)); assert.strictEqual(r.umb, true); assert.strictEqual(r.origin, 'live');
  });
  await check('the cat keeps to its lane by 第一食堂 and the butterflies are about', async () => {
    const r = await page.evaluate(() => { const R = window.__ruhua; R.weather.setFree('clear', 10.5); R.tick(3); return { cat: R.cat.describe(), range: R.cat.RANGE, b: R.butterflies.stats() }; });
    const [x, z] = r.cat.at;
    assert.ok(x > r.range.x0 - 8 && x < r.range.x1 + 8 && z > r.range.z0 - 8 && z < r.range.z1 + 8, JSON.stringify(r.cat));
    assert.ok(r.b.total > 20, JSON.stringify(r.b));
  });
  await check('replay returns to 06 with the remembered world', async () => {
    const r = await page.evaluate(() => { const R = window.__ruhua; R.replay(); R.tick(0.2); R.still(0.05, 20); return { stage: R.stage, real: R.real.group.visible }; });
    assert.strictEqual(r.stage, 'hold'); assert.strictEqual(r.real, true);
  });
  await check('no page errors (desktop)', async () => assert.deepStrictEqual(errors, []));

  // ---- phone, portrait, touch, offline: the fallback is labelled, the canvas is portrait, skip works
  const m = await open({ width: 390, height: 844 }, { touch: true, offline: true });
  await check('phone: offline weather falls back to the month\'s normals, labelled', async () => {
    const r = await m.page.evaluate(() => { const R = window.__ruhua; R.tick(0.5); return R.weather.caption(); });
    assert.strictEqual(r.origin, 'offline'); assert.strictEqual(r.fallback, true);
  });
  await check('phone: a portrait canvas and a portrait 06', async () => {
    const r = await m.page.evaluate(async () => { const R = window.__ruhua; const fov = R.camera.fov; await R.paint(); return { fov, rect: R.easel.state.rect }; });
    assert.strictEqual(r.fov, 70); assert.ok(r.rect[3] - r.rect[1] > 0.4 && r.rect[2] - r.rect[0] > 0.8, JSON.stringify(r.rect));
  });
  await check('phone: skip goes straight into the walk', async () => {
    const r = await m.page.evaluate(() => { const R = window.__ruhua; R.skip(); R.tick(0.5); R.still(0.05, 20); return { stage: R.stage, tools: getComputedStyle(document.querySelector('.rh-tools')).display }; });
    assert.strictEqual(r.stage, 'stroll'); assert.strictEqual(r.tools, 'flex');
  });
  await check('no page errors (phone)', async () => assert.deepStrictEqual(m.errors, []));

  await browser.close(); server.close();
  let failed = 0;
  for (const r of results) { console.log(r[0] === 'ok' ? '  ✓' : '  ✗', r[1], r[2] || ''); if (r[0] !== 'ok') failed++; }
  console.log(`ruhua browser: ${results.length - failed}/${results.length}`);
  process.exit(failed ? 1 : 0);
})();

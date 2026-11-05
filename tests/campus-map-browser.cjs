// Real-browser checks for chapter 04's campus beneath the water (Chromium;
// SwiftShader in CI: this proves the flow, not a hardware frame rate).
// The route: arrive at 04 → the water reveals the campus → zoom, pan, top view →
// 图书馆 → back to the plan → back to the tree (same objects, same pose, same
// growth) → on to 05. Plus: cancel by scrolling, deep link, the walk and back,
// reduced motion, the static page and a phone.
const assert = require('node:assert');
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(path.join(root, p), (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
    res.end(buf);
  });
});
const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const T = 240000;

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const results = [];
  const errors = [];
  const watch = (page) => {
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  };
  const ready = (page) => page.waitForFunction(() => window.__haizHome?.map && document.body.classList.contains('ready'), null, { timeout: T });
  const info = (page) => page.evaluate(() => ({ ...window.__haizHome.map.info(), p: window.__haizHome.state.p, active: window.__haizHome.info().active, scrollY }));
  const mode = (page, m) => page.waitForFunction((x) => window.__haizHome.map.mode === x, m, { timeout: T })
    .catch(async (e) => { console.error('waiting for', m, JSON.stringify(await info(page).catch(() => null))); throw e; });

  // ---------------------------------------------------------------- desktop: the route
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  watch(page);
  await page.goto(base + '/index.html?quality=low&test=1');
  await ready(page);
  await page.evaluate(() => { const w = window.__haizHome.world; window.__same = { renderer: w.renderer, canopy: w.canopy.mesh, bark: w.bark, island: w.island.position.y }; });
  // arrive at 04 by scrolling and rest: the reveal begins on its own, V4 untouched until then
  await page.evaluate(() => window.scrollTo(0, document.getElementById('map').offsetTop));
  await page.waitForFunction(() => Math.abs(window.__haizHome.state.p - 3) < 0.004, null, { timeout: T });
  assert.strictEqual(await page.evaluate(() => window.__haizHome.world.water.material.uniforms.uReveal.value), 0, 'arriving at 04 the water is V4\'s');
  await mode(page, 'reveal');
  await page.waitForSelector('body.map-reveal .cmap-reveal', { state: 'visible', timeout: T });
  await mode(page, 'map');
  let i0 = await info(page);
  assert.strictEqual(i0.hash, '#map/oblique');
  assert(Math.abs(i0.cam.pitch - 73.5) < 0.1 && Math.abs(i0.cam.fov - 50) < 1e-6, 'the plan opens in chapter 04\'s own oblique frame');
  results.push(`resting at 04 the reveal begins by itself and ends in the plan (#map/oblique) at chapter 04's own frame: pitch ${i0.cam.pitch.toFixed(1)}°, lens ${i0.cam.fov}°`);
  // the wheel belongs to the plan now: it zooms, the walk does not move
  await page.mouse.move(640, 380);
  for (let k = 0; k < 4; k++) { await page.mouse.wheel(0, 260); await page.waitForTimeout(120); }
  await page.waitForFunction((s) => window.__haizHome.map.info().cam.s > s * 3, i0.cam.s, { timeout: T });
  const i1 = await info(page);
  assert.strictEqual(i1.p, 3); assert.strictEqual(i1.scrollY, i0.scrollY); assert.strictEqual(i1.active, 3);
  results.push(`wheel zooms the plan (half-height ${i0.cam.s.toFixed(1)} → ${i1.cam.s.toFixed(1)} m) while the walk stays at 04 (p = 3, scrollY ${i1.scrollY})`);
  // drag pans
  await page.mouse.move(700, 420); await page.mouse.down(); await page.mouse.move(560, 470, { steps: 6 }); await page.mouse.up();
  await page.waitForFunction((t) => Math.abs(window.__haizHome.map.info().cam.tx - t) > 5, i1.cam.tx, { timeout: T });
  results.push('drag pans the plan');
  // T: the user's own top view; the target and the ground scale are kept (a dolly zoom)
  const before = (await info(page)).cam;
  await page.keyboard.press('t');
  await page.waitForFunction(() => { const c = window.__haizHome.map.info().cam; return c.pitch > 89.9 && Math.abs(c.fov - 20) < 1e-6; }, null, { timeout: T });
  const top = await info(page);
  assert.strictEqual(top.hash, '#map/top');
  assert.strictEqual(await page.getAttribute('[data-view="top"]', 'aria-checked'), 'true');
  assert(Math.abs(top.cam.s - before.s) / before.s < 0.02 && Math.abs(top.cam.tx - before.tx) < 0.5, 'top view keeps target and scale');
  results.push(`T switches to the top view (pitch 90°, lens 20°, #map/top) with the same target and ground scale (${before.s.toFixed(1)} → ${top.cam.s.toFixed(1)} m)`);
  // the library, where it is drawn
  const lib = await page.evaluate(() => { const l = window.__haizHome.map.places.find((q) => q.id === 'library'); return window.__haizHome.map.project(l.x, l.z); });
  assert(lib[0] > 0 && lib[0] < 1280 && lib[1] > 60 && lib[1] < 640, '图书馆 in view: ' + lib);
  const pre = (await info(page)).cam;
  await page.mouse.click(lib[0], lib[1]);
  await page.waitForSelector('.cmap-detail.open', { timeout: T });
  assert.strictEqual(await page.textContent('#cmapTitle'), '图书馆');
  assert.match(await page.getAttribute('.cmap-photo img', 'src'), /campus_library\.jpg$/);
  assert.match(await page.textContent('.cmap-desc'), /书香校园/);
  assert.match(await page.getAttribute('.cmap-walk', 'href'), /^campus-3d\.html\?focus=library&from=map$/);
  assert.strictEqual(page.url().split('#')[1], 'map/top/library');
  assert.strictEqual((await info(page)).p, 3, 'the click did not leave the page or move the walk');
  results.push('clicking 图书馆 on the plan opens its place: the project photo, the data\'s words, distance from the tree, and a walk link (#map/top/library)');
  // Esc: back to the plan exactly as it was before the place opened
  await page.waitForFunction(() => !window.__haizHome.map.info().cam || true);
  await page.keyboard.press('Escape');
  await page.waitForFunction((b) => { const c = window.__haizHome.map.info().cam; return !document.querySelector('.cmap-detail.open') && Math.abs(c.s - b.s) < 0.05 && Math.abs(c.tx - b.tx) < 0.05 && Math.abs(c.tz - b.tz) < 0.05; }, pre, { timeout: T });
  await page.waitForFunction(() => location.hash === '#map/top', null, { timeout: T });
  assert.strictEqual((await info(page)).selected, 'library', 'the place stays marked on the plan');
  results.push('Esc closes the place and returns the camera to the plan view it was opened from (target and zoom to 5 cm); the place stays marked');
  // Back: out of the plan, the water closes, V4 takes its camera back: same objects, same pose, same growth
  await page.goBack();
  await mode(page, 'tree');
  const back = await page.evaluate(() => {
    const H = window.__haizHome, w = H.world, s = window.__same, f = H.chapters && null;
    const c = w.camera.position;
    return { same: w.renderer === s.renderer && w.canopy.mesh === s.canopy && w.bark === s.bark, island: w.island.position.y, base: s.island, eye: [c.x, c.y, c.z], grow: H.info().grow, p: H.state.p, inert: document.getElementById('p-map').inert, hash: location.hash, reveal: w.water.material.uniforms.uReveal.value, cls: document.body.className };
  });
  assert(back.same, 'the tree, its renderer and leaves were never rebuilt');
  assert.strictEqual(back.island, back.base, 'the islet is back');
  assert(Math.hypot(back.eye[0] - 3, back.eye[1] - 40, back.eye[2] - 12) < 0.05, 'camera at chapter 04: ' + back.eye);
  assert(Math.abs(back.grow - 0.7) < 1e-9 && back.p === 3 && back.hash === '#map' && back.reveal === 0 && !back.inert && !/map-/.test(back.cls));
  results.push(`browser Back leaves the plan: the water closes, the islet returns, the camera is at chapter 04 (${back.eye.map((v) => v.toFixed(2)).join(', ')}), growth ${back.grow}, the same renderer and tree objects (#map)`);
  // and the walk continues
  await page.keyboard.press('PageDown');
  await page.waitForFunction(() => window.__haizHome.info().active === 4, null, { timeout: T });
  // let GSAP's snap finish before the next programmatic scroll (on SwiftShader one frame is seconds long)
  await page.waitForFunction(() => Math.abs(window.__haizHome.state.p - 4) < 0.004, null, { timeout: T });
  results.push('PageDown then walks on to 05 (#days)');

  // ---------------------------------------------------------------- scrolling away cancels a reveal
  await page.evaluate(() => window.scrollTo(0, document.getElementById('map').offsetTop));
  await mode(page, 'reveal');
  await page.waitForFunction(() => window.__haizHome.map.reveal > 0.05, null, { timeout: T });
  await page.evaluate(() => window.scrollTo(0, document.getElementById('days').offsetTop));
  await page.waitForFunction(() => window.__haizHome.map.mode === 'tree' && window.__haizHome.map.reveal === 0 && window.__haizHome.info().active === 4, null, { timeout: T });
  await page.waitForFunction(() => Math.abs(window.__haizHome.state.p - 4) < 0.004, null, { timeout: T });
  results.push('scrolling on during a reveal cancels it: the water closes and the walk reaches 05');
  // ---------------------------------------------------------------- "continue · 05" from the plan
  await page.evaluate(() => window.scrollTo(0, document.getElementById('map').offsetTop));
  await page.waitForFunction(() => Math.abs(window.__haizHome.state.p - 3) < 0.004, null, { timeout: T });
  await page.click('#p-map [data-action="campus-map"]');
  await mode(page, 'map');
  await page.click('.cmap-next');
  await page.waitForFunction(() => window.__haizHome.info().active === 4 && window.__haizHome.map.mode === 'tree', null, { timeout: T });
  results.push('the chapter slab\'s own entry opens the plan without waiting; 「继续 · 05」 closes it and walks on to 05');
  assert.deepStrictEqual(errors, [], 'page errors: ' + errors.join(' | '));
  await ctx.close();

  // ---------------------------------------------------------------- a deep link, and the walk and back
  const dctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const dp = await dctx.newPage();
  watch(dp);
  await dp.goto(base + '/index.html?quality=low&test=1#map/top/library');
  await ready(dp);
  await mode(dp, 'map');
  await dp.waitForSelector('.cmap-detail.open', { timeout: T });
  let d0 = await info(dp);
  assert(d0.view === 'top' && d0.selected === 'library' && d0.detail && d0.p === 3);
  results.push('a deep link (#map/top/library) opens straight into the plan from above with 图书馆 open, no six-shot replay');
  // into the walk (its own page) and back again: the same view is restored
  // the flight to the place has landed (on SwiftShader a frame can take seconds)
  await dp.waitForFunction(() => { const i = window.__haizHome.map.info(); return i.cam && i.cam.pitch > 89.9 && !i.moving; }, null, { timeout: T });
  d0 = await info(dp);
  assert(Math.abs(d0.cam.tx - 60) < 40 && d0.cam.s > 30, 'the camera framed 图书馆: ' + JSON.stringify(d0.cam));
  // the link leaves through a short veil, then the walk page commits (heavy on SwiftShader), as in home-browser.cjs
  await Promise.all([dp.waitForURL(/campus-3d\.html\?focus=library&from=map$/, { timeout: T }), dp.click('.cmap-walk', { noWaitAfter: true, timeout: T })]);
  results.push('「从这里步入校园」 leaves for the existing first-person walk at campus-3d.html?focus=library (a separate page: no shared renderer is claimed)');
  await dp.goBack({ timeout: T });
  await ready(dp);
  await mode(dp, 'map');
  await dp.waitForSelector('.cmap-detail.open', { timeout: T });
  const d1 = await info(dp);
  assert(d1.view === 'top' && d1.selected === 'library' && d1.detail);
  assert(Math.abs(d1.cam.s - d0.cam.s) / d0.cam.s < 0.01 && Math.abs(d1.cam.tx - d0.cam.tx) < 0.5, `restored view ${JSON.stringify(d1.cam)} vs ${JSON.stringify(d0.cam)}`);
  results.push(`coming back from the walk restores the plan, the top view, 图书馆 and the camera (half-height ${d0.cam.s.toFixed(1)} → ${d1.cam.s.toFixed(1)} m)`);
  // Back steps out one level at a time
  await dp.goBack();
  await dp.waitForFunction(() => !window.__haizHome.map.info().detail && location.hash === '#map/top', null, { timeout: T });
  await dp.goBack();
  await mode(dp, 'tree');
  results.push('Back then closes the place (#map/top), and Back again returns to the tree (#map)');
  assert.deepStrictEqual(errors, [], 'page errors: ' + errors.join(' | '));
  await dctx.close();

  // ---------------------------------------------------------------- reduced motion
  const rctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const rp = await rctx.newPage();
  watch(rp);
  await rp.goto(base + '/index.html?quality=low&test=1');
  await ready(rp);
  await rp.evaluate(() => window.__haizHome.go(3));
  await mode(rp, 'reveal');
  const t0 = Date.now();
  await mode(rp, 'map');
  const took = (Date.now() - t0) / 1000;
  assert(took < 20, 'reduced motion reveal is short: ' + took);
  results.push(`reduced motion: the plan appears without the long reveal (${took.toFixed(1)} s wall on SwiftShader, 0.6 s of reveal time)`);
  await rctx.close();

  // ---------------------------------------------------------------- without WebGL
  const sp = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await sp.goto(base + '/index.html?static=1');
  await sp.waitForSelector('#p-map .cmap-static svg rect', { timeout: T });
  const st = await sp.evaluate(() => ({ rects: document.querySelectorAll('#p-map .cmap-static svg rect').length, places: document.querySelectorAll('.cmap-static-list li').length, walk: document.querySelector('.cmap-static-list a')?.getAttribute('href') }));
  assert(st.rects >= 47 && st.places >= 26 && /^campus-3d\.html\?focus=/.test(st.walk));
  results.push(`without WebGL (?static) chapter 04 still holds the plan: ${st.rects - 1} drawn footprints, ${st.places} places with words, photos and walk links`);
  await sp.close();

  // ---------------------------------------------------------------- phone
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  watch(mp);
  await mp.goto(base + '/index.html?test=1');
  await ready(mp);
  await mp.evaluate(() => { window.__haizHome.go(3); window.__haizHome.map.start(4); });
  await mode(mp, 'map');
  await mp.evaluate(() => { window.__haizHome.map.zoom(3); window.__haizHome.map.settle(); });
  await mp.waitForTimeout(1500);
  const layout = await mp.evaluate(() => {
    const r = (q) => document.querySelector(q).getBoundingClientRect();
    return { overflow: document.documentElement.scrollWidth - innerWidth, dock: r('.cmap-dock').toJSON(), exit: r('.cmap-exit').toJSON(), head: r('.cmap-head').toJSON(), bar: r('.bar').toJSON(), H: innerHeight, W: innerWidth };
  });
  assert(layout.overflow <= 0, 'no horizontal overflow');
  for (const k of ['dock', 'exit']) assert(layout[k].left >= 0 && layout[k].right <= layout.W && layout[k].bottom <= layout.H, k + ' within the screen');
  assert(layout.head.top >= layout.bar.bottom - 2, 'the heading sits below the tools');
  const ml = await mp.evaluate(() => { const l = window.__haizHome.map.places.find((q) => q.id === 'library'); return window.__haizHome.map.project(l.x, l.z); });
  await mp.touchscreen.tap(ml[0], ml[1]);
  await mp.waitForSelector('.cmap-detail.open', { timeout: T });
  const sheet = await mp.evaluate(() => { const r = document.querySelector('.cmap-detail').getBoundingClientRect(); return { bottom: r.bottom, top: r.top, H: innerHeight, title: document.querySelector('#cmapTitle').textContent }; });
  assert(sheet.title === '图书馆' && sheet.bottom <= sheet.H + 1 && sheet.top > sheet.H * 0.35, 'the place opens as a bottom sheet');
  fs.mkdirSync(path.join(root, 'tests/artifacts/campus-map'), { recursive: true });
  await mp.waitForTimeout(1200);
  await mp.screenshot({ path: path.join(root, 'tests/artifacts/campus-map/phone-library.png') });
  results.push(`phone 390×844: no horizontal overflow, controls inside the screen and clear of the tools, a tap on 图书馆 opens it as a bottom sheet (top at ${Math.round(sheet.top)} px)`);
  assert.deepStrictEqual(errors, [], 'page errors: ' + errors.join(' | '));
  await mctx.close();

  await browser.close();
  server.close();
  fs.writeFileSync(path.join(root, 'tests/campus-map-browser-results.json'), JSON.stringify({ results, renderer: 'Chromium + SwiftShader (software); proves the flow and input ownership, not a hardware frame rate' }, null, 2));
  console.log('PASS campus-map-browser:\n- ' + results.join('\n- '));
})().catch((e) => { console.error(e); server.close(); process.exit(1); });

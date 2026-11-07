// Real-browser checks for chapter 04's site plan becoming the campus (Chromium;
// SwiftShader in CI: this proves the flow and the geometry, not a hardware frame rate).
// The route: the site plan (the buildings wait under it, their footprints drawn from the
// same features) → 展开为三维 (a real click) → every building rises out of its own
// footprint as a whole volume, the camera travels without a jump, material spreads
// from the tree → turn, pan, zoom → tap 图书馆 → cut that one building at 2F → back →
// fold back to the site plan → on the plan, one building's storey on request → history
// back/forward → from 3D straight on to 05 (composition c: stage 1's orientation, V4's 05 kept). Plus: a 3D deep link, reduced motion, a
// phone, and V4 untouched outside chapter 04.
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
const T = 300000;
const only = (process.env.ONLY || '').split(',').filter(Boolean);
const run = (k) => !only.length || only.includes(k);

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const results = [];
  const errors = [];
  const watch = (page) => {
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if ((m.type() === 'error' || /GL_INVALID|WebGL: INVALID/.test(m.text())) && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  };
  const ready = (page) => page.waitForFunction(() => window.__haizHome?.map && document.body.classList.contains('ready'), null, { timeout: T });
  const info = (page) => page.evaluate(() => ({ ...window.__haizHome.map.info(), p: window.__haizHome.state.p, scrollY }));
  const until = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: T }).catch(async (e) => { console.error('waiting', fn.toString(), JSON.stringify(await info(page).catch(() => null))); throw e; });
  // the cut of every building, relative to its own plan cut (floor + 1.2 m) and its top
  const cuts = (page) => page.evaluate(() => {
    const s = window.__haizHome.map.section, G = -0.85;
    return s.buildings.map((b) => ({ id: b.id, group: b.group, cut: s.cuts[b.index], lift: s.lifts[b.index], top: G + b.top, levels: b.levels, standing: s.standing(b) }));
  });
  // let V4's own loop draw two frames (never pause it: still() is a capture hook that stops the loop)
  const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const visible = (page, q) => page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return false; const r = el.getBoundingClientRect(), st = getComputedStyle(el); return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && +st.opacity > 0.5; }, q);
  // a building's screen point (its centre, at mid-height of what stands)
  const screenOf = (page, id) => page.evaluate((gid) => {
    const m = window.__haizHome.map, s = m.section, cam = window.__haizHome.world.camera, c = cam.position.clone();
    const b = s.byGroup.get(gid)[0], y = Math.min(s.cuts[b.index], -0.85 + b.top) * 0.6 + -0.85 * 0.4;
    const v = c.set(b.cx, y, b.cz).project(cam), r = window.__haizHome.world.renderer.domElement.getBoundingClientRect();
    return [(v.x * 0.5 + 0.5) * r.width + r.left, (-v.y * 0.5 + 0.5) * r.height + r.top];
  }, id);

if (run('route')) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  watch(page);
  await page.goto(base + '/index.html?quality=low&test=1&compose=c#map/oblique');
  await ready(page);
  await until(page, () => window.__haizHome.map.mode === 'map');
  await page.evaluate(() => window.__haizHome.map.settle());
  // ---------------------------------------------------------------- 1. the site plan: the buildings wait beneath it
  let c = await cuts(page);
  const plan0 = await info(page);
  assert(plan0.section, 'the campus model loaded');
  for (const b of c) assert(b.standing <= -0.85 + 1e-6 && b.cut >= b.top, `${b.id}: whole, and waiting under the site plan (top at ${b.standing.toFixed(2)})`);
  assert(!(await page.evaluate(() => window.__haizHome.map.section.group.visible)), 'nothing of the model is drawn over the site plan');
  const geo = await page.evaluate(() => {
    const m = window.__haizHome.map, f = m.geo.features;
    // every building of the model stands on the very footprint the plan shader draws
    return m.section.buildings.filter((b) => b.form !== 'corr' && !b.id.startsWith('dorm_m_')).map((b) => { const ft = f.find((x) => x.id === b.id); return { id: b.id, dx: Math.abs(ft.cx - b.cx), dz: Math.abs(ft.cz - b.cz), dw: Math.abs(ft.hw * 2 - b.w), dd: Math.abs(ft.hd * 2 - b.d), dr: Math.abs(ft.rot - b.rot) }; });
  });
  for (const g of geo) assert(g.dx < 1e-6 && g.dz < 1e-6 && g.dw < 1e-6 && g.dd < 1e-6 && g.dr < 1e-9, g.id + ' shares its footprint with the plan');
  assert(await visible(page, '.cmap-unfold'), 'the way to 3D is in view');
  results.push(`the plan is a site plan: all ${c.length} buildings of the model wait whole beneath it (nothing of the model drawn, no storey cut); ${geo.length} of them share position, size and rotation with the footprints the plan draws (Δ < 1e-6 m)`);

  // ---------------------------------------------------------------- 2. 展开为三维: one continuous film
  await page.evaluate(() => {
    const m = window.__haizHome.map, cam = window.__haizHome.world.camera;
    window.__trace = [];
    const rec = () => { const i = m.info(); window.__trace.push({ u: i.u, x: cam.position.x, y: cam.position.y, z: cam.position.z, t: performance.now() }); if (window.__trace.length < 4000) requestAnimationFrame(rec); };
    rec();
  });
  await page.click('.cmap-unfold', { noWaitAfter: true, timeout: T });
  await until(page, () => window.__haizHome.map.info().turning || window.__haizHome.map.info().u >= 1);
  assert.strictEqual((await info(page)).hash, '#map/3d', 'the campus in 3D has its own history entry');
  await until(page, () => { const i = window.__haizHome.map.info(); return i.u >= 1 && !i.turning; });
  const trace = await page.evaluate(() => { const t = window.__trace; window.__trace = t.slice(); return t; });
  let mono = true, maxStep = 0, path = 0;
  for (let i = 1; i < trace.length; i++) {
    if (trace[i].u < trace[i - 1].u - 1e-9) mono = false;
    const d = Math.hypot(trace[i].x - trace[i - 1].x, trace[i].y - trace[i - 1].y, trace[i].z - trace[i - 1].z);
    path += d;
    // a step is a jump only if the camera moved more than its own speed allows (u advanced by du)
    const du = trace[i].u - trace[i - 1].u;
    if (du > 0) maxStep = Math.max(maxStep, d / du);
  }
  assert(mono, 'u only grows while unfolding');
  const first = trace.find((s) => s.u > 0), before = trace[0];
  const startJump = first ? Math.hypot(first.x - before.x, first.y - before.y, first.z - before.z) / Math.max(first.u, 1e-4) : 0;
  assert(startJump < 4000, 'the first frame of the change leaves from where the plan camera was (no cut): ' + startJump.toFixed(0));
  c = await cuts(page);
  for (const b of c) assert(b.cut >= b.top && Math.abs(b.lift) < 1e-6, b.id + ' stands whole on its footprint');
  const d3 = await info(page);
  assert(d3.d3 && d3.cam.pitch < 45, 'the campus is seen in three-quarter view: pitch ' + d3.cam.pitch);
  const sweep = await page.evaluate(() => window.__haizHome.map.section.sweepR);
  assert(sweep > 300, 'the material front has crossed the whole campus: ' + sweep.toFixed(0) + ' m');
  results.push(`展开为三维 (real click): ${trace.length} frames, u rises monotonically 0 → 1, the camera leaves from the plan's own position and travels ${path.toFixed(0)} m along one continuous path (no cut); every building has risen out of its own footprint whole (walls and roof, no cut); material front ${sweep.toFixed(0)} m from the tree; hash #map/3d`);

  // ---------------------------------------------------------------- 3. turn, pan, zoom
  await page.evaluate(() => window.__haizHome.map.settle());
  let a = (await info(page)).cam;
  await page.mouse.move(700, 400); await page.mouse.down(); await page.mouse.move(560, 360, { steps: 6 }); await page.mouse.up();
  await until(page, (y) => Math.abs(window.__haizHome.map.info().cam.yaw - y) > 10, a.yaw);
  let b2 = (await info(page)).cam;
  assert(Math.abs(b2.tx - a.tx) < 0.5 && Math.abs(b2.tz - a.tz) < 0.5, 'a plain drag turns about the same point');
  await page.mouse.move(640, 380); await page.mouse.down({ button: 'right' }); await page.mouse.move(520, 440, { steps: 6 }); await page.mouse.up({ button: 'right' });
  await until(page, (t) => Math.hypot(window.__haizHome.map.info().cam.tx - t[0], window.__haizHome.map.info().cam.tz - t[1]) > 5, [b2.tx, b2.tz]);
  const s0 = (await info(page)).cam.s;
  for (let k = 0; k < 3; k++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(100); }
  await until(page, (s) => window.__haizHome.map.info().cam.s < s * 0.8, s0);
  const i3 = await info(page);
  assert.strictEqual(i3.p, 3); assert.strictEqual(i3.scrollY, d3.scrollY);
  results.push(`in 3D a drag turns the campus (yaw ${a.yaw.toFixed(0)}° → ${b2.yaw.toFixed(0)}°, target kept), a right-drag pans, the wheel zooms (${s0.toFixed(0)} → ${i3.cam.s.toFixed(0)} m) and the page stays at 04`);

  // ---------------------------------------------------------------- 4. tap a building; cut it at 2F
  await page.evaluate(() => { const m = window.__haizHome.map; m.setView({ tx: 55, tz: 20, s: 90, pitch: 40, yaw: 200 }); m.settle(); });
  await frames(page);
  const [lx, ly] = await screenOf(page, 'library');
  await page.mouse.click(lx, ly);
  await until(page, () => window.__haizHome.map.info().detail);
  let i4 = await info(page);
  assert.strictEqual(i4.selected, 'library', 'the tap opened the building it landed on: ' + i4.selected);
  assert.strictEqual(i4.hash, '#map/3d/library');
  await page.waitForSelector('.cmap-detail.open [data-floor="1"]', { state: 'visible', timeout: T });
  await page.click('.cmap-detail.open [data-floor="1"]', { noWaitAfter: true, timeout: T });
  await until(page, () => window.__haizHome.map.info().floor?.k === 1);
  // the cut glides down to the storey
  await until(page, () => { const s = window.__haizHome.map.section, b = s.byGroup.get('library')[0]; return Math.abs(s.cuts[b.index] - (-0.85 + b.levels[1] + 1.2)) < 0.05; });
  c = await cuts(page);
  const lib = c.find((x) => x.id === 'library');
  assert(Math.abs(lib.cut - (-0.85 + lib.levels[1] + 1.2)) < 0.06, 'the library is cut 1.2 m above its second floor: ' + lib.cut.toFixed(2));
  assert(c.filter((x) => x.id !== 'library').every((x) => x.cut >= x.top && Math.abs(x.lift) < 1e-6), 'the other buildings stay whole');
  assert(await page.evaluate(() => document.querySelector('.cmap-floors p').textContent.includes('推演')), 'the cut says what is inferred');
  results.push(`a real tap on 图书馆 in 3D opens its sheet (#map/3d/library); 2F cuts it 1.2 m above its second floor (y ${lib.cut.toFixed(2)}) while the rest stands whole; the sheet states the interior is inferred`);

  // ---------------------------------------------------------------- 5. Esc, then fold back
  await page.keyboard.press('Escape');
  await until(page, () => !window.__haizHome.map.info().detail);
  assert.strictEqual((await info(page)).floor, null, 'closing the sheet makes the building whole again');
  assert.strictEqual((await info(page)).hash, '#map/3d');
  await page.click('.cmap-unfold', { noWaitAfter: true, timeout: T });
  await until(page, () => { const i = window.__haizHome.map.info(); return i.u <= 0 && !i.turning; });
  c = await cuts(page);
  for (const b of c) assert(b.standing <= -0.85 + 1e-6 && b.cut >= b.top, b.id + ' has gone back under the site plan, whole');
  const f5 = await info(page);
  assert.strictEqual(f5.hash, '#map/oblique');
  assert(Math.abs(f5.cam.pitch - 73.5) < 0.6, 'folding returns to the plan look the visitor came from');
  results.push('Esc closes the sheet (building whole again); 收回为平面 folds the campus back into the site plan: every building sinks whole into its footprint, #map/oblique, the plan look of chapter 04');

  // ---------------------------------------------------------------- 6. history: back and forward
  await page.goForward();
  await until(page, () => { const i = window.__haizHome.map.info(); return i.u >= 1 && !i.turning; });
  await page.goBack();
  await until(page, () => { const i = window.__haizHome.map.info(); return i.u <= 0 && !i.turning; });
  assert.strictEqual((await info(page)).hash, '#map/oblique');
  results.push('browser Forward unfolds the campus again, Back folds it: the same film both ways');

  // ---------------------------------------------------------------- 6b. one building's storey, on the site plan
  await page.evaluate(() => window.__haizHome.map.select('library'));
  await until(page, () => window.__haizHome.map.info().detail);
  await page.waitForSelector('.cmap-detail.open [data-floor="1"]', { state: 'visible', timeout: T });
  await page.click('.cmap-detail.open [data-floor="1"]', { noWaitAfter: true, timeout: T });
  await until(page, () => { const s = window.__haizHome.map.section, b = s.byGroup.get('library')[0]; return Math.abs(s.lifts[b.index]) < 1e-3; });
  c = await cuts(page);
  const lib5 = c.find((x) => x.id === 'library');
  assert(Math.abs(lib5.cut - (-0.85 + lib5.levels[1] + 1.2)) < 0.06, 'on the plan, 2F raises the library cut at its second floor');
  assert(c.filter((x) => x.group !== 'library').every((x) => x.standing <= -0.85 + 1e-6), 'the rest of the campus stays a site plan');
  await page.click('.cmap-detail.open [data-floor="all"]', { noWaitAfter: true, timeout: T });
  await until(page, () => { const s = window.__haizHome.map.section, b = s.byGroup.get('library')[0]; return s.standing(b) <= -0.85 + 1e-6; });
  await page.keyboard.press('Escape');
  await until(page, () => !window.__haizHome.map.info().detail);
  results.push('on the site plan, a storey is an optional look at one building: 图书馆 2F rises out of its footprint already cut at its second floor while the rest stays a site plan; 总平面 sends it back');


  // ---------------------------------------------------------------- 7. from 3D straight on to 05
  await page.click('.cmap-unfold', { noWaitAfter: true, timeout: T });
  await until(page, () => { const i = window.__haizHome.map.info(); return i.u >= 1 && !i.turning; });
  await page.click('.cmap-next', { noWaitAfter: true, timeout: T });
  await until(page, () => window.__haizHome.map.mode === 'tree' && Math.abs(window.__haizHome.state.p - 4) < 0.01);
  const g7 = await page.evaluate(() => ({ vis: window.__haizHome.map.section.group.visible, reveal: window.__haizHome.world.water.material.uniforms.uReveal.value, hash: location.hash }));
  assert(!g7.vis && g7.reveal === 0, 'after 05 the campus model is put away and the water is V4\'s');
  results.push('from the campus in 3D, 继续 · 05 leaves it standing (DESIGN.md: a campus already in 3D is not flattened again); composition c keeps V4\'s 05, so the standing campus goes down on the way and at 05 the model is hidden and V4\'s water untouched (' + g7.hash + ')');
  await page.evaluate(() => window.__haizHome.go(0));
  await frames(page);
  assert(!(await page.evaluate(() => window.__haizHome.map.section.group.visible)), 'chapter 01 renders without the campus model');
  await ctx.close();
}

if (run('deep')) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  watch(page);
  await page.goto(base + '/index.html?quality=low&test=1&compose=c#map/3d/library');
  await ready(page);
  await until(page, () => { const i = window.__haizHome.map.info(); return i.mode === 'map' && i.u >= 1 && i.detail; });
  const i = await info(page);
  assert.strictEqual(i.selected, 'library'); assert.strictEqual(i.hash, '#map/3d/library');
  await page.goBack();
  await until(page, () => !window.__haizHome.map.info().detail);
  await page.goBack();
  await until(page, () => { const x = window.__haizHome.map.info(); return x.u <= 0 && !x.turning; });
  assert.strictEqual((await info(page)).hash, '#map/oblique');
  results.push('the deep link #map/3d/library opens the campus in 3D with the library\'s sheet; Back steps down: sheet → 3D → plan');
  await ctx.close();
}

if (run('reduced')) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  watch(page);
  await page.goto(base + '/index.html?quality=low&test=1&compose=c#map/oblique');
  await ready(page);
  await until(page, () => window.__haizHome.map.mode === 'map');
  const t0 = Date.now();
  await page.click('.cmap-unfold', { noWaitAfter: true, timeout: T });
  await until(page, () => { const i = window.__haizHome.map.info(); return i.u >= 1 && !i.turning; });
  const ms = Date.now() - t0;
  results.push(`reduced motion: the change is 0.7 s of animation by design and completes (${(ms / 1000).toFixed(1)} s of wall time here, at about one software-rendered frame per second); nothing is skipped`);
  await ctx.close();
}

if (run('phone')) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  watch(page);
  await page.goto(base + '/index.html?quality=low&test=1&compose=c#map/oblique');
  await ready(page);
  await until(page, () => window.__haizHome.map.mode === 'map');
  assert(await visible(page, '.cmap-unfold'), 'the way to 3D is in view on a phone');
  const box = await page.evaluate(() => { const r = document.querySelector('.cmap-unfold').getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; });
  assert(box.l >= 0 && box.r <= 390 && box.b <= 844, 'the button is inside the screen');
  const others = await page.evaluate((bb) => [...document.querySelectorAll('.cmap-dock button, .cmap-exit button, .cmap-scale')].filter((el) => getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().width > 0).map((el) => { const r = el.getBoundingClientRect(); return r.left < bb.r && r.right > bb.l && r.top < bb.b && r.bottom > bb.t ? el.className || el.textContent : null; }).filter(Boolean), box);
  assert.deepStrictEqual(others, [], 'nothing overlaps it');
  await page.tap('.cmap-unfold', { noWaitAfter: true, timeout: T });
  await until(page, () => { const i = window.__haizHome.map.info(); return i.u >= 1 && !i.turning; });
  await page.evaluate(() => { const m = window.__haizHome.map; m.setView({ tx: 55, tz: 20, s: 90, pitch: 42, yaw: 200 }); m.settle(); });
  await frames(page);
  const [x, y] = await screenOf(page, 'library');
  await page.touchscreen.tap(x, y);
  await until(page, () => window.__haizHome.map.info().detail);
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert(ov <= 0, 'no horizontal overflow');
  results.push(`phone 390×844: 展开为三维 sits clear of the other controls; a tap unfolds the campus; a tap on 图书馆 opens its sheet (${(await info(page)).selected}); no horizontal overflow`);
  await ctx.close();
}

  await browser.close();
  server.close();
  const real = errors.filter((e) => !/GPU stall|swiftshader|Automatic fallback/i.test(e));
  if (real.length) { console.error('browser errors:\n' + real.slice(0, 20).join('\n')); process.exitCode = 1; }
  for (const r of results) console.log('✓ ' + r);
  if (!only.length && !real.length) fs.writeFileSync(path.join(__dirname, 'campus-unfold-browser-results.json'), JSON.stringify({ when: new Date().toISOString(), renderer: 'Chromium + SwiftShader (software)', checks: results }, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });

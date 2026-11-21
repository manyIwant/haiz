// 晨径 (path.html) in a real browser: Chromium with SwiftShader (software GL) in this environment.
// usage: node tests/path-browser.cjs            (writes tests/path-browser-results.json)
//        SHOTS=1 node tests/path-browser.cjs    (also saves review frames to tests/artifacts/path/)
// What it cannot tell you: real GPU frame rate, thermal behaviour, Safari/WeChat, real touch feel.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const serve = () => new Promise((res) => {
  const s = http.createServer((req, rsp) => {
    const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    fs.readFile(p, (err, buf) => {
      if (err) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
      rsp.end(buf);
    });
  }).listen(0, () => res(s));
});
const SHOTS = !!process.env.SHOTS;
const outDir = path.join(root, 'tests/artifacts/path');
const results = { date: new Date().toISOString(), renderer: 'Chromium + SwiftShader (software)', checks: [], metrics: {} };
let failed = 0;
const check = (name, ok, detail = '') => { results.checks.push({ name, ok: !!ok, detail }); if (!ok) failed++; console.log(ok ? 'PASS' : 'FAIL', name, detail); };
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

async function open(browser, base, opts = {}, qs = '') {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/GPU stall|swiftshader|ReadPixels/i.test(m.text())) errors.push(m.text()); });
  const t0 = Date.now();
  await page.goto(`${base}/path.html?quality=low&capture=1${qs}`);
  await page.waitForFunction(() => window.__path, null, { timeout: 240000 });
  await page.evaluate(() => window.__path.buildings);
  return { ctx, page, errors, loadS: (Date.now() - t0) / 1000 };
}

(async () => {
  if (SHOTS) fs.mkdirSync(outDir, { recursive: true });
  const server = await serve();
  const base = `http://localhost:${server.address().port}`;
  const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch({ executablePath: exe, args: GL });

  // ------------------------------------------------------------------ desktop
  const { page, errors, loadS, ctx } = await open(browser, base, { viewport: { width: 1280, height: 720 } });
  check('loads with buildings, film mode', await page.evaluate(() => __path.S.mode === 'film' && !!__path.world.campusV3), `load ${loadS.toFixed(1)} s (software GL)`);

  // the film is a pure function of time; it never jumps, never enters a solid, never leaves the ground
  const film = await page.evaluate(async () => {
    const { film, world } = __path;
    const { nearest } = await import('./lanren/world/collide.js');
    const a = film.shot(31.7).eye.clone(), b = film.shot(31.7).eye.clone();
    let maxStep = 0, minClear = Infinity, minAbove = Infinity, prev = null, worst = null;
    for (let t = 0; t <= film.duration; t += 1 / 30) {
      const e = film.shot(t).eye.clone();
      if (prev) maxStep = Math.max(maxStep, e.distanceTo(prev));
      prev = e;
      const n = nearest(world.colliders, e.x, e.z);
      if (n.d < minClear) { minClear = n.d; worst = [t.toFixed(2), n.id]; }
      minAbove = Math.min(minAbove, e.y - world.heightAt(e.x, e.z));
    }
    return { same: a.distanceTo(b) === 0, maxStep, minClear, minAbove, worst, duration: film.duration };
  });
  check('film deterministic', film.same);
  check('film continuous (max 1/30 s step < 0.15 m)', film.maxStep < 0.15, film.maxStep.toFixed(3) + ' m');
  check('film never inside a solid', film.minClear > 0.15, `min clearance ${film.minClear.toFixed(2)} m at t=${film.worst}`);
  check('film eye above the ground', film.minAbove > 0.8, film.minAbove.toFixed(2) + ' m');

  // each station: the film holds at the photographer's pose; the print develops; the slip names its source
  const holds = { gate: 7.6, taihu: 42.2, tree: 68.7 };
  for (const [id, t] of Object.entries(holds)) {
    const r = await page.evaluate(([id, t]) => {
      __path.seek(t); __path.still(4.8);
      const st = __path.memory.state;
      return { developed: st.developed.has(id), active: st.active?.id, title: document.querySelector('#pwSlipTitle').textContent, hidden: document.querySelector('#pwSlip').hidden, rights: document.querySelector('#pwSlipRights').textContent };
    }, [id, t]);
    check(`station ${id}: develops and shows its record`, r.developed && r.active === id && !r.hidden && r.rights.length > 0, `${r.title} · ${r.rights}`);
    if (SHOTS) await page.screenshot({ path: path.join(outDir, `desktop-station-${id}.jpg`), type: 'jpeg', quality: 86 });
  }
  if (SHOTS) {
    for (const t of [0, 4, 18, 30, 50.5, 59, 82, 90]) {
      await page.evaluate((t) => { __path.seek(t); __path.still(0.25); }, t);
      await page.waitForTimeout(1700);   // let caption transitions finish (the scene is paused)
      await page.screenshot({ path: path.join(outDir, `desktop-film-${String(t).replace('.', '_')}.jpg`), type: 'jpeg', quality: 86 });
    }
  }

  // handover: one key press takes the camera; nothing jumps
  const hand = await page.evaluate(() => {
    __path.seek(30); __path.still(0.1);
    const before = __path.camera.position.clone();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    __path.still(1 / 30);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    return { mode: __path.S.mode, jump: __path.camera.position.distanceTo(before) };
  });
  check('a key press hands the camera over without a jump', hand.mode === 'free' && hand.jump < 0.12, `${hand.mode}, moved ${hand.jump.toFixed(3)} m in the first frame`);

  // walking has weight; walls hold; the bed is a terrace reached by its steps
  const walk = await page.evaluate(async () => {
    const { walker, world } = __path;
    const { nearest } = await import('./lanren/world/collide.js');
    walker.place(-36, -40, 0, 0);
    walker.state.keys.add('f'); __path.still(0.25); const early = walker.state.speed; __path.still(2.75); walker.state.keys.delete('f');
    const moved = walker.state.pos.z + 40;
    // into 一号楼's north facade for 12 s
    walker.place(-50, 4, 0, 0); walker.state.keys.add('f'); __path.still(12); walker.state.keys.delete('f');
    const facade = { z: walker.state.pos.z, clear: nearest(world.colliders, walker.state.pos.x, walker.state.pos.z).d };
    // into the bed's wall from the east (no steps there)
    walker.place(9.5, 0.5, -90, 0); walker.state.keys.add('f'); __path.still(6); walker.state.keys.delete('f');
    const wall = { x: walker.state.pos.x, onBed: world.bed.inside(walker.state.pos.x, walker.state.pos.z) };
    // up the steps on the north side
    walker.place(-1.2, -10, 0, 0); walker.state.keys.add('f'); __path.still(6); walker.state.keys.delete('f');
    const steps = { y: walker.state.pos.y, top: world.bed.top, z: walker.state.pos.z };
    return { early, moved, facade, wall, steps };
  });
  check('walking accelerates (not full speed in the first 0.25 s)', walk.early < 1.0 && walk.early > 0.3, walk.early.toFixed(2) + ' m/s');
  check('walking ~1.45 m/s', walk.moved > 3.0 && walk.moved < 4.6, walk.moved.toFixed(2) + ' m in 3 s');
  check('the facade holds', walk.facade.clear > 0.28 && walk.facade.z < 9.5, `stopped at z ${walk.facade.z.toFixed(2)}, clearance ${walk.facade.clear.toFixed(2)} m`);
  check('the bed wall holds where there are no steps', !walk.wall.onBed, `x ${walk.wall.x.toFixed(2)}`);
  check('the steps lead up onto the bed', Math.abs(walk.steps.y - walk.steps.top) < 0.05, `y ${walk.steps.y.toFixed(2)} (bed top ${walk.steps.top})`);

  // standing where the photographer stood develops the photograph in free walking too
  const free = await page.evaluate(() => {
    const st = __path.STATIONS.find((s) => s.id === 'tree');
    __path.memory.state.developed.clear();
    __path.walker.place(st.pose.eye.x, st.pose.eye.z, st.pose.yaw, st.pose.pitch);
    __path.still(5);
    return { developed: __path.memory.state.developed.has('tree'), amt: __path.memory.state.amt };
  });
  check('free walk: standing on the ring and looking develops the photograph', free.developed, `amount ${free.amt.toFixed(2)}`);
  if (SHOTS) {
    await page.evaluate(() => { __path.walker.place(12.5, -5.5, -40, 8); __path.still(0.4); });
    await page.screenshot({ path: path.join(outDir, 'desktop-tree-aside.jpg'), type: 'jpeg', quality: 86 });
  }

  // back to the director from where you are
  const back = await page.evaluate(() => { document.querySelector('#pwDirector').click(); __path.still(0.2); return { mode: __path.S.mode, t: __path.S.filmT }; });
  check('the director button resumes the film from the nearest point', back.mode === 'film' && back.t > 62, `t = ${back.t.toFixed(2)}`);
  const time = await page.evaluate(() => { document.querySelector('#pwTime').click(); return { label: document.querySelector('#pwTime').textContent, when: document.querySelector('#pwWhen').textContent }; });
  check('time toggle: Haikou now', time.label === '海口此刻', time.when);

  // metrics: what was downloaded, what is drawn
  const m = await page.evaluate(async () => {
    const res = performance.getEntriesByType('resource');
    const by = {};
    let total = 0;
    for (const r of res) { const k = (r.name.match(/\.(\w+)(\?|$)/) || [, 'other'])[1]; const b = r.transferSize || r.encodedBodySize || 0; by[k] = (by[k] || 0) + b; total += b; }
    const big = res.map((r) => ({ n: r.name.replace(location.origin + '/', ''), kb: Math.round((r.encodedBodySize || 0) / 1024) })).sort((a, b) => b.kb - a.kb).slice(0, 8);
    // frame intervals over 3 s of the live loop (software GL: not a device frame rate)
    __path.resume(); __path.seek(30);
    const iv = []; let last = performance.now();
    await new Promise((done) => { const f = (t) => { iv.push(t - last); last = t; if (iv.length < 40) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
    iv.sort((a, b) => a - b);
    const s = __path.stats();
    return { totalMB: +(total / 1048576).toFixed(2), byType: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, +(v / 1048576).toFixed(2)])), largest: big,
      draw: { calls: s.calls, tris: s.tris, textures: s.textures, geometries: s.geometries, programs: s.programs },
      heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
      frameMsMedian: +iv[Math.floor(iv.length / 2)].toFixed(1), frameMsP90: +iv[Math.floor(iv.length * 0.9)].toFixed(1) };
  });
  results.metrics.desktop = m;
  console.log('metrics', JSON.stringify(m));
  check('no page errors (desktop)', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();

  // ------------------------------------------------------------------ phone (portrait, touch)
  const phone = await open(browser, base, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const P = phone.page;
  const layout = await P.evaluate(() => {
    const over = document.documentElement.scrollWidth > innerWidth + 1;
    const out = [...document.querySelectorAll('.pw-tools button, .pw-line button')].filter((b) => { const r = b.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1; }).length;
    return { over, out, coarse: matchMedia('(pointer: coarse)').matches };
  });
  check('phone: no horizontal overflow, controls on screen', !layout.over && layout.out === 0, JSON.stringify(layout));
  if (SHOTS) {
    for (const [n, t, s] of [['gate', 7.6, 4.8], ['axis', 24, 0.3], ['tree', 68.7, 4.8], ['under', 86, 0.3]]) {
      await P.evaluate(([t, s]) => { __path.seek(t); __path.still(s); }, [t, s]);
      await P.screenshot({ path: path.join(outDir, `phone-${n}.jpg`), type: 'jpeg', quality: 86 });
    }
  }
  // touch: left thumb walks (joystick), right thumb looks
  const touch = await P.evaluate(async () => {
    __path.seek(30); __path.still(0.1);
    const c = document.querySelector('#pw');
    const ev = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: id === 1 }));
    const p0 = __path.camera.position.clone();
    ev('pointerdown', 1, 90, 700); ev('pointermove', 1, 92, 640); ev('pointermove', 1, 92, 630);
    __path.still(2);
    const stickShown = !document.querySelector('#pwStick').hidden;
    ev('pointerup', 1, 92, 630);
    const moved = __path.camera.position.distanceTo(p0);
    const yaw0 = __path.walker.state.yaw;
    ev('pointerdown', 2, 300, 400); for (let i = 1; i <= 10; i++) ev('pointermove', 2, 300 - i * 8, 400); ev('pointerup', 2, 220, 400);
    __path.still(0.1);
    return { mode: __path.S.mode, moved, stickShown, turned: __path.walker.state.yaw - yaw0 };
  });
  check('phone: left-thumb joystick walks', touch.mode === 'free' && touch.moved > 0.8 && touch.stickShown, `${touch.moved.toFixed(2)} m`);
  check('phone: right-thumb drag looks around', Math.abs(touch.turned) > 3, `${touch.turned.toFixed(1)}°`);
  check('no page errors (phone)', phone.errors.length === 0, phone.errors.slice(0, 3).join(' | '));
  await phone.ctx.close();

  // ------------------------------------------------------------------ reduced motion
  const rm = await open(browser, base, { viewport: { width: 1024, height: 640 }, reducedMotion: 'reduce' });
  const rr = await rm.page.evaluate(() => {
    const k = __path.film.keys[2];
    const sh = __path.film.shot(10.0);
    __path.memory.state.developed.clear();
    __path.seek(7.6); __path.still(1.4);
    return { yawErr: Math.abs(sh.yaw - k.yaw), developed: __path.memory.state.developed.has('gate') };
  });
  check('reduced motion: no breathing, prints develop quickly', rr.yawErr < 1e-9 && rr.developed, JSON.stringify(rr));
  check('no page errors (reduced motion)', rm.errors.length === 0, rm.errors.slice(0, 3).join(' | '));
  await rm.ctx.close();

  await browser.close();
  server.close();
  results.failed = failed;
  fs.writeFileSync(path.join(root, 'tests/path-browser-results.json'), JSON.stringify(results, null, 1) + '\n');
  console.log(failed ? `${failed} FAILED` : 'ALL PASS');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

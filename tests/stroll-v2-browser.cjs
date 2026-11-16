// Browser regression for 校园漫步 V2 (campus-stroll-v2.html, lanren/stroll/).
//
//   node tests/stroll-v2-browser.cjs              desktop + phone (touch), buildings included
//   CAMPUS=off node tests/stroll-v2-browser.cjs   skip the 11 MB building model (fast)
//   CHROMIUM_PATH=/path/to/chrome                 use a specific Chromium build
//
// Runs in software WebGL (SwiftShader) on Linux: it proves the page works, the controls, camera,
// colliders and culling behave and nothing errors. It is not a GPU, Safari or frame-rate test.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, devices } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
const fail = (m) => { throw new Error(m); };
const campusOff = process.env.CAMPUS === 'off';

async function open(browser, ctxOpts, errors) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/campus-stroll-v2.html?quality=low&scale=0.6${campusOff ? '&campus=off' : ''}`);
  await page.waitForFunction(() => window.__stroll, null, { timeout: 180000 });
  await page.evaluate(() => { document.querySelector('#sw-help').hidden = true; });
  return { ctx, page };
}

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: process.platform === 'darwin' ? ['--use-gl=angle', '--use-angle=metal'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  try {
    // ------------------------------------------------------------ desktop
    const { ctx, page } = await open(browser, { viewport: { width: 1100, height: 640 } }, errors);
    const tp = await page.evaluate(() => { const T = window.__stroll; T.settle(1.5); const s = T.player.state, c = T.camera.position; return { d: Math.hypot(c.x - s.pos.x, c.z - s.pos.z), up: c.y - s.pos.y, fp: T.player.firstPerson, vis: T.student.root.children[0].visible }; });
    if (tp.fp || tp.d < 2.5 || tp.up < 0.8 || !tp.vis) fail('not a third-person start: ' + JSON.stringify(tp));
    console.log('third person by default ✓', JSON.stringify(tp));

    const before = await page.evaluate(() => { const s = window.__stroll.player.state; return { x: s.pos.x, z: s.pos.z, yaw: s.camYaw }; });
    await page.keyboard.down('KeyW');
    await page.waitForFunction((b) => { const s = window.__stroll.player.state; return Math.hypot(s.pos.x - b.x, s.pos.z - b.z) > 1.2; }, before, { timeout: 90000 });
    await page.keyboard.up('KeyW');
    const after = await page.evaluate(() => { const s = window.__stroll.player.state; return { x: s.pos.x, z: s.pos.z }; });
    const along = (after.x - before.x) * Math.sin(before.yaw) + (after.z - before.z) * Math.cos(before.yaw);
    if (along < 1.0) fail('W did not walk along the view: ' + along.toFixed(2));
    console.log('keyboard walk ✓', along.toFixed(2), 'm');

    // the director: open ground pulls the camera back; resting settles a wider, lower framing
    const dir = await page.evaluate(() => {
      const T = window.__stroll;
      T.place(-122, -60, -90); T.view(-90, 0.15, 1); T.settle(3);
      const open = T.player.cam.dist.v;
      T.place(-60, 45, 0); T.view(0, 0.15, 1); T.settle(3);
      const tight = T.player.cam.dist.v;
      T.place(-122, -60, -90); T.view(-90, 0.15, 1); T.settle(1.5);
      const pitch0 = T.player.cam.pitch.v;
      T.player.state.lastInput = -1e3; T.settle(7);
      return { open, tight, pitch0, restPitch: T.player.cam.pitch.v };
    });
    if (!(dir.open > dir.tight + 0.6)) fail('camera should pull back on open ground: ' + JSON.stringify(dir));
    if (!(dir.restPitch < dir.pitch0 - 0.02)) fail('resting should lower the framing: ' + JSON.stringify(dir));
    console.log('camera director ✓', JSON.stringify(dir));

    const sun = await page.evaluate(() => { const T = window.__stroll; const a = T.U.uSunDir.value.y; T.setTime('golden'); const b = T.U.uSunDir.value.y; T.setTime('morning'); const c = T.U.uMist.value; T.setTime('noon'); return { a, b, mist: c }; });
    if (!(sun.b < sun.a - 0.3) || !(sun.mist > 0.1)) fail('moods did not change the world: ' + JSON.stringify(sun));
    console.log('moods ✓', JSON.stringify(sun));

    await page.keyboard.press('KeyV');
    await page.evaluate(() => window.__stroll.settle(2));
    const fp = await page.evaluate(() => { const T = window.__stroll, s = T.player.state, c = T.camera.position; return { d: Math.hypot(c.x - s.pos.x, c.z - s.pos.z), h: c.y - s.pos.y, label: document.querySelector('[data-view]').textContent }; });
    if (fp.d > 0.4 || Math.abs(fp.h - 1.56) > 0.2) fail('first person did not engage: ' + JSON.stringify(fp));
    await page.keyboard.press('KeyV');
    await page.evaluate(() => window.__stroll.settle(2));
    console.log('first ↔ third person ✓', JSON.stringify(fp));

    const grass = await page.evaluate(() => { const T = window.__stroll; T.place(3, -34, 3); T.view(3, 0.15, 1); T.settle(1); T.grass.update(T.camera, T.player.state.pos, -0.85); return T.grass.stats; });
    if (grass.tiles[0] < 1 || grass.verts > 400000) fail('grass tiles not drawn or not culled: ' + JSON.stringify(grass));
    console.log('grass tiles culled ✓', JSON.stringify(grass));

    if (!campusOff) {
      await page.waitForFunction(() => window.__stroll.info.buildings !== 'loading', null, { timeout: 400000 });
      const info = await page.evaluate(() => window.__stroll.info);
      if (info.buildings !== 'ready' || info.tris < 700000) fail('buildings did not load: ' + JSON.stringify(info));
      const clear = await page.evaluate(async () => {
        const T = window.__stroll;
        const { nearest } = await import('/lanren/world/collide.js');
        const col = T.colliders();
        const hull = col.rects.find((h) => h.id === 'yihao');
        const nx = hull.s, nz = hull.c;
        const yaw = Math.atan2(-nx, -nz) * 180 / Math.PI;
        T.place(hull.cx + nx * (hull.hd + 3), hull.cz + nz * (hull.hd + 3), yaw);
        T.view(yaw, 0.15, 1);
        const s = T.player.state, start = { x: s.pos.x, z: s.pos.z };
        dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
        T.settle(6);
        dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
        // the camera must never end inside a wall
        const c = T.camera.position;
        return { d: nearest(col, s.pos.x, s.pos.z).d, moved: Math.hypot(s.pos.x - start.x, s.pos.z - start.z), camWall: nearest(col, c.x, c.z).d };
      });
      if (clear.d < 0.29 || clear.d > 1.0 || clear.moved < 1.5) fail('collision: ' + JSON.stringify(clear));
      if (clear.camWall < 0.05) fail('the camera ended inside a wall: ' + JSON.stringify(clear));
      console.log('buildings ✓', info.tris, 'tris in', info.campusMs, 'ms; collision', JSON.stringify(clear));
    }
    await ctx.close();

    // ------------------------------------------------------------ phone (portrait, touch)
    const phone = await open(browser, { ...devices['iPhone 13'], deviceScaleFactor: 1 }, errors);
    const p = phone.page;
    const layout = await p.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, vis: getComputedStyle(e).display !== 'none' }; };
      return { w: innerWidth, h: innerHeight, scroll: document.documentElement.scrollWidth, jump: r('.sw-jump'), tools: r('.sw-tools'), fov: window.__stroll.camera.fov };
    });
    if (layout.scroll > layout.w + 1) fail('horizontal overflow on phone: ' + JSON.stringify(layout));
    if (!layout.jump?.vis || layout.jump.r > layout.w || layout.tools.r > layout.w) fail('phone controls off screen: ' + JSON.stringify(layout));
    console.log('phone layout ✓', JSON.stringify(layout));
    // a left-thumb drag on the canvas moves the student (touch pointer events, as a phone sends them)
    const touch = await p.evaluate(() => {
      const T = window.__stroll, cv = document.querySelector('#sw-canvas');
      const s = T.player.state, start = { x: s.pos.x, z: s.pos.z };
      const ev = (type, x, y) => cv.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true }));
      ev('pointerdown', 80, innerHeight - 160);
      ev('pointermove', 80, innerHeight - 220);
      const stickShown = !document.querySelector('#sw-stick').hidden;
      T.settle(2);
      ev('pointerup', 80, innerHeight - 220);
      // a right-thumb drag turns the view
      const yaw0 = s.camYaw;
      const ev2 = (type, x, y) => cv.dispatchEvent(new PointerEvent(type, { pointerId: 8, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
      ev2('pointerdown', innerWidth - 80, innerHeight / 2); ev2('pointermove', innerWidth - 160, innerHeight / 2); ev2('pointerup', innerWidth - 160, innerHeight / 2);
      return { moved: Math.hypot(s.pos.x - start.x, s.pos.z - start.z), stickShown, turned: Math.abs(s.camYaw - yaw0) };
    });
    if (touch.moved < 1 || !touch.stickShown || touch.turned < 0.2) fail('touch controls: ' + JSON.stringify(touch));
    console.log('touch stick + look ✓', JSON.stringify(touch));
    await phone.ctx.close();

    if (errors.length) fail('errors on the page:\n' + errors.join('\n'));
    console.log('stroll v2: all checks passed');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e.message || e); process.exitCode = 1; });

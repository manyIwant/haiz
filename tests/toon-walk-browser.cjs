// Browser check for the stylized third-person walk (campus-stroll.html, lanren/toon/).
//
//   node tests/toon-walk-browser.cjs            low quality, buildings included
//   CAMPUS=off node tests/toon-walk-browser.cjs skip the 11 MB building model (fast)
//   SHOTS=dir node tests/toon-walk-browser.cjs  also save screenshots (noon, golden, first person)
//
// Software rendering (SwiftShader) proves the page runs, the controls and colliders behave and
// nothing errors; it does not stand in for real-device GPU, Safari or frame-rate checks.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const fail = (m) => { throw new Error(m); };

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: process.platform === 'darwin' ? ['--use-gl=angle', '--use-angle=metal'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    const campusOff = process.env.CAMPUS === 'off';
    const url = `http://127.0.0.1:${server.address().port}/campus-stroll.html?quality=low${campusOff ? '&campus=off' : ''}`;
    await page.goto(url);
    await page.waitForFunction(() => window.__toon, null, { timeout: 180000 });
    await page.evaluate(() => { document.querySelector('#tw-help').hidden = true; });

    // 1. third person by default: the camera is behind and above the student, the figure is drawn
    const tp = await page.evaluate(() => {
      const T = window.__toon, s = T.player.state, c = T.camera.position;
      return { d: Math.hypot(c.x - s.pos.x, c.z - s.pos.z), up: c.y - s.pos.y, fp: T.player.firstPerson, visible: T.student.root.children[0].visible };
    });
    if (tp.fp) fail('the walk should start in third person');
    if (tp.d < 2.5 || tp.up < 1) fail('third-person camera not behind and above the student: ' + JSON.stringify(tp));
    if (!tp.visible) fail('the student is not visible in third person');
    console.log('third person ✓', JSON.stringify(tp));

    // 2. walking: W for ~1.5 s moves the student along the camera's heading
    const before = await page.evaluate(() => { const s = window.__toon.player.state; return { x: s.pos.x, z: s.pos.z, yaw: s.camYaw }; });
    await page.keyboard.down('KeyW');
    await page.waitForFunction((b) => { const s = window.__toon.player.state; return Math.hypot(s.pos.x - b.x, s.pos.z - b.z) > 1.2; }, before, { timeout: 60000 });
    await page.keyboard.up('KeyW');
    const after = await page.evaluate(() => { const s = window.__toon.player.state; return { x: s.pos.x, z: s.pos.z }; });
    const along = (after.x - before.x) * Math.sin(before.yaw) + (after.z - before.z) * Math.cos(before.yaw);
    if (along < 1.0) fail('W did not walk forward along the view: ' + along.toFixed(2));
    console.log('walk ✓ moved', along.toFixed(2), 'm forward');

    // 3. time of day moves the sun for the whole world
    const sun = await page.evaluate(() => { const T = window.__toon; const a = T.TOON.uSunDir.value.y; T.setTime('golden'); const b = T.TOON.uSunDir.value.y; T.setTime('noon'); return { a, b }; });
    if (!(sun.b < sun.a - 0.3)) fail('golden hour should lower the sun: ' + JSON.stringify(sun));
    console.log('daylight ✓', JSON.stringify(sun));

    // 4. first person and back (V)
    await page.keyboard.press('KeyV');
    await page.waitForFunction(() => { const T = window.__toon, s = T.player.state, c = T.camera.position; return Math.hypot(c.x - s.pos.x, c.z - s.pos.z) < 0.4 && Math.abs(c.y - s.pos.y - 1.56) < 0.2; }, null, { timeout: 60000 });
    if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, 'toon-first-person.png'), timeout: 240000 });
    await page.keyboard.press('KeyV');
    await page.waitForFunction(() => { const T = window.__toon, s = T.player.state, c = T.camera.position; return Math.hypot(c.x - s.pos.x, c.z - s.pos.z) > 2.5; }, null, { timeout: 60000 });
    console.log('first person ↔ third person ✓');

    // 5. buildings (unless skipped): the Blender V3 model arrives and its hulls stop the walker
    if (!campusOff) {
      await page.waitForFunction(() => window.__toon.info.buildings !== 'loading', null, { timeout: 300000 });
      const info = await page.evaluate(() => window.__toon.info);
      if (info.buildings !== 'ready') fail('campus buildings did not load: ' + info.buildings);
      if (info.tris < 700000) fail('unexpected building triangle count ' + info.tris);
      // stand 3 m off 一号教学楼's hull, face it and walk into it for 6 simulated seconds
      // (fixed steps through the real controller, so slow software frames do not shorten the walk)
      const clear = await page.evaluate(async () => {
        const T = window.__toon;
        const { nearest } = await import('/lanren/world/collide.js');
        const col = T.colliders();
        const hull = col.rects.find((h) => h.id === 'yihao');
        // the hull's local +Z face, in world space (rect frame: inverse of three.js rotation.y)
        const nx = hull.s, nz = hull.c;
        const sx = hull.cx + nx * (hull.hd + 3), sz = hull.cz + nz * (hull.hd + 3);
        const yaw = Math.atan2(-nx, -nz) * 180 / Math.PI;
        T.place(sx, sz, yaw);
        T.view(yaw, 0.15, 5);
        const s = T.player.state;
        const start = { x: s.pos.x, z: s.pos.z };
        dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
        for (let i = 0; i < 180; i++) T.player.update(1 / 30);
        dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
        return { d: nearest(col, s.pos.x, s.pos.z).d, moved: Math.hypot(s.pos.x - start.x, s.pos.z - start.z), startD: nearest(col, start.x, start.z).d };
      });
      if (clear.d < 0.29) fail('the student walked into a building: ' + JSON.stringify(clear));
      if (clear.d > 1.0 || clear.moved < 1.5) fail('the student never reached the wall: ' + JSON.stringify(clear));
      console.log('buildings ✓', info.tris, 'triangles; collision clearance', clear.d.toFixed(2), 'm');
    }

    if (process.env.SHOTS) {
      await page.evaluate(() => { const T = window.__toon; T.place(3, -34, 3); T.view(3, 0.14, 5.2); T.setTime('noon'); });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(process.env.SHOTS, 'toon-noon.png'), timeout: 240000 });
      await page.evaluate(() => window.__toon.setTime('golden'));
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(process.env.SHOTS, 'toon-golden.png'), timeout: 240000 });
    }
    if (errors.length) fail('errors on the page:\n' + errors.join('\n'));
    console.log('toon walk: all checks passed');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e.message || e); process.exitCode = 1; });

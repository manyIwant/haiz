const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium, webkit } = require('playwright');

const root = path.resolve(__dirname, '..');
const asset = '/campus-v3/architecture.glb';
const shots = process.env.SHOTS;
const until = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 60000 });
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const shot = (page, name) => shots && page.screenshot({ path: path.join(shots, name + '.jpg'), quality: 92 });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  fs.readFile(path.join(root, decodeURIComponent(url.pathname)), (error, bytes) => {
    res.writeHead(error ? 404 : 200, { 'Content-Type': types[path.extname(url.pathname)] || 'application/octet-stream' });
    res.end(error ? undefined : bytes);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = process.env.WEBKIT ? await webkit.launch({ executablePath: process.env.WEBKIT_PATH })
      : await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: process.platform === 'darwin' ? ['--use-gl=angle', '--use-angle=metal'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    if (shots) fs.mkdirSync(shots, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1200, height: 780 }, reducedMotion: 'reduce' });
    const loads = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (/GL_INVALID|WebGLProgram:|Blender V3 campus unavailable/.test(message.text())) errors.push(message.text()); });
    page.on('request', request => { if (request.url().endsWith(asset)) loads.push(request.url()); });
    const url = 'http://127.0.0.1:' + server.address().port + '/index.html?quality=' + (process.env.QUALITY || 'low') + '&test=1';
    await page.goto(url);
    await until(page, () => window.__haizHome?.life);
    assert.equal(loads.length, 0, 'early acts do not request the Blender campus');
    await page.evaluate(() => window.__haizHome.go(3));
    await until(page, () => window.__haizHome.map.section.blender);
    await page.evaluate(() => {
      const h = window.__haizHome;
      h.map.enter();
      h.map.unfold();
      h.map.settle();
    });
    await until(page, () => window.__haizHome.map.u === 1 && window.__haizHome.map.section.blender.children.every(o => o.visible));
    await frames(page);
    await shot(page, 'act-04');
    await page.evaluate(() => {
      const h = window.__haizHome;
      window.campusV3 = h.map.section.blender;
      window.yihaoV3 = window.campusV3.getObjectByName('SITE_yihao');
    });
    const campus = await page.evaluate(async () => {
      const h = window.__haizHome, sec = h.map.section;
      const { nearest } = await import('/lanren/world/collide.js');
      const { pivot, rotation } = h.map.geo.frame;
      const origin = h.map.geo.frame.toWorld(pivot.x, pivot.z);
      const local = (id, dx, dz) => {
        const root = sec.blender.getObjectByName('SITE_' + id), yaw = root.rotation.y;
        return [root.position.x + dx * Math.cos(yaw) + dz * Math.sin(yaw), root.position.z - dx * Math.sin(yaw) + dz * Math.cos(yaw)];
      };
      const hulls = h.life.colliders();
      const clearance = (id, x, z) => nearest(hulls, ...local(id, x, z)).d;
      const yaw = sec.blender.getObjectByName('SITE_keji').rotation.y - rotation;
      return { n: sec.blender.children.length, oldVisible: sec.mesh.visible, origin, yaw,
        gateOpening: clearance('beimen', 0, 0), gatePier: clearance('beimen', 3.3, 0),
        corridorOpening: clearance('corr_big', 0, 0), corridorWall: clearance('corr_big', 2.4, 0),
        corridorDeck: sec.walkHeight(...local('corr_big', 0, 0)),
        pavilionDeck: sec.walkHeight(...local('fengqitang_ting', 2, 0)),
        librarySteps: clearance('library', 0, -36), portal: clearance('yihao', 0, -18),
        filmClearance: Math.min(...Array.from({ length: 101 }, (_, i) => {
          const { cam } = h.life.film(i / 100);
          return h.life.clearance(cam.ex, cam.ez);
        })) };
    });
    assert.equal(campus.n, 26);
    assert.equal(campus.oldVisible, false, 'the duplicate exterior is not drawn');
    assert.deepEqual(campus.origin, { x: 0, z: 0 });
    assert(Math.abs(campus.yaw + 0.267) < 0.001);
    assert(campus.gateOpening > 0.32 && campus.gatePier < 0);
    assert(campus.corridorOpening > 0.32 && campus.corridorWall < 0);
    assert(Math.abs(campus.corridorDeck - (-0.83 + 0.245)) < 1e-6);
    assert(Math.abs(campus.pavilionDeck - (-0.83 + 0.4)) < 1e-6);
    assert(campus.librarySteps < 0 && campus.portal < 0);
    assert(campus.filmClearance > 0.32, JSON.stringify(campus));
    await page.evaluate(() => {
      const h = window.__haizHome;
      h.map.exit(() => h.go(5));
      h.map.settle();
    });
    await until(page, () => window.__haizHome.W.owner === 'hold');
    await frames(page);
    await shot(page, 'act-06');
    const before = await page.evaluate(() => window.__haizHome.world.camera.position.toArray());
    await page.evaluate(() => window.__haizHome.life.handoff());
    await until(page, () => window.__haizHome.W.owner === 'play');
    await frames(page);
    const after = await page.evaluate(() => {
      const h = window.__haizHome;
      return { eye: h.world.camera.position.toArray(), sameCampus: h.map.section.blender === window.campusV3,
        sameBuilding: h.map.section.blender.getObjectByName('SITE_yihao') === window.yihaoV3, visible: window.yihaoV3.visible };
    });
    assert(after.sameCampus && after.sameBuilding && after.visible, 'the walk uses the same Blender building instance');
    assert(Math.hypot(...before.map((x, i) => x - after.eye[i])) < 0.05, 'camera stays at the film endpoint');
    assert.equal(loads.length, 1);
    await page.keyboard.press('KeyH');
    await page.evaluate(() => {
      const h = window.__haizHome;
      document.querySelector('[data-w="guide-ok"]')?.click();
      const b = h.map.section.buildings.find(b => b.id === 'yihao');
      const c = Math.cos(b.rot), s = Math.sin(b.rot);
      const x = b.cx + 30 * c - 51 * s, z = b.cz - 30 * s - 51 * c;
      h.life.place(x, z, Math.atan2(b.cx - x, b.cz - z) * 180 / Math.PI);
      h.life.look(0, 6 - h.life.player.pitch);
    });
    await frames(page);
    await shot(page, 'walk-yihao');
    const runtime = await page.evaluate(() => {
      const h = window.__haizHome, r = h.world.renderer;
      const gl = r.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
      return { device: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        eye: h.world.camera.position.y, feet: h.life.player.y, dpr: r.getPixelRatio(), error: gl.getError() };
    });
    if (process.env.MEASURE) {
      const intervals = await page.evaluate(() => new Promise(resolve => {
        const intervals = [];
        let previous;
        function frame(now) {
          if (previous !== undefined) intervals.push(now - previous);
          previous = now;
          if (intervals.length < 90) requestAnimationFrame(frame);
          else resolve(intervals);
        }
        requestAnimationFrame(frame);
      }));
      intervals.sort((a, b) => a - b);
      console.log('Stationary walk frame interval (ms)', { median: intervals[45], p95: intervals[85] });
    }
    assert(Math.abs(runtime.eye - runtime.feet - 1.62) < 0.01);
    assert.equal(runtime.error, 0);
    assert.deepEqual(errors, []);
    console.log('PASS shared Blender campus, 26 anchors, gate/corridor collision, film clearance and seamless handoff', JSON.stringify({ campus, runtime }));
    await page.close();
    if (process.env.WEBKIT) return;

    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const touchPage = await phone.newPage();
    await touchPage.goto(url + '#end');
    await until(touchPage, () => window.__haizHome?.life);
    await touchPage.evaluate(() => window.__haizHome.go(5));
    await until(touchPage, () => window.__haizHome.W.owner === 'hold');
    await touchPage.locator('.wd-go').tap();
    await touchPage.locator('[data-w="portrait"]').tap({ timeout: 65000 });
    await until(touchPage, () => window.__haizHome.W.owner === 'play');
    await touchPage.locator('[data-w="guide-ok"]').tap();
    const cdp = await phone.newCDPSession(touchPage);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const player = () => touchPage.evaluate(() => window.__haizHome.life.player);
    const start = await player();
    await touch('touchStart', 75, 640);
    await touch('touchMove', 75, 574);
    await until(touchPage, p => {
      const q = window.__haizHome.life.player;
      return Math.hypot(p.x - q.x, p.z - q.z) > 0.25;
    }, start);
    await touch('touchEnd');
    await touch('touchStart', 300, 470);
    await touch('touchMove', 350, 445);
    await touch('touchEnd');
    assert(Math.abs((await player()).yaw - start.yaw) > 5);
    assert(await touchPage.locator('.wd-hud [data-w="map"]').isVisible());
    assert(await touchPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await shot(touchPage, 'walk-phone');
    await phone.close();
    console.log('PASS 390×844 touch emulation: portrait entry, movement, look and map');

    const fallback = await browser.newPage({ reducedMotion: 'reduce' });
    await fallback.route('**' + asset, route => route.abort());
    await fallback.goto(url);
    await until(fallback, () => window.__haizHome?.life);
    await fallback.evaluate(() => window.__haizHome.go(5));
    await until(fallback, () => window.__haizHome.W.owner === 'hold');
    await fallback.evaluate(() => window.__haizHome.life.handoff());
    await until(fallback, () => window.__haizHome.W.owner === 'play');
    assert(await fallback.evaluate(() => {
      const section = window.__haizHome.map.section;
      return !section.blender && section.mesh.visible && section.ground.visible;
    }));
    console.log('PASS a failed asset request leaves the campus and walk usable');
  } finally {
    await browser?.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

// Real-browser checks for chapters 05 → 06 and the walk (Chromium; SwiftShader in this container:
// this proves the flow, the state and the geometry, not a hardware frame rate).
//   film      04 → 05 the campus rises (composition b); 05 → 06 the walker's film, a function of p:
//             the eye is in the walker's head, forwards = backwards, 06 holds
//   handoff   only a deliberate step at 06 hands over (a real key press), and it does not move the walker
//   walk      real keys move, walls stop, the page never scrolls, the wheel does nothing
//   maps      M opens the pocket map instantly; the full chapter 04 opens from where the walker
//             stands (no trip to the tree), and comes back to the same spot; a fresh start at the tree
//   menu      Esc; no interface (the handle stays); body on/off; back to 06; to another chapter
//   phone     portrait: the rotation step is offered and can be declined; touch joystick moves
//   history   Back from the walk returns to 06; reload in the walk returns to 06 with a way back
//   V4        01–04 untouched (no campus before 04 unless left standing), 05/06 panels and links kept
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
const SHOTS = process.env.SHOTS ? path.resolve(process.env.SHOTS) : null;

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
  const ready = (page) => page.waitForFunction(() => window.__haizHome?.life && document.body.classList.contains('ready'), null, { timeout: T });
  const info = (page) => page.evaluate(() => { const h = window.__haizHome; return { owner: h.W.owner, p: h.state.p, u: h.map.u, mode: h.map.mode, hash: location.hash, scrollY, player: h.life.player, cam: h.world.camera.position.toArray() }; });
  const until = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: T }).catch(async (e) => { console.error('waiting', fn.toString(), JSON.stringify(await info(page).catch(() => null))); throw e; });
  const frames = (page, n = 2) => page.evaluate((k) => new Promise((r) => { let i = 0; const f = () => (++i >= k ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.jpg'), type: 'jpeg', quality: 86, timeout: T }); } };
  const visible = (page, q) => page.evaluate((sel) => { const el = document.querySelector(sel); if (!el || el.closest('[hidden]')) return false; const r = el.getBoundingClientRect(), st = getComputedStyle(el); return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none' && +st.opacity > 0.3; }, q);
  const ok = (name, detail) => { results.push({ name, ok: true, detail }); console.log('✓ ' + name + (detail ? ' — ' + detail : '')); };

  if (run('film')) {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
    const page = await ctx.newPage();
    watch(page);
    await page.goto(base + '/index.html?quality=low&test=1&compose=b');
    await ready(page);
    // 01–03: V4 untouched, nothing of the campus is drawn
    await page.evaluate(() => window.__haizHome.go(2));
    await frames(page, 3);
    let s = await page.evaluate(() => ({ vis: window.__haizHome.map.section.group.visible, u: window.__haizHome.map.u, walker: window.__haizHome.world.scene.getObjectByName('walker-group').visible }));
    assert(!s.vis && s.u === 0 && !s.walker, '03: no campus, no walker');
    // 04 → 05: the campus rises with the scroll; at 05 it stands in material
    await page.evaluate(() => { const h = window.__haizHome; h.freeze(); h.go(3); h.seek(3.5); });
    await frames(page, 3);
    const mid = await page.evaluate(() => window.__haizHome.map.u);
    await page.evaluate(() => window.__haizHome.go(4));
    await frames(page, 3);
    s = await page.evaluate(() => { const h = window.__haizHome, sec = h.map.section; return { u: h.map.u, vis: sec.group.visible, ground: sec.ground.visible, standing: sec.buildings.filter((b) => sec.standing(b) > -0.85 + b.top - 0.01).length, n: sec.buildings.length, walker: h.world.scene.getObjectByName('walker-group').visible }; });
    assert(mid > 0 && mid < 1, 'half-way from 04 to 05 the campus is half risen (' + mid + ')');
    assert(s.u === 1 && s.vis && s.ground && s.standing === s.n, '05: every building stands, the ground is campus');
    assert(!s.walker, 'at 05 itself, no walker yet (V4\'s frame)');
    ok('04 → 05: the campus rises with the scroll (u ' + mid.toFixed(2) + ' half-way) and stands whole at 05; nothing of it before 04');
    await shot(page, 'film-0-05');
    // the film: eye in the head, forwards = backwards
    const samples = [4.1, 4.2, 4.3, 4.4, 4.5, 4.62, 4.75, 4.82, 4.9, 4.97];
    const pass = async (list) => {
      const out = [];
      for (const p of list) {
        await page.evaluate((pp) => window.__haizHome.seek(pp), p);
        await frames(page, 2);
        out.push(await page.evaluate((pp) => {
          const h = window.__haizHome, w = h.world, f = h.life.film(pp - 4);
          const cam = w.camera.position, g = w.scene.getObjectByName('walker');
          return { p: pp, cam: cam.toArray(), want: [f.cam.ex, f.cam.ey, f.cam.ez], feet: g.position.toArray(), body: [f.body.x, f.body.y, f.body.z], visible: w.scene.getObjectByName('walker-group').visible };
        }, p));
      }
      return out;
    };
    const fwd = await pass(samples), bwd = (await pass([...samples].reverse())).reverse();
    for (let i = 0; i < samples.length; i++) {
      const a = fwd[i], b = bwd[i];
      for (let k = 0; k < 3; k++) {
        assert(Math.abs(a.cam[k] - a.want[k]) < 1e-4, `p ${a.p}: the camera is the walker's eye`);
        assert(Math.abs(a.cam[k] - b.cam[k]) < 1e-6 && Math.abs(a.feet[k] - b.feet[k]) < 1e-6, `p ${a.p}: backwards = forwards`);
        if (a.visible) assert(Math.abs(a.feet[k] - a.body[k]) < 1e-6, `p ${a.p}: the drawn feet are the film's feet`);
      }
    }
    ok(`05 → 06 film: at ${samples.length} points the camera is exactly the walker's eye and the drawn body the film's body; scrolling back gives the same frames (Δ < 1e-6 m)`);
    for (const [p, name] of [[4.2, 'film-1-limb'], [4.4, 'film-2-leap'], [4.55, 'film-3-landed'], [4.82, 'film-4-away'], [4.91, 'film-5-turn']]) {
      await page.evaluate((pp) => window.__haizHome.seek(pp), p); await frames(page, 3); await shot(page, name);
      const g = await page.evaluate(() => { const h = window.__haizHome, s = h.map.section, w = h.world; return { ground: s.ground.visible, sweep: Math.round(s.sweepR), water: w.water.visible, near: w.camera.near, shadowAuto: w.renderer.shadowMap.autoUpdate }; });
      assert(g.ground && g.sweep > 400, name + ': the campus ground is drawn ' + JSON.stringify(g));
    }
    // 06 holds; scrolling on hands over (a real wheel, after a pause)
    await page.evaluate(() => { const h = window.__haizHome; h.freeze(false); h.go(5); });
    await until(page, () => window.__haizHome.W.owner === 'hold');
    await frames(page, 2);
    assert(await visible(page, '.wd-hold .wd-go'), 'the way on is offered at 06');
    assert(await visible(page, '#p-whole .slab'), '06\'s own links are still there');
    await shot(page, 'film-6-hold');
    const camBefore = await page.evaluate(() => window.__haizHome.world.camera.position.toArray());
    await page.waitForTimeout(800);
    await page.mouse.move(480, 270);
    await page.mouse.wheel(0, 240);
    await until(page, () => window.__haizHome.W.owner === 'play');
    await frames(page, 2);
    s = await info(page);
    const moved = Math.hypot(s.cam[0] - camBefore[0], s.cam[1] - camBefore[1], s.cam[2] - camBefore[2]);
    assert(moved < 0.05, 'handing over does not move the walker (' + moved + ' m)');
    assert(s.hash === '#walk', 'the walk is a history entry');
    ok(`06 holds with its links; a fresh scroll past the end hands the walker over (the eye moved ${moved.toFixed(3)} m) and #walk is pushed`);
    await shot(page, 'walk-0-handoff');
    // the walk: real keys move, the page never scrolls, the wheel does nothing
    const y0 = s.scrollY, p0 = s.player;
    // a real key held down (on a software renderer a frame can take seconds: hold until the walker has moved)
    await page.evaluate(() => document.querySelector('[data-w="guide-ok"]')?.click());
    await page.keyboard.down('KeyW');
    await page.waitForFunction((x0) => { const p = window.__haizHome.life.player; return Math.hypot(p.x - x0.x, p.z - x0.z) > 0.3; }, p0, { timeout: T }).catch(() => {});
    await page.keyboard.up('KeyW');
    // let the walker come to a stop before testing the wheel (it decelerates over a few frames)
    await until(page, () => { const p = window.__haizHome.life.player; return Math.hypot(p.vx, p.vz) === 0; });
    await frames(page, 2);
    s = await info(page);
    const walked = Math.hypot(s.player.x - p0.x, s.player.z - p0.z);
    assert(walked > 0.2, 'W walks forward (' + walked.toFixed(2) + ' m)');
    await page.mouse.wheel(0, 600);
    await frames(page, 3);
    const s2 = await info(page);
    assert(s2.scrollY === y0 && Math.abs(s2.player.x - s.player.x) < 0.01 && Math.abs(s2.player.z - s.player.z) < 0.01 && s2.owner === 'play', 'the wheel neither scrolls the page nor moves the walker ' + JSON.stringify({ y0, y: s2.scrollY, a: [s.player.x, s.player.z], b: [s2.player.x, s2.player.z] }));
    // simulated time (no rendering) for longer distances: a wall stops the walker
    const wall = await page.evaluate(() => {
      const L = window.__haizHome.life, b = window.__haizHome.map.section.buildings.find((x) => x.id === 'yihao');
      // stand 8 m off its long north face (campus -Z), face it, walk 6 s
      const c = Math.cos(b.rot), sn = Math.sin(b.rot), lz = -(b.d / 2 + 8);
      const x = b.cx + lz * sn, z = b.cz + lz * c, yaw = Math.atan2(b.cx - x, b.cz - z) * 180 / Math.PI;
      L.place(x, z, yaw);
      const after = L.simulate(['f'], 6);
      return { clear: L.clearance(after.x, after.z), x: after.x, z: after.z };
    });
    assert(wall.clear > 0.3, 'walking at 一号教学楼 stops at its wall (clearance ' + wall.clear.toFixed(2) + ')');
    ok(`walk: W moved the walker ${walked.toFixed(2)} m; the wheel moved nothing and the page stayed put; walking 6 s at 一号教学楼 stops ${wall.clear.toFixed(2)} m from its wall`);
    // look down: the body is there
    await page.evaluate(() => { const L = window.__haizHome.life; L.place(-24, 26, 200); L.look(0, -200); });   // to the limit (−78°): as for a person, the body shows when looking well down
    await frames(page, 3);
    await shot(page, 'walk-1-lookdown');
    await page.evaluate(() => window.__haizHome.life.look(0, 82));
    // M: the pocket map, instantly; Esc closes it
    await page.keyboard.press('KeyM');
    await until(page, () => window.__haizHome.W.owner === 'pocket');
    assert(await visible(page, '.wd-pocket canvas'), 'the pocket map is up');
    await frames(page, 2);
    await shot(page, 'walk-2-pocket');
    await page.keyboard.press('Escape');
    await until(page, () => window.__haizHome.W.owner === 'play');
    ok('M opens the pocket map at once (no camera move) and Esc closes it');
    // the full chapter 04 from where the walker stands, and back to the same spot
    const here = (await info(page)).player;
    await page.evaluate(() => window.__haizHome.life.toFullMap());
    await until(page, () => window.__haizHome.map.mode === 'map' && window.__haizHome.map.fromWalk);
    await page.evaluate(() => window.__haizHome.map.settle());
    await frames(page, 3);
    s = await info(page);
    assert(s.u === 0, 'the campus folded into the plan');
    assert(await visible(page, '.cmap-you'), 'the plan marks where the walker stood');
    assert(await visible(page, '[data-act="walk-back"]'), 'a way back to the walk');
    await shot(page, 'walk-3-fullmap');
    await page.click('[data-act="walk-back"]');
    await page.evaluate(() => window.__haizHome.map.settle());
    await until(page, () => window.__haizHome.W.owner === 'play');
    s = await info(page);
    assert(Math.hypot(s.player.x - here.x, s.player.z - here.z) < 0.01, 'back where the walker stood');
    assert(s.u === 1, 'the campus stands again');
    ok('the full 04 opens from the walker\'s spot (the campus folds to the plan, the spot is marked) and returns to the same spot with the campus standing');
    // the menu: no interface keeps a handle; body off; back to 06
    await page.keyboard.press('Escape');
    await until(page, () => window.__haizHome.W.owner === 'menu');
    await page.click('[data-w="noui"]');
    await until(page, () => window.__haizHome.W.owner === 'play' && document.body.classList.contains('wd-noui'));
    assert(await visible(page, '.wd-handle'), 'with the interface hidden, the menu handle remains');
    assert(!(await visible(page, '.wd-top')), 'the interface is hidden');
    await page.click('.wd-handle');
    await until(page, () => window.__haizHome.W.owner === 'menu');
    await page.click('[data-w="noui"]');
    await page.keyboard.press('KeyB');
    await frames(page, 2);
    s = await page.evaluate(() => ({ body: window.__haizHome.W.hud.body, vis: window.__haizHome.world.scene.getObjectByName('walker-group').visible }));
    assert(!s.body && !s.vis, 'B hides the body (separately from the interface)');
    await page.keyboard.press('KeyB');
    await page.keyboard.press('Escape');
    await until(page, () => window.__haizHome.W.owner === 'menu');
    await page.click('[data-w="back6"]');
    await until(page, () => window.__haizHome.W.owner === 'hold');
    s = await info(page);
    assert(Math.abs(s.p - 5) < 1e-3, 'back at 06');
    assert(await visible(page, '.wd-resume'), 'a way back to where the walker stood');
    ok('menu: hiding the interface leaves a handle; B hides the body on its own; back to 06 flies there and offers the way back to the spot');
    // from 06 the film scrolls back: owner scroll, the page scrolls again
    await page.mouse.wheel(0, -300);
    await until(page, () => window.__haizHome.W.owner === 'scroll' && window.__haizHome.state.p < 4.99);
    ok('from 06 the scroll goes back into the film (the walk no longer has the input)');
    await ctx.close();
  }

  if (run('phone')) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    watch(page);
    await page.goto(base + '/index.html?quality=low&test=1&compose=b');
    await ready(page);
    await page.evaluate(() => window.__haizHome.go(5));
    await until(page, () => window.__haizHome.W.owner === 'hold');
    await frames(page, 2);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert(over <= 0, 'no sideways overflow');
    await shot(page, 'phone-0-hold');
    await page.waitForTimeout(700);
    await page.tap('.wd-go');
    await until(page, () => window.__haizHome.life.ceremony());
    assert(await visible(page, '.wd-rotate-card'), 'the turn-sideways step is offered');
    await frames(page, 2);
    await shot(page, 'phone-1-rotate');
    await page.tap('[data-w="portrait"]');
    await until(page, () => window.__haizHome.W.owner === 'play');
    // a real touch drag on the left half: the joystick walks
    const p0 = (await info(page)).player;
    const cdp = await ctx.newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    await touch('touchStart', 90, 640);
    for (let i = 1; i <= 6; i++) await touch('touchMove', 90, 640 - i * 12);
    await page.waitForTimeout(1500);
    await touch('touchEnd', 90, 568);
    await frames(page, 2);
    const p1 = (await info(page)).player;
    const d = Math.hypot(p1.x - p0.x, p1.z - p0.z);
    assert(d > 0.15, 'the left-thumb joystick walks (' + d.toFixed(2) + ' m)');
    assert(await visible(page, '[data-w="map"]') && await visible(page, '[data-w="menu"]'), 'map and menu are in reach without a keyboard');
    await shot(page, 'phone-2-walk');
    ok(`phone 390×844: no overflow; the step at 06 offers turning sideways (declinable); a real touch drag on the left walks ${d.toFixed(2)} m; map and menu are buttons`);
    await ctx.close();
  }

  if (run('history')) {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
    const page = await ctx.newPage();
    watch(page);
    await page.goto(base + '/index.html?quality=low&test=1&compose=b');
    await ready(page);
    await page.evaluate(() => window.__haizHome.go(5));
    await until(page, () => window.__haizHome.W.owner === 'hold');
    await page.evaluate(() => window.__haizHome.life.handoff());
    await until(page, () => window.__haizHome.W.owner === 'play');
    await page.evaluate(() => window.__haizHome.life.simulate(['f'], 2));
    await page.goBack();
    await until(page, () => window.__haizHome.W.owner === 'hold');
    ok('Back from the walk returns to 06');
    await page.evaluate(() => window.__haizHome.life.handoff({ resume: true }));
    await until(page, () => window.__haizHome.W.owner === 'play');
    await page.reload();
    await ready(page);
    await until(page, () => window.__haizHome.W.owner === 'hold');
    assert(await visible(page, '.wd-resume'), 'after a reload in the walk, 06 offers the way back to the spot');
    ok('a reload in the walk lands at 06 with “回到上次站的地方”');
    await ctx.close();
  }

  if (run('compose')) {
    for (const id of ['a', 'c']) {
      const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
      const page = await ctx.newPage();
      watch(page);
      await page.goto(base + `/index.html?quality=low&test=1&compose=${id}`);
      await ready(page);
      await page.evaluate(() => window.__haizHome.go(4));
      await frames(page, 2);
      const u4 = await page.evaluate(() => window.__haizHome.map.u);
      await page.evaluate(() => window.__haizHome.go(5));
      await until(page, () => window.__haizHome.W.owner === 'hold');
      const u6 = await page.evaluate(() => window.__haizHome.map.u);
      await page.evaluate(() => window.__haizHome.life.handoff());
      await until(page, () => window.__haizHome.W.owner === 'play');
      const msg = await page.evaluate(() => document.querySelector('.wd-live').textContent);
      if (id === 'a') { assert(u4 === 0 && u6 === 1, 'a: no campus at 05, standing at 06'); assert(!/已移到/.test(msg), 'a: the walk starts where the film ends'); }
      else { assert(u4 === 0 && u6 === 0, 'c: no campus in the film'); assert(/已移到/.test(msg), 'c: the film ends inside 一号教学楼; the walk has to move the walker'); }
      ok(`composition ${id}: campus at 05 ${u4}, at 06 ${u6}; ${id === 'c' ? 'the walk had to move the walker out of 一号教学楼 (' + msg + ')' : 'the walk starts where the film ends'}`);
      await ctx.close();
    }
  }

  await browser.close();
  server.close();
  const fatal = errors.filter((e) => !/WEBGL_debug|GPU stall|swiftshader/i.test(e));
  console.log(fatal.length ? 'page errors:\n' + fatal.join('\n') : 'no page or WebGL errors');
  fs.writeFileSync(path.join(__dirname, 'world-browser-results.json'), JSON.stringify({ date: new Date().toISOString(), results, errors: fatal }, null, 2));
  if (fatal.length) process.exit(1);
})().catch((e) => { console.error(e); server.close(); process.exit(1); });

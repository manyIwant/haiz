// Real-browser checks for the seventh view (lanren/seventh), in Chromium (SwiftShader here).
//
//   default   (no flag) nothing of it is there: no module, no interface, no shade proxy, the atmosphere's
//             new terms at zero
//   seventh   (?seventh=1) from 06's hold the view can be entered; at the seat the camera is on the sun's ray
//             and looks down it; a lean takes it off the ray by that angle; leaving gives 06's hold back with
//             V4's own lens; "back to the first act" ends at 01's standpoint, at 01's instant, with the
//             six-shot film in charge again
//
// usage: node tests/seventh-browser.cjs [default] [seventh]
// Software rendering only: this checks state and geometry, not frame rate, not a GPU, not Safari, not a phone.
const { chromium } = require('playwright');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const serve = () => new Promise((res) => {
  const s = http.createServer((req, rsp) => {
    const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    fs.readFile(p, (err, buf) => { if (err) { rsp.writeHead(404); rsp.end(); return; } rsp.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); rsp.end(buf); });
  }).listen(0, () => res(s));
});
const want = process.argv.slice(2);
const run = (k) => !want.length || want.includes(k);

(async () => {
  const server = await serve();
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const results = [], errors = [];
  const ok = (m) => { results.push(m); console.log('✓ ' + m); };
  async function open(qs) {
    const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(qs + ': ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/GPU stall|swiftshader|Automatic fallback|favicon|ERR_|Failed to load resource/i.test(m.text())) errors.push(qs + ': ' + m.text()); });
    await page.goto(`http://localhost:${port}/index.html?capture=1&quality=${process.env.Q || 'medium'}${qs}`);
    await page.waitForFunction(() => window.__haizHome && window.__haizHome.world && document.body.classList.contains('ready') && window.__haizHome.life && window.__haizHome.map, null, { timeout: 240000 });
    return { page, ctx };
  }
  // (the page is paused: every step is frames of dt seconds; few frames, software rendering is slow)
  const ev = (page, f, a) => page.evaluate(f, a);

  if (run('default')) {
    const { page, ctx } = await open('');
    const r = await ev(page, () => {
      const h = window.__haizHome; h.go(5); h.still(0.2, 10);
      const a = h.world.atmosphere.uniforms;
      return { seventh: h.seventh === undefined, dom: !document.querySelector('.sv'), proxy: !h.world.scene.getObjectByName('school-shade'), skip: a.uSkip.value, oppose: a.uOppose.value, shade: a.uShade.value, cull: h.W.cull === undefined, clock: h.clock === null, near: h.world.camera.near, far: h.world.camera.far };
    });
    assert(r.seventh && r.dom && r.proxy && r.cull, 'without the flag nothing of the seventh view exists: ' + JSON.stringify(r));
    assert(r.skip === 0 && r.oppose === 0 && r.shade === 0 && r.clock, 'the atmosphere is V4\'s own: ' + JSON.stringify(r));
    ok('default (no flag): no module, no interface, no shade proxy, no culling hook; the atmosphere\'s new terms are 0; V4\'s light (no clock)');
    await ctx.close();
  }

  if (run('seventh')) {
    const { page, ctx } = await open('&seventh=1');
    await page.waitForFunction(() => !!window.__haizHome.seventh, null, { timeout: 60000 });
    // 06, the evening gone to its last light
    const hold = await ev(page, () => { const h = window.__haizHome; h.go(5); h.still(0.2, 10); h.still(90, 0.034); return { owner: h.W.owner, sunEl: h.clock.at(5).sunEl, cam: h.world.camera.position.toArray(), fov: h.world.camera.fov }; });
    assert(hold.owner === 'hold' && hold.sunEl < 4.6, '06 held to the last light: ' + JSON.stringify(hold));
    // in
    const seat = await ev(page, () => {
      const h = window.__haizHome, okIn = h.seventh.enter();
      h.seventh.set({ u: 1 }); h.still(0.2, 10);
      const c = h.world.camera, d = c.getWorldDirection(new c.position.constructor()).toArray();
      const s = h.seventh.state, a = h.world.atmosphere.uniforms;
      const D = Math.PI / 180, sun = [Math.sin(s.sunAz * D) * Math.cos(s.sunEl * D), Math.sin(s.sunEl * D), Math.cos(s.sunAz * D) * Math.cos(s.sunEl * D)];
      return { okIn, owner: h.W.owner, on: s.on, label: s.label, off: Math.acos(Math.min(1, -(d[0] * sun[0] + d[1] * sun[1] + d[2] * sun[2]))) / D, fov: c.fov, dist: h.seventh.camera.dist, skip: a.uSkip.value, line: h.seventh.line(), cls: document.body.className,
        shots: h.seventh.shots.map((x) => x.seen), body: h.life.figure.group.visible && !h.life.figure.firstPerson, sceneSun: h.sun };
    });
    assert(seat.okIn && seat.owner === 'seventh' && seat.on, 'the view is entered from the hold: ' + JSON.stringify(seat));
    assert(seat.off < 0.01 && seat.fov < 0.2 && seat.dist > 19000 && seat.skip > 19000, `at the seat the camera looks down the sun's ray: ${seat.off.toFixed(4)}° off it, lens ${seat.fov.toFixed(3)}°`);
    assert(Math.abs(seat.sceneSun.el - 4.4) < 0.1, 'the scene\'s sun is the instant\'s: ' + JSON.stringify(seat.sceneSun));
    assert(seat.body, 'the walker stands where the film left them, seen whole');
    assert(JSON.stringify(seat.shots) === JSON.stringify([false, false, false, true, true, true]), 'the six shots as the light saw them: ' + seat.shots);
    assert(/sv-on/.test(seat.cls) && seat.line.length > 8, 'the interface is the seat\'s: ' + seat.line);
    ok(`seat: entered from 06's hold at ${seat.label}; the camera is ${seat.off.toFixed(4)}° off the sun's ray, ${(seat.dist / 1000).toFixed(0)} km out, lens ${seat.fov.toFixed(3)}°; the walker is seen whole; shots 01–03 unseen by the sun, 04–06 seen`);
    // a lean
    const lean = await ev(page, () => {
      const h = window.__haizHome; h.seventh.set({ lean: [0.2, 0] }); h.still(0.1, 10);
      const c = h.world.camera, d = c.getWorldDirection(new c.position.constructor()).toArray(), s = h.seventh.state, D = Math.PI / 180;
      const sun = [Math.sin(s.sunAz * D) * Math.cos(s.sunEl * D), Math.sin(s.sunEl * D), Math.cos(s.sunAz * D) * Math.cos(s.sunEl * D)];
      const off = Math.acos(Math.min(1, -(d[0] * sun[0] + d[1] * sun[1] + d[2] * sun[2]))) / D;
      h.seventh.set({ lean: null });
      return { off, line: h.seventh.line() };
    });
    assert(Math.abs(lean.off - 0.2 * 180 / Math.PI) < 0.6, 'a lean of 0.2 rad is ' + lean.off.toFixed(2) + '° out of the light');
    ok(`lean: 0.2 rad of drag is ${lean.off.toFixed(1)}° out of the light (“${lean.line}”)`);
    // the instant: noon of the last day looks straight down
    const noon = await ev(page, () => { const h = window.__haizHome, n = h.seventh.noon(); h.seventh.set({ doy: n.doy, minutes: n.minutes }); h.still(0.1, 10); const c = h.world.camera, d = c.getWorldDirection(new c.position.constructor()).toArray(); return { label: h.seventh.state.label, el: h.seventh.state.sunEl, down: -d[1], grow: h.info().grow, line: h.seventh.line() }; });
    assert(noon.el > 88.5 && noon.down > 0.9995 && noon.grow === 1, 'noon of the last day: ' + JSON.stringify(noon));
    ok(`instant: ${noon.label}, the sun ${noon.el.toFixed(2)}° up; the seat looks straight down (“${noon.line.slice(0, 12)}…”)`);
    // 01's instant: the tree bare of new leaves, the campus standing
    const dawn = await ev(page, () => { const h = window.__haizHome, s = h.seventh.shots[0]; h.seventh.set({ doy: s.doy, minutes: s.minutes }); h.still(0.1, 10); return { label: h.seventh.state.label, grow: h.info().grow, line: h.seventh.line(), sun: h.sun }; });
    assert(dawn.grow === 0 && /看不见第一幕/.test(dawn.line), '01\'s instant from the seat: ' + JSON.stringify(dawn));
    ok(`instant: ${dawn.label} from the seat: growth ${dawn.grow}; “${dawn.line}”`);
    // out, to the hold
    const back = await ev(page, () => { const h = window.__haizHome; h.seventh.leave('hold'); h.still(16, 0.25); const c = h.world.camera, a = h.world.atmosphere.uniforms; return { owner: h.W.owner, on: h.seventh.state.on, near: c.near, far: c.far, up: c.up.toArray(), skip: a.uSkip.value, oppose: a.uOppose.value, cam: c.position.toArray(), cls: document.body.className, sunEl: h.clock.at(5).sunEl }; });
    assert(back.owner === 'hold' && !back.on && back.near === 0.08 && back.far === 1200 && back.up[1] === 1 && back.skip === 0 && back.oppose === 0 && !/sv-on/.test(back.cls), 'leaving gives 06\'s hold back, with V4\'s own lens: ' + JSON.stringify(back));
    assert(Math.hypot(back.cam[0] - hold.cam[0], back.cam[1] - hold.cam[1], back.cam[2] - hold.cam[2]) < 0.2 && Math.abs(back.sunEl - hold.sunEl) < 0.05, 'the eye is back in the walker\'s head, in the same evening');
    ok('out: 06\'s hold again, the eye back in the walker\'s head, the same evening, V4\'s near and far planes, the atmosphere\'s terms at 0');
    // in again, and down to the first act
    const first = await ev(page, () => {
      const h = window.__haizHome; h.seventh.enter(); h.seventh.set({ u: 1 }); h.seventh.leave('first'); h.still(28, 0.25);
      const c = h.world.camera;
      return { owner: h.W.owner, on: h.seventh.state.on, p: h.state.p, y: scrollY, cam: c.position.toArray(), sun: h.sun, slate: document.querySelector('.orbit .when')?.textContent || '', grow: h.info().grow, proxy: h.seventh.proxy, cull: h.W.cull({ index: 0 }) };
    });
    assert(first.owner === 'scroll' && !first.on && first.p === 0 && first.y === 0, 'the six-shot film has the camera again, at its first frame: ' + JSON.stringify(first));
    assert(Math.hypot(first.cam[0] - hold.cam[0], first.cam[2] - hold.cam[2]) < 0.3, '01 is seen from where 06 was seen from');
    assert(/2月24日/.test(first.slate) && first.grow === 0 && Math.abs(first.sun.el - 7.9) < 0.2, 'at 01\'s instant: ' + first.slate);
    assert(first.proxy.visible && first.proxy.scale === 1 && first.cull === false, 'the school\'s shade stands with the school in 01; nothing is left out of the picture');
    ok(`back to the first act: owner scroll, p 0, the eye where 06 stood, ${first.slate}; 一号教学楼's shade is on the tree`);
    await ctx.close();
  }

  await browser.close(); server.close();
  if (errors.length) { console.error('page errors:\n' + errors.join('\n')); process.exit(1); }
  // (a partial run keeps the other part's last results: the two parts take minutes each in software rendering)
  const out = path.join(__dirname, 'seventh-browser-results.json');
  let prev = {}; try { prev = JSON.parse(fs.readFileSync(out, 'utf8')).results || {}; } catch { /* first run */ }
  const mine = { default: results.filter((r) => r.startsWith('default')), seventh: results.filter((r) => !r.startsWith('default')) };
  for (const k of ['default', 'seventh']) if (!run(k) || !mine[k].length) mine[k] = prev[k] || [];
  fs.writeFileSync(out, JSON.stringify({ renderer: 'Chromium + SwiftShader (software); no GPU, no Safari, no device', results: mine }, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });

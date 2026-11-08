// Chapter 02 · 根脉 in a real browser (Chromium; SwiftShader in CI): scroll into the climb,
// find a year, read it, come back to the same shot, skip on to 03, deep links, phone, no-3D.
const assert = require('node:assert');
const { chromium, devices } = require('playwright');
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
const shots = process.env.ROOTS_SHOTS;   // optional folder for review captures

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const results = [];
  const errors = [];
  const T = { timeout: 240000 };
  const watch = (page) => {
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  };
  const open = async (ctx) => { const pg = await ctx.newPage(); pg.setDefaultTimeout(240000); pg.setDefaultNavigationTimeout(240000); watch(pg); return pg; };
  const ready = (page) => page.waitForFunction(() => document.body.classList.contains('ready') && window.__haizHome.roots, null, T);
  const R = (page, fn) => page.evaluate(fn);

  // ---------------------------------------------------------------- desktop
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  let page = await open(ctx);
  await page.goto(base + '/index.html?quality=low&test=1');
  await ready(page);
  const geo = await R(page, () => ({ stop: document.getElementById('roots').offsetHeight, ih: innerHeight, next: document.getElementById('leaves').offsetTop - document.getElementById('roots').offsetTop,
    found: window.__haizHome.roots.found.filter((f) => f && f.missed).length }));
  assert(geo.stop > geo.ih * 6, 'chapter 02 has its own long stretch of scroll: ' + geo.stop);
  assert(geo.found <= 1, 'stations find the bark or ground they light: ' + geo.found + ' missed');
  results.push(`02 has ${(geo.stop / geo.ih).toFixed(1)} screens of scroll; ${geo.found} station(s) light the leaves without a bark point`);

  // the camera never enters the bark, the rock or the ground
  const clear = await R(page, async () => {
    const THREE = await import('three');
    const w = window.__haizHome.world, ray = new THREE.Raycaster();
    const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [0.7, 0.7, 0], [-0.7, 0.7, 0], [0, 0.7, 0.7], [0, 0.7, -0.7]].map((d) => new THREE.Vector3(...d).normalize());
    let worst = 9, at = 0;
    for (let p = 1.002; p < 2; p += 0.01) {
      window.__haizHome.seek(p);
      window.__haizHome.still(0.05, 20);
      const e = w.camera.position.clone();
      for (const d of dirs) {
        ray.set(e, d); ray.far = 2;
        const h = ray.intersectObjects([w.bark, w.island], false)[0];
        if (h && h.distance < worst) { worst = h.distance; at = p; }
      }
    }
    return { worst: +worst.toFixed(3), at: +at.toFixed(3) };
  });
  assert(clear.worst > 0.2, 'camera keeps clear of bark and rock: ' + JSON.stringify(clear));
  results.push(`camera rail clear of bark, rock and ground (nearest ${clear.worst} m at p ${clear.at})`);

  // native scroll: from 01 into 02, then on into the climb (a fresh page: still() above paused the loop)
  await page.close();
  page = await open(ctx);
  await page.goto(base + '/index.html?quality=low&test=1');
  await ready(page);
  await R(page, () => window.scrollTo(0, document.getElementById('roots').offsetTop));
  await page.waitForFunction(() => window.__haizHome.info().active === 1, null, T);
  assert.match(await R(page, () => location.hash), /#roots/);
  results.push('native scroll 01 → 02 opens 根脉 at the foot of the trunk (#roots)');
  await page.click('#p-roots [data-action="roots-climb"]');
  await page.waitForFunction(() => window.__haizHome.roots.current === '1923' && document.querySelector('.roots-cap.on'), null, T);
  await page.waitForFunction(() => document.body.classList.contains('roots-on') && getComputedStyle(document.querySelector('.roots-find')).opacity > 0.9, null, T);
  assert.strictEqual(await R(page, () => window.__haizHome.info().active), -1, 'no chapter panel over the climb');
  results.push('「沿树干向上」 climbs to 1923: words beside the bark, year finder up, panels away');
  if (shots) await page.screenshot({ path: path.join(shots, 'desktop-1923.png') });

  // the year finder jumps; the light on the tree follows
  await page.click('.roots-find button[aria-label^="1988"]');
  await page.waitForFunction(() => window.__haizHome.roots.current === '1988' && Math.abs(window.__haizHome.state.p - (1 + 8 / 14)) < 0.004, null, T);
  await page.waitForFunction(() => window.__haizHome.roots.slots.some((s) => s.node === '1988' && s.I > 1), null, T);
  await page.waitForFunction(() => location.hash === '#roots/1988', null, T);
  results.push('year finder → 1988: the camera travels there, its photograph lights the tree, address #roots/1988');

  // reading: the page holds still, the sheet shows the photograph whole and its sources
  const y0 = await R(page, () => scrollY);
  await page.click('.roots-open');
  await page.waitForSelector('.roots-sheet[open]', T);
  await page.mouse.wheel(0, 900);
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(600);
  const sheet = await R(page, () => {
    const d = document.querySelector('.roots-sheet'), img = d.querySelector('figure img');
    return { y: scrollY, locked: document.documentElement.classList.contains('roots-reading'), title: d.querySelector('h2').textContent,
      img: img && { w: img.naturalWidth, h: img.naturalHeight, fit: getComputedStyle(img).objectFit, shown: img.getBoundingClientRect().width },
      sources: d.querySelectorAll('.roots-src li').length, credit: d.querySelector('figcaption')?.textContent || '' };
  });
  assert.strictEqual(sheet.y, y0, 'the walk does not move while reading');
  assert(sheet.locked && /海南中学/.test(sheet.title));
  assert(sheet.img && sheet.img.w > 0 && sheet.img.fit !== 'cover', 'photograph shown whole');
  assert(sheet.sources >= 2 && /待确认/.test(sheet.credit), 'sources and honest credit');
  if (shots) await page.screenshot({ path: path.join(shots, 'desktop-sheet-1988.png') });
  // next / previous inside the sheet; then close with Esc
  await page.click('.roots-sheet [data-step="1"]');
  await page.waitForFunction(() => /九十年/.test(document.querySelector('.roots-sheet h2').textContent), null, T);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.roots-sheet[open]') && !document.documentElement.classList.contains('roots-reading'), null, T);
  await page.waitForFunction(() => window.__haizHome.roots.current === '2013', null, T);
  results.push('reading 1988: scroll locked, photograph uncropped with credit, ≥2 sources; next → 2013; Esc returns to the 2013 shot');

  // list mode (the no-film reading path)
  await page.click('.roots-list');
  await page.waitForSelector('.roots-sheet[open] .roots-s-list', T);
  const listN = await R(page, () => document.querySelectorAll('.roots-s-list button').length);
  assert.strictEqual(listN, await R(page, () => window.__haizHome.roots.nodes.length));
  await page.click('.roots-s-list button[data-node="1950"]');
  await page.waitForFunction(() => /广东海南中学/.test(document.querySelector('.roots-sheet h2').textContent), null, T);
  await page.click('.roots-close');
  await page.waitForFunction(() => window.__haizHome.roots.current === '1950', null, T);
  results.push(`「全部年代」 lists all ${listN} stations; choosing 1950 reads it and leaves the camera there`);

  // skip straight on to 03
  await page.click('.roots-skip');
  await page.waitForFunction(() => window.__haizHome.info().active === 2, null, T);
  await page.waitForFunction(() => !document.body.classList.contains('roots-on'), null, T);
  assert.match(await R(page, () => location.hash), /#leaves/);
  const film = await R(page, () => window.__haizHome.world.composer.passes.filter((p) => p.enabled).length);
  results.push('「跳过」 goes straight on to 03 (the leaves); the film grade is off outside 02 (' + film + ' passes)');

  // the orbit navigator still reaches every chapter directly; 04's map is untouched
  await page.click('#orbitDots .dot:nth-of-type(4)');
  await page.waitForFunction(() => window.__haizHome.info().active === 3, null, T);
  await page.click('#orbitDots .dot:nth-of-type(2)');
  await page.waitForFunction(() => window.__haizHome.info().active === 1 && Math.abs(window.__haizHome.state.p - 1) < 0.01, null, T);
  results.push('orbit navigator: 03 → 04 → back to 02 lands on the foot of the trunk');
  await ctx.close();

  // ---------------------------------------------------------------- deep link, and coming back from a page
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const p2 = await open(ctx2);
  await p2.goto(base + '/index.html?quality=low&test=1#roots/gate-old');
  await ready(p2);
  await p2.waitForFunction(() => window.__haizHome.roots.current === 'gate-old', null, T);
  results.push('#roots/gate-old opens straight at the old photograph');
  await p2.goto(base + '/index.html?quality=low&test=1#campus');
  await ready(p2);
  await p2.waitForFunction(() => window.__haizHome.info().active === 1 || window.__haizHome.roots.current, null, T);
  results.push('the former address #campus still opens chapter 02');
  await ctx2.close();

  // ---------------------------------------------------------------- reduced motion
  const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const p3 = await open(ctx3);
  await p3.goto(base + '/index.html?quality=low&test=1#roots');
  await ready(p3);
  await p3.waitForFunction(() => window.__haizHome.info().active === 1, null, T);
  await p3.evaluate(() => window.__haizHome.roots.goStation(11));
  await p3.waitForFunction(() => window.__haizHome.roots.current === '2023', null, T);
  const calm = await p3.evaluate(() => ({ p: window.__haizHome.state.p, move: window.__haizHome.world.composer.passes.find((x) => x.uniforms?.uMove)?.uniforms.uMove.value }));
  assert(Math.abs(calm.p - (1 + 11 / 14)) < 2e-3, 'reduced motion: jumps without travelling: ' + calm.p);
  assert.strictEqual(calm.move, 0, 'reduced motion: no film weave or flicker');
  results.push('reduced motion: a year is reached at once; no gate weave or flicker');
  await ctx3.close();

  // ---------------------------------------------------------------- phone (touch, portrait)
  const ctx4 = await browser.newContext({ ...devices['iPhone 13'] });
  const p4 = await open(ctx4);
  await p4.goto(base + '/index.html?quality=low&test=1#roots');
  await ready(p4);
  await p4.waitForFunction(() => window.__haizHome.info().active === 1, null, T);
  await p4.tap('#p-roots [data-action="roots-climb"]');
  await p4.waitForFunction(() => window.__haizHome.roots.current === '1923' && document.querySelector('.roots-cap.on'), null, T);
  await p4.waitForFunction(() => !document.querySelector('.roots-cap').getAnimations().length, null, T);   // the words finish rising
  const phone = await p4.evaluate(() => {
    const f = document.querySelector('.roots-find').getBoundingClientRect(), c = document.querySelector('.roots-cap').getBoundingClientRect();
    return { fBottom: f.bottom, fTop: f.top, cBottom: c.bottom, w: innerWidth, h: innerHeight, scrollW: document.documentElement.scrollWidth };
  });
  assert(phone.fBottom <= phone.h && phone.fTop > phone.h * 0.75, 'finder sits at the bottom: ' + JSON.stringify(phone));
  assert(phone.cBottom <= phone.fTop + 2, 'words above the finder: ' + JSON.stringify(phone));
  assert(phone.scrollW <= phone.w, 'no sideways page scroll');
  if (shots) await p4.screenshot({ path: path.join(shots, 'phone-1923.png') });
  await p4.tap('.roots-find button[aria-label^="1953—1988"]');
  await p4.waitForFunction(() => window.__haizHome.roots.current === 'gate-old' && document.querySelector('.roots-cap.on'), null, T);
  await p4.tap('.roots-open');
  await p4.waitForSelector('.roots-sheet[open]', T);
  await p4.waitForFunction(() => !document.querySelector('.roots-sheet').getAnimations().length, null, T);   // the sheet finishes rising
  const ps = await p4.evaluate(() => { const r = document.querySelector('.roots-sheet').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: innerHeight, w: r.width, iw: innerWidth }; });
  assert(ps.bottom <= ps.h + 1 && ps.top > 0 && Math.abs(ps.w - ps.iw) < 2, 'bottom sheet on the phone: ' + JSON.stringify(ps));
  if (shots) await p4.screenshot({ path: path.join(shots, 'phone-sheet.png') });
  await p4.tap('.roots-close');
  await p4.waitForFunction(() => !document.querySelector('.roots-sheet[open]'), null, T);
  results.push('phone: finder along the bottom, words above it, no sideways scroll; tap a year, read it in a bottom sheet, close');
  await ctx4.close();

  // ---------------------------------------------------------------- no 3D: the history is still all there
  const ctx5 = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  const p5 = await open(ctx5);
  await p5.goto(base + '/index.html?static');
  await p5.waitForFunction(() => document.body.classList.contains('static'), null, T);
  const st = await p5.evaluate(() => { const l = document.querySelector('.roots-static'); return { n: l.querySelectorAll('li').length, shown: l.getBoundingClientRect().height > 200 }; });
  assert(st.n >= 10 && st.shown, 'static reading list: ' + JSON.stringify(st));
  results.push(`without 3D: chapter 02 is a plain reading list of ${st.n} sourced stations`);
  await ctx5.close();

  assert.deepStrictEqual(errors, [], 'no page errors');
  await browser.close();
  server.close();
  console.log('roots (browser):\n- ' + results.join('\n- '));
})().catch((e) => { console.error(e); process.exit(1); });

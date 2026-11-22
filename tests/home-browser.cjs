// Real-browser checks for the tree homepage (Chromium; SwiftShader in CI).
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

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const results = [];
  const errors = [];
  const ready = (page) => page.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 240000 });

  // ---- desktop: scroll, orbit navigator, keyboard, catching a leaf, leaving and returning
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(base + '/index.html?quality=low&test=1');
  await ready(page);
  const active = () => page.evaluate(() => window.__haizHome.info().active);
  assert.strictEqual(await active(), 0);
  assert.strictEqual(await page.locator('.panel.is-active').getAttribute('id'), 'p-tree');
  // native scroll drives the walk (GSAP ScrollTrigger scrub + snap)
  await page.evaluate(() => window.scrollTo(0, document.getElementById('leaves').offsetTop));
  await page.waitForFunction(() => window.__haizHome.info().active === 2, null, { timeout: 180000 });
  const g2 = await page.evaluate(() => window.__haizHome.info().grow);
  assert(g2 > 0.4 && g2 < 0.6, 'growth follows the walk: ' + g2);
  assert.match(await page.evaluate(() => location.hash), /#leaves/);
  results.push(`native scroll to 03 青春 · 生长 activates the details shot (#leaves), growth ${g2.toFixed(2)}`);
  // the orbit navigator jumps to a viewpoint
  await page.click('#orbitDots .dot:nth-of-type(5)');
  await page.waitForFunction(() => window.__haizHome.info().active === 4, null, { timeout: 180000 });
  results.push('path navigator station walks to 05 日子 · 创作 (looking forward)');
  // keyboard: End reaches the last viewpoint
  await page.keyboard.press('End');
  await page.waitForFunction(() => window.__haizHome.info().active === 5, null, { timeout: 180000 });
  const g5 = await page.evaluate(() => window.__haizHome.info().grow);
  assert(g5 > 0.97, 'full leaf at the end: ' + g5);
  results.push('End key walks to 06 工具 · 全部 in full leaf');
  // a falling leaf can be caught and kept. The leaf is placed in front of the camera, so the
  // camera must have arrived first: End only switches the section, and on a slow software
  // renderer the flight to 06 is still under way, which moves the leaf off the click point.
  await page.waitForFunction(() => Math.abs(window.__haizHome.info().p - 5) < 1e-3, null, { timeout: 180000 });
  const pos = await page.evaluate(() => {
    const w = window.__haizHome.world, cam = w.camera;
    const p = cam.position.clone().add(cam.getWorldDirection(cam.position.clone()).multiplyScalar(6)); p.y += 0.8;
    w.litter.falling.length = 0;
    const L = w.litter.release(p, 0.8, 0.2, true); L.slow = 0.01;
    const v = L.p.clone().project(cam);
    return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight];
  });
  const camBefore = await page.evaluate(() => window.__haizHome.info().cam);
  await page.mouse.click(pos[0], pos[1]);
  try {
    await page.waitForSelector('#specimen[open]', { timeout: 60000 });
  } catch (e) {
    const diag = await page.evaluate(() => {
      const w = window.__haizHome.world, info = window.__haizHome.info();
      return { info, falling: w.litter.falling.length, leaf: w.litter.falling.map((L) => L.slow === 0.01 && L.p.toArray().map((n) => +n.toFixed(2))).filter(Boolean) };
    }).catch((err) => 'page not inspectable: ' + err.message.split('\n')[0]);
    console.error('[home-browser] leaf not caught', JSON.stringify({ clickedAt: pos.map(Math.round), camBefore, page: diag, errors }, null, 1));
    throw e;
  }
  await page.fill('#specNote', '测试：那天有风');
  await page.click('#specKeep');
  assert.strictEqual(await page.textContent('#bookCount'), '1');
  results.push('a falling leaf is caught, annotated and kept in the book');
  // an entry leaves through the veil; coming back returns to that viewpoint
  await page.evaluate(() => window.scrollTo(0, document.getElementById('leaves').offsetTop));
  await page.waitForFunction(() => window.__haizHome.info().active === 2, null, { timeout: 180000 });
  // the camera has arrived (not just entered the section) before the slab is clicked
  await page.waitForFunction(() => Math.abs(window.__haizHome.info().p - 2) < 1e-3, null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  // Timeline of the exit (printed on success too) so a timeout says which phase stalled:
  // the click itself, the veil animation before location.href, or news.html's load event.
  const exitT0 = Date.now(), exitLog = [], pending = new Map();
  const mark = (what) => exitLog.push(`${((Date.now() - exitT0) / 1000).toFixed(1)}s ${what}`);
  const onNav = (f) => { if (f === page.mainFrame()) mark('navigated ' + f.url().replace(base, '')); };
  const onReq = (r) => pending.set(r, r.url().replace(base, '')), onDone = (r) => pending.delete(r);
  page.on('framenavigated', onNav); page.on('request', onReq); page.on('requestfinished', onDone); page.on('requestfailed', onDone);
  await page.evaluate(() => {
    const a = document.querySelector('#p-leaves a[href="news.html"]');
    window.__exitTrace = [];
    const t0 = performance.now(), note = (w) => window.__exitTrace.push(`${((performance.now() - t0) / 1000).toFixed(1)}s ${w}`);
    a.addEventListener('click', (e) => note(`click on ${e.target.tagName} spatial=${document.body.classList.contains('spatial')}`), true);
    addEventListener('beforeunload', () => note('beforeunload'));
  });
  try {
    await Promise.all([
      // Budget measured on GitHub's runner (#89, SwiftShader): click 68 s, veil + 'map' exit flight
      // until location.href 81 s more, i.e. navigation at ~150 s; the old 120 s limit cut it off.
      // 'commit' is the navigation this step is about; news.html's own load is covered by site tests.
      page.waitForURL(/news\.html$/, { timeout: 300000, waitUntil: 'commit' }).then(() => mark('navigation to news.html committed')),
      page.click('#p-leaves a[href="news.html"]', { noWaitAfter: true, timeout: 90000 }).then(() => mark('click returned')),
    ]);
  } catch (e) {
    const diag = await page.evaluate(() => {
      const v = document.getElementById('veil'), info = window.__haizHome && window.__haizHome.info();
      return { href: location.href, trace: window.__exitTrace, body: document.body.className, active: info && info.active, p: info && info.p,
        veil: v && { opacity: v.style.opacity, mask: v.style.maskSize, clip: v.style.clipPath, children: v.childElementCount },
        tweens: window.gsap ? window.gsap.globalTimeline.getChildren(true, true, false).length : null,
        specimenOpen: !!document.querySelector('#specimen[open]') };
    }).catch((err) => 'page not inspectable: ' + err.message.split('\n')[0]);
    console.error('[home-browser] exit to news.html stalled', JSON.stringify({ timeline: exitLog, page: diag, pending: [...pending.values()].slice(0, 15), errors }, null, 1));
    throw e;
  }
  page.off('framenavigated', onNav); page.off('request', onReq); page.off('requestfinished', onDone); page.off('requestfailed', onDone);
  console.log('[home-browser] exit timeline: ' + exitLog.join(' · '));
  results.push('entry click draws the veil and navigates to news.html');
  await page.goto(base + '/index.html?quality=low&test=1');
  await ready(page);
  await page.waitForFunction(() => window.__haizHome.info().active === 2, null, { timeout: 180000 });
  assert.strictEqual(await page.textContent('#bookCount'), '1');
  results.push('returning restores the details shot (03) and the book (1 leaf)');
  assert.deepStrictEqual(errors, [], 'page errors: ' + errors.join(' | '));
  await ctx.close();

  // ---- static fallback: every link usable without the 3D world
  const sp = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await sp.goto(base + '/index.html?static=1');
  await sp.waitForFunction(() => document.body.classList.contains('static'));
  const visibleLinks = await sp.evaluate(() => [...document.querySelectorAll('.panel .entries a')].filter((a) => a.getBoundingClientRect().height > 0 && getComputedStyle(a.closest('.panel')).visibility === 'visible').length);
  assert(visibleLinks >= 17, 'static page shows every entry: ' + visibleLinks);
  results.push(`static fallback lists all ${visibleLinks} entries as a readable page`);
  await sp.close();

  // ---- phone
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  await mp.goto(base + '/index.html');
  await ready(mp);
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert(overflow <= 0, 'no horizontal overflow on a phone: ' + overflow);
  const tier = await mp.evaluate(() => window.__haizHome.info().tier);
  // the portrait lens shift must keep the screen's proportions (setViewOffset rewrites camera.aspect)
  await mp.evaluate(() => { window.__haizHome.go(5); window.__haizHome.still(0.1, 20); });
  const shape = await mp.evaluate(() => { const e = window.__haizHome.world.camera.projectionMatrix.elements; return { drawn: e[5] / e[0], screen: innerWidth / innerHeight }; });
  assert(Math.abs(shape.drawn / shape.screen - 1) < 0.01, `phone image keeps its proportions: drawn ${shape.drawn.toFixed(3)} vs screen ${shape.screen.toFixed(3)}`);
  results.push(`phone 390×844: no horizontal overflow, true proportions under the lens shift, tier ${tier}`);
  fs.mkdirSync(path.join(root, 'tests/artifacts/home'), { recursive: true });
  await mp.evaluate(() => { window.__haizHome.go(4); window.__haizHome.still(0.1, 20); });
  await mp.waitForTimeout(1300);
  await mp.screenshot({ path: path.join(root, 'tests/artifacts/home/phone-days.png') });
  await mctx.close();

  await browser.close();
  server.close();
  fs.writeFileSync(path.join(root, 'tests/home-browser-results.json'), JSON.stringify({ results, renderer: 'Chromium + SwiftShader (software); not a hardware frame-rate measurement' }, null, 2));
  console.log('PASS home-browser:\n- ' + results.join('\n- '));
})().catch((e) => { console.error(e); server.close(); process.exit(1); });

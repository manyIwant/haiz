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
  // a falling leaf can be caught and kept
  const pos = await page.evaluate(() => {
    const w = window.__haizHome.world, cam = w.camera;
    const p = cam.position.clone().add(cam.getWorldDirection(cam.position.clone()).multiplyScalar(6)); p.y += 0.8;
    w.litter.falling.length = 0;
    const L = w.litter.release(p, 0.8, 0.2, true); L.slow = 0.01;
    const v = L.p.clone().project(cam);
    return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight];
  });
  await page.mouse.click(pos[0], pos[1]);
  await page.waitForSelector('#specimen[open]', { timeout: 60000 });
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
  await Promise.all([page.waitForURL(/news\.html$/, { timeout: 120000 }), page.click('#p-leaves a[href="news.html"]', { noWaitAfter: true, timeout: 90000 })]);
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

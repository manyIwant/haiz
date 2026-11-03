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

  // ---- desktop: walk, keyboard, leaders, entry transition
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(base + '/index.html?quality=low');
  await ready(page);
  assert.strictEqual(await page.locator('section.chapter.is-active').count(), 1);
  assert.strictEqual(await page.locator('section.chapter.is-active').getAttribute('id'), 'now');
  // wheel walks to the next stop and settles there
  await page.mouse.move(900, 300);
  await page.mouse.wheel(0, 300);   // one short flick
  await page.waitForFunction(() => window.__haizHome.info().active === 1, null, { timeout: 60000 });
  assert.match(await page.evaluate(() => location.hash), /#roots/);
  results.push('one short wheel flick walks from 此刻 to the next stop 根 and settles (hash #roots)');
  // keyboard: End reaches the last stop, Home returns
  await page.keyboard.press('End');
  await page.waitForFunction(() => window.__haizHome.info().active === 5, null, { timeout: 60000 });
  await page.keyboard.press('Home');
  await page.waitForFunction(() => window.__haizHome.info().active === 0, null, { timeout: 60000 });
  results.push('keyboard End/Home walk to 叶 and back to 此刻');
  // spine link jumps to a stop; leader lines exist and land on screen
  await page.click('#spine [data-go="3"]');
  await page.waitForFunction(() => window.__haizHome.info().active === 3, null, { timeout: 60000 });
  await page.waitForTimeout(800);
  const leaders = await page.evaluate(() => [...document.querySelectorAll('#leaders g')].filter((g) => +g.style.opacity > 0.5).map((g) => [+g.children[1].getAttribute('cx'), +g.children[1].getAttribute('cy')]));
  assert(leaders.length >= 3, 'leader lines visible: ' + leaders.length);
  assert(leaders.every(([x, y]) => x > 0 && x < 1280 && y > 0 && y < 720), 'leader pins on screen');
  results.push(`spine jump to 枝; ${leaders.length} leader lines pinned on screen`);
  // the tree answers a tap; a gift leaf can be caught and kept
  const pos = await page.evaluate(() => {
    const H = window.__haizHome, w = H.world, cam = w.camera;
    const p = cam.position.clone().add(cam.getWorldDirection(cam.position.clone()).multiplyScalar(4));
    p.y += 0.8;
    const L = w.litter.release(p, 0.8, 0.2, true);
    L.slow = 0.02;
    const v = L.p.clone().project(cam);
    return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight];
  });
  await page.mouse.click(pos[0], pos[1]);
  await page.waitForSelector('#specimen[open]', { timeout: 30000 });
  await page.fill('#specNote', '测试：那天有风');
  await page.click('#specKeep');
  assert.strictEqual(await page.textContent('#bookCount'), '1');
  results.push('a falling leaf is caught by clicking it, annotated and kept in the book');
  // entry click: veil and navigation to the destination page
  await page.click('#spine [data-go="1"]');
  await page.waitForFunction(() => window.__haizHome.info().active === 1, null, { timeout: 60000 });
  await page.waitForTimeout(900);
  await Promise.all([page.waitForURL(/about\.html$/, { timeout: 120000 }), page.click('#roots a[href="about.html"]', { noWaitAfter: true })]);
  results.push('entry click dollies, draws the veil and navigates to about.html');
  // coming back restores the stop and the kept leaf
  await page.goto(base + '/index.html?quality=low');
  await ready(page);
  assert.strictEqual(await page.evaluate(() => window.__haizHome.info().active), 1, 'returns to the stop you left from');
  assert.strictEqual(await page.textContent('#bookCount'), '1');
  results.push('returning restores the stop (根) and the book (1 leaf)');
  assert.deepStrictEqual(errors, [], 'page errors: ' + errors.join(' | '));
  await ctx.close();

  // ---- static fallback: every link usable without the 3D world
  const sp = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await sp.goto(base + '/index.html?static=1');
  await sp.waitForFunction(() => document.body.classList.contains('static'));
  const visibleLinks = await sp.evaluate(() => [...document.querySelectorAll('.chapter .entries a')].filter((a) => a.getBoundingClientRect().height > 0 && getComputedStyle(a.closest('.chapter')).opacity === '1').length);
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
  results.push(`phone 390×844: no horizontal overflow, tier ${tier}`);
  fs.mkdirSync(path.join(root, 'tests/artifacts/home'), { recursive: true });
  await mp.evaluate(() => { window.__haizHome.go(3); window.__haizHome.still(0.1, 20); });
  await mp.waitForTimeout(1300);
  await mp.screenshot({ path: path.join(root, 'tests/artifacts/home/phone-limb.png') });
  await mctx.close();

  await browser.close();
  server.close();
  fs.writeFileSync(path.join(root, 'tests/home-browser-results.json'), JSON.stringify({ results, renderer: 'Chromium + SwiftShader (software); not a hardware frame-rate measurement' }, null, 2));
  console.log('PASS home-browser:\n- ' + results.join('\n- '));
})().catch((e) => { console.error(e); server.close(); process.exit(1); });

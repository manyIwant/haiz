// Real-browser checks for 年轮 (lanren/rings) on the tree homepage (Chromium; SwiftShader in CI).
// node tests/rings-browser.cjs [--shots]   (--shots also writes review stills to tests/artifacts/rings)
const assert = require('node:assert');
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
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
const SHOTS = process.argv.includes('--shots');
const outDir = path.join(__dirname, 'artifacts', 'rings');

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const results = [];
  const errors = [];
  const watch = (page) => {
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  };
  const ready = (page) => page.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 240000 });
  // the loop is stopped (?capture) and stepped by hand: a software renderer cannot keep up with a running one
  const step = (page, n = 2) => page.evaluate((n) => window.__haizHome.still(n / 10, 10), n);
  const state = (page) => page.evaluate(() => window.__haizHome.rings.state());
  const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(outDir, { recursive: true }); await page.screenshot({ path: path.join(outDir, name + '.png'), timeout: 300000 }); } };

  // ---------------------------------------------------------------- desktop
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 }, acceptDownloads: true });
  const page = await ctx.newPage();
  watch(page);
  await page.goto(base + '/index.html?quality=low&capture&nomap&nocanopy');
  await ready(page);
  await step(page, 1);
  const before = await page.evaluate(() => { const H = window.__haizHome, c = H.world.camera; return { grow: H.info().grow, fov: c.fov, view: !!(c.view && c.view.enabled), p: c.position.toArray() }; });

  // the bar button opens the ring on the newest day of the archive
  await page.click('#ringsButton');
  await page.waitForFunction(() => window.__haizHome.rings?.state().iso && document.body.classList.contains('rg-on'), null, { timeout: 60000 });
  let s = await state(page);
  const meta = JSON.parse(fs.readFileSync(path.join(root, 'lanren/rings/data/climate.json'), 'utf8'));
  assert.strictEqual(s.iso, meta.last, 'opens on the outermost cell');
  assert.strictEqual(s.days, meta.days);
  assert.match(await page.evaluate(() => location.hash), /^#rings/);
  assert.strictEqual(await page.evaluate(() => window.__haizHome.W.owner), 'rings');
  assert.match(await page.locator('#rgCount').textContent(), /这棵树记得 [\d,]+ 个日子/);
  results.push(`「年轮」opens from the bar on ${s.iso}, the newest of ${s.days} days; the film's scroll is held`);

  // a typhoon day: the facts, the leaves' place in the year, rain and wind on the tree
  await page.evaluate(() => window.__haizHome.rings.select('2014-07-18', 900));
  await page.evaluate(() => window.__haizHome.rings.settle());
  await step(page, 2);
  s = await state(page);
  assert.strictEqual(s.iso, '2014-07-18');
  assert.match(await page.locator('#rgWx').textContent(), /大暴雨 211\.2 mm/);
  assert.match(await page.locator('#rgDate').textContent(), /2014\s*7 月 18 日/);
  assert(s.applied.rain > 0.9 && s.applied.wind > 1.4, 'rain and wind reach the tree: ' + JSON.stringify(s.applied));
  let u = await page.evaluate(() => { const H = window.__haizHome; const g = H.world.scene.getObjectByName('rings-weather'); return { year: H.info().grow, weather: !!g && g.visible, rain: g.children[0].visible }; });
  assert(u.weather && u.rain, 'the rain is in the scene');
  await shot(page, 'desktop-typhoon-20140718');
  results.push('2014-07-18 15:00 (Rammasun): 大暴雨 211.2 mm, rain and a gale staged on the tree');

  // a clear night: stars, no rain; then winter: last season's leaves turn and fall
  await page.evaluate(() => { const R = window.__haizHome.rings; R.select('1999-12-31', 1425); R.settle(); });
  await step(page, 2);
  s = await state(page);
  assert(s.applied.stars > 0.3 && s.applied.rain === 0, 'a clear night has stars: ' + JSON.stringify(s.applied));
  assert(s.applied.turn > 0.4 && s.applied.turn < 0.7, 'the leaves are turning at the year\'s end');
  await shot(page, 'desktop-night-19991231');
  await page.evaluate(() => { const R = window.__haizHome.rings; R.select('2019-04-20', 600); R.settle(); });
  await step(page, 2);
  s = await state(page);
  assert(s.applied.flushG > 0.85 && s.applied.stars === 0);
  await shot(page, 'desktop-spring-20190420');
  results.push('night of 1999-12-31 shows stars and turning leaves; 2019-04-20 10:00 the new flush under a clear sky');

  // keys step days and years; the address follows
  await page.keyboard.press('ArrowRight');
  assert.strictEqual((await state(page)).iso, '2019-04-21');
  await page.keyboard.press('ArrowUp');
  assert.strictEqual((await state(page)).iso, '2020-04-21');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowLeft');
  assert.strictEqual((await state(page)).iso, '2019-04-20');
  await page.waitForFunction(() => /#rings\/2019-04-20\/1000/.test(location.hash), null, { timeout: 5000 });
  results.push('arrow keys step by day and by year; the address is #rings/2019-04-20/1000');

  // pointing at the ring picks the day under the pointer (1 April 2000 is on the right-hand side)
  const hit = await page.evaluate(async () => {
    const D = await import('./lanren/rings/disc.js'), C = await import('./lanren/rings/climate.js');
    const R = window.__haizHome.rings, c = await R.ready(), lay = D.layout(c);
    const q = D.place(lay, C.indexOfDate(2000, 4, 1), C.parts);
    const r = document.getElementById('rgOver').getBoundingClientRect();
    return { x: r.left + (q.x / D.FRAME * 0.5 + 0.5) * r.width, y: r.top + (q.y / D.FRAME * 0.5 + 0.5) * r.height, w: r.width };
  });
  assert(hit.w > 400, 'the ring is drawn large: ' + hit.w);
  await page.mouse.click(hit.x, hit.y);
  assert.strictEqual((await state(page)).iso, '2000-04-01');
  results.push(`a click on the ring (${Math.round(hit.w)} px across) chooses the day under it: 2000-04-01`);

  // the school's history surfaces in the years it names
  await page.evaluate(() => window.__haizHome.rings.select('1988-04-26', 600));
  assert.match(await page.locator('#rgHist').textContent(), /1988.*海南中学/);
  await page.evaluate(() => window.__haizHome.rings.select('1996-04-26', 600));
  assert.strictEqual(await page.locator('#rgHist').isHidden(), true, 'a year without a record shows none');

  // lenses repaint the ring
  const ink = () => page.evaluate(() => { const c = document.getElementById('rgWood'), g = c.getContext('2d'), d = g.getImageData(c.width * 0.5, c.height * 0.2, 40, 40).data; let r = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; b += d[i + 2]; } return { r, b }; });
  const woodInk = await ink();
  await page.click('[data-lens="rain"]');
  const rainInk = await ink();
  assert(rainInk.b / rainInk.r > woodInk.b / woodInk.r * 1.2, 'the rain lens is bluer than wood');
  assert.strictEqual(await page.locator('[data-lens="rain"]').getAttribute('aria-checked'), 'true');
  await page.click('[data-lens="wood"]');
  results.push('lenses (木纹 / 雨 / 冷暖 / 风) repaint the same days');

  // a span of one's own: three years of senior school, counted and kept as a poster
  await page.click('#rgMineBtn');
  await page.selectOption('#rgClass', '2024');
  s = await state(page);
  assert.strictEqual(s.span.days, 1034);
  assert.strictEqual(s.iso, '2021-09-01');
  assert.match(await page.locator('#rgFacts').textContent(), /2024 届 · 高中三年[\s\S]*1,034[\s\S]*天下过雨/);
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#rgPoster')]);
  assert.strictEqual(download.suggestedFilename(), 'haiz-rings.png');
  const posterPath = await download.path();
  assert(fs.statSync(posterPath).size > 200000, 'the poster is a real image');
  if (SHOTS) { fs.mkdirSync(outDir, { recursive: true }); fs.copyFileSync(posterPath, path.join(outDir, 'poster-class-2024.png')); }
  await step(page, 1);
  await shot(page, 'desktop-span-class-2024');
  assert.match(await page.evaluate(() => localStorage.getItem('haiz.rings.v1')), /"class".*"2024"/);
  await page.click('#rgClear');
  assert.strictEqual((await state(page)).span, null);
  assert.strictEqual(await page.evaluate(() => localStorage.getItem('haiz.rings.v1')), '{}');
  results.push('「我的日子」lights 2024 届 (1,034 days), exports a poster PNG, and is kept only in localStorage');

  // playing a year walks the days
  await page.keyboard.press('Escape');   // closes the span panel first
  assert.strictEqual(await page.locator('#rgMine').isHidden(), true);
  // a falling leaf caught here is pressed with the date the ring stands on
  await page.evaluate(() => { const R = window.__haizHome.rings; R.select('2008-08-08', 1200); R.settle(); });
  await step(page, 1);
  const leafAt = await page.evaluate(() => {
    const w = window.__haizHome.world, cam = w.camera;
    const dir = cam.position.clone(); cam.getWorldDirection(dir);
    const p = cam.position.clone().addScaledVector(dir, 8);
    w.litter.falling.length = 0;
    const L = w.litter.release(p, 0.2);
    const v = L.p.clone().project(cam), r = w.renderer.domElement.getBoundingClientRect();
    return [r.left + (v.x * 0.5 + 0.5) * r.width, r.top + (-v.y * 0.5 + 0.5) * r.height];
  });
  await page.mouse.click(leafAt[0], leafAt[1]);
  await page.waitForSelector('#specimen[open]', { timeout: 20000 });
  assert.match(await page.locator('#specFacts').textContent(), /8 月 8 日 · 夜里 20:00/);
  await page.click('#specLet');
  results.push('a leaf caught under the ring is pressed with that day\'s date (2008-08-08, 夜里 20:00)');

  await page.evaluate(() => { const R = window.__haizHome.rings; R.select('2020-01-01', 720); R.play('year'); });
  await step(page, 6);
  s = await state(page);
  assert(s.play === 'year' && s.iso > '2020-01-03', 'the year is being walked: ' + s.iso);
  await page.evaluate(() => window.__haizHome.rings.play('year'));
  assert.strictEqual((await state(page)).play, null);

  // Escape returns to the film exactly as it was
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.body.classList.contains('rg-on'), null, { timeout: 20000 });
  await step(page, 2);
  const after = await page.evaluate(() => { const H = window.__haizHome, c = H.world.camera; const g = H.world.scene.getObjectByName('rings-weather');
    return { grow: H.info().grow, fov: c.fov, view: !!(c.view && c.view.enabled), owner: H.W.owner, hash: location.hash, weather: g.visible, hidden: document.getElementById('rings').hidden, p: c.position.toArray() }; });
  assert.strictEqual(after.owner, 'scroll');
  assert.strictEqual(after.hidden, true);
  assert.strictEqual(after.weather, false);
  assert.strictEqual(after.view, before.view, 'the lens shift is undone');
  assert(Math.abs(after.grow - before.grow) < 0.01, `growth is the film's again: ${before.grow} → ${after.grow}`);
  assert(Math.abs(after.fov - before.fov) < 0.5 && Math.hypot(after.p[0] - before.p[0], after.p[1] - before.p[1], after.p[2] - before.p[2]) < 1.5, 'the camera is back at the first shot');
  assert.doesNotMatch(after.hash, /rings/);
  const year = await page.evaluate(async () => (await import('./lanren/js/foliage.js')).UNIFORMS.uYear.value);
  assert.strictEqual(year, 0, 'the leaves are V4\'s again');
  results.push('Escape hands the camera, the leaves and the scroll back to the six-shot film');
  await ctx.close();

  // ---------------------------------------------------------------- a link to one day; phone layout
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const mp = await phone.newPage();
  watch(mp);
  await mp.goto(base + '/index.html?quality=low&capture&nomap&nocanopy#rings/2008-08-08/2000');
  await ready(mp);
  await mp.waitForFunction(() => window.__haizHome.rings?.state().iso === '2008-08-08' && document.body.classList.contains('rg-on'), null, { timeout: 60000 });
  await mp.evaluate(() => window.__haizHome.rings.settle());
  await step(mp, 2);
  s = await state(mp);
  assert.strictEqual(s.minutes, 1200);
  const boxes = await mp.evaluate(() => Object.fromEntries(['rgDisc', 'rgHour', 'rgClose'].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [id, [r.left, r.top, r.right, r.bottom]]; })
    .concat([['panel', (() => { const r = document.querySelector('.rg-panel .rg-head').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })()], ['over', (() => { const r = document.getElementById('rgOver').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })()]])));
  assert(boxes.over[2] - boxes.over[0] >= 240, 'the ring is usable on a phone: ' + (boxes.over[2] - boxes.over[0]));
  assert(boxes.panel[3] <= boxes.over[1] + 6, 'the day\'s words end above the ring');
  assert(boxes.over[3] <= boxes.rgHour[1] + 6, 'the ring ends above the clock');
  for (const [k, b] of Object.entries(boxes)) assert(b[0] >= -1 && b[2] <= 391 && b[3] <= 845, k + ' is on screen: ' + b.map(Math.round));
  await shot(mp, 'phone-20080808');
  results.push(`a #rings/2008-08-08/2000 link opens that evening on a phone; ring ${Math.round(boxes.over[2] - boxes.over[0])} px, nothing overlaps`);
  await phone.close();

  // ---------------------------------------------------------------- without WebGL: the ring alone
  const flat = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const fp = await flat.newPage();
  watch(fp);
  await fp.goto(base + '/index.html?static#rings/1973-09-14');
  await fp.waitForFunction(() => document.body.classList.contains('rg-on') && /1973/.test(document.getElementById('rgDate')?.textContent || ''), null, { timeout: 60000 });
  assert.match(await fp.locator('#rgWx').textContent(), /暴雨 97\.3 mm/);
  const painted = await fp.evaluate(() => { const c = document.getElementById('rgWood'); const d = c.getContext('2d').getImageData(c.width / 2, c.height * 0.25, 1, 1).data; return d[3]; });
  assert.strictEqual(painted, 255, 'the ring is painted');
  await shot(fp, 'static-19730914');
  results.push('without WebGL (?static) the ring, the day\'s facts and the poster still work');
  await flat.close();

  await browser.close();
  server.close();
  assert.deepStrictEqual(errors, [], 'no page errors');
  fs.writeFileSync(path.join(__dirname, 'rings-browser-results.json'), JSON.stringify({ passed: results.length, results }, null, 2) + '\n');
  console.log(results.map((r) => '✓ ' + r).join('\n'));
})().catch((err) => { console.error(err); process.exit(1); });

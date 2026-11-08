// Real-browser checks for chapter 03's works canopy (Chromium; SwiftShader in CI).
// usage: node tests/canopy-browser.cjs   (writes tests/canopy-browser-results.json)
const assert = require('node:assert');
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.wav': 'audio/wav' };
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
const T = 240000;

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port + '/index.html';
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const results = [];
  const errors = [];
  const watch = (page) => {
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  };
  const ready = (page) => page.waitForFunction(() => document.body.classList.contains('ready') && window.__haizHome.canopy && window.__haizHome.canopy.info().status !== 'loading', null, { timeout: T });
  const C = (page) => page.evaluate(() => window.__haizHome.canopy.info());
  const until = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: T });

  // ---- desktop: the six-shot walk passes 03 untouched; entering, exploring, reading, relations, back, leaving
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  watch(page);
  await page.goto(base + '?quality=low&test=1&works=demo');
  await ready(page);
  await page.evaluate(() => window.scrollTo(0, document.getElementById('leaves').offsetTop));
  await until(page, () => window.__haizHome.info().active === 2);
  assert.match(await page.evaluate(() => location.hash), /^#leaves$/);
  assert.strictEqual((await C(page)).mode, 'shot', 'scrolling to 03 does not enter the canopy');
  assert(await page.isVisible('#p-leaves [data-action="canopy-enter"]'), '03 offers the way in');
  results.push('normal scroll reaches 03 (#leaves); the canopy stays closed until asked');
  await page.keyboard.press('End');
  await until(page, () => window.__haizHome.info().active === 5);
  assert.strictEqual((await C(page)).owns, false);
  results.push('the walk continues past 03 to 06 without entering the community');
  await page.evaluate(() => window.scrollTo(0, document.getElementById('leaves').offsetTop));
  await until(page, () => Math.abs(window.__haizHome.info().p - 2) < 1e-3);
  // the camera at rest on the 03 shot (polled: SwiftShader is slow, a fixed wait would sample it mid-glide)
  // (a frame can take seconds here: two samples only count if at least three new frames were drawn between them)
  await page.evaluate(() => { (function f() { window.__rf = (window.__rf || 0) + 1; requestAnimationFrame(f); })(); });
  const restAt = () => page.waitForFunction(() => {
    const c = window.__haizHome.world.camera.position, l = window.__restLast;
    if (l && window.__rf - l[3] < 3) return false;
    window.__restLast = [...c.toArray(), window.__rf];
    return l && Math.hypot(c.x - l[0], c.y - l[1], c.z - l[2]) < 0.03 && window.__restLast.slice(0, 3);   // V4 breathes ±2 cm
  }, null, { timeout: 180000, polling: 500 }).then((h) => h.jsonValue());
  const before = await restAt();
  const y0 = await page.evaluate(() => scrollY);
  await page.click('#p-leaves [data-action="canopy-enter"]');
  await until(page, () => window.__haizHome.canopy.info().mode === 'canopy');
  let c = await C(page);
  assert.strictEqual(c.dir, 'photo', 'the V4 cluster opens onto its own limb');
  assert.match(c.hash, /^#leaves\/photo$/);
  assert(c.works === 11 && c.status === 'demo');
  assert(await page.isVisible('.cnp-notice.demo'), 'samples are labelled as samples');
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(300);
  assert.strictEqual(await page.evaluate(() => scrollY), y0, 'the page does not scroll while the canopy has it');
  results.push('“走进作品树冠” enters from the V4 details shot onto 摄影 · 影像 (#leaves/photo); page scroll held; demo notice shown');
  await page.keyboard.press('ArrowRight');
  await until(page, () => window.__haizHome.canopy.info().dir === 'words' && !window.__haizHome.canopy.info().moving);
  assert.match((await C(page)).hash, /#leaves\/words$/);
  const marks = await page.evaluate(() => [...document.querySelectorAll('.cnp-mark.on')].map((m) => m.dataset.work));
  assert(marks.length >= 3 && marks.every((id) => /^demo-/.test(id)), 'the limb shows its works as labels pinned to their leaves: ' + marks);
  results.push(`→ moves to 文学 (#leaves/words) with ${marks.length} work leaves labelled`);
  // a work opens from its leaf label
  await page.click(`.cnp-mark.on[data-work="${marks[0]}"]`);
  await until(page, () => window.__haizHome.canopy.info().reading);
  c = await C(page);
  assert.strictEqual(c.sel, marks[0]);
  assert.match(c.hash, new RegExp('#leaves/w/' + marks[0] + '$'));
  assert(await page.isVisible('.cnp-read h2'));
  results.push(`a leaf label opens the work to read (#leaves/w/${marks[0]})`);
  // relations: the relay from photo → poem → sound
  await page.evaluate(() => window.__haizHome.canopy.open('demo-low-voice'));
  await until(page, () => window.__haizHome.canopy.info().sel === 'demo-low-voice' && !window.__haizHome.canopy.info().moving);
  assert.strictEqual((await C(page)).dir, 'sound', 'opening a work travels to its own limb');
  assert(await page.isVisible('.cnp-rel button[data-work="demo-leaf-gap"]'), 'the work shows what it grew from');
  await page.click('.cnp-rel button[data-work="demo-leaf-gap"]');
  await until(page, () => window.__haizHome.canopy.info().sel === 'demo-leaf-gap');
  assert.strictEqual((await C(page)).dir, 'words');
  const shown = await page.evaluate(() => { const p = window.__haizHome.canopy.project('demo-leaf-gap'); return p && p[2] < 1 && p[0] < innerWidth * 0.56; });
  assert(shown, 'the open leaf sits in view, clear of the reading sheet');
  results.push('relations: 叶间低音 shows 衍生自 叶隙; following it flies across the crown to 文学 and frames that leaf beside the sheet');
  // back steps out of reading; Esc leaves; the camera returns to where it was
  await page.goBack();
  await until(page, () => !window.__haizHome.canopy.info().reading);
  assert.strictEqual((await C(page)).owns, true, 'Back closes the work, not the canopy');
  await page.keyboard.press('Escape');
  await until(page, () => window.__haizHome.canopy.info().mode === 'shot');
  // (SwiftShader renders ~1 frame a second here: wait for V4's camera to settle rather than a fixed time)
  await page.evaluate(() => { window.__restLast = null; });
  const after = await restAt();
  const drift = await page.evaluate(([a, b]) => { const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); if (d >= 0.08) throw new Error('far'); return d; }, [after, before])
    .catch(async () => { const a = await page.evaluate(() => [window.__haizHome.world.camera.position.toArray(), window.__haizHome.info().p]); throw new Error('camera did not return: ' + JSON.stringify({ before, a })); });
  assert.match(await page.evaluate(() => location.hash), /^#leaves$/);
  assert.strictEqual(await page.evaluate(() => window.__haizHome.info().active), 2);
  results.push(`Back closes the work; Esc leaves the canopy and the camera returns to the 03 frame (${drift.toFixed(3)} m)`);
  await page.keyboard.press('ArrowDown');
  await until(page, () => window.__haizHome.info().active === 3);
  results.push('after leaving, the scroll walk continues to 04');
  // private draft (no account on this origin: saved on this device, said so)
  await page.evaluate(() => window.scrollTo(0, document.getElementById('leaves').offsetTop));
  await until(page, () => Math.abs(window.__haizHome.info().p - 2) < 1e-3);
  await page.evaluate(() => window.__haizHome.canopy.enter('photo'));
  await until(page, () => window.__haizHome.canopy.info().mode === 'canopy');
  await page.click('[data-act="create"]');
  await page.waitForSelector('.cnp-create[open] input[name="title"]');
  assert(await page.isDisabled('.cnp-create [data-act="submit"]'), 'submission is not faked');
  await page.fill('.cnp-create input[name="title"]', '测试草稿');
  await page.fill('.cnp-create textarea[name="body"]', '只给自己看');
  await page.click('.cnp-create [data-act="save"]');
  await page.waitForFunction(() => /已保存在这台设备/.test(document.querySelector('.cnp-save-msg').textContent), null, { timeout: 30000 });
  const local = await page.evaluate(() => JSON.parse(localStorage.getItem('haiz.canopy.drafts.v1') || '[]'));
  assert(local.length === 1 && local[0].state === 'draft' && local[0].title === '测试草稿');
  results.push('a private draft is saved (no account here: on this device, and the sheet says so); 申请审核 is disabled, not faked');
  await page.keyboard.press('Escape');
  await ctx.close();

  // ---- find my leaf: a shared link opens that leaf from a cold start; Back walks out
  const fctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const fp = await fctx.newPage();
  watch(fp);
  await fp.goto(base + '?quality=low&test=1&works=demo#leaves/w/demo-leaf-gap');
  await ready(fp);
  await until(fp, () => window.__haizHome.canopy.info().sel === 'demo-leaf-gap' && window.__haizHome.canopy.info().reading);
  assert.match(await fp.textContent('.cnp-read h2'), /叶隙/);
  results.push('a leaf link (#leaves/w/demo-leaf-gap) opens that work on its leaf from a cold start');
  await fp.goBack();
  await until(fp, () => !window.__haizHome.canopy.info().reading && window.__haizHome.canopy.info().owns);
  await fp.goBack();
  await until(fp, () => window.__haizHome.canopy.info().mode === 'shot');
  results.push('Back from a leaf link: the canopy, then the 03 shot');
  // the find sheet: demo authors find their own leaves
  await fp.click('#p-leaves [data-action="canopy-find"]');
  await fp.waitForSelector('.cnp-find[open]');
  await fp.click('[data-person="演示作者 · 丙"]');
  const mine = await fp.$$eval('.cnp-mine [data-work]', (b) => b.map((x) => x.dataset.work));
  assert.deepStrictEqual(mine.sort(), ['demo-leaf-gap', 'demo-low-voice']);
  await fp.click('.cnp-mine [data-work="demo-low-voice"]');
  await until(fp, () => window.__haizHome.canopy.info().sel === 'demo-low-voice');
  results.push('找到我的叶子: a (demo) author lists their two works, including the co-authored one, and flies to it');
  await fp.goto(base + '?quality=low&test=1&works=demo#leaves/w/demo-not-public');
  await ready(fp);
  await until(fp, () => window.__haizHome.canopy.info().reading);
  assert.match(await fp.textContent('.cnp-read h2'), /目前不公开/);
  results.push('a link to a work that is not public says so (withdrawn or wrong link), without revealing anything');
  await fctx.close();

  // ---- production default: no works service yet → an honest, empty tree
  const nctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const np = await nctx.newPage();
  watch(np);
  await np.goto(base + '?quality=low&test=1&works=none#leaves');
  await ready(np);
  await until(np, () => window.__haizHome.info().active === 2);
  await np.evaluate(() => window.__haizHome.canopy.enter('photo'));
  await until(np, () => window.__haizHome.canopy.info().mode === 'canopy');
  const n = await C(np);
  assert.strictEqual(n.works, 0);
  assert.strictEqual(n.status, 'none');
  assert.match(await np.textContent('.cnp-notice'), /还没有公开作品/);
  await until(np, () => document.querySelector('.cnp-mark.ghost.on'));
  results.push('without samples the tree is honestly empty: notice explains why; the limb shows where its first leaf will grow');
  await nctx.close();

  // ---- reduced motion: no flights, same places
  const rctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const rp = await rctx.newPage();
  watch(rp);
  await rp.goto(base + '?quality=low&test=1&works=demo#leaves');
  await ready(rp);
  await until(rp, () => window.__haizHome.info().active === 2);
  await rp.evaluate(() => window.__haizHome.canopy.enter('photo'));
  await until(rp, () => window.__haizHome.canopy.info().mode === 'canopy');
  await rp.evaluate(() => window.__haizHome.canopy.dir('code'));
  assert.strictEqual((await C(rp)).moving, false, 'reduced motion: arrives at once');
  results.push('reduced motion: entering and changing limb arrive at once (no camera flights)');
  await rctx.close();

  // ---- no WebGL: the works as a readable page
  const sp = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  watch(sp);
  await sp.goto(base + '?static=1&works=demo#leaves/w/demo-tenth-window');
  await sp.waitForFunction(() => document.querySelector('#leaves-works'), null, { timeout: 60000 });
  const links = await sp.$$eval('#leaves-works a[data-work]', (a) => a.length);
  assert.strictEqual(links, 11);
  await sp.waitForFunction(() => /第七节课的窗/.test(document.querySelector('.cnp-static-read')?.textContent || ''));
  results.push('static fallback: all works listed by direction; a leaf link opens the work as text');
  await sp.close();

  // ---- phone
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  watch(mp);
  await mp.goto(base + '?test=1&works=demo#leaves');
  await ready(mp);
  await until(mp, () => window.__haizHome.info().active === 2);
  await mp.evaluate(() => window.__haizHome.canopy.enter('photo'));
  await until(mp, () => window.__haizHome.canopy.info().mode === 'canopy');
  await mp.tap('.cnp-dir[data-dir="sound"]');
  await until(mp, () => window.__haizHome.canopy.info().dir === 'sound' && !window.__haizHome.canopy.info().moving);
  await mp.evaluate(() => window.__haizHome.canopy.open('demo-low-voice'));
  await until(mp, () => window.__haizHome.canopy.info().reading);
  const geo = await mp.evaluate(() => { const r = document.querySelector('.cnp-read').getBoundingClientRect(); return { h: r.height / innerHeight, w: r.width, overflow: document.documentElement.scrollWidth - innerWidth }; });
  assert(geo.h > 0.7 && geo.h < 0.85 && geo.w === 390 && geo.overflow <= 0, 'phone reading sheet: ' + JSON.stringify(geo));
  results.push(`phone (390×844): directions by touch; the reading sheet rises from the bottom (${Math.round(geo.h * 100)}% high), no sideways overflow`);
  await mctx.close();

  assert.deepStrictEqual(errors, [], 'page errors: ' + errors.join(' | '));
  results.push('no page errors');
  fs.writeFileSync(path.join(__dirname, 'canopy-browser-results.json'), JSON.stringify({ date: new Date().toISOString(), browser: 'chromium (swiftshader)', results }, null, 2) + '\n');
  for (const r of results) console.log('✓', r);
  await browser.close();
  server.close();
})().catch(async (e) => { console.error(e); process.exit(1); });

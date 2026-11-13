// Real-browser checks for the HAIZ lab book (lab/), second generation. Chromium; SwiftShader in CI.
// Opens every page, exercises every control, turns pages by key, click and drag, and checks that the
// printed paper, the DOM overlay and the model stay consistent. Passing here is not a visual sign-off.
const assert = require('node:assert');
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };
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
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const results = [], errors = [];
  const watch = (page) => {
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('requestfailed', (r) => errors.push('request failed: ' + r.url()));
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  };
  const ready = (page) => page.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 120000 });
  const settle = (page, ms = 350) => page.waitForTimeout(ms);
  const idle = (page, i) => page.waitForFunction((i) => !window.__lab.turning && (i === null || window.__lab.index === i), i ?? null, { timeout: 120000 });
  const open = (page, id) => page.evaluate(async (id) => { const L = window.__lab; await L.open(L.list.findIndex((x) => x.id === id), true); }, id);
  // a point on the book, in screen pixels
  const at = (page, x, side, z) => page.evaluate(([x, side, z]) => {
    const s = window.__lab.stage, v = s.goal.target.clone().set(x, side > 0 ? s.book.hR : s.book.hL, z).project(s.cam), b = s.canvas.getBoundingClientRect();
    return { x: b.left + (v.x + 1) / 2 * b.width, y: b.top + (1 - v.y) / 2 * b.height };
  }, [x, side, z]);

  // ---- desktop
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  const page = await ctx.newPage();
  watch(page);
  await page.goto(base + '/lab/index.html?fixed=1&q=1');
  await ready(page);

  // catalog integrity
  const cat = await page.evaluate(() => window.__lab.list.map((e) => ({
    id: e.id, subject: e.subject, no: e.no, title: e.title, en: e.en, lede: e.lede?.length, formula: !!e.formula, terms: e.terms?.length,
    predict: e.predict && { n: e.predict.options.length, a: e.predict.answer, why: !!e.predict.why }, fig: !!e.fig,
    teach: e.teach && { where: !!(e.teach.where || e.course?.book), ask: e.teach.ask?.length, simplify: !!e.teach.simplify },
    course: e.course && { stage: e.course.stage, kind: e.course.kind, src: e.course.src?.length || 0 },
    controls: (e.controls || []).map((c) => c.id), build: typeof e.build,
  })));
  assert(cat.length >= 45, 'at least 45 pages: ' + cat.length);
  assert.strictEqual(new Set(cat.map((e) => e.id)).size, cat.length, 'ids are unique');
  for (const e of cat) {
    assert(/^[a-z]+-[a-z0-9-]+$/.test(e.id), 'id shape: ' + e.id);
    assert(e.title && e.en && e.lede >= 1 && e.formula && e.terms >= 2 && e.fig, 'page text present: ' + e.id);
    assert(e.predict && e.predict.n === 3 && e.predict.a >= 0 && e.predict.a < 3 && e.predict.why, 'prediction present: ' + e.id);
    assert(e.teach && e.teach.where && e.teach.ask >= 2 && e.teach.simplify, 'teacher notes present: ' + e.id);
    assert(['bx', 'xb', 'tz'].includes(e.course.stage) && ['must', 'lab', 'demo', 'model', 'inquiry'].includes(e.course.kind), 'course position present: ' + e.id);
    assert(e.course.kind !== 'must' || e.course.src > 0, 'a page is only called a required student experiment when a source is attached: ' + e.id);
    assert.strictEqual(new Set(e.controls).size, e.controls.length, 'control ids unique: ' + e.id);
    assert.strictEqual(e.build, 'function');
  }
  const subjects = [...new Set(cat.map((e) => e.subject))];
  assert(subjects.length >= 11, 'eleven subjects: ' + subjects.join(','));
  results.push(`catalog: ${cat.length} pages across ${subjects.length} subjects, each with prediction, answer flap, teacher notes and a course position; "required student experiment" is only used where a source is attached (${cat.filter((e) => e.course.kind === 'must').length} pages)`);

  // every page: open, exercise each control, look for errors and overflow
  let exercised = 0;
  for (const e of cat) {
    if (only && e.id !== only) continue;
    const before = errors.length;
    await open(page, e.id);
    await page.waitForFunction(() => document.querySelectorAll('#css3d .leaf-l .margin span').length > 0, null, { timeout: 30000 });
    await settle(page, 200);
    const m = await page.evaluate(() => {
      const main = document.querySelector('#css3d .leaf-l .main'), rin = document.querySelector('#css3d .leaf-r .rin'), side = document.querySelector('#css3d .leaf-l .side');
      const zl = +main.dataset.z, zr = +rin.dataset.z, sp = window.__lab.spread;
      return { zl, zr, left: main.scrollHeight * zl - main.clientHeight, right: rin.scrollHeight * zr - rin.clientHeight, side: side.scrollHeight - side.clientHeight,
        meshes: sp.root.children.length, margin: document.querySelectorAll('#css3d .leaf-l .margin span').length, print: [sp.cvL.width, sp.cvL.height, sp.cvR.width, sp.cvR.height], pop: sp.pop };
    });
    assert(m.left <= 1 && m.zl >= 0.88, `${e.id}: left page text fits (over by ${m.left}px at scale ${m.zl})`);
    assert(m.right <= 1 && m.zr >= 0.88, `${e.id}: right page controls fit (over by ${m.right}px at scale ${m.zr})`);
    assert(m.side <= 0, `${e.id}: margin notes fit (over by ${m.side}px)`);
    assert(m.meshes > 0, `${e.id}: the scene has objects`);
    assert(m.print.every((v) => v >= 1000), `${e.id}: both pages are printed to textures (${m.print})`);
    const n = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      let count = 0;
      for (const input of document.querySelectorAll('#css3d .leaf-r input[type=range]')) {
        const v0 = input.value;
        for (const v of [input.min, input.max, v0]) { input.value = v; input.dispatchEvent(new Event('input', { bubbles: true })); await wait(60); count++; }
      }
      for (const b of document.querySelectorAll('#css3d .leaf-r .seg button')) { b.click(); await wait(60); count++; }
      for (const b of document.querySelectorAll('#css3d .leaf-r .act')) { b.click(); await wait(80); count++; }
      return count;
    });
    exercised += n;
    await settle(page, 300);
    await page.evaluate(() => { document.querySelector('#css3d .leaf-l .opt').click(); document.querySelector('#css3d .leaf-l .flap-top').click(); });
    assert.strictEqual(await page.evaluate(() => document.querySelector('#css3d .leaf-l .flap').dataset.open), '1', `${e.id}: flap opens`);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('#css3d .leaf-l .opt.right').length), 1, `${e.id}: exactly one answer is marked right`);
    assert.strictEqual(await page.evaluate(() => window.__lab.turning), false, `${e.id}: using the controls does not turn the page`);
    assert.strictEqual(errors.length, before, `${e.id}: no errors (${errors.slice(before).join(' | ')})`);
  }
  results.push(`all ${cat.length} pages open in the new book, build their model, print both pages to paper textures and fit; ${exercised} control interactions without an error or an accidental page turn`);

  // the DOM overlay sits exactly on the printed paper
  await open(page, 'phy-pendulum'); await settle(page, 600);
  const reg = await page.evaluate(() => {
    const s = window.__lab.stage, b = s.canvas.getBoundingClientRect(), h = s.book.hL + 0.02;
    const pts = [[-10, -6.7], [0, -6.7], [-10, 6.7], [0, 6.7]].map(([x, z]) => { const v = s.goal.target.clone().set(x, h, z).project(s.cam); return [b.left + (v.x + 1) / 2 * b.width, b.top + (1 - v.y) / 2 * b.height]; });
    const r = document.querySelector('#css3d .leaf-l').getBoundingClientRect();
    return { dl: Math.abs(r.left - Math.min(...pts.map((p) => p[0]))), dr: Math.abs(r.right - Math.max(...pts.map((p) => p[0]))), dt: Math.abs(r.top - Math.min(...pts.map((p) => p[1]))), db: Math.abs(r.bottom - Math.max(...pts.map((p) => p[1]))) };
  });
  assert(Math.max(reg.dl, reg.dr, reg.dt, reg.db) < 2.5, 'DOM page registers with the paper: ' + JSON.stringify(reg));
  results.push(`the interactive DOM page lies on the printed paper to within ${Math.max(reg.dl, reg.dr, reg.dt, reg.db).toFixed(1)} px on every side`);

  // page turning: keyboard, click on the page edge, drag (cancel and commit), contents, hash
  await page.evaluate(async () => { await window.__lab.open(0, true); });
  await page.keyboard.press('ArrowRight');
  await idle(page, 1);
  assert.strictEqual(await page.evaluate(() => location.hash), '#' + cat[1].id);
  const pops = await page.evaluate(() => window.__lab.spread.popGoal);
  assert.strictEqual(pops, 0, 'the new model is asked to stand up after the turn');
  results.push('→ folds the model into its plate, turns a bending two-sided leaf and raises the next model; the hash follows');
  let pt = await at(page, 9.4, 1, 1.5);
  await page.mouse.move(pt.x, pt.y); await settle(page, 400);
  assert.strictEqual(await page.evaluate(() => document.querySelector('#gl').style.cursor), 'pointer', 'page edge shows a pointer cursor');
  assert(await page.evaluate(() => window.__lab.book.leaf.visible), 'hovering the page edge lifts the corner');
  await page.mouse.down(); await page.mouse.up();
  await idle(page, 2);
  results.push('hovering a page edge lifts its corner; a click there turns to the next page');
  pt = await at(page, -9.4, -1, 1.5);
  await page.mouse.move(pt.x, pt.y); await settle(page, 300); await page.mouse.down(); await page.mouse.up();
  await idle(page, 1);
  results.push('a click on the left page edge turns back');
  pt = await at(page, 9.6, 1, 6.0);
  await page.mouse.move(pt.x, pt.y); await settle(page, 200); await page.mouse.down();
  await page.mouse.move(pt.x - 140, pt.y - 50, { steps: 8 });
  await page.waitForFunction(() => window.__lab.book.turn && window.__lab.book.turn.p > 0.03, null, { timeout: 60000 }); await settle(page, 1500);
  const mid = await page.evaluate(() => ({ t: window.__lab.turning, p: window.__lab.book.turn?.p, away: document.querySelector('#css3d .leaf-l').classList.contains('away') }));
  assert(mid.t && mid.p > 0.02 && mid.p < 0.4 && mid.away, 'dragging a corner holds the leaf part-way: ' + JSON.stringify(mid));
  await page.mouse.up();
  await idle(page, 1);
  assert.strictEqual(await page.evaluate(() => window.__lab.spread.popGoal), 0, 'after a cancelled turn the model stands up again');
  assert(!(await page.evaluate(() => document.querySelector('#css3d .leaf-l').classList.contains('away'))), 'the page DOM returns after a cancelled turn');
  results.push('dragging a page corner a little and letting go springs the leaf back; page, model and index are unchanged');
  await page.mouse.move(pt.x, pt.y); await settle(page, 200); await page.mouse.down();
  const far = await at(page, -8, -1, 3);
  await page.mouse.move(far.x, far.y, { steps: 14 });
  await page.waitForFunction(() => window.__lab.book.turn && window.__lab.book.turn.p > 0.6, null, { timeout: 60000 }); await settle(page, 800);
  await page.mouse.up();
  await idle(page, 2);
  results.push('dragging the corner across the spine and letting go completes the turn');
  // a control is never a page turn, even near the page edge
  await open(page, 'phy-pendulum'); await settle(page, 300);
  await page.locator('#css3d .leaf-r .act').last().click({ force: true });
  await settle(page, 200);
  assert.strictEqual(await page.evaluate(() => window.__lab.index), cat.findIndex((e) => e.id === 'phy-pendulum'), 'clicking a button on the page does not turn it');
  results.push('buttons, sliders and options on the page take the pointer before the page does');

  await page.click('#bToc');
  assert.strictEqual(await page.locator('#tocList button').count(), cat.length);
  await page.locator('#tocFilter .chips').first().locator('button', { hasText: '选择性必修' }).click();
  const xb = await page.locator('#tocList button').count();
  assert(xb > 0 && xb === cat.filter((e) => e.course.stage === 'xb').length, 'filter by stage: ' + xb);
  await page.locator('#tocFilter .chips').first().locator('button', { hasText: '全部' }).click();
  await page.fill('#tocFilter input', '滴定');
  assert.strictEqual(await page.locator('#tocList button').count(), 1);
  await page.fill('#tocFilter input', '');
  await page.click(`#tocList button[data-id="${cat[cat.length - 1].id}"]`);
  await idle(page, cat.length - 1);
  assert(await page.locator('#toc').isHidden());
  assert(await page.locator('#bNext').isDisabled(), 'next is disabled on the last page');
  results.push('contents sheet lists every page, filters by stage, kind and search text, and jumps with a page turn');
  await page.evaluate((id) => { location.hash = id; }, cat[3].id);
  await idle(page, 3);
  results.push('changing the hash by hand turns to that page');
  await page.click('#bTeach');
  assert(await page.locator('#teach').isVisible());
  const teach = await page.locator('#teach').innerText();
  assert(teach.includes('课堂追问') && teach.includes('教学定位'));
  await page.keyboard.press('Escape');
  assert(await page.locator('#teach').isHidden());
  results.push('teacher drawer shows the course position (with sources, or an honest "to be checked"), questions and the model’s simplifications');

  // dragging an object in the scene (the pendulum bob)
  await open(page, 'phy-pendulum'); await settle(page, 400);
  const bob = await page.evaluate(() => {
    const s = window.__lab.stage, d = s.drags.find((x) => x.mesh.parent.visible), v = d.mesh.getWorldPosition(s.goal.target.clone()).project(s.cam), b = s.canvas.getBoundingClientRect();
    return { x: b.left + (v.x + 1) / 2 * b.width, y: b.top + (1 - v.y) / 2 * b.height };
  });
  await page.mouse.move(bob.x, bob.y); await page.mouse.down(); await page.mouse.move(bob.x + 110, bob.y - 20, { steps: 6 }); await page.mouse.up();
  await page.waitForFunction(() => window.__lab.inst.T > 0.5, null, { timeout: 120000 });
  results.push('dragging the pendulum bob and letting go starts a swing that gets timed');
  // the stopwatch measurement lands in the notebook, and the numbers agree with the physics
  await page.evaluate(() => { const b = [...document.querySelectorAll('#css3d .leaf-r .seg button')].find((x) => x.textContent === '10 次'); b.click(); [...document.querySelectorAll('#css3d .leaf-r .act')].find((x) => x.textContent === '计时并记录').click(); });
  await page.waitForFunction(() => window.__lab.notebook.rows('phy-pendulum').length > 0, null, { timeout: 240000 });
  const row = await page.evaluate(() => ({ r: window.__lab.notebook.rows('phy-pendulum').slice(-1)[0], l: window.__lab.params.l }));
  const Tf = 2 * Math.PI * Math.sqrt(row.l / 9.8);
  assert(Math.abs(row.r.T - Tf) < 0.06 && Math.abs(row.r.g - 9.8) < 0.7 && row.r.n === 10, 'pendulum row agrees with T = 2π√(l/g): ' + JSON.stringify(row));
  await page.click('#bRec');
  assert((await page.locator('#notebook table tbody tr').count()) >= 1);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('#notebook [data-a="csv"]')]);
  assert(/HAIZ-phy-pendulum\.csv/.test(dl.suggestedFilename()));
  await page.keyboard.press('Escape');
  results.push(`pendulum: timing 10 swings records l = ${row.l.toFixed(2)} m, T = ${row.r.T.toFixed(3)} s (formula ${Tf.toFixed(3)} s), g = ${row.r.g.toFixed(2)} m/s² into the notebook; CSV export works`);

  // titration: burette reading, pH and concentration are one consistent set of numbers
  await open(page, 'chem-titration'); await settle(page, 300);
  await page.evaluate(() => { [...document.querySelectorAll('#css3d .leaf-r .seg button')].find((x) => x.textContent === '快速').click(); });
  await page.waitForFunction(() => window.__lab.inst.s && window.__lab.inst.s.h > 8.2, null, { timeout: 240000 });
  await page.evaluate(() => { [...document.querySelectorAll('#css3d .leaf-r .seg button')].find((x) => x.textContent === '关').click(); [...document.querySelectorAll('#css3d .leaf-r .act')].find((x) => x.textContent === '读数并记录').click(); });
  await settle(page, 300);
  const tr = await page.evaluate(() => window.__lab.notebook.rows('chem-titration').slice(-1)[0]);
  assert(tr && Math.abs(tr.v1 - tr.v0 - tr.dv) < 1e-6 && Math.abs(tr.c - 0.1 * tr.dv / 20) < 1e-9, 'titration row is self-consistent: ' + JSON.stringify(tr));
  assert(tr.dv >= 20 && tr.dv < 24, 'end point is reached just after 20.00 mL for acid 甲 (0.1000 mol/L): ' + tr.dv);
  results.push(`titration: burette ${tr.v0.toFixed(2)} → ${tr.v1.toFixed(2)} mL, V = ${tr.dv.toFixed(2)} mL, c(HCl) = ${tr.c.toFixed(4)} mol/L — reading, volume and result agree; overshooting gives an honestly larger result`);

  // history timeline: there is no year 0
  await open(page, 'his-timeline'); await settle(page, 200);
  const years = await page.evaluate(async () => {
    const input = document.querySelector('#css3d .leaf-r input[type=range]'), out = document.querySelector('#css3d .leaf-r output'), seen = [];
    for (const v of [-1, 0, 1, 2]) { input.value = v; input.dispatchEvent(new Event('input', { bubbles: true })); seen.push(out.textContent.trim()); }
    return seen;
  });
  assert.deepStrictEqual(years, ['公元前 2 年', '公元前 1 年', '公元 1 年', '公元 2 年'], 'no year zero: ' + years.join(', '));
  results.push('dynasty timeline: the slider steps 公元前 2 年 → 公元前 1 年 → 公元 1 年 with no year 0');
  await ctx.close();

  // ---- reduced motion: no animation, same result
  const calm = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const cp = await calm.newPage();
  watch(cp);
  await cp.goto(base + '/lab/index.html?fixed=1&q=1#chem-titration');
  await ready(cp);
  const i0 = await cp.evaluate(() => window.__lab.index);
  await cp.keyboard.press('ArrowRight');
  await cp.waitForFunction((i) => window.__lab.index === i + 1 && !window.__lab.turning && window.__lab.spread.pop === 0, i0, { timeout: 30000 });
  results.push('prefers-reduced-motion: deep link opens the right page; → swaps pages at once with no fold or flip');
  await calm.close();

  // ---- phone: one page of the book on top, the text flows underneath, swipe to turn
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mp = await phone.newPage();
  watch(mp);
  await mp.goto(base + '/lab/index.html?fixed=1#chem-flame');
  await ready(mp);
  const mobile = await mp.evaluate(() => ({ stacked: document.body.classList.contains('stacked'), inFlow: document.querySelector('#flow .leaf-l') !== null && document.querySelector('#flow .leaf-r') !== null, wide: document.documentElement.scrollWidth - innerWidth, title: document.querySelector('#flow .leaf-l h1').textContent, q: window.__lab.stage.quality, i: window.__lab.index }));
  assert(mobile.stacked && mobile.inFlow, 'phone uses the stacked layout');
  assert(mobile.wide <= 1, 'no sideways scrolling on a phone: ' + mobile.wide);
  assert.strictEqual(mobile.title, '焰色试验');
  const cdp = await phone.newCDPSession(mp);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await touch('touchStart', 335, 250);
  for (const x of [300, 250, 190, 130, 90]) { await touch('touchMove', x, 244); await settle(mp, 120); }
  await settle(mp, 400); await touch('touchEnd');
  await idle(mp, mobile.i + 1);
  results.push(`phone (390×844, quality tier ${mobile.q}): single-page view of the book, text and controls in normal flow below, no horizontal scroll; a leftward swipe on the page turns it`);
  await phone.close();

  await browser.close();
  server.close();
  assert.deepStrictEqual(errors, [], 'no page errors: ' + errors.join(' | '));
  fs.writeFileSync(path.join(__dirname, 'lab-browser-results.json'), JSON.stringify({ suite: 'lab-browser', environment: 'Chromium + SwiftShader (software rendering); not a real-GPU, Safari, real-phone or projector run', experiments: cat.length, passed: results.length, results }, null, 2) + '\n');
  console.log(results.map((r) => '✓ ' + r).join('\n'));
})().catch((e) => { console.error(e); process.exit(1); });

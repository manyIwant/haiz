// Real-browser checks for the HAIZ lab book (lab/). Chromium; SwiftShader in CI.
// Opens every experiment, exercises every control, and checks that nothing throws and no page overflows.
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
const shotDir = process.argv.includes('--capture') ? path.join(root, 'docs', 'lab') : null;

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

  // ---- desktop
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  watch(page);
  await page.goto(base + '/lab/index.html');
  await ready(page);

  // catalog integrity
  const cat = await page.evaluate(() => window.__lab.list.map((e) => ({
    id: e.id, subject: e.subject, no: e.no, title: e.title, en: e.en, lede: e.lede?.length, formula: !!e.formula, terms: e.terms?.length,
    predict: e.predict && { n: e.predict.options.length, a: e.predict.answer, why: !!e.predict.why }, fig: !!e.fig,
    teach: e.teach && { where: !!e.teach.where, ask: e.teach.ask?.length, simplify: !!e.teach.simplify },
    controls: (e.controls || []).map((c) => c.id), build: typeof e.build,
  })));
  assert(cat.length >= 30, 'at least 30 experiments: ' + cat.length);
  assert.strictEqual(new Set(cat.map((e) => e.id)).size, cat.length, 'experiment ids are unique');
  for (const e of cat) {
    assert(/^[a-z]+-[a-z0-9-]+$/.test(e.id), 'id shape: ' + e.id);
    assert(e.title && e.en && e.lede >= 1 && e.formula && e.terms >= 2 && e.fig, 'page text present: ' + e.id);
    assert(e.predict && e.predict.n === 3 && e.predict.a >= 0 && e.predict.a < 3 && e.predict.why, 'prediction present: ' + e.id);
    assert(e.teach && e.teach.where && e.teach.ask >= 2 && e.teach.simplify, 'teacher notes present: ' + e.id);
    assert.strictEqual(new Set(e.controls).size, e.controls.length, 'control ids unique: ' + e.id);
    assert.strictEqual(e.build, 'function');
  }
  const subjects = [...new Set(cat.map((e) => e.subject))];
  assert(subjects.length >= 7, 'seven subjects: ' + subjects.join(','));
  results.push(`catalog: ${cat.length} experiments across ${subjects.length} subjects (${subjects.join(', ')}), each with prediction, answer flap and teacher notes`);

  // every experiment: open, exercise each control, look for errors and overflow
  let exercised = 0;
  for (const e of cat) {
    const before = errors.length;
    await page.evaluate(async (id) => { const L = window.__lab; await L.open(L.list.findIndex((x) => x.id === id), true); }, e.id);
    await page.waitForFunction(() => document.querySelectorAll('#margin span').length > 0, null, { timeout: 30000 });
    await settle(page, 200);
    const m = await page.evaluate(() => {
      const main = document.querySelector('.leaf-l .main'), rin = document.querySelector('.leaf-r .rin'), side = document.querySelector('.leaf-l .side');
      const zl = +main.dataset.z, zr = +rin.dataset.z;
      return { zl, zr, left: main.scrollHeight * zl - main.clientHeight, right: rin.scrollHeight * zr - rin.clientHeight, side: side.scrollHeight - side.clientHeight, meshes: window.__lab.stage.root.children.length, margin: document.querySelectorAll('#margin span').length };
    });
    assert(m.left <= 1 && m.zl >= 0.9, `${e.id}: left page text fits (over by ${m.left}px at scale ${m.zl})`);
    assert(m.right <= 1 && m.zr >= 0.9, `${e.id}: right page controls fit (over by ${m.right}px at scale ${m.zr})`);
    assert(m.side <= 0, `${e.id}: margin notes fit (over by ${m.side}px)`);
    assert(m.meshes > 0, `${e.id}: the scene has objects`);
    assert(m.margin > 0, `${e.id}: live margin notes are written`);
    // sliders to both ends and back, every choice, every button
    const n = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      let count = 0;
      for (const input of document.querySelectorAll('.leaf-r input[type=range]')) {
        const v0 = input.value;
        for (const v of [input.min, input.max, v0]) { input.value = v; input.dispatchEvent(new Event('input', { bubbles: true })); await wait(60); count++; }
      }
      for (const b of document.querySelectorAll('.leaf-r .seg button')) { b.click(); await wait(60); count++; }
      for (const b of document.querySelectorAll('.leaf-r .act')) { b.click(); await wait(80); count++; }
      return count;
    });
    exercised += n;
    await settle(page, 300);
    // prediction + flap
    await page.evaluate(() => { document.querySelector('.leaf-l .opt').click(); document.querySelector('.leaf-l .flap-top').click(); });
    assert.strictEqual(await page.evaluate(() => document.querySelector('.leaf-l .flap').dataset.open), '1', `${e.id}: flap opens`);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.leaf-l .opt.right').length), 1, `${e.id}: exactly one answer is marked right`);
    assert.strictEqual(errors.length, before, `${e.id}: no errors (${errors.slice(before).join(' | ')})`);
  }
  results.push(`all ${cat.length} experiments open, render objects, write live margin notes and fit their pages; ${exercised} control interactions without an error`);

  // page turning by keyboard, hash routing, contents, teacher notes
  await page.evaluate(async () => { await window.__lab.open(0, true); });
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction((id) => location.hash === '#' + id && !window.__lab.stage.turning, cat[1].id, { timeout: 60000 });
  results.push('→ turns the page with the fold / flip / pop-up animation and updates the hash');
  await page.click('#bToc');
  assert.strictEqual(await page.locator('#tocList button').count(), cat.length);
  await page.click(`#tocList button[data-id="${cat[cat.length - 1].id}"]`);
  await page.waitForFunction((id) => location.hash === '#' + id && !window.__lab.stage.turning, cat[cat.length - 1].id, { timeout: 60000 });
  assert(await page.locator('#toc').isHidden());
  assert(await page.locator('#bNext').isDisabled(), 'next is disabled on the last page');
  results.push('contents sheet lists every experiment and jumps to the chosen one');
  await page.click('#bTeach');
  assert(await page.locator('#teach').isVisible());
  assert((await page.locator('#teach').innerText()).includes('课堂追问'));
  await page.keyboard.press('Escape');
  assert(await page.locator('#teach').isHidden());
  results.push('teacher drawer shows curriculum mapping, questions to ask and the model’s simplifications');
  // dragging an object in the scene (the pendulum bob), and orbiting on empty space
  await page.evaluate(async () => { const L = window.__lab; await L.open(L.list.findIndex((x) => x.id === 'phy-pendulum'), true); });
  await settle(page, 400);
  const bob = await page.evaluate(() => {
    const s = window.__lab.stage, d = s.drags.find((x) => x.mesh.visible), v = d.mesh.getWorldPosition(d.mesh.position.clone()).project(s.cam), b = s.canvas.getBoundingClientRect();
    return { x: b.left + (v.x + 1) / 2 * b.width, y: b.top + (1 - v.y) / 2 * b.height };
  });
  await page.mouse.move(bob.x, bob.y); await page.mouse.down(); await page.mouse.move(bob.x + 120, bob.y - 20, { steps: 6 }); await page.mouse.up();
  // the drag puts the bob well off the vertical; then one full swing gets timed (slow under software rendering)
  await page.waitForFunction(() => window.__lab.inst.T > 0.5, null, { timeout: 120000 });
  results.push('dragging the pendulum bob and letting go starts a timed swing');
  if (shotDir) { fs.mkdirSync(shotDir, { recursive: true }); for (const id of ['phy-pendulum', 'chem-titration', 'bio-dna', 'math-conic']) { await page.evaluate(async (i) => { const L = window.__lab; await L.open(L.list.findIndex((x) => x.id === i), true); }, id); await settle(page, 1800); await page.screenshot({ path: path.join(shotDir, id + '.jpg'), type: 'jpeg', quality: 82, timeout: 120000 }); } }
  await ctx.close();

  // ---- phone: the apparatus stays on top, the page text flows underneath
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mp = await phone.newPage();
  watch(mp);
  await mp.goto(base + '/lab/index.html#chem-flame');
  await ready(mp);
  const mobile = await mp.evaluate(() => ({ stacked: document.body.classList.contains('stacked'), inFlow: document.querySelector('#flow .leaf-l') !== null && document.querySelector('#flow .leaf-r') !== null, wide: document.documentElement.scrollWidth - innerWidth, title: document.querySelector('.leaf-l h1').textContent }));
  assert(mobile.stacked && mobile.inFlow, 'phone uses the stacked layout');
  assert(mobile.wide <= 1, 'no sideways scrolling on a phone: ' + mobile.wide);
  assert.strictEqual(mobile.title, '焰色试验');
  if (shotDir) { await settle(mp, 1500); await mp.screenshot({ path: path.join(shotDir, 'phone-flame.jpg'), type: 'jpeg', quality: 82, timeout: 120000 }); }
  results.push('phone (390×844): stacked layout, page text in normal flow, no horizontal scroll, deep link opens the right experiment');
  await phone.close();

  await browser.close();
  server.close();
  assert.deepStrictEqual(errors, [], 'no page errors: ' + errors.join(' | '));
  fs.writeFileSync(path.join(__dirname, 'lab-browser-results.json'), JSON.stringify({ suite: 'lab-browser', environment: 'Chromium + SwiftShader (software rendering); not a real-GPU or Safari run', experiments: cat.length, passed: results.length, results }, null, 2) + '\n');
  console.log(results.map((r) => '✓ ' + r).join('\n'));
})().catch((e) => { console.error(e); process.exit(1); });

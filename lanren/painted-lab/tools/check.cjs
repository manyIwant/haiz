// Painted lab self-check: the invariants the lab has to keep, measured on real renders.
//   node lanren/painted-lab/tools/check.cjs [baseUrl] [--size 960x540] [--views lanshu,aerial]
// Needs a static server at baseUrl (e.g. `python3 -m http.server 8765` in the repo root) and Playwright.
//
//   1  the page loads, the buildings load, no page errors or console errors
//   2  with every lab layer off, the lab draws the V2 original (mean |Δ| < 1.5/255 — only the
//      dither differs): the lab is a strict superset of the existing look, never a fork of it
//   3  with every layer on, the picture really changes (mean |Δ| > 4/255), and no pixel goes
//      black or NaN that was not black in the original (a broken pass shows up as holes)
//   4  each layer, alone, changes the picture (no dead switch in the panel)
//   5  the split view's left half is the original and its right half the lab
// Software GL (SwiftShader) in the cloud: this checks pictures and logic, not frame times.
const { chromium } = require('playwright');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const base = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://localhost:8765';
const [w, h] = arg('size', '960x540').split('x').map(Number);
const ALL = ['core', 'brush', 'broken', 'light', 'wash', 'planes', 'paint', 'ink', 'paper'];

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(`${base}/painted-lab.html?still&quality=high&scale=1`);
  await page.waitForFunction(() => window.__lab || document.body.dataset.stage === 'failed', null, { timeout: 240000 });
  const results = [];
  const ok = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };
  const ready = await page.evaluate(() => !!window.__lab && window.__lab.info.buildings === 'ready');
  ok('1 loads with buildings', ready, ready ? '' : 'stage=' + (await page.evaluate(() => document.body.dataset.stage)));
  if (!ready) { await browser.close(); process.exit(1); }

  // draw a configuration and keep its pixels in the page (WebGL canvas → 2D, preserveDrawingBuffer is on in ?still)
  await page.evaluate(() => {
    window.__grab = (key) => {
      const c = document.querySelector('#pl-canvas');
      const k = document.createElement('canvas'); k.width = c.width; k.height = c.height;
      const g = k.getContext('2d'); g.drawImage(c, 0, 0);
      (window.__px = window.__px || {})[key] = g.getImageData(0, 0, k.width, k.height).data;
    };
    window.__diff = (a, b, x0 = 0, x1 = 1) => {
      const A = window.__px[a], B = window.__px[b], W = document.querySelector('#pl-canvas').width;
      let s = 0, n = 0, holes = 0;
      for (let i = 0; i < A.length; i += 4) {
        const x = ((i / 4) % W) / W;
        if (x < x0 || x >= x1) continue;
        s += Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]); n += 3;
        if (B[i] + B[i + 1] + B[i + 2] === 0 && A[i] + A[i + 1] + A[i + 2] > 30) holes++;
      }
      return { mean: s / n, holes };
    };
  });
  const draw = (view, mode, layers, key) => page.evaluate(([v, m, l, k]) => {
    const L = window.__lab; L.setView(v); L.setLayers(l); L.setMode(m); L.render(); window.__grab(k);
  }, [view, mode, layers, key]);
  const diff = (a, b, x0, x1) => page.evaluate(([a, b, x0, x1]) => window.__diff(a, b, x0, x1), [a, b, x0, x1]);

  for (const view of arg('views', 'lanshu,aerial').split(',')) {
    await draw(view, 'base', ALL, 'base');
    await draw(view, 'lab', [], 'none');
    let d = await diff('base', 'none');
    ok(`2 [${view}] all layers off = V2 original`, d.mean < 1.5, `mean |Δ| ${d.mean.toFixed(2)}/255`);
    await draw(view, 'lab', ALL, 'all');
    d = await diff('base', 'all');
    ok(`3 [${view}] all layers on changes the picture, no holes`, d.mean > 4 && d.holes === 0, `mean |Δ| ${d.mean.toFixed(2)}/255, holes ${d.holes}`);
    for (const l of ALL) {
      await draw(view, 'lab', [l], 'one');
      d = await diff('none', 'one');
      ok(`4 [${view}] layer ${l} alone has an effect`, d.mean > 0.15 && d.holes === 0, `mean |Δ| ${d.mean.toFixed(2)}/255, holes ${d.holes}`);
    }
    await page.evaluate(() => window.__lab.setSplit(0.5));
    await draw(view, 'split', ALL, 'split');
    const left = await diff('base', 'split', 0.02, 0.46), right = await diff('all', 'split', 0.54, 0.98);
    ok(`5 [${view}] split: left original, right lab`, left.mean < 1.5 && right.mean < 1.5, `left |Δ| ${left.mean.toFixed(2)}, right |Δ| ${right.mean.toFixed(2)}`);
  }
  ok('1 no page or console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  await browser.close();
  process.exit(failed ? 1 : 0);
})();

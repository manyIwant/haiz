// Screenshots of the painted lab's study views, for review (docs/painted-lab/).
//   node lanren/painted-lab/tools/shoot.cjs [baseUrl] [outDir] [--views a,b] [--modes split,lab,base] [--time noon] [--size 1280x720] [--quality high]
// Needs a static server at baseUrl (e.g. `python3 -m http.server 8765` in the repo root) and Playwright.
// In this repository's cloud sessions Chromium runs on SwiftShader (software GL): pictures are
// faithful, frame times are not — never read performance from these runs.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const pos = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !(all[i - 1] || '').startsWith('--'));
const base = pos[0] || 'http://localhost:8765';
const out = pos[1] || 'docs/painted-lab/shots';
const [w, h] = arg('size', '1280x720').split('x').map(Number);
const time = arg('time', 'noon');
const quality = arg('quality', 'high');
const modes = arg('modes', 'split').split(',');
const layers = arg('layers', '');
const debug = arg('debug', '');
const preset = arg('preset', '');
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const q = `still&quality=${quality}&time=${time}&scale=1${layers ? '&layers=' + layers : ''}${preset ? '&preset=' + preset : ''}`;
  await page.goto(`${base}/painted-lab.html?${q}`);
  await page.waitForFunction(() => window.__lab || document.body.dataset.stage === 'failed', null, { timeout: 240000 });
  if (!(await page.evaluate(() => !!window.__lab))) { console.log('FAILED', errors); process.exit(1); }
  const views = arg('views', '') ? arg('views').split(',') : await page.evaluate(() => window.__lab.views);
  await page.evaluate(() => document.body.classList.add('pl-bare'));
  for (const v of views) {
    for (const m of modes) {
      const t = Date.now();
      await page.evaluate(([v, m, d]) => { window.__lab.setView(v); window.__lab.setMode(m); window.__lab.debug(d); window.__lab.render(); }, [v, m, debug]);
      const file = path.join(out, `${v}-${time}-${m}${preset ? '-' + preset : ''}${debug ? '-' + debug : ''}.png`);
      await page.screenshot({ path: file });
      console.log(file, `${Date.now() - t} ms (software GL)`);
    }
  }
  console.log(JSON.stringify(await page.evaluate(() => window.__lab.info)));
  if (errors.length) console.log('ERRORS', errors.slice(0, 10));
  await browser.close();
})();

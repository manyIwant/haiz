#!/usr/bin/env node
// Deterministic stills of the six homepage chapters, for before/after image
// comparison. Each still is taken in a FRESH page (no shared history): load,
// jump to the chapter, advance the simulation a fixed number of fixed steps
// without drawing, then draw a fixed number of frames and grab the canvas.
//
//   node bench/stills.cjs [--site DIR] [--label NAME] [--quality low,medium] [--dpr 3]
//
// Writes bench/results/<label>/<quality>-chN.png and stills.json; compare two
// labels with bench/compare.cjs.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const repo = path.resolve(__dirname, '..');
const root = path.resolve(arg('site', repo));
const label = arg('label', 'current');
const qualities = arg('quality', 'low,medium').split(',');
const dpr = +arg('dpr', 3);
const chapters = arg('chapters', '1,2,3,4,5,6').split(',').map(Number);
const outDir = path.resolve(arg('out', path.join(repo, 'bench/results', label)));
fs.mkdirSync(outDir, { recursive: true });

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://local').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (e, b) => { if (e) { res.writeHead(404).end(); return; } res.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); res.end(b); });
});
const SEED = `(() => { let s = 0x2611; Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
// a virtual performance.now for the still itself: the camera's breathing and the map's tweens read
// it, so it must not depend on how long loading took. It starts far beyond any real load time (so a
// tween begun while loading has finished) and advances only with the fixed steps.
(() => { const real = performance.now.bind(performance); let v = null;
  performance.now = () => (v === null ? real() : v);
  window.__benchClock = { start() { v = 1e7; }, advance(ms) { v += ms; } }; })();`;

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const report = { label, site: path.relative(repo, root) || '.', date: new Date().toISOString(), dpr, tiers: [] };
  try {
    for (const quality of qualities) {
      const shots = [], errors = [];
      for (const ch of chapters) {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
        await ctx.addInitScript(SEED);
        const page = await ctx.newPage();
        page.setDefaultTimeout(600000);
        await page.clock.setFixedTime(new Date('2026-03-21T09:30:00+08:00'));
        page.on('pageerror', (e) => errors.push(`ch${ch} ${e.message}`));
        page.on('console', (m) => { if (m.type() === 'error' && !/GPU stall/.test(m.text())) errors.push(`ch${ch} ${m.text()}`); });
        await page.goto(`${base}/index.html?quality=${quality}&capture=1`);   // capture: the page loop starts paused, so only still() advances time
        await page.waitForFunction(() => document.body.classList.contains('ready'));
        await page.waitForFunction(() => { const i = window.__haizHome.info(); return i.mapReady && i.canopyReady; }, null, { timeout: 120000 }).catch(() => {});
        await page.addStyleTag({ content: 'body *{visibility:hidden!important;transition:none!important} .stage,#world{visibility:visible!important}' });
        await page.evaluate((i) => {
          const H = window.__haizHome, w = H.world, rr = w.render;
          H.freeze(true);
          window.__benchClock.start();
          H.go(i);
          w.render = () => {};
          try { for (let k = 0; k < 30; k++) { window.__benchClock.advance(100); H.still(0.1, 10); } }   // 30 fixed steps, nothing drawn
          finally { w.render = rr; }
          for (let k = 0; k < 4; k++) { window.__benchClock.advance(1000 / 30); H.still(1 / 30, 30); }  // four drawn frames (the shadow map refreshes on every tier)
        }, ch - 1);
        const f = path.join(outDir, `${quality}-ch${ch}.png`);
        await page.locator('#world').screenshot({ path: f });
        shots.push(path.relative(repo, f));
        await ctx.close();
        process.stdout.write(`  ${quality} ch${ch}\n`);
      }
      report.tiers.push({ quality, shots, errors });
    }
  } finally { await browser.close(); server.close(); }
  // merge into an existing bench report if there is one, so compare.cjs finds the stills
  const rep = path.join(outDir, 'report.json');
  if (fs.existsSync(rep)) {
    const r = JSON.parse(fs.readFileSync(rep));
    for (const t of report.tiers) { const rt = r.tiers.find((x) => x.quality === t.quality); if (rt) rt.shots = t.shots; }
    fs.writeFileSync(rep, JSON.stringify(r, null, 2) + '\n');
  }
  fs.writeFileSync(path.join(outDir, 'stills.json'), JSON.stringify(report, null, 2) + '\n');
  for (const t of report.tiers) if (t.errors.length) console.log(t.quality, 'errors:', t.errors);
  console.log('wrote ' + path.relative(repo, outDir));
})().catch((e) => { console.error(e); process.exitCode = 1; });

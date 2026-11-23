#!/usr/bin/env node
// Interleaved A/B timing of the render alone (no simulation), to separate a
// small rendering change from SwiftShader's run-to-run noise.
//
//   node bench/ab.cjs --a ../haiz-base --b . [--quality low] [--reps 9] [--chapters 1,2,3]
//
// Both checkouts are open at once in the same browser; for every chapter the
// two pages are frozen at the same view and timed alternately: A, B, A, B, …
// Each sample is one full composer frame (shadow map forced) closed by a GPU
// sync. Reports the median and the median of the per-pair B/A ratios.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const repo = path.resolve(__dirname, '..');
const sites = { a: path.resolve(arg('a', repo)), b: path.resolve(arg('b', repo)) };
const quality = arg('quality', 'low');
const reps = +arg('reps', 9);
const chapters = arg('chapters', '1,2,3,4,5,6').split(',').map(Number);
const dpr = +arg('dpr', 3);

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const serve = (root) => http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://local').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (e, b) => { if (e) { res.writeHead(404).end(); return; } res.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); res.end(b); });
});
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

(async () => {
  const servers = {}, pages = {};
  const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    for (const k of ['a', 'b']) {
      servers[k] = serve(sites[k]);
      await new Promise((r) => servers[k].listen(0, '127.0.0.1', r));
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
      const page = pages[k] = await ctx.newPage();
      page.setDefaultTimeout(600000);
      await page.goto(`http://127.0.0.1:${servers[k].address().port}/index.html?quality=${quality}&capture=1`);
      await page.waitForFunction(() => document.body.classList.contains('ready'));
      await page.waitForFunction(() => { const i = window.__haizHome.info(); return i.mapReady && i.canopyReady; }, null, { timeout: 120000 }).catch(() => {});
      await page.evaluate(() => {
        const H = window.__haizHome, w = H.world, r = w.renderer, gl = r.getContext(), px = new Uint8Array(4);
        H.freeze(true);
        const sync = () => { r.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
        window.__ab = {
          at: (i) => { H.go(i); const rr = w.render; w.render = () => {}; try { H.still(3, 10); } finally { w.render = rr; } H.still(2 / 30, 30); },
          time: () => { r.shadowMap.needsUpdate = true; sync(); const s = performance.now(); w.composer.render(); sync(); return performance.now() - s; }
        };
      });
    }
    const out = [];
    for (const ch of chapters) {
      await pages.a.evaluate((i) => window.__ab.at(i), ch - 1);
      await pages.b.evaluate((i) => window.__ab.at(i), ch - 1);
      const A = [], B = [], ratio = [];
      for (let k = 0; k < reps; k++) {
        const a = await pages.a.evaluate(() => window.__ab.time());
        const b = await pages.b.evaluate(() => window.__ab.time());
        A.push(a); B.push(b); ratio.push(b / a);
      }
      const row = { chapter: ch, aMedianMs: Math.round(median(A)), bMedianMs: Math.round(median(B)), medianRatio: +median(ratio).toFixed(3) };
      out.push(row);
      console.log(`ch${ch}: A ${row.aMedianMs}ms  B ${row.bMedianMs}ms  B/A ${row.medianRatio}`);
    }
    const file = arg('out');
    if (file) fs.writeFileSync(file, JSON.stringify({ date: new Date().toISOString(), quality, dpr, reps, a: path.relative(repo, sites.a) || '.', b: path.relative(repo, sites.b) || '.', results: out }, null, 2) + '\n');
  } finally { await browser.close(); for (const s of Object.values(servers)) s.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });

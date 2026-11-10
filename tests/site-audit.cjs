// Visual audit captures of HAIZ pages in Chromium (SwiftShader for WebGL).
// For each page: desktop first screen + full page, phone first screen + full page,
// and the console errors seen while loading.
// usage: node tests/site-audit.cjs out_dir page.html [page2.html ...]
//   env: FULL=0 skips full-page captures; WAIT=ms after load (default 2500)
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json', '.ktx2': 'image/ktx2', '.hdr': 'application/octet-stream' };
const serve = () => new Promise((res) => {
  const s = http.createServer((req, rsp) => {
    let p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (p.endsWith(path.sep)) p = path.join(p, 'index.html');
    fs.readFile(p, (err, buf) => {
      if (err) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { 'content-type': types[path.extname(p).toLowerCase()] || 'application/octet-stream' });
      rsp.end(buf);
    });
  }).listen(0, () => res(s));
});
(async () => {
  const out = process.argv[2];
  const pages = process.argv.slice(3);
  fs.mkdirSync(out, { recursive: true });
  const server = await serve();
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const wait = +(process.env.WAIT || 2500);
  const report = [];
  for (const pg of pages) {
    const name = pg.replace(/[/?#=&]/g, '_').replace(/\.html.*$/, '');
    for (const [dev, opts] of [['desk', { viewport: { width: 1440, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
      const ctx = await browser.newContext({ ...opts, reducedMotion: process.env.RM ? 'reduce' : 'no-preference' });
      // never reach the network: the audit judges the site as served
      await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 160)));
      page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
      const t0 = Date.now();
      try {
        await page.goto(base + pg, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(wait);
      } catch (e) { errs.push('goto: ' + e.message.slice(0, 120)); }
      try {
        await page.screenshot({ path: path.join(out, `${name}.${dev}.png`), timeout: 120000 });
        if (process.env.FULL !== '0') {
          const h = await page.evaluate(() => document.documentElement.scrollHeight);
          // scroll through once so lazy sections and reveal-on-scroll content are present
          for (let y = 0; y < h; y += 700) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(60); }
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForTimeout(400);
          await page.screenshot({ path: path.join(out, `${name}.${dev}.full.png`), fullPage: true, timeout: 180000 });
          report.push({ page: pg, dev, height: h, ms: Date.now() - t0, errors: errs.slice(0, 8) });
        } else report.push({ page: pg, dev, ms: Date.now() - t0, errors: errs.slice(0, 8) });
      } catch (e) { report.push({ page: pg, dev, errors: [...errs, 'shot: ' + e.message.slice(0, 120)] }); }
      await ctx.close();
      console.log(pg, dev, JSON.stringify(report[report.length - 1]));
    }
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
  await browser.close();
  server.close();
})();

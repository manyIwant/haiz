// Freeze each section's exit mid-move for review: click the section's first
// entry, pause GSAP, seek the exit to `at` seconds and step the camera push by
// the same time. Navigation never fires (the timeline never reaches its end).
// usage: node tests/lanren-exits.cjs out_dir 1@1.0 2@1.05 3@1.4 4@1.2 5@1.35
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const serve = () => new Promise((res) => {
  const s = http.createServer((req, rsp) => {
    const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    fs.readFile(p, (err, buf) => {
      if (err) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
      rsp.end(buf);
    });
  }).listen(0, () => res(s));
});
(async () => {
  const out = process.argv[2] || 'tests/artifacts/exits';
  const specs = process.argv.slice(3);
  fs.mkdirSync(out, { recursive: true });
  const server = await serve();
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const vw = +(process.env.VW || 1440), vh = +(process.env.VH || 900);
  for (const spec of specs) {
    const [i, at] = spec.split('@').map(Number);
    // a fresh page per exit: an exit cannot be undone in place
    const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: +(process.env.DSF || 1) });
    await page.goto(`http://localhost:${server.address().port}/index.html?capture=1&quality=${process.env.Q || 'high'}`);
    await page.waitForFunction(() => window.__haizHome && window.__haizHome.world && document.body.classList.contains('ready'), null, { timeout: 180000 });
    await page.evaluate((n) => { window.__haizHome.go(n); window.__haizHome.still(0.05, 20); }, i);
    await page.waitForTimeout(2000);
    const href = await page.evaluate(([n, t]) => {
      const a = document.querySelectorAll('.panel')[n].querySelector('.entries a');
      a.click();
      const tl = window.gsap.exportRoot();   // children keep their global start times
      tl.pause();
      tl.time(tl.time() + t);
      window.__haizHome.still(t, 5);
      return a.getAttribute('href');
    }, [i, at]);
    await page.waitForTimeout(400);
    const f = path.join(out, `exit-${i}.png`);
    await page.screenshot({ path: f, timeout: 240000 });
    console.log('exit', i, at + 's', href, f, page.url().includes('index.html') ? 'stayed' : 'NAVIGATED');
    await page.close();
  }
  await browser.close();
  server.close();
})();

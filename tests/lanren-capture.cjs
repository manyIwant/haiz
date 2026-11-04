// Capture review frames of lanren/ in Chromium (SwiftShader in CI).
// usage: node tests/lanren-capture.cjs out_dir "view:2026-11-03T15:00" ...
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
function serve() {
  return new Promise((res) => {
    const s = http.createServer((req, rsp) => {
      const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      fs.readFile(p, (err, buf) => {
        if (err) { rsp.writeHead(404); rsp.end(); return; }
        rsp.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
        rsp.end(buf);
      });
    }).listen(0, () => res(s));
  });
}
(async () => {
  const out = process.argv[2] || 'tests/artifacts/lanren';
  const shots = process.argv.slice(3);
  fs.mkdirSync(out, { recursive: true });
  const server = await serve();
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const vw = +(process.env.VW || 1280), vh = +(process.env.VH || 720);
  const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  const q = process.env.Q || 'high';
  await page.goto(`http://localhost:${port}/index.html?capture=1&quality=${q}`);
  try {
    await page.waitForFunction(() => window.__haizHome && window.__haizHome.world && document.body.classList.contains('ready'), null, { timeout: 180000 });
  } catch (e) { console.log(logs.join('\n')); throw e; }
  if (process.env.EVAL) await page.evaluate(process.env.EVAL);
  if (process.env.HIDEUI) await page.addStyleTag({ content: '.bar,.panels,.orbit,.growth,.card,.colophon,.leaders,#experienceDock{display:none!important}.stage::after{display:none}' });
  for (const spec of shots) {
    const [view, time] = spec.split('@');
    await page.evaluate(([v, t]) => {
      if (v.startsWith('L')) { const [, ex, ey, ez, lx, ly, lz, p, fov] = v.split(',').map(Number); window.__haizHome.lookdev([ex, ey, ez], [lx, ly, lz], p, fov || 40); }
      else if (v.startsWith('P')) window.__haizHome.seek(+v.slice(1));
      else window.__haizHome.go(+v);
      window.__haizHome.still(+(window.STILL || 0.05), 20);
    }, [view, time]);
    await page.waitForTimeout(+(process.env.WAIT || 1300));
    const f = path.join(out, `${view.startsWith('L') ? 'look' + shots.indexOf(spec) : view.replace('.', '_')}.png`);
    await page.screenshot({ path: f });
    console.log('shot', f, JSON.stringify(await page.evaluate(() => { const i = window.__haizHome.info(); return { cam: i.cam, p: i.p, grow: i.grow.toFixed(2), leaves: i.leaves, falling: i.falling, active: i.active, tier: i.tier }; })));
  }
  console.log(logs.filter((l) => !/GPU stall|swiftshader|Automatic fallback/i.test(l)).slice(0, 30).join('\n'));
  await browser.close();
  server.close();
})();

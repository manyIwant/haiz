// node render/shot.cjs "<query>" out.png  — screenshot film/test.html with the given query
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [q, out] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text().slice(0, 300)); });
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  await p.goto('http://localhost:8766/spring-no-recipient-v2/film/test.html?' + q);
  await p.waitForFunction('window.ready', null, { timeout: 600000 });
  console.log('render ms', await p.evaluate('window.renderMs'));
  await p.screenshot({ path: out });
  await b.close();
})();

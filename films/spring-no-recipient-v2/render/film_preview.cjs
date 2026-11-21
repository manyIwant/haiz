// node render/film_preview.cjs outdir t1 t2 ...   — stills of the world part (film/index.html)
const { chromium } = require('playwright');
(async () => {
  const [out, ...ts] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  p.on('console', m => { if (m.type() === 'error') console.log('[err]', m.text().slice(0, 400)); });
  await p.goto('http://localhost:8766/spring-no-recipient-v2/film/index.html');
  await p.waitForFunction('window.ready', null, { timeout: 900000 });
  for (const t of ts) {
    const t0 = Date.now();
    await p.evaluate(async t => { await window.renderAt(+t); }, t);
    await p.screenshot({ path: `${out}/f_${(+t).toFixed(1).padStart(6, '0')}.png` });
    console.log(t, Date.now() - t0, 'ms');
  }
  await b.close();
})();

// node render/term_preview.cjs outdir t1 t2 ...   — stills of the terminal/fork part
const { chromium } = require('playwright');
(async () => {
  const [out, ...ts] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  await p.goto('http://localhost:8766/spring-no-recipient-v2/film/term.html');
  await p.waitForFunction('window.ready');
  for (const t of ts) {
    await p.evaluate(t => window.renderAt(+t), t);
    await p.screenshot({ path: `${out}/term_${String(t).padStart(5, '0')}.png` });
  }
  await b.close();
})();

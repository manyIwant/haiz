// Render selected frames as PNG for checking:  node render/preview.cjs out_dir t1 t2 ...
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [out, ...ts] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--font-render-hinting=none'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  await p.goto('file://' + path.resolve(__dirname, '../film/index.html'));
  await p.evaluate(() => window.filmReady);
  for (const t of ts.map(Number).sort((a, b) => a - b)) {
    await p.evaluate(t => window.renderAt(t), t);
    await p.screenshot({ path: `${out}/f${t.toFixed(1).padStart(6, '0')}.png` });
  }
  await b.close();
})();

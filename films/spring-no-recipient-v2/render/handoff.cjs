// Render the last frame of the terminal part (film t = 42.0) as film/data/handoff.png:
// the river first reflects exactly this image.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('http://localhost:8766/spring-no-recipient-v2/film/term.html');
  await p.waitForFunction('window.ready');
  for (const t of [30, 41.9, 42.0]) await p.evaluate(t => window.renderAt(t), t);
  await p.screenshot({ path: __dirname + '/../film/data/handoff.png' });
  await b.close();
})();

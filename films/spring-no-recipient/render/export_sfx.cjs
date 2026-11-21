// Export the film's sound-event list (window.SFX) to data/sfx.json for music/compose.py
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + path.resolve(__dirname, '../film/index.html')); await p.evaluate(() => window.filmReady);
  // scenes register some events lazily on build: visit each act once
  for (const t of [60, 180, 230, 250, 340]) await p.evaluate(t => window.renderAt(t), t);
  const sfx = await p.evaluate(() => window.SFX);
  fs.writeFileSync(path.resolve(__dirname, '../data/sfx.json'), JSON.stringify(sfx.sort((a, b) => a.t - b.t), null, 1));
  console.log(sfx.length, 'events'); await b.close();
})();

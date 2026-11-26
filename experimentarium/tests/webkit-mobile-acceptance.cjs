// HAIZ · EXPERIMENTARIUM — WebKit 桌面与移动端 (390×844) 跨全学科验收测试
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { webkit } = require('/Users/a11/manyiwant/haiz-gpt-audit-functional-20261108/node_modules/playwright');

const REPO = path.resolve(__dirname, '../..');
const OUT_JSON = path.join(__dirname, 'webkit-mobile-results.json');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const cleanUrl = (req.url || '/').split('?')[0].split('#')[0];
      let filePath = path.join(REPO, decodeURIComponent(cleanUrl));
      if (cleanUrl === '/' || cleanUrl === '/experimentarium/') filePath = path.join(REPO, 'experimentarium/index.html');
      if (!filePath.startsWith(REPO)) { res.writeHead(403); return res.end('Forbidden'); }
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); return res.end('Not found'); }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

const REPS = [
  'phy-pendulum',
  'phy-resistivity-caliper',
  'chem-titration',
  'bio-microscope-mitosis',
  'geo-seasons',
  'math-conic-locus',
  'tech-beam',
  'his-movable-type',
  'chn-syllogism',
  'pol-market',
];

(async () => {
  const { srv, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}/experimentarium/`;
  const wk = await webkit.launch({ headless: true });
  const results = { testedAt: new Date().toISOString(), desktop: {}, mobile: {}, errors: [] };

  try {
    // 1. WebKit 桌面端（1280×800）：真翻页动效 + 跨 8 个领域包切换 + 工作台
    const dCtx = await wk.newContext({ viewport: { width: 1280, height: 800 } });
    const dPage = await dCtx.newPage();
    dPage.on('pageerror', (e) => results.errors.push(`wk-desktop pageerror: ${e.message}`));
    dPage.on('console', (m) => { if (m.type() === 'error') results.errors.push(`wk-desktop console: ${m.text()}`); });

    await dPage.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await dPage.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 25000 });
    await dPage.click('#bNext');
    await dPage.waitForFunction(() => !window.__lab.turning && window.__lab.index === 1, null, { timeout: 10000 });
    await dPage.click('#bPrev');
    await dPage.waitForFunction(() => !window.__lab.turning && window.__lab.index === 0, null, { timeout: 10000 });

    results.desktop.webkitSafe = await dPage.evaluate(() => document.documentElement.classList.contains('webkit-safe'));
    results.desktop.turnVerified = true;
    results.desktop.checked = [];

    for (const id of REPS) {
      await dPage.evaluate((t) => window.__lab.openById(t), id);
      await dPage.waitForFunction((t) => window.__lab?.spread?.exp?.id === t && !window.__lab.turning, id, { timeout: 20000 });
      await dPage.click('#bWork');
      await dPage.waitForSelector('#workbench:not([hidden])');
      await dPage.click('[data-wb="close"]');
      results.desktop.checked.push(id);
    }
    await dCtx.close();

    // 2. WebKit 移动端（390×844）：堆叠模式 + 三页签切换 (阅读/工作台/记录册)
    const mCtx = await wk.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const mPage = await mCtx.newPage();
    mPage.on('pageerror', (e) => results.errors.push(`wk-mobile pageerror: ${e.message}`));
    mPage.on('console', (m) => { if (m.type() === 'error') results.errors.push(`wk-mobile console: ${m.text()}`); });

    await mPage.goto(`${baseUrl}#chem-titration`, { waitUntil: 'domcontentloaded' });
    await mPage.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 25000 });
    const stacked = await mPage.evaluate(() => document.body.classList.contains('stacked'));
    await mPage.click('[data-mtab="workbench"]');
    const wbOpen = await mPage.evaluate(() => !document.querySelector('#workbench').hidden);
    await mPage.click('[data-mtab="journal"]');
    const nbOpen = await mPage.evaluate(() => !document.querySelector('#notebook').hidden);
    await mPage.click('[data-mtab="read"]');
    results.mobile = { stacked, wbOpen, nbOpen, expId: await mPage.evaluate(() => window.__lab?.spread?.exp?.id) };
    await mCtx.close();
  } finally {
    await wk.close();
    srv.close();
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  if (results.errors.length > 0 || !results.desktop.webkitSafe || !results.mobile.stacked) process.exit(1);
})();

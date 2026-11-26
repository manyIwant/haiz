// HAIZ · EXPERIMENTARIUM — Apple M5 GPU Chromium 63 页全量交互浏览器验收脚本
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('/Users/a11/manyiwant/haiz-gpt-audit-functional-20261108/node_modules/playwright');

const REPO = path.resolve(__dirname, '../..');
const OUT_JSON = path.join(__dirname, 'acceptance-results.json');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
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

(async () => {
  const { srv, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}/experimentarium/`;
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'],
  });

  const results = {
    testedAt: new Date().toISOString(),
    gpuRenderer: null,
    totalCompleted: 0,
    passedPages: 0,
    overflowWarnings: [],
    pages: [],
    workbenchChecks: {},
    uiAndJournalCheck: null,
    bridgeCheck: null,
    errors: [],
  };

  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => results.errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') results.errors.push(`console: ${m.text()}`); });
    page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('favicon')) results.errors.push(`http ${r.status()}: ${r.url()}`); });

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.classList.contains('ready') && window.__lab?.list?.length === 63, null, { timeout: 30000 });

    results.gpuRenderer = await page.evaluate(() => {
      const c = document.querySelector('#gl');
      const gl = c?.getContext('webgl2') || c?.getContext('webgl');
      if (!gl) return 'NO_WEBGL';
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    });

    // 1. UI 抽屉验证：目录筛选 + 全科矩阵模态框 + HAIZExperimentarium 对外契约
    await page.click('#bToc');
    await page.waitForSelector('#toc:not([hidden])');
    const tocCount = await page.locator('#tocList button').count();
    await page.click('#tocClose');

    await page.click('#bMatrix');
    await page.waitForSelector('#matrixModal:not([hidden])');
    const matrixKpiText = await page.locator('#matrixModal .mx-kpis').innerText();
    await page.click('#mxClose');

    const bridgeState = await page.evaluate(() => {
      const api = window.HAIZExperimentarium;
      return api ? { version: api.version, schema: api.schema, state: api.getCurrentState(), matrixTotal: api.getCurriculumMatrix()?.stats?.totalItems } : null;
    });
    results.bridgeCheck = bridgeState;
    results.uiAndJournalCheck = { tocCount, hasMatrix101: matrixKpiText.includes('101') && matrixKpiText.includes('63') };

    // 2. 遍历全部 63 页实验，逐页校验渲染、控件、布局贴合度与错误率
    const allIds = await page.evaluate(() => window.__lab.list.map((e) => e.id));
    results.totalCompleted = allIds.length;

    const deepWbTargets = new Set([
      'phy-pendulum', 'phy-ticker-velocity', 'phy-newton2', 'phy-momentum',
      'phy-resistivity-caliper', 'phy-emf', 'phy-refract', 'phy-oil-film',
      'chem-titration', 'chem-crude-salt', 'chem-hydrolysis', 'chem-equilibrium',
      'bio-microscope-mitosis', 'bio-pigments', 'bio-mendel',
      'geo-seasons', 'geo-contour', 'geo-sponge-hydrology',
      'math-conic-locus', 'math-cube', 'math-derivative',
      'it-binary', 'it-sort', 'tech-beam', 'tech-control',
      'his-movable-type', 'chn-syllogism', 'chn-meter', 'pol-market', 'pol-lorenz',
    ]);

    for (const id of allIds) {
      await page.evaluate((target) => window.__lab.openById(target), id);
      await page.waitForFunction((target) => window.__lab?.spread?.exp?.id === target && !window.__lab.turning, id, { timeout: 25000 });
      await page.waitForTimeout(80);

      // 测一次控件或按钮交互
      const pageCheck = await page.evaluate(() => {
        const sp = window.__lab.spread;
        const mainL = sp.leafL.querySelector('.main');
        const mainR = sp.leafR.querySelector('.rin');
        const lZoom = parseFloat(mainL?.dataset.z || '1');
        const rZoom = parseFloat(mainR?.dataset.z || '1');
        const lo = mainL ? +(mainL.scrollHeight * lZoom - mainL.clientHeight).toFixed(1) : 0;
        const ro = mainR ? +(mainR.scrollHeight * rZoom - mainR.clientHeight).toFixed(1) : 0;
        const marginText = sp.inst?.margin?.()?.join(' | ') || '';
        const btn = sp.leafR.querySelector('.act');
        if (btn) btn.click();
        const seg = sp.leafR.querySelector('.seg button[aria-pressed="false"]');
        if (seg) seg.click();
        return {
          id: sp.exp.id,
          subject: sp.exp.subject,
          title: sp.exp.title,
          hasInst: !!sp.inst && typeof sp.inst.update === 'function',
          marginLen: marginText.length,
          leftOverflow: lo,
          rightOverflow: ro,
        };
      });

      if (pageCheck.leftOverflow > 4 || pageCheck.rightOverflow > 4) {
        results.overflowWarnings.push({ id, leftOverflow: pageCheck.leftOverflow, rightOverflow: pageCheck.rightOverflow });
      }
      if (pageCheck.hasInst) results.passedPages++;
      results.pages.push(pageCheck);

      if (deepWbTargets.has(id)) {
        await page.click('#bWork');
        await page.waitForSelector('#workbench:not([hidden])', { timeout: 5000 });
        await page.waitForTimeout(120);
        const wbInfo = await page.evaluate(() => ({
          visible: !document.querySelector('#workbench').hidden,
          sections: document.querySelectorAll('#workbench .wb-sec').length,
          canvases: document.querySelectorAll('#workbench canvas').length,
        }));
        results.workbenchChecks[id] = wbInfo;
        await page.click('[data-wb="close"]');
      }
    }

    // 3. 在单摆页完整验证个人记录册（多批次 / 异常剔除 / 对比 / 导出载荷）
    await page.evaluate(() => window.__lab.openById('phy-pendulum'));
    await page.waitForFunction(() => window.__lab?.spread?.exp?.id === 'phy-pendulum');
    await page.click('#bWork');
    await page.waitForSelector('#workbench:not([hidden])');
    await page.click('[data-wb-a="sweep5"]');
    await page.click('[data-wb="journal"]');
    await page.waitForSelector('#notebook:not([hidden])');
    await page.click('#notebook [data-a="newRun"]');
    await page.click('#notebook [data-a="toggleCompare"]');
    const journalDetail = await page.evaluate(() => {
      const payload = window.__lab.journal.exportAll();
      return {
        schema: payload.schema,
        compareVisible: !!document.querySelector('#notebook .nb-compare'),
        runCount: document.querySelectorAll('#nbRunSel option').length,
        pendulumRowsRun1: payload.records['phy-pendulum']?.runs?.[0]?.rows?.length || 0,
      };
    });
    results.uiAndJournalCheck.journal = journalDetail;
    await page.click('#notebook .x');
    await page.click('[data-wb="close"]');
  } finally {
    await browser.close();
    srv.close();
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify(results, null, 2));
  console.log(JSON.stringify({
    gpuRenderer: results.gpuRenderer,
    totalCompleted: results.totalCompleted,
    passedPages: results.passedPages,
    deepWorkbenchesChecked: Object.keys(results.workbenchChecks).length,
    overflowCount: results.overflowWarnings.length,
    errorCount: results.errors.length,
    errors: results.errors,
    journal: results.uiAndJournalCheck?.journal,
  }, null, 2));
  if (results.errors.length > 0 || results.passedPages !== 63) process.exit(1);
})();

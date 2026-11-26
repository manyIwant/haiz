// HAIZ · EXPERIMENTARIUM — 桌面端 (1280×800) 与移动端 (390×844) 交互展示录制脚本
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('/Users/a11/manyiwant/haiz-gpt-audit-functional-20261108/node_modules/playwright');

const REPO = path.resolve(__dirname, '../..');
const MEDIA_DIR = path.join(REPO, 'docs/experimentarium/media');
const FRAMES_D = '/tmp/haiz-exp-frames-desktop';
const FRAMES_M = '/tmp/haiz-exp-frames-mobile';
const FFMPEG = '/opt/homebrew/bin/ffmpeg';

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

(async () => {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  fs.rmSync(FRAMES_D, { recursive: true, force: true });
  fs.rmSync(FRAMES_M, { recursive: true, force: true });
  fs.mkdirSync(FRAMES_D, { recursive: true });
  fs.mkdirSync(FRAMES_M, { recursive: true });

  const { srv, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}/experimentarium/`;
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'],
  });

  try {
    // ---------------- 桌面展示序列 (1280×800) ----------------
    const ctxD = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const page = await ctxD.newPage();
    let frameNo = 0;
    const snap = async (times = 1, waitMs = 60, saveStill = null) => {
      for (let i = 0; i < times; i++) {
        const p = path.join(FRAMES_D, `f-${String(frameNo++).padStart(4, '0')}.png`);
        await page.screenshot({ path: p });
        if (i === times - 1 && saveStill) fs.copyFileSync(p, path.join(MEDIA_DIR, saveStill));
        if (waitMs) await page.waitForTimeout(waitMs);
      }
    };

    // 1. 封面摊开与机械翻页至单摆旗舰
    await page.goto(`${baseUrl}#phy-pendulum`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.classList.contains('ready') && window.__lab?.spread?.exp?.id === 'phy-pendulum');
    await snap(14, 70, 'still-01-pendulum-book.png');

    // 2. 展开单摆 T²-l 实验台 + 扫描回归
    await page.click('#bWork');
    await page.waitForSelector('#workbench:not([hidden])');
    await page.click('[data-wb-a="sweep5"]');
    await snap(16, 70, 'still-02-pendulum-workbench.png');
    await page.click('[data-wb="close"]');

    // 3. 切页至酸碱滴定 & 展开曲线台
    await page.evaluate(() => window.__lab.openById('chem-titration'));
    await page.waitForFunction(() => window.__lab?.spread?.exp?.id === 'chem-titration' && !window.__lab.turning);
    await page.click('#bWork');
    await page.waitForSelector('#workbench:not([hidden])');
    await page.click('[data-wb="near"]');
    await page.click('[data-wb="drop"]');
    await page.click('[data-wb="record"]');
    await snap(16, 70, 'still-03-chem-titration.png');
    await page.click('[data-wb="close"]');

    // 4. 数学丹德林双球 + 抛物线切片
    await page.evaluate(() => window.__lab.openById('math-conic-locus'));
    await page.waitForFunction(() => window.__lab?.spread?.exp?.id === 'math-conic-locus' && !window.__lab.turning);
    await page.click('#bWork');
    await page.waitForSelector('#workbench:not([hidden])');
    await page.click('[data-c="parabola"]');
    await snap(14, 70, 'still-04-math-conic.png');
    await page.click('[data-wb="close"]');

    // 5. 毕昇活字历史印刷工时台
    await page.evaluate(() => window.__lab.openById('his-movable-type'));
    await page.waitForFunction(() => window.__lab?.spread?.exp?.id === 'his-movable-type' && !window.__lab.turning);
    await page.click('#bWork');
    await page.waitForSelector('#workbench:not([hidden])');
    await snap(14, 70, 'still-05-history-type.png');
    await page.click('[data-wb="close"]');

    // 6. 全科课程覆盖矩阵概览
    await page.click('#bMatrix');
    await page.waitForSelector('#matrixModal:not([hidden])');
    await snap(14, 70, 'still-06-curriculum-matrix.png');
    await page.click('#mxClose');
    await ctxD.close();

    // ---------------- 移动端展示序列 (390×844) ----------------
    const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const mPage = await ctxM.newPage();
    let mNo = 0;
    const snapM = async (times = 1, waitMs = 70, saveStill = null) => {
      for (let i = 0; i < times; i++) {
        const p = path.join(FRAMES_M, `f-${String(mNo++).padStart(4, '0')}.png`);
        await mPage.screenshot({ path: p });
        if (i === times - 1 && saveStill) fs.copyFileSync(p, path.join(MEDIA_DIR, saveStill));
        if (waitMs) await mPage.waitForTimeout(waitMs);
      }
    };

    await mPage.goto(`${baseUrl}#chem-titration`, { waitUntil: 'domcontentloaded' });
    await mPage.waitForFunction(() => document.body.classList.contains('ready'));
    await snapM(10, 70);
    await mPage.click('[data-mtab="workbench"]');
    await mPage.click('[data-wb="near"]');
    await snapM(14, 70, 'still-07-mobile-workbench.png');
    await mPage.click('[data-mtab="journal"]');
    await snapM(12, 70);
    await ctxM.close();

    // 合成高质量 H.264 MP4
    execFileSync(FFMPEG, [
      '-y', '-framerate', '12', '-i', path.join(FRAMES_D, 'f-%04d.png'),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      path.join(MEDIA_DIR, 'experimentarium-desktop.mp4'),
    ], { stdio: 'inherit' });

    execFileSync(FFMPEG, [
      '-y', '-framerate', '10', '-i', path.join(FRAMES_M, 'f-%04d.png'),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      path.join(MEDIA_DIR, 'experimentarium-mobile.mp4'),
    ], { stdio: 'inherit' });

    console.log('SHOWCASE_CAPTURE_OK', { desktopFrames: frameNo, mobileFrames: mNo });
  } finally {
    await browser.close();
    srv.close();
    fs.rmSync(FRAMES_D, { recursive: true, force: true });
    fs.rmSync(FRAMES_M, { recursive: true, force: true });
  }
})();

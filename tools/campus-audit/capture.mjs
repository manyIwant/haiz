#!/usr/bin/env node
// Render overlay.html to docs/campus-audit/overlay-*.jpg with headless Chromium.
// Needs Playwright + Chromium (preinstalled in the cloud dev container; locally: npx playwright install chromium).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from './lib/load.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = await import('playwright')); }

const TYPES = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const browser = await chromium.launch();
const out = path.join(ROOT, 'docs/campus-audit');
fs.mkdirSync(out, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1400 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/tools/campus-audit/overlay.html`);
  await page.waitForFunction(() => window.__overlayReady, null, { timeout: 15000 });
  await page.waitForFunction(() => document.getElementById('img').complete);
  const stage = page.locator('.stage');
  await stage.screenshot({ path: path.join(out, 'overlay-fit.jpg'), type: 'jpeg', quality: 82 });
  await page.check('#claimed');
  await stage.screenshot({ path: path.join(out, 'overlay-claimed.jpg'), type: 'jpeg', quality: 82 });
  console.log(JSON.stringify(await page.evaluate(() => window.__overlayReady)), errors.length ? 'page errors: ' + errors.join('; ') : 'no page errors');
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}

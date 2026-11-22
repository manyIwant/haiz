// Mobile compatibility acceptance check (real browser, emulated phones and a tablet).
//
// For every top-level page this loads the page as a touch device and checks the things that
// break on phones without anyone noticing on a desktop:
//   - the page answers 200 and its own scripts/styles/modules load (no same-origin 404s)
//   - <meta name="viewport"> sets width=device-width
//   - no uncaught exception during load and a short settle window
//   - nothing overflows sideways (documentElement.scrollWidth <= viewport width)
//   - warnings only: pinch-zoom disabled, tap targets under 24×24 CSS px (WCAG 2.2 2.5.8),
//     body text under 12 px
//
// Pages that draw with WebGL are checked the same way; in CI they run on SwiftShader, which is
// slow but real. This is a compatibility check, not a performance benchmark and not a GPU test.
//
//   node tests/mobile-compat-browser.cjs                    all pages, chromium
//   node tests/mobile-compat-browser.cjs --engine=webkit    iOS engine (needs `playwright install webkit`)
//   node tests/mobile-compat-browser.cjs --pages=index.html,news.html --devices="Pixel 7"
//   node tests/mobile-compat-browser.cjs --root=tests/fixtures/mobile-compat --expect-fail   (self-test)
//
// Writes test-results/mobile-compat-<engine>.json (untracked) and exits 1 on any failure.
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const playwright = require('playwright');

const repo = path.resolve(__dirname, '..');
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const engine = arg('engine', 'chromium');
// --root serves another folder (used by the self-test fixtures); --expect-fail inverts the exit code
// so the checker proves it can catch broken pages.
const root = path.resolve(repo, arg('root', '.'));
const expectFail = process.argv.includes('--expect-fail');
const DEVICE_NAMES = arg('devices', 'iPhone SE,iPhone 13,Pixel 7,iPad Mini landscape').split(',').map((s) => s.trim()).filter(Boolean);
const allPages = fs.readdirSync(root).filter((f) => f.endsWith('.html')).sort();
const PAGES = arg('pages', '') ? arg('pages', '').split(',').map((s) => s.trim()) : allPages;
const SETTLE_MS = Number(arg('settle', '2500'));
const LOAD_TIMEOUT = Number(arg('load-timeout', '60000'));

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.gif': 'image/gif',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.ktx2': 'image/ktx2', '.wasm': 'application/wasm',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': mime[path.extname(p).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
});

// Local runs: use the pre-installed browser when Playwright's own download is absent.
function launchOptions() {
  const opts = { args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] };
  if (engine !== 'chromium') return { };
  const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  let bundled = true;
  try { bundled = fs.existsSync(playwright.chromium.executablePath()); } catch { bundled = false; }
  if (!bundled && exe) opts.executablePath = exe;
  return opts;
}

async function checkPage(browser, base, deviceName, page) {
  const device = playwright.devices[deviceName];
  assert(device, `unknown Playwright device: ${deviceName}`);
  // defaultBrowserType only picks an engine in the Playwright test runner; drop it here.
  const { defaultBrowserType, ...contextOptions } = device;
  const ctx = await browser.newContext({ ...contextOptions, serviceWorkers: 'block' });
  const tab = await ctx.newPage();
  const errors = [], missing = [], failures = [], warnings = [];
  tab.on('pageerror', (e) => errors.push(String(e.message || e).split('\n')[0]));
  tab.on('response', (r) => {
    const u = new URL(r.url());
    const type = r.request().resourceType();
    if (u.origin === base && r.status() >= 400 && ['script', 'stylesheet', 'document'].includes(type)) missing.push(`${r.status()} ${type} ${u.pathname}`);
  });
  let status = 0;
  const started = Date.now();
  try {
    const resp = await tab.goto(`${base}/${page}`, { waitUntil: 'load', timeout: LOAD_TIMEOUT });
    status = resp ? resp.status() : 0;
  } catch (e) {
    failures.push(`did not finish loading within ${LOAD_TIMEOUT} ms: ${String(e.message).split('\n')[0]}`);
  }
  await tab.waitForTimeout(SETTLE_MS);
  const loadMs = Date.now() - started;
  let m = null;
  try {
    // Compare with the device's own width: with isMobile, Chromium widens window.innerWidth to fit
    // overflowing content (the page is zoomed out), which would hide the very bug we look for.
    m = await tab.evaluate((deviceWidth) => {
      const vp = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
      const de = document.documentElement;
      const width = deviceWidth;
      // Elements that stick out to the right of the layout viewport (first few, for the report).
      const wide = [];
      if (de.scrollWidth > width + 1) {
        for (const el of document.body.querySelectorAll('*')) {
          const r = el.getBoundingClientRect();
          if (r.width && r.right > width + 1 && getComputedStyle(el).position !== 'fixed') {
            wide.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : ''} → ${Math.round(r.right)}px`);
            if (wide.length >= 4) break;
          }
        }
      }
      const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05; };
      // Stand-alone controls only: inline links inside running text are exempt under WCAG 2.5.8.
      const small = [];
      for (const el of document.querySelectorAll('a[href], button, [role="button"], input:not([type="hidden"]), select, summary')) {
        if (!visible(el)) continue;
        if (el.tagName === 'A' && el.closest('p, li > p, figcaption, blockquote')) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 24 || r.height < 24) small.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} ${Math.round(r.width)}×${Math.round(r.height)} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 16)}"`);
      }
      let tiny = 0;
      for (const el of document.querySelectorAll('p, li, td, dd')) {
        if (visible(el) && el.textContent.trim().length > 20 && parseFloat(getComputedStyle(el).fontSize) < 12) tiny++;
      }
      return { vp, width, innerWidth: window.innerWidth, scrollWidth: de.scrollWidth, wide, small, tiny, title: document.title };
    }, device.viewport.width);
  } catch (e) {
    failures.push(`page could not be inspected: ${String(e.message).split('\n')[0]}`);
  }
  if (status && status !== 200) failures.push(`HTTP ${status}`);
  if (m) {
    if (!/width\s*=\s*device-width/i.test(m.vp)) failures.push(`viewport meta lacks width=device-width ("${m.vp}")`);
    if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0*)?(\D|$)/i.test(m.vp)) warnings.push('pinch-zoom disabled by viewport meta');
    if (m.scrollWidth > m.width + 1) failures.push(`horizontal overflow: content ${m.scrollWidth}px in a ${m.width}px viewport${m.wide.length ? ' (' + m.wide.join('; ') + ')' : ''}`);
    if (m.small.length) warnings.push(`${m.small.length} tap target(s) under 24×24 px: ${m.small.slice(0, 3).join('; ')}${m.small.length > 3 ? ' …' : ''}`);
    if (m.tiny) warnings.push(`${m.tiny} text block(s) under 12 px`);
  }
  for (const e of [...new Set(errors)]) failures.push(`uncaught: ${e}`);
  for (const x of [...new Set(missing)]) failures.push(`missing: ${x}`);
  await ctx.close();
  return { page, device: deviceName, engine, ok: failures.length === 0, loadMs, failures, warnings };
}

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browserType = playwright[engine];
  assert(browserType, `unknown engine ${engine}`);
  const browser = await browserType.launch(launchOptions());
  const results = [];
  try {
    for (const page of PAGES) {
      for (const device of DEVICE_NAMES) {
        const r = await checkPage(browser, base, device, page);
        results.push(r);
        const mark = r.ok ? '✓' : '✗';
        console.log(`${mark} ${page} · ${device} (${engine}, ${r.loadMs} ms)${r.ok ? '' : '\n    - ' + r.failures.join('\n    - ')}${r.warnings.length ? '\n    ! ' + r.warnings.join('\n    ! ') : ''}`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  const failed = results.filter((r) => !r.ok);
  const out = path.join(repo, 'test-results');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, `mobile-compat-${engine}${expectFail ? '-selftest' : ''}.json`), JSON.stringify({
    engine, browserVersion: undefined, devices: DEVICE_NAMES, pages: PAGES, checked: results.length,
    failed: failed.length, warnings: results.reduce((n, r) => n + r.warnings.length, 0), results
  }, null, 2) + '\n');
  console.log(`\n${results.length - failed.length}/${results.length} page×device checks passed on ${engine}; ${failed.length} failed.`);
  if (expectFail) {
    // Every fixture page is broken on purpose; each must be caught on every device.
    const missed = results.filter((r) => r.ok);
    if (missed.length) { console.error(`self-test: ${missed.length} broken page(s) passed: ${missed.map((r) => r.page + ' · ' + r.device).join(', ')}`); process.exitCode = 1; }
    else console.log('self-test: every deliberately broken page was caught.');
    return;
  }
  if (failed.length) process.exitCode = 1;
})().catch((e) => { console.error(e); server.close(); process.exitCode = 1; });

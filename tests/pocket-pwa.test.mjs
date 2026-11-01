import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { Script } from 'node:vm';

const projectRoot = resolve(import.meta.dirname, '..');

test('PWA manifest has stable install identity, scoped path and install icons', () => {
  const manifest = JSON.parse(readFileSync(join(projectRoot, 'app/web/manifest.json'), 'utf8'));
  assert.equal(manifest.id, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
});

test('PWA Flutter entry point includes iOS metadata and safe updates', () => {
  const html = readFileSync(join(projectRoot, 'app/web/index.html'), 'utf8');
  assert.match(html, /apple-mobile-web-app-capable/);
  assert.match(html, /pocket-client\.js/);
  assert.match(html, /pocket-ui\.css/);
  assert.match(html, /manifest\.json/);
  const bootstrap = readFileSync(join(projectRoot, 'app/web/flutter_bootstrap.js'), 'utf8');
  assert.match(bootstrap, /_flutter\.loader\.load\(\);/);
  assert.doesNotMatch(bootstrap, /serviceWorkerSettings/);
  const client = readFileSync(join(projectRoot, 'app/web/pocket-client.js'), 'utf8');
  assert.match(client, /HAIZ_APPLY_UPDATE/);
  assert.match(client, /registration\.update\(\)/);
  new Script(client);
});

test('PWA packager generates a versioned, scoped service worker and never precaches an API', () => {
  const folder = mkdtempSync(join(tmpdir(), 'haiz-pwa-test-'));
  try {
    const fixture = {
      'index.html': '<html></html>',
      'flutter_bootstrap.js': '_flutter.loader.load();',
      'main.dart.js': 'start();',
      'manifest.json': '{}',
      'pocket-client.js': 'start();',
      'pocket-ui.css': 'body{}',
      'assets/AssetManifest.bin': 'assets',
      'assets/campus/local.jpg': 'example',
      'canvaskit/canvaskit.wasm': 'renderer',
      'assets/packages/pdfrx/assets/pdfium.wasm': 'optional pdf library',
      'api/user.json': '{"private":true}'
    };
    for (const [path, data] of Object.entries(fixture)) {
      mkdirSync(resolve(folder, path, '..'), { recursive: true });
      writeFileSync(join(folder, path), data);
    }
    writeFileSync(join(folder, 'pocket-sw.js'),
      readFileSync(join(projectRoot, 'app/web/pocket-sw.js'), 'utf8'));
    execFileSync(process.execPath,
      [join(projectRoot, 'scripts/build-pocket-pwa.mjs'), folder],
      { env: { ...process.env, GITHUB_SHA: 'f'.repeat(40) } });
    const result = readFileSync(join(folder, 'pocket-sw.js'), 'utf8');
    const report = JSON.parse(readFileSync(join(folder, 'pwa-build.json'), 'utf8'));
    assert.match(result, /ffffffffffff-/);
    assert.ok(!result.includes('__HAIZ_BUILD_ID__'));
    assert.ok(!result.includes('__HAIZ_PRECACHE__'));
    assert.match(result, /"main\.dart\.js"/);
    assert.ok(!result.includes('"api/user.json"'), "API files must never be cached");
    assert.match(result, /"canvaskit\/canvaskit\.wasm"/);
    assert.ok(!result.includes('"assets/packages/pdfrx/assets/pdfium.wasm"'),
      'Heavy PDFium library should be downloaded only when needed');
    assert.ok(report.offline_asset_bytes <= 24 * 1024 * 1024,
      'Mobile Safari initial shell must remain under 24 MiB');
    assert.ok(report.offline_asset_count > 0);
    assert.equal(report.includes_user_data, false);
    new Script(result);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

#!/usr/bin/env node
/**
 * Turns a Flutter Web release into a scoped HAIZ Pocket PWA.
 * Run AFTER flutter build web --release --base-href /pocket/.
 * Never precache credentials, user data, external endpoints, or API responses.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] || 'app/build/web');
const MAX_PRECACHE_BYTES = 24 * 1024 * 1024;
const MUST_HAVE = [
  'index.html', 'flutter_bootstrap.js', 'main.dart.js',
  'manifest.json', 'pocket-client.js'
];

async function walk(folder) {
  const output = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const abs = join(folder, entry.name);
    if (entry.isDirectory()) {
      output.push(...await walk(abs));
    } else if (entry.isFile()) {
      const path = relative(root, abs).split(sep).join('/');
      if (/^(api|auth|private|user|account)\//i.test(path)) continue;
      if (/\.(map|dSYM)$/i.test(path) ||
          path === 'pocket-sw.js' || path === 'pwa-build.json' ||
          path === 'flutter_service_worker.js') continue;
      output.push({ path, size: (await stat(abs)).size });
    }
  }
  return output;
}

const bootstrap = await readFile(join(root, 'flutter_bootstrap.js'), 'utf8');
if (/_flutter\.loader\.load\s*\(\s*\{[\s\S]{0,200}?serviceWorkerSettings\s*:/.test(bootstrap)) {
  throw new Error('Legacy Flutter worker registration conflicts with pocket-sw.js');
}

const files = await walk(root);
const available = new Map(files.map(file => [file.path, file]));
for (const item of MUST_HAVE) {
  if (!available.has(item)) throw new Error('Required Flutter Web file missing: ' + item);
}
// Precache only the real app shell and renderer paths. Flutter also ships
// symbols, alternate renderers, PDFium and other multi-MB optional assets.
// Those are fetched on demand and cached by the runtime asset handler.
// A huge install event may never finish on mobile Safari.
const canvasKitBuild = /"renderer"\s*:\s*"canvaskit"/.test(bootstrap);
const skwasmBuild = /"renderer"\s*:\s*"skwasm"/.test(bootstrap);
if (!canvasKitBuild && !skwasmBuild) {
  throw new Error('Flutter Web renderer could not be identified for offline caching');
}
const OFFLINE_SHELL = new Set([
  ...MUST_HAVE,
  'flutter.js', 'pocket-ui.css', 'install.html', 'favicon.png',
  ...(canvasKitBuild ? [
    'canvaskit/canvaskit.js', 'canvaskit/canvaskit.wasm',
    'canvaskit/chromium/canvaskit.js', 'canvaskit/chromium/canvaskit.wasm',
    'canvaskit/webparagraph/canvaskit.js', 'canvaskit/webparagraph/canvaskit.wasm'
  ] : []),
  ...(skwasmBuild ? [
    'canvaskit/skwasm.js', 'canvaskit/skwasm.wasm',
    'canvaskit/skwasm_heavy.js', 'canvaskit/skwasm_heavy.wasm',
    'canvaskit/wimp.js', 'canvaskit/wimp.wasm'
  ] : [])
]);
const essential = file => OFFLINE_SHELL.has(file.path) ||
  file.path.startsWith('icons/') ||
  /^assets\/(AssetManifest|FontManifest|fonts\/|shaders\/)/.test(file.path);

const chosen = files.filter(essential)
  .map(file => file.path)
  .sort();
const bytes = chosen.reduce((sum, path) => sum + available.get(path).size, 0);
if (bytes > MAX_PRECACHE_BYTES) {
  throw new Error('The offline shell exceeded the 24 MiB startup budget');
}
const hash = createHash('sha256');
for (const file of files) {
  hash.update(file.path + ':' + file.size + '\n');
}
const commit = (process.env.GITHUB_SHA || 'local').slice(0, 12);
const version = commit + '-' + hash.digest('hex').slice(0, 12);
const swPath = join(root, 'pocket-sw.js');
const source = await readFile(swPath, 'utf8');
if (!source.includes("'__HAIZ_BUILD_ID__'") ||
    !source.includes('__HAIZ_PRECACHE__')) {
  throw new Error('PWA service worker template placeholders are missing');
}
const output = source
  .replace("'__HAIZ_BUILD_ID__'", JSON.stringify(version))
  .replace('__HAIZ_PRECACHE__', JSON.stringify(chosen));
await writeFile(swPath, output);
const report = {
  version, scope: '/pocket/', offline_asset_count: chosen.length,
  offline_asset_bytes: bytes, runtime_asset_policy: 'same-origin static files only',
  includes_user_data: false
};
await writeFile(join(root, 'pwa-build.json'), JSON.stringify(report, null, 2) + '\n');
console.log('HAIZ Pocket PWA ready: ' + JSON.stringify(report));

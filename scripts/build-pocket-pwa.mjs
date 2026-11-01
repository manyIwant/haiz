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
const MAX_PRECACHE_BYTES = 48 * 1024 * 1024;
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

const files = await walk(root);
const available = new Map(files.map(file => [file.path, file]));
for (const item of MUST_HAVE) {
  if (!available.has(item)) throw new Error('Required Flutter Web file missing: ' + item);
}
const essential = file => MUST_HAVE.includes(file.path) ||
  file.path === 'flutter.js' ||
  file.path.startsWith('canvaskit/') ||
  /^assets\/(AssetManifest|FontManifest|NOTICES|fonts\/|packages\/|shaders\/)/.test(file.path);

files.sort((a, b) => Number(essential(b)) - Number(essential(a)) ||
  a.path.localeCompare(b.path));
const chosen = [];
let bytes = 0;
for (const file of files) {
  if (essential(file) || bytes + file.size <= MAX_PRECACHE_BYTES) {
    chosen.push(file.path);
    bytes += file.size;
  }
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

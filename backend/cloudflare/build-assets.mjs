import { mkdir, copyFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const files = [
  ['login/index.html', 'login/index.html'], ['src/account/index.html', 'account/index.html'],
  ['src/account/app.js', 'account/app.js'], ['src/account/style.css', 'account/style.css'],
  ['src/account/session-guard.js', 'account/session-guard.js'], ['src/account/lamp-auth.js', 'src/account/lamp-auth.js'],
  ['backend/client.mjs', 'haiz-client.js'], ['lamp-preview/wall-photo.webp', 'lamp-preview/wall-photo.webp'],
];
export async function buildAssets({ root = fileURLToPath(new URL('../../', import.meta.url)), output = fileURLToPath(new URL('./.generated/assets/', import.meta.url)) } = {}) {
  await rm(output, { recursive: true, force: true });
  for (const [source, destination] of files) {
    const target = path.join(output, destination); await mkdir(path.dirname(target), { recursive: true });
    try { await copyFile(path.join(root, source), target); }
    catch (error) { if (error.code !== 'ENOENT' || source !== 'lamp-preview/wall-photo.webp') throw error; await copyFile(path.join(root, 'public', source), target); }
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildAssets(); console.log(`Prepared ${files.length} public account assets; no database or credentials included.`);
}

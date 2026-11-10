#!/usr/bin/env node
/**
 * Bundle a local-only OCR engine and its language files for Flutter Web.
 *
 * Requirements:
 *   npm install --prefix "$RUNNER_TEMP/haiz-ocr-deps" --no-save
 *      --no-package-lock --ignore-scripts --no-audit --no-fund
 *      tesseract.js@7.0.0 tesseract.js-core@7.0.0
 *      @tesseract.js-data/eng@1.0.0 @tesseract.js-data/chi_sim@1.0.0
 *   node scripts/prepare-pocket-ocr.mjs "$RUNNER_TEMP/haiz-ocr-deps/node_modules"
 *
 * All dependencies are downloaded at BUILD time. At runtime, OCR requests
 * ONLY go to HAIZ /pocket/ocr/...; selected image bytes are never uploaded.
 */
import { readdir, stat, cp, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const modules = resolve(process.argv[2] || 'node_modules');
const dest = resolve(process.argv[3] || 'app/web/ocr');
const minSizes = {eng: 100000, chi_sim: 100000};
const copy = async (source, target) => {
  const size = (await stat(source)).size;
  if (size < 1000) throw new Error('Suspiciously small OCR dependency: ' + source);
  await mkdir(resolve(target, '..'), {recursive:true});
  await copyFile(source, target);
  return {source:source.replace(modules,'<npm>'), file:target.replace(dest,'<pocket>/ocr'), size};
};
await mkdir(dest,{recursive:true});
const files = [];
for (const [source, target] of [
  ['tesseract.js/dist/tesseract.min.js', 'vendor/tesseract.min.js'],
  ['tesseract.js/dist/worker.min.js', 'vendor/worker.min.js'],
  ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz','lang/eng.traineddata.gz'],
  ['@tesseract.js-data/chi_sim/4.0.0_best_int/chi_sim.traineddata.gz','lang/chi_sim.traineddata.gz']
]){
  const x=await copy(join(modules,source), join(dest,target));
  files.push(x);
}
const coreDir = join(modules,'tesseract.js-core');
const cores = (await readdir(coreDir)).filter(name =>
  /^tesseract-core[-a-z0-9]*\.wasm(\.js)?$/.test(name));
if (!cores.includes('tesseract-core.wasm.js') ||
    !cores.some(name => name.includes('lstm') && name.endsWith('.wasm.js')) ||
    !cores.some(name => name.endsWith('.wasm'))) {
  throw new Error('Tesseract.js-core is missing necessary WASM/core variants');
}
for(const name of cores) files.push(await copy(join(coreDir,name),join(dest,'core',name)));
for(const name of ['eng','chi_sim']){
  const entry = files.find(x => x.file.endsWith('/lang/'+name+'.traineddata.gz'));
  if (!entry || entry.size < minSizes[name]) throw new Error('Missing OCR language model: '+name);
}
const manifest=[];
for(const entry of files){
  const full=join(dest,entry.file.split('/ocr/')[1]);
  const hash=createHash('sha256').update(await readFile(full)).digest('hex');
  manifest.push({file:entry.file,bytes:entry.size,sha256:hash});
}
await writeFile(join(dest,'manifest.json'),JSON.stringify({
  engine:'tesseract.js',engineVersion:'7.0.0',coreVersion:'7.0.0',
  models:'@tesseract.js-data chi_sim/eng 4.0.0_best_int',staticOnly:true,
  manifest
},null,2)+'\n');
console.log('HAIZ local OCR vendor ready:',manifest.length,
  'files /', files.reduce((sum,x)=>sum+x.size,0),'bytes');

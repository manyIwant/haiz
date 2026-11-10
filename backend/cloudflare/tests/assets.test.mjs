import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,writeFile,readFile,readdir,rm } from 'node:fs/promises';
import { join,dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { buildAssets } from '../build-assets.mjs';
test('account assets build from both main and prototype layouts without private files',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'haiz-assets-'));
 try {for(const prototype of [false,true]){const root=join(directory,prototype?'prototype':'main'),output=join(directory,prototype?'out-prototype':'out-main');
 const files=['login/index.html','src/account/index.html','src/account/app.js','src/account/style.css','src/account/session-guard.js','src/account/lamp-auth.js','backend/client.mjs',prototype?'public/lamp-preview/wall-photo.webp':'lamp-preview/wall-photo.webp','.env'];
 for(const file of files){await mkdir(dirname(join(root,file)),{recursive:true});await writeFile(join(root,file),file==='\.env'?'private-secret':file);}
 await buildAssets({root,output});assert.equal(await readFile(join(output,'lamp-preview/wall-photo.webp'),'utf8'),files[7]);
 const published=await readdir(output,{recursive:true});assert.ok(!published.includes('.env'));assert.equal(await readFile(join(output,'haiz-client.js'),'utf8'),'backend/client.mjs');}
 }finally{await rm(directory,{recursive:true,force:true});}
});

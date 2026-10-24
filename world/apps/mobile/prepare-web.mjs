import {mkdirSync,readdirSync,cpSync,readFileSync,writeFileSync,rmSync,existsSync,lstatSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const project=fileURLToPath(new URL('../../',import.meta.url));
const home=fileURLToPath(new URL('./',import.meta.url));
const excluded=new Set(['downloads','apps','plugins','scripts','tests','portable','node_modules','docs','build','dist','release','pilot','remotion']);
const serverOnly=new Set(['store.mjs','classroom-server.mjs','identities.json','flow.json','bootstrap-invite.txt','local-demo-keys.json']);
const assetExtensions=new Set(['.html','.js','.mjs','.css','.json','.webmanifest','.svg','.png','.webp','.jpg','.jpeg','.gif','.avif','.woff','.woff2','.ttf','.mp4','.webm','.mp3','.ogg','.wav','.glb','.gltf','.bin','.txt','.md','.ico','.pdf']);
function copyRuntime(from,to){
 mkdirSync(to,{recursive:true});
 for(const item of readdirSync(from,{withFileTypes:true})){
  const name=item.name;
  if(name.startsWith('.')||excluded.has(name)||serverOnly.has(name)||/\.(pem|key|keystore|jks|p12|mobileprovision)$/.test(name))continue;
  const src=path.join(from,name),dst=path.join(to,name);
  if(item.isSymbolicLink())throw Error('Native assets must not contain symlinks: '+src);
  if(item.isDirectory())copyRuntime(src,dst);
  else if(assetExtensions.has(path.extname(name).toLowerCase())||/^(LICENSE|COPYING|NOTICE)(\.|$)/.test(name))cpSync(src,dst);
 }
}
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const migrationScript=`(function(){window.HAIZ_NATIVE_PACKAGE=true;const owned=new Set(['/sw.js','/world/sw.js','/world/flow/sw.js','/world/stillroom/sw.js']);const tasks=[];if('serviceWorker' in navigator)tasks.push(navigator.serviceWorker.getRegistrations().then(regs=>Promise.all(regs.filter(r=>{const worker=r.active||r.waiting||r.installing;return worker&&owned.has(new URL(worker.scriptURL).pathname)}).map(r=>r.unregister()))));if('caches' in window)tasks.push(caches.keys().then(keys=>Promise.all(keys.filter(k=>/^(haiz-shell-|haiz-flow-|haiz-stillroom-)/.test(k)).map(k=>caches.delete(k)))));window.HAIZ_CACHE_MIGRATION=Promise.all(tasks).catch(()=>console.warn('[HAIZ startup] static_cache_migration_failed'))})()`;
export function prepareNativeWeb({mode='integrated',output=path.join(home,'www'),standaloneDirectory=path.join(project,'dist')}={}){
 if(!['integrated','standalone'].includes(mode))throw Error('HAIZ_WEB_MODE must be integrated or standalone');
 const standalone=mode==='standalone',source=standalone?standaloneDirectory:project;
 if(!existsSync(path.join(source,'index.html')))throw Error('Missing explicit web source index: '+source);
 if(path.resolve(output)===path.resolve(source)||path.resolve(source).startsWith(path.resolve(output)+path.sep))throw Error('Output must not contain source');
 rmSync(output,{recursive:true,force:true});mkdirSync(output,{recursive:true});
 let entry;
 if(standalone){copyRuntime(source,output);entry=output;}
 else{
  const original=path.dirname(project);
  for(const item of readdirSync(original,{withFileTypes:true})){
   const name=item.name;if(name.startsWith('.')||excluded.has(name)||name==='world')continue;
   if(item.isSymbolicLink())throw Error('Native root must not contain symlinks');
   if(item.isDirectory())copyRuntime(path.join(original,name),path.join(output,name));
   else if(assetExtensions.has(path.extname(name).toLowerCase())||/^(LICENSE|COPYING|NOTICE)(\.|$)/.test(name))cpSync(path.join(original,name),path.join(output,name));
  }
  entry=path.join(output,'world');copyRuntime(source,entry);
  writeFileSync(path.join(output,'index.html'),`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#F3F1EC"><title>HAIZ</title><style>body{margin:0;padding:24px;background:#f3f1ec;color:#242a38;font:16px system-ui;display:grid;min-height:80vh;place-content:center}a{display:block;min-height:44px;padding:12px;color:#3c5abc}@media(prefers-color-scheme:dark){body{background:#0e121d;color:#f0f2f8}a{color:#abbcff}}</style></head><body><main><h1>HAIZ</h1><p>正在打开书桌…</p><a href="./world/index.html#study">打开离线书桌</a></main><script>${migrationScript};(function(){let entered=false;function open(){if(entered)return;entered=true;location.replace('./world/index.html#study')}setTimeout(open,500);window.HAIZ_CACHE_MIGRATION.finally(open)})()</script></body></html>`);
 }
 const index=path.join(entry,'index.html');let html=readFileSync(index,'utf8');
 const appScript='<script type="module" src="app.js"></script>';
 if(!html.includes(appScript))throw Error('Native web entry does not contain the HAIZ app module');
 // No large environment asset is needed before the first interactive DOM render.
 html=html.replace(/<link\b[^>]*rel="preload"[^>]*as="image"[^>]*>/g,'');
 html=html.replace('</head>','<script>'+migrationScript+'</script><link rel="stylesheet" href="mobile-shell.css"><script defer src="mobile-shell.js"></script></head>')
  .replace(appScript,'<script src="mobile-boot.js"></script>'+appScript);
 writeFileSync(index,html);
 for(const file of ['mobile-shell.js','mobile-shell.css','mobile-boot.js'])cpSync(path.join(home,file),path.join(entry,file));
 // Package-only transform: web/PWA sources keep their original caching behavior.
 for(const file of walk(output).filter(f=>/\.(js|html)$/.test(f))){
  let content=readFileSync(file,'utf8');
  const next=content.replace(/navigator\.serviceWorker\.register\((['"])\.\/sw\.js\1\)/g,'Promise.resolve(null) /* Native: bundled assets, no PWA worker */');
  if(next!==content)writeFileSync(file,next);
 }
 let commit='unknown';try{commit=execFileSync('git',['rev-parse','HEAD'],{cwd:project,encoding:'utf8'}).trim();}catch{}
 const version=JSON.parse(readFileSync(path.join(home,'package.json'),'utf8')).version;
 const files=walk(output).map(file=>({path:path.relative(output,file).split(path.sep).join('/'),bytes:lstatSync(file).size,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')}));
 writeFileSync(path.join(output,'asset-manifest.json'),JSON.stringify({format:1,files},null,2));
 writeFileSync(path.join(output,'build-info.json'),JSON.stringify({version,commit,builtAt:new Date().toISOString(),dataMode:'offline-local-demo',entry:standalone?'/':'/world/',sourceMode:mode},null,2));
 console.log(`Native assets prepared: ${mode}, ${files.length} files, ${version}, ${commit}`);
 return {output,entry,mode};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))prepareNativeWeb({mode:process.env.HAIZ_WEB_MODE||'integrated'});

import {existsSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const home=fileURLToPath(new URL('../',import.meta.url));
export function verifyBundle(directory,{syncedCopies=[]}={}) {
 const www=path.resolve(directory),read=name=>readFileSync(path.join(www,name));
 for(const name of ['index.html','asset-manifest.json','build-info.json'])assert.ok(existsSync(path.join(www,name)),'Missing native asset: '+name);
 const build=JSON.parse(read('build-info.json'));
 assert.ok(['integrated','standalone'].includes(build.sourceMode),'Explicit packaging sourceMode required');
 assert.match(build.commit,/^[a-f0-9]{40}$/,'Bundle must record actual Git SHA');
 assert.match(build.version,/^\d+\.\d+\.\d+(?:-[\w.]+)?$/,'Bundle version required');
 const prefix=build.sourceMode==='integrated'?'world/':'';
 const required=['index.html','app.js','mobile-boot.js','mobile-shell.js','mobile-shell.css','style.css','lucent/dock.js','lucent/spring.js','cinema/player.js','cinema/identity.js','cinema/media/HAIZ-porcelain.mp4','cinema/media/HAIZ-obsidian.mp4','cinema/media/HAIZ-ocean.mp4','cinema/media/poster.png','round2-ui.js','room/scene/index.html','assets/campus.webp','campus.html'].map(n=>prefix+n);
 if(build.sourceMode==='integrated')required.push('assets/js/three-campus.js',prefix+'stillroom/quality-governor.js',prefix+'room/immersive/index.html',prefix+'room/immersive/scene.css',prefix+'room/immersive/scene.js');
 for(const name of required)assert.ok(existsSync(path.join(www,name)),'Missing native asset: '+name);
 if(prefix){const root=read('index.html').toString();assert.match(root,/\.\/world\/index\.html#study/,'Native entry must target an actual HTML file');assert.match(root,/getRegistrations/,'Native entry must migrate old static workers');}
 const nativeApp=read(prefix+'app.js').toString();
 assert.ok(!nativeApp.includes("navigator.serviceWorker.register('./sw.js')"),'Native app must not register a PWA cache worker');
 const entry=read(prefix+'index.html').toString();
 assert.match(entry,/<script src="mobile-boot\.js"><\/script><script type="module" src="app\.js"><\/script>/);
 assert.ok(entry.includes('mobile-shell.js')&&entry.includes('mobile-shell.css'));
 assert.match(read(prefix+'mobile-boot.js').toString(),/haiz-native-boot/);
 assert.ok(!existsSync(path.join(www,prefix+'pilot/server.mjs')),'Server must not ship in native package');
 const manifest=JSON.parse(read('asset-manifest.json'));
 assert.equal(manifest.format,1);assert.ok(manifest.files.length>10,'Runtime manifest cannot be empty');
 const seen=new Set();
 for(const item of manifest.files){
  assert.ok(typeof item.path==='string'&&!item.path.startsWith('/')&&!item.path.split('/').includes('..'),'Unsafe manifest path');
  assert.ok(!seen.has(item.path),'Duplicate manifest path '+item.path);seen.add(item.path);
  assert.ok(!/(?:^|\/)(?:identities\.json|bootstrap-invite\.txt|local-demo-keys\.json)$|\.(?:pem|key|keystore|jks|p12|mobileprovision)$/.test(item.path),'Private runtime credential shipped: '+item.path);
  const bytes=read(item.path);assert.equal(bytes.length,item.bytes,'Asset size mismatch '+item.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256,'Asset hash mismatch '+item.path);
  for(const copy of syncedCopies){assert.ok(existsSync(path.join(copy,item.path)),'Capacitor copy missing '+item.path);assert.equal(createHash('sha256').update(readFileSync(path.join(copy,item.path))).digest('hex'),item.sha256,'Capacitor stale asset '+item.path);}
 }
 for(const name of required)assert.ok(seen.has(name),'Required runtime absent from manifest '+name);
 for(const copy of syncedCopies)for(const name of ['asset-manifest.json','build-info.json'])assert.deepEqual(readFileSync(path.join(copy,name)),read(name),'Capacitor metadata differs '+name);
 return {status:'PASS',mode:build.sourceMode,version:build.version,commit:build.commit,files:manifest.files.length,copies:syncedCopies.length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const override=process.env.HAIZ_VERIFY_WEB_ROOT;
 const copies=override?[]:['android/app/src/main/assets/public','ios/App/App/public'].map(p=>path.join(home,p)).filter(existsSync);
 const result=verifyBundle(override||path.join(home,'www'),{syncedCopies:copies});
 console.log(JSON.stringify(result));
}

import {existsSync,readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const home=fileURLToPath(new URL('../',import.meta.url));
const www=path.join(home,'www');
const required=[
 'index.html','world/index.html','world/app.js','world/mobile-boot.js',
 'world/mobile-shell.js','world/mobile-shell.css','world/style.css',
 'world/lucent/dock.mjs','world/lucent/spring.mjs','asset-manifest.json','build-info.json',
 'world/round2-ui.js','world/room/scene/index.html',
 'world/assets/campus.webp','world/campus.html','assets/js/three-campus.js'
];
for(const name of required)assert.ok(existsSync(path.join(www,name)),'Missing native asset: '+name);
const root=readFileSync(path.join(www,'index.html'),'utf8');
assert.match(root,/\.\/world\/index\.html#study/,'Native entry must target an actual HTML file');
assert.match(root,/getRegistrations/,'Old WebView service workers must be unregistered on native entry');
const nativeApp=readFileSync(path.join(www,'world/app.js'),'utf8');
assert.ok(!nativeApp.includes("navigator.serviceWorker.register('./sw.js')"),'Native app must not register a PWA cache worker');
const entry=readFileSync(path.join(www,'world/index.html'),'utf8');
assert.match(entry,/<script src="mobile-boot\.js"><\/script><script type="module" src="app\.js"><\/script>/);
assert.ok(entry.includes('mobile-shell.js') && entry.includes('mobile-shell.css'));
const boot=readFileSync(path.join(www,'world/mobile-boot.js'),'utf8');
assert.match(boot,/重试启动/);
assert.match(boot,/haiz-native-boot/);
const appDir=path.join(home,'android/app/src/main/assets/public');
if(existsSync(appDir))assert.ok(existsSync(path.join(appDir,'world/mobile-boot.js')),'Capacitor Android assets not synced');
const icons=['brand/app-icon.svg','scripts/generate-icons.py'];
for(const name of icons)assert.ok(existsSync(path.join(home,name)));
console.log('PASS: Native Android and iOS web bundle entry, boot fallback, startup module and key assets present.');

assert.ok(!existsSync(path.join(www,'world/pilot/server.mjs')),'Server must not ship in native package');
const manifest=JSON.parse(readFileSync(path.join(www,'asset-manifest.json')));
for(const item of manifest.files)assert.ok(existsSync(path.join(www,item.path)),'Manifest resource missing '+item.path);

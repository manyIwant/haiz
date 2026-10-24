import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFileSync(join(root,p),'utf8');
test('the editorial demo is actually reachable from the campus and native Web package',()=>{
 const app=read('app.js'),motion=read('motion/index.html');
 assert.match(app,/href="motion\/"/);
 for(const name of ['motion/index.html','motion/theme-before.js','motion/connected.js','motion/connected.css','motion/archive/identity-01.html']) assert.ok(existsSync(join(root,name)),name);
 for(const asset of ['theme-before.js','connected.css','connected.js']) assert.ok(motion.includes('./'+asset),'Missing integration asset '+asset);
});
test('handoff routes to real business modules, never simulates server authentication',()=>{
 const bridge=read('motion/connected.js');
 assert.match(bridge,/\.\.\/index\.html#study/);
 assert.match(bridge,/\.\.\/index\.html#atlas/);
 assert.match(bridge,/\.\.\/flow\//);
 assert.match(bridge,/u\.protocol!=='https:'/);
 assert.doesNotMatch(bridge,/Bearer |token=|password=/);
 assert.match(bridge,/不在 URL 中携带邀请码或密码/);
 const flow=read('flow/app.js');
 assert.match(flow,/\/api\/flow\//);
 assert.match(flow,/api\("me"\)/);
});
test('Flow keeps its own server-side role check while accepting only public visual preferences',()=>{
 const html=read('flow/index.html'),early=read('flow/appearance-start.js'),watch=read('flow/appearance-watch.js');
 assert.ok(html.includes('appearance-start.js')&&html.includes('appearance-watch.js')&&html.includes('fieldnotes-tone.css'));
 assert.match(early,/haiz\.lucent\.preferences\.v1/);
 assert.match(watch,/haiz\.flow\.theme/);
 assert.ok(read('flow/fieldnotes-tone.css').includes('data-theme="contrast"'));
 assert.match(read('motion/index.html'),/演示/);
});
test('bundler never ships private backend or Remotion sources into native apps',()=>{
 const prep=read('apps/mobile/prepare-web.mjs');
 for(const dir of ['pilot','plugins','remotion'])assert.ok(prep.includes("'"+dir+"'"),dir);
 for(const item of ['identities.json','local-demo-keys.json','store.mjs'])assert.ok(prep.includes("'"+item+"'"),item);
});

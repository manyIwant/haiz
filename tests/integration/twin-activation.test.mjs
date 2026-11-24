import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('sixth act starts active free roam',()=>{
 const s=read('lanren/world/world.js');
 assert.match(s,/class="wd-ruhua" href="ruhua-free\.html\?stage=stroll"/);
 assert.match(s,/href: 'ruhua-free\.html\?stage=stroll'/);
 assert.match(read('ruhua-free.html'),/data-thread="mark"/);
 assert.match(read('lanren/free/main.js'),/Q.get\('stage'\) === 'stroll'/);
});
test('all nine runtime derivatives exist and keep master provenance',()=>{
 const m=JSON.parse(read('twin/assets/runtime/manifest.json'));
 const keys=['arts','erhao','forecourt','landmark','science','south_classrooms','terminalia','yanchi','yihao'];
 assert.deepEqual(Object.keys(m.parts).sort(),keys);
 for(const k of keys){assert.ok(existsSync(new URL('../../twin/assets/runtime/'+k+'.glb',import.meta.url)));assert.match(m.parts[k].source_sha256,/^[a-f0-9]{64}$/);}
 const tree=JSON.parse(read('twin/assets/runtime/tree-animation.json'));assert.equal(tree.stride,16);assert.ok(tree.count>1000);
});
test('one campus asset loader in map, living world and art lab; one animated tree source',()=>{
 assert.match(read('lanren/map/section.js'),/loadCampusV3/);
 assert.match(read('lanren/ruhua/world.js'),/loadCampusV3/);
 assert.match(read('lanren/map/campus-v3.js'),/upgradeCampusLandmarks\(entries, geo, scene, hulls\)/);
 assert.match(read('lanren/js/scene.js'),/loadAtelierTree/);
 assert.match(read('lanren/ruhua/v4.js'),/loadAtelierTree/);
 assert.match(read('lanren/painted-lab/main.js'),/loadAtelierPart\('terminalia'\)/);
 assert.match(read('lanren/map/atelier.js'),/hideMasterLeaves/);
 assert.match(read('lanren/map/twin-phase2.js'),/forecourt','landmark','yanchi/);
});

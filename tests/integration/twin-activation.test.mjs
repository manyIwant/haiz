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

// A network-bound atelier upgrade must never gate map navigation.
test('map unfold and 3D deep links are independent of GLB loading',()=>{
 const s=read('lanren/map/map.js');
 const unfold=s.slice(s.indexOf('  function unfold('),s.indexOf('  function fold('));
 assert.match(unfold,/section\.loadBlender\(\);/);
 assert.doesNotMatch(unfold,/loadingBlender|waitingToUnfold|\.then\(/);
 assert.match(unfold,/startTrans\(1, path/);
 assert.doesNotMatch(s,/waitingFor3d/);
 const section=read('lanren/map/section.js');
 const install=section.slice(section.indexOf('  function installV3('),section.indexOf('  function updateBuildings('));
 assert.match(install,/Array\.isArray\(object\.material\)/);
 assert.ok(install.indexOf('v3 = loaded;')>install.indexOf('group.add(loaded.scene);'));
});

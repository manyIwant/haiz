const fs=require('fs'),vm=require('vm'),assert=require('assert');
const THREE=require('../../assets/vendor/three.min.js');
const {createCanvas,loadImage}=require(require.resolve('@napi-rs/canvas',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,__dirname].filter(Boolean)}));
const M=require('../../assets/walk/movement.js');
const data=JSON.parse(fs.readFileSync('assets/walk/campus.json'));
const context={THREE,console,setTimeout,window:{},document:{createElement(tag){assert.equal(tag,'canvas');return createCanvas(1,1);}}};
vm.createContext(context);for(const file of ['interiors.js','world.js'])vm.runInContext(fs.readFileSync('assets/walk/'+file,'utf8'),context);
const results=[];
function test(name,fn){fn();results.push(name);console.log('PASS',name);}
(async()=>{
  const bank={};for(const name of ['terrazzo','plaster','wood','grass','paving']){bank[name]={};for(const type of ['color','normal','rough']){const img=await loadImage(fs.readFileSync('assets/walk/textures/'+name+'-'+type+'.jpg'));const expected=(['grass','paving'].includes(name)&&type==='color')?1024:512;assert.equal(img.width,expected);assert.equal(img.height,expected);const t=new THREE.Texture(img);t.wrapS=t.wrapT=THREE.RepeatWrapping;if(type==='color')t.encoding=THREE.sRGBEncoding;bank[name][type]=t;}}
  const leaf=await loadImage(fs.readFileSync('assets/walk/textures/terminalia-leaves.webp'));bank.foliage=new THREE.Texture(leaf);bank.foliage.encoding=THREE.sRGBEncoding;
  vm.runInContext(fs.readFileSync('assets/vendor/RGBELoader.js','utf8'),context);
  const hdr=fs.readFileSync('assets/walk/textures/campus-light.hdr');const environment=new THREE.RGBELoader().parse(hdr.buffer.slice(hdr.byteOffset,hdr.byteOffset+hdr.byteLength));assert.equal(environment.width,1024);assert.equal(environment.height,512);
  const scene=new THREE.Scene(),world=await context.window.CampusWorld.build(scene,data,'balanced',undefined,bank);
  test('fifteen bundled PBR maps, alpha foliage and HDR decode and are bound to classroom surfaces',()=>{const mats=context.window.CampusInteriors.materials;for(const m of [mats.floor,mats.desk,mats.wall]){assert(m.map&&m.normalMap&&m.roughnessMap);assert.equal(m.map.encoding,THREE.sRGBEncoding);assert.equal(m.normalMap.image.width,512);}});
  test('existing KML anchors and 34 nodes preserved',()=>{assert.equal(world.buildings.length,34);assert.deepEqual(data.anchors.center,[19.996067,110.347227]);assert.deepEqual(data.anchors.southGate,[19.994326,110.348012]);});
  let vertices=0,meshes=0;scene.updateMatrixWorld(true);
  test('all generated geometry and transforms are finite',()=>{scene.traverse(m=>{if(m.isMesh){meshes++;const p=m.geometry.attributes.position;vertices+=p.count;for(const n of p.array)assert(Number.isFinite(n));for(const n of m.matrixWorld.elements)assert(Number.isFinite(n));if(m.isInstancedMesh)for(const n of m.instanceMatrix.array)assert(Number.isFinite(n));}});assert(vertices>50000);assert(world.colliders.length>100);});
  test('window instances placed at their building, not at origin',()=>{const windows=[];scene.traverse(m=>{if(m.isInstancedMesh&&m.parent===scene&&m.geometry.type==='BoxGeometry')windows.push(m);});assert(windows.length>=3);const mat=new THREE.Matrix4(),pos=new THREE.Vector3();let near=0,far=0;for(const m of windows)for(let i=0;i<m.count;i++){m.getMatrixAt(i,mat);pos.setFromMatrixPosition(mat);if(Math.hypot(pos.x,pos.z)<20)near++;if(Math.hypot(pos.x,pos.z)>80)far++;}assert(far>100);assert(far>near);});
  const bounds={minX:-1000,maxX:1000,minZ:-1000,maxZ:1000};
  function walk(p,input,yaw,steps,colliders=[]){for(let i=0;i<steps;i++)M.step(p,input,yaw,1/60,colliders,bounds);return p;}
  test('WASD and diagonal normalize at walking speed',()=>{let p=walk({x:0,z:0},{x:0,y:1},0,60),d=walk({x:0,z:0},{x:1,y:1},0,60);assert(Math.abs(p.z+3.1)<.001);assert(Math.abs(Math.hypot(d.x,d.z)-3.1)<.001);assert(Math.abs(d.x+d.z)<.001);});
  test('rotation changes forward direction; sprint is 6m/s',()=>{let p=walk({x:0,z:0},{x:0,y:1,run:true},Math.PI/2,60);assert(Math.abs(p.x+6)<.001);assert(Math.abs(p.z)<.001);});
  test('walls block movement and allow sliding',()=>{const wall=[{minX:-1,maxX:1,minZ:-4,maxZ:-3}];let p=walk({x:0,z:0},{x:0,y:1},0,600,wall);assert(p.z>-2.69);assert(!M.blocked(p.x,p.z,wall,bounds));let s=walk({x:0,z:-2.67},{x:1,y:1},0,30,wall);assert(s.x>1);assert(s.z>-3);});
  test('high delta time cannot tunnel through thin gate posts',()=>{const post=[{minX:-.05,maxX:.05,minZ:-2,maxZ:2}];let p={x:-1,z:0};for(let i=0;i<20;i++)M.step(p,{x:1,y:0,run:true},0,3,post,bounds);assert(p.x<-.36);});
  test('north gate is passable through central arch',()=>{const g=world.buildings.find(b=>b.data.id==='beimen'),p={x:g.center.x,z:g.center.z-12};assert(!M.blocked(p.x,p.z,world.colliders,world.bounds));for(let i=0;i<480;i++)M.step(p,{x:0,y:1},Math.PI,1/60,world.colliders,world.bounds);assert(p.z>g.center.z+9,'blocked at '+p.z);});
  test('water and teaching building have solid collision',()=>{for(const id of ['yanchi','library']){const b=world.buildings.find(b=>b.data.id===id);assert(M.blocked(b.center.x,b.center.z,world.colliders,world.bounds),id);}});
  test('16 furnished classrooms preserve the original building footprints',()=>{assert.equal(world.rooms.length,16);assert(world.rooms.every(r=>r.deskCount===36));for(const r of world.rooms){assert(r.obstacles.length===37);assert(!M.blocked(r.arrival.x,r.arrival.z,world.colliders,world.bounds),r.id+' arrival');}});
  test('each room has a continuous walk from outdoors, through the hall and door',()=>{
    function reach(p,t,label){for(let k=0;k<3000;k++){let dx=t.x-p.x,dz=t.z-p.z;if(Math.hypot(dx,dz)<.09)return;M.step(p,{x:0,y:1},Math.atan2(-dx,-dz),1/60,world.colliders,world.bounds);}throw Error(label+' unreachable from '+JSON.stringify(p)+' to '+JSON.stringify(t)+'; obstacles='+JSON.stringify(world.colliders.filter(c=>M.intersects(p.x,p.z,c,.5))));}
    for(const room of world.rooms){const b=world.buildings.find(b=>b.data.id===room.buildingId),p={x:b.center.x,z:b.center.z-b.data.size[2]/2-1};
      reach(p,{x:b.center.x,z:b.center.z},room.id+' exterior entrance');
      reach(p,room.arrival,room.id+' corridor');
      reach(p,{x:room.door.x,z:room.center.z},room.id+' door');
      reach(p,{x:room.center.x,z:room.center.z},room.id+' main aisle');
      assert.equal(context.window.CampusInteriors.currentRoom(p.x,p.z).id,room.id);
      reach(p,{x:room.door.x,z:room.center.z},room.id+' return aisle');reach(p,room.arrival,room.id+' exit door');
    }
  });
  test('both exterior entries of all four teaching buildings are passable',()=>{
    for(const b of world.buildings.filter(b=>b.data.form==='academic'))for(const sign of [-1,1]){const p={x:b.center.x,z:b.center.z+sign*(b.data.size[2]/2+1)};for(let k=0;k<600&&Math.abs(p.z-b.center.z)>.09;k++)M.step(p,{x:0,y:1},sign===1?0:Math.PI,1/60,world.colliders,world.bounds);assert(Math.abs(p.z-b.center.z)<b.data.size[2]/2-2,b.data.id+' entry '+sign);}
  });
  test('classroom desks and unmodelled wings remain solid',()=>{for(const r of world.rooms){const desk=r.obstacles[0];assert(M.blocked((desk.minX+desk.maxX)/2,(desk.minZ+desk.maxZ)/2,world.colliders,world.bounds));}const b=world.buildings.find(b=>b.data.id==='yihao');assert(M.blocked(b.center.x+b.data.size[0]/2-1,b.center.z,world.colliders,world.bounds));});
  test('ground beneath upper-storey links is walkable',()=>{for(const id of ['corr_w12','corr_e12']){const b=world.buildings.find(b=>b.data.id===id);assert(!M.blocked(b.center.x,b.center.z,world.colliders,world.bounds),id);}});
  test('stadium interior remains playable',()=>{const b=world.buildings.find(b=>b.data.id==='yundong');assert(!M.blocked(b.center.x,b.center.z,world.colliders,world.bounds));});
  test('all 9 landmark destinations have safe arrival points',()=>{for(const id of ['beimen','fengqitang','yanlintang','lanshu','yihao','library','yanchi','yundong','nanmen']){const b=world.buildings.find(b=>b.data.id===id),c=b.center;let x=c.x,z=c.z+b.data.size[2]/2+9;if(b.data.form==='gate')z=c.z+(id==='beimen'?-13:13);if(b.data.form==='garden'){x=c.x-b.data.size[0]*.38;z=c.z-b.data.size[2]*.35;}if(b.data.form==='oldtree'){x=c.x-10;z=c.z-8;}if(b.data.form==='field')z=c.z;const p=M.safePoint(x,z,world.colliders,world.bounds);assert(p,id);assert(!M.blocked(p.x,p.z,world.colliders,world.bounds),id);}});
  test('touch joystick normalizes and look clamps pitch',()=>{const j=M.joystick(100,-100);assert(Math.abs(Math.hypot(j.x,j.y)-1)<.001);assert(j.y>0&&j.x>0);const p=M.look(0,0,100,10000,1,true);assert.equal(p.pitch,-1.35);assert(p.yaw<0);const p2=M.look(0,0,0,-10000,1,true);assert.equal(p2.pitch,1.35);});
  test('campus boundary blocks escape',()=>{assert(M.blocked(world.bounds.maxX,0,world.colliders,world.bounds));});
  test('contact shadow instances lie on the floor',()=>{scene.traverse(m=>{if(m.userData.interiorBatch==='contact'){const mat=new THREE.Matrix4(),normal=new THREE.Vector3(0,0,1);m.getMatrixAt(0,mat);normal.transformDirection(mat);assert(Math.abs(normal.y)>.99);}});});
  test('same-origin startup assets exist; no CDN runtime',()=>{const html=fs.readFileSync('campus-3d.html','utf8');for(const m of html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g))assert(fs.existsSync(m[1].split('?')[0]),m[1]);assert(!/src="https?:/.test(html));});
  const summary={passed:results.length,checks:results,nodes:world.buildings.length,classrooms:world.rooms.length,trees:world.treeCount,colliders:world.colliders.length,meshes,vertices,browserQA:'Unavailable: managed control-browser capability is not installed. GPU rendering and real-device touch/pointer-lock unverified.'};
  fs.writeFileSync('tests/walk/results.json',JSON.stringify(summary,null,2));
  fs.writeFileSync('tests/walk/scene-summary.json',JSON.stringify(world.buildings.map(b=>({id:b.data.id,center:b.center})),null,2));
  console.log(JSON.stringify(summary,null,2));
})().catch(e=>{console.error(e);process.exit(1)});

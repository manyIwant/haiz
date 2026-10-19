const fs=require('fs'),vm=require('vm'),assert=require('assert');
const THREE=require('../../assets/vendor/three.min.js');
const {createCanvas,loadImage}=require(require.resolve('@napi-rs/canvas',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,__dirname].filter(Boolean)}));
const M=require('../../assets/walk/movement.js');
const data=JSON.parse(fs.readFileSync('assets/walk/campus.json'));
const context={THREE,console,setTimeout,window:{},document:{createElement(tag){assert.equal(tag,'canvas');return createCanvas(1,1);}}};
vm.createContext(context);for(const file of ['interiors.js','memory-art.js','surfaces.js','architecture.js','atelier.js','landscape.js','world.js'])vm.runInContext(fs.readFileSync('assets/walk/'+file,'utf8'),context);
const results=[];
function test(name,fn){fn();results.push(name);console.log('PASS',name);}
(async()=>{
  const bank={};for(const name of ['terrazzo','plaster','wood','grass','paving']){bank[name]={};for(const type of ['color','normal','rough']){const img=await loadImage(fs.readFileSync('assets/walk/textures/'+name+'-'+type+'.jpg'));const expected=(['grass','paving'].includes(name)&&type==='color')?1024:512;assert.equal(img.width,expected);assert.equal(img.height,expected);const t=new THREE.Texture(img);t.wrapS=t.wrapT=THREE.RepeatWrapping;if(type==='color')t.encoding=THREE.sRGBEncoding;bank[name][type]=t;}}
  const leaf=await loadImage(fs.readFileSync('assets/walk/textures/terminalia-leaves.webp'));bank.foliage=new THREE.Texture(leaf);bank.foliage.encoding=THREE.sRGBEncoding;
  const glaze=await loadImage(fs.readFileSync('assets/walk/textures/jade-glaze-generated.webp'));assert.equal(glaze.width,1024);assert.equal(glaze.height,1024);bank.glaze=new THREE.Texture(glaze);
  vm.runInContext(fs.readFileSync('assets/vendor/RGBELoader.js','utf8'),context);
  const hdr=fs.readFileSync('assets/walk/textures/campus-light.hdr');const environment=new THREE.RGBELoader().parse(hdr.buffer.slice(hdr.byteOffset,hdr.byteOffset+hdr.byteLength));assert.equal(environment.width,1024);assert.equal(environment.height,512);
  const scene=new THREE.Scene(),world=await context.window.CampusWorld.build(scene,data,'balanced',undefined,bank);
  test('indexed static batches preserve triangles and animated fan transforms',()=>{
    let saved=0,fans=0,shades=0;scene.traverse(o=>{saved+=o.geometry?.userData.preservedIndexSavings||0;shades+=o.userData.contactShadeCount||0;if(o.userData.dynamicTransform){assert(o.matrixAutoUpdate);fans++;}});
    assert(saved>1000000);assert.equal(fans,32);assert.equal(shades,world.treeCount);
    const arts=world.buildings.find(b=>b.data.id==='yishu');assert.equal(arts.group.userData.atelier,'arts-red-hipped-portico');
    assert(!scene.matrixAutoUpdate);assert(!arts.group.matrixAutoUpdate);
  });
  test('indexed collision broad phase keeps complete walking trajectories identical',()=>{
    const index=M.spatialIndex(world.colliders);for(const building of world.buildings){const start=M.safePoint(building.center.x,building.center.z,world.colliders,world.bounds);if(!start)continue;const a={...start},b={...start};for(let i=0;i<180;i++){const input={x:Math.sin(i*.13),y:Math.cos(i*.17),run:i%3===0},yaw=i*.03;M.step(a,input,yaw,1/30,world.colliders,world.bounds);M.step(b,input,yaw,1/30,index,world.bounds);assert.deepEqual(a,b);}}
  });
  test('photo-informed facade materials have bump and roughness maps with metric UVs',()=>{
    const kinds=new Set();let projected=0;
    scene.traverse(m=>{if(!m.isMesh||!m.material?.userData.surfaceStudy)return;
      const mat=m.material;kinds.add(mat.userData.surfaceStudy);assert(mat.bumpMap&&mat.roughnessMap&&mat.normalMap);assert.equal(mat.map.encoding,THREE.sRGBEncoding);assert.notEqual(mat.bumpMap.encoding,THREE.sRGBEncoding);assert.notEqual(mat.normalMap.encoding,THREE.sRGBEncoding);assert.equal(mat.normalMap.image.width,512);
      const uv=m.geometry.attributes.uv;assert(uv&&Array.from(uv.array).every(Number.isFinite));
      if(m.geometry.userData.metricUV)projected++;
    });assert.deepEqual([...kinds].sort(),['ceramic','forecourt','granite','roof','stone','timber']);assert(projected>0);
    const mat=new THREE.MeshStandardMaterial();mat.userData.metricTile=2;
    const group=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(12,4,2),mat);group.add(mesh);context.window.CampusSurfaces.project(group);
    const uv=mesh.geometry.attributes.uv;assert(Math.max(...Array.from(uv.array))>=3,'12-unit wall must not stretch one tile');
  });
  test('fifteen bundled PBR maps, alpha foliage and HDR decode and are bound to classroom surfaces',()=>{const mats=context.window.CampusInteriors.materials;for(const m of [mats.floor,mats.desk,mats.wall]){assert(m.map&&m.normalMap&&m.roughnessMap);assert.equal(m.map.encoding,THREE.sRGBEncoding);assert.equal(m.normalMap.image.width,512);}});
  test('original generated glaze is decoded on green roofs without replacing red roof albedo',()=>{let green=0,red=0;scene.traverse(o=>{const m=o.material;if(m?.userData.surfaceStudy!=='roof')return;if(m.userData.generatedGlaze){green++;assert.equal(m.map.image.width,1024);assert.equal(m.map.wrapS,THREE.MirroredRepeatWrapping);assert.equal(m.map.encoding,THREE.sRGBEncoding);}else{red++;assert.equal(m.map.image.width,512);}});assert(green&&red);});
  test('existing KML anchors and 34 nodes preserved',()=>{assert.equal(world.buildings.length,34);assert.deepEqual(data.anchors.center,[19.996067,110.347227]);assert.deepEqual(data.anchors.southGate,[19.994326,110.348012]);});
  test('curved hip surfaces face upward and double-eave tile geometry is quality-scalable',()=>{const mat=new THREE.MeshStandardMaterial(),roof=context.window.CampusAtelier.roof(30,10,2,1,mat,mat,true);assert(roof.userData.architecturalRoof&&roof.userData.tileDetail);const faces=roof.children.filter(o=>o.geometry?.userData.metricUV);assert.equal(faces.length,4);for(const o of faces){const n=o.geometry.attributes.normal;let y=0;for(let i=0;i<n.count;i++)y+=n.getY(i);assert(y/n.count>.2,'roof normals must face the sky');}const simple=context.window.CampusAtelier.roof(30,10,2,1,mat,mat,false);assert(simple.children[0].geometry.attributes.position.count<faces[0].geometry.attributes.position.count/5);});
  test('roof intrados face downward so slopes are not transparent from an eye-level porch view',()=>{const mat=new THREE.MeshStandardMaterial(),roof=context.window.CampusAtelier.roof(30,10,2,1,mat,mat,false),inside=roof.children.filter(o=>o.geometry?.userData.architecturalIntrados);assert.equal(inside.length,4);for(const o of inside){const n=o.geometry.attributes.normal;let y=0;for(let i=0;i<n.count;i++)y+=n.getY(i);assert(y/n.count<-.2);}});
  test('photograph-informed hall, library silhouette and recessed academic facade replace generic forms',()=>{let hall=0,library=0,slots=0;scene.traverse(o=>{if(o.userData.atelier==='double-eave-hall')hall++;if(o.userData.atelier==='library-dome-arcade')library++;if(o.userData.openPlantSlot)slots++;});assert.equal(hall,1);assert.equal(library,1);assert.equal(slots,3);assert(world.buildings.find(b=>b.data.id==='yihao').group.userData.recessedFacade);});
  test('photo-informed teaching entrance, brushed cupola maps and horizontal contact accents',()=>{assert.equal(world.buildings.find(b=>b.data.id==='yihao').group.userData.photographicEntrance,'stepped-cornice-stone-piers');let domes=0,contacts=0;scene.traverse(o=>{if(o.userData.brushedMetal){domes++;assert(o.material.normalMap&&o.material.roughnessMap);assert.notEqual(o.material.normalMap.encoding,THREE.sRGBEncoding);}if(o.userData.approximateContact){contacts++;assert.equal(o.material.depthWrite,false);}});assert.equal(domes,1);assert(contacts>=8);});
  test('library cupola is not hidden behind its own front roofline from the default exterior view',()=>{const b=world.buildings.find(b=>b.data.id==='library');scene.updateMatrixWorld(true);let dome;b.group.traverse(o=>{if(o.userData.libraryDome)dome=o;});assert(dome);const target=dome.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,2,0)),from=new THREE.Vector3(b.center.x-b.data.size[0]*.1,1.85,b.center.z+b.data.size[2]/2+30),direction=target.clone().sub(from).normalize(),hits=new THREE.Raycaster(from,direction,0,from.distanceTo(target)+3).intersectObject(b.group,true);assert(hits.length&&hits[0].point.y>b.data.size[1],'cupola is occluded by the wall/roof');});
  let vertices=0,meshes=0;scene.updateMatrixWorld(true);
  test('all generated geometry and transforms are finite',()=>{scene.traverse(m=>{if(m.isMesh){meshes++;const p=m.geometry.attributes.position;vertices+=p.count;for(const n of p.array)assert(Number.isFinite(n));for(const n of m.matrixWorld.elements)assert(Number.isFinite(n));if(m.isInstancedMesh)for(const n of m.instanceMatrix.array)assert(Number.isFinite(n));}});assert(vertices>50000);assert(world.colliders.length>100);});
  test('ground texture density is consistent across roads and lawns',()=>{
    let surfaces=0,polygons=0;scene.traverse(m=>{if(!m.isMesh)return;const mat=m.material;if(!mat?.userData.groundTile)return;const tile=mat.userData.groundTile,p=m.geometry.attributes.position,uv=m.geometry.attributes.uv;
      for(let i=1;i<p.count;i++){const dx=p.getX(i)-p.getX(0),dy=p.getY(i)-p.getY(0),du=uv.getX(i)-uv.getX(0),dv=uv.getY(i)-uv.getY(0);assert(Math.abs(dx/tile-du)<.0001);assert(Math.abs(dy/tile-dv)<.0001);}
      assert.equal(mat.map.minFilter,THREE.LinearMipmapLinearFilter);assert.equal(mat.map.magFilter,THREE.LinearFilter);surfaces++;if(m.geometry.type==='ShapeGeometry')polygons++;
    });assert(surfaces>5);assert.equal(polygons,data.roads.filter(r=>r.poly?.length>=3).length);
  });
  test('window instances placed at their building, not at origin',()=>{const windows=[];scene.traverse(m=>{if(m.isInstancedMesh&&m.parent===scene&&m.geometry.type==='BoxGeometry')windows.push(m);});assert(windows.length>=3);const mat=new THREE.Matrix4(),pos=new THREE.Vector3();let near=0,far=0;for(const m of windows)for(let i=0;i<m.count;i++){m.getMatrixAt(i,mat);pos.setFromMatrixPosition(mat);if(Math.hypot(pos.x,pos.z)<20)near++;if(Math.hypot(pos.x,pos.z)>80)far++;}assert(far>100);assert(far>near);});
  test('upper-floor glass is visible before the solid teaching wall',()=>{
    const b=world.buildings.find(b=>b.data.id==='yihao'),matrix=new THREE.Matrix4(),p=new THREE.Vector3();let verified=false;
    scene.traverse(m=>{if(!m.userData.windowGlazing||verified)return;
      for(let i=0;i<m.count;i++){m.getMatrixAt(i,matrix);p.setFromMatrixPosition(matrix);
        if(Math.abs(p.z-(b.center.z+b.data.size[2]/2))>.2||Math.abs(p.x-b.center.x)>b.data.size[0]/2||p.y<6)continue;
        const ray=new THREE.Raycaster(new THREE.Vector3(p.x+.3,p.y,p.z+1),new THREE.Vector3(0,0,-1),0,2),hits=ray.intersectObjects([b.group,m],true);
        assert(hits.length&&hits[0].object===m,'glass must not be buried inside plaster');verified=true;break;
      }
    });assert(verified,'a front window must be tested');
  });
  const bounds={minX:-1000,maxX:1000,minZ:-1000,maxZ:1000};
  function walk(p,input,yaw,steps,colliders=[]){for(let i=0;i<steps;i++)M.step(p,input,yaw,1/60,colliders,bounds);return p;}
  test('WASD and diagonal normalize at walking speed',()=>{let p=walk({x:0,z:0},{x:0,y:1},0,60),d=walk({x:0,z:0},{x:1,y:1},0,60);assert(Math.abs(p.z+3.1)<.001);assert(Math.abs(Math.hypot(d.x,d.z)-3.1)<.001);assert(Math.abs(d.x+d.z)<.001);});
  test('rotation changes forward direction; sprint is 6m/s',()=>{let p=walk({x:0,z:0},{x:0,y:1,run:true},Math.PI/2,60);assert(Math.abs(p.x+6)<.001);assert(Math.abs(p.z)<.001);});
  test('walls block movement and allow sliding',()=>{const wall=[{minX:-1,maxX:1,minZ:-4,maxZ:-3}];let p=walk({x:0,z:0},{x:0,y:1},0,600,wall);assert(p.z>-2.69);assert(!M.blocked(p.x,p.z,wall,bounds));let s=walk({x:0,z:-2.67},{x:1,y:1},0,30,wall);assert(s.x>1);assert(s.z>-3);});
  test('high delta time cannot tunnel through thin gate posts',()=>{const post=[{minX:-.05,maxX:.05,minZ:-2,maxZ:2}];let p={x:-1,z:0};for(let i=0;i<20;i++)M.step(p,{x:1,y:0,run:true},0,3,post,bounds);assert(p.x<-.36);});
  test('north gate is passable through central arch',()=>{const g=world.buildings.find(b=>b.data.id==='beimen'),p={x:g.center.x,z:g.center.z-12};assert(!M.blocked(p.x,p.z,world.colliders,world.bounds));for(let i=0;i<480;i++)M.step(p,{x:0,y:1},Math.PI,1/60,world.colliders,world.bounds);assert(p.z>g.center.z+9,'blocked at '+p.z);});
  test('water and teaching building have solid collision',()=>{for(const id of ['yanchi','library']){const b=world.buildings.find(b=>b.data.id===id);assert(M.blocked(b.center.x,b.center.z,world.colliders,world.bounds),id);}});
  test('16 furnished classrooms preserve the original building footprints',()=>{assert.equal(world.rooms.length,16);assert(world.rooms.every(r=>r.deskCount===36));for(const r of world.rooms){assert(r.obstacles.length===38);assert(!M.blocked(r.arrival.x,r.arrival.z,world.colliders,world.bounds),r.id+' arrival');}});
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
  test('smallest palm template retains nonzero tapered leaf surfaces',()=>{
    const landscape=context.window.CampusLandscape,g=new THREE.Group();landscape.init('low');landscape.palm(g,0,0,8,'low-leaf-area');let area=0;g.traverse(o=>{if(!o.userData.foliage)return;const p=o.geometry.attributes.position,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);area+=b.sub(a).cross(c.sub(a)).length()/2;}});assert(area>1,'one-segment tapered leaves must not collapse');landscape.init('balanced');
  });
  const summary={passed:results.length,checks:results,nodes:world.buildings.length,classrooms:world.rooms.length,trees:world.treeCount,colliders:world.colliders.length,meshes,vertices,browserQA:'Node geometry checks only; see tests/browser-results.json for Chromium WebGL. Real-device touch and hardware FPS unverified.'};
  fs.writeFileSync('tests/walk/results.json',JSON.stringify(summary,null,2));
  fs.writeFileSync('tests/walk/scene-summary.json',JSON.stringify(world.buildings.map(b=>({id:b.data.id,center:b.center})),null,2));
  console.log(JSON.stringify(summary,null,2));
})().catch(e=>{console.error(e);process.exit(1)});

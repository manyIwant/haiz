import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sourceRoot=path.join(root,'public/haiz');
const threeSource=fs.readFileSync(path.join(sourceRoot,'assets/vendor/three.min.js'),'utf8');
const bridgeSource=fs.readFileSync(path.join(sourceRoot,'world/atlas-prototype-bridge.js'),'utf8');
const data=JSON.parse(fs.readFileSync(path.join(sourceRoot,'assets/walk/campus.json'),'utf8'));

/**
 * Exercises the actual companion with bundled Three.js camera/projection math
 * and all retained footprint coordinates. DOM, rendering, clock and the legacy
 * goTo/resume boundary are stubs: these tests make no GPU, collision, material,
 * hardware-performance or screenshot-fidelity claim.
 */
function harness({width=1184,height=952,focus='',view='',coarse=false,reduced=false,photoMaterials=false}={}){
  let now=0,nextId=0,renders=0,lastCamera=null,arrivals=0;
  const scheduled=new Map(),timers=new Map(),events=new Map(),canvasEvents=new Map(),sent=[];
  const elements=new Map();
  const noop=()=>{};
  let api;
  function element(id){
    if(!elements.has(id))elements.set(id,{
      hidden:true,open:false,style:{},textContent:'',value:'balanced',
      classList:{add:noop,remove:noop},addEventListener:noop,setAttribute:noop,focus:noop,
      close(){this.open=false;},
      dispatchEvent(){if(id==='quality')api.state.quality=api.state.effectiveQuality=this.value;},
    });
    return elements.get(id);
  }
  const canvas={
    addEventListener(type,callback){const list=canvasEvents.get(type)||[];list.push(callback);canvasEvents.set(type,list);},
    setAttribute:noop,focus:noop,setPointerCapture:noop,releasePointerCapture:noop,hasPointerCapture:()=>false,
    getBoundingClientRect:()=>({left:0,top:0,width,height}),
  };
  const parent={postMessage(message,targetOrigin){assert.equal(targetOrigin,'http://localhost');sent.push(message);}};
  const location={origin:'http://localhost',search:'?'+new URLSearchParams({focus,view})};
  const context={
    console,Math,Date,Number,Map,Set,URLSearchParams,
    Event:class{constructor(type){this.type=type;}},
    MutationObserver:class{observe(){}disconnect(){}},
    location,parent,innerWidth:width,innerHeight:height,navigator:{maxTouchPoints:coarse?5:0},
    performance:{now:()=>now},
    requestAnimationFrame(callback){const id=++nextId;scheduled.set(id,callback);return id;},
    cancelAnimationFrame(id){scheduled.delete(id);},
    setInterval(callback){const id=++nextId;timers.set(id,callback);return id;},
    clearInterval(id){timers.delete(id);},setTimeout:noop,clearTimeout:noop,
    matchMedia:query=>({matches:query.includes('reduced-motion')?reduced:coarse,addEventListener:noop}),
    document:{hidden:false,getElementById:element,querySelectorAll:()=>[],
      addEventListener(type,callback){const key='document:'+type,list=events.get(key)||[];list.push(callback);events.set(key,list);},
      body:{classList:{add:noop,remove:noop}},documentElement:{dataset:{}},
    },
    addEventListener(type,callback){const list=events.get(type)||[];list.push(callback);events.set(type,list);},
  };
  context.window=context;context.self=context;
  vm.createContext(context);vm.runInContext(threeSource,context,{filename:'bundled-three.min.js'});
  const T=context.THREE,scene=new T.Scene(),camera=new T.PerspectiveCamera(48,width/height,.1,850);
  scene.fog=new T.Fog('#d0d8c7',160,520);
  const sun=new T.DirectionalLight('#fff0d5',1.7),hemi=new T.HemisphereLight('#d8e8ee','#8b8a70',.82);
  scene.add(sun,hemi);
  const sourceWall=new T.MeshPhysicalMaterial({color:'#e8e6de',roughness:.5,map:new T.Texture()}),sourceRoof=new T.MeshPhysicalMaterial({color:'#e4e4d6',roughness:.62,clearcoat:.16,map:new T.Texture()});
  sourceWall.userData.surfaceStudy='ceramic';sourceRoof.userData.surfaceStudy='roof';sourceRoof.userData.generatedGlaze=true;
  const buildings=data.buildings.map(record=>{
    const r=record.rect;
    const center={x:((r[0]+r[2])/2-900)*.167,z:-((r[1]+r[3])/2-784)*.167};
    const group=new T.Group();
    group.add(new T.Mesh(new T.BoxGeometry(...record.size),photoMaterials?(record.id==='fengqitang'?sourceRoof:sourceWall):new T.MeshBasicMaterial()));
    group.position.set(center.x,record.size[1]/2,center.z);scene.add(group);
    return {group,data:record,center};
  });
  api=context.haizWalk={
    state:{quality:'balanced',effectiveQuality:'balanced',started:false,paused:true,pos:{x:13,z:-172}},
    world:{buildings,vegetationTiles:[]},scene,camera,
    renderer:{domElement:canvas,toneMappingExposure:1.15,info:{render:{calls:0,triangles:0}},render(_scene,c){renders++;lastCamera=c;c.updateMatrixWorld(true);}},
    pause(){this.state.paused=true;},resume(){this.state.paused=false;},
    // A bounded fake legacy arrival interface. Its path and safety algorithm
    // are deliberately not reimplemented or claimed to be verified here.
    goTo(id){arrivals++;const b=buildings.find(item=>item.data.id===id);if(!b)return false;
      this.state.pos={x:b.center.x,z:b.center.z+40};
      camera.position.set(this.state.pos.x,1.85,this.state.pos.z);
      camera.lookAt(b.center.x,10,b.center.z);camera.updateMatrixWorld(true);return true;},
  };
  const originalTransforms=()=>buildings.map(b=>({id:b.data.id,position:b.group.position.toArray(),quaternion:b.group.quaternion.toArray(),scale:b.group.scale.toArray(),rect:[...b.data.rect]}));
  const before=originalTransforms();
  vm.runInContext(bridgeSource,context,{filename:'atlas-prototype-bridge.js'});
  // The ready timer is triggered only after a legacy API is available.
  [...timers.values()][0]();
  // Advance beyond the low-quality frame budget by default, rather than
  // pretending every synthetic pointer command occurs in the same millisecond.
  function flush(at=now+40){now=at;const current=[...scheduled.values()];scheduled.clear();for(const callback of current)callback(now);}
  function command(action,extra={},overrides={}){
    const event={source:parent,origin:location.origin,data:{type:'haiz-atlas:command',action,...extra},...overrides};
    for(const callback of events.get('message')||[])callback(event);
  }
  flush();
  return {api,buildings,context,sent,command,flush,sun,hemi,sourceWall,sourceRoof,arrivals:()=>arrivals,
    resize(w,h){width=w;height=h;context.innerWidth=w;context.innerHeight=h;for(const callback of events.get('resize')||[])callback();},
    projectBounds(){return buildings.flatMap(b=>{const box=new T.Box3().setFromObject(b.group);return [box.min.x,box.max.x].flatMap(x=>[box.min.y,box.max.y].flatMap(y=>[box.min.z,box.max.z].map(z=>new T.Vector3(x,y,z).project(lastCamera))));});},
    state:()=>sent.filter(m=>m.type==='haiz-atlas:state').at(-1),
    transforms:originalTransforms,before,
    camera:()=>lastCamera,renders:()=>renders,pendingFrames:()=>scheduled.size,
    dispatch(type,event={}){for(const callback of events.get(type)||[])callback(event);},
    periodic(){for(const callback of [...timers.values()])callback();},
    advanceTime(time){now=time;},
    projectFootprints(){const c=lastCamera;return buildings.flatMap(b=>{
      const r=b.data.rect,xs=[(r[0]-900)*.167,(r[2]-900)*.167],zs=[-(r[1]-784)*.167,-(r[3]-784)*.167];
      return xs.flatMap(x=>zs.map(z=>new T.Vector3(x,0,z).project(c)));
    });},
  };
}

test('all 34 source nodes load and valid URL focus is restored',()=>{
  const h=harness({focus:'library'});
  assert.equal(h.state().nodes,34);assert.equal(h.state().selected,'library');assert.equal(h.state().mode,'overview');
  assert.equal(h.context.document.documentElement.dataset.atlasNodes,'34');
  assert.equal(h.context.document.documentElement.dataset.atlasSelected,'library');
});

test('unknown focus and selections cannot invent a building or alter source data',()=>{
  const h=harness({focus:'../../unknown'});assert.equal(h.state().selected,'yihao');
  h.command('select',{id:'library'});h.flush();assert.equal(h.state().selected,'library');
  for(const id of ['__proto__','',null,'not-a-node']){h.command('select',{id});h.flush();assert.equal(h.state().selected,'library');}
  assert.deepEqual(h.transforms(),h.before);
});

test('commands only accept the same-origin parent and declared message type',()=>{
  const h=harness();
  h.command('select',{id:'library'},{origin:'https://example.invalid'});
  h.command('select',{id:'library'},{source:{}});
  h.command('select',{id:'library'},{data:{type:'different-message',action:'select',id:'library'}});
  h.flush();assert.equal(h.state().selected,'yihao');
});

test('approach can be cancelled, skipped, or completed without moving any source group',()=>{
  const h=harness();h.command('select',{id:'library'});h.flush();
  h.command('approach');h.flush(700);assert.equal(h.state().mode,'approach');assert.ok(h.state().progress>0&&h.state().progress<1);
  h.command('cancel');h.flush();assert.equal(h.state().mode,'overview');assert.equal(h.api.state.paused,true);
  h.command('approach');h.command('skip');assert.equal(h.state().mode,'walk');assert.equal(h.api.state.paused,false);
  h.command('overview');h.flush();h.command('approach');h.flush(3500);assert.equal(h.state().mode,'walk');
  assert.deepEqual(h.transforms(),h.before);
});

test('manual and system reduced-motion modes hand off immediately',()=>{
  for(const system of [false,true]){
    const h=harness({reduced:system});if(!system)h.command('reduced',{value:true});
    const start=h.sent.length;h.command('approach',{id:'library'});
    assert.equal(h.state().mode,'walk');assert.equal(h.state().selected,'library');assert.equal(h.state().reduced,true);
    assert.equal(h.sent.slice(start).some(m=>m.mode==='approach'),false);
    assert.deepEqual(h.transforms(),h.before);
  }
});

test('pause and resume preserve the current walking position',()=>{
  const h=harness();h.command('walk',{id:'library'});
  h.api.state.pos={x:h.api.state.pos.x+7,z:h.api.state.pos.z-4};const position={...h.api.state.pos};
  h.command('pause');assert.equal(h.state().paused,true);h.command('resume');assert.equal(h.state().paused,false);
  assert.deepEqual(h.api.state.pos,position);assert.deepEqual(h.transforms(),h.before);
});

test('selecting another building while walking returns to its overview selection',()=>{
  const h=harness();h.command('walk',{id:'yihao'});assert.equal(h.state().mode,'walk');
  h.command('select',{id:'library'});h.flush();
  assert.equal(h.state().mode,'overview');assert.equal(h.state().selected,'library');assert.equal(h.api.state.paused,true);
  h.command('approach');h.command('skip');assert.equal(h.state().mode,'walk');
  const library=h.buildings.find(b=>b.data.id==='library');assert.equal(h.api.state.pos.x,library.center.x);
  assert.deepEqual(h.transforms(),h.before);
});

test('default camera preserves gate, field, library and small-pond spatial relationships',()=>{
  const h=harness(),labels=new Map(h.state().labels.map(item=>[item.id,item]));
  assert.ok(labels.get('beimen').y<labels.get('yihao').y);
  assert.ok(labels.get('yundong').x<labels.get('yihao').x);
  assert.ok(labels.get('library').x>labels.get('yihao').x);
  assert.ok(labels.get('yanchi').y>labels.get('yihao').y);
});

test('overview draws stop at rest, and quality commands stay within supported tiers',()=>{
  const h=harness(),initial=h.renders();h.periodic();h.flush(1000);assert.equal(h.renders(),initial);assert.equal(h.pendingFrames(),0);
  h.command('quality',{value:'low'});h.flush();assert.equal(h.state().quality,'low');
  h.command('quality',{value:'unsupported'});h.flush();assert.equal(h.state().quality,'low');
  assert.equal(h.context.document.documentElement.dataset.atlasQuality,'low');
});

test('zoom stays bounded and the portrait camera contains every retained footprint',()=>{
  const h=harness({width:320,height:700,coarse:true});
  assert.equal(h.state().quality,'low');
  const defaultWidth=h.camera().right-h.camera().left,defaultSpan=h.camera().top-h.camera().bottom;
  const defaultPoints=h.projectFootprints();
  for(const point of defaultPoints){assert.ok(Math.abs(point.x)<=1.001);assert.ok(Math.abs(point.y)<=1.001);}
  // The portrait framing keeps the campus in the upper half, leaving room for
  // the parent's bottom destination sheet without changing a footprint.
  assert.ok(defaultPoints.reduce((sum,p)=>sum+(1-p.y)/2,0)/defaultPoints.length<.5);
  for(let i=0;i<100;i++)h.command('zoom',{value:1});h.flush();
  const zoomedOut={left:h.camera().left,right:h.camera().right,top:h.camera().top,bottom:h.camera().bottom};
  assert.ok(Math.abs((zoomedOut.right-zoomedOut.left)/defaultWidth-760/480)<1e-9);
  for(let i=0;i<100;i++)h.command('zoom',{value:1});h.flush();assert.equal(h.camera().top,zoomedOut.top);
  for(let i=0;i<100;i++)h.command('zoom',{value:-1});h.flush();
  const zoomedInWidth=h.camera().right-h.camera().left,zoomedInSpan=h.camera().top-h.camera().bottom;
  assert.ok(Number.isFinite(h.camera().top));assert.ok(zoomedInWidth<defaultWidth);assert.ok(zoomedInSpan<defaultSpan);
  assert.ok(Math.abs(zoomedInWidth/defaultWidth-150/480)<1e-9);
  for(let i=0;i<100;i++)h.command('zoom',{value:-1});h.flush();assert.equal(h.camera().right-h.camera().left,zoomedInWidth);
  const zoomedIn=h.camera().top;h.command('zoom',{value:NaN});h.flush();assert.equal(h.camera().top,zoomedIn);
  h.command('overview');h.flush();assert.equal(h.camera().right-h.camera().left,defaultWidth);
  for(const point of h.projectFootprints()){assert.ok(Math.abs(point.x)<=1.001);assert.ok(Math.abs(point.y)<=1.001);}
  assert.deepEqual(h.transforms(),h.before);
});

test('hidden tabs pause a walk and cancel companion rendering',()=>{
  const h=harness();h.command('walk');h.context.document.hidden=true;h.dispatch('document:visibilitychange');
  assert.equal(h.api.state.paused,true);assert.equal(h.pendingFrames(),0);
  h.context.document.hidden=false;h.advanceTime(400);h.dispatch('document:visibilitychange');h.flush();
  assert.equal(h.state().paused,true);
});

test('spatial and map views restore only declared URL and parent selections',()=>{
  for(const view of ['spatial','map']){
    const h=harness({focus:'library',view});assert.equal(h.state().view,view);
    assert.equal(h.camera().isPerspectiveCamera,view==='spatial'?true:undefined);
    for(const value of ['',null,'__proto__','unrecognized']){h.command('view',{value});h.flush();assert.equal(h.state().view,view);}
    h.command('view',{value:view==='map'?'spatial':'map'});h.flush();
    assert.equal(h.state().selected,'library');assert.deepEqual(h.transforms(),h.before);
  }
  assert.equal(harness({view:'unrecognized'}).state().view,'spatial');
  assert.equal(harness({width:390}).state().view,'map');
});

test('perspective framing contains all building bounds across desktop and portrait resizes',()=>{
  const h=harness({view:'spatial'});
  for(const [width,height] of [[1440,900],[1184,892],[390,782],[320,678],[1184,892]]){
    h.resize(width,height);h.flush();
    assert.ok(h.camera().near>1,'whole-campus views retain ground depth precision');
    for(const p of h.projectBounds()){
      assert.ok(Math.abs(p.x)<=.881,`horizontal bound at ${width}: ${p.x}`);
      assert.ok(Math.abs(p.y)<=.83,`vertical bound at ${width}: ${p.y}`);
      assert.ok(p.z>-1&&p.z<1);
    }
    const labels=new Map(h.state().labels.map(l=>[l.id,l]));
    assert.ok(labels.get('library').x>labels.get('yihao').x);
    assert.ok(labels.get('beimen').y<labels.get('yihao').y);
    assert.ok(labels.get('yundong').x<labels.get('yihao').x);
  }
  assert.deepEqual(h.transforms(),h.before);
});

test('spatial zoom is bounded and reset restores its original framing',()=>{
  const h=harness({view:'spatial'}),position=h.camera().position.clone();
  for(let i=0;i<80;i++)h.command('zoom',{value:1});h.flush();
  const far=h.camera().position.clone();h.command('zoom',{value:Infinity});h.flush();assert.deepEqual(h.camera().position.toArray(),far.toArray());
  h.command('zoom',{value:1});h.flush();assert.deepEqual(h.camera().position.toArray(),far.toArray());
  for(let i=0;i<80;i++)h.command('zoom',{value:-1});h.flush();const near=h.camera().position.clone();
  h.command('zoom',{value:-1});h.flush();assert.deepEqual(h.camera().position.toArray(),near.toArray());
  h.command('overview');h.flush();assert.ok(h.camera().position.distanceTo(position)<1e-9);
});

test('a spatial flight starts continuously and resolves its safe arrival only once',()=>{
  for(const action of ['skip','reduced','complete']){
    const h=harness({view:'spatial'}),before=h.camera().projectionMatrix.clone(),position=h.camera().position.clone();
    h.command('approach',{id:'library'});h.flush(0);
    assert.ok(h.camera().position.distanceTo(position)<1e-9);
    assert.deepEqual(h.camera().projectionMatrix.elements,before.elements);
    if(action==='complete')h.flush(2700);else h.command(action,action==='reduced'?{value:true}:{});
    assert.equal(h.state().mode,'walk');assert.equal(h.arrivals(),1);
    assert.deepEqual(h.transforms(),h.before);
  }
});

test('cancelling a flight returns to the same view, lens and selection',()=>{
  const h=harness({view:'spatial'});h.command('zoom',{value:-1});h.flush();
  const position=h.camera().position.clone(),projection=h.camera().projectionMatrix.clone();
  h.command('approach',{id:'library'});h.flush(900);h.command('cancel');h.flush();
  assert.equal(h.state().view,'spatial');assert.equal(h.state().selected,'library');
  assert.ok(h.camera().position.distanceTo(position)<1e-9);assert.deepEqual(h.camera().projectionMatrix.elements,projection.elements);
});

test('photo calibration clones only tagged, identified building materials without changing source textures',()=>{
  const h=harness({photoMaterials:true}),material=id=>h.buildings.find(b=>b.data.id===id).group.children[0].material;
  for(const id of ['yihao','erhao','library']){
    const copy=material(id);assert.notEqual(copy,h.sourceWall);assert.equal(copy.userData.atlasPhotoCalibrated,id);
    assert.equal(copy.map,h.sourceWall.map);assert.ok(copy.roughness>=.82);
  }
  assert.notEqual(material('yihao'),material('erhao'));assert.equal(material('keji'),h.sourceWall);
  assert.equal(material('yanlintang'),h.sourceWall);assert.equal(h.sourceWall.roughness,.5);assert.equal(h.sourceWall.color.getHexString(),'e8e6de');
  const roof=material('fengqitang');assert.notEqual(roof,h.sourceRoof);assert.equal(roof.map,h.sourceRoof.map);
  assert.equal(roof.color.getHexString(),h.sourceRoof.color.getHexString());assert.equal(roof.userData.generatedGlaze,true);
  assert.ok(roof.roughness>=.78);assert.ok(roof.clearcoat<=.08);assert.equal(h.sourceRoof.roughness,.62);assert.equal(h.sourceRoof.clearcoat,.16);
  let originalsDisposed=0,copiesDisposed=0;
  h.sourceWall.addEventListener('dispose',()=>originalsDisposed++);material('yihao').addEventListener('dispose',()=>copiesDisposed++);
  assert.deepEqual(h.transforms(),h.before);h.dispatch('pagehide');assert.equal(originalsDisposed,0);assert.equal(copiesDisposed,1);
});

test('source fog survives legacy draws and original lighting is restored before walking',()=>{
  const h=harness(),fog=h.api.scene.fog;
  assert.ok(fog);assert.ok(h.sun.intensity>1.7);assert.ok(h.hemi.intensity<.82);
  const observation=h.camera();h.api.renderer.render(h.api.scene,h.api.camera);
  assert.equal(h.camera(),observation);assert.equal(h.api.scene.fog,fog);
  h.command('theme',{value:'obsidian'});h.flush();assert.notEqual(h.api.renderer.toneMappingExposure,1.15);
  h.command('walk');assert.equal(h.api.scene.fog,fog);assert.equal(h.sun.intensity,1.7);assert.equal(h.hemi.intensity,.82);assert.equal(h.api.renderer.toneMappingExposure,1.15);
  h.api.renderer.render(h.api.scene,h.api.camera);assert.equal(h.camera(),h.api.camera);
  h.command('overview');h.flush();assert.equal(h.api.scene.fog,fog);
});

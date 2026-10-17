// Execute the actual application with real Three.js geometry and Canvas2D.
// The renderer is a test double: this checks application lifecycle/events, not GPU output.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const {createCanvas}=require(require.resolve('@napi-rs/canvas',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,__dirname].filter(Boolean)}));
const BASE=require('../../assets/vendor/three.min.js'),html=fs.readFileSync('campus-3d.html','utf8'),source=fs.readFileSync('assets/walk/app.js','utf8');
class Element{
  constructor(tag='div'){this.tagName=tag;this.listeners={};this.style={};this.children=[];this.hidden=false;this.disabled=false;this.open=false;this.value='auto';this.attrs={};this.textContent='';this.classList={add(){},remove(){},toggle(){}};if(tag==='canvas')this.native=createCanvas(360,360);}
  addEventListener(type,fn){(this.listeners[type]||(this.listeners[type]=[])).push(fn);}
  dispatch(type,event={}){event={preventDefault(){},target:this,...event};for(const fn of this.listeners[type]||[])fn(event);if(this['on'+type])this['on'+type](event);}
  setAttribute(n,v){this.attrs[n]=v;}appendChild(e){this.children.push(e);}getContext(type){return this.native.getContext(type);}
  get width(){return this.native?.width||360;}set width(n){this.native.width=n;}get height(){return this.native?.height||360;}set height(n){this.native.height=n;}
  showModal(){this.open=true;}close(){this.open=false;}setPointerCapture(){}getBoundingClientRect(){return {left:28,top:500,width:120,height:120,right:148,bottom:620};}
}
async function run(touch,startup='network'){
  const ids={},document=new Element('document'),window=new Element('window');
  for(const m of html.matchAll(/<([a-z]+)[^>]*\bid="([^"]+)"[^>]*>/g)){ids[m[2]]=new Element(m[1]);if(/hidden/.test(m[0]))ids[m[2]].hidden=true;}
  ids.largeMap.width=ids.largeMap.height=1000;ids.miniMap.width=ids.miniMap.height=360;
  document.getElementById=id=>{assert(ids[id],'missing element '+id);return ids[id];};
  document.createElement=tag=>new Element(tag);document.body=new Element('body');document.querySelectorAll=()=>[new Element('button'),new Element('button'),new Element('button'),new Element('button')];
  document.exitPointerLock=()=>{document.pointerLockElement=null;document.dispatch('pointerlockchange');};
  const RAF=[];let lockRequests=0;
  class Renderer{
    constructor(){this.domElement=new Element('canvas');this.shadowMap={};this.info={render:{calls:0,triangles:0}};this.domElement.requestPointerLock=()=>{lockRequests++;document.pointerLockElement=this.domElement;document.dispatch('pointerlockchange');return Promise.resolve();};}
    setPixelRatio(v){this.pixelRatio=v;}setSize(w,h){this.w=w;this.h=h;}render(s,c){assert(s.children.length>10);assert(c.position.toArray().every(Number.isFinite));this.info.render.calls++;}
  }
  const ctx={THREE:{...BASE,WebGLRenderer:Renderer,TextureLoader:class{load(url,onLoad,onProgress,onError){if(!fs.existsSync(url)){onError?.();return;}const tex=new BASE.CanvasTexture(createCanvas(512,512));setTimeout(()=>onLoad(tex),0);return tex;}}},window,document,console,performance,URLSearchParams,AbortController,setTimeout,clearTimeout,fetch:async()=>({ok:true,json:async()=>JSON.parse(fs.readFileSync('assets/walk/campus.json'))}),matchMedia:q=>({matches:q.includes('pointer:coarse')&&touch}),navigator:{maxTouchPoints:touch?5:0,hardwareConcurrency:8},innerWidth:touch?390:1440,innerHeight:touch?844:900,devicePixelRatio:touch?3:1,location:{reload(){}},requestAnimationFrame:fn=>{RAF.push(fn);return RAF.length;}};
  let requests=0;ctx.location.protocol=startup==='file'?'file:':'https:';ctx.location.search=startup==='arrival'?'?arrival=descent':startup==='journey'?'?journey=fengqitang,yihao,erhao,library&climate=dusk':'';
  ctx.fetch=async()=>{requests++;if(startup==='failed')throw new TypeError('NetworkError when attempting to fetch resource.');if(startup==='file')throw Error('file mode must not request JSON');return {ok:true,json:async()=>JSON.parse(fs.readFileSync('assets/walk/campus.json'))};};
  window.THREE=ctx.THREE;vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('assets/vendor/Water.js','utf8'),ctx);
  vm.runInContext(fs.readFileSync('assets/vendor/Sky.js','utf8'),ctx);
  for(const file of ['campus-data.js','movement.js','journey-core.js','interiors.js','memory-art.js','surfaces.js','architecture.js','world.js','memory.js','climate.js','route.js','reflections.js'])vm.runInContext(fs.readFileSync('assets/walk/'+file,'utf8'),ctx);
  vm.runInContext(source,ctx);
  const start=performance.now();while(!window.haizWalk&&!ids.errorPanel.hidden){if(ids.errorText.textContent)throw new Error(ids.errorText.textContent);if(performance.now()-start>20000)throw Error('startup timeout');await new Promise(r=>setTimeout(r,10));}
  if(!window.haizWalk){while(!window.haizWalk&&performance.now()-start<20000){if(ids.errorText.textContent)throw Error(ids.errorText.textContent);await new Promise(r=>setTimeout(r,10));}}
  assert(window.haizWalk,'not ready');const api=window.haizWalk;
  if(startup==='arrival'){
    api.setArrivalProgress(0);const high=api.camera.position.y;api.setArrivalProgress(.5);assert(api.camera.position.y<high&&api.camera.position.y>100);api.setArrivalProgress(1);assert(Math.abs(api.camera.position.y-1.85)<.001);api.takeArrivalControl();assert(api.state.started&&!api.state.paused);assert(!window.CampusMotion.blocked(api.state.pos.x,api.state.pos.z,api.world.colliders,api.world.bounds));
    return {mode:'descent handoff',startup,loaded:true,checks:['aerial camera descends continuously','ground eye height','safe arrival collision','manual control takeover'],gpu:false};
  }
  if(startup==='journey'){
    ids.enterButton.dispatch('click');assert(api.state.started&&!api.state.paused);assert.equal(api.diagnostics().tour,'fengqitang');assert.equal(api.climate.current,'dusk');assert.equal(lockRequests,1,'one pointer-lock request per launch gesture');assert(!window.CampusMotion.blocked(api.state.pos.x,api.state.pos.z,api.world.colliders,api.world.bounds));
    return {mode:'custom route URL entry',startup,loaded:true,checks:['whitelisted route starts from its first landmark','requested climate retained','collision-safe first stop','single pointer-lock request'],gpu:false};
  }
  assert.equal(requests,startup==='file'?0:1);
  ids.observationToggle.dispatch('change',{target:{checked:true}});
  assert(api.world.waterSurface,'reflection source must survive geometry merging');
  api.goTo('yanchi',false);api.reflections.tick(.1,'high',false,false);assert(api.reflections.active);
  api.reflections.tick(.1,'low',false,false);assert(!api.reflections.active);assert(api.world.waterSurface.visible);
  api.goTo('beimen',false);
  assert.equal(ids.enterButton.disabled,false);
  for(const mode of ['afterrain','dusk','morning']){ids.climate.dispatch('change',{target:{value:mode}});api.climate.tick(5,false);assert.equal(api.climate.current,mode);assert(Number.isFinite(api.scene.fog.near));}
  assert(api.world.roadMaterials.every(m=>Number.isFinite(m.roughness)));
assert.equal(api.diagnostics().nodes,34);
  ids.enterButton.dispatch('click');assert(api.state.started&&!api.state.paused);assert.equal(ids.touchControls.hidden,!touch);
  let now=performance.now();function tick(n){for(let i=0;i<n;i++){now+=1000/60;const fn=RAF.shift();assert(fn);fn(now);}}
  // Exercise the complete route at simulation speed; each position must remain collision-free.
  api.startTour(0);let routeNow=performance.now();
  for(let stop=0;stop<3;stop++){
    let arrived=false;
    for(let n=0;n<4000;n++){routeNow+=100;const fn=RAF.shift();assert(fn);fn(routeNow);
      assert(!window.CampusMotion.blocked(api.state.pos.x,api.state.pos.z,api.world.colliders,api.world.bounds),'route collision');
      if(ids.poiDialog.open){arrived=true;break;}
    }
    assert(arrived,'tour did not reach stop '+stop+' '+JSON.stringify(api.diagnostics())+' toast='+ids.toast.textContent+' paused='+api.state.paused);assert(!ids.memoryLayer.hidden);assert(!ids.tourNext.hidden);
    assert.equal(ids.poiName.textContent,window.CampusMemory.places[stop].name);ids.tourNext.dispatch('click');
  }
  assert(!api.diagnostics().tour);
  if(!touch&&startup==='network'){
    const route=['fengqitang','yihao','erhao','library'];api.goTo(route[0],false);assert(api.startJourney(route),'custom route must start');
    for(const id of route){let arrived=false;
      for(let n=0;n<6000;n++){routeNow+=100;const fn=RAF.shift();assert(fn);fn(routeNow);assert(!window.CampusMotion.blocked(api.state.pos.x,api.state.pos.z,api.world.colliders,api.world.bounds),'custom route collision');if(ids.poiDialog.open){arrived=true;break;}}
      assert(arrived,'custom route did not reach '+id);assert.equal(ids.poiName.textContent,api.world.buildings.find(b=>b.data.id===id).data.name);ids.tourNext.dispatch('click');
    }
    assert(!api.diagnostics().tour);assert.equal(api.startJourney(['unknown']),false);
    const old={...api.state.pos};assert.equal(api.restoreView({position:{x:9999,z:9999},yaw:0,pitch:0,lens:48}),false);assert.deepEqual(api.state.pos,old);
    assert(api.restoreView({position:old,yaw:.5,pitch:-.1,lens:40,climate:'dusk'}));assert.equal(api.camera.fov,40);assert.equal(api.climate.current,'dusk');api.state.photoFov=null;
  }
  api.goTo('beimen',false);api.resume();
  api.startTour(1);api.pause();const paused={...api.state.pos};
  routeNow+=100;RAF.shift()(routeNow);assert.deepEqual(api.state.pos,paused);api.resume();
  api.renderer.domElement.dispatch('pointerdown',{pointerType:'touch',pointerId:55,clientX:1100,clientY:200});
  api.renderer.domElement.dispatch('pointermove',{pointerType:'touch',pointerId:55,clientX:1120,clientY:210});
  assert(!api.diagnostics().tour,'look should cancel director mode');api.goTo('beimen',false);api.resume();
  const before={...api.state.pos};
  if(!touch){window.dispatch('keydown',{key:'w'});tick(60);window.dispatch('keyup',{key:'w'});assert(Math.hypot(api.state.pos.x-before.x,api.state.pos.z-before.z)>2.8);const yaw=api.state.yaw;document.dispatch('mousemove',{movementX:40,movementY:20});assert.notEqual(api.state.yaw,yaw);}
  else{
    ids.joystick.dispatch('pointerdown',{pointerId:1,clientX:88,clientY:530});assert(api.state.input.y>.5);
    api.renderer.domElement.dispatch('pointerdown',{pointerType:'touch',pointerId:2,clientX:300,clientY:350});const yaw=api.state.yaw;
    api.renderer.domElement.dispatch('pointermove',{pointerType:'touch',pointerId:2,clientX:340,clientY:370});assert.notEqual(api.state.yaw,yaw);tick(60);assert(api.state.walked>2);
    ids.joystick.dispatch('pointercancel',{pointerId:1});assert.equal(api.state.input.y,0);
    ids.runButton.dispatch('click');assert(api.state.input.run);ids.pauseButton.dispatch('click');assert(!api.state.input.run);assert(api.state.paused);ids.resumeButton.dispatch('click');assert(!api.state.paused);
  }
  ids.mapButton.dispatch('click');assert(ids.mapDialog.open&&api.state.paused);assert.equal(ids.destinationList.children.length,12);
  ids.destinationList.children[4].dispatch('click');assert(!api.state.paused&&!ids.mapDialog.open);assert(!ctx.window.CampusMotion.blocked(api.state.pos.x,api.state.pos.z,api.world.colliders,api.world.bounds));
  ids.inspectButton.dispatch('click');assert(ids.poiDialog.open&&api.state.paused);assert(ids.poiName.textContent);ids.poiContinue.dispatch('click');assert(!api.state.paused);
  ids.classroomButton.dispatch('click');assert(!api.state.paused);assert(Math.abs(api.state.pos.z-api.world.buildings.find(b=>b.data.id==='yihao').center.z)<.7);
  assert.equal(api.world.rooms.length,16);
  if(touch){ids.joystick.dispatch('pointerdown',{pointerId:3,clientX:88,clientY:520});tick(110);ids.joystick.dispatch('pointerup',{pointerId:3});}else{window.dispatch('keydown',{key:'w'});tick(110);window.dispatch('keyup',{key:'w'});}
  assert(window.CampusInteriors.currentRoom(api.state.pos.x,api.state.pos.z),'input must enter a classroom');
  tick(12);assert.equal(ids.indoorStatus.hidden,false);
  if(touch){ids.joystick.dispatch('pointerdown',{pointerId:4,clientX:88,clientY:600});tick(130);ids.joystick.dispatch('pointerup',{pointerId:4});}else{window.dispatch('keydown',{key:'s'});tick(130);window.dispatch('keyup',{key:'s'});}
  assert(!window.CampusInteriors.currentRoom(api.state.pos.x,api.state.pos.z),'input must leave the classroom');
  ids.pauseButton.dispatch('click');ids.quality.dispatch('change',{target:{value:'low'}});assert.equal(api.state.effectiveQuality,'low');assert.equal(api.renderer.shadowMap.enabled,false);
  ids.resetButton.dispatch('click');assert(!api.state.paused);assert(api.state.pos.z<-160);
  ctx.innerWidth=touch?844:1024;ctx.innerHeight=touch?390:768;window.dispatch('resize');assert(Math.abs(api.camera.aspect-ctx.innerWidth/ctx.innerHeight)<.0001);
  document.hidden=true;document.dispatch('visibilitychange');assert(api.state.paused);assert.equal(api.state.input.x,0);
  return {mode:touch?'mobile 390×844':'desktop 1440×900',startup,loaded:true,checks:['startup JSON fallback','pond reflection quality switch','architectural observation control','all three climate presets','continuous three-stop route without collision',...(!touch&&startup==='network'?['custom four-stop architecture route without collision','validated camera restoration and invalid-position rejection']:[]),'route pause and manual takeover','memory archive at each stop','startup','enter','movement','view control','map','safe teleport','POI dialog','classroom entry and exit','indoor HUD','pause/reset','quality fallback','resize','visibility input reset'],gpu:false,elapsedMs:Math.round(performance.now()-start)};
}
(async()=>{const results=[await run(false),await run(true),await run(false,'file'),await run(true,'failed'),await run(false,'arrival'),await run(false,'journey')];fs.writeFileSync('tests/walk/runtime-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));})().catch(e=>{console.error(e);process.exit(1)});

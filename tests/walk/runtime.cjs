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
async function run(touch){
  const ids={},document=new Element('document'),window=new Element('window');
  for(const m of html.matchAll(/<([a-z]+)[^>]*\bid="([^"]+)"[^>]*>/g)){ids[m[2]]=new Element(m[1]);if(/hidden/.test(m[0]))ids[m[2]].hidden=true;}
  ids.largeMap.width=ids.largeMap.height=1000;ids.miniMap.width=ids.miniMap.height=360;
  document.getElementById=id=>{assert(ids[id],'missing element '+id);return ids[id];};
  document.createElement=tag=>new Element(tag);document.body=new Element('body');document.querySelectorAll=()=>[new Element('button'),new Element('button'),new Element('button'),new Element('button')];
  document.exitPointerLock=()=>{document.pointerLockElement=null;document.dispatch('pointerlockchange');};
  const RAF=[];
  class Renderer{
    constructor(){this.domElement=new Element('canvas');this.shadowMap={};this.info={render:{calls:0,triangles:0}};this.domElement.requestPointerLock=()=>{document.pointerLockElement=this.domElement;document.dispatch('pointerlockchange');return Promise.resolve();};}
    setPixelRatio(v){this.pixelRatio=v;}setSize(w,h){this.w=w;this.h=h;}render(s,c){assert(s.children.length>10);assert(c.position.toArray().every(Number.isFinite));this.info.render.calls++;}
  }
  const ctx={THREE:{...BASE,WebGLRenderer:Renderer,TextureLoader:class{load(url,onLoad,onProgress,onError){if(!fs.existsSync(url)){onError?.();return;}const tex=new BASE.CanvasTexture(createCanvas(512,512));setTimeout(()=>onLoad(tex),0);return tex;}}},window,document,console,performance,URLSearchParams,AbortController,setTimeout,clearTimeout,fetch:async()=>({ok:true,json:async()=>JSON.parse(fs.readFileSync('assets/walk/campus.json'))}),matchMedia:q=>({matches:q.includes('pointer:coarse')&&touch}),navigator:{maxTouchPoints:touch?5:0,hardwareConcurrency:8},innerWidth:touch?390:1440,innerHeight:touch?844:900,devicePixelRatio:touch?3:1,location:{reload(){}},requestAnimationFrame:fn=>{RAF.push(fn);return RAF.length;}};
  window.THREE=ctx.THREE;vm.createContext(ctx);for(const file of ['movement.js','interiors.js','world.js'])vm.runInContext(fs.readFileSync('assets/walk/'+file,'utf8'),ctx);
  vm.runInContext(source,ctx);
  const start=performance.now();while(!window.haizWalk&&!ids.errorPanel.hidden){if(ids.errorText.textContent)throw new Error(ids.errorText.textContent);if(performance.now()-start>20000)throw Error('startup timeout');await new Promise(r=>setTimeout(r,10));}
  if(!window.haizWalk){while(!window.haizWalk&&performance.now()-start<20000){if(ids.errorText.textContent)throw Error(ids.errorText.textContent);await new Promise(r=>setTimeout(r,10));}}
  assert(window.haizWalk,'not ready');const api=window.haizWalk;
  assert.equal(ids.enterButton.disabled,false);assert.equal(api.diagnostics().nodes,34);
  ids.enterButton.dispatch('click');assert(api.state.started&&!api.state.paused);assert.equal(ids.touchControls.hidden,!touch);
  let now=performance.now();function tick(n){for(let i=0;i<n;i++){now+=1000/60;const fn=RAF.shift();assert(fn);fn(now);}}
  const before={...api.state.pos};
  if(!touch){window.dispatch('keydown',{key:'w'});tick(60);window.dispatch('keyup',{key:'w'});assert(Math.hypot(api.state.pos.x-before.x,api.state.pos.z-before.z)>2.8);const yaw=api.state.yaw;document.dispatch('mousemove',{movementX:40,movementY:20});assert.notEqual(api.state.yaw,yaw);}
  else{
    ids.joystick.dispatch('pointerdown',{pointerId:1,clientX:88,clientY:530});assert(api.state.input.y>.5);
    api.renderer.domElement.dispatch('pointerdown',{pointerType:'touch',pointerId:2,clientX:300,clientY:350});const yaw=api.state.yaw;
    api.renderer.domElement.dispatch('pointermove',{pointerType:'touch',pointerId:2,clientX:340,clientY:370});assert.notEqual(api.state.yaw,yaw);tick(60);assert(api.state.walked>2);
    ids.joystick.dispatch('pointercancel',{pointerId:1});assert.equal(api.state.input.y,0);
    ids.runButton.dispatch('click');assert(api.state.input.run);ids.pauseButton.dispatch('click');assert(!api.state.input.run);assert(api.state.paused);ids.resumeButton.dispatch('click');assert(!api.state.paused);
  }
  ids.mapButton.dispatch('click');assert(ids.mapDialog.open&&api.state.paused);assert.equal(ids.destinationList.children.length,10);
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
  return {mode:touch?'mobile 390×844':'desktop 1440×900',loaded:true,checks:['startup','enter','movement','view control','map','safe teleport','POI dialog','classroom entry and exit','indoor HUD','pause/reset','quality fallback','resize','visibility input reset'],gpu:false,elapsedMs:Math.round(performance.now()-start)};
}
(async()=>{const results=[await run(false),await run(true)];fs.writeFileSync('tests/walk/runtime-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));})().catch(e=>{console.error(e);process.exit(1)});

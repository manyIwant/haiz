// Exercise actual cinematic controls and iframe messages; this does not emulate a GPU.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert');
const {parseHTML}=require('linkedom'),Base=require('../assets/vendor/three.min.js');
async function run({reduced=false,noWebGL=false}={}){
  const {document}=parseHTML(fs.readFileSync('descent.html','utf8'));
  const events={},raf=[],sent=[],frame=document.getElementById('campusFrame');
  const window={document,addEventListener(type,fn){(events[type]??=[]).push(fn);}};
  frame.contentWindow={postMessage(m){sent.push(m);}};frame.focus=()=>{};
  let renders=0,disposed=false,now=0;
  class Renderer{constructor(){if(noWebGL)throw Error('WebGL unavailable');this.capabilities={getMaxAnisotropy:()=>8};}setPixelRatio(){}setSize(){}render(){renders++;}dispose(){disposed=true;}}
  const context={window,document,console:{...console,warn(){}},THREE:{...Base,WebGLRenderer:Renderer,TextureLoader:class{load(path,done){assert(fs.existsSync(path),path);done(new Base.DataTexture(new Uint8Array([1,2,3,255]),1,1));}}},
    location:{origin:'https://test.invalid',search:'',href:''},parent:{},matchMedia:()=>({matches:reduced}),innerWidth:1440,innerHeight:900,devicePixelRatio:1,performance:{now:()=>now},URLSearchParams,setTimeout,clearTimeout,requestAnimationFrame:fn=>raf.push(fn)};
  vm.createContext(context);for(const path of ['assets/cinematic/aligned/manifest.js','assets/cinematic/descent-core.js','assets/cinematic/descent.js'])vm.runInContext(fs.readFileSync(path,'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  const $=id=>document.getElementById(id);
  function ticks(count){for(let i=0;i<count;i++){now+=1000/60;const cb=raf.shift();assert(cb);cb(now);}}
  function message(origin){for(const fn of events.message)fn({origin,source:frame.contentWindow,data:{type:'haiz:arrival:ready'}});}
  // Unknown origins cannot unlock the iframe; the campus handshake can.
  assert.equal($('play').disabled,false,'play must unlock without a campus handshake');assert.equal(frame.getAttribute('src'),null);
  message('https://other.invalid');assert.equal(sent.length,0);message(context.location.origin);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal($('play').disabled,false);assert(window.HMZCinematic);
  $('play').onclick();ticks(120);
  if(reduced)assert.equal(window.HMZCinematic.progress(),0);else assert(window.HMZCinematic.progress()>.04);
  $('progress').oninput({target:{value:'.9'}});ticks(150);assert(Math.abs(window.HMZCinematic.progress()-.9)<.0001);assert(Number(frame.style.opacity)>.9);
  // Scrubbing backwards must restore the geographic view and rewind the arrival camera.
  $('progress').oninput({target:{value:'.3'}});ticks(150);assert(Number(frame.style.opacity)<.001);assert(sent.at(-1).progress===0);
  $('progress').oninput({target:{value:'1'}});ticks(150);assert.equal($('arrival').hidden,false);
  $('enterCampus').onclick();assert(document.body.classList.contains('entered'));assert.equal(sent.at(-1).type,'haiz:arrival:takeover');assert.equal(sent.at(-2).progress,1);
  if(noWebGL)assert.equal($('journey').hidden,true);else assert(renders>0&&disposed);
  return {reduced,noWebGL,passed:true,gpu:false};
}
(async()=>{const results=[];for(const options of [{},{reduced:true},{noWebGL:true}])results.push(await run(options));console.log('PASS cinematic runtime: play, pause/scrub, reverse, iframe origin validation, takeover, reduced motion and WebGL fallback',results);})().catch(e=>{console.error(e);process.exitCode=1;});

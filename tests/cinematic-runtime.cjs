// Exercise actual cinematic controls and iframe messages; this does not emulate a GPU.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert');
const {parseHTML}=require('linkedom'),Base=require('../assets/vendor/three.min.js');
async function run({reduced=false,noWebGL=false,handshake=true}={}){
  const {document}=parseHTML(fs.readFileSync('descent.html','utf8'));
  const events={},raf=[],sent=[],frame=document.getElementById('campusFrame');
  const window={document,addEventListener(type,fn){(events[type]??=[]).push(fn);}};
  frame.contentWindow={postMessage(m){sent.push(m);}};frame.focus=()=>{};
  let renders=0,disposed=false,now=0;
  class Renderer{constructor(){if(noWebGL)throw Error('WebGL unavailable');this.capabilities={getMaxAnisotropy:()=>8};}setPixelRatio(){}setSize(){}render(){renders++;}dispose(){disposed=true;}}
  const context={window,document,console:{...console,warn(){}},THREE:{...Base,WebGLRenderer:Renderer,TextureLoader:class{load(path,done){assert(fs.existsSync(path),path);done(new Base.DataTexture(new Uint8Array([1,2,3,255]),1,1));}}},
    location:{origin:'https://test.invalid',search:'',href:''},parent:{},matchMedia:()=>({matches:reduced}),
    // Browsers always expose navigator; saveData keeps this run on the six bundled layers (no network).
    navigator:{connection:{saveData:true,effectiveType:'4g'}},innerWidth:1440,innerHeight:900,devicePixelRatio:1,performance:{now:()=>now},URLSearchParams,setTimeout:(fn,ms,...a)=>{if(!handshake&&ms>=14000)return setImmediate(fn,...a);const t=setTimeout(fn,ms,...a);if(ms>=14000)t.unref();return t;},clearTimeout:t=>{clearTimeout(t);clearImmediate(t);},requestAnimationFrame:fn=>raf.push(fn)};
  vm.createContext(context);for(const path of ['assets/cinematic/aligned/manifest.js','assets/cinematic/descent-core.js','assets/cinematic/descent.js'])vm.runInContext(fs.readFileSync(path,'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  const $=id=>document.getElementById(id);
  function ticks(count){for(let i=0;i<count;i++){now+=1000/60;const cb=raf.shift();assert(cb);cb(now);}}
  function message(origin){for(const fn of events.message)fn({origin,source:frame.contentWindow,data:{type:'haiz:arrival:ready'}});}
  const settle=async()=>{for(let i=0;i<20;i++)await new Promise(resolve=>setImmediate(resolve));};
  // The campus iframe preloads while the opening title shows (WebGL path only).
  if(!noWebGL&&handshake)assert.equal(frame.getAttribute('src'),'campus-3d.html?arrival=descent','campus iframe must start preloading at boot');
  // Unknown origins are ignored entirely.
  message('https://other.invalid');assert.equal(sent.length,0,'a foreign origin must not reach the campus iframe');
  if(handshake){message(context.location.origin);assert(sent.length>0,'the campus handshake must be answered');}
  await settle();
  // NOTE (reported, not changed here): descent.js says the campus "never gates the play button",
  // but boot() awaits the campus handshake or a 14 s timeout before enabling play. Both paths are
  // asserted below so either a fix or a further regression is caught.
  assert.equal($('play').disabled,false,'play must unlock after the handshake or the bounded preload timeout');assert(window.HMZCinematic);
  if(!handshake&&!noWebGL){assert.equal(frame.getAttribute('src'),'about:blank','a timed-out campus preload must be released');assert.match($('arrivalStatus').textContent,/超时/);}
  $('play').onclick();ticks(120);
  if(reduced)assert.equal(window.HMZCinematic.progress(),0);else assert(window.HMZCinematic.progress()>.04);
  if(!handshake&&!noWebGL){
    // No campus: the descent still scrubs to the end, but never fades in a blank iframe.
    $('progress').oninput({target:{value:'1'}});ticks(150);assert(Math.abs(window.HMZCinematic.progress()-1)<.0001);assert(!(Number(frame.style.opacity)>.001),'a released campus frame must stay invisible');
    $('enterCampus').onclick();assert.equal(context.location.href,'campus-3d.html?enter=gate','without a ready campus, entering must use the standalone gate');
    return {reduced,noWebGL,handshake,passed:true,gpu:false};
  }
  $('progress').oninput({target:{value:'.9'}});ticks(150);assert(Math.abs(window.HMZCinematic.progress()-.9)<.0001);assert(Number(frame.style.opacity)>.9);
  // Scrubbing backwards must restore the geographic view and rewind the arrival camera.
  $('progress').oninput({target:{value:'.3'}});ticks(150);assert(Number(frame.style.opacity)<.001);assert(sent.at(-1).progress===0);
  $('progress').oninput({target:{value:'1'}});ticks(150);assert.equal($('arrival').hidden,false);
  $('enterCampus').onclick();assert(document.body.classList.contains('entered'));assert.equal(sent.at(-1).type,'haiz:arrival:takeover');assert.equal(sent.at(-2).progress,1);
  if(noWebGL)assert.equal($('journey').hidden,true);else{assert.equal(window.HAIZDescentBootError,undefined,'WebGL path fell back: '+JSON.stringify(window.HAIZDescentBootError));assert(renders>0&&disposed);}
  return {reduced,noWebGL,handshake,passed:true,gpu:false};
}
(async()=>{const results=[];for(const options of [{},{reduced:true},{noWebGL:true},{handshake:false}])results.push(await run(options));console.log('PASS cinematic runtime: play, pause/scrub, reverse, iframe origin validation, takeover, campus preload timeout, reduced motion and WebGL fallback',results);})().catch(e=>{console.error(e);process.exitCode=1;});

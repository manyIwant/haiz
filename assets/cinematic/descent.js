(function(){'use strict';
const $=id=>document.getElementById(id),C=window.DescentCore,I=window.DescentImagery,P=window.DescentImageryPlan;
let imageryReport={samplerBudget:0,availableLayers:[],loadedLayers:[],failedLayers:[],remoteCompleted:0},layerState=null;
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches,origin=location.origin;
let renderer,scene,camera,material,progress=0,target=0,playing=false,started=false,entered=false,ready=false,last=performance.now(),chapter=-1,visible=!document.hidden,speed=1,clock=0,lastArrival=null,resolveArrivalBoot=null,lastLabelFrame=-1,lastGlobeBucket=-1;
const mobile=matchMedia('(pointer:coarse)').matches;
const duration=C.duration,frame=$('campusFrame');
function send(type,values={}){frame.contentWindow?.postMessage({type,...values},origin);}
window.addEventListener('message',e=>{if(e.origin!==origin||e.source!==frame.contentWindow)return;if(e.data?.type==='haiz:arrival:ready'){ready=true;resolveArrivalBoot?.(true);$('arrivalStatus').textContent='校园已就绪 · 可以接管行走';lastArrival=C.frame(progress).arrival;send('haiz:arrival:progress',{progress:lastArrival});}if(e.data?.type==='haiz:arrival:error'){resolveArrivalBoot?.(false);$('arrivalStatus').textContent='三维校园暂未就绪，可以使用下方独立入口。';}});
function start(){if(started)return;started=true;document.body.classList.add('is-playing');$('controls').hidden=false;$('caption').hidden=false;playing=!reduced;syncToggle();}
function seek(p){start();playing=false;target=C.clamp(p);if(reduced)progress=target;syncToggle();}
function syncToggle(){$('toggle').textContent=playing?'Ⅱ':'▶';$('toggle').setAttribute('aria-label',playing?'暂停下降':'继续下降');}
function takeover(){if(!ready){location.href='campus-3d.html?enter=gate';return;}entered=true;playing=false;progress=target=1;window.HaizExperience?.setSound(false);send('haiz:arrival:progress',{progress:1});send('haiz:arrival:takeover');document.body.classList.add('entered');frame.removeAttribute('tabindex');frame.focus();if(new URLSearchParams(location.search).get('embed')==='1'&&parent!==window)parent.postMessage({type:'hmz:cinematic:done'},origin);renderer?.dispose();}
function tick(now){if(entered)return;requestAnimationFrame(tick);const elapsed=Math.max(0,(now-last)/1000),dt=Math.min(.075,elapsed);last=now;if(!visible)return;
 if(playing){target=Math.min(1,target+Math.min(elapsed,.15)*speed/duration);if(target===1){playing=false;syncToggle();}}
 progress+= (target-progress)*(reduced?1:1-Math.exp(-dt*8));if(Math.abs(progress-target)<.00001)progress=target;
 const f=C.frame(progress);
 if(material&&(!ready||f.model<.985)){
  clock+=reduced?0:dt;material.uniforms.clock.value=clock;material.uniforms.altitude.value=f.altitude/6371000;material.uniforms.shiftX.value=C.composition(progress,innerWidth/Math.max(1,innerHeight)).shiftX;
  // Only sample the adjacent geographic scales. With 12 source photographs,
  // evaluating every image at every pixel would increase fragment workload.
  if(layerState){
    const {layers,uniforms,present}=layerState;
    const viewWidth=f.altitude*.728*(innerWidth/Math.max(1,innerHeight));
    let base=0;
    for(let i=0;i<layers.length;i++)if(layers[i].widthMeters>=viewWidth*1.15)base=i;
    const low=Math.max(0,base-1),high=Math.min(layers.length-1,base+2);
    for(let i=0;i<layers.length;i++)uniforms['loaded'+i].value=present.has(i)&&i>=low&&i<=high?1:0;
  }
  // During the overlap, keep the 3D model at full refresh. The geographic
  // image needs only 30fps once the model starts appearing. This frees GPU
  // time without dropping or skipping the moving campus surface frames.
  const globeBucket=Math.floor(now/33.333);
  if(progress<.80||globeBucket!==lastGlobeBucket){lastGlobeBucket=globeBucket;renderer.render(scene,camera);}
}
 if(ready){frame.style.opacity=String(f.model);if(lastArrival!==f.arrival){lastArrival=f.arrival;send('haiz:arrival:progress',{progress:f.arrival});}}else frame.style.opacity='0';
 $('locator').style.opacity=String(C.smooth((progress-.23)/.1)*(1-C.smooth((progress-.77)/.05)));
 const labelFrame=Math.floor(now/120);if(labelFrame!==lastLabelFrame){lastLabelFrame=labelFrame;$('altitude').textContent=f.model>.5?'北门 · 即将抵达':f.altitude>1000?'距地表约 '+Math.round(f.altitude/1000).toLocaleString()+' km':'距地表约 '+Math.round(f.altitude)+' m';$('elapsed').textContent='00:'+String(Math.round(progress*duration)).padStart(2,'0')+' / 00:32';}
 const ci=C.chapters.indexOf(f.chapter);if(ci!==chapter){chapter=ci;$('chapterLabel').textContent=f.chapter.label;$('chapterTitle').textContent=f.chapter.title;$('chapterText').textContent=f.chapter.text;document.querySelectorAll('[data-progress]').forEach((b,i)=>b.classList.toggle('active',i===ci));}
 $('caption').hidden=!started||progress>.965;$('arrival').hidden=progress<.985;
 $('progress').value=String(progress);
 if(!material&&I){
  const mix=C.smooth((progress-.21)/.16);
  $('planetFallback').style.opacity=String(1-mix);
  $('fallback').style.opacity=String(mix);
  const layer=I.layers[Math.min(I.layers.length-1,Math.floor(progress*6))];
  if($('fallback').getAttribute('src')!==layer.path)$('fallback').src=layer.path;
 }
}
function resize(){if(!renderer)return;const w=Math.max(1,innerWidth),h=Math.max(1,innerHeight);const maxPixels=mobile?3000000:5600000;const ratio=Math.max(1,Math.min(devicePixelRatio||1,mobile?1.75:2,Math.sqrt(maxPixels/(w*h))));renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);material.uniforms.aspect.value=w/h;material.uniforms.shiftX.value=C.composition(progress,w/h).shiftX;}
async function imageTexture(path,deadline=15000){return new Promise(resolve=>{let done=false;const timeout=setTimeout(()=>finish(null),deadline);function finish(value){if(done){value?.dispose();return;}done=true;clearTimeout(timeout);resolve(value);}try{new THREE.TextureLoader().load(path,finish,undefined,()=>finish(null));}catch{finish(null);}});}
// Some visitors have an older cached HTML document with a newer cinematic
// script. Never let the recovery path throw a SECOND TypeError because a newly
// introduced fallback element is absent in that older DOM.
function ensureJourneyFallback(){
 const host=$('stage')||document.body;
 let planet=$('planetFallback');
 if(!planet){
  planet=document.createElement('div');
  planet.id='planetFallback';
  planet.setAttribute('aria-label','太空中的地球（备用显示）');
  const orb=document.createElement('div');orb.className='fallback-orb';orb.setAttribute('aria-hidden','true');
  planet.appendChild(orb);
  host.insertBefore(planet,$('fallback')||host.firstChild);
 }
 let image=$('fallback');
 if(!image){
  image=document.createElement('img');image.id='fallback';
  image.src='assets/cinematic/aligned/region.jpg';
  image.alt='海南及周边卫星影像（备用显示）';
  host.insertBefore(image,$('campusFrame')||null);
 }
 // Inline styling is intentional: even a cached older stylesheet must
 // render the fallback clearly rather than leaving a black background.
 Object.assign(planet.style,{position:'absolute',inset:'0',display:'block',
  background:'radial-gradient(ellipse at 70% 45%,#102b43 0%,#07121d 45%,#020912 100%)',
  overflow:'hidden',pointerEvents:'none',zIndex:'1'});
 let orb=planet.querySelector('.fallback-orb');
 if(!orb){orb=document.createElement('div');orb.className='fallback-orb';planet.appendChild(orb);}
 Object.assign(orb.style,{position:'absolute',left:'70%',top:'50%',
  transform:'translate(-50%,-50%)',width:'min(52vw,38vh)',aspectRatio:'1',
  borderRadius:'50%',backgroundImage:"radial-gradient(circle at 25% 20%,#ffffff18,transparent 45%),url('assets/cinematic/earth_2048.jpg')",
  backgroundSize:'100% 100%,200% 100%',backgroundPosition:'center,65% 49%',
  boxShadow:'inset -20px -20px 40px #000a,inset 7px 0 16px #ffffff24,0 0 26px #4c86ab66'});
 Object.assign(image.style,{position:'absolute',inset:'0',width:'100%',height:'100%',
  objectFit:'cover',opacity:'0',pointerEvents:'none',zIndex:'1'});
 return {planet,image};
}
function recoverJourney(originalError){
 console.warn('Journey WebGL initialization failed; switching to Earth-first fallback',originalError);
 window.HAIZDescentBootError={message:String(originalError?.message||originalError),time:Date.now()};
 try{renderer?.dispose()}catch(disposeError){console.warn('Renderer disposal failed',disposeError);}
 renderer=null;material=null;layerState=null;
 const canvas=$('journey');if(canvas)canvas.hidden=true;
 const {planet,image}=ensureJourneyFallback();
 planet.hidden=false;image.hidden=false;
 const status=$('loadStatus');if(status)status.textContent='3D 地球暂不可用，已切换备用视图；仍可观看下降';
}
async function boot(){
 try{
 if(!I?.layers?.length)throw Error('地理影像未能读取，请使用校园的直接入口。');
  renderer=new THREE.WebGLRenderer({canvas:$('journey'),antialias:false,powerPreference:'high-performance'});
  scene=new THREE.Scene();camera=new THREE.Camera();
  const lat=I.target.lat*Math.PI/180,lon=I.target.lon*Math.PI/180,n=new THREE.Vector3(Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon)),east=new THREE.Vector3().crossVectors(n,new THREE.Vector3(0,1,0)).normalize(),up=new THREE.Vector3().crossVectors(n.clone().negate(),east).normalize();
  const empty=new THREE.DataTexture(new Uint8Array([58,86,80,255]),1,1);empty.needsUpdate=true;
  const net=navigator.connection;
  const remoteAllowed=!net?.saveData&&!['slow-2g','2g'].includes(net?.effectiveType);
  // If a cached HTML page does not yet load the optional image-planning
  // helper, still start with the intact globe and six bundled geographic
  // levels. A missing enhancement must never blank the whole opening.
  const plan=P?.create?P.create(I,renderer.capabilities.maxTextures,{enableRemote:remoteAllowed})
   :{layers:I.layers.map(layer=>({...layer,bundled:true})),
     samplerBudget:renderer.capabilities.maxTextures||8,extraCount:0};
  const layers=plan.layers;
  imageryReport={samplerBudget:plan.samplerBudget,availableLayers:layers.map(l=>({name:l.name,spanMeters:l.widthMeters,source:l.extra?'ArcGIS dynamic':'bundled JPG'})),loadedLayers:[],failedLayers:[],remoteCompleted:0};
  const uniforms={aspect:{value:innerWidth/innerHeight},clock:{value:0},altitude:{value:C.frame(0).altitude/6371000},shiftX:{value:C.composition(0,innerWidth/Math.max(1,innerHeight)).shiftX},focus:{value:n},east:{value:east},north:{value:up},earth:{value:empty}};
  layerState={layers,uniforms,present:new Set()};
  let declarations='',sampling='';layers.forEach((layer,i)=>{uniforms['tile'+i]={value:empty};uniforms['bounds'+i]={value:new THREE.Vector4(...layer.bounds)};uniforms['loaded'+i]={value:0};declarations+=`uniform sampler2D tile${i};uniform vec4 bounds${i};uniform float loaded${i};\n`;sampling+=`{vec2 uv=(merc-bounds${i}.xy)/(bounds${i}.zw-bounds${i}.xy);float edge=min(min(uv.x,uv.y),min(1.-uv.x,1.-uv.y));float span=(bounds${i}.z-bounds${i}.x)/6378137.;float detail=1.-smoothstep(span*.57,span*1.35,altitude);float a=smoothstep(0.,.055,edge)*loaded${i}*detail;if(a>.001) color=mix(color,texture2D(tile${i},clamp(uv,0.,1.)).rgb,a);}\n`;});
  material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms,vertexShader:'varying vec2 screen;void main(){screen=uv*2.-1.;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`precision highp float;varying vec2 screen;uniform float aspect,altitude,shiftX;uniform vec3 focus,east,north;uniform sampler2D earth;${declarations}
   uniform float clock;
   float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   void main(){vec3 ro=focus*(1.+altitude);vec3 rd=normalize(-focus+east*(screen.x-shiftX)*aspect*.364+north*screen.y*.364);float b=dot(ro,rd),c=dot(ro,ro)-1.,h=b*b-c;vec3 color=vec3(.018,.033,.05);float air=1.-smoothstep(.005,.08,altitude);color=mix(color,vec3(.53,.66,.70),air);
    vec2 st=screen*vec2(aspect,1.)*95.;vec2 cell=floor(st);float seed=hash21(cell);float star=step(.992,seed)*(1.-smoothstep(.015,.09,length(fract(st)-vec2(hash21(cell+1.),hash21(cell+3.)))));color+=vec3(.6,.68,.74)*star*(.65+.35*sin(clock*.45+seed*60.))*(1.-air);
    if(h>0.){float t=-b-sqrt(h);if(t>0.){vec3 p=normalize(ro+rd*t);float lat=asin(clamp(p.y,-1.,1.)),lon=atan(p.z,p.x);color=texture2D(earth,vec2(lon/6.2831853+.5,lat/3.14159265+.5)).rgb;vec2 merc=vec2(lon,log(tan(.785398163+clamp(lat,-1.4844222,1.4844222)*.5)))*6378137.;${sampling}
     vec3 light=normalize(focus*.85+north*.35-east*.55);float diffuse=.56+.44*max(0.,dot(p,light));color*=diffuse;float limb=pow(1.-max(0.,dot(p,-rd)),3.);color=mix(color,vec3(.35,.58,.78),limb*.65*(1.-air));color=pow(color,vec3(.96));
    }}else{float nearLine=exp(-max(0.,-h)*38.);color+=vec3(.06,.16,.25)*nearLine*(1.-air);}
    gl_FragColor=vec4(color,1.);
   }`});
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));resize();
  // Prepare the heavy campus scene while the opening title is still shown,
  // never on the first moving frame. If preparation times out, keep the
  // satellite journey playable and offer the separate campus entrance.
  const arrivalBoot=new Promise(resolve=>{resolveArrivalBoot=resolve;});
  frame.setAttribute('src',frame.getAttribute('data-campus-src'));
  const arrivalTimeout=new Promise(resolve=>setTimeout(()=>resolve(false),14000));
  const arrivalTask=Promise.race([arrivalBoot,arrivalTimeout]);
  function setTexture(tex,index){tex.minFilter=THREE.LinearMipmapLinearFilter;tex.magFilter=THREE.LinearFilter;tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());tex.needsUpdate=true;if(index===0)uniforms.earth.value=tex;else{uniforms['tile'+(index-1)].value=tex;uniforms['loaded'+(index-1)].value=1;layerState.present.add(index-1);}}
  let count=0;
  const paths=['assets/cinematic/earth_2048.jpg',...I.layers.map(l=>l.path)];
  // All six bundled imagery layers remain as offline/failed-network fallback.
  for(let i=0;i<paths.length;i++){
    const tex=await imageTexture(paths[i]);
    if(tex){
      const index=i===0?0:layers.findIndex(l=>l.path===paths[i])+1;
      if(index>0||i===0){
        setTexture(tex,index);renderer.initTexture?.(tex);
        imageryReport.loadedLayers.push(i===0?'earth':I.layers[i-1].name);
      }else tex.dispose();
    }else imageryReport.failedLayers.push(paths[i]);
    count++;$('loadStatus').textContent='基础影像 '+count+' / '+paths.length;
  }
  renderer.render(scene,camera); // compile/prime GPU before starting
  // Add NEW independent image extents between the originals. The original
  // images are never merely resized to masquerade as higher resolution.
  // Also upgrade the four close-range bundled extents to 2K where possible.
  const priority=['district-campus-mid','city-district-mid','island-city-mid','campus-courtyard-mid','courtyard-close','region-mid'];
  const remoteExtras=layers.filter(l=>l.extra).sort((a,b)=>priority.indexOf(a.name)-priority.indexOf(b.name));
  const remoteOriginals=remoteAllowed&&!mobile?I.layers.slice(-4).map(l=>layers.find(v=>v.path===l.path)):[];
  const remoteJobs=[...remoteExtras,...remoteOriginals].filter(Boolean);
  let cursor=0,done=0;
  const applyRemote=async(layer)=>{
    const index=layers.indexOf(layer),size=layer.extra?layer.pixels:2048;
    try{
      const url=new URL(layer.source);
      if(!/^https:\/\/server\.arcgisonline\.com\//i.test(url.href))throw Error('Unrecognized imagery provider');
      url.searchParams.set('size',size+','+size);
      url.searchParams.set('compressionQuality','88');
      const tex=await imageTexture(url.href,5500);
      if(!tex||tex.image?.width<size*.9||tex.image?.height<size*.9){
        tex?.dispose();imageryReport.failedLayers.push(layer.name+' (HD unavailable)');return;
      }
      const previous=uniforms['tile'+index].value;
      setTexture(tex,index+1);
      renderer.initTexture?.(tex);
      if(previous!==empty&&previous!==tex)previous.dispose();
      imageryReport.loadedLayers.push(layer.name+' '+tex.image.width+'px');
    }catch(err){imageryReport.failedLayers.push(layer.name+': '+(err?.message||String(err)));}
    finally{done++;imageryReport.remoteCompleted=done;
      $('loadStatus').textContent='补充逐级影像 '+done+' / '+remoteJobs.length;}
  };
  const workers=Array.from({length:Math.min(4,remoteJobs.length)},async()=>{
    while(cursor<remoteJobs.length)await applyRemote(remoteJobs[cursor++]);
  });
  await Promise.all(workers);
  renderer.render(scene,camera);
  $('loadStatus').textContent='影像已就绪，正在确认校园衔接…';
  if(!(await arrivalTask)&&!ready){frame.setAttribute('src','about:blank');$('arrivalStatus').textContent='校园预载超时，抵达时可通过独立入口进入。';}
 }catch(err){recoverJourney(err);}
 // The geographic opening is usable immediately after its own imagery loads.
 // The campus starts only on user action; it never gates the play button.
 $('play').disabled=false;$('playText').textContent=reduced?'选择章节，静静观看':'开始下降 · 32 秒';$('loadStatus').textContent=reduced?'已遵循减少动态效果设置。':imageryReport.remoteCompleted?'已载入 '+imageryReport.loadedLayers.filter(n=>n.includes('px')).length+' 张增强影像 · 可暂停或回看。':'可以暂停、回看，或拖动下方进度。';
 $('play').onclick=start;$('toggle').onclick=()=>{if(!started){start();return;}if(progress>=1){target=progress=0;}playing=!playing;syncToggle();};$('progress').oninput=e=>seek(Number(e.target.value));$('enterCampus').onclick=takeover;
 $('journeySpeed').onchange=e=>{const next=Number(e.target.value);if([.75,1,1.5,2].includes(next))speed=next;};
 document.querySelectorAll('[data-progress]').forEach(b=>b.onclick=()=>seek(Number(b.dataset.progress)));
 window.addEventListener('wheel',e=>{if(!started||entered||document.querySelector('dialog[open]')||e.target.closest('button,input,a,select'))return;e.preventDefault();seek(target+C.clamp(e.deltaY,-120,120)*.00065);},{passive:false});
 let touch=null;
 $('stage').addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'||!started||entered||e.target.closest('button,input,a,select'))return;touch={y:e.clientY,p:target,id:e.pointerId};$('stage').setPointerCapture?.(e.pointerId);});
 $('stage').addEventListener('pointermove',e=>{if(!touch||e.pointerId!==touch.id)return;seek(touch.p+(touch.y-e.clientY)*.0013);});
 for(const event of ['pointerup','pointercancel'])$('stage').addEventListener(event,()=>{touch=null;});
 window.addEventListener('keydown',e=>{if(entered||document.querySelector('dialog[open]')||e.target.closest('input,select,textarea,button,a,[contenteditable="true"]'))return;if(e.code==='Space'){e.preventDefault();$('toggle').click();}if(e.key==='ArrowRight'){e.preventDefault();seek(target+.035);}if(e.key==='ArrowLeft'){e.preventDefault();seek(target-.035);}});
 window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{visible=!document.hidden;last=performance.now();});
 // A direct, opt-in arrival preview makes it possible to verify this
 // transition in a browser without replaying the earlier 25 seconds.
 // Normal visitors still start at the full Earth shot.
 if(new URLSearchParams(location.search).get('preview')==='arrival'){
   start();progress=target=.76;playing=!reduced;syncToggle();
 }
 window.HMZCinematic={state:()=>entered?'DONE':progress>.98?'GATE':'DESCENDING',progress:()=>progress,setProgress:seek,skip:()=>location.href='campus-3d.html?enter=gate',imageQuality:()=>({...imageryReport,canvasSize:renderer?{width:renderer.domElement.width,height:renderer.domElement.height}:null})};
 requestAnimationFrame(tick);
}
boot().catch(err=>{
 // Preserve the original diagnostic; do not conceal it behind a null DOM error.
 try{recoverJourney(err);}catch(recoveryError){console.error('Cinematic recovery failed',recoveryError);}
 const status=$('loadStatus');if(status)status.textContent='初始化失败：'+String(err?.message||err);
 const play=$('play');if(play){play.disabled=true;play.textContent='请刷新页面重试';}
});
})();

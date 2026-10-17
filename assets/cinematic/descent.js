(function(){'use strict';
const $=id=>document.getElementById(id),C=window.DescentCore,I=window.DescentImagery;
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches,origin=location.origin;
let renderer,scene,camera,material,progress=0,target=0,playing=false,started=false,entered=false,ready=false,last=performance.now(),chapter=-1,visible=!document.hidden;
const duration=C.duration,frame=$('campusFrame');
function send(type,values={}){frame.contentWindow?.postMessage({type,...values},origin);}
window.addEventListener('message',e=>{if(e.origin!==origin||e.source!==frame.contentWindow)return;if(e.data?.type==='haiz:arrival:ready'){ready=true;$('arrivalStatus').textContent='校园已就绪 · 可以接管行走';send('haiz:arrival:progress',{progress:C.frame(progress).arrival});}if(e.data?.type==='haiz:arrival:error')$('arrivalStatus').textContent='三维校园暂未就绪，可以使用下方独立入口。';});
function start(){if(started)return;started=true;document.body.classList.add('is-playing');$('controls').hidden=false;$('caption').hidden=false;playing=!reduced;syncToggle();}
function seek(p){start();playing=false;target=C.clamp(p);if(reduced)progress=target;syncToggle();}
function syncToggle(){$('toggle').textContent=playing?'Ⅱ':'▶';$('toggle').setAttribute('aria-label',playing?'暂停下降':'继续下降');}
function takeover(){if(!ready){location.href='campus-3d.html?enter=gate';return;}entered=true;playing=false;progress=target=1;send('haiz:arrival:progress',{progress:1});send('haiz:arrival:takeover');document.body.classList.add('entered');frame.removeAttribute('tabindex');frame.focus();if(new URLSearchParams(location.search).get('embed')==='1'&&parent!==window)parent.postMessage({type:'hmz:cinematic:done'},origin);renderer?.dispose();}
function tick(now){requestAnimationFrame(tick);const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;if(entered||!visible)return;
 if(playing){target=Math.min(1,target+dt/duration);if(target===1){playing=false;syncToggle();}}
 progress+= (target-progress)*(reduced?1:1-Math.exp(-dt*8));if(Math.abs(progress-target)<.00001)progress=target;
 const f=C.frame(progress);
 if(material&&progress<.94){material.uniforms.altitude.value=f.altitude/6371000;renderer.render(scene,camera);}
 if(ready){frame.style.opacity=String(f.model);send('haiz:arrival:progress',{progress:f.arrival});}else frame.style.opacity='0';
 $('locator').style.opacity=String(C.smooth((progress-.23)/.1)*(1-C.smooth((progress-.77)/.05)));
 $('altitude').textContent=f.model>.5?'北门 · 即将抵达':f.altitude>1000?'距地表约 '+Math.round(f.altitude/1000).toLocaleString()+' km':'距地表约 '+Math.round(f.altitude)+' m';
 const ci=C.chapters.indexOf(f.chapter);if(ci!==chapter){chapter=ci;$('chapterLabel').textContent=f.chapter.label;$('chapterTitle').textContent=f.chapter.title;$('chapterText').textContent=f.chapter.text;document.querySelectorAll('[data-progress]').forEach((b,i)=>b.classList.toggle('active',i===ci));}
 $('caption').hidden=!started||progress>.965;$('arrival').hidden=progress<.985;
 $('progress').value=String(progress);$('elapsed').textContent='00:'+String(Math.round(progress*duration)).padStart(2,'0')+' / 00:32';
 if(!material&&I){const layer=I.layers[Math.min(I.layers.length-1,Math.floor(progress*6))];if($('fallback').getAttribute('src')!==layer.path)$('fallback').src=layer.path;}
}
function resize(){if(!renderer)return;renderer.setSize(innerWidth,innerHeight,false);material.uniforms.aspect.value=innerWidth/innerHeight;}
async function imageTexture(path){return new Promise(resolve=>{let done=false;const timeout=setTimeout(()=>finish(null),15000);function finish(value){if(done){value?.dispose();return;}done=true;clearTimeout(timeout);resolve(value);}try{new THREE.TextureLoader().load(path,finish,undefined,()=>finish(null));}catch{finish(null);}});}
async function boot(){
 if(!I?.layers?.length)throw Error('地理影像未能读取，请使用校园的直接入口。');
 try{
  renderer=new THREE.WebGLRenderer({canvas:$('journey'),antialias:false,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));
  scene=new THREE.Scene();camera=new THREE.Camera();
  const lat=I.target.lat*Math.PI/180,lon=I.target.lon*Math.PI/180,n=new THREE.Vector3(Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon)),east=new THREE.Vector3().crossVectors(n,new THREE.Vector3(0,1,0)).normalize(),up=new THREE.Vector3().crossVectors(n.clone().negate(),east).normalize();
  const empty=new THREE.DataTexture(new Uint8Array([58,86,80,255]),1,1);empty.needsUpdate=true;
  const uniforms={aspect:{value:innerWidth/innerHeight},altitude:{value:16000000/6371000},focus:{value:n},east:{value:east},north:{value:up},earth:{value:empty}};
  let declarations='',sampling='';I.layers.forEach((layer,i)=>{uniforms['tile'+i]={value:empty};uniforms['bounds'+i]={value:new THREE.Vector4(...layer.bounds)};uniforms['loaded'+i]={value:0};declarations+=`uniform sampler2D tile${i};uniform vec4 bounds${i};uniform float loaded${i};\n`;sampling+=`{vec2 uv=(merc-bounds${i}.xy)/(bounds${i}.zw-bounds${i}.xy);float edge=min(min(uv.x,uv.y),min(1.-uv.x,1.-uv.y));float a=smoothstep(0.,.075,edge)*loaded${i};if(a>0.) color=mix(color,texture2D(tile${i},clamp(uv,0.,1.)).rgb,a);}\n`;});
  material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms,vertexShader:'varying vec2 screen;void main(){screen=uv*2.-1.;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`precision highp float;varying vec2 screen;uniform float aspect,altitude;uniform vec3 focus,east,north;uniform sampler2D earth;${declarations}
   void main(){vec3 ro=focus*(1.+altitude);vec3 rd=normalize(-focus+east*screen.x*aspect*.364+north*screen.y*.364);float b=dot(ro,rd),c=dot(ro,ro)-1.,h=b*b-c;vec3 color=vec3(.018,.033,.05);float air=1.-smoothstep(.005,.08,altitude);color=mix(color,vec3(.53,.66,.70),air);
    if(h>0.){float t=-b-sqrt(h);if(t>0.){vec3 p=normalize(ro+rd*t);float lat=asin(clamp(p.y,-1.,1.)),lon=atan(p.z,p.x);color=texture2D(earth,vec2(lon/6.2831853+.5,lat/3.14159265+.5)).rgb;vec2 merc=vec2(lon,log(tan(.785398163+clamp(lat,-1.4844222,1.4844222)*.5)))*6378137.;${sampling}
     vec3 light=normalize(focus*.85+north*.35-east*.55);float diffuse=.56+.44*max(0.,dot(p,light));color*=diffuse;float limb=pow(1.-max(0.,dot(p,-rd)),3.);color=mix(color,vec3(.35,.58,.78),limb*.65*(1.-air));color=pow(color,vec3(.96));
    }}else{float nearLine=exp(-max(0.,-h)*38.);color+=vec3(.06,.16,.25)*nearLine*(1.-air);}
    gl_FragColor=vec4(color,1.);
   }`});
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));resize();
  let count=0;const paths=['assets/cinematic/earth_2048.jpg',...I.layers.map(l=>l.path)];
  await Promise.all(paths.map(async(path,i)=>{const tex=await imageTexture(path);if(tex){tex.minFilter=THREE.LinearMipmapLinearFilter;tex.magFilter=THREE.LinearFilter;tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());if(i===0)uniforms.earth.value=tex;else{uniforms['tile'+(i-1)].value=tex;uniforms['loaded'+(i-1)].value=1;}}count++;$('loadStatus').textContent='影像准备 '+count+' / '+paths.length;}));
 }catch(err){console.warn('Journey WebGL fallback',err);renderer?.dispose();material=null;$('journey').hidden=true;$('fallback').hidden=false;}
 $('play').disabled=false;$('playText').textContent=reduced?'选择章节，静静观看':'开始下降 · 32 秒';$('loadStatus').textContent=reduced?'已遵循减少动态效果设置。':'可以暂停、回看，或拖动下方进度。';
 $('play').onclick=start;$('toggle').onclick=()=>{if(!started){start();return;}if(progress>=1){target=progress=0;}playing=!playing;syncToggle();};$('progress').oninput=e=>seek(Number(e.target.value));$('enterCampus').onclick=takeover;
 document.querySelectorAll('[data-progress]').forEach(b=>b.onclick=()=>seek(Number(b.dataset.progress)));
 window.addEventListener('wheel',e=>{if(!started||entered||e.target.closest('button,input,a'))return;e.preventDefault();seek(target+C.clamp(e.deltaY,-120,120)*.00065);},{passive:false});
 window.addEventListener('keydown',e=>{if(entered||e.target.tagName==='INPUT')return;if(e.code==='Space'){e.preventDefault();$('toggle').click();}if(e.key==='ArrowRight'){e.preventDefault();seek(target+.035);}if(e.key==='ArrowLeft'){e.preventDefault();seek(target-.035);}});
 window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{visible=!document.hidden;last=performance.now();});
 window.HMZCinematic={state:()=>entered?'DONE':progress>.98?'GATE':'DESCENDING',progress:()=>progress,setProgress:seek,skip:()=>location.href='campus-3d.html?enter=gate'};
 requestAnimationFrame(tick);
}
boot().catch(err=>{$('loadStatus').textContent=err.message;$('play').hidden=true;});
})();

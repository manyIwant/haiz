(()=>{'use strict';
  const $=id=>document.getElementById(id);
  const origin=location.origin,coarse=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>1;
  const media=matchMedia('(prefers-reduced-motion:reduce)');
  const views=['spatial','map'];
  let api=null,mode='overview',view=innerWidth<=700?'map':'spatial',selected='yihao',reduced=media.matches,theme='ocean',flight=null;
  let orbitCamera=null,spatialCamera=null,flightCamera=null,activeCamera=null,raf=0,disposed=false,highlight=null,lastWalkPublish=0;
  let hiddenAt=0,loadAttempts=0,lastLoad='',sourceFog=null,lastGpuFrame=0,sourceLighting=null,lastV3Frame=0;
  const cameraPoints=[],photoMaterials=new Set();
  const target={x:0,y:0,z:20},orbit={azimuth:0,polar:1.0,radius:Math.hypot(375,560),span:480};
  const pointers=new Map();let gesture=null;
  const labelIds=['yihao','library','fengqitang','yanlintang','yanchi','beimen','nanmen','yundong'];
  const post=(type,payload={})=>{if(parent!==window&&!disposed)parent.postMessage({type,...payload},origin);};
  const byId=id=>api?.world.buildings.find(b=>b.data.id===id);
  const validId=id=>typeof id==='string'&&!!byId(id);
  const ease=t=>t*t*(3-2*t);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function cameraLabels(){
    if(!api||!activeCamera||mode==='walk')return [];
    activeCamera.updateMatrixWorld(true);
    return labelIds.map(id=>{const b=byId(id);if(!b)return null;
      const top=b.data.form==='garden'?8:Math.max(2,b.data.size[1])+3;
      const p=new THREE.Vector3(b.center.x,top,b.center.z).project(activeCamera);
      return {id,name:b.data.name,x:(p.x+1)/2,y:(1-p.y)/2,visible:p.z>-1&&p.z<1&&Math.abs(p.x)<.96&&Math.abs(p.y)<.94};
    }).filter(Boolean);
  }
  function publish(extra={}){
    if(!api)return;
    const diagnostics=document.documentElement.dataset,render=api.renderer.info?.render;
    diagnostics.atlasMode=mode;diagnostics.atlasView=view;diagnostics.atlasSelected=selected;
    diagnostics.atlasQuality=api.state.effectiveQuality||api.state.quality;
    diagnostics.atlasNodes=String(api.world.buildings.length);
    diagnostics.atlasX=String(api.state.pos?.x??0);diagnostics.atlasZ=String(api.state.pos?.z??0);
    diagnostics.atlasPaused=String(api.state.paused);diagnostics.atlasReduced=String(reduced);
    diagnostics.atlasDrawCalls=String(render?.calls??0);diagnostics.atlasTriangles=String(render?.triangles??0);
    post('haiz-atlas:state',{ready:true,time:api.v3?.time||'morning',model:api.v3?.state.status||'legacy',modelError:api.v3?.state.error||null,floorY:api.state.floorY||0,mode,view,selected,x:api.state.pos?.x,z:api.state.pos?.z,drawCalls:render?.calls||0,triangles:render?.triangles||0,progress:flight?.progress||0,labels:cameraLabels(),nodes:api.world.buildings.length,quality:api.state.effectiveQuality||api.state.quality,reduced,paused:api.state.paused,...extra});
  }
  function calibratePhotoMaterials(){
    const walls={yihao:'#deded8',erhao:'#e3e3dd',library:'#e7e7e1'};
    for(const b of api.world.buildings){
      const id=b.data.id;if(!Object.hasOwn(walls,id)&&id!=='fengqitang')continue;
      const copies=new Map();
      function material(original){
        if(!original?.isMeshStandardMaterial||original.userData.blenderV3)return original;
        const kind=original.userData.surfaceStudy;
        if(!(kind==='ceramic'&&Object.hasOwn(walls,id))&&!(kind==='roof'&&id==='fengqitang'))return original;
        if(copies.has(original))return copies.get(original);
        // Shared campus materials must stay intact for other buildings and climate.
        const copy=original.clone();
        if(kind==='ceramic'){
          copy.color.set(walls[id]).convertSRGBToLinear();copy.roughness=Math.max(copy.roughness,.82);
        }else{
          copy.roughness=Math.max(copy.roughness,.78);copy.metalness=Math.min(copy.metalness,.02);
          if(copy.isMeshPhysicalMaterial)copy.clearcoat=Math.min(copy.clearcoat,.08);
        }
        copy.userData.atlasPhotoCalibrated=id;
        copies.set(original,copy);photoMaterials.add(copy);return copy;
      }
      b.group.traverse(o=>{if(o.isMesh)o.material=Array.isArray(o.material)?o.material.map(material):material(o.material);});
    }
  }
  function fitCamera(){
    if(!orbitCamera)return;
    const aspect=innerWidth/Math.max(1,innerHeight),portrait=aspect<.8;
    const aim=new THREE.Vector3(target.x,target.y,target.z);
    const direction=new THREE.Vector3(Math.sin(orbit.azimuth)*Math.sin(orbit.polar),Math.cos(orbit.polar),Math.cos(orbit.azimuth)*Math.sin(orbit.polar));
    const half=orbit.span/480*Math.max(240,260/aspect),shift=portrait?half*.28:0;
    orbitCamera.left=-half*aspect;orbitCamera.right=half*aspect;orbitCamera.top=half-shift;orbitCamera.bottom=-half-shift;
    orbitCamera.position.copy(direction).multiplyScalar(orbit.radius).add(aim);
    orbitCamera.lookAt(aim);orbitCamera.updateProjectionMatrix();orbitCamera.updateMatrixWorld(true);
    spatialCamera.aspect=aspect;spatialCamera.position.copy(aim).add(direction);spatialCamera.lookAt(aim);
    const inverse=spatialCamera.quaternion.clone().invert(),tangent=Math.tan(THREE.MathUtils.degToRad(spatialCamera.fov/2));
    let distance=120,depth=0;
    for(const point of cameraPoints){
      const p=point.clone().sub(aim).applyQuaternion(inverse);
      depth=Math.max(depth,Math.abs(p.z));
      distance=Math.max(distance,p.z+Math.max(Math.abs(p.x)/(.88*aspect*tangent),Math.abs(p.y)/((portrait?.48:.82)*tangent)));
    }
    distance*=orbit.span/480;
    spatialCamera.position.copy(direction).multiplyScalar(distance).add(aim);
    // An eye-level near plane loses depth precision at whole-campus distances.
    spatialCamera.near=Math.max(.1,distance-depth-80);
    spatialCamera.far=Math.max(1600,distance+1000);
    spatialCamera.setViewOffset(innerWidth,innerHeight,0,portrait?innerHeight*.14:0,innerWidth,innerHeight);
    spatialCamera.updateProjectionMatrix();spatialCamera.updateMatrixWorld(true);
    if(mode==='overview')activeCamera=view==='spatial'?spatialCamera:orbitCamera;
  }
  function captureLighting(){
    const lights=[];
    api.scene.traverse(o=>{if(o.isLight)lights.push({object:o,color:o.color.clone(),intensity:o.intensity,ground:o.groundColor?.clone()});});
    sourceLighting={lights,exposure:api.renderer.toneMappingExposure};
  }
  function restoreLighting(){
    if(api?.v3){api.v3.setMode(mode);api.v3.tick(0,false);return;}
    if(!sourceLighting)return;
    for(const l of sourceLighting.lights){l.object.color.copy(l.color);l.object.intensity=l.intensity;if(l.ground)l.object.groundColor.copy(l.ground);}
    api.renderer.toneMappingExposure=sourceLighting.exposure;
  }
  function observationLighting(){
    if(api?.v3){api.v3.setMode(mode);api.v3.tick(0,false);return;}
    if(!sourceLighting)return;
    const warm=new THREE.Color(theme==='porcelain'?'#fff0dc':theme==='obsidian'?'#f3dfbd':'#f2ead9');
    for(const l of sourceLighting.lights){
      l.object.color.copy(l.color);l.object.intensity=l.intensity;
      if(l.object.isDirectionalLight){l.object.color.lerp(warm,.18);l.object.intensity*=1.08;}
      else if(l.object.isHemisphereLight)l.object.intensity*=.86;
      else if(l.object.isAmbientLight)l.object.intensity*=.8;
    }
    api.renderer.toneMappingExposure=sourceLighting.exposure*(theme==='porcelain'?1.02:theme==='obsidian'?.96:1);
  }
  function markDirty(){
    if(disposed||document.hidden||raf||!api)return;
    raf=requestAnimationFrame(draw);
  }
  function prepareScene(){
    // Whole-campus view must not inherit first-person distance culling.
    for(const tile of api.world.vegetationTiles||[])tile.group.visible=true;
    if(mode!=='walk')observationLighting();
  }
  function draw(now){
    raf=0;if(disposed||document.hidden||!api)return;
    if(api.state.effectiveQuality==='low'&&now-lastGpuFrame<32){markDirty();return;}
    lastGpuFrame=now;
    if(mode==='approach'&&flight)advanceFlight(now);
    if(mode!=='walk'||api.state.paused&&api.v3?.diagnostics().transitioning){
      prepareScene();
      api.v3?.tick(lastV3Frame?Math.min(.1,(now-lastV3Frame)/1000):.016,false);lastV3Frame=now;
      api.renderer.render(api.scene,activeCamera);publish();
      if(flight||api.v3?.diagnostics().transitioning)markDirty();
    }
  }
  function removeHighlight(){if(!highlight)return;api.scene.remove(highlight);highlight.geometry.dispose();highlight.material.dispose();highlight=null;}
  function updateHighlight(){
    removeHighlight();const b=byId(selected);if(!b)return;
    // A selection edge follows the retained mesh bounds; it never moves a mesh.
    highlight=new THREE.BoxHelper(b.group,theme==='porcelain'?0x8e6f47:0xb8d4dd);
    highlight.material.transparent=true;highlight.material.opacity=.16;highlight.material.depthTest=false;highlight.renderOrder=10;
    api.scene.add(highlight);highlight.visible=mode==='overview'&&view==='map';
  }
  function choose(id){
    if(!validId(id))return;
    if(mode==='approach')cancelFlight();
    if(mode==='walk')showOverview(false);
    selected=id;updateHighlight();publish();markDirty();
  }
  function pauseSource(){
    api.state.started=true;api.pause(null);api.state.paused=true;api.state.haizDirty=false;
    document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  }
  function showOverview(reset=true){
    if(!api)return;
    if(mode==='walk')captureLighting();
    flight=null;pauseSource();mode='overview';pointers.clear();gesture=null;
    document.body.classList.remove('atlas-bridge-walk');$('touchControls').hidden=true;
    if(reset){orbit.azimuth=0;orbit.polar=view==='spatial'?1:Math.atan2(375,560);orbit.span=480;target.x=0;target.y=0;target.z=20;}
    fitCamera();updateHighlight();api.renderer.domElement.setAttribute('aria-label','全校三维视野：拖动旋转、滚动或双指缩放、点击选择建筑');
    publish();markDirty();
  }
  function changeView(value){
    if(!views.includes(value))return;
    view=value;showOverview();
  }
  function arrivalSnapshot(){
    // Only the retained engine chooses a collision-safe exterior arrival.
    restoreLighting();
    const ok=api.goTo(selected,false);api.pause(null);api.state.paused=true;api.state.haizDirty=false;
    if(ok===false)return null;
    api.state.photoFov=api.v3?60:48;api.camera.fov=api.state.photoFov;api.camera.updateProjectionMatrix();
    return {position:api.camera.position.clone(),quaternion:api.camera.quaternion.clone(),fov:api.camera.fov};
  }
  function startWalk(arrival=flight?.arrival){
    if(!api)return;
    arrival=arrival||arrivalSnapshot();flight=null;
    if(!arrival){post('haiz-atlas:error',{text:'附近暂时没有安全落点，请选择另一座建筑。'});return;}
    restoreLighting();api.camera.position.copy(arrival.position);api.camera.quaternion.copy(arrival.quaternion);api.camera.fov=arrival.fov;api.camera.updateProjectionMatrix();
    mode='walk';activeCamera=api.camera;api.scene.fog=sourceFog;highlight&&(highlight.visible=false);
    document.body.classList.add('atlas-bridge-walk','started');$('hud').hidden=false;$('touchControls').hidden=!coarse;
    api.state.photoFov=api.v3?60:48;api.v3?.setMode('walk');api.resume(false);api.renderer.domElement.setAttribute('aria-label','第一人称校园漫游：WASD 或方向键行走、按住场景拖动环顾、Esc 暂停');
    api.renderer.domElement.focus({preventScroll:true});publish({progress:1});
  }
  function approach(){
    if(!api)return;
    if(mode==='walk'){startWalk();return;}
    if(reduced){startWalk();return;}
    const from=activeCamera||spatialCamera;
    const fromPos=from.position.clone(),fromQuat=from.quaternion.clone();
    const arrival=arrivalSnapshot();if(!arrival)return;
    const distance=fromPos.distanceTo(new THREE.Vector3(target.x,target.y,target.z));
    const half=(orbitCamera.top-orbitCamera.bottom)/2;
    const initialFov=from.isOrthographicCamera?THREE.MathUtils.radToDeg(2*Math.atan(half/Math.max(1,distance))):from.fov;
    const shift=from.isOrthographicCamera?-(from.top+from.bottom)/(from.top-from.bottom):(from.view?.offsetY||0)/innerHeight*2;
    flightCamera=new THREE.PerspectiveCamera(initialFov,innerWidth/innerHeight,from.near,Math.max(1600,from.far));
    flightCamera.position.copy(fromPos);flightCamera.quaternion.copy(fromQuat);
    flightCamera.setViewOffset(innerWidth,innerHeight,0,innerHeight*shift/2,innerWidth,innerHeight);
    flightCamera.updateProjectionMatrix();
    const cruise=new THREE.Vector3(arrival.position.x,Math.max(70,arrival.position.y+60),arrival.position.z);
    const departure=new THREE.Vector3(fromPos.x+(cruise.x-fromPos.x)*.45,fromPos.y,fromPos.z+(cruise.z-fromPos.z)*.45);
    flight={started:performance.now(),duration:2600,fromPos,fromQuat,initialFov,initialNear:from.near,shift,arrival,cruise,departure,progress:0};
    mode='approach';activeCamera=flightCamera;highlight&&(highlight.visible=false);publish();markDirty();
  }
  function advanceFlight(now){
    const f=flight;if(!f)return;f.progress=clamp((now-f.started)/f.duration,0,1);
    const t=ease(f.progress),u=1-t;
    activeCamera.position.copy(f.fromPos).multiplyScalar(u*u*u)
      .addScaledVector(f.departure,3*u*u*t).addScaledVector(f.cruise,3*u*t*t).addScaledVector(f.arrival.position,t*t*t);
    activeCamera.quaternion.slerpQuaternions(f.fromQuat,f.arrival.quaternion,t);
    activeCamera.fov=THREE.MathUtils.lerp(f.initialFov,f.arrival.fov,t);
    activeCamera.near=.1+(f.initialNear-.1)*u*u*u;
    activeCamera.setViewOffset(innerWidth,innerHeight,0,innerHeight*f.shift*(1-t)/2,innerWidth,innerHeight);
    activeCamera.updateProjectionMatrix();activeCamera.updateMatrixWorld(true);
    if(f.progress>=1)startWalk(f.arrival);
  }
  function cancelFlight(){if(mode!=='approach')return;flight=null;showOverview(false);}
  function zoom(value){if(mode!=='overview')return;const n=Number(value);if(!Number.isFinite(n))return;orbit.span=clamp(orbit.span*Math.exp(n*.14),150,760);fitCamera();markDirty();}
  function quality(value){
    if(!['low','balanced','high'].includes(value))return;
    const control=$('quality');control.value=value;control.dispatchEvent(new Event('change'));
    api.state.haizDirty=false;publish();markDirty();
  }
  function pick(x,y){
    if(mode!=='overview')return;
    const r=api.renderer.domElement.getBoundingClientRect();const pointer=new THREE.Vector2((x-r.left)/r.width*2-1,-((y-r.top)/r.height)*2+1);
    const ray=new THREE.Raycaster();ray.setFromCamera(pointer,activeCamera);
    const roots=api.world.buildings.map(b=>b.group),hits=ray.intersectObjects(roots,true);
    for(const hit of hits){const b=api.world.buildings.find(b=>{let n=hit.object;while(n){if(n===b.group)return true;n=n.parent;}return false;});if(b){choose(b.data.id);break;}}
  }
  function bindCanvas(){
    const canvas=api.renderer.domElement;
    canvas.addEventListener('pointerdown',e=>{
      if(mode!=='overview')return;
      e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);
      const ps=[...pointers.values()];gesture=ps.length===1?{startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false}:{distance:Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y),moved:true};
    },{passive:false});
    canvas.addEventListener('pointermove',e=>{
      if(mode!=='overview'||!pointers.has(e.pointerId)||!gesture)return;
      e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const ps=[...pointers.values()];
      if(ps.length>1){const distance=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y);if(gesture.distance>1)orbit.span=clamp(orbit.span*gesture.distance/Math.max(1,distance),150,760);gesture.distance=distance;gesture.moved=true;}
      else{const dx=e.clientX-(gesture.lastX??e.clientX),dy=e.clientY-(gesture.lastY??e.clientY);if(Math.hypot(e.clientX-gesture.startX,e.clientY-gesture.startY)>5)gesture.moved=true;orbit.azimuth-=dx*.005;orbit.polar=clamp(orbit.polar+dy*.003,.12,1.23);gesture.lastX=e.clientX;gesture.lastY=e.clientY;}
      fitCamera();markDirty();
    },{passive:false});
    function end(e){if(mode!=='overview')return;const click=gesture&&!gesture.moved&&pointers.size===1;pointers.delete(e.pointerId);if(click)pick(e.clientX,e.clientY);gesture=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}
    canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);gesture=null;});
    canvas.addEventListener('wheel',e=>{if(mode!=='overview')return;e.preventDefault();zoom(clamp(e.deltaY/100,-2,2));},{passive:false});
    canvas.addEventListener('webglcontextlost',()=>post('haiz-atlas:error',{text:'浏览器暂时回收了图形资源。请重试，或选择轻量画面。'}));
    document.addEventListener('keydown',e=>{
      if(e.target.closest('input,select,textarea,dialog'))return;
      if(e.key==='Escape'&&mode==='approach'){e.preventDefault();e.stopImmediatePropagation();cancelFlight();}
      else if(e.key==='Escape'&&mode==='walk'){e.preventDefault();e.stopImmediatePropagation();if(api.state.paused){api.resume(false);canvas.focus({preventScroll:true});}else api.pause(null);publish();}
      else if(mode==='overview'&&['+','=','-'].includes(e.key)){e.preventDefault();zoom(e.key==='-'?1:-1);}
    },true);
  }
  function resize(){if(!api)return;if(mode==='walk'){api.state.haizDirty=true;requestAnimationFrame(()=>{if(!disposed)api.renderer.render(api.scene,api.camera);});}fitCamera();if(flightCamera){flightCamera.aspect=innerWidth/innerHeight;flightCamera.updateProjectionMatrix();}markDirty();publish();}
  function attach(value){
    api=value;const params=new URLSearchParams(location.search),requested=params.get('focus');if(validId(requested))selected=requested;
    if(views.includes(params.get('view')))view=params.get('view');
    for(const b of api.world.buildings){
      const box=new THREE.Box3().setFromObject(b.group),r=b.data.rect;
      box.expandByPoint(new THREE.Vector3((r[0]-900)*.167,0,-(r[1]-784)*.167));
      box.expandByPoint(new THREE.Vector3((r[2]-900)*.167,0,-(r[3]-784)*.167));
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])cameraPoints.push(new THREE.Vector3(x,y,z));
    }
    captureLighting();calibratePhotoMaterials();
    api.state.started=true;api.state.bob=false;document.body.classList.add('started','atlas-bridge');
    $('intro').classList.add('leaving');$('intro').hidden=true;
    // Focus can move from the embedded walk to the parent's controls. Keep the
    // retained engine paused, but let the parent present its own pause controls.
    const pauseDialog=$('pauseDialog');
    new MutationObserver(()=>{if(pauseDialog.open){pauseDialog.close();publish();}}).observe(pauseDialog,{attributes:true,attributeFilter:['open']});
    sourceFog=api.scene.fog;
    const render=api.renderer.render.bind(api.renderer);
    // Legacy resize and pause events may request a draw outside the companion loop.
    api.renderer.render=(scene,camera)=>{
      if(mode==='walk'||!activeCamera)return render(scene,camera);
      const fog=scene.fog;if(!api.v3)scene.fog=null;observationLighting();
      try{return render(scene,activeCamera);}finally{scene.fog=fog;}
    };
    orbitCamera=new THREE.OrthographicCamera(-320,320,240,-240,.1,1600);
    spatialCamera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,2400);
    bindCanvas();showOverview();
    quality(coarse?'low':api.state.quality);
    // Rendering remains event-driven in overview. Walk state notifications are
    // bounded and do not create an additional GPU render loop.
    const watch=setInterval(()=>{
      if(disposed||document.hidden||!api)return;
      if(mode==='walk'){const now=performance.now();if(now-lastWalkPublish>240){lastWalkPublish=now;publish();}}
      const error=$('errorPanel');if(error&&!error.hidden)post('haiz-atlas:error',{text:$('errorText').textContent||'校园载入遇到了问题。'});
    },300);
    window.addEventListener('pagehide',()=>{disposed=true;clearInterval(watch);if(raf)cancelAnimationFrame(raf);removeHighlight();for(const m of photoMaterials)m.dispose();photoMaterials.clear();},{once:true});
  }
  window.addEventListener('message',e=>{
    if(e.source!==parent||e.origin!==origin||e.data?.type!=='haiz-atlas:command')return;
    const {action,id,value}=e.data;
    if(action==='reduced'){reduced=!!value;if(reduced&&flight)startWalk();publish();return;}
    if(action==='theme'){if(['porcelain','obsidian','ocean'].includes(value)){theme=value;document.documentElement.dataset.theme=value;if(api){updateHighlight();markDirty();}}return;}
    if(!api)return;
    if(action==='view')changeView(value);
    else if(action==='select')choose(id);
    else if(action==='approach'){if(validId(id))choose(id);approach();}
    else if(action==='walk'){if(validId(id))choose(id);startWalk();}
    else if(action==='overview')showOverview();
    else if(action==='cancel')cancelFlight();
    else if(action==='skip'&&flight)startWalk();
    else if(action==='zoom')zoom(value);
    else if(action==='quality')quality(value);
    else if(action==='time'&&api.v3&&['morning','golden','dusk'].includes(value)){api.v3.setTime(value,reduced);lastV3Frame=0;api.state.haizDirty=true;publish();markDirty();}
    else if(action==='pause'&&mode==='walk'){api.pause(null);publish();}
    else if(action==='resume'&&mode==='walk'){api.resume(false);api.renderer.domElement.focus({preventScroll:true});publish();}
  });
  window.addEventListener('resize',resize);
  media.addEventListener?.('change',e=>{reduced=e.matches;if(reduced&&flight)startWalk();publish();});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){hiddenAt=performance.now();if(raf){cancelAnimationFrame(raf);raf=0;}if(api&&mode==='walk')api.pause(null);}
    else{if(flight&&hiddenAt)flight.started+=performance.now()-hiddenAt;hiddenAt=0;markDirty();publish();}
  });
  const readyTimer=setInterval(()=>{
    if(window.haizWalk){clearInterval(readyTimer);attach(window.haizWalk);return;}
    const text=$('loadStatus')?.textContent||'读取校园空间…';const width=parseFloat($('loadBar')?.style.width)||0;
    if(text!==lastLoad){lastLoad=text;post('haiz-atlas:loading',{text,progress:width/100});}
    if($('errorPanel')&&!$('errorPanel').hidden){clearInterval(readyTimer);post('haiz-atlas:error',{text:$('errorText').textContent||'校园载入遇到了问题。'});}
    else if(++loadAttempts>600){clearInterval(readyTimer);post('haiz-atlas:error',{text:'校园准备时间较长，请重试或使用轻量画面。'});}
  },100);
})();

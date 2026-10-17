(function(){'use strict';
  const $=id=>document.getElementById(id),M=window.CampusMotion;
  const touch=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>1;
  const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const state={started:false,paused:true,yaw:Math.PI,pitch:.04,walked:0,input:{x:0,y:0,run:false},pos:{x:13,z:-172},quality:'auto',sensitivity:1,bob:false,frames:0,fps:60};
  const keys=new Set(),dialogs=['pauseDialog','mapDialog','poiDialog','aboutDialog'];
  let renderer,scene,camera,sun,hemiLight,ambientLight,world,data,nearest=null,last=0,frame=0,toastTimer,drag=null,lookTouch=null,joyPointer=null;
  let active=true,contextLost=false,shadowCenter={x:Infinity,z:Infinity},adaptTime=0,adaptFrames=0,pixelRatio=1,shadowEnabled=true;
  const destinations=[{id:'beimen',label:'北门',tag:'01'},{id:'fengqitang',label:'凤栖堂',tag:'02'},{id:'yanlintang',label:'衍林堂',tag:'03'},{id:'lanshu',label:'百年榄仁树',tag:'04'},{id:'yihao',label:'一号教学楼',tag:'05'},{id:'library',label:'图书馆',tag:'06'},{id:'yanchi',label:'砚池',tag:'07'},{id:'yundong',label:'操场',tag:'08'},{id:'nanmen',label:'南门',tag:'09'}];
  function status(p,msg){$('loadBar').style.width=Math.round(p*100)+'%';$('loadStatus').textContent=msg;}
  function toast(msg){$('toast').textContent=msg;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3600);}
  function error(title,msg){$('errorTitle').textContent=title;$('errorText').textContent=msg;$('errorPanel').hidden=false;$('enterButton').disabled=true;}
  function clearInput(){keys.clear();state.input={x:0,y:0,run:false};joyPointer=null;drag=null;lookTouch=null;$('stick').style.transform='';$('runButton').setAttribute('aria-pressed','false');}
  function pause(name='pauseDialog'){
    if(!state.started)return;state.paused=true;clearInput();
    if(document.pointerLockElement)document.exitPointerLock();
    for(const id of dialogs)if($(id).open)$(id).close();
    if(name)$(name).showModal();
  }
  function resume(lock=true){
    for(const id of dialogs)if($(id).open)$(id).close();
    if(contextLost)return;
    state.paused=false;clearInput();last=performance.now();
    if(!touch&&lock){
      try{const promise=renderer.domElement.requestPointerLock?.();if(promise?.catch)promise.catch(()=>toast('按住场景拖动也可以环顾。'));}
      catch(e){toast('按住场景拖动环顾。');}
    }
  }
  function applyLook(dx,dy,isTouch=false){const v=M.look(state.yaw,state.pitch,dx,dy,state.sensitivity,isTouch);state.yaw=v.yaw;state.pitch=v.pitch;}
  function canvasEvents(canvas){
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('pointerdown',e=>{
      if(!state.started||state.paused)return;
      if(e.pointerType==='touch'){
        if(e.clientX<innerWidth*.4)return;
        if(lookTouch!==null)return;
        lookTouch=e.pointerId;drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);
      }else{
        if(document.pointerLockElement!==canvas){drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}
      }
    });
    canvas.addEventListener('pointermove',e=>{
      if(state.paused)return;
      if(document.pointerLockElement===canvas&&e.pointerType!=='touch')return;
      if(!drag||(e.pointerType==='touch'&&lookTouch!==e.pointerId))return;
      applyLook(e.clientX-drag.x,e.clientY-drag.y,e.pointerType==='touch');drag={x:e.clientX,y:e.clientY};
    });
    function end(e){if(e.pointerType==='touch'&&lookTouch!==e.pointerId)return;lookTouch=null;drag=null;}
    canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
    document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas&&!state.paused)applyLook(e.movementX,e.movementY);});
    document.addEventListener('pointerlockchange',()=>{
      if(!document.pointerLockElement&&state.started&&!state.paused&&!touch)pause();
    });
    document.addEventListener('pointerlockerror',()=>{if(state.started&&!state.paused)toast('按住场景拖动即可控制视角。');});
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;pause(null);error('画面暂时中断','浏览器回收了图形资源。请重新加载，选择轻量画面后继续探索。');});
    canvas.addEventListener('webglcontextrestored',()=>location.reload());
  }
  function bindControls(){
    $('enterButton').addEventListener('click',()=>{
      if(!world||state.started)return;state.started=true;document.body.classList.add('started');$('intro').classList.add('leaving');$('hud').hidden=false;$('touchControls').hidden=!touch;
      const focus=new URLSearchParams(location.search).get('focus');if(focus==='classroom')goToClassroom();else goTo(focus||'beimen',false);resume();
      if(touch)toast('左摇杆行走，右半屏滑动环顾。');
    });
    $('classroomButton').onclick=()=>{goToClassroom();resume();};
    $('resumeButton').onclick=()=>resume();$('pauseButton').onclick=()=>pause();
    $('mapButton').onclick=$('miniMapButton').onclick=()=>{pause('mapDialog');drawMaps();};
    $('resetButton').onclick=()=>{goTo('beimen');resume();};
    $('aboutButton').onclick=()=>pause('aboutDialog');
    $('poiContinue').onclick=()=>resume();
    $('inspectButton').onclick=()=>inspect();
    document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>resume()));
    dialogs.forEach(id=>{
      $(id).addEventListener('cancel',e=>{e.preventDefault();resume(false);});
      $(id).addEventListener('click',e=>{if(e.target===$(id)){const r=$(id).getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)resume(false);}});
    });
    window.addEventListener('keydown',e=>{
      if(!state.started)return;
      const k=e.key.toLowerCase();
      if(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright',' ','shift'].includes(k)&&!state.paused){e.preventDefault();keys.add(k);}
      if(e.repeat)return;
      if(k==='m'){e.preventDefault();if($('mapDialog').open)resume();else{pause('mapDialog');drawMaps();}}
      if(k==='e'&&!state.paused){e.preventDefault();inspect();}
      if(k==='escape'&&!dialogs.some(id=>$(id).open)){e.preventDefault();pause();}
    });
    window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur',()=>{clearInput();if(state.started&&!state.paused)pause();});
    document.addEventListener('visibilitychange',()=>{active=!document.hidden;if(!active){clearInput();if(state.started)pause();}else last=performance.now();});
    const joy=$('joystick');
    function moveJoy(e){const r=joy.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,v=M.joystick(dx,dy,40);state.input.x=v.x;state.input.y=v.y;$('stick').style.transform=`translate(${v.x*36}px,${-v.y*36}px)`;}
    joy.addEventListener('pointerdown',e=>{if(state.paused||joyPointer!==null)return;e.preventDefault();joyPointer=e.pointerId;joy.setPointerCapture(e.pointerId);moveJoy(e);});
    joy.addEventListener('pointermove',e=>{if(e.pointerId===joyPointer){e.preventDefault();moveJoy(e);}});
    function endJoy(e){if(e.pointerId!==joyPointer)return;joyPointer=null;state.input.x=state.input.y=0;$('stick').style.transform='';}
    joy.addEventListener('pointerup',endJoy);joy.addEventListener('pointercancel',endJoy);joy.addEventListener('lostpointercapture',endJoy);
    $('runButton').onclick=()=>{state.input.run=!state.input.run;$('runButton').setAttribute('aria-pressed',String(state.input.run));};
    $('sensitivity').oninput=e=>state.sensitivity=Number(e.target.value);
    $('bobToggle').onchange=e=>state.bob=e.target.checked;
    $('quality').onchange=e=>{state.quality=e.target.value;setQuality();toast('画面精度已调整。');};
    window.addEventListener('resize',resize);
  }
  function goTo(id,notify=true){
    const b=world.buildings.find(b=>b.data.id===id);if(!b)return;
    const c=b.center,form=b.data.form;
    let x=c.x,z=c.z+b.data.size[2]/2+9;
    if(form==='gate'){z=c.z+(id==='beimen'?-13:13);}
    if(form==='garden'){x=c.x-b.data.size[0]*.38;z=c.z-b.data.size[2]*.35;}
    if(form==='oldtree'){x=c.x-10;z=c.z-8;}
    if(form==='field'){x=c.x;z=c.z;}
    const p=M.safePoint(x,z,world.colliders,world.bounds);
    if(!p){toast('附近暂时没有安全落点。');return false;}
    state.pos=p;state.yaw=Math.atan2(-(c.x-p.x),-(c.z-p.z));state.pitch=.045;clearInput();
    shadowCenter.x=Infinity;updateCamera(0);updateHud();drawMaps();
    if(notify)toast('已移步至'+b.data.name+'附近');return true;
  }
  function goToClassroom(buildingId='yihao'){
    const room=world.rooms.find(r=>r.buildingId===buildingId);if(!room)return;
    const p=M.safePoint(room.arrival.x,room.arrival.z,world.colliders,world.bounds);
    if(!p){toast('教室入口暂时不可达。');return false;}
    state.pos=p;state.yaw=Math.atan2(-(room.door.x-p.x),-(room.door.z-p.z));state.pitch=0;clearInput();shadowCenter.x=Infinity;
    updateCamera(0);updateHud();drawMaps();toast('已到'+room.name.replace(/ · .*/,'')+'首层，向前走进教室。');return true;
  }
  function inspect(){
    if(!nearest)return;const b=nearest.data,idx=destinations.findIndex(d=>d.id===b.id);
    $('poiName').textContent=b.name;$('poiEnglish').textContent=b.en||'Fucheng Campus';$('poiDescription').textContent=b.desc||'府城校区日常校园空间。';$('poiIndex').textContent=String(idx+1).padStart(2,'0');$('poiCategory').textContent=b.category+' / CAMPUS NOTES';$('poiEnterClassroom').hidden=b.form!=='academic';$('poiEnterClassroom').onclick=()=>{goToClassroom(b.id);resume();};pause('poiDialog');
  }
  function updateHud(){
    let best=Infinity,close=null;
    for(const d of destinations){const b=world.buildings.find(b=>b.data.id===d.id),dist=Math.hypot(state.pos.x-b.center.x,state.pos.z-b.center.z);if(dist<best){best=dist;close=b;}}
    nearest=close;
    const room=window.CampusInteriors.currentRoom(state.pos.x,state.pos.z);
    $('locationName').textContent=room?room.name:best<75?close.data.name+'附近':'校园校道';
    $('indoorStatus').hidden=!room;if(room)$('indoorName').textContent=room.name;
    $('distanceWalked').textContent=Math.floor(state.walked);$('motionState').textContent=(state.input.run||keys.has('shift'))?'快步行走':'自由漫游';
    $('inspectButton').hidden=best>65||!!room;$('inspectName').textContent=close.data.name;$('inspectDistance').textContent=Math.round(best)+' m';
  }
  function mapPoint(x,z,size,pad){const w=620,d=580,scale=(size-2*pad)/Math.max(w,d);return {x:size/2+x*scale,y:size/2-z*scale,s:scale};}
  function drawMap(canvas,large){
    if(!world)return;const ctx=canvas.getContext('2d'),s=canvas.width,pad=large?40:12;
    ctx.fillStyle='#eeeadc';ctx.fillRect(0,0,s,s);
    ctx.strokeStyle='#203f350c';ctx.lineWidth=1;
    for(let i=0;i<s;i+=s/10){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,s);ctx.moveTo(0,i);ctx.lineTo(s,i);ctx.stroke();}
    function rect(r,color){const c=world.rectWorld(r),p=mapPoint(c.x,c.z,s,pad);ctx.fillStyle=color;ctx.fillRect(p.x-c.w*p.s/2,p.y-c.d*p.s/2,c.w*p.s,c.d*p.s);}
    (data.lawns||[]).forEach(l=>rect(l.rect,'#d0d8bc'));
    (data.roads||[]).forEach(r=>{
      ctx.fillStyle='#dedbcf';if(r.poly){ctx.beginPath();r.poly.forEach((v,i)=>{const p=mapPoint(v[0],v[1],s,pad);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.closePath();ctx.fill();}else rect(r.rect,'#dedbcf');
    });
    for(const b of world.buildings){let color='#b0b9a4';if(b.data.form==='pond')color='#8eafa5';else if(b.data.form==='field')color='#bb866e';else if(['garden','oldtree','botanic'].includes(b.data.form))color='#a8b791';else if(b.data.form==='gate')color='#a87852';rect(b.data.rect,color);}
    if(large){
      ctx.font='16px sans-serif';ctx.textAlign='center';
      for(const d of destinations){const b=world.buildings.find(b=>b.data.id===d.id),p=mapPoint(b.center.x,b.center.z,s,pad);ctx.fillStyle='#f5f1e5';ctx.beginPath();ctx.arc(p.x,p.y,13,0,Math.PI*2);ctx.fill();ctx.fillStyle='#8e4a32';ctx.fillText(d.tag,p.x,p.y+6);}
    }
    const p=mapPoint(state.pos.x,state.pos.z,s,pad),angle=state.yaw;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);
    ctx.fillStyle='#a6533630';ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,large?38:26,Math.PI*.22,Math.PI*.78);ctx.closePath();ctx.fill();
    ctx.fillStyle='#a65336';ctx.strokeStyle='#f5f1e5';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,large?8:6,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
    ctx.fillStyle='#64715b';ctx.font=(large?'14':'17')+'px serif';ctx.textAlign='left';ctx.fillText('南',pad,pad+15);ctx.fillText('北',pad,s-pad-5);
    if(large){ctx.fillStyle='#8d947f';ctx.fillRect(s-160,s-45,80,2);ctx.font='13px sans-serif';ctx.fillText('约 50 m',s-160,s-55);}
  }
  function drawMaps(){drawMap($('miniMap'),false);if($('mapDialog').open)drawMap($('largeMap'),true);}
  function buildDestinations(){
    const list=$('destinationList');for(const d of destinations){const button=document.createElement('button');button.innerHTML='<span><b>'+d.tag+'</b>'+d.label+'</span><small>移步 ↗</small>';button.onclick=()=>{goTo(d.id);resume();};list.appendChild(button);}
    const roomButton=document.createElement('button');roomButton.innerHTML='<span><b>10</b>开放教室 · 一号楼</span><small>进入 ↗</small>';roomButton.onclick=()=>{goToClassroom();resume();};list.appendChild(roomButton);
  }
  function setQuality(){
    const q=state.quality==='auto'?(touch?'balanced':navigator.hardwareConcurrency<=4?'balanced':'high'):state.quality;
    pixelRatio=Math.min(devicePixelRatio||1,q==='high'?1.65:q==='balanced'?1.2:1);
    renderer.setPixelRatio(pixelRatio);renderer.setSize(innerWidth,innerHeight);
    shadowEnabled=q!=='low';renderer.shadowMap.enabled=shadowEnabled;sun.castShadow=shadowEnabled;
    sun.shadow.mapSize.set(q==='high'?2048:1024,q==='high'?2048:1024);
    if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}
    renderer.shadowMap.needsUpdate=true;
    state.effectiveQuality=q;
    $('quality').value=state.quality;
  }
  function resize(){if(!renderer||!camera)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);drawMaps();}
  function updateCamera(t){
    let y=1.72+.13;
    if(state.bob&&!reduced&&!state.paused&&(Math.hypot(state.input.x,state.input.y)>0||keys.size))y+=Math.sin(state.walked*4)*.024;
    camera.position.set(state.pos.x,y,state.pos.z);camera.rotation.order='YXZ';camera.rotation.set(state.pitch,state.yaw,0);
    // A compact shadow map follows the player, retaining tree and facade detail at eye level.
    if(Math.hypot(state.pos.x-shadowCenter.x,state.pos.z-shadowCenter.z)>9){
      shadowCenter={x:Math.round(state.pos.x/10)*10,z:Math.round(state.pos.z/10)*10};
      sun.position.set(shadowCenter.x-85,110,shadowCenter.z-65);sun.target.position.set(shadowCenter.x,0,shadowCenter.z);sun.target.updateMatrixWorld();
    }
  }
  function animate(now){
    frame=requestAnimationFrame(animate);if(!active||contextLost)return;
    const dt=Math.min((now-last)/1000||0,.1);last=now;
    if(!state.paused){
      const keyboardX=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
      const keyboardY=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0);
      const input={x:state.input.x+keyboardX,y:state.input.y+keyboardY,run:state.input.run||keys.has('shift'),speedScale:window.CampusInteriors.currentRoom(state.pos.x,state.pos.z) ? .72 : 1};
      state.walked+=M.step(state.pos,input,state.yaw,dt,world.colliders,world.bounds);updateCamera(now/1000);
      if(state.frames%10===0){updateHud();drawMaps();}
    }
    window.CampusInteriors.tick(state.pos.x,state.pos.z,state.paused?0:dt,reduced);
    const indoors=!!window.CampusInteriors.currentRoom(state.pos.x,state.pos.z);renderer.toneMappingExposure+=((indoors?1.28:1.08)-renderer.toneMappingExposure)*Math.min(1,dt*2);
    if(state.frames%24===0){
      // Tile visibility is distance based, mirroring open-world chunk culling.
      for(const tile of world.vegetationTiles)tile.group.visible=Math.hypot(tile.x-state.pos.x,tile.z-state.pos.z)<260;
    }
    if(state.frames%3===0||!state.paused)renderer.render(scene,camera);
    state.frames++;adaptTime+=dt;adaptFrames++;
    if(adaptTime>4){
      state.fps=adaptFrames/adaptTime;
      if(state.quality==='auto'&&state.fps<28&&state.started&&!state.paused&&pixelRatio>.85){pixelRatio=Math.max(.85,pixelRatio-.2);renderer.setPixelRatio(pixelRatio);renderer.setSize(innerWidth,innerHeight);}
      adaptFrames=0;adaptTime=0;
    }
  }
  async function loadEnvironment(){
    if(!THREE.RGBELoader||!renderer.capabilities)return;
    await new Promise(resolve=>{
      let settled=false;const timer=setTimeout(()=>done(),10000);
      function done(){if(settled)return;settled=true;clearTimeout(timer);resolve();}
      new THREE.RGBELoader().setDataType(THREE.UnsignedByteType).load('assets/walk/textures/campus-light.hdr',texture=>{
        if(settled){texture.dispose();return;}
        try{texture.mapping=THREE.EquirectangularReflectionMapping;const generator=new THREE.PMREMGenerator(renderer);scene.environment=generator.fromEquirectangular(texture).texture;generator.dispose();texture.dispose();state.environment='HDR';}catch(e){state.environment='daylight';}done();
      },undefined,done);
    });
  }
  async function boot(){
    document.body.classList.toggle('touch',touch);
    $('deviceHint').textContent=touch?'左摇杆行走 · 右侧滑动环顾':'W A S D 行走 · 鼠标环顾';
    $('pauseHelp').textContent=touch?'左摇杆控制行走，右半屏滑动环顾。':'点击继续，鼠标即可控制视角。Esc 随时释放鼠标。';
    bindControls();
    if(!window.THREE||!M||!window.CampusWorld||!window.CampusInteriors)throw new Error('校园程序加载不完整，请刷新页面重试。');
    status(.08,'读取已有校园空间…');
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),15000);
    let response;try{response=await fetch('assets/walk/campus.json',{signal:abort.signal});}finally{clearTimeout(timer);}
    if(!response.ok)throw new Error('校园空间数据暂时不可用（'+response.status+'）。');
    data=await response.json();if(!data.buildings?.length)throw new Error('校园数据缺少建筑。');
    scene=new THREE.Scene();scene.background=new THREE.Color('#c5d8d5');scene.fog=new THREE.Fog('#d0d8c7',160,520);
    const sky=new THREE.Mesh(new THREE.SphereGeometry(600,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color('#8bb9c5')},bottom:{value:new THREE.Color('#e3dfcc')}},vertexShader:'varying vec3 vPosition;void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform vec3 top;uniform vec3 bottom;varying vec3 vPosition;void main(){float h=clamp(normalize(vPosition).y,0.0,1.0);gl_FragColor=vec4(mix(bottom,top,pow(h,0.55)),1.0);}'}));sky.renderOrder=-10;scene.add(sky);
    camera=new THREE.PerspectiveCamera(touch?73:68,innerWidth/innerHeight,.08,850);
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch(e){error('此设备暂未开启 3D 显示','校园漫游需要 WebGL。请开启浏览器硬件加速，或换用支持 WebGL 的浏览器。');return;}
    renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','校园场景：WASD 行走，鼠标环顾，Esc 暂停');$('viewport').appendChild(renderer.domElement);
    hemiLight=new THREE.HemisphereLight('#d8e8ee','#8b8a70',.82);scene.add(hemiLight);ambientLight=new THREE.AmbientLight('#fff3da',.28);scene.add(ambientLight);
    sun=new THREE.DirectionalLight('#fff0d5',1.7);sun.position.set(-85,110,-65);scene.add(sun);scene.add(sun.target);
    const sc=sun.shadow.camera;sc.left=sc.bottom=-68;sc.right=sc.top=68;sc.near=1;sc.far=300;sc.updateProjectionMatrix();sun.shadow.bias=-.0003;sun.shadow.normalBias=.05;
    setQuality();canvasEvents(renderer.domElement);
    status(.12,'加载扫描材质…');
    const environmentReady=loadEnvironment();
    const pbr=await window.CampusInteriors.loadMaterials(p=>status(.12+p*.09,'加载草地、铺装、树叶与室内材质…'));
    await environmentReady;
    status(.22,'重建校道与开放教室…');
    world=await window.CampusWorld.build(scene,data,state.effectiveQuality,status,pbr);
    scene.traverse(o=>{if(o.isMesh&&o.material&&!Array.isArray(o.material)&&'envMapIntensity'in o.material)o.material.envMapIntensity=.65;});
    status(.94,'校准视角与安全落点…');
    buildDestinations();goTo('beimen',false);updateCamera(0);drawMaps();renderer.render(scene,camera);
    status(1,touch?'校园已就绪 · 左摇杆行走，右半屏环顾':'校园已就绪 · WASD 行走，鼠标环顾');$('enterText').textContent='开始漫游';$('enterButton').disabled=false;
    last=performance.now();frame=requestAnimationFrame(animate);
    window.haizWalk={state,world,scene,camera,renderer,goTo,goToClassroom,pause,resume,diagnostics:()=>({nodes:world.buildings.length,classrooms:world.rooms.length,environment:state.environment||'daylight',trees:world.treeCount,colliders:world.colliders.length,quality:state.effectiveQuality,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,fps:Math.round(state.fps),loaded:true,position:{...state.pos}})};
    if(new URLSearchParams(location.search).get('enter')==='gate'){
      state.started=true;document.body.classList.add('started');$('intro').classList.add('leaving');$('hud').hidden=false;$('touchControls').hidden=!touch;goTo('beimen',false);resume(false);toast(touch?'抵达北门。左摇杆行走，右侧滑动环顾。':'抵达北门。WASD 行走，按住场景拖动环顾。');
    }
  }
  boot().catch(err=>{console.error('Campus initialization failed',err);error('校园加载遇到了问题',err.message||'请重新加载再试。');status(0,'加载未完成');});
})();

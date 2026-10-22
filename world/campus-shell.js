// HAIZ shell around the retained campus engine. Original engine files stay intact.
(()=>{'use strict';
 const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
 const appRoot=new URL(document.querySelector('meta[name="haiz-root"]').content,document.baseURI);
 document.querySelector('.wordmark').href=new URL('#world',appRoot).href;
 document.querySelector('.wordmark').target='_top';
 document.body.classList.add('haiz-campus');
 let attempts=0;
 const ready=setInterval(()=>{if(window.haizWalk){clearInterval(ready);attach(window.haizWalk)}else if(++attempts>900)clearInterval(ready)},100);
 function attach(api){
  const nodes=api.world.buildings.map((b,i)=>({id:b.data.id,name:b.data.name,form:b.data.form,index:i+1}));
  const category=n=>['academic','lab','library'].includes(n.form)?'学习':['field'].includes(n.form)?'运动':['garden','pavilion','oldtree','pond','botanic','rock'].includes(n.form)?'风景':['living','canteen','office','art'].includes(n.form)?'生活':'校道';
  api.renderer.domElement.tabIndex=0;
  const controls=document.createElement('nav');controls.className='campus-view-switch';controls.setAttribute('aria-label','漫游视角');controls.innerHTML='<button id="haiz-first" aria-pressed="true">开始行走 <span>第一人称 · WASD</span></button><button id="haiz-overview" aria-pressed="false">俯瞰校园 <span>拖动 / 缩放</span></button><button id="haiz-atlas">全部地点 <span>34</span></button>';
  document.body.append(controls);
  let overview=false,angle=0,height=360,drag=null,query='',group='全部';
  function viewUI(){document.body.classList.toggle('haiz-overview',overview);$('haiz-first').setAttribute('aria-pressed',String(!overview));$('haiz-overview').setAttribute('aria-pressed',String(overview));}
  function birdCamera(){if(!overview)return;api.camera.fov=55;api.camera.position.set(Math.sin(angle)*height*.55,height,Math.cos(angle)*height*.55-10);api.camera.lookAt(0,0,-10);api.camera.updateProjectionMatrix();api.renderer.render(api.scene,api.camera)}
  function first(){overview=false;viewUI();api.state.photoFov=null;api.resume(false);api.renderer.domElement.focus({preventScroll:true})}
  $('haiz-first').onclick=first;
  $('haiz-overview').onclick=()=>{api.stopTour();api.pause(null);overview=true;viewUI();birdCamera()};
  $('haiz-atlas').onclick=()=>{api.pause('mapDialog');renderList();api.map.draw($('largeMap'),true,api.state.pos,api.state.yaw)};
  api.renderer.domElement.addEventListener('pointerdown',e=>{if(overview){drag={x:e.clientX,y:e.clientY};api.renderer.domElement.setPointerCapture(e.pointerId)}});
  api.renderer.domElement.addEventListener('pointermove',e=>{if(overview&&drag){angle-=(e.clientX-drag.x)*.008;height=Math.max(170,Math.min(560,height+(e.clientY-drag.y)*.7));drag={x:e.clientX,y:e.clientY};birdCamera()}});
  for(const event of ['pointerup','pointercancel'])api.renderer.domElement.addEventListener(event,()=>drag=null);
  api.renderer.domElement.addEventListener('wheel',e=>{if(overview){e.preventDefault();height=Math.max(170,Math.min(560,height+e.deltaY*.25));birdCamera()}},{passive:false});
  // Retained dialogs may resume the engine; reflect the actual camera mode.
  document.addEventListener('input',()=>{api.state.haizDirty=true});
  $('resumeButton').addEventListener('click',()=>{overview=false;viewUI()});
  const watch=setInterval(()=>{if(overview&&!api.state.paused){overview=false;viewUI()}},250);
  window.addEventListener('pagehide',()=>{clearInterval(watch);clearInterval(ready)},{once:true});
  const aside=document.querySelector('.map-destinations');
  aside.querySelector('.muted').textContent='34 个节点全部开放查找。移步到室外安全落点；教学楼可进入首层。';
  const search=document.createElement('label');search.className='campus-search';search.innerHTML='查找地点<input id="campus-search" type="search" placeholder="教学楼、食堂、砚池…" autocomplete="off">';
  const filters=document.createElement('div');filters.className='campus-filters';filters.setAttribute('aria-label','地点分类');
  for(const name of ['全部','学习','风景','生活','运动','校道']){const b=document.createElement('button');b.textContent=name;b.dataset.category=name;b.setAttribute('aria-pressed',String(name===group));b.onclick=()=>{group=name;renderList()};filters.append(b)}
  aside.insertBefore(search,$('destinationList'));aside.insertBefore(filters,$('destinationList'));
  const count=document.createElement('p');count.id='campus-count';count.setAttribute('role','status');aside.insertBefore(count,$('destinationList'));
  $('campus-search').addEventListener('input',e=>{query=e.target.value.trim();renderList()});
  function travel(id,room=false){overview=false;viewUI();const ok=room?api.goToClassroom(id):api.goTo(id);if(ok===false)return;api.resume(false);api.renderer.domElement.focus({preventScroll:true});}
  function renderList(){
   const filtered=nodes.filter(n=>(group==='全部'||category(n)===group)&&(!query||n.name.includes(query)||n.id.includes(query.toLowerCase())));
   $('campus-count').textContent=`${filtered.length} / ${nodes.length} 个地点`;
   filters.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===group)));
   $('destinationList').replaceChildren();
   for(const n of filtered){const row=document.createElement('div');row.className='campus-destination';const b=document.createElement('button');b.dataset.destination=n.id;const index=document.createElement('b');index.textContent=String(n.index).padStart(2,'0');const name=document.createElement('span');name.textContent=n.name;const tag=document.createElement('small');tag.textContent=category(n)+' · 移步 ↗';b.append(index,name,tag);b.onclick=()=>travel(n.id);row.append(b);
    if(n.form==='academic'){const enter=document.createElement('button');enter.className='campus-room-entry';enter.dataset.room=n.id;enter.textContent='进入首层教室 ↗';enter.onclick=()=>travel(n.id,true);row.append(enter)}
    $('destinationList').append(row);
   }
   if(!filtered.length){const p=document.createElement('p');p.textContent='还没找到这个名字，试试其他关键词。';$('destinationList').append(p)}
  }
  renderList();
  const extra=document.createElement('div');extra.className='campus-room-links';extra.innerHTML='<h3>从课堂，走回自己的书桌。</h3><p>四栋教学楼 · 首层共 16 间想象教室。楼上与楼梯尚未开放。</p><a target="_top" href="'+new URL('#study',appRoot).href+'">去 HAIZ 自习室 ↗</a>';
  aside.append(extra);
  const originalFooter=document.querySelector('.location-paper p');originalFooter.innerHTML='<span id="distanceWalked">0</span> m <i></i><span id="motionState">自由漫游</span><small class="campus-distance-note">仅本次模型内步行 · 不上传</small>';
  const requested={feng:'fengqitang',tree:'lanshu',pond:'yanchi'}[params.get('place')]||params.get('place');
  if(nodes.some(n=>n.id===requested))api.goTo(requested,false);
  const quality=$('quality');quality.value=params.get('quality')==='low'?'low':'balanced';quality.dispatchEvent(new Event('change'));
  if(params.has('atlas'))$('haiz-atlas').click();
  document.body.dataset.campusReady='true';
  window.HaizCampus={nodes,travel,first,overview:()=>$('haiz-overview').click(),get mode(){return overview?'overview':'first'}};
 }
})();

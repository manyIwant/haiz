/* A side-by-side reference tool, never a photograph overlaid onto the 3D mesh. */
(()=>{'use strict';let api,previousFocus,wasRunning=false;
const records={fengqitang:{name:'凤栖堂',image:'assets/images/web/fengqitang-1600.jpg',detail:'叠檐曲面、瓦端、细柱、木格窗和栏板',limit:'屋顶与构件比例为照片推演；未复刻孔子像与完整园林。'},yihao:{name:'一号教学楼',image:'assets/images/campus/campus_yihao.jpg',detail:'浅红入口檐、深灰中央构件、窗洞与外墙深度',limit:'楼体保留原平面；层高、墙砖和中央构件仍非测绘复刻。'},erhao:{name:'二号教学楼',image:'assets/images/campus/campus_erhao.jpg',detail:'平屋面、连续外廊、楼板与细栏杆',limit:'不复制照片中的活动横幅与临时布置。'},library:{name:'图书馆',image:'assets/images/campus/campus_library.jpg',detail:'金属圆顶、弧形玻璃、大台阶与水平外廊',limit:'圆顶位置、楼梯与弧窗比例为近似；台阶为展示结构，不可攀爬。'}};
let selected='fengqitang';
records.yanchi={name:'砚池',image:'assets/images/campus/campus_yanchi.jpg',detail:'层叠石岸、题名石、羽状椰叶、阔叶植物与雨后水色',limit:'依据照片重建可辨认的构成；石形、书体、机位与种植位置仍为近似。'};
records.kexue={name:'科学馆',image:'assets/images/campus/campus_kexue.jpg',detail:'内退外廊、连续白色栏板、细柱、金属窗栏与滴水檐',limit:'保留原占地与层高；构件尺寸由照片推演，楼内布局未测绘。'};
records.yishu={name:'艺术中心',image:'assets/images/campus/campus_yishu.jpg',detail:'红瓦四坡屋顶、内退门厅、灰石阶与平台细栏杆，三层椰叶、羽状地被和小叶灌木',limit:'依据单张俯拍推演可见构件和植物层次，沿用原建筑与水体占地；门厅深度、树木位置、尺寸和背面仍需测绘。'};
const trigger=document.createElement('button');trigger.id='referenceToggle';trigger.className='reference-trigger';trigger.textContent='实拍对照 ↗';trigger.setAttribute('aria-haspopup','dialog');
const dialog=document.createElement('dialog');dialog.id='referenceDialog';dialog.className='reference-dialog';dialog.setAttribute('aria-labelledby','referenceTitle');
dialog.innerHTML='<div class="reference-top"><span>ARCHITECTURE / FIELD REFERENCE</span><button id="referenceClose" aria-label="关闭实拍对照">×</button></div><h2 id="referenceTitle">从照片，走进构造。</h2><div id="referencePlaces" class="reference-places" role="group" aria-label="选择对照建筑"></div><figure><img id="referencePhoto" alt=""><figcaption>项目已有实拍 / 拍摄年代与授权独立核验未完成</figcaption></figure><h3 id="referenceName"></h3><p id="referenceDetails"></p><small id="referenceLimit"></small><div class="reference-actions"><button id="referenceView">在模型中取景 ↗</button><a href="architecture.html">阅读建筑手册 ↗</a></div><p class="reference-credit">近景盆栽：Rico Cilliers / Poly Haven（CC0），Eric Chadwick / DGG（CC BY 4.0），经修改。属于创作性布置，非校园种植证据。<a href="assets/walk/models/NOTICE.md">来源与改动</a></p>';
document.body.append(trigger,dialog);const $=id=>document.getElementById(id);
const comparison=document.createElement('figure');comparison.className='reference-model';comparison.hidden=true;
comparison.innerHTML='<img id="referenceRender" alt="当前校园模型的实际渲染"><figcaption>模型取景 · 可进入场景继续调整角度</figcaption>';
$('referencePhoto').closest('figure').after(comparison);
const compare=document.createElement('button');compare.id='referenceCompare';compare.textContent='照片与模型并看';compare.type='button';
dialog.querySelector('.reference-actions').prepend(compare);
const comparisonStatus=document.createElement('p');comparisonStatus.className='reference-comparison-status';comparisonStatus.setAttribute('role','status');comparison.after(comparisonStatus);
function renderComparison(){
  api.goTo(selected,false);api.pause(null);
  api.renderer.toneMappingExposure=api.climate.tick(0,false,true);
  window.CampusLandscape?.tick(api.camera,api.state.effectiveQuality,api.climate.diagnostics.wet);
  api.reflections.tick(0,api.state.effectiveQuality,false,true);
  api.renderer.render(api.scene,api.camera);
  $('referenceRender').src=api.renderer.domElement.toDataURL('image/jpeg',.9);
  $('referenceRender').alt=records[selected].name+' · 当前模型实际取景';comparison.hidden=false;dialog.classList.add('comparing');
  comparisonStatus.textContent='对照轮廓、材质与光线；照片和模型的机位尚未标定。';
}
compare.onclick=()=>{try{renderComparison();}catch{comparisonStatus.textContent='暂未生成取景，请进入模型后重试。';}};
function show(id){comparison.hidden=true;dialog.classList.remove('comparing');comparisonStatus.textContent='';const restoreFocus=!!document.activeElement?.closest('#referencePlaces');selected=id;const r=records[id];$('referenceName').textContent=r.name;$('referencePhoto').src=r.image;$('referencePhoto').alt=r.name+' · 既有实拍';$('referenceDetails').textContent='本轮细化：'+r.detail;$('referenceLimit').textContent=r.limit;
  $('referencePlaces').replaceChildren(...Object.entries(records).map(([key,p])=>{const b=document.createElement('button');b.textContent=p.name;b.setAttribute('aria-pressed',String(key===selected));b.onclick=()=>show(key);return b;}));if(restoreFocus)$('referencePlaces').querySelector('[aria-pressed="true"]').focus({preventScroll:true});}
function open(){if(!api?.state.started||dialog.open)return;previousFocus=document.activeElement;wasRunning=!api.state.paused;api.pause(null);let best=Infinity;
  for(const id of Object.keys(records)){const b=api.world.buildings.find(b=>b.data.id===id),distance=Math.hypot(b.center.x-api.state.pos.x,b.center.z-api.state.pos.z);if(distance<best){best=distance;selected=id;}}show(selected);dialog.showModal();}
function close(){dialog.close();if(wasRunning)api.resume(false);else api.pause();previousFocus?.focus();}
trigger.onclick=open;$('referenceClose').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
$('referenceView').onclick=()=>{dialog.close();api.goTo(selected,false);api.restoreView({position:{...api.state.pos},yaw:api.state.yaw,pitch:api.state.pitch,lens:48,climate:api.climate.current});api.resume(false);};
window.CampusReview={attach(value){if(api)return;api=value;const button=document.createElement('button');button.id='referenceFromPause';button.className='solid-button';button.textContent='实拍对照 · 建筑细化 ↗';button.onclick=open;$('pauseDialog').append(button);},open,close,get selected(){return selected;}};
document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='r'&&!e.ctrlKey&&!e.metaKey&&!e.target.closest('input,textarea,select,dialog')&&api?.state.started&&!api.state.paused){e.preventDefault();open();}});
if(window.haizWalk)window.CampusReview.attach(window.haizWalk);
})();

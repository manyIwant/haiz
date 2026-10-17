/* A small camera studio, sharing the actual world rather than a second scene. */
(()=>{'use strict';
let api,photo=false,lastPlace='beimen';
const trigger=document.createElement('button');trigger.id='photoModeButton';trigger.className='workshop-trigger';trigger.innerHTML='<span aria-hidden="true">◎</span> 校园取景 <kbd>P</kbd>';
const studio=document.createElement('section');studio.id='photoStudio';studio.className='photo-studio';studio.hidden=true;studio.setAttribute('aria-label','校园摄影模式');
studio.innerHTML='<div><span class="studio-kicker">A POSTCARD FROM CAMPUS</span><h2>把此刻，寄给自己。</h2></div><div class="studio-controls"><label>镜头 <input id="photoLens" type="range" min="32" max="80" step="1" value="48"><span id="photoLensValue">48°</span></label><label>光照<select id="photoClimate"><option value="morning">晨光</option><option value="afterrain">雨后</option><option value="dusk">薄暮</option></select></label><button id="photoCapture">冲印明信片 ↓</button><button id="photoShare">复制此处入口 ↗</button><button id="photoExit">继续行走 ×</button></div><p id="photoStatus" role="status">拖动场景环顾，WASD 走动；照片不包含界面。</p>';
document.body.append(trigger,studio);
const $=id=>document.getElementById(id);
function visit(id){if(!api?.state.started)return;lastPlace=id;window.HaizExperience?.visit(id);}
function toggle(value=!photo){
  if(!api?.state.started)return;
  photo=value;document.body.classList.toggle('photo-mode',photo);studio.hidden=!photo;
  api.state.photoFov=photo?Number($('photoLens').value):null;$('photoClimate').value=api.climate.current;
  api.resume(false);$('photoStatus').textContent=photo?'拖动场景环顾，WASD 走动；照片不包含界面。':'';
}
function setClimate(){const value=$('photoClimate').value;const input=$('climate');input.value=value;input.dispatchEvent(new Event('change'));}
function capture(){
  if(!api)return;
  const status=$('photoStatus');status.textContent='正在冲印…';
  try{
    // Read directly after the draw: no preserved framebuffer or per-frame copy.
    api.camera.fov=Number($('photoLens').value);api.camera.updateProjectionMatrix();
    api.renderer.render(api.scene,api.camera);const source=api.renderer.domElement;
    const width=Math.min(1800,source.width),height=Math.round(width*source.height/source.width),border=Math.round(width*.032),footer=Math.round(width*.1);
    const card=document.createElement('canvas');card.width=width+border*2;card.height=height+border*2+footer;const c=card.getContext('2d');
    c.fillStyle='#eeecdf';c.fillRect(0,0,card.width,card.height);c.drawImage(source,border,border,width,height);
    const place=api.world.buildings.find(b=>b.data.id===lastPlace)?.data.name||'府城校区';
    c.fillStyle='#29483b';c.font=Math.round(width*.021)+'px serif';c.fillText(place+' · '+api.climate.presets[api.climate.current].name,border,height+border+footer*.47);
    c.font=Math.round(width*.009)+'px sans-serif';c.fillStyle='#7e886e';
    c.fillText('HAIZ.SPACE / 数字校园 · 创作模型',border,height+border+footer*.79);
    c.textAlign='right';c.fillText(new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'medium'}).format(new Date()),card.width-border,height+border+footer*.79);
    card.toBlob(blob=>{
      if(!blob){status.textContent='暂未生成图片，请重试。';return;}
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='haiz-postcard-'+lastPlace+'.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);status.textContent='明信片已生成，图片只下载到你的设备。';
    },'image/png');
  }catch(error){status.textContent='暂未能冲印：'+error.message;}
}
trigger.onclick=()=>toggle();$('photoExit').onclick=()=>toggle(false);$('photoCapture').onclick=capture;
$('photoLens').oninput=e=>{const value=Number(e.target.value);api.state.photoFov=value;$('photoLensValue').textContent=value+'°';};
$('photoClimate').onchange=setClimate;
$('photoShare').onclick=async()=>{
  const url=new URL('campus-3d.html',location.href);url.searchParams.set('focus',lastPlace);url.searchParams.set('climate',api.climate.current);url.searchParams.set('observe','1');
  try{await navigator.clipboard.writeText(url.href);$('photoStatus').textContent='已复制此处入口，可以分享给朋友。';}catch{$('photoStatus').textContent='此处入口：'+url.href;}
};
document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='p'&&!e.ctrlKey&&!e.metaKey&&!e.target.closest('input,textarea,select')&&api?.state.started&&!api.state.paused){e.preventDefault();toggle();}});
function attach(value){
  if(api)return;api=value;
  const button=document.createElement('button');button.className='solid-button';button.id='studioFromPause';button.textContent='校园摄影 · 冲印一张明信片 ↗';button.onclick=()=>toggle(true);$('pauseDialog').append(button);
}
window.CampusWorkshop={attach,visit,toggle,capture,get active(){return photo;}};
if(window.haizWalk)attach(window.haizWalk);
})();

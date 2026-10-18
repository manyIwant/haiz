/* Shared exploration desk. No network service, telemetry, or autoplay audio. */
(()=>{'use strict';
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const locations=[['beimen','北门','校门 gate'],['fengqitang','凤栖堂','绿瓦 历史 heritage'],['lanshu','百年榄仁树','树荫 tree'],['yihao','一号教学楼','教室 classroom'],['erhao','二号教学楼','外廊 corridor'],['library','图书馆','书 library'],['yanchi','砚池','池塘 水 pond'],['yundong','操场','运动 playground'],['nanmen','南门','gate'],['kexue','科学馆','实验 science']];
const pages=[['index.html','从星球到树荫','电影首页 地球 降落 home descent'],['journal.html','校园杂志','校园手记 新闻 社团 journal'],['architecture.html','建筑与材质实验室','实拍 材质 法线 material texture'],['memory-walk.html','树荫下的三次停留','轻量阅读 树 地点 route'],['news.html','新闻档案','报道 archive'],['clubs.html','社团提案','科学 影像 音乐 club'],['life.html','课间电台','故事 便笺 FM'],['about.html','学校与校园手图','地图 历史 map'],['alumni.html','校友','alumni'],['admissions.html','来访与招生','visit'],['contact.html','关于本站','来源 隐私 联系']];
const entries=[{href:'darkroom.html',title:'共感暗房',keywords:'互动 显影 照片 声景 编曲 明信片 音乐 接力 darkroom score postcard',kind:'创作'},{href:'director.html',title:'探索导演台',keywords:'路线 编排 机位 相机 取景 director camera journey',kind:'创作'},...pages.map(([href,title,keywords])=>({href,title,keywords,kind:'阅读'})),...locations.map(([id,title,keywords])=>({id,href:'campus-3d.html?focus='+id,title,keywords,kind:'漫游'}))];
const key='haiz.explore.passport.v1',valid=new Set(locations.map(p=>p[0]));
function read(){try{const a=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(a)?[...new Set(a.filter(id=>valid.has(id)))]:[];}catch{return [];}}
function clearPassport(){visited=[];try{localStorage.removeItem(key);}catch{}passport();}
let visited=read(),lastFocus=null,pausedWalk=false,chosen=0,results=[];
const dock=document.createElement('div');dock.id='experienceDock';dock.className='experience-dock';
dock.innerHTML='<button id="exploreOpen" aria-haspopup="dialog" aria-controls="exploreDialog"><span aria-hidden="true">✳</span> 探索 <kbd>⌘ K</kbd></button><button id="soundToggle" aria-pressed="false" aria-label="开启合成校园声景">声景 <span aria-hidden="true">◌</span></button>';
const dialog=document.createElement('dialog');dialog.id='exploreDialog';dialog.className='explore-dialog';dialog.setAttribute('aria-labelledby','exploreTitle');
dialog.innerHTML='<div class="explore-top"><span>THE EXPLORATION DESK</span><button id="exploreClose" aria-label="关闭探索">×</button></div><h2 id="exploreTitle">下一站，想去哪？</h2><label class="explore-search" for="exploreQuery"><span aria-hidden="true">⌕</span><input id="exploreQuery" type="search" autocomplete="off" placeholder="搜地点、材质、社团、新闻…" aria-controls="exploreResults"></label><p id="exploreCount" class="explore-count" role="status"></p><div id="exploreResults" class="explore-results" aria-label="搜索结果"></div><div class="explore-extra"><button id="exploreRandom">让好奇心带路 ↗</button><small>↑ ↓ 选择 · Enter 抵达 · Esc 关闭</small></div><section class="explore-passport"><div><h3>我的数字校园足迹</h3><small id="passportCount"></small></div><div id="passportStamps"></div><button id="passportClear" hidden>清空本机足迹</button><p>在数字校园抵达后留下记号，仅保存在当前浏览器。</p></section><section class="explore-sound"><label for="soundScene">给校园一点声音 <small>程序合成 · 非现场录音</small></label><div><select id="soundScene"><option value="shade">树下的风</option><option value="rain">雨后的檐下</option></select><button id="soundDesk" aria-pressed="false">开启声景</button><button id="bellButton">敲一声课铃 ♪</button></div><label class="sound-volume" for="soundVolume">音量 <input id="soundVolume" type="range" min="0" max="0.5" step="0.01" value="0.12"></label><p id="soundStatus" role="status">声音默认关闭。</p></section>';
document.body.append(dock,dialog);
const directorLink=document.createElement('a');directorLink.href='director.html';directorLink.textContent='编排我的路线 ↗';dialog.querySelector('.explore-extra').insertBefore(directorLink,dialog.querySelector('.explore-extra small'));
const $=id=>document.getElementById(id),q=$('exploreQuery');
q.setAttribute('role','combobox');q.setAttribute('aria-autocomplete','list');q.setAttribute('aria-expanded','false');$('exploreResults').setAttribute('role','listbox');
function node(tag,text){const n=document.createElement(tag);n.textContent=text;return n;}
function mark(id){if(!valid.has(id)||visited.includes(id))return;visited.push(id);try{localStorage.setItem(key,JSON.stringify(visited));}catch{}passport();}
function passport(){
  $('passportCount').textContent=visited.length+' / '+locations.length;
  $('passportStamps').replaceChildren(...locations.map(([id,title])=>{const a=node('a',(visited.includes(id)?'✓ ':'')+title);a.href='campus-3d.html?focus='+id;a.className=visited.includes(id)?'is-visited':'';return a;}));
  $('passportClear').hidden=!visited.length;
}
function selectResult(i){
  chosen=(i+results.length)%Math.max(1,results.length);
  $('exploreResults').querySelectorAll('a').forEach((a,j)=>{a.classList.toggle('is-selected',j===chosen);a.setAttribute('aria-selected',String(j===chosen));if(j===chosen){q.setAttribute('aria-activedescendant',a.id);a.scrollIntoView({block:'nearest'});}});
}
function search(){
  const terms=q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  results=entries.filter(e=>terms.every(t=>(e.title+' '+e.keywords).toLowerCase().includes(t)));
  q.removeAttribute('aria-activedescendant');
  $('exploreResults').replaceChildren(...results.map((e,i)=>{const a=document.createElement('a');a.href=e.href;a.id='exploreResult'+i;a.setAttribute('role','option');a.append(node('small',e.kind),node('span',e.title),node('b','↗'));a.addEventListener('pointerenter',()=>selectResult(i));return a;}));
  $('exploreCount').textContent=results.length?'找到 '+results.length+' 个去处':'没有找到这条线索，试试“绿瓦”“教室”或“材质”。';chosen=0;
  if(results.length)selectResult(0);
}
function open(){
  if(dialog.open)return;lastFocus=document.activeElement;
  const a=window.haizWalk;pausedWalk=!!(a?.state.started&&!a.state.paused);if(pausedWalk)a.pause(null);
  dialog.showModal();q.setAttribute('aria-expanded','true');q.value='';search();passport();q.focus();
}
function close(){dialog.close();q.setAttribute('aria-expanded','false');if(pausedWalk)window.haizWalk?.resume(false);pausedWalk=false;lastFocus?.focus();}
$('exploreOpen').onclick=open;$('exploreClose').onclick=close;q.oninput=search;
dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
q.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp','Enter'].includes(e.key)){e.preventDefault();if(e.key==='Enter'){if(results[chosen])location.href=results[chosen].href;}else selectResult(chosen+(e.key==='ArrowDown'?1:-1));}});
document.addEventListener('keydown',e=>{
  const typing=e.target.closest?.('input,textarea,select,[contenteditable="true"]');
  if((e.key.toLowerCase()==='k'&&(e.metaKey||e.ctrlKey))||(e.key==='/'&&!typing)){
    e.preventDefault();dialog.open?close():open();
  }
});
$('exploreRandom').onclick=()=>{const pool=entries.filter(e=>e.id&&!visited.includes(e.id)),choices=pool.length?pool:entries.filter(e=>e.id);location.href=choices[Math.floor(Math.random()*choices.length)].href;};
$('passportClear').onclick=clearPassport;
window.addEventListener('storage',e=>{if(e.key===key){visited=read();passport();}});
// WebAudio is created only in response to an explicit button activation.
let audio,master,noiseSource,noiseFilter,enabled=false,sceneName='shade',volume=.12;
function ensureAudio(){
  if(audio)return;
  const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw Error('此浏览器暂不支持声景。');
  audio=new Context();master=audio.createGain();master.gain.value=0;master.connect(audio.destination);
  const buffer=audio.createBuffer(1,audio.sampleRate*8,audio.sampleRate),samples=buffer.getChannelData(0);let seed=261017;
  for(let i=0;i<samples.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;samples[i]=(seed/4294967296-.5)*.25;}
  noiseSource=audio.createBufferSource();noiseSource.buffer=buffer;noiseSource.loop=true;noiseFilter=audio.createBiquadFilter();noiseSource.connect(noiseFilter);noiseFilter.connect(master);noiseSource.start();configureSound();
}
function configureSound(){if(!audio)return;noiseFilter.type=sceneName==='rain'?'highpass':'lowpass';noiseFilter.frequency.setTargetAtTime(sceneName==='rain'?650:420,audio.currentTime,.6);noiseFilter.Q.value=.4;}
function soundUI(message){for(const id of ['soundToggle','soundDesk'])$(id).setAttribute('aria-pressed',String(enabled));$('soundDesk').textContent=enabled?'关闭声景':'开启声景';$('soundStatus').textContent=message||((enabled?'正在播放：':'声音已关闭。')+(enabled?(sceneName==='rain'?'雨后的檐下':'树下的风'):''));}
async function setSound(value){
  if(!audio&&!value){enabled=false;soundUI();return;}
  try{ensureAudio();await audio.resume();enabled=value;master.gain.setTargetAtTime(enabled?volume:0,audio.currentTime,.25);soundUI();}
  catch(error){enabled=false;soundUI(error.message);}
}
$('soundToggle').onclick=$('soundDesk').onclick=()=>setSound(!enabled);
$('soundScene').onchange=e=>{sceneName=e.target.value;configureSound();soundUI();};
$('soundVolume').oninput=e=>{volume=Number(e.target.value);if(audio)master.gain.setTargetAtTime(enabled?volume:0,audio.currentTime,.1);};
$('bellButton').onclick=async()=>{
  try{ensureAudio();await audio.resume();const gain=audio.createGain();gain.gain.setValueAtTime(.0001,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.045,audio.currentTime+.015);gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+2.4);gain.connect(audio.destination);
    for(const [i,hz]of [659.25,830.61,987.77].entries()){const o=audio.createOscillator();o.type='sine';o.frequency.value=hz;const partial=audio.createGain();partial.gain.value=1/(i+1);o.connect(partial);partial.connect(gain);o.start();o.stop(audio.currentTime+2.5);}soundUI('一声合成课铃，留在这一刻。');
  }catch(e){soundUI(e.message);}
};
document.addEventListener('visibilitychange',()=>{if(!audio)return;if(document.hidden)audio.suspend();else if(enabled)audio.resume().catch(()=>{});});
if(!reduced&&!matchMedia('(pointer:coarse)').matches){
  for(const card of document.querySelectorAll('.gallery-frame,.image-button,.material-preview')){
    card.classList.add('experience-tilt');card.addEventListener('pointermove',e=>{const r=card.getBoundingClientRect();card.style.setProperty('--tilt-x',((e.clientY-r.top)/r.height-.5)*-3+'deg');card.style.setProperty('--tilt-y',((e.clientX-r.left)/r.width-.5)*3+'deg');});
    card.addEventListener('pointerleave',()=>{card.style.setProperty('--tilt-x','0deg');card.style.setProperty('--tilt-y','0deg');});
  }
}
passport();
window.HaizExperience={open,close,visit:mark,clearPassport,setSound,get visited(){return visited.slice();},get sound(){return enabled;}};
})();

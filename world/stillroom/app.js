/* STILLROOM — no framework, no dependencies, no analytics, local-first. */
(() => {
'use strict';
const $ = (q) => document.querySelector(q);
const $$ = (q) => [...document.querySelectorAll(q)];
const STORE = 'haiz-stillroom-v1';
const storage = window.HAIZ_PILOT ? sessionStorage : localStorage;
const saved = (() => { try { return JSON.parse(storage.getItem(STORE) || '{}'); } catch { return {}; } })();
const today = () => new Date().toLocaleDateString('en-CA');
const data = {
  room: ['rain', 'morning', 'cafe'].includes(saved.room) ? saved.room : 'rain',
  lamp: saved.lamp !== false,
  rain: Number.isInteger(saved.rain) ? saved.rain % 4 : 2,
  minutes: [15,25,45,60].includes(saved.minutes) ? saved.minutes : 25,
  intention: typeof saved.intention === 'string' ? saved.intention : '',
  notes: Array.isArray(saved.notes) ? saved.notes.slice(0,100) : [],
  sessions: Array.isArray(saved.sessions) ? saved.sessions.slice(-300) : [],
  timer: saved.timer && typeof saved.timer === 'object' ? saved.timer : null
};
const persist = () => { try { storage.setItem(STORE, JSON.stringify(data)); return true; } catch(e) { return false; } };
const rooms = {
  rain: {hero: '把世界<br><em>调低一点。</em>', eyebrow:'THE RAIN HAS NO DEADLINES', desc:'窗外的雨正在落下，书页还停在昨天。<br>没关系，今晚只需要安静地开始。', season:'AUTUMN · RAIN', weather:'RAIN / 16°C · 想象中的天气', index:'ROOM 001'},
  morning: {hero:'在光落下前，<br><em>先读一页。</em>', eyebrow:'SLOW MORNINGS, CLEAR THOUGHTS',desc:'让晨光慢慢漫过桌角。<br>今天的进度，可以从一行字开始。',season:'MORNING · SUNLIGHT',weather:'SUNLIGHT / 22°C · 想象中的天气',index:'ROOM 002'},
  cafe: {hero:'城市很吵，<br><em>这里刚好。</em>',eyebrow:'AN UNHURRIED EVENING',desc:'人声在远处轻轻流动，咖啡正温热。<br>留一个角落，给自己的想法。',season:'MIDNIGHT · CAFÉ',weather:'CITY LIGHTS / 20°C · 想象中的天气',index:'ROOM 003'}
};
let running = false, endAt = 0, remaining = data.minutes*60*1000, sessionStart=0, sessionPlanned=data.minutes*60*1000, isBreak=false;
let soundOn=false, audioContext=null, noiseSource=null, gainMaster=null, gainRain=null, noiseBuffer=null;
let toastTimer=0, rafId=0, weatherCtx=null, droplets=[], lastFrame=0, weatherWidth=0, weatherHeight=0;
let quality='high';
const fmt = ms => { const n = Math.max(0,Math.ceil(ms/1000)); return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`; };
const notify = msg => { const el=$('#ambientStatus'); el.textContent=msg;el.classList.add('show'); clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2400);};
function setRoom(room, quiet=false) {
  if(!rooms[room]) return;
  data.room=room; document.body.dataset.room=room;
  const x=rooms[room];$('#heroTitle').innerHTML=x.hero;$('#sceneEyebrow').textContent=x.eyebrow;$('#sceneDescription').innerHTML=x.desc;$('#seasonLabel').textContent=x.season;$('#weatherText').textContent=x.weather;$('#roomNumber').textContent=x.index;
  $$('.room-tab').forEach(b => { const active=b.dataset.roomTarget===room;b.classList.toggle('active',active);b.setAttribute('aria-pressed', String(active)); });
  $('#weatherBtn').style.display=room==='rain'?'flex':'none';
  if (!quiet) notify({rain:'窗外开始下雨了',morning:'一束晨光，照进了阅览室',cafe:'欢迎来到城市的另一面'}[room]);
  setSoundTexture();persist();
}
function setLamp(on) {data.lamp=Boolean(on);document.body.dataset.lamp=on?'on':'off';$('#lampState').textContent=on?'开':'关';$('#lampBtn').setAttribute('aria-pressed',String(on));persist();}
function setRain(v,quiet=false) {data.rain=v%4;$('#weatherState').textContent=['停雨','小雨','中雨','大雨'][data.rain]; $('#weatherBtn').setAttribute('aria-label','窗外的雨：'+$('#weatherState').textContent); if(!quiet) notify('窗外的雨 · '+$('#weatherState').textContent);setSoundTexture();persist();}
function updateClock() {$('#wallClock').textContent=new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());}
function countToday(){return data.sessions.filter(s=>s.day===today()).length;}
function updateSessionsText(){$('#sessionCounter').textContent=`今日 ${countToday()} 次完成`;}
function setLength(n) {if(running){notify('先暂停计时，才能调整时长');return}data.minutes=n;remaining=n*60*1000;sessionPlanned=remaining;isBreak=false; $$('#lengthSelect button').forEach(b=>b.classList.toggle('selected',Number(b.dataset.minutes)===n));updateTimer();persist();}
function updateTimer() {
  const p = sessionPlanned ? (1-remaining/sessionPlanned)*100 : 0;
  $('#timerRing').style.setProperty('--progress',`${Math.max(0,Math.min(100,p))}%`);
  $('#timerText').textContent=fmt(remaining);$('#mobileTime').textContent=fmt(remaining);
  $('#timerState').textContent=running?'这一刻，只做一件事':(remaining<sessionPlanned?'已暂停 · 再出发也不迟':'尚未开始 · 随时可以出发');
  $('#startButtonIcon').textContent=running?'Ⅱ':'▶';$('#startButtonText').textContent=running?'暂停专注':(remaining<sessionPlanned?'继续专注':'开始专注');$('#mobileStartText').textContent=running?'暂停':'开始专注';
  $('#modeTitle').textContent=isBreak?'REST / 休息':'FOCUS / 专注';
  document.title=(running?`${fmt(remaining)} · `:'')+'STILLROOM — 一室之间';
}
function saveTimer(){data.timer={running,endAt,remaining,sessionStart,sessionPlanned,isBreak,minutes:data.minutes};persist();}
function restoreTimer(){const t=data.timer;if(!t||typeof t.remaining!=='number')return; const max=12*60*60*1000;if(t.remaining<0||t.remaining>max)return;running=!!t.running;endAt=Number(t.endAt)||0;remaining=t.remaining;sessionStart=Number(t.sessionStart)||Date.now();sessionPlanned=Number(t.sessionPlanned)||data.minutes*60*1000;isBreak=!!t.isBreak;
running=false;remaining=Math.min(remaining,sessionPlanned);notify('已恢复上次内容，计时暂停；准备好再继续。');updateTimer();}
function finishSession(){const elapsed=Math.round(sessionPlanned/60000); running=false;data.sessions.push({day:today(),minutes:elapsed,at:Date.now(),intention:data.intention});data.sessions=data.sessions.slice(-300);updateSessionsText();saveTimer();notify(`完成了 ${elapsed} 分钟的专注。做得好。`);if('vibrate' in navigator)navigator.vibrate?.([80,80,80]);
// Give a gentle break, not an automatic restart.
isBreak=true;sessionPlanned=5*60000;remaining=sessionPlanned;$('#timerUnder').textContent='YOUR REST IS YOURS';updateTimer();saveTimer();}
function tick(){if(!running)return;remaining=Math.max(0,endAt-Date.now());if(remaining===0){if(isBreak){running=false;isBreak=false;remaining=data.minutes*60000;sessionPlanned=remaining;notify('休息结束。准备好时再开始。');saveTimer();updateTimer();} else finishSession();return}updateTimer();}
function toggleTimer(){if(running){remaining=Math.max(0,endAt-Date.now());running=false;$('#timerUnder').textContent='MINUTES REMAINING';notify('计时已暂停');} else {if(remaining<=0){remaining=data.minutes*60000;sessionPlanned=remaining;isBreak=false;}endAt=Date.now()+remaining;sessionStart=Date.now();running=true;$('#timerUnder').textContent='MINUTES REMAINING';if(document.body.classList.contains('panel-open')&&window.innerWidth<=880){document.body.classList.remove('panel-open')}notify(isBreak?'好好休息':'现在，把注意力还给自己');}updateTimer();saveTimer();}
function resetTimer(){running=false;isBreak=false;remaining=data.minutes*60000;sessionPlanned=remaining;$('#timerUnder').textContent='MINUTES REMAINING';updateTimer();saveTimer();notify('计时器已重置');}
function setZen(on){document.body.classList.toggle('zen',on);document.body.classList.remove('panel-open');notify(on?'沉浸已开启 · 按 Z 或点击右上角退出':'欢迎回来');}
function openSheet(which){document.body.classList.remove('panel-open'); const journal=which==='journal';$('#journalView').hidden=!journal;$('#rhythmView').hidden=journal;$('#sheetKicker').textContent=journal?'A LITTLE NOTE':'TIME, GENTLY KEPT';$('#overlay').classList.add('open');$('#overlay').setAttribute('aria-hidden','false');if(journal){renderNotes();setTimeout(()=>$('#journalInput').focus(),350)}else renderRhythm();}
function closeSheet(){$('#overlay').classList.remove('open');$('#overlay').setAttribute('aria-hidden','true');}
function renderNotes(){const el=$('#savedNotes');el.replaceChildren();data.notes.slice().reverse().forEach(item=>{const row=document.createElement('article');row.className='saved-note';const tm=document.createElement('time');tm.textContent=new Date(item.at).toLocaleString('zh-CN',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});const txt=document.createElement('p');txt.textContent=item.text;const remove=document.createElement('button');remove.textContent='删除这条记录';remove.addEventListener('click',()=>{data.notes=data.notes.filter(n=>n.id!==item.id);persist();renderNotes()});row.append(tm,txt,remove);el.append(row);});}
function saveNote(){const str=$('#journalInput').value.trim();if(!str){notify('写下一点想法，再保存吧');return}data.notes.push({id:Date.now()+'-'+Math.floor(Math.random()*1000),text:str,at:Date.now()});data.notes=data.notes.slice(-100);if(!persist()){notify('存储不可用，文字仅在当前页面，请复制保留');return;}$('#journalInput').value='';$('#noteCount').textContent='0 / 500';renderNotes();notify('这一刻，已经留下');}
function renderRhythm(){const total=data.sessions.reduce((n,s)=>n+s.minutes,0);$('#rhythmSessions').textContent=data.sessions.length;$('#rhythmMinutes').textContent=total;const days=Array.from({length:7},(_,i)=>{let d=new Date();d.setDate(d.getDate()-(6-i));const day=d.toLocaleDateString('en-CA');return{day,label:`${d.getMonth()+1}/${d.getDate()}`,minutes:data.sessions.filter(s=>s.day===day).reduce((n,s)=>n+s.minutes,0)}});const max=Math.max(25,...days.map(d=>d.minutes));$('#rhythmGraph').replaceChildren();days.forEach(d=>{const col=document.createElement('div');col.className='rhythm-col';const value=document.createElement('span');value.className='bar-value';value.textContent=d.minutes||'·';const bar=document.createElement('div');bar.className='bar';bar.style.height=(d.minutes?(d.minutes/max)*104:2)+'px';bar.setAttribute('title',`${d.day}: ${d.minutes} 分钟`);const label=document.createElement('span');label.className='bar-day';label.textContent=d.label;col.append(value,bar,label);$('#rhythmGraph').append(col);});}
function pickQuality(){const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;const memory=navigator.deviceMemory||4;const cores=navigator.hardwareConcurrency||4;const small=innerWidth<800||/Android|iPhone|iPad/i.test(navigator.userAgent);quality=reduced||memory<=2||cores<=2?'low':small?'medium':'high';document.body.dataset.quality=quality;/* User-provided local architectural art only; no external font/photo request. */
}

function createNoise(){if(noiseBuffer||!audioContext)return;const rate=audioContext.sampleRate;noiseBuffer=audioContext.createBuffer(1,Math.round(rate*2),rate);const b=noiseBuffer.getChannelData(0);let brown=0;for(let i=0;i<b.length;i++){const white=Math.random()*2-1;brown=(brown+.02*white)/1.02;b[i]=brown*3.5;}}
function ensureAudio(){if(audioContext){audioContext.resume();return;}const AC=window.AudioContext||window.webkitAudioContext;if(!AC){notify('当前浏览器不支持声音播放');return}audioContext=new AC();createNoise();noiseSource=audioContext.createBufferSource();noiseSource.buffer=noiseBuffer;noiseSource.loop=true; const filter=audioContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1150;gainRain=audioContext.createGain();gainRain.gain.value=0;gainMaster=audioContext.createGain();gainMaster.gain.value=0;noiseSource.connect(filter).connect(gainRain).connect(gainMaster).connect(audioContext.destination);noiseSource.start();}
function setSoundTexture(){if(!audioContext||!gainRain||!gainMaster)return;const t=audioContext.currentTime;let volume=data.room==='rain'? [0,.14,.32,.55][data.rain] : data.room==='cafe'?.12:.06;gainRain.gain.setTargetAtTime(volume,t,.4);gainMaster.gain.setTargetAtTime(soundOn?.35:0,t,.24);}
function toggleSound(){soundOn=!soundOn;ensureAudio();$('#soundBtn').setAttribute('aria-pressed',String(soundOn));$('#soundBtn').title=soundOn?'关闭环境声音':'打开环境声音';setSoundTexture();notify(soundOn?'声音已开启 · 为避免打扰，音量保持轻柔':'环境声音已关闭');}
function resizeWeather(){const canvas=$('#weather'),rect=canvas.getBoundingClientRect();const ratio=Math.min(devicePixelRatio||1,quality==='high'?1.4:1);weatherWidth=rect.width;weatherHeight=rect.height;canvas.width=Math.floor(weatherWidth*ratio);canvas.height=Math.floor(weatherHeight*ratio);weatherCtx=canvas.getContext('2d',{alpha:true,desynchronized:true});if(weatherCtx)weatherCtx.setTransform(ratio,0,0,ratio,0,0);const n=quality==='low'?24:quality==='medium'?75:145;droplets=Array.from({length:n},()=>({x:Math.random()*weatherWidth,y:Math.random()*weatherHeight,speed:1.4+Math.random()*2.8,len:7+Math.random()*20,opacity:.06+Math.random()*.27,width:.4+Math.random()*.7}));}
function paintRain(ts){rafId=requestAnimationFrame(paintRain);if(document.hidden||data.room!=='rain'||data.rain===0||!weatherCtx||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const frameMs=quality==='low'?50:quality==='medium'?34:20;if(ts-lastFrame<frameMs)return;const delta=Math.min(2.8,(ts-lastFrame)/16.7||1);lastFrame=ts;const c=weatherCtx;c.clearRect(0,0,weatherWidth,weatherHeight);c.save();c.lineCap='round';const multiplier=[0,.45,.75,1][data.rain];for(let i=0;i<Math.floor(droplets.length*multiplier);i++){const d=droplets[i];d.y+=d.speed*delta*(data.rain===3?1.4:1);d.x-=.28*delta;if(d.y>weatherHeight+30){d.y=-30;d.x=Math.random()*weatherWidth}if(d.x<0)d.x=weatherWidth;c.strokeStyle=`rgba(204,223,218,${d.opacity})`;c.lineWidth=d.width;c.beginPath();c.moveTo(d.x,d.y);c.lineTo(d.x-1.1,d.y+d.len);c.stroke()}c.restore();}
function pointerParallax(){if(!window.matchMedia('(hover:hover) and (pointer:fine)').matches)return;let rx=0,ry=0,x=0,y=0;window.addEventListener('pointermove',e=>{if(document.hidden)return;rx=(e.clientX/innerWidth-.5)*-14;ry=(e.clientY/innerHeight-.5)*-9},{passive:true});function animate(){x+=(rx-x)*.04;y+=(ry-y)*.04;$('#environment').style.setProperty('--photo-shift-x',x.toFixed(2)+'px');$('#environment').style.setProperty('--photo-shift-y',y.toFixed(2)+'px');if(!document.hidden)requestAnimationFrame(animate);else setTimeout(()=>requestAnimationFrame(animate),1000)}animate()}
function bind(){
  $$('.room-tab').forEach(b=>b.addEventListener('click',()=>setRoom(b.dataset.roomTarget)));
  $('#lampBtn').addEventListener('click',()=>{setLamp(!data.lamp);notify(data.lamp?'书桌上的灯亮了':'灯光已调暗')});
  $('#weatherBtn').addEventListener('click',()=>setRain(data.rain+1));
  $('#soundBtn').addEventListener('click',toggleSound);
  $('#fullscreenBtn').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{notify('浏览器不支持全屏')}});
  $('#zenBtn').addEventListener('click',()=>setZen(!document.body.classList.contains('zen')));$('#revealBtn').addEventListener('click',()=>setZen(false));
  $('#startHeroBtn').addEventListener('click',()=>{if(!running)toggleTimer();else notify('正在专注，时间继续流动');});
  $$('#lengthSelect button').forEach(b=>b.addEventListener('click',()=>setLength(Number(b.dataset.minutes))));
  $('#timerStart').addEventListener('click',toggleTimer);$('#mobileStart').addEventListener('click',toggleTimer);$('#resetBtn').addEventListener('click',resetTimer);
  $('#collapseBtn').addEventListener('click',()=>document.body.classList.remove('panel-open'));
  $('#mobilePanelBtn').addEventListener('click',()=>document.body.classList.toggle('panel-open'));
  $('#intentionInput').addEventListener('input',e=>{data.intention=e.target.value;persist()});
  $('#intentionInput').addEventListener('keydown',e=>{if(e.key==='Enter'){$('#intentionInput').blur();notify('这一件事，已放在心上')}});
  $('#openJournal').addEventListener('click',()=>openSheet('journal'));
  $('#openRhythm').addEventListener('click',()=>openSheet('rhythm'));
  $('#closeSheet').addEventListener('click',closeSheet);$('#overlay').querySelector('[data-close-overlay]').addEventListener('click',closeSheet);
  $('#journalInput').addEventListener('input',e=>{$('#noteCount').textContent=e.target.value.length+' / 500'});
  $('#saveNote').addEventListener('click',saveNote);
  window.addEventListener('keydown',e=>{const editing=['INPUT','TEXTAREA'].includes(document.activeElement?.tagName);if(e.key==='Escape'){closeSheet();document.body.classList.remove('panel-open');return}if(editing||$('#overlay').classList.contains('open'))return;if(e.key.toLowerCase()==='z')setZen(!document.body.classList.contains('zen'));if(e.code==='Space'){e.preventDefault();toggleTimer()}if(['1','2','3'].includes(e.key))setRoom(['rain','morning','cafe'][Number(e.key)-1]);if(e.key.toLowerCase()==='s')toggleSound();});
  window.addEventListener('resize',()=>{clearTimeout(window._wResize);window._wResize=setTimeout(resizeWeather,300)},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){tick();updateClock();lastFrame=0}});
  window.addEventListener('pagehide',()=>{if(running)saveTimer()});
}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running){remaining=Math.max(0,endAt-Date.now());running=false;updateTimer();saveTimer();}});
window.addEventListener('pagehide',()=>{if(running){remaining=Math.max(0,endAt-Date.now());running=false;saveTimer();}});
function init(){pickQuality();setRoom(data.room,true);setLamp(data.lamp);setRain(data.rain,true);$('#intentionInput').value=data.intention;setLength(data.minutes);restoreTimer();updateSessionsText();bind();updateClock();setInterval(updateClock,25000);setInterval(()=>{if(running)tick()},250);resizeWeather();if(weatherCtx)rafId=requestAnimationFrame(paintRain);pointerParallax();setTimeout(()=>$('#introMask').classList.add('done'),950);if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

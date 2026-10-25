import { springState, advanceSpring, profiles } from './spring.js';
const THEMES = ['obsidian', 'porcelain', 'ocean', 'system'];
const KEY = 'haiz.lucent.preferences.v1';
const icons = {
 today:'M5 5h14v16H5zM8 3v4m8-4v4M8 11h8m-8 4h5',
 study:'M3 5h6l3 2 3-2h6v14h-6l-3 2-3-2H3zM12 7v14',
 campus:'m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15',
 search:'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
 settings:'M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0'
};
const svg = name => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${icons[name]}"/></svg>`;
const catalog = [
 {label:'今日作业', detail:'本班公开清单 · 未连接时为本机缓存', route:'assignments'},
 {label:'我的书桌', detail:'思路、目标与私人便笺',route:'study'},
 {label:'思考书架',detail:'保存在这台设备的记录',route:'shelf'},
 {label:'学习资源',detail:'已确认的公共资源',route:'resources'},
 {label:'校园地图',detail:'建筑照片来源与概念地图',route:'atlas'},
 {label:'校园漫游',detail:'第一人称 · 按需加载',route:'walk'},
 {label:'社团与作品',detail:'本机社团演示，不代表正式组织',route:'club'},
 {label:'私人作品',detail:'本机作品与创作记录',route:'works'},
 {label:'校园记忆',detail:'原有校园文字与来源',route:'memory'},
 {label:'纸上思路',detail:'打印当前思路，不需携带手机',route:'paper'}
];
const storage = {
 read(){try {return JSON.parse(localStorage.getItem(KEY)||'{}');}catch{return {};}},
 write(value){try {localStorage.setItem(KEY,JSON.stringify(value));return true;}catch{return false;}}
};
export function mountLucent() {
 if(document.querySelector('#lucent-dock'))return;
 const root=document.documentElement, prefs={theme:'system',motion:'system',lowPower:false,...storage.read()};
 if(!THEMES.includes(prefs.theme))prefs.theme='system';
 const dark=matchMedia('(prefers-color-scheme: dark)'), reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const reduced=()=>prefs.motion==='reduced'||prefs.lowPower||(prefs.motion==='system'&&reduce.matches);
 const apply=()=>{
  const theme=prefs.theme==='system'?(dark.matches?'obsidian':'porcelain'):prefs.theme;
  root.dataset.lucentTheme=theme;root.dataset.lucentMotion=reduced()?'reduced':'full';root.dataset.lucentPower=prefs.lowPower?'low':'normal';
  root.style.colorScheme=theme==='porcelain'?'light':'dark';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',{obsidian:'#0E121D',porcelain:'#F3F1EC',ocean:'#091D27'}[theme]);
  document.dispatchEvent(new CustomEvent('haiz:preferences',{detail:{...prefs,reduced:reduced()}}));
 };
 dark.addEventListener('change',apply);reduce.addEventListener('change',()=>{apply();wake()});apply();
 const dock=document.createElement('nav');dock.id='lucent-dock';dock.className='lucent-dock';dock.dataset.testid='lucent-dock';dock.setAttribute('aria-label','主要功能');
 dock.innerHTML=`<div class="lucent-tray"><span class="lucent-lens" aria-hidden="true"></span>${[['today','assignments','今天'],['study','study','书桌'],['campus','atlas','校园']].map(([id,route,label])=>`<a id="dock-${id}" data-testid="dock-${id}" data-route="${route}" href="#${route}" aria-label="${label}">${svg(id)}<span>${label}</span></a>`).join('')}</div><button id="dock-search" data-testid="dock-search" class="lucent-orb" aria-label="搜索功能" aria-expanded="false" aria-controls="lucent-search">${svg('search')}</button>`;
 document.body.append(dock);
 const tray=dock.querySelector('.lucent-tray'),lens=tray.querySelector('.lucent-lens'),tabs=[...tray.querySelectorAll('a')],orb=dock.querySelector('.lucent-orb');
 const settings=document.createElement('button');settings.id='lucent-settings';settings.dataset.testid='lucent-settings';settings.className='lucent-settings';settings.setAttribute('aria-label','外观与动效');settings.innerHTML=svg('settings');document.body.append(settings);
 const preferences=document.createElement('dialog');preferences.id='lucent-preferences';preferences.className='lucent-dialog';preferences.setAttribute('aria-labelledby','lucent-preferences-title');
 preferences.innerHTML=`<header><h2 id="lucent-preferences-title">外观与动效</h2><button type="button" data-lucent-close aria-label="关闭外观设置">×</button></header><fieldset><legend>主题</legend><div class="lucent-theme-options">${[['obsidian','Obsidian','黑曜'],['porcelain','Porcelain','瓷白'],['ocean','Ocean','深海'],['system','跟随系统','自动']].map(([id,name,label])=>`<label><input type="radio" name="lucent-theme" value="${id}"><span class="theme-swatch" data-swatch="${id}"></span><strong>${name}</strong><small>${label}</small></label>`).join('')}</div></fieldset><label class="lucent-field">动效<select id="lucent-motion"><option value="system">跟随系统</option><option value="full">自然动效</option><option value="reduced">减少动效</option></select></label><label class="lucent-check"><input id="lucent-low-power" type="checkbox">低耗电界面</label><p>关闭持续模糊与导航弹簧。校园与自习空间的画质在各自页面单独设置。</p><p id="lucent-prefs-state" role="status"></p>`;
 document.body.append(preferences);
 settings.onclick=()=>{preferences.querySelector(`[value="${prefs.theme}"]`).checked=true;preferences.querySelector('#lucent-motion').value=prefs.motion;preferences.querySelector('#lucent-low-power').checked=prefs.lowPower;preferences.showModal();};
 preferences.querySelector('[data-lucent-close]').onclick=()=>preferences.close();
 preferences.addEventListener('change',()=>{
  prefs.theme=preferences.querySelector('[name="lucent-theme"]:checked').value;prefs.motion=preferences.querySelector('#lucent-motion').value;prefs.lowPower=preferences.querySelector('#lucent-low-power').checked;apply();wake();
  preferences.querySelector('#lucent-prefs-state').textContent=storage.write(prefs)?'已保存到这台设备':'设置已应用，但浏览器无法保存；关闭后可能恢复默认。';
 });
 const panel=document.createElement('dialog');panel.id='lucent-search';panel.className='lucent-search';panel.setAttribute('aria-labelledby','lucent-search-title');
 panel.innerHTML='<header><h2 id="lucent-search-title">找一个功能</h2><button type="button" data-search-close aria-label="关闭搜索">×</button></header><label class="lucent-search-input">搜索<input id="lucent-query" type="search" placeholder="作业、思路、社团…" autocomplete="off"></label><div id="lucent-results"></div><p>只搜索功能名称，不上传私人记录。</p>';
 document.body.append(panel);const query=panel.querySelector('input'),results=panel.querySelector('#lucent-results');let searchAnimation=null,searchClosing=false;
 const populate=()=>{const q=query.value.trim().toLowerCase(), matches=catalog.filter(x=>(x.label+x.detail).toLowerCase().includes(q));results.replaceChildren(...matches.map(item=>{const a=document.createElement('a');a.href='#'+item.route;const strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=item.label;small.textContent=item.detail;a.append(strong,small);a.onclick=e=>{e.preventDefault();closeSearch();navigate(item.route)};return a;}));if(!matches.length)results.textContent='没有匹配的功能，试试“作业”或“思路”。';};query.addEventListener('input',populate);populate();
 const geometry=()=>{const from=orb.getBoundingClientRect(),to=panel.getBoundingClientRect();return {transform:`translate(${from.left-to.left}px,${from.top-to.top}px) scale(${from.width/to.width},${from.height/to.height})`,borderRadius:'32px'};};
 function openSearch(){if(panel.open&&!searchClosing)return;const previous=panel.open?{transform:getComputedStyle(panel).transform,borderRadius:getComputedStyle(panel).borderRadius}:null;searchClosing=false;searchAnimation?.cancel();if(!panel.open)panel.showModal();orb.setAttribute('aria-expanded','true');populate();if(!reduced())searchAnimation=panel.animate([previous||geometry(),{transform:'none',borderRadius:'26px'}],{duration:340,easing:'cubic-bezier(.16,1,.3,1)'});query.focus({preventScroll:true});}
 function closeSearch(){if(!panel.open||searchClosing)return;searchClosing=true;const current=getComputedStyle(panel).transform;searchAnimation?.cancel();orb.setAttribute('aria-expanded','false');if(reduced()){panel.close();searchClosing=false;return;}searchAnimation=panel.animate([{transform:current,borderRadius:'26px'},geometry()],{duration:180,easing:'cubic-bezier(.4,0,1,1)'});searchAnimation.onfinish=()=>{panel.close();searchClosing=false;orb.focus({preventScroll:true});};}
 panel.querySelector('[data-search-close]').onclick=closeSearch;panel.addEventListener('cancel',e=>{e.preventDefault();closeSearch();});orb.onclick=()=>panel.open?closeSearch():openSearch();
 const state=springState(0);let frame=0,last=0,drag=null,suppressClick=false,width=0,initialized=false;
 const currentRoute=()=>location.hash.slice(1).split('?')[0]||'study';
 const activeRoute=()=>{const r=currentRoute();return ['study','shelf','paper','resources','windowsill'].includes(r)?'study':r==='assignments'?'assignments':'atlas';};
 const center=tab=>tab.offsetLeft+(tab.offsetWidth-width)/2;
 const paint=()=>{
  const stretch=reduced()?0:Math.min(Math.abs(state.velocity)/2200,(profiles[state.profile]||profiles.balanced).stretch);
  lens.style.transform=`translate3d(${state.x}px,0,0) scaleX(${1+stretch})`;lens.dataset.position=state.x.toFixed(2);lens.dataset.velocity=state.velocity.toFixed(2);
  lens.style.setProperty('--glint-x',`${50+Math.max(-25,Math.min(25,state.velocity/45))}%`);
  tabs.forEach((tab,i)=>{
   const weight=Math.max(0,1-Math.abs(center(tab)-state.x)/(tab.offsetWidth||1));
   tab.style.setProperty('--selection-weight',weight.toFixed(3));
   tab.style.color=`color-mix(in srgb,var(--accent-action) ${Math.round(weight*100)}%,var(--text-secondary))`;
   const icon=tab.querySelector('svg'),path=icon.querySelector('path');
   icon.style.setProperty('--icon-lift',`${-weight*1.8}px`);
   if(i===1)path.setAttribute('d',`M3 ${5+weight}h6l3 ${2-weight} ${3} ${-2+weight}h6v14h-6l-3 ${2-weight}-3 ${-2+weight}H3zM12 7v${14-weight*2}`);
   else if(i===0)path.setAttribute('d',`M5 ${5-weight}h14v${16+weight}H5zM8 3v4m8-4v4M8 11h8m-8 4h${5+weight*3}`);
   else path.setAttribute('d',`m3 ${6-weight} 6 ${-3+weight} 6 ${3-weight} 6 ${-3+weight}v15l-6 ${3-weight}-6 ${-3+weight}-6 ${3-weight}zM9 3v15m6-12v15`);
  });
 };
 function tick(time){const keep=advanceSpring(state,last?(time-last)/1000:1/60,reduced());last=time;paint();frame=keep&&!document.hidden?requestAnimationFrame(tick):0;}
 function wake(){if(!frame){last=0;frame=requestAnimationFrame(tick);}}
 function update(){const route=activeRoute();tabs.forEach(t=>t.setAttribute('aria-current',t.dataset.route===route?'page':'false'));const active=tabs.find(t=>t.dataset.route===route);width=active.offsetWidth-8;lens.style.width=width+'px';state.target=center(active);if(!initialized){state.x=state.target;state.velocity=0;initialized=true;paint();}wake();root.dataset.lucentRoute=currentRoute();document.body.classList.toggle('native-immersive',['walk','classroom'].includes(currentRoute()));}
 function navigate(route){if(location.hash!=='#'+route)location.hash=route;else update();}
 tabs.forEach(tab=>{tab.draggable=false;});
 tray.addEventListener('dragstart',e=>e.preventDefault());
 tabs.forEach(tab=>tab.addEventListener('click',e=>{e.preventDefault();if(suppressClick){suppressClick=false;return;}navigate(tab.dataset.route);}));
 tray.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const at=Math.max(0,tabs.indexOf(document.activeElement)),i=e.key==='Home'?0:e.key==='End'?2:(at+(e.key==='ArrowRight'?1:2))%3;tabs[i].focus();navigate(tabs[i].dataset.route);});
 tray.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={id:e.pointerId,start:e.clientX,x:e.clientX,time:e.timeStamp,moved:false};});
 tray.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;if(!drag.moved&&Math.abs(e.clientX-drag.start)>6){drag.moved=true;tray.setPointerCapture(e.pointerId);}if(!drag.moved)return;e.preventDefault();if(frame)cancelAnimationFrame(frame);frame=0;const dt=Math.max((e.timeStamp-drag.time)/1000,.001);state.velocity=Math.max(-1400,Math.min(1400,(e.clientX-drag.x)/dt));state.x=Math.max(0,Math.min(tray.clientWidth-width,e.clientX-tray.getBoundingClientRect().left-width/2));state.target=state.x;drag.x=e.clientX;drag.time=e.timeStamp;paint();});
 const release=e=>{if(!drag||e.pointerId!==drag.id)return;if(drag.moved){suppressClick=true;state.velocity*=Math.exp(-Math.max(0,e.timeStamp-drag.time)/80);const projected=state.x+state.velocity*.055;const nearest=tabs.reduce((best,t)=>Math.abs(center(t)-projected)<Math.abs(center(best)-projected)?t:best,tabs[0]);navigate(nearest.dataset.route);state.target=center(nearest);wake();setTimeout(()=>{suppressClick=false;},0);}drag=null;};tray.addEventListener('pointerup',release);tray.addEventListener('pointercancel',e=>{drag=null;update();});
 new ResizeObserver(update).observe(tray);addEventListener('hashchange',update);document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else wake();});
 let oldY=scrollY,scrollQueued=false;addEventListener('scroll',()=>{if(scrollQueued)return;scrollQueued=true;requestAnimationFrame(()=>{dock.classList.toggle('is-compact',scrollY>80&&scrollY-oldY>2);oldY=scrollY;scrollQueued=false;});},{passive:true});
 const keyboard=()=>{const vv=visualViewport,focused=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);dock.classList.toggle('keyboard-open',!!(vv&&focused&&innerHeight-vv.height>100));};visualViewport?.addEventListener('resize',keyboard);document.addEventListener('focusin',keyboard);document.addEventListener('focusout',()=>setTimeout(keyboard,0));
 document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openSearch();}});
 let exitArmed=0;const cap=window.Capacitor,app=cap?.getPlatform?.()==='android'?(cap.registerPlugin?.('App')||cap.Plugins?.App):null;
 if(app)app.addListener('backButton',()=>{const dialog=document.querySelector('dialog[open]');if(dialog){if(dialog===panel)closeSearch();else dialog.close();return;}const r=currentRoute();const parent={shelf:'study',paper:'study',resources:'study',windowsill:'study',walk:'atlas',memory:'atlas',club:'atlas',works:'club'}[r];if(parent){location.hash=parent;return;}if(r!=='study'){location.hash='study';return;}if(Date.now()-exitArmed<1800){app.exitApp();return;}exitArmed=Date.now();const toast=document.querySelector('#toast');if(toast){toast.textContent='再按一次返回键退出';toast.classList.add('visible');setTimeout(()=>toast.classList.remove('visible'),1800);}});
 // Native functional headings only: do not edit authored campus histories or literary pages.
 const conciseCopy=()=>{const route=currentRoute(),main=document.querySelector('#main');if(!main)return;const copy={study:['我的书桌','接回上次思路，或记录下一步。'],assignments:['今日作业','公开作业以教师说明为准；未连接时显示本机有效缓存。'],shelf:['思考书架','查看、修改或导出这台设备的记录。']}[route];if(copy){const h=main.querySelector('.r2-heading h1'),p=main.querySelector('.r2-heading>div>p');if(h)h.textContent=copy[0];if(p)p.textContent=copy[1];}if(route==='study'){const replacements=[['.study-invitation h2','专注学习'],['.study-invitation p','设置学习时段，中断前保存下一步。']];for(const [selector,text] of replacements){const el=main.querySelector(selector);if(el)el.textContent=text;}const empty=main.querySelector('.continuity-card .example-thought');if(empty){const h=main.querySelector('.continuity-card h2');if(h)h.textContent='记录当前思路';}}main.querySelectorAll('.r2-heading .eyebrow').forEach(e=>{e.hidden=true;});};
 window.addEventListener('haiz:route-ready',()=>{conciseCopy();update();});addEventListener('hashchange',()=>setTimeout(conciseCopy,0));conciseCopy();update();
 return {state,prefs,setTheme(theme){if(!THEMES.includes(theme))throw Error('Unknown theme');prefs.theme=theme;apply();storage.write(prefs);},get selected(){return activeRoute();}};
}

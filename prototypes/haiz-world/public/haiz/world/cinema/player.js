// Optional cinematic entrance. The real study tools load independently behind it.
const media=name=>new URL('./media/'+name,import.meta.url).href;
export function installCinema(){
 if(window.HAIZ_CINEMA_INSTALLED)return;window.HAIZ_CINEMA_INSTALLED=true;
 const style=document.createElement('style');style.textContent=`.haiz-cinema-room{position:fixed;inset:0;margin:0;width:100vw;max-width:none;height:100dvh;max-height:none;padding:0;border:0;background:#0e121d;overflow:hidden}.haiz-cinema-room iframe{width:100%;height:100%;border:0;display:block}.haiz-cinema-film{position:absolute;inset:0;background:#0e121d;overflow:hidden}.haiz-cinema-film video,.haiz-cinema-film img{position:absolute;width:100%;height:100%;object-fit:cover}.haiz-cinema-close,.haiz-cinema-skip{position:absolute;z-index:4;min-height:44px;border:1px solid #ffffff70;border-radius:24px;padding:10px 16px;background:#14212ee8;color:#fff;font:14px system-ui;cursor:pointer}.haiz-cinema-close{top:calc(12px + env(safe-area-inset-top));left:12px}.haiz-cinema-skip{bottom:calc(24px + env(safe-area-inset-bottom));right:24px}.haiz-cinema-state{position:absolute;bottom:calc(28px + env(safe-area-inset-bottom));left:20px;max-width:65%;color:#fff;background:#14212ed9;padding:8px 12px;font:13px system-ui}.haiz-cinema-retry{position:absolute;inset:25%;z-index:6;padding:24px;background:#f3f1ec;color:#242a38;font:16px system-ui}.haiz-cinema-retry button{min-height:44px;padding:10px;margin:10px}`;document.head.append(style);
 const add=()=>{const host=document.querySelector('.space-bottom');if(!host||host.querySelector('[data-cinema-enter]'))return;const b=document.createElement('button');b.type='button';b.className='btn cream';b.dataset.cinemaEnter='true';b.dataset.testid='cinema-enter';b.textContent='进入概念自习空间';b.onclick=()=>openCinema(b);host.append(b);};
 new MutationObserver(add).observe(document.querySelector('#app'),{childList:true,subtree:true});add();
}
export function openCinema(source){
 if(document.querySelector('.haiz-cinema-room'))return;
 const html=document.documentElement;
 const light=html.dataset.lucentMotion==='reduced'||html.dataset.lucentPower==='low'||matchMedia('(prefers-reduced-motion: reduce)').matches||navigator.connection?.saveData;
 const theme=['obsidian','porcelain','ocean'].includes(html.dataset.lucentTheme)?html.dataset.lucentTheme:'porcelain';
 let repeat=false;try{repeat=sessionStorage.getItem('haiz.cinema.seen.v1')==='1';sessionStorage.setItem('haiz.cinema.seen.v1','1')}catch{}
 const d=document.createElement('dialog');d.className='haiz-cinema-room';d.dataset.testid='cinema-room';d.setAttribute('aria-label','概念自习空间');
 const frame=document.createElement('iframe');frame.title='可交互的自习空间、计时与私人手记';frame.src=new URL('../stillroom/index.html?cinema=1&embedded=1',import.meta.url);frame.dataset.testid='cinema-study';d.append(frame);
 const close=document.createElement('button');close.className='haiz-cinema-close';close.textContent='返回书桌';d.append(close);
 let video,overlay,timer,watchdog,ready=false,closed=false;
 const finish=reason=>{if(!overlay)return;clearTimeout(timer);clearTimeout(watchdog);video?.pause();if(video){video.removeAttribute('src');video.load();}overlay.remove();overlay=null;d.dataset.filmState=reason;frame.focus();};
 const dispose=()=>{if(closed)return;closed=true;finish('closed');clearTimeout(readyTimer);removeEventListener('message',message);document.removeEventListener('visibilitychange',hidden);frame.src='about:blank';d.close();d.remove();source?.focus({preventScroll:true});};
 const hidden=()=>{if(document.hidden)finish('background-skip')};
 const message=e=>{if(e.source!==frame.contentWindow||e.origin!==location.origin)return;if(e.data?.type==='haiz-study-ready'){ready=true;clearTimeout(readyTimer);d.dataset.studyReady='true';}if(e.data?.type==='haiz-study-close')dispose();};
 addEventListener('message',message);document.addEventListener('visibilitychange',hidden);close.onclick=dispose;d.addEventListener('cancel',e=>{e.preventDefault();dispose()});d.addEventListener('close',()=>{if(!closed)dispose()});document.body.append(d);d.showModal();
 const readyTimer=setTimeout(()=>{if(ready||closed)return;finish('study-load-failed');const error=document.createElement('section');error.className='haiz-cinema-retry';error.innerHTML='<h2>自习工具未完成加载</h2><p>可以重试或返回书桌。本机记录不会被清除。</p><button>重试工具</button>';error.querySelector('button').onclick=()=>{frame.src=new URL('../stillroom/index.html?cinema=1&embedded=1',import.meta.url);error.remove()};d.append(error)},10000);
 if(light){d.dataset.filmState='reduced';return;}
 if(repeat){const r=source?.getBoundingClientRect();if(r&&r.width)d.animate([{clipPath:`inset(${Math.max(0,r.top)}px ${Math.max(0,innerWidth-r.right)}px ${Math.max(0,innerHeight-r.bottom)}px ${Math.max(0,r.left)}px round 20px)`},{clipPath:'inset(0 round 0)'}],{duration:230,easing:'cubic-bezier(.16,1,.3,1)'});d.dataset.filmState='repeat-short';return;}
 overlay=document.createElement('div');overlay.className='haiz-cinema-film';const poster=document.createElement('img');poster.src=media('poster.png');poster.alt='原创概念学习空间';overlay.append(poster);
 video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';video.src=media('HAIZ-'+theme+'.mp4');video.poster=poster.src;overlay.append(video);
 const skip=document.createElement('button');skip.className='haiz-cinema-skip';skip.dataset.testid='cinema-skip';skip.textContent='跳过，开始自习';skip.onclick=()=>finish('skipped');overlay.append(skip);const status=document.createElement('span');status.className='haiz-cinema-state';status.textContent='概念学习空间 · 工具正在独立加载';overlay.append(status);d.append(overlay);
 timer=setTimeout(()=>finish('media-timeout'),2500);watchdog=setTimeout(()=>finish('playback-timeout'),9500);
 video.onplaying=()=>{clearTimeout(timer);d.dataset.filmState='playing'};video.onended=()=>finish('ended');video.onerror=()=>finish('media-failed');video.play().catch(()=>finish('playback-unavailable'));
}

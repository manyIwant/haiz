(() => {
 document.documentElement.classList.add('haiz-native');
 // Apply the persisted palette before the app module renders; no record migration here.
 try {
  const prefs=JSON.parse(localStorage.getItem('haiz.lucent.preferences.v1')||'{}');
  const theme=['obsidian','porcelain','ocean'].includes(prefs.theme)?prefs.theme:matchMedia('(prefers-color-scheme: dark)').matches?'obsidian':'porcelain';
  document.documentElement.dataset.lucentTheme=theme;
 } catch { document.documentElement.dataset.lucentTheme='porcelain'; }
 if(!location.hash)location.hash='study';
 import('./lucent/dock.js').then(({mountLucent})=>mountLucent()).catch(error=>{
  // The content remains usable even when optional navigation resources fail.
  console.error('HAIZ navigation resource failed',error);
  const nav=document.createElement('nav');nav.className='lucent-fallback';nav.setAttribute('aria-label','基础导航');
  nav.innerHTML='<a href="#assignments">今日作业</a><a href="#study">我的书桌</a><a href="#atlas">校园地图</a>';
  document.body.append(nav);
 });
 import('./cinema/player.js').then(m=>m.installCinema()).catch(()=>console.warn('[HAIZ] Optional cinema unavailable; study remains usable'));
})();

(() => {
 document.documentElement.classList.add('haiz-native');
 if(!location.hash)location.hash='study';
 const nav=document.createElement('nav');nav.className='native-tabs';nav.setAttribute('aria-label','移动端主导航');
 nav.innerHTML=[['assignments','今日作业','01'],['study','我的书桌','02'],['atlas','校园地图','03'],['homework','教师工作台','04']].map(([route,label,n])=>`<a href="#${route}" data-native-route="${route}"><small>${n}</small><span>${label}</span></a>`).join('');document.body.append(nav);
 const update=()=>{const route=location.hash.slice(1).split('?')[0];nav.querySelectorAll('a').forEach(a=>a.setAttribute('aria-current',a.dataset.nativeRoute===route?'page':'false'));document.body.classList.toggle('native-immersive',['walk','classroom'].includes(route));};
 addEventListener('hashchange',update);update();
 const notice=document.createElement('aside');notice.className='native-preview-note';notice.innerHTML='<span>离线预览版 · 学习记录保存在这台设备</span><button aria-label="关闭版本说明">×</button>';notice.querySelector('button').onclick=()=>{notice.remove();sessionStorage.setItem('haiz.native.notice','seen')};if(!sessionStorage.getItem('haiz.native.notice'))document.body.append(notice);
 // Android hardware back stays inside the app until the root route.
 const cap=window.Capacitor;const app=cap?.getPlatform?.()==='android'?(cap.registerPlugin?.('App')||cap.Plugins?.App):null;
 if(app)app.addListener('backButton',({canGoBack})=>{if(document.querySelector('dialog[open]'))document.querySelector('dialog[open]').close();else if(canGoBack)history.back();else if(location.hash!=='#study')location.hash='study';else app.exitApp()});
})();

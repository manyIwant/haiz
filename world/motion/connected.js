/* HAIZ Fieldnotes -> real modules. A navigation bridge, NOT an auth shortcut. */
(() => {
  const app = document.getElementById('app');
  const top = document.querySelector('.topbar .top-actions');
  if (!app || !top || document.getElementById('haiz-connect')) return;
  const store = 'haiz.lucent.preferences.v1';
  const saveAppearance = () => {
    const theme = app.dataset.theme;
    if (!['porcelain','obsidian','ocean'].includes(theme)) return;
    try {
      const prev = JSON.parse(localStorage.getItem(store) || '{}');
      if (prev.theme === theme) return;
      localStorage.setItem(store, JSON.stringify({...prev, theme}));
    } catch {}
  };
  const mo = new MutationObserver(saveAppearance);
  mo.observe(app, {attributes:true, attributeFilter:['data-theme']});
  saveAppearance();

  const trigger = document.createElement('button');
  trigger.type = 'button'; trigger.id='haiz-connect';
  trigger.className='mini-action haiz-connect-trigger';
  trigger.textContent='连接';
  trigger.title='打开真实书桌或授权的跨端工作台';
  trigger.setAttribute('aria-haspopup','dialog');
  top.prepend(trigger);

  const dialog = document.createElement('dialog');dialog.id='haiz-real-services';dialog.className='haiz-real-dialog';
  dialog.setAttribute('aria-labelledby','haiz-real-title');
  dialog.innerHTML = `<div class="haiz-real-heading"><div><small>HAIZ / CONNECT</small><h2 id="haiz-real-title">打开真实功能</h2></div><button type="button" id="haiz-real-close" aria-label="关闭">×</button></div>
    <p class="haiz-real-info">当前 Fieldnotes 是设计演示。下方入口打开已有功能，账号权限仍由真实服务端校验。</p>
    <div class="haiz-real-links">
      <a href="../index.html#study"><strong>本机书桌 <span>↗</span></strong><small>使用原有学习记录；不会自动导入本页演示笔记</small></a>
      <a href="../index.html#atlas"><strong>校园地图 <span>↗</span></strong><small>打开仓库现有校园地图与地点数据</small></a>
      <a href="../flow/"><strong>HAIZ Flow <span>↗</span></strong><small>同源服务连接后登录；否则仅有登录演示</small></a>
    </div>
    <label class="haiz-real-label" for="haiz-remote-origin">异地设备使用授权的 HTTPS 服务</label>
    <input id="haiz-remote-origin" type="url" inputmode="url" spellcheck="false" placeholder="https://your-authorized-server.example">
    <button type="button" id="haiz-open-remote" class="haiz-real-primary">在浏览器打开同步工作台 ↗</button>
    <p class="haiz-real-warning" id="haiz-real-status" role="status">不在 URL 中携带邀请码或密码；手机的 localhost 不是电脑上的服务器。</p>
    <button type="button" id="haiz-probe-api" class="haiz-real-probe">检查当前设备上的 Flow API 连接</button>
    <div class="haiz-real-bottom"><button type="button" id="haiz-export-demo">导出本页笔记</button><span>仅导出，不自动上传</span></div>`;
  document.body.append(dialog);
  const close=()=>dialog.close();
  trigger.addEventListener('click',()=>dialog.showModal());
  dialog.querySelector('#haiz-real-close').addEventListener('click',close);
  dialog.addEventListener('click',e=>{if(e.target===dialog)close()});
  const status=dialog.querySelector('#haiz-real-status');
  dialog.querySelector('#haiz-open-remote').addEventListener('click',()=>{
    const raw=dialog.querySelector('#haiz-remote-origin').value.trim();
    let u;try {u=new URL(raw);if(u.protocol!=='https:' || u.username || u.password || u.search || u.hash || u.pathname!=='/')throw Error('url');}
    catch {status.textContent='请输入获得授权的 HTTPS 服务根地址（如 https://example.com/）。';return;}
    status.textContent='打开外部服务；登录与访问权限由服务器校验。';
    const dest = new URL('/world/flow/', u.origin).href;
    const a=document.createElement('a');a.href=dest;a.target='_blank';a.rel='noopener noreferrer';a.click();
  });
  dialog.querySelector('#haiz-probe-api').addEventListener('click',async()=>{
    status.textContent='正在检测同源 Flow API（不会上传本页笔记）…';
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),3500);
    try{
      const r=await fetch('/api/flow/me',{method:'GET',credentials:'same-origin',cache:'no-store',headers:{'Accept':'application/json'},signal:controller.signal});
      const type=r.headers.get('content-type')||'';
      if(!type.includes('application/json')){status.textContent='未确认 Flow API：响应不是 JSON，可能只是静态网页或安装包。';return;}
      if(r.status===401||r.status===403){status.textContent='Flow API 可以响应；当前设备尚未通过服务端身份验证。';return;}
      if(!r.ok){status.textContent='Flow API 有响应，但返回 HTTP '+r.status+'；请检查服务器状态。';return;}
      const body=await r.json();
      if(body && (body.user||body.role||body.me)){status.textContent='已联系 Flow 服务并收到身份状态。权限仍由服务器控制。';}
      else status.textContent='API 返回成功，但身份字段未符合预期；请在 Flow 登录页确认。';
    }catch{status.textContent='无法联系同源 Flow API。纯静态网页和离线 APK 没有自动连接到学校服务器。';}
    finally{clearTimeout(timer);}
  });
  dialog.querySelector('#haiz-export-demo').addEventListener('click',()=>{
    const text = (()=>{try{return localStorage.getItem('haiz-editorial-note')||''}catch{return ''}})();
    if(!text.trim()){status.textContent='当前没有可导出的本页笔记。';return;}
    const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='HAIZ-Fieldnotes-local-note.txt';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
    status.textContent='笔记已导出为本机文本。未发送到服务器。';
  });
})();

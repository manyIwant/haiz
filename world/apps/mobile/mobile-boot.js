/* The guard precedes ES modules; it never clears user storage or retries automatically. */
(() => {
  const startedAt = performance.now();
  const events = [];
  const state = { status: 'loading', category: 'route_pending', route: '', elapsedMs: 0, events };
  window.HAIZ_BOOT = state;
  const allowedRoutes = /^[a-z-]{1,30}$/;
  const safeFile = value => {
    try { return new URL(value, location.href).pathname.split('/').pop().replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 60); }
    catch { return 'unknown'; }
  };
  const record = (category, file = '') => {
    events.push({ category, file: safeFile(file), atMs: Math.round(performance.now() - startedAt) });
    if (events.length > 12) events.shift();
    state.category = category;
    console.error('[HAIZ startup]', category, safeFile(file));
  };
  const style = document.createElement('style');
  style.textContent = '#haiz-native-boot{position:fixed;inset:0;z-index:2147483640;display:grid;place-items:center;background:#f3f1ec;color:#242a38;font:16px/1.65 system-ui,-apple-system,sans-serif;padding:24px;text-align:center;overflow:auto}#haiz-native-boot>div{max-width:420px}#haiz-native-boot h1{font-size:28px;margin:0 0 12px}#haiz-native-boot p{color:#4e586c}#haiz-native-boot button{min-height:44px;margin:5px;padding:10px 16px;background:#3c5abc;color:#fff;border:0;border-radius:12px;font:inherit}#haiz-native-boot button.secondary{background:#e3e5ed;color:#242a38}#haiz-native-boot button:focus-visible{outline:3px solid #cf7156;outline-offset:3px}#haiz-native-boot small{display:block;margin-top:16px;overflow-wrap:anywhere}#haiz-native-boot textarea{box-sizing:border-box;width:100%;min-height:120px;font:13px monospace;padding:12px}#haiz-native-boot [hidden]{display:none!important}@media(prefers-color-scheme:dark){#haiz-native-boot{background:#0e121d;color:#f0f2f8}#haiz-native-boot p{color:#c2c8d8}#haiz-native-boot button{background:#abbcff;color:#0e121d}}';
  document.head.append(style);
  const splash = document.createElement('section');
  splash.id = 'haiz-native-boot';
  splash.dataset.state = 'loading';
  splash.setAttribute('aria-label', 'HAIZ 启动与恢复');
  splash.innerHTML = '<div><h1>HAIZ</h1><p id="haiz-boot-message" role="status">正在打开书桌…</p><div><button id="haiz-boot-offline" class="secondary" type="button">导出原始恢复副本</button><button id="haiz-boot-retry" type="button" hidden>重试启动</button><button id="haiz-boot-copy" type="button" class="secondary" hidden>复制诊断</button></div><small id="haiz-boot-detail">记录保留在这台设备。恢复操作不会清空数据。</small><textarea id="haiz-boot-diagnostic" aria-label="不含私人内容的诊断" readonly hidden></textarea></div>';
  document.body.append(splash);
  const message = splash.querySelector('#haiz-boot-message');
  const detail = splash.querySelector('#haiz-boot-detail');
  const retry = splash.querySelector('#haiz-boot-retry');
  let disposed = false;
  const diagnostics = () => JSON.stringify({
    version: 1, status: state.status, category: state.category,
    route: allowedRoutes.test(location.hash.slice(1)) ? location.hash.slice(1) : 'unknown',
    elapsedMs: Math.round(performance.now() - startedAt), online: navigator.onLine,
    platform: window.Capacitor?.getPlatform?.() || 'web-test',
    events: events.slice(),
  }, null, 2);
  const onError = event => {
    if (event.target && event.target !== window) {
      const media = ['VIDEO', 'AUDIO'].includes(event.target.tagName);
      record(media ? 'media_load_failed' : 'resource_load_failed', event.target.src || event.target.href || '');
    } else record('javascript_exception', event.filename || 'module');
  };
  window.addEventListener('error', onError, true);
  window.addEventListener('unhandledrejection', () => record(navigator.onLine ? 'promise_rejected' : 'network_unavailable', 'module'));
  const ready = () => {
    const main = document.querySelector('#main[data-testid="haiz-main"]');
    return document.documentElement.dataset.haizReady === 'true' && main && main.children.length > 0;
  };
  const finish = () => {
    if (disposed || !ready()) return;
    disposed = true;
    clearTimeout(timeout);
    observer.disconnect();
    state.status = 'ready';
    state.category = 'route_ready';
    state.route = document.documentElement.dataset.haizRoute;
    state.elapsedMs = Math.round(performance.now() - startedAt);
    splash.remove();
    style.remove();
  };
  splash.querySelector('#haiz-boot-copy').onclick = async () => {
    const text = diagnostics();
    const field = splash.querySelector('#haiz-boot-diagnostic');
    field.value = text;
    field.hidden = false;
    try { await navigator.clipboard.writeText(text); detail.textContent = '诊断已复制，不含笔记、账号或链接参数。'; }
    catch { field.focus(); field.select(); detail.textContent = '请手动复制下方诊断，不含私人记录。'; }
  };
  splash.querySelector('#haiz-boot-offline').onclick = () => {
    try {
      const records = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (/^haiz[.-]/i.test(key) && !/(token|credential|identity)/i.test(key)) records[key] = localStorage.getItem(key);
      }
      const blob = new Blob([JSON.stringify({ format: 'haiz-recovery-raw-v1', records }, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url; link.download = 'HAIZ-local-recovery.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      detail.textContent = '已请求导出原始恢复副本；此格式需技术恢复，不能直接导入学习工具。请确认文件已保存，勿公开分享。';
    } catch { detail.textContent = '系统暂不允许读取或导出。请保留应用数据，查看原生日志；不要卸载。'; }
  };
  retry.onclick = () => { retry.disabled = true; location.reload(); };
  const observer = new MutationObserver(finish);
  observer.observe(document.querySelector('#app') || document.body, { childList: true, subtree: true, attributes: true });
  const timeout = setTimeout(() => {
    if (ready()) return finish();
    state.status = 'error';
    if (!events.length) state.category = 'route_not_initialized';
    splash.dataset.state = 'error';
    message.textContent = '书桌未完成加载。本机记录没有被清除。';
    const labels = { resource_load_failed: '打包资源无法读取', javascript_exception: '页面脚本异常', promise_rejected: '页面初始化失败', network_unavailable: '网络资源不可用', media_load_failed: '影片或音频加载失败', route_not_initialized: '主路由未初始化' };
    detail.textContent = (labels[state.category] || '启动异常') + '。可以重试或导出记录；若应用进程退出，请检查原生日志。';
    retry.hidden = false;
    splash.querySelector('#haiz-boot-copy').hidden = false;
  }, 10000);
  window.addEventListener('haiz:route-ready', finish);
  finish();
})();

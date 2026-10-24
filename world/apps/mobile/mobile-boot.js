/* Native web startup guard: same code runs inside Android WebView and iOS WKWebView. */
(() => {
  const style = document.createElement('style');
  style.textContent = '#haiz-native-boot{position:fixed;inset:0;z-index:2147483640;display:grid;place-items:center;background:#f5f3ea;color:#1e372f;font:15px/1.6 system-ui,-apple-system,sans-serif;padding:28px;text-align:center}#haiz-native-boot .mark{margin:auto auto 22px;display:block;width:76px;height:76px;border:5px solid #214337;border-radius:40px 40px 12px 12px;position:relative;box-sizing:border-box}#haiz-native-boot .mark:after{content:"";display:block;width:14px;height:14px;border-radius:50%;background:#b88b53;position:absolute;top:21px;left:26px}#haiz-native-boot h1{font-size:20px;letter-spacing:.18em;margin:0;font-weight:650}#haiz-native-boot p{max-width:340px;margin:9px auto;color:#617067}#haiz-native-boot .boot-actions{display:none;margin-top:24px}#haiz-native-boot button{background:#244738;color:#fff;border:0;border-radius:12px;padding:11px 24px;font:inherit}#haiz-native-boot small{display:block;margin-top:16px;color:#52625b;max-width:330px;overflow-wrap:anywhere}';
  document.head.append(style);
  const splash = document.createElement('section');
  splash.id = 'haiz-native-boot';
  splash.setAttribute('role', 'status');
  splash.innerHTML = '<div><span class="mark" aria-hidden="true"></span><h1>HAIZ STUDY</h1><p id="haiz-boot-message">正在打开你的校园书桌…</p><div class="boot-actions"><button type="button" id="haiz-boot-retry">重新打开</button></div><small id="haiz-boot-detail"></small></div>';
  document.body.append(splash);
  const message = splash.querySelector('#haiz-boot-message');
  const detail = splash.querySelector('#haiz-boot-detail');
  const retry = splash.querySelector('#haiz-boot-retry');
  let firstError = '';
  let complete = false;
  let elapsed = 0;
  const ready = () => {
    const main = document.querySelector('#app #main');
    return !!(main && main.textContent && main.textContent.trim().length > 8);
  };
  const cleanup = () => {
    if (complete) return;
    complete = true;
    clearInterval(watch);
    splash.remove();
    style.remove();
  };
  const capture = value => {
    if (!firstError) firstError = String(value || 'JavaScript initialization failed').slice(0, 220);
    console.error('[HAIZ native boot]', firstError);
  };
  window.addEventListener('error', event => {
    if (event.target === window || event.error) capture(event.message || event.error);
  }, true);
  window.addEventListener('unhandledrejection', event => capture(event.reason?.message || event.reason || 'Unhandled rejection'));
  retry.addEventListener('click', () => location.replace('./index.html#study'));
  const watch = setInterval(() => {
    if (ready()) return cleanup();
    elapsed += 200;
    if (elapsed >= 10000) {
      clearInterval(watch);
      message.textContent = '应用没有正常完成启动。你的本机学习记录没有被清除。';
      detail.textContent = firstError ? '诊断信息：' + firstError : '诊断信息：主页面未加载。请保存此画面并查看原生日志。';
      splash.querySelector('.boot-actions').style.display = 'block';
    }
  }, 200);
  if (ready()) cleanup();
})();
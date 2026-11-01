(() => {
  'use strict';
  const base = document.baseURI;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches ||
    navigator.standalone === true;
  let updateRegistration = null;
  let reloadOnChange = false;
  let banner = null;

  function showNotice(message, actionText, action) {
    if (banner) banner.remove();
    const notice = document.createElement('aside');
    notice.className = 'haiz-pwa-notice';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-label', 'HAIZ Pocket 提示');
    const label = document.createElement('span');
    label.className = 'haiz-pwa-notice-text';
    label.textContent = message;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'haiz-pwa-notice-action';
    button.textContent = actionText;
    button.addEventListener('click', action);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'haiz-pwa-notice-close';
    close.setAttribute('aria-label', '关闭提示');
    close.textContent = '×';
    close.addEventListener('click', () => {
      if (banner === notice) banner = null;
      notice.remove();
    });
    notice.append(label, button, close);
    document.body.append(notice);
    banner = notice;
  }

  function updateAvailable(registration) {
    if (!navigator.serviceWorker.controller || !registration.waiting) return;
    updateRegistration = registration;
    showNotice('HAIZ 有新版本。现在更新不会清除浏览器中的个人记录。',
      '更新并重新打开', () => {
        const worker = updateRegistration?.waiting;
        if (!worker) return;
        reloadOnChange = true;
        worker.postMessage({ type: 'HAIZ_APPLY_UPDATE' });
      });
  }

  function installGuide() {
    if (!isIOS || standalone() || banner) return;
    try {
      if (sessionStorage.getItem('haiz-install-guide-dismissed') === '1') return;
      sessionStorage.setItem('haiz-install-guide-dismissed', '1');
    } catch (_) { /* storage may be unavailable in private mode */ }
    showNotice('可免费将 HAIZ 添加到 iPhone 主屏幕，像 App 一样打开。',
      '安装方法', () => {
        location.href = new URL('install.html', base).href;
      });
  }

  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    if (isIOS) window.addEventListener('load', () => setTimeout(installGuide, 2000));
    return;
  }
  window.addEventListener('load', async () => {
    try {
      const url = new URL('pocket-sw.js', base);
      const registration = await navigator.serviceWorker.register(url.href, {
        scope: new URL('./', base).pathname,
        updateViaCache: 'none'
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloadOnChange) location.reload();
      });
      if (registration.waiting) updateAvailable(registration);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed') updateAvailable(registration);
        });
      });

      let lastCheck = 0;
      const maybeCheck = () => {
        if (document.visibilityState === 'hidden') return;
        const now = Date.now();
        if (now - lastCheck < 15 * 60 * 1000) return;
        lastCheck = now;
        registration.update().catch(() => {});
      };
      window.addEventListener('focus', maybeCheck);
      document.addEventListener('visibilitychange', maybeCheck);
      if (!registration.waiting) setTimeout(installGuide, 2400);
    } catch (error) {
      console.info('HAIZ offline cache unavailable:', error);
      setTimeout(installGuide, 2400);
    }
  });
})();

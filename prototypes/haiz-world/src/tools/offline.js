import { useEffect, useState } from 'react';

export function useOffline() {
  const [status, setStatus] = useState(import.meta.env.PROD ? '正在准备离线使用' : '开发预览：尚未启用离线缓存');
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    addEventListener('online', updateOnline);
    addEventListener('offline', updateOnline);
    let disposed = false;
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/tools/sw.js', { scope: '/tools/' }).then(registration => {
        const installed = () => {
          if (!disposed) setStatus('离线已就绪');
        };
        if (registration.active) installed();
        const watch = worker => worker?.addEventListener('statechange', () => {
          if (worker.state === 'activated') installed();
          if (worker.state === 'redundant' && !disposed) setStatus('离线准备失败，请联网重新打开');
          if (worker.state === 'installed' && navigator.serviceWorker.controller && !disposed) setStatus('新版本已就绪，关闭本机其他 Tools 标签页后重开可更新');
        });
        watch(registration.installing);
        registration.addEventListener('updatefound', () => watch(registration.installing));
      }).catch(() => { if (!disposed) setStatus('离线未就绪，本机记录仍可保存'); });
    } else if (import.meta.env.PROD) setStatus('此浏览器不支持离线页面缓存');
    return () => { disposed = true; removeEventListener('online', updateOnline); removeEventListener('offline', updateOnline); };
  }, []);
  return { status, online };
}

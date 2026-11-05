// Bind legacy campus and Flow pages to the server-verified principal of this HTML.
(() => {
  const owner = document.currentScript?.dataset.haizUser;
  if (!owner) return;
  const original = window.fetch.bind(window); let locked = false;
  const target = '/account/?next=' + encodeURIComponent(location.pathname + location.search);
  const lock = () => {
    if (locked) return; locked = true;
    document.documentElement.style.visibility = 'hidden';
    document.body?.replaceChildren(); location.replace(target);
  };
  // Legacy local notes and settings must not become shared data on a shared browser.
  const storagePrefix = 'haiz.account.' + owner + ':', storageAreas = new Map();
  const scopeStorage = storage => {
    const prefix = storagePrefix;
    const keys = () => Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(key => key?.startsWith(prefix));
    return new Proxy({}, {
      get(_target, key) {
        if (key === 'getItem') return name => storage.getItem(prefix + name);
        if (key === 'setItem') return (name, value) => storage.setItem(prefix + name, value);
        if (key === 'removeItem') return name => storage.removeItem(prefix + name);
        if (key === 'clear') return () => keys().forEach(name => storage.removeItem(name));
        if (key === 'key') return i => keys()[i]?.slice(prefix.length) ?? null;
        if (key === 'length') return keys().length;
        if (typeof key === 'symbol') return undefined;
        return storage.getItem(prefix + key) ?? undefined;
      },
      set(_target, key, value) { storage.setItem(prefix + key, value); return true; },
      deleteProperty(_target, key) { storage.removeItem(prefix + key); return true; },
      ownKeys: () => keys().map(key => key.slice(prefix.length)),
      getOwnPropertyDescriptor(_target, key) {
        const value = storage.getItem(prefix + key);
        return value === null ? undefined : { value, enumerable: true, configurable: true, writable: true };
      },
    });
  };
  for (const name of ['localStorage', 'sessionStorage']) {
    let storage;
    try { storage = window[name]; } catch { continue; }
    try { const scoped = scopeStorage(storage); Object.defineProperty(window, name, { configurable: true, get: () => scoped }); if (!storageAreas.has(storage)) storageAreas.set(storage, scoped); }
    catch { lock(); return; }
  }
  const forwardedStorageEvent = Symbol('haiz-storage-event');
  window.addEventListener('storage', event => {
    if (event[forwardedStorageEvent]) return;
    event.stopImmediatePropagation();
    if (!storageAreas.has(event.storageArea) || (event.key !== null && !event.key.startsWith(storagePrefix))) return;
    const normalized = new Event('storage');
    Object.defineProperties(normalized, {
      [forwardedStorageEvent]: { value: true },
      key: { value: event.key === null ? null : event.key.slice(storagePrefix.length) },
      oldValue: { value: event.oldValue }, newValue: { value: event.newValue }, url: { value: event.url },
      storageArea: { value: storageAreas.get(event.storageArea) },
    });
    window.dispatchEvent(normalized);
  }, true);
  window.fetch = async (input, options = {}) => {
    const url = new URL(input instanceof Request ? input.url : input, location.href);
    const internal = url.origin === location.origin && /^\/api\/(v1|flow)\//.test(url.pathname);
    if (!internal || ['/api/v1/auth/register', '/api/v1/auth/login', '/api/flow/login', '/api/v1/auth/config'].includes(url.pathname)) return original(input, options);
    if (locked) throw new Error('账号已变化，请重新登录');
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(options.headers).forEach((value, key) => headers.set(key, value));
    headers.set('X-HAIZ-User', owner);
    const response = await original(input, { ...options, headers });
    if (response.status === 401 || (response.headers.get('X-HAIZ-User') && response.headers.get('X-HAIZ-User') !== owner)) {
      lock(); throw new Error('账号已变化，请重新登录');
    }
    return response;
  };
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('haiz-account-state') : null;
  if (channel) channel.onmessage = event => { if (event.data?.type === 'identity-changed') lock(); };
  const verify = async () => { try { const response = await window.fetch('/api/v1/auth/me'); if (!response.ok) lock(); } catch { lock(); } };
  setInterval(() => { if (!document.hidden) void verify(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void verify(); });
  window.addEventListener('pagehide', () => { document.documentElement.style.visibility = 'hidden'; document.body?.replaceChildren(); });
  window.addEventListener('pageshow', event => { if (event.persisted) location.replace(target); });
})();

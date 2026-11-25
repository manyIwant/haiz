// HAIZ Campus Toybox — Cloudflare Turnstile browser provider.
// Lazily loads the Turnstile explicit script once, renders in `execution: 'execute'`
// and `appearance: 'interaction-only'` mode so it stays unobtrusive unless challenged.
import { ANTIBOT } from '../../../../shared/protocol.js';

const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise = null;

function loadTurnstileScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Turnstile requires a browser'));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = TURNSTILE_SRC;
      s.async = true;
      s.defer = true;
      s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile global missing')));
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error('Failed to load Cloudflare Turnstile script'));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export class TurnstileProvider {
  constructor({ timeoutMs = 15_000 } = {}) {
    this.name = ANTIBOT.providers.TURNSTILE;
    this._timeoutMs = timeoutMs;
    this._widgetId = null;
    this._pending = null;
  }

  async prepare({ container, siteKey, action, cData, signal } = {}) {
    if (!container || !siteKey) throw new Error('TurnstileProvider.prepare requires container and siteKey');
    const ts = await loadTurnstileScript();
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    this.destroy();
    this._widgetId = ts.render(container, {
      sitekey: siteKey,
      action,
      cData,
      execution: 'execute',
      appearance: 'interaction-only',
      size: 'flexible',
      callback: (token) => {
        const p = this._pending;
        this._pending = null;
        p?.resolve(token);
      },
      'error-callback': (code) => {
        const p = this._pending;
        this._pending = null;
        p?.reject(new Error(`Turnstile error: ${code || 'unknown'}`));
      },
      'expired-callback': () => {
        const p = this._pending;
        this._pending = null;
        p?.reject(new Error('Turnstile token expired'));
      },
    });
  }

  async getToken({ signal } = {}) {
    if (this._widgetId == null || !window.turnstile) throw new Error('TurnstileProvider not prepared');
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending = null;
        reject(new Error('Turnstile token timed out'));
      }, this._timeoutMs);
      const onAbort = () => {
        clearTimeout(timer);
        this._pending = null;
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      this._pending = {
        resolve: (tok) => {
          clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
          resolve(tok);
        },
        reject: (err) => {
          clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
          reject(err);
        },
      };
      window.turnstile.execute(this._widgetId);
    });
  }

  reset() {
    if (this._widgetId != null && window.turnstile) {
      try { window.turnstile.reset(this._widgetId); } catch {}
    }
  }

  destroy() {
    if (this._widgetId != null && window.turnstile) {
      try { window.turnstile.remove(this._widgetId); } catch {}
    }
    this._widgetId = null;
    this._pending = null;
  }
}

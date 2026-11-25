// HAIZ Campus Toybox — Cloudflare Turnstile server-side verifier.
// Calls https://challenges.cloudflare.com/turnstile/v0/siteverify with timeout, idempotency_key,
// and strict action / cdata / hostname verification.
import { ANTIBOT } from '../shared/protocol.js';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export class TurnstileVerifier {
  /**
   * @param {object} opts
   * @param {string} opts.secretKey
   * @param {string} opts.siteKey
   * @param {string[]} [opts.allowedHostnames=[]]
   * @param {number} [opts.timeoutMs=5000]
   * @param {typeof fetch} [opts.fetchImpl=globalThis.fetch]
   */
  constructor({ secretKey, siteKey, allowedHostnames = [], timeoutMs = 5000, fetchImpl = globalThis.fetch } = {}) {
    if (typeof secretKey !== 'string' || secretKey.length < 8) {
      throw new Error('TurnstileVerifier: secretKey is required');
    }
    if (typeof siteKey !== 'string' || siteKey.length < 4) {
      throw new Error('TurnstileVerifier: siteKey is required');
    }
    this.provider = ANTIBOT.providers.TURNSTILE;
    this.isMock = false;
    this.siteKey = siteKey;
    this._secretKey = secretKey;
    this._allowedHostnames = new Set(allowedHostnames.map((h) => String(h).trim().toLowerCase()).filter(Boolean));
    this._timeoutMs = timeoutMs;
    this._fetch = fetchImpl;
  }

  async verify({ token, ip, action, cData, idempotencyKey } = {}) {
    if (typeof token !== 'string' || !token) return { ok: false, reason: 'missing_token' };

    const body = new URLSearchParams();
    body.set('secret', this._secretKey);
    body.set('response', token);
    if (ip) body.set('remoteip', ip);
    if (idempotencyKey) body.set('idempotency_key', idempotencyKey);

    let res;
    try {
      res = await this._fetch(SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: AbortSignal.timeout(this._timeoutMs),
      });
    } catch {
      return { ok: false, unavailable: true, reason: 'network_or_timeout' };
    }

    if (!res.ok) return { ok: false, unavailable: true, reason: `http_${res.status}` };

    let data;
    try {
      data = await res.json();
    } catch {
      return { ok: false, unavailable: true, reason: 'invalid_json' };
    }

    if (!data || data.success !== true) {
      return { ok: false, reason: 'turnstile_rejected', codes: data?.['error-codes'] || [] };
    }
    if (action && data.action && data.action !== action) {
      return { ok: false, reason: 'action_mismatch' };
    }
    if (cData && data.cdata && data.cdata !== cData) {
      return { ok: false, reason: 'cdata_mismatch' };
    }
    if (this._allowedHostnames.size > 0) {
      const host = String(data.hostname || '').toLowerCase();
      if (!this._allowedHostnames.has(host)) {
        return { ok: false, reason: 'hostname_not_allowed' };
      }
    }
    return { ok: true };
  }
}

// HAIZ Campus Toybox — production HTTP ChallengeAdapter.
// Communicates with the backend endpoints defined in shared/CONTRACT.md.
// Never synthesizes success client-side; enforces timeouts & AbortSignal cancellation.
import { ATTEMPT_STATUS } from '../../../shared/protocol.js';

export class ToyboxNetworkError extends Error {
  constructor(message, { code = 'NETWORK_ERROR', status = 0, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'ToyboxNetworkError';
    this.code = code;
    this.status = status;
  }
}

function combineSignals(callerSignal, timeoutMs) {
  const timeoutSignal = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(timeoutMs) : null;
  if (callerSignal && timeoutSignal && typeof AbortSignal.any === 'function') {
    return { signal: AbortSignal.any([callerSignal, timeoutSignal]), cleanup: () => {} };
  }
  const ac = new AbortController();
  const onAbort = () => ac.abort(callerSignal?.reason || new DOMException('Aborted', 'AbortError'));
  if (callerSignal?.aborted) {
    onAbort();
    return { signal: ac.signal, cleanup: () => {} };
  }
  callerSignal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => ac.abort(new DOMException('Timeout', 'TimeoutError')), timeoutMs);
  return {
    signal: ac.signal,
    cleanup: () => {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', onAbort);
    },
  };
}

export class HttpAdapter {
  /**
   * @param {{ baseUrl?: string, fetchImpl?: typeof fetch, timeoutMs?: number }} [opts]
   */
  constructor({ baseUrl = '/api/toybox', fetchImpl = globalThis.fetch?.bind(globalThis), timeoutMs = 10_000 } = {}) {
    this._baseUrl = String(baseUrl).replace(/\/+$/, '');
    this._fetch = fetchImpl;
    this._timeoutMs = timeoutMs;
    this.isDemo = false;
  }

  async _request(path, { method = 'GET', body, signal } = {}) {
    const { signal: combined, cleanup } = combineSignals(signal, this._timeoutMs);
    try {
      const res = await this._fetch(`${this._baseUrl}${path}`, {
        method,
        credentials: 'include',
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: combined,
      });
      return res;
    } catch (err) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (err?.name === 'TimeoutError') {
        throw new ToyboxNetworkError('Verification request timed out', { code: 'TIMEOUT', cause: err });
      }
      throw new ToyboxNetworkError('Network error while contacting verification server', { code: 'NETWORK', cause: err });
    } finally {
      cleanup();
    }
  }

  async createChallenge({ mode = 'game', signal } = {}) {
    const res = await this._request('/challenges', { method: 'POST', body: { mode }, signal });
    if (res.status === 429) {
      const ra = Number(res.headers.get('Retry-After') || 5) * 1000;
      throw new ToyboxNetworkError('Rate limited', { code: 'RATE_LIMITED', status: 429, cause: { retryAfterMs: ra } });
    }
    if (!res.ok) {
      throw new ToyboxNetworkError(`Server returned ${res.status}`, { code: 'HTTP_ERROR', status: res.status });
    }
    const data = await res.json();
    this.isDemo = Boolean(data.demo);
    return data;
  }

  async submitAttempt({ challengeId, nonce, pick, antiBotToken, elapsedMs, signal } = {}) {
    const res = await this._request(`/challenges/${encodeURIComponent(challengeId)}/attempts`, {
      method: 'POST',
      body: { nonce, pick, antiBotToken, elapsedMs },
      signal,
    });
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}));
      const retryAfterMs = body.retryAfterMs || Number(res.headers.get('Retry-After') || 5) * 1000;
      return { status: ATTEMPT_STATUS.RATE_LIMITED, retryAfterMs, demo: Boolean(body.demo ?? this.isDemo) };
    }
    if (!res.ok) {
      throw new ToyboxNetworkError(`Server returned ${res.status}`, { code: 'HTTP_ERROR', status: res.status });
    }
    const data = await res.json();
    this.isDemo = Boolean(data.demo);
    return data;
  }

  async cancelChallenge({ challengeId, signal } = {}) {
    try {
      await this._request(`/challenges/${encodeURIComponent(challengeId)}`, { method: 'DELETE', signal });
    } catch {
      // Best-effort cancellation
    }
  }
}

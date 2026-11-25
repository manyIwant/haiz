// HAIZ Campus Toybox — in-browser MockAdapter (DEMO ONLY).
// Runs the exact same ChallengeService logic locally with demo:true so local previews,
// offline demos and art reviews work without a backend — while remaining impossible to
// confuse with a trusted production authorization.
import { ChallengeService } from '../../../shared/challenge-core.js';
import { MemoryStore } from '../../../shared/memory-store.js';
import { MockAntiBotVerifier } from '../../../shared/antibot-verifiers.js';
import { ID_BYTES, randomId } from '../../../shared/protocol.js';

export function assertNotProduction() {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
  if (env?.PROD && !env?.VITE_TOYBOX_ALLOW_DEMO) {
    throw new Error(
      'MockAdapter cannot be used in a production build unless VITE_TOYBOX_ALLOW_DEMO is explicitly enabled.'
    );
  }
}

function abortableDelay(ms, signal) {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  if (!ms || ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export class MockAdapter {
  /**
   * @param {{ latencyMs?: number, clock?: () => number, minElapsedMs?: number, allowInProd?: boolean }} [opts]
   */
  constructor({ latencyMs = 160, clock = () => Date.now(), minElapsedMs = 400, allowInProd = false } = {}) {
    if (!allowInProd) assertNotProduction();
    this.isDemo = true;
    this._latencyMs = latencyMs;
    this._sessionId = randomId(ID_BYTES.sessionId);
    this._service = new ChallengeService({
      demo: true,
      store: new MemoryStore({ clock }),
      antiBotVerifier: new MockAntiBotVerifier(),
      clock,
      minElapsedMs,
    });
  }

  async createChallenge({ mode = 'game', signal } = {}) {
    await abortableDelay(this._latencyMs, signal);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const out = await this._service.createChallenge({ sessionId: this._sessionId, mode });
    if (!out.ok) throw new Error(`MockAdapter.createChallenge failed: ${out.status}`);
    return out.challenge;
  }

  async submitAttempt({ challengeId, nonce, pick, antiBotToken, elapsedMs, signal } = {}) {
    await abortableDelay(this._latencyMs, signal);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return this._service.submitAttempt({
      sessionId: this._sessionId,
      challengeId,
      nonce,
      pick,
      antiBotToken,
      elapsedMs,
    });
  }

  async cancelChallenge({ challengeId, signal } = {}) {
    if (signal?.aborted) return;
    await this._service.cancelChallenge({ sessionId: this._sessionId, challengeId });
  }

  /** Demo helper to illustrate how a login backend consumes the passToken (always returns demo:true). */
  async consumeDemoPassToken(passToken) {
    return this._service.consumePassToken({ passToken, sessionId: this._sessionId });
  }
}

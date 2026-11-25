// HAIZ Campus Toybox — MockAntiBotProvider (DEMO ONLY).
// Pairs with MockAntiBotVerifier; returns the literal 'mock-antibot-token'.
import { ANTIBOT } from '../../../../shared/protocol.js';

export class MockAntiBotProvider {
  constructor({ delayMs = 80 } = {}) {
    this.name = ANTIBOT.providers.MOCK;
    this._delayMs = delayMs;
  }

  async prepare({ container } = {}) {
    this._container = container;
  }

  async getToken({ signal } = {}) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (this._delayMs > 0) {
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => {
          signal?.removeEventListener('abort', onAbort);
          resolve();
        }, this._delayMs);
        const onAbort = () => {
          clearTimeout(t);
          reject(new DOMException('Aborted', 'AbortError'));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
      });
    }
    return ANTIBOT.mockToken;
  }

  reset() {}
  destroy() {
    this._container = null;
  }
}

// HAIZ Campus Toybox — adapter & anti-bot provider factory.
import { MockAdapter, assertNotProduction } from './MockAdapter.js';
import { HttpAdapter, ToyboxNetworkError } from './HttpAdapter.js';
import { MockAntiBotProvider } from './antibot/MockAntiBotProvider.js';
import { TurnstileProvider } from './antibot/TurnstileProvider.js';
import { ANTIBOT } from '../../../shared/protocol.js';

export { MockAdapter, HttpAdapter, ToyboxNetworkError, MockAntiBotProvider, TurnstileProvider, assertNotProduction };

/**
 * Create a ChallengeAdapter from configuration.
 * @param {{ mode?: 'mock'|'http', baseUrl?: string, latencyMs?: number, allowInProd?: boolean }} [cfg]
 */
export function createAdapterFromConfig(cfg = {}) {
  const mode = cfg.mode || 'mock';
  if (mode === 'http') {
    return new HttpAdapter({ baseUrl: cfg.baseUrl, timeoutMs: cfg.timeoutMs });
  }
  return new MockAdapter({ latencyMs: cfg.latencyMs, allowInProd: cfg.allowInProd });
}

/** Instantiate the matching AntiBotProvider for a challenge's `antiBot.provider` field. */
export function createAntiBotProvider(providerName) {
  if (providerName === ANTIBOT.providers.TURNSTILE) return new TurnstileProvider();
  return new MockAntiBotProvider();
}

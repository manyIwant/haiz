// HAIZ Toybox — anti-bot verifier interface + the demo-only mock verifier.
//
// Server-side AntiBotVerifier interface (consumed by ChallengeService):
//
//   readonly provider: 'turnstile' | 'mock' | string   // echoed to the client as challenge.antiBot.provider
//   readonly siteKey?: string                          // public site key sent to the client (if any)
//   readonly isMock: boolean                           // production services refuse verifiers with isMock === true
//   verify({ token, ip, action, cData, idempotencyKey }): Promise<{ ok: boolean, reason?: string, unavailable?: boolean }>
//
// `unavailable: true` means the provider could not be reached (timeout, 5xx …). The service then fails
// CLOSED with status 'error' — it never lets an attempt through without a positive verification.
//
// To plug in another provider (GeeTest v4, 阿里云验证码 2.0, Tencent 天御 …) implement this interface on the
// server (call the vendor's server-side validate API) and the matching AntiBotProvider in the browser.

import { ANTIBOT } from './protocol.js';

/**
 * Demo-only verifier: accepts exactly the literal token 'mock-antibot-token'. Provides NO protection
 * whatsoever (the token is public) and is refused by ChallengeService({ demo: false }) and by the
 * production server.
 */
export class MockAntiBotVerifier {
  constructor() {
    this.provider = 'mock';
    this.siteKey = undefined;
    this.isMock = true;
  }

  async verify({ token } = {}) {
    return token === ANTIBOT.mockToken ? { ok: true } : { ok: false, reason: 'mock_token_mismatch' };
  }
}

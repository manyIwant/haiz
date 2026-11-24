/**
 * HAIZ Human Verification — Challenge Provider Adapters
 *
 * SECURITY BOUNDARY:
 * Frontend claw-machine interaction proves user engagement with the challenge,
 * NOT authoritative human verification. Final verification status MUST be
 * issued by a trusted backend (e.g., HAIZ Cloudflare Worker / Node.js ESM API).
 */

import { PLUSH_CATALOG } from '../models/plushCatalog.js';

/**
 * Sanitize telemetry so zero biometric or personal student data is ever collected.
 */
export function sanitizeSubmission(raw) {
  return {
    challengeId: String(raw.challengeId || ''),
    nonce: String(raw.nonce || ''),
    selectedPlushId: String(raw.selectedPlushId || ''),
    inputModality: ['joystick', 'keyboard', 'touch', 'accessible'].includes(raw.inputModality)
      ? raw.inputModality
      : 'joystick',
    elapsedMs: Math.max(0, Math.min(600000, Math.round(Number(raw.elapsedMs) || 0))),
    moveSamplesCount: Math.max(0, Math.min(5000, Math.round(Number(raw.moveSamplesCount) || 0))),
    attemptIndex: Math.max(1, Math.min(50, Math.round(Number(raw.attemptIndex) || 1))),
    clientTimestamp: Date.now()
  };
}

/**
 * MockChallengeAdapter — FOR LOCAL DEVELOPMENT & STANDALONE DEMO ONLY.
 * Never use in production authentication flows.
 */
export class MockChallengeAdapter {
  constructor(options = {}) {
    this.isMock = true;
    this.latencyMs = typeof options.latencyMs === 'number' ? options.latencyMs : 520;
    this.simulateServerError = Boolean(options.simulateServerError);
    this.forcedTargetId = options.forcedTargetId || null;
    this._activeChallenges = new Map();
    this._sequence = 0;
  }

  async fetchChallenge() {
    await this._delay(Math.min(260, this.latencyMs));
    this._sequence += 1;
    const pool = PLUSH_CATALOG;
    const target = this.forcedTargetId
      ? pool.find((p) => p.id === this.forcedTargetId) || pool[0]
      : pool[Math.floor(Math.random() * pool.length)];

    const challengeId = `mock_chl_${Date.now().toString(36)}_${this._sequence}`;
    const nonce = Math.random().toString(36).slice(2, 12);
    const expiresAt = Date.now() + 120000;

    this._activeChallenges.set(challengeId, {
      targetId: target.id,
      nonce,
      expiresAt,
      used: false
    });

    return {
      challengeId,
      nonce,
      targetPlushId: target.id,
      targetLabel: target.nameZh,
      promptText: `请带走那只「${target.nameZh}」。`,
      expiresAt,
      isMock: true
    };
  }

  async verifyAttempt(rawSubmission) {
    const submission = sanitizeSubmission(rawSubmission);
    await this._delay(this.latencyMs);

    if (this.simulateServerError) {
      return {
        verified: false,
        code: 'SERVER_UNAVAILABLE',
        message: '验证服务暂时不可用，请稍后重试。',
        retryable: true,
        isMock: true
      };
    }

    const record = this._activeChallenges.get(submission.challengeId);
    if (!record) {
      return {
        verified: false,
        code: 'CHALLENGE_NOT_FOUND',
        message: '验证会话已失效，请重新获取挑战。',
        retryable: true,
        isMock: true
      };
    }

    if (record.used) {
      return {
        verified: false,
        code: 'CHALLENGE_REPLAYED',
        message: '该次验证已使用，请开启新一轮挑战。',
        retryable: true,
        isMock: true
      };
    }

    if (Date.now() > record.expiresAt) {
      this._activeChallenges.delete(submission.challengeId);
      return {
        verified: false,
        code: 'CHALLENGE_EXPIRED',
        message: '本次验证已超时，请再试一次。',
        retryable: true,
        isMock: true
      };
    }

    if (record.nonce !== submission.nonce) {
      return {
        verified: false,
        code: 'INVALID_NONCE',
        message: '验证凭证校验失败。',
        retryable: true,
        isMock: true
      };
    }

    if (submission.selectedPlushId !== record.targetId) {
      return {
        verified: false,
        code: 'WRONG_TARGET',
        message: '抓到的玩偶与目标不一致，再试试看。',
        retryable: true,
        isMock: true
      };
    }

    record.used = true;
    const mockToken = `haiz_mock_v1.${btoa(`${submission.challengeId}:${record.nonce}`).replace(/=+$/, '')}`;

    return {
      verified: true,
      code: 'OK',
      message: '抓到啦，欢迎来到 HAIZ。',
      verificationToken: mockToken,
      challengeId: submission.challengeId,
      verifiedAt: new Date().toISOString(),
      isMock: true
    };
  }

  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * HttpChallengeAdapter — Production adapter for HAIZ Backend (Node.js ESM / Cloudflare Workers).
 * Expects:
 *   POST {baseUrl}/challenge  -> { challengeId, nonce, targetPlushId, promptText, expiresAt }
 *   POST {baseUrl}/verify     -> { verified, verificationToken?, code, message, retryable? }
 */
export class HttpChallengeAdapter {
  constructor(options = {}) {
    if (!options.baseUrl) {
      throw new Error('HttpChallengeAdapter requires a baseUrl.');
    }
    this.isMock = false;
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.headers = options.headers || {};
    this.credentials = options.credentials || 'same-origin';
    this.fetchImpl = options.fetch || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  }

  async fetchChallenge(signal) {
    const res = await this.fetchImpl(`${this.baseUrl}/challenge`, {
      method: 'POST',
      credentials: this.credentials,
      headers: { 'Content-Type': 'application/json', ...this.headers },
      body: JSON.stringify({ client: 'haiz-hv-web', version: '1.0.0' }),
      signal
    });
    if (!res.ok) {
      throw new Error(`Challenge fetch failed (${res.status})`);
    }
    const data = await res.json();
    if (!data || !data.challengeId || !data.targetPlushId) {
      throw new Error('Malformed challenge payload from server');
    }
    return { ...data, isMock: false };
  }

  async verifyAttempt(rawSubmission, signal) {
    const payload = sanitizeSubmission(rawSubmission);
    const res = await this.fetchImpl(`${this.baseUrl}/verify`, {
      method: 'POST',
      credentials: this.credentials,
      headers: { 'Content-Type': 'application/json', ...this.headers },
      body: JSON.stringify(payload),
      signal
    });
    if (!res.ok) {
      return {
        verified: false,
        code: `HTTP_${res.status}`,
        message: '服务端验证请求失败，请稍后重试。',
        retryable: true,
        isMock: false
      };
    }
    const data = await res.json();
    return {
      verified: Boolean(data && data.verified === true && data.verificationToken),
      code: data.code || (data.verified ? 'OK' : 'REJECTED'),
      message: data.message || (data.verified ? '抓到啦，欢迎来到 HAIZ。' : '验证未通过，请重试。'),
      verificationToken: data.verificationToken || null,
      challengeId: payload.challengeId,
      retryable: data.retryable !== false,
      isMock: false
    };
  }
}

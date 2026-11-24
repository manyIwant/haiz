/**
 * HAIZ Toybox V2 — Dual-Layer Verification Adapters & Session Isolation
 */

import { CHARACTER_REGISTRY } from '../toybox/characterRegistry.js';

export function sanitizeChallengeSubmission(raw) {
  return {
    challengeId: String(raw.challengeId || ''),
    nonce: String(raw.nonce || ''),
    selectedCharacterId: String(raw.selectedCharacterId || ''),
    antiBotToken: raw.antiBotToken ? String(raw.antiBotToken) : null,
    inputModality: ['joystick', 'keyboard', 'touch', 'accessible'].includes(raw.inputModality)
      ? raw.inputModality
      : 'joystick',
    elapsedMs: Math.max(0, Math.min(600000, Math.round(Number(raw.elapsedMs) || 0))),
    attemptIndex: Math.max(1, Math.min(50, Math.round(Number(raw.attemptIndex) || 1)))
  };
}

function shuffledIds(seedOffset = 0) {
  const ids = CHARACTER_REGISTRY.map((c) => c.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(((Math.random() + seedOffset) % 1) * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

export class MockToyboxAdapter {
  constructor(options = {}) {
    this.isMock = true;
    this.latencyMs = typeof options.latencyMs === 'number' ? options.latencyMs : 420;
    this.forcedTargetId = options.forcedTargetId || null;
    this.requireAntiBotToken = Boolean(options.requireAntiBotToken);
    this._sessions = new Map();
    this._seq = 0;
  }

  async fetchChallenge(signal) {
    await this._delay(Math.min(220, this.latencyMs), signal);
    this._seq += 1;
    const layoutOrder = this.forcedTargetId ? CHARACTER_REGISTRY.map((c) => c.id) : shuffledIds();
    const targetId = this.forcedTargetId || layoutOrder[Math.floor(Math.random() * layoutOrder.length)];
    const target = CHARACTER_REGISTRY.find((c) => c.id === targetId) || CHARACTER_REGISTRY[0];

    const challengeId = `mock_v2_${Date.now().toString(36)}_${this._seq}`;
    const nonce = Math.random().toString(36).slice(2, 12);
    const expiresAt = Date.now() + 120000;

    this._sessions.set(challengeId, {
      targetId: target.id,
      nonce,
      expiresAt,
      status: 'PENDING'
    });

    return {
      challengeId,
      nonce,
      layoutOrder,
      targetCharacterId: target.id,
      targetNameZh: target.nameZh,
      expiresAt,
      status: 'PENDING',
      isMock: true
    };
  }

  async verifyChallenge(rawSubmission, signal) {
    const sub = sanitizeChallengeSubmission(rawSubmission);
    await this._delay(this.latencyMs, signal);

    const rec = this._sessions.get(sub.challengeId);
    if (!rec) {
      return { verified: false, code: 'CHALLENGE_NOT_FOUND', message: '验证会话已失效，请重新获取。', retryable: true, isMock: true };
    }
    if (rec.status !== 'PENDING') {
      return { verified: false, code: 'CHALLENGE_CONSUMED', message: '该次验证已结束，请开启新一轮挑战。', retryable: true, isMock: true };
    }
    if (Date.now() > rec.expiresAt) {
      rec.status = 'EXPIRED';
      return { verified: false, code: 'CHALLENGE_EXPIRED', message: '本次挑战已超时，请再试一次。', retryable: true, isMock: true };
    }
    if (rec.nonce !== sub.nonce) {
      return { verified: false, code: 'INVALID_NONCE', message: '验证凭证不一致。', retryable: true, isMock: true };
    }
    if (this.requireAntiBotToken && !sub.antiBotToken) {
      return { verified: false, code: 'MISSING_ANTIBOT_TOKEN', message: '缺少独立反机器人验证凭证。', retryable: true, isMock: true };
    }
    if (sub.selectedCharacterId !== rec.targetId) {
      return { verified: false, code: 'WRONG_CHARACTER', message: '抓到的玩偶与目标不一致，再试试看。', retryable: true, isMock: true };
    }

    rec.status = 'VERIFIED';
    const token = `haiz_v2_mock.${btoa(`${sub.challengeId}:${rec.nonce}`).replace(/=+$/, '')}`;
    return {
      verified: true,
      code: 'OK',
      message: '抓到啦，欢迎来到 HAIZ。',
      verificationToken: token,
      challengeId: sub.challengeId,
      verifiedAt: new Date().toISOString(),
      isMock: true
    };
  }

  _delay(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal && signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      const timer = setTimeout(() => {
        if (signal) signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
    });
  }
}

export class HttpDualLayerAdapter {
  constructor(options = {}) {
    if (!options.baseUrl) {
      throw new Error('HttpDualLayerAdapter requires baseUrl.');
    }
    this.isMock = false;
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.headers = options.headers || {};
    this.credentials = options.credentials || 'same-origin';
    this.antiBotProvider = options.antiBotProvider || null;
    this.fetchImpl = options.fetch || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  }

  async fetchChallenge(signal) {
    const res = await this.fetchImpl(`${this.baseUrl}/challenge`, {
      method: 'POST',
      credentials: this.credentials,
      headers: { 'Content-Type': 'application/json', ...this.headers },
      body: JSON.stringify({ client: 'haiz-toybox-v2', version: '2.0.0' }),
      signal
    });
    if (!res.ok) throw new Error(`Challenge HTTP ${res.status}`);
    const data = await res.json();
    if (!data || !data.challengeId || !data.targetCharacterId) {
      throw new Error('Invalid server challenge response');
    }
    return { ...data, isMock: false };
  }

  async verifyChallenge(rawSubmission, signal) {
    let antiBotToken = rawSubmission.antiBotToken || null;
    if (!antiBotToken && this.antiBotProvider && typeof this.antiBotProvider.getToken === 'function') {
      antiBotToken = await this.antiBotProvider.getToken(signal);
    }
    const payload = sanitizeChallengeSubmission({ ...rawSubmission, antiBotToken });
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
      message: data.message || (data.verified ? '抓到啦，欢迎来到 HAIZ。' : '服务端验证未通过。'),
      verificationToken: data.verificationToken || null,
      challengeId: payload.challengeId,
      retryable: data.retryable !== false,
      isMock: false
    };
  }
}

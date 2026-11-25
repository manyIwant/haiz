// HAIZ Toybox — server-authoritative challenge service (isomorphic: Node 22 and browsers via WebCrypto).
//
// SECURITY MODEL (read INTEGRATION.md for the full threat model):
//   * The claw-machine game is a UX layer. The target and layout are sent to the client in clear text,
//     so a script can trivially "solve" the game. The game is NOT what stops bots.
//   * What this service enforces: challenges are random, short-lived, session-bound (HMAC of the session id),
//     nonce-bound, attempt-limited and single-use; every attempt must carry an anti-bot token that is
//     verified server-side (Cloudflare Turnstile in production) BEFORE the pick is judged; a pass yields a
//     random 256-bit, single-use, short-lived, session-bound pass token whose SHA-256 hash is all that is stored.
//   * The login (or any protected action) must call consumePassToken() server-side and only proceed when
//     the result is { ok: true, demo: false }.
//
// DEMO MODE (demo: true):
//   * Pass tokens are prefixed 'demo_'. A production service (demo: false) rejects every 'demo_' token
//     before even touching the store, and checks the stored record's demo flag as defence in depth.
//   * Every result of a demo service carries demo: true. consumePassToken() of a demo service returns
//     { ok: true, demo: true } on a valid token — integrators MUST treat demo: true as "not authorised".
//     A demo service can therefore never grant a real login.

import { CHARACTER_IDS } from './character-ids.js';
import {
  ANTIBOT,
  ATTEMPT_STATUS as S,
  CONSUME_REASON,
  DEFAULTS,
  DEMO_TOKEN_PREFIX,
  ID_BYTES,
  LAYOUT,
  MODES,
  base64urlEncode,
  isBase64urlId,
  isInChute,
  randomBytes,
  randomId,
  secureRandom,
  secureRandomInt,
  secureShuffle,
  sha256b64url,
  timingSafeEqualStr,
  validateLayout,
} from './protocol.js';
import { MemoryStore } from './memory-store.js';

const MIN_SECRET_LENGTH = 32;
const SESSION_ID_RE = /^[\x21-\x7e]{16,256}$/; // printable ASCII, no spaces
const MAX_ELAPSED_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------------------------
// Layout generation
// ---------------------------------------------------------------------------------------------

const round = (v) => {
  const f = 10 ** LAYOUT.decimals;
  return Math.round(v * f) / f;
};

/**
 * Random layout by rejection sampling: every character exactly once, centres inside ±LAYOUT.bound,
 * outside the prize chute, pairwise distance >= LAYOUT.minDistance, yaw in [yawMin, yawMax].
 * Coordinates are rounded first and all checks run on the rounded values.
 *
 * @param {{ rand?: () => number, maxRestarts?: number, maxTriesPerToy?: number }} [opts]
 */
export function generateLayout({ rand = secureRandom, maxRestarts = 1000, maxTriesPerToy = 300 } = {}) {
  const b = LAYOUT.bound;
  for (let restart = 0; restart < maxRestarts; restart++) {
    const pts = [];
    for (let i = 0; i < LAYOUT.toyCount; i++) {
      let placed = false;
      for (let t = 0; t < maxTriesPerToy && !placed; t++) {
        const x = round(-b + 2 * b * rand());
        const z = round(-b + 2 * b * rand());
        if (isInChute(x, z)) continue;
        if (pts.some((p) => Math.hypot(p.x - x, p.z - z) < LAYOUT.minDistance)) continue;
        // Prevent severe front-to-back occlusion from the player's front camera
        if (pts.some((p) => Math.abs(p.x - x) < 0.22)) continue;
        pts.push({ x, z });
        placed = true;
      }
      if (!placed) break;
    }
    if (pts.length !== LAYOUT.toyCount) continue;
    const chars = secureShuffle(CHARACTER_IDS);
    const layout = pts.map((p, slot) => ({
      slot,
      characterId: chars[slot],
      x: p.x,
      z: p.z,
      yaw: round(LAYOUT.yawMin + (LAYOUT.yawMax - LAYOUT.yawMin) * rand()),
    }));
    if (validateLayout(layout).ok) return layout;
  }
  throw new Error('generateLayout: could not satisfy constraints');
}

// ---------------------------------------------------------------------------------------------
// Input validation helpers
// ---------------------------------------------------------------------------------------------

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isSessionId = (v) => typeof v === 'string' && SESSION_ID_RE.test(v);
const isOptionalIp = (v) => v === undefined || v === null || (typeof v === 'string' && v.length <= 128);
const isPick = (p) =>
  isPlainObject(p) &&
  Number.isInteger(p.slot) &&
  p.slot >= 0 &&
  p.slot < LAYOUT.toyCount &&
  typeof p.characterId === 'string' &&
  CHARACTER_IDS.includes(p.characterId);
const isAntiBotToken = (t) => t === null || (typeof t === 'string' && t.length > 0 && t.length <= ANTIBOT.maxTokenLength);
const isElapsed = (e) => Number.isInteger(e) && e >= 0 && e <= MAX_ELAPSED_MS;

const positiveInt = (v, name) => {
  if (!Number.isInteger(v) || v <= 0) throw new RangeError(`ChallengeService: ${name} must be a positive integer`);
  return v;
};

// ---------------------------------------------------------------------------------------------
// ChallengeService
// ---------------------------------------------------------------------------------------------

export class ChallengeService {
  /**
   * @param {object} opts
   * @param {string|Uint8Array|CryptoKey} [opts.secret]  HMAC secret (>= 32 chars/bytes). Required unless demo.
   *        A CryptoKey must be an HMAC-SHA-256 key with the 'sign' usage.
   * @param {object} [opts.store]               Store (see memory-store.js). Default: new MemoryStore({ clock }).
   * @param {object} opts.antiBotVerifier       AntiBotVerifier (see antibot-verifiers.js). Required.
   * @param {() => number} [opts.clock]         epoch-ms clock
   * @param {boolean} [opts.demo=false]         demo service: 'demo_' tokens, every result demo: true
   * @param {number} [opts.challengeTtlMs=120000]
   * @param {number} [opts.passTokenTtlMs=120000]
   * @param {number} [opts.maxAttempts=5]
   * @param {number} [opts.minElapsedMs=400]
   * @param {number} [opts.elapsedSlackMs=1500]
   * @param {number} [opts.storeGraceMs=60000]
   * @param {{ check(kind: 'create'|'attempt', keys: { ip?: string, sessionKey?: string }): Promise<{ ok: boolean, retryAfterMs: number }> }} [opts.rateLimiter]
   * @param {string} [opts.keyPrefix='tbx:']    store key namespace
   */
  constructor({
    secret,
    store,
    antiBotVerifier,
    clock = () => Date.now(),
    demo = false,
    challengeTtlMs = DEFAULTS.challengeTtlMs,
    passTokenTtlMs = DEFAULTS.passTokenTtlMs,
    maxAttempts = DEFAULTS.maxAttempts,
    minElapsedMs = DEFAULTS.minElapsedMs,
    elapsedSlackMs = DEFAULTS.elapsedSlackMs,
    storeGraceMs = DEFAULTS.storeGraceMs,
    rateLimiter = null,
    keyPrefix = 'tbx:',
  } = {}) {
    if (typeof demo !== 'boolean') throw new TypeError('ChallengeService: demo must be a boolean');
    if (typeof clock !== 'function') throw new TypeError('ChallengeService: clock must be a function');
    if (!antiBotVerifier || typeof antiBotVerifier.verify !== 'function') {
      throw new TypeError('ChallengeService: antiBotVerifier with verify() is required');
    }
    if (!demo && antiBotVerifier.isMock) {
      throw new Error('ChallengeService: a mock anti-bot verifier is not allowed when demo is false');
    }

    // Secret handling: production needs an explicit strong secret; demo gets a random one if absent.
    if (secret === undefined || secret === null || secret === '') {
      if (!demo) throw new Error('ChallengeService: secret is required when demo is false');
      secret = randomBytes(32);
    }
    const isCryptoKey = typeof CryptoKey !== 'undefined' && secret instanceof CryptoKey;
    if (!isCryptoKey) {
      if (typeof secret === 'string') {
        if (!demo && secret.length < MIN_SECRET_LENGTH) throw new Error(`ChallengeService: secret must be >= ${MIN_SECRET_LENGTH} characters`);
      } else if (secret instanceof Uint8Array) {
        if (!demo && secret.byteLength < MIN_SECRET_LENGTH) throw new Error(`ChallengeService: secret must be >= ${MIN_SECRET_LENGTH} bytes`);
      } else {
        throw new TypeError('ChallengeService: secret must be a string, Uint8Array or CryptoKey');
      }
    }

    this.demo = demo;
    this._clock = clock;
    this._store = store || new MemoryStore({ clock });
    this._verifier = antiBotVerifier;
    this._rateLimiter = rateLimiter;
    this._prefix = keyPrefix;
    this.challengeTtlMs = positiveInt(challengeTtlMs, 'challengeTtlMs');
    this.passTokenTtlMs = positiveInt(passTokenTtlMs, 'passTokenTtlMs');
    this.maxAttempts = positiveInt(maxAttempts, 'maxAttempts');
    this.minElapsedMs = Number.isInteger(minElapsedMs) && minElapsedMs >= 0 ? minElapsedMs : DEFAULTS.minElapsedMs;
    this.elapsedSlackMs = Number.isInteger(elapsedSlackMs) && elapsedSlackMs >= 0 ? elapsedSlackMs : DEFAULTS.elapsedSlackMs;
    this.storeGraceMs = positiveInt(storeGraceMs, 'storeGraceMs');

    this._keyPromise = isCryptoKey
      ? Promise.resolve(secret)
      : globalThis.crypto.subtle.importKey(
          'raw',
          typeof secret === 'string' ? new TextEncoder().encode(secret) : secret,
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign'],
        );
  }

  // ----- internals ----------------------------------------------------------------------------

  async _hmac(label, value) {
    const key = await this._keyPromise;
    const sig = await globalThis.crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${label}\u0000${value}`));
    return base64urlEncode(new Uint8Array(sig));
  }

  /** Opaque, non-reversible session binding stored with challenges and pass tokens. */
  _bind(sessionId) {
    return this._hmac('hz-tbx-sid-v1', sessionId);
  }

  _chKey(id) {
    return `${this._prefix}ch:${id}`;
  }
  _attKey(id) {
    return `${this._prefix}att:${id}`;
  }
  _ptKey(hash) {
    return `${this._prefix}pt:${hash}`;
  }

  _result(status, extra = {}) {
    return { status, ...extra, demo: this.demo };
  }

  async _rateLimit(kind, ip, sessionKey) {
    if (!this._rateLimiter) return { ok: true, retryAfterMs: 0 };
    const r = await this._rateLimiter.check(kind, { ip: ip || undefined, sessionKey });
    return r && r.ok ? { ok: true, retryAfterMs: 0 } : { ok: false, retryAfterMs: Math.max(1, Math.ceil(r?.retryAfterMs || 1000)) };
  }

  async _burn(challengeId) {
    await this._store.delete(this._chKey(challengeId));
    await this._store.delete(this._attKey(challengeId));
  }

  // ----- public API ---------------------------------------------------------------------------

  /**
   * Create a fresh challenge bound to `sessionId`.
   * @param {{ sessionId: string, mode: 'game'|'accessible', ip?: string }} args
   * @returns {Promise<{ ok: true, challenge: object } | { ok: false, status: 'invalid'|'rate_limited', retryAfterMs?: number, demo: boolean }>}
   */
  async createChallenge({ sessionId, mode, ip } = {}) {
    if (!isSessionId(sessionId) || !MODES.includes(mode) || !isOptionalIp(ip)) {
      return { ok: false, status: S.INVALID, demo: this.demo };
    }
    const sid = await this._bind(sessionId);
    const rl = await this._rateLimit('create', ip, sid);
    if (!rl.ok) return { ok: false, status: S.RATE_LIMITED, retryAfterMs: rl.retryAfterMs, demo: this.demo };

    const challengeId = randomId(ID_BYTES.challengeId);
    const nonce = randomId(ID_BYTES.nonce);
    const layout = generateLayout();
    const target = CHARACTER_IDS[secureRandomInt(CHARACTER_IDS.length)];
    const issuedAt = this._clock();
    const expiresAt = issuedAt + this.challengeTtlMs;

    // Only what is needed to judge the attempt is stored; no raw session id, no raw nonce.
    const record = {
      v: 1,
      sid,
      nonceHash: await sha256b64url(nonce),
      target,
      slots: layout.map((t) => t.characterId), // slot index → characterId
      mode,
      issuedAt,
      expiresAt,
      maxAttempts: this.maxAttempts,
      demo: this.demo,
    };
    await this._store.set(this._chKey(challengeId), record, this.challengeTtlMs + this.storeGraceMs);

    const antiBot = { provider: this._verifier.provider, action: ANTIBOT.action, cData: challengeId };
    if (typeof this._verifier.siteKey === 'string' && this._verifier.siteKey) antiBot.siteKey = this._verifier.siteKey;

    return {
      ok: true,
      challenge: {
        challengeId,
        nonce,
        issuedAt,
        expiresAt,
        mode,
        target,
        layout,
        maxAttempts: this.maxAttempts,
        attemptsLeft: this.maxAttempts,
        antiBot,
        demo: this.demo,
      },
    };
  }

  /**
   * Judge one attempt. Order of checks: input types → rate limit → challenge lookup → session binding →
   * nonce → expiry → attempt counter (atomic) → elapsed sanity → anti-bot verification → pick.
   * @returns {Promise<{ status: string, attemptsLeft?: number, retryAfterMs?: number, passToken?: string, passTokenExpiresAt?: number, demo: boolean }>}
   */
  async submitAttempt({ sessionId, challengeId, nonce, pick, antiBotToken, elapsedMs, ip } = {}) {
    if (
      !isSessionId(sessionId) ||
      !isBase64urlId(challengeId, ID_BYTES.challengeId) ||
      !isBase64urlId(nonce, ID_BYTES.nonce) ||
      !isPick(pick) ||
      !isAntiBotToken(antiBotToken) ||
      !isElapsed(elapsedMs) ||
      !isOptionalIp(ip)
    ) {
      return this._result(S.INVALID);
    }

    const sid = await this._bind(sessionId);
    const rl = await this._rateLimit('attempt', ip, sid);
    if (!rl.ok) return this._result(S.RATE_LIMITED, { retryAfterMs: rl.retryAfterMs });

    const rec = await this._store.get(this._chKey(challengeId));
    // Unknown, consumed (already passed), burned, or swept → 'invalid'. Same answer for all, no oracle.
    if (!rec || rec.demo !== this.demo) return this._result(S.INVALID);
    if (!timingSafeEqualStr(rec.sid, sid)) return this._result(S.INVALID);
    if (!timingSafeEqualStr(rec.nonceHash, await sha256b64url(nonce))) return this._result(S.INVALID);

    const now = this._clock();
    if (now >= rec.expiresAt) {
      await this._burn(challengeId);
      return this._result(S.EXPIRED, { attemptsLeft: 0 });
    }

    // Atomic counter: parallel submissions cannot exceed maxAttempts.
    const n = await this._store.incr(this._attKey(challengeId), rec.expiresAt - now + this.storeGraceMs);
    const attemptsLeft = Math.max(0, rec.maxAttempts - n);
    if (n > rec.maxAttempts) {
      await this._burn(challengeId);
      return this._result(S.EXHAUSTED, { attemptsLeft: 0 });
    }

    // A failed attempt that used the last try burns the challenge and is reported as 'exhausted'.
    const fail = async (status) => {
      if (attemptsLeft <= 0) {
        await this._burn(challengeId);
        return this._result(S.EXHAUSTED, { attemptsLeft: 0 });
      }
      return this._result(status, { attemptsLeft });
    };

    // Coarse timing sanity only (no trajectories are collected). Not a bot defence on its own.
    const serverElapsed = now - rec.issuedAt;
    if (elapsedMs < this.minElapsedMs || serverElapsed < this.minElapsedMs || elapsedMs > serverElapsed + this.elapsedSlackMs) {
      return fail(S.INVALID);
    }

    // Anti-bot verification happens BEFORE the pick is judged, so a bot without a valid token learns nothing.
    if (antiBotToken === null) return fail(S.ANTIBOT_FAILED);
    let verdict;
    try {
      verdict = await this._verifier.verify({
        token: antiBotToken,
        ip: ip || undefined,
        action: ANTIBOT.action,
        cData: challengeId,
        idempotencyKey: globalThis.crypto.randomUUID(),
      });
    } catch {
      verdict = { ok: false, unavailable: true };
    }
    if (!verdict || verdict.ok !== true) {
      // Provider unreachable → fail closed with 'error'; the challenge stays usable (attempt still counted).
      if (verdict?.unavailable) return this._result(S.ERROR, { attemptsLeft });
      return fail(S.ANTIBOT_FAILED);
    }

    const correct = pick.characterId === rec.target && rec.slots[pick.slot] === rec.target;
    if (!correct) return fail(S.WRONG); // no new information is revealed, only attemptsLeft

    // Single use: only one concurrent winner gets the record back from GETDEL.
    const claimed = await this._store.getDel(this._chKey(challengeId));
    await this._store.delete(this._attKey(challengeId));
    if (!claimed || !timingSafeEqualStr(claimed.nonceHash, rec.nonceHash)) return this._result(S.INVALID);
    const t2 = this._clock();
    if (t2 >= claimed.expiresAt) return this._result(S.EXPIRED, { attemptsLeft: 0 });

    const raw = randomId(ID_BYTES.passToken);
    const passToken = this.demo ? DEMO_TOKEN_PREFIX + raw : raw;
    const passTokenExpiresAt = t2 + this.passTokenTtlMs;
    await this._store.set(
      this._ptKey(await sha256b64url(passToken)),
      { v: 1, sid, demo: this.demo, mode: claimed.mode, issuedAt: t2, expiresAt: passTokenExpiresAt },
      this.passTokenTtlMs,
    );
    return this._result(S.PASSED, { attemptsLeft, passToken, passTokenExpiresAt });
  }

  /**
   * Best-effort cancel. Always resolves { ok: true } (no oracle); only deletes when the session matches.
   * @param {{ sessionId: string, challengeId: string }} args
   */
  async cancelChallenge({ sessionId, challengeId } = {}) {
    if (!isSessionId(sessionId) || !isBase64urlId(challengeId, ID_BYTES.challengeId)) return { ok: true, demo: this.demo };
    const rec = await this._store.get(this._chKey(challengeId));
    if (rec && timingSafeEqualStr(rec.sid, await this._bind(sessionId))) await this._burn(challengeId);
    return { ok: true, demo: this.demo };
  }

  /**
   * SERVER-SIDE ONLY. Consume a pass token exactly once. Call it inside the login handler/transaction.
   * Grant access only if the result is { ok: true, demo: false }.
   *
   * @param {{ passToken: string, sessionId: string }} args
   * @returns {Promise<{ ok: boolean, demo: boolean, reason?: string, mode?: string, issuedAt?: number }>}
   */
  async consumePassToken({ passToken, sessionId } = {}) {
    const no = (reason) => ({ ok: false, demo: this.demo, reason });
    if (typeof passToken !== 'string' || !isSessionId(sessionId)) return no(CONSUME_REASON.INVALID);

    const isDemoToken = passToken.startsWith(DEMO_TOKEN_PREFIX);
    if (!this.demo && isDemoToken) return no(CONSUME_REASON.DEMO_TOKEN); // never even looked up
    if (this.demo && !isDemoToken) return no(CONSUME_REASON.NOT_DEMO_TOKEN);
    const raw = isDemoToken ? passToken.slice(DEMO_TOKEN_PREFIX.length) : passToken;
    if (!isBase64urlId(raw, ID_BYTES.passToken)) return no(CONSUME_REASON.INVALID);

    // GETDEL first: whatever happens next, this token can never be presented again.
    const rec = await this._store.getDel(this._ptKey(await sha256b64url(passToken)));
    if (!rec) return no(CONSUME_REASON.NOT_FOUND);
    if (rec.demo !== this.demo) return no(CONSUME_REASON.DEMO_TOKEN);
    if (this._clock() >= rec.expiresAt) return no(CONSUME_REASON.EXPIRED);
    if (!timingSafeEqualStr(rec.sid, await this._bind(sessionId))) return no(CONSUME_REASON.SESSION_MISMATCH);
    return { ok: true, demo: this.demo, mode: rec.mode, issuedAt: rec.issuedAt };
  }
}

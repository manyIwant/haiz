// HAIZ Toybox — token-bucket rate limiter (isomorphic, injectable clock, bounded memory).
//
// Two layers:
//   TokenBucketLimiter  — one bucket per key, `capacity` tokens, refilled continuously at `refillPerSec`.
//   ToyboxRateLimiter   — separate budgets for 'create' (new challenges) and 'attempt' (submissions),
//                         each keyed independently by IP and by session. A request passes only if BOTH the
//                         IP bucket and the session bucket have a token (checked first, then both are taken,
//                         so a rejected request does not drain the other bucket).
//
// In-process only. For multiple server instances put the buckets in Redis (e.g. a Lua token bucket or
// a fixed-window INCR + PEXPIRE) — the ChallengeService only needs the async `check(kind, keys)` method.

export class TokenBucketLimiter {
  /**
   * @param {object} opts
   * @param {number} opts.capacity       burst size (tokens)
   * @param {number} opts.refillPerSec   sustained rate (tokens / second)
   * @param {() => number} [opts.clock]
   * @param {number} [opts.maxKeys]      memory bound; full buckets are dropped first, then oldest
   */
  constructor({ capacity, refillPerSec, clock = () => Date.now(), maxKeys = 50_000 }) {
    if (!(capacity > 0) || !(refillPerSec > 0)) throw new RangeError('TokenBucketLimiter: capacity and refillPerSec must be > 0');
    this.capacity = capacity;
    this.refillPerSec = refillPerSec;
    this._clock = clock;
    this._maxKeys = maxKeys;
    /** @type {Map<string, { tokens: number, t: number }>} */
    this._buckets = new Map();
  }

  _bucket(key) {
    const now = this._clock();
    let b = this._buckets.get(key);
    if (!b) {
      b = { tokens: this.capacity, t: now };
      this._buckets.set(key, b);
      if (this._buckets.size > this._maxKeys) this._evict();
    } else {
      const elapsed = Math.max(0, now - b.t) / 1000;
      b.tokens = Math.min(this.capacity, b.tokens + elapsed * this.refillPerSec);
      b.t = now;
    }
    return b;
  }

  _evict() {
    const now = this._clock();
    for (const [k, b] of this._buckets) {
      const tokens = Math.min(this.capacity, b.tokens + (Math.max(0, now - b.t) / 1000) * this.refillPerSec);
      if (tokens >= this.capacity) this._buckets.delete(k); // full bucket == no state worth keeping
    }
    while (this._buckets.size > this._maxKeys) this._buckets.delete(this._buckets.keys().next().value);
  }

  /** Inspect without consuming: { ok, retryAfterMs }. */
  peek(key, cost = 1) {
    const b = this._bucket(key);
    if (b.tokens >= cost) return { ok: true, retryAfterMs: 0 };
    return { ok: false, retryAfterMs: Math.ceil(((cost - b.tokens) / this.refillPerSec) * 1000) };
  }

  /** Consume `cost` tokens if available: { ok, retryAfterMs }. */
  take(key, cost = 1) {
    const r = this.peek(key, cost);
    if (r.ok) this._bucket(key).tokens -= cost;
    return r;
  }

  reset(key) {
    if (key === undefined) this._buckets.clear();
    else this._buckets.delete(key);
  }
}

/** Default budgets. Generous for humans, tight for scripted floods. */
export const DEFAULT_RATE_LIMITS = Object.freeze({
  create: Object.freeze({
    ip: Object.freeze({ capacity: 30, refillPerSec: 30 / 60 }), //      30 burst, 30 / min per IP (NAT-friendly)
    session: Object.freeze({ capacity: 10, refillPerSec: 10 / 60 }), // 10 burst, 10 / min per session
  }),
  attempt: Object.freeze({
    ip: Object.freeze({ capacity: 60, refillPerSec: 60 / 60 }),
    session: Object.freeze({ capacity: 20, refillPerSec: 20 / 60 }),
  }),
});

export class ToyboxRateLimiter {
  /**
   * @param {object} [opts]
   * @param {() => number} [opts.clock]
   * @param {typeof DEFAULT_RATE_LIMITS} [opts.limits]  override any subset of the budgets
   */
  constructor({ clock = () => Date.now(), limits = {} } = {}) {
    this._limiters = {};
    for (const kind of Object.keys(DEFAULT_RATE_LIMITS)) {
      const merged = { ...DEFAULT_RATE_LIMITS[kind], ...(limits[kind] || {}) };
      this._limiters[kind] = {
        ip: new TokenBucketLimiter({ ...merged.ip, clock }),
        session: new TokenBucketLimiter({ ...merged.session, clock }),
      };
    }
  }

  /**
   * @param {'create'|'attempt'} kind
   * @param {{ ip?: string, sessionKey?: string }} keys  sessionKey should be an opaque/hashed session id
   * @returns {Promise<{ ok: boolean, retryAfterMs: number }>}
   */
  async check(kind, { ip, sessionKey } = {}) {
    const l = this._limiters[kind];
    if (!l) throw new Error(`ToyboxRateLimiter: unknown kind ${kind}`);
    const probes = [];
    if (typeof ip === 'string' && ip) probes.push([l.ip, `ip:${ip}`]);
    if (typeof sessionKey === 'string' && sessionKey) probes.push([l.session, `s:${sessionKey}`]);
    let retryAfterMs = 0;
    for (const [lim, key] of probes) {
      const r = lim.peek(key);
      if (!r.ok) retryAfterMs = Math.max(retryAfterMs, r.retryAfterMs);
    }
    if (retryAfterMs > 0) return { ok: false, retryAfterMs };
    for (const [lim, key] of probes) lim.take(key);
    return { ok: true, retryAfterMs: 0 };
  }
}

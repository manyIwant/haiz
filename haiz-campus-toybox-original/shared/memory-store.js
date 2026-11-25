// HAIZ Toybox — in-memory key/value store with TTL (reference implementation of the Store interface).
//
// Store interface used by ChallengeService (all methods async, values are JSON-serialisable):
//
//   get(key)                 -> value | null
//   set(key, value, ttlMs)   -> void            (overwrites, sets expiry)
//   delete(key)              -> void
//   getDel(key)              -> value | null    ATOMIC read-and-delete — the basis of one-time use
//   incr(key, ttlMs)         -> number          ATOMIC increment; ttl applied only when the key is created
//
// MemoryStore is fine for a single Node process and for the in-browser demo. It is NOT shared between
// processes: with more than one server instance use a Redis implementation, e.g. (ioredis/node-redis):
//
//   get(k)          GET k                       → JSON.parse
//   set(k, v, ttl)  SET k JSON.stringify(v) PX ttl
//   delete(k)       DEL k
//   getDel(k)       GETDEL k                    (Redis >= 6.2; older: MULTI GET k / DEL k EXEC, or a Lua script)
//   incr(k, ttl)    MULTI; INCR k; PEXPIRE k ttl NX; EXEC   (PEXPIRE … NX needs Redis >= 7; else Lua:
//                   local n = redis.call('INCR', KEYS[1]) if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end return n)
//
// GETDEL is what makes challenges and pass tokens single-use under concurrency: two parallel requests
// can both GET a record, but only one GETDEL returns it.

export class MemoryStore {
  /**
   * @param {object} [opts]
   * @param {() => number} [opts.clock]          epoch-ms clock (inject a fake one in tests)
   * @param {number} [opts.sweepIntervalMs]     minimum interval between opportunistic sweeps
   * @param {number} [opts.maxEntries]          hard cap; when exceeded after a sweep, oldest entries are evicted
   */
  constructor({ clock = () => Date.now(), sweepIntervalMs = 30_000, maxEntries = 100_000 } = {}) {
    this._clock = clock;
    this._sweepIntervalMs = sweepIntervalMs;
    this._maxEntries = maxEntries;
    /** @type {Map<string, { v: string, exp: number }>} values stored as JSON to mimic Redis (no aliasing) */
    this._map = new Map();
    this._lastSweep = clock();
  }

  get size() {
    return this._map.size;
  }

  _live(key) {
    const e = this._map.get(key);
    if (!e) return null;
    if (e.exp <= this._clock()) {
      this._map.delete(key);
      return null;
    }
    return e;
  }

  _maybeSweep() {
    const now = this._clock();
    if (now - this._lastSweep >= this._sweepIntervalMs || this._map.size > this._maxEntries) this.sweep();
  }

  /** Remove expired entries; enforce maxEntries by evicting oldest insertions. */
  sweep() {
    const now = this._clock();
    this._lastSweep = now;
    for (const [k, e] of this._map) if (e.exp <= now) this._map.delete(k);
    while (this._map.size > this._maxEntries) {
      const oldest = this._map.keys().next().value;
      this._map.delete(oldest);
    }
  }

  async get(key) {
    const e = this._live(key);
    return e ? JSON.parse(e.v) : null;
  }

  async set(key, value, ttlMs) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new RangeError('MemoryStore.set: ttlMs must be > 0');
    this._map.delete(key); // refresh insertion order
    this._map.set(key, { v: JSON.stringify(value), exp: this._clock() + ttlMs });
    this._maybeSweep();
  }

  async delete(key) {
    this._map.delete(key);
  }

  async getDel(key) {
    // Synchronous between read and delete → atomic within a single JS event loop.
    const e = this._live(key);
    if (!e) return null;
    this._map.delete(key);
    return JSON.parse(e.v);
  }

  async incr(key, ttlMs) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new RangeError('MemoryStore.incr: ttlMs must be > 0');
    const e = this._live(key);
    if (!e) {
      this._map.set(key, { v: '1', exp: this._clock() + ttlMs });
      this._maybeSweep();
      return 1;
    }
    const n = Number(JSON.parse(e.v)) + 1;
    e.v = JSON.stringify(n);
    return n;
  }

  clear() {
    this._map.clear();
  }
}

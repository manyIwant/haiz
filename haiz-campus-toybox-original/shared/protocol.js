// HAIZ Toybox — shared protocol constants & isomorphic helpers (browser + Node 22).
//
// Single source of truth for numbers that appear in shared/CONTRACT.md. Zero dependencies; only
// uses globalThis.crypto (WebCrypto) and btoa/atob, which exist in modern browsers and Node >= 18.

import { CHARACTER_IDS } from './character-ids.js';

export const PROTOCOL_VERSION = 1;

/** Challenge modes. 'accessible' has exactly the same server-side guarantees as 'game'. */
export const MODES = Object.freeze(['game', 'accessible']);

/** Every status an AttemptResult can carry (CONTRACT.md → AttemptResult.status). */
export const ATTEMPT_STATUS = Object.freeze({
  PASSED: 'passed',
  WRONG: 'wrong',
  EXPIRED: 'expired',
  EXHAUSTED: 'exhausted',
  ANTIBOT_FAILED: 'antibot_failed',
  RATE_LIMITED: 'rate_limited',
  INVALID: 'invalid',
  ERROR: 'error',
});
export const ATTEMPT_STATUSES = Object.freeze(Object.values(ATTEMPT_STATUS));

/** Reasons returned by consumePassToken (server-side only). */
export const CONSUME_REASON = Object.freeze({
  INVALID: 'invalid', //            malformed input
  DEMO_TOKEN: 'demo_token', //      a 'demo_' token presented to a production service
  NOT_DEMO_TOKEN: 'not_demo_token', // a non-demo token presented to a demo service
  NOT_FOUND: 'not_found', //        unknown, already used, or swept after expiry
  EXPIRED: 'expired',
  SESSION_MISMATCH: 'session_mismatch',
});

/** Default lifetimes / limits. All durations in milliseconds. */
export const DEFAULTS = Object.freeze({
  challengeTtlMs: 120_000,
  passTokenTtlMs: 120_000,
  maxAttempts: 5,
  /** Attempts whose (client-reported or server-observed) elapsed time is below this are 'invalid'. */
  minElapsedMs: 400,
  /** Client-reported elapsedMs may exceed the server-observed elapsed time by at most this much. */
  elapsedSlackMs: 1_500,
  /** Records are kept this long after expiry so the client gets 'expired' instead of 'invalid'. */
  storeGraceMs: 60_000,
});

/**
 * Machine-floor layout constraints (normalized space, see CONTRACT.md).
 * `bound` keeps toy centres slightly away from the glass walls; it is a subset of the contract's
 * [-1, 1] range, so any layout produced here is valid under the contract.
 */
export const LAYOUT = Object.freeze({
  toyCount: 6,
  min: -1,
  max: 1,
  bound: 0.9,
  chute: Object.freeze({ xBelow: -0.45, zAbove: 0.25 }), // forbidden: x < -0.45 && z > 0.25
  minDistance: 0.62,
  yawMin: -0.6,
  yawMax: 0.6,
  /** Coordinates are rounded to this many decimals before being validated and sent. */
  decimals: 3,
});

export const ANTIBOT = Object.freeze({
  /** Turnstile `action` (<= 32 chars, [A-Za-z0-9_-]). */
  action: 'haiz_toybox',
  /** The only token the mock verifier accepts. Never accepted in production. */
  mockToken: 'mock-antibot-token',
  /** Turnstile tokens are at most 2048 characters. */
  maxTokenLength: 2048,
  providers: Object.freeze({ TURNSTILE: 'turnstile', MOCK: 'mock' }),
});

/** Pass tokens minted by a demo service carry this prefix; production services reject them outright. */
export const DEMO_TOKEN_PREFIX = 'demo_';

/** Session cookie used by the reference server. */
export const SESSION_COOKIE = 'hz_tbx_sid';

/** Bytes of entropy for identifiers. */
export const ID_BYTES = Object.freeze({ challengeId: 16, nonce: 16, passToken: 32, sessionId: 32 });

// ---------------------------------------------------------------------------------------------
// Crypto / encoding helpers
// ---------------------------------------------------------------------------------------------

function getCrypto() {
  const c = globalThis.crypto;
  if (!c || typeof c.getRandomValues !== 'function' || !c.subtle) {
    throw new Error('WebCrypto (globalThis.crypto) is required');
  }
  return c;
}

/** Cryptographically secure random bytes. */
export function randomBytes(n) {
  if (!Number.isInteger(n) || n <= 0 || n > 65536) throw new RangeError('randomBytes: bad length');
  return getCrypto().getRandomValues(new Uint8Array(n));
}

/** Encode bytes as unpadded base64url. */
export function base64urlEncode(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode unpadded base64url to bytes. Throws on malformed input. */
export function base64urlDecode(str) {
  if (typeof str !== 'string' || !/^[A-Za-z0-9_-]*$/.test(str)) throw new TypeError('bad base64url');
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Random base64url identifier with `bytes` bytes of entropy (default 128 bit). */
export function randomId(bytes = 16) {
  return base64urlEncode(randomBytes(bytes));
}

/** Length of the unpadded base64url encoding of n bytes. */
export function base64urlLength(n) {
  return Math.ceil((n * 4) / 3);
}

/** True if `s` is a base64url string encoding exactly `bytes` bytes. */
export function isBase64urlId(s, bytes = 16) {
  return typeof s === 'string' && s.length === base64urlLength(bytes) && /^[A-Za-z0-9_-]+$/.test(s);
}

/** Uniform float in [0, 1) from the CSPRNG. */
export function secureRandom() {
  const u = getCrypto().getRandomValues(new Uint32Array(2));
  // 53 random bits → exact double in [0, 1)
  return (u[0] * 2 ** 21 + (u[1] >>> 11)) / 2 ** 53;
}

/** Unbiased integer in [0, n). */
export function secureRandomInt(n) {
  if (!Number.isInteger(n) || n <= 0 || n > 2 ** 32) throw new RangeError('secureRandomInt: bad range');
  const limit = Math.floor(2 ** 32 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    getCrypto().getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

/** Fisher–Yates shuffle using the CSPRNG (returns a new array). */
export function secureShuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Constant-time string comparison (for equal-length secrets such as hashes / nonces).
 * Returns false immediately on length mismatch (lengths of our compared values are public).
 */
export function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** SHA-256 of a UTF-8 string, base64url encoded. */
export async function sha256b64url(str) {
  const digest = await getCrypto().subtle.digest('SHA-256', new TextEncoder().encode(str));
  return base64urlEncode(new Uint8Array(digest));
}

// ---------------------------------------------------------------------------------------------
// Layout helpers (shared so the front-end and tests use the same rules)
// ---------------------------------------------------------------------------------------------

/** True if a toy centre at (x, z) would sit on the prize chute. */
export function isInChute(x, z) {
  return x < LAYOUT.chute.xBelow && z > LAYOUT.chute.zAbove;
}

/**
 * Validate a layout against CONTRACT.md. Returns { ok: true } or { ok: false, reason }.
 * Checks: 6 entries, slots 0..5 each once, every character exactly once, finite coords in range,
 * chute exclusion, min distance and yaw range.
 */
export function validateLayout(layout) {
  if (!Array.isArray(layout) || layout.length !== LAYOUT.toyCount) return { ok: false, reason: 'count' };
  const slots = new Set();
  const chars = new Set();
  for (const t of layout) {
    if (!t || typeof t !== 'object') return { ok: false, reason: 'entry' };
    const { slot, characterId, x, z, yaw } = t;
    if (!Number.isInteger(slot) || slot < 0 || slot >= LAYOUT.toyCount || slots.has(slot)) return { ok: false, reason: 'slot' };
    if (!CHARACTER_IDS.includes(characterId) || chars.has(characterId)) return { ok: false, reason: 'character' };
    for (const v of [x, z, yaw]) if (typeof v !== 'number' || !Number.isFinite(v)) return { ok: false, reason: 'number' };
    if (x < LAYOUT.min || x > LAYOUT.max || z < LAYOUT.min || z > LAYOUT.max) return { ok: false, reason: 'range' };
    if (isInChute(x, z)) return { ok: false, reason: 'chute' };
    if (yaw < LAYOUT.yawMin || yaw > LAYOUT.yawMax) return { ok: false, reason: 'yaw' };
    slots.add(slot);
    chars.add(characterId);
  }
  for (let i = 0; i < layout.length; i++) {
    for (let j = i + 1; j < layout.length; j++) {
      const d = Math.hypot(layout[i].x - layout[j].x, layout[i].z - layout[j].z);
      if (d < LAYOUT.minDistance) return { ok: false, reason: 'distance' };
    }
  }
  return { ok: true };
}

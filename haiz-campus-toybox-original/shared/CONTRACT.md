# HAIZ Toybox · Client ⇄ Adapter ⇄ Server contract (v1)

This file is the single source of truth shared by the 3D front-end (`src/machine`, `src/challenge/HaizToyboxChallenge.js`)
and the security layer (`shared/`, `server/`, `src/challenge/adapters/`).

## Character IDs (stable, never reuse)

`shared/character-ids.js` exports:

```js
export const CHARACTER_IDS = ['lanren', 'wuwu', 'fantuan', 'zaozao', 'chaochao', 'changchang'];
export const CHARACTER_NAMES = { lanren: '仁仁', wuwu: '午午', fantuan: '饭团', zaozao: '早早', chaochao: '潮潮', changchang: '长长' };
```

Asset-level fully qualified IDs are `haiz.toy.<id>` (e.g. `haiz.toy.lanren`).

## Machine floor coordinate space (normalized)

Layout positions are normalized: `x ∈ [-1, 1]` (left → right as seen by the player), `z ∈ [-1, 1]` (back → front).
The prize chute occupies the front-left corner: no toy may be placed where `x < -0.45 && z > 0.25`.
Toys need a minimum centre distance of `0.62` (normalized) between each other. `yaw` is radians in `[-0.6, 0.6]`
(toys roughly face the player, +Z).

## Client adapter interface (`src/challenge/adapters/*`)

```ts
interface ChallengeAdapter {
  readonly isDemo: boolean;            // MockAdapter: true. HttpAdapter: value reported by server.
  createChallenge(opts: { mode: 'game' | 'accessible', signal?: AbortSignal }): Promise<Challenge>;
  submitAttempt(opts: {
    challengeId: string, nonce: string,
    pick: { slot: number, characterId: string },
    antiBotToken: string | null,
    elapsedMs: number,                 // coarse, integer, only used for sanity bounds; no trajectories are sent
    signal?: AbortSignal
  }): Promise<AttemptResult>;
  cancelChallenge(opts: { challengeId: string, signal?: AbortSignal }): Promise<void>;  // best effort
}

interface Challenge {
  challengeId: string;     // 128-bit random, base64url
  nonce: string;           // 128-bit random, base64url, must be echoed back
  issuedAt: number;        // epoch ms
  expiresAt: number;       // epoch ms (default TTL 120 s)
  mode: 'game' | 'accessible';
  target: string;          // character id to find
  layout: Array<{ slot: number, characterId: string, x: number, z: number, yaw: number }>; // 6 entries
  maxAttempts: number;     // default 5
  attemptsLeft: number;
  antiBot: { provider: 'turnstile' | 'mock', siteKey?: string, action: string, cData: string };
  demo: boolean;           // true => DEMO ONLY, can never authorise a real login
}

interface AttemptResult {
  status: 'passed' | 'wrong' | 'expired' | 'exhausted' | 'antibot_failed' | 'rate_limited' | 'invalid' | 'error';
  attemptsLeft?: number;
  retryAfterMs?: number;           // with rate_limited
  passToken?: string;              // only with 'passed'; one-time, short-lived (default 120 s), session bound
  passTokenExpiresAt?: number;
  demo: boolean;
}
```

## Anti-bot provider interface (`src/challenge/adapters/antibot/*`)

```ts
interface AntiBotProvider {
  readonly name: 'turnstile' | 'mock';
  // mount an (often invisible) widget into a container the 3D UI provides (small DOM slot under the machine)
  prepare(opts: { container: HTMLElement, siteKey?: string, action: string, cData: string, signal?: AbortSignal }): Promise<void>;
  getToken(opts: { signal?: AbortSignal }): Promise<string>;   // resolves a fresh single-use token
  reset(): void;
  destroy(): void;
}
```

## HTTP endpoints (reference server `server/`)

- `POST   /api/toybox/challenges`                 body `{ mode }` → `Challenge`
- `POST   /api/toybox/challenges/:id/attempts`    body `{ nonce, pick, antiBotToken, elapsedMs }` → `AttemptResult`
- `DELETE /api/toybox/challenges/:id`             → 204
- server-side only: `consumePassToken(passToken, sessionId) → { ok, demo, reason? }` (used by the login handler)
- demo only: `POST /api/demo/login` body `{ username, passToken }` → shows final server-side authorisation decision

Session binding: an HttpOnly, SameSite=Lax cookie `hz_tbx_sid` (or an integrator-provided session id). Challenges and
pass tokens store `HMAC(secret, sessionId)` and are rejected for other sessions.

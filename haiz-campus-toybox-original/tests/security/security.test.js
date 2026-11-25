import { describe, it, expect, afterEach } from 'vitest';
import { ChallengeService, generateLayout } from '../../shared/challenge-core.js';
import { MemoryStore } from '../../shared/memory-store.js';
import { ToyboxRateLimiter } from '../../shared/rate-limiter.js';
import { MockAntiBotVerifier } from '../../shared/antibot-verifiers.js';
import { ATTEMPT_STATUS, CONSUME_REASON, ANTIBOT, validateLayout, randomId, ID_BYTES } from '../../shared/protocol.js';
import { CHARACTER_IDS } from '../../shared/character-ids.js';
import { MockAdapter } from '../../src/challenge/adapters/MockAdapter.js';
import { HttpAdapter, ToyboxNetworkError } from '../../src/challenge/adapters/HttpAdapter.js';
import { createToyboxServer } from '../../server/index.js';

const PROD_SECRET = 'a-very-strong-production-secret-at-least-32-chars-long!!';
const realVerifier = { provider: 'turnstile', siteKey: 'site_123', isMock: false, verify: async ({ token }) => ({ ok: token === 'valid-ts-token' }) };

describe('HAIZ Campus Toybox — Security Layer', () => {
  const servers = [];
  afterEach(async () => {
    while (servers.length) {
      const s = servers.pop();
      await new Promise((r) => s.close(r));
    }
  });

  it('generates valid layouts over 500 random samples (chute exclusion, min distance, all 6 characters)', () => {
    for (let i = 0; i < 500; i++) {
      const layout = generateLayout();
      expect(layout).toHaveLength(CHARACTER_IDS.length);
      expect(validateLayout(layout).ok).toBe(true);
    }
  });

  it('enforces session binding, nonce match, expiry, exhaustion, replay protection, and passToken one-time use', async () => {
    let now = 1_700_000_000_000;
    const clock = () => now;
    const service = new ChallengeService({
      secret: PROD_SECRET,
      store: new MemoryStore({ clock }),
      antiBotVerifier: realVerifier,
      clock,
      demo: false,
      maxAttempts: 2,
      challengeTtlMs: 10_000,
      passTokenTtlMs: 5_000,
    });

    const sidA = randomId(ID_BYTES.sessionId);
    const sidB = randomId(ID_BYTES.sessionId);
    const created = await service.createChallenge({ sessionId: sidA, mode: 'game', ip: '1.2.3.4' });
    expect(created.ok).toBe(true);
    const ch = created.challenge;
    expect(ch.demo).toBe(false);
    const targetItem = ch.layout.find((x) => x.characterId === ch.target);
    const wrongItem = ch.layout.find((x) => x.characterId !== ch.target);

    now += 1500;

    // Session mismatch → invalid
    const badSess = await service.submitAttempt({
      sessionId: sidB, challengeId: ch.challengeId, nonce: ch.nonce,
      pick: { slot: targetItem.slot, characterId: targetItem.characterId },
      antiBotToken: 'valid-ts-token', elapsedMs: 1500, ip: '1.2.3.4',
    });
    expect(badSess.status).toBe(ATTEMPT_STATUS.INVALID);

    // Nonce mismatch → invalid
    const badNonce = await service.submitAttempt({
      sessionId: sidA, challengeId: ch.challengeId, nonce: randomId(ID_BYTES.nonce),
      pick: { slot: targetItem.slot, characterId: targetItem.characterId },
      antiBotToken: 'valid-ts-token', elapsedMs: 1500, ip: '1.2.3.4',
    });
    expect(badNonce.status).toBe(ATTEMPT_STATUS.INVALID);

    // Anti-bot failure happens BEFORE pick judgment
    const badBot = await service.submitAttempt({
      sessionId: sidA, challengeId: ch.challengeId, nonce: ch.nonce,
      pick: { slot: targetItem.slot, characterId: targetItem.characterId },
      antiBotToken: 'bad-token', elapsedMs: 1500, ip: '1.2.3.4',
    });
    expect(badBot.status).toBe(ATTEMPT_STATUS.ANTIBOT_FAILED);
    expect(badBot.attemptsLeft).toBe(1);

    // Correct pick on remaining attempt → passed + one-time passToken
    const ok = await service.submitAttempt({
      sessionId: sidA, challengeId: ch.challengeId, nonce: ch.nonce,
      pick: { slot: targetItem.slot, characterId: targetItem.characterId },
      antiBotToken: 'valid-ts-token', elapsedMs: 1500, ip: '1.2.3.4',
    });
    expect(ok.status).toBe(ATTEMPT_STATUS.PASSED);
    expect(ok.passToken).toBeTruthy();
    expect(ok.passToken.startsWith('demo_')).toBe(false);

    // Replay of passed challenge → invalid
    const replay = await service.submitAttempt({
      sessionId: sidA, challengeId: ch.challengeId, nonce: ch.nonce,
      pick: { slot: targetItem.slot, characterId: targetItem.characterId },
      antiBotToken: 'valid-ts-token', elapsedMs: 1500, ip: '1.2.3.4',
    });
    expect(replay.status).toBe(ATTEMPT_STATUS.INVALID);

    // Wrong session cannot consume passToken (and consuming burns it!)
    const wrongConsume = await service.consumePassToken({ passToken: ok.passToken, sessionId: sidB });
    expect(wrongConsume.ok).toBe(false);
    expect(wrongConsume.reason).toBe(CONSUME_REASON.SESSION_MISMATCH);

    // Second challenge: test valid one-time passToken consume + replay rejection
    const c2 = (await service.createChallenge({ sessionId: sidA, mode: 'accessible' })).challenge;
    const t2 = c2.layout.find((x) => x.characterId === c2.target);
    now += 1000;
    const p2 = await service.submitAttempt({
      sessionId: sidA, challengeId: c2.challengeId, nonce: c2.nonce,
      pick: { slot: t2.slot, characterId: t2.characterId },
      antiBotToken: 'valid-ts-token', elapsedMs: 1000,
    });
    const firstConsume = await service.consumePassToken({ passToken: p2.passToken, sessionId: sidA });
    expect(firstConsume).toMatchObject({ ok: true, demo: false, mode: 'accessible' });
    const secondConsume = await service.consumePassToken({ passToken: p2.passToken, sessionId: sidA });
    expect(secondConsume.ok).toBe(false);
    expect(secondConsume.reason).toBe(CONSUME_REASON.NOT_FOUND);

    // Expiry test
    const c3 = (await service.createChallenge({ sessionId: sidA, mode: 'game' })).challenge;
    now += 15_000;
    const exp = await service.submitAttempt({
      sessionId: sidA, challengeId: c3.challengeId, nonce: c3.nonce,
      pick: { slot: wrongItem.slot, characterId: wrongItem.characterId },
      antiBotToken: 'valid-ts-token', elapsedMs: 15_000,
    });
    expect(exp.status).toBe(ATTEMPT_STATUS.EXPIRED);
  });

  it('rejects demo passTokens in a production service and refuses mock verifier in production', async () => {
    expect(() => new ChallengeService({ secret: PROD_SECRET, antiBotVerifier: new MockAntiBotVerifier(), demo: false })).toThrow();
    expect(() => createToyboxServer({ mode: 'production', env: {} })).toThrow();

    let now = 1_700_000_000_000;
    const demoSvc = new ChallengeService({ demo: true, antiBotVerifier: new MockAntiBotVerifier(), clock: () => now });
    const prodSvc = new ChallengeService({ secret: PROD_SECRET, demo: false, antiBotVerifier: realVerifier, clock: () => now });
    const sid = randomId(ID_BYTES.sessionId);
    const ch = (await demoSvc.createChallenge({ sessionId: sid, mode: 'game' })).challenge;
    const t = ch.layout.find((x) => x.characterId === ch.target);
    now += 1000;
    const res = await demoSvc.submitAttempt({
      sessionId: sid, challengeId: ch.challengeId, nonce: ch.nonce,
      pick: { slot: t.slot, characterId: t.characterId },
      antiBotToken: ANTIBOT.mockToken, elapsedMs: 1000,
    });
    expect(res.demo).toBe(true);
    expect(res.passToken.startsWith('demo_')).toBe(true);
    const prodCheck = await prodSvc.consumePassToken({ passToken: res.passToken, sessionId: sid });
    expect(prodCheck.ok).toBe(false);
    expect(prodCheck.reason).toBe(CONSUME_REASON.DEMO_TOKEN);
  });

  it('rate limits bursts and supports MockAdapter AbortSignal + HttpAdapter 429/timeout', async () => {
    const rl = new ToyboxRateLimiter({
      clock: () => 1000,
      limits: { create: { ip: { capacity: 1, refillPerSec: 0.01 }, session: { capacity: 5, refillPerSec: 1 } } },
    });
    const svc = new ChallengeService({ demo: true, antiBotVerifier: new MockAntiBotVerifier(), rateLimiter: rl });
    const sid = randomId(ID_BYTES.sessionId);
    expect((await svc.createChallenge({ sessionId: sid, mode: 'game', ip: '9.9.9.9' })).ok).toBe(true);
    const blocked = await svc.createChallenge({ sessionId: sid, mode: 'game', ip: '9.9.9.9' });
    expect(blocked.ok).toBe(false);
    expect(blocked.status).toBe(ATTEMPT_STATUS.RATE_LIMITED);

    // MockAdapter abort
    const mock = new MockAdapter({ latencyMs: 100, allowInProd: true });
    const ac = new AbortController();
    const p = mock.createChallenge({ mode: 'game', signal: ac.signal });
    ac.abort();
    await expect(p).rejects.toThrow();

    // HttpAdapter 429 mapping
    const fakeFetch = async () => new Response(JSON.stringify({ status: 'rate_limited', retryAfterMs: 3000, demo: false }), {
      status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '3' },
    });
    const httpAdapter = new HttpAdapter({ baseUrl: 'http://example.test/api/toybox', fetchImpl: fakeFetch });
    const r429 = await httpAdapter.submitAttempt({ challengeId: 'abc', nonce: 'def', pick: { slot: 0, characterId: 'lanren' }, antiBotToken: 'x', elapsedMs: 1000 });
    expect(r429.status).toBe(ATTEMPT_STATUS.RATE_LIMITED);
    expect(r429.retryAfterMs).toBe(3000);

    // HttpAdapter network failure → ToyboxNetworkError
    const errAdapter = new HttpAdapter({ baseUrl: 'http://example.test', fetchImpl: async () => { throw new TypeError('offline'); } });
    await expect(errAdapter.createChallenge({ mode: 'game' })).rejects.toBeInstanceOf(ToyboxNetworkError);
  });

  it('runs full HTTP integration flow with HttpOnly cookie, /api/demo/login, and Origin rejection', async () => {
    let now = 1_700_000_000_000;
    const { server } = createToyboxServer({
      mode: 'demo',
      clock: () => now,
      allowedOrigins: 'http://allowed.test',
    });
    servers.push(server);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}`;

    // Disallowed Origin → 403
    const badOrigin = await fetch(`${base}/api/toybox/challenges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://evil.test' },
      body: JSON.stringify({ mode: 'game' }),
    });
    expect(badOrigin.status).toBe(403);

    // Create challenge
    const createRes = await fetch(`${base}/api/toybox/challenges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://allowed.test' },
      body: JSON.stringify({ mode: 'game' }),
    });
    expect(createRes.status).toBe(201);
    const cookie = createRes.headers.get('set-cookie')?.split(';')[0];
    expect(cookie).toContain('hz_tbx_sid=');
    const ch = await createRes.json();
    const targetItem = ch.layout.find((x) => x.characterId === ch.target);

    now += 1200;
    const attRes = await fetch(`${base}/api/toybox/challenges/${ch.challengeId}/attempts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://allowed.test', Cookie: cookie },
      body: JSON.stringify({
        nonce: ch.nonce,
        pick: { slot: targetItem.slot, characterId: targetItem.characterId },
        antiBotToken: ANTIBOT.mockToken,
        elapsedMs: 1200,
      }),
    });
    expect(attRes.status).toBe(200);
    const att = await attRes.json();
    expect(att.status).toBe(ATTEMPT_STATUS.PASSED);

    // Server-side demo login consumes passToken once
    const login1 = await fetch(`${base}/api/demo/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://allowed.test', Cookie: cookie },
      body: JSON.stringify({ username: 'student', passToken: att.passToken }),
    });
    expect(login1.status).toBe(200);
    expect(await login1.json()).toMatchObject({ ok: true, demo: true });

    const login2 = await fetch(`${base}/api/demo/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://allowed.test', Cookie: cookie },
      body: JSON.stringify({ username: 'student', passToken: att.passToken }),
    });
    expect(login2.status).toBe(403);
  });
});

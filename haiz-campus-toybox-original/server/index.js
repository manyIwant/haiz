// HAIZ Campus Toybox — reference zero-dependency Node HTTP server.
// Demonstrates the full server-side challenge lifecycle, HttpOnly session cookie binding,
// rate limiting, Origin allowlist, security headers, Turnstile integration (production mode),
// and final server-side authorization (`POST /api/demo/login` in demo mode).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChallengeService } from '../shared/challenge-core.js';
import { MemoryStore } from '../shared/memory-store.js';
import { ToyboxRateLimiter } from '../shared/rate-limiter.js';
import { MockAntiBotVerifier } from '../shared/antibot-verifiers.js';
import { SESSION_COOKIE, ID_BYTES, randomId, ATTEMPT_STATUS } from '../shared/protocol.js';
import { TurnstileVerifier } from './turnstile-verifier.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIST = path.resolve(__dirname, '../dist');
const MAX_BODY_BYTES = 16 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function parseCookies(header = '') {
  const out = {};
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function readJsonBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store');
}

function sendJson(res, status, data, extraHeaders = {}) {
  setSecurityHeaders(res);
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

/**
 * Build the Toybox HTTP server from config/env.
 * In `production` mode, refuses to start without TOYBOX_HMAC_SECRET (>=32 chars),
 * TURNSTILE_SITE_KEY, and TURNSTILE_SECRET_KEY.
 */
export function createToyboxServer(opts = {}) {
  const env = opts.env || process.env;
  const mode = (opts.mode || env.TOYBOX_MODE || 'demo').toLowerCase();
  if (mode !== 'demo' && mode !== 'production') {
    throw new Error(`Invalid TOYBOX_MODE: ${mode} (expected 'demo' or 'production')`);
  }
  const isProd = mode === 'production';

  const secret = opts.hmacSecret ?? env.TOYBOX_HMAC_SECRET;
  const allowedOrigins = new Set(
    String(opts.allowedOrigins ?? env.TOYBOX_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const allowedHostnames = String(opts.allowedHostnames ?? env.TOYBOX_ALLOWED_HOSTNAMES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const trustProxy = String(opts.trustProxy ?? env.TOYBOX_TRUST_PROXY ?? 'false') === 'true';
  const staticDir = opts.staticDir ?? (fs.existsSync(DEFAULT_DIST) ? DEFAULT_DIST : null);

  let antiBotVerifier = opts.antiBotVerifier;
  if (!antiBotVerifier) {
    if (isProd) {
      const siteKey = env.TURNSTILE_SITE_KEY;
      const secretKey = env.TURNSTILE_SECRET_KEY;
      if (!siteKey || !secretKey) {
        throw new Error('Production mode requires TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY');
      }
      antiBotVerifier = new TurnstileVerifier({ secretKey, siteKey, allowedHostnames });
    } else {
      antiBotVerifier = new MockAntiBotVerifier();
    }
  }
  if (isProd && antiBotVerifier.isMock) {
    throw new Error('Production mode refuses MockAntiBotVerifier');
  }

  const clock = opts.clock || (() => Date.now());
  const store = opts.store || new MemoryStore({ clock });
  const rateLimiter = opts.rateLimiter !== undefined ? opts.rateLimiter : new ToyboxRateLimiter({ clock });
  const service = new ChallengeService({
    secret,
    store,
    antiBotVerifier,
    clock,
    demo: !isProd,
    rateLimiter,
  });

  const getIp = (req) => {
    if (trustProxy && req.headers['x-forwarded-for']) {
      return String(req.headers['x-forwarded-for']).split(',')[0].trim();
    }
    return req.socket?.remoteAddress || '127.0.0.1';
  };

  const ensureSession = (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    let sid = cookies[SESSION_COOKIE];
    if (!sid || sid.length < 20) {
      sid = randomId(ID_BYTES.sessionId);
      const secureFlag = isProd ? '; Secure' : '';
      res.setHeader(
        'Set-Cookie',
        `${SESSION_COOKIE}=${encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secureFlag}`
      );
    }
    return sid;
  };

  const checkOrigin = (req, res) => {
    const origin = req.headers.origin;
    if (!origin) return true;
    if (allowedOrigins.size > 0) {
      if (!allowedOrigins.has(origin)) {
        sendJson(res, 403, { status: ATTEMPT_STATUS.INVALID, error: 'origin_not_allowed', demo: !isProd });
        return false;
      }
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      return true;
    }
    // Same-origin default check when allowlist is not explicitly configured
    const host = req.headers.host;
    try {
      const u = new URL(origin);
      if (host && u.host !== host) {
        sendJson(res, 403, { status: ATTEMPT_STATUS.INVALID, error: 'origin_mismatch', demo: !isProd });
        return false;
      }
    } catch {
      sendJson(res, 403, { status: ATTEMPT_STATUS.INVALID, error: 'invalid_origin', demo: !isProd });
      return false;
    }
    return true;
  };

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const p = url.pathname;

      if (req.method === 'OPTIONS' && p.startsWith('/api/')) {
        if (!checkOrigin(req, res)) return;
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.writeHead(204);
        res.end();
        return;
      }

      // ── Health endpoint
      if (req.method === 'GET' && p === '/api/toybox/health') {
        return sendJson(res, 200, { ok: true, mode, demo: !isProd });
      }

      // ── API endpoints (all require Origin check)
      if (p.startsWith('/api/')) {
        if (!checkOrigin(req, res)) return;

        // POST /api/toybox/challenges
        if (req.method === 'POST' && p === '/api/toybox/challenges') {
          const body = await readJsonBody(req);
          const sessionId = ensureSession(req, res);
          const out = await service.createChallenge({
            sessionId,
            mode: body.mode === 'accessible' ? 'accessible' : 'game',
            ip: getIp(req),
          });
          if (!out.ok) {
            const code = out.status === ATTEMPT_STATUS.RATE_LIMITED ? 429 : 400;
            const headers = out.retryAfterMs ? { 'Retry-After': String(Math.ceil(out.retryAfterMs / 1000)) } : {};
            return sendJson(res, code, out, headers);
          }
          return sendJson(res, 201, out.challenge);
        }

        // POST /api/toybox/challenges/:id/attempts
        const attMatch = p.match(/^\/api\/toybox\/challenges\/([A-Za-z0-9_-]+)\/attempts$/);
        if (req.method === 'POST' && attMatch) {
          const body = await readJsonBody(req);
          const sessionId = ensureSession(req, res);
          const result = await service.submitAttempt({
            sessionId,
            challengeId: attMatch[1],
            nonce: body.nonce,
            pick: body.pick,
            antiBotToken: body.antiBotToken ?? null,
            elapsedMs: body.elapsedMs,
            ip: getIp(req),
          });
          const code = result.status === ATTEMPT_STATUS.RATE_LIMITED ? 429 : 200;
          const headers = result.retryAfterMs ? { 'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)) } : {};
          return sendJson(res, code, result, headers);
        }

        // DELETE /api/toybox/challenges/:id
        const delMatch = p.match(/^\/api\/toybox\/challenges\/([A-Za-z0-9_-]+)$/);
        if (req.method === 'DELETE' && delMatch) {
          const sessionId = ensureSession(req, res);
          await service.cancelChallenge({ sessionId, challengeId: delMatch[1] });
          setSecurityHeaders(res);
          res.writeHead(204);
          res.end();
          return;
        }

        // POST /api/demo/login (demo-only endpoint demonstrating final server-side authorization)
        if (req.method === 'POST' && p === '/api/demo/login') {
          if (isProd) return sendJson(res, 404, { error: 'not_found' });
          const body = await readJsonBody(req);
          const sessionId = ensureSession(req, res);
          const verdict = await service.consumePassToken({
            passToken: body.passToken,
            sessionId,
          });
          if (!verdict.ok) {
            return sendJson(res, 403, { ok: false, demo: true, reason: verdict.reason });
          }
          return sendJson(res, 200, {
            ok: true,
            demo: true,
            message: 'DEMO ONLY — real production login requires TOYBOX_MODE=production and demo:false verdict.',
            mode: verdict.mode,
          });
        }

        return sendJson(res, 404, { error: 'not_found' });
      }

      // ── Optional static file serving when dist/ exists
      if (staticDir && (req.method === 'GET' || req.method === 'HEAD')) {
        const rel = p === '/' ? '/index.html' : p;
        const resolved = path.resolve(staticDir, '.' + rel);
        if (!resolved.startsWith(staticDir)) {
          res.writeHead(403); res.end('Forbidden'); return;
        }
        if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
          const ext = path.extname(resolved).toLowerCase();
          res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
          if (req.method === 'HEAD') { res.end(); return; }
          fs.createReadStream(resolved).pipe(res);
          return;
        }
      }

      res.writeHead(404);
      res.end('Not found');
    } catch (err) {
      const code = err?.statusCode || 500;
      sendJson(res, code, { status: ATTEMPT_STATUS.ERROR, error: code === 500 ? 'internal_error' : err.message });
    }
  });

  return { server, service, store, mode, isProd };
}

// Direct CLI execution
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8787);
  const { server, mode } = createToyboxServer();
  server.listen(port, '0.0.0.0', () => {
    console.log(`[HAIZ Toybox Server] listening on http://localhost:${port} (mode=${mode})`);
  });
}

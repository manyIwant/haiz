/** Same-origin teacher workspace proxy. Academic owns authentication and assignment data. */
import { createServer } from 'node:http';
import { createReadStream, lstatSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const HOST = process.env.HAIZ_TEACHER_HOST ?? '127.0.0.1';
const PORT = Number(process.env.HAIZ_TEACHER_PORT ?? 8781);
const DEFAULT_ACADEMIC = 'http://127.0.0.1:8780';
const MAX_PROXY_BODY = 120_000;
const MAX_UPSTREAM_BODY = 4_000_000;
const UPSTREAM_TIMEOUT_MS = 12_000;
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);
const PAGES = new Set(['/', '/index.html', '/classroom.html']);
const CONSOLE_ASSETS = new Map([
  ['/academic/', '/index.html'],
  ['/academic/index.html', '/index.html'],
  ['/academic/app.js', '/app.js'],
  ['/academic/ui.css', '/ui.css'],
]);
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function securityHeaders(isDocument) {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    ...(isDocument ? {
      'Content-Security-Policy': [
        "default-src 'self'", "script-src 'self'", "style-src 'self'",
        "img-src 'self' data:", "font-src 'self'", "connect-src 'self'",
        "form-action 'self'", "base-uri 'none'", "object-src 'none'", "frame-ancestors 'none'",
      ].join('; '),
    } : {}),
  };
}

function sendJson(res, status, code, message) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...securityHeaders(false),
  });
  res.end(JSON.stringify({ state: 'Failed', data: null, error: { code, message }, meta: {} }));
}

function resolveAsset(pathname) {
  const path = pathname === '/' ? '/index.html' : pathname;
  // URL escapes and additional directories are deliberately not accepted as asset aliases.
  if (!PAGES.has(path) && !/^\/(?:js\/[a-z0-9-]+\.js|css\/[a-z0-9-]+\.css)$/.test(path)) return null;
  const segments = path.slice(1).split('/');
  try {
    for (let depth = 1; depth <= segments.length; depth++) {
      const entry = resolve(ROOT, ...segments.slice(0, depth));
      if (!entry.startsWith(ROOT + sep) || lstatSync(entry).isSymbolicLink()) return null;
    }
    const target = resolve(ROOT, ...segments);
    return lstatSync(target).isFile() ? target : null;
  } catch { return null; }
}

async function readLimited(stream, limit) {
  const chunks = [];
  let length = 0;
  for await (const chunk of stream) {
    length += chunk.length;
    if (length > limit) throw new Error('Body exceeds configured limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function crossSiteWrite(req) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return false;
  const site = req.headers['sec-fetch-site'];
  if (site && !['same-origin', 'none'].includes(site)) return true;
  if (!req.headers.origin) return false; // Non-browser API clients are authenticated by Academic.
  try {
    const origin = new URL(req.headers.origin);
    return !['http:', 'https:'].includes(origin.protocol) || origin.host !== req.headers.host;
  } catch { return true; }
}

function legacyPublication(path, method) {
  if (method === 'POST' && /^\/api\/classes\/[^/]+\/(?:assignments|inbox\/[^/]+\/publish)$/.test(path)) return true;
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && /^\/api\/assignments\/[^/]+$/.test(path);
}

function upstreamOrigin(value) {
  const origin = new URL(value);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password
      || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('Academic origin must be an HTTP origin without credentials, path, query or fragment');
  }
  return origin.origin;
}

/**
 * @param {{academicOrigin?:string, upstreamTimeoutMs?:number}} options Fixed trusted deployment settings.
 * @returns {import('node:http').Server}
 */
export function createTeacherServer({
  academicOrigin = process.env.HAIZ_ACADEMIC_ORIGIN ?? DEFAULT_ACADEMIC,
  upstreamTimeoutMs = UPSTREAM_TIMEOUT_MS,
} = {}) {
  const academic = upstreamOrigin(academicOrigin);
  if (!Number.isSafeInteger(upstreamTimeoutMs) || upstreamTimeoutMs < 1) throw new Error('Invalid upstream timeout');

  async function proxy(req, res, path, { document = false } = {}) {
    if (crossSiteWrite(req)) return sendJson(res, 403, 'CROSS_SITE', '跨站请求被拒绝。');
    if (legacyPublication(new URL(path, academic).pathname, req.method)) {
      return sendJson(res, 409, 'USE_ONE_PUBLISH', '请回到教师工作台，通过检查、确认流程发布或修改作业。');
    }
    let body;
    try { body = await readLimited(req, MAX_PROXY_BODY); }
    catch { return sendJson(res, 413, 'BODY_TOO_LARGE', '请求体过大。'); }
    const headers = Object.fromEntries(['content-type', 'cookie', 'idempotency-key', 'authorization']
      .filter(name => typeof req.headers[name] === 'string').map(name => [name, req.headers[name]]));
    let upstream;
    let content;
    try {
      const expectedActor = req.headers['x-haiz-expected-actor'];
      if (expectedActor !== undefined) {
        let expected;
        try { expected = JSON.parse(decodeURIComponent(expectedActor)); } catch { return sendJson(res, 400, 'INVALID_ACTOR', '身份检查格式无效。'); }
        if (!Array.isArray(expected) || expected.length !== 2 || !expected.every(value => typeof value === 'string' && value.length > 0 && value.length <= 200)) {
          return sendJson(res, 400, 'INVALID_ACTOR', '身份检查格式无效。');
        }
        const check = await fetch(academic + '/api/v1/identity', {
          headers: { accept: 'application/json', ...(headers.cookie ? { cookie: headers.cookie } : {}) },
          redirect: 'manual', signal: AbortSignal.timeout(upstreamTimeoutMs),
        });
        const identity = JSON.parse((await readLimited(check.body, MAX_UPSTREAM_BODY)).toString('utf8'));
        if (!check.ok || identity.data?.instanceId !== expected[0] || identity.data?.userId !== expected[1]) {
          return sendJson(res, 401, 'IDENTITY_CHANGED', '登录身份已变化，操作未转发。请重新登录原账号后恢复原请求。');
        }
      }
      upstream = await fetch(academic + path, {
        method: req.method,
        headers: { accept: document ? 'text/html' : 'application/json', ...headers },
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
        redirect: 'manual',
        signal: AbortSignal.timeout(upstreamTimeoutMs),
      });
      content = upstream.body ? await readLimited(upstream.body, MAX_UPSTREAM_BODY) : Buffer.alloc(0);
    } catch {
      return sendJson(res, 503, 'ACADEMIC_UNAVAILABLE', '教务服务暂时无法连接，操作结果未知，请使用原请求恢复。');
    }
    if (document && upstream.ok) {
      content = Buffer.from(content.toString('utf8')
        .replace('href="/ui.css"', 'href="/academic/ui.css"')
        .replace('src="/app.js"', 'src="/academic/app.js"'));
    }
    const cookies = upstream.headers.getSetCookie();
    res.writeHead(upstream.status, {
      ...securityHeaders(document),
      'Cache-Control': 'no-store',
      'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      ...(cookies.length ? { 'Set-Cookie': cookies } : {}),
    });
    res.end(content);
  }

  function serveAsset(req, res, url) {
    const target = resolveAsset(url.pathname);
    if (!target) return sendJson(res, 404, 'NOT_FOUND', '没有这个页面，请回到教师工作台。');
    res.writeHead(200, {
      'Content-Type': CONTENT_TYPES[extname(target)],
      'Cache-Control': 'no-store',
      ...securityHeaders(PAGES.has(url.pathname)),
    });
    if (req.method === 'HEAD') return res.end();
    const stream = createReadStream(target);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  }

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://placeholder');
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        return await proxy(req, res, url.pathname + url.search);
      }
      if (!['GET', 'HEAD'].includes(req.method)) return sendJson(res, 405, 'METHOD_NOT_ALLOWED', '不支持的请求方法。');
      const consolePath = CONSOLE_ASSETS.get(url.pathname);
      if (consolePath) return await proxy(req, res, consolePath, { document: consolePath === '/index.html' });
      return serveAsset(req, res, url);
    } catch {
      if (!res.headersSent) sendJson(res, 500, 'TEACHER_PROXY_ERROR', '工作台出现内部错误。');
      else res.destroy();
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  if (!LOOPBACK.has(HOST)) throw new Error('HAIZ Teacher only binds to localhost; terminate HTTPS in a reviewed reverse proxy');
  createTeacherServer().listen(PORT, HOST, () => {
    process.stdout.write(`[HAIZ Teacher] http://${HOST}:${PORT} → ${process.env.HAIZ_ACADEMIC_ORIGIN ?? DEFAULT_ACADEMIC}\n`);
  });
}

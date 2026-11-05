import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, unlink, realpath } from 'node:fs/promises';
import { randomUUID, randomBytes } from 'node:crypto';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';
import { isIP } from 'node:net';
import { openDatabase } from './database.mjs';
import { fail, check, object, username, text } from './errors.mjs';
import { hash, secret, passwords, rateLimiter } from './auth.mjs';
import { createRooms } from './rooms.mjs';
import { staticHandler } from './static.mjs';
import { serveAccount } from './web.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
export async function createService({ directory = path.join(ROOT, '.haiz-data'), development = false,
  publicOrigin, behindProxy = false, port = 8790, sessionMs = 8 * 3600000, inviteMs = 30 * 60000,
  authLimit = 30, registration = true, logger = entry => console.log(JSON.stringify(entry)), root = ROOT } = {}) {
  const dataPath = path.resolve(directory);
  check(![path.join(root, 'public'), path.join(root, 'dist')].some(p => dataPath === p || dataPath.startsWith(p + path.sep)), 500, '数据目录必须位于静态目录之外');
  let origin = publicOrigin ? new URL(publicOrigin) : null;
  check(development || (origin?.protocol === 'https:' && behindProxy), 500, '生产服务需要 HTTPS 来源与本机反向代理');
  check(!origin || (origin.pathname === '/' && !origin.search && !origin.hash && !origin.username && !origin.password), 500, '服务来源须为独立来源');
  check(!development || !origin || (origin.protocol === 'http:' && LOOPBACK.has(origin.hostname)), 500, '开发模式仅允许本机 HTTP 来源');
  check(Number.isInteger(port) && port >= 0 && port <= 65535 && sessionMs > 0 && inviteMs > 0, 500, '服务配置无效');
  const database = await openDatabase(dataPath);
  const bootstrapFile = path.join(dataPath, 'bootstrap-invite.txt');
  let bootstrap;
  try { bootstrap = (await readFile(bootstrapFile, 'utf8')).trim(); }
  catch (error) { if (error.code !== 'ENOENT') { await database.close(); throw error; } }
  bootstrap ||= secret();
  // Write the secret before committing the first admin, so a crash cannot strand it.
  try {
    await writeFile(bootstrapFile, bootstrap, { flag: 'wx', mode: 0o600 });
  } catch (error) { if (error.code !== 'EEXIST') { await database.close(); throw error; } }
  const initialized = await database.call('bootstrap', { tokenHash: hash(bootstrap), inviteMs });
  if (!initialized.created) await unlink(bootstrapFile).catch(() => {});
  const authPasswords = passwords(), limits = rateLimiter(), rooms = createRooms(database), serveStatic = staticHandler(root, await realpath(dataPath));
  const histogram = monitorEventLoopDelay({ resolution: 20 }); histogram.enable();
  const counters = { requests: 0, errors: 0, active: 0 }; const started = Date.now();
  let closing = false, closePromise;
  const cookieName = development ? 'haiz_session' : '__Host-haiz_session';
  const cookie = (value, seconds, persistent = true) => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict${development ? '' : '; Secure'}${persistent ? '; Max-Age=' + seconds : ''}`;
  const getToken = req => String(req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(cookieName + '='))?.slice(cookieName.length + 1) || '';
  const json = async req => {
    check(/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || ''), 415, '只接受 application/json');
    check(!req.headers['content-encoding'] || req.headers['content-encoding'] === 'identity', 415, '不接受压缩请求体');
    check(!req.headers['content-length'] || Number(req.headers['content-length']) <= 65536, 413, '请求体过大');
    const chunks = []; let size = 0;
    const timeout = setTimeout(() => req.destroy(), 8000); timeout.unref();
    try {
      for await (const part of req) { size += part.length; check(size <= 65536, 413, '请求体过大'); chunks.push(part); }
    } finally { clearTimeout(timeout); }
    const raw = Buffer.concat(chunks).toString('utf8'); let value;
    try { value = JSON.parse(raw); } catch { throw fail(400, 'JSON 无效'); }
    return { input: object(value), raw };
  };
  const reply = (res, status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  };
  async function handler(req, res) {
    const requestId = randomUUID(), start = performance.now(); counters.requests++; counters.active++;
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin'); res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    if (!development) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    const nonce = randomBytes(16).toString('base64');
    // Existing campus pages use classic inline modules and WebGL; new APIs never accept HTML.
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; frame-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
    let category = 'unmatched';
    const finished = () => {
      counters.active--;
      if (res.statusCode >= 500) counters.errors++;
      logger({ event: 'request', requestId, method: req.method, category, status: res.statusCode, durationMs: Math.round((performance.now() - start) * 100) / 100 });
    };
    res.once('close', finished);
    try {
      check(!closing, 503, '服务正在关闭');
      check(counters.active <= 512, 503, '服务繁忙');
      check(origin && req.headers.host === origin.host, 403, '来源主机不匹配');
      check(!req.headers.origin || req.headers.origin === origin.origin, 403, '拒绝跨来源请求');
      check(!req.headers['sec-fetch-site'] || req.headers['sec-fetch-site'] !== 'cross-site', 403, '拒绝跨站请求');
      const url = new URL(req.url, origin);
      check(url.origin === origin.origin, 403, '请求来源无效');
      const authAliases = { '/api/auth/login': '/api/v1/auth/login', '/api/auth/register': '/api/v1/auth/register', '/api/auth/session': '/api/v1/auth/me', '/api/auth/logout': '/api/v1/auth/logout' };
      const route = authAliases[url.pathname] || url.pathname;
      let address = req.socket.remoteAddress;
      if (!development && behindProxy) {
        // Caddy must overwrite this dedicated header; never trust public X-Forwarded-For.
        const clientIP = req.headers['x-haiz-client-ip'];
        check(LOOPBACK.has(address) && typeof clientIP === 'string' && isIP(clientIP) !== 0, 403, '缺少受信任代理身份');
        address = clientIP;
      }
      if (['GET', 'HEAD'].includes(req.method) && !route.startsWith('/api/')) {
        category = 'static';
        if (['/account/', '/account/index.html'].includes(route)) {
          try { await database.call('authenticate', { tokenHash: hash(getToken(req)) }); }
          catch (error) {
            if (error.status !== 401) throw error;
            res.writeHead(302, { Location: '/login/?next=' + encodeURIComponent('/account/'), 'Cache-Control': 'no-store' }); res.end(); return;
          }
        }
        if (await serveAccount(req, res, route)) return;
        if (['/login', '/account'].includes(route)) {
          res.writeHead(302, { Location: route === '/login' ? '/login/' : '/account/', 'Cache-Control': 'no-store' }); res.end(); return;
        }
        if (route.endsWith('/sw.js') || route.endsWith('/flutter_service_worker.js')) {
          res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end("self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.registration.unregister().then(()=>self.clients.claim())));"); return;
        }
        let decodedPath; try { decodedPath = decodeURIComponent(route); } catch { throw fail(400, '地址无效'); }
        if (decodedPath.endsWith('/') || decodedPath.toLowerCase().endsWith('.html')) {
          try { req.haizIdentity = (await database.call('authenticate', { tokenHash: hash(getToken(req)) })).identity.id; }
          catch (error) {
            if (error.status !== 401) throw error;
            res.writeHead(302, { Location: '/login/?next=' + encodeURIComponent(route + url.search), 'Cache-Control': 'no-store' }); res.end(); return;
          }
        }
        if (route === '/haiz-client.js') {
          res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' });
          res.end(req.method === 'HEAD' ? undefined : await readFile(new URL('./client.mjs', import.meta.url))); return;
        }
        if (await serveStatic(req, res, route, nonce)) return;
        throw fail(404, '页面不存在');
      }
      check(['GET', 'POST', 'PUT', 'DELETE'].includes(req.method), 405, '方法不支持');
      if (req.method !== 'GET') check(req.headers.origin === origin.origin, 403, '修改操作必须带匹配 Origin');
      limits.take('ip:' + address, 1200);
      if (route === '/api/health' && req.method === 'GET') { category = 'health'; return reply(res, 200, { ok: true, service: 'haiz', version: '1.0.0' }); }
      if (route === '/api/ready' && req.method === 'GET') { category = 'ready'; return reply(res, 200, await database.call('ready')); }
      if (route === '/api/v1/auth/config' && req.method === 'GET') return reply(res, 200, { registration, loginRequired: true });
      check(/^\/api\/(?:flow\/(?:login|logout|me|drafts|workspace|feed|publish|revoke|admin(?:\/(?:invite|revoke))?)|v1\/(?:auth\/(?:register|login|logout|logout-all|me|password|sessions|revoke|account)|admin\/metrics|data\/[^/]+(?:\/[^/]+)?|rooms(?:\/[^/]+\/(?:events|position|messages))?))$/.test(route), 404, '接口不存在');
      const isInviteLogin = route === '/api/flow/login';
      if (['/api/v1/auth/register', '/api/v1/auth/login'].includes(route) || isInviteLogin) {
        category = 'auth'; check(req.method === 'POST', 405, '方法不支持');
        limits.take('auth-ip:' + address, authLimit);
        const { input } = await json(req); const token = secret(); let result;
        if (isInviteLogin) result = await database.call('claimInvite', { inviteHash: hash(text(input.invite, 100, true)), tokenHash: hash(token), sessionMs });
        else {
          const name = username(input.username); limits.take('auth-user:' + name, 15);
          if (route.endsWith('/register')) {
            check(registration, 403, '公开注册尚未开启，请使用邀请');
            result = await database.call('register', { name, passwordHash: await authPasswords.create(input.password), tokenHash: hash(token), sessionMs });
          } else {
            const credential = await database.call('credentials', { name });
            check(await authPasswords.verify(input.password, credential?.passwordHash), 401, '账号或密码无效');
            result = await database.call('login', { userId: credential.id, credentialHash: credential.passwordHash, tokenHash: hash(token), sessionMs });
          }
        }
        if (result.identity.role === 'admin') await unlink(bootstrapFile).catch(() => {});
        res.setHeader('Set-Cookie', cookie(token, Math.ceil(sessionMs / 1000), input.remember !== false));
        const { sessionId, ...publicResult } = result;
        return reply(res, route.endsWith('/register') ? 201 : 200, { ...publicResult, authenticated: true });
      }
      check(route.startsWith('/api/'), 404, '接口不存在');
      const token = getToken(req); check(/^[\w-]{43}$/.test(token), 401, '请先登录');
      const auth = await database.call('authenticate', { tokenHash: hash(token) }), who = auth.identity;
      res.setHeader('X-HAIZ-User', who.id);
      check(!req.headers['x-haiz-user'] || req.headers['x-haiz-user'] === who.id, 409, '账号已变化，请重新确认登录状态', { identityChanged: true });
      const authorizedCall = (operation, args = {}) => database.call(operation, { ...args, who, sessionId: auth.sessionId });
      limits.take('session:' + auth.sessionId, 600);
      if (['/api/v1/auth/me', '/api/flow/me'].includes(route) && req.method === 'GET') {
        category = 'me'; const credential = await database.call('credentials', { name: who.name });
        return reply(res, 200, { identity: who, authenticated: true, hasPassword: Boolean(credential?.passwordHash), expiresAt: auth.expiresAt, demo: false, serverTime: new Date().toISOString() });
      }
      if (route === '/api/v1/auth/sessions' && req.method === 'GET') { category = 'sessions'; return reply(res, 200, await authorizedCall('sessions')); }
      if (route === '/api/v1/auth/revoke' && req.method === 'POST') {
        category = 'revoke-own'; const { input } = await json(req);
        const result = await authorizedCall('revokeOwn', { id: input.id }); rooms.closeSession(input.id);
        if (input.id === auth.sessionId) res.setHeader('Set-Cookie', cookie('', 0));
        return reply(res, 200, result);
      }
      if (route === '/api/v1/auth/logout-all' && req.method === 'POST') {
        category = 'logout-all'; const result = await authorizedCall('logoutAll'); rooms.closeUser(who.id);
        res.setHeader('Set-Cookie', cookie('', 0)); return reply(res, 200, result);
      }
      if (route === '/api/v1/auth/account' && req.method === 'DELETE') {
        category = 'delete-account'; limits.take('account-delete:' + who.id, 5);
        const { input } = await json(req), credential = await database.call('credentials', { name: who.name });
        check(await authPasswords.verify(input.password, credential?.passwordHash), 401, '密码无效');
        const result = await authorizedCall('deleteAccount', { expectedHash: credential.passwordHash, confirm: input.confirm });
        rooms.closeUser(who.id); res.setHeader('Set-Cookie', cookie('', 0)); return reply(res, 200, result);
      }
      if (['/api/v1/auth/logout', '/api/flow/logout'].includes(route) && req.method === 'POST') {
        category = 'logout'; await database.call('logout', { sessionId: auth.sessionId }); rooms.closeSession(auth.sessionId);
        res.setHeader('Set-Cookie', cookie('', 0)); return reply(res, 200, { ok: true });
      }
      if (route === '/api/v1/auth/password' && req.method === 'POST') {
        category = 'password'; limits.take('password:' + who.id, 5);
        const { input } = await json(req), credential = await database.call('credentials', { name: who.name });
        if (credential.passwordHash) check(await authPasswords.verify(input.currentPassword, credential.passwordHash), 401, '当前密码无效');
        const result = await authorizedCall('password', { expectedHash: credential.passwordHash, passwordHash: await authPasswords.create(input.password) });
        rooms.closeUser(who.id); res.setHeader('Set-Cookie', cookie('', 0)); return reply(res, 200, result);
      }
      if (route === '/api/v1/admin/metrics' && req.method === 'GET') {
        category = 'metrics'; check(who.role === 'admin', 403, '需要管理员权限');
        return reply(res, 200, { ...await authorizedCall('metrics'), ...rooms.metrics, ...counters, uptimeSeconds: Math.floor((Date.now() - started) / 1000), databaseQueue: database.pending, eventLoopP99Ms: Number((histogram.percentile(99) / 1e6).toFixed(2)), memoryBytes: process.memoryUsage().rss });
      }
      if (route === '/api/flow/admin' || route.startsWith('/api/flow/admin/')) {
        category = 'admin'; check(who.role === 'admin', 403, '需要管理员权限');
        if (route === '/api/flow/admin' && req.method === 'GET') return reply(res, 200, await authorizedCall('admin'));
        check(req.method === 'POST', 405, '方法不支持');
        const { input } = await json(req);
        if (route.endsWith('/invite')) {
          const invitation = secret(), result = await authorizedCall('invite', { input, tokenHash: hash(invitation), inviteMs });
          return reply(res, 201, { ...result, invite: invitation });
        }
        if (route.endsWith('/revoke')) {
          const result = await authorizedCall('revoke', { id: input.id }); rooms.closeSession(input.id); return reply(res, 200, result);
        }
        throw fail(404, '管理接口不存在');
      }
      const dataRoute = /^\/api\/v1\/data\/([^/]+)(?:\/([^/]+))?$/.exec(route);
      if (dataRoute) {
        category = 'personal-data';
        const { input } = req.method === 'GET' ? {} : await json(req);
        const result = await authorizedCall('personal', { method: req.method, collection: dataRoute[1], id: dataRoute[2], input, limit: Number(url.searchParams.get('limit') || 100), cursor: url.searchParams.get('cursor') || '' });
        return reply(res, 200, result);
      }
      if (route === '/api/v1/rooms' && req.method === 'GET') { category = 'rooms'; return reply(res, 200, { rooms: ['campus', ...who.scopes.filter(s => s !== 'campus').map(s => 'class:' + s)] }); }
      const roomRoute = /^\/api\/v1\/rooms\/([^/]+)\/(events|position|messages)$/.exec(route);
      if (roomRoute) {
        category = 'room'; let room; try { room = decodeURIComponent(roomRoute[1]); } catch { throw fail(400, '房间无效'); }
        check(room.length <= 90, 400, '房间无效');
        if (roomRoute[2] === 'events') {
          check(req.method === 'GET', 405, '方法不支持');
          check(!url.searchParams.has('user') || url.searchParams.get('user') === who.id, 409, '账号已变化，请重新连接', { identityChanged: true });
          return rooms.join(req, res, auth, room, token);
        }
        check(req.method === 'POST', 405, '方法不支持');
        const { input } = await json(req);
        const current = await database.call('authenticate', { tokenHash: hash(token) });
        return reply(res, 200, rooms.post(current, room, roomRoute[2], input));
      }
      const flowRoute = /^\/api\/flow\/(drafts|workspace|feed|publish|revoke)$/.exec(route);
      if (flowRoute) {
        category = 'flow';
        if (req.method === 'GET') return reply(res, 200, await authorizedCall('flowRead', { route: flowRoute[1] }));
        check(req.method === 'POST', 405, '方法不支持');
        const { input, raw } = await json(req);
        const result = await authorizedCall('flowWrite', { route: flowRoute[1], input, key: req.headers['idempotency-key'], hash: hash(req.method + route + raw) });
        return reply(res, 200, result);
      }
      throw fail(404, '接口不存在');
    } catch (error) {
      if (res.headersSent || res.destroyed) { if (!res.destroyed) res.end(); return; }
      const status = error.status || 500;
      if ([429, 503].includes(status)) res.setHeader('Retry-After', status === 429 ? '60' : '1');
      if (status === 413) res.setHeader('Connection', 'close');
      reply(res, status, { error: status < 500 ? error.message : '服务暂时不可用，请稍后重试', requestId, ...(error.remote ? { remote: error.remote } : {}), ...(error.identityChanged ? { identityChanged: true } : {}) });
    }
  }
  const server = http.createServer((req, res) => { void handler(req, res).catch(() => res.destroy()); });
  server.requestTimeout = 15000; server.headersTimeout = 10000; server.keepAliveTimeout = 5000; server.maxRequestsPerSocket = 1000;
  const cleanup = setInterval(() => { limits.clean(); void database.call('cleanup').catch(() => logger({ event: 'cleanup_failed' })); }, 60000); cleanup.unref();
  const service = {
    server, bootstrapFile,
    get origin() { return origin?.origin; },
    async listen() {
      try {
        await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolve(); }); });
      } catch (error) { await service.close(); throw error; }
      if (!origin) origin = new URL(`http://127.0.0.1:${server.address().port}`);
      return origin.origin;
    },
    backup: destination => database.call('backup', { destination: path.resolve(destination) }),
    close() {
      closePromise ||= (async () => {
        closing = true; clearInterval(cleanup); rooms.close(); histogram.disable();
        const force = setTimeout(() => server.closeAllConnections(), 10000); force.unref();
        await new Promise(resolve => server.close(resolve)); clearTimeout(force);
        await database.close();
      })(); return closePromise;
    },
  };
  return service;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.umask(0o077);
  const development = process.argv.includes('--dev');
  const service = await createService({ development, publicOrigin: process.env.HAIZ_PUBLIC_ORIGIN, behindProxy: process.env.HAIZ_BEHIND_PROXY === '1', directory: process.env.HAIZ_DATA_DIR,
    port: Number(process.env.PORT || 8790), registration: process.env.HAIZ_REGISTRATION !== '0' });
  await service.listen();
  console.log(JSON.stringify({ event: 'ready', origin: service.origin, bootstrapFile: service.bootstrapFile }));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void service.close().then(() => process.exit(0)); });
}

import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { fail, check, object, username, text } from '../errors.mjs';
import { hash, secret, passwords, rateLimiter } from '../auth.mjs';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
const SESSION_MS = 8 * 3600000, INVITE_MS = 30 * 60000, BODY_BYTES = 65536;
const ALIASES = { '/api/auth/login': '/api/v1/auth/login', '/api/auth/register': '/api/v1/auth/register', '/api/auth/session': '/api/v1/auth/me', '/api/auth/logout': '/api/v1/auth/logout' };

// Request/Response HTTP adapter. Database and room state belong to the one private DO.
export function createCloudApi({ database, env, rooms }) {
  const development = env.DEV === '1';
  let origin;
  try { origin = new URL(env.PUBLIC_ORIGIN); } catch { throw fail(500, '服务来源配置无效'); }
  check(origin.pathname === '/' && !origin.search && !origin.hash && !origin.username && !origin.password, 500, '服务来源须为独立来源');
  check(development ? origin.protocol === 'http:' && LOOPBACK.has(origin.hostname) : origin.protocol === 'https:', 500, '服务来源配置无效');
  const registration = env.REGISTRATION !== '0';
  const authPasswords = passwords({ maxConcurrent: 1 }), limits = rateLimiter();
  const cookieName = development ? 'haiz_session' : '__Host-haiz_session';
  const counters = { requests: 0, errors: 0, active: 0 }, started = Date.now();
  const cookie = (value, seconds, persistent = true) => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict${development ? '' : '; Secure'}${persistent ? '; Max-Age=' + seconds : ''}`;
  const getToken = request => (request.headers.get('cookie') || '').split(';').map(part => part.trim()).find(part => part.startsWith(cookieName + '='))?.slice(cookieName.length + 1) || '';
  function source(request) {
    const url = new URL(request.url);
    check(url.origin === origin.origin && !url.username && !url.password, 403, '请求来源无效');
    check(!request.headers.has('host') || request.headers.get('host') === origin.host, 403, '来源主机不匹配');
    check(!request.headers.get('origin') || request.headers.get('origin') === origin.origin, 403, '拒绝跨来源请求');
    check(request.headers.get('sec-fetch-site') !== 'cross-site', 403, '拒绝跨站请求');
    // Only the public Worker can reach this DO and it overwrites this header.
    const address = request.headers.get('x-haiz-client-ip');
    check(typeof address === 'string' && isIP(address) !== 0, 403, '缺少受信任代理身份');
    return { url, address };
  }
  async function authenticate(request) {
    source(request);
    const token = getToken(request); check(/^[\w-]{43}$/.test(token), 401, '请先登录');
    const tokenHash = hash(token), auth = await database.call('authenticate', { tokenHash });
    check(!request.headers.get('x-haiz-user') || request.headers.get('x-haiz-user') === auth.identity.id, 409, '账号已变化，请重新确认登录状态', { identityChanged: true, currentUserId: auth.identity.id });
    return { ...auth, tokenHash, userId: auth.identity.id };
  }
  async function json(request) {
    check(/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || ''), 415, '只接受 application/json');
    check(!request.headers.get('content-encoding') || request.headers.get('content-encoding') === 'identity', 415, '不接受压缩请求体');
    if (request.headers.has('content-length')) {
      const length = request.headers.get('content-length');
      check(/^\d+$/.test(length) && Number(length) <= BODY_BYTES, 413, '请求体过大');
    }
    const reader = request.body?.getReader(), chunks = []; let size = 0, timer;
    const deadline = new Promise((_, reject) => { timer = setTimeout(() => { reject(fail(408, '请求体读取超时')); void reader?.cancel().catch(() => {}); }, 8000); });
    try {
      if (reader) for (;;) {
        const part = await Promise.race([reader.read(), deadline]);
        if (part.done) break;
        size += part.value.byteLength;
        check(size <= BODY_BYTES, 413, '请求体过大'); chunks.push(part.value);
      }
    } catch (error) { void reader?.cancel().catch(() => {}); throw error; }
    finally { clearTimeout(timer); reader?.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const raw = new TextDecoder().decode(bytes); let value;
    try { value = JSON.parse(raw); } catch { throw fail(400, 'JSON 无效'); }
    return { input: object(value), raw };
  }
  async function fetch(request) {
    const requestId = randomUUID(); counters.requests++; counters.active++;
    const headers = new Headers({ 'X-Request-Id': requestId, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'Cross-Origin-Resource-Policy': 'same-origin', 'X-Frame-Options': 'SAMEORIGIN', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; frame-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'" });
    if (!development) headers.set('Strict-Transport-Security', 'max-age=31536000');
    const reply = (status, data) => { headers.set('Content-Type', 'application/json; charset=utf-8'); return new Response(JSON.stringify(data), { status, headers }); };
    try {
      check(counters.active <= 512, 503, '服务繁忙');
      const { url, address } = source(request), route = ALIASES[url.pathname] || url.pathname;
      check(['GET', 'POST', 'PUT', 'DELETE'].includes(request.method), 405, '方法不支持');
      if (request.method !== 'GET') check(request.headers.get('origin') === origin.origin, 403, '修改操作必须带匹配 Origin');
      limits.take('ip:' + address, 1200);
      if (route === '/api/health' && request.method === 'GET') return reply(200, { ok: true, service: 'haiz', version: '1.0.0' });
      if (route === '/api/ready' && request.method === 'GET') return reply(200, await database.call('ready'));
      if (route === '/api/v1/auth/config' && request.method === 'GET') return reply(200, { registration, loginRequired: true });
      const recoveryRoute = /^\/api\/v1\/data\/([^/]+)\/([^/]+)\/(history|restore)$/.exec(route);
      const trashRoute = /^\/api\/v1\/trash\/([^/]+)$/.exec(route);
      const personalQuery = ['/api/v1/search', '/api/v1/usage', '/api/v1/activity'].includes(route);
      check(recoveryRoute || trashRoute || personalQuery || /^\/api\/(?:flow\/(?:login|logout|me|drafts|workspace|feed|publish|revoke|admin(?:\/(?:invite|revoke))?)|v1\/(?:auth\/(?:register|login|logout|logout-all|me|password|sessions|revoke|account)|admin\/metrics|data\/[^/]+(?:\/[^/]+)?|rooms(?:\/[^/]+\/(?:events|position|messages))?))$/.test(route), 404, '接口不存在');
      const isInviteLogin = route === '/api/flow/login';
      if (['/api/v1/auth/register', '/api/v1/auth/login'].includes(route) || isInviteLogin) {
        check(request.method === 'POST', 405, '方法不支持'); limits.take('auth-ip:' + address, 30);
        const { input } = await json(request), token = secret(); let result;
        if (isInviteLogin) {
          const invite = text(input.invite, 100, true);
          if (/^[\w-]{43}$/.test(env.BOOTSTRAP_INVITE || '') && hash(invite) === hash(env.BOOTSTRAP_INVITE)) {
            // Recover only an unclaimed/passwordless initial administrator.
            // The repository never resets an established password or active session.
            await database.call('bootstrap', { tokenHash: hash(invite), inviteMs: 24 * 3600000 });
          }
          result = await database.call('claimInvite', { inviteHash: hash(invite), tokenHash: hash(token), sessionMs: SESSION_MS });
        }
        else {
          const name = username(input.username); limits.take('auth-user:' + name, 15);
          if (route.endsWith('/register')) {
            check(registration, 403, '公开注册尚未开启，请使用邀请');
            result = await database.call('register', { name, passwordHash: await authPasswords.create(input.password), tokenHash: hash(token), sessionMs: SESSION_MS });
          } else {
            const credential = await database.call('credentials', { name });
            check(await authPasswords.verify(input.password, credential?.passwordHash), 401, '账号或密码无效');
            result = await database.call('login', { userId: credential.id, credentialHash: credential.passwordHash, tokenHash: hash(token), sessionMs: SESSION_MS });
          }
        }
        headers.set('Set-Cookie', cookie(token, SESSION_MS / 1000, input.remember !== false));
        const { sessionId, ...publicResult } = result;
        return reply(route.endsWith('/register') ? 201 : 200, { ...publicResult, authenticated: true });
      }
      const auth = await authenticate(request), who = auth.identity;
      headers.set('X-HAIZ-User', who.id);
      const authorizedCall = (operation, args = {}) => database.call(operation, { ...args, who, sessionId: auth.sessionId });
      limits.take('session:' + auth.sessionId, 600);
      if (['/api/v1/auth/me', '/api/flow/me'].includes(route) && request.method === 'GET') {
        const credential = await database.call('credentials', { name: who.name });
        return reply(200, { identity: who, authenticated: true, hasPassword: Boolean(credential?.passwordHash), expiresAt: auth.expiresAt, demo: false, serverTime: new Date().toISOString() });
      }
      if (route === '/api/v1/auth/sessions' && request.method === 'GET') return reply(200, await authorizedCall('sessions'));
      if (route === '/api/v1/auth/revoke' && request.method === 'POST') {
        const { input } = await json(request), result = await authorizedCall('revokeOwn', { id: input.id }); rooms.closeSession(input.id);
        if (input.id === auth.sessionId) headers.set('Set-Cookie', cookie('', 0));
        return reply(200, result);
      }
      if (route === '/api/v1/auth/logout-all' && request.method === 'POST') {
        const result = await authorizedCall('logoutAll'); rooms.closeUser(who.id); headers.set('Set-Cookie', cookie('', 0)); return reply(200, result);
      }
      if (route === '/api/v1/auth/account' && request.method === 'DELETE') {
        limits.take('account-delete:' + who.id, 5);
        const { input } = await json(request), credential = await database.call('credentials', { name: who.name });
        check(await authPasswords.verify(input.password, credential?.passwordHash), 401, '密码无效');
        const result = await authorizedCall('deleteAccount', { expectedHash: credential.passwordHash, confirm: input.confirm });
        rooms.closeUser(who.id); headers.set('Set-Cookie', cookie('', 0)); return reply(200, result);
      }
      if (['/api/v1/auth/logout', '/api/flow/logout'].includes(route) && request.method === 'POST') {
        await authorizedCall('logout'); rooms.closeSession(auth.sessionId); headers.set('Set-Cookie', cookie('', 0)); return reply(200, { ok: true });
      }
      if (route === '/api/v1/auth/password' && request.method === 'POST') {
        limits.take('password:' + who.id, 5);
        const { input } = await json(request), credential = await database.call('credentials', { name: who.name });
        if (credential.passwordHash) check(await authPasswords.verify(input.currentPassword, credential.passwordHash), 401, '当前密码无效');
        const result = await authorizedCall('password', { expectedHash: credential.passwordHash, passwordHash: await authPasswords.create(input.password) });
        rooms.closeUser(who.id); headers.set('Set-Cookie', cookie('', 0)); return reply(200, result);
      }
      if (route === '/api/v1/admin/metrics' && request.method === 'GET') {
        check(who.role === 'admin', 403, '需要管理员权限');
        return reply(200, { ...await authorizedCall('metrics'), ...rooms.metrics, ...counters, uptimeSeconds: Math.floor((Date.now() - started) / 1000), databaseQueue: database.pending || 0,
          hosting: { provider: 'cloudflare', plan: 'free', workersRequestsPerDay: 100000, durableObjectRequestsPerDay: 100000, rowsReadPerDay: 5000000, rowsWrittenPerDay: 100000, accountStorageBytes: 5 * 1000000000, objectStorageBytes: 1000000000 },
          backup: { provider: 'cloudflare-time-travel', retentionDays: 30, localSnapshots: false, restoreRequiresOperator: true } });
      }
      if (route === '/api/flow/admin' || route.startsWith('/api/flow/admin/')) {
        check(who.role === 'admin', 403, '需要管理员权限');
        if (route === '/api/flow/admin' && request.method === 'GET') return reply(200, await authorizedCall('admin'));
        check(request.method === 'POST', 405, '方法不支持'); const { input } = await json(request);
        if (route.endsWith('/invite')) {
          const invitation = secret(), result = await authorizedCall('invite', { input, tokenHash: hash(invitation), inviteMs: INVITE_MS }); return reply(201, { ...result, invite: invitation });
        }
        if (route.endsWith('/revoke')) { const result = await authorizedCall('revoke', { id: input.id }); rooms.closeSession(input.id); return reply(200, result); }
        throw fail(404, '管理接口不存在');
      }
      if (recoveryRoute) {
        const restoring = recoveryRoute[3] === 'restore'; check(request.method === (restoring ? 'POST' : 'GET'), 405, '方法不支持');
        const args = { collection: recoveryRoute[1], id: recoveryRoute[2] }; if (restoring) args.input = (await json(request)).input;
        return reply(200, await authorizedCall(restoring ? 'personalRestore' : 'personalHistory', args));
      }
      if (trashRoute) { check(request.method === 'GET', 405, '方法不支持'); return reply(200, await authorizedCall('personalTrash', { collection: trashRoute[1], limit: Number(url.searchParams.get('limit') ?? 100), cursor: url.searchParams.get('cursor') ?? '' })); }
      if (personalQuery) {
        check(request.method === 'GET', 405, '方法不支持');
        if (route === '/api/v1/usage') return reply(200, await authorizedCall('personalUsage'));
        if (route === '/api/v1/activity') return reply(200, await authorizedCall('personalActivity', { limit: Number(url.searchParams.get('limit') ?? 50), cursor: url.searchParams.get('cursor') ?? '' }));
        return reply(200, await authorizedCall('personalSearch', { q: url.searchParams.get('q'), collection: url.searchParams.get('collection') ?? undefined, limit: Number(url.searchParams.get('limit') ?? 100), cursor: url.searchParams.get('cursor') ?? '' }));
      }
      const dataRoute = /^\/api\/v1\/data\/([^/]+)(?:\/([^/]+))?$/.exec(route);
      if (dataRoute) {
        const { input } = request.method === 'GET' ? {} : await json(request);
        return reply(200, await authorizedCall('personal', { method: request.method, collection: dataRoute[1], id: dataRoute[2], input, limit: Number(url.searchParams.get('limit') || 100), cursor: url.searchParams.get('cursor') || '' }));
      }
      if (route === '/api/v1/rooms' && request.method === 'GET') return reply(200, { rooms: ['campus', ...who.scopes.filter(scope => scope !== 'campus').map(scope => 'class:' + scope)] });
      const roomRoute = /^\/api\/v1\/rooms\/([^/]+)\/(events|position|messages)$/.exec(route);
      if (roomRoute) {
        let room; try { room = decodeURIComponent(roomRoute[1]); } catch { throw fail(400, '房间无效'); } check(room.length <= 90, 400, '房间无效');
        if (roomRoute[2] === 'events') {
          check(request.method === 'GET', 405, '方法不支持'); check(!url.searchParams.has('user') || url.searchParams.get('user') === who.id, 409, '账号已变化，请重新连接', { identityChanged: true });
          const response = await rooms.join(request, auth, room);
          for (const [key, value] of headers) response.headers.set(key, value);
          return response;
        }
        check(request.method === 'POST', 405, '方法不支持'); const { input } = await json(request);
        const current = await authenticate(request); return reply(200, await rooms.post(current, room, roomRoute[2], input));
      }
      const flowRoute = /^\/api\/flow\/(drafts|workspace|feed|publish|revoke)$/.exec(route);
      if (flowRoute) {
        if (request.method === 'GET') return reply(200, await authorizedCall('flowRead', { route: flowRoute[1] }));
        check(request.method === 'POST', 405, '方法不支持'); const { input, raw } = await json(request);
        return reply(200, await authorizedCall('flowWrite', { route: flowRoute[1], input, key: request.headers.get('idempotency-key'), hash: hash(request.method + route + raw) }));
      }
      throw fail(404, '接口不存在');
    } catch (error) {
      const status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 ? error.status : 500;
      if (error.identityChanged && error.currentUserId) headers.set('X-HAIZ-User', error.currentUserId);
      if (status >= 500) counters.errors++;
      if ([429, 503].includes(status)) headers.set('Retry-After', status === 429 ? '60' : '1');
      return reply(status, { error: status < 500 ? error.message : '服务暂时不可用，请稍后重试', requestId, ...(error.remote ? { remote: error.remote } : {}), ...(error.identityChanged ? { identityChanged: true } : {}) });
    } finally { counters.active--; }
  }
  return { fetch, authenticate };
}

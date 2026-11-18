// Real Chromium, real Supabase JS client, fake Auth/RPC/Realtime service.
// No account credentials or network access are used by the browser test.
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium, devices } = require('playwright');

const root = path.resolve(__dirname, '../..');
const aliases = { a: '11111111-1111-4111-8111-111111111111', b: '22222222-2222-4222-8222-222222222222' };
const project = /^https:\/\/[^/]+\.supabase\.co\//;
const websocket = /^wss:\/\/[^/]+\.supabase\.co\/realtime\/v1\/websocket/;
const json = x => JSON.stringify(x);
const payloadPart = o => Buffer.from(json(o)).toString('base64url');
const readToken = t => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());

async function main() {
  const umd = await fs.readFile(process.env.HAIZ_MP_UMD);
  const mime = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary' };
  const server = createServer(async (req, res) => {
    try {
      const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
      if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
      const body = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port + '/multiplayer-alpha.html';
  const groups = new Map();
  const sockets = new Set();
  const appErrors = [], gatewayErrors = [];
  let browser, broadcastCount = 0;
  function attach(ws) {
    const conn = { ws, channels: new Map(), key: null };
    sockets.add(conn);
    function dispatch(peer, topic, type, data) {
      peer.ws.send(json([peer.channels.get(topic)?.join, null, topic, type, data]));
    }
    function presence(topic) {
      const lists = groups.get(topic) ?? new Set();
      const state = {};
      for (const peer of lists) {
        const m = peer.channels.get(topic)?.meta;
        if (m) state[m.phx_ref] = { metas: [m] };
      }
      for (const peer of lists) dispatch(peer, topic, 'presence_state', state);
    }
    function close(topic) {
      conn.channels.delete(topic);
      groups.get(topic)?.delete(conn);
      presence(topic);
    }
    ws.onClose(() => {
      sockets.delete(conn);
      for (const topic of [...conn.channels.keys()]) close(topic);
    });
    ws.onMessage(message => {
      try {
        let join, ref, topic, event, p;
        if (typeof message === 'string') {
          [join, ref, topic, event, p] = JSON.parse(message);
        } else {
          const data = Buffer.from(message);
          assert.equal(data[0], 3, 'expected v2 binary Broadcast push');
          const [jl, rl, tl, el, ml, encoding] = data.subarray(1, 7);
          assert.equal(encoding, 1);
          let off = 7;
          const str = len => { const text = data.subarray(off, off + len).toString(); off += len; return text; };
          join = str(jl); ref = str(rl); topic = str(tl);
          const userEvent = str(el); str(ml);
          event = 'broadcast'; p = { event: userEvent, payload: JSON.parse(data.subarray(off).toString()) };
        }
        const ack = (status = 'ok', response = {}) => ws.send(json([join, ref, topic, 'phx_reply', { status, response }]));
        const own = () => topic.endsWith(':' + aliases[conn.key]);
        if (event === 'phx_join') {
          conn.key = readToken(p.access_token).sub;
          if (!aliases[conn.key] || !p.config.private) return ack('error', { reason: 'Unauthorized' });
          conn.channels.set(topic, { join, meta: null });
          if (!groups.has(topic)) groups.set(topic, new Set());
          groups.get(topic).add(conn);
          ack(); presence(topic);
        } else if (event === 'heartbeat') ack();
        else if (event === 'phx_leave') { ack(); close(topic); }
        else if (event === 'presence') {
          assert.ok(own(), 'presence on another alias');
          if (p.event === 'track') {
            conn.channels.get(topic).meta = { ...p.payload, phx_ref: p.payload.sid };
          } else conn.channels.get(topic).meta = null;
          ack(); presence(topic);
        } else if (event === 'broadcast') {
          assert.ok(own(), 'broadcast on another alias'); broadcastCount++;
          for (const peer of groups.get(topic) ?? []) if (peer !== conn) {
            dispatch(peer, topic, 'broadcast', { type: 'broadcast', ...p });
          }
        }
      } catch (error) { gatewayErrors.push(error.stack); }
    });
  }
  async function page(key, mobile = false) {
    const context = await browser.newContext(mobile ? { ...devices['Pixel 7'], deviceScaleFactor: 1 } : { viewport: { width: 1024, height: 720 } });
    await context.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@**', route => route.fulfill({
      body: umd, contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' },
    }));
    await context.route('**/lanren/multiplayer/alpha-scene.js', async route => {
      const text = await fs.readFile(path.join(root, 'lanren/multiplayer/alpha-scene.js'), 'utf8');
      return route.fulfill({ contentType: 'text/javascript', body: text.replace('mobile ? 1 : 1.5', '0.5').replace('(mobile ? 30 : 15)', '85')
        .replace('  function frame(at)', '  let nextDraw = 0;\n  function frame(at)')
        .replace('renderer.render(scene, camera);', 'if (at > nextDraw) { renderer.render(scene, camera); nextDraw = at + 1000; }') });
    });
    await context.route(project, async route => {
      const request = route.request();
      const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const send = (body, status = 200) => route.fulfill({ json: body, status, headers: cors });
      const { pathname } = new URL(request.url());
      if (pathname.endsWith('/token')) {
        const email = request.postDataJSON().email;
        assert.equal(email, key + '@example.test');
        const token = [payloadPart({ alg: 'HS256' }), payloadPart({ exp: Math.floor(Date.now() / 1000) + 3600, sub: key, role: 'authenticated' }), 'test'].join('.');
        return send({ access_token: token, refresh_token: 'mock', expires_in: 3600, token_type: 'bearer',
          user: { id: key, aud: 'authenticated', email, is_anonymous: false } });
      }
      if (pathname.endsWith('/haiz_mp_directory')) {
        assert.ok(request.headers().authorization?.includes('Bearer '));
        if (!aliases[key]) return send({ code: '42501', message: 'denied' }, 403);
        return send({ self: aliases[key], members: Object.values(aliases), capacity: 2, frame: 'haiz-campus-v1' });
      }
      if (pathname.endsWith('/logout')) return route.fulfill({ status: 204, headers: cors });
      return send({ message: 'Unexpected mock endpoint: ' + pathname }, 404);
    });
    await context.routeWebSocket(websocket, attach);
    const tab = await context.newPage();
    tab.on('pageerror', e => appErrors.push(e.stack));
    tab.on('console', m => { if (m.type() === 'error' && /THREE|Supabase 客户端/.test(m.text())) appErrors.push(m.text()); });
    await tab.goto(url, { waitUntil: 'domcontentloaded' });
    await tab.fill('#email', key + '@example.test');
    await tab.fill('#password', 'fixture-only');
    await tab.locator('#login').evaluate(form => form.requestSubmit());
    await tab.waitForFunction(() => document.querySelector('#room-form')?.hidden === false &&
      window.haizMultiplayer?.map.getConnection().status === 'disconnected', null, { timeout: 120_000, polling: 120 }).catch(async error => {
      console.error('Fixture page startup:', key, await tab.evaluate(() => ({ hidden: document.querySelector('#room-form').hidden, connection: window.haizMultiplayer?.map.getConnection(), status: document.querySelector('#status').textContent })), appErrors); throw error;
    });
    assert.equal(await tab.locator('#count').textContent(), '0', 'login must not join the room');
    if (key !== 'outsider') await tab.fill('#nickname', '测试 ' + key);
    return tab;
  }
  const stat = (tab, self, motion) => tab.waitForFunction(({self,motion}) => window.haizMultiplayer.snapshot().players.some(
    p => p.isLocal === self && p.motion === motion), { self, motion }, { timeout: 15_000, polling: 100 });
  try {
    browser = await chromium.launch({ args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
    const a = await page('a');
    const b = await page('b', true);
    assert.equal(sockets.size, 0);
    await a.locator('#join').evaluate(button => button.click());
    await b.locator('#join').evaluate(button => button.click());
    await a.waitForFunction(() => window.haizMultiplayer.snapshot().avatars === 1, null, { timeout: 18_000, polling: 100 });
    await b.waitForFunction(() => window.haizMultiplayer.snapshot().avatars === 1, null, { timeout: 18_000, polling: 100 });
    assert.equal(await b.locator('#count').textContent(), '2');
    const before = await b.evaluate(() => haizMultiplayer.map.getPlayers().find(p => !p.isLocal).z);
    await a.keyboard.down('Shift'); await a.keyboard.down('w');
    await stat(b, false, 'run');
    await b.waitForFunction(before => {
      const remote = haizMultiplayer.snapshot().players.find(p => !p.isLocal);
      return remote?.z > before + 0.1;
    }, before, { polling: 100, timeout: 15_000 });
    const matching = await b.evaluate(() => {
      const frame = haizMultiplayer.snapshot();
      const remote = frame.players.find(p => !p.isLocal);
      return { z: remote.z, map: haizMultiplayer.map.project(remote), drawCalls: frame.drawCalls };
    });
    await a.keyboard.up('w'); await a.keyboard.up('Shift');
    assert.ok(matching.z > before + 0.1);
    assert.equal(matching.map.z, matching.z);
    assert.ok(Number.isFinite(matching.map.plan.px) && matching.drawCalls > 0);
    await stat(b, false, 'idle');

    // Touch movement through the existing player controller, driven by CDP.
    const canvas = await b.locator('#world').boundingBox();
    const touch = await b.context().newCDPSession(b);
    const px = 48, py = Math.round(canvas.y + canvas.height / 2);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: px, y: py }] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: px, y: py - 42 }] });
    await stat(a, false, 'walk');
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await stat(a, false, 'idle');

    await a.locator('#visibility').evaluate(button => button.click());
    await b.waitForFunction(() => document.querySelector('#count').textContent === '1' && haizMultiplayer.snapshot().avatars === 0);
    await a.waitForFunction(() => !document.querySelector('#visibility').disabled, null, { polling: 100 });
    await a.locator('#visibility').evaluate(button => button.click());
    await b.waitForFunction(() => haizMultiplayer.snapshot().avatars === 1);
    for (const conn of sockets) if (conn.key === 'a') conn.ws.close({ code: 1011 });
    await b.waitForFunction(() => haizMultiplayer.snapshot().avatars === 0);
    await b.waitForFunction(() => haizMultiplayer.snapshot().avatars === 1, null, { timeout: 15_000, polling: 100 });
    await a.locator('#leave').evaluate(button => button.click());
    await b.waitForFunction(() => haizMultiplayer.snapshot().avatars === 0);
    const outsider = await page('outsider');
    await outsider.locator('#join').evaluate(button => button.click());
    await outsider.waitForFunction(() => haizMultiplayer.map.getConnection().status === 'error');
    assert.equal(await outsider.locator('#count').textContent(), '0');
    assert.ok(![...sockets].some(conn => conn.key === 'outsider'));
    assert.ok(broadcastCount > 5);
    assert.deepEqual(gatewayErrors, []);
    assert.deepEqual(appErrors, []);
    console.log('PASS Chromium/WebGL: no auto-join, desktop and mobile contexts see avatars, run/walk/idle, touch, shared map projection, hide/restore, drop/reconnect, exit and denied access (mock Supabase)');
    console.log('Observed draw calls with one remote avatar (software Chromium):', matching.drawCalls);
  } finally {
    if (appErrors.length) console.error('Browser errors', appErrors);
    if (gatewayErrors.length) console.error('Mock gateway errors', gatewayErrors);
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });

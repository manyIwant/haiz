import { createMultiplayerClient, createSupabaseTransport, createMapAccess } from './index.js';
import { createAlphaScene } from './alpha-scene.js';
import { POCKET_SUPABASE } from './alpha-config.js';

const el = id => document.getElementById(id);
const say = text => { el('status').textContent = text; };
let world, auth, client, signing = false, hidden = false, signingOut = false, visibilityPending = false;
let library, subscriptions = [];
const labels = { connecting: '正在连接…', connected: '已连接', reconnecting: '连接中断，正在重连…',
  disconnected: '未加入共游', error: '无法加入' };

function sdk() {
  if (!library) library = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.109.0/dist/umd/supabase.js';
    script.integrity = 'sha384-QBRYTjAPttRJE6VS+3BZ2pbh2K1WYNBwquAji9CwlJx1Uwk9QxbOQ5GpBhBoj1xg';
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      if (window.supabase?.createClient) resolve(window.supabase.createClient);
      else { script.remove(); reject(new Error('Supabase 客户端未加载')); }
    };
    script.onerror = () => { script.remove(); reject(new Error('Supabase 客户端未加载，请检查网络')); };
    document.head.append(script);
  }).catch(error => { library = undefined; throw error; });
  return library;
}

function refresh() {
  const state = client?.getConnection();
  const players = client?.getPlayers({ mode: 'network' }) ?? [];
  const active = ['connecting', 'connected', 'reconnecting'].includes(state?.status);
  el('join').disabled = !world || !client || active || signingOut;
  el('leave').disabled = !active || signingOut;
  el('visibility').disabled = state?.status !== 'connected' || signingOut || visibilityPending;
  el('room').disabled = el('nickname').disabled = active || signingOut;
  el('visibility').textContent = hidden ? '取消隐身' : '隐身';
  el('visibility').setAttribute('aria-pressed', String(hidden));
  el('count').textContent = String(players.length);
  el('members').textContent = players.length ? ' · ' + players.map(p => p.nickname + (p.isLocal ? '（你）' : '')).join('、') : '';
}
function handleConnection(state) {
  say(labels[state.status] + (state.detail ? '：' + state.detail : ''));
  refresh();
}
function attach() {
  if (!world || !auth || client) return;
  client = createMultiplayerClient({ transport: createSupabaseTransport(auth), bounds: world.frame.sheet });
  client.setBackground(document.hidden);
  world.setClient(client);
  const map = createMapAccess(client, world.frame);
  window.haizMultiplayer = Object.freeze({ map, snapshot: world.snapshot });
  window.dispatchEvent(new Event('haiz:multiplayer-ready'));
  subscriptions = [
    client.subscribe('connection', handleConnection),
    client.subscribe('join', refresh),
    client.subscribe('leave', refresh),
  ];
  handleConnection(client.getConnection());
}

el('login').addEventListener('submit', async event => {
  event.preventDefault();
  if (signing) return;
  signing = true;
  const button = el('login').querySelector('button');
  button.disabled = true;
  const email = el('email').value.trim(), password = el('password').value;
  el('password').value = '';
  say('正在登录…');
  let db;
  try {
    const createClient = await sdk();
    db = createClient(POCKET_SUPABASE.url, POCKET_SUPABASE.key, {
      auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
    });
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw new Error('登录失败。请确认 Pocket 账号、密码及邮箱验证状态。');
    auth = db;
    auth.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && auth === db && !signingOut) void logout(false);
    });
    el('login').hidden = true;
    el('room-form').hidden = false;
    say('已登录 · 正在等待校园载入');
    attach();
  } catch (error) { if (db && db !== auth) await db.auth.dispose(); say(error.message); }
  finally { signing = false; button.disabled = false; }
});
el('room-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (el('join').disabled) return;
  hidden = false;
  client.setNickname(el('nickname').value);
  await client.setVisible(true);
  el('world').focus({ preventScroll: true });
  try { await client.connect(el('room').value.trim()); }
  catch (error) { if (error.name !== 'AbortError') refresh(); }
});
el('leave').addEventListener('click', () => void client?.disconnect());
el('visibility').addEventListener('click', async () => {
  if (!client || el('visibility').disabled) return;
  hidden = !hidden;
  visibilityPending = true;
  refresh();
  try { await client.setVisible(!hidden); }
  catch { /* SDK updates the connection status and retires the failed channel. */ }
  visibilityPending = false;
  refresh();
});
el('jump').addEventListener('click', () => world?.jump());
async function logout(revoke = true) {
  if (!auth || signingOut) return;
  signingOut = true;
  el('sign-out').disabled = true;
  refresh();
  const db = auth;
  try {
    const old = client;
    client = undefined;
    auth = undefined;
    window.haizMultiplayer = null;
    world?.setClient(undefined);
    for (const off of subscriptions) off();
    subscriptions = [];
    await old?.destroy();
    if (revoke) {
      const { error } = await db.auth.signOut({ scope: 'local' });
      if (error) throw error;
    }
  } finally {
    await db.auth.dispose();
    await db.realtime.disconnect();
    signingOut = false;
    hidden = false;
    el('sign-out').disabled = false;
    el('login').hidden = false;
    el('room-form').hidden = true;
    el('email').value = '';
    say('已退出共游账号');
    refresh();
  }
}
el('sign-out').addEventListener('click', () => { void logout().catch(() => say('已清除本页会话，服务器退出请求未完成')); });
document.addEventListener('keydown', event => {
  // Existing player consumes Space globally; keep native keyboard activation of controls.
  if (event.target instanceof HTMLButtonElement && event.code === 'Space') event.stopPropagation();
});
document.addEventListener('visibilitychange', () => client?.setBackground(document.hidden));
addEventListener('pagehide', () => { void client?.disconnect(); });
createAlphaScene(el('world'), el('stick')).then(scene => {
  world = scene;
  el('jump').disabled = false;
  if (auth) attach();
  else if (!signing) say('校园已载入 · 登录后可选择加入');
}).catch(error => {
  console.error(error);
  say('无法载入三维校园，请检查 WebGL 和资源加载');
});

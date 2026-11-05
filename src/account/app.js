import { createHaizClient } from '/haiz-client.js';
const api = createHaizClient(), main = document.querySelector('#main'), notice = document.querySelector('#notice');
const names = { notes: '便签', bookmarks: '收藏', preferences: '偏好' };
let account = null, mode = 'login', collection = 'notes', items = [], cursor = null, editing = null, epoch = 0, busy = false, registration = false;
let noticeTimer;
const identityChannel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('haiz-account-state') : null;
let expiryTimer;
const announceIdentity = () => identityChannel?.postMessage({ type: 'identity-changed' });
function message(value) { notice.textContent = value; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { notice.textContent = ''; }, 5000); }
function node(tag, text, className) { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element; }
function button(label, action, className = '') { const b = node('button', label, className); b.type = 'button'; b.onclick = action; return b; }
function field(label, name, { type = 'text', multiline = false, required = true, maxLength = 8000, value = '', autocomplete } = {}) {
  const wrapper = node('label', label), input = document.createElement(multiline ? 'textarea' : 'input');
  input.name = name; input.value = value; input.required = required; input.maxLength = maxLength;
  if (!multiline) input.type = type; if (autocomplete) input.autocomplete = autocomplete;
  wrapper.append(input); return wrapper;
}
function errorNode() { const element = node('p', '', 'feedback error'); element.setAttribute('role', 'alert'); return element; }
function nextPage() {
  const raw = new URLSearchParams(location.search).get('next'); if (!raw) return null;
  try { const url = new URL(raw, location.origin); if (url.origin === location.origin && url.pathname !== '/account/' && !url.pathname.startsWith('//')) return url.pathname + url.search + url.hash; } catch {}
  return null;
}
function lock() { clearTimeout(expiryTimer); api.setIdentity(null); epoch++; account = null; items = []; editing = null; cursor = null; mode = 'login'; renderAuth(); }
async function safe(action, error) {
  if (busy) return; busy = true;
  const controls = [...main.querySelectorAll('button')]; controls.forEach(b => { b.disabled = true; });
  try { await action(); } catch (e) { if (e.identityChanged) { lock(); message('账号已变化，正在重新确认身份。'); void verify(); } else if (e.status === 401 && account) { lock(); message('会话已结束，请重新登录。'); } else if (error) error(e); else message(e.message); }
  finally { busy = false; controls.forEach(b => { if (b.isConnected) b.disabled = false; }); }
}
async function signedIn(result, announce = false) {
  account = result; mode = 'login'; items = []; editing = null; epoch++;
  api.setIdentity(result.identity.id);
  if (announce) announceIdentity();
  clearTimeout(expiryTimer); expiryTimer = setTimeout(() => { lock(); message('登录已到期，请重新登录。'); }, Math.max(1, result.expiresAt - Date.now()));
  const target = nextPage();
  if (target && result.hasPassword !== false) { location.assign(target); return; }
  collection = result.hasPassword === false ? 'security' : 'notes';
  renderDashboard(); await load();
}
function renderAuth() {
  main.replaceChildren(); const shell = node('div', undefined, 'login-shell'), intro = node('section', undefined, 'intro');
  intro.append(node('span', 'haiz', 'brand'), node('h1', '你的校园，\n从自己的账号开始。'), node('p', '便签、收藏与偏好，留在自己的空间里。换一台设备，登录后接着用。'));
  const mark = node('div', undefined, 'account-mark'); mark.append(node('span'), node('p', '个人账号 · 独立保存')); intro.append(mark);
  const panel = node('section', undefined, 'auth-panel'); panel.append(node('h2', mode === 'register' ? '创建你的账号' : mode === 'invite' ? '接受账号邀请' : '登录 HAIZ'), node('p', '只有登录后，才能进入校园和个人空间。', 'muted'));
  const tabs = node('div', undefined, 'mode-tabs');
  for (const [value, label] of [['login', '登录'], ['register', '注册']]) {
    const b = button(label, () => { mode = value; renderAuth(); }); b.setAttribute('aria-pressed', String(mode === value)); if (value === 'register' && !registration) b.disabled = true; tabs.append(b);
  }
  panel.append(tabs); const form = node('form', undefined, 'form-stack'), error = errorNode();
  if (mode === 'invite') form.append(field('一次性邀请码', 'invite', { type: 'password', maxLength: 100, autocomplete: 'off' }));
  else {
    const username = field('账号名', 'username', { maxLength: 40, autocomplete: 'username' });
    username.querySelector('input').pattern = '[A-Za-z0-9][A-Za-z0-9_-]{2,39}';
    username.append(node('small', '3 至 40 位字母、数字、下划线或短横线。'));
    const password = field('密码', 'password', { type: 'password', maxLength: 256, autocomplete: mode === 'register' ? 'new-password' : 'current-password' });
    if (mode === 'register') { password.querySelector('input').minLength = 12; password.append(node('small', '至少 12 个字符。请勿使用其他网站的密码。')); }
    form.append(username, password);
    if (mode === 'register') form.append(field('再次输入密码', 'confirmPassword', { type: 'password', maxLength: 256, autocomplete: 'new-password' }));
  }
  const submit = node('button', mode === 'register' ? '注册并进入' : mode === 'invite' ? '验证邀请' : '登录并进入', 'primary'); submit.type = 'submit';
  form.append(error, submit); form.onsubmit = event => {
    event.preventDefault(); error.textContent = ''; const data = Object.fromEntries(new FormData(form));
    if (mode === 'register' && data.password !== data.confirmPassword) { error.textContent = '两次密码不一致，请重新核对。'; return; }
    void safe(async () => {
    if (mode === 'invite') await api.inviteLogin(data.invite);
      else if (mode === 'register') await api.register(data.username, data.password);
      else await api.login(data.username, data.password);
      announceIdentity(); form.reset(); await signedIn(await api.me());
    }, e => { error.textContent = e.message; });
  };
  panel.append(form); const foot = node('div', undefined, 'auth-foot');
  foot.append(node('small', registration ? '每个账号只访问自己的个人记录。教师与管理权限由管理员单独授予。' : '当前暂不开放新账号注册，请使用已有账号或邀请。'), button(mode === 'invite' ? '返回密码登录' : '使用管理员提供的邀请', () => { mode = mode === 'invite' ? 'login' : 'invite'; renderAuth(); }, 'text-button'));
  panel.append(foot); shell.append(intro, panel); main.append(shell);
}
function renderDashboard() {
  main.replaceChildren(); const header = node('header', undefined, 'site-header'), logo = node('a', 'haiz', 'brand'); logo.href = '/';
  const actions = node('div', undefined, 'actions'), campus = node('a', '进入校园 ↗', 'campus-link'); campus.href = '/';
  actions.append(node('span', account.identity.name, 'header-user'), campus, button('退出登录', () => safe(async () => { await api.logout(); announceIdentity(); lock(); history.replaceState(null, '', '/account/'); message('已退出登录。'); })));
  header.append(logo, actions); const dashboard = node('div', undefined, 'dashboard'), rail = node('aside', undefined, 'rail');
  rail.append(node('h2', '我的数据'), node('p', '在校园里，\n留一处自己的空间。'));
  const nav = node('nav'); nav.setAttribute('aria-label', '个人数据分类');
  for (const [id, label] of [...Object.entries(names), ['security', '账号安全']]) {
    const b = button(label, () => { epoch++; collection = id; items = []; cursor = null; editing = null; renderDashboard(); void load(); }, collection === id ? 'active' : '');
    if (collection === id) b.setAttribute('aria-current', 'page'); nav.append(b);
  }
  rail.append(nav, node('small', '当前账号：' + account.identity.name)); const content = node('section'); content.id = 'content';
  const heading = node('div', undefined, 'page-heading'), title = node('div');
  title.append(node('h1', collection === 'security' ? '账号安全' : '我的' + names[collection]), node('p', collection === 'security' ? '管理密码与已登录设备。' : '只属于当前账号，由你管理。'));
  heading.append(title);
  if (collection !== 'security') { const controls = node('div', undefined, 'actions'); controls.append(button('导出我的数据', exportData), button('新建' + names[collection], () => openEditor(null), 'primary')); heading.append(controls); }
  content.append(heading); const loading = node('div', undefined, 'skeleton'); loading.setAttribute('role', 'status'); loading.setAttribute('aria-label', '正在读取个人数据'); content.append(loading);
  dashboard.append(rail, content); main.append(header, dashboard);
}
async function load(append = false) {
  const ticket = epoch, selected = collection;
  try {
    if (selected === 'security') { const result = await api.sessions(); if (ticket === epoch) renderSecurity(result.sessions); return; }
    const result = await api.list(selected, { cursor: append ? cursor : '', limit: 100 });
    if (ticket !== epoch || !account) return;
    items = append ? [...items, ...result.items] : result.items; cursor = result.nextCursor; renderItems();
  } catch (e) {
    if (ticket !== epoch) return;
    if (e.status === 401) { lock(); return; }
    const content = document.querySelector('#content'); content?.querySelector('.skeleton')?.remove();
    const failure = node('div', undefined, 'empty'); failure.append(node('p', e.message, 'error'), button('重新读取', () => { failure.remove(); void load(); })); content?.append(failure);
  }
}
function renderItems() {
  const content = document.querySelector('#content'); content.querySelector('.skeleton')?.remove(); content.querySelector('.workspace')?.remove();
  const workspace = node('div', undefined, 'workspace'); workspace.id = 'workspace'; const listArea = node('div');
  if (!items.length) {
    const empty = node('div', undefined, 'empty'); empty.append(node('h2', '这里还没有' + names[collection]), node('p', collection === 'notes' ? '从一件小事开始，记下今天想留下的内容。' : collection === 'bookmarks' ? '把想再去的地方，或想再看的链接收藏在这里。' : '把常用的个人选择留在这里，下次登录也能找到。'), button('新建' + names[collection], () => openEditor(null), 'primary')); listArea.append(empty);
  } else {
    const list = node('ul', undefined, 'data-list');
    for (const item of items) {
      const row = node('li', undefined, 'data-row'); row.append(node('h3', item.data.title || item.id), node('p', String(item.data.text ?? item.data.value ?? item.data.url ?? '')), node('small', '保存于 ' + new Date(item.updatedAt).toLocaleString('zh-CN')));
      const controls = node('div', undefined, 'actions'); controls.append(button('编辑', () => openEditor(item)), button('删除', () => {
        const confirm = node('div', undefined, 'confirm-row'); confirm.append(node('p', '确认删除这条' + names[collection] + '？'), button('确认删除', () => safe(async () => { await api.remove(collection, item.id, item.revision); if (editing?.id === item.id) editing = null; await load(); message('已删除。'); })), button('取消', () => confirm.remove())); row.append(confirm);
      }, 'danger')); row.append(controls); list.append(row);
    }
    listArea.append(list);
  }
  if (cursor) listArea.append(button('加载更多', () => safe(() => load(true))));
  workspace.append(listArea); content.append(workspace); if (editing) openEditor(editing);
}
function openEditor(item) {
  const workspace = document.querySelector('#workspace'); if (!workspace) return;
  workspace.querySelector('.editor')?.remove(); workspace.classList.add('editing');
  editing = item; const editor = node('section', undefined, 'editor'), head = node('div', undefined, 'editor-head');
  head.append(node('h2', (item ? '编辑' : '新建') + names[collection]), button('关闭', () => { editing = null; editor.remove(); workspace.classList.remove('editing'); }));
  const form = node('form', undefined, 'form-stack'), error = errorNode();
  form.append(field(collection === 'preferences' ? '偏好名称' : '标题', 'title', { maxLength: 100, value: item?.data.title || '' }));
  form.append(field(collection === 'bookmarks' ? '地点、链接或备注' : collection === 'preferences' ? '偏好内容' : '内容', 'text', { multiline: true, required: false, value: String(item?.data.text ?? item?.data.value ?? item?.data.url ?? '') }));
  const submit = node('button', '保存到我的账号', 'primary'); submit.type = 'submit'; form.append(error, submit);
  const chosen = collection, owner = account.identity.id, ticket = epoch;
  form.onsubmit = event => { event.preventDefault(); error.replaceChildren(); const values = Object.fromEntries(new FormData(form)); void safe(async () => {
    if (owner !== account?.identity.id || ticket !== epoch) return;
    await api.put(chosen, item?.id || crypto.randomUUID(), { ...(item?.data || {}), title: values.title, text: values.text }, item?.revision || 0);
    editing = null; await load(); message('已保存到当前账号。');
  }, e => {
    error.textContent = e.status === 409 ? '另一台设备已更新。你正在编辑的文字仍保留，请核对云端版本。' : e.message;
    if (e.remote) {
      const conflict = node('div', undefined, 'conflict'); conflict.append(node('pre', JSON.stringify(e.remote.data, null, 2)), button('采用云端版本', () => { if (e.remote.deleted) { editing = null; void load(); } else openEditor(e.remote); })); error.append(conflict);
    }
  }); };
  editor.append(head, form); workspace.append(editor); form.querySelector('input').focus();
}
function renderSecurity(sessions) {
  const content = document.querySelector('#content'); content.querySelector('.skeleton')?.remove();
  const passwordSection = node('section', undefined, 'security-section'); passwordSection.append(node('h2', account.hasPassword ? '修改密码' : '为受邀账号设置密码'), node('p', '保存后，所有设备会退出登录，请使用新密码重新进入。', 'muted'));
  const form = node('form', undefined, 'form-stack');
  if (account.hasPassword) form.append(field('当前密码', 'current', { type: 'password', maxLength: 256, autocomplete: 'current-password' }));
  form.append(field('新密码，至少 12 个字符', 'password', { type: 'password', maxLength: 256, autocomplete: 'new-password' }), field('再次输入新密码', 'confirm', { type: 'password', maxLength: 256, autocomplete: 'new-password' }));
  form.querySelector('[name=password]').minLength = 12;
  const feedback = errorNode(), submit = node('button', '保存新密码', 'primary'); submit.type = 'submit'; form.append(feedback, submit);
  form.onsubmit = event => { event.preventDefault(); feedback.textContent = ''; const input = Object.fromEntries(new FormData(form)); if (input.password !== input.confirm) { feedback.textContent = '两次新密码不一致。'; return; } void safe(async () => { await api.changePassword(input.password, input.current); announceIdentity(); form.reset(); lock(); message('密码已保存，请重新登录。'); }, e => { feedback.textContent = e.message; }); };
  passwordSection.append(form); content.append(passwordSection);
  const devices = node('section', undefined, 'security-section'); devices.append(node('h2', '已登录设备'), node('p', '只显示当前账号的有效会话。不认识的会话可以单独退出。', 'muted'));
  for (const session of sessions) {
    const row = node('div', undefined, 'session-row'), details = node('div');
    details.append(node('p', session.current ? '当前设备' : '另一台已登录设备'), node('small', '登录于 ' + new Date(session.createdAt).toLocaleString('zh-CN')));
    row.append(details, button('退出此会话', () => safe(async () => { await api.revokeSession(session.id); if (session.current) { announceIdentity(); lock(); } else { renderDashboard(); await load(); } }))); devices.append(row);
  }
  devices.append(button('退出所有设备', () => safe(async () => { await api.logoutAll(); announceIdentity(); lock(); message('所有设备均已退出。'); }))); content.append(devices);
  const deletion = node('section', undefined, 'security-section'); deletion.append(node('h2', '注销账号'), node('p', '注销会删除此账号的个人数据与教师内容，所有设备会立即退出。请先导出需要保留的记录。', 'muted'));
  const details = document.createElement('details'); details.append(node('summary', '展开账号注销确认'));
  const deleteForm = node('form', undefined, 'form-stack'), deleteError = errorNode();
  deleteForm.append(field('输入当前账号名确认', 'confirm', { maxLength: 40 }), field('当前密码', 'password', { type: 'password', maxLength: 256, autocomplete: 'current-password' }), deleteError);
  const remove = node('button', '永久注销我的账号', 'danger'); remove.type = 'submit'; deleteForm.append(remove);
  deleteForm.onsubmit = event => { event.preventDefault(); const values = Object.fromEntries(new FormData(deleteForm)); void safe(async () => { await api.deleteAccount(values.password, values.confirm); announceIdentity(); deleteForm.reset(); lock(); message('账号及其个人数据已注销。'); }, e => { deleteError.textContent = e.message; }); };
  details.append(deleteForm); deletion.append(details); content.append(deletion);
}
async function exportData() {
  const owner = account.identity.id, ticket = epoch;
  await safe(async () => {
    const data = {};
    for (const type of Object.keys(names)) {
      data[type] = []; let next = '';
      do {
        if (owner !== account?.identity.id || ticket !== epoch) throw new Error('账号已变化，导出已停止。');
        const page = await api.list(type, { cursor: next, limit: 200 }); data[type].push(...page.items); next = page.nextCursor;
      } while (next);
    }
    if (owner !== account?.identity.id || ticket !== epoch) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'haiz-personal-v1', account: account.identity.name, exportedAt: new Date().toISOString(), collections: data }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'haiz-my-data.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); message('已导出便签、收藏与偏好。');
  });
}
async function verify() {
  const ticket = epoch;
  try { const result = await api.me(); if (ticket !== epoch) return; if (!account) await signedIn(result); else if (account.identity.id !== result.identity.id) { lock(); await signedIn(result); } }
  catch (e) { if (ticket !== epoch) return; if (e.status === 401) lock(); else { main.replaceChildren(node('div', '暂时无法验证账号，请检查网络后刷新。', 'boot')); } }
}
registration = (await api.config().catch(() => ({ registration: false }))).registration;
await verify();
setInterval(() => { if (account && !document.hidden && !busy) void verify(); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && !busy) void verify(); });
if (identityChannel) identityChannel.onmessage = event => {
  if (event.data?.type !== 'identity-changed') return;
  lock(); void verify();
};
window.addEventListener('pagehide', () => {
  clearTimeout(expiryTimer); epoch++; account = null; items = []; editing = null; cursor = null;
  main.replaceChildren(node('div', '正在确认登录状态…', 'boot'));
});
window.addEventListener('pageshow', event => { if (event.persisted) void verify(); });

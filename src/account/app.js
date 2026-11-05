import { createHaizClient } from '/haiz-client.js';
const api = createHaizClient(), main = document.querySelector('#main'), notice = document.querySelector('#notice');
const names = { notes: '便签', bookmarks: '收藏', preferences: '偏好' };
const views = { ...names, search: '搜索', trash: '回收站', activity: '操作记录', usage: '数据用量', security: '账号安全' };
let account = null, mode = 'login', collection = 'notes', items = [], cursor = null, editing = null, epoch = 0, busy = false, registration = false;
let query = '', trashCollection = 'notes';
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
function lock() { clearTimeout(expiryTimer); api.setIdentity(null); epoch++; account = null; items = []; editing = null; cursor = null; query = ''; mode = 'login'; renderAuth(); }
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
  main.replaceChildren(node('div', '正在返回灯光登录页…', 'boot'));
  location.replace('/login/?next=' + encodeURIComponent(nextPage() || '/account/'));
}

function renderDashboard() {
  main.replaceChildren(); const header = node('header', undefined, 'site-header'), logo = node('a', 'haiz', 'brand'); logo.href = '/';
  const actions = node('div', undefined, 'actions'), campus = node('a', '进入校园 ↗', 'campus-link'); campus.href = '/';
  actions.append(node('span', account.identity.name, 'header-user'), campus, button('退出登录', () => safe(async () => { await api.logout(); announceIdentity(); lock(); history.replaceState(null, '', '/account/'); message('已退出登录。'); })));
  header.append(logo, actions); const dashboard = node('div', undefined, 'dashboard'), rail = node('aside', undefined, 'rail');
  rail.append(node('h2', '我的数据'), node('p', '在校园里，\n留一处自己的空间。'));
  const nav = node('nav'); nav.setAttribute('aria-label', '个人数据分类');
  for (const [id, label] of Object.entries(views)) {
    const b = button(label, () => { epoch++; collection = id; items = []; cursor = null; editing = null; renderDashboard(); void load(); }, collection === id ? 'active' : '');
    if (collection === id) b.setAttribute('aria-current', 'page'); nav.append(b);
  }
  rail.append(nav, node('small', '当前账号：' + account.identity.name)); const content = node('section'); content.id = 'content';
  const heading = node('div', undefined, 'page-heading'), title = node('div');
  const descriptions = { security: '管理密码与已登录设备。', search: '查找当前账号的便签、收藏与偏好。', trash: '恢复误删的内容，恢复后会生成一个新版本。', activity: '查看本人最近的账号与数据操作。', usage: '查看当前记录和历史版本占用的空间。' };
  title.append(node('h1', names[collection] ? '我的' + names[collection] : views[collection]), node('p', descriptions[collection] || '只属于当前账号，由你管理。'));
  heading.append(title);
  if (names[collection]) { const controls = node('div', undefined, 'actions'); controls.append(button('导出我的数据', exportData), button('新建' + names[collection], () => openEditor(null), 'primary')); heading.append(controls); }
  content.append(heading);
  if (names[collection] || collection === 'search') {
    const search = node('form', undefined, 'search-form'); search.setAttribute('role', 'search');
    search.append(field('搜索我的全部数据', 'q', { type: 'search', maxLength: 100, value: query }));
    const submit = node('button', '搜索', 'primary'); submit.type = 'submit'; search.append(submit);
    search.onsubmit = event => { event.preventDefault(); query = new FormData(search).get('q').trim(); if (!query) return; epoch++; collection = 'search'; items = []; cursor = null; editing = null; renderDashboard(); void load(); }; content.append(search);
  }
  if (collection === 'trash') {
    const label = node('label', '选择回收站分类', 'collection-filter'), select = document.createElement('select');
    for (const [id, name] of Object.entries(names)) { const option = node('option', name); option.value = id; option.selected = id === trashCollection; select.append(option); }
    select.onchange = () => { epoch++; trashCollection = select.value; items = []; cursor = null; renderDashboard(); void load(); }; label.append(select); content.append(label);
    content.append(node('p', '历史最多保留 30 天，每条 20 个、每账号 2000 个。超过期限或数量的旧版本会被清理。', 'retention-note'));
  }
  const loading = node('div', undefined, 'skeleton'); loading.setAttribute('role', 'status'); loading.setAttribute('aria-label', '正在读取个人数据'); content.append(loading);
  dashboard.append(rail, content); main.append(header, dashboard);
}
async function load(append = false) {
  const ticket = epoch, selected = collection;
  try {
    if (selected === 'security') { const result = await api.sessions(); if (ticket === epoch) renderSecurity(result.sessions); return; }
    if (selected === 'usage') { const result = await api.usage(); if (ticket === epoch) renderUsage(result); return; }
    if (selected === 'search' && !query) { renderResults('输入关键词，查找自己的便签、收藏和偏好。'); return; }
    if (['search', 'trash', 'activity'].includes(selected)) {
      const page = { cursor: append ? cursor : '', limit: 100 };
      const result = selected === 'search' ? await api.search(query, page) : selected === 'trash' ? await api.trash(trashCollection, page) : await api.activity(page);
      if (ticket !== epoch || !account) return;
      items = append ? [...items, ...(result.items || result.events)] : result.items || result.events; cursor = result.nextCursor;
      renderResults(); return;
    }
    const result = await api.list(selected, { cursor: append ? cursor : '', limit: 100 });
    if (ticket !== epoch || !account) return;
    items = append ? [...items, ...result.items] : result.items; cursor = result.nextCursor; renderItems();
  } catch (e) {
    if (ticket !== epoch) return;
    if (e.status === 401 || e.identityChanged) { lock(); return; }
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
      }, 'danger'), button('历史版本', () => showHistory(collection, item))); row.append(controls); list.append(row);
    }
    listArea.append(list);
  }
  if (cursor) listArea.append(button('加载更多', () => safe(() => load(true))));
  workspace.append(listArea); content.append(workspace); if (editing) openEditor(editing);
}
const actionNames = { registered: '注册账号', login: '登录账号', logout: '退出登录', logout_all: '退出全部设备', session_revoked: '撤销设备会话', invite_claimed: '使用邀请登录', password_changed: '修改密码', personal_created: '新建记录', personal_updated: '修改记录', personal_deleted: '移入回收站', personal_restored: '恢复记录', draft_saved: '保存教师草稿', course_saved: '保存课程', task_saved: '保存待办', notice_published: '发布通知', notice_revoked: '撤回通知' };
function renderResults(emptyText) {
  const content = document.querySelector('#content'); content.querySelector('.skeleton')?.remove(); content.querySelector('.workspace')?.remove();
  const workspace = node('section', undefined, 'workspace'); workspace.id = 'workspace';
  const status = node('p', '', 'muted'); status.setAttribute('role', 'status');
  status.textContent = collection === 'search' ? (query ? '“' + query + '” · 已显示 ' + items.length + ' 条结果' : '按关键词查找') : collection === 'trash' ? '已显示 ' + items.length + ' 条可恢复记录' : '最近的操作';
  workspace.append(status);
  if (!items.length) {
    const empty = node('div', undefined, 'empty'); empty.append(node('h2', collection === 'trash' ? '回收站里没有可恢复的内容' : collection === 'activity' ? '还没有操作记录' : '查找自己的记录'), node('p', emptyText || (collection === 'search' ? '没有找到匹配内容，试试其他关键词。' : collection === 'trash' ? '已删除的内容会在保留范围内出现在这里。' : '账号与数据操作将在这里显示。'))); workspace.append(empty);
  } else {
    const list = node('ul', undefined, 'data-list');
    for (const item of items) {
      const row = node('li', undefined, 'data-row');
      if (collection === 'activity') {
        row.append(node('h3', actionNames[item.action] || '账号操作'), node('small', new Date(item.at).toLocaleString('zh-CN')));
        if (item.target && item.action.startsWith('personal_')) {
          const [kind, id] = item.target.split(':'); row.append(node('p', (names[kind] || '记录') + ' · ' + (id || item.target)));
        }
      } else {
        const chosen = collection === 'trash' ? trashCollection : item.collection;
        row.append(node('h3', item.data.title || item.id), node('p', String(item.data.text ?? item.data.value ?? item.data.url ?? '')), node('small', names[chosen] + ' · ' + (collection === 'trash' ? '删除于 ' : '保存于 ') + new Date(item.updatedAt).toLocaleString('zh-CN')));
        const controls = node('div', undefined, 'actions');
        if (collection === 'trash') controls.append(button('恢复这条' + names[chosen], () => confirmRestore(row, chosen, item), 'primary'));
        else controls.append(button('打开编辑', () => safe(async () => {
          epoch++; collection = chosen; editing = null; items = []; cursor = null; const ticket = epoch; renderDashboard(); await load(); if (ticket === epoch && account) openEditor(item);
        })));
        controls.append(button('历史版本', () => showHistory(chosen, item))); row.append(controls);
      }
      list.append(row);
    }
    workspace.append(list);
  }
  if (cursor) workspace.append(button('加载更多', () => safe(() => load(true)))); content.append(workspace);
}
function confirmRestore(container, chosen, item, version) {
  container.querySelector('.confirm-row')?.remove();
  const confirm = node('div', undefined, 'confirm-row'), ticket = epoch, owner = account?.identity.id;
  confirm.append(node('p', version === undefined ? '将这条记录恢复到原分类，并生成一个新版本？' : '将记录内容恢复为版本 ' + version + '？当前内容会保留在历史中。'), button('确认恢复', () => safe(async () => {
    if (ticket !== epoch || owner !== account?.identity.id) return;
    await api.restore(chosen, item.id, item.revision, version);
    if (ticket !== epoch || owner !== account?.identity.id) return;
    document.querySelector('.history-panel')?.remove(); editing = null; await load(); message('已恢复，旧设备仍需刷新后才能继续编辑。');
  }, error => { confirm.replaceChildren(node('p', error.status === 409 ? '记录已在另一台设备变化，请关闭面板后重新读取。' : error.message, 'error'), button('关闭', () => confirm.remove())); })), button('取消', () => confirm.remove())); container.append(confirm);
}
function showHistory(chosen, item) {
  const ticket = epoch, owner = account?.identity.id;
  void safe(async () => {
    const result = await api.history(chosen, item.id);
    if (ticket !== epoch || owner !== account?.identity.id) return;
    const content = document.querySelector('#content'); content.querySelector('.history-panel')?.remove();
    const panel = node('section', undefined, 'history-panel security-section'), heading = node('div', undefined, 'editor-head');
    heading.append(node('h2', '历史版本'), button('关闭历史', () => panel.remove())); panel.append(heading, node('p', '恢复会新增版本。历史最多保留 30 天，每条 20 个、每账号 2000 个旧版本。', 'muted'));
    const current = result.items[0];
    for (const version of result.items) {
      const row = node('article', undefined, 'data-row');
      row.append(node('h3', '版本 ' + version.revision + (version.revision === current.revision ? ' · 当前' : '') + (version.deleted ? ' · 已删除' : '')), node('small', new Date(version.updatedAt).toLocaleString('zh-CN')));
      if (version.data) { row.append(node('pre', JSON.stringify(version.data, null, 2), 'version-content')); if (version.revision !== current.revision) row.append(button('恢复到此版本', () => confirmRestore(row, chosen, current, version.revision))); }
      panel.append(row);
    }
    content.append(panel); panel.scrollIntoView({ block: 'start' }); panel.querySelector('button').focus();
  });
}
function formatBytes(value) { return value < 1024 ? value + ' B' : value < 1048576 ? (value / 1024).toFixed(1) + ' KB' : (value / 1048576).toFixed(1) + ' MB'; }
function renderUsage(result) {
  const content = document.querySelector('#content'); content.querySelector('.skeleton')?.remove();
  const section = node('section', undefined, 'security-section'), count = result.totals.active + result.totals.deleted;
  section.append(node('h2', count + ' / ' + result.limits.items + ' 条记录'), node('p', '包含 ' + result.totals.active + ' 条有效记录和 ' + result.totals.deleted + ' 条删除标记。删除标记用于阻止旧设备覆盖，仍计入条数。', 'muted'));
  const meter = document.createElement('meter'); meter.min = 0; meter.max = result.limits.items; meter.value = count; meter.setAttribute('aria-label', '已使用的个人数据条数'); section.append(meter);
  const table = document.createElement('table'), head = document.createElement('thead'), titles = document.createElement('tr');
  for (const label of ['分类', '有效记录', '删除标记', '记录内容']) { const cell = node('th', label); cell.scope = 'col'; titles.append(cell); } head.append(titles); table.append(head);
  const body = document.createElement('tbody'); for (const [type, usage] of Object.entries(result.collections)) {
    const row = document.createElement('tr'), title = node('th', names[type]); title.scope = 'row'; row.append(title, node('td', String(usage.active)), node('td', String(usage.deleted)), node('td', formatBytes(usage.bytes))); body.append(row);
  }
  table.append(body); section.append(table, node('p', '历史版本 ' + result.totals.historyVersions + ' 个，占用 ' + formatBytes(result.totals.historyBytes) + '。每条内容最多 ' + formatBytes(result.limits.itemBytes) + '。统计为保存的 JSON 内容大小，不包含数据库索引与备份。', 'muted'), button('导出当前有效数据', exportData)); content.append(section);
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
  const deletion = node('section', undefined, 'security-section'); deletion.append(node('h2', '注销账号'), node('p', '注销会删除服务中的个人数据、历史版本与教师内容，所有设备会立即退出。服务器历史备份按备份轮换策略移除。请先导出需要保留的记录。', 'muted'));
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
await verify();
setInterval(() => { if (account && !document.hidden && !busy) void verify(); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && !busy) void verify(); });
if (identityChannel) identityChannel.onmessage = event => {
  if (event.data?.type !== 'identity-changed') return;
  lock(); void verify();
};
window.addEventListener('pagehide', () => {
  clearTimeout(expiryTimer); epoch++; account = null; items = []; editing = null; cursor = null; query = '';
  main.replaceChildren(node('div', '正在确认登录状态…', 'boot'));
});
window.addEventListener('pageshow', event => { if (event.persisted) void verify(); });

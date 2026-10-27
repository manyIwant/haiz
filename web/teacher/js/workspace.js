import { ApiError, STATUS, DUE_PRECISION, ROUTES, contentBody, createAssignmentCommands, validateDraft, validateAssignment } from './api.js';
import { createDraftStore, DRAFT_STATE } from './drafts.js';
import { createJournal } from './journal.js';
import * as ui from './ui.js';

const active = assignment => [STATUS.PUBLISHED, STATUS.REVISED].includes(assignment.status);

/** @param {{root:HTMLElement, academicClient:ReturnType<import('./api.js').createClient>}} options */
export function createWorkspace({ root, academicClient }) {
  const commands = createAssignmentCommands(academicClient);
  let drafts;
  let journal;
  let wired = false;
  let busy = false;
  let state = { user: null, classes: [], selectedClassId: '', assignments: [], view: 'workspace', composer: null, detail: null, detailHistory: null, offline: false };
  const update = changes => { state = { ...state, ...changes }; };
  const selectedClass = () => state.classes.find(item => item.id === state.selectedClassId);
  const announce = (kind, title, message, actions = []) => {
    ui.byId('notices').replaceChildren(ui.notice(kind, title, message, actions));
  };
  const guarded = fn => async (...args) => {
    if (busy) return;
    busy = true;
    root.setAttribute('aria-busy', 'true');
    try { await fn(...args); }
    catch (error) { announce('stop', '操作未完成', error.message || '请保留草稿后重试。'); }
    finally { busy = false; root.setAttribute('aria-busy', 'false'); render(); }
  };

  function render() {
    if (!drafts) return;
    for (const view of ['workspace', 'published', 'history']) {
      ui.byId(`${view}-view`).hidden = state.view !== view;
      const link = document.querySelector(`[data-view="${view}"]`);
      if (link) link.setAttribute('aria-current', state.view === view ? 'page' : 'false');
    }
    const local = drafts.localOnly();
    for (const [view, count] of Object.entries({ workspace: local.length, published: state.assignments.filter(active).length, history: state.assignments.length })) {
      document.querySelector(`[data-view-count="${view}"]`).textContent = count;
    }
    ui.byId('draft-list').replaceChildren(ui.draftList(local, { current: state.composer?.id, onOpen: openDraft, onResolve: guarded(resolveDraft) })
      ?? ui.el('div', { class: 'empty' }, ui.el('p', {}, '新建一项草稿，先整理，再检查。')));
    ui.byId('published-list').replaceChildren(ui.publishedList(state.assignments, { current: state.detail?.id, onOpen: openDetail }));
    ui.byId('history-list').replaceChildren(ui.historyList(state.assignments, { current: state.detail?.id, onOpen: openDetail }));
    renderComposer();
    renderDetail(ui.byId('published-detail'));
    renderDetail(ui.byId('history-detail'));
    renderRecovery();
    ui.byId('import-legacy').hidden = !drafts.hasLegacy();
  }

  function renderComposer() {
    const draft = state.composer;
    ui.byId('composer-form').hidden = !draft;
    ui.byId('composer-empty').hidden = Boolean(draft);
    if (!draft) {
      ui.byId('review-panel').replaceChildren();
      ui.byId('preview-panel').replaceChildren();
      return;
    }
    for (const field of ['subject', 'title', 'details']) ui.byId(`f-${field}`).value = draft[field] ?? '';
    const select = ui.classSelect(state.classes, draft.classId, id => {
      update({ composer: { ...readComposer(), classId: id, className: state.classes.find(c => c.id === id)?.title ?? '' } });
      persistComposer(); renderChecks();
    });
    select.disabled = Boolean(draft.publishedId) || state.offline;
    ui.byId('f-class-host').replaceChildren(select);
    const precision = draft.duePrecision ?? DUE_PRECISION.NONE;
    ui.byId('f-due-precision').value = precision;
    ui.byId('f-due-date-row').hidden = precision !== 'date';
    ui.byId('f-due-minute-row').hidden = precision !== 'minute';
    ui.byId('f-due-date').value = precision === 'date' ? draft.due ?? '' : '';
    ui.byId('f-due-minute').value = precision === 'minute' ? minuteLocalValue(draft.due) : '';
    const unresolved = draft.pendingIntent && journal?.get(draft.pendingIntent)?.status === 'pending';
    for (const input of ui.byId('composer-form').querySelectorAll('input,textarea,select')) {
      if (unresolved) input.disabled = true;
      else if (input.id !== 'f-class') input.disabled = false;
    }
    ui.byId('save-edit').hidden = !draft.editing;
    ui.byId('publish-draft').hidden = draft.editing;
    ui.byId('publish-draft').disabled = Boolean(unresolved) || state.offline;
    ui.byId('save-edit').disabled = Boolean(unresolved) || state.offline;
    ui.byId('save-draft').disabled = Boolean(unresolved);
    ui.byId('discard-draft').disabled = Boolean(unresolved);
    ui.byId('composer-status').textContent = unresolved ? '结果未知 · 请恢复原请求' : draft.publishedId ? `服务器关联 · v${draft.publishedVersion}` : '本机草稿';
    renderChecks();
  }

  function readComposer() {
    const precision = ui.byId('f-due-precision').value;
    const due = precision === 'date' ? ui.byId('f-due-date').value || null
      : precision === 'minute' ? minuteIsoValue(ui.byId('f-due-minute').value) : null;
    return { ...state.composer, subject: ui.byId('f-subject').value, title: ui.byId('f-title').value,
      details: ui.byId('f-details').value, due, duePrecision: precision };
  }
  function renderChecks() {
    if (!state.composer) return;
    const draft = readComposer();
    ui.byId('review-panel').replaceChildren(ui.reviewChecklist(draft));
    ui.byId('preview-panel').replaceChildren(ui.studentPreview(draft));
    ui.byId('f-details-counter').textContent = `${draft.details.length} / 3000`;
  }
  function persistComposer() {
    if (!state.composer) return;
    const draft = readComposer();
    drafts.save(draft);
    update({ composer: draft });
  }
  function openDraft(draft) { update({ composer: { ...draft }, view: 'workspace' }); render(); }
  function newDraft() {
    const cls = selectedClass();
    openDraft(drafts.create({ classId: cls?.id ?? '', className: cls?.title ?? '' }));
    ui.byId('f-subject').focus();
  }

  function renderDetail(host) {
    const a = state.detail;
    if (!a) { host.replaceChildren(ui.el('div', { class: 'empty' }, ui.el('p', {}, '选择一项作业查看内容和版本历史。'))); return; }
    const actions = [ui.button('版本历史', guarded(() => openHistoryFor(a)), 'btn quiet')];
    if (a.status !== STATUS.RETRACTED) actions.unshift(ui.button('修改内容', () => startEdit(a), 'btn secondary'));
    if (a.status === STATUS.DRAFT) actions.push(ui.button('进入 Review', guarded(() => reviewServer(a)), 'btn'));
    if (a.status === STATUS.REVIEW) actions.push(ui.button('确认发布', guarded(() => confirmTransition(a, 'publish')), 'btn confirm'));
    if (active(a)) actions.push(ui.button('撤回', guarded(() => confirmTransition(a, 'retract')), 'btn danger'));
    host.replaceChildren(ui.el('article', { class: 'panel' },
      ui.el('div', { class: 'panel-head' }, ui.el('h2', {}, a.title), ui.serverChip(a)),
      ui.el('div', { class: 'panel-body' }, ui.studentPreview(a),
        ui.el('p', { class: 'item-meta' }, `服务器版本 v${a.version} · ${a.id}`),
        ui.el('div', { class: 'actions spaced' }, actions),
        state.detailHistory ? ui.timeline(state.detailHistory) : null)));
  }
  function openDetail(a) { update({ detail: a, detailHistory: null }); render(); }
  async function openHistoryFor(a) {
    const { data } = await commands.history(a.id);
    update({ detail: a, detailHistory: data.revisions });
  }
  function localFor(a) {
    return drafts.all().find(draft => draft.publishedId === a.id) ?? drafts.create({
      ...contentBody(a), classId: a.classId, className: state.classes.find(c => c.id === a.classId)?.title ?? '',
      publishedId: a.id, publishedVersion: a.version, serverStatus: a.status,
    });
  }
  function startEdit(a) {
    const saved = localFor(a);
    if (saved.pendingIntent && journal.get(saved.pendingIntent)?.status === 'pending') { openDraft(saved); return; }
    const draft = { ...saved, ...contentBody(a), publishedVersion: a.version, serverStatus: a.status, state: DRAFT_STATE.LOCAL, editing: true };
    drafts.save(draft); openDraft(draft);
    announce('info', '修改保留在本机', `基于服务器版本 v${a.version}。保存后才会生成新版本。`);
  }

  function requestFor(draft, operation) {
    if (operation === 'create') return { path: ROUTES.create(draft.classId), method: 'POST', body: contentBody(draft) };
    return { path: ROUTES[operation](draft.publishedId), method: operation === 'edit' ? 'PATCH' : 'POST',
      body: operation === 'edit' ? { ...contentBody(draft), expectedVersion: draft.publishedVersion } : { expectedVersion: draft.publishedVersion } };
  }
  function adopt(draft, assignment) {
    const next = { ...draft, publishedId: assignment.id, publishedVersion: assignment.version, serverStatus: assignment.status,
      pendingIntent: null, editing: false, state: active(assignment) || assignment.status === STATUS.RETRACTED ? DRAFT_STATE.PUBLISHED
        : assignment.status === STATUS.REVIEW ? DRAFT_STATE.IN_REVIEW : DRAFT_STATE.LOCAL };
    drafts.save(next);
    update({ composer: active(assignment) || assignment.status === STATUS.RETRACTED ? null : next,
      detail: assignment, detailHistory: null, view: active(assignment) ? 'published' : 'history' });
    return next;
  }
  async function mutate(draft, operation) {
    if (!journal || state.offline) throw new Error('离线草稿不能发布，请先登录并连接教务服务。');
    const intent = `${draft.id}:${operation}:${draft.publishedVersion ?? 0}`;
    const staged = { ...draft, pendingIntent: intent, state: DRAFT_STATE.SUBMITTING };
    drafts.save(staged); update({ composer: staged });
    try {
      const response = await journal.execute(intent, requestFor(draft, operation));
      const assignment = validateAssignment(response.data.assignment);
      return { assignment, draft: adopt(staged, assignment) };
    } catch (error) {
      const entry = journal.get(intent);
      const next = { ...staged, state: entry?.status === 'rejected' ? DRAFT_STATE.LOCAL : DRAFT_STATE.UNKNOWN };
      drafts.save(next); update({ composer: next, view: 'workspace' });
      if (entry?.status === 'rejected') {
        journal.clear(intent);
        drafts.save({ ...next, pendingIntent: null });
        update({ composer: { ...next, pendingIntent: null } });
      }
      if (error.code === 'VERSION_CONFLICT') await showConflict(next);
      else announce(entry?.status === 'rejected' ? 'stop' : 'warn', entry?.status === 'rejected' ? '服务器拒绝了操作' : '结果尚未确认',
        `${error.message} 原始内容已保留；结果未知时请恢复原请求，不要新建相同作业。`);
      return null;
    }
  }
  async function refreshAfterCommand() {
    try { await refreshAssignments(); }
    catch (error) { announce('warn', '操作已确认，列表暂未刷新', `服务器已确认这次操作。${error.message} 请使用刷新列表更新显示。`); }
  }
  async function submitDraft() {
    if (!state.composer || state.composer.editing) return;
    const draft = readComposer();
    const problems = validateDraft(draft);
    if (problems.length) { announce('stop', '请检查内容', problems.join(' ')); return; }
    drafts.save(draft);
    let result;
    if (!draft.publishedId) result = await mutate(draft, 'create');
    else if (draft.serverStatus === STATUS.REVIEW) { openDetail((await commands.read(draft.publishedId)).data.assignment); update({ view: 'history' }); return; }
    else result = await mutate(draft, 'edit');
    if (!result) return;
    result = await mutate(result.draft, 'review');
    if (!result) return;
    announce('info', 'Review · 等待教师确认', '内容已保存到服务器，学生尚不可见。请核对班级、内容和截止时间，再点击「确认发布」。');
    await refreshAfterCommand();
  }
  async function saveEdit() {
    const draft = readComposer();
    const problems = validateDraft(draft);
    if (problems.length) { announce('stop', '请检查内容', problems.join(' ')); return; }
    drafts.save(draft);
    const result = await mutate(draft, 'edit');
    if (!result) return;
    announce('ok', '服务器已保存修改', `「${result.assignment.title}」现在是 v${result.assignment.version}。`);
    await refreshAfterCommand();
  }
  async function reviewServer(a) {
    const draft = { ...localFor(a), ...contentBody(a), publishedVersion: a.version };
    const result = await mutate(draft, 'review');
    if (result) { announce('info', 'Review · 等待教师确认', '学生尚不可见，请核对预览后确认发布。'); await refreshAfterCommand(); }
  }
  async function confirmTransition(a, operation) {
    const retract = operation === 'retract';
    const yes = await ui.askConfirm({ title: retract ? '撤回这项作业？' : '正式发布这项作业？',
      body: ui.el('div', {}, ui.el('p', {}, `班级：${state.classes.find(c => c.id === a.classId)?.title ?? a.classId} · 版本 v${a.version}`),
        ui.studentPreview(a), ui.el('p', {}, retract ? '撤回会保留历史；学生的私人笔记不会删除。' : '这是教师自己的检查。服务器确认后才显示已发布；学生刷新后可获取正式内容。')),
      confirmLabel: retract ? '确认撤回' : '正式发布', tone: retract ? 'danger' : 'confirm' });
    if (!yes) return;
    const draft = { ...localFor(a), ...contentBody(a), publishedVersion: a.version };
    const result = await mutate(draft, operation);
    if (!result) return;
    announce('ok', retract ? '服务器已确认撤回' : '服务器已确认发布', `「${a.title}」· v${result.assignment.version}。${retract ? '历史记录仍保留。' : '学生刷新后可获取这项作业。'}`);
    await refreshAfterCommand();
  }

  async function showConflict(draft) {
    const server = (await commands.read(draft.publishedId)).data.assignment;
    ui.byId('conflict-body').replaceChildren(ui.el('p', {}, `服务器当前为 v${server.version}（${server.status}）。未提交的修改已保存在本机。`), ui.conflictDiff(draft, server));
    ui.byId('conflict-retry').disabled = server.status === STATUS.RETRACTED;
    ui.byId('conflict-retry').onclick = () => {
      const next = { ...draft, publishedVersion: server.version, serverStatus: server.status, pendingIntent: null, editing: true, state: DRAFT_STATE.LOCAL };
      drafts.save(next); update({ composer: next, view: 'workspace' });
      ui.byId('conflict-dialog').close(); render();
      announce('info', '请重新检查并确认', '已载入最新版本号，尚未提交你的修改。检查后点击「保存修改」。');
    };
    ui.byId('conflict-discard').onclick = () => {
      ui.byId('conflict-dialog').close();
      announce('info', '本机修改仍保留', '你可以继续比较和编辑，服务器内容没有被覆盖。');
    };
    ui.byId('conflict-dialog').showModal();
  }
  async function resolveDraft(draft) {
    if (!draft.pendingIntent) {
      if (draft.publishedId) { const { data } = await commands.read(draft.publishedId); adopt(draft, data.assignment); }
      else announce('info', '本机草稿', '没有已保存的服务器请求。请检查后进入 Review。');
      return;
    }
    try {
      const response = await journal.replay(draft.pendingIntent);
      const a = validateAssignment(response.data.assignment);
      adopt(draft, a);
      // Receipt confirms the original command; a fresh read shows any later revisions.
      const latest = (await commands.read(a.id)).data.assignment;
      adopt(draft, latest);
      announce('ok', '已核对服务器结果', `当前状态 ${latest.status} · v${latest.version}。原请求使用相同标识恢复。`);
      await refreshAfterCommand();
    } catch (error) {
      if (error.code === 'VERSION_CONFLICT') await showConflict(draft);
      else announce('warn', '恢复尚未完成', `${error.message} 原始请求仍保留，请稍后再试。`);
    }
  }
  function renderRecovery() {
    const host = ui.byId('recovery');
    const pending = journal?.pending() ?? [];
    host.replaceChildren(...pending.map(entry => ui.notice('warn', '有一项请求结果未知', `${entry.method} ${entry.path}。请使用原请求恢复。`, [{ label: '恢复原请求', on: guarded(async () => {
      const draft = drafts.all().find(item => item.pendingIntent === entry.intent);
      if (!draft) throw new Error('找不到关联草稿，请保留日志并联系管理员。');
      await resolveDraft(draft);
    }) }])));
  }

  async function refreshAssignments() {
    if (!state.selectedClassId || state.offline) return;
    const classId = state.selectedClassId;
    const { data } = await commands.list(classId);
    if (classId === state.selectedClassId) update({ assignments: data.assignments });
  }
  function renderClassSelector() {
    const select = ui.el('select', { id: 'active-class', 'aria-label': '当前班级' },
      state.classes.map(c => ui.el('option', { value: c.id, selected: c.id === state.selectedClassId }, c.title)));
    select.addEventListener('change', guarded(async () => {
      persistComposer(); update({ selectedClassId: select.value, assignments: [], detail: null, detailHistory: null });
      await refreshAssignments();
    }));
    ui.byId('class-toolbar').replaceChildren(ui.el('label', { htmlFor: 'active-class' }, '当前班级'), select,
      ui.button('刷新列表', guarded(refreshAssignments), 'btn secondary'),
      ui.button('教室屏预览', () => {
        const key = selectedClass()?.screenKey;
        if (!key) { announce('warn', '无法打开教室屏', '当前班级没有可用的展示凭据。'); return; }
        try { sessionStorage.setItem('haiz.classroom.handoff', key); location.assign('classroom.html'); }
        catch (error) { announce('stop', '无法传递展示凭据', error.message); }
      }, 'btn secondary'));
  }
  function wire() {
    if (wired) return;
    wired = true; ui.wireConfirmDialog();
    for (const link of document.querySelectorAll('button[data-view]')) link.addEventListener('click', () => {
      try { persistComposer(); update({ view: link.dataset.view }); history.replaceState(null, '', `#${state.view}`); render(); }
      catch (error) { announce('stop', '草稿未保存', error.message); }
    });
    ui.byId('new-draft').onclick = guarded(newDraft);
    ui.byId('save-draft').onclick = guarded(() => { persistComposer(); ui.toast('草稿已保存在本机'); });
    ui.byId('publish-draft').onclick = guarded(submitDraft);
    ui.byId('save-edit').onclick = guarded(saveEdit);
    ui.byId('discard-draft').onclick = guarded(async () => {
      if (!state.composer) return;
      if (await ui.askConfirm({ title: '删除这份本机草稿？', body: '服务器作业和历史不会删除。', confirmLabel: '删除草稿', tone: 'danger' })) {
        drafts.remove(state.composer.id); update({ composer: null });
      }
    });
    ui.byId('composer-form').onsubmit = event => event.preventDefault();
    for (const id of ['f-subject', 'f-title', 'f-details', 'f-due-date', 'f-due-minute']) ui.byId(id).addEventListener('input', () => {
      try { persistComposer(); renderChecks(); }
      catch (error) { announce('stop', '本机保存失败', error.message); }
    });
    ui.byId('f-due-precision').onchange = () => {
      try { persistComposer(); renderComposer(); }
      catch (error) { announce('stop', '本机保存失败', error.message); }
    };
    ui.byId('logout').onclick = guarded(async () => { await academicClient.send('/api/auth/logout', { method: 'POST', body: {} }); location.reload(); });
    ui.byId('import-legacy').onclick = guarded(async () => {
      if (await ui.askConfirm({ title: '导入旧版本机草稿？', body: '请确认这些草稿属于你。导入后仍是本机草稿，旧数据会原样保留。', confirmLabel: '确认归属并导入' })) {
        ui.toast(`已导入 ${drafts.importLegacy()} 项本机草稿`);
      }
    });
    ui.byId('subject-suggestions').replaceChildren(...ui.SUBJECT_SUGGESTIONS.map(value => ui.el('option', { value })));
  }
  async function boot() {
    const identity = (await commands.identity()).data;
    if (!identity?.userId || !identity.instanceId) throw new Error('服务器身份格式无效。');
    if (!['teacher', 'admin'].includes(identity.role)) throw new ApiError({ status: 403, code: 'TEACHER_ONLY', message: '该账号没有教师工作台权限。请退出后使用教师账号。' });
    const scope = `${location.origin}/${identity.instanceId}/${identity.userId}`;
    drafts = createDraftStore({ scope });
    journal = createJournal({ storage: localStorage, scope, send: async (path, options) => {
      const response = await academicClient.send(path, options);
      validateAssignment(response.data?.assignment);
      return response;
    } });
    drafts.reconcileOnLoad();
    const { classes } = await academicClient.send('/api/classes');
    if (!Array.isArray(classes)) throw new Error('服务器班级列表格式无效。');
    const allowed = classes.filter(c => identity.authorizedClassIds.includes(c.id));
    update({ user: identity, classes: allowed, selectedClassId: allowed[0]?.id ?? '', offline: false,
      view: ['workspace', 'published', 'history'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'workspace' });
    wire(); renderClassSelector(); await refreshAssignments(); render();
    return { needsLogin: false, identity };
  }
  function offline() {
    drafts = createDraftStore({ scope: 'guest-local' }); journal = null;
    update({ offline: true, classes: [], assignments: [], selectedClassId: '', composer: null, view: 'workspace' });
    wire(); renderClassSelector(); render();
    announce('info', '离线整理模式', '这里的草稿仅保存在本机离线空间。登录后不会自动归入任何账号，也不会自动发布。');
  }
  return { boot, offline, render };
}

function minuteLocalValue(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function minuteIsoValue(local) {
  if (!local) return null;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

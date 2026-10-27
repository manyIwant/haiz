/**
 * View layer for the HAIZ Teacher workspace.
 *
 * Everything rendered here comes from one of two honest sources, and the teacher can always
 * tell which: server assignments carry a status chip and a version number; local drafts are
 * explicitly labelled "本机草稿" and are never styled as published.
 */

import { STATUS, describeDue, diffContent, validateDraft } from './api.js';
import { DRAFT_STATE } from './drafts.js';

export function byId(id) {
  return document.getElementById(id);
}

/** `el('p', {class: 'x', on: {click: fn}}, text, childEl)` — text is always escaped. */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (name === 'class') node.className = value;
    else if (name === 'dataset') Object.assign(node.dataset, value);
    else if (name === 'on') for (const [event, fn] of Object.entries(value)) node.addEventListener(event, fn);
    else if (name in node && name !== 'list' && name !== 'form') node[name] = value === true ? true : value;
    else node.setAttribute(name, value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const button = (label, on, cls = 'btn secondary', attrs = {}) =>
  el('button', { type: 'button', class: cls, on: { click: on }, ...attrs }, label);

const SUBJECT_SUGGESTIONS = ['数学', '语文', '英语', '物理', '化学', '生物', '历史', '地理', '政治', '信息技术', '综合', '其他'];

/** Select with real options; the teacher always chooses a class consciously. */
export function classSelect(classes, selectedId, onChange) {
  const select = el('select', {
    id: 'f-class', required: true,
    on: { change: () => onChange(select.value) },
  });
  select.append(el('option', { value: '', disabled: true, selected: !selectedId }, '选择班级'));
  for (const c of classes) {
    select.append(el('option', { value: c.id, selected: c.id === selectedId }, c.title));
  }
  return select;
}

export function statusChip(kind, label) {
  return el('span', { class: 'status', dataset: { state: kind } }, label);
}

function serverChip(assignment) {
  const map = {
    [STATUS.DRAFT]: '草稿 · 服务器',
    [STATUS.REVIEW]: '待发布 · 服务器',
    [STATUS.PUBLISHED]: '已发布',
    [STATUS.REVISED]: '已更新',
    [STATUS.RETRACTED]: '已撤回',
  };
  return statusChip(assignment.status, map[assignment.status] ?? assignment.status);
}

function draftChip(draft) {
  const map = {
    [DRAFT_STATE.LOCAL]: '本机草稿',
    [DRAFT_STATE.IN_REVIEW]: '本机 · 待确认',
    [DRAFT_STATE.SUBMITTING]: '提交中',
    [DRAFT_STATE.PUBLISHED]: '已发布',
    [DRAFT_STATE.UNKNOWN]: '结果未知',
  };
  return statusChip(draft.state, map[draft.state] ?? draft.state);
}

/* ─── Notices & toast ─────────────────────────────────────────────────── */

export function toast(message) {
  const host = byId('toast');
  host.textContent = message;
  host.dataset.show = 'true';
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { host.dataset.show = 'false'; }, 3200);
}

/** A durable notice. kind: ok | warn | stop | info. actions: [{label, on, cls}] */
export function notice(kind, title, message, actions = []) {
  return el('div', { class: 'notice', dataset: { tone: kind }, role: kind === 'stop' ? 'alert' : 'status' },
    el('div', { class: 'notice-body' },
      el('h3', {}, title),
      el('p', {}, message)),
    actions.length
      ? el('div', { class: 'notice-actions' }, actions.map(a => button(a.label, a.on, a.cls ?? 'btn quiet')))
      : null);
}

let confirmResolve = null;

/** Returns a Promise<boolean>; a real dialog, not window.confirm, so focus is managed. */
export function askConfirm({ title, body, confirmLabel = '确认', tone = 'sea' }) {
  const dialog = byId('confirm-dialog');
  byId('confirm-title').textContent = title;
  byId('confirm-body').replaceChildren(typeof body === 'string' ? document.createTextNode(body) : body);
  const confirmBtn = byId('confirm-yes');
  confirmBtn.textContent = confirmLabel;
  confirmBtn.className = tone === 'danger' ? 'btn danger' : tone === 'confirm' ? 'btn confirm' : 'btn';
  return new Promise(resolve => {
    confirmResolve = resolve;
    if (!dialog.open) dialog.showModal();
    byId('confirm-yes').focus();
  });
}

export function wireConfirmDialog() {
  const dialog = byId('confirm-dialog');
  byId('confirm-yes').addEventListener('click', () => { dialog.close('yes'); });
  byId('confirm-no').addEventListener('click', () => { dialog.close('no'); });
  dialog.addEventListener('close', () => {
    confirmResolve?.(dialog.returnValue === 'yes');
    confirmResolve = null;
  });
  dialog.addEventListener('cancel', () => { confirmResolve?.(false); confirmResolve = null; });
}

/* ─── Student-facing preview ──────────────────────────────────────────── */

/** What a student will actually see. Pure render of server-shaped content. */
export function studentPreview(assignment) {
  return el('div', { class: 'preview' },
    el('div', { class: 'preview-label' }, '学生看到的任务'),
    el('div', { class: 'student-subject' }, assignment.subject || '（科目）'),
    el('div', { class: 'student-title' }, assignment.title || '（标题）'),
    assignment.details ? el('div', { class: 'student-details' }, assignment.details) : null,
    el('div', { class: 'student-due' }, '截止时间 ', el('strong', {}, describeDue(assignment))));
}

/* ─── Review checklist ────────────────────────────────────────────────── */

export function reviewChecklist(draft) {
  const problems = validateDraft(draft);
  const ok = problems.length === 0;
  const items = [
    { label: '班级', ok: Boolean(draft.classId), value: draft.className || '未选择班级' },
    { label: '科目与标题', ok: Boolean(draft.subject?.trim() && draft.title?.trim()), value: `${draft.subject || '—'} · ${draft.title || '（无标题）'}` },
    { label: '截止时间', ok: true, value: describeDue(draft) },
    { label: '可以发布', ok, value: ok ? '内容完整，可以提交教师审核' : problems.join(' ') },
  ];
  return el('ul', { class: 'checklist' },
    items.map(item => el('li', { dataset: { ok: String(item.ok) } },
      el('span', { class: 'tick', 'aria-hidden': 'true' }, item.ok ? '✓' : '!'),
      el('div', {},
        el('div', { class: 'label' }, item.label),
        el('div', { class: 'value' }, item.value)))));
}

/* ─── Lists ───────────────────────────────────────────────────────────── */

function assignmentRow(a, { onOpen, onHistory, current }) {
  return el('button', {
    type: 'button', class: 'list-item',
    'aria-current': current ? 'true' : null,
    on: { click: () => onOpen(a) },
  },
    el('div', {},
      el('div', { class: 'item-subject' }, a.subject),
      el('div', { class: 'item-title' }, a.title),
      el('div', { class: 'item-meta' },
        el('span', {}, describeDue(a)),
        el('span', {}, `v${a.version}`))),
    el('div', { class: 'item-side' },
      serverChip(a),
      onHistory ? button('记录', e => { e.stopPropagation(); onHistory(a); }, 'btn quiet') : null));
}

export function publishedList(assignments, handlers) {
  const live = assignments.filter(a => [STATUS.PUBLISHED, STATUS.REVISED].includes(a.status));
  if (!live.length) {
    return el('div', { class: 'empty' },
      el('div', { class: 'title' }, '还没有正式发布的作业'),
      el('p', {}, '在「工作台」里整理一项作业，通过检查后正式发布，它会出现在这里。'));
  }
  return el('div', { class: 'list' }, live.map(a => assignmentRow(a, handlers)));
}

export function historyList(assignments, handlers) {
  const history = assignments.filter(a => [STATUS.RETRACTED, STATUS.DRAFT, STATUS.REVIEW].includes(a.status));
  if (!history.length) {
    return el('div', { class: 'empty' },
      el('div', { class: 'title' }, '暂无历史记录'),
      el('p', {}, '撤回的作业和服务器上的草稿会保留在这里，附带完整的版本历史。'));
  }
  return el('div', { class: 'list' }, history.map(a => assignmentRow(a, handlers)));
}

export function draftList(drafts, handlers) {
  const editable = drafts.filter(d => d.state !== DRAFT_STATE.PUBLISHED);
  if (!editable.length) return null;
  return el('div', { class: 'list' },
    editable.map(draft => el('button', {
      type: 'button', class: 'list-item',
      'aria-current': handlers.current === draft.id ? 'true' : null,
      on: { click: () => handlers.onOpen(draft) },
    },
      el('div', {},
        el('div', { class: 'item-subject' }, draft.subject || '未命名科目'),
        el('div', { class: 'item-title' }, draft.title || '（未命名草稿）'),
        el('div', { class: 'item-meta' },
          el('span', {}, draft.className || '未选择班级'),
          el('span', {}, describeDue(draft)))),
      el('div', { class: 'item-side' },
        draftChip(draft),
        draft.state === DRAFT_STATE.UNKNOWN && draft.publishedId
          ? button('核对结果', e => { e.stopPropagation(); handlers.onResolve(draft); }, 'btn quiet')
          : null))));
}

/* ─── Timeline (history detail) ───────────────────────────────────────── */

const OP_LABEL = {
  create: '创建草稿',
  'legacy.publish': '直接发布',
  review: '提交审核',
  publish: '正式发布',
  edit: '修改内容',
  retract: '撤回作业',
};

const FIELD_LABEL = { subject: '科目', title: '标题', details: '详细要求', due: '截止时间', duePrecision: '精度', status: '状态' };

export function timeline(revisions) {
  if (!revisions.length) {
    return el('div', { class: 'empty' }, el('p', {}, '没有版本记录。'));
  }
  return el('ol', { class: 'timeline' },
    [...revisions].reverse().map(r => el('li', {},
      el('div', { class: 'v' }, `v${r.version}`),
      el('div', {},
        el('div', { class: 'op' }, OP_LABEL[r.operation] ?? r.operation),
        el('div', { class: 'when' }, new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(r.occurredAt))),
        r.changedFields?.length
          ? el('div', { class: 'fields' }, `变更：${r.changedFields.map(f => FIELD_LABEL[f] ?? f).join('、')}`)
          : null))));
}

/* ─── Conflict diff ───────────────────────────────────────────────────── */

/** Shows the teacher exactly what they wrote beside what the server now holds. */
export function conflictDiff(draft, serverAssignment) {
  const changes = diffContent(draft, serverAssignment);
  if (!changes.length) {
    return el('p', {}, '两个版本的内容已一致，可以直接重新提交。');
  }
  return el('table', { class: 'diff' },
    el('thead', {}, el('tr', {},
      el('th', {}, '字段'),
      el('th', {}, '你修改的内容'),
      el('th', {}, '服务器上的最新内容'))),
    el('tbody', {}, changes.map(c => el('tr', {},
      el('th', { scope: 'row' }, c.label),
      el('td', { class: 'mine' }, c.mine),
      el('td', { class: 'theirs' }, c.theirs)))));
}

export { SUBJECT_SUGGESTIONS, serverChip, draftChip };

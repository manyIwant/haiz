import { SUBJECTS, schoolDate, cleanAssignment } from '../../public/haiz/world/homework-core.js';

export { SUBJECTS };
export const today = () => schoolDate();

const LIMIT = 500;
export const PUBLIC_BUNDLE_MAX_BYTES = 2 * 1024 * 1024;
function checkBundleSize(value) {
  if (new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value)).length > PUBLIC_BUNDLE_MAX_BYTES) {
    throw Error('公开任务包超过 2 MB，无法导入或导出。请下载完整本机备份保全数据，或分批转交公开内容。');
  }
}
const fail = message => { throw new Error(message); };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const stamp = () => new Date().toISOString();
const newId = () => globalThis.crypto?.randomUUID?.() ?? `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

function text(value, max, label, required = true) {
  if (typeof value !== 'string') fail(`${label}格式无效。`);
  const result = value.trim();
  if ((required && !result) || value.length > max) fail(`${label}须为${required ? ' 1–' : ' 0–'}${max} 字。`);
  return result;
}

function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) ||
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    fail('请选择有效的日历日期。');
  }
  return value;
}

function positiveVersion(value) {
  if (!Number.isSafeInteger(value) || value < 1) fail('公示版本须为正整数。');
  return value;
}

function taskFields(task) {
  const title = text(task.title, 400, '任务标题');
  if (!SUBJECTS.includes(task.subject)) fail('请选择有效学科。');
  date(task.date);
  if (typeof task.completed !== 'boolean') fail('任务完成状态格式无效。');
  if (!record(task.relay)) fail('接力记录格式无效。');
  if (task.sourceId !== undefined) text(task.sourceId, 164, '来源编号');
  if (task.sourceVersion !== undefined) positiveVersion(task.sourceVersion);
  return { ...task, title };
}

export function createTask({ title, subject = '其他', date: studyDate = today(), sourceId, sourceVersion } = {}) {
  return taskFields({
    id: newId(), title, subject, date: studyDate, completed: false,
    relay: { step: '', draft: '', next: '', focus: null }, updatedAt: stamp(),
    ...(sourceId === undefined ? {} : { sourceId }),
    ...(sourceVersion === undefined ? {} : { sourceVersion }),
  });
}

export function updateTask(task, patch) {
  if (!record(task) || !record(patch)) fail('任务或修改内容格式无效。');
  // A normal edit keeps identity, completion and the private relay object intact.
  const next = taskFields({ ...task, ...patch, id: task.id, updatedAt: stamp() });
  text(next.id, 80, '任务编号');
  return next;
}

export function toggleTask(task) {
  if (!record(task) || typeof task.completed !== 'boolean') fail('任务完成状态格式无效。');
  return updateTask(task, { completed: !task.completed });
}

function publicItem(raw, generateId = false) {
  if (!record(raw)) fail('公示作业格式无效。');
  const id = generateId && (raw.id === undefined || raw.id === '') ? newId() : text(raw.id, 80, '作业编号');
  // Reject overflow before calling the shared cleaner, which truncates some fields.
  text(raw.content, 400, '作业要求');
  date(raw.studyDate);
  const materials = raw.materials === undefined ? '' : raw.materials;
  const due = raw.due === undefined ? '' : raw.due;
  text(materials, 100, '材料说明', false);
  text(due, 100, '截止说明', false);
  const clean = cleanAssignment({ id, subject: raw.subject, content: raw.content, studyDate: raw.studyDate, due, materials });
  return { id: clean.id, subject: clean.subject, content: clean.content, studyDate: clean.studyDate, due: clean.due, materials: clean.materials };
}

function publicItems(items, generateIds = false) {
  if (!Array.isArray(items) || !items.length || items.length > LIMIT) fail(`公示须包含 1–${LIMIT} 条作业。`);
  const cleaned = items.map(item => publicItem(item, generateIds));
  if (new Set(cleaned.map(item => item.id)).size !== cleaned.length) fail('公示中存在重复作业编号。');
  return cleaned;
}

function snapshot(raw) {
  if (!record(raw)) fail('公示格式无效。');
  const id = text(raw.id, 80, '公示编号');
  const version = positiveVersion(raw.version);
  const scope = text(raw.scope, 60, '公开范围');
  const publishedAt = raw.publishedAt;
  if (typeof publishedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(publishedAt) ||
      !Number.isFinite(Date.parse(publishedAt)) || new Date(publishedAt).toISOString() !== publishedAt) {
    fail('公示时间须为有效的 ISO 日期时间。');
  }
  if (!['published', 'withdrawn'].includes(raw.status)) fail('公示状态无效。');
  return { id, version, scope, publishedAt, status: raw.status, items: publicItems(raw.items) };
}

export function publicProjection(publication) {
  const current = snapshot(publication);
  if (!Array.isArray(publication.history) || publication.history.length > LIMIT) fail('公示历史格式无效或超过上限。');
  const history = publication.history.map(snapshot).sort((a, b) => a.version - b.version);
  const versions = new Set();
  for (const previous of history) {
    if (previous.id !== current.id || previous.version >= current.version || versions.has(previous.version)) fail('公示历史编号或版本无效。');
    versions.add(previous.version);
  }
  // Construct every level explicitly: teacher sources, notes and student state never cross this boundary.
  return { ...current, history };
}

function publicationList(publications) {
  if (!Array.isArray(publications) || publications.length > LIMIT) fail(`公示列表须为数组，且不超过 ${LIMIT} 条。`);
  return publications.map(publicProjection);
}

function nextVersion(publication) {
  if (publication.version === Number.MAX_SAFE_INTEGER || publication.history.length >= LIMIT) fail('公示版本或历史已达上限，请新建公示。');
  return publication.version + 1;
}

export function publishDraft(draft, publications, confirmed) {
  if (confirmed !== true) fail('请明确确认公开范围和内容后再发布。');
  if (!record(draft)) fail('教师草稿格式无效。');
  const scope = text(draft.scope, 60, '公开范围');
  const items = publicItems(draft.items, true);
  const current = publicationList(publications);
  const revising = draft.publicationId !== undefined && draft.publicationId !== null && draft.publicationId !== '';
  const id = revising ? text(draft.publicationId, 80, '公示编号') : newId();
  const previous = current.find(publication => publication.id === id);
  if (revising && !previous) fail('找不到原公示，不能创建修订版本。');
  if (!previous && current.length >= LIMIT) fail('公示数量已达上限，请先导出备份。');
  const next = {
    id, version: previous ? nextVersion(previous) : 1, scope, publishedAt: stamp(), status: 'published', items,
    history: previous ? [...previous.history, snapshot(previous)] : [],
  };
  return previous ? current.map(publication => publication.id === id ? next : publication) : [next, ...current];
}

export function withdrawPublication(publications, id) {
  const current = publicationList(publications);
  const previous = current.find(publication => publication.id === id);
  if (!previous) fail('找不到要撤回的公示。');
  const next = {
    ...snapshot(previous), version: nextVersion(previous), status: 'withdrawn', publishedAt: stamp(),
    history: [...previous.history, snapshot(previous)],
  };
  return current.map(publication => publication.id === id ? next : publication);
}

export function exportPublicBundle(publications) {
  const bundle = { format: 'haiz-tools-public', version: 1, publications: publicationList(publications) };
  checkBundleSize(bundle);
  return bundle;
}

function mergePublication(left, right) {
  const versions = new Map();
  for (const entry of [...left.history, snapshot(left), ...right.history, snapshot(right)]) {
    const known = versions.get(entry.version);
    if (known && JSON.stringify(known) !== JSON.stringify(entry)) {
      fail(`公示「${entry.id}」第 ${entry.version} 版存在内容冲突；未导入，请保留备份并核对。`);
    }
    versions.set(entry.version, entry);
  }
  const latest = left.version >= right.version ? left : right;
  const history = [...versions.values()].filter(entry => entry.version < latest.version).sort((a, b) => a.version - b.version);
  if (history.length > LIMIT) fail('合并后的公示历史超过上限，未导入。');
  return { ...snapshot(latest), history };
}

export function importPublicBundle(raw, current) {
  checkBundleSize(raw);
  let bundle = raw;
  if (typeof raw === 'string') {
    try { bundle = JSON.parse(raw); } catch { fail('导入文件不是有效的 JSON，未修改现有公示。'); }
  }
  if (!record(bundle) || bundle.format !== 'haiz-tools-public' || bundle.version !== 1) fail('不支持的公示文件格式或版本。');
  // Validate the complete input before merging; errors never partially modify current.
  const incoming = publicationList(bundle.publications);
  const merged = new Map();
  for (const publication of [...publicationList(current), ...incoming]) {
    const previous = merged.get(publication.id);
    merged.set(publication.id, previous ? mergePublication(previous, publication) : publication);
  }
  if (merged.size > LIMIT) fail(`合并后的公示数量超过 ${LIMIT} 条，未导入。`);
  return [...merged.values()];
}

export function publicationText(publication) {
  const clean = publicProjection(publication);
  const heading = `HAIZ 作业公示 · ${clean.scope}\n第 ${clean.version} 版 · ${clean.status === 'withdrawn' ? '已撤回' : '已发布'}\n发布时间：${clean.publishedAt}`;
  if (clean.status === 'withdrawn') return `${heading}\n此公示已撤回，请勿作为当前作业。`;
  return `${heading}\n\n${clean.items.map((item, index) =>
    `${index + 1}. 【${item.subject}】${item.studyDate}\n${item.content}${item.due ? `\n截止：${item.due}` : ''}${item.materials ? `\n材料：${item.materials}` : ''}`
  ).join('\n\n')}`;
}

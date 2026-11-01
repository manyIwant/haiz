import { KEYS, loadRecord } from './storage.js';
import { updateTask, publicProjection } from './model.js';
import { cleanFocus } from '../../public/haiz/world/focus-core.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const string = (value, max) => typeof value === 'string' && value.length <= max;
const iso = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const fail = () => { throw Error('本机记录的内容格式无效。原始内容未覆盖，请先下载完整备份，再人工恢复。'); };
function items(value) {
  return Array.isArray(value) && value.length <= 500 && value.every(item => object(item) && string(item.id, 80) && string(item.subject, 20) && string(item.content, 30000) && string(item.studyDate, 10) && string(item.due, 100) && string(item.materials, 100) && (!item.warnings || Array.isArray(item.warnings) && item.warnings.every(w => string(w, 1000))));
}
export function validateValue(key, value) {
  if (key === KEYS.student) {
    if (!Array.isArray(value) || new Set(value.map(t => t?.id)).size !== value.length) fail();
    for (const task of value) {
      if (!object(task) || !string(task.id, 80) || !task.id || !iso(task.updatedAt) || !object(task.relay) || !string(task.relay.step, 500) || !string(task.relay.draft, 30000) || !string(task.relay.next, 1000) || task.relay.focus !== null && !cleanFocus(task.relay.focus)) fail();
      updateTask(task, {});
    }
  } else if (key === KEYS.teacher) {
    if (!object(value) || !string(value.scope, 60) || !string(value.source, 30000) || !items(value.items) || !['capture', 'edit', 'preview'].includes(value.stage) || value.publicationId !== null && !string(value.publicationId, 80) || new Set(value.items.map(item => item.id)).size !== value.items.length) fail();
  } else if (key === KEYS.publications) {
    if (!Array.isArray(value) || value.length > 500 || new Set(value.map(p => p?.id)).size !== value.length) fail();
    value.forEach(publicProjection);
  } else if (key === KEYS.preferences) {
    if (!object(value) || !['porcelain', 'obsidian', 'ocean'].includes(value.theme) || !['system', 'reduce', 'full'].includes(value.motion)) fail();
  }
  return value;
}
export function loadToolsRecord(key, fallback, storage) {
  const loaded = loadRecord(key, fallback, storage);
  try {
    if (!loaded.error) validateValue(key, loaded.value);
    return loaded;
  } catch {
    return { value: fallback, revision: loaded.revision, error: '本机记录内容无法安全读取，未覆盖原数据。请先下载备份，再恢复记录。' };
  }
}

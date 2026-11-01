export const KEYS = Object.freeze({
  student: 'haiz.tools.student.v1',
  teacher: 'haiz.tools.teacher.v1',
  publications: 'haiz.tools.publications.v1',
  preferences: 'haiz.tools.preferences.v1',
});

class RecordError extends Error {}

function validateEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) || !Object.hasOwn(envelope, 'schema')) {
    throw new RecordError('本地数据格式已损坏，未覆盖原记录；请先下载备份再恢复。');
  }
  if (envelope.schema !== 1) throw new RecordError('不支持此本地数据版本，未覆盖原记录；请先备份并使用兼容版本。');
  if (!Number.isSafeInteger(envelope.revision) || envelope.revision < 1 || !Object.hasOwn(envelope, 'value')) {
    throw new RecordError('本地数据格式或修订版本已损坏，未覆盖原记录；请先备份。');
  }
  return envelope;
}

function readEnvelope(key, storage) {
  const raw = storage.getItem(key);
  if (raw === null) return null;
  let envelope;
  try { envelope = JSON.parse(raw); } catch {
    throw new RecordError('本地数据 JSON 已损坏，未覆盖原记录；请先下载备份再恢复。');
  }
  return validateEnvelope(envelope);
}

function errorMessage(error, saving) {
  if (error instanceof RecordError) return error.message;
  if (error?.name === 'QuotaExceededError' || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED' || [22, 1014].includes(error?.code)) {
    return '本地存储空间不足，数据未保存；请先下载备份或释放空间。';
  }
  return saving
    ? '无法保存本地数据，可能未获存储权限或浏览器已禁用存储；当前内容未保存。'
    : '无法读取本地数据，可能未获存储权限或浏览器已禁用存储；未重置原记录。';
}

export function loadRecord(key, fallback, storage) {
  try {
    // Resolve inside try: even accessing localStorage can throw SecurityError.
    const envelope = readEnvelope(key, storage === undefined ? globalThis.localStorage : storage);
    return { value: envelope ? envelope.value : fallback, revision: envelope?.revision ?? 0, error: null };
  } catch (error) {
    return { value: fallback, revision: 0, error: errorMessage(error, false) };
  }
}

export function saveRecord(key, value, expectedRevision, storage) {
  let revision = 0;
  try {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      throw new RecordError('本地数据修订版本无效，请重新读取记录后重试。');
    }
    const target = storage === undefined ? globalThis.localStorage : storage;
    const previous = readEnvelope(key, target);
    revision = previous?.revision ?? 0;
    if (revision !== expectedRevision) {
      throw new RecordError('本地数据版本冲突，其他标签页可能已修改；未覆盖，请先备份当前内容再读取最新记录。');
    }
    if (revision === Number.MAX_SAFE_INTEGER) throw new RecordError('本地数据修订版本已达上限，未保存；请先备份。');
    let serialized;
    try {
      serialized = JSON.stringify({ schema: 1, revision: revision + 1, value });
      validateEnvelope(JSON.parse(serialized));
    } catch {
      throw new RecordError('当前内容无法转换为有效的 JSON 记录，未保存；请检查数据格式。');
    }
    target.setItem(key, serialized);
    return { revision: revision + 1, error: null };
  } catch (error) {
    return { revision, error: errorMessage(error, true) };
  }
}

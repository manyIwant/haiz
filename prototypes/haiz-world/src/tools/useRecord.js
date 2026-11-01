import { useCallback, useEffect, useRef, useState } from 'react';
import { saveRecord } from './storage.js';
import { loadToolsRecord } from './validate.js';

export function useRecord(key, fallback, retainOnFailure = true) {
  const initial = useRef(null);
  if (!initial.current) initial.current = loadToolsRecord(key, fallback);
  const current = useRef(initial.current);
  const [record, setRecord] = useState(initial.current);
  const blocked = useRef(Boolean(initial.current.error));
  const replace = useCallback(next => {
    current.current = next;
    setRecord(next);
  }, []);
  const update = useCallback(change => {
    const value = typeof change === 'function' ? change(current.current.value) : change;
    if (value === current.current.value && !current.current.error) return true;
    if (blocked.current) {
      replace({ ...current.current, ...(retainOnFailure ? { value } : {}) });
      return false;
    }
    const result = saveRecord(key, value, current.current.revision);
    if (result.error && /其他|冲突|版本|损坏|格式/.test(result.error)) blocked.current = true;
    replace({ value: result.error && !retainOnFailure ? current.current.value : value, revision: result.error ? current.current.revision : result.revision, error: result.error });
    return !result.error;
  }, [key, replace, retainOnFailure]);
  const reload = useCallback(() => {
    const next = loadToolsRecord(key, fallback);
    blocked.current = Boolean(next.error);
    replace(next);
  }, [key, fallback, replace]);
  useEffect(() => {
    const onStorage = event => {
      if (event.key !== key && event.key !== null) return;
      blocked.current = true;
      replace({ ...current.current, error: '另一标签页修改了此记录。当前内容已保留在内存中，请先下载备份，再读取最新记录。' });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key, replace]);
  return { ...record, update, reload, retry: () => update(current.current.value) };
}

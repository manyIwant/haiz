/**
 * Local Draft store — the offline half of the workspace.
 *
 * A draft lives only in this browser. It is never called "published", never rendered as a
 * class task, and never claims a student has received anything. The moment a teacher publishes,
 * the authoritative copy is the Academic server's assignment; the local draft keeps a pointer
 * (`publishedId`) so the workspace can say "this draft is now assignment X, version N".
 */

const LEGACY_STORAGE_KEY = 'haiz.teacher.v1.drafts';
const KEYS_STORAGE = 'haiz.teacher.v2.idempotency';
const MAX_DRAFTS = 100;

/** Draft lifecycle as the teacher experiences it, distinct from the server's own states. */
export const DRAFT_STATE = Object.freeze({
  LOCAL: 'local',           // only in this browser
  IN_REVIEW: 'in_review',   // teacher is checking it, still only local
  SUBMITTING: 'submitting', // a publish request is in flight; outcome not yet known
  PUBLISHED: 'published',   // server confirmed: this is a real assignment
  UNKNOWN: 'unknown',       // request timed out; server state must be re-checked
});

/**
 * Shape kept for one draft. `publishedId`/`publishedVersion` are set only from a server
 * response — never optimistically.
 *
 * @typedef {Object} Draft
 * @property {string} id                 client UUID
 * @property {string} classId            target class (server UUID)
 * @property {string} className          cached display name
 * @property {string} subject
 * @property {string} title
 * @property {string} details
 * @property {string|null} due
 * @property {string} duePrecision       none | date | minute
 * @property {string} state              one of DRAFT_STATE
 * @property {string|null} publishedId
 * @property {number|null} publishedVersion
 * @property {string} updatedAt          ISO timestamp
 */

function newId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isDraft(value) {
  return Boolean(value) && typeof value === 'object'
    && typeof value.id === 'string'
    && typeof value.subject === 'string'
    && typeof value.title === 'string'
    && Object.values(DRAFT_STATE).includes(value.state);
}

/**
 * @param {{storage?:Storage, now?:()=>Date, idFactory?:()=>string, scope?:string}} options
 */
export function createDraftStore(options = {}) {
  const storage = options.storage ?? globalThis.localStorage;
  const now = options.now ?? (() => new Date());
  const idFactory = options.idFactory ?? newId;
  const scope = options.scope ?? 'local';
  const storageKey = `haiz.teacher.v3.drafts/${scope}`;

  function readAll() {
    const raw = storage.getItem(storageKey);
    if (raw === null || raw === undefined) return [];
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (cause) {
      throw new Error('草稿数据无法读取或已损坏，请保留本机数据并联系管理员。', { cause });
    }
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isDraft).slice(0, MAX_DRAFTS);
  }

  function writeAll(drafts) {
    const trimmed = drafts.slice(0, MAX_DRAFTS);
    try {
      storage.setItem(storageKey, JSON.stringify(trimmed));
    } catch (cause) {
      throw new Error('无法保存草稿，请释放存储空间后重试。', { cause });
    }
    return trimmed;
  }

  const store = {
    all: readAll,

    get(id) {
      return readAll().find(draft => draft.id === id) ?? null;
    },

    /** Inserts or replaces one draft. Returns the new list. */
    save(draft) {
      const drafts = readAll();
      const stamped = { ...draft, updatedAt: now().toISOString() };
      const index = drafts.findIndex(item => item.id === stamped.id);
      const next = index === -1
        ? [stamped, ...drafts]
        : drafts.map((item, position) => (position === index ? stamped : item));
      return writeAll(next);
    },

    create(fields = {}) {
      const existing = readAll();
      if (existing.length >= MAX_DRAFTS) {
        throw new Error('草稿数量已达上限（100 项），请整理后再建新草稿。');
      }
      const draft = {
        id: idFactory(),
        classId: '',
        className: '',
        subject: '',
        title: '',
        details: '',
        due: null,
        duePrecision: 'none',
        state: DRAFT_STATE.LOCAL,
        publishedId: null,
        publishedVersion: null,
        updatedAt: now().toISOString(),
        ...fields,
      };
      store.save(draft);
      return draft;
    },

    remove(id) {
      return writeAll(readAll().filter(draft => draft.id !== id));
    },

    /**
     * Moves drafts that were mid-flight when the page died into UNKNOWN. They are never shown as
     * published — only a server answer can do that.
     */
    reconcileOnLoad() {
      const drafts = readAll();
      let changed = false;
      const next = drafts.map(draft => {
        if (draft.state !== DRAFT_STATE.SUBMITTING) return draft;
        changed = true;
        return { ...draft, state: DRAFT_STATE.UNKNOWN, updatedAt: now().toISOString() };
      });
      return changed ? writeAll(next) : drafts;
    },

    /** Drafts the published view must ignore: anything not confirmed by the server. */
    localOnly() {
      return readAll().filter(draft => draft.state !== DRAFT_STATE.PUBLISHED);
    },

    hasLegacy() {
      try {
        const raw = storage.getItem(LEGACY_STORAGE_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.length > 0;
      } catch {
        return false;
      }
    },

    importLegacy() {
      try {
        const raw = storage.getItem(LEGACY_STORAGE_KEY);
        if (!raw) return 0;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return 0;
        const current = readAll();
        let imported = 0;
        for (const item of parsed) {
          if (!item || typeof item !== 'object') continue;
          const subject = typeof item.subject === 'string' ? item.subject.trim() : '';
          const title = typeof item.title === 'string' ? item.title.trim() : '';
          if (!subject || !title) continue;
          const due = typeof item.due === 'string' && item.due ? item.due : null;
          const exists = current.some(d => d.subject === subject && d.title === title);
          if (!exists) {
            store.create({
              subject,
              title,
              due,
              duePrecision: due ? 'date' : 'none',
              state: DRAFT_STATE.LOCAL,
            });
            imported++;
          }
        }
        return imported;
      } catch {
        return 0;
      }
    },
  };

  return store;
}

/**
 * Idempotency keys survive a reload so a teacher who retries after a crash replays the original
 * command rather than creating a duplicate. They are non-secret and grant nothing on their own.
 */
export function createKeyStore(storage = globalThis.sessionStorage) {
  return {
    load() {
      try {
        const parsed = JSON.parse(storage.getItem(KEYS_STORAGE) ?? '{}');
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch {
        return {};
      }
    },
    save(entries) {
      try {
        storage.setItem(KEYS_STORAGE, JSON.stringify(entries));
      } catch {
        // Storage unavailable: keys stay in memory for this page. Retrying still works until reload.
      }
    },
  };
}

/**
 * HAIZ Native · local identity database.
 *
 * One SQLite schema, two engines: on Android the system SQLite through the HaizStore plugin (the
 * database file lives in the app's private data directory and survives in-place updates); in the
 * browser the same SQL runs on sql.js and the database image is kept in IndexedDB. Nothing leaves
 * the device.
 */
import { isNative, HaizStore } from "../platform/native";

export type Row = Record<string, any>;
export type Stmt = { sql: string; params?: unknown[] };
interface Engine { run(stmts: Stmt[]): Promise<void>; query(sql: string, params?: unknown[]): Promise<Row[]> }

export const SCHEMA: Stmt[] = [
  { sql: `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)` },
  { sql: `CREATE TABLE IF NOT EXISTS identities (
      id TEXT PRIMARY KEY, school TEXT NOT NULL, name TEXT NOT NULL, cls TEXT NOT NULL DEFAULT '', no TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'student', lamp TEXT NOT NULL DEFAULT 'amber', seq INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, last_used_at INTEGER NOT NULL DEFAULT 0)` },
  { sql: `CREATE TABLE IF NOT EXISTS records (
      identity_id TEXT NOT NULL REFERENCES identities(id) ON DELETE CASCADE, kind TEXT NOT NULL, json TEXT NOT NULL,
      updated_at INTEGER NOT NULL, PRIMARY KEY (identity_id, kind))` },
  { sql: `INSERT OR IGNORE INTO meta (key, value) VALUES ('schema', '1')` },
];

/* ---------------- Android: system SQLite ---------------- */
const nativeEngine: Engine = {
  run: (statements) => HaizStore.run({ statements }),
  query: async (sql, params = []) => (await HaizStore.query({ sql, params })).rows,
};

/* ---------------- browser: sql.js + IndexedDB ---------------- */
const IDB = "haiz-native", IDB_STORE = "db", IDB_KEY = "identities.sqlite";
function idb<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return new Promise((res, rej) => {
    const o = indexedDB.open(IDB, 1);
    o.onupgradeneeded = () => o.result.createObjectStore(IDB_STORE);
    o.onerror = () => rej(o.error);
    o.onsuccess = () => {
      const t = o.result.transaction(IDB_STORE, mode);
      const r = f(t.objectStore(IDB_STORE));
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    };
  });
}
async function webEngine(): Promise<Engine> {
  const [{ default: init }, wasm] = await Promise.all([import("sql.js"), import("sql.js/dist/sql-wasm.wasm?url")]);
  const SQL = await init({ locateFile: () => wasm.default });
  let image: Uint8Array | undefined;
  try { image = (await idb<Uint8Array>("readonly", (s) => s.get(IDB_KEY))) ?? undefined; } catch { /* private mode: memory only */ }
  const db = new SQL.Database(image);
  db.run("PRAGMA foreign_keys = ON");
  let saveT = 0;
  const persist = () => { clearTimeout(saveT); saveT = window.setTimeout(() => { idb("readwrite", (s) => s.put(db.export(), IDB_KEY)).catch(() => {}); }, 120); };
  return {
    async run(stmts) {
      db.run("BEGIN");
      try { for (const s of stmts) db.run(s.sql, (s.params ?? []) as any); db.run("COMMIT"); }
      catch (e) { db.run("ROLLBACK"); throw e; }
      persist();
    },
    async query(sql, params = []) {
      const st = db.prepare(sql); st.bind(params as any);
      const rows: Row[] = [];
      while (st.step()) rows.push(st.getAsObject());
      st.free();
      return rows;
    },
  };
}

let engine: Promise<Engine> | null = null;
export function db(): Promise<Engine> {
  return (engine ??= (async () => {
    const e = isNative() ? nativeEngine : await webEngine();
    await e.run(SCHEMA);
    return e;
  })());
}

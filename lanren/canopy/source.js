// Where chapter 03's works come from, said honestly.
//
// public works   There is no public works service yet (no submissions, no review, no
//                publication endpoint). The production canopy therefore shows an empty,
//                truthful tree. Development samples load only on request: ?works=demo, or
//                a preview session that asked for them; every one is labelled as a sample.
// private drafts The author's own drafts. With a signed-in HAIZ account (same-origin
//                backend, backend/README.md) they are saved to the account's private
//                `works` collection — owner-only, versioned, with history and trash — the
//                one real link of the lifecycle this round. Without an account they stay
//                in this browser and the interface says so.
// Nothing here can publish, approve or make anything visible to anyone else.

const DEMO_URL = new URL('./demo/works.json', import.meta.url).href;
const LOCAL_DRAFTS = 'haiz.canopy.drafts.v1';
const DEMO_FLAG = 'haiz.canopy.demo';

export function wantsDemo(search = location.search) {
  const q = new URLSearchParams(search).get('works');
  try {
    if (q === 'demo') sessionStorage.setItem(DEMO_FLAG, '1');
    if (q === 'none') sessionStorage.removeItem(DEMO_FLAG);
    return q === 'demo' || (q !== 'none' && sessionStorage.getItem(DEMO_FLAG) === '1');
  } catch { return q === 'demo'; }
}

/** { status: 'demo' | 'none', works, notice } — never throws. */
export async function loadWorks({ demo = wantsDemo() } = {}) {
  if (!demo) {
    return { status: 'none', works: [], notice: '作品树冠还没有接入投稿与审核服务，所以树上还没有公开作品。等第一批同学自愿公开的作品通过审核，它们会出现在这里。' };
  }
  try {
    const r = await fetch(DEMO_URL);
    if (!r.ok) throw new Error('demo ' + r.status);
    const j = await r.json();
    return { status: 'demo', works: (j.works || []).map((w) => ({ ...w, demo: true })), notice: j.notice, asset: j.asset, fingerprint: j.slotFingerprint };
  } catch (err) {
    console.warn('canopy demo works unavailable', err);
    return { status: 'none', works: [], notice: '演示作品没有加载成功。' };
  }
}

// ------------------------------------------------------------------ private drafts
let accountProbe = null;
/** Is a HAIZ account signed in on this origin? { signedIn, user, reason } — never throws. */
export function account() {
  if (accountProbe) return accountProbe;
  accountProbe = (async () => {
    try {
      const r = await fetch('/api/v1/auth/me', { credentials: 'same-origin', headers: { accept: 'application/json' } });
      if (r.status === 404) return { signedIn: false, reason: 'no-backend' };
      if (!r.ok) return { signedIn: false, reason: 'signed-out' };
      const j = await r.json();
      const user = j.identity || j.user;   // backend/server.mjs: { identity, authenticated }
      return user && user.id ? { signedIn: true, user } : { signedIn: false, reason: 'signed-out' };
    } catch { return { signedIn: false, reason: 'no-backend' }; }
  })();
  return accountProbe;
}

const draftId = () => 'd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

function readLocal() { try { return JSON.parse(localStorage.getItem(LOCAL_DRAFTS) || '[]'); } catch { return []; } }
function writeLocal(list) { try { localStorage.setItem(LOCAL_DRAFTS, JSON.stringify(list)); return true; } catch { return false; } }

async function api(method, url, body, userId) {
  const r = await fetch(url, {
    method, credentials: 'same-origin',
    headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}), ...(userId ? { 'x-haiz-user': userId } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || ('HTTP ' + r.status)); e.status = r.status; e.body = j; throw e; }
  return j;
}

/** Drafts: on the account when signed in, otherwise on this device. */
export const drafts = {
  async where() { const a = await account(); return a.signedIn ? 'account' : 'device'; },
  async list() {
    const a = await account();
    if (!a.signedIn) return readLocal().map((d) => ({ ...d, where: 'device' }));
    const j = await api('GET', '/api/v1/data/works?limit=100', null, a.user.id);
    return (j.items || []).map((it) => ({ ...it.data, id: it.id, revision: it.revision, where: 'account' }));
  },
  async save(d) {
    const a = await account();
    const now = new Date().toISOString();
    const rec = { title: d.title, kind: d.kind, direction: d.direction, body: d.body || '', state: 'draft', updated: now };
    if (!a.signedIn) {
      const list = readLocal();
      const id = d.id || draftId();
      const i = list.findIndex((x) => x.id === id);
      const item = { ...rec, id };
      if (i >= 0) list[i] = item; else list.unshift(item);
      if (!writeLocal(list)) throw new Error('这台设备的浏览器不允许保存');
      return { ...item, where: 'device' };
    }
    const id = d.id || draftId();
    const j = await api('PUT', `/api/v1/data/works/${encodeURIComponent(id)}`, { expectedRevision: d.revision ?? 0, data: rec }, a.user.id);
    return { ...rec, id, revision: j.item?.revision, where: 'account' };
  },
  async remove(d) {
    const a = await account();
    if (!a.signedIn || d.where === 'device') { writeLocal(readLocal().filter((x) => x.id !== d.id)); return true; }
    await api('DELETE', `/api/v1/data/works/${encodeURIComponent(d.id)}`, { expectedRevision: d.revision }, a.user.id);
    return true;
  }
};

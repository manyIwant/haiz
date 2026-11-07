// The works of chapter 03: what a work is, who may see it, and how it is found.
//
// Lifecycle (DESIGN.md §3, confirmed): a private draft becomes public only by the
// author's own choice after it has passed review. Review never publishes anything.
//
//   draft ──submit──▶ submitted ──approve──▶ approved ──author publishes──▶ public
//     ▲                  │ └──request changes──▶ draft            │
//     └──────────────────┘                                withdraw │ ▲ republish
//                                                                  ▼ │
//                                                              withdrawn
//   public ──report upheld (moderation)──▶ hidden ──resolved──▶ public | withdrawn
//
// Only `public` works are on the tree for everyone. A withdrawn or hidden work keeps its
// leaf address reserved (address.js) but its public path answers "not public".
// Kinds: 'work' (finished, to enjoy) and 'project' (in progress, may seek collaborators).
// Pure (Node-testable). The server enforces all of this; the client only mirrors it.

export const STATES = ['draft', 'submitted', 'approved', 'public', 'withdrawn', 'hidden'];

/** Allowed transitions and who may make them. */
export const TRANSITIONS = {
  submit: { from: ['draft'], to: 'submitted', by: 'author' },
  unsubmit: { from: ['submitted'], to: 'draft', by: 'author' },
  requestChanges: { from: ['submitted'], to: 'draft', by: 'reviewer' },
  approve: { from: ['submitted'], to: 'approved', by: 'reviewer' },
  publish: { from: ['approved', 'withdrawn'], to: 'public', by: 'author' },
  withdraw: { from: ['public', 'approved'], to: 'withdrawn', by: 'author' },
  hide: { from: ['public'], to: 'hidden', by: 'moderator' },
  restore: { from: ['hidden'], to: 'public', by: 'moderator' }
};

export function canTransition(work, action, actor) {
  const t = TRANSITIONS[action];
  if (!t || !t.from.includes(work.state)) return false;
  if (t.by === 'author') return isOwner(work, actor);
  if (t.by === 'reviewer') return !!actor && (actor.role === 'editor' || actor.role === 'admin') && !isOwner(work, actor);
  if (t.by === 'moderator') return !!actor && (actor.role === 'moderator' || actor.role === 'admin');
  return false;
}

const isOwner = (w, a) => !!a && !!a.id && w.owner === a.id;
const isAcceptedContributor = (w, a) => !!a && !!a.id && (w.contributors || []).some((c) => c.account === a.id && c.accepted === true);

/**
 * Who may read a work. Everyone: public works. The owner: everything of theirs.
 * Accepted co-creators: the shared work in any state except hidden-by-moderation details.
 * Reviewers: only what was submitted to them (never a private draft).
 */
export function canView(work, viewer) {
  if (!work) return false;
  if (work.state === 'public') return true;
  if (isOwner(work, viewer)) return true;
  if (work.state !== 'draft' && isAcceptedContributor(work, viewer)) return true;
  if (viewer && (viewer.role === 'editor' || viewer.role === 'admin') && (work.state === 'submitted' || work.state === 'approved')) return true;
  return false;
}

/** The public projection: what anyone may receive about a work (no private fields). */
export function publicView(work) {
  if (!work || work.state !== 'public') return null;
  const { owner, reviewNotes, history, reports, ...rest } = work;   // eslint-disable-line no-unused-vars
  return { ...rest, contributors: (work.contributors || []).filter((c) => c.accepted !== false).map(({ account, ...c }) => c) };   // eslint-disable-line no-unused-vars
}

// ------------------------------------------------------------------ finding works
export const LENSES = [
  { id: 'all', zh: '全部', en: 'All' },
  { id: 'picks', zh: '本期向阳', en: 'Into the sun', note: '编辑精选，按期轮换' },
  { id: 'recommended', zh: '同学推荐', en: 'Recommended', note: '附推荐理由，不按票数排名' },
  { id: 'new', zh: '初生新叶', en: 'New leaves', note: '新公开的作品，每天轮换顺序' },
  { id: 'linked', zh: '枝叶相连', en: 'Grown together', note: '合作与创作接力' }
];

const day = (iso) => Math.floor(Date.parse(iso) / 86400000);
function hash32(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }

export function currentIssue(works) {
  let n = 0;
  for (const w of works) for (const p of w.picks || []) n = Math.max(n, p.issue);
  return n;
}

/**
 * Works to show under a lens, in order. Popularity never orders anything:
 * picks by the editors' issue, recommendations by when they were written,
 * new leaves by a daily rotation so the newest are not always the same few.
 */
export function lens(works, id, { today = new Date().toISOString().slice(0, 10), newDays = 45 } = {}) {
  const pub = works.filter((w) => w.state === 'public');
  switch (id) {
    case 'picks': {
      const n = currentIssue(pub);
      return pub.filter((w) => (w.picks || []).some((p) => p.issue === n));
    }
    case 'recommended':
      return pub.filter((w) => (w.recommendations || []).some((r) => r.reason && r.reason.trim()))
        .sort((a, b) => latest(b.recommendations) - latest(a.recommendations));
    case 'new': {
      const t = day(today);
      return pub.filter((w) => w.published && t - day(w.published) <= newDays && t - day(w.published) >= 0)
        .sort((a, b) => hash32(a.id + ':' + t) - hash32(b.id + ':' + t));
    }
    case 'linked':
      return pub.filter((w) => (w.relations || []).length || (w.contributors || []).length > 1);
    default:
      return pub;
  }
}
const latest = (rs) => Math.max(0, ...(rs || []).map((r) => Date.parse(r.at || 0) || 0));

/** Relations both ways: what this work grew from, and what grew from it. */
export function related(works, id) {
  const by = new Map(works.map((w) => [w.id, w]));
  const w = by.get(id);
  if (!w) return [];
  const out = [];
  for (const r of w.relations || []) if (by.has(r.work)) out.push({ dir: 'from', type: r.type, note: r.note, work: by.get(r.work) });
  for (const o of works) for (const r of o.relations || []) if (r.work === id) out.push({ dir: 'to', type: r.type, note: r.note, work: o });
  return out;
}

/** The whole relay a work belongs to, ordered from its first source to its latest growth. */
export function chain(works, id) {
  const by = new Map(works.map((w) => [w.id, w]));
  const seen = new Set();
  const up = (x) => { const r = (by.get(x)?.relations || []).find((q) => by.has(q.work)); return r ? r.work : null; };
  let root = id;
  for (let k = 0; k < 32 && up(root) && !seen.has(up(root)); k++) { seen.add(root); root = up(root); }
  const order = [];
  const walk = (x) => { if (order.includes(x)) return; order.push(x); for (const o of works) if ((o.relations || []).some((r) => r.work === x)) walk(o.id); };
  walk(root);
  return order.map((x) => by.get(x)).filter(Boolean);
}

export const RELATION_WORDS = {
  'responds-to': ['回应自', '被回应'],
  'derived-from': ['衍生自', '衍生出'],
  'part-of': ['属于项目', '包含成果'],
  'grew-from': ['由此项目长成', '长成作品']
};

export const KIND_WORDS = { work: '完成作品', project: '进行中的共创项目' };

/** Validate a draft before it is saved (client-side mirror of the server's rules). */
export function validateDraft(d) {
  const errs = [];
  if (!d || typeof d !== 'object') return ['草稿无效'];
  if (!d.title || !String(d.title).trim()) errs.push('请写一个标题');
  if (String(d.title || '').length > 80) errs.push('标题最长 80 字');
  if (String(d.body || '').length > 12000) errs.push('正文最长 12000 字');
  if (!['work', 'project'].includes(d.kind)) errs.push('请选择：完成作品或共创项目');
  return errs;
}

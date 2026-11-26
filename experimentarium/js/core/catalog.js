// HAIZ · EXPERIMENTARIUM — 课程矩阵加载与按需分包动态导入
let _matrix = null;
const _packCache = new Map();
const _expRegistry = new Map();

export async function loadCurriculumMatrix() {
  if (_matrix) return _matrix;
  const res = await fetch(new URL('../../data/curriculum-matrix.json', import.meta.url));
  if (!res.ok) throw new Error(`无法加载课程覆盖矩阵: HTTP ${res.status}`);
  _matrix = await res.json();
  return _matrix;
}

export async function loadDomainPack(packName) {
  if (!packName) return [];
  if (_packCache.has(packName)) return _packCache.get(packName);
  const p = import(`../domains/${packName}.js`).then((mod) => {
    const list = mod.default || Object.values(mod);
    for (const exp of list) {
      if (exp && exp.id) _expRegistry.set(exp.id, exp);
    }
    return list;
  });
  _packCache.set(packName, p);
  return p;
}

export async function getExperimentByMeta(meta) {
  if (_expRegistry.has(meta.id)) return _expRegistry.get(meta.id);
  if (!meta.implementation?.domainPack) return null;
  await loadDomainPack(meta.implementation.domainPack);
  return _expRegistry.get(meta.id) || null;
}

export function buildCatalog(matrix) {
  const subjects = Object.fromEntries(matrix.subjects.map((s) => [s.id, s]));
  const subjOrder = matrix.subjects.map((s) => s.id);
  const allItems = [...matrix.items].sort(
    (a, b) => subjOrder.indexOf(a.subject) - subjOrder.indexOf(b.subject) || (a.order ?? 50) - (b.order ?? 50)
  );
  const completed = allItems.filter((x) => x.implementation.status === 'completed');
  const count = {};
  completed.forEach((item, idx) => {
    count[item.subject] = (count[item.subject] || 0) + 1;
    item.no = count[item.subject];
    item.pageNo = idx * 2 + 2;
  });
  return { subjects, allItems, completed, stats: matrix.stats, editionPolicy: matrix.editionPolicy };
}

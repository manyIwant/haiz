// The campus as the audit sees it: every feature as a footprint in campus metres,
// with the role that decides which checks apply to it.
import { rectToFootprint } from './geom.mjs';

export const SOLID = new Set(['academic', 'lab', 'library', 'canteen', 'living', 'art', 'office', 'gate']);
export const COVER = new Set(['corr', 'pavilion']);
export const GROUND = new Set(['garden', 'botanic', 'field', 'pond', 'oldtree', 'rock']);
/** Wings drawn separately but forming one building (lanren/map/geo.js GROUPS). */
export const GROUPS = { dorm_m_n: 'dorm_m', dorm_m_m: 'dorm_m', dorm_m_s: 'dorm_m' };

export function roleOf(b) {
  if (SOLID.has(b.form)) return 'solid';
  if (COVER.has(b.form)) return 'cover';
  if (GROUND.has(b.form)) return 'ground';
  return 'other';
}

export function features(campus) {
  const tf = campus.meta.transform;
  const out = [];
  for (const b of campus.buildings) out.push({ id: b.id, name: b.name, kind: 'building', form: b.form, role: roleOf(b), src: b, fp: rectToFootprint(b.rect, tf, b.rot || 0) });
  for (const r of campus.roads || []) out.push({ id: r.id, kind: 'road', role: 'road', src: r, fp: rectToFootprint(r.rect, tf) });
  for (const l of campus.lawns || []) out.push({ id: l.id, kind: 'lawn', role: 'ground', src: l, fp: rectToFootprint(l.rect, tf) });
  for (const w of campus.water || []) out.push({ id: w.id, kind: 'water', role: 'water', src: w, fp: rectToFootprint(w.rect, tf) });
  return out;
}

export const planToCampus = (p, tf) => ({ x: (p[0] - tf.originPx[0]) * tf.scale, z: -(p[1] - tf.originPx[1]) * tf.scale });

/** The life/walk world frame puts the 百年榄仁树 footprint centre at the origin (lanren/map/geo.js, rotation 0). */
export function worldPivot(campus) {
  const t = campus.buildings.find((b) => b.id === 'lanshu');
  const f = rectToFootprint(t.rect, campus.meta.transform);
  return { x: f.cx, z: f.cz };
}

export const finding = (check, severity, subject, message, data) => ({ check, severity, subject, message, ...(data ? { data } : {}) });

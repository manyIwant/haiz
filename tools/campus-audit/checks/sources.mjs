// Do all the copies of the campus agree with each other?
import { rectToFootprint } from '../lib/geom.mjs';
import { finding } from '../lib/model.mjs';

const C = 'sources';
const same = (a, b, eps = 1e-6) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= eps);

function compareCopies(name, a, b, out) {
  const ia = new Map(a.buildings.map((x) => [x.id, x])), ib = new Map(b.buildings.map((x) => [x.id, x]));
  const only = [...ia.keys()].filter((k) => !ib.has(k)).concat([...ib.keys()].filter((k) => !ia.has(k)));
  if (only.length) out.push(finding(C, 'error', name, `buildings present in only one copy: ${only.join(', ')}`));
  let diff = 0;
  for (const [id, x] of ia) {
    const y = ib.get(id);
    if (!y) continue;
    if (!same(x.rect, y.rect) || (x.rot || 0) !== (y.rot || 0) || !same(x.size, y.size)) {
      diff++; out.push(finding(C, 'error', `${name}:${id}`, 'footprint, rotation or size differs between copies', { a: [x.rect, x.rot, x.size], b: [y.rect, y.rot, y.size] }));
    }
  }
  for (const k of ['roads', 'lawns', 'water', 'fields']) {
    const ka = JSON.stringify((a[k] || []).map((r) => [r.id, r.rect])), kb = JSON.stringify((b[k] || []).map((r) => [r.id, r.rect]));
    if (ka !== kb) { diff++; out.push(finding(C, 'error', `${name}:${k}`, `${k} differ between copies`)); }
  }
  if (!same(a.meta.transform.originPx, b.meta.transform.originPx) || a.meta.transform.scale !== b.meta.transform.scale) {
    diff++; out.push(finding(C, 'error', name, 'plan → campus transform differs between copies'));
  }
  const ta = JSON.stringify(a.trees), tb = JSON.stringify(b.trees);
  if (ta !== tb) out.push(finding(C, 'warn', `${name}:trees`, 'tree points differ between copies'));
  return diff;
}

export function run(S) {
  const out = [];
  const c = S.campus, tf = c.meta.transform;
  let copies = 0;
  if (S.campusJs) { copies++; if (!compareCopies('campus-data.js vs campus.json', S.campusJs, c, out)) out.push(finding(C, 'pass', 'campus-data.js', 'generated file:// copy matches campus.json (buildings, roads, lawns, water, fields, transform)')); }
  if (S.buildings) { copies++; if (!compareCopies('data/buildings.json vs campus.json', S.buildings, c, out)) out.push(finding(C, 'pass', 'data/buildings.json', 'older copy matches campus.json geometry')); }

  // derived fields stored beside the rect must agree with it
  let bad = 0;
  for (const b of c.buildings) {
    const f = rectToFootprint(b.rect, tf, b.rot || 0);
    const w = 2 * f.hw, d = 2 * f.hd;
    const issues = [];
    if (b.size && (Math.abs(b.size[0] - w) > 0.15 || Math.abs(b.size[2] - d) > 0.15)) issues.push(`size ${b.size[0]}×${b.size[2]} vs rect ${w.toFixed(1)}×${d.toFixed(1)}`);
    if (b._u != null && (Math.abs(b._u - f.cx) > 0.15 || Math.abs(b._v - -f.cz) > 0.15)) issues.push(`_u/_v ${b._u},${b._v} vs rect centre ${f.cx.toFixed(1)},${(-f.cz).toFixed(1)}`);
    if (b._w != null && (Math.abs(b._w - w) > 0.15 || Math.abs(b._d - d) > 0.15)) issues.push(`_w/_d ${b._w}×${b._d} vs rect ${w.toFixed(1)}×${d.toFixed(1)}`);
    if (b.floors && b.floorH && b.size && Math.abs(b.floors * b.floorH - b.size[1]) > 0.05) issues.push(`floors×floorH ${(b.floors * b.floorH).toFixed(2)} vs height ${b.size[1]}`);
    if (issues.length) { bad++; out.push(finding(C, 'warn', b.id, 'stored dimensions disagree with the footprint: ' + issues.join('; '))); }
  }
  if (!bad) out.push(finding(C, 'pass', 'derived fields', `size, _u/_v/_w/_d and floors×floorH agree with the plan rect for all ${c.buildings.length} buildings (±0.15 m)`));

  // Blender V3 GLB anchors (SITE_<id>) are placed at campus-metre centres
  if (!S.campusJs || !S.buildings) out.push(finding(C, 'skip', 'copies', 'copy comparison not run for a missing copy (see load)'));
  if (!S.glb) out.push(finding(C, 'skip', 'glb', 'Blender V3 anchor check not run: GLB missing (see load)'));
  if (S.glb) {
    const sites = S.glb.filter((n) => n.name.startsWith('SITE_'));
    let ok = 0;
    for (const n of sites) {
      const id = n.name.slice(5), b = c.buildings.find((x) => x.id === id);
      if (!b) { out.push(finding(C, 'error', 'glb:' + id, 'GLB anchor has no building in campus data')); continue; }
      const f = rectToFootprint(b.rect, tf, b.rot || 0);
      const dpos = Math.hypot(n.t[0] - f.cx, n.t[2] - f.cz);
      if (dpos > 0.05) out.push(finding(C, 'error', 'glb:' + id, `GLB anchor is ${dpos.toFixed(2)} m from the campus-data centre`, { glb: n.t, data: [f.cx, f.cz] }));
      else ok++;
      if (Math.abs(n.yaw - (b.rot || 0)) > 1e-3) {
        const flipped = Math.abs(n.yaw + (b.rot || 0)) < 1e-3;
        out.push(finding(C, flipped ? 'info' : 'warn', 'glb:' + id, `GLB yaw ${n.yaw.toFixed(3)} rad vs data rot ${(b.rot || 0).toFixed(3)}` + (flipped ? ' (opposite sign; lanren/map/campus-v3.js overrides the GLB yaw with the data value at load)' : '')));
      }
    }
    const missing = c.buildings.filter((b) => roleOf3d(b) && !sites.some((n) => n.name === 'SITE_' + b.id)).map((b) => b.id);
    out.push(finding(C, ok === sites.length ? 'pass' : 'warn', 'glb', `${ok}/${sites.length} Blender V3 anchors sit on their campus-data centres (±5 cm)` + (missing.length ? `; buildings with no V3 model: ${missing.join(', ')}` : '')));
  }

  // collider dump used by the life tests
  if (!S.colliders) out.push(finding(C, 'skip', 'colliders', 'collider cross-check not run: fixture missing'));
  if (S.colliders) {
    const pv = (() => { const t = c.buildings.find((b) => b.id === 'lanshu'); const f = rectToFootprint(t.rect, tf); return { x: f.cx, z: f.cz }; })();
    let far = 0, n = 0;
    for (const r of S.colliders.rects || []) {
      const b = c.buildings.find((x) => x.id === r.id);
      if (!b) continue;
      n++;
      const f = rectToFootprint(b.rect, tf, b.rot || 0);
      const d = Math.hypot(r.cx + pv.x - f.cx, r.cz + pv.z - f.cz) - Math.hypot(f.hw, f.hd);
      if (d > 20) { far++; out.push(finding(C, 'warn', 'collider:' + r.id, `collider centre lies ${d.toFixed(1)} m beyond its building's footprint`)); }
    }
    if (!far) out.push(finding(C, 'pass', 'colliders', `${n} building colliders in tests/fixtures/life-colliders.json lie on their buildings (world frame = campus − tree pivot)`));
  }
  return { copies, findings: out };
}

const roleOf3d = (b) => ['academic', 'lab', 'library', 'canteen', 'living', 'art', 'office', 'gate', 'corr', 'pavilion'].includes(b.form);

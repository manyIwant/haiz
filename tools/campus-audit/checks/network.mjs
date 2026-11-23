// Can you walk it? Path connectivity, gates on the network, doors on their buildings
// and near a path, tour stops and camera views that point at real things.
import { overlapArea, gap, components, distanceTo } from '../lib/geom.mjs';
import { features, worldPivot, finding } from '../lib/model.mjs';

const C = 'network';
const LINK = 0.5;   // two path rectangles closer than this are joined
const REACH = 12;   // a door this far from any path needs an unmodelled forecourt or lane

export function run(S) {
  const out = [];
  const c = S.campus;
  const F = features(c);
  const roads = F.filter((f) => f.kind === 'road');
  const B = new Map(F.filter((f) => f.kind === 'building').map((f) => [f.id, f]));

  const comps = components(roads.length, (i, j) => overlapArea(roads[i].fp, roads[j].fp) > 0 || gap(roads[i].fp, roads[j].fp) <= LINK);
  const names = comps.map((g) => g.map((i) => roads[i].id));
  if (comps.length === 1) out.push(finding(C, 'pass', 'paths', `all ${roads.length} path rectangles form one connected network`));
  else out.push(finding(C, 'warn', 'paths', `paths split into ${comps.length} disconnected groups: ${names.map((n) => '[' + n.join(', ') + ']').join(' ')}`, { groups: names }));
  const main = new Set(names[0]);
  const toNet = (fp) => Math.min(...roads.filter((r) => main.has(r.id)).map((r) => gap(fp, r.fp)));

  for (const id of ['beimen', 'nanmen']) {
    const g = B.get(id);
    if (!g) continue;
    const d = toNet(g.fp);
    out.push(finding(C, d <= 3 ? 'pass' : 'warn', id, `gate is ${d.toFixed(1)} m from the main path network`));
  }
  // every solid building close to the network
  const far = [];
  for (const f of B.values()) {
    if (f.role !== 'solid') continue;
    const d = toNet(f.fp);
    if (d > REACH) far.push(`${f.id} ${d.toFixed(0)} m`);
  }
  out.push(finding(C, far.length ? 'warn' : 'pass', 'buildings to paths', far.length ? `solid buildings more than ${REACH} m from any modelled path (real access is unmodelled): ${far.join(', ')}` : `every solid building is within ${REACH} m of the path network`));

  // doors (lanren/life/places.js, world frame) against their buildings and the paths
  if (S.places?.PLACES) {
    const pv = worldPivot(c);
    const bad = [], loose = [];
    let n = 0;
    for (const [id, p] of Object.entries(S.places.PLACES)) {
      const parts = [...B.values()].filter((f) => f.id === id || f.id.startsWith(id + '_') && f.form === B.get(id)?.form);
      if (!parts.length) { out.push(finding(C, 'error', 'door:' + id, 'places.js names a building that campus data does not have')); continue; }
      for (const [k, d] of p.doors.entries()) {
        n++;
        const x = d[0] + pv.x, z = d[1] + pv.z;
        const toB = Math.min(...parts.map((f) => distanceTo(f.fp, x, z)));
        const inside = parts.some((f) => distanceTo(f.fp, x, z) === 0);
        const toR = Math.min(...roads.map((r) => distanceTo(r.fp, x, z)));
        if (inside) bad.push(`${id}#${k} inside its footprint`);
        else if (toB > 8) bad.push(`${id}#${k} ${toB.toFixed(1)} m from its building`);
        if (toR > REACH) loose.push(`${id}#${k} ${toR.toFixed(0)} m to a path`);
      }
    }
    out.push(finding(C, bad.length ? 'warn' : 'pass', 'doors on buildings', bad.length ? `doors not on their building's edge (± 8 m): ${bad.join('; ')}` : `all ${n} doors sit within 8 m of their building's footprint`));
    out.push(finding(C, loose.length ? 'info' : 'pass', 'doors to paths', loose.length ? `doors more than ${REACH} m from a modelled path (life's own nav graph may still reach them): ${loose.join('; ')}` : `all doors are within ${REACH} m of a modelled path`));
  }

  // tour and views
  const views = new Set((c.views || []).map((v) => v.id));
  for (const t of c.tour || []) {
    if (!views.has(t.view)) out.push(finding(C, 'error', 'tour:' + t.id, `tour stop uses unknown view '${t.view}'`));
    if (!B.has(t.id)) out.push(finding(C, 'warn', 'tour:' + t.id, `tour stop '${t.title}' has no geometry in campus data (it borrows the '${t.view}' view)`));
  }
  for (const v of c.views || []) {
    const d = Math.hypot(v.look[0] - v.eye[0], v.look[1] - v.eye[1]);
    if (B.has(v.id)) {
      const f = B.get(v.id);
      // views store eye/look as campus [x, z]
      const dl = distanceTo(f.fp, v.look[0], v.look[1]);
      if (dl > 5) out.push(finding(C, 'warn', 'view:' + v.id, `camera looks at a point ${dl.toFixed(1)} m from the feature it is named after`));
    }
    if (!Number.isFinite(d)) out.push(finding(C, 'error', 'view:' + v.id, 'non-finite camera'));
  }
  if (!out.some((f) => f.subject.startsWith('view:'))) out.push(finding(C, 'pass', 'views', `${(c.views || []).length} camera views are finite and look at the features they are named after`));
  return { groups: names, findings: out };
}

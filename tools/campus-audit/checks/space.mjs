// Do things sit where they physically can? Overlaps, roads through buildings,
// trees inside walls or water, features off the ground sheet.
import { overlapArea, contains, area } from '../lib/geom.mjs';
import { features, GROUPS, planToCampus, finding } from '../lib/model.mjs';

const C = 'space';
const group = (id) => GROUPS[id] || id;

export function run(S) {
  const out = [];
  const c = S.campus, tf = c.meta.transform;
  const F = features(c);
  const B = F.filter((f) => f.kind === 'building');
  const solids = B.filter((f) => f.role === 'solid');
  const stats = { solidPairs: 0, solidOverlaps: 0, coverOverlaps: 0, roadThroughSolid: 0, trees: { total: 0, inSolid: 0, inWater: 0, offSheet: 0, onRoad: 0 } };

  // building against building
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
    const a = B[i], b = B[j];
    if (group(a.id) === group(b.id)) continue;
    const ov = overlapArea(a.fp, b.fp);
    if (a.role === 'solid' && b.role === 'solid') stats.solidPairs++;
    if (ov < 0.5) continue;
    const frac = ov / Math.min(area(a.fp), area(b.fp));
    const pair = `${a.id} × ${b.id}`;
    if (a.role === 'solid' && b.role === 'solid') {
      stats.solidOverlaps++;
      out.push(finding(C, 'error', pair, `two solid buildings overlap by ${ov.toFixed(1)} m² (${(frac * 100).toFixed(0)}% of the smaller)`, { overlap: ov }));
    } else if ((a.role === 'cover' || b.role === 'cover') && (a.role === 'solid' || b.role === 'solid')) {
      stats.coverOverlaps++;
      const sev = frac > 0.25 ? 'warn' : 'info';
      out.push(finding(C, sev, pair, `covered walk / pavilion runs ${ov.toFixed(1)} m² into a building (${(frac * 100).toFixed(0)}% of the smaller); fine where it docks, suspicious if large`, { overlap: ov }));
    } else if (a.role === 'ground' && b.role === 'ground') {
      // a pond in a garden or a tree in a garden is expected nesting
      if (frac < 0.999) out.push(finding(C, 'info', pair, `landscape areas partly overlap (${ov.toFixed(1)} m²)`));
    } else if ((a.role === 'solid' && b.role === 'ground') || (a.role === 'ground' && b.role === 'solid')) {
      out.push(finding(C, 'warn', pair, `building overlaps a landscape area by ${ov.toFixed(1)} m²`, { overlap: ov }));
    }
  }
  if (!stats.solidOverlaps) out.push(finding(C, 'pass', 'solids', `no two of the ${solids.length} solid buildings overlap (${stats.solidPairs} pairs; the men's dormitory wings count as one building)`));

  // roads against solid buildings (the walk would put paving through a wall)
  const roads = F.filter((f) => f.kind === 'road');
  for (const r of roads) for (const s of solids) {
    const ov = overlapArea(r.fp, s.fp);
    if (ov > 1) { stats.roadThroughSolid++; out.push(finding(C, 'warn', `${r.id} × ${s.id}`, `path rectangle runs ${ov.toFixed(1)} m² into a building`, { overlap: ov })); }
  }
  if (!stats.roadThroughSolid) out.push(finding(C, 'pass', 'roads', `none of the ${roads.length} path rectangles cuts through a solid building`));

  // water against solids and roads
  for (const w of F.filter((f) => f.kind === 'water')) for (const s of solids.concat(roads)) {
    const ov = overlapArea(w.fp, s.fp);
    if (ov > 1) out.push(finding(C, 'warn', `${w.id} × ${s.id}`, `water overlaps ${s.kind === 'road' ? 'a path' : 'a building'} by ${ov.toFixed(1)} m²`));
  }

  // trees: the legacy points are invented positions, but they still must not stand in walls or ponds
  const sheet = { hw: c.meta.ground.width / 2, hd: c.meta.ground.depth / 2 };
  const water = F.filter((f) => f.kind === 'water' || f.form === 'pond');
  const inSolid = [], inWater = [], off = [];
  for (const [i, t] of (c.trees || []).entries()) {
    stats.trees.total++;
    const p = planToCampus(t.p, tf);
    const hit = solids.find((s) => contains(s.fp, p.x, p.z, -0.3));
    if (hit) { stats.trees.inSolid++; inSolid.push(`#${i} ${t.t} in ${hit.id}`); }
    if (water.some((w) => contains(w.fp, p.x, p.z, -0.3))) { stats.trees.inWater++; inWater.push(`#${i}`); }
    if (Math.abs(p.x) > sheet.hw || Math.abs(p.z) > sheet.hd) { stats.trees.offSheet++; off.push(`#${i}`); }
    if (roads.some((r) => contains(r.fp, p.x, p.z, -0.5))) stats.trees.onRoad++;
  }
  const T = stats.trees;
  out.push(finding(C, T.inSolid ? 'warn' : 'pass', 'trees in buildings', T.inSolid ? `${T.inSolid}/${T.total} tree points stand inside a solid building footprint (the renderer culls or moves some of them at run time): ${inSolid.slice(0, 12).join('; ')}${inSolid.length > 12 ? ' …' : ''}` : `no tree point stands inside a solid building (${T.total} points)`));
  out.push(finding(C, T.inWater ? 'warn' : 'pass', 'trees in water', T.inWater ? `${T.inWater} tree points stand in a pond: ${inWater.join(', ')}` : 'no tree point stands in water'));
  out.push(finding(C, T.offSheet ? 'info' : 'pass', 'trees off the ground sheet', T.offSheet ? `${T.offSheet} tree points lie outside the ${c.meta.ground.width}×${c.meta.ground.depth} m ground sheet (street trees or stray points)` : 'all tree points lie on the ground sheet'));
  out.push(finding(C, T.onRoad ? 'info' : 'pass', 'trees on paths', `${T.onRoad} tree points stand on a path rectangle (street trees along the axial road are plausible; a tree in the middle of a 10 m path is not)`));

  // features off the ground sheet
  for (const f of B) {
    if (Math.abs(f.fp.cx) - f.fp.hw > sheet.hw || Math.abs(f.fp.cz) - f.fp.hd > sheet.hd) out.push(finding(C, 'warn', f.id, 'lies entirely outside the ground sheet'));
  }
  return { stats, findings: out };
}

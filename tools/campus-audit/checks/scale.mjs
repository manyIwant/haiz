// Are the dimensions plausible for what each thing is?
// Reference dimensions are public standards, not measurements of this campus.
import { rectToFootprint } from '../lib/geom.mjs';
import { finding } from '../lib/model.mjs';

const C = 'scale';
// IAAF/World Athletics standard 400 m track, 8 lanes of 1.22 m: straights 84.39 m, inner radius 36.50 m
export const TRACK_400 = { length: 84.39 + 2 * (36.5 + 8 * 1.22), width: 2 * (36.5 + 8 * 1.22) };
// FIBA basketball 28 × 15 m, volleyball 18 × 9 m
const COURTS = { basketball: [28, 15], volleyball: [18, 9] };
// Plausible storey heights for Chinese school buildings (GB 50099 gives ≥ 3.6 m clear for classrooms in many cases)
const STOREY = { academic: [3.3, 4.2], lab: [3.6, 4.5], living: [2.9, 3.6], library: [3.6, 5.0], canteen: [3.6, 5.5], art: [3.6, 6.0], office: [3.0, 4.2] };

export function run(S) {
  const out = [];
  const c = S.campus, tf = c.meta.transform;
  const field = c.buildings.find((b) => b.id === 'yundong');
  if (field) {
    const f = rectToFootprint(field.rect, tf);
    const L = 2 * f.hw, W = 2 * f.hd;
    const dl = (L - TRACK_400.length) / TRACK_400.length, dw = (W - TRACK_400.width) / TRACK_400.width;
    const sev = Math.abs(dl) < 0.05 && Math.abs(dw) < 0.05 ? 'pass' : 'warn';
    out.push(finding(C, sev, 'yundong', `field footprint ${L.toFixed(1)} × ${W.toFixed(1)} m vs a standard 8-lane 400 m track ${TRACK_400.length.toFixed(1)} × ${TRACK_400.width.toFixed(1)} m (${(dl * 100).toFixed(1)}%, ${(dw * 100).toFixed(1)}%)`, { L, W, ref: TRACK_400 }));
  }
  for (const a of (c.sports || [])) {
    const f = rectToFootprint(a.rect, tf);
    const ref = COURTS[a.kind];
    if (!ref || !a.grid) continue;
    const [cols, rows] = a.grid;
    const W = 2 * f.hw, D = 2 * f.hd;
    // try both orientations of the court grid; a court needs its play area plus ≥ 2 m run-off per side
    const need = (len, wid) => [cols * (wid + 4), rows * (len + 4)];
    const fits = [need(ref[0], ref[1]), need(ref[1], ref[0])].some(([nw, nd]) => (nw <= W && nd <= D) || (nw <= D && nd <= W));
    const bare = [[cols * ref[1], rows * ref[0]], [cols * ref[0], rows * ref[1]]].some(([nw, nd]) => (nw <= W && nd <= D) || (nw <= D && nd <= W));
    out.push(finding(C, fits ? 'pass' : 'warn', a.id, `${cols}×${rows} ${a.kind} courts (${ref[0]}×${ref[1]} m + 2 m run-off) ${fits ? 'fit' : 'do not fit'} in the ${W.toFixed(1)} × ${D.toFixed(1)} m footprint` + (fits ? '' : bare ? '; the bare playing areas fit only with less than regulation run-off, so either the courts are undersized or the footprint is too small' : '; even the bare playing areas do not fit')));
  }
  let ok = 0;
  for (const b of c.buildings) {
    const r = STOREY[b.form];
    if (!r || !b.floorH) continue;
    if (b.floorH < r[0] || b.floorH > r[1]) out.push(finding(C, 'warn', b.id, `storey height ${b.floorH} m is outside the usual ${r[0]}–${r[1]} m for ${b.form}`));
    else ok++;
    const f = rectToFootprint(b.rect, tf);
    const minSide = 2 * Math.min(f.hw, f.hd);
    if (['academic', 'lab'].includes(b.form) && minSide < 9) out.push(finding(C, 'warn', b.id, `only ${minSide.toFixed(1)} m deep: too shallow for a classroom (≈ 7–9 m) plus corridor`));
    if (b.form === 'living' && minSide < 10 && !b.id.startsWith('dorm_m')) out.push(finding(C, 'info', b.id, `${minSide.toFixed(1)} m deep`));
  }
  out.push(finding(C, 'pass', 'storey heights', `${ok} buildings have storey heights inside the usual range for their use`));
  // the generic "height rule" makes every building of a kind the same height: flag it as estimation, not evidence
  const byForm = {};
  for (const b of c.buildings) if (b.size && b.floors) (byForm[b.form] ||= new Set()).add(b.size[1]);
  const uniform = Object.entries(byForm).filter(([, s]) => s.size === 1).map(([k, s]) => `${k} ${[...s][0]} m`);
  out.push(finding(C, 'info', 'height rule', `heights are uniform per building type (${uniform.join(', ')}): a modelling rule, so heights must not be presented as measured`));
  return { findings: out };
}

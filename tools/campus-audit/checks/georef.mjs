// Does the model line up with the real world? Uses only material already in the repo:
// the legacy Amap anchors and the Esri imagery tile with hand-read control points.
import { fitSimilarity, rectToFootprint } from '../lib/geom.mjs';
import { gcjToWgs, enu, distance, bearingOf, imagePixelToGround } from '../lib/geo.mjs';
import { finding } from '../lib/model.mjs';

const C = 'georef';
export const CLAIMED_ROTATION_DEG = 41.4; // meta.source.plan: "校园整体相对真北旋转约 41.4°"

/** campus (x, z) → model east/north: +X is model east, −Z is model north (toward the North Gate) */
const modelEN = (x, z) => [x, -z];

export function run(S) {
  const out = [];
  const c = S.campus, tf = c.meta.transform;
  const result = {};

  // 1. Two legacy anchors (GCJ-02). Only their relative geometry is used.
  const A = c.anchors;
  const south = c.buildings.find((b) => b.id === 'nanmen');
  if (A?.center && A?.southGate && south) {
    const w0 = gcjToWgs(A.center), w1 = gcjToWgs(A.southGate);
    const shift = distance(A.center, w0);
    const v = enu(w0, w1), real = Math.hypot(v.e, v.n), bReal = bearingOf(v.e, v.n);
    const f = rectToFootprint(south.rect, tf);
    const [me, mn] = modelEN(f.cx, f.cz), model = Math.hypot(me, mn), bModel = bearingOf(me, mn);
    const rot = ((bModel - bReal + 540) % 360) - 180; // anticlockwise rotation of the campus from true north
    result.anchors = { gcjShiftMetres: shift, realDistance: real, modelDistance: model, rotationDeg: rot };
    out.push(finding(C, 'info', 'anchors', `anchors are Amap GCJ-02; WGS84 equivalents sit ${shift.toFixed(0)} m away. Read as GCJ-02, centre → south gate is ${real.toFixed(1)} m on the ground vs ${model.toFixed(1)} m in the model (${(((model - real) / real) * 100).toFixed(1)}%), implying the campus axis is turned ${rot.toFixed(1)}° anticlockwise from true north (claimed ${CLAIMED_ROTATION_DEG}°)`, result.anchors));
    out.push(finding(C, 'info', 'anchors', 'the anchor pair\'s own provenance is undocumented ("centre" is not defined as a model point); treat as a weak, second opinion'));
  }

  // 2. Control points on the imagery tile
  const cp = S.controlPoints, man = S.imagery;
  if (cp && man) {
    const layer = man.layers.find((l) => l.name === cp.layer);
    const src = [], dst = [], used = [];
    for (const p of cp.points) {
      const b = c.buildings.find((x) => x.id === p.id);
      if (!b) { out.push(finding(C, 'error', 'cp:' + p.id, 'control point names an unknown feature')); continue; }
      const f = rectToFootprint(b.rect, tf, b.rot || 0);
      const g = imagePixelToGround(p.u, p.v, layer.bounds, layer.pixels);
      src.push(modelEN(f.cx, f.cz)); dst.push([g.e, g.n]); used.push(p);
    }
    if (used.length >= 3) {
      const fit = fitSimilarity(src, dst);
      const rotDeg = (fit.rot * 180) / Math.PI;
      // leave-one-out: how much does each point move the answer?
      const loo = used.map((p, i) => {
        const s2 = src.filter((_, k) => k !== i), d2 = dst.filter((_, k) => k !== i);
        const f2 = fitSimilarity(s2, d2), q = f2.apply(src[i]);
        return { id: p.id, rotDeg: (f2.rot * 180) / Math.PI, scale: f2.scale, predictionError: Math.hypot(q[0] - dst[i][0], q[1] - dst[i][1]) };
      });
      const rots = loo.map((l) => l.rotDeg), scales = loo.map((l) => l.scale);
      result.imagery = {
        layer: cp.layer, metresPerPixel: imagePixelToGround(0, 0, layer.bounds, layer.pixels).metresPerPixel,
        points: used.length, rotationDeg: rotDeg, scale: fit.scale, offsetEast: fit.tx, offsetNorth: fit.ty, rms: fit.rms,
        residuals: used.map((p, i) => ({ id: p.id, sigma: p.sigma, residual: fit.residuals[i] })),
        leaveOneOut: loo,
        rotationRange: [Math.min(...rots), Math.max(...rots)], scaleRange: [Math.min(...scales), Math.max(...scales)]
      };
      const dRot = rotDeg - CLAIMED_ROTATION_DEG;
      out.push(finding(C, Math.abs(dRot) <= 3 ? 'pass' : 'warn', 'orientation', `imagery fit (${used.length} points): campus axis turned ${rotDeg.toFixed(1)}° anticlockwise from true north (leave-one-out ${result.imagery.rotationRange.map((x) => x.toFixed(1)).join('–')}°); claimed ${CLAIMED_ROTATION_DEG}°, difference ${dRot.toFixed(1)}°`));
      const dS = (fit.scale - 1) * 100;
      out.push(finding(C, Math.abs(dS) <= 5 ? 'pass' : 'warn', 'scale', `model → ground scale ${fit.scale.toFixed(3)} (model ${dS >= 0 ? 'smaller' : 'larger'} than imagery by ${Math.abs(dS).toFixed(1)}%; leave-one-out ${result.imagery.scaleRange.map((x) => x.toFixed(3)).join('–')})`));
      const worst = result.imagery.residuals.filter((r) => r.residual > 2 * r.sigma);
      out.push(finding(C, worst.length ? 'warn' : 'pass', 'position', `RMS residual ${fit.rms.toFixed(1)} m after the best similarity fit; per point ${result.imagery.residuals.map((r) => `${r.id} ${r.residual.toFixed(1)} m (σ ${r.sigma})`).join(', ')}` + (worst.length ? `; beyond 2σ: ${worst.map((r) => r.id).join(', ')}` : '')));
      out.push(finding(C, 'info', 'origin', `campus origin (plan px ${tf.originPx.join(', ')}) sits ${Math.hypot(fit.tx, fit.ty).toFixed(1)} m from the imagery centre (WGS84 ${man.target.lat.toFixed(6)}, ${man.target.lon.toFixed(6)})`));
    }
  }
  return { result, findings: out };
}

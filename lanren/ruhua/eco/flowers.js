// 龙船花 (Ixora chinensis), the red-orange flower heads of every Hainan school garden: low clipped domes
// in the two gardens before 一号教学楼 (衍林堂, 凤栖堂) and along the cat's lane. Interpretive planting
// (the plan has gardens, not species): placed in the garden features, off their paths and pavilions.
// Each flower head is a nectar source the butterflies know (habitat.flowers).
import * as THREE from 'three';
import { cel } from '../../ruhua-stroll/atmos.js';
import { featureSDF } from '../../map/geo.js';

function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

export function createFlowers(habitat, { extra = [] } = {}) {
  const { world, G } = habitat;
  const r = rng(4207);
  const feats = world.geo.features;
  const gardens = feats.filter((f) => f.id === 'yanlintang' || f.id === 'fengqitang');
  const blockers = feats.filter((f) => ['road', 'pavilion', 'building', 'water', 'corridor'].includes(f.kind));
  const domes = [];
  const tryAt = (x, z, s) => {
    if (blockers.some((f) => featureSDF(f, x, z) < 1.2)) return false;
    if (domes.some((d) => Math.hypot(d.x - x, d.z - z) < d.s + s + 0.3)) return false;
    if (Math.hypot(x, z) < 9.5) return false;                         // the islet
    domes.push({ x, z, s, h: s * (0.75 + 0.3 * r()) });
    return true;
  };
  for (const f of gardens) {
    const n = f.id === 'fengqitang' ? 16 : 11;
    for (let k = 0, made = 0; k < 400 && made < n; k++) {
      // patches near the garden's edge and round its pavilion: where gardeners put them
      const edge = r() < 0.6;
      const lx = (r() * 2 - 1) * (f.hw - 1.2), lz = (r() * 2 - 1) * (f.hd - 1.2);
      const ex = edge ? Math.sign(lx) * (f.hw - 1.4 - r() * 1.5) : lx, ez = edge && r() < 0.5 ? Math.sign(lz) * (f.hd - 1.4 - r() * 1.5) : lz;
      const c = Math.cos(f.rot), s = Math.sin(f.rot);
      const cx = f.cx + ex * c + ez * s, cz = f.cz - ex * s + ez * c;
      let ok = false;
      for (let j = 0; j < 4; j++) ok = tryAt(cx + (r() - 0.5) * 1.6, cz + (r() - 0.5) * 1.6, 0.35 + r() * 0.3) || ok;
      if (ok) made++;
    }
  }
  for (const p of extra) for (let j = 0; j < 3; j++) tryAt(p.x + (r() - 0.5) * 1.4, p.z + (r() - 0.5) * 1.4, 0.32 + r() * 0.25);

  // ---- the shrubs: lumpy domes of clipped leaves
  const dome = new THREE.IcosahedronGeometry(1, 2);
  { const p = dome.getAttribute('position'); for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + 0.12 * Math.sin(x * 6 + z * 4) * Math.cos(y * 5); p.setXYZ(i, x * k, Math.max(-0.15, y) * k, z * k); } dome.computeVertexNormals(); }
  const leafMat = cel({ name: 'ixora-leaf', key: 'ixora-leaf', color: new THREE.Color('#3f7a35'), soft: 0.2,
    fragment: { albedo: 'albedo *= 0.88 + 0.24 * aNoise(vWP.xz * 3.0 + vWP.y * 2.0); albedo = wetAlbedo(albedo, uWet, 0.4);\n' } });
  const shrubs = new THREE.InstancedMesh(dome, leafMat, domes.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p3 = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  domes.forEach((d, i) => { shrubs.setMatrixAt(i, m.compose(p3.set(d.x, G + d.h * 0.55, d.z), q.setFromAxisAngle(up, r() * 6), sc.set(d.s, d.h * 0.6, d.s))); });
  shrubs.castShadow = shrubs.receiveShadow = true;
  // ---- the flower heads: small round umbels on the upper half of each dome
  const heads = [];
  for (const d of domes) {
    const n = Math.round(5 + d.s * 10);
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2, el = 0.25 + r() * 0.9;
      heads.push({ x: d.x + Math.cos(a) * Math.cos(el) * d.s * 0.95, y: G + d.h * 0.55 + Math.sin(el) * d.h * 0.6 * 0.95, z: d.z + Math.sin(a) * Math.cos(el) * d.s * 0.95, tone: r() });
    }
  }
  const ball = new THREE.IcosahedronGeometry(0.075, 1);
  const headMat = cel({ name: 'ixora-flower', key: 'ixora-flower', soft: 0.25,
    fragment: { albedo: 'albedo *= 0.9 + 0.2 * aNoise(vWP.xz * 40.0);\n', after: 'outCol += albedo * uSunColor * 0.08;\n' } });
  const flowers = new THREE.InstancedMesh(ball, headMat, heads.length);
  heads.forEach((h, i) => {
    flowers.setMatrixAt(i, m.compose(p3.set(h.x, h.y, h.z), q.identity(), sc.setScalar(0.8 + h.tone * 0.5)));
    flowers.setColorAt(i, col.set(h.tone < 0.75 ? '#e2452b' : h.tone < 0.92 ? '#f07a2e' : '#d6304a'));
  });
  flowers.castShadow = true;
  // every third head is a nectar source the butterflies keep track of
  heads.forEach((h, i) => { if (i % 3 === 0) habitat.flowers.push({ x: h.x, y: h.y + 0.04, z: h.z, kind: 'ixora', a: 1, last: -1e9 }); });
  const group = new THREE.Group();
  group.name = 'ixora';
  group.add(shrubs, flowers);
  // the walker should not wade through the beds
  world.extraCircles.push(...domes.map((d, i) => ({ id: 'ixora' + i, x: d.x, z: d.z, r: d.s * 0.85 })));
  return { group, domes, heads };
}

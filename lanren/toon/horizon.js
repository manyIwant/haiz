// What lies past the campus wall, painted the way backgrounds paint distance: a tree belt along
// the campus edge, then the low city of 府城 as pale blocks, all of it dissolving into the same air
// as the sky's horizon. This is atmosphere, not a model of the surrounding streets: positions and
// heights are generated, and the haze is what the eye is meant to read (Haikou is flat; the
// reference's mountains are deliberately not imported).
import * as THREE from 'three';
import { toonMaterial } from './toon.js';

function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

export function createHorizon(geo) {
  const g = new THREE.Group();
  g.name = 'toon-horizon';
  const s = geo.frame.sheet, y0 = geo.frame.ground;
  const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
  const hx = (s.x1 - s.x0) / 2, hz = (s.z1 - s.z0) / 2;
  const r = rng(20261116);
  // the tree belt: lumpy canopy blobs just outside the campus edge
  const blob = new THREE.IcosahedronGeometry(1, 2);
  {
    const pos = blob.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const k = 1 + 0.16 * Math.sin(x * 5.1 + z * 3.7) * Math.cos(y * 4.3);
      pos.setXYZ(i, x * k, y * k * 0.8, z * k);
    }
    blob.computeVertexNormals();
  }
  const belt = [];
  const per = 2 * (hx + hz);
  for (let d = 0; d < per; d += 6.5) {
    let x, z, nx, nz;
    if (d < 2 * hx) { x = s.x0 + d; z = s.z0; nx = 0; nz = -1; } else if (d < 2 * hx + 2 * hz) { x = s.x1; z = s.z0 + (d - 2 * hx); nx = 1; nz = 0; } else if (d < 4 * hx + 2 * hz) { x = s.x1 - (d - 2 * hx - 2 * hz); z = s.z1; nx = 0; nz = 1; } else { x = s.x0; z = s.z1 - (d - 4 * hx - 2 * hz); nx = -1; nz = 0; }
    for (let k = 0; k < 2; k++) {
      const out = 6 + k * 9 + r() * 6;
      belt.push({ x: x + nx * out + (r() - 0.5) * 4, z: z + nz * out + (r() - 0.5) * 4, s: 4 + r() * 3.5, h: 7 + r() * 6 });
    }
  }
  const leafMat = toonMaterial({ name: 'belt', key: 'belt', color: new THREE.Color('#4f8a3c'), soft: 0.15 });
  const trunkMat = toonMaterial({ name: 'belt-trunk', key: 'belt-trunk', color: new THREE.Color('#6b5a4a') });
  const crowns = new THREE.InstancedMesh(blob, leafMat, belt.length);
  const trunk = new THREE.CylinderGeometry(0.18, 0.28, 1, 6);
  trunk.translate(0, 0.5, 0);
  const trunks = new THREE.InstancedMesh(trunk, trunkMat, belt.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
  belt.forEach((b, i) => {
    m.compose(p.set(b.x, y0 + b.h, b.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6), sc.set(b.s, b.s * 0.85, b.s));
    crowns.setMatrixAt(i, m);
    c.set('#4f8a3c').offsetHSL((r() - 0.5) * 0.04, (r() - 0.5) * 0.1, (r() - 0.5) * 0.08);
    crowns.setColorAt(i, c);
    m.compose(p.set(b.x, y0, b.z), q.identity(), sc.set(1, b.h, 1));
    trunks.setMatrixAt(i, m);
  });
  crowns.castShadow = true; crowns.receiveShadow = true;
  g.add(crowns, trunks);

  // the city: pale blocks in rings beyond the belt, taller further out (the eye reads a skyline)
  const box = new THREE.BoxGeometry(1, 1, 1);
  box.translate(0, 0.5, 0);
  const cityMat = toonMaterial({ name: 'city', key: 'city', color: new THREE.Color('#ffffff'),
    fragment: { albedo: /* glsl */`
// window bands, painted: a darker stripe every storey on the walls, flat roofs left plain
float fl = fract((vToonWP.y - uGroundY) / 3.2);
float wall = 1.0 - step(0.8, abs(normalize(vToonN).y));
toonAlbedo *= 1.0 - wall * 0.22 * step(0.55, fl) * step(fl, 0.85);
` } });
  const blocks = [];
  const R0 = Math.hypot(hx, hz) + 30;
  for (let i = 0; i < 900; i++) {
    const a = r() * Math.PI * 2;
    const rr = R0 + Math.pow(r(), 0.8) * 1100;
    const x = cx + Math.cos(a) * rr * (hx / Math.max(hx, hz) * 0.25 + 0.75), z = cz + Math.sin(a) * rr;
    if (x > s.x0 - 30 && x < s.x1 + 30 && z > s.z0 - 30 && z < s.z1 + 30) continue;
    const far = (rr - R0) / 1100;
    const h = 6 + r() * 14 + far * far * 50 * r();
    blocks.push({ x, z, w: 10 + r() * 22, d: 10 + r() * 22, h, rot: Math.round(r() * 4) * Math.PI / 2 + 0.72 });
  }
  const city = new THREE.InstancedMesh(box, cityMat, blocks.length);
  const tints = ['#f1ece2', '#e9e4da', '#dfe3df', '#f3e6d6', '#d9dedf', '#efe9df', '#c9d3cf'];
  blocks.forEach((b, i) => {
    m.compose(p.set(b.x, y0, b.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.rot), sc.set(b.w, b.h, b.d));
    city.setMatrixAt(i, m);
    c.set(tints[(r() * tints.length) | 0]);
    city.setColorAt(i, c);
  });
  city.receiveShadow = true;
  g.add(city);
  // roof-top and street trees between the blocks (green lumps that keep the city from reading as bare)
  const lumps = 700;
  const street = new THREE.InstancedMesh(blob, leafMat, lumps);
  for (let i = 0; i < lumps; i++) {
    const a = r() * Math.PI * 2, rr = R0 + 10 + Math.pow(r(), 0.9) * 900;
    const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
    const sz = 4 + r() * 5;
    m.compose(p.set(x, y0 + sz * 0.7, z), q.identity(), sc.set(sz, sz * 0.8, sz));
    street.setMatrixAt(i, m);
    c.set('#4a8538').offsetHSL((r() - 0.5) * 0.05, 0, (r() - 0.5) * 0.08);
    street.setColorAt(i, c);
  }
  g.add(street);
  // the campus wall: a low cream wall with a tile coping along the sheet edge
  const wallMat = toonMaterial({ name: 'wall', key: 'campus-wall', color: new THREE.Color('#efe6d4') });
  const capMat = toonMaterial({ name: 'coping', key: 'campus-coping', color: new THREE.Color('#9e4b33') });
  const wall = new THREE.Group();
  const seg = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0);
    const w = new THREE.Mesh(new THREE.BoxGeometry(L, 2.2, 0.3), wallMat);
    w.position.set((x0 + x1) / 2, y0 + 1.1, (z0 + z1) / 2); w.rotation.y = -a;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(L, 0.16, 0.5), capMat);
    cap.position.set(0, 1.18, 0); w.add(cap);
    w.castShadow = w.receiveShadow = true;
    wall.add(w);
  };
  seg(s.x0, s.z0, s.x1, s.z0); seg(s.x1, s.z0, s.x1, s.z1); seg(s.x1, s.z1, s.x0, s.z1); seg(s.x0, s.z1, s.x0, s.z0);
  g.add(wall);
  return g;
}

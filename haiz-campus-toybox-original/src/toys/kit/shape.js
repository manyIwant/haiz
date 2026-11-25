// HAIZ Campus Toybox — procedural sculpting kit.
// Small, composable helpers for building soft-toy geometry: deformable blobs, lathe profiles,
// surface projection (to place eyes / embroidery exactly on a curved body), sewing seams,
// and sculpted leaves.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();

/**
 * Deformable soft blob. Starts from a unit sphere; `shape(dir)` returns the surface point for a
 * unit direction (default: ellipsoid). Optional `post(p, dir)` adds detail.
 */
export function blob({ rx = 1, ry = 1, rz = 1, w = 48, h = 32, shape, post } = {}) {
  const g = new THREE.SphereGeometry(1, w, h);
  const pos = g.attributes.position;
  const dir = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    dir.fromBufferAttribute(pos, i).normalize();
    let p = shape ? shape(dir.clone()) : new THREE.Vector3(dir.x * rx, dir.y * ry, dir.z * rz);
    if (post) p = post(p, dir) || p;
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  g.computeVertexNormals();
  fixSphereSeamNormals(g);
  return g;
}

/** SphereGeometry duplicates the seam column; average its normals so deformed blobs stay smooth. */
function fixSphereSeamNormals(g) {
  const pos = g.attributes.position, nor = g.attributes.normal;
  const map = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = `${pos.getX(i).toFixed(5)},${pos.getY(i).toFixed(5)},${pos.getZ(i).toFixed(5)}`;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(i);
  }
  for (const idx of map.values()) {
    if (idx.length < 2) continue;
    _n.set(0, 0, 0);
    for (const i of idx) _n.add(_v.fromBufferAttribute(nor, i));
    _n.normalize();
    for (const i of idx) nor.setXYZ(i, _n.x, _n.y, _n.z);
  }
}

/** Smooth step helper. */
export const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Lathe from a list of [radius, y] pairs, smoothed with a Catmull-Rom spline. */
export function lathe(profile, { segments = 48, samples = 48 } = {}) {
  const curve = new THREE.CatmullRomCurve3(profile.map(([r, y]) => new THREE.Vector3(r, y, 0)));
  const pts = curve.getPoints(samples).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  const g = new THREE.LatheGeometry(pts, segments);
  g.computeVertexNormals();
  return g;
}

/**
 * Project a point onto a mesh surface by casting a ray from `origin` toward `target`.
 * Returns { point, normal } in the mesh's parent space (mesh must have identity or simple transform).
 */
export function projectOnto(mesh, origin, target) {
  mesh.updateWorldMatrix(true, false);
  const rc = new THREE.Raycaster(origin.clone(), target.clone().sub(origin).normalize());
  const hit = rc.intersectObject(mesh, false)[0];
  if (!hit) return { point: target.clone(), normal: origin.clone().sub(target).normalize() };
  const normal = hit.face.normal.clone().transformDirection(mesh.matrixWorld).normalize();
  return { point: hit.point.clone(), normal };
}

/**
 * Convenience: project from far out along direction (from body centre `c`).
 * dir is a vector from centre outward (e.g. toward the face).
 */
export function surfaceAt(mesh, c, dir, far = 1) {
  mesh.updateWorldMatrix(true, false);
  const worldCentre = c.clone().applyMatrix4(mesh.matrixWorld);
  const d = dir.clone().normalize();
  return projectOnto(mesh, worldCentre.clone().addScaledVector(d, far), worldCentre);
}

/** Place an object on a surface hit, oriented so its local +Z follows the normal. */
export function placeOnSurface(obj, hit, lift = 0) {
  obj.position.copy(hit.point).addScaledVector(hit.normal, lift);
  // basis: z = surface normal, x stays horizontal (so glints / ellipses never roll randomly)
  const z = hit.normal.clone().normalize();
  let x = new THREE.Vector3(0, 1, 0).cross(z);
  if (x.lengthSq() < 1e-6) x.set(1, 0, 0);
  x.normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  return obj;
}

/** Thread tube along points (embroidery, piping). */
export function tube(points, radius = 0.0012, { closed = false, tubular = 64, radial = 6 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  return new THREE.TubeGeometry(curve, tubular, radius, radial, closed);
}

/**
 * Running-stitch seam: short thread dashes along a curve, merged into one geometry.
 * Sits on top of a body seam to sell the "hand-sewn" look.
 */
export function stitches(points, { closed = false, dash = 0.006, gap = 0.004, radius = 0.0009 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  const L = curve.getLength();
  const n = Math.max(2, Math.floor(L / (dash + gap)));
  const parts = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const t0 = (i * (dash + gap)) / L, t1 = Math.min(1, (i * (dash + gap) + dash) / L);
    const a = curve.getPointAt(t0), b = curve.getPointAt(t1);
    const len = a.distanceTo(b);
    if (len < 1e-5) continue;
    const g = new THREE.CapsuleGeometry(radius, len, 2, 5);
    const q = new THREE.Quaternion().setFromUnitVectors(up, b.clone().sub(a).normalize());
    g.applyQuaternion(q);
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    parts.push(g);
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

/** Sample a closed ring on the surface of a mesh: rays from centre in a plane. */
export function surfaceRing(mesh, centre, axisA, axisB, n = 64, lift = 0.0006, filter) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const d = axisA.clone().multiplyScalar(Math.cos(a)).addScaledVector(axisB, Math.sin(a));
    if (filter && !filter(a, d)) continue;
    const hit = surfaceAt(mesh, centre, d);
    pts.push(hit.point.addScaledVector(hit.normal, lift));
  }
  return pts;
}

/** Sample a curve on the surface given a list of directions from the centre. */
export function surfacePath(mesh, centre, dirs, lift = 0.0006) {
  return dirs.map((d) => {
    const hit = surfaceAt(mesh, centre, d);
    return hit.point.addScaledVector(hit.normal, lift);
  });
}

/**
 * Sculpted leaf (felt, double-sided). The outline is obovate by default — broad near the tip,
 * narrowing toward the stalk — like the leaves of 榄仁 Terminalia catappa.
 * Leaf lies along +Y (stalk at origin), facing +Z; `cup` curls the edges, `bend` arches the blade.
 */
export function leaf({ length = 0.06, width = 0.036, cup = 0.006, bend = 0.008, segL = 18, segW = 8, outline } = {}) {
  const prof = outline || ((t) => {
    // obovate: widest at ~0.72 of the length, rounded tip
    const s = Math.sin(Math.PI * Math.pow(t, 0.72));
    return Math.max(0.04, s) * (0.25 + 0.75 * Math.pow(t, 0.55));
  });
  const verts = [], uvs = [], idx = [];
  for (let i = 0; i <= segL; i++) {
    const t = i / segL;
    const half = (width / 2) * prof(t);
    for (let j = 0; j <= segW; j++) {
      const s = j / segW * 2 - 1;
      const x = s * half;
      const y = t * length;
      const z = cup * s * s - bend * Math.sin(Math.PI * t) * 0.6 + bend * t * t;
      verts.push(x, y, z);
      uvs.push(j / segW, t);
    }
  }
  for (let i = 0; i < segL; i++) for (let j = 0; j < segW; j++) {
    const a = i * (segW + 1) + j, b = a + 1, c = a + segW + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Thicken an open sheet into a closed felt slab (front + back + rim) so it casts proper shadows. */
export function thicken(geo, thickness = 0.0016) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  const n = pos.count;
  const front = geo.clone();
  const back = geo.clone();
  const fp = front.attributes.position, bp = back.attributes.position;
  for (let i = 0; i < n; i++) {
    _n.fromBufferAttribute(nor, i);
    fp.setXYZ(i, pos.getX(i) + _n.x * thickness / 2, pos.getY(i) + _n.y * thickness / 2, pos.getZ(i) + _n.z * thickness / 2);
    bp.setXYZ(i, pos.getX(i) - _n.x * thickness / 2, pos.getY(i) - _n.y * thickness / 2, pos.getZ(i) - _n.z * thickness / 2);
  }
  // flip back faces
  const bi = back.index.array.slice();
  for (let i = 0; i < bi.length; i += 3) { const t = bi[i + 1]; bi[i + 1] = bi[i + 2]; bi[i + 2] = t; }
  back.setIndex(Array.from(bi));
  front.computeVertexNormals(); back.computeVertexNormals();
  const merged = mergeGeometries([front, back], false);
  front.dispose(); back.dispose();
  void uv;
  return merged;
}

/** Paint vertex colours with a function (p:Vector3) => THREE.Color. */
export function paint(geo, fn) {
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const c = fn(p);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/** Linear-space colour from hex (vertex colours are linear in three.js). */
export const lin = (hex) => new THREE.Color(hex);

/** Mesh factory that turns on shadows by default. */
export function mesh(geo, mat, name) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  if (name) m.name = name;
  return m;
}

/** Rig pivot (empty group) with a stable name. */
export function pivot(name, parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  if (parent) parent.add(g);
  return g;
}

export { mergeGeometries };

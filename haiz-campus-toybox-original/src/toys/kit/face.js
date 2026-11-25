// HAIZ Campus Toybox — face & detail kit (safety-eye beads, embroidered mouths, felt blush, tush tags).
import * as THREE from 'three';
import { bead, catchLight, felt, thread, canvasCloth } from './materials.js';
import { mesh, surfaceAt, placeOnSurface, tube, surfacePath, pivot } from './shape.js';

const SHARED = {};
const shared = (k, f) => SHARED[k] || (SHARED[k] = f());

/** Features are computed in root space, then re-parented preserving their world transform. */
function attachTo(parent, obj) {
  parent.updateWorldMatrix(true, false);
  obj.updateMatrixWorld(true);
  parent.attach(obj);
  return obj;
}

/**
 * Safety-eye bead placed on a body surface. Returns the eye pivot (scale.y → blink).
 * @param body   Mesh to project onto
 * @param centre Vector3 body centre (same space as body)
 * @param dir    direction from centre to the eye position
 */
export function addEye(parent, body, centre, dir, { r = 0.0062, name = 'eye', color = '#1d1512', flatten = 0.55, sink = 0.35, tilt = 0 } = {}) {
  const hit = surfaceAt(body, centre, dir);
  const eye = pivot(name, null);
  placeOnSurface(eye, hit, -r * sink);
  if (tilt) eye.rotateZ(tilt);
  const g = new THREE.SphereGeometry(r, 20, 14);
  g.scale(1, 1.08, flatten);
  const b = mesh(g, shared('bead' + color, () => bead(color)), name + '_bead');
  b.castShadow = false;
  eye.add(b);
  const cl = mesh(new THREE.SphereGeometry(r * 0.28, 10, 8), shared('cl', catchLight), name + '_glint');
  cl.position.set(-r * 0.32, r * 0.38, r * flatten * 0.9);
  cl.scale.set(1, 1, 0.4);
  cl.castShadow = false;
  eye.add(cl);
  const cl2 = mesh(new THREE.SphereGeometry(r * 0.13, 8, 6), shared('cl', catchLight), name + '_glint2');
  cl2.position.set(r * 0.3, -r * 0.3, r * flatten * 0.92);
  cl2.scale.set(1, 1, 0.4);
  cl2.castShadow = false;
  eye.add(cl2);
  eye.userData.radius = r;
  return attachTo(parent, eye);
}

/** Flat felt blush disc on a surface. */
export function addBlush(parent, body, centre, dir, { rx = 0.008, ry = 0.0055, color = '#f39a83', name = 'blush', opacity = 1 } = {}) {
  const hit = surfaceAt(body, centre, dir);
  const g = new THREE.CircleGeometry(1, 24);
  g.scale(rx, ry, 1);
  const m = felt(color, { name: 'felt_blush', normal: 0.25 });
  if (opacity < 1) { m.transparent = true; m.opacity = opacity; }
  m.polygonOffset = true; m.polygonOffsetFactor = -2;
  const b = mesh(g, m, name);
  b.castShadow = false;
  placeOnSurface(b, hit, 0.0007);
  return attachTo(parent, b);
}

/** Embroidered line following directions from the centre (mouth, brows, whiskers). */
export function addStitchLine(parent, body, centre, dirs, { r = 0.0009, color = '#3b2420', name = 'stitch', lift = 0.0004 } = {}) {
  const pts = surfacePath(body, centre, dirs, lift);
  const m = mesh(tube(pts, r, { tubular: 24, radial: 5 }), shared('thread' + color, () => thread(color)), name);
  m.castShadow = false;
  return attachTo(parent, m);
}

/** Helper: generate face directions from 2D offsets (u right, v up) around a forward axis. */
export function faceDirs(forward, offsets) {
  const f = forward.clone().normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), f).normalize();
  const up = new THREE.Vector3().crossVectors(f, right).normalize();
  return offsets.map(([u, v]) => f.clone().addScaledVector(right, u).addScaledVector(up, v));
}

/** "ω" cat/plush mouth as a sequence of offsets. */
export function omegaMouth(w = 0.12, h = 0.05, cy = -0.12) {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const u = (t * 2 - 1) * w;
    const v = cy - Math.abs(Math.sin(t * Math.PI * 2)) * h;
    pts.push([u, v]);
  }
  return pts;
}

/** Simple smile arc. */
export function smileArc(w = 0.1, h = 0.04, cy = -0.12, n = 12) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([(t * 2 - 1) * w, cy - Math.sin(t * Math.PI) * h]);
  }
  return pts;
}

/**
 * Tush tag — the little sewn fabric label every HAIZ toy carries. Brand consistency + a
 * real-world plush detail that makes the toys feel manufactured with care.
 */
let tagTex = null;
function tagTexture() {
  if (tagTex) return tagTex;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#f7f1e3'; x.fillRect(0, 0, 128, 64);
  x.fillStyle = '#c4533a'; x.fillRect(0, 0, 128, 12);
  x.fillStyle = '#2f4d4a'; x.font = 'bold 26px Georgia, serif'; x.textAlign = 'center';
  x.fillText('HAIZ', 64, 44);
  x.font = '10px sans-serif'; x.fillText('CAMPUS TOYBOX', 64, 58);
  tagTex = new THREE.CanvasTexture(c);
  tagTex.colorSpace = THREE.SRGBColorSpace;
  tagTex.name = 'tex_tush_tag';
  tagTex.userData.canvas = c;
  return tagTex;
}
export function addTag(parent, body, centre, dir, { w = 0.012, h = 0.016, name = 'tag' } = {}) {
  const hit = surfaceAt(body, centre, dir);
  const g = new THREE.PlaneGeometry(w, h, 1, 4);
  // gentle curl
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.pow((p.getY(i) + h / 2) / h, 2) * 0.003);
  g.translate(0, -h / 2, 0);
  g.computeVertexNormals();
  const m = canvasCloth('#ffffff', { name: 'tag_cloth', normal: 0.2 });
  m.map = tagTexture();
  m.side = THREE.DoubleSide;
  const tag = mesh(g, m, name);
  const t = pivot(name + '_pivot', null);
  placeOnSurface(t, hit, 0.0005);
  t.add(tag);
  tag.rotation.x = 0.35;
  return attachTo(parent, t);
}

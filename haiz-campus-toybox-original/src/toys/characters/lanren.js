// 仁仁 Lanren — the Terminalia sprite. Mascot candidate of HAIZ.
//
// Silhouette: a keeled almond-fruit body under a two-tier pagoda crown of obovate leaves —
// exactly how 榄仁 Terminalia catappa grows, with its leaves clustered in whorls at the branch
// tips. One leaf has already turned red, as Terminalia leaves do before they fall in the dry
// season: it is Lanren's tell-tale and moves the most.
import * as THREE from 'three';
import { felt, lacquer, thread } from '../kit/materials.js';
import { woodColor } from '../kit/textures.js';
import { blob, leaf, thicken, mesh, pivot, paint, lin, surfaceRing, stitches, tube, smooth } from '../kit/shape.js';
import { addEye, addBlush, addStitchLine, faceDirs, omegaMouth, addTag } from '../kit/face.js';
import { ToyBehavior, ease, win, Spring } from '../kit/behavior.js';

export const meta = {
  id: 'lanren',
  height: 0.178,
  footprint: 0.06,
  grabHeight: 0.112,
  eyeHeight: 0.075,
};

const C = {
  bodyTop: '#a3c873', bodyBottom: '#d8d27a', foot: '#6f9a52', arm: '#8ab762',
  leafA: '#4d8657', leafB: '#6aa05d', leafRed: '#d4603a', vein: '#efe6c8', blush: '#f19a7f',
};

export function build() {
  const root = new THREE.Group();
  root.name = 'haiz.toy.lanren';
  const nodes = {};
  const base = (nodes.base = pivot('lanren_base', root));
  const centre = new THREE.Vector3(0, 0.06, 0);

  // ── body: almond fruit with a soft keel along its sides
  const rx = 0.046, ry = 0.054, rz = 0.041;
  const g = blob({
    w: 64, h: 44,
    shape: (d) => {
      const egg = 1 + 0.11 * -d.y;          // fuller at the bottom
      const keel = Math.exp(-Math.pow(d.z / 0.16, 2)) * (1 - d.y * d.y) * 0.0032;
      const p = new THREE.Vector3(d.x * rx * egg, d.y * ry, d.z * rz * (1 + 0.05 * -d.y));
      p.x += Math.sign(d.x) * keel;
      if (d.y < -0.85) p.y = -ry * (0.85 + (Math.abs(d.y) - 0.85) * 0.35); // flatten the sitting base
      return p;
    },
  });
  g.translate(centre.x, centre.y, centre.z);
  paint(g, (p) => lin(C.bodyBottom).lerp(lin(C.bodyTop), smooth(0.02, 0.1, p.y)));
  const body = mesh(g, felt('#ffffff', { vertexColors: true, name: 'felt_lanren_body', sheenColor: '#f4ffd8' }), 'lanren_body');
  base.add(body);

  // side seam (the keel) as hand stitching
  const seam = surfaceRing(body, centre, new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0), 80, 0.0008, (a) => true);
  base.add(mesh(stitches(seam, { closed: true, dash: 0.004, gap: 0.003, radius: 0.0007 }), thread('#5e7d43'), 'lanren_seam'));

  // ── face
  const fwd = new THREE.Vector3(0, 0, 1);
  const [eL, eR] = faceDirs(fwd, [[-0.36, 0.26], [0.36, 0.26]]);
  nodes.eyeL = addEye(base, body, centre, eL, { r: 0.0068, name: 'lanren_eyeL' });
  nodes.eyeR = addEye(base, body, centre, eR, { r: 0.0068, name: 'lanren_eyeR' });
  addStitchLine(base, body, centre, faceDirs(fwd, omegaMouth(0.075, 0.035, 0.1)), { name: 'lanren_mouth', r: 0.0008 });
  const [bL, bR] = faceDirs(fwd, [[-0.6, 0.08], [0.6, 0.08]]);
  addBlush(base, body, centre, bL, { name: 'lanren_blushL', color: C.blush });
  addBlush(base, body, centre, bR, { name: 'lanren_blushR', color: C.blush });
  addTag(base, body, centre, new THREE.Vector3(0.35, -0.55, -1), { name: 'lanren_tag' });

  // ── leaf arms
  const armGeo = thicken(leaf({ length: 0.028, width: 0.02, cup: 0.003, bend: 0.002 }), 0.0022);
  const armMat = felt(C.arm, { name: 'felt_lanren_arm' });
  for (const s of [-1, 1]) {
    const a = pivot(s < 0 ? 'lanren_armL' : 'lanren_armR', base, s * 0.043, 0.054, 0.006);
    a.rotation.set(0.15, s * 0.25, s * (Math.PI - 0.75));
    a.add(mesh(armGeo, armMat, a.name + '_mesh'));
    nodes[s < 0 ? 'armL' : 'armR'] = a;
  }

  // ── feet (stay planted; the body squashes above them)
  const footGeo = blob({ rx: 0.012, ry: 0.0075, rz: 0.014, w: 20, h: 14 });
  const footMat = felt(C.foot, { name: 'felt_lanren_foot' });
  for (const s of [-1, 1]) {
    const f = pivot(s < 0 ? 'lanren_footL' : 'lanren_footR', root, s * 0.019, 0.0072, 0.016);
    f.add(mesh(footGeo, footMat, f.name + '_mesh'));
    nodes[s < 0 ? 'footL' : 'footR'] = f;
  }

  // ── twig + pagoda crown
  const wood = lacquer('#ffffff', { map: woodColor('#7a4e33', 4), roughness: 0.6, name: 'wood_lanren_twig' });
  const crown = (nodes.crown = pivot('lanren_crown', base, 0, 0.109, -0.002));
  const twig = tube([new THREE.Vector3(0, -0.004, 0), new THREE.Vector3(0.001, 0.008, 0), new THREE.Vector3(0.003, 0.02, -0.001)], 0.0042, { tubular: 12, radial: 10 });
  crown.add(mesh(twig, wood, 'lanren_twig'));
  const leafMats = [felt(C.leafA, { name: 'felt_leaf_deep' }), felt(C.leafB, { name: 'felt_leaf_fresh' }), felt(C.leafRed, { name: 'felt_leaf_red', sheenColor: '#ffd2b0' })];
  const veinMat = thread(C.vein, { name: 'thread_vein' });
  const makeLeaf = (len, wid) => {
    const sheet = leaf({ length: len, width: wid, cup: wid * 0.16, bend: len * 0.12 });
    const solid = thicken(sheet, 0.0018);
    // midrib vein embroidered on top
    const vein = tube([0.06, 0.35, 0.65, 0.92].map((t) => new THREE.Vector3(0, t * len, wid * 0.16 * 0 - len * 0.12 * Math.sin(Math.PI * t) * 0.6 + len * 0.12 * t * t - 0.0014)), 0.0006, { tubular: 16, radial: 4 });
    sheet.dispose();
    return { solid, vein };
  };
  const big = makeLeaf(0.056, 0.036);
  const small = makeLeaf(0.036, 0.024);
  const whorl1 = pivot('lanren_whorl1', crown, 0.003, 0.018, -0.001);
  nodes.whorl1 = whorl1;
  for (let k = 0; k < 5; k++) {
    const p = pivot('lanren_leaf' + k, whorl1);
    p.rotation.set(1.12 + (k % 2) * 0.08, (k / 5) * Math.PI * 2 + 0.3, 0, 'YXZ');
    const isRed = k === 1;
    p.add(mesh(big.solid, isRed ? leafMats[2] : leafMats[k % 2], p.name + '_mesh'));
    const v = mesh(big.vein, veinMat, p.name + '_vein'); v.castShadow = false; p.add(v);
    nodes['leaf' + k] = p;
  }
  const whorl2 = pivot('lanren_whorl2', crown, 0.003, 0.026, -0.001);
  nodes.whorl2 = whorl2;
  for (let k = 0; k < 3; k++) {
    const p = pivot('lanren_leafTop' + k, whorl2);
    p.rotation.set(0.55, (k / 3) * Math.PI * 2 + 0.9, 0, 'YXZ');
    p.add(mesh(small.solid, leafMats[1 - (k % 2)], p.name + '_mesh'));
    const v = mesh(small.vein, veinMat, p.name + '_vein'); v.castShadow = false; p.add(v);
    nodes['leafTop' + k] = p;
  }
  const bud = mesh(new THREE.SphereGeometry(0.0048, 14, 10), wood, 'lanren_bud');
  bud.position.set(0.003, 0.026, -0.001);
  crown.add(bud);

  return { root, nodes, ...meta };
}

/** Curious, earnest, a little nosy. Moves first with the crown, then the body follows. */
export class Behavior extends ToyBehavior {
  constructor(rig, o) {
    super(rig, { seed: 101, ...o });
    this.crownX = new Spring(90, 9); this.crownZ = new Spring(90, 9);
    this.blinkInterval = 2.2;
  }
  pose(c) {
    const { t, ct, clip, rm } = c;
    let tilt = 0, yaw = c.lookYaw * 0.8, hop = 0, squash = 1, spin = 0, armL = 0, armR = 0, rustle = 0.25, fan = 0;
    const breath = Math.sin(t * 2.1) * 0.012 * rm;

    // curious head-tilt, every ~5 s in idle
    const tiltCycle = (t % 5.3) / 5.3;
    tilt = Math.sin(Math.PI * win(tiltCycle, 0.55, 0.9)) * 0.16 * rm;
    if (clip === 'look') {
      yaw = Math.sin(ct * 1.1) * 0.55;
      tilt = Math.sin(ct * 2.2 + 1) * 0.18;
    }
    if (clip === 'touch') { // startle: duck, leaves fan up
      const k = ease.wobble(ct, 2.2, 3.5);
      squash = 1 - 0.14 * k; fan = Math.max(0, k) * 0.5; armL = armR = 0.6 * ease.bell(ct / 0.8);
    }
    if (clip === 'land') { const k = ease.wobble(ct, 2.6, 4.5); squash = 1 - 0.2 * k; fan = -0.25 * k; }
    if (clip === 'celebrate') {
      hop = Math.max(0, Math.sin(Math.min(ct, 1.6) * Math.PI * 2.5)) * 0.022;
      spin = ease.inOut(win(ct, 0.2, 1.4)) * Math.PI * 2;
      fan = ease.bell(win(ct, 0, 2)) * 0.6;
      armL = armR = 0.9 + Math.sin(ct * 14) * 0.3;
      if (ct > 1.6) { armR = 1.4 + Math.sin(ct * 10) * 0.45; armL = 0.3; } // a little wave
    }
    if (clip === 'signature') { // shake like a wet puppy after rain — leaves whirl
      const k = ease.bell(win(ct, 0.2, 2.4));
      spin = Math.sin(ct * 22) * 0.35 * k;
      rustle = 1.2 * k + 0.25; fan = 0.2 * k;
    }
    if (clip === 'lifted' || c.hang.active) {
      armL = armR = 0.8 + Math.sin(t * 9) * 0.25 * rm;
      fan = -0.35;
      squash = 1.06;
    }
    // follow-through on the crown
    const cx = this.crownX.step(-tilt * 0.6 + (c.hang.swingX || 0) * 1.4 + spin * 0.0, c.dt);
    const cz = this.crownZ.step(-(c.hang.swingZ || 0) * 1.4 + hop * 6, c.dt);

    this.move('base', 0, hop, 0);
    this.rot('base', -c.lookPitch * 0.25, yaw + spin, tilt);
    this.squash('base', squash + breath);
    this.rot('crown', cz * 0.6, 0, cx);
    this.rot('whorl1', 0, Math.sin(t * 0.7) * 0.05, 0);
    for (let k = 0; k < 5; k++) {
      const n = Math.sin(t * (3.1 + k * 0.7) + k * 2.1) * 0.05 + Math.sin(t * 7.3 + k) * 0.02;
      this.rot('leaf' + k, (-fan + n * rustle * (k === 1 ? 2.2 : 1)) * rm, 0, 0);
    }
    for (let k = 0; k < 3; k++) this.rot('leafTop' + k, (-fan * 0.6 + Math.sin(t * 4 + k * 1.7) * 0.05 * rustle) * rm, 0, 0);
    this.rot('armL', 0, 0, -armL); this.rot('armR', 0, 0, armR);
    if (c.hang.active) { this.rot('footL', Math.sin(t * 6) * 0.3, 0, 0); this.rot('footR', -Math.sin(t * 6) * 0.3, 0, 0); }
    const b = Math.max(c.blink, clip === 'land' ? ease.bell(win(ct, 0, 0.25)) : 0);
    this.scl('eyeL', 1, 1 - 0.9 * b, 1); this.scl('eyeR', 1, 1 - 0.9 * b, 1);
    // eyes glance toward the look target before the body turns (anticipation)
    this.move('eyeL', c.lookYaw * 0.0016, c.lookPitch * 0.001, 0); this.move('eyeR', c.lookYaw * 0.0016, c.lookPitch * 0.001, 0);
  }
}

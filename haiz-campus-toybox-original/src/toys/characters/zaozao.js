// 早早 Zaozao — the earnest campus student sprite with an oversized canvas schoolbag.
//
// Silhouette: upright, compact student figure wearing a crisp HAIZ-inspired cream-and-navy
// sailor collar, red neckerchief, round brass spectacles, and a structured canvas backpack
// almost as big as its body (complete with brass buckles and a little yellow notebook peeking out).
import * as THREE from 'three';
import { felt, canvasCloth, brass, lacquer } from '../kit/materials.js';
import { blob, mesh, pivot, tube } from '../kit/shape.js';
import { addEye, addBlush, addStitchLine, faceDirs, smileArc, addTag } from '../kit/face.js';
import { ToyBehavior, ease, win, Spring } from '../kit/behavior.js';

export const meta = {
  id: 'zaozao',
  height: 0.168,
  footprint: 0.06,
  grabHeight: 0.118,
  eyeHeight: 0.11,
};

const C = {
  skin: '#f6e4cc', hair: '#3b3330', uniform: '#f2efe6', navy: '#26415e',
  scarf: '#c94c38', bag: '#345e53', bagTrim: '#d8b982', notebook: '#f2c94c', blush: '#f09a86',
};

export function build() {
  const root = new THREE.Group();
  root.name = 'haiz.toy.zaozao';
  const nodes = {};
  const base = (nodes.base = pivot('zaozao_base', root));

  // ── torso (school shirt + navy shorts)
  const torsoGeo = blob({
    w: 36, h: 28,
    shape: (d) => new THREE.Vector3(d.x * 0.032 * (1 + 0.16 * -d.y), d.y * 0.034, d.z * 0.026 * (1 + 0.12 * -d.y)),
  });
  torsoGeo.translate(0, 0.048, 0);
  const torso = mesh(torsoGeo, canvasCloth(C.uniform, { name: 'cloth_zaozao_shirt' }), 'zaozao_torso');
  base.add(torso);

  const shorts = mesh(new THREE.CylinderGeometry(0.033, 0.035, 0.024, 24), canvasCloth(C.navy, { name: 'cloth_zaozao_navy' }), 'zaozao_shorts');
  shorts.position.set(0, 0.028, 0);
  base.add(shorts);

  // sailor collar + red neckerchief
  const collar = mesh(new THREE.CylinderGeometry(0.028, 0.038, 0.014, 24), canvasCloth(C.navy, { name: 'cloth_zaozao_collar' }), 'zaozao_collar');
  collar.position.set(0, 0.074, 0);
  base.add(collar);
  const scarf = mesh(new THREE.ConeGeometry(0.012, 0.024, 12), felt(C.scarf, { name: 'felt_zaozao_scarf' }), 'zaozao_scarf');
  scarf.rotation.x = Math.PI;
  scarf.scale.set(1, 1, 0.45);
  scarf.position.set(0, 0.06, 0.026);
  base.add(scarf);

  // ── oversized campus canvas backpack (pivots separately for bouncy weight!)
  const bag = (nodes.bag = pivot('zaozao_bag', base, 0, 0.056, -0.024));
  const bagMat = canvasCloth(C.bag, { name: 'cloth_zaozao_bag' });
  const trimMat = felt(C.bagTrim, { name: 'felt_zaozao_trim' });
  const bagBody = mesh(new THREE.BoxGeometry(0.062, 0.064, 0.034, 4, 4, 2), bagMat, 'zaozao_bag_body');
  bagBody.position.set(0, 0, -0.017);
  bag.add(bagBody);
  // top flap
  const flap = mesh(new THREE.BoxGeometry(0.064, 0.022, 0.037), bagMat, 'zaozao_bag_flap');
  flap.position.set(0, 0.026, -0.017);
  bag.add(flap);
  // front pocket + two straps + brass buckles
  const pocket = mesh(new THREE.BoxGeometry(0.044, 0.024, 0.009), trimMat, 'zaozao_bag_pocket');
  pocket.position.set(0, -0.012, -0.036);
  bag.add(pocket);
  const brMat = brass({ name: 'brass_zaozao' });
  for (const s of [-1, 1]) {
    const strap = mesh(new THREE.BoxGeometry(0.008, 0.042, 0.004), trimMat, 'zaozao_strap_' + s);
    strap.position.set(s * 0.017, 0.008, -0.036);
    bag.add(strap);
    const buckle = mesh(new THREE.BoxGeometry(0.01, 0.008, 0.006), brMat, 'zaozao_buckle_' + s);
    buckle.position.set(s * 0.017, -0.004, -0.037);
    bag.add(buckle);
  }
  // little yellow notebook peeking out from the side of the flap
  const book = mesh(new THREE.BoxGeometry(0.018, 0.024, 0.006), lacquer(C.notebook, { name: 'lacquer_notebook' }), 'zaozao_notebook');
  book.position.set(0.02, 0.038, -0.014);
  book.rotation.z = -0.22;
  bag.add(book);
  addTag(bag, bagBody, new THREE.Vector3(0, 0, -0.017), new THREE.Vector3(-0.7, -0.5, -0.8), { name: 'zaozao_tag' });

  // ── head + little bob haircut + brass glasses
  const head = (nodes.head = pivot('zaozao_head', base, 0, 0.112, 0.004));
  const hc = new THREE.Vector3(0, 0, 0);
  const headGeo = blob({ rx: 0.038, ry: 0.035, rz: 0.036, w: 48, h: 32 });
  const headMesh = mesh(headGeo, felt(C.skin, { name: 'felt_zaozao_skin', sheenColor: '#fff5e6' }), 'zaozao_head_mesh');
  head.add(headMesh);

  // cozy felt cap/hair helmet with bangs + ahoge sprout
  const hairGeo = new THREE.SphereGeometry(0.04, 36, 24, 0, Math.PI * 2, 0, Math.PI * 0.56);
  hairGeo.scale(1, 0.94, 1.02);
  const hair = mesh(hairGeo, felt(C.hair, { name: 'felt_zaozao_hair' }), 'zaozao_hair');
  hair.position.set(0, 0.003, -0.003);
  hair.rotation.x = -0.18;
  head.add(hair);
  const ahoge = (nodes.ahoge = pivot('zaozao_ahoge', head, 0, 0.037, 0));
  const ahPts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.004, 0.012, 0.002), new THREE.Vector3(0.012, 0.016, 0.004)];
  ahoge.add(mesh(tube(ahPts, 0.0028, { tubular: 12, radial: 8 }), felt(C.hair, { name: 'felt_zaozao_ahoge' }), 'zaozao_ahoge_mesh'));

  // face
  const fwd = new THREE.Vector3(0, 0, 1);
  const [eL, eR] = faceDirs(fwd, [[-0.33, 0.02], [0.33, 0.02]]);
  nodes.eyeL = addEye(head, headMesh, hc, eL, { r: 0.0056, name: 'zaozao_eyeL' });
  nodes.eyeR = addEye(head, headMesh, hc, eR, { r: 0.0056, name: 'zaozao_eyeR' });
  addStitchLine(head, headMesh, hc, faceDirs(fwd, smileArc(0.09, 0.038, -0.22)), { name: 'zaozao_mouth', r: 0.0008, color: '#5c3329' });
  const [bL, bR] = faceDirs(fwd, [[-0.54, -0.12], [0.54, -0.12]]);
  addBlush(head, headMesh, hc, bL, { name: 'zaozao_blushL', color: C.blush });
  addBlush(head, headMesh, hc, bR, { name: 'zaozao_blushR', color: C.blush });

  // round brass spectacles
  const glasses = (nodes.glasses = pivot('zaozao_glasses', head, 0, 0.001, 0.0375));
  for (const s of [-1, 1]) {
    const rim = mesh(new THREE.TorusGeometry(0.0105, 0.0013, 8, 24), brMat, 'zaozao_rim_' + s);
    rim.position.set(s * 0.013, 0, 0);
    glasses.add(rim);
  }
  const bridge = mesh(new THREE.CylinderGeometry(0.0011, 0.0011, 0.006, 8), brMat, 'zaozao_bridge');
  bridge.rotation.z = Math.PI / 2;
  glasses.add(bridge);

  // ── arms & little canvas shoes
  const armGeo = blob({ rx: 0.0085, ry: 0.019, rz: 0.0085, w: 16, h: 12 });
  armGeo.translate(0, -0.012, 0);
  const armMat = canvasCloth(C.uniform, { name: 'cloth_zaozao_arm' });
  for (const s of [-1, 1]) {
    const a = pivot(s < 0 ? 'zaozao_armL' : 'zaozao_armR', base, s * 0.033, 0.068, 0.004);
    a.rotation.z = s * 0.28;
    a.add(mesh(armGeo, armMat, a.name + '_mesh'));
    nodes[s < 0 ? 'armL' : 'armR'] = a;
  }
  const shoeGeo = blob({ rx: 0.011, ry: 0.008, rz: 0.016, w: 16, h: 12 });
  const shoeMat = canvasCloth(C.navy, { name: 'cloth_zaozao_shoe' });
  for (const s of [-1, 1]) {
    const f = pivot(s < 0 ? 'zaozao_footL' : 'zaozao_footR', root, s * 0.016, 0.0078, 0.008);
    f.add(mesh(shoeGeo, shoeMat, f.name + '_mesh'));
    nodes[s < 0 ? 'footL' : 'footR'] = f;
  }

  return { root, nodes, ...meta };
}

/** Eager, punctual, slightly over-prepared. Bounces on heels, adjusts glasses, bag bobs behind. */
export class Behavior extends ToyBehavior {
  constructor(rig, o) {
    super(rig, { seed: 404, ...o });
    this.bagSpring = new Spring(100, 9);
    this.blinkInterval = 2.0;
  }
  pose(c) {
    const { t, ct, clip, rm } = c;
    const breath = Math.sin(t * 2.6) * 0.012 * rm;
    let hop = Math.max(0, Math.sin(t * 2.6)) * 0.0025 * rm;
    let headYaw = c.lookYaw * 0.85, headPitch = -c.lookPitch * 0.35;
    let armL = 0, armR = 0, squash = 1, glassPush = 0, step = 0;

    if (clip === 'look') { headYaw = Math.sin(ct * 1.4) * 0.6; headPitch = -0.1; }
    if (clip === 'touch') {
      const k = ease.wobble(ct, 3.0, 4);
      squash = 1 - 0.14 * k; armL = armR = 0.7 * ease.bell(ct / 0.8);
    }
    if (clip === 'land') { const k = ease.wobble(ct, 2.8, 4.5); squash = 1 - 0.18 * k; }
    if (clip === 'signature') { // push up glasses earnestly & nod
      const k = ease.bell(win(ct, 0.25, 2.0));
      armR = 1.65 * k;
      glassPush = 0.0025 * ease.bell(win(ct, 0.7, 1.5));
      headPitch = 0.16 * ease.bell(win(ct, 1.5, 2.4));
    }
    if (clip === 'celebrate') { // cheerful march + salute wave
      hop = Math.abs(Math.sin(ct * Math.PI * 3)) * 0.016;
      step = Math.sin(ct * Math.PI * 3) * 0.35;
      armR = 2.2 + Math.sin(ct * 12) * 0.35;
      armL = -step * 0.5;
    }
    if (clip === 'lifted' || c.hang.active) {
      step = Math.sin(t * 10) * 0.45 * rm;
      armL = armR = 0.9 + Math.sin(t * 10) * 0.25 * rm;
    }

    const bagLag = this.bagSpring.step(hop * 14 + (c.hang.swingZ || 0) * 1.2, c.dt);
    this.move('base', 0, hop, 0);
    this.squash('base', squash + breath);
    this.rot('head', headPitch, headYaw, Math.sin(t * 1.3) * 0.05 * rm);
    this.rot('ahoge', 0, 0, Math.sin(t * 5) * 0.12 * rm + hop * 10);
    this.move('glasses', 0, glassPush, 0);
    this.rot('bag', -bagLag * 0.45, 0, (c.hang.swingX || 0) * 0.5);
    this.rot('armL', -armL * 0.8, 0, -armL * 0.35);
    this.rot('armR', -armR * 0.8, 0, armR * 0.35);
    this.rot('footL', step, 0, 0);
    this.rot('footR', -step, 0, 0);
    const b = c.blink;
    this.scl('eyeL', 1, 1 - 0.9 * b, 1); this.scl('eyeR', 1, 1 - 0.9 * b, 1);
  }
}

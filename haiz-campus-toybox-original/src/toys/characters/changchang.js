// 长长 Changchang — the Hainan Gibbon (海南长臂猿) plush.
//
// Silhouette: unmistakable long, expressive articulated plush arms (longer than its body!),
// dark velvety charcoal-slate fur with a warm cream face mask, round monkey ears, a fluffy
// crown tuft, and a bright coral hibiscus blossom tucked behind one ear — celebrating Hainan's
// most precious native primate.
import * as THREE from 'three';
import { plush, felt } from '../kit/materials.js';
import { blob, leaf, thicken, mesh, pivot, tube } from '../kit/shape.js';
import { addEye, addBlush, addStitchLine, faceDirs, smileArc, addTag } from '../kit/face.js';
import { ToyBehavior, ease, win } from '../kit/behavior.js';

export const meta = {
  id: 'changchang',
  height: 0.168,
  footprint: 0.064,
  grabHeight: 0.118,
  eyeHeight: 0.116,
};

const C = {
  fur: '#3d3a42', belly: '#57535e', mask: '#f3dec0', earIn: '#e6be9a',
  hibiscus: '#e45c4b', pollen: '#f6d155', blush: '#f09582',
};

export function build() {
  const root = new THREE.Group();
  root.name = 'haiz.toy.changchang';
  const nodes = {};
  const base = (nodes.base = pivot('changchang_base', root));
  const furMat = plush(C.fur, { name: 'plush_changchang_fur', sheenColor: '#8d889c' });
  const maskMat = felt(C.mask, { name: 'felt_changchang_mask', sheenColor: '#fff8ec' });

  // ── pear-shaped sitting gibbon torso
  const bodyGeo = blob({
    w: 44, h: 32,
    shape: (d) => {
      const p = new THREE.Vector3(d.x * 0.036 * (1 + 0.18 * -d.y), d.y * 0.044, d.z * 0.032 * (1 + 0.14 * -d.y));
      if (d.y < -0.8) p.y = -0.044 * (0.8 + (Math.abs(d.y) - 0.8) * 0.3);
      return p;
    },
  });
  bodyGeo.translate(0, 0.048, 0);
  const body = mesh(bodyGeo, furMat, 'changchang_body');
  base.add(body);
  // softer lighter belly patch
  const belly = mesh(blob({ rx: 0.022, ry: 0.026, rz: 0.012, w: 20, h: 16 }), plush(C.belly, { name: 'plush_changchang_belly' }), 'changchang_belly');
  belly.position.set(0, 0.046, 0.025);
  base.add(belly);
  addTag(base, body, new THREE.Vector3(0, 0.048, 0), new THREE.Vector3(0.4, -0.5, -1), { name: 'changchang_tag' });

  // ── head with cream face mask, round ears, crown tuft & hibiscus flower
  const head = (nodes.head = pivot('changchang_head', base, 0, 0.114, 0.005));
  const hc = new THREE.Vector3(0, 0, 0);
  const headGeo = blob({ rx: 0.037, ry: 0.035, rz: 0.035, w: 44, h: 30 });
  const headMesh = mesh(headGeo, furMat, 'changchang_head_mesh');
  head.add(headMesh);

  // heart-ish cream face mask
  const maskGeo = blob({ rx: 0.029, ry: 0.026, rz: 0.016, w: 32, h: 24 });
  maskGeo.translate(0, -0.002, 0.022);
  const maskMesh = mesh(maskGeo, maskMat, 'changchang_mask');
  head.add(maskMesh);

  // fluffy black crown tuft (signature of black-crested gibbon)
  const tuft = mesh(new THREE.ConeGeometry(0.016, 0.022, 14), furMat, 'changchang_tuft');
  tuft.position.set(0, 0.036, -0.002);
  tuft.rotation.x = -0.15;
  head.add(tuft);

  // round ears
  for (const s of [-1, 1]) {
    const ear = pivot(s < 0 ? 'changchang_earL' : 'changchang_earR', head, s * 0.036, 0.004, -0.002);
    const eo = mesh(new THREE.SphereGeometry(0.011, 16, 12), furMat, ear.name + '_out');
    eo.scale.set(0.9, 1, 0.5);
    ear.add(eo);
    const ei = mesh(new THREE.SphereGeometry(0.007, 12, 10), felt(C.earIn, { name: 'felt_gibbon_ear' }), ear.name + '_in');
    ei.scale.set(0.9, 1, 0.4);
    ei.position.z = 0.003;
    ear.add(ei);
    nodes[s < 0 ? 'earL' : 'earR'] = ear;
  }

  // hibiscus flower tucked behind left ear
  const flower = (nodes.flower = pivot('changchang_flower', head, -0.032, 0.02, 0.008));
  flower.rotation.set(0.25, -0.45, 0.4);
  const petalGeo = thicken(leaf({ length: 0.016, width: 0.012, cup: 0.0018, bend: 0.002 }), 0.0014);
  const hibMat = felt(C.hibiscus, { name: 'felt_hibiscus', sheenColor: '#ffc2b8' });
  for (let i = 0; i < 5; i++) {
    const p = mesh(petalGeo, hibMat, 'changchang_petal_' + i);
    p.rotation.z = (i / 5) * Math.PI * 2;
    flower.add(p);
  }
  flower.add(mesh(new THREE.SphereGeometry(0.0035, 10, 8), felt(C.pollen, { name: 'felt_pollen' }), 'changchang_pollen'));

  // face on the mask
  const maskC = new THREE.Vector3(0, -0.002, 0.022);
  const fwd = new THREE.Vector3(0, 0, 1);
  const [eL, eR] = faceDirs(fwd, [[-0.38, 0.14], [0.38, 0.14]]);
  nodes.eyeL = addEye(head, maskMesh, maskC, eL, { r: 0.0058, name: 'changchang_eyeL' });
  nodes.eyeR = addEye(head, maskMesh, maskC, eR, { r: 0.0058, name: 'changchang_eyeR' });
  addStitchLine(head, maskMesh, maskC, faceDirs(fwd, smileArc(0.14, 0.055, -0.18)), { name: 'changchang_mouth', r: 0.00085, color: '#452b22' });
  const [bL, bR] = faceDirs(fwd, [[-0.6, -0.08], [0.6, -0.08]]);
  addBlush(head, maskMesh, maskC, bL, { name: 'changchang_blushL', color: C.blush, rx: 0.007, ry: 0.0045 });
  addBlush(head, maskMesh, maskC, bR, { name: 'changchang_blushR', color: C.blush, rx: 0.007, ry: 0.0045 });

  // ── signature LONG articulated arms (curved plush noodles with cream paws)
  for (const s of [-1, 1]) {
    const arm = pivot(s < 0 ? 'changchang_armL' : 'changchang_armR', base, s * 0.024, 0.075, 0.002);
    const pts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(s * 0.022, -0.018, 0.008),
      new THREE.Vector3(s * 0.028, -0.048, 0.022),
      new THREE.Vector3(s * 0.014, -0.064, 0.032),
    ];
    arm.add(mesh(new THREE.SphereGeometry(0.0095, 12, 10), furMat, arm.name + '_shoulder'));
    arm.add(mesh(tube(pts, 0.0082, { tubular: 24, radial: 10 }), furMat, arm.name + '_mesh'));
    const hand = mesh(new THREE.SphereGeometry(0.01, 14, 10), maskMat, arm.name + '_hand');
    hand.position.copy(pts[3]);
    arm.add(hand);
    nodes[s < 0 ? 'armL' : 'armR'] = arm;
  }

  // ── seated legs/feet
  const footGeo = blob({ rx: 0.013, ry: 0.009, rz: 0.018, w: 18, h: 12 });
  for (const s of [-1, 1]) {
    const f = pivot(s < 0 ? 'changchang_footL' : 'changchang_footR', root, s * 0.022, 0.009, 0.02);
    f.rotation.y = s * 0.25;
    f.add(mesh(footGeo, maskMat, f.name + '_mesh'));
    nodes[s < 0 ? 'footL' : 'footR'] = f;
  }

  return { root, nodes, ...meta };
}

/** Playful, acrobatic, affectionate. Swings those long arms, peeks playfully, loves to dangle. */
export class Behavior extends ToyBehavior {
  constructor(rig, o) {
    super(rig, { seed: 606, ...o });
    this.blinkInterval = 2.4;
  }
  pose(c) {
    const { t, ct, clip, rm } = c;
    const breath = Math.sin(t * 2.2) * 0.014 * rm;
    let headYaw = c.lookYaw * 0.85, headPitch = -c.lookPitch * 0.3, headRoll = Math.sin(t * 1.4) * 0.07 * rm;
    let armLX = 0, armRX = 0, armLZ = 0, armRZ = 0, squash = 1, hop = 0;

    // gentle playful arm sway in idle
    armLX = Math.sin(t * 1.6) * 0.14 * rm;
    armRX = -Math.sin(t * 1.6) * 0.14 * rm;

    if (clip === 'look') { headYaw = Math.sin(ct * 1.3) * 0.6; armRX = -0.5; }
    if (clip === 'touch') {
      const k = ease.wobble(ct, 2.5, 3.6);
      squash = 1 - 0.15 * k; armLX = armRX = -1.1 * ease.bell(ct / 0.8);
    }
    if (clip === 'land') { const k = ease.wobble(ct, 2.8, 4.4); squash = 1 - 0.18 * k; }
    if (clip === 'signature') { // peek-a-boo / big canopy swing!
      const k = ease.bell(win(ct, 0.2, 2.5));
      armLX = -2.2 * k + Math.sin(ct * 7) * 0.35 * k;
      armRX = -2.2 * k - Math.sin(ct * 7) * 0.35 * k;
      armLZ = -0.35 * k; armRZ = 0.35 * k;
      hop = Math.max(0, Math.sin(ct * Math.PI * 2)) * 0.014 * k;
    }
    if (clip === 'celebrate') { // joyous overhead two-arm wave!
      hop = Math.max(0, Math.sin(ct * Math.PI * 3)) * 0.02;
      armLX = -2.6; armRX = -2.6;
      armLZ = -0.3 + Math.sin(ct * 10) * 0.35;
      armRZ = 0.3 - Math.sin(ct * 10) * 0.35;
    }
    if (clip === 'lifted' || c.hang.active) { // loves hanging — arms reach up happily
      armLX = -2.3 + Math.sin(t * 5) * 0.2 * rm;
      armRX = -2.3 - Math.sin(t * 5) * 0.2 * rm;
      squash = 1.06;
    }

    this.move('base', 0, hop, 0);
    this.squash('base', squash + breath);
    this.rot('head', headPitch, headYaw, headRoll);
    this.rot('flower', 0, 0, Math.sin(t * 3.5) * 0.08 * rm);
    this.rot('armL', armLX, 0, armLZ);
    this.rot('armR', armRX, 0, armRZ);
    const b = c.blink;
    this.scl('eyeL', 1, 1 - 0.9 * b, 1); this.scl('eyeR', 1, 1 - 0.9 * b, 1);
  }
}

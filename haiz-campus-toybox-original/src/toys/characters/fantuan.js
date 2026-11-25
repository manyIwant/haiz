// 饭团 Fantuan — the campus calico loaf-cat.
//
// Silhouette: a low, wide sitting/loafing cat with a rounded pear torso, distinct triangular
// ears (the right ear carries a tiny TNR notch — a loving detail of real campus cats), a curved
// plush tail that wraps around the side, and a crimson cord with a tiny brass bell.
import * as THREE from 'three';
import { plush, felt, brass, thread } from '../kit/materials.js';
import { blob, mesh, pivot, paint, lin, tube, smooth } from '../kit/shape.js';
import { addEye, addBlush, addStitchLine, faceDirs, omegaMouth, addTag } from '../kit/face.js';
import { ToyBehavior, ease, win, Spring } from '../kit/behavior.js';

export const meta = {
  id: 'fantuan',
  height: 0.145,
  footprint: 0.068,
  grabHeight: 0.098,
  eyeHeight: 0.082,
};

const C = {
  cream: '#f6efe0', ginger: '#d98344', charcoal: '#3a3433',
  earInner: '#efb2a8', collar: '#c44536', nose: '#e08982', blush: '#f0a294',
};

export function build() {
  const root = new THREE.Group();
  root.name = 'haiz.toy.fantuan';
  const nodes = {};
  const base = (nodes.base = pivot('fantuan_base', root));

  // ── plump loaf body
  const bodyCentre = new THREE.Vector3(0, 0.044, -0.006);
  const bodyGeo = blob({
    w: 56, h: 40,
    shape: (d) => {
      const rx = 0.049, ry = 0.042, rz = 0.056;
      const pear = 1 + 0.14 * -d.y;
      const p = new THREE.Vector3(d.x * rx * pear, d.y * ry, d.z * rz * (1 + 0.08 * -d.y));
      if (d.y < -0.78) p.y = -ry * (0.78 + (Math.abs(d.y) - 0.78) * 0.25);
      return p;
    },
  });
  bodyGeo.translate(bodyCentre.x, bodyCentre.y, bodyCentre.z);
  paint(bodyGeo, (p) => {
    // calico patches: ginger saddle on right-back, charcoal spot on left-hip
    const gPatch = smooth(0.04, 0.015, Math.hypot(p.x - 0.032, p.y - 0.055, p.z + 0.025));
    const cPatch = smooth(0.038, 0.015, Math.hypot(p.x + 0.034, p.y - 0.042, p.z + 0.02));
    return lin(C.cream).lerp(lin(C.ginger), gPatch).lerp(lin(C.charcoal), cPatch);
  });
  const body = mesh(bodyGeo, plush('#ffffff', { vertexColors: true, name: 'plush_fantuan_body', sheenColor: '#fffaf0' }), 'fantuan_body');
  base.add(body);
  addTag(base, body, bodyCentre, new THREE.Vector3(0.4, -0.4, -1), { name: 'fantuan_tag' });

  // ── separate articulated cat head (slightly forward & tilted)
  const head = (nodes.head = pivot('fantuan_head', base, 0, 0.088, 0.016));
  const headCentre = new THREE.Vector3(0, 0.008, 0);
  const headGeo = blob({
    w: 52, h: 36,
    shape: (d) => {
      const rx = 0.044, ry = 0.036, rz = 0.038;
      // chubby cheeks low on the sides
      const cheek = Math.exp(-Math.pow((d.y + 0.22) / 0.35, 2)) * (1 - Math.abs(d.z)) * 0.0045;
      return new THREE.Vector3(d.x * rx + Math.sign(d.x) * cheek, d.y * ry, d.z * rz);
    },
  });
  headGeo.translate(headCentre.x, headCentre.y, headCentre.z);
  paint(headGeo, (p) => {
    // classic calico forehead patches: ginger over left eye, charcoal over right ear
    const gMask = smooth(0.036, 0.014, Math.hypot(p.x + 0.024, p.y - 0.028, p.z - 0.012));
    const cMask = smooth(0.034, 0.014, Math.hypot(p.x - 0.026, p.y - 0.03, p.z - 0.008));
    return lin(C.cream).lerp(lin(C.ginger), gMask).lerp(lin(C.charcoal), cMask);
  });
  const headMesh = mesh(headGeo, plush('#ffffff', { vertexColors: true, name: 'plush_fantuan_head', sheenColor: '#fffaf0' }), 'fantuan_head_mesh');
  head.add(headMesh);

  // ── cat ears (left ginger, right charcoal with subtle campus TNR ear-tip clip)
  const makeEar = (isRight, color) => {
    const ear = pivot(isRight ? 'fantuan_earR' : 'fantuan_earL', head, isRight ? 0.027 : -0.027, 0.033, -0.003);
    ear.rotation.set(0.08, isRight ? -0.2 : 0.2, isRight ? -0.34 : 0.34);
    const eg = new THREE.ConeGeometry(0.014, isRight ? 0.022 : 0.025, 16);
    eg.scale(1, 1, 0.55);
    eg.translate(0, 0.011, 0);
    ear.add(mesh(eg, plush(color, { name: 'plush_ear_' + color }), ear.name + '_outer'));
    const ig = new THREE.ConeGeometry(0.0085, 0.015, 12);
    ig.scale(1, 1, 0.35);
    ig.translate(0, 0.009, 0.0038);
    ear.add(mesh(ig, felt(C.earInner, { name: 'felt_ear_inner' }), ear.name + '_inner'));
    return ear;
  };
  nodes.earL = makeEar(false, C.ginger);
  nodes.earR = makeEar(true, C.charcoal);

  // ── face on head
  const fwd = new THREE.Vector3(0, 0, 1);
  const [eL, eR] = faceDirs(fwd, [[-0.36, 0.08], [0.36, 0.08]]);
  nodes.eyeL = addEye(head, headMesh, headCentre, eL, { r: 0.0064, name: 'fantuan_eyeL', color: '#241a12' });
  nodes.eyeR = addEye(head, headMesh, headCentre, eR, { r: 0.0064, name: 'fantuan_eyeR', color: '#241a12' });
  // tiny pink triangle nose
  const nose = mesh(new THREE.SphereGeometry(0.0038, 12, 10), felt(C.nose, { name: 'felt_fantuan_nose' }), 'fantuan_nose');
  nose.scale.set(1.2, 0.8, 0.6);
  nose.position.set(0, 0.003, 0.0375);
  head.add(nose);
  addStitchLine(head, headMesh, headCentre, faceDirs(fwd, omegaMouth(0.095, 0.042, -0.15)), { name: 'fantuan_mouth', r: 0.0008, color: '#402e28' });
  // whiskers (2 per side)
  for (const s of [-1, 1]) {
    addStitchLine(head, headMesh, headCentre, faceDirs(fwd, [[s * 0.45, -0.08], [s * 0.72, -0.05]]), { name: 'fantuan_w1_' + s, r: 0.00055, color: '#594842' });
    addStitchLine(head, headMesh, headCentre, faceDirs(fwd, [[s * 0.46, -0.18], [s * 0.72, -0.2]]), { name: 'fantuan_w2_' + s, r: 0.00055, color: '#594842' });
  }
  const [bL, bR] = faceDirs(fwd, [[-0.56, -0.06], [0.56, -0.06]]);
  addBlush(head, headMesh, headCentre, bL, { name: 'fantuan_blushL', color: C.blush });
  addBlush(head, headMesh, headCentre, bR, { name: 'fantuan_blushR', color: C.blush });

  // ── collar + brass bell
  const collar = mesh(new THREE.TorusGeometry(0.031, 0.0042, 10, 28), felt(C.collar, { name: 'felt_fantuan_collar' }), 'fantuan_collar');
  collar.position.set(0, 0.067, 0.011);
  collar.rotation.x = Math.PI / 2 + 0.14;
  base.add(collar);
  const bell = (nodes.bell = pivot('fantuan_bell', base, 0, 0.058, 0.044));
  bell.add(mesh(new THREE.SphereGeometry(0.0068, 16, 12), brass({ name: 'brass_bell' }), 'fantuan_bell_mesh'));

  // ── tucked front paws
  const pawGeo = blob({ rx: 0.013, ry: 0.009, rz: 0.016, w: 18, h: 14 });
  const pawMat = plush(C.cream, { name: 'plush_fantuan_paw' });
  for (const s of [-1, 1]) {
    const p = pivot(s < 0 ? 'fantuan_pawL' : 'fantuan_pawR', base, s * 0.02, 0.01, 0.044);
    p.add(mesh(pawGeo, pawMat, p.name + '_mesh'));
    nodes[s < 0 ? 'pawL' : 'pawR'] = p;
  }

  // ── plush sweeping tail
  const tail = (nodes.tail = pivot('fantuan_tail', base, 0, 0.022, -0.052));
  const tailPts = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.018, 0.01, -0.022),
    new THREE.Vector3(0.042, 0.028, -0.014),
    new THREE.Vector3(0.052, 0.052, 0.004),
  ];
  const tailGeo = tube(tailPts, 0.0085, { tubular: 24, radial: 10 });
  paint(tailGeo, (p) => lin(C.ginger).lerp(lin(C.charcoal), smooth(0.02, 0.045, p.y)));
  tail.add(mesh(tailGeo, plush('#ffffff', { vertexColors: true, name: 'plush_fantuan_tail' }), 'fantuan_tail_mesh'));
  const tip = mesh(new THREE.SphereGeometry(0.0086, 12, 10), plush(C.charcoal, { name: 'plush_tail_tip' }), 'fantuan_tail_tip');
  tip.position.copy(tailPts[3]);
  tail.add(tip);

  return { root, nodes, ...meta };
}

/** Unbothered, regal campus cat. Lazy tail sweeps, occasional ear twitch, slow affectionate blinks. */
export class Behavior extends ToyBehavior {
  constructor(rig, o) {
    super(rig, { seed: 303, ...o });
    this.tailSpring = new Spring(60, 7);
    this.blinkInterval = 3.8;
  }
  pose(c) {
    const { t, ct, clip, rm } = c;
    const purr = Math.sin(t * 1.9) * 0.015 * rm;
    let headYaw = c.lookYaw * 0.75, headPitch = -c.lookPitch * 0.35, headRoll = 0;
    let tailWag = Math.sin(t * 1.6) * 0.25 * rm;
    let earFlick = 0, squash = 1, hop = 0, pawLift = 0;

    // periodic cat ear twitch
    const ec = t % 4.7;
    if (ec > 4.2 && ec < 4.55) earFlick = Math.sin(((ec - 4.2) / 0.35) * Math.PI * 2) * 0.28 * rm;

    if (clip === 'look') { headYaw = Math.sin(ct * 1.0) * 0.55; headRoll = Math.sin(ct * 1.0) * 0.14; }
    if (clip === 'touch') {
      const k = ease.wobble(ct, 2.5, 4);
      squash = 1 - 0.15 * k; earFlick = 0.4 * ease.bell(ct / 0.7); tailWag = 0.6 * k;
    }
    if (clip === 'land') { const k = ease.wobble(ct, 2.8, 4.5); squash = 1 - 0.18 * k; }
    if (clip === 'signature') { // grooming / paw-licking bob
      const k = ease.bell(win(ct, 0.2, 2.5));
      headPitch = 0.28 * k + Math.sin(ct * 9) * 0.08 * k;
      pawLift = 0.75 * k;
    }
    if (clip === 'celebrate') { // happy kneading + purr bounce + bell jingle
      hop = Math.max(0, Math.sin(ct * Math.PI * 2.5)) * 0.014;
      pawLift = 0.45 + Math.sin(ct * 11) * 0.25;
      tailWag = Math.sin(ct * 8) * 0.45;
      headRoll = Math.sin(ct * 4) * 0.16;
    }
    if (clip === 'lifted' || c.hang.active) { // classic scruff-carried cat dangle
      squash = 1.1; headPitch = 0.14;
      tailWag = (c.hang.swingX || 0) * 1.2 + Math.sin(t * 3) * 0.15;
    }

    this.move('base', 0, hop, 0);
    this.squash('base', squash + purr);
    this.rot('head', headPitch, headYaw, headRoll);
    this.rot('earR', 0, 0, earFlick);
    this.rot('tail', 0, tailWag, tailWag * 0.4);
    this.rot('bell', 0, 0, Math.sin(t * 6) * (hop > 0.002 ? 0.5 : 0.05));
    this.move('pawR', 0, pawLift * 0.025, pawLift * 0.01);
    this.rot('pawR', -pawLift * 0.9, 0, 0);
    if (clip === 'celebrate') {
      this.move('pawL', 0, (0.45 - Math.sin(ct * 11) * 0.25) * 0.02, 0);
    }
    const b = c.blink;
    this.scl('eyeL', 1, 1 - 0.9 * b, 1); this.scl('eyeR', 1, 1 - 0.9 * b, 1);
  }
}

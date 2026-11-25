// 午午 Wuwu — Hainan afternoon sun-nap sprite.
//
// Silhouette: a plump, slightly squashed sun-cushion body ringed by 10 stitched marigold felt
// rays, wearing a tilted miniature woven straw sun-hat. Soft, warm, drowsy, radiating 3 p.m.
// Hainan courtyard sunshine.
import * as THREE from 'three';
import { felt, plush, canvasCloth, thread } from '../kit/materials.js';
import { blob, leaf, thicken, mesh, pivot, paint, lin, surfaceRing, stitches, smooth } from '../kit/shape.js';
import { addEye, addBlush, addStitchLine, faceDirs, smileArc, addTag } from '../kit/face.js';
import { ToyBehavior, ease, win, Spring } from '../kit/behavior.js';

export const meta = {
  id: 'wuwu',
  height: 0.155,
  footprint: 0.068,
  grabHeight: 0.105,
  eyeHeight: 0.068,
};

const C = {
  bodyTop: '#ffcf6e', bodyBottom: '#f7a94b', rayA: '#f59838', rayB: '#ffd978',
  hat: '#e6c98e', ribbon: '#d45a3d', blush: '#f07f66', foot: '#d9843b',
};

export function build() {
  const root = new THREE.Group();
  root.name = 'haiz.toy.wuwu';
  const nodes = {};
  const base = (nodes.base = pivot('wuwu_base', root));
  const centre = new THREE.Vector3(0, 0.062, 0);

  // ── plump cushion-like sun body (wider than tall, soft front-back pillow pinch)
  const g = blob({
    w: 56, h: 40,
    shape: (d) => {
      const rx = 0.052, ry = 0.048, rz = 0.036;
      const puff = 1 + 0.08 * Math.cos(d.y * Math.PI);
      const p = new THREE.Vector3(d.x * rx * puff, d.y * ry, d.z * rz * (1 + 0.08 * -d.y));
      if (d.y < -0.82) p.y = -ry * (0.82 + (Math.abs(d.y) - 0.82) * 0.35);
      return p;
    },
  });
  g.translate(centre.x, centre.y, centre.z);
  paint(g, (p) => lin(C.bodyBottom).lerp(lin(C.bodyTop), smooth(0.02, 0.105, p.y)));
  const body = mesh(g, plush('#ffffff', { vertexColors: true, name: 'plush_wuwu_body', sheenColor: '#fff5c4' }), 'wuwu_body');
  base.add(body);

  // perimeter running-stitch seam around the pillow edge
  const seam = surfaceRing(body, centre, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), 72, 0.0007);
  base.add(mesh(stitches(seam, { closed: true, dash: 0.0042, gap: 0.0032, radius: 0.0007 }), thread('#b86826'), 'wuwu_seam'));

  // ── 10 scalloped felt sun-rays arranged as a warm halo collar
  const rayRing = (nodes.rayRing = pivot('wuwu_rayRing', base, 0, 0.064, -0.004));
  const rayGeo = thicken(leaf({
    length: 0.028, width: 0.022, cup: 0.002, bend: 0.002,
    outline: (t) => Math.sin(Math.PI * Math.pow(t, 0.65)) * (0.45 + 0.55 * (1 - t * 0.4)),
  }), 0.0034);
  const rayMatA = felt(C.rayA, { name: 'felt_wuwu_rayA', sheenColor: '#ffe8a3' });
  const rayMatB = felt(C.rayB, { name: 'felt_wuwu_rayB', sheenColor: '#fff8d4' });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.12;
    const p = pivot('wuwu_ray' + i, rayRing);
    p.position.set(Math.cos(a) * 0.044, Math.sin(a) * 0.041, 0);
    p.rotation.z = a - Math.PI / 2;
    p.rotation.x = 0.08 * (i % 2 ? 1 : -1);
    p.add(mesh(rayGeo, i % 2 ? rayMatB : rayMatA, p.name + '_mesh'));
    nodes['ray' + i] = p;
  }

  // ── sleepy, cosy face: slightly lower eyes, gentle smile, rosy cheeks
  const fwd = new THREE.Vector3(0, 0, 1);
  const [eL, eR] = faceDirs(fwd, [[-0.34, 0.14], [0.34, 0.14]]);
  nodes.eyeL = addEye(base, body, centre, eL, { r: 0.006, name: 'wuwu_eyeL', flatten: 0.5 });
  nodes.eyeR = addEye(base, body, centre, eR, { r: 0.006, name: 'wuwu_eyeR', flatten: 0.5 });
  // tiny drowsy eyelids (soft felt crescents resting on top of the beads)
  const lidMat = felt('#f5ba58', { name: 'felt_wuwu_lid' });
  const lidGeo = new THREE.SphereGeometry(0.0064, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.44);
  lidGeo.scale(1.06, 1.0, 0.62);
  for (const [k, eye] of [['lidL', nodes.eyeL], ['lidR', nodes.eyeR]]) {
    const l = mesh(lidGeo, lidMat, 'wuwu_' + k);
    l.position.set(0, 0.0005, 0.0004);
    l.rotation.x = 0.35;
    eye.add(l);
    nodes[k] = l;
  }
  addStitchLine(base, body, centre, faceDirs(fwd, smileArc(0.095, 0.032, -0.04)), { name: 'wuwu_mouth', r: 0.00085, color: '#6b3a1e' });
  const [bL, bR] = faceDirs(fwd, [[-0.56, -0.02], [0.56, -0.02]]);
  addBlush(base, body, centre, bL, { name: 'wuwu_blushL', color: C.blush, rx: 0.01, ry: 0.0065 });
  addBlush(base, body, centre, bR, { name: 'wuwu_blushR', color: C.blush, rx: 0.01, ry: 0.0065 });
  addTag(base, body, centre, new THREE.Vector3(-0.35, -0.5, -1), { name: 'wuwu_tag' });

  // ── tilted woven straw sun-hat with terracotta ribbon
  const hat = (nodes.hat = pivot('wuwu_hat', base, 0.014, 0.106, 0.002));
  hat.rotation.set(0.12, 0.1, -0.26);
  const hatMat = canvasCloth(C.hat, { name: 'cloth_wuwu_hat', normal: 0.65 });
  const brim = new THREE.CylinderGeometry(0.035, 0.039, 0.0035, 28);
  const crown = new THREE.CylinderGeometry(0.017, 0.022, 0.016, 24);
  crown.translate(0, 0.009, 0);
  hat.add(mesh(brim, hatMat, 'wuwu_hat_brim'));
  hat.add(mesh(crown, hatMat, 'wuwu_hat_crown'));
  const rib = new THREE.CylinderGeometry(0.0218, 0.0226, 0.0045, 24);
  rib.translate(0, 0.004, 0);
  hat.add(mesh(rib, felt(C.ribbon, { name: 'felt_wuwu_ribbon' }), 'wuwu_hat_ribbon'));

  // ── stubby cozy arms & little feet
  const armGeo = blob({ rx: 0.011, ry: 0.016, rz: 0.01, w: 18, h: 14 });
  const armMat = plush('#f6b454', { name: 'plush_wuwu_arm' });
  for (const s of [-1, 1]) {
    const a = pivot(s < 0 ? 'wuwu_armL' : 'wuwu_armR', base, s * 0.048, 0.056, 0.015);
    a.rotation.set(0.2, 0, s * 0.45);
    a.add(mesh(armGeo, armMat, a.name + '_mesh'));
    nodes[s < 0 ? 'armL' : 'armR'] = a;
  }
  const footGeo = blob({ rx: 0.013, ry: 0.008, rz: 0.015, w: 18, h: 14 });
  const footMat = felt(C.foot, { name: 'felt_wuwu_foot' });
  for (const s of [-1, 1]) {
    const f = pivot(s < 0 ? 'wuwu_footL' : 'wuwu_footR', root, s * 0.021, 0.0075, 0.014);
    f.add(mesh(footGeo, footMat, f.name + '_mesh'));
    nodes[s < 0 ? 'footL' : 'footR'] = f;
  }

  return { root, nodes, ...meta };
}

/** Warm, drowsy, unhurried. Slow belly-breathing, gentle nodding, big cosy stretches. */
export class Behavior extends ToyBehavior {
  constructor(rig, o) {
    super(rig, { seed: 202, ...o });
    this.hatLag = new Spring(70, 8);
    this.blinkInterval = 3.4;
  }
  pose(c) {
    const { t, ct, clip, rm } = c;
    const breath = Math.sin(t * 1.4) * 0.022 * rm; // slow deep nap breath
    let nod = Math.sin(t * 0.7) * 0.06 * rm;
    let sway = Math.sin(t * 0.55) * 0.05 * rm;
    let yaw = c.lookYaw * 0.55;
    let squash = 1, hop = 0, stretch = 0, rayPulse = 0.04;

    if (clip === 'look') { yaw = Math.sin(ct * 0.8) * 0.45; nod = -0.08; }
    if (clip === 'touch') {
      const k = ease.wobble(ct, 2.0, 3.4);
      squash = 1 - 0.16 * k; sway = 0.15 * k; rayPulse = 0.14;
    }
    if (clip === 'land') { const k = ease.wobble(ct, 2.2, 4.0); squash = 1 - 0.22 * k; }
    if (clip === 'signature') { // big lazy afternoon stretch + yawn
      stretch = ease.bell(win(ct, 0.25, 2.4));
      squash = 1 + 0.12 * stretch;
      nod = -0.14 * stretch;
      rayPulse = 0.16 * stretch;
    }
    if (clip === 'celebrate') {
      hop = Math.max(0, Math.sin(Math.min(ct, 1.5) * Math.PI * 2)) * 0.018;
      stretch = ease.bell(win(ct, 0.2, 2.2));
      rayPulse = 0.18;
      sway = Math.sin(ct * 6) * 0.12;
    }
    if (clip === 'lifted' || c.hang.active) {
      squash = 1.07; sway = (c.hang.swingX || 0) * 0.6;
      stretch = 0.35;
    }

    const hl = this.hatLag.step(-sway * 0.8 + hop * 8, c.dt);
    this.move('base', 0, hop, 0);
    this.rot('base', nod - c.lookPitch * 0.2, yaw, sway);
    this.squash('base', squash + breath);
    this.rot('hat', hl * 0.4, 0, hl * 0.7);
    this.rot('rayRing', 0, 0, Math.sin(t * 0.4) * 0.08 * rm);
    for (let i = 0; i < 10; i++) {
      const s = 1 + Math.sin(t * 2.1 + i * 0.62) * rayPulse * rm;
      this.scl('ray' + i, s, s, 1);
    }
    this.rot('armL', -stretch * 0.9, 0, -stretch * 0.7);
    this.rot('armR', -stretch * 0.9, 0, stretch * 0.7);
    const b = Math.max(c.blink, stretch * 0.75);
    this.scl('eyeL', 1, 1 - 0.88 * b, 1); this.scl('eyeR', 1, 1 - 0.88 * b, 1);
  }
}

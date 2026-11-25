// 潮潮 Chaochao — the Hainan tide & sea-glass jellyfish sprite.
//
// Silhouette: a translucent frosted sea-glass bell dome with a soft scalloped rim, a miniature
// ceramic conch shell perched jauntily on top, and 6 flowing ribbon-like felt tentacles that
// form a graceful skirt and sway like underwater kelp.
import * as THREE from 'three';
import { seaGlass, felt, lacquer } from '../kit/materials.js';
import { blob, lathe, leaf, thicken, mesh, pivot } from '../kit/shape.js';
import { addEye, addBlush, addStitchLine, faceDirs, smileArc } from '../kit/face.js';
import { ToyBehavior, ease, win, Spring } from '../kit/behavior.js';

export const meta = {
  id: 'chaochao',
  height: 0.165,
  footprint: 0.06,
  grabHeight: 0.118,
  eyeHeight: 0.098,
};

const C = {
  bell: '#77c7c2', inner: '#d9f4f0', skirtA: '#8fd5cf', skirtB: '#c5ebe5',
  conch: '#f2c8b0', blush: '#f4a498',
};

export function build() {
  const root = new THREE.Group();
  root.name = 'haiz.toy.chaochao';
  const nodes = {};
  const base = (nodes.base = pivot('chaochao_base', root));

  // ── inner opaque plush core (holds the face cleanly behind/inside the frosted bell)
  const coreCentre = new THREE.Vector3(0, 0.094, 0);
  const coreGeo = blob({ rx: 0.037, ry: 0.034, rz: 0.036, w: 44, h: 30 });
  coreGeo.translate(coreCentre.x, coreCentre.y, coreCentre.z);
  const core = mesh(coreGeo, felt(C.inner, { name: 'felt_chaochao_core', sheenColor: '#ffffff' }), 'chaochao_core');
  base.add(core);

  // ── translucent frosted sea-glass jellyfish umbrella dome
  const bellGeo = lathe([
    [0.001, 0.056],
    [0.025, 0.054],
    [0.044, 0.042],
    [0.054, 0.018],
    [0.056, 0.002],
    [0.048, -0.002],
    [0.042, 0.004],
  ], { segments: 48, samples: 36 });
  bellGeo.translate(0, 0.088, 0);
  // subtle scalloped ruffle around the bottom rim
  const bp = bellGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i);
    if (y < 0.102) {
      const ang = Math.atan2(z, x);
      const w = Math.max(0, (0.102 - y) / 0.016);
      bp.setY(i, y + Math.sin(ang * 8) * 0.0038 * w);
    }
  }
  bellGeo.computeVertexNormals();
  const bellMat = seaGlass(C.bell, { name: 'seaglass_chaochao_bell', opacity: 0.72, roughness: 0.25, emissiveIntensity: 0.14 });
  const bell = mesh(bellGeo, bellMat, 'chaochao_bell');
  base.add(bell);

  // ── tiny lacquered spiral conch perched on the crown
  const conch = (nodes.conch = pivot('chaochao_conch', base, -0.016, 0.142, 0.004));
  conch.rotation.set(0.15, 0.3, 0.42);
  const conchMat = lacquer(C.conch, { name: 'lacquer_chaochao_conch', roughness: 0.32 });
  for (let i = 0; i < 4; i++) {
    const r = 0.012 * Math.pow(0.74, i);
    const s = mesh(new THREE.SphereGeometry(r, 14, 12), conchMat, 'chaochao_conch_' + i);
    s.position.set(i * 0.0055, i * 0.0035, 0);
    s.scale.set(1.1, 0.92, 0.92);
    conch.add(s);
  }

  // ── face on the front of the luminous core
  const fwd = new THREE.Vector3(0, 0, 1);
  const [eL, eR] = faceDirs(fwd, [[-0.34, 0.0], [0.34, 0.0]]);
  nodes.eyeL = addEye(base, core, coreCentre, eL, { r: 0.0062, name: 'chaochao_eyeL', color: '#1b353c' });
  nodes.eyeR = addEye(base, core, coreCentre, eR, { r: 0.0062, name: 'chaochao_eyeR', color: '#1b353c' });
  addStitchLine(base, core, coreCentre, faceDirs(fwd, smileArc(0.08, 0.028, -0.22)), { name: 'chaochao_mouth', r: 0.00075, color: '#2b5e63' });
  const [bL, bR] = faceDirs(fwd, [[-0.55, -0.14], [0.55, -0.14]]);
  addBlush(base, core, coreCentre, bL, { name: 'chaochao_blushL', color: C.blush });
  addBlush(base, core, coreCentre, bR, { name: 'chaochao_blushR', color: C.blush });

  // ── 6 ribbon-like felt tentacles forming a standing skirt
  const tentGeo = thicken(leaf({
    length: 0.068, width: 0.017, cup: 0.0025, bend: 0.009,
    outline: (t) => 0.45 + 0.55 * Math.sin(Math.PI * Math.pow(t, 0.7)),
  }), 0.0024);
  const matA = felt(C.skirtA, { name: 'felt_chaochao_tentA', sheenColor: '#e8fffa' });
  const matB = felt(C.skirtB, { name: 'felt_chaochao_tentB', sheenColor: '#ffffff' });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.25;
    const p = pivot('chaochao_tent' + i, base, Math.cos(a) * 0.028, 0.068, Math.sin(a) * 0.028);
    p.rotation.set(Math.PI - 0.14, -a + Math.PI / 2, 0, 'YXZ');
    p.add(mesh(tentGeo, i % 2 ? matB : matA, p.name + '_mesh'));
    nodes['tent' + i] = p;
  }

  return { root, nodes, ...meta };
}

/** Dreamy, buoyant, rhythmic like gentle tide swells. */
export class Behavior extends ToyBehavior {
  constructor(rig, o) {
    super(rig, { seed: 505, ...o });
    this.trailSpring = new Spring(55, 6);
    this.blinkInterval = 3.0;
  }
  pose(c) {
    const { t, ct, clip, rm } = c;
    const swell = Math.sin(t * 1.8) * 0.005 * rm;
    let hover = swell, yaw = c.lookYaw * 0.7, roll = Math.sin(t * 1.1) * 0.05 * rm;
    let squash = 1, pulse = 0.08, spin = 0;

    if (clip === 'look') { yaw = Math.sin(ct * 1.0) * 0.5; roll = Math.sin(ct * 1.0) * 0.12; }
    if (clip === 'touch') {
      const k = ease.wobble(ct, 2.2, 3.2);
      squash = 1 - 0.16 * k; pulse = 0.28;
    }
    if (clip === 'land') { const k = ease.wobble(ct, 2.4, 3.8); squash = 1 - 0.2 * k; }
    if (clip === 'signature') { // jellyfish propulsion pulse!
      const k = ease.bell(win(ct, 0.15, 2.4));
      hover = 0.022 * k;
      squash = 1 + 0.14 * Math.sin(ct * Math.PI * 2.5) * k;
      pulse = 0.35 * k;
    }
    if (clip === 'celebrate') {
      hover = 0.018 * ease.bell(win(ct, 0, 2.2)) + Math.sin(ct * 6) * 0.006;
      spin = ease.inOut(win(ct, 0.15, 1.8)) * Math.PI * 2;
      pulse = 0.32;
    }
    if (clip === 'lifted' || c.hang.active) {
      squash = 1.08; pulse = 0.22;
    }

    const trail = this.trailSpring.step((c.hang.swingX || 0) * 1.2 + roll * 0.8, c.dt);
    this.move('base', 0, Math.max(0, hover), 0);
    this.rot('base', -c.lookPitch * 0.2, yaw + spin, roll);
    this.squash('base', squash + Math.sin(t * 1.8) * 0.018 * rm);
    this.rot('conch', 0, 0, Math.sin(t * 2.2) * 0.06 * rm);
    for (let i = 0; i < 6; i++) {
      const wave = Math.sin(t * 2.4 + i * 1.05) * pulse * rm;
      this.rot('tent' + i, wave, 0, trail * 0.45);
    }
    const b = c.blink;
    this.scl('eyeL', 1, 1 - 0.9 * b, 1); this.scl('eyeR', 1, 1 - 0.9 * b, 1);
  }
}

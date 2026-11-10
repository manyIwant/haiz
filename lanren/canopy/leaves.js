// Work leaves: one real blade per work (two joined at the petiole for a work made by two
// people, three at most), grown on the work's own rosette of the V4 crown.
//
// They use V4's own leaf material — same atlas, normal map, wind, touch, translucency —
// with their own growth clock, so a work's leaf can be younger than the tree around it:
//   finished work        an open, fresh blade (Terminalia's bright new green)
//   project in progress  a blade still unfolding (bronze, half folded along the midrib)
// Emphasis is light, not an outline: a selected or found leaf takes more sun through the
// blade (aWork.x lit, .y selected). No glow sprites, no lines.
import * as THREE from 'three';
import { makeLeafMaterial, leafGeometry } from '../js/foliage.js';

const UP = new THREE.Vector3(0, 1, 0);
export const OWN_GROW = { value: 1.0 };   // the work leaves' clock: always "in season"

function patch(mat, depth) {
  const inner = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    inner(sh, r);
    sh.uniforms.uGrow = OWN_GROW;
    if (depth) return;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aWork;\nvarying vec4 vWork;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvWork = aWork;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vWork;')
      .replace('reflectedLight.directSpecular *= 0.85;', `reflectedLight.directSpecular *= 0.85;
  // a work leaf in the light: more sun passes through the blade (selected most)
  reflectedLight.directDiffuse += tint * (0.2 + vWork.x * 2.0 + vWork.y * 2.8) * thin * vAir;
  reflectedLight.indirectDiffuse *= 1.0 + vWork.y * 0.6;`);
  };
  mat.customProgramCacheKey = () => `canopy-work-${depth}`;
  return mat;
}

/**
 * @param world  V4 world (canopy material, rosettes)
 * @param items  [{ key, index (rosette), blades (1–3), kind: 'work' | 'project', age (0 new … 1 old) }]
 */
export function createWorkLeaves(world, items) {
  const base = world.canopy.mesh.material;
  const ros = world.rosettes, st = world.stride;
  const blades = [];
  const P = new THREE.Vector3(), out = new THREE.Vector3(), b = new THREE.Vector3(), side = new THREE.Vector3(), nrm = new THREE.Vector3();
  const m = new THREE.Matrix4(), basis = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  items.forEach((it, k) => {
    const o = it.index * st;
    P.set(ros[o], ros[o + 1], ros[o + 2]);
    out.set(ros[o] - 0.6, 0, ros[o + 2] + 0.2).normalize();
    const n = Math.max(1, Math.min(3, it.blades || 1));
    for (let j = 0; j < n; j++) {
      const spread = n === 1 ? 0 : (j / (n - 1) - 0.5) * 0.95;          // a pair opens like two hands
      const elev = 0.32 + (it.kind === 'project' ? 0.35 : 0);
      b.copy(out).applyAxisAngle(UP, spread).multiplyScalar(Math.cos(elev)).addScaledVector(UP, Math.sin(elev)).normalize();
      side.crossVectors(UP, b).normalize();
      const roll = spread * 0.6;
      nrm.crossVectors(b, side).normalize();
      const s2 = side.clone().multiplyScalar(Math.cos(roll)).addScaledVector(nrm, Math.sin(roll));
      const n2 = new THREE.Vector3().crossVectors(b, s2).normalize();
      basis.makeBasis(b, n2, s2.multiplyScalar(-1));
      q.setFromRotationMatrix(basis);
      // a project's blade is still small and folded: the growth curve scales it, so it is drawn larger
      const len = (it.kind === 'project' ? 0.62 : 0.36) * (n > 1 ? 0.92 : 1);
      m.compose(P.clone().addScaledVector(b, 0.025), q, s.set(len, len, len));
      // growth: finished → open fresh blade (tE 0.8 … 0.62 with age); project → still unfolding
      const tE = it.kind === 'project' ? 0.915 : 0.8 - 0.18 * Math.min(1, Math.max(0, it.age || 0));
      blades.push({ k, m: m.clone(), P: P.clone(), tE, variant: (k * 7 + j * 3) % 4, occ: Math.min(0.4, ros[o + 8]), clump: [ros[o + 12], ros[o + 13], ros[o + 14]] });
    }
  });
  const g = leafGeometry(6, 14, 0.62, { cup: 0.11, wave: 0.012, waves: 3.2, lift: 0.05, twist: 0.12 });
  const N = Math.max(1, blades.length);
  const rosA = new Float32Array(N * 4), leafA = new Float32Array(N * 4), padA = new Float32Array(N * 4), workA = new Float32Array(N * 4);
  const mesh = new THREE.InstancedMesh(g, patch(makeLeafMaterial({ atlas: base.map, normal: base.normalMap }), false), N);
  blades.forEach((bl, i) => {
    rosA.set([bl.P.x, bl.P.y, bl.P.z, 0.7], i * 4);
    leafA.set([bl.tE, -1, bl.variant, bl.occ], i * 4);
    padA.set([bl.clump[0], bl.clump[1], bl.clump[2], 1], i * 4);
    mesh.setMatrixAt(i, bl.m);
  });
  if (!blades.length) mesh.count = 0;
  g.setAttribute('aRosette', new THREE.InstancedBufferAttribute(rosA, 4));
  g.setAttribute('aLeaf', new THREE.InstancedBufferAttribute(leafA, 4));
  g.setAttribute('aPad', new THREE.InstancedBufferAttribute(padA, 4));
  const aWork = new THREE.InstancedBufferAttribute(workA, 4);
  aWork.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aWork', aWork);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.customDepthMaterial = patch(makeLeafMaterial({ atlas: base.map, depth: true }), true);
  mesh.frustumCulled = false;
  mesh.name = 'canopy-work-leaves';
  mesh.visible = false;

  // per-blade emphasis, eased towards its target each frame
  const cur = new Float32Array(N * 2), goal = new Float32Array(N * 2);
  return {
    mesh,
    blades,
    /** set the emphasis of every blade of item k: lit 0…1, selected 0…1 */
    set(k, lit, sel) { blades.forEach((bl, i) => { if (bl.k === k) { goal[i * 2] = lit; goal[i * 2 + 1] = sel; } }); },
    clear() { goal.fill(0); },
    update(dt) {
      let dirty = false;
      const a = 1 - Math.exp(-dt * 4);
      for (let i = 0; i < blades.length; i++) {
        for (let c = 0; c < 2; c++) {
          const j = i * 2 + c, d = goal[j] - cur[j];
          if (Math.abs(d) > 1e-3) { cur[j] += d * a; dirty = true; } else if (cur[j] !== goal[j]) { cur[j] = goal[j]; dirty = true; }
        }
        workA[i * 4] = cur[i * 2]; workA[i * 4 + 1] = cur[i * 2 + 1];
      }
      if (dirty) aWork.needsUpdate = true;
    },
    dispose() { g.dispose(); mesh.material.dispose(); mesh.customDepthMaterial.dispose(); }
  };
}

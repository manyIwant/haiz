// HAIZ · 自由移动 — Full-Body 2-Bone Analytical IK & First-Person Body Rig
//
// Drives the 51-bone MakeHuman CC0 campus student skeleton directly from each vehicle's contact points
// (saddle/pedals/handlebars, skateboard deck/ground-push, bamboo broom shaft/damped-pendulum legs,
// and Terminalia glider trapeze control bar + suspended harness body).
//
// Key upgrade: First-Person Body Visibility (setFirstPerson) — collapses ONLY the head bone and hides
// Hair/Glasses meshes when inside 1st-person cockpit view, keeping arms, hands gripping the handlebars/
// broom/glider bar, chest, and pedaling legs vividly present in the frame!
import * as THREE from 'three';

const clamp = THREE.MathUtils.clamp;
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

const TRUNK = ['hips', 'spine', 'chest', 'neck', 'head'];
const LEGS = { L: ['thigh.L', 'shin.L', 'foot.L', 'toe.L'], R: ['thigh.R', 'shin.R', 'foot.R', 'toe.R'] };
const ARMS = { L: ['shoulder.L', 'upperarm.L', 'forearm.L', 'hand.L'], R: ['shoulder.R', 'upperarm.R', 'forearm.R', 'hand.R'] };
const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _m = new THREE.Matrix4();
const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);

function basis(dir, pole, out) {
  const y = _v.copy(dir).normalize();
  const x = _v2.crossVectors(y, pole);
  if (x.lengthSq() < 1e-8) x.crossVectors(y, Math.abs(y.x) < 0.9 ? X : Z);
  x.normalize();
  const z = _v3.crossVectors(x, y).normalize();
  _m.makeBasis(x, y, z);
  return out.setFromRotationMatrix(_m);
}

export function createRig(student) {
  const model = student.model;
  const human = student.human;
  const bone = (n) => student.bone(n);
  const B = {};
  for (const n of [...TRUNK, ...LEGS.L, ...LEGS.R, ...ARMS.L, ...ARMS.R]) B[n] = bone(n);
  const fingers = [];
  for (const sd of ['L', 'R']) {
    for (const f of FINGERS) {
      for (let j = 1; j <= 3; j++) {
        const b = bone(`${f}.0${j}.${sd}`);
        if (b) fingers.push({ b, f, j, sd });
      }
    }
  }
  const all = [...Object.values(B).filter(Boolean), ...fingers.map((f) => f.b)];

  // Identify head-mounted accessories (Hair-*, Glasses*, plus their outline siblings) for clean FP cockpit mode
  const headMeshes = [];
  model.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    if (/^Hair-|^Glasses/i.test(o.name)) headMeshes.push(o);
  });
  // Also catch outline clones of hair/glasses (they share the exact same geometry!)
  const headGeos = new Set(headMeshes.map((m) => m.geometry));
  model.traverse((o) => {
    if (o.isSkinnedMesh && headGeos.has(o.geometry) && !headMeshes.includes(o)) headMeshes.push(o);
  });

  // Measure rest pose once in model space
  const rest = new Map();
  model.updateMatrixWorld(true);
  human.restPose();
  model.updateMatrixWorld(true);
  const modelQinv = model.getWorldQuaternion(new THREE.Quaternion()).invert();
  const modelInv = new THREE.Matrix4().copy(model.matrixWorld).invert();
  for (const b of all) {
    const q = modelQinv.clone().multiply(b.getWorldQuaternion(new THREE.Quaternion()));
    const p = b.getWorldPosition(new THREE.Vector3()).applyMatrix4(modelInv);
    rest.set(b, { q, p, local: b.quaternion.clone(), localP: b.position.clone() });
  }
  const P = (n) => rest.get(B[n]).p;
  const len = (a, b) => P(a).distanceTo(P(b));
  const dims = {
    hip: P('hips').y,
    thigh: len('thigh.L', 'shin.L'),
    shin: len('shin.L', 'foot.L'),
    upper: len('upperarm.L', 'forearm.L'),
    fore: len('forearm.L', 'hand.L'),
    ankle: P('foot.L').y,
    shoulder: P('upperarm.L').y,
    hipW: Math.abs(P('thigh.L').x - P('thigh.R').x),
    hipDrop: P('hips').y - P('thigh.L').y,
  };
  dims.leg = dims.thigh + dims.shin;
  dims.arm = dims.upper + dims.fore;
  human.reset();

  // Posing helpers
  function setWorldQ(b, qw) {
    b.parent.updateWorldMatrix(true, false);
    b.parent.getWorldQuaternion(_q3).invert();
    b.quaternion.copy(_q3.multiply(qw));
    b.updateMatrixWorld(true);
  }
  const restAim = new Map();
  function restFrame(b, child, poleModel) {
    const key = b.uuid + ':' + child.uuid + ':' + poleModel.toArray().join(',');
    let r = restAim.get(key);
    if (!r) {
      const d = rest.get(child).p.clone().sub(rest.get(b).p);
      const f = basis(d, poleModel, new THREE.Quaternion());
      r = { inv: f.clone().invert(), q: rest.get(b).q };
      restAim.set(key, r);
    }
    return r;
  }
  const qModel = new THREE.Quaternion(), qAim = new THREE.Quaternion();
  function aim(b, child, dirW, poleW, poleRest) {
    const r = restFrame(b, child, poleRest);
    basis(dirW, poleW, qAim);
    qAim.multiply(r.inv).multiply(r.q);
    setWorldQ(b, qAim);
  }
  function trunk(b, extraW) {
    qAim.copy(extraW).multiply(_q2.copy(qModel).multiply(rest.get(b).q));
    setWorldQ(b, qAim);
  }
  const posW = (b, out) => b.getWorldPosition(out);

  const _A = new THREE.Vector3(), _K = new THREE.Vector3(), _D = new THREE.Vector3(), _bend = new THREE.Vector3();
  const _toK = new THREE.Vector3(), _fromK = new THREE.Vector3();
  function ik(a, m, e, L1, L2, T, poleW, poleRest) {
    posW(a, _A);
    _D.copy(T).sub(_A);
    let d = _D.length();
    const dir = _D.multiplyScalar(1 / Math.max(d, 1e-6));
    d = clamp(d, Math.abs(L1 - L2) + 1e-3, (L1 + L2) * 0.9995);
    const ca = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
    _bend.copy(poleW).addScaledVector(dir, -poleW.dot(dir));
    if (_bend.lengthSq() < 1e-8) _bend.set(0, 0, 1);
    _bend.normalize();
    _K.copy(_A).addScaledVector(dir, L1 * ca).addScaledVector(_bend, L1 * Math.sqrt(1 - ca * ca));
    _toK.subVectors(_K, _A);
    aim(a, m, _toK, _bend, poleRest);
    _fromK.copy(T).sub(_K);
    aim(m, e, _fromK, _bend, poleRest);
  }

  // Smooth cross-mode blending
  const snap = { q: new Map(), pos: new THREE.Vector3(), quat: new THREE.Quaternion(), hipsP: new THREE.Vector3(), has: false };
  function capture() {
    for (const b of all) {
      if (!snap.q.has(b)) snap.q.set(b, new THREE.Quaternion());
      snap.q.get(b).copy(b.quaternion);
    }
    snap.pos.copy(model.position);
    snap.quat.copy(model.quaternion);
    snap.hipsP.copy(B.hips.position);
    snap.has = true;
  }
  function blendFromSnap(w) {
    if (!snap.has || w >= 1) return;
    const k = smooth(w);
    for (const b of all) b.quaternion.copy(snap.q.get(b)).slerp(_q.copy(b.quaternion), k);
    B.hips.position.lerpVectors(snap.hipsP, _v.copy(B.hips.position), k);
    model.position.lerpVectors(snap.pos, _v.copy(model.position), k);
    model.quaternion.copy(snap.quat).slerp(_q.copy(model.quaternion), k);
    model.updateMatrixWorld(true);
  }

  let fpHidden = false;
  function setFirstPerson(on) {
    fpHidden = !!on;
    if (B.head) B.head.scale.setScalar(fpHidden ? 0.001 : 1);
    if (B.neck) B.neck.scale.setScalar(fpHidden ? 0.001 : 1);
    for (const m of headMeshes) m.visible = !fpHidden;
  }

  const qf = new THREE.Quaternion(), qx = new THREE.Quaternion(), axis = new THREE.Vector3();
  const _up = new THREE.Vector3(), _fwd = new THREE.Vector3();
  const LEG_POLE_REST = new THREE.Vector3(0, 0, 1), ARM_POLE_REST = new THREE.Vector3(0, 0, -1);

  function pose(s) {
    model.quaternion.copy(s.frame);
    qModel.copy(s.frame);
    _v.copy(rest.get(B.hips).p).applyQuaternion(s.frame);
    model.position.copy(s.hips).sub(_v);
    B.hips.position.copy(rest.get(B.hips).localP);
    model.updateMatrixWorld(true);

    for (const b of all) b.quaternion.copy(rest.get(b).local);
    if (B.head) B.head.scale.setScalar(fpHidden ? 0.001 : 1);
    if (B.neck) B.neck.scale.setScalar(fpHidden ? 0.001 : 1);
    model.updateMatrixWorld(true);

    const right = axis.set(1, 0, 0).applyQuaternion(s.frame);
    const up = _up.set(0, 1, 0).applyQuaternion(s.frame);
    const fwd = _fwd.set(0, 0, 1).applyQuaternion(s.frame);
    const pitch = s.pitch || [0, 0, 0], twist = s.twist || [0, 0], side = s.side || 0;
    const turn = (p, t, sd) => qf.setFromAxisAngle(up, t).multiply(qx.setFromAxisAngle(right, p)).premultiply(_q2.setFromAxisAngle(fwd, sd));

    let accP = 0, accT = 0, accS = 0;
    const parts = [
      ['hips', pitch[0], twist[0], side * 0.3],
      ['spine', pitch[1], twist[0] * 0.5 + twist[1] * 0.3, side * 0.35],
      ['chest', pitch[2], twist[1], side * 0.35],
    ];
    for (const [n, p, t, sd] of parts) {
      accP += p; accT += t; accS += sd;
      trunk(B[n], turn(accP, accT, accS));
    }
    const look = s.look ?? 0, hy = s.headYaw ?? 0;
    trunk(B.neck, turn(accP * 0.45 - look * 0.4, accT * 0.7 + hy * 0.4, accS * 0.4));
    trunk(B.head, turn(-look * 0.6, accT * 0.6 + hy, accS * 0.15));

    for (const sd of ['L', 'R']) {
      const f = s.feet?.[sd];
      if (!f) continue;
      const [t, sh, ft, toe] = LEGS[sd].map((n) => B[n]);
      ik(t, sh, ft, dims.thigh, dims.shin, f.at, f.pole, LEG_POLE_REST);
      if (f.q) setWorldQ(ft, _q.copy(f.q).multiply(rest.get(ft).q));
      if (toe && f.toe) {
        toe.quaternion.copy(rest.get(toe).local).multiply(_q.setFromAxisAngle(X, f.toe));
        toe.updateMatrixWorld(true);
      }
    }
    for (const sd of ['L', 'R']) {
      const h = s.hands?.[sd];
      if (!h) continue;
      const [, ua, fa, hand] = ARMS[sd].map((n) => B[n]);
      ik(ua, fa, hand, dims.upper, dims.fore, h.at, h.pole, ARM_POLE_REST);
      if (h.q) setWorldQ(hand, _q.copy(h.q).multiply(rest.get(hand).q));
    }
    const curl = s.curl ?? 0;
    if (curl > 0) {
      for (const { b, f, j } of fingers) {
        const a = curl * (f === 'thumb' ? 0.35 : j === 1 ? 0.9 : 1.05);
        b.quaternion.copy(rest.get(b).local).multiply(_q.setFromAxisAngle(X, a));
      }
    }
    model.updateMatrixWorld(true);
  }

  const where = (n, out = new THREE.Vector3()) => B[n].getWorldPosition(out);

  return { dims, B, pose, capture, blendFromSnap, setFirstPerson, where, rest, model };
}

// 入画 · the walker, walking (scripts/ruhua/build_student.py builds the figure; nothing here is keyed).
//
// The V2 figure played three clips blended by speed: legs swung on a timer whether or not the body
// covered the ground, so the feet slid, the hips never moved, and every step looked the same. Here the
// walk is made from what a walk is:
//
//   feet     each foot is planted in the world for its stance and stays there; in its swing it travels
//            on an arc (heel strike, toe-off) to where the body will be when it lands — predicted from
//            the body's velocity, so turns and stops place the feet, not a timer
//   cadence  steps lengthen and quicken with speed as people's do (≈1.85 steps/s at 1.4 m/s; a run
//            ≈2.8 steps/s with a flight phase); the cycle advances with distance covered
//   legs     two-bone IK from the hip to the planted ankle, knees forward
//   pelvis   highest over the standing leg when walking (an inverted pendulum), lowest when running
//            (a spring); sways towards the standing foot; turns with the stride (from where the feet
//            actually are) and drops a little on the swing side
//   body     the chest turns against the pelvis; arms swing against the legs (elbows bend when
//            running); a lean into speed and acceleration; the head stays level and looks where the
//            player looks (or at a landmark when resting)
//   standing weight shifts from foot to foot, breathing; a body that turns or drifts off its feet
//            takes a small step to catch up
//   weather  in rain an umbrella opens in the right hand (and closes when it stops)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { bodyMaterial, outlineMaterial } from '../ruhua-stroll/student.js';
import { cel } from '../ruhua-stroll/atmos.js';

const clamp = THREE.MathUtils.clamp;
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const fract = (x) => x - Math.floor(x);
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

function umbrella() {
  const g = new THREE.Group();
  const canopyMat = cel({ name: 'umbrella', key: 'umbrella', color: new THREE.Color('#2f5f57'), side: THREE.DoubleSide, soft: 0.2,
    fragment: { albedo: 'float rib = abs(fract(atan(vWP.x, vWP.z) * 1.27) - 0.5); albedo *= 0.9 + 0.12 * smoothstep(0.05, 0.0, rib);\n' } });
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.2, 16, 1, true).translate(0, 0.86, 0), canopyMat);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.9, 6).translate(0, 0.42, 0), cel({ name: 'umb-shaft', key: 'umb-shaft', color: new THREE.Color('#3a3530') }));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 6, 10, Math.PI).rotateZ(Math.PI).translate(0.035, 0, 0), shaft.material);
  g.add(canopy, shaft, handle);
  g.traverse((o) => { o.castShadow = true; });
  g.userData.canopy = canopy;
  return g;
}

export async function createWalker(url, { pbr = false, heightAt } = {}) {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
  const model = gltf.scene;
  let skinned = null;
  model.traverse((o) => { if (o.isSkinnedMesh) skinned = o; });
  if (!skinned) throw new Error('walker: no skinned mesh');
  let outline = null;
  if (!pbr) {
    const geo = skinned.geometry;
    geo.setAttribute('aData', geo.getAttribute('color'));
    geo.deleteAttribute('color');
    skinned.material = bodyMaterial();
    outline = new THREE.SkinnedMesh(geo, outlineMaterial());
    outline.material.uniforms.uWidth.value = 0.008;
    outline.bind(skinned.skeleton, skinned.bindMatrix);
    outline.frustumCulled = false;
    outline.position.copy(skinned.position); outline.quaternion.copy(skinned.quaternion); outline.scale.copy(skinned.scale);
    skinned.parent.add(outline);
  }
  skinned.castShadow = skinned.receiveShadow = true;
  skinned.frustumCulled = false;
  const root = new THREE.Group();
  root.name = 'walker';
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(0.05, 0.08, 0.12, 0.34 * (1.0 - smoothstep(0.2, 1.0, d))); }' }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; blob.renderOrder = 2;
  root.add(model, blob);                                  // the walk's player tilts root.children[0] into turns

  // ---- the bind pose, in the figure's own space (it faces +Z)
  const bone = (n) => model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n));   // the loader drops the dots ('hand.L' → 'handL')
  const names = ['hips', 'spine', 'chest', 'neck', 'head', 'shoulder.L', 'shoulder.R', 'upperarm.L', 'upperarm.R', 'forearm.L', 'forearm.R', 'hand.L', 'hand.R', 'thigh.L', 'thigh.R', 'shin.L', 'shin.R', 'foot.L', 'foot.R', 'toe.L', 'toe.R'];
  if (pbr && bone('bag')) names.push('bag');
  const B = {}, rest = {};
  model.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(model.matrixWorld).invert();
  for (const n of names) {
    const b = bone(n); if (!b) throw new Error('walker: missing bone ' + n);
    B[n] = b;
    b.userData.wk = n;                                    // our name for it (parents are looked up by this)
    const m = new THREE.Matrix4().multiplyMatrices(inv, b.matrixWorld);
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    m.decompose(p, q, s);
    rest[n] = { pos: p, q, local: b.quaternion.clone(), localPos: b.position.clone() };
  }
  // the hips' parent (the rig's root bone, and the armature above it): its rotation in the figure's space
  const hipsParent = B.hips.parent;
  const parentQ = new THREE.Quaternion();
  { const m = new THREE.Matrix4().multiplyMatrices(inv, hipsParent.matrixWorld); m.decompose(new THREE.Vector3(), parentQ, new THREE.Vector3()); }
  const parentQInv = parentQ.clone().invert();
  const dirOf = (a, b) => rest[b].pos.clone().sub(rest[a].pos).normalize();
  const legLen = (s) => ({ L1: rest['thigh.' + s].pos.distanceTo(rest['shin.' + s].pos), L2: rest['shin.' + s].pos.distanceTo(rest['foot.' + s].pos) });
  const LEG = { L: legLen('L'), R: legLen('R') };
  const ankleH = rest['foot.L'].pos.y;                    // ankle height above the soles at rest
  // For the scanned model, stance targets are under the actual ankle and the
  // end of the sole is the pivot of a heel strike or toe-off.
  const soles = {};
  if (pbr) {
    const positions = skinned.geometry.attributes.position;
    const sample = new THREE.Vector3();
    const meshToModel = inv.clone().multiply(skinned.matrixWorld);
    for (const s of ['L', 'R']) {
      const ankle = rest['foot.' + s].pos;
      let heel = null, toe = null;
      for (let i = 0; i < positions.count; i++) {
        sample.fromBufferAttribute(positions, i).applyMatrix4(meshToModel);
        if (sample.x * ankle.x <= 0 || sample.y > 0.019) continue;
        if (!heel || sample.z < heel.z) heel = sample.clone();
        if (!toe || sample.z > toe.z) toe = sample.clone();
      }
      if (!heel || !toe) throw new Error('walker: missing shoe soles');
      soles[s] = { heel: heel.sub(ankle), toe: toe.sub(ankle) };
    }
  }
  const hipW = rest['thigh.L'].pos.x;                     // + is the walker's left
  const restDir = { thighL: dirOf('thigh.L', 'shin.L'), thighR: dirOf('thigh.R', 'shin.R'), shinL: dirOf('shin.L', 'foot.L'), shinR: dirOf('shin.R', 'foot.R'),
    armL: dirOf('upperarm.L', 'forearm.L'), armR: dirOf('upperarm.R', 'forearm.R'), foreL: dirOf('forearm.L', 'hand.L'), foreR: dirOf('forearm.R', 'hand.R') };
  const hipsH = rest.hips.pos.y;

  // ---- the walk's state
  const G = {
    phase: 0, lastPos: new THREE.Vector3(), vel: new THREE.Vector3(), speed: 0, accel: 0, yaw: 0, init: false, run: 0,
    feet: { L: { at: new THREE.Vector3(), yaw: 0, swing: false, from: new THREE.Vector3(), t: 0, dur: 0.3, roll: 0 }, R: { at: new THREE.Vector3(), yaw: 0, swing: false, from: new THREE.Vector3(), t: 0, dur: 0.3, roll: 0 } },
    shift: 0, shiftT: 3, breathe: 0, crouch: 0, air: 0, look: { y: 0, p: 0, w: 0, ty: 0, tp: 0, tw: 0 }, umb: 0, umbWant: false, time: 0,
  };
  const umb = umbrella();
  umb.visible = false;
  B['hand.R'].add(umb);
  umb.position.set(0, 0.06, 0); umb.rotation.set(0, 0, 0);

  const mInv = new THREE.Matrix4(), mW = new THREE.Matrix4(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  const worldToModel = (v) => v.applyMatrix4(mInv);
  // a bone's model-space rotation → its local rotation, given its parent's (already posed) model rotation
  const modelQ = {};
  function setModel(n, q) {
    const p = n === 'hips' ? parentQ : B[n].parent && modelQ[B[n].parent.userData.wk];
    B[n].quaternion.copy(p ? qa.copy(p).invert().multiply(q) : q);
    modelQ[n] = q.clone();
  }
  const keepRest = (n) => { const p = modelQ[B[n].parent?.userData.wk]; const q = p ? p.clone().multiply(rest[n].local) : rest[n].q.clone(); B[n].quaternion.copy(rest[n].local); modelQ[n] = q; };
  const delta = (axis, ang, base) => new THREE.Quaternion().setFromAxisAngle(axis, ang).multiply(base);
  // Bring the A-pose arms in before applying sagittal flexion. Doing it after
  // flexion pushes the bent forearms away from the chest during a sprint.
  const armSwing = (base, pitch, spread) => pbr
    ? delta(X, pitch, delta(Z, spread, base))
    : delta(Z, spread, delta(X, pitch, base));

  const groundY = (p) => heightAt ? heightAt(p.x, p.z) : root.position.y;
  const stanceX = (s) => pbr ? rest['foot.' + s].pos.x : (s === 'L' ? hipW : -hipW);
  const stanceZ = (s) => pbr ? rest['foot.' + s].pos.z : 0.02;
  function plantAll() {
    for (const s of ['L', 'R']) {
      const f = G.feet[s];
      tmp.set(stanceX(s), 0, stanceZ(s)).applyMatrix4(mW);
      f.at.copy(tmp); f.at.y = groundY(f.at); f.swing = false; f.yaw = G.yaw;
    }
  }

  // two-bone IK in model space; returns the knee
  const knee = new THREE.Vector3();
  function ik(hip, ankle, L1, L2, pole) {
    const d = tmp.copy(ankle).sub(hip);
    const dl = clamp(d.length(), 0.08, L1 + L2 - 1e-3);
    d.normalize();
    const p = tmp2.copy(pole).addScaledVector(d, -pole.dot(d)).normalize();
    const a = (L1 * L1 + dl * dl - L2 * L2) / (2 * dl), h = Math.sqrt(Math.max(L1 * L1 - a * a, 0));
    knee.copy(hip).addScaledVector(d, a).addScaledVector(p, h);
    return knee;
  }
  const qFrom = (from, to) => new THREE.Quaternion().setFromUnitVectors(from, tmp.copy(to).normalize());

  function update(_speed, airborne, dt) {
    if (dt <= 0) return;
    G.time += dt;
    root.updateMatrixWorld(true);
    mW.copy(model.matrixWorld); mInv.copy(mW).invert();
    const pos = root.position;
    const prevYaw = G.yaw;
    G.yaw = root.rotation.y;
    if (!G.init || pos.distanceTo(G.lastPos) > 1.5) { G.init = true; G.lastPos.copy(pos); G.vel.set(0, 0, 0); plantAll(); }
    // the body's own motion (whatever moved it)
    tmp.copy(pos).sub(G.lastPos).divideScalar(dt); tmp.y = 0;
    const prevSpeed = G.speed;
    G.vel.lerp(tmp, 1 - Math.exp(-dt * 12));
    G.lastPos.copy(pos);
    G.speed = G.vel.length();
    G.accel += ((G.speed - prevSpeed) / dt - G.accel) * (1 - Math.exp(-dt * 6));
    G.run += (clamp((G.speed - 2.4) / 1.4, 0, 1) - G.run) * (1 - Math.exp(-dt * 5));
    G.air += ((airborne ? 1 : 0) - G.air) * (1 - Math.exp(-dt * (airborne ? 12 : 8)));
    const moving = G.speed > 0.12 && !airborne;
    // ---- cadence and stride
    const step = G.speed < 2.2 ? 0.36 + 0.26 * G.speed : 0.82 + 0.17 * G.speed;
    const duty = 0.62 - (pbr ? 0.36 : 0.26) * G.run;
    const supportReach = Math.min(LEG.L.L1 + LEG.L.L2, LEG.R.L1 + LEG.R.L2) * .61;
    const minimumCadence = pbr ? G.speed * duty / supportReach : 0;
    const cadence = Math.max(0.6, G.speed / step, minimumCadence);
    if (pbr && moving && !G.wasMoving) G.phase = duty * 0.5;
    if (moving) G.phase += cadence * dt * 0.5;
    G.wasMoving = moving;
    const fwd = tmp2.set(Math.sin(G.yaw), 0, Math.cos(G.yaw)).clone();
    const left = new THREE.Vector3(fwd.z, 0, -fwd.x);
    const travel = pbr && moving ? G.vel.clone().normalize() : fwd;
    for (const s of ['L', 'R']) {
      const f = G.feet[s], side = s === 'L' ? 1 : -1;
      const ph = fract(G.phase + (s === 'L' ? 0 : 0.5));
      // where this foot should come down: under the hip, half a step ahead of where the body will be
      const ahead = moving ? (pbr ? G.speed * duty / cadence : step * 0.5) : 0;
      const target = new THREE.Vector3().copy(pos).addScaledVector(left, stanceX(s) * (moving ? (pbr ? 0.93 : 0.85) : 1))
        .addScaledVector(travel, ahead).addScaledVector(fwd, pbr || !moving ? stanceZ(s) : 0);
      if (moving) {
        const swinging = ph >= duty;
        if (swinging && !f.swing) { f.swing = true; f.from.copy(f.at); f.dur = (1 - duty) / (cadence * 0.5); f.t = 0; }
        if (!swinging && f.swing) { f.swing = false; f.at.copy(target); f.at.y = groundY(f.at); f.yaw = G.yaw; }
        if (f.swing) {
          f.t = clamp((ph - duty) / (1 - duty), 0, 1);
          // predict where the body will be at touchdown
          target.addScaledVector(G.vel, (1 - f.t) * f.dur);
          f.to = target.clone(); f.to.y = groundY(f.to);                 // if the body stops mid-stride, the swing finishes here
          f.cur = new THREE.Vector3().lerpVectors(f.from, target, smooth(f.t));
          f.cur.y = groundY(f.cur) + Math.sin(f.t * Math.PI) * (0.07 + 0.13 * G.run) + (1 - G.run) * 0.02 * Math.sin(f.t * Math.PI * 2);
          f.roll = f.t < 0.3 ? -0.5 * (1 - f.t / 0.3) : f.t > 0.75 ? 0.3 * (f.t - 0.75) / 0.25 : 0;   // toe-off, then the heel leads
          f.yaw += wrap(G.yaw - f.yaw) * (1 - Math.exp(-dt * 10));
        } else {
          f.cur = f.at.clone();
          const st = ph / duty;
          f.roll = st < 0.12 ? 0.3 * (1 - st / 0.12) : st > 0.75 ? -0.45 * (st - 0.75) / 0.25 : 0;   // heel strike rolls flat; the heel lifts before toe-off
        }
      } else {
        // standing: a foot left behind by a turn or a drift takes a small step to catch up
        if (f.swing) {
          f.t += dt / f.dur;
          if (f.t >= 1) { f.swing = false; f.at.copy(f.to); f.yaw = G.yaw; }
        }
        const off = f.at.distanceTo(target), turn = Math.abs(wrap(G.yaw - f.yaw));
        const other = G.feet[s === 'L' ? 'R' : 'L'];
        if (!f.swing && !other.swing && (off > 0.22 || turn > 0.55)) { f.swing = true; f.from.copy(f.at); f.to = target.clone(); f.to.y = groundY(f.to); f.t = 0; f.dur = 0.32; }
        if (f.swing) { f.cur = new THREE.Vector3().lerpVectors(f.from, f.to, smooth(f.t)); f.cur.y = groundY(f.cur) + Math.sin(f.t * Math.PI) * 0.06; f.yaw += wrap(G.yaw - f.yaw) * (1 - Math.exp(-dt * 12)); }
        else f.cur = f.at.clone();
        f.roll *= Math.exp(-dt * 8);
      }
      if (G.air > 0.01) {
        // in the air: knees up, feet under the body
        const tuck = new THREE.Vector3().copy(pos).addScaledVector(left, hipW * side).addScaledVector(fwd, 0.05 * side + 0.08);
        tuck.y = pos.y + 0.22;
        f.cur.lerp(tuck, G.air);
        if (!airborne && G.air < 0.6) plantAll();
      }
    }
    // ---- the pelvis
    const cyc = G.phase * Math.PI * 2;
    const walkK = moving ? 1 - G.run : 0, runK = moving ? G.run : 0;
    G.shiftT -= dt;
    if (G.shiftT <= 0) { G.shiftT = 3 + Math.random() * 4; G.shiftTo = (Math.random() - 0.5) * 2; }
    G.shift += ((moving ? 0 : G.shiftTo || 0) - G.shift) * (1 - Math.exp(-dt * 0.9));
    G.crouch *= Math.exp(-dt * 5);
    if (G.wasAir && !airborne) G.crouch = 0.09;
    G.wasAir = airborne;
    const bob = walkK * 0.022 * Math.cos(2 * (cyc - duty * Math.PI)) - runK * 0.04 * Math.cos(2 * (cyc - duty * Math.PI)) + runK * 0.015;
    const lower = 0.025 * walkK + 0.075 * runK + G.crouch + 0.06 * G.air;
    const fl = worldToModel(G.feet.L.cur.clone()), fr = worldToModel(G.feet.R.cur.clone());
    const sway = walkK * 0.016 * Math.cos(cyc - duty * Math.PI) + G.shift * 0.022;
    const pelvisYaw = clamp((fr.z - fl.z) * 0.22, -0.14, 0.14);
    const list = walkK * 0.035 * Math.sin(cyc) + G.shift * 0.025;
    const lean = 0.03 + 0.05 * walkK + 0.2 * runK + clamp(G.accel * 0.03, -0.08, 0.12);
    B.hips.position.copy(rest.hips.localPos).add(tmp.set(sway, bob - lower, 0).applyQuaternion(parentQInv));
    setModel('hips', delta(Y, pelvisYaw, delta(Z, list, delta(X, lean * 0.4, rest.hips.q))));
    setModel('spine', delta(Y, -pelvisYaw * 0.5, delta(X, lean * 0.4, rest.spine.q)));
    G.breathe = Math.sin(G.time * 1.55) * 0.012;
    setModel('chest', delta(Y, -pelvisYaw * 1.1, delta(X, lean * 0.35 + G.breathe - G.air * 0.1, rest.chest.q)));
    // the head stays level and looks where it is told
    const lk = G.look;
    lk.y += (lk.ty - lk.y) * (1 - Math.exp(-dt * 5)); lk.p += (lk.tp - lk.p) * (1 - Math.exp(-dt * 5)); lk.w += (lk.tw - lk.w) * (1 - Math.exp(-dt * 3));
    const ly = clamp(lk.y, -1.2, 1.2) * lk.w, lp = clamp(lk.p, -0.5, 0.75) * lk.w;
    setModel('neck', delta(Y, ly * 0.4 + pelvisYaw * 0.4, delta(X, -lp * 0.35 - lean * 0.5, rest.neck.q)));
    setModel('head', delta(Y, ly * 0.6 + pelvisYaw * 0.3, delta(X, -lp * 0.65 - lean * 0.3, rest.head.q)));
    // ---- the legs: hip → planted ankle
    root.updateMatrixWorld(true); mW.copy(model.matrixWorld); mInv.copy(mW).invert();
    const targets = {};
    let pelvisDrop = 0;
    for (const s of ['L', 'R']) {
      const f = G.feet[s];
      const ankle = worldToModel(f.cur.clone());
      ankle.y += pbr ? rest['foot.' + s].pos.y : ankleH;
      const yaw = wrap(f.yaw - G.yaw);
      const lateral = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      if (pbr && !f.swing && !airborne) {
        if (Math.abs(f.roll) > 1e-4) {
          const pivot = soles[s][f.roll > 0 ? 'heel' : 'toe'].clone().applyAxisAngle(Y, yaw);
          ankle.add(pivot).sub(pivot.clone().applyAxisAngle(lateral, -f.roll));
        }
        const hip = B['thigh.' + s].getWorldPosition(new THREE.Vector3()).applyMatrix4(mInv);
        const horizontal = Math.hypot(ankle.x - hip.x, ankle.z - hip.z);
        const length = LEG[s].L1 + LEG[s].L2 - .004;
        const maxHeight = Math.sqrt(Math.max(0, length * length - horizontal * horizontal));
        pelvisDrop = Math.max(pelvisDrop, hip.y - ankle.y - maxHeight);
      }
      targets[s] = { ankle, yaw, lateral };
    }
    if (pbr) {
      const need = Math.min(.16, pelvisDrop);
      G.reachDrop = Math.max(need, (G.reachDrop || 0) * Math.exp(-dt * 15));
      B.hips.position.add(tmp.set(0, -G.reachDrop, 0).applyQuaternion(parentQInv));
    }
    B.hips.updateMatrixWorld(true);
    for (const s of ['L', 'R']) {
      const f = G.feet[s];
      const { ankle, yaw, lateral } = targets[s];
      const hipM = B['thigh.' + s].getWorldPosition(new THREE.Vector3()).applyMatrix4(mInv);
      const pole = new THREE.Vector3(Math.sin(yaw) + (s === 'L' ? 0.12 : -0.12), 0, Math.cos(yaw));
      const { L1, L2 } = LEG[s];
      if (pbr && ankle.distanceTo(hipM) > L1 + L2 - .001) {
        ankle.sub(hipM).setLength(L1 + L2 - .001).add(hipM);
      }
      const k = ik(hipM, ankle, L1, L2, pole).clone();
      const thighQ = qFrom(restDir['thigh' + s], k.clone().sub(hipM)).multiply(rest['thigh.' + s].q);
      setModel('thigh.' + s, thighQ);
      setModel('shin.' + s, qFrom(restDir['shin' + s], ankle.clone().sub(k)).multiply(rest['shin.' + s].q));
      setModel('foot.' + s, delta(lateral, -f.roll, delta(Y, yaw, rest['foot.' + s].q)));
      const toeCurl = -Math.max(0, f.roll) * 0.9;
      setModel('toe.' + s, delta(lateral, toeCurl, modelQ['foot.' + s].clone().multiply(rest['toe.' + s].local)));
    }
    // ---- the arms: against the legs
    const um = G.umb;
    for (const s of ['L', 'R']) {
      const side = s === 'L' ? 1 : -1;
      const legZ = s === 'L' ? fl.z : fr.z;
      let flex = clamp(-legZ * (0.75 + 1.2 * runK), -0.45, 0.65) * (moving ? 1 : 0) + (moving ? 0.05 : 0.02 * Math.sin(G.time * 0.7 + side));
      let bend = 0.2 + 0.08 * walkK + 1.25 * runK + Math.max(0, flex) * 0.5;
      const bindArmOffset = pbr ? -0.44 : 0;
      let abd = 0.06 + 0.1 * runK + G.air * 0.3;
      if (s === 'R' && um > 0.01) { flex = flex * (1 - um) + 0.75 * um; bend = bend * (1 - um) + 1.55 * um; abd = abd * (1 - um) + 0.15 * um; }
      keepRest('shoulder.' + s);
      const spread = (abd + bindArmOffset) * side;
      setModel('upperarm.' + s, armSwing(rest['upperarm.' + s].q, -flex, spread));
      setModel('forearm.' + s, armSwing(rest['forearm.' + s].q, -flex - bend, spread));
      setModel('hand.' + s, armSwing(rest['hand.' + s].q, -flex - bend * 0.9, spread));
    }
    if (B.bag) {
      const pitch = clamp(-G.accel * .007 + Math.sin(cyc * 2) * (.013 * walkK + .052 * runK), -.11, .11);
      const roll = clamp(wrap(G.yaw - prevYaw) / dt * -.017, -.07, .07);
      const k = 1 - Math.exp(-dt * 9);
      G.bagPitch = THREE.MathUtils.lerp(G.bagPitch || 0, pitch, k);
      G.bagRoll = THREE.MathUtils.lerp(G.bagRoll || 0, roll, k);
      setModel('bag', delta(Z, G.bagRoll, delta(X, G.bagPitch, modelQ.chest.clone().multiply(rest.bag.local))));
    }
    // the umbrella opens and closes
    const want = G.umbWant ? 1 : 0;
    G.umb += (want - G.umb) * (1 - Math.exp(-dt * 2.2));
    umb.visible = G.umb > 0.05;
    if (umb.visible) {
      const k = smooth((G.umb - 0.05) / 0.95);
      umb.userData.canopy.scale.set(0.25 + 0.75 * k, 0.6 + 0.4 * k, 0.25 + 0.75 * k);
      // held upright in world terms whatever the hand does
      B['hand.R'].updateMatrixWorld(true);
      umb.quaternion.copy(B['hand.R'].getWorldQuaternion(qb).invert());
    }
  }

  return {
    root, model, skinned, outline, G, clips: gltf.animations,
    update,
    lookAt(yaw, pitch, weight = 1) { G.look.ty = yaw; G.look.tp = pitch; G.look.tw = weight; },
    setVisible(v) { model.visible = v; blob.visible = v; },
    setUmbrella(on) { G.umbWant = on; },
  };
}

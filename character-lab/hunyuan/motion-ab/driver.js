import * as T from 'three';
import { createProceduralHuman } from './vendor/procedural-locomotion.min.js';

const vec = () => new T.Vector3();
const quat = () => new T.Quaternion();
const up = new T.Vector3(0, 1, 0);
const forward = new T.Vector3(0, 0, 1);
const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const clamp = T.MathUtils.clamp;
const damp = (rate, dt) => -Math.expm1(-rate * dt);
const sides = ['L', 'R'];

// Skeleton mapping and STUDENT tuning from lanren/life/gait.js at cf3abad.
// The preview uses the same PBR model in both panes, so it bypasses that wrapper's cel material.
const mapping = {
  hips: 'hips',
  left: { thigh: 'thigh.L', shin: 'shin.L', foot: 'foot.L', toe: 'toe.L' },
  right: { thigh: 'thigh.R', shin: 'shin.R', foot: 'foot.R', toe: 'toe.R' },
  spine: 'spine', chest: 'chest', neck: 'neck', head: 'head',
  leftArm: { shoulder: 'shoulder.L', upperArm: 'upperarm.L', forearm: 'forearm.L', hand: 'hand.L' },
  rightArm: { shoulder: 'shoulder.R', upperArm: 'upperarm.R', forearm: 'forearm.R', hand: 'hand.R' },
};
const config = {
  walkSpeed: 1.5, runStartSpeed: 1.95, runTransition: .7, runSpeed: 3.9,
  acceleration: 2.4, deceleration: 4, speedEasing: .22,
  turnSpeed: 200, turnAcceleration: 900, maxLateralAcceleration: 4.2,
  stepFrequency: 1.95, stepHeight: .05,
  runStepLength: 1.45, runStepFrequency: 2.95, runCrouch: .045, runBounce: .035, runLean: 9,
  armSwing: 14, elbowBend: 26, armAbduction: 4, idleArmAbduction: 7, jumpSpeed: 3.6,
};
const bone = (model, name) => {
  const node = model.getObjectByName(name);
  if (!node) throw new Error('Missing bone ' + name);
  return node;
};
export function makeBaseline(model, heightAt) {
  const ground = { castDown(origin, maxDistance, hit) {
    const y = heightAt(origin.x, origin.z);
    if (origin.y - y > maxDistance) return false;
    hit.point.set(origin.x, y, origin.z);
    hit.normal.copy(up);
    hit.distance = origin.y - y;
    return true;
  } };
  const human = createProceduralHuman({ model, mapping, ground, config, seed: 1, forward });
  const base = human.position.clone();
  return { human, step(intent, dt) {
    human.targetSpeed = intent.speed;
    human.targetHeading = human.heading + wrap(intent.yaw - human.heading);
    human.update(dt);
  }, reset() {
    model.position.copy(base);
    model.quaternion.identity();
    model.updateMatrixWorld(true);
    human.reset();
    human.targetSpeed = 0;
    human.targetHeading = human.heading;
  } };
}

function leg(model, side) {
  const thigh = bone(model, 'thigh' + side), knee = bone(model, 'shin' + side);
  const ankle = bone(model, 'foot' + side), toe = bone(model, 'toe' + side);
  const pos = node => node.getWorldPosition(vec());
  const a = pos(ankle), t = pos(toe);
  const heel = ankle.worldToLocal(a.clone().setY(0).addScaledVector(forward, -.052));
  const ball = toe.worldToLocal(t.clone().setY(0));
  return { thigh, knee, ankle, toe, heel, ball, upper: pos(thigh).distanceTo(pos(knee)), lower: pos(knee).distanceTo(a) };
}
function support(limb, heightAt) {
  const points = {
    heel: limb.ankle.localToWorld(limb.heel.clone()),
    ball: limb.toe.localToWorld(limb.ball.clone()),
  };
  const gaps = Object.fromEntries(Object.entries(points).map(([key,p]) => [key, p.y - heightAt(p.x,p.z)]));
  const pivot = gaps.heel <= gaps.ball ? 'heel' : 'ball';
  return { point: points[pivot], gap: gaps[pivot], pivot };
}
function orient(node, desired) {
  node.quaternion.copy(node.parent.getWorldQuaternion(quat()).invert().multiply(desired));
  node.updateWorldMatrix(false, true);
}

function solve(limb, goal, footQ, toeQ, forwardModel) {
  const hip = limb.thigh.getWorldPosition(vec());
  const knee = limb.knee.getWorldPosition(vec());
  const axis = goal.clone().sub(hip);
  const distance = clamp(axis.length(), Math.abs(limb.upper-limb.lower)+.001, limb.upper+limb.lower-.001);
  axis.normalize();
  const ankle = hip.clone().addScaledVector(axis,distance);
  // Preferred bend follows the retargeted knee plane, with a forward pole when nearly straight.
  const bend = knee.clone().sub(hip);
  bend.addScaledVector(axis,-bend.dot(axis));
  if (bend.lengthSq() < .0009 || bend.dot(forwardModel) < 0) {
    bend.copy(forwardModel).addScaledVector(axis,-forwardModel.dot(axis));
  }
  bend.normalize();
  const onAxis = (limb.upper**2 - limb.lower**2 + distance**2) / (2*distance);
  const kneeGoal = hip.clone().addScaledVector(axis,onAxis).addScaledVector(bend,Math.sqrt(Math.max(0,limb.upper**2-onAxis**2)));
  for (const [joint, child, target] of [[limb.thigh,limb.knee,kneeGoal],[limb.knee,limb.ankle,ankle]]) {
    const at = joint.getWorldPosition(vec());
    const delta = quat().setFromUnitVectors(child.getWorldPosition(vec()).sub(at).normalize(),target.clone().sub(at).normalize());
    orient(joint,delta.multiply(joint.getWorldQuaternion(quat())));
  }
  orient(limb.ankle,footQ);
  orient(limb.toe,toeQ);
}

export function makeHybrid(baselineModel, model, library, heightAt, guideHuman) {
  baselineModel.updateMatrixWorld(true);
  model.updateMatrixWorld(true);
  const limbs = Object.fromEntries(sides.map(side => [side, leg(model, side)]));
  const guides = Object.fromEntries(sides.map(side => [side, leg(baselineModel, side)]));
  const hips = bone(model,'hips');
  const driven = ['hips','spine','chest','neck','head','shoulderL','upperarmL','forearmL','handL',
    'shoulderR','upperarmR','forearmR','handR'];
  const guidePose = driven.map(key => bone(baselineModel,key));
  const clipPose = driven.map(key => bone(model,key));
  const hipsGuide = guidePose[0];
  const mixer = new T.AnimationMixer(model);
  const clips = Object.fromEntries(Object.entries(library.clips).map(([name,data]) => {
    const loop = ['idle','walk','jog','run'].includes(name);
    const clip = T.AnimationClip.parse(data.animation);
    const action = mixer.clipAction(clip).setLoop(loop ? T.LoopRepeat : T.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    return [name,action];
  }));
  const contact = Object.fromEntries(sides.map(side => [side, { lock: 0, planted: false }]));
  let state, previousIntent = 0, previousYaw = 0, smoothedSpeed = 0, remaining = 0, pelvis = 0;
  let poseWeight = .92;
  let strideRateNudge = 0;

  function select(next, seconds=.19) {
    if (next === state) return;
    const old = clips[state], action = clips[next];
    action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    if (old && !old.paused) action.crossFadeFrom(old,seconds,false);
    else if (old) old.stop();
    state = next;
    remaining = ['idle','walk','jog','run'].includes(state) ? 0 : action.getClip().duration - .08;
  }

  function update(intent, speed, dt) {
    model.position.copy(baselineModel.position);
    model.quaternion.copy(baselineModel.quaternion);
    const yawChange = wrap(intent.yaw - previousYaw);
    const early = Math.abs(yawChange) > .55;
    smoothedSpeed += (speed - smoothedSpeed) * damp(14,dt);
    remaining = Math.max(0, remaining - dt);
    if (early) select(yawChange > 0 ? 'left' : 'right', .12);
    else if (intent.speed > 2.8 && previousIntent < 2.5) select('start',.14);
    else if (intent.speed < .05 && previousIntent > 2.0) select('stop',.15);
    else if (remaining === 0) {
      const next = smoothedSpeed < .18 ? 'idle' : smoothedSpeed < 1.87 ? 'walk' : smoothedSpeed < 2.85 ? 'jog' : 'run';
      select(next, next === 'idle' ? .25 : .19);
    }
    previousIntent = intent.speed;
    previousYaw = intent.yaw;
    const clipSpeed = { walk: 1.42, jog: 2.55, run: 3.75 }[state];
    if (clipSpeed) {
      for (const side of sides) {
        const guide = guideHuman.locomotion.feet[side === 'L' ? 'left' : 'right'];
        if (guide.phase === 'PLANTED' && !contact[side].planted) {
          const action = clips[state], phase = action.time/action.getClip().duration;
          const offset = library.clips[state].offsets[side];
          const difference = wrap((offset-phase)*2*Math.PI)/(2*Math.PI);
          strideRateNudge = clamp(difference * .7,-.18,.18);
        }
      }
      clips[state].setEffectiveTimeScale(clamp(smoothedSpeed/clipSpeed + strideRateNudge,.58,1.34));
    }
    strideRateNudge *= Math.exp(-dt*2.4);
    mixer.update(dt);
    // Apply the sprint-exit pose with a smaller weight as speed drops. The
    // original full clip stays available for analysis and on faster characters.
    const weight = ({start:.69,stop:.56,run:.88,jog:.91})[state] ?? .93;
    poseWeight += (weight-poseWeight)*damp(13,dt);
    for(let i=0;i<clipPose.length;i++) clipPose[i].quaternion.slerp(guidePose[i].quaternion,1-poseWeight);
    hips.position.lerp(hipsGuide.position,1-poseWeight);
    model.updateMatrixWorld(true);

    const fwd = forward.clone().applyQuaternion(model.quaternion);
    const targets = {};
    let maxDrop = 0;
    for (const side of sides) {
      const limb = limbs[side], guide = guides[side];
      const footState = guideHuman.locomotion.feet[side === 'L' ? 'left' : 'right'];
      const c = contact[side];
      c.planted = footState.phase === 'PLANTED';
      c.anchor = footState.planted.clone();
      // The upstream solver owns contact, including heel-toe roll. Fade in
      // clip swing only away from both end points of the airborne segment.
      c.lock = footState.phase === 'SWING' ? 1-Math.sin(Math.PI*clamp(footState.swing.t,0,1))**2 : 1;
      const guidePosition = guide.ankle.getWorldPosition(vec());
      const clipAnkle = limb.ankle.getWorldPosition(vec());
      const goal = guidePosition.clone().lerp(clipAnkle, .46*(1-c.lock));
      const footQ = limb.ankle.getWorldQuaternion(quat()).slerp(guide.ankle.getWorldQuaternion(quat()), c.lock);
      const toeQ = limb.toe.getWorldQuaternion(quat()).slerp(guide.toe.getWorldQuaternion(quat()), c.lock);
      targets[side] = {goal,footQ,toeQ};
      if (c.planted) {
        const h = limb.thigh.getWorldPosition(vec());
        const horizontal = Math.hypot(h.x-goal.x,h.z-goal.z);
        const len = limb.upper+limb.lower-.006;
        maxDrop = Math.max(maxDrop,h.y-goal.y-Math.sqrt(Math.max(0,len*len-horizontal*horizontal)));
      }
    }
    pelvis = Math.max(Math.min(.13,maxDrop),pelvis*Math.exp(-dt*21));
    const hipPos = hips.getWorldPosition(vec());
    hipPos.y -= pelvis;
    hips.position.copy(hips.parent.worldToLocal(hipPos));
    hips.updateWorldMatrix(false,true);
    for (const side of sides) {
      const {goal,footQ,toeQ} = targets[side];
      solve(limbs[side],goal,footQ,toeQ,fwd);
    }
  }
  return { update, get state() { return state; },
    poses() {
      return Object.fromEntries(sides.map(side => [side,{ planted:contact[side].planted, anchor:contact[side].anchor,
        a:support(guides[side],heightAt), b:support(limbs[side],heightAt) }]));
    },
    reset() {
      mixer.stopAllAction();
      for (const side of sides) Object.assign(contact[side],{lock:0,planted:false});
      previousIntent = previousYaw = smoothedSpeed = remaining = pelvis = strideRateNudge = 0;
      poseWeight = .92;
      state = undefined;
      select('idle');
    },
  };
}

import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import {
  CANONICAL_REST, CANONICAL_REST_WORLD, retargetClip,
} from './.inputs/retarget.mjs';

const sourceNames = {
  Hips: 'pelvis', Spine: 'spine_01', Spine2: 'spine_03', Neck: 'neck_01', Head: 'Head',
  LeftShoulder: 'clavicle_l', LeftArm: 'upperarm_l', LeftForeArm: 'lowerarm_l', LeftHand: 'hand_l',
  RightShoulder: 'clavicle_r', RightArm: 'upperarm_r', RightForeArm: 'lowerarm_r', RightHand: 'hand_r',
  LeftUpLeg: 'thigh_l', LeftLeg: 'calf_l', LeftFoot: 'foot_l', LeftToeBase: 'ball_l',
  RightUpLeg: 'thigh_r', RightLeg: 'calf_r', RightFoot: 'foot_r', RightToeBase: 'ball_r',
};
const targetNames = {
  Hips: 'hips', Spine: 'spine', Spine2: 'chest', Neck: 'neck', Head: 'head',
  LeftShoulder: 'shoulderL', LeftArm: 'upperarmL', LeftForeArm: 'forearmL', LeftHand: 'handL',
  RightShoulder: 'shoulderR', RightArm: 'upperarmR', RightForeArm: 'forearmR', RightHand: 'handR',
  LeftUpLeg: 'thighL', LeftLeg: 'shinL', LeftFoot: 'footL', LeftToeBase: 'toeL',
  RightUpLeg: 'thighR', RightLeg: 'shinR', RightFoot: 'footR', RightToeBase: 'toeR',
};
const actions = {
  idle: 'Idle_Loop', walk: 'Walk_Loop', jog: 'Jog_Fwd_Loop', run: 'Sprint_Loop',
  start: 'Sprint_Enter', stop: 'Sprint_Exit', left: 'Turn90_L', right: 'Turn90_R',
};
const quat = () => new T.Quaternion();
const vec = () => new T.Vector3();

function bindData(scene, names) {
  scene.updateMatrixWorld(true);
  const nodes = new Map(Object.entries(names).map(([key, name]) => [key, scene.getObjectByName(name)]));
  if ([...nodes.values()].some(node => !node)) throw new Error('Source or destination rig is missing a mapped joint');
  return {
    nodes,
    local: new Map([...nodes].map(([key, node]) => [key, node.quaternion.clone()])),
    world: new Map([...nodes].map(([key, node]) => [key, node.getWorldQuaternion(quat())])),
  };
}

function toCanonical(source, sourceScene) {
  // Fold the source's extra thoracic joint into the target's chest.
  source.local.get('Spine2').premultiply(sourceScene.getObjectByName('spine_02').quaternion);
  return new Map([...source.nodes].map(([key]) => {
    const rc = quat().fromArray(CANONICAL_REST[key]);
    const wc = quat().fromArray(CANONICAL_REST_WORLD[key]);
    const rs = source.local.get(key);
    const ws = source.world.get(key);
    // Invert the package's canonical-to-source rest transform before calling
    // its canonical-to-target transform. Bind poses and quaternion axes differ.
    return [key, {
      left: rc.clone().multiply(wc.clone().invert()).multiply(ws).multiply(rs.clone().invert()),
      right: ws.clone().invert().multiply(wc),
    }];
  }));
}

const armPairs = [
  ['LeftArm','LeftForeArm'], ['LeftForeArm','LeftHand'], ['LeftHand','index_01_l'],
  ['RightArm','RightForeArm'], ['RightForeArm','RightHand'], ['RightHand','index_01_r'],
];
function heading(rig) {
  const ankle = rig.nodes.get('LeftFoot').getWorldPosition(vec());
  return rig.nodes.get('LeftToeBase').getWorldPosition(vec()).sub(ankle).setY(0).normalize();
}
function fitArms(clip, poseSamples, rig, reference, mixer, times) {
  const action = mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1);
  action.clampWhenFinished = true;
  action.play();
  const tracks = Object.fromEntries(armPairs.map(([key]) => [key,[]]));
  for (let frame=0;frame<times.length;frame++) {
    action.time = times[frame];
    mixer.update(0);
    for (const [key] of armPairs) {
      const bone = rig.nodes.get(key);
      bone.parent.updateWorldMatrix(true,false);
      const direction = poseSamples[frame][key];
      const side = key.startsWith('Left') ? 1 : -1;
      if (side*direction.x < .08) direction.x = side*.08;
      direction.normalize();
      const q = quat().setFromUnitVectors(reference[key],direction).multiply(rig.world.get(key));
      bone.quaternion.copy(bone.parent.getWorldQuaternion(quat()).invert().multiply(q)).normalize();
      bone.quaternion.toArray(tracks[key],tracks[key].length);
    }
  }
  action.stop();
  for (const [key,values] of Object.entries(tracks)) {
    const name = rig.nodes.get(key).name+'.quaternion';
    clip.tracks[clip.tracks.findIndex(track=>track.name===name)] = new T.QuaternionKeyframeTrack(name,times,values);
  }
}

export async function build() {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const [library, avatar, template] = await Promise.all([
    loader.loadAsync('./.inputs/quaternius-ual.glb'),
    loader.loadAsync('../models/student-mid.glb'),
    loader.loadAsync('./.inputs/mesh2motion-human.glb'),
  ]);
  const src = bindData(library.scene, sourceNames);
  const target = bindData(avatar.scene, targetNames);
  const correction = toCanonical(src, library.scene);
  const motion = new T.AnimationMixer(library.scene);
  const destMap = new Map([...target.nodes].map(([key, node]) => [key, node.name]));
  const hip = target.nodes.get('Hips');
  const scale = hip.getWorldPosition(vec()).y / src.nodes.get('Hips').getWorldPosition(vec()).y;
  const up = vec().set(0, 1, 0).applyQuaternion(hip.parent.getWorldQuaternion(quat()).invert());
  const initialHip = hip.position.clone();
  const initialSourceHip = src.nodes.get('Hips').getWorldPosition(vec()).y;
  const extra = library.scene.getObjectByName('spine_02');
  const templateBones = bindData(template.scene,{...sourceNames,Head:'head'});
  const templateMap = new Map([...templateBones.nodes].map(([key,node]) => [key,node.name]));
  const templateMixer = new T.AnimationMixer(template.scene);
  const targetMixer = new T.AnimationMixer(avatar.scene);
  const align = quat().setFromUnitVectors(heading(src), heading(target));
  const sourceRoot = library.scene.getObjectByName('root');
  const sourceRootBind = sourceRoot.getWorldQuaternion(quat());
  const armBindDirections = Object.fromEntries(armPairs.map(([key,child]) => {
    const q = target.world.get(key);
    if (key.endsWith('Hand')) return [key, vec().set(0,1,0).applyQuaternion(q).normalize()];
    return [key,target.nodes.get(child).getWorldPosition(vec()).sub(target.nodes.get(key).getWorldPosition(vec())).normalize()];
  }));
  const templateMatches = { count:templateMap.size, verifiedClips:0 };
  const report = {};
  const clips = {};
  for (const [state, name] of Object.entries(actions)) {
    const clip = library.animations.find(clip => clip.name === name);
    if (!clip) throw new Error('Missing Quaternius clip: ' + name);
    const action = motion.clipAction(clip).reset().setLoop(T.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    const frames = Math.max(2, Math.ceil(clip.duration * 30));
    const times = Array.from({ length: frames + 1 }, (_, i) => clip.duration * i / frames);
    const samples = new Map([...src.nodes.keys()].map(key => [key, []]));
    const hipPositions = [], armTargets = [];
    const soles = { L: [], R: [] };
    for (const time of times) {
      action.time = time;
      motion.update(0);
      library.scene.updateMatrixWorld(true);
      for (const [key, bone] of src.nodes) {
        const { left, right } = correction.get(key);
        const sourcePose = bone.quaternion.clone();
        if (key === 'Spine2') sourcePose.premultiply(extra.quaternion);
        sourcePose.premultiply(left).multiply(right).normalize().toArray(samples.get(key), samples.get(key).length);
      }
      const intoAvatar = align.clone().multiply(sourceRootBind).multiply(sourceRoot.getWorldQuaternion(quat()).invert());
      armTargets.push(Object.fromEntries(armPairs.map(([key,child]) => {
        const from = src.nodes.get(key).getWorldPosition(vec());
        const goal = src.nodes.get(child) || library.scene.getObjectByName(child);
        return [key,goal.getWorldPosition(vec()).sub(from).applyQuaternion(intoAvatar).normalize()];
      })));
      const sourceY = src.nodes.get('Hips').getWorldPosition(vec()).y - initialSourceHip;
      initialHip.clone().addScaledVector(up, T.MathUtils.clamp(sourceY * scale, -.12, .075)).toArray(hipPositions, hipPositions.length);
      soles.L.push(src.nodes.get('LeftFoot').getWorldPosition(vec()).y);
      soles.R.push(src.nodes.get('RightFoot').getWorldPosition(vec()).y);
    }
    action.stop();
    const canonical = new T.AnimationClip(state, clip.duration,
      [...samples].map(([key, values]) => new T.QuaternionKeyframeTrack(key + '.quaternion', times, values)));
    const result = retargetClip(canonical, destMap, {
      targetRest: target.local, targetWorldRest: target.world, minCoverage: 1,
    });
    if (!result.clip || result.matched !== 21) throw new Error('Incomplete retarget: ' + name);
    result.clip.tracks.push(new T.VectorKeyframeTrack(hip.name + '.position', times, hipPositions));
    fitArms(result.clip,armTargets,target,armBindDirections,targetMixer,times);
    const templateAction = retargetClip(canonical,templateMap,{
      targetRest:templateBones.local,targetWorldRest:templateBones.world,minCoverage:1,
    }).clip;
    const preview = templateMixer.clipAction(templateAction).play();
    preview.time = templateAction.duration*.39;
    templateMixer.update(0);
    const rotation = templateBones.nodes.get('LeftArm').quaternion;
    if (![rotation.x,rotation.y,rotation.z,rotation.w].every(Number.isFinite) ||
        Math.abs(rotation.lengthSq()-1) > .002) throw new Error('Mesh2Motion template rotation is invalid');
    preview.stop();
    templateMatches.verifiedClips++;

    const offsets = {};
    for (const side of ['L','R']) {
      const y = soles[side];
      // The lowest early frame with the foot moving towards the floor identifies
      // a contact phase. The procedural solver owns whether a foot is planted.
      const low = Math.min(...y), high = Math.max(...y), edge = low + .16 * (high-low);
      const first = y.findIndex((sample,i) => i > 0 && sample < edge && y[i-1] >= edge);
      offsets[side] = first < 0 ? 0 : first / frames;
    }
    const animation = T.AnimationClip.toJSON(result.clip);
    animation.uuid = 'haiz-ual1-'+state;
    clips[state] = { animation, offsets, source: name };
    report[state] = { source: name, seconds: clip.duration, samples: times.length, mappedRotations: result.matched, offsets };
  }
  return { source: 'Quaternius Universal Animation Library 1 (in place)', target: 'HAIZ Hunyuan LOD 1',
    templateMatches, report, clips };
}

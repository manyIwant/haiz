import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import module from 'node:module';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const THREE_URL = pathToFileURL(path.join(REPO, 'lanren/vendor/three/three.module.min.js')).href;

// Map bare 'three' specifier in Node ESM tests to the repository's vendored Three.js module
module.registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'three') return { url: THREE_URL, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const THREE = await import(THREE_URL);
const { TurnCascadeController } = await import(pathToFileURL(path.join(REPO, 'living-character/engine/turn-cascade.js')).href);
const { MultiSurfaceGroundDetector, sampleDiscreteStairs } = await import(pathToFileURL(path.join(REPO, 'living-character/engine/foot-ik-terrain.js')).href);
const { SecondaryMotionSystem } = await import(pathToFileURL(path.join(REPO, 'living-character/engine/secondary-motion.js')).href);

test('haiz-motion-pack.json has all 14 valid clips with cyclic continuity', async () => {
  const pack = JSON.parse(await fs.readFile(path.join(REPO, 'living-character/assets/motion/haiz-motion-pack.json'), 'utf8'));
  const expected = [
    'idle_relaxed', 'idle_look_around', 'idle_talk',
    'walk_slow', 'walk_normal', 'jog_normal', 'run_fast',
    'start_walk', 'stop_walk', 'turn_90_l', 'turn_90_r',
    'stair_up', 'stair_down', 'cmu_walk_turn',
  ];
  for (const k of expected) {
    assert.ok(pack.clips[k], `missing clip ${k}`);
    assert.ok(pack.clips[k].frames >= 15, `${k} too short`);
    assert.ok(pack.clips[k].tracks?.spine?.length === pack.clips[k].frames);
  }
});

test('TurnCascadeController leads with head before chest and never mutates hips', () => {
  const mkBone = (name, parent = null) => {
    const b = new THREE.Bone();
    b.name = name;
    if (parent) parent.add(b);
    return b;
  };
  const hips = mkBone('hips');
  const spine = mkBone('spine', hips);
  const chest = mkBone('chest', spine);
  const neck = mkBone('neck', chest);
  const head = mkBone('head', neck);

  const hipsInitQ = hips.quaternion.clone();
  const cascade = new TurnCascadeController({ hips, spine, chest, neck, head });
  const fakeHuman = {
    heading: 0,
    speed: 0,
    locomotion: { body: { state: { angularVelocity: 0 } } },
  };
  cascade.preUpdate(fakeHuman, Math.PI * 0.5, 0, 0.05);
  cascade.postUpdate(fakeHuman, 0.08);

  assert.ok(Math.abs(cascade.debug.headYawDeg) > Math.abs(cascade.debug.chestYawDeg),
    `Expected head (${cascade.debug.headYawDeg}) to lead chest (${cascade.debug.chestYawDeg})`);
  assert.ok(hips.quaternion.angleTo(hipsInitQ) < 1e-6, 'TurnCascade must never mutate hips');
});

test('MultiSurfaceGroundDetector and sampleDiscreteStairs return flat steps & slope normals', () => {
  const flights = [{ minX: -2, maxX: 2, minZ: 0, maxZ: 3.4, axis: 'z', yStart: 0, yEnd: 1.5, steps: 10 }];
  const y0 = sampleDiscreteStairs(flights, 0, 0.1);
  const y1 = sampleDiscreteStairs(flights, 0, 0.25);
  const y2 = sampleDiscreteStairs(flights, 0, 0.5);
  assert.equal(y0, y1, 'Points on first tread must share exact quantized height');
  assert.ok(y2 > y1, 'Second tread must step up');

  const detector = new MultiSurfaceGroundDetector({
    analyticalHeight: (x, z, _refY, n) => {
      const sh = sampleDiscreteStairs(flights, x, z);
      if (sh !== null) { n.set(0, 1, 0); return sh; }
      n.set(0, 1, -0.2).normalize();
      return z * 0.2;
    },
  });
  const hit = { point: new THREE.Vector3(), normal: new THREE.Vector3(), distance: 0 };
  const ok = detector.castDown(new THREE.Vector3(0, 2, 0.25), 5, hit);
  assert.equal(ok, true);
  assert.equal(hit.normal.y, 1);
  assert.ok(Math.abs(hit.point.y - 0.15) < 1e-4);
});

test('SecondaryMotionSystem clears crossbody bag away from swinging right thigh', () => {
  const bones = {
    bag_body: new THREE.Bone(),
    crossbody_bag: new THREE.Bone(),
    hair_fringe: new THREE.Bone(),
    hair_back: new THREE.Bone(),
    shirt_hem_f: new THREE.Bone(),
    shirt_hem_b: new THREE.Bone(),
  };
  const sec = new SecondaryMotionSystem(bones);
  for (let i = 0; i < 30; i++) {
    sec.update(1 / 60, {
      velocity: new THREE.Vector3(0, 0, 1.4),
      heading: 0,
      speed: 1.4,
      rightThighForward: 0.45,
      strideAmplitude: 0.8,
    });
  }
  assert.ok(sec.springs.crossbody_bag.z > 0.03, `Expected outward satchel clearance z=${sec.springs.crossbody_bag.z}`);
});

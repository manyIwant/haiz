import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

const sourceURL = new URL('../public/haiz/world/v3/core.js', import.meta.url);
const source = readFileSync(sourceURL, 'utf8');

function loadCore() {
  const window = {};
  runInNewContext(source, { window }, { filename: fileURLToPath(sourceURL) });
  assert.ok(window.HaizV3Core, 'the browser global exposes the pure module');
  return window.HaizV3Core;
}

const plain = value => JSON.parse(JSON.stringify(value));
const near = (actual, expected, tolerance = 1e-10) => {
  assert.ok(Number.isFinite(actual), `expected a finite number, received ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

const idle = () => ({ velocity: { x: 0, z: 0 } });
const rectangle = (height, minZ = 0, maxZ = 6) => ({
  minX: -1, maxX: 1, minZ, maxZ, height,
});
const ramp = () => ({
  minX: -1, maxX: 1, minZ: 0, maxZ: 6,
  from: { x: 0, z: 0, y: 0 }, to: { x: 0, z: 6, y: 3.6 },
});

test('core loads with window alone and exposes the four public helpers', () => {
  const core = loadCore();
  for (const name of ['qualityConfig', 'stepMotion', 'floorHeight', 'blendClimate']) {
    assert.equal(typeof core[name], 'function', name);
  }
});

for (const [tier, dprCap, shadowSize, shadowRadius, vegetationDistance, anisotropy, maxFps] of [
  ['high', 1.65, 2048, 58, 280, 8, 60],
  ['balanced', 1.2, 1024, 45, 190, 4, 45],
  ['low', .85, 0, 0, 110, 2, 30],
]) {
  test(`${tier} quality returns its declared rendering budgets and caps pixel ratio`, () => {
    const core = loadCore();
    assert.deepEqual(plain(core.qualityConfig(tier, 3)), {
      tier, dprCap, pixelRatio: dprCap, shadowSize, shadowRadius,
      vegetationDistance, anisotropy, maxFps,
    });
    assert.equal(core.qualityConfig(tier, .5).pixelRatio, .5);
  });
}

test('invalid quality choices and pixel ratios fall back without prototype lookup', () => {
  const core = loadCore();
  for (const tier of [undefined, null, '', 'auto', '__proto__', 'constructor', 1, {}]) {
    assert.equal(core.qualityConfig(tier).tier, 'balanced');
  }
  for (const ratio of [undefined, null, 0, -1, NaN, Infinity, '2', {}]) {
    assert.equal(core.qualityConfig('balanced', ratio).pixelRatio, 1);
  }
  const changed = core.qualityConfig('high');
  changed.shadowSize = 1;
  assert.equal(core.qualityConfig('high').shadowSize, 2048);
});

test('forward motion integrates exponential acceleration analytically', () => {
  const core = loadCore();
  const result = core.stepMotion(idle(), { x: 0, y: 1 }, 0, .1);
  near(result.velocity.x, 0);
  near(result.velocity.z, -3.1 * (1 - Math.exp(-1)));
  near(result.delta.x, 0);
  near(result.delta.z, -3.1 * (.1 - (1 - Math.exp(-1)) / 10));
  assert.ok(Math.abs(result.velocity.z) < 3.1);
});

test('release brakes at rate fourteen while integrating the remaining travel', () => {
  const core = loadCore();
  const result = core.stepMotion({ velocity: { x: 1, z: -2 } }, {}, 0, .1);
  near(result.velocity.x, Math.exp(-1.4));
  near(result.velocity.z, -2 * Math.exp(-1.4));
  near(result.delta.x, (1 - Math.exp(-1.4)) / 14);
  near(result.delta.z, -2 * (1 - Math.exp(-1.4)) / 14);
});

test('acceleration and braking agree across timestep subdivisions', () => {
  const core = loadCore();
  for (const input of [{ x: .4, y: .8, run: true }, { x: 0, y: 0 }]) {
    const initial = { velocity: { x: 1.2, z: -.3 } };
    const whole = core.stepMotion(initial, input, .7, .1);
    const split = Array.from({ length: 10 }).reduce((previous) => {
      const next = core.stepMotion(previous, input, .7, .01);
      return {
        velocity: next.velocity,
        delta: { x: previous.delta.x + next.delta.x, z: previous.delta.z + next.delta.z },
      };
    }, { ...initial, delta: { x: 0, z: 0 } });
    for (const field of ['velocity', 'delta']) {
      near(split[field].x, whole[field].x);
      near(split[field].z, whole[field].z);
    }
  }
});

test('walking and running settle at 3.1 and 5.8 without a diagonal bonus', () => {
  const core = loadCore();
  for (const [input, expectedSpeed] of [
    [{ x: 0, y: 1 }, 3.1],
    [{ x: 1, y: 1 }, 3.1],
    [{ x: 8, y: 8, run: true }, 5.8],
    [{ x: .5, y: 0 }, 1.55],
    [{ x: 0, y: 1, speedScale: .72 }, 3.1 * .72],
  ]) {
    const result = Array.from({ length: 50 }).reduce(
      state => core.stepMotion(state, input, 0, .1), idle(),
    );
    near(Math.hypot(result.velocity.x, result.velocity.z), expectedSpeed);
  }
});

test('yaw rotates forward and side input using the retained camera convention', () => {
  const core = loadCore();
  const forward = core.stepMotion(idle(), { y: 1 }, Math.PI / 2, .1);
  const side = core.stepMotion(idle(), { x: 1 }, Math.PI / 2, .1);
  assert.ok(forward.velocity.x < 0);
  near(forward.velocity.z, 0);
  near(side.velocity.x, 0);
  assert.ok(side.velocity.z < 0);
});

test('reversal approaches the new desired velocity without overshoot', () => {
  const core = loadCore();
  const result = core.stepMotion({ velocity: { x: 3.1, z: 0 } }, { x: -1 }, 0, .1);
  near(result.velocity.x, -3.1 + 6.2 * Math.exp(-1));
  assert.ok(result.velocity.x > -3.1 && result.velocity.x < 3.1);
});

test('nonpositive and invalid time preserve velocity and produce no displacement', () => {
  const core = loadCore();
  for (const seconds of [0, -1, undefined, null, NaN, Infinity, '0.1']) {
    const state = { velocity: { x: 1, z: 2 } };
    const result = core.stepMotion(state, { x: 1 }, 0, seconds);
    assert.deepEqual(plain(result), { velocity: { x: 1, z: 2 }, delta: { x: 0, z: 0 } });
    assert.notEqual(result.velocity, state.velocity);
  }
  const input = { y: 1 };
  assert.deepEqual(plain(core.stepMotion(idle(), input, 0, 100)), plain(core.stepMotion(idle(), input, 0, .1)));
});

test('motion safely handles absent, malformed and nonfinite values', () => {
  const core = loadCore();
  for (const state of [undefined, null, {}, { velocity: null }, { velocity: { x: NaN, z: Infinity } }]) {
    for (const input of [undefined, null, {}, { x: NaN, y: Infinity }]) {
      const result = core.stepMotion(state, input, NaN, .1);
      near(Math.hypot(result.velocity.x, result.velocity.z), 0);
      near(Math.hypot(result.delta.x, result.delta.z), 0);
    }
  }
  for (const speedScale of [null, NaN, Infinity, '2']) {
    const actual = core.stepMotion(idle(), { x: 1, speedScale }, 0, .1);
    near(actual.velocity.x, core.stepMotion(idle(), { x: 1 }, 0, .1).velocity.x);
  }
  const stopped = core.stepMotion(idle(), { x: 1, speedScale: -1 }, 0, .1);
  near(stopped.velocity.x, 0);
});

test('motion is deterministic and returns independent objects without mutating inputs', () => {
  const core = loadCore();
  const state = freeze({ velocity: { x: .1, z: -.2 } });
  const input = freeze({ x: .3, y: .7, run: true });
  const a = core.stepMotion(state, input, .4, .03);
  const b = core.stepMotion(state, input, .4, .03);
  assert.deepEqual(plain(a), plain(b));
  assert.notEqual(a, b);
  assert.notEqual(a.velocity, b.velocity);
  assert.notEqual(a.delta, b.delta);
  assert.notEqual(a.velocity, state.velocity);
});

test('flat walk surfaces support inclusive boundaries and reject excessive steps', () => {
  const core = loadCore();
  const surfaces = freeze([rectangle(.24)]);
  near(core.floorHeight(0, 3, surfaces, 0), .24);
  near(core.floorHeight(1, 6, surfaces, 0), .24);
  near(core.floorHeight(1.001, 3, surfaces, 0), 0);
  near(core.floorHeight(0, 3, [rectangle(.241)], 0), 0);
  near(core.floorHeight(0, 3, [rectangle(0)], .24), 0);
  near(core.floorHeight(0, 3, [rectangle(0)], .241), .241);
});

test('a rectangular ramp rises from zero to 3.6 and preserves the fixed eye offset', () => {
  const core = loadCore();
  const surfaces = freeze([rectangle(0), ramp(), rectangle(3.6, 6, 8)]);
  const ascent = Array.from({ length: 31 }, (_, i) => i * .2).reduce((previous, z) => {
    const height = core.floorHeight(0, z, surfaces, previous);
    near(height, z * .6);
    near(height + 1.85, z * .6 + 1.85);
    return height;
  }, 0);
  near(ascent, 3.6);
  near(core.floorHeight(0, 7, surfaces, ascent), 3.6);
  const descent = Array.from({ length: 31 }, (_, i) => 6 - i * .2).reduce((previous, z) => {
    const height = core.floorHeight(0, z, surfaces, previous);
    near(height, z * .6);
    return height;
  }, 3.6);
  near(descent, 0);
});

test('ramp height uses endpoint direction and rejects disconnected upper support', () => {
  const core = loadCore();
  const reversed = {
    minX: 0, maxX: 6, minZ: -1, maxZ: 1,
    from: { x: 6, z: 0, y: 0 }, to: { x: 0, z: 0, y: 3.6 },
  };
  near(core.floorHeight(3, 0, [reversed], 1.7), 1.8);
  near(core.floorHeight(0, 3, [ramp()], 0), 0);
  near(core.floorHeight(1.01, 3, [ramp()], 1.7), 1.7);
  near(core.floorHeight(0, 3, [rectangle(0), rectangle(3.6)], 0), 0);
  near(core.floorHeight(0, 3, [rectangle(.1), rectangle(.2)], 0), .2);
  near(core.floorHeight(0, 3, [rectangle(.2), rectangle(.1)], 0), .2);
});

test('malformed geometry and missing surfaces cannot introduce invalid floor heights', () => {
  const core = loadCore();
  for (const surfaces of [undefined, null, {}, [], [null], [rectangle(NaN)], [rectangle(0, 6, 0)]]) {
    near(core.floorHeight(0, 3, surfaces, 1), 1);
  }
  const invalidRamps = [
    { ...ramp(), to: null },
    { ...ramp(), from: { x: 0, z: 0, y: 0 }, to: { x: 0, z: 0, y: 2 } },
    { ...ramp(), to: { x: 0, z: 6, y: Infinity } },
  ];
  for (const surface of invalidRamps) near(core.floorHeight(0, 3, [surface], 1), 1);
  near(core.floorHeight(NaN, 3, [rectangle(0)], 1), 1);
  near(core.floorHeight(0, Infinity, [rectangle(0)], 1), 1);
  near(core.floorHeight(0, 3, [], NaN), 0);
});

test('climate blends numeric fields, vectors and nested values without adding bloom', () => {
  const core = loadCore();
  const from = freeze({ exposure: 1, power: 1, wet: 0, offset: [0, 2, 4], sun: { x: 0, y: 2, z: 4 } });
  const to = freeze({ exposure: 1.2, power: 3, wet: 1, offset: [2, 4, 6], sun: { x: 2, y: 4, z: 6 } });
  assert.deepEqual(plain(core.blendClimate(from, to, .5)), {
    exposure: 1.1, power: 2, wet: .5, offset: [1, 3, 5], sun: { x: 1, y: 3, z: 5 },
  });
  assert.deepEqual(plain(core.blendClimate(from, to, 0)), plain(from));
  assert.deepEqual(plain(core.blendClimate(from, to, 1)), plain(to));
  assert.equal(Object.hasOwn(core.blendClimate(from, to, .5), 'bloom'), false);
});

test('climate clamps interpolation progress and preserves valid fog ordering', () => {
  const core = loadCore();
  const from = { near: 100, far: 300 }, to = { near: 200, far: 500 };
  for (const progress of [0, -1, NaN, undefined, null, Infinity, '.5']) {
    assert.deepEqual(plain(core.blendClimate(from, to, progress)), from);
  }
  assert.deepEqual(plain(core.blendClimate(from, to, 2)), to);
  for (const progress of [0, .25, .5, .75, 1]) {
    const result = core.blendClimate(from, to, progress);
    assert.ok(result.near < result.far);
  }
});

test('climate safely handles missing fields and omits nonnumeric or forbidden fields', () => {
  const core = loadCore();
  const from = JSON.parse('{"exposure":1,"name":"晨光","__proto__":{"polluted":1},"bloom":2}');
  const to = { exposure: NaN, wet: 1, name: '雨后', bloomStrength: 2, constructor: { polluted: 1 } };
  assert.deepEqual(plain(core.blendClimate(from, to, .5)), { exposure: 1, wet: 1 });
  assert.deepEqual(plain(core.blendClimate(null, undefined, .5)), {});
  assert.deepEqual(plain(core.blendClimate({}, { offset: [2, 4, 6], rain: .5 }, .5)), { offset: [2, 4, 6], rain: .5 });
  assert.deepEqual(plain(core.blendClimate({ offset: [0, 2, 4] }, {}, .5)), { offset: [0, 2, 4] });
  assert.deepEqual(plain(core.blendClimate({ wet: NaN }, { wet: Infinity }, .5)), {});
});

test('climate retargets continuously and returns fresh nested values', () => {
  const core = loadCore();
  const from = freeze({ wet: 0, offset: [0, 2, 4] });
  const firstTarget = freeze({ wet: 1, offset: [2, 4, 6] });
  const current = core.blendClimate(from, firstTarget, .4);
  const newTarget = { wet: .2, offset: [4, 6, 8] };
  const retarget = core.blendClimate(current, newTarget, 0);
  assert.deepEqual(plain(retarget), plain(current));
  assert.notEqual(retarget, current);
  assert.notEqual(retarget.offset, current.offset);
  assert.deepEqual(plain(from), { wet: 0, offset: [0, 2, 4] });
});

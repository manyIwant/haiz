import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = name => readFileSync(new URL(`../public/haiz/world/${name}`, import.meta.url), 'utf8');
const bounds = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };
const near = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
const plain = value => JSON.parse(JSON.stringify(value));
const rectangle = (minX, maxX, minZ, maxZ, height) => ({ minX, maxX, minZ, maxZ, height });
const flat = rectangle(-14.4, 14.4, -13.3, 13.3, 3.8);
const stairs = [
  rectangle(-14.4, -1.45, -13.3, 13.3, 3.8),
  rectangle(1.45, 14.4, -13.3, 13.3, 3.8),
  rectangle(-1.45, 1.45, -13.3, 2, 3.8),
  rectangle(-1.45, 1.45, 11, 13.2, 3.8),
  { minX: -1.15, maxX: 1.15, minZ: 2.2, maxZ: 11.1,
    from: { x: 0, z: 2.2, y: 0 }, to: { x: 0, z: 10.8, y: 3.8 } },
];

function loadWalker({ surfaces = [], colliders = [], rooms = [], ground = [], worldBounds = bounds } = {}) {
  const calls = [];
  const window = {
    CampusMotion: { RADIUS: .32, blocked(x, z, obstacles, limits, radius) {
      calls.push({ x, z });
      if (x < limits.minX + radius || x > limits.maxX - radius ||
          z < limits.minZ + radius || z > limits.maxZ - radius) return true;
      return obstacles.some(o => {
        const px = Math.max(o.minX, Math.min(x, o.maxX));
        const pz = Math.max(o.minZ, Math.min(z, o.maxZ));
        return (x - px) ** 2 + (z - pz) ** 2 < radius ** 2;
      });
    } },
    CampusInteriors: { currentRoom: (x, z) => x < -20 && z < 0 ? { id: 'legacy-101' } : null },
  };
  runInNewContext(source('v3/core.js'), { window });
  runInNewContext(source('v3/walker.js'), { window });
  const world = { bounds: worldBounds, colliders: ground };
  return { walker: window.HaizV3Walker.create(world, { surfaces, colliders, rooms }), calls, window };
}

function travel(walker, initial, input, seconds, yaw = 0) {
  let state = initial;
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    state = walker.step(state.position, input, yaw, 1 / 60, state.floorY);
  }
  return state;
}

test('missing imported interior preserves usable ground walking instead of crashing fallback', () => {
  const {window}=loadWalker();
  const walker=window.HaizV3Walker.create({bounds,colliders:[]},null);
  const result=walker.step({x:0,z:0},{x:0,y:1},0,.1,0);
  assert.ok(result.position.z<0);assert.equal(result.floorY,0);
});

test('motion accelerates analytically, brakes, and leaves caller state immutable', () => {
  const { walker, window } = loadWalker();
  const pos = Object.freeze({ x: 0, z: 0, y: 1.7 });
  const input = Object.freeze({ x: 0, y: 1 });
  const first = walker.step(pos, input, 0, .1);
  const analytical = window.HaizV3Core.stepMotion({}, input, 0, .1);
  near(first.position.z, analytical.delta.z);
  assert.ok(first.distance > 0 && first.distance < .31);
  near(first.position.y, 1.7);
  assert.deepEqual(pos, { x: 0, z: 0, y: 1.7 });
  const firstVelocity = plain(first.velocity);
  const moving = travel(walker, first, input, 1);
  assert.ok(Math.abs(moving.velocity.z) > Math.abs(first.velocity.z));
  const stopped = travel(walker, moving, { x: 0, y: 0 }, 1);
  assert.ok(Math.abs(stopped.velocity.z) < .001);
  assert.deepEqual(plain(first.velocity), firstVelocity);
});

test('axis substeps slide along ground walls, prevent tunnelling, and clear blocked velocity', () => {
  const wall = { minX: .7, maxX: .71, minZ: -20, maxZ: 20 };
  const { walker } = loadWalker({ ground: [wall] });
  const result = travel(walker, { position: { x: 0, z: 0 }, floorY: 0 }, { x: 1, y: 1, run: true }, 1);
  assert.ok(result.position.x < .39);
  assert.ok(result.position.z < -2);
  near(result.velocity.x, 0);
  assert.ok(result.velocity.z < -1);
  walker.reset();
  const fast = walker.step({ x: 0, z: 0 }, { x: 1, y: 0, speedScale: 30 }, 0, .1);
  assert.ok(fast.position.x < .39);
  near(fast.velocity.x, 0);
});

test('centre stair ascends from ground, reaches the landing, and descends to ground', () => {
  const { walker } = loadWalker({ surfaces: stairs });
  const start = { position: { x: 0, z: 2 }, floorY: 0 };
  const up = travel(walker, start, { x: 0, y: -1 }, 3.2);
  near(up.floorY, 3.8);
  assert.ok(up.position.z > 11.4 && up.position.z < 12.1);
  walker.reset();
  const down = travel(walker, up, { x: 0, y: 1 }, 3.4);
  near(down.floorY, 0);
  assert.ok(down.position.z < 2.2);
});

test('elevated movement cannot leave supports or cut across the stairwell void', () => {
  const { walker } = loadWalker({ surfaces: stairs });
  const outside = travel(walker, { position: { x: -14, z: 0 }, floorY: 3.8 }, { x: -1, y: 0 }, 1);
  assert.ok(outside.position.x >= -14.4);
  near(outside.floorY, 3.8);
  near(outside.velocity.x, 0);
  walker.reset();
  const voidEdge = travel(walker, { position: { x: -2, z: 6 }, floorY: 3.8 }, { x: 1, y: 0 }, 1);
  assert.ok(voidEdge.position.x <= -1.45);
  near(voidEdge.floorY, 3.8);
});

test('ground is not captured by upper slabs and cannot enter a high stair from the side', () => {
  const { walker } = loadWalker({ surfaces: stairs });
  const ground = travel(walker, { position: { x: -8, z: 0 }, floorY: 0 }, { x: 0, y: 1 }, 1);
  near(ground.floorY, 0);
  assert.ok(ground.position.z < -2);
  walker.reset();
  const side = travel(walker, { position: { x: -2, z: 6 }, floorY: 0 }, { x: 1, y: 0 }, 1);
  assert.ok(side.position.x <= -1.15);
  near(side.floorY, 0);
});

test('continuous closest support wins over a higher overlapping surface', () => {
  const { walker } = loadWalker({ surfaces: [rectangle(-5, 5, -5, 5, 3.99), flat] });
  const result = walker.step({ x: 0, z: 0 }, { x: .1, y: 0 }, 0, .1, 3.8);
  near(result.floorY, 3.8);
});

test('upper collisions use body height and ignore legacy furniture and overhead headers', () => {
  const { walker, calls } = loadWalker({ surfaces: [flat],
    ground: [{ minX: -2, maxX: 2, minZ: -2, maxZ: 2 }],
    colliders: [
      { minX: -2, maxX: 2, minZ: -.5, maxZ: -.4, minY: 6.1, maxY: 7.4 },
      { minX: -2, maxX: 2, minZ: -1.5, maxZ: -1.4, minY: 3.8, maxY: 4.6 },
    ] });
  const result = travel(walker, { position: { x: 0, z: 0 }, floorY: 3.8 }, { x: 0, y: 1 }, 1);
  assert.ok(result.position.z < -.6 && result.position.z > -1.09);
  near(result.velocity.z, 0);
  assert.equal(calls.length, 0);
});

test('world bounds apply upstairs and reset removes momentum on pause and teleport', () => {
  const { walker } = loadWalker({ surfaces: [rectangle(-5, 5, -5, 5, 3.8)],
    worldBounds: { minX: -2, maxX: 2, minZ: -2, maxZ: 2 } });
  const edge = travel(walker, { position: { x: 0, z: 0 }, floorY: 3.8 }, { x: 1, y: 0 }, 1);
  assert.ok(edge.position.x <= 1.68);
  near(edge.velocity.x, 0);
  walker.reset();
  const still = walker.step({ x: 0, z: 0 }, { x: 0, y: 0 }, 0, .1, 3.8);
  near(still.distance, 0);
  walker.step(still.position, { x: 1, y: 0 }, 0, .1, 3.8);
  const paused = walker.step({ x: 0, z: 0 }, {}, 0, 0, 3.8);
  near(paused.distance, 0);
  near(paused.velocity.x, 0);
});

test('room lookup distinguishes upper classroom height from ground rooms', () => {
  const room = { id: 'yihao-201', name: '201', minX: -13.8, maxX: -1.8, minZ: -12.9, maxZ: -1.6, minY: 3.8, maxY: 7.4 };
  const { walker } = loadWalker({ rooms: [room] });
  assert.equal(walker.currentRoom(-5, -5, 3.8)?.id, 'yihao-201');
  assert.equal(walker.currentRoom(-5, -5, 0), null);
  assert.equal(walker.currentRoom(-5, -5, 7.4), null);
  assert.equal(walker.currentRoom(-30, -5, 0)?.id, 'legacy-101');
  assert.equal(walker.currentRoom(-30, -5, 3.8), null);
});

function loadTeaching() {
  const sandbox = { window: {} };
  runInNewContext(source('assets/three.min.js'), sandbox);
  const T = sandbox.THREE;
  const materials = Object.fromEntries(['floor', 'wall', 'ceiling', 'desk', 'chair', 'steel', 'frame', 'dark', 'book', 'paper', 'dado']
    .map(key => [key, new T.MeshStandardMaterial()]));
  sandbox.window.THREE = T;
  sandbox.window.CampusInteriors = { materials };
  runInNewContext(source('v3/teaching.js'), sandbox);
  const parent = new T.Group();
  parent.position.set(14.195, 0, -53.59865);
  const legacy = new T.Group();
  parent.add(legacy);
  const world = { buildings: [{ data: { id: 'yihao' }, group: parent }], bounds, colliders: [], rooms: Array(16).fill({ id: 'legacy' }) };
  return { teaching: sandbox.window.HaizV3Teaching.build(world), T, world, parent, legacy };
}

test('teaching build uses real r128 geometry, preserves ground rooms, and batches under 40 draws', () => {
  const { teaching, T, world, parent, legacy } = loadTeaching();
  assert.equal(T.REVISION, '128');
  assert.equal(teaching.group.parent, parent);
  assert.equal(legacy.parent, parent);
  assert.equal(world.rooms.length, 16);
  assert.equal(world.colliders.length, 0);
  assert.equal(teaching.rooms[0].id, 'yihao-201');
  assert.equal(teaching.rooms[0].deskCount, 20);
  near(teaching.rooms[0].minY, 3.8);
  near(teaching.rooms[0].maxY, 7.4);
  let draws = 0;
  teaching.group.traverse(object => {
    assert.ok(!object.isLight);
    if (object.isMesh) draws++;
  });
  assert.ok(draws < 40, `${draws} draw calls`);
  assert.ok(teaching.group.children.some(object => object.isInstancedMesh));
  for (const collider of teaching.colliders) {
    for (const field of ['minX', 'maxX', 'minZ', 'maxZ', 'minY', 'maxY']) assert.ok(Number.isFinite(collider[field]));
  }
});

test('teaching support and doorway geometry are in world coordinates and support the complete stair route', () => {
  const { teaching } = loadTeaching();
  const ox = 14.195, oz = -53.59865;
  const ramp = teaching.surfaces.find(surface => surface.from);
  near(ramp.from.x, ox);
  near(ramp.from.z, oz + 2.2);
  near(ramp.to.z, oz + 10.8);
  near(ramp.to.y, 3.8);
  assert.equal(teaching.stair.treads, 20);
  near(teaching.stair.rise, .19);
  const slabs = teaching.surfaces.filter(surface => !surface.from);
  assert.ok(!slabs.some(surface => ox > surface.minX && ox < surface.maxX && oz + 6 > surface.minZ && oz + 6 < surface.maxZ));
  const wallBlocksDoor = teaching.colliders.some(collider => collider.minY < 5.5 && collider.maxY > 4 &&
    collider.minX < ox - 4.21 && collider.maxX > ox - 5.79 && collider.minZ < oz - 1.6 && collider.maxZ > oz - 1.6);
  assert.equal(wallBlocksDoor, false);
  const { walker } = loadWalker(teaching);
  let state = travel(walker, { position: { x: ox, z: oz + 2 }, floorY: 0 }, { x: 0, y: -1 }, 3.2);
  near(state.floorY, 3.8);
  walker.reset();
  state = travel(walker, state, { x: -1, y: 0 }, .95);
  assert.ok(state.position.x < ox - 2.3);
  walker.reset();
  state = travel(walker, state, { x: 0, y: 1 }, 4);
  assert.ok(state.position.z < oz + 1.5);
  walker.reset();
  state = travel(walker, state, { x: -1, y: 0 }, .86);
  walker.reset();
  state = travel(walker, state, { x: 0, y: 1 }, 1.2);
  assert.equal(walker.currentRoom(state.position.x, state.position.z, state.floorY)?.id, 'yihao-201');
});

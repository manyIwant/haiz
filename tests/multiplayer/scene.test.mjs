import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeFrame } from '../../lanren/map/geo.js';
import { createMapAccess } from '../../lanren/multiplayer/map.js';
import { createRemotePlayers } from '../../lanren/multiplayer/avatars.js';

const campus = JSON.parse(readFileSync(new URL('../../assets/walk/campus.json', import.meta.url)));
const state = { id: 'guest', x: 3, y: -0.8, z: -20, yaw: Math.PI / 2, speed: 4, motion: 'jump' };
test('map derives plan and heading via the existing frame; scene and map use the same sample time', () => {
  const frame = makeFrame(campus, { rotation: -Math.PI / 2 });
  const map = createMapAccess({ getPlayers: ({time}) => [{ ...state, x: time }] }, frame);
  const [p] = map.getPlayers({ time: 3 });
  const w = frame.planToWorld(p.plan.px, p.plan.py);
  assert.ok(Math.abs(w.x - state.x) < 1e-10);
  assert.ok(Math.abs(w.z - state.z) < 1e-10);
  assert.ok(Math.abs(Math.abs(p.campus.yaw) - Math.PI) < 1e-10);
});
test('avatar consumes x/y/z/yaw and motion; leave disposes even if it races asset loading', async () => {
  const adds = [], updates = [];
  let finish, disposed = 0;
  const layer = createRemotePlayers({
    scene: { add: root => adds.push(root) },
    createAvatar: () => new Promise(resolve => { finish = resolve; }),
  });
  const position = [], visual = {
    root: { position: { set: (...p) => position.push(p) }, rotation: {} },
    update: (...args) => updates.push(args), dispose: () => { disposed++; },
  };
  layer.update([state, { ...state, id: 'local', isLocal: true }], { x: 0, z: 0 }, 0.016);
  await Promise.resolve(); finish(visual); await new Promise(resolve => setImmediate(resolve));
  layer.update([state], { x: 0, z: 0 }, 0.016);
  assert.equal(adds.length, 1);
  assert.deepEqual(position.at(-1), [state.x, state.y, state.z]);
  assert.equal(visual.root.rotation.y, state.yaw);
  assert.deepEqual(updates.at(-1), [4, true, 0.016, state]);
  layer.update([], { x: 0, z: 0 }, 0.016);
  assert.equal(disposed, 1);
  layer.update([state], { x: 0, z: 0 }, 0.016);
  await Promise.resolve();
  layer.destroy(); finish(visual); await new Promise(resolve => setImmediate(resolve));
  assert.equal(adds.length, 1);
  assert.equal(disposed, 2);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionEvents, SESSION_EVENT_KEY } from '../../js/session-events.js';

function harness(options = {}) {
  const events = new EventTarget(); const writes = []; const sent = [];
  let channel;
  const notifications = [];
  const bridge = createSessionEvents({
    events, storage: { setItem: (key, value) => { writes.push([key, value]); if (options.failStorage) throw new Error('quota'); } },
    channelFactory: () => { channel = { onmessage: null, postMessage: value => sent.push(value), close() {} }; return channel; },
    onChange: () => notifications.push('changed'), idFactory: () => 'nonsecret-random-epoch',
  });
  return { bridge, events, writes, sent, notifications, get channel() { return channel; } };
}

test('session notices contain only a nonsecret epoch and notify other pages', () => {
  const h = harness(); h.bridge.publish();
  assert.deepEqual(h.writes, [[SESSION_EVENT_KEY, 'nonsecret-random-epoch']]);
  assert.deepEqual(h.sent, ['nonsecret-random-epoch']);
  assert.equal(h.notifications.length, 0);
  h.channel.onmessage({ data: 'another-epoch' });
  assert.equal(h.notifications.length, 1);
  const event = new Event('storage'); Object.defineProperties(event, { key: { value: SESSION_EVENT_KEY }, newValue: { value: 'storage-epoch' } });
  h.events.dispatchEvent(event); assert.equal(h.notifications.length, 2);
  h.bridge.close(); h.events.dispatchEvent(event); assert.equal(h.notifications.length, 2);
});

test('broadcast still notifies when localStorage cannot write', () => {
  const h = harness({ failStorage: true });
  assert.doesNotThrow(() => h.bridge.publish());
  assert.deepEqual(h.sent, ['nonsecret-random-epoch']);
});

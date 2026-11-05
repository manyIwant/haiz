import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('legacy browser storage is isolated by verified account and clear never erases another account', async () => {
  const source = await readFile(new URL('../../src/account/session-guard.js', import.meta.url), 'utf8');
  const values = new Map([['old-guest-note', 'unassigned guest data']]);
  const storage = { get length() { return values.size; }, key: i => [...values.keys()][i] ?? null,
    getItem: key => values.get(String(key)) ?? null, setItem: (key, value) => values.set(String(key), String(value)), removeItem: key => values.delete(String(key)), clear: () => values.clear() };
  const page = owner => {
    const context = { document: { currentScript: { dataset: { haizUser: owner } }, addEventListener() {} },
      location: { href: 'https://haiz.test/', origin: 'https://haiz.test', pathname: '/', search: '' },
      fetch: async () => {}, localStorage: storage, sessionStorage: storage, addEventListener() {}, setInterval() {}, URL, Headers, Request };
    context.window = context; vm.runInNewContext(source, context); return context;
  };
  const a = page('user-a'), b = page('user-b');
  a.localStorage.setItem('note', 'PRIVATE A'); b.localStorage.setItem('note', 'PRIVATE B');
  assert.equal(a.localStorage.getItem('note'), 'PRIVATE A');
  assert.equal(b.localStorage.getItem('note'), 'PRIVATE B');
  assert.equal(b.localStorage.getItem('old-guest-note'), null);
  assert.deepEqual(Object.keys(a.localStorage), ['note']);
  a.localStorage.clear();
  assert.equal(b.localStorage.getItem('note'), 'PRIVATE B');
  assert.equal(values.get('old-guest-note'), 'unassigned guest data');
});

test('legacy storage events expose only this account and retain original key names', async () => {
  const source = await readFile(new URL('../../src/account/session-guard.js', import.meta.url), 'utf8');
  const values = new Map(), target = new EventTarget();
  const storage = { get length() { return values.size; }, key: i => [...values.keys()][i] ?? null, getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key), clear: () => values.clear() };
  const context = { document: { currentScript: { dataset: { haizUser: 'user-a' } }, addEventListener() {} },
    location: { href: 'https://haiz.test/', origin: 'https://haiz.test', pathname: '/', search: '' }, fetch: async () => {},
    localStorage: storage, sessionStorage: storage, addEventListener: target.addEventListener.bind(target), dispatchEvent: target.dispatchEvent.bind(target),
    setInterval() {}, Event, URL, Headers, Request };
  context.window = context; vm.runInNewContext(source, context);
  const seen = []; target.addEventListener('storage', event => seen.push({ key: event.key, value: event.newValue, area: event.storageArea }));
  const emit = (key, value) => { const event = new Event('storage'); Object.assign(event, { key, newValue: value, oldValue: null, url: 'https://haiz.test/', storageArea: storage }); target.dispatchEvent(event); };
  emit('haiz.account.user-b:haiz-note', 'PRIVATE B');
  emit('haiz.account.user-a:haiz-note', 'PRIVATE A');
  assert.equal(seen.length, 1); assert.equal(seen[0].key, 'haiz-note'); assert.equal(seen[0].value, 'PRIVATE A'); assert.equal(seen[0].area, context.localStorage);
});

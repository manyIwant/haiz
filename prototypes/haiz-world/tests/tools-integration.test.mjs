import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { createTask, updateTask, publishDraft, exportPublicBundle, importPublicBundle, PUBLIC_BUNDLE_MAX_BYTES } from '../src/tools/model.js';
import { parseCapture } from '../src/tools/capture.js';
import { KEYS, saveRecord } from '../src/tools/storage.js';
import { validateValue, loadToolsRecord } from '../src/tools/validate.js';
import { toolsOffline } from '../scripts/tools-offline.mjs';

const day = '2026-10-27';
const teacher = { scope: '', source: '', items: [], stage: 'capture', publicationId: null };
const store = () => {
  const map = new Map();
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
};
const draft = { scope: '高一（3）班', items: [{ id: 'homework-1', subject: '数学', content: '练习册第 4 题', studyDate: day, due: '', materials: '' }] };

test('task editing cannot replace identity; source references support full-length public IDs', () => {
  const sourceId = '80:' + 'p'.repeat(80) + 'i'.repeat(80);
  const task = createTask({ title: '数列', sourceId });
  assert.equal(updateTask(task, { id: 'replacement', title: '继续数列' }).id, task.id);
  assert.equal(task.sourceId, sourceId);
  const reference = (publication, item) => publication.length + ':' + publication + item;
  assert.notEqual(reference('a:b', 'c'), reference('a', 'b:c'));
});

test('capture recognizes inline subject suggestions but keeps them explicitly uncertain', () => {
  const { items } = parseCapture('明天交数学 P32–35\n周五交英语 Unit 4', day);
  assert.deepEqual(items.map(item => item.subject), ['数学', '英语']);
  assert.ok(items.every(item => item.warnings.some(w => w.includes('推测'))));
});

test('stored value validation rejects render-breaking shapes without overwriting raw records', () => {
  const storage = store();
  for (const [key, value, fallback] of [[KEYS.student, {}, []], [KEYS.teacher, { ...teacher, items: null }, teacher], [KEYS.publications, [null], []], [KEYS.preferences, null, { theme: 'porcelain', motion: 'system' }]]) {
    saveRecord(key, value, 0, storage);
    const before = storage.getItem(key);
    const loaded = loadToolsRecord(key, fallback, storage);
    assert.ok(loaded.error);
    assert.equal(loaded.value, fallback);
    assert.equal(storage.getItem(key), before);
  }
});

test('valid interrupted drafts and private relay records remain readable', () => {
  const task = createTask({ title: '数列专题' });
  assert.equal(validateValue(KEYS.student, [task])[0], task);
  assert.equal(validateValue(KEYS.teacher, { ...teacher, items: [{ ...draft.items[0], content: '', studyDate: '', warnings: [] }] }).items[0].content, '');
  assert.throws(() => validateValue(KEYS.student, [{ ...task, relay: null }]));
  assert.throws(() => validateValue(KEYS.student, [task, task]));
});

test('historic snapshots can be projected with their own preceding history', () => {
  let publications = publishDraft(draft, [], true);
  publications = publishDraft({ ...draft, publicationId: publications[0].id }, publications, true);
  const current = publications[0];
  const historic = current.history[0];
  const displayed = { ...historic, history: current.history.filter(p => p.version < historic.version) };
  assert.equal(exportPublicBundle([displayed]).publications[0].version, 1);
  assert.equal(importPublicBundle(exportPublicBundle(publications), [])[0].version, 2);
});

test('public import and export share an explicit byte limit', () => {
  assert.throws(() => importPublicBundle(' '.repeat(PUBLIC_BUNDLE_MAX_BYTES + 1), []), /2 MB/);
  const items = Array.from({ length: 500 }, (_, i) => ({ ...draft.items[0], id: 'item-' + i, content: '数'.repeat(400) }));
  let publications = publishDraft({ ...draft, items }, [], true);
  for (let i = 0; i < 3; i++) publications = publishDraft({ ...draft, items, publicationId: publications[0].id }, publications, true);
  assert.throws(() => exportPublicBundle(publications), /2 MB/);
});

test('offline cache includes only Tools shell dependencies, not the campus chunk or private records', async () => {
  const output = [];
  toolsOffline().generateBundle.call({ emitFile: file => output.push(file) }, {}, {
    'index.html': { type: 'asset', source: '<title>HAIZ WORLD · 校园图谱</title>' },
    'assets/index.js': { type: 'chunk', isEntry: true, imports: [] },
    'assets/ToolsApp.js': { type: 'chunk', facadeModuleId: '/src/tools/ToolsApp.jsx', imports: ['assets/shared.js'], viteMetadata: { importedCss: new Set(['assets/tools-hash.css']) } },
    'assets/shared.js': { type: 'chunk', imports: [] },
    'assets/tools-hash.css': { type: 'asset', source: '' },
    'assets/App.js': { type: 'chunk', facadeModuleId: '/src/App.jsx', imports: [] },
  });
  const handlers = {};
  const cached = new Map();
  let urls = [];
  const caches = { open: async () => ({ addAll: async entries => { urls = entries; entries.forEach(url => cached.set(url, new Response(url))); }, match: async url => cached.get(url) }), keys: async () => [], match: async url => cached.get(url) };
  vm.runInNewContext(output.find(file => file.fileName === 'tools/sw.js').source, {
    self: { location: { origin: 'https://example.test' }, addEventListener: (event, callback) => { handlers[event] = callback; }, clients: { claim: async () => {} } },
    caches, URL, fetch: async () => { throw Error('offline'); },
  });
  let work;
  handlers.install({ waitUntil: promise => { work = promise; } });
  await work;
  assert.ok(urls.includes('/tools/'));
  assert.ok(urls.includes('/assets/ToolsApp.js'));
  assert.ok(urls.includes('/assets/tools-hash.css'));
  assert.ok(!urls.includes('/assets/App.js'));
  let response;
  handlers.fetch({ request: { url: 'https://example.test/tools/', method: 'GET', mode: 'navigate' }, respondWith: promise => { response = promise; } });
  assert.equal(await (await response).text(), '/tools/');
  assert.ok(urls.every(url => !url.includes('haiz.tools.')));
});

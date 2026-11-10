import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

test('real Durable Object SQL preserves rollback, isolation and persisted schema metadata', async () => {
  const bundle = await build({
    stdin: {
      contents: `import { DurableObject } from 'cloudflare:workers';
        import { createCloudRepository } from './sqlite.mjs';
        export class RepositoryProbe extends DurableObject {
          constructor(ctx, env) { super(ctx, env); this.repository = createCloudRepository(ctx.storage); }
          async fetch(request) {
            const { operation, args } = await request.json();
            try {
              if (operation === '__sql') { this.ctx.storage.sql.exec(args.sql); return Response.json({ ok: true }); }
              if (operation === '__reload') { this.repository = createCloudRepository(this.ctx.storage); return Response.json({ ok: true }); }
              return Response.json(await this.repository.run(operation, args));
            } catch (error) { return Response.json({ error: error.message, remote: error.remote }, { status: error.status || 500 }); }
          }
        }
        export default { fetch(request, env) { return env.DB.getByName('global').fetch(request); } };`,
      resolveDir: fileURLToPath(new URL('../', import.meta.url)),
      sourcefile: 'repository-probe.mjs',
    },
    bundle: true, write: false, format: 'esm', platform: 'browser', external: ['cloudflare:workers', 'node:*'],
  });
  const mf = new Miniflare({
    modules: true, script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-08-06', compatibilityFlags: ['nodejs_compat'],
    durableObjects: { DB: { className: 'RepositoryProbe', useSQLite: true } },
  });
  const call = async (operation, args = {}) => {
    const response = await mf.dispatchFetch('https://haiz.example/', { method: 'POST', body: JSON.stringify({ operation, args }) });
    return { status: response.status, data: await response.json() };
  };
  try {
    const ready = await call('ready'); assert.deepEqual(ready, { status: 200, data: { ok: true, schemaVersion: 3 } });
    const a = await call('register', { name: 'first', passwordHash: 'first-hash', tokenHash: 'first-token', sessionMs: 3600000 });
    const b = await call('register', { name: 'second', passwordHash: 'second-hash', tokenHash: 'second-token', sessionMs: 3600000 });
    assert.equal(a.status, 200); assert.equal(b.status, 200);
    const args = { who: a.data.identity, sessionId: a.data.sessionId, method: 'PUT', collection: 'notes', id: 'private', input: { expectedRevision: 0, data: { text: 'keep' } } };
    assert.equal((await call('personal', args)).status, 200);
    assert.equal((await call('__reload')).status, 200);
    assert.equal((await call('personal', { ...args, method: 'GET' })).data.item.data.text, 'keep');
    assert.equal((await call('personal', { ...args, who: b.data.identity, sessionId: b.data.sessionId, method: 'GET' })).status, 404);
    assert.equal((await call('personal', { ...args, sessionId: b.data.sessionId, method: 'GET' })).status, 401);
    const stale = await call('personal', args); assert.equal(stale.status, 409); assert.equal(stale.data.remote.revision, 1);
    assert.equal((await call('__sql', { sql: "CREATE TRIGGER reject_audit BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT,'audit blocked'); END" })).status, 200);
    const failed = await call('personal', { ...args, input: { expectedRevision: 1, data: { text: 'discard' } } });
    assert.equal(failed.status, 500); assert.match(failed.data.error, /audit blocked/);
    const history = await call('personalHistory', { who: a.data.identity, sessionId: a.data.sessionId, collection: 'notes', id: 'private' });
    assert.deepEqual(history.data.items.map(row => [row.revision, row.data.text]), [[1, 'keep']]);
    assert.equal((await call('revokeOwn', { who: a.data.identity, sessionId: a.data.sessionId, id: 'missing' })).status, 404);
    assert.equal((await call('backup', { destination: '/tmp/forbidden.sqlite' })).status, 501);
  } finally { await mf.dispose(); }
});

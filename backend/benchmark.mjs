import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir, platform, arch } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createService } from './server.mjs';
const directory = await mkdtemp(join(tmpdir(), 'haiz-bench-'));
const service = await createService({ directory, development: true, port: 0, logger: () => {} });
await service.listen();
const call = (route, cookie, body, method = 'POST') => fetch(service.origin + route, { method, headers: { Origin: service.origin, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
try {
  const invite = (await readFile(service.bootstrapFile, 'utf8')).trim();
  const login = await call('/api/flow/login', '', { invite }); const admin = login.headers.get('set-cookie').split(';')[0]; await login.json();
  const registered = await call('/api/v1/auth/register', '', { username: 'benchmark-user', password: 'benchmark-password-123' });
  const cookie = registered.headers.get('set-cookie').split(';')[0]; await registered.json();
  const concurrency = 16, timings = [], failures = [];
  for (let i = 0; i < 20; i++) { const r = await call('/api/v1/data/notes', cookie, null, 'GET'); await r.arrayBuffer(); }
  const started = performance.now(); let index = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    for (;;) {
      const n = index++; if (n >= 400) return;
      const start = performance.now();
      const r = n % 4 === 0 ? await call('/api/v1/data/notes/item-' + n, cookie, { expectedRevision: 0, data: { text: '并发写入 ' + n } }, 'PUT') : await call('/api/v1/data/notes?limit=20', cookie, null, 'GET');
      await r.arrayBuffer(); timings.push(performance.now() - start); if (!r.ok) failures.push(r.status);
    }
  }));
  const elapsedMs = performance.now() - started; timings.sort((a, b) => a - b);
  const metricsResponse = await call('/api/v1/admin/metrics', admin, null, 'GET'), metrics = await metricsResponse.json();
  const result = { environment: { node: process.version, platform: platform(), arch: arch() }, requests: 400, reads: 300, writes: 100, concurrency, failures,
    elapsedMs: Number(elapsedMs.toFixed(1)), requestsPerSecond: Number((400000 / elapsedMs).toFixed(1)),
    latencyMs: Object.fromEntries([50, 95, 99].map(p => ['p' + p, Number(timings[Math.floor(timings.length * p / 100)].toFixed(2))])),
    eventLoopP99Ms: metrics.eventLoopP99Ms,
    storageBytes: (await Promise.all(['haiz.sqlite', 'haiz.sqlite-wal', 'haiz.sqlite-shm'].map(f => stat(join(directory, f)).then(s => s.size).catch(() => 0)))).reduce((a, b) => a + b, 0),
    scope: '本机单进程、16 并发、300 读/100 提交写；不代表公网或生产容量' };
  console.log(JSON.stringify(result, null, 2)); if (failures.length) process.exitCode = 1;
} finally { await service.close(); await rm(directory, { recursive: true, force: true }); }

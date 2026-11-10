// Preview-only synthetic server. The database never enters the source tree.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const directory = mkdtempSync(join(tmpdir(), 'haiz-qa-preview-'));
process.env.HAIZ_DB_PATH = join(directory, 'academic.sqlite');
process.env.HAIZ_HOST = '127.0.0.1';
process.env.HAIZ_PORT = '8796';
process.env.HAIZ_ADMIN_LOGIN = 'synthetic_admin';
process.env.HAIZ_ADMIN_PASSWORD = 'SyntheticTestPassword2026!';
process.env.HAIZ_QQ_RELAY_SECRET = '';
process.env.HAIZ_SCHOOL_ROSTER_SECRET = '';
process.env.HAIZ_SCHOOL_ISSUER = '';
const { server, db } = await import('../../services/academic/server.mjs');
server.listen(8796, '127.0.0.1', () => console.log('QA synthetic Academic ready on 8796'));
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    if (stopping) return;
    stopping = true;
    server.close(() => {
      db.close();
      rmSync(directory, { recursive: true, force: true });
    });
  });
}

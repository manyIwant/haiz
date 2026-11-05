import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stat, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { openDatabase } from './database.mjs';
import { hash, secret } from './auth.mjs';
import { check } from './errors.mjs';

process.umask(0o077);
const directory = path.resolve(process.env.HAIZ_DATA_DIR || fileURLToPath(new URL('../.haiz-data', import.meta.url)));
const [command, ...args] = process.argv.slice(2);
check(['backup', 'invite', 'recover-admin'].includes(command), 400, '用法：manage.mjs backup <文件> | invite <账号> <角色> <班级> | recover-admin');
await stat(path.join(directory, 'haiz.sqlite'));
const database = await openDatabase(directory);
try {
  if (command === 'backup') {
    check(args[0], 400, '需要备份文件路径'); const destination = path.resolve(args[0]);
    await database.call('backup', { destination }); console.log(JSON.stringify({ ok: true, file: destination }));
  } else {
    const token = secret(), file = path.join(directory, 'operator-invite-' + randomUUID() + '.txt');
    await writeFile(file, token, { flag: 'wx', mode: 0o600 });
    try {
      const result = await database.call(command === 'invite' ? 'operatorInvite' : 'operatorRecover', {
        input: { username: args[0], role: args[1] || 'student', scope: args[2] || 'campus' }, tokenHash: hash(token), inviteMs: 30 * 60000,
      });
      console.log(JSON.stringify({ ok: true, file, ...result }));
    } catch (error) { await unlink(file); throw error; }
  }
} finally { await database.close(); }

import { constants, openSync, closeSync, lstatSync, fstatSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { parentPort, workerData } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';

let descriptor, database;
const matches = info => info.isFile() && info.nlink === 1n && info.dev.toString() === workerData.expected.dev && info.ino.toString() === workerData.expected.ino;
try {
  if (!matches(lstatSync(workerData.file, { bigint: true }))) throw Error();
  descriptor = openSync(workerData.file, constants.O_RDONLY | constants.O_NOFOLLOW);
  if (!matches(fstatSync(descriptor, { bigint: true }))) throw Error();
  let integrityInvalid = false;
  try {
    if (fstatSync(descriptor, { bigint: true }).size < 100n) throw Error();
    // The backup is already closed and immutable. Normal readOnly opening of a
    // WAL-mode snapshot still creates -wal/-shm files; immutable avoids writes.
    database = new DatabaseSync(`${pathToFileURL(workerData.file).href}?immutable=1`, { readOnly: true });
    database.exec('PRAGMA busy_timeout=3000; PRAGMA query_only=ON');
    const result = database.prepare('PRAGMA quick_check(1)').all();
    if (result.length !== 1 || Object.values(result[0])[0] !== 'ok') throw Error();
  } catch { integrityInvalid = true; }
  if (!matches(lstatSync(workerData.file, { bigint: true })) || !matches(fstatSync(descriptor, { bigint: true }))) throw Error();
  parentPort.postMessage({ ok: !integrityInvalid, integrityInvalid });
} catch { parentPort.postMessage({ ok: false }); }
finally { database?.close(); if (descriptor !== undefined) closeSync(descriptor); parentPort.close(); }

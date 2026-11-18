// Executable PostgreSQL RLS test. Requires PGlite through HAIZ_MP_PGLITE.
// The auth/realtime request functions are test doubles: not a hosted policy check.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(process.env.HAIZ_MP_PGLITE ?
  pathToFileURL(process.env.HAIZ_MP_PGLITE).href : '@electric-sql/pglite');
const db = new PGlite();
const a = '00000000-0000-4000-8000-000000000001';
const b = '00000000-0000-4000-8000-000000000002';
const outside = '00000000-0000-4000-8000-000000000003';
const room = 'campus-alpha';
const migration = new URL('../../supabase/migrations/202611170001_haiz_multiplayer.sql', import.meta.url);
try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create schema realtime;
    create table auth.users(id uuid primary key);
    create function auth.jwt() returns jsonb language sql stable
      as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable
      as $$ select (auth.jwt() ->> 'sub')::uuid $$;
    create function realtime.topic() returns text language sql stable
      as $$ select current_setting('realtime.topic', true) $$;
    create table realtime.messages (topic text, extension text);
    alter table realtime.messages enable row level security;
    grant usage on schema realtime, auth to anon, authenticated;
    grant select, insert on realtime.messages to anon, authenticated;
    -- Existing permissive product rules must not make the reserved topics public.
    create policy old_broad_read on realtime.messages for select using (true);
    create policy old_broad_write on realtime.messages for insert with check (true);
  `);
  await db.exec(await readFile(migration, 'utf8'));
  for (const id of [a, b, outside]) await db.query('insert into auth.users values ($1)', [id]);
  await db.query('insert into haiz_multiplayer.rooms(id, capacity) values ($1, 2)', [room]);
  for (const id of [a, b])
    await db.query('insert into haiz_multiplayer.room_members(room_id,user_id) values ($1,$2)', [room,id]);
  async function principal(role, sub, topic, anonymous = false) {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claims',$1,false), set_config('realtime.topic',$2,false)",
      [JSON.stringify({ sub, is_anonymous: anonymous }), topic]);
    await db.exec('set role ' + role);
  }
  const directory = async () => (await db.query('select public.haiz_mp_directory($1) as data', [room])).rows[0].data;
  const rejected = promise => assert.rejects(promise, { code: '42501' });
  const expectRows = async count => assert.equal((await db.query('select * from realtime.messages')).rows.length, count);
  const send = (topic, extension = 'broadcast') => db.query('insert into realtime.messages values ($1,$2)', [topic, extension]);

  await principal('authenticated', a, '');
  const da = await directory();
  await principal('authenticated', b, '');
  const dbb = await directory();
  assert.deepEqual(da.members, dbb.members);
  assert.notEqual(da.self, dbb.self);
  assert.ok(!JSON.stringify(da).includes(a) && !JSON.stringify(da).includes(b));
  assert.equal(da.frame, 'haiz-campus-v1');
  await rejected(db.query('select * from haiz_multiplayer.room_members'));

  const own = 'haiz-mp:v1:' + room + ':' + da.self;
  await principal('authenticated', a, own);
  await send(own);
  await send(own, 'presence');
  await rejected(send(own, 'postgres_changes'));
  await expectRows(2);
  await principal('authenticated', b, own);
  await expectRows(2);
  await rejected(send(own));
  await rejected(send(own, 'presence'));
  await principal('authenticated', outside, own);
  await expectRows(0);
  await rejected(send(own));
  await rejected(directory());
  await principal('authenticated', a, own, true);
  await expectRows(0);
  await rejected(directory());
  await principal('anon', undefined, own);
  await expectRows(0);
  await rejected(send(own));
  await rejected(directory());
  await principal('authenticated', a, own + ':forged');
  await rejected(send(own + ':forged'));
  await expectRows(0);
  await principal('anon', undefined, 'unrelated-room');
  await send('unrelated-room');
  await expectRows(1);
  await db.exec("reset role; update haiz_multiplayer.rooms set enabled = false");
  await principal('authenticated', a, own);
  await expectRows(0);
  await rejected(directory());
  await db.exec('reset role');
  await db.exec(await readFile(new URL('../../supabase/rollback/haiz_multiplayer.sql', import.meta.url), 'utf8'));
  assert.equal((await db.query("select to_regnamespace('haiz_multiplayer') as present")).rows[0].present, null);
  console.log('PASS PostgreSQL: directory, isolated identities, allowlist, per-owner writes, anon/nonmember, legacy policy, rollback');
} finally {
  await db.close();
}

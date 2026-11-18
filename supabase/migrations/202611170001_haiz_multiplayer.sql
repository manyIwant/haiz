-- HAIZ campus Alpha. Run on a Supabase test project first.
-- No location tables, table publication, or Service Role client key.
begin;

create schema haiz_multiplayer;
revoke all on schema haiz_multiplayer from public, anon, authenticated;
-- Usage + EXECUTE only: clients cannot read or modify either directory table.
grant usage on schema haiz_multiplayer to anon, authenticated;

create table haiz_multiplayer.rooms (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,31}$'),
  capacity smallint not null default 5 check (capacity between 2 and 20),
  enabled boolean not null default true
);

create table haiz_multiplayer.room_members (
  room_id text not null references haiz_multiplayer.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  alias uuid not null default gen_random_uuid(),
  primary key (room_id, user_id),
  unique (room_id, alias)
);

alter table haiz_multiplayer.rooms enable row level security;
alter table haiz_multiplayer.room_members enable row level security;
revoke all on all tables in schema haiz_multiplayer from public, anon, authenticated;

create function haiz_multiplayer.may_use(topic text, write_access boolean) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous') is distinct from 'true'
    and auth.uid() is not null
    and exists (
      select 1
      from haiz_multiplayer.rooms r
      join haiz_multiplayer.room_members me on me.room_id = r.id and me.user_id = auth.uid()
      join haiz_multiplayer.room_members owner on owner.room_id = r.id
        and owner.alias::text = split_part(topic, ':', 4)
      where r.id = split_part(topic, ':', 3) and r.enabled
        and topic = 'haiz-mp:v1:' || r.id || ':' || owner.alias::text
        and (not write_access or owner.user_id = me.user_id)
    ), false);
$$;

revoke all on function haiz_multiplayer.may_use(text, boolean) from public, anon, authenticated;
grant execute on function haiz_multiplayer.may_use(text, boolean) to anon, authenticated;

create function public.haiz_mp_directory(room text) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid;
  max_members smallint;
  aliases jsonb;
begin
  select m.alias, r.capacity into me, max_members
  from haiz_multiplayer.rooms r
  join haiz_multiplayer.room_members m on m.room_id = r.id
  where r.id = room and r.enabled and m.user_id = auth.uid()
    and (auth.jwt() ->> 'is_anonymous') is distinct from 'true';

  if me is null then
    raise exception 'HAIZ room membership required' using errcode = '42501';
  end if;

  select jsonb_agg(m.alias order by m.alias) into aliases
  from haiz_multiplayer.room_members m where m.room_id = room;
  if jsonb_array_length(aliases) > max_members then
    raise exception 'HAIZ room directory exceeds capacity' using errcode = '22023';
  end if;

  return jsonb_build_object('self', me, 'members', aliases, 'capacity', max_members, 'frame', 'haiz-campus-v1');
end;
$$;

revoke all on function public.haiz_mp_directory(text) from public, anon, authenticated;
grant execute on function public.haiz_mp_directory(text) to authenticated;

-- Only the reserved namespace is constrained by the restrictive policies.
-- This also guards against a legacy broad permissive policy in the project.
-- realtime.messages already has RLS in a hosted Supabase project.
create policy haiz_mp_guard_select on realtime.messages as restrictive
for select to public
using (case when topic like 'haiz-mp:v1:%' or (select realtime.topic()) like 'haiz-mp:v1:%'
  then topic = (select realtime.topic()) and extension in ('broadcast', 'presence')
    and haiz_multiplayer.may_use(topic, false)
  else true end);

create policy haiz_mp_guard_insert on realtime.messages as restrictive
for insert to public
with check (case when topic like 'haiz-mp:v1:%' or (select realtime.topic()) like 'haiz-mp:v1:%'
  then topic = (select realtime.topic()) and extension in ('broadcast', 'presence')
    and haiz_multiplayer.may_use(topic, true)
  else true end);

create policy haiz_mp_member_select on realtime.messages
for select to authenticated
using (topic like 'haiz-mp:v1:%' and topic = (select realtime.topic())
  and extension in ('broadcast', 'presence') and haiz_multiplayer.may_use(topic, false));

create policy haiz_mp_owner_insert on realtime.messages
for insert to authenticated
with check (topic like 'haiz-mp:v1:%' and topic = (select realtime.topic())
  and extension in ('broadcast', 'presence') and haiz_multiplayer.may_use(topic, true));

commit;

-- HAIZ Pocket / v1: user-owned personal snapshot.
-- Run this migration in the SAME Supabase project configured in the app.
-- No service_role or elevated application keys may ship to a Flutter client.
begin;

create table if not exists public.pocket_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now(),
  constraint pocket_snapshot_object check (jsonb_typeof(data) = 'object'),
  constraint pocket_snapshot_max_bytes check (octet_length(data::text) <= 4194304)
);

alter table public.pocket_snapshots enable row level security;

-- Grant the minimal operations this client needs; never grant DELETE to users.
revoke all on table public.pocket_snapshots from public, anon, authenticated;
grant select, insert, update on table public.pocket_snapshots to authenticated;

drop policy if exists pocket_owner_select on public.pocket_snapshots;
create policy pocket_owner_select on public.pocket_snapshots
for select to authenticated
using (
  user_id = (select auth.uid())
  and (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
);

drop policy if exists pocket_owner_insert on public.pocket_snapshots;
create policy pocket_owner_insert on public.pocket_snapshots
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
);

drop policy if exists pocket_owner_update on public.pocket_snapshots;
create policy pocket_owner_update on public.pocket_snapshots
for update to authenticated
using (
  user_id = (select auth.uid())
  and (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
)
with check (
  user_id = (select auth.uid())
  and (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
);

-- The client performs CAS updates using (user_id, version).
create index if not exists pocket_snapshot_owner_version
  on public.pocket_snapshots(user_id, version);

commit;

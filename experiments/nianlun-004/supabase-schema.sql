-- HAIZ NIANLUN 004 · Reserved Supabase Schema Blueprint (Read-Only Proposal)
-- Mirrors `supabase/migrations/202610310001_pocket_snapshots.sql` RLS & CAS architecture.
-- NOTE: Private student records (grades, mistakes, personal schedules, growth notes) are strictly
-- owner-isolated via Row Level Security. Public campus notices & school history remain separate.

begin;

create table if not exists public.nianlun_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now(),
  constraint nianlun_snapshot_object check (jsonb_typeof(data) = 'object'),
  constraint nianlun_snapshot_max_bytes check (octet_length(data::text) <= 4194304)
);

alter table public.nianlun_snapshots enable row level security;

revoke all on table public.nianlun_snapshots from public, anon, authenticated;
grant select, insert, update on table public.nianlun_snapshots to authenticated;

drop policy if exists nianlun_owner_select on public.nianlun_snapshots;
create policy nianlun_owner_select on public.nianlun_snapshots
for select to authenticated
using (
  user_id = (select auth.uid())
  and (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
);

drop policy if exists nianlun_owner_insert on public.nianlun_snapshots;
create policy nianlun_owner_insert on public.nianlun_snapshots
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
);

drop policy if exists nianlun_owner_update on public.nianlun_snapshots;
create policy nianlun_owner_update on public.nianlun_snapshots
for update to authenticated
using (
  user_id = (select auth.uid())
  and (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
)
with check (
  user_id = (select auth.uid())
  and (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
);

create index if not exists nianlun_snapshot_owner_version
  on public.nianlun_snapshots(user_id, version);

commit;

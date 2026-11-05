-- PROPOSAL ONLY — NOT DEPLOYED, NOT TESTED AGAINST A REAL SUPABASE PROJECT.
-- Kept outside supabase/migrations on purpose so it cannot be applied by
-- accident. Review RLS, storage cost and retention before adopting.
--
-- Goal: give each account a short server-side history so an overwritten
-- snapshot can be restored (today only the latest row exists).
begin;

create table if not exists public.pocket_snapshot_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null,
  data jsonb not null,
  replaced_at timestamptz not null default now(),
  primary key (user_id, version)
);

alter table public.pocket_snapshot_history enable row level security;
revoke all on table public.pocket_snapshot_history from public, anon, authenticated;
-- Owners may read their own history; only the trigger writes.
grant select on table public.pocket_snapshot_history to authenticated;

create policy pocket_history_owner_select on public.pocket_snapshot_history
for select to authenticated
using (
  user_id = (select auth.uid())
  and (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
);

-- Copy the previous row before every update; keep the latest 20 versions.
create or replace function public.pocket_snapshot_keep_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.pocket_snapshot_history(user_id, version, data)
  values (old.user_id, old.version, old.data)
  on conflict (user_id, version) do nothing;
  delete from public.pocket_snapshot_history h
  where h.user_id = old.user_id
    and h.version < old.version - 20;
  return new;
end $$;

drop trigger if exists pocket_snapshot_history_trg on public.pocket_snapshots;
create trigger pocket_snapshot_history_trg
before update on public.pocket_snapshots
for each row execute function public.pocket_snapshot_keep_history();

commit;

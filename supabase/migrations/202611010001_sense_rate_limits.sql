-- HAIZ Sense V1: one quota bucket per verified user and UTC hour.
-- Run once in Supabase SQL Editor before deploying tasks-analyze.
create table if not exists public.sense_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  primary key (user_id, bucket)
);

alter table public.sense_rate_limits enable row level security;
revoke all on public.sense_rate_limits from anon, authenticated;

-- The Edge function calls this RPC with the user's bearer token.
-- Atomic upsert prevents parallel requests from exceeding the 30/hour cap.
create or replace function public.sense_consume_quota()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  hour_bucket timestamptz := date_trunc('hour', now());
  new_attempts integer;
begin
  if caller is null then
    return false;
  end if;
  delete from public.sense_rate_limits
  where user_id = caller and bucket < hour_bucket - interval '48 hours';

  insert into public.sense_rate_limits(user_id, bucket, attempts)
  values(caller, hour_bucket, 1)
  on conflict (user_id, bucket)
  do update set attempts = public.sense_rate_limits.attempts + 1
  returning attempts into new_attempts;

  return new_attempts <= 30;
end;
$$;

revoke all on function public.sense_consume_quota() from public, anon;
grant execute on function public.sense_consume_quota() to authenticated;

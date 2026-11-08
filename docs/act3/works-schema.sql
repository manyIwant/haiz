-- HAIZ · 第三幕「青春 · 生长」— works service: reference schema with row-level security.
--
-- STATUS: DESIGN DRAFT. NOT APPLIED ANYWHERE. Deliberately kept out of supabase/migrations/
-- so that no `supabase db push` can apply it by accident. It is written for Postgres/Supabase
-- (auth.uid(), storage.objects) because that is where RLS must be stated most carefully; the
-- recommended first home is the existing HAIZ account backend (backend/, same accounts as the
-- site login), where the same rules become server-side checks (see docs/haiz-act3-leaves-20261107.md §9).
--
-- Principles (DESIGN.md §3–§8, confirmed):
--  • a private draft is visible to its author only — not to reviewers, not to admins' clients;
--  • review never publishes: after approval the AUTHOR chooses to make a work public;
--  • the author may withdraw at any time; the public path then answers "not public";
--  • a public work has a stable leaf address (direction + slot) handed out once, never reused;
--  • every state change goes through a SECURITY DEFINER function that checks who is acting;
--    clients can never write `state`, `address` or `slot` directly;
--  • no service_role key, moderation secret or reviewer power ever ships to a browser.

begin;

-- ---------------------------------------------------------------- roles (written only by the service side)
create table public.staff_roles (
  account uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('editor', 'moderator', 'admin')),
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now()
);
alter table public.staff_roles enable row level security;
revoke all on public.staff_roles from public, anon, authenticated;
create policy staff_self_read on public.staff_roles for select to authenticated using (account = auth.uid());

create function public.has_role(r text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_roles where account = auth.uid() and (role = r or role = 'admin'));
$$;

-- ---------------------------------------------------------------- profiles: pen names, never legal names by default
create table public.creator_profiles (
  account uuid primary key references auth.users(id) on delete cascade,
  pen_name text not null check (char_length(pen_name) between 1 and 24),
  show_in_recommendations boolean not null default false   -- recommenders appear as "同学" unless they opt in
);
alter table public.creator_profiles enable row level security;
create policy profile_owner_all on public.creator_profiles for all to authenticated using (account = auth.uid()) with check (account = auth.uid());
create policy profile_public_read on public.creator_profiles for select using (true);   -- pen names only (no other columns exist)

-- ---------------------------------------------------------------- directions and twigs
create table public.directions (id text primary key, zh text not null, sector_from real not null, sector_to real not null);
create table public.twigs (
  id text primary key, direction text not null references public.directions(id), zh text not null,
  state text not null default 'proposed' check (state in ('proposed', 'approved', 'merged', 'rejected')),
  merged_into text references public.twigs(id), proposed_by uuid references auth.users(id), decided_by uuid references auth.users(id)
);
alter table public.directions enable row level security;
alter table public.twigs enable row level security;
create policy directions_read on public.directions for select using (true);
create policy twigs_read on public.twigs for select using (state = 'approved' or proposed_by = auth.uid() or public.has_role('editor'));
create policy twigs_propose on public.twigs for insert to authenticated with check (state = 'proposed' and proposed_by = auth.uid());

-- ---------------------------------------------------------------- works
create type public.work_state as enum ('draft', 'submitted', 'approved', 'public', 'withdrawn', 'hidden');
create table public.works (
  id text primary key default encode(gen_random_bytes(12), 'hex'),   -- opaque, not guessable, not sequential
  owner uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('work', 'project')),
  direction text not null references public.directions(id),
  twig text references public.twigs(id),
  title text not null check (char_length(title) between 1 and 80),
  summary text check (char_length(summary) <= 200),
  body text check (char_length(body) <= 12000),
  statement text check (char_length(statement) <= 1000),
  license jsonb not null default '{"relay": false, "derive": "未说明，默认不允许改编"}',
  project jsonb,                                   -- stage, seeking[], until (kind = 'project')
  state public.work_state not null default 'draft',
  address text unique,                             -- "<asset>:<direction>:<slot>", set once at first publication
  people_consent boolean not null default false,   -- recognisable people in media have agreed (reviewers check)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  review_note text                                 -- reviewer → author; never in the public projection
);
alter table public.works enable row level security;
revoke all on public.works from public, anon, authenticated;
grant select on public.works to anon, authenticated;
grant insert (kind, direction, twig, title, summary, body, statement, license, project, people_consent) on public.works to authenticated;
grant update (kind, direction, twig, title, summary, body, statement, license, project, people_consent) on public.works to authenticated;
-- (column privileges: no client can write owner, state, address, published_at or review_note)

create function public.is_contributor(w text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.work_contributors where work = w and account = auth.uid() and accepted);
$$;

create policy works_public on public.works for select using (state = 'public');
create policy works_owner on public.works for select to authenticated using (owner = auth.uid());
create policy works_cocreator on public.works for select to authenticated using (state <> 'draft' and state <> 'hidden' and public.is_contributor(id));
create policy works_review on public.works for select to authenticated using (state in ('submitted', 'approved') and public.has_role('editor'));
create policy works_moderate on public.works for select to authenticated using (state = 'hidden' and public.has_role('moderator'));
create policy works_create on public.works for insert to authenticated with check (owner = auth.uid() and state = 'draft');
-- content edits only while it is the author's draft (a public work changes through a new version, see work_versions)
create policy works_edit on public.works for update to authenticated using (owner = auth.uid() and state = 'draft') with check (owner = auth.uid() and state = 'draft');
-- no delete policy: drafts are discarded through discard_draft(); public works are withdrawn, not erased by clients

-- the public projection: what anyone may receive (no owner id, no review note)
create view public.public_works with (security_invoker = true) as
  select w.id, w.kind, w.direction, w.twig, w.title, w.summary, w.body, w.statement, w.license, w.project, w.address, w.published_at
  from public.works w where w.state = 'public';

-- ---------------------------------------------------------------- leaf slots: append-only, never reused
create table public.leaf_slots (
  direction text not null references public.directions(id),
  slot integer not null check (slot >= 0),
  asset text not null default 'v4-2611',
  work text not null unique references public.works(id) on delete restrict,
  given_at timestamptz not null default now(),
  primary key (asset, direction, slot)
);
alter table public.leaf_slots enable row level security;
revoke all on public.leaf_slots from public, anon, authenticated;
create policy slots_public_read on public.leaf_slots for select using (exists (select 1 from public.works w where w.id = work and w.state = 'public'));

-- ---------------------------------------------------------------- people, relations, versions, media
create table public.work_contributors (
  work text not null references public.works(id) on delete cascade,
  account uuid not null references auth.users(id) on delete cascade,
  role text not null check (char_length(role) <= 24),
  contribution text check (char_length(contribution) <= 300),    -- what they actually did
  invited_by uuid not null references auth.users(id),
  accepted boolean not null default false,
  primary key (work, account)
);
alter table public.work_contributors enable row level security;
create policy contrib_read on public.work_contributors for select using (
  (accepted and exists (select 1 from public.works w where w.id = work and w.state = 'public'))
  or account = auth.uid() or exists (select 1 from public.works w where w.id = work and w.owner = auth.uid()));
create policy contrib_invite on public.work_contributors for insert to authenticated with check (
  invited_by = auth.uid() and accepted = false and exists (select 1 from public.works w where w.id = work and w.owner = auth.uid()));
create policy contrib_accept on public.work_contributors for update to authenticated using (account = auth.uid()) with check (account = auth.uid());

create table public.work_relations (
  work text not null references public.works(id) on delete cascade,
  source text not null references public.works(id) on delete restrict,
  type text not null check (type in ('responds-to', 'derived-from', 'part-of', 'grew-from')),
  note text check (char_length(note) <= 200),
  primary key (work, source)
);
alter table public.work_relations enable row level security;
create policy rel_read on public.work_relations for select using (exists (select 1 from public.works w where w.id = work and (w.state = 'public' or w.owner = auth.uid())));
-- a relay may only point at a public source whose author allows it
create policy rel_add on public.work_relations for insert to authenticated with check (
  exists (select 1 from public.works w where w.id = work and w.owner = auth.uid() and w.state = 'draft')
  and exists (select 1 from public.works s where s.id = source and s.state = 'public' and (s.license ->> 'relay')::boolean));

create table public.work_versions (            -- the growth record: only versions the author chose to show
  work text not null references public.works(id) on delete cascade,
  version integer not null,
  shown boolean not null default false,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  primary key (work, version)
);
alter table public.work_versions enable row level security;
create policy ver_read on public.work_versions for select using (
  (shown and exists (select 1 from public.works w where w.id = work and w.state = 'public'))
  or exists (select 1 from public.works w where w.id = work and w.owner = auth.uid()));

create table public.work_media (
  work text not null references public.works(id) on delete cascade,
  position integer not null,
  kind text not null check (kind in ('image', 'audio', 'video', 'text')),
  object_path text,                -- storage key: <owner uuid>/<work id>/<file>
  width integer, height integer, duration real,
  alt text check (char_length(alt) <= 300), caption text check (char_length(caption) <= 300),
  primary key (work, position)
);
alter table public.work_media enable row level security;
create policy media_read on public.work_media for select using (exists (select 1 from public.works w where w.id = work and (w.state = 'public' or w.owner = auth.uid() or public.is_contributor(w.id))));
create policy media_write on public.work_media for all to authenticated using (exists (select 1 from public.works w where w.id = work and w.owner = auth.uid() and w.state = 'draft'))
  with check (exists (select 1 from public.works w where w.id = work and w.owner = auth.uid() and w.state = 'draft'));

-- private bucket; an object is readable by its owner, and by anyone once its work is public
insert into storage.buckets (id, name, public) values ('work-media', 'work-media', false) on conflict do nothing;
create policy work_media_owner_write on storage.objects for insert to authenticated with check (bucket_id = 'work-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy work_media_owner_read on storage.objects for select to authenticated using (bucket_id = 'work-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy work_media_public_read on storage.objects for select using (
  bucket_id = 'work-media' and exists (select 1 from public.work_media m join public.works w on w.id = m.work where m.object_path = name and w.state = 'public'));

-- ---------------------------------------------------------------- discovery: picks, recommendations, reports
create table public.issues (number integer primary key, title text not null, opened_at date not null, closed_at date);
create table public.picks (
  issue integer not null references public.issues(number), work text not null references public.works(id) on delete cascade,
  note text check (char_length(note) <= 300), picked_by uuid not null references auth.users(id), primary key (issue, work));
create table public.recommendations (
  work text not null references public.works(id) on delete cascade, account uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 4 and 300), at timestamptz not null default now(),
  primary key (work, account));   -- one per person per work: a reason, not a vote count
create table public.reports (
  id bigint generated always as identity primary key, work text not null references public.works(id) on delete cascade,
  reporter uuid not null references auth.users(id), reason text not null check (reason in ('privacy', 'copyright', 'harm', 'other')),
  detail text check (char_length(detail) <= 1000), at timestamptz not null default now(),
  resolved_by uuid references auth.users(id), outcome text);
alter table public.issues enable row level security;
alter table public.picks enable row level security;
alter table public.recommendations enable row level security;
alter table public.reports enable row level security;
create policy issues_read on public.issues for select using (true);
create policy picks_read on public.picks for select using (exists (select 1 from public.works w where w.id = work and w.state = 'public'));   -- past picks stay queryable while the work is public
create policy picks_write on public.picks for insert to authenticated with check (picked_by = auth.uid() and public.has_role('editor'));
create policy rec_read on public.recommendations for select using (exists (select 1 from public.works w where w.id = work and w.state = 'public'));
create policy rec_add on public.recommendations for insert to authenticated with check (
  account = auth.uid() and exists (select 1 from public.works w where w.id = work and w.state = 'public' and w.owner <> auth.uid()));
create policy rec_remove on public.recommendations for delete to authenticated using (account = auth.uid());
create policy reports_add on public.reports for insert to authenticated with check (reporter = auth.uid());
create policy reports_moderate on public.reports for select to authenticated using (public.has_role('moderator'));

-- ---------------------------------------------------------------- state changes (the only way to change state)
create table public.work_audit (id bigint generated always as identity primary key, work text not null, actor uuid not null, action text not null, at timestamptz not null default now());
alter table public.work_audit enable row level security;
revoke all on public.work_audit from public, anon, authenticated;

create function public.transition(w text, action text, note text default null, near_slot integer default null) returns public.work_state
language plpgsql security definer set search_path = public as $$
declare cur public.works; nxt public.work_state; me uuid := auth.uid();
begin
  select * into cur from public.works where id = w for update;
  if not found then raise exception 'not found'; end if;
  if action = 'submit' and cur.owner = me and cur.state = 'draft' then nxt := 'submitted';
  elsif action = 'unsubmit' and cur.owner = me and cur.state = 'submitted' then nxt := 'draft';
  elsif action = 'approve' and cur.owner <> me and public.has_role('editor') and cur.state = 'submitted' then nxt := 'approved';
  elsif action = 'request_changes' and cur.owner <> me and public.has_role('editor') and cur.state = 'submitted' then nxt := 'draft';
  elsif action = 'publish' and cur.owner = me and cur.state in ('approved', 'withdrawn') then nxt := 'public';
  elsif action = 'withdraw' and cur.owner = me and cur.state in ('public', 'approved') then nxt := 'withdrawn';
  elsif action = 'hide' and public.has_role('moderator') and cur.state = 'public' then nxt := 'hidden';
  elsif action = 'restore' and public.has_role('moderator') and cur.state = 'hidden' then nxt := 'public';
  else raise exception 'transition % not allowed from %', action, cur.state; end if;
  if nxt = 'public' and cur.address is null then
    -- first publication: the lowest free slot of the limb. A relay may ask for `near_slot` (the
    -- nearest free leaf to its source, computed from the slot table by lanren/canopy/address.js);
    -- it is honoured only if free and only for a work that relates to a public source on the same limb.
    if near_slot is not null and (exists (select 1 from public.leaf_slots l where l.direction = cur.direction and l.slot = near_slot)
       or not exists (select 1 from public.work_relations r join public.works s on s.id = r.source
                      where r.work = cur.id and s.direction = cur.direction and s.state = 'public')) then near_slot := null; end if;
    perform pg_advisory_xact_lock(hashtext('leaf:' || cur.direction));
    insert into public.leaf_slots(direction, slot, work)
      select cur.direction, coalesce(near_slot, (select coalesce(min(s.n), 0) from generate_series(0, 4096) s(n)
        where not exists (select 1 from public.leaf_slots l where l.direction = cur.direction and l.slot = s.n))), cur.id;
    update public.works set address = (select 'v4-2611:' || direction || ':' || slot from public.leaf_slots where work = cur.id) where id = cur.id;
  end if;
  update public.works set state = nxt, updated_at = now(),
    published_at = case when nxt = 'public' then coalesce(published_at, now()) else published_at end,
    review_note = case when action in ('approve', 'request_changes') then note else review_note end
  where id = w;
  insert into public.work_audit(work, actor, action) values (w, me, action);
  return nxt;
end $$;
revoke all on function public.transition(text, text, text, integer) from public;
grant execute on function public.transition(text, text, text, integer) to authenticated;

commit;

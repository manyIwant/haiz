-- ============================================================================
-- HAIZ World Engine — Unified Supabase Auth + RLS Schema DRAFT (UNAPPLIED)
-- ============================================================================
-- WARNING:
--   This file is an UNAPPLIED DESIGN DRAFT stored under docs/world-engine/supabase-draft/.
--   It is intentionally NOT placed in supabase/migrations/ and must NEVER be executed
--   against production without staging verification and explicit human approval.
-- ============================================================================

-- 1. Hardened Role Authority Table (never writable by authenticated clients directly)
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'moderator', 'admin')),
  scope      text NOT NULL DEFAULT 'campus',
  scopes     jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_roles FROM public, anon, authenticated;
GRANT SELECT ON public.user_roles TO authenticated;

CREATE POLICY user_roles_self_read ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

-- Helper function (SECURITY DEFINER) for role checks without exposing user_roles write access
CREATE OR REPLACE FUNCTION public.haiz_has_role(required_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles r
    WHERE r.user_id = (SELECT auth.uid())
      AND r.role = ANY(required_roles)
  );
$$;
REVOKE ALL ON FUNCTION public.haiz_has_role(text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.haiz_has_role(text[]) TO authenticated;

-- 2. Legacy Account Claim Mapping (service_role write only; zero plaintext password migration)
CREATE TABLE IF NOT EXISTS public.identity_links (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  legacy_source  text NOT NULL CHECK (legacy_source IN ('haiz_backend', 'haiz_academic')),
  legacy_user_id text NOT NULL,
  linked_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (legacy_source, legacy_user_id)
);

ALTER TABLE public.identity_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.identity_links FROM public, anon, authenticated;
GRANT SELECT ON public.identity_links TO authenticated;

CREATE POLICY identity_links_self_read ON public.identity_links
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

-- 3. Unified World Engine Private User Profile (matches world-engine/core/state.js exportUserContract)
CREATE TABLE IF NOT EXISTS public.world_profiles (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  schema_ver text NOT NULL DEFAULT 'haiz-user-world-profile/1' CHECK (schema_ver = 'haiz-user-world-profile/1'),
  data       jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (octet_length(data::text) <= 1048576),
  version    integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.world_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.world_profiles FROM public, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.world_profiles TO authenticated;

CREATE POLICY world_profiles_owner_select ON public.world_profiles
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

CREATE POLICY world_profiles_owner_insert ON public.world_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND version = 1 AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

CREATE POLICY world_profiles_owner_update ON public.world_profiles
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)
  WITH CHECK (user_id = (SELECT auth.uid()) AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

-- 4. Monotonic Version & Auto updated_at Enforcement Trigger (also recommended for pocket_snapshots!)
CREATE OR REPLACE FUNCTION public.haiz_enforce_monotonic_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.version IS DISTINCT FROM OLD.version + 1 THEN
    RAISE EXCEPTION 'Optimistic concurrency violation: expected version %, got %', OLD.version + 1, NEW.version
      USING ERRCODE = '40001';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_world_profiles_monotonic
  BEFORE UPDATE ON public.world_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.haiz_enforce_monotonic_version();

-- Optional hardening trigger for existing public.pocket_snapshots (apply in staging first):
-- CREATE TRIGGER trg_pocket_snapshots_monotonic
--   BEFORE UPDATE ON public.pocket_snapshots
--   FOR EACH ROW
--   EXECUTE FUNCTION public.haiz_enforce_monotonic_version();

-- 5. Unified Personal Records (replaces backend/repository-core personal_data collections)
CREATE TABLE IF NOT EXISTS public.personal_records (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection  text NOT NULL CHECK (collection IN ('notes', 'bookmarks', 'preferences', 'works', 'science_trials')),
  item_key    text NOT NULL CHECK (char_length(item_key) BETWEEN 1 AND 128),
  payload     jsonb NOT NULL CHECK (octet_length(payload::text) <= 16384),
  version     integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, collection, item_key)
);

ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.personal_records FROM public, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_records TO authenticated;

CREATE POLICY personal_records_owner_all ON public.personal_records
  FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid()) AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)
  WITH CHECK (owner_id = (SELECT auth.uid()) AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

CREATE TRIGGER trg_personal_records_monotonic
  BEFORE UPDATE ON public.personal_records
  FOR EACH ROW
  EXECUTE FUNCTION public.haiz_enforce_monotonic_version();

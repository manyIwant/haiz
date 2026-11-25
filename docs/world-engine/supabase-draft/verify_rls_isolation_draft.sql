-- ============================================================================
-- HAIZ World Engine — Two-Account Negative RLS & Trigger Verification Script (DRAFT)
-- ============================================================================
-- Run inside an isolated Staging Postgres / local `supabase db reset` transaction
-- (wrapped in BEGIN ... ROLLBACK so it leaves zero test data behind).
-- ============================================================================

BEGIN;

-- Create two isolated synthetic test principals (Staging ONLY)
DO $$
DECLARE
  uid_a uuid := '11111111-1111-4111-8111-111111111111';
  uid_b uuid := '22222222-2222-4222-8222-222222222222';
  row_cnt integer;
  caught boolean;
BEGIN
  -- 1. Seed User A profile as service role
  INSERT INTO auth.users (id, email) VALUES (uid_a, 'test-a@example.invalid'), (uid_b, 'test-b@example.invalid')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_roles (user_id, role, scope) VALUES (uid_a, 'student', 'g2c3'), (uid_b, 'student', 'g1c7')
  ON CONFLICT DO NOTHING;

  -- 2. Simulate User A creating their own world_profile
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid_a::text, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  SET LOCAL ROLE authenticated;

  INSERT INTO public.world_profiles (user_id, data, version)
  VALUES (uid_a, '{"lens":"gouache","visitedPlaces":["lanshu"]}'::jsonb, 1);

  -- 3. Negative Test: Version rollback (1 -> 1) MUST fail via monotonic trigger
  caught := false;
  BEGIN
    UPDATE public.world_profiles SET version = 1, data = '{"lens":"inkwash"}'::jsonb WHERE user_id = uid_a;
  EXCEPTION WHEN SQLSTATE '40001' THEN
    caught := true;
  END;
  IF NOT caught THEN
    RAISE EXCEPTION 'SECURITY FAIL: Monotonic version trigger failed to block version rollback!';
  END IF;

  -- 4. Positive Test: Proper CAS increment (1 -> 2) succeeds
  UPDATE public.world_profiles SET version = 2, data = '{"lens":"inkwash"}'::jsonb WHERE user_id = uid_a;

  -- 5. Negative Test: Role escalation (student trying to update user_roles) MUST fail
  caught := false;
  BEGIN
    UPDATE public.user_roles SET role = 'admin' WHERE user_id = uid_a;
  EXCEPTION WHEN insufficient_privilege THEN
    caught := true;
  END;
  IF NOT caught THEN
    RAISE EXCEPTION 'SECURITY FAIL: Student was able to write to public.user_roles!';
  END IF;

  -- 6. Negative Test: Cross-account horizontal isolation (User B reading/updating User A)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid_b::text, 'role', 'authenticated', 'is_anonymous', false)::text, true);

  SELECT count(*) INTO row_cnt FROM public.world_profiles WHERE user_id = uid_a;
  IF row_cnt <> 0 THEN
    RAISE EXCEPTION 'SECURITY FAIL: User B read % rows of User A world_profiles!', row_cnt;
  END IF;

  UPDATE public.world_profiles SET version = 3, data = '{"pwned":true}'::jsonb WHERE user_id = uid_a;
  GET DIAGNOSTICS row_cnt = ROW_COUNT;
  IF row_cnt <> 0 THEN
    RAISE EXCEPTION 'SECURITY FAIL: User B updated User A world_profiles!';
  END IF;

  -- 7. Negative Test: Anonymous JWT must see 0 rows
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid_a::text, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  SELECT count(*) INTO row_cnt FROM public.world_profiles WHERE user_id = uid_a;
  IF row_cnt <> 0 THEN
    RAISE EXCEPTION 'SECURITY FAIL: Anonymous JWT bypassed RLS!';
  END IF;

  RAISE NOTICE 'ALL 7 NEGATIVE & POSITIVE RLS SECURITY ASSERTIONS PASSED.';
END $$;

ROLLBACK;

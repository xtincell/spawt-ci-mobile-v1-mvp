-- Run after migration 0099 on disposable PostgreSQL.
BEGIN;
DO $$
BEGIN
  IF pg_catalog.has_function_privilege('anon', 'public.reserve_store_reviewer_verify(text)', 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', 'public.reserve_store_reviewer_verify(text)', 'EXECUTE')
     OR pg_catalog.has_table_privilege('anon', 'public.store_reviewer_verify_budget', 'SELECT')
     OR pg_catalog.has_table_privilege('authenticated', 'public.store_reviewer_verify_budget', 'UPDATE') THEN
    RAISE EXCEPTION 'public access to reviewer attempt budget';
  END IF;
END;
$$;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  p text := '+10000000001';
BEGIN
  IF public.reserve_store_reviewer_verify(NULL) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'invalid phone accepted';
  END IF;
  FOR i IN 1..8 LOOP
    IF public.reserve_store_reviewer_verify(p) IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'attempt % unexpectedly denied', i;
    END IF;
  END LOOP;
  IF public.reserve_store_reviewer_verify(p) IS DISTINCT FROM false
     OR public.reserve_store_reviewer_verify('+10000000002') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'limit or per-phone isolation failed';
  END IF;
  UPDATE public.store_reviewer_verify_budget SET window_started_at = now() - interval '6 minutes' WHERE phone_e164 = p;
  IF public.reserve_store_reviewer_verify(p) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'expired window did not allow an attempt';
  END IF;
  IF (SELECT attempts FROM public.store_reviewer_verify_budget WHERE phone_e164 = p) <> 1 THEN
    RAISE EXCEPTION 'expired window did not reset';
  END IF;
END;
$$;
ROLLBACK;

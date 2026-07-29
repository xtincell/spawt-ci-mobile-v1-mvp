-- Rollback 0043 — Drop comptes B2B + dashboards

DROP POLICY IF EXISTS reservation_requests_select_b2b ON public.reservation_requests;

DROP VIEW IF EXISTS public.b2b_place_funnel;
DROP VIEW IF EXISTS public.b2b_place_stats_monthly;

DROP FUNCTION IF EXISTS public.is_b2b_gold_of(uuid);
DROP FUNCTION IF EXISTS public.is_b2b_of(uuid);

DROP TABLE IF EXISTS public.b2b_accounts;

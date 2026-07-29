-- ============================================================================
-- Migration 0005 down — Triggers invariants sur `spawters`
-- ============================================================================
DROP TRIGGER IF EXISTS spawters_consent_set_once     ON public.spawters;
DROP TRIGGER IF EXISTS spawters_stade_no_regression  ON public.spawters;
DROP FUNCTION IF EXISTS public.assert_consent_set_once();
DROP FUNCTION IF EXISTS public.assert_stade_no_regression();
DROP FUNCTION IF EXISTS public.stade_rank(text);

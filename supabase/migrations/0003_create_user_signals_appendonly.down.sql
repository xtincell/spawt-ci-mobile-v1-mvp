-- ============================================================================
-- Migration 0003 — DOWN
-- ============================================================================

DROP POLICY IF EXISTS user_signals_select_own   ON public.user_signals;
DROP POLICY IF EXISTS user_signals_insert_own   ON public.user_signals;
DROP POLICY IF EXISTS user_signals_select_staff ON public.user_signals;

DROP TRIGGER IF EXISTS block_update_user_signals ON public.user_signals;
DROP TRIGGER IF EXISTS block_delete_user_signals ON public.user_signals;

DROP TABLE IF EXISTS public.user_signals CASCADE;

DROP FUNCTION IF EXISTS public.block_modifications_user_signals() CASCADE;

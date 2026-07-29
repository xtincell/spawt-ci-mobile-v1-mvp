-- ============================================================================
-- Migration 0004 — DOWN
-- ============================================================================

DROP POLICY IF EXISTS feature_flags_select_own    ON public.feature_flags;
DROP POLICY IF EXISTS feature_flags_select_staff  ON public.feature_flags;
DROP POLICY IF EXISTS feature_flags_insert_staff  ON public.feature_flags;
DROP POLICY IF EXISTS feature_flags_update_staff  ON public.feature_flags;
DROP POLICY IF EXISTS feature_flags_delete_staff  ON public.feature_flags;

DROP TRIGGER IF EXISTS update_timestamp_feature_flags ON public.feature_flags;

DROP TABLE IF EXISTS public.feature_flags CASCADE;

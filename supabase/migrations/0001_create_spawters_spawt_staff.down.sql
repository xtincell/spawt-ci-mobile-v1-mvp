-- ============================================================================
-- Migration 0001 — DOWN : drop tables spawters + spawt_staff + RLS + fonction
-- ============================================================================
-- Idempotent (IF EXISTS partout). Réversible à 100 %. Pas de DROP SCHEMA ni
-- DROP EXTENSION : on ne touche que les objets créés par 0001 up.

-- ━━━ Drop policies (7) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DROP POLICY IF EXISTS spawters_select_own       ON public.spawters;
DROP POLICY IF EXISTS spawters_insert_own       ON public.spawters;
DROP POLICY IF EXISTS spawters_update_own       ON public.spawters;
DROP POLICY IF EXISTS spawters_select_staff     ON public.spawters;
DROP POLICY IF EXISTS spawt_staff_select_own    ON public.spawt_staff;
DROP POLICY IF EXISTS spawt_staff_select_admin  ON public.spawt_staff;

-- ━━━ Drop triggers (2) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DROP TRIGGER IF EXISTS update_timestamp_spawters    ON public.spawters;
DROP TRIGGER IF EXISTS update_timestamp_spawt_staff ON public.spawt_staff;

-- ━━━ Drop tables (CASCADE — supprime aussi les index implicites) ━━━━━━━━━━━
DROP TABLE IF EXISTS public.spawt_staff CASCADE;
DROP TABLE IF EXISTS public.spawters    CASCADE;

-- ━━━ Drop fonction réutilisable ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- CASCADE refusera si une migration ultérieure (0002+) référence encore
-- set_updated_at — comportement attendu : tu dois drop ces migrations d'abord.
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;

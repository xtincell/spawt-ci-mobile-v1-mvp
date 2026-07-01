-- Rollback 0024 — Drop saved_places

DROP POLICY IF EXISTS "saved_places_delete_own" ON public.saved_places;
DROP POLICY IF EXISTS "saved_places_insert_own" ON public.saved_places;
DROP POLICY IF EXISTS "saved_places_select_own" ON public.saved_places;
DROP INDEX IF EXISTS idx_saved_places_place;
DROP TABLE IF EXISTS public.saved_places;

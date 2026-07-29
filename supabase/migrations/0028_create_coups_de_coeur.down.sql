-- Rollback 0028 — Drop Coup de Cœur

DROP FUNCTION IF EXISTS public.count_coups_de_coeur(UUID);
DROP FUNCTION IF EXISTS public.give_coup_de_coeur(UUID);
DROP POLICY IF EXISTS "cdc_select_all" ON public.coups_de_coeur;
DROP INDEX IF EXISTS idx_cdc_spawter_month;
DROP INDEX IF EXISTS idx_cdc_place_month;
DROP TABLE IF EXISTS public.coups_de_coeur;

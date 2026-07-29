-- Rollback 0044 — Drop ambassadeurs

DROP FUNCTION IF EXISTS public.compute_ambassador_palier(uuid);
DROP TABLE IF EXISTS public.ambassadors;

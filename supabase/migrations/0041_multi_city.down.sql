-- Rollback 0041 — Drop multi-villes

DROP INDEX IF EXISTS idx_places_city_code;
ALTER TABLE public.places DROP COLUMN IF EXISTS city_code;

DROP TABLE IF EXISTS public.cities;

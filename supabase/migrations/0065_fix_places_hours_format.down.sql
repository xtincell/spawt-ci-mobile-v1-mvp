-- Migration 0065 — DOWN.
-- ⚠️ On ne REMET PAS les horaires en français : ce n'était pas un format
-- alternatif, c'était une donnée que l'app rejetait. Seule la contrainte et la
-- fonction d'aide sont retirées.
ALTER TABLE public.places DROP CONSTRAINT IF EXISTS places_hours_canonical;
DROP FUNCTION IF EXISTS public.hours_to_canonical(JSONB);

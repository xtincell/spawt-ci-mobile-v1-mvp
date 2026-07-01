-- Rollback 0025 — Drop triggers + fonction de recalcul ADN

DROP TRIGGER IF EXISTS trg_recompute_place_adn_update ON public.spawt_checkin;
DROP TRIGGER IF EXISTS trg_recompute_place_adn_insert ON public.spawt_checkin;
DROP FUNCTION IF EXISTS public.recompute_place_adn_on_review();

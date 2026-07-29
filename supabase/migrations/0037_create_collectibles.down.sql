-- Rollback 0037 — Drop collectibles

DROP TRIGGER IF EXISTS trg_award_archetype_card_update ON public.spawters;
DROP TRIGGER IF EXISTS trg_award_archetype_card_insert ON public.spawters;
DROP FUNCTION IF EXISTS public.award_archetype_card();

DROP TABLE IF EXISTS public.spawter_cards;
DROP TABLE IF EXISTS public.collectible_cards;

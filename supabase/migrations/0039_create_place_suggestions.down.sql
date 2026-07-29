-- Rollback 0039 — Drop place_suggestions

DROP TRIGGER IF EXISTS trg_place_suggestions_review ON public.place_suggestions;
DROP FUNCTION IF EXISTS public.place_suggestions_autopopulate_review();
DROP TRIGGER IF EXISTS trg_place_suggestions_rate_limit ON public.place_suggestions;
DROP FUNCTION IF EXISTS public.assert_place_suggestions_rate_limit();

DROP TABLE IF EXISTS public.place_suggestions;

-- Rollback Story 5.1 + 5.2 — drop tables collection_titres + spawter_progression
-- (collection d'abord car aucune dep mais l'ordre symétrique aide les humains).

DROP TRIGGER IF EXISTS trg_collection_titres_append_only ON public.collection_titres;
DROP FUNCTION IF EXISTS public.assert_collection_titres_append_only();
DROP TABLE IF EXISTS public.collection_titres CASCADE;

DROP TRIGGER IF EXISTS trg_assert_stade_never_recedes ON public.spawter_progression;
DROP TRIGGER IF EXISTS update_timestamp_spawter_progression ON public.spawter_progression;
DROP FUNCTION IF EXISTS public.assert_stade_never_recedes();
DROP TABLE IF EXISTS public.spawter_progression CASCADE;

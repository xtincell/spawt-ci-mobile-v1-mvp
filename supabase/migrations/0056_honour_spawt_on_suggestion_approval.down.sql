-- Down 0056 — le spawt du découvreur redevient perdu à l'approbation.
-- Les spawts déjà crédités sont CONSERVÉS : ce sont de vraies visites, les
-- effacer réécrirait l'histoire des Spawters concernés.
DROP TRIGGER IF EXISTS trg_honour_spawt_on_approval ON public.place_suggestions;
DROP FUNCTION IF EXISTS public.honour_spawt_on_suggestion_approval();

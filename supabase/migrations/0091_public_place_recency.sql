-- Raccordement du signal de fraîcheur existant (PRD §8.2).
-- Champ calculé PostgREST : places?select=*,last_spawt_at
-- Une visite vérifiée fournit sa date ; une publication/édition de fiche,
-- un avis d'amorçage ou une simple proximité n'en fournissent aucune.
CREATE INDEX spawt_checkin_verified_recency_idx
  ON public.spawt_checkin (place_id, checked_in_at DESC)
  WHERE is_verified AND NOT is_seed AND NOT is_cancelled
    AND deleted_at IS NULL AND checked_in_at IS NOT NULL
    AND check_in_type <> 'passive';

CREATE FUNCTION public.last_spawt_at(place_row public.places)
RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT max(s.checked_in_at)
  FROM public.spawt_checkin s
  JOIN public.places p ON p.id = s.place_id
  WHERE p.id = (place_row).id AND p.is_published
    AND s.is_verified AND NOT s.is_seed AND NOT s.is_cancelled
    AND s.deleted_at IS NULL AND s.checked_in_at IS NOT NULL
    AND s.checked_in_at <= now()
    AND s.check_in_type <> 'passive'
$$;

COMMENT ON FUNCTION public.last_spawt_at(public.places) IS
  'Date du dernier spawt vérifié réel sur un lieu publié. Agrégat sans identité, sans date de remplacement.';
REVOKE ALL ON FUNCTION public.last_spawt_at(public.places) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.last_spawt_at(public.places) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

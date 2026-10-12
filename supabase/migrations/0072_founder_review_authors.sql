-- Attribution confirmée par Alexandre : les avis du rapport terrain sont les siens.
-- Le propriétaire technique reste le compte seed : poids, droits et purge inchangés.
-- Une relation séparée préserve les jointures spawt_checkin → spawters des anciennes APK.
CREATE TABLE public.review_author_attributions (
  review_id uuid PRIMARY KEY REFERENCES public.spawt_checkin(id) ON DELETE CASCADE,
  spawter_id uuid NOT NULL REFERENCES public.spawters(id) ON DELETE CASCADE
);
ALTER TABLE public.review_author_attributions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.review_author_attributions TO authenticated;
CREATE POLICY review_author_attributions_staff_read ON public.review_author_attributions
 FOR SELECT TO authenticated USING (EXISTS (
   SELECT 1 FROM public.spawt_staff WHERE id = auth.uid() AND is_active
 ));
COMMENT ON TABLE public.review_author_attributions IS 'Auteur public confirmé ; aucun transfert du propriétaire technique ni de ses droits.';
CREATE FUNCTION public.check_founder_attribution() RETURNS trigger LANGUAGE plpgsql
 SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.spawt_checkin WHERE id = NEW.review_id AND is_seed) THEN
    RAISE EXCEPTION 'founder_attribution_seed_only' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_check_founder_attribution BEFORE INSERT OR UPDATE ON public.review_author_attributions
 FOR EACH ROW EXECUTE FUNCTION public.check_founder_attribution();

DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.spawt_checkin
   WHERE is_seed AND seed_batch_id = 'a1000000-0000-4000-8000-00000000f001'
     AND spawter_id = 'a1000000-0000-4000-8000-00000000e001';
  IF n = 0 THEN RETURN; END IF;
  IF n <> 30 THEN RAISE EXCEPTION 'Attribution Mission 1 : 30 avis attendus, % trouvés', n; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.spawters WHERE id = 'c6e5c430-c762-41e9-991d-73d0aecc3382'
                  AND right(phone_e164,4) = '1799' AND NOT is_seed) THEN
    RAISE EXCEPTION 'Profil mobile Alexandre attendu pour l''attribution absent';
  END IF;
  INSERT INTO public.review_author_attributions (review_id, spawter_id)
   SELECT id, 'c6e5c430-c762-41e9-991d-73d0aecc3382'::uuid FROM public.spawt_checkin WHERE is_seed AND seed_batch_id = 'a1000000-0000-4000-8000-00000000f001'
     AND spawter_id = 'a1000000-0000-4000-8000-00000000e001';
END;
$$;

CREATE OR REPLACE VIEW public.public_reviews
  WITH (security_invoker = false)
AS
  SELECT
    sc.id,
    sc.place_id,
    -- `spawter_id` reste exposé : l'app en a besoin pour savoir si un avis est
    -- le sien (bouton « modifier ») et pour dédupliquer. C'est un identifiant
    -- opaque, déjà porté par `spawters_public`. Ce qui ne sort pas, c'est ce
    -- qu'on ne peut pas relier à un identifiant sans le compromettre : la
    -- position et l'horodatage de passage.
    COALESCE(author.id, sc.spawter_id) AS spawter_id,
    sc.note_etoiles,
    sc.texte_avis,
    sc.photos,
    sc.tags,
    sc.is_seed,
    sc.created_at,
    COALESCE(author.display_name, sp.display_name) AS display_name,
    CASE WHEN author.id IS NOT NULL THEN author.avatar_url ELSE sp.avatar_url END AS avatar_url,
    COALESCE(author.stade, sp.stade) AS stade,
    sc.note_cuisine,
    sc.note_cadre,
    sc.note_service,
    public.review_global_rating(sc.note_etoiles, sc.note_cuisine, sc.note_cadre, sc.note_service) AS note_globale
  FROM public.spawt_checkin sc
  JOIN public.spawters sp ON sp.id = sc.spawter_id
  LEFT JOIN public.review_author_attributions attribution ON attribution.review_id = sc.id
  LEFT JOIN public.spawters author ON author.id = attribution.spawter_id
  JOIN public.places p ON p.id = sc.place_id AND p.is_published
 WHERE sc.note_etoiles IS NOT NULL
   AND sc.deleted_at IS NULL
   AND sc.is_cancelled = false;
GRANT SELECT ON public.public_reviews TO anon, authenticated;

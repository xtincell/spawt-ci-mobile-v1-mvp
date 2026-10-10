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
    sc.spawter_id,
    sc.note_etoiles,
    sc.texte_avis,
    sc.photos,
    sc.tags,
    sc.is_seed,
    sc.created_at,
    sp.display_name,
    sp.avatar_url,
    sp.stade,
    sc.note_cuisine,
    sc.note_cadre,
    sc.note_service,
    public.review_global_rating(sc.note_etoiles, sc.note_cuisine, sc.note_cadre, sc.note_service) AS note_globale
  FROM public.spawt_checkin sc
  JOIN public.spawters sp ON sp.id = sc.spawter_id
  JOIN public.places p ON p.id = sc.place_id AND p.is_published
 WHERE sc.note_etoiles IS NOT NULL
   AND sc.deleted_at IS NULL
   AND sc.is_cancelled = false;
DROP TABLE public.review_author_attributions;
DROP FUNCTION public.check_founder_attribution();

-- Retire les critères : exporter leurs valeurs avant une restauration de schéma.
DROP VIEW public.public_reviews;
CREATE VIEW public.public_reviews
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
    sp.stade
  FROM public.spawt_checkin sc
  JOIN public.spawters sp ON sp.id = sc.spawter_id
 WHERE sc.note_etoiles IS NOT NULL
   AND sc.deleted_at IS NULL
   AND sc.is_cancelled = false;
GRANT SELECT ON public.public_reviews TO anon, authenticated;
CREATE OR REPLACE FUNCTION public.recompute_place_adn_full(p_place_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_adn public.place_adn%ROWTYPE;
  r RECORD;
  v_weight REAL; v_factor REAL; v_tag TEXT;
  v_local REAL; v_informel REAL; v_budget REAL; v_populaire REAL; v_decontracte REAL;
  v_total INTEGER := 0;
  v_all INTEGER := 0;
  v_weight_sum REAL := 0;
  v_rating_sum REAL := 0;
  v_seuil INTEGER;
  v_revealed TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_adn FROM public.place_adn WHERE place_id = p_place_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.place_adn (place_id) VALUES (p_place_id)
      ON CONFLICT (place_id) DO NOTHING;
    SELECT * INTO v_adn FROM public.place_adn WHERE place_id = p_place_id FOR UPDATE;
  END IF;

  v_local       := v_adn.base_axe_local_international;
  v_informel    := v_adn.base_axe_informel_etabli;
  v_budget      := v_adn.base_axe_budget_premium;
  v_populaire   := v_adn.base_axe_populaire_prive;
  v_decontracte := v_adn.base_axe_decontracte_habille;

  FOR r IN
    SELECT sc.note_etoiles, sc.tags, sc.is_seed,
           COALESCE(sp.stade, 'touriste') AS stade
      FROM public.spawt_checkin sc
      LEFT JOIN public.spawters sp ON sp.id = sc.spawter_id
     WHERE sc.place_id = p_place_id
       AND sc.note_etoiles IS NOT NULL
       AND sc.is_cancelled = false
       AND sc.deleted_at IS NULL
     ORDER BY sc.arrived_at, sc.id
  LOOP
    v_weight := CASE r.stade
      WHEN 'explorateur' THEN 1.5 WHEN 'detective' THEN 2.0
      WHEN 'djidji' THEN 2.5 WHEN 'guide' THEN 3.0 ELSE 1.0 END;

    v_rating_sum := v_rating_sum + r.note_etoiles * v_weight;
    v_weight_sum := v_weight_sum + v_weight;

    v_all   := v_all + 1;
    v_total := v_total + (CASE WHEN r.is_seed THEN 0 ELSE 1 END);
    v_factor := GREATEST(0.05, 1.0 / (1.0 + v_all * 0.05));

    IF r.note_etoiles <> 3 THEN
      v_decontracte := v_decontracte
        + (CASE WHEN r.note_etoiles >= 4 THEN 1 ELSE -1 END)
        * (CASE WHEN r.note_etoiles IN (1, 5) THEN 0.03 ELSE 0.02 END)
        * v_factor;
    END IF;

    IF r.tags IS NOT NULL THEN
      FOREACH v_tag IN ARRAY r.tags LOOP
        CASE v_tag
          WHEN 'copieux' THEN
            v_informel := v_informel - 0.03 * v_factor;
            v_budget   := v_budget   - 0.02 * v_factor;
          WHEN 'rapide' THEN
            v_informel    := v_informel    - 0.03 * v_factor;
            v_decontracte := v_decontracte - 0.02 * v_factor;
          WHEN 'ambiance_top' THEN
            v_populaire   := v_populaire   - 0.03 * v_factor;
            v_decontracte := v_decontracte + 0.02 * v_factor;
          WHEN 'cher' THEN
            v_budget   := v_budget   + 0.04 * v_factor;
            v_informel := v_informel + 0.02 * v_factor;
          WHEN 'a_refaire' THEN
            v_populaire := v_populaire - 0.02 * v_factor;
          ELSE NULL;
        END CASE;
      END LOOP;
    END IF;
  END LOOP;

  -- Le cliquet. Trois cas, dans cet ordre :
  --   * déjà révélé et toujours ≥ 3 avis  → on garde (le durcissement du
  --     seuil ne reprend jamais l'acquis) ;
  --   * pas encore révélé et seuil courant atteint → on révèle maintenant ;
  --   * moins de 3 avis → on retire : là, la connaissance a vraiment régressé
  --     (purge d'un lot d'amorçage, modération), le masquage est honnête.
  v_seuil := public.adn_reveal_threshold();
  v_revealed := v_adn.adn_revealed_at;
  IF v_all < 3 THEN
    v_revealed := NULL;
  ELSIF v_revealed IS NULL AND v_all >= v_seuil THEN
    v_revealed := now();
  END IF;

  UPDATE public.place_adn SET
    axe_local_international = GREATEST(-1, LEAST(1, v_local)),
    axe_informel_etabli     = GREATEST(-1, LEAST(1, v_informel)),
    axe_budget_premium      = GREATEST(-1, LEAST(1, v_budget)),
    axe_populaire_prive     = GREATEST(-1, LEAST(1, v_populaire)),
    axe_decontracte_habille = GREATEST(-1, LEAST(1, v_decontracte)),
    weighted_rating         = CASE WHEN v_weight_sum = 0 THEN 0
                                   ELSE GREATEST(0, LEAST(5,
                                     ROUND((v_rating_sum / v_weight_sum)::numeric, 1))) END,
    total_reviews           = v_total,
    sample_size             = v_all,
    adn_revealed_at         = v_revealed,
    confidence_score        = GREATEST(0, LEAST(1, 1.0 - 1.0 / (1.0 + v_all * 0.05))),
    updated_at              = now()
  WHERE place_id = p_place_id;
END;
$$;
DROP TRIGGER IF EXISTS trg_recompute_place_adn_note_edit ON public.spawt_checkin;
CREATE TRIGGER trg_recompute_place_adn_note_edit AFTER UPDATE OF note_etoiles, tags ON public.spawt_checkin
FOR EACH ROW WHEN (OLD.note_etoiles IS NOT NULL AND NEW.note_etoiles IS NOT NULL
  AND (OLD.note_etoiles IS DISTINCT FROM NEW.note_etoiles OR OLD.tags IS DISTINCT FROM NEW.tags))
EXECUTE FUNCTION public.recompute_place_adn_on_removal();
DROP TRIGGER trg_normalize_review_ratings ON public.spawt_checkin;
DROP FUNCTION public.normalize_review_ratings();
DROP FUNCTION public.review_global_rating(smallint, smallint, smallint, smallint);
ALTER TABLE public.spawt_checkin DROP CONSTRAINT spawt_checkin_review_details, DROP COLUMN note_cuisine, DROP COLUMN note_cadre, DROP COLUMN note_service;

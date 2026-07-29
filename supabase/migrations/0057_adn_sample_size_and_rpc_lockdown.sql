-- ============================================================================
-- Migration 0057 — deux défauts trouvés en repassant le cahier ligne à ligne
-- ============================================================================
--
-- ── 1. FR-026 n'est pas tenu : la porte d'affichage de l'ADN se trompe de
--       compteur ────────────────────────────────────────────────────────────
-- Le cahier est explicite :
--   « Un lieu avec < 5 avis (avis seed INCLUS pour le calcul ADN, exclus pour
--     l'affichage du compteur communauté) affiche "ADN en construction" »
--
-- Or la fiche lieu teste `place_adn.total_reviews`, qui est justement le
-- compteur communauté — seeds exclus. Conséquence : les avis fondateurs
-- n'accélèrent RIEN. Un lieu avec 3 avis fondateurs devrait n'avoir besoin que
-- de 2 avis communautaires pour révéler son radar ; avec le code actuel il lui
-- en faut 5, soit 8 avis réels. Tout le bénéfice de cold start que FR-032
-- promet est perdu, alors même que les avis sont là.
--
-- On expose donc `sample_size` : le nombre d'avis RÉELLEMENT pris en compte
-- dans le calcul (fondateurs + communauté). C'est cette valeur qui doit
-- décider de l'affichage, tandis que `total_reviews` reste le chiffre honnête
-- montré au spawter.
--
-- ── 2. Sécurité : deux fonctions SECURITY DEFINER ouvertes à `anon` ─────────
-- `recompute_place_adn_full` répondait 204 à un appel PostgREST avec la clé
-- anon (qui est publique par nature). Étant SECURITY DEFINER, elle écrit dans
-- `place_adn` en contournant la RLS qui réserve cette écriture au staff, et
-- chaque appel prend un `FOR UPDATE` puis scanne tous les avis du lieu — de
-- quoi saturer la base en la martelant.
--
-- ⚠️ Le correctif est un REVOKE, PAS une garde sur `request.jwt.claims`.
-- SECURITY DEFINER change les privilèges, pas les claims : à l'intérieur du
-- trigger d'ajout d'avis, la fonction verrait les claims du spawter et une
-- garde « service_role uniquement » REJETTERAIT la création de tout avis
-- légitime. Le trigger, lui, continue d'appeler la fonction sans problème :
-- il est SECURITY DEFINER et s'exécute avec les privilèges de son
-- propriétaire.
-- Date : 2026-07-28

-- ━━━ 1. La taille d'échantillon réelle ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.place_adn
  ADD COLUMN IF NOT EXISTS sample_size INTEGER NOT NULL DEFAULT 0
    CHECK (sample_size >= 0);

COMMENT ON COLUMN public.place_adn.sample_size IS
  'Nombre d''avis réellement entrés dans le calcul de l''ADN — fondateurs '
  '(is_seed) INCLUS. C''est cette valeur qui décide de l''affichage du radar '
  '(FR-026 : « < 5 avis, seed inclus » → ADN en construction). Ne jamais '
  'l''afficher au spawter : le chiffre public reste `total_reviews`.';

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
  v_total INTEGER := 0;         -- communauté seule — le chiffre public
  v_all INTEGER := 0;           -- tous les avis valides — moyenne, confiance, affichage
  v_weight_sum REAL := 0;
  v_rating_sum REAL := 0;
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
    confidence_score        = GREATEST(0, LEAST(1, 1.0 - 1.0 / (1.0 + v_all * 0.05))),
    updated_at              = now()
  WHERE place_id = p_place_id;
END;
$$;

-- ━━━ 2. Fermeture des RPC ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Ces fonctions n'ont aucune raison d'être appelables depuis un client. Les
-- triggers qui s'en servent sont SECURITY DEFINER et gardent leurs privilèges.
REVOKE ALL ON FUNCTION public.recompute_place_adn_full(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.honour_spawt_on_suggestion_approval() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_place_adn_on_review() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_place_adn_on_removal() FROM PUBLIC, anon, authenticated;
-- `purge_seed_reviews` garde sa propre garde interne (elle vérifie le rôle
-- avant de supprimer) mais n'a rien à faire côté client non plus.
REVOKE ALL ON FUNCTION public.purge_seed_reviews(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;

-- ━━━ 3. Rattrapage ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DO $$
DECLARE v_pid UUID;
BEGIN
  FOR v_pid IN SELECT place_id FROM public.place_adn LOOP
    PERFORM public.recompute_place_adn_full(v_pid);
  END LOOP;
END$$;

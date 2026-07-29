-- ============================================================================
-- Migration 0055 — la note affichée était celle du DERNIER avis
-- ============================================================================
-- Défaut hérité de 0025 et reporté tel quel dans le recompte de 0054, révélé
-- par le chargement des avis fondateurs de la Mission 1.
--
-- Le compteur `total_reviews` n'inclut pas les avis fondateurs (voulu, FR-032).
-- Or la moyenne pondérée s'appuyait sur CE MÊME compteur :
--
--     IF v_total = 0 THEN v_rating := note; ELSE v_rating := moyenne(...); END IF;
--     v_total := v_total + (CASE WHEN is_seed THEN 0 ELSE 1 END);
--
-- Sur un lieu qui n'a que des avis fondateurs, `v_total` reste donc à 0 à
-- chaque tour et la branche « premier avis » l'emporte systématiquement : la
-- note finale est celle du dernier avis lu, pas une moyenne.
-- Constaté sur Bushman Café — avis 4, 4 puis 3 → note affichée 3,0 au lieu de
-- 3,7. Et sur Kajazoma — 4, 3, 2 → 2,0 au lieu de 3,0.
--
-- Même racine pour `confidence_score` : `v_conf_total` valait `v_total + 1`,
-- donc 1 en permanence — trois avis fondateurs donnaient la confiance d'un
-- seul (0,05).
--
-- Correction : dissocier deux compteurs.
--   `v_total` — avis de la COMMUNAUTÉ seuls. C'est le chiffre public.
--   `v_all`   — TOUS les avis valides, fondateurs compris. Sert à la moyenne,
--               à la confiance et à la décroissance des signaux.
-- C'est bien ce que demande FR-032 : « les avis seed alimentent l'ADN sans
-- gonfler artificiellement le compteur public ». Alimenter l'ADN, ça inclut
-- la note et la confiance.
-- Date : 2026-07-28

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
  v_total INTEGER := 0;         -- avis communautaires — le compteur public
  v_all INTEGER := 0;           -- tous les avis valides — moyenne & confiance
  v_weight_sum REAL := 0;       -- somme des poids de stade, pour la moyenne
  v_rating_sum REAL := 0;       -- somme des notes pondérées
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

    -- Moyenne pondérée par stade sur TOUS les avis valides. Une vraie somme,
    -- pas une approximation incrémentale : le recompte a l'historique complet
    -- sous les yeux, autant s'en servir.
    v_rating_sum := v_rating_sum + r.note_etoiles * v_weight;
    v_weight_sum := v_weight_sum + v_weight;

    v_all   := v_all + 1;
    v_total := v_total + (CASE WHEN r.is_seed THEN 0 ELSE 1 END);
    -- La décroissance suit le nombre d'avis RÉELLEMENT accumulés : plus un
    -- lieu est documenté, moins un avis de plus déplace son ADN.
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
    confidence_score        = GREATEST(0, LEAST(1, 1.0 - 1.0 / (1.0 + v_all * 0.05))),
    updated_at              = now()
  WHERE place_id = p_place_id;
END;
$$;

COMMENT ON FUNCTION public.recompute_place_adn_full(UUID) IS
  'Recompte l''ADN d''un lieu depuis ses avis réels, à partir de la base '
  'éditoriale. Deux compteurs distincts : `total_reviews` (communauté seule, '
  'chiffre public) et le total réel (fondateurs compris) qui porte la moyenne, '
  'la confiance et la décroissance des signaux — FR-032.';

-- Le trigger incrémental de 0025 souffre du même défaut, mais il ne se
-- déclenche qu'à l'ajout et sur un lieu qui a déjà des avis communautaires.
-- Plutôt que de le corriger à moitié, on le remplace par le recompte : il est
-- la source unique, et il n'y a plus qu'une formule à maintenir au lieu de
-- trois divergentes (PL/pgSQL 0025, TS seed-inventory, TS place-adn-update).
CREATE OR REPLACE FUNCTION public.recompute_place_adn_on_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.note_etoiles IS NULL OR NEW.is_cancelled = true OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  PERFORM public.recompute_place_adn_full(NEW.place_id);
  RETURN NEW;
END;
$$;

-- Rattrapage sur l'existant : les lieux chargés avant ce correctif portent une
-- note fausse (celle de leur dernier avis).
DO $$
DECLARE v_pid UUID;
BEGIN
  FOR v_pid IN SELECT place_id FROM public.place_adn LOOP
    PERFORM public.recompute_place_adn_full(v_pid);
  END LOOP;
END$$;

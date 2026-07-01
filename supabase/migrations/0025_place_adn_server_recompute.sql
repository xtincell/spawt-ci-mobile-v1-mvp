-- Migration 0025 — Recalcul serveur de l'ADN du lieu à chaque avis
-- Date: 2026-07-01
-- Contexte: câblage MVP. Story 4.7 avait livré le compute côté client
-- (place-adn-update.ts) mais SANS persistance serveur (RLS place_adn interdit
-- l'update client, Edge Function "recompute-place-adn" documentée jamais créée).
-- Résultat : l'ADN communautaire ne s'accumulait pas. Ce trigger ferme la
-- boucle en portant la logique TS (place-adn-signals.ts + place-adn-update.ts)
-- en PL/pgSQL — server-authoritative, aucune écriture client requise.
--
-- Déclenchement : avis attaché à un spawt (INSERT avec note, ou UPDATE qui
-- pose une note absente). Une note ÉDITÉE ne re-déclenche pas (pas de
-- double-comptage — parité avec le client V1). Rows annulées/soft-deleted
-- ignorées.

CREATE OR REPLACE FUNCTION public.recompute_place_adn_on_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_stade TEXT;
  v_weight REAL;
  v_adn public.place_adn%ROWTYPE;
  v_new_total INTEGER;
  v_conf_total INTEGER;
  v_factor REAL;
  v_local REAL; v_informel REAL; v_budget REAL; v_populaire REAL; v_decontracte REAL;
  v_rating REAL;
  v_note_dir REAL; v_note_weight REAL;
  v_tag TEXT;
BEGIN
  -- Row inexploitable — pas un avis publiable.
  IF NEW.note_etoiles IS NULL OR NEW.is_cancelled = true OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Poids de l'avis selon le stade du spawter (PRD §3.1 F6).
  SELECT stade INTO v_stade FROM public.spawters WHERE id = NEW.spawter_id;
  v_weight := CASE COALESCE(v_stade, 'touriste')
    WHEN 'explorateur' THEN 1.5
    WHEN 'detective'   THEN 2.0
    WHEN 'djidji'      THEN 2.5
    WHEN 'guide'       THEN 3.0
    ELSE 1.0
  END;

  -- Verrou ligne ADN (sérialise les avis concurrents sur le même lieu).
  SELECT * INTO v_adn FROM public.place_adn WHERE place_id = NEW.place_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.place_adn (place_id) VALUES (NEW.place_id)
    ON CONFLICT (place_id) DO NOTHING;
    SELECT * INTO v_adn FROM public.place_adn WHERE place_id = NEW.place_id FOR UPDATE;
  END IF;

  -- Parité place-adn-update.ts : les seeds ne comptent pas dans total_reviews
  -- mais comptent dans la confiance.
  v_new_total  := v_adn.total_reviews + (CASE WHEN NEW.is_seed THEN 0 ELSE 1 END);
  v_conf_total := v_new_total + (CASE WHEN NEW.is_seed THEN 1 ELSE 0 END);
  v_factor := GREATEST(0.05, 1.0 / (1.0 + v_new_total * 0.05));

  v_local       := v_adn.axe_local_international;
  v_informel    := v_adn.axe_informel_etabli;
  v_budget      := v_adn.axe_budget_premium;
  v_populaire   := v_adn.axe_populaire_prive;
  v_decontracte := v_adn.axe_decontracte_habille;

  -- Signal note → axe_decontracte_habille (place-adn-signals.ts noteToAdnSignals).
  IF NEW.note_etoiles <> 3 THEN
    v_note_dir := CASE WHEN NEW.note_etoiles >= 4 THEN 1 ELSE -1 END;
    v_note_weight := CASE WHEN NEW.note_etoiles IN (1, 5) THEN 0.03 ELSE 0.02 END;
    v_decontracte := v_decontracte + v_note_dir * v_note_weight * v_factor;
  END IF;

  -- Signaux tags → axes (place-adn-signals.ts TAG_TO_ADN_SIGNALS).
  IF NEW.tags IS NOT NULL THEN
    FOREACH v_tag IN ARRAY NEW.tags LOOP
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
        ELSE
          NULL; -- tag inconnu — ignoré
      END CASE;
    END LOOP;
  END IF;

  -- Note pondérée — approximation incrémentale (parité approximateWeightedRating).
  IF v_adn.total_reviews = 0 THEN
    v_rating := NEW.note_etoiles;
  ELSE
    v_rating := ROUND((
      (v_adn.weighted_rating * v_adn.total_reviews + NEW.note_etoiles * v_weight)
      / (v_adn.total_reviews + v_weight)
    )::numeric, 1);
  END IF;

  UPDATE public.place_adn SET
    axe_local_international = GREATEST(-1, LEAST(1, v_local)),
    axe_informel_etabli     = GREATEST(-1, LEAST(1, v_informel)),
    axe_budget_premium      = GREATEST(-1, LEAST(1, v_budget)),
    axe_populaire_prive     = GREATEST(-1, LEAST(1, v_populaire)),
    axe_decontracte_habille = GREATEST(-1, LEAST(1, v_decontracte)),
    weighted_rating         = GREATEST(0, LEAST(5, v_rating)),
    total_reviews           = v_new_total,
    confidence_score        = GREATEST(0, LEAST(1, 1.0 - 1.0 / (1.0 + v_conf_total * 0.05))),
    updated_at              = now()
  WHERE place_id = NEW.place_id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.recompute_place_adn_on_review() IS
  'Câblage MVP — port PL/pgSQL de place-adn-update.ts (Story 4.7). '
  'SECURITY DEFINER : bypass RLS place_adn (écriture réservée au serveur). '
  'search_path fixé (advisors).';

-- INSERT d''un spawt déjà noté (seed-inventory, avis direct) OU UPDATE qui
-- attache une note à une row pending (flux Le Guet : modal avis post-notif).
CREATE TRIGGER trg_recompute_place_adn_insert
  AFTER INSERT ON public.spawt_checkin
  FOR EACH ROW
  WHEN (NEW.note_etoiles IS NOT NULL)
  EXECUTE FUNCTION public.recompute_place_adn_on_review();

CREATE TRIGGER trg_recompute_place_adn_update
  AFTER UPDATE OF note_etoiles ON public.spawt_checkin
  FOR EACH ROW
  WHEN (OLD.note_etoiles IS NULL AND NEW.note_etoiles IS NOT NULL)
  EXECUTE FUNCTION public.recompute_place_adn_on_review();

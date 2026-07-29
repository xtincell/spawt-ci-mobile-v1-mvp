-- ============================================================================
-- Migration 0056 — le spawt du découvreur n'est plus perdu
-- ============================================================================
-- Le bouton central existe pour une seule raison : dire « j'y suis, là,
-- maintenant ». Quand le lieu n'est pas encore en base, le spawter peut
-- désormais le suggérer (câblage posé côté app). Mais la boucle s'arrêtait là :
-- la suggestion partait en modération, et sa visite — celle qui a justement
-- permis de découvrir le spot — n'était enregistrée nulle part.
--
-- Concrètement : le premier Spawter à documenter un lieu était le seul à ne
-- pas être crédité de sa venue. Il aurait fallu qu'il revienne plusieurs jours
-- plus tard, une fois la fiche validée, pour spawter. C'est le contraire de ce
-- que le produit promet.
--
-- ── Ce que fait cette migration ─────────────────────────────────────────────
-- À l'approbation d'une suggestion — c'est-à-dire quand le staff crée la fiche
-- et renseigne `created_place_id` — le spawt du découvreur est créé
-- rétroactivement, à la date et à la position de sa suggestion.
--
-- ── Ce qu'elle ne fait PAS, et pourquoi ─────────────────────────────────────
-- Elle ne crée pas de fiche à la place du staff. Le PRD est explicite
-- (FR-018) : « la création est modérée — pas de fiches créées directement par
-- les users ». La modération reste souveraine ; on se contente de ne pas jeter
-- l'information une fois qu'elle a dit oui.
--
-- ── La condition qui garde l'anti-fraude honnête ────────────────────────────
-- Le spawt n'est honoré QUE si la suggestion portait des coordonnées GPS. Le
-- formulaire ne les attache que sur position réellement GPS (pas réseau, pas
-- saisie) et sur action explicite du spawter. Sans elles, rien ne prouve une
-- présence sur place : on ne crédite pas une visite qu'on ne peut pas étayer.
-- `is_verified` suit la même règle que le spawt manuel du bouton central :
-- vrai seulement si la position est à moins de 100 m de la fiche finalement
-- créée par le staff — le lieu a pu être positionné ailleurs que ce que le
-- suggérant croyait.
-- Date : 2026-07-28

CREATE OR REPLACE FUNCTION public.honour_spawt_on_suggestion_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_place public.places%ROWTYPE;
  v_distance_m DOUBLE PRECISION;
BEGIN
  -- Rien à faire tant que la fiche n'est pas réellement créée.
  IF NEW.status <> 'approved' OR NEW.created_place_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Ne se déclenche qu'au passage à approuvé (pas sur une réécriture ultérieure).
  IF OLD.status = 'approved' AND OLD.created_place_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  -- Pas de position = pas de preuve de présence.
  IF NEW.lat IS NULL OR NEW.lng IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_place FROM public.places WHERE id = NEW.created_place_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Idempotence : si le spawt existe déjà (re-approbation, rejeu), on sort.
  IF EXISTS (
    SELECT 1 FROM public.spawt_checkin sc
    WHERE sc.spawter_id = NEW.spawter_id
      AND sc.place_id = NEW.created_place_id
      AND sc.arrived_at = NEW.created_at
  ) THEN
    RETURN NEW;
  END IF;

  -- Distance suggérant ↔ fiche créée (haversine, rayon terrestre 6371 km).
  v_distance_m := 6371000 * acos(LEAST(1.0, GREATEST(-1.0,
      cos(radians(NEW.lat)) * cos(radians(v_place.lat))
    * cos(radians(v_place.lng) - radians(NEW.lng))
    + sin(radians(NEW.lat)) * sin(radians(v_place.lat))
  )));

  INSERT INTO public.spawt_checkin
    (spawter_id, place_id, arrived_at, check_in_type, geolocation_source,
     is_verified, geolocation_lat, geolocation_lng)
  VALUES
    (NEW.spawter_id, NEW.created_place_id, NEW.created_at, 'manual', 'gps',
     v_distance_m <= 100, NEW.lat, NEW.lng);

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.honour_spawt_on_suggestion_approval() IS
  'Crédite au découvreur le spawt de la visite qui a produit sa suggestion, à '
  'l''approbation de celle-ci. Uniquement si la suggestion portait un GPS ; '
  'is_verified selon la distance réelle à la fiche créée (≤100 m). La '
  'modération reste souveraine sur la création de la fiche (FR-018).';

-- AFTER : la fiche doit exister et `created_place_id` être posé.
DROP TRIGGER IF EXISTS trg_honour_spawt_on_approval ON public.place_suggestions;
CREATE TRIGGER trg_honour_spawt_on_approval
  AFTER UPDATE OF status, created_place_id ON public.place_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.honour_spawt_on_suggestion_approval();

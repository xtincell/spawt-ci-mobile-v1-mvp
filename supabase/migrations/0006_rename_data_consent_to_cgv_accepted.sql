-- ============================================================================
-- Migration 0006 — Rename `spawters.data_consent_at` → `cgv_accepted_at`
-- ============================================================================
-- Story 2.2 — Splash & écran de consentement ARTCI bloquant
-- PRD ref : §20.7 (FR-040) + architecture §1.2.7 (spec consent fields)
--
-- Pourquoi : FR-040 et architecture §1.2.7 désignent les deux consents bloquants
-- comme `cgv_accepted_at` (CGU/CGV) + `geoloc_consent_at` (collecte données +
-- géolocalisation). Migration 0001 livrait `data_consent_at` (legacy framing
-- "consentement traitement données démographiques"), désormais aligné sur le
-- vocabulaire ARTCI canonique.
--
-- Safe-rename : aucun row spawter prod n'existe (alpha pas démarrée). La
-- down-migration est triviale (inverse du rename + restauration trigger 0005).
--
-- Trigger set-once : la migration 0005 référence l'ancien nom de colonne. Le
-- rename de colonne n'invalide pas le trigger côté Postgres (les triggers BEFORE
-- UPDATE OF <col> sont liés au nom courant). On DROP puis recrée le trigger
-- avec la nouvelle référence dans la même transaction, pour rester explicite et
-- garantir la cohérence du message d'erreur.
-- ============================================================================

-- ━━━ Rename column ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.spawters
  RENAME COLUMN data_consent_at TO cgv_accepted_at;

COMMENT ON COLUMN public.spawters.cgv_accepted_at IS
  'Timestamp d''acceptation des CGU/CGV (FR-040 + DR-CGV-01). Set-once via trigger spawters_consent_set_once (audit ARTCI Loi 2013-450).';

-- ━━━ Recreate set-once trigger référençant la nouvelle colonne ━━━━━━━━━━━━━━━
DROP TRIGGER IF EXISTS spawters_consent_set_once ON public.spawters;

CREATE OR REPLACE FUNCTION public.assert_consent_set_once()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.geoloc_consent_at IS NOT NULL
     AND NEW.geoloc_consent_at IS DISTINCT FROM OLD.geoloc_consent_at THEN
    RAISE EXCEPTION
      'geoloc_consent_at est set-once (audit ARTCI Loi 2013-450) — valeur existante : %',
      OLD.geoloc_consent_at
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.cgv_accepted_at IS NOT NULL
     AND NEW.cgv_accepted_at IS DISTINCT FROM OLD.cgv_accepted_at THEN
    RAISE EXCEPTION
      'cgv_accepted_at est set-once (audit ARTCI Loi 2013-450) — valeur existante : %',
      OLD.cgv_accepted_at
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER spawters_consent_set_once
  BEFORE UPDATE OF geoloc_consent_at, cgv_accepted_at ON public.spawters
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_consent_set_once();

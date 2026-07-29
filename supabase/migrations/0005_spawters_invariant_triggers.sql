-- ============================================================================
-- Migration 0005 — Triggers invariants sur `spawters`
-- ============================================================================
-- Code review post-Stories 1.5-1.8 (2026-05-16).
--
-- Deux invariants à enforcer côté DB :
--   1. `stade` ne recule jamais (PRD §5.2 + project-context).
--   2. `geoloc_consent_at` / `data_consent_at` sont set-once (audit ARTCI
--      Loi 2013-450 — un consent timestamp non-NULL est immuable).
-- ============================================================================

-- ━━━ Fonction : stade_rank ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION public.stade_rank(s text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE s
    WHEN 'touriste'    THEN 1
    WHEN 'explorateur' THEN 2
    WHEN 'detective'   THEN 3
    WHEN 'djidji'      THEN 4
    WHEN 'guide'       THEN 5
    ELSE 0
  END;
$$;

COMMENT ON FUNCTION public.stade_rank(text) IS
  'Ordinal des stades SPAWT (PRD §5.2). Utilisé par le trigger anti-régression.';

-- ━━━ Trigger : empêche la régression de stade ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION public.assert_stade_no_regression()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.stade IS DISTINCT FROM OLD.stade
     AND public.stade_rank(NEW.stade) < public.stade_rank(OLD.stade) THEN
    RAISE EXCEPTION
      'Stade regression interdit : % → % (PRD §5.2 invariant)',
      OLD.stade, NEW.stade
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER spawters_stade_no_regression
  BEFORE UPDATE OF stade ON public.spawters
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_stade_no_regression();

-- ━━━ Trigger : consent timestamps set-once ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

  IF OLD.data_consent_at IS NOT NULL
     AND NEW.data_consent_at IS DISTINCT FROM OLD.data_consent_at THEN
    RAISE EXCEPTION
      'data_consent_at est set-once (audit ARTCI Loi 2013-450) — valeur existante : %',
      OLD.data_consent_at
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER spawters_consent_set_once
  BEFORE UPDATE OF geoloc_consent_at, data_consent_at ON public.spawters
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_consent_set_once();

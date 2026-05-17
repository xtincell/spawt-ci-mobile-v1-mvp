-- ============================================================================
-- Down 0006 — Restaure `cgv_accepted_at` → `data_consent_at` + trigger originel
-- ============================================================================
-- Inverse de 0006_rename_data_consent_to_cgv_accepted.sql.
-- ============================================================================

DROP TRIGGER IF EXISTS spawters_consent_set_once ON public.spawters;

ALTER TABLE public.spawters
  RENAME COLUMN cgv_accepted_at TO data_consent_at;

-- Restaure la version originale du trigger set-once (cf. migration 0005).
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

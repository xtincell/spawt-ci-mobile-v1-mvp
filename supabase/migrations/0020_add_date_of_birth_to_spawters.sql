-- Story 4.8 — Refactor date_of_birth dynamique (Epic 4 PASS 2)
-- Retour user test mobile 2026-05-20 point #2 (CGU + onboarding).
--
-- Remplace la tranche d'âge figée saisie côté UI par une date de naissance
-- précise. La colonne `age_range` existante reste (Story 2.4 — back-compat
-- pour KPI funnel Madame Sun) et est dérivée via helper TS au finalize
-- onboarding.
--
-- Contraintes :
--   1. `date_of_birth` est `date` nullable (les rows pré-Story 4.8 ont NULL).
--   2. CHECK min âge 13 ans (RGPD-équivalent CIV).
--   3. Index B-tree pour requêtes potentielles "anniversaire du jour" futures.
--
-- Note PII : `date_of_birth` reste DB-only. Les events analytics Madame Sun
-- consomment exclusivement `age_range` (anonymisé, bucketé) — voir
-- documentation/analytics/events.md.

ALTER TABLE spawters
  ADD COLUMN date_of_birth date,
  ADD CONSTRAINT spawters_dob_min_age CHECK (
    date_of_birth IS NULL OR date_of_birth <= now() - interval '13 years'
  );

CREATE INDEX IF NOT EXISTS idx_spawters_dob ON spawters(date_of_birth);

COMMENT ON COLUMN spawters.date_of_birth IS
  'Date de naissance précise (Story 4.8). Nullable pour back-compat rows pré-4.8. ' ||
  'Jamais émis dans analytics (PII brute). KPI funnel utilise age_range dérivé.';

-- Rollback Story 4.8 — drop date_of_birth + contrainte + index.

DROP INDEX IF EXISTS idx_spawters_dob;
ALTER TABLE spawters DROP CONSTRAINT IF EXISTS spawters_dob_min_age;
ALTER TABLE spawters DROP COLUMN IF EXISTS date_of_birth;

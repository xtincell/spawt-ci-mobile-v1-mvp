-- The old schema cannot represent a reviewed map point without GPS accuracy.
-- Rollback removes only those validations, never the places, contributions,
-- audit history or visit evidence. They cease to be Guet-eligible and must be
-- reviewed again after reapplying 0092. No synthetic accuracy is substituted.
DELETE FROM public.place_location_checks WHERE accuracy_meters IS NULL;

ALTER TABLE public.place_location_checks
  DROP CONSTRAINT place_location_checks_cartographic_source;
ALTER TABLE public.place_location_checks
  ALTER COLUMN accuracy_meters SET NOT NULL;
COMMENT ON COLUMN public.place_location_checks.accuracy_meters IS NULL;

NOTIFY pgrst, 'reload schema';

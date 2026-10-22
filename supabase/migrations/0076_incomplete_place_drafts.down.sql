-- Refuse rollback while incomplete drafts exist; never fabricate GPS/prices
-- or delete documentary work to satisfy the old schema.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.places WHERE lat IS NULL OR lng IS NULL OR price_tier IS NULL) THEN
    RAISE EXCEPTION 'complete_or_export_incomplete_drafts_before_rollback';
  END IF;
END $$;
ALTER TABLE public.places
  ALTER COLUMN lat SET NOT NULL,
  ALTER COLUMN lng SET NOT NULL,
  ALTER COLUMN price_tier SET NOT NULL,
  DROP CONSTRAINT places_published_required_fields;

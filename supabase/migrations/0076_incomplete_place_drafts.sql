-- Documentary drafts may have unknown coordinates or price. Published places
-- retain the non-null contract consumed by released mobile clients.
ALTER TABLE public.places
  ALTER COLUMN lat DROP NOT NULL,
  ALTER COLUMN lng DROP NOT NULL,
  ALTER COLUMN price_tier DROP NOT NULL,
  ADD CONSTRAINT places_published_required_fields CHECK (
    NOT is_published OR (
      lat IS NOT NULL AND lng IS NOT NULL AND price_tier IS NOT NULL
      AND btrim(name) <> '' AND btrim(descriptive_address) <> ''
      AND btrim(neighborhood) <> '' AND btrim(city) <> ''
      AND cardinality(cuisine) > 0
    )
  );

-- Refuse rollback rather than unpublish records or invent missing information.
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM places WHERE is_published AND (lat IS NULL OR lng IS NULL OR price_tier IS NULL OR btrim(name)='' OR btrim(descriptive_address)='' OR btrim(neighborhood)='' OR btrim(city)='' OR cardinality(cuisine)=0)) THEN
    RAISE EXCEPTION 'Published documentary records require nullable-aware clients; reconcile publication before rollback';
  END IF;
END $$;
ALTER TABLE public.places DROP CONSTRAINT places_coordinate_pair;
ALTER TABLE public.places DROP CONSTRAINT places_published_required_fields;
ALTER TABLE public.places ADD CONSTRAINT places_published_required_fields CHECK (
  NOT is_published OR (lat IS NOT NULL AND lng IS NOT NULL AND price_tier IS NOT NULL AND btrim(name)<>'' AND btrim(descriptive_address)<>'' AND btrim(neighborhood)<>'' AND btrim(city)<>'' AND cardinality(cuisine)>0)
);

-- Publication means discoverable, independently of visits, ratings and price.
-- Unknown positions stay null: the mobile list renders them without a map pin.
ALTER TABLE public.places DROP CONSTRAINT places_published_required_fields;
ALTER TABLE public.places ADD CONSTRAINT places_published_required_fields CHECK (
  NOT is_published OR (btrim(name)<>'' AND btrim(city)<>'')
);
ALTER TABLE public.places ADD CONSTRAINT places_coordinate_pair CHECK ((lat IS NULL)=(lng IS NULL));

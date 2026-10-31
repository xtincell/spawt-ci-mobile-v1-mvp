-- A reviewed map point can locate a place without a GPS measurement on site.
-- Keep its HTTP(S) source instead of inventing a measurement accuracy. The
-- existing staff RPC, coordinate snapshot, public view and presence checks stay
-- unchanged. GPS contributions still require their measured accuracy.
ALTER TABLE public.place_location_checks
  ALTER COLUMN accuracy_meters DROP NOT NULL;

ALTER TABLE public.place_location_checks
  ADD CONSTRAINT place_location_checks_cartographic_source
  CHECK (
    accuracy_meters IS NOT NULL
    OR btrim(source) ~* '^https?://[^[:space:]/?#]+([/?#][^[:space:]]*)?$'
  );

COMMENT ON COLUMN public.place_location_checks.accuracy_meters IS
  'Précision connue en mètres (0–100), ou NULL pour un point cartographique contrôlé avec URL HTTP(S) dans source. Ne mesure pas la présence du spawter.';

NOTIFY pgrst, 'reload schema';

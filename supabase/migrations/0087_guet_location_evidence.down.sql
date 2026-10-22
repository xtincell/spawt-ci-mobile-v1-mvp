DELETE FROM public.feature_flags WHERE flag_code='guet-proximity-v2';
DROP TRIGGER IF EXISTS contribution_location_evidence ON public.place_contributions;
DROP FUNCTION IF EXISTS public.capture_approved_location();
DROP VIEW IF EXISTS public.public_guet_places;
DROP FUNCTION IF EXISTS public.validate_place_location(uuid,text,real);
DROP TABLE IF EXISTS public.place_location_checks;

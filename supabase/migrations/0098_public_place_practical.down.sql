BEGIN;
DROP VIEW public.public_place_review_stats, public.public_place_practical;
DROP FUNCTION public.save_place_practical(uuid,integer,jsonb,text), public.check_practical_document(jsonb,boolean);
DROP TABLE public.place_practical_profiles;
NOTIFY pgrst, 'reload schema';
COMMIT;

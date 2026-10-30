DROP FUNCTION IF EXISTS public.last_spawt_at(public.places);
DROP INDEX IF EXISTS public.spawt_checkin_verified_recency_idx;
NOTIFY pgrst, 'reload schema';

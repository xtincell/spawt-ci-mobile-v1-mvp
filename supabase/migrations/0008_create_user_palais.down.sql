-- Down 0008 — Drop user_palais (et trigger via CASCADE).
DROP TRIGGER IF EXISTS update_timestamp_user_palais ON public.user_palais;
DROP TABLE IF EXISTS public.user_palais CASCADE;

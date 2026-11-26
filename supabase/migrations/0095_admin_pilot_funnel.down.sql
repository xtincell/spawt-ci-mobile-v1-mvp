BEGIN;
DROP FUNCTION IF EXISTS public.admin_pilot_funnel(timestamptz,timestamptz);
NOTIFY pgrst,'reload schema';
COMMIT;

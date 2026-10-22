DROP FUNCTION public.verify_visit_presence(uuid,uuid,double precision,double precision,real,timestamptz);
DROP TRIGGER a_visit_verification ON public.spawt_checkin;
DROP FUNCTION public.guard_visit_verification();
DROP TABLE public.visit_presence_evidence;

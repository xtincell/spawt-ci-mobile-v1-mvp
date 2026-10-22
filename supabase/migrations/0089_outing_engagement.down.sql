DROP TRIGGER capture_app_open_session ON public.app_installations;
DROP FUNCTION public.capture_app_open_session();
DROP TABLE public.app_open_sessions;
CREATE OR REPLACE FUNCTION public.admin_outing_metrics() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb; BEGIN
 IF NOT public.is_active_staff() THEN RAISE EXCEPTION 'staff_required' USING ERRCODE='42501'; END IF;
 WITH events AS (SELECT e.* FROM public.outing_intent_events e JOIN public.spawters s ON s.id=e.spawter_id WHERE e.created_at>=now()-interval '7 days' AND NOT s.is_internal AND NOT s.is_banned AND NOT s.is_seed)
 SELECT jsonb_build_object('active_intents_7d',count(DISTINCT spawter_id),'savers_7d',count(DISTINCT spawter_id) FILTER(WHERE kind='save'),'choosers_7d',count(DISTINCT spawter_id) FILTER(WHERE kind='choose'),
 'places',coalesce((SELECT jsonb_agg(to_jsonb(v)) FROM (SELECT e.place_id,p.name,count(DISTINCT e.spawter_id) AS active_intents FROM events e JOIN public.places p ON p.id=e.place_id GROUP BY e.place_id,p.name ORDER BY active_intents DESC) v),'[]')) INTO result FROM events;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.admin_outing_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_outing_metrics() TO authenticated;

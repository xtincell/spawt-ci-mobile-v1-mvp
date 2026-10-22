CREATE TABLE public.app_open_sessions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 spawter_id uuid NOT NULL REFERENCES public.spawters(id) ON DELETE CASCADE,
 started_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX app_open_sessions_owner_time ON public.app_open_sessions(spawter_id,started_at);
ALTER TABLE public.app_open_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_open_sessions FROM anon,authenticated;
CREATE FUNCTION public.capture_app_open_session() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.active_until>NEW.last_seen_at THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.spawter_id::text,89));
  IF NOT EXISTS(SELECT 1 FROM public.app_open_sessions WHERE spawter_id=NEW.spawter_id AND started_at>now()-interval '30 minutes')
    AND (TG_OP='INSERT' OR OLD.last_seen_at<now()-interval '30 minutes') THEN
   INSERT INTO public.app_open_sessions(spawter_id) VALUES(NEW.spawter_id);
  END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER capture_app_open_session AFTER INSERT OR UPDATE ON public.app_installations FOR EACH ROW EXECUTE FUNCTION public.capture_app_open_session();
CREATE OR REPLACE FUNCTION public.admin_outing_metrics() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb; BEGIN
 IF NOT public.is_active_staff() THEN RAISE EXCEPTION 'staff_required' USING ERRCODE='42501'; END IF;
 WITH people AS (SELECT id FROM public.spawters WHERE NOT is_internal AND NOT is_banned AND NOT is_seed),
 events AS (SELECT e.* FROM public.outing_intent_events e JOIN people s ON s.id=e.spawter_id WHERE e.created_at>=now()-interval '7 days'),
 saves AS (SELECT spawter_id,place_id,min(created_at) saved_at FROM events WHERE kind='save' GROUP BY spawter_id,place_id),
 cohort AS (SELECT a.spawter_id,min(a.started_at) first_open FROM public.app_open_sessions a JOIN people s ON s.id=a.spawter_id
  WHERE a.started_at>=now()-interval '10 days' AND a.started_at<=now()-interval '3 days' GROUP BY a.spawter_id)
 SELECT jsonb_build_object('active_intents_7d',count(DISTINCT spawter_id),
  'savers_7d',count(DISTINCT spawter_id) FILTER(WHERE kind='save'),'choosers_7d',count(DISTINCT spawter_id) FILTER(WHERE kind='choose'),
  'active_24h',(SELECT count(DISTINCT a.spawter_id) FROM public.app_installations a JOIN people s ON s.id=a.spawter_id WHERE a.last_seen_at>=now()-interval '24 hours'),
  'active_72h',(SELECT count(DISTINCT a.spawter_id) FROM public.app_installations a JOIN people s ON s.id=a.spawter_id WHERE a.last_seen_at>=now()-interval '72 hours'),
  'return_cohort',(SELECT count(*) FROM cohort),
  'returned_72h',(SELECT count(*) FROM cohort c WHERE EXISTS(SELECT 1 FROM public.app_open_sessions a WHERE a.spawter_id=c.spawter_id AND a.started_at>=c.first_open+interval '24 hours' AND a.started_at<=c.first_open+interval '72 hours')),
  'saved_then_chose_7d',(SELECT count(DISTINCT s.spawter_id) FROM saves s WHERE EXISTS(SELECT 1 FROM events e WHERE e.spawter_id=s.spawter_id AND e.place_id=s.place_id AND e.kind='choose' AND e.created_at>=s.saved_at)),
  'saved_then_visited_7d',(SELECT count(DISTINCT s.spawter_id) FROM saves s WHERE EXISTS(SELECT 1 FROM public.spawt_checkin v WHERE v.spawter_id=s.spawter_id AND v.place_id=s.place_id AND v.checked_in_at>=s.saved_at AND v.checked_in_at<=now() AND NOT v.is_seed AND NOT v.is_cancelled AND v.deleted_at IS NULL AND v.check_in_type<>'passive')),
  'places',coalesce((SELECT jsonb_agg(to_jsonb(v)) FROM (SELECT e.place_id,p.name,count(DISTINCT e.spawter_id) AS active_intents FROM events e JOIN public.places p ON p.id=e.place_id GROUP BY e.place_id,p.name ORDER BY active_intents DESC) v),'[]')) INTO result FROM events;
 RETURN result;
END $$;

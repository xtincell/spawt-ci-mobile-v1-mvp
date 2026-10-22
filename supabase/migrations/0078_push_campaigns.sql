-- Reserve before sending: retries cannot broadcast twice, concurrent requests
-- share the daily cap, and a failed audit never turns into a silent send.
CREATE TABLE public.push_campaigns (
  id uuid PRIMARY KEY,
  staff_id uuid NOT NULL REFERENCES public.spawt_staff(id),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'sending' CHECK(status IN ('sending','completed','failed')),
  targets integer NOT NULL DEFAULT 0,
  tokens integer NOT NULL DEFAULT 0,
  sent integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  purged integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX push_campaigns_created_idx ON public.push_campaigns(created_at DESC);
ALTER TABLE public.push_campaigns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_campaigns FROM anon,authenticated;
GRANT SELECT ON public.push_campaigns TO authenticated;
GRANT ALL ON public.push_campaigns TO service_role;
CREATE POLICY push_campaigns_staff ON public.push_campaigns FOR SELECT TO authenticated USING(public.is_active_staff());
CREATE FUNCTION public.reserve_push_campaign(p_id uuid,p_staff_id uuid,p_payload jsonb,p_targets integer,p_tokens integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE existing public.push_campaigns;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.spawt_staff WHERE id=p_staff_id AND role='admin' AND is_active) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(778033);
  SELECT * INTO existing FROM public.push_campaigns WHERE id=p_id;
  IF FOUND THEN
    IF existing.staff_id<>p_staff_id OR existing.payload<>p_payload THEN RAISE EXCEPTION 'request_id_conflict'; END IF;
    RETURN jsonb_build_object('reserved',false,'campaign',to_jsonb(existing));
  END IF;
  IF (SELECT count(*) FROM public.push_campaigns WHERE created_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')>=3 THEN RAISE EXCEPTION 'campaign_limit_reached'; END IF;
  INSERT INTO public.push_campaigns(id,staff_id,payload,targets,tokens) VALUES(p_id,p_staff_id,p_payload,p_targets,p_tokens);
  RETURN jsonb_build_object('reserved',true);
END $$;
REVOKE ALL ON FUNCTION public.reserve_push_campaign(uuid,uuid,jsonb,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_push_campaign(uuid,uuid,jsonb,integer,integer) TO service_role;

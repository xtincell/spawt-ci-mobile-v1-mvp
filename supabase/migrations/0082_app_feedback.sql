-- Private app feedback: the author reads receipts and team replies; staff triage.
CREATE TABLE public.app_feedback (
  id uuid PRIMARY KEY,
  spawter_id uuid NOT NULL REFERENCES public.spawters(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN ('bug','idea','content')),
  message text NOT NULL CHECK(char_length(btrim(message)) BETWEEN 10 AND 4000),
  context text NOT NULL CHECK(context IN ('app','data_load')),
  diagnostics jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(diagnostics)='object' AND octet_length(diagnostics::text)<=4000),
  status text NOT NULL DEFAULT 'received' CHECK(status IN ('received','reviewing','resolved')),
  staff_reply text NOT NULL DEFAULT '' CHECK(char_length(staff_reply)<=4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX app_feedback_owner ON public.app_feedback(spawter_id,created_at DESC);
CREATE INDEX app_feedback_inbox ON public.app_feedback(status,created_at DESC);
CREATE TRIGGER feedback_updated BEFORE UPDATE ON public.app_feedback FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.app_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_feedback FROM anon,authenticated;
GRANT SELECT ON public.app_feedback TO authenticated;
GRANT UPDATE(status,staff_reply) ON public.app_feedback TO authenticated;
CREATE POLICY feedback_read ON public.app_feedback FOR SELECT TO authenticated
  USING(spawter_id=auth.uid() OR public.is_active_staff());
CREATE POLICY feedback_triage ON public.app_feedback FOR UPDATE TO authenticated
  USING(public.is_active_staff()) WITH CHECK(public.is_active_staff());

-- Client-generated id makes a retry after a lost receipt idempotent.
CREATE FUNCTION public.submit_app_feedback(p_id uuid,p_kind text,p_message text,p_context text,p_diagnostics jsonb DEFAULT '{}')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE owner_id uuid := auth.uid(); existing public.app_feedback;
BEGIN
  IF owner_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.spawters WHERE id=owner_id AND NOT is_banned) THEN
    RAISE EXCEPTION 'account_required' USING ERRCODE='42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::text,82));
  SELECT * INTO existing FROM public.app_feedback WHERE id=p_id;
  IF FOUND THEN
    IF existing.spawter_id=owner_id AND existing.kind=p_kind AND existing.message=btrim(p_message) AND existing.context=p_context THEN RETURN existing.id; END IF;
    RAISE EXCEPTION 'feedback_conflict' USING ERRCODE='22023';
  END IF;
  IF (SELECT count(*) FROM public.app_feedback WHERE spawter_id=owner_id AND created_at>now()-interval '1 hour')>=10 THEN
    RAISE EXCEPTION 'feedback_rate_limit' USING ERRCODE='P0001';
  END IF;
  INSERT INTO public.app_feedback(id,spawter_id,kind,message,context,diagnostics)
  VALUES(p_id,owner_id,p_kind,btrim(p_message),p_context,p_diagnostics);
  RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION public.submit_app_feedback(uuid,text,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_app_feedback(uuid,text,text,text,jsonb) TO authenticated;

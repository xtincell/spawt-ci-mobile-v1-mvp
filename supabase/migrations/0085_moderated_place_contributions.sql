-- Community enrichment is separate from a visit/rating. Only moderation can
-- change a published place and award Paws; both changes commit together.
CREATE TABLE public.place_contribution_rules (
  kind text PRIMARY KEY CHECK(kind IN ('menu','location')),
  reward_paws integer NOT NULL CHECK(reward_paws BETWEEN 0 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Same initial recognition as an existing published review; editable by admins.
INSERT INTO public.place_contribution_rules(kind,reward_paws) VALUES('menu',5),('location',5);
ALTER TABLE public.place_contribution_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.place_contribution_rules FROM anon,authenticated;
GRANT SELECT ON public.place_contribution_rules TO authenticated;
CREATE POLICY contribution_rules_read ON public.place_contribution_rules FOR SELECT TO authenticated USING(true);
CREATE TABLE public.place_contribution_rule_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),kind text NOT NULL,
  actor_id uuid NOT NULL REFERENCES public.spawt_staff(id),
  before_paws integer NOT NULL,after_paws integer NOT NULL,reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.place_contribution_rule_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.place_contribution_rule_history FROM anon,authenticated;
GRANT SELECT ON public.place_contribution_rule_history TO authenticated;
CREATE POLICY contribution_rules_audit_read ON public.place_contribution_rule_history FOR SELECT TO authenticated USING(public.is_active_staff());

CREATE TABLE public.place_contributions (
  id uuid PRIMARY KEY,
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  spawter_id uuid NOT NULL REFERENCES public.spawters(id) ON DELETE CASCADE,
  kind text NOT NULL REFERENCES public.place_contribution_rules(kind),
  proposal jsonb NOT NULL CHECK(jsonb_typeof(proposal)='object' AND octet_length(proposal::text)<=12000),
  comment text NOT NULL DEFAULT '' CHECK(char_length(comment)<=1000),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES public.spawt_staff(id),reviewed_at timestamptz,
  review_note text NOT NULL DEFAULT '' CHECK(char_length(review_note)<=1000),
  offered_reward_paws integer NOT NULL CHECK(offered_reward_paws BETWEEN 0 AND 100),
  reward_paws integer NOT NULL DEFAULT 0 CHECK(reward_paws BETWEEN 0 AND 100),
  before_values jsonb,after_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX place_contributions_queue ON public.place_contributions(status,created_at DESC);
CREATE INDEX place_contributions_owner ON public.place_contributions(spawter_id,created_at DESC);
ALTER TABLE public.place_contributions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.place_contributions FROM anon,authenticated;
GRANT SELECT ON public.place_contributions TO authenticated;
CREATE POLICY place_contributions_read ON public.place_contributions FOR SELECT TO authenticated
  USING(spawter_id=auth.uid() OR public.is_active_staff());
CREATE TRIGGER contribution_updated BEFORE UPDATE ON public.place_contributions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.paws_ledger DROP CONSTRAINT paws_ledger_reason_check;
ALTER TABLE public.paws_ledger ADD CONSTRAINT paws_ledger_reason_check CHECK(reason IN
 ('spawt_verifie','avis_publie','badge_obtenu','defi_collectif','ajustement_admin','contribution_validee'));
CREATE UNIQUE INDEX paws_contribution_once ON public.paws_ledger(ref_id) WHERE reason='contribution_validee';

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('place-contributions','place-contributions',false,5242880,ARRAY['image/jpeg','image/png','image/webp']);
-- No UPDATE or DELETE policy: a submitted proof cannot be replaced after review.
CREATE POLICY contribution_photo_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(
 bucket_id='place-contributions' AND (storage.foldername(name))[1]=auth.uid()::text
 AND name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/[0-2]\.jpg$'
 AND EXISTS(SELECT 1 FROM public.spawters WHERE id=auth.uid() AND NOT is_banned));
CREATE POLICY contribution_photo_private_read ON storage.objects FOR SELECT TO authenticated USING(
 bucket_id='place-contributions' AND ((storage.foldername(name))[1]=auth.uid()::text OR public.is_active_staff()));
CREATE FUNCTION public.is_public_contribution_photo(p_path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.place_contributions c JOIN public.places p ON p.id=c.place_id
 WHERE c.kind='menu' AND c.status='approved' AND p.is_published
 AND (c.proposal->'photo_paths') ? p_path
 AND ('storage://place-contributions/'||p_path)=ANY(p.menu_urls))
$$;
REVOKE ALL ON FUNCTION public.is_public_contribution_photo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_public_contribution_photo(text) TO anon,authenticated;
CREATE POLICY contribution_photo_public_read ON storage.objects FOR SELECT TO anon,authenticated
 USING(bucket_id='place-contributions' AND public.is_public_contribution_photo(name));

CREATE FUNCTION public.submit_place_contribution(p_id uuid,p_place_id uuid,p_kind text,p_proposal jsonb,p_comment text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE owner_id uuid:=auth.uid();existing public.place_contributions;paths text[];v_path text;observed timestamptz;
BEGIN
 IF owner_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.spawters WHERE id=owner_id AND NOT is_banned) THEN
  RAISE EXCEPTION 'account_required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::text,85));
 SELECT * INTO existing FROM public.place_contributions WHERE id=p_id;
 IF FOUND THEN
  IF existing.spawter_id=owner_id AND existing.place_id=p_place_id AND existing.kind=p_kind
   AND existing.proposal=p_proposal AND existing.comment=btrim(p_comment) THEN RETURN existing.id; END IF;
  RAISE EXCEPTION 'contribution_conflict' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.places WHERE id=p_place_id AND is_published) THEN
  RAISE EXCEPTION 'published_place_required' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(p_proposal) IS DISTINCT FROM 'object' OR p_comment IS NULL OR char_length(p_comment)>1000 THEN
  RAISE EXCEPTION 'invalid_contribution' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM public.place_contributions WHERE spawter_id=owner_id AND status='pending')>=5
  OR (SELECT count(*) FROM public.place_contributions WHERE spawter_id=owner_id AND created_at>now()-interval '1 day')>=20 THEN
  RAISE EXCEPTION 'contribution_rate_limit' USING ERRCODE='P0001'; END IF;
 IF p_kind='menu' THEN
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_proposal) k WHERE k NOT IN ('photo_paths','price_tier','avg_ticket_xof'))
   OR jsonb_typeof(p_proposal->'photo_paths') IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'menu_proof_required' USING ERRCODE='22023'; END IF;
  SELECT array_agg(value) INTO paths FROM jsonb_array_elements_text(p_proposal->'photo_paths');
  IF coalesce(cardinality(paths),0) NOT BETWEEN 1 AND 3
   OR cardinality(paths)<>(SELECT count(DISTINCT v) FROM unnest(paths) v) THEN
   RAISE EXCEPTION 'menu_proof_required' USING ERRCODE='22023'; END IF;
  FOREACH v_path IN ARRAY paths LOOP
   IF v_path !~ ('^'||owner_id::text||'/'||p_id::text||'/[0-2]\.jpg$')
    OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='place-contributions' AND name=v_path) THEN
    RAISE EXCEPTION 'owned_menu_proof_required' USING ERRCODE='42501'; END IF;
  END LOOP;
  IF (p_proposal->>'price_tier') IS NOT NULL AND ((p_proposal->>'price_tier')::integer NOT BETWEEN 1 AND 3
    OR jsonb_typeof(p_proposal->'price_tier')<>'number') THEN
   RAISE EXCEPTION 'invalid_price' USING ERRCODE='22023'; END IF;
  IF (p_proposal->>'avg_ticket_xof') IS NOT NULL AND ((p_proposal->>'avg_ticket_xof')::integer NOT BETWEEN 1 AND 1000000
    OR jsonb_typeof(p_proposal->'avg_ticket_xof')<>'number') THEN
   RAISE EXCEPTION 'invalid_price' USING ERRCODE='22023'; END IF;
 ELSIF p_kind='location' THEN
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_proposal) k WHERE k NOT IN ('lat','lng','accuracy_meters','observed_at'))
   OR jsonb_typeof(p_proposal->'lat') IS DISTINCT FROM 'number'
   OR jsonb_typeof(p_proposal->'lng') IS DISTINCT FROM 'number'
   OR jsonb_typeof(p_proposal->'accuracy_meters') IS DISTINCT FROM 'number'
   OR (p_proposal->>'lat')::double precision NOT BETWEEN -90 AND 90
   OR (p_proposal->>'lng')::double precision NOT BETWEEN -180 AND 180
   OR (p_proposal->>'accuracy_meters')::double precision NOT BETWEEN 0 AND 100 THEN
   RAISE EXCEPTION 'precise_position_required' USING ERRCODE='22023'; END IF;
  observed:=(p_proposal->>'observed_at')::timestamptz;
  IF observed IS NULL OR observed<now()-interval '10 minutes' OR observed>now()+interval '1 minute' THEN
   RAISE EXCEPTION 'fresh_position_required' USING ERRCODE='22023'; END IF;
 ELSE RAISE EXCEPTION 'invalid_contribution_kind' USING ERRCODE='22023'; END IF;
 INSERT INTO public.place_contributions(id,place_id,spawter_id,kind,proposal,comment,offered_reward_paws)
 SELECT p_id,p_place_id,owner_id,p_kind,p_proposal,btrim(p_comment),reward_paws FROM public.place_contribution_rules WHERE kind=p_kind;
 RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION public.submit_place_contribution(uuid,uuid,text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_place_contribution(uuid,uuid,text,jsonb,text) TO authenticated;

CREATE FUNCTION public.moderate_place_contribution(p_id uuid,p_decision text,p_note text,
 p_expected_place_updated_at timestamptz DEFAULT NULL,p_values jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.place_contributions;p public.places;new_menus text[];before_json jsonb;after_json jsonb;reward integer;
BEGIN
 IF NOT public.is_active_staff() THEN RAISE EXCEPTION 'staff_required' USING ERRCODE='42501'; END IF;
 IF p_decision NOT IN ('approved','rejected') OR p_decision IS NULL OR p_note IS NULL OR char_length(p_note)>1000
  OR (p_decision='rejected' AND char_length(btrim(p_note))<5) OR jsonb_typeof(p_values) IS DISTINCT FROM 'object' THEN
  RAISE EXCEPTION 'invalid_decision' USING ERRCODE='22023'; END IF;
 SELECT * INTO c FROM public.place_contributions WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'contribution_missing' USING ERRCODE='22023'; END IF;
 IF c.status<>'pending' THEN
  IF c.status<>p_decision THEN RAISE EXCEPTION 'contribution_already_reviewed' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('id',c.id,'status',c.status,'reward_paws',c.reward_paws);
 END IF;
 IF p_decision='rejected' THEN
  UPDATE public.place_contributions SET status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),review_note=btrim(p_note) WHERE id=c.id;
  RETURN jsonb_build_object('id',c.id,'status','rejected','reward_paws',0);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.spawters WHERE id=c.spawter_id AND NOT is_banned) THEN
  RAISE EXCEPTION 'active_contributor_required' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM public.places WHERE id=c.place_id FOR UPDATE;
 IF p.updated_at IS DISTINCT FROM p_expected_place_updated_at THEN
  RAISE EXCEPTION 'place_changed_reload_before_review' USING ERRCODE='40001'; END IF;
 before_json:=jsonb_build_object('lat',p.lat,'lng',p.lng,'price_tier',p.price_tier,'avg_ticket_xof',p.avg_ticket_xof,'menu_urls',p.menu_urls);
 IF c.kind='menu' THEN
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_values) k WHERE k NOT IN ('price_tier','avg_ticket_xof','replace_menu')) THEN
   RAISE EXCEPTION 'invalid_approved_fields' USING ERRCODE='22023'; END IF;
  IF (p_values->>'price_tier') IS NOT NULL AND (p_values->>'price_tier')::integer NOT BETWEEN 1 AND 3
   OR (p_values->>'avg_ticket_xof') IS NOT NULL AND (p_values->>'avg_ticket_xof')::integer NOT BETWEEN 1 AND 1000000 THEN
   RAISE EXCEPTION 'invalid_approved_price' USING ERRCODE='22023'; END IF;
  SELECT array_agg('storage://place-contributions/'||value) INTO new_menus FROM jsonb_array_elements_text(c.proposal->'photo_paths');
  IF NOT coalesce((p_values->>'replace_menu')::boolean,false) THEN
   SELECT array_agg(u ORDER BY first_position) INTO new_menus FROM
    (SELECT u,min(n) first_position FROM unnest(new_menus||coalesce(p.menu_urls,'{}')) WITH ORDINALITY v(u,n) GROUP BY u ORDER BY min(n) LIMIT 12) unique_menus;
  END IF;
  UPDATE public.places SET menu_urls=new_menus,
   price_tier=coalesce((p_values->>'price_tier')::integer,p.price_tier),
   avg_ticket_xof=coalesce((p_values->>'avg_ticket_xof')::integer,p.avg_ticket_xof) WHERE id=p.id;
 ELSE
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_values) k WHERE k NOT IN ('lat','lng'))
   OR (p_values->>'lat') IS NULL OR (p_values->>'lng') IS NULL
   OR (p_values->>'lat')::double precision NOT BETWEEN -90 AND 90 OR (p_values->>'lng')::double precision NOT BETWEEN -180 AND 180 THEN
   RAISE EXCEPTION 'invalid_approved_position' USING ERRCODE='22023'; END IF;
  UPDATE public.places SET lat=(p_values->>'lat')::double precision,lng=(p_values->>'lng')::double precision WHERE id=p.id;
 END IF;
 SELECT jsonb_build_object('lat',lat,'lng',lng,'price_tier',price_tier,'avg_ticket_xof',avg_ticket_xof,'menu_urls',menu_urls) INTO after_json FROM public.places WHERE id=p.id;
 reward:=c.offered_reward_paws;
 UPDATE public.place_contributions SET status='approved',reviewed_by=auth.uid(),reviewed_at=now(),review_note=btrim(p_note),
  reward_paws=reward,before_values=before_json,after_values=after_json WHERE id=c.id;
 IF reward>0 THEN INSERT INTO public.paws_ledger(spawter_id,delta,reason,ref_id)
  VALUES(c.spawter_id,reward,'contribution_validee',c.id); END IF;
 RETURN jsonb_build_object('id',c.id,'status','approved','reward_paws',reward);
END $$;
REVOKE ALL ON FUNCTION public.moderate_place_contribution(uuid,text,text,timestamptz,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.moderate_place_contribution(uuid,text,text,timestamptz,jsonb) TO authenticated;

CREATE FUNCTION public.set_place_contribution_reward(p_kind text,p_paws integer,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE before_paws integer;
BEGIN
 IF NOT public.is_admin_staff() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE='42501'; END IF;
 IF p_paws IS NULL OR p_paws NOT BETWEEN 0 AND 100 OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 5 AND 1000 THEN
  RAISE EXCEPTION 'invalid_reward_rule' USING ERRCODE='22023'; END IF;
 SELECT reward_paws INTO before_paws FROM public.place_contribution_rules WHERE kind=p_kind FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_kind' USING ERRCODE='22023'; END IF;
 UPDATE public.place_contribution_rules SET reward_paws=p_paws,updated_at=now() WHERE kind=p_kind;
 INSERT INTO public.place_contribution_rule_history(kind,actor_id,before_paws,after_paws,reason)
 VALUES(p_kind,auth.uid(),before_paws,p_paws,btrim(p_reason));
END $$;
REVOKE ALL ON FUNCTION public.set_place_contribution_reward(text,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_place_contribution_reward(text,integer,text) TO authenticated;

-- Account deletion removes references to that account's contribution photos.
CREATE FUNCTION public.remove_deleted_contribution_menus() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF OLD.kind='menu' AND OLD.status='approved' THEN
  UPDATE public.places SET menu_urls=ARRAY(SELECT u FROM unnest(menu_urls) u
   WHERE NOT ((OLD.proposal->'photo_paths') ? replace(u,'storage://place-contributions/','')))
   WHERE id=OLD.place_id;
 END IF;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.remove_deleted_contribution_menus() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER remove_contribution_menus AFTER DELETE ON public.place_contributions FOR EACH ROW EXECUTE FUNCTION public.remove_deleted_contribution_menus();

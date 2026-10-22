-- Additive catalogue, personal lists and server-authored qualified intentions.
CREATE TABLE public.menu_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 place_id uuid NOT NULL REFERENCES public.places(id),
 name text NOT NULL CHECK(char_length(btrim(name)) BETWEEN 1 AND 160),
 aliases text[] NOT NULL DEFAULT '{}', accompaniments text[] NOT NULL DEFAULT '{}',
 price_xof integer CHECK(price_xof>=0), description text NOT NULL DEFAULT '' CHECK(char_length(description)<=2000),
 photo_url text CHECK(photo_url IS NULL OR photo_url ~ '^https://'),
 source_url text NOT NULL CHECK(char_length(btrim(source_url)) BETWEEN 1 AND 2000),
 observed_on date NOT NULL CHECK(observed_on<=current_date), is_published boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX menu_items_place_idx ON public.menu_items(place_id);
CREATE TRIGGER menu_items_updated BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER menu_items_history AFTER INSERT OR UPDATE OR DELETE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.audit_announcement_change();
CREATE TRIGGER content_revision AFTER INSERT OR UPDATE OR DELETE ON public.menu_items FOR EACH STATEMENT EXECUTE FUNCTION public.bump_public_content_revision();
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menu_items FROM anon,authenticated;
GRANT SELECT ON public.menu_items TO anon,authenticated;
GRANT INSERT,UPDATE ON public.menu_items TO authenticated;
CREATE POLICY menu_items_public ON public.menu_items FOR SELECT TO anon,authenticated USING(is_published AND EXISTS(SELECT 1 FROM public.places p WHERE p.id=place_id AND p.is_published));
CREATE POLICY menu_items_staff ON public.menu_items FOR ALL TO authenticated USING(public.is_active_staff()) WITH CHECK(public.is_active_staff());
CREATE VIEW public.public_menu_items WITH(security_barrier=true) AS
 SELECT m.*,p.name AS place_name,p.neighborhood,p.cover_photo_url AS place_photo_url
 FROM public.menu_items m JOIN public.places p ON p.id=m.place_id WHERE m.is_published AND p.is_published;
GRANT SELECT ON public.public_menu_items TO anon,authenticated;

CREATE TABLE public.saved_menu_items (
 spawter_id uuid NOT NULL REFERENCES public.spawters(id) ON DELETE CASCADE,
 menu_item_id uuid NOT NULL REFERENCES public.menu_items(id), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(spawter_id,menu_item_id)
);
CREATE TABLE public.personal_lists (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), spawter_id uuid NOT NULL REFERENCES public.spawters(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(char_length(btrim(title)) BETWEEN 1 AND 80),
 occasion text CHECK(occasion IN ('date','anniversaire','vendredi','brunch','autre')),
 share_token uuid UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER personal_lists_updated BEFORE UPDATE ON public.personal_lists FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TABLE public.personal_list_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), list_id uuid NOT NULL REFERENCES public.personal_lists(id) ON DELETE CASCADE,
 place_id uuid REFERENCES public.places(id), menu_item_id uuid REFERENCES public.menu_items(id),
 created_at timestamptz NOT NULL DEFAULT now(), CHECK(num_nonnulls(place_id,menu_item_id)=1),
 UNIQUE(list_id,place_id), UNIQUE(list_id,menu_item_id)
);
CREATE TABLE public.outing_choices (
 spawter_id uuid NOT NULL REFERENCES public.spawters(id) ON DELETE CASCADE,
 place_id uuid NOT NULL REFERENCES public.places(id), chosen_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(spawter_id,place_id)
);
CREATE TABLE public.place_preferences (
 spawter_id uuid NOT NULL REFERENCES public.spawters(id) ON DELETE CASCADE,
 place_id uuid NOT NULL REFERENCES public.places(id), dismissed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(spawter_id,place_id)
);
CREATE TABLE public.outing_mutations (
 spawter_id uuid NOT NULL REFERENCES public.spawters(id) ON DELETE CASCADE,
 id uuid NOT NULL, action text NOT NULL, payload jsonb NOT NULL, result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(spawter_id,id)
);
CREATE TABLE public.outing_intent_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), spawter_id uuid NOT NULL REFERENCES public.spawters(id) ON DELETE CASCADE,
 place_id uuid NOT NULL REFERENCES public.places(id), menu_item_id uuid REFERENCES public.menu_items(id),
 kind text NOT NULL CHECK(kind IN ('save','propose','choose')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outing_intent_events_time_idx ON public.outing_intent_events(created_at,spawter_id,place_id);
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['saved_menu_items','personal_lists','outing_choices','place_preferences','outing_mutations','outing_intent_events'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',tab);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',tab);
  EXECUTE format('CREATE POLICY own_read ON public.%I FOR SELECT TO authenticated USING(spawter_id=auth.uid())',tab);
 END LOOP;
END $$;
ALTER TABLE public.personal_list_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.personal_list_items FROM anon,authenticated;
GRANT SELECT ON public.personal_list_items TO authenticated;
CREATE POLICY own_read ON public.personal_list_items FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.personal_lists l WHERE l.id=list_id AND l.spawter_id=auth.uid()));

CREATE FUNCTION public.capture_saved_intent() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE target uuid; dish uuid; BEGIN
 IF TG_TABLE_NAME='saved_places' THEN target:=NEW.place_id;
 ELSE dish:=NEW.menu_item_id; SELECT place_id INTO target FROM public.menu_items WHERE id=dish; END IF;
 IF EXISTS(SELECT 1 FROM public.places WHERE id=target AND is_published) THEN
  INSERT INTO public.outing_intent_events(spawter_id,place_id,menu_item_id,kind) VALUES(NEW.spawter_id,target,dish,'save');
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER saved_place_intent AFTER INSERT ON public.saved_places FOR EACH ROW EXECUTE FUNCTION public.capture_saved_intent();
CREATE TRIGGER saved_menu_intent AFTER INSERT ON public.saved_menu_items FOR EACH ROW EXECUTE FUNCTION public.capture_saved_intent();
CREATE FUNCTION public.remove_unsaved_list_items() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='saved_places' THEN DELETE FROM public.personal_list_items i USING public.personal_lists l WHERE i.list_id=l.id AND l.spawter_id=OLD.spawter_id AND i.place_id=OLD.place_id;
 ELSE DELETE FROM public.personal_list_items i USING public.personal_lists l WHERE i.list_id=l.id AND l.spawter_id=OLD.spawter_id AND i.menu_item_id=OLD.menu_item_id; END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER unsaved_place_lists AFTER DELETE ON public.saved_places FOR EACH ROW EXECUTE FUNCTION public.remove_unsaved_list_items();
CREATE TRIGGER unsaved_menu_lists AFTER DELETE ON public.saved_menu_items FOR EACH ROW EXECUTE FUNCTION public.remove_unsaved_list_items();

CREATE FUNCTION public.mutate_outing(p_id uuid,p_action text,p_payload jsonb DEFAULT '{}',p_owner uuid DEFAULT auth.uid()) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE owner uuid:=auth.uid(); previous public.outing_mutations; target uuid; dish uuid; lid uuid; result jsonb:='{}'; token uuid;
BEGIN
 IF owner IS NULL OR owner IS DISTINCT FROM p_owner OR NOT EXISTS(SELECT 1 FROM public.spawters WHERE id=owner AND NOT is_banned) THEN RAISE EXCEPTION 'account_required' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR pg_column_size(p_payload)>8192 THEN RAISE EXCEPTION 'invalid_mutation' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(owner::text,86));
 SELECT * INTO previous FROM public.outing_mutations WHERE spawter_id=owner AND id=p_id;
 IF FOUND THEN
  IF previous.action<>p_action OR previous.payload<>p_payload THEN RAISE EXCEPTION 'mutation_conflict' USING ERRCODE='22023'; END IF;
  RETURN previous.result;
 END IF;
 target:=NULLIF(p_payload->>'place_id','')::uuid; dish:=NULLIF(p_payload->>'menu_item_id','')::uuid; lid:=NULLIF(p_payload->>'list_id','')::uuid;
 IF p_action IN ('save','list_add','choose','dismiss') THEN
  IF num_nonnulls(target,dish)<>1 THEN RAISE EXCEPTION 'target_required' USING ERRCODE='22023'; END IF;
  IF dish IS NOT NULL THEN
   SELECT place_id INTO target FROM public.public_menu_items WHERE id=dish;
   IF NOT FOUND THEN RAISE EXCEPTION 'dish_unavailable' USING ERRCODE='22023'; END IF;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.places WHERE id=target AND is_published) THEN RAISE EXCEPTION 'place_unavailable' USING ERRCODE='22023'; END IF;
 END IF;
 IF p_action IN ('list_rename','list_delete','list_add','list_remove','list_share') AND NOT EXISTS(SELECT 1 FROM public.personal_lists WHERE id=lid AND spawter_id=owner) THEN
  RAISE EXCEPTION 'list_unavailable' USING ERRCODE='42501';
 END IF;
 IF p_action IN ('save','list_add') THEN
  IF dish IS NULL THEN INSERT INTO public.saved_places(spawter_id,place_id) VALUES(owner,target) ON CONFLICT DO NOTHING;
  ELSE INSERT INTO public.saved_menu_items(spawter_id,menu_item_id) VALUES(owner,dish) ON CONFLICT DO NOTHING; END IF;
 END IF;
 CASE p_action
 WHEN 'save' THEN NULL;
 WHEN 'unsave' THEN
  IF num_nonnulls(target,dish)<>1 THEN RAISE EXCEPTION 'target_required' USING ERRCODE='22023'; END IF;
  IF dish IS NULL THEN DELETE FROM public.saved_places WHERE spawter_id=owner AND place_id=target;
  ELSE DELETE FROM public.saved_menu_items WHERE spawter_id=owner AND menu_item_id=dish; END IF;
 WHEN 'list_create' THEN
  INSERT INTO public.personal_lists(id,spawter_id,title,occasion) VALUES(lid,owner,btrim(p_payload->>'title'),p_payload->>'occasion');
  result:=jsonb_build_object('list_id',lid);
 WHEN 'list_rename' THEN UPDATE public.personal_lists SET title=btrim(p_payload->>'title'),occasion=p_payload->>'occasion' WHERE id=lid AND spawter_id=owner;
 WHEN 'list_delete' THEN DELETE FROM public.personal_lists WHERE id=lid AND spawter_id=owner;
 WHEN 'list_add' THEN
  INSERT INTO public.personal_list_items(list_id,place_id,menu_item_id) VALUES(lid,CASE WHEN dish IS NULL THEN target END,dish) ON CONFLICT DO NOTHING;
 WHEN 'list_remove' THEN DELETE FROM public.personal_list_items WHERE list_id=lid AND (place_id=target OR menu_item_id=dish);
 WHEN 'list_share' THEN
  IF (p_payload->>'enabled')::boolean IS NULL THEN RAISE EXCEPTION 'enabled_required' USING ERRCODE='22023'; END IF;
  token:=CASE WHEN (p_payload->>'enabled')::boolean THEN gen_random_uuid() END;
  UPDATE public.personal_lists SET share_token=token WHERE id=lid AND spawter_id=owner;
  result:=jsonb_build_object('share_token',token);
 WHEN 'choose' THEN
  INSERT INTO public.outing_choices(spawter_id,place_id) VALUES(owner,target) ON CONFLICT(spawter_id,place_id) DO UPDATE SET chosen_at=now();
  INSERT INTO public.outing_intent_events(spawter_id,place_id,menu_item_id,kind) VALUES(owner,target,dish,'choose');
 WHEN 'dismiss' THEN INSERT INTO public.place_preferences(spawter_id,place_id) VALUES(owner,target) ON CONFLICT DO NOTHING;
 WHEN 'restore' THEN DELETE FROM public.place_preferences WHERE spawter_id=owner AND place_id=target;
 ELSE RAISE EXCEPTION 'unknown_action' USING ERRCODE='22023';
 END CASE;
 INSERT INTO public.outing_mutations(spawter_id,id,action,payload,result) VALUES(owner,p_id,p_action,p_payload,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.mutate_outing(uuid,text,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mutate_outing(uuid,text,jsonb,uuid) TO authenticated;

-- A saved retired dish remains identifiable to its owner, never to an arbitrary reader.
CREATE FUNCTION public.my_outings(p_owner uuid DEFAULT auth.uid()) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
SELECT jsonb_build_object(
 'lists',coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.updated_at DESC) FROM public.personal_lists l WHERE spawter_id=auth.uid()),'[]'),
 'items',coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.created_at DESC) FROM public.personal_list_items i JOIN public.personal_lists l ON l.id=i.list_id WHERE l.spawter_id=auth.uid()),'[]'),
 'dishes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.id,'place_id',m.place_id,'name',m.name,'place_name',p.name,'price_xof',m.price_xof,'observed_on',m.observed_on,'is_published',m.is_published AND p.is_published,'photo_url',m.photo_url,'saved_at',s.created_at)) FROM public.saved_menu_items s JOIN public.menu_items m ON m.id=s.menu_item_id JOIN public.places p ON p.id=m.place_id WHERE s.spawter_id=auth.uid()),'[]'),
 'choices',coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM public.outing_choices c WHERE spawter_id=auth.uid()),'[]'),
 'dismissed',coalesce((SELECT jsonb_agg(place_id) FROM public.place_preferences WHERE spawter_id=auth.uid()),'[]')) WHERE auth.uid()=p_owner
$$;
REVOKE ALL ON FUNCTION public.my_outings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_outings(uuid) TO authenticated;
CREATE FUNCTION public.public_outing_list(p_token uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('title',l.title,'occasion',l.occasion,'items',coalesce((SELECT jsonb_agg(jsonb_build_object(
 'place_id',p.id,'place_name',p.name,'neighborhood',p.neighborhood,'photo_url',CASE WHEN i.menu_item_id IS NULL THEN p.cover_photo_url ELSE m.photo_url END,
 'menu_item_id',m.id,'dish_name',m.name,'price_xof',m.price_xof,'observed_on',m.observed_on) ORDER BY i.created_at)
 FROM public.personal_list_items i LEFT JOIN public.menu_items m ON m.id=i.menu_item_id
 JOIN public.places p ON p.id=coalesce(i.place_id,m.place_id)
 WHERE i.list_id=l.id AND p.is_published AND (i.menu_item_id IS NULL OR m.is_published)),'[]'))
 FROM public.personal_lists l WHERE l.share_token=p_token
$$;
REVOKE ALL ON FUNCTION public.public_outing_list(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_outing_list(uuid) TO anon,authenticated;

-- Read access for reporting is staff-only; no identity lists are exposed to venues.
CREATE FUNCTION public.admin_outing_metrics() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb; BEGIN
 IF NOT public.is_active_staff() THEN RAISE EXCEPTION 'staff_required' USING ERRCODE='42501'; END IF;
 WITH events AS (SELECT e.* FROM public.outing_intent_events e JOIN public.spawters s ON s.id=e.spawter_id WHERE e.created_at>=now()-interval '7 days' AND NOT s.is_internal AND NOT s.is_banned AND NOT s.is_seed)
 SELECT jsonb_build_object('active_intents_7d',count(DISTINCT spawter_id),'savers_7d',count(DISTINCT spawter_id) FILTER(WHERE kind='save'),'choosers_7d',count(DISTINCT spawter_id) FILTER(WHERE kind='choose'),
 'places',coalesce((SELECT jsonb_agg(to_jsonb(v)) FROM (SELECT e.place_id,p.name,count(DISTINCT e.spawter_id) AS active_intents FROM events e JOIN public.places p ON p.id=e.place_id GROUP BY e.place_id,p.name ORDER BY active_intents DESC) v),'[]')) INTO result FROM events;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.admin_outing_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_outing_metrics() TO authenticated;

CREATE FUNCTION public.capture_crew_intent() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE owner uuid; target uuid; kind text; BEGIN
 IF TG_TABLE_NAME='crew_proposals' THEN owner:=NEW.proposed_by; target:=NEW.place_id; kind:='propose';
 ELSE owner:=NEW.spawter_id; kind:='choose'; SELECT place_id INTO target FROM public.crew_proposals WHERE id=NEW.proposal_id AND session_id=NEW.session_id; END IF;
 IF owner IS NOT NULL AND EXISTS(SELECT 1 FROM public.places WHERE id=target AND is_published) THEN
  INSERT INTO public.outing_intent_events(spawter_id,place_id,kind) VALUES(owner,target,kind);
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER crew_proposal_intent AFTER INSERT ON public.crew_proposals FOR EACH ROW EXECUTE FUNCTION public.capture_crew_intent();
CREATE TRIGGER crew_vote_intent AFTER INSERT ON public.crew_votes FOR EACH ROW EXECUTE FUNCTION public.capture_crew_intent();

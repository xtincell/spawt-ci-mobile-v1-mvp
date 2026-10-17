-- Research stays staff-only. Public editorial content is explicitly published.
-- Additive migration: existing places, ADN and mobile contracts are preserved.
ALTER TABLE public.explore_collections ADD COLUMN audience text NOT NULL DEFAULT 'general' CHECK (audience IN ('general','duo'));
CREATE TABLE public.research_records (
  record_id text PRIMARY KEY CHECK (char_length(record_id) BETWEEN 1 AND 128),
  source_id text NOT NULL,
  source_native_id text NOT NULL,
  record_type text NOT NULL,
  source_url text,
  collected_at timestamptz,
  published_at timestamptz,
  place_name text,
  facts jsonb NOT NULL DEFAULT '{}',
  place_id uuid REFERENCES public.places(id),
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','linked','rejected')),
  imported_by uuid REFERENCES public.spawt_staff(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_id, record_type, source_native_id)
);
CREATE INDEX research_records_place_idx ON public.research_records(place_id);
CREATE INDEX research_records_queue_idx ON public.research_records(record_type, review_status, place_name);
CREATE TABLE public.place_editorial_profiles (
  place_id uuid PRIMARY KEY REFERENCES public.places(id) ON DELETE CASCADE,
  document jsonb NOT NULL DEFAULT '{}',
  revision integer NOT NULL DEFAULT 1,
  updated_by uuid REFERENCES public.spawt_staff(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Public snapshot lives alongside the fields already consumed by released APKs.
ALTER TABLE public.places ADD COLUMN editorial_profile jsonb;
CREATE FUNCTION public.guard_editorial_public_snapshot() RETURNS trigger LANGUAGE plpgsql
SET search_path=public,pg_temp AS $$
BEGIN
  IF current_user IN ('authenticated','anon') AND
    (CASE WHEN TG_OP='INSERT' THEN NEW.editorial_profile IS NOT NULL ELSE NEW.editorial_profile IS DISTINCT FROM OLD.editorial_profile END) THEN
    RAISE EXCEPTION 'use_editorial_publication_rpc' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER editorial_snapshot_guard BEFORE INSERT OR UPDATE ON public.places
FOR EACH ROW EXECUTE FUNCTION public.guard_editorial_public_snapshot();
CREATE TABLE public.place_editorial_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.spawt_staff(id),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.place_editorial_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.spawt_staff(id),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 10000),
  visited_on date NOT NULL CHECK (visited_on <= CURRENT_DATE),
  note_cuisine smallint CHECK (note_cuisine BETWEEN 1 AND 5),
  note_cadre smallint CHECK (note_cadre BETWEEN 1 AND 5),
  note_service smallint CHECK (note_service BETWEEN 1 AND 5),
  is_published boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.editorial_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES public.spawt_staff(id),
  entity_table text NOT NULL,
  entity_key text NOT NULL,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.research_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_editorial_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_editorial_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_editorial_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editorial_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.research_records, public.place_editorial_profiles,
  public.place_editorial_notes, public.place_editorial_reviews, public.editorial_history TO authenticated;
CREATE POLICY research_staff_read ON public.research_records FOR SELECT TO authenticated USING(public.is_active_staff());
CREATE POLICY editorial_profile_staff_read ON public.place_editorial_profiles FOR SELECT TO authenticated USING(public.is_active_staff());
CREATE POLICY editorial_notes_staff_read ON public.place_editorial_notes FOR SELECT TO authenticated USING(public.is_active_staff());
CREATE POLICY editorial_reviews_staff_read ON public.place_editorial_reviews FOR SELECT TO authenticated USING(public.is_active_staff());
CREATE POLICY editorial_history_staff_read ON public.editorial_history FOR SELECT TO authenticated USING(public.is_active_staff());
CREATE VIEW public.editorial_team WITH(security_barrier=true) AS
  SELECT id,display_name FROM public.spawt_staff WHERE public.is_active_staff();
GRANT SELECT ON public.editorial_team TO authenticated;
GRANT INSERT ON public.place_editorial_notes TO authenticated;
CREATE POLICY editorial_notes_add ON public.place_editorial_notes FOR INSERT TO authenticated
  WITH CHECK(public.is_active_staff() AND author_id=auth.uid());

CREATE FUNCTION public.audit_editorial_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
BEGIN
  INSERT INTO public.editorial_history(actor_id,entity_table,entity_key,before_value,after_value)
  VALUES(auth.uid(),TG_TABLE_NAME,COALESCE(to_jsonb(NEW)->>'place_id',to_jsonb(NEW)->>'record_id',to_jsonb(NEW)->>'id'),
    CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,to_jsonb(NEW));
  RETURN NEW;
END $$;
CREATE TRIGGER profile_history AFTER INSERT OR UPDATE ON public.place_editorial_profiles FOR EACH ROW EXECUTE FUNCTION public.audit_editorial_change();
CREATE TRIGGER note_history AFTER INSERT OR UPDATE ON public.place_editorial_notes FOR EACH ROW EXECUTE FUNCTION public.audit_editorial_change();
CREATE TRIGGER editorial_review_history AFTER INSERT OR UPDATE ON public.place_editorial_reviews FOR EACH ROW EXECUTE FUNCTION public.audit_editorial_change();

CREATE FUNCTION public.import_research_records(p_records jsonb) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE r jsonb; n integer:=0; safe_facts jsonb;
BEGIN
  IF NOT public.is_active_staff() THEN RAISE EXCEPTION 'staff_required' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_records) IS DISTINCT FROM 'array' OR jsonb_array_length(p_records)>500
    OR octet_length(p_records::text)>2000000 THEN RAISE EXCEPTION 'invalid_research_batch'; END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(p_records) LOOP
    IF NULLIF(r->>'record_id','') IS NULL OR NULLIF(r->>'source_id','') IS NULL
      OR NULLIF(r->>'source_native_id','') IS NULL OR NULLIF(r->>'record_type','') IS NULL THEN
      RAISE EXCEPTION 'missing_source_identity';
    END IF;
    -- Explicit allowlist: no source prose, authors, photos or inferred app rights.
    SELECT COALESCE(jsonb_object_agg(key,value),'{}') INTO safe_facts FROM jsonb_each(r)
      WHERE key IN ('latitude','longitude','address_raw','district_raw','city_raw','category','price_range_raw',
       'source_rating','source_review_count','rating','has_review_prose','food_related','target_dining_venue_candidate',
       'abidjan_district_spatial_match','operating_status','operating_status_verified','place_source_native_id','sampling_parameters','business_phone_raw','business_website','opening_hours_raw','last_public_activity_at','date_semantics','source_permanently_closed','source_temporarily_closed','operating_status_origin','geographic_relevance','place_identity_verified','rights_product_use','reuse_scope','parent_place_native_id','website_url','linked_page_url');
    IF r ? 'analysis' THEN
      safe_facts:=safe_facts||jsonb_build_object('lexical_mentions',
        COALESCE((SELECT jsonb_agg(a->>'aspect') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r#>'{analysis,aspects}')='array' THEN r#>'{analysis,aspects}' ELSE '[]'::jsonb END) a
          WHERE a->>'aspect' IN ('food','service','setting','value','wait','information','occasion','hygiene','access')),'[]'::jsonb));
    END IF;
    INSERT INTO public.research_records(record_id,source_id,source_native_id,record_type,source_url,collected_at,published_at,place_name,facts,imported_by)
    VALUES(r->>'record_id',r->>'source_id',r->>'source_native_id',r->>'record_type',r->>'source_url',
      NULLIF(r->>'collected_at','')::timestamptz,NULLIF(r->>'published_at','')::timestamptz,r->>'place_name',safe_facts,auth.uid())
    ON CONFLICT(source_id,record_type,source_native_id) DO UPDATE SET
      source_url=EXCLUDED.source_url,collected_at=EXCLUDED.collected_at,published_at=EXCLUDED.published_at,
      place_name=EXCLUDED.place_name,facts=EXCLUDED.facts,updated_at=now()
    WHERE EXCLUDED.collected_at >= research_records.collected_at OR research_records.collected_at IS NULL;
    n:=n+1;
  END LOOP;
  INSERT INTO public.editorial_history(actor_id,entity_table,entity_key,after_value)
    VALUES(auth.uid(),'research_import','batch',jsonb_build_object('processed',n));
  RETURN n;
END $$;

CREATE FUNCTION public.link_research_record(p_record_id text,p_place_id uuid,p_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE old_row public.research_records;
BEGIN
  IF NOT public.is_active_staff() THEN RAISE EXCEPTION 'staff_required' USING ERRCODE='42501'; END IF;
  IF p_status NOT IN ('pending','linked','rejected') OR (p_status='linked') IS DISTINCT FROM (p_place_id IS NOT NULL) THEN RAISE EXCEPTION 'invalid_link'; END IF;
  SELECT * INTO STRICT old_row FROM public.research_records WHERE record_id=p_record_id FOR UPDATE;
  UPDATE public.research_records SET place_id=p_place_id,review_status=p_status,updated_at=now() WHERE record_id=p_record_id;
  INSERT INTO public.editorial_history(actor_id,entity_table,entity_key,before_value,after_value)
    VALUES(auth.uid(),'research_link',p_record_id,jsonb_build_object('place_id',old_row.place_id,'status',old_row.review_status),jsonb_build_object('place_id',p_place_id,'status',p_status));
END $$;

CREATE FUNCTION public.save_place_editorial_profile(p_place_id uuid,p_document jsonb,p_expected_revision integer)
RETURNS public.place_editorial_profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result public.place_editorial_profiles; s jsonb;
BEGIN
  IF NOT public.is_active_staff() THEN RAISE EXCEPTION 'staff_required' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_document) IS DISTINCT FROM 'object' OR octet_length(p_document::text)>50000
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_document) k WHERE k NOT IN ('identity','specialties','occasions','budget_context','service_context','access_context','verification_source','verified_on','last_activity_at','operating_status','photo_rights','sections'))
    THEN RAISE EXCEPTION 'invalid_editorial_document'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_each(p_document) WHERE key<>'sections' AND jsonb_typeof(value) NOT IN ('string','null')) THEN RAISE EXCEPTION 'invalid_field_type'; END IF;
  IF COALESCE(p_document->>'operating_status','unknown') NOT IN ('unknown','open','temporarily_closed','permanently_closed') THEN RAISE EXCEPTION 'invalid_operating_status'; END IF;
  IF NULLIF(p_document->>'verified_on','')::date>CURRENT_DATE THEN RAISE EXCEPTION 'future_verification'; END IF;
  IF p_document ? 'sections' THEN
    IF jsonb_typeof(p_document->'sections') IS DISTINCT FROM 'array' OR jsonb_array_length(p_document->'sections')>12 THEN RAISE EXCEPTION 'invalid_sections'; END IF;
    FOR s IN SELECT value FROM jsonb_array_elements(p_document->'sections') LOOP
      IF jsonb_typeof(s) IS DISTINCT FROM 'object' OR jsonb_typeof(s->'title') IS DISTINCT FROM 'string' OR jsonb_typeof(s->'body') IS DISTINCT FROM 'string' OR NULLIF(btrim(s->>'title'),'') IS NULL
        OR NULLIF(btrim(s->>'body'),'') IS NULL OR char_length(s->>'title')>120 OR char_length(s->>'body')>5000
        OR EXISTS(SELECT 1 FROM jsonb_object_keys(s) k WHERE k NOT IN ('title','body')) THEN RAISE EXCEPTION 'invalid_section'; END IF;
    END LOOP;
  END IF;
  IF p_expected_revision=0 THEN
    INSERT INTO public.place_editorial_profiles(place_id,document,updated_by)
      VALUES(p_place_id,p_document,auth.uid()) ON CONFLICT DO NOTHING RETURNING * INTO result;
  ELSE
    UPDATE public.place_editorial_profiles SET document=p_document,revision=revision+1,updated_by=auth.uid(),updated_at=now()
      WHERE place_id=p_place_id AND revision=p_expected_revision RETURNING * INTO result;
  END IF;
  IF result.place_id IS NULL THEN RAISE EXCEPTION 'editorial_revision_conflict' USING ERRCODE='40001'; END IF;
  RETURN result;
END $$;

CREATE FUNCTION public.publish_place_editorial_profile(p_place_id uuid,p_expected_revision integer,p_publish boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public.places; draft public.place_editorial_profiles; doc jsonb;
BEGIN
  IF NOT public.is_admin_staff() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE='42501'; END IF;
  SELECT * INTO STRICT draft FROM public.place_editorial_profiles WHERE place_id=p_place_id FOR UPDATE;
  IF draft.revision<>p_expected_revision THEN RAISE EXCEPTION 'editorial_revision_conflict' USING ERRCODE='40001'; END IF;
  SELECT * INTO STRICT p FROM public.places WHERE id=p_place_id FOR UPDATE;
  doc:=draft.document;
  IF p_publish THEN
    IF NULLIF(btrim(doc->>'identity'),'') IS NULL OR NULLIF(doc->>'verified_on','') IS NULL
      OR NULLIF(btrim(doc->>'verification_source'),'') IS NULL OR doc->>'photo_rights' IS DISTINCT FROM 'confirmed'
      OR NULLIF(p.cover_photo_url,'') IS NULL OR cardinality(p.cuisine)=0 OR p.avg_ticket_xof IS NULL
      OR p.hours='{}'::jsonb OR NULLIF(btrim(p.descriptive_address),'') IS NULL OR NULLIF(btrim(p.neighborhood),'') IS NULL
      OR doc->>'operating_status' IS DISTINCT FROM 'open' THEN RAISE EXCEPTION 'profile_incomplete_for_publication'; END IF;
    -- Only explicit public fields; private sourcing and notes never leak to APKs.
    UPDATE public.places SET editorial_profile=jsonb_build_object('identity',doc->>'identity','specialties',doc->>'specialties',
      'occasions',doc->>'occasions','budget_context',doc->>'budget_context','service_context',doc->>'service_context',
      'access_context',doc->>'access_context','verified_on',doc->>'verified_on','sections',COALESCE(doc->'sections','[]'::jsonb)) WHERE id=p_place_id;
  ELSE UPDATE public.places SET editorial_profile=NULL WHERE id=p_place_id;
  END IF;
  INSERT INTO public.editorial_history(actor_id,entity_table,entity_key,before_value,after_value)
    VALUES(auth.uid(),'editorial_publication',p_place_id::text,p.editorial_profile,CASE WHEN p_publish THEN (SELECT editorial_profile FROM public.places WHERE id=p_place_id) ELSE NULL END);
END $$;

CREATE FUNCTION public.set_place_editorial_adn(p_place_id uuid,p_axes jsonb,p_expected_updated_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE old_row public.place_adn; k text; v real;
BEGIN
  IF NOT public.is_active_staff() THEN RAISE EXCEPTION 'staff_required' USING ERRCODE='42501'; END IF;
  SELECT * INTO STRICT old_row FROM public.place_adn WHERE place_id=p_place_id FOR UPDATE;
  IF p_expected_updated_at IS DISTINCT FROM old_row.updated_at THEN RAISE EXCEPTION 'adn_revision_conflict' USING ERRCODE='40001'; END IF;
  FOREACH k IN ARRAY ARRAY['axe_local_international','axe_informel_etabli','axe_budget_premium','axe_populaire_prive','axe_decontracte_habille'] LOOP
    v:=(p_axes->>k)::real;
    IF v IS NULL OR v NOT BETWEEN -1 AND 1 THEN RAISE EXCEPTION 'invalid_adn_axis'; END IF;
  END LOOP;
  UPDATE public.place_adn SET base_axe_local_international=(p_axes->>'axe_local_international')::real,
    base_axe_informel_etabli=(p_axes->>'axe_informel_etabli')::real,base_axe_budget_premium=(p_axes->>'axe_budget_premium')::real,
    base_axe_populaire_prive=(p_axes->>'axe_populaire_prive')::real,base_axe_decontracte_habille=(p_axes->>'axe_decontracte_habille')::real WHERE place_id=p_place_id;
  PERFORM public.recompute_place_adn_full(p_place_id);
  INSERT INTO public.editorial_history(actor_id,entity_table,entity_key,before_value,after_value)
    VALUES(auth.uid(),'editorial_adn',p_place_id::text,to_jsonb(old_row),p_axes);
END $$;

CREATE FUNCTION public.save_editorial_review(p_id uuid,p_place_id uuid,p_body text,p_visited_on date,
  p_cuisine smallint,p_cadre smallint,p_service smallint,p_expected_revision integer,p_publish boolean)
RETURNS public.place_editorial_reviews LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result public.place_editorial_reviews; previous public.place_editorial_reviews;
BEGIN
  IF NOT public.is_active_staff() THEN RAISE EXCEPTION 'staff_required' USING ERRCODE='42501'; END IF;
  SELECT * INTO previous FROM public.place_editorial_reviews WHERE id=p_id FOR UPDATE;
  IF previous.id IS NOT NULL AND previous.author_id<>auth.uid() AND NOT public.is_admin_staff() THEN RAISE EXCEPTION 'review_author_required' USING ERRCODE='42501'; END IF;
  IF p_publish AND NOT public.is_admin_staff() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE='42501'; END IF;
  IF previous.id IS NULL THEN
    IF p_expected_revision<>0 THEN RAISE EXCEPTION 'review_revision_conflict' USING ERRCODE='40001'; END IF;
    INSERT INTO public.place_editorial_reviews(id,place_id,author_id,body,visited_on,note_cuisine,note_cadre,note_service,is_published)
      VALUES(p_id,p_place_id,auth.uid(),p_body,p_visited_on,p_cuisine,p_cadre,p_service,p_publish) RETURNING * INTO result;
  ELSE
    IF previous.place_id<>p_place_id OR previous.revision<>p_expected_revision THEN RAISE EXCEPTION 'review_revision_conflict' USING ERRCODE='40001'; END IF;
    UPDATE public.place_editorial_reviews SET body=p_body,visited_on=p_visited_on,note_cuisine=p_cuisine,note_cadre=p_cadre,
      note_service=p_service,is_published=p_publish,revision=revision+1,updated_at=now() WHERE id=p_id RETURNING * INTO result;
  END IF;
  RETURN result;
END $$;
CREATE VIEW public.public_editorial_reviews WITH(security_barrier=true) AS
  SELECT r.id,r.place_id,s.display_name,r.body,r.visited_on,r.note_cuisine,r.note_cadre,r.note_service,r.updated_at
  FROM public.place_editorial_reviews r JOIN public.spawt_staff s ON s.id=r.author_id
  JOIN public.places p ON p.id=r.place_id WHERE r.is_published AND p.is_published AND s.is_active;
GRANT SELECT ON public.public_editorial_reviews TO anon,authenticated;

REVOKE ALL ON FUNCTION public.import_research_records(jsonb),public.link_research_record(text,uuid,text),
 public.save_place_editorial_profile(uuid,jsonb,integer),public.publish_place_editorial_profile(uuid,integer,boolean),
 public.set_place_editorial_adn(uuid,jsonb,timestamptz),public.save_editorial_review(uuid,uuid,text,date,smallint,smallint,smallint,integer,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_research_records(jsonb),public.link_research_record(text,uuid,text),
 public.save_place_editorial_profile(uuid,jsonb,integer),public.publish_place_editorial_profile(uuid,integer,boolean),
 public.set_place_editorial_adn(uuid,jsonb,timestamptz),public.save_editorial_review(uuid,uuid,text,date,smallint,smallint,smallint,integer,boolean) TO authenticated;
COMMENT ON TABLE public.research_records IS 'Research staging only; imported source claims are not publishable SPAWT facts or first-party reviews.';
COMMENT ON TABLE public.place_editorial_reviews IS 'First-party staff observations; distinct from community visits, progression and public review counters.';
NOTIFY pgrst,'reload schema';

CREATE FUNCTION public.edit_editorial_note(p_id uuid,p_body text,p_expected_body text)
RETURNS public.place_editorial_notes LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n public.place_editorial_notes;
BEGIN
 IF NOT public.is_active_staff() THEN RAISE EXCEPTION 'staff_required' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT n FROM public.place_editorial_notes WHERE id=p_id FOR UPDATE;
 IF n.author_id<>auth.uid() AND NOT public.is_admin_staff() THEN RAISE EXCEPTION 'note_author_required' USING ERRCODE='42501'; END IF;
 IF n.body IS DISTINCT FROM p_expected_body THEN RAISE EXCEPTION 'note_revision_conflict' USING ERRCODE='40001'; END IF;
 UPDATE public.place_editorial_notes SET body=p_body WHERE id=p_id RETURNING * INTO n;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.edit_editorial_note(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edit_editorial_note(uuid,text,text) TO authenticated;

-- Practical facts and ADN must succeed together, against the version actually edited.
CREATE FUNCTION public.save_place_with_editorial_adn(p_place_id uuid,p_fields jsonb,p_axes jsonb,
 p_expected_place_updated_at timestamptz,p_expected_adn_updated_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE current_place public.places; next_place public.places;
BEGIN
 IF NOT public.is_active_staff() THEN RAISE EXCEPTION 'staff_required' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT current_place FROM public.places WHERE id=p_place_id FOR UPDATE;
 IF current_place.updated_at IS DISTINCT FROM p_expected_place_updated_at THEN RAISE EXCEPTION 'place_revision_conflict' USING ERRCODE='40001'; END IF;
 IF jsonb_typeof(p_fields) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_fields) k WHERE k NOT IN
 ('name','cuisine','lat','lng','descriptive_address','neighborhood','city','price_tier','avg_ticket_xof','hours','phone','whatsapp','cover_photo_url','gallery_urls','menu_urls','signals','is_published')) THEN RAISE EXCEPTION 'invalid_place_fields'; END IF;
 SELECT * INTO next_place FROM jsonb_populate_record(current_place,p_fields);
 UPDATE public.places SET name=next_place.name,cuisine=next_place.cuisine,lat=next_place.lat,lng=next_place.lng,
 descriptive_address=next_place.descriptive_address,neighborhood=next_place.neighborhood,city=next_place.city,
 price_tier=next_place.price_tier,avg_ticket_xof=next_place.avg_ticket_xof,hours=next_place.hours,phone=next_place.phone,
 whatsapp=next_place.whatsapp,cover_photo_url=next_place.cover_photo_url,gallery_urls=next_place.gallery_urls,
 menu_urls=next_place.menu_urls,signals=next_place.signals,is_published=next_place.is_published WHERE id=p_place_id;
 PERFORM public.set_place_editorial_adn(p_place_id,p_axes,p_expected_adn_updated_at);
 INSERT INTO public.editorial_history(actor_id,entity_table,entity_key,before_value,after_value)
 VALUES(auth.uid(),'place_practical',p_place_id::text,to_jsonb(current_place),p_fields);
END $$;
REVOKE ALL ON FUNCTION public.save_place_with_editorial_adn(uuid,jsonb,jsonb,timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_place_with_editorial_adn(uuid,jsonb,jsonb,timestamptz,timestamptz) TO authenticated;

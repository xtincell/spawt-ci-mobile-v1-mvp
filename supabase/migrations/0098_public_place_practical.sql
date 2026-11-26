BEGIN;
-- A staff draft and its independently published snapshot. General place details
-- (address, weekly hours, phone, prices and menu images) stay in public.places.
CREATE TABLE public.place_practical_profiles (
  place_id uuid PRIMARY KEY REFERENCES public.places(id) ON DELETE CASCADE,
  draft jsonb NOT NULL DEFAULT '{}',
  published_document jsonb,
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.place_practical_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.place_practical_profiles FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.place_practical_profiles TO authenticated;
CREATE POLICY practical_staff_read ON public.place_practical_profiles FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE TRIGGER practical_history AFTER INSERT OR UPDATE ON public.place_practical_profiles FOR EACH ROW EXECUTE FUNCTION public.audit_editorial_change();
CREATE TRIGGER practical_content_revision AFTER INSERT OR UPDATE OR DELETE ON public.place_practical_profiles FOR EACH STATEMENT EXECUTE FUNCTION public.bump_public_content_revision();

CREATE FUNCTION public.check_practical_document(doc jsonb, publishing boolean)
RETURNS void LANGUAGE plpgsql STABLE SET search_path=public,pg_temp AS $$
DECLARE key text; item jsonb; part jsonb; covered text[]:='{}'; declared text;
 allowed text[]:=ARRAY['address','hours','phone','website_url','contact_email','google_maps_url','social_links','official_description','services','payment_methods','menu_urls','price_range'];
 href text:='^https://([a-z0-9-]+\.)+[a-z]{2,}([/?#][^[:space:][:cntrl:]]*)?$';
BEGIN
 IF doc IS NULL OR jsonb_typeof(doc)<>'object' OR octet_length(doc::text)>24000 OR EXISTS (
  SELECT FROM jsonb_object_keys(doc) k WHERE k NOT IN ('website_url','contact_email','google_maps_url','social_links','services','payment_methods','official_description','sources'))
 THEN RAISE EXCEPTION 'invalid_document' USING ERRCODE='22023'; END IF;
 FOREACH key IN ARRAY ARRAY['website_url','google_maps_url','contact_email','official_description'] LOOP
  IF doc ? key AND doc->key<>'null'::jsonb AND (jsonb_typeof(doc->key)<>'string' OR NULLIF(btrim(doc->>key),'') IS NULL OR length(doc->>key)>1000) THEN
   RAISE EXCEPTION 'invalid_field: %',key USING ERRCODE='22023'; END IF;
 END LOOP;
 IF (doc->>'website_url') !~* href OR (doc->>'contact_email') !~* '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[a-z]{2,}$'
 OR (doc->>'google_maps_url') !~* '^https://(maps\.app\.goo\.gl/[-a-z0-9]+/?|((www\.)?google\.(com|ci|cm|fr)/maps(/|\?)|maps\.google\.(com|ci|cm|fr)/)[^[:space:]]*)$'
 THEN RAISE EXCEPTION 'invalid_contact_link' USING ERRCODE='22023'; END IF;
 FOREACH key IN ARRAY ARRAY['services','payment_methods','social_links','sources'] LOOP
  IF doc ? key AND jsonb_typeof(doc->key)<>'array' THEN RAISE EXCEPTION 'invalid_list: %',key USING ERRCODE='22023'; END IF;
  IF jsonb_array_length(doc->key)>24 THEN RAISE EXCEPTION 'too_many_entries: %',key USING ERRCODE='22023'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(doc->key) LOOP
   IF key IN ('services','payment_methods') THEN
    IF jsonb_typeof(item)<>'string' OR length(btrim(item#>>'{}')) NOT BETWEEN 1 AND 90 THEN RAISE EXCEPTION 'invalid_list_text' USING ERRCODE='22023'; END IF;
   ELSE
    IF jsonb_typeof(item)<>'object' OR jsonb_typeof(item->'url') IS DISTINCT FROM 'string'
     OR (item->>'url') !~* href OR length(item->>'url')>1000 OR jsonb_typeof(item->'label') IS DISTINCT FROM 'string'
     OR length(btrim(item->>'label')) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'invalid_link' USING ERRCODE='22023'; END IF;
    IF key='social_links' THEN
     IF EXISTS(SELECT FROM jsonb_object_keys(item) k WHERE k NOT IN ('label','url')) THEN RAISE EXCEPTION 'invalid_social_fields' USING ERRCODE='22023'; END IF;
    ELSE
     IF EXISTS(SELECT FROM jsonb_object_keys(item) k WHERE k NOT IN ('label','url','checked_on','fields'))
      OR jsonb_typeof(item->'fields') IS DISTINCT FROM 'array' OR jsonb_array_length(item->'fields') NOT BETWEEN 1 AND 12
      OR jsonb_typeof(item->'checked_on') IS DISTINCT FROM 'string' OR (item->>'checked_on') !~ '^\d{4}-\d{2}-\d{2}$'
      OR (item->>'checked_on')::date > current_date THEN RAISE EXCEPTION 'invalid_source' USING ERRCODE='22023'; END IF;
     FOR part IN SELECT value FROM jsonb_array_elements(item->'fields') LOOP
      declared:=part#>>'{}';
      IF jsonb_typeof(part)<>'string' OR NOT (declared=ANY(allowed)) THEN RAISE EXCEPTION 'invalid_source_field' USING ERRCODE='22023'; END IF;
      covered:=array_append(covered,declared);
     END LOOP;
    END IF;
   END IF;
  END LOOP;
 END LOOP;
 IF publishing THEN
  IF cardinality(covered)=0 THEN RAISE EXCEPTION 'source_required' USING ERRCODE='22023'; END IF;
  FOR key IN SELECT jsonb_object_keys(doc) LOOP
   IF key<>'sources' AND doc->key NOT IN ('null'::jsonb,'[]'::jsonb) AND NOT (key=ANY(covered)) THEN
    RAISE EXCEPTION 'source_required: %',key USING ERRCODE='22023'; END IF;
  END LOOP;
 END IF;
END $$;

CREATE FUNCTION public.save_place_practical(p_place_id uuid,p_expected_revision integer,p_document jsonb,p_action text DEFAULT 'draft')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE row public.place_practical_profiles; next_revision integer;
BEGIN
 IF NOT public.is_active_staff() OR (p_action IN ('publish','unpublish') AND NOT public.is_admin_staff()) THEN
  RAISE EXCEPTION 'staff_permission_required' USING ERRCODE='42501'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('draft','publish','unpublish') THEN RAISE EXCEPTION 'invalid_action' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM public.places WHERE id=p_place_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'place_missing' USING ERRCODE='22023'; END IF;
 SELECT * INTO row FROM public.place_practical_profiles WHERE place_id=p_place_id;
 IF p_expected_revision IS DISTINCT FROM COALESCE(row.revision,0) THEN RAISE EXCEPTION 'practical_revision_conflict' USING ERRCODE='40001'; END IF;
 PERFORM public.check_practical_document(p_document,p_action='publish');
 next_revision:=COALESCE(row.revision,0)+1;
 INSERT INTO public.place_practical_profiles AS p (place_id,draft,published_document,revision)
 VALUES(p_place_id,p_document,CASE WHEN p_action='publish' THEN p_document WHEN p_action='draft' THEN row.published_document END,next_revision)
 ON CONFLICT(place_id) DO UPDATE SET draft=EXCLUDED.draft,published_document=EXCLUDED.published_document,revision=EXCLUDED.revision,updated_at=now();
 RETURN next_revision;
END $$;
REVOKE ALL ON FUNCTION public.save_place_practical(uuid,integer,jsonb,text),public.check_practical_document(jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_place_practical(uuid,integer,jsonb,text) TO authenticated;

CREATE VIEW public.public_place_practical WITH(security_barrier=true) AS
 SELECT f.place_id, doc->>'website_url' AS website_url,doc->>'contact_email' AS contact_email,doc->>'google_maps_url' AS google_maps_url,
 doc->>'official_description' AS official_description, COALESCE(doc->'social_links','[]') AS social_links,
 COALESCE(doc->'services','[]') AS services,COALESCE(doc->'payment_methods','[]') AS payment_methods,COALESCE(doc->'sources','[]') AS sources
 FROM public.place_practical_profiles f JOIN public.places p ON p.id=f.place_id
 CROSS JOIN LATERAL (SELECT f.published_document AS doc) published WHERE p.is_published AND doc IS NOT NULL;

CREATE VIEW public.public_place_review_stats WITH(security_barrier=true) AS
 SELECT p.id AS place_id,count(r.id) AS review_count,round(avg(r.note_cuisine),2) AS cuisine_avg,
 round(avg(r.note_cadre),2) AS cadre_avg,round(avg(r.note_service),2) AS service_avg,
 ARRAY[count(*) FILTER(WHERE round(r.note_globale)=1),count(*) FILTER(WHERE round(r.note_globale)=2),
       count(*) FILTER(WHERE round(r.note_globale)=3),count(*) FILTER(WHERE round(r.note_globale)=4),
       count(*) FILTER(WHERE round(r.note_globale)=5)] AS histogram
 FROM public.places p LEFT JOIN public.public_reviews r ON r.place_id=p.id AND r.is_seed IS FALSE
 WHERE p.is_published GROUP BY p.id;
REVOKE ALL ON public.public_place_practical,public.public_place_review_stats FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_place_practical,public.public_place_review_stats TO anon,authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;

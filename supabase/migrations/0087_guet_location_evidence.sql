-- Only explicitly reviewed coordinates may arm a proximity reminder.
CREATE TABLE public.place_location_checks (
 place_id uuid PRIMARY KEY REFERENCES public.places(id) ON DELETE CASCADE,
 lat double precision NOT NULL CHECK(lat BETWEEN -90 AND 90),
 lng double precision NOT NULL CHECK(lng BETWEEN -180 AND 180),
 accuracy_meters real NOT NULL CHECK(accuracy_meters BETWEEN 0 AND 100),
 source text NOT NULL CHECK(char_length(btrim(source)) BETWEEN 1 AND 2000),
 checked_at timestamptz NOT NULL DEFAULT now(), checked_by uuid REFERENCES public.spawt_staff(id)
);
ALTER TABLE public.place_location_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.place_location_checks FROM anon,authenticated;
GRANT SELECT ON public.place_location_checks TO authenticated;
CREATE POLICY location_checks_staff ON public.place_location_checks FOR SELECT TO authenticated USING(public.is_active_staff());
CREATE FUNCTION public.validate_place_location(p_place_id uuid,p_source text,p_accuracy real) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public.places; BEGIN
 IF NOT public.is_active_staff() THEN RAISE EXCEPTION 'staff_required' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT p FROM public.places WHERE id=p_place_id FOR UPDATE;
 INSERT INTO public.place_location_checks(place_id,lat,lng,accuracy_meters,source,checked_by)
 VALUES(p.id,p.lat,p.lng,p_accuracy,p_source,auth.uid())
 ON CONFLICT(place_id) DO UPDATE SET lat=EXCLUDED.lat,lng=EXCLUDED.lng,accuracy_meters=EXCLUDED.accuracy_meters,source=EXCLUDED.source,checked_by=EXCLUDED.checked_by,checked_at=now();
 INSERT INTO public.editorial_history(actor_id,entity_table,entity_key,after_value)
 VALUES(auth.uid(),'place_location_checks',p.id::text,jsonb_build_object('lat',p.lat,'lng',p.lng,'source',p_source,'accuracy_meters',p_accuracy));
END $$;
REVOKE ALL ON FUNCTION public.validate_place_location(uuid,text,real) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_place_location(uuid,text,real) TO authenticated;
CREATE VIEW public.public_guet_places WITH(security_barrier=true) AS
 SELECT p.id,p.name,p.lat,p.lng,c.checked_at FROM public.places p JOIN public.place_location_checks c ON c.place_id=p.id
 WHERE p.is_published AND p.lat=c.lat AND p.lng=c.lng;
GRANT SELECT ON public.public_guet_places TO anon,authenticated;
CREATE FUNCTION public.capture_approved_location() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.kind='location' AND NEW.status='approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
  PERFORM public.validate_place_location(NEW.place_id,'contribution:'||NEW.id::text,(NEW.proposal->>'accuracy_meters')::real);
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER contribution_location_evidence AFTER UPDATE OF status ON public.place_contributions FOR EACH ROW EXECUTE FUNCTION public.capture_approved_location();
CREATE TRIGGER content_revision AFTER INSERT OR UPDATE OR DELETE ON public.place_location_checks FOR EACH STATEMENT EXECUTE FUNCTION public.bump_public_content_revision();
-- A distinct release gate prevents activation through the old Guet flag.
INSERT INTO public.feature_flags(flag_code,scope,enabled,spawter_id)
 SELECT 'guet-proximity-v2',scope,false,NULL FROM (VALUES('internal'),('alpha'),('beta'),('prod')) v(scope)
 ON CONFLICT DO NOTHING;

-- Explicit visits remain possible without GPS. Only this RPC verifies presence.
CREATE TABLE public.visit_presence_evidence (
 spawt_id uuid PRIMARY KEY REFERENCES public.spawt_checkin(id) ON DELETE CASCADE,
 spawter_id uuid NOT NULL REFERENCES public.spawters(id), place_id uuid NOT NULL REFERENCES public.places(id),
 lat double precision NOT NULL, lng double precision NOT NULL, accuracy_meters real NOT NULL,
 measured_at timestamptz NOT NULL, verified_at timestamptz NOT NULL DEFAULT now(), distance_meters real NOT NULL
);
ALTER TABLE public.visit_presence_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.visit_presence_evidence FROM anon,authenticated;
CREATE FUNCTION public.guard_visit_verification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.is_seed THEN RETURN NEW; END IF;
 -- Keep historical verification on an unchanged visit; never re-label history.
 IF TG_OP='UPDATE' AND OLD.is_verified AND NEW.spawter_id=OLD.spawter_id AND NEW.place_id=OLD.place_id
   AND NEW.arrived_at=OLD.arrived_at AND NEW.checked_in_at IS NOT DISTINCT FROM OLD.checked_in_at
   AND NEW.geolocation_lat IS NOT DISTINCT FROM OLD.geolocation_lat AND NEW.geolocation_lng IS NOT DISTINCT FROM OLD.geolocation_lng
   AND NEW.check_in_type=OLD.check_in_type THEN RETURN NEW; END IF;
 NEW.is_verified := NEW.checked_in_at IS NOT NULL AND NEW.check_in_type<>'passive' AND EXISTS(
   SELECT 1 FROM public.visit_presence_evidence e WHERE e.spawt_id=NEW.id AND e.spawter_id=NEW.spawter_id AND e.place_id=NEW.place_id
   AND e.lat=NEW.geolocation_lat AND e.lng=NEW.geolocation_lng);
 RETURN NEW;
END $$;
CREATE TRIGGER a_visit_verification BEFORE INSERT OR UPDATE ON public.spawt_checkin FOR EACH ROW EXECUTE FUNCTION public.guard_visit_verification();
CREATE FUNCTION public.verify_visit_presence(p_spawt_id uuid,p_owner uuid,p_lat double precision,p_lng double precision,p_accuracy real,p_measured_at timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE visit public.spawt_checkin; location public.public_guet_places; distance real;
BEGIN
 IF auth.uid() IS NULL OR p_owner IS DISTINCT FROM auth.uid() OR NOT EXISTS(SELECT 1 FROM public.spawters WHERE id=p_owner AND NOT is_banned) THEN RAISE EXCEPTION 'account_required' USING ERRCODE='42501'; END IF;
 SELECT * INTO visit FROM public.spawt_checkin WHERE id=p_spawt_id AND spawter_id=p_owner FOR UPDATE;
 IF NOT FOUND OR visit.is_seed OR visit.is_cancelled OR visit.deleted_at IS NOT NULL OR visit.check_in_type='passive' OR visit.checked_in_at IS NULL THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.visit_presence_evidence WHERE spawt_id=visit.id) THEN RETURN visit.is_verified; END IF;
 IF visit.checked_in_at<now()-interval '4 hours' OR visit.checked_in_at>now()+interval '10 seconds' THEN RETURN false; END IF;
 IF p_lat IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lng IS NULL OR p_lng NOT BETWEEN -180 AND 180
   OR p_accuracy IS NULL OR p_accuracy NOT BETWEEN 0 AND 50 OR p_measured_at IS NULL
   OR p_measured_at<now()-interval '120 seconds' OR p_measured_at>now()+interval '10 seconds' THEN RETURN false; END IF;
 SELECT * INTO location FROM public.public_guet_places WHERE id=visit.place_id;
 IF NOT FOUND THEN RETURN false; END IF;
 distance := public.antifraud_haversine_km(p_lat,p_lng,location.lat,location.lng)*1000;
 IF distance>100 THEN RETURN false; END IF;
 INSERT INTO public.visit_presence_evidence(spawt_id,spawter_id,place_id,lat,lng,accuracy_meters,measured_at,distance_meters)
 VALUES(visit.id,p_owner,visit.place_id,p_lat,p_lng,p_accuracy,p_measured_at,distance);
 UPDATE public.spawt_checkin SET geolocation_lat=p_lat,geolocation_lng=p_lng,geolocation_source='gps',accuracy_meters=p_accuracy,
 distance_to_lieu_meters=distance,is_verified=true,flag_reason=CASE WHEN flag_reason='sans_geoloc' THEN NULL ELSE flag_reason END WHERE id=visit.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.verify_visit_presence(uuid,uuid,double precision,double precision,real,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_visit_presence(uuid,uuid,double precision,double precision,real,timestamptz) TO authenticated;

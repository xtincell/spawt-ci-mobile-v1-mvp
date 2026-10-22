\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id,email) VALUES
 ('eeee0000-0000-4000-8000-0000000088a1','outing-a@spawt.local'),
 ('eeee0000-0000-4000-8000-0000000088a2','outing-b@spawt.local'),
 ('eeee0000-0000-4000-8000-0000000088a3','outing-staff@spawt.local');
INSERT INTO spawters(id,phone_e164,display_name) VALUES
 ('eeee0000-0000-4000-8000-0000000088a1','+22577000881','Outing A'),
 ('eeee0000-0000-4000-8000-0000000088a2','+22577000882','Outing B');
INSERT INTO spawt_staff(id,email,display_name,role,is_active) VALUES
 ('eeee0000-0000-4000-8000-0000000088a3','outing-staff@spawt.local','Équipe','operator',true);
INSERT INTO places(id,name,lat,lng,price_tier,descriptive_address,neighborhood,city,cuisine,is_published)
 VALUES('eeee0000-0000-4000-8000-0000000088c1','Lieu témoin',5.3,-4,null,'','','Abidjan','{}',true);
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-0000000088a1',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public_guet_places WHERE id='eeee0000-0000-4000-8000-0000000088c1') THEN RAISE EXCEPTION 'unreviewed coordinates exposed'; END IF;
 BEGIN PERFORM validate_place_location('eeee0000-0000-4000-8000-0000000088c1','fake',10); RAISE EXCEPTION 'self validation'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM mutate_outing(gen_random_uuid(),'choose','{"place_id":"eeee0000-0000-4000-8000-0000000088c1"}','eeee0000-0000-4000-8000-0000000088a2'); RAISE EXCEPTION 'late owner mutation'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF my_outings('eeee0000-0000-4000-8000-0000000088a2') IS NOT NULL THEN RAISE EXCEPTION 'late owner read'; END IF;
END $$;
INSERT INTO spawt_checkin(id,spawter_id,place_id,arrived_at,checked_in_at,check_in_type,geolocation_source,is_verified)
 VALUES('eeee0000-0000-4000-8000-0000000088d1',auth.uid(),'eeee0000-0000-4000-8000-0000000088c1',now(),now(),'manual','manual',true);
DO $$ BEGIN
 IF (SELECT is_verified FROM spawt_checkin WHERE id='eeee0000-0000-4000-8000-0000000088d1') THEN RAISE EXCEPTION 'forged presence'; END IF;
 IF verify_visit_presence('eeee0000-0000-4000-8000-0000000088d1',auth.uid(),5.3,-4,10,now()) THEN RAISE EXCEPTION 'unreviewed coordinate proof'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-0000000088a3',true);
SET LOCAL ROLE authenticated;
SELECT validate_place_location('eeee0000-0000-4000-8000-0000000088c1','Field evidence',10);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-0000000088a1',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE target uuid:='eeee0000-0000-4000-8000-0000000088d1'; BEGIN
 IF verify_visit_presence(target,auth.uid(),5.3,-4,51,now()) THEN RAISE EXCEPTION 'imprecise GPS'; END IF;
 IF verify_visit_presence(target,auth.uid(),5.3,-4,10,now()-interval '3 minutes') THEN RAISE EXCEPTION 'stale GPS'; END IF;
 IF verify_visit_presence(target,auth.uid(),6,-4,10,now()) THEN RAISE EXCEPTION 'distant GPS'; END IF;
 IF NOT verify_visit_presence(target,auth.uid(),5.3,-4,10,now()) THEN RAISE EXCEPTION 'valid GPS refused'; END IF;
 IF NOT verify_visit_presence(target,auth.uid(),5.3,-4,10,now()) THEN RAISE EXCEPTION 'proof replay refused'; END IF;
 BEGIN PERFORM * FROM visit_presence_evidence; RAISE EXCEPTION 'raw GPS exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT report_app_activity(auth.uid(),gen_random_uuid(),true,'android','1.1.1','41','denied',0);
SELECT report_app_activity(auth.uid(),gen_random_uuid(),true,'android','1.1.1','41','denied',0);
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM visit_presence_evidence WHERE spawt_id='eeee0000-0000-4000-8000-0000000088d1')<>1 THEN RAISE EXCEPTION 'duplicate proof'; END IF;
 IF (SELECT count(*) FROM app_open_sessions WHERE spawter_id='eeee0000-0000-4000-8000-0000000088a1')<>1 THEN RAISE EXCEPTION 'multi device opens duplicated'; END IF;
END $$;
UPDATE places SET lat=5.31 WHERE id='eeee0000-0000-4000-8000-0000000088c1';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public_guet_places WHERE id='eeee0000-0000-4000-8000-0000000088c1') THEN RAISE EXCEPTION 'changed coordinates still eligible'; END IF;
 IF EXISTS(SELECT 1 FROM feature_flags WHERE flag_code='guet-proximity-v2' AND enabled) THEN RAISE EXCEPTION 'Guet enabled before physical receipt'; END IF;
END $$;
ROLLBACK;

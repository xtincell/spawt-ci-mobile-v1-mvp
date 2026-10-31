\set ON_ERROR_STOP on
BEGIN;

INSERT INTO auth.users(id,email) VALUES
  ('eeee0000-0000-4000-8000-0000000092a1','cartography-owner@spawt.local'),
  ('eeee0000-0000-4000-8000-0000000092a3','cartography-staff@spawt.local');
INSERT INTO public.spawters(id,phone_e164,display_name) VALUES
  ('eeee0000-0000-4000-8000-0000000092a1','+22577000921','Recette cartographique');
INSERT INTO public.spawt_staff(id,email,display_name,role,is_active) VALUES
  ('eeee0000-0000-4000-8000-0000000092a3','cartography-staff@spawt.local','Équipe cartographie','operator',true);
INSERT INTO public.places(id,name,lat,lng,price_tier,descriptive_address,neighborhood,city,cuisine,is_published) VALUES
  ('eeee0000-0000-4000-8000-0000000092c1','Point cartographique',5.3,-4,null,'','','Abidjan','{}',true),
  ('eeee0000-0000-4000-8000-0000000092c2','Point cartographique brouillon',5.31,-4.01,null,'','','Abidjan','{}',false),
  ('eeee0000-0000-4000-8000-0000000092c3','Relevé GPS contrôlé',5.32,-4.02,null,'','','Abidjan','{}',true),
  ('eeee0000-0000-4000-8000-0000000092c4','Point à contribuer',5.33,-4.03,null,'','','Abidjan','{}',true);

-- A URL does not let an ordinary account certify the reference location.
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-0000000092a1',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.validate_place_location('eeee0000-0000-4000-8000-0000000092c1',
      'https://maps.example.test/places/guet-fixture',NULL,5.3,-4);
    RAISE EXCEPTION 'Non-staff account validated a map point';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- The optional reference accuracy must not weaken GPS contributions.
  BEGIN
    PERFORM public.submit_place_contribution(gen_random_uuid(),'eeee0000-0000-4000-8000-0000000092c4','location',
      jsonb_build_object('lat',5.33,'lng',-4.03,'observed_at',now()),'Précision absente');
    RAISE EXCEPTION 'GPS contribution accepted missing accuracy';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.submit_place_contribution(gen_random_uuid(),'eeee0000-0000-4000-8000-0000000092c4','location',
      jsonb_build_object('lat',5.33,'lng',-4.03,'accuracy_meters',NULL,'observed_at',now()),'Précision inconnue');
    RAISE EXCEPTION 'GPS contribution accepted null accuracy';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-0000000092a3',true);
SET LOCAL ROLE authenticated;
SELECT public.validate_place_location('eeee0000-0000-4000-8000-0000000092c1',
  'https://maps.example.test/places/guet-fixture',NULL,5.3,-4);
SELECT public.validate_place_location('eeee0000-0000-4000-8000-0000000092c2',
  'http://maps.example.test/places/draft-fixture',NULL,5.31,-4.01);
SELECT public.validate_place_location('eeee0000-0000-4000-8000-0000000092c3',
  'Relevé GPS de recette',12,5.32,-4.02);
DO $$ DECLARE invalid_source text; invalid_accuracy real; BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.place_location_checks
    WHERE place_id='eeee0000-0000-4000-8000-0000000092c1'
      AND accuracy_meters IS NULL AND source='https://maps.example.test/places/guet-fixture'
      AND lat=5.3 AND lng=-4 AND checked_by=auth.uid()) THEN
    RAISE EXCEPTION 'Map source or coordinate snapshot lost, or accuracy fabricated';
  END IF;
  FOREACH invalid_source IN ARRAY ARRAY['','   ','Google Maps','contribution:fixture',
      'https://','http:///point','https://?point=1',
      'https://maps.example.test/with space','ftp://maps.example.test/point'] LOOP
    BEGIN
      PERFORM public.validate_place_location('eeee0000-0000-4000-8000-0000000092c1',invalid_source,NULL,5.3,-4);
      RAISE EXCEPTION 'Null accuracy accepted without an explicit HTTP(S) source: %',invalid_source;
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;
  BEGIN
    PERFORM public.validate_place_location('eeee0000-0000-4000-8000-0000000092c1',NULL,NULL,5.3,-4);
    RAISE EXCEPTION 'Null source accepted';
  EXCEPTION WHEN not_null_violation THEN NULL;
  END;
  FOREACH invalid_accuracy IN ARRAY ARRAY[-1,101]::real[] LOOP
    BEGIN
      PERFORM public.validate_place_location('eeee0000-0000-4000-8000-0000000092c1',
        'https://maps.example.test/places/guet-fixture',invalid_accuracy,5.3,-4);
      RAISE EXCEPTION 'Out-of-range accuracy accepted: %',invalid_accuracy;
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;
END $$;
RESET ROLE;

-- Reference-location validation is not a visit, review, contribution or reward.
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.spawt_checkin WHERE place_id IN (
      'eeee0000-0000-4000-8000-0000000092c1','eeee0000-0000-4000-8000-0000000092c2','eeee0000-0000-4000-8000-0000000092c3'))
    OR EXISTS(SELECT 1 FROM public.visit_presence_evidence WHERE spawter_id='eeee0000-0000-4000-8000-0000000092a1')
    OR EXISTS(SELECT 1 FROM public.place_contributions WHERE spawter_id='eeee0000-0000-4000-8000-0000000092a1')
    OR EXISTS(SELECT 1 FROM public.paws_ledger WHERE spawter_id='eeee0000-0000-4000-8000-0000000092a1') THEN
    RAISE EXCEPTION 'Reference-location validation created user activity';
  END IF;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.public_guet_places WHERE id='eeee0000-0000-4000-8000-0000000092c1' AND lat=5.3 AND lng=-4)
    OR NOT EXISTS(SELECT 1 FROM public.public_guet_places WHERE id='eeee0000-0000-4000-8000-0000000092c3')
    OR EXISTS(SELECT 1 FROM public.public_guet_places WHERE id IN (
      'eeee0000-0000-4000-8000-0000000092c2','eeee0000-0000-4000-8000-0000000092c4')) THEN
    RAISE EXCEPTION 'Published reviewed map/GPS points, drafts or unreviewed points have wrong eligibility';
  END IF;
END $$;
RESET ROLE;

-- User presence still needs its own recent, precise and nearby measurement.
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-0000000092a1',true);
SET LOCAL ROLE authenticated;
INSERT INTO public.spawt_checkin(id,spawter_id,place_id,arrived_at,checked_in_at,check_in_type,geolocation_source,is_verified)
  VALUES('eeee0000-0000-4000-8000-0000000092d1',auth.uid(),'eeee0000-0000-4000-8000-0000000092c1',now(),now(),'manual','manual',true);
DO $$ DECLARE target uuid:='eeee0000-0000-4000-8000-0000000092d1'; BEGIN
  IF (SELECT is_verified FROM public.spawt_checkin WHERE id=target)
    OR public.verify_visit_presence(target,auth.uid(),5.3,-4,NULL,now())
    OR public.verify_visit_presence(target,auth.uid(),5.3,-4,51,now())
    OR public.verify_visit_presence(target,auth.uid(),5.3,-4,10,now()-interval '3 minutes')
    OR public.verify_visit_presence(target,auth.uid(),6,-4,10,now()) THEN
    RAISE EXCEPTION 'Map source bypassed user-presence checks';
  END IF;
  IF NOT public.verify_visit_presence(target,auth.uid(),5.3,-4,10,now()) THEN
    RAISE EXCEPTION 'Valid user presence refused at a reviewed map point';
  END IF;
END $$;
SELECT public.submit_place_contribution('eeee0000-0000-4000-8000-0000000092d4','eeee0000-0000-4000-8000-0000000092c4','location',
  jsonb_build_object('lat',5.33,'lng',-4.03,'accuracy_meters',12,'observed_at',now()),'Relevé GPS de recette');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-0000000092a3',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE stamp timestamptz; BEGIN
  SELECT updated_at INTO stamp FROM public.places WHERE id='eeee0000-0000-4000-8000-0000000092c4';
  PERFORM public.moderate_place_contribution('eeee0000-0000-4000-8000-0000000092d4','approved','Relevé reçu',stamp,'{"lat":5.33,"lng":-4.03}');
  IF NOT EXISTS(SELECT 1 FROM public.place_location_checks
    WHERE place_id='eeee0000-0000-4000-8000-0000000092c4'
      AND source='contribution:eeee0000-0000-4000-8000-0000000092d4' AND accuracy_meters=12) THEN
    RAISE EXCEPTION 'Approved GPS contribution lost its measured accuracy';
  END IF;
END $$;
RESET ROLE;

-- Both stale review requests and subsequent coordinate edits stay protected.
UPDATE public.places SET lat=5.301 WHERE id='eeee0000-0000-4000-8000-0000000092c1';
SET LOCAL ROLE anon;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.public_guet_places WHERE id='eeee0000-0000-4000-8000-0000000092c1') THEN
    RAISE EXCEPTION 'Changed coordinates kept their old map validation';
  END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.validate_place_location('eeee0000-0000-4000-8000-0000000092c1',
      'https://maps.example.test/places/guet-fixture',NULL,5.3,-4);
    RAISE EXCEPTION 'Stale map review overwrote a coordinate change';
  EXCEPTION WHEN serialization_failure THEN NULL;
  END;
END $$;
SELECT public.validate_place_location('eeee0000-0000-4000-8000-0000000092c1',
  'https://maps.example.test/places/corrected-fixture',NULL,5.301,-4);
RESET ROLE;

-- Exercise real rollback with both map-only and measured validations present.
-- This intentionally removes only null-accuracy validations. The transaction
-- rolls every fixture and schema round trip back at the end of this test.
\ir ../migrations/0092_guet_cartographic_locations.down.sql
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.place_location_checks WHERE place_id IN (
      'eeee0000-0000-4000-8000-0000000092c1','eeee0000-0000-4000-8000-0000000092c2'))
    OR (SELECT count(*) FROM public.place_location_checks WHERE place_id IN (
      'eeee0000-0000-4000-8000-0000000092c3','eeee0000-0000-4000-8000-0000000092c4') AND accuracy_meters=12)<>2
    OR NOT (SELECT attnotnull FROM pg_attribute
      WHERE attrelid='public.place_location_checks'::regclass AND attname='accuracy_meters') THEN
    RAISE EXCEPTION 'Rollback removed measured validations or did not restore NOT NULL';
  END IF;
  IF (SELECT count(*) FROM public.places WHERE id IN (
      'eeee0000-0000-4000-8000-0000000092c1','eeee0000-0000-4000-8000-0000000092c2'))<>2
    OR NOT EXISTS(SELECT 1 FROM public.visit_presence_evidence WHERE spawt_id='eeee0000-0000-4000-8000-0000000092d1')
    OR NOT EXISTS(SELECT 1 FROM public.editorial_history WHERE entity_table='place_location_checks'
      AND entity_key='eeee0000-0000-4000-8000-0000000092c1') THEN
    RAISE EXCEPTION 'Rollback removed a place, presence proof or audit history';
  END IF;
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.validate_place_location('eeee0000-0000-4000-8000-0000000092c1',
      'https://maps.example.test/places/corrected-fixture',NULL,5.301,-4);
    RAISE EXCEPTION 'Rollback still accepts null accuracy';
  EXCEPTION WHEN not_null_violation THEN NULL;
  END;
END $$;
RESET ROLE;
\ir ../migrations/0092_guet_cartographic_locations.sql
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.public_guet_places WHERE id='eeee0000-0000-4000-8000-0000000092c1') THEN
    RAISE EXCEPTION 'Reapplying migration invented a deleted map validation';
  END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT public.validate_place_location('eeee0000-0000-4000-8000-0000000092c1',
  'https://maps.example.test/places/corrected-fixture',NULL,5.301,-4);
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.public_guet_places
    WHERE id='eeee0000-0000-4000-8000-0000000092c1' AND lat=5.301 AND lng=-4) THEN
    RAISE EXCEPTION 'Map validation failed after rollback and reapply';
  END IF;
END $$;
RESET ROLE;
ROLLBACK;

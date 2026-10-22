\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id,email) VALUES
 ('eeee0000-0000-4000-8000-0000000085a1','contribution-a@spawt.local'),
 ('eeee0000-0000-4000-8000-0000000085a2','contribution-b@spawt.local'),
 ('eeee0000-0000-4000-8000-0000000085a3','contribution-staff@spawt.local'),
 ('eeee0000-0000-4000-8000-0000000085a4','contribution-admin@spawt.local');
INSERT INTO spawters(id,phone_e164,display_name) VALUES
 ('eeee0000-0000-4000-8000-0000000085a1','+22577000851','Contribution A'),
 ('eeee0000-0000-4000-8000-0000000085a2','+22577000852','Contribution B');
INSERT INTO spawt_staff(id,email,display_name,role,is_active) VALUES
 ('eeee0000-0000-4000-8000-0000000085a3','contribution-staff@spawt.local','Équipe recette','operator',true),
 ('eeee0000-0000-4000-8000-0000000085a4','contribution-admin@spawt.local','Admin recette','admin',true);
INSERT INTO places(id,name,lat,lng,price_tier,descriptive_address,neighborhood,city,cuisine,is_published)
VALUES('eeee0000-0000-4000-8000-0000000085c1','Lieu à enrichir',null,null,null,'','','Abidjan','{}',true),
 ('eeee0000-0000-4000-8000-0000000085c2','Lieu privé',null,null,null,'','','Abidjan','{}',false);
INSERT INTO storage.objects(bucket_id,name,owner) VALUES('place-contributions',
 'eeee0000-0000-4000-8000-0000000085a1/eeee0000-0000-4000-8000-0000000085d2/0.jpg','eeee0000-0000-4000-8000-0000000085a1');
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM * FROM place_contributions; RAISE EXCEPTION 'ASSERT: anonymous contribution read'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='place-contributions') THEN RAISE EXCEPTION 'ASSERT: pending proof exposed'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-0000000085a1',true);
SET LOCAL ROLE authenticated;
SELECT submit_place_contribution('eeee0000-0000-4000-8000-0000000085d1','eeee0000-0000-4000-8000-0000000085c1','location',
 jsonb_build_object('lat',5.3,'lng',-4.0,'accuracy_meters',12,'observed_at',now()),'Entrée principale');
SELECT submit_place_contribution('eeee0000-0000-4000-8000-0000000085d1','eeee0000-0000-4000-8000-0000000085c1','location',
 jsonb_build_object('lat',5.3,'lng',-4.0,'accuracy_meters',12,'observed_at',now()),'Entrée principale');
SELECT submit_place_contribution('eeee0000-0000-4000-8000-0000000085d2','eeee0000-0000-4000-8000-0000000085c1','menu',
 '{"photo_paths":["eeee0000-0000-4000-8000-0000000085a1/eeee0000-0000-4000-8000-0000000085d2/0.jpg"],"avg_ticket_xof":7000}','Menu du jour');
DO $$ BEGIN
 IF (SELECT count(*) FROM place_contributions)<>2 OR EXISTS(SELECT 1 FROM paws_ledger)
  OR EXISTS(SELECT 1 FROM places WHERE id='eeee0000-0000-4000-8000-0000000085c1' AND (lat IS NOT NULL OR cardinality(menu_urls)>0)) THEN
  RAISE EXCEPTION 'ASSERT: submission duplicated, credited or changed public data'; END IF;
 UPDATE storage.objects SET name=name WHERE bucket_id='place-contributions';
 IF FOUND THEN RAISE EXCEPTION 'ASSERT: submitted proof can be replaced'; END IF;
 BEGIN UPDATE place_contributions SET status='approved' WHERE id='eeee0000-0000-4000-8000-0000000085d1';
  RAISE EXCEPTION 'ASSERT: direct approval allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO place_contributions(id,place_id,spawter_id,kind,proposal,offered_reward_paws)
  VALUES(gen_random_uuid(),'eeee0000-0000-4000-8000-0000000085c1',auth.uid(),'location','{}',100);
  RAISE EXCEPTION 'ASSERT: direct insertion allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM moderate_place_contribution('eeee0000-0000-4000-8000-0000000085d1','approved','',now(),'{"lat":5.3,"lng":-4}');
  RAISE EXCEPTION 'ASSERT: self moderation'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM submit_place_contribution(gen_random_uuid(),'eeee0000-0000-4000-8000-0000000085c2','location',
  jsonb_build_object('lat',5.3,'lng',-4,'accuracy_meters',10,'observed_at',now()),'');
  RAISE EXCEPTION 'ASSERT: private target accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM submit_place_contribution(gen_random_uuid(),'eeee0000-0000-4000-8000-0000000085c1','location',
  jsonb_build_object('lat',5.3,'lng',-4,'accuracy_meters',10,'observed_at',now()-interval '1 hour'),'');
  RAISE EXCEPTION 'ASSERT: old position accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM submit_place_contribution(gen_random_uuid(),'eeee0000-0000-4000-8000-0000000085c1','location',
  jsonb_build_object('lat',5.3,'lng',-4,'accuracy_meters',101,'observed_at',now()),'');
  RAISE EXCEPTION 'ASSERT: imprecise position accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-0000000085a2',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM place_contributions) OR EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='place-contributions') THEN
  RAISE EXCEPTION 'ASSERT: another account sees private contributions'; END IF;
 BEGIN PERFORM submit_place_contribution('eeee0000-0000-4000-8000-0000000085d2','eeee0000-0000-4000-8000-0000000085c1','menu','{}','');
  RAISE EXCEPTION 'ASSERT: stolen contribution id'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM submit_place_contribution(gen_random_uuid(),'eeee0000-0000-4000-8000-0000000085c1','menu',
  '{"photo_paths":["eeee0000-0000-4000-8000-0000000085a1/eeee0000-0000-4000-8000-0000000085d2/0.jpg"]}','');
  RAISE EXCEPTION 'ASSERT: stolen proof'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT submit_place_contribution('eeee0000-0000-4000-8000-0000000085d3','eeee0000-0000-4000-8000-0000000085c1','location',
 jsonb_build_object('lat',5.4,'lng',-4.1,'accuracy_meters',12,'observed_at',now()),'Autre proposition');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-0000000085a3',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE stamp timestamptz; BEGIN
 BEGIN PERFORM set_place_contribution_reward('menu',7,'Nouveau barème');
  RAISE EXCEPTION 'ASSERT: operator edits reward rules'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 SELECT updated_at INTO stamp FROM places WHERE id='eeee0000-0000-4000-8000-0000000085c1';
 BEGIN PERFORM moderate_place_contribution('eeee0000-0000-4000-8000-0000000085d1','approved','Relevé reçu',stamp-interval '1 second','{"lat":5.3,"lng":-4}');
  RAISE EXCEPTION 'ASSERT: stale edit overwrote place'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 IF EXISTS(SELECT 1 FROM paws_ledger WHERE reason='contribution_validee') THEN RAISE EXCEPTION 'ASSERT: failed approval credited'; END IF;
 PERFORM moderate_place_contribution('eeee0000-0000-4000-8000-0000000085d1','approved','Relevé reçu',stamp,'{"lat":5.3,"lng":-4}');
 PERFORM moderate_place_contribution('eeee0000-0000-4000-8000-0000000085d1','approved','Relevé reçu',stamp,'{"lat":5.3,"lng":-4}');
 PERFORM moderate_place_contribution('eeee0000-0000-4000-8000-0000000085d3','rejected','La position ne correspond pas.');
 IF (SELECT count(*) FROM paws_ledger WHERE ref_id='eeee0000-0000-4000-8000-0000000085d1')<>1
  OR (SELECT delta FROM paws_ledger WHERE ref_id='eeee0000-0000-4000-8000-0000000085d1')<>5
  OR EXISTS(SELECT 1 FROM paws_ledger WHERE spawter_id='eeee0000-0000-4000-8000-0000000085a2') THEN
  RAISE EXCEPTION 'ASSERT: repeated approval or rejection reward'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-0000000085a4',true);
SET LOCAL ROLE authenticated;
SELECT set_place_contribution_reward('menu',7,'Nouveau barème pour les prochains apports');
DO $$ DECLARE stamp timestamptz; BEGIN
 SELECT updated_at INTO stamp FROM places WHERE id='eeee0000-0000-4000-8000-0000000085c1';
 PERFORM moderate_place_contribution('eeee0000-0000-4000-8000-0000000085d2','approved','Prix lu sur le menu',stamp,'{"price_tier":2,"avg_ticket_xof":7000}');
 IF (SELECT delta FROM paws_ledger WHERE ref_id='eeee0000-0000-4000-8000-0000000085d2')<>5 THEN
  RAISE EXCEPTION 'ASSERT: promised reward changed retroactively'; END IF;
 IF EXISTS(SELECT 1 FROM spawt_checkin WHERE place_id='eeee0000-0000-4000-8000-0000000085c1') THEN
  RAISE EXCEPTION 'ASSERT: contribution fabricated a visit or review'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM places WHERE id='eeee0000-0000-4000-8000-0000000085c1' AND lat=5.3 AND lng=-4 AND price_tier=2 AND avg_ticket_xof=7000 AND cardinality(menu_urls)=1)
  OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='place-contributions') THEN
  RAISE EXCEPTION 'ASSERT: accepted fields or image unavailable publicly'; END IF;
END $$;
RESET ROLE;
-- Limits apply before a new submission, while retrying an existing ID remains safe.
SAVEPOINT rate_limit_cases;
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-0000000085a1',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 FOR i IN 1..5 LOOP
  PERFORM submit_place_contribution(gen_random_uuid(),'eeee0000-0000-4000-8000-0000000085c1','location',
   jsonb_build_object('lat',5.3,'lng',-4,'accuracy_meters',10,'observed_at',now()),'');
 END LOOP;
 BEGIN PERFORM submit_place_contribution(gen_random_uuid(),'eeee0000-0000-4000-8000-0000000085c1','location',
  jsonb_build_object('lat',5.3,'lng',-4,'accuracy_meters',10,'observed_at',now()),'');
  RAISE EXCEPTION 'ASSERT: pending rate limit bypass';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'contribution_rate_limit' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
UPDATE place_contributions SET status='rejected' WHERE status='pending';
INSERT INTO place_contributions(id,place_id,spawter_id,kind,proposal,offered_reward_paws,status)
 SELECT gen_random_uuid(),'eeee0000-0000-4000-8000-0000000085c1','eeee0000-0000-4000-8000-0000000085a1','location','{}',5,'rejected' FROM generate_series(1,13);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM submit_place_contribution(gen_random_uuid(),'eeee0000-0000-4000-8000-0000000085c1','location',
  jsonb_build_object('lat',5.3,'lng',-4,'accuracy_meters',10,'observed_at',now()),'');
  RAISE EXCEPTION 'ASSERT: daily rate limit bypass';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'contribution_rate_limit' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
ROLLBACK TO rate_limit_cases;
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-0000000085a4',true);
UPDATE spawters SET is_banned=true,banned_at=now(),banned_reason='Recette' WHERE id='eeee0000-0000-4000-8000-0000000085a2';
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-0000000085a2',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM submit_place_contribution(gen_random_uuid(),'eeee0000-0000-4000-8000-0000000085c1','menu','{}','');
  RAISE EXCEPTION 'ASSERT: banned contributor'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DELETE FROM spawters WHERE id='eeee0000-0000-4000-8000-0000000085a1';
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='place-contributions')
  OR EXISTS(SELECT 1 FROM places WHERE id='eeee0000-0000-4000-8000-0000000085c1' AND cardinality(menu_urls)>0) THEN
  RAISE EXCEPTION 'ASSERT: deleted account leaves public image references'; END IF;
END $$;
RESET ROLE;
ROLLBACK;

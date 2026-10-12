-- Notes, auteurs, droits des photos, compatibilité APK et purge. Aucun fixture persistant.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL request.jwt.claims = '{"role":"service_role"}';
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
SELECT ('d0710000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'review-sql-' || n || '@example.invalid', '', now(), now(), now(), '', '', '', '', '', '', '', '' FROM generate_series(1,3) n;
INSERT INTO public.spawters (id,phone_e164,display_name,country_code,is_seed) VALUES
 ('d0710000-0000-4000-8000-000000000001','+2250000071001','Auteur SQL','CI',false),
 ('d0710000-0000-4000-8000-000000000002','+2250000071002','Second compte SQL','CI',false),
 ('d0710000-0000-4000-8000-000000000003','+2250000071003','Propriétaire fondateur SQL','CI',true);
INSERT INTO public.places (id,name,lat,lng,descriptive_address,neighborhood,city,price_tier,is_published)
VALUES ('d0710000-0000-4000-8000-000000000100','Lieu SQL des trois critères',5.35,-3.99,'Fixture transactionnelle','Cocody','Abidjan',1,true);
INSERT INTO public.spawt_checkin (id,spawter_id,place_id,arrived_at,check_in_type,geolocation_source,is_verified,note_etoiles,note_cuisine,note_cadre,note_service,photos)
VALUES ('d0710000-0000-4000-8000-000000000101','d0710000-0000-4000-8000-000000000001','d0710000-0000-4000-8000-000000000100',now(),'manual','manual',false,5,5,4,4,
 ARRAY['d0710000-0000-4000-8000-000000000001/d0710000-0000-4000-8000-000000000101/0.jpg','d0710000-0000-4000-8000-000000000002/d0710000-0000-4000-8000-000000000101/0.jpg']);
DO $$ BEGIN
 IF (SELECT note_etoiles FROM public.spawt_checkin WHERE id='d0710000-0000-4000-8000-000000000101') <> 4 OR
    (SELECT note_globale FROM public.public_reviews WHERE id='d0710000-0000-4000-8000-000000000101') <> 4.3 OR
    abs((SELECT weighted_rating FROM public.place_adn WHERE place_id='d0710000-0000-4000-8000-000000000100') - 4.3) > 0.0001 THEN
  RAISE EXCEPTION 'ASSERT 5/4/4 must produce 4.3 and legacy 4'; END IF;
 BEGIN
  UPDATE public.spawt_checkin SET note_cadre=NULL WHERE id='d0710000-0000-4000-8000-000000000101';
  RAISE EXCEPTION 'ASSERT partial details accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  INSERT INTO public.review_author_attributions VALUES ('d0710000-0000-4000-8000-000000000101','d0710000-0000-4000-8000-000000000002');
  RAISE EXCEPTION 'ASSERT community author spoof accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
-- Les anciennes APK ne connaissent que note_etoiles. Une édition remplace les détails.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"d0710000-0000-4000-8000-000000000001"}';
UPDATE public.spawt_checkin SET note_etoiles=2 WHERE id='d0710000-0000-4000-8000-000000000101';
DO $$ BEGIN
 IF (SELECT note_cuisine FROM public.spawt_checkin WHERE id='d0710000-0000-4000-8000-000000000101') IS NOT NULL OR
    (SELECT note_globale FROM public.public_reviews WHERE id='d0710000-0000-4000-8000-000000000101') <> 2 THEN
  RAISE EXCEPTION 'ASSERT legacy edit incompatible'; END IF;
END $$;
UPDATE public.spawt_checkin SET note_cuisine=5,note_cadre=4,note_service=4 WHERE id='d0710000-0000-4000-8000-000000000101';
-- La moyenne change sans changer son arrondi entier : le recalcul du lieu doit quand même partir.
UPDATE public.spawt_checkin SET note_service=3 WHERE id='d0710000-0000-4000-8000-000000000101';
RESET ROLE;
SET LOCAL request.jwt.claims = '{"role":"service_role"}';
DO $$ BEGIN
 IF abs((SELECT weighted_rating FROM public.place_adn WHERE place_id='d0710000-0000-4000-8000-000000000100') - 4.0) > 0.0001 THEN RAISE EXCEPTION 'ASSERT detailed edit did not recompute'; END IF;
 IF (SELECT public FROM storage.buckets WHERE id='place-photos') THEN RAISE EXCEPTION 'ASSERT private bucket became public'; END IF;
END $$;
INSERT INTO storage.objects (bucket_id,name) VALUES
 ('place-photos','d0710000-0000-4000-8000-000000000001/d0710000-0000-4000-8000-000000000101/0.jpg'),
 ('place-photos','d0710000-0000-4000-8000-000000000002/d0710000-0000-4000-8000-000000000101/0.jpg');
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '{"role":"anon"}';
DO $$ BEGIN
 IF NOT public.is_public_review_photo('d0710000-0000-4000-8000-000000000001/d0710000-0000-4000-8000-000000000101/0.jpg') OR
    public.is_public_review_photo('d0710000-0000-4000-8000-000000000002/d0710000-0000-4000-8000-000000000101/0.jpg') OR
    public.is_public_review_photo('d0710000-0000-4000-8000-000000000001/d0710000-0000-4000-8000-000000000101/2.jpg') THEN RAISE EXCEPTION 'ASSERT wrong photo scope'; END IF;
 IF (SELECT count(*) FROM storage.objects WHERE name LIKE 'd0710000-%') <> 1 THEN RAISE EXCEPTION 'ASSERT storage RLS scope wrong'; END IF;
 IF (SELECT count(*) FROM public.public_reviews WHERE id='d0710000-0000-4000-8000-000000000101') <> 1 THEN RAISE EXCEPTION 'ASSERT review invisible to other accounts'; END IF;
END $$;
RESET ROLE;
SET LOCAL request.jwt.claims = '{"role":"service_role"}';
UPDATE public.places SET is_published=false WHERE id='d0710000-0000-4000-8000-000000000100';
DO $$ BEGIN
 IF public.is_public_review_photo('d0710000-0000-4000-8000-000000000001/d0710000-0000-4000-8000-000000000101/0.jpg') OR EXISTS (SELECT 1 FROM public.public_reviews WHERE id='d0710000-0000-4000-8000-000000000101') THEN RAISE EXCEPTION 'ASSERT unpublished data leaked'; END IF;
END $$;
UPDATE public.places SET is_published=true WHERE id='d0710000-0000-4000-8000-000000000100';
UPDATE public.spawt_checkin SET is_cancelled=true WHERE id='d0710000-0000-4000-8000-000000000101';
DO $$ BEGIN
 IF public.is_public_review_photo('d0710000-0000-4000-8000-000000000001/d0710000-0000-4000-8000-000000000101/0.jpg') THEN RAISE EXCEPTION 'ASSERT cancelled photo leaked'; END IF;
END $$;
-- Attribution et purge sur le vrai lot, mais dans cette transaction annulée.
DO $$ DECLARE n integer; result record; BEGIN
 SELECT count(*) INTO n FROM public.spawt_checkin WHERE seed_batch_id='a1000000-0000-4000-8000-00000000f001';
 IF n > 0 THEN
  IF n <> 30 OR (SELECT count(*) FROM public.public_reviews WHERE is_seed AND spawter_id='c6e5c430-c762-41e9-991d-73d0aecc3382') <> 30 THEN RAISE EXCEPTION 'ASSERT founder attribution must cover 30 reviews'; END IF;
  IF EXISTS (SELECT 1 FROM public.spawt_checkin WHERE seed_batch_id='a1000000-0000-4000-8000-00000000f001' AND spawter_id <> 'a1000000-0000-4000-8000-00000000e001') THEN RAISE EXCEPTION 'ASSERT technical owner changed'; END IF;
  PERFORM public.purge_seed_reviews('a1000000-0000-4000-8000-00000000f001'::uuid,NULL::uuid,NULL::uuid);
  IF EXISTS (SELECT 1 FROM public.spawt_checkin WHERE seed_batch_id='a1000000-0000-4000-8000-00000000f001') OR EXISTS (SELECT 1 FROM public.review_author_attributions) THEN RAISE EXCEPTION 'ASSERT purge left attribution or founder reviews'; END IF;
 END IF;
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='public_reviews' AND (column_name LIKE '%geolocation%' OR column_name IN ('arrived_at','left_at','checked_in_at','phone_e164'))) THEN RAISE EXCEPTION 'ASSERT private data exposed'; END IF;
END $$;
ROLLBACK;

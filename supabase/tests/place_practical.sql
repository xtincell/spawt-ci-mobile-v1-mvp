\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.i(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT md5('practical-fixture/'||n)::uuid $$;
CREATE FUNCTION pg_temp.who(n int) RETURNS text LANGUAGE sql AS $$ SELECT set_config('request.jwt.claim.sub',pg_temp.i(n)::text,true) $$;
CREATE FUNCTION pg_temp.ok(ok boolean,msg text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Failed: %',msg; END IF; END $$;
CREATE FUNCTION pg_temp.fails(cmd text,expected text) RETURNS boolean LANGUAGE plpgsql AS $$ BEGIN EXECUTE cmd; RETURN false; EXCEPTION WHEN OTHERS THEN RETURN SQLSTATE=expected; END $$;
INSERT INTO auth.users(id) SELECT pg_temp.i(n) FROM generate_series(1,9) n;
INSERT INTO public.spawters(id,phone_e164,display_name) SELECT pg_temp.i(n),'+22577009800'||lpad(n::text,2,'0'),'Test '||n FROM generate_series(1,7) n;
INSERT INTO public.spawt_staff(id,email,display_name,role) VALUES(pg_temp.i(8),'moderator98@example.test','ModÃ©ration','moderator'),(pg_temp.i(9),'admin98@example.test','Admin','admin');
INSERT INTO public.places(id,name,descriptive_address,neighborhood,city,is_published)
VALUES(pg_temp.i(10),'Test visible','','','Abidjan',true),(pg_temp.i(11),'Test privÃ©','','','Abidjan',false),(pg_temp.i(12),'Test vide','','','Abidjan',true);
SELECT '{"services":["Brunch"],"sources":[{"label":"Site officiel","url":"https://example.test/","checked_on":"2026-01-01","fields":["services"]}]}' AS doc \gset
SET LOCAL ROLE authenticated;
SELECT pg_temp.who(1);
SELECT pg_temp.ok(pg_temp.fails('SELECT public.save_place_practical(pg_temp.i(10),0,''{}'',''draft'')','42501'),'ordinary person cannot edit');
SELECT pg_temp.who(8);
SELECT pg_temp.ok(public.save_place_practical(pg_temp.i(10),0,:'doc','draft')=1,'staff draft');
SELECT pg_temp.ok(pg_temp.fails('SELECT public.save_place_practical(pg_temp.i(10),0,''{}'',''draft'')','40001'),'stale writer rejected');
SELECT pg_temp.ok(pg_temp.fails('SELECT public.save_place_practical(pg_temp.i(10),1,''{}'',''publish'')','42501'),'moderator cannot publish');
RESET ROLE; SET LOCAL ROLE anon;
SELECT pg_temp.ok(NOT has_table_privilege('anon','public.place_practical_profiles','SELECT')
 AND NOT EXISTS(SELECT FROM public.public_place_practical WHERE place_id=pg_temp.i(10)),'no draft exposure');
RESET ROLE; SET LOCAL ROLE authenticated; SELECT pg_temp.who(9);
SELECT pg_temp.ok(pg_temp.fails('SELECT public.save_place_practical(pg_temp.i(10),1,''{"services":["Brunch"]}'',''publish'')','22023'),'source required');
SELECT pg_temp.ok(pg_temp.fails('SELECT public.save_place_practical(pg_temp.i(10),1,''{"social_links":[{"label":"Test","url":"javascript:1"}]}'',''draft'')','22023'),'only valid public links');
SELECT pg_temp.ok(public.save_place_practical(pg_temp.i(10),1,:'doc','publish')=2,'publish evidence');
SELECT pg_temp.ok(public.save_place_practical(pg_temp.i(11),0,:'doc','publish')=1,'private place retains its profile privately');
SELECT pg_temp.who(8);
SELECT pg_temp.ok(public.save_place_practical(pg_temp.i(10),2,'{}','draft')=3,'new draft leaves snapshot intact');
RESET ROLE;
INSERT INTO public.spawt_checkin(id,spawter_id,place_id,arrived_at,checked_in_at,left_at,check_in_type,session_duration_minutes,geolocation_lat,geolocation_lng,geolocation_source,distance_to_lieu_meters,is_verified,note_etoiles,texte_avis,note_cuisine,note_cadre,note_service,is_seed,seed_batch_id,is_cancelled,deleted_at,deleted_by_staff_id,deleted_reason)
 SELECT pg_temp.i(20+n),pg_temp.i(n),CASE WHEN n=6 THEN pg_temp.i(11) ELSE pg_temp.i(10) END,
 now()-interval '2 hours',now()-interval '100 minutes',now()-interval '1 hour','manual',40,5.35,-3.99,'gps',0,true,2,'Avis de la fixture isolÃ©e',
 CASE WHEN n=1 THEN 5 END,CASE WHEN n=1 THEN 4 END,CASE WHEN n=1 THEN 5 END,n=3,CASE WHEN n=3 THEN pg_temp.i(90) END,n=4,CASE WHEN n=5 THEN now() END,CASE WHEN n=5 THEN pg_temp.i(9) END,CASE WHEN n=5 THEN 'Test retrait' END FROM generate_series(1,6) n;
SET LOCAL ROLE anon;
SELECT pg_temp.ok((SELECT services='["Brunch"]'::jsonb AND payment_methods='[]'::jsonb FROM public.public_place_practical WHERE place_id=pg_temp.i(10))
 AND NOT EXISTS(SELECT FROM public.public_place_practical WHERE place_id=pg_temp.i(11)),'only a published snapshot and a published place are public');
SELECT pg_temp.ok((SELECT review_count=2 AND cuisine_avg=5 AND cadre_avg=4 AND service_avg=5 AND histogram=ARRAY[0,1,0,0,1]::bigint[] FROM public.public_place_review_stats WHERE place_id=pg_temp.i(10)),'visible non-seed reviews, rounded global rating, legacy review excluded from criterion means');
SELECT pg_temp.ok((SELECT review_count=0 AND cuisine_avg IS NULL AND histogram=ARRAY[0,0,0,0,0]::bigint[] FROM public.public_place_review_stats WHERE place_id=pg_temp.i(12))
 AND NOT EXISTS(SELECT FROM public.public_place_review_stats WHERE place_id=pg_temp.i(11)),'empty published venue and private venue');
RESET ROLE; SET LOCAL ROLE authenticated; SELECT pg_temp.who(9);
SELECT pg_temp.ok(public.save_place_practical(pg_temp.i(10),3,'{}','unpublish')=4,'withdraw');
RESET ROLE; SET LOCAL ROLE anon;
SELECT pg_temp.ok(NOT EXISTS(SELECT FROM public.public_place_practical WHERE place_id=pg_temp.i(10)),'withdrawn data inaccessible');
ROLLBACK;

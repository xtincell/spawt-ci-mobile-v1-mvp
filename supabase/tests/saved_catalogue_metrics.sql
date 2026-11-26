\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.i(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT md5('catalogue-fixture/'||n)::uuid $$;
CREATE FUNCTION pg_temp.who(n int) RETURNS text LANGUAGE sql AS $$ SELECT set_config('request.jwt.claim.sub',pg_temp.i(n)::text,true) $$;
CREATE FUNCTION pg_temp.check_that(ok boolean,msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Failed: %',msg; END IF; END $$;
CREATE FUNCTION pg_temp.refused(call_sql text, expected text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN EXECUTE call_sql; RETURN false; EXCEPTION WHEN OTHERS THEN RETURN SQLSTATE = expected; END $$;

INSERT INTO auth.users(id) SELECT pg_temp.i(i) FROM generate_series(1, 5) i;
INSERT INTO public.spawters(id,phone_e164,display_name,is_demo)
SELECT pg_temp.i(i),'+22577009500'||lpad(i::text,2,'0'),'Test favoris '||i,i=3 FROM generate_series(1,3) i;
INSERT INTO public.spawt_staff(id,email,display_name,role,is_active) VALUES
(pg_temp.i(4),'active@example.test','Test actif','moderator',true),
(pg_temp.i(5),'disabled@example.test','Test inactif','operator',false);
INSERT INTO public.cities(code,name,country,default_lat,default_lng,communes,is_active) VALUES
('qa_favoris','Ville test A','CI',5,-4,'[]',false),('qa_autre','Ville test B','CI',6,-4,'[]',false);
INSERT INTO public.places(id,name,city,city_code,neighborhood,descriptive_address,is_published)
VALUES (pg_temp.i(10),'Adresse A','Ville test A','qa_favoris','Quartier A','',true),
(pg_temp.i(11),'Adresse B','Ville test B','qa_autre','Quartier B','',true);
INSERT INTO public.menu_items(id,place_id,name,source_url,observed_on,is_published,dish_type) VALUES
(pg_temp.i(20),pg_temp.i(10),'Burger maison','https://example.test/menu',current_date,true,'burger'),
(pg_temp.i(21),pg_temp.i(10),'Spécialité du jour','https://example.test/menu',current_date,true,NULL),
(pg_temp.i(22),pg_temp.i(11),'Burger maison','https://example.test/menu',current_date,true,'burger');

SELECT pg_temp.check_that(NOT has_function_privilege('anon','public.admin_saved_catalogue(text,text)','EXECUTE')
 AND NOT has_function_privilege('anon','public.set_menu_item_rating(uuid,integer)','EXECUTE')
 AND NOT has_function_privilege('anon','public.my_menu_item_ratings()','EXECUTE')
 AND NOT has_table_privilege('authenticated','public.menu_item_ratings','SELECT,INSERT,UPDATE,DELETE'),'ACL');
SET LOCAL ROLE authenticated;
SELECT pg_temp.who(1);
SELECT pg_temp.check_that(pg_temp.refused('SELECT public.admin_saved_catalogue()', '42501'),'user cannot read staff metrics');
SELECT pg_temp.check_that(pg_temp.refused('SELECT public.set_menu_item_rating(pg_temp.i(20),0)', '22023')
 AND pg_temp.refused('SELECT public.set_menu_item_rating(pg_temp.i(20),6)', '22023')
 AND pg_temp.refused('SELECT public.set_menu_item_rating(pg_temp.i(30),3)', '22023'),'ratings validate dish and bounds');
SELECT public.set_menu_item_rating(pg_temp.i(20),4);
SELECT public.set_menu_item_rating(pg_temp.i(20),4);
SELECT public.set_menu_item_rating(pg_temp.i(20),5);
SELECT pg_temp.check_that((SELECT count(*) = 1 AND min(rating)=5 FROM public.my_menu_item_ratings()),'one editable own rating');
SELECT pg_temp.who(2);
SELECT pg_temp.check_that((SELECT count(*) = 0 FROM public.my_menu_item_ratings()),'own ratings are private');
SELECT pg_temp.who(5);
SELECT pg_temp.check_that(pg_temp.refused('SELECT public.admin_saved_catalogue()', '42501'),'inactive staff denied');
SELECT pg_temp.who(4);
SELECT public.admin_saved_catalogue('qa_favoris','burger') AS rated \gset
SELECT pg_temp.check_that(:'rated'::jsonb->'summary' @> '{"dish_saves":0,"place_saves":0,"rating_count":1}'
 AND :'rated'::jsonb->'dishes'->0->>'average_rating' = '5.00','rating creates no dish or place save');
SELECT pg_temp.who(1);
SELECT public.mutate_outing(pg_temp.i(30),'save',jsonb_build_object('menu_item_id',pg_temp.i(20)));
SELECT public.mutate_outing(pg_temp.i(30),'save',jsonb_build_object('menu_item_id',pg_temp.i(20)));
SELECT public.mutate_outing(pg_temp.i(31),'save',jsonb_build_object('menu_item_id',pg_temp.i(20)));
SELECT pg_temp.who(4);
SELECT public.admin_saved_catalogue('qa_favoris','burger') AS dish \gset
SELECT pg_temp.check_that(:'dish'::jsonb->'summary' @> '{"dish_saves":1,"unique_dishes":1,"dish_savers":1,"place_saves":0,"rating_count":1}',
 'replays and repeated dish saves do not create address saves or ratings');
SELECT pg_temp.who(1);
SELECT public.mutate_outing(pg_temp.i(32),'save',jsonb_build_object('place_id',pg_temp.i(10)));
SELECT public.mutate_outing(pg_temp.i(33),'save',jsonb_build_object('place_id',pg_temp.i(10)));
SELECT pg_temp.who(2);
SELECT public.mutate_outing(pg_temp.i(34),'save',jsonb_build_object('place_id',pg_temp.i(10)));
SELECT public.mutate_outing(pg_temp.i(35),'save',jsonb_build_object('menu_item_id',pg_temp.i(20)));
SELECT public.set_menu_item_rating(pg_temp.i(20),3);
SELECT public.mutate_outing(pg_temp.i(36),'save',jsonb_build_object('menu_item_id',pg_temp.i(21)));
SELECT public.mutate_outing(pg_temp.i(37),'save',jsonb_build_object('menu_item_id',pg_temp.i(22)));
SELECT pg_temp.who(3);
SELECT public.mutate_outing(pg_temp.i(38),'save',jsonb_build_object('place_id',pg_temp.i(10)));
SELECT public.mutate_outing(pg_temp.i(39),'save',jsonb_build_object('menu_item_id',pg_temp.i(20)));
SELECT public.set_menu_item_rating(pg_temp.i(20),1);
SELECT pg_temp.who(4);
SELECT public.admin_saved_catalogue('qa_favoris','burger') AS counts \gset
SELECT pg_temp.check_that(:'counts'::jsonb->'summary' = '{"dish_saves":2,"unique_dishes":1,"dish_savers":2,"place_saves":2,"unique_places":1,"place_savers":2,"rating_count":2}'
 AND :'counts'::jsonb->'places'->0->>'save_count'='2'
 AND jsonb_array_length(:'counts'::jsonb->'dishes')=1
 AND :'counts'::jsonb->'dishes'->0->>'average_rating'='4.00','real unique saves and human ratings by city and type');
SELECT pg_temp.check_that(public.admin_saved_catalogue('qa_autre','burger')->'dishes'->0->>'menu_item_id'=pg_temp.i(22)::text
 AND public.admin_saved_catalogue('qa_favoris','non_classe')->'dishes'->0->>'menu_item_id'=pg_temp.i(21)::text,'same name across cities and unclassified dishes');
SELECT pg_temp.who(2);
SELECT public.mutate_outing(pg_temp.i(40),'unsave',jsonb_build_object('menu_item_id',pg_temp.i(20)));
SELECT public.mutate_outing(pg_temp.i(41),'unsave',jsonb_build_object('place_id',pg_temp.i(10)));
SELECT pg_temp.who(4);
SELECT pg_temp.check_that(public.admin_saved_catalogue('qa_favoris','burger')->'summary' @> '{"dish_saves":1,"place_saves":1,"rating_count":2}','removals reduce current counters and preserve notes');
RESET ROLE;
UPDATE public.menu_items SET is_published=false WHERE id=pg_temp.i(20);
SET LOCAL ROLE authenticated;
SELECT pg_temp.who(1);
SELECT pg_temp.check_that(pg_temp.refused('SELECT public.set_menu_item_rating(pg_temp.i(20),4)', '22023'),'cannot rate a retired item');
SELECT public.set_menu_item_rating(pg_temp.i(20),NULL);
SELECT public.set_menu_item_rating(pg_temp.i(20),NULL);
SELECT pg_temp.who(4);
SELECT pg_temp.check_that(public.admin_saved_catalogue('qa_favoris','burger')->'summary' @> '{"dish_saves":1,"place_saves":1,"rating_count":1}','withdrawn rating preserves favorites');
ROLLBACK;

\set ON_ERROR_STOP on
BEGIN;
SET LOCAL TIME ZONE 'UTC';
CREATE FUNCTION pg_temp.id(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS 'SELECT md5(''pilot-fixture/''||n)::uuid';
CREATE FUNCTION pg_temp.ok(v boolean,n text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF v IS DISTINCT FROM true THEN RAISE EXCEPTION 'Échec: %',n; END IF; END $$;
CREATE FUNCTION pg_temp.claim_fails(k uuid,credential text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN PERFORM public.pilot_claim(k,credential); RETURN false;
 EXCEPTION WHEN raise_exception THEN RETURN SQLERRM='claim_unavailable'; END $$;
INSERT INTO auth.users(id) SELECT pg_temp.id(n) FROM generate_series(1,8) n;
INSERT INTO public.internal_phone_allowlist(phone_e164,note) VALUES('+22577000907','fixture locale');
INSERT INTO public.spawters(id,phone_e164,display_name,is_demo,is_internal)
 SELECT pg_temp.id(n),'+225770009'||lpad(n::text,2,'0'),'Fixture '||n,n=8,n=7 FROM generate_series(1,8) n;
INSERT INTO public.places(id,name,lat,lng,price_tier,descriptive_address,neighborhood,city,cuisine,is_published)
 VALUES(pg_temp.id(20),'Lieu A',5.3,-4,NULL,'','Cocody','Abidjan','{}',true),
       (pg_temp.id(21),'Lieu B',5.31,-4.01,NULL,'','Marcory','Abidjan','{}',true);
UPDATE pilot_private.batch SET person=pg_temp.id(1),recruitment='whatsapp' WHERE code='B01';
SELECT pg_temp.ok((SELECT count(*)=6 AND count(*) FILTER(WHERE selected)=2 FROM pilot_private.batch),'six codes privés');
SELECT pg_temp.ok(NOT has_schema_privilege('anon','pilot_private','usage') AND
 NOT has_function_privilege('anon','public.pilot_claim(uuid,text)','EXECUTE'),'aucune lecture ou attribution publique');
SET LOCAL ROLE anon;
SELECT public.pilot_campaign_touch(pg_temp.id(40),'arrival','facebook','paid_social','abidjan_beta_20261204','pancakes_v2') AS landing \gset
SELECT pg_temp.ok(:'landing'::jsonb->>'resume_token' IS NULL,'sans clic, pas de reprise');
SELECT public.pilot_campaign_touch(pg_temp.id(40),'download_click','facebook','paid_social','abidjan_beta_20261204','pancakes_v2') AS click \gset
SELECT pg_temp.ok((:'click'::jsonb->>'resume_code')~'^[A-F0-9]{12}$','code de secours distinct');
SELECT pg_temp.ok(:'click'::jsonb = public.pilot_campaign_touch(pg_temp.id(40),'download_click','instagram','paid_social','abidjan_beta_20261204','pancakes_v2'),'double clic immuable');
SELECT public.pilot_campaign_touch(pg_temp.id(41),'download_click','instagram','paid_social','abidjan_beta_20261204','pancakes_v2') AS insta \gset
SELECT public.pilot_campaign_touch(pg_temp.id(42),'download_click','facebook','paid_social','abidjan_beta_20261204','pancakes_v2') AS expired \gset
SELECT public.pilot_campaign_touch(pg_temp.id(43),'download_click','instagram','paid_social','abidjan_beta_20261204','pancakes_v2') AS preinstalled \gset
SELECT public.pilot_campaign_touch(pg_temp.id(44),'download_click','instagram','paid_social','abidjan_beta_20261204','pancakes_v2') AS missing_time \gset
SELECT clock_timestamp() AS first_ts \gset
SELECT public.pilot_app_open(pg_temp.id(31),pg_temp.id(51),:'first_ts',:'first_ts',false,:'first_ts');
SELECT public.pilot_app_open(pg_temp.id(31),pg_temp.id(51),:'first_ts',:'first_ts',false,:'first_ts');
SELECT public.pilot_app_open(pg_temp.id(31),pg_temp.id(61),:'first_ts'::timestamptz+interval '1 second',:'first_ts'::timestamptz+interval '2 seconds',false);
SELECT public.pilot_app_open(pg_temp.id(32),pg_temp.id(52),:'first_ts',:'first_ts',true);
SELECT public.pilot_app_open(pg_temp.id(33),pg_temp.id(53),:'first_ts',:'first_ts',false);
SELECT public.pilot_app_open(pg_temp.id(35),pg_temp.id(55),:'first_ts',:'first_ts',false,:'first_ts'::timestamptz-interval '2 days');
SELECT public.pilot_app_open(pg_temp.id(36),pg_temp.id(56),:'first_ts',:'first_ts',false);
RESET ROLE;
UPDATE pilot_private.journeys SET expires_at=clock_timestamp()-interval '1 second' WHERE id=(:'expired'::jsonb->>'journey_id')::uuid;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.id(1)::text,true);
SELECT public.pilot_bind_install(pg_temp.id(31));
SELECT pg_temp.ok((public.pilot_claim(pg_temp.id(31),:'click'::jsonb->>'resume_token')->>'acquisition')::boolean,'première ouverture attribuée tard par lien');
SELECT pg_temp.ok((public.pilot_claim(pg_temp.id(31),:'click'::jsonb->>'resume_code')->>'acquisition')::boolean,'reprise même compte/même install idempotente');
SELECT set_config('request.jwt.claim.sub',pg_temp.id(2)::text,true);
SELECT public.pilot_bind_install(pg_temp.id(32));
SELECT pg_temp.ok(pg_temp.claim_fails(pg_temp.id(32),:'click'::jsonb->>'resume_code'),'code déjà consommé autre personne');
SELECT pg_temp.ok(pg_temp.claim_fails(pg_temp.id(32),:'expired'::jsonb->>'resume_code'),'expiration');
SELECT pg_temp.ok(NOT (public.pilot_claim(pg_temp.id(32),:'insta'::jsonb->>'resume_code')->>'acquisition')::boolean,'réouverture par code appareil déjà équipé');
SELECT public.pilot_bind_install(pg_temp.id(31));
SELECT pg_temp.ok(pg_temp.claim_fails(pg_temp.id(31),:'click'::jsonb->>'resume_token'),'changement de compte');
SELECT set_config('request.jwt.claim.sub',pg_temp.id(3)::text,true);
SELECT public.pilot_bind_install(pg_temp.id(35));
SELECT pg_temp.ok(NOT (public.pilot_claim(pg_temp.id(35),:'preinstalled'::jsonb->>'resume_code')->>'acquisition')::boolean,'installé avant clic mais ouvert pour la première fois après');
SELECT set_config('request.jwt.claim.sub',pg_temp.id(4)::text,true);
SELECT public.pilot_bind_install(pg_temp.id(36));
SELECT pg_temp.ok(NOT (public.pilot_claim(pg_temp.id(36),:'missing_time'::jsonb->>'resume_code')->>'acquisition')::boolean,'date native absente');
RESET ROLE;
SELECT pg_temp.ok((SELECT acquired_installs=0 AND reopens=2 FROM pilot_private.funnel(:'first_ts'::timestamptz-interval '1 hour',:'first_ts'::timestamptz+interval '1 hour') WHERE origin='instagram'),'app déjà équipée avant le clic classée en réouverture, absence de preuve conservée inconnue');
SELECT pg_temp.ok((SELECT first_open_at=:'first_ts' AND NOT existing FROM pilot_private.installs WHERE secret=pg_temp.id(31)),'heure initiale conservée');
SELECT pg_temp.ok((SELECT count(*)=2 FROM pilot_private.opens o JOIN pilot_private.installs i ON i.id=o.install WHERE i.secret=pg_temp.id(31)),'replay ouverture');
SELECT pg_temp.ok(NOT EXISTS(SELECT FROM pilot_private.journeys j JOIN pilot_private.installs i ON i.id=j.install WHERE i.secret=pg_temp.id(33)),'sans code = aucun raccord');

-- Exercise ordered, durable RPCs; use a past synthetic week so the test runs before the real campaign.
SELECT set_config('request.jwt.claim.sub',pg_temp.id(1)::text,true);
SELECT public.pilot_place_view(pg_temp.id(31),pg_temp.id(101),pg_temp.id(20),'2020-11-28 00:00:00.001+00');
SELECT public.pilot_place_view(pg_temp.id(31),pg_temp.id(101),pg_temp.id(20),'2020-11-28 00:00:00.001+00');
SELECT pg_temp.ok((public.pilot_saved_place(pg_temp.id(31),pg_temp.id(102),pg_temp.id(20),'2020-11-28 00:00:00.002+00',true)->>'applied')::boolean,'confirmation après reprise réseau');
SELECT public.pilot_saved_place(pg_temp.id(31),pg_temp.id(103),pg_temp.id(20),'2020-11-28 00:00:00.003+00',false);
SELECT pg_temp.ok(NOT (public.pilot_saved_place(pg_temp.id(31),pg_temp.id(102),pg_temp.id(20),'2020-11-28 00:00:00.002+00',true)->>'saved')::boolean,'rejeu ne ressuscite pas favori');
SELECT pg_temp.ok(NOT (public.pilot_saved_place(pg_temp.id(31),pg_temp.id(104),pg_temp.id(20),'2020-11-28 00:00:00.001+00',true)->>'applied')::boolean,'geste en retard ignoré');
SELECT pg_temp.ok(NOT EXISTS(SELECT FROM public.saved_places WHERE place_id=pg_temp.id(20)),'état durable du retrait');
SELECT pg_temp.ok((SELECT count(*)=1 FROM pilot_private.usage WHERE event='saved_place_added'),'preuve de l’ajout maintenue');
SELECT pg_temp.ok(NOT (public.pilot_saved_place(pg_temp.id(31),pg_temp.id(107),pg_temp.id(21),'2020-11-28 00:00:00.006+00',false)->>'applied')::boolean,'retrait seul');
SELECT public.pilot_app_open(pg_temp.id(34),pg_temp.id(54),:'first_ts',:'first_ts',false);
SELECT public.pilot_bind_install(pg_temp.id(34));
SELECT public.pilot_place_view(pg_temp.id(34),pg_temp.id(105),pg_temp.id(21),'2020-11-29 08:01:00+00');
SELECT public.pilot_saved_place(pg_temp.id(34),pg_temp.id(106),pg_temp.id(21),'2020-11-29 08:02:00+00',true);
-- Decimal-day ordering, distinct people/places, population flags, no implied offline additions.
DO $$ DECLARE n int; k uuid; pid uuid; BEGIN
 FOR n IN 2..8 LOOP
  k:=pg_temp.id(200+n); pid:=pg_temp.id(n);
  PERFORM set_config('request.jwt.claim.sub',pid::text,true);
  PERFORM public.pilot_app_open(k,pg_temp.id(300+n),'2020-11-28Z','2020-11-28Z',false);
  PERFORM public.pilot_bind_install(k);
  IF n<>3 THEN PERFORM public.pilot_place_view(k,pg_temp.id(400+n),pg_temp.id(20),'2020-11-29 08:00:00+00'); END IF;
  IF n<>2 THEN
   PERFORM public.pilot_saved_place(k,pg_temp.id(500+n),
    CASE WHEN n=4 THEN pg_temp.id(21) ELSE pg_temp.id(20) END,
    CASE WHEN n=5 THEN '2020-11-28 09:00:00+00'::timestamptz WHEN n=6 THEN '2020-12-05 00:00:00+00'::timestamptz
    ELSE '2020-11-29 09:00:00+00'::timestamptz END,true);
  END IF;
 END LOOP;
END $$;
SELECT pg_temp.ok((SELECT count(*)=1 AND min(origin)='whatsapp' FROM pilot_private.activations('2020-11-28Z','2020-12-05Z')),
 'même personne, même lieu, dans l’ordre, deux appareils/lieux dédupliqués, borne fin exclue, démo et interne exclus');
SELECT pg_temp.ok((SELECT count(*)=0 FROM pilot_private.usage WHERE event='spawt_confirmed'),'spawt local = zéro');
INSERT INTO public.spawt_checkin(id,spawter_id,place_id,arrived_at,checked_in_at,check_in_type,geolocation_source)
 VALUES(pg_temp.id(900),pg_temp.id(1),pg_temp.id(21),'2020-11-29 08:00:00+00','2020-11-29 08:02:00+00','manual','manual');
SELECT pg_temp.ok((SELECT count(*)=1 FROM pilot_private.usage WHERE event='spawt_confirmed' AND beta_code='B01' AND spawt_id=pg_temp.id(900)), 'spawt serveur au lieu effectivement visité');
SELECT pg_temp.ok((SELECT sum(active_people)=1 FROM pilot_private.funnel('2020-11-28Z','2020-12-05Z')),'attribution exclusive de la première paire qualifiante');
\if :{?example}
COPY (SELECT at_utc,person_id,place_id,event,population,origin,beta_code,spawt_id,journey_id FROM pilot_private.usage WHERE beta_code='B01' ORDER BY at_utc) TO STDOUT WITH CSV HEADER;
\endif
ROLLBACK;


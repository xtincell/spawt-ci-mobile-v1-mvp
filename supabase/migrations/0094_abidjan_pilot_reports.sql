BEGIN;
-- Only reporting views are granted. Never export visit capabilities or account IDs.
CREATE TABLE pilot_private.salt(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), value uuid NOT NULL);
INSERT INTO pilot_private.salt(value) VALUES(gen_random_uuid());
CREATE VIEW pilot_private.people AS
SELECT s.id AS person, encode(sha256(convert_to(secret.value::text||':'||s.id::text,'UTF8')), 'hex') AS alias,
 CASE WHEN s.is_demo THEN 'demo' WHEN s.is_internal OR s.is_seed OR s.is_banned OR staff.id IS NOT NULL THEN 'interne'
      WHEN b.code IS NOT NULL THEN 'beta_externe' ELSE 'externe' END AS population,
 b.code,b.recruitment
FROM public.spawters s CROSS JOIN pilot_private.salt secret
LEFT JOIN public.spawt_staff staff ON staff.id=s.id
LEFT JOIN pilot_private.batch b ON b.person=s.id;

CREATE VIEW pilot_private.usage AS
SELECT a.action_at AS at_utc,p.alias AS person_id,a.place_id,a.kind AS event,p.population,
 coalesce(j.source,nullif(p.recruitment,'unknown'),'unknown') AS origin,p.code AS beta_code,
 NULL::uuid AS spawt_id,j.id AS journey_id
FROM pilot_private.actions a JOIN pilot_private.people p ON p.person=a.person
LEFT JOIN pilot_private.journeys j ON j.install=a.install AND j.person=a.person AND j.clicked_at<=a.action_at
WHERE a.applied
UNION ALL
-- Presence on the server is necessary. The independent question of an actual
-- outing is recorded by the field team, not inferred from an app identifier.
SELECT c.checked_in_at,p.alias,c.place_id,'spawt_confirmed',p.population,
 coalesce(nullif(p.recruitment,'unknown'),'unknown'),p.code,c.id,NULL::uuid
FROM public.spawt_checkin c JOIN pilot_private.people p ON p.person=c.spawter_id
WHERE c.checked_in_at IS NOT NULL AND NOT c.is_seed AND NOT c.is_cancelled
 AND c.deleted_at IS NULL AND c.check_in_type IN ('active','manual');

CREATE FUNCTION pilot_private.activations(start_at timestamptz,end_at timestamptz)
RETURNS TABLE(person_id text,place_id uuid,activated_at timestamptz,origin text)
LANGUAGE sql STABLE SET search_path='' AS $$
 WITH eligible AS (
   SELECT * FROM pilot_private.usage WHERE at_utc>=start_at AND at_utc<end_at
    AND population IN ('externe','beta_externe') AND event IN ('place_viewed','saved_place_added')
 )
 SELECT DISTINCT ON (s.person_id) s.person_id,s.place_id,s.at_utc,s.origin
 FROM eligible s
 WHERE s.event='saved_place_added' AND EXISTS(SELECT FROM eligible v WHERE v.event='place_viewed'
   AND v.person_id=s.person_id AND v.place_id=s.place_id AND v.at_utc<s.at_utc)
 ORDER BY s.person_id,s.at_utc,s.place_id,s.origin;
$$;

CREATE FUNCTION pilot_private.funnel(start_at timestamptz,end_at timestamptz)
RETURNS TABLE(origin text,arrivals bigint,download_clicks bigint,first_opens bigint,acquired_installs bigint,
 reopens bigint,viewers bigint,savers bigint,active_people bigint,spawters bigint)
LANGUAGE sql STABLE SET search_path='' AS $$
 WITH sources(origin) AS (VALUES ('facebook'),('instagram'),('unknown'),('whatsapp'),('other')),
 valid_journeys AS (
   SELECT j.* FROM pilot_private.journeys j LEFT JOIN pilot_private.people p ON p.person=j.person
   WHERE j.person IS NULL OR p.population IN ('externe','beta_externe')
 ), j_events AS (
   SELECT source,
    count(*) FILTER(WHERE arrived_at>=start_at AND arrived_at<end_at) AS arrivals,
    count(*) FILTER(WHERE clicked_at>=start_at AND clicked_at<end_at) AS clicks
   FROM valid_journeys GROUP BY source
 ), eligible_installs AS (
   SELECT i.*,j.source,j.acquisition,j.clicked_at FROM pilot_private.installs i
   LEFT JOIN valid_journeys j ON j.install=i.id
   LEFT JOIN pilot_private.people p ON p.person=i.first_owner
   WHERE i.first_owner IS NULL OR p.population IN ('externe','beta_externe')
 ), firsts AS (
   SELECT CASE WHEN acquisition THEN source ELSE 'unknown' END AS source,
    count(*) AS firsts,count(*) FILTER(WHERE acquisition) AS acquired
   FROM eligible_installs WHERE NOT existing AND first_open_at>=start_at AND first_open_at<end_at GROUP BY 1
 ), returns AS (
   SELECT CASE WHEN i.clicked_at<=o.opened_at THEN i.source ELSE 'unknown' END AS source,count(DISTINCT i.id) AS opens
   FROM eligible_installs i JOIN pilot_private.opens o ON o.install=i.id
   WHERE (i.existing OR o.opened_at>i.first_open_at OR (i.installed_at<i.clicked_at AND o.opened_at>=i.clicked_at))
     AND o.opened_at>=start_at AND o.opened_at<end_at GROUP BY 1
 ), activity AS (
   SELECT u.origin,count(DISTINCT u.person_id) FILTER(WHERE u.event='place_viewed') AS viewers,
    count(DISTINCT u.person_id) FILTER(WHERE u.event='saved_place_added') AS savers,
    count(DISTINCT u.person_id) FILTER(WHERE u.event='spawt_confirmed') AS spawters
   FROM pilot_private.usage u WHERE u.at_utc>=start_at AND u.at_utc<end_at AND u.population IN ('externe','beta_externe') GROUP BY u.origin
 ), actives AS (SELECT a.origin,count(*) n FROM pilot_private.activations(start_at,end_at) a GROUP BY a.origin)
 SELECT s.origin,coalesce(j.arrivals,0),coalesce(j.clicks,0),coalesce(f.firsts,0),coalesce(f.acquired,0),
  coalesce(r.opens,0),coalesce(a.viewers,0),coalesce(a.savers,0),coalesce(x.n,0),coalesce(a.spawters,0)
 FROM sources s LEFT JOIN j_events j ON j.source=s.origin LEFT JOIN firsts f ON f.source=s.origin
 LEFT JOIN returns r ON r.source=s.origin LEFT JOIN activity a ON a.origin=s.origin LEFT JOIN actives x ON x.origin=s.origin;
$$;
-- Reporting statements run in a privileged SQL session. PostgREST only exposes public RPCs.
NOTIFY pgrst,'reload schema';
COMMIT;


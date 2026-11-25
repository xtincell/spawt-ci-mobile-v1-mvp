\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\pset format unaligned
SET TIME ZONE 'UTC';
-- Runner artifact. Only explicitly reserved synthetic account IDs are accepted.
WITH scenarios(label,person) AS (VALUES
 ('facebook','bca00447-1056-4bf0-a9e0-202600000001'::uuid),
 ('instagram','bca00447-1056-4bf0-a9e0-202600000002'::uuid),
 ('upgrade42','bca00447-1056-4bf0-a9e0-202600000003'::uuid),
 ('rush_demo','bca00447-1056-4bf0-a9e0-202600000004'::uuid)),
reports AS (
 SELECT s.label,p.alias AS person,p.population,s.person AS uid,
  (SELECT coalesce(jsonb_agg(jsonb_build_object('installation',i.id,'installed_at',i.installed_at,'first_open',i.first_open_at,
   'already_installed',i.existing,'observed_opens',(SELECT jsonb_agg(o.opened_at ORDER BY o.opened_at) FROM pilot_private.opens o WHERE o.install=i.id)) ORDER BY i.first_open_at),'[]'::jsonb)
   FROM pilot_private.bindings b JOIN pilot_private.installs i ON i.id=b.install WHERE b.person=s.person) AS installations,
  (SELECT coalesce(jsonb_agg(jsonb_build_object('journey',j.id,'source',j.source,'campaign',j.campaign,'creative',j.creative,
   'arrival',j.arrived_at,'download_click',j.clicked_at,'claimed',j.claimed_at,'place',j.destination,'acquisition',j.acquisition)
   ORDER BY j.arrived_at),'[]'::jsonb) FROM pilot_private.journeys j WHERE j.person=s.person) AS journeys,
  (SELECT coalesce(jsonb_agg(jsonb_build_object('install',a.install,'place',a.place_id,'event',a.kind,'action_at',a.action_at,
   'received_at',a.received_at,'applied',a.applied) ORDER BY a.action_at,a.received_at),'[]'::jsonb)
   FROM pilot_private.actions a WHERE a.person=s.person) AS actions,
  (SELECT coalesce(jsonb_agg(sp.place_id ORDER BY sp.place_id),'[]'::jsonb) FROM public.saved_places sp WHERE sp.spawter_id=s.person) AS favorites
 FROM scenarios s JOIN pilot_private.people p ON p.person=s.person AND p.population IN ('interne','demo')
)
SELECT jsonb_pretty(jsonb_build_object('scope','isolated synthetic accounts','export_utc',clock_timestamp(),
 'unclaimed_journeys',(SELECT count(*) FROM pilot_private.journeys WHERE person IS NULL),
 'unbound_installations',(SELECT count(*) FROM pilot_private.installs i WHERE NOT EXISTS(SELECT FROM pilot_private.bindings b WHERE b.install=i.id)),
 'server_opens',(SELECT count(*) FROM pilot_private.opens),
 'runs',coalesce(jsonb_agg(to_jsonb(r)-'uid' ORDER BY label),'[]'::jsonb))) FROM reports r;

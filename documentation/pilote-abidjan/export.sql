\set ON_ERROR_STOP on
\pset footer off
BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL TIME ZONE 'Africa/Abidjan';
CREATE TEMP VIEW pilot_window AS
 SELECT timestamptz '2026-11-28 00:00:00 Africa/Abidjan' debut, timestamptz '2026-12-05 00:00:00 Africa/Abidjan' fin;
CREATE TEMP VIEW usage_export AS
 SELECT to_char(u.at_utc AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS heure_utc,
 u.person_id AS id_personne_pseudonymise,u.place_id AS id_lieu,u.event AS evenement,u.population,
 CASE u.origin WHEN 'unknown' THEN 'Inconnu' ELSE u.origin END AS origine_prouvee,
 u.beta_code AS code_beta,u.spawt_id AS id_spawt_serveur,u.journey_id AS id_parcours_attribue
 FROM pilot_private.usage u,pilot_window w WHERE u.at_utc>=w.debut AND u.at_utc<w.fin;
\copy (SELECT * FROM usage_export ORDER BY heure_utc,id_personne_pseudonymise,evenement) TO 'usage.csv' WITH (FORMAT CSV, HEADER, ENCODING 'UTF8')
\copy (SELECT f.* FROM pilot_window w CROSS JOIN LATERAL pilot_private.funnel(w.debut,w.fin) f) TO 'etapes-par-origine.csv' WITH (FORMAT CSV, HEADER, ENCODING 'UTF8')
\copy (SELECT w.debut,w.fin,0 AS baseline_declaree,150 AS objectif,(SELECT count(*) FROM pilot_private.activations(w.debut,w.fin)) AS actifs_distincts,clock_timestamp() AS exporte_le FROM pilot_window w) TO 'jalon.csv' WITH (FORMAT CSV, HEADER, ENCODING 'UTF8')
CREATE TEMP VIEW batch_export AS
 SELECT b.code AS code_beta,CASE WHEN b.person IS NOT NULL THEN 'identifié' WHEN b.selected THEN 'sélectionné · compte à relier' ELSE 'à identifier' END AS recrutement,
 coalesce(b.recruitment,'Inconnu') AS origine_recrutement,p.alias AS id_personne_pseudonymise,
 CASE WHEN b.person IS NULL THEN '' WHEN EXISTS(SELECT FROM pilot_private.bindings d WHERE d.person=b.person)
  THEN 'ouverture associée au compte' ELSE 'à constater' END AS app,
 CASE WHEN a.person_id IS NULL THEN '' ELSE to_char(a.activated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END AS paire_vue_favori_utc,
 a.place_id AS lieu_paire,sv.spawt_id AS id_spawt_serveur,sv.place_id AS lieu_spawt,
 b.blocker AS blocage,'à constater par l’équipe terrain'::text AS preuve_sortie
 FROM pilot_private.batch b CROSS JOIN pilot_window w LEFT JOIN pilot_private.people p ON p.person=b.person
 LEFT JOIN LATERAL (SELECT * FROM pilot_private.activations(w.debut,w.fin) q WHERE q.person_id=p.alias) a ON true
 LEFT JOIN LATERAL (SELECT u.spawt_id,u.place_id FROM pilot_private.usage u WHERE u.person_id=p.alias AND u.event='spawt_confirmed'
  AND u.at_utc>=w.debut AND u.at_utc<w.fin ORDER BY u.at_utc,u.spawt_id LIMIT 1) sv ON true;
\copy (SELECT * FROM batch_export ORDER BY code_beta) TO 'batch-terrain.csv' WITH (FORMAT CSV, HEADER, ENCODING 'UTF8')
COMMIT;

-- Story 4.1 — Seed feature_flags pour `guet-geofence` (Sprint 1 kill-switch).
-- Câblage MVP : l'orchestrateur étant livré bout-en-bout, beta passe à true
-- (rollout : internal/alpha/beta actifs, prod désactivé jusqu'au lancement).
-- Story 1.8 a livré la table feature_flags + hook useFlag.
--
-- ⚠️ ON CONFLICT DO NOTHING : sur une base déjà seedée, ce fichier ne modifie
-- rien. Pour flipper le flag sur le projet live, exécuter :
--   UPDATE feature_flags SET enabled = true
--   WHERE flag_code = 'guet-geofence' AND scope = 'beta' AND spawter_id IS NULL;

INSERT INTO feature_flags (flag_code, scope, enabled, spawter_id)
VALUES
  ('guet-geofence', 'internal', true, NULL),
  ('guet-geofence', 'alpha', true, NULL),
  ('guet-geofence', 'beta', true, NULL),
  ('guet-geofence', 'prod', false, NULL)
ON CONFLICT DO NOTHING;

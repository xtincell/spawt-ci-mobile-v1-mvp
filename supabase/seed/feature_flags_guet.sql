-- Story 4.1 — Seed feature_flags pour `guet-geofence` (Sprint 1 kill-switch).
-- Scopes : internal/alpha actifs (test équipe), beta/prod désactivés (rollout progressif).
-- Story 1.8 a livré la table feature_flags + hook useFlag.

INSERT INTO feature_flags (flag_code, scope, enabled, spawter_id)
VALUES
  ('guet-geofence', 'internal', true, NULL),
  ('guet-geofence', 'alpha', true, NULL),
  ('guet-geofence', 'beta', false, NULL),
  ('guet-geofence', 'prod', false, NULL)
ON CONFLICT DO NOTHING;

-- Phase 2 F14 — Seed du flag paywall-geo (kill-switch, OFF partout).
-- À activer quand l'abonnement Spawter Gold (CinetPay) sera branché —
-- étude de marché §Risque A : pas de paywall sans moyen de payer.

INSERT INTO feature_flags (flag_code, scope, enabled, spawter_id)
VALUES
  ('paywall-geo', 'internal', false, NULL),
  ('paywall-geo', 'alpha', false, NULL),
  ('paywall-geo', 'beta', false, NULL),
  ('paywall-geo', 'prod', false, NULL)
ON CONFLICT DO NOTHING;

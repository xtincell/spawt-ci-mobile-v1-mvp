-- Migration 0027 — Autoriser le tiret dans feature_flags.flag_code
-- Date: 2026-07-01 (appliquée au live le jour même via MCP)
-- Contexte: câblage MVP. L'app (geofence.ts) et le seed lisent/écrivent
-- 'guet-geofence' (tiret) mais la contrainte 0004 n'autorisait que [a-z0-9_] —
-- le seed du flag n'a donc jamais pu s'appliquer en live et le kill-switch
-- était inopérant. On aligne la contrainte sur l'usage réel du code.

ALTER TABLE public.feature_flags DROP CONSTRAINT feature_flags_flag_code_check;
ALTER TABLE public.feature_flags ADD CONSTRAINT feature_flags_flag_code_check
  CHECK (length(flag_code) >= 1 AND length(flag_code) <= 64 AND flag_code ~ '^[a-z0-9_-]+$');

INSERT INTO public.feature_flags (flag_code, scope, enabled, spawter_id)
VALUES
  ('guet-geofence', 'internal', true, NULL),
  ('guet-geofence', 'alpha', true, NULL),
  ('guet-geofence', 'beta', true, NULL),
  ('guet-geofence', 'prod', true, NULL)
ON CONFLICT DO NOTHING;

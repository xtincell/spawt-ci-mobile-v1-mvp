-- ============================================================================
-- Seed 0001 — Currencies + Plans Sprint 1
-- ============================================================================
-- À exécuter APRÈS migration 0002. Idempotent (ON CONFLICT DO NOTHING).
-- Sprint 1 : un seul currency actif (XOF, CI). Plans gold_monthly / gold_annual.

INSERT INTO public.currencies (code, label, base_rate, modifier, country_code, is_active)
VALUES
  ('XOF', 'Franc CFA (BCEAO)',       0.00165, 1, 'CI', true),
  ('USD', 'Dollar US',                1.00000, 1, 'CI', false),
  ('EUR', 'Euro',                     1.08000, 1, 'CI', false),
  ('NGN', 'Naira nigérian',           0.00065, 1, 'NG', false),
  ('GHS', 'Cedi ghanéen',             0.06700, 1, 'GH', false)
ON CONFLICT (code) DO NOTHING;

-- Plans Sprint 1 — Gold (Premium SPAWT). Pricing PRD §11.
INSERT INTO public.plans (code, label, price_ht, currency_code, country_code, period, is_active)
VALUES
  ('gold_monthly', 'Gold mensuel',  2500,  'XOF', 'CI', 'monthly', true),
  ('gold_annual',  'Gold annuel',   22000, 'XOF', 'CI', 'annual',  true)
ON CONFLICT (code) DO NOTHING;

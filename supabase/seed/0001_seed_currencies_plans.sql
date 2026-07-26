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
-- ⚠️ Prix annuel : 25 000 F HT (PRD §11.2, « prix annuel corrigé : 25 000,
-- 2 mois offerts ») — l'ancien 22 000 était un reliquat pré-arbitrage.
-- Source de vérité runtime du checkout : _shared/payment/types.ts (alignés).
-- L'UPDATE rattrape les bases déjà seedées (le ON CONFLICT DO NOTHING
-- n'aurait jamais corrigé une ligne existante).
INSERT INTO public.plans (code, label, price_ht, currency_code, country_code, period, is_active)
VALUES
  ('gold_monthly', 'Gold mensuel',  2500,  'XOF', 'CI', 'monthly', true),
  ('gold_annual',  'Gold annuel',   25000, 'XOF', 'CI', 'annual',  true)
ON CONFLICT (code) DO NOTHING;

UPDATE public.plans SET price_ht = 25000
WHERE code = 'gold_annual' AND price_ht = 22000;

-- Plans B2B (lieux) — Sprint 2 : souscription en ligne via le portail /pro.
-- Prix PRD (HT, convention d'affichage B2B : HT + TVA 18 % en sus) :
--   pro      : 15 000 F HT/mois → 17 700 TTC
--   b2b_gold : 65 000 F HT/mois → 76 700 TTC
-- Codes alignés sur le CHECK subscriptions.plan (0032) et sur
-- _shared/payment/types.ts (B2B_PLAN_PRICING, source de vérité runtime).
INSERT INTO public.plans (code, label, price_ht, currency_code, country_code, period, is_active)
VALUES
  ('pro',      'Spawt Pro — lieu',  15000, 'XOF', 'CI', 'monthly', true),
  ('b2b_gold', 'Spawt Gold — lieu', 65000, 'XOF', 'CI', 'monthly', true)
ON CONFLICT (code) DO NOTHING;

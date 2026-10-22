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
-- ⚠️ Depuis la migration 0079, les prix vivent dans `plans.price_ttc` (prix
-- payé, administré depuis la page Tarifs de la console) ; HT et TVA en sont
-- dérivés. Les HT ci-dessous ne servent qu'à amorcer une base neuve : 0063
-- puis 0079 posent ensuite les prix réels, et un seed rejoué après 0079 ne
-- modifie rien (ON CONFLICT DO NOTHING ; le trigger 0079 reconstitue le prix
-- payé d'une ligne insérée avec son seul HT).
-- Prix annuel : 25 000 F HT (PRD §11.2, « prix annuel corrigé : 25 000,
-- 2 mois offerts ») — l'ancien 22 000 était un reliquat pré-arbitrage.
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
-- HT d'amorçage (historiques) : pro 15 000, b2b_gold 65 000. Prix en vigueur
-- après 0079 : pro 17 700 F payés, Gold lieu 60 000 F payés, prix final
-- (décision du 18/10/2026) — puis ceux de la page Tarifs.
-- Codes alignés sur le CHECK subscriptions.plan (0032) et sur les codes de
-- _shared/payment/types.ts (PaidPlan), qui ne porte plus aucun montant.
INSERT INTO public.plans (code, label, price_ht, currency_code, country_code, period, is_active)
VALUES
  ('pro',      'Spawt Pro — lieu',  15000, 'XOF', 'CI', 'monthly', true),
  ('b2b_gold', 'Spawt Gold — lieu', 65000, 'XOF', 'CI', 'monthly', true)
ON CONFLICT (code) DO NOTHING;

-- Tests SQL de la migration 0079 — tarifs : le prix payé d'abord.
-- Exécution : psql -v ON_ERROR_STOP=1 -f supabase/tests/gold_lieu_prix_final.sql
-- Autonome : crée ses propres comptes (admin, modérateur, payeurs), tout en
-- BEGIN/ROLLBACK. Une assertion ratée lève « ASSERT FAIL » et arrête le script.
-- À jouer juste après 0079 : A vérifie le remplissage, qu'un changement de
-- prix depuis la console rendrait faux ensuite.
--
-- Ce que ces tests protègent :
--   A. le remplissage : aucun montant payé ne change, sauf Gold lieu (60 000) ;
--   B. la dérivation : 60 000 → 50 847 HT + 9 153 TVA, quel que soit l'écrivain ;
--   C. la lecture : un plan désactivé n'est visible que du staff, et personne
--      n'écrit directement dans `plans` ;
--   D. l'écriture : admin_update_plan refusée hors admin (42501), bornée,
--      journalisée avant/après ;
--   E. la facture : approve_payment_request facture 60 000 pile pour Gold lieu ;
--   F. le figé : un nouveau prix ne touche ni les abonnements ni les factures
--      émis, et un plan désactivé ne se valide plus.

\set ON_ERROR_STOP on

BEGIN;

-- ── Fixtures ────────────────────────────────────────────────────────────────
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
VALUES
  ('dddd0000-0000-4000-8000-0000000079a1','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','t0079-admin@spawt.local','',now(),now(),now()),
  ('dddd0000-0000-4000-8000-0000000079a2','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','t0079-modo@spawt.local','',now(),now(),now()),
  ('dddd0000-0000-4000-8000-0000000079b1','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','t0079-lieu@phone.spawt.local','',now(),now(),now()),
  ('dddd0000-0000-4000-8000-0000000079c1','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','t0079-spawter@phone.spawt.local','',now(),now(),now());
INSERT INTO public.spawt_staff (id, email, display_name, role, is_active)
VALUES
  ('dddd0000-0000-4000-8000-0000000079a1','t0079-admin@spawt.local','Admin 0079','admin',true),
  ('dddd0000-0000-4000-8000-0000000079a2','t0079-modo@spawt.local','Modo 0079','moderator',true);
INSERT INTO public.spawters (id, phone_e164, display_name, country_code)
VALUES
  ('dddd0000-0000-4000-8000-0000000079b1','+22577007901','Maquis 0079','CI'),
  ('dddd0000-0000-4000-8000-0000000079c1','+22577007902','Spawter 0079','CI');

-- ── A. Le remplissage ───────────────────────────────────────────────────────
DO $x$
DECLARE
  r RECORD;
  v RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
      ('gold_monthly',  2950,  2500,  450, 'monthly'),
      ('gold_annual',  29500, 25000, 4500, 'annual'),
      ('pro',          17700, 15000, 2700, 'monthly'),
      ('b2b_gold',     60000, 50847, 9153, 'monthly')) AS t(code, ttc, ht, tva, period)
  LOOP
    SELECT price_ttc, price_ht, tva_amount, period INTO v FROM public.plans WHERE code = r.code;
    IF NOT FOUND OR v.price_ttc IS DISTINCT FROM r.ttc OR v.price_ht IS DISTINCT FROM r.ht OR v.tva_amount IS DISTINCT FROM r.tva
       OR v.period IS DISTINCT FROM r.period THEN
      RAISE EXCEPTION 'ASSERT FAIL A: % attendu % TTC / % HT / % TVA / %, trouvé %',
        r.code, r.ttc, r.ht, r.tva, r.period, v;
    END IF;
  END LOOP;
  -- La migration a journalisé le seul HT qui change, sans auteur.
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_audit_log a JOIN public.plans p ON p.id = a.entity_id
     WHERE p.code = 'b2b_gold' AND a.action = 'plan_update' AND a.spawt_staff_id IS NULL
       AND (a.payload_before->>'price_ht')::numeric = 65000
       AND (a.payload_after->>'price_ttc')::int = 60000
  ) THEN
    RAISE EXCEPTION 'ASSERT FAIL A: changement Gold lieu non journalisé par la migration';
  END IF;
  RAISE NOTICE 'A OK — 2 950 / 29 500 / 17 700 inchangés, Gold lieu 60 000 = 50 847 + 9 153, journalisé';
END
$x$;

-- Les scénarios suivants valident des demandes : leurs plans doivent être
-- actifs dans la base testée (annulé au ROLLBACK).
UPDATE public.plans SET is_active = true WHERE code IN ('gold_monthly', 'b2b_gold');

-- ── B. La dérivation, quel que soit l'écrivain ──────────────────────────────
DO $x$
DECLARE
  v RECORD;
BEGIN
  -- B1. Le prix payé est la saisie.
  UPDATE public.plans SET price_ttc = 55000 WHERE code = 'b2b_gold';
  SELECT price_ht, tva_amount INTO v FROM public.plans WHERE code = 'b2b_gold';
  IF v.price_ht IS DISTINCT FROM 46610 OR v.tva_amount IS DISTINCT FROM 8390 THEN
    RAISE EXCEPTION 'ASSERT FAIL B1: 55 000 → 46 610 + 8 390 attendu, trouvé %', v;
  END IF;
  UPDATE public.plans SET price_ttc = 60000 WHERE code = 'b2b_gold';
  SELECT price_ht, tva_amount INTO v FROM public.plans WHERE code = 'b2b_gold';
  IF v.price_ht IS DISTINCT FROM 50847 OR v.tva_amount IS DISTINCT FROM 9153 THEN
    RAISE EXCEPTION 'ASSERT FAIL B1: 60 000 → 50 847 + 9 153 attendu, trouvé %', v;
  END IF;

  -- B2. La TVA ne se saisit pas.
  UPDATE public.plans SET tva_amount = 1 WHERE code = 'b2b_gold';
  IF (SELECT tva_amount FROM public.plans WHERE code = 'b2b_gold') IS DISTINCT FROM 9153 THEN
    RAISE EXCEPTION 'ASSERT FAIL B2: une TVA saisie à la main a été conservée';
  END IF;

  -- B3. Écrivain historique qui ne pose que le HT : TTC = HT + TVA arrondie.
  UPDATE public.plans SET price_ht = 20000 WHERE code = 'pro';
  SELECT price_ttc, price_ht, tva_amount INTO v FROM public.plans WHERE code = 'pro';
  IF v.price_ttc IS DISTINCT FROM 23600 OR v.price_ht IS DISTINCT FROM 20000 OR v.tva_amount IS DISTINCT FROM 3600 THEN
    RAISE EXCEPTION 'ASSERT FAIL B3: HT 20 000 → 23 600 TTC attendu, trouvé %', v;
  END IF;
  UPDATE public.plans SET price_ttc = 17700 WHERE code = 'pro';

  -- B4. INSERT avec le seul HT (motif du seed 0001), puis avec le seul TTC.
  INSERT INTO public.plans (code, label, price_ht, currency_code, country_code, period, is_active)
  VALUES ('t0079_ht', 'Test HT', 1111, 'XOF', 'CI', 'monthly', false);
  SELECT price_ttc, price_ht, tva_amount INTO v FROM public.plans WHERE code = 't0079_ht';
  IF v.price_ttc IS DISTINCT FROM 1311 OR v.price_ht IS DISTINCT FROM 1111 OR v.tva_amount IS DISTINCT FROM 200 THEN
    RAISE EXCEPTION 'ASSERT FAIL B4: HT 1 111 → 1 311 TTC attendu, trouvé %', v;
  END IF;
  INSERT INTO public.plans (code, label, price_ttc, currency_code, country_code, period, is_active)
  VALUES ('t0079_ttc', 'Test TTC', 60000, 'XOF', 'CI', 'monthly', false);
  SELECT price_ttc, price_ht, tva_amount INTO v FROM public.plans WHERE code = 't0079_ttc';
  IF v.price_ht IS DISTINCT FROM 50847 OR v.tva_amount IS DISTINCT FROM 9153 THEN
    RAISE EXCEPTION 'ASSERT FAIL B4: TTC 60 000 → 50 847 + 9 153 attendu, trouvé %', v;
  END IF;

  -- B5. Rejouer le seed 0001 (HT seul, ON CONFLICT DO NOTHING) ne casse rien.
  INSERT INTO public.plans (code, label, price_ht, currency_code, country_code, period, is_active)
  VALUES ('b2b_gold', 'Spawt Gold — lieu', 65000, 'XOF', 'CI', 'monthly', true)
  ON CONFLICT (code) DO NOTHING;
  IF (SELECT price_ttc FROM public.plans WHERE code = 'b2b_gold') IS DISTINCT FROM 60000 THEN
    RAISE EXCEPTION 'ASSERT FAIL B5: le seed rejoué a modifié Gold lieu';
  END IF;

  -- B6. Un prix payé négatif est refusé.
  BEGIN
    UPDATE public.plans SET price_ttc = -5 WHERE code = 't0079_ttc';
    RAISE EXCEPTION 'ASSERT FAIL B6: prix payé négatif accepté';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  RAISE NOTICE 'B OK — dérivation TTC → HT/TVA, écrivains HT historiques, seed rejouable, négatif refusé';
END
$x$;

-- ── C. La lecture, et aucune écriture directe ───────────────────────────────
UPDATE public.plans SET is_active = false WHERE code = 'gold_annual';

SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '{"role":"anon"}';
DO $x$
BEGIN
  IF EXISTS (SELECT 1 FROM public.plans WHERE code = 'gold_annual') THEN
    RAISE EXCEPTION 'ASSERT FAIL C1: un anonyme voit un plan désactivé';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE code = 'b2b_gold' AND price_ttc = 60000) THEN
    RAISE EXCEPTION 'ASSERT FAIL C1: un anonyme ne lit pas le prix payé d''un plan actif';
  END IF;
END
$x$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"dddd0000-0000-4000-8000-0000000079c1","role":"authenticated"}';
DO $x$
BEGIN
  IF EXISTS (SELECT 1 FROM public.plans WHERE code = 'gold_annual') THEN
    RAISE EXCEPTION 'ASSERT FAIL C2: un spawter voit un plan désactivé';
  END IF;
END
$x$;

SET LOCAL request.jwt.claims = '{"sub":"dddd0000-0000-4000-8000-0000000079a2","role":"authenticated"}';
DO $x$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE code = 'gold_annual') THEN
    RAISE EXCEPTION 'ASSERT FAIL C3: le staff actif ne voit pas un plan désactivé';
  END IF;
END
$x$;

-- Même un admin n'écrit pas directement : la RLS ne laisse passer aucune ligne.
SET LOCAL request.jwt.claims = '{"sub":"dddd0000-0000-4000-8000-0000000079a1","role":"authenticated"}';
UPDATE public.plans SET price_ttc = 1 WHERE code = 'b2b_gold';
DO $x$
BEGIN
  IF (SELECT price_ttc FROM public.plans WHERE code = 'b2b_gold') IS DISTINCT FROM 60000 THEN
    RAISE EXCEPTION 'ASSERT FAIL C4: UPDATE direct sur plans accepté';
  END IF;
  RAISE NOTICE 'C OK — plan désactivé réservé au staff, UPDATE direct sans effet';
END
$x$;
RESET ROLE;
UPDATE public.plans SET is_active = true WHERE code = 'gold_annual';

-- ── D. admin_update_plan ────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"dddd0000-0000-4000-8000-0000000079a2","role":"authenticated"}';
DO $x$
BEGIN
  PERFORM public.admin_update_plan('b2b_gold', 55000, true, 'test');
  RAISE EXCEPTION 'ASSERT FAIL D1: un modérateur a changé un prix';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'D1 OK — modérateur refusé (42501)';
END
$x$;

SET LOCAL request.jwt.claims = '{"sub":"dddd0000-0000-4000-8000-0000000079c1","role":"authenticated"}';
DO $x$
BEGIN
  PERFORM public.admin_update_plan('b2b_gold', 55000, true, 'test');
  RAISE EXCEPTION 'ASSERT FAIL D2: un spawter a changé un prix';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'D2 OK — spawter refusé (42501)';
END
$x$;

SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '{"role":"anon"}';
DO $x$
BEGIN
  PERFORM public.admin_update_plan('b2b_gold', 55000, true, 'test');
  RAISE EXCEPTION 'ASSERT FAIL D3: un anonyme a changé un prix';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'D3 OK — anonyme refusé (42501)';
END
$x$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"dddd0000-0000-4000-8000-0000000079a1","role":"authenticated"}';
DO $x$
DECLARE
  bad RECORD;
BEGIN
  FOR bad IN SELECT * FROM (VALUES
      ('b2b_gold', 0,       true,  'zéro'),
      ('b2b_gold', -100,    true,  'négatif'),
      ('b2b_gold', 1000001, true,  'au-dessus du plafond'),
      ('b2b_gold', NULL,    true,  'prix absent'),
      ('b2b_gold', 60000,   NULL,  'statut absent'),
      ('b2b_gold', 61000,   true,  '   ')) AS t(code, ttc, actif, motif)
  LOOP
    BEGIN
      PERFORM public.admin_update_plan(bad.code, bad.ttc, bad.actif, bad.motif);
      RAISE EXCEPTION 'ASSERT FAIL D4: saisie invalide acceptée (%, %, %, «%»)',
        bad.code, bad.ttc, bad.actif, bad.motif;
    EXCEPTION WHEN check_violation THEN
      NULL;
    END;
  END LOOP;
  BEGIN
    PERFORM public.admin_update_plan('plan_fantome', 1000, true, 'test');
    RAISE EXCEPTION 'ASSERT FAIL D4: plan inconnu accepté';
  EXCEPTION WHEN no_data_found THEN
    NULL;
  END;
  RAISE NOTICE 'D4 OK — zéro, négatif, plafond, absences, motif vide et plan inconnu refusés';
END
$x$;

SELECT 'D5' AS scenario,
       public.admin_update_plan('b2b_gold', 55000, true, 'recette 0079 : baisse') AS retour;

SELECT 'D6' AS scenario,
       public.admin_update_plan('b2b_gold', 55000, true, 'recette 0079 : sans changement') AS retour;
RESET ROLE;

DO $x$
DECLARE
  v RECORD;
  n INTEGER;
BEGIN
  SELECT price_ttc, price_ht, tva_amount INTO v FROM public.plans WHERE code = 'b2b_gold';
  IF v.price_ttc IS DISTINCT FROM 55000 OR v.price_ht IS DISTINCT FROM 46610 OR v.tva_amount IS DISTINCT FROM 8390 THEN
    RAISE EXCEPTION 'ASSERT FAIL D5: plan après RPC attendu 55 000 / 46 610 / 8 390, trouvé %', v;
  END IF;
  SELECT count(*) INTO n FROM public.admin_audit_log
   WHERE action = 'plan_update'
     AND spawt_staff_id = 'dddd0000-0000-4000-8000-0000000079a1'
     AND reason = 'recette 0079 : baisse'
     AND (payload_before->>'price_ttc')::int = 60000
     AND (payload_after->>'price_ttc')::int = 55000
     AND (payload_after->>'price_ht')::numeric = 46610
     AND (payload_after->>'tva_amount')::int = 8390;
  IF n IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'ASSERT FAIL D5: ligne d''audit avant/après attendue, trouvé %', n;
  END IF;
  -- D6 : rien ne change, rien n'est journalisé.
  SELECT count(*) INTO n FROM public.admin_audit_log
   WHERE spawt_staff_id = 'dddd0000-0000-4000-8000-0000000079a1'
     AND reason = 'recette 0079 : sans changement';
  IF n IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'ASSERT FAIL D6: un appel sans changement a été journalisé';
  END IF;
  RAISE NOTICE 'D5/D6 OK — 55 000 → 46 610 + 8 390, avant/après journalisés ; appel neutre non journalisé';
END
$x$;

-- ── E. La validation manuelle facture le prix payé, au franc près ───────────
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"dddd0000-0000-4000-8000-0000000079a1","role":"authenticated"}';
SELECT 'E0' AS scenario,
       public.admin_update_plan('b2b_gold', 60000, true, 'recette 0079 : retour à 60 000') AS retour;
RESET ROLE;

INSERT INTO public.payment_requests
  (requester_id, customer_type, plan, method, amount_declare, reference, payer_phone)
VALUES
  ('dddd0000-0000-4000-8000-0000000079b1','b2b','b2b_gold','wave',60000,'TX-0079-B2B-1','+22577007901'),
  ('dddd0000-0000-4000-8000-0000000079c1','b2c','gold_monthly','orange_money',2950,'TX-0079-B2C-1','+22577007902');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"dddd0000-0000-4000-8000-0000000079a1","role":"authenticated"}';
SELECT 'E1' AS scenario,
       public.approve_payment_request(
         (SELECT id FROM public.payment_requests WHERE reference = 'TX-0079-B2B-1'),
         'recette 0079') AS retour;
SELECT 'E2' AS scenario,
       public.approve_payment_request(
         (SELECT id FROM public.payment_requests WHERE reference = 'TX-0079-B2C-1'),
         'recette 0079') AS retour;
RESET ROLE;

DO $x$
DECLARE
  inv RECORD;
  sub RECORD;
BEGIN
  SELECT i.price_ht, i.tva_rate, i.tva_amount, i.price_ttc, i.invoice_number INTO inv
    FROM public.invoices i JOIN public.payment_requests r ON i.provider_tx_id = 'manuel:' || r.id
   WHERE r.reference = 'TX-0079-B2B-1';
  IF inv.price_ht IS DISTINCT FROM 50847 OR inv.tva_amount IS DISTINCT FROM 9153 OR inv.price_ttc IS DISTINCT FROM 60000 OR inv.tva_rate IS DISTINCT FROM 18 THEN
    RAISE EXCEPTION 'ASSERT FAIL E1: facture Gold lieu 50 847 + 9 153 = 60 000 attendue, trouvé %', inv;
  END IF;
  SELECT s.plan, s.customer_type, s.price_ht, s.price_ttc, s.status,
         s.expires_at = s.started_at + interval '1 month' AS un_mois INTO sub
    FROM public.subscriptions s JOIN public.payment_requests r ON s.id = r.subscription_id
   WHERE r.reference = 'TX-0079-B2B-1';
  IF sub.plan IS DISTINCT FROM 'b2b_gold' OR sub.customer_type IS DISTINCT FROM 'b2b' OR sub.price_ht IS DISTINCT FROM 50847
     OR sub.price_ttc IS DISTINCT FROM 60000 OR sub.status IS DISTINCT FROM 'active' OR sub.un_mois IS NOT TRUE THEN
    RAISE EXCEPTION 'ASSERT FAIL E1: abonnement Gold lieu figé à 50 847 / 60 000 attendu, trouvé %', sub;
  END IF;

  SELECT i.price_ht, i.tva_amount, i.price_ttc INTO inv
    FROM public.invoices i JOIN public.payment_requests r ON i.provider_tx_id = 'manuel:' || r.id
   WHERE r.reference = 'TX-0079-B2C-1';
  IF inv.price_ht IS DISTINCT FROM 2500 OR inv.tva_amount IS DISTINCT FROM 450 OR inv.price_ttc IS DISTINCT FROM 2950 THEN
    RAISE EXCEPTION 'ASSERT FAIL E2: facture Gold mensuel 2 500 + 450 = 2 950 attendue, trouvé %', inv;
  END IF;
  RAISE NOTICE 'E OK — Gold lieu facturé 50 847 + 9 153 = 60 000, figé sur l''abonnement ; Gold mensuel 2 950 inchangé';
END
$x$;

-- ── F. Le figé : un nouveau prix ne réécrit pas le passé ────────────────────
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"dddd0000-0000-4000-8000-0000000079a1","role":"authenticated"}';
SELECT 'F0' AS scenario,
       public.admin_update_plan('b2b_gold', 70000, true, 'recette 0079 : hausse') AS retour;
RESET ROLE;

INSERT INTO public.payment_requests
  (requester_id, customer_type, plan, method, amount_declare, reference, payer_phone)
VALUES ('dddd0000-0000-4000-8000-0000000079b1','b2b','b2b_gold','wave',70000,'TX-0079-B2B-2','+22577007901');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"dddd0000-0000-4000-8000-0000000079a1","role":"authenticated"}';
SELECT 'F1' AS scenario,
       public.approve_payment_request(
         (SELECT id FROM public.payment_requests WHERE reference = 'TX-0079-B2B-2'),
         'recette 0079') AS retour;
SELECT 'F2' AS scenario,
       public.admin_update_plan('b2b_gold', 70000, false, 'recette 0079 : pause') AS retour;
RESET ROLE;

INSERT INTO public.payment_requests
  (requester_id, customer_type, plan, method, amount_declare, reference, payer_phone)
VALUES ('dddd0000-0000-4000-8000-0000000079b1','b2b','b2b_gold','wave',70000,'TX-0079-B2B-3','+22577007901');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"dddd0000-0000-4000-8000-0000000079a1","role":"authenticated"}';
DO $x$
BEGIN
  PERFORM public.approve_payment_request(
    (SELECT id FROM public.payment_requests WHERE reference = 'TX-0079-B2B-3'), 'recette 0079');
  RAISE EXCEPTION 'ASSERT FAIL F2: demande validée sur un plan désactivé';
EXCEPTION WHEN no_data_found THEN
  RAISE NOTICE 'F2 OK — plan désactivé : validation refusée (P0002)';
END
$x$;
RESET ROLE;

DO $x$
DECLARE
  inv RECORD;
BEGIN
  -- La facture et l'abonnement de E gardent 60 000.
  IF (SELECT i.price_ttc FROM public.invoices i JOIN public.payment_requests r
        ON i.provider_tx_id = 'manuel:' || r.id WHERE r.reference = 'TX-0079-B2B-1') IS DISTINCT FROM 60000
     OR (SELECT s.price_ttc FROM public.subscriptions s JOIN public.payment_requests r
        ON s.id = r.subscription_id WHERE r.reference = 'TX-0079-B2B-1') IS DISTINCT FROM 60000 THEN
    RAISE EXCEPTION 'ASSERT FAIL F1: le changement de prix a réécrit une facture ou un abonnement émis';
  END IF;
  -- La nouvelle validation facture le nouveau prix, au franc près.
  SELECT i.price_ht, i.tva_amount, i.price_ttc INTO inv
    FROM public.invoices i JOIN public.payment_requests r ON i.provider_tx_id = 'manuel:' || r.id
   WHERE r.reference = 'TX-0079-B2B-2';
  IF inv.price_ht IS DISTINCT FROM 59322 OR inv.tva_amount IS DISTINCT FROM 10678 OR inv.price_ttc IS DISTINCT FROM 70000 THEN
    RAISE EXCEPTION 'ASSERT FAIL F1: facture au nouveau prix 59 322 + 10 678 = 70 000 attendue, trouvé %', inv;
  END IF;
  RAISE NOTICE 'F OK — émis inchangé (60 000), nouveau paiement à 70 000 = 59 322 + 10 678';
END
$x$;

ROLLBACK;

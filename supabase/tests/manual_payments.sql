-- Tests SQL du paiement à validation manuelle (migration 0063).
-- Exécution : psql < supabase/tests/manual_payments.sql — tout en BEGIN/ROLLBACK.
-- Remplacer <ID_ADMIN_STAFF> par l'id d'un spawt_staff admin actif.
--
-- Ce que ces tests protègent :
--   * une demande n'accorde RIEN — ni par PATCH direct (B), ni en appelant la
--     fonction de décision (C). C'est le seul endroit du produit où un client
--     pourrait s'offrir un droit facturé ;
--   * la validation est ATOMIQUE : abonnement + facture + audit, ou rien (E→J) ;
--   * le double-clic sur « Valider » ne crée pas deux abonnements (K, L) — la
--     garantie vient de l'unicité de `provider_tx_id`, pas d'un verrou applicatif ;
--   * le prix facturé vient du catalogue, JAMAIS du montant déclaré (E) : sinon
--     n'importe qui s'abonnerait en déclarant 100 F ;
--   * un refus porte toujours un motif (M) — le support en a besoin ;
--   * la file de modération ne peut pas être noyée (N).

\set ON_ERROR_STOP off

BEGIN;

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
VALUES ('cccc0000-0000-4000-8000-00000000ee01','00000000-0000-0000-0000-000000000000',
        'authenticated','authenticated','t-pay@phone.spawt.local','',now(),now(),now());
INSERT INTO public.spawters (id, phone_e164, display_name, country_code)
VALUES ('cccc0000-0000-4000-8000-00000000ee01','+22577000801','Payeur Test','CI');

-- ── A. Le payeur déclare, avec sa vraie session ────────────────────────────
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"cccc0000-0000-4000-8000-00000000ee01","role":"authenticated"}';
INSERT INTO public.payment_requests
  (requester_id, customer_type, plan, method, amount_declare, reference, payer_phone)
VALUES ('cccc0000-0000-4000-8000-00000000ee01','b2c','gold_monthly','wave',2950,
        'TX-RECETTE-1','+22577000801');
SELECT 'A' AS scenario, status AS obtenu, 'pending' AS attendu
  FROM public.payment_requests WHERE reference = 'TX-RECETTE-1';

-- ── B. Auto-approbation par PATCH : refusée par la RLS ─────────────────────
DO $x$
BEGIN
  UPDATE public.payment_requests SET status = 'approved' WHERE reference = 'TX-RECETTE-1';
  RAISE WARNING 'B ÉCHEC — le payeur a pu s''approuver lui-même';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'B OK — refus %', SQLSTATE;
END$x$;

-- ── C. Appel direct de la fonction de décision : refusé ────────────────────
DO $x$
BEGIN
  PERFORM public.approve_payment_request(
    (SELECT id FROM public.payment_requests WHERE reference = 'TX-RECETTE-1'));
  RAISE WARNING 'C ÉCHEC — un non-admin a pu valider un paiement';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'C OK — refus 42501';
END$x$;

-- ── D. Le payeur peut annuler sa demande en attente ────────────────────────
UPDATE public.payment_requests SET status = 'cancelled' WHERE reference = 'TX-RECETTE-1';
SELECT 'D' AS scenario, status AS obtenu, 'cancelled' AS attendu
  FROM public.payment_requests WHERE reference = 'TX-RECETTE-1';
RESET ROLE;
UPDATE public.payment_requests SET status = 'pending' WHERE reference = 'TX-RECETTE-1';

-- ── E→J. La validation admin, et tout ce qu'elle doit produire ─────────────
SET LOCAL request.jwt.claims = '{"sub":"<ID_ADMIN_STAFF>","role":"authenticated"}';
SELECT 'E' AS scenario,
       (public.approve_payment_request(
          (SELECT id FROM public.payment_requests WHERE reference = 'TX-RECETTE-1'),
          'recette'))->>'price_ht' AS obtenu,
       '2500' AS attendu;  -- le CATALOGUE, pas les 2950 déclarés

SELECT 'F' AS scenario, is_active AS obtenu, true AS attendu
  FROM public.active_entitlements WHERE spawter_id = 'cccc0000-0000-4000-8000-00000000ee01';

SELECT 'G/H' AS scenario, invoice_number, price_ht, tva_amount, price_ttc
  FROM public.invoices WHERE provider_tx_id LIKE 'manuel:%'
  ORDER BY created_at DESC LIMIT 1;
-- attendu : SPAWT-AAAA-NNNN, 2500, 450, 2950

SELECT 'I' AS scenario,
       round(extract(epoch FROM (expires_at - started_at)) / 86400 / 30) AS mois
  FROM public.subscriptions WHERE provider = 'manuel' ORDER BY created_at DESC LIMIT 1;
-- attendu : 1

SELECT 'J' AS scenario, action AS obtenu, 'payment_request_approve' AS attendu
  FROM public.admin_audit_log WHERE entity_type = 'payment_request'
  ORDER BY created_at DESC LIMIT 1;

-- ── K/L. Double-clic sur « Valider » ───────────────────────────────────────
SELECT 'K' AS scenario,
       (public.approve_payment_request(
          (SELECT id FROM public.payment_requests WHERE reference = 'TX-RECETTE-1')))->>'idempotent'
       AS obtenu, 'true' AS attendu;
SELECT 'L' AS scenario, count(*) AS obtenu, 1 AS attendu
  FROM public.subscriptions WHERE provider = 'manuel';

-- ── M. Un refus sans motif est impossible ──────────────────────────────────
INSERT INTO public.payment_requests
  (requester_id, customer_type, plan, method, amount_declare, reference)
VALUES ('cccc0000-0000-4000-8000-00000000ee01','b2c','gold_monthly','especes',1000,'TX-RECETTE-2');
DO $x$
BEGIN
  PERFORM public.reject_payment_request(
    (SELECT id FROM public.payment_requests WHERE reference = 'TX-RECETTE-2'), '   ');
  RAISE WARNING 'M ÉCHEC — refus accepté sans motif';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'M OK — motif exigé';
END$x$;

-- ── N. Quota de 3 demandes en attente ──────────────────────────────────────
DO $x$
BEGIN
  INSERT INTO public.payment_requests (requester_id, customer_type, plan, method, amount_declare)
  VALUES ('cccc0000-0000-4000-8000-00000000ee01','b2c','gold_monthly','wave',2950),
         ('cccc0000-0000-4000-8000-00000000ee01','b2c','gold_monthly','wave',2950),
         ('cccc0000-0000-4000-8000-00000000ee01','b2c','gold_monthly','wave',2950);
  RAISE WARNING 'N ÉCHEC — quota non appliqué';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'N OK — quota de 3 appliqué';
END$x$;

ROLLBACK;

-- ── O. Non-régression : les deux catalogues de prix doivent concorder ──────
-- `plans` sert la validation manuelle, `_shared/payment/types.ts` sert le
-- checkout CinetPay. Un écart facture deux prix différents pour le même
-- abonnement selon le canal. Attendu : gold_monthly 2500, gold_annual 25000,
-- pro 15000, b2b_gold 65000.
SELECT code, price_ht FROM public.plans
 WHERE code IN ('gold_monthly','gold_annual','pro','b2b_gold') ORDER BY code;

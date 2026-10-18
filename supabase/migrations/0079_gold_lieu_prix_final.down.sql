-- Migration 0079 — DOWN : retour au catalogue HT de 0063.
--
-- Ordre à respecter : redéployer D'ABORD les Edge Functions d'avant 0079
-- (payment-checkout, payment-webhook), puis jouer ce fichier. Les fonctions
-- 0079 lisent `plans.price_ttc` et `subscriptions.price_ttc` : sans ces
-- colonnes elles échouent fermé (500), elles ne facturent jamais faux.
--
-- Ce qui n'est PAS défait :
--   * les factures émises — ce sont des pièces comptables, montants compris ;
--   * les lignes d'audit `plan_update` — historique conservé, les CHECK sont
--     remis sans elles en NOT VALID (motif 0074) ;
--   * les prix changés depuis la console pour les autres plans : leur HT
--     courant est conservé. Seul Gold lieu revient à sa valeur d'avant 0079
--     (65 000 HT).
-- ⚠️ Le TTC figé sur les abonnements disparaît avec la colonne. Un abonnement
-- Gold lieu encore en attente de paiement serait alors facturé 59 999 F par
-- l'ancien webhook pour 60 000 encaissés : à régulariser à la main.

DROP FUNCTION IF EXISTS public.admin_update_plan(TEXT, INTEGER, BOOLEAN, TEXT);

-- ━━━ approve_payment_request : corps de 0063, à l'identique ━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION public.approve_payment_request(
  p_request_id UUID,
  p_reason     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_staff        UUID := auth.uid();
  v_req          public.payment_requests%ROWTYPE;
  v_customer_id  UUID;
  v_cust_type    TEXT;
  v_price_ht     INTEGER;
  v_months       INTEGER;
  v_sub_id       UUID;
  v_started      TIMESTAMPTZ := now();
  v_expires      TIMESTAMPTZ;
  v_name         TEXT;
BEGIN
  IF NOT public.is_admin_staff(v_staff) THEN
    RAISE EXCEPTION 'forbidden: admin staff required' USING ERRCODE = '42501';
  END IF;

  -- FOR UPDATE : deux admins qui valident la même demande en même temps se
  -- sérialisent ; le second voit 'approved' et sort en no-op.
  SELECT * INTO v_req FROM public.payment_requests
   WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'demande introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_req.status = 'approved' THEN
    RETURN jsonb_build_object('idempotent', true, 'subscription_id', v_req.subscription_id);
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'demande déjà traitée (%)', v_req.status USING ERRCODE = 'check_violation';
  END IF;

  -- ── Prix : le catalogue, jamais le montant déclaré ────────────────────────
  SELECT p.price_ht::INTEGER,
         CASE p.period WHEN 'annual' THEN 12 WHEN 'monthly' THEN 1 ELSE 1 END
    INTO v_price_ht, v_months
    FROM public.plans p WHERE p.code = v_req.plan AND p.is_active;
  IF v_price_ht IS NULL THEN
    RAISE EXCEPTION 'plan % absent du catalogue actif', v_req.plan USING ERRCODE = 'P0002';
  END IF;
  v_expires := v_started + make_interval(months => v_months);

  -- ── Le client commercial (0002) ───────────────────────────────────────────
  v_cust_type := CASE WHEN v_req.customer_type = 'b2b' THEN 'b2b_business' ELSE 'b2c_individual' END;
  SELECT id INTO v_customer_id FROM public.customers
   WHERE spawter_id = v_req.requester_id AND customer_type = v_cust_type;
  IF v_customer_id IS NULL THEN
    SELECT COALESCE(display_name, 'Spawter') INTO v_name
      FROM public.spawters WHERE id = v_req.requester_id;
    INSERT INTO public.customers
      (spawter_id, customer_type, display_name, billing_country_code, billing_currency_code)
    VALUES (v_req.requester_id, v_cust_type, COALESCE(v_name, 'Spawter'), 'CI', 'XOF')
    RETURNING id INTO v_customer_id;
  END IF;

  -- ── L'abonnement ──────────────────────────────────────────────────────────
  -- `provider_tx_id` unique (0032) = idempotence : un double-clic sur
  -- « Valider » ne peut pas créer deux abonnements, la contrainte refuse.
  INSERT INTO public.subscriptions
    (customer_id, customer_type, plan, price_ht, tva_rate, currency, status,
     provider, provider_tx_id, started_at, expires_at, grace_until)
  VALUES
    (v_customer_id, v_req.customer_type, v_req.plan, v_price_ht, 18.00, 'XOF', 'active',
     'manuel', 'manuel:' || p_request_id::TEXT, v_started, v_expires, NULL)
  RETURNING id INTO v_sub_id;

  -- Renouvellement pendant la grâce : l'ancien abonnement est clos, un seul
  -- droit actif à la fois (même règle que le webhook).
  UPDATE public.subscriptions
     SET status = 'expired'
   WHERE customer_id = v_customer_id AND status = 'grace' AND id <> v_sub_id;

  -- ── Rôle B2B — le paiement OUVRE le droit ─────────────────────────────────
  -- Sens unique, comme pour CinetPay : l'expiration ne rétrograde pas
  -- automatiquement, la coupure d'un compte lieu reste un acte humain.
  IF v_req.plan IN ('pro', 'b2b_gold') THEN
    UPDATE public.b2b_accounts
       SET role = CASE WHEN v_req.plan = 'b2b_gold' THEN 'gold' ELSE 'pro' END
     WHERE auth_user_id = v_req.requester_id;
  END IF;

  -- ── La facture ────────────────────────────────────────────────────────────
  -- Le trigger de 0032 pose le numéro (SPAWT-AAAA-NNNN), la TVA et le TTC.
  INSERT INTO public.invoices
    (subscription_id, customer_id, customer_type, price_ht, tva_rate, currency,
     status, provider_tx_id, issued_at, paid_at)
  VALUES
    (v_sub_id, v_customer_id, v_req.customer_type, v_price_ht, 18.00, 'XOF',
     'paid', 'manuel:' || p_request_id::TEXT, v_started, v_started);

  -- ── La demande ────────────────────────────────────────────────────────────
  UPDATE public.payment_requests
     SET status = 'approved', decided_by = v_staff, decided_at = now(),
         decision_reason = p_reason, subscription_id = v_sub_id
   WHERE id = p_request_id;

  INSERT INTO public.admin_audit_log
    (spawt_staff_id, action, entity_type, entity_id, payload_before, payload_after, reason)
  VALUES (
    v_staff, 'payment_request_approve', 'payment_request', p_request_id,
    jsonb_build_object('status', 'pending', 'plan', v_req.plan,
                       'montant_declare', v_req.amount_declare,
                       'moyen', v_req.method, 'reference', v_req.reference),
    jsonb_build_object('status', 'approved', 'subscription_id', v_sub_id,
                       'price_ht', v_price_ht, 'expires_at', v_expires),
    p_reason
  );

  RETURN jsonb_build_object(
    'subscription_id', v_sub_id, 'expires_at', v_expires, 'price_ht', v_price_ht);
END;
$$;

COMMENT ON FUNCTION public.approve_payment_request(UUID, TEXT) IS
  'Valide une déclaration de paiement : ouvre l''abonnement, clôt une grâce '
  'éventuelle, synchronise le rôle B2B, émet la facture et journalise — le '
  'tout en UNE transaction. Admins actifs uniquement. Idempotente (un second '
  'appel renvoie l''abonnement déjà créé).';

REVOKE ALL ON FUNCTION public.approve_payment_request(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_payment_request(UUID, TEXT) TO authenticated;

-- ━━━ plans : retour au HT seul ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DROP POLICY IF EXISTS plans_select_staff ON public.plans;
DROP TRIGGER IF EXISTS plans_derive_amounts ON public.plans;
DROP FUNCTION IF EXISTS public.plans_derive_amounts();
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_price_ttc_derivation;

UPDATE public.plans SET price_ht = 65000 WHERE code = 'b2b_gold';

ALTER TABLE public.plans
  DROP COLUMN IF EXISTS price_ttc,
  DROP COLUMN IF EXISTS tva_amount;

COMMENT ON COLUMN public.plans.price_ht IS NULL;
COMMENT ON TABLE public.plans IS
  'Offres commerciales — source de vérité SQL des prix. Doit rester alignée '
  'sur `supabase/functions/_shared/payment/types.ts` (PLAN_PRICING), qui sert '
  'le checkout CinetPay. Un écart entre les deux facture deux prix différents '
  'pour le même abonnement selon le canal.';

-- ━━━ subscriptions : plus de TTC figé ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_price_ttc_check;
ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS price_ttc;

-- ━━━ Journal d'audit : retrait des extensions 0079 ━━━━━━━━━━━━━━━━━━━━━━━━━
DO $$
DECLARE
  v_check TEXT;
BEGIN
  SELECT pg_get_expr(conbin, conrelid) INTO STRICT v_check
    FROM pg_constraint
   WHERE conrelid = 'public.admin_audit_log'::regclass
     AND conname = 'admin_audit_log_action_check';
  v_check := replace(v_check, ' OR (action = ''plan_update''::text)', '');
  ALTER TABLE public.admin_audit_log DROP CONSTRAINT admin_audit_log_action_check;
  EXECUTE format(
    'ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_action_check CHECK (%s) NOT VALID',
    v_check
  );

  SELECT pg_get_expr(conbin, conrelid) INTO STRICT v_check
    FROM pg_constraint
   WHERE conrelid = 'public.admin_audit_log'::regclass
     AND conname = 'admin_audit_log_entity_type_check';
  v_check := replace(v_check, ' OR (entity_type = ''plan''::text)', '');
  ALTER TABLE public.admin_audit_log DROP CONSTRAINT admin_audit_log_entity_type_check;
  EXECUTE format(
    'ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_entity_type_check CHECK (%s) NOT VALID',
    v_check
  );
END;
$$;

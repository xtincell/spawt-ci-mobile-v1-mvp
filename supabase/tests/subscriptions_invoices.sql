-- Sprint 2 — Tests SQL 0032 (subscriptions, invoices, active_entitlements).
-- Exécution manuelle locale : psql < supabase/tests/subscriptions_invoices.sql
-- Chaque scénario en BEGIN/ROLLBACK — non destructif.
-- Prérequis : spawters peuplés + seed currencies (XOF), exécution
-- superuser/service_role (bypass RLS — on teste la mécanique, pas la RLS).

\set ON_ERROR_STOP on
\timing on

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 1 — Numérotation SPAWT-YYYY-NNNN séquentielle + calcul TVA auto.
-- 3 factures sans invoice_number → suffixes consécutifs ; TVA 18% de 2500
-- = 450, TTC = 2950.
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

CREATE TEMP TABLE fixture (customer_id uuid) ON COMMIT DROP;
WITH ins AS (
  INSERT INTO public.customers (spawter_id, customer_type, display_name,
                                billing_country_code, billing_currency_code)
  SELECT s.id, 'b2c_individual', 'Test Facture', 'CI', 'XOF'
  FROM public.spawters s LIMIT 1
  RETURNING id
)
INSERT INTO fixture SELECT id FROM ins;

INSERT INTO public.invoices (customer_id, customer_type, price_ht)
SELECT customer_id, 'b2c', 2500 FROM fixture;
INSERT INTO public.invoices (customer_id, customer_type, price_ht)
SELECT customer_id, 'b2c', 2500 FROM fixture;
INSERT INTO public.invoices (customer_id, customer_type, price_ht)
SELECT customer_id, 'b2c', 2500 FROM fixture;

DO $$
DECLARE
  v_numbers text[];
  v_suffix integer[];
  v_inv RECORD;
BEGIN
  SELECT array_agg(invoice_number ORDER BY invoice_number)
  INTO v_numbers
  FROM public.invoices i
  WHERE i.customer_id = (SELECT customer_id FROM fixture);

  IF array_length(v_numbers, 1) <> 3 THEN
    RAISE EXCEPTION 'ASSERT FAIL: attendu 3 factures, trouvé %', array_length(v_numbers, 1);
  END IF;

  -- Format SPAWT-YYYY-NNNN (année courante).
  IF NOT (v_numbers[1] ~ ('^SPAWT-' || extract(year FROM now())::int || '-\d{4}$')) THEN
    RAISE EXCEPTION 'ASSERT FAIL: format invalide %', v_numbers[1];
  END IF;

  -- Séquence consécutive (relatif : la base peut déjà avoir des factures).
  v_suffix := ARRAY[
    right(v_numbers[1], 4)::integer,
    right(v_numbers[2], 4)::integer,
    right(v_numbers[3], 4)::integer];
  IF v_suffix[2] <> v_suffix[1] + 1 OR v_suffix[3] <> v_suffix[2] + 1 THEN
    RAISE EXCEPTION 'ASSERT FAIL: numérotation non séquentielle % % %',
      v_numbers[1], v_numbers[2], v_numbers[3];
  END IF;

  -- Calcul TVA posé par le trigger BEFORE INSERT.
  SELECT * INTO v_inv FROM public.invoices i
  WHERE i.invoice_number = v_numbers[1];
  IF v_inv.tva_amount <> 450 OR v_inv.price_ttc <> 2950 THEN
    RAISE EXCEPTION 'ASSERT FAIL: TVA attendue 450/2950, trouvé %/%',
      v_inv.tva_amount, v_inv.price_ttc;
  END IF;

  RAISE NOTICE 'Scenario 1 OK — % / % / % (TVA 450, TTC 2950)',
    v_numbers[1], v_numbers[2], v_numbers[3];
END $$;
ROLLBACK;

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 2 — Vue active_entitlements : actif / grâce / expiré.
--   a. active, expires futur               → is_active = true
--   b. grace, expires passé, grâce ouverte → is_active = true
--   c. expired                             → is_active = false
--   d. active, expires passé, grâce passée → is_active = false
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

CREATE TEMP TABLE fixture2 (customer_id uuid, spawter_id uuid) ON COMMIT DROP;
WITH ins AS (
  INSERT INTO public.customers (spawter_id, customer_type, display_name,
                                billing_country_code, billing_currency_code)
  SELECT s.id, 'b2c_individual', 'Test Entitlements', 'CI', 'XOF'
  FROM public.spawters s LIMIT 1
  RETURNING id, spawter_id
)
INSERT INTO fixture2 SELECT id, spawter_id FROM ins;

INSERT INTO public.subscriptions
  (customer_id, customer_type, plan, price_ht, status, provider_tx_id,
   started_at, expires_at, grace_until)
SELECT f.customer_id, 'b2c', 'gold_monthly', 2500, x.status, x.tx,
       now() - interval '40 days', x.exp, x.grace
FROM fixture2 f, (VALUES
  ('active',  'tx-ent-a', now() + interval '20 days', NULL::timestamptz),
  ('grace',   'tx-ent-b', now() - interval '2 days',  now() + interval '5 days'),
  ('expired', 'tx-ent-c', now() - interval '10 days', now() - interval '3 days'),
  ('active',  'tx-ent-d', now() - interval '20 days', now() - interval '13 days')
) AS x(status, tx, exp, grace);

DO $$
DECLARE
  v_count integer;
BEGIN
  -- a. actif franc → is_active (identifié par son expires_at unique +20j).
  IF NOT EXISTS (
    SELECT 1 FROM public.active_entitlements e
    WHERE e.spawter_id = (SELECT spawter_id FROM fixture2)
      AND e.status = 'active' AND e.expires_at > now() AND e.is_active
  ) THEN
    RAISE EXCEPTION 'ASSERT FAIL: abonnement actif franc doit être is_active=true';
  END IF;

  -- b. en grâce → is_active.
  IF NOT EXISTS (
    SELECT 1 FROM public.active_entitlements e
    WHERE e.spawter_id = (SELECT spawter_id FROM fixture2)
      AND e.status = 'grace' AND e.grace_until > now() AND e.is_active
  ) THEN
    RAISE EXCEPTION 'ASSERT FAIL: abonnement en grâce doit être is_active=true';
  END IF;

  -- Exactement 2 lignes actives (a + b) — c (expired) et d (grâce dépassée)
  -- doivent être is_active=false.
  SELECT count(*) INTO v_count
  FROM public.active_entitlements e
  WHERE e.spawter_id = (SELECT spawter_id FROM fixture2)
    AND e.is_active;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'ASSERT FAIL: attendu 2 entitlements actifs (actif+grâce), trouvé %', v_count;
  END IF;

  RAISE NOTICE 'Scenario 2 OK — entitlements actif/grâce/expiré conformes';
END $$;
ROLLBACK;

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 3 — Idempotence provider : UNIQUE(provider_tx_id) rejette le
-- double webhook CinetPay.
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

CREATE TEMP TABLE fixture3 (customer_id uuid) ON COMMIT DROP;
WITH ins AS (
  INSERT INTO public.customers (spawter_id, customer_type, display_name,
                                billing_country_code, billing_currency_code)
  SELECT s.id, 'b2c_individual', 'Test Idempotence', 'CI', 'XOF'
  FROM public.spawters s LIMIT 1
  RETURNING id
)
INSERT INTO fixture3 SELECT id FROM ins;

INSERT INTO public.subscriptions (customer_id, customer_type, plan, price_ht, provider_tx_id)
SELECT customer_id, 'b2c', 'gold_monthly', 2500, 'tx-dup-1' FROM fixture3;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.subscriptions (customer_id, customer_type, plan, price_ht, provider_tx_id)
    SELECT customer_id, 'b2c', 'gold_monthly', 2500, 'tx-dup-1' FROM fixture3;
    RAISE EXCEPTION 'ASSERT FAIL: doublon provider_tx_id accepté';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'Scenario 3 OK — doublon provider_tx_id rejeté (unique_violation)';
  END;
END $$;
ROLLBACK;

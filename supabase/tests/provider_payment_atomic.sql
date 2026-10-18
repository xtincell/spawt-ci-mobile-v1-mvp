\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id, email) VALUES
 ('dddd0000-0000-4000-8000-0000000081a1','atomic-b2b@spawt.local');
INSERT INTO public.spawters(id,phone_e164,display_name,country_code)
 VALUES('dddd0000-0000-4000-8000-0000000081a1','+22577008101','Recette atomique','CI');
INSERT INTO public.customers(id,spawter_id,customer_type,display_name,billing_country_code,billing_currency_code)
 VALUES('dddd0000-0000-4000-8000-0000000081c1','dddd0000-0000-4000-8000-0000000081a1','b2b_business','Recette','CI','XOF');
INSERT INTO public.places(id,name,descriptive_address,neighborhood)
 VALUES('dddd0000-0000-4000-8000-0000000081b1','Recette privée','Recette','Recette');
INSERT INTO public.b2b_accounts(auth_user_id,place_id,role)
 VALUES('dddd0000-0000-4000-8000-0000000081a1','dddd0000-0000-4000-8000-0000000081b1','pro');
INSERT INTO public.subscriptions(id,customer_id,customer_type,plan,price_ht,price_ttc,status,provider_tx_id)
 VALUES('dddd0000-0000-4000-8000-0000000081d1','dddd0000-0000-4000-8000-0000000081c1','b2b','b2b_gold',50847,60000,'pending','SPAWT-TEST-ATOMIC-81');

-- Normal clients cannot attest that money arrived, even with a valid session.
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.confirm_provider_payment('SPAWT-TEST-ATOMIC-81','cinetpay',60000,'XOF');
    RAISE EXCEPTION 'ASSERT: authenticated client activated a payment';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF has_function_privilege('anon','public.confirm_provider_payment(text,text,integer,text,timestamptz)','EXECUTE') THEN
    RAISE EXCEPTION 'ASSERT: anonymous execution allowed';
  END IF;
END $$;

-- The price can change after checkout; only the subscription snapshot is paid.
UPDATE public.plans SET price_ttc=70000 WHERE code='b2b_gold';
SET LOCAL ROLE service_role;
DO $$ DECLARE r jsonb; amount integer; BEGIN
  FOREACH amount IN ARRAY ARRAY[0,-1,59999,60001] LOOP
    r:=public.confirm_provider_payment('SPAWT-TEST-ATOMIC-81','cinetpay',amount,'XOF');
    IF r->>'ignored' IS DISTINCT FROM 'payment_mismatch' THEN RAISE EXCEPTION 'ASSERT: wrong amount accepted'; END IF;
  END LOOP;
  r:=public.confirm_provider_payment('SPAWT-TEST-ATOMIC-81','cinetpay',60000,'USD');
  IF r->>'ignored' IS DISTINCT FROM 'payment_mismatch' THEN RAISE EXCEPTION 'ASSERT: wrong currency accepted'; END IF;
  r:=public.confirm_provider_payment('SPAWT-TEST-ATOMIC-81','other',60000,'XOF');
  IF r->>'ignored' IS DISTINCT FROM 'provider_mismatch' THEN RAISE EXCEPTION 'ASSERT: wrong provider accepted'; END IF;
  IF EXISTS(SELECT 1 FROM invoices WHERE provider_tx_id='SPAWT-TEST-ATOMIC-81')
     OR EXISTS(SELECT 1 FROM subscriptions WHERE provider_tx_id='SPAWT-TEST-ATOMIC-81' AND status<>'pending') THEN
    RAISE EXCEPTION 'ASSERT: mismatch left writes';
  END IF;
END $$;
RESET ROLE;

-- Force an invoice failure after activation/role updates; ALL must roll back.
CREATE FUNCTION public.test_0081_invoice_failure() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'test invoice unavailable' USING ERRCODE='check_violation'; END $$;
CREATE TRIGGER test_0081_invoice_failure BEFORE INSERT ON public.invoices
 FOR EACH ROW WHEN (NEW.provider_tx_id='SPAWT-TEST-ATOMIC-81') EXECUTE FUNCTION public.test_0081_invoice_failure();
SET LOCAL ROLE service_role;
DO $$ BEGIN
  BEGIN
    PERFORM public.confirm_provider_payment('SPAWT-TEST-ATOMIC-81','cinetpay',60000,'XOF');
    RAISE EXCEPTION 'ASSERT: invoice failure swallowed';
  EXCEPTION WHEN check_violation THEN NULL; END;
  IF (SELECT status FROM subscriptions WHERE provider_tx_id='SPAWT-TEST-ATOMIC-81')<>'pending'
     OR (SELECT role FROM b2b_accounts WHERE auth_user_id='dddd0000-0000-4000-8000-0000000081a1')<>'pro'
     OR EXISTS(SELECT 1 FROM invoices WHERE provider_tx_id='SPAWT-TEST-ATOMIC-81') THEN
    RAISE EXCEPTION 'ASSERT: partial payment survived invoice failure';
  END IF;
END $$;
RESET ROLE;
DROP TRIGGER test_0081_invoice_failure ON public.invoices;
DROP FUNCTION public.test_0081_invoice_failure();

-- Retry succeeds exactly once and invoices 60,000 despite the new 70,000 tariff.
SET LOCAL ROLE service_role;
DO $$ DECLARE first_result jsonb; replay jsonb; BEGIN
  first_result:=public.confirm_provider_payment('SPAWT-TEST-ATOMIC-81','cinetpay',60000,'XOF');
  replay:=public.confirm_provider_payment('SPAWT-TEST-ATOMIC-81','cinetpay',60000,'XOF');
  IF first_result->>'status' IS DISTINCT FROM 'active' OR replay->>'idempotent' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'ASSERT: confirmation/replay contract failed';
  END IF;
  IF (SELECT count(*) FROM invoices WHERE provider_tx_id='SPAWT-TEST-ATOMIC-81')<>1
     OR NOT EXISTS(SELECT 1 FROM invoices WHERE provider_tx_id='SPAWT-TEST-ATOMIC-81' AND price_ht=50847 AND tva_amount=9153 AND price_ttc=60000 AND status='paid')
     OR (SELECT role FROM b2b_accounts WHERE auth_user_id='dddd0000-0000-4000-8000-0000000081a1')<>'gold' THEN
    RAISE EXCEPTION 'ASSERT: invoice snapshot/role incorrect';
  END IF;
  UPDATE subscriptions SET status='expired' WHERE provider_tx_id='SPAWT-TEST-ATOMIC-81';
  PERFORM public.confirm_provider_payment('SPAWT-TEST-ATOMIC-81','cinetpay',60000,'XOF');
  IF (SELECT status FROM subscriptions WHERE provider_tx_id='SPAWT-TEST-ATOMIC-81')<>'expired' THEN
    RAISE EXCEPTION 'ASSERT: expired subscription reactivated';
  END IF;
END $$;
RESET ROLE;

-- Legacy subscriptions retain the old HT + rounded VAT amount.
INSERT INTO subscriptions(customer_id,customer_type,plan,price_ht,price_ttc,status,provider_tx_id)
 VALUES('dddd0000-0000-4000-8000-0000000081c1','b2b','b2b_gold',65000,NULL,'pending','SPAWT-TEST-LEGACY-81');
SET LOCAL ROLE service_role;
DO $$ BEGIN
  PERFORM public.confirm_provider_payment('SPAWT-TEST-LEGACY-81','cinetpay',76700,'XOF');
  IF NOT EXISTS(SELECT 1 FROM invoices WHERE provider_tx_id='SPAWT-TEST-LEGACY-81' AND price_ht=65000 AND tva_amount=11700 AND price_ttc=76700) THEN
    RAISE EXCEPTION 'ASSERT: legacy amount changed';
  END IF;
END $$;
RESET ROLE;
ROLLBACK;

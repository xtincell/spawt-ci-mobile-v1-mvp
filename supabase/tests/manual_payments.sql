-- Autonomous payment declaration/approval regression. All fixtures roll back.
-- Unlike the former manual recipe, every failed assertion aborts the test.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id,email) VALUES
 ('cccc0000-0000-4000-8000-00000000ee01','manual-payer@spawt.local'),
 ('cccc0000-0000-4000-8000-00000000ee02','manual-admin@spawt.local');
INSERT INTO public.spawters(id,phone_e164,display_name,country_code)
 VALUES('cccc0000-0000-4000-8000-00000000ee01','+22577000801','Payeur Test','CI');
INSERT INTO public.spawt_staff(id,email,display_name,role,is_active)
 VALUES('cccc0000-0000-4000-8000-00000000ee02','manual-admin@spawt.local','Admin Test','admin',true);
UPDATE public.plans SET price_ttc=2950,is_active=true WHERE code='gold_monthly';

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims='{"sub":"cccc0000-0000-4000-8000-00000000ee01","role":"authenticated"}';
INSERT INTO public.payment_requests(requester_id,customer_type,plan,method,amount_declare,reference)
 VALUES(auth.uid(),'b2c','gold_monthly','wave',100,'TX-RECETTE-1');
DO $$ BEGIN
  BEGIN
    UPDATE public.payment_requests SET status='approved',decided_by='cccc0000-0000-4000-8000-00000000ee02',decided_at=now()
     WHERE reference='TX-RECETTE-1';
    IF FOUND THEN RAISE EXCEPTION 'ASSERT: payer approved own request'; END IF;
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END;
  BEGIN
    PERFORM public.approve_payment_request((SELECT id FROM payment_requests WHERE reference='TX-RECETTE-1'));
    RAISE EXCEPTION 'ASSERT: payer invoked approval';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF (SELECT status FROM payment_requests WHERE reference='TX-RECETTE-1') IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'ASSERT: declaration changed entitlement';
  END IF;
END $$;
UPDATE public.payment_requests SET status='cancelled' WHERE reference='TX-RECETTE-1';
DO $$ BEGIN
  IF (SELECT status FROM payment_requests WHERE reference='TX-RECETTE-1') IS DISTINCT FROM 'cancelled' THEN
    RAISE EXCEPTION 'ASSERT: owner cannot cancel';
  END IF;
END $$;
RESET ROLE;
UPDATE public.payment_requests SET status='pending' WHERE reference='TX-RECETTE-1';

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims='{"sub":"cccc0000-0000-4000-8000-00000000ee02","role":"authenticated"}';
DO $$ DECLARE result jsonb; replay jsonb; request_id uuid; BEGIN
  SELECT id INTO request_id FROM payment_requests WHERE reference='TX-RECETTE-1';
  result:=public.approve_payment_request(request_id,'Recette : rapprochement du versement, montant déclaré erroné');
  replay:=public.approve_payment_request(request_id,'Rejeu');
  IF (result->>'price_ht')::int IS DISTINCT FROM 2500 OR replay->>'idempotent' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'ASSERT: catalog price/idempotence failed';
  END IF;
END $$;
RESET ROLE;
DO $$ DECLARE request_id uuid; BEGIN
  SELECT id INTO request_id FROM payment_requests WHERE reference='TX-RECETTE-1';
  IF (SELECT count(*) FROM subscriptions WHERE provider_tx_id='manuel:'||request_id)<>1
     OR NOT EXISTS(SELECT 1 FROM subscriptions WHERE provider_tx_id='manuel:'||request_id AND status='active' AND expires_at=started_at+interval '1 month')
     OR NOT EXISTS(SELECT 1 FROM invoices WHERE provider_tx_id='manuel:'||request_id AND price_ht=2500 AND tva_amount=450 AND price_ttc=2950 AND invoice_number LIKE 'SPAWT-%')
     OR NOT EXISTS(SELECT 1 FROM active_entitlements WHERE spawter_id='cccc0000-0000-4000-8000-00000000ee01' AND is_active)
     OR (SELECT count(*) FROM admin_audit_log WHERE entity_id=request_id AND action='payment_request_approve')<>1 THEN
    RAISE EXCEPTION 'ASSERT: entitlement, invoice or audit missing/duplicated';
  END IF;
END $$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims='{"sub":"cccc0000-0000-4000-8000-00000000ee01","role":"authenticated"}';
INSERT INTO payment_requests(requester_id,customer_type,plan,method,amount_declare,reference)
 VALUES(auth.uid(),'b2c','gold_monthly','especes',1000,'TX-RECETTE-2');
DO $$ BEGIN
  BEGIN
    INSERT INTO payment_requests(requester_id,customer_type,plan,method,amount_declare)
     VALUES(auth.uid(),'b2c','gold_monthly','wave',2950),
           (auth.uid(),'b2c','gold_monthly','wave',2950),
           (auth.uid(),'b2c','gold_monthly','wave',2950);
    RAISE EXCEPTION 'ASSERT: pending request quota bypassed';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
SET LOCAL request.jwt.claims='{"sub":"cccc0000-0000-4000-8000-00000000ee02","role":"authenticated"}';
DO $$ BEGIN
  BEGIN
    PERFORM reject_payment_request((SELECT id FROM payment_requests WHERE reference='TX-RECETTE-2'),'   ');
    RAISE EXCEPTION 'ASSERT: rejection without reason';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
ROLLBACK;

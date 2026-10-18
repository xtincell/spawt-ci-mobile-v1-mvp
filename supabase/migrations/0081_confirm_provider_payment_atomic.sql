-- After server-to-server provider verification, commit entitlement and invoice
-- together. An unavailable invoice or B2B account leaves the subscription pending.
CREATE OR REPLACE FUNCTION public.confirm_provider_payment(
  p_transaction_id text, p_provider text, p_amount integer, p_currency text,
  p_paid_at timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_sub public.subscriptions%ROWTYPE;
  v_ttc integer;
  v_started timestamptz := now();
  v_expires timestamptz;
  v_payer uuid;
  v_invoice uuid;
BEGIN
  SELECT * INTO v_sub FROM public.subscriptions
    WHERE provider_tx_id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('received',true,'ignored','unknown_transaction');
  END IF;
  IF v_sub.provider IS DISTINCT FROM p_provider THEN
    RETURN jsonb_build_object('received',true,'ignored','provider_mismatch');
  END IF;
  IF v_sub.status NOT IN ('pending','cancelled') THEN
    RETURN jsonb_build_object('received',true,'idempotent',true);
  END IF;

  v_ttc := coalesce(v_sub.price_ttc, v_sub.price_ht + round(v_sub.price_ht * v_sub.tva_rate / 100)::integer);
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount IS DISTINCT FROM v_ttc
     OR p_currency IS DISTINCT FROM v_sub.currency OR v_sub.currency <> 'XOF'
     OR v_sub.price_ht <= 0 OR v_ttc < v_sub.price_ht THEN
    RETURN jsonb_build_object('received',true,'ignored','payment_mismatch');
  END IF;
  IF (v_sub.plan IN ('pro','b2b_gold')) <> (v_sub.customer_type='b2b') THEN
    RAISE EXCEPTION 'subscription customer type mismatch' USING ERRCODE='check_violation';
  END IF;
  v_expires := v_started + CASE WHEN v_sub.plan='gold_annual' THEN interval '12 months' ELSE interval '1 month' END;

  -- The row lock serializes duplicate notifications. Any subsequent error rolls
  -- back this update, the invoice counter, grace closure and B2B role together.
  UPDATE public.subscriptions SET status='active', started_at=v_started,
    expires_at=v_expires, grace_until=NULL WHERE id=v_sub.id;
  UPDATE public.subscriptions SET status='expired'
    WHERE customer_id=v_sub.customer_id AND status='grace' AND id<>v_sub.id;
  IF v_sub.customer_type='b2b' THEN
    SELECT spawter_id INTO v_payer FROM public.customers WHERE id=v_sub.customer_id;
    UPDATE public.b2b_accounts
      SET role=CASE WHEN v_sub.plan='b2b_gold' THEN 'gold' ELSE 'pro' END
      WHERE auth_user_id=v_payer AND is_active;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'active B2B account required' USING ERRCODE='P0002';
    END IF;
  END IF;
  INSERT INTO public.invoices (
    subscription_id,customer_id,customer_type,price_ht,tva_rate,tva_amount,
    price_ttc,currency,status,provider_tx_id,issued_at,paid_at
  ) VALUES (
    v_sub.id,v_sub.customer_id,v_sub.customer_type,v_sub.price_ht,v_sub.tva_rate,
    v_ttc-v_sub.price_ht,v_ttc,v_sub.currency,'paid',p_transaction_id,
    v_started,coalesce(p_paid_at,v_started)
  ) RETURNING id INTO v_invoice;
  RETURN jsonb_build_object('received',true,'status','active','invoice_id',v_invoice,
    'expires_at',v_expires,'price_ttc',v_ttc);
END $$;
REVOKE ALL ON FUNCTION public.confirm_provider_payment(text,text,integer,text,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_provider_payment(text,text,integer,text,timestamptz) TO service_role;
COMMENT ON FUNCTION public.confirm_provider_payment(text,text,integer,text,timestamptz) IS
  'Service role only, after authenticated provider confirmation. Exact frozen amount and currency; atomic activation, grace closure, B2B role and invoice. Idempotent, no reactivation of expired/grace subscriptions.';
NOTIFY pgrst, 'reload schema';

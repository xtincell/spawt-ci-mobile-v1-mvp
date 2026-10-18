-- Deploy the previous webhook first. Existing invoices/subscriptions are kept.
DROP FUNCTION IF EXISTS public.confirm_provider_payment(text,text,integer,text,timestamptz);
NOTIFY pgrst, 'reload schema';

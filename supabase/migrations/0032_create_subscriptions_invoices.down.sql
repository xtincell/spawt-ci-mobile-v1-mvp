-- Rollback 0032 — Drop subscriptions + invoices + entitlements

DROP VIEW IF EXISTS public.active_entitlements;

DROP TRIGGER IF EXISTS trg_invoices_before_insert ON public.invoices;
DROP FUNCTION IF EXISTS public.invoices_before_insert();
DROP FUNCTION IF EXISTS public.next_invoice_number();

DROP POLICY IF EXISTS invoices_select_own       ON public.invoices;
DROP POLICY IF EXISTS invoices_select_admin     ON public.invoices;
DROP POLICY IF EXISTS subscriptions_select_own   ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_select_admin ON public.subscriptions;

DROP TABLE IF EXISTS public.invoices;
DROP TABLE IF EXISTS public.invoice_counters;

DROP TRIGGER IF EXISTS update_timestamp_subscriptions ON public.subscriptions;
DROP TABLE IF EXISTS public.subscriptions;

-- ============================================================================
-- Migration 0002 — DOWN
-- ============================================================================
-- Drop dans l'ordre inverse de création + drop de la FK différée AVANT le
-- DROP TABLE customers (sinon erreur dépendance).

DROP TRIGGER  IF EXISTS spawters_customer_id_owned ON public.spawters;
DROP FUNCTION IF EXISTS public.assert_spawter_customer_owned();

DROP POLICY IF EXISTS customers_select_own    ON public.customers;
DROP POLICY IF EXISTS customers_insert_own    ON public.customers;
DROP POLICY IF EXISTS customers_update_own    ON public.customers;
DROP POLICY IF EXISTS customers_select_staff  ON public.customers;
DROP POLICY IF EXISTS plans_select_active     ON public.plans;
DROP POLICY IF EXISTS currencies_select_all   ON public.currencies;

DROP TRIGGER IF EXISTS update_timestamp_customers  ON public.customers;
DROP TRIGGER IF EXISTS update_timestamp_plans      ON public.plans;
DROP TRIGGER IF EXISTS update_timestamp_currencies ON public.currencies;

-- Drop la FK différée AVANT le DROP TABLE customers.
ALTER TABLE public.spawters
  DROP CONSTRAINT IF EXISTS spawters_customer_id_fkey;

DROP TABLE IF EXISTS public.customers  CASCADE;
DROP TABLE IF EXISTS public.plans      CASCADE;
DROP TABLE IF EXISTS public.currencies CASCADE;

-- Rollback 0023 — Drop column-level guards admin

-- 3. UNIQUE constraints (safe drop)
ALTER TABLE public.places DROP CONSTRAINT IF EXISTS places_name_neighborhood_key;
ALTER TABLE public.spawters DROP CONSTRAINT IF EXISTS spawters_phone_e164_key;

-- 2. spawt_checkin trigger + function
DROP TRIGGER IF EXISTS spawt_checkin_assert_staff_update ON public.spawt_checkin;
DROP FUNCTION IF EXISTS public.assert_spawt_checkin_staff_update_columns();

-- 1. spawters trigger + function
DROP TRIGGER IF EXISTS spawters_assert_update_columns ON public.spawters;
DROP FUNCTION IF EXISTS public.assert_spawters_update_columns_allowlist();

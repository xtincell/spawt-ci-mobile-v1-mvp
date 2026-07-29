-- Rollback 0021 — Revert RLS review visibility + staff helpers

-- 3. Revert spawt_staff_select_admin (restaure la version auto-référente, à risque recursion)
DROP POLICY IF EXISTS "spawt_staff_select_admin" ON public.spawt_staff;
CREATE POLICY "spawt_staff_select_admin"
  ON public.spawt_staff
  FOR SELECT
  TO public
  USING (EXISTS (
    SELECT 1 FROM public.spawt_staff s
    WHERE s.id = auth.uid() AND s.role = 'admin' AND s.is_active = true
  ));

DROP FUNCTION IF EXISTS public.is_admin_staff(uuid);
DROP FUNCTION IF EXISTS public.is_active_staff(uuid);

-- 2. Drop spawters_public view
DROP VIEW IF EXISTS public.spawters_public;

-- 1. Drop spawt_checkin_select_published_reviews policy
DROP POLICY IF EXISTS "spawt_checkin_select_published_reviews" ON public.spawt_checkin;

-- Rollback 0026 — Drop review_reports

DROP TRIGGER IF EXISTS trg_review_reports_resolution ON public.review_reports;
DROP FUNCTION IF EXISTS public.review_reports_autopopulate_resolution();
DROP POLICY IF EXISTS "review_reports_update_staff" ON public.review_reports;
DROP POLICY IF EXISTS "review_reports_select_staff" ON public.review_reports;
DROP POLICY IF EXISTS "review_reports_select_own" ON public.review_reports;
DROP POLICY IF EXISTS "review_reports_insert_own" ON public.review_reports;
DROP INDEX IF EXISTS idx_review_reports_checkin;
DROP INDEX IF EXISTS idx_review_reports_pending;
DROP TABLE IF EXISTS public.review_reports;

-- Rollback 0036 — Drop badges (catalogue + attribution)

DROP TRIGGER IF EXISTS trg_check_badges_spawt_verified ON public.spawt_checkin;
DROP TRIGGER IF EXISTS trg_check_badges_spawt_insert   ON public.spawt_checkin;
DROP FUNCTION IF EXISTS public.trg_check_badges_on_spawt();
DROP FUNCTION IF EXISTS public.check_and_award_badges(uuid);

DROP TRIGGER IF EXISTS trg_spawter_badges_columns ON public.spawter_badges;
DROP FUNCTION IF EXISTS public.assert_spawter_badges_update_columns();
DROP TRIGGER IF EXISTS trg_max_displayed_badges ON public.spawter_badges;
DROP FUNCTION IF EXISTS public.assert_max_displayed_badges();

DROP TABLE IF EXISTS public.spawter_badges;
DROP TABLE IF EXISTS public.badge_catalogue;

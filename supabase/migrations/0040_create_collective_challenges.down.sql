-- Rollback 0040 — Drop défis collectifs + streaks

DROP TRIGGER IF EXISTS trg_challenges_review_attached ON public.spawt_checkin;
DROP TRIGGER IF EXISTS trg_challenges_spawt_verified  ON public.spawt_checkin;
DROP TRIGGER IF EXISTS trg_challenges_spawt_insert    ON public.spawt_checkin;
DROP FUNCTION IF EXISTS public.advance_collective_challenges();

DROP TABLE IF EXISTS public.spawter_streaks;
DROP TABLE IF EXISTS public.challenge_progress;

DROP TRIGGER IF EXISTS trg_init_challenge_progress ON public.challenges;
DROP FUNCTION IF EXISTS public.init_challenge_progress();
DROP TABLE IF EXISTS public.challenges;

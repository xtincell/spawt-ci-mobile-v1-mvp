-- Down 0048 — retire la clôture hôte (retour au comportement 0038 :
-- aucun UPDATE client sur crew_sessions).
DROP POLICY IF EXISTS crew_sessions_update_host ON public.crew_sessions;
DROP TRIGGER IF EXISTS trg_crew_sessions_guard_update ON public.crew_sessions;
DROP FUNCTION IF EXISTS public.crew_sessions_guard_update();

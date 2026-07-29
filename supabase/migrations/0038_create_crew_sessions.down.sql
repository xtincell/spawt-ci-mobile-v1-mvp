-- Rollback 0038 — Drop Mode Crew

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime
    DROP TABLE public.crew_votes, public.crew_members, public.crew_proposals;
EXCEPTION
  WHEN undefined_object THEN NULL;  -- publication absente ou tables non publiées
END $$;

DROP FUNCTION IF EXISTS public.join_crew_session(text, uuid);
DROP FUNCTION IF EXISTS public.create_crew_session(uuid);

DROP TABLE IF EXISTS public.crew_votes;
DROP TABLE IF EXISTS public.crew_proposals;
DROP TABLE IF EXISTS public.crew_members;
DROP TABLE IF EXISTS public.crew_sessions;

DROP FUNCTION IF EXISTS public.crew_session_is_joinable(uuid);
DROP FUNCTION IF EXISTS public.is_crew_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.generate_crew_code();

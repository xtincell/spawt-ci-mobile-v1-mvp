-- Version finale 07/2026 — clôture du Mode Crew par l'hôte (complète 0038).
--
-- 0038 ne définissait aucune policy UPDATE sur crew_sessions : l'app faisait
-- un UPDATE best-effort (0 ligne) et la révélation passait uniquement par le
-- broadcast realtime. Cette migration donne à l'HÔTE le droit de clore SA
-- session, avec un trigger de garde qui verrouille les transitions d'état —
-- le client existant (`resolveSession` dans app/src/lib/crew/) fonctionne
-- alors sans changement.

-- 1. Trigger de garde : seules les transitions légales passent, et les
--    colonnes d'identité de la session sont immuables (pattern 0023).
CREATE OR REPLACE FUNCTION public.crew_sessions_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role (Edge/admin) garde les mains libres (expiration forcée, SAV).
  IF current_setting('request.jwt.claims', true) IS NULL
     OR (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Identité immuable.
  IF NEW.code IS DISTINCT FROM OLD.code
     OR NEW.host_id IS DISTINCT FROM OLD.host_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    RAISE EXCEPTION 'crew_sessions: colonnes immuables (code, host_id, created_at, expires_at)';
  END IF;

  -- Transitions légales : open→voting|resolved|expired, voting→resolved|expired.
  -- Jamais de retour en arrière (un vote tranché reste tranché).
  IF NOT (
    (OLD.status = 'open'   AND NEW.status IN ('open', 'voting', 'resolved', 'expired')) OR
    (OLD.status = 'voting' AND NEW.status IN ('voting', 'resolved', 'expired'))
  ) THEN
    RAISE EXCEPTION 'crew_sessions: transition % → % interdite', OLD.status, NEW.status;
  END IF;

  -- winning_place_id : posable uniquement en passant resolved, et doit être
  -- une proposition réelle de la session (pas un lieu arbitraire).
  IF NEW.winning_place_id IS DISTINCT FROM OLD.winning_place_id THEN
    IF NEW.status <> 'resolved' THEN
      RAISE EXCEPTION 'crew_sessions: winning_place_id ne se pose qu''en resolved';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.crew_proposals p
      WHERE p.session_id = NEW.id AND p.place_id = NEW.winning_place_id
    ) THEN
      RAISE EXCEPTION 'crew_sessions: winning_place_id doit être une proposition de la session';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crew_sessions_guard_update ON public.crew_sessions;
CREATE TRIGGER trg_crew_sessions_guard_update
  BEFORE UPDATE ON public.crew_sessions
  FOR EACH ROW EXECUTE FUNCTION public.crew_sessions_guard_update();

-- 2. Policy UPDATE : l'hôte, sur SA session encore vivante. Le trigger
--    ci-dessus porte la sémantique fine des transitions.
DROP POLICY IF EXISTS crew_sessions_update_host ON public.crew_sessions;
CREATE POLICY crew_sessions_update_host ON public.crew_sessions
  FOR UPDATE TO authenticated
  USING (host_id = auth.uid() AND status IN ('open', 'voting'))
  WITH CHECK (host_id = auth.uid());

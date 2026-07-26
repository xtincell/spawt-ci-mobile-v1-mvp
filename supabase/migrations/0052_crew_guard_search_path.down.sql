-- Down 0052 — restaure le search_path `public` seul (état 0048).
CREATE OR REPLACE FUNCTION public.crew_sessions_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claims', true) IS NULL
     OR (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.code IS DISTINCT FROM OLD.code
     OR NEW.host_id IS DISTINCT FROM OLD.host_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    RAISE EXCEPTION 'crew_sessions: colonnes immuables (code, host_id, created_at, expires_at)';
  END IF;
  IF NOT (
    (OLD.status = 'open'   AND NEW.status IN ('open', 'voting', 'resolved', 'expired')) OR
    (OLD.status = 'voting' AND NEW.status IN ('voting', 'resolved', 'expired'))
  ) THEN
    RAISE EXCEPTION 'crew_sessions: transition % → % interdite', OLD.status, NEW.status;
  END IF;
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

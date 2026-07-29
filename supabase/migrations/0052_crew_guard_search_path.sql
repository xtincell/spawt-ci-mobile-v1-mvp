-- Sécurité D9 (défense en profondeur) — aligne le search_path du garde
-- crew_sessions_guard_update (0048) sur la convention des autres fonctions
-- SECURITY DEFINER du schéma : `public, pg_temp`.
--
-- La fonction était déjà sûre (toutes ses tables sont schema-qualifiées
-- `public.crew_proposals`), mais figer `pg_temp` en fin de search_path retire
-- tout risque qu'un objet temporaire homonyme soit résolu avant `public`.
-- CREATE OR REPLACE conserve le trigger existant (même signature).

CREATE OR REPLACE FUNCTION public.crew_sessions_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
  IF NOT (
    (OLD.status = 'open'   AND NEW.status IN ('open', 'voting', 'resolved', 'expired')) OR
    (OLD.status = 'voting' AND NEW.status IN ('voting', 'resolved', 'expired'))
  ) THEN
    RAISE EXCEPTION 'crew_sessions: transition % → % interdite', OLD.status, NEW.status;
  END IF;

  -- winning_place_id : posable uniquement en resolved, et doit être une
  -- proposition réelle de la session.
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

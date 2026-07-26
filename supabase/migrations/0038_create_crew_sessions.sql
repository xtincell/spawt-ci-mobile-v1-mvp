-- ============================================================================
-- Migration 0038 — Mode Crew : sessions de décision de groupe
-- ============================================================================
-- « On mange où ce soir ? » à plusieurs : un hôte ouvre une session, partage
-- un code court (5 caractères), le crew rejoint, propose des lieux et vote.
-- Temps réel via Supabase Realtime (publication) — le front s'abonne aux
-- votes/membres/propositions de SA session.
--
-- RLS : tout est scoped à la session — un spawter ne lit QUE les sessions
-- dont il est membre. L'entrée se fait par code via join_crew_session
-- (SECURITY DEFINER : le candidat n'est pas encore membre, il ne peut donc
-- pas « voir » la session — la fonction vérifie le code à sa place).
-- Un vote par (proposal, spawter) : garanti par la PK, pas par du code.
-- Date : 2026-07-26

-- ━━━ Générateur de code : 5 caractères A-Z / 2-9 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 0, 1, O et I exclus (ambigus à l'oral / à l'écran — le code se partage en
-- vocal dans un maquis bruyant).
CREATE OR REPLACE FUNCTION public.generate_crew_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  alphabet CONSTANT text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..5 LOOP
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- ━━━ Tables ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE public.crew_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text NOT NULL UNIQUE,
  host_id          uuid REFERENCES public.spawters(id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','voting','resolved','expired')),
  winning_place_id uuid REFERENCES public.places(id) ON DELETE SET NULL,
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.crew_sessions IS
  'Session Mode Crew. code = clé d''entrée partagée (5 chars A-Z/2-9 sans '
  'ambigus). Session courte : expires_at posé à la création (2h).';

CREATE TABLE public.crew_members (
  session_id uuid NOT NULL REFERENCES public.crew_sessions(id) ON DELETE CASCADE,
  spawter_id uuid NOT NULL REFERENCES public.spawters(id) ON DELETE CASCADE,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, spawter_id)
);

CREATE TABLE public.crew_proposals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES public.crew_sessions(id) ON DELETE CASCADE,
  place_id    uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  proposed_by uuid REFERENCES public.spawters(id) ON DELETE SET NULL,
  UNIQUE (session_id, place_id)
);

CREATE TABLE public.crew_votes (
  session_id  uuid NOT NULL REFERENCES public.crew_sessions(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.crew_proposals(id) ON DELETE CASCADE,
  spawter_id  uuid NOT NULL REFERENCES public.spawters(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- Un seul vote par proposition et par spawter — le schéma l'impose, pas le code.
  PRIMARY KEY (proposal_id, spawter_id)
);

CREATE INDEX crew_members_spawter_idx   ON public.crew_members (spawter_id);
CREATE INDEX crew_proposals_session_idx ON public.crew_proposals (session_id);
CREATE INDEX crew_votes_session_idx     ON public.crew_votes (session_id);

-- ━━━ Helpers RLS (SECURITY DEFINER, anti-recursion — pattern 0021) ━━━━━━━━━━━
-- is_crew_member : « suis-je membre de cette session ? » — bypass la RLS de
-- crew_members (qui elle-même a besoin de cette réponse → recursion sinon).
CREATE OR REPLACE FUNCTION public.is_crew_member(p_session uuid, p_spawter uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.crew_members m
    WHERE m.session_id = p_session AND m.spawter_id = p_spawter
  );
$$;

-- crew_session_is_joinable : la session existe, est open, non expirée —
-- vérifié en bypass RLS (le candidat ne voit pas encore la session).
CREATE OR REPLACE FUNCTION public.crew_session_is_joinable(p_session uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.crew_sessions s
    WHERE s.id = p_session AND s.status = 'open' AND s.expires_at > now()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_crew_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crew_session_is_joinable(uuid) TO authenticated;

-- ━━━ Row-Level Security ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.crew_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_votes     ENABLE ROW LEVEL SECURITY;

-- Sessions : visibles des membres uniquement (l'hôte est inséré membre à la
-- création par create_crew_session).
CREATE POLICY crew_sessions_select_member ON public.crew_sessions
  FOR SELECT TO authenticated
  USING (public.is_crew_member(id));

-- Membres : chacun voit la composition de SES sessions.
CREATE POLICY crew_members_select_member ON public.crew_members
  FOR SELECT TO authenticated
  USING (public.is_crew_member(session_id));

-- Rejoindre : s'insérer SOI-MÊME dans une session open non expirée. Le code
-- d'entrée est vérifié par join_crew_session ; cette policy couvre aussi un
-- insert direct qui connaîtrait l'uuid de session (même garanties).
CREATE POLICY crew_members_insert_self ON public.crew_members
  FOR INSERT TO authenticated
  WITH CHECK (
    spawter_id = auth.uid()
    AND public.crew_session_is_joinable(session_id)
  );

-- Quitter la session : retirer sa propre ligne.
CREATE POLICY crew_members_delete_self ON public.crew_members
  FOR DELETE TO authenticated
  USING (spawter_id = auth.uid());

-- Propositions : lecture membre ; proposition par un membre, en son nom,
-- session encore ouverte au vote.
CREATE POLICY crew_proposals_select_member ON public.crew_proposals
  FOR SELECT TO authenticated
  USING (public.is_crew_member(session_id));

CREATE POLICY crew_proposals_insert_member ON public.crew_proposals
  FOR INSERT TO authenticated
  WITH CHECK (
    proposed_by = auth.uid()
    AND public.is_crew_member(session_id)
    AND EXISTS (
      SELECT 1 FROM public.crew_sessions s
      WHERE s.id = session_id
        AND s.status IN ('open','voting')
        AND s.expires_at > now()
    )
  );

-- Votes : lecture membre ; voter soi-même, si membre, sur une proposition de
-- la MÊME session (pas de vote cross-session). La PK bloque le double vote.
CREATE POLICY crew_votes_select_member ON public.crew_votes
  FOR SELECT TO authenticated
  USING (public.is_crew_member(session_id));

CREATE POLICY crew_votes_insert_member ON public.crew_votes
  FOR INSERT TO authenticated
  WITH CHECK (
    spawter_id = auth.uid()
    AND public.is_crew_member(session_id)
    AND EXISTS (
      SELECT 1 FROM public.crew_proposals p
      WHERE p.id = proposal_id AND p.session_id = crew_votes.session_id
    )
  );

-- ━━━ RPC : créer / rejoindre ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- create_crew_session : session + hôte membre, code unique (retry collision).
-- Session courte par design : 2h — un crew qui n'a pas décidé en 2h a déjà
-- commandé ailleurs.
CREATE OR REPLACE FUNCTION public.create_crew_session(p_host uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text;
  v_session public.crew_sessions%ROWTYPE;
  v_attempts integer := 0;
BEGIN
  -- Le caller ne crée une session QUE pour lui-même (service_role : libre).
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_host THEN
    RAISE EXCEPTION 'create_crew_session forbidden: host mismatch auth.uid()'
      USING ERRCODE = '42501';
  END IF;

  LOOP
    v_attempts := v_attempts + 1;
    v_code := public.generate_crew_code();
    BEGIN
      INSERT INTO public.crew_sessions (code, host_id, expires_at)
      VALUES (v_code, p_host, now() + interval '2 hours')
      RETURNING * INTO v_session;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempts >= 5 THEN
        RAISE EXCEPTION 'create_crew_session: code collision x5 — réessayer';
      END IF;
    END;
  END LOOP;

  INSERT INTO public.crew_members (session_id, spawter_id)
  VALUES (v_session.id, p_host)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'ok', true,
    'session_id', v_session.id,
    'code', v_session.code,
    'expires_at', v_session.expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.join_crew_session(p_code text, p_spawter uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session public.crew_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_spawter THEN
    RAISE EXCEPTION 'join_crew_session forbidden: spawter mismatch auth.uid()'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_session
  FROM public.crew_sessions
  WHERE code = upper(trim(p_code));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'session_not_found');
  END IF;
  IF v_session.status <> 'open' OR v_session.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'session_closed');
  END IF;

  INSERT INTO public.crew_members (session_id, spawter_id)
  VALUES (v_session.id, p_spawter)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'ok', true,
    'session_id', v_session.id,
    'status', v_session.status,
    'expires_at', v_session.expires_at);
END;
$$;

COMMENT ON FUNCTION public.create_crew_session(uuid) IS
  'Mode Crew — crée une session (code 5 chars, 2h) et enrôle l''hôte.';
COMMENT ON FUNCTION public.join_crew_session(text, uuid) IS
  'Mode Crew — rejoint une session par code. SECURITY DEFINER : le candidat '
  'n''est pas encore membre donc la RLS ne lui montre pas la session.';

REVOKE EXECUTE ON FUNCTION public.create_crew_session(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_crew_session(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_crew_session(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_crew_session(text, uuid) TO authenticated, service_role;

-- ━━━ Realtime : publication des votes/membres/propositions ━━━━━━━━━━━━━━━━━━
-- L'app s'abonne aux changements de SA session (RLS s'applique aussi au
-- stream Realtime). DO block : en env local/test la publication
-- supabase_realtime peut ne pas exister — on ignore proprement.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime
    ADD TABLE public.crew_votes, public.crew_members, public.crew_proposals;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'publication supabase_realtime absente (env local/test) — étape ignorée';
  WHEN duplicate_object THEN
    RAISE NOTICE 'tables déjà dans supabase_realtime — étape ignorée';
END $$;

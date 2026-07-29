-- Sprint 2 — Tests SQL 0038 (Mode Crew : RLS membre-only + anti double vote).
-- Exécution manuelle locale : psql < supabase/tests/crew_rls.sql
-- Chaque scénario en BEGIN/ROLLBACK — non destructif.
-- Prérequis : >= 3 spawters + >= 1 place publiée. On simule les callers
-- PostgREST : SET LOCAL ROLE authenticated + request.jwt.claims.sub, comme le
-- ferait GoTrue.

\set ON_ERROR_STOP on
\timing on

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario unique (flux complet) —
--   1. hôte crée une session (create_crew_session) et la voit ;
--   2. un NON-membre ne voit RIEN (session/membres/propositions) ;
--   3. il rejoint par code (join_crew_session) et voit la session ;
--   4. l'hôte propose un lieu, le membre vote ;
--   5. le DOUBLE vote sur la même proposition est rejeté par la PK ;
--   6. un non-membre ne peut pas voter (RLS).
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;

CREATE TEMP TABLE actors ON COMMIT DROP AS
SELECT row_number() OVER (ORDER BY id) AS n, id
FROM public.spawters LIMIT 3;

CREATE TEMP TABLE sess (session_id uuid, code text) ON COMMIT DROP;
CREATE TEMP TABLE prop (id uuid) ON COMMIT DROP;

-- Les tables temp appartiennent au superuser du test : on les ouvre au rôle
-- authenticated que l'on va endosser.
GRANT ALL ON TABLE actors, sess, prop TO authenticated;

-- 1. L'hôte (actor 1) crée la session.
SELECT set_config('request.jwt.claims',
  json_build_object('sub', id, 'role', 'authenticated')::text, true)
FROM actors WHERE n = 1;
SET LOCAL ROLE authenticated;

INSERT INTO sess
SELECT (r ->> 'session_id')::uuid, r ->> 'code'
FROM (SELECT public.create_crew_session((SELECT id FROM actors WHERE n = 1)) AS r) t;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.crew_sessions
      WHERE id = (SELECT session_id FROM sess)) <> 1 THEN
    RAISE EXCEPTION 'ASSERT FAIL: l''hôte doit voir sa session';
  END IF;
  IF (SELECT count(*) FROM public.crew_members
      WHERE session_id = (SELECT session_id FROM sess)) <> 1 THEN
    RAISE EXCEPTION 'ASSERT FAIL: l''hôte doit être membre à la création';
  END IF;
  RAISE NOTICE 'Étape 1 OK — session créée, hôte membre et lecteur';
END $$;

-- 2. Un non-membre (actor 2) ne voit rien.
RESET ROLE;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', id, 'role', 'authenticated')::text, true)
FROM actors WHERE n = 2;
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.crew_sessions
      WHERE id = (SELECT session_id FROM sess)) <> 0
     OR (SELECT count(*) FROM public.crew_members
         WHERE session_id = (SELECT session_id FROM sess)) <> 0 THEN
    RAISE EXCEPTION 'ASSERT FAIL: un non-membre ne doit RIEN voir de la session';
  END IF;
  RAISE NOTICE 'Étape 2 OK — non-membre aveugle (RLS)';
END $$;

-- 3. Il rejoint par code (mauvais code d'abord, puis le bon).
DO $$
DECLARE
  v_res jsonb;
  v_me uuid;
BEGIN
  SELECT id INTO v_me FROM actors WHERE n = 2;

  v_res := public.join_crew_session('ZZZZZ', v_me);
  IF (v_res ->> 'ok')::boolean THEN
    RAISE EXCEPTION 'ASSERT FAIL: code invalide accepté — %', v_res;
  END IF;

  v_res := public.join_crew_session((SELECT code FROM sess), v_me);
  IF NOT (v_res ->> 'ok')::boolean THEN
    RAISE EXCEPTION 'ASSERT FAIL: join par code valide refusé — %', v_res;
  END IF;

  IF (SELECT count(*) FROM public.crew_sessions
      WHERE id = (SELECT session_id FROM sess)) <> 1 THEN
    RAISE EXCEPTION 'ASSERT FAIL: le nouveau membre doit voir la session';
  END IF;
  RAISE NOTICE 'Étape 3 OK — join par code, session visible';
END $$;

-- 4. L'hôte propose un lieu…
RESET ROLE;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', id, 'role', 'authenticated')::text, true)
FROM actors WHERE n = 1;
SET LOCAL ROLE authenticated;

WITH ins AS (
  INSERT INTO public.crew_proposals (session_id, place_id, proposed_by)
  SELECT (SELECT session_id FROM sess),
         (SELECT id FROM public.places WHERE is_published LIMIT 1),
         (SELECT id FROM actors WHERE n = 1)
  RETURNING id
)
INSERT INTO prop SELECT id FROM ins;

-- …et le membre (actor 2) vote.
RESET ROLE;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', id, 'role', 'authenticated')::text, true)
FROM actors WHERE n = 2;
SET LOCAL ROLE authenticated;

INSERT INTO public.crew_votes (session_id, proposal_id, spawter_id)
VALUES ((SELECT session_id FROM sess), (SELECT id FROM prop),
        (SELECT id FROM actors WHERE n = 2));

-- 5. Double vote : rejeté par la PK (proposal_id, spawter_id).
DO $$
BEGIN
  BEGIN
    INSERT INTO public.crew_votes (session_id, proposal_id, spawter_id)
    VALUES ((SELECT session_id FROM sess), (SELECT id FROM prop),
            (SELECT id FROM actors WHERE n = 2));
    RAISE EXCEPTION 'ASSERT FAIL: double vote accepté';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'Étape 5 OK — double vote rejeté par la PK';
  END;
END $$;

-- 6. Un non-membre (actor 3) ne peut pas voter.
RESET ROLE;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', id, 'role', 'authenticated')::text, true)
FROM actors WHERE n = 3;
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.crew_votes (session_id, proposal_id, spawter_id)
    VALUES ((SELECT session_id FROM sess), (SELECT id FROM prop),
            (SELECT id FROM actors WHERE n = 3));
    RAISE EXCEPTION 'ASSERT FAIL: vote d''un non-membre accepté';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    -- 42501 : new row violates row-level security policy
    RAISE NOTICE 'Étape 6 OK — vote non-membre rejeté par la RLS';
  END;
END $$;

-- Bilan : exactement 1 vote enregistré.
RESET ROLE;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.crew_votes
      WHERE session_id = (SELECT session_id FROM sess)) <> 1 THEN
    RAISE EXCEPTION 'ASSERT FAIL: exactement 1 vote attendu';
  END IF;
  RAISE NOTICE 'Scenario OK — RLS crew membre-only + PK anti double vote';
END $$;
ROLLBACK;

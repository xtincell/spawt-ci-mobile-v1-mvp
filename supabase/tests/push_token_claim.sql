-- Tests SQL 0051 — claim_push_token réattribue un token au device courant
-- (finding P2#10). Exécution manuelle locale : psql < supabase/tests/push_token_claim.sql
-- BEGIN/ROLLBACK, fixtures auto-portées.
--
-- Prouve :
--   1. Un 2e spawter réclame le token d'un 1er → la ligne bascule (spawter_id
--      passe de A à B), le token physique reste unique (1 seule ligne).
--   2. Un token neuf réclamé crée une ligne possédée par le caller.
--   3. Sans caller authentifié (pas de sub) → rejet 42501.

\set ON_ERROR_STOP on
\timing on

BEGIN;

DO $$
DECLARE
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_owner uuid;
  v_rows  integer;
BEGIN
  INSERT INTO auth.users (id) VALUES (v_a), (v_b);
  INSERT INTO public.spawters (id, phone_e164, display_name)
    VALUES (v_a, '+2250700000010', 'Compte A'),
           (v_b, '+2250700000011', 'Compte B');

  -- A enregistre le token du device (upsert direct, comme le 1er login sur ce device).
  INSERT INTO public.push_tokens (spawter_id, token, platform)
    VALUES (v_a, 'ExpoPushToken[DEVICE-XYZ]', 'android');

  -- (1) B se connecte sur le MÊME device après un logout non-propre de A :
  -- il réclame le token → la ligne bascule à B (l'upsert client direct aurait
  -- échoué sous la RLS UPDATE owner-only de A).
  PERFORM set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', v_b::text)::text, true);
  PERFORM public.claim_push_token('ExpoPushToken[DEVICE-XYZ]', 'android');

  SELECT count(*) INTO v_rows
    FROM public.push_tokens WHERE token = 'ExpoPushToken[DEVICE-XYZ]';
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'ASSERT FAIL: le token doit rester unique (1 ligne), trouvé %', v_rows;
  END IF;
  SELECT spawter_id INTO v_owner
    FROM public.push_tokens WHERE token = 'ExpoPushToken[DEVICE-XYZ]';
  IF v_owner <> v_b THEN
    RAISE EXCEPTION 'ASSERT FAIL: la ligne doit basculer à B, propriétaire = %', v_owner;
  END IF;

  -- (2) Token neuf : réclamé par B → ligne possédée par B, platform posée.
  PERFORM public.claim_push_token('ExpoPushToken[NOUVEAU]', 'ios');
  IF NOT EXISTS (
    SELECT 1 FROM public.push_tokens
    WHERE token = 'ExpoPushToken[NOUVEAU]' AND spawter_id = v_b AND platform = 'ios'
  ) THEN
    RAISE EXCEPTION 'ASSERT FAIL: un token neuf doit créer une ligne possédée par le caller';
  END IF;

  -- (3) Sans caller authentifié (pas de sub) → rejet 42501.
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  BEGIN
    PERFORM public.claim_push_token('ExpoPushToken[ANON]', 'android');
    RAISE EXCEPTION 'ASSERT FAIL: claim sans caller authentifié doit être rejeté';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL; -- attendu (42501)
  END;

  RAISE NOTICE 'push_token_claim OK — bascule A→B, token neuf, rejet anon';
END $$;
ROLLBACK;

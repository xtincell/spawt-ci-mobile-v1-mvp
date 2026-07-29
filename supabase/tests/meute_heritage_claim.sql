-- Tests SQL 0051 — claim_meute_heritage réclamable pour un nouveau spawter
-- (finding P0). Exécution manuelle locale : psql < supabase/tests/meute_heritage_claim.sql
-- Chaque scénario en BEGIN/ROLLBACK — non destructif, fixtures auto-portées
-- (crée ses propres auth.users / spawters / meute_waitlist).
--
-- Prouve :
--   1. Claim AVANT existence de la ligne spawters → ne perd pas l'héritage :
--      la ligne est créée ensuite (avec un archétype calculé LOCALEMENT, comme
--      finalizeOnboarding), puis un re-claim récupère l'héritage (le critère
--      « déjà réclamé » est heritage_claimed_at, PAS quiz_archetype).
--   2. Idempotence : un 3e claim = no-op already_claimed.
--   3. No-op si le téléphone est inconnu de la waitlist.
--   4. Propriétaire authentifié : réclame par le téléphone de SA ligne
--      (p_phone client ignoré → anti-usurpation) ; un non-propriétaire est
--      rejeté.

\set ON_ERROR_STOP on
\timing on

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 1 — claim avant la ligne spawters, puis récupération au re-claim.
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

INSERT INTO public.meute_waitlist
  (id, phone, email, archetype, archetype_name, axes, referral_code, referred_by, pseudo)
VALUES
  ('claim-test-1', '+2250700000001', 'pio1@test.ci', 'murmure', 'Murmure de Cour',
   '{"F":1,"S":-1}', 'MEUTE-CLM1', 'MEUTE-PARR', 'PionUn');

DO $$
DECLARE
  v_id  uuid := gen_random_uuid();
  v_seq integer;
  v_res jsonb;
BEGIN
  SELECT seq INTO v_seq FROM public.meute_waitlist WHERE id = 'claim-test-1';

  -- (1a) Claim AVANT la ligne spawters : spawter_pending, aucun flag posé,
  -- héritage NON perdu (rien de définitif écrit).
  v_res := public.claim_meute_heritage(v_id, '+2250700000001');
  IF (v_res ->> 'claimed')::boolean OR v_res ->> 'code' <> 'spawter_pending' THEN
    RAISE EXCEPTION 'ASSERT FAIL: claim avant ligne spawters doit renvoyer spawter_pending — %', v_res;
  END IF;

  -- La ligne est créée ensuite (finalizeOnboarding) AVEC un archétype calculé
  -- LOCALEMENT (le piège historique : quiz_archetype posé localement != héritage).
  INSERT INTO auth.users (id) VALUES (v_id);
  INSERT INTO public.spawters (id, phone_e164, display_name, quiz_archetype)
    VALUES (v_id, '+2250700000001', 'Pionnier Test', 'gardien');

  -- (1b) Re-claim : l'héritage est récupéré MALGRÉ quiz_archetype déjà posé.
  v_res := public.claim_meute_heritage(v_id, '+2250700000001');
  IF NOT (v_res ->> 'claimed')::boolean
     OR v_res ->> 'archetype' <> 'murmure'
     OR (v_res ->> 'pionnier_seq')::integer <> v_seq THEN
    RAISE EXCEPTION 'ASSERT FAIL: re-claim après création doit récupérer l''héritage — %', v_res;
  END IF;

  -- L'archétype local 'gardien' a été ÉCRASÉ par l'héritage 'murmure' ; le rang
  -- Pionnier et le parrainage sont copiés ; heritage_claimed_at posé.
  IF NOT EXISTS (
    SELECT 1 FROM public.spawters
    WHERE id = v_id
      AND quiz_archetype = 'murmure'
      AND quiz_axes = '{"F":1,"S":-1}'::jsonb
      AND pionnier_seq = v_seq
      AND referral_code = 'MEUTE-CLM1'
      AND referred_by = 'MEUTE-PARR'
      AND heritage_claimed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'ASSERT FAIL: héritage non écrit / archétype local non écrasé';
  END IF;

  -- (2) Idempotence : 3e claim = no-op already_claimed (critère heritage_claimed_at).
  v_res := public.claim_meute_heritage(v_id, '+2250700000001');
  IF (v_res ->> 'claimed')::boolean
     OR v_res ->> 'code' <> 'already_claimed'
     OR v_res ->> 'archetype' <> 'murmure' THEN
    RAISE EXCEPTION 'ASSERT FAIL: 3e claim doit être no-op already_claimed — %', v_res;
  END IF;

  RAISE NOTICE 'Scenario 1 OK — héritage récupéré après création tardive + idempotent';
END $$;
ROLLBACK;

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 3 — téléphone inconnu de la waitlist : no-op propre, spawter intact.
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

DO $$
DECLARE
  v_id  uuid := gen_random_uuid();
  v_res jsonb;
BEGIN
  INSERT INTO auth.users (id) VALUES (v_id);
  INSERT INTO public.spawters (id, phone_e164, display_name)
    VALUES (v_id, '+2250700000009', 'Non Pionnier');

  v_res := public.claim_meute_heritage(v_id, '+2250700000009');
  IF (v_res ->> 'claimed')::boolean OR v_res ->> 'code' <> 'phone_not_in_waitlist' THEN
    RAISE EXCEPTION 'ASSERT FAIL: téléphone inconnu doit être no-op — %', v_res;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.spawters
    WHERE id = v_id AND (quiz_archetype IS NOT NULL OR heritage_claimed_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'ASSERT FAIL: spawter modifié alors que téléphone inconnu';
  END IF;

  RAISE NOTICE 'Scenario 3 OK — téléphone inconnu = no-op, spawter intact';
END $$;
ROLLBACK;

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 4 — propriétaire authentifié : réclame par le téléphone de SA ligne
-- (le p_phone fourni par le client est IGNORÉ → anti-usurpation) ; un
-- non-propriétaire authentifié est rejeté (42501).
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;

-- Fixtures : un pionnier + un intrus (rôle authenticated posé par scénario).
INSERT INTO public.meute_waitlist (id, phone, archetype, axes, referral_code)
VALUES ('claim-test-4', '+2250700000004', 'lame', '{"E":1}', 'MEUTE-CLM4');

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_seq   integer;
  v_res   jsonb;
BEGIN
  SELECT seq INTO v_seq FROM public.meute_waitlist WHERE id = 'claim-test-4';
  INSERT INTO auth.users (id) VALUES (v_owner), (v_other);
  INSERT INTO public.spawters (id, phone_e164, display_name)
    VALUES (v_owner, '+2250700000004', 'Pionnier Owner'),
           (v_other, '+2250700000099', 'Intrus');

  -- Propriétaire authentifié : réclame avec un p_phone client BIDON — la
  -- fonction doit utiliser le téléphone de SA ligne (+2250700000004) et donc
  -- matcher la waitlist quand même.
  PERFORM set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', v_owner::text)::text, true);
  v_res := public.claim_meute_heritage(v_owner, '+225BIDON00000');
  IF NOT (v_res ->> 'claimed')::boolean
     OR v_res ->> 'archetype' <> 'lame'
     OR (v_res ->> 'pionnier_seq')::integer <> v_seq THEN
    RAISE EXCEPTION 'ASSERT FAIL: owner authentifié doit réclamer par le téléphone de sa ligne — %', v_res;
  END IF;

  -- Non-propriétaire authentifié : tente de réclamer la ligne de l'owner → rejet.
  PERFORM set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', v_other::text)::text, true);
  BEGIN
    v_res := public.claim_meute_heritage(v_owner, '+2250700000004');
    RAISE EXCEPTION 'ASSERT FAIL: un non-propriétaire ne doit PAS pouvoir réclamer (obtenu %)', v_res;
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL; -- attendu (42501)
  END;

  RAISE NOTICE 'Scenario 4 OK — owner réclame par sa ligne, intrus rejeté';
END $$;
ROLLBACK;

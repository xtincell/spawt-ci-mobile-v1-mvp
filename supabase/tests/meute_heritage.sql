-- Sprint 2 — Tests SQL 0033 (claim_meute_heritage) + carte archétype 0037.
-- Exécution manuelle locale : psql < supabase/tests/meute_heritage.sql
-- Chaque scénario en BEGIN/ROLLBACK — non destructif.
-- Prérequis : spawters peuplés. Le claim UPDATE spawters → il faut le claim
-- service_role (comme en prod : Edge Function post-OTP), sinon le guard
-- column-level 0023 rejette.

\set ON_ERROR_STOP on
\timing on

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 1 — Claim nominal : copie archetype/axes/seq/referral + carte
-- collector archétype déposée (trigger 0037). Puis re-claim = no-op
-- idempotent. Puis téléphone inconnu = no-op.
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- Pionnier fictif dans la waitlist du quiz (téléphone du spawter fixture #1).
INSERT INTO public.meute_waitlist
  (id, phone, email, archetype, archetype_name, axes, referral_code, pseudo)
SELECT 'test-heritage-1', s.phone_e164, 'pionnier@test.ci',
       'pisteur', 'Pisteur de Rue', '{"T":1,"M":-1}', 'MEUTE-TST1', 'AwaDuGarba'
FROM public.spawters s
WHERE s.quiz_archetype IS NULL AND s.pionnier_seq IS NULL
LIMIT 1;

DO $$
DECLARE
  v_spawter uuid;
  v_seq integer;
  v_res jsonb;
  v_cards integer;
BEGIN
  SELECT s.id INTO v_spawter FROM public.spawters s
  JOIN public.meute_waitlist w ON w.phone = s.phone_e164
  WHERE w.id = 'test-heritage-1';
  SELECT w.seq INTO v_seq FROM public.meute_waitlist w WHERE w.id = 'test-heritage-1';

  -- 1er claim : copie effectuée.
  v_res := public.claim_meute_heritage(
    v_spawter, (SELECT phone_e164 FROM public.spawters WHERE id = v_spawter));
  IF NOT (v_res ->> 'claimed')::boolean
     OR v_res ->> 'archetype' <> 'pisteur'
     OR (v_res ->> 'pionnier_seq')::integer <> v_seq THEN
    RAISE EXCEPTION 'ASSERT FAIL: claim nominal — %', v_res;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.spawters s
    WHERE s.id = v_spawter
      AND s.quiz_archetype = 'pisteur'
      AND s.quiz_axes = '{"T":1,"M":-1}'::jsonb
      AND s.pionnier_seq = v_seq
      AND s.referral_code = 'MEUTE-TST1'
  ) THEN
    RAISE EXCEPTION 'ASSERT FAIL: colonnes héritage non copiées sur spawters';
  END IF;

  -- Carte archétype déposée par le trigger 0037 (source heritage_quiz).
  SELECT count(*) INTO v_cards
  FROM public.spawter_cards sc
  JOIN public.collectible_cards c ON c.id = sc.card_id
  WHERE sc.spawter_id = v_spawter
    AND c.code = 'pisteur' AND c.kind = 'archetype'
    AND sc.source = 'heritage_quiz';
  IF v_cards <> 1 THEN
    RAISE EXCEPTION 'ASSERT FAIL: carte archétype attendue (1), trouvé %', v_cards;
  END IF;

  -- 2e claim : no-op idempotent (claimed=false, valeurs existantes renvoyées).
  v_res := public.claim_meute_heritage(
    v_spawter, (SELECT phone_e164 FROM public.spawters WHERE id = v_spawter));
  IF (v_res ->> 'claimed')::boolean
     OR v_res ->> 'code' <> 'already_claimed'
     OR v_res ->> 'archetype' <> 'pisteur' THEN
    RAISE EXCEPTION 'ASSERT FAIL: re-claim doit être no-op — %', v_res;
  END IF;

  -- Toujours une seule carte.
  SELECT count(*) INTO v_cards
  FROM public.spawter_cards sc WHERE sc.spawter_id = v_spawter;
  IF v_cards <> 1 THEN
    RAISE EXCEPTION 'ASSERT FAIL: re-claim a dupliqué la carte (%)', v_cards;
  END IF;

  RAISE NOTICE 'Scenario 1 OK — claim + carte, re-claim idempotent';
END $$;
ROLLBACK;

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 2 — Téléphone absent de la waitlist : no-op propre
-- (claimed=false, spawter intact).
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

DO $$
DECLARE
  v_spawter uuid;
  v_res jsonb;
BEGIN
  SELECT id INTO v_spawter FROM public.spawters
  WHERE quiz_archetype IS NULL AND pionnier_seq IS NULL
  LIMIT 1;

  v_res := public.claim_meute_heritage(v_spawter, '+2250799999999');
  IF (v_res ->> 'claimed')::boolean
     OR v_res ->> 'code' <> 'phone_not_in_waitlist' THEN
    RAISE EXCEPTION 'ASSERT FAIL: téléphone inconnu doit être no-op — %', v_res;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.spawters WHERE id = v_spawter AND quiz_archetype IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'ASSERT FAIL: spawter modifié alors que téléphone inconnu';
  END IF;

  RAISE NOTICE 'Scenario 2 OK — téléphone inconnu = no-op';
END $$;
ROLLBACK;

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 3 — axes invalide (JSON cassé) : le claim passe quand même,
-- quiz_axes reste NULL (cast défensif).
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

INSERT INTO public.meute_waitlist (id, phone, archetype, axes, referral_code)
SELECT 'test-heritage-3', s.phone_e164, 'gardien', '{pas du json', 'MEUTE-TST3'
FROM public.spawters s
WHERE s.quiz_archetype IS NULL AND s.pionnier_seq IS NULL
LIMIT 1;

DO $$
DECLARE
  v_spawter uuid;
  v_res jsonb;
BEGIN
  SELECT s.id INTO v_spawter FROM public.spawters s
  JOIN public.meute_waitlist w ON w.phone = s.phone_e164
  WHERE w.id = 'test-heritage-3';

  v_res := public.claim_meute_heritage(
    v_spawter, (SELECT phone_e164 FROM public.spawters WHERE id = v_spawter));
  IF NOT (v_res ->> 'claimed')::boolean THEN
    RAISE EXCEPTION 'ASSERT FAIL: claim doit passer malgré axes invalide — %', v_res;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.spawters
    WHERE id = v_spawter AND (quiz_axes IS NOT NULL OR quiz_archetype <> 'gardien')
  ) THEN
    RAISE EXCEPTION 'ASSERT FAIL: quiz_axes devrait être NULL, archetype copié';
  END IF;

  RAISE NOTICE 'Scenario 3 OK — axes invalide toléré (quiz_axes NULL)';
END $$;
ROLLBACK;

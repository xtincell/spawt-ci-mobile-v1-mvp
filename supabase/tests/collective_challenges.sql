-- Sprint 2 — Tests SQL 0040 (défis collectifs + streaks).
-- Exécution manuelle locale : psql < supabase/tests/collective_challenges.sql
-- Chaque scénario en BEGIN/ROLLBACK — non destructif.
-- Prérequis : spawters + places peuplés, exécution superuser/service_role.

\set ON_ERROR_STOP on
\timing on

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 1 — INVARIANT DE SCHÉMA (Contrat SPAWT) : challenge_progress n'a
-- AUCUNE colonne spawter_id (pas de classement individuel possible, par
-- construction) et sa PK est challenge_id (une seule ligne par défi).
-- ───────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v integer;
BEGIN
  SELECT count(*) INTO v
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'challenge_progress'
    AND column_name = 'spawter_id';
  IF v <> 0 THEN
    RAISE EXCEPTION 'ASSERT FAIL: challenge_progress porte une colonne spawter_id — violation du Contrat SPAWT (aucun classement individuel)';
  END IF;

  SELECT count(*) INTO v
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage k
    ON k.constraint_name = tc.constraint_name
   AND k.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'challenge_progress'
    AND tc.constraint_type = 'PRIMARY KEY'
    AND k.column_name = 'challenge_id';
  IF v <> 1 THEN
    RAISE EXCEPTION 'ASSERT FAIL: la PK de challenge_progress doit être challenge_id (1 ligne par défi)';
  END IF;

  RAISE NOTICE 'Scenario 1 OK — schéma sans spawter_id, PK = challenge_id';
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 2 — Progress agrégé : le défi actif spawts_total avance à chaque
-- spawt vérifié de N'IMPORTE quel spawter ; les seeds ne comptent pas ;
-- une ligne de progression naît avec le challenge (trigger init).
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

INSERT INTO public.challenges
  (code, title_key, description_key, period_start, period_end,
   goal_type, goal_target, reward_paws, status)
VALUES
  ('test_defi_spawts', 'challenge.test_defi_spawts.title',
   'challenge.test_defi_spawts.description',
   (now() AT TIME ZONE 'UTC')::date - 7, (now() AT TIME ZONE 'UTC')::date + 7,
   'spawts_total', 500, 20, 'active');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.challenge_progress cp
    JOIN public.challenges c ON c.id = cp.challenge_id
    WHERE c.code = 'test_defi_spawts' AND cp.current_value = 0
  ) THEN
    RAISE EXCEPTION 'ASSERT FAIL: ligne challenge_progress absente à la création';
  END IF;
END $$;

-- 2 spawts vérifiés de 2 spawters différents (lieux distincts, > 4h d'écart).
INSERT INTO public.spawt_checkin
  (spawter_id, place_id, arrived_at, check_in_type, geolocation_source, is_verified)
SELECT a.id, p.id, now() - interval '6 hours', 'active', 'gps', true
FROM (SELECT id FROM public.spawters ORDER BY id LIMIT 1) a,
     (SELECT id FROM public.places WHERE is_published LIMIT 1) p;

INSERT INTO public.spawt_checkin
  (spawter_id, place_id, arrived_at, check_in_type, geolocation_source, is_verified)
SELECT a.id, p.id, now() - interval '1 hour', 'active', 'gps', true
FROM (SELECT id FROM public.spawters ORDER BY id OFFSET 1 LIMIT 1) a,
     (SELECT id FROM public.places WHERE is_published OFFSET 1 LIMIT 1) p;

-- Un seed ne compte pas.
INSERT INTO public.spawt_checkin
  (spawter_id, place_id, arrived_at, check_in_type, geolocation_source,
   is_verified, is_seed)
SELECT a.id, p.id, now(), 'manual', 'manual', true, true
FROM (SELECT id FROM public.spawters ORDER BY id OFFSET 2 LIMIT 1) a,
     (SELECT id FROM public.places WHERE is_published OFFSET 2 LIMIT 1) p;

DO $$
DECLARE v integer;
BEGIN
  SELECT cp.current_value INTO v
  FROM public.challenge_progress cp
  JOIN public.challenges c ON c.id = cp.challenge_id
  WHERE c.code = 'test_defi_spawts';
  IF v <> 2 THEN
    RAISE EXCEPTION 'ASSERT FAIL: progress attendu 2 (2 spawts vérifiés, seed exclu), trouvé %', v;
  END IF;
  RAISE NOTICE 'Scenario 2 OK — progress collectif = 2, seed exclu';
END $$;
ROLLBACK;

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 3 — Streak privé : 1er spawt de la semaine → current_weeks = 1 ;
-- un spawt de la MÊME semaine ne double pas ; la semaine SUIVANTE incrémente.
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- Semaine 1 (il y a 2 semaines) : 2 spawts même semaine.
INSERT INTO public.spawt_checkin
  (spawter_id, place_id, arrived_at, check_in_type, geolocation_source, is_verified)
SELECT a.id, p.id, date_trunc('week', now() AT TIME ZONE 'UTC') - interval '14 days' + interval '10 hours',
       'active', 'gps', true
FROM (SELECT id FROM public.spawters ORDER BY id LIMIT 1) a,
     (SELECT id FROM public.places WHERE is_published LIMIT 1) p;

INSERT INTO public.spawt_checkin
  (spawter_id, place_id, arrived_at, check_in_type, geolocation_source, is_verified)
SELECT a.id, p.id, date_trunc('week', now() AT TIME ZONE 'UTC') - interval '14 days' + interval '30 hours',
       'active', 'gps', true
FROM (SELECT id FROM public.spawters ORDER BY id LIMIT 1) a,
     (SELECT id FROM public.places WHERE is_published OFFSET 1 LIMIT 1) p;

DO $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM public.spawter_streaks
  WHERE spawter_id = (SELECT id FROM public.spawters ORDER BY id LIMIT 1);
  IF r.current_weeks <> 1 OR r.best_weeks <> 1 THEN
    RAISE EXCEPTION 'ASSERT FAIL: même semaine → streak reste 1, trouvé current=% best=%',
      r.current_weeks, r.best_weeks;
  END IF;
END $$;

-- Semaine 2 (consécutive) : le streak passe à 2.
INSERT INTO public.spawt_checkin
  (spawter_id, place_id, arrived_at, check_in_type, geolocation_source, is_verified)
SELECT a.id, p.id, date_trunc('week', now() AT TIME ZONE 'UTC') - interval '7 days' + interval '12 hours',
       'active', 'gps', true
FROM (SELECT id FROM public.spawters ORDER BY id LIMIT 1) a,
     (SELECT id FROM public.places WHERE is_published OFFSET 2 LIMIT 1) p;

DO $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM public.spawter_streaks
  WHERE spawter_id = (SELECT id FROM public.spawters ORDER BY id LIMIT 1);
  IF r.current_weeks <> 2 OR r.best_weeks <> 2 THEN
    RAISE EXCEPTION 'ASSERT FAIL: semaine consécutive → streak 2, trouvé current=% best=%',
      r.current_weeks, r.best_weeks;
  END IF;
  RAISE NOTICE 'Scenario 3 OK — streak hebdo : même semaine stable, consécutive +1';
END $$;
ROLLBACK;

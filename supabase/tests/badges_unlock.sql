-- Sprint 2 — Tests SQL 0036 (check_and_award_badges + trigger + max 3 affichés).
-- Exécution manuelle locale : psql < supabase/tests/badges_unlock.sql
-- Chaque scénario en BEGIN/ROLLBACK — non destructif.
-- Prérequis : spawters peuplés + catalogue 0036 seedé, exécution
-- superuser/service_role.
-- NB : timestamps espacés > 4h et lieux distincts (anti-fraude 0012) ; dates
-- en semaine (mercredi/jeudi) pour ne pas polluer spawts_weekend.

\set ON_ERROR_STOP on
\timing on

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 1 — premier_spawt au 1er spawt vérifié, traversee (5 communes
-- distinctes) au 5e. L'attribution passe par le trigger AFTER INSERT.
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- 5 lieux de test dans 5 communes distinctes (noms uniques —
-- UNIQUE(name, neighborhood) 0023).
INSERT INTO public.places
  (name, cuisine, lat, lng, descriptive_address, neighborhood, price_tier, is_published)
VALUES
  ('Test Badge Maquis 1', ARRAY['ivoirienne'], 5.30, -4.00, 'test', 'TestCommune1', 1, true),
  ('Test Badge Maquis 2', ARRAY['ivoirienne'], 5.31, -4.01, 'test', 'TestCommune2', 1, true),
  ('Test Badge Maquis 3', ARRAY['libanaise'],  5.32, -4.02, 'test', 'TestCommune3', 1, true),
  ('Test Badge Maquis 4', ARRAY['fusion'],     5.33, -4.03, 'test', 'TestCommune4', 1, true),
  ('Test Badge Maquis 5', ARRAY['grillades'],  5.34, -4.04, 'test', 'TestCommune5', 2, true);

-- 1er spawt vérifié → premier_spawt.
INSERT INTO public.spawt_checkin
  (spawter_id, place_id, arrived_at, check_in_type, geolocation_source, is_verified)
SELECT s.id, p.id, '2026-07-22T08:00:00Z', 'active', 'gps', true
FROM public.spawters s, public.places p
WHERE p.name = 'Test Badge Maquis 1' LIMIT 1;

DO $$
DECLARE v_spawter uuid;
BEGIN
  SELECT spawter_id INTO v_spawter FROM public.spawt_checkin
  WHERE arrived_at = '2026-07-22T08:00:00Z';

  IF NOT EXISTS (
    SELECT 1 FROM public.spawter_badges
    WHERE spawter_id = v_spawter AND badge_code = 'premier_spawt'
  ) THEN
    RAISE EXCEPTION 'ASSERT FAIL: premier_spawt non attribué au 1er spawt vérifié';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.spawter_badges
    WHERE spawter_id = v_spawter AND badge_code = 'traversee'
  ) THEN
    RAISE EXCEPTION 'ASSERT FAIL: traversee attribué trop tôt (1 commune)';
  END IF;
  RAISE NOTICE 'Scenario 1a OK — premier_spawt au 1er spawt, traversee pas encore';
END $$;

-- Spawts 2 à 5 (4 autres communes, espacés > 4h).
INSERT INTO public.spawt_checkin
  (spawter_id, place_id, arrived_at, check_in_type, geolocation_source, is_verified)
SELECT sc.spawter_id, p.id, x.ts::timestamptz, 'active', 'gps', true
FROM (SELECT DISTINCT spawter_id FROM public.spawt_checkin
      WHERE arrived_at = '2026-07-22T08:00:00Z') sc,
LATERAL (VALUES
  ('Test Badge Maquis 2', '2026-07-22T13:00:00Z'),
  ('Test Badge Maquis 3', '2026-07-22T18:00:00Z'),
  ('Test Badge Maquis 4', '2026-07-22T23:30:00Z'),
  ('Test Badge Maquis 5', '2026-07-23T05:00:00Z')
) AS x(place_name, ts)
JOIN public.places p ON p.name = x.place_name;

DO $$
DECLARE
  v_spawter uuid;
  v_new integer;
BEGIN
  SELECT spawter_id INTO v_spawter FROM public.spawt_checkin
  WHERE arrived_at = '2026-07-22T08:00:00Z';

  IF NOT EXISTS (
    SELECT 1 FROM public.spawter_badges
    WHERE spawter_id = v_spawter AND badge_code = 'traversee'
  ) THEN
    RAISE EXCEPTION 'ASSERT FAIL: traversee non attribué après 5 communes distinctes';
  END IF;

  -- Re-évaluation manuelle : aucun NOUVEAU badge (idempotence).
  SELECT count(*) INTO v_new FROM public.check_and_award_badges(v_spawter);
  IF v_new <> 0 THEN
    RAISE EXCEPTION 'ASSERT FAIL: re-évaluation doit être vide, % nouveau(x)', v_new;
  END IF;

  RAISE NOTICE 'Scenario 1b OK — traversee à 5 communes, ré-évaluation idempotente';
END $$;
ROLLBACK;

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 2 — calibre (10 avis) via évaluation directe : 10 avis publiés
-- sur 10 lieux → check_and_award_badges retourne le code une seule fois.
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- 10 lieux + 10 spawts avec avis, espacés 5h (2 jours de semaine).
INSERT INTO public.places
  (name, cuisine, lat, lng, descriptive_address, neighborhood, price_tier, is_published)
SELECT 'Test Calibre ' || g, ARRAY['ivoirienne'], 5.3 + g * 0.01, -4.0, 'test',
       'TestCalibreCommune', 1, true
FROM generate_series(1, 10) g;

INSERT INTO public.spawt_checkin
  (spawter_id, place_id, arrived_at, check_in_type, geolocation_source,
   is_verified, note_etoiles)
SELECT s.id, p.id,
       '2026-07-20T08:00:00Z'::timestamptz + (p.g - 1) * interval '5 hours',
       'active', 'gps', true, 4
FROM (SELECT id FROM public.spawters ORDER BY id LIMIT 1) s,
     (SELECT id, (substring(name FROM 'Test Calibre (\d+)'))::integer AS g
      FROM public.places WHERE name LIKE 'Test Calibre %') p;

DO $$
DECLARE
  v_spawter uuid;
BEGIN
  SELECT id INTO v_spawter FROM public.spawters ORDER BY id LIMIT 1;

  IF NOT EXISTS (
    SELECT 1 FROM public.spawter_badges
    WHERE spawter_id = v_spawter AND badge_code = 'calibre'
  ) THEN
    RAISE EXCEPTION 'ASSERT FAIL: calibre non attribué après 10 avis';
  END IF;
  RAISE NOTICE 'Scenario 2 OK — calibre (10 avis) attribué';
END $$;
ROLLBACK;

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 3 — Maximum 3 badges affichés : le 4e is_displayed=true est rejeté.
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

INSERT INTO public.spawter_badges (spawter_id, badge_code, is_displayed)
SELECT s.id, b.code, true
FROM (SELECT id FROM public.spawters ORDER BY id LIMIT 1) s,
     (VALUES ('premier_spawt'), ('traversee'), ('noctambule')) AS b(code);

DO $$
DECLARE v_spawter uuid;
BEGIN
  SELECT id INTO v_spawter FROM public.spawters ORDER BY id LIMIT 1;
  BEGIN
    INSERT INTO public.spawter_badges (spawter_id, badge_code, is_displayed)
    VALUES (v_spawter, 'calibre', true);
    RAISE EXCEPTION 'ASSERT FAIL: 4e badge affiché accepté';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'Scenario 3 OK — max 3 badges affichés (4e rejeté)';
  END;
END $$;
ROLLBACK;

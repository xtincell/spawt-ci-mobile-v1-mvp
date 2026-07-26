-- Sprint 2 — Tests SQL 0035 (paws_ledger append-only + attribution).
-- Exécution manuelle locale : psql < supabase/tests/paws_ledger.sql
-- Chaque scénario en BEGIN/ROLLBACK — non destructif.
-- Prérequis : spawters + places peuplés, exécution superuser/service_role.
-- NB : timestamps espacés > 4h pour ne pas déclencher l'anti-fraude 0012.

\set ON_ERROR_STOP on
\timing on

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 1 — Attribution : +10 au spawt vérifié (INSERT), +10 au passage
-- is_verified false→true (UPDATE), +5 à l'avis attaché. Solde = 25.
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- a. Spawt vérifié dès l'INSERT → +10.
INSERT INTO public.spawt_checkin
  (spawter_id, place_id, arrived_at, check_in_type, geolocation_source, is_verified)
SELECT s.id, p.id, '2026-07-20T10:00:00Z', 'active', 'gps', true
FROM public.spawters s, public.places p LIMIT 1;

-- b. Spawt non vérifié (autre lieu, +5h) → 0 paw à l'insert…
INSERT INTO public.spawt_checkin
  (spawter_id, place_id, arrived_at, check_in_type, geolocation_source, is_verified)
SELECT s.id, p.id, '2026-07-20T15:00:00Z', 'manual', 'manual', false
FROM public.spawters s,
     (SELECT id FROM public.places OFFSET 1 LIMIT 1) p
LIMIT 1;

DO $$
DECLARE v integer;
BEGIN
  -- Scope par ref_id : robuste même si la base contient déjà des paws.
  SELECT coalesce(sum(l.delta), 0) INTO v FROM public.paws_ledger l
  WHERE l.reason = 'spawt_verifie'
    AND l.ref_id IN (SELECT id FROM public.spawt_checkin
                     WHERE arrived_at IN ('2026-07-20T10:00:00Z','2026-07-20T15:00:00Z'));
  IF v <> 10 THEN
    RAISE EXCEPTION 'ASSERT FAIL: +10 attendu après 1 spawt vérifié, solde spawt_verifie=%', v;
  END IF;
END $$;

-- …puis passe vérifié → +10.
UPDATE public.spawt_checkin SET is_verified = true
WHERE arrived_at = '2026-07-20T15:00:00Z';

-- c. Avis attaché après coup → +5.
UPDATE public.spawt_checkin SET note_etoiles = 4, tags = ARRAY['copieux']
WHERE arrived_at = '2026-07-20T15:00:00Z';

-- Une note ÉDITÉE ne re-crédite pas.
UPDATE public.spawt_checkin SET note_etoiles = 5
WHERE arrived_at = '2026-07-20T15:00:00Z';

DO $$
DECLARE
  v_total integer;
  v_avis integer;
BEGIN
  SELECT coalesce(sum(l.delta), 0) INTO v_total FROM public.paws_ledger l
  WHERE l.ref_id IN (SELECT id FROM public.spawt_checkin
                     WHERE arrived_at IN ('2026-07-20T10:00:00Z','2026-07-20T15:00:00Z'));
  IF v_total <> 25 THEN
    RAISE EXCEPTION 'ASSERT FAIL: total attendu 25 (10+10+5), trouvé %', v_total;
  END IF;

  SELECT count(*) INTO v_avis FROM public.paws_ledger l
  WHERE l.reason = 'avis_publie'
    AND l.ref_id IN (SELECT id FROM public.spawt_checkin
                     WHERE arrived_at IN ('2026-07-20T10:00:00Z','2026-07-20T15:00:00Z'));
  IF v_avis <> 1 THEN
    RAISE EXCEPTION 'ASSERT FAIL: 1 seule ligne avis_publie attendue (note éditée ne re-crédite pas), trouvé %', v_avis;
  END IF;

  -- La vue paws_balance reflète bien le ledger du spawter.
  IF NOT EXISTS (
    SELECT 1 FROM public.paws_balance b
    WHERE b.spawter_id = (SELECT spawter_id FROM public.spawt_checkin
                          WHERE arrived_at = '2026-07-20T10:00:00Z')
      AND b.balance >= 25
  ) THEN
    RAISE EXCEPTION 'ASSERT FAIL: paws_balance ne reflète pas le ledger';
  END IF;

  RAISE NOTICE 'Scenario 1 OK — +10 insert vérifié, +10 passage vérifié, +5 avis, total 25';
END $$;
ROLLBACK;

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 2 — Append-only : UPDATE et DELETE directs rejetés.
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

INSERT INTO public.spawt_checkin
  (spawter_id, place_id, arrived_at, check_in_type, geolocation_source, is_verified)
SELECT s.id, p.id, '2026-07-21T10:00:00Z', 'active', 'gps', true
FROM public.spawters s, public.places p LIMIT 1;

DO $$
BEGIN
  BEGIN
    UPDATE public.paws_ledger SET delta = 1000000;
    RAISE EXCEPTION 'ASSERT FAIL: UPDATE paws_ledger accepté';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM !~ 'append-only' THEN RAISE; END IF;
    RAISE NOTICE 'Scenario 2a OK — UPDATE rejeté (append-only)';
  END;

  BEGIN
    DELETE FROM public.paws_ledger;
    RAISE EXCEPTION 'ASSERT FAIL: DELETE paws_ledger accepté';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM !~ 'append-only' THEN RAISE; END IF;
    RAISE NOTICE 'Scenario 2b OK — DELETE direct rejeté (append-only)';
  END;
END $$;
ROLLBACK;

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 3 — Exclusions : seed et annulé ne créditent pas.
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

INSERT INTO public.spawt_checkin
  (spawter_id, place_id, arrived_at, check_in_type, geolocation_source,
   is_verified, is_seed, note_etoiles)
SELECT s.id, p.id, '2026-07-22T10:00:00Z', 'manual', 'manual', true, true, 4
FROM public.spawters s, public.places p LIMIT 1;

INSERT INTO public.spawt_checkin
  (spawter_id, place_id, arrived_at, check_in_type, geolocation_source,
   is_verified, is_cancelled)
SELECT s.id, p.id, '2026-07-22T16:00:00Z', 'active', 'gps', true, true
FROM public.spawters s, public.places p LIMIT 1;

DO $$
DECLARE v integer;
BEGIN
  SELECT count(*) INTO v FROM public.paws_ledger l
  WHERE l.ref_id IN (SELECT id FROM public.spawt_checkin
                     WHERE arrived_at IN ('2026-07-22T10:00:00Z','2026-07-22T16:00:00Z'));
  IF v <> 0 THEN
    RAISE EXCEPTION 'ASSERT FAIL: seed/annulé ont crédité % ligne(s)', v;
  END IF;
  RAISE NOTICE 'Scenario 3 OK — seed et annulé ne créditent pas';
END $$;
ROLLBACK;

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 4 — Suppression de compte (NFR-SEC-04) : le cascade DELETE depuis
-- spawters emporte le ledger SANS être bloqué par le trigger append-only.
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

INSERT INTO public.spawt_checkin
  (spawter_id, place_id, arrived_at, check_in_type, geolocation_source, is_verified)
SELECT s.id, p.id, '2026-07-23T10:00:00Z', 'active', 'gps', true
FROM public.spawters s, public.places p LIMIT 1;

DO $$
DECLARE
  v_spawter uuid;
  v integer;
BEGIN
  SELECT spawter_id INTO v_spawter FROM public.spawt_checkin
  WHERE arrived_at = '2026-07-23T10:00:00Z';

  -- Le cascade doit passer (le trigger laisse passer quand le parent a disparu).
  DELETE FROM public.spawters WHERE id = v_spawter;

  SELECT count(*) INTO v FROM public.paws_ledger WHERE spawter_id = v_spawter;
  IF v <> 0 THEN
    RAISE EXCEPTION 'ASSERT FAIL: cascade suppression de compte n''a pas purgé le ledger (%)', v;
  END IF;
  RAISE NOTICE 'Scenario 4 OK — cascade suppression de compte purge le ledger';
END $$;
ROLLBACK;

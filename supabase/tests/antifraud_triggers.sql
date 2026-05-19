-- Story 4.4 — Tests SQL des 6 triggers anti-fraude.
-- Reproductibilité Stéphanie (alpha). Exécution manuelle local :
--   psql < supabase/tests/antifraud_triggers.sql
-- Chaque scénario en transaction BEGIN/ROLLBACK pour rester non-destructif.

\set ON_ERROR_STOP off
\timing on

-- Prérequis : tables `spawters` + `places` peuplées, RLS désactivable (service_role).

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 1 — frequence_meme_lieu : 2 spawts < 4h sur même lieu (verified)
-- Attendu : INSERT #2 REJETÉ
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
INSERT INTO spawt_checkin (spawter_id, place_id, arrived_at, check_in_type, geolocation_source, is_verified)
  SELECT s.id, p.id, '2026-05-20T10:00:00Z'::timestamptz, 'active', 'gps', true
  FROM spawters s, places p LIMIT 1;
-- Doit lever : antifraud_frequence_meme_lieu
INSERT INTO spawt_checkin (spawter_id, place_id, arrived_at, check_in_type, geolocation_source, is_verified)
  SELECT s.id, p.id, '2026-05-20T13:00:00Z'::timestamptz, 'active', 'gps', true
  FROM spawters s, places p LIMIT 1;
ROLLBACK;

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 2 — 5h après → OK sans flag
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
INSERT INTO spawt_checkin (spawter_id, place_id, arrived_at, check_in_type, geolocation_source, is_verified)
  SELECT s.id, p.id, '2026-05-20T10:00:00Z'::timestamptz, 'active', 'gps', true
  FROM spawters s, places p LIMIT 1;
INSERT INTO spawt_checkin (spawter_id, place_id, arrived_at, check_in_type, geolocation_source, is_verified)
  SELECT s.id, p.id, '2026-05-20T15:00:00Z'::timestamptz, 'active', 'gps', true
  FROM spawters s, places p LIMIT 1;
SELECT flag_reason FROM spawt_checkin WHERE arrived_at = '2026-05-20T15:00:00Z'; -- expect: NULL
ROLLBACK;

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 3 — `sans_geoloc` (is_verified=false + check_in_type='manual')
-- Attendu : flag_reason = 'sans_geoloc'
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
INSERT INTO spawt_checkin (spawter_id, place_id, arrived_at, check_in_type, geolocation_source, is_verified)
  SELECT s.id, p.id, '2026-05-20T16:00:00Z'::timestamptz, 'manual', 'manual', false
  FROM spawters s, places p LIMIT 1;
SELECT flag_reason FROM spawt_checkin WHERE arrived_at = '2026-05-20T16:00:00Z'; -- expect: 'sans_geoloc'
ROLLBACK;

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 4 — passive non-verified : pas de flag (passive natural)
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
INSERT INTO spawt_checkin (spawter_id, place_id, arrived_at, check_in_type, geolocation_source, is_verified)
  SELECT s.id, p.id, '2026-05-20T17:00:00Z'::timestamptz, 'passive', 'gps', false
  FROM spawters s, places p LIMIT 1;
SELECT flag_reason FROM spawt_checkin WHERE arrived_at = '2026-05-20T17:00:00Z'; -- expect: NULL
ROLLBACK;

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 5 — incoherence_duree (active + left_at - arrived_at < 5min)
-- Attendu : flag_reason = 'incoherence_duree'
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
INSERT INTO spawt_checkin (spawter_id, place_id, arrived_at, check_in_type, geolocation_source, is_verified, left_at)
  SELECT s.id, p.id, '2026-05-20T18:00:00Z'::timestamptz, 'active', 'gps', true, '2026-05-20T18:03:00Z'
  FROM spawters s, places p LIMIT 1;
SELECT flag_reason FROM spawt_checkin WHERE arrived_at = '2026-05-20T18:00:00Z'; -- expect: 'incoherence_duree'
ROLLBACK;

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 6 — seed bypass : tout flag ignoré pour is_seed = true
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
INSERT INTO spawt_checkin (spawter_id, place_id, arrived_at, check_in_type, geolocation_source, is_verified, is_seed)
  SELECT s.id, p.id, '2026-05-20T19:00:00Z'::timestamptz, 'manual', 'manual', false, true
  FROM spawters s, places p LIMIT 1;
SELECT flag_reason FROM spawt_checkin WHERE arrived_at = '2026-05-20T19:00:00Z'; -- expect: NULL
ROLLBACK;

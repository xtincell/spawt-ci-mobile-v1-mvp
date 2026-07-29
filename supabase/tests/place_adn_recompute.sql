-- Câblage MVP — Tests SQL du trigger recompute_place_adn_on_review (0025).
-- Exécution manuelle locale : psql < supabase/tests/place_adn_recompute.sql
-- Chaque scénario en BEGIN/ROLLBACK — non destructif.
-- Prérequis : spawters + places peuplés, exécution service_role (bypass RLS).
-- NB : les timestamps sont espacés >4h pour ne pas déclencher l'anti-fraude 0012.

\set ON_ERROR_STOP off
\timing on

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 1 — Premier avis (INSERT avec note) : total_reviews 0→1,
-- weighted_rating = note, confidence > 0, updated_at rafraîchi.
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
SELECT total_reviews, weighted_rating, confidence_score
  FROM place_adn WHERE place_id = (SELECT id FROM places LIMIT 1); -- avant
INSERT INTO spawt_checkin (spawter_id, place_id, arrived_at, check_in_type, geolocation_source, is_verified, note_etoiles, tags)
  SELECT s.id, p.id, '2026-06-25T10:00:00Z'::timestamptz, 'active', 'gps', true, 4, ARRAY['copieux']
  FROM spawters s, places p LIMIT 1;
SELECT total_reviews, weighted_rating, confidence_score
  FROM place_adn WHERE place_id = (SELECT id FROM places LIMIT 1);
-- expect: total_reviews = avant+1 ; si avant=0 → weighted_rating = 4.0
ROLLBACK;

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 2 — Flux Le Guet : INSERT pending sans note (pas de recompute),
-- puis UPDATE qui attache la note → recompute déclenché une seule fois.
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
INSERT INTO spawt_checkin (spawter_id, place_id, arrived_at, check_in_type, geolocation_source, is_verified)
  SELECT s.id, p.id, '2026-06-25T18:00:00Z'::timestamptz, 'active', 'gps', true
  FROM spawters s, places p LIMIT 1;
SELECT total_reviews FROM place_adn WHERE place_id = (SELECT id FROM places LIMIT 1);
-- expect: inchangé (pas de note)
UPDATE spawt_checkin SET note_etoiles = 5, tags = ARRAY['ambiance_top','a_refaire']
  WHERE arrived_at = '2026-06-25T18:00:00Z';
SELECT total_reviews, weighted_rating FROM place_adn WHERE place_id = (SELECT id FROM places LIMIT 1);
-- expect: total_reviews +1
UPDATE spawt_checkin SET note_etoiles = 2
  WHERE arrived_at = '2026-06-25T18:00:00Z';
SELECT total_reviews FROM place_adn WHERE place_id = (SELECT id FROM places LIMIT 1);
-- expect: INCHANGÉ (note éditée ≠ nouvelle note — pas de double-comptage)
ROLLBACK;

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 3 — Avis seed : total_reviews inchangé, confidence_score augmente.
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
INSERT INTO spawt_checkin (spawter_id, place_id, arrived_at, check_in_type, geolocation_source, is_verified, note_etoiles, is_seed)
  SELECT s.id, p.id, '2026-06-26T10:00:00Z'::timestamptz, 'manual', 'manual', false, 4, true
  FROM spawters s, places p LIMIT 1;
SELECT total_reviews, confidence_score FROM place_adn WHERE place_id = (SELECT id FROM places LIMIT 1);
-- expect: total_reviews inchangé, confidence_score > valeur initiale
ROLLBACK;

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 4 — Axes bougent selon les tags : 'cher' pousse axe_budget_premium
-- vers +1, borné à [-1, 1].
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
SELECT axe_budget_premium FROM place_adn WHERE place_id = (SELECT id FROM places LIMIT 1); -- avant
INSERT INTO spawt_checkin (spawter_id, place_id, arrived_at, check_in_type, geolocation_source, is_verified, note_etoiles, tags)
  SELECT s.id, p.id, '2026-06-27T10:00:00Z'::timestamptz, 'active', 'gps', true, 3, ARRAY['cher']
  FROM spawters s, places p LIMIT 1;
SELECT axe_budget_premium, axe_informel_etabli, axe_decontracte_habille
  FROM place_adn WHERE place_id = (SELECT id FROM places LIMIT 1);
-- expect: axe_budget_premium > avant ; axe_decontracte_habille INCHANGÉ (note 3 = neutre)
ROLLBACK;

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 5 — Row annulée (is_cancelled) : aucun recompute.
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
SELECT total_reviews FROM place_adn WHERE place_id = (SELECT id FROM places LIMIT 1); -- avant
INSERT INTO spawt_checkin (spawter_id, place_id, arrived_at, check_in_type, geolocation_source, is_verified, note_etoiles, is_cancelled)
  SELECT s.id, p.id, '2026-06-28T10:00:00Z'::timestamptz, 'active', 'gps', true, 5, true
  FROM spawters s, places p LIMIT 1;
SELECT total_reviews FROM place_adn WHERE place_id = (SELECT id FROM places LIMIT 1);
-- expect: INCHANGÉ
ROLLBACK;

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 6 — Lieu sans row place_adn : le trigger la crée puis recompute.
-- (Nécessite un lieu de test sans ADN — skip si tous les lieux en ont une.)
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
DELETE FROM place_adn WHERE place_id = (SELECT id FROM places LIMIT 1);
INSERT INTO spawt_checkin (spawter_id, place_id, arrived_at, check_in_type, geolocation_source, is_verified, note_etoiles)
  SELECT s.id, p.id, '2026-06-29T10:00:00Z'::timestamptz, 'active', 'gps', true, 4
  FROM spawters s, places p LIMIT 1;
SELECT total_reviews, weighted_rating FROM place_adn WHERE place_id = (SELECT id FROM places LIMIT 1);
-- expect: row créée, total_reviews = 1, weighted_rating = 4.0
ROLLBACK;

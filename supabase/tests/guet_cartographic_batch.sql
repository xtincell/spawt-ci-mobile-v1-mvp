\set ON_ERROR_STOP on
BEGIN;
\set guet_cartography_recipe_only true
\ir ../seed/guet_cartographic_locations_2026_10_31.sql
\unset guet_cartography_recipe_only

-- The operation's own 100-row manifest supplies the isolated fixtures. The
-- Kampement fixture uses the source's float serialization rather than the API's.
INSERT INTO public.places(id,name,lat,lng,price_tier,descriptive_address,neighborhood,city,cuisine,is_published)
SELECT place_id,expected_name,
  CASE WHEN serialized_float_tolerance THEN target_lat ELSE expected_lat END,
  CASE WHEN serialized_float_tolerance THEN target_lng ELSE expected_lng END,
  NULL,'','','Abidjan','{}',true
FROM pg_temp.guet_cartography_targets_20261031;
INSERT INTO public.places(id,name,lat,lng,price_tier,descriptive_address,neighborhood,city,cuisine,is_published)
VALUES('d9765ab5-211e-565e-9db1-453e53ee8a82','Chez le Cultivateur',5.370168,-3.965236,NULL,'','','Abidjan','{}',true);
CREATE TEMP TABLE guet_batch_place_before ON COMMIT DROP AS
SELECT id,to_jsonb(p) value FROM public.places p;
CREATE TEMP TABLE guet_batch_activity_before ON COMMIT DROP AS SELECT
  (SELECT count(*) FROM public.spawt_checkin) visits,
  (SELECT count(*) FROM public.visit_presence_evidence) presence,
  (SELECT count(*) FROM public.place_contributions) contributions,
  (SELECT count(*) FROM public.paws_ledger) paws;

CREATE FUNCTION pg_temp.expect_guet_batch_error(expected text)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  BEGIN
    PERFORM pg_temp.apply_guet_cartography_20261031();
    RAISE EXCEPTION 'Expected batch refusal did not occur: %',expected;
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM IS DISTINCT FROM expected THEN RAISE; END IF;
  END;
END $$;

SAVEPOINT missing_place;
DELETE FROM public.places WHERE id='9d54bcb5-b581-564f-bc31-b2cf597197c8';
SELECT pg_temp.expect_guet_batch_error('guet_batch_place_precondition_failed');
ROLLBACK TO missing_place;
SAVEPOINT changed_name;
UPDATE public.places SET name='Identité modifiée' WHERE id='9d54bcb5-b581-564f-bc31-b2cf597197c8';
SELECT pg_temp.expect_guet_batch_error('guet_batch_place_precondition_failed');
ROLLBACK TO changed_name;
SAVEPOINT unpublished_place;
UPDATE public.places SET is_published=false WHERE id='9d54bcb5-b581-564f-bc31-b2cf597197c8';
SELECT pg_temp.expect_guet_batch_error('guet_batch_place_precondition_failed');
ROLLBACK TO unpublished_place;
SAVEPOINT changed_coordinate;
-- Even a sub-tolerance change is refused for any place other than Kampement.
UPDATE public.places SET lat=lat+1e-12 WHERE id='9d54bcb5-b581-564f-bc31-b2cf597197c8';
SELECT pg_temp.expect_guet_batch_error('guet_batch_place_precondition_failed');
ROLLBACK TO changed_coordinate;
SAVEPOINT kampement_outside_tolerance;
UPDATE public.places p SET lat=t.expected_lat+2e-10
FROM pg_temp.guet_cartography_targets_20261031 t WHERE p.id=t.place_id AND t.serialized_float_tolerance;
SELECT pg_temp.expect_guet_batch_error('guet_batch_place_precondition_failed');
ROLLBACK TO kampement_outside_tolerance;

SAVEPOINT incompatible_validation;
INSERT INTO public.place_location_checks(place_id,lat,lng,accuracy_meters,source)
SELECT p.id,p.lat+0.001,p.lng,12,'Existing measured location'
FROM public.places p JOIN pg_temp.guet_cartography_targets_20261031 t ON t.place_id=p.id
WHERE NOT t.correct_coordinates ORDER BY p.id LIMIT 1;
SELECT pg_temp.expect_guet_batch_error('guet_batch_existing_validation_conflict');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.place_location_checks)<>1
    OR NOT EXISTS(SELECT 1 FROM public.place_location_checks WHERE accuracy_meters=12 AND source='Existing measured location')
    OR EXISTS(SELECT 1 FROM public.editorial_history WHERE after_value->>'batch_id'='guet-cartographic-locations-2026-10-31') THEN
    RAISE EXCEPTION 'Failed batch changed an existing validation or wrote partial receipts';
  END IF;
END $$;
ROLLBACK TO incompatible_validation;

SAVEPOINT old_corrected_point_validation;
INSERT INTO public.place_location_checks(place_id,lat,lng,accuracy_meters,source)
SELECT p.id,p.lat,p.lng,12,'Previous measured point'
FROM public.places p JOIN pg_temp.guet_cartography_targets_20261031 t ON t.place_id=p.id
WHERE t.correct_coordinates;
SELECT pg_temp.expect_guet_batch_error('guet_batch_existing_validation_conflict');
ROLLBACK TO old_corrected_point_validation;

SAVEPOINT compatible_validation;
INSERT INTO public.place_location_checks(place_id,lat,lng,accuracy_meters,source,checked_at)
SELECT p.id,p.lat,p.lng,8,'Independent measured location','2026-01-01T00:00:00Z'
FROM public.places p JOIN pg_temp.guet_cartography_targets_20261031 t ON t.place_id=p.id
WHERE NOT t.correct_coordinates ORDER BY p.id LIMIT 1;
DO $$ DECLARE receipt jsonb; BEGIN
  receipt:=pg_temp.apply_guet_cartography_20261031();
  IF (receipt->>'inserted_checks')::integer<>99 OR (receipt->>'retained_checks')::integer<>1
    OR (SELECT count(*) FROM public.place_location_checks WHERE checked_at='2026-01-01T00:00:00Z'
      AND accuracy_meters=8 AND source='Independent measured location')<>1
    OR (SELECT count(*) FROM public.editorial_history WHERE entity_table='place_location_checks'
      AND after_value->>'batch_id'='guet-cartographic-locations-2026-10-31')<>99 THEN
    RAISE EXCEPTION 'Compatible existing validation was overwritten or claimed by this batch';
  END IF;
END $$;
ROLLBACK TO compatible_validation;

CREATE TEMP TABLE guet_batch_first_receipt ON COMMIT DROP AS
SELECT pg_temp.apply_guet_cartography_20261031() receipt;
DO $$ DECLARE receipt jsonb; BEGIN
  SELECT r.receipt INTO receipt FROM pg_temp.guet_batch_first_receipt r;
  IF (receipt->>'inserted_checks')::integer<>100 OR (receipt->>'corrected_places')::integer<>2
    OR (receipt->>'eligible_targets')::integer<>100 THEN
    RAISE EXCEPTION 'First application has incorrect counts: %',receipt;
  END IF;
  IF (SELECT count(*) FROM public.public_guet_places p
      JOIN pg_temp.guet_cartography_targets_20261031 t ON t.place_id=p.id)<>100
    OR EXISTS(SELECT 1 FROM public.place_location_checks c
      JOIN pg_temp.guet_cartography_targets_20261031 t ON t.place_id=c.place_id
      JOIN public.places p ON p.id=t.place_id
      WHERE c.lat IS DISTINCT FROM p.lat OR c.lng IS DISTINCT FROM p.lng
        OR c.accuracy_meters IS NOT NULL OR c.checked_by IS NOT NULL OR c.source IS DISTINCT FROM t.source_url) THEN
    RAISE EXCEPTION 'Batch locations are missing or do not copy exact database points and documentary sources';
  END IF;
  IF EXISTS(SELECT 1 FROM public.places p JOIN pg_temp.guet_batch_place_before b ON b.id=p.id
    LEFT JOIN pg_temp.guet_cartography_targets_20261031 t ON t.place_id=p.id
    WHERE CASE WHEN coalesce(t.correct_coordinates,false)
      THEN (to_jsonb(p)-ARRAY['lat','lng','updated_at']) IS DISTINCT FROM (b.value-ARRAY['lat','lng','updated_at'])
        OR p.lat IS DISTINCT FROM t.target_lat OR p.lng IS DISTINCT FROM t.target_lng
      ELSE to_jsonb(p) IS DISTINCT FROM b.value END)
    OR EXISTS(SELECT 1 FROM public.place_location_checks WHERE place_id='d9765ab5-211e-565e-9db1-453e53ee8a82') THEN
    RAISE EXCEPTION 'An unrelated place, closed place or non-coordinate field changed';
  END IF;
  IF (SELECT count(*) FROM public.editorial_history WHERE entity_table='places'
      AND after_value->>'batch_id'='guet-cartographic-locations-2026-10-31')<>2
    OR (SELECT count(*) FROM public.editorial_history WHERE entity_table='place_location_checks'
      AND after_value->>'batch_id'='guet-cartographic-locations-2026-10-31')<>100
    OR EXISTS(SELECT 1 FROM public.editorial_history h
      JOIN pg_temp.guet_cartography_targets_20261031 t ON t.place_id::text=h.entity_key
      LEFT JOIN public.place_location_checks c ON c.place_id=t.place_id
      WHERE h.after_value->>'batch_id'='guet-cartographic-locations-2026-10-31'
        AND (h.actor_id IS NOT NULL OR h.after_value->>'batch_version' IS DISTINCT FROM '1'
          OR h.after_value->>'source_audit_sha256' IS DISTINCT FROM receipt->>'source_audit_sha256'
          OR h.after_value->>'source_sha256' IS DISTINCT FROM t.source_sha256
          OR h.after_value->'checked_at' IS DISTINCT FROM to_jsonb(c.checked_at)
          OR (h.entity_table='places' AND (h.before_value->>'lat')::double precision IS DISTINCT FROM t.expected_lat))) THEN
    RAISE EXCEPTION 'Targeted rollback audit data is missing or inaccurate';
  END IF;
END $$;

CREATE TEMP TABLE guet_batch_checks_before_replay ON COMMIT DROP AS
SELECT place_id,to_jsonb(c) value FROM public.place_location_checks c;
DO $$ DECLARE receipt jsonb; BEGIN
  receipt:=pg_temp.apply_guet_cartography_20261031();
  IF (receipt->>'inserted_checks')::integer<>0 OR (receipt->>'corrected_places')::integer<>0
    OR (receipt->>'retained_checks')::integer<>100 OR (receipt->>'eligible_targets')::integer<>100
    OR (SELECT count(*) FROM public.editorial_history WHERE after_value->>'batch_id'='guet-cartographic-locations-2026-10-31')<>102
    OR EXISTS(SELECT 1 FROM public.place_location_checks c JOIN pg_temp.guet_batch_checks_before_replay b USING(place_id)
      WHERE to_jsonb(c) IS DISTINCT FROM b.value) THEN
    RAISE EXCEPTION 'Replaying batch changed checks, coordinates or audit: %',receipt;
  END IF;
  IF EXISTS(SELECT 1 FROM pg_temp.guet_batch_activity_before b
    WHERE b.visits<>(SELECT count(*) FROM public.spawt_checkin)
      OR b.presence<>(SELECT count(*) FROM public.visit_presence_evidence)
      OR b.contributions<>(SELECT count(*) FROM public.place_contributions)
      OR b.paws<>(SELECT count(*) FROM public.paws_ledger)) THEN
    RAISE EXCEPTION 'Cartographic batch changed visits, presence, contributions or Paws';
  END IF;
END $$;

-- A later staff measurement at the same point remains authoritative. Replaying
-- the documentary import must keep its source, accuracy, author and timestamp.
INSERT INTO auth.users(id,email) VALUES
  ('eeee0000-0000-4000-8000-0000000092b3','cartographic-batch-staff@spawt.local');
INSERT INTO public.spawt_staff(id,email,display_name,role,is_active) VALUES
  ('eeee0000-0000-4000-8000-0000000092b3','cartographic-batch-staff@spawt.local','Équipe recette lot','operator',true);
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-0000000092b3',true);
SET LOCAL ROLE authenticated;
SELECT public.validate_place_location(p.id,'Relevé GPS indépendant après import',8,p.lat,p.lng)
FROM public.places p WHERE p.id='8b8651bd-8fa8-50f5-91ad-29a3b5c9536e';
RESET ROLE;
CREATE TEMP TABLE guet_batch_measured_before_replay ON COMMIT DROP AS
SELECT place_id,to_jsonb(c) value FROM public.place_location_checks c;
DO $$ DECLARE receipt jsonb; journal_count bigint; BEGIN
  SELECT count(*) INTO journal_count FROM public.editorial_history;
  receipt:=pg_temp.apply_guet_cartography_20261031();
  IF (receipt->>'inserted_checks')::integer<>0 OR (receipt->>'corrected_places')::integer<>0
    OR (receipt->>'eligible_targets')::integer<>100
    OR (SELECT count(*) FROM public.editorial_history)<>journal_count
    OR NOT EXISTS(SELECT 1 FROM public.place_location_checks WHERE accuracy_meters=8
      AND source='Relevé GPS indépendant après import' AND checked_by='eeee0000-0000-4000-8000-0000000092b3')
    OR EXISTS(SELECT 1 FROM public.place_location_checks c JOIN pg_temp.guet_batch_measured_before_replay b USING(place_id)
      WHERE to_jsonb(c) IS DISTINCT FROM b.value) THEN
    RAISE EXCEPTION 'Replay overwrote a later staff measurement or appended a journal entry';
  END IF;
END $$;
ROLLBACK;

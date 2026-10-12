-- psql -v ON_ERROR_STOP=1 -f supabase/tests/alpha_demo_accounts.sql
-- Ou requête SQL brute via relais. Toutes les données sont synthétiques,
-- confinées à la transaction et annulées même après le scénario de purge.
BEGIN;
SET LOCAL request.jwt.claims = '{"role":"service_role"}';

INSERT INTO auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
   created_at, updated_at, confirmation_token, recovery_token, email_change,
   email_change_token_new, email_change_token_current, phone_change,
   phone_change_token, reauthentication_token)
SELECT ('d0700000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'alpha-demo-sql-' || n || '@example.invalid', '', now(), now(), now(),
  '', '', '', '', '', '', '', ''
FROM generate_series(1, 7) n;

INSERT INTO public.spawt_staff (id, email, display_name, role, is_active) VALUES
  ('d0700000-0000-4000-8000-000000000001', 'alpha-demo-sql-1@example.invalid', 'Test Admin', 'admin', true),
  ('d0700000-0000-4000-8000-000000000002', 'alpha-demo-sql-2@example.invalid', 'Test Operator', 'operator', true),
  ('d0700000-0000-4000-8000-000000000007', 'alpha-demo-sql-7@example.invalid', 'Test Inactive', 'admin', false);
INSERT INTO public.spawters (id, phone_e164, display_name, country_code, is_demo, is_seed) VALUES
  ('d0700000-0000-4000-8000-000000000003', '+2250000070003', 'Test Real', 'CI', false, false),
  ('d0700000-0000-4000-8000-000000000004', '+2250000070004', 'Test Demo Alpha', 'CI', true, false),
  ('d0700000-0000-4000-8000-000000000005', '+2250000070005', 'Test Founder', 'CI', true, true);

INSERT INTO public.collection_titres (spawter_id, title_key, source)
VALUES ('d0700000-0000-4000-8000-000000000004', 'title.alpha_sql_test', 'badge');
INSERT INTO public.paws_ledger (spawter_id, delta, reason)
VALUES ('d0700000-0000-4000-8000-000000000004', 5, 'ajustement_admin');
INSERT INTO public.user_signals (spawter_id, signal_type, event_name)
VALUES ('d0700000-0000-4000-8000-000000000004', 'view', 'alpha_sql_test');

-- Vraies données de l'app, toutes sur un lieu synthétique non publié.
INSERT INTO public.places
  (id, name, lat, lng, descriptive_address, neighborhood, city, price_tier, is_published)
VALUES ('d0700000-0000-4000-8000-000000000100', 'Lieu SQL démo éphémère', 5.35, -3.99,
  'Fixture transactionnelle', 'Cocody', 'Abidjan', 1, false);
INSERT INTO public.place_adn (place_id)
VALUES ('d0700000-0000-4000-8000-000000000100') ON CONFLICT DO NOTHING;
INSERT INTO public.user_palais (spawter_id, axe_racines_horizons)
VALUES ('d0700000-0000-4000-8000-000000000004', 0.4);
INSERT INTO public.saved_places (spawter_id, place_id)
VALUES ('d0700000-0000-4000-8000-000000000004', 'd0700000-0000-4000-8000-000000000100');
INSERT INTO public.spawt_checkin
  (id, spawter_id, place_id, arrived_at, checked_in_at, left_at,
   check_in_type, session_duration_minutes, geolocation_lat, geolocation_lng,
   geolocation_source, distance_to_lieu_meters, is_verified, note_etoiles, texte_avis)
VALUES ('d0700000-0000-4000-8000-000000000101',
  'd0700000-0000-4000-8000-000000000004', 'd0700000-0000-4000-8000-000000000100',
  now() - interval '2 hours', now() - interval '100 minutes', now() - interval '1 hour',
  'manual', 40, 5.35, -3.99, 'gps', 0, true, 4, 'Avis synthétique de recette SQL.');
DO $$ BEGIN
  IF (SELECT total_reviews FROM public.place_adn WHERE place_id = 'd0700000-0000-4000-8000-000000000100') IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'ASSERT synthetic review did not reach place ADN';
  END IF;
END $$;

-- L'append-only reste strict hors cascade, même pour un accès DB privilégié.
DO $$ BEGIN
  BEGIN
    DELETE FROM public.collection_titres WHERE spawter_id = 'd0700000-0000-4000-8000-000000000004';
    RAISE EXCEPTION 'ASSERT direct title deletion was allowed' USING ERRCODE = '23514';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
END $$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"d0700000-0000-4000-8000-000000000006","role":"authenticated"}';
INSERT INTO public.spawters (id, phone_e164, display_name, country_code, is_demo)
VALUES ('d0700000-0000-4000-8000-000000000006', '+2250000070006', 'Test Forged', 'CI', true);
DO $$ BEGIN
  IF (SELECT is_demo FROM public.spawters WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'ASSERT client INSERT forged demo marker';
  END IF;
END $$;
UPDATE public.spawters SET is_demo = true, display_name = 'Test Forged Updated' WHERE id = auth.uid();
DO $$ BEGIN
  IF (SELECT is_demo FROM public.spawters WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'ASSERT client UPDATE forged demo marker';
  END IF;
  IF (SELECT display_name FROM public.spawters WHERE id = auth.uid()) <> 'Test Forged Updated' THEN
    RAISE EXCEPTION 'ASSERT ordinary profile update was blocked';
  END IF;
END $$;

-- Un client démo ne peut retirer son propre marqueur.
SET LOCAL request.jwt.claims = '{"sub":"d0700000-0000-4000-8000-000000000004","role":"authenticated"}';
UPDATE public.spawters SET is_demo = false WHERE id = auth.uid();
DO $$ BEGIN
  IF NOT (SELECT is_demo FROM public.spawters WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'ASSERT client removed demo marker';
  END IF;
END $$;

-- Opérateur, compte public et admin désactivé : refus avant toute mutation.
DO $$ DECLARE actor uuid; BEGIN
  FOREACH actor IN ARRAY ARRAY[
    'd0700000-0000-4000-8000-000000000002'::uuid,
    'd0700000-0000-4000-8000-000000000003'::uuid,
    'd0700000-0000-4000-8000-000000000007'::uuid
  ] LOOP
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'role', 'authenticated')::text, true);
    BEGIN
      PERFORM public.admin_delete_demo_spawter('d0700000-0000-4000-8000-000000000004', 'Test Demo Alpha');
      RAISE EXCEPTION 'ASSERT non-admin deleted demo' USING ERRCODE = '23514';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '{"role":"anon"}';
DO $$ BEGIN
  BEGIN
    PERFORM public.admin_delete_demo_spawter('d0700000-0000-4000-8000-000000000004', 'Test Demo Alpha');
    RAISE EXCEPTION 'ASSERT anonymous deleted demo' USING ERRCODE = '23514';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"d0700000-0000-4000-8000-000000000001","role":"authenticated"}';

-- Même admin actif : pas de reclassement de comptes réels via un PATCH.
UPDATE public.spawters SET is_demo = true WHERE id = 'd0700000-0000-4000-8000-000000000003';
DO $$ BEGIN
  IF (SELECT is_demo FROM public.spawters WHERE id = 'd0700000-0000-4000-8000-000000000003') THEN
    RAISE EXCEPTION 'ASSERT staff client forged demo marker';
  END IF;
END $$;

DO $$ DECLARE target uuid; BEGIN
  FOREACH target IN ARRAY ARRAY[
    'd0700000-0000-4000-8000-000000000001'::uuid, -- soi-même
    'd0700000-0000-4000-8000-000000000002'::uuid, -- staff
    'd0700000-0000-4000-8000-000000000003'::uuid, -- réel
    'd0700000-0000-4000-8000-000000000005'::uuid  -- fondateur
  ] LOOP
    BEGIN
      PERFORM public.admin_delete_demo_spawter(target, 'confirmation');
      RAISE EXCEPTION 'ASSERT protected account deletion was allowed' USING ERRCODE = '23514';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;
  BEGIN
    PERFORM public.admin_delete_demo_spawter('d0700000-0000-4000-8000-000000000004', 'Test Demo Alpha ');
    RAISE EXCEPTION 'ASSERT incorrect confirmation was accepted' USING ERRCODE = '23514';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
END $$;

-- Une cascade refusée annule compte ET audit, sans succès partiel.
RESET ROLE;
CREATE FUNCTION pg_temp.refuse_demo_cascade() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'simulated cascade failure'; END $$;
CREATE TRIGGER alpha_test_cascade_failure BEFORE DELETE ON public.user_signals
  FOR EACH ROW WHEN (OLD.spawter_id = 'd0700000-0000-4000-8000-000000000004')
  EXECUTE FUNCTION pg_temp.refuse_demo_cascade();
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"d0700000-0000-4000-8000-000000000001","role":"authenticated"}';
DO $$ BEGIN
  BEGIN
    PERFORM public.admin_delete_demo_spawter('d0700000-0000-4000-8000-000000000004', 'Test Demo Alpha');
    RAISE EXCEPTION 'ASSERT failing cascade reported success' USING ERRCODE = '23514';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = 'd0700000-0000-4000-8000-000000000004')
    OR NOT EXISTS (SELECT 1 FROM public.collection_titres WHERE spawter_id = 'd0700000-0000-4000-8000-000000000004')
    OR NOT EXISTS (SELECT 1 FROM public.spawt_checkin WHERE id = 'd0700000-0000-4000-8000-000000000101')
    OR EXISTS (SELECT 1 FROM public.admin_audit_log WHERE action = 'spawter_demo_delete'
      AND entity_id = 'd0700000-0000-4000-8000-000000000004') THEN
    RAISE EXCEPTION 'ASSERT failed cascade was not atomic';
  END IF;
END $$;
DROP TRIGGER alpha_test_cascade_failure ON public.user_signals;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"d0700000-0000-4000-8000-000000000001","role":"authenticated"}';

DO $$ DECLARE result jsonb; BEGIN
  result := public.admin_delete_demo_spawter('d0700000-0000-4000-8000-000000000004', 'Test Demo Alpha');
  IF result IS DISTINCT FROM '{"ok":true,"spawter_id":"d0700000-0000-4000-8000-000000000004"}'::jsonb THEN
    RAISE EXCEPTION 'ASSERT deletion response contract mismatch';
  END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = 'd0700000-0000-4000-8000-000000000004')
    OR EXISTS (SELECT 1 FROM public.spawters WHERE id = 'd0700000-0000-4000-8000-000000000004')
    OR EXISTS (SELECT 1 FROM public.collection_titres WHERE spawter_id = 'd0700000-0000-4000-8000-000000000004')
    OR EXISTS (SELECT 1 FROM public.user_palais WHERE spawter_id = 'd0700000-0000-4000-8000-000000000004')
    OR EXISTS (SELECT 1 FROM public.saved_places WHERE spawter_id = 'd0700000-0000-4000-8000-000000000004')
    OR EXISTS (SELECT 1 FROM public.spawt_checkin WHERE spawter_id = 'd0700000-0000-4000-8000-000000000004')
    OR EXISTS (SELECT 1 FROM public.user_signals WHERE spawter_id = 'd0700000-0000-4000-8000-000000000004')
    OR EXISTS (SELECT 1 FROM public.paws_ledger WHERE spawter_id = 'd0700000-0000-4000-8000-000000000004') THEN
    RAISE EXCEPTION 'ASSERT demo cascade left account data behind';
  END IF;
  IF (SELECT count(*) FROM public.admin_audit_log WHERE action = 'spawter_demo_delete'
        AND entity_id = 'd0700000-0000-4000-8000-000000000004'
        AND spawt_staff_id = 'd0700000-0000-4000-8000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'ASSERT expected one attributed audit row';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = 'd0700000-0000-4000-8000-000000000003') THEN
    RAISE EXCEPTION 'ASSERT real account disappeared';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.places WHERE id = 'd0700000-0000-4000-8000-000000000100')
    OR (SELECT total_reviews FROM public.place_adn WHERE place_id = 'd0700000-0000-4000-8000-000000000100') IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'ASSERT deleting a demo review did not recompute the retained place ADN';
  END IF;
END $$;

ROLLBACK;

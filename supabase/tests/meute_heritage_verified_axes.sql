-- Contrat 0069, données synthétiques, transaction annulée. Aucun appel OTP.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.assert_ok(ok boolean, label text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'ASSERT FAIL: %', label; END IF;
  RAISE NOTICE 'PASS: %', label;
END $$;
INSERT INTO auth.users(id,phone,phone_confirmed_at) VALUES
 ('00000000-0069-4000-8000-000000000001','2250700000061',now()),
 ('00000000-0069-4000-8000-000000000002','2250700000062',now()),
 ('00000000-0069-4000-8000-000000000003','2250700000063',NULL);
INSERT INTO public.meute_waitlist(id,phone,email,archetype,archetype_name,axes,referral_code) VALUES
 ('shk-0069-a','+2250700000061','synthetic-a@example.invalid','murmure','Murmure',
  '{"R":-1,"T":0,"E":1,"F":2,"M":-2}','SHK-0069-A'),
 ('shk-0069-b','+2250700000062','synthetic-b@example.invalid','lame','Lame',
  '{"R":1,"T":0,"E":-2,"F":0,"M":2}','SHK-0069-B'),
 ('shk-0069-c','+2250700000063','synthetic-c@example.invalid','braise','Braise',
  'broken-json','SHK-0069-C');
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0069-4000-8000-000000000001"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r := public.claim_meute_heritage('00000000-0069-4000-8000-000000000001','+2250700000062');
 PERFORM pg_temp.assert_ok(r->>'code'='spawter_pending' AND r->>'archetype'='murmure'
  AND (r->>'claimed')::boolean=false AND r->'axes'='{"R":-1,"T":0,"E":1,"F":2,"M":-2}'::jsonb,
  'preview complet avant profil, paramètre téléphone étranger ignoré');
 PERFORM pg_temp.assert_ok(NOT EXISTS(SELECT 1 FROM public.spawters WHERE id='00000000-0069-4000-8000-000000000001'),
  'aucun profil ni consentement créé par le preview');
 BEGIN
  PERFORM public.claim_meute_heritage('00000000-0069-4000-8000-000000000002','+2250700000062');
  RAISE EXCEPTION 'FAIL: autre compte accessible avant profil';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: autre compte refusé même avant profil'; END;
 BEGIN
  PERFORM axes FROM public.meute_waitlist LIMIT 1;
  RAISE EXCEPTION 'FAIL: lecture directe waitlist ouverte';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: waitlist toujours privée'; END;
END $$;
RESET ROLE;
INSERT INTO public.spawters(id,phone_e164,display_name) VALUES
 ('00000000-0069-4000-8000-000000000001','+2250700000069','Synthétique');
SET LOCAL ROLE authenticated;
-- Reproduit le contre-exemple : le propriétaire peut changer son téléphone
-- public ; cela ne lui donne pas l'héritage du numéro modifié.
UPDATE public.spawters SET phone_e164='+2250700000062'
 WHERE id='00000000-0069-4000-8000-000000000001';
DO $$ DECLARE r jsonb; BEGIN
 r := public.claim_meute_heritage('00000000-0069-4000-8000-000000000001','+2250700000062');
 PERFORM pg_temp.assert_ok(r->>'archetype'='murmure' AND (r->>'claimed')::boolean,
  'claim lié au téléphone Auth malgré téléphone public modifié');
 PERFORM pg_temp.assert_ok(EXISTS(SELECT 1 FROM public.spawters
  WHERE id='00000000-0069-4000-8000-000000000001' AND quiz_axes->>'F'='2'
  AND referral_code='SHK-0069-A' AND heritage_claimed_at IS NOT NULL),
  'cinq axes, rang et parrainage persistés');
END $$;
RESET ROLE;
UPDATE public.meute_waitlist SET axes='{"R":0,"T":0,"E":0,"F":-2,"M":0}' WHERE id='shk-0069-a';
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r := public.claim_meute_heritage('00000000-0069-4000-8000-000000000001','+2250700000062');
 PERFORM pg_temp.assert_ok(r->>'code'='already_claimed' AND (r->>'claimed')::boolean=false AND r->'axes'->>'F'='2',
  'nouvel appel idempotent conserve les axes historiques');
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0069-4000-8000-000000000003"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r := public.claim_meute_heritage('00000000-0069-4000-8000-000000000003','+2250700000061');
 PERFORM pg_temp.assert_ok(r->>'code'='phone_not_verified' AND r->'axes'='null'::jsonb,
  'téléphone non confirmé ne reçoit aucun héritage');
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SET LOCAL ROLE service_role;
DO $$ DECLARE r jsonb; BEGIN
 r := public.claim_meute_heritage('00000000-0069-4000-8000-000000000003','+2250700000063');
 PERFORM pg_temp.assert_ok(r->>'code'='spawter_pending' AND r->>'archetype'='braise' AND r->'axes'='null'::jsonb,
  'Edge trusted compatible, JSON corrompu non bloquant');
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN
  PERFORM public.claim_meute_heritage('00000000-0069-4000-8000-000000000001','+2250700000061');
  RAISE EXCEPTION 'FAIL: accès anonyme';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: accès anonyme refusé'; END;
END $$;
RESET ROLE;
ROLLBACK;

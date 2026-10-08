-- Téléphone modifiable vs téléphone confirmé, fixtures synthétiques annulées.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id,phone,phone_confirmed_at)
 VALUES ('00000000-0069-4000-8000-000000000004','2250700000064',now());
INSERT INTO public.spawters(id,phone_e164,display_name)
 VALUES ('00000000-0069-4000-8000-000000000004','+2250700000065','Synthétique');
INSERT INTO public.meute_waitlist(id,phone,email,archetype,archetype_name,axes,referral_code) VALUES
 ('shk-0069-own','+2250700000064','own@example.invalid','murmure','Murmure','{"R":0,"T":0,"E":0,"F":2,"M":-2}','SHK-OWN'),
 ('shk-0069-other','+2250700000065','other@example.invalid','lame','Lame','{"R":0,"T":0,"E":-2,"F":0,"M":2}','SHK-OTHER');
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0069-4000-8000-000000000004"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r := public.claim_meute_heritage('00000000-0069-4000-8000-000000000004','+2250700000065');
 IF r->>'archetype' IS DISTINCT FROM 'murmure' THEN
  RAISE EXCEPTION 'ASSERT FAIL: héritage étranger accessible via le téléphone public modifiable';
 END IF;
 RAISE NOTICE 'PASS: téléphone public modifié ne donne pas un héritage étranger';
END $$;
RESET ROLE;
ROLLBACK;

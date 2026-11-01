\set ON_ERROR_STOP on
BEGIN;

INSERT INTO auth.users(id,email) VALUES
  ('eeee0000-0000-4000-8000-0000000091a1','recency-owner@spawt.local'),
  ('eeee0000-0000-4000-8000-0000000091a2','recency-reader@spawt.local'),
  ('eeee0000-0000-4000-8000-0000000091a3','recency-staff@spawt.local');
INSERT INTO public.spawters(id,phone_e164,display_name) VALUES
  ('eeee0000-0000-4000-8000-0000000091a1','+22577000911','Recette fraîcheur'),
  ('eeee0000-0000-4000-8000-0000000091a2','+22577000912','Lecture fraîcheur');
INSERT INTO public.spawt_staff(id,email,display_name,role,is_active) VALUES
  ('eeee0000-0000-4000-8000-0000000091a3','recency-staff@spawt.local','Équipe fraîcheur','operator',true);
INSERT INTO public.places(id,name,lat,lng,price_tier,descriptive_address,neighborhood,city,cuisine,is_published) VALUES
  ('eeee0000-0000-4000-8000-0000000091c1','Lieu visité',5.3,-4,null,'','','Abidjan','{}',true),
  ('eeee0000-0000-4000-8000-0000000091c2','Fiche sans visite',null,null,null,'','','Abidjan','{}',true),
  ('eeee0000-0000-4000-8000-0000000091c3','Lieu brouillon',5.3,-4,null,'','','Abidjan','{}',false);

-- Fixtures historiques isolées : on teste l'agrégat, pas la délivrance des
-- preuves GPS (couverte séparément par outing_presence.sql).
ALTER TABLE public.spawt_checkin DISABLE TRIGGER USER;
INSERT INTO public.spawt_checkin
  (id,spawter_id,place_id,arrived_at,checked_in_at,check_in_type,geolocation_source,is_verified,is_seed,seed_batch_id,is_cancelled,deleted_at,deleted_by_staff_id,deleted_reason)
SELECT f.id::uuid,'eeee0000-0000-4000-8000-0000000091a1'::uuid,f.place_id::uuid,
  now()-f.age, CASE WHEN f.missing_date THEN NULL ELSE now()-f.age END,
  f.kind,'gps',f.verified,f.seed,
  CASE WHEN f.seed THEN 'eeee0000-0000-4000-8000-0000000091ff'::uuid ELSE NULL END,
  f.cancelled,CASE WHEN f.deleted THEN now() ELSE NULL END,
  CASE WHEN f.deleted THEN 'eeee0000-0000-4000-8000-0000000091a3'::uuid ELSE NULL END,
  CASE WHEN f.deleted THEN 'Recette retrait' ELSE NULL END
FROM (VALUES
  ('eeee0000-0000-4000-8000-0000000091d1','eeee0000-0000-4000-8000-0000000091c1',interval '10 days',false,'manual',true,false,false,false),
  ('eeee0000-0000-4000-8000-0000000091d2','eeee0000-0000-4000-8000-0000000091c1',interval '2 days',false,'active',true,false,false,false),
  ('eeee0000-0000-4000-8000-0000000091d3','eeee0000-0000-4000-8000-0000000091c1',interval '1 hour',false,'manual',false,false,false,false),
  ('eeee0000-0000-4000-8000-0000000091d4','eeee0000-0000-4000-8000-0000000091c1',interval '30 minutes',false,'passive',true,false,false,false),
  ('eeee0000-0000-4000-8000-0000000091d5','eeee0000-0000-4000-8000-0000000091c1',interval '15 minutes',false,'manual',true,false,true,false),
  ('eeee0000-0000-4000-8000-0000000091d6','eeee0000-0000-4000-8000-0000000091c1',interval '10 minutes',false,'manual',true,false,false,true),
  ('eeee0000-0000-4000-8000-0000000091d7','eeee0000-0000-4000-8000-0000000091c1',interval '5 minutes',false,'manual',true,true,false,false),
  ('eeee0000-0000-4000-8000-0000000091d8','eeee0000-0000-4000-8000-0000000091c1',interval '1 minute',true,'manual',true,false,false,false),
  ('eeee0000-0000-4000-8000-0000000091d9','eeee0000-0000-4000-8000-0000000091c3',interval '1 minute',false,'manual',true,false,false,false),
  ('eeee0000-0000-4000-8000-0000000091da','eeee0000-0000-4000-8000-0000000091c1',interval '-1 day',false,'manual',true,false,false,false)
) AS f(id,place_id,age,missing_date,kind,verified,seed,cancelled,deleted);
ALTER TABLE public.spawt_checkin ENABLE TRIGGER USER;

SET LOCAL ROLE anon;
DO $$ BEGIN
  IF (SELECT public.last_spawt_at(p) FROM public.places p WHERE id='eeee0000-0000-4000-8000-0000000091c1')
      IS DISTINCT FROM now()-interval '2 days' THEN
    RAISE EXCEPTION 'Recency must come from the most recent verified real visit';
  END IF;
  IF (SELECT public.last_spawt_at(p) FROM public.places p WHERE id='eeee0000-0000-4000-8000-0000000091c2') IS NOT NULL THEN
    RAISE EXCEPTION 'Documentary place invented a visit timestamp';
  END IF;
  IF public.last_spawt_at(jsonb_populate_record(NULL::public.places,
      '{"id":"eeee0000-0000-4000-8000-0000000091c3","is_published":true}'::jsonb)) IS NOT NULL THEN
    RAISE EXCEPTION 'Forged composite exposed a hidden place';
  END IF;
  BEGIN
    IF EXISTS(SELECT 1 FROM public.spawt_checkin WHERE place_id='eeee0000-0000-4000-8000-0000000091c1') THEN
      RAISE EXCEPTION 'Anonymous aggregate exposed private visits';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-0000000091a2',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT public.last_spawt_at(p) FROM public.places p WHERE id='eeee0000-0000-4000-8000-0000000091c1')
      IS DISTINCT FROM now()-interval '2 days' THEN
    RAISE EXCEPTION 'Aggregate was limited to own visits';
  END IF;
  BEGIN
    IF EXISTS(SELECT 1 FROM public.spawt_checkin WHERE place_id='eeee0000-0000-4000-8000-0000000091c1') THEN
      RAISE EXCEPTION 'Aggregate exposed another account visits';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

-- Une correction de l'historique prend effet immédiatement, sans cache.
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-0000000091a1',true);
UPDATE public.spawt_checkin SET is_cancelled=true WHERE id='eeee0000-0000-4000-8000-0000000091d2';
UPDATE public.places SET name='Lieu édité aujourd’hui' WHERE id='eeee0000-0000-4000-8000-0000000091c1';
SET LOCAL ROLE anon;
DO $$ BEGIN
  IF (SELECT public.last_spawt_at(p) FROM public.places p WHERE id='eeee0000-0000-4000-8000-0000000091c1')
      IS DISTINCT FROM now()-interval '10 days' THEN
    RAISE EXCEPTION 'Cancelled visit or place edit changed recency';
  END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-0000000091a3',true);
UPDATE public.spawt_checkin SET deleted_at=now(),deleted_by_staff_id='eeee0000-0000-4000-8000-0000000091a3',deleted_reason='Recette retrait'
WHERE id='eeee0000-0000-4000-8000-0000000091d1';
SET LOCAL ROLE anon;
DO $$ BEGIN
  IF (SELECT public.last_spawt_at(p) FROM public.places p WHERE id='eeee0000-0000-4000-8000-0000000091c1') IS NOT NULL THEN
    RAISE EXCEPTION 'Deleted last visit kept a stale date';
  END IF;
END $$;
RESET ROLE;
ROLLBACK;

-- Rollback 0033 — Héritage La Meute
--
-- ⚠️ Les 4 tables du quiz sont PARTAGÉES avec le serveur du quiz (base
-- unifiée). Si elles contiennent des données, ce down NE LES DROP PAS (il
-- retire seulement le verrouillage posé par 0033) — les dropper détruirait la
-- waitlist réelle. Elles ne sont droppées que si elles sont VIDES (cas d'une
-- base neuve où 0033 les avait créées lui-même).

DROP FUNCTION IF EXISTS public.claim_meute_heritage(uuid, text);

ALTER TABLE public.spawters
  DROP COLUMN IF EXISTS quiz_archetype,
  DROP COLUMN IF EXISTS quiz_axes,
  DROP COLUMN IF EXISTS pionnier_seq,
  DROP COLUMN IF EXISTS referral_code,
  DROP COLUMN IF EXISTS referred_by;

DO $$
DECLARE
  t text;
  n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['meute_waitlist','table_versions','admin_config','app_config'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
    IF n = 0 THEN
      EXECUTE format('DROP TABLE public.%I CASCADE', t);
    ELSE
      -- Table peuplée par le quiz : on la garde, on retire juste le
      -- verrouillage 0033 (retour à l'état pré-migration côté RLS).
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
      RAISE NOTICE 'down 0033 : % contient % lignes — table conservée (données du quiz), RLS désactivée.', t, n;
    END IF;
  END LOOP;
END $$;

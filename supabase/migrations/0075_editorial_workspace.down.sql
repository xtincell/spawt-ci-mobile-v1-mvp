DROP FUNCTION IF EXISTS public.save_place_with_editorial_adn(uuid,jsonb,jsonb,timestamptz,timestamptz);
ALTER TABLE public.explore_collections DROP COLUMN IF EXISTS audience;
DROP FUNCTION IF EXISTS public.edit_editorial_note(uuid,text,text);
-- Export editorial drafts/reviews/history before rollback: this removes the workspace.
DROP VIEW IF EXISTS public.public_editorial_reviews;
DROP VIEW IF EXISTS public.editorial_team;
DROP FUNCTION IF EXISTS public.import_research_records(jsonb);
DROP FUNCTION IF EXISTS public.link_research_record(text,uuid,text);
DROP FUNCTION IF EXISTS public.save_place_editorial_profile(uuid,jsonb,integer);
DROP FUNCTION IF EXISTS public.publish_place_editorial_profile(uuid,integer,boolean);
DROP FUNCTION IF EXISTS public.set_place_editorial_adn(uuid,jsonb,timestamptz);
DROP FUNCTION IF EXISTS public.save_editorial_review(uuid,uuid,text,date,smallint,smallint,smallint,integer,boolean);
DROP TABLE IF EXISTS public.place_editorial_reviews,public.place_editorial_notes,public.place_editorial_profiles,public.research_records,public.editorial_history;
DROP FUNCTION IF EXISTS public.audit_editorial_change();
ALTER TABLE public.places DROP COLUMN IF EXISTS editorial_profile;
DROP TRIGGER IF EXISTS editorial_snapshot_guard ON public.places;
DROP FUNCTION IF EXISTS public.guard_editorial_public_snapshot();
NOTIFY pgrst,'reload schema';

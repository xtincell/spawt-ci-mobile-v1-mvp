DROP VIEW public.admin_app_activity;
DROP FUNCTION public.report_app_activity(uuid,uuid,boolean,text,text,text,text,integer);
DROP TABLE public.app_installations;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['places','place_adn','spawt_checkin','place_editorial_reviews','explore_collections','explore_items','place_events','place_promotions','app_announcements'] LOOP
    EXECUTE format('DROP TRIGGER content_revision ON public.%I',t);
  END LOOP;
END $$;
DROP FUNCTION public.bump_public_content_revision();
DROP FUNCTION public.public_content_status();
DROP TABLE public.public_content_revision;
DROP VIEW public.public_announcements;
DROP TABLE public.app_announcements;
DROP FUNCTION public.audit_announcement_change();

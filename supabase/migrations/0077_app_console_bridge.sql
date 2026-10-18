-- Published news, content invalidation and authenticated app activity.
CREATE TABLE public.app_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 178),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 10000),
  kind text NOT NULL DEFAULT 'info' CHECK (kind IN ('info','news','promo')),
  city_code text REFERENCES public.cities(code),
  deep_link text CHECK (deep_link IS NULL OR deep_link ~ '^/(place/[a-f0-9-]{36}|explore(/[a-z0-9_-]+)?|actualites(/[a-f0-9-]{36})?)$'),
  is_published boolean NOT NULL DEFAULT false,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX announcements_public_idx ON public.app_announcements(starts_at DESC) WHERE is_published;
CREATE TRIGGER announcements_updated BEFORE UPDATE ON public.app_announcements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.app_announcements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_announcements FROM anon,authenticated;
GRANT SELECT ON public.app_announcements TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.app_announcements TO authenticated;
CREATE POLICY announcements_public ON public.app_announcements FOR SELECT TO anon,authenticated
  USING(is_published AND starts_at<=now() AND (ends_at IS NULL OR ends_at>now()));
CREATE POLICY announcements_staff_read ON public.app_announcements FOR SELECT TO authenticated USING(public.is_active_staff());
CREATE POLICY announcements_admin_write ON public.app_announcements FOR ALL TO authenticated
  USING(public.is_admin_staff()) WITH CHECK(public.is_admin_staff());
CREATE FUNCTION public.audit_announcement_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  INSERT INTO public.editorial_history(actor_id,entity_table,entity_key,before_value,after_value)
  VALUES(auth.uid(),TG_TABLE_NAME,COALESCE(NEW.id,OLD.id)::text,to_jsonb(OLD),to_jsonb(NEW));
  RETURN NULL;
END $$;
CREATE TRIGGER announcements_history AFTER INSERT OR UPDATE OR DELETE ON public.app_announcements
  FOR EACH ROW EXECUTE FUNCTION public.audit_announcement_change();
CREATE VIEW public.public_announcements WITH(security_barrier=true) AS
  SELECT id,title,body,kind,city_code,deep_link,starts_at,ends_at,updated_at FROM public.app_announcements
  WHERE is_published AND starts_at<=now() AND (ends_at IS NULL OR ends_at>now());
GRANT SELECT ON public.public_announcements TO anon,authenticated;

-- Contains no content or account data. Clients poll one small row every 30s,
-- and invalidate on foreground. The minute clock also handles scheduled expiry.
CREATE TABLE public.public_content_revision(id boolean PRIMARY KEY DEFAULT true CHECK(id), revision bigint NOT NULL DEFAULT 0);
INSERT INTO public.public_content_revision DEFAULT VALUES;
ALTER TABLE public.public_content_revision ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_content_revision FROM anon,authenticated;
CREATE FUNCTION public.public_content_status() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT revision::text || ':' || floor(extract(epoch FROM now())/60)::text FROM public.public_content_revision WHERE id
$$;
REVOKE ALL ON FUNCTION public.public_content_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_content_status() TO anon,authenticated;
CREATE FUNCTION public.bump_public_content_revision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  UPDATE public.public_content_revision SET revision=revision+1 WHERE id;
  RETURN NULL;
END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['places','place_adn','spawt_checkin','place_editorial_reviews','explore_collections','explore_items','place_events','place_promotions','app_announcements'] LOOP
    EXECUTE format('CREATE TRIGGER content_revision AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.bump_public_content_revision()',t);
  END LOOP;
END $$;

CREATE TABLE public.app_installations (
  spawter_id uuid NOT NULL REFERENCES public.spawters(id) ON DELETE CASCADE,
  installation_id uuid NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  active_until timestamptz NOT NULL DEFAULT now(),
  platform text NOT NULL CHECK(platform IN ('ios','android','web')),
  app_version text,
  app_build text,
  push_status text NOT NULL CHECK(push_status IN ('unknown','registered','denied','unavailable','registration_failed','web')),
  pending_writes integer NOT NULL DEFAULT 0 CHECK(pending_writes>=0),
  PRIMARY KEY(spawter_id,installation_id)
);
CREATE INDEX app_installations_recent_idx ON public.app_installations(last_seen_at DESC);
ALTER TABLE public.app_installations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_installations FROM anon,authenticated;
GRANT SELECT ON public.app_installations TO authenticated;
CREATE POLICY app_activity_staff ON public.app_installations FOR SELECT TO authenticated USING(public.is_active_staff());
CREATE FUNCTION public.report_app_activity(p_spawter_id uuid,p_installation_id uuid,p_active boolean,p_platform text,p_version text,p_build text,p_push_status text,p_pending_writes integer DEFAULT 0)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_spawter_id OR NOT EXISTS(SELECT 1 FROM public.spawters WHERE id=auth.uid() AND NOT is_banned) THEN
    RAISE EXCEPTION 'account_required' USING ERRCODE='42501';
  END IF;
  IF p_active IS NULL OR length(p_version)>40 OR length(p_build)>40 OR p_pending_writes>100000 THEN RAISE EXCEPTION 'invalid_activity'; END IF;
  INSERT INTO public.app_installations(spawter_id,installation_id,last_seen_at,active_until,platform,app_version,app_build,push_status,pending_writes)
  VALUES(auth.uid(),p_installation_id,now(),CASE WHEN p_active THEN now()+interval '90 seconds' ELSE now() END,p_platform,p_version,p_build,p_push_status,p_pending_writes)
  ON CONFLICT(spawter_id,installation_id) DO UPDATE SET last_seen_at=EXCLUDED.last_seen_at,active_until=EXCLUDED.active_until,platform=EXCLUDED.platform,
    app_version=EXCLUDED.app_version,app_build=EXCLUDED.app_build,push_status=EXCLUDED.push_status,pending_writes=EXCLUDED.pending_writes;
  DELETE FROM public.app_installations WHERE spawter_id=auth.uid() AND last_seen_at<now()-interval '30 days';
END $$;
REVOKE ALL ON FUNCTION public.report_app_activity(uuid,uuid,boolean,text,text,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_app_activity(uuid,uuid,boolean,text,text,text,text,integer) TO authenticated;
-- Server time determines the activity flag; a stale browser clock cannot make
-- an old session appear connected. No auth tokens or telephone numbers exposed.
CREATE VIEW public.admin_app_activity WITH(security_barrier=true) AS
SELECT a.*,s.display_name,a.active_until>now() AS is_active,
  (SELECT count(*)::integer FROM public.push_tokens p WHERE p.spawter_id=a.spawter_id) AS push_devices
FROM public.app_installations a JOIN public.spawters s ON s.id=a.spawter_id
WHERE public.is_active_staff();
GRANT SELECT ON public.admin_app_activity TO authenticated;

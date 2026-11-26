BEGIN;
CREATE TABLE pilot_private.download_receipts (
 journey uuid REFERENCES pilot_private.journeys(id) ON DELETE CASCADE,
 build integer NOT NULL CHECK(build > 0),
 bytes bigint NOT NULL CHECK(bytes BETWEEN 1000000 AND 400000000),
 received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(journey,build)
);
CREATE TABLE pilot_private.onboarding_receipts (
 person uuid PRIMARY KEY REFERENCES public.spawters(id) ON DELETE CASCADE,
 install uuid NOT NULL REFERENCES pilot_private.installs(id) ON DELETE CASCADE,
 completed_at timestamptz NOT NULL,
 received_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION public.pilot_download_received(p_visit_key uuid,p_build integer,p_bytes bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE jid uuid;
BEGIN
 SELECT id INTO jid FROM pilot_private.journeys WHERE visit_key=p_visit_key AND clicked_at IS NOT NULL
   AND expires_at>clock_timestamp();
 IF jid IS NULL THEN RAISE EXCEPTION 'invalid_download_receipt'; END IF;
 INSERT INTO pilot_private.download_receipts(journey,build,bytes) VALUES (jid,p_build,p_bytes)
   ON CONFLICT(journey,build) DO NOTHING;
END $$;
CREATE FUNCTION public.pilot_onboarding_received(p_install_key uuid,p_completed_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid(); iid uuid:=pilot_private.bound_install(p_install_key,uid);
BEGIN
 IF iid IS NULL OR p_completed_at IS NULL OR NOT isfinite(p_completed_at)
    OR p_completed_at>clock_timestamp()+interval '5 minutes'
    OR NOT EXISTS(SELECT FROM pilot_private.installs WHERE id=iid AND p_completed_at>=first_open_at)
    OR NOT EXISTS(SELECT FROM public.user_palais WHERE spawter_id=uid)
    THEN RAISE EXCEPTION 'onboarding_not_ready'; END IF;
 INSERT INTO pilot_private.onboarding_receipts(person,install,completed_at) VALUES (uid,iid,p_completed_at)
    ON CONFLICT(person) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.pilot_download_received(uuid,integer,bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pilot_download_received(uuid,integer,bigint) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.pilot_onboarding_received(uuid,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pilot_onboarding_received(uuid,timestamptz) TO authenticated;

-- Reuse the original funnel and authorization. Dates stay in the same reporting timezone.
ALTER FUNCTION public.admin_pilot_funnel(timestamptz,timestamptz) RENAME TO admin_pilot_funnel_base;
REVOKE ALL ON FUNCTION public.admin_pilot_funnel_base(timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.admin_pilot_funnel(p_start timestamptz,p_end timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE base jsonb;
BEGIN
 base:=public.admin_pilot_funnel_base(p_start,p_end);
 RETURN (
  WITH downloads AS (
    SELECT j.source,count(DISTINCT r.journey) n
    FROM pilot_private.download_receipts r JOIN pilot_private.journeys j ON j.id=r.journey
    LEFT JOIN pilot_private.people p ON p.person=j.person
    WHERE r.received_at>=p_start AND r.received_at<p_end
      AND (j.person IS NULL OR p.population IN ('externe','beta_externe')) GROUP BY j.source
  ), onboardings AS (
    SELECT o.person,o.completed_at,coalesce(j.source,'unknown') AS origin,
      CASE WHEN j.source IN ('facebook','instagram') THEN j.campaign END AS campaign
    FROM pilot_private.onboarding_receipts o JOIN pilot_private.people p ON p.person=o.person
    LEFT JOIN pilot_private.journeys j ON j.install=o.install AND j.person=o.person AND j.clicked_at<=o.completed_at
    WHERE p.population IN ('externe','beta_externe')
    UNION ALL
    SELECT u.spawter_id,min(u.created_at),'unknown',NULL
    FROM public.user_signals u JOIN pilot_private.people p ON p.person=u.spawter_id
    JOIN public.user_palais pal ON pal.spawter_id=u.spawter_id
    WHERE u.event_name='onboarding_completed' AND u.created_at<p_end
      AND p.population IN ('externe','beta_externe')
      AND NOT EXISTS(SELECT FROM pilot_private.onboarding_receipts o WHERE o.person=u.spawter_id)
    GROUP BY u.spawter_id
  ), window_onboard AS (SELECT * FROM onboardings WHERE completed_at>=p_start AND completed_at<p_end),
  by_origin AS (SELECT origin,count(*) n FROM window_onboard GROUP BY origin),
  by_campaign AS (SELECT origin,campaign,count(*) n FROM window_onboard WHERE campaign IS NOT NULL GROUP BY origin,campaign)
  SELECT base || jsonb_build_object(
    'download_receipts',(SELECT coalesce(sum(n),0) FROM downloads),
    'onboarded',(SELECT count(*) FROM window_onboard),
    'onboarding_campaigns',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.campaign,c.origin),'[]'::jsonb) FROM by_campaign c),
    'origins',(SELECT jsonb_agg(v.row || jsonb_build_object('download_receipts',coalesce(d.n,0),'onboarded',coalesce(o.n,0)) ORDER BY v.ordinal)
      FROM jsonb_array_elements(base->'origins') WITH ORDINALITY v(row,ordinal)
      LEFT JOIN downloads d ON d.source=v.row->>'origin' LEFT JOIN by_origin o ON o.origin=v.row->>'origin')
  )
 );
END $$;
REVOKE ALL ON FUNCTION public.admin_pilot_funnel(timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_pilot_funnel(timestamptz,timestamptz) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

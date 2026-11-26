BEGIN;
CREATE FUNCTION public.admin_pilot_funnel(p_start timestamptz,p_end timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.current_staff() s WHERE s.role = 'admin') THEN
    RAISE EXCEPTION 'Admin staff only' USING ERRCODE = '42501';
  END IF;
  IF p_start IS NULL OR p_end IS NULL OR NOT isfinite(p_start) OR NOT isfinite(p_end)
     OR p_end <= p_start OR p_end - p_start > interval '32 days' THEN
    RAISE EXCEPTION 'Période invalide (32 jours maximum)' USING ERRCODE = '22023';
  END IF;
  RETURN (
    WITH metrics AS (SELECT * FROM pilot_private.funnel(p_start,p_end)),
    earliest_onboarding AS (
      SELECT u.spawter_id,min(u.created_at) AS received
      FROM public.user_signals u
      JOIN pilot_private.people p ON p.person=u.spawter_id
      JOIN public.user_palais pal ON pal.spawter_id=u.spawter_id
      WHERE u.event_name='onboarding_completed' AND u.created_at<p_end
        AND p.population IN ('externe','beta_externe')
      GROUP BY u.spawter_id
    ),
    recent AS (
      SELECT u.at_utc,u.origin,LEFT(u.person_id,12) AS person_ref,
             coalesce(l.name,'Lieu indisponible') AS place
      FROM pilot_private.usage u LEFT JOIN public.places l ON l.id=u.place_id
      WHERE u.at_utc>=p_start AND u.at_utc<p_end AND u.event='saved_place_added'
        AND u.population IN ('externe','beta_externe')
      ORDER BY u.at_utc DESC,u.person_id,u.place_id LIMIT 50
    )
    SELECT jsonb_build_object(
      'checked_at',statement_timestamp(),
      'onboarded',(SELECT count(*) FROM earliest_onboarding WHERE received>=p_start),
      'active',(SELECT count(*) FROM pilot_private.activations(p_start,p_end)),
      'viewers',(SELECT count(DISTINCT person_id) FROM pilot_private.usage
         WHERE at_utc>=p_start AND at_utc<p_end AND event='place_viewed' AND population IN ('externe','beta_externe')),
      'savers',(SELECT count(DISTINCT person_id) FROM pilot_private.usage
         WHERE at_utc>=p_start AND at_utc<p_end AND event='saved_place_added' AND population IN ('externe','beta_externe')),
      'origins',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.origin),'[]'::jsonb) FROM metrics m),
      'recent',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.at_utc DESC,r.person_ref,r.place),'[]'::jsonb) FROM recent r)
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_pilot_funnel(timestamptz,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_pilot_funnel(timestamptz,timestamptz) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

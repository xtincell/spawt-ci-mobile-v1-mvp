BEGIN;
CREATE SCHEMA pilot_private;
REVOKE ALL ON SCHEMA pilot_private FROM PUBLIC, anon, authenticated;

-- The browser's random visit capability is independent of the public reporting ID.
CREATE TABLE pilot_private.journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_key uuid NOT NULL UNIQUE,
  source text NOT NULL CHECK (source IN ('facebook','instagram','unknown')),
  campaign text, creative text, destination uuid,
  arrived_at timestamptz NOT NULL DEFAULT clock_timestamp(), clicked_at timestamptz,
  token uuid UNIQUE, code text UNIQUE, expires_at timestamptz,
  claimed_at timestamptz, person uuid REFERENCES public.spawters(id) ON DELETE CASCADE,
  install uuid UNIQUE, acquisition boolean,
  CHECK ((person IS NULL) = (install IS NULL))
);
CREATE TABLE pilot_private.installs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Receipt possession, never an advertising ID, IMEI or device fingerprint.
  secret uuid NOT NULL UNIQUE, first_open_at timestamptz NOT NULL, installed_at timestamptz, existing boolean NOT NULL,
  first_owner uuid REFERENCES public.spawters(id) ON DELETE SET NULL
);
ALTER TABLE pilot_private.journeys ADD FOREIGN KEY (install) REFERENCES pilot_private.installs(id);
CREATE UNIQUE INDEX pilot_one_acquisition_per_person ON pilot_private.journeys(person) WHERE acquisition;
CREATE TABLE pilot_private.opens (
  install uuid NOT NULL REFERENCES pilot_private.installs ON DELETE CASCADE,
  event_key uuid NOT NULL, opened_at timestamptz NOT NULL, PRIMARY KEY (install,event_key)
);
CREATE TABLE pilot_private.bindings (
  install uuid REFERENCES pilot_private.installs ON DELETE CASCADE,
  person uuid REFERENCES public.spawters ON DELETE CASCADE,
  PRIMARY KEY (install,person)
);
CREATE TABLE pilot_private.actions (
  person uuid REFERENCES public.spawters ON DELETE CASCADE, event_key uuid NOT NULL,
  install uuid NOT NULL REFERENCES pilot_private.installs, place_id uuid NOT NULL REFERENCES public.places,
  kind text NOT NULL CHECK(kind IN ('place_viewed','saved_place_added','saved_place_removed')),
  action_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  applied boolean NOT NULL, PRIMARY KEY(person,event_key)
);
CREATE INDEX pilot_actions_pair ON pilot_private.actions(person,place_id,action_at);
CREATE TABLE pilot_private.save_clock (
  person uuid REFERENCES public.spawters ON DELETE CASCADE, place_id uuid REFERENCES public.places,
  action_at timestamptz NOT NULL, event_key uuid NOT NULL, PRIMARY KEY(person,place_id)
);
CREATE TABLE pilot_private.batch (
  code text PRIMARY KEY CHECK(code IN ('B01','B02','B03','B04','B05','B06')),
  person uuid UNIQUE REFERENCES public.spawters ON DELETE SET NULL,
  recruitment text CHECK(recruitment IN ('facebook','instagram','whatsapp','unknown','other')),
  selected boolean NOT NULL, blocker text
);
INSERT INTO pilot_private.batch(code,selected)
SELECT 'B0'||n,n<=2 FROM generate_series(1,6) AS n;
CREATE FUNCTION public.pilot_campaign_touch(p_visit_key uuid,p_action text,p_source text,
  p_medium text,p_campaign text,p_creative text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path='' AS $$
DECLARE j pilot_private.journeys; campaign_ok boolean;
BEGIN
  IF p_visit_key IS NULL OR p_action IS NULL OR p_action NOT IN ('arrival','download_click') THEN
    RAISE EXCEPTION 'invalid_visit'; END IF;
  campaign_ok := coalesce(p_medium='paid_social' AND p_campaign='abidjan_beta_20261204' AND p_creative='pancakes_v2', false);
  INSERT INTO pilot_private.journeys(visit_key,source,campaign,creative,destination)
    VALUES(p_visit_key,CASE WHEN campaign_ok AND p_source IN ('facebook','instagram') THEN p_source ELSE 'unknown' END,
      CASE WHEN campaign_ok THEN p_campaign END,CASE WHEN campaign_ok THEN p_creative END,
      CASE WHEN campaign_ok THEN 'c5acfd12-01dd-5cd3-9beb-0531d89c3e99'::uuid END)
    ON CONFLICT(visit_key) DO NOTHING;
  SELECT * INTO j FROM pilot_private.journeys WHERE visit_key=p_visit_key FOR UPDATE;
  IF p_action='download_click' AND j.clicked_at IS NULL THEN
    UPDATE pilot_private.journeys SET clicked_at=clock_timestamp(), token=gen_random_uuid(),
      code=upper(left(replace(gen_random_uuid()::text,'-',''),12)), expires_at=clock_timestamp()+interval '7 days'
      WHERE id=j.id RETURNING * INTO j;
  END IF;
  RETURN jsonb_build_object('journey_id',j.id,'place_id',j.destination,
    'resume_token',CASE WHEN p_action='download_click' THEN j.token END,
    'resume_code',CASE WHEN p_action='download_click' THEN j.code END,'expires_at',j.expires_at);
END $$;

CREATE FUNCTION public.pilot_app_open(p_install_key uuid,p_event_key uuid,p_first_open_at timestamptz,
  p_opened_at timestamptz,p_existing_install boolean,p_installed_at timestamptz DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path='' AS $$
DECLARE iid uuid;
BEGIN
  IF p_first_open_at IS NULL OR p_opened_at IS NULL OR p_first_open_at>p_opened_at
    OR p_installed_at>p_first_open_at OR p_opened_at>clock_timestamp()+interval '5 minutes' THEN RAISE EXCEPTION 'invalid_clock'; END IF;
  INSERT INTO pilot_private.installs(secret,first_open_at,installed_at,existing) VALUES(p_install_key,p_first_open_at,p_installed_at,p_existing_install)
    ON CONFLICT(secret) DO NOTHING;
  SELECT id INTO STRICT iid FROM pilot_private.installs WHERE secret=p_install_key;
  INSERT INTO pilot_private.opens VALUES(iid,p_event_key,p_opened_at) ON CONFLICT DO NOTHING;
END $$;

CREATE FUNCTION public.pilot_bind_install(p_install_key uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path='' AS $$
DECLARE uid uuid:=auth.uid(); iid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  UPDATE pilot_private.installs SET first_owner=coalesce(first_owner,uid)
    WHERE secret=p_install_key RETURNING id INTO STRICT iid;
  INSERT INTO pilot_private.bindings VALUES(iid,uid) ON CONFLICT DO NOTHING;
END $$;

CREATE FUNCTION public.pilot_claim(p_install_key uuid,p_credential text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path='' AS $$
DECLARE uid uuid:=auth.uid(); i pilot_private.installs; j pilot_private.journeys; acquired boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  SELECT * INTO STRICT i FROM pilot_private.installs WHERE secret=p_install_key FOR UPDATE;
  -- A second account can have its own usage and favorites, never the first owner's campaign.
  IF i.first_owner IS DISTINCT FROM uid OR NOT EXISTS(SELECT FROM pilot_private.bindings WHERE install=i.id AND person=uid)
    THEN RAISE EXCEPTION 'claim_unavailable'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 4837));
  SELECT * INTO j FROM pilot_private.journeys WHERE token::text=lower(trim(p_credential))
    OR code=upper(trim(p_credential)) FOR UPDATE;
  IF NOT FOUND OR (j.person IS NOT NULL AND (j.person<>uid OR j.install<>i.id)) THEN
    RAISE EXCEPTION 'claim_unavailable'; END IF;
  IF j.person IS NULL THEN
    IF j.expires_at<=clock_timestamp() OR EXISTS(SELECT FROM pilot_private.journeys WHERE install=i.id)
      THEN RAISE EXCEPTION 'claim_unavailable'; END IF;
    acquired:=NOT i.existing AND i.installed_at IS NOT NULL AND i.installed_at>=j.clicked_at AND i.first_open_at>=j.clicked_at AND NOT EXISTS(
      SELECT FROM pilot_private.journeys WHERE person=uid AND acquisition);
    UPDATE pilot_private.journeys SET person=uid,install=i.id,claimed_at=clock_timestamp(),acquisition=acquired
      WHERE id=j.id RETURNING * INTO j;
  END IF;
  RETURN jsonb_build_object('journey_id',j.id,'place_id',j.destination,'attributed',true,'acquisition',j.acquisition);
END $$;

CREATE FUNCTION pilot_private.bound_install(secret_key uuid,owner_id uuid) RETURNS uuid
LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT i.id FROM pilot_private.installs i JOIN pilot_private.bindings b ON b.install=i.id
   WHERE i.secret=secret_key AND b.person=owner_id;
$$;

CREATE FUNCTION public.pilot_place_view(p_install_key uuid,p_event_key uuid,p_place_id uuid,p_occurred_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid(); iid uuid:=pilot_private.bound_install(p_install_key,uid);
BEGIN
  IF iid IS NULL OR p_occurred_at>clock_timestamp()+interval '5 minutes' THEN RAISE EXCEPTION 'invalid_action'; END IF;
  INSERT INTO pilot_private.actions(person,event_key,install,place_id,kind,action_at,applied)
    VALUES(uid,p_event_key,iid,p_place_id,'place_viewed',p_occurred_at,true)
    ON CONFLICT(person,event_key) DO NOTHING;
  IF NOT EXISTS(SELECT FROM pilot_private.actions WHERE person=uid AND event_key=p_event_key AND
    install=iid AND kind='place_viewed' AND place_id=p_place_id AND action_at=p_occurred_at)
    THEN RAISE EXCEPTION 'event_key_conflict'; END IF;
END $$;

CREATE FUNCTION public.pilot_saved_place(p_install_key uuid,p_event_key uuid,p_place_id uuid,p_occurred_at timestamptz,p_saved boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid(); iid uuid:=pilot_private.bound_install(p_install_key,uid);
  action_kind text:=CASE WHEN p_saved THEN 'saved_place_added' ELSE 'saved_place_removed' END;
  prev pilot_private.actions; changed boolean:=false; allow_write boolean;
BEGIN
  IF iid IS NULL OR p_saved IS NULL OR p_occurred_at IS NULL OR p_occurred_at>clock_timestamp()+interval '5 minutes'
    THEN RAISE EXCEPTION 'invalid_action'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text||p_place_id::text,4838));
  SELECT * INTO prev FROM pilot_private.actions WHERE person=uid AND event_key=p_event_key;
  IF FOUND THEN
    IF prev.place_id<>p_place_id OR prev.kind<>action_kind OR prev.install<>iid OR prev.action_at<>p_occurred_at
      THEN RAISE EXCEPTION 'event_key_conflict'; END IF;
    changed:=prev.applied;
  ELSE
    INSERT INTO pilot_private.save_clock AS latest VALUES(uid,p_place_id,p_occurred_at,p_event_key)
      ON CONFLICT(person,place_id) DO UPDATE SET action_at=excluded.action_at,event_key=excluded.event_key
      WHERE (excluded.action_at,excluded.event_key)>(latest.action_at,latest.event_key);
    allow_write:=FOUND;
    IF allow_write THEN
      IF p_saved THEN
        INSERT INTO public.saved_places(spawter_id,place_id) VALUES(uid,p_place_id) ON CONFLICT DO NOTHING;
      ELSE
        DELETE FROM public.saved_places WHERE spawter_id=uid AND place_id=p_place_id;
      END IF;
      changed:=FOUND;
    END IF;
    INSERT INTO pilot_private.actions(person,event_key,install,place_id,kind,action_at,applied)
      VALUES(uid,p_event_key,iid,p_place_id,action_kind,p_occurred_at,changed);
  END IF;
  RETURN jsonb_build_object('saved',EXISTS(SELECT FROM public.saved_places WHERE spawter_id=uid AND place_id=p_place_id),
    'applied',changed);
END $$;

REVOKE ALL ON FUNCTION public.pilot_campaign_touch(uuid,text,text,text,text,text),public.pilot_app_open(uuid,uuid,timestamptz,timestamptz,boolean,timestamptz),
 public.pilot_bind_install(uuid),public.pilot_claim(uuid,text),public.pilot_place_view(uuid,uuid,uuid,timestamptz),
 public.pilot_saved_place(uuid,uuid,uuid,timestamptz,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pilot_campaign_touch(uuid,text,text,text,text,text),
 public.pilot_app_open(uuid,uuid,timestamptz,timestamptz,boolean,timestamptz) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pilot_bind_install(uuid),public.pilot_claim(uuid,text),
 public.pilot_place_view(uuid,uuid,uuid,timestamptz),public.pilot_saved_place(uuid,uuid,uuid,timestamptz,boolean) TO authenticated;
COMMIT;

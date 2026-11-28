-- Private configuration for one store-reviewer identity only.
CREATE TABLE public.store_reviewer_config (
  phone text PRIMARY KEY CHECK (phone = '+12025550117'),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  salt uuid NOT NULL DEFAULT gen_random_uuid(),
  code_hash bytea NOT NULL CHECK (octet_length(code_hash) = 32)
);
ALTER TABLE public.store_reviewer_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.store_reviewer_config FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_reviewer_config TO service_role;

CREATE FUNCTION public.configure_store_reviewer(p_user_id uuid, p_code text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE s uuid := pg_catalog.gen_random_uuid();
BEGIN
  IF p_user_id IS NULL OR p_code IS NULL OR p_code !~ '^[0-9]{6}$' OR p_code IN ('123456', '000000') THEN
    RETURN false;
  END IF;
  INSERT INTO public.store_reviewer_config (phone, user_id, salt, code_hash)
  VALUES ('+12025550117', p_user_id, s, pg_catalog.sha256(pg_catalog.convert_to(s::text || ':' || p_code, 'UTF8')))
  ON CONFLICT (phone) DO UPDATE SET user_id = excluded.user_id, salt = excluded.salt, code_hash = excluded.code_hash;
  RETURN true;
END;
$$;

CREATE FUNCTION public.lookup_store_reviewer(p_code text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT COALESCE((SELECT pg_catalog.jsonb_build_object(
    'ready', true, 'userId', CASE WHEN p_code IS NOT NULL AND
    code_hash = pg_catalog.sha256(pg_catalog.convert_to(salt::text || ':' || p_code, 'UTF8')) THEN user_id ELSE NULL END)
    FROM public.store_reviewer_config WHERE phone = '+12025550117'),
    '{"ready":false,"userId":null}'::jsonb);
$$;
REVOKE ALL ON FUNCTION public.configure_store_reviewer(uuid,text), public.lookup_store_reviewer(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.configure_store_reviewer(uuid,text), public.lookup_store_reviewer(text) TO service_role;

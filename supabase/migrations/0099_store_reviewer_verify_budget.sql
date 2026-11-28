-- Store reviewer verification: serialize reservations by phone across replicas.
CREATE TABLE public.store_reviewer_verify_budget (
  phone_e164 text PRIMARY KEY CHECK (phone_e164 ~ '^\+[1-9][0-9]{1,14}$'),
  window_started_at timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts BETWEEN 1 AND 8)
);
ALTER TABLE public.store_reviewer_verify_budget ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.store_reviewer_verify_budget FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_reviewer_verify_budget TO service_role;

CREATE FUNCTION public.reserve_store_reviewer_verify(p_phone text) RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  t timestamptz := pg_catalog.clock_timestamp();
  reserved boolean;
BEGIN
  IF p_phone IS NULL OR p_phone !~ '^\+[1-9][0-9]{1,14}$' THEN
    RETURN false;
  END IF;

  INSERT INTO public.store_reviewer_verify_budget AS b (phone_e164, window_started_at, attempts)
  VALUES (p_phone, t, 1)
  ON CONFLICT (phone_e164) DO UPDATE
  SET window_started_at = CASE WHEN t >= b.window_started_at + interval '5 minutes'
                               THEN t ELSE b.window_started_at END,
      attempts = CASE WHEN t >= b.window_started_at + interval '5 minutes'
                      THEN 1 ELSE b.attempts + 1 END
  WHERE t >= b.window_started_at + interval '5 minutes' OR b.attempts < 8
  RETURNING true INTO reserved;

  RETURN COALESCE(reserved, false);
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_store_reviewer_verify(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_store_reviewer_verify(text) TO service_role;

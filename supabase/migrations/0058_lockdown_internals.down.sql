-- Down 0058 — réexpose les internes.
-- ⚠️ Rouvre la liste des migrations à l'API publique et remet les fonctions de
-- trigger et les prédicats RLS dans la surface d'API. À ne jouer que pour
-- revenir à l'état 0057, en connaissance de cause.
ALTER TABLE public.schema_migrations DISABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.schema_migrations TO anon, authenticated;
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
      AND pg_get_function_result(p.oid)='trigger'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', r.sig);
  END LOOP;
END$$;

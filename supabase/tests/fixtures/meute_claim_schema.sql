-- BASE JETABLE UNIQUEMENT. Fixture du contrat RPC et des droits, pas de
-- substitut à une restauration complète du schéma Supabase en production.
DO $$ BEGIN
  CREATE ROLE anon;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE authenticated;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE service_role;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY, phone text, phone_confirmed_at timestamptz);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
   current_setting('request.jwt.claims',true)::json->>'sub')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
CREATE TABLE public.spawters(
 id uuid PRIMARY KEY REFERENCES auth.users, phone_e164 text, display_name text,
 quiz_archetype text, quiz_axes jsonb, pionnier_seq integer,
 referral_code text, referred_by text, heritage_claimed_at timestamptz,
 updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.meute_waitlist(
 id text PRIMARY KEY, phone text UNIQUE, email text, archetype text, archetype_name text,
 axes text, seq serial, referral_code text, referred_by text, pseudo text
);
ALTER TABLE public.spawters ENABLE ROW LEVEL SECURITY;
CREATE POLICY spawters_select_own ON public.spawters FOR SELECT TO authenticated USING(auth.uid()=id);
CREATE POLICY spawters_update_own ON public.spawters FOR UPDATE TO authenticated USING(auth.uid()=id) WITH CHECK(auth.uid()=id);
ALTER TABLE public.meute_waitlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meute_waitlist FROM anon,authenticated;
GRANT SELECT,UPDATE ON public.spawters TO authenticated;

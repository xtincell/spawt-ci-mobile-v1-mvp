-- ============================================================================
-- Migration 0033 — Héritage « La Meute » (quiz waitlist → spawters)
-- ============================================================================
-- La base SPAWT est UNIFIÉE avec celle du quiz La Meute (spawt-meute-quiz) :
-- le quiz tourne sur le MÊME Postgres avec sa propre connexion pg directe
-- (server.mjs, pas PostgREST). Cette migration :
--   1. Capture le DDL des 4 tables du quiz (CREATE IF NOT EXISTS — si le quiz
--      a déjà initialisé son schéma, no-op ; sinon on le pose à l'identique
--      pour que le quiz démarre sans droit DDL).
--   2. Verrouille ces tables côté PostgREST : RLS activée SANS policy +
--      REVOKE anon/authenticated → l'API Supabase n'expose RIEN. Le quiz
--      continue d'y accéder par sa connexion directe (rôle propriétaire).
--   3. Pose les colonnes d'héritage sur spawters (archétype, axes, rang
--      pionnier, parrainage).
--   4. RPC claim_meute_heritage : au premier login OTP d'un pionnier, l'Edge
--      Function (service_role) recopie son profil quiz sur son compte spawter.
-- Date : 2026-07-26

-- ━━━ 1. DDL du quiz, à l'identique (server.mjs initSchema, lignes 27-113) ━━━
-- NB : le quiz fait un ALTER ADD COLUMN IF NOT EXISTS pseudo après coup —
-- on reproduit exactement la même séquence pour rester bit-à-bit compatible.
CREATE TABLE IF NOT EXISTS public.meute_waitlist (
  seq             SERIAL PRIMARY KEY,
  id              TEXT NOT NULL UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  phone           TEXT UNIQUE,
  email           TEXT,
  archetype       TEXT,
  archetype_name  TEXT,
  axes            TEXT,
  referral_code   TEXT UNIQUE,
  referred_by     TEXT,
  referral_count  INTEGER NOT NULL DEFAULT 0,
  city            TEXT DEFAULT 'Abidjan',
  source          TEXT
);
ALTER TABLE public.meute_waitlist ADD COLUMN IF NOT EXISTS pseudo TEXT;

CREATE INDEX IF NOT EXISTS idx_meute_phone   ON public.meute_waitlist(phone);
CREATE INDEX IF NOT EXISTS idx_meute_email   ON public.meute_waitlist(email);
CREATE INDEX IF NOT EXISTS idx_meute_refcode ON public.meute_waitlist(referral_code);
CREATE INDEX IF NOT EXISTS idx_meute_refby   ON public.meute_waitlist(referred_by);

CREATE TABLE IF NOT EXISTS public.table_versions (
  archetype  TEXT PRIMARY KEY,
  version    TEXT NOT NULL DEFAULT 'a',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_config (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  recovery_code TEXT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_config (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.meute_waitlist IS
  'Waitlist du quiz La Meute (DDL = server.mjs du quiz). Accès EXCLUSIF par la '
  'connexion pg directe du quiz + service_role. RLS sans policy : PostgREST '
  'n''expose rien (phone/email = PII, admin_config = secrets).';

-- ━━━ 2. Verrouillage PostgREST : RLS sans policy + REVOKE ━━━━━━━━━━━━━━━━━━━
-- Ces tables contiennent des PII (phone, email) et des secrets (admin_config).
-- RLS activée sans aucune policy = deny-all pour anon/authenticated ; le
-- REVOKE est la ceinture ET les bretelles (les default privileges Supabase
-- grantent sinon SELECT & co à ces rôles sur toute nouvelle table de public).
ALTER TABLE public.meute_waitlist  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_versions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_config    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config      ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.meute_waitlist  FROM anon, authenticated;
REVOKE ALL ON public.table_versions  FROM anon, authenticated;
REVOKE ALL ON public.admin_config    FROM anon, authenticated;
REVOKE ALL ON public.app_config      FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.meute_waitlist_seq_seq FROM anon, authenticated;

-- ━━━ 3. Colonnes héritage sur spawters ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.spawters
  ADD COLUMN quiz_archetype text,
  ADD COLUMN quiz_axes      jsonb,
  ADD COLUMN pionnier_seq   integer,
  ADD COLUMN referral_code  text,
  ADD COLUMN referred_by    text;

COMMENT ON COLUMN public.spawters.quiz_archetype IS
  'Clé archétype héritée du quiz La Meute (omnivore, gardien, …). Posée une '
  'seule fois par claim_meute_heritage — déclenche la carte collector (0037).';
COMMENT ON COLUMN public.spawters.quiz_axes IS
  'Axes bruts du quiz (jsonb) — matière première pour pré-calibrer le Palais.';
COMMENT ON COLUMN public.spawters.pionnier_seq IS
  'Rang d''inscription à la waitlist (meute_waitlist.seq) — « Pionnier #42 ».';
COMMENT ON COLUMN public.spawters.referral_code IS
  'Code de parrainage hérité du quiz — sert au calcul ambassadeur (0044).';

-- ━━━ 4. RPC claim_meute_heritage ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Appelée par l'Edge Function post-OTP (service_role) : le téléphone vérifié
-- par OTP est la preuve d'identité — même clé canonique +225XXXXXXXXXX des
-- deux côtés (le quiz canonise à l'insertion, cf. server.mjs normalizePhone).
-- Idempotente : si le spawter a déjà réclamé (quiz_archetype ou pionnier_seq
-- posé), re-appel = no-op qui renvoie l'existant avec claimed=false.
CREATE OR REPLACE FUNCTION public.claim_meute_heritage(
  p_spawter_id uuid,
  p_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_spawter public.spawters%ROWTYPE;
  v_quiz    public.meute_waitlist%ROWTYPE;
  v_axes    jsonb;
BEGIN
  SELECT * INTO v_spawter FROM public.spawters WHERE id = p_spawter_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'claimed', false, 'archetype', NULL, 'pionnier_seq', NULL,
      'code', 'spawter_not_found');
  END IF;

  -- Déjà réclamé → no-op (idempotence).
  IF v_spawter.quiz_archetype IS NOT NULL OR v_spawter.pionnier_seq IS NOT NULL THEN
    RETURN jsonb_build_object(
      'claimed', false,
      'archetype', v_spawter.quiz_archetype,
      'pionnier_seq', v_spawter.pionnier_seq,
      'code', 'already_claimed');
  END IF;

  SELECT * INTO v_quiz FROM public.meute_waitlist WHERE phone = p_phone;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'claimed', false, 'archetype', NULL, 'pionnier_seq', NULL,
      'code', 'phone_not_in_waitlist');
  END IF;

  -- axes est du TEXT côté quiz : cast défensif, un JSON invalide ne doit pas
  -- faire échouer le claim (l'archétype et le rang priment).
  BEGIN
    v_axes := v_quiz.axes::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_axes := NULL;
  END;

  UPDATE public.spawters SET
    quiz_archetype = v_quiz.archetype,
    quiz_axes      = v_axes,
    pionnier_seq   = v_quiz.seq,
    referral_code  = v_quiz.referral_code,
    referred_by    = v_quiz.referred_by,
    updated_at     = now()
  WHERE id = p_spawter_id;

  RETURN jsonb_build_object(
    'claimed', true,
    'archetype', v_quiz.archetype,
    'pionnier_seq', v_quiz.seq,
    'code', 'claimed');
END;
$$;

COMMENT ON FUNCTION public.claim_meute_heritage(uuid, text) IS
  'Héritage quiz La Meute → compte spawter (archetype/axes/pionnier/parrainage). '
  'Idempotente (re-appel = no-op). service_role ONLY : le client ne choisit pas '
  'son téléphone, c''est l''Edge Function post-OTP qui passe le phone vérifié.';

-- service_role uniquement : un client authenticated pourrait sinon réclamer
-- l'héritage d'un téléphone qui n'est pas le sien.
REVOKE EXECUTE ON FUNCTION public.claim_meute_heritage(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_meute_heritage(uuid, text) TO service_role;

-- ============================================================================
-- Migration 0051 — Corrections boucle adversariale (P0 héritage + P2 Crew/push)
-- ============================================================================
-- Trois correctifs SQL issus d'une passe de chasse aux bugs vérifiée :
--
--   P0  — héritage « La Meute » jamais réclamable pour un nouveau spawter.
--         `claim_meute_heritage` (0033) échouait toujours au 1er login (la ligne
--         spawters n'existe qu'au finalizeOnboarding, APRÈS l'OTP) et se
--         verrouillait ensuite sur `quiz_archetype` (posé localement) → héritage
--         (archétype quiz + n° Pionnier + parrainage) perdu définitivement.
--         Correctif : flag dédié `heritage_claimed_at` (le critère « déjà
--         réclamé » n'est PLUS la présence de quiz_archetype), la fonction ne
--         se verrouille pas quand la ligne spawters est absente (l'app upsert
--         puis re-claim), et devient appelable par le propriétaire authentifié.
--
--   P2#6+#14 — Crew : ordre de proposition non déterministe (`crew_proposals`
--         sans created_at → départage « premier proposé » aléatoire au refresh)
--         + `crew_sessions` hors publication realtime (un membre en arrière-plan
--         au broadcast de clôture ne refetch jamais).
--
--   P2#10 — token push non réattribuable au changement de compte : après un
--         logout non-propre la row `push_tokens` reste au compte A, l'upsert de
--         B (onConflict token) échoue sous la RLS UPDATE owner-only (0034).
--         Correctif : RPC `claim_push_token` SECURITY DEFINER qui réassigne la
--         ligne au device courant (auth.uid()).
-- Date : 2026-07-26

-- ━━━ 1. P0 — héritage « La Meute » réclamable ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1a. Flag dédié « héritage déjà réclamé ». NULL = jamais réclamé (claimable).
ALTER TABLE public.spawters
  ADD COLUMN IF NOT EXISTS heritage_claimed_at timestamptz;

COMMENT ON COLUMN public.spawters.heritage_claimed_at IS
  'Horodatage du claim d''héritage quiz La Meute (claim_meute_heritage 0051). '
  'NULL = jamais réclamé. REMPLACE quiz_archetype comme critère d''idempotence : '
  'finalizeOnboarding pose quiz_archetype localement AVANT le claim, s''y fier '
  'rendait l''héritage inatteignable (finding P0).';

-- 1b. Backfill défensif : une ligne portant pionnier_seq a forcément déjà
-- matché la waitlist (le seul chemin qui pose pionnier_seq est un claim
-- réussi) → on la marque réclamée pour ne pas la re-claimer.
UPDATE public.spawters
  SET heritage_claimed_at = coalesce(updated_at, now())
  WHERE pionnier_seq IS NOT NULL AND heritage_claimed_at IS NULL;

-- 1c. Fonction re-écrite.
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
  v_role    text;
  v_phone   text;
BEGIN
  BEGIN
    v_role := current_setting('request.jwt.claims', true)::json ->> 'role';
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  SELECT * INTO v_spawter FROM public.spawters WHERE id = p_spawter_id;
  IF NOT FOUND THEN
    -- La ligne spawters n'existe pas encore (claim tenté au 1er login OTP,
    -- avant finalizeOnboarding). NE PAS échouer définitivement et ne poser
    -- AUCUN flag : l'app upsert la ligne puis re-claim (finding P0). Le code
    -- 'spawter_pending' dit au caller « réessaie après création de la ligne ».
    RETURN jsonb_build_object(
      'claimed', false, 'archetype', NULL, 'pionnier_seq', NULL,
      'code', 'spawter_pending');
  END IF;

  -- Autorisation : le propriétaire authentifié peut réclamer SON héritage ;
  -- service_role (Edge Function post-OTP) a les mains libres. Un authenticated
  -- ne peut jamais réclamer pour la ligne d'un autre (usurpation d'identité).
  IF v_role IS DISTINCT FROM 'service_role'
     AND auth.uid() IS DISTINCT FROM p_spawter_id THEN
    RAISE EXCEPTION 'claim_meute_heritage forbidden: not owner, not service_role'
      USING ERRCODE = '42501';
  END IF;

  -- Déjà réclamé → no-op (idempotence). Critère = heritage_claimed_at, JAMAIS
  -- quiz_archetype (cf. commentaire de colonne).
  IF v_spawter.heritage_claimed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'claimed', false,
      'archetype', v_spawter.quiz_archetype,
      'pionnier_seq', v_spawter.pionnier_seq,
      'code', 'already_claimed');
  END IF;

  -- Téléphone canonique de matching : celui de la LIGNE (source de vérité,
  -- posé depuis le téléphone vérifié par OTP au signup) pour un caller
  -- authentifié — il ne peut donc pas réclamer l'héritage d'un numéro qui
  -- n'est pas le sien. service_role (Edge trusted) garde p_phone.
  IF v_role = 'service_role' THEN
    v_phone := p_phone;
  ELSE
    v_phone := v_spawter.phone_e164;
  END IF;

  SELECT * INTO v_quiz FROM public.meute_waitlist WHERE phone = v_phone;
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
    quiz_archetype      = v_quiz.archetype,
    quiz_axes           = v_axes,
    pionnier_seq        = v_quiz.seq,
    referral_code       = v_quiz.referral_code,
    referred_by         = v_quiz.referred_by,
    heritage_claimed_at = now(),
    updated_at          = now()
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
  'Idempotente via heritage_claimed_at (0051, PAS quiz_archetype). Ne verrouille '
  'rien si la ligne spawters est absente (spawter_pending → l''app re-claim au '
  'finalizeOnboarding). Réclamable par le propriétaire authentifié (téléphone '
  'dérivé de la ligne, anti-usurpation) OU service_role (Edge post-OTP, p_phone).';

-- Le propriétaire authentifié peut re-claimer au finalizeOnboarding (la RPC
-- dérive le téléphone de SA ligne, il ne peut donc pas réclamer un autre
-- numéro). service_role reste autorisé (Edge post-OTP).
REVOKE EXECUTE ON FUNCTION public.claim_meute_heritage(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_meute_heritage(uuid, text) TO authenticated, service_role;

-- ━━━ 2. P2#6+#14 — Crew : ordre déterministe + realtime sessions ━━━━━━━━━━━━
-- 2a. created_at sur crew_proposals : départage « premier proposé »
-- (crew-resolution.ts règle 3) déterministe. DEFAULT now() → les lignes
-- existantes reçoivent l'horodatage de la migration (ordre stable ensuite).
ALTER TABLE public.crew_proposals
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.crew_proposals.created_at IS
  'Horodatage de proposition — clé de tri déterministe du départage « premier '
  'proposé » (crew-resolution.ts règle 3). Sans elle, l''ordre de fetch variait '
  'd''un refresh à l''autre (finding P2#6).';

CREATE INDEX IF NOT EXISTS crew_proposals_session_created_idx
  ON public.crew_proposals (session_id, created_at);

-- 2b. crew_sessions dans la publication realtime : un membre en arrière-plan
-- au moment du broadcast de clôture (status→resolved) refetch alors sa session
-- (finding P2#14). DO block tolérant (publication absente en local/test — 0038).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.crew_sessions;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'publication supabase_realtime absente (env local/test) — étape ignorée';
  WHEN duplicate_object THEN
    RAISE NOTICE 'crew_sessions déjà dans supabase_realtime — étape ignorée';
END $$;

-- ━━━ 3. P2#10 — token push réattribuable au changement de compte ━━━━━━━━━━━━
-- Le token physique appartient au DEVICE courant : la RPC réassigne la ligne à
-- auth.uid() en bypass RLS (SECURITY DEFINER), là où l'upsert client direct
-- échoue sous la RLS UPDATE owner-only (0034) quand la ligne est restée au
-- compte précédent après un logout non-propre.
CREATE OR REPLACE FUNCTION public.claim_push_token(
  p_token text,
  p_platform text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'claim_push_token forbidden: no authenticated caller'
      USING ERRCODE = '42501';
  END IF;
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RAISE EXCEPTION 'claim_push_token: token vide' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.push_tokens (spawter_id, token, platform)
  VALUES (v_uid, p_token, p_platform)
  ON CONFLICT (token) DO UPDATE SET
    spawter_id = v_uid,
    platform   = EXCLUDED.platform,
    updated_at = now();
END;
$$;

COMMENT ON FUNCTION public.claim_push_token(text, text) IS
  'Enregistre/réassigne le token push du device courant à auth.uid() (finding '
  'P2#10). SECURITY DEFINER : bypass la RLS owner-only (0034) pour reprendre un '
  'token resté au compte précédent après un logout non-propre.';

REVOKE EXECUTE ON FUNCTION public.claim_push_token(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_push_token(text, text) TO authenticated, service_role;

-- Retour au contrat 0051 ; aucune donnée ni table supprimée.
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


-- 0069 — Réutiliser les réponses La Meute avant de créer le profil.
-- Étend la RPC existante sans table, colonne, endpoint ni droit supplémentaire.
-- Authenticated : numéro confirmé de auth.users, jamais une donnée du profil.
-- Service_role : contrat Edge post-OTP existant conservé (p_phone trusted).
-- Preview : aucune création ni consentement implicite ; le claim définitif
-- reste après création du profil. Les anciens clients ignorent axes.
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
  v_quiz public.meute_waitlist%ROWTYPE;
  v_axes jsonb;
  v_role text;
  v_phone text;
  v_has_spawter boolean;
BEGIN
  BEGIN
    v_role := current_setting('request.jwt.claims', true)::json ->> 'role';
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;
  -- Autoriser AVANT toute lecture, même si le profil n'existe pas encore.
  IF v_role IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_spawter_id) THEN
    RAISE EXCEPTION 'claim_meute_heritage forbidden: not owner, not service_role'
      USING ERRCODE = '42501';
  END IF;

  IF v_role = 'service_role' THEN
    v_phone := p_phone;
  ELSE
    -- GoTrue conserve le téléphone sans +. Ne pas accepter l'email placeholder,
    -- un téléphone non confirmé ni une valeur modifiable de public.spawters.
    SELECT '+' || ltrim(phone, '+') INTO v_phone FROM auth.users
      WHERE id = p_spawter_id AND phone_confirmed_at IS NOT NULL
        AND ltrim(phone, '+') ~ '^[1-9][0-9]{7,14}$';
    IF v_phone IS NULL THEN
      RETURN jsonb_build_object('claimed', false, 'archetype', NULL,
        'pionnier_seq', NULL, 'axes', NULL, 'code', 'phone_not_verified');
    END IF;
  END IF;

  SELECT * INTO v_spawter FROM public.spawters WHERE id = p_spawter_id FOR UPDATE;
  v_has_spawter := FOUND;
  IF v_has_spawter AND v_spawter.heritage_claimed_at IS NOT NULL THEN
    RETURN jsonb_build_object('claimed', false,
      'archetype', v_spawter.quiz_archetype, 'pionnier_seq', v_spawter.pionnier_seq,
      'axes', v_spawter.quiz_axes, 'code', 'already_claimed');
  END IF;

  SELECT * INTO v_quiz FROM public.meute_waitlist WHERE phone = v_phone;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('claimed', false, 'archetype', NULL,
      'pionnier_seq', NULL, 'axes', NULL,
      'code', CASE WHEN v_has_spawter THEN 'phone_not_in_waitlist' ELSE 'spawter_pending' END);
  END IF;
  BEGIN
    v_axes := v_quiz.axes::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_axes := NULL;
  END;

  IF NOT v_has_spawter THEN
    RETURN jsonb_build_object('claimed', false, 'archetype', v_quiz.archetype,
      'pionnier_seq', v_quiz.seq, 'axes', v_axes, 'code', 'spawter_pending');
  END IF;

  UPDATE public.spawters SET
    quiz_archetype = v_quiz.archetype, quiz_axes = v_axes,
    pionnier_seq = v_quiz.seq, referral_code = v_quiz.referral_code,
    referred_by = v_quiz.referred_by, heritage_claimed_at = now(), updated_at = now()
  WHERE id = p_spawter_id;

  RETURN jsonb_build_object('claimed', true, 'archetype', v_quiz.archetype,
    'pionnier_seq', v_quiz.seq, 'axes', v_axes, 'code', 'claimed');
END;
$$;
COMMENT ON FUNCTION public.claim_meute_heritage(uuid,text) IS
  '0069 : preview des cinq axes avant profil, claim idempotent après profil. '
  'Propriétaire authentifié par téléphone confirmé auth.users ; service_role post-OTP trusted.';
REVOKE EXECUTE ON FUNCTION public.claim_meute_heritage(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_meute_heritage(uuid,text) TO authenticated, service_role;

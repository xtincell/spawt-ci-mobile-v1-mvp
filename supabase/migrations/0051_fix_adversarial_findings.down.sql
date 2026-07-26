-- Down 0051 — rollback des correctifs adversariaux.
-- Restaure claim_meute_heritage dans sa forme 0033 (idempotence sur
-- quiz_archetype/pionnier_seq), retire heritage_claimed_at, created_at sur
-- crew_proposals, la RPC push et la publication realtime des sessions.

-- 3. Push : retrait de la RPC de réattribution.
DROP FUNCTION IF EXISTS public.claim_push_token(text, text);

-- 2. Crew : retrait created_at + index, et de la publication realtime.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.crew_sessions;
EXCEPTION
  WHEN undefined_object THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;

DROP INDEX IF EXISTS public.crew_proposals_session_created_idx;
ALTER TABLE public.crew_proposals DROP COLUMN IF EXISTS created_at;

-- 1. Héritage : restaure la fonction 0033 (critère quiz_archetype/pionnier_seq)
-- et le grant service_role-only, puis retire heritage_claimed_at.
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

REVOKE EXECUTE ON FUNCTION public.claim_meute_heritage(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_meute_heritage(uuid, text) TO service_role;

ALTER TABLE public.spawters DROP COLUMN IF EXISTS heritage_claimed_at;

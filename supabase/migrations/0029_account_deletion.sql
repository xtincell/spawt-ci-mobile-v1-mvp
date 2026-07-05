-- Migration 0029 — Suppression de compte à la demande (ARTCI Loi 2013-450)
-- Date: 2026-07-02
-- Contexte: Phase 2 — exigence Play Store (une app avec comptes + localisation
-- background DOIT offrir la suppression in-app) et path de révocation ARTCI
-- documenté depuis le Sprint 1 (spawter-store §recordConsent : « la révocation
-- est exposée via le path DELETE /me »).
--
-- Modèle : suppression douce immédiate (anonymisation des données affichées +
-- déconnexion impossible via phone NULL) + purge totale J+30 (job à câbler —
-- la requête de purge est fournie en commentaire ci-dessous).

ALTER TABLE public.spawters
  ADD COLUMN deletion_requested_at TIMESTAMPTZ;

COMMENT ON COLUMN public.spawters.deletion_requested_at IS
  'Demande de suppression du compte par le spawter (RPC request_account_deletion). '
  'Anonymisation immédiate des champs affichés ; purge totale J+30 (job).';

CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_spawter UUID := auth.uid();
BEGIN
  IF v_spawter IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authenticated');
  END IF;

  UPDATE public.spawters SET
    deletion_requested_at = now(),
    display_name = 'Spawter parti',
    avatar_url = NULL,
    phone_e164 = NULL,          -- bloque toute reconnexion OTP
    date_of_birth = NULL,
    gender = NULL,
    updated_at = now()
  WHERE id = v_spawter;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  -- Désactive aussi la session côté GoTrue : révoque les refresh tokens.
  UPDATE auth.refresh_tokens SET revoked = true WHERE user_id = v_spawter::text;

  RETURN jsonb_build_object('ok', true, 'code', 'deletion_requested');
END;
$$;

COMMENT ON FUNCTION public.request_account_deletion() IS
  'Phase 2 — suppression de compte self-service (ARTCI + Play Store). '
  'Anonymisation immédiate + révocation des sessions. Purge J+30 : '
  'DELETE FROM auth.users WHERE id IN (SELECT id FROM spawters WHERE '
  'deletion_requested_at < now() - interval ''30 days''); -- cascade spawters';

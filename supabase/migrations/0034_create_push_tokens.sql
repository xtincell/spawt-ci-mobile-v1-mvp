-- ============================================================================
-- Migration 0034 — push_tokens (notifications push serveur)
-- ============================================================================
-- Le push serveur était hors scope V1 (spawt-context §Hors scope). Sprint 2 :
-- l'app enregistre son token Expo/FCM/APNs ici, les Edge Functions (Guet,
-- défis collectifs, Crew) le lisent via service_role pour cibler l'envoi.
-- Un token = un device ; un spawter peut avoir plusieurs devices.
-- token UNIQUE : si un device change de compte, l'insert du nouveau proprio
-- passe par un upsert côté app (delete+insert ou ON CONFLICT côté service).
-- Date : 2026-07-26

CREATE TABLE public.push_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spawter_id   uuid NOT NULL REFERENCES public.spawters(id) ON DELETE CASCADE,
  token        text NOT NULL UNIQUE,
  platform     text CHECK (platform IN ('ios','android')),
  device_label text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.push_tokens IS
  'Tokens push par device (Expo push token ou FCM/APNs natif). RLS owner-only '
  'en écriture/lecture ; le staff lit pour debug ; l''envoi passe par '
  'service_role (Edge Functions).';

CREATE INDEX push_tokens_spawter_id_idx ON public.push_tokens (spawter_id);

CREATE TRIGGER update_timestamp_push_tokens
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ━━━ Row-Level Security ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY push_tokens_select_own ON public.push_tokens
  FOR SELECT TO authenticated
  USING (spawter_id = auth.uid());

CREATE POLICY push_tokens_insert_own ON public.push_tokens
  FOR INSERT TO authenticated
  WITH CHECK (spawter_id = auth.uid());

CREATE POLICY push_tokens_update_own ON public.push_tokens
  FOR UPDATE TO authenticated
  USING (spawter_id = auth.uid())
  WITH CHECK (spawter_id = auth.uid());

-- DELETE own : logout/désinscription des notifs = retrait du token.
CREATE POLICY push_tokens_delete_own ON public.push_tokens
  FOR DELETE TO authenticated
  USING (spawter_id = auth.uid());

-- Staff actif : lecture (debug ciblage). Helper anti-recursion 0021.
CREATE POLICY push_tokens_select_staff ON public.push_tokens
  FOR SELECT TO authenticated
  USING (public.is_active_staff());

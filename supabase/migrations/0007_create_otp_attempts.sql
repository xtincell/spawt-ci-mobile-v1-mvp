-- ============================================================================
-- Migration 0007 — Table `otp_attempts` (rate-limit + pin_id lookup)
-- ============================================================================
-- Story 2.3 — Authentification OTP + Google + Apple
-- PRD ref : FR-001 (auth phone+OTP) + architecture §Authentication & Security
--
-- Cette table sert deux usages côté Edge Functions :
--   1. Rate-limit serveur (5 envois / phone_e164 / heure, 20 / IP / heure).
--   2. Mapping `phone_e164 → last_request_id` pour que `otp-verify` retrouve le
--      pin_id Termii correspondant à l'envoi le plus récent.
--
-- RLS : aucune policy publique. Accessible uniquement via service_role (Edge
-- Functions). Pattern projet : tables internes server-side restent verrouillées
-- côté RLS pour faire échouer tout accès direct depuis le client mobile.
-- ============================================================================

CREATE TABLE public.otp_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164      text NOT NULL
                    CHECK (phone_e164 ~ '^\+[1-9]\d{1,14}$'),
  ip              text,
  request_id      text NOT NULL,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  verified_at     timestamptz
);

COMMENT ON TABLE public.otp_attempts IS
  'Audit des envois OTP via Termii (Story 2.3). Lookup pin_id côté otp-verify, rate-limit côté otp-send. RLS verrouillée — accessible uniquement via service_role.';
COMMENT ON COLUMN public.otp_attempts.request_id IS
  'pin_id Termii — exigé par /api/sms/otp/verify pour valider le code.';
COMMENT ON COLUMN public.otp_attempts.ip IS
  'IP source du Edge Function call (header x-forwarded-for). NULL si non disponible.';

CREATE INDEX otp_attempts_phone_sent_at_idx
  ON public.otp_attempts (phone_e164, sent_at DESC);
CREATE INDEX otp_attempts_ip_sent_at_idx
  ON public.otp_attempts (ip, sent_at DESC);

ALTER TABLE public.otp_attempts ENABLE ROW LEVEL SECURITY;
-- Aucune policy : tout accès SELECT/INSERT/UPDATE/DELETE depuis un client
-- public échoue. service_role bypass RLS — exclusivité Edge Functions.

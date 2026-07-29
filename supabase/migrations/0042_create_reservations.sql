-- ============================================================================
-- Migration 0042 — reservation_requests : réservation 1-tap
-- ============================================================================
-- V1 de la réservation : SPAWT n'orchestre PAS la table — il ouvre le canal
-- (WhatsApp deep-link ou appel) et trace la demande. Le lieu confirme hors
-- app ; le statut est mis à jour par le spawter (« c'est bon ») ou par le
-- compte B2B du lieu (0043 — la policy B2B est posée là-bas car le helper
-- is_b2b_of() n'existe pas encore à cette migration).
-- Date : 2026-07-26

CREATE TABLE public.reservation_requests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id   uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  spawter_id uuid NOT NULL REFERENCES public.spawters(id) ON DELETE CASCADE,
  party_size smallint NOT NULL CHECK (party_size BETWEEN 1 AND 20),
  slot_at    timestamptz,
  channel    text NOT NULL DEFAULT 'whatsapp'
               CHECK (channel IN ('whatsapp','phone')),
  status     text NOT NULL DEFAULT 'sent'
               CHECK (status IN ('sent','confirmed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.reservation_requests IS
  'Réservation 1-tap (WhatsApp/appel). SPAWT trace la demande, la confirmation '
  'se joue hors app. Lecture B2B du lieu : policy posée en 0043 (is_b2b_of).';

CREATE INDEX reservation_requests_place_idx
  ON public.reservation_requests (place_id, created_at DESC);
CREATE INDEX reservation_requests_spawter_idx
  ON public.reservation_requests (spawter_id, created_at DESC);

-- ━━━ Row-Level Security ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.reservation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY reservation_requests_insert_own ON public.reservation_requests
  FOR INSERT TO authenticated
  WITH CHECK (spawter_id = auth.uid());

CREATE POLICY reservation_requests_select_own ON public.reservation_requests
  FOR SELECT TO authenticated
  USING (spawter_id = auth.uid());

-- Le spawter met à jour SES demandes (annulation / confirmation reçue).
CREATE POLICY reservation_requests_update_own ON public.reservation_requests
  FOR UPDATE TO authenticated
  USING (spawter_id = auth.uid())
  WITH CHECK (spawter_id = auth.uid());

-- Staff actif : lecture (support).
CREATE POLICY reservation_requests_select_staff ON public.reservation_requests
  FOR SELECT TO authenticated
  USING (public.is_active_staff());

-- NB : reservation_requests_select_b2b (le lieu lit SES demandes) est créée
-- par la migration 0043 — elle dépend du helper is_b2b_of().

-- Story 4.1 — Migration spawt_checkin (PRD §3.1 Feature 5, §13.7)
-- Réversible : voir 0011_create_spawt_checkin.down.sql
--
-- Cohérence shape TS : app/src/types/spawt.ts:12-51 (SpawtCheckin).
-- Invariants anti-fraude (champs `flag_reason` posés par triggers Story 4.4) :
-- app/src/types/spawt.ts:72-100 (ANTIFRAUD_RULES).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE spawt_checkin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spawter_id UUID NOT NULL REFERENCES spawters(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  -- Cycle du Guet
  arrived_at TIMESTAMPTZ NOT NULL,
  notified_at TIMESTAMPTZ,
  snoozed_at TIMESTAMPTZ,
  snooze_count SMALLINT NOT NULL DEFAULT 0 CHECK (snooze_count BETWEEN 0 AND 3),
  checked_in_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  check_in_type TEXT NOT NULL CHECK (check_in_type IN ('active','passive','manual')),
  session_duration_minutes INTEGER CHECK (session_duration_minutes IS NULL OR session_duration_minutes >= 0),
  -- Géoloc
  geolocation_lat DOUBLE PRECISION,
  geolocation_lng DOUBLE PRECISION,
  accuracy_meters REAL CHECK (accuracy_meters IS NULL OR accuracy_meters >= 0),
  geolocation_source TEXT NOT NULL CHECK (geolocation_source IN ('gps','network','manual')),
  distance_to_lieu_meters REAL,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  -- Anti-fraude (triggers Story 4.4 posent flag_reason)
  flag_reason TEXT,
  -- Avis attaché (Story 4.5 — null en 4.1)
  note_etoiles SMALLINT CHECK (note_etoiles IS NULL OR note_etoiles BETWEEN 1 AND 5),
  texte_avis TEXT CHECK (texte_avis IS NULL OR char_length(texte_avis) <= 500),
  tags TEXT[] NOT NULL DEFAULT '{}',
  photos TEXT[] NOT NULL DEFAULT '{}',
  is_cancelled BOOLEAN NOT NULL DEFAULT false,
  -- Seed (Claude amendment 5.4 — Story 6.3 staff bypass via service_role)
  is_seed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour requêtes fréquentes :
--  - liste des spawts d'un spawter (Profil/Story 5.x) → idx_spawter
--  - calculs ADN/anti-fraude par lieu (Story 4.4, 4.7) → idx_place
--  - rows pending (left_at NULL) pour cleanup passive (Story 4.2) → idx_active partiel
CREATE INDEX idx_spawt_checkin_spawter ON spawt_checkin(spawter_id, arrived_at DESC);
CREATE INDEX idx_spawt_checkin_place ON spawt_checkin(place_id, arrived_at DESC);
CREATE INDEX idx_spawt_checkin_active ON spawt_checkin(spawter_id, place_id, arrived_at)
  WHERE left_at IS NULL;

-- Trigger updated_at — touch automatique (pattern aligné migration 0010).
CREATE OR REPLACE FUNCTION set_spawt_checkin_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_spawt_checkin_updated_at
  BEFORE UPDATE ON spawt_checkin
  FOR EACH ROW EXECUTE FUNCTION set_spawt_checkin_updated_at();

-- RLS — spawter_id = auth.uid() invariant (architecture §Authentication & Security).
-- INSERT/UPDATE bloqués pour is_seed = true (seeds via service_role Story 6.3).
-- DELETE refusée publiquement (append-only, modération via service_role Story 6.4).
ALTER TABLE spawt_checkin ENABLE ROW LEVEL SECURITY;

CREATE POLICY spawt_checkin_select_own ON spawt_checkin
  FOR SELECT TO authenticated
  USING (spawter_id = auth.uid());

CREATE POLICY spawt_checkin_insert_own ON spawt_checkin
  FOR INSERT TO authenticated
  WITH CHECK (spawter_id = auth.uid() AND is_seed = false);

CREATE POLICY spawt_checkin_update_own ON spawt_checkin
  FOR UPDATE TO authenticated
  USING (spawter_id = auth.uid() AND is_seed = false)
  WITH CHECK (spawter_id = auth.uid() AND is_seed = false);

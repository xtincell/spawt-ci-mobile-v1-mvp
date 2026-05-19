-- Story 3.3a — Migration places + place_adn 1:1 (PRD §13.2, §6 ADN du Lieu)
-- Réversible : voir 0010_create_places_place_adn.down.sql

-- `gen_random_uuid()` exige pgcrypto. Supabase managé l'active par défaut,
-- mais `supabase db reset` sur un projet local fraîchement créé peut échouer
-- ici si l'extension n'a pas été ajoutée à la baseline.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- Table places — fiche lieu publique (PRD §13.2)
-- ============================================================================
CREATE TABLE places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cuisine TEXT[] NOT NULL DEFAULT '{}',
  -- Location (colonnes plates pour index, pivot nested côté TS)
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  descriptive_address TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Abidjan',
  -- Price
  price_tier SMALLINT NOT NULL CHECK (price_tier BETWEEN 1 AND 3),
  avg_ticket_xof INTEGER CHECK (avg_ticket_xof IS NULL OR avg_ticket_xof >= 0),
  -- Hours stockés en JSONB (Record<DayOfWeek, OpeningSlot[]>)
  hours JSONB NOT NULL DEFAULT '{}',
  phone TEXT,
  whatsapp TEXT,
  cover_photo_url TEXT,
  gallery_urls TEXT[] NOT NULL DEFAULT '{}',
  signals TEXT[] NOT NULL DEFAULT '{}',
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Table place_adn 1:1 (PRD §6 + §13.2)
-- ============================================================================
CREATE TABLE place_adn (
  place_id UUID PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,
  axe_local_international REAL NOT NULL DEFAULT 0 CHECK (axe_local_international BETWEEN -1 AND 1),
  axe_informel_etabli REAL NOT NULL DEFAULT 0 CHECK (axe_informel_etabli BETWEEN -1 AND 1),
  axe_budget_premium REAL NOT NULL DEFAULT 0 CHECK (axe_budget_premium BETWEEN -1 AND 1),
  axe_populaire_prive REAL NOT NULL DEFAULT 0 CHECK (axe_populaire_prive BETWEEN -1 AND 1),
  axe_decontracte_habille REAL NOT NULL DEFAULT 0 CHECK (axe_decontracte_habille BETWEEN -1 AND 1),
  confidence_score REAL NOT NULL DEFAULT 0 CHECK (confidence_score BETWEEN 0 AND 1),
  total_reviews INTEGER NOT NULL DEFAULT 0 CHECK (total_reviews >= 0),
  weighted_rating REAL NOT NULL DEFAULT 0 CHECK (weighted_rating BETWEEN 0 AND 5),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Index (partiels sur is_published — perf SELECT public)
-- ============================================================================
CREATE INDEX idx_places_neighborhood ON places(neighborhood) WHERE is_published = true;
CREATE INDEX idx_places_cuisine ON places USING GIN(cuisine) WHERE is_published = true;
CREATE INDEX idx_places_signals ON places USING GIN(signals) WHERE is_published = true;
CREATE INDEX idx_places_location ON places(lat, lng) WHERE is_published = true;

-- ============================================================================
-- Trigger updated_at (touch automatique)
-- ============================================================================
CREATE OR REPLACE FUNCTION set_places_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_places_updated_at
  BEFORE UPDATE ON places
  FOR EACH ROW
  EXECUTE FUNCTION set_places_updated_at();

CREATE TRIGGER trg_place_adn_updated_at
  BEFORE UPDATE ON place_adn
  FOR EACH ROW
  EXECUTE FUNCTION set_places_updated_at();

-- ============================================================================
-- RLS — SELECT public uniquement pour lieux publiés.
-- INSERT/UPDATE/DELETE : aucune policy publique en V1, le staff opère via
-- service_role (Story 6.2 ajoutera les policies admin).
-- ============================================================================
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_adn ENABLE ROW LEVEL SECURITY;

CREATE POLICY places_select_published ON places
  FOR SELECT TO anon, authenticated
  USING (is_published = true);

CREATE POLICY place_adn_select_published ON place_adn
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM places
      WHERE places.id = place_adn.place_id
        AND places.is_published = true
    )
  );

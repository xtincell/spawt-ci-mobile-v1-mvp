-- Story 3.3a — Réversion places + place_adn.

DROP TRIGGER IF EXISTS trg_place_adn_updated_at ON place_adn;
DROP TRIGGER IF EXISTS trg_places_updated_at ON places;
DROP FUNCTION IF EXISTS set_places_updated_at();
DROP POLICY IF EXISTS place_adn_select_published ON place_adn;
DROP POLICY IF EXISTS places_select_published ON places;
DROP INDEX IF EXISTS idx_places_location;
DROP INDEX IF EXISTS idx_places_signals;
DROP INDEX IF EXISTS idx_places_cuisine;
DROP INDEX IF EXISTS idx_places_neighborhood;
DROP TABLE IF EXISTS place_adn;
DROP TABLE IF EXISTS places;

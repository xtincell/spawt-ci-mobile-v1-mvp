-- Story 4.4 — 6 triggers anti-fraude sur spawt_checkin (PRD §20.4, NFR-FRAUD-01→06).
-- Source TS canonique : app/src/types/spawt.ts §ANTIFRAUD_RULES — gel invariants.
-- Naming : trg_antifraud_<règle> (architecture §Naming Patterns).
--
-- Stratégie : 1 fonction PL/pgSQL par règle, BEFORE INSERT (ou BEFORE INSERT/UPDATE
-- pour `incoherence_duree`). NFR-FRAUD-01 = RAISE EXCEPTION (rejet). Les autres
-- FLAG : NEW.flag_reason = <code>; RETURN NEW. Priorité : 1er match dans l'ordre
-- alphabetical des triggers gagne (chaque trigger check IF NEW.flag_reason IS NULL).
-- NFR-FRAUD-04 = `sans_geoloc` flag (poids 0.5x = Story 4.7 côté agrégation).

-- ═══════════════════════════════════════════════════════════════════════════
-- Helper : haversine_km (PL/pgSQL — réutilisé par vitesse + pattern)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION antifraud_haversine_km(
  lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
DECLARE
  r CONSTANT DOUBLE PRECISION := 6371; -- Earth radius km
  dlat DOUBLE PRECISION;
  dlng DOUBLE PRECISION;
  a DOUBLE PRECISION;
BEGIN
  IF lat1 IS NULL OR lat2 IS NULL OR lng1 IS NULL OR lng2 IS NULL THEN
    RETURN NULL;
  END IF;
  dlat := radians(lat2 - lat1);
  dlng := radians(lng2 - lng1);
  a := sin(dlat/2)*sin(dlat/2)
     + cos(radians(lat1))*cos(radians(lat2))*sin(dlng/2)*sin(dlng/2);
  RETURN 2 * r * asin(sqrt(a));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ═══════════════════════════════════════════════════════════════════════════
-- NFR-FRAUD-01 — Rejet < 4h même lieu (frequence_meme_lieu)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trg_antifraud_frequence_meme_lieu()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_seed = true THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM spawt_checkin
    WHERE spawter_id = NEW.spawter_id
      AND place_id = NEW.place_id
      AND id <> NEW.id
      AND is_verified = true
      AND NEW.arrived_at - arrived_at < INTERVAL '4 hours'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'antifraud_frequence_meme_lieu',
      HINT = 'Spawt rejected: less than 4h since last verified spawt on this place';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_antifraud_frequence_meme_lieu
  BEFORE INSERT ON spawt_checkin
  FOR EACH ROW EXECUTE FUNCTION trg_antifraud_frequence_meme_lieu();

-- ═══════════════════════════════════════════════════════════════════════════
-- NFR-FRAUD-02 — Flag > 5 spawts/jour (frequence_globale)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trg_antifraud_frequence_globale()
RETURNS TRIGGER AS $$
DECLARE
  cnt INTEGER;
BEGIN
  IF NEW.is_seed = true THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO cnt
    FROM spawt_checkin
    WHERE spawter_id = NEW.spawter_id
      AND id <> NEW.id
      AND arrived_at >= NEW.arrived_at - INTERVAL '24 hours'
      AND arrived_at < NEW.arrived_at;
  IF cnt >= 5 THEN
    NEW.flag_reason := 'frequence_globale';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_antifraud_frequence_globale
  BEFORE INSERT ON spawt_checkin
  FOR EACH ROW EXECUTE FUNCTION trg_antifraud_frequence_globale();

-- ═══════════════════════════════════════════════════════════════════════════
-- NFR-FRAUD-03 — Flag vitesse > 100 km/h entre 2 spawts (vitesse_anormale)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trg_antifraud_vitesse_anormale()
RETURNS TRIGGER AS $$
DECLARE
  prev_row RECORD;
  delta_hours DOUBLE PRECISION;
  delta_km DOUBLE PRECISION;
BEGIN
  IF NEW.is_seed = true THEN RETURN NEW; END IF;
  IF NEW.geolocation_lat IS NULL OR NEW.geolocation_lng IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO prev_row FROM spawt_checkin
    WHERE spawter_id = NEW.spawter_id
      AND id <> NEW.id
      AND geolocation_lat IS NOT NULL
      AND geolocation_lng IS NOT NULL
      AND arrived_at < NEW.arrived_at
    ORDER BY arrived_at DESC
    LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  delta_hours := EXTRACT(EPOCH FROM (NEW.arrived_at - prev_row.arrived_at)) / 3600.0;
  IF delta_hours <= 0 THEN RETURN NEW; END IF;
  delta_km := antifraud_haversine_km(
    prev_row.geolocation_lat, prev_row.geolocation_lng,
    NEW.geolocation_lat, NEW.geolocation_lng
  );
  IF delta_km IS NOT NULL AND (delta_km / delta_hours) > 100 THEN
    IF NEW.flag_reason IS NULL THEN
      NEW.flag_reason := 'vitesse_anormale';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_antifraud_vitesse_anormale
  BEFORE INSERT ON spawt_checkin
  FOR EACH ROW EXECUTE FUNCTION trg_antifraud_vitesse_anormale();

-- ═══════════════════════════════════════════════════════════════════════════
-- NFR-FRAUD-05 — Flag 10+ patterns identiques en 7j (pattern_repetitif)
-- "Pattern identique" V1 = même place_id + même note_etoiles + même tags.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trg_antifraud_pattern_repetitif()
RETURNS TRIGGER AS $$
DECLARE
  cnt INTEGER;
BEGIN
  IF NEW.is_seed = true THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO cnt
    FROM spawt_checkin
    WHERE spawter_id = NEW.spawter_id
      AND id <> NEW.id
      AND place_id = NEW.place_id
      AND COALESCE(note_etoiles, -1) = COALESCE(NEW.note_etoiles, -1)
      AND tags = NEW.tags
      AND arrived_at >= NEW.arrived_at - INTERVAL '7 days';
  IF cnt >= 10 THEN
    IF NEW.flag_reason IS NULL THEN
      NEW.flag_reason := 'pattern_repetitif';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_antifraud_pattern_repetitif
  BEFORE INSERT ON spawt_checkin
  FOR EACH ROW EXECUTE FUNCTION trg_antifraud_pattern_repetitif();

-- ═══════════════════════════════════════════════════════════════════════════
-- NFR-FRAUD-06 — Flag left_at - arrived_at < 5min ET check_in_type = 'active'
-- BEFORE INSERT OR UPDATE car left_at est set après l'insert initial.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trg_antifraud_incoherence_duree()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_seed = true THEN RETURN NEW; END IF;
  IF NEW.left_at IS NOT NULL
     AND NEW.arrived_at IS NOT NULL
     AND NEW.check_in_type = 'active'
     AND (NEW.left_at - NEW.arrived_at) < INTERVAL '5 minutes' THEN
    IF NEW.flag_reason IS NULL THEN
      NEW.flag_reason := 'incoherence_duree';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_antifraud_incoherence_duree
  BEFORE INSERT OR UPDATE OF left_at, check_in_type, arrived_at ON spawt_checkin
  FOR EACH ROW EXECUTE FUNCTION trg_antifraud_incoherence_duree();

-- ═══════════════════════════════════════════════════════════════════════════
-- NFR-FRAUD-04 — Flag `sans_geoloc` pour check-ins active/manual non-vérifiés.
-- La pondération 0.5x (PRD §20.4) vit côté Story 4.7 (agrégation ADN).
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trg_antifraud_sans_geoloc()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_seed = true THEN RETURN NEW; END IF;
  IF NEW.is_verified = false
     AND NEW.check_in_type IN ('active', 'manual')
     AND NEW.flag_reason IS NULL THEN
    NEW.flag_reason := 'sans_geoloc';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_antifraud_sans_geoloc
  BEFORE INSERT ON spawt_checkin
  FOR EACH ROW EXECUTE FUNCTION trg_antifraud_sans_geoloc();

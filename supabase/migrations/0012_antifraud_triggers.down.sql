-- Story 4.4 — Rollback 6 triggers anti-fraude.
-- Ordre symétrique à 0012_antifraud_triggers.sql.

DROP TRIGGER IF EXISTS trg_antifraud_sans_geoloc ON spawt_checkin;
DROP TRIGGER IF EXISTS trg_antifraud_incoherence_duree ON spawt_checkin;
DROP TRIGGER IF EXISTS trg_antifraud_pattern_repetitif ON spawt_checkin;
DROP TRIGGER IF EXISTS trg_antifraud_vitesse_anormale ON spawt_checkin;
DROP TRIGGER IF EXISTS trg_antifraud_frequence_globale ON spawt_checkin;
DROP TRIGGER IF EXISTS trg_antifraud_frequence_meme_lieu ON spawt_checkin;
DROP FUNCTION IF EXISTS trg_antifraud_sans_geoloc();
DROP FUNCTION IF EXISTS trg_antifraud_incoherence_duree();
DROP FUNCTION IF EXISTS trg_antifraud_pattern_repetitif();
DROP FUNCTION IF EXISTS trg_antifraud_vitesse_anormale();
DROP FUNCTION IF EXISTS trg_antifraud_frequence_globale();
DROP FUNCTION IF EXISTS trg_antifraud_frequence_meme_lieu();
DROP FUNCTION IF EXISTS antifraud_haversine_km(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);

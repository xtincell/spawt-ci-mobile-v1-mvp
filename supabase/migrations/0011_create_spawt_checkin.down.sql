-- Story 4.1 — Rollback spawt_checkin.
-- Ordre symétrique à 0011_create_spawt_checkin.sql.

DROP POLICY IF EXISTS spawt_checkin_update_own ON spawt_checkin;
DROP POLICY IF EXISTS spawt_checkin_insert_own ON spawt_checkin;
DROP POLICY IF EXISTS spawt_checkin_select_own ON spawt_checkin;
DROP TRIGGER IF EXISTS trg_spawt_checkin_updated_at ON spawt_checkin;
DROP FUNCTION IF EXISTS set_spawt_checkin_updated_at();
DROP INDEX IF EXISTS idx_spawt_checkin_active;
DROP INDEX IF EXISTS idx_spawt_checkin_place;
DROP INDEX IF EXISTS idx_spawt_checkin_spawter;
DROP TABLE IF EXISTS spawt_checkin;

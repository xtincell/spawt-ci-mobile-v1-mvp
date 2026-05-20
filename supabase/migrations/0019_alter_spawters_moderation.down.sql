DROP POLICY IF EXISTS spawters_update_staff ON spawters;
DROP POLICY IF EXISTS spawt_checkin_soft_delete_staff ON spawt_checkin;
DROP POLICY IF EXISTS spawt_checkin_select_staff ON spawt_checkin;
DROP INDEX IF EXISTS idx_spawt_checkin_not_deleted;
DROP INDEX IF EXISTS idx_spawters_is_banned;
ALTER TABLE spawt_checkin
  DROP CONSTRAINT IF EXISTS spawt_checkin_delete_coherence,
  DROP COLUMN IF EXISTS deleted_reason,
  DROP COLUMN IF EXISTS deleted_by_staff_id,
  DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE spawters
  DROP CONSTRAINT IF EXISTS spawters_ban_coherence,
  DROP COLUMN IF EXISTS last_warning_reason,
  DROP COLUMN IF EXISTS last_warning_at,
  DROP COLUMN IF EXISTS warning_count,
  DROP COLUMN IF EXISTS banned_reason,
  DROP COLUMN IF EXISTS banned_at,
  DROP COLUMN IF EXISTS is_banned;

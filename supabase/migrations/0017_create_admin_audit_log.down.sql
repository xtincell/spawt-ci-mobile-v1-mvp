DROP POLICY IF EXISTS admin_audit_log_insert_own ON admin_audit_log;
DROP POLICY IF EXISTS admin_audit_log_select_admin ON admin_audit_log;
DROP POLICY IF EXISTS admin_audit_log_select_own ON admin_audit_log;
DROP INDEX IF EXISTS idx_admin_audit_log_action;
DROP INDEX IF EXISTS idx_admin_audit_log_entity;
DROP INDEX IF EXISTS idx_admin_audit_log_staff_created;
DROP TABLE IF EXISTS admin_audit_log;

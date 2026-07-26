-- Down 0047 — restaure les CHECK d'origine (0017).
-- ⚠️ Échoue si des lignes utilisent les nouvelles valeurs (comportement
-- voulu : on ne supprime pas d'audit trail silencieusement).

ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_action_check CHECK (action IN (
  'login',
  'place_create', 'place_update', 'place_delete', 'place_publish_toggle',
  'place_adn_update',
  'review_keep', 'review_delete', 'review_warning',
  'spawter_warning', 'spawter_ban', 'spawter_unban',
  'seed_inventory_run'
));

ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_entity_type_check;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_entity_type_check CHECK (entity_type IN (
  'place', 'place_adn', 'spawt_checkin', 'spawter', 'session', 'seed_batch'
));

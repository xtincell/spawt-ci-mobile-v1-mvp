-- Story 6.1 — Audit log des actions spawt_staff dans le panel admin
-- PRD FR-023 + amendement 4.1 (séparation B2C/staff) + architecture §3 l243-244
-- (actions critiques auditées avec horodatage + auteur spawt_staff_id).

CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spawt_staff_id UUID NOT NULL REFERENCES spawt_staff(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN (
    'login',
    'place_create', 'place_update', 'place_delete', 'place_publish_toggle',
    'place_adn_update',
    'review_keep', 'review_delete', 'review_warning',
    'spawter_warning', 'spawter_ban', 'spawter_unban',
    'seed_inventory_run'
  )),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('place','place_adn','spawt_checkin','spawter','session','seed_batch')),
  entity_id UUID,
  payload_before JSONB,
  payload_after JSONB,
  reason TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_log_staff_created ON admin_audit_log(spawt_staff_id, created_at DESC);
CREATE INDEX idx_admin_audit_log_entity ON admin_audit_log(entity_type, entity_id);
CREATE INDEX idx_admin_audit_log_action ON admin_audit_log(action, created_at DESC);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_audit_log_select_own ON admin_audit_log
  FOR SELECT TO authenticated
  USING (spawt_staff_id = auth.uid());

CREATE POLICY admin_audit_log_select_admin ON admin_audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.role = 'admin' AND s.is_active = true
    )
  );

CREATE POLICY admin_audit_log_insert_own ON admin_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    spawt_staff_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );

-- Pas d'UPDATE/DELETE — append-only (audit trail immuable).

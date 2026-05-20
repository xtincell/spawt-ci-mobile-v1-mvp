-- Story 6.4 — Colonnes de modération sur spawters + soft-delete sur spawt_checkin
-- + policies staff manquantes.
--
-- Note : le recompute ADN suite à un soft-delete n'est pas atomique V1 — defer D-641
-- trigger SQL Sprint 2.

-- ━━━ spawters : colonnes de modération ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE spawters
  ADD COLUMN is_banned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN banned_at TIMESTAMPTZ,
  ADD COLUMN banned_reason TEXT,
  ADD COLUMN warning_count INTEGER NOT NULL DEFAULT 0 CHECK (warning_count >= 0),
  ADD COLUMN last_warning_at TIMESTAMPTZ,
  ADD COLUMN last_warning_reason TEXT;

-- Cohérence : un compte banni doit avoir banned_at NOT NULL et banned_reason NOT NULL.
ALTER TABLE spawters
  ADD CONSTRAINT spawters_ban_coherence CHECK (
    (is_banned = false AND banned_at IS NULL AND banned_reason IS NULL)
    OR
    (is_banned = true AND banned_at IS NOT NULL AND banned_reason IS NOT NULL)
  );

CREATE INDEX idx_spawters_is_banned ON spawters(is_banned, banned_at DESC) WHERE is_banned = true;

COMMENT ON COLUMN spawters.is_banned IS
  'true = compte banni, session JWT invalidée par Edge Function moderate-spawter. Voir Story 6.4.';
COMMENT ON COLUMN spawters.banned_reason IS
  'Motif obligatoire (UI form). Faux-Pas canoniques PRD section 19 : Fake Review, Gatekeeping, Hater Toxique.';
COMMENT ON COLUMN spawters.warning_count IS
  'Compteur d''avertissements posés avant ban. Politique 3-strikes pas codifiée V1 (jugement humain staff).';

-- ━━━ spawt_checkin : soft-delete via deleted_at ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE spawt_checkin
  ADD COLUMN deleted_at TIMESTAMPTZ,
  ADD COLUMN deleted_by_staff_id UUID REFERENCES spawt_staff(id) ON DELETE RESTRICT,
  ADD COLUMN deleted_reason TEXT;

ALTER TABLE spawt_checkin
  ADD CONSTRAINT spawt_checkin_delete_coherence CHECK (
    (deleted_at IS NULL AND deleted_by_staff_id IS NULL AND deleted_reason IS NULL)
    OR
    (deleted_at IS NOT NULL AND deleted_by_staff_id IS NOT NULL AND deleted_reason IS NOT NULL)
  );

CREATE INDEX idx_spawt_checkin_not_deleted ON spawt_checkin(created_at DESC) WHERE deleted_at IS NULL;

COMMENT ON COLUMN spawt_checkin.deleted_at IS
  'Soft-delete admin (Story 6.4). NULL = avis visible. NOT NULL = exclu de l''affichage public + recompute ADN.';

-- ━━━ Policies staff sur spawt_checkin ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE POLICY spawt_checkin_select_staff ON spawt_checkin
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );

CREATE POLICY spawt_checkin_soft_delete_staff ON spawt_checkin
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );

-- ━━━ Policies staff sur spawters (UPDATE pour ban/warning) ━━━━━━━━━━━━━━━━━━

CREATE POLICY spawters_update_staff ON spawters
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );

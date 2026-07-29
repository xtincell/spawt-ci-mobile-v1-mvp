-- ============================================================================
-- Migration 0004 — feature_flags (runtime activation par scope)
-- ============================================================================
-- Story 1.8. FR-041 (feature flags runtime). Pas de flag posé sur les FR
-- data-layer ni les NFR.

CREATE TABLE public.feature_flags (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_code    text NOT NULL
                 CHECK (
                   length(flag_code) BETWEEN 1 AND 64
                   AND flag_code ~ '^[a-z0-9_]+$'
                 ),
  spawter_id   uuid REFERENCES public.spawters(id) ON DELETE CASCADE,
  enabled      boolean NOT NULL DEFAULT false,
  scope        text NOT NULL
                 CHECK (scope IN ('internal','alpha','beta','prod')),
  expires_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  -- Note : NULL est distinct dans une UNIQUE par défaut sur Postgres < 15.
  -- On utilise NULLS NOT DISTINCT (PG 15+) pour traiter NULL spawter_id
  -- comme une vraie valeur. Garantit 0 ou 1 ligne globale par (code, scope).
  UNIQUE NULLS NOT DISTINCT (flag_code, spawter_id, scope)
);

COMMENT ON TABLE public.feature_flags IS
  'Flags runtime par scope (internal/alpha/beta/prod). spawter_id NULL = scope global ; non-NULL = override pour un spawter. expires_at NULL = pas d''expiration.';
COMMENT ON COLUMN public.feature_flags.flag_code IS
  'Slug snake_case. Aucun flag sur les FR data-layer (FR-024 à FR-030) ni sur les NFR — invariants techniques.';

CREATE INDEX feature_flags_flag_code_scope_idx
  ON public.feature_flags (flag_code, scope);
CREATE INDEX feature_flags_spawter_id_idx
  ON public.feature_flags (spawter_id) WHERE spawter_id IS NOT NULL;

CREATE TRIGGER update_timestamp_feature_flags
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ━━━ RLS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Un spawter lit les flags globaux + ses overrides, filtrés serveur-side sur
-- expires_at (clock skew device-safe — pas de filtre côté client).
CREATE POLICY feature_flags_select_own ON public.feature_flags
  FOR SELECT
  USING (
    (spawter_id IS NULL OR spawter_id = auth.uid())
    AND (expires_at IS NULL OR expires_at > now())
  );

-- Staff actif : lit tous les flags non expirés.
CREATE POLICY feature_flags_select_staff ON public.feature_flags
  FOR SELECT
  USING (
    (expires_at IS NULL OR expires_at > now())
    AND EXISTS (
      SELECT 1 FROM public.spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );

-- Staff admin uniquement : INSERT/UPDATE/DELETE.
-- DECISION D4 (code review 2026-05-16) : cohérent avec doc spawt_staff.role
-- (`operator = lecture seule métriques + lieux`, `moderator = modération avis
-- + comptes`). Flag flipping = changement prod sensible, réservé admin. Si
-- un cas légitime émerge (Story 2.3+), amender via AC explicite.
CREATE POLICY feature_flags_insert_staff ON public.feature_flags
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
        AND s.role = 'admin'
    )
  );

CREATE POLICY feature_flags_update_staff ON public.feature_flags
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
        AND s.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
        AND s.role = 'admin'
    )
  );

CREATE POLICY feature_flags_delete_staff ON public.feature_flags
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
        AND s.role = 'admin'
    )
  );

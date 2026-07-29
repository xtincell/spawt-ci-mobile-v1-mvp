-- ============================================================================
-- Migration 0039 — place_suggestions : la Meute propose des lieux
-- ============================================================================
-- Un spawter suggère un spot absent de l'inventaire ; le staff valide (et crée
-- la fiche places via l'admin) ou refuse avec motif. File modérée — même
-- philosophie que review_reports (0026) : la communauté propose, l'humain
-- décide. Rate-limit anti-spam : max 5 suggestions en attente par spawter
-- (trigger — la RLS ne sait pas compter).
-- Date : 2026-07-26

CREATE TABLE public.place_suggestions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spawter_id       uuid NOT NULL REFERENCES public.spawters(id) ON DELETE CASCADE,
  name             text NOT NULL CHECK (length(trim(name)) > 0),
  neighborhood     text,
  commune          text,
  description      text CHECK (description IS NULL OR char_length(description) <= 1000),
  lat              double precision,
  lng              double precision,
  photo_urls       text[] NOT NULL DEFAULT '{}',
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected')),
  reviewed_by      uuid REFERENCES public.spawt_staff(id),
  reviewed_at      timestamptz,
  rejection_reason text,
  -- Fiche places créée à l'approbation (par le staff via admin/service_role).
  created_place_id uuid REFERENCES public.places(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.place_suggestions IS
  'Suggestions de lieux par la Meute. pending → approved (created_place_id '
  'posé) | rejected (rejection_reason). Max 5 pending par spawter (trigger).';

CREATE INDEX place_suggestions_pending_idx
  ON public.place_suggestions (created_at DESC) WHERE status = 'pending';
CREATE INDEX place_suggestions_spawter_idx
  ON public.place_suggestions (spawter_id);

CREATE TRIGGER update_timestamp_place_suggestions
  BEFORE UPDATE ON public.place_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ━━━ Rate-limit : max 5 suggestions pending par spawter ━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION public.assert_place_suggestions_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
BEGIN
  -- service_role (import batch admin) : pas de limite.
  BEGIN
    v_role := current_setting('request.jwt.claims', true)::json->>'role';
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;
  IF v_role = 'service_role' THEN RETURN NEW; END IF;

  IF (SELECT count(*) FROM public.place_suggestions ps
      WHERE ps.spawter_id = NEW.spawter_id AND ps.status = 'pending') >= 5 THEN
    RAISE EXCEPTION 'place_suggestions : maximum 5 suggestions en attente par spawter'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_place_suggestions_rate_limit
  BEFORE INSERT ON public.place_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.assert_place_suggestions_rate_limit();

-- ━━━ Auto-populate review (pattern 0026) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION public.place_suggestions_autopopulate_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IN ('approved','rejected') AND OLD.status = 'pending' THEN
    NEW.reviewed_by := coalesce(NEW.reviewed_by, auth.uid());
    NEW.reviewed_at := coalesce(NEW.reviewed_at, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_place_suggestions_review
  BEFORE UPDATE ON public.place_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.place_suggestions_autopopulate_review();

-- ━━━ Row-Level Security ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.place_suggestions ENABLE ROW LEVEL SECURITY;

-- Le spawter suggère en son nom, toujours en pending (mapping identique aux
-- autres tables : spawters.id = auth.uid(), cf. 0024 saved_places).
CREATE POLICY place_suggestions_insert_own ON public.place_suggestions
  FOR INSERT TO authenticated
  WITH CHECK (spawter_id = auth.uid() AND status = 'pending');

-- Suivi de ses propres suggestions (statut + motif de refus).
CREATE POLICY place_suggestions_select_own ON public.place_suggestions
  FOR SELECT TO authenticated
  USING (spawter_id = auth.uid());

-- Staff actif : lecture + traitement de la file.
CREATE POLICY place_suggestions_select_staff ON public.place_suggestions
  FOR SELECT TO authenticated
  USING (public.is_active_staff());

CREATE POLICY place_suggestions_update_staff ON public.place_suggestions
  FOR UPDATE TO authenticated
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

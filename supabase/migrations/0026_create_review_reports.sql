-- Migration 0026 — Signalement d'avis par la Meute (PRD §3.1 Feature 17)
-- Date: 2026-07-01
-- Contexte: câblage MVP. La modération admin existait (0019 soft-delete,
-- moderate-spawter) mais AUCUN signalement ne pouvait lui parvenir : pas de
-- bouton côté app, pas de table. Cette table est la file d'attente.
--
-- Workflow PRD : signalement → file d'attente → décision humaine
-- (garder / supprimer / avertir). Les Faux-Pas (fake review, hater,
-- gatekeeping) sont les motifs canoniques du glossaire.

CREATE TABLE public.review_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spawt_checkin_id UUID NOT NULL REFERENCES public.spawt_checkin(id) ON DELETE CASCADE,
  reporter_spawter_id UUID NOT NULL REFERENCES public.spawters(id) ON DELETE CASCADE,
  reason_code TEXT NOT NULL CHECK (reason_code IN (
    'fake_review',   -- Faux-Pas : review sponsorisée non déclarée / resto jamais visité / vengeance
    'hater',         -- Faux-Pas : méchanceté gratuite, trolling
    'gatekeeping',   -- Faux-Pas : fausses infos volontaires
    'autre'
  )),
  commentaire TEXT CHECK (commentaire IS NULL OR char_length(commentaire) <= 500),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  resolution_action TEXT CHECK (resolution_action IN ('kept', 'removed', 'warned')),
  resolved_by_staff_id UUID REFERENCES public.spawt_staff(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Un spawter ne signale un avis qu'une fois.
  UNIQUE (spawt_checkin_id, reporter_spawter_id),
  -- Résolution cohérente : soit pending sans résolution, soit resolved complet.
  CHECK (
    (status = 'pending' AND resolution_action IS NULL AND resolved_by_staff_id IS NULL AND resolved_at IS NULL)
    OR
    (status = 'resolved' AND resolution_action IS NOT NULL AND resolved_by_staff_id IS NOT NULL AND resolved_at IS NOT NULL)
  )
);

COMMENT ON TABLE public.review_reports IS
  'File de signalements d''avis (Feature 17). Créés par les spawters via le '
  'bouton Signaler, traités par le staff dans spawt-admin (page Signalements).';

CREATE INDEX idx_review_reports_pending ON public.review_reports (created_at DESC)
  WHERE status = 'pending';
CREATE INDEX idx_review_reports_checkin ON public.review_reports (spawt_checkin_id);

-- ━━━ RLS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;

-- Le spawter crée ses signalements (uniquement les siens, en pending).
CREATE POLICY "review_reports_insert_own"
  ON public.review_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (reporter_spawter_id = auth.uid() AND status = 'pending');

-- Le spawter voit ses propres signalements (feedback "déjà signalé").
CREATE POLICY "review_reports_select_own"
  ON public.review_reports
  FOR SELECT
  TO authenticated
  USING (reporter_spawter_id = auth.uid());

-- Le staff actif voit tout (helpers anti-recursion 0021).
CREATE POLICY "review_reports_select_staff"
  ON public.review_reports
  FOR SELECT
  TO authenticated
  USING (public.is_active_staff(auth.uid()));

-- Le staff actif résout (la résolution complète est forcée par le CHECK).
CREATE POLICY "review_reports_update_staff"
  ON public.review_reports
  FOR UPDATE
  TO authenticated
  USING (public.is_active_staff(auth.uid()))
  WITH CHECK (public.is_active_staff(auth.uid()));

-- ━━━ Auto-populate résolution (défense en profondeur, pattern 0023) ━━━━━━━━
CREATE OR REPLACE FUNCTION public.review_reports_autopopulate_resolution()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'resolved' AND OLD.status = 'pending' THEN
    NEW.resolved_by_staff_id := COALESCE(NEW.resolved_by_staff_id, auth.uid());
    NEW.resolved_at := COALESCE(NEW.resolved_at, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_review_reports_resolution
  BEFORE UPDATE ON public.review_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.review_reports_autopopulate_resolution();

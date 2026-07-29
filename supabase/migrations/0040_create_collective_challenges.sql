-- ============================================================================
-- Migration 0040 — Défis collectifs + streaks privés
-- ============================================================================
-- ⚠️ CONTRAT SPAWT (PRD §19 + lint-vocab) : AUCUN
-- classement individuel, jamais. Le schéma le rend IMPOSSIBLE PAR
-- CONSTRUCTION : challenge_progress a UNE SEULE ligne par challenge
-- (PK = challenge_id) et AUCUNE colonne spawter_id — on ne peut ni compter
-- par spawter, ni classer, même en le voulant. La progression est celle de la
-- Meute entière (« Ensemble : 500 spawts ce mois »), pas celle d'individus.
--
-- Le streak (spawter_streaks) est PRIVÉ : visible du seul spawter concerné
-- (RLS owner-only), jamais agrégé publiquement, jamais comparé. C'est un
-- rendez-vous avec soi-même, pas une compétition.
-- Date : 2026-07-26

-- ━━━ Table : challenges ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE public.challenges (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  title_key       text NOT NULL,
  description_key text NOT NULL,
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  goal_type       text NOT NULL
                    CHECK (goal_type IN (
                      'spawts_total','communes_couvertes','avis_total','nouveaux_lieux')),
  goal_target     integer NOT NULL CHECK (goal_target > 0),
  -- Récompense COLLECTIVE : chaque participant (>= 1 spawt vérifié dans la
  -- période) reçoit reward_paws quand l'objectif commun est atteint
  -- (distribution par Edge Function au passage status=done, reason
  -- 'defi_collectif' dans paws_ledger 0035).
  reward_paws     integer NOT NULL DEFAULT 0 CHECK (reward_paws >= 0),
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','active','done')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);

COMMENT ON TABLE public.challenges IS
  'Défis COLLECTIFS de la Meute (jamais individuels — Contrat SPAWT). '
  'Objectif commun sur une période ; la progression vit dans '
  'challenge_progress (1 ligne par défi, pas de spawter_id).';

-- ━━━ Table : challenge_progress — UNE ligne par challenge ━━━━━━━━━━━━━━━━━━━
-- PAS de spawter_id, PAS de détail individuel : le Contrat SPAWT interdit
-- tout classement — ce schéma rend la fuite impossible par construction.
CREATE TABLE public.challenge_progress (
  challenge_id  uuid PRIMARY KEY REFERENCES public.challenges(id) ON DELETE CASCADE,
  current_value integer NOT NULL DEFAULT 0 CHECK (current_value >= 0),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.challenge_progress IS
  'Progression AGRÉGÉE d''un défi collectif. 1 ligne par challenge, aucune '
  'colonne spawter_id : impossible de classer les spawters, par construction.';

-- Ligne de progression créée avec le challenge (toujours exactement 1).
CREATE OR REPLACE FUNCTION public.init_challenge_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.challenge_progress (challenge_id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_init_challenge_progress
  AFTER INSERT ON public.challenges
  FOR EACH ROW EXECUTE FUNCTION public.init_challenge_progress();

-- ━━━ Table : spawter_streaks (privé, owner-only) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE public.spawter_streaks (
  spawter_id      uuid PRIMARY KEY REFERENCES public.spawters(id) ON DELETE CASCADE,
  current_weeks   integer NOT NULL DEFAULT 0 CHECK (current_weeks >= 0),
  best_weeks      integer NOT NULL DEFAULT 0 CHECK (best_weeks >= 0),
  -- Lundi (ISO) de la dernière semaine avec >= 1 spawt vérifié.
  last_spawt_week date
);

COMMENT ON TABLE public.spawter_streaks IS
  'Streak hebdo PRIVÉ (semaines consécutives avec >= 1 spawt vérifié). '
  'RLS owner-only : jamais agrégé, jamais comparé, jamais public.';

-- ━━━ Moteur : spawt vérifié → progress collectif + streak ━━━━━━━━━━━━━━━━━━━
-- current_value est RECALCULÉ (pas incrémenté) : idempotent, robuste aux
-- re-déclenchements, et correct pour les goal_type « distincts »
-- (communes_couvertes, nouveaux_lieux) qu'un simple +1 fausserait.
CREATE OR REPLACE FUNCTION public.advance_collective_challenges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_challenge RECORD;
  v_value integer;
  v_week date;
BEGIN
  IF NEW.is_seed OR NEW.is_cancelled OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 1. Progression des défis actifs dont la période couvre ce spawt.
  FOR v_challenge IN
    SELECT c.id, c.goal_type, c.period_start, c.period_end
    FROM public.challenges c
    WHERE c.status = 'active'
      AND (NEW.arrived_at AT TIME ZONE 'UTC')::date BETWEEN c.period_start AND c.period_end
  LOOP
    SELECT CASE v_challenge.goal_type
      WHEN 'spawts_total' THEN
        (SELECT count(*) FROM public.spawt_checkin sc
         WHERE sc.is_verified AND NOT sc.is_seed AND NOT sc.is_cancelled
           AND sc.deleted_at IS NULL
           AND (sc.arrived_at AT TIME ZONE 'UTC')::date
                 BETWEEN v_challenge.period_start AND v_challenge.period_end)
      WHEN 'communes_couvertes' THEN
        (SELECT count(DISTINCT p.neighborhood) FROM public.spawt_checkin sc
         JOIN public.places p ON p.id = sc.place_id
         WHERE sc.is_verified AND NOT sc.is_seed AND NOT sc.is_cancelled
           AND sc.deleted_at IS NULL
           AND (sc.arrived_at AT TIME ZONE 'UTC')::date
                 BETWEEN v_challenge.period_start AND v_challenge.period_end)
      WHEN 'avis_total' THEN
        (SELECT count(*) FROM public.spawt_checkin sc
         WHERE sc.note_etoiles IS NOT NULL AND NOT sc.is_seed AND NOT sc.is_cancelled
           AND sc.deleted_at IS NULL
           AND (sc.arrived_at AT TIME ZONE 'UTC')::date
                 BETWEEN v_challenge.period_start AND v_challenge.period_end)
      WHEN 'nouveaux_lieux' THEN
        -- Lieux dont le PREMIER spawt vérifié de leur histoire tombe dans la
        -- période (la Meute a « ouvert » ce lieu pendant le défi).
        (SELECT count(*) FROM (
           SELECT sc.place_id, min(sc.arrived_at) AS first_spawt
           FROM public.spawt_checkin sc
           WHERE sc.is_verified AND NOT sc.is_seed AND NOT sc.is_cancelled
             AND sc.deleted_at IS NULL
           GROUP BY sc.place_id
         ) f
         WHERE (f.first_spawt AT TIME ZONE 'UTC')::date
                 BETWEEN v_challenge.period_start AND v_challenge.period_end)
    END INTO v_value;

    UPDATE public.challenge_progress SET
      current_value = coalesce(v_value, 0),
      updated_at = now()
    WHERE challenge_id = v_challenge.id;
  END LOOP;

  -- 2. Streak hebdo du spawter (lundi ISO de la semaine du spawt).
  v_week := date_trunc('week', NEW.arrived_at AT TIME ZONE 'UTC')::date;
  INSERT INTO public.spawter_streaks AS st
    (spawter_id, current_weeks, best_weeks, last_spawt_week)
  VALUES (NEW.spawter_id, 1, 1, v_week)
  ON CONFLICT (spawter_id) DO UPDATE SET
    current_weeks = CASE
      WHEN excluded.last_spawt_week <= st.last_spawt_week THEN st.current_weeks      -- même semaine / plus ancien
      WHEN excluded.last_spawt_week = st.last_spawt_week + 7 THEN st.current_weeks + 1  -- semaine consécutive
      ELSE 1                                                                          -- streak cassé, on repart
    END,
    best_weeks = greatest(st.best_weeks, CASE
      WHEN excluded.last_spawt_week <= st.last_spawt_week THEN st.current_weeks
      WHEN excluded.last_spawt_week = st.last_spawt_week + 7 THEN st.current_weeks + 1
      ELSE 1
    END),
    last_spawt_week = greatest(st.last_spawt_week, excluded.last_spawt_week);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_challenges_spawt_insert
  AFTER INSERT ON public.spawt_checkin
  FOR EACH ROW
  WHEN (NEW.is_verified)
  EXECUTE FUNCTION public.advance_collective_challenges();

CREATE TRIGGER trg_challenges_spawt_verified
  AFTER UPDATE OF is_verified ON public.spawt_checkin
  FOR EACH ROW
  WHEN (NEW.is_verified AND NOT coalesce(OLD.is_verified, false))
  EXECUTE FUNCTION public.advance_collective_challenges();

-- Les avis comptent aussi pour goal_type=avis_total (avis attaché après coup).
CREATE TRIGGER trg_challenges_review_attached
  AFTER UPDATE OF note_etoiles ON public.spawt_checkin
  FOR EACH ROW
  WHEN (OLD.note_etoiles IS NULL AND NEW.note_etoiles IS NOT NULL)
  EXECUTE FUNCTION public.advance_collective_challenges();

-- ━━━ Row-Level Security ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.challenges         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spawter_streaks    ENABLE ROW LEVEL SECURITY;

-- Défis visibles des spawters une fois publiés (active/done) ; les brouillons
-- restent staff-only.
CREATE POLICY challenges_select_published ON public.challenges
  FOR SELECT TO authenticated
  USING (status IN ('active','done'));

CREATE POLICY challenges_select_staff ON public.challenges
  FOR SELECT TO authenticated
  USING (public.is_active_staff());

-- Gestion des défis : staff admin (même modèle que feature_flags 0004).
CREATE POLICY challenges_insert_admin ON public.challenges
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_staff());

CREATE POLICY challenges_update_admin ON public.challenges
  FOR UPDATE TO authenticated
  USING (public.is_admin_staff())
  WITH CHECK (public.is_admin_staff());

CREATE POLICY challenges_delete_admin ON public.challenges
  FOR DELETE TO authenticated
  USING (public.is_admin_staff());

-- Progression : agrégat collectif sans PII → lisible par tous les authentifiés.
CREATE POLICY challenge_progress_select_all ON public.challenge_progress
  FOR SELECT TO authenticated
  USING (true);
-- Écriture : trigger SECURITY DEFINER + service_role uniquement.

-- Streak : owner-only, lecture seule (écrit par le trigger).
CREATE POLICY spawter_streaks_select_own ON public.spawter_streaks
  FOR SELECT TO authenticated
  USING (spawter_id = auth.uid());

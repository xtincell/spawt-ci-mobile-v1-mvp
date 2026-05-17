-- ============================================================================
-- Migration 0008 — Table `user_palais` (profil gustatif d'un spawter)
-- ============================================================================
-- Story 2.5 — Calibrage du Palais en 5 questions
-- PRD ref : §5.1 (5 axes) + §13.1 (schéma) + FR-002 (calibrage) + FR-025 (overwrite)
--
-- Politique overwrite : 1 row par spawter (PK = spawter_id). Le re-calibrage
-- UPDATE le row, pas d'append. Pas de trigger set-once — c'est volontaire.
-- ============================================================================

CREATE TABLE public.user_palais (
  spawter_id                uuid PRIMARY KEY
                              REFERENCES public.spawters(id) ON DELETE CASCADE,

  axe_racines_horizons      real NOT NULL DEFAULT 0
                              CHECK (axe_racines_horizons BETWEEN -1 AND 1),
  axe_taniere_nomade        real NOT NULL DEFAULT 0
                              CHECK (axe_taniere_nomade BETWEEN -1 AND 1),
  axe_exigeant_enthousiaste real NOT NULL DEFAULT 0
                              CHECK (axe_exigeant_enthousiaste BETWEEN -1 AND 1),
  axe_foule_secret          real NOT NULL DEFAULT 0
                              CHECK (axe_foule_secret BETWEEN -1 AND 1),
  axe_maquis_table          real NOT NULL DEFAULT 0
                              CHECK (axe_maquis_table BETWEEN -1 AND 1),

  confidence_score          real NOT NULL DEFAULT 0
                              CHECK (confidence_score BETWEEN 0 AND 1),

  -- Array de 2 axes parmi les 5. `null` au démarrage = pas encore calculé.
  dominant_axes             text[]
                              CHECK (dominant_axes IS NULL
                                     OR array_length(dominant_axes, 1) = 2),

  archetype_id              text,

  stade                     text NOT NULL DEFAULT 'touriste'
                              CHECK (stade IN
                                ('touriste','explorateur','detective','djidji','guide')),
  total_spawts              integer NOT NULL DEFAULT 0
                              CHECK (total_spawts >= 0),

  updated_at                timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.user_palais IS
  'Profil gustatif (5 axes) d''un spawter. PK = spawter_id (politique overwrite FR-025). RLS : spawter_id = auth.uid().';
COMMENT ON COLUMN public.user_palais.dominant_axes IS
  'Array de 2 axes parmi PALAIS_AXES (les plus marqués). NULL = pas encore calculé.';

-- ━━━ Index ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- PK couvre déjà spawter_id. Pas d'autre index requis V1 (la table est lue
-- exclusivement via SELECT WHERE spawter_id = auth.uid()).

-- ━━━ Trigger updated_at ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Réutilise `public.set_updated_at()` (créée migration 0001).
CREATE TRIGGER update_timestamp_user_palais
  BEFORE UPDATE ON public.user_palais
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ━━━ Row-Level Security ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.user_palais ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_palais_select_own ON public.user_palais
  FOR SELECT
  USING (spawter_id = auth.uid());

CREATE POLICY user_palais_insert_own ON public.user_palais
  FOR INSERT
  WITH CHECK (spawter_id = auth.uid());

-- Politique overwrite : UPDATE autorisé sur sa propre ligne, sans lock set-once.
CREATE POLICY user_palais_update_own ON public.user_palais
  FOR UPDATE
  USING (spawter_id = auth.uid())
  WITH CHECK (spawter_id = auth.uid());

-- Pas de DELETE policy : suppression cascade depuis spawters.

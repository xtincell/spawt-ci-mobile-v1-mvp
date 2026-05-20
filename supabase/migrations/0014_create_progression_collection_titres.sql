-- ============================================================================
-- Migration 0014 — Tables `spawter_progression` (Story 5.1) + `collection_titres`
-- (Story 5.2). Co-livrées car co-issues de l'amendement 4.6 (overwrite +
-- append). Un seul `.down.sql` rollback les deux.
-- ============================================================================
-- PRD ref : §3.1 FR-008 + FR-010 + §5.2 + §5.4
-- Architecture §3 l281, l287-289, l697 — politique overwrite vs append-only
-- ============================================================================

-- ============================================================================
-- Story 5.1 — Table spawter_progression (overwrite, amendement 4.6).
-- 1 row par spawter — PK = spawter_id. Pas d'historique (collection_titres porte la mémoire).
-- Invariant PRD §5.2 : la maturité ne recule jamais → trigger BEFORE UPDATE.
-- ============================================================================

CREATE TABLE public.spawter_progression (
  spawter_id    uuid PRIMARY KEY
                  REFERENCES public.spawters(id) ON DELETE CASCADE,
  unique_spots  integer NOT NULL DEFAULT 0
                  CHECK (unique_spots >= 0),
  stade         text NOT NULL DEFAULT 'touriste'
                  CHECK (stade IN ('touriste','explorateur','detective','djidji','guide')),
  -- Story 5.2 — i18n key pour le titre actuel/affiché (`title.<stade>` par défaut).
  -- Sémantique : titre lié au stade actuel. Le titre **affiché** vit dans
  -- `collection_titres.is_displayed` (peut diverger — PRD §3.1 FR-008).
  current_title text NOT NULL DEFAULT 'title.touriste',
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.spawter_progression IS
  'Progression par stade d''un spawter (overwrite, amendement 4.6). PK = spawter_id. RLS : spawter_id = auth.uid(). Invariant : stade ne recule jamais (trigger).';
COMMENT ON COLUMN public.spawter_progression.current_title IS
  'Clé i18n du titre lié au stade actuel (defaut `title.<stade>`). Distinct du titre affiché qui vit dans collection_titres.is_displayed (FR-008).';

-- Trigger updated_at (réutilise set_updated_at créée migration 0001).
CREATE TRIGGER update_timestamp_spawter_progression
  BEFORE UPDATE ON public.spawter_progression
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ━━━ Invariant SQL : la maturité ne recule jamais (PRD §5.2 + FR-010) ━━━━━━━
-- Un trigger BEFORE UPDATE rejette tout UPDATE qui baisse le stade (ordre canonique
-- STADES = touriste < explorateur < detective < djidji < guide). Client-side garde-
-- fou (maxStade) + server-side enforcement (ce trigger) = défense en profondeur.
CREATE OR REPLACE FUNCTION public.assert_stade_never_recedes()
RETURNS TRIGGER AS $$
DECLARE
  stades_order text[] := ARRAY['touriste','explorateur','detective','djidji','guide'];
  old_idx int;
  new_idx int;
BEGIN
  old_idx := array_position(stades_order, OLD.stade);
  new_idx := array_position(stades_order, NEW.stade);
  IF new_idx < old_idx THEN
    RAISE EXCEPTION 'spawter_progression.stade cannot recede: % -> % (PRD section 5.2)',
      OLD.stade, NEW.stade;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_assert_stade_never_recedes
  BEFORE UPDATE ON public.spawter_progression
  FOR EACH ROW
  WHEN (NEW.stade IS DISTINCT FROM OLD.stade)
  EXECUTE FUNCTION public.assert_stade_never_recedes();

-- ━━━ RLS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.spawter_progression ENABLE ROW LEVEL SECURITY;

CREATE POLICY spawter_progression_select_own ON public.spawter_progression
  FOR SELECT USING (spawter_id = auth.uid());

CREATE POLICY spawter_progression_insert_own ON public.spawter_progression
  FOR INSERT WITH CHECK (spawter_id = auth.uid());

CREATE POLICY spawter_progression_update_own ON public.spawter_progression
  FOR UPDATE
  USING (spawter_id = auth.uid())
  WITH CHECK (spawter_id = auth.uid());
-- Pas de DELETE policy : suppression cascade depuis spawters.

-- Test manuel post-migration :
-- INSERT INTO spawter_progression (spawter_id, unique_spots, stade)
--   VALUES (auth.uid(), 11, 'explorateur');
-- UPDATE spawter_progression SET stade = 'touriste' WHERE spawter_id = auth.uid();
-- → doit échouer avec exception "spawter_progression.stade cannot recede".


-- ============================================================================
-- Story 5.2 — Table collection_titres (append-only, mémoire d'identité, amendement 4.6).
-- PRD §3.1 FR-008 + §5.4 — collection permanente, titre affiché choisi par
-- le spawter, paws non-convertible (D2), reconnaissances non-public (D3),
-- Sprint 1 = 1 seul badge bonus `Premier Spawt` (D4).
-- ============================================================================
CREATE TABLE public.collection_titres (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spawter_id    uuid NOT NULL
                  REFERENCES public.spawters(id) ON DELETE CASCADE,
  -- Clé i18n du titre (ex: `title.explorateur`, `title.premier_spawt`).
  -- Pas de string FR ici — toutes les strings vivent dans fr.json.
  title_key     text NOT NULL,
  -- Source de l'unlock — utile pour analytics + debug + futur display.
  source        text NOT NULL DEFAULT 'stade'
                  CHECK (source IN ('stade','badge')),
  -- 1 seul titre `is_displayed = true` par spawter (contrainte unique partial ci-dessous).
  is_displayed  boolean NOT NULL DEFAULT false,
  unlocked_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.collection_titres IS
  'Collection de titres d''un spawter (append-only, mémoire d''identité). RLS : spawter_id = auth.uid(). Trigger interdit UPDATE hors is_displayed et DELETE (PRD section 5.4).';

-- Append-only : un (spawter_id, title_key) ne peut pas exister 2 fois.
CREATE UNIQUE INDEX collection_titres_unique
  ON public.collection_titres (spawter_id, title_key);

-- Contrainte « au plus 1 displayed par spawter » via index unique partial.
CREATE UNIQUE INDEX collection_titres_one_displayed
  ON public.collection_titres (spawter_id)
  WHERE is_displayed = true;

-- ━━━ Trigger append-only : interdit UPDATE sauf is_displayed, interdit DELETE ━━
-- PRD §5.4 — la collection est une mémoire d'identité, jamais retirée.
-- Le seul UPDATE autorisé est le toggle `is_displayed` (choix utilisateur).
CREATE OR REPLACE FUNCTION public.assert_collection_titres_append_only()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'collection_titres is append-only (PRD section 5.4): DELETE rejected';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.title_key IS DISTINCT FROM NEW.title_key
       OR OLD.spawter_id IS DISTINCT FROM NEW.spawter_id
       OR OLD.source IS DISTINCT FROM NEW.source
       OR OLD.unlocked_at IS DISTINCT FROM NEW.unlocked_at THEN
      RAISE EXCEPTION 'collection_titres is append-only: only is_displayed can change';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_collection_titres_append_only
  BEFORE UPDATE OR DELETE ON public.collection_titres
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_collection_titres_append_only();

-- ━━━ RLS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.collection_titres ENABLE ROW LEVEL SECURITY;

CREATE POLICY collection_titres_select_own ON public.collection_titres
  FOR SELECT USING (spawter_id = auth.uid());

CREATE POLICY collection_titres_insert_own ON public.collection_titres
  FOR INSERT WITH CHECK (spawter_id = auth.uid());

CREATE POLICY collection_titres_update_own ON public.collection_titres
  FOR UPDATE
  USING (spawter_id = auth.uid())
  WITH CHECK (spawter_id = auth.uid());
-- Pas de DELETE policy : append-only + cascade depuis spawters.

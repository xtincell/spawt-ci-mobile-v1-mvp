-- Migration 0024 — Table saved_places (favoris cross-device)
-- Date: 2026-07-01
-- Contexte: câblage MVP. Story 3.6 avait livré les favoris en AsyncStorage
-- uniquement ("Supabase sync différé Sprint 2 — Option A"). Cette table ferme
-- le gap : un lieu sauvegardé suit le spawter d'un device à l'autre.
--
-- Modèle : (spawter_id, place_id) en PK composite — un favori est un fait
-- binaire, pas un objet. created_at pour l'analytics (signal fort matching).

CREATE TABLE public.saved_places (
  spawter_id UUID NOT NULL REFERENCES public.spawters(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (spawter_id, place_id)
);

COMMENT ON TABLE public.saved_places IS
  'Favoris du spawter (Story 3.6 + câblage MVP). Local-first côté app '
  '(AsyncStorage), sync fire-and-forget vers cette table, union-merge à '
  'l''hydrate. Un lieu sauvegardé est un signal fort pour le matching (PRD §3.1 F9).';

CREATE INDEX idx_saved_places_place ON public.saved_places (place_id);

-- ━━━ RLS : owner-only ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.saved_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_places_select_own"
  ON public.saved_places
  FOR SELECT
  TO authenticated
  USING (spawter_id = auth.uid());

CREATE POLICY "saved_places_insert_own"
  ON public.saved_places
  FOR INSERT
  TO authenticated
  WITH CHECK (spawter_id = auth.uid());

CREATE POLICY "saved_places_delete_own"
  ON public.saved_places
  FOR DELETE
  TO authenticated
  USING (spawter_id = auth.uid());

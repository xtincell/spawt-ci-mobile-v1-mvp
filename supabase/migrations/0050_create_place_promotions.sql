-- ============================================================================
-- Migration 0050 — Promotions de lieux (affichage étiqueté)
-- ============================================================================
-- ⚠️ CONTRAT SPAWT (non négociable) : une promotion est un AFFICHAGE
-- ÉTIQUETÉ — un badge « promo » sur la fiche lieu, rien de plus. Elle
-- n'entre JAMAIS dans le calcul de la note d'un lieu ni dans le score de
-- matching (ADN / Palais) : aucun trigger vers place_adn, aucune colonne
-- côté place_adn ni côté notes, aucun poids nulle part. Un lieu ne peut pas
-- acheter sa visibilité algorithmique — les avis appartiennent à la Meute.
-- Ce schéma le garantit par construction : place_promotions ne référence que
-- places(id), et rien ne la lit hors affichage.
--
-- Saisie par le staff via la console admin (draft → publish, même modèle que
-- place_events 0049). Côté app, la Meute ne voit que les promotions publiées
-- ACTIVES (fenêtre starts_at/ends_at en dates civiles — une promo est
-- « du 10 au 15 », pas à l'heure près).
-- Date : 2026-07-26

CREATE TABLE public.place_promotions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id     uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  label        text NOT NULL CHECK (length(trim(label)) > 0),
  description  text,
  starts_at    date,
  ends_at      date,
  is_published boolean NOT NULL DEFAULT false,
  -- Auteur staff (traçabilité éditoriale) — audit complet dans admin_audit_log.
  created_by   uuid DEFAULT auth.uid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at >= starts_at)
);

COMMENT ON TABLE public.place_promotions IS
  'Promotions d''un lieu — AFFICHAGE ÉTIQUETÉ uniquement (Contrat SPAWT : '
  'jamais dans le calcul de note ni le score de matching). Fenêtre en dates '
  'civiles ; NULL = sans borne. Saisie staff via console admin.';

CREATE INDEX place_promotions_place_starts_idx
  ON public.place_promotions (place_id, starts_at);

CREATE TRIGGER update_timestamp_place_promotions
  BEFORE UPDATE ON public.place_promotions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ━━━ Row-Level Security ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.place_promotions ENABLE ROW LEVEL SECURITY;

-- La Meute (authentifiés) : promotions publiées ACTIVES uniquement
-- (fenêtre ouverte : borne absente = pas de contrainte de ce côté).
CREATE POLICY place_promotions_select_published ON public.place_promotions
  FOR SELECT TO authenticated
  USING (
    is_published = true
    AND (starts_at IS NULL OR starts_at <= current_date)
    AND (ends_at IS NULL OR ends_at >= current_date)
  );

-- Staff actif : lecture complète (brouillons + passées — historique console).
CREATE POLICY place_promotions_select_staff ON public.place_promotions
  FOR SELECT TO authenticated
  USING (public.is_active_staff());

-- CRUD : staff admin (même niveau d'exigence que place_events 0049).
CREATE POLICY place_promotions_insert_admin ON public.place_promotions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_staff());

CREATE POLICY place_promotions_update_admin ON public.place_promotions
  FOR UPDATE TO authenticated
  USING (public.is_admin_staff())
  WITH CHECK (public.is_admin_staff());

CREATE POLICY place_promotions_delete_admin ON public.place_promotions
  FOR DELETE TO authenticated
  USING (public.is_admin_staff());

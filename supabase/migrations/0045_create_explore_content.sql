-- ============================================================================
-- Migration 0045 — Mode Explore : collections éditoriales
-- ============================================================================
-- Contenu curaté par l'équipe (« Les maquis qui ont le feu », « Sucré comme
-- Cocody »…) : une collection = une sélection ordonnée de lieux avec un mot
-- éditorial par lieu. Rattachée à une ville (0041) pour le multi-city.
-- Workflow : le staff prépare en brouillon (is_published=false), publie quand
-- c'est propre — même modèle draft/publish que places.is_published (0010).
-- Date : 2026-07-26

CREATE TABLE public.explore_collections (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text NOT NULL UNIQUE
                 CHECK (slug ~ '^[a-z0-9][a-z0-9_-]*$'),
  title_key    text NOT NULL,
  subtitle_key text,
  cover_url    text,
  sort_order   integer,
  is_published boolean NOT NULL DEFAULT false,
  city_code    text NOT NULL REFERENCES public.cities(code) DEFAULT 'abidjan',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.explore_collections IS
  'Collections éditoriales du Mode Explore. title_key/subtitle_key = i18n '
  '(explore.<slug>.title). Brouillon staff-only tant que is_published=false.';

CREATE INDEX explore_collections_published_idx
  ON public.explore_collections (city_code, sort_order)
  WHERE is_published = true;

CREATE TRIGGER update_timestamp_explore_collections
  BEFORE UPDATE ON public.explore_collections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.explore_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id  uuid NOT NULL REFERENCES public.explore_collections(id)
                   ON DELETE CASCADE,
  place_id       uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  -- Le mot du Chat sur CE lieu dans CETTE collection (français direct,
  -- éditorial — pas une string UI, donc pas d'i18n key ici).
  editorial_text text CHECK (editorial_text IS NULL OR char_length(editorial_text) <= 280),
  sort_order     integer,
  UNIQUE (collection_id, place_id)
);

COMMENT ON TABLE public.explore_items IS
  'Lieux d''une collection Explore, ordonnés, avec mot éditorial (<= 280 chars).';

CREATE INDEX explore_items_collection_idx
  ON public.explore_items (collection_id, sort_order);

-- ━━━ Row-Level Security ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.explore_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.explore_items       ENABLE ROW LEVEL SECURITY;

-- Collections publiées : lisibles par tous les authentifiés.
CREATE POLICY explore_collections_select_published ON public.explore_collections
  FOR SELECT TO authenticated
  USING (is_published = true);

-- Items : visibles si la collection parente est publiée.
CREATE POLICY explore_items_select_published ON public.explore_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.explore_collections c
      WHERE c.id = explore_items.collection_id
        AND c.is_published = true
    )
  );

-- Staff actif : lecture brouillons compris.
CREATE POLICY explore_collections_select_staff ON public.explore_collections
  FOR SELECT TO authenticated
  USING (public.is_active_staff());

CREATE POLICY explore_items_select_staff ON public.explore_items
  FOR SELECT TO authenticated
  USING (public.is_active_staff());

-- CRUD : staff admin (curation éditoriale = décision publique, même niveau
-- d'exigence que feature_flags 0004).
CREATE POLICY explore_collections_insert_admin ON public.explore_collections
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_staff());

CREATE POLICY explore_collections_update_admin ON public.explore_collections
  FOR UPDATE TO authenticated
  USING (public.is_admin_staff())
  WITH CHECK (public.is_admin_staff());

CREATE POLICY explore_collections_delete_admin ON public.explore_collections
  FOR DELETE TO authenticated
  USING (public.is_admin_staff());

CREATE POLICY explore_items_insert_admin ON public.explore_items
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_staff());

CREATE POLICY explore_items_update_admin ON public.explore_items
  FOR UPDATE TO authenticated
  USING (public.is_admin_staff())
  WITH CHECK (public.is_admin_staff());

CREATE POLICY explore_items_delete_admin ON public.explore_items
  FOR DELETE TO authenticated
  USING (public.is_admin_staff());

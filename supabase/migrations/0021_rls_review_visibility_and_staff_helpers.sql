-- Migration 0021 — Visibilité reviews publiées + helpers staff anti-recursion
-- Date: 2026-05-27
-- Contexte: appliqué d'abord via MCP en session interactive (apply_migration MCP
-- bloqué par classifier auto, basculé sur execute_sql avec OK user explicite).
-- Ce fichier capture l'état appliqué pour traçabilité et rollback futur.
--
-- 3 changements:
--   1. Policy SELECT publique sur spawt_checkin pour reviews publiées (note non-null).
--      Sans ça, Story 4.9 PlaceReviews fetch retourne toujours [] (RLS spawter_id=auth.uid()
--      filtre out tous les seeds + reviews d'autres spawters).
--      Sprint 2: durcir via moderation_status='approved' quand la modération sera câblée.
--   2. View `spawters_public` avec security_invoker=false exposant uniquement les colonnes
--      safe (id, display_name, avatar_url, stade, neighborhood). Permet le JOIN dans
--      Story 4.9 `spawters_public!inner(display_name, avatar_url)` sans exposer la PII
--      (gender, age_range, country_code, origin_country_code, date_of_birth).
--   3. Helpers SECURITY DEFINER pour bypasser la RLS quand on check le staff status —
--      casse l'infinite recursion sur spawt_staff (la policy spawt_staff_select_admin
--      faisait EXISTS (SELECT FROM spawt_staff) → boucle PG).

-- ━━━ 1. Reviews publiées lisibles publiquement ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DROP POLICY IF EXISTS "spawt_checkin_select_published_reviews" ON public.spawt_checkin;
CREATE POLICY "spawt_checkin_select_published_reviews"
  ON public.spawt_checkin
  FOR SELECT
  TO authenticated, anon
  USING (note_etoiles IS NOT NULL AND deleted_at IS NULL);

COMMENT ON POLICY "spawt_checkin_select_published_reviews" ON public.spawt_checkin IS
  'Story 4.9 — Lecture publique des reviews publiées (note non-null + non soft-deleted).'
  ' Les check-ins sans avis (note_etoiles IS NULL) restent privés par owner.'
  ' Sprint 2: durcir via moderation_status=approved quand la modération sera câblée.';

-- ━━━ 2. View `spawters_public` (colonnes safe + bypass RLS) ━━━━━━━━━━━━━━━━━
DROP VIEW IF EXISTS public.spawters_public;
CREATE VIEW public.spawters_public
  WITH (security_invoker = false)
AS
  SELECT id, display_name, avatar_url, stade, neighborhood
  FROM public.spawters;

GRANT SELECT ON public.spawters_public TO authenticated;

COMMENT ON VIEW public.spawters_public IS
  'Story 4.9 — View publique des profils spawter (colonnes safe uniquement).'
  ' security_invoker=false → la view bypass la RLS de spawters (qui restreint à own row).'
  ' Permet le JOIN spawters_public!inner dans listReviewsForPlace sans exposer la PII.';

-- ━━━ 3. Helpers SECURITY DEFINER pour vérifs staff (anti-recursion) ━━━━━━━━━
CREATE OR REPLACE FUNCTION public.is_admin_staff(uid uuid DEFAULT auth.uid())
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.spawt_staff
    WHERE id = uid AND role = 'admin' AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_staff(uid uuid DEFAULT auth.uid())
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.spawt_staff
    WHERE id = uid AND is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_staff(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_active_staff(uuid) TO authenticated, anon;

COMMENT ON FUNCTION public.is_admin_staff(uuid) IS
  'SECURITY DEFINER helper qui bypass RLS pour vérifier le statut admin staff.'
  ' Évite l''infinite recursion sur spawt_staff (policy auto-référente).'
  ' À utiliser dans toute policy qui doit checker le staff status.';

COMMENT ON FUNCTION public.is_active_staff(uuid) IS
  'SECURITY DEFINER helper qui bypass RLS pour vérifier le statut active staff.'
  ' Évite l''infinite recursion sur spawt_staff. Sprint 2: migrer toutes les'
  ' policies qui font EXISTS (SELECT FROM spawt_staff WHERE is_active=true) vers ce helper.';

-- Réécriture de spawt_staff_select_admin pour utiliser le helper (cassait recursion).
DROP POLICY IF EXISTS "spawt_staff_select_admin" ON public.spawt_staff;
CREATE POLICY "spawt_staff_select_admin"
  ON public.spawt_staff
  FOR SELECT
  TO authenticated
  USING (public.is_admin_staff());

COMMENT ON POLICY "spawt_staff_select_admin" ON public.spawt_staff IS
  'Admin staff voit tout le staff. Utilise is_admin_staff() helper (SECURITY DEFINER)'
  ' pour éviter l''infinite recursion sur spawt_staff lui-même.';

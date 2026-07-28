-- ============================================================================
-- Migration 0062 — `current_staff()` : « qui suis-je, côté équipe ? »
-- ============================================================================
-- Née d'un bug trouvé en recette navigateur, pas par les tests.
--
-- Le rideau d'avant-lancement du portail lisait `spawt_staff` en filtrant sur
-- `is_active` seulement, en comptant sur la RLS pour ne rendre que la bonne
-- ligne. C'était faux : `spawt_staff_select_admin` (0001) autorise un admin à
-- lire TOUTE l'équipe. La requête d'un admin renvoyait donc trois lignes, le
-- `maybeSingle()` du client sortait en erreur — et le rideau refusait
-- exactement les personnes qu'il doit laisser entrer. Un moderator passait ;
-- seul le cas nominal cassait.
--
-- On peut corriger côté client en ajoutant `.eq("id", uid)`. Mais cela suppose
-- que chaque appelant se souvienne d'une subtilité de RLS, et redemande son
-- propre identifiant avant chaque lecture. La bonne réponse est une question
-- que le serveur sait poser seul : « la ligne d'équipe de l'appelant ».
--
-- Zéro ligne = pas membre de l'équipe (ou compte désactivé). Pas d'erreur, pas
-- d'ambiguïté, et aucun paramètre — donc aucun moyen de s'en servir pour
-- sonder l'existence d'un autre compte.
-- Date : 2026-07-28

CREATE OR REPLACE FUNCTION public.current_staff()
RETURNS TABLE (id UUID, display_name TEXT, role TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.id, s.display_name, s.role
    FROM public.spawt_staff s
   WHERE s.id = auth.uid()
     AND s.is_active;
$$;

COMMENT ON FUNCTION public.current_staff() IS
  'Ligne `spawt_staff` de l''appelant, ou aucune ligne s''il n''est pas membre '
  'actif de l''équipe. Sans paramètre : impossible de sonder un autre compte. '
  'Remplace une lecture directe de spawt_staff côté client, qui renvoyait '
  'plusieurs lignes pour un admin (policy spawt_staff_select_admin) et faisait '
  'échouer le rideau du portail sur le cas nominal.';

-- Fermée à `anon` : un visiteur non connecté n'a rien à demander ici, et
-- auth.uid() serait NULL de toute façon (zéro ligne, mais autant ne pas
-- exposer l'appel).
REVOKE ALL ON FUNCTION public.current_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_staff() TO authenticated;

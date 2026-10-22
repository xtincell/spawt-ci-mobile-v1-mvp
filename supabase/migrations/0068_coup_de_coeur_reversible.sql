-- Migration 0068 — Le Coup de Cœur devient retirable, et l'app peut le savoir
-- Date: 2026-08-27
--
-- Deux défauts signalés depuis un téléphone, et ils ont la même racine : 0028
-- n'a livré qu'un sens de circulation.
--
-- 1. « Le coup de cœur ne peut pas être retiré. » Exact, et par construction :
--    la table n'a AUCUNE policy INSERT/UPDATE/DELETE (l'écriture passe par le
--    RPC SECURITY DEFINER), et il n'existait que `give_coup_de_coeur`. Un tap
--    de travers coûtait donc une unité de quota du mois, définitivement. La
--    rareté est un choix produit assumé ; l'irréversibilité d'une erreur de
--    manipulation n'en est pas un.
--
-- 2. L'app ne savait pas si ELLE avait déjà donné. `count_coups_de_coeur` rend
--    le total du lieu, pas mon état. Le bouton se souvenait dans un `useState`,
--    perdu au premier démontage : après un simple retour en arrière, il
--    reproposait « donner », et le serveur répondait `already_given`. Le
--    produit savait, l'écran non.
--
-- Ce que cette migration ajoute, sans rien retirer :
--
--   * `remove_coup_de_coeur(place)` — retire le mien et rend l'unité de quota.
--     Borné au MOIS COURANT : le quota est mensuel, on ne peut pas rembourser
--     une unité d'un mois clos, et effacer un signal passé réécrirait
--     l'historique public d'un lieu. Un mois révolu est acquis.
--   * `my_coup_de_coeur_state(place)` — mon état pour CE lieu + mon quota du
--     mois, en un aller-retour. C'est ce qui permet à l'écran de dire la vérité
--     dès son affichage.
--   * `my_coups_de_coeur()` — la liste des miens, pour la page de profil, qui
--     n'en montrait aucun.
--
-- Le verrou advisory de 0028 est repris à l'identique (même clé
-- spawter+mois) : sans lui, un retrait et un don concurrents pourraient
-- compter le quota deux fois.

-- ━━━ Retirer son Coup de Cœur ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION public.remove_coup_de_coeur(p_place_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_spawter UUID := auth.uid();
  v_stade TEXT;
  v_quota INT;
  v_used INT;
  v_month TEXT := to_char(now(), 'YYYY-MM');
  v_deleted INT;
BEGIN
  IF v_spawter IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authenticated');
  END IF;

  SELECT stade INTO v_stade FROM public.spawters WHERE id = v_spawter;
  v_quota := CASE COALESCE(v_stade, 'touriste')
    WHEN 'djidji' THEN 2
    WHEN 'guide'  THEN 3
    ELSE 1
  END;

  -- Même clé de verrou que `give_coup_de_coeur` : les deux opérations touchent
  -- le même compteur, elles doivent se sérialiser entre elles.
  PERFORM pg_advisory_xact_lock(hashtext(v_spawter::text || v_month));

  DELETE FROM public.coups_de_coeur
  WHERE spawter_id = v_spawter
    AND place_id = p_place_id
    AND month_key = v_month;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  SELECT count(*) INTO v_used FROM public.coups_de_coeur
  WHERE spawter_id = v_spawter AND month_key = v_month;

  IF v_deleted = 0 THEN
    -- Rien à retirer pour le mois courant. Distinct d'une erreur : l'appelant
    -- doit pouvoir afficher un état juste plutôt qu'un échec.
    RETURN jsonb_build_object(
      'ok', false, 'code', 'not_given',
      'quota', v_quota, 'used', v_used, 'remaining', v_quota - v_used
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'code', 'removed',
    'quota', v_quota, 'used', v_used, 'remaining', v_quota - v_used
  );
END;
$$;

COMMENT ON FUNCTION public.remove_coup_de_coeur(UUID) IS
  'Retire le Coup de Cœur du mois COURANT et rend l''unité de quota. Un mois '
  'révolu est acquis : ni remboursable, ni effaçable (historique public).';

-- ━━━ Mon état sur un lieu, en un aller-retour ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION public.my_coup_de_coeur_state(p_place_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_spawter UUID := auth.uid();
  v_stade TEXT;
  v_quota INT;
  v_used INT;
  v_month TEXT := to_char(now(), 'YYYY-MM');
  v_given BOOLEAN;
  v_place_count INT;
BEGIN
  SELECT count(*)::int INTO v_place_count FROM public.coups_de_coeur
  WHERE place_id = p_place_id AND month_key = v_month;

  IF v_spawter IS NULL THEN
    -- Lecture anonyme : le compteur public reste lisible, le reste est neutre.
    RETURN jsonb_build_object(
      'given', false, 'place_count', v_place_count,
      'quota', 0, 'used', 0, 'remaining', 0
    );
  END IF;

  SELECT stade INTO v_stade FROM public.spawters WHERE id = v_spawter;
  v_quota := CASE COALESCE(v_stade, 'touriste')
    WHEN 'djidji' THEN 2
    WHEN 'guide'  THEN 3
    ELSE 1
  END;

  SELECT count(*) INTO v_used FROM public.coups_de_coeur
  WHERE spawter_id = v_spawter AND month_key = v_month;

  SELECT EXISTS (
    SELECT 1 FROM public.coups_de_coeur
    WHERE spawter_id = v_spawter AND place_id = p_place_id AND month_key = v_month
  ) INTO v_given;

  RETURN jsonb_build_object(
    'given', v_given, 'place_count', v_place_count,
    'quota', v_quota, 'used', v_used, 'remaining', v_quota - v_used
  );
END;
$$;

COMMENT ON FUNCTION public.my_coup_de_coeur_state(UUID) IS
  'État du Coup de Cœur de l''appelant sur un lieu + son quota du mois. '
  'Permet à l''écran d''afficher la vérité dès son ouverture, sans mémoire locale.';

-- ━━━ Mes Coups de Cœur, pour la page de profil ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION public.my_coups_de_coeur()
RETURNS TABLE (
  place_id UUID,
  place_name TEXT,
  neighborhood TEXT,
  cover_photo_url TEXT,
  month_key TEXT,
  created_at TIMESTAMPTZ,
  is_current_month BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    c.place_id,
    p.name,
    p.neighborhood,
    p.cover_photo_url,
    c.month_key,
    c.created_at,
    c.month_key = to_char(now(), 'YYYY-MM')
  FROM public.coups_de_coeur c
  JOIN public.places p ON p.id = c.place_id
  WHERE c.spawter_id = auth.uid()
  ORDER BY c.created_at DESC;
$$;

COMMENT ON FUNCTION public.my_coups_de_coeur() IS
  'Liste des Coups de Cœur de l''appelant, du plus récent au plus ancien. '
  '`is_current_month` dit lesquels sont encore retirables.';

-- ━━━ Droits ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- SECURITY DEFINER : chaque fonction se borne elle-même à `auth.uid()`. Elles
-- ne sont donc pas exécutables utilement sans session — sauf l'état, qui rend
-- le compteur public en mode anonyme.
REVOKE ALL ON FUNCTION public.remove_coup_de_coeur(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_coups_de_coeur() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_coup_de_coeur(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_coups_de_coeur() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_coup_de_coeur_state(UUID) TO authenticated, anon;

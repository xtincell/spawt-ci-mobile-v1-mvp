-- ============================================================================
-- Migration 0061 — RÉPARE 0058 : les prédicats de RLS doivent rester exécutables
-- ============================================================================
-- Ce que 0058 a cassé, et comment ça a été trouvé
-- ------------------------------------------------------------------------
-- La migration 0058 a révoqué `EXECUTE` sur cinq fonctions au motif qu'elles
-- n'avaient « rien à faire dans la surface d'API ». Le raisonnement était faux
-- sur un point décisif : **une expression de policy RLS est évaluée avec les
-- privilèges de l'appelant**, pas avec ceux du propriétaire de la table. Retirer
-- `EXECUTE` à `authenticated` ne les retire donc pas seulement de l'API — ça
-- retire aussi à PostgreSQL le droit d'évaluer les policies qui les appellent.
--
-- Portée mesurée sur la base live avant correction : **41 policies sur
-- 18 tables**. Toutes portent sur le rôle `authenticated`. Concrètement, un
-- Spawter connecté recevait `42501 permission denied for function
-- is_active_staff` sur :
--   push_tokens, spawter_badges, spawter_cards, paws_ledger, subscriptions,
--   invoices, place_suggestions, place_events, place_promotions,
--   reservation_requests, review_reports, challenges, crew_members,
--   explore_collections, explore_items, ambassadors, b2b_accounts, spawt_staff.
-- C'est-à-dire : plus de push, plus de badges, plus de pattes, plus de
-- suggestions de lieu, plus de Crew. L'app entière, pour tout compte connecté.
--
-- Trouvé en écrivant le test adversarial de 0060 : un UPDATE sur `spawters`
-- en session `authenticated` a échoué sur `permission denied for function
-- is_admin_staff`. Aucun test unitaire ne pouvait l'attraper — ils tournent
-- tous hors base ou en service_role, qui contourne la RLS.
--
-- Ce qu'on garde de 0058
-- ------------------------------------------------------------------------
-- L'intention n'était pas absurde, elle était mal ciblée. Les 41 policies
-- concernées visent TOUTES `authenticated` : rendre `EXECUTE` à ce seul rôle
-- répare tout et laisse `anon` — la clé publique, celle qui traîne dans les
-- bundles — fermée. C'est là qu'était le vrai gain de 0058, et il est conservé.
--
-- Reste la surface RPC pour un compte connecté. Elle est étroite : les cinq
-- fonctions retournent un booléen et exigent un UUID que l'appelant doit déjà
-- posséder (id de compte, id de session Crew). Le « oracle d'énumération »
-- annoncé dans l'en-tête de 0058 supposait des identifiants devinables ; des
-- UUIDv4 ne le sont pas. Le coût de cette surface est sans commune mesure avec
-- celui d'une app hors service.
--
-- Ce qui N'EST PAS ré-ouvert : les fonctions de trigger (le DO de 0058), la
-- lecture de `schema_migrations`, l'appel anonyme de `give_coup_de_coeur` et
-- `request_account_deletion`, l'appel de `recompute_place_adn_full` (0057).
-- Un trigger, lui, s'exécute sans contrôle d'EXECUTE sur l'appelant — ce
-- point-là de 0058 était juste, et il est vérifié par le test de 0061.
-- Date : 2026-07-28

-- ━━━ 1. Rendre EXECUTE aux prédicats, à `authenticated` seulement ━━━━━━━━━━
GRANT EXECUTE ON FUNCTION public.is_active_staff(uuid)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_staff(uuid)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_b2b_of(uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_b2b_gold_of(uuid)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.crew_session_is_joinable(uuid) TO authenticated;

-- `anon` reste fermé : aucune des 41 policies ne le vise, et c'est la clé qui
-- circule publiquement.
REVOKE ALL ON FUNCTION public.is_active_staff(uuid)          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin_staff(uuid)           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_b2b_of(uuid)                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_b2b_gold_of(uuid)           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crew_session_is_joinable(uuid) FROM PUBLIC, anon;

COMMENT ON FUNCTION public.is_active_staff(uuid) IS
  'Prédicat de RLS. EXECUTE indispensable à `authenticated` : une expression '
  'de policy est évaluée avec les privilèges de l''APPELANT. Le révoquer met '
  '18 tables hors service pour tout compte connecté (régression 0058, '
  'réparée en 0061). Fermé à anon.';

-- ━━━ 2. Le garde de 0060 passe par le prédicat commun ━━━━━━━━━━━━━━━━━━━━━━
-- 0060 inlinait un EXISTS sur `spawt_staff` pour ne pas dépendre d'un EXECUTE
-- alors révoqué. Le contournement n'a plus lieu d'être, et l'inline traversait
-- la RLS de `spawt_staff` — donc les policies cassées. On revient au prédicat
-- SECURITY DEFINER, qui est justement là pour éviter cette récursion (0021).
CREATE OR REPLACE FUNCTION public.spawters_protect_internal_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_internal IS DISTINCT FROM OLD.is_internal THEN
    IF NOT (
      pg_has_role(current_user, 'service_role', 'MEMBER')
      OR public.is_admin_staff()
    ) THEN
      -- Restauration silencieuse : l'app réécrit la ligne entière à chaque
      -- sauvegarde, une exception casserait tous les enregistrements légitimes.
      NEW.is_internal := OLD.is_internal;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.spawters_protect_internal_on_update()
  FROM PUBLIC, anon, authenticated;

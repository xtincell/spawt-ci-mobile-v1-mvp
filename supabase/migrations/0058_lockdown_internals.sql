-- ============================================================================
-- Migration 0058 — refermer ce que la passe adversariale a trouvé ouvert
-- ============================================================================
--
-- ── 1. `schema_migrations` était lisible par tout le monde ──────────────────
-- Table introduite par le migrateur, donc oubliée du durcissement : aucune
-- RLS, SELECT accordé à `anon` par les default privileges de Supabase. Un
-- appel PostgREST avec la clé anon — publique par nature — renvoyait la liste
-- complète des migrations, c'est-à-dire la carte des fonctionnalités et de
-- leur calendrier. Pas de PII, pas de secret : de la reconnaissance offerte.
--
-- ── 2. Des fonctions internes exposées en RPC ───────────────────────────────
-- 19 fonctions SECURITY DEFINER étaient exécutables par `anon`. La grande
-- majorité sont des fonctions de TRIGGER : appelées directement elles
-- échoueraient faute de contexte, mais elles n'ont rien à faire dans la
-- surface d'API. Les prédicats (`is_active_staff`, `is_b2b_of`,
-- `crew_session_is_joinable`…) servent aux policies RLS et constituent, exposés,
-- un oracle d'énumération : on peut sonder l'existence d'une session ou d'un
-- compte B2B.
--
-- À noter, et c'est ce qui distingue un durcissement d'un correctif urgent :
-- les deux seules fonctions qui ÉCRIVENT (`give_coup_de_coeur`,
-- `request_account_deletion`) portent une garde interne — vérifié par appel
-- anonyme réel, elles répondent `not_authenticated` et ne touchent à rien.
-- Il n'y avait donc pas de trou exploitable, mais une surface inutile.
--
-- On ne touche PAS à `claim_meute_heritage` (déjà fermée à anon) ni aux
-- fonctions que l'app appelle légitimement en tant qu'utilisateur connecté.
-- Date : 2026-07-28

-- ━━━ 1. schema_migrations : lecture réservée au serveur ━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.schema_migrations FROM anon, authenticated;

COMMENT ON TABLE public.schema_migrations IS
  'Suivi des migrations appliquées (migrator). RLS sans policy + REVOKE : '
  'l''API publique n''a pas à révéler la liste des migrations, qui décrit le '
  'schéma et le calendrier des fonctionnalités.';

-- ━━━ 2. Fonctions de trigger : hors surface d'API ━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Un trigger s'exécute avec les privilèges de son propriétaire, pas de
-- l'appelant : ces REVOKE ne cassent aucun déclenchement.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND pg_get_function_result(p.oid) = 'trigger'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END$$;

-- ━━━ 3. Prédicats de RLS : utilisables PAR les policies, pas PAR les clients ━
-- Les policies les évaluent côté serveur ; aucun client n'a besoin de les
-- appeler. Les exposer permettait de sonder l'existence d'objets.
REVOKE ALL ON FUNCTION public.is_active_staff(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin_staff(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_b2b_of(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_b2b_gold_of(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crew_session_is_joinable(uuid) FROM PUBLIC, anon;
-- `is_crew_member` et `crew_session_is_joinable` restent accessibles aux
-- comptes connectés : l'écran Crew les appelle pour savoir s'il peut rejoindre.

-- ━━━ 4. Les deux fonctions d'écriture : fermées à l'anonyme ━━━━━━━━━━━━━━━━
-- Elles portent une garde interne qui répond `not_authenticated` — vérifié par
-- appel réel — donc rien n'était exploitable. Mais une fonction qui écrit n'a
-- aucune raison d'accepter un appel anonyme : la garde devient la deuxième
-- ligne, pas la première. Les comptes connectés gardent l'accès (l'app les
-- appelle depuis la fiche lieu et les réglages).
REVOKE ALL ON FUNCTION public.give_coup_de_coeur(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_account_deletion() FROM PUBLIC, anon;

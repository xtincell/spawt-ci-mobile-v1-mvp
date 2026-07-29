-- ============================================================================
-- Migration 0067 — une ligne d'amorçage fermait la connexion à TOUT LE MONDE
-- ============================================================================
-- Symptôme, mesuré en production le 2026-07-29 : un numéro qui se connecte pour
-- la première fois entre normalement ; **toute connexion suivante du même
-- numéro** répond `user_provisioning_failed`. Autrement dit chaque spawter
-- était enfermé dehors dès sa deuxième visite. Sur un APK distribué, cela veut
-- dire : on s'inscrit, on ferme l'app, on ne rentre plus jamais.
--
-- ── La chaîne causale ───────────────────────────────────────────────────────
-- 1. `otp-verify` appelle `createUser`. Pour un compte qui existe déjà, GoTrue
--    répond `email_exists` — c'est normal et attendu.
-- 2. La fonction se rabat alors sur `listUsers` pour retrouver le compte. Ce
--    repli est le SEUL chemin pour un compte existant.
-- 3. `listUsers` répondait `500 Database error finding users`.
--
-- ── Pourquoi ─────────────────────────────────────────────────────────────────
-- Le seed des avis fondateurs (`founder_reviews_mission1.sql`) crée une ligne
-- `auth.users` en SQL direct, pour satisfaire la FK `spawters.id → auth.users`.
-- En contournant GoTrue, il laissait à NULL les colonnes de jetons. Or GoTrue
-- les lit dans des champs Go de type `string` NON-POINTEURS : lire un NULL fait
-- échouer le scan, donc la requête entière, donc la liste complète.
--
-- **Une seule ligne, jamais destinée à se connecter, cassait la connexion de
-- tous les autres.** C'est la forme la plus vicieuse du bug de données : elle
-- n'affecte pas la ligne fautive, elle affecte la requête qui la traverse.
--
-- ── Ce que fait cette migration ─────────────────────────────────────────────
-- Elle répare l'existant et pose le défaut manquant, pour que le prochain
-- INSERT direct — le nôtre ou celui d'un futur seed — ne puisse plus produire
-- de NULL. La contrainte NOT NULL n'est volontairement PAS posée : `auth` est
-- un schéma géré par GoTrue, et lui imposer nos contraintes rendrait une future
-- montée de version imprévisible. Un DEFAULT est additif et sans risque.
--
-- Idempotente : rejouable sans effet de bord.
-- Date : 2026-07-29

-- ━━━ 1. Réparer les lignes existantes ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UPDATE auth.users SET
  confirmation_token         = COALESCE(confirmation_token, ''),
  recovery_token             = COALESCE(recovery_token, ''),
  email_change               = COALESCE(email_change, ''),
  email_change_token_new     = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change               = COALESCE(phone_change, ''),
  phone_change_token         = COALESCE(phone_change_token, ''),
  reauthentication_token     = COALESCE(reauthentication_token, '')
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change IS NULL
   OR email_change_token_new IS NULL
   OR email_change_token_current IS NULL
   OR phone_change IS NULL
   OR phone_change_token IS NULL
   OR reauthentication_token IS NULL;

-- ━━━ 2. Empêcher la récidive ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Un INSERT qui omet ces colonnes obtiendra '' au lieu de NULL. C'est la valeur
-- que GoTrue lui-même écrit.
DO $$
DECLARE
  col TEXT;
BEGIN
  FOREACH col IN ARRAY ARRAY[
    'confirmation_token', 'recovery_token', 'email_change',
    'email_change_token_new', 'email_change_token_current',
    'phone_change', 'phone_change_token', 'reauthentication_token'
  ] LOOP
    -- On ne pose le défaut que si la colonne existe : les versions de GoTrue
    -- ne portent pas toutes le même jeu de colonnes, et une montée de version
    -- ne doit pas faire échouer cette migration.
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = col
    ) THEN
      EXECUTE format('ALTER TABLE auth.users ALTER COLUMN %I SET DEFAULT %L', col, '');
    END IF;
  END LOOP;
END $$;

COMMENT ON TABLE auth.users IS
  'Comptes GoTrue. ⚠️ Les colonnes de jetons (confirmation_token, recovery_token, '
  'email_change*, phone_change*, reauthentication_token) ne doivent JAMAIS valoir '
  'NULL : GoTrue les scanne dans des `string` Go non-nullables, et un seul NULL '
  'fait échouer GET /admin/users pour toute la table — ce qui casse la '
  'reconnexion de tous les comptes (0067). Tout INSERT direct doit poser ''''.';

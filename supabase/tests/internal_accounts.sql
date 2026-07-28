-- Tests SQL du statut de compte interne (migrations 0060 + 0061).
-- Exécution : psql < supabase/tests/internal_accounts.sql
--   ou via le relais HTTP : scripts/… /pg/query (service_role).
-- Tout est en BEGIN/ROLLBACK — non destructif.
--
-- Ce que ces tests protègent, et pourquoi ils existent :
--   * `spawters_update_own` (0001) laisse un compte réécrire SA ligne, toutes
--     colonnes comprises. Sans les triggers de 0060, `is_internal` serait
--     auto-attribuable par un simple PATCH avec la clé anon (scénario B) ;
--   * l'app fait des `upsert(spawter)` de la ligne ENTIÈRE. Le garde doit donc
--     restaurer silencieusement la valeur, PAS lever — sinon toutes les
--     sauvegardes légitimes cassent (scénario B, seconde moitié de l'assertion) ;
--   * la liste d'autorisation contient les téléphones de l'équipe : elle doit
--     être injoignable depuis l'API publique (scénario C).
--
-- ⚠️ Le scénario B est aussi le test qui a révélé la régression de 0058
-- (prédicats de RLS révoqués → 41 policies inévaluables). Un `UPDATE` en
-- session `authenticated` qui échoue en `42501 permission denied for function`
-- signale que ce durcissement a été rejoué : voir 0061.

\set ON_ERROR_STOP off

BEGIN;

-- Deux comptes de test. `+2257700090x` est réservé à la recette.
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
VALUES ('bbbb0000-0000-4000-8000-00000000ff01','00000000-0000-0000-0000-000000000000',
        'authenticated','authenticated','t-int-a@phone.spawt.local','',now(),now(),now()),
       ('bbbb0000-0000-4000-8000-00000000ff02','00000000-0000-0000-0000-000000000000',
        'authenticated','authenticated','t-int-b@phone.spawt.local','',now(),now(),now());

-- ── A. Le client ne choisit pas son statut ─────────────────────────────────
-- Il s'inscrit en se déclarant interne, avec un numéro non autorisé.
INSERT INTO public.spawters (id, phone_e164, display_name, country_code, is_internal)
VALUES ('bbbb0000-0000-4000-8000-00000000ff01','+22577000901','Test A','CI', true);
SELECT 'A' AS scenario, is_internal AS obtenu, false AS attendu
  FROM public.spawters WHERE id='bbbb0000-0000-4000-8000-00000000ff01';

-- ── B. Pas d'auto-promotion, mais les autres colonnes passent ──────────────
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"bbbb0000-0000-4000-8000-00000000ff01","role":"authenticated"}';
UPDATE public.spawters SET is_internal = true, display_name = 'Test A bis'
 WHERE id='bbbb0000-0000-4000-8000-00000000ff01';
SELECT 'B' AS scenario, is_internal AS obtenu_flag, display_name AS obtenu_nom
  FROM public.spawters WHERE id='bbbb0000-0000-4000-8000-00000000ff01';
-- attendu : is_internal = false ET display_name = 'Test A bis'
--           (l'écriture n'est pas rejetée, seul le champ protégé est restauré)

-- ── C. La liste des numéros est injoignable depuis l'API ───────────────────
DO $x$
BEGIN
  PERFORM count(*) FROM public.internal_phone_allowlist;
  RAISE WARNING 'C ÉCHEC — la liste est lisible par authenticated';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'C OK — refus 42501';
END$x$;
RESET ROLE;

-- ── D. Un numéro autorisé donne le statut à l'inscription ──────────────────
INSERT INTO public.internal_phone_allowlist (phone_e164, note) VALUES ('+22577000902','recette');
INSERT INTO public.spawters (id, phone_e164, display_name, country_code)
VALUES ('bbbb0000-0000-4000-8000-00000000ff02','+22577000902','Test B','CI');
SELECT 'D' AS scenario, is_internal AS obtenu, true AS attendu
  FROM public.spawters WHERE id='bbbb0000-0000-4000-8000-00000000ff02';

-- ── E/F/G/H. L'octroi admin : effet, audit, idempotence, retrait ───────────
-- Remplacer le `sub` par l'id d'un spawt_staff admin actif de la base visée.
SET LOCAL request.jwt.claims = '{"sub":"<ID_ADMIN_STAFF>","role":"authenticated"}';
SELECT 'E' AS scenario,
       public.set_spawter_internal('bbbb0000-0000-4000-8000-00000000ff01', true, 'recette') AS obtenu;
SELECT 'F' AS scenario, action AS obtenu  -- attendu : spawter_internal_grant
  FROM public.admin_audit_log WHERE entity_id='bbbb0000-0000-4000-8000-00000000ff01'
  ORDER BY created_at DESC LIMIT 1;
SELECT 'G' AS scenario,
       public.set_spawter_internal('bbbb0000-0000-4000-8000-00000000ff01', true) AS rappel,
       (SELECT count(*) FROM public.admin_audit_log
         WHERE entity_id='bbbb0000-0000-4000-8000-00000000ff01') AS lignes_audit;
-- attendu : lignes_audit = 1 (le second octroi identique n'écrit rien)
SELECT 'H' AS scenario,
       public.set_spawter_internal('bbbb0000-0000-4000-8000-00000000ff01', false, 'fin') AS obtenu;

-- ── I. Un non-admin ne peut pas octroyer ───────────────────────────────────
SET LOCAL request.jwt.claims = '{"sub":"bbbb0000-0000-4000-8000-00000000ff01","role":"authenticated"}';
DO $x$
BEGIN
  PERFORM public.set_spawter_internal('bbbb0000-0000-4000-8000-00000000ff02', true);
  RAISE WARNING 'I ÉCHEC — un non-admin a pu octroyer le statut';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'I OK — refus 42501 forbidden: admin staff required';
END$x$;

ROLLBACK;

-- ── J. Non-régression 0058/0061 ────────────────────────────────────────────
-- Les prédicats de RLS doivent rester exécutables par `authenticated`, sinon
-- 41 policies sur 18 tables deviennent inévaluables. Doit renvoyer 5 lignes
-- toutes à `true`.
SELECT p.proname,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS executable
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('is_active_staff','is_admin_staff','is_b2b_of',
                     'is_b2b_gold_of','crew_session_is_joinable')
 ORDER BY p.proname;

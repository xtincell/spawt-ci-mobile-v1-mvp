-- Migration 0068 — le Coup de Cœur se retire, et le quota revient.
-- Exécution manuelle :  psql < supabase/tests/coup_de_coeur_reversible.sql
-- Chaque scénario en BEGIN/ROLLBACK : non destructif sur une base réelle.
--
-- Ce que ces scénarios protègent, et pourquoi ils n'existaient pas avant : 0028
-- n'avait qu'un sens de circulation. Un tap de travers coûtait une unité de
-- quota du mois, définitivement — signalé depuis un téléphone, pas trouvé par
-- un test.
--
-- ⚠️ Ces fonctions se bornent à `auth.uid()`. En psql direct, `auth.uid()` est
-- NULL et elles répondent `not_authenticated` — ce qui est déjà un scénario à
-- vérifier. Pour exercer le cycle complet, on pose l'identité comme le fait
-- PostgREST : `request.jwt.claims` avec un `sub`.

\set ON_ERROR_STOP off
\timing on

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 0 — sans session, rien ne s'écrit
-- Attendu : {"ok": false, "code": "not_authenticated"}
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
SELECT public.remove_coup_de_coeur((SELECT id FROM places LIMIT 1)) AS sans_session;
ROLLBACK;

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 1 — cycle complet : donner → retirer → redonner
-- Attendu : given(remaining 0) → removed(remaining 1) → given à nouveau.
--           Sans le retrait, le troisième appel répondrait quota_exhausted :
--           c'est LA régression signalée.
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
-- Un spawter au stade `touriste` : quota de 1, le cas le plus tendu.
WITH s AS (SELECT id FROM spawters WHERE stade = 'touriste' LIMIT 1)
SELECT set_config('request.jwt.claims',
                  json_build_object('sub', (SELECT id FROM s))::text, true);

SELECT public.my_coup_de_coeur_state((SELECT id FROM places LIMIT 1)) AS etat_initial;
SELECT public.give_coup_de_coeur((SELECT id FROM places LIMIT 1))     AS donner;
SELECT public.my_coup_de_coeur_state((SELECT id FROM places LIMIT 1)) AS etat_apres_don;
-- Quota épuisé tant qu'on n'a pas retiré.
SELECT public.give_coup_de_coeur((SELECT id FROM places LIMIT 1))     AS redonner_refuse;
SELECT public.remove_coup_de_coeur((SELECT id FROM places LIMIT 1))   AS retirer;
SELECT public.my_coup_de_coeur_state((SELECT id FROM places LIMIT 1)) AS etat_apres_retrait;
-- Le quota a été rendu : ce don-ci doit passer.
SELECT public.give_coup_de_coeur((SELECT id FROM places LIMIT 1))     AS redonner_accepte;
ROLLBACK;

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 2 — retirer ce qu'on n'a pas donné
-- Attendu : {"ok": false, "code": "not_given"} — un ÉTAT, pas une erreur.
--           L'app s'aligne dessus au lieu d'afficher un échec : c'est le cas
--           d'un écran resté sur une vue périmée.
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
WITH s AS (SELECT id FROM spawters LIMIT 1)
SELECT set_config('request.jwt.claims',
                  json_build_object('sub', (SELECT id FROM s))::text, true);
SELECT public.remove_coup_de_coeur((SELECT id FROM places OFFSET 1 LIMIT 1)) AS rien_a_retirer;
ROLLBACK;

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 3 — un mois CLOS n'est ni remboursable ni effaçable
-- Attendu : la ligne du mois précédent survit au retrait, et `used` du mois
--           courant reste à 0. Effacer un signal passé réécrirait l'historique
--           public d'un lieu ; rembourser une unité d'un mois clos n'a aucun
--           sens puisque le quota s'est déjà remis à zéro.
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
WITH s AS (SELECT id FROM spawters LIMIT 1)
SELECT set_config('request.jwt.claims',
                  json_build_object('sub', (SELECT id FROM s))::text, true);

INSERT INTO public.coups_de_coeur (spawter_id, place_id, month_key)
SELECT (SELECT id FROM spawters LIMIT 1),
       (SELECT id FROM places LIMIT 1),
       to_char(now() - interval '1 month', 'YYYY-MM');

SELECT public.remove_coup_de_coeur((SELECT id FROM places LIMIT 1)) AS retrait_hors_mois;

-- Attendu : 1 (la ligne du mois précédent est toujours là).
SELECT count(*) AS lignes_mois_precedent
FROM public.coups_de_coeur
WHERE month_key = to_char(now() - interval '1 month', 'YYYY-MM');

-- Attendu : is_current_month = false sur cette ligne.
SELECT place_name, month_key, is_current_month FROM public.my_coups_de_coeur();
ROLLBACK;

-- ───────────────────────────────────────────────────────────────────────────
-- Scenario 4 — `my_coups_de_coeur` ne rend QUE les siens
-- Attendu : 0 ligne pour un spawter qui n'a rien donné, même si d'autres en
--           ont donné. La fonction est SECURITY DEFINER : si le filtre
--           `auth.uid()` sautait, elle exposerait les cœurs de tout le monde.
-- ───────────────────────────────────────────────────────────────────────────
BEGIN;
INSERT INTO public.coups_de_coeur (spawter_id, place_id, month_key)
SELECT (SELECT id FROM spawters LIMIT 1), (SELECT id FROM places LIMIT 1),
       to_char(now(), 'YYYY-MM');

-- On regarde avec l'identité d'un AUTRE spawter.
WITH s AS (SELECT id FROM spawters OFFSET 1 LIMIT 1)
SELECT set_config('request.jwt.claims',
                  json_build_object('sub', (SELECT id FROM s))::text, true);
SELECT count(*) AS doit_etre_zero FROM public.my_coups_de_coeur();
ROLLBACK;

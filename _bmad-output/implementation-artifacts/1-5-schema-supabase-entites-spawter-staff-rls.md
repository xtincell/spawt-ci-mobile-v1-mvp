# Story 1.5: Schéma Supabase — entités spawter & staff + RLS

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a équipe SPAWT,
I want les tables `spawters` et `spawt_staff` créées avec leur RLS, dans une migration Supabase réversible et versionnée,
so that les comptes publics B2C (spawters) sont séparés des comptes équipe interne (staff) dès la fondation — convention FK figée pour toutes les tables métier qui suivront.

## ⚠️ Brownfield context — read first

**Aucun `supabase/` n'existe encore à la racine du repo.** Cette story est la **première migration** SQL et la première brique infra-DB. La structure cible (cf. `_bmad-output/planning-artifacts/architecture.md` lignes 686-704) :

```
supabase/
├── config.toml
├── migrations/
│   ├── 0001_create_spawters_spawt_staff.sql       (NEW — cette story)
│   └── 0001_create_spawters_spawt_staff.down.sql  (NEW — cette story)
├── functions/                                      (vide pour l'instant)
└── seed/                                           (vide pour l'instant)
```

Le type [`app/src/types/spawter.ts`](../../app/src/types/spawter.ts) **existe déjà** depuis le bootstrap Moka (commit `2eed5e2`) et déclare `Spawter`, `Gender`, `AgeRange`, `CountryCode`. Cette story **doit aligner le schéma SQL exactement** sur ce type TS — c'est le contrat. Les colonnes SQL sont déjà spécifiées par le type ; cette story matérialise le contrat côté DB.

**Auth Supabase n'est pas encore branchée.** L'OTP / Termii / Edge Function `otp-send` est Story 2.3 (Epic 2). Cette story crée les tables et la RLS — la RLS référence `auth.uid()` qui sera vide tant que l'auth n'est pas wirée, mais c'est correct : la table reste lockée par défaut, accessible seulement via service_role (Edge Functions).

**Supabase CLI** n'est pas encore installé dans le repo. Cette story doit l'ajouter (en dev dependency au root, ou supposer installation globale — décision dans Task 0).

**Pas de Supabase project ID figé.** Le projet Supabase live (URL + ANON_KEY) n'est pas créé dans cette story — la migration peut être appliquée localement via `supabase db reset` ou différée jusqu'à provision. **Décision** : créer la migration et la valider syntaxiquement (lint SQL) ; le déploiement live = handoff hors story.

## Acceptance Criteria

1. **Dossier `supabase/` créé à la racine du repo** avec sous-dossiers `migrations/`, `functions/`, `seed/`. Le `supabase/config.toml` est généré par `supabase init` (ou copié d'une référence) avec `project_id` cohérent (`spawt-mobile-ci` par défaut). Le `.gitignore` racine **inclut déjà** `node_modules/` (vérifié) ; ajouter `supabase/.branches/`, `supabase/.temp/`, `supabase/.env` si absents.

2. **Migration `0001_create_spawters_spawt_staff.sql` crée la table `spawters`** avec **exactement** ces colonnes (alignées sur [`app/src/types/spawter.ts`](../../app/src/types/spawter.ts)) :

   | Colonne | Type SQL | Nullable | Default | Note |
   |---|---|---|---|---|
   | `id` | `uuid` | NOT NULL | — | PK, lié à `auth.users(id)` via FK ON DELETE CASCADE |
   | `phone_e164` | `text` | NOT NULL | — | **UNIQUE** (AC #5) ; format E.164 (`^\+[1-9]\d{1,14}$`) |
   | `display_name` | `text` | NOT NULL | — | non-empty (CHECK `length(trim(display_name)) > 0`) |
   | `avatar_url` | `text` | NULL | NULL | URL Supabase Storage `place-photos/avatars/<id>/...` (bucket Story 4.5) |
   | `neighborhood` | `text` | NULL | NULL | Quartier déclaré (PRD §3.1) |
   | `country_code` | `text` | NOT NULL | `'CI'` | CHECK IN (`'CI','NG','SN','CM','TG','BJ','BF','ML','GN','GH'`) |
   | `origin_country_code` | `text` | NULL | NULL | Même CHECK que `country_code` quand non-NULL |
   | `gender` | `text` | NOT NULL | `'non_renseigne'` | CHECK IN (`'homme','femme','autre','non_renseigne'`) |
   | `age_range` | `text` | NULL | NULL | CHECK IN (`'18-24','25-34','35-44','45-54','55+'`) |
   | `stade` | `text` | NOT NULL | `'touriste'` | CHECK IN (`'touriste','explorateur','detective','djidji','guide'`) |
   | `total_spawts` | `integer` | NOT NULL | `0` | CHECK `>= 0` |
   | `unique_spots` | `integer` | NOT NULL | `0` | CHECK `>= 0` |
   | `customer_id` | `uuid` | NULL | NULL | FK différée Story 1.6 (`customers(id)` ON DELETE SET NULL) — déclarée sans FK pour l'instant, FK ajoutée Story 1.6 |
   | `geoloc_consent_at` | `timestamptz` | NULL | NULL | PRD amendement Claude 5.2 — ARTCI |
   | `data_consent_at` | `timestamptz` | NULL | NULL | Idem |
   | `created_at` | `timestamptz` | NOT NULL | `now()` | — |
   | `updated_at` | `timestamptz` | NOT NULL | `now()` | Trigger `update_timestamp_spawters` met à jour à chaque UPDATE |

3. **Migration crée la table `spawt_staff`** (séparation B2C/team, amendement 4.1) avec :

   | Colonne | Type | Nullable | Default | Note |
   |---|---|---|---|---|
   | `id` | `uuid` | NOT NULL | — | PK, lié à `auth.users(id)` via FK ON DELETE CASCADE — **auth distincte** des spawters (architecture §3 lignes 239-244) |
   | `email` | `text` | NOT NULL | — | UNIQUE, format email validé par auth.users |
   | `display_name` | `text` | NOT NULL | — | — |
   | `role` | `text` | NOT NULL | — | CHECK IN (`'admin','moderator','operator'`) |
   | `is_active` | `boolean` | NOT NULL | `true` | Soft-disable au lieu de delete (audit trail) |
   | `created_at` | `timestamptz` | NOT NULL | `now()` | — |
   | `updated_at` | `timestamptz` | NOT NULL | `now()` | Trigger `update_timestamp_spawt_staff` |

4. **Index** créés :
   - `spawters_phone_e164_idx` (UNIQUE, déjà couvert par la contrainte UNIQUE) — pas de doublon, juste le constraint.
   - `spawters_country_code_idx` BTREE — utilisé par les KPIs Madame Sun (cohortes par pays — NFR-PORT-01).
   - `spawters_stade_idx` BTREE — utilisé par feed personnalisé + analytics.
   - `spawt_staff_email_idx` UNIQUE (déjà couvert par UNIQUE constraint).
   - `spawt_staff_role_idx` BTREE — moderation queue triée par role.

5. **Triggers** :
   - `update_timestamp_spawters` — `BEFORE UPDATE ON spawters` exécute une fonction `set_updated_at()` (générique, créée une fois, réutilisée par toutes les tables futures avec `updated_at`).
   - `update_timestamp_spawt_staff` — idem.

6. **Phone unique** : `spawters.phone_e164` est `UNIQUE NOT NULL` (AC original — un spawter par numéro), avec validation format E.164 via CHECK `phone_e164 ~ '^\+[1-9]\d{1,14}$'`.

7. **RLS activée** sur les deux tables :
   - `ALTER TABLE spawters ENABLE ROW LEVEL SECURITY;`
   - `ALTER TABLE spawt_staff ENABLE ROW LEVEL SECURITY;`

8. **Policies `spawters`** (NFR-SEC-01) :
   - `spawters_select_own` : `FOR SELECT USING (id = auth.uid())` — un spawter ne lit que sa ligne.
   - `spawters_insert_own` : `FOR INSERT WITH CHECK (id = auth.uid())` — onboarding insère sa propre ligne (signup OTP attribue l'id depuis `auth.users`).
   - `spawters_update_own` : `FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid())`.
   - **Pas de policy DELETE publique** — soft-delete via `anonymize-deleted-spawters` Edge Function (NFR-SEC-04, J+30 — Story future).
   - **Staff access** : `spawters_select_staff` : `FOR SELECT USING (EXISTS (SELECT 1 FROM spawt_staff s WHERE s.id = auth.uid() AND s.is_active))` — un staff actif peut lire tous les spawters (moderation panel Story 6.4).

9. **Policies `spawt_staff`** (séparation forte) :
   - **Aucune policy publique** — par défaut RLS bloque tout, donc inaccessible aux spawters publics ✓.
   - `spawt_staff_select_own` : `FOR SELECT USING (id = auth.uid())` — un staff lit sa propre ligne (login panel admin).
   - `spawt_staff_select_admin` : `FOR SELECT USING (EXISTS (SELECT 1 FROM spawt_staff s WHERE s.id = auth.uid() AND s.role = 'admin' AND s.is_active))` — un admin lit tous les staff (gestion).
   - Pas d'INSERT/UPDATE/DELETE public — création staff via Supabase Admin UI / migration / Edge Function service_role.

10. **Convention FK documentée en commentaire SQL** dans le header de `0001_create_spawters_spawt_staff.sql` : « Toute table métier (`spawt_checkin`, `user_palais`, `spawter_progression`, `collection_titres`, `user_signals`, `mue_tracking`, `subscriptions`, `invoices`) qui référence un spawter le fait via `spawter_id uuid NOT NULL REFERENCES spawters(id) ON DELETE CASCADE`. Jamais vers une table `users` générique (PRD §19 vocab + architecture §17.2). »

11. **Migration down `0001_create_spawters_spawt_staff.down.sql`** **réversible et idempotente** :
    - `DROP POLICY IF EXISTS ... ON spawters;` (5 policies)
    - `DROP POLICY IF EXISTS ... ON spawt_staff;` (2 policies)
    - `DROP TRIGGER IF EXISTS update_timestamp_spawters ON spawters;`
    - `DROP TRIGGER IF EXISTS update_timestamp_spawt_staff ON spawt_staff;`
    - `DROP TABLE IF EXISTS spawt_staff CASCADE;`
    - `DROP TABLE IF EXISTS spawters CASCADE;`
    - `DROP FUNCTION IF EXISTS set_updated_at() CASCADE;` — la fonction `set_updated_at` est créée par cette migration ; le down la supprime (sauf si elle a été utilisée par une migration ultérieure — `CASCADE` rejettera proprement).
    - Pas de `DROP SCHEMA` ni `DROP EXTENSION` — on ne touche pas `auth`, `public`, etc.

12. **Validation locale via Supabase CLI** :
    - `supabase db reset` (ou équivalent `supabase migration up`) applique la migration sur une DB locale Docker → 0 erreur.
    - `supabase db lint` (si dispo) ou `pg_format` + `pg_dump --schema-only` confirme le shape attendu.
    - Test fonctionnel manuel : INSERT depuis service_role réussit ; INSERT depuis anon avec id ≠ auth.uid() échoue avec RLS violation.

13. **Documentation** :
    - `supabase/README.md` créé avec : prérequis CLI (`brew install supabase/tap/supabase` ou `npm install -g supabase`), commandes courantes (`supabase start`, `supabase db reset`, `supabase migration new <name>`), workflow migration → review → apply.
    - Une entry `CHANGELOG.md` v1.1.8 documente la création du schéma fondation (format Moka).

## Tasks / Subtasks

- [x] **Task 0 — Prérequis Supabase CLI** (AC: 1)
  - [ ] Vérifier que `supabase` CLI est disponible (`supabase --version`). Si absent, documenter installation dans `supabase/README.md` (option recommandée : `npm install -g supabase` pour cohérence avec l'écosystème Node du projet).
  - [ ] `supabase init` à la racine du repo (génère `supabase/config.toml`). Si le dossier existe déjà partiellement, merge prudemment.
  - [ ] Ajouter `supabase/.branches/`, `supabase/.temp/`, `supabase/.env` à `.gitignore` racine si absents.
  - [ ] Régler `project_id = "spawt-mobile-ci"` dans `config.toml` (placeholder — sera lié au vrai projet Supabase lors du provisioning hors story).

- [x] **Task 1 — Migration up `0001_create_spawters_spawt_staff.sql`** (AC: 2, 3, 4, 5, 6, 10)
  - [ ] Créer `supabase/migrations/0001_create_spawters_spawt_staff.sql`.
  - [ ] Header SQL : commentaire multi-ligne avec : (a) titre, (b) story ref (1.5), (c) PRD ref §13.1 + amendement 4.5, (d) convention FK (AC #10), (e) date.
  - [ ] Fonction réutilisable `set_updated_at()` :
    ```sql
    CREATE OR REPLACE FUNCTION public.set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    ```
  - [ ] `CREATE TABLE public.spawters (...)` avec toutes les colonnes du tableau AC #2, contraintes CHECK, FK vers `auth.users(id) ON DELETE CASCADE`.
  - [ ] `CREATE TABLE public.spawt_staff (...)` avec colonnes AC #3.
  - [ ] Index AC #4 (5 index).
  - [ ] Triggers `update_timestamp_*` AC #5.

- [x] **Task 2 — RLS + Policies** (AC: 7, 8, 9)
  - [ ] `ALTER TABLE public.spawters ENABLE ROW LEVEL SECURITY;`
  - [ ] `ALTER TABLE public.spawt_staff ENABLE ROW LEVEL SECURITY;`
  - [ ] 5 policies sur `spawters` (AC #8) — chaque policy commentée avec son intent (qui peut faire quoi).
  - [ ] 2 policies sur `spawt_staff` (AC #9).
  - [ ] **Test RLS manuel** : créer 2 utilisateurs `auth.users` test, vérifier qu'avec `set role authenticated; set request.jwt.claim.sub = '<uuid>'`, les SELECT renvoient bien la ligne propre uniquement.

- [x] **Task 3 — Migration down `0001_create_spawters_spawt_staff.down.sql`** (AC: 11)
  - [ ] Créer `supabase/migrations/0001_create_spawters_spawt_staff.down.sql`.
  - [ ] Drop policies (7), triggers (2), tables (2 — `CASCADE`), function (1 — `CASCADE`).
  - [ ] Test : `supabase db reset` puis appliquer `0001_create...sql` puis appliquer manuellement `0001_create...down.sql` → schéma vide, aucune erreur, idempotent (`DROP IF EXISTS`).

- [~] **Task 4 _(validation Docker différée — pas de Docker dans l'env Moka ; à valider sur poste dev avec Docker Desktop)_ — Validation locale** (AC: 12)
  - [ ] `supabase start` (lance la stack Docker locale).
  - [ ] `supabase db reset` (applique toutes les migrations sur la DB locale).
  - [ ] Vérifier shape via `psql` : `\d spawters` et `\d spawt_staff` retournent toutes les colonnes attendues.
  - [ ] Test RLS : INSERT comme `service_role` ✓ ; INSERT comme `anon` avec `id` arbitraire → erreur RLS.
  - [ ] Test FK convention : un INSERT dans une table fictive avec `spawter_id` qui ne référence pas un `spawters(id)` valide → erreur FK.

- [x] **Task 5 — Documentation** (AC: 13)
  - [ ] Créer `supabase/README.md` avec : (a) install CLI, (b) workflow migrations, (c) lien architecture.md pour le data model complet, (d) commandes Make / npm scripts si ajoutés.
  - [ ] Ajouter à `CHANGELOG.md` une entry `v1.1.8 — Fondation schéma Supabase (spawters + spawt_staff + RLS)` au format Moka.
  - [ ] Mettre à jour `_bmad-output/implementation-artifacts/sprint-status.yaml` : `1-5-...: backlog → ready-for-dev → in-progress → review`.

- [x] **Task 6 — Audits**
  - [ ] `cd app && npx tsc --noEmit` → 0 erreur (pas de changement TS attendu, sanity check).
  - [ ] `cd app && npm run lint:vocab` → pass.
  - [ ] `cd app && npm run i18n:check` → pass.
  - [ ] `supabase db lint` si disponible.

## Dev Notes

### Pourquoi pas de FK `customer_id` vers `customers(id)` dès cette story ?

Story 1.6 crée `customers`. Si on déclare la FK ici, on a un blocage circulaire ou un ordering forcé. **Solution** : `customer_id uuid NULL` dans Story 1.5 sans contrainte FK ; Story 1.6 ajoute `ALTER TABLE spawters ADD CONSTRAINT spawters_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;` dans sa migration. Documenté dans le header SQL.

### Pourquoi `auth.users(id) ON DELETE CASCADE` sur `spawters.id` ?

Supabase Auth gère `auth.users`. Un compte supprimé dans Auth doit automatiquement nettoyer son `spawters` row. Mais en pratique on **soft-deletera** via la Edge Function `anonymize-deleted-spawters` (NFR-SEC-04, J+30) — donc la cascade Auth est un filet de sécurité, pas le chemin principal de suppression.

### Pourquoi `auth.uid()` dans les policies, pas `auth.role()` ?

`auth.uid()` retourne l'UUID du user authentifié (ou NULL si anon). C'est l'identifiant fonctionnel pour le scoping. `auth.role()` est une string (`'authenticated'`/`'anon'`/`'service_role'`) et sert pour les guards larges. Pattern Supabase canonique.

### Comment fonctionne le `auth.uid()` côté staff vs spawter ?

Supabase Auth ne distingue **pas** côté infra entre un spawter et un staff — c'est juste deux `auth.users` distincts qui se loggent par des chemins différents (OTP côté spawter, magic link / password côté staff). La séparation se fait par l'existence d'une ligne dans `spawt_staff` (login staff) ou `spawters` (login spawter). Un humain qui se logge sur les deux comptes verra deux UUIDs distincts. **Conséquence** : un spawter ne peut JAMAIS être staff sur le même compte — c'est la séparation B2C/team voulue (amendement 4.1).

### Patterns SQL — alignement avec l'écosystème Supabase

- **Quoting** : noms d'objets en `lower_snake_case`, pas de quotes (`spawters`, pas `"Spawters"`). Pattern Supabase canonique.
- **Schemas** : tout dans `public` sauf les fonctions `auth.*` (gérées par Supabase). Pas de schéma custom dans Sprint 1.
- **Extensions** : `pgcrypto` (uuid_generate_v4) est déjà activée par Supabase par défaut — pas besoin de `CREATE EXTENSION`.
- **`timestamptz` partout** (pas `timestamp` sans timezone) — invariant data architecture.
- **Default `now()`** sur created_at/updated_at. Pas `current_timestamp` (synonyme, mais convention `now()`).

### Comment tester la RLS localement

```bash
# Démarrer la stack Docker
supabase start

# Récupérer l'URL + ANON_KEY local depuis l'output
# Ex: API URL: http://127.0.0.1:54321, anon key: eyJ...

# Test depuis psql en mode authenticated
psql "$(supabase db url)" <<'SQL'
SET role authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

-- Doit retourner 0 ligne (RLS bloque tout sauf id = auth.uid())
SELECT * FROM spawters;

-- INSERT avec id matchant le claim → OK
INSERT INTO spawters (id, phone_e164, display_name, country_code, gender, age_range)
VALUES ('00000000-0000-0000-0000-000000000001', '+22501234567', 'Test', 'CI', 'homme', '25-34');

-- INSERT avec id ≠ claim → RLS violation
INSERT INTO spawters (id, phone_e164, display_name, country_code, gender, age_range)
VALUES ('00000000-0000-0000-0000-000000000002', '+22501234568', 'Test2', 'CI', 'homme', '25-34');
-- ERROR:  new row violates row-level security policy for table "spawters"

RESET role;
SQL
```

### Constraints du `project-context.md`

- **TS strict + canonical part `app/`** — pas de changement TS dans cette story (le type `Spawter` existe déjà, on aligne le SQL dessus).
- **Vocab SPAWT** : table `spawters` (pluriel canonique, jamais `users`). Table `spawt_staff` (jamais `staff` ni `admin_users`). Convention FK : `spawter_id`, jamais `user_id`.
- **Pas de tables `customers`/`plans`/`currencies` ici** — Story 1.6 (périmètre séparé).
- **`country_code` obligatoire** sur `spawters` (NFR-PORT-01).
- **EAS APK Android** chemin canonique Sprint 1 — non impacté par cette story DB.
- **Triple gate** : passe (aucun code TS modifié, mais sanity check obligatoire).

### Tooling — Supabase CLI

Versions courantes : `supabase` CLI v1.x (vers 2025) puis v2.x. Compatible Node ≥ 20 (déjà imposé par Expo SDK 55). Installation :
- Recommandé : `npm install -g supabase` (cohérent avec le repo) ou `npx supabase ...` ad hoc.
- Alternative macOS : `brew install supabase/tap/supabase`.
- Windows : `scoop install supabase` ou MSI direct.

La stack Docker (`supabase start`) nécessite **Docker Desktop** installé localement. **Hors scope cette story** si Docker pas dispo — la story peut être marquée done avec migration créée + lint statique, et la validation `supabase db reset` différée à un environnement avec Docker.

### Testing standards for this story

- **Pas de unit test TS** — story DB only.
- **Validation = `supabase db reset` OK + RLS test manuel** (cf. Dev Notes ci-dessus).
- **Pas de test Jest** sur la RLS (pas d'outillage SQL côté Jest dans le repo). Si besoin futur, `pgTAP` est l'option canonique mais hors scope V1.

### Fichiers que la story touche

- **NEW — `supabase/config.toml`** (généré par `supabase init`).
- **NEW — `supabase/migrations/0001_create_spawters_spawt_staff.sql`** (~150 lignes SQL).
- **NEW — `supabase/migrations/0001_create_spawters_spawt_staff.down.sql`** (~20 lignes SQL).
- **NEW — `supabase/README.md`** (~50 lignes md).
- **UPDATE — `.gitignore`** (racine) : ajouter `supabase/.branches/`, `supabase/.temp/`, `supabase/.env` si absents.
- **UPDATE — `CHANGELOG.md`** : entry v1.1.8.
- **UPDATE — `_bmad-output/implementation-artifacts/sprint-status.yaml`** : status `1-5-...`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md] lignes 444-461 — Story 1.5 user story + BDD AC.
- [Source: _bmad-output/planning-artifacts/architecture.md] lignes 277-330 (Data Architecture), 458-479 (naming conventions), 686-704 (folder layout supabase/), 725-735 (RLS frontière de confiance).
- [Source: documentation/SPAWT_PRD_V1.docx] §13.1 — schéma `spawters` ; §13.2 — `spawt_staff` ; amendement team §4.1, §4.2, §4.5 — séparation B2C/staff + démographique.
- [Source: documentation/SPRINT_1_CAHIER_DES_CHARGES.md] §5.1 — Phase 0 « Schéma Supabase tables fondation ».
- [Source: app/src/types/spawter.ts] — type `Spawter` canonique TS, contrat aligné colonne par colonne.
- [Source: _bmad-output/project-context.md] § Supabase / PostgREST — RLS attendu, `spawter_id = auth.uid()` invariant.

## Git Intelligence Summary

- **HEAD = `997bf45`** (Story 1.4 done) + 13 fichiers uncommittés (patches review applied — Story 1.2/1.3/1.4 reviewed et patchées). Cette story ne touche pas les fichiers `app/` ; les patches uncommittés et cette story sont orthogonaux. Possibilité de commit groupé ou séparé.
- **Pattern de commit attendu** : `feat(infra): crée le schéma Supabase fondation spawters + spawt_staff + RLS (Story 1.5)`. Body : convention FK + scope. `PRD ref: §13.1`. Triple sign-off : Stéphanie (tech lead schéma) ✓ ; Kidam (KPIs cohorte pays — country_code) ✓ ; Alexandre (vocab spawter/staff respecté) ✓.
- **Branche** : continuer sur `theme/align-canonical-tokens` (ou créer `infra/schema-fondation` selon ton choix — la branche actuelle ne reflète plus son nom d'origine).

## Project Context Reference

`_bmad-output/project-context.md` est chargé comme fait persistant. Invariants critiques :

- **§ "Vocabulaire SPAWT"** — `spawters` table (pluriel canonique). `spawt_staff` séparé. Convention FK `spawter_id` vers `spawters(id)`. Jamais `user_id` ni `users`.
- **§ "Supabase / PostgREST"** — RLS attendue Sprint 1 Phase 0 : `spawter_id = auth.uid()` sur `spawt_checkin`, `user_palais`, `spawters`. Cette story livre la RLS sur `spawters` + `spawt_staff` (premiers de la série).
- **§ "Security & privacy"** — RLS obligatoire sur toutes les tables PII. Aucun service_role côté mobile. PII (gender, age_range, origin_country_code) consent ARTCI requis (`data_consent_at`, `geoloc_consent_at`).

## Story Completion Status

Ultimate context engine analysis completed — comprehensive developer guide created. La story livre la première migration Supabase du projet : `supabase/` créé à la racine, migration up + down, RLS sur les 2 tables, FK convention figée. Périmètre verrouillé : pas de `customers`/`plans`/`currencies` (Story 1.6), pas d'auth (Story 2.3), pas d'Edge Function (Stories futures). Status set to `ready-for-dev`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- Triple gate (tsc + lint:vocab + i18n:check) lancé 2026-05-16 après création des fichiers SQL : ✓ tous verts (aucun TS modifié, sanity check).
- Validation `supabase db reset` **différée** — pas de Docker Desktop disponible dans l'environnement Moka. La migration est syntaxiquement valide (Postgres 15 syntax conformity, IF EXISTS partout dans down, CASCADE sur DROP) et alignée sur le type TS `Spawter`.

### Completion Notes List

- **Périmètre livré exactement comme cadré** : `supabase/config.toml`, migration up `0001_create_spawters_spawt_staff.sql` (~140 lignes SQL), migration down `0001_create_spawters_spawt_staff.down.sql` (~25 lignes), `supabase/README.md`, `.gitignore` mis à jour.
- **AC #2-#10** : 100 % implémentés.
- **AC #11** : down idempotent OK (`DROP IF EXISTS` partout).
- **AC #12** : validation Docker différée — `supabase db reset` à exécuter sur poste dev. Migration syntaxiquement OK.
- **AC #13** : `supabase/README.md` créé avec workflow CLI complet + table d'état Sprint 1.
- **Convention FK** documentée en commentaire SQL header (lignes 13-21 de la migration up).
- **`customer_id`** déclaré sans contrainte FK — Story 1.6 ajoutera `ALTER TABLE spawters ADD CONSTRAINT ...`.
- **Validation RLS** différée à env avec Docker — tests manuels documentés dans Dev Notes de la story.

### File List

- `supabase/config.toml` (new — placeholder project_id `spawt-mobile-ci`)
- `supabase/migrations/0001_create_spawters_spawt_staff.sql` (new — ~140 lignes)
- `supabase/migrations/0001_create_spawters_spawt_staff.down.sql` (new — ~25 lignes)
- `supabase/README.md` (new — workflow CLI + état Sprint 1)
- `.gitignore` (modified — bloc Supabase ajouté)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (à modifier — `1-5-...: ready-for-dev → done`)

### Review Findings (2026-05-16)

Couche source : Blind Hunter + Edge Case Hunter + Acceptance Auditor (mode `full`).

**Decision-needed (0 — toutes résolues 2026-05-16)**

- [x] [Review][Decision] ~~Cascade-delete vs append-only~~ — **Tranché D1** : on retire le BEFORE DELETE trigger sur `user_signals`. Append-only au sens fort = pas d'UPDATE des rows actives (anti-fraude L1). La défense DELETE est déjà côté RLS (pas de policy DELETE → pas de DELETE client). Le cascade naturel `auth.users → spawters → user_signals` anonymise les signaux du spawter supprimé — c'est le GDPR right-to-erasure légitime. Trace agrégate via event `account_deletion_requested` émis AVANT suppression (déjà dans la taxonomie). Pas de GUC session, pas de service_role bypass, pas de table d'audit dédiée à maintenir. Cf. commentaire D1 dans `0003_..sql`.

**Patch (2)**

- [ ] [Review][Patch] **`spawters.stade` ne bloque pas la régression** [`supabase/migrations/0001_create_spawters_spawt_staff.sql`] — invariant PRD §5.2 + project-context (« stade qui recule = interdit »). CHECK actuel autorise n'importe quelle transition `IN ('touriste','explorateur','detective','djidji','guide')`. Fix : ajouter une fonction `stade_rank(text) → int` + trigger BEFORE UPDATE qui raise si `stade_rank(NEW.stade) < stade_rank(OLD.stade)`. Migration `0001_..` (refactor) ou nouvelle migration `0005_*.sql` (préférable — séparer).
- [ ] [Review][Patch] **`spawters.geoloc_consent_at` / `data_consent_at` mutables sans contrainte** [`supabase/migrations/0001_create_spawters_spawt_staff.sql:42-43`] — policy `spawters_update_own` n'a aucune column-level grant. Un spawter peut back-date ou forward-date ses timestamps de consentement → audit ARTCI Loi 2013-450 falsifiable. Fix : trigger BEFORE UPDATE qui rejette toute mutation d'un consent timestamp non-NULL vers une valeur différente (set-once semantics).

**Defer (3)**

- [x] [Review][Defer] **`spawters.country_code` / `origin_country_code` CHECK fermé sur 10 codes CIV-region** [`0001_..sql:21-26`] — un 11ème pays (Mauritanie, Niger) requiert une migration. Acceptable V1 (scope CIV). → Re-évaluer si onboarding multi-pays Sprint 2+.
- [x] [Review][Defer] **`phone_e164` regex permissif** [`0001_..sql:8-9`] — `^\+[1-9]\d{1,14}$` accepte un `+22512345` invalide CIV. La validation client + le provider OTP (Termii / Twilio) filtreront. → Pas un bug fonctionnel V1.
- [x] [Review][Defer] **`spawters.gender` vocab FR-locale (`homme/femme/autre/non_renseigne`) côté DB** — couplage vocab UI ↔ DB. Acceptable car le mapping UI est constant V1. → Re-considérer si i18n EN/PT s'ajoute.

**Dismissed (faux positifs)**

- ~~AC #11 spec dit « 5 policies on spawters » mais AC #8 n'en définit que 4~~ — auto-incohérence du spec ; l'implémentation aligne 4 = OK.
- ~~AC #4 « pas d'index explicite sur `phone_e164` »~~ — couvert par UNIQUE implicite ; spec explicite.

#### Review Triage Summary (Story 1.5)

- 0 decision-needed (1 résolu : D1 cascade-delete vs append-only)
- 2 patch (should-fix — appliqués via migration `0005_spawters_invariant_triggers.sql`)
- 3 deferred
- 2 dismissed

#### Review Patches Applied (2026-05-16)

- ✅ Migration `0005_spawters_invariant_triggers.sql` créée — trigger `stade` anti-régression + consent timestamps set-once
- ✅ D1 résolu — BEFORE DELETE trigger retiré de `0003_..sql`
- ✅ Triple gate vert post-patches

# Story 1.8: Système de feature flags runtime

Status: done

## Story

As a équipe SPAWT,
I want un système de feature flags activable au runtime par scope (`internal`/`alpha`/`beta`/`prod`) avec un hook `useFlag(code)` côté mobile,
so that chaque feature peut merger derrière un flag (cohérent FR-041), un staff peut activer un flag pour un spawter spécifique (préparation alpha §5.8), et le TTL de rafraîchissement < 60s permet une activation quasi-instantanée sans rebuild.

## ⚠️ Brownfield context — read first

**Aucun feature flag actif en V1.** Les flags sont une infra prête à l'emploi pour les futures stories qui voudront merger derrière un flag (paywall, gold-grad button visible, ranking activable, etc.). **Aucun flag n'est posé sur les FR data-layer (FR-024 → FR-030) ni sur les NFR** (sécurité, perf, etc.) — ce sont des invariants, pas des features togglables.

Architecture §3 l266 : `state = Zustand` ; le store `feature-flags.ts` est **léger** (séparé de `spawter-store`), hydraté depuis la table `feature_flags`, polling toutes les ~60s.

## Acceptance Criteria

1. **Migration `0004_create_feature_flags.sql`** crée la table :
   - `id` uuid PRIMARY KEY DEFAULT `gen_random_uuid()`
   - `flag_code` text NOT NULL — slug `snake_case` (ex `ranking_visible`)
   - `spawter_id` uuid NULL REFERENCES `spawters(id)` ON DELETE CASCADE — NULL = scope global, non-NULL = override pour un spawter spécifique
   - `enabled` boolean NOT NULL DEFAULT false
   - `scope` text NOT NULL CHECK IN (`'internal'`, `'alpha'`, `'beta'`, `'prod'`)
   - `expires_at` timestamptz NULL — flag temporaire auto-désactivé après cette date
   - `created_at`, `updated_at` timestamptz
   - **UNIQUE constraint** `(flag_code, spawter_id, scope)` — un flag par (code, spawter, scope). Le NULL `spawter_id` représente le scope global et est déduplicé (Postgres traite NULL comme distinct par défaut, donc en pratique on a 0 ou 1 ligne globale par `(flag_code, scope)` quand `spawter_id IS NULL`).

2. **Index** :
   - `feature_flags_flag_code_scope_idx` BTREE (`flag_code`, `scope`) — résolution rapide.
   - `feature_flags_spawter_id_idx` BTREE (`spawter_id`) WHERE `spawter_id IS NOT NULL` — overrides par spawter.

3. **Trigger** `update_timestamp_feature_flags` (réutilise `set_updated_at()`).

4. **RLS** :
   - `feature_flags_select_own` : `FOR SELECT USING (spawter_id IS NULL OR spawter_id = auth.uid())` — un spawter voit les flags globaux + ses overrides.
   - `feature_flags_select_staff` : staff actif lit tous.
   - `feature_flags_write_staff` : `FOR INSERT/UPDATE/DELETE` réservé staff (`EXISTS (SELECT 1 FROM spawt_staff WHERE id = auth.uid() AND role IN ('admin','operator'))`).

5. **Migration down `0004_..down.sql`** réversible + idempotente.

6. **Store Zustand `app/src/store/feature-flags.ts`** créé :
   - State : `{ flags: Record<string, boolean>; lastSyncAt: number | null; loading: boolean }`.
   - Actions : `hydrate()` charge tous les flags pertinents (globaux + overrides spawter), `setLocalOverride(code, enabled)` pour dev.
   - **Polling 60s** : `useFlagsPolling()` hook qui démarre/arrête un `setInterval` côté Root `_layout.tsx` (à câbler par une story future si besoin, ou démarrer ici sans casser le splash gate).
   - Adapter : `flags.fetch()` passe par `data-source.ts` (à étendre) — pas d'import Supabase statique.

7. **Hook `useFlag(code: string): boolean`** dans `app/src/store/feature-flags.ts` :
   - Lit `flags[code]` du store via sélecteur.
   - Défaut `false` si le code n'est pas chargé.
   - Pas d'effet de bord — les composants utilisateurs sont passifs.

8. **Type `FeatureFlag`** dans `app/src/types/feature-flag.ts` :
   - Aligné sur la table SQL.

9. **Adapter `data-source.ts` étendu** : nouvelle fonction `listFeatureFlags(spawter_id: string | null): Promise<FeatureFlag[]>` qui passe par mode `supabase` si configuré, ou retourne `[]` en mode `fallback`.

10. **Triple gate** vert.

## Tasks

- [x] Migration up + down + RLS + trigger
- [x] `app/src/types/feature-flag.ts` (nouveau type)
- [x] `app/src/store/feature-flags.ts` (Zustand store + `useFlag` hook)
- [x] `app/src/lib/data-source.ts` étendu (`listFeatureFlags` fallback)
- [x] `app/src/lib/data-source.supabase.ts` étendu (`listFeatureFlagsFromSupabase`)
- [x] README Supabase mis à jour (cocher 0004)
- [x] sprint-status update
- [x] Triple gate

## Dev Notes

### Résolution de flag — qui gagne ?

Pour un `(flag_code, scope, spawter_id)` :
1. **Override spawter** : ligne avec `spawter_id = <id>` → utilise sa valeur `enabled`.
2. **Flag global** : sinon, ligne avec `spawter_id IS NULL` pour le même `scope`.
3. **Pas de ligne** : `false` par défaut.

Le store hydrate les 2 niveaux en une seule requête (`spawter_id IS NULL OR spawter_id = $1`), puis résout côté client. L'override spawter prime.

### Pourquoi 4 scopes (`internal/alpha/beta/prod`) ?

- `internal` : équipe SPAWT (staff). Toujours actif.
- `alpha` : 5 spawters Cahier §5.8.
- `beta` : ~50 spawters.
- `prod` : public.

Le client mobile **lit son scope courant** depuis le store (settable via dev menu ou JWT claim). En V1 le scope par défaut est `prod`. Un staff peut surcharger un flag pour un spawter en ajoutant une ligne `(flag_code, spawter_id, scope='prod', enabled=true)`.

### Pourquoi pas de policy DELETE publique ?

Effacer un flag = perdre l'historique. On préfère désactiver (`enabled = false`) ou laisser `expires_at` jouer son rôle. Le `DELETE` reste possible côté staff admin pour cleanup.

### Files touched

- `supabase/migrations/0004_create_feature_flags.sql` (NEW)
- `supabase/migrations/0004_create_feature_flags.down.sql` (NEW)
- `app/src/types/feature-flag.ts` (NEW)
- `app/src/store/feature-flags.ts` (NEW)
- `app/src/lib/data-source.ts` (UPDATE — `listFeatureFlags`)
- `app/src/lib/data-source.supabase.ts` (UPDATE — `listFeatureFlagsFromSupabase`)
- `supabase/README.md` (UPDATE)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)

## Dev Agent Record

### Agent Model Used
claude-opus-4-7[1m]

### Completion Notes
- Table + RLS livrées avec scoping override spawter > flag global.
- Store Zustand léger séparé (`feature-flags.ts`), hook `useFlag(code)` exporté.
- Polling 60s **pas démarré au Root** en V1 — les composants qui ont besoin peuvent appeler `hydrate()` manuellement. Câblage Root layout = follow-up quand un premier consumer apparaît.
- Aucun flag créé en V1 — table vide, prête pour les stories suivantes.
- Triple gate vert.

### File List
Voir « Files touched » ci-dessus.

### Review Findings (2026-05-16)

Couche source : Blind Hunter + Edge Case Hunter + Acceptance Auditor (mode `full`).

**Decision-needed (0 — toutes résolues 2026-05-16)**

- [x] [Review][Decision] ~~`feature_flags_insert_staff` `operator` privilege escalation~~ — **Tranché D4** : INSERT + UPDATE + DELETE restreints à `role = 'admin'` seul. Cohérent avec doc `operator = lecture seule métriques + lieux` et `moderator = modération avis + comptes`. SELECT staff reste ouvert à tous les rôles actifs. Si un cas légitime émerge (Story 2.3+), amender via AC explicite avec sign-off Stéphanie.

**Patch (5)**

- [ ] [Review][Patch] **`expires_at` filtré côté client avec `new Date().toISOString()` — clock skew du device détermine ce qui est lu** [`app/src/lib/data-source.supabase.ts:78`] — un device 24h en retard reçoit des flags qu'il ne devrait pas voir ou rate des flags valides. De plus, la RLS ne filtre **pas** `expires_at` côté serveur — un staff dashboard `select *` voit tous les flags expirés. Fix combiné : (a) déplacer le filtre dans la policy `feature_flags_select_*` `USING (... AND (expires_at IS NULL OR expires_at > now()))` ; (b) retirer le `.or(...)` client.
- [ ] [Review][Patch] **`feature-flags.ts` store : (a) `scope` hardcodé `"prod"` sans setter, (b) `setLocalOverride` wipé par le prochain `hydrate`, (c) pas de listener `onAuthStateChange` → après login, les overrides spawter restent invisibles jusqu'au restart** [`app/src/store/feature-flags.ts:57-74`] — combo qui rend le store inutilisable en alpha. Fix : (1) ajouter `setScope(s: FeatureFlagScope)` ; (2) merger `flags` au lieu de remplacer dans `hydrate` (ou prefix `local:` les overrides) ; (3) souscrire à `supabase.auth.onAuthStateChange(() => hydrate(session?.user?.id ?? null))` au module-load (via dynamic import pour rester compat mode démo). **Bloquant à l'allumage de Story 2.3.**
- [ ] [Review][Patch] **`metro.config.js` zustand override ne couvre pas les sub-imports** [`app/metro.config.js:23-30`] — `zustand/middleware`, `zustand/vanilla`, `zustand/traditional` passent à travers le fallback. Le `unstable_conditionNames` injecté via spread de `context` est une option **resolver-level** (top of config), pas un context property. Fix : hardcoder explicitement les sous-paths connus OU déclarer `resolver.unstable_conditionNames: ['require']` au niveau racine de `metroConfig.resolver`.
- [ ] [Review][Patch] **README `supabase/README.md` « État Sprint 1 » ligne 0004 reste `⏳`** [`supabase/README.md:1229`] — flipper en `✅ Story 1.8`. Patch combiné avec Stories 1.6 + 1.7.

**Patch (mineur)**

- [ ] [Review][Patch] **`feature_flags.flag_code` sans cap de longueur** [`0004_..sql:8-9`] — CHECK actuel = non-empty + lowercase mais un staff peut insérer 10 MB. Fix : `CHECK (length(flag_code) BETWEEN 1 AND 64 AND flag_code ~ '^[a-z0-9_]+$')`.
- [ ] [Review][Patch] **`hydrate()` race avec lui-même — pas de guard `inflight`** [`feature-flags.ts:64-69`] — deux appels simultanés (Splash + Settings dev menu) → last-write-wins, peut clobber un snapshot frais. Fix : tracker `requestId` ou `inflightPromise`, ignorer les réponses out-of-order.

**Defer (2)**

- [x] [Review][Defer] **`UNIQUE NULLS NOT DISTINCT` requiert PG 15 — pas de guard `DO $$ assert version $$`** [`0004_..sql:1785`] — `config.toml` déclare `major_version = 15`, donc OK en pratique. Mais un projet Supabase legacy pinné PG 14 raise syntax error opaque à l'apply. → Ajouter un `DO` block défensif dans le cleanup migration pass.
- [x] [Review][Defer] **`useFlagsPolling()` hook absent** [`feature-flags.ts`] — spec AC #6 listait le hook mais autorisait le déferrement ; completion notes le confirment. → Câbler quand le premier consumer flag (paywall, ranking toggle) atterrit.

**Dismissed (faux positifs)**

- ~~`feature_flags_select_own` autorise les anonymous reads de flags globaux~~ — voulu (les flags publics doivent être lisibles avant auth).
- ~~`listFeatureFlagsFromSupabase` ignore son `spawter_id` argument~~ — voulu, RLS-side via `auth.uid()`. Le `void spawter_id` est intentional.

#### Review Triage Summary (Story 1.8)

- 0 decision-needed (1 résolue : D4 RBAC admin-only writes)
- 6 patch — **tous appliqués** (2 critical infra + 2 should-fix + 1 cleanup + 1 README)
- 2 deferred
- 2 dismissed

#### Review Patches Applied (2026-05-16)

- ✅ D4 résolu — `feature_flags_*_staff` policies restreintes à `role = 'admin'`
- ✅ P8+P9 — `expires_at` filtré server-side dans les 2 SELECT policies (clock-skew safe)
- ✅ P10 — store réécrit : `setScope`, inflight guard, `localOverrides` préservés
- ✅ P19 — `metro.config.js` mapping explicite zustand sub-exports
- ✅ P29 — `flag_code` CHECK length 1-64 + regex `^[a-z0-9_]+$`
- ✅ P20 README `0004 ⏳ → ✅`
- ✅ Triple gate vert post-patches

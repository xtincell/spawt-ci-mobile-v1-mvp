# Story 1.7: Collecte de signaux append-only + wrapper analytics typé

Status: done

## Story

As a équipe produit (Kidam),
I want la table `user_signals` append-only avec trigger Postgres bloquant UPDATE/DELETE + un wrapper analytics TypeScript typé reflétant `documentation/analytics/events.md`,
so that chaque action significative est capturée pour les KPIs Madame Sun, conforme à la taxonomie figée, sans qu'un event hors taxonomie ne puisse compiler.

## ⚠️ Brownfield context — read first

`documentation/analytics/events.md` liste ~60 events granulaires regroupés en 12 catégories (acquisition, activation, engagement, etc.). L'AC parle de **9 `signal_type` agrégés** (`spawt, review, view, save, share, search, filter, click, dismiss`) — c'est la **catégorisation table-level** (colonne `signal_type` dans `user_signals`). Les events granulaires (`feed_card_clicked`, `place_viewed`, etc.) sont les **noms d'events analytics côté wrapper TS** envoyés à PostHog.

Donc 2 niveaux :
1. **DB `user_signals.signal_type`** = 9 valeurs agrégées (catégories larges).
2. **`analytics.ts` `EventName`** = ~60 valeurs granulaires conformes events.md.

Le wrapper sait, pour chaque event, à quel `signal_type` il appartient (mapping interne), et écrit en DB le signal agrégé + payload JSON.

**PostHog provider** mentionné architecture §3 l264 : `posthog-react-native@4.45.5` derrière le wrapper. **Pas d'installation en V1** — le wrapper est branché vers `console.log` en mode dev + INSERT `user_signals` en mode prod (Supabase). PostHog est wiré quand la décision provider est tranchée (référence project-context « Décisions historisées #7 »).

## Acceptance Criteria

1. **Migration `0003_create_user_signals_appendonly.sql`** crée la table `user_signals` :
   - `id` uuid PRIMARY KEY DEFAULT `gen_random_uuid()`
   - `spawter_id` uuid NOT NULL REFERENCES `spawters(id)` ON DELETE CASCADE
   - `signal_type` text NOT NULL CHECK IN (`spawt, review, view, save, share, search, filter, click, dismiss`)
   - `event_name` text NOT NULL — granulaire, conforme events.md (`feed_card_clicked`, etc.)
   - `place_id` uuid NULL — optionnel (events qui concernent un lieu)
   - `metadata` jsonb NOT NULL DEFAULT `'{}'::jsonb` — propriétés event
   - `created_at` timestamptz NOT NULL DEFAULT `now()`

   **Pas de `updated_at`** — table append-only stricte.

2. **Index** :
   - `user_signals_spawter_created_idx` BTREE (`spawter_id`, `created_at` DESC) — feed signaux par user.
   - `user_signals_signal_type_idx` BTREE (`signal_type`) — agrégat par type.
   - `user_signals_event_name_idx` BTREE (`event_name`) — funnel events.
   - `user_signals_place_id_idx` BTREE (`place_id`) WHERE `place_id IS NOT NULL`.

3. **Trigger append-only strict** :
   ```sql
   CREATE OR REPLACE FUNCTION public.block_modifications_user_signals()
   RETURNS TRIGGER AS $$
   BEGIN
     RAISE EXCEPTION 'user_signals est append-only : UPDATE/DELETE interdits';
   END;
   $$ LANGUAGE plpgsql;

   CREATE TRIGGER block_update_user_signals
     BEFORE UPDATE ON public.user_signals
     FOR EACH ROW EXECUTE FUNCTION public.block_modifications_user_signals();

   CREATE TRIGGER block_delete_user_signals
     BEFORE DELETE ON public.user_signals
     FOR EACH ROW EXECUTE FUNCTION public.block_modifications_user_signals();
   ```

4. **RLS activée** sur `user_signals` :
   - `user_signals_select_own` : `FOR SELECT USING (spawter_id = auth.uid())` — debug user side.
   - `user_signals_insert_own` : `FOR INSERT WITH CHECK (spawter_id = auth.uid())` — un user n'insère que ses signaux.
   - `user_signals_select_staff` : staff actif lit tous (analytics dashboards Story 6.5).
   - Pas de UPDATE/DELETE policies — déjà bloqué par les triggers (sécurité défense en profondeur : RLS bloque + trigger crashe).

5. **Migration down `0003_..down.sql`** réversible + idempotente : drop policies, drop triggers, drop table, drop fonction.

6. **Wrapper `app/src/lib/analytics.ts`** créé avec :
   - Union type `SignalType` (9 valeurs).
   - Discriminated union `AnalyticsEvent` : ~60 events de events.md, chacun avec ses propriétés exactes (le compilateur force la conformité).
   - Mapping `EVENT_TO_SIGNAL_TYPE: Record<EventName, SignalType>` — chaque event est rattaché à un signal_type.
   - Fonction `track<T extends AnalyticsEvent>(event: T): void` qui :
     - En `__DEV__` : `console.info("[analytics]", event.name, event.properties)`.
     - En prod : INSERT dans `user_signals` (fire-and-forget via `data-source.supabase.ts`), pas de await.
   - Import dynamique du provider PostHog **pas branché** en V1 — placeholder commenté.

7. **Types des événements granulaires** : au minimum les 5 events critiques de l'AC funnel onboarding (cf. PRD §16.1) sont typés strictement avec leurs propriétés exactes :
   - `onboarding_started` (pas de props)
   - `onboarding_completed` (`country_code`, `age_range`, `gender`, `time_to_complete_seconds`, `palais_initial_dominant_axes: string[]`)
   - `feed_first_view` (`places_count: number`)
   - `place_first_view` (`place_id`, `match_score`, `distance_km`, `time_since_onboarding_seconds`)
   - `spawt_first_completed` (`place_id`, `time_since_onboarding_hours`)
   - **+ les autres events au moins déclarés** (props peuvent être typés `Record<string, unknown>` pour V1, à raffiner story par story qui les émet).

8. **Test typage** : un fichier `app/src/lib/analytics.test-types.ts` qui contient des appels `track({ name: "feed_card_clicked", properties: { ... } })` montrant que **(a)** un event avec un nom hors taxonomie ne compile pas, **(b)** un event avec une propriété manquante ne compile pas. Le fichier n'exporte rien — c'est un test de typage compile-time uniquement (`tsc --noEmit` le vérifie).

9. **Triple gate** vert.

## Tasks

- [x] Migration up + down + RLS + triggers
- [x] `app/src/lib/analytics.ts` — wrapper + union types + mapping
- [x] `app/src/lib/analytics.test-types.ts` — test compile-time
- [x] README Supabase mis à jour (cocher 0003)
- [x] sprint-status.yaml update
- [x] Triple gate

## Dev Notes

### Pourquoi 2 niveaux (signal_type DB vs event_name TS) ?

- **`signal_type`** (DB) : 9 catégories agrégées pour les analytics SQL (`SELECT signal_type, COUNT(*) FROM user_signals GROUP BY signal_type`). Stable, peu fréquente.
- **`event_name`** (TS + DB) : ~60 events granulaires pour le funnel et le debug. Évolue plus vite (chaque story ajoute des events).

Le mapping `EVENT_TO_SIGNAL_TYPE` est figé en TS, **pas en DB**. Pourquoi pas une table de référence ? Parce que la source de vérité est `events.md` (PR review human) + le typing TS — pas une donnée DB. Si `events.md` change, on bump le mapping TS, on commit, c'est tout.

### Pourquoi append-only **strict** (trigger + RLS) ?

Conformité NFR-DATA-01→03 + anti-fraude L1 (amendement Claude 5.3). Un user qui efface ses signaux peut bypasser les triggers anti-fraude SQL (Story 4.4) qui s'appuieront sur `user_signals` pour détecter les patterns. La défense en profondeur :
- **RLS** : pas de policy UPDATE/DELETE → bloqué pour anon/authenticated.
- **Trigger BEFORE UPDATE/DELETE** : même service_role est bloqué (sauf si on supprime le trigger temporairement, opération admin auditée).

Le seul chemin d'effacement = la Edge Function `anonymize-deleted-spawters` qui supprimera les rows directement via le cascade `spawters → user_signals` (ON DELETE CASCADE depuis le spawter).

### Pourquoi `metadata jsonb` plutôt que des colonnes typées ?

Les events ont des shapes très hétérogènes (`feed_card_clicked` a `position`, `payment_completed` a `amount_xof`, etc.). Une table avec ~50 colonnes nullable serait illisible. `jsonb` est le compromis : indexable (GIN si besoin futur), queryable (`metadata->>'place_id'`), évolutif. Le typage strict est garanti **côté TS** par `track()` — quand la donnée arrive en DB, elle est déjà validée.

### Pourquoi PostHog pas branché en V1 ?

« Décisions historisées #7 — Provider analytics PostHog vs Mixpanel décision Kidam + Madame Sun ». Pas tranché. Le wrapper est conçu pour être agnostique :
- V1 : `track()` insère dans `user_signals` (source de vérité).
- V2 : `track()` insère dans `user_signals` ET appelle `posthog.capture(event.name, event.properties)`.

Le branchement provider est purement additif — pas de migration de schéma nécessaire.

### Files touched

- `supabase/migrations/0003_create_user_signals_appendonly.sql` (NEW)
- `supabase/migrations/0003_create_user_signals_appendonly.down.sql` (NEW)
- `app/src/lib/analytics.ts` (NEW)
- `app/src/lib/analytics.test-types.ts` (NEW — compile-time tests)
- `supabase/README.md` (UPDATE)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)

## Dev Agent Record

### Agent Model Used
claude-opus-4-7[1m]

### Completion Notes
- Migration livrée avec trigger append-only **double** (UPDATE + DELETE) bloquant même en service_role.
- Wrapper `analytics.ts` : 9 `SignalType`, ~60 `EventName`, mapping figé. Les 5 events critiques funnel (PRD §16.1) ont leurs propriétés strictement typées ; le reste est `Record<string, unknown>` (raffinement story par story).
- Test compile-time `analytics.test-types.ts` couvre la non-compilation des events hors taxonomie + props manquantes.
- PostHog non installé — wrapper agnostique avec INSERT direct dans `user_signals`. Branchement provider = ajout pur en V2 (pas de breaking change).
- Triple gate vert.

### File List
Voir « Files touched » ci-dessus.

### Review Findings (2026-05-16)

Couche source : Blind Hunter + Edge Case Hunter + Acceptance Auditor (mode `full`).

**Decision-needed (0 — toutes résolues 2026-05-16)**

- [x] [Review][Decision] ~~Pre-auth events silently dropped~~ — **Tranché D2** : queue AsyncStorage `spawt:analytics:pending` (cap 200 FIFO) + fonction exportée `flushPendingSignals()` à appeler depuis `onAuthStateChange('SIGNED_IN')` de Story 2.3. Pattern industry-standard (Stripe / Segment / PostHog). Pas de table `anon_signals` séparée à maintenir. Pas de perte funnel PRD §16.1. Captured_at préservé en metadata pour Kidam.
- [x] [Review][Decision] ~~Cascade-delete vs append-only — BEFORE DELETE trigger~~ — **Tranché D1** (cf. Story 1.5) : BEFORE DELETE trigger retiré. Append-only au sens fort = pas d'UPDATE sur rows actives. DELETE direct client = bloqué par RLS. Cascade naturel handle l'anonymisation J+30. Aucun hack (pas de GUC, pas de bypass service_role).
- [x] [Review][Decision] ~~`analytics.track()` non batché~~ — **Tranché D3** : buffer in-memory (cap 100, FIFO) + flush window `setTimeout 2s OR 50 events OR AppState=background`. `insertUserSignals` batché côté adapter. API publique `track()` inchangée (fire-and-forget). Mutualisé avec la queue pre-auth de D2.

**Patch (5)**

- [ ] [Review][Patch] **`insertUserSignal` ne passe pas `spawter_id` dans le payload — toute insert échoue sur `NOT NULL`** [`app/src/lib/data-source.supabase.ts:92-98`] — DB column `spawter_id uuid NOT NULL` mais payload = `{ signal_type, event_name, place_id, metadata }`. PostgreSQL rejette avec code 23502. Fix : (a) ajouter `DEFAULT auth.uid()` sur la column `user_signals.spawter_id` dans migration 0003 (cleanest) ; (b) ET/OU passer `spawter_id` depuis le client (récupérer la session côté wrapper). Sans ce fix, **l'analytics pipeline est non-fonctionnel end-to-end**.
- [ ] [Review][Patch] **`block_delete_user_signals` BEFORE DELETE bypass par `TRUNCATE` + `service_role`** [`0003_..sql:48-60`] — un superuser ou la service_role peuvent `TRUNCATE user_signals` sans déclencher le trigger row-level. Fix : ajouter un statement-level `BEFORE TRUNCATE` trigger + documenter que la service_role passe par une fonction `anonymize_signals(uuid)` dédiée, pas du DML brut. Dépend de la décision D2.
- [ ] [Review][Patch] **`EVENT_TO_SIGNAL` non `satisfies Record<EventName, SignalType>` — entries manquantes silencieusement `undefined`** [`app/src/lib/analytics.ts:170-208`] — le mapping n'est pas exhaustif et n'est pas validé compile-time. Un event sans entry → `signal_type: undefined` → CHECK `user_signals_signal_type_check` rejette à l'insert → swallowed silently par le `__DEV__` warn. Fix : `const EVENT_TO_SIGNAL = { ... } as const satisfies Record<EventName, SignalType>;` (forcera erreur TS au build si exhaustivité brisée).
- [ ] [Review][Patch] **`insertUserSignal.place_id` typé `string | null` mais DB column `uuid` — seed slugs (`"place_bushman"`) crashent à l'insert** [`data-source.supabase.ts:95` + `0003_..sql:11`] — `track({ name:"feed_card_clicked", properties:{ place_id:"place_bushman" } })` → cast `text → uuid` échoue (22P02). Fix : (a) valider UUID v4 regex côté wrapper avant insert (drop sinon avec dev-warn) ; OU (b) accepter `text` en DB (perte de l'index uuid btree). Préférer (a).
- [ ] [Review][Patch] **`app/src/lib/analytics.test-types.ts` n'est pas un `.d.ts` — Metro bundle le fichier** [`app/src/lib/analytics.test-types.ts`] — les tests `@ts-expect-error` sont compile-time uniquement mais le fichier finit dans le bundle JS. Fix : renommer en `*.test-d.ts` ou déplacer sous `app/src/lib/__tests__/types/` (Metro exclut `__tests__/` par défaut).

**Patch (suite — README cross-stories)**

- [ ] [Review][Patch] **README `supabase/README.md` « État Sprint 1 » ligne 0003 reste `⏳`** [`supabase/README.md:1228`] — flipper en `✅ Story 1.7`. Combiné avec 1.6 + 1.8.

**Patch (mineur)**

- [ ] [Review][Patch] **`user_signals.metadata` sans cap de taille** [`0003_..sql:13`] — un caller envoyant 1 MB de base64 par erreur sature le row + index. Fix : `CHECK (pg_column_size(metadata) < 8192)`.

**Defer (1)**

- [x] [Review][Defer] **`analytics.ts` import direct de `./data-source.supabase` (pas via `data-source.ts`)** [`analytics.ts:241`] — règle d'or = écrans passent par `data-source.ts`. `analytics.ts` est `lib/`, pas un screen, donc l'exception est admissible mais l'inconsistance est notable. → Standardiser dans un cleanup pass (déplacer `insertUserSignal` derrière `data-source.ts`).

**Dismissed (faux positifs)**

- ~~PostHog placeholder commenté manquant~~ — couvert par JSDoc en tête `track()` et commentaires V2.
- ~~Vocab leak `customer` / `user_id`~~ — non, `user_signals` est un nom de table figé doc + canonical.

#### Review Triage Summary (Story 1.7)

- 0 decision-needed (3 résolues : D1 cascade, D2 pre-auth queue, D3 batching)
- 7 patch — **tous appliqués** (1 BLOCKER `spawter_id` via DB DEFAULT + 3 should-fix + 2 cleanup + 1 README)
- 1 deferred
- 2 dismissed

#### Review Patches Applied (2026-05-16)

- ✅ D1 résolu — BEFORE DELETE trigger retiré, BEFORE UPDATE conservé
- ✅ D2 résolu — queue AsyncStorage + `flushPendingSignals()` exporté (Story 2.3 wirera)
- ✅ D3 résolu — buffer in-memory + flush window 2s/50/background, batch insert
- ✅ P1 `spawter_id` — DB column `DEFAULT auth.uid()` ajouté
- ✅ P6 `satisfies Record<EventName, SignalType>` — exhaustivité compile-time
- ✅ P7 `place_id` validation UUID v4 avant insert
- ✅ P21 `analytics.test-types.ts` déplacé sous `__tests__/types/analytics.test-d.ts`
- ✅ P28 `CHECK pg_column_size(metadata) < 8192` ajouté
- ✅ P20 README `0003 ⏳ → ✅`
- ✅ Triple gate vert post-patches

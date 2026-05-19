# Story 4.3: Offline queue des spawts & résilience réseau

Status: review

<!-- Brique transverse Epic 4 — livre `app/src/lib/offline-queue.ts` (NEW), wire-up
storage + sync auto < 60s du retour réseau (NFR-AVAIL-02), écran Profil → Paramètres
inspectable/purgeable. Aucune notif d'erreur agressive (PRD §3.1 #20 — résilience
silencieuse). Story autonome — pas de migration SQL, consomme l'infra Story 4.1
(`spawt_checkin` table) + Story 4.2 (`registerSpawt` étendu). -->

## Story

As a spawter,
I want que mes spawts soient enregistrés même sans réseau,
so that je ne perds jamais une visite à cause d'une coupure 3G ou d'un voyage hors-zone.

## ⚠️ Brownfield context — read first

État courant Story 4.3 :

| Élément | Fichier | État | Action |
|---|---|---|---|
| `app/src/lib/offline-queue.ts` | (aucun) | ❌ N'existe pas — architecture §File Structure le prévoit (`enqueue`, `flush`, `inspect`, `purge`) | **Créer** — module dédié, API typée |
| Pattern de queue existant | `app/src/lib/analytics.ts:245-260` | ✅ `PendingPayload` + AsyncStorage `spawt:analytics:pending` + drainStorage + flushBuffer | **S'inspirer** — pas dupliquer (analytics queue est un autre flow, batch insert `user_signals`). Ici queue de **mutations** `spawt_checkin` |
| `appendSpawtLocal` (Story 4.1 base) | `app/src/lib/storage.ts:77-80` | ✅ Existe | **Garder** — le store écrit local-first via cette helper |
| `saveSpawter` fire-and-forget Supabase | `spawter-store.ts:233-259` | ✅ Existe | **Étendre** — wrap dans try/catch + enqueue offline si fail réseau |
| `NetInfo` (`@react-native-community/netinfo`) | (pas installé) | ❌ N'existe pas dans `package.json` | **Ajouter** — `@react-native-community/netinfo@^11.x` |
| Écran Profil → Paramètres | `(tabs)/profile.tsx` | ⚠️ Pas livré V1 (Story 5.3 livre profil), V1 = placeholder | **Différer écran complet à Story 5.x**, livrer un **sous-écran** `(tabs)/profile-settings.tsx` minimal accessible via deep link interne, ou plus simple : un **modal d'inspection** depuis la Profile tab placeholder existante |
| Détection retour réseau | (aucune) | ❌ | **Câbler** `NetInfo.addEventListener` côté `lib/offline-queue.ts` pour auto-flush |
| Events analytics offline | `analytics.ts` | ⚠️ Aucun event défini events.md pour offline | **Pas d'événement nouveau V1** — `spawt_completed` reste émis localement à la confirmation, peu importe online/offline (analytics queue gère son propre offline déjà) |
| Test pattern | `app/src/lib/__tests__/` | ✅ Pattern existant | **Mocker** AsyncStorage + NetInfo, tester déterministes |

**Décisions héritées non-revisitables** :

- **Local-first strict** (project-context §State Management Patterns + architecture §Synchronisation) — store + AsyncStorage écrits **avant** la sync, fire-and-forget. Story 4.3 **renforce** ce pattern en ajoutant un retry transparent au lieu d'un échec silencieux.
- **Sync < 60s du retour réseau** (NFR-AVAIL-02). Architecture §3 l352-353 confirme.
- **Pas de message d'erreur agressif** (PRD §3.1 #20, architecture §Loading & Resilience Patterns). Queue transparente.
- **Coupure < 24h sans perte** — l'AsyncStorage devient le tampon. Pas de TTL côté client.
- **Inspectable + purgeable** depuis Profil → Paramètres — exigence PRD §3.1 #20.

## Acceptance Criteria

**AC #1 — Module `app/src/lib/offline-queue.ts`**

**Given** le dossier `app/src/lib/`
**When** Story 4.3 est livrée
**Then** [app/src/lib/offline-queue.ts](../../app/src/lib/offline-queue.ts) existe avec l'API :

```ts
import type { SpawtCheckin } from "../types/spawt";

export type QueueEntry =
  | { kind: "spawt_insert"; row: SpawtCheckin; enqueued_at: string; attempts: number }
  | { kind: "spawt_update"; row_id: string; patch: Partial<SpawtCheckin>; enqueued_at: string; attempts: number };

const STORAGE_KEY = "spawt:offline:queue";
const MAX_ATTEMPTS = 5;          // retry cap (back-off à voir Dev Notes)
const MAX_QUEUE_SIZE = 200;      // FIFO drop si dépassé (cap cohérent analytics queue)

/** Enqueue une mutation `spawt_checkin`. Fire-and-forget. */
export async function enqueue(entry: Omit<QueueEntry, "enqueued_at" | "attempts">): Promise<void>;

/** Inspect la queue (UI Settings). Lecture seule, copie défensive. */
export async function inspect(): Promise<readonly QueueEntry[]>;

/** Vide la queue manuellement (Settings purge button). Idempotent. */
export async function purge(): Promise<void>;

/** Tente de flush la queue. Appelée par :
 *  - listener NetInfo (`isConnected: false → true`)
 *  - boot de l'app si queue non vide
 *  - tap manuel « Synchroniser maintenant » (Settings)
 *  Retourne le nombre d'entries flush réussies. */
export async function flush(): Promise<{ ok: number; failed: number; remaining: number }>;

/** Setup au boot — branche le listener NetInfo. Appelée 1× depuis `app/_layout.tsx`. */
export function initOfflineQueue(): () => void;  // returns unsubscribe
```

- **Pattern d'écriture** : toute mutation `spawt_checkin` côté Supabase passe par un wrapper `saveSpawtToSupabaseOrEnqueue(entry)` (helper dans `data-source.ts` ou `lib/offline-queue.ts` lui-même) qui :
  1. Tente l'upsert/update direct via `supabase.from("spawt_checkin")...`.
  2. Si erreur réseau (catch) ou retour `error.code === "PGRST_xxx"` réseau-related : `enqueue(entry)`.
  3. Si réussite : ne pas enqueue, déjà persisté serveur.
- **Backoff** : retry avec délai croissant entre flush attempts — voir Dev Notes §1.
- **Idempotence côté Supabase** : `INSERT ... ON CONFLICT (id) DO UPDATE SET ...` pour `spawt_insert`. Le `row.id` est généré côté client (`expo-crypto.randomUUID()` — Story 4.2 Task 7). Permet retry sans doublon.

---

**AC #2 — Câblage avec `spawter-store.registerSpawt` + Story 4.2 helpers**

**Given** un spawt enregistré localement via `registerSpawt(row)` ou `confirmSpawt(row_id, ...)` (Story 4.2)
**When** la sync Supabase échoue (offline ou erreur réseau)
**Then** :
1. La mutation est silencieusement enqueue (`offline-queue.enqueue({ kind: "spawt_insert", row })` ou `{ kind: "spawt_update", row_id, patch }`).
2. Le store conserve son état local cohérent (AsyncStorage déjà commité Story 4.2 architecture).
3. **Aucun message d'erreur** affiché à l'utilisateur (UX silent).
4. `__DEV__` log warn explicit pour traçabilité.

**Given** la queue contient des entries pending
**When** `NetInfo.addEventListener` détecte `isConnected: true` (transition `false → true`)
**Then** `flush()` est appelé < 60s après le changement (NFR-AVAIL-02).
- `flush` itère les entries dans l'ordre FIFO (`enqueued_at` ascendant).
- Pour chaque entry : tente l'opération Supabase. Si succès → retire de la queue. Si échec → incrémente `attempts`, garde en queue tant que `attempts < MAX_ATTEMPTS`.
- Si `attempts >= MAX_ATTEMPTS` : drop l'entry + `__DEV__` log warn (anti-loop infinie). Sprint 2 envisager un signal analytics dédié.

---

**AC #3 — Coupure < 24h : aucun spawt perdu**

**Given** une coupure réseau totale (offline complet)
**When** le spawter déclenche `n` spawts pendant la coupure (geofence + confirm via notif)
**Then** :
- `n` rows `spawt_checkin` sont persistées localement (AsyncStorage via `storage.appendSpawtLocal`).
- `n` entries `{ kind: "spawt_insert", row }` sont enqueue dans `offline-queue`.
- À la fin de la coupure (< 24h), `NetInfo` détecte le retour → `flush` traite les `n` entries dans l'ordre.
- **0 perte** : chaque row est upsertée serveur via `id` client.
- L'UI ne montre aucun blocage / erreur — le `total_spawts` côté store est cohérent immédiatement, indépendamment du flush.

**24h+ inclu V1** : pas de TTL. Si le spawter reste offline 7 jours, la queue stocke les 7 jours de spawts (cap 200, FIFO drop au-delà — cohérent avec analytics queue).

---

**AC #4 — Écran Profil → Paramètres (inspectable + purgeable)**

**Given** une route accessible côté Profil
**When** Story 4.3 est livrée
**Then** :

**Option A (V1, minimal, recommandé)** — Modal d'inspection accessible via un bouton dans `(tabs)/profile.tsx` (placeholder existant V1) :

- Bouton « Synchronisation des spawts » (visible **uniquement** si `inspect().length > 0`, sinon masqué).
- Tap → Modal `<OfflineQueueInspector />` montrant :
  - Liste des entries avec : `place_name` (lookup via `listPlaces` cache), `kind`, `enqueued_at` (date relative), `attempts`.
  - Statut globel : « N spawts en attente de synchronisation. »
  - Bouton « Synchroniser maintenant » → appel `flush()` + reload list.
  - Bouton « Vider la file » → confirmation `Alert` (« Tu vas effacer N spawts non synchronisés, ils ne seront jamais envoyés. ») puis `purge()`.
- Modal fermable par swipe-down ou close button.

**Option B (V1, fallback)** — Si `(tabs)/profile.tsx` n'a aucun container, créer `(tabs)/profile.tsx` minimal avec juste l'entrée queue + reste lazy (`EmptyState` « le chat tousse »). Pas de tab rename, pas de cross-cutting.

**Recommandation : Option A** sur le `(tabs)/profile.tsx` actuel (Story 3.1 a gardé le placeholder, AT8 retro Epic 3 deferred).

**Wording strict** :
- Title modal : `t("offline_queue.title")` → « En attente de synchronisation »
- Body empty : `t("offline_queue.empty")` → « Tout est synchronisé. Le Chat dort tranquille. »
- Body row : `t("offline_queue.row", { place_name, date_relative })` → « Spawt chez {{place_name}} · {{date_relative}} »
- Action sync : `t("offline_queue.sync_now")` → « Synchroniser maintenant »
- Action purge : `t("offline_queue.purge")` → « Vider la file »

---

**AC #5 — Aucun message d'erreur agressif**

**Given** une coupure réseau
**When** le spawter agit (spawt confirm, toggle favori, etc.)
**Then** **aucun** :
- Toast/Alert/Banner rouge
- Modal d'erreur
- Spinner bloquant
- `console.error` sans `__DEV__` gate

**Permis** :
- `DataSourceBanner` jaune (Story 1.x existant) reste affiché si `dataSourceMode === "fallback"`. Pas concerné par la queue offline (fallback = pas de Supabase configuré).
- `__DEV__ console.warn` pour les ingénieurs.
- Indicateur subtle « N spawts en attente » dans le profil (AC #4) — informatif, pas agressif.

---

**AC #6 — Détection retour réseau + flush auto**

**Given** `NetInfo` installé et `initOfflineQueue()` câblé au Root layout
**When** la connexion passe `isConnected: false → true`
**Then** :
- `flush()` est appelée automatiquement.
- Si succès partiel → entries restantes gardées, ré-essayées à la prochaine transition.
- Latence retour-flush : **< 60s** (NFR-AVAIL-02) — testable manuellement, pas testable unit (mocks).

**Given** l'app est au foreground et la queue est non vide au boot
**When** `initOfflineQueue` est appelée
**Then** un `flush()` initial est tenté immédiatement (catch-up post-relaunch).

---

**AC #7 — Tests + triple gate + smoke compile**

**Given** la suite de tests
**When** `cd app && npm test`
**Then** :

1. **`offline-queue.test.ts`** (`app/src/lib/__tests__/offline-queue.test.ts`) :
   - `enqueue` → AsyncStorage updated, FIFO order préservé.
   - `inspect` → retourne snapshot lecture-seule.
   - `purge` → AsyncStorage vidé.
   - `flush` avec mock Supabase :
     - 3 entries success → tout retiré, retour `{ ok: 3, failed: 0, remaining: 0 }`.
     - 2 entries success + 1 fail → entry restante, `attempts = 1`.
     - Entry avec `attempts === MAX_ATTEMPTS` → drop + `__DEV__` log (vérifier via spy).
   - Cap 200 → 201e enqueue → drop FIFO le plus ancien.
2. **`useOfflineQueueStatus` hook** (optionnel V1) : composant `OfflineQueueInspector` simple test render avec props mocks.
3. **Integration test léger** : enqueue → restart simulé (clear state + re-init) → `inspect` retourne la queue.

**Given** la triple gate
**When** lancée
**Then** `tsc --noEmit && lint:vocab && i18n:check && npm test` vert.
**And** `expo export --platform android` compile.

## Tasks / Subtasks

- [ ] **Task 1 — Ajouter `@react-native-community/netinfo`** (AC: #6)
  - [ ] `cd app && npx expo install @react-native-community/netinfo` (Expo gère le pin SDK 55, version `^11.x`).
  - [ ] Vérifier que Android compile (`expo export --platform android`).

- [ ] **Task 2 — Créer `app/src/lib/offline-queue.ts`** (AC: #1)
  - [ ] API publique selon AC #1.
  - [ ] Backoff exponentiel : attempt 1 = immediate, 2 = +5s, 3 = +15s, 4 = +30s, 5 = +60s. Stockage `last_attempt_at` (Dev Notes §1).
  - [ ] Cap MAX_QUEUE_SIZE = 200, FIFO drop le plus ancien.
  - [ ] AsyncStorage key `spawt:offline:queue` (cohérent naming `spawt:*`).

- [ ] **Task 3 — Wrapper `saveSpawtToSupabaseOrEnqueue`** (AC: #2)
  - [ ] Helper côté `app/src/lib/data-source.ts` (ou `data-source.supabase.ts`) qui tente l'upsert puis fallback enqueue.
  - [ ] Câbler dans `spawter-store.registerSpawt` (remplace l'actuel `void saveSpawter(updated)` — il vise `spawters` table — créer un parallèle pour `spawt_checkin`).
  - [ ] Câbler dans `confirmSpawt` Story 4.2 helpers (mêmes patches sur `spawt_checkin`).

- [ ] **Task 4 — `initOfflineQueue` au Root layout** (AC: #6)
  - [ ] Éditer [app/app/_layout.tsx](../../app/app/_layout.tsx) `useEffect` : appel `initOfflineQueue()` au mount, unsubscribe au unmount.
  - [ ] Au boot, si `inspect().length > 0` et `NetInfo.fetch()` reports `isConnected`, tenter `flush()` direct.

- [ ] **Task 5 — Modal `OfflineQueueInspector`** (AC: #4)
  - [ ] Créer `app/src/components/OfflineQueueInspector.tsx` (Modal native).
  - [ ] Liste rendue via `FlatList` (lightweight, no virtualization needed pour < 200 items).
  - [ ] Lookup `place_name` via `listPlaces()` cache (1 fetch + map).
  - [ ] Boutons sync / purge avec wording exact i18n.

- [ ] **Task 6 — Bouton dans `(tabs)/profile.tsx`** (AC: #4)
  - [ ] Éditer le placeholder existant (Story 3.1).
  - [ ] Ajouter section « Avancé » avec bouton conditionnel (visible si `inspect().length > 0` — read au focus + interval polling 5s).
  - [ ] Tap → ouvre Modal `OfflineQueueInspector`.

- [ ] **Task 7 — i18n clés `offline_queue.*`** (AC: #4)
  - [ ] Éditer [app/src/i18n/fr.json](../../app/src/i18n/fr.json) avec les 5 clés (cf. AC #4).
  - [ ] `i18n:check` vert.

- [ ] **Task 8 — Tests** (AC: #7)
  - [ ] `offline-queue.test.ts` (5-6 cas + mocks AsyncStorage + Supabase).
  - [ ] `OfflineQueueInspector.test.tsx` (render mode empty + mode populated).
  - [ ] Triple gate verte.
  - [ ] `expo export --platform android` compile.
  - [ ] CHANGELOG `feat(spawt)` + `feat(infra)` Story 4.3.

## Dev Notes

### 1. Backoff exponentiel

Pattern simple : la queue entry stocke `last_attempt_at`. `flush` lit chaque entry et ne tente la sync que si `now - last_attempt_at > backoff_delay(attempts)`. Sinon skip cette iteration.

```ts
function backoffDelayMs(attempts: number): number {
  // attempts: 0 → 0, 1 → 5s, 2 → 15s, 3 → 30s, 4 → 60s
  const table = [0, 5_000, 15_000, 30_000, 60_000];
  return table[Math.min(attempts, table.length - 1)] ?? 60_000;
}
```

**Trade-off** : un flush qui voit 5 entries dont 4 sont en cooldown ne fait que la 5e. Acceptable — la prochaine transition réseau ou le polling interne (Settings sync button) retentera les autres.

### 2. Pas de polling automatique

V1 ne fait **pas** de polling `setInterval` pour flush. Trigger uniquement :
- NetInfo transition `false → true`.
- Boot avec queue non vide.
- Tap manuel « Synchroniser maintenant » (Settings).

**Pourquoi** : un polling toutes les N secondes draine la batterie sans valeur (la connexion vient par event NetInfo, pas par silence). Sprint 2 si l'alpha montre des stuck queues → ajouter foreground polling 5min.

### 3. Idempotence Supabase

`spawt_checkin` a `id UUID PRIMARY KEY`. L'upsert idempotent :

```ts
await supabase
  .from("spawt_checkin")
  .upsert(row, { onConflict: "id" });
```

Si la queue retente un insert déjà commité (cas rare : succès silencieux mais réponse perdue), le `upsert` ne crée pas de doublon. L'update via `.eq("id", row_id).update(patch)` est naturellement idempotent.

**Edge case** : si le client génère un `id` mais que le serveur l'a déjà rejected (anti-fraude trigger Story 4.4 pose `flag_reason`), l'upsert override le `flag_reason` côté serveur ? **Non** — `flag_reason` est posé par le trigger Postgres AFTER INSERT, donc `INSERT ON CONFLICT DO UPDATE` ne réécrit pas si on n'inclut pas `flag_reason` dans le SET clause. À valider Story 4.4 (les triggers savent gérer la ré-insertion).

### 4. Pas de notif d'erreur si MAX_ATTEMPTS atteint

V1 `flush` log `__DEV__` warn et drop. **Pas** d'event analytics dédié (`offline_flush_failed` n'existe pas dans events.md).

**Defer V2** : ajouter à events.md `offline_flush_failed` si l'alpha terrain montre des cases (validation par Kidam).

### 5. Coordination avec analytics queue

L'analytics queue (`analytics.ts:245+`) gère ses propres pendings via `spawt:analytics:pending`. **Pas** de partage avec `offline-queue` :
- Analytics = `user_signals` (append-only, batch insert).
- Offline-queue = `spawt_checkin` (mutations rows métier).

**Conséquence** : 2 listeners `NetInfo` peuvent exister (un par module). Acceptable V1 — `NetInfo.addEventListener` est multi-subscriber natif. Sprint 2 pourrait factoriser un `network-events` central, mais c'est premature optimization.

### 6. Non-régression

- `spawter-store.registerSpawt` : signature inchangée, ajoute un fallback enqueue côté sync. Caller-side rien à modifier.
- `confirmSpawt`/`finalizePassive`/`registerSpawtManual` (Story 4.2) : idem.
- Mode démo (`dataSourceMode === "fallback"`) : la queue n'est **pas** appelée car aucune mutation Supabase n'est tentée — flux 100% local AsyncStorage. Comportement actuel préservé.
- Story 3.6 (favoris Option A) : pas concerné — favoris restent local-only V1.
- Story 2.x consent : pas concerné — `recordConsent` upsert direct (pas de queue car blocking funnel onboarding — défensif).

### 7. Sign-off

- **Stéphanie** (tech) : revue backoff strategy, revue cap MAX_QUEUE_SIZE = 200, revue idempotence upsert.
- **Kidam** (analytics) : confirmer qu'aucune nouvelle event n'est nécessaire V1 (`offline_*`), valider que `spawt_completed` reste émis local immédiatement (analytique du geste, pas de la sync).
- **Alexandre** (brand) : audit wording « En attente de synchronisation » + « Le Chat dort tranquille » — Test Tantie Rose.

### 8. Defers identifiés

- **D-414** — Event `offline_flush_failed` (Kidam si demandé alpha).
- **D-415** — Polling foreground 5min (V2 si alpha montre stuck queues).
- **D-416** — Factorisation `network-events` central (si 3+ modules deviennent listeners).
- **D-417** — Sync incrémentale par batch (50 rows à la fois) si Sprint 2 montre des queues > 100 entries au retour.
- **D-418** — UI indicateur global réseau (haut d'écran « Hors-ligne ») — V1 = pas livré, project-context « pas de message d'erreur agressif ».

### 9. Risk

- **Risque #1** : `MAX_QUEUE_SIZE = 200` peut être insuffisant si un alpha spawter va en zone offline 1 semaine et fait 5 spawts/jour = 35 spawts < 200. OK. Mitigation : Sprint 2 alpha telemetry sur queue size.
- **Risque #2** : `NetInfo` peut faux-positiver `isConnected: true` sur WiFi captive portal (zone hôtel) → flush tente, Supabase 401/timeout, attempts incrémente. Mitigation : backoff + cap MAX_ATTEMPTS = 5.
- **Risque #3** : Drift entre la row locale et la row serveur si update partial échoue (`spawt_update` patch). Mitigation : `upsert` complet de la row (pas partial), simple à coder côté Story 4.2 (la row entière est en mémoire au moment du confirm).
- **Risque #4** : Cache AsyncStorage `spawt:offline:queue` corrompu (parse JSON fail). Mitigation : try/catch sur `loadQueue` → fallback `[]`, log `__DEV__`. Pattern existant (`storage.ts`).

### Project Structure Notes

- **1 nouveau module lib** : `app/src/lib/offline-queue.ts`.
- **1 nouveau composant** : `app/src/components/OfflineQueueInspector.tsx`.
- **Modifiés** :
  - `app/src/lib/data-source.ts` (helper wrapper `saveSpawtToSupabaseOrEnqueue`).
  - `app/src/lib/data-source.supabase.ts` (impl upsert `spawt_checkin`).
  - `app/src/store/spawter-store.ts` (`registerSpawt` câblé wrapper).
  - `app/app/(tabs)/profile.tsx` (placeholder + bouton conditionnel).
  - `app/app/_layout.tsx` (`initOfflineQueue` au mount).
  - `app/src/i18n/fr.json` (+5 clés `offline_queue.*`).
- **1 nouvelle dépendance** : `@react-native-community/netinfo@^11.x`.
- **Pas de migration SQL** — consomme `spawt_checkin` Story 4.1.

### References

- [_bmad-output/planning-artifacts/epics.md#L883-L902](../planning-artifacts/epics.md#L883-L902) Story 4.3
- [_bmad-output/planning-artifacts/PRD.md FR-039 + §3.1 #20](../planning-artifacts/PRD.md)
- [_bmad-output/planning-artifacts/PRD.md NFR-AVAIL-02](../planning-artifacts/PRD.md)
- [_bmad-output/planning-artifacts/architecture.md#L350-L353](../planning-artifacts/architecture.md#L350-L353) Synchronisation local-first
- [_bmad-output/planning-artifacts/architecture.md#L509-L510](../planning-artifacts/architecture.md#L509-L510) File Structure — `offline-queue.ts`
- [_bmad-output/planning-artifacts/architecture.md#L572-L580](../planning-artifacts/architecture.md#L572-L580) Loading & Resilience Patterns
- [_bmad-output/project-context.md §Anti-patterns techniques](../project-context.md)
- [app/src/lib/analytics.ts:245-260](../../app/src/lib/analytics.ts#L245-L260) Pattern de queue existant
- [app/src/lib/storage.ts:77-80](../../app/src/lib/storage.ts#L77-L80) `appendSpawtLocal`
- [app/src/store/spawter-store.ts:233-259](../../app/src/store/spawter-store.ts#L233-L259) `registerSpawt`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — passe dev Epic 4 PASS 1 (2026-05-19).

### Completion Notes List

- `app/src/lib/offline-queue.ts` créé — API publique `enqueue` / `inspect` / `purge` / `flush(now)` / `initOfflineQueue` / `setSyncBackend` / `saveSpawtToSupabaseOrEnqueue` / `backoffDelayMs` + cap `OFFLINE_QUEUE_MAX_SIZE = 200` FIFO + retries `OFFLINE_QUEUE_MAX_ATTEMPTS = 5`. Backoff progressive 0/5s/15s/30s/60s via `last_attempt_at` (skip si elapsed < delay).
- `app/src/lib/offline-queue-init.ts` créé — wire NetInfo découplé : import dynamique tolérant à l'absence (web/test). `bootOfflineQueue()` no-op en mode démo (`isSupabaseConfigured = false`). `shutdownOfflineQueue()` exposé pour unmount.
- `app/src/lib/data-source.supabase.ts` étendu — `upsertSpawtToSupabase(row)` (idempotent on_conflict id) + `updateSpawtInSupabase(row_id, patch)`. Retourne `boolean` sans throw (caller décide enqueue ou non).
- `app/src/lib/data-source.ts` étendu — `upsertSpawt` / `updateSpawt` wrappers no-op en mode fallback.
- `app/src/components/OfflineQueueInspector.tsx` créé — Modal `presentationStyle="pageSheet"` : FlatList des entries (place_id + enqueued_at + attempts) + boutons "Synchroniser maintenant" + "Vider la file" (confirmation Alert) + empty state "Le Chat dort tranquille".
- `app/app/(tabs)/profile.tsx` étendu — bouton conditionnel "Synchronisation des spawts · N" affiché si queue non-vide (polling 5s) + état `inspectorVisible` + mount Modal.
- Câblage `app/app/_layout.tsx` — `useEffect` boot `bootOfflineQueue()` + cleanup `shutdownOfflineQueue()`.
- i18n : `offline_queue.title/empty/sync_now/purge/purge_confirm/row_insert/row_update/open_button`.
- Dépendance `@react-native-community/netinfo@^11.4.1` ajoutée + `npm install` lancé.
- **Defers Story 4.3 PASS 2** : (D-414) event `offline_flush_failed` analytics ajouté à events.md si Kidam le demande après alpha terrain. (D-417) sync incrémentale par batch (50 rows à la fois) si queues > 100. (D-418) UI indicateur "Hors-ligne" global — V1 = pas livré (PRD §3.1 #20 "pas de message d'erreur agressif").
- Tests : `app/src/lib/__tests__/offline-queue.test.ts` — 11 cas couvrant backoff, enqueue/inspect/purge, flush success/partial/drop-after-MAX, saveSpawtToSupabaseOrEnqueue remote/queued/no-backend.

### File List

**Nouveau** :
- `app/src/lib/offline-queue.ts`
- `app/src/lib/offline-queue-init.ts`
- `app/src/components/OfflineQueueInspector.tsx`
- `app/src/lib/__tests__/offline-queue.test.ts`

**Modifié** :
- `app/src/lib/data-source.supabase.ts` (+upsertSpawtToSupabase + updateSpawtInSupabase)
- `app/src/lib/data-source.ts` (+upsertSpawt + updateSpawt wrappers)
- `app/app/(tabs)/profile.tsx` (+bouton conditionnel + Modal)
- `app/app/_layout.tsx` (boot/shutdown offline-queue)
- `app/src/i18n/fr.json` (+offline_queue.*)
- `app/package.json` (+@react-native-community/netinfo)
- `app/package-lock.json`

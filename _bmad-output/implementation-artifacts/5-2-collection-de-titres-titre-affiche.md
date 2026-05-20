# Story 5.2: Collection de titres & titre affiché

Status: ready-for-dev

<!-- Story d'identité Epic 5 — la collection est append (mémoire d'identité,
amendement 4.6) co-livrée dans la migration 0014 avec spawter_progression
(Story 5.1). Sprint 1 Drift D4 = 1 seul badge `Premier Spawt` complémentaire
(Story 4.2 déjà livrée et persiste `pendingBadge`). Pas de jalons multiples,
pas de compteur public de titres (D3 — reconnaissances non-public). Le titre
affiché = choix utilisateur libre parmi la collection (FR-008). -->

## Story

As a spawter,
I want conserver une collection permanente de titres et choisir librement celui que j'affiche,
so that mon identité m'appartient et n'est pas dictée par un algorithme — la maturité ajoute, ne soustrait jamais.

## ⚠️ Brownfield context — read first

État courant Story 5.2 :

| Élément | Fichier | État | Action |
|---|---|---|---|
| Migration `0014_create_progression_collection_titres.sql` | `supabase/migrations/` | ⚠️ Story 5.1 livre la première moitié (`spawter_progression`) | **Co-livrer** — Story 5.2 ajoute `collection_titres` dans **le même fichier** + section appariée `.down.sql` |
| `spawter_progression.current_title` colonne | (Story 5.1) | ✅ Story 5.1 alimente avec `title.<stade>` par défaut | **Consommer** — Story 5.2 enrichit le mapping (titres bonus, titre affiché distinct) |
| Badge « Premier Spawt » | [app/src/components/BadgePremierSpawt.tsx](../../app/src/components/BadgePremierSpawt.tsx) | ✅ Story 4.2 livrée — Modal + state `pendingBadge` côté store | **Intégrer** — ajouter le badge dans la collection au moment du `consumePendingBadge` (cf. AC #4) |
| Store action `unlockTitle` / `setDisplayedTitle` | [app/src/store/spawter-store.ts](../../app/src/store/spawter-store.ts) | ❌ Pas créées | **Créer** — 2 actions exportées : `unlockTitle(title_key)` (idempotent) + `setDisplayedTitle(title_key)` |
| State `collectionTitres` | spawter-store | ❌ | **Ajouter** — `collectionTitres: CollectionTitreRow[]` hydraté depuis AsyncStorage + sync Supabase |
| Stockage local `collection_titres` | [app/src/lib/storage.ts](../../app/src/lib/storage.ts) | ❌ | **Étendre** — `loadCollectionTitres()` / `saveCollectionTitresLocal()` |
| Wrappers `data-source` titres | [app/src/lib/data-source.ts](../../app/src/lib/data-source.ts) | ❌ | **Créer** — `insertTitre(row)`, `setDisplayedTitre(spawter_id, title_key)`, `listTitresForSpawter(spawter_id)` |
| Mapping `stade → title_key` (5 entrées Sprint 1) | (aucun) | ❌ | **Créer** [app/src/lib/titres-catalogue.ts](../../app/src/lib/titres-catalogue.ts) avec `STADE_TITLE_KEYS` |
| i18n `title.*` clés (titres) | [app/src/i18n/fr.json](../../app/src/i18n/fr.json) | ❌ Pas extraites (`stade.*` existent pour les labels stades, mais pas comme « titre porté ») | **Ajouter** — 5 clés `title.touriste` à `title.guide` + 1 clé `title.premier_spawt` |
| Section UI « Collection de titres » + toggle affiché | `app/app/(tabs)/profile.tsx` | ⚠️ Stub actuel (V1 = `display_name + stade + Palais radar`) | **Hors scope direct** — Story 5.3 livre l'écran complet, Story 5.2 fournit **uniquement** les actions store + i18n. Une mini-section provisoire OK V1 si Story 5.3 pas encore mergée |
| Event `title_displayed_changed` | [documentation/analytics/events.md §9](../../documentation/analytics/events.md) | ❌ Pas dans events.md — à ajouter | **Ajouter** events.md `§9 Stade & Palais` + extension `analytics.ts` `EventName` |

**Décisions héritées non-revisitables** :

- **Politique append** sur `collection_titres` (amendement 4.6, architecture §3 l287-289) — pas de DELETE, pas d'UPDATE **sauf** la colonne `is_displayed` (mise à jour 1 par spawter). Trigger SQL bloque les autres mutations.
- **`paws` non-convertible** (drift D2) — la collection de titres **n'est pas** une monnaie, pas de conversion en avantages, pas de compteur public.
- **`reconnaissances` non-public** (drift D3) — pas de feed « X spawters ont décroché le titre Y », pas de leaderboard de titres. Collection visible uniquement par son propriétaire (RLS `spawter_id = auth.uid()`).
- **Sprint 1 = 1 seul badge complémentaire `Premier Spawt`** (drift D4) — pas de Jalons multiples (« 10 spawts », « 5 cuisines différentes », etc.). Reportés V1.5+ (Story 4.2 PASS 2 a déjà figé ce périmètre).
- **5 titres de base = 5 stades** — `title.touriste`, `title.explorateur`, `title.detective`, `title.djidji`, `title.guide`. Ajoutés à la collection **à chaque montée de stade** (déclenchée par Story 5.1).
- **Titre actuel ≠ titre affiché** (PRD §3.1 FR-008 + §5.4) — `current_title` = titre lié au stade actuel (mappé auto). `is_displayed = true` sur 1 row de `collection_titres` = titre affiché (choix utilisateur, peut être un titre d'un stade antérieur ou Premier Spawt).
- **Au plus 1 titre `is_displayed = true` par spawter** — contrainte SQL via index unique partial.
- **RLS `spawter_id = auth.uid()`** sur SELECT/INSERT/UPDATE. Pas de DELETE policy.
- **Pas de gamification** — l'unlock d'un titre est silencieux côté UI Story 5.2 (la célébration de la montée de stade est Story 5.4, le badge Premier Spawt est Story 4.2). Story 5.2 livre la **data layer** + **toggle** ; les rendus visuels (carte spawter avec titre affiché) sont Story 5.3.

## Acceptance Criteria

**AC #1 — Migration `0014_create_progression_collection_titres.sql` (Story 5.2 part)**

**Given** la migration co-livrée avec Story 5.1
**When** Story 5.2 est livrée
**Then** la suite du fichier `supabase/migrations/0014_create_progression_collection_titres.sql` ajoute :

```sql
-- ============================================================================
-- Story 5.2 — Table collection_titres (append, mémoire d'identité, amendement 4.6).
-- PRD §3.1 FR-008 + §5.4 — collection permanente, titre affiché choisi par
-- le spawter, paws non-convertible (D2), reconnaissances non-public (D3),
-- Sprint 1 = 1 seul badge bonus `Premier Spawt` (D4).
-- ============================================================================
CREATE TABLE public.collection_titres (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spawter_id    uuid NOT NULL
                  REFERENCES public.spawters(id) ON DELETE CASCADE,
  /** Clé i18n du titre (ex: `title.explorateur`, `title.premier_spawt`).
   *  Pas de string FR ici — toutes les strings vivent dans fr.json. */
  title_key     text NOT NULL,
  /** Source de l'unlock — utile pour analytics + debug + futur display. */
  source        text NOT NULL DEFAULT 'stade'
                  CHECK (source IN ('stade','badge')),
  /** 1 seul titre `is_displayed = true` par spawter (contrainte unique partial). */
  is_displayed  boolean NOT NULL DEFAULT false,
  unlocked_at   timestamptz NOT NULL DEFAULT now()
);

-- Append-only : un (spawter_id, title_key) ne peut pas exister 2 fois.
CREATE UNIQUE INDEX collection_titres_unique
  ON public.collection_titres (spawter_id, title_key);

-- Contrainte « au plus 1 displayed par spawter » via index unique partial.
CREATE UNIQUE INDEX collection_titres_one_displayed
  ON public.collection_titres (spawter_id)
  WHERE is_displayed = true;

-- ━━━ Trigger append-only : interdit UPDATE sauf is_displayed, interdit DELETE ━━
-- PRD §5.4 — la collection est une mémoire d'identité, jamais retirée.
-- Le seul UPDATE autorisé est le toggle `is_displayed` (choix utilisateur).
CREATE OR REPLACE FUNCTION public.assert_collection_titres_append_only()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'collection_titres is append-only (PRD §5.4): DELETE rejected';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.title_key IS DISTINCT FROM NEW.title_key
       OR OLD.spawter_id IS DISTINCT FROM NEW.spawter_id
       OR OLD.source IS DISTINCT FROM NEW.source
       OR OLD.unlocked_at IS DISTINCT FROM NEW.unlocked_at THEN
      RAISE EXCEPTION 'collection_titres is append-only: only is_displayed can change';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_collection_titres_append_only
  BEFORE UPDATE OR DELETE ON public.collection_titres
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_collection_titres_append_only();

-- ━━━ RLS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.collection_titres ENABLE ROW LEVEL SECURITY;

CREATE POLICY collection_titres_select_own ON public.collection_titres
  FOR SELECT USING (spawter_id = auth.uid());

CREATE POLICY collection_titres_insert_own ON public.collection_titres
  FOR INSERT WITH CHECK (spawter_id = auth.uid());

CREATE POLICY collection_titres_update_own ON public.collection_titres
  FOR UPDATE
  USING (spawter_id = auth.uid())
  WITH CHECK (spawter_id = auth.uid());
-- Pas de DELETE policy : append-only + cascade depuis spawters.
```

**And** le `.down.sql` apparié drop le tout (cohérent avec Story 5.1) :

```sql
DROP TRIGGER IF EXISTS trg_collection_titres_append_only ON public.collection_titres;
DROP FUNCTION IF EXISTS public.assert_collection_titres_append_only();
DROP TABLE IF EXISTS public.collection_titres CASCADE;
-- (+ rollback Story 5.1 spawter_progression dans le même fichier)
```

---

**AC #2 — Catalogue de titres `app/src/lib/titres-catalogue.ts`**

**Given** le dossier `app/src/lib/`
**When** Story 5.2 est livrée
**Then** [app/src/lib/titres-catalogue.ts](../../app/src/lib/titres-catalogue.ts) existe :

```ts
// PRD §3.1 FR-008 + §5.4 — Catalogue des titres Sprint 1.
// Sprint 1 = 5 titres de base (1 par stade) + 1 badge bonus `Premier Spawt` (D4).
// V1.5+ ajoutera les titres d'archétype / de mue (PRD §6.3).

import type { Stade } from "../types/stade";

/** Source d'un titre (table `collection_titres.source`). */
export type TitleSource = "stade" | "badge";

export interface TitleDescriptor {
  /** Clé i18n complète (ex: `title.touriste`). */
  key: string;
  source: TitleSource;
}

/** Mapping stade → clé i18n du titre porté à ce stade. */
export const STADE_TITLE_KEYS: Record<Stade, string> = {
  touriste: "title.touriste",
  explorateur: "title.explorateur",
  detective: "title.detective",
  djidji: "title.djidji",
  guide: "title.guide",
};

/** Badge bonus Sprint 1 (drift D4 — pas d'autres jalons V1). */
export const PREMIER_SPAWT_TITLE_KEY = "title.premier_spawt";

/** Vérifie qu'une clé est connue du catalogue V1 (anti-typo + anti-drift). */
export function isKnownTitleKey(key: string): boolean {
  return (
    Object.values(STADE_TITLE_KEYS).includes(key) ||
    key === PREMIER_SPAWT_TITLE_KEY
  );
}

/** Helper : retourne le titre par défaut (= titre du stade actuel). */
export function defaultTitleKeyForStade(stade: Stade): string {
  return STADE_TITLE_KEYS[stade];
}
```

**And** un snapshot test `app/src/lib/__tests__/titres-catalogue.test.ts` fige les 6 clés (5 stades + Premier Spawt) — toute extension passe par une review explicite (Alexandre brand).

---

**AC #3 — Types + storage local**

**Given** le dossier `app/src/types/`
**When** Story 5.2 est livrée
**Then** un type est exporté :

```ts
// app/src/types/collection-titres.ts (nouveau fichier)

import type { TitleSource } from "../lib/titres-catalogue";

export interface CollectionTitreRow {
  id: string;
  spawter_id: string;
  title_key: string;
  source: TitleSource;
  is_displayed: boolean;
  unlocked_at: string;
}
```

**And** [app/src/lib/storage.ts](../../app/src/lib/storage.ts) est étendu :

```ts
// app/src/lib/storage.ts (extension)
const COLLECTION_TITRES_KEY = "spawt:collection_titres";

export async function loadCollectionTitres(): Promise<CollectionTitreRow[]> {
  try {
    const raw = await AsyncStorage.getItem(COLLECTION_TITRES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CollectionTitreRow[];
  } catch { return []; }
}

export async function saveCollectionTitresLocal(list: CollectionTitreRow[]): Promise<boolean> {
  try {
    await AsyncStorage.setItem(COLLECTION_TITRES_KEY, JSON.stringify(list));
    return true;
  } catch (err) {
    if (__DEV__) console.warn("[storage] saveCollectionTitres failed", err);
    return false;
  }
}
```

**And** `loadCollectionTitres()` est appelé dans `hydrate()` (`spawter-store`) en parallèle des autres `Promise.all`.

---

**AC #4 — Actions store `unlockTitle` + `setDisplayedTitle`**

**Given** le store `spawter-store`
**When** Story 5.2 est livrée
**Then** deux actions sont exportées :

```ts
// app/src/store/spawter-store.ts (extension)

interface SpawterStore {
  // ... existing
  collectionTitres: CollectionTitreRow[];
  /**
   * Story 5.2 — Débloque un titre dans la collection (append idempotent).
   * Si la `title_key` existe déjà pour ce spawter, no-op silencieux (l'index
   * unique SQL gate aussi côté serveur).
   *
   * @returns true si une ligne a été ajoutée, false si idempotent skip.
   */
  unlockTitle: (title_key: string, source: TitleSource) => Promise<boolean>;
  /**
   * Story 5.2 — Définit le titre affiché. Doit exister dans la collection
   * (sinon no-op + `__DEV__` warn). Reset tous les autres `is_displayed`.
   */
  setDisplayedTitle: (title_key: string) => Promise<void>;
}
```

**Comportement `unlockTitle`** :

1. Lit `spawter = get().spawter`. Si null → no-op + `__DEV__` warn (cohérent pattern `applyReviewToPalais`).
2. Vérifie `isKnownTitleKey(title_key)` du catalogue. Si inconnu → no-op + warn (anti-drift).
3. Lit `collectionTitres = get().collectionTitres`. Si une row matche `(spawter_id, title_key)` → no-op, retourne `false`.
4. Crée la row : `{ id: randomUUID(), spawter_id: spawter.id, title_key, source, is_displayed: false, unlocked_at: now() }`.
5. Append local AsyncStorage via `saveCollectionTitresLocal([...collectionTitres, row])`.
6. Fire-and-forget Supabase via `void data-source.insertTitre(row).catch(...)`.
7. Set Zustand state : `set({ collectionTitres: [...collectionTitres, row] })`.
8. Retourne `true`.

**Comportement `setDisplayedTitle`** :

1. Lit `spawter` + `collectionTitres`. Si spawter null → no-op + warn.
2. Cherche `target = list.find(r => r.title_key === title_key && r.spawter_id === spawter.id)`. Si absent → no-op + `__DEV__` warn (anti-state-corruption).
3. Capture `fromKey = list.find(r => r.is_displayed)?.title_key ?? null` (pour analytics).
4. Construit `updated = list.map(r => ({ ...r, is_displayed: r.id === target.id }))`.
5. Persist local + fire-and-forget Supabase `void data-source.setDisplayedTitre(spawter.id, title_key)`.
6. Émet `analytics.track({ name: "title_displayed_changed", properties: { from: fromKey, to: title_key } })`.
7. Set state.

**And** la sync « `current_title` côté `spawter_progression` » : quand `setDisplayedTitle` est appelée, Story 5.2 **n'écrit pas** `spawter_progression.current_title` (Story 5.1 alimente avec `title.<stade>` mais c'est désormais sémantiquement « titre actuel calculé » — distinct du titre affiché). Le titre affiché est tracé via `collection_titres.is_displayed`. Cohérent PRD §3.1 FR-008 (« titre actuel et titre affiché (peuvent différer) »).

---

**AC #5 — Câblage Story 5.1 → unlock auto à montée de stade**

**Given** Story 5.1 détecte un franchissement de seuil et émet `stade_unlocked`
**When** Story 5.2 est livrée
**Then** **après** le `track("stade_unlocked")` dans `registerSpawt`, un appel fire-and-forget :

```ts
// app/src/store/spawter-store.ts — extension dans registerSpawt
// (juste après l'émission stade_unlocked Story 5.1)

if (stadeChanged) {
  // ... track stade_unlocked (Story 5.1)
  // Story 5.2 — append le titre du nouveau stade à la collection (idempotent).
  void get()
    .unlockTitle(STADE_TITLE_KEYS[updated.stade], "stade")
    .catch((err) => {
      if (__DEV__) console.warn("[spawter-store] unlockTitle stade failed", err);
    });
}
```

**And** câblage Story 4.2 → Story 5.2 pour le badge Premier Spawt :

```ts
// app/src/store/spawter-store.ts — extension dans consumePendingBadge

consumePendingBadge: async () => {
  set({ pendingBadge: null });
  // Story 5.2 — ajoute le titre Premier Spawt à la collection (D4 — 1 seul badge V1).
  void get()
    .unlockTitle(PREMIER_SPAWT_TITLE_KEY, "badge")
    .catch((err) => {
      if (__DEV__) console.warn("[spawter-store] unlockTitle badge failed", err);
    });
  try {
    await AsyncStorage.setItem(BADGE_CELEBRATED_KEY, new Date().toISOString());
  } catch (err) {
    if (__DEV__) console.warn("[spawter-store] consumePendingBadge flag write failed", err);
  }
},
```

**And** un test couvre :
- Premier `registerSpawt` qui franchit 11 spots → 1 row ajoutée à `collectionTitres` (`title.explorateur`, source `stade`).
- Re-jouer le même franchissement → idempotent (pas de doublon, retourne `false`).
- `consumePendingBadge` → 1 row ajoutée (`title.premier_spawt`, source `badge`).

---

**AC #6 — Wrappers `data-source` + types Supabase**

**Given** [app/src/lib/data-source.ts](../../app/src/lib/data-source.ts)
**When** Story 5.2 est livrée
**Then** trois wrappers sont exposés :

```ts
// app/src/lib/data-source.ts (extension)

export async function insertTitre(row: CollectionTitreRow): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { insertTitreToSupabase } = await import("./data-source.supabase");
  await insertTitreToSupabase(row);
}

export async function setDisplayedTitre(
  spawter_id: string,
  title_key: string,
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { setDisplayedTitreInSupabase } = await import("./data-source.supabase");
  await setDisplayedTitreInSupabase(spawter_id, title_key);
}

export async function listTitresForSpawter(
  spawter_id: string,
): Promise<CollectionTitreRow[]> {
  if (!isSupabaseConfigured) return [];
  const { listTitresFromSupabase } = await import("./data-source.supabase");
  return listTitresFromSupabase(spawter_id);
}
```

**And** côté `data-source.supabase.ts`, la fonction `setDisplayedTitreInSupabase` doit faire **deux UPDATE en séquence** (le trigger SQL autorise les UPDATE sur `is_displayed` mais l'index unique partial bloque si 2 rows sont true simultanément) :

```ts
// app/src/lib/data-source.supabase.ts (extension)

export async function setDisplayedTitreInSupabase(
  spawter_id: string,
  title_key: string,
): Promise<void> {
  // Étape 1 — reset tous les autres titres affichés (peut être 0 ou 1 row).
  const r1 = await supabase
    .from("collection_titres")
    .update({ is_displayed: false })
    .eq("spawter_id", spawter_id)
    .eq("is_displayed", true)
    .neq("title_key", title_key);
  if (r1.error && __DEV__) {
    console.warn("[data-source] setDisplayedTitre reset failed", r1.error);
  }
  // Étape 2 — set le nouveau titre affiché.
  const r2 = await supabase
    .from("collection_titres")
    .update({ is_displayed: true })
    .eq("spawter_id", spawter_id)
    .eq("title_key", title_key);
  if (r2.error && __DEV__) {
    console.warn("[data-source] setDisplayedTitre set failed", r2.error);
  }
}
```

**Edge case race** : si 2 clients différents (rare en pratique — 1 device par spawter alpha) toggle simultanément, l'index unique partial peut rejeter le 2e set. **Mitigation V1** : silent fail acceptable, l'UI rafraîchit au prochain hydrate. Sprint 2 = transaction Edge Function (defer D-512).

---

**AC #7 — i18n + events.md**

**Given** le fichier [app/src/i18n/fr.json](../../app/src/i18n/fr.json)
**When** Story 5.2 est livrée
**Then** la section `title.*` est ajoutée :

```json
"title": {
  "touriste": "Touriste",
  "explorateur": "Explorateur",
  "detective": "Détective",
  "djidji": "Djidji",
  "guide": "Guide",
  "premier_spawt": "Premier Spawt"
}
```

**Note** : ces strings sont identiques aux labels `stade.*` côté FR — c'est volontaire (le titre par défaut = nom du stade). Sprint 2+ pourra dériver (titres d'archétype/mue, e.g. `title.detective.maquis` = « Détective Maquis »).

**And** [documentation/analytics/events.md §9](../../documentation/analytics/events.md) ajoute :

```md
| `title_displayed_changed` | Toggle d'un titre affiché parmi la collection | `from` (i18n key | null), `to` (i18n key) |
```

**And** [app/src/lib/analytics.ts](../../app/src/lib/analytics.ts) ajoute :
- `"title_displayed_changed"` dans `EventName`.
- Entry `title_displayed_changed: "click"` dans `EVENT_TO_SIGNAL`.

---

**AC #8 — Garde-fous Contrat à la Tribu (drifts D2/D3/D4)**

**Given** la collection est implémentée
**When** Story 5.2 est livrée
**Then** **aucun** des patterns suivants n'apparaît dans le code :

- ❌ **Compteur public de titres** : pas de UI « X spawters ont décroché Y », pas de RLS qui ouvrirait le SELECT à d'autres spawters.
- ❌ **`paws` ou compteur convertible** : pas de colonne `paws` ajoutée, pas de logique d'avantage Gold via la collection.
- ❌ **Jalons multiples** Sprint 1 : `unlockTitle` n'est appelée que via les 2 callers `registerSpawt` (stade) et `consumePendingBadge` (badge Premier Spawt). Tout autre caller V1 = rejet review.
- ❌ **Animation gamifiée** Duolingo-style à l'unlock : `unlockTitle` est **silencieux** côté UI. La célébration de la montée de stade est Story 5.4 (et reste solennelle), le badge Premier Spawt est Story 4.2 (déjà livré, quasi-rituel).

**And** un test snapshot fige `STADE_TITLE_KEYS` + `PREMIER_SPAWT_TITLE_KEY` — extension Sprint 2 doit passer par PR + review explicite Alexandre.

---

**AC #9 — Tests + triple gate + smoke**

**Given** la suite de tests
**When** `cd app && npm test`
**Then** :

1. **`titres-catalogue.test.ts`** — snapshot des 6 clés + `isKnownTitleKey` returns true/false correctement.
2. **`spawter-store-titres.test.ts`** (nouveau) :
   - `unlockTitle("title.explorateur", "stade")` sur collection vide → row ajoutée, return `true`.
   - Re-jouer `unlockTitle("title.explorateur", "stade")` → return `false`, no duplicate.
   - `unlockTitle("title.invalid", "stade")` → warn + no-op.
   - `setDisplayedTitle("title.explorateur")` après unlock → `is_displayed: true` sur cette row, `false` sur les autres.
   - `setDisplayedTitle("title.touriste")` puis `setDisplayedTitle("title.explorateur")` → exactly 1 displayed.
   - `setDisplayedTitle("title.notunlocked")` → no-op + warn.
   - Event `title_displayed_changed` émis avec `from`/`to`.
3. **`spawter-store-stade.test.ts`** (étendu Story 5.1) :
   - Montée 11 spots → 1 row ajoutée (`title.explorateur`, source `stade`).
   - Montée 21 spots → 2 rows total (`title.explorateur` + `title.detective`).
4. **`spawter-store-premier-spawt.test.ts`** (étendu Story 4.2) :
   - `consumePendingBadge` → 1 row `title.premier_spawt` ajoutée.

**Given** la triple gate
**When** lancée
**Then** `tsc --noEmit && lint:vocab && i18n:check && npm test` vert.
**And** `expo export --platform android` compile (smoke).

## Tasks / Subtasks

- [ ] **Task 1 — Étendre migration `0014_create_progression_collection_titres.sql`** (AC: #1)
  - [ ] Section `CREATE TABLE collection_titres` + 2 unique indexes (`(spawter_id, title_key)` + partial `is_displayed`).
  - [ ] Fonction + trigger `assert_collection_titres_append_only` (rejette DELETE + UPDATE sauf is_displayed).
  - [ ] RLS 3 policies (SELECT/INSERT/UPDATE own).
  - [ ] `.down.sql` complet (rollback Story 5.1 + 5.2).

- [ ] **Task 2 — Créer `app/src/lib/titres-catalogue.ts`** (AC: #2)
  - [ ] `STADE_TITLE_KEYS`, `PREMIER_SPAWT_TITLE_KEY`, `isKnownTitleKey`, `defaultTitleKeyForStade`.
  - [ ] Snapshot test `titres-catalogue.test.ts`.

- [ ] **Task 3 — Créer `app/src/types/collection-titres.ts`** (AC: #3)
  - [ ] `CollectionTitreRow` type.

- [ ] **Task 4 — Étendre `app/src/lib/storage.ts`** (AC: #3)
  - [ ] `loadCollectionTitres()` + `saveCollectionTitresLocal()`.
  - [ ] Constante `COLLECTION_TITRES_KEY = "spawt:collection_titres"`.

- [ ] **Task 5 — Étendre `spawter-store`** (AC: #4, #5)
  - [ ] State `collectionTitres: CollectionTitreRow[]` + hydrate.
  - [ ] Actions `unlockTitle(key, source)` + `setDisplayedTitle(key)`.
  - [ ] Câblage `registerSpawt` (stade up → `unlockTitle(STADE_TITLE_KEYS[stade], "stade")`).
  - [ ] Câblage `consumePendingBadge` (→ `unlockTitle(PREMIER_SPAWT_TITLE_KEY, "badge")`).
  - [ ] `reset` étendu pour clear `collectionTitres`.

- [ ] **Task 6 — Étendre `data-source.ts` + `data-source.supabase.ts`** (AC: #6)
  - [ ] `insertTitre(row)`, `setDisplayedTitre(spawter_id, title_key)`, `listTitresForSpawter(spawter_id)`.
  - [ ] Implémentation Supabase : `insertTitreToSupabase` upsert simple, `setDisplayedTitreInSupabase` 2-UPDATE séquentiel.
  - [ ] Catch interne + warn `__DEV__`.

- [ ] **Task 7 — Analytics + i18n + events.md** (AC: #7)
  - [ ] `analytics.ts` : ajouter `"title_displayed_changed"` dans `EventName` + entry dans `EVENT_TO_SIGNAL` (signal_type `"click"`).
  - [ ] `fr.json` : section `title.*` (6 clés).
  - [ ] `events.md` §9 : nouvelle ligne `title_displayed_changed`.

- [ ] **Task 8 — Tests + triple gate + smoke** (AC: #9)
  - [ ] `titres-catalogue.test.ts` (snapshot).
  - [ ] `spawter-store-titres.test.ts` (7-8 cas).
  - [ ] Extension `spawter-store-stade.test.ts` + `spawter-store-premier-spawt.test.ts`.
  - [ ] Triple gate verte.
  - [ ] CHANGELOG `feat(stade)` Story 5.2.

## Dev Notes

### 1. Décision D1 — `current_title` (Story 5.1) reste « titre du stade »

Sémantique côté serveur :
- `spawter_progression.current_title` = **titre du stade actuel** (auto-mappé, identique à `STADE_TITLE_KEYS[stade]` après Story 5.1).
- `collection_titres.is_displayed = true` = **titre affiché** (choix utilisateur libre).

Ces deux notions peuvent diverger (PRD §3.1 FR-008 « titre actuel et titre affiché (peuvent différer) »). Story 5.2 **n'écrit pas** `spawter_progression.current_title` quand `setDisplayedTitle` est appelée — la divergence est portée par `is_displayed`. Le panel admin (Story 6.x) saura faire la différence : `current_title` pour la cohorte stade, `is_displayed` pour l'identité projetée.

**Trade-off** : un futur dev pourrait être tenté de réécrire `spawter_progression.current_title` au changement de titre affiché. Documenté en commentaire migration + Dev Notes.

### 2. Décision D2 — Append-only via trigger SQL (pas via revoke RLS)

Alternative envisagée : RLS sans UPDATE/DELETE policy → impossibilité d'écrire. **Rejetée** car nécessite le toggle `is_displayed` (donc UPDATE autorisé). Solution retenue : RLS autorise UPDATE/INSERT, **trigger** bloque les UPDATEs hors `is_displayed` et tous les DELETE.

**Mérite** : défense en profondeur. Un bug client qui modifierait `title_key` ou `source` est silencieusement rejeté serveur. **Trade-off** : le client doit gérer la possible erreur (catch + warn `__DEV__`). Pattern aligné avec `assert_consent_set_once` (Story 2.2 round 3).

### 3. Décision D3 — `setDisplayedTitre` 2-UPDATE séquentiel (vs transaction)

L'index unique partial `WHERE is_displayed = true` rejette si on essaie de set 2 rows à `true` simultanément. Solution naive : `UPDATE ... SET is_displayed = false WHERE spawter_id = X AND is_displayed = true` puis `UPDATE ... SET is_displayed = true WHERE spawter_id = X AND title_key = Y`.

**Trade-off** : fenêtre micro-temps entre les 2 UPDATEs où le spawter n'a pas de titre affiché. **Acceptable V1** :
- Aucun lecteur public ne lit `collection_titres` (RLS = own only).
- Le SELECT côté UI passe par le state Zustand local, qui est synchrone.

**V2** : Edge Function `set-displayed-titre` wrappant les 2 UPDATEs dans une transaction. Tracé D-512.

### 4. Décision D4 — Sprint 1 = 1 badge, pas de système d'unlock générique

PRD §6.3 mentionne 7 badges potentiels (Coup de Cœur, Pépite Vérifiée, Institution, Fidélité, Découverte, Table Diverse, Noctambule Vérifié) — **mais** ce sont des badges **lieux**, pas spawters. Le badge spawter « Premier Spawt » est le **seul** Sprint 1 (D4 explicite dans Story 4.2).

**Conséquence Story 5.2** : `unlockTitle` n'a que 2 callers V1 (montée stade, consume badge). Une extension Sprint 2 (Jalons « 10 spawts », « 5 cuisines », etc.) ajoutera de nouveaux callers — pas de changement de signature `unlockTitle`. La function est **prête pour l'extension** sans refactor (clé i18n + source + catalogue).

### 5. Décision D5 — Pas d'UI Story 5.2

Story 5.2 livre :
- ✅ Migration SQL (collection_titres).
- ✅ Catalogue (constants).
- ✅ Storage local + types.
- ✅ Actions store.
- ✅ Sync Supabase.
- ✅ i18n + events.md.

Story 5.2 **ne livre pas** :
- ❌ Section « Collection de titres » dans le profil → Story 5.3 (écran profil complet).
- ❌ Toggle UI « choisir titre affiché » → Story 5.3 (carte spawter flip + actions de profil).
- ❌ Célébration unlock titre → Story 5.4 (mais le ton reste silencieux pour Story 5.2 — la célébration de la montée de stade Story 5.4 implicitement « célèbre » aussi le nouveau titre, et le badge Premier Spawt Story 4.2 est l'autre moment).

**Conséquence** : Story 5.2 est mergeable même si Story 5.3 n'est pas encore prête — la collection se peuple en background, lisible via debug tool ou état Zustand directement.

### 6. Edge cases

| Scenario | Comportement |
|---|---|
| Spawter sans aucun titre déverrouillé (juste finalize onboarding, 0 spawts) | `collectionTitres = []`. Pas de titre `is_displayed`. UI fallback : `defaultTitleKeyForStade(spawter.stade) = "title.touriste"` |
| Spawter qui régresse côté `unique_spots` (anti-fraude tardif) | `stade` reste figé (Story 5.1 invariant). Pas de titre retiré (append-only). Le titre actuel = titre du stade figé, cohérent |
| Race : `consumePendingBadge` appelée 2× rapidement (double tap) | Premier appel : ajoute le titre + reset le flag AsyncStorage. Deuxième appel : `unlockTitle` idempotent (no-op), flag déjà set. Pas de doublon |
| Spawter Gold (V1.5+) | `+1 bonus Coup de Cœur` documenté PRD §3.1 Feature 12 — **pas un titre**, mais un quota. Hors scope Story 5.2 |
| Mode démo / offline | `unlockTitle` met le state local + AsyncStorage. `insertTitre` Supabase no-op. La row sera **perdue côté serveur** au prochain mode live (pas de retry V1). **Acceptable** alpha 5 spawters |

### 7. Performance

- `unlockTitre` : O(N) sur `collectionTitres.length` (find pour dedup). N ≤ 6 V1 → négligeable. Sprint 2 si N croît : `Set`.
- `setDisplayedTitle` : O(N) map. Négligeable.
- AsyncStorage write : ~10ms (déjà absorbé par les autres écritures).
- Supabase upsert : fire-and-forget — 0ms UX.

### 8. Sign-off

- **Stéphanie** (tech) : revue trigger append-only (test SQL manuel de rejet DELETE + UPDATE non-`is_displayed`), revue 2-UPDATE séquentiel pour displayed (race accepté V1), revue `.down.sql` réversibilité.
- **Kidam** (analytics) : confirmer `title_displayed_changed` properties (`from`/`to` = clé i18n string ou null), confirmer ajout events.md §9. Pas de KPI funnel direct V1 — mais utile cohorte « spawters qui personnalisent leur titre ».
- **Alexandre** (brand) : audit catalogue 6 titres (`STADE_TITLE_KEYS` + `PREMIER_SPAWT_TITLE_KEY`), Test Tantie Rose sur les strings FR (« Détective », « Djidji », « Guide » sonnent SPAWT — pas générique). Confirmer **pas de jalons multiples** V1 (D4 figé). Confirmer **pas de compteur public** (D3 figé).

### 9. Defers identifiés

- **D-511** — Catalogue de titres d'archétype/mue Sprint 2 (PRD §6.3) : `title.<archetype>.<mue>` (ex: `title.detective_maquis.expert`).
- **D-512** — Edge Function transactionnelle `set-displayed-titre` (élimine la fenêtre 2-UPDATE).
- **D-513** — Retry queue côté `data-source.titres` au retour de connectivité (V1 = pas de retry).
- **D-514** — Jalons multiples (Story 5.2 PASS 2 si Alexandre demande à V1) — non-bloquant Sprint 1 (D4).
- **D-515** — Trigger SQL recompute auto à montée de stade (au lieu de client-driven) — server-authoritative.

### 10. Risk

- **Risque #1** — Trigger append-only rejette un UPDATE légitime futur (Sprint 2 ajoute un champ mutable). **Mitigation** : la fonction `assert_collection_titres_append_only` liste explicitement les champs immutables ; Sprint 2 ajoutera le champ aux exceptions.
- **Risque #2** — Index unique partial `is_displayed = true` rejette le 2e UPDATE si l'ordre est inversé (set avant reset). **Mitigation** : ordre figé dans `setDisplayedTitreInSupabase` (reset d'abord, set ensuite).
- **Risque #3** — Mode démo : la collection grandit côté client mais n'est jamais persistée côté serveur. Reinstall = perte. **Acceptable** (mode démo = pas un vrai usage).
- **Risque #4** — i18n keys `title.*` collisent avec `stade.*` côté FR (mêmes strings). **Acceptable** — c'est volontaire V1, l'indirection permet la dérivation Sprint 2.

### Project Structure Notes

- **2 fichiers SQL co-livrés** : extension `0014_create_progression_collection_titres.sql` + `.down.sql` (avec Story 5.1).
- **1 nouveau fichier TS** : `app/src/lib/titres-catalogue.ts`.
- **1 nouveau fichier TS** : `app/src/types/collection-titres.ts`.
- **1 fichier modifié** : `app/src/lib/storage.ts` (+ `loadCollectionTitres` / `saveCollectionTitresLocal`).
- **1 fichier modifié** : `app/src/lib/data-source.ts` (+ 3 wrappers).
- **1 fichier modifié** : `app/src/lib/data-source.supabase.ts` (+ 3 impls Supabase).
- **1 fichier modifié** : `app/src/store/spawter-store.ts` (+ state + 2 actions + câblage).
- **1 fichier modifié** : `app/src/lib/analytics.ts` (+ `title_displayed_changed` EventName + signal_type).
- **1 fichier modifié** : `app/src/i18n/fr.json` (+ section `title.*` 6 clés).
- **1 fichier modifié** : `documentation/analytics/events.md` (+ ligne §9).
- **3 fichiers tests** : `titres-catalogue.test.ts`, `spawter-store-titres.test.ts`, extension `spawter-store-stade.test.ts`.
- **Pas de modif UI** — Story 5.3 livre l'écran.

### References

- [_bmad-output/planning-artifacts/epics.md#L1013-L1032](../planning-artifacts/epics.md#L1013-L1032) Story 5.2
- [_bmad-output/planning-artifacts/PRD.md §3.1 FR-008 + §5.4](../planning-artifacts/PRD.md) Profil spawter (titre actuel / titre affiché) + collection titres
- [_bmad-output/planning-artifacts/PRD.md §20.1](../planning-artifacts/PRD.md) Contrat à la Tribu (anti-leaderboard)
- [_bmad-output/planning-artifacts/architecture.md#L281-L289](../planning-artifacts/architecture.md#L281-L289) Historisation append vs overwrite vs append-only
- [_bmad-output/planning-artifacts/architecture.md#L697](../planning-artifacts/architecture.md#L697) Migration 0014 groupée
- [_bmad-output/planning-artifacts/architecture.md#L755](../planning-artifacts/architecture.md#L755) Frontière historisation
- [_bmad-output/project-context.md §Vocabulaire SPAWT + §Anti-patterns produit](../project-context.md)
- [_bmad-output/implementation-artifacts/5-1-progression-par-stades-recompute.md](5-1-progression-par-stades-recompute.md) Migration co-livrée
- [_bmad-output/implementation-artifacts/4-2-notification-le-guet-confirmation-du-spawt-badge-premier-spawt.md](4-2-notification-le-guet-confirmation-du-spawt-badge-premier-spawt.md) Badge Premier Spawt
- [documentation/analytics/events.md §9](../../documentation/analytics/events.md) Stade & Palais (à étendre)
- [app/src/store/spawter-store.ts:107-114](../../app/src/store/spawter-store.ts#L107-L114) `consumePendingBadge` (à étendre)
- [app/src/store/spawter-store.ts:271-324](../../app/src/store/spawter-store.ts#L271-L324) `registerSpawt` (à étendre — câblage Story 5.1)
- [app/src/types/stade.ts](../../app/src/types/stade.ts) `STADE_DESCRIPTORS`, `Stade`
- [supabase/migrations/0008_create_user_palais.sql](../../supabase/migrations/0008_create_user_palais.sql) Pattern référence (RLS + trigger)

## Dev Agent Record

### Agent Model Used

_(à compléter au moment de la dev)_

### Debug Log References

_(à compléter)_

### Completion Notes List

_(à compléter)_

### File List

_(à compléter)_

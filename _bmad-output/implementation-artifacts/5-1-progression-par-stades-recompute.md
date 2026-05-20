# Story 5.1: Progression par stades & recompute

Status: ready-for-dev

<!-- Story d'ouverture Epic 5 — branche le compute client EXISTANT
(spawter-store.registerSpawt déjà total : recompute `unique_spots` + `getStade`
+ `maxStade` invariant ne-recule-jamais) sur une nouvelle table serveur
`spawter_progression` (politique overwrite, amendement 4.6). Émet l'event
`stade_unlocked` aux 4 seuils. Pas d'UI ici (Story 5.4 livre la célébration).
Story 5.2 partage la même migration 0014 (collection_titres co-située). -->

## Story

As a spawter,
I want progresser automatiquement à travers les 5 stades selon mes spots uniques,
so that ma maturité dans la Meute reflète mon exploration réelle et reste persistée côté serveur sans jamais reculer.

## ⚠️ Brownfield context — read first

État courant Story 5.1 :

| Élément | Fichier | État | Action |
|---|---|---|---|
| `getStade(unique_spots)` | [app/src/types/stade.ts](../../app/src/types/stade.ts) | ✅ Existe — bornes 0/11/21/31/51, totalité | **Consommer** — invariant numérique figé |
| `maxStade(current, candidate)` | [app/src/types/stade.ts:96-100](../../app/src/types/stade.ts#L96-L100) | ✅ Existe — protection ne-recule-jamais côté TS | **Consommer** — gate déjà câblée par registerSpawt |
| `STADE_DESCRIPTORS` (label, behavior, reviewWeight, coupsDeCoeurBase) | [app/src/types/stade.ts:26-77](../../app/src/types/stade.ts#L26-L77) | ✅ Existe | **Consommer** — pas de modif |
| `spawter-store.registerSpawt` | [app/src/store/spawter-store.ts:271-324](../../app/src/store/spawter-store.ts#L271-L324) | ✅ Compute `unique_spots` + `stade` à chaque spawt, applique `maxStade`, persiste local + `saveSpawter` fire-and-forget | **Étendre** — détecter franchissement de seuil, émettre `stade_unlocked`, sync `spawter_progression` |
| Table `spawter_progression` | (aucune migration) | ❌ Pas créée — l'arch §3 l281, l288, l697 la déclare | **Créer** migration `0014_create_progression_collection_titres.sql` (table + RLS + trigger ne-recule-jamais + collection_titres Story 5.2) |
| Event `stade_unlocked` | [app/src/lib/analytics.ts:167](../../app/src/lib/analytics.ts#L167) | ✅ Déclaré dans `EventName` + mappé `signal_type: "review"` | **Émettre** — properties `{ from_stade, to_stade, unique_spots }` |
| Wrapper `data-source.upsertProgression` | [app/src/lib/data-source.ts](../../app/src/lib/data-source.ts) | ❌ Pas créé | **Créer** — wrapper local-first fire-and-forget Supabase upsert |
| Spawter persisté côté serveur (`saveSpawter`) | [app/src/lib/data-source.ts:68-75](../../app/src/lib/data-source.ts#L68-L75) | ✅ Existe — upsert `spawters` row inclut `stade` + `unique_spots` + `total_spawts` | **Préserver** — `spawter_progression` est un **miroir overwrite** dédié, pas un remplacement (architecture §3 l281 — table dédiée + colonne `current_title` Story 5.2) |
| UI célébration | (aucune) | ❌ | **Hors scope** — Story 5.4 livre `StadeCelebration` |
| Voix Chat `stade_up_*` clés | [app/src/i18n/fr.json:285-352](../../app/src/i18n/fr.json#L285-L352) | ✅ 5 clés FR déjà extractibles (1 par stade, 4 vides côté stades non-source) | **Hors scope** — Story 5.4 consommera ces clés |

**Décisions héritées non-revisitables** :

- **Bornes stades** (PRD §3.1 FR-010 + §5.2) : Touriste `0-10`, Explorateur `11-20`, Détective `21-30`, Djidji `31-50`, Guide `51+`. Un même lieu visité plusieurs fois compte pour **1 spot**. Figé via `getStade()` + `STADE_DESCRIPTORS.min/max`.
- **Invariant `la maturité ne recule jamais`** (PRD §5.2 + FR-010 acceptance) : si `is_verified` passe `true → false` (rejet anti-fraude trigger SQL Epic 4), `unique_spots` peut redescendre — le `stade` reste figé via `maxStade(current, candidate)`. Cet invariant doit être doublé côté SQL (trigger BEFORE UPDATE rejetant les baisses de `stade`).
- **`unique_spots = Set(spawts.filter(is_verified).map(place_id)).size`** — recompute systématique côté client (project-context invariant). Pas de colonne dénormalisée serveur indépendante du client.
- **Politique overwrite** sur `spawter_progression` (amendement team §4.6, architecture §3 l287-289) — 1 row par spawter, PK = `spawter_id`. Pas d'historique des montées de stade côté `spawter_progression` (l'historique vit dans `collection_titres` Story 5.2 — append, mémoire d'identité).
- **RLS `spawter_id = auth.uid()`** sur les SELECT/INSERT/UPDATE. Pas de DELETE policy (cascade depuis `spawters`).
- **Migration réversible** (project-context « pas de migration non-réversible » + Stéphanie red flag) — fichier `.down.sql` apparié obligatoire.
- **Triple gate locale** avant merge : `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check && npm test` vert.
- **Pas de UI ici** — Story 5.4 livre l'écran `StadeCelebration`. Story 5.1 livre uniquement la data layer + l'invariant + l'event analytics.

## Acceptance Criteria

**AC #1 — Migration `0014_create_progression_collection_titres.sql` (Story 5.1 part)**

**Given** le dossier `supabase/migrations/`
**When** Story 5.1 est livrée
**Then** [supabase/migrations/0014_create_progression_collection_titres.sql](../../supabase/migrations/0014_create_progression_collection_titres.sql) crée **deux tables** dans une seule migration cohérente (l'arch §3 l697 suggère un fichier groupé — `collection_titres` est livrée par Story 5.2 dans la même migration). La part Story 5.1 :

```sql
-- Story 5.1 — Table spawter_progression (overwrite, amendement 4.6).
-- 1 row par spawter — PK = spawter_id. Pas d'historique (collection_titres porte la mémoire).
-- Invariant PRD §5.2 : la maturité ne recule jamais → trigger BEFORE UPDATE.

CREATE TABLE public.spawter_progression (
  spawter_id    uuid PRIMARY KEY
                  REFERENCES public.spawters(id) ON DELETE CASCADE,
  unique_spots  integer NOT NULL DEFAULT 0
                  CHECK (unique_spots >= 0),
  stade         text NOT NULL DEFAULT 'touriste'
                  CHECK (stade IN ('touriste','explorateur','detective','djidji','guide')),
  -- Story 5.2 — i18n key pour le titre actuel/affiché (`title.<stade>` par défaut).
  current_title text NOT NULL DEFAULT 'title.touriste',
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Trigger updated_at (réutilise set_updated_at créée migration 0001).
CREATE TRIGGER update_timestamp_spawter_progression
  BEFORE UPDATE ON public.spawter_progression
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ━━━ Invariant SQL : la maturité ne recule jamais (PRD §5.2 + FR-010) ━━━━━━━
-- Un trigger BEFORE UPDATE rejette tout UPDATE qui baisse le stade (ordre canonique
-- STADES = touriste < explorateur < detective < djidji < guide). Client-side garde-
-- fou (maxStade) + server-side enforcement (ce trigger) = défense en profondeur.
CREATE OR REPLACE FUNCTION public.assert_stade_never_recedes()
RETURNS TRIGGER AS $$
DECLARE
  stades_order text[] := ARRAY['touriste','explorateur','detective','djidji','guide'];
  old_idx int;
  new_idx int;
BEGIN
  old_idx := array_position(stades_order, OLD.stade);
  new_idx := array_position(stades_order, NEW.stade);
  IF new_idx < old_idx THEN
    RAISE EXCEPTION 'spawter_progression.stade cannot recede: % → % (PRD §5.2)',
      OLD.stade, NEW.stade;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_assert_stade_never_recedes
  BEFORE UPDATE ON public.spawter_progression
  FOR EACH ROW
  WHEN (NEW.stade IS DISTINCT FROM OLD.stade)
  EXECUTE FUNCTION public.assert_stade_never_recedes();

-- ━━━ RLS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.spawter_progression ENABLE ROW LEVEL SECURITY;

CREATE POLICY spawter_progression_select_own ON public.spawter_progression
  FOR SELECT USING (spawter_id = auth.uid());

CREATE POLICY spawter_progression_insert_own ON public.spawter_progression
  FOR INSERT WITH CHECK (spawter_id = auth.uid());

CREATE POLICY spawter_progression_update_own ON public.spawter_progression
  FOR UPDATE
  USING (spawter_id = auth.uid())
  WITH CHECK (spawter_id = auth.uid());
-- Pas de DELETE policy : suppression cascade depuis spawters.
```

**And** [supabase/migrations/0014_create_progression_collection_titres.down.sql](../../supabase/migrations/0014_create_progression_collection_titres.down.sql) existe et `DROP TABLE ... CASCADE` les deux tables + drop des fonctions/triggers (réversibilité, project-context invariant).

---

**AC #2 — Wrapper `data-source.upsertProgression`**

**Given** le module `app/src/lib/data-source.ts`
**When** Story 5.1 est livrée
**Then** un wrapper est exposé :

```ts
// app/src/lib/data-source.ts (étendu)

export interface ProgressionRow {
  spawter_id: string;
  unique_spots: number;
  stade: import("../types/stade").Stade;
  current_title: string; // i18n key — défaut `title.<stade>` (Story 5.2 livre la mapping)
  updated_at: string;
}

export async function upsertProgression(row: ProgressionRow): Promise<void> {
  if (!isSupabaseConfigured) return; // fallback : store local-only
  const { upsertProgressionToSupabase } = await import("./data-source.supabase");
  await upsertProgressionToSupabase(row);
}
```

**And** côté `data-source.supabase.ts`, la fonction :

```ts
// app/src/lib/data-source.supabase.ts (étendu)

export async function upsertProgressionToSupabase(row: ProgressionRow): Promise<void> {
  const { error } = await supabase
    .from("spawter_progression")
    .upsert(row, { onConflict: "spawter_id" });
  if (error) {
    // PRD §5.2 — invariant SQL : si trigger rejette (baisse de stade), on log
    // et on swallow (le local conserve la vérité côté client via maxStade).
    if (__DEV__) console.warn("[data-source] upsertProgression rejected", error);
  }
}
```

**And** un `XSchema.safeParse()` Zod (cohérent architecture §3 l295-299 « Validation runtime ») valide le shape avant insert si la story 1.x a livré les schémas Zod ; sinon la validation est différée Sprint 2 (defer documenté).

---

**AC #3 — `spawter-store.registerSpawt` étendu pour détection seuil + event + sync**

**Given** `spawter-store.registerSpawt` (existant) qui calcule déjà `unique_spots` + `candidate stade` + `maxStade`
**When** Story 5.1 est livrée
**Then** l'action est étendue pour :

1. Détecter un **franchissement de seuil** : `updated.stade !== spawter.stade` (le `maxStade` a déjà filtré les baisses, donc une différence post-update = montée).
2. Émettre `stade_unlocked` analytics avec `{ from_stade, to_stade, unique_spots }` (event déjà déclaré).
3. Construire `ProgressionRow` (incluant `current_title: \`title.\${updated.stade}\`` — Story 5.2 enrichira avec un mapping plus riche) et appeler `void upsertProgression(row).catch(...)` fire-and-forget.
4. **Ne pas dépendre** de la story 5.4 — l'UI célébration consommera l'event analytics (ou un state séparé `pendingCelebrations` que Story 5.4 ajoutera). Story 5.1 livre **uniquement** la data + event.

```ts
// app/src/store/spawter-store.ts — extension dans registerSpawt
// (positionnée APRÈS le calcul de `updated` et AVANT le `set({ ... })`).

const stadeChanged = updated.stade !== spawter.stade;
if (stadeChanged) {
  // PRD §5.2 — invariant ne-recule-jamais : maxStade ayant déjà filtré
  // les baisses, une différence ici = montée garantie.
  track({
    name: "stade_unlocked",
    properties: {
      from_stade: spawter.stade,
      to_stade: updated.stade,
      unique_spots: uniqueSpots,
    },
  });
}

// Sync spawter_progression (overwrite) — fire-and-forget, local-first.
// Le store reste vérité ; cette table miroir sert au compte serveur et à la
// jointure avec collection_titres (Story 5.2). Le `current_title` par défaut
// pointe sur la clé i18n du stade — Story 5.2 livre le mapping enrichi
// (titre actuel = stade, titre affiché = choix utilisateur, FR-008).
void upsertProgression({
  spawter_id: updated.id,
  unique_spots: uniqueSpots,
  stade: updated.stade,
  current_title: `title.${updated.stade}`,
  updated_at: updated.updated_at,
}).catch((err) => {
  if (__DEV__) console.warn("[spawter-store] upsertProgression failed", err);
});
```

**And** l'ordre des effets dans `registerSpawt` reste : append local → recompute → maxStade gate → save local → fire-and-forget `saveSpawter` → **(nouveau)** fire-and-forget `upsertProgression` → detect Premier Spawt (Story 4.2 déjà câblé) → set Zustand state.

**And** un test `app/__tests__/store/spawter-store-stade.test.ts` couvre :

- `registerSpawt` qui fait franchir 11 spots → `stade: explorateur` + event `stade_unlocked` émis avec `from_stade: "touriste"`, `to_stade: "explorateur"`.
- 21 spots → `detective`, 31 → `djidji`, 51 → `guide` (4 seuils).
- `is_verified: false` row qui ne change pas `unique_spots` → pas d'event.
- `unique_spots` chute (anti-fraude flag tardif) → `stade` reste figé (`maxStade`), pas d'event.
- Pas de re-émission `stade_unlocked` si on rejoue un spawt déjà compté.

---

**AC #4 — Invariant ne-recule-jamais double-côté (client + SQL)**

**Given** un scenario où un trigger anti-fraude SQL Epic 4 flagge un `spawt_checkin` row : `is_verified: true → false` (server-side rejection)
**When** le client re-fetch ses spawts au prochain `loadSpawts()`
**Then** :

1. Le client recompute `unique_spots` qui peut redescendre (`Set` filter `is_verified` est strict).
2. `getStade(unique_spots)` peut retourner un stade plus bas.
3. `maxStade(spawter.stade, candidate)` retourne **l'ancien stade** (gate TS).
4. Le `set({ spawter: updated })` ne baisse pas `stade`.
5. Sur la prochaine montée vraie (+1 spot net), le client envoie le **stade figé** (donc identique ou supérieur) — pas de baisse SQL.
6. **Garantie défense en profondeur** : si un bug client envoie quand même un stade plus bas, le trigger SQL `assert_stade_never_recedes` rejette l'UPDATE et le warn `__DEV__` apparaît côté client (acceptable — le local conserve la vérité, le serveur reste cohérent).

**And** un test SQL ad-hoc dans le `.sql` lui-même (commenté) documente le scenario à tester manuellement avant merge :

```sql
-- Test manuel post-migration :
-- INSERT INTO spawter_progression (spawter_id, unique_spots, stade)
--   VALUES (auth.uid(), 11, 'explorateur');
-- UPDATE spawter_progression SET stade = 'touriste' WHERE spawter_id = auth.uid();
-- → doit échouer avec exception "spawter_progression.stade cannot recede".
```

---

**AC #5 — Événement analytics `stade_unlocked` (Section 9 events.md)**

**Given** [documentation/analytics/events.md §9](../../documentation/analytics/events.md) déclare `stade_unlocked` avec properties `{ from_stade, to_stade, unique_spots }`
**When** Story 5.1 est livrée
**Then** :

- L'event est émis **une seule fois** par franchissement de seuil (idempotent — si `registerSpawt` est rejoué avec le même `s.is_verified` et même `place_id`, `unique_spots` reste identique et donc `updated.stade === spawter.stade` → no-op).
- L'event respecte la taxonomie : `signal_type: "review"` mappé via `EVENT_TO_SIGNAL` (déjà câblé).
- Les properties matchent la doc events.md (pas d'extension non-déclarée).

**And** la suite de tests `app/__tests__/store/spawter-store-stade.test.ts` mocke `analytics.track` et vérifie l'émission.

---

**AC #6 — Fallback gracieux en mode démo / offline**

**Given** `dataSourceMode === "fallback"` (mode démo Expo Go) ou réseau absent
**When** `registerSpawt` est appelé et qu'un seuil est franchi
**Then** :

1. Le store local met à jour `stade` (vérité client préservée).
2. L'event `stade_unlocked` est émis (batché côté `analytics.ts`, persisté `AsyncStorage` si pre-auth — déjà câblé).
3. `upsertProgression` retourne `void` immédiatement (no-op fallback) sans crasher.
4. Aucune attente UX — pas de spinner, pas d'erreur.

**And** quand la connectivité revient, **V1 ne re-synchronise pas** automatiquement `spawter_progression` (la prochaine montée le fera ; entre-temps le serveur peut être en retard d'un stade — acceptable pour alpha 5 spawters). Sprint 2 = retry queue dédiée (defer documenté).

---

**AC #7 — Tests + triple gate + smoke**

**Given** la suite de tests
**When** `cd app && npm test`
**Then** :

1. **`stade.test.ts`** (existant ou à étendre) — assertions bornes `getStade(0/10/11/20/21/30/31/50/51/100)` + propriété ne-recule-jamais sur `maxStade`.
2. **`spawter-store-stade.test.ts`** — 5-7 cas :
   - Franchissement 11 spots → event émis + `stade: explorateur`.
   - Franchissement 21, 31, 51 spots → events successifs.
   - Spawt `is_verified: false` → pas d'event, pas de changement.
   - Réémission `registerSpawt` même spawt → idempotent (pas d'event).
   - Chute `unique_spots` post-anti-fraude → `stade` figé, pas d'event downgrade.
   - Mock `upsertProgression` appelée avec le bon `ProgressionRow`.
3. **`data-source.test.ts`** (ou nouveau `data-source-progression.test.ts`) — `upsertProgression` no-op en mode fallback (assert qu'aucun import dynamique de `data-source.supabase` n'est tenté).

**Given** la triple gate
**When** lancée
**Then** `tsc --noEmit && lint:vocab && i18n:check && npm test` vert.
**And** `expo export --platform android` compile (smoke).

## Tasks / Subtasks

- [ ] **Task 1 — Créer migration `0014_create_progression_collection_titres.sql`** (AC: #1)
  - [ ] Section Story 5.1 : `CREATE TABLE spawter_progression` + trigger `set_updated_at` + RLS 3 policies + fonction + trigger `assert_stade_never_recedes`.
  - [ ] **Co-livraison Story 5.2** : `CREATE TABLE collection_titres` (cf. Story 5.2 AC #1) dans la même migration.
  - [ ] Créer `.down.sql` apparié : `DROP TRIGGER`, `DROP FUNCTION assert_stade_never_recedes`, `DROP TABLE spawter_progression CASCADE`, `DROP TABLE collection_titres CASCADE`.
  - [ ] Test manuel SQL post-migration : reject UPDATE de baisse de stade (cf. AC #4 snippet commenté).

- [ ] **Task 2 — Étendre `data-source.ts` + `data-source.supabase.ts`** (AC: #2)
  - [ ] Ajouter type `ProgressionRow` + fonction `upsertProgression(row)`.
  - [ ] Côté `data-source.supabase.ts` : `upsertProgressionToSupabase` avec `onConflict: "spawter_id"`.
  - [ ] Pas d'await côté caller. Catch interne (warn `__DEV__`), no throw.

- [ ] **Task 3 — Étendre `spawter-store.registerSpawt`** (AC: #3, #5, #6)
  - [ ] Après calcul `updated` (post-`maxStade`), comparer `updated.stade !== spawter.stade`.
  - [ ] Si différent : `track({ name: "stade_unlocked", properties: { from_stade, to_stade, unique_spots } })`.
  - [ ] Construire `ProgressionRow` (`current_title: \`title.\${updated.stade}\``) et `void upsertProgression(row).catch(...)`.
  - [ ] Préserver l'ordre existant (Premier Spawt detect Story 4.2 reste avant le `set`).
  - [ ] Pas de breaking de signature publique.

- [ ] **Task 4 — Tests** (AC: #7)
  - [ ] `app/__tests__/store/spawter-store-stade.test.ts` (5-7 cas listés AC #7).
  - [ ] Étendre `app/src/types/__tests__/stade.test.ts` si présent (bornes + maxStade) ; sinon créer.
  - [ ] Mock léger `@react-native-async-storage/async-storage` (déjà pattern Story 4.2).
  - [ ] Mock `analytics.track` (assert appels).

- [ ] **Task 5 — Triple gate + CHANGELOG** (AC: #7)
  - [ ] `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check && npm test` vert.
  - [ ] `expo export --platform android` compile (smoke).
  - [ ] CHANGELOG entrée `feat(stade)` Story 5.1 + section `### Verify` + `### Triple sign-off` (en attente PASS adversarial Epic 5).

## Dev Notes

### 1. Pourquoi une table `spawter_progression` distincte de `spawters` ?

Le champ `spawter.stade` (table `spawters`, déjà persisté par Story 1.x/2.x) **suffit** au runtime client. La table `spawter_progression` apporte 3 valeurs propres :

1. **Source canonique côté serveur** pour les jointures (Story 5.2 `collection_titres` rejoint `spawter_progression.current_title` ; Sprint 2+ panel admin lit la progression de la cohorte sans toucher la PII complète `spawters`).
2. **Invariant SQL ne-recule-jamais** (trigger `assert_stade_never_recedes`) — `spawters.stade` n'a pas cette gate. Avoir une table dédiée évite d'imposer le trigger à l'écriture de `spawters` (qui contient aussi avatar, neighborhood, etc. — UPDATE fréquent, on ne veut pas re-check le stade à chaque touch).
3. **`current_title` séparé** (Story 5.2) — permet d'évoluer titre actuel ≠ stade actuel (futur : titres bonus, mues V1.5+) sans muter `spawters`.

**Architecture §3 l281, l287-289, l697** est explicite : la table est canonique au schéma SPAWT.

### 2. Décision D1 — Migration 0014 groupée (Story 5.1 + 5.2)

L'architecture §3 l697 suggère **un seul fichier** `0014_create_progression_collection_titres.sql`. Cohérent :

- Les 2 tables sont co-issues de la même décision (amendement 4.6 — progression overwrite + collection_titres append).
- Une seule migration = un seul `down.sql`, simplifie le rollback.
- Le sequencing Story 5.1 puis 5.2 est livré dans **la même PR** (sprint-status compactera).

**Trade-off** : si Story 5.2 dérape, la migration Story 5.1 reste bloquée. Mitigation : Story 5.2 est strictement complémentaire (pas de dépendance circulaire — la FK `collection_titres.spawter_id → spawters(id)`, pas vers `spawter_progression`).

### 3. Décision D2 — Pas de UI célébration ici

`stade_unlocked` émis dans Story 5.1 = data + analytics. La célébration UI (`StadeCelebration` plein écran modal + `pattern-dots-gold` + halo + voix Chat solennelle) est livrée **Story 5.4** qui observe :
- **Option A** : l'event analytics (subscriber-based, mais analytics est fire-and-forget batché — pas adapté pour déclencher une UI temps réel).
- **Option B** : un transient state `pendingCelebrations: { from_stade, to_stade } | null` dans le store, set par `registerSpawt` au même moment que l'event, consommé par un overlay au root layout (pattern Story 4.2 `pendingBadge`).
- **Décision** : Story 5.4 implémentera l'**Option B**. Story 5.1 **ne touche pas** au state `pendingCelebrations` — elle reste dans son scope strict (data + event).

**Conséquence pour Story 5.1** : aucun import de Stack.Screen, aucun useState, aucun composant. Pure data layer + event.

### 4. Pourquoi pas un trigger SQL `AFTER INSERT` sur `spawt_checkin` ?

Tentation : un trigger côté DB qui recompute `unique_spots` + `stade` + upsert `spawter_progression` automatiquement à chaque INSERT/UPDATE `spawt_checkin`. **Avantages** : server-authoritative, zéro drift client/serveur.

**Trade-offs V1** :
- ❌ Le client compute reste nécessaire (local-first invariant — UX < 50ms).
- ❌ La duplication client + serveur = 2 sources de vérité → drift possible.
- ❌ Coût trigger sur chaque write (alpha 5 spawters OK, V1.5 1000 spawters peut être un risque perf).
- ❌ L'invariant ne-recule-jamais côté trigger demande de relire le row courant + comparer (logique 3 lignes mais redondante avec le client).

**Décision V1** : trigger SQL **uniquement** sur l'invariant ne-recule-jamais (BEFORE UPDATE on `spawter_progression`), pas sur le recompute. Le client est l'orchestrateur, le serveur est miroir + sanity check.

**Defer Sprint 2** : si l'alpha montre des drifts, ajouter un trigger `AFTER INSERT/UPDATE spawt_checkin` qui recompute (server-authoritative). Tracé D-501.

### 5. Décision D3 — `current_title` défaut = `title.<stade>`

Le champ `current_title text NOT NULL DEFAULT 'title.touriste'` stocke une **clé i18n**, pas une string FR brute. Cohérence :

- Project-context invariant : toute string FR vit dans `fr.json`.
- Story 5.2 livrera le mapping `title.touriste = "Touriste"`, `title.explorateur = "Explorateur"`, etc. (5 clés de base, identiques aux labels `stade.*` pour V1 — l'enrichissement futur via les titres-de-mue Story 5.2 sera des clés dédiées `title.<archetype>.<mue>`).
- Story 5.1 alimente cette colonne avec un fallback simple (`title.${stade}`). Story 5.2 introduit la notion de **titre affiché** distinct du titre actuel (FR-008 PRD §3.1).

**Conséquence** : à la fin de Story 5.1, `current_title` est toujours synchrone avec `stade` (pas de divergence). Story 5.2 ouvre la divergence.

### 6. Non-régression Epic 1-4

- **Story 1.x** `getStade`/`maxStade`/`STADE_DESCRIPTORS` consommés tels quels — pas de modif `stade.ts`.
- **Story 2.x** `finalizeOnboarding` initialise `spawter.stade = "touriste"`. Story 5.1 ne touche pas — la création initiale de `spawter_progression` se fera **lazy** au 1er `registerSpawt` (pas à `finalizeOnboarding`).
  - **Edge case** : un spawter qui finalise l'onboarding mais ne spawte jamais → pas de row `spawter_progression`. Acceptable (lecture downstream gère `null → default touriste`). Sprint 2 = upsert proactif à `finalizeOnboarding` si besoin de cohorte « onboardés non-spawteurs ».
- **Story 4.2** Premier Spawt detect (transition `total_spawts: 0 → 1` ET `is_verified`) reste avant le `set` Zustand — Story 5.1 ajoute son code **avant** ou **après** ce bloc, peu importe (les 2 logiques sont orthogonales : Premier Spawt = transition `total_spawts`, Stade Unlocked = transition `stade`). Recommandation : grouper les `track()` analytics ensemble pour la lisibilité.
- **Story 4.6/4.7** Palais/ADN updates restent fire-and-forget post-`attachReviewToSpawt`. Pas d'interférence — `registerSpawt` ne déclenche pas review.

### 7. Performance

- `registerSpawt` reste O(N) sur `unique_spots` (calcul du `Set`). Story 5.1 ajoute :
  - 1 comparaison `string !== string` (négligeable).
  - 1 appel `track()` conditionnel (fire-and-forget, batché côté analytics).
  - 1 appel `upsertProgression` conditionnel (fire-and-forget, dynamic import + Supabase upsert).
- Latence UX : 0ms additionnelle (rien d'`await`).
- Bundle JS : +0 (déjà tout en place, juste assemblage).

### 8. Risk

- **Risque #1** — Trigger SQL `assert_stade_never_recedes` rejette un UPDATE légitime (bug client envoie une baisse). **Mitigation** : le `maxStade` côté TS doit empêcher ça ; le trigger est ceinture-bretelles. Si réjection → log `__DEV__` + state local reste vérité, pas d'impact UX.
- **Risque #2** — Mode démo / offline : `upsertProgression` no-op, le serveur reste vide. **Acceptable V1** — la migration serveur sera populated au 1er spawt en mode live. Pas de migration de données nécessaire.
- **Risque #3** — Race condition : 2 `registerSpawt` simultanés sur le même device (impossible en pratique — store Zustand séquentialise). N/A.
- **Risque #4** — Re-émission `stade_unlocked` si un bug client rejoue le même spawt. **Mitigation** : la comparaison `updated.stade !== spawter.stade` est idempotente (rejouer = pas de différence). Le test AC #7 valide.
- **Risque #5** — Trigger ne-recule-jamais bloque les rollbacks de tests manuels. **Mitigation** : pour les tests SQL manuels, `TRUNCATE spawter_progression` ou `DROP TRIGGER` ad-hoc. Documenté en commentaire migration.

### 9. Sign-off

- **Stéphanie** (tech) : revue migration `.down.sql` réversibilité, revue trigger `assert_stade_never_recedes` perf (run sur chaque UPDATE — OK alpha, à benchmark Sprint 2), revue local-first fire-and-forget pattern préservé.
- **Kidam** (analytics) : confirmer `stade_unlocked` properties shape (events.md §9), confirmer cohorte « distribution stades cible M12 = 40/35/15/8/2% » trackable via cet event + funnel `spawt_first_completed → stade_unlocked["to_stade=explorateur"]`.
- **Alexandre** (brand) : pas de revue UI ici (Story 5.4). Confirmer juste que `stade_unlocked` event ne porte pas de copy (juste data) — pas de risque drift brand.

### 10. Defers identifiés

- **D-501** — Trigger SQL `AFTER INSERT/UPDATE spawt_checkin` qui recompute `spawter_progression` server-authoritative (Sprint 2 si drift observé alpha).
- **D-502** — Upsert proactif `spawter_progression` à `finalizeOnboarding` (Story 2.x amendment) pour cohorte « onboardés non-spawteurs » (Sprint 2 si Kidam demande).
- **D-503** — Retry queue dédiée `upsertProgression` au retour de connectivité (Sprint 2 — V1 = lazy à la prochaine montée).
- **D-504** — Zod schema `ProgressionSchema` à frontière `data-source.supabase.ts` (cohérent architecture §3 l295-299, si Stéphanie demande conformité stricte).
- **D-505** — Colonne `last_celebrated_stade` côté `spawter_progression` pour anti-replay de la célébration Story 5.4 (sera tranché par Story 5.4 — V1 = AsyncStorage local par défaut).

### Project Structure Notes

- **2 nouveaux fichiers SQL** : `supabase/migrations/0014_create_progression_collection_titres.sql` + `.down.sql` (les 2 tables groupées avec Story 5.2).
- **1 fichier modifié** : `app/src/lib/data-source.ts` (+`upsertProgression` + type `ProgressionRow`).
- **1 fichier modifié** : `app/src/lib/data-source.supabase.ts` (+`upsertProgressionToSupabase`).
- **1 fichier modifié** : `app/src/store/spawter-store.ts` (+detection seuil + event + sync, dans `registerSpawt`).
- **2 fichiers tests** : `app/__tests__/store/spawter-store-stade.test.ts` (nouveau) + extension `app/src/types/__tests__/stade.test.ts` si présent (sinon nouveau).
- **Pas de nouvelle dépendance**.
- **Pas de modif UI** — Story 5.4 livre l'écran.
- **Pas de modif i18n** — Story 5.2 enrichira `title.*`. Story 5.4 consommera `chat.*.stade_up_*` déjà extraits.

### References

- [_bmad-output/planning-artifacts/epics.md#L988-L1011](../planning-artifacts/epics.md#L988-L1011) Story 5.1
- [_bmad-output/planning-artifacts/PRD.md §3.1 FR-010 + §5.2](../planning-artifacts/PRD.md) Progression par stades + invariant ne-recule-jamais
- [_bmad-output/planning-artifacts/PRD.md §5.1 + §5.4](../planning-artifacts/PRD.md) Palais 5 axes + titres collection (consommé par Story 5.2)
- [_bmad-output/planning-artifacts/architecture.md#L281-L289](../planning-artifacts/architecture.md#L281-L289) Tables + politique overwrite
- [_bmad-output/planning-artifacts/architecture.md#L697](../planning-artifacts/architecture.md#L697) Migration `0009_create_progression_collection_titres` (corrigée → 0014 V1)
- [_bmad-output/planning-artifacts/architecture.md#L420](../planning-artifacts/architecture.md#L420) Historisation overwrite
- [_bmad-output/planning-artifacts/architecture.md#L755](../planning-artifacts/architecture.md#L755) Frontière historisation
- [_bmad-output/planning-artifacts/architecture.md#L776](../planning-artifacts/architecture.md#L776) Epic 5 mapping
- [_bmad-output/project-context.md §Zustand stores + §Critical Don't-Miss](../project-context.md)
- [documentation/analytics/events.md §9 Stade & Palais](../../documentation/analytics/events.md) `stade_unlocked`
- [app/src/types/stade.ts](../../app/src/types/stade.ts) `getStade`, `maxStade`, `STADE_DESCRIPTORS`, `STADE_WEIGHTS`
- [app/src/store/spawter-store.ts:271-324](../../app/src/store/spawter-store.ts#L271-L324) `registerSpawt` (à étendre)
- [app/src/lib/data-source.ts](../../app/src/lib/data-source.ts) (à étendre)
- [app/src/lib/analytics.ts:167](../../app/src/lib/analytics.ts#L167) `stade_unlocked` déclaré dans `EventName`
- [supabase/migrations/0008_create_user_palais.sql](../../supabase/migrations/0008_create_user_palais.sql) Pattern référence (overwrite + RLS + trigger)
- [supabase/migrations/0001_create_spawters_spawt_staff.sql](../../supabase/migrations/0001_create_spawters_spawt_staff.sql) `set_updated_at` fonction réutilisée

## Dev Agent Record

### Agent Model Used

_(à compléter au moment de la dev)_

### Debug Log References

_(à compléter)_

### Completion Notes List

_(à compléter)_

### File List

_(à compléter)_

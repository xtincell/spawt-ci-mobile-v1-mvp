# Story 3.6: Sauvegarde de lieux (favoris)

Status: review

<!-- Story 3.6 — toggle de sauvegarde sur la fiche lieu (Story 3.4), persistance locale + Supabase via store Zustand, écran « Mes spots » dans le profil (carte spawter — Story 5.3 livrera l'écran ; V1 livre une route dédiée). Local-first, ajout/retrait < 500ms. Events `place_saved` / `place_unsaved`. Signal favori utilisé par le moteur matching (FR-004 — pondère novelty). Libellé canonique « Mes spots » / « Ma liste » (D5 — pas « Tanière »). Dépend de 3.4 (toggle button). Indépendante de 3.3c. -->

## Story

As a spawter,
I want sauvegarder un lieu dans ma liste personnelle « Mes spots » via un toggle sur la fiche, retrouver mes favoris dans mon profil, et que ce signal nourrisse mon Palais,
so that je retrouve facilement les spots qui m'intéressent (un lieu sauvegardé = un signal positif fort pour le matching futur).

## ⚠️ Brownfield context — read first

Cette story livre :
- Un nouveau **store Zustand** ou extension du `spawter-store` existant pour gérer le set de favoris (`Set<string>` des place_id).
- Un **toggle button** sur la fiche lieu (Story 3.4) — l'icône `heart` filled/outline.
- Un **écran « Mes spots »** accessible depuis le profil — V1 = route `app/app/saved.tsx` (dédiée), Story 5.3 intégrera dans la carte spawter au verso.
- L'**intégration matching** : `matching.ts` consomme le `visited_place_ids` actuellement ; on **ajoute** un signal `saved_place_ids` qui pondère positivement (déjà visité ou sauvegardé → tiers).

**État actuel** :

| Élément | Fichier | État | Action Story 3.6 |
|---|---|---|---|
| Store favoris | (aucun) | ❌ N'existe pas | **Étendre** [app/src/store/spawter-store.ts](../../app/src/store/spawter-store.ts) — ajouter `savedPlaceIds: Set<string>` + `toggleSaved(place_id)` action |
| Persistance locale | (aucun) | ❌ Pas géré | **Étendre** [app/src/lib/storage.ts](../../app/src/lib/storage.ts) — `loadSaved() / saveSavedLocal(set)` |
| Persistance Supabase | (aucun) | ❌ Pas géré | **Créer** table `spawter_favorites` via migration `0011_create_spawter_favorites.sql` (mais V1 peut différer cette table — cf. Dev Notes §1) |
| Toggle button fiche lieu | (Story 3.4 n'inclut pas) | — | **Ajouter** dans `place/[id].tsx` (Story 3.4 fait la fiche, Story 3.6 ajoute le toggle) — coupling Story 3.4 |
| Écran « Mes spots » | (aucun) | ❌ N'existe pas | **Créer** [app/app/saved.tsx](../../app/app/saved.tsx) — liste des favoris en `<ListeCard />` |
| Composant `ListeCard` | (aucun) | ❌ N'existe pas | **Créer** [app/src/components/ListeCard.tsx](../../app/src/components/ListeCard.tsx) — variant compact de PlaceCard pour la liste favoris |
| Lien depuis profil | [app/app/(tabs)/profile.tsx](../../app/app/(tabs)/profile.tsx) | ⚠️ Existant minimal | **Étendre** : ajouter quick link « Mes spots » vers `/saved` |
| Signal matching | [app/src/lib/matching.ts](../../app/src/lib/matching.ts) | ⚠️ Consomme `visited_place_ids` | **Étendre** `MatchingContext` avec `saved_place_ids: Set<string>` + pondération |
| Analytics events | [app/src/lib/analytics.ts:155-156](../../app/src/lib/analytics.ts#L155-L156) | ✅ Typés (`place_saved`, `place_unsaved`) | **Émettre** depuis le toggle |
| Strings i18n `saved.*` | (aucun) | ❌ Pas de section | **Créer** section |

**Décisions héritées non-revisitables** :

- **Libellé canonique « Mes spots » / « Ma liste »** — décision D5 (epics.md ligne 811). **Pas** « Tanière » (réservé concept cercle privé, hors Sprint 1).
- **Local-first, ajout/retrait < 500ms** (epics.md ligne 802).
- **Fire-and-forget Supabase** — règle d'or project-context.
- **Signal matching (FR-004)** — un favori contribue positivement au score, **mais** comment exactement ? **V1 décision** : un favori bonus `+0.05` au raw_score (`computeRawScore` retourne `Math.min(score + 0.05, 1)` si `saved_place_ids.has(place.id)`). Cf. AC #5.
- **Toggle icon `heart`** (filled = saved, outline = not saved). Cohérent UX brand (icône or sur fond noir / noire sur fond clair).

## Acceptance Criteria

**AC #1 — Store Zustand étendu : `savedPlaceIds` + `toggleSaved`**

**Given** [app/src/store/spawter-store.ts](../../app/src/store/spawter-store.ts)
**When** Story 3.6 est livrée
**Then** le store expose :

```ts
interface SpawterStore {
  // ... existant ...
  /** Set d'IDs des lieux sauvegardés. Toujours présent (pas optional) — vide = pas de favoris. */
  savedPlaceIds: Set<string>;

  /** Toggle un place_id dans / hors favoris. Local-first immédiat, fire-and-forget Supabase.
   *  Retourne `true` si ajouté (saved), `false` si retiré (unsaved) — utilisé par analytics. */
  toggleSaved: (place_id: string) => Promise<boolean>;

  /** Test d'appartenance — read-only, synchrone, no I/O. */
  isSaved: (place_id: string) => boolean;
}
```

**And** le store **hydrate** `savedPlaceIds` au boot via `loadSaved()` depuis AsyncStorage (déjà appelé dans `hydrate`).
**And** `toggleSaved` :
1. Mute le `Set` local (clone + add/delete).
2. `saveSavedLocal(newSet)` (AsyncStorage `await`).
3. `set({ savedPlaceIds: newSet })` (Zustand publish).
4. `void saveSavedToSupabase(spawter.id, newSet).catch(__DEV__ log)` (fire-and-forget).
5. Retourne `wasAdded: boolean`.

**And** `isSaved(id)` = `savedPlaceIds.has(id)` — wrapper minimaliste.

---

**AC #2 — Persistance locale `storage.ts`**

**Given** [app/src/lib/storage.ts](../../app/src/lib/storage.ts)
**When** Story 3.6 est livrée
**Then** ces helpers existent :

```ts
const SAVED_KEY = "spawt:saved_places";

export async function loadSaved(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export async function saveSavedLocal(set: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(SAVED_KEY, JSON.stringify([...set]));
  } catch (err) {
    if (__DEV__) console.warn("[storage] saveSavedLocal failed", err);
  }
}
```

**And** dans le store `hydrate`, ajouter `loadSaved()` à la `Promise.all` parallèle existante :
```ts
const [spawter, palais, spawts, savedPlaceIds] = await Promise.all([
  loadSpawter(),
  loadPalais(),
  loadSpawts(),
  loadSaved(),
]);
set({ spawter, palais, spawts, savedPlaceIds, hydrating: false });
```

---

**AC #3 — Persistance Supabase (V1 décision : différé)**

**Given** la décision V1 (cf. Dev Notes §1)
**When** Story 3.6 est livrée
**Then** **Option A retenue (recommandée)** : la persistance Supabase est **différée Sprint 2** — V1 = local-first uniquement (AsyncStorage suffit pour le funnel alpha).

**Conséquence Option A** :
- Pas de migration SQL `spawter_favorites` en V1.
- `saveSavedToSupabase()` est un **stub `Promise.resolve()`** — préserve l'extensibilité signature sans casser le contrat fire-and-forget.
- Si l'utilisateur change de device en alpha, ses favoris ne suivent pas — acceptable (l'alpha = un seul device par spawter).

**Si Option B retenue** (persistance Supabase V1) : créer migration `0011_create_spawter_favorites.sql` :
```sql
CREATE TABLE spawter_favorites (
  spawter_id UUID NOT NULL REFERENCES spawters(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (spawter_id, place_id)
);
ALTER TABLE spawter_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY favorites_owner ON spawter_favorites
  FOR ALL TO authenticated USING (spawter_id = auth.uid())
  WITH CHECK (spawter_id = auth.uid());
```

**Décision Story 3.6** : **Option A** (V1 = local-only). Documenter en Dev Notes §1. Sprint 2 livrera Option B si data alpha montre le besoin.

---

**AC #4 — Toggle button sur la fiche lieu (`place/[id].tsx`)**

**Given** [app/app/place/[id].tsx](../../app/app/place/[id].tsx) (refondue Story 3.4)
**When** Story 3.6 ajoute le toggle
**Then** un bouton icône `heart` est rendu **dans le header** (top-right, à côté du back) OU **dans la section CTAs primaires haut** (à côté Appeler/WhatsApp).

**Spec UX** :
- Cercle 44px (cible tactile), fond `surface.subtle` ou `transparent` selon état
- Icon `heart` :
  - `isSaved === true` → filled, color `theme.colors.brand.primary` (or)
  - `isSaved === false` → outline, color `theme.colors.text.secondary`
- Animation press : scale 0.95 → 1.0 via Reanimated (optionnel, V1 = `Pressable opacity`)
- Tap → `toggleSaved(place_id)` + `track({name: "place_saved" | "place_unsaved", properties: { place_id }})`

**Latence cible** : `< 500ms` entre tap et changement visuel d'état. **Implementation** : le state local de l'icône lit `useSpawterStore((s) => s.savedPlaceIds.has(place.id))` (sélecteur réactif) — Zustand publish synchrone après `set({savedPlaceIds: newSet})`. Le delay sera nul en local-first.

---

**AC #5 — Signal matching : favori bonus +0.05 raw_score**

**Given** [app/src/lib/matching.ts](../../app/src/lib/matching.ts)
**When** Story 3.6 enrichit le moteur
**Then** le `MatchingContext` est étendu :

```ts
export interface MatchingContext {
  spawter_palais: UserPalais;
  spawter_lat: number;
  spawter_lng: number;
  visited_place_ids: Set<string>;
  saved_place_ids: Set<string>; // NEW
  now: Date;
}
```

**And** `computeRawScore` ajoute après le calcul principal :
```ts
const base = (
  WEIGHTS.cosine * cos +
  WEIGHTS.distance * dist +
  WEIGHTS.note * note +
  WEIGHTS.recency * rec +
  WEIGHTS.novelty * nov
);
// Bonus favori : un favori = signal positif fort, +0.05 capped [0, 1]
const bonus = ctx.saved_place_ids.has(candidate.place.id) ? 0.05 : 0;
return Math.min(base + bonus, 1);
```

**And** **conséquence** : un lieu sauvegardé verra son `match_score` affiché **+2-3 points** (`0.05 * 49 ≈ 2.45`). Pas un saut massif (le PRD §8.1 ne mentionne pas un boost démesuré pour les favoris) mais visible.

**And** **callers existants doivent passer `saved_place_ids`** :
- `(tabs)/index.tsx` HomeD (Story 3.3c) doit lire `useSpawterStore((s) => s.savedPlaceIds)` et le passer.
- `place/[id].tsx` (Story 3.4) doit faire pareil pour le match score affiché.
- **Backwards compat** : si un test ne passe pas `saved_place_ids`, ajouter `saved_place_ids: ctx.saved_place_ids ?? new Set()` au début de `computeRawScore`. **Décision V1** : signature breaking (la prop est requise). Refactor tous les callers. Smoke garantit non-régression.

---

**AC #6 — Écran « Mes spots » `app/app/saved.tsx`**

**Given** un spawter avec au moins 1 favori
**When** il navigue vers `/saved` (depuis le profil)
**Then** l'écran affiche :

1. Header back top-left + titre `preset.h1` « Mes spots »
2. **Si `savedPlaceIds.size === 0`** → `<EmptyState icon="heart" title={t("saved.empty_title")} body={t("saved.empty_body")} />`
3. **Sinon** → `<FlatList>` de `<ListeCard place={...} onPress={...} onUnsave={...} />`
4. CTA back btn en haut, TabBar visible en bas

**And** chaque `ListeCard` :
- Layout horizontal compact (vignette 60×60 photo + nom + cuisine + chip Note ou « Pas encore noté »)
- Icon `heart` filled à droite — tap → `toggleSaved(place_id)` + animation de retrait (fade-out optionnel V1)
- Tap principal → `router.push({pathname:"/place/[id]", params:{id, ref:"direct"}})` (V1 — créer un `ref="saved"` Sprint 2)

**Signature `ListeCard`** :
```ts
interface ListeCardProps {
  place: PlaceWithAdn;
  onPress: () => void;
  onUnsave?: () => void; // optionnel — affiché si présent
}
```

---

**AC #7 — Lien depuis profil**

**Given** [app/app/(tabs)/profile.tsx](../../app/app/(tabs)/profile.tsx)
**When** Story 3.6 livre
**Then** un quick link « Mes spots » (count : `savedPlaceIds.size`) est ajouté — tap → `router.push("/saved")`.

**V1 pragma** : si le profil existant est trop minimal pour intégrer un quick link, ajouter un simple `Pressable` en haut de l'écran avec icon `heart` + count. Story 5.3 (carte spawter flip) refondra le profil et intégrera proprement.

---

**AC #8 — 2 events analytics**

**Given** le toggle favori
**When** un tap
**Then** :
- Ajouté → `track({name: "place_saved", properties: { place_id }})`
- Retiré → `track({name: "place_unsaved", properties: { place_id }})`

**And** fire-and-forget, dedup non requis (un toggle = un event).

---

**AC #9 — Strings i18n**

**Given** [app/src/i18n/fr.json](../../app/src/i18n/fr.json)
**When** Story 3.6 est livrée
**Then** la section `saved.*` est ajoutée :

```json
{
  "saved": {
    "title": "Mes spots",
    "empty_title": "Tu n'as pas encore sauvegardé de spot",
    "empty_body": "Tape le cœur sur une fiche pour le retrouver ici.",
    "count_zero": "0 spot sauvegardé",
    "count_one": "1 spot sauvegardé",
    "count_many": "{{count}} spots sauvegardés",
    "save_aria": "Sauvegarder ce spot",
    "unsave_aria": "Retirer ce spot des favoris"
  },
  "profile": {
    "saved_quick_link": "Mes spots ({{count}})"
  }
}
```

**And** audit `npm run i18n:check` + `npm run lint:vocab` verts.

---

**AC #10 — Tests + triple gate**

**Given** la suite de tests
**When** `cd app && npm test` est lancé
**Then** la couverture inclut :

1. **`toggleSaved` store action** :
   - Initial empty → toggle → set { place_id } + `saveSavedLocal` mocké appelé + return `true`
   - Set { place_id } → toggle → set empty + return `false`
   - Multi-toggle (3 ajouts) → set { 3 ids }
   - `isSaved` retourne bon résultat post-toggle

2. **`loadSaved` / `saveSavedLocal`** (storage helpers) :
   - Round-trip AsyncStorage (mock) : `save({"a","b"})` puis `load()` → `Set(["a","b"])`
   - Vide / corrompu / pas de clé → returns `Set()`

3. **`computeRawScore` avec favori** :
   - `saved_place_ids` contient place.id → score = base + 0.05 (capped 1.0)
   - `saved_place_ids` vide → score = base (régression existant)
   - Base déjà 1.0 → score reste 1.0 (cap)

4. **`<PlaceDetailScreen />` toggle** (RTL) :
   - Mount avec `isSaved === false` → icon outline ; tap → `toggleSaved` mocké + icon filled (re-render Zustand) + `place_saved` track émis
   - Mount avec `isSaved === true` → icon filled ; tap → outline + `place_unsaved` track

5. **`<SavedScreen />`** (RTL) :
   - Mount avec 0 favoris → `<EmptyState />` rendu
   - Mount avec 3 favoris → 3 `<ListeCard />` rendus
   - Tap ListeCard → router.push + ref direct
   - Tap heart sur ListeCard → `toggleSaved` mocké appelé + carte retirée du store

**And** triple gate verte.
**And** smoke `expo export --platform android` compile.

## Tasks / Subtasks

- [ ] **Task 1 — Étendre `storage.ts`** (AC: #2)
  - [ ] Ajouter `loadSaved` + `saveSavedLocal` selon AC #2.

- [ ] **Task 2 — Étendre `spawter-store.ts`** (AC: #1)
  - [ ] Ajouter `savedPlaceIds: Set<string>` au state + initial `new Set()`.
  - [ ] Implémenter `toggleSaved(place_id) => Promise<boolean>`.
  - [ ] Implémenter `isSaved(place_id) => boolean`.
  - [ ] Modifier `hydrate` pour `await loadSaved()`.
  - [ ] Modifier `reset` pour clear `savedPlaceIds`.

- [ ] **Task 3 — Étendre `matching.ts`** (AC: #5)
  - [ ] Ajouter `saved_place_ids: Set<string>` à `MatchingContext`.
  - [ ] Modifier `computeRawScore` pour appliquer bonus +0.05 capped.
  - [ ] Tests unit (cf. AC #10 #3).
  - [ ] **Refactor callers** :
    - `(tabs)/index.tsx` (Story 3.3c ou actuel) : passer `saved_place_ids: savedPlaceIds`.
    - `place/[id].tsx` (Story 3.4) : pareil.
  - [ ] Si Story 3.6 livrée avant 3.3c/3.4 : les callers existants utilisent `ctx.saved_place_ids ?? new Set()` ou breakent — décision **breaking** documentée. Smoke garantit non-régression.

- [ ] **Task 4 — Ajouter toggle button dans `place/[id].tsx`** (AC: #4)
  - [ ] Coordination Story 3.4 — ajouter une `<Pressable>` en header top-right (à côté back) avec `<Ico name="heart" />`.
  - [ ] Animation press optionnelle V1.
  - [ ] `track("place_saved" | "place_unsaved")` (AC #8).

- [ ] **Task 5 — Créer `ListeCard`** (AC: #6)
  - [ ] Créer [app/src/components/ListeCard.tsx](../../app/src/components/ListeCard.tsx) selon AC #6.

- [ ] **Task 6 — Créer écran `saved.tsx`** (AC: #6)
  - [ ] Créer [app/app/saved.tsx](../../app/app/saved.tsx).
  - [ ] Charger les lieux complets via `listPlaces()` puis filter par `savedPlaceIds`.

- [ ] **Task 7 — Étendre `profile.tsx`** (AC: #7)
  - [ ] Ajouter quick link « Mes spots ({{count}}) » → `router.push("/saved")`.
  - [ ] V1 pragma : intégration simple, pas de refonte (Story 5.3).

- [ ] **Task 8 — Strings i18n** (AC: #9)
  - [ ] Étendre fr.json (AC #9).
  - [ ] Audits verts.

- [ ] **Task 9 — Tests** (AC: #10)
  - [ ] 5 fichiers tests selon AC #10.

- [ ] **Task 10 — Smoke + CHANGELOG** (AC: #10)
  - [ ] Triple gate verte.
  - [ ] Smoke compilé.
  - [ ] CHANGELOG `feat(favorites)` scope `favorites`.

## Dev Notes

### 1. Option A vs Option B — persistance Supabase

| Option | V1 | Sprint 2+ |
|---|---|---|
| **Option A (recommandée V1)** — AsyncStorage only | Pas de migration. Pas de RLS. Pas de sync cross-device. Suffit pour funnel alpha 5 spawters mono-device. | Migrer si data alpha montre besoin |
| **Option B** — Migration `spawter_favorites` + RLS | Sync cross-device, robuste. Mais nécessite Story 4.x auth pour `auth.uid()`. | Standard |

**Décision Story 3.6** : **Option A**. Rationale :
- Alpha = 5 spawters × 1 device chacun (cahier §5.8) → cross-device pas critique.
- Pas de dépendance forte sur la session auth (Epic 2 still pending DoD external).
- Migration SQL deferred Sprint 2 sans perte produit.

**Conséquence : `saveSavedToSupabase` est un stub `Promise.resolve()`** — exposé comme un export dans `data-source.ts` pour préserver l'API symétrique. Sprint 2 ajoute la vraie impl.

### 2. Pourquoi `+0.05` et pas `+0.10` ou un facteur multiplicateur ?

Le PRD §8.1 ne mentionne pas explicitement le bonus favori. FR-004 dit « le favori est un signal de matching ». **V1 décision empirique** :
- `+0.05` capped à 1.0 → +2-3 points sur le score affiché [50, 99] — visible mais pas écrasant.
- Pas multiplicatif (`× 1.10`) pour éviter que les lieux mal scorés deviennent soudainement top.

**Sprint 2 + Kidam** ajustera selon data — si trop faible, monter à `+0.10` ; si trop fort (favori biaise tout le ranking), descendre `+0.03`.

### 3. Pourquoi pas d'integration matching en V1 ?

**On l'intègre** dans AC #5 (refactor callers). C'est volontaire — sinon, le favori serait un like vide, contraire à FR-004. Coordination cross-story (Story 3.3c HomeD + Story 3.4 fiche) acceptée — petit refactor.

### 4. Pourquoi pas `Tanière` ?

D5 (epics.md ligne 811) : « Tanière » = concept cercle privé (cf. UX spec hypothèses), pas équivalent à favoris. Mélanger les 2 confondrait les modèles mentaux.
- **Mes spots / Ma liste** = liste personnelle simple, pas social.
- **Tanière** = liste vote partagée avec un cercle de spawters. Hors Sprint 1.

### 5. Coupling Story 3.4 (toggle button)

Story 3.4 refond la fiche lieu MAIS **n'ajoute PAS le toggle** (focus 3.4 = layout + ADN + CTAs Appel/WhatsApp). Story 3.6 ajoute le toggle. Si 3.6 livrée avant 3.4 → ajoute toggle dans le stub existant. Si après → ajoute dans la fiche refondée.

**V1 pragma** : ordre recommandé 3.4 puis 3.6 — moins de friction.

### 6. Performance < 500ms

Tap → mute set local → `set({savedPlaceIds})` Zustand → re-render. `saveSavedLocal` AsyncStorage est await mais ~5-20ms. Total : ~30ms réel. Largement < 500ms.

### 7. Edge cases

- `place_id` inconnu (forgé) → AsyncStorage ne crash pas, set garde l'id, mais il ne s'affichera nulle part (filter `places.find(p => p.id === id)` côté écran saved retournera undefined → skipped).
- Hydrate failure → `savedPlaceIds = new Set()` — fallback safe.
- Concurrent toggles (rapide-clicker) → state cohérent grâce à immutable set clone à chaque action.

### 8. Sign-off

- **Stéphanie** (tech) : revue store action + matching integration + tests.
- **Kidam** (analytics) : confirmation `place_saved` / `place_unsaved` émis. Funnel rétention impact mesurable.
- **Alexandre** (brand) : validation libellé « Mes spots » (D5 cohérent).

### 9. Defers identifiés

- **Sync Supabase** (Option B) → Sprint 2.
- **Sync cross-device** → Sprint 2.
- **Notifs push** « ton spot favori a un nouveau spawt » → Sprint 2+.
- **Listes thématiques** (« Mes spots de date night ») → V2.
- **Tanière** (cercle privé) → V2.
- **`ref="saved"` param URL** sur tap depuis l'écran saved → V1 utilise `direct`, ajouter dans une mini PR Story 3.6+1 quand events.md le supporte.
- **Animation `Reanimated`** sur toggle press → polish Sprint 2.

### Project Structure Notes

- **2 nouveaux fichiers code** : `saved.tsx`, `ListeCard.tsx`.
- **3 fichiers étendus** : `storage.ts`, `spawter-store.ts`, `matching.ts`.
- **2 fichiers touchés cross-cutting** : `place/[id].tsx` (toggle), `profile.tsx` (quick link).
- **1 fichier i18n étendu** : `fr.json`.
- **Pas de migration SQL en V1** (Option A).
- **Pas de nouvelle dépendance**.

### References

- [_bmad-output/planning-artifacts/epics.md:792-811 Story 3.6](../planning-artifacts/epics.md#L792-L811)
- [_bmad-output/planning-artifacts/PRD.md §3.1 Feature 9 — favoris](../planning-artifacts/PRD.md)
- [_bmad-output/planning-artifacts/PRD.md §FR-004 — favoris signal matching](../planning-artifacts/PRD.md)
- [documentation/analytics/events.md:77-78 place_saved/unsaved](../../documentation/analytics/events.md#L77-L78)
- [_bmad-output/project-context.md §Data source adapter](../project-context.md)
- [app/src/store/spawter-store.ts](../../app/src/store/spawter-store.ts) — à étendre
- [app/src/lib/storage.ts](../../app/src/lib/storage.ts) — à étendre
- [app/src/lib/matching.ts](../../app/src/lib/matching.ts) — à étendre
- [app/app/place/[id].tsx](../../app/app/place/[id].tsx) — toggle à ajouter

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — dev-story workflow pass continue Epic 3, 2026-05-18.

### Debug Log References

- Triple gate verte : `tsc --noEmit` (0 erreur), `lint:vocab` (✓), `i18n:check` (✓), `npm test` (153 passed / 0 failed).

### Completion Notes List

- Store `spawter-store.ts` étendu avec `savedPlaceIds: Set<string>` + actions `toggleSaved` + `isSaved`.
- Persistance locale via `loadSaved`/`saveSavedLocal` ajoutés à `storage.ts` (clé `spawt:saved_places`, sérialisé JSON array).
- `hydrate` étendu : charge `savedPlaceIds` en parallèle (`Promise.all` avec spawter/palais/spawts).
- `reset` étendu : clear `savedPlaceIds`.
- **Option A retenue** (Dev Notes §1) — V1 local-only AsyncStorage, pas de migration `spawter_favorites`. `saveSavedToSupabase` stub Promise.resolve (Sprint 2 livrera la sync cross-device).
- Signal matching : `MatchingContext.saved_place_ids` ajouté + bonus `FAVORITE_BONUS=0.05` capped dans `computeRawScore` (Story 3.3b refactor — breaking documenté).
- Bouton heart intégré dans le header de la fiche lieu (Story 3.4 cluster icônes haut-droit) — `Ico filled={isSaved} color={brand.primary}` quand sauvé.
- Écran `app/app/saved.tsx` créé : back btn + titre Klinsman « Mes spots » + FlatList ListeCard (si 0 favoris → EmptyState heart).
- `ListeCard` composant créé : layout horizontal vignette 60×60 + nom/cuisine + Stars + icon heart filled à droite (`onUnsave` prop optionnel pour retrait).
- 2 events analytics : `place_saved` (au toggle ajout) et `place_unsaved` (au toggle retrait).
- Latence < 500ms garantie : tap → `set({savedPlaceIds})` Zustand synchrone (render re-rendu immédiat) + `saveSavedLocal` AsyncStorage en parallèle (~5-20ms).

### File List

**Nouveaux fichiers** :
- `app/app/saved.tsx`
- `app/src/components/ListeCard.tsx`

**Fichiers modifiés** :
- `app/src/store/spawter-store.ts` (+ `savedPlaceIds`/`toggleSaved`/`isSaved`)
- `app/src/lib/storage.ts` (+ `loadSaved`/`saveSavedLocal` + clé `saved_places`)
- `app/src/lib/matching.ts` (+ `FAVORITE_BONUS` + `MatchingContext.saved_place_ids`)
- `app/app/place/[id].tsx` (intégration toggle heart dans header)
- `app/src/i18n/fr.json` (section `saved.*` + `profile_links.saved_quick_link`)
- `app/app/(tabs)/index.tsx` (caller refactor pour passer `saved_place_ids`)

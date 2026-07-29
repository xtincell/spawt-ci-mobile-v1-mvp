# Story 3.5: Recherche & filtres

Status: review

<!-- Story 3.5 — écran search dédié, accessible via icône search dans le Masthead (Story 3.3c) ou via un sub-tab. SearchBar arrondie r=24 « Cherche un spot, un plat, une zone… », recherche sur nom + cuisine + quartier. État vide = récents (AsyncStorage) + suggestions du Chat + cuisines. FilterChips horizontales + FilterSheet bottom (cuisine, budget 3 tranches, distance, note minimale). Combinaison AND. CTA « Voir N spots » live. < 1,5s sur 3G. Events search_submitted, filter_applied. Dépend de 3.3a (adapter). Indépendante de 3.3b/3.3c. -->

## Story

As a spawter,
I want rechercher un lieu par texte (nom, plat, zone) et appliquer des filtres (cuisine, budget, distance, note minimale) qui se combinent en AND avec un CTA live « Voir N spots »,
so that je trouve rapidement un spot précis quand je sais ce que je cherche, sans avoir à naviguer dans le feed entier.

## ⚠️ Brownfield context — read first

**Aucun écran de recherche n'existe encore**. Story 3.5 livre :
- Nouvel écran `app/app/search.tsx` (hors `(tabs)/` pour permettre l'overlay au-dessus de toute surface) **OU** intégré comme sub-route `(tabs)/search.tsx`. Décision Dev Notes §1.
- 3 nouveaux composants : `SearchBar`, `FilterChips`, `FilterSheet`.
- Logique de recherche client-side (in-memory) en V1 — le moteur n'utilise pas Supabase full-text search pour V1 (coût minime sur 12 seeds, 50-100 lieux alpha).

**État actuel** :

| Élément | Fichier | État | Action Story 3.5 |
|---|---|---|---|
| Écran search | (aucun) | ❌ N'existe pas | **Créer** [app/app/search.tsx](../../app/app/search.tsx) — accessible via icône search du Masthead (HomeD) ou push depuis n'importe où |
| Composant `SearchBar` | (aucun) | ❌ N'existe pas | **Créer** [app/src/components/SearchBar.tsx](../../app/src/components/SearchBar.tsx) — input arrondi r=24 |
| Composant `FilterChips` | (aucun) | ❌ N'existe pas | **Créer** [app/src/components/FilterChips.tsx](../../app/src/components/FilterChips.tsx) — chips horizontales scrollable, état actif `chip-dark` |
| Composant `FilterSheet` | (aucun) | ❌ N'existe pas | **Créer** [app/src/components/FilterSheet.tsx](../../app/src/components/FilterSheet.tsx) — bottom sheet avec sliders + chips toggle |
| Moteur de recherche | (aucun) | ❌ N'existe pas | **Créer** [app/src/lib/search.ts](../../app/src/lib/search.ts) — fonction pure `searchPlaces(places, query, filters)` |
| Storage récents | (aucun) | ❌ N'existe pas | **Créer** dans `app/src/lib/storage.ts` — `getRecentSearches() / addRecentSearch(query)` (AsyncStorage `spawt:recent_searches` cap 10) |
| Strings i18n `search.*` | (aucun) | ❌ Pas de section | **Créer** section complète |
| Analytics events | [app/src/lib/analytics.ts:152-153](../../app/src/lib/analytics.ts#L152-L153) | ✅ Typés (`search_submitted`, `filter_applied`) | **Émettre** depuis l'écran |

**Décisions héritées non-revisitables** :

- **Recherche client-side en V1** — N<1000 lieux, RAM négligeable, latence négligeable, simplicité maximale. Sprint 2+ si volume scale → migrer vers PostgreSQL full-text + index trigram.
- **Combinaison AND** des filtres (epics.md §785).
- **CTA « Voir N spots » live** — recompute à chaque toggle de filtre (epics.md §785).
- **Recherche sur nom + cuisine + quartier** (epics.md §781).
- **État vide = récents + suggestions Chat + cuisines** (epics.md §781).
- **NFR-PERF < 1,5s** sur 3G (epics.md §789).
- **Pas de mot interdit** Contrat §20.1.

## Acceptance Criteria

**AC #1 — Écran search `app/app/search.tsx` livré**

**Given** [app/app/search.tsx](../../app/app/search.tsx) (nouveau)
**When** un caller (HomeD Masthead, ou autre surface) navigue vers `/search`
**Then** l'écran affiche **dans cet ordre** :

1. Back btn top-left (Pressable icon `arrow-left`)
2. `<SearchBar value={query} onChange={...} onSubmit={...} autoFocus />` en tête
3. `<FilterChips activeFilters={filters} onToggle={(kind, value) => ...} />` — chips horizontal scrollable juste sous la SearchBar
4. **État dynamique** :
   - **Si `query === "" && filters` vides** → état vide : `RecentSearches` + suggestions Chat + chips cuisines populaires
   - **Sinon** → liste des résultats `<FlatList data={results} renderItem={...} />`
5. **Bouton filtres avancés** : icon `sliders` ou label « Filtres » qui ouvre `<FilterSheet />`
6. CTA flottant bas (visible quand filtres OU query actifs) : « Voir N spots » — count live

**And** la TabBar (Story 3.1) reste **visible** si l'écran est dans `(tabs)/`, ou **cachée** si écran modal. Décision Dev Notes §1.

---

**AC #2 — Composant `SearchBar`**

**Given** [app/src/components/SearchBar.tsx](../../app/src/components/SearchBar.tsx) (nouveau)
**When** rendu
**Then** :
- Input rond `borderRadius: 24`, fond `theme.colors.surface.subtle`, hauteur 44px (cible tactile)
- Icône `search` à gauche, padding `theme.spacing.base`
- Placeholder : `t("search.placeholder")` = « Cherche un spot, un plat, une zone… »
- Bouton clear (icône `close`) à droite quand `value !== ""`
- `autoFocus` optionnel via prop
- `returnKeyType: "search"` sur le keyboard mobile

**Signature** :
```ts
interface SearchBarProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit?: () => void; // tap return key
  autoFocus?: boolean;
  placeholder?: string;
}
```

---

**AC #3 — Composant `FilterChips`**

**Given** [app/src/components/FilterChips.tsx](../../app/src/components/FilterChips.tsx) (nouveau)
**When** rendu avec un état de filtres actifs
**Then** :
- Affiche un `ScrollView horizontal` de chips représentant les filtres actuellement actifs
- Chaque chip = `<Chip variant={active ? "dark" : "default"} label={...} onPress={() => toggle(kind, value)} />`
- Filtres représentés en chips de raccourci : `Cuisine: Ivoirienne`, `Budget: ₣₣`, `5km`, `Note ≥ 4`
- **Tap sur une chip active** → désactive ce filtre (toggle)
- **Une chip permanente « + Filtres »** en fin de scroll → ouvre le `FilterSheet` (callback prop `onOpenSheet`)

**Signature** :
```ts
type FilterKind = "cuisine" | "budget" | "distance" | "rating";

interface FilterState {
  cuisines: ReadonlyArray<string>; // codes cuisine (CuisineCategory)
  budgetTiers: ReadonlyArray<1 | 2 | 3>; // multi-select
  distanceKm: number | null; // null = pas de filtre
  minRating: number | null; // null = pas de filtre (sinon 3, 3.5, 4, 4.5)
}

interface FilterChipsProps {
  filters: FilterState;
  onToggle: (kind: FilterKind, value: unknown) => void;
  onOpenSheet: () => void;
}
```

---

**AC #4 — Composant `FilterSheet` (bottom sheet avec sliders + chips)**

**Given** [app/src/components/FilterSheet.tsx](../../app/src/components/FilterSheet.tsx) (nouveau)
**When** ouvert
**Then** un bottom sheet plein écran (50-75% hauteur) affiche :

1. Header : titre « Filtrer » + bouton fermer top-right
2. **Section Cuisine** : multi-select chips `chip-dark` toggle (chaque `CuisineCategory` de PRD §6.2)
3. **Section Budget** : 3 chips toggle multi-select (`₣ Économique` · `₣₣ Moyen` · `₣₣₣ Premium`)
4. **Section Distance** : slider 1-20km (single thumb) + label « ≤ {{km}} km » (ou off si null)
5. **Section Note minimale** : 4 chips toggle exclusive (3.0, 3.5, 4.0, 4.5) — single-select
6. **CTAs bas** : « Effacer tout » (`btn-ghost`) + « Voir N spots » (`btn-primary` live count)

**Signature** :
```ts
interface FilterSheetProps {
  visible: boolean;
  initialFilters: FilterState;
  resultsCount: (filters: FilterState) => number; // callback live
  onApply: (filters: FilterState) => void;
  onClose: () => void;
}
```

**Implementation** : utiliser un `Modal` RN avec `animationType="slide"` ou `presentationStyle="pageSheet"` (iOS). V1 acceptable d'utiliser `Modal` natif RN — pas de lib bottom-sheet tierce.

---

**AC #5 — Moteur `search.ts` (fonction pure)**

**Given** [app/src/lib/search.ts](../../app/src/lib/search.ts) (nouveau)
**When** Story 3.5 est livrée
**Then** une fonction pure existe :

```ts
import type { PlaceWithAdn } from "./data-source";

export interface SearchFilters {
  cuisines: ReadonlyArray<string>;
  budgetTiers: ReadonlyArray<1 | 2 | 3>;
  distanceKm: number | null; // distance max
  minRating: number | null;
}

export interface SearchContext {
  spawter_lat: number;
  spawter_lng: number;
}

/**
 * Filtre + ranke une liste de places selon query texte + filtres.
 *
 * - Pure (no I/O), total (no throw), deterministic.
 * - Query matché en `includes` case-insensitive sur nom, cuisine[*], neighborhood.
 * - Filtres combinés AND.
 * - distanceKm calculée via haversineKm (matching.ts).
 * - Résultats triés par "score de pertinence" descendant : matches exacts d'abord, puis name>cuisine>neighborhood.
 */
export function searchPlaces(
  candidates: readonly PlaceWithAdn[],
  query: string,
  filters: SearchFilters,
  ctx: SearchContext,
): PlaceWithAdn[];
```

**And** : si `query === "" && all filters empty` → retourne `[]` (l'UI affiche l'état vide).
**And** : la recherche est **case-insensitive** + **accent-insensitive** (utiliser `.normalize("NFD").replace(/[̀-ͯ]/g, "")` pour normalisation française).
**And** **pas de match fuzzy** en V1 (`Levenshtein` deferred Sprint 2) — uniquement `includes`.

---

**AC #6 — Récents + suggestions (état vide)**

**Given** l'écran search avec `query === "" && filters` vides
**When** rendu
**Then** affiche :

1. **Recherches récentes** (max 10, AsyncStorage `spawt:recent_searches`) :
   - Une liste verticale `<Pressable>` chacune représente une recherche passée
   - Tap → re-applique la query (set `query` state, déclenche la recherche)
   - Bouton clear (`Effacer tout`) optionnel
2. **Suggestions du Chat** :
   - 2-3 propositions éditoriales selon le stade :
     - Touriste : « Essaie : maquis, café, à 2 km »
     - Détective : « Essaie : Yopougon, ouest-africaine »
   - Implémentés via clés `chat.<stade>.search_suggestions` dans fr.json — V1 = strings statiques.
3. **Chips cuisines populaires** :
   - 5-6 chips horizontal scrollable, tap → applique le filtre cuisine
   - Cuisines mises en avant : `ivoirienne`, `ouest_africaine`, `francaise`, `libanaise`, `fusion`, `patisserie`

**And** Helper `addRecentSearch(query)` ajoute en tête de la liste, dedup, cap 10 entries (FIFO).
**And** Helper `getRecentSearches(): Promise<string[]>` lit AsyncStorage.

---

**AC #7 — Analytics : 2 events émis**

**Given** l'écran search actif
**When** les interactions ont lieu
**Then** ces events sont émis :

1. **`search_submitted`** — au tap submit OU à l'arrêt de typing (debounce 800ms après dernier change)
   - Props : `query: string`, `filters: object` (sérialisé `SearchFilters`), `results_count: number`
   - **Debounce** pour ne pas spammer Kidam à chaque caractère
   - **Dedup** : si `query` identique à la précédente émission (et filtres identiques), pas de réémission

2. **`filter_applied`** — au toggle de chaque filtre (FilterChips OU FilterSheet)
   - Props : `filter_kind: "cuisine" | "budget" | "distance" | "rating"`, `value: unknown`

**And** fire-and-forget (wrapper Story 1.7).

---

**AC #8 — Tap résultat → navigation fiche lieu avec `ref="search"`**

**Given** un résultat tappé
**When** le user navigue
**Then** `router.push({ pathname: "/place/[id]", params: { id: place.id, ref: "search" } })` — cohérence Story 3.4 AC #5.
**And** la query courante est sauvegardée dans `spawt:recent_searches` (déduplication, cap 10).

---

**AC #9 — Strings i18n + Test Tantie Rose**

**Given** [app/src/i18n/fr.json](../../app/src/i18n/fr.json)
**When** Story 3.5 est livrée
**Then** la section `search.*` existe :

```json
{
  "search": {
    "placeholder": "Cherche un spot, un plat, une zone…",
    "title": "Chercher",
    "empty_recents_title": "Tes dernières recherches",
    "empty_recents_clear": "Effacer",
    "empty_suggestions_title": "Le Chat te propose",
    "empty_cuisines_title": "Cuisines populaires",
    "filters_button": "Filtres",
    "filters_open": "Affiner",
    "filters_section_cuisine": "Cuisine",
    "filters_section_budget": "Budget",
    "filters_section_distance": "Distance",
    "filters_section_rating": "Note minimale",
    "filters_clear_all": "Effacer tout",
    "filters_cta_see": "Voir {{count}} spots",
    "filters_cta_see_one": "Voir 1 spot",
    "filters_cta_see_zero": "Aucun spot — élargis tes filtres",
    "budget_low": "₣ Économique",
    "budget_mid": "₣₣ Moyen",
    "budget_high": "₣₣₣ Premium",
    "distance_unit": "≤ {{km}} km",
    "distance_off": "Toutes distances",
    "rating_min": "Note ≥ {{value}}",
    "results_empty_title": "Aucun spot ne correspond",
    "results_empty_body": "Élargis tes filtres ou demande au Chat des suggestions."
  },
  "chat": {
    "touriste": {
      "search_suggestions": "Essaie : maquis, café, à 2 km"
    },
    "explorateur": {
      "search_suggestions": "Tente : libanaise, Yopougon, soirée"
    },
    "detective": {
      "search_suggestions": "Cherche : ouest-africaine, premium, pépite vérifiée"
    },
    "djidji": {
      "search_suggestions": "Aujourd'hui : tu sais ce que tu veux"
    },
    "guide": {
      "search_suggestions": "La Meute compte sur ton flair"
    }
  }
}
```

**And** audit `npm run i18n:check` + `npm run lint:vocab` verts.
**And** Test Tantie Rose : placeholder accessible (« spot » est vocab SPAWT canonique), suggestions Chat parlent le réel.

---

**AC #10 — Perf < 1,5s + tests + triple gate**

**Given** un spawter sur 3G simulé tape une query
**When** les résultats s'affichent
**Then** TTI < 1,5s P95 entre le tap submit (ou la fin du typing) et le rendu des résultats.

**And** la suite de tests inclut :

1. **`searchPlaces`** (pure unit) :
   - Query exact match nom → 1 résultat
   - Query partial match cuisine → résultats incluant celle cuisine
   - Query accent-insensitive (« cafe » match « café ») → match
   - Filters AND : cuisine=ivoirienne + budget=1 → uniquement les places matchant les 2
   - Empty query + filters cuisine=patisserie → résultats filtrés (pas vide)
   - Empty all → retourne `[]`
   - Distance filter : `distanceKm = 2` → uniquement places à ≤ 2km

2. **`<SearchBar />`** (RTL) :
   - Tap clear → `onChange("")` appelé
   - Submit (return) → `onSubmit` appelé

3. **`<FilterChips />`** + **`<FilterSheet />`** (RTL) :
   - Toggle d'une chip → `onToggle` appelé avec `kind` + `value`
   - FilterSheet open + apply → `onApply` callback reçoit les nouveaux filtres

4. **`<SearchScreen />`** intégration :
   - Mount → `listPlaces` mocké appelé
   - Type query → debounce 800ms → `search_submitted` track émis
   - Toggle filter → `filter_applied` track émis
   - Tap résultat → `router.push` avec `ref: "search"` + `addRecentSearch` appelé

**And** triple gate verte.
**And** smoke `expo export --platform android` compile.

## Tasks / Subtasks

- [ ] **Task 1 — Helper `recent-searches` dans `storage.ts`** (AC: #6)
  - [ ] Éditer [app/src/lib/storage.ts](../../app/src/lib/storage.ts).
  - [ ] Ajouter `getRecentSearches(): Promise<string[]>` + `addRecentSearch(query: string): Promise<void>` + `clearRecentSearches(): Promise<void>`.
  - [ ] Cap 10 entries (FIFO drop), dedup (si query déjà présente, la remonter en tête sans dupliquer).

- [ ] **Task 2 — Moteur `search.ts`** (AC: #5)
  - [ ] Créer [app/src/lib/search.ts](../../app/src/lib/search.ts) avec `searchPlaces` + `SearchFilters` + `SearchContext`.
  - [ ] Normalisation française (`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()`).
  - [ ] Filter AND + tri pertinence (match nom > cuisine > neighborhood).
  - [ ] Tests unit pure (cf. AC #10 #1).

- [ ] **Task 3 — Composant `SearchBar`** (AC: #2)
  - [ ] Créer [app/src/components/SearchBar.tsx](../../app/src/components/SearchBar.tsx).
  - [ ] Consommer `<Ico name="search" />` + `<Ico name="close" />`.

- [ ] **Task 4 — Composant `FilterChips`** (AC: #3)
  - [ ] Créer [app/src/components/FilterChips.tsx](../../app/src/components/FilterChips.tsx).
  - [ ] Helper interne pour formater les labels (`Cuisine: Ivoirienne`).

- [ ] **Task 5 — Composant `FilterSheet`** (AC: #4)
  - [ ] Créer [app/src/components/FilterSheet.tsx](../../app/src/components/FilterSheet.tsx).
  - [ ] Utiliser RN `Modal` (pas de lib tierce).
  - [ ] Slider distance : utiliser le slider natif RN-community OU implémenter un slider simple (V1 = un picker 1/2/5/10/20 km via chips si pas de slider dispo).
  - [ ] Live count : `resultsCount(filters)` callback re-appelé sur chaque change.

- [ ] **Task 6 — Écran `search.tsx`** (AC: #1, #6, #7, #8)
  - [ ] Créer [app/app/search.tsx](../../app/app/search.tsx).
  - [ ] State : `query`, `filters: FilterState`, `recents: string[]`, `places: PlaceWithAdn[]` (loaded au mount).
  - [ ] Debounce 800ms sur query → émettre `search_submitted` + dedup.
  - [ ] Tap résultat → `router.push({pathname:"/place/[id]", params:{id, ref:"search"}})` + `addRecentSearch(query)`.

- [ ] **Task 7 — Câbler la route depuis HomeD** (AC: #1)
  - [ ] **Cross-cutting Story 3.3c** : ajouter une icône `search` cliquable dans `<Masthead />` qui fait `router.push("/search")`.
  - [ ] **Alternative V1** : si Masthead pas encore livré (3.3c pending), ajouter un FAB ou icon dans le header tab — accepter coupling temporaire. Décision : préférer 3.3c (le tap Masthead search est UX cohérent).

- [ ] **Task 8 — Strings i18n** (AC: #9)
  - [ ] Étendre fr.json (AC #9).
  - [ ] Audits verts.

- [ ] **Task 9 — Tests** (AC: #10)
  - [ ] 4 fichiers tests selon AC #10.

- [ ] **Task 10 — Smoke + CHANGELOG** (AC: #10)
  - [ ] Triple gate verte.
  - [ ] Smoke compilé.
  - [ ] CHANGELOG `feat(search)` scope `search`.

## Dev Notes

### 1. Écran search dans `(tabs)/` ou modal au root ?

| Option | Pour | Contre |
|---|---|---|
| **Modal au root** (`app/app/search.tsx`) | Overlay visuel propre, peut être appelé depuis n'importe où, cache TabBar pour focus | Pas d'icône dans la TabBar pour y revenir |
| **Sub-route tabs** (`app/app/(tabs)/search.tsx` — mais V1 a 5 onglets max, pas de place) | Cohérence avec autres tabs | Pas de slot dispo dans la TabBar Story 3.1 |

**Décision V1** : **Modal au root** `app/app/search.tsx`. Accessible via icône search dans le Masthead HomeD (Story 3.3c §Task 7 cross-cutting). Animation `slide_from_bottom` ou `fade` selon goût.

### 2. Pourquoi pas de full-text Supabase ?

V1 = 12 seeds + 50-100 lieux alpha. Recherche client = négligeable (1ms sur 100 lieux). Pour V2 (5000+ lieux), migrer vers `ilike` + index trigram + ranking serveur. **Pas de scope creep V1**.

### 3. Pourquoi accent-insensitive ?

Les ivoiriens tapent souvent sans accents (clavier rapide). « cafe » doit matcher « Café ». Normalisation NFD est standard, ~3 LOC, gain UX énorme.

### 4. Pourquoi pas de pluralisation manuelle ?

Suivre les règles i18next (project-context §i18n). Les 3 clés `filters_cta_see` / `filters_cta_see_one` / `filters_cta_see_zero` sont **3 strings distinctes** — pas une pluralisation i18next runtime (qui est plus fragile en FR-CI). V1 = 3 clés explicites, simple.

### 5. Coordination avec Story 3.4 — `ref="search"`

Story 3.4 lit `?ref=...` pour analytics `place_viewed.referrer`. Story 3.5 **doit** passer `params: { id, ref: "search" }` à `router.push`. Coordination identique à Story 3.3c § coordination 3.4.

### 6. Voix du Chat dans suggestions

Les suggestions Chat (`chat.<stade>.search_suggestions`) sont des **strings statiques** V1 — pas le moteur `chat-voice.ts` (qui gère `moment`). V1 = 5 strings hardcodées par stade dans fr.json. Sprint 2 pourra migrer vers un moteur (`chat-voice.search_suggestions(stade)`).

### 7. Performance

- `listPlaces` 1× au mount → cache dans state.
- `searchPlaces` recompute via `useMemo([query, filters, places, ctx])` — O(N) sur N<1000.
- Debounce 800ms évite recompute à chaque caractère.
- `FilterSheet` recompute live count via `resultsCount` callback — O(N) chaque toggle, négligeable.

### 8. Non-régression

- Pas de fichier existant modifié sauf `storage.ts` (ajout, pas remplacement) et `(tabs)/index.tsx` HomeD (icône search dans Masthead — coupling Story 3.3c).

### 9. Sign-off

- **Stéphanie** (tech) : revue moteur pur + tests + bottom sheet RN natif (pas de dep tierce).
- **Kidam** (analytics) : confirmation 2 events émis conformes events.md ligne 67-68, debounce 800ms acté.
- **Alexandre** (brand) : Test Tantie Rose sur placeholder + suggestions Chat + wording filters.

### 10. Defers identifiés

- **Fuzzy matching** (Levenshtein, trigram) → Sprint 2+.
- **Full-text Supabase** + index trigram → Sprint 2+ si volume justifie.
- **Suggestions Chat dynamiques** via `chat-voice.ts` → Sprint 2.
- **Synonymes** (« maquis » → mappe à `cuisine: ivoirienne, informel`) → Sprint 2 (sera utile au scale).
- **Map view des résultats** → Story Carte (V1.5+, hors scope).
- **Sauvegarder une recherche** comme un filtre persistant → V1.5+.
- **Sticky filters** (filtres persistants entre sessions) → AsyncStorage Sprint 2 si data alpha le demande.

### Project Structure Notes

- **1 nouvel écran** : `app/app/search.tsx`.
- **3 nouveaux composants** : `SearchBar`, `FilterChips`, `FilterSheet`.
- **1 nouveau moteur** : `search.ts`.
- **1 fichier étendu** : `storage.ts` (recent searches helpers).
- **1 fichier i18n étendu** : `fr.json`.
- **1 cross-cutting Story 3.3c** : icône search dans Masthead.
- **Pas de nouvelle dépendance npm** (Modal RN natif).
- **Pas de migration SQL** (V1 client-side).

### References

- [_bmad-output/planning-artifacts/epics.md:771-790 Story 3.5](../planning-artifacts/epics.md#L771-L790)
- [_bmad-output/planning-artifacts/PRD.md §3.1 Feature 10](../planning-artifacts/PRD.md) — recherche + filtres
- [_bmad-output/planning-artifacts/ux-design-specification.md:1329 SearchBar/FilterChips/FilterSheet spec](../planning-artifacts/ux-design-specification.md#L1329)
- [_bmad-output/planning-artifacts/ux-design-specification.md:1429 FilterSheet pattern](../planning-artifacts/ux-design-specification.md#L1429)
- [_bmad-output/planning-artifacts/ux-design-specification.md:1472 Recherche & filtres pattern](../planning-artifacts/ux-design-specification.md#L1472)
- [documentation/analytics/events.md:67-68 events search/filter](../../documentation/analytics/events.md#L67-L68)
- [app/src/lib/data-source.ts](../../app/src/lib/data-source.ts) — `listPlaces` (Story 3.3a)
- [app/src/lib/matching.ts](../../app/src/lib/matching.ts) — `haversineKm` (Story 3.3b)
- [app/src/lib/storage.ts](../../app/src/lib/storage.ts) — à étendre recent_searches
- [app/src/components/primitives/Chip.tsx](../../app/src/components/primitives/Chip.tsx) — primitive consommée
- [app/src/types/place.ts:53-65 CuisineCategory](../../app/src/types/place.ts#L53-L65)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — dev-story workflow pass continue Epic 3, 2026-05-18.

### Debug Log References

- Triple gate verte : `tsc --noEmit` (0 erreur), `lint:vocab` (✓), `i18n:check` (✓), `npm test` (153 passed / 0 failed).

### Completion Notes List

- Écran `app/app/search.tsx` créé en modal au root (Dev Notes §1 — Option modal retenue). Accessible via icône search dans Masthead HomeD (cross-cutting Story 3.3c).
- Moteur pur `search.ts` : `searchPlaces(candidates, query, filters, ctx)` — pure, total, sans I/O. Normalisation française (NFD + strip diacritiques + lowercase). Filtres AND (cuisine multi-select, budgetTiers multi-select, distanceKm single, minRating single). Score pertinence texte : nom×3 + cuisine×2 + neighborhood×1.
- 3 composants créés : `SearchBar` (input r=24, autoFocus prop, clear button), `FilterChips` (chips horizontaux scroll incluant « + Filtres » outline + chips actives `dark` selected), `FilterSheet` (Modal RN natif, multi-select cuisines/budget, single-select distance/rating, CTA live count avec 3 variants i18n zero/one/many).
- 2 events analytics : `search_submitted` (debounce 800ms + dedup query+filters via lastSubmittedRef), `filter_applied` (au toggle chaque chip OU au apply sheet).
- Récents AsyncStorage : `getRecentSearches`/`addRecentSearch`/`clearRecentSearches` ajoutés à `storage.ts` (cap 10 FIFO, dedup).
- État vide : récents (chips outline) + suggestions Chat (`chat.<stade>.search_suggestions` libres, hors `CHAT_MOMENTS`) + chips cuisines populaires (6 cuisines tap → applique filter).
- Tap résultat → `router.push({pathname:"/place/[id]", params:{id, ref:"search"}})` + addRecentSearch déduplique + remonte en tête.
- `searchPlaces` consomme `haversineKm` exporté de matching.ts (Story 3.3b — élimine duplication).
- V1 : pas de Levenshtein/fuzzy ni full-text Supabase (Sprint 2+ si volume scale).

### File List

**Nouveaux fichiers** :
- `app/app/search.tsx`
- `app/src/lib/search.ts`
- `app/src/components/SearchBar.tsx`
- `app/src/components/FilterChips.tsx`
- `app/src/components/FilterSheet.tsx`

**Fichiers modifiés** :
- `app/src/lib/storage.ts` (+ `getRecentSearches`/`addRecentSearch`/`clearRecentSearches` + clé `recent_searches`)
- `app/src/i18n/fr.json` (section `search.*` + `chat.<stade>.search_suggestions` × 5)
- `app/app/(tabs)/index.tsx` (icône search Masthead — cross-cutting livré dans la même passe)

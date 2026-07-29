# Story 3.2: Note communautaire pondérée par stade

Status: review

<!-- 2e story d'Epic 3 — livre le moteur pur `weighted-rating.ts` qui calcule `note_affichée = Σ(note × poids_stade) / Σ(poids_stade)` (poids Touriste 1x → Guide 3x), avec mode incrémental pour éviter le recompute from-scratch à chaque nouvel avis. Stocké sur `place_adn.weighted_rating`. Aucun écran touché — l'écran fiche lieu (3.4) et le PlaceCard (déjà existant) consomment ce champ déjà présent dans le type `PlaceAdn`. Story autonome — pas de dépendance UI, alimente Epic 4 (Stories 4.5/4.7 — avis + update ADN). -->

## Story

As a spawter,
I want que la note affichée d'un lieu reflète la maturité de ceux qui ont voté (un Djidji compte 2,5× plus qu'un Touriste),
so that je fais confiance à une note qui n'est pas plate, et que ma confiance dans les Pépites vérifiées repose sur une vraie hiérarchie de regards.

## ⚠️ Brownfield context — read first

Cette story **livre un moteur pur** `lib/weighted-rating.ts` (cible #1 des tests unit) + 1 helper d'update incrémental + l'intégration dans la chaîne d'update ADN. **Aucun écran modifié** par cette story directement — la consommation existe déjà :

- [app/src/types/place.ts:128-130](../../app/src/types/place.ts#L128-L130) — `PlaceAdn.weighted_rating: number` (typé déjà)
- [app/src/components/PlaceCard.tsx:49](../../app/src/components/PlaceCard.tsx#L49) — `place.rating_display` (lecture déjà câblée — alias)
- [app/app/place/[id].tsx:176](../../app/app/place/[id].tsx#L176) — affichage `★ ${place.adn.weighted_rating.toFixed(1)}` (lecture déjà câblée)
- [app/src/data/seed/places.ts:43](../../app/src/data/seed/places.ts#L43) — seeds initialisés avec `rating_display: 4.6` (valeurs fixes — pas calculées dynamiquement)

**État actuel** :

| Élément | Fichier | État | Action Story 3.2 |
|---|---|---|---|
| Moteur `weighted-rating.ts` | (aucun) | ❌ N'existe pas | **Créer** [app/src/lib/weighted-rating.ts](../../app/src/lib/weighted-rating.ts) — fonctions pures `computeWeightedRating` + `incrementalWeightedRating` |
| Constantes `STADE_WEIGHTS` | (aucun) | ❌ N'existe pas | **Créer** dans [app/src/types/stade.ts](../../app/src/types/stade.ts) (cohabite avec `getStade`) — `Record<Stade, number>` figé |
| Champ `PlaceAdn.weighted_rating` | [app/src/types/place.ts:128-130](../../app/src/types/place.ts#L128-L130) | ✅ Typé `number` | **Garder** intact |
| Lecture côté `PlaceCard` | [app/src/components/PlaceCard.tsx:49](../../app/src/components/PlaceCard.tsx#L49) | ✅ Câblée via `rating_display` (alias `weighted_rating` côté seed/Supabase) | **Garder** intact |
| Lecture côté fiche lieu | [app/app/place/[id].tsx:176](../../app/app/place/[id].tsx#L176) | ✅ Câblée `weighted_rating.toFixed(1)` | **Garder** intact |
| Tests `weighted-rating.test.ts` | (aucun) | ❌ N'existent pas | **Créer** [app/src/lib/__tests__/weighted-rating.test.ts](../../app/src/lib/__tests__/weighted-rating.test.ts) — cible coverage + propriétés mathématiques |
| Consommateur incrémental | (Story 4.7) | ❌ N'existe pas (Story 4.7 livrera l'update ADN serveur/triggers) | **Préparer** — Story 4.7 importera `incrementalWeightedRating` |

**Décisions héritées non-revisitables** :

- **Poids stades** (PRD §3.1 Feature 6 + §20.6) : Touriste 1x · Explorateur 1,5x · Détective 2x · Djidji 2,5x · Guide 3x. Pas de variante.
- **Stades canoniques** ([app/src/types/stade.ts](../../app/src/types/stade.ts)) : 5 valeurs `"touriste" | "explorateur" | "detective" | "djidji" | "guide"`. Pas de renommage.
- **Note brute par avis** : entier 1-5 (Stars `max=5` corrigé Story 1.4 D7). Pas de fraction côté input.
- **Anti-fraude `is_seed=true`** : les avis fondateurs (Claude amendment 5.4) **alimentent** le calcul ADN (donc `weighted_rating`) mais sont **exclus du compteur public** `total_reviews`. Cohérent project-context §Edge cases.
- **Spawts non vérifiés** (`is_verified=false`, check_in_type=`passive` poids 0.5x) : la pondération `0.5x` s'applique sur les **signaux ADN** (axes), **pas** sur la note communautaire — un avis donné par un spawter, quelle que soit la nature du spawt, compte plein. À confirmer Dev Notes §2 (décision à acter).
- **Pas de calcul côté trigger SQL** en V1 — le V1 fait le calcul côté Edge Function (Story 4.7) qui consomme le moteur pur via Deno import. La version pure TypeScript est portable. À évaluer Sprint 2 si perf insuffisante.

## Acceptance Criteria

**AC #1 — Moteur pur `weighted-rating.ts` avec 2 fonctions exportées**

**Given** le moteur pur [app/src/lib/weighted-rating.ts](../../app/src/lib/weighted-rating.ts)
**When** Story 3.2 est livrée
**Then** il expose **2 fonctions pures** (sans I/O, totales) :

```ts
import type { Stade } from "../types/stade";

/** Avis individuel — entrée pour le calcul from-scratch */
export interface WeightedRatingInput {
  /** Note 1-5 (Stars max=5 corrigé D7). Hors range → ignoré silencieusement. */
  note_etoiles: number;
  /** Stade du spawter au moment de l'avis (pas le stade actuel — historique). */
  spawter_stade: Stade;
}

/**
 * Calcul from-scratch (PRD §3.1 Feature 6 + §20.6).
 * `note_affichée = Σ(note × poids_stade) / Σ(poids_stade)`.
 *
 * - 0 avis → retourne 0 (pas NaN). Le caller (UI) gate sur `total_reviews < 5`
 *   pour afficher "ADN en construction" — pas la responsabilité de ce moteur.
 * - Avis hors range (note < 1 ou > 5) → ignorés.
 * - Inclut les avis is_seed (cohérent amendement Claude 5.4) — le caller doit
 *   passer la liste complète, le moteur ne discrimine pas.
 *
 * Borné [0, 5], arrondi à la décimale (`Math.round(v * 10) / 10`).
 */
export function computeWeightedRating(reviews: readonly WeightedRatingInput[]): number;

/**
 * Update incrémental quand un nouvel avis arrive — évite le recompute O(N).
 *
 * Maintient les 2 accumulateurs `sumWeightedNotes` (Σ note × poids) et
 * `sumWeights` (Σ poids), retourne le triplet {next_sum_weighted, next_sum_weights, next_rating}.
 *
 * Caller stocke `sum_weighted_notes` et `sum_weights` sur `place_adn`
 * (colonnes à ajouter via migration — cf. Task 5 ou deferred Story 4.7).
 *
 * - Validation : note hors range → return current (no-op).
 * - 0 avis avant + 1er avis → next_rating = note de l'avis (single sample).
 */
export function incrementalWeightedRating(
  current: { sum_weighted_notes: number; sum_weights: number },
  newReview: WeightedRatingInput,
): { sum_weighted_notes: number; sum_weights: number; weighted_rating: number };
```

**And** le moteur est **total** : aucun `throw` brut (cohérent project-context §Erreurs — moteurs purs ne propagent jamais d'erreur en plein écran).
**And** le moteur est **sans I/O** : pas d'AsyncStorage, pas de Supabase, pas de timer. Cible #1 des tests unit (project-context §Testing Rules).

---

**AC #2 — Constantes `STADE_WEIGHTS` figées dans `stade.ts`**

**Given** [app/src/types/stade.ts](../../app/src/types/stade.ts)
**When** Story 3.2 est livrée
**Then** une constante exportée existe :

```ts
/** Poids du stade dans le calcul de la note communautaire pondérée (PRD §3.1 Feature 6 + §20.6).
 *  Invariant — ne pas modifier sans review tech lead + Stéphanie + Kidam + Alexandre. */
export const STADE_WEIGHTS: Record<Stade, number> = {
  touriste: 1,
  explorateur: 1.5,
  detective: 2,
  djidji: 2.5,
  guide: 3,
} as const;
```

**And** un test de gel des invariants existe (snapshot ou assert direct) — toute modif **doit casser** le test, force la revue (cohérent project-context §Critical Don't-Miss).

---

**AC #3 — Tests unit `weighted-rating.test.ts` exhaustifs (cible #1)**

**Given** la suite de tests
**When** `cd app && npm test` est lancé
**Then** la couverture inclut au minimum :

1. **`computeWeightedRating` — cas nominal**
   - `[{note: 5, stade: "djidji"}, {note: 3, stade: "touriste"}]` → `(5×2.5 + 3×1) / (2.5 + 1) = 15.5 / 3.5 ≈ 4.43` → arrondi `4.4`
   - `[{note: 4, stade: "touriste"}]` → `4×1 / 1 = 4.0`
   - `[]` (0 avis) → `0` (pas NaN)
   - Vérifier que toutes les 5 valeurs de stade sont testées au moins une fois

2. **`computeWeightedRating` — propriétés mathématiques**
   - **Borné [0, 5]** : pour `notes ∈ [1, 5]` et poids positifs, résultat ∈ [1, 5]
   - **Symétrie** : `compute([a, b]) === compute([b, a])` — l'ordre n'influence pas
   - **Stabilité** : 2 mêmes inputs en série donnent la même sortie (no hidden state)
   - **Robustesse** : note hors range (-1, 6, NaN, undefined) → ignorée (pas crash)

3. **`incrementalWeightedRating` — cas nominal**
   - Current `{sum_weighted_notes: 15.5, sum_weights: 3.5}` + new `{note: 5, stade: "guide"}` (poids 3) → new sum_weighted_notes = 15.5 + 5×3 = 30.5 ; new sum_weights = 3.5 + 3 = 6.5 ; weighted_rating = 30.5 / 6.5 ≈ 4.7
   - Démarrage à zéro `{0, 0}` + 1er avis → returns single-sample (weighted_rating = note)

4. **`incrementalWeightedRating` — cohérence avec from-scratch**
   - Pour un dataset `[r1, r2, r3, r4]`, vérifier que `compute([r1, r2, r3, r4]) === incremental(incremental(incremental(incremental({0,0}, r1), r2), r3), r4).weighted_rating` à `±0.01` près (tolérance float).

5. **`STADE_WEIGHTS` — gel d'invariants**
   - Snapshot inline : poids = `[1, 1.5, 2, 2.5, 3]` exactement.
   - Test cassé → force la revue manuelle.

---

**AC #4 — Aucune modification UI dans cette story**

**Given** Story 3.2
**When** livrée
**Then** **aucun fichier sous `app/app/`** ni `app/src/components/` n'est touché.
**And** la consommation via `place.adn.weighted_rating` reste inchangée — `PlaceCard` et fiche lieu lisent déjà ce champ depuis le type `PlaceAdn`.
**And** les seeds [app/src/data/seed/places.ts](../../app/src/data/seed/places.ts) gardent leurs valeurs littérales `weighted_rating: 4.6` etc. — Story 3.2 ne recalcule pas les seeds.

---

**AC #5 — Préparation de l'intégration future (Story 4.7)**

**Given** la future Story 4.7 (« Mise à jour de l'ADN du Lieu »)
**When** elle sera implémentée
**Then** elle pourra importer **directement** `incrementalWeightedRating` sans modif du moteur :
```ts
import { incrementalWeightedRating } from "../lib/weighted-rating";
import { STADE_WEIGHTS } from "../types/stade";
```
**And** Story 4.7 devra ajouter 2 colonnes `place_adn.sum_weighted_notes` + `place_adn.sum_weights` (migration SQL) pour persister l'état incrémental — **hors scope Story 3.2** (deferred §3).

**Given** le moteur en V1 (sans persistance)
**When** un test d'intégration veut vérifier le résultat final
**Then** il peut utiliser `computeWeightedRating(reviews)` from-scratch — coût O(N) acceptable pour N < 1000.

---

**AC #6 — Triple gate verte**

**Given** la triple gate
**When** lancée
**Then** `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check && npm test` vert.
**And** **pas de string FR** dans le moteur (c'est de la logique pure, pas d'UI) — audit i18n trivialement vert.
**And** **pas de mot interdit** Contrat §20.1 — audit vocab vert (`weighted_rating` est neutre, pas `rating`/`like`/`leaderboard`).
**And** `cd app && npx tsc --noEmit` 0 erreur — couverture type strict.

## Tasks / Subtasks

- [ ] **Task 1 — Ajouter `STADE_WEIGHTS` dans `stade.ts`** (AC: #2)
  - [ ] Éditer [app/src/types/stade.ts](../../app/src/types/stade.ts) — ajouter la constante après l'export `STADE_THRESHOLDS` existante.
  - [ ] Vérifier `as const satisfies Record<Stade, number>` (compile-time guarantee).

- [ ] **Task 2 — Créer `weighted-rating.ts`** (AC: #1)
  - [ ] Créer [app/src/lib/weighted-rating.ts](../../app/src/lib/weighted-rating.ts) avec les 2 fonctions de l'AC #1.
  - [ ] Implémenter `computeWeightedRating` :
    ```ts
    export function computeWeightedRating(reviews: readonly WeightedRatingInput[]): number {
      if (reviews.length === 0) return 0;
      let sumWeightedNotes = 0;
      let sumWeights = 0;
      for (const r of reviews) {
        if (!Number.isFinite(r.note_etoiles) || r.note_etoiles < 1 || r.note_etoiles > 5) continue;
        const weight = STADE_WEIGHTS[r.spawter_stade];
        sumWeightedNotes += r.note_etoiles * weight;
        sumWeights += weight;
      }
      if (sumWeights === 0) return 0;
      return Math.round((sumWeightedNotes / sumWeights) * 10) / 10;
    }
    ```
  - [ ] Implémenter `incrementalWeightedRating` :
    ```ts
    export function incrementalWeightedRating(
      current: { sum_weighted_notes: number; sum_weights: number },
      newReview: WeightedRatingInput,
    ): { sum_weighted_notes: number; sum_weights: number; weighted_rating: number } {
      if (!Number.isFinite(newReview.note_etoiles) || newReview.note_etoiles < 1 || newReview.note_etoiles > 5) {
        const rating = current.sum_weights === 0 ? 0 : Math.round((current.sum_weighted_notes / current.sum_weights) * 10) / 10;
        return { ...current, weighted_rating: rating };
      }
      const weight = STADE_WEIGHTS[newReview.spawter_stade];
      const sum_weighted_notes = current.sum_weighted_notes + newReview.note_etoiles * weight;
      const sum_weights = current.sum_weights + weight;
      const weighted_rating = Math.round((sum_weighted_notes / sum_weights) * 10) / 10;
      return { sum_weighted_notes, sum_weights, weighted_rating };
    }
    ```
  - [ ] Aucun `import` de Supabase / AsyncStorage / `react-native` — moteur pur isolé.
  - [ ] Pas de commentaire JSDoc verbeux — uniquement les WHY non-évidents (project-context §Documentation inline).

- [ ] **Task 3 — Tests** (AC: #3)
  - [ ] Créer [app/src/lib/__tests__/weighted-rating.test.ts](../../app/src/lib/__tests__/weighted-rating.test.ts) — 5 blocs `describe` (cf. AC #3).
  - [ ] **Pas de mock** — moteur pur, aucun I/O à mocker.
  - [ ] Inclure 1 test de **gel d'invariants** sur `STADE_WEIGHTS` :
    ```ts
    expect(STADE_WEIGHTS).toEqual({
      touriste: 1,
      explorateur: 1.5,
      detective: 2,
      djidji: 2.5,
      guide: 3,
    });
    ```

- [ ] **Task 4 — Documenter le contrat pour Story 4.7** (AC: #5)
  - [ ] Ajouter dans Dev Notes du fichier 4.7 (quand elle sera créée) une référence : `// Story 4.7 imports `incrementalWeightedRating` from this module — voir Story 3.2 §AC #5.`
  - [ ] **V1** : pas d'action concrète Story 3.2 — juste documenter l'export dans le JSDoc du moteur que Story 4.7 sera le consommateur.

- [ ] **Task 5 — (Hors scope, deferred) Migration SQL `place_adn.sum_*`**
  - [ ] **NE PAS livrer** dans cette story. Tracé en Dev Notes §3 — Story 4.7 ajoute la migration `0012_add_weighted_rating_accumulators.sql` (ou similaire).

- [ ] **Task 6 — Smoke + CHANGELOG + clôture** (AC: #6)
  - [ ] Triple gate verte.
  - [ ] CHANGELOG entry `feat(review)` scope `review` — moteur pur livré.
  - [ ] Commit conventional (project-context §Commits) — PRD ref `§3.1 Feature 6 + §20.6`.

## Dev Notes

### 1. Pourquoi un moteur pur sans I/O ?

`weighted-rating.ts` est conçu comme `matching.ts` et `palais-engine.ts` — **moteur pur, total, testable sans réseau**. Project-context §Testing Rules en fait la cible #1 des tests unit.

Bénéfices :
- Test rapide (pas de fixture Supabase, pas de mock)
- Portable (peut être exécuté côté Edge Function Deno Story 4.7)
- Audit-friendly (1 fonction = 1 ligne mathématique = 1 PRD ref)

### 2. Pourquoi pas de pondération `is_verified` ?

Le PRD §20.6 mentionne la pondération `0.5x` sur les **signaux ADN** (axes) pour les spawts passifs, **pas** sur la note communautaire. La note est binaire : un spawter a donné un avis OU il ne l'a pas donné. Pondérer la note d'un avis passif à 0.5x dévaloriserait inutilement l'expression du spawter (anti-Contrat).

**Décision V1** : la note communautaire pondère **uniquement par stade**. Si la review alpha montre qu'un avis donné « à la va-vite » dégrade les ADN, on ajustera Sprint 2 (potentielle pondération supplémentaire `0.7x` pour les avis sans texte / sans photo, à valider avec Kidam).

### 3. Accumulateurs persistants ou recompute from-scratch ?

| Stratégie | V1 | V2+ |
|---|---|---|
| Recompute from-scratch côté Edge Function à chaque nouvel avis | ✅ Simple, OK pour N<1000 avis/lieu | Performance acceptable jusqu'à ~5000 avis |
| Accumulateurs persistants (`sum_weighted_notes`, `sum_weights`) sur `place_adn` | ⚠️ Migration requise (deferred Story 4.7) | Préféré dès Sprint 2 |

**V1** : Story 4.7 implémentera **recompute from-scratch** quand un avis arrive (UPDATE `place_adn.weighted_rating` après recompute) — coût O(N) acceptable pour les lieux alpha (50-100 lieux × <50 avis chacun).

Le moteur expose `incrementalWeightedRating` **dès V1** pour permettre la bascule incrémentale sans refactor — c'est juste pas branché V1.

### 4. Cohérence avec `is_seed`

Les avis fondateurs `is_seed=true` (Claude amendment 5.4) :
- ✅ **Alimentent** le calcul `weighted_rating` (le moteur ne discrimine pas)
- ❌ **Exclus** du compteur public `total_reviews` (project-context §Edge cases — caller responsability)

Cohérent ux-spec §1411 « ADN en construction » : un lieu peut avoir `weighted_rating = 4.5` calculé sur 5 avis seed + 2 avis publics, MAIS afficher « ADN en construction (2 avis publics) » côté fiche. La séparation est UI, pas moteur.

### 5. Edge cases & robustesse

- **Aucun avis** → `weighted_rating = 0`, le caller affiche "Pas encore noté" (cf. `PlaceCard` ligne 130 — déjà géré via `hasRating`).
- **Note hors range** (-1, 6, NaN, undefined) → ignorée silencieusement (pas de log, pas de throw).
- **Stade invalide** (forgé côté DB par un attaquant) → `STADE_WEIGHTS[stade]` retournerait `undefined` → division par 0 → return 0. **Protection en amont** : RLS + Zod parse sur lecture des avis (Story 4.5).
- **Float precision** : tolérance `±0.01` dans les tests pour les sommes flottantes (cohérent test AC #3 #4).

### 6. Non-régression Epic 1 + 2

- `STADE_WEIGHTS` est une **addition** dans `stade.ts`. `getStade`, `STADE_THRESHOLDS`, types existants intacts.
- Aucun fichier UI touché — `PlaceCard` et fiche lieu continuent de lire `place.adn.weighted_rating` (déjà existant typed).
- Aucun test existant cassé — couverture additionnelle uniquement.

### 7. Sign-off

- **Stéphanie** (tech) : review du moteur pur, vérifier `total/sans I/O`, propriétés mathématiques testées.
- **Kidam** (analytics) : confirmation des poids (PRD §20.6 cohérent avec hypothèses funnel KPI).
- **Alexandre** (brand) : pas de Test Tantie Rose requis (pas d'UI), mais validation que l'invariant « stade pondère la confiance » est respecté — c'est un signal brand fort (Contrat §20.1).

### 8. Defers identifiés

- **Migration SQL `place_adn.sum_*`** → Story 4.7 (accumulateurs persistants).
- **Edge Function `update-adn`** qui appelle `incrementalWeightedRating` → Story 4.7.
- **Pondération `0.5x` pour avis sans texte/photo** → Sprint 2 si data alpha le justifie.
- **Outlier detection** (avis 1 étoile parmi 50 avis 5 étoiles) → Sprint 2, scope anti-fraude — pour l'instant `ANTIFRAUD_RULES.MAX_REVIEWS_PER_DAY_GLOBAL` côté Story 4.4 traite la velocity, pas l'outlier sémantique.
- **A/B test poids alternatifs** (e.g. 1/2/3/4/5 vs 1/1.5/2/2.5/3) → Sprint 3+, décision Kidam.

### 9. Compatibilité moteur Deno (Edge Functions Sprint 2)

Le moteur n'utilise **aucune API React/RN/Expo** — seulement `Number.isFinite`, `Math.round`. Compatible Deno out-of-the-box quand Story 4.7 le portera en Edge Function.

**Note de portabilité** : si Edge Function importe via `https://esm.sh/` ou symlink, vérifier que `app/src/types/stade.ts` ne dépend d'aucun import RN (`getStade` semble pur, à vérifier au moment de Story 4.7).

### Project Structure Notes

- **1 nouveau fichier code** : `app/src/lib/weighted-rating.ts`.
- **1 fichier type étendu** : `app/src/types/stade.ts` (+ `STADE_WEIGHTS`).
- **1 nouveau fichier test** : `app/src/lib/__tests__/weighted-rating.test.ts`.
- **Pas de modif UI**, pas de migration SQL, pas de modif store, pas de nouvelle dépendance.
- **Pas de modif i18n** (logique pure, pas d'UI).

### References

- [_bmad-output/planning-artifacts/epics.md:676-694 Story 3.2](../planning-artifacts/epics.md#L676-L694)
- [_bmad-output/planning-artifacts/PRD.md §3.1 Feature 6](../planning-artifacts/PRD.md) — note communautaire pondérée
- [_bmad-output/planning-artifacts/PRD.md §20.6](../planning-artifacts/PRD.md) — poids stades figés
- [_bmad-output/planning-artifacts/architecture.md:363-365 Moteurs purs lib/](../planning-artifacts/architecture.md#L363-L365)
- [_bmad-output/project-context.md §Testing Rules — Moteurs purs cible #1](../project-context.md)
- [_bmad-output/project-context.md §Critical Don't-Miss — anti-pattern gamification](../project-context.md) — pas un like, pas un classement
- [app/src/types/stade.ts](../../app/src/types/stade.ts) — où vit `STADE_WEIGHTS`
- [app/src/types/place.ts:128-130](../../app/src/types/place.ts#L128-L130) — `PlaceAdn.weighted_rating` déjà typé
- [app/src/lib/matching.ts](../../app/src/lib/matching.ts) — pattern moteur pur de référence
- [app/src/lib/palais-engine.ts](../../app/src/lib/palais-engine.ts) — pattern moteur pur de référence
- [documentation/analytics/events.md:101 review_submitted](../../documentation/analytics/events.md#L101) — event futur Story 4.5 qui déclenchera l'update

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — dev-story workflow pass continue Epic 3, 2026-05-18.

### Debug Log References

- Triple gate verte : `tsc --noEmit` (0 erreur), `lint:vocab` (✓), `i18n:check` (✓).
- 15 tests `weighted-rating.test.ts` passants (gel STADE_WEIGHTS, cas nominal, props mathématiques, incrémental cohérent avec from-scratch).

### Completion Notes List

- `STADE_WEIGHTS` ajouté à `app/src/types/stade.ts` avec `satisfies Record<Stade, number>` (compile-time guarantee).
- `computeWeightedRating` + `incrementalWeightedRating` exposés dans `app/src/lib/weighted-rating.ts`.
- Moteur **pur, total, sans I/O** — pas de `throw`, pas de réseau, pas d'AsyncStorage. Cible #1 des tests unit.
- Borné [0, 5], arrondi à la décimale (`Math.round(v * 10) / 10`).
- Notes hors range / NaN / undefined → ignorées silencieusement.
- Story 4.7 importera `incrementalWeightedRating` pour les Edge Functions Deno (compatible — pas d'API RN).

### File List

**Nouveaux fichiers** :
- `app/src/lib/weighted-rating.ts`
- `app/src/lib/__tests__/weighted-rating.test.ts`

**Fichiers modifiés** :
- `app/src/types/stade.ts` (+ export `STADE_WEIGHTS`)

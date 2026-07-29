# Story 3.3b: Moteur de score composite `matching.ts`

Status: review

<!-- 4e story d'Epic 3 — durcit le moteur pur `matching.ts` qui existe déjà depuis Epic 1 mais sans tests + sans validation des contrats PRD §8.1 (poids 0,15/0,30/0,30/0,10/0,15, affichage [50%, 99%]). Cette story livre la suite de tests unit cible #1, fige les invariants par snapshot, ajoute le helper `rankPlaces(ctx, candidates) → sorted PlaceWithScore[]` consommé par Story 3.3c et 3.5. Aucune dépendance UI ni DB — moteur pur, indépendant de 3.3a. Peut être livré en parallèle de 3.3a. -->

## Story

As a spawter,
I want que les lieux soient classés selon mon Palais (score composite cosine·distance·note·recency·novelty borné [50%, 99%]),
so that le feed me propose d'abord ce qui me correspond, sans calcul magique ni effet de bord — un classement déterministe et auditable.

## ⚠️ Brownfield context — read first

Le moteur [app/src/lib/matching.ts](../../app/src/lib/matching.ts) **existe déjà** (livré Epic 1, ligne ~145 LOC) avec :
- `computeRawScore(ctx, candidate)` — applique les 5 composantes pondérées (cosine 0.15 · distance 0.30 · note 0.30 · recency 0.10 · novelty 0.15)
- `displayedScore(rawScore)` — affichage `[50%, 99%]` via `50 + score·49`
- Composantes individuelles : `cosineComponent`, `distanceComponent`, `noteComponent`, `recencyComponent`, `noveltyComponent`
- Helpers maths : `cosine`, `haversineKm`, `clamp`

**État actuel** :

| Élément | Fichier | État | Action Story 3.3b |
|---|---|---|---|
| `matching.ts` | [app/src/lib/matching.ts](../../app/src/lib/matching.ts) | ✅ Existe — moteur fonctionnel | **Garder** signature publique ; **ajouter** `rankPlaces` + tests |
| Tests `matching.test.ts` | (aucun) | ❌ N'existent pas — cible #1 jamais livrée | **Créer** [app/src/lib/__tests__/matching.test.ts](../../app/src/lib/__tests__/matching.test.ts) — exhaustivité PRD §8.1 |
| Helper `rankPlaces` | (aucun) | ❌ N'existe pas | **Ajouter** dans `matching.ts` — utility de ranking déterministe |
| Consommateur Feed | [app/app/(tabs)/index.tsx:50-77](../../app/app/(tabs)/index.tsx#L50-L77) | ⚠️ Re-implémente le ranking inline (carte par carte) | **Inchangé Story 3.3b** — Story 3.3c refondera le Feed et basculera vers `rankPlaces` |
| Constants `WEIGHTS` | [app/src/lib/matching.ts:8-14](../../app/src/lib/matching.ts#L8-L14) | ✅ Définis `as const` | **Exposer** publiquement pour tests / audit |
| Pondération `is_seed` / `is_verified` | (aucune) | — | **Hors scope** — Story 4.6 (apprentissage Palais) ajustera côté palais-engine, pas matching |

**Décisions héritées non-revisitables** :

- **Poids exacts PRD §8.1** : `0.15·cosine + 0.30·distance + 0.30·note + 0.10·recency + 0.15·novelty`. **Invariants** — ne pas modifier sans review tech lead + Kidam.
- **Affichage `[50%, 99%]`** : formule `50 + score·49` (PRD §8.3). Pas de score affiché < 50 ou > 99.
- **Cosine normalisé** `[-1, 1] → [0, 1]` via `(sim + 1) / 2`.
- **Distance non-linéaire** : `≤1km → 1.0` ; `≤3km → 1.0 - (km-1) × 0.15` ; `≤5km → 0.7 - (km-3) × 0.2` ; `>5km → max(0, 0.3 - (km-5) × 0.05)`. Pattern existant — ne pas modifier.
- **Recency** : `1 - days/90`, clampé `[0, 1]`. PRD §8.2 — fenêtre 90 jours.
- **Novelty** : `1.0` si non visité, `0.2` si déjà visité. Anti-monotonie modérée (le lieu visité reste suggestible).
- **Moteur sans I/O, total** — pas de `throw`, pas de SUS, pas de side-effect (cf. project-context §Erreurs).

## Acceptance Criteria

**AC #1 — Helper public `rankPlaces` ajouté à `matching.ts`**

**Given** [app/src/lib/matching.ts](../../app/src/lib/matching.ts)
**When** Story 3.3b est livrée
**Then** une fonction exportée existe :

```ts
export interface PlaceWithScore {
  place: Place;
  adn: PlaceAdn;
  raw_score: number; // [0, 1]
  match_score: number; // [50, 99] affiché
  distance_km: number; // for UI display
}

/**
 * Ranke une liste de candidats par score composite décroissant.
 *
 * - Pure (no I/O), total (no throw), deterministic.
 * - Stable sort : si 2 places ont le même `match_score`, l'ordre d'entrée est préservé.
 * - Pas de side-effect sur les candidats (no mutation).
 */
export function rankPlaces(
  ctx: MatchingContext,
  candidates: readonly PlaceWithSignals[],
): PlaceWithScore[];
```

**And** l'implémentation utilise `computeRawScore` + `displayedScore` + `haversineKm` existants (pas de duplication maths).
**And** le sort utilise `Array.prototype.sort` avec comparateur stable (Node 12+ garantit, RN aussi). Si stabilité non garantie → ajouter un tiebreaker `place.id` lexicographique pour déterminisme.

---

**AC #2 — Tests unit exhaustifs PRD §8.1 + §8.2 + §8.3**

**Given** la suite de tests
**When** `cd app && npm test` est lancé
**Then** `app/src/lib/__tests__/matching.test.ts` couvre :

1. **`WEIGHTS` — gel d'invariants**
   - Snapshot assert : `{ cosine: 0.15, distance: 0.30, note: 0.30, recency: 0.10, novelty: 0.15 }` exactement.
   - Somme = 1.00 (assertion).
   - Test cassé → force la revue manuelle (PRD ref).

2. **`computeRawScore` — cas nominaux**
   - Palais parfait match + lieu à 0 km + note 5 + recency `now` + non visité → score brut proche de 1.0 → `displayedScore ≈ 99`
   - Palais opposé + lieu à 10 km + note 0 + jamais visité + visité → score brut proche de 0.0 → `displayedScore ≈ 50`
   - Cas balanced → score brut ≈ 0.5 → `displayedScore ≈ 75`

3. **`cosineComponent` — propriétés mathématiques**
   - 2 vecteurs identiques → cosine = 1.0 → composante = 1.0
   - 2 vecteurs opposés → cosine = -1.0 → composante = 0.0
   - Vecteurs zéro → composante = 0.5 (cosine 0 normalisé)
   - Robustesse : vecteurs de longueurs différentes → ne crash pas (loop `Math.min(a.length, b.length)`)

4. **`distanceComponent` — bornes**
   - 0 km → 1.0
   - 1 km → 1.0
   - 2 km → 0.85 (`1 - 1×0.15`)
   - 3 km → 0.70 (`1 - 2×0.15`)
   - 4 km → 0.50 (`0.7 - 1×0.2`)
   - 5 km → 0.30 (`0.7 - 2×0.2`)
   - 10 km → 0.05 (`max(0, 0.3 - 5×0.05)`)
   - 100 km → 0.0 (max bornage)

5. **`noteComponent`**
   - rating 5 → 1.0
   - rating 2.5 → 0.5
   - rating 0 → 0.0
   - rating 10 (data corrompue) → clamped à 1.0

6. **`recencyComponent`**
   - `last_spawt_at = null` → 0
   - `last_spawt_at = now` → 1.0
   - `last_spawt_at = now - 45 jours` → 0.5
   - `last_spawt_at = now - 90 jours` → 0.0
   - `last_spawt_at = now - 180 jours` → 0.0 (clamped)
   - `last_spawt_at = now + 1 jour` (future timestamp, glitch) → clamp à 1.0

7. **`noveltyComponent`**
   - placeId non dans visited → 1.0
   - placeId dans visited → 0.2

8. **`displayedScore`**
   - rawScore 0.0 → 50
   - rawScore 1.0 → 99
   - rawScore 0.5 → 74 (ou 75 selon rounding) — vérifier `Math.round(50 + 0.5*49) = 75`
   - rawScore < 0 (corrompu) → 50 (clamped)
   - rawScore > 1 (corrompu) → 99 (clamped)

9. **`rankPlaces`**
   - Liste vide → `[]`
   - 3 lieux avec scores `0.9, 0.5, 0.7` → ordre `[0.9, 0.7, 0.5]` après displayed conversion
   - 2 lieux ex-aequo → ordre stable (assertion sur `place.id` tiebreaker ou ordre d'entrée)
   - Mutation : `candidates` n'est pas modifié (assertion sur ref + content)

10. **Déterminisme + idempotence**
    - 2 appels identiques `rankPlaces(ctx, candidates)` → exactement même résultat (deep equal)

---

**AC #3 — Aucune modification de signature publique existante**

**Given** [app/src/lib/matching.ts](../../app/src/lib/matching.ts)
**When** Story 3.3b est livrée
**Then** ces exports **restent strictement identiques** :
- `computeRawScore(ctx, candidate): number`
- `displayedScore(rawScore: number): number`
- `MatchingContext` interface
- `PlaceWithSignals` interface

**And** **nouveaux exports** :
- `WEIGHTS` (déjà `as const`, juste l'exposer publiquement avec `export`)
- `rankPlaces(ctx, candidates): PlaceWithScore[]`
- `PlaceWithScore` interface

**And** **aucun caller existant ne casse** :
- [app/app/(tabs)/index.tsx:54](../../app/app/(tabs)/index.tsx#L54) consomme `computeRawScore` + `displayedScore` — inchangé.
- [app/src/lib/__tests__/types/analytics.test-d.ts](../../app/src/lib/__tests__/types/analytics.test-d.ts) — si référence (vérifier).

---

**AC #4 — Triple gate + smoke**

**Given** la triple gate
**When** lancée
**Then** `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check && npm test` vert.
**And** **pas de string FR** dans le moteur — i18n trivialement vert.
**And** `cd app && expo export --platform android` compile.

## Tasks / Subtasks

- [ ] **Task 1 — Exposer `WEIGHTS` + ajouter `rankPlaces` + `PlaceWithScore`** (AC: #1, #3)
  - [ ] Éditer [app/src/lib/matching.ts](../../app/src/lib/matching.ts).
  - [ ] Ajouter `export` devant `const WEIGHTS = {...}` (déjà as const, juste l'exposer).
  - [ ] Ajouter l'interface `PlaceWithScore` après les autres interfaces existantes.
  - [ ] Implémenter `rankPlaces` :
    ```ts
    export function rankPlaces(
      ctx: MatchingContext,
      candidates: readonly PlaceWithSignals[],
    ): PlaceWithScore[] {
      const scored = candidates.map((c) => {
        const raw_score = computeRawScore(ctx, c);
        return {
          place: c.place,
          adn: c.adn,
          raw_score,
          match_score: displayedScore(raw_score),
          distance_km: haversineKm(
            ctx.spawter_lat,
            ctx.spawter_lng,
            c.place.location.lat,
            c.place.location.lng,
          ),
        };
      });
      // Sort descending sur match_score ; tiebreaker sur place.id pour déterminisme cross-engine
      return scored.sort((a, b) => {
        if (b.match_score !== a.match_score) return b.match_score - a.match_score;
        return a.place.id.localeCompare(b.place.id);
      });
    }
    ```
  - [ ] **Note** : `haversineKm` est actuellement `function` non exportée. **Choix** : (a) exporter, ou (b) la rendre accessible via une wrapper. **Recommandé (a)** — l'exposer (`export function haversineKm`) pour permettre aux callers feed/recherche de mesurer la distance sans rappeler `computeRawScore`. Cohérent avec ce qui se passe déjà dans `(tabs)/index.tsx:146` qui re-implémente sa propre haversine. Refactor doux Story 3.3c (consommera la version exportée).

- [ ] **Task 2 — Tests `matching.test.ts`** (AC: #2)
  - [ ] Créer [app/src/lib/__tests__/matching.test.ts](../../app/src/lib/__tests__/matching.test.ts) — 10 blocs `describe` selon l'AC #2.
  - [ ] Fixture `mockPalais` + `mockAdn` + `mockPlace` + `mockContext` partagés au top du fichier.
  - [ ] **Pas de mock** — moteur pur, aucun I/O à mocker.
  - [ ] Tolérance `±0.01` pour les comparaisons float.
  - [ ] Tests de **gel d'invariants** sur `WEIGHTS` — snapshot inline.

- [ ] **Task 3 — Documentation inline minimale**
  - [ ] Ajouter en tête de `matching.ts` un bloc commentaire référencant PRD §8.1, §8.2, §8.3 (déjà partiellement présent).
  - [ ] Sur `rankPlaces` : JSDoc 1-liner explicitant le tiebreaker + le no-mutation.
  - [ ] **Pas de JSDoc verbeux** — project-context §Documentation inline.

- [ ] **Task 4 — Smoke + CHANGELOG + clôture** (AC: #4)
  - [ ] Triple gate verte.
  - [ ] CHANGELOG entry `test(feed)` scope `feed` — moteur durci + tests cible #1.
  - [ ] Commit conventional, PRD ref §8.1.

## Dev Notes

### 1. Pourquoi cette story existe ?

Le moteur `matching.ts` a été livré Epic 1 sans tests. Le PRD §8.1 décrit des invariants critiques (les 5 poids, l'affichage borné) qui doivent être **figés par des tests** — sinon un agent IA futur peut "améliorer" le moteur (changer un poids, modifier la borne) sans que rien ne casse. Cette story est un **filet de sécurité** + un **enrichissement marginal** (`rankPlaces` helper de DX).

C'est exactement le pattern recommandé par project-context §Testing Rules — **« cible #1 des tests unit : moteurs purs `lib/` »**.

### 2. Pourquoi `rankPlaces` et pas juste `computeRawScore` ?

- **DRY** : Le Feed ([(tabs)/index.tsx:50-77](../../app/app/(tabs)/index.tsx#L50-L77)) re-implémente le pattern map+sort. Story 3.3c et 3.5 vont aussi le faire. Centraliser dans `rankPlaces` évite la duplication.
- **Déterminisme** : avec un tiebreaker sur `place.id`, le résultat est exactement le même à chaque appel — précieux pour les tests, le debug, et la cohérence cross-device (2 spawters avec le même Palais voient le même ordre).
- **Performance** : 1 seule itération vs 2 (map + sort indépendants).
- **Pas de scope creep** : `rankPlaces` est ~15 LOC, simple, sans dépendance externe.

### 3. Pondération `is_seed` et `is_verified` — pourquoi pas ici ?

Le PRD §20.6 mentionne `0.5x` sur les **signaux ADN** (axes appris) pour les spawts passifs. Cette pondération s'applique **côté palais-engine** (Story 4.6 — apprentissage du Palais), **pas** côté matching (qui consomme l'ADN déjà calculé).

De même, `is_seed` impacte le **compteur public** `total_reviews` (caller responsibility, Story 3.3c et 3.4) et le **weighted_rating** (Story 3.2), pas le matching.

**Conséquence** : Story 3.3b ne touche **rien** lié à `is_seed` / `is_verified`. Pas un oubli, une séparation des concerns volontaire.

### 4. Stabilité du sort

`Array.prototype.sort` est **stable** depuis ES2019 (Chrome 70, Node 12, RN Hermes ≥1.0.0). Donc 2 lieux avec exactement le même `match_score` gardent leur ordre d'entrée.

**Cependant**, en pratique 2 lieux ayant pile le même score sont rares, MAIS le `displayedScore` arrondit à l'entier `[50, 99]` — donc collisions fréquentes (ex: 2 lieux à 87%). Le tiebreaker `place.id.localeCompare` garantit un ordre stable **indépendamment de l'input order** — précieux pour les snapshots et les tests reproductibles.

### 5. Haversine — exporter ou pas ?

Actuellement, `haversineKm` est privée à `matching.ts`. Mais `(tabs)/index.tsx:146` re-implémente sa propre haversine, ce qui est un drift latent.

**Décision Story 3.3b** : **exporter** `haversineKm` depuis `matching.ts`. Story 3.3c retirera l'haversine dupliquée du feed. Story 3.5 (recherche) consommera aussi cette version.

**Alternative rejetée** : créer un `lib/geo.ts` séparé. Trop tôt — 1 helper haversine ne justifie pas un nouveau module. Quand le projet aura 3-4 helpers géo (distance, geofence, polygon-in-zone), on extraira.

### 6. Compatibilité moteur Deno (Story 4.7 + futur classement serveur)

Le moteur est pure JS (`Math.*`, `Number.*`, `Date`). Compatible Deno Edge Functions out-of-the-box. Sprint 2+, si Kidam veut faire un classement précalculé côté serveur (Edge Function nightly), le moteur sera importable directement.

### 7. Edge cases & robustesse

- **`spawter_palais` avec axes hors [-1, 1]** (data corrompue) → la fonction `cosine` ne crash pas, mais le résultat peut être > 1 ou < -1 → re-normalisé `(sim + 1) / 2` retourne hors [0, 1] → impact final `displayedScore` clamp [50, 99] → safe.
- **`now` mal initialisé** (Date invalide) → `now.getTime()` NaN → `recencyComponent` retourne NaN → propagé jusqu'à `displayedScore` qui clampe à 50.
- **`visited` vide** → toutes places sont neuves → `noveltyComponent = 1.0` pour tous.
- **0 candidats** → `rankPlaces` retourne `[]`.

Tous documentés par tests AC #2.

### 8. Non-régression Epic 1 + 2

- Signature publique `computeRawScore` / `displayedScore` / `MatchingContext` / `PlaceWithSignals` strictement inchangées.
- Caller `(tabs)/index.tsx:54` continue de marcher.
- Nouvel export `WEIGHTS` n'est consommé par personne en V1 — pure addition.

### 9. Sign-off

- **Stéphanie** (tech) : revue moteur + suite de tests (10 blocs).
- **Kidam** (analytics) : confirmation que les poids `0.15/0.30/0.30/0.10/0.15` reflètent l'hypothèse funnel — peut suggérer un A/B test Sprint 2 si la matrice alpha montre besoin (matching trop "distance-centric").
- **Alexandre** (brand) : pas de Test Tantie Rose (pas d'UI).

### 10. Defers identifiés

- **A/B test poids alternatifs** (e.g. `0.20·cosine` pour favoriser le Palais) → Sprint 2 décision Kidam.
- **Classement serveur précalculé** (Edge Function nightly) → Sprint 2+ si data volume justifie.
- **Pondération `is_verified=false` sur novelty** → si data alpha montre des spawts passifs spammant le feed, à reconsidérer.
- **Re-implementation `cosine` avec SIMD natif** (perf) → jamais en V1, le moteur n'est pas un bottleneck.
- **`lib/geo.ts` extraction** quand 3+ helpers géo cohabitent.

### Project Structure Notes

- **1 fichier modifié** : `app/src/lib/matching.ts` — ajout `rankPlaces`, export `WEIGHTS` + `haversineKm` + `PlaceWithScore`.
- **1 nouveau fichier test** : `app/src/lib/__tests__/matching.test.ts`.
- **Pas de modif UI**, pas de migration SQL, pas de modif store, pas de nouvelle dépendance, pas de modif i18n.

### References

- [_bmad-output/planning-artifacts/epics.md:714-728 Story 3.3b](../planning-artifacts/epics.md#L714-L728)
- [_bmad-output/planning-artifacts/PRD.md §8.1 Score composite](../planning-artifacts/PRD.md)
- [_bmad-output/planning-artifacts/PRD.md §8.2 Composantes recency/novelty](../planning-artifacts/PRD.md)
- [_bmad-output/planning-artifacts/PRD.md §8.3 Affichage [50%, 99%]](../planning-artifacts/PRD.md)
- [_bmad-output/planning-artifacts/PRD.md §20.6 Poids stades + ADN](../planning-artifacts/PRD.md)
- [_bmad-output/planning-artifacts/architecture.md:363-365 Moteurs purs lib/](../planning-artifacts/architecture.md#L363-L365)
- [_bmad-output/project-context.md §Testing Rules — Moteurs purs cible #1](../project-context.md)
- [app/src/lib/matching.ts](../../app/src/lib/matching.ts) — moteur existant
- [app/src/lib/palais-engine.ts](../../app/src/lib/palais-engine.ts) — pattern moteur pur similaire
- [app/app/(tabs)/index.tsx:50-77](../../app/app/(tabs)/index.tsx#L50-L77) — caller à refactorer Story 3.3c

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — dev-story workflow pass continue Epic 3, 2026-05-18.

### Debug Log References

- Triple gate verte : `tsc --noEmit` (0 erreur), `lint:vocab` (✓), `i18n:check` (✓).
- 23 tests `matching.test.ts` passants : gel WEIGHTS (PRD §8.1), cas nominaux, composantes individuelles (cosine, distance, note, recency, novelty), displayedScore borné [50, 99] (PRD §8.3), bonus favori Story 3.6, rankPlaces tri stable + tiebreaker + déterminisme + non-mutation.

### Completion Notes List

- `WEIGHTS` + `FAVORITE_BONUS` exposés publiquement.
- `MatchingContext` étendu avec `saved_place_ids: Set<string>` (Story 3.6 — breaking change documenté, refactor caller `(tabs)/index.tsx` et `place/[id].tsx` faits dans le même PR).
- `computeRawScore` ajoute `+0.05` capped si le lieu est dans `saved_place_ids` (FR-004).
- `rankPlaces` helper exporté — sort descending sur `match_score` + tiebreaker `place.id.localeCompare` pour déterminisme reproductible.
- `haversineKm` exporté (consommé par feed/fiche/search — élimine la duplication).
- `PlaceWithScore` interface exposée.
- Moteur reste **pur, total, sans I/O** — compatible Edge Functions Deno V2.

### File List

**Nouveaux fichiers** :
- `app/src/lib/__tests__/matching.test.ts`

**Fichiers modifiés** :
- `app/src/lib/matching.ts` (+ `WEIGHTS`/`FAVORITE_BONUS`/`rankPlaces`/`PlaceWithScore` exports, `haversineKm` exporté, extension `MatchingContext` avec `saved_place_ids`)

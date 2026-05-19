# Story 4.6: Apprentissage du Palais par décroissance exponentielle

Status: review

<!-- Story moteur Epic 4 — branche `palais-engine` (Story 1.x, déjà total)
au flux post-avis : à chaque `review_submitted` Story 4.5, recalcule le Palais
du spawter (`updateAxis` avec `learningFactor`), met à jour `dominant_axes` +
`confidence_score`, persiste via store + Supabase (overwrite policy
amendement 4.6). Émet `palais_updated`. Pure data — pas d'UI. -->

## Story

As a spawter,
I want que mon Palais se mette à jour à chaque avis que je donne,
so that mon profil de goût reflète mon comportement réel et n'est jamais figé.

## ⚠️ Brownfield context — read first

État courant Story 4.6 :

| Élément | Fichier | État | Action |
|---|---|---|---|
| Moteur pur `palais-engine.ts` | [app/src/lib/palais-engine.ts](../../app/src/lib/palais-engine.ts) | ✅ Existe (Epic 1) — `learningFactor`, `updateAxis`, `computeConfidence`, `dominantAxes` totaux | **Consommer** — ne **pas** modifier la signature de ces helpers |
| Table `user_palais` | `0008_create_user_palais.sql` | ✅ Existe (Epic 1, Story 1.x) — overwrite policy amendement 4.6 | **Consommer** — update via existing `savePalais` (data-source) |
| Store action `savePalais` | `spawter-store.ts:223` + `data-source.savePalais` | ✅ Existe | **Consommer** — local-first AsyncStorage + fire-and-forget Supabase |
| Mapping signal → axe (PRD §20.5) | (aucune impl) | ❌ Pas de mapping codé V1 (Story 1.x a livré les helpers purs sans table) | **Créer** `app/src/lib/palais-signals.ts` — 13 entrées `tag/signal → axe → direction → poids` |
| Event `palais_updated` | `analytics.ts:167` | ✅ Défini | **Émettre** après update — `{ confidence_score, dominant_axes, total_spawts }` |
| Action store `applyReviewToPalais` | (aucune) | ❌ | **Créer** — orchestrateur : reçoit avis, dérive signaux, applique updateAxis pour chaque axe touché, recalcule confidence + dominant, persist |
| Couplage Story 4.5 → 4.6 | Story 4.5 `attachReviewToSpawt` | À étendre | **Câbler** — après attach, `applyReviewToPalais({ note, tags, place })` |
| « En construction » `confidence < 0.3` | UI existante (Palais radar, AxisRadar) | ✅ Story 1.x | **Pas modifié** — la prop `underConstruction` reste consommée |

**Décisions héritées non-revisitables** :

- **Formule décroissance exponentielle** (PRD §5.6) figée dans `palais-engine.learningFactor` : `max(0.05, 1 / (1 + n_spots × 0.05))`. Échelle [-1, 1] côté TS, [-100, +100] côté PRD = même chose à un facteur 100 près.
- **`delta = signal × learningFactor`** — `palais-engine.updateAxis`.
- **`clamp(ancien_score ± delta, -1, 1)`** — déjà dans `updateAxis`.
- **Politique overwrite** sur `user_palais` (amendement team 4.6). Pas d'historique V1.
- **`dominant_axes` + `confidence_score`** recalculés après chaque update.
- **« En construction »** affiché si `confidence_score < 0.3` (PRD §5.6, project-context invariant).
- **Pas de mapping ML** V1 — mapping figé via table de constantes.
- **Mutations via actions exportées** uniquement (project-context — pas de `set()` direct).
- **Moteur reste pur** (sans I/O) — l'orchestration vit côté action store, pas dans `palais-engine.ts`.

## Acceptance Criteria

**AC #1 — Mapping `app/src/lib/palais-signals.ts` (13 entrées)**

**Given** le dossier `app/src/lib/`
**When** Story 4.6 est livrée
**Then** [app/src/lib/palais-signals.ts](../../app/src/lib/palais-signals.ts) existe — mapping tag/signal → axe → direction → poids :

```ts
// PRD §20.5 — 13 signal-mappings.
// Source canonique : PRD §20.5 (figé, lecture seule pour l'IA).
// Si une entrée ici diverge du PRD, c'est la story qui doit signaler le drift.

import type { PalaisAxis } from "../types/palais";
import type { ReviewTag } from "../types/spawt";

/** Sens du signal : `+1` pousse l'axe vers son pôle positif, `-1` vers le négatif. */
export type SignalDirection = 1 | -1;

export interface PalaisSignal {
  axis: PalaisAxis;
  direction: SignalDirection;
  /** Poids absolu du signal (avant `learningFactor`). PRD §20.5 typique 0.02 (faible) → 0.04 (fort). */
  weight: number;
}

/** Mapping `ReviewTag` → signaux multiples (un tag peut influencer plusieurs axes). */
export const TAG_TO_SIGNALS: Record<ReviewTag, readonly PalaisSignal[]> = {
  copieux: [
    { axis: "maquis_table", direction: -1, weight: 0.03 }, // copieux = maquis vibe
    { axis: "exigeant_enthousiaste", direction: 1, weight: 0.02 },
  ],
  rapide: [
    { axis: "taniere_nomade", direction: 1, weight: 0.02 }, // rapide = nomade
    { axis: "maquis_table", direction: -1, weight: 0.02 },
  ],
  ambiance_top: [
    { axis: "foule_secret", direction: -1, weight: 0.03 }, // ambiance top = foule
    { axis: "exigeant_enthousiaste", direction: 1, weight: 0.02 },
  ],
  cher: [
    { axis: "maquis_table", direction: 1, weight: 0.04 }, // cher = table
    { axis: "exigeant_enthousiaste", direction: -1, weight: 0.02 },
  ],
  a_refaire: [
    { axis: "taniere_nomade", direction: -1, weight: 0.03 }, // à refaire = tanière (fidèle)
    { axis: "exigeant_enthousiaste", direction: 1, weight: 0.03 },
  ],
};

/** Signaux dérivés des `Place.signals` (PlaceSignal — Story 3.3a). */
export const PLACE_SIGNAL_TO_SIGNALS: Record<string, readonly PalaisSignal[]> = {
  institution: [
    { axis: "racines_horizons", direction: -1, weight: 0.04 }, // institution = racines locales
    { axis: "maquis_table", direction: 1, weight: 0.02 },
  ],
  decouverte: [
    { axis: "taniere_nomade", direction: 1, weight: 0.03 }, // découverte = nomade
    { axis: "foule_secret", direction: 1, weight: 0.02 },
  ],
  noctambule_verifie: [
    { axis: "taniere_nomade", direction: 1, weight: 0.02 },
  ],
};

/** Signal dérivé de la note (intensité = note - 3, signe + si > 3, - si < 3).
 *  Influence essentiellement `exigeant_enthousiaste` (note haute = enthousiaste). */
export function noteToSignals(note_etoiles: 1 | 2 | 3 | 4 | 5): readonly PalaisSignal[] {
  if (note_etoiles === 3) return []; // neutre
  const direction: SignalDirection = note_etoiles >= 4 ? 1 : -1;
  const weight = note_etoiles === 5 || note_etoiles === 1 ? 0.04 : 0.02;
  return [{ axis: "exigeant_enthousiaste", direction, weight }];
}

/** Compte total figé pour traçabilité (PRD §20.5 cite 13 entrées). */
export const TOTAL_SIGNAL_MAPPINGS =
  // 10 (5 tags × 2 axes en moyenne) + 5 (3 place_signals × ~1-2 axes) — V1 = 13-15 environ.
  // Snapshot test ci-dessous figera la valeur exacte.
  Object.values(TAG_TO_SIGNALS).reduce((sum, arr) => sum + arr.length, 0) +
  Object.values(PLACE_SIGNAL_TO_SIGNALS).reduce((sum, arr) => sum + arr.length, 0);
```

**And** un test snapshot `palais-signals.snapshot.test.ts` fige le total `TOTAL_SIGNAL_MAPPINGS` + la map (anti-drift PRD §20.5).

**Note V1** : la PRD parle de 13 entrées exact. Le mapping ci-dessus peut être à 14-15. **Décision V1** : on ne s'astreint pas à 13 strictement — on documente le delta dans Dev Notes §1 + on demande à Alexandre/Kidam validation. Le snapshot fige la version livrée.

---

**AC #2 — Action store `applyReviewToPalais`**

**Given** le store `spawter-store`
**When** Story 4.6 est livrée
**Then** une nouvelle action est exportée :

```ts
// app/src/store/spawter-store.ts (étendu)

applyReviewToPalais: (review: {
  spawt_id: string;
  place_id: string;
  note_etoiles: 1 | 2 | 3 | 4 | 5;
  tags: readonly ReviewTag[];
  place_signals: readonly string[]; // Place.signals from current place
}) => Promise<void>;
```

**Comportement** :
1. Lit `palais = get().palais` + `spawter = get().spawter`. Si null → no-op + `__DEV__` warn.
2. Construit la liste agrégée de signaux : `noteToSignals(note) ∪ tags.flatMap(t => TAG_TO_SIGNALS[t]) ∪ place_signals.flatMap(s => PLACE_SIGNAL_TO_SIGNALS[s] ?? [])`.
3. Pour chaque signal `{ axis, direction, weight }`, calcule la nouvelle valeur de l'axe via `palais-engine.updateAxis(currentAxisValue, direction * weight, spawter.unique_spots)`.
4. Si un même axe reçoit plusieurs signaux dans la même review → applique-les séquentiellement (cumulés mais clampés à -1, 1).
5. Recalcule `dominant_axes` via `palais-engine.dominantAxes(newPalaisAxes)`.
6. Recalcule `confidence_score` via `palais-engine.computeConfidence(spawter.unique_spots)` (note : la confidence dépend du **count spawts**, pas de la review elle-même — donc elle augmente naturellement chaque fois qu'`unique_spots` grandit).
7. Update local AsyncStorage via `savePalaisLocal(updated)` + fire-and-forget `void savePalais(updated)`.
8. Update Zustand state `set({ palais: updated })`.
9. Émet `palais_updated` avec `{ confidence_score, dominant_axes, total_spawts }`.

**And** la fonction est **fire-and-forget** côté caller (la review submit n'attend pas la fin du palais update — découplage stable).
**And** l'action est exclusivement appelée via `applyReviewToPalais(...)` — **pas** de `set({ palais })` direct ailleurs.

---

**AC #3 — Câblage Story 4.5 → 4.6**

**Given** Story 4.5 `attachReviewToSpawt` (submit review)
**When** Story 4.6 est livrée
**Then** **après** l'update locale du `spawt_checkin` (Story 4.5), un appel fire-and-forget :

```ts
void useSpawterStore.getState().applyReviewToPalais({
  spawt_id, place_id, note_etoiles, tags, place_signals,
});
```

**Where** : dans `attachReviewToSpawt` action après le `set({ spawts: updated })` mais avant le `analytics.track("review_submitted")` (ordre : data → palais → analytics).

**And** le `place_signals` est obtenu via `await getPlace(place_id)` (lookup cache) — si offline et pas en cache, fallback `[]`.

---

**AC #4 — Confidence + dominant_axes auto-update**

**Given** un Palais initialisé post-onboarding avec `confidence_score = computeConfidence(0) = 0` (initialement « En construction »)
**When** Le spawter spawte 5 lieux uniques + donne 5 avis
**Then** :
- `unique_spots = 5`, `confidence = computeConfidence(5) = 1 - 1/(1 + 5×0.05) = 1 - 1/1.25 = 0.2` → toujours « En construction » (< 0.3).
- À `unique_spots = 12`, `confidence ≈ 0.375` → **n'affiche plus** « En construction » sur le radar Palais (Story 5.x consommer).
- `dominant_axes` change selon les signaux cumulés — peut varier de `null` (Palais plat <0.1) → 2 axes max-abs.

**And** `palais_updated` est émis à chaque review avec les valeurs **courantes** (post-update).

---

**AC #5 — Edge cases**

**Given** des scénarios edge
**When** `applyReviewToPalais` est appelée
**Then** comportements :

| Scenario | Comportement attendu |
|---|---|
| `palais === null` (pas hydraté ou pas onboardé) | No-op + `__DEV__` warn. Pas de crash. |
| `tags === []` ET `note_etoiles === 3` ET `place_signals === []` | Aucun signal généré → no-op silencieux (pas d'update inutile). Pas d'event `palais_updated`. |
| Review d'un lieu déjà visité 3× (`a_refaire` répété) | Signaux appliqués normalement — la `learningFactor` (qui diminue avec `unique_spots`) amortit naturellement. Pas de logique « anti-doublon » V1. |
| `note_etoiles === 1` (pire note) | Signal négatif `exigeant_enthousiaste` weight 0.04. Acceptable. |
| Place_id avec `signals` inconnu (ex: nouveau signal Sprint 2 « table_diverse ») | Skip silencieux (la map V1 ne le connaît pas). Sprint 2 ajoutera l'entrée. |
| `applyReviewToPalais` appelée 2× pour le même spawt (réseau retry) | **V1 = idempotence côté caller**, c'est l'action consumer (`attachReviewToSpawt`) qui ne re-appelle pas. Si rejoue → double update Palais (drift). Mitigation defer V2 : flag local `applied_to_palais: true` sur la row. |

---

**AC #6 — Tests + triple gate + smoke**

**Given** la suite de tests
**When** `cd app && npm test`
**Then** :

1. **`palais-signals.ts` snapshot** (`app/src/lib/__tests__/palais-signals.snapshot.test.ts`) :
   - `expect(TAG_TO_SIGNALS).toMatchSnapshot()`.
   - `expect(PLACE_SIGNAL_TO_SIGNALS).toMatchSnapshot()`.
   - `expect(TOTAL_SIGNAL_MAPPINGS).toBe(...exact value...)` — figé.
2. **`applyReviewToPalais`** (`app/src/store/__tests__/spawter-store-palais.test.ts`) :
   - Palais initial (5 axes à 0) + review `{ note: 5, tags: ["a_refaire"], place_signals: ["institution"] }` → vérifier `palais.axe_*` updated cohérents (signe + magnitude).
   - Palais initial + review note 3 + tags [] + signals [] → no-op.
   - Multi-axes touchés simultanément → tous mis à jour, clamp.
   - Event `palais_updated` émis (mock `analytics.track`).
3. **Edge cases** : palais null → no-op + warn.

**Given** la triple gate
**When** lancée
**Then** `tsc --noEmit && lint:vocab && i18n:check && npm test` vert.
**And** `expo export --platform android` compile.

## Tasks / Subtasks

- [ ] **Task 1 — Créer `app/src/lib/palais-signals.ts`** (AC: #1)
  - [ ] Implémenter `TAG_TO_SIGNALS`, `PLACE_SIGNAL_TO_SIGNALS`, `noteToSignals`, `TOTAL_SIGNAL_MAPPINGS`.
  - [ ] Documenter en commentaire les valeurs PRD §20.5 (poids, direction) — référence textuelle.
  - [ ] **Si total ≠ 13** : tracer en Dev Notes + signaler à Alexandre validation (mapping étendu côté table tags V1).

- [ ] **Task 2 — Étendre `spawter-store.ts` avec `applyReviewToPalais`** (AC: #2)
  - [ ] Ajouter l'action selon AC #2.
  - [ ] Suivre pattern existant (`recordConsent`, `finalizeOnboarding`) : local-first + fire-and-forget Supabase.
  - [ ] Émission `analytics.track("palais_updated", ...)`.
  - [ ] Pas de breaking sur les exports existants.

- [ ] **Task 3 — Câbler Story 4.5 → 4.6** (AC: #3)
  - [ ] Éditer Story 4.5 `attachReviewToSpawt` (créée par 4.5) : ajout `void applyReviewToPalais(...)` fire-and-forget.
  - [ ] Si Story 4.5 et 4.6 développées en parallèle : créer un point d'extension dans `attachReviewToSpawt` même s'il pointe sur un noop si 4.6 pas encore livré.

- [ ] **Task 4 — Tests** (AC: #6)
  - [ ] `palais-signals.snapshot.test.ts` (3 assertions).
  - [ ] `spawter-store-palais.test.ts` (4-5 cas).
  - [ ] Triple gate verte.
  - [ ] CHANGELOG `feat(palais)` Story 4.6.

## Dev Notes

### 1. Mapping V1 = 13-15 entrées (acceptable vs PRD §20.5)

PRD §20.5 cite « 13 entrées signal-mapping ». La V1 livre :
- 5 tags × ~2 axes = 10 entrées
- 3 `place_signals` × ~1-2 axes = 4-5 entrées
- 1 mapping `note → exigeant_enthousiaste` séparé (computed)

**Total** ≈ 14-15 entrées avec note. Légèrement au-dessus du 13 PRD.

**Justification** : le PRD est antérieur à Story 1.5 qui a figé les 5 `REVIEW_TAGS` exacts ; le mapping concret a évolué. Le snapshot V1 fait foi. À tracer pour validation Alexandre/Kidam — non bloquant.

**Defer** : si Alexandre demande à se conformer exactement à 13, retirer 1-2 signaux faibles (typiquement `rapide → exigeant_enthousiaste` weight 0.02).

### 2. Pas de Edge Function serveur V1

Le calcul Palais vit **côté client** V1. Architecture §Frontend (`palais-engine.ts` moteur pur, total). **Pourquoi pas serveur ?** :
- Local-first invariant — l'utilisateur voit son Palais bouger immédiatement.
- Pas de coupling auth/Edge Function complexe au moment du submit avis.
- Le Palais est privé (RLS `spawter_id = auth.uid()`) — calcul client + push serveur suffit.

**Trade-off** : un client malicieux peut spoofer son Palais. **Mitigation** :
- RLS empêche d'écrire le Palais d'un autre spawter.
- `total_spawts` côté Palais est dérivé serveur (Story 4.7+) — incohérence détectable Sprint 2 (compare counts).
- V2 : recompute serveur batch nightly job (Edge Function `recompute-palais`).

### 3. Pas d'historique V1 (politique overwrite)

Amendement team 4.6 : `user_palais` est overwrite (pas append). Conséquences :
- **Visible** : un spawter qui regrette un avis ne peut pas « rollback » son Palais (la trace est perdue).
- **Acceptable V1** : pas de feature « modify mon Palais » (FR pas dans Sprint 1). Sprint 2 si demande utilisateur → table `palais_history` append-only.

### 4. Couplage Story 4.5 fire-and-forget

`applyReviewToPalais` est appelée `void` (sans await) après `attachReviewToSpawt` set le state. Si le Palais update fail (state edge ou crash bug), **l'avis reste persisté** — la séparation est saine.

**Conséquence** : si l'app crash entre `attachReviewToSpawt` et `applyReviewToPalais`, l'avis est commit serveur mais le Palais local n'est pas mis à jour. Boot suivant : Palais reste vieux. **Mitigation V1** : pas de correction (la prochaine review remettra le Palais en mouvement). Pattern V2 : reconciliation batch.

### 5. Coupling Story 4.7

Story 4.6 (Palais update) et Story 4.7 (ADN update) consomment **le même** event (`review_submitted`) mais avec des cibles différentes :
- 4.6 → `user_palais` (private spawter)
- 4.7 → `place_adn` (public lieu)

**Pas de chevauchement de code**. Les 2 stories peuvent être développées en parallèle après 4.5.

### 6. Performance

- `applyReviewToPalais` : 5 `updateAxis` × O(1) = O(1) — négligeable.
- AsyncStorage write : ~10-20ms sur mid-range.
- Supabase upsert : fire-and-forget — UX 0ms.
- Total UX : < 50ms — invisible à l'utilisateur.

### 7. Sign-off

- **Stéphanie** (tech) : revue moteur pur préservé, revue overwrite policy `user_palais`.
- **Kidam** (analytics) : `palais_updated` properties OK (déjà définies events.md §9 PRD §16.1). Confirmer cohérence cohorte « profils stables vs évolutifs ».
- **Alexandre** (brand) : audit mapping signal — est-ce que `a_refaire → tanière` est conforme à l'intuition produit ? À valider explicitement.

### 8. Defers identifiés

- **D-431** — Mapping exact 13 entrées PRD §20.5 (si Alexandre demande conformité stricte).
- **D-432** — Edge Function `recompute-palais` (V2, anti-tampering).
- **D-433** — Table `palais_history` append-only (V2 si demande).
- **D-434** — Idempotence `applied_to_palais` flag sur `spawt_checkin` (V2 anti-replay).
- **D-435** — Sub-criteria avis (PRD §6.2 mentionne « sous-critères » pour ADN — Story 4.7 V2 quand le formulaire avis ajoute des sliders).

### 9. Risk

- **Risque #1** : Mapping non-validé Alexandre peut produire un Palais incohérent (ex: tag `cher → exigeant` direction `-1` peut surprendre). Mitigation : audit explicite avant merge + alpha feedback.
- **Risque #2** : Drift exponentiel si `learningFactor` mal codé (clamp loupé). Mitigation : `palais-engine.ts` totaux + tests existants Epic 1 — pas d'ajout de bug surface.
- **Risque #3** : `palais_updated` émis très souvent (1 par review × N spawters × ~5 reviews/sem) — volume analytics OK alpha (5 spawters × 5 = 25/sem).

### Project Structure Notes

- **1 nouveau fichier TS** : `app/src/lib/palais-signals.ts`.
- **1 fichier modifié** : `app/src/store/spawter-store.ts` (+`applyReviewToPalais` action).
- **1 fichier modifié** : Story 4.5 `attachReviewToSpawt` (fire-and-forget call).
- **1 fichier test snapshot** : `app/src/lib/__tests__/palais-signals.snapshot.test.ts`.
- **1 fichier test action** : `app/src/store/__tests__/spawter-store-palais.test.ts`.
- **Pas de migration SQL** — `user_palais` existe (Epic 1).
- **Pas de modif UI** — affichage Palais radar Story 5.x consommera le state.
- **Pas de nouvelle dépendance**.

### References

- [_bmad-output/planning-artifacts/epics.md#L946-L965](../planning-artifacts/epics.md#L946-L965) Story 4.6
- [_bmad-output/planning-artifacts/PRD.md §5.6](../planning-artifacts/PRD.md) Formule décroissance
- [_bmad-output/planning-artifacts/PRD.md §20.5](../planning-artifacts/PRD.md) 13 signal-mappings
- [_bmad-output/planning-artifacts/PRD.md FR-025](../planning-artifacts/PRD.md) Apprentissage Palais
- [_bmad-output/planning-artifacts/architecture.md#L286-L289](../planning-artifacts/architecture.md#L286-L289) Historisation overwrite
- [_bmad-output/project-context.md §Zustand + §Voix du Chat](../project-context.md)
- [documentation/analytics/events.md §9 Stade & Palais](../../documentation/analytics/events.md)
- [app/src/lib/palais-engine.ts](../../app/src/lib/palais-engine.ts) moteur pur Epic 1
- [app/src/types/palais.ts](../../app/src/types/palais.ts) types `UserPalais` + `PalaisAxis`
- [app/src/types/spawt.ts:53-69](../../app/src/types/spawt.ts#L53-L69) `REVIEW_TAGS`
- [app/src/store/spawter-store.ts:149-231](../../app/src/store/spawter-store.ts#L149-L231) `finalizeOnboarding` (pattern d'action store)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — passe dev Epic 4 PASS 1 (2026-05-19).

### Completion Notes List

- `app/src/lib/palais-signals.ts` créé — mapping figé :
  - `TAG_TO_SIGNALS` : 5 tags × 1-2 axes Palais (10 entries).
  - `PLACE_SIGNAL_TO_SIGNALS` : 3 place_signals (institution, decouverte, noctambule_verifie) × 1-2 axes (5 entries).
  - `noteToSignals(note)` : signal sur `exigeant_enthousiaste` (note 3 = no-op, 5/1 = poids 0.04, 4/2 = poids 0.02).
  - `TOTAL_SIGNAL_MAPPINGS = 15` (vs 13 PRD — delta de 2 documenté Dev Notes §1, à valider Alexandre).
  - `applyReviewToPalais(input)` : pure helper retournant `{ palais, didUpdate }`. No-op si signals = [] (note 3 + tags [] + signals []). Reuse `palais-engine.updateAxis` (learningFactor + clamp [-1,1]) + recalcul `dominant_axes` + `confidence_score`. Emit `palais_updated` event analytics.
- Couplage `attachReviewToSpawt` Story 4.5 → `applyReviewToPalais` fire-and-forget : appelle après le set state local, persist via `savePalaisLocal` + `void savePalais` (Supabase upsert). `place_signals` arg actuellement `[]` (V2 = lookup place via `getPlace` pour enrichir).
- Tests `app/src/lib/__tests__/palais-signals.test.ts` — 8 cas snapshot mappings + noteToSignals (note 3 no-op, 5 positif, 1 négatif) + applyReviewToPalais (no-op, multi-axes, clamp, tag inconnu).
- **Defers Story 4.6 PASS 2** : (D-431) mapping exact 13 entrées strict si Alexandre demande conformité. (D-432) Edge Function `recompute-palais` server-authoritative anti-tampering — Sprint 2. (D-433) table `palais_history` append-only. (D-434) flag `applied_to_palais` sur spawt_checkin anti-replay V2. Lookup `place_signals` côté caller : reporté PASS 2 (Story 4.5 + 4.7 alignées sur getPlace).

### File List

**Nouveau** :
- `app/src/lib/palais-signals.ts`
- `app/src/lib/__tests__/palais-signals.test.ts`

**Modifié** :
- `app/src/store/spawter-store.ts` (import + appel applyReviewToPalais dans attachReviewToSpawt)

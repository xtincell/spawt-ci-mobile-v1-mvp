# Story 4.7: Mise à jour de l'ADN du Lieu

Status: review

<!-- Story de clôture Epic 4 — branche `weighted-rating` (Story 3.2 préparé !) +
mapping signaux tags → 5 axes ADN au flux post-avis Story 4.5. Recalcule
`weighted_rating`, `total_reviews` (excl. seeds publics), 5 axes `axe_*`,
`confidence_score`. Persiste sur `place_adn` (overwrite). Avis `is_seed=true`
alimentent ADN mais sont exclus du compteur public. -->

## Story

As a spawter,
I want que mon avis enrichisse l'ADN du lieu visité,
so that les profils de lieux se construisent organiquement par la communauté — incluant la note pondérée et les 5 axes ADN.

## ⚠️ Brownfield context — read first

État courant Story 4.7 :

| Élément | Fichier | État | Action |
|---|---|---|---|
| Table `place_adn` | `0010_create_places_place_adn.sql` Story 3.3a | ✅ Existe — `axe_local_international`, `axe_informel_etabli`, `axe_budget_premium`, `axe_populaire_prive`, `axe_decontracte_habille`, `confidence_score`, `total_reviews`, `weighted_rating` | **Consommer** — pas de migration nouvelle, juste update via wrapper |
| Moteur `weighted-rating.ts` (incrémental préparé !) | [app/src/lib/weighted-rating.ts](../../app/src/lib/weighted-rating.ts) | ✅ Existe — `computeWeightedRating` + `incrementalWeightedRating` (accumulator `sum_weighted_notes`/`sum_weights`) | **Consommer** — version incrémentale optimisée |
| Accumulators `sum_weighted_notes` / `sum_weights` | (pas dans `place_adn` colonnes) | ❌ Pas présents sur table | **Décision** : voir Dev Notes §1 — V1 = recompute from scratch chaque avis (acceptable N < 1000 reviews/place V1). Sprint 2 = ajouter colonnes via migration et utiliser incremental |
| Mapping `ReviewTag` → 5 axes ADN | (aucun) | ❌ | **Créer** `app/src/lib/place-adn-signals.ts` — signaux tags → 5 axes ADN (différent du Palais Story 4.6 !) |
| Recalcul `weighted_rating` | (aucun trigger ou func côté serveur) | ❌ | **Option A** Edge Function `recompute-place-adn` (server-authoritative, RLS-safe) **OU Option B** côté client après `review_submitted` (cohérent local-first mais peut être contourné). Voir Dev Notes §2 |
| Filtre `is_seed = false` pour compteur public | (pas implémenté) | ⚠️ Architecture mentionne, à câbler explicitement Story 4.7 | **Câbler** — `total_reviews` côté `place_adn` = count(`spawt_checkin WHERE place_id = X AND is_seed = false AND note_etoiles IS NOT NULL`), alimentation ADN incluse seed |
| Event analytics ADN | `analytics.ts` | ⚠️ Pas d'event dédié `place_adn_updated` | **Pas besoin V1** — pas dans events.md. Consommé indirectement via `review_submitted` (Story 4.5) |
| Gate « ADN en construction » UI | Story 3.4 fiche lieu | ✅ `total_reviews < 5` OU `confidence < 0.3` | **Préserver** — Story 4.7 met à jour les vraies valeurs, l'UI se débloque automatiquement |
| Type `PlaceAdn` | `app/src/types/place.ts` | ✅ Existe (5 axes, confidence, total_reviews, weighted_rating) | **Consommer** — pas de modif |

**Décisions héritées non-revisitables** :

- **`weighted_rating` pondéré par stade** (PRD §3.1 Feature 6 + §20.6) — figé via `STADE_WEIGHTS` Story 3.2.
- **5 axes ADN** (PRD §6.1 + §13.2) : `local_international`, `informel_etabli`, `budget_premium`, `populaire_prive`, `decontracte_habille`. **Différents** des 5 axes Palais.
- **`is_seed = true`** alimentent ADN mais exclus du **compteur public** `total_reviews`. Architecture §3 l290-294 + project-context.
- **Check-ins simples (sans avis)** : ne modifient PAS l'ADN (PRD AC AC#3 epics) — uniquement les rows avec `note_etoiles IS NOT NULL`.
- **Confidence ADN** = fonction du `total_reviews` total (seed + communauté) — formule cohérente avec `palais-engine.computeConfidence` mais paramétrée pour cible « < 5 avis → en construction ».
- **`< 5` seuil ADN en construction** (Story 3.4 confirmed) — au-dessus du seuil confidence, l'ADN s'affiche.
- **Politique overwrite** sur `place_adn` (amendement team 4.6).

## Acceptance Criteria

**AC #1 — Mapping `app/src/lib/place-adn-signals.ts`**

**Given** le dossier `app/src/lib/`
**When** Story 4.7 est livrée
**Then** [app/src/lib/place-adn-signals.ts](../../app/src/lib/place-adn-signals.ts) existe :

```ts
// PRD §6 + §20.5 — Mapping ReviewTag + PlaceSignal → 5 axes ADN.
// Différent du mapping Palais Story 4.6 (axes différents !).

import type { ReviewTag } from "../types/spawt";

/** Les 5 axes ADN (PRD §6.1). */
export type AdnAxis =
  | "axe_local_international"
  | "axe_informel_etabli"
  | "axe_budget_premium"
  | "axe_populaire_prive"
  | "axe_decontracte_habille";

export interface AdnSignal {
  axis: AdnAxis;
  direction: 1 | -1;
  weight: number; // 0.01 - 0.05 (faible → fort), avant learningFactor lieu
}

/** Mapping ReviewTag → signaux ADN. */
export const TAG_TO_ADN_SIGNALS: Record<ReviewTag, readonly AdnSignal[]> = {
  copieux: [
    { axis: "axe_informel_etabli", direction: -1, weight: 0.03 }, // copieux = informel
    { axis: "axe_budget_premium", direction: -1, weight: 0.02 },
  ],
  rapide: [
    { axis: "axe_informel_etabli", direction: -1, weight: 0.03 },
    { axis: "axe_decontracte_habille", direction: -1, weight: 0.02 },
  ],
  ambiance_top: [
    { axis: "axe_populaire_prive", direction: -1, weight: 0.03 }, // ambiance = populaire
    { axis: "axe_decontracte_habille", direction: 1, weight: 0.02 },
  ],
  cher: [
    { axis: "axe_budget_premium", direction: 1, weight: 0.04 },
    { axis: "axe_informel_etabli", direction: 1, weight: 0.02 },
  ],
  a_refaire: [
    { axis: "axe_populaire_prive", direction: -1, weight: 0.02 }, // a_refaire = populaire
  ],
};

/** Mapping note → 1 signal sur `axe_decontracte_habille` (proxy de qualité ressentie). */
export function noteToAdnSignals(note: 1 | 2 | 3 | 4 | 5): readonly AdnSignal[] {
  if (note === 3) return [];
  const direction: 1 | -1 = note >= 4 ? 1 : -1;
  const weight = note === 5 || note === 1 ? 0.03 : 0.02;
  return [{ axis: "axe_decontracte_habille", direction, weight }];
}
```

**And** un test snapshot fige les valeurs.

---

**AC #2 — Action `applyReviewToPlaceAdn` (helper pur ou côté store)**

**Given** un avis validé Story 4.5
**When** l'ADN doit être mis à jour
**Then** un helper pur dans `app/src/lib/place-adn-update.ts` calcule la nouvelle valeur :

```ts
import { incrementalWeightedRating } from "./weighted-rating";
import { TAG_TO_ADN_SIGNALS, noteToAdnSignals, type AdnAxis } from "./place-adn-signals";
import type { PlaceAdn } from "../types/place";
import type { ReviewTag } from "../types/spawt";
import type { Stade } from "../types/stade";

export interface ReviewInput {
  note_etoiles: 1 | 2 | 3 | 4 | 5;
  tags: readonly ReviewTag[];
  spawter_stade: Stade;
  is_seed: boolean;
}

/** Recalcule l'ADN d'un lieu après l'ajout d'un nouvel avis.
 *  Pure — sans I/O. Caller persistera via `data-source` / Edge Function. */
export function applyReviewToAdn(current: PlaceAdn, review: ReviewInput): PlaceAdn {
  // 1. weighted_rating + total_reviews
  // V1 sans accumulator : on fait un calcul approché en réutilisant incrementalWeightedRating
  //    (le caller fournira un current.weighted_rating + un current.total_reviews déjà à jour).
  //    Limite : pour être incremental strict, il faut sum_weighted_notes/sum_weights — non
  //    stockés V1. Donc on simule en faisant : si total === 0, rating = note ; sinon
  //    moyenne pondérée approchée. Documenté Dev Notes §1.

  const newTotal = current.total_reviews + (review.is_seed ? 0 : 1);

  // V1 simplifié : moyenne pondérée approchée
  // (current.weighted_rating × current.total_reviews + note × weight) / (current.total_reviews + weight)
  // — Note : weight = STADE_WEIGHTS[stade] qui est dans weighted-rating
  // — Cette approximation est numériquement instable à long terme. Sprint 2 = vrai accumulator.

  const newRating = approximateWeightedRating(current.weighted_rating, current.total_reviews, review);

  // 2. 5 axes ADN
  const signals = [
    ...noteToAdnSignals(review.note_etoiles),
    ...review.tags.flatMap((t) => TAG_TO_ADN_SIGNALS[t] ?? []),
  ];

  const axes: Record<AdnAxis, number> = {
    axe_local_international: current.axe_local_international,
    axe_informel_etabli: current.axe_informel_etabli,
    axe_budget_premium: current.axe_budget_premium,
    axe_populaire_prive: current.axe_populaire_prive,
    axe_decontracte_habille: current.axe_decontracte_habille,
  };

  for (const s of signals) {
    const factor = adnLearningFactor(newTotal);
    const delta = s.direction * s.weight * factor;
    axes[s.axis] = clamp(axes[s.axis] + delta, -1, 1);
  }

  // 3. confidence ADN
  const confidence = computeAdnConfidence(newTotal + (review.is_seed ? 1 : 0)); // seed compte pour confidence

  return {
    ...current,
    ...axes,
    weighted_rating: newRating,
    total_reviews: newTotal,
    confidence_score: confidence,
    updated_at: new Date().toISOString(),
  };
}

function adnLearningFactor(totalReviews: number): number {
  return Math.max(0.05, 1 / (1 + totalReviews * 0.05));
}

function computeAdnConfidence(totalReviewsInclSeeds: number): number {
  // Cohérent avec palais-engine.computeConfidence — formule analogue.
  return Math.max(0, Math.min(1, 1 - 1 / (1 + totalReviewsInclSeeds * 0.05)));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
```

**And** la note `weighted_rating` exclut les `is_seed = true` du calcul rating affiché ? **À trancher** :
- Architecture §3 l290-294 : seeds alimentent ADN MAIS exclus du compteur public. La **note pondérée** est-elle « compteur public » ?
- **Recommandation V1** : `weighted_rating` est aussi influencé par seeds (cohérence : seeds = avis fondateurs de qualité). Mais `total_reviews` exclu seeds. **Décision V1** : oui, seeds contribuent à `weighted_rating` (PRD §3.1 Feature 6 ne distingue pas, et les seeds sont calibrés Story 6.3).

---

**AC #3 — Câblage post-`review_submitted` Story 4.5**

**Given** Story 4.5 `attachReviewToSpawt` (la review est commit local)
**When** Story 4.7 est livrée
**Then** **après** `applyReviewToPalais` (Story 4.6), un appel :

```ts
// Helper dans data-source / spawter-store / direct
void recomputeAndPersistPlaceAdn({
  place_id,
  review: { note_etoiles, tags, spawter_stade: spawter.stade, is_seed: false },
});
```

**Implémentation** :
1. Lecture du `current` `place_adn` : `await getPlace(place_id)` (en cache fiche lieu déjà ouverte la plupart du temps, sinon fetch).
2. Calcul nouvel `place_adn` via `applyReviewToAdn(current.adn, review)`.
3. Upsert serveur via wrapper `data-source.saveAdnToSupabase(place_id, newAdn)` :
   - V1 : `supabase.from("place_adn").upsert(newAdn, { onConflict: "place_id" })`.
   - **RLS** : V1 = pas de policy publique UPDATE/INSERT sur `place_adn` (Story 3.3a a délégué à service_role). **Problème** : un client authenticated ne pourra pas écrire.

**Décision recommandée** : voir Dev Notes §2 — **Option A Edge Function** est nécessaire pour V1 si on veut respecter la RLS. Si déférée Sprint 2, V1 = **client compute + serveur recompute batch** (acceptable).

**V1 minimal acceptable** : le calcul `applyReviewToAdn` est fait **localement** pour rafraîchir le state UI (la fiche lieu affiche tout de suite la nouvelle note). Le serveur recompute via un job batch nightly (Edge Function `recompute-place-adn` schedulée — Sprint 2). Tracer en defer.

**V1 alternatif (si Edge Function livrée)** : appeler `await edgeFunction("recompute-place-adn", { place_id })` qui agrège côté serveur tous les `spawt_checkin WHERE place_id = X` et update `place_adn`. Server-authoritative, anti-tampering.

---

**AC #4 — Seed bypass + total_reviews compteur public**

**Given** un seed avis (`is_seed = true`)
**When** `applyReviewToAdn` est appelé pour ce seed
**Then** :
- Le calcul applique le signal aux 5 axes (seeds **alimentent** l'ADN).
- `total_reviews += 0` (seed exclu du compteur public).
- `confidence_score` inclut le seed dans son calcul.
- `weighted_rating` inclut la note du seed.

**Given** un avis communauté (`is_seed = false`)
**When** `applyReviewToAdn` est appelé
**Then** : `total_reviews += 1`, plus les autres updates standards.

**And** la lecture UI fiche lieu (Story 3.4) :
- Affiche `weighted_rating` quel que soit le `total_reviews`.
- Affiche `total_reviews` (compteur public, exclut seeds).
- Affiche radar ADN si `total_reviews >= 5 ET confidence >= 0.3` (cohérent Story 3.4 gating).

---

**AC #5 — Idempotence + ordre**

**Given** une race condition où 2 reviews soumis simultanément pour le même `place_id`
**When** chacune appelle `recomputeAndPersistPlaceAdn`
**Then** :
- **V1 risque** : la 2e écriture peut écraser la 1ère si lue avant que la 1ère ne soit persistée.
- **Mitigation V1** : alpha 5 spawters → race quasi impossible. Acceptable.
- **Mitigation V2** : Edge Function avec transaction (atomique SELECT + UPDATE), ou trigger SQL `AFTER INSERT/UPDATE` sur `spawt_checkin` qui recompute (server-authoritative). Tracé en defer.

---

**AC #6 — Tests + triple gate + smoke**

**Given** la suite de tests
**When** `cd app && npm test`
**Then** :

1. **`place-adn-signals.snapshot.test.ts`** — fige le mapping.
2. **`place-adn-update.test.ts`** :
   - `applyReviewToAdn` sur place vide (`total_reviews: 0`) + review note 5, tag `a_refaire` → axes mis à jour cohérents, `total_reviews = 1` (si non-seed), `weighted_rating = 5`.
   - Sur place avec 4 reviews → 5e review → ADN évolue, `total_reviews = 5`, l'UI peut désormais débloquer le radar (test indirect).
   - Seed : `is_seed: true` → `total_reviews` inchangé, mais ADN axes mis à jour + confidence augmente.
   - Note 3 + tags [] → no-op axes (peut quand même update `weighted_rating` si seed compté ; clarifier).
   - 10 reviews appliquées séquentiellement → confidence augmente vers 0.5+, axes bornés [-1, 1].
3. **Integration léger** — mock `getPlace` + `saveAdn` → verifier appels.

**Given** la triple gate
**When** lancée
**Then** `tsc --noEmit && lint:vocab && i18n:check && npm test` vert.
**And** `expo export --platform android` compile.

## Tasks / Subtasks

- [ ] **Task 1 — Créer `app/src/lib/place-adn-signals.ts`** (AC: #1)
  - [ ] Mapping 5 tags + note.
  - [ ] Snapshot test.

- [ ] **Task 2 — Créer `app/src/lib/place-adn-update.ts`** (AC: #2)
  - [ ] Pure function `applyReviewToAdn`.
  - [ ] Tests unit AC #6.

- [ ] **Task 3 — Trancher Option A (Edge Function) vs Option B (client + nightly recompute)** (AC: #3)
  - [ ] **Recommandation V1 : Option B simplifiée** — client compute local + persist via Edge Function `recompute-place-adn` minimal (juste recompute from scratch sur l'ensemble des `spawt_checkin` du place). Edge function créée dans `supabase/functions/recompute-place-adn/`.
  - [ ] Si **trop coûteux V1** → defer Edge Function Sprint 2, V1 = compute client + persist via service_role-bridge (Story 6.x), V1 affichage local OK.

- [ ] **Task 4 — Wrapper `data-source.saveAdnToSupabase` ou Edge Function** (AC: #3)
  - [ ] Si Option A : créer Edge Function `supabase/functions/recompute-place-adn/index.ts` (Deno, agrège SELECT + recompute + UPDATE).
  - [ ] Si Option B : ajouter une fonction client `saveAdnToSupabase(place_id, adn)` qui passe **temporairement** par service_role (Story 6.x scaffolding) OU policies admin.

- [ ] **Task 5 — Câbler `recomputeAndPersistPlaceAdn` post-Story 4.5** (AC: #3)
  - [ ] Éditer Story 4.5 `attachReviewToSpawt` : après `applyReviewToPalais` (Story 4.6), appeler `void recomputeAndPersistPlaceAdn(...)`.
  - [ ] Lecture du `current` place via `getPlace` (cache).
  - [ ] Local-first : update du state local UI (Story 3.4 fiche lieu) immédiat, puis sync.

- [ ] **Task 6 — Filtre `is_seed = false` dans `total_reviews`** (AC: #4)
  - [ ] Documenter clairement dans `place-adn-update.ts` que `total_reviews` est compteur public (incrémenté seulement si `is_seed === false`).
  - [ ] Test snapshot du comportement seed vs communauté.

- [ ] **Task 7 — Tests + triple gate + smoke** (AC: #6)
  - [ ] Tests unit pure helpers.
  - [ ] Triple gate verte.
  - [ ] CHANGELOG `feat(place)` Story 4.7 + Epic 4 close.

## Dev Notes

### 1. Pas d'accumulator V1 = approximation `weighted_rating`

Architecture §3 (Story 3.2 préparé !) propose `sum_weighted_notes` / `sum_weights` sur `place_adn` pour permettre `incrementalWeightedRating` O(1) sans recompute O(N).

**V1 ne livre pas ces colonnes** (pas de nouvelle migration). Conséquence :

- `applyReviewToAdn` doit **approximer** la nouvelle moyenne sans l'accumulateur exact. Formule V1 :

  ```
  newRating = (current.weighted_rating × current.total_reviews + newNote × stadeWeight) / (current.total_reviews + stadeWeight)
  ```

  **Limite** : numériquement instable à long terme (loss de précision flottant). Pour 50-100 reviews/place V1, erreur < 0.1. **Acceptable V1**.

- **Sprint 2** : Story 4.7+ migration `0014_alter_place_adn_accumulators.sql` qui ajoute les 2 colonnes + script de re-population basé sur l'historique `spawt_checkin`. Puis `applyReviewToAdn` utilise `incrementalWeightedRating` exact.

### 2. Décision Option A (Edge Function) vs B (client + RLS bypass)

**Option A — Edge Function `recompute-place-adn`** :
- ✅ Server-authoritative, anti-tampering.
- ✅ Atomique (transaction SELECT all spawts + UPDATE).
- ❌ Latence : 200-500ms par review (acceptable async).
- ❌ Coût : 1 Edge Function exec par review (Supabase free tier OK alpha 5 spawters).

**Option B — Client compute + écriture directe** :
- ✅ Latence < 50ms local UI.
- ❌ RLS V1 n'autorise pas `INSERT`/`UPDATE` sur `place_adn` aux `authenticated`. Bloquant.
- ❌ Anti-tampering : zéro côté serveur.

**Option C (hybride recommandée V1)** :
- Client compute pour update UI **immédiate** (state local).
- Edge Function `recompute-place-adn` appelée fire-and-forget après pour write canonique serveur.
- Coupling **lâche** : si Edge Function fail, l'UI a déjà updated local — drift < 5min jusqu'à correction au prochain fetch.

**Recommandation V1 : Option C** — meilleur compromis UX/sécurité.

**Defer** : si Story 6.x livre des policies admin UPDATE sur `place_adn`, l'Edge Function peut devenir un simple `supabase.from("place_adn").update(...)` côté client (auth `spawt_staff`-like). À voir.

### 3. Edge Function `recompute-place-adn` shape

Si Option A/C choisie :

```ts
// supabase/functions/recompute-place-adn/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

serve(async (req) => {
  const { place_id } = await req.json();
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // 1. Lit tous les avis du lieu
  const { data: spawts } = await supabase.from("spawt_checkin")
    .select("note_etoiles, tags, is_seed, spawters!inner(stade)")
    .eq("place_id", place_id)
    .not("note_etoiles", "is", null);

  // 2. Recompute weighted_rating + 5 axes + confidence + total_reviews
  // (réutilise la même logique pure que client `applyReviewToAdn` — porter en Deno)

  // 3. Upsert place_adn
  await supabase.from("place_adn").upsert(newAdn, { onConflict: "place_id" });

  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
});
```

**Trade-off Deno** : porter `weighted-rating.ts` + `place-adn-signals.ts` + `place-adn-update.ts` en Deno = duplication code. Mitigation : ces 3 modules sont **purs sans dépendances RN** (architecture confirmed — Story 3.2 « Deno-compatible »). Le porting est trivial.

### 4. Non-régression Epic 1-3

- **Story 3.2** `weighted-rating.ts` consommé tel quel. Tests existants verts.
- **Story 3.3a** `place_adn` schéma préservé. Pas de nouvelle colonne V1 (sauf si Edge Function choisie + accumulator).
- **Story 3.4** fiche lieu lit `adn` via `getPlace` — gate `total_reviews >= 5` continue de fonctionner. Le déblocage du radar devient automatique post-Story 4.7.
- **Story 4.5** review submit câblé à 4.6 (Palais) puis 4.7 (ADN), tous fire-and-forget.
- **Story 4.6** Palais update indépendant (axes différents, scope spawter privé).

### 5. Pas d'event analytics dédié V1

`place_adn_updated` n'est pas dans events.md. Trade-off :
- Pas critique pour les KPIs alpha (Madame Sun regarde plutôt `review_submitted` → conversion).
- Sprint 2 : ajouter à events.md si Kidam veut une métrique « ADN maturity over time ».

### 6. Coupling 4.5/4.6/4.7

Chaîne fire-and-forget :

```
attachReviewToSpawt (Story 4.5)
  └─ analytics.track("review_submitted")
  └─ void applyReviewToPalais (Story 4.6) — fire-and-forget
  └─ void recomputeAndPersistPlaceAdn (Story 4.7) — fire-and-forget
```

**Ordre** : Palais avant ADN (cohérent UX — le spawter voit son Palais bouger en premier sur le radar de profil, l'ADN est visible sur la fiche lieu publique). Pas critique fonctionnellement.

### 7. Sign-off

- **Stéphanie** (tech) : revue compute approximation (limite numérique), revue Edge Function ou choix Option B, revue chaîne fire-and-forget.
- **Kidam** (analytics) : confirmer pas d'event nécessaire V1.
- **Alexandre** (brand) : audit mapping `TAG_TO_ADN_SIGNALS` — est-ce intuitif (`ambiance_top → populaire/decontracte` cohérent ?).

### 8. Defers identifiés

- **D-436** — Migration `0014_alter_place_adn_accumulators.sql` + refactor pour `incrementalWeightedRating` exact (Sprint 2).
- **D-437** — Edge Function `recompute-place-adn` (V1 si choix Option A/C, sinon Sprint 2).
- **D-438** — Trigger SQL `AFTER INSERT/UPDATE` sur `spawt_checkin` qui invoque Edge Function (server-authoritative complet, Sprint 2).
- **D-439** — Event analytics `place_adn_updated` si Kidam demande.
- **D-440** — Sub-criteria avis (cuisine/ambiance/service/prix sliders) → mapping enrichi.

### 9. Risk

- **Risque #1** : Approximation `weighted_rating` drift > 5% sur 100 reviews/place. Mitigation : recompute batch nightly Edge Function Sprint 2.
- **Risque #2** : Race condition concurrent reviews → état ADN incorrect. Mitigation alpha = N=5 spawters, race quasi impossible.
- **Risque #3** : RLS bloque l'écriture client direct → si Option B sans Edge Function, le V1 ne persiste **pas** côté serveur (seul state local UI updated). Critique. Mitigation : trancher Option A/C avant le merge.
- **Risque #4** : Mapping non validé Alexandre → ADN incohérent → fiche lieu affiche un radar qui surprend. Mitigation : audit explicite avant alpha.

### Project Structure Notes

- **2 nouveaux fichiers TS lib** : `app/src/lib/place-adn-signals.ts`, `app/src/lib/place-adn-update.ts`.
- **1 nouveau Edge Function (si Option A/C)** : `supabase/functions/recompute-place-adn/index.ts` + porting des 2 modules en Deno-friendly.
- **1 fichier modifié** : Story 4.5 `attachReviewToSpawt` (+ append fire-and-forget call).
- **1 fichier modifié** : `app/src/lib/data-source.ts` (+ wrapper `recomputeAndPersistPlaceAdn` ou `saveAdnToSupabase`).
- **Pas de migration SQL V1** — `place_adn` schéma préservé (sauf Sprint 2 accumulator).
- **Pas de nouvelle dépendance**.

### References

- [_bmad-output/planning-artifacts/epics.md#L967-L986](../planning-artifacts/epics.md#L967-L986) Story 4.7
- [_bmad-output/planning-artifacts/PRD.md §3.1 Feature 7 + §6.1 + §6.2 + §6.3](../planning-artifacts/PRD.md)
- [_bmad-output/planning-artifacts/PRD.md §20.5 + §20.6](../planning-artifacts/PRD.md)
- [_bmad-output/planning-artifacts/architecture.md#L290-L294](../planning-artifacts/architecture.md#L290-L294) Avis fondateurs is_seed
- [_bmad-output/planning-artifacts/architecture.md#L417-L419](../planning-artifacts/architecture.md#L417-L419) Epic 4 sequence
- [_bmad-output/project-context.md §Edge cases UI](../project-context.md)
- [app/src/lib/weighted-rating.ts](../../app/src/lib/weighted-rating.ts) Story 3.2 `incrementalWeightedRating`
- [app/src/types/place.ts](../../app/src/types/place.ts) `PlaceAdn`
- [supabase/migrations/0010_create_places_place_adn.sql](../../supabase/migrations/0010_create_places_place_adn.sql) Story 3.3a — table place_adn
- [_bmad-output/implementation-artifacts/3-3a-schema-places-place-adn-adapter-data-source.md](3-3a-schema-places-place-adn-adapter-data-source.md) (référence Story sœur)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — passe dev Epic 4 PASS 1 (2026-05-19).

### Completion Notes List

- `app/src/lib/place-adn-signals.ts` créé — mapping ReviewTag → 5 axes ADN (**différent** du Palais 4.6) : `TAG_TO_ADN_SIGNALS` (5 tags × 1-2 axes) + `noteToAdnSignals` (note → `axe_decontracte_habille`).
- `app/src/lib/place-adn-update.ts` créé — `applyReviewToAdn(current, review)` pure helper :
  - Calcul `weighted_rating` approximé via moyenne pondérée (V1 sans accumulator persisté DB — limite numérique < 0.1 sur 100 reviews/place, exact incremental Sprint 2).
  - `total_reviews += 0` si `is_seed = true` (compteur public exclu), `+= 1` sinon.
  - 5 axes ADN updated via `adnLearningFactor` × direction × weight, clamp [-1, 1].
  - `confidence_score` recalculé sur `total_reviews + (is_seed ? 1 : 0)` — seeds comptent pour confidence.
  - `recomputeAndPersistPlaceAdn` orchestrateur : lecture `getPlace` cache + calcul local pour state UI refresh. **V1 ne persiste pas serveur** : RLS UPDATE `place_adn` non câblée + Edge Function `recompute-place-adn` reportée Sprint 2.
- Couplage `attachReviewToSpawt` Story 4.5 → `recomputeAndPersistPlaceAdn` fire-and-forget (ordre : data row → Palais 4.6 → ADN 4.7).
- Tests `app/src/lib/__tests__/place-adn-update.test.ts` — snapshots mappings + applyReviewToAdn (place vide note 5, seed bypass, clamp, 5 reviews séquentielles confidence growth).
- **Defers Story 4.7 PASS 2** : (D-436) migration `0014_alter_place_adn_accumulators` + `incrementalWeightedRating` exact. (D-437/438) Edge Function `recompute-place-adn` server-authoritative + trigger SQL AFTER INSERT/UPDATE invoking Edge Function. (D-439) event `place_adn_updated` analytics si Kidam demande. (D-440) sub-criteria avis sliders pour mapping enrichi.
- Décision V1 documentée : la fiche lieu re-fetch via `getPlace` au prochain mount ne verra **pas** l'ADN updated (car pas de write serveur). Pour PASS 1, le `applyReviewToAdn` calcule en local pour traçabilité — la persistance vraie attend l'Edge Function Sprint 2.

### File List

**Nouveau** :
- `app/src/lib/place-adn-signals.ts`
- `app/src/lib/place-adn-update.ts`
- `app/src/lib/__tests__/place-adn-update.test.ts`

**Modifié** :
- `app/src/store/spawter-store.ts` (import + appel recomputeAndPersistPlaceAdn dans attachReviewToSpawt)

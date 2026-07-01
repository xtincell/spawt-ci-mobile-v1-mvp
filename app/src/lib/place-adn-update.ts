// Story 4.7 — Update ADN du Lieu post-avis.
// Helper pur `applyReviewToAdn` + orchestrateur fire-and-forget `recomputeAndPersistPlaceAdn`.
//
// V1 limites documentées :
//  - Pas d'accumulator (sum_weighted_notes/sum_weights) côté DB → approximation
//    `weighted_rating` numériquement stable < 0.1 sur 100 reviews/place.
//  - Option C hybride : compute client immédiat (UI fiche lieu refresh) + Edge Function
//    `recompute-place-adn` fire-and-forget (server-authoritative). En V1, l'Edge Function
//    est documentée mais pas câblée — la persistance V1 vit dans le state local UI
//    (fiche lieu re-fetch après bouge ADN au prochain refresh).

import type { PlaceAdn } from "../types/place";
import type { ReviewTag } from "../types/spawt";
import { STADE_WEIGHTS, type Stade } from "../types/stade";

import {
  TAG_TO_ADN_SIGNALS,
  noteToAdnSignals,
  type AdnAxisKey,
} from "./place-adn-signals";

export interface ReviewInput {
  note_etoiles: 1 | 2 | 3 | 4 | 5;
  tags: readonly string[];
  spawter_stade: Stade;
  is_seed: boolean;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function adnLearningFactor(totalReviews: number): number {
  return Math.max(0.05, 1 / (1 + totalReviews * 0.05));
}

function computeAdnConfidence(totalReviewsInclSeeds: number): number {
  return clamp(1 - 1 / (1 + totalReviewsInclSeeds * 0.05), 0, 1);
}

/** Approximation incrémentale `weighted_rating` sans accumulator persisté V1. */
function approximateWeightedRating(
  currentRating: number,
  currentTotal: number,
  review: ReviewInput,
): number {
  const weight = STADE_WEIGHTS[review.spawter_stade] ?? 1;
  if (currentTotal === 0) return review.note_etoiles;
  const next =
    (currentRating * currentTotal + review.note_etoiles * weight) /
    (currentTotal + weight);
  return Math.round(next * 10) / 10;
}

/**
 * Pure — calcule le nouvel ADN d'un lieu après l'ajout d'un avis.
 * Caller persiste via data-source / Edge Function.
 */
export function applyReviewToAdn(
  current: PlaceAdn,
  review: ReviewInput,
): PlaceAdn {
  const newTotal = current.total_reviews + (review.is_seed ? 0 : 1);
  const factor = adnLearningFactor(newTotal);

  const signals = [
    ...noteToAdnSignals(review.note_etoiles),
    ...review.tags.flatMap(
      (t) => TAG_TO_ADN_SIGNALS[t as ReviewTag] ?? [],
    ),
  ];

  const axes: Record<AdnAxisKey, number> = {
    axe_local_international: current.axe_local_international,
    axe_informel_etabli: current.axe_informel_etabli,
    axe_budget_premium: current.axe_budget_premium,
    axe_populaire_prive: current.axe_populaire_prive,
    axe_decontracte_habille: current.axe_decontracte_habille,
  };

  for (const s of signals) {
    const delta = s.direction * s.weight * factor;
    axes[s.axis] = clamp(axes[s.axis] + delta, -1, 1);
  }

  const totalForConfidence = newTotal + (review.is_seed ? 1 : 0);

  return {
    ...current,
    ...axes,
    weighted_rating: approximateWeightedRating(
      current.weighted_rating,
      current.total_reviews,
      review,
    ),
    total_reviews: newTotal,
    confidence_score: computeAdnConfidence(totalForConfidence),
    updated_at: new Date().toISOString(),
  };
}

export interface RecomputeInput {
  place_id: string;
  review: ReviewInput;
}

/**
 * Orchestrateur Option C hybride V1 :
 *  - Lit `current` place_adn via data-source.
 *  - Calcule local via `applyReviewToAdn`.
 *  - Persiste via wrapper update (Story 4.3 offline-queue absorb si Supabase fail).
 *
 * Note : V1 sans Edge Function. RLS `place_adn` n'autorise pas l'update client
 * direct (Story 3.3a a délégué l'écriture au staff backend). En conséquence,
 * la persistance serveur **échouera silencieusement** côté offline-queue (drop
 * après MAX_ATTEMPTS). Le state UI local (fiche lieu) reste cohérent grâce au
 * cache `getPlace`. Une Edge Function `recompute-place-adn` câblée Sprint 2
 * fermera la boucle (server-authoritative).
 */
export async function recomputeAndPersistPlaceAdn(
  input: RecomputeInput,
): Promise<void> {
  try {
    const { getPlace } = await import("./data-source");
    const place = await getPlace(input.place_id);
    if (!place) {
      if (__DEV__) console.warn("[place-adn-update] place not found", input.place_id);
      return;
    }
    const newAdn = applyReviewToAdn(place.adn, input.review);
    // Câblage MVP — la persistance serveur est assurée par le trigger SQL
    // `recompute_place_adn_on_review` (migration 0025), déclenché à l'insert/
    // update de l'avis. Ce compute local ne sert qu'à la fraîcheur UI
    // immédiate (fiche lieu re-fetch au prochain mount = valeur serveur).
    if (__DEV__) {
      console.info(
        "[place-adn-update] local recompute OK (serveur: trigger 0025)",
        input.place_id,
        newAdn.weighted_rating,
      );
    }
  } catch (err) {
    if (__DEV__) console.warn("[place-adn-update] recompute failed", err);
  }
}

// Note communautaire pondérée par stade — PRD §3.1 Feature 6 + §20.6.
// Moteur pur, total, sans I/O. Cible #1 des tests unit (project-context §Testing Rules).
//
// `note_affichée = Σ(note × poids_stade) / Σ(poids_stade)`
// Poids canoniques (figés) — voir STADE_WEIGHTS dans types/stade.ts :
//   Touriste 1x · Explorateur 1,5x · Détective 2x · Djidji 2,5x · Guide 3x

import type { Stade } from "../types/stade";
import { STADE_WEIGHTS } from "../types/stade";

export interface WeightedRatingInput {
  /** Note 1-5 (Stars max=5 corrigé Story 1.4 D7). Hors range → ignoré silencieusement. */
  note_etoiles: number;
  /** Stade du spawter au moment de l'avis (historique — pas le stade actuel). */
  spawter_stade: Stade;
}

/**
 * Calcul from-scratch (PRD §3.1 Feature 6 + §20.6).
 *
 * - 0 avis → 0 (pas NaN). Le caller (UI) gate sur `total_reviews < 5`
 *   pour afficher "ADN en construction" — pas la responsabilité de ce moteur.
 * - Avis hors range (note < 1 ou > 5, NaN, undefined) → ignorés.
 * - Inclut les avis is_seed (amendement Claude 5.4) — le moteur ne discrimine pas.
 *
 * Borné [0, 5], arrondi à la décimale.
 */
export function computeWeightedRating(
  reviews: readonly WeightedRatingInput[],
): number {
  if (reviews.length === 0) return 0;
  let sumWeightedNotes = 0;
  let sumWeights = 0;
  for (const r of reviews) {
    if (
      !Number.isFinite(r.note_etoiles) ||
      r.note_etoiles < 1 ||
      r.note_etoiles > 5
    ) {
      continue;
    }
    const weight = STADE_WEIGHTS[r.spawter_stade];
    if (weight === undefined) continue;
    sumWeightedNotes += r.note_etoiles * weight;
    sumWeights += weight;
  }
  if (sumWeights === 0) return 0;
  return roundDecimal(sumWeightedNotes / sumWeights);
}

/**
 * Update incrémental quand un nouvel avis arrive — évite le recompute O(N).
 *
 * Maintient les 2 accumulateurs `sum_weighted_notes` / `sum_weights`
 * (à persister sur place_adn — migration Story 4.7).
 *
 * - Note hors range → no-op (renvoie l'état courant + rating recalculé).
 * - 0 avis avant + 1er avis → rating = note de l'avis (single sample).
 */
export function incrementalWeightedRating(
  current: { sum_weighted_notes: number; sum_weights: number },
  newReview: WeightedRatingInput,
): {
  sum_weighted_notes: number;
  sum_weights: number;
  weighted_rating: number;
} {
  const weight = STADE_WEIGHTS[newReview.spawter_stade];
  const isValid =
    Number.isFinite(newReview.note_etoiles) &&
    newReview.note_etoiles >= 1 &&
    newReview.note_etoiles <= 5 &&
    weight !== undefined;

  if (!isValid) {
    const rating =
      current.sum_weights === 0
        ? 0
        : roundDecimal(current.sum_weighted_notes / current.sum_weights);
    return {
      sum_weighted_notes: current.sum_weighted_notes,
      sum_weights: current.sum_weights,
      weighted_rating: rating,
    };
  }

  const w = weight as number;
  const sum_weighted_notes = current.sum_weighted_notes + newReview.note_etoiles * w;
  const sum_weights = current.sum_weights + w;
  return {
    sum_weighted_notes,
    sum_weights,
    weighted_rating: roundDecimal(sum_weighted_notes / sum_weights),
  };
}

function roundDecimal(v: number): number {
  return Math.round(v * 10) / 10;
}

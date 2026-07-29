// Tests Story 3.2 — moteur pur weighted-rating.
// Couvre AC #3 : cas nominal, propriétés mathématiques, incrémental cohérent.

import {
  computeWeightedRating,
  incrementalWeightedRating,
  type WeightedRatingInput,
} from "../weighted-rating";
import { STADE_WEIGHTS } from "../../types/stade";

describe("STADE_WEIGHTS — gel d'invariants (PRD §3.1 Feature 6 + §20.6)", () => {
  it("a exactement les 5 poids canoniques 1 / 1.5 / 2 / 2.5 / 3", () => {
    expect(STADE_WEIGHTS).toEqual({
      touriste: 1,
      explorateur: 1.5,
      detective: 2,
      djidji: 2.5,
      guide: 3,
    });
  });

  it("les poids sont strictement croissants avec la maturité", () => {
    const values = [
      STADE_WEIGHTS.touriste,
      STADE_WEIGHTS.explorateur,
      STADE_WEIGHTS.detective,
      STADE_WEIGHTS.djidji,
      STADE_WEIGHTS.guide,
    ];
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1] as number);
    }
  });
});

describe("computeWeightedRating — cas nominaux", () => {
  it("retourne 0 sur liste vide (pas NaN)", () => {
    expect(computeWeightedRating([])).toBe(0);
  });

  it("calcule la moyenne pondérée d'un mix Touriste + Djidji", () => {
    // (5×2.5 + 3×1) / (2.5+1) = 15.5 / 3.5 ≈ 4.43 → arrondi 4.4
    const reviews: WeightedRatingInput[] = [
      { note_etoiles: 5, spawter_stade: "djidji" },
      { note_etoiles: 3, spawter_stade: "touriste" },
    ];
    expect(computeWeightedRating(reviews)).toBeCloseTo(4.4, 1);
  });

  it("retourne la note brute quand un seul avis", () => {
    expect(
      computeWeightedRating([{ note_etoiles: 4, spawter_stade: "touriste" }]),
    ).toBe(4.0);
  });

  it("teste les 5 stades au moins une fois", () => {
    const reviews: WeightedRatingInput[] = [
      { note_etoiles: 5, spawter_stade: "touriste" },
      { note_etoiles: 5, spawter_stade: "explorateur" },
      { note_etoiles: 5, spawter_stade: "detective" },
      { note_etoiles: 5, spawter_stade: "djidji" },
      { note_etoiles: 5, spawter_stade: "guide" },
    ];
    expect(computeWeightedRating(reviews)).toBe(5.0);
  });
});

describe("computeWeightedRating — propriétés mathématiques", () => {
  it("résultat borné [0, 5] pour notes ∈ [1, 5]", () => {
    const reviews: WeightedRatingInput[] = [
      { note_etoiles: 1, spawter_stade: "touriste" },
      { note_etoiles: 5, spawter_stade: "guide" },
      { note_etoiles: 3, spawter_stade: "detective" },
    ];
    const r = computeWeightedRating(reviews);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(5);
  });

  it("symétrie : l'ordre des avis n'influence pas le résultat", () => {
    const a: WeightedRatingInput[] = [
      { note_etoiles: 5, spawter_stade: "djidji" },
      { note_etoiles: 3, spawter_stade: "touriste" },
    ];
    const b: WeightedRatingInput[] = [
      { note_etoiles: 3, spawter_stade: "touriste" },
      { note_etoiles: 5, spawter_stade: "djidji" },
    ];
    expect(computeWeightedRating(a)).toBe(computeWeightedRating(b));
  });

  it("stabilité : 2 appels identiques retournent exactement la même valeur", () => {
    const reviews: WeightedRatingInput[] = [
      { note_etoiles: 4, spawter_stade: "explorateur" },
      { note_etoiles: 5, spawter_stade: "guide" },
    ];
    expect(computeWeightedRating(reviews)).toBe(computeWeightedRating(reviews));
  });

  it("robustesse : notes hors range ignorées (pas crash)", () => {
    const reviews: WeightedRatingInput[] = [
      { note_etoiles: -1, spawter_stade: "touriste" },
      { note_etoiles: 6, spawter_stade: "touriste" },
      { note_etoiles: NaN, spawter_stade: "touriste" },
      { note_etoiles: 4, spawter_stade: "touriste" },
    ];
    expect(computeWeightedRating(reviews)).toBe(4.0);
  });

  it("toutes les notes hors range → retourne 0", () => {
    const reviews: WeightedRatingInput[] = [
      { note_etoiles: 0, spawter_stade: "touriste" },
      { note_etoiles: 6, spawter_stade: "guide" },
    ];
    expect(computeWeightedRating(reviews)).toBe(0);
  });
});

describe("incrementalWeightedRating", () => {
  it("démarrage à zéro + 1er avis → rating = note", () => {
    const result = incrementalWeightedRating(
      { sum_weighted_notes: 0, sum_weights: 0 },
      { note_etoiles: 4, spawter_stade: "touriste" },
    );
    expect(result.weighted_rating).toBe(4.0);
    expect(result.sum_weighted_notes).toBe(4);
    expect(result.sum_weights).toBe(1);
  });

  it("ajout d'un Guide avec note 5 monte la moyenne", () => {
    // Current : 15.5 / 3.5 ≈ 4.43
    // +5×3 / +3 → 30.5 / 6.5 ≈ 4.69
    const result = incrementalWeightedRating(
      { sum_weighted_notes: 15.5, sum_weights: 3.5 },
      { note_etoiles: 5, spawter_stade: "guide" },
    );
    expect(result.sum_weighted_notes).toBe(30.5);
    expect(result.sum_weights).toBe(6.5);
    expect(result.weighted_rating).toBeCloseTo(4.7, 1);
  });

  it("note hors range → no-op, rating recalculé sur état courant", () => {
    const result = incrementalWeightedRating(
      { sum_weighted_notes: 15.5, sum_weights: 3.5 },
      { note_etoiles: 0, spawter_stade: "touriste" },
    );
    expect(result.sum_weighted_notes).toBe(15.5);
    expect(result.sum_weights).toBe(3.5);
    expect(result.weighted_rating).toBeCloseTo(4.4, 1);
  });

  it("cohérence avec from-scratch sur 4 avis", () => {
    const reviews: WeightedRatingInput[] = [
      { note_etoiles: 4, spawter_stade: "touriste" },
      { note_etoiles: 5, spawter_stade: "djidji" },
      { note_etoiles: 3, spawter_stade: "explorateur" },
      { note_etoiles: 5, spawter_stade: "guide" },
    ];
    const fromScratch = computeWeightedRating(reviews);
    let state = { sum_weighted_notes: 0, sum_weights: 0 };
    let lastRating = 0;
    for (const r of reviews) {
      const next = incrementalWeightedRating(state, r);
      state = {
        sum_weighted_notes: next.sum_weighted_notes,
        sum_weights: next.sum_weights,
      };
      lastRating = next.weighted_rating;
    }
    expect(Math.abs(lastRating - fromScratch)).toBeLessThan(0.01);
  });
});

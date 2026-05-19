// Story 4.7 — Tests applyReviewToAdn (pure helper).

import {
  TAG_TO_ADN_SIGNALS,
  noteToAdnSignals,
  TOTAL_ADN_SIGNAL_MAPPINGS,
} from "../place-adn-signals";
import { applyReviewToAdn } from "../place-adn-update";
import type { PlaceAdn } from "../../types/place";

function makeAdn(overrides: Partial<PlaceAdn> = {}): PlaceAdn {
  return {
    place_id: "place-bo-zinc",
    axe_local_international: 0,
    axe_informel_etabli: 0,
    axe_budget_premium: 0,
    axe_populaire_prive: 0,
    axe_decontracte_habille: 0,
    confidence_score: 0,
    total_reviews: 0,
    weighted_rating: 0,
    updated_at: "2026-05-20T00:00:00Z",
    ...overrides,
  };
}

describe("place-adn-signals — snapshots", () => {
  it("TAG_TO_ADN_SIGNALS figé", () => {
    expect(TAG_TO_ADN_SIGNALS).toMatchSnapshot();
  });
  it("TOTAL_ADN_SIGNAL_MAPPINGS invariant", () => {
    // Exact V1 — 5 tags × 1-2 signaux.
    expect(TOTAL_ADN_SIGNAL_MAPPINGS).toBeGreaterThan(0);
  });
  it("noteToAdnSignals — note 3 = no-op, 5 = positif", () => {
    expect(noteToAdnSignals(3)).toEqual([]);
    expect(noteToAdnSignals(5)[0]?.direction).toBe(1);
  });
});

describe("applyReviewToAdn", () => {
  it("place vide + note 5 + tag a_refaire → total=1, rating=5", () => {
    const out = applyReviewToAdn(makeAdn(), {
      note_etoiles: 5,
      tags: ["a_refaire"],
      spawter_stade: "touriste",
      is_seed: false,
    });
    expect(out.total_reviews).toBe(1);
    expect(out.weighted_rating).toBe(5);
    expect(out.confidence_score).toBeGreaterThan(0);
  });

  it("seed bypass : total_reviews inchangé mais ADN axes mis à jour", () => {
    const out = applyReviewToAdn(makeAdn(), {
      note_etoiles: 4,
      tags: ["copieux"],
      spawter_stade: "djidji",
      is_seed: true,
    });
    expect(out.total_reviews).toBe(0); // seed exclu du compteur public
    expect(out.confidence_score).toBeGreaterThan(0);
    // axe_informel_etabli a bougé négatif (copieux = informel)
    expect(out.axe_informel_etabli).toBeLessThan(0);
  });

  it("axes restent [-1, 1] (clamp)", () => {
    const out = applyReviewToAdn(makeAdn({ axe_budget_premium: 0.99 }), {
      note_etoiles: 4,
      tags: ["cher"],
      spawter_stade: "touriste",
      is_seed: false,
    });
    expect(out.axe_budget_premium).toBeLessThanOrEqual(1);
  });

  it("5 reviews séquentielles : confidence augmente", () => {
    let adn = makeAdn();
    for (let i = 0; i < 5; i++) {
      adn = applyReviewToAdn(adn, {
        note_etoiles: 4,
        tags: ["a_refaire"],
        spawter_stade: "touriste",
        is_seed: false,
      });
    }
    expect(adn.total_reviews).toBe(5);
    expect(adn.confidence_score).toBeGreaterThan(0.15);
  });
});

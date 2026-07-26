// Tests Mode Rapide — applySwipeToPalais (signal faible swipe → Palais).
// Couvre : direction (like vers l'ADN, pass à l'opposé), seuil de neutralité,
// poids SOUS le plancher avis (PRD §20.5), confidence inchangée, clamp [-1,1].

import {
  applySwipeToPalais,
  SWIPE_ADN_THRESHOLD,
  SWIPE_LIKE_WEIGHT,
  SWIPE_PASS_WEIGHT,
} from "../rapide-signals";
import { learningFactor } from "../palais-engine";
import type { PlaceAdn } from "../../types/place";
import type { UserPalais } from "../../types/palais";

const NOW_ISO = "2026-07-26T12:00:00Z";

function makePalais(overrides: Partial<UserPalais> = {}): UserPalais {
  return {
    spawter_id: "test-spawter",
    axe_racines_horizons: 0,
    axe_taniere_nomade: 0,
    axe_exigeant_enthousiaste: 0,
    axe_foule_secret: 0,
    axe_maquis_table: 0,
    confidence_score: 0.42,
    dominant_axes: null,
    archetype_id: null,
    stade: "touriste",
    total_spawts: 0,
    updated_at: NOW_ISO,
    ...overrides,
  };
}

function makeAdn(overrides: Partial<PlaceAdn> = {}): PlaceAdn {
  return {
    place_id: "p1",
    axe_local_international: 0,
    axe_informel_etabli: 0,
    axe_budget_premium: 0,
    axe_populaire_prive: 0,
    axe_decontracte_habille: 0,
    confidence_score: 0.8,
    total_reviews: 30,
    weighted_rating: 4,
    updated_at: NOW_ISO,
    ...overrides,
  };
}

describe("applySwipeToPalais — poids (invariants produit)", () => {
  it("les poids swipe restent SOUS le plancher des signaux d'avis (0.02, PRD §20.5)", () => {
    expect(SWIPE_LIKE_WEIGHT).toBeLessThan(0.02);
    expect(SWIPE_PASS_WEIGHT).toBeLessThan(SWIPE_LIKE_WEIGHT);
  });
});

describe("applySwipeToPalais — direction", () => {
  it("like sur un lieu marqué Table (+) pousse maquis_table vers +", () => {
    const { palais, didUpdate } = applySwipeToPalais({
      current: makePalais(),
      unique_spots: 0,
      adn: makeAdn({ axe_decontracte_habille: 0.8 }),
      direction: "like",
    });
    expect(didUpdate).toBe(true);
    // unique_spots=0 → learningFactor=1 → delta = +SWIPE_LIKE_WEIGHT exact.
    expect(palais.axe_maquis_table).toBeCloseTo(SWIPE_LIKE_WEIGHT, 6);
  });

  it("like sur un lieu marqué Local (-) pousse racines_horizons vers -", () => {
    const { palais } = applySwipeToPalais({
      current: makePalais(),
      unique_spots: 0,
      adn: makeAdn({ axe_local_international: -0.9 }),
      direction: "like",
    });
    expect(palais.axe_racines_horizons).toBeCloseTo(-SWIPE_LIKE_WEIGHT, 6);
  });

  it("pass sur un lieu marqué Table (+) pousse maquis_table vers - (négatif léger)", () => {
    const { palais } = applySwipeToPalais({
      current: makePalais(),
      unique_spots: 0,
      adn: makeAdn({ axe_decontracte_habille: 0.8 }),
      direction: "pass",
    });
    expect(palais.axe_maquis_table).toBeCloseTo(-SWIPE_PASS_WEIGHT, 6);
  });

  it("un pass pèse moins qu'un like (asymétrie assumée)", () => {
    const like = applySwipeToPalais({
      current: makePalais(),
      unique_spots: 0,
      adn: makeAdn({ axe_budget_premium: 1 }),
      direction: "like",
    });
    const pass = applySwipeToPalais({
      current: makePalais(),
      unique_spots: 0,
      adn: makeAdn({ axe_budget_premium: 1 }),
      direction: "pass",
    });
    expect(Math.abs(pass.palais.axe_exigeant_enthousiaste)).toBeLessThan(
      Math.abs(like.palais.axe_exigeant_enthousiaste),
    );
  });
});

describe("applySwipeToPalais — seuil de neutralité", () => {
  it("ADN totalement plat → no-op (didUpdate=false, palais identique)", () => {
    const current = makePalais();
    const out = applySwipeToPalais({
      current,
      unique_spots: 0,
      adn: makeAdn(),
      direction: "like",
    });
    expect(out.didUpdate).toBe(false);
    expect(out.palais).toBe(current);
  });

  it("un axe sous le seuil ne produit aucun signal, les axes marqués si", () => {
    const { palais } = applySwipeToPalais({
      current: makePalais(),
      unique_spots: 0,
      adn: makeAdn({
        axe_local_international: SWIPE_ADN_THRESHOLD - 0.01, // sous le seuil
        axe_populaire_prive: 0.7, // marqué
      }),
      direction: "like",
    });
    expect(palais.axe_racines_horizons).toBe(0);
    expect(palais.axe_foule_secret).toBeCloseTo(SWIPE_LIKE_WEIGHT, 6);
  });
});

describe("applySwipeToPalais — invariants d'état", () => {
  it("confidence_score reste INCHANGÉ (un swipe n'est pas une visite)", () => {
    const current = makePalais({ confidence_score: 0.42 });
    const { palais } = applySwipeToPalais({
      current,
      unique_spots: 0,
      adn: makeAdn({ axe_budget_premium: 1 }),
      direction: "like",
    });
    expect(palais.confidence_score).toBe(0.42);
  });

  it("applique la décroissance learningFactor selon unique_spots", () => {
    const spots = 40;
    const { palais } = applySwipeToPalais({
      current: makePalais(),
      unique_spots: spots,
      adn: makeAdn({ axe_decontracte_habille: 1 }),
      direction: "like",
    });
    expect(palais.axe_maquis_table).toBeCloseTo(
      SWIPE_LIKE_WEIGHT * learningFactor(spots),
      6,
    );
  });

  it("clamp [-1, 1] : un axe déjà au max ne dépasse pas", () => {
    const { palais } = applySwipeToPalais({
      current: makePalais({ axe_maquis_table: 1 }),
      unique_spots: 0,
      adn: makeAdn({ axe_decontracte_habille: 1 }),
      direction: "like",
    });
    expect(palais.axe_maquis_table).toBe(1);
  });

  it("recalcule dominant_axes et updated_at, ne mute pas l'objet d'entrée", () => {
    const current = makePalais({ axe_foule_secret: 0.5 });
    const { palais } = applySwipeToPalais({
      current,
      unique_spots: 0,
      adn: makeAdn({ axe_populaire_prive: 1 }),
      direction: "like",
    });
    expect(palais).not.toBe(current);
    expect(current.axe_foule_secret).toBe(0.5);
    expect(palais.dominant_axes?.[0]).toBe("foule_secret");
    expect(palais.updated_at).not.toBe(current.updated_at);
  });
});

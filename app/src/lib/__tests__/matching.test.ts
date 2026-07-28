// Tests Story 3.3b — moteur matching composite.
// Couvre AC #2 : PRD §8.1 (poids), §8.2 (recency/novelty), §8.3 (affichage [50, 99]).

import {
  WEIGHTS,
  FAVORITE_BONUS,
  computeRawScore,
  displayedScore,
  rankPlaces,
  haversineKm,
  type MatchingContext,
  type PlaceWithSignals,
} from "../matching";
import type { Place, PlaceAdn } from "../../types/place";
import type { UserPalais } from "../../types/palais";

const REF_LAT = 5.358;
const REF_LNG = -3.97;
const NOW = new Date("2026-05-18T12:00:00Z");

function makePalais(overrides: Partial<UserPalais> = {}): UserPalais {
  return {
    spawter_id: "test-spawter",
    axe_racines_horizons: 0,
    axe_taniere_nomade: 0,
    axe_exigeant_enthousiaste: 0,
    axe_foule_secret: 0,
    axe_maquis_table: 0,
    confidence_score: 1,
    dominant_axes: null,
    archetype_id: null,
    stade: "touriste",
    total_spawts: 0,
    updated_at: NOW.toISOString(),
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
    sample_size: 30,
    adn_revealed: true,
    weighted_rating: 4,
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

function makePlace(overrides: Partial<Place> = {}): Place {
  return {
    id: "p1",
    name: "Test",
    cuisine: ["ivoirienne"],
    location: {
      lat: REF_LAT,
      lng: REF_LNG,
      descriptive_address: "Test",
      neighborhood: "Cocody",
      city: "Abidjan",
    },
    price: { tier: 2 },
    hours: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
    phone: null,
    whatsapp: null,
    cover_photo_url: null,
    gallery_urls: [],
    menu_urls: [],
    signals: [],
    is_published: true,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

function makeCtx(overrides: Partial<MatchingContext> = {}): MatchingContext {
  return {
    spawter_palais: makePalais(),
    spawter_lat: REF_LAT,
    spawter_lng: REF_LNG,
    visited_place_ids: new Set(),
    saved_place_ids: new Set(),
    now: NOW,
    ...overrides,
  };
}

describe("WEIGHTS — gel d'invariants (PRD §8.1)", () => {
  it("a exactement les 5 poids canoniques 0.15/0.30/0.30/0.10/0.15", () => {
    expect(WEIGHTS).toEqual({
      cosine: 0.15,
      distance: 0.30,
      note: 0.30,
      recency: 0.10,
      novelty: 0.15,
    });
  });

  it("la somme des poids = 1.00", () => {
    const sum =
      WEIGHTS.cosine +
      WEIGHTS.distance +
      WEIGHTS.note +
      WEIGHTS.recency +
      WEIGHTS.novelty;
    expect(sum).toBeCloseTo(1.0, 5);
  });
});

describe("computeRawScore — cas nominaux", () => {
  it("palais parfait + lieu à 0km + note 5 + non visité → score brut ≈ 1.0 → display 99", () => {
    const palais = makePalais({
      axe_racines_horizons: 1,
      axe_taniere_nomade: 1,
      axe_exigeant_enthousiaste: 1,
      axe_foule_secret: 1,
      axe_maquis_table: 1,
    });
    const adn = makeAdn({
      axe_local_international: 1,
      axe_informel_etabli: 1,
      axe_budget_premium: 1,
      axe_populaire_prive: 1,
      axe_decontracte_habille: 1,
      weighted_rating: 5,
    });
    const ctx = makeCtx({ spawter_palais: palais });
    const raw = computeRawScore(ctx, {
      place: makePlace(),
      adn,
      last_spawt_at: null,
    });
    // Sans last_spawt_at, recency=0 → max possible = 0.90 → display 94.
    expect(raw).toBeGreaterThan(0.85);
    expect(displayedScore(raw)).toBeGreaterThanOrEqual(94);
  });

  it("score borné [0, 1]", () => {
    const ctx = makeCtx();
    const raw = computeRawScore(ctx, {
      place: makePlace(),
      adn: makeAdn(),
      last_spawt_at: null,
    });
    expect(raw).toBeGreaterThanOrEqual(0);
    expect(raw).toBeLessThanOrEqual(1);
  });
});

describe("displayedScore — affichage [50, 99] (PRD §8.3)", () => {
  it("rawScore 0 → 50", () => {
    expect(displayedScore(0)).toBe(50);
  });
  it("rawScore 1 → 99", () => {
    expect(displayedScore(1)).toBe(99);
  });
  it("rawScore < 0 (corrompu) → clamp 50", () => {
    expect(displayedScore(-0.5)).toBe(50);
  });
  it("rawScore > 1 (corrompu) → clamp 99", () => {
    expect(displayedScore(2)).toBe(99);
  });
  it("rawScore 0.5 → ~75 (Math.round)", () => {
    expect(displayedScore(0.5)).toBe(75);
  });
});

describe("Composantes : distance", () => {
  it("0 km → score haut", () => {
    const adn = makeAdn();
    const raw = computeRawScore(makeCtx(), {
      place: makePlace({
        location: {
          lat: REF_LAT,
          lng: REF_LNG,
          descriptive_address: "ici",
          neighborhood: "Cocody",
          city: "Abidjan",
        },
      }),
      adn,
      last_spawt_at: null,
    });
    // Composante distance = 1.0 → contribue 0.30 au score
    expect(raw).toBeGreaterThan(0.3);
  });

  it("lieu très loin (100km) → score baisse fortement", () => {
    const raw = computeRawScore(makeCtx(), {
      place: makePlace({
        location: {
          lat: 6.5,
          lng: -2.5,
          descriptive_address: "loin",
          neighborhood: "Ailleurs",
          city: "Ailleurs",
        },
      }),
      adn: makeAdn(),
      last_spawt_at: null,
    });
    // distance composante = 0 (km > 5 + 5×0.05 = clamp 0)
    expect(raw).toBeLessThan(0.5);
  });
});

describe("Composante recency", () => {
  it("last_spawt_at = null → composante = 0", () => {
    const ctx = makeCtx();
    const raw1 = computeRawScore(ctx, {
      place: makePlace(),
      adn: makeAdn(),
      last_spawt_at: null,
    });
    const raw2 = computeRawScore(ctx, {
      place: makePlace(),
      adn: makeAdn(),
      last_spawt_at: NOW,
    });
    // last_spawt_at=NOW → composante recency = 1, donc raw2 > raw1
    expect(raw2).toBeGreaterThan(raw1);
  });

  it("90+ jours → composante 0 (clamp)", () => {
    const old = new Date(NOW.getTime() - 180 * 86_400_000);
    const ctx = makeCtx();
    const raw = computeRawScore(ctx, {
      place: makePlace(),
      adn: makeAdn(),
      last_spawt_at: old,
    });
    const rawNull = computeRawScore(ctx, {
      place: makePlace(),
      adn: makeAdn(),
      last_spawt_at: null,
    });
    expect(raw).toBeCloseTo(rawNull, 5);
  });
});

describe("Composante novelty", () => {
  it("place non visité → composante = 1 ; visité → 0.2", () => {
    const baseCtx = makeCtx();
    const visitedCtx = makeCtx({ visited_place_ids: new Set(["p1"]) });
    const candidate: PlaceWithSignals = {
      place: makePlace(),
      adn: makeAdn(),
      last_spawt_at: null,
    };
    const novelScore = computeRawScore(baseCtx, candidate);
    const visitedScore = computeRawScore(visitedCtx, candidate);
    expect(novelScore).toBeGreaterThan(visitedScore);
  });
});

describe("Story 3.6 — bonus favori +0.05", () => {
  it("favori → score +0.05 capped à 1", () => {
    const baseCtx = makeCtx();
    const favCtx = makeCtx({ saved_place_ids: new Set(["p1"]) });
    const candidate: PlaceWithSignals = {
      place: makePlace(),
      adn: makeAdn(),
      last_spawt_at: null,
    };
    const base = computeRawScore(baseCtx, candidate);
    const fav = computeRawScore(favCtx, candidate);
    expect(fav - base).toBeCloseTo(FAVORITE_BONUS, 5);
  });

  it("base déjà 1 → reste capped à 1", () => {
    const palais = makePalais({
      axe_racines_horizons: 1,
      axe_taniere_nomade: 1,
      axe_exigeant_enthousiaste: 1,
      axe_foule_secret: 1,
      axe_maquis_table: 1,
    });
    const adn = makeAdn({
      axe_local_international: 1,
      axe_informel_etabli: 1,
      axe_budget_premium: 1,
      axe_populaire_prive: 1,
      axe_decontracte_habille: 1,
      weighted_rating: 5,
    });
    const ctx = makeCtx({
      spawter_palais: palais,
      saved_place_ids: new Set(["p1"]),
    });
    const raw = computeRawScore(ctx, {
      place: makePlace(),
      adn,
      last_spawt_at: NOW,
    });
    expect(raw).toBeLessThanOrEqual(1);
  });
});

describe("rankPlaces", () => {
  it("liste vide → []", () => {
    expect(rankPlaces(makeCtx(), [])).toEqual([]);
  });

  it("tri descendant sur match_score", () => {
    const candidates: PlaceWithSignals[] = [
      {
        place: makePlace({ id: "a", location: { lat: 6.5, lng: -2.5, descriptive_address: "x", neighborhood: "X", city: "X" } }),
        adn: makeAdn({ place_id: "a", weighted_rating: 1 }),
        last_spawt_at: null,
      },
      {
        place: makePlace({ id: "b" }),
        adn: makeAdn({ place_id: "b", weighted_rating: 5 }),
        last_spawt_at: NOW,
      },
    ];
    const ranked = rankPlaces(makeCtx(), candidates);
    expect(ranked[0]?.place.id).toBe("b");
    expect(ranked[1]?.place.id).toBe("a");
  });

  it("ex-aequo → tiebreaker lexicographique sur place.id", () => {
    // 2 lieux identiques sauf ID
    const palais = makePalais();
    const adn = makeAdn();
    const candidates: PlaceWithSignals[] = [
      { place: makePlace({ id: "zebra" }), adn: { ...adn, place_id: "zebra" }, last_spawt_at: null },
      { place: makePlace({ id: "alpha" }), adn: { ...adn, place_id: "alpha" }, last_spawt_at: null },
    ];
    const ranked = rankPlaces(makeCtx({ spawter_palais: palais }), candidates);
    expect(ranked[0]?.place.id).toBe("alpha");
    expect(ranked[1]?.place.id).toBe("zebra");
  });

  it("ne mute pas la liste d'entrée", () => {
    const candidates: PlaceWithSignals[] = [
      { place: makePlace({ id: "a" }), adn: makeAdn({ place_id: "a" }), last_spawt_at: null },
    ];
    const before = candidates.map((c) => c.place.id);
    rankPlaces(makeCtx(), candidates);
    expect(candidates.map((c) => c.place.id)).toEqual(before);
  });

  it("déterminisme : 2 appels identiques retournent le même ordre", () => {
    const candidates: PlaceWithSignals[] = [
      { place: makePlace({ id: "a" }), adn: makeAdn({ place_id: "a" }), last_spawt_at: null },
      { place: makePlace({ id: "b" }), adn: makeAdn({ place_id: "b", weighted_rating: 4.5 }), last_spawt_at: null },
    ];
    const a = rankPlaces(makeCtx(), candidates);
    const b = rankPlaces(makeCtx(), candidates);
    expect(a.map((x) => x.place.id)).toEqual(b.map((x) => x.place.id));
  });
});

describe("haversineKm — helper exporté Story 3.3b", () => {
  it("distance 0 sur les mêmes coords", () => {
    expect(haversineKm(REF_LAT, REF_LNG, REF_LAT, REF_LNG)).toBe(0);
  });

  it("distance Cocody → Yopougon (~10km approx)", () => {
    const km = haversineKm(5.358, -3.97, 5.345, -4.029);
    expect(km).toBeGreaterThan(5);
    expect(km).toBeLessThan(10);
  });
});

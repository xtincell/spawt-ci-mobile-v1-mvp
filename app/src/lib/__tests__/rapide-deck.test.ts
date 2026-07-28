// Tests Mode Rapide — buildRapideDeck (deck de swipe).
// Couvre : exclusion des favoris, exclusion paywall (flag actif + GPS),
// bypass Gold / fallback / flag off, ordre = ranking matching canonique.

import { buildRapideDeck } from "../rapide-deck";
import type { MatchingContext } from "../matching";
import type { PlaceWithAdn } from "../data-source";
import type { PlaceAdn } from "../../types/place";
import type { UserPalais } from "../../types/palais";

const REF_LAT = 5.358;
const REF_LNG = -3.97;
const NOW = new Date("2026-07-26T12:00:00Z");

function makePalais(): UserPalais {
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
  };
}

function makeAdn(place_id: string, overrides: Partial<PlaceAdn> = {}): PlaceAdn {
  return {
    place_id,
    axe_local_international: 0,
    axe_informel_etabli: 0,
    axe_budget_premium: 0,
    axe_populaire_prive: 0,
    axe_decontracte_habille: 0,
    confidence_score: 0.8,
    total_reviews: 30,
    sample_size: 30,
    weighted_rating: 4,
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

function makePlace(
  id: string,
  overrides: Partial<Omit<PlaceWithAdn, "adn">> & { adn?: Partial<PlaceAdn> } = {},
): PlaceWithAdn {
  const { adn: adnOverrides, ...placeOverrides } = overrides;
  return {
    id,
    name: `Spot ${id}`,
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
    adn: makeAdn(id, adnOverrides),
    rating_display: 4,
    total_spawts: 10,
    ...placeOverrides,
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

const PAYWALL_OFF = {
  enabled: false,
  isGold: false,
  positionSource: "gps" as const,
};

// Un lieu à ~5.5 km du point de référence (hors rayon gratuit 3 km).
const FAR_LAT = 5.408;
const FAR_LNG = -3.97;

describe("buildRapideDeck — exclusions", () => {
  it("exclut les lieux déjà sauvegardés du deck", () => {
    const places = [makePlace("a"), makePlace("b"), makePlace("c")];
    const deck = buildRapideDeck(
      places,
      makeCtx({ saved_place_ids: new Set(["b"]) }),
      PAYWALL_OFF,
    );
    expect(deck.map((d) => d.place.id).sort()).toEqual(["a", "c"]);
  });

  it("exclut les lieux verrouillés paywall (flag actif, GPS, non-Gold, > 3 km)", () => {
    const near = makePlace("near");
    const far = makePlace("far", {
      location: {
        lat: FAR_LAT,
        lng: FAR_LNG,
        descriptive_address: "Loin",
        neighborhood: "Abobo",
        city: "Abidjan",
      },
    });
    const deck = buildRapideDeck([near, far], makeCtx(), {
      enabled: true,
      isGold: false,
      positionSource: "gps",
    });
    expect(deck.map((d) => d.place.id)).toEqual(["near"]);
  });

  it("paywall flag OFF → aucun lieu exclu même hors zone", () => {
    const far = makePlace("far", {
      location: {
        lat: FAR_LAT,
        lng: FAR_LNG,
        descriptive_address: "Loin",
        neighborhood: "Abobo",
        city: "Abidjan",
      },
    });
    const deck = buildRapideDeck([far], makeCtx(), PAYWALL_OFF);
    expect(deck).toHaveLength(1);
  });

  it("spawter Gold → jamais verrouillé, deck complet", () => {
    const far = makePlace("far", {
      location: {
        lat: FAR_LAT,
        lng: FAR_LNG,
        descriptive_address: "Loin",
        neighborhood: "Abobo",
        city: "Abidjan",
      },
    });
    const deck = buildRapideDeck([far], makeCtx(), {
      enabled: true,
      isGold: true,
      positionSource: "gps",
    });
    expect(deck).toHaveLength(1);
  });

  it("position fallback (permission refusée) → pas de verrouillage", () => {
    const far = makePlace("far", {
      location: {
        lat: FAR_LAT,
        lng: FAR_LNG,
        descriptive_address: "Loin",
        neighborhood: "Abobo",
        city: "Abidjan",
      },
    });
    const deck = buildRapideDeck([far], makeCtx(), {
      enabled: true,
      isGold: false,
      positionSource: "fallback",
    });
    expect(deck).toHaveLength(1);
  });

  it("liste vide → deck vide (total, no throw)", () => {
    expect(buildRapideDeck([], makeCtx(), PAYWALL_OFF)).toEqual([]);
  });

  it("tous favoris → deck vide", () => {
    const places = [makePlace("a"), makePlace("b")];
    const deck = buildRapideDeck(
      places,
      makeCtx({ saved_place_ids: new Set(["a", "b"]) }),
      PAYWALL_OFF,
    );
    expect(deck).toEqual([]);
  });
});

describe("buildRapideDeck — ordre de matching canonique", () => {
  it("ordonne par match_score décroissant (même moteur que le feed)", () => {
    // `low` a une note pondérée faible → score plus bas que `high`.
    const high = makePlace("high", { adn: { weighted_rating: 5 } });
    const low = makePlace("low", { adn: { weighted_rating: 1 } });
    const deck = buildRapideDeck([low, high], makeCtx(), PAYWALL_OFF);
    expect(deck.map((d) => d.place.id)).toEqual(["high", "low"]);
    expect(deck[0]!.match_score).toBeGreaterThan(deck[1]!.match_score);
  });

  it("expose match_score borné [50, 99] et distance_km (réutilisable par la carte)", () => {
    const deck = buildRapideDeck([makePlace("a")], makeCtx(), PAYWALL_OFF);
    expect(deck[0]!.match_score).toBeGreaterThanOrEqual(50);
    expect(deck[0]!.match_score).toBeLessThanOrEqual(99);
    expect(deck[0]!.distance_km).toBeCloseTo(0, 3);
  });

  it("ne mute pas la liste d'entrée", () => {
    const places = [makePlace("b"), makePlace("a")];
    const snapshot = places.map((p) => p.id);
    buildRapideDeck(places, makeCtx(), PAYWALL_OFF);
    expect(places.map((p) => p.id)).toEqual(snapshot);
  });
});

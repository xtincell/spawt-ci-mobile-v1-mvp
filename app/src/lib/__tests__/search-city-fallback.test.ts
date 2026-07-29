// Multi-villes (PRD §18.1) — searchPlaces quand la géoloc du spawter manque :
// le filtre distance retombe sur le point de référence de la ville active
// (getActiveCity().default_*). Mode démo dans ce fichier → constante locale.

import {
  EMPTY_FILTERS,
  searchPlaces,
  type SearchContext,
  type SearchFilters,
} from "../search";
import { ABIDJAN_FALLBACK } from "../city";
import type { PlaceWithAdn } from "../data-source";

const NO_GEO: SearchContext = { spawter_lat: null, spawter_lng: null };

function makePlace(
  id: string,
  name: string,
  lat: number,
  lng: number,
): PlaceWithAdn {
  return {
    id,
    name,
    cuisine: ["ivoirienne"],
    location: {
      lat,
      lng,
      descriptive_address: "fake",
      neighborhood: "Cocody",
      city: "Abidjan",
    },
    price: { tier: 2 },
    hours: {
      mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
    },
    phone: null,
    whatsapp: null,
    cover_photo_url: null,
    gallery_urls: [],
    menu_urls: [],
    signals: [],
    is_published: true,
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    adn: {
      place_id: id,
      axe_local_international: 0,
      axe_informel_etabli: 0,
      axe_budget_premium: 0,
      axe_populaire_prive: 0,
      axe_decontracte_habille: 0,
      confidence_score: 0.5,
      total_reviews: 5,
      sample_size: 5,
      adn_revealed: true,
      weighted_rating: 4,
      updated_at: "2026-05-01T00:00:00Z",
    },
    rating_display: 4,
    total_spawts: 10,
  };
}

describe("searchPlaces — fallback ville quand la géoloc manque", () => {
  const DISTANCE_2KM: SearchFilters = { ...EMPTY_FILTERS, distanceKm: 2 };

  it("filtre distance sans géoloc → distances depuis le point de référence ville", () => {
    // ~0.55km du point de référence (0.005° de latitude).
    const near = makePlace(
      "p-near",
      "Proche du point ville",
      ABIDJAN_FALLBACK.default_lat + 0.005,
      ABIDJAN_FALLBACK.default_lng,
    );
    // ~10km du point de référence.
    const far = makePlace(
      "p-far",
      "Loin du point ville",
      ABIDJAN_FALLBACK.default_lat + 0.09,
      ABIDJAN_FALLBACK.default_lng,
    );
    const result = searchPlaces([near, far], "", DISTANCE_2KM, NO_GEO);
    expect(result.map((p) => p.id)).toEqual(["p-near"]);
  });

  it("query texte sans géoloc → match normal, aucun crash", () => {
    const place = makePlace(
      "p-1",
      "Maquis du Val",
      ABIDJAN_FALLBACK.default_lat,
      ABIDJAN_FALLBACK.default_lng,
    );
    const result = searchPlaces([place], "maquis", EMPTY_FILTERS, NO_GEO);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("p-1");
  });

  it("géoloc réelle fournie → prime sur le fallback ville", () => {
    // Lieu à ~30km du point de référence ville, mais collé au spawter.
    const ctx: SearchContext = { spawter_lat: 5.6, spawter_lng: -3.9 };
    const place = makePlace("p-ctx", "Chez le spawter", 5.6, -3.9);
    const result = searchPlaces([place], "", DISTANCE_2KM, ctx);
    expect(result).toHaveLength(1);
    // Contre-épreuve : sans géoloc, le même lieu est hors rayon.
    expect(searchPlaces([place], "", DISTANCE_2KM, NO_GEO)).toEqual([]);
  });
});

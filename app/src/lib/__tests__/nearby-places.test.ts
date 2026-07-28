// Story 4.10 — Tests du helper pur listNearbyPlaces + formatDistance.

import {
  NEARBY_RADIUS_KM,
  SPAWT_RANGE_KM,
  formatDistance,
  listNearbyPlaces,
  type NearbyPlace,
} from "../nearby-places";
import type { PlaceWithAdn } from "../data-source";
import { ABIDJAN_FALLBACK } from "../city";

// Référence : spawter sur Cocody Plateau (proche centre Abidjan).
const USER_LAT = 5.348;
const USER_LNG = -3.998;

function makePlace(
  id: string,
  name: string,
  lat: number,
  lng: number,
  is_published = true,
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
    is_published,
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
      weighted_rating: 4,
      updated_at: "2026-05-01T00:00:00Z",
    },
    rating_display: 4,
    total_spawts: 10,
  };
}

// Déplacement de 1 degré de longitude ≈ 111km × cos(latitude) — à Abidjan
// (lat ≈ 5.3) ça fait ~111km. On utilise donc petits deltas pour mocker.
// 0.0005° ≈ 55m à cette latitude (largement < 100m).
// 0.013°  ≈ 1.45km.
// 0.027°  ≈ 3.0km.

describe("listNearbyPlaces — Story 4.10", () => {
  it("lieu à <100m → is_within_spawt_range = true", () => {
    const places = [makePlace("p-near", "Tantie Rose", USER_LAT + 0.0005, USER_LNG)];
    const result = listNearbyPlaces(places, USER_LAT, USER_LNG);
    expect(result).toHaveLength(1);
    expect(result[0]?.is_within_spawt_range).toBe(true);
    expect(result[0]?.distance_km).toBeLessThan(SPAWT_RANGE_KM);
  });

  it("lieu à ~1.5km → présent mais is_within_spawt_range = false", () => {
    const places = [makePlace("p-mid", "Bô Zinc", USER_LAT + 0.013, USER_LNG)];
    const result = listNearbyPlaces(places, USER_LAT, USER_LNG);
    expect(result).toHaveLength(1);
    expect(result[0]?.is_within_spawt_range).toBe(false);
    expect(result[0]?.distance_km).toBeGreaterThan(SPAWT_RANGE_KM);
    expect(result[0]?.distance_km).toBeLessThan(NEARBY_RADIUS_KM);
  });

  it("lieu à >2km → filtré hors de la liste", () => {
    const places = [makePlace("p-far", "Loin", USER_LAT + 0.027, USER_LNG)];
    const result = listNearbyPlaces(places, USER_LAT, USER_LNG);
    expect(result).toHaveLength(0);
  });

  it("respecte limit=5 quand 12 lieux dans le rayon", () => {
    const places: PlaceWithAdn[] = [];
    for (let i = 0; i < 12; i++) {
      // Tous à <1km, espacés de 50m.
      places.push(makePlace(`p-${i}`, `Lieu ${i}`, USER_LAT + 0.0005 * (i + 1), USER_LNG));
    }
    const result = listNearbyPlaces(places, USER_LAT, USER_LNG);
    expect(result).toHaveLength(5);
  });

  it("respecte un limit custom (3)", () => {
    const places: PlaceWithAdn[] = [];
    for (let i = 0; i < 12; i++) {
      places.push(makePlace(`p-${i}`, `Lieu ${i}`, USER_LAT + 0.0005 * (i + 1), USER_LNG));
    }
    const result = listNearbyPlaces(places, USER_LAT, USER_LNG, 3);
    expect(result).toHaveLength(3);
  });

  it("tri ascendant par distance", () => {
    const places = [
      makePlace("p-c", "C-loin", USER_LAT + 0.010, USER_LNG),
      makePlace("p-a", "A-proche", USER_LAT + 0.0005, USER_LNG),
      makePlace("p-b", "B-milieu", USER_LAT + 0.005, USER_LNG),
    ];
    const result = listNearbyPlaces(places, USER_LAT, USER_LNG);
    const ids = result.map((r: NearbyPlace) => r.place.id);
    expect(ids).toEqual(["p-a", "p-b", "p-c"]);
  });

  it("filtre out les lieux non publiés", () => {
    const places = [
      makePlace("p-hidden", "Hidden", USER_LAT + 0.0005, USER_LNG, false),
      makePlace("p-visible", "Visible", USER_LAT + 0.0005, USER_LNG, true),
    ];
    const result = listNearbyPlaces(places, USER_LAT, USER_LNG);
    expect(result).toHaveLength(1);
    expect(result[0]?.place.id).toBe("p-visible");
  });

  it("retourne tableau vide quand aucun lieu dans le rayon", () => {
    const places = [makePlace("p-far", "Loin", USER_LAT + 0.5, USER_LNG)];
    const result = listNearbyPlaces(places, USER_LAT, USER_LNG);
    expect(result).toEqual([]);
  });

  it("retourne tableau vide quand la liste d'entrée est vide", () => {
    expect(listNearbyPlaces([], USER_LAT, USER_LNG)).toEqual([]);
  });

  it("limit=0 retourne tableau vide", () => {
    const places = [makePlace("p-near", "Proche", USER_LAT + 0.0005, USER_LNG)];
    expect(listNearbyPlaces(places, USER_LAT, USER_LNG, 0)).toEqual([]);
  });
});

describe("listNearbyPlaces — fallback ville quand la géoloc manque (multi-villes)", () => {
  it("sans coordonnées → distances depuis le point de référence de la ville active", () => {
    const places = [
      makePlace(
        "p-ref",
        "Réf ville",
        ABIDJAN_FALLBACK.default_lat + 0.0005,
        ABIDJAN_FALLBACK.default_lng,
      ),
    ];
    const result = listNearbyPlaces(places);
    expect(result).toHaveLength(1);
    expect(result[0]?.is_within_spawt_range).toBe(true);
  });

  it("null explicites → même fallback ville", () => {
    const places = [
      makePlace(
        "p-mid",
        "Milieu",
        ABIDJAN_FALLBACK.default_lat + 0.013,
        ABIDJAN_FALLBACK.default_lng,
      ),
    ];
    const result = listNearbyPlaces(places, null, null);
    expect(result).toHaveLength(1);
    expect(result[0]?.is_within_spawt_range).toBe(false);
  });

  it("lieu hors rayon du point de référence → filtré sans géoloc", () => {
    const places = [
      makePlace(
        "p-away",
        "Loin",
        ABIDJAN_FALLBACK.default_lat + 0.5,
        ABIDJAN_FALLBACK.default_lng,
      ),
    ];
    expect(listNearbyPlaces(places, null, null)).toEqual([]);
  });

  it("coordonnées explicites continuent de primer sur le fallback", () => {
    // Lieu proche du point ville mais loin de USER_LAT/LNG explicites.
    const places = [
      makePlace(
        "p-ville",
        "Près du point ville",
        ABIDJAN_FALLBACK.default_lat + 0.0005,
        ABIDJAN_FALLBACK.default_lng,
      ),
    ];
    expect(listNearbyPlaces(places, USER_LAT + 1, USER_LNG)).toEqual([]);
  });
});

describe("formatDistance — Story 4.10", () => {
  it("0.055km → '55 m'", () => {
    expect(formatDistance(0.055)).toBe("55 m");
  });

  it("0.5km → '500 m'", () => {
    expect(formatDistance(0.5)).toBe("500 m");
  });

  it("0.999km → '999 m' (juste en-dessous du seuil 1km)", () => {
    expect(formatDistance(0.999)).toBe("999 m");
  });

  it("1km → '1.0 km' (seuil exact)", () => {
    expect(formatDistance(1)).toBe("1.0 km");
  });

  it("1.46km → '1.5 km' (arrondi 1 décimale)", () => {
    // Note : 1.45 → '1.4 km' à cause de l'arrondi binaire IEEE 754
    // (Number.prototype.toFixed). On teste 1.46 pour avoir un arrondi
    // déterministe vers le haut.
    expect(formatDistance(1.46)).toBe("1.5 km");
  });

  it("1.94km → '1.9 km'", () => {
    expect(formatDistance(1.94)).toBe("1.9 km");
  });
});

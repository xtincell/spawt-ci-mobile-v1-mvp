// Tests Story 3.3a — schémas Zod Place / PlaceAdn / PlaceWithAdn.

import {
  PlaceSchema,
  PlaceAdnSchema,
  PlaceWithAdnSchema,
} from "../place.schema";

const VALID_ADN = {
  place_id: "00000000-0000-0000-0000-000000000001",
  axe_local_international: 0.6,
  axe_informel_etabli: 0.85,
  axe_budget_premium: 0.7,
  axe_populaire_prive: -0.3,
  axe_decontracte_habille: 0.6,
  confidence_score: 0.85,
  total_reviews: 87,
  weighted_rating: 4.6,
  updated_at: "2026-05-03T18:00:00Z",
};

const VALID_PLACE = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Bô Zinc",
  cuisine: ["francaise", "fusion"],
  location: {
    lat: 5.328,
    lng: -4.009,
    descriptive_address: "Zone 4, en face du centre commercial",
    neighborhood: "Zone 4",
    city: "Abidjan",
  },
  price: { tier: 3 as const, avg_ticket_xof: 25000 },
  hours: {
    mon: [{ open: "12:00", close: "23:00" }],
    tue: [{ open: "12:00", close: "23:00" }],
    wed: [{ open: "12:00", close: "23:00" }],
    thu: [{ open: "12:00", close: "23:00" }],
    fri: [{ open: "12:00", close: "23:00" }],
    sat: [{ open: "12:00", close: "23:00" }],
    sun: [{ open: "12:00", close: "23:00" }],
  },
  phone: "+22527XXXXXXX",
  whatsapp: null,
  cover_photo_url: null,
  gallery_urls: [],
  signals: ["institution"],
  is_published: true,
  created_at: "2026-05-03T18:00:00Z",
  updated_at: "2026-05-03T18:00:00Z",
};

describe("PlaceSchema", () => {
  it("parse une row valide", () => {
    const result = PlaceSchema.safeParse(VALID_PLACE);
    expect(result.success).toBe(true);
  });

  it("rejette un id non-UUID", () => {
    const result = PlaceSchema.safeParse({ ...VALID_PLACE, id: "place_bo_zinc" });
    expect(result.success).toBe(false);
  });

  it("rejette price.tier hors {1,2,3}", () => {
    const result = PlaceSchema.safeParse({
      ...VALID_PLACE,
      price: { tier: 4 },
    });
    expect(result.success).toBe(false);
  });

  it("rejette hours avec format heure invalide", () => {
    const result = PlaceSchema.safeParse({
      ...VALID_PLACE,
      hours: { mon: [{ open: "25:00", close: "12:00" }] },
    });
    expect(result.success).toBe(false);
  });
});

describe("PlaceAdnSchema", () => {
  it("parse un ADN valide", () => {
    expect(PlaceAdnSchema.safeParse(VALID_ADN).success).toBe(true);
  });

  it("rejette un axe hors [-1, 1]", () => {
    const bad = { ...VALID_ADN, axe_local_international: 1.5 };
    expect(PlaceAdnSchema.safeParse(bad).success).toBe(false);
  });

  it("rejette weighted_rating > 5", () => {
    const bad = { ...VALID_ADN, weighted_rating: 6 };
    expect(PlaceAdnSchema.safeParse(bad).success).toBe(false);
  });

  it("rejette total_reviews négatif", () => {
    const bad = { ...VALID_ADN, total_reviews: -1 };
    expect(PlaceAdnSchema.safeParse(bad).success).toBe(false);
  });
});

describe("PlaceWithAdnSchema", () => {
  it("parse une row Place + ADN + rating_display + total_spawts", () => {
    const full = {
      ...VALID_PLACE,
      adn: VALID_ADN,
      rating_display: 4.6,
      total_spawts: 87,
    };
    expect(PlaceWithAdnSchema.safeParse(full).success).toBe(true);
  });

  it("rejette une row sans adn (adn required)", () => {
    const noAdn = {
      ...VALID_PLACE,
      rating_display: 4.6,
      total_spawts: 87,
    };
    expect(PlaceWithAdnSchema.safeParse(noAdn).success).toBe(false);
  });
});

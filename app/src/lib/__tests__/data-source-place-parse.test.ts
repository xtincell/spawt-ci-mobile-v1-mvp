// R22 (build 8) — résilience de la frontière DB → TS quand l'inventaire est
// quasi vide : une row `places` sans relation `place_adn` (ou avec la relation
// remontée en array) ne doit PAS être droppée → ADN neutre synthétisé, la
// fiche rend « ADN en construction » au lieu d'un « lieu introuvable ».

interface MockResponse {
  data: unknown;
  error: { message: string } | null;
}

let mockResponse: MockResponse = { data: null, error: null };

jest.mock("../supabase", () => {
  const builder: Record<string, unknown> = {};
  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn(() => builder);
  builder.single = jest.fn(() => Promise.resolve(mockResponse));
  return {
    supabase: {
      from: jest.fn(() => builder),
    },
  };
});

import { getPlaceFromSupabase } from "../data-source.supabase";

const PLACE_ID = "11111111-1111-4111-8111-111111111111";

function baseRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: PLACE_ID,
    name: "Chez Test",
    cuisine: [],
    lat: 5.36,
    lng: -3.99,
    descriptive_address: "Rue des Jardins",
    neighborhood: "Cocody",
    city: "Abidjan",
    price_tier: 1,
    avg_ticket_xof: null,
    hours: {},
    phone: null,
    whatsapp: null,
    cover_photo_url: null,
    gallery_urls: [],
    menu_urls: [],
    signals: [],
    is_published: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    place_adn: null,
    ...overrides,
  };
}

function validAdn(): Record<string, unknown> {
  return {
    place_id: PLACE_ID,
    axe_local_international: 0.5,
    axe_informel_etabli: 0,
    axe_budget_premium: 0,
    axe_populaire_prive: 0,
    axe_decontracte_habille: 0,
    confidence_score: 0.8,
    total_reviews: 12,
    weighted_rating: 4.2,
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("getPlaceFromSupabase — R22 rows sans place_adn / relation array", () => {
  it("synthétise un ADN neutre quand place_adn manque (row gardée)", async () => {
    mockResponse = { data: baseRow({ place_adn: null }), error: null };
    const place = await getPlaceFromSupabase(PLACE_ID);
    expect(place).not.toBeNull();
    expect(place?.name).toBe("Chez Test");
    expect(place?.adn.total_reviews).toBe(0);
    expect(place?.adn.confidence_score).toBe(0);
    expect(place?.adn.weighted_rating).toBe(0);
  });

  it("normalise la relation place_adn remontée en ARRAY (premier élément)", async () => {
    mockResponse = { data: baseRow({ place_adn: [validAdn()] }), error: null };
    const place = await getPlaceFromSupabase(PLACE_ID);
    expect(place).not.toBeNull();
    expect(place?.adn.total_reviews).toBe(12);
    expect(place?.adn.weighted_rating).toBe(4.2);
  });

  it("tolère une row éparse (colonnes array/hours absentes)", async () => {
    mockResponse = {
      data: baseRow({
        place_adn: validAdn(),
        cuisine: undefined,
        gallery_urls: undefined,
        signals: undefined,
        hours: undefined,
        menu_urls: undefined,
      }),
      error: null,
    };
    const place = await getPlaceFromSupabase(PLACE_ID);
    expect(place).not.toBeNull();
    expect(place?.cuisine).toEqual([]);
    expect(place?.gallery_urls).toEqual([]);
    expect(place?.signals).toEqual([]);
    expect(place?.menu_urls).toEqual([]);
  });
});

// Multi-villes (PRD §18.1) — contrat getActiveCity() / refreshActiveCity() :
// fallback constante locale (mode démo, erreurs) + lecture `cities` mockée
// (mode Supabase). Voir le contrat en tête de lib/city.ts.

interface MockResponse {
  data: unknown;
  error: { message: string; code?: string } | null;
}

let mockResponse: MockResponse = { data: null, error: null };
let mockSupabaseConfigured = false;

jest.mock("../data-source", () => ({
  get isSupabaseConfigured() {
    return mockSupabaseConfigured;
  },
}));

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

import {
  ABIDJAN_FALLBACK,
  __resetActiveCityForTests,
  getActiveCity,
  refreshActiveCity,
} from "../city";

import fr from "../../i18n/fr.json";

function validCityRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    code: "abidjan",
    name: "Abidjan",
    country: "CI",
    default_lat: 5.3364,
    default_lng: -4.0267,
    communes: [
      { code: "cocody", name: "Cocody" },
      { code: "autre", name: "Autre / hors Abidjan" },
    ],
    is_active: true,
    ...overrides,
  };
}

beforeEach(() => {
  __resetActiveCityForTests();
  mockSupabaseConfigured = false;
  mockResponse = { data: null, error: null };
});

describe("city — mode démo (fallback constante locale)", () => {
  it("getActiveCity retourne la config Abidjan locale", () => {
    const city = getActiveCity();
    expect(city.code).toBe("abidjan");
    expect(city.default_lat).toBe(ABIDJAN_FALLBACK.default_lat);
    expect(city.default_lng).toBe(ABIDJAN_FALLBACK.default_lng);
    expect(city.is_active).toBe(true);
    expect(city.communes.length).toBeGreaterThan(0);
  });

  it("refreshActiveCity est un no-op sans Supabase", async () => {
    const city = await refreshActiveCity();
    expect(city).toBe(ABIDJAN_FALLBACK);
  });

  it("les codes communes du fallback = les clés i18n onboarding.commune.*", () => {
    const i18nKeys = Object.keys(fr.onboarding.commune).sort();
    const cityCodes = ABIDJAN_FALLBACK.communes.map((c) => c.code).sort();
    expect(cityCodes).toEqual(i18nKeys);
  });
});

describe("city — mode Supabase (lecture cities mockée)", () => {
  beforeEach(() => {
    mockSupabaseConfigured = true;
  });

  it("adopte une row DB valide (config pilotée par la table cities)", async () => {
    mockResponse = {
      data: validCityRow({ default_lat: 5.5, default_lng: -4.1 }),
      error: null,
    };
    const city = await refreshActiveCity();
    expect(city.default_lat).toBe(5.5);
    expect(city.default_lng).toBe(-4.1);
    expect(getActiveCity().default_lat).toBe(5.5);
  });

  it("getActiveCity déclenche le refresh lazy (fire-and-forget)", async () => {
    mockResponse = { data: validCityRow({ name: "Abidjan (DB)" }), error: null };
    expect(getActiveCity().name).toBe("Abidjan"); // premier appel : fallback
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getActiveCity().name).toBe("Abidjan (DB)");
  });

  it("erreur DB → constante locale conservée", async () => {
    mockResponse = { data: null, error: { message: "boom", code: "500" } };
    const city = await refreshActiveCity();
    expect(city).toBe(ABIDJAN_FALLBACK);
  });

  it("table absente (42P01) → constante locale conservée", async () => {
    mockResponse = {
      data: null,
      error: { message: 'relation "cities" does not exist', code: "42P01" },
    };
    const city = await refreshActiveCity();
    expect(city).toBe(ABIDJAN_FALLBACK);
  });

  it("row malformée (code manquant) → constante locale conservée", async () => {
    mockResponse = { data: { name: "Abidjan", is_active: true }, error: null };
    const city = await refreshActiveCity();
    expect(city).toBe(ABIDJAN_FALLBACK);
  });

  it("is_active=false en DB → constante locale conservée (fail-safe)", async () => {
    mockResponse = { data: validCityRow({ is_active: false }), error: null };
    const city = await refreshActiveCity();
    expect(city).toBe(ABIDJAN_FALLBACK);
  });

  it("coordonnées null en DB → coordonnées du fallback local", async () => {
    mockResponse = {
      data: validCityRow({ default_lat: null, default_lng: null }),
      error: null,
    };
    const city = await refreshActiveCity();
    expect(city.default_lat).toBe(ABIDJAN_FALLBACK.default_lat);
    expect(city.default_lng).toBe(ABIDJAN_FALLBACK.default_lng);
  });

  it("communes vides/malformées en DB → communes du fallback local", async () => {
    mockResponse = {
      data: validCityRow({ communes: [{ pas: "bon" }, 42] }),
      error: null,
    };
    const city = await refreshActiveCity();
    expect(city.communes).toEqual(ABIDJAN_FALLBACK.communes);
  });
});

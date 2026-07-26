// finding P2#12 — un compte staff voit sous RLS (0049/0050) les brouillons,
// événements passés et promos hors fenêtre. Le data layer doit réappliquer la
// fenêtre côté client (isEventCurrent / isPromoActive) pour que l'app n'affiche
// jamais que l'actif « en ce moment ».

interface MockResponse {
  data: unknown;
  error: { message: string } | null;
}

// Réponse par table (préfixe `mock` pour le hoisting jest).
const mockResponses: Record<string, MockResponse> = {};

function mockMakeBuilder(table: string) {
  const resolved = () => Promise.resolve(mockResponses[table] ?? { data: [], error: null });
  const b: Record<string, unknown> = {};
  const chain = () => jest.fn(() => b);
  b.select = chain();
  b.eq = chain();
  b.in = chain();
  b.order = chain();
  // Thenable : les requêtes sont await via Promise.all quel que soit le dernier
  // maillon (order pour events/promos, in pour la map d'activité).
  b.then = (resolve: (v: MockResponse) => unknown) => resolve(mockResponses[table] ?? { data: [], error: null });
  return b;
}

jest.mock("../supabase", () => ({
  supabase: { from: jest.fn((table: string) => mockMakeBuilder(table)) },
}));

import {
  listPlaceEventsFromSupabase,
  listPlaceActivityFromSupabase,
  listPlacePromotionsFromSupabase,
} from "../data-source.supabase";

const PAST = "2000-01-01T00:00:00.000Z";
const FUTURE = "2999-01-01T00:00:00.000Z";

beforeEach(() => {
  for (const k of Object.keys(mockResponses)) delete mockResponses[k];
});

describe("listPlaceEventsFromSupabase — fenêtre client (P2#12)", () => {
  it("droppe les événements passés remontés par la RLS staff", async () => {
    mockResponses["place_events"] = {
      data: [
        { id: "e-future", place_id: "p1", title: "À venir", description: null, starts_at: FUTURE, ends_at: null, image_url: null },
        { id: "e-past", place_id: "p1", title: "Passé", description: null, starts_at: PAST, ends_at: PAST, image_url: null },
      ],
      error: null,
    };
    const events = await listPlaceEventsFromSupabase("p1");
    expect(events.map((e) => e.id)).toEqual(["e-future"]);
  });
});

describe("listPlacePromotionsFromSupabase — fenêtre civile client (P2#12)", () => {
  it("droppe les promos hors fenêtre", async () => {
    mockResponses["place_promotions"] = {
      data: [
        { id: "pr-active", place_id: "p1", label: "En cours", description: null, starts_at: "2000-01-01", ends_at: "2999-01-01" },
        { id: "pr-expired", place_id: "p1", label: "Finie", description: null, starts_at: "2000-01-01", ends_at: "2000-02-01" },
      ],
      error: null,
    };
    const promos = await listPlacePromotionsFromSupabase("p1");
    expect(promos.map((p) => p.id)).toEqual(["pr-active"]);
  });
});

describe("listPlaceActivityFromSupabase — pastilles filtrées (P2#12)", () => {
  it("n'allume les pastilles que pour l'actif en cours", async () => {
    mockResponses["place_events"] = {
      data: [
        { place_id: "p-current-event", starts_at: FUTURE, ends_at: null },
        { place_id: "p-past-event", starts_at: PAST, ends_at: PAST },
      ],
      error: null,
    };
    mockResponses["place_promotions"] = {
      data: [
        { place_id: "p-active-promo", starts_at: "2000-01-01", ends_at: "2999-01-01" },
        { place_id: "p-expired-promo", starts_at: "2000-01-01", ends_at: "2000-02-01" },
      ],
      error: null,
    };
    const map = await listPlaceActivityFromSupabase([
      "p-current-event",
      "p-past-event",
      "p-active-promo",
      "p-expired-promo",
    ]);
    expect(map["p-current-event"]?.has_event).toBe(true);
    // Événement passé : aucune pastille (pas d'entrée créée).
    expect(map["p-past-event"]?.has_event ?? false).toBe(false);
    expect(map["p-active-promo"]?.has_promo).toBe(true);
    expect(map["p-expired-promo"]?.has_promo ?? false).toBe(false);
  });
});

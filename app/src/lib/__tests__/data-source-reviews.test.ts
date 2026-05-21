// Story 4.9 — AC #1 + AC #7 : `listReviewsForPlaceFromSupabase`.
// Vérifie le mapping flat→nested (spawters!inner), le drop des rows sans
// relation, le respect du tri/limit transmis au SDK Supabase, et la
// gestion d'erreur (return []).

type MockBuilder = {
  select: jest.Mock;
  eq: jest.Mock;
  not: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
};

interface MockResponse {
  data: unknown[] | null;
  error: { message: string } | null;
}

// Préfixe `mock` requis par jest pour pouvoir hoister `jest.mock()` au top et
// référencer ces variables depuis la factory.
let mockResponse: MockResponse = { data: [], error: null };
const mockCalls: { kind: string; args: unknown[] }[] = [];

function mockMakeBuilder(): MockBuilder {
  const b: Partial<MockBuilder> = {};
  b.select = jest.fn((...args: unknown[]) => {
    mockCalls.push({ kind: "select", args });
    return b as MockBuilder;
  });
  b.eq = jest.fn((...args: unknown[]) => {
    mockCalls.push({ kind: "eq", args });
    return b as MockBuilder;
  });
  b.not = jest.fn((...args: unknown[]) => {
    mockCalls.push({ kind: "not", args });
    return b as MockBuilder;
  });
  b.order = jest.fn((...args: unknown[]) => {
    mockCalls.push({ kind: "order", args });
    return b as MockBuilder;
  });
  // `limit` est le terminateur de chaîne — il déclenche la résolution.
  b.limit = jest.fn((...args: unknown[]) => {
    mockCalls.push({ kind: "limit", args });
    return Promise.resolve(mockResponse);
  });
  return b as MockBuilder;
}

jest.mock("../supabase", () => ({
  supabase: {
    from: jest.fn((..._args: unknown[]) => mockMakeBuilder()),
  },
}));

import { listReviewsForPlaceFromSupabase } from "../data-source.supabase";

describe("listReviewsForPlaceFromSupabase — Story 4.9 AC #1", () => {
  beforeEach(() => {
    mockCalls.length = 0;
    mockResponse = { data: [], error: null };
  });

  it("mappe les rows Supabase (relation objet) vers PlaceReview", async () => {
    mockResponse = {
      data: [
        {
          id: "r1",
          spawter_id: "s1",
          note_etoiles: 5,
          texte_avis: "Top",
          created_at: "2025-12-01T10:00:00Z",
          is_seed: true,
          spawters: { display_name: "Stéphanie", avatar_url: "https://x/y.jpg" },
        },
      ],
      error: null,
    };
    const out = await listReviewsForPlaceFromSupabase("place-1", 5);
    expect(out).toEqual([
      {
        id: "r1",
        spawter_id: "s1",
        spawter_display_name: "Stéphanie",
        spawter_avatar_url: "https://x/y.jpg",
        note_etoiles: 5,
        texte_avis: "Top",
        created_at: "2025-12-01T10:00:00Z",
        is_seed: true,
      },
    ]);
  });

  it("supporte la relation jointe en array (SDK shapes variantes)", async () => {
    mockResponse = {
      data: [
        {
          id: "r2",
          spawter_id: "s2",
          note_etoiles: 4,
          texte_avis: null,
          created_at: "2025-11-01T08:00:00Z",
          is_seed: false,
          spawters: [{ display_name: "Kidam", avatar_url: null }],
        },
      ],
      error: null,
    };
    const out = await listReviewsForPlaceFromSupabase("place-1", 5);
    expect(out).toHaveLength(1);
    expect(out[0]?.spawter_display_name).toBe("Kidam");
    expect(out[0]?.spawter_avatar_url).toBeNull();
  });

  it("drope les rows sans display_name (relation manquante)", async () => {
    mockResponse = {
      data: [
        {
          id: "r-bad",
          spawter_id: "s-bad",
          note_etoiles: 3,
          texte_avis: "x",
          created_at: "2025-10-01T08:00:00Z",
          is_seed: false,
          spawters: null,
        },
        {
          id: "r-ok",
          spawter_id: "s-ok",
          note_etoiles: 4,
          texte_avis: "y",
          created_at: "2025-10-01T08:00:00Z",
          is_seed: false,
          spawters: { display_name: "OK", avatar_url: null },
        },
      ],
      error: null,
    };
    const out = await listReviewsForPlaceFromSupabase("place-1", 5);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe("r-ok");
  });

  it("retourne [] si Supabase remonte une erreur", async () => {
    mockResponse = { data: null, error: { message: "boom" } };
    const out = await listReviewsForPlaceFromSupabase("place-1", 5);
    expect(out).toEqual([]);
  });

  it("retourne [] si data null sans erreur", async () => {
    mockResponse = { data: null, error: null };
    const out = await listReviewsForPlaceFromSupabase("place-1", 5);
    expect(out).toEqual([]);
  });

  it("appelle Supabase avec le tri qualité-puis-fraîcheur et limit", async () => {
    mockResponse = { data: [], error: null };
    await listReviewsForPlaceFromSupabase("place-42", 3);
    // select query string contient bien spawters!inner.
    const select = mockCalls.find((c) => c.kind === "select");
    expect(select?.args[0]).toContain("spawters!inner");
    // eq sur place_id avec la valeur transmise.
    const eq = mockCalls.find((c) => c.kind === "eq");
    expect(eq?.args).toEqual(["place_id", "place-42"]);
    // not is null sur note_etoiles.
    const not = mockCalls.find((c) => c.kind === "not");
    expect(not?.args).toEqual(["note_etoiles", "is", null]);
    // 2 orders : note_etoiles desc puis created_at desc.
    const orders = mockCalls.filter((c) => c.kind === "order");
    expect(orders).toHaveLength(2);
    expect(orders[0]?.args[0]).toBe("note_etoiles");
    expect(orders[1]?.args[0]).toBe("created_at");
    // limit transmis intact.
    const limit = mockCalls.find((c) => c.kind === "limit");
    expect(limit?.args[0]).toBe(3);
  });

  it("normalise avatar_url vide → null", async () => {
    mockResponse = {
      data: [
        {
          id: "r3",
          spawter_id: "s3",
          note_etoiles: 4,
          texte_avis: null,
          created_at: "2025-12-01T10:00:00Z",
          is_seed: false,
          spawters: { display_name: "X", avatar_url: "" },
        },
      ],
      error: null,
    };
    const out = await listReviewsForPlaceFromSupabase("place-1", 5);
    expect(out[0]?.spawter_avatar_url).toBeNull();
  });
});

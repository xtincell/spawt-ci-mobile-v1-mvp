// Story 4.12 — countReviewsForPlaceFromSupabase : compte exact (head request),
// même filtre que listReviews, fallback 0 sur erreur/null.

interface MockResponse {
  count: number | null;
  error: { message: string } | null;
}

let mockResponse: MockResponse = { count: 0, error: null };
const mockCalls: { kind: string; args: unknown[] }[] = [];

function mockMakeBuilder(): Record<string, unknown> {
  const b: Record<string, unknown> = {};
  b.select = jest.fn((...args: unknown[]) => {
    mockCalls.push({ kind: "select", args });
    return b;
  });
  b.eq = jest.fn((...args: unknown[]) => {
    mockCalls.push({ kind: "eq", args });
    return b;
  });
  // `not` est le terminateur de la chaîne count → résout la réponse.
  b.not = jest.fn((...args: unknown[]) => {
    mockCalls.push({ kind: "not", args });
    return Promise.resolve(mockResponse);
  });
  return b;
}

jest.mock("../supabase", () => ({
  supabase: {
    from: jest.fn((..._args: unknown[]) => mockMakeBuilder()),
  },
}));

import { countReviewsForPlaceFromSupabase } from "../data-source.supabase";

describe("countReviewsForPlaceFromSupabase — Story 4.12", () => {
  beforeEach(() => {
    mockCalls.length = 0;
    mockResponse = { count: 0, error: null };
  });

  it("retourne le count exact", async () => {
    mockResponse = { count: 12, error: null };
    const n = await countReviewsForPlaceFromSupabase("place-1");
    expect(n).toBe(12);
  });

  it("retourne 0 sur erreur", async () => {
    mockResponse = { count: null, error: { message: "boom" } };
    const n = await countReviewsForPlaceFromSupabase("place-1");
    expect(n).toBe(0);
  });

  it("retourne 0 si count null sans erreur", async () => {
    mockResponse = { count: null, error: null };
    const n = await countReviewsForPlaceFromSupabase("place-1");
    expect(n).toBe(0);
  });

  it("requête head/exact avec le bon filtre", async () => {
    await countReviewsForPlaceFromSupabase("place-42");
    const select = mockCalls.find((c) => c.kind === "select");
    expect(select?.args[0]).toBe("id");
    expect(select?.args[1]).toEqual({ count: "exact", head: true });
    const eq = mockCalls.find((c) => c.kind === "eq");
    expect(eq?.args).toEqual(["place_id", "place-42"]);
    const not = mockCalls.find((c) => c.kind === "not");
    expect(not?.args).toEqual(["note_etoiles", "is", null]);
  });
});

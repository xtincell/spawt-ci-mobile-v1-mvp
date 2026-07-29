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
  // Depuis 0066, la chaîne se termine sur `eq` : la lecture passe par la vue
  // `public_reviews`, qui porte déjà le filtre « avis noté et non supprimé ».
  // Le `.not(...)` d'avant a disparu — s'il revenait, ce serait le signe qu'on
  // interroge à nouveau la table `spawt_checkin`, qui ne rend que sa propre
  // ligne et renverrait donc un compte faux.
  // `eq` est désormais le terminateur : la chaîne s'arrête là.
  b.eq = jest.fn((...args: unknown[]) => {
    mockCalls.push({ kind: "eq", args });
    return Promise.resolve(mockResponse);
  });
  // `not` reste monté pour que son APPEL soit détectable — s'il est appelé,
  // c'est qu'on est revenu à la table `spawt_checkin` et que le compte est faux.
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
    // Plus de `.not(...)` : la vue porte déjà le filtre. Son retour signalerait
    // un retour à la table, donc un compte faux (une seule ligne visible).
    expect(mockCalls.find((c) => c.kind === "not")).toBeUndefined();
  });
});

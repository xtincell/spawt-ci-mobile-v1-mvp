// finding P2#6 — `fetchCrewSnapshotFromSupabase` doit demander les propositions
// TRIÉES par created_at : sans ORDER BY, l'ordre de fetch variait d'un refresh à
// l'autre et le départage « premier proposé » de crew-resolution (règle 3)
// devenait non déterministe. Ce test prouve que la requête crew_proposals porte
// bien `.order("created_at")` et que l'ordre renvoyé est préservé.

type Recorded = { kind: string; args: unknown[] };

interface MockResponse {
  data: unknown;
  error: { message: string } | null;
}

// Réponses par table + journal des appels par table (préfixe `mock` pour le
// hoisting jest).
const mockResponses: Record<string, MockResponse> = {};
const mockCallsByTable: Record<string, Recorded[]> = {};

function mockMakeBuilder(table: string) {
  const calls: Recorded[] = (mockCallsByTable[table] = []);
  const resolved = () => Promise.resolve(mockResponses[table] ?? { data: [], error: null });
  const b: Record<string, unknown> = {};
  const chain = (kind: string) =>
    jest.fn((...args: unknown[]) => {
      calls.push({ kind, args });
      return b;
    });
  b.select = chain("select");
  b.eq = chain("eq");
  b.in = chain("in");
  b.order = chain("order");
  b.maybeSingle = jest.fn(() => resolved());
  // Le builder est « thenable » : les requêtes qui ne finissent pas par
  // maybeSingle (members/proposals/votes) sont await via Promise.all.
  b.then = (resolve: (v: MockResponse) => unknown) =>
    resolve(mockResponses[table] ?? { data: [], error: null });
  return b;
}

jest.mock("../supabase", () => ({
  supabase: {
    from: jest.fn((table: string) => mockMakeBuilder(table)),
  },
}));

import { fetchCrewSnapshotFromSupabase } from "../data-source.supabase";

describe("fetchCrewSnapshotFromSupabase — ordre déterministe des propositions (P2#6)", () => {
  beforeEach(() => {
    for (const k of Object.keys(mockResponses)) delete mockResponses[k];
    for (const k of Object.keys(mockCallsByTable)) delete mockCallsByTable[k];
    mockResponses["crew_sessions"] = {
      data: {
        id: "sess-1",
        code: "AB2CD",
        host_id: "host-1",
        status: "voting",
        winning_place_id: null,
        expires_at: "2026-07-26T20:00:00.000Z",
        created_at: "2026-07-26T18:00:00.000Z",
      },
      error: null,
    };
    mockResponses["crew_members"] = { data: [], error: null };
    mockResponses["crew_votes"] = { data: [], error: null };
  });

  it("demande crew_proposals trié par created_at (puis id en tiebreak)", async () => {
    mockResponses["crew_proposals"] = {
      data: [
        { id: "p1", session_id: "sess-1", place_id: "place-1", proposed_by: "u1", created_at: "2026-07-26T18:01:00.000Z", places: { name: "Chez Awa", neighborhood: "Cocody" } },
        { id: "p2", session_id: "sess-1", place_id: "place-2", proposed_by: "u2", created_at: "2026-07-26T18:02:00.000Z", places: { name: "Le Maquis", neighborhood: "Yop" } },
      ],
      error: null,
    };

    const snap = await fetchCrewSnapshotFromSupabase("sess-1", "u1");
    expect(snap).not.toBeNull();

    // La requête crew_proposals porte bien un order created_at ascendant.
    const orders = (mockCallsByTable["crew_proposals"] ?? []).filter((c) => c.kind === "order");
    expect(orders.length).toBeGreaterThanOrEqual(1);
    expect(orders[0]?.args?.[0]).toBe("created_at");
    expect(orders[0]?.args?.[1]).toEqual({ ascending: true });

    // L'ordre renvoyé par la DB (premier proposé en tête) est préservé.
    expect(snap?.proposals.map((p) => p.id)).toEqual(["p1", "p2"]);
  });
});

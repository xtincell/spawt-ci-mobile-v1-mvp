// finding P2#13 — course hydrate/reset : un hydrate(B) juste après reset() ne
// doit PAS récupérer la promesse d'un hydrate(A) en vol (sinon B n'hydrate
// jamais), et la résolution tardive de A ne doit rien écrire dans le store de B.

import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (v: T) => void;
}
// Préfixe `mock` requis par jest pour référencer depuis la factory jest.mock.
function mockDefer<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

// listBadges est différé PAR spawter_id → on contrôle la fin de chaque hydrate.
const mockBadgesDefer: Record<string, Deferred<unknown>> = {};
const mockBadgeCheck = jest.fn((..._args: unknown[]) => Promise.resolve([] as string[]));
const mockDisplayBadge = jest.fn((..._args: unknown[]) => Promise.resolve("ok"));
jest.mock("../../lib/data-source", () => ({
  __esModule: true,
  listBadges: (id: string) => (mockBadgesDefer[id] ??= mockDefer<unknown>()).promise,
  listSpawterCards: () => Promise.resolve([]),
  getPawsBalance: () => Promise.resolve(0),
  listPawsLedger: () => Promise.resolve([]),
  getMyStreak: () => Promise.resolve(null),
  listActiveChallenges: () => Promise.resolve([]),
  setBadgeDisplayed: (...args: unknown[]) => mockDisplayBadge(...args),
  triggerBadgeCheck: (...args: unknown[]) => mockBadgeCheck(...args),
}));

import { useProgressionStore } from "../progression-store";

beforeEach(async () => {
  for (const k of Object.keys(mockBadgesDefer)) delete mockBadgesDefer[k];
  useProgressionStore.getState().reset();
  mockBadgeCheck.mockReset().mockResolvedValue([]);
  mockDisplayBadge.mockReset().mockResolvedValue("ok");
  await AsyncStorage.clear();
});

describe("progression-store — course hydrate/reset (P2#13)", () => {
  it("logout pendant hydrate(A) puis hydrate(B) → B hydrate, A ne fuit pas", async () => {
    const A = "spawter-A";
    const B = "spawter-B";
    const dA = (mockBadgesDefer[A] = mockDefer<unknown>());
    const dB = (mockBadgesDefer[B] = mockDefer<unknown>());

    // hydrate(A) démarre (in-flight, spawterId=A) — pas encore résolu.
    const pA = useProgressionStore.getState().hydrate(A);
    expect(useProgressionStore.getState().spawterId).toBe(A);

    // Logout : reset() invalide le guard in-flight + spawterId.
    useProgressionStore.getState().reset();
    expect(useProgressionStore.getState().spawterId).toBeNull();

    // hydrate(B) : ne DOIT PAS récupérer la promesse de A.
    const pB = useProgressionStore.getState().hydrate(B);
    expect(useProgressionStore.getState().spawterId).toBe(B);
    expect(pB).not.toBe(pA);

    // A résout en retard → compte courant = B → n'écrit RIEN (pas de fuite).
    dA.resolve({ catalogue: [], unlocked: [{ badge_code: "a1" }] });
    await pA;
    expect(useProgressionStore.getState().spawterId).toBe(B);
    expect(useProgressionStore.getState().badges).toBeNull();

    // B résout → écrit SES données.
    dB.resolve({ catalogue: [], unlocked: [{ badge_code: "b1" }] });
    await pB;
    const s = useProgressionStore.getState();
    expect(s.spawterId).toBe(B);
    expect(s.hydrated).toBe(true);
    expect((s.badges?.unlocked ?? []).map((b) => b.badge_code)).toEqual(["b1"]);
  });

  it("reset() nulle le guard : une hydratation en vol ne réécrit rien après logout", async () => {
    const A = "spawter-A";
    const dA = (mockBadgesDefer[A] = mockDefer<unknown>());
    const pA = useProgressionStore.getState().hydrate(A);
    useProgressionStore.getState().reset();
    // A résout après reset → ignoré (spawterId null puis jamais A).
    dA.resolve({ catalogue: [], unlocked: [{ badge_code: "a1" }] });
    await pA;
    expect(useProgressionStore.getState().badges).toBeNull();
    expect(useProgressionStore.getState().hydrated).toBe(false);
  });

  it("un badge check de A ne restaure ni badge ni célébration après déconnexion", async () => {
    const pending = mockDefer<string[]>();
    mockBadgeCheck.mockReturnValue(pending.promise);
    const a = useProgressionStore.getState().runBadgeCheck("A");
    useProgressionStore.getState().reset();
    pending.resolve(["badge-A"]);
    await a;
    expect(useProgressionStore.getState().badges).toBeNull();
    expect(useProgressionStore.getState().pendingBadgeCelebrations).toEqual([]);
    expect(await AsyncStorage.getItem("spawt:progression:badges_seen")).toBeNull();
  });

  it("une réponse du même compte avant déconnexion ne traverse pas une nouvelle session", async () => {
    const first = mockDefer<unknown>();
    mockBadgesDefer.A = first;
    const a = useProgressionStore.getState().hydrate("A");
    useProgressionStore.getState().reset();
    const second = mockDefer<unknown>();
    mockBadgesDefer.A = second;
    const next = useProgressionStore.getState().hydrate("A");
    first.resolve({ catalogue: [], unlocked: [{ badge_code: "stale" }] });
    await a;
    expect(useProgressionStore.getState().badges).toBeNull();
    second.resolve({ catalogue: [], unlocked: [] });
    await next;
    expect(useProgressionStore.getState().badges?.unlocked).toEqual([]);
  });
});

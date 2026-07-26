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
jest.mock("../../lib/data-source", () => ({
  __esModule: true,
  listBadges: (id: string) => (mockBadgesDefer[id] ??= mockDefer<unknown>()).promise,
  listSpawterCards: () => Promise.resolve([]),
  getPawsBalance: () => Promise.resolve(0),
  listPawsLedger: () => Promise.resolve([]),
  getMyStreak: () => Promise.resolve(null),
  listActiveChallenges: () => Promise.resolve([]),
  setBadgeDisplayed: () => Promise.resolve(true),
  triggerBadgeCheck: () => Promise.resolve([]),
}));

import { useProgressionStore } from "../progression-store";

beforeEach(async () => {
  for (const k of Object.keys(mockBadgesDefer)) delete mockBadgesDefer[k];
  useProgressionStore.getState().reset();
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
});

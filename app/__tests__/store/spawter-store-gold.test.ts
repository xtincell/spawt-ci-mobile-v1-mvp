// Sprint 2 — revalidation de l'entitlement Gold par le store :
// hydratation (cache local puis réseau), refreshGold (indéterminé = on garde
// le dernier état), foreground (AppState), reset (purge cross-user).

const mockStorage = new Map<string, string>();
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((k: string) => Promise.resolve(mockStorage.get(k) ?? null)),
    setItem: jest.fn((k: string, v: string) => {
      mockStorage.set(k, v);
      return Promise.resolve();
    }),
    removeItem: jest.fn((k: string) => {
      mockStorage.delete(k);
      return Promise.resolve();
    }),
    multiRemove: jest.fn((keys: string[]) => {
      for (const k of keys) mockStorage.delete(k);
      return Promise.resolve();
    }),
  },
}));

const mockFetchGold = jest.fn<Promise<unknown>, []>();
jest.mock("../../src/lib/data-source", () => ({
  saveSpawter: jest.fn(() => Promise.resolve()),
  savePalais: jest.fn(() => Promise.resolve()),
  isSupabaseConfigured: false,
  upsertProgression: jest.fn(() => Promise.resolve()),
  insertTitre: jest.fn(() => Promise.resolve()),
  setDisplayedTitre: jest.fn(() => Promise.resolve()),
  listSavedPlaceIds: jest.fn(() => Promise.resolve(null)),
  saveSavedPlace: jest.fn(() => Promise.resolve()),
  deleteSavedPlace: jest.fn(() => Promise.resolve()),
  updateSpawterArchetype: jest.fn(() => Promise.resolve()),
  fetchSpawterArchetype: jest.fn(() => Promise.resolve(null)),
  fetchGoldEntitlement: () => mockFetchGold(),
}));

jest.mock("../../src/lib/supabase", () => ({
  supabase: { auth: { getUser: jest.fn() } },
}));

jest.mock("../../src/lib/analytics", () => ({
  __esModule: true,
  track: jest.fn(),
  flushPendingSignals: jest.fn(),
}));

// Capture du listener AppState posé par ensureGoldForegroundRefresh (wiring
// module-level unique — spy installé AVANT le premier hydrate, jamais restauré).
import { AppState } from "react-native";
const appStateHandlers: Array<(state: string) => void> = [];
jest.spyOn(AppState, "addEventListener").mockImplementation(((
  _type: string,
  handler: (state: string) => void,
) => {
  appStateHandlers.push(handler);
  return { remove: jest.fn() };
}) as never);

import { useSpawterStore } from "../../src/store/spawter-store";
import {
  GOLD_STORAGE_KEY,
  isGoldSpawter,
  setGoldEntitlementState,
} from "../../src/lib/spawter-gold";
import { SAMPLE_SPAWTER } from "../../src/data/seed/sample-spawter";
import type { GoldEntitlement } from "../../src/lib/data-source";

// Dates lointaines : pas besoin de mocker Date.now.
const FUTURE = "2099-01-01T00:00:00.000Z";

function goldActif(overrides: Partial<GoldEntitlement> = {}): GoldEntitlement {
  return {
    active: true,
    plan: "gold_monthly",
    status: "active",
    expires_at: FUTURE,
    grace_until: null,
    checked_at: "2026-07-26T12:00:00.000Z",
    ...overrides,
  };
}

function goldAbsent(): GoldEntitlement {
  return {
    active: false,
    plan: null,
    status: null,
    expires_at: null,
    grace_until: null,
    checked_at: "2026-07-26T12:00:00.000Z",
  };
}

/** Laisse retomber les fire-and-forget (hydrate gold est non-bloquant). */
async function flushAsync(turns = 4): Promise<void> {
  for (let i = 0; i < turns; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

beforeEach(() => {
  mockStorage.clear();
  mockFetchGold.mockReset();
  setGoldEntitlementState(null);
  useSpawterStore.setState({ gold: null, hydrating: true });
});

describe("refreshGold — revalidation réseau", () => {
  it("entitlement actif → state.gold posé, isGoldSpawter true, cache persisté", async () => {
    const fresh = goldActif();
    mockFetchGold.mockResolvedValue(fresh);
    await useSpawterStore.getState().refreshGold();
    expect(useSpawterStore.getState().gold).toEqual(fresh);
    expect(isGoldSpawter(SAMPLE_SPAWTER)).toBe(true);
    expect(mockStorage.get(GOLD_STORAGE_KEY)).toBe(JSON.stringify(fresh));
  });

  it("réponse « pas de droit » (active:false) → gold dégradé proprement", async () => {
    useSpawterStore.setState({ gold: goldActif() });
    mockFetchGold.mockResolvedValue(goldAbsent());
    await useSpawterStore.getState().refreshGold();
    expect(useSpawterStore.getState().gold?.active).toBe(false);
    expect(isGoldSpawter(SAMPLE_SPAWTER)).toBe(false);
  });

  it("résultat indéterminé (null : erreur réseau) → conserve le dernier état", async () => {
    const cached = goldActif();
    useSpawterStore.setState({ gold: cached });
    setGoldEntitlementState(cached);
    mockFetchGold.mockResolvedValue(null);
    await useSpawterStore.getState().refreshGold();
    expect(useSpawterStore.getState().gold).toEqual(cached);
    expect(isGoldSpawter(SAMPLE_SPAWTER)).toBe(true);
  });

  it("fetch qui rejette → pas de crash, état conservé", async () => {
    const cached = goldActif();
    useSpawterStore.setState({ gold: cached });
    mockFetchGold.mockRejectedValue(new Error("boom réseau"));
    await expect(useSpawterStore.getState().refreshGold()).resolves.toBeUndefined();
    expect(useSpawterStore.getState().gold).toEqual(cached);
  });
});

describe("hydrate — cache local puis revalidation", () => {
  it("adopte le cache AsyncStorage puis appelle la revalidation réseau", async () => {
    const cached = goldActif({ plan: "gold_annual" });
    mockStorage.set(GOLD_STORAGE_KEY, JSON.stringify(cached));
    mockFetchGold.mockResolvedValue(null); // réseau indéterminé → cache conservé
    await useSpawterStore.getState().hydrate();
    await flushAsync();
    expect(useSpawterStore.getState().gold).toEqual(cached);
    expect(isGoldSpawter(SAMPLE_SPAWTER)).toBe(true);
    expect(mockFetchGold).toHaveBeenCalled();
  });

  it("la revalidation réseau remplace le cache (droit tombé côté serveur)", async () => {
    mockStorage.set(GOLD_STORAGE_KEY, JSON.stringify(goldActif()));
    mockFetchGold.mockResolvedValue(goldAbsent());
    await useSpawterStore.getState().hydrate();
    await flushAsync();
    expect(useSpawterStore.getState().gold?.active).toBe(false);
    expect(isGoldSpawter(SAMPLE_SPAWTER)).toBe(false);
  });

  it("arme le refresh au retour foreground (AppState active)", async () => {
    mockFetchGold.mockResolvedValue(goldAbsent());
    await useSpawterStore.getState().hydrate();
    await flushAsync();
    expect(appStateHandlers.length).toBeGreaterThan(0);

    mockFetchGold.mockClear();
    mockFetchGold.mockResolvedValue(goldActif());
    for (const handler of appStateHandlers) handler("active");
    await flushAsync();
    expect(mockFetchGold).toHaveBeenCalled();
    expect(useSpawterStore.getState().gold?.active).toBe(true);
  });

  it("un passage background ne déclenche PAS de revalidation", async () => {
    mockFetchGold.mockResolvedValue(goldAbsent());
    await useSpawterStore.getState().hydrate();
    await flushAsync();
    mockFetchGold.mockClear();
    for (const handler of appStateHandlers) handler("background");
    await flushAsync();
    expect(mockFetchGold).not.toHaveBeenCalled();
  });
});

describe("reset — purge cross-user", () => {
  it("vide l'état, le cache module et la clé AsyncStorage", async () => {
    const cached = goldActif();
    useSpawterStore.setState({ gold: cached });
    setGoldEntitlementState(cached);
    mockStorage.set(GOLD_STORAGE_KEY, JSON.stringify(cached));

    useSpawterStore.getState().reset();
    await flushAsync();

    expect(useSpawterStore.getState().gold).toBeNull();
    expect(isGoldSpawter(SAMPLE_SPAWTER)).toBe(false);
    expect(mockStorage.has(GOLD_STORAGE_KEY)).toBe(false);
  });
});

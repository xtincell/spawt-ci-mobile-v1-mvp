// Story 5.4 — Tests pendingStadeCelebration + consumePendingStadeCelebration.

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

jest.mock("../../src/lib/data-source", () => ({
  saveSpawter: jest.fn(() => Promise.resolve()),
  savePalais: jest.fn(() => Promise.resolve()),
  isSupabaseConfigured: false,
  upsertProgression: jest.fn(() => Promise.resolve()),
  insertTitre: jest.fn(() => Promise.resolve()),
  setDisplayedTitre: jest.fn(() => Promise.resolve()),
}));

jest.mock("../../src/lib/supabase", () => ({
  supabase: { auth: { getUser: jest.fn() } },
}));

jest.mock("../../src/lib/analytics", () => ({
  __esModule: true,
  track: jest.fn(),
  flushPendingSignals: jest.fn(),
}));

import { useSpawterStore } from "../../src/store/spawter-store";
import { SAMPLE_SPAWTER } from "../../src/data/seed/sample-spawter";
import type { SpawtCheckin } from "../../src/types/spawt";

function makeSpawt(overrides: Partial<SpawtCheckin> = {}): SpawtCheckin {
  return {
    id: `s-${Math.random().toString(36).slice(2, 10)}`,
    spawter_id: SAMPLE_SPAWTER.id,
    place_id: "place-default",
    arrived_at: "2026-05-20T12:00:00Z",
    notified_at: null,
    snoozed_at: null,
    snooze_count: 0,
    checked_in_at: "2026-05-20T12:30:00Z",
    left_at: null,
    check_in_type: "active",
    session_duration_minutes: 30,
    geolocation_lat: 5.35,
    geolocation_lng: -3.97,
    accuracy_meters: 10,
    geolocation_source: "gps",
    distance_to_lieu_meters: 5,
    is_verified: true,
    flag_reason: null,
    note_etoiles: null,
    texte_avis: null,
    tags: [],
    photos: [],
    is_cancelled: false,
    is_seed: false,
    created_at: "2026-05-20T12:00:00Z",
    updated_at: "2026-05-20T12:30:00Z",
    ...overrides,
  };
}

async function spawtN(n: number, startId = 0): Promise<void> {
  for (let i = 0; i < n; i++) {
    await useSpawterStore
      .getState()
      .registerSpawt(makeSpawt({ id: `s-${startId + i}`, place_id: `place-${startId + i}` }));
  }
}

beforeEach(() => {
  mockStorage.clear();
  // CR M7 — reset() clear le Set __celebrationInFlight module-level pour que
  // chaque test reparte d'un état propre (sinon une célébration set par un test
  // précédent reste in-flight et le test courant skip son propre celebration).
  useSpawterStore.getState().reset();
  useSpawterStore.setState({
    hydrating: false,
    spawter: { ...SAMPLE_SPAWTER, total_spawts: 0, unique_spots: 0, stade: "touriste" },
    palais: null,
    spawts: [],
    savedPlaceIds: new Set(),
    pendingBadge: null,
    collectionTitres: [],
    pendingStadeCelebration: null,
  });
});

describe("pendingStadeCelebration — Story 5.4", () => {
  it("franchissement 11 spots → pendingStadeCelebration set", async () => {
    await spawtN(11);
    const pending = useSpawterStore.getState().pendingStadeCelebration;
    expect(pending).not.toBeNull();
    expect(pending?.from_stade).toBe("touriste");
    expect(pending?.to_stade).toBe("explorateur");
    expect(pending?.unique_spots).toBe(11);
  });

  it("consumePendingStadeCelebration → flag AsyncStorage posé + state null", async () => {
    await spawtN(11);
    expect(useSpawterStore.getState().pendingStadeCelebration).not.toBeNull();
    await useSpawterStore.getState().consumePendingStadeCelebration();
    expect(useSpawterStore.getState().pendingStadeCelebration).toBeNull();
    expect(mockStorage.get("spawt:stade:celebrated:explorateur")).toBeTruthy();
  });

  it("anti-replay : si flag posé, pendingStadeCelebration reste null au prochain franchissement", async () => {
    mockStorage.set("spawt:stade:celebrated:explorateur", new Date().toISOString());
    await spawtN(11);
    expect(useSpawterStore.getState().pendingStadeCelebration).toBeNull();
  });

  it("4 seuils successifs → 4 célébrations distinctes (anti-replay independant par stade)", async () => {
    await spawtN(11);
    expect(useSpawterStore.getState().pendingStadeCelebration?.to_stade).toBe("explorateur");
    await useSpawterStore.getState().consumePendingStadeCelebration();

    await spawtN(10, 11);
    expect(useSpawterStore.getState().pendingStadeCelebration?.to_stade).toBe("detective");
    await useSpawterStore.getState().consumePendingStadeCelebration();

    await spawtN(10, 21);
    expect(useSpawterStore.getState().pendingStadeCelebration?.to_stade).toBe("djidji");
    await useSpawterStore.getState().consumePendingStadeCelebration();

    await spawtN(20, 31);
    expect(useSpawterStore.getState().pendingStadeCelebration?.to_stade).toBe("guide");
    expect(useSpawterStore.getState().spawter?.stade).toBe("guide");
  });
});

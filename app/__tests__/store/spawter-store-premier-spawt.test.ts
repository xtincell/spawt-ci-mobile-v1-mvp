// Story 4.2 — Tests détection Premier Spawt côté spawter-store.

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

const mockTrack = jest.fn();
jest.mock("../../src/lib/analytics", () => ({
  __esModule: true,
  track: (...args: unknown[]) => mockTrack(...args),
  flushPendingSignals: jest.fn(),
}));

import { useSpawterStore } from "../../src/store/spawter-store";
import { SAMPLE_SPAWTER } from "../../src/data/seed/sample-spawter";
import type { SpawtCheckin } from "../../src/types/spawt";

function makeSpawt(overrides: Partial<SpawtCheckin> = {}): SpawtCheckin {
  return {
    id: "s1",
    spawter_id: SAMPLE_SPAWTER.id,
    place_id: "place-bo-zinc",
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

beforeEach(() => {
  mockStorage.clear();
  mockTrack.mockClear();
  useSpawterStore.setState({
    hydrating: false,
    spawter: { ...SAMPLE_SPAWTER, total_spawts: 0 },
    palais: null,
    spawts: [],
    savedPlaceIds: new Set(),
    pendingBadge: null,
    collectionTitres: [],
    pendingStadeCelebration: null,
  });
});

describe("registerSpawt — Premier Spawt detect (Story 4.2)", () => {
  it("0 → 1 spawt verified : pendingBadge set + event spawt_first_completed émis", async () => {
    await useSpawterStore.getState().registerSpawt(makeSpawt());
    expect(useSpawterStore.getState().pendingBadge).not.toBeNull();
    expect(mockTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "spawt_first_completed",
        properties: expect.objectContaining({ place_id: "place-bo-zinc" }),
      }),
    );
  });

  it("2e spawt : pas de re-émission `spawt_first_completed`", async () => {
    await useSpawterStore.getState().registerSpawt(makeSpawt());
    mockTrack.mockClear();
    // Acquitte le badge (flag AsyncStorage set-once)
    await useSpawterStore.getState().consumePendingBadge();
    await useSpawterStore
      .getState()
      .registerSpawt(makeSpawt({ id: "s2", place_id: "place-mama" }));
    expect(
      mockTrack.mock.calls.some(
        (call) => (call[0] as { name?: string })?.name === "spawt_first_completed",
      ),
    ).toBe(false);
  });

  it("1er spawt non-verified : pas de badge ni d'event", async () => {
    await useSpawterStore
      .getState()
      .registerSpawt(makeSpawt({ is_verified: false }));
    expect(useSpawterStore.getState().pendingBadge).toBeNull();
    expect(
      mockTrack.mock.calls.some(
        (call) => (call[0] as { name?: string })?.name === "spawt_first_completed",
      ),
    ).toBe(false);
  });

  it("anti-replay : si flag AsyncStorage set, pas de re-trigger badge même après reset state", async () => {
    mockStorage.set(
      "spawt:badge:premier_spawt_celebrated",
      new Date().toISOString(),
    );
    await useSpawterStore.getState().registerSpawt(makeSpawt());
    expect(useSpawterStore.getState().pendingBadge).toBeNull();
  });
});

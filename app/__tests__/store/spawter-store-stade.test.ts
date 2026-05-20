// Story 5.1 + 5.2 — Tests franchissement de stade + collection de titres + sync.

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

const mockUpsertProgression = jest.fn((..._args: unknown[]) => Promise.resolve());
const mockInsertTitre = jest.fn((..._args: unknown[]) => Promise.resolve());
const mockSetDisplayedTitre = jest.fn((..._args: unknown[]) => Promise.resolve());

jest.mock("../../src/lib/data-source", () => ({
  saveSpawter: jest.fn(() => Promise.resolve()),
  savePalais: jest.fn(() => Promise.resolve()),
  isSupabaseConfigured: false,
  upsertProgression: (...args: unknown[]) => mockUpsertProgression(...(args as [])),
  insertTitre: (...args: unknown[]) => mockInsertTitre(...(args as [])),
  setDisplayedTitre: (...args: unknown[]) => mockSetDisplayedTitre(...(args as [])),
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
  mockTrack.mockClear();
  mockUpsertProgression.mockClear();
  mockInsertTitre.mockClear();
  mockSetDisplayedTitre.mockClear();
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

describe("registerSpawt — franchissement de stade (Story 5.1)", () => {
  it("11 spots uniques verified → stade explorateur + event stade_unlocked", async () => {
    await spawtN(11);
    const spawter = useSpawterStore.getState().spawter;
    expect(spawter?.stade).toBe("explorateur");
    expect(
      mockTrack.mock.calls.some(
        (call) =>
          (call[0] as { name?: string })?.name === "stade_unlocked" &&
          (call[0] as { properties?: { to_stade?: string } })?.properties?.to_stade === "explorateur",
      ),
    ).toBe(true);
  });

  it("upsertProgression appelé à chaque registerSpawt avec snapshot courant", async () => {
    await spawtN(1);
    expect(mockUpsertProgression).toHaveBeenCalled();
    const lastCall = mockUpsertProgression.mock.calls[mockUpsertProgression.mock.calls.length - 1];
    expect(lastCall?.[0]).toEqual(
      expect.objectContaining({
        spawter_id: SAMPLE_SPAWTER.id,
        unique_spots: 1,
        stade: "touriste",
        current_title: "title.touriste",
      }),
    );
  });

  it("spawt non-vérifié → pas d'event stade_unlocked, pas de changement de stade", async () => {
    await useSpawterStore
      .getState()
      .registerSpawt(makeSpawt({ is_verified: false, place_id: "place-x" }));
    expect(useSpawterStore.getState().spawter?.stade).toBe("touriste");
    expect(
      mockTrack.mock.calls.some(
        (call) => (call[0] as { name?: string })?.name === "stade_unlocked",
      ),
    ).toBe(false);
  });

  it("rejouer le même spawt → idempotent (unique_spots inchangé, pas de re-émission)", async () => {
    await useSpawterStore
      .getState()
      .registerSpawt(makeSpawt({ id: "s1", place_id: "place-1" }));
    mockTrack.mockClear();
    // Re-register : place_id identique → unique_spots reste 1 (Set dedup).
    await useSpawterStore
      .getState()
      .registerSpawt(makeSpawt({ id: "s2", place_id: "place-1" }));
    expect(useSpawterStore.getState().spawter?.unique_spots).toBe(1);
    expect(
      mockTrack.mock.calls.some(
        (call) => (call[0] as { name?: string })?.name === "stade_unlocked",
      ),
    ).toBe(false);
  });

  it("franchissement 11 → ajoute le titre explorateur à la collection (Story 5.2 cabling)", async () => {
    await spawtN(11);
    // Laisse résoudre les microtasks fire-and-forget.
    await new Promise((r) => setImmediate(r));
    const titres = useSpawterStore.getState().collectionTitres;
    expect(titres.some((t) => t.title_key === "title.explorateur" && t.source === "stade")).toBe(true);
  });

  it("franchissement 21 → ajoute le titre detective sans duplicate", async () => {
    await spawtN(21);
    await new Promise((r) => setImmediate(r));
    const titres = useSpawterStore.getState().collectionTitres;
    const detectives = titres.filter((t) => t.title_key === "title.detective");
    expect(detectives.length).toBe(1);
  });
});

describe("unlockTitle / setDisplayedTitle (Story 5.2)", () => {
  it("unlockTitle('title.explorateur', 'stade') → row ajoutée, return true", async () => {
    const added = await useSpawterStore.getState().unlockTitle("title.explorateur", "stade");
    expect(added).toBe(true);
    const list = useSpawterStore.getState().collectionTitres;
    expect(list).toHaveLength(1);
    expect(list[0]?.title_key).toBe("title.explorateur");
  });

  it("rejouer unlockTitle même clé → idempotent, return false", async () => {
    await useSpawterStore.getState().unlockTitle("title.explorateur", "stade");
    const again = await useSpawterStore.getState().unlockTitle("title.explorateur", "stade");
    expect(again).toBe(false);
    expect(useSpawterStore.getState().collectionTitres).toHaveLength(1);
  });

  it("unlockTitle clé inconnue → no-op + return false", async () => {
    const added = await useSpawterStore.getState().unlockTitle("title.fantaisie", "stade");
    expect(added).toBe(false);
    expect(useSpawterStore.getState().collectionTitres).toHaveLength(0);
  });

  it("setDisplayedTitle après unlock → is_displayed=true sur cette row uniquement", async () => {
    await useSpawterStore.getState().unlockTitle("title.touriste", "stade");
    await useSpawterStore.getState().unlockTitle("title.explorateur", "stade");
    await useSpawterStore.getState().setDisplayedTitle("title.explorateur");
    const list = useSpawterStore.getState().collectionTitres;
    expect(list.find((r) => r.title_key === "title.explorateur")?.is_displayed).toBe(true);
    expect(list.find((r) => r.title_key === "title.touriste")?.is_displayed).toBe(false);
    // Event analytics émis.
    expect(
      mockTrack.mock.calls.some(
        (call) => (call[0] as { name?: string })?.name === "title_displayed_changed",
      ),
    ).toBe(true);
  });

  it("setDisplayedTitle sur titre non débloqué → no-op silencieux", async () => {
    await useSpawterStore.getState().setDisplayedTitle("title.guide");
    expect(useSpawterStore.getState().collectionTitres).toHaveLength(0);
  });
});

describe("consumePendingBadge → unlock Premier Spawt (Story 5.2)", () => {
  it("consumePendingBadge ajoute title.premier_spawt à la collection", async () => {
    useSpawterStore.setState({ pendingBadge: { place_id: "place-x" } });
    await useSpawterStore.getState().consumePendingBadge();
    await new Promise((r) => setImmediate(r));
    const list = useSpawterStore.getState().collectionTitres;
    expect(list.some((r) => r.title_key === "title.premier_spawt" && r.source === "badge")).toBe(true);
  });
});

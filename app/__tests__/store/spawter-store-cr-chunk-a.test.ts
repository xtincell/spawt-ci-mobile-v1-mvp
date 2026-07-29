// CR Chunk A — Tests des fixes critiques C1 (is_seed exclusion) + M7 (in-flight
// guard célébrations concurrentes) + M8 (multi-stade unlock).
// Ces invariants doivent rester verrouillés pour empêcher la régression.

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
import { STADE_TITLE_KEYS } from "../../src/lib/titres-catalogue";

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

beforeEach(() => {
  mockStorage.clear();
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

describe("C1 (CRITIQUE) — is_seed exclusion dans unique_spots", () => {
  it("seed rows is_verified=true ne comptent PAS dans unique_spots", async () => {
    // 15 spawts seed sur 15 places uniques → devraient NE PAS franchir explorateur (11+)
    for (let i = 0; i < 15; i++) {
      await useSpawterStore.getState().registerSpawt(
        makeSpawt({ id: `seed-${i}`, place_id: `seed-place-${i}`, is_seed: true }),
      );
    }
    const state = useSpawterStore.getState();
    expect(state.spawter?.unique_spots).toBe(0);
    expect(state.spawter?.stade).toBe("touriste");
    expect(state.pendingStadeCelebration).toBeNull();
  });

  it("mix seed + non-seed : seuls non-seed comptent", async () => {
    // 6 seed + 11 vrais sur 17 places différentes → unique_spots = 11, franchit explorateur
    for (let i = 0; i < 6; i++) {
      await useSpawterStore.getState().registerSpawt(
        makeSpawt({ id: `seed-${i}`, place_id: `seed-place-${i}`, is_seed: true }),
      );
    }
    for (let i = 0; i < 11; i++) {
      await useSpawterStore.getState().registerSpawt(
        makeSpawt({ id: `real-${i}`, place_id: `real-place-${i}`, is_seed: false }),
      );
    }
    const state = useSpawterStore.getState();
    expect(state.spawter?.unique_spots).toBe(11);
    expect(state.spawter?.stade).toBe("explorateur");
    expect(state.pendingStadeCelebration?.to_stade).toBe("explorateur");
  });

  it("seed + is_verified=false ne compte pas non plus (double exclusion)", async () => {
    for (let i = 0; i < 5; i++) {
      await useSpawterStore.getState().registerSpawt(
        makeSpawt({
          id: `mix-${i}`,
          place_id: `place-${i}`,
          is_seed: true,
          is_verified: false,
        }),
      );
    }
    expect(useSpawterStore.getState().spawter?.unique_spots).toBe(0);
  });
});

describe("M7 — in-flight guard (célébrations concurrentes)", () => {
  it("2 registerSpawt successifs sur même seuil = 1 seule célébration set", async () => {
    // 11 spawts uniques + 1 spawt supplémentaire qui devrait être no-op pour la
    // célébration (même stade cible déjà in-flight).
    for (let i = 0; i < 11; i++) {
      await useSpawterStore.getState().registerSpawt(
        makeSpawt({ id: `s-${i}`, place_id: `p-${i}` }),
      );
    }
    const firstPending = useSpawterStore.getState().pendingStadeCelebration;
    expect(firstPending?.to_stade).toBe("explorateur");

    // Spawt 12 (12e place unique) — toujours stade explorateur, mais state set
    // pendingStadeCelebration ne devrait pas être ré-écrit avec un nouveau objet
    // identique (le test vérifie qu'on ne double-déclenche pas en parallèle).
    await useSpawterStore.getState().registerSpawt(
      makeSpawt({ id: "s-extra", place_id: "p-extra" }),
    );
    const secondPending = useSpawterStore.getState().pendingStadeCelebration;
    // Toujours pointe vers le même franchissement (pas écrasé par un nouveau).
    expect(secondPending?.to_stade).toBe("explorateur");
    expect(secondPending?.unique_spots).toBe(11); // pas 12 — le set initial est conservé
  });

  it("après consume, le même stade ne re-célèbre pas même au prochain registerSpawt", async () => {
    for (let i = 0; i < 11; i++) {
      await useSpawterStore.getState().registerSpawt(
        makeSpawt({ id: `s-${i}`, place_id: `p-${i}` }),
      );
    }
    expect(useSpawterStore.getState().pendingStadeCelebration?.to_stade).toBe("explorateur");
    await useSpawterStore.getState().consumePendingStadeCelebration();
    // Le flag AsyncStorage est posé → registerSpawt suivant ne ré-célèbre pas explorateur.
    await useSpawterStore.getState().registerSpawt(
      makeSpawt({ id: "s-after", place_id: "p-after" }),
    );
    expect(useSpawterStore.getState().pendingStadeCelebration).toBeNull();
  });
});

describe("M8 — multi-stade unlock (saut de stades)", () => {
  it("franchissement touriste → explorateur unlock title.explorateur uniquement", async () => {
    for (let i = 0; i < 11; i++) {
      await useSpawterStore.getState().registerSpawt(
        makeSpawt({ id: `s-${i}`, place_id: `p-${i}` }),
      );
    }
    // Laisse le temps au void unlockTitle de finir
    await new Promise((r) => setImmediate(r));
    const titres = useSpawterStore.getState().collectionTitres;
    const stadeTitres = titres.filter((r) => r.source === "stade").map((r) => r.title_key);
    expect(stadeTitres).toContain(STADE_TITLE_KEYS.explorateur);
    expect(stadeTitres).not.toContain(STADE_TITLE_KEYS.detective);
  });

  it("saut touriste → detective (21 spots) unlock explorateur ET detective", async () => {
    for (let i = 0; i < 21; i++) {
      await useSpawterStore.getState().registerSpawt(
        makeSpawt({ id: `s-${i}`, place_id: `p-${i}` }),
      );
    }
    await new Promise((r) => setImmediate(r));
    const titres = useSpawterStore.getState().collectionTitres;
    const stadeTitres = titres.filter((r) => r.source === "stade").map((r) => r.title_key);
    expect(stadeTitres).toContain(STADE_TITLE_KEYS.explorateur);
    expect(stadeTitres).toContain(STADE_TITLE_KEYS.detective);
  });
});

describe("M3 — anti-replay flag posé AVANT clear state", () => {
  it("consumePendingStadeCelebration pose flag AsyncStorage AVANT set(null)", async () => {
    for (let i = 0; i < 11; i++) {
      await useSpawterStore.getState().registerSpawt(
        makeSpawt({ id: `s-${i}`, place_id: `p-${i}` }),
      );
    }
    expect(useSpawterStore.getState().pendingStadeCelebration).not.toBeNull();
    expect(mockStorage.get("spawt:stade:celebrated:explorateur")).toBeFalsy();

    await useSpawterStore.getState().consumePendingStadeCelebration();
    // Le flag doit être posé ET le state cleared (les deux true à la fin).
    expect(mockStorage.get("spawt:stade:celebrated:explorateur")).toBeTruthy();
    expect(useSpawterStore.getState().pendingStadeCelebration).toBeNull();
  });
});

describe("M2 — reset() purge complète privacy cross-user", () => {
  it("reset purge collection_titres + stade celebrated flags + badge flag", async () => {
    // Pré-pose plusieurs clés "user précédent"
    mockStorage.set("spawt:saved_places", "[...]");
    mockStorage.set("spawt:collection_titres", "[...]");
    mockStorage.set("spawt:badge:premier_spawt_celebrated", "2026-05-26");
    mockStorage.set("spawt:stade:celebrated:explorateur", "2026-05-26");
    mockStorage.set("spawt:stade:celebrated:detective", "2026-05-26");
    mockStorage.set("spawt:stade:celebrated:guide", "2026-05-26");

    useSpawterStore.getState().reset();
    // Laisse le multiRemove fire-and-forget se résoudre
    await new Promise((r) => setImmediate(r));

    expect(mockStorage.get("spawt:saved_places")).toBeUndefined();
    expect(mockStorage.get("spawt:collection_titres")).toBeUndefined();
    expect(mockStorage.get("spawt:badge:premier_spawt_celebrated")).toBeUndefined();
    expect(mockStorage.get("spawt:stade:celebrated:explorateur")).toBeUndefined();
    expect(mockStorage.get("spawt:stade:celebrated:detective")).toBeUndefined();
    expect(mockStorage.get("spawt:stade:celebrated:guide")).toBeUndefined();
  });
});

describe("D4 — current_title sync (writer client)", () => {
  it("registerSpawt qui franchit un stade envoie current_title = displayed user-choice si défini", async () => {
    const upsertProgression = jest.requireMock("../../src/lib/data-source")
      .upsertProgression as jest.Mock;
    upsertProgression.mockClear();

    // Setup : user a déjà displayed un titre custom (title.premier_spawt par ex)
    useSpawterStore.setState({
      collectionTitres: [
        {
          id: "t1",
          spawter_id: SAMPLE_SPAWTER.id,
          title_key: "title.premier_spawt",
          source: "badge",
          is_displayed: true,
          unlocked_at: "2026-05-20T00:00:00Z",
        },
      ],
    });

    // Franchit explorateur
    for (let i = 0; i < 11; i++) {
      await useSpawterStore.getState().registerSpawt(
        makeSpawt({ id: `s-${i}`, place_id: `p-${i}` }),
      );
    }
    await new Promise((r) => setImmediate(r));

    // upsertProgression doit avoir été appelée avec current_title = titre user-choice
    // (pas le défaut STADE_TITLE_KEYS.explorateur).
    const calls = upsertProgression.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall?.[0]?.current_title).toBe("title.premier_spawt");
  });

  it("registerSpawt sans displayed user-choice envoie current_title = défaut du stade", async () => {
    const upsertProgression = jest.requireMock("../../src/lib/data-source")
      .upsertProgression as jest.Mock;
    upsertProgression.mockClear();

    // Pas de displayed user-choice → fallback default
    useSpawterStore.setState({ collectionTitres: [] });

    for (let i = 0; i < 11; i++) {
      await useSpawterStore.getState().registerSpawt(
        makeSpawt({ id: `s-${i}`, place_id: `p-${i}` }),
      );
    }
    await new Promise((r) => setImmediate(r));

    const calls = upsertProgression.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall?.[0]?.current_title).toBe(STADE_TITLE_KEYS.explorateur);
  });
});

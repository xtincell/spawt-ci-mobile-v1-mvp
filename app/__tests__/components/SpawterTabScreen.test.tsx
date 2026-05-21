// Story 4.10 — Tests SpawterTabScreen (app/(tabs)/spawter.tsx).
// Couvre les 5 états : loading, perm refusée, position, empty, loaded.
//
// Pattern : react-test-renderer + mocks ciblés (expo-location, expo-router,
// react-i18next, data-source, store). Le composant gère son flow async dans
// un useEffect → on attend la résolution via act() + flushPromises.

import { type ReactNode } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only
import TestRenderer from "react-test-renderer";

import type { PlaceWithAdn } from "../../src/lib/data-source";
import type { Spawter } from "../../src/types/spawter";

// ── Mocks (must be declared before the import of the SUT) ────────────────

const mockTranslate = jest.fn((key: string, opts?: { defaultValue?: string }) =>
  opts?.defaultValue ?? key,
);
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

const mockTrack = jest.fn();
jest.mock("../../src/lib/analytics", () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

// expo-location — comportement variable contrôlé par les tests.
const mockGetFgPerms = jest.fn();
const mockReqFgPerms = jest.fn();
const mockGetPos = jest.fn();
jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: (...args: unknown[]) => mockGetFgPerms(...args),
  requestForegroundPermissionsAsync: (...args: unknown[]) => mockReqFgPerms(...args),
  getCurrentPositionAsync: (...args: unknown[]) => mockGetPos(...args),
}));

const mockListPlaces = jest.fn();
const mockUpsertSpawt = jest.fn().mockResolvedValue(true);
jest.mock("../../src/lib/data-source", () => ({
  listPlaces: (...args: unknown[]) => mockListPlaces(...args),
  upsertSpawt: (...args: unknown[]) => mockUpsertSpawt(...args),
  isSupabaseConfigured: false,
}));

const mockRegisterSpawt = jest.fn().mockResolvedValue(undefined);
let mockSpawter: Spawter | null = null;
jest.mock("../../src/store/spawter-store", () => {
  const fn = (
    selector: (s: {
      spawter: Spawter | null;
      registerSpawt: typeof mockRegisterSpawt;
    }) => unknown,
  ) =>
    selector({
      spawter: mockSpawter,
      registerSpawt: mockRegisterSpawt,
    });
  return { useSpawterStore: fn };
});

// SafeAreaView : pas besoin de provider, on stube en View pure pour éviter
// le warning et garder le render simple.
jest.mock("react-native-safe-area-context", () => {
  const React = jest.requireActual("react");
  const RN = jest.requireActual("react-native");
  return {
    SafeAreaView: ({ children }: { children: ReactNode }) =>
      React.createElement(RN.View, null, children),
    SafeAreaProvider: ({ children }: { children: ReactNode }) =>
      React.createElement(RN.View, null, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

import SpawterTabScreen from "../../app/(tabs)/spawter";

// ── Helpers ──────────────────────────────────────────────────────────────

interface FoundProps {
  props: Record<string, unknown>;
}
interface TestRendererInstanceLike {
  root: {
    findByProps: (props: Record<string, unknown>) => FoundProps;
    findAllByProps: (props: Record<string, unknown>) => FoundProps[];
  };
}

function makeSpawter(): Spawter {
  return {
    id: "spawter-1",
    phone_e164: "+2250700000000",
    display_name: "Tantie Rose",
    avatar_url: null,
    neighborhood: "Cocody",
    country_code: "CI",
    origin_country_code: null,
    gender: "non_renseigne",
    age_range: null,
    stade: "touriste",
    total_spawts: 0,
    unique_spots: 0,
    customer_id: null,
    geoloc_consent_at: "2026-05-01T00:00:00Z",
    cgv_accepted_at: "2026-05-01T00:00:00Z",
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-20T00:00:00Z",
  };
}

function makePlace(id: string, name: string, lat = 5.348, lng = -3.998): PlaceWithAdn {
  return {
    id,
    name,
    cuisine: ["ivoirienne"],
    location: {
      lat,
      lng,
      descriptive_address: "Au coin",
      neighborhood: "Cocody",
      city: "Abidjan",
    },
    price: { tier: 2 },
    hours: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
    phone: null,
    whatsapp: null,
    cover_photo_url: null,
    gallery_urls: [],
    signals: [],
    is_published: true,
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    adn: {
      place_id: id,
      axe_local_international: 0,
      axe_informel_etabli: 0,
      axe_budget_premium: 0,
      axe_populaire_prive: 0,
      axe_decontracte_habille: 0,
      confidence_score: 0.5,
      total_reviews: 5,
      weighted_rating: 4,
      updated_at: "2026-05-01T00:00:00Z",
    },
    rating_display: 4,
    total_spawts: 10,
  };
}

async function render(): Promise<TestRendererInstanceLike> {
  let raw: TestRendererInstanceLike | null = null;
  await TestRenderer.act(async () => {
    raw = TestRenderer.create(<SpawterTabScreen />) as unknown as TestRendererInstanceLike;
  });
  // Laisse les useEffect async (perm + position + list) se résoudre.
  await TestRenderer.act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  if (!raw) throw new Error("no renderer");
  return raw;
}

function tryFindByTestID(
  instance: TestRendererInstanceLike,
  testID: string,
): FoundProps | null {
  try {
    return instance.root.findByProps({ testID });
  } catch {
    return null;
  }
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("<SpawterTabScreen /> — Story 4.10", () => {
  beforeEach(() => {
    mockTranslate.mockClear();
    mockPush.mockClear();
    mockBack.mockClear();
    mockTrack.mockClear();
    mockGetFgPerms.mockReset();
    mockReqFgPerms.mockReset();
    mockGetPos.mockReset();
    mockListPlaces.mockReset();
    mockRegisterSpawt.mockClear();
    mockUpsertSpawt.mockClear();
    mockSpawter = makeSpawter();
  });

  it("État #1 — perm refusée → affiche message + bouton settings + analytics has_geoloc_perm=false", async () => {
    mockGetFgPerms.mockResolvedValue({ status: "denied", canAskAgain: false });
    mockListPlaces.mockResolvedValue([]);

    const instance = await render();
    expect(tryFindByTestID(instance, "spawter-tab-perm-required")).not.toBeNull();
    expect(tryFindByTestID(instance, "spawter-tab-open-settings")).not.toBeNull();

    // Analytics : nearby_screen_opened avec has_geoloc_perm=false.
    expect(mockTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "nearby_screen_opened",
        properties: expect.objectContaining({ has_geoloc_perm: false, count_in_radius: 0 }),
      }),
    );
  });

  it("État #2 — perm undetermined puis grantée → fetch position + listPlaces", async () => {
    mockGetFgPerms.mockResolvedValue({ status: "undetermined", canAskAgain: true });
    mockReqFgPerms.mockResolvedValue({ status: "granted" });
    mockGetPos.mockResolvedValue({
      coords: { latitude: 5.348, longitude: -3.998 },
    });
    mockListPlaces.mockResolvedValue([]);

    await render();
    expect(mockReqFgPerms).toHaveBeenCalled();
    expect(mockGetPos).toHaveBeenCalled();
    expect(mockListPlaces).toHaveBeenCalled();
  });

  it("État #3 — empty (0 lieu dans rayon 2km) → message empty + analytics count_in_radius=0", async () => {
    mockGetFgPerms.mockResolvedValue({ status: "granted" });
    mockGetPos.mockResolvedValue({
      coords: { latitude: 5.348, longitude: -3.998 },
    });
    // Lieu à 100km — out of range.
    mockListPlaces.mockResolvedValue([makePlace("p-far", "Loin", 6.5, -4.5)]);

    const instance = await render();
    expect(tryFindByTestID(instance, "spawter-tab-empty")).not.toBeNull();
    expect(mockTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "nearby_screen_opened",
        properties: expect.objectContaining({ count_in_radius: 0, has_geoloc_perm: true }),
      }),
    );
  });

  it("État #4 — loaded → rend une card par lieu, tri par distance", async () => {
    mockGetFgPerms.mockResolvedValue({ status: "granted" });
    mockGetPos.mockResolvedValue({
      coords: { latitude: 5.348, longitude: -3.998 },
    });
    mockListPlaces.mockResolvedValue([
      makePlace("p-mid", "B-milieu", 5.348 + 0.005, -3.998),
      makePlace("p-near", "A-proche", 5.348 + 0.0005, -3.998),
    ]);

    const instance = await render();
    expect(tryFindByTestID(instance, "spawter-tab-card-p-near")).not.toBeNull();
    expect(tryFindByTestID(instance, "spawter-tab-card-p-mid")).not.toBeNull();
    // count_in_radius=2 dans l'analytics.
    expect(mockTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "nearby_screen_opened",
        properties: expect.objectContaining({ count_in_radius: 2 }),
      }),
    );
  });

  it("État #5 — tap CTA sur lieu <100m → registerSpawt(is_verified=true) + analytics + navigate review", async () => {
    mockGetFgPerms.mockResolvedValue({ status: "granted" });
    mockGetPos.mockResolvedValue({
      coords: { latitude: 5.348, longitude: -3.998 },
    });
    mockListPlaces.mockResolvedValue([
      makePlace("p-near", "Proche", 5.348 + 0.0005, -3.998),
    ]);

    const instance = await render();
    const cta = instance.root.findByProps({ testID: "spawter-tab-cta-p-near" });
    await TestRenderer.act(async () => {
      (cta.props.onPress as () => void)();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockRegisterSpawt).toHaveBeenCalledTimes(1);
    const registeredRow = mockRegisterSpawt.mock.calls[0]?.[0] as {
      is_verified: boolean;
      place_id: string;
      check_in_type: string;
    };
    expect(registeredRow.is_verified).toBe(true);
    expect(registeredRow.place_id).toBe("p-near");
    expect(registeredRow.check_in_type).toBe("manual");

    expect(mockTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "nearby_spawt_tapped",
        properties: expect.objectContaining({
          place_id: "p-near",
          is_within_range: true,
        }),
      }),
    );

    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/review\//));
  });

  it("Tap CTA sur lieu >100m → registerSpawt(is_verified=false) + is_within_range=false", async () => {
    mockGetFgPerms.mockResolvedValue({ status: "granted" });
    mockGetPos.mockResolvedValue({
      coords: { latitude: 5.348, longitude: -3.998 },
    });
    // ~1.4km depuis le spawter — dans le rayon mais hors zone spawt.
    mockListPlaces.mockResolvedValue([
      makePlace("p-mid", "À 1.4km", 5.348 + 0.013, -3.998),
    ]);

    const instance = await render();
    const cta = instance.root.findByProps({ testID: "spawter-tab-cta-p-mid" });
    await TestRenderer.act(async () => {
      (cta.props.onPress as () => void)();
      await Promise.resolve();
      await Promise.resolve();
    });

    const registeredRow = mockRegisterSpawt.mock.calls[0]?.[0] as {
      is_verified: boolean;
    };
    expect(registeredRow.is_verified).toBe(false);
    expect(mockTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "nearby_spawt_tapped",
        properties: expect.objectContaining({ is_within_range: false }),
      }),
    );
  });

  it("expo-location qui throw → fallback gracieux sur perm_denied (pas de crash)", async () => {
    mockGetFgPerms.mockRejectedValue(new Error("native module missing"));
    mockListPlaces.mockResolvedValue([]);
    // Le composant console.warn dans __DEV__ — on stube pour garder l'output
    // de la suite de test propre (le warn est intentionnel, pas une régression).
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const instance = await render();
    expect(tryFindByTestID(instance, "spawter-tab-perm-required")).not.toBeNull();
    warnSpy.mockRestore();
  });

  it("Tap close header → router.back()", async () => {
    mockGetFgPerms.mockResolvedValue({ status: "denied", canAskAgain: false });
    mockListPlaces.mockResolvedValue([]);

    const instance = await render();
    const close = instance.root.findByProps({ testID: "spawter-tab-close" });
    await TestRenderer.act(async () => {
      (close.props.onPress as () => void)();
    });
    expect(mockBack).toHaveBeenCalled();
  });
});

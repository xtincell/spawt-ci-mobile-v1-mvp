// R22 (build 8) — régression : TOUTES les fiches lieu crashaient à l'ouverture.
// Cause racine : `useFlag("place-avg-price")` (ajouté build 7, Q4) était appelé
// APRÈS les early returns loading/not-found → premier render (loading) sans le
// hook, second render (place chargée) avec → violation rules-of-hooks
// (« Rendered more hooks than during the previous render ») → crash React.
//
// Ce test rend l'écran à travers la transition loading → loaded (le chemin qui
// déclenchait le crash) avec une place SANS DONNÉES (inventaire quasi vide) et
// vérifie qu'il ne throw pas et rend un contenu.

import { type ReactNode } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only
import TestRenderer from "react-test-renderer";

import type { PlaceWithAdn } from "../../src/lib/data-source";

jest.mock("react-native-safe-area-context", () => {
  const ReactMock = jest.requireActual("react") as typeof import("react");
  const RNMock = jest.requireActual("react-native") as typeof import("react-native");
  return {
    SafeAreaView: ({ children }: { children: ReactNode }) =>
      ReactMock.createElement(RNMock.View, null, children),
    SafeAreaProvider: ({ children }: { children: ReactNode }) =>
      ReactMock.createElement(RNMock.View, null, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const mockTranslate = jest.fn((key: string) => key);
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: "11111111-1111-4111-8111-111111111111" }),
}));

jest.mock("../../src/lib/analytics", () => ({
  track: jest.fn(),
}));

jest.mock("../../src/lib/use-spawter-position", () => ({
  useSpawterPosition: () => ({ lat: 5.35, lng: -4.0, source: "fallback" }),
}));

// getPlace résout APRÈS le premier render → on traverse la transition
// loading → loaded, exactement le chemin du crash R22.
let mockPlace: PlaceWithAdn | null = null;
jest.mock("../../src/lib/data-source", () => ({
  isSupabaseConfigured: false,
  dataSourceMode: "fallback",
  getPlace: jest.fn(() => Promise.resolve(mockPlace)),
  listPlacePhotosFromSpawts: jest.fn(() => Promise.resolve([] as string[])),
  listReviewsForPlace: jest.fn(() => Promise.resolve([])),
  countReviewsForPlace: jest.fn(() => Promise.resolve(0)),
  giveCoupDeCoeur: jest.fn(() => Promise.resolve(null)),
  countCoupsDeCoeurThisMonth: jest.fn(() => Promise.resolve(0)),
  // Événements & promos (0049/0050) — le useFlag mocké ci-dessous renvoie
  // true, la section « En ce moment » fetch donc : vide = fiche inchangée.
  listPlaceEvents: jest.fn(() => Promise.resolve([])),
  listPlacePromotions: jest.fn(() => Promise.resolve([])),
}));

// Store spawter minimal — pas de spawter (pré-onboarding OK sur une fiche
// deep-linkée), aucun spawt, aucun favori.
const mockStoreState = {
  spawter: null,
  palais: null,
  spawts: [] as unknown[],
  savedPlaceIds: new Set<string>(),
  registerSpawt: jest.fn(),
  toggleSaved: jest.fn(() => Promise.resolve(true)),
};
jest.mock("../../src/store/spawter-store", () => ({
  useSpawterStore: (selector: (s: typeof mockStoreState) => unknown) =>
    selector(mockStoreState),
}));

// IMPORTANT — `useFlag` reste un VRAI hook (useState) : si l'écran le rappelle
// conditionnellement (le bug R22), React throw « Rendered more hooks… » et ce
// test échoue. Ne pas le remplacer par une fonction plate.
jest.mock("../../src/store/feature-flags", () => {
  const ReactMock = jest.requireActual("react") as typeof import("react");
  return {
    useFlag: (_code: string) => {
      const [v] = ReactMock.useState(true);
      return v;
    },
    useFeatureFlagsStore: { getState: () => ({ hydrate: jest.fn() }) },
  };
});

// guet importe AsyncStorage + expo-location (bridges natifs absents en Jest).
jest.mock("../../src/lib/guet", () => ({
  buildManualSpawt: jest.fn(() => ({ id: "spawt-1" })),
}));

import PlaceDetailScreen from "../../app/place/[id]/index";

/** Place « inventaire vide » : aucune photo, aucun menu, aucun avis, ADN neutre. */
function emptyDataPlace(): PlaceWithAdn {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Chez Test",
    cuisine: [],
    location: {
      lat: 5.36,
      lng: -3.99,
      descriptive_address: "",
      neighborhood: "",
      city: "Abidjan",
    },
    price: { tier: 1, avg_ticket_xof: null },
    hours: {},
    phone: null,
    whatsapp: null,
    cover_photo_url: null,
    gallery_urls: [],
    menu_urls: [],
    signals: [],
    is_published: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    adn: {
      place_id: "11111111-1111-4111-8111-111111111111",
      axe_local_international: 0,
      axe_informel_etabli: 0,
      axe_budget_premium: 0,
      axe_populaire_prive: 0,
      axe_decontracte_habille: 0,
      confidence_score: 0,
      total_reviews: 0,
      weighted_rating: 0,
      updated_at: "2026-01-01T00:00:00Z",
    },
    rating_display: 0,
    total_spawts: 0,
  } as unknown as PlaceWithAdn;
}

async function flushMicrotasks(): Promise<void> {
  await TestRenderer.act(async () => {
    await Promise.resolve();
  });
}

describe("PlaceDetailScreen — R22 (fiche lieu sans données ne crash pas)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rend la fiche à travers loading → loaded sans throw (place vide)", async () => {
    mockPlace = emptyDataPlace();
    let renderer!: ReturnType<typeof TestRenderer.create>;
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(<PlaceDetailScreen />);
    });
    await flushMicrotasks();

    // Le nom du lieu est rendu → la fiche est montée post-fetch, pas crashée.
    const texts = renderer.root
      .findAllByType(
        (jest.requireActual("react-native") as typeof import("react-native")).Text,
      )
      .map((n: { props: { children: unknown } }) => n.props.children);
    expect(JSON.stringify(texts)).toContain("Chez Test");
    // Zéro avis → chip « pas encore noté » (état vide élégant, pas de crash).
    expect(JSON.stringify(texts)).not.toContain("NaN");

    TestRenderer.act(() => renderer.unmount());
  });

  it("rend l'état « introuvable » si getPlace résout null", async () => {
    mockPlace = null;
    let renderer!: ReturnType<typeof TestRenderer.create>;
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(<PlaceDetailScreen />);
    });
    await flushMicrotasks();

    const texts = renderer.root
      .findAllByType(
        (jest.requireActual("react-native") as typeof import("react-native")).Text,
      )
      .map((n: { props: { children: unknown } }) => n.props.children);
    expect(JSON.stringify(texts)).toContain("place.not_found");

    TestRenderer.act(() => renderer.unmount());
  });
});

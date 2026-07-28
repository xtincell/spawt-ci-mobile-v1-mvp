// Tests Mode Rapide — écran app/rapide.tsx.
// Couvre : flag `mode-rapide` OFF → Redirect vers le feed (deep link gate),
// flag ON → deck construit + rapide_opened, like via bouton ♥ → toggleSaved +
// applySwipeSignal("like") + track rapide_swipe_like, pass via ✕ → PAS de
// toggleSaved + applySwipeSignal("pass") + track rapide_swipe_pass, fin de
// deck → rapide_deck_ended + CTA → replace vers le feed.

import { type ReactNode } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only.
import TestRenderer from "react-test-renderer";

import type { PlaceWithAdn } from "../../src/lib/data-source";

jest.mock("react-native-safe-area-context", () => {
  const ReactMock = jest.requireActual("react") as typeof import("react");
  const RNMock = jest.requireActual("react-native") as typeof import("react-native");
  return {
    SafeAreaView: ({ children }: { children: ReactNode }) =>
      ReactMock.createElement(RNMock.View, null, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock("react-native-reanimated", () => {
  const View = require("react-native").View;
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: number) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    interpolate: () => 0,
    Extrapolation: { CLAMP: "clamp" },
    runOnJS: (fn: unknown) => fn,
    View,
  };
});

jest.mock("react-native-gesture-handler", () => {
  const ReactMock = jest.requireActual("react") as typeof import("react");
  const makeChainable = () => {
    const gesture: Record<string, unknown> = {};
    for (const method of ["activeOffsetX", "failOffsetY", "onUpdate", "onEnd"]) {
      gesture[method] = () => gesture;
    }
    return gesture;
  };
  return {
    __esModule: true,
    GestureDetector: ({ children }: { children: ReactNode }) =>
      ReactMock.createElement(ReactMock.Fragment, null, children),
    Gesture: { Pan: makeChainable },
  };
});

const mockTranslate = jest.fn((key: string, opts?: Record<string, unknown>) =>
  opts && typeof opts.name === "string" ? `${key}:${opts.name}` : key,
);
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock("expo-router", () => {
  const ReactMock = jest.requireActual("react") as typeof import("react");
  const RNMock = jest.requireActual("react-native") as typeof import("react-native");
  return {
    useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
    Redirect: ({ href }: { href: string }) =>
      ReactMock.createElement(RNMock.Text, { testID: "redirect" }, href),
  };
});

// Flags contrôlés par test (mode-rapide / paywall-geo).
let mockFlags: Record<string, boolean> = {};
jest.mock("../../src/store/feature-flags", () => ({
  useFlag: (code: string) => mockFlags[code] ?? false,
}));

jest.mock("../../src/lib/analytics", () => ({
  track: jest.fn(),
}));

jest.mock("../../src/lib/use-spawter-position", () => ({
  useSpawterPosition: () => ({ lat: 5.358, lng: -3.97, source: "fallback" }),
}));

jest.mock("../../src/lib/spawter-gold", () => ({
  isGoldSpawter: () => false,
}));

let mockPlaces: PlaceWithAdn[] = [];
jest.mock("../../src/lib/data-source", () => ({
  isSupabaseConfigured: false,
  dataSourceMode: "fallback",
  listPlaces: jest.fn(() => Promise.resolve(mockPlaces)),
}));

// Store spawter mocké : sélecteur + getState (le screen snapshotte le store
// au moment du build du deck).
const mockToggleSaved = jest.fn(() => Promise.resolve(true));
const mockApplySwipeSignal = jest.fn(
  (_adn: unknown, _direction: "like" | "pass") => Promise.resolve(),
);
const mockStoreState = {
  spawter: {
    id: "spawter-1",
    stade: "touriste",
    total_spawts: 0,
    unique_spots: 0,
  },
  palais: null,
  spawts: [] as Array<{ place_id: string; is_verified: boolean }>,
  savedPlaceIds: new Set<string>(),
  toggleSaved: mockToggleSaved,
  isSaved: (id: string) => mockStoreState.savedPlaceIds.has(id),
  applySwipeSignal: mockApplySwipeSignal,
};
// NB : le factory ne DÉRÉFÉRENCE mockStoreState que dans les corps de
// fonctions (lazy) — jamais au chargement du module (TDZ, hoisting jest.mock).
jest.mock("../../src/store/spawter-store", () => ({
  useSpawterStore: Object.assign(
    (selector: (s: typeof mockStoreState) => unknown) => selector(mockStoreState),
    { getState: () => mockStoreState },
  ),
}));

import RapideScreen from "../../app/rapide";
import { ThemeProvider } from "../../src/theme/ThemeProvider";
import { track } from "../../src/lib/analytics";

const NOW_ISO = "2026-07-26T12:00:00Z";

function makePlace(id: string, name: string): PlaceWithAdn {
  return {
    id,
    name,
    cuisine: ["ivoirienne"],
    location: {
      lat: 5.358,
      lng: -3.97,
      descriptive_address: "Test",
      neighborhood: "Cocody",
      city: "Abidjan",
    },
    price: { tier: 2 },
    hours: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
    phone: null,
    whatsapp: null,
    cover_photo_url: null,
    gallery_urls: [],
    menu_urls: [],
    signals: [],
    is_published: true,
    created_at: NOW_ISO,
    updated_at: NOW_ISO,
    adn: {
      place_id: id,
      axe_local_international: -0.6,
      axe_informel_etabli: 0,
      axe_budget_premium: 0,
      axe_populaire_prive: 0,
      axe_decontracte_habille: 0,
      confidence_score: 0.8,
      total_reviews: 12,
      sample_size: 12,
      adn_revealed: true,
      weighted_rating: 4.2,
      updated_at: NOW_ISO,
    },
    rating_display: 4.2,
    total_spawts: 12,
  } as unknown as PlaceWithAdn;
}

interface NodeLike {
  type: unknown;
  props: Record<string, unknown>;
}

/** Éléments HOST only — findAll matche aussi les composites (doublons). */
function isHost(n: NodeLike): boolean {
  return typeof n.type === "string";
}
interface RendererLike {
  root: { findAll: (predicate: (n: NodeLike) => boolean) => NodeLike[] };
  toJSON: () => unknown;
}

async function renderScreen(): Promise<RendererLike> {
  let r: RendererLike | null = null;
  await TestRenderer.act(async () => {
    r = TestRenderer.create(
      <ThemeProvider>
        <RapideScreen />
      </ThemeProvider>,
    ) as unknown as RendererLike;
    // Laisse listPlaces résoudre + setDeck s'appliquer.
    await Promise.resolve();
  });
  if (!r) throw new Error("renderer did not init");
  return r;
}

function pressByLabel(r: RendererLike, label: string): void {
  const nodes = r.root.findAll(
    (n) => n.props.accessibilityLabel === label && typeof n.props.onPress === "function",
  );
  expect(nodes.length).toBeGreaterThan(0);
  TestRenderer.act(() => {
    (nodes[0]!.props.onPress as () => void)();
  });
}

const trackMock = track as jest.Mock;

describe("RapideScreen — gate du flag mode-rapide", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFlags = {};
    mockPlaces = [];
    mockStoreState.savedPlaceIds = new Set();
  });

  it("flag OFF → Redirect vers le feed, aucun event émis", async () => {
    mockFlags = { "mode-rapide": false };
    const r = await renderScreen();
    const redirects = r.root.findAll(
      (n) => isHost(n) && n.props.testID === "redirect",
    );
    expect(redirects).toHaveLength(1);
    expect(trackMock).not.toHaveBeenCalled();
  });

  it("flag ON → deck construit + rapide_opened(deck_size)", async () => {
    mockFlags = { "mode-rapide": true };
    mockPlaces = [makePlace("p1", "Chez Fixture Un"), makePlace("p2", "Chez Fixture Deux")];
    const r = await renderScreen();
    expect(JSON.stringify(r.toJSON())).toContain("Chez Fixture Un");
    expect(trackMock).toHaveBeenCalledWith({
      name: "rapide_opened",
      properties: { deck_size: 2 },
    });
  });
});

describe("RapideScreen — décisions de swipe", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFlags = { "mode-rapide": true };
    mockPlaces = [makePlace("p1", "Chez Fixture Un"), makePlace("p2", "Chez Fixture Deux")];
    mockStoreState.savedPlaceIds = new Set();
  });

  it("like (♥) → toggleSaved + applySwipeSignal like + rapide_swipe_like", async () => {
    const r = await renderScreen();
    pressByLabel(r, "rapide.keep_aria");
    expect(mockToggleSaved).toHaveBeenCalledTimes(1);
    expect(mockApplySwipeSignal).toHaveBeenCalledTimes(1);
    expect(mockApplySwipeSignal.mock.calls[0]![1]).toBe("like");
    expect(trackMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "rapide_swipe_like",
        properties: expect.objectContaining({ deck_position: 0 }),
      }),
    );
  });

  it("like sur un lieu DÉJÀ favori → pas de un-save accidentel (idempotence)", async () => {
    const r = await renderScreen();
    // Devient favori entre le build du deck et le swipe (course réaliste :
    // save depuis la fiche ouverte par tap sur la carte, puis retour au deck).
    mockStoreState.savedPlaceIds = new Set(["p1", "p2"]);
    pressByLabel(r, "rapide.keep_aria");
    expect(mockToggleSaved).not.toHaveBeenCalled();
    expect(mockApplySwipeSignal).toHaveBeenCalledTimes(1);
  });

  it("pass (✕) → PAS de toggleSaved + applySwipeSignal pass + rapide_swipe_pass", async () => {
    const r = await renderScreen();
    pressByLabel(r, "rapide.pass_aria");
    expect(mockToggleSaved).not.toHaveBeenCalled();
    expect(mockApplySwipeSignal.mock.calls[0]![1]).toBe("pass");
    expect(trackMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "rapide_swipe_pass" }),
    );
  });

  it("deck épuisé → rapide_deck_ended + CTA retourne au feed (replace)", async () => {
    const r = await renderScreen();
    pressByLabel(r, "rapide.keep_aria");
    pressByLabel(r, "rapide.pass_aria");
    expect(trackMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "rapide_deck_ended" }),
    );
    pressByLabel(r, "rapide.deck_end_cta");
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
  });

  it("tap sur la carte → push fiche lieu avec ref=rapide", async () => {
    const r = await renderScreen();
    pressByLabel(r, "rapide.card_open_aria:Chez Fixture Un");
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/place/[id]",
      params: { id: "p1", ref: "rapide" },
    });
  });
});

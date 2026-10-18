// Tests Mode Explore — écran détail d'un carnet (app/explore/[slug].tsx).
// Couvre : flag OFF → Redirect feed (deep link direct), rendu des items dans
// l'ordre ÉDITORIAL (mot du Chat + carte lieu), tap item → fiche lieu avec
// ref=explore + explore_item_clicked, slug introuvable → état « rangé ».

import { type ReactNode } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only.
import TestRenderer from "react-test-renderer";

import type {
  ExploreCollectionDetail,
  PlaceWithAdn,
} from "../../src/lib/data-source";

jest.mock("react-native-safe-area-context", () => {
  const ReactMock = jest.requireActual("react") as typeof import("react");
  const RNMock = jest.requireActual(
    "react-native",
  ) as typeof import("react-native");
  return {
    SafeAreaView: ({ children }: { children: ReactNode }) =>
      ReactMock.createElement(RNMock.View, null, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const mockTranslate = jest.fn((key: string) => key);
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

let mockSlug = "maquis-braise";
const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock("expo-router", () => {
  const ReactMock = jest.requireActual("react") as typeof import("react");
  const RNMock = jest.requireActual(
    "react-native",
  ) as typeof import("react-native");
  return {
    useFocusEffect: (effect: () => void) =>
      require("react").useEffect(effect, [effect]),
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack }),
    useLocalSearchParams: () => ({ slug: mockSlug }),
    Redirect: ({ href }: { href: string }) =>
      ReactMock.createElement(RNMock.Text, { testID: "redirect" }, href),
  };
});

let mockFlagsReady = true;
let mockFlags: Record<string, boolean> = {};
jest.mock("../../src/store/feature-flags", () => ({
  useFlag: (code: string) => mockFlags[code] ?? false,
  useFeatureFlagsStore: (select: (s: unknown) => unknown) => select({ lastSyncAt: mockFlagsReady ? 1 : null, loading: !mockFlagsReady }),
}));

jest.mock("../../src/lib/analytics", () => ({
  track: jest.fn(),
}));

jest.mock("../../src/lib/use-spawter-position", () => ({
  useSpawterPosition: () => ({ lat: 5.358, lng: -3.97, source: "fallback" }),
}));

const mockStoreState = {
  spawter: null,
  palais: null,
  spawts: [] as Array<{ place_id: string; is_verified: boolean }>,
  savedPlaceIds: new Set<string>(),
};
jest.mock("../../src/store/spawter-store", () => ({
  useSpawterStore: (selector: (s: typeof mockStoreState) => unknown) =>
    selector(mockStoreState),
}));

let mockDetail: ExploreCollectionDetail | null = null;
jest.mock("../../src/lib/data-source", () => ({
  isSupabaseConfigured: false,
  dataSourceMode: "fallback",
  getExploreCollection: jest.fn(() => Promise.resolve(mockDetail)),
}));

import { getExploreCollection } from "../../src/lib/data-source";
import { DataLoadNotice } from "../../src/components/DataLoadNotice";
import ExploreCollectionScreen from "../../app/explore/[slug]";
import { ThemeProvider } from "../../src/theme/ThemeProvider";
import { track } from "../../src/lib/analytics";

const NOW_ISO = "2026-07-26T12:00:00Z";

function makePlace(id: string, name: string): PlaceWithAdn {
  return {
    id,
    name,
    cuisine: ["ivoirienne"],
    location: {
      lat: 5.36,
      lng: -3.99,
      descriptive_address: "Test",
      neighborhood: "Cocody",
      city: "Abidjan",
    },
    price: { tier: 1 },
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
      axe_local_international: -0.5,
      axe_informel_etabli: -0.5,
      axe_budget_premium: -0.5,
      axe_populaire_prive: 0,
      axe_decontracte_habille: -0.5,
      confidence_score: 0.8,
      total_reviews: 20,
      weighted_rating: 4.4,
      updated_at: NOW_ISO,
    },
    rating_display: 4.4,
    total_spawts: 30,
  } as unknown as PlaceWithAdn;
}

function makeDetail(): ExploreCollectionDetail {
  return {
    id: "col-1",
    slug: "maquis-braise",
    title_key: "explore.maquis-braise.title",
    subtitle_key: "explore.maquis-braise.subtitle",
    cover_url: null,
    sort_order: 1,
    city_code: "abidjan",
    items: [
      {
        id: "i1",
        place: makePlace("p1", "Maquis Fixture Un"),
        editorial_text: "Le mot du Chat sur le premier.",
        sort_order: 1,
      },
      {
        id: "i2",
        place: makePlace("p2", "Maquis Fixture Deux"),
        editorial_text: "Le mot du Chat sur le second.",
        sort_order: 2,
      },
    ],
  };
}

interface NodeLike {
  type: unknown;
  props: Record<string, unknown>;
}

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
        <ExploreCollectionScreen />
      </ThemeProvider>,
    ) as unknown as RendererLike;
    await Promise.resolve();
  });
  if (!r) throw new Error("renderer did not init");
  return r;
}

const trackMock = track as jest.Mock;

describe("ExploreCollectionScreen — gate + rendu", () => {
  beforeEach(() => {
  mockFlagsReady = true;
    jest.clearAllMocks();
    mockFlags = {};
    mockDetail = null;
  });

  it("keeps a cold-start deep link while remote flags are unresolved", async () => {
    mockFlagsReady = false;
    mockFlags = {};
    const r = await renderScreen();
    expect(r.root.findAll(n => isHost(n) && n.props.testID === "redirect")).toHaveLength(0);
    expect(JSON.stringify(r.toJSON())).toContain("common.loading");
  });

  it("flag OFF → Redirect feed (deep link direct vers un slug)", async () => {
    mockFlags = { "mode-explore": false };
    const r = await renderScreen();
    expect(
      r.root.findAll((n) => isHost(n) && n.props.testID === "redirect"),
    ).toHaveLength(1);
  });

  it("rend le mot du Chat + les cartes lieux dans l'ordre éditorial", async () => {
    mockFlags = { "mode-explore": true };
    mockDetail = makeDetail();
    const r = await renderScreen();
    const tree = JSON.stringify(r.toJSON());
    expect(tree).toContain("Le mot du Chat sur le premier.");
    expect(tree).toContain("Maquis Fixture Un");
    expect(tree).toContain("Maquis Fixture Deux");
    // Ordre éditorial : le premier item apparaît avant le second.
    expect(tree.indexOf("Maquis Fixture Un")).toBeLessThan(
      tree.indexOf("Maquis Fixture Deux"),
    );
    expect(trackMock).toHaveBeenCalledWith({
      name: "explore_collection_opened",
      properties: { slug: "maquis-braise", items_count: 2 },
    });
  });

  it("tap sur une carte → explore_item_clicked + fiche lieu ref=explore", async () => {
    mockFlags = { "mode-explore": true };
    mockDetail = makeDetail();
    const r = await renderScreen();
    // PlaceCard expose `${name}, score X%` en accessibilityLabel.
    const cards = r.root.findAll(
      (n) =>
        typeof n.props.accessibilityLabel === "string" &&
        n.props.accessibilityLabel.startsWith("Maquis Fixture Un") &&
        typeof n.props.onPress === "function",
    );
    expect(cards.length).toBeGreaterThan(0);
    TestRenderer.act(() => {
      (cards[0]!.props.onPress as () => void)();
    });
    expect(trackMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "explore_item_clicked",
        properties: expect.objectContaining({ place_id: "p1", position: 0 }),
      }),
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/place/[id]",
      params: { id: "p1", ref: "explore" },
    });
  });

  it("slug introuvable → état « carnet rangé » + CTA retour", async () => {
    mockFlags = { "mode-explore": true };
    mockDetail = null;
    const r = await renderScreen();
    expect(JSON.stringify(r.toJSON())).toContain("explore.not_found_title");
    const cta = r.root.findAll(
      (n) =>
        n.props.accessibilityLabel === "explore.back_to_collections" &&
        typeof n.props.onPress === "function",
    );
    expect(cta.length).toBeGreaterThan(0);
    TestRenderer.act(() => {
      (cta[0]!.props.onPress as () => void)();
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

it("distinguishes a detail read failure from an unpublished carnet and retries", async () => {
  mockSlug = "maquis-braise";
  mockFlags = { "mode-explore": true };
  (getExploreCollection as jest.Mock).mockRejectedValueOnce(
    new Error("offline"),
  );
  let tree!: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    tree = TestRenderer.create(
      <ThemeProvider>
        <ExploreCollectionScreen />
      </ThemeProvider>,
    );
  });
  expect(tree.root.findByType(DataLoadNotice).props.failed).toBe(true);
  expect(JSON.stringify(tree.toJSON())).not.toContain(
    "explore.not_found_title",
  );
  (getExploreCollection as jest.Mock).mockResolvedValueOnce(makeDetail());
  await TestRenderer.act(async () =>
    tree.root.findByType(DataLoadNotice).props.onRetry(),
  );
  expect(JSON.stringify(tree.toJSON())).toContain("Maquis Fixture Un");
  TestRenderer.act(() => tree.unmount());
});

it("discards a late response from a previous slug", async () => {
  mockFlags = { "mode-explore": true };
  mockSlug = "maquis-braise";
  let resolve!: (data: ExploreCollectionDetail) => void;
  (getExploreCollection as jest.Mock).mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  let tree!: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    tree = TestRenderer.create(
      <ThemeProvider>
        <ExploreCollectionScreen />
      </ThemeProvider>,
    );
  });
  mockSlug = "unknown";
  (getExploreCollection as jest.Mock).mockResolvedValueOnce(null);
  await TestRenderer.act(async () =>
    tree.update(
      <ThemeProvider>
        <ExploreCollectionScreen />
      </ThemeProvider>,
    ),
  );
  await TestRenderer.act(async () => resolve(makeDetail()));
  expect(JSON.stringify(tree.toJSON())).toContain("explore.not_found_title");
  expect(JSON.stringify(tree.toJSON())).not.toContain("Maquis Fixture Un");
  TestRenderer.act(() => tree.unmount());
  mockSlug = "maquis-braise";
});

it("a published carnet with no visible spots has an explicit empty state and back action", async () => {
  mockFlags = { "mode-explore": true };
  mockSlug = "maquis-braise";
  (getExploreCollection as jest.Mock).mockResolvedValueOnce({
    ...makeDetail(),
    items: [],
  });
  let tree!: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    tree = TestRenderer.create(
      <ThemeProvider>
        <ExploreCollectionScreen />
      </ThemeProvider>,
    );
  });
  expect(JSON.stringify(tree.toJSON())).toContain("explore.items_empty_title");
  const back = tree.root.findAll(
    (n) =>
      n.props.accessibilityLabel === "explore.back_to_collections" &&
      typeof n.props.onPress === "function",
  )[0]!;
  TestRenderer.act(() => back.props.onPress());
  expect(mockBack).toHaveBeenCalled();
  TestRenderer.act(() => tree.unmount());
});

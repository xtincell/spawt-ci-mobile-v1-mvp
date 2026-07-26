// Tests Mode Explore — écran liste des carnets (app/explore.tsx).
// Couvre : flag `mode-explore` OFF → Redirect feed, flag ON → rendu des
// collections publiées (titres via title_key) + explore_opened, tap carnet →
// push /explore/[slug], zéro collection → état vide.

import { type ReactNode } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only.
import TestRenderer from "react-test-renderer";

import type { ExploreCollectionSummary } from "../../src/lib/data-source";

jest.mock("react-native-safe-area-context", () => {
  const ReactMock = jest.requireActual("react") as typeof import("react");
  const RNMock = jest.requireActual("react-native") as typeof import("react-native");
  return {
    SafeAreaView: ({ children }: { children: ReactNode }) =>
      ReactMock.createElement(RNMock.View, null, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const mockTranslate = jest.fn((key: string, opts?: Record<string, unknown>) =>
  opts && typeof opts.title === "string" ? `${key}:${opts.title}` : key,
);
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock("expo-router", () => {
  const ReactMock = jest.requireActual("react") as typeof import("react");
  const RNMock = jest.requireActual("react-native") as typeof import("react-native");
  return {
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack }),
    Redirect: ({ href }: { href: string }) =>
      ReactMock.createElement(RNMock.Text, { testID: "redirect" }, href),
  };
});

let mockFlags: Record<string, boolean> = {};
jest.mock("../../src/store/feature-flags", () => ({
  useFlag: (code: string) => mockFlags[code] ?? false,
}));

jest.mock("../../src/lib/analytics", () => ({
  track: jest.fn(),
}));

let mockCollections: ExploreCollectionSummary[] = [];
jest.mock("../../src/lib/data-source", () => ({
  isSupabaseConfigured: false,
  dataSourceMode: "fallback",
  listExploreCollections: jest.fn(() => Promise.resolve(mockCollections)),
}));

import ExploreScreen from "../../app/explore";
import { ThemeProvider } from "../../src/theme/ThemeProvider";
import { track } from "../../src/lib/analytics";

function makeCollection(slug: string, sort: number): ExploreCollectionSummary {
  return {
    id: `col-${slug}`,
    slug,
    title_key: `explore.${slug}.title`,
    subtitle_key: `explore.${slug}.subtitle`,
    cover_url: null,
    sort_order: sort,
    city_code: "abidjan",
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
        <ExploreScreen />
      </ThemeProvider>,
    ) as unknown as RendererLike;
    await Promise.resolve();
  });
  if (!r) throw new Error("renderer did not init");
  return r;
}

const trackMock = track as jest.Mock;

describe("ExploreScreen — gate du flag mode-explore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFlags = {};
    mockCollections = [];
  });

  it("flag OFF → Redirect vers le feed, aucun event émis", async () => {
    mockFlags = { "mode-explore": false };
    const r = await renderScreen();
    expect(
      r.root.findAll((n) => isHost(n) && n.props.testID === "redirect"),
    ).toHaveLength(1);
    expect(trackMock).not.toHaveBeenCalled();
  });

  it("flag ON → collections rendues (title_key) + explore_opened", async () => {
    mockFlags = { "mode-explore": true };
    mockCollections = [
      makeCollection("maquis-braise", 1),
      makeCollection("sucre-cocody", 2),
    ];
    const r = await renderScreen();
    const tree = JSON.stringify(r.toJSON());
    expect(tree).toContain("explore.maquis-braise.title");
    expect(tree).toContain("explore.sucre-cocody.title");
    expect(trackMock).toHaveBeenCalledWith({
      name: "explore_opened",
      properties: { collections_count: 2 },
    });
  });

  it("zéro collection → état vide (les carnets arrivent)", async () => {
    mockFlags = { "mode-explore": true };
    const r = await renderScreen();
    expect(JSON.stringify(r.toJSON())).toContain("explore.empty_title");
  });

  it("tap sur un carnet → push /explore/[slug]", async () => {
    mockFlags = { "mode-explore": true };
    mockCollections = [makeCollection("maquis-braise", 1)];
    const r = await renderScreen();
    const cards = r.root.findAll(
      (n) =>
        n.props.accessibilityLabel ===
          "explore.collection_open_aria:explore.maquis-braise.title" &&
        typeof n.props.onPress === "function",
    );
    expect(cards.length).toBeGreaterThan(0);
    TestRenderer.act(() => {
      (cards[0]!.props.onPress as () => void)();
    });
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/explore/[slug]",
      params: { slug: "maquis-braise" },
    });
  });
});

jest.mock("../../src/lib/analytics", () => ({ track: jest.fn() }));
import TestRenderer, { act } from "react-test-renderer";
import { HomeEditorial } from "../../src/components/HomeEditorial";
import { ThemeProvider } from "../../src/theme/ThemeProvider";
import { DataLoadNotice } from "../../src/components/DataLoadNotice";
import React from "react";
import { FlatList, Image } from "react-native";
import { SEED_PLACES } from "../../src/data/seed/places";
import { OutingActions } from "../../src/components/OutingActions";
import type { ExploreCollectionSummary } from "../../src/lib/data-source";
const mockPush = jest.fn();
let mockEnabled = true;
const mockList = jest.fn();
jest.mock("../../src/components/OutingActions", () => ({ OutingActions: () => null }));
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) =>
    require("react").useEffect(effect, [effect]),
  useRouter: () => ({ push: mockPush }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("../../src/store/feature-flags", () => ({
  useFlag: () => mockEnabled,
}));
jest.mock("../../src/lib/data-source", () => ({
  listExploreCollections: (...args: unknown[]) => mockList(...args),
}));
const carnet: ExploreCollectionSummary = {
  id: "one",
  slug: "maquis-braise",
  title_key: "explore.maquis-braise.title",
  subtitle_key: null,
  cover_url: null,
  sort_order: 1,
  city_code: "abidjan",
};
const props = {
  mode: "selections" as const,
  ranked: [],
  onPlacePress: jest.fn(),
};
const render = () => (
  <ThemeProvider>
    <HomeEditorial {...props} />
  </ThemeProvider>
);
let tree: TestRenderer.ReactTestRenderer;
afterEach(() => {
  if (tree) act(() => tree.unmount());
});
beforeEach(() => {
  jest.clearAllMocks();
  mockEnabled = true;
});

it("uses official covers, falls back inside the same card, and gates the community score on public reviews", async () => {
  const place = SEED_PLACES[0]!;
  const cover = "https://example.test/facade.jpg";
  const base = { place, adn: place.adn, raw_score: 0.7, match_score: 80, distance_km: 1 };
  const reviewed = { ...base,
    place: { ...place, cover_photo_url: cover },
    adn: { ...place.adn, weighted_rating: 4.5, total_reviews: 3 } };
  const unrated = { ...base,
    place: { ...place, id: "no-public-reviews", name: "Sans avis", cover_photo_url: null },
    adn: { ...place.adn, weighted_rating: 4.8, total_reviews: 0 } };
  const onImpression = jest.fn();
  const onPlacePress = jest.fn();
  await act(async () => {
    tree = TestRenderer.create(<ThemeProvider><HomeEditorial mode="suggestions" ranked={[reviewed, unrated]}
      onPlacePress={onPlacePress} onImpression={onImpression} /></ThemeProvider>);
  });
  const list = tree.root.findByType(FlatList);
  const onVisible = list.props.onViewableItemsChanged;
  const viewableItems = [{ item: reviewed, index: 0 }];
  act(() => { onVisible({ viewableItems }); onVisible({ viewableItems }); });
  expect(onImpression).toHaveBeenCalledTimes(1);
  expect(onImpression).toHaveBeenCalledWith(reviewed, 0);
  // Render the captured cells explicitly: Jest has no measured horizontal viewport.
  const renderItem = list.props.renderItem;
  act(() => {
    tree.update(<ThemeProvider>{[reviewed, unrated].map((item, index) =>
      <React.Fragment key={item.place.id}>{renderItem({ item, index })}</React.Fragment>)}</ThemeProvider>);
  });
  const coverNode = () => tree.root.findAllByType(Image).find(node => node.props.source?.uri === cover);
  const cards = tree.root.findAll(n => n.props.accessibilityRole === "button" && typeof n.props.onPress === "function");
  const ratedCard = cards.find(node => node.props.accessibilityLabel?.startsWith(place.name))!;
  expect(ratedCard.props.accessibilityLabel).toContain("4,5/5");
  expect(ratedCard.props.accessibilityLabel).toContain("place.bande_review_count");
  expect(cards.find(node => node.props.accessibilityLabel?.startsWith("Sans avis"))!.props.accessibilityLabel).not.toContain("/5");
  expect(tree.root.findAllByType(OutingActions).map(node => node.props.onHomeCard)).toEqual([true, true]);
  act(() => ratedCard.props.onPress());
  expect(onPlacePress).toHaveBeenCalledWith(reviewed);
  expect(coverNode()).toBeDefined();
  act(() => coverNode()!.props.onError());
  expect(coverNode()).toBeUndefined();
  expect(tree.root.findAllByType(Image)).toHaveLength(2);
});

it("loads collections in place, opens only the selected published carnet", async () => {
  mockList.mockResolvedValue([carnet]);
  await act(async () => {
    tree = TestRenderer.create(render());
  });
  expect(mockList).toHaveBeenCalledWith({ throwOnError: true });
  expect(JSON.stringify(tree.toJSON())).not.toContain("editorial.collections_empty");
  expect(mockPush).not.toHaveBeenCalled();
  const card = tree.root.findAll(
    (n) =>
      n.props.accessibilityRole === "button" &&
      typeof n.props.onPress === "function",
  )[0]!;
  act(() => {
    card.props.onPress();
    card.props.onPress();
  });
  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith({
    pathname: "/explore/[slug]",
    params: { slug: carnet.slug },
  });
});
it("reports loading, distinguishes error from empty, retries successfully", async () => {
  let reject!: (reason: Error) => void;
  mockList.mockReturnValue(
    new Promise((_, fail) => {
      reject = fail;
    }),
  );
  await act(async () => {
    tree = TestRenderer.create(render());
  });
  expect(tree.root.findByType(DataLoadNotice).props.loading).toBe(true);
  await act(async () => {
    reject(new Error("offline"));
  });
  expect(tree.root.findByType(DataLoadNotice).props.failed).toBe(true);
  expect(JSON.stringify(tree.toJSON())).not.toContain("editorial.collections_empty");
  mockList.mockResolvedValue([]);
  await act(async () => tree.root.findByType(DataLoadNotice).props.onRetry());
  expect(tree.root.findByType(DataLoadNotice).props.failed).toBe(false);
  expect(JSON.stringify(tree.toJSON())).toContain("editorial.collections_empty");
});
it("keeps readable collections when refresh fails and ignores stale request on mode switch", async () => {
  mockList.mockResolvedValue([carnet]);
  await act(async () => {
    tree = TestRenderer.create(render());
  });
  mockList.mockRejectedValue(new Error("offline"));
  await act(async () =>
    tree.update(
      <ThemeProvider>
        <HomeEditorial {...props} refreshKey={1} />
      </ThemeProvider>,
    ),
  );
  expect(tree.root.findByType(DataLoadNotice).props.failed).toBe(true);
  expect(JSON.stringify(tree.toJSON())).toContain(carnet.title_key);
  await act(async () =>
    tree.update(
      <ThemeProvider>
        <HomeEditorial {...props} mode="suggestions" />
      </ThemeProvider>,
    ),
  );
  expect(tree.root.findAllByType(DataLoadNotice)).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain("home.editorial_empty");
});
it("respects disabled flag, fetches nothing, and does not redirect", async () => {
  mockEnabled = false;
  await act(async () => {
    tree = TestRenderer.create(render());
  });
  expect(mockList).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).not.toContain("editorial.collections_empty");
  expect(mockPush).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain(
    "home.collections_unavailable",
  );
});

it("duo reads only server-tagged collections and handles empty honestly", async () => {
  mockList.mockResolvedValue([carnet]);
  await act(async () => { tree = TestRenderer.create(<ThemeProvider><HomeEditorial {...props} mode="duo" /></ThemeProvider>); });
  expect(mockList).toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain("editorial.duo_empty");
  expect(JSON.stringify(tree.toJSON())).not.toContain(carnet.title_key);
  expect(mockPush).not.toHaveBeenCalled();
});
it("duo displays an explicitly curated server collection", async () => {
  mockList.mockResolvedValue([carnet, { ...carnet, id: "duo", slug: "duo", title_key: "Carnet terrain", audience: "duo" }]);
  await act(async () => { tree = TestRenderer.create(<ThemeProvider><HomeEditorial {...props} mode="duo" /></ThemeProvider>); });
  expect(JSON.stringify(tree.toJSON())).toContain("Carnet terrain");
  expect(JSON.stringify(tree.toJSON())).not.toContain(carnet.title_key);
});

it("ignores a collection response that arrives after switching to Suggestions", async () => {
  let resolve!: (rows: ExploreCollectionSummary[]) => void;
  mockList.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await act(async () => {
    tree = TestRenderer.create(render());
  });
  await act(async () => {
    tree.update(
      <ThemeProvider>
        <HomeEditorial {...props} mode="suggestions" />
      </ThemeProvider>,
    );
  });
  await act(async () => {
    resolve([carnet]);
  });
  expect(JSON.stringify(tree.toJSON())).not.toContain(carnet.title_key);
});

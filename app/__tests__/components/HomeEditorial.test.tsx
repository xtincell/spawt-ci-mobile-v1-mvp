jest.mock("../../src/lib/analytics", () => ({ track: jest.fn() }));
import TestRenderer, { act } from "react-test-renderer";
import { HomeEditorial } from "../../src/components/HomeEditorial";
import { ThemeProvider } from "../../src/theme/ThemeProvider";
import { DataLoadNotice } from "../../src/components/DataLoadNotice";
import { Pressable } from "react-native";
import type { ExploreCollectionSummary } from "../../src/lib/data-source";
const mockPush = jest.fn();
let mockEnabled = true;
const mockList = jest.fn();
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

import TestRenderer, { act } from "react-test-renderer";
import { FlatList } from "react-native";
import MeuteScreen from "../../app/(tabs)/meute";
import { ThemeProvider } from "../../src/theme/ThemeProvider";
import { DataLoadNotice } from "../../src/components/DataLoadNotice";
const mockRead = jest.fn();
const mockPush = jest.fn();
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: require("react-native").View,
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => unknown) =>
    require("react").useEffect(effect, [effect]),
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({}),
}));
jest.mock("../../src/lib/analytics", () => ({ track: jest.fn() }));
jest.mock("../../src/store/feature-flags", () => ({ useFlag: () => false }));
jest.mock("../../src/components/crew/CrewBlock", () => ({
  CrewBlock: () => null,
}));
jest.mock("../../src/components/DataSourceBanner", () => ({
  DataSourceBanner: () => null,
}));
jest.mock("../../src/lib/data-source", () => ({
  listCommunityPage: (query: unknown) => mockRead(query),
}));
let tree: TestRenderer.ReactTestRenderer;
const render = () => (
  <ThemeProvider>
    <MeuteScreen />
  </ThemeProvider>
);
afterEach(() => {
  if (tree) act(() => tree.unmount());
});
beforeEach(() => jest.clearAllMocks());

it("keeps loading distinct from an empty or failed community, then retries", async () => {
  let reject!: (error: Error) => void;
  mockRead.mockReturnValue(
    new Promise((_, fail) => {
      reject = fail;
    })
  );
  await act(async () => {
    tree = TestRenderer.create(render());
  });
  expect(tree.root.findByType(DataLoadNotice).props.loading).toBe(true);
  expect(tree.root.findByType(FlatList).props.ListEmptyComponent).toBeNull();
  await act(async () => reject(new Error("offline")));
  expect(tree.root.findByType(DataLoadNotice).props.failed).toBe(true);
  expect(tree.root.findByType(FlatList).props.ListEmptyComponent).toBeNull();
  mockRead.mockResolvedValue({ items: [], next: null });
  await act(async () => tree.root.findByType(DataLoadNotice).props.onRetry());
  expect(
    tree.root.findByType(FlatList).props.ListEmptyComponent.props.body
  ).toBe("meute.empty_body");
});
it("preserves the last readable activity if refresh fails and navigates to the place", async () => {
  const item = {
    kind: "review",
    id: "r1",
    place_id: "p1",
    place_name: "Adresse de test",
    place_neighborhood: "Cocody",
    spawter_display_name: "Profil de test",
    note_etoiles: 4,
    created_at: "2026-10-13T09:00:00Z",
  };
  mockRead.mockResolvedValue({ items: [item], next: null });
  await act(async () => {
    tree = TestRenderer.create(render());
  });
  mockRead.mockRejectedValue(new Error("offline"));
  await act(async () => tree.root.findByType(DataLoadNotice).props.onRetry());
  expect(tree.root.findByType(DataLoadNotice).props.failed).toBe(true);
  const list = tree.root.findByType(FlatList);
  expect(list.props.data).toEqual([item]);
  act(() =>
    tree.root
      .findAll(
        (node) =>
          node.props.testID === "community-place-r1" &&
          typeof node.type !== "string"
      )[0]!
      .props.onPress()
  );
  expect(mockPush).toHaveBeenCalledWith("/place/p1");
});

it("ignores a stale response after changing filter and reloads after a publication", async () => {
  let resolveOld!: (value: unknown) => void;
  mockRead.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveOld = resolve;
    })
  );
  await act(async () => {
    tree = TestRenderer.create(render());
  });
  mockRead.mockResolvedValue({ items: [], next: null });
  await act(async () =>
    tree.root
      .findAll(
        (node) =>
          node.props.testID === "community-filter-coup" &&
          typeof node.type !== "string"
      )[0]!
      .props.onPress()
  );
  await act(async () => resolveOld({ items: [{ id: "stale" }], next: null }));
  expect(tree.root.findByType(FlatList).props.data).toEqual([]);
  expect(mockRead).toHaveBeenLastCalledWith({ filter: "coup", cursor: null });
  const { notifyReviewChanged } = require("../../src/lib/review-events");
  await act(async () => notifyReviewChanged("p1"));
  expect(mockRead).toHaveBeenCalledTimes(3);
});

it("locks repeated pagination taps, preserves the page on failure, and retries the same cursor", async () => {
  const next = { id: "page-1", created_at: "2026-10-13T00:00:00Z" };
  mockRead.mockResolvedValueOnce({ items: [], next });
  await act(async () => {
    tree = TestRenderer.create(render());
  });
  let fail!: (error: Error) => void;
  mockRead.mockReturnValueOnce(
    new Promise((_, reject) => {
      fail = reject;
    })
  );
  const button = () =>
    tree.root.findAll(
      (node) =>
        node.props.testID === "community-load-more" &&
        typeof node.type !== "string"
    )[0]!;
  await act(async () => {
    button().props.onPress();
    button().props.onPress();
  });
  expect(mockRead).toHaveBeenCalledTimes(2);
  await act(async () => fail(new Error("offline")));
  mockRead.mockResolvedValue({ items: [], next: null });
  await act(async () => button().props.onPress());
  expect(mockRead).toHaveBeenLastCalledWith({ filter: "all", cursor: next });
});
